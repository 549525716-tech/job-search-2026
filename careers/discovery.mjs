import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, realpath, rename, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, sep, isAbsolute } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { DATA_DIR, ROOT, repoRelative } from './paths.mjs';
import { acquireCollectionLock } from './lock.mjs';
import { createOfflineDOM } from './dom.mjs';
import { inspectLinkedBoard } from './providers/common.mjs';
import { collect } from './collector.mjs';
import { discoveryIdentity, discoverySeeds, validateGenericSource, readDiscoveryHalts,
  findDiscoveryHalt, sourceIdentity } from './registry.mjs';

export const DISCOVERY_DIR = join(DATA_DIR, 'discovery');
const digest = (value) => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const now = () => new Date().toISOString();
const copy = (value) => structuredClone(value);
const stopCodes = new Set(['HTTP_ACCESS_STOP', 'CHALLENGE_STOP', 'LOGIN_REQUIRED', 'SOURCE_HALTED', 'NON_PUBLIC_DNS',
  'URL_NOT_ALLOWED', 'FIXED_URL_NOT_ADMITTED', 'ROBOTS_UNKNOWN', 'ROBOTS_DISALLOWED', 'ROBOTS_REDIRECT_LIMIT',
  'REDIRECT_LIMIT', 'REDIRECT_CYCLE', 'BROWSER_ADAPTER_QUARANTINED', 'PUBLIC_API_REQUIRES_BROWSER_STATE',
  'INTERRUPTED_COLLECTION_REQUIRES_REVIEW']);
const emptyState = () => ({ schema_version: 1, revision: 0, companies: [], channels: [], inputs: [], batches: [], halts: [] });
const reviewSignature = (entry) => digest({ source: entry.source, admission: entry.admission,
  observations: entry.observations.map((item) => ({ raw: item.raw, route: item.route })) });
const employerSource = (entry, source = {}) => ({ ...entry, ...source,
  group_ids: [...new Set([...(entry.group_ids ?? []), ...(source.group_ids ?? [])])],
  aliases: [...new Set([entry.company_name, entry.legal_name, ...(entry.aliases ?? []), ...(source.aliases ?? [])].filter(Boolean))] });

async function directoryFor(directory, create = false) {
  const path = resolve(directory ?? DISCOVERY_DIR);
  if (path !== DISCOVERY_DIR && !path.startsWith(DISCOVERY_DIR + sep)) throw new Error('DISCOVERY_NAMESPACE_REQUIRED');
  if (create) await mkdir(path, { recursive: true });
  if (existsSync(path)) {
    const actual = await realpath(path);
    const root = await realpath(DATA_DIR);
    if (actual !== join(root, 'discovery') && !actual.startsWith(join(root, 'discovery') + sep)) throw new Error('DISCOVERY_SYMLINK_ESCAPE');
  }
  return path;
}

async function readState(directory) {
  try {
    const state = JSON.parse(await readFile(join(directory, 'state.json'), 'utf8'));
    if (state.schema_version !== 1 || !Array.isArray(state.companies) || !Array.isArray(state.batches)) throw new Error('DISCOVERY_STATE_INVALID');
    return state;
  } catch (error) { if (error.code === 'ENOENT') return emptyState(); throw error; }
}

async function atomicJson(path, value) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  const file = await open(temporary, 'wx');
  try { await file.writeFile(JSON.stringify(value, null, 2) + '\n'); await file.sync(); }
  finally { await file.close(); }
  await rename(temporary, path);
}

