import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { parseRobots, robotsDecision, absentRobotsDecision, absentRobotsPathAllowed } from '../robots.mjs';
import { EvidenceHTTP, isPublicAddress, validatePublicUrl } from '../http.mjs';
import { DATA_DIR } from '../paths.mjs';
import { acquireCollectionLock } from '../lock.mjs';

test('discovery evidence stays isolated without changing transport or accepting an external output directory', () => {
  const args = { runId: 'fixture', sourceId: 'fixture', allowedHosts: ['example.com'], lease: {} };
  const http = new EvidenceHTTP({ ...args, dataDir: join(DATA_DIR, 'discovery') });
  assert.equal(http.rawDir, join(DATA_DIR, 'discovery', 'raw'));
  assert.equal(new EvidenceHTTP(args).dataDir, DATA_DIR);
  assert.throws(() => new EvidenceHTTP({ ...args, dataDir: '/tmp/elsewhere' }), /inside official-careers/);
});

test('unknown HTML, empty and malformed robots policies fail closed', () => {
  for (const text of ['<html><body>Welcome</body></html>', '', 'not a policy']) {
    assert.equal(robotsDecision(parseRobots(text), 'https://example.com/jobs').allowed, false);
  }
});

test('robots path restrictions and more-specific Allow rules are honored', () => {
  const policy = parseRobots('User-agent: *\nDisallow: /private\nAllow: /private/public\nCrawl-delay: 25');
  assert.equal(robotsDecision(policy, 'https://example.com/private').allowed, false);
  assert.equal(robotsDecision(policy, 'https://example.com/private/public/jobs').allowed, true);
  assert.equal(robotsDecision(policy, 'https://example.com/jobs').crawl_delay_ms, 25000);
});

test('public URL validation rejects credentials, non-HTTPS, private literals and other hosts', () => {
  const allowed = ['example.com'];
  assert.equal(validatePublicUrl('https://example.com/jobs', allowed).hostname, 'example.com');
  for (const url of ['http://example.com/jobs', 'https://user:secret@example.com', 'https://127.0.0.1/', 'https://other.com/', 'https://example.com:9443/']) {
    assert.throws(() => validatePublicUrl(url, allowed));
  }
});

test('robots absence policy is exact-origin and ownership scoped, never an access-denial bypass', () => {
  const response = { url: 'https://example.com/robots.txt', status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' }, text: 'Not Found' };
  const policy = { version: 'test', absent_robots_public_read_allowlist: [{ origin: 'https://example.com', company_id: 'company', required_status: 404, required_content_type: 'text/plain', required_body: 'Not Found' }] };
  const context = { companyId: 'company', ownershipVerified: true };
  assert.equal(absentRobotsDecision(response, policy, context).allowed, true);
  assert.equal(absentRobotsDecision(response, policy, { ...context, ownershipVerified: false }).allowed, false);
  for (const changed of [{ status: 403 }, { status: 429 }, { status: 401 }, { text: '<html>Not Found</html>' }, { headers: { 'content-type': 'text/html' } }, { url: 'https://other.com/robots.txt' }, { url: 'https://example.com/private' }]) {
    assert.equal(absentRobotsDecision({ ...response, ...changed }, policy, context).allowed, false);
  }
});

test('DNS targets reject private, link-local and documentation ranges', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.1.1', '172.16.0.1', '169.254.169.254', '100.64.0.1', '::1', 'fc00::1', '::ffff:127.0.0.1', '2001:db8::1']) {
    assert.equal(isPublicAddress(ip), false, ip);
  }
  assert.equal(isPublicAddress('8.8.8.8'), true);
});

