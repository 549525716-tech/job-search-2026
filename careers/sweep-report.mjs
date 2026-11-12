import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ROOT, REPORT_DIR, evidenceAbsolute, repoRelative } from './paths.mjs';
import { annotateOpportunities, groupOpportunities, identityURL } from './opportunity-identity.mjs';
import { classifyRole } from './role-policy.mjs';
import { getIndustryAnnotation, groupJobsByIndustry } from './industry-view.mjs';
import { parseSalary } from './salary.mjs';
import { evaluateSalaryTarget } from './salary-target.mjs';

const REQUIRED_JOBS = 'jobs.json';
const REQUIRED_COVERAGE = 'coverage.json';
const REQUIRED_RUN = 'run.json';

export const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

export function safeURL(value) {
  try {
    const url = new URL(String(value ?? ''));
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}

export function csvCell(value) {
  let text = String(value ?? '');
  if (/^[\s\uFEFF]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function jsonValue(value) {
  return typeof value === 'string' ? value : JSON.stringify(value ?? '');
}

function normalizeText(value) {
  return String(value ?? '').replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').trim();
}

function normalizeEvidenceText(value) {
  return String(value ?? '').replace(/\r\n?/g, '\n').replace(/^\s*L\d+:\s?/gm, '').replace(/\s+/g, ' ').trim();
}

function arrayInput(value, key) {
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value[key])) return value[key];
  throw new Error(`${key}.json must contain an array`);
}

function objectInput(value, key) {
  if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error(`${key}.json must contain an object`);
  return value;
}

function inputAbsolute(inputDir) {
  if (typeof inputDir !== 'string' || !inputDir) throw new Error('Missing --input');
  const absolute = evidenceAbsolute(inputDir);
  const researchRoot = resolve(ROOT, '01_行情收集', 'official-careers', 'research');
  if (absolute !== researchRoot && !absolute.startsWith(`${researchRoot}${sep}`)) {
    throw new Error('Sweep input must stay inside official-careers/research');
  }
  return absolute;
}

function canonicalURL(value) {
  return identityURL(value);
}

function resultText(result) {
  if (typeof result === 'string') return result;
  if (result && Array.isArray(result.content)) return result.content.filter((item) => item?.type === 'text').map((item) => item.text).join('\n');
  return jsonValue(result);
}

function evidenceText(record) {
  return resultText(record?.result);
}

function evidenceURLPresent(record, url) {
  const target = safeURL(url);
  return Boolean(target && normalizeEvidenceText(evidenceText(record)).includes(normalizeEvidenceText(target)));
}

function findEvidenceRecords(rawRecords, evidenceFile) {
  return rawRecords.filter((record) => record && (record.path === evidenceFile || record.file === evidenceFile || record.evidence_file === evidenceFile));
}

function buildEvidenceIndex(records) {
  const index = new Map();
  for (const record of records) {
    if (record?.file || record?.path || record?.evidence_file) {
      for (const name of [record.file, record.path, record.evidence_file].filter(Boolean)) index.set(name, record);
    }
  }
  return index;
}

function normalizeJob(job, evidenceIndex) {
  const sourceKind = String(job.source_kind || 'unclassified_source');
  const evidence = evidenceIndex.get(job.evidence_file);
  const openEvidence = ['open', 'click'].includes(evidence?.operation) && evidence.kind === 'web_tool_result_not_raw_http';
  const hasResponsibilities = Boolean(normalizeText(job.description));
  const hasRequirements = Boolean(normalizeText(job.requirements));
  const evidenceBody = normalizeEvidenceText(evidenceText(evidence));
  const quoteValid = Boolean(normalizeText(job.evidence_quote) && evidenceBody.includes(normalizeEvidenceText(job.evidence_quote)));
  const titleValid = Boolean(normalizeText(job.title) && evidenceBody.includes(normalizeEvidenceText(job.title)));
  const descriptionValid = Boolean(hasResponsibilities && evidenceBody.includes(normalizeEvidenceText(job.description)));
  const requirementsValid = Boolean(hasRequirements && evidenceBody.includes(normalizeEvidenceText(job.requirements)));
  const sourceURLValid = evidenceURLPresent(evidence, job.source_url);
  const complete = ['official', 'official_ats', 'recruitment_platform'].includes(sourceKind) && openEvidence && quoteValid && titleValid && descriptionValid && requirementsValid && sourceURLValid && job.description_complete === true;
  const failedChecks = [['标题', titleValid], ['职责', descriptionValid], ['要求', requirementsValid], ['引用', quoteValid], ['来源链接', sourceURLValid]].filter(([, valid]) => !valid).map(([label]) => label).join('、');
  const completenessNote = complete ? 'open 证据已连续证明标题、职责、要求、证据引用及来源链接' : sourceKind === 'search_index' ? '搜索索引只能作为线索，不能升级为完整 JD' : `证据连续比对失败：${failedChecks || '缺少 open 证据或输入未声明完整'}`;
  return { ...job, id: String(job.id ?? ''), company: String(job.company ?? ''), title: String(job.title ?? ''), city: String(job.city ?? job.location ?? ''),
    source_kind: sourceKind, job_url: canonicalURL(job.job_url), apply_url: safeURL(job.apply_url), source_url: safeURL(job.source_url),
    description_complete: complete, completeness_status: complete ? 'full' : 'partial', completeness_note: completenessNote,
    fixed_salary_status: '待核', evidence_valid: Boolean(evidence && quoteValid && titleValid && descriptionValid && requirementsValid && sourceURLValid), evidence_quote_valid: quoteValid, title_in_evidence: titleValid, description_in_evidence: descriptionValid, requirements_in_evidence: requirementsValid, source_url_in_evidence: sourceURLValid,
    search_text: [job.company, job.title, job.city, job.location, job.salary_raw, job.description, job.requirements, job.contact_name, job.recruiter_name].map(normalizeText).join(' ').toLowerCase(),
  };
}

function dedupeJobs(jobs) {
  return groupOpportunities(jobs);
}

function analysisText(job) {
  return [job.title, job.company, job.description, job.requirements, job.evidence_quote].map(normalizeText).filter(Boolean).join('\n');
}

const DEFAULT_SALARY_RULE = Object.freeze({ mode: 'fixed_monthly_base_minimum', currency: 'CNY', period: 'month', min_fixed_monthly_base: 20000 });

function salaryEvidenceQuote(job) {
  return job.salary_evidence_quote ?? job.salary_quote ?? job.salary_raw_evidence_quote ?? null;
}

function evaluateSweepSalary(job, evidenceBody, rule = DEFAULT_SALARY_RULE) {
  const raw = normalizeText(job.salary_raw);
  if (!raw) return { eligible: false, pending: true, status: 'insufficient_evidence', reason: 'salary_not_disclosed', evidence_status: 'missing' };
  const parsed = parseSalary(raw, job.salary_hints ?? { currency: job.salary_currency, period: job.salary_period });
  if (job.source_kind === 'search_index') return { eligible: false, pending: true, status: 'search_index_only', reason: 'search_index_salary_is_lead_only', evidence_status: 'search_index_only', parsed_salary: parsed };
  const quote = normalizeText(salaryEvidenceQuote(job));
  const evidence = normalizeEvidenceText(evidenceBody);
  const quoteBound = Boolean(quote && evidence.includes(normalizeEvidenceText(quote)) && quote.includes(raw)
    && (quote.includes(normalizeText(job.title)) || (job.source_job_id && quote.includes(String(job.source_job_id)))));
  if (!quoteBound) return { eligible: false, pending: true, status: 'salary_evidence_unbound', reason: 'salary_raw_has_no_bound_job_level_quote', evidence_status: 'unbound', salary_evidence_quote: quote || null, parsed_salary: parsed };
  const result = evaluateSalaryTarget({ ...job, ...parsed, salary_raw: raw }, rule);
  return { ...result, evidence_status: 'bound', salary_evidence_quote: quote, parsed_salary: parsed };
}

function validateAnalysis(analysis, jobs, jobsHash, contextHash, dispatch) {
  if (!analysis) return { status: 'absent', byJob: new Map(), invalid: [] };
  if (analysis.input_sha256 !== jobsHash) return { status: 'expired', byJob: new Map(), invalid: ['input_sha256 missing or does not match jobs.json'] };
  if (!contextHash || analysis.context_sha256 !== contextHash) return { status: 'expired', byJob: new Map(), invalid: ['context_sha256 missing or does not match context.json'] };
  if (!dispatch?.agent_id || dispatch.model !== 'gpt-6-astra' || dispatch.reasoning_effort !== 'max'
    || ['agent_id', 'model', 'reasoning_effort'].some((key) => analysis.execution?.[key] !== dispatch[key])) {
    return { status: 'invalid', byJob: new Map(), invalid: ['GPT6 analysis does not match the independently saved dispatch receipt'] };
  }
  if (analysis.schema_version !== 1 || !Array.isArray(analysis.priorities) || analysis.priorities.length > 20) return { status: 'invalid', byJob: new Map(), invalid: ['unsupported analysis schema or more than 20 candidates'] };
  const byId = new Map(jobs.map((job) => [job.id, job]));
  const byJob = new Map();
  const seen = new Set();
  const invalid = [];
  for (const item of analysis.priorities) {
    const job = byId.get(String(item?.job_id ?? ''));
    const quotes = Array.isArray(item?.job_quotes) ? item.job_quotes : [];
    if (!job?.description_complete || seen.has(job.id) || !quotes.length || quotes.some((quote) => !normalizeEvidenceText(quote) || !normalizeEvidenceText(analysisText(job)).includes(normalizeEvidenceText(quote)))) {
      invalid.push({ job_id: item?.job_id ?? null, reason: 'job_quotes do not continuously match the bound job text' });
      continue;
    }
    seen.add(job.id);
    byJob.set(job.id, item);
  }
  return { status: invalid.length ? 'partial' : 'valid', byJob, invalid };
}

function labelSource(kind) { return ({ search_index: '搜索索引线索', official_ats: '官方 ATS', official: '官方招聘页', recruitment_platform: '招聘平台' })[kind] || `其他来源（待核）：${kind || '未分类'}`; }
function displaySalary(job) { return `${job.salary_raw || '未披露'} · 固定底薪${job.fixed_salary_status || '待核'}`; }
function markdownText(value) { return String(value ?? '').replace(/[\\`*_{}[\]()#+.!|<>]/g, '\\$&').replace(/\r?\n/g, ' '); }
function markdownURL(value) { return safeURL(value).replace(/[()[\]]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`); }
function literalBlock(value) {
  const text = String(value ?? '无');
  const longestFence = Math.max(3, ...[...text.matchAll(/`+/g)].map((match) => match[0].length + 1));
  const fence = '`'.repeat(longestFence);
  return [fence, text, fence];
}
function analysisMarkdown(analysis) {
  if (!analysis) return ['GPT6 分析：待分析'];
  const lines = [`GPT6 分析：${markdownText(analysis.role_mission || '')}`, `优先级：${markdownText(analysis.priority || '')}`];
  for (const [label, values] of [['直接证据', analysis.direct_evidence], ['可迁移证据', analysis.transferable_evidence], ['缺口', analysis.gaps], ['硬门槛', analysis.hard_gates], ['简历建议', analysis.resume_advice], ['待确认问题', analysis.questions]]) {
    lines.push(`**${label}**`, ...(Array.isArray(values) ? values : [values]).filter(Boolean).map((value) => `- ${markdownText(typeof value === 'string' ? value : JSON.stringify(value))}`), '');
  }
  return lines;
}
function localEvidenceHref(repoPath) {
  if (!repoPath) return '';
  try {
    const absolute = evidenceAbsolute(repoPath);
    const rel = relative(REPORT_DIR, absolute);
    return rel.split(sep).map(encodeURIComponent).join('/');
  } catch { return ''; }
}

export async function loadSweepInput(inputDir) {
  const directory = inputAbsolute(inputDir);
  const [jobsBytes, coverageBytes, runBytes] = await Promise.all([
    readFile(join(directory, REQUIRED_JOBS)), readFile(join(directory, REQUIRED_COVERAGE)), readFile(join(directory, REQUIRED_RUN)),
  ]);
  let analysis = null;
  const analysisPath = join(directory, 'analysis.json');
  if (existsSync(analysisPath)) analysis = JSON.parse(await readFile(analysisPath, 'utf8'));
  const contextPath = join(directory, 'context.json');
  const contextBytes = existsSync(contextPath) ? await readFile(contextPath) : null;
  const rawFiles = (await import('node:fs/promises')).readdir(join(directory, 'raw'), { withFileTypes: true }).catch(() => []);
  const entries = await rawFiles;
  const evidenceRecords = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const file = join(directory, 'raw', entry.name);
    const record = JSON.parse(await readFile(file, 'utf8'));
    evidenceRecords.push({ ...record, file: repoRelative(file) });
  }
  const evidenceIndex = buildEvidenceIndex(evidenceRecords);
  const rawJobs = arrayInput(JSON.parse(jobsBytes), 'jobs');
  const jobs = annotateOpportunities(rawJobs.map((job) => normalizeJob(job, evidenceIndex)));
  const coverage = arrayInput(JSON.parse(coverageBytes), 'coverage');
  const run = objectInput(JSON.parse(runBytes), 'run');
  const jobsHash = createHash('sha256').update(jobsBytes).digest('hex');
  const contextHash = contextBytes ? createHash('sha256').update(contextBytes).digest('hex') : null;
  let dispatch = null;
  try { dispatch = JSON.parse(await readFile(join(directory, 'analysis-dispatch.json'), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const analysisState = validateAnalysis(analysis, jobs, jobsHash, contextHash, dispatch);
  analysisState.execution = analysis?.execution ?? null;
  analysisState.summary = analysisState.status === 'valid' ? analysis?.summary ?? null : null;
  analysisState.market_summary = analysisState.status === 'valid' ? analysis?.market_summary ?? [] : [];
  analysisState.limitations = analysisState.status === 'valid' ? analysis?.limitations ?? [] : [];
  for (const job of jobs) job.analysis = analysisState.byJob.get(job.id) ?? null;
  return { input_dir: repoRelative(directory), jobs, coverage, run, analysis: analysisState, jobs_sha256: jobsHash, context_sha256: contextHash, evidence: evidenceIndex };
}

export function buildSweepReport(input, generatedAt = new Date().toISOString()) {
  const observations = annotateOpportunities((input.jobs ?? []).map((job) => ({
    ...job,
    ...getIndustryAnnotation(job, (input.companies ?? []).find((company) => company.id && company.id === job.company_id) ?? {}, input.classifications ?? []),
    source_kind: job.source_kind === 'search_index' ? 'search_index' : job.source_kind,
    description_complete: job.source_kind === 'search_index' ? false : job.description_complete === true,
    fixed_salary_status: '待核',
    city: job.city ?? job.location ?? '',
    location: job.location ?? job.city ?? '',
    description: job.description || job.description_text || job.responsibilities || '',
    role_fit: classifyRole(job),
    search_text: [job.company, job.title, job.city, job.location, job.industry, job.segment, job.tier_label, job.business_line, job.salary_raw, job.description_text, job.description, job.requirements, job.contact_name, job.recruiter_name].map(normalizeText).join(' ').toLowerCase(),
    completeness_note: job.source_kind === 'search_index' ? '搜索索引只能作为线索，不能升级为完整 JD' : job.completeness_note || (job.description_complete === true ? '完整性来自本轮输入，待证据回查' : '缺少完整职责/要求证据，降为 partial'),
  })));
  const salaryRule = input.salary_target_rule ?? DEFAULT_SALARY_RULE;
  for (const job of observations) {
    const evidence = input.evidence?.get?.(job.evidence_file) ?? null;
    const salary = evaluateSweepSalary(job, evidenceText(evidence), salaryRule);
    job.salary_target = salary;
    job.fixed_salary_status = salary.eligible ? '已确认' : salary.pending ? '待核' : '未达标';
    job.salary_target_status = salary.status;
    job.salary_target_reason = salary.reason;
    job.salary_evidence_status = salary.evidence_status;
    job.salary_evidence_quote = salary.salary_evidence_quote ?? salaryEvidenceQuote(job);
    if (salary.parsed_salary) Object.assign(job, {
      salary_currency: salary.parsed_salary.salary_currency,
      salary_period: salary.parsed_salary.salary_period,
      salary_min: salary.parsed_salary.salary_min,
      salary_max: salary.parsed_salary.salary_max,
      salary_kind: salary.parsed_salary.salary_kind,
      salary_status: salary.parsed_salary.salary_status,
    });
  }
  const jobs = dedupeJobs(observations);
  for (const job of jobs) job.analysis = input.analysis?.byJob?.get?.(job.id) ?? null;
  const priority = { 优先核实: 0, 相邻尝试: 1, 暂不主攻: 2 };
  jobs.sort((a, b) => (priority[a.analysis?.priority] ?? 3) - (priority[b.analysis?.priority] ?? 3)
    || (a.analysis?.review_order ?? 999) - (b.analysis?.review_order ?? 999));
  const counts = { companies: new Set((input.coverage ?? []).filter((row) => row.attempted && row.entity_kind !== 'paused_source_group').map((row) => row.company)).size, all: jobs.length, complete: jobs.filter((job) => job.description_complete).length, leads: jobs.filter((job) => job.source_kind === 'search_index').length,
    china: jobs.filter((job) => /中国|北京|上海|广州|深圳|杭州|成都|苏州|南京|武汉|西安|重庆|天津|厦门|香港|澳门/.test(`${job.city} ${job.location}`)).length,
    salary_pending: jobs.filter((job) => job.salary_target?.pending).length, raw_observations: observations.length,
    application_targets: jobs.length, grouped_duplicates: observations.length - jobs.length,
    body_review: jobs.filter((job) => job.role_fit.review_required).length,
    commercial_candidates: jobs.filter((job) => job.role_fit.eligible).length,
    salary_confirmed: jobs.filter((job) => job.salary_target?.eligible).length,
    salary_below_target: jobs.filter((job) => job.salary_target?.status === 'below_target').length,
    industry_groups: groupJobsByIndustry(jobs).length };
  return { schema_version: 1, generated_at: generatedAt, observed_at: input.run.observed_at ?? input.run.finished_at ?? generatedAt,
    input_dir: input.input_dir, jobs_sha256: input.jobs_sha256, context_sha256: input.context_sha256 ?? null, snapshot_note: '本轮市场扫描快照，不代表自动当前在招状态。', jobs, observations, coverage: input.coverage, run: input.run,
    analysis: { status: input.analysis.status, invalid: input.analysis.invalid, execution: input.analysis.execution ?? null, summary: input.analysis.summary ?? null, market_summary: input.analysis.market_summary ?? [], limitations: input.analysis.limitations ?? [] }, counts,
    salary_target_rule: salaryRule,
    industry_groups: groupJobsByIndustry(jobs),
    limitations: ['完整 JD 指本次工具返回的职责和要求均可逐字回查，不代表当前仍在招或官网直接HTTP全量采集。', '海外工作地不是默认匹配。', '首次发现不等于新发布。', '未知薪资不猜；搜索摘要薪资只作线索，固定底薪必须有逐岗原文绑定证据。', '本轮为有限市场扫描，未遍历全部公司、岗位分页和登录后内容。', input.run.timing_audit_note || '调用时间审计未提供。'],
  };
}

export function renderSweepReportHTML(data) {
  const recordedTime = Number.isFinite(Date.parse(data.observed_at)) ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', dateStyle: 'medium', timeStyle: 'short', hour12: false }).format(new Date(data.observed_at)) + '（北京时间）' : '未核实';
  const renderJob = (job) => {
    const analysis = job.analysis;
    const evidence = localEvidenceHref(job.evidence_file);
    const jobLink = safeURL(job.job_url);
    const sourceLink = safeURL(job.source_url);
    const priorityLabel = analysis?.priority || (job.description_complete ? '待分析' : '线索待核');
    const commercial = job.role_fit?.eligible === true;
    const analysisHTML = analysis ? `<section class="analysis"><h3>GPT6 分析</h3><p>${escapeHTML(analysis.role_mission || '')}</p><p class="muted">${escapeHTML(analysis.priority || '')}</p>${[['直接证据', analysis.direct_evidence], ['可迁移证据', analysis.transferable_evidence], ['缺口', analysis.gaps], ['硬门槛', analysis.hard_gates], ['简历建议', analysis.resume_advice], ['待确认问题', analysis.questions]].map(([title, values]) => `<h4>${title}</h4><ul>${(Array.isArray(values) ? values : [values]).filter(Boolean).map((value) => `<li>${escapeHTML(typeof value === 'string' ? value : JSON.stringify(value))}</li>`).join('') || '<li>无</li>'}</ul>`).join('')}</section>` : '<p class="notice">GPT6 分析：待分析</p>';
    return `<article class="job" data-priority="${escapeHTML(priorityLabel)}" data-kind="${escapeHTML(job.source_kind)}" data-full="${job.description_complete}" data-commercial="${commercial}" data-review="${job.role_fit?.review_required === true}" data-salary="${job.salary_target?.eligible === true}" data-china="${/中国|北京|上海|广州|深圳|杭州|成都|苏州|南京|武汉|西安|重庆|天津|厦门|香港|澳门/.test(`${job.city} ${job.location}`)}" data-search="${escapeHTML(job.search_text)}"><header><div><h2>${escapeHTML(job.company || '公司未披露')} · ${escapeHTML(job.title || '职位未披露')}</h2><p class="muted"><b class="priority">${escapeHTML(priorityLabel)}</b> · ${escapeHTML(labelSource(job.source_kind))} · ${job.description_complete ? '完整 JD' : 'partial / 线索'} · ${escapeHTML(job.industry || '行业待核')} / ${escapeHTML(job.segment || '赛道待核')} / ${escapeHTML(job.tier_label || '地位待核')} · 首次发现不等于新发布</p></div><strong class="salary">${escapeHTML(displaySalary(job))}</strong></header><div class="meta"><span>地区：${escapeHTML(job.city || job.location || '未知地区')}</span><span>联系人：${escapeHTML(job.contact_name || job.recruiter_name || '待核')}</span><span>来源：${jobLink ? `<a href="${escapeHTML(jobLink)}" rel="noopener noreferrer">岗位链接</a>` : '聚合招聘页（见来源）'}</span><span>来源页：${sourceLink ? `<a href="${escapeHTML(sourceLink)}" rel="noopener noreferrer">${escapeHTML(sourceLink)}</a>` : '无有效来源链接'}</span></div>${job.attention ? `<p class="notice"><b>重点核实：</b>${escapeHTML(job.attention)}</p>` : ''}${analysis ? `<p class="mission"><b>岗位判断：</b>${escapeHTML(analysis.role_mission || '')}</p>` : ''}<details><summary>JD 全文与证据</summary><p class="muted">发布日期：${escapeHTML(job.published_at || '未标注')} · ${escapeHTML(job.time_note || '本次发现不等于新发布')}</p><p class="notice">${escapeHTML(job.ownership_note || '官方归属链尚待核验')}</p><h3>职责</h3><pre>${escapeHTML(job.description || '无')}</pre><h3>要求</h3><pre>${escapeHTML(job.requirements || '无')}</pre><p>证据引用：${escapeHTML(job.evidence_quote || '无')} · 薪资绑定原文：${escapeHTML(job.salary_evidence_quote || '未绑定')} · ${evidence ? `<a href="${escapeHTML(evidence)}">本地证据</a>` : '证据文件不可回查'} · ${escapeHTML(job.completeness_note)}</p></details><details><summary>匹配证据、缺口与材料建议</summary>${analysisHTML}</details></article>`;
  };
  const groupedRows = groupJobsByIndustry(data.jobs).map((group) => `<section class="industry-group"><h2 class="industry-heading">${escapeHTML(group.industry)} / ${escapeHTML(group.segment)} / ${escapeHTML(group.tier_label)} <span class="muted">${escapeHTML(group.company_name)} · ${escapeHTML(group.business_line)} · ${group.jobs.length} 条</span></h2>${group.jobs.map(renderJob).join('')}</section>`).join('');
  const viewControls = `<div class="sweep-views" role="tablist" aria-label="报告视图"><button type="button" data-sweep-filter="commercial" aria-selected="true">商业候选</button><button type="button" data-sweep-filter="review" aria-selected="false">正文待复核</button><button type="button" data-sweep-filter="raw" aria-selected="false">全部岗位</button></div>`;
  const jobRows = viewControls + groupedRows;
  const analysisSummaryHTML = `<section class="global-analysis"><h2>GPT6 研判</h2><p>${escapeHTML(data.analysis.summary || '待分析')}</p><details><summary>市场判断、模型分工与分析边界</summary><p class="muted">采集执行：${escapeHTML(data.run.model || '未记录')} / ${escapeHTML(data.run.effort || '未记录')}，${escapeHTML(data.run.this_agent_web_calls ?? '未记录')}次工具调用；主控补充${escapeHTML(data.run.controller_pm_web_calls ?? '未记录')}次。分析：${escapeHTML(data.analysis.execution?.model || '待分析')} / ${escapeHTML(data.analysis.execution?.reasoning_effort || '未记录')}。未提供精确Token计量。</p><ul>${[...(data.analysis.market_summary || []), ...(data.analysis.limitations || []).map((item) => `分析限制：${item}`)].map((item) => `<li>${escapeHTML(item)}</li>`).join('') || '<li>待分析</li>'}</ul></details></section>`;
  const statuses = { captured_filtered: '已提取JD', partial_login_required: '部分取得 / 后续须登录', public_index_body_unavailable: '正文未取得', search_index_only: '仅检索线索', public_page_read_no_jd: '页面已读 / 未取到JD', excluded_historical_or_campus: '历史或校招 / 已排除', raw_read_extraction_pending: '原文已读 / 提取待完成', controller_search_only: '检索未取得目标JD', known_restricted_source_not_retried: '已知受限 / 本轮未访问', jd_read: '已读原文' };
  const coverage = data.coverage.map((row) => `<tr><td>${escapeHTML(row.company)}</td><td>${row.attempted ? '是' : '否'}</td><td>${escapeHTML(statuses[row.status] || row.status || '')}</td><td>${escapeHTML(row.formal_job_count ?? row.job_count ?? '')}</td><td>${escapeHTML(row.reason || '')}<details><summary>检索与证据</summary>${(row.queries || []).map((query) => `<p>${escapeHTML(query)}</p>`).join('')}${(row.evidence_files || []).map((file) => `<p><a href="${escapeHTML(localEvidenceHref(file))}">${escapeHTML(file.split('/').pop())}</a></p>`).join('') || '本轮未访问'}</details></td></tr>`).join('');
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none';style-src 'unsafe-inline';script-src 'unsafe-inline';base-uri 'none';form-action 'none'"><title>市场扫描</title><style>*{box-sizing:border-box}body{margin:0;background:#f5f7f7;color:#20262d;font:14px/1.5 -apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif;overflow-wrap:anywhere}main{max-width:1400px;margin:auto;padding:18px 24px 44px}header.top{display:flex;justify-content:space-between;gap:16px;align-items:end;border-bottom:1px solid #d7dfe0;padding-bottom:12px}h1{font-size:24px;margin:0}h2{font-size:16px;margin:0}h3{font-size:14px;margin:12px 0 4px}h4{font-size:13px;margin:8px 0 2px}.muted{color:#69757a;font-size:12px}.exports{display:flex;gap:10px;white-space:nowrap}.priority{color:#08776b}.mission{margin:7px 0}.global-analysis>p{margin:6px 0}.global-analysis{border-top:1px solid #d7dfe0;padding:10px 0}a{color:#08776b;text-underline-offset:3px}.metrics{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;margin:12px 0}.metric{background:#fff;border-left:3px solid #17826f;padding:8px 10px}.metric strong{display:block;font-size:20px}.metric.warn{border-color:#c07a15}.controls{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:12px 0}button,select,input{font:inherit;border:1px solid #cbd5d4;background:#fff;padding:7px 9px;border-radius:3px}button[aria-selected=true]{background:#e4f1ed;border-color:#17826f;color:#075c51}input{min-width:280px}.job{background:#fff;border-top:1px solid #d8e0df;padding:13px 0}.job header{display:flex;justify-content:space-between;gap:16px;align-items:start;border:0;padding:0}.salary{color:#8a5b0c;white-space:nowrap}.meta{display:flex;gap:14px;flex-wrap:wrap;color:#536168;font-size:13px;margin:6px 0}.notice{border-left:3px solid #c07a15;padding:5px 8px;background:#fffaf0;color:#79541c;margin:7px 0}.job details{border-top:1px solid #edf0ef;margin-top:8px;padding-top:7px}summary{cursor:pointer;color:#176c61}pre{white-space:pre-wrap;font-family:inherit;font-size:13px;line-height:1.55;background:#f8faf9;padding:8px;margin:4px 0}.analysis{border-left:3px solid #17826f;padding-left:9px}.sweep-views{display:flex;gap:6px;margin:8px 0}.industry-heading{background:#e8efec;padding:6px 8px;font-size:13px}.industry-group{margin-top:10px}.hidden{display:none}.empty{padding:12px 0;color:#79541c}.coverage{margin-top:22px;border-top:1px solid #d7dfe0;padding-top:10px}table{width:100%;border-collapse:collapse;background:#fff}th,td{text-align:left;border-bottom:1px solid #e5eae9;padding:7px 8px;font-size:13px}footer{margin-top:18px;color:#69757a;font-size:12px}@media(max-width:800px){main{padding:12px}.metrics{grid-template-columns:repeat(3,minmax(0,1fr))}.metric{padding:6px}.metric span{font-size:12px}.metric strong{font-size:18px}.job header{display:block}.salary{display:block;margin-top:5px}input{min-width:0;width:100%}table{display:block;overflow-x:auto;white-space:nowrap}th,td{padding:5px 6px;font-size:12px}}</style></head><body><main><header class="top"><div><h1>市场扫描</h1><div class="muted">本轮记录时间：${escapeHTML(recordedTime)} · ${escapeHTML(data.snapshot_note || '本轮快照，不代表自动当前在招')}</div></div><nav class="exports"><a href="market-sweep.md">MD</a><a href="market-sweep.csv">CSV</a><a href="market-sweep.json">JSON</a></nav></header><section class="metrics"><div class="metric"><strong>${data.counts.companies ?? 0}</strong><span>实际检索公司</span></div><div class="metric"><strong>${data.counts.all}</strong><span>岗位记录</span></div><div class="metric"><strong>${data.counts.complete}</strong><span>完整 JD</span></div><div class="metric"><strong>${data.counts.leads}</strong><span>索引线索</span></div><div class="metric"><strong>${data.counts.china}</strong><span>已标国内工作地</span></div><div class="metric warn"><strong>${data.counts.salary_pending}</strong><span>固定底薪待核</span></div></section>${analysisSummaryHTML}<section class="controls"><div role="tablist"><button data-filter="all" aria-selected="true">全部</button><button data-filter="priority" aria-selected="false">优先核实</button><button data-filter="full" aria-selected="false">完整 JD</button><button data-filter="lead" aria-selected="false">线索</button><button data-filter="china" aria-selected="false">中国工作地</button><button data-filter="salary" aria-selected="false">固定底薪确认</button></div><input id="search" type="search" placeholder="搜索公司、岗位、行业或JD正文" aria-label="搜索公司岗位地区"></section><section id="jobs">${jobRows}<p id="empty" class="empty hidden">当前筛选没有结果。</p></section><section class="coverage"><h2>覆盖情况与限制</h2><table><thead><tr><th>公司</th><th>尝试</th><th>状态</th><th>入表数</th><th>原因</th></tr></thead><tbody>${coverage || '<tr><td colspan="5">暂无覆盖记录</td></tr>'}</tbody></table>${data.limitations.map((item) => `<p class="muted">${escapeHTML(item)}</p>`).join('')}</section><footer>分析状态：${escapeHTML(data.analysis.status)} · jobs SHA256：${escapeHTML(data.jobs_sha256)} · context SHA256：${escapeHTML(data.context_sha256 || '无')}</footer></main><script>(()=>{let filter='all',mode='commercial';const cards=[...document.querySelectorAll('.job')],groups=[...document.querySelectorAll('.industry-group')],q=document.querySelector('#search'),empty=document.querySelector('#empty');function update(){const text=q.value.trim().toLowerCase();let n=0;cards.forEach(c=>{const view=mode==='raw'||mode==='commercial'&&c.dataset.commercial==='true'||mode==='review'&&c.dataset.review==='true';const ok=filter==='all'||filter==='priority'&&c.dataset.priority==='优先核实'||filter==='full'&&c.dataset.full==='true'||filter==='lead'&&c.dataset.kind==='search_index'||filter==='china'&&c.dataset.china==='true'||filter==='salary'&&c.dataset.salary==='true';const show=view&&ok&&c.dataset.search.includes(text);c.classList.toggle('hidden',!show);if(show)n++});groups.forEach(g=>g.classList.toggle('hidden',!g.querySelector('.job:not(.hidden)')));empty.classList.toggle('hidden',n!==0);document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.filter===filter)));document.querySelectorAll('[data-sweep-filter]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.sweepFilter===mode)))}document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.filter;update()}));document.querySelectorAll('[data-sweep-filter]').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.sweepFilter;update()}));q.addEventListener('input',update);update()})();</script></body></html>`;
}

export function renderSweepReportCSV(data) {
  const columns = ['id', 'company', 'title', 'industry', 'segment', 'tier', 'tier_label', 'business_line', 'city', 'location', 'salary_raw', 'fixed_salary_status', 'salary_target_status', 'salary_target_reason', 'salary_evidence_status', 'salary_evidence_quote', 'source_kind', 'channel_family', 'contact_name', 'contact_identity_status', 'application_target_key', 'vacancy_group_key', 'duplicate_status', 'duplicate_of', 'description_complete', 'completeness_status', 'job_url', 'apply_url', 'source_url', 'observed_at', 'published_at', 'time_note', 'ownership_note', 'scope_note', 'description', 'requirements', 'evidence_file', 'evidence_quote', 'analysis_status'];
  return '\uFEFF' + [columns.map(csvCell).join(','), ...(data.observations ?? data.jobs).map((job) => columns.map((column) => csvCell(column === 'analysis_status' ? (data.jobs.find((item) => item.id === job.id)?.analysis ? 'valid' : ['absent', 'valid', 'partial'].includes(data.analysis.status) ? '待分析' : data.analysis.status) : job[column])).join(','))].join('\r\n') + '\r\n';
}

export function renderSweepReportMarkdown(data) {
  const lines = ['# 市场扫描', '', `真实观察日期：${data.observed_at}`, data.snapshot_note || '本轮市场扫描快照，不代表自动当前在招状态。', `实际检索公司：${data.counts.companies}；覆盖职位：${data.counts.all}；完整 JD：${data.counts.complete}；索引线索：${data.counts.leads}；固定底薪待核：${data.counts.salary_pending}`, '', ...data.limitations.map((item) => `- ${item}`), '', '## GPT6 全局分析', '', `状态：${data.analysis.status}`, data.analysis.summary ? `摘要：${markdownText(data.analysis.summary)}` : '摘要：待分析', ...(data.analysis.market_summary ?? []).map((item) => `- ${markdownText(item)}`), ...(data.analysis.limitations ?? []).map((item) => `- 分析限制：${markdownText(item)}`), '', '## 职位'];
  let previousGroup = '';
  for (const job of data.jobs) {
    const evidence = localEvidenceHref(job.evidence_file);
    const group = `${job.industry || '行业待核'} / ${job.segment || '赛道待核'} / ${job.tier_label || '地位待核'} / ${job.company || '公司未披露'}`;
    if (group !== previousGroup) lines.push(`## ${markdownText(group)}`, '');
    previousGroup = group;
    lines.push(`- 重点核实：${markdownText(job.attention || '固定底薪、当前招聘有效性及实际职责边界待核')}`, `- 来源归属：${markdownText(job.ownership_note || '待核')}`, `- 时间口径：${markdownText(job.time_note || '本次发现不等于新发布')}`, `- 申请入口：${safeURL(job.apply_url) ? `[打开](${markdownURL(job.apply_url)})` : '尚无单独核验的申请直链，见来源页'}`, '');
    lines.push(`行业：${markdownText(job.industry)} / 赛道：${markdownText(job.segment)} / ${markdownText(job.tier_label)}；联系人：${markdownText(job.contact_name || '待核')}；联系入口原始观察：${job.observation_count}条。`, '');
    lines.push(`### ${markdownText(job.company || '公司未披露')} · ${markdownText(job.title || '职位未披露')}`, `- 薪资：${markdownText(displaySalary(job))}`, `- 地区：${markdownText(job.city || job.location || '未知地区')}`, `- 来源类型：${markdownText(labelSource(job.source_kind))}`, `- 完整 JD：${job.description_complete ? '是' : '否'}；${markdownText(job.completeness_note)}`, `- 岗位链接：${safeURL(job.job_url) ? `[打开](${markdownURL(job.job_url)})` : '无独立岗位链接（使用来源页回查）'}`, `- 来源页：${safeURL(job.source_url) ? `[打开](${markdownURL(job.source_url)})` : '无有效来源链接'}`, `- 本地证据：${evidence ? `[打开](${evidence})` : '不可回查'}`, '', '职责：', ...literalBlock(job.description), '', '要求：', ...literalBlock(job.requirements), '', ...analysisMarkdown(job.analysis), '');
  }
  lines.push('## 覆盖情况与限制', '', '| 公司 | 状态 | 职位数 | 原因 |', '| --- | --- | ---: | --- |');
  for (const row of data.coverage) lines.push(`| ${markdownText(row.company)} | ${markdownText(row.status)} | ${markdownText(row.job_count)} | ${markdownText(row.reason)} |`);
  return lines.join('\n') + '\n';
}

export async function writeSweepReport({ inputDir, outputDir = REPORT_DIR, generatedAt } = {}) {
  const input = await loadSweepInput(inputDir);
  const data = buildSweepReport(input, generatedAt);
  const output = resolve(outputDir);
  const allowed = resolve(REPORT_DIR);
  if (output !== allowed && !output.startsWith(`${allowed}${sep}`)) throw new Error('Sweep output must stay in official-careers/reports');
  await mkdir(output, { recursive: true });
  const files = { 'market-sweep.json': JSON.stringify(data, null, 2) + '\n', 'market-sweep.html': renderSweepReportHTML(data), 'market-sweep.csv': renderSweepReportCSV(data), 'market-sweep.md': renderSweepReportMarkdown(data) };
  for (const [name, content] of Object.entries(files)) {
    const destination = join(output, name);
    const temporary = `${destination}.${randomUUID()}.tmp`;
    await writeFile(temporary, content);
    await rename(temporary, destination);
  }
  return { ok: true, reports: Object.keys(files).map((name) => repoRelative(join(output, name))), counts: data.counts, analysis: data.analysis.status };
}

export function parseArgs(argv = process.argv.slice(2)) {
  const index = argv.indexOf('--input');
  if (index < 0 || !argv[index + 1]) throw new Error('Usage: node careers/sweep-report.mjs --input <research-dir>');
  return { inputDir: argv[index + 1] };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeSweepReport(parseArgs()).then((result) => process.stdout.write(`${JSON.stringify(result)}\n`)).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
