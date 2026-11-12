import { chromium } from 'playwright';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT, RAW_DIR, DATA_DIR, repoRelative } from '../paths.mjs';
import { isPublicAddress, SourceStop } from '../http.mjs';

const digest = (body) => createHash('sha256').update(body).digest('hex');
const publicJobPath = (url) => /^\/api\/v1\/(?:search\/job\/posts\/?|job\/posts\/[\w-]+\/?)$/.test(new URL(url).pathname);

export function browserLogUrl(value) {
  const url = new URL(value);
  for (const key of [...url.searchParams.keys()]) {
    if (/token|signature|credential|password|cookie|csrf|session|authorization/i.test(key)) url.searchParams.set(key, '[redacted]');
  }
  return url.href;
}

function diagnostic(error) {
  return String(error.message ?? error).replace(/https:\/\/[^\s"'<>]+/g, (url) => {
    try { return browserLogUrl(url); } catch { return '[unparseable URL]'; }
  });
}

export function browserAccessGate(text) {
  if (typeof text !== 'string') return false;
  // Completing model validation in a JD is not an instruction to pass an access gate.
  return /请先登录|登录后(?:才可|才能|查看)|请(?:先)?(?:完成|通过)(?:以下)?(?:安全|人机|身份)?验证|请(?:输入|填写)(?:图形|图片|短信|手机)?验证码|拖动.*滑块|人机验证|安全验证|访问过于频繁|verify (?:that )?you are (?:a )?human|(?:complete|solve|enter)(?: the)? captcha|sign in to (?:view|continue)/i.test(text);
}

