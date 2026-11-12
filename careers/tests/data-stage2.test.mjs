import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { CareersStore } from '../store.mjs';
import { normalizeJob } from '../normalize.mjs';
import { parseSalary } from '../salary.mjs';

const COMPANY = { company_id: 'test-company', company_name: 'Test', legal_name: 'Test Ltd', source_id: 'test-board',
  tenant: 'test-tenant', provider: 'test-static', board_url: 'https://example.invalid/jobs' };
const time = (hour) => new Date(Date.UTC(2026, 8, 9, hour)).toISOString();
const scope = (overrides = {}) => ({ kind: 'official_board', board_url: COMPANY.board_url, query: null,
  keywords: [], filters: {}, company_wide: false, closure_eligible: false, pagination: null, ...overrides });
function job(id, hour, overrides = {}, company = COMPANY) {
  return { ...normalizeJob({ source_job_id: id, title: 'Account Manager', location_raw: 'Guangzhou',
    responsibilities: 'Build customer relationships', requirements: 'B2B experience',
    description_text: 'Responsibilities\nBuild customer relationships\nRequirements\nB2B experience',
    published_raw: '2023-08-23', published_date: '2023-08-23', source_record: { id } }, company,
  { finished_at: time(hour), url: company.board_url, body_path: `test-only/${hour}/body.html`,
    metadata_path: `test-only/${hour}/metadata.json`, sha256: `response-${hour}` }), ...overrides };
}
function run(id, hour, jobs = [], overrides = {}, company = COMPANY) {
  return { run_id: id, source_id: company.source_id, company_id: company.company_id, tenant: company.tenant,
    started_at: time(hour), finished_at: time(hour), status: jobs.length ? 'success' : 'empty', complete: true,
    scope: scope({ board_url: company.board_url }), jobs, errors: [], evidence: [],
    ownership: { status: 'verified', chain: [] }, ...overrides };
}
function save(store, value, company = COMPANY) { store.beginRun(value, company); return store.finishRun(value); }
function memory(t) { const store = new CareersStore(':memory:'); t.after(() => store.close()); return store; }
const plain = (value) => JSON.parse(JSON.stringify(value));
function databaseState(store) {
  return Object.fromEntries(['sources', 'runs', 'jobs', 'job_snapshots', 'requests', 'scope_baselines', 'job_scopes', 'events']
    .map((table) => [table, plain(store.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all())]));
}

test('baseline, unchanged repeat and later native ID arrival have observation-only events', (t) => {
  const store = memory(t);
  const initial = save(store, run('initial', 1, [job('1', 1), job('2', 1)]));
  assert.equal(initial.observation_kind, 'baseline');
  assert.deepEqual(store.listEvents().map((event) => event.event_type), ['baseline', 'baseline']);
  save(store, run('repeat', 2, [job('1', 2), job('2', 2)]));
  assert.equal(store.listEvents().length, 2);
  const later = save(store, run('later', 3, [job('1', 3), job('2', 3), job('3', 3)]));
  assert.equal(later.observation_kind, 'subsequent_observation');
  assert.deepEqual(later.events.map((event) => event.event_type), ['newly_observed']);
  assert.equal(later.jobs[2].published_at, '2023-08-23');
  assert.equal(later.jobs[2].first_seen_at, time(3));
  assert.equal(store.listJobs()[0].first_seen_at, time(1));
  assert.equal(store.listJobs()[0].last_seen_at, time(3));
  assert.equal(store.listJobs()[0].body_path, 'test-only/3/body.html');
  assert.equal(store.listJobs()[0].salary_max, null);
  assert.equal(store.listJobs()[0].salary_20k_eligible, false);
  assert.equal(store.db.prepare('SELECT count(*) AS n FROM job_snapshots').get().n, 7);
});

test('empty initial full snapshot establishes a baseline for a later arrival', (t) => {
  const store = memory(t);
  save(store, run('empty-baseline', 1));
  assert.equal(store.listEvents()[0].job_key, null);
  const next = save(store, run('arrival', 2, [job('1', 2)]));
  assert.equal(next.baseline_run_id, 'empty-baseline');
  assert.deepEqual(next.events.map((event) => event.event_type), ['newly_observed']);
});

