import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { ROOT, repoRelative, evidenceAbsolute } from './paths.mjs';
import { RESEARCH_DIR, loadResearchState, verifiedResearchDocument } from './research.mjs';
import { evaluateSalaryTarget } from './salary-target.mjs';
import { renderFunnelMarkdown } from './funnel-view.mjs';

const sha = (value) => createHash('sha256').update(value).digest('hex');
const json = async (path) => JSON.parse(await readFile(path, 'utf8'));
const proof = (doc) => ({ url: doc.url, body_path: doc.body_path, metadata_path: doc.metadata_path,
  sha256: doc.sha256, captured_at: doc.observed_at });
const explanations = (items = []) => items.map((item) => `${item.requirement}：${item.explanation}`);

export function validateFunnelConfig(config) {
  if (config.schema_version !== 1) throw new Error('Unknown funnel schema');
  for (const name of ['policies', 'industries', 'companies', 'opportunities']) {
    if (!Array.isArray(config[name])) throw new Error(`Missing ${name}`);
    const keys = config[name].map((item) => item.id ?? item.job_key);
    if (keys.some((key) => !key) || new Set(keys).size !== keys.length) throw new Error(`Invalid or duplicate ${name} keys`);
  }
  const policies = new Set(config.policies.map((item) => item.id));
  const industries = new Set(config.industries.map((item) => item.id));
  const companies = new Set(config.companies.map((item) => item.id));
  if (config.industries.some((item) => !item.policy_ids?.length || item.policy_ids.some((id) => !policies.has(id)))
      || config.companies.some((item) => !item.industry_ids?.length || item.industry_ids.some((id) => !industries.has(id)))
      || config.opportunities.some((item) => !companies.has(item.company_id))) throw new Error('Broken funnel reference');
}

export async function verifyJobEvidence(job, runs) {
  const receipt = await json(evidenceAbsolute(job.metadata_path));
  const body = await readFile(evidenceAbsolute(job.body_path));
  if (receipt.status !== 200 || receipt.error || receipt.complete !== true || receipt.body_path !== job.body_path
      || receipt.metadata_path !== job.metadata_path || receipt.sha256 !== job.raw_response_sha256
      || sha(body) !== job.raw_response_sha256 || job.description_complete !== true) throw new Error('JD receipt or body integrity failed');
  const content = sha(JSON.stringify({ title: job.title, location: job.location_raw,
    description: job.description_text, publication: job.published_at_raw, salary: job.salary_raw }));
  if (content !== job.content_sha256) throw new Error('Normalized JD content integrity failed');
  // Keep source ownership separate from freshness: a halted source can still have a valid historical receipt.
  const run = runs.find((entry) => entry.run_id === job.latest_run_id && entry.source_id === job.source_id && entry.company_id === job.company_id);
  if (run?.ownership?.status !== 'verified' || !run.ownership.chain?.length) throw new Error('Official recruitment ownership proof missing');
  const ownership = [];
  for (const edge of run.ownership.chain) {
    const metadata = await json(evidenceAbsolute(edge.metadata_path));
    const raw = await readFile(evidenceAbsolute(edge.body_path));
    if (metadata.status !== 200 || !metadata.complete || metadata.body_path !== edge.body_path || sha(raw) !== metadata.sha256) throw new Error('Official ownership receipt integrity failed');
    ownership.push({ url: edge.from_url, body_path: edge.body_path, metadata_path: edge.metadata_path,
      sha256: metadata.sha256, captured_at: metadata.finished_at });
  }
  return [{ url: job.job_url, body_path: job.body_path, metadata_path: job.metadata_path,
    sha256: job.raw_response_sha256, captured_at: job.last_seen_at }, ...ownership];
}