export async function openPublicBrowser({ company, http }) {
  const policy = JSON.parse(await readFile(join(ROOT, 'careers/config/browser-policy.json'), 'utf8'));
  const origin = new URL(company.board_url).origin;
  if (!policy.enabled || !policy.company_ids.includes(company.company_id) || !policy.origins.includes(origin) ||
      !policy.ephemeral_context_only || policy.max_contexts !== 1 || !policy.shared_collection_lease ||
      policy.fallback_refresh_retries !== 0 || !http.ownedOrigins.has(origin)) {
    throw new Error('PUBLIC_BROWSER_NOT_APPROVED_OR_OWNED');
  }
  await http.robots(company.board_url);
  const directory = join(RAW_DIR, http.runId);
  await mkdir(directory, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', chromiumSandbox: true, headless: true });
  let context;
  let page;
  try {
    context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, serviceWorkers: 'block', acceptDownloads: false });
    page = await context.newPage();
  } catch (error) { await browser.close(); throw error; }
  page.setDefaultTimeout(15_000);
  page.setDefaultNavigationTimeout(30_000);
  const responses = [];
  const pending = new Set();
  const publicWaiters = new Set();
  const requestTimers = new Map();
  const publicHosts = new Map();
  let stopped = null;
  let action = null;
  let resources = 0;
  let navigationCount = 0;
  let entryNavigated = false;
  let closed = false;
  let performing = false;
  let journal = Promise.resolve();
  const log = (file, value) => { journal = journal.then(() => appendFile(file, JSON.stringify(value) + '\n',
    { flush: file === join(DATA_DIR, 'browser-actions.jsonl') })); return journal; };
  const stop = (code, message, evidence = null) => {
    stopped ??= new SourceStop(code, message, evidence);
    for (const waiter of publicWaiters) waiter.reject(stopped);
    void context.setOffline(true).catch(() => {});
    return stopped;
  };
  const check = () => { if (stopped) throw stopped; };
  const resourceLog = join(directory, 'browser-network.jsonl');
  await context.route('**/*', async (route) => {
    const request = route.request();
    try {
      if (stopped) return route.abort();
      const url = new URL(request.url());
      if (['data:', 'blob:'].includes(url.protocol)) return route.continue();
      if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || isIP(url.hostname)) {
        throw stop('BROWSER_URL_NOT_PUBLIC', 'Browser resource is not a public HTTPS hostname');
      }
      if (!publicHosts.has(url.hostname)) {
        let timer;
        publicHosts.set(url.hostname, Promise.race([lookup(url.hostname, { all: true }), new Promise((_, reject) => {
          timer = setTimeout(() => reject(stop('BROWSER_DNS_TIMEOUT', 'Browser DNS check exceeded 30 seconds')), 30_000);
        })]).then((entries) => entries.length > 0 && entries.every((entry) => isPublicAddress(entry.address)))
          .finally(() => clearTimeout(timer)));
      }
      if (!await publicHosts.get(url.hostname)) throw stop('BROWSER_PRIVATE_DNS', 'Browser resource DNS is not public');
      if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
        if (url.origin !== origin || !policy.origins.includes(url.origin) ||
            /\/(?:login|signin|passport|captcha|security_check)(?:\/|$)/i.test(url.pathname)) {
          throw stop('BROWSER_LOGIN_OR_UNAPPROVED_NAVIGATION', 'Navigation left the approved public board');
        }
        if (++navigationCount > 3) throw stop('BROWSER_REDIRECT_LIMIT', 'Bounded public navigation exceeded');
      }
      await route.continue();
    } catch (error) {
      stop(error.code ?? 'BROWSER_RESOURCE_FAILED', diagnostic(error));
      await route.abort().catch(() => {});
    }
  });
  page.on('popup', (popup) => { stop('BROWSER_NEW_CONTEXT_FORBIDDEN', 'Public reader permits one page only'); void popup.close(); });
  page.on('download', (download) => { stop('BROWSER_DOWNLOAD_FORBIDDEN', 'No downloads or application actions'); void download.cancel(); });
  page.on('request', (request) => {
    if (closed) return;
    requestTimers.set(request, setTimeout(() => {
      if (!closed) stop('BROWSER_RESOURCE_TIMEOUT', 'Browser-managed request exceeded 30 seconds', repoRelative(resourceLog));
    }, 30_000));
  });
  const finishRequest = (request) => { clearTimeout(requestTimers.get(request)); requestTimers.delete(request); };
  page.on('requestfinished', finishRequest);
  page.on('requestfailed', finishRequest);
  page.on('response', (response) => {
    const task = (async () => {
      const request = response.request();
      const url = browserLogUrl(response.url());
      const navigation = request.isNavigationRequest() && request.frame() === page.mainFrame();
      const metadata = { event: navigation ? 'active_navigation_response' : 'automatic_resource_response', transport: 'browser_rendered', resource_sequence: ++resources,
        url, method: request.method(), status: response.status(), resource_type: request.resourceType(),
        observed_at: new Date().toISOString(), active_action: action?.id ?? null,
        pacing_semantics: navigation ? 'Response within the paced active navigation; redirects belong to the same action'
          : 'Browser-managed subresource; not an independently paced collector request',
        headers_policy: 'No request/response credentials or cookie headers recorded' };
      if ([401, 403, 429].includes(response.status())) stop('BROWSER_HTTP_ACCESS_STOP', `Browser HTTP ${response.status()}; no refresh/retry`, repoRelative(resourceLog));
      await log(resourceLog, metadata);
      if (response.status() === 200 && new URL(response.url()).origin === origin && publicJobPath(response.url())) {
        let timer;
        const body = await Promise.race([response.body(), new Promise((_, reject) => {
          timer = setTimeout(() => reject(stop('BROWSER_RESPONSE_TIMEOUT', 'Public response exceeded 30 seconds')), 30_000);
        })]).finally(() => clearTimeout(timer));
        if (body.length > 4 * 1024 * 1024) throw stop('BROWSER_PUBLIC_RESPONSE_SIZE', 'Public response exceeds 4 MB');
        const parsed = JSON.parse(body.toString('utf8'));
        if (parsed.code !== 0 || (!Array.isArray(parsed.data?.job_post_list) && !parsed.data?.job_post_detail)) return;
        const stem = `browser-public-${String(metadata.resource_sequence).padStart(3, '0')}`;
        const bodyPath = join(directory, `${stem}.body`);
        const metadataPath = join(directory, `${stem}.response.json`);
        const receipt = { ...metadata, run_id: http.runId, source_id: company.source_id, company_id: company.company_id,
          body_path: repoRelative(bodyPath), metadata_path: repoRelative(metadataPath), bytes: body.length, sha256: digest(body),
          started_at: metadata.observed_at, finished_at: new Date().toISOString(), complete: true,
          time_semantics: 'started_at is response-header observation, finished_at is body capture; not an active request start',
          response_semantics: 'Actual public JSON response automatically requested by the unmodified public website',
          request_body_policy: 'Not recorded; site-managed request, no emulated signing or CSRF logic' };
        await writeFile(bodyPath, body, { flag: 'wx' });
        await writeFile(metadataPath, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
        responses.push({ ...receipt, text: body.toString('utf8'), data: parsed });
        for (const waiter of publicWaiters) waiter.check();
      }
    })().catch((error) => { stop(error.code ?? 'BROWSER_EVIDENCE_FAILED', diagnostic(error)); });
    pending.add(task);
    void task.finally(() => pending.delete(task));
  });
  async function inspectAccess() {
    check();
    const text = await page.locator('body').innerText({ timeout: 5000 });
    if (browserAccessGate(text)) {
      throw stop('BROWSER_CHALLENGE_OR_LOGIN', 'Visible public UI requires verification or login');
    }
    check();
  }
  async function withAccessChecks(callback) {
    await inspectAccess();
    let finished = false;
    let timer;
    const monitor = new Promise((_, reject) => {
      const poll = async () => {
        if (finished) return;
        try { await inspectAccess(); }
        catch (error) { if (!finished) reject(error); return; }
        if (!finished) timer = setTimeout(poll, 250);
      };
      timer = setTimeout(poll, 250);
    });
    try {
      const result = await Promise.race([Promise.resolve().then(callback), monitor]);
      await inspectAccess();
      return result;
    } catch (error) {
      // Inspect before classifying a readiness timeout; a timeout alone is not a challenge.
      if (!stopped) {
        try { await inspectAccess(); } catch { /* Keep the original error unless a real gate stopped the source. */ }
      }
      throw stopped ?? error;
    } finally { finished = true; clearTimeout(timer); }
  }
  async function capture(label, startedAt, status = null) {
    await Promise.all([...pending]);
    const sequence = http.evidence.length + 1;
    const stem = `browser-${String(sequence).padStart(3, '0')}`;
    const bodyPath = join(directory, `${stem}.dom.html`);
    const screenshotPath = join(directory, `${stem}.png`);
    const metadataPath = join(directory, `${stem}.response.json`);
    const html = await page.content();
    await writeFile(bodyPath, html, { flag: 'wx' });
    await page.screenshot({ path: screenshotPath, fullPage: true, timeout: 10_000 });
    const screenshot = await readFile(screenshotPath);
    const receipt = { sequence, run_id: http.runId, source_id: company.source_id, company_id: company.company_id,
      url: browserLogUrl(page.url()), method: label === 'entry_navigation' ? 'BROWSER_NAVIGATE' : 'BROWSER_ACTION',
      purpose: label, status, started_at: startedAt, finished_at: new Date().toISOString(), transport: 'browser_rendered',
      body_type: 'rendered_DOM_snapshot_not_raw_HTTP', body_path: repoRelative(bodyPath), metadata_path: repoRelative(metadataPath),
      screenshot_path: repoRelative(screenshotPath), sha256: digest(html), bytes: Buffer.byteLength(html), complete: !stopped,
      screenshot_sha256: digest(screenshot), screenshot_bytes: screenshot.length,
      browser_policy: policy.version, cookie_policy: policy.cookie_policy, automatic_resources_path: repoRelative(resourceLog),
      active_action: action?.id ?? null, error: stopped ? { code: stopped.code, message: stopped.message } : null };
    await writeFile(metadataPath, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
    http.evidence.push(receipt);
    await log(join(DATA_DIR, 'browser-actions.jsonl'), { event: 'browser-action-finished', ...receipt });
    return { ...receipt, text: html };
  }
  const api = {
    page, responses, policy,
    get stopped() { return stopped; },
    async perform(label, callback) {
      check();
      if (performing) throw new Error('Concurrent browser actions forbidden');
      performing = true;
      let startedAt;
      let result;
      let status = null;
      try {
        startedAt = await http.lease.beforeRequest();
        action = { id: `${http.runId}:action-${http.evidence.length + 1}`, label };
        await log(join(DATA_DIR, 'browser-actions.jsonl'), { event: 'browser-action-started', run_id: http.runId,
          source_id: company.source_id, company_id: company.company_id, active_action: action.id,
          started_at: startedAt, purpose: label, url: page.url() === 'about:blank' ? company.board_url : browserLogUrl(page.url()),
          transport: 'browser_rendered', callback_started: false });
        navigationCount = 0;
        check();
        result = await callback(page);
        status = result?.status?.() ?? null;
        await page.waitForLoadState('domcontentloaded', { timeout: 15_000 });
        await inspectAccess();
        return await capture(label, startedAt, status);
      } catch (error) {
        stop(error.code ?? 'BROWSER_ACTION_FAILED', diagnostic(error));
        if (action) {
          try { await capture(label, startedAt, status); } catch { /* The durable start remains if capture fails. */ }
        }
        throw stopped;
      } finally {
        try { if (startedAt) http.lease.afterRequest(http.crawlDelayMs); }
        finally { action = null; performing = false; }
      }
    },
    async navigate({ ready = null } = {}) {
      if (entryNavigated) throw new Error('Public browser entry may only be navigated once');
      entryNavigated = true;
      return api.perform('entry_navigation', async () => {
        const response = await page.goto(company.board_url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        await page.locator('body').waitFor({ state: 'visible' });
        await withAccessChecks(async () => {
          await page.waitForFunction(() => document.body.innerText.trim().length > 20, null, { timeout: 15_000 });
          if (ready) await ready(page);
        });
        return response;
      });
    },
    async waitForPublicList(query, { after = 0, timeoutMs = 30_000 } = {}) {
      check();
      if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000) throw new Error('Public response wait must be <=30s');
      try {
        return await withAccessChecks(() => new Promise((resolve, reject) => {
          let timer;
          const cleanup = () => { clearTimeout(timer); publicWaiters.delete(waiter); };
          const waiter = { reject(error) { cleanup(); reject(error); }, check() {
            const found = responses.slice(after).find((response) => new URL(response.url).searchParams.get('keyword') === query);
            if (found) { cleanup(); resolve(found); }
          } };
          publicWaiters.add(waiter);
          timer = setTimeout(() => waiter.reject(new SourceStop('BROWSER_PUBLIC_LIST_TIMEOUT', 'Public UI did not supply a job list within 30 seconds')), timeoutMs);
          waiter.check();
        }));
      } catch (error) { throw stop(error.code ?? 'BROWSER_PUBLIC_LIST_FAILED', diagnostic(error), error.evidence ?? null); }
    },
    async checkAccess() { await inspectAccess(); },
    async close() {
      if (closed) return;
      closed = true;
      for (const waiter of publicWaiters) waiter.reject(new Error('Public reader closed'));
      for (const timer of requestTimers.values()) clearTimeout(timer);
      requestTimers.clear();
      await context.setOffline(true).catch(() => {});
      await browser.close();
      await Promise.all([...pending]);
      await journal;
    },
  };
  return api;
}
