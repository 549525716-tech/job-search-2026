import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { repoRelative } from '../paths.mjs';
import { buildSweepReport, csvCell, renderSweepReportHTML, renderSweepReportCSV, loadSweepInput, writeSweepReport } from '../sweep-report.mjs';

const baseJob = (overrides = {}) => ({ id: 'j1', company: '测试 <公司>', title: 'AI销售', city: '上海', location: '上海', salary_raw: '=20-30K', job_url: 'https://example.com/jobs/1', apply_url: 'https://example.com/apply/1', source_url: 'https://example.com/jobs/1', source_kind: 'official', description_complete: true, description: '职责 <script>alert(1)</script>', requirements: '要求：企业销售经验', observed_at: '2026-09-11T00:00:00Z', published_at: '2026-09-01', time_note: '首次发现', evidence_file: '01_行情收集/official-careers/research/test/raw/open.json', evidence_quote: '岗位详情 https://example.com/jobs/1', ownership_note: '官方归属待独立确认', scope_note: '本轮广扫', ...overrides });
function fixture({ jobs = [baseJob()], analysis = null, raw = null } = {}) { return { input_dir: '01_行情收集/official-careers/research/test', jobs, coverage: [{ company: '测试公司', attempted: true, status: 'success', job_count: jobs.length }], run: { observed_at: '2026-09-11T00:00:00Z', status: 'complete' }, analysis: analysis ?? { status: 'absent', invalid: [] }, jobs_sha256: 'hash' }; }