export async function buildFunnel({ overview, config, researchState, verifyDocument = verifiedResearchDocument,
  verifyJob = verifyJobEvidence, generatedAt = new Date().toISOString() }) {
  config ??= await json(join(ROOT, 'careers/config/funnel-sample.json'));
  researchState ??= await loadResearchState();
  validateFunnelConfig(config);
  const issues = [];
  async function documentFor(item, excerpt) {
    const observation = researchState.documents[item.document_id];
    try {
      if (!observation?.last_good) throw new Error('No successfully captured original document');
      const document = await verifyDocument(observation.last_good);
      if (!excerpt || !document.text.includes(excerpt)) throw new Error('Exact quote not found in captured source text');
      const latestFailed = observation.last_attempt?.status !== 'captured';
      if (latestFailed) issues.push({ id: item.document_id, status: 'historical_evidence_only', reason: '最近访问未成功，保留历史原文，不声称本轮更新。' });
      return { source_url: document.url, evidence_status: latestFailed ? '历史原文已核验，最近访问失败' : '原文与回执已核验',
        evidence_verified: true, observation_kind: observation.last_attempt?.observation_kind ?? 'baseline', evidence: [proof(document)] };
    } catch (error) {
      issues.push({ id: item.document_id, status: 'unverified', reason: error.message });
      return { source_url: observation?.last_attempt?.source_url ?? null, evidence_status: '未核验，不构成完整链路',
        evidence_verified: false, observation_kind: 'not_observed', evidence: [] };
    }
  }
  const policies = [];
  for (const item of config.policies) policies.push({ ...item, ...await documentFor(item, item.excerpt) });
  const companies = [];
  for (const item of config.companies) {
    const registered = overview.companies.find((company) => company.id === item.id);
    companies.push({ ...item, ...await documentFor(item, item.business_excerpt), careers_url: registered?.careers_url ?? null,
      job_keys: config.opportunities.filter((job) => job.company_id === item.id).map((job) => job.job_key) });
  }
  const opportunities = [];
  for (const selected of config.opportunities) {
    const job = overview.jobs.find((item) => item.job_key === selected.job_key && item.company_id === selected.company_id);
    if (!job) { issues.push({ id: selected.job_key, status: 'not_observed', reason: '所选岗位不在已采集数据中，未生成虚构JD。' }); continue; }
    if (job.role_fit?.eligible === false) { issues.push({ id: job.job_key, status: 'outside_current_role_policy', reason: '不在当前市场销售运营主线，保留历史数据但不列为当前机会。' }); continue; }
    const company = companies.find((item) => item.id === job.company_id);
    const industryIDs = company.industry_ids;
    const policyIDs = [...new Set(config.industries.filter((item) => industryIDs.includes(item.id)).flatMap((item) => item.policy_ids))];
    let evidence = [];
    try { evidence = await verifyJob(job, overview.runs); }
    catch (error) { issues.push({ id: job.job_key, status: 'evidence_failed', reason: error.message }); }
    const traceable = evidence.length > 0 && company.evidence_verified && policyIDs.every((id) => policies.some((item) => item.id === id && item.evidence_verified));
    const analysis = job.analysis;
    const approved = analysis?.semantic_review_status === 'approved';
    const salary = evaluateSalaryTarget(job, overview.salary_target_rule);
    const current = !job.source_stale_warning && !['closed', 'missing_pending_review'].includes(job.hiring_active);
    const gatesMet = analysis?.hard_gate_review_complete === true && Array.isArray(analysis.hard_gates)
      && analysis.hard_gates.every((gate) => gate.status === 'met');
    const usable = traceable && approved && current && gatesMet && ['tailor', 'reuse'].includes(analysis?.resume_action);
    const state = !traceable ? '证据链未通过，暂停判断' : analysis?.semantic_review_status === 'rejected' ? '评估未通过复核，暂停推荐'
      : approved ? '已复核的方向判断' : analysis ? '草稿待独立复核' : '待个人事实评估';
    opportunities.push({ job_key: job.job_key, company_name: job.company_name, title: job.title,
      location_raw: job.location_raw, salary_raw: job.salary_raw, job_url: job.job_url,
      application_url: job.application_url, source_job_id: job.source_job_id,
      description_text: job.description_text, description_complete: job.description_complete,
      published_at: job.published_at, published_at_raw: job.published_at_raw, published_at_semantics: job.published_at_semantics,
      first_seen_at: job.first_seen_at, source_checked_at: job.last_seen_at, source_latest_attempt_at: job.source_checked_at,
      source_health: job.source_health, hiring_active: job.hiring_active, policy_ids: policyIDs, industry_ids: industryIDs,
      evidence, traceable, salary_target: salary, selected_application_authorized: false,
      recommendation_status: usable && salary.eligible ? 'ready_for_user_review' : 'exploratory_or_pending',
      career_fit: { path: `${state}${analysis ? analysis.resume_action === 'defer' ? '；暂缓该岗位' : '；有条件探索' : ''}`,
        role_mission: analysis?.role_mission ?? null, verdict: analysis?.verdict ?? null, resume_advice: analysis?.resume_advice ?? null,
        reason: [analysis?.verdict, analysis?.role_mission ?? '尚无当前偏好下有效评估。', analysis?.resume_advice,
          !current && '来源受限或岗位状态异常，须重新确认在招状态。', '固定月薪、人员管理权限和收入稳定性需要单独核实。'].filter(Boolean).join(' '),
        score: analysis?.score ?? null, score_semantics: '证据覆盖判断，不是面试概率或管理适任概率',
        assessment_review_status: analysis?.semantic_review_status ?? 'not_assessed',
        direct_evidence: explanations(analysis?.direct_evidence), transferable_evidence: explanations(analysis?.transferable_evidence),
        gaps: explanations(analysis?.gaps), questions: [...(analysis?.questions ?? []), '固定月薪是否至少人民币20,000元，不含提成、奖金和OTE？', '岗位实际带队人数、招聘绩效权限与浮动收入比例是什么？'],
        hard_gates: analysis?.hard_gates ?? [], resume_reuse_eligible: analysis?.resume_reuse_eligible === true } });
  }
  for (const [origin, error] of Object.entries(researchState.halted_origins)) issues.push({ id: origin, status: 'source_halted', reason: `${error.code}: ${error.message}；已停止该源，无自动重试。` });
  const result = { schema_version: 1, generated_at: generatedAt, scope: config.scope,
    reporting_window: { from: generatedAt.slice(0, 10), to: generatedAt.slice(0, 10), semantics: 'manual_generation_UTC_day_not_policy_publication_window' },
    policies, industries: config.industries, companies, opportunities, issues,
    summary: { policies_verified: policies.filter((item) => item.evidence_verified).length, industries: config.industries.length,
      companies: companies.length, traceable_jobs: opportunities.filter((item) => item.traceable).length,
      salary_eligible: opportunities.filter((item) => item.salary_target.eligible).length,
      assessment_pending: opportunities.filter((item) => item.career_fit.assessment_review_status !== 'approved').length },
    boundaries: ['这是可追溯样本，不是全量公司发现、排名或本周新增政策清单。', '需求假设与个人路径判断不是官网原文；JD原文单独保留。',
      '本页全部岗位均未获得投递授权；没有发送简历、消息或注册账号。', '未启用每日采集或政策周报定时任务。'] };
  // Rebuild from current preferences, valid analyses and on-disk receipts on every report; never reuse a stale recommendation snapshot.
  result.input_digest = sha(JSON.stringify({ config, researchState, preferences: overview.salary_target_rule,
    preferences_version: overview.preferences_version, opportunities, issues }));
  return result;
}

