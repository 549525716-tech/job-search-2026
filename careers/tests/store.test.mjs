import test from 'node:test';
import assert from 'node:assert/strict';
import { CareersStore } from '../store.mjs';
import { normalizeJob } from '../normalize.mjs';

const company = { source_id: 'test-source', company_id: 'test-company', company_name: 'Test', tenant: 'test', legal_name: 'Test', board_url: 'https://example.com/jobs', provider: 'test' };
function run(id, timestamp, jobs = [], status = 'success', complete = true) {
  return { run_id: id, source_id: company.source_id, company_id: company.company_id, started_at: timestamp, finished_at: timestamp,
    status, complete, scope: { kind: 'official_board', board_url: company.board_url, query: null, company_wide: false, closure_eligible: false },
    jobs, evidence: [], errors: [], ownership: { status: 'verified', chain: [] } };
}
function job(id, timestamp, title = '客户经理') {
  return normalizeJob({ source_job_id: id, title, location_raw: '广州', published_raw: '2025-01-01',
    responsibilities: '客户经营', requirements: '相关经验', description_text: '岗位职责\n客户经营\n任职要求\n相关经验' }, company,
  { finished_at: timestamp, url: company.board_url });
}
function save(store, value) { store.beginRun(value, company); store.finishRun(value); }

test('repeated observations preserve first seen and do not duplicate native jobs', () => {
  const store = new CareersStore(':memory:');
  try {
    const first = '2026-09-09T01:00:00Z';
    const second = '2026-09-09T02:00:00Z';
    save(store, run('run-1', first, [job('42', first)]));
    save(store, run('run-2', second, [job('42', second)]));
    assert.equal(store.db.prepare('SELECT count(*) AS n FROM jobs').get().n, 1);
    assert.equal(store.db.prepare('SELECT count(*) AS n FROM job_snapshots').get().n, 2);
    assert.equal(store.readRun('run-2').jobs[0].first_seen_at, first);
    assert.equal(store.readRun('run-2').jobs[0].last_seen_at, second);
  } finally { store.close(); }
});

test('failed or incomplete observations cannot delete old jobs', () => {
  const store = new CareersStore(':memory:');
  try {
    const first = '2026-09-09T01:00:00Z';
    save(store, run('run-1', first, [job('42', first)]));
    save(store, run('run-2', '2026-09-09T02:00:00Z', [], 'failed', false));
    save(store, run('run-3', '2026-09-09T03:00:00Z', [], 'partial', false));
    const persisted = store.db.prepare('SELECT * FROM jobs').get();
    assert.equal(persisted.last_seen_at, first);
    assert.equal(persisted.hiring_active, 'unknown');
    assert.equal(store.db.prepare('SELECT count(*) AS n FROM jobs').get().n, 1);
  } finally { store.close(); }
});

test('same titles with different source IDs survive independently', () => {
  const store = new CareersStore(':memory:');
  try {
    const time = '2026-09-09T01:00:00Z';
    save(store, run('run-1', time, [job('42', time), job('43', time)]));
    assert.equal(store.db.prepare('SELECT count(*) AS n FROM jobs').get().n, 2);
  } finally { store.close(); }
});
