import https from 'node:https';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { createHash } from 'node:crypto';
import { mkdir, writeFile, appendFile, readFile } from 'node:fs/promises';
import { persist } from './persistence.mjs';
import { join, resolve, sep } from 'node:path';
import { DATA_DIR, RAW_DIR, ROOT, assertId, repoRelative, evidenceAbsolute } from './paths.mjs';
import { parseRobots, robotsDecision, absentRobotsDecision, absentRobotsPathAllowed, USER_AGENT } from './robots.mjs';

export class SourceStop extends Error {
  constructor(code, message, evidence = null) {
    super(message);
    this.name = 'SourceStop';
    this.code = code;
    this.evidence = evidence;
  }
}

export function isPublicAddress(address) {
  if (isIP(address) === 4) {
    const [a, b, c] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
      (a === 192 && b === 0 && (c === 0 || c === 2)) || (a === 192 && b === 88 && c === 99) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113));
  }
  const lower = address.toLowerCase();
  return isIP(address) === 6 && /^[23]/.test(lower) &&
    !lower.startsWith('2001:db8:') && !lower.startsWith('2001:0:') && !lower.startsWith('2002:');
}

export function validatePublicUrl(value, allowedHosts) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password ||
      (url.port && url.port !== '443') || isIP(url.hostname) || !allowedHosts.includes(url.hostname)) {
    throw new SourceStop('URL_NOT_ALLOWED', `URL outside approved public HTTPS hosts: ${url.href}`);
  }
  url.hash = '';
  return url;
}

function challenge(body) {
  return /<title[^>]*>\s*(?:just a moment|attention required|access denied|security check)|verify (?:that )?you are (?:a )?human|checking your browser|人机验证|安全验证|访问过于频繁|cf-chl-|captcha-container/i.test(body);
}

function safeHeaders(headers) {
  return Object.fromEntries(Object.entries(headers).filter(([name]) => !['set-cookie', 'set-cookie2'].includes(name.toLowerCase())));
}

async function pinnedRequest(url, timeoutMs, maxBytes, { method = 'GET', body = null } = {}) {
  const start = Date.now();
  let timer;
  const addresses = await Promise.race([
    lookup(url.hostname, { all: true, verbatim: true }),
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('DNS_TIMEOUT')), timeoutMs); }),
  ]).finally(() => clearTimeout(timer));
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new SourceStop('NON_PUBLIC_DNS', 'DNS contained a non-public address');
  }
  const selected = addresses.find((entry) => entry.family === 4) ?? addresses[0];
  const remaining = timeoutMs - (Date.now() - start);
  if (remaining <= 0) throw new Error('NETWORK_TIMEOUT');
  return new Promise((resolve) => {
    let status = null;
    let headers = {};
    let total = 0;
    const chunks = [];
    let settled = false;
    const finish = (error = null) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      resolve({ status, headers, body: Buffer.concat(chunks), error: error?.message ?? error });
    };
    const request = https.request(url, {
      method, agent: false, family: selected.family,
      lookup: (_hostname, options, callback) => {
        if (options.all) callback(null, [selected]);
        else callback(null, selected.address, selected.family);
      },
      headers: { 'user-agent': USER_AGENT, accept: 'text/html,text/plain,application/json;q=0.8', 'accept-encoding': 'identity',
        ...(body ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) } : {}) },
    }, (response) => {
      status = response.statusCode;
      headers = safeHeaders(response.headers);
      response.on('data', (chunk) => {
        const available = maxBytes - total;
        if (available > 0) chunks.push(chunk.subarray(0, available));
        total += chunk.length;
        if (total > maxBytes) {
          finish('RESPONSE_SIZE_LIMIT');
          response.destroy();
          request.destroy();
        }
      });
      response.on('end', () => finish(response.complete ? null : 'INCOMPLETE_RESPONSE'));
      response.on('error', finish);
      response.on('aborted', () => finish('RESPONSE_ABORTED'));
    });
    const deadline = setTimeout(() => { finish('NETWORK_TIMEOUT'); request.destroy(); }, remaining);
    request.on('error', finish);
    request.end(body);
  });
}

