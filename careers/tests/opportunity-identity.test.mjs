import test from 'node:test';
import assert from 'node:assert/strict';
import { annotateOpportunities, groupOpportunities } from '../opportunity-identity.mjs';

const base = { company_id: 'company-a', company: '甲公司', title: '客户经理', city: '深圳', channel: 'boss', recruiter_id: 'hr-1' };
test('platform contact targets retain different companies, HRs and channels', () => {
  const rows = annotateOpportunities([base, { ...base }, { ...base, company_id: 'company-b' }, { ...base, recruiter_id: 'hr-2' }, { ...base, channel: 'liepin' }]);
  assert.equal(rows.length, 5);
  assert.equal(new Set(rows.map((job) => job.application_target_key)).size, 4);
  assert.ok(rows[1].duplicate_of);
  assert.equal(rows[3].duplicate_of, null);
});
test('unknown HR and display-name-only HR do not silently collapse separate opportunities', () => {
  for (const contact of [{ recruiter_id: null }, { recruiter_id: null, recruiter_name: '张女士' }]) {
    assert.equal(groupOpportunities([{ ...base, ...contact }, { ...base, ...contact }]).length, 2);
  }
});
test('official same native vacancy ignores HR but keeps different vacancies and tenants', () => {
  const official = { ...base, channel: 'official', tenant: 'a', source_job_id: '1' };
  const groups = groupOpportunities([official, { ...official, recruiter_id: 'hr-2', description_complete: true }, { ...official, source_job_id: '2' }, { ...official, tenant: 'b' }]);
  assert.equal(groups.length, 3);
  assert.equal(groups[0].observations.length, 2);
  assert.equal(groups[0].description_complete, true);
});
test('official detail URL groups repeated capture, not board pages, different cities without IDs or hash routes', () => {
  const official = { ...base, channel: 'official', link_kind: 'job_detail', job_url: 'https://example.com/jobs/1' };
  assert.equal(groupOpportunities([official, { ...official }]).length, 1);
  assert.equal(groupOpportunities([{ ...official, job_url: 'https://example.com/#/job/1' }, { ...official, job_url: 'https://example.com/#/job/2' }]).length, 2);
  assert.equal(groupOpportunities([{ ...official, board_url: official.job_url }, { ...official, board_url: official.job_url }]).length, 2);
  assert.equal(groupOpportunities([{ ...official, job_url: null }, { ...official, job_url: null, city: '北京' }]).length, 2);
});
test('unmarked shared list URL without board_url cannot prove a unique vacancy', () => {
  const listing = { ...base, channel: 'official', job_url: 'https://ats.example/jobs' };
  assert.equal(groupOpportunities([{ ...listing, description: '销售云产品' }, { ...listing, description: '销售存储产品' }]).length, 2);
});
test('unknown channels are admissible observations, not an allowed-source whitelist', () => {
  const jobs = annotateOpportunities([{ company: '甲公司', title: '岗位', channel: 'industry_association_news' }]);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].channel_family, 'industry_association_news');
  assert.equal(jobs[0].duplicate_status, 'identity_pending');
});
test('opaque source identities remain case-sensitive and structured employers cannot stringify into equality', () => {
  assert.equal(groupOpportunities([{ ...base, recruiter_id: 'HR1' }, { ...base, recruiter_id: 'hr1' }]).length, 2);
  assert.equal(groupOpportunities([{ ...base, company_id: 'Org1' }, { ...base, company_id: 'org1' }]).length, 2);
  const official = { ...base, channel: 'official', tenant: 'a' };
  assert.equal(groupOpportunities([{ ...official, source_job_id: 'A1' }, { ...official, source_job_id: 'a1' }]).length, 2);
  const unnamed = { ...base, company_id: undefined };
  assert.equal(groupOpportunities([{ ...unnamed, company: { name: '甲公司' } }, { ...unnamed, company: { name: '乙公司' } }]).length, 2);
  assert.equal(groupOpportunities([{ ...unnamed, company: {} }, { ...unnamed, company: {} }]).length, 2);
});
