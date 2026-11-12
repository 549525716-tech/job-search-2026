import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const preferences = read('../config/preferences.json');
const companies = read('../config/company-discovery.json');

test('current preferences put salary opportunity then capability fit, preserving AI and no hard city filter', () => {
  assert.equal(preferences.ai_priority, true);
  assert.equal(preferences.management_priority, true);
  assert.equal(preferences.sustainable_tob_priority, true);
  assert.equal(preferences.management_only, false);
  assert.deepEqual(preferences.cities, []);
  assert.equal(preferences.salary.min_monthly_opportunity, 20000);
  assert.equal(preferences.salary.mode, 'advertised_monthly_range');
  assert.equal(preferences.salary.require_explicit_base_disclosure, false);
  assert.deepEqual(preferences.priority_order.slice(0,2), ['salary_opportunity','capability_match']);
  assert.equal(preferences.salary.min_advertised_upper, undefined);
  assert.equal(preferences.salary.keep_unknown_separate, true);
  assert.equal(preferences.match_batch_limit, 20);
});

test('selected applications require scoped consent while unimplemented drivers remain disabled', () => {
  const policy = read('../config/application-policy.json');
  const strategy = read('../config/career-strategy.json');
  assert.equal(policy.runtime.enabled, false);
  assert.equal(policy.runtime.schedule_enabled, false);
  assert.equal(policy.authorization.bookmark_is_consent, false);
  for (const key of ['company_id', 'source_job_id', 'jd_sha256', 'profile_sha256', 'recipient_origin', 'allowed_actions']) {
    assert(policy.authorization.required_bindings.includes(key));
  }
  assert.equal(policy.submission.retry_when_result_unknown, false);
  assert.equal(policy.quarantined_collection_adapter_may_be_reused, false);
  assert.equal(strategy.schedule.activated, false);
});

test('external actions and schedule stay disabled', () => {
  for (const key of ['no_auto_apply', 'no_auto_message', 'no_resume_upload', 'no_scheduler_until_acceptance']) {
    assert.equal(preferences[key], true, key);
  }
});

test('resume reuse has independent completeness and hard-gate guards', () => {
  assert.equal(preferences.reuse_resume_min_score, 80);
  assert.deepEqual(preferences.reuse_requires, ['complete_jd', 'all_hard_gates_resolved', 'same_positioning']);
  assert(preferences.removed_public_claims.length > 0);
});

test('the initial ten company discoveries are distinct and source-labelled', () => {
  assert.equal(companies.length, 10);
  assert.equal(new Set(companies.map((c) => c.id)).size, 10);
  for (const c of companies) {
    assert.equal(new URL(c.homepage).protocol, 'https:');
    assert.equal(new URL(c.careers_url).protocol, 'https:');
    assert(c.attribution_evidence.length > 0, c.id);
    assert(['verified', 'candidate', 'blocked', 'not_found'].includes(c.status));
  }
});

test('bilingual recall includes roles without the literal word sales', () => {
  for (const word of ['Business Builder', 'BD', 'KA', 'FDE', '售前', 'Business Operations']) {
    assert(preferences.role_keywords.includes(word), word);
  }
  assert(preferences.role_policy.excluded.includes('客户成功'));
});