test('conflicting success with incomplete pagination is downgraded in persisted run state', (t) => {
  const store = memory(t);
  const value = run('contradictory', 1, [], { scope: scope({ pagination: { pages: 3, pages_fetched: 1 } }) });
  const result = save(store, value);
  assert.equal(result.complete, false);
  assert.equal(result.status, 'failed');
  assert.equal(store.readRun('contradictory').complete, false);
  assert.equal(store.listRuns()[0].status, 'failed');
  assert(result.errors.some((error) => error.code === 'INCOMPLETE_SNAPSHOT'));
  assert.equal(store.listEvents().length, 0);
});

test('partial first observations do not establish a complete baseline or claim new publication', (t) => {
  const store = memory(t);
  const first = save(store, run('partial', 1, [job('1', 1)], { status: 'partial', complete: false }));
  assert.equal(first.observation_kind, 'unbaselined_observation');
  assert.equal(first.baseline_run_id, null);
  assert.deepEqual(first.events.map((event) => event.event_type), ['first_seen']);
  const full = save(store, run('full', 2, [job('1', 2), job('2', 2)]));
  assert.equal(full.observation_kind, 'baseline');
  assert.deepEqual(full.events.map((event) => event.event_type), ['baseline', 'baseline']);
  assert.equal(full.jobs[0].first_seen_at, time(1));
});

test('baselines survive intervening scopes and pagination counters do not change identity', (t) => {
  const store = memory(t);
  const a = save(store, run('a1', 1, [job('1', 1)], { scope: scope({ pagination: { total: 1, pages: 1, pages_fetched: 1 } }) }));
  const b = save(store, run('b1', 2, [job('2', 2)], { scope: scope({ query: 'sales' }) }));
  assert.notEqual(a.scope_fingerprint, b.scope_fingerprint);
  save(store, run('failure', 3, [], { status: 'failed', complete: false }));
  const reordered = Object.fromEntries(Object.entries(scope({ pagination: { total: 2, pages: 2, pages_fetched: 2 } })).reverse());
  const a2 = save(store, run('a2', 4, [job('1', 4), job('3', 4)], { scope: reordered }));
  assert.equal(a2.scope_fingerprint, a.scope_fingerprint);
  assert.equal(a2.baseline_run_id, 'a1');
  assert.equal(a2.events.find((event) => event.job_key === job('3', 4).job_key).event_type, 'newly_observed');
  const b2 = save(store, run('b2', 5, [job('2', 5)], { scope: scope({ query: 'sales' }) }));
  assert.equal(b2.baseline_run_id, 'b1');
});

test('two full same-scope absences only request review; more absences cannot close or duplicate review', (t) => {
  const store = memory(t);
  save(store, run('baseline', 1, [job('1', 1)]));
  save(store, run('missing1', 2));
  assert.equal(store.listJobs()[0].hiring_active, 'unknown');
  assert.equal(store.listJobs()[0].scope_states[0].missing_count, 1);
  save(store, run('missing2', 3));
  const missing = store.listJobs()[0];
  assert.equal(missing.hiring_active, 'missing_pending_review');
  assert.equal(missing.last_seen_at, time(1));
  assert.equal(missing.latest_run_id, 'baseline');
  assert.equal(missing.scope_states[0].missing_count, 2);
  save(store, run('missing3', 4));
  assert.equal(store.listEvents({ event_type: 'status_review' }).length, 1);
  assert.equal(store.listJobs()[0].hiring_active, 'missing_pending_review');
  const back = save(store, run('back', 5, [job('1', 5)]));
  assert.deepEqual(back.events.map((event) => event.event_type), ['reopened']);
  assert.equal(store.listJobs()[0].hiring_active, 'unknown');
  assert.equal(store.listJobs()[0].first_seen_at, time(1));
  assert.equal(store.listJobs()[0].scope_states[0].missing_count, 0);
});