function readCollected(directory) {
  const path = join(directory, 'careers.sqlite');
  if (!existsSync(path)) return { jobs: [], runs: [], sources: [] };
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    const jobs = db.prepare('SELECT normalized_json FROM jobs ORDER BY job_key').all().map((row) => JSON.parse(row.normalized_json));
    const runs = db.prepare('SELECT result_json FROM runs ORDER BY started_at,run_id').all().map((row) => JSON.parse(row.result_json));
    const sources = db.prepare('SELECT * FROM sources ORDER BY source_id').all().map(({ last_verified_ownership_json, ...source }) => {
      const latest = runs.find((run) => run.run_id === source.latest_run_id) ?? null;
      return { ...source, last_verified_ownership: last_verified_ownership_json ? JSON.parse(last_verified_ownership_json) : null,
        latest_run: latest, latest_run_status: latest?.status ?? null, latest_run_finished_at: latest?.finished_at ?? null,
        source_health: source.halted_reason ? 'halted_pending_review' : latest?.source_health ?? 'pending' };
    });
    return { jobs, runs, sources };
  } finally { db.close(); }
}

function exportState(state, directory) {
  const collected = readCollected(directory);
  const pending = state.companies.filter((entry) => !['success', 'verified_empty'].includes(entry.status)).map((entry) => ({
    queue_id: entry.queue_id, company_name: entry.company_name, status: entry.status,
    admission: entry.admission, todos: entry.todos, cursor: entry.cursor, attempts: entry.attempts.length,
    budget_requirement: entry.budget_requirement ?? null,
  }));
  return { schema_version: 1, revision: state.revision, updated_at: state.updated_at ?? null,
    namespace: repoRelative(directory), companies: state.companies, channels: state.channels, inputs: state.inputs,
    batches: state.batches, halts: state.halts, ...collected, pending,
    counts: { companies: state.companies.length, channels: state.channels.length, jobs: collected.jobs.length,
      runs: collected.runs.length, pending: pending.length,
      by_status: Object.fromEntries([...new Set(state.companies.map((entry) => entry.status))]
        .map((status) => [status, state.companies.filter((entry) => entry.status === status).length])) },
    boundary: 'Open explicit local discovery imports; reviewed fixed static official URLs only for execution. No internet search, no market-total denominator, no lifecycle closure.' };
}

export async function readDiscoveryExport({ directory = DISCOVERY_DIR } = {}) {
  const path = await directoryFor(directory);
  return exportState(await readState(path), path);
}

// Corrections annotate retained evidence instead of rewriting historical observations.
export async function flagDiscoveryCorrections(corrections, { directory = DISCOVERY_DIR } = {}) {
  const lease = await acquireCollectionLock();
  try {
    const path = await directoryFor(directory, true), state = await readState(path);
    let observations = 0;
    for (const correction of corrections) {
      if (!/^[a-f0-9]{64}$/.test(correction.input_sha256) || !Array.isArray(correction.indices)
        || !correction.replacement_path || !correction.reason) throw new Error('INVALID_DISCOVERY_CORRECTION');
      for (const entry of [...state.companies, ...state.channels]) {
        const affected = (entry.observations ?? []).filter((o) => o.input_sha256 === correction.input_sha256 && correction.indices.includes(o.index));
        if (!affected.length) continue;
        if (entry.source) throw new Error('APPROVED_SOURCE_REQUIRES_SEPARATE_CORRECTION_REVIEW');
        for (const observation of affected) {
          observation.review_correction = { status: 'superseded_pending_verification', reason: correction.reason,
            replacement_path: correction.replacement_path, reviewed_at: now() };
          observations++;
        }
        if (entry.queue_id) {
          if (entry.status !== 'blocked') entry.status = 'needs_verification';
          entry.todos = [...new Set([...(entry.todos ?? []), 'RETAINED_INPUT_SUPERSEDED_READ_CORRECTED_EVIDENCE'])];
        }
      }
    }
    await save(state, path);
    return { observations_annotated: observations, live_requests: 0, raw_observations_rewritten: 0 };
  } finally { lease.release(); }
}

async function save(state, directory) {
  state.revision++;
  state.updated_at = now();
  await atomicJson(join(directory, 'state.json'), state);
  await atomicJson(join(directory, 'export.json'), exportState(state, directory));
}

