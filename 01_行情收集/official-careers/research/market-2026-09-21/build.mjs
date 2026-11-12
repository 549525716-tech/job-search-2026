#!/usr/bin/env node
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const RAW = join(ROOT, 'raw');
const PREVIOUS = join(ROOT, '..', 'market-2026-09-20', 'jobs.json');
const EXECUTION = {
  prior_extraction: { executor: 'gpt-5.6-luna', reasoning_effort: 'medium', role: 'offline extraction' },
  revision_receipt: { executor: 'gpt-5.6-terra', reasoning_effort: 'medium', role: 'offline boundary repair' },
  integration_revision: { executor: 'current Codex main session; model not independently verified', role: 'synthetic native ID and company evidence corrections' },
  network_requests: 0,
  browser_requests: 0
};
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
// Evidence paths are a stable project-root contract, independent of invocation cwd.
const rel = path => relative(PROJECT_ROOT, path);

export function captureLines(text) {
  const lines = new Map();
  for (const [, number, value] of String(text).matchAll(/(?:^|\s)L(\d+):[ \t]?([\s\S]*?)(?=\sL\d+:|$)/g)) {
    const n = Number(number), v = value.trimEnd();
    if (lines.has(n) && lines.get(n) !== v) throw new Error(`CONFLICTING_LINE_${n}`);
    lines.set(n, v);
  }
  return lines;
}
export function captureRange(lines, range) {
  if (range == null) return null;
  const [from, to = from] = Array.isArray(range) ? range : [range];
  const out = [];
  for (let n = from; n <= to; n++) {
    if (!lines.has(n)) throw new Error(`MISSING_SOURCE_LINE_${n}`);
    out.push(lines.get(n));
  }
  return out.join('\n').trim();
}
function lineEntries(lines) { return [...lines.keys()].sort((a, b) => a - b); }
function firstLine(lines, predicate, from = 0) { return lineEntries(lines).find(n => n >= from && predicate(lines.get(n))); }
function lastLine(lines) { return Math.max(...lineEntries(lines)); }
function range(lines, from, to) { return from == null ? null : captureRange(lines, [from, to ?? from]); }
function urlOf(result) { return String(result).match(/^.*?\((https?:\/\/[^)]+)\)/)?.[1] ?? null; }
function source(rawName, bytes, raw) {
  return { evidence_file: rel(join(RAW, rawName)), evidence_sha256: sha256(bytes), source_url: urlOf(raw.result), observed_at: raw.observed_at ?? null };
}
function quote(lines, lineRange) {
  if (!lineRange) return null;
  if (Array.isArray(lineRange) && Array.isArray(lineRange[0])) return lineRange.map(part => captureRange(lines, part)).join('\n\n');
  return captureRange(lines, lineRange);
}
function evidence(src, lines, fields) {
  return Object.fromEntries(Object.entries(fields).map(([field, lineRange]) => [field, {
    evidence_file: src.evidence_file, evidence_sha256: src.evidence_sha256,
    line_range: lineRange, quote: quote(lines, lineRange)
  }]));
}
function baseJob(src, lines, spec) {
  const ranges = spec.evidence_line_ranges;
  const ev = evidence(src, lines, ranges);
  const job = {
    id: spec.id,
    observation_key: `${spec.id}:${src.evidence_sha256}`,
    native_id: spec.native_id ?? null,
    company: spec.company,
    title: spec.title,
    city: spec.city ?? null,
    location: spec.location ?? null,
    industry: spec.industry ?? null,
    discovery_industry: spec.discovery_industry ?? null,
    salary_raw: spec.salary_raw ?? null,
    recruitment_type: spec.recruitment_type ?? null,
    education: spec.education ?? null,
    description: spec.description ?? null,
    requirements: spec.requirements ?? null,
    description_complete: Boolean(spec.description_complete),
    job_url: spec.job_url ?? null,
    source_url: src.source_url,
    apply_url: spec.apply_url ?? null,
    observed_at: src.observed_at,
    evidence_file: src.evidence_file,
    evidence_sha256: src.evidence_sha256,
    company_facts_quote: spec.company_facts_quote ?? null,
    hr_display_name: spec.hr_display_name ?? null,
    scope_note: spec.scope_note ?? null,
    attention: spec.attention ?? null,
    time_note: spec.time_note ?? '本次离线读取时间；未据此推断新发布或当前开放状态。',
    evidence_line_ranges: ranges,
    field_evidence: ev,
    source_kind: spec.source_kind,
    source_status: spec.source_status,
    execution: EXECUTION
  };
  return job;
}
function headingTitle(value) { return value.replace(/^#+\s*/, '').replace(/\s+(?:社招\/校招|实习)$/, '').trim(); }
function parseOfficialMulti(rawName, bytes, raw, kind) {
  const lines = captureLines(raw.result), src = source(rawName, bytes, raw), max = lastLine(lines);
  const isNoumena = kind === 'noumena';
  const company = isNoumena ? 'Noumena（物自体）' : '飞轮科技';
  const pageIndustry = isNoumena ? 'AI 科技公司' : '实时数据仓库技术';
  const companyFacts = isNoumena ? [4, 10] : [2, 12];
  const starts = lineEntries(lines).filter(n => isNoumena ? /^\d{2} · /.test(lines.get(n)) || /^(AI |资深商务|研发实习生|AI 产品运营|招聘经理|出海商业化|小红书线索)/.test(lines.get(n)) : /^### /.test(lines.get(n)));
  const actualStarts = isNoumena ? [43, 59, 76, 91, 106, 121, 146, 169, 192] : starts;
  const jobs = [];
  for (let i = 0; i < actualStarts.length; i++) {
    const start = actualStarts[i], end = (actualStarts[i + 1] ?? (isNoumena ? 214 : max + 1)) - 1;
    const whole = captureRange(lines, [start, end]);
    if (!whole || (isNoumena && /^\d{2} · /.test(whole))) continue;
    const titleLine = start;
    const rawTitle = lines.get(titleLine);
    const title = isNoumena
      ? rawTitle.split(/(?=业务诊断|独立拿单|Agent|探索|产品运营|业务型招聘|深圳\s*\/|聚光竞价)/)[0].trim()
      : headingTitle(rawTitle);
    const locationLine = lineEntries(lines).find(n => n >= start && n <= end && /工作地点：|^📍/.test(lines.get(n)));
    const commonLocationLine = isNoumena ? 39 : null;
    const statedLocation = locationLine ? lines.get(locationLine).replace(/^(?:工作地点：|📍\s*)/, '').trim() : null;
    const city = statedLocation ? statedLocation.split('。', 1)[0].trim() : (isNoumena ? '上海' : null);
    const roleReq = firstLine(lines, v => /我们期待你|岗位要求：/.test(v), start);
    const roleDesc = firstLine(lines, v => /你将负责|工作职责：/.test(v), start);
    const requirements = isNoumena ? [range(lines, 12, 34), range(lines, roleReq, end)].filter(Boolean).join('\n\n') : range(lines, roleReq, end);
    const id = `${isNoumena ? 'noumena' : 'selectdb'}:l${start}`;
    jobs.push(baseJob(src, lines, {
      id, native_id: null, company, title, city, location: statedLocation ?? (isNoumena ? lines.get(commonLocationLine) : null),
      industry: pageIndustry, discovery_industry: pageIndustry, description: whole, requirements,
      description_complete: true, company_facts_quote: quote(lines, companyFacts),
      source_kind: 'official_careers_page', source_status: 'success',
      job_url: null, apply_url: isNoumena ? null : null,
      scope_note: isNoumena ? '官网整页开放岗位；保留产品、工程、实习、招聘及投放等全部明示岗位。仅将页面明确的工作地点绑定到对应岗位；页头上海说明不覆盖岗位标题中的城市。' : '官网整页明示岗位；保留技术、产品、销售、渠道及实习岗位。综合招聘页不是职位级直链。',
      attention: /产品经理/.test(title) ? '原始岗位保留；未做展示筛除。' : null,
      evidence_line_ranges: { title: [titleLine, titleLine], location: locationLine ? [locationLine, locationLine] : (commonLocationLine ? [commonLocationLine, commonLocationLine] : null), description: [start, end], requirements: isNoumena ? [[12, 34], [roleReq, end]] : [roleReq, end], company_facts: companyFacts }
    }));
  }
  return { jobs, src, lines };
}
function parseHoteamPage(rawName, bytes, raw) {
  const lines = captureLines(raw.result), src = source(rawName, bytes, raw);
  const candidates = lineEntries(lines).filter(start => {
    if (start < 460) return false;
    const title = lines.get(start);
    const city = lines.get(start + 2);
    const category = lines.get(start + 4);
    const education = lines.get(start + 6);
    return Boolean(title && city && category && education)
      && !/^(简历投递|岗位职责：|岗位要求：|任职要求：|职位名称|工作地点|职位类别|学历)$/.test(title)
      && /^(销售|售前咨询|实施交付|软件研发|技术支持|管理职能)$/.test(category)
      && /以上$/.test(education);
  });
  const jobs = candidates.map((start, index) => {
    const end = (candidates[index + 1] ?? firstLine(lines, value => /上一页|下一页/.test(value), start) ?? lastLine(lines) + 1) - 1;
    const title = lines.get(start);
    const city = lines.get(start + 2);
    const education = lines.get(start + 6);
    const responsibility = firstLine(lines, value => /^岗位职责：$/.test(value), start);
    const requirement = firstLine(lines, value => /^(岗位要求：|任职要求：)$/.test(value), start);
    const nextBoundary = firstLine(lines, value => /^简历投递邮箱：/.test(value), requirement ?? start);
    const companyLine = firstLine(lines, value => value.includes('山东山大华天软件股份有限公司'));
    return baseJob(src, lines, {
      id: `hoteamsoft:${rawName}:l${start}`,
      native_id: null,
      company: '华天软件', title, city, location: city,
      industry: '智能制造软件', discovery_industry: '智能制造软件',
      description: captureRange(lines, [start, end]),
      requirements: range(lines, requirement, (nextBoundary ?? end) - 1),
      description_complete: true, job_url: null, apply_url: null,
      source_kind: 'official_careers_page', source_status: 'success', education,
      company_facts_quote: range(lines, companyLine, companyLine),
      scope_note: `华天官网招聘列表第${({ 'o16.json': 1, 'o17.json': 2, 'o18.json': 3, 'o19r.json': 4 })[rawName]}页的明确岗位；公司招聘页不是职位级直链。`,
      attention: null,
      evidence_line_ranges: {
        title: [start, start], location: [start + 2, start + 2], education: [start + 6, start + 6],
        description: [start, end], requirements: requirement ? [requirement, (nextBoundary ?? end) - 1] : null,
        company_facts: companyLine == null ? null : [companyLine, companyLine]
      }
    });
  });
  return { jobs, src, status: 'success', reason: `official recruitment page ${rawName}; ${jobs.length} explicit jobs` };
}
function parseSingle(rawName, bytes, raw, spec) {
  const lines = captureLines(raw.result), src = source(rawName, bytes, raw);
  const all = lineEntries(lines), max = lastLine(lines);
  const text = n => lines.get(n) ?? '';
  const job = baseJob(src, lines, { ...spec, source_status: spec.source_status ?? 'success' });
  job.field_evidence = evidence(src, lines, spec.evidence_line_ranges);
  return { jobs: [job], src, lines, max, text };
}
function parseKnown(rawName, bytes, raw) {
  const result = String(raw.result ?? '');
  if (rawName === 'o01.json') return { jobs: [], src: source(rawName, bytes, raw), status: 'not_recruitment_document', reason: 'OpenAI product diagnostic document; not a recruitment source and not an unscanned job page' };
  if (rawName === 'o02.json') return parseOfficialMulti(rawName, bytes, raw, 'noumena');
  if (rawName === 'o05.json') return parseOfficialMulti(rawName, bytes, raw, 'selectdb');
  if (rawName === 'o08.json' || /Timeout fetching/.test(result)) return { jobs: [], src: source(rawName, bytes, raw), status: 'failed', reason: 'source timeout; no zero-job inference' };
  if (rawName === 'o11.json') return { jobs: [], src: source(rawName, bytes, raw), status: 'partial', reason: 'official ByteDance entry returned zero lines; not confirmation of JD', application_url: 'https://jobs.bytedance.com/experienced/position/7673717322767501621/detail' };
  if (rawName === 'o12.json') return { jobs: [], src: source(rawName, bytes, raw), status: 'failed', reason: 'official NetEase entry refused/non-retryable read; application URL observed but current detail not verified', application_url: 'https://hr.163.com/job-detail.html?id=77241' };
  const lines = captureLines(result), src = source(rawName, bytes, raw);
  if (/^o1[6-8]\.json$/.test(rawName) || rawName === 'o19r.json') return parseHoteamPage(rawName, bytes, raw);
  if (rawName === 'o03.json') return { ...parseSingle(rawName, bytes, raw, {
    id: 'bytedance:7673717322767501621', native_id: '7673717322767501621', company: '字节跳动', title: '企业AI落地专家（SMB方向） - 飞书商业化', city: '深圳、上海、北京、成都、杭州', location: '深圳、上海、北京、成都、杭州', industry: null, discovery_industry: null,
    salary_raw: null, description: null, requirements: captureRange(lines, [40, 45]), description_complete: false, job_url: src.source_url, apply_url: 'https://jobs.bytedance.com/experienced/position/7673717322767501621/detail', company_facts_quote: captureRange(lines, [28, 28]), source_kind: 'third_party_aggregator_job_detail', attention: '第三方页面明确称官网未提供完整岗位职责；部门介绍不作为JD职责；官方入口零行，完整性仍存疑。', scope_note: '第三方聚合页；保留岗位与要求，但未把banner/部门介绍当完整JD。', evidence_line_ranges: { title: [6, 6], location: [12, 12], description: [36, 36], requirements: [40, 45], company_facts: [28, 28] }
  }), status: 'partial', reason: 'third-party page explicitly incomplete' };
  if (rawName === 'o04.json') return { ...parseSingle(rawName, bytes, raw, {
    id: 'netease:77241', native_id: '77241', company: '网易智企', title: '运营商渠道销售-AI方向（ 广州）', city: '广州', location: '广州市', industry: null, discovery_industry: null, salary_raw: null,
    description: captureRange(lines, [26, 30]), requirements: captureRange(lines, [31, 35]), description_complete: true, job_url: src.source_url, apply_url: 'https://hr.163.com/job-detail.html?id=77241', source_kind: 'third_party_aggregator_job_detail', company_facts_quote: null, scope_note: '第三方聚合页完整展示岗位职责与要求；公司行业未由本页直接自述，保持null；官方申请入口读取被拒，未核实当前详情。', evidence_line_ranges: { title: [6, 6], location: [12, 12], description: [26, 30], requirements: [31, 35], company_facts: null }
  }), status: 'partial', reason: 'third-party source, source scope not market-complete' };
  if (rawName === 'o06.json') {
    const names = [{line:185,names:['数据库内核研发工程师','Golang 开发工程师','Java 开发工程师','全栈开发工程师','数据库研发组长','数据库售前解决方案架构师','数据库技术支持工程师']},{line:188,names:['海外业务拓展','大客户销售']},{line:192,names:['HR','ToB 视觉设计师']},{line:200,names:['数据库研发工程师','基础设施研发工程师','数据库技术支持工程师']},{line:204,names:['大客户销售']},{line:208,names:['HR','ToB 视觉设计师']}];
    const jobs=[]; for(const group of names) for(const name of group.names) jobs.push(baseJob(src,lines,{id:`ymatrix:name-only:l${group.line}:${name}`,native_id:null,company:'YMatrix',title:name,city:null,location:null,industry:'数据库/实时分析数仓',discovery_industry:'数据库/实时分析数仓',description:null,requirements:null,description_complete:false,job_url:null,apply_url:null,source_kind:'official_careers_page_name_only',source_status:'partial',company_facts_quote:null,scope_note:'官网只展示职位名称入口；链接显示为BOSS入口，不冒充职位级直链。',attention:'name-only；没有JD详情。',evidence_line_ranges:{title:[group.line,group.line],location:null,description:null,requirements:null,company_facts:null}}));
    return {jobs,src,status:'partial',reason:'official page exposes names only; BOSS links are not job detail URLs'};
  }
  if (rawName === 'o07.json') return { ...parseSingle(rawName,bytes,raw,{id:'lenovo-connect:43',native_id:'43',company:'联想懂的通信',title:'算力销售工程师（中级、资深）',city:'北京/上海/深圳',location:'北京/上海/深圳',industry:null,discovery_industry:null,salary_raw:'15-25k',description:captureRange(lines,[36,36]),requirements:captureRange(lines,[36,36]),description_complete:true,job_url:src.source_url,apply_url:null,source_kind:'official_job_detail',company_facts_quote:null,time_note:'页面提供发布时间：2026年03月12日；本次读取不等于当前新发布。',scope_note:'职位级官网详情页；薪资周期与币种未明确，不推固定月薪。',attention:'15-25k；周期/币种未明确，不推固定。',evidence_line_ranges:{title:[31,31],location:[33,33],description:[36,36],requirements:[36,36],company_facts:null,salary:[33,33]}}),status:'success',reason:null };
  if (rawName === 'o09.json') return { ...parseSingle(rawName,bytes,raw,{id:'miaowa-geo:revenue-operations-manager',native_id:'revenue-operations-manager',company:'妙蛙 GEO',title:'营收运营经理',city:'天津',location:'天津市静海区宇泰财富大厦',industry:'AI 搜索/GEO',discovery_industry:'AI 搜索/GEO',salary_raw:'税前月薪12K–22K / 月',description:captureRange(lines,[16,21]),requirements:captureRange(lines,[24,36]),description_complete:true,job_url:src.source_url,apply_url:null,source_kind:'official_job_detail',company_facts_quote:captureRange(lines,[48,50]),scope_note:'职位级官网详情页；保留招聘主体与产品自述。',evidence_line_ranges:{title:[6,8],location:[12,12],description:[16,21],requirements:[24,36],company_facts:[48,50],salary:[12,12]}}),status:'success',reason:null };
  if (rawName === 'o10.json') return { ...parseSingle(rawName,bytes,raw,{id:'baidu:86016799-d234-4a3e-bb9c-917d0a355ef9',native_id:'86016799-d234-4a3e-bb9c-917d0a355ef9',company:'百度',title:'上海大客户经理（政务及国企方向）（J96901）',city:'上海',location:'上海市',industry:null,discovery_industry:null,salary_raw:null,description:captureRange(lines,[13,15]),requirements:captureRange(lines,[17,18]),description_complete:true,job_url:src.source_url,apply_url:null,source_kind:'official_job_detail',company_facts_quote:null,scope_note:'职位级官网详情页；标题/组织标注政务国企方向，但正文明确拓展AI创业公司客户，冲突原样保留。',attention:'标题政务国企与正文AI创业客户方向存在原文冲突。',evidence_line_ranges:{title:[7,11],location:[11,11],description:[13,15],requirements:[17,18],company_facts:null}}),status:'success',reason:null };
  if (rawName === 'o13.json') return { ...parseSingle(rawName,bytes,raw,{id:'airwallex:0014706e-279e-4a19-8d55-7dd5cdacc51b',native_id:'0014706e-279e-4a19-8d55-7dd5cdacc51b',company:'Airwallex',title:'GTM Partnerships Manager (B2B), SME & Growth, CN',city:'广州/深圳/上海/杭州',location:'Shenzhen, Guangzhou, Shanghai, Hangzhou',industry:'全球支付与金融平台',discovery_industry:'全球支付与金融平台',salary_raw:null,description:captureRange(lines,[50,59]),requirements:captureRange(lines,[61,71]),description_complete:true,job_url:src.source_url,apply_url:src.source_url,source_kind:'official_job_detail',company_facts_quote:captureRange(lines,[41,46]),scope_note:'职位级官网详情页；岗位职责/要求按原文连续行保存。',evidence_line_ranges:{title:[24,24],location:[35,35],description:[50,59],requirements:[61,71],company_facts:[41,46]}}),status:'success',reason:null };
  if (rawName === 'o14.json') {
    const specs=[['研发工程师','厦门','校招',163,177],['Web前端工程师','厦门','校招',179,192],['ERP实施顾问','厦门','社招',194,207],['ERP项目经理','厦门','社招',209,222],['渠道专员','厦门','社招',224,237],['ERP销售顾问','厦门/东莞','社招',239,252]];
    const jobs=specs.map(([title,city,track,start,end])=>baseJob(src,lines,{id:`zhenghang:l${start}`,native_id:null,company:'正航软件',title,city,location:city,industry:'企业管理/工业软件',discovery_industry:'企业管理/工业软件',description:captureRange(lines,[start,end]),requirements:captureRange(lines,[start,end]),description_complete:true,job_url:null,apply_url:null,source_kind:'official_careers_page',source_status:'success',recruitment_type:track,education:null,company_facts_quote:null,scope_note:`官网招聘整页明示岗位；${track}原始标签保留，公司招聘页不冒充职位直链。`,attention:`${track}；原始岗位保留。`,evidence_line_ranges:{title:[start,start],location:[start+4,start+4],description:[start,end],requirements:[start,end],company_facts:null}}));
    return {jobs,src,status:'success',reason:'official recruitment page six explicit roles',};
  }
  return { jobs: [], src, status: 'unscanned', reason: 'no explicit source specification; raw kept only as pending input' };
}
function enrichPrevious(job) {
  const { display_excluded: _displayExcluded, ...preserved } = job;
  return { ...preserved, hr_display_name: job.hr_display_name ?? job.recruiter_raw ?? null, company_facts_quote: job.company_facts_quote ?? job.company_tags_raw ?? null, experience: job.experience ?? job.experience_raw ?? null, education: job.education ?? job.education_raw ?? null, observation_date: job.observation_date ?? job.observed_at ?? null, source_status: job.source_status ?? 'previous_observation', execution: job.execution ?? EXECUTION };
}
export async function build() {
  const files = (await readdir(RAW)).filter(f => /^o\d+(?:r)?\.json$/.test(f)).sort();
  const jobs = [], audit = [], seen = new Set();
  for (const file of files) {
    const path = join(RAW,file), bytes = await readFile(path), raw = JSON.parse(bytes);
    const parsed = parseKnown(file,bytes,raw);
    for (const job of parsed.jobs) { if (!seen.has(job.id)) { jobs.push(job); seen.add(job.id); } }
    audit.push({ file, evidence_file: rel(path), evidence_sha256: sha256(bytes), observed_at: raw.observed_at ?? null, status: parsed.status ?? 'success', extracted_jobs: parsed.jobs.length, application_url: parsed.application_url ?? null, reason: parsed.reason ?? null });
  }
  if (!files.includes('o19.json')) audit.push({ file: 'o19.json', evidence_file: null, evidence_sha256: null, observed_at: null, status: 'interrupted_unknown', extracted_jobs: 0, application_url: null, reason: 'original operation began without a completed raw result; o19r is a separate completed fourth-page receipt and does not repair or replace o19' });
  let previous=[]; try { previous=JSON.parse(await readFile(PREVIOUS,'utf8')).map(enrichPrevious); } catch { audit.push({file:'market-2026-09-20/jobs.json',status:'missing_previous_input',extracted_jobs:0}); }
  const merged=[...previous,...jobs];
  const companies = [...new Map(merged.map(j=>[`${j.company}|${j.source_url ?? j.evidence_file}`,{company:j.company,industry:j.industry ?? null,discovery_industry:j.discovery_industry ?? null,company_facts_quote:j.company_facts_quote ?? null,source_url:j.source_url ?? null,evidence_file:j.evidence_file,evidence_sha256:j.evidence_sha256,observation_dates:[j.observed_at].filter(Boolean),company_facts_status:j.company_facts_quote ? 'self_described_not_independently_verified' : 'unknown'}])).values()];
  const run={schema_version:1,run_id:'market-2026-09-21',deterministic:true,network_requests:0,browser_requests:0,offline_only:true,source_scan_status:audit,unscanned_files:audit.filter(x=>x.status==='unscanned').map(x=>x.file),interrupted_inputs:audit.filter(x=>x.status==='interrupted_unknown').map(x=>x.file),market_scan_complete:false,market_coverage_claim:false,merged_previous_observations:previous.length,extracted_new_jobs:jobs.length,total_jobs:merged.length,execution:EXECUTION,notes:['只解析明确规格；未知o文件保留为待核，不推断岗位。','o01是产品诊断文档，不是招聘源，单独标记为not_recruitment_document。','o19是中断未知；o19r是独立完成的第四页回执，二者不合并。','纯数据合并不等于今天重新采集；上期40张观察保留旧日期及HR/标签。','未分析打分、未联网、未使用浏览器。']};
  await writeFile(join(ROOT,'jobs.json'),json(merged)); await writeFile(join(ROOT,'companies.json'),json(companies)); await writeFile(join(ROOT,'extraction-audit.json'),json({schema_version:1,deterministic:true,network_requests:0,browser_requests:0,files:audit,field_binding:'每个新岗位字段通过evidence_sha256与连续L行field_evidence绑定；未知规格不解析。',execution:EXECUTION})); await writeFile(join(ROOT,'run.json'),json(run));
  return run;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) build().then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(e);process.exitCode=1;});