test('partial, failed, query, filters, caps and incomplete pagination cannot advance absence counts', (t) => {
  const store = memory(t);
  save(store, run('initial', 1, [job('1', 1)]));
  save(store, run('miss', 2));
  const excluded = [
    { status: 'partial', complete: false }, { status: 'failed', complete: true }, { complete: false },
    { scope: scope({ query: 'sales' }) }, { scope: scope({ keywords: ['sales'] }) }, { scope: scope({ filters: { city: 'GZ' } }) },
    { scope: scope({ pagination: { capped: true } }) }, { scope: scope({ pagination: { pages: 3, pages_fetched: 2 } }) },
    { scope: scope({ pagination: { total: 5, returned_records: 0 } }) }, { scope: scope({ pagination: { has_more: true } }) },
    { scope: scope({ pagination: { page_cap: 2, pages_fetched: 2 } }) }, { page_cap_reached: true },
    { errors: [{ code: 'MISSING_PAGE' }] },
  ];
  for (const [index, overrides] of excluded.entries()) {
    save(store, run(`excluded-${index}`, index + 3, [], overrides));
    assert.equal(store.listJobs()[0].scope_states[0].missing_count, 1, JSON.stringify(overrides));
    assert.equal(store.listJobs()[0].hiring_active, 'unknown');
  }
  save(store, run('second-full-miss', 20));
  assert.equal(store.listJobs()[0].hiring_active, 'missing_pending_review');
});

test('query baselines never review missing jobs; positive partial observations reset absence streaks', (t) => {
  const store = memory(t);
  const query = scope({ query: 'sales' });
  save(store, run('q1', 1, [job('1', 1)], { scope: query }));
  save(store, run('q2', 2, [], { scope: query }));
  save(store, run('q3', 3, [], { scope: query }));
  assert.equal(store.listJobs()[0].scope_states[0].missing_count, 0);
  save(store, run('full', 4, [job('1', 4)]));
  save(store, run('missing', 5));
  save(store, run('partial-positive', 6, [job('1', 6)], { status: 'partial', complete: false, scope: query }));
  assert(store.listJobs()[0].scope_states.every((state) => state.missing_count === 0));
  save(store, run('missing-again', 7));
  assert.equal(store.listJobs()[0].hiring_active, 'unknown');
});

test('native IDs, source and tenant isolate same-title jobs and source status disagreements', (t) => {
  const store = memory(t);
  const other = { ...COMPANY, source_id: 'second-board', tenant: 'second-tenant' };
  const third = { ...COMPANY, source_id: 'third-board' };
  save(store, run('first', 1, [job('1', 1), job('2', 1, { location_raw: 'Shanghai' })]));
  const closure = job('1', 1, { hiring_active: 'closed', hiring_active_evidence: { explicit: true, status: 'closed', url: other.board_url } }, other);
  save(store, run('second', 1, [closure], {}, other), other);
  save(store, run('third', 1, [job('1', 1, {}, third)], {}, third), third);
  const jobs = store.listJobs();
  assert.equal(jobs.length, 4);
  assert.equal(new Set(jobs.map((value) => value.job_key)).size, 4);
  assert.equal(store.listJobs({ source_id: COMPANY.source_id }).length, 2);
  assert.equal(store.listJobs({ hiring_active: 'closed' }).length, 1);
  assert.equal(store.listSources().length, 3);
});

test('identical duplicate IDs deduplicate, conflicting duplicates fail atomically', (t) => {
  const store = memory(t);
  const initial = save(store, run('dups', 1, [job('1', 1), job('1', 1)]));
  assert.equal(initial.jobs.length, 1);
  assert.equal(store.listEvents().length, 1);
  const conflict = run('conflict', 2, [job('2', 2), job('1', 2), job('1', 2, { location_raw: 'Shanghai' })]);
  store.beginRun(conflict, COMPANY);
  const before = databaseState(store);
  const caller = structuredClone(conflict);
  assert.throws(() => store.finishRun(conflict), /Conflicting duplicate/);
  assert.deepEqual(databaseState(store), before);
  assert.deepEqual(conflict, caller);
});

