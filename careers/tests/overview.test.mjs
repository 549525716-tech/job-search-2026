import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOverview, renderOverviewHTML, renderOverviewCSV, renderOverviewMarkdown, csvCell, recallJob } from '../overview.mjs';
import { parseSalary } from '../salary.mjs';

const preferences = { role_keywords: ['销售', 'Business Builder', 'BD', '售前', 'FDE'] };
const company = { id: 'test-ai', name: 'Test AI', ai_related: true, sector: 'AI', homepage: 'https://example.com', careers_url: 'https://example.com/jobs' };
const job = { job_key: 'test:1', company_id: 'test-ai', source_id: 'test-source', company_name: 'Test AI', title: 'Business Builder',
  description_text: '客户商业化', location_raw: '上海', salary_raw: null, hiring_active: 'unknown',
  job_url: 'https://example.com/jobs/1', source_job_id: '1', description_complete: true, first_seen_at: '2026-09-09', last_seen_at: '2026-09-09' };
const goodRun = { run_id: '1', source_id: 'test-source', company_id: 'test-ai', started_at: '2026-09-09T01:00:00Z', finished_at: '2026-09-09T01:01:00Z', status: 'success', complete: true, ownership: { status: 'verified' }, errors: [] };

test('fixed-base views override the historical upper-bound flag without mutating source facts', () => {
  const salary = { mode: 'fixed_monthly_base_minimum', currency: 'CNY', period: 'month', min_fixed_monthly_base: 20000 };
  const jobs = ['15-30K/月', '20-30K/月', '固定底薪20-30K/月', '固定底薪18-19K/月'].map((raw, index) => ({
    ...job, job_key: `pay:${index}`, ...parseSalary(raw, { currency: 'CNY' }),
  }));
  const data = buildOverview({ jobs, companies: [company], runs: [], preferences: { ...preferences, salary } });
  assert.equal(data.summary.salary_candidates, 1);
  assert.equal(data.summary.unknown_salary_candidates, 2);
  assert.equal(jobs[0].salary_20k_eligible, true);
  assert.equal(data.jobs.find((row) => row.job_key === 'pay:0').salary_20k_eligible, false);
  assert.equal(data.jobs.find((row) => row.job_key === 'pay:0').salary_legacy_20k_eligible, true);
  assert(renderOverviewMarkdown(data).includes('固定月薪20K+'));
  assert(renderOverviewCSV(data).includes('salary_target_reason'));
});

test('role policy recalls commercial roles and excludes exploratory FDE by default', () => {
  assert.equal(recallJob(job, preferences), true);
  assert.equal(recallJob({ title: 'NLP算法实习生', description_text: '参与客户销售支持' }, preferences), false);
  assert.equal(recallJob({ title: 'FDE', description_text: 'Python生产交付' }, preferences), false);
  assert.equal(recallJob({ ...job, hiring_active: 'closed' }, preferences), false);
  assert.equal(recallJob({ ...job, hiring_active: 'missing_pending_review' }, preferences), false);
});

test('unknown salaries are separate from 20K and failed sources are not empty', () => {
  const data = buildOverview({ jobs: [job], companies: [company, { ...company, id: 'unscanned' }], preferences,
    runs: [goodRun, { ...goodRun, run_id: '2', status: 'failed', started_at: '2026-09-09T02:00:00Z', errors: [{ code: 'HTTP_ACCESS_STOP', message: '403' }] }] });
  assert.equal(data.summary.salary_candidates, 0);
  assert.equal(data.summary.unknown_salary_candidates, 1);
  assert.equal(data.summary.incomplete_sources, 1);
  assert.equal(data.summary.unscanned_sources, 1);
  assert.equal(data.jobs[0].source_stale_warning, true);
});

test('group jobs are not all relabelled as AI jobs', () => {
  const data = buildOverview({ jobs: [{ ...job, company_id: 'tencent-cloud', title: '游戏广告销售', description_text: '负责游戏广告客户' }],
    companies: [{ ...company, id: 'tencent-cloud' }], runs: [], preferences });
  assert.equal(data.jobs[0].candidate, true);
  assert.equal(data.jobs[0].ai_related, false);
});
test('new employer with explicit AI JD enters AI view without belonging to the old company seed list', () => {
  const data = buildOverview({ jobs: [{ ...job, company_id: 'new-company', company_name: '新发现公司', title: 'AI销售', description_text: '销售企业大模型服务。' }],
    companies: [], runs: [], preferences, discovery: { companies: [{ queue_id: 'queue-new', company_name: '新发现公司', status: 'needs_verification' }] } });
  assert.equal(data.jobs[0].views.includes('ai'), true);
  assert.equal(data.jobs[0].tier_verified, false);
  assert.ok(data.companies.some((company) => company.id === 'queue-new'));
});