export class EvidenceHTTP {
  constructor({ runId, sourceId, companyId = null, relatedSourceIds = [], allowedHosts, scriptHosts = [], publicPostUrls = [], lease, timeoutMs = 30_000, maxBytes = 4 * 1024 * 1024, dataDir = DATA_DIR }) {
    if (!lease || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000) {
      throw new Error('A collection lease and <=30s timeout are required');
    }
    this.runId = assertId(runId);
    this.dataDir = resolve(dataDir);
    if (this.dataDir !== resolve(DATA_DIR) && !this.dataDir.startsWith(`${resolve(DATA_DIR)}${sep}`)) throw new Error('HTTP evidence directory must stay inside official-careers');
    this.rawDir = this.dataDir === resolve(DATA_DIR) ? RAW_DIR : join(this.dataDir, 'raw');
    this.sourceId = assertId(sourceId);
    this.allowedHosts = [...allowedHosts];
    this.companyId = companyId;
    this.relatedSourceIds = [this.sourceId, ...relatedSourceIds];
    this.publicPostUrls = [...publicPostUrls];
    this.scriptHosts = [...scriptHosts];
    this.ownedOrigins = new Map();
    this.pageReferences = new Map();
    this.reusedEvidence = [];
    this.lease = lease;
    this.timeoutMs = timeoutMs;
    this.maxBytes = maxBytes;
    this.evidence = [];
    this.policies = new Map();
    this.stopped = null;
    this.inFlight = false;
    this.crawlDelayMs = 0;
  }

  approveOwnedOrigin(origin, ownershipEvidence) {
    const receipt = [...this.evidence, ...this.reusedEvidence].find((item) => item.metadata_path === ownershipEvidence && item.status === 200 && item.complete);
    if (!receipt) throw new Error('Current or hash-validated same-day ownership receipt required');
    validatePublicUrl(new URL('/', origin), this.allowedHosts);
    this.ownedOrigins.set(new URL(origin).origin, ownershipEvidence);
  }

  async reuseReceipt(metadataPath, expectedUrl) {
    const receipt = JSON.parse(await readFile(evidenceAbsolute(metadataPath), 'utf8'));
    const time = Date.parse(receipt.finished_at);
    const day = (value) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(value);
    if (receipt.metadata_path !== metadataPath || !this.relatedSourceIds.includes(receipt.source_id) ||
        (receipt.company_id && receipt.company_id !== this.companyId) || receipt.url !== String(expectedUrl) ||
        receipt.status !== 200 || !receipt.complete || receipt.error || receipt.method !== 'GET' ||
        !Number.isFinite(time) || time > Date.now() || Date.now() - time >= 86_400_000 || day(time) !== day(Date.now())) {
      throw new Error('Reusable receipt must be same-company, successful, same-day and <24h old');
    }
    validatePublicUrl(receipt.url, this.allowedHosts);
    const body = await readFile(evidenceAbsolute(receipt.body_path));
    if (body.length !== receipt.bytes || createHash('sha256').update(body).digest('hex') !== receipt.sha256 || challenge(body.toString('utf8'))) {
      throw new Error('Reusable receipt failed raw-body integrity check');
    }
    const reused = { ...receipt, reused_by_run_id: this.runId, reused_at: new Date().toISOString(),
      reuse_semantics: 'Original request time and body retained; no new HTTP request' };
    if (!this.reusedEvidence.some((item) => item.metadata_path === metadataPath)) this.reusedEvidence.push(reused);
    return { ...reused, text: body.toString('utf8') };
  }

  async registerPageScripts(dom, page) {
    if (![...this.evidence, ...this.reusedEvidence].some((item) => item.metadata_path === page.metadata_path && item.status === 200 && item.complete) ||
        !this.ownedOrigins.has(new URL(page.url).origin)) throw new Error('Verified public board required before script references');
    const sources = await dom.evaluate((html) => {
      const document = new DOMParser().parseFromString(html, 'text/html');
      return [...document.querySelectorAll('script[src]')].map((script) => script.getAttribute('src'));
    }, page.text);
    const references = [];
    for (const src of sources) {
      let url;
      try { url = validatePublicUrl(new URL(src, page.url), this.allowedHosts); } catch { continue; }
      if (!url.pathname.endsWith('.js')) continue;
      const reference = { kind: 'script_src', from_url: page.url, to_url: url.href, src_raw: src,
        metadata_path: page.metadata_path, body_path: page.body_path, sha256: page.sha256 };
      this.pageReferences.set(url.href, reference);
      this.approveOwnedOrigin(url.origin, page.metadata_path);
      references.push(reference);
    }
    return references;
  }

  async getScript(value) {
    const url = validatePublicUrl(value, this.allowedHosts).href;
    if (!this.pageReferences.has(url)) this.stop('SCRIPT_NOT_REFERENCED', 'Only current or validated same-day board script references may be read');
    return this.get(url, 'public_script');
  }

  stop(code, message, evidence = null) {
    this.stopped = new SourceStop(code, message, evidence);
    throw this.stopped;
  }

