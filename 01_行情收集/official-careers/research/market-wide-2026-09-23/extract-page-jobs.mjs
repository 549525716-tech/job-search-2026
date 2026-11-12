import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureLines, captureRange } from '../market-2026-09-21/build.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(DIR, '../../../..');
const sha = value => createHash('sha256').update(value).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const filePattern = /^[od]\d+[a-z]*\.json$/;
const textOnly = value => value.replace(/cite\d+†([^†]+)(?:†[^]*)?/g, '$1');
const titleOnly = value => textOnly(value).replace(/^\s*(?:#{1,6}\s+|\*\s+)/, '').trim();


function validUrl(value) {
  try { const u = new URL(value); return /https?:/.test(u.protocol) ? value : null; } catch { return null; }
}

export function decodeCapture(file, bytes) {
  const raw = JSON.parse(bytes.toString('utf8'));
  const body = raw.capture && typeof raw.capture === 'object' ? raw.capture : raw;
  const result = body.result;
  const header = typeof result === 'string' ? result.slice(0, result.search(/(?:^|\s)L\d+:/) < 0 ? result.length : result.search(/(?:^|\s)L\d+:/)) : '';
  const first = header.split('\n')[0];
  const sourceUrl = validUrl(first.match(/\((https?:\/\/[^\r\n]+)\)\s*$/)?.[1]);
  let lines = new Map(), parseError = null;
  try { if (typeof result === 'string') lines = captureLines(result); } catch (e) { parseError = e.message; }
  return {
    id: file.replace(/\.json$/, ''), file, raw, result, header, source_url: sourceUrl,
    ref_id: header.match(/cite([^]+)/)?.[1] ?? null,
    operation: raw.operation ?? body.operation ?? null,
    request: raw.request ?? body.request ?? null,
    query_target_company: raw.company ?? body.company ?? null,
    observed_at: body.observed_at ?? raw.observed_at ?? null,
    observed_pointer: body.observed_at !== undefined && body !== raw ? '/capture/observed_at' : '/observed_at',
    reported_total_lines: Number(header.match(/Total lines: (\d+)/)?.[1]) || null,
    lines, parse_error: parseError,
    evidence_file: relative(ROOT, join(DIR, 'raw', file)), evidence_sha256: sha(bytes),
    result_sha256: typeof result === 'string' ? sha(result) : null,
  };
}

const rows = c => [...c.lines].sort((a, b) => a[0] - b[0]);
const lineText = (c, n) => c.lines.get(n) ?? '';
const findLine = (c, predicate, from = 0, to = Infinity) => rows(c).find(([n, v]) => n >= from && n <= to && predicate(v))?.[0] ?? null;

function rangeEvidence(c, range, value = null) {
  if (range == null) return null;
  const quote = captureRange(c.lines, range);
  const start = typeof value === 'string' ? quote.indexOf(value) : -1;
  return { evidence_file: c.evidence_file, evidence_sha256: c.evidence_sha256,
    capture_id: c.id, result_sha256: c.result_sha256,
    line_range: range, quote, quote_sha256: sha(quote),
    value_char_range: start >= 0 ? [start, start + value.length] : null };
}

function headerEvidence(c, value) {
  const start = c.header.indexOf(value);
  return { evidence_file: c.evidence_file, evidence_sha256: c.evidence_sha256,
    capture_id: c.id, result_sha256: c.result_sha256,
    line_range: null, locator: 'result_header', quote: c.header, quote_sha256: sha(c.header),
    value_char_range: start >= 0 ? [start, start + value.length] : null };
}

function trimRange(c, from, to) {
  while (from <= to && /^\s*#*\s*$/.test(lineText(c, from))) from++;
  while (to >= from && /^\s*#*\s*$/.test(lineText(c, to))) to--;
  if (from > to) return null;
  // captureRange deliberately rejects internal gaps instead of joining a partial JD.
  captureRange(c.lines, [from, to]);
  return [from, to];
}

function companyClaim(c, literal, predicate = v => v.includes(literal)) {
  const line = findLine(c, predicate);
  return line != null && lineText(c, line).includes(literal) ? { value: literal, range: [line, line] }
    : c.header.includes(literal) ? { value: literal, header: true } : null;
}

function admission(url) {
  if (!url) return 'target_url_unknown_admission_required';
  const host = new URL(url).hostname;
  if (['zhipin.com', 'liepin.com', 'minimax.cn', 'linkedin.com'].some(d => host === d || host.endsWith('.' + d))) return 'historical_restriction_pending';
  return 'admission_required';
}

function linksIn(c, from, to, { anyLabel = false } = {}) {
  const links = [];
  for (const [n, value] of rows(c).filter(([n]) => n >= from && n <= to)) {
    for (const m of value.matchAll(/cite(\d+)†([^]+)/g)) {
      const [label, ...tail] = m[2].split('†');
      if (!anyLabel && !/查看(?:详情|岗位)|职位详情|岗位详情|View (?:job|details)/i.test(label)) continue;
      const url = tail.map(validUrl).find(Boolean) ?? null;
      links.push({ link_id: Number(m[1]), ref_id: c.ref_id, label_raw: label, url,
        url_status: url ? 'literal_url' : 'not_exposed_linkid_only', admission_status: admission(url),
        evidence: rangeEvidence(c, [n, n], m[0]) });
    }
    for (const m of value.matchAll(/\[([^\]]+)\]\((https?:\/\/[^\s]+)\)/g)) {
      if (!anyLabel && !/查看(?:详情|岗位)|职位详情|View (?:job|details)/i.test(m[1])) continue;
      const url = validUrl(m[2]);
      if (url) links.push({ link_id: null, ref_id: c.ref_id, label_raw: m[1], url,
        url_status: 'literal_url', admission_status: admission(url), evidence: rangeEvidence(c, [n, n], m[0]) });
    }
  }
  return links;
}

function makeJob(c, spec) {
  const titleRaw = lineText(c, spec.title_line);
  const title = spec.title ?? titleOnly(titleRaw);
  assert(title && titleRaw.includes(title), `TITLE_NOT_BOUND:${c.id}:${spec.title_line}`);
  const fields = Object.fromEntries(['company', 'title', 'source_url', 'job_url', 'location', 'city', 'salary_raw',
    'published_at', 'page_date_raw', 'description', 'requirements', 'description_summary', 'education', 'observed_at', 'hiring_active'].map(k => [k, null]));
  fields.title = rangeEvidence(c, [spec.title_line, spec.title_line], title);
  fields.source_url = c.source_url ? headerEvidence(c, c.source_url) : null;
  fields.company = spec.company ? spec.company.header ? headerEvidence(c, spec.company.value) : rangeEvidence(c, spec.company.range, spec.company.value) : null;
  if (c.observed_at != null) fields.observed_at = { evidence_file: c.evidence_file, evidence_sha256: c.evidence_sha256,
    line_range: null, locator: 'capture_metadata', json_pointer: c.observed_pointer, value: c.observed_at };
  const values = {};
  for (const field of ['location', 'salary_raw', 'published_at', 'page_date_raw', 'education']) {
    const bound = spec[field];
    values[field] = bound?.value ?? null;
    if (bound) {
      fields[field] = rangeEvidence(c, bound.range, bound.value);
      assert(fields[field].value_char_range, `FIELD_NOT_LITERAL:${field}`);
    }
  }
  fields.city = fields.location;
  for (const field of ['description', 'requirements', 'description_summary']) {
    const range = spec[field + '_range'];
    values[field] = range ? captureRange(c.lines, range) : null;
    fields[field] = rangeEvidence(c, range);
  }
  const complete = Boolean(values.description && values.requirements && spec.sections_closed === true
    && !/(?:\.\.\.|…|未完|待补)\s*$/.test(values.description + '\n' + values.requirements));
  const detailLinks = spec.detail_links ?? linksIn(c, spec.title_line, spec.end_line);
  // A title link may be an anchor, application page or detail page. Preserve it
  // without treating it as a verified detail URL or changing job identity.
  const sourceLinks = spec.preserve_title_link
    ? linksIn(c, spec.title_line, spec.title_line, { anyLabel: true })
      .map(link => ({ ...link, target_type: 'unknown_source_title_link' })) : [];
  const actualJobUrl = spec.is_detail ? c.source_url : detailLinks.find(l => l.url)?.url ?? null;
  if (actualJobUrl) fields.job_url = spec.is_detail ? headerEvidence(c, actualJobUrl)
    : rangeEvidence(c, detailLinks.find(l => l.url === actualJobUrl).evidence.line_range, actualJobUrl);
  const job = {
    id: `market-wide-2026-09-23:${c.id}:l${spec.title_line}`,
    capture_id: c.id, native_id: null,
    query_target_company: c.query_target_company,
    company: spec.company?.value ?? null,
    company_identity_status: spec.company ? 'page_self_identification_not_independently_verified' : 'unknown_no_page_claim',
    employer_legal_entity: null, employer_legal_entity_status: 'unknown_not_inferred',
    title, title_raw: titleRaw, ...values, city: values.location,
    source_url: c.source_url, job_url: actualJobUrl, apply_url: null,
    source_kind: spec.source_kind ?? 'public_careers_page', source_origin_status: 'page_claim_observed_ownership_not_independently_verified',
    observation_kind: spec.observation_kind ?? (spec.is_detail ? 'main_detail' : complete ? 'inline_detail' : 'main_list'),
    description_complete: complete,
    completeness_status: complete ? 'responsibilities_and_requirements_visible_with_boundaries'
      : values.description_summary ? 'list_summary_only' : values.description || values.requirements ? 'partial_jd' : 'title_only',
    published_at_semantics: values.published_at ? 'page_explicit_publication_label_raw' : 'unknown',
    observed_at: c.observed_at, time_note: 'capture observation time is not publication time or live hiring verification',
    hiring_active: 'unknown', hiring_active_evidence: null,
    salary_currency: null, salary_period: null, salary_monthly_upper_cny: null,
    salary_fixed_base: null, salary_fixed_base_confirmed: false,
    salary_status: values.salary_raw ? 'raw_only_components_unverified' : 'unknown_not_disclosed',
    detail_links: detailLinks, field_evidence: fields,
    ...(spec.preserve_title_link ? { source_links: sourceLinks } : {}),
    raw_job_block_evidence: rangeEvidence(c, [spec.start_line ?? spec.title_line, spec.end_line]),
    block_boundary_status: spec.sections_closed ? 'explicit_section_boundary' : 'list_or_partial',
    evidence_file: c.evidence_file, evidence_sha256: c.evidence_sha256,
    scope_complete: false, role_filter_applied: false,
    status: { company: spec.company ? 'page_claim_only' : 'unknown', location: values.location ? 'page_stated' : 'unknown',
      salary: values.salary_raw ? 'page_stated_raw_only' : 'unknown', publication: values.published_at ? 'page_stated' : 'unknown',
      hiring: 'unknown', job_url: actualJobUrl ? 'observed_literal' : detailLinks.length ? 'linkid_only' : 'unknown_not_exposed' },
  };
  if (spec.common_requirements_range) job.common_requirements_evidence = rangeEvidence(c, spec.common_requirements_range);
  return job;
}

// Reviewed title boundaries, not a title-keyword filter. All visible role families
// in these boards are retained; categories and unreadable pages stay in backlog.
const SOURCES = [
  ['o01','北京天华星航科技有限公司',[120,140,158,176,193,212,229],245],
  ['o02','北京天云融创软件技术有限公司',[17,51],79],
  ['o05','热数科技',[5],36,true],
  ['o10','北京玻尔智能技术有限公司',[110,133,158,199,230,269],292],
  ['o12','云祺科技',[212],243,true],
  ['o13','北斗智联科技有限公司',[87,109,127,154,180,206,233,259,285,311,338,362,385,403],422],
  ['o14','明珞',[312,326,337,348],355],
  ['o15','乐言科技',[23,44,66,85,105,126,151,173,191,212,229,253,276,294,318,341,359,376,399,426,448,473,498,518,540],556],
  ['o16','鑫蜂维',[42,55,73,90,101,111,122,132,142,153],160],
  ['o17','环信',[39,61,73],87],
  ['o18','Naddod',[410,459,494,533,574],600],
  ['o20','正航软件',[173,188],191],
  ['o21','山东新松工业软件研究院股份有限公司',[134,136,138,139,141,143,145,147],147],
  ['o22','联想懂的通信',[65,67,69,71,73,75],75],
  ['o23','百代（上海）数据技术有限公司',[33,34,35,36,37,38],38],
  ['o27','浙江华企信息科技有限公司',[65,86,113,153,206,234,291,320,355,384,429,456,479,503],550],
  ['o30','语言桥',[12,14,16,23,33,43,45,47,55,57,59,66,68,70],70],
  ['o31','Udesk',[2,26,59,88,116,143,168,197,221,250],271],
  ['o32','麒麟信安',[129,137,144,151,160,169,178,187,198,208],218],
  ['o33','揽阁信息科技（上海）有限公司',[44,77],102],
  ['o34','河南信安世纪科技有限公司',[16,38,60,81,104,124,144,169,191,216,238],258],
  ['o35','中科西瑞',[96,116],133],
  ['o36','苏州通合新能源集团有限公司',[34,55,76,96,117,141,167,190,213,244],269],
  ['o38','中科星光',[87,99,115,128,142,154],166],
  ['o40','Noumena',[43,59,76,91,106,121,146,169,192],213],
  ['o41','NXON.ai',[21,33,44,56,67],77],
  ['o45','帆软',[22],73,true],
  ['d09','腾讯',[53],162,true],
  ['d10','联想懂的通信',[31],38,true],
  ['d11','Arm',[97],154,true],
];
const TITLE_OVERRIDES = {
  o40: ['AI 转型专家 / 咨询顾问','资深商务拓展经理 / Sales（解决方案方向）','AI 产品经理 / AI 产品专家','AI Agent 全栈工程师','研发实习生（AI Agent 方向）','AI 产品运营实习生','招聘经理 / TA（社媒营销 & 商业化方向）','出海商业化 BD 负责人','小红书线索广告投放专员'],
  o18: ['海外营销推广','解决方案工程师','AI数据中心网络工程师','国际销售总监/经理','区域销售经理'],
};
const D = /(?:^|\n)\s*(?:#{1,6}\s*)?(?:〖\s*)?(?:岗位职责|工作职责|工作内容|职位描述|岗位描述|你将负责|Responsibilities)(?:\s*〗)?\s*[:：]?\s*/;
const R = /(?:^|\n)\s*(?:#{1,6}\s*)?(?:〖\s*)?(?:任职要求|岗位要求|任职资格|职位要求|能力要求|招聘要求|我们期待你|Required Skills and Experience)(?:\s*〗)?\s*[:：]?\s*/;
const END = /\n\s*(?:#{1,6}\s*)?(?:〖\s*)?(?:投递简历|投递邮箱|简历投递|工作地点|工作地址|招聘流程|福利待遇|公司福利|员工福利|薪资待遇|薪酬福利|薪资福利|晋升空间|全职 \||\d{2} · |In Return)\s*[:：(]?/;
function sourceBound(c, range, text) {
  const evidence = rangeEvidence(c, range, text);
  assert(evidence.value_char_range, 'SPLIT_FIELD_NOT_LITERAL');
  return evidence;
}
function sections(c, job, start, end) {
  const range = [start,end], block = captureRange(c.lines,range);
  let d = block.match(D), r = block.match(R);
  // A few CMSs collapse both labelled sections into one physical line.
  if (!r && d) r = block.match(/(?:任职要求|岗位要求|任职资格|职位要求)\s*[:：]?\s*/);
  if (!d) return;
  const cut=s=>{const stop=s.match(END);return(stop?s.slice(0,stop.index):s).trim();};
  const desc = cut(block.slice(d.index+d[0].length,r&&r.index>d.index?r.index:undefined));
  if(!r){if(desc){job.description=desc;job.field_evidence.description=sourceBound(c,range,desc);job.completeness_status='partial_jd';}return;}
  const req = cut(block.slice(r.index+r[0].length,d.index>r.index?d.index:undefined));
  if(!desc || !req)return;
  job.description=desc; job.requirements=req;
  job.field_evidence.description=sourceBound(c,range,desc);
  job.field_evidence.requirements=sourceBound(c,range,req);
  job.description_complete = !/(?:\.\.\.|…|未完|待补)\s*$/.test(desc+'\n'+req);
  job.completeness_status=job.description_complete?'responsibilities_and_requirements_visible_with_boundaries':'partial_jd';
  job.observation_kind=job.job_url?'main_detail':job.description_complete?'inline_detail':'main_list';
}
function cleanTitle(raw,id,i) {
  if(TITLE_OVERRIDES[id])return TITLE_OVERRIDES[id][i];
  let title=textOnly(raw).replace(/^\s*[\s*#]+/,'').replace(/^(?:岗位：|招聘名称：|[一二]、|（\d）)/,'').trim();
  if(id==='o21')title=title.split(' 工作地点：')[0];
  if(id==='o22')title=title.split(/\s+\d+-\d+k/)[0];
  if(id==='o23')title=title.split(' 招聘人数：')[0];
  if(id==='o32')title=title.split('|')[0].trim();
  if(id==='o45')title='销售工程师(AI)';
  return title.replace(/[:：]$/,'');
}
function bind(job,c,field,value,line) {
  if(!value)return;
  assert(lineText(c,line).includes(value),`NOT_LITERAL:${c.id}:${field}`);
  job[field]=value; job.field_evidence[field]=rangeEvidence(c,[line,line],value);
  if(field==='location'){job.city=value;job.field_evidence.city=job.field_evidence.location;job.status.location='page_stated';}
  if(field==='salary_raw'){job.salary_status='raw_only_components_unverified';job.status.salary='page_stated_raw_only';}
}
const files=(await readdir(join(DIR,'raw'))).filter(f=>filePattern.test(f));
const captures=new Map();
for(const file of files)captures.set(file.slice(0,-5),decodeCapture(file,await readFile(join(DIR,'raw',file))));
const jobs=[],audit=[];
for(const [id,employer,starts,last,isDetail=false] of SOURCES){
  const c=captures.get(id);assert(c && !c.parse_error && c.lines.size,`NO_CAPTURE:${id}`);
  const company=companyClaim(c,employer);
  for(let i=0;i<starts.length;i++){
    const start=starts[i],end=(starts[i+1]??last+1)-1;
    const job=makeJob(c,{title_line:start,title:cleanTitle(lineText(c,start),id,i),end_line:end,company,is_detail:isDetail});
    sections(c,job,start,end);
    const blockRows=rows(c).filter(([n])=>n>=start&&n<=end);
    const loc=blockRows.find(([,s])=>/^\s*(?:#+\s*)?(?:地区|工作地点|工作地址)[:：]?/.test(s));
    if(loc){const v=loc[1].replace(/^\s*(?:#+\s*)?(?:地区|工作地点|工作地址)[:：]?\s*/,'').trim();if(v)bind(job,c,'location',v,loc[0]);
      else {const next=blockRows.find(([n,s])=>n>loc[0]&&s.trim());if(next&&!/^[#]/.test(next[1].trim()))bind(job,c,'location',next[1].trim(),next[0]);}}
    const pay=blockRows.find(([,s])=>/^薪资[:：]\s*\S/.test(s));
    if(pay){const value=pay[1].replace(/^薪资[:：]\s*/,'').split(/(?:^| )学历[:：]/)[0].trim();if(value)bind(job,c,'salary_raw',value,pay[0]);}
    const date=blockRows.find(([,s])=>/^发布时间[:：]/.test(s));
    if(date)bind(job,c,'published_at',date[1].replace(/^发布时间[:：]\s*/,''),date[0]);
    if(id==='o21')bind(job,c,'location',lineText(c,start).match(/工作地点：(\S+)/)?.[1],start);
    if(id==='o22'){
      const parts=textOnly(lineText(c,start)).split(/\s{2,}/);
      bind(job,c,'salary_raw',textOnly(lineText(c,start)).match(/\d+-\d+k/)?.[0],start);
      bind(job,c,'location',parts[3]?.trim(),start);
      bind(job,c,'published_at',lineText(c,start).match(/发布时间：(\d+年\d+月\d+日)/)?.[1],start);
    }
    if(id==='o32'){
      const parts=lineText(c,start).split('|').map(x=>x.trim());
      bind(job,c,'salary_raw',parts[1],start);bind(job,c,'location',parts[4],start);bind(job,c,'published_at',parts[5],start);
      job.attention='仅取得招聘第2页；职称或地点含省略号时保持原样。标题栏与JD经验/学历可能不一致，需复核。';
    }
    if(id==='o18')bind(job,c,'location',lineText(c,start).trim().split(/\s+/).slice(4).join(' '),start);
    if(id==='o31'){const n=blockRows.find(([n,s])=>n>start&&s.trim());if(n&&/^(?:北京|上海|广州)/.test(n[1]))bind(job,c,'location',n[1],n[0]);}
    if(id==='o20')bind(job,c,'location','厦门',start===173?167:183);
    if(id==='o34'){
      const m=lineText(c,start+2).match(/^(.+?)\d+ 人(\d+K-\d+K)$/);
      if(m){bind(job,c,'location',m[1],start+2);bind(job,c,'salary_raw',m[2],start+2);}
    }
    if(id==='o36'){
      const meta=blockRows.find(([,s])=>/^全职 \|/.test(s));
      if(meta)bind(job,c,'location',meta[1].split('|').at(-1).trim(),meta[0]);
      bind(job,c,'page_date_raw',lineText(c,start+2),start+2);
      // The site repeats each expanded JD as a single-line mobile variant.
      const dup=job.requirements?.indexOf('\n\n全职 |');
      if(dup>=0){job.requirements=job.requirements.slice(0,dup).trim();job.field_evidence.requirements=sourceBound(c,[start,end],job.requirements);}
    }
    if(id==='o41'){
      job.description_summary=lineText(c,start+2);job.field_evidence.description_summary=rangeEvidence(c,[start+2,start+2]);
      bind(job,c,'location',lineText(c,start+6),start+6);job.completeness_status='list_summary_only';
    }
    if(id==='o40'){
      bind(job,c,'location',i===7?'深圳 / 广州 / 上海':'上海',i===7?171:39);
    }
    if(id==='o30'&&start===33)bind(job,c,'location','北京/上海/成都/深圳/广州等城市',35);
    if(id==='o17'){
      bind(job,c,'location',job.title.split('-').at(-1),start);
      bind(job,c,'page_date_raw','2020-12-30 02:41',37);
      job.attention='标题称2026年招聘，页面日期为2020-12-30；历史公告/日期冲突，不能认定最新在招。';
      job.current_opportunity_status='historical_or_conflicting_date';
    }
    if(id==='o13'){
      const time=blockRows.find(([,s])=>/^招聘时间[:：]/.test(s));
      if(time)bind(job,c,'recruitment_period_raw',time[1],time[0]);
      if([87,338,362].includes(start)){
        job.attention='页面招聘期间已过；保留历史岗位，未确认重新开放。';job.current_opportunity_status='past_recruitment_period';
      }
    }
    if(id==='o10'){
      const meta=blockRows.find(([,s])=>/工作地点.*发布时间/.test(s));
      if(meta){bind(job,c,'location',meta[1].match(/工作地点[:：]?\s*(\S+)/)?.[1],meta[0]);bind(job,c,'published_at',meta[1].match(/\d{4}-\d{2}-\d{2}/)?.[0],meta[0]);}
      job.attention='页面标注2023年发布，当前是否持续招聘待确认。';
    }
    if(id==='o12')bind(job,c,'location','成都',214);
    if(id==='d10'){
      bind(job,c,'salary_raw','16-25k',33);bind(job,c,'location','广州南沙 / 上海长宁',33);
    }
    if(id==='d11'){
      bind(job,c,'location','Shenzhen, China',99);bind(job,c,'published_at','17/09/2026',99);bind(job,c,'native_id','2026-17606',99);
    }
    if(id==='d09'){
      job.description=captureRange(c.lines,[149,157]);job.field_evidence.description=rangeEvidence(c,[149,157]);
      job.requirements=captureRange(c.lines,[132,146]);job.field_evidence.requirements=rangeEvidence(c,[132,146]);
      job.description_complete=false;job.source_kind='third_party_summary';job.completeness_status='aggregator_reconstruction_primary_jd_unverified';
      bind(job,c,'location','深圳市',61);job.attention='第三方聚合页，正文尚未对照腾讯原JD；薪资与详细地址为AI估算/推测，已排除。';
    }
    if(id==='o45'){
      job.description=captureRange(c.lines,[52,59]);job.field_evidence.description=rangeEvidence(c,[52,59]);
      job.requirements=captureRange(c.lines,[63,73]);job.field_evidence.requirements=rangeEvidence(c,[63,73]);
      job.additional_requirements=captureRange(c.lines,[38,46]);job.field_evidence.additional_requirements=rangeEvidence(c,[38,46]);
      job.description_complete=true;job.completeness_status='responsibilities_and_requirements_visible_with_boundaries';
    }
    if(id==='o15'&&[399,473].includes(start)){
      const range=start===399?[418,420]:[490,492];
      job.location=captureRange(c.lines,range);job.field_evidence.location=rangeEvidence(c,range);job.field_evidence.city=job.field_evidence.location;
    }
    if(id==='o15'&&start===498){
      job.source_section_mislabeled={label:'能力要求',content:captureRange(c.lines,[511,513]),evidence:rangeEvidence(c,[509,513]),interpretation:'城市清单，可能是工作地；未自行改为确定工作地或能力要求'};
      job.requirements=null;job.field_evidence.requirements=null;job.description_complete=false;job.completeness_status='source_section_mislabeled';
      job.attention='源页面能力要求栏目实际为城市清单，任职要求未确认；不计为完整JD。';
    }
    if(id==='o16'&&!job.description){
      const textRows=blockRows.filter(([n,s])=>n>start&&/^\d+[、.]/.test(s));
      if(textRows.length){const range=[textRows[0][0],textRows.at(-1)[0]];job.description_summary=captureRange(c.lines,range);job.field_evidence.description_summary=rangeEvidence(c,range);job.source_role_text=job.description_summary;job.completeness_status='unlabelled_numbered_body_partial';}
    }
    if(id==='o27'){
      const range=({113:[143,143],153:[180,182],234:[265,265],355:[380,380],384:[415,415],503:[532,534]})[start];
      if(range){job.salary_raw=captureRange(c.lines,range);job.field_evidence.salary_raw=rangeEvidence(c,range);job.salary_status='raw_only_components_unverified';job.status.salary='page_stated_raw_only';job.salary_period_note='原文薪资构成已保存；币种、周期及固定保障未确认，不能将提成或月均收入当作固定底薪。';}
    }
    if(id==='o14'&&job.requirements){
      const at=job.requirements.search(/✅\s*在明珞[，,]/);
      if(at>=0){job.requirements=job.requirements.slice(0,at).trim();job.field_evidence.requirements=sourceBound(c,[start,end],job.requirements);}
    }
    if((id==='o14'&&start===348)||(id==='o15'&&start===540)){
      job.description_complete=false;job.completeness_status='partial_jd';job.attention='源内容截断且续读失败；职责或要求未完整取得。';
    }
    job.city=job.location;
    job.observation_kind=isDetail?'main_detail':job.description_complete?'inline_detail':'main_list';
    if(job.published_at){job.published_at_semantics='page_explicit_publication_label_raw';job.status.publication='page_stated';}
    job.block_boundary_status=job.description_complete?'reviewed_role_boundaries_and_both_sections_visible':'list_or_partial';
    if(job.salary_raw&&/\d+[kK]/.test(job.salary_raw)&&!job.salary_period_note)job.salary_period_note='薪资原文仅列K范围，币种及计薪周期没有明确写出；保留待核，不推断固定月薪。';
    jobs.push(job);
  }
  audit.push({capture_id:id,status:'visible_roles_extracted_not_source_complete',roles:starts.length,full_jd:jobs.filter(j=>j.capture_id===id&&j.description_complete).length,company_claim_verified:Boolean(company),evidence_file:c.evidence_file,evidence_sha256:c.evidence_sha256});
}
const maycur=captures.get('o06'),tail=captures.get('o06tail');
assert.equal(captureRange(maycur.lines,[517,524]),captureRange(tail.lines,[517,524]));
const maycurLinks=linksIn(maycur,517,524,{anyLabel:true});
assert.equal(maycurLinks.length,34);
for(const link of maycurLinks){
  const m=link.label_raw.match(/^(.+?)\/(.+?)查看岗位$/);assert(m);
  const n=link.evidence.line_range[0],job=makeJob(maycur,{company:companyClaim(maycur,'杭州每刻科技有限公司'),title_line:n,title:m[1],end_line:n});
  job.id=`market-wide-2026-09-23:o06:link${link.link_id}`;
  const rawCity=m[2],city=rawCity.length%2===0&&rawCity.slice(0,rawCity.length/2)===rawCity.slice(rawCity.length/2)?rawCity.slice(0,rawCity.length/2):rawCity;
  bind(job,maycur,'location',city,n);
  job.source_links=[{...link,admission_status:'historical_restriction_pending',target_type:'liepin_link_url_not_exposed'}];job.detail_links=job.source_links;
  job.supporting_evidence=[{file:tail.evidence_file,sha256:tail.evidence_sha256}];
  job.attention='每刻官网已披露岗位标题和城市；链接指向猎聘但完整URL未暴露，未访问猎聘，详情及HR待核。';
  job.identity_note='以本次原始链接ID保留观察；相同标题/城市但不同链接ID不合并，同页续读关联为证据，不增加岗位数。';
  jobs.push(job);
}
audit.push({capture_id:'o06',status:'visible_role_links_extracted_details_pending',roles:34,full_jd:0,company_claim_verified:true,evidence_file:maycur.evidence_file,evidence_sha256:maycur.evidence_sha256});
audit.push({capture_id:'o06tail',status:'continuation_associated_existing_observations',roles:0,full_jd:0,evidence_file:tail.evidence_file,evidence_sha256:tail.evidence_sha256});
for(const c of captures.values())if(!audit.some(a=>a.capture_id===c.id))audit.push({capture_id:c.id,
  status:/Failed to fetch|Internal Error|403 Forbidden|429 Too Many/.test(c.result)?'read_failed':!c.lines.size?'empty_extraction_not_zero_jobs':c.id.endsWith('tail')?'continuation_saved_no_new_job_evidence':'entry_or_category_only_no_structured_job',
  roles:0,full_jd:0,evidence_file:c.evidence_file,evidence_sha256:c.evidence_sha256});
assert.equal(new Set(jobs.map(j=>j.id)).size,jobs.length);
for(const job of jobs){assert(job.title);for(const [field,e]of Object.entries(job.field_evidence)){if(!e)continue;assert(e.evidence_sha256);if(typeof job[field]==='string'&&e.quote)assert(e.quote.includes(job[field]),`UNBOUND:${job.id}:${field}`);}}
await writeFile(join(DIR,'jobs.json'),json(jobs));
await writeFile(join(DIR,'extraction-audit.json'),json({status:'local_evidence_checks_passed_pending_independent_review',jobs:jobs.length,complete_jd:jobs.filter(j=>j.description_complete).length,files:audit,source_complete:false,parser_file:relative(ROOT,fileURLToPath(import.meta.url)),parser_sha256:sha(await readFile(fileURLToPath(import.meta.url)))}));
console.log(JSON.stringify({jobs:jobs.length,complete_jd:jobs.filter(j=>j.description_complete).length,company_unknown:jobs.filter(j=>!j.company).map(j=>j.id)}));