test('overview annotates every raw observation without replacing identity fields', () => {
  const data = buildOverview({ jobs: [job, { ...job, job_key: 'test:2', source_job_id: '2', title: 'Business Builder 2' }], companies: [company], runs: [], preferences });
  assert.equal(data.jobs.length, 2);
  for (const row of data.jobs) {
    assert(row.vacancy_group_key);
    assert(row.application_target_key);
    assert.equal(row.channel_family, 'unknown');
    assert('identity_basis' in row && 'vacancy_group_status' in row);
    assert(row.views.includes('raw'));
  }
  assert.equal(data.summary.raw_jobs, 2);
});

test('untrusted JD and unsafe URLs stay inert in HTML and CSV', () => {
  const data = buildOverview({ jobs: [{ ...job, title: '=HYPERLINK("evil")', description_text: '<script>alert(1)</script>', job_url: 'javascript:alert(1)' }], companies: [company], runs: [], preferences });
  const html = renderOverviewHTML(data);
  assert(!html.includes('<script>alert(1)</script>'));
  assert(!html.includes('href="javascript:'));
  assert(html.includes('&lt;script&gt;'));
  assert(renderOverviewCSV(data).includes("'=HYPERLINK"));
  assert.equal(csvCell('  =1+1'), '"\'  =1+1"');
});

test('source health honors actual UTC ordering, completeness and a retained access halt', () => {
  const earlier = { ...goodRun, run_id: 'old', started_at: '2026-09-09T10:00:00+08:00', status: 'failed', complete: false };
  const later = { ...goodRun, run_id: 'new', started_at: '2026-09-09T03:00:00Z' };
  let data = buildOverview({ jobs: [job], companies: [company], preferences, runs: [earlier, later] });
  assert.equal(data.companies[0].last_run_id, 'new');
  assert.equal(data.summary.complete_sources, 1);
  data = buildOverview({ jobs: [job], companies: [company], preferences, runs: [{ ...later, complete: false }] });
  assert.equal(data.summary.complete_sources, 0);
  assert.equal(data.jobs[0].source_stale_warning, true);
  data = buildOverview({ jobs: [job], companies: [company], preferences, runs: [later], sources: [{ source_id: job.source_id, halted_reason: 'HTTP403' }] });
  assert.equal(data.summary.complete_sources, 0);
  assert.equal(data.jobs[0].source_health, 'blocked');
});

test('closed records remain explicit and Markdown URLs cannot escape link syntax', () => {
  const data = buildOverview({ jobs: [{ ...job, hiring_active: 'closed', job_url: 'https://example.invalid/)[INJECTED](javascript:alert%281%29)' }], companies: [company], preferences, runs: [goodRun] });
  assert(renderOverviewHTML(data).includes('已关闭'));
  assert.equal(data.jobs[0].candidate, false);
  assert(!renderOverviewMarkdown(data).includes(')[INJECTED]('));
});

test('renders market-lead and headhunter contracts without overstating evidence', () => {
  const html = renderOverviewHTML({
    ...buildOverview({ jobs: [], companies: [], runs: [], preferences }),
    market_leads: { summary: { total: 1 }, notice: '来自搜索索引，不代表在线在招核验。', leads: [{
      company_name: '线索公司', title: 'AI销售', salary_raw: '20-35K', job_url: null, source_url: 'https://example.com/search',
      evidence_status: 'search_index_only', salary_target: { status: 'pending', label: '固定底薪待核', reason: '未披露底薪' }, role_fit: { category: '销售与大客户', reason: '待核' }, risks: [], evidence: { path: 'raw/lead.json' },
    }] },
    headhunter: { status: 'complete', summary: '综合研判摘要', decisions: [{ title: '方向', conclusion: '优先销售运营', evidence: ['事实证据'] }], roles: [], not_run: [], questions: [], report_path: 'reports/headhunter.json' },
  });
  assert(html.includes('薪资线索') && html.includes('20-35K') && html.includes('固定底薪待核'));
  assert(html.includes('来源页：') && !html.includes('职位直链'));
  assert(html.includes('猎头研判') && html.includes('综合研判摘要') && html.includes('优先销售运营'));
});