  async request(url, purpose, { method = 'GET', body = null, publicEndpointEvidence = null } = {}) {
    if (this.stopped) throw this.stopped;
    if (this.inFlight) throw new Error('Concurrent HTTP is forbidden');
    validatePublicUrl(url, this.allowedHosts);
    if (method !== 'GET' && (method !== 'POST' || !this.publicPostUrls.includes(String(url)) || !publicEndpointEvidence)) {
      throw new SourceStop('METHOD_NOT_APPROVED', 'Only GET and explicitly approved public list POST are permitted');
    }
    this.inFlight = true;
    try {
      const directory = join(this.rawDir, this.runId);
      await persist('raw_evidence_directory', () => mkdir(directory, { recursive: true }));
      const number = String(this.evidence.length + 1).padStart(3, '0');
      const metadataPath = join(directory, `${number}.response.json`);
      const bodyPath = join(directory, `${number}.body`);
      const startedAt = await this.lease.beforeRequest();
      const metadata = {
        run_id: this.runId, source_id: this.sourceId, company_id: this.companyId, sequence: this.evidence.length + 1,
        url: String(url), method, purpose, started_at: startedAt, finished_at: null,
        status: null, headers: {}, body_path: repoRelative(bodyPath), metadata_path: repoRelative(metadataPath),
        request_headers: { 'user-agent': USER_AGENT, 'accept-encoding': 'identity', ...(body ? { 'content-type': 'application/json' } : {}) },
        ...(body ? { request_body_path: repoRelative(join(directory, `${number}.request.json`)),
          request_body_sha256: createHash('sha256').update(body).digest('hex'), public_endpoint_evidence: publicEndpointEvidence } : {}),
        cookie_policy: 'never_sent; set-cookie response headers not retained',
        transport: 'node:https; DNS pinned public address; no proxy; no retries',
        ...(this.pageReferences.has(String(url)) ? { page_reference: this.pageReferences.get(String(url)), script_policy: 'read_only_never_executed' } : {}),
        complete: false, error: null,
      };
      const journal = join(this.dataDir, 'requests.jsonl');
      await persist('request_evidence', async () => {
        if (body) await writeFile(join(directory, `${number}.request.json`), body, { flag: 'wx' });
        await writeFile(metadataPath, JSON.stringify(metadata, null, 2) + '\n', { flag: 'wx' });
        await appendFile(journal, JSON.stringify({ event: 'request_started', ...metadata }) + '\n');
      });
      let response;
      try { response = await pinnedRequest(new URL(url), this.timeoutMs, this.maxBytes, { method, body }); }
      catch (error) { response = { status: null, headers: {}, body: Buffer.alloc(0), error: error.code ?? error.message }; }
      this.lease.afterRequest(this.crawlDelayMs);
      Object.assign(metadata, {
        finished_at: new Date().toISOString(), status: response.status, headers: response.headers,
        bytes: response.body.length, sha256: createHash('sha256').update(response.body).digest('hex'),
        complete: !response.error, error: response.error,
      });
      await persist('response_evidence', async () => {
        await writeFile(bodyPath, response.body, { flag: 'wx' });
        await writeFile(metadataPath, JSON.stringify(metadata, null, 2) + '\n');
        await appendFile(journal, JSON.stringify({ event: 'request_finished', ...metadata }) + '\n');
      });
      this.evidence.push(metadata);
      process.stderr.write(JSON.stringify({ event: 'http', ...metadata }) + '\n');
      if ([401, 403, 429].includes(response.status)) this.stop('HTTP_ACCESS_STOP', `HTTP ${response.status}; no retries`, metadata.metadata_path);
      if (response.error) this.stop('NETWORK_FAILED', response.error, metadata.metadata_path);
      if (response.headers['content-encoding'] && response.headers['content-encoding'] !== 'identity') {
        this.stop('UNSUPPORTED_ENCODING', 'Unexpected compressed response', metadata.metadata_path);
      }
      const text = response.body.toString('utf8');
      if (challenge(text)) this.stop('CHALLENGE_STOP', 'Challenge page detected; no retries', metadata.metadata_path);
      return { ...metadata, text };
    } finally { this.inFlight = false; }
  }