test('content changes include location and salary, not fetch time, evidence path or raw timestamps', (t) => {
  const store = memory(t);
  save(store, run('initial', 1, [job('1', 1)]));
  save(store, run('evidence-only', 2, [job('1', 2, { source_updated_at_raw: '2026-09-09 02:00:00' })]));
  assert.equal(store.listEvents({ event_type: 'content_changed' }).length, 0);
  const changed = job('1', 3, { location_raw: 'Shanghai', locations: ['Shanghai', 'Remote'], salary_raw: '15-30K/月' });
  save(store, run('changed', 3, [changed]));
  const event = store.listEvents({ event_type: 'content_changed' })[0];
  assert(event.details.changed_fields.includes('location_raw'));
  assert(event.details.changed_fields.includes('locations'));
  assert(event.details.changed_fields.includes('salary_raw'));
  assert.equal(store.listJobs()[0].salary_20k_eligible, true);
  save(store, run('same-again', 4, [job('1', 4, { location_raw: 'Shanghai', locations: ['Shanghai', 'Remote'], salary_raw: '15-30K/月' })]));
  assert.equal(store.listEvents({ event_type: 'content_changed' }).length, 1);
});

test('out-of-order empty runs, repeat finalization and invalid identities cannot overwrite newer state', (t) => {
  const store = memory(t);
  const completed = save(store, run('latest', 5, [job('1', 5)]));
  assert.throws(() => store.finishRun(completed), /unfinished/);
  for (const invalid of [run('earlier', 4), run('wrong-key', 6, [job('1', 6, { job_key: 'wrong' })]),
    run('wrong-tenant', 7, [job('1', 7, { tenant: 'wrong' })]), run('invalid-title', 8, [job('2', 8, { title: '' })])]) {
    store.beginRun(invalid, COMPANY);
    const before = databaseState(store);
    assert.throws(() => store.finishRun(invalid));
    assert.deepEqual(databaseState(store), before);
  }
  assert.equal(store.readRun().run_id, 'latest');
  assert.equal(store.listJobs()[0].last_seen_at, time(5));
});

test('late evidence validation errors roll back jobs, events, scope counts, sources and input mutations', (t) => {
  const store = memory(t);
  save(store, run('initial', 1, [job('1', 1)]));
  const receipt = { sequence: 1, url: COMPANY.board_url, method: 'GET', started_at: time(2), finished_at: time(2),
    status: 200, metadata_path: 'test-only/meta.json', body_path: 'test-only/body.html' };
  const invalid = run('bad-evidence', 2, [job('1', 2, { title: 'Changed' }), job('2', 2)], { evidence: [receipt, receipt] });
  store.beginRun(invalid, COMPANY);
  const before = databaseState(store);
  const caller = structuredClone(invalid);
  assert.throws(() => store.finishRun(invalid), /duplicate request/);
  assert.deepEqual(databaseState(store), before);
  assert.deepEqual(invalid, caller);
});

test('beginRun identity and duplicate errors roll back source inserts; invalid dates cannot be normalized silently', (t) => {
  const store = memory(t);
  save(store, run('taken', 1));
  const other = { ...COMPANY, source_id: 'other' };
  assert.throws(() => store.beginRun(run('taken', 2, [], {}, other), other), /UNIQUE/);
  assert.equal(store.listSources().length, 1);
  assert.throws(() => store.beginRun(run('bad-company', 2), { ...COMPANY, tenant: 'changed' }), /identity/);
  assert.throws(() => store.beginRun(run('bad-date', 2, [], { started_at: '2026-02-30T00:00:00Z' }), COMPANY), /timestamp/);
  const firstSeen = run('backdated', 3, [job('new', 3, { first_seen_at: '2023-08-23T00:00:00Z' })]);
  store.beginRun(firstSeen, COMPANY);
  assert.throws(() => store.finishRun(firstSeen), /predate/);
  assert.equal(store.listJobs().length, 0);
});

test('UTC offsets compare chronologically rather than lexically', (t) => {
  const store = memory(t);
  save(store, run('first', 1, [job('1', 1)]));
  const offset = '2026-09-09T10:00:00+08:00';
  const next = run('offset', 2, [job('1', 2, { first_seen_at: offset, last_seen_at: offset, fetched_at: offset })],
    { started_at: offset, finished_at: offset });
  save(store, next);
  assert.equal(store.listJobs()[0].first_seen_at, time(1));
  assert.equal(store.listJobs()[0].last_seen_at, offset);
  save(store, run('utc-after-offset', 3, [job('1', 3)]));
  assert.equal(store.readRun().run_id, 'utc-after-offset');
});