test('HTML escapes XSS and CSV prevents formula injection', () => {
  const data = buildSweepReport(fixture());
  const html = renderSweepReportHTML(data);
  assert(!html.includes('<script>alert(1)</script>'));
  assert(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert(renderSweepReportCSV(data).includes("'=20-30K"));
  assert.equal(csvCell('  =1+1'), '"\'  =1+1"');
});

test('a valid batch cannot mark unanalysed CSV jobs as analysed', () => {
  const data = buildSweepReport(fixture({ analysis: { status: 'valid', byJob: new Map(), invalid: [] } }));
  assert.match(renderSweepReportCSV(data), /"待分析"/);
  assert.doesNotMatch(renderSweepReportCSV(data), /,"valid"\r\n/);
});

test('search-index evidence cannot become a full JD and salary stays pending', () => {
  const data = buildSweepReport(fixture({ jobs: [baseJob({ source_kind: 'search_index' })] }));
  assert.equal(data.jobs[0].description_complete, false);
  assert.match(data.jobs[0].completeness_note, /搜索索引/);
  assert.equal(data.jobs[0].fixed_salary_status, '待核');
  assert.equal(data.counts.complete, 0);
});

test('salary confirmation requires a bound same-job quote and ignores synthetic eligibility flags', () => {
  const job = baseJob({ salary_raw: '固定底薪25-30K/月', salary_20k_eligible: true, salary_evidence_quote: 'AI销售 固定底薪25-30K/月' });
  const evidence = new Map([[job.evidence_file, { result: { content: [{ type: 'text', text: 'AI销售 固定底薪25-30K/月' }] } }]]);
  const data = buildSweepReport({ ...fixture({ jobs: [job] }), evidence });
  assert.equal(data.jobs[0].fixed_salary_status, '已确认');
  assert.equal(data.counts.salary_confirmed, 1);
  const unbound = buildSweepReport({ ...fixture({ jobs: [baseJob({ salary_raw: '固定底薪25-30K/月', salary_20k_eligible: true })] }), evidence });
  assert.equal(unbound.jobs[0].fixed_salary_status, '待核');
  assert.equal(unbound.jobs[0].salary_target.status, 'salary_evidence_unbound');
});

test('same official vacancy groups presentation while all observations remain in JSON and CSV', () => {
  const data = buildSweepReport(fixture({ jobs: [baseJob({ link_kind: 'job_detail' }), baseJob({ id: 'j2', link_kind: 'job_detail' })] }));
  assert.equal(data.jobs.length, 1);
  assert.equal(data.observations.length, 2);
  assert.equal(data.jobs[0].observation_count, 2);
  assert.ok(renderSweepReportCSV(data).includes('"j2"'));
  assert.equal(data.jobs[0].city, '上海');
  const unknown = buildSweepReport(fixture({ jobs: [baseJob({ job_url: '', city: '', location: '' })] }));
  assert.equal(unknown.jobs[0].city, '');
});
test('standard description_text remains searchable and visible in sweep output', () => {
  const data = buildSweepReport(fixture({ jobs: [baseJob({ title: '特别人才', description: undefined, description_text: '负责企业客户经营、合同谈判及销售收入目标。' })] }));
  assert.equal(data.jobs[0].role_fit.review_required, true);
  assert.ok(data.jobs[0].search_text.includes('合同谈判'));
  assert.ok(renderSweepReportHTML(data).includes('负责企业客户经营、合同谈判及销售收入目标。'));
});

test('different companies or platform HRs cannot disappear through shared title or URL', () => {
  const data = buildSweepReport(fixture({ jobs: [baseJob(), baseJob({ company: '其他公司' }), baseJob({ source_kind: 'recruitment_platform', channel: 'boss', recruiter_id: 'a' }), baseJob({ source_kind: 'recruitment_platform', channel: 'boss', recruiter_id: 'b' })] }));
  assert.equal(data.jobs.length, 4);
  assert.equal(buildSweepReport(fixture({ jobs: [baseJob(), baseJob({ job_url: 'https://example.com/jobs/1#x' })] })).jobs.length, 2);
});

test('body text is searchable and unfamiliar commercial titles reach review, other channels stay retained', () => {
  const data = buildSweepReport(fixture({ jobs: [baseJob({ title: 'Customer Value Lead', description: '负责企业客户商机管道、合同谈判及销售收入目标。', source_kind: 'industry_news', description_complete: false })] }));
  assert.equal(data.jobs.length, 1);
  assert.equal(data.jobs[0].role_fit.review_required, true);
  assert.ok(data.jobs[0].search_text.includes('合同谈判'));
  assert.ok(renderSweepReportHTML(data).includes('其他来源（待核）'));
});

test('analysis cache expires when jobs hash is missing or mismatched', () => {
  const job = baseJob({ id: 'j1' });
  const analysis = { schema_version: 1, input_sha256: 'wrong', execution: { model: 'GPT6' }, priorities: [{ job_id: 'j1', priority: '优先核实', job_quotes: ['职责 <script>alert(1)</script>'] }] };
  const data = buildSweepReport(fixture({ jobs: [job], analysis: { status: 'expired', invalid: ['input_sha256 missing or does not match jobs.json'] } }));
  assert.equal(data.analysis.status, 'expired');
  assert.equal(data.jobs[0].analysis, null);
  assert.equal(analysis.schema_version, 1);
});

test('rejects paths outside the research namespace', async () => {
  await assert.rejects(() => loadSweepInput('/tmp/elsewhere'), /official-careers|Path escapes|repository-relative/);
});

test('validates open evidence, source URL, and writes four reports', async () => {
  const root = await mkdtemp(join('/Users/MR/Documents/职场/01_行情收集/official-careers/research', 'test-'));
  try {
    const rawDir = join(root, 'raw'); await mkdir(rawDir, { recursive: true });
    const jobs = [baseJob({ evidence_file: '01_行情收集/official-careers/research/test/raw/open.json' })];
    const jobsBytes = Buffer.from(JSON.stringify(jobs));
    const analysis = { schema_version: 1, input_sha256: createHash('sha256').update(jobsBytes).digest('hex'), execution: { agent_id: 'a', model: 'GPT6', reasoning_effort: 'high' }, summary: 'ok', priorities: [{ job_id: 'j1', priority: '优先核实', role_mission: '销售', direct_evidence: [], transferable_evidence: [], gaps: [], hard_gates: [], salary_note: '待核', resume_advice: '待核', questions: [], job_quotes: ['职责 <script>alert(1)</script>'] }], market_summary: [], limitations: [] };
    await writeFile(join(root, 'jobs.json'), JSON.stringify(jobs)); await writeFile(join(root, 'coverage.json'), JSON.stringify([{ company: '测试公司', attempted: true }])); await writeFile(join(root, 'run.json'), JSON.stringify({ observed_at: '2026-09-11T00:00:00Z' })); await writeFile(join(root, 'analysis.json'), JSON.stringify(analysis));
    await writeFile(join(rawDir, 'open.json'), JSON.stringify({ kind: 'web_tool_result_not_raw_http', operation: 'open', request: {}, observed_at: '2026-09-11T00:00:00Z', result: { content: [{ type: 'text', text: '岗位详情 https://example.com/jobs/1' }] } }));
    await assert.rejects(() => writeSweepReport({ inputDir: repoRelative(root), outputDir: root }), /official-careers\/reports/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