function recordsOf(document) {
  if (Array.isArray(document)) return document.map((raw, index) => ({ raw, index, kind: 'record' }));
  if (!document || typeof document !== 'object') throw new Error('Discovery input must be a JSON object or array');
  const collections = ['companies', 'jobs', 'leads', 'results', 'channels', 'sources'];
  const found = collections.filter((key) => Array.isArray(document[key]));
  if (found.length) return found.flatMap((kind) => document[kind].map((raw, index) => ({ raw, index, kind })));
  return [{ raw: document, index: 0, kind: 'record' }];
}

function ingest(state, raw, provenance) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    state.channels.push({ channel_id: `unparsed-${digest({ raw, provenance }).slice(0, 24)}`, status: 'pending',
      todo: 'RECORD_SHAPE_REVIEW', observations: [{ ...provenance, raw }] });
    return null;
  }
  const sourceUrl = raw.source_url ?? raw.url ?? raw.evidence?.url ?? raw.origin ?? null;
  if (sourceUrl || ['channels', 'sources'].includes(provenance.kind)) {
    const id = `channel-${digest(sourceUrl ?? raw).slice(0, 24)}`;
    let channel = state.channels.find((entry) => entry.channel_id === id);
    if (!channel) {
      channel = { channel_id: id, entry_url: sourceUrl, status: 'pending', implementation_status: 'pending_adapter',
        todo: 'VERIFY_PUBLISHER_PURPOSE_ACCESS_AND_SUPPORTED_READER', observations: [] };
      state.channels.push(channel);
    }
    if (!channel.observations.some((item) => digest(item.raw) === digest(raw))) channel.observations.push({ ...provenance, raw: copy(raw) });
  }
  const identity = discoveryIdentity(raw);
  if (!identity.company_name || ['channels', 'sources'].includes(provenance.kind) && !raw.company_name && !raw.company && !raw.hiringOrganization) {
    if (!sourceUrl) {
      const id = `channel-${digest(raw).slice(0, 24)}`;
      if (!state.channels.some((entry) => entry.channel_id === id)) state.channels.push({ channel_id: id, status: 'pending',
        todo: 'EMPLOYER_OR_PUBLISHER_IDENTITY_REQUIRED', observations: [{ ...provenance, raw: copy(raw) }] });
    }
    return null;
  }
  let entry = state.companies.find((item) => item.queue_id === identity.queue_id);
  if (!entry && identity.homepage) {
    // An explicitly identified entity may enrich the same official-host/name seed, never merge two named entities.
    const host = (value) => { try { return new URL(value).hostname; } catch { return null; } };
    entry = state.companies.find((item) => host(item.homepage) === host(identity.homepage)
      && item.company_name === identity.company_name && (!item.legal_name || !identity.legal_name || item.legal_name === identity.legal_name)
      && (!item.employer_entity_id || !identity.employer_entity_id || item.employer_entity_id === identity.employer_entity_id));
  }
  if (!entry) {
    entry = { ...identity, status: 'needs_verification', admission: { status: 'pending' }, source: null, source_versions: [],
      observations: [], routes: [], todos: ['OFFICIAL_EMPLOYER_OWNERSHIP_AND_FIXED_URL_APPROVAL_REQUIRED'],
      cursor: null, attempts: [], created_at: now(), updated_at: now() };
    state.companies.push(entry);
  }
  for (const field of ['employer_entity_id', 'homepage', 'legal_name', 'careers_url']) entry[field] ??= identity[field];
  entry.aliases = [...new Set([...entry.aliases, ...identity.aliases])];
  entry.group_ids = [...new Set([...entry.group_ids, ...identity.group_ids])];
  const route = raw.route ?? provenance.route ?? (['jobs', 'leads', 'results'].includes(provenance.kind) || raw.title ? 'B' : 'A');
  if (!entry.routes.includes(route)) entry.routes.push(route);
  if (!entry.observations.some((item) => digest({ raw: item.raw, route: item.route }) === digest({ raw, route }))) {
    entry.observations.push({ ...provenance, route, raw: copy(raw) });
  }
  entry.updated_at = now();
  return entry;
}

