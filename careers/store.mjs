import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { DB_PATH } from './paths.mjs';
import { jobKey } from './normalize.mjs';
import { parseSalary } from './salary.mjs';

const SUCCESS = new Set(['success', 'empty']);
const CONTENT_FIELDS = ['title', 'location_raw', 'locations', 'department', 'employment_type',
  'description_text', 'responsibilities', 'requirements', 'description_complete', 'detail_completeness',
  'published_at', 'published_at_raw', 'application_url', 'salary_raw', 'salary_currency', 'salary_period',
  'salary_min', 'salary_max', 'salary_pay_months', 'salary_kind',
  'channel_family', 'recruiter_id', 'recruiter_name', 'recruiter_url'];
const LIMIT_FLAGS = ['page_cap_reached', 'pagination_cap_reached', 'cap_reached', 'capped', 'truncated',
  'has_more', 'hasMore', 'incomplete', 'missing_pages', 'pages_missing'];

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort()
    .filter((key) => value[key] !== undefined).map((key) => [key, canonical(value[key])]));
  return value;
}
function json(value) { return JSON.stringify(canonical(value)); }
function hash(value) { return createHash('sha256').update(json(value)).digest('hex'); }
function timestamp(value, label) {
  const parts = typeof value === 'string' && value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i);
  const valid = parts && Number(parts[2]) >= 1 && Number(parts[2]) <= 12 && Number(parts[3]) >= 1
    && Number(parts[3]) <= new Date(Date.UTC(Number(parts[1]), Number(parts[2]), 0)).getUTCDate()
    && Number(parts[4]) < 24 && Number(parts[5]) < 60 && Number(parts[6]) < 60;
  const result = valid ? Date.parse(value) : NaN;
  if (!Number.isFinite(result)) throw new Error(`Invalid ${label} timestamp`);
  return result;
}
function required(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} required`);
}
function selected(value) {
  if (value == null || value === false || value === '') return false;
  if (Array.isArray(value)) return value.some(selected);
  if (typeof value === 'object') return Object.values(value).some(selected);
  return true;
}
function scopeIdentity(scope) {
  const identity = { ...scope };
  // Pagination counters and safety policy are observations, not a different collection universe.
  for (const key of ['pagination', 'coverage', 'closure_eligible', ...LIMIT_FLAGS]) delete identity[key];
  return hash(identity);
}
function limited(value, jobCount) {
  if (!value || typeof value !== 'object') return false;
  if (LIMIT_FLAGS.some((key) => selected(value[key])) || value.complete === false
    || value.exhausted === false || value.next_cursor || value.nextCursor) return true;
  if (Number.isFinite(value.pages) && Number.isFinite(value.pages_fetched) && value.pages_fetched < value.pages) return true;
  if (Number.isFinite(value.total) && value.total > (value.returned_records ?? jobCount)) return true;
  const cap = value.page_cap ?? value.max_pages;
  if (Number.isFinite(cap) && value.pages_fetched >= cap && !(Number.isFinite(value.pages) && value.pages <= value.pages_fetched)) return true;
  return false;
}
function completeSnapshot(run) {
  return SUCCESS.has(run.status) && run.complete === true && !(run.errors ?? []).length
    && !limited(run.scope, run.jobs.length) && !limited(run.scope.pagination, run.jobs.length)
    && !limited(run.pagination, run.jobs.length) && !LIMIT_FLAGS.some((key) => selected(run[key]));
}
function fullScope(scope) {
  return !/query|search|filter/i.test(scope.kind ?? '')
    && !['query', 'keywords', 'filters', 'query_scope', 'search', 'search_query', 'filter'].some((key) => selected(scope[key]));
}
function withSalary(job) {
  if (['ambiguous', 'invalid', 'unknown_unit'].includes(job.salary_status)) {
    return { ...job, salary_min: null, salary_max: null, salary_20k_eligible: false };
  }
  return { ...job, ...parseSalary(job.salary_raw, { currency: job.salary_currency,
    period: job.salary_period === 'unknown' ? undefined : job.salary_period }) };
}
export function currentJobLinks(job) {
  const original = job.source_locator?.upstream_detail_url;
  if (job.provider !== 'official-embedded-json-v1' || job.company_id !== 'deepseek'
    || !original || original !== job.source_record?.detailUrl) return job;
  let url;
  try { url = new URL(original); } catch { return job; }
  if (url.protocol !== 'https:' || url.username || url.password) return job;
  return { ...job, job_url: url.href, board_url: job.board_url ?? 'https://talent.deepseek.com/',
    link_verification: 'source_embedded_not_navigated',
    link_projection: 'Current read projection from matching original source_record.detailUrl and source_locator; historical snapshots unchanged' };
}

function content(job) {
  const value = withSalary(job);
  return Object.fromEntries(CONTENT_FIELDS.map((key) => [key, value[key] ?? null]));
}
function explicitStatus(job, status) {
  const evidence = job.hiring_active_evidence;
  return evidence?.explicit === true && evidence.status === status
    && [evidence.url, evidence.body_path, evidence.metadata_path].some((value) => typeof value === 'string' && value.trim());
}
function parsedRun(row) {
  return { ...JSON.parse(row.result_json), run_id: row.run_id, source_id: row.source_id,
    started_at: row.started_at, finished_at: row.finished_at, status: row.status,
    complete: Boolean(row.complete), scope: JSON.parse(row.scope_json) };
}

export class CareersStore {
  constructor(path = DB_PATH) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    try {
      const version = this.db.prepare('PRAGMA user_version').get().user_version;
      if (version > 2) throw new Error(`Unsupported careers schema version ${version}; refusing to downgrade`);
      this.db.exec('PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; BEGIN IMMEDIATE;');
      this.db.exec(`
      CREATE TABLE IF NOT EXISTS sources (
        source_id TEXT PRIMARY KEY, company_id TEXT NOT NULL, tenant TEXT NOT NULL,
        provider TEXT NOT NULL, board_url TEXT NOT NULL, latest_run_id TEXT,
        last_verified_ownership_json TEXT, halted_reason TEXT);
      CREATE TABLE IF NOT EXISTS runs (
        run_id TEXT PRIMARY KEY, source_id TEXT NOT NULL REFERENCES sources(source_id),
        started_at TEXT NOT NULL, finished_at TEXT, status TEXT NOT NULL,
        complete INTEGER NOT NULL DEFAULT 0, scope_json TEXT NOT NULL, result_json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS jobs (
        job_key TEXT PRIMARY KEY, source_id TEXT NOT NULL REFERENCES sources(source_id),
        tenant TEXT NOT NULL, source_job_id TEXT NOT NULL, title TEXT NOT NULL,
        description_text TEXT NOT NULL, salary_raw TEXT, published_at TEXT,
        hiring_active TEXT NOT NULL, first_seen_at TEXT NOT NULL, last_seen_at TEXT NOT NULL,
        latest_run_id TEXT NOT NULL REFERENCES runs(run_id), normalized_json TEXT NOT NULL,
        UNIQUE(source_id,tenant,source_job_id));
      CREATE TABLE IF NOT EXISTS job_snapshots (
        run_id TEXT NOT NULL REFERENCES runs(run_id), job_key TEXT NOT NULL REFERENCES jobs(job_key),
        content_sha256 TEXT NOT NULL, normalized_json TEXT NOT NULL, PRIMARY KEY(run_id,job_key));
      CREATE TABLE IF NOT EXISTS requests (
        run_id TEXT NOT NULL REFERENCES runs(run_id), sequence INTEGER NOT NULL,
        url TEXT NOT NULL, method TEXT NOT NULL, started_at TEXT NOT NULL, finished_at TEXT,
        http_status INTEGER, metadata_path TEXT NOT NULL, body_path TEXT NOT NULL,
        evidence_json TEXT NOT NULL, PRIMARY KEY(run_id,sequence));
      CREATE TABLE IF NOT EXISTS scope_baselines (
        source_id TEXT NOT NULL REFERENCES sources(source_id), scope_fingerprint TEXT NOT NULL,
        scope_json TEXT NOT NULL, baseline_run_id TEXT NOT NULL REFERENCES runs(run_id), baseline_at TEXT NOT NULL,
        PRIMARY KEY(source_id,scope_fingerprint));
      CREATE TABLE IF NOT EXISTS job_scopes (
        source_id TEXT NOT NULL REFERENCES sources(source_id), scope_fingerprint TEXT NOT NULL,
        job_key TEXT NOT NULL REFERENCES jobs(job_key), first_seen_at TEXT NOT NULL, last_seen_at TEXT NOT NULL,
        last_seen_run_id TEXT NOT NULL REFERENCES runs(run_id), missing_count INTEGER NOT NULL DEFAULT 0 CHECK(missing_count>=0),
        review_status TEXT NOT NULL DEFAULT 'observed', last_evaluated_run_id TEXT REFERENCES runs(run_id),
        PRIMARY KEY(source_id,scope_fingerprint,job_key));
      CREATE TABLE IF NOT EXISTS events (
        event_id INTEGER PRIMARY KEY, run_id TEXT NOT NULL REFERENCES runs(run_id),
        source_id TEXT NOT NULL REFERENCES sources(source_id), scope_fingerprint TEXT NOT NULL,
        job_key TEXT REFERENCES jobs(job_key), event_type TEXT NOT NULL, occurred_at TEXT NOT NULL,
        event_json TEXT NOT NULL, UNIQUE(run_id,event_type,job_key));
      CREATE INDEX IF NOT EXISTS runs_source_time ON runs(source_id,finished_at);
      CREATE INDEX IF NOT EXISTS events_source_run ON events(source_id,run_id);
      CREATE INDEX IF NOT EXISTS job_scopes_job ON job_scopes(job_key);`);
      if (version < 2) this.seedLegacyBaselines();
      this.db.exec('PRAGMA user_version=2; COMMIT;');
    } catch (error) {
      if (this.db.isTransaction) this.db.exec('ROLLBACK');
      this.db.close();
      throw error;
    }
  }

  beginRun(run, company) {
    required(run.run_id, 'Run ID');
    for (const key of ['source_id', 'company_id', 'tenant', 'provider', 'board_url']) required(company[key], key);
    if (run.source_id !== company.source_id || (run.company_id && run.company_id !== company.company_id)
      || (run.tenant && run.tenant !== company.tenant)) throw new Error('Run/source identity mismatch');
    timestamp(run.started_at, 'run start');
    if (!run.scope || typeof run.scope !== 'object' || Array.isArray(run.scope)) throw new Error('Collection scope required');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const source = this.db.prepare('SELECT * FROM sources WHERE source_id=?').get(company.source_id);
      if (source && ['company_id', 'tenant', 'provider', 'board_url'].some((key) => source[key] !== company[key])) {
        throw new Error('Existing source identity cannot be overwritten');
      }
      this.db.prepare(`INSERT INTO sources(source_id,company_id,tenant,provider,board_url) VALUES(?,?,?,?,?)
        ON CONFLICT(source_id) DO NOTHING`).run(company.source_id, company.company_id, company.tenant, company.provider, company.board_url);
      this.db.prepare('INSERT INTO runs(run_id,source_id,started_at,status,scope_json,result_json) VALUES(?,?,?,?,?,?)')
        .run(run.run_id, run.source_id, run.started_at, 'running', JSON.stringify(run.scope), JSON.stringify(run));
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }

  haltedReason(sourceId) {
    return this.db.prepare('SELECT halted_reason FROM sources WHERE source_id=?').get(sourceId)?.halted_reason ?? null;
  }

  finishRun(run) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const pending = this.db.prepare('SELECT * FROM runs WHERE run_id=?').get(run.run_id);
      if (!pending || pending.status !== 'running' || pending.finished_at != null) throw new Error('Run must exist and be unfinished');
      const source = this.db.prepare('SELECT * FROM sources WHERE source_id=?').get(pending.source_id);
      if (run.source_id !== pending.source_id || (run.company_id && run.company_id !== source.company_id)
        || (run.tenant && run.tenant !== source.tenant)) throw new Error('Run/source identity mismatch');
      const start = timestamp(run.started_at, 'run start');
      const finish = timestamp(run.finished_at, 'run finish');
      if (start !== timestamp(pending.started_at, 'saved run start') || finish < start) throw new Error('Invalid run time interval');
      if (!run.scope || scopeIdentity(run.scope) !== scopeIdentity(JSON.parse(pending.scope_json))) throw new Error('Collection scope changed during run');
      if (!['jobs', 'evidence', 'errors'].every((key) => Array.isArray(run[key]))
        || typeof run.complete !== 'boolean' || !run.status || run.status === 'running'
        || (run.status === 'empty' && run.jobs.length)) throw new Error('Invalid terminal run');
      const latest = this.db.prepare(`SELECT * FROM runs WHERE source_id=? AND finished_at IS NOT NULL
        ORDER BY julianday(finished_at) DESC,rowid DESC LIMIT 1`).get(run.source_id);
      if (latest && start < timestamp(latest.finished_at, 'previous finish')) throw new Error('Out-of-order source observation');
      const completed = structuredClone(run);
      const fingerprint = scopeIdentity(run.scope);
      const baseline = this.db.prepare('SELECT * FROM scope_baselines WHERE source_id=? AND scope_fingerprint=?').get(run.source_id, fingerprint);
      const complete = completeSnapshot(run);
      completed.complete = complete;
      if (SUCCESS.has(run.status) && !complete) {
        completed.status = run.jobs.length ? 'partial' : 'failed';
        completed.source_health = 'incomplete_snapshot';
        completed.errors.push({ code: 'INCOMPLETE_SNAPSHOT', message: 'Reported success conflicts with errors or incomplete pagination; completeness downgraded' });
      }
      completed.scope_fingerprint = fingerprint;
      completed.observation_kind = baseline ? 'subsequent_observation' : complete ? 'baseline' : 'unbaselined_observation';
      completed.change_detection = 'scope_aware_incremental_v2; newly_observed_is_not_publication; absence_requires_review';
      const uniqueJobs = new Map();
      for (const input of completed.jobs) {
        if (input.source_id !== source.source_id || input.tenant !== source.tenant
          || input.job_key !== jobKey(input.source_id, input.tenant, input.source_job_id)
          || (input.company_id && input.company_id !== source.company_id)) throw new Error('Job/source identity mismatch');
        for (const key of ['title', 'description_text', 'content_sha256']) required(input[key], key);
        const observed = timestamp(input.last_seen_at, 'job last seen');
        if (observed < start || observed > finish || timestamp(input.first_seen_at, 'job first seen') > observed) throw new Error('Invalid job time interval');
        if (input.fetched_at != null && (timestamp(input.fetched_at, 'job fetch') < start || timestamp(input.fetched_at, 'job fetch') > finish)) throw new Error('Invalid job fetch interval');
        if (!['unknown', 'open', 'active', 'closed'].includes(input.hiring_active)) throw new Error('Invalid source hiring status');
        if (input.hiring_active === 'closed' && !explicitStatus(input, 'closed')) throw new Error('Explicit source closure evidence required');
        const duplicate = uniqueJobs.get(input.job_key);
        if (duplicate && (hash(content(duplicate)) !== hash(content(input))
          || duplicate.hiring_active !== input.hiring_active || json(duplicate.hiring_active_evidence ?? null) !== json(input.hiring_active_evidence ?? null))) {
          throw new Error('Conflicting duplicate native job in one run');
        }
        if (duplicate) {
          const current = observed >= timestamp(duplicate.last_seen_at, 'duplicate observation') ? input : duplicate;
          uniqueJobs.set(input.job_key, { ...current, first_seen_at: timestamp(input.first_seen_at, 'first seen') < timestamp(duplicate.first_seen_at, 'first seen')
            ? input.first_seen_at : duplicate.first_seen_at });
        } else uniqueJobs.set(input.job_key, input);
      }
      completed.jobs = [];
      for (const input of uniqueJobs.values()) {
        const job = withSalary(input);
        const old = this.db.prepare('SELECT * FROM jobs WHERE job_key=?').get(job.job_key);
        const oldJob = old ? JSON.parse(old.normalized_json) : null;
        if (old) {
          if (timestamp(job.last_seen_at, 'observation') < timestamp(old.last_seen_at, 'previous observation')) throw new Error('Out-of-order observation cannot replace a newer job');
          job.first_seen_at = old.first_seen_at;
        } else if (timestamp(job.first_seen_at, 'first seen') < start) throw new Error('New job first seen cannot predate this run');
        job.source_hiring_active = input.hiring_active;
        if (old?.hiring_active === 'closed' && !explicitStatus(job, 'open') && !explicitStatus(job, 'active') && job.hiring_active !== 'closed') {
          job.hiring_active = 'closed';
          job.hiring_active_reason = oldJob.hiring_active_reason;
          job.hiring_active_evidence = oldJob.hiring_active_evidence;
        }
        job.lifecycle_status = job.hiring_active === 'closed' ? 'closed' : 'observed';
        job.observation_kind = !baseline && complete ? 'baseline' : old ? 'observed' : baseline ? 'newly_observed' : 'first_seen';
        job.observation_semantics = 'Observed at this source; first_seen_at is not published_at; no new_today claim';
        job.content_fingerprint = hash(content(job));
        this.db.prepare(`INSERT INTO jobs(job_key,source_id,tenant,source_job_id,title,description_text,salary_raw,published_at,
          hiring_active,first_seen_at,last_seen_at,latest_run_id,normalized_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
          ON CONFLICT(job_key) DO UPDATE SET title=excluded.title,description_text=excluded.description_text,
          salary_raw=excluded.salary_raw,published_at=excluded.published_at,hiring_active=excluded.hiring_active,
          last_seen_at=excluded.last_seen_at,latest_run_id=excluded.latest_run_id,normalized_json=excluded.normalized_json`)
          .run(job.job_key, job.source_id, job.tenant, job.source_job_id, job.title, job.description_text, job.salary_raw,
            job.published_at ?? null, job.hiring_active, job.first_seen_at, job.last_seen_at, run.run_id, JSON.stringify(job));
        this.db.prepare('INSERT INTO job_snapshots(run_id,job_key,content_sha256,normalized_json) VALUES(?,?,?,?)')
          .run(run.run_id, job.job_key, job.content_sha256, JSON.stringify(job));
        this.db.prepare("UPDATE job_scopes SET missing_count=0,review_status='observed' WHERE job_key=?").run(job.job_key);
        this.observeScope(completed, fingerprint, job);
        if (!baseline && complete || !old) this.addEvent(completed, fingerprint, job.job_key,
          !baseline && complete ? 'baseline' : baseline ? 'newly_observed' : 'first_seen',
          { first_seen_at: job.first_seen_at, published_at: job.published_at ?? null, semantics: 'observation_not_publication' });
        if (oldJob && hash(content(oldJob)) !== job.content_fingerprint) this.addEvent(completed, fingerprint, job.job_key, 'content_changed', {
          previous_run_id: old.latest_run_id, previous_fingerprint: hash(content(oldJob)), current_fingerprint: job.content_fingerprint,
          changed_fields: CONTENT_FIELDS.filter((key) => json(content(oldJob)[key]) !== json(content(job)[key])),
        });
        if (old && ['closed', 'missing_pending_review'].includes(old.hiring_active) && job.hiring_active !== 'closed') {
          this.addEvent(completed, fingerprint, job.job_key, 'reopened', { previous_status: old.hiring_active,
            current_status: job.hiring_active, semantics: old.hiring_active === 'closed' ? 'explicit_source_reopening' : 'listing_reobserved_not_confirmation_of_active_hiring' });
        }
        if (job.hiring_active === 'closed' && old?.hiring_active !== 'closed') this.addEvent(completed, fingerprint, job.job_key, 'status_review', {
          previous_status: old?.hiring_active ?? null, current_status: 'closed', reason: 'explicit_source_closure', evidence: job.hiring_active_evidence,
        });
        completed.jobs.push(job);
      }
      if (!baseline && complete) {
        this.setBaseline(completed, fingerprint);
        if (!completed.jobs.length) this.addEvent(completed, fingerprint, null, 'baseline', { job_count: 0, semantics: 'empty_scope_baseline' });
      } else if (baseline && complete && fullScope(run.scope)) {
        for (const state of this.db.prepare('SELECT * FROM job_scopes WHERE source_id=? AND scope_fingerprint=?').all(run.source_id, fingerprint)) {
          if (uniqueJobs.has(state.job_key)) continue;
          const missing = state.missing_count + 1;
          this.db.prepare('UPDATE job_scopes SET missing_count=?,review_status=?,last_evaluated_run_id=? WHERE source_id=? AND scope_fingerprint=? AND job_key=?')
            .run(missing, missing >= 2 ? 'missing_pending_review' : 'observed', run.run_id, run.source_id, fingerprint, state.job_key);
          if (missing !== 2) continue;
          const old = this.db.prepare('SELECT * FROM jobs WHERE job_key=?').get(state.job_key);
          if (old.hiring_active === 'closed' || old.hiring_active === 'missing_pending_review') continue;
          const job = { ...JSON.parse(old.normalized_json), source_hiring_active: JSON.parse(old.normalized_json).source_hiring_active ?? old.hiring_active,
            hiring_active: 'missing_pending_review', lifecycle_status: 'missing_pending_review', status_run_id: run.run_id,
            hiring_active_reason: 'Absent from two successful complete same-scope snapshots; source closure is not established' };
          this.db.prepare('UPDATE jobs SET hiring_active=?,normalized_json=? WHERE job_key=?').run(job.hiring_active, JSON.stringify(job), state.job_key);
          this.addEvent(completed, fingerprint, state.job_key, 'status_review', { previous_status: old.hiring_active,
            current_status: job.hiring_active, missing_count: missing, reason: 'two_complete_same_scope_absences_not_source_closure' });
        }
      }
      const sequences = new Set();
      for (const evidence of completed.evidence) {
        if (!Number.isSafeInteger(evidence.sequence) || evidence.sequence < 1 || sequences.has(evidence.sequence)) throw new Error('Invalid or duplicate request sequence');
        sequences.add(evidence.sequence);
        if (timestamp(evidence.started_at, 'request start') < start || timestamp(evidence.finished_at, 'request finish') > finish
          || timestamp(evidence.finished_at, 'request finish') < timestamp(evidence.started_at, 'request start')) throw new Error('Invalid request time interval');
        this.db.prepare(`INSERT INTO requests(run_id,sequence,url,method,started_at,finished_at,http_status,
          metadata_path,body_path,evidence_json) VALUES(?,?,?,?,?,?,?,?,?,?)`)
          .run(run.run_id, evidence.sequence, evidence.url, evidence.method, evidence.started_at, evidence.finished_at,
            evidence.status ?? null, evidence.metadata_path, evidence.body_path, JSON.stringify(evidence));
      }
      completed.baseline_run_id = baseline?.baseline_run_id ?? (complete ? run.run_id : null);
      completed.events = this.listEvents({ run_id: run.run_id });
      this.db.prepare('UPDATE runs SET finished_at=?,status=?,complete=?,scope_json=?,result_json=? WHERE run_id=?')
        .run(run.finished_at, completed.status, Number(completed.complete), JSON.stringify(run.scope), JSON.stringify(completed), run.run_id);
      const halt = run.errors.find((error) => ['HTTP_ACCESS_STOP', 'CHALLENGE_STOP'].includes(error.code));
      this.db.prepare(`UPDATE sources SET latest_run_id=?,
        last_verified_ownership_json=COALESCE(?,last_verified_ownership_json),halted_reason=COALESCE(?,halted_reason) WHERE source_id=?`)
        .run(run.run_id, run.ownership?.status === 'verified' ? JSON.stringify(run.ownership) : null,
          halt ? JSON.stringify(halt) : null, run.source_id);
      this.db.exec('COMMIT');
      Object.assign(run, completed);
      return run;
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }

  addEvent(run, fingerprint, key, type, details) {
    this.db.prepare('INSERT INTO events(run_id,source_id,scope_fingerprint,job_key,event_type,occurred_at,event_json) VALUES(?,?,?,?,?,?,?)')
      .run(run.run_id, run.source_id, fingerprint, key, type, run.finished_at, JSON.stringify(details));
  }

  setBaseline(run, fingerprint) {
    this.db.prepare('INSERT INTO scope_baselines(source_id,scope_fingerprint,scope_json,baseline_run_id,baseline_at) VALUES(?,?,?,?,?)')
      .run(run.source_id, fingerprint, JSON.stringify(run.scope), run.run_id, run.finished_at);
  }

  observeScope(run, fingerprint, job) {
    this.db.prepare(`INSERT INTO job_scopes(source_id,scope_fingerprint,job_key,first_seen_at,last_seen_at,last_seen_run_id,last_evaluated_run_id)
      VALUES(?,?,?,?,?,?,?) ON CONFLICT(source_id,scope_fingerprint,job_key) DO UPDATE SET
      last_seen_at=excluded.last_seen_at,last_seen_run_id=excluded.last_seen_run_id,missing_count=0,review_status='observed',
      last_evaluated_run_id=excluded.last_evaluated_run_id`)
      .run(run.source_id, fingerprint, job.job_key, job.last_seen_at, job.last_seen_at, run.run_id, run.run_id);
  }

  seedLegacyBaselines() {
    // Only auxiliary state is backfilled. Stage1 jobs, snapshots, evidence and run JSON stay byte-for-byte intact.
    for (const row of this.db.prepare('SELECT * FROM runs WHERE finished_at IS NOT NULL ORDER BY julianday(finished_at),rowid').all()) {
      const run = parsedRun(row);
      const fingerprint = scopeIdentity(run.scope);
      const snapshots = this.db.prepare('SELECT normalized_json FROM job_snapshots WHERE run_id=?').all(run.run_id).map((entry) => JSON.parse(entry.normalized_json));
      const baseline = this.db.prepare('SELECT 1 FROM scope_baselines WHERE source_id=? AND scope_fingerprint=?').get(run.source_id, fingerprint);
      if (!baseline && completeSnapshot(run)) {
        this.setBaseline(run, fingerprint);
        for (const job of snapshots) this.addEvent(run, fingerprint, job.job_key, 'baseline', { migrated_from_stage1: true, semantics: 'observation_not_publication' });
        if (!snapshots.length) this.addEvent(run, fingerprint, null, 'baseline', { migrated_from_stage1: true, job_count: 0 });
      }
      for (const job of snapshots) this.observeScope(run, fingerprint, job);
    }
  }

  listJobs({ source_id, company_id, hiring_active } = {}) {
    return this.db.prepare('SELECT * FROM jobs ORDER BY source_id,tenant,source_job_id').all()
      .filter((row) => (!source_id || row.source_id === source_id) && (!hiring_active || row.hiring_active === hiring_active))
      .map((row) => ({ ...currentJobLinks(withSalary(JSON.parse(row.normalized_json))), first_seen_at: row.first_seen_at,
        last_seen_at: row.last_seen_at, hiring_active: row.hiring_active, latest_run_id: row.latest_run_id,
        scope_states: this.db.prepare('SELECT * FROM job_scopes WHERE job_key=? ORDER BY scope_fingerprint').all(row.job_key).map((state) => ({ ...state })) }))
      .filter((job) => !company_id || job.company_id === company_id);
  }

  listRuns({ source_id, status } = {}) {
    return this.db.prepare('SELECT * FROM runs ORDER BY julianday(started_at) DESC,rowid DESC').all()
      .filter((row) => (!source_id || row.source_id === source_id) && (!status || row.status === status)).map(parsedRun);
  }

  listEvents({ source_id, run_id, job_key, event_type } = {}) {
    return this.db.prepare('SELECT * FROM events ORDER BY event_id').all()
      .filter((row) => (!source_id || row.source_id === source_id) && (!run_id || row.run_id === run_id)
        && (!job_key || row.job_key === job_key) && (!event_type || row.event_type === event_type))
      .map(({ event_json, ...row }) => ({ ...row, type: row.event_type, details: JSON.parse(event_json) }));
  }

  listSources() {
    const runs = this.listRuns();
    return this.db.prepare('SELECT * FROM sources ORDER BY source_id').all().map(({ last_verified_ownership_json, ...source }) => {
      const history = runs.filter((run) => run.source_id === source.source_id && run.finished_at != null);
      const latest = history.find((run) => run.run_id === source.latest_run_id) ?? history[0] ?? null;
      const failure = history.find((run) => !SUCCESS.has(run.status) || !run.complete || run.errors?.length);
      return { ...source, last_verified_ownership: last_verified_ownership_json ? JSON.parse(last_verified_ownership_json) : null,
        latest_run: latest, latest_run_status: latest?.status ?? null, latest_run_finished_at: latest?.finished_at ?? null,
        source_health: source.halted_reason ? 'halted_pending_review' : latest?.source_health ?? latest?.status ?? 'pending',
        last_failure: failure ? { run_id: failure.run_id, started_at: failure.started_at, finished_at: failure.finished_at,
          status: failure.status, source_health: failure.source_health ?? null, errors: failure.errors ?? [], evidence: failure.evidence ?? [] } : null };
    });
  }

  readRun(id = null) {
    const row = id ? this.db.prepare('SELECT result_json FROM runs WHERE run_id=?').get(id)
      : this.db.prepare('SELECT result_json FROM runs WHERE finished_at IS NOT NULL ORDER BY julianday(finished_at) DESC,run_id DESC LIMIT 1').get();
    return row ? JSON.parse(row.result_json) : null;
  }

  close() { this.db.close(); }
}
