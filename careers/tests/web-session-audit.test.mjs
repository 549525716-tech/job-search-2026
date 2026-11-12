import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { auditWebSession } from '../audit-web-session.mjs';

async function fixture(t, { tamper = false, cooldown = 15000, unfinished = false, browser = false } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'career-web-audit-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir, 'raw'));
  const events = [];
  const start = Date.parse('2026-09-12T18:00:00.000Z');
  for (let i = 0; i < 2; i++) {
    const at = start + i * (1000 + cooldown), id = `q${i}`;
    const begin = { event: 'begin', id, operation: 'search', route: i ? 'B' : 'A', request: { search_query: [{ q: id }] }, queue_admitted_at: new Date(at).toISOString() };
    if (browser) Object.assign(begin, { kind: 'browser_visible_page_capture', operation: 'read', request: { browser: 'iab', url: 'https://jobs.example.test/' } });
    const capture = { kind: browser ? 'browser_visible_page_capture' : 'web_tool_result_not_raw_http', operation: begin.operation, request: begin.request, route: begin.route,
      started_at: new Date(at + 10).toISOString(), observed_at: new Date(at + 900).toISOString(), result: 'Test source', execution: { agent_id: 'test-agent' } };
    if (browser) capture.result = i ? { url: 'about:blank', text: '' } : { url: 'https://jobs.example.test/', text: 'Hello Test User\nJobs', authenticated: true, account_evidence: 'Hello Test User' };
    const bytes = JSON.stringify(capture), file = join(dir, 'raw', id + '.json');
    await writeFile(file, tamper && i ? bytes + ' ' : bytes);
    events.push(begin);
    if (!(unfinished && i)) events.push({ ...begin, event: 'finish', persisted_at: new Date(at + 1000).toISOString(), evidence_file: file, evidence_sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  await writeFile(join(dir, 'web-session.jsonl'), events.map(JSON.stringify).join('\n'));
  return auditWebSession(dir);
}

test('audit verifies two routes, capture hashes and serial cooldown', async (t) => {
  const result = await fixture(t);
  assert.equal(result.status, 'passed_for_recorded_calls');
  assert.equal(result.calls, 2);
  assert.equal(result.minimum_cooldown_ms, 15000);
  assert.deepEqual(result.routes, ['A', 'B']);
});
test('audit rejects altered raw evidence', async (t) => {
  assert.match((await fixture(t, { tamper: true })).issues.join('\n'), /SHA256 mismatch/);
});
test('audit rejects insufficient cooldown and unfinished calls', async (t) => {
  const result = await fixture(t, { cooldown: 1000, unfinished: true });
  assert.match(result.issues.join('\n'), /cooldown below/);
  assert.match(result.issues.join('\n'), /not finished/);
});
test('browser evidence integrity is audited without making blank results successful collections', async (t) => {
  const result = await fixture(t, { browser: true });
  assert.equal(result.status, 'passed_for_recorded_calls');
  assert.deepEqual(result.receipts.map(row => row.outcome), ['authenticated_page_capture', 'blank_page']);
  assert.match(result.warnings.join('\n'), /blank_page; not proof/);
  assert.match(result.scope, /not successful collection/);
});