async function importDocument(state, directory, path, kind, expectedSha256 = null) {
  const text = await readFile(path, 'utf8');
  const document = JSON.parse(text);
  const sha256 = digest(text);
  if (expectedSha256 && sha256 !== expectedSha256) throw new Error('SWEEP_REPORT_JOBS_HASH_MISMATCH');
  const inputPath = join(directory, 'inputs', `${sha256}.json`);
  await mkdir(join(directory, 'inputs'), { recursive: true });
  try { await writeFile(inputPath, text, { flag: 'wx' }); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    if (digest(await readFile(inputPath, 'utf8')) !== sha256) throw new Error('RETAINED_DISCOVERY_INPUT_HASH_MISMATCH');
  }
  if (!state.inputs.some((item) => item.sha256 === sha256 && item.kind === kind)) state.inputs.push({
    sha256, kind, input_path: String(path), retained_path: repoRelative(inputPath), imported_at: now() });
  return { document, provenance: { input_sha256: sha256, input_path: repoRelative(inputPath), imported_at: now() } };
}

async function importCurrentSweep(state, directory, reportPath) {
  let text;
  try { text = await readFile(reportPath, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return { status: 'not_available', report_path: repoRelative(reportPath) }; throw error; }
  const report = JSON.parse(text);
  const research = join(DATA_DIR, 'research');
  if (typeof report.input_dir !== 'string' || isAbsolute(report.input_dir)
    || !resolve(ROOT, report.input_dir).startsWith(research + sep)) throw new Error('SWEEP_REPORT_INPUT_OUTSIDE_RESEARCH');
  if (!/^[a-f0-9]{64}$/.test(report.jobs_sha256 ?? '')) throw new Error('SWEEP_REPORT_JOBS_HASH_REQUIRED');
  const root = await realpath(research);
  const input = await realpath(resolve(ROOT, report.input_dir));
  const jobsPath = await realpath(join(input, 'jobs.json'));
  if (!input.startsWith(root + sep) || !jobsPath.startsWith(input + sep)) throw new Error('SWEEP_REPORT_INPUT_SYMLINK_ESCAPE');
  const imported = await importDocument(state, directory, jobsPath, 'automatic_current_sweep', report.jobs_sha256);
  const provenance = { ...imported.provenance, report_path: repoRelative(reportPath), report_sha256: digest(text), route: 'B' };
  for (const record of recordsOf(imported.document)) ingest(state, record.raw, { ...provenance, index: record.index, kind: record.kind });
  const receipt = { status: 'imported_as_unverified_discovery', ...provenance, jobs_sha256: report.jobs_sha256,
    input_dir: report.input_dir, records: recordsOf(imported.document).length, source_approvals_imported: false };
  const saved = state.inputs.find((item) => item.sha256 === report.jobs_sha256 && item.kind === 'automatic_current_sweep');
  Object.assign(saved, { report_path: provenance.report_path, report_sha256: provenance.report_sha256 });
  return receipt;
}

function bounded(value, fallback, maximum, label) {
  const number = value ?? fallback;
  if (!Number.isSafeInteger(number) || number < 1 || number > maximum) throw new Error(`${label} must be an integer from 1 to ${maximum}`);
  return number;
}

export async function prepareDiscovery({ inputPaths = [], input = null, approvalsPath = null, includeSeeds = true,
  maxCompanies = 5, maxRequests = 30, maxPages = 3, directory = DISCOVERY_DIR, collectionLease = null,
  currentSweepReportPath = join(DATA_DIR, 'reports/market-sweep.json') } = {}) {
  const budget = { max_companies: bounded(maxCompanies, 5, 100, 'maxCompanies'),
    max_requests: bounded(maxRequests, 30, 500, 'maxRequests'), max_pages_per_company: bounded(maxPages, 3, 100, 'maxPages') };
  const lease = collectionLease ?? await acquireCollectionLock();
  let dom;
  try {
    const path = await directoryFor(directory, true);
    const state = await readState(path);
    if (includeSeeds) for (const [index, seed] of discoverySeeds.entries()) ingest(state, seed, {
      kind: 'companies', route: 'A', index, input_path: 'careers/config/company-discovery.json', imported_at: now() });
    const automaticImport = includeSeeds ? await importCurrentSweep(state, path, currentSweepReportPath) : { status: 'disabled_by_no_seeds' };
    for (const file of [...new Set([...inputPaths, ...(input ? [input] : [])])]) {
      const imported = await importDocument(state, path, file, 'discovery_input');
      for (const record of recordsOf(imported.document)) ingest(state, record.raw, { ...imported.provenance, index: record.index, kind: record.kind });
    }
    const halts = [...readDiscoveryHalts(), ...state.halts];
    if (approvalsPath) {
      const imported = await importDocument(state, path, approvalsPath, 'explicit_source_approvals');
      if (imported.document.schema !== 'generic-official-approvals/v1' || !Array.isArray(imported.document.approvals)) throw new Error('SEPARATE_EXPLICIT_APPROVAL_DOCUMENT_REQUIRED');
      for (const [index, approval] of imported.document.approvals.entries()) {
        const entry = ingest(state, approval.company ?? {}, { ...imported.provenance, index, kind: 'companies' });
        if (!entry) continue;
        try {
          const source = validateGenericSource(approval.source, entry);
          const halt = findDiscoveryHalt(employerSource(entry, source), halts);
          if (halt) throw Object.assign(new Error(JSON.stringify(halt.reason)), {
            code: halt.applicability === 'confirmed' ? 'SOURCE_HALTED' : 'HALT_SCOPE_VERIFICATION_REQUIRED' });
          dom ??= await createOfflineDOM();
          const { evidenceAbsolute } = await import('./paths.mjs');
          await inspectLinkedBoard(dom, { url: source.ownership_url,
            text: await readFile(evidenceAbsolute(source.ownership_evidence.body_path), 'utf8') }, source);
          if (entry.source && ['company_id', 'source_id', 'tenant', 'board_url'].some((key) => entry.source[key] !== source[key])) {
            throw new Error('EXISTING_SOURCE_IDENTITY_IMMUTABLE');
          }
          if (!entry.source || entry.source.approval_sha256 !== source.approval_sha256) {
            if (entry.source) entry.source_versions.push({ source: entry.source, cursor: entry.cursor, replaced_at: now() });
            entry.source = source;
            entry.group_ids = employerSource(entry, source).group_ids;
            entry.cursor = null;
            entry.budget_requirement = null;
            entry.status = 'queued';
          }
          entry.admission = { status: 'approved_for_current_chain_check', approval_sha256: source.approval_sha256,
            reviewed_by: source.approval.reviewed_by, reviewed_at: source.approval.reviewed_at };
          entry.todos = [];
        } catch (error) {
          entry.status = error.code === 'SOURCE_HALTED' ? 'blocked' : error.message === 'UNSUPPORTED_PROVIDER' ? 'unsupported' : 'needs_verification';
          entry.admission = { status: 'pending', error: error.message };
          entry.todos = [error.code ?? error.message];
        }
      }
    }
    for (const entry of state.companies) {
      const halted = findDiscoveryHalt(employerSource(entry, entry.source ?? {}), halts);
      if (halted) {
        const blocked = halted.applicability === 'confirmed';
        entry.status = blocked ? 'blocked' : 'needs_verification';
        entry.todos = [blocked ? 'SOURCE_HALTED' : 'HALT_SCOPE_VERIFICATION_REQUIRED'];
        entry.admission = { status: blocked ? 'blocked' : 'pending', reason: halted.reason };
      }
    }
    let batch = state.batches.find((item) => item.status !== 'completed');
    if (!batch) {
      const recheckable = (entry) => ['success', 'verified_empty'].includes(entry.status);
      const eligible = state.companies.filter((entry) => (recheckable(entry)
        || (entry.last_terminal_signature !== reviewSignature(entry)
          && (entry.status !== 'failed' || entry.attempts.filter((attempt) => attempt.status === 'failed').length < 3)))
        && (!entry.budget_requirement || budget.max_requests > entry.budget_requirement.request_budget_must_exceed));
      const ready = (entry) => Boolean(entry.source && ['queued', 'partial', 'failed'].includes(entry.status));
      const lastAttemptAt = (entry) => entry.attempts.reduce((oldest, attempt) => {
        const timestamp = Date.parse(attempt.finished_at ?? '');
        return Number.isFinite(timestamp) ? Math.max(oldest, timestamp) : oldest;
      }, Number.NEGATIVE_INFINITY);
      eligible.sort((a, b) => Number(ready(b)) - Number(ready(a))
        || lastAttemptAt(a) - lastAttemptAt(b)
        || String(a.queue_id).localeCompare(String(b.queue_id)));
      const selected = eligible.slice(0, budget.max_companies);
      const manifest = selected.map((entry) => ({ queue_id: entry.queue_id, company_name: entry.company_name,
        source: copy(entry.source), admission: copy(entry.admission), cursor: recheckable(entry) ? null : copy(entry.cursor),
        recheck: recheckable(entry), routes: copy(entry.routes),
        review_signature: reviewSignature(entry) }));
      batch = { batch_id: `discovery-${randomUUID()}`, created_at: now(), frozen_revision: state.revision + 1,
        manifest_sha256: digest(manifest), manifest, budget,
        denominator: { selected_companies: selected.length, known_companies_at_freeze: state.companies.length,
          deferred_companies: eligible.length - selected.length, market_total: null },
        status: selected.length ? 'prepared' : 'completed', results: {}, executions: [], active: null };
      state.batches.push(batch);
    }
    await save(state, path);
    return { command: 'discovery:prepare', live_requests: 0, automatic_import: automaticImport, batch_id: batch.batch_id, batch_status: batch.status,
      frozen_budget: batch.budget, denominator: batch.denominator, ...exportSummary(state, path),
      next_command: `npm run careers:discovery:run -- --batch ${batch.batch_id}` };
  } finally { if (dom) await dom.close(); if (!collectionLease) lease.release(); }
}

function exportSummary(state, directory) {
  return { companies: state.companies.length, channels: state.channels.length,
    queue_path: repoRelative(join(directory, 'state.json')), export_path: repoRelative(join(directory, 'export.json')),
    admission_todos: state.companies.filter((entry) => entry.todos.length).map((entry) => ({
      queue_id: entry.queue_id, company_name: entry.company_name, status: entry.status, todos: entry.todos })) };
}

function classify(run) {
  if (run.errors.some((error) => error.code === 'HALT_SCOPE_VERIFICATION_REQUIRED')) return 'needs_verification';
  if (run.errors.some((error) => stopCodes.has(error.code))) return 'blocked';
  if (run.errors.some((error) => ['NETWORK_FAILED', 'HTTP_FAILED', 'STATIC_COLLECTION_FAILED', 'COLLECTION_FAILED'].includes(error.code))) return 'failed';
  return run.discovery_result?.status ?? 'failed';
}

function finishEntry(state, batch, entry, run, executionId) {
  const status = classify(run);
  const cursor = run.discovery_result?.cursor ?? entry.cursor;
  const budgetRequirement = run.discovery_result?.budget_requirement ?? null;
  const resumable = status === 'partial' && !budgetRequirement && (!cursor || cursor.pending.length > 0);
  const result = { status, terminal: !resumable, run_id: run.run_id, execution_id: executionId,
    finished_at: run.finished_at, complete: run.discovery_result?.source_complete === true,
    job_count: run.jobs.length, errors: run.errors, cursor, budget_requirement: budgetRequirement };
  entry.status = status;
  entry.cursor = cursor;
  entry.budget_requirement = budgetRequirement;
  entry.attempts.push(result);
  entry.todos = budgetRequirement ? ['REFREEZE_LARGER_REQUEST_BUDGET'] : status === 'blocked' ? ['SOURCE_HALTED'] : status === 'unsupported' ? ['PARSER_OR_MANUAL_TOOL_REQUIRED']
    : resumable ? ['RESUME_FROZEN_CHECKPOINT'] : ['success', 'verified_empty'].includes(status) ? [] : ['REVIEW_SOURCE_RESULT'];
  batch.results[entry.queue_id] = result;
  if (budgetRequirement) delete entry.last_terminal_signature;
  else if (result.terminal) entry.last_terminal_signature = reviewSignature(entry);
  if (status === 'blocked') {
    const stop = run.errors.find((error) => stopCodes.has(error.code));
    const receipt = run.evidence?.find((item) => item.metadata_path === stop?.evidence);
    const deniedUrl = receipt?.url ? new URL(receipt.url) : null;
    const halt_scope = deniedUrl?.pathname === '/robots.txt' ? { kind: 'origin', origin: deniedUrl.origin }
      : { kind: 'tenant', origin: new URL(entry.source.tenant_scope_url).origin, path: new URL(entry.source.tenant_scope_url).pathname };
    state.halts.push({ identity: sourceIdentity({ ...employerSource(entry, entry.source), halt_scope }),
      reason: { code: 'DISCOVERY_SOURCE_HALTED', run_id: run.run_id, errors: run.errors }, recorded_at: now() });
  }
  for (const raw of run.discovery_result?.discovered_companies ?? []) ingest(state, raw, { kind: 'companies',
    route: 'B', run_id: run.run_id, imported_at: now() });
  return result;
}

export async function runDiscovery({ batchId, directory = DISCOVERY_DIR, collectionLease = null, dependencies = {} } = {}) {
  if (!batchId?.trim()) throw new Error('Explicit frozen --batch required');
  const lease = collectionLease ?? await acquireCollectionLock();
  try {
    const path = await directoryFor(directory, true);
    const state = await readState(path);
    const batch = state.batches.find((item) => item.batch_id === batchId);
    if (!batch || digest(batch.manifest) !== batch.manifest_sha256) throw new Error('FROZEN_BATCH_MISSING_OR_CHANGED');
    if (batch.status === 'completed') return { command: 'discovery:run', batch_id: batchId, status: 'completed',
      live_requests: 0, no_op: true, results: batch.results, ...exportSummary(state, path) };
    if (batch.active) {
      const entry = state.companies.find((item) => item.queue_id === batch.active.queue_id);
      const saved = readCollected(path).runs.findLast((run) => run.source_id === entry.source?.source_id
        && run.finished_at && run.started_at >= batch.active.started_at);
      if (saved) finishEntry(state, batch, entry, saved, batch.active.execution_id);
      else {
        entry.status = 'blocked'; entry.todos = ['INTERRUPTED_COLLECTION_REQUIRES_REVIEW'];
        batch.results[entry.queue_id] = { status: 'blocked', terminal: true, errors: [{ code: 'INTERRUPTED_COLLECTION_REQUIRES_REVIEW' }] };
        state.halts.push({ identity: sourceIdentity(employerSource(entry, entry.source)), reason: { code: 'INTERRUPTED_COLLECTION_REQUIRES_REVIEW' } });
        entry.last_terminal_signature = reviewSignature(entry);
      }
      for (const previous of batch.executions) if (previous.status === 'running') previous.status = 'interrupted';
      batch.active = null;
    }
    const execution = { execution_id: randomUUID(), started_at: now(), finished_at: null, status: 'running',
      budget: copy(batch.budget), requests_used: 0 };
    batch.executions.push(execution);
    batch.status = 'running';
    await save(state, path);
    const requests = { used: 0, limit: batch.budget.max_requests };
    for (const frozen of batch.manifest) {
      if (batch.results[frozen.queue_id]?.terminal) continue;
      if (requests.used >= requests.limit) break;
      const entry = state.companies.find((item) => item.queue_id === frozen.queue_id);
      let admissionError = null;
      let status = 'needs_verification';
      const halt = findDiscoveryHalt(employerSource(entry, frozen.source ?? {}), [...readDiscoveryHalts(), ...state.halts]);
      if (halt) { admissionError = halt.applicability === 'confirmed' ? JSON.stringify(halt.reason) : 'HALT_SCOPE_VERIFICATION_REQUIRED';
        status = halt.applicability === 'confirmed' ? 'blocked' : 'needs_verification'; }
      else if (digest(frozen.source ?? null) !== digest(entry.source ?? null)
        || digest(frozen.admission ?? null) !== digest(entry.admission ?? null)) admissionError = 'SOURCE_APPROVAL_CHANGED_AFTER_FREEZE';
      else if (!frozen.source || frozen.admission.status !== 'approved_for_current_chain_check') admissionError = 'SOURCE_APPROVAL_PENDING';
      if (!admissionError) {
        try { validateGenericSource(frozen.source, entry); }
        catch (error) { admissionError = `SOURCE_REVERIFICATION_REQUIRED:${error.message}`; }
      }
      if (admissionError) {
        batch.results[entry.queue_id] = { status, terminal: true, errors: [{ code: admissionError }], attempted: false };
        // The old manifest cannot retire or overwrite a newer approval revision.
        if (admissionError !== 'SOURCE_APPROVAL_CHANGED_AFTER_FREEZE') {
          entry.status = status; entry.todos = [admissionError];
          entry.last_terminal_signature = reviewSignature(entry);
        }
        await save(state, path);
        continue;
      }
      batch.active = { queue_id: entry.queue_id, execution_id: execution.execution_id, started_at: now() };
      await save(state, path);
      try {
        // A recheck starts from the frozen null cursor exactly once. Later checkpoint runs
        // must continue from the cursor persisted by that recheck, not restart its board.
        const cursor = frozen.recheck === true && !Object.hasOwn(batch.results, frozen.queue_id) ? null : entry.cursor;
        const collectFn = dependencies.collectFn ?? collect;
        const result = await collectFn({ source: frozen.source, dataDir: path, cursor,
          maxPages: batch.budget.max_pages_per_company, requestBudget: requests, collectionLease: lease, dependencies });
        finishEntry(state, batch, entry, result.runs[0], execution.execution_id);
      } catch (error) {
        entry.status = 'failed'; entry.todos = [error.code ?? error.message];
        const result = { status: 'failed', terminal: true, finished_at: now(), errors: [{ code: error.code ?? 'COLLECTOR_FAILED', message: error.message }] };
        entry.attempts.push(result); batch.results[entry.queue_id] = result;
        entry.last_terminal_signature = reviewSignature(entry);
      }
      batch.active = null;
      execution.requests_used = requests.used;
      await save(state, path);
    }
    execution.status = 'completed'; execution.finished_at = now(); execution.requests_used = requests.used;
    batch.status = batch.manifest.every((entry) => batch.results[entry.queue_id]?.terminal) ? 'completed' : 'checkpoint';
    await save(state, path);
    return { command: 'discovery:run', batch_id: batchId, execution_id: execution.execution_id, status: batch.status,
      requests_used: requests.used, denominator: batch.denominator, results: batch.results,
      next_action: batch.status === 'checkpoint' ? 'Run the same frozen batch for remaining work; entries requiring a larger budget are parked and will not replay'
        : Object.values(batch.results).some((result) => result.budget_requirement)
          ? 'Prepare a new batch with --max-requests greater than each budget_requirement.request_budget_must_exceed; replaying this frozen budget cannot progress'
        : 'Prepare the next wave; pending/manual/blocked sources are not market exhaustion', ...exportSummary(state, path) };
  } finally { if (!collectionLease) lease.release(); }
}