test('reviewed HTML 404 requires the exact hash and only grants referenced CDN paths or seed root', () => {
  const text = '<html><h1>404 Not Found</h1></html>';
  const digest = createHash('sha256').update(text).digest('hex');
  const response = { url: 'https://example.com/robots.txt', status: 404, headers: { 'content-type': 'text/html' }, text, sha256: digest, complete: true };
  const rule = { origin: 'https://example.com', company_id: 'company', required_status: 404, required_content_type: 'text/html', required_body_sha256: digest,
    allowed_path_prefixes: ['/static/js/'], require_page_reference: true };
  const policy = { version: 'test', absent_robots_public_read_allowlist: [rule] };
  const context = { companyId: 'company', ownershipVerified: true };
  const approved = absentRobotsDecision(response, policy, context);
  assert.equal(approved.allowed, true);
  assert.equal(absentRobotsDecision({ ...response, text: '<html>verify you are human</html>' }, policy, context).allowed, false);
  assert.equal(absentRobotsPathAllowed(approved, 'https://example.com/static/js/main.js', { pageReferenced: true }), true);
  for (const url of ['https://evil.com/static/js/main.js', 'https://example.com/api/private', 'https://example.com/static/js/main.js?x=1']) {
    assert.equal(absentRobotsPathAllowed(approved, url, { pageReferenced: true }), false);
  }
  assert.equal(absentRobotsPathAllowed(approved, 'https://example.com/static/js/main.js'), false);
  const seedPolicy = { ...policy, absent_robots_public_read_allowlist: [{ ...rule, allowed_path_prefixes: null, allowed_paths: ['/'], require_page_reference: false, trusted_seed_homepage: true }] };
  assert.equal(absentRobotsDecision(response, seedPolicy, { companyId: 'company', requestUrl: 'https://example.com/' }).allowed, true);
  assert.equal(absentRobotsDecision(response, seedPolicy, { companyId: 'company', requestUrl: 'https://example.com/private' }).allowed, false);
});

test('collection lease serializes processes and persists minimum pacing', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'careers-lock-test-'));
  const controlPath = join(directory, 'control.sqlite');
  let first;
  let second;
  let inspection;
  try {
    first = await acquireCollectionLock({ controlPath });
    await assert.rejects(acquireCollectionLock({ controlPath, waitMs: 0 }), /QUEUE_TIMEOUT/);
    const started = Date.parse(await first.beforeRequest());
    await assert.rejects(first.beforeRequest(), /Concurrent requests/);
    inspection = new DatabaseSync(controlPath);
    let next = inspection.prepare('SELECT next_request_at FROM lease WHERE id=1').get().next_request_at;
    assert(next >= started + 10000 && next <= started + 20000);
    first.afterRequest(35000);
    next = inspection.prepare('SELECT next_request_at FROM lease WHERE id=1').get().next_request_at;
    assert(next >= started + 35000);
    first.release();
    second = await acquireCollectionLock({ controlPath, waitMs: 0 });
    assert.equal(inspection.prepare('SELECT next_request_at FROM lease WHERE id=1').get().next_request_at, next);
  } finally {
    second?.release();
    first?.release();
    inspection?.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('releasing an unfinished long request preserves cooldown and waiting can abort', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'careers-lock-abort-'));
  const controlPath = join(directory, 'control.sqlite');
  let first, second, inspection;
  const realNow = Date.now;
  try {
    first = await acquireCollectionLock({ controlPath });
    const start = Date.parse(await first.beforeRequest());
    Date.now = () => start + 30_000;
    first.release();
    inspection = new DatabaseSync(controlPath);
    const next = inspection.prepare('SELECT next_request_at FROM lease WHERE id=1').get().next_request_at;
    assert(next >= start + 40_000 && next <= start + 50_000);
    second = await acquireCollectionLock({ controlPath });
    const controller = new AbortController();
    const admission = second.beforeRequest({ signal: controller.signal });
    controller.abort();
    await assert.rejects(admission, /abort/i);
    second.release();
    assert.equal(inspection.prepare('SELECT next_request_at FROM lease WHERE id=1').get().next_request_at, next);
  } finally {
    Date.now = realNow;
    second?.release(); first?.release(); inspection?.close();
    await rm(directory, { recursive: true, force: true });
  }
});
