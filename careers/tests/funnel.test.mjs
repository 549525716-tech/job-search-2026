import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFunnel, validateFunnelConfig } from '../funnel.mjs';

const clone = (value) => structuredClone(value);

const config = {
  schema_version: 1,
  scope: 'offline-test-fixture',
  policies: [{ id: 'p1', document_id: 'doc-policy', title: '政策一', authority: '主管部门', document_kind: '通知', excerpt: '政策原文摘录' }],
  industries: [{ id: 'i1', name: '企业AI', policy_ids: ['p1'], demand_hypothesis: '需求假设', limitations: [] }],
  companies: [{ id: 'c1', name: '测试公司', document_id: 'doc-company', industry_ids: ['i1'], business_excerpt: '公司业务摘录', tier: '候选', tier_basis: 'fixture', notes: [] }],
  opportunities: [
    { job_key: 'job-ready', company_id: 'c1' },
    { job_key: 'job-pending-salary', company_id: 'c1' },
    { job_key: 'job-closed', company_id: 'c1' },
    { job_key: 'job-stale', company_id: 'c1' },
    { job_key: 'job-failed-jd', company_id: 'c1' },
    { job_key: 'job-unknown-gate', company_id: 'c1' },
    { job_key: 'job-defer-resume', company_id: 'c1' },
  ],
};

const researchState = {
  schema_version: 1,
  documents: {
    'doc-policy': { last_attempt: { status: 'captured', observation_kind: 'baseline' }, last_good: { id: 'doc-policy', url: 'https://evidence.test/policy', body_path: '01_行情收集/official-careers/raw/policy.body', metadata_path: '01_行情收集/official-careers/raw/policy.json', sha256: 'policy-sha', observed_at: '2026-09-10T00:00:00Z', text: '政策原文摘录及其他正文' } },
    'doc-company': { last_attempt: { status: 'captured', observation_kind: 'baseline' }, last_good: { id: 'doc-company', url: 'https://evidence.test/company', body_path: '01_行情收集/official-careers/raw/company.body', metadata_path: '01_行情收集/official-careers/raw/company.json', sha256: 'company-sha', observed_at: '2026-09-10T00:00:00Z', text: '公司业务摘录及其他正文' } },
  },
  halted_origins: {},
};

const goodAnalysis = (overrides = {}) => ({ semantic_review_status: 'approved', hard_gate_review_complete: true, hard_gates: [{ requirement: '固定月薪', status: 'met' }], resume_action: 'tailor', verdict: '匹配', role_mission: '解决业务问题', resume_advice: '保留证据', direct_evidence: [{ requirement: '销售', explanation: '直接证据' }], transferable_evidence: [], gaps: [], questions: [], ...overrides });

function job(job_key, overrides = {}) {
  const eligibleSalary = { salary_raw: '固定底薪25K/月', status: 'parsed', currency: 'CNY', period: 'month', min: 25000, max: 25000, kind: 'base_or_unspecified' };
  return { job_key, company_id: 'c1', company_name: '测试公司', title: job_key, location_raw: '上海', description_text: `JD ${job_key}`, description_complete: true,
    job_url: `https://jobs.test/${job_key}`, application_url: 'mailto:jobs@test.example', source_job_id: job_key, published_at: '2026-09-01', published_at_raw: '2026-09-01',
    last_seen_at: '2026-09-10T00:00:00Z', source_checked_at: '2026-09-10T00:00:00Z', source_health: 'success', source_stale_warning: false, hiring_active: 'open',
    analysis: goodAnalysis(), ...eligibleSalary, ...overrides };
}

function overviewFixture(overrides = {}) {
  const jobs = [
    job('job-ready'),
    job('job-pending-salary', { salary_raw: null, status: 'missing', currency: null, period: null, min: null, max: null, kind: null }),
    job('job-closed', { hiring_active: 'closed' }),
    job('job-stale', { source_stale_warning: true, source_health: 'failed' }),
    job('job-failed-jd'),
    job('job-unknown-gate', { analysis: goodAnalysis({ hard_gates: [{ requirement: '在招状态', status: 'unknown' }] }) }),
    job('job-defer-resume', { analysis: goodAnalysis({ resume_action: 'defer' }) }),
  ];
  return { preferences_version: 'prefs-v1', salary_target_rule: { mode: 'fixed_monthly_base_minimum', currency: 'CNY', period: 'month', min_fixed_monthly_base: 20000 },
    companies: [{ id: 'c1', name: '测试公司', careers_url: 'https://jobs.test/careers' }], runs: [], jobs, ...overrides };
}

function makeVerifyDocument({ fail = false, quoteMissing = false } = {}) {
  return async (document) => {
    if (fail) throw new Error('document verification failed');
    return { ...document, text: quoteMissing ? '其他正文' : document.text, observed_at: document.observed_at };
  };
}

