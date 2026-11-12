import { randomUUID } from 'node:crypto';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { collect } from './collector.mjs';
import { companies } from './registry.mjs';
import { REPORT_DIR } from './paths.mjs';

// These are the exact lock errors currently emitted by lock.mjs.
const GLOBAL_FAILURE_CODES = new Set(['COLLECTION_QUEUE_TIMEOUT', 'COLLECTION_LOCK_LOST']);
const GLOBAL_FAILURE_MESSAGES = new Set([...GLOBAL_FAILURE_CODES, 'Concurrent requests are forbidden']);
const PERSISTENCE_FAILURE_CODES = new Set(['EACCES', 'EIO', 'ENOSPC', 'ENOTDIR', 'EPERM', 'ERR_SQLITE_ERROR']);
const TERMINAL_SOURCE_STATUSES = new Set(['success', 'empty', 'partial', 'failed', 'stopped', 'blocked', 'interrupted']);
const quarantinedBacklog = [
  'BOSS browser automation quarantined, no webpage reads.',
  'Liepin browser automation quarantined, no webpage reads.',
];

function errorRecord(error, fallback = 'COLLECTION_FAILED') {
  return { code: error?.code ?? fallback, message: String(error?.message ?? error),
    ...(error?.failure_scope ? { failure_scope: error.failure_scope, persistence_stage: error.persistence_stage, cause_code: error.cause_code } : {}) };
}

function isGlobalFailure(error) {
  const code = String(error?.code ?? '');
  const message = String(error?.message ?? '');
  return GLOBAL_FAILURE_CODES.has(code) || GLOBAL_FAILURE_MESSAGES.has(message)
    || error?.failure_scope === 'persistence' || code === 'COLLECTION_PERSISTENCE_FAILED'
    || (typeof error?.syscall === 'string' && typeof error?.path === 'string')
    || PERSISTENCE_FAILURE_CODES.has(code) || code.startsWith('SQLITE_');
}

function sourceResult(companyId) {
  return { company_id: companyId, run_id: null, status: 'pending', complete: false, jobs: 0,
    errors: [], started_at: null, finished_at: null, report_paths: {} };
}

function normalizeCollected(companyId, result, now) {
  const run = result?.runs?.[0] ?? result?.run ?? result;
  if (!run || typeof run !== 'object' || !TERMINAL_SOURCE_STATUSES.has(run.status)) {
    throw Object.assign(new Error('Collector returned no terminal run'), { code: 'COLLECTOR_RESULT_INVALID' });
  }
  const jobs = Array.isArray(run.jobs) ? run.jobs.length : 0;
  if (['success', 'empty'].includes(run.status) && run.complete !== true) {
    throw Object.assign(new Error('Successful collector result must be complete'), { code: 'COLLECTOR_RESULT_INVALID' });
  }
  if (run.status === 'empty' && jobs !== 0) {
    throw Object.assign(new Error('Empty collector result cannot contain jobs'), { code: 'COLLECTOR_RESULT_INVALID' });
  }
  return { company_id: companyId, run_id: run.run_id ?? null, status: run.status, complete: run.complete === true,
    jobs, errors: Array.isArray(run.errors) ? run.errors : [], started_at: run.started_at ?? now,
    finished_at: run.finished_at ?? now, report_paths: run.artifacts ?? {} };
}

function renderSummary(run) {
  const lines = [
    '# Bounded Fallback Collection', '',
    `Fallback run: ${run.fallback_run_id}`, '',
    `Started: ${run.started_at}`, `Finished: ${run.finished_at ?? 'pending'}`, `Status: **${run.status}**`, '',
    'This is a bounded independent-source fallback. It is not a full-market completion claim and does not repair or validate any login.', '',
    '## Sources', '', '| Company | Status | Complete | Jobs | Run ID |', '| --- | --- | --- | --- | --- |',
    ...run.sources.map((source) => `| ${source.company_id} | ${source.status} | ${source.complete} | ${source.jobs} | ${source.run_id ?? 'not started'} |`), '',
    '## Backlog', '', ...quarantinedBacklog.map((item) => `- ${item}`), '',
    'Failed, blocked, skipped, and not-scanned sources are not evidence of an empty board or a closed role.', '',
  ];
  return lines.join('\n');
}