test('scope identity is fixed at begin; failed capture can be recovered using initial scope and existing evidence', (t) => {
  const store = memory(t);
  save(store, run('baseline', 1, [job('1', 1)]));
  const failed = run('provider-failed', 2, [], { status: 'failed', complete: false,
    errors: [{ code: 'HTTP_FAILED', message: '405; not retried' }] });
  store.beginRun(failed, COMPANY);
  const initialScope = structuredClone(store.readRun(failed.run_id).scope);
  failed.scope.website_id = 'post-fetch-only';
  const before = databaseState(store);
  assert.throws(() => store.finishRun(failed), /scope changed/);
  assert.deepEqual(databaseState(store), before);
  failed.source_metadata = { website_id: failed.scope.website_id };
  failed.scope = { ...initialScope, coverage: 'provider observation', pagination: { pages_fetched: 0, incomplete: true } };
  failed.evidence = [{ sequence: 1, url: COMPANY.board_url, method: 'POST', started_at: time(2), finished_at: time(2),
    status: 405, metadata_path: 'test-only/405.json', body_path: 'test-only/405.html' }];
  store.finishRun(failed);
  assert.equal(store.readRun('provider-failed').status, 'failed');
  assert.equal(store.readRun('provider-failed').source_metadata.website_id, 'post-fetch-only');
  assert.equal(store.listSources()[0].last_failure.evidence[0].status, 405);
  assert.equal(store.listJobs()[0].scope_states[0].missing_count, 0);
  assert.equal(store.listJobs()[0].last_seen_at, time(1));
});

test('failed source runs retain jobs, last failure evidence and access halt across later success', (t) => {
  const store = memory(t);
  save(store, run('initial', 1, [job('1', 1)]));
  save(store, run('denied', 2, [], { status: 'failed', complete: false, source_health: 'stopped',
    errors: [{ code: 'HTTP_ACCESS_STOP', message: '403; requires review', evidence: 'test-only/403.json' }] }));
  const halt = store.haltedReason(COMPANY.source_id);
  assert.match(halt, /HTTP_ACCESS_STOP/);
  assert.equal(store.listSources()[0].latest_run_status, 'failed');
  assert.equal(store.listSources()[0].last_failure.run_id, 'denied');
  assert.equal(store.listJobs()[0].last_seen_at, time(1));
  save(store, run('later-success', 3, [job('1', 3)]));
  assert.equal(store.haltedReason(COMPANY.source_id), halt);
  const source = store.listSources()[0];
  assert.equal(source.latest_run.run_id, 'later-success');
  assert.equal(source.last_failure.run_id, 'denied');
  assert.equal(source.source_health, 'halted_pending_review');
  assert.equal(source.last_verified_ownership.status, 'verified');
  assert.deepEqual(store.listRuns({ status: 'failed' }).map((value) => value.run_id), ['denied']);
});

test('only explicit source closure can close; re-listing alone cannot undo closure', (t) => {
  const store = memory(t);
  save(store, run('initial', 1, [job('1', 1)]));
  const invalid = run('inferred-close', 2, [job('1', 2, { hiring_active: 'closed' })]);
  store.beginRun(invalid, COMPANY);
  assert.throws(() => store.finishRun(invalid), /Explicit source closure/);
  save(store, run('source-close', 3, [job('1', 3, { hiring_active: 'closed',
    hiring_active_evidence: { explicit: true, status: 'closed', body_path: 'test-only/closed.html' } })]));
  save(store, run('listed', 4, [job('1', 4)]));
  assert.equal(store.listJobs()[0].hiring_active, 'closed');
  assert.equal(store.listEvents({ event_type: 'reopened' }).length, 0);
  save(store, run('source-open', 5, [job('1', 5, { hiring_active: 'open',
    hiring_active_evidence: { explicit: true, status: 'open', body_path: 'test-only/reopened.html' } })]));
  assert.equal(store.listJobs()[0].hiring_active, 'open');
  assert.equal(store.listEvents({ event_type: 'reopened' }).length, 1);
});