  async robots(url) {
    const origin = new URL(url).origin;
    if (!this.policies.has(origin)) {
      let robotUrl = new URL('/robots.txt', origin).href;
      let response;
      for (let redirects = 0; redirects <= 2; redirects++) {
        response = await this.request(robotUrl, 'robots');
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          if (redirects === 2 || !response.headers.location) this.stop('ROBOTS_REDIRECT_LIMIT', 'Invalid/bounded robots redirect', response.metadata_path);
          robotUrl = validatePublicUrl(new URL(response.headers.location, robotUrl), this.allowedHosts).href;
        } else break;
      }
      let policy;
      if (response.status === 404) {
        let approval = null;
        try { approval = JSON.parse(await readFile(join(ROOT, 'careers/config/access-policy.json'), 'utf8')); }
        catch (error) { if (error.code !== 'ENOENT') this.stop('ACCESS_POLICY_INVALID', error.message, response.metadata_path); }
        const absent = absentRobotsDecision(response, approval, { companyId: this.companyId,
          ownershipVerified: this.ownedOrigins.has(origin), requestUrl: String(url) });
        if (absent.allowed) {
          policy = absent;
          const decision = { ...absent, url: response.url, ownership_evidence: this.ownedOrigins.get(origin), evidence: response.metadata_path,
            policy_path: 'careers/config/access-policy.json', observed_at: new Date().toISOString() };
          await persist('robots_evidence', () => writeFile(join(this.rawDir, this.runId, `${String(response.sequence).padStart(3, '0')}.robots-decision.json`), JSON.stringify(decision, null, 2) + '\n'));
        }
      }
      if (!policy && response.status !== 200) this.stop('ROBOTS_UNKNOWN', `Robots HTTP ${response.status}; fail closed`, response.metadata_path);
      policy ??= parseRobots(response.text, response.headers['content-type'] ?? '');
      this.policies.set(origin, { policy, evidence: response.metadata_path });
    }
    const { policy, evidence } = this.policies.get(origin);
    const parsedUrl = new URL(url);
    const decision = policy.state === 'approved_absence'
      ? { ...policy, allowed: absentRobotsPathAllowed(policy, parsedUrl.href, {
        publicPostUrls: this.publicPostUrls, pageReferenced: this.pageReferences.has(parsedUrl.href) }),
      reason: 'Absent-robots approval is restricted to exact approved paths and page references' }
      : robotsDecision(policy, url);
    if (!decision.allowed) this.stop(decision.state === 'unknown' ? 'ROBOTS_UNKNOWN' : 'ROBOTS_DISALLOWED', decision.reason ?? 'Robots disallows URL', evidence);
    this.crawlDelayMs = Math.max(this.crawlDelayMs, decision.crawl_delay_ms ?? 0);
    // Apply newly discovered crawl-delay before the first non-robots request too.
    if (this.crawlDelayMs > 0) this.lease.afterRequest(this.crawlDelayMs);
    return { ...decision, evidence };
  }

  async get(value, purpose = 'page') {
    let url = validatePublicUrl(value, this.allowedHosts).href;
    const redirects = [];
    for (let count = 0; count <= 2; count++) {
      if ((purpose === 'public_script' || this.scriptHosts.includes(new URL(url).hostname)) && !this.pageReferences.has(url)) {
        this.stop('SCRIPT_NOT_REFERENCED', 'CDN request is not a verified board script reference');
      }
      await this.robots(url);
      const response = await this.request(url, purpose);
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        if (count === 2 || !response.headers.location) this.stop('REDIRECT_LIMIT', 'Invalid/bounded redirect', response.metadata_path);
        redirects.push(response.metadata_path);
        const next = validatePublicUrl(new URL(response.headers.location, url), this.allowedHosts).href;
        if (next === url) this.stop('REDIRECT_CYCLE', 'Redirect returned the same URL; no cookie/session workaround', response.metadata_path);
        url = next;
      } else {
        if (response.status !== 200) this.stop('HTTP_FAILED', `HTTP ${response.status}`, response.metadata_path);
        return { ...response, redirects };
      }
    }
    throw new Error('Unreachable redirect state');
  }

  async postJson(value, payload, publicEndpointEvidence) {
    const url = validatePublicUrl(value, this.allowedHosts).href;
    if (!this.publicPostUrls.includes(url) || !this.ownedOrigins.has(new URL(url).origin)) {
      this.stop('PUBLIC_POST_NOT_APPROVED', 'Public POST needs an approved endpoint and current ownership chain');
    }
    if (!publicEndpointEvidence?.board_metadata_path || ![...this.evidence, ...this.reusedEvidence].some((item) => item.metadata_path === publicEndpointEvidence.board_metadata_path && item.status === 200)) {
      this.stop('PUBLIC_POST_NO_PAGE_PROOF', 'Public POST needs a successfully read current board');
    }
    await this.robots(url);
    const body = JSON.stringify(payload);
    if (body.length > 16_384) throw new Error('Public job-list request too large');
    const response = await this.request(url, 'public_job_list', { method: 'POST', body, publicEndpointEvidence });
    if (response.status !== 200) this.stop('HTTP_FAILED', `HTTP ${response.status}; POST is never redirected/retried`, response.metadata_path);
    return response;
  }
}
