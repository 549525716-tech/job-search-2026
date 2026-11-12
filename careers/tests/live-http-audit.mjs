import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const dataRoot = resolve(root, '01_行情收集/official-careers');
const journal = resolve(dataRoot, 'requests.jsonl');
if (!existsSync(journal)) {
  console.error('No real HTTP journal. Offline tests are not live evidence.');
  process.exit(1);
}

const records = readFileSync(journal, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
const starts = records.filter((row) => row.event === 'request_started');
const finishes = records.filter((row) => row.event === 'request_finished');
const issues = [];
const finishedById = new Map(finishes.map((r) => [`${r.run_id}:${r.sequence}`, r]));
for (let i = 1; i < starts.length; i++) {
  const delta = Date.parse(starts[i].started_at) - Date.parse(starts[i - 1].started_at);
  if (delta < 10000) issues.push(`Requests less than 10 seconds apart: ${delta}ms, ${starts[i].url}`);
  const previous = finishedById.get(`${starts[i - 1].run_id}:${starts[i - 1].sequence}`);
  if (previous && Date.parse(starts[i].started_at) - Date.parse(previous.finished_at) < 10000) {
    issues.push(`Requests overlapped or post-response cooldown too short: ${starts[i].url}`);
  }
}
for (const row of finishes) {
  const body = resolve(root, row.body_path);
  if (!body.startsWith(dataRoot + sep)) {
    issues.push(`Evidence escaped data root: ${row.body_path}`);
    continue;
  }
  if (!existsSync(body)) {
    issues.push(`Missing raw response: ${row.body_path}`);
    continue;
  }
  const bytes = readFileSync(body);
  if (bytes.length !== row.bytes) issues.push(`Byte count mismatch: ${row.body_path}`);
  if (createHash('sha256').update(bytes).digest('hex') !== row.sha256) issues.push(`Raw SHA256 mismatch: ${row.body_path}`);
  if (Object.keys(row.request_headers ?? {}).some((key) => /cookie|authorization/i.test(key))) {
    issues.push(`Credential header in request record: ${row.url}`);
  }
  const receiptPath = resolve(root, row.metadata_path);
  if (!receiptPath.startsWith(dataRoot + sep) || !existsSync(receiptPath)) {
    issues.push(`Missing or invalid HTTP receipt: ${row.metadata_path}`);
  } else {
    const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
    if (['run_id', 'sequence', 'url', 'method', 'status', 'sha256', 'body_path', 'started_at', 'finished_at'].some((key) => receipt[key] !== row[key])) {
      issues.push(`HTTP receipt differs from journal: ${row.metadata_path}`);
    }
  }
  if (row.method === 'POST') {
    const requestPath = row.request_body_path && resolve(root, row.request_body_path);
    if (!requestPath?.startsWith(dataRoot + sep) || !existsSync(requestPath)
      || !row.public_endpoint_evidence
      || createHash('sha256').update(readFileSync(requestPath)).digest('hex') !== row.request_body_sha256) {
      issues.push(`Missing public-list POST contract or request hash: ${row.url}`);
    }
  } else if (row.method !== 'GET') issues.push(`Unexpected method: ${row.method}`);
}
const finishedIds = new Set(finishes.map((r) => `${r.run_id}:${r.sequence}`));
const unfinished = starts.filter((r) => !finishedIds.has(`${r.run_id}:${r.sequence}`));
const browserJournal = resolve(dataRoot, 'browser-actions.jsonl');
const browserRows = existsSync(browserJournal) ? readFileSync(browserJournal, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line)) : [];
const browserStarts = browserRows.filter((row) => row.event === 'browser-action-started');
const browserFinishRows = browserRows.filter((row) => row.event === 'browser-action-finished' || (!row.event && row.body_type === 'rendered_DOM_snapshot_not_raw_HTTP'));
const browserByAction = new Map();
for (const row of browserFinishRows) {
  const prior = browserByAction.get(row.active_action);
  if (prior && ['started_at', 'finished_at', 'metadata_path', 'body_path', 'sha256', 'status'].some((key) => prior[key] !== row[key])) {
    issues.push(`Conflicting browser action receipts: ${row.active_action}`);
  }
  browserByAction.set(row.active_action, row);
}
const browserFinishes = [...browserByAction.values()];
const unfinishedBrowser = browserStarts.filter((row) => !browserFinishes.some((finish) => finish.active_action === row.active_action));
const legacyScreenshotsWithoutCaptureHash = [];
for (const row of browserFinishes) {
  const path = resolve(root, row.body_path);
  if (!path.startsWith(dataRoot + sep) || !existsSync(path)) { issues.push(`Missing browser DOM: ${row.body_path}`); continue; }
  const bytes = readFileSync(path);
  if (bytes.length !== row.bytes || createHash('sha256').update(bytes).digest('hex') !== row.sha256) issues.push(`Browser DOM hash mismatch: ${row.body_path}`);
  const metadata = resolve(root, row.metadata_path);
  if (!metadata.startsWith(dataRoot + sep) || !existsSync(metadata)) issues.push(`Missing browser receipt: ${row.metadata_path}`);
  else if (JSON.parse(readFileSync(metadata, 'utf8')).sha256 !== row.sha256) issues.push(`Browser receipt hash mismatch: ${row.metadata_path}`);
  const screenshot = row.screenshot_path && resolve(root, row.screenshot_path);
  if (!screenshot?.startsWith(dataRoot + sep) || !existsSync(screenshot)) issues.push(`Missing browser screenshot: ${row.metadata_path}`);
  else if (!row.screenshot_sha256) legacyScreenshotsWithoutCaptureHash.push(row.screenshot_path);
  else if (createHash('sha256').update(readFileSync(screenshot)).digest('hex') !== row.screenshot_sha256) issues.push(`Browser screenshot hash mismatch: ${row.screenshot_path}`);
}
let browserPublicResponses = 0;
for (const runId of new Set(browserFinishes.map((row) => row.run_id))) {
  const directory = resolve(dataRoot, 'raw', runId);
  if (!directory.startsWith(resolve(dataRoot, 'raw') + sep)) { issues.push(`Invalid browser run directory: ${runId}`); continue; }
  for (const file of readdirSync(directory).filter((name) => /^browser-public-\d+\.response\.json$/.test(name))) {
    const receipt = JSON.parse(readFileSync(resolve(directory, file), 'utf8'));
    const body = resolve(root, receipt.body_path);
    if (!body.startsWith(directory + sep) || !existsSync(body)) { issues.push(`Missing public browser response: ${file}`); continue; }
    const bytes = readFileSync(body);
    if (bytes.length !== receipt.bytes || createHash('sha256').update(bytes).digest('hex') !== receipt.sha256) issues.push(`Public browser response hash mismatch: ${file}`);
    if (receipt.run_id !== runId || receipt.transport !== 'browser_rendered') issues.push(`Public browser attribution mismatch: ${file}`);
    browserPublicResponses += 1;
  }
}
const activeTimeline = [...finishes, ...browserFinishes].sort((a, b) => Date.parse(a.started_at) - Date.parse(b.started_at));
for (let i = 1; i < activeTimeline.length; i++) {
  if (Date.parse(activeTimeline[i].started_at) - Date.parse(activeTimeline[i - 1].finished_at) < 10000) {
    issues.push(`Shared HTTP/browser cooldown violated: ${activeTimeline[i].url}`);
  }
}
const result = {
  checked_at: new Date().toISOString(),
  scope: 'Real HTTP/browser receipts, DOM, screenshots, public-response hashes and shared active-action pacing; not a semantic JD or hiring-status audit',
  request_starts: starts.length,
  request_finishes: finishes.length,
  browser_active_actions: browserFinishes.length,
  browser_public_responses: browserPublicResponses,
  legacy_screenshots_without_capture_hash: legacyScreenshotsWithoutCaptureHash,
  minimum_shared_cooldown_ms: activeTimeline.length > 1 ? Math.min(...activeTimeline.slice(1).map((row, index) => Date.parse(row.started_at) - Date.parse(activeTimeline[index].finished_at))) : null,
  browser_duplicate_finish_records: browserFinishRows.length - browserFinishes.length,
  browser_legacy_finish_only_actions: browserFinishes.filter((row) => !browserStarts.some((start) => start.active_action === row.active_action)).length,
  browser_action_starts: browserStarts.length,
  unfinished_browser_actions: unfinishedBrowser.map((row) => ({ run_id: row.run_id, action: row.active_action })),
  browser_subresource_semantics: 'Automatic browser assets are not collector-initiated requests; their per-run browser-network.jsonl is retained separately',
  unfinished_requests: unfinished.map((r) => ({ run_id: r.run_id, url: r.url })),
  http_status_counts: Object.fromEntries([...new Set(finishes.map((r) => String(r.status)))].map((status) => [status, finishes.filter((r) => String(r.status) === status).length])),
  issues,
  passed: issues.length === 0 && finishes.length > 0 && unfinished.length === 0 && unfinishedBrowser.length === 0,
};
console.log(JSON.stringify(result, null, 2));
mkdirSync(resolve(dataRoot, 'reports/qa'), { recursive: true });
writeFileSync(resolve(dataRoot, 'reports/qa/http-audit.json'), JSON.stringify(result, null, 2) + '\n');
if (!result.passed) process.exitCode = 1;