test('salary hint conflicts remain ambiguous in stored normalized records', (t) => {
  const store = memory(t);
  const conflict = parseSalary('USD20-30K/month', { currency: 'CNY' });
  save(store, run('conflict', 1, [job('1', 1, conflict)]));
  assert.equal(store.listJobs()[0].salary_status, 'ambiguous');
  assert.equal(store.listJobs()[0].salary_20k_eligible, false);
});

function legacyFixture(path) {
  const db = new DatabaseSync(path);
  db.exec(`CREATE TABLE sources (source_id TEXT PRIMARY KEY,company_id TEXT NOT NULL,tenant TEXT NOT NULL,
    provider TEXT NOT NULL,board_url TEXT NOT NULL,latest_run_id TEXT,last_verified_ownership_json TEXT,halted_reason TEXT);
    CREATE TABLE runs (run_id TEXT PRIMARY KEY,source_id TEXT NOT NULL REFERENCES sources(source_id),started_at TEXT NOT NULL,
    finished_at TEXT,status TEXT NOT NULL,complete INTEGER NOT NULL DEFAULT 0,scope_json TEXT NOT NULL,result_json TEXT NOT NULL);
    CREATE TABLE jobs (job_key TEXT PRIMARY KEY,source_id TEXT NOT NULL REFERENCES sources(source_id),tenant TEXT NOT NULL,
    source_job_id TEXT NOT NULL,title TEXT NOT NULL,description_text TEXT NOT NULL,salary_raw TEXT,published_at TEXT,
    hiring_active TEXT NOT NULL,first_seen_at TEXT NOT NULL,last_seen_at TEXT NOT NULL,latest_run_id TEXT NOT NULL REFERENCES runs(run_id),
    normalized_json TEXT NOT NULL,UNIQUE(source_id,tenant,source_job_id));
    CREATE TABLE job_snapshots (run_id TEXT NOT NULL REFERENCES runs(run_id),job_key TEXT NOT NULL REFERENCES jobs(job_key),
    content_sha256 TEXT NOT NULL,normalized_json TEXT NOT NULL,PRIMARY KEY(run_id,job_key));
    CREATE TABLE requests (run_id TEXT NOT NULL REFERENCES runs(run_id),sequence INTEGER NOT NULL,url TEXT NOT NULL,
    method TEXT NOT NULL,started_at TEXT NOT NULL,finished_at TEXT,http_status INTEGER,metadata_path TEXT NOT NULL,
    body_path TEXT NOT NULL,evidence_json TEXT NOT NULL,PRIMARY KEY(run_id,sequence)); PRAGMA user_version=1;`);
  const initial = run('legacy-baseline', 1, ['1', '2', '3', '4'].map((id) => job(id, 1)));
  db.prepare('INSERT INTO sources VALUES(?,?,?,?,?,?,?,?)').run(COMPANY.source_id, COMPANY.company_id, COMPANY.tenant,
    COMPANY.provider, COMPANY.board_url, initial.run_id, JSON.stringify(initial.ownership), JSON.stringify({ code: 'CHALLENGE_STOP' }));
  for (const value of [initial, run('legacy-failed', 2, [], { status: 'failed', complete: false })]) {
    db.prepare('INSERT INTO runs VALUES(?,?,?,?,?,?,?,?)').run(value.run_id, value.source_id, value.started_at,
      value.finished_at, value.status, Number(value.complete), JSON.stringify(value.scope), JSON.stringify(value));
  }
  for (const value of initial.jobs) {
    // Simulate Stage1's absent salary extensions, retaining exactly the original JSON and native IDs.
    for (const key of ['salary_kind', 'salary_pay_months', 'salary_20k_eligible', 'salary_source_fields']) delete value[key];
    db.prepare('INSERT INTO jobs VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(value.job_key, value.source_id, value.tenant,
      value.source_job_id, value.title, value.description_text, value.salary_raw, value.published_at, value.hiring_active,
      value.first_seen_at, value.last_seen_at, initial.run_id, JSON.stringify(value));
    db.prepare('INSERT INTO job_snapshots VALUES(?,?,?,?)').run(initial.run_id, value.job_key, value.content_sha256, JSON.stringify(value));
  }
  db.prepare('INSERT INTO requests VALUES(?,?,?,?,?,?,?,?,?,?)').run(initial.run_id, 1, COMPANY.board_url, 'GET', time(1),
    time(1), 200, 'test-only/legacy.json', 'test-only/legacy.html', '{"fixture":true}');
  const before = Object.fromEntries(['sources', 'runs', 'jobs', 'job_snapshots', 'requests']
    .map((table) => [table, plain(db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all())]));
  db.close();
  return before;
}

