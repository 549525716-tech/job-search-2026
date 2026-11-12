import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, REPORT_DIR } from './paths.mjs';
import { escapeHTML, safeURL, csvCell } from './sweep-report.mjs';
import { parseSalary } from './salary.mjs';
import { evaluateSalaryTarget } from './salary-target.mjs';

const REQUIRED_INPUTS = [
  '01_行情收集/official-careers/reports/coverage-jobs.json',
  '02_岗位画像/我的当前情况总结.md',
  '02_岗位画像/data/我的能力画像.json',
  'careers/config/preferences.json',
  'careers/config/career-strategy.json',
];
const PRIORITIES = new Set(['优先核实', '条件冲刺', '暂不主攻']);
const SALARY_STATUSES = new Set(['unknown', 'below_target', 'meets_target']);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value, label, max = 12000) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`INVALID_${label}`);
  return value;
};
const array = (value, label) => { if (!Array.isArray(value)) throw new Error(`INVALID_${label}`); return value; };

function projectPath(path, root = ROOT) {
  if (typeof path !== 'string' || !path || isAbsolute(path)) throw new Error('PROJECT_RELATIVE_PATH_REQUIRED');
  const projectRoot = resolve(root);
  const absolute = resolve(projectRoot, path);
  if (absolute !== projectRoot && !absolute.startsWith(projectRoot + sep)) throw new Error('PATH_ESCAPES_PROJECT');
  return absolute;
}

function analysisPath(path, root = ROOT) {
  const absolute = projectPath(path, root);
  const research = join(root, '01_行情收集', 'official-careers', 'research');
  if (!absolute.startsWith(research + sep) || !absolute.endsWith('.json')) throw new Error('ANALYSIS_MUST_STAY_IN_RESEARCH');
  return absolute;
}

async function frozenInputs(analysis, root, read) {
  const files = array(analysis.input_files, 'INPUT_FILES');
  const entries = new Map();
  for (const entry of files) {
    if (!isObject(entry) || typeof entry.path !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256 ?? '')) throw new Error('INVALID_INPUT_FILE');
    if (entries.has(entry.path)) throw new Error('DUPLICATE_INPUT_FILE');
    entries.set(entry.path, entry);
  }
  if (entries.size !== REQUIRED_INPUTS.length || REQUIRED_INPUTS.some((path) => !entries.has(path))) throw new Error('REQUIRED_INPUT_FILES_MISSING');
  const result = new Map();
  for (const path of REQUIRED_INPUTS) {
    const bytes = await read(projectPath(path, root));
    if (sha256(bytes) !== entries.get(path).sha256) throw new Error(`INPUT_SHA_MISMATCH:${path}`);
    result.set(path, bytes);
  }
  return result;
}

function sourceText(job) { return ['source_role_text', 'description', 'requirements', 'title'].map((key) => String(job[key] ?? '')); }
function completeJD(job) { return job.description_complete === true && job.source_kind !== 'search_index'; }
function salarySourceEvidence(job) {
  const baseMarker = /(?:固定(?:月薪|底薪|薪资|工资)|月固定(?:薪资|工资)|底薪|基本工资|基础工资)/i;
  const normalizeLine = (line) => line.trim().replace(/^(?:[*+-]|\d+[、.)])\s*/, '').trim();
  return [...new Set(sourceText(job).flatMap((field) => field.split(/\r?\n/).map(normalizeLine)).filter((line) => line && baseMarker.test(line)))];
}

function salaryAssessment(job, rule) {
  const source_quotes = salarySourceEvidence(job);
  if (!source_quotes.length) return { status: 'unknown', reason: 'salary_raw_or_model_claim_is_not_bound_to_complete_job_source_line', source_quote: null };
  if (source_quotes.length !== 1) return { status: 'unknown', reason: 'conflicting_or_multiple_fixed_salary_source_statements', source_quote: null, source_quotes };
  const source_quote = source_quotes[0];
  const parsed = parseSalary(source_quote, { currency: job.salary_currency, period: job.salary_period });
  const result = evaluateSalaryTarget({ salary_raw: parsed.salary_raw, currency: parsed.salary_currency, period: parsed.salary_period,
    min: parsed.salary_min, max: parsed.salary_max, status: parsed.salary_status, kind: parsed.salary_kind }, rule);
  if (result.eligible) return { status: 'meets_target', reason: result.reason, source_quote };
  if (result.status === 'below_target') return { status: 'below_target', reason: result.reason, source_quote };
  return { status: 'unknown', reason: result.reason, source_quote };
}

