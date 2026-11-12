import { readFile, writeFile, realpath, readdir } from 'node:fs/promises';
import { resolve, join, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { pathToFileURL } from 'node:url';
import { ROOT, DATA_DIR, repoRelative } from './paths.mjs';
import { captureMatchesAdmission, validateWebAdmission } from './capture-contract.mjs';
import { classifyBrowserCapture } from './browser-admission.mjs';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const time = (value) => typeof value === 'string' ? Date.parse(value) : NaN;

export function captureTimes(capture) {
  for (const [legacy, explicit] of [['started_at', 'tool_started_at'], ['observed_at', 'tool_finished_at']]) {
    if (capture[legacy] != null && capture[explicit] != null && time(capture[legacy]) !== time(capture[explicit])) {
      throw new Error('conflicting actual capture timestamps');
    }
  }
  return { started_at: capture.started_at ?? capture.tool_started_at,
    observed_at: capture.observed_at ?? capture.tool_finished_at };
}

export async function auditWebSession(directory) {
  const dir = await realpath(directory);
  const rawDir = await realpath(join(dir, 'raw'));
  const events = (await readFile(join(dir, 'web-session.jsonl'), 'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse);
  const issues = [], warnings = [], calls = [], seen = new Set();
  let active = null, previousFinish = null;
  for (const event of events) {
    if (event.event === 'begin') {
      if (active) issues.push(`${event.id}: overlapping admitted capture`);
      if (seen.has(event.id)) issues.push(`${event.id}: reused capture id`);
      seen.add(event.id);
      const gap = previousFinish === null ? null : time(event.queue_admitted_at) - previousFinish;
      if (gap !== null && (!Number.isFinite(gap) || gap < 9990)) issues.push(`${event.id}: cooldown below 10 seconds`);
      active = { ...event, gap_ms: gap };
      continue;
    }
    if (event.event === 'interrupted') {
      issues.push(`${event.id}: interrupted capture`);
      if (active?.id === event.id) { active = null; previousFinish = time(event.recorded_at); }
      continue;
    }
    if (event.event !== 'finish') { issues.push(`${event.id}: unknown event`); continue; }
    if (!active || event.id !== active.id || !isDeepStrictEqual(event.request, active.request)) {
      issues.push(`${event.id}: finish without matching admission`);
      continue;
    }
    try {
      const file = await realpath(resolve(ROOT, event.evidence_file));
      if (!file.startsWith(rawDir + sep)) throw new Error('evidence outside raw directory');
      const bytes = await readFile(file), capture = JSON.parse(bytes);
      if (hash(bytes) !== event.evidence_sha256) throw new Error('evidence SHA256 mismatch');
      if (!captureMatchesAdmission(capture, active)) throw new Error('raw capture contract mismatch');
      let outcome = 'web_tool_result_recorded';
      if (capture.kind === 'web_tool_result_not_raw_http') {
        validateWebAdmission(capture);
      } else {
        outcome = classifyBrowserCapture(capture);
        if (['unverified_legacy_capture', 'unverified_capture'].includes(outcome)) throw new Error('browser capture lacks explicit top-level URL and structured result');
        warnings.push(`${event.id}: browser outcome ${outcome}; not proof of login stability or complete JD`);
      }
      const actual = captureTimes(capture);
      const admitted = time(active.queue_admitted_at), started = time(actual.started_at), observed = time(actual.observed_at), persisted = time(event.persisted_at);
      if (![admitted, started, observed, persisted].every(Number.isFinite)
          || started < admitted - 1000 || observed < started || persisted < observed - 1000) throw new Error('missing or inconsistent actual capture timestamps');
      if (!capture.execution?.agent_id || capture.execution.agent_id === 'current-codex') warnings.push(`${event.id}: agent identity relies on controller dispatch receipt`);
      calls.push({ id: event.id, kind: capture.kind, outcome, operation: capture.operation, route: active.route, company: active.company,
        cooldown_ms: active.gap_ms, started_at: actual.started_at, observed_at: actual.observed_at,
        evidence_file: event.evidence_file, evidence_sha256: event.evidence_sha256 });
    } catch (error) { issues.push(`${event.id}: ${error.message}`); }
    previousFinish = time(event.persisted_at);
    active = null;
  }
  if (active) issues.push(`${active.id}: admitted capture is not finished`);
  const rawNames = (await readdir(rawDir)).filter((name) => name.endsWith('.json'));
  for (const name of rawNames) if (!seen.has(name.slice(0, -5))) issues.push(`${name}: raw capture missing ledger admission`);
  const gaps = calls.map((call) => call.cooldown_ms).filter(Number.isFinite);
  return { schema_version: 1, audited_at: new Date().toISOString(), status: issues.length ? 'failed' : 'passed_for_recorded_calls',
    scope: 'Checks recorded evidence and admission timing only. Blank/error/diagnostic outcomes are not successful collection. No proof of login stability, complete JD, HTTP freshness or unrecorded activity.',
    calls: calls.length, searches: calls.filter((call) => call.operation === 'search').length, opens: calls.filter((call) => call.operation === 'open').length, clicks: calls.filter((call) => call.operation === 'click').length,
    routes: [...new Set(calls.map((call) => call.route))], minimum_cooldown_ms: gaps.length ? Math.min(...gaps) : null,
    issues, warnings, receipts: calls };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const directory = resolve(ROOT, process.argv[2] ?? '');
  const parent = await realpath(join(DATA_DIR, 'research'));
  if (!(await realpath(directory)).startsWith(parent + sep)) throw new Error('RESEARCH_CHILD_DIRECTORY_REQUIRED');
  const result = await auditWebSession(directory);
  const file = join(directory, 'timing-audit.json');
  await writeFile(file, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ ...result, receipts: undefined, file: repoRelative(file) }));
  if (result.issues.length) process.exitCode = 1;
}
