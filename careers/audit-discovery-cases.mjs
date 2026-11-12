import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { CareersStore } from './store.mjs';
import { classifyRole } from './role-policy.mjs';
import { groupOpportunities } from './opportunity-identity.mjs';
import { DATA_DIR, REPORT_DIR, evidenceAbsolute, repoRelative } from './paths.mjs';

const store = new CareersStore();
let jobs;
try { jobs = store.listJobs(); } finally { store.close(); }
const cases = [];
for (const id of ['7655546603629922610', '7612560574200023323', '7657068941227673899']) {
  const job = jobs.find((entry) => entry.source_job_id === id);
  if (!job) continue;
  const bytes = await readFile(evidenceAbsolute(job.body_path));
  const receipt = JSON.parse(await readFile(evidenceAbsolute(job.metadata_path), 'utf8'));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), receipt.sha256);
  const raw = JSON.parse(bytes).data.job_post_list.find((entry) => entry.id === id);
  assert.ok(raw && raw.title === job.title);
  cases.push({ kind: 'historical_raw_JD_replay_not_new_hiring', company: job.company_name,
    title: job.title, native_id: id, job_url: job.job_url, observed_at: job.fetched_at,
    evidence_path: job.body_path, evidence_sha256: receipt.sha256, current_rule_result: classifyRole(job),
    removed_gates: false, requirement_excerpt: raw.requirement.slice(0, 600) });
}
assert.equal(cases.find((entry) => entry.native_id === '7655546603629922610')?.current_rule_result.tier, 'review');
assert.equal(cases.find((entry) => entry.native_id === '7657068941227673899')?.current_rule_result.tier, 'excluded');
const platform = { company_id: 'fixture-a', title: '客户经理', channel: 'boss', recruiter_id: 'hr-a' };
const platformRows = [platform, { ...platform }, { ...platform, recruiter_id: 'hr-b' }, { ...platform, company_id: 'fixture-b' }];
const official = { ...platform, channel: 'official', tenant: 'fixture-company', source_job_id: 'vacancy-1' };
const officialRows = [official, { ...official, recruiter_id: 'hr-b' }, { ...official, source_job_id: 'vacancy-2' }];
assert.equal(groupOpportunities(platformRows).length, 3);
assert.equal(groupOpportunities(officialRows).length, 2);
const historicalSweepPath = join(DATA_DIR, 'research/sweep-2026-09-11/jobs.json');
const originalSweep = await readFile(historicalSweepPath);
const snapshot = { checked_at: new Date().toISOString(), live_requests: 0,
  scope: 'Historical source replay and synthetic channel-identity cases. Not a fresh market scan or recommendation approval.',
  historical_official_rows: jobs.length, raw_rows_after_annotation: jobs.length, cases,
  identity_fixtures: { platform: { observations: platformRows.length, targets: groupOpportunities(platformRows).length },
    official: { observations: officialRows.length, targets: groupOpportunities(officialRows).length } },
  unchanged_original_market_jobs: { path: repoRelative(historicalSweepPath), sha256: createHash('sha256').update(originalSweep).digest('hex') }, passed: true };
const directory = join(REPORT_DIR, 'qa');
await mkdir(directory, { recursive: true });
await writeFile(join(directory, 'discovery-repair-cases.json'), JSON.stringify(snapshot, null, 2) + '\n');
const lines = ['# 召回与去重案例复核', '', '这是历史原文回放与合成边界测试，不是今日市场扫描。没有访问招聘网站，没有投递。', '',
  `原始官网库保留 ${jobs.length} 条记录。`, '', '## 真实JD回放'];
for (const entry of cases) lines.push('', `### ${entry.company} · ${entry.title}`, '',
  `结果：${entry.current_rule_result.category}。${entry.current_rule_result.reason}`, '',
  ...(entry.current_rule_result.body_signals ?? []).map((signal) => `- ${signal.dimension}：${signal.quote}`), '',
  `原文观察时间：${entry.observed_at}。`, `原始证据：${entry.evidence_path}`, `岗位链接：${entry.job_url}`);
lines.push('', '## 身份反例（合成测试，不是实抓岗位）', '',
  '- BOSS四条观察：同公司同标题同HR重复一条、不同HR一条、不同公司一条。保留全部四条观察，形成三个联系目标。',
  '- 官网三条观察：同原生岗位不同HR两条、另一原生岗位一条。保留全部三条观察，形成两个申请目标。',
  '- 未知HR不因空值相等合并；展示名不能替代平台HR身份；不同hash岗位路由不合并。', '',
  `历史市场jobs.json SHA256：${snapshot.unchanged_original_market_jobs.sha256}`);
await writeFile(join(directory, 'discovery-repair-cases.md'), lines.join('\n') + '\n');
process.stdout.write(JSON.stringify({ passed: true, cases: cases.length, reports: ['qa/discovery-repair-cases.json', 'qa/discovery-repair-cases.md'], live_requests: 0 }) + '\n');
