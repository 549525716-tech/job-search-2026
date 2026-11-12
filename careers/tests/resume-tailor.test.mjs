import test from 'node:test';
import assert from 'node:assert/strict';
import { resumeJobText, buildResumeTask } from '../resume-task.mjs';
import { planApplications } from '../application-planner.mjs';

const timeFields = ['observed_at', 'fetched_at', 'last_seen_at'];
const taskFor = timestamps => buildResumeTask({ description_text: 'Full JD', description_complete: true, ...timestamps },
  { path: 'profile', sha256: 'x' }, { target_key: 'y' });

test('tailoring includes separately stored requirements, without duplication', () => {
  assert.equal(resumeJobText({ description: '职责', requirements: '3年云销售' }), '职责\n\n3年云销售');
  assert.equal(resumeJobText({ description_text: '职责\n3年云销售', requirements: '3年云销售' }), '职责\n3年云销售');
});

test('a JD requirements update changes the frozen task hash', () => {
  const make = requirements => buildResumeTask({ description: '负责销售', requirements, description_complete: true }, { path: 'profile', sha256: 'x' }, { target_key: 'y' });
  assert.notEqual(make('本科').input.jd_sha256, make('本科且3年云销售').input.jd_sha256);
  assert.equal(make('本科').input.jd_text_untrusted, '负责销售\n\n本科');
});

for (const field of timeFields) {
  test(`task source preserves ${field} without relabelling other observation times`, () => {
    const timestamp = '2026-10-18T09:00:00+08:00';
    const task = taskFor({ [field]: timestamp });
    for (const other of timeFields) assert.equal(task.source[other], other === field ? timestamp : null);
    assert.equal(task.input.jd_sha256, taskFor({}).input.jd_sha256);
  });
}

test('distinct observation timestamps retain their raw values and semantics', () => {
  const times = Object.freeze({ observed_at: '2026-10-08T00:00:00Z', fetched_at: '2026-10-18T09:00:00+08:00',
    last_seen_at: '2026-10-19T00:00:00Z' });
  const task = taskFor(times);
  for (const field of timeFields) assert.equal(task.source[field], times[field]);
});

test('missing observation timestamps stay null even when a publication date exists', () => {
  for (const job of [{}, { published_at: '2026-10-18T00:00:00Z' },
    { observed_at: null, fetched_at: null, last_seen_at: null, published_at: '2026-10-18T00:00:00Z' }]) {
    const task = taskFor(job);
    for (const field of timeFields) assert.equal(task.source[field], null);
  }
});

test('invalid or empty source timestamps remain evidence, not fabricated valid times', () => {
  for (const field of timeFields) for (const value of ['invalid-date', '']) {
    const task = taskFor({ [field]: value, published_at: '2026-10-18T00:00:00Z' });
    for (const other of timeFields) assert.equal(task.source[other], other === field ? value : null);
  }
});

test('planner-selected observed_at-only revisions retain source observation time in their task', () => {
  const make = (observed_at, description_text, description_complete = true) => ({ observed_at, description_text, description_complete,
    title: 'Sales', application_identity: { kind: 'official', channel: 'official', employer_id: 'E1', tenant_id: 'T1',
      requisition_id: 'R1', contact_status: 'verified_contact', publisher_id: 'HR1', verified: true, evidence_ref: 'fixture://identity' } });
  const old = make('2026-10-08T00:00:00Z', 'Old full JD');
  for (const complete of [true, false]) {
    const latest = make('2026-10-18T00:00:00Z', 'New JD', complete);
    for (const jobs of [[old, latest], [latest, old]]) {
      const report = planApplications(jobs, 'candidate-1', { path: 'profile', sha256: 'x' });
      const winner = report.items.find(item => item.status === (complete ? 'resume_task_pending' : 'jd_pending'));
      assert(winner);
      assert.equal(winner.resume_task.input.jd_text_untrusted, latest.description_text);
      assert.equal(winner.resume_task.source.observed_at, latest.observed_at);
      assert.equal(winner.resume_task.source.fetched_at, null);
      assert.equal(winner.resume_task.source.last_seen_at, null);
      assert.equal(report.external_actions, 0);
      assert.equal(winner.ready_to_submit, false);
    }
  }
});