function validateReview(review, analysisBytes, execution) {
  if (!isObject(review) || review.analysis_sha256 !== sha256(analysisBytes) || typeof review.reviewer_id !== 'string' || !review.reviewer_id
    || review.reviewer_id === execution.agent_id || review.model !== 'gpt-6-astra' || review.reasoning_effort !== 'xhigh'
    || review.verdict !== 'passed' || typeof review.scope !== 'string' || !review.scope.trim()) throw new Error('INVALID_INDEPENDENT_REVIEW');
  return { status: 'passed', reviewer_id: review.reviewer_id, scope: review.scope };
}

export function validatePersonalMatchAnalysis(analysis, { inputBytes, dispatch, analysisBytes, review = null }) {
  if (!isObject(analysis) || analysis.schema_version !== 1 || typeof analysis.created_at !== 'string') throw new Error('INVALID_ANALYSIS_SCHEMA');
  const execution = analysis.execution;
  if (!isObject(execution) || execution.model !== 'gpt-6-astra' || execution.reasoning_effort !== 'xhigh' || typeof execution.agent_id !== 'string' || !execution.agent_id.trim()) throw new Error('INVALID_EXECUTION');
  if (!isObject(dispatch) || dispatch.agent_id !== execution.agent_id || dispatch.model !== execution.model || dispatch.reasoning_effort !== execution.reasoning_effort) throw new Error('DISPATCH_DOES_NOT_MATCH_EXECUTION');
  text(analysis.summary, 'SUMMARY');
  for (const key of ['market_summary', 'limitations']) array(analysis[key], key.toUpperCase()).forEach((value) => {
    if (!(typeof value === 'string' ? value.trim() : isObject(value))) throw new Error(`INVALID_${key.toUpperCase()}_ITEM`);
  });
  const coverage = JSON.parse(inputBytes.get(REQUIRED_INPUTS[0]).toString('utf8'));
  if (!Array.isArray(coverage)) throw new Error('COVERAGE_JOBS_ARRAY_REQUIRED');
  const jobs = new Map();
  for (const job of coverage) {
    const key = `${job.research_directory}#${job.raw_observation_index}`;
    if (jobs.has(key)) throw new Error('DUPLICATE_COVERAGE_OBSERVATION_KEY');
    jobs.set(key, job);
  }
  const factText = new Map(REQUIRED_INPUTS.slice(1, 3).map((path) => [path, inputBytes.get(path).toString('utf8')]));
  const preferences = JSON.parse(inputBytes.get('careers/config/preferences.json').toString('utf8'));
  const priorities = array(analysis.priorities, 'PRIORITIES');
  if (priorities.length > 20) throw new Error('PRIORITY_LIMIT_EXCEEDED');
  const seen = new Set();
  const validated = priorities.map((item) => {
    if (!isObject(item) || seen.has(item.observation_key)) throw new Error('INVALID_OR_DUPLICATE_PRIORITY');
    seen.add(item.observation_key);
    const job = jobs.get(item.observation_key);
    if (!job || item.job_id !== job.id || item.company !== job.company || item.title !== job.title) throw new Error('OBSERVATION_IDENTITY_MISMATCH');
    if (!PRIORITIES.has(item.priority)) throw new Error('INVALID_PRIORITY');
    if (item.priority === '优先核实' && !completeJD(job)) throw new Error('INCOMPLETE_JD_CANNOT_BE_PRIORITY');
    text(item.role_mission, 'ROLE_MISSION');
    const jobQuotes = array(item.job_quotes, 'JOB_QUOTES');
    if (jobQuotes.length < 2) throw new Error('TWO_CONTINUOUS_JOB_QUOTES_REQUIRED');
    for (const quote of jobQuotes) if (!text(quote, 'JOB_QUOTE') || !sourceText(job).some((field) => field.includes(quote))) throw new Error('JOB_QUOTE_NOT_IN_SOURCE');
    const factQuotes = array(item.fact_quotes, 'FACT_QUOTES');
    if (factQuotes.length < 1) throw new Error('FACT_QUOTE_REQUIRED');
    for (const quote of factQuotes) {
      if (!isObject(quote) || !factText.has(quote.path) || !text(quote.quote, 'FACT_QUOTE') || !factText.get(quote.path).includes(quote.quote)) throw new Error('FACT_QUOTE_NOT_IN_BOUND_FACTS');
    }
    for (const key of ['direct_evidence', 'transferable_evidence', 'gaps', 'hard_gates', 'resume_advice', 'questions']) array(item[key], key.toUpperCase()).forEach((value) => text(value, key.toUpperCase()));
    if (!((typeof item.management_fit === 'string' && item.management_fit.trim()) || isObject(item.management_fit))
      || !((typeof item.ai_fit === 'string' && item.ai_fit.trim()) || isObject(item.ai_fit))) throw new Error('FIT_VALUE_REQUIRED');
    if (!isObject(item.salary_assessment) || !SALARY_STATUSES.has(item.salary_assessment.status) || typeof item.salary_assessment.reason !== 'string') throw new Error('INVALID_SALARY_ASSESSMENT');
    text(item.recommended_next_step, 'RECOMMENDED_NEXT_STEP');
    const salary_verification = salaryAssessment(job, preferences.salary);
    return { ...item, city: job.city ?? job.location ?? '', observed_at: job.observed_at ?? '', raw_job: job,
      jd_status: completeJD(job) ? 'complete' : 'pending_incomplete', salary_verification };
  });
  return { ...analysis, priorities: validated, review: review ? validateReview(review, analysisBytes, execution) : { status: 'draft_pending_independent_review' } };
}