test('v1 migration in a temporary DB preserves all four legacy records byte-for-byte and seeds durable baselines', () => {
  const directory = mkdtempSync(join(tmpdir(), 'careers-stage2-migration-'));
  const path = join(directory, 'fixture.sqlite');
  let store;
  try {
    const before = legacyFixture(path);
    store = new CareersStore(path);
    assert.equal(store.db.prepare('PRAGMA user_version').get().user_version, 2);
    for (const [table, rows] of Object.entries(before)) assert.deepEqual(plain(store.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()), rows);
    assert.equal(store.listEvents({ event_type: 'baseline' }).length, 4);
    assert.equal(store.listJobs().length, 4);
    store.close();
    store = new CareersStore(path);
    assert.equal(store.listEvents().length, 4);
    const next = save(store, run('after-migration', 3, ['1', '2', '3', '4', '5'].map((id) => job(id, 3))));
    assert.equal(next.baseline_run_id, 'legacy-baseline');
    assert.deepEqual(next.events.map((event) => event.event_type), ['newly_observed']);
    assert.equal(next.jobs[0].first_seen_at, time(1));
    assert.match(store.haltedReason(COMPANY.source_id), /CHALLENGE_STOP/);
    assert.deepEqual(JSON.parse(store.db.prepare('SELECT normalized_json FROM job_snapshots WHERE run_id=? AND job_key=?')
      .get('legacy-baseline', job('1', 1).job_key).normalized_json), JSON.parse(before.job_snapshots[0].normalized_json));
  } finally { store?.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('future schema versions are not downgraded', () => {
  const directory = mkdtempSync(join(tmpdir(), 'careers-stage2-future-'));
  const path = join(directory, 'fixture.sqlite');
  try {
    const db = new DatabaseSync(path);
    db.exec('PRAGMA user_version=3; CREATE TABLE future_data(value TEXT); INSERT INTO future_data VALUES(\'retain\');');
    db.close();
    assert.throws(() => new CareersStore(path), /refusing to downgrade/);
    const check = new DatabaseSync(path, { readOnly: true });
    assert.equal(check.prepare('PRAGMA user_version').get().user_version, 3);
    assert.equal(check.prepare('SELECT value FROM future_data').get().value, 'retain');
    check.close();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

const salaries = [
  ['15-30K/月', {}, 15000, 30000, 'CNY', 'month', null, 'base_or_unspecified', true],
  ['18-19K/月', {}, 18000, 19000, 'CNY', 'month', null, 'base_or_unspecified', false],
  ['30-60K·16薪', {}, 30000, 60000, 'CNY', 'month', 16, 'base_or_unspecified', true],
  ['40-60万/年', {}, 400000, 600000, 'CNY', 'year', null, 'base_or_unspecified', false],
  ['1.5-3万元/月', {}, 15000, 30000, 'CNY', 'month', null, 'base_or_unspecified', true],
  ['1万元-2万元/月', {}, 10000, 20000, 'CNY', 'month', null, 'base_or_unspecified', true],
  ['20K-3万/月', {}, 20000, 30000, 'CNY', 'month', null, 'base_or_unspecified', true],
  ['USD 20-30K/month', {}, 20000, 30000, 'USD', 'month', null, 'base_or_unspecified', false],
  ['USD20-30K/月', {}, 20000, 30000, 'USD', 'month', null, 'base_or_unspecified', false],
  ['40-60万美元/年', {}, 400000, 600000, 'USD', 'year', null, 'base_or_unspecified', false],
  ['CHF20-30K/月', {}, 20000, 30000, 'CHF', 'month', null, 'base_or_unspecified', false],
  ['OTE 30-60K/月', {}, 30000, 60000, 'CNY', 'month', null, 'ote', false],
  ['提成30-60K/月', {}, 30000, 60000, 'CNY', 'month', null, 'commission', false],
  ['佣金2-3万元/月', {}, 20000, 30000, 'CNY', 'month', null, 'commission', false],
  ['200-300元/天', {}, 200, 300, 'CNY', 'day', null, 'base_or_unspecified', false],
  ['100-200元/小时', {}, 100, 200, 'CNY', 'hour', null, 'base_or_unspecified', false],
  ['CNY 20,000-30,000/month', {}, 20000, 30000, 'CNY', 'month', null, 'base_or_unspecified', true],
  ['20K', { currency: 'CNY', period: 'month' }, 20000, 20000, 'CNY', 'month', null, 'base_or_unspecified', true],
  ['15-30K/month', {}, 15000, 30000, null, 'month', null, 'base_or_unspecified', false],
  ['$20-30K/month', {}, 20000, 30000, null, 'month', null, 'base_or_unspecified', false],
  ['$20-30K/month', { currency: 'CAD' }, 20000, 30000, 'CAD', 'month', null, 'base_or_unspecified', false],
  ['15-30K', { currency: 'USD', period: 'year' }, 15000, 30000, 'USD', 'year', null, 'base_or_unspecified', false],
];
for (const [raw, hints, minimum, maximum, currency, period, months, kind, eligible] of salaries) {
  test(`salary parses native units: ${raw} ${JSON.stringify(hints)}`, () => {
    const result = parseSalary(raw, hints);
    assert.deepEqual(result, { salary_raw: raw, salary_currency: currency, salary_period: period, salary_min: minimum,
      salary_max: maximum, salary_pay_months: months, salary_kind: kind, salary_status: 'parsed', salary_20k_eligible: eligible });
  });
}

test('empty and undisclosed salaries are unknown, never zero or invented from provider context', () => {
  for (const raw of [null, undefined, '', ' ', '面议', '薪资面议', 'Negotiable', 'not disclosed']) {
    const result = parseSalary(raw, { currency: 'CNY', period: 'month' });
    assert.equal(result.salary_min, null);
    assert.equal(result.salary_max, null);
    assert.equal(result.salary_20k_eligible, false);
    assert.equal(result.salary_status, 'unknown_not_disclosed');
    assert.equal(result.salary_raw, raw ?? null);
  }
});

test('explicit currency and period conflicts with hints are ambiguous, never eligible', () => {
  for (const [raw, hints] of [
    ['USD20-30K/month', { currency: 'CNY' }], ['USD 20-30K/月', { currency: 'CNY', period: 'month' }],
    ['30-50万/年', { currency: 'CNY', period: 'month' }], ['40-60万/year', { period: 'month' }],
    ['CNY20-30K/month', { currency: 'USD' }], ['20-30K/月', { period: 'year' }],
    ['CNY USD 20-30K/month', { currency: 'CNY' }],
  ]) {
    const result = parseSalary(raw, hints);
    assert.equal(result.salary_status, 'ambiguous', `${raw} ${JSON.stringify(hints)}`);
    assert.equal(result.salary_20k_eligible, false);
    assert.equal(result.salary_min, null);
    assert.equal(result.salary_max, null);
  }
});

test('invalid ranges, infinity, exponents, multiple components and unknown units fail closed', () => {
  for (const raw of ['30-15K/月', '-15-30K/月', 'Infinity元/月', 'NaN元/月', '1e309-2e309元/月',
    `${'9'.repeat(400)}万元/月`, '30-60K·0薪', '15-20K + 10K佣金/月', '20K以上/月',
    '15-20-30K/月', '20', '20K/月 40万/年', '20K/月 13薪 16薪']) {
    const result = parseSalary(raw);
    assert.notEqual(result.salary_status, 'parsed', raw);
    assert.equal(result.salary_20k_eligible, false, raw);
    assert.equal(result.salary_min, null, raw);
    assert.equal(result.salary_max, null, raw);
  }
});

test('salary parser is deterministic and never mutates its hint input', () => {
  const hints = Object.freeze({ currency: 'CNY', period: 'month' });
  assert.deepEqual(parseSalary('15-30K', hints), parseSalary('15-30K', hints));
  assert.deepEqual(hints, { currency: 'CNY', period: 'month' });
});