async function atomicWrite(path, content) {
  await mkdir(resolve(path, '..'), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, content, { flag: 'wx' });
  await rename(temporary, path);
}

async function checkpoint(run, directory) {
  const jsonPath = join(directory, 'run.json');
  const summaryPath = join(directory, 'summary.md');
  run.artifacts = { run_json: jsonPath, summary_markdown: summaryPath };
  for (const source of run.sources) {
    source.report_paths = { ...source.report_paths, fallback_run_json: jsonPath, fallback_summary_markdown: summaryPath };
  }
  await atomicWrite(jsonPath, JSON.stringify(run, null, 2) + '\n');
  await atomicWrite(summaryPath, renderSummary(run));
}

function terminate(run, sources, index, now, error = null) {
  const entry = sources[index];
  if (error) entry.errors.push(errorRecord(error));
  entry.status = 'terminated';
  entry.complete = false;
  entry.finished_at = now();
  for (const pending of sources.slice(index + 1)) {
    pending.errors.push({ code: 'FALLBACK_TERMINATED', message: 'Not started after collection-wide failure; safe manual resume required' });
  }
  run.status = 'terminated';
  run.finished_at = now();
}

/**
 * Runs an explicit, serial list of independently admitted official collectors.
 * It intentionally has no browser, halt-clearing, retry, or queue-management behavior.
 */
export async function runFallback({ companyIds, collectFn = collect, outputDir = REPORT_DIR, now = () => new Date().toISOString() } = {}) {
  if (!Array.isArray(companyIds) || companyIds.length === 0) throw new Error('companyIds must be a non-empty explicit list');
  if (typeof collectFn !== 'function') throw new Error('collectFn must be a function');
  if (typeof now !== 'function') throw new Error('now must be a function');

  const ids = [...new Set(companyIds)];
  if (ids.some((id) => typeof id !== 'string' || !id.trim())) throw new Error('companyIds must contain non-empty strings');
  const directory = join(resolve(outputDir), 'fallback-runs', `fallback-${randomUUID()}`);
  const sources = ids.map(sourceResult);
  const run = { schema_version: 1, fallback_run_id: directory.split('/').at(-1), started_at: now(), finished_at: null,
    status: 'running', complete: false, sources, backlog: quarantinedBacklog, artifacts: {} };

  // Freeze the full requested range before starting a source.
  await checkpoint(run, directory);
  for (let index = 0; index < ids.length; index++) {
    const companyId = ids[index];
    const entry = sources[index];
    entry.status = 'running';
    entry.started_at = now();
    await checkpoint(run, directory);
    const company = companies.find((candidate) => candidate.company_id === companyId);
    if (!company) {
      entry.status = 'not_scanned';
      entry.errors.push({ code: 'UNKNOWN_COMPANY_ID', message: 'No approved implemented collector exists for this company ID' });
      entry.finished_at = now();
      await checkpoint(run, directory);
      continue;
    }
    if (company.access_block) {
      entry.status = 'blocked';
      entry.errors.push({ code: company.access_block.code, message: company.access_block.message });
      entry.finished_at = now();
      await checkpoint(run, directory);
      continue;
    }

    let collectionError = null;
    try {
      Object.assign(entry, normalizeCollected(companyId, await collectFn({ companyId }), now()));
    } catch (error) {
      collectionError = error;
    }
    if (collectionError && isGlobalFailure(collectionError)) {
      terminate(run, sources, index, now, collectionError);
      await checkpoint(run, directory);
      return { ...run, artifacts: run.artifacts };
    }
    if (collectionError) {
      entry.status = 'failed';
      entry.complete = false;
      entry.errors.push(errorRecord(collectionError));
      entry.finished_at = now();
      await checkpoint(run, directory);
      continue;
    }
    const globalError = entry.errors.find(isGlobalFailure);
    if (globalError) {
      terminate(run, sources, index, now);
      await checkpoint(run, directory);
      return { ...run, artifacts: run.artifacts };
    }
    await checkpoint(run, directory);
  }

  run.status = sources.every((source) => ['success', 'empty'].includes(source.status) && source.complete === true) ? 'completed' : 'partial';
  run.finished_at = now();
  await checkpoint(run, directory);
  return { ...run, artifacts: run.artifacts };
}
