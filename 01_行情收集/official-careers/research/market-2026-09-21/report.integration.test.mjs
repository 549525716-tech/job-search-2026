import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';

const here = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(here, '../../../..');
const json = async p => JSON.parse(await readFile(p, 'utf8'));
const report = await json(join(root, '01_行情收集/official-careers/reports/decision-review.json'));
const current = await json(join(here, 'current-jobs.json'));
const previous = await json(join(here, 'carried-forward-jobs.json'));
const rows = report.groups.flatMap(g=>g.jobs);
const latest = rows.filter(j=>j.latest_collection);

test('latest view separates new observations from carried-forward cards', () => {
  assert.equal(current.length, 81);
  assert.equal(previous.length, 40);
  assert.equal(latest.length, current.length);
  assert.ok(latest.every(j=>j.evidence_file.includes('/market-2026-09-21/raw/')));
  assert.ok(previous.every(j=>j.observed_at.startsWith('2026-09-20')));
  assert.equal(rows.length, report.counts.observations);
});
test('all current sources bind to preserved bytes and four Hoteam pages', async () => {
  for (const job of current) {
    const bytes = await readFile(resolve(root, job.evidence_file));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), job.evidence_sha256);
  }
  const hoteam = current.filter(j=>j.company==='华天软件');
  assert.equal(hoteam.length, 28);
  assert.equal(new Set(hoteam.map(j=>j.id)).size, 28);
  for (const name of ['o16.json','o17.json','o18.json','o19r.json']) {
    assert.equal(hoteam.filter(j=>j.evidence_file.endsWith('/'+name)).length, 7);
  }
});
test('incomplete JD stays unscored and salary range never becomes fixed pay', () => {
  assert.ok(latest.filter(j=>!j.description_complete).every(j=>!j.assessment));
  assert.ok(latest.filter(j=>!j.salary_raw).every(j=>!j.salary_opportunity.eligible));
  assert.ok(latest.every(j=>!j.salary_opportunity.fixed_base.eligible));
  assert.ok(latest.find(j=>j.company==='妙蛙 GEO').salary_opportunity.eligible);
  assert.ok(latest.find(j=>j.company==='联想懂的通信').salary_opportunity.pending);
});
test('new assessments keep gates, total weight and non-probability boundary', () => {
  const scored = latest.filter(j=>j.assessment);
  assert.equal(scored.length, 4);
  for (const {assessment:a} of scored) {
    assert.equal(a.result.dimensions.reduce((n,d)=>n+d.weight,0),100);
    assert.equal(a.result.score,Math.round(a.result.dimensions.reduce((n,d)=>n+d.contribution,0)*10)/10);
    assert.ok(a.hard_gate_review_complete);
    assert.equal(a.result.resume_reuse_eligible,false);
  }
  assert.equal(report.delivery_acceptance.status,'not_accepted');
  assert.equal(report.external_actions,0);
  assert.equal(report.collection.scheduler_enabled,false);
});