export function renderFunnelCSV(data, csvCell) {
  const keys = ['company_name', 'title', 'location_raw', 'salary_raw', 'policy_ids', 'industry_ids', 'job_url', 'application_url',
    'published_at', 'source_checked_at', 'source_latest_attempt_at', 'source_health', 'hiring_active', 'traceable', 'description_text', 'salary_target', 'career_fit', 'evidence'];
  return '\uFEFF' + [keys.map(csvCell).join(','), ...data.opportunities.map((job) => keys.map((key) =>
    csvCell(typeof job[key] === 'object' && job[key] !== null ? JSON.stringify(job[key]) : job[key])).join(','))].join('\r\n') + '\r\n';
}

export async function writeFunnelSnapshot(data) {
  const directory = join(RESEARCH_DIR, 'funnels');
  await mkdir(directory, { recursive: true });
  const path = join(directory, `${data.input_digest}.json`);
  try { await writeFile(path, JSON.stringify(data, null, 2) + '\n', { flag: 'wx' }); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  return repoRelative(path);
}

export function funnelReportFiles(data, csvCell) {
  return { 'funnel.json': JSON.stringify(data, null, 2) + '\n', 'funnel.md': renderFunnelMarkdown(data), 'funnel.csv': renderFunnelCSV(data, csvCell) };
}