function printable(value) { return typeof value === 'string' ? value : JSON.stringify(value); }
function list(values) { return values.length ? `<ul>${values.map((value) => `<li>${escapeHTML(printable(value))}</li>`).join('')}</ul>` : '<span class="muted">未提供</span>'; }
function link(url, label) { return safeURL(url) ? `<a href="${escapeHTML(safeURL(url))}" target="_blank" rel="noopener noreferrer">${escapeHTML(label)}</a>` : ''; }
function salaryLabel(item) { return item.salary_verification.status === 'meets_target' ? '固定底薪已核验20K+' : item.salary_verification.status === 'below_target' ? '固定底薪低于目标' : '固定底薪待核'; }
function reportHTML(report) {
  const cards = report.priorities.map((item) => `<article class="match" data-priority="${escapeHTML(item.priority)}" data-search="${escapeHTML([item.company,item.title,item.city,item.role_mission,...item.direct_evidence,...item.transferable_evidence,...item.gaps].join(' ').toLowerCase())}">
<header><div><h2>${escapeHTML(item.title)}</h2><p>${escapeHTML(item.company)} · ${escapeHTML(item.city || '地点未披露')} · 读取 ${escapeHTML(item.observed_at || '时间未核')}</p></div><div><b class="priority">${escapeHTML(item.priority)}</b><strong>${escapeHTML(salaryLabel(item))}</strong></div></header>
<p><b>薪资原文：</b>${escapeHTML(item.raw_job.salary_raw || '未披露')}<br><b>固定底薪核验：</b>${escapeHTML(salaryLabel(item))}；${escapeHTML(item.salary_verification.reason)}${item.salary_verification.source_quote ? `；岗位原文：${escapeHTML(item.salary_verification.source_quote)}` : ''}<br><b>模型薪资解释：</b>${escapeHTML(item.salary_assessment.status)}；${escapeHTML(item.salary_assessment.reason)}</p>
<p><b>岗位使命：</b>${escapeHTML(item.role_mission)} · ${item.jd_status === 'complete' ? 'JD职责与任职要求已取得' : 'JD不完整，仅待核分析，非正式优先建议'}</p><div class="grid"><section><h3>重点门槛</h3>${list(item.hard_gates)}</section><section><h3>管理结论</h3><p>${escapeHTML(printable(item.management_fit))}</p><h3>AI适配</h3><p>${escapeHTML(printable(item.ai_fit))}</p></section><section><h3>直接证据</h3>${list(item.direct_evidence)}<h3>可迁移证据</h3>${list(item.transferable_evidence)}</section><section><h3>关键缺口</h3>${list(item.gaps)}<h3>简历建议</h3>${list(item.resume_advice)}</section></div>
<p><b>下一步：</b>${escapeHTML(item.recommended_next_step)}</p><details><summary>原 JD、事实引用、问题与可回查来源</summary><p><b>职位引用</b></p>${list(item.job_quotes)}<p><b>个人事实引用</b></p>${list(item.fact_quotes.map((quote) => `${quote.path}: ${quote.quote}`))}<p><b>待确认问题</b></p>${list(item.questions)}<p>${link(item.raw_job.job_url, '职位链接')} ${link(item.raw_job.apply_url, '申请入口')} ${link(item.raw_job.source_url, '原始来源')} · 原始来源不等于职位直链</p><h3>岗位定位原文</h3><pre>${escapeHTML(item.raw_job.source_role_text || '未取得')}</pre><h3>岗位正文</h3><pre>${escapeHTML(item.raw_job.description || '未取得')}</pre><h3>任职 / 共性要求</h3><pre>${escapeHTML(item.raw_job.requirements || '未取得')}</pre></details></article>`).join('');
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>个人岗位匹配</title><style>*{box-sizing:border-box}body{margin:0;color:#20282b;background:#fff;font:14px/1.55 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif}main{max-width:1320px;margin:auto;padding:22px 24px}h1{font-size:24px;margin:0}h2{font-size:17px;margin:0}h3{font-size:13px;margin:0 0 4px;color:#516064}p{margin:6px 0}.muted{color:#687478}.notice{border-left:4px solid #a06b16;background:#fff8e8;padding:9px 12px;margin:13px 0}.toolbar{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:15px 0}input,button{font:inherit}input{padding:8px 10px;border:1px solid #aab4b8;border-radius:4px;min-width:280px}button{border:1px solid #9da9ad;background:#fff;padding:7px 10px;border-radius:4px;cursor:pointer}button[aria-pressed=true]{background:#006a68;color:#fff;border-color:#006a68}.match{border-top:1px solid #d9e0e2;padding:15px 0}.match header{display:flex;justify-content:space-between;gap:14px}.match header>div:last-child{text-align:right}.priority{display:block;color:#006a68}.match strong{font-size:12px;color:#8a5110}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin:10px 0}.grid section{border-left:2px solid #d9e4e3;padding-left:9px}ul{margin:4px 0;padding-left:18px}details{margin-top:10px}summary{cursor:pointer;color:#006a68}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f5f7f7;padding:8px}a{color:#006a68}[hidden]{display:none!important}@media(max-width:800px){main{padding:16px 12px}.grid{grid-template-columns:1fr 1fr}.match header{display:block}.match header>div:last-child{text-align:left;margin-top:5px}}@media(max-width:480px){.grid{grid-template-columns:1fr}input{min-width:0;width:100%}}</style><main><h1>个人岗位匹配</h1><p class="muted">累计岗位库中的证据匹配 · ${escapeHTML(report.created_at)}</p><div class="notice"><b>${report.review.status === 'passed' ? '已通过独立复核。' : '草稿待独立复核。'}</b> 仅提供核实和材料建议，不代表已审批、已投递或录用。薪资必须有原文明确固定月薪证据。</div><p>${escapeHTML(report.summary)}</p><div class="toolbar"><input type="search" aria-label="搜索个人匹配" placeholder="公司、岗位、证据、缺口"><button data-filter="all" aria-pressed="true">全部</button>${[...PRIORITIES].map((value) => `<button data-filter="${escapeHTML(value)}" aria-pressed="false">${escapeHTML(value)}</button>`).join('')}<span id="count"></span></div><section id="matches">${cards || '<p class="muted">当前分析没有优先事项。</p>'}</section></main><script>let filter='all';const input=document.querySelector('input'),buttons=document.querySelectorAll('button'),cards=document.querySelectorAll('.match'),count=document.querySelector('#count');function update(){let n=0;for(const card of cards){const show=(filter==='all'||card.dataset.priority===filter)&&card.dataset.search.includes(input.value.toLowerCase().trim());card.hidden=!show;if(show)n++}count.textContent=n+' 条显示'}for(const button of buttons)button.onclick=()=>{filter=button.dataset.filter;for(const x of buttons)x.setAttribute('aria-pressed',String(x===button));update()};input.oninput=update;update()</script></main>`;
}

function markdown(report) { const line = (label, value) => `- ${label}：${value || '未披露'}`; return `# 个人岗位匹配\n\n${report.review.status === 'passed' ? '独立复核：已通过。' : '独立复核：草稿待复核。'} 不代表已审批、已投递或录用。\n\n${report.summary}\n\n${report.priorities.map((item) => `## ${item.priority}｜${item.company}｜${item.title}\n\n${line('观察键', item.observation_key)}\n${line('地点', item.city)}\n${line('读取时间', item.observed_at)}\n${line('JD状态', item.jd_status)}\n${line('薪资原文', item.raw_job.salary_raw)}\n${line('固定底薪核验', `${item.salary_verification.status}（${item.salary_verification.reason}）`)}\n${line('岗位级薪资引用', item.salary_verification.source_quote)}\n${line('模型薪资解释', `${item.salary_assessment.status}（${item.salary_assessment.reason}）`)}\n${line('岗位使命', item.role_mission)}\n${line('管理结论', printable(item.management_fit))}\n${line('AI适配', printable(item.ai_fit))}\n${line('职位链接', item.raw_job.job_url)}\n${line('申请入口', item.raw_job.apply_url)}\n${line('原始来源', item.raw_job.source_url)}\n\n### 重点门槛\n${item.hard_gates.map((x) => `- ${x}`).join('\n')}\n\n### 直接证据\n${item.direct_evidence.map((x) => `- ${x}`).join('\n')}\n\n### 可迁移证据\n${item.transferable_evidence.map((x) => `- ${x}`).join('\n')}\n\n### 关键缺口\n${item.gaps.map((x) => `- ${x}`).join('\n')}\n\n### 简历建议\n${item.resume_advice.map((x) => `- ${x}`).join('\n')}\n\n### 待确认问题\n${item.questions.map((x) => `- ${x}`).join('\n') || '- 未提供'}\n\n### 岗位正文\n\n${item.raw_job.source_role_text || item.raw_job.description || '未取得'}\n\n### 任职 / 共性要求\n\n${item.raw_job.requirements || '未取得'}\n\n### 职位引用\n${item.job_quotes.map((x) => `- ${x}`).join('\n')}\n\n### 个人事实引用\n${item.fact_quotes.map((x) => `- ${x.path}: ${x.quote}`).join('\n')}\n\n${line('下一步', item.recommended_next_step)}\n`).join('\n')}`; }
function csv(report) { const cols = ['observation_key','priority','jd_status','company','title','city','observed_at','salary_raw','salary_verification_status','salary_verification_reason','salary_source_quote','model_salary_status','model_salary_reason','role_mission','hard_gates','management_fit','ai_fit','direct_evidence','transferable_evidence','gaps','resume_advice','questions','recommended_next_step','job_url','apply_url','source_url','source_role_text','description','requirements','job_quotes','fact_quotes']; return '\uFEFF' + [cols.map(csvCell).join(','), ...report.priorities.map((item) => cols.map((key) => { const value = ({ salary_verification_status: item.salary_verification.status, salary_verification_reason: item.salary_verification.reason, salary_source_quote: item.salary_verification.source_quote, model_salary_status: item.salary_assessment.status, model_salary_reason: item.salary_assessment.reason, management_fit: printable(item.management_fit), ai_fit: printable(item.ai_fit), fact_quotes: item.fact_quotes.map((x) => `${x.path}: ${x.quote}`).join(' | '), ...item, ...item.raw_job })[key]; return csvCell(Array.isArray(value) ? value.map(printable).join(' | ') : value ?? ''); }).join(','))].join('\r\n'); }

function completeMarkdown(report) {
  const section = (title, values) => `### ${title}\n${values.length ? values.map((value) => `- ${printable(value)}`).join('\n') : '- 未提供'}`;
  return `# 个人岗位匹配\n\n${report.review.status === 'passed' ? '独立复核：已通过。' : '独立复核：草稿待复核。'} 不代表已审批、已投递或录用。\n\n${report.summary}\n\n${report.priorities.map((item) => `## ${item.priority}｜${item.company}｜${item.title}\n\n- 观察键：${item.observation_key}\n- 地点：${item.city || '未披露'}\n- 读取时间：${item.observed_at || '未核'}\n- JD状态：${item.jd_status}\n- 薪资原文：${item.raw_job.salary_raw || '未披露'}\n- 固定底薪核验：${item.salary_verification.status}（${item.salary_verification.reason}）\n- 岗位级薪资引用：${item.salary_verification.source_quote || '无'}\n- 模型薪资解释：${item.salary_assessment.status}（${item.salary_assessment.reason}）\n- 岗位使命：${item.role_mission}\n- 管理结论：${printable(item.management_fit)}\n- AI适配：${printable(item.ai_fit)}\n- 职位链接：${item.raw_job.job_url || '未披露'}\n- 申请入口：${item.raw_job.apply_url || '未披露'}\n- 原始来源：${item.raw_job.source_url || '未披露'}（不等于职位直链）\n\n${section('重点门槛', item.hard_gates)}\n\n${section('直接证据', item.direct_evidence)}\n\n${section('可迁移证据', item.transferable_evidence)}\n\n${section('关键缺口', item.gaps)}\n\n${section('简历建议', item.resume_advice)}\n\n${section('待确认问题', item.questions)}\n\n### 岗位定位原文\n\n${item.raw_job.source_role_text || '未取得'}\n\n### 岗位正文\n\n${item.raw_job.description || '未取得'}\n\n### 任职 / 共性要求\n\n${item.raw_job.requirements || '未取得'}\n\n${section('职位引用', item.job_quotes)}\n\n${section('个人事实引用', item.fact_quotes.map((quote) => `${quote.path}: ${quote.quote}`))}\n\n- 下一步：${item.recommended_next_step}\n`).join('\n')}`;
}

export async function writePersonalMatchReport(input, { root = ROOT, read = readFile, write = writeFile, exists = existsSync } = {}) {
  const inputFile = analysisPath(input, root); const analysisBytes = await read(inputFile); const analysis = JSON.parse(analysisBytes.toString('utf8'));
  const inputBytes = await frozenInputs(analysis, root, read); const directory = dirname(inputFile); const dispatch = JSON.parse((await read(join(directory, 'dispatch.json')).catch(() => { throw new Error('DISPATCH_REQUIRED'); })).toString('utf8'));
  const reviewPath = join(directory, 'review.json'); const review = exists(reviewPath) ? JSON.parse((await read(reviewPath)).toString('utf8')) : null;
  const report = validatePersonalMatchAnalysis(analysis, { inputBytes, dispatch, analysisBytes, review }); await mkdir(join(root, '01_行情收集', 'official-careers', 'reports'), { recursive: true });
  const out = join(root, '01_行情收集', 'official-careers', 'reports'); await write(join(out, 'personal-matches.json'), JSON.stringify(report, null, 2) + '\n'); await write(join(out, 'personal-matches.html'), reportHTML(report)); await write(join(out, 'personal-matches.csv'), csv(report)); await write(join(out, 'personal-matches.md'), completeMarkdown(report));
  return { priorities: report.priorities.length, review: report.review.status, output: relative(root, join(out, 'personal-matches.html')).split('\\\\').join('/') };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) { const index = process.argv.indexOf('--input'); if (index < 0 || !process.argv[index + 1]) throw new Error('USAGE: node careers/personal-match-report.mjs --input <analysis.json>'); writePersonalMatchReport(process.argv[index + 1]).then(console.log).catch((error) => { console.error(error.message); process.exitCode = 1; }); }