function makeVerifyJob({ failKeys = [], evidenceSuffix = 'v1' } = {}) {
  return async (job) => {
    if (failKeys.includes(job.job_key)) throw new Error('JD fixture verification failed');
    return [{ url: job.job_url, body_path: `01_行情收集/official-careers/raw/${job.job_key}.body`, metadata_path: `01_行情收集/official-careers/raw/${job.job_key}.json`, sha256: `${job.job_key}-${evidenceSuffix}`, captured_at: job.last_seen_at }];
  };
}

async function build(overrides = {}) {
  return buildFunnel({ config: clone(config), researchState: clone(researchState), overview: overviewFixture(), generatedAt: '2026-09-10T00:00:00.000Z',
    verifyDocument: makeVerifyDocument(), verifyJob: makeVerifyJob(), ...overrides });
}

test('rejects broken references and duplicate keys before building', () => {
  assert.throws(() => validateFunnelConfig({ ...clone(config), opportunities: [{ job_key: 'job-ready', company_id: 'missing-company' }] }), /Broken funnel reference/);
  assert.throws(() => validateFunnelConfig({ ...clone(config), opportunities: [{ job_key: 'duplicate', company_id: 'c1' }, { job_key: 'duplicate', company_id: 'c1' }] }), /duplicate/);
  assert.throws(() => validateFunnelConfig({ ...clone(config), policies: [{ id: 'p1', document_id: 'doc-policy' }, { id: 'p1', document_id: 'doc-policy-2' }] }), /duplicate/);
});

test('isolates missing policy evidence and quote mismatch without inventing a traceable chain', async () => {
  const missing = await build({ verifyDocument: makeVerifyDocument({ fail: true }) });
  assert.equal(missing.policies[0].evidence_verified, false);
  assert.equal(missing.opportunities[0].traceable, false);
  assert(missing.issues.some((issue) => issue.id === 'doc-policy' && issue.status === 'unverified'));

  const quoteMismatch = await build({ verifyDocument: makeVerifyDocument({ quoteMissing: true }) });
  assert(quoteMismatch.issues.some((issue) => issue.id === 'doc-policy' && /Exact quote/.test(issue.reason)));
  assert.equal(quoteMismatch.companies[0].evidence_verified, false);
  assert.equal(quoteMismatch.opportunities[0].traceable, false);
});

test('isolates JD evidence failure, keeps pending salary ineligible, and blocks closed jobs from ready', async () => {
  const result = await build({ verifyJob: makeVerifyJob({ failKeys: ['job-failed-jd'] }) });
  const byKey = Object.fromEntries(result.opportunities.map((item) => [item.job_key, item]));
  assert.equal(byKey['job-failed-jd'].traceable, false);
  assert(result.issues.some((issue) => issue.id === 'job-failed-jd' && issue.status === 'evidence_failed'));
  assert.equal(byKey['job-pending-salary'].salary_target.eligible, false);
  assert.equal(byKey['job-pending-salary'].recommendation_status, 'exploratory_or_pending');
  assert.equal(byKey['job-closed'].recommendation_status, 'exploratory_or_pending');
  assert.equal(byKey['job-ready'].recommendation_status, 'ready_for_user_review');
});

test('unknown hard gates and deferred resume actions cannot become ready', async () => {
  const result = await build();
  const byKey = Object.fromEntries(result.opportunities.map((item) => [item.job_key, item]));
  assert.equal(byKey['job-unknown-gate'].recommendation_status, 'exploratory_or_pending');
  assert.equal(byKey['job-defer-resume'].recommendation_status, 'exploratory_or_pending');
});

test('retains a valid historical JD when the source is stale, but does not mark it ready', async () => {
  const result = await build();
  const stale = result.opportunities.find((item) => item.job_key === 'job-stale');
  assert.equal(stale.traceable, true);
  assert.equal(stale.source_health, 'failed');
  assert.equal(stale.recommendation_status, 'exploratory_or_pending');
});

test('input digest is stable for identical input and changes with preferences, analysis, or evidence', async () => {
  const first = await build();
  const second = await build();
  assert.equal(first.input_digest, second.input_digest);

  const preferenceChanged = await build({ overview: { ...overviewFixture(), preferences_version: 'prefs-v2' } });
  assert.notEqual(first.input_digest, preferenceChanged.input_digest);

  const analysisChanged = await build({ overview: overviewFixture({ jobs: overviewFixture().jobs.map((item) => item.job_key === 'job-ready' ? { ...item, analysis: goodAnalysis({ verdict: '变化后的评估' }) } : item) }) });
  assert.notEqual(first.input_digest, analysisChanged.input_digest);

  const evidenceChanged = await build({ verifyJob: makeVerifyJob({ evidenceSuffix: 'v2' }) });
  assert.notEqual(first.input_digest, evidenceChanged.input_digest);
});
