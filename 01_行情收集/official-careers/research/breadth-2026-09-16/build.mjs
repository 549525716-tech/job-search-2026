import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative } from 'node:path';
import { captureLines, captureRange } from '../../../../careers/extract-coverage-captures.mjs';
import { classifyRole } from '../../../../careers/role-policy.mjs';

const dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(dir, '../../../..');
const hash = s => createHash('sha256').update(s).digest('hex');
const read = async f => JSON.parse(await readFile(resolve(dir, f), 'utf8'));
const save = async (f, x) => writeFile(resolve(dir, f), JSON.stringify(x, null, 2) + '\n');
const norm = s => String(s ?? '').normalize('NFKC').toLowerCase().replace(/[\s·]/g, '');
const clean = s => String(s ?? '').replace(/cite[^]*/g, '').trim();
const scope = await read('scope.json');
const prefs = JSON.parse(await readFile(resolve(root, 'careers/config/preferences.json'), 'utf8'));
const captures = new Map();
for (const file of (await readdir(resolve(dir, 'raw'))).filter(x => x.endsWith('.json')).sort()) {
  const bytes = await readFile(resolve(dir, 'raw', file));
  const data = JSON.parse(bytes);
  captures.set(file.replace('.json', ''), { ...data,
    evidence_file: relative(root, resolve(dir, 'raw', file)), evidence_sha256: hash(bytes),
    observed_at: data.observed_at ?? data.tool_finished_at,
    blocks: data.result.split(/-{20,}/).map(text => ({ text,
      url: text.split('cite')[0].trim().match(/\((https?:\/\/[^)]+)\)\s*$/)?.[1] })).filter(b => b.url),
  });
}
const evidence = c => ({ evidence_file: c.evidence_file, evidence_sha256: c.evidence_sha256, observed_at: c.observed_at });
const jobs = [], unresolved = [], dedup = new Map();
function add(job) {
  if (!job.company || !job.title) { unresolved.push({ ...job, reason: 'employer_or_title_unresolved' }); return; }
  // Only repeated observations of the exact same entrance are joined; never title-only deduplication.
  const key = [job.source_url, norm(job.company), norm(job.title), norm(job.location), job.hr_display_name ?? '', job.evidence_line_ranges?.title ?? ''].join('|');
  if (dedup.has(key)) {
    const previous = dedup.get(key);
    previous.supporting_evidence ??= [];
    previous.supporting_evidence.push({ file: job.evidence_file, sha256: job.evidence_sha256 });
    previous.routes = [...new Set([...(previous.routes ?? [previous.route]), job.route].filter(Boolean))];
    return;
  }
  job.hiring_freshness_verified = false;
  job.role_review = classifyRole(job, prefs);
  dedup.set(key, job); jobs.push(job);
}
const extracts = ['extract-q01-q06.json', 'extract-q07-q21.json', 'extract-rest-search.json'];
const proposed = [];
for (const file of extracts) proposed.push(...(await read(file)).jobs);
// Platform result headings provide a structured employer/title pair, including hits omitted by the model.
for (const [id, c] of captures) {
  if (!/^[qa]/.test(id)) continue;
  for (const b of c.blocks) {
    if (!/^https:\/\/www\.zhaopin\.com\/jobdetail\//.test(b.url)) continue;
    const m = b.text.trim().split('\n')[0].match(/^(.+?)招聘_(.+?)招聘\s*-\s*智联招聘/);
    if (!m) continue;
    const task = scope.query_tasks.find(t => t.id === id);
    proposed.push({ id: `${id}-structured-${hash(b.url).slice(0,8)}`, title: m[1], company: m[2], source_url: b.url,
      industry: task?.industry ?? c.industry ?? '行业待核', evidence_file: `raw/${id}.json`, route: task?.route ?? 'A-followup' });
  }
}
for (const p of proposed) {
  const c = captures.get(p.evidence_file.split('/').at(-1).replace('.json', ''));
  const b = c?.blocks.find(b => b.url === p.source_url);
  if (!b || !p.company || /^confidential$/i.test(p.company) || /人才校招$/.test(p.title) || !norm(b.text).includes(norm(p.company)) || !norm(b.text).includes(norm(p.title))) {
    unresolved.push({ ...p, reason: 'company_title_not_bound_to_same_result', ...(c ? evidence(c) : {}) }); continue;
  }
  const titleBody = b.text.match(/(?:^|\n)# ([^\n]+)\n([\s\S]*)/);
  const body = titleBody?.[2] ?? b.text.slice(b.text.indexOf('') + 1);
  const header = body.split(/###|职位描述|岗位职责|工作职责/)[0];
  const isZhaopin = /https:\/\/(?:www|m)\.zhaopin\.com\/(?:jobdetail|jobs)\//.test(b.url);
  const salary = isZhaopin ? header.split('\n').map(s=>s.trim()).find(s => /^(?:\d+(?:\.\d+)?(?:万|千|[kK])?\s*[-—~]\s*)?\d+(?:\.\d+)?(?:万|千|[kK]|元)(?:[·・]\d+薪)?$/.test(s)) : null;
  const baseSalary = body.match(/底薪\s*\d+(?:\.\d+)?(?:万|千|元)\s*\/?月/)?.[0] ?? null;
  const proposedLocation = String(p.location ?? '').split(/招聘人数|薪资|联系人|联系电话/)[0].trim();
  const checkedLocation = proposedLocation && !/Image:|工作地点|^\*|\n/.test(proposedLocation) && norm(b.text).includes(norm(proposedLocation)) ? proposedLocation : null;
  const location = isZhaopin ? header.match(/\* ([^\n]+)/)?.[1] ?? null : checkedLocation;
  const duties = body.split(/### 工作地点|### 公司信息|#### 公司介绍|#### 工商信息|### 职位发布者/)[0];
  const reqAt = duties.search(/(?:^|\n)(?:[一二三四五六七八九十\d、.\s]*)(?:任职要求|职位要求|岗位要求|任职资格|岗位资格)/);
  const requirements = reqAt >= 0 ? clean(duties.slice(reqAt)) : null;
  const address = body.match(/#{3,5} (?:工作地点|工作地址)\s+(?:Image: 工作地点\s+)?([^\n]+)/)?.[1]?.trim();
  const facts = body.match(/### 公司信息([\s\S]*?)(?=#### 公司介绍|#### 工商信息|$)/)?.[1]?.trim() ?? null;
  const published = b.text.match(/Published: ([^;\n]+)/)?.[1] ?? null;
  const old = /(?:[3-9]|\d{2,})(?:\.\d+)? years ago/.test(published ?? '');
  const expired = /职位已关闭|职位已下线|招聘已结束|职位已过期|停止招聘|不再接受申请/.test(body);
  const sourceHeading = b.text.trim().split('\n')[0];
  const campus = /\/GRADUATE\//.test(b.url) || /校招|实习|应届/.test(p.title)
    || /[（(]校招[)）]|有限公司校招_|招聘批次[：:\s]*校招/.test(sourceHeading);
  const salaryRaw = salary ?? baseSalary ?? null;
  add({ ...p, id: `breadth-${p.id}`, ...evidence(c), industry: null, discovery_industry: p.industry,
    industry_status: 'query_direction_not_verified_business_industry',
    description: clean(duties.slice(0, reqAt >= 0 ? reqAt : undefined)), requirements,
    salary_raw: salaryRaw, fixed_base_quote: baseSalary, salary_evidence_quote: salaryRaw,
    salary_period_note: salaryRaw && !/\/月|每月|月薪/.test(salaryRaw) ? '原文未明确周期；展示区间，不补造固定底薪或年包' : null,
    city: location, location: address ?? location, company_facts_quote: facts,
    company_facts_status: facts ? 'platform_statement_not_independently_verified' : null,
    hr_display_name: body.match(/### 职位发布者\s+(?:Image: [^\n]+\s+)?([^\n]+)/)?.[1] ?? null,
    job_url: /jobdetail|jobs\/detail|job-info-detail|position\?|\/job_|\/careers\/|\/jobs\/[^/]+/.test(b.url) ? b.url : null,
    apply_url: null, source_kind: 'search_index', channel: '搜索索引（' + new URL(b.url).hostname + '）',
    description_complete: false, employment_type: campus ? 'campus' : 'not_confirmed', employment_type_evidence: sourceHeading,
    hiring_active: expired ? 'closed' : 'unknown',
    attention: [old ? '历史发布线索：需重新核验招聘有效性' : '', expired ? '原文标记已结束或下线' : '', campus ? '校园/实习，不作为当前社招推荐' : '', '搜索索引线索，不等于详情页读取或在招确认'].filter(Boolean).join('；'),
    time_note: [published && `搜索引擎发布标记：${published}`, b.text.match(/Crawled: [^;\n]+/)?.[0], '观察时间是本次检索回执，不是职位发布日期'].filter(Boolean).join('；'),
    scope_note: '保留搜索返回的可取得文字；字段仅取同一结果，不声明JD完整。',
    evidence_quote: p.title, extraction_method: 'same_result_title_employer_binding',
  });
}

function pageJob(file, company, industry, spec) {
  const c = captures.get(file), lines = captureLines(c.result);
  const text = range => range ? captureRange(lines, range) : null;
  const original = text(spec.title);
  const title = spec.label ?? clean(original).replace(/^[\s*#]+/, '').replace(/\s*HOT$/, '').replace(/ 社招\/校招$/, '');
  if (!norm(original).includes(norm(title))) throw new Error(`TITLE_BINDING:${file}:${title}`);
  const sourceUrl = spec.url ?? c.blocks[0]?.url ?? c.request.open?.[0]?.ref_id;
  if (!/^https?:/.test(sourceUrl)) throw new Error(`SOURCE_URL:${file}`);
  const description = text(spec.duties), requirements = text(spec.requirements);
  const complete = Boolean(description && requirements && spec.complete !== false);
  const locationQuote = text(spec.location);
  const location = locationQuote?.replace(/^.*?工作地点[：:]?\s*/, '').split(/所属部门|招聘人数/)[0].replace(/^📍\s*/, '').trim() ?? spec.city ?? null;
  add({ id: `breadth-${file}-l${spec.title}`, company, title, original_title: original, industry,
    industry_status: 'reviewed_JD_business_context_not_legal_entity_classification',
    city: spec.city ?? location, location, location_evidence_quote: locationQuote,
    description, requirements, description_complete: complete, salary_raw: spec.salary ?? null,
    source_url: sourceUrl, job_url: spec.detail ? sourceUrl : null, apply_url: null,
    channel: spec.channel ?? '公司招聘页', source_kind: spec.channel ? 'industry_board' : 'official',
    published_at: spec.published ?? null, hiring_active: 'unknown',
    attention: spec.attention ?? (spec.published?.startsWith('2024') ? '官网仍展示的2024历史发布，当前有效性待核' : '当前在招及薪资待确认'),
    time_note: '网页本次读取时间；公开网页/搜索缓存不等于实时在招确认。',
    scope_note: complete ? '本岗位可取得职责和要求；公司全站和其他渠道未扫完。' : '本页仅列岗位或部分职责，任职要求待补；不是完整JD。',
    employment_type: original.includes('社招/校招') ? 'social_and_graduate' : 'not_confirmed',
    evidence_line_ranges: { title: spec.title, location: spec.location ?? null, responsibilities: spec.duties ?? null, requirements: spec.requirements ?? null },
    ...evidence(c), route: c.route ?? 'A-followup', extraction_method: 'reviewed_source_line_ranges', evidence_quote: original,
  });
}
const infra = '云、算力与AI基础设施', data = '数据与AI开发平台', apps = 'AI企业应用', industrial = '制造与工业智能化';
for (const [t,l,d,r] of [[148,150,[154,157],[161,168]],[171,173,[177,181],[185,189]],[192,194,[198,202],[206,209]],[212,214,[218,222],[226,230]],[233,235,[239,241],[245,250]],[253,255,[259,262],[266,272]]])
  pageJob('o09','飞轮科技（SelectDB）',data,{title:t,location:l,duties:d,requirements:r});
pageJob('o11','京东',apps,{title:14,location:16,city:'北京',duties:20,requirements:23,detail:true,published:'2026-06-22'});
pageJob('o12','海康威视','机器人与智能硬件',{title:11,location:15,city:'深圳',duties:27,requirements:30,detail:true,published:'2026-06-15'});
pageJob('o13','北京不等式科技有限公司',industrial,{title:12,location:16,city:'北京',duties:[22,28],requirements:[32,34],detail:true,published:'2026-04-10'});
pageJob('c03','青云QingCloud',infra,{title:753,location:755,duties:[758,761],requirements:[764,767],detail:true,url:'https://www.qingcloud.com/jobs/%E6%B8%A0%E9%81%93%E7%BB%8F%E7%90%86/?origin=cifnews'});
for (const [t,l,d,r] of [[306,308,[316,320],[323,331]],[333,335,[343,347],[350,364]],[366,368,[375,377],[379,394]],[395,397,[404,408],[411,425]]])
  pageJob('o07','北京兰光创新科技有限公司',industrial,{title:t,location:l,duties:d,requirements:r,published:'2024-05-29',label:captureRange(captureLines(captures.get('o07').result),t).replace(/^[\s*#]+职位：/,'').trim()});
for (const [t,l,d] of [[13,15,[17,20]],[35,37,[39,42]]]) pageJob('o02','优刻得',infra,{title:t,location:l,duties:d});
for (const t of [67,68,69,70,71,72]) {
  const line = captureRange(captureLines(captures.get('o02').result),t);
  pageJob('o02','优刻得',infra,{title:t,label:line.match(/†([^†]+)†/)?.[1]});
}
const apus = captureLines(captures.get('o04').result);
const heads = [...apus].filter(([,v])=>/^#### /.test(v));
for (let i=0;i<heads.length;i++) {
  const [t,title] = heads[i], end=(heads[i+1]?.[0]??466)-1;
  const rows = [...apus].filter(([n])=>n>t && n<=end);
  const d=rows.find(([,v])=>/岗位职责|Responsibilities:/.test(v))?.[0];
  const r=rows.find(([,v])=>/任职要求|Requirements:/.test(v))?.[0];
  const stop=rows.find(([,v])=>/请将简历|邮件标题|Send your/.test(v))?.[0];
  if (!d || !r || !stop || t===178) continue;
  pageJob('o04','APUS','企业软件与营销数字化',{title:t,duties:[d,r-1],requirements:[r,stop-1],attention:'官网岗位；语言/海外业务门槛需核验。页面后半段读取超时，不是全公司扫描完成。'});
}
pageJob('o14','江苏百信数字认证有限公司',apps,{title:75,location:77,duties:79});
for (const [t,company,title,city] of [[206,'瑞蓝创','售前数据库高级工程师（SA）','北京'],[261,'极限科技','市场专员','北京'],[275,'极限科技','区域销售经理','北京'],[288,'极限科技','售前解决方案工程师','北京'],[302,'思特奇','算力产品负责人/大客户经理','北京，合肥，南京，杭州，上海、深圳等']])
  pageJob('o15',company,data,{title:t,label:title,city,channel:'墨天轮行业招聘列表',attention:'标题列表线索；第1页已读，其余分页及正文待取得；混合岗位标题尚未拆分'});

const directorySpecs = [
  ['q04','https://www.stateioc.cn/',infra,'平台服务商列表；未逐家公司验证招聘', '万国数据服务有限公司|上海有孚云计算有限公司|上海武桐树高新技术有限公司|上海润六尺科技有限公司|中国电信股份公司四川分公司|中国移动通信集团四川有限公司|中国联合网络通信有限公司上海市分公司|中国联合网络通信有限公司四川省分公司|优刻得科技股份有限公司|北京世纪互联宽带数据中心有限公司|北京摩笔生成科技有限公司|四川冠安智云数字技术有限公司|天津智算数字产业发展有限公司|天翼云科技有限公司|张家口中明科技有限公司|科华数据股份有限公司|京东科技信息技术有限公司|中移（苏州）软件技术有限公司|联通数字科技有限公司|重庆中科云从科技有限公司'],
  ['q04','https://jxj.beijing.gov.cn/ztzl/ywzt/hbjh/jrhbjh/zsl/slhb/index_1.html',infra,'政府算力伙伴目录；名单不等于在招或规模排名','超云数字技术集团有限公司|中联云港数据科技股份有限公司|新华三技术有限公司|北京华为云计算技术有限公司|北京优刻得科技有限公司|北京并行科技股份有限公司|北京亦庄数字基础设施发展有限公司|中科寒武纪科技股份有限公司|北京天数智芯半导体科技有限公司|沐曦科技（北京）有限公司|摩尔线程智能科技（北京）有限责任公司|北京蓝耘科技股份有限公司|算力互联（北京）科技有限公司|北京东方国信科技股份有限公司|北京浩信迅云科技有限公司|润泽科技发展有限公司|中金数据集团有限公司|北京光环新网科技股份有限公司|北京城建智控科技股份有限公司|北京九章云极科技有限公司'],
  ['q10','https://pdf.dfcfw.com/pdf/H3_AP202404301632037469_1.pdf','企业软件与营销数字化','2024行业图谱历史线索；品牌/产品不是已核雇主或2026排名','salesforce|纷享销客|销售易|zoho|尘锋|探马|玄武云|微盛|探迹|群脉|卫瓴科技|神州云动|红圈CRM|原圈科技|励销云|销帮帮|天润融通|容联云|沃丰科技|智齿科技|网易七鱼|讯鸟软件|青牛软件|合力亿捷|腾讯企点|环信|美洽|百应|小i机器人|商客通|晓多科技|悠易科技|深演智能|泛为科技|蓝标在线|云徙|木瓜移动|赛诺贝斯|荟聚|径硕科技|维卓数据|火眼云|时趣|百炼智能|盈客云'],
  ['q19','https://hurun.net/zh-cn/info/detail?num=18BVOYHUOXLO',industrial,'2023榜单历史公司线索；不继承排名或推断在招','华为|树根互联|卡奥斯|宝信软件|航天云网|工业富联|腾讯|阿里云|徐工汉云|格创东智|浪潮|京东科技|用友|广联达|恒生电子|中控技术|金蝶|中国软件|云从科技|石基信息|卫宁健康|远景智能|阿里巴巴|国联股份|致景科技|美菜网|震坤行|欧冶云商|京东工业品|上海钢联|易久批|找钢网|敦煌网集团|忽米|美云智数|蓝卓|黑湖制造|药师帮|简单汇|复临科技|合纵药易购|巴图鲁|易工品'],
  ['q22','https://zeeklog.com/2026nian-wo-zheng-li-liao-zhong-guo-200-duo-jia-ji-qi-ren-ju-shen-zhi-neng-gong-si-ming-dan-5','机器人与智能硬件','第三方2026目录可见条目；并未取得标题声称的200余家全部记录','优必选|宇树科技|智元|海康机器人'],
];
const companies = new Map(), rejectedNames = [];
function company(name, industry, source, quote, c, note, jobId=null) {
  const key=norm(name); let entry=companies.get(key);
  if (!entry) {entry={company_name:name,industries:[],industry_status:'source_or_search_context_not_verified_company_industry',identity_status:'unverified_display_name_or_brand',tier:'deferred',evidence:[],job_ids:[],recruitment_status:'not_scanned'};companies.set(key,entry);}
  if(industry&&!entry.industries.includes(industry))entry.industries.push(industry);
  entry.evidence.push({source_url:source,verbatim_quote:quote,...evidence(c),context_note:note});
  if(jobId){entry.job_ids.push(jobId);entry.recruitment_status='partial_job_observations_not_company_complete';}
}
for(const [id,url,industry,note,names] of directorySpecs) {
  const c=captures.get(id),b=c.blocks.find(x=>x.url===url);
  for(const name of names.split('|')) {
    const pos=b?.text.indexOf(name)??-1;
    if(pos<0){rejectedNames.push({id,name,source_url:url,reason:'exact_literal_not_observed'});continue;}
    company(name,industry,url,b.text.slice(Math.max(0,pos-30),pos+name.length+45),c,note);
  }
}
for(const job of jobs) {
  const c=captures.get(job.evidence_file.split('/').at(-1).replace('.json',''));
  const b=c.blocks.find(x=>x.url===job.source_url);
  const pos=b?.text.indexOf(job.company)??-1;
  const quote=job.company==='飞轮科技（SelectDB）'?captureRange(captureLines(c.result),4):pos>=0?b.text.slice(Math.max(0,pos-25),pos+job.company.length+50):job.evidence_quote;
  company(job.company,job.industry??job.discovery_industry,job.source_url,quote,c,
    job.company==='飞轮科技（SelectDB）'?'同页标题SelectDB、L4飞轮科技支持组合展示名；法律主体仍待核':'招聘页或搜索结果所示雇主/品牌；搜索方向不等于已核公司行业，法律主体仍待核',job.id);
}
const companyRows=[...companies.values()];
const sourceStatus = {o01:'entry_only',o02:'partial_job_list_ats_dynamic',o03:'campus_page_not_social',o04:'partial_page_continuation_timeout',o05:'entry_only',o06:'dynamic_unreadable',o07:'historical_jobs_visible',o08:'partial_platform_list',o09:'visible_roles_extracted_not_whole_company',o10:'navigation_only_continued_in_c03',o11:'one_jd_obtained',o12:'one_jd_obtained',o13:'one_jd_obtained',o14:'partial_role_summary',o15:'first_page_only_31_pages_visible',o16:'entry_only',c01:'visible_empty_with_error_template_not_verified_empty',c02:'dynamic_unreadable',c03:'one_jd_obtained',c04:'failed_timeout'};
const inventory=[...captures].map(([id,c])=>({id,operation:c.operation??(/^q|^a/.test(id)?'search':id==='c01'||id==='c02'?'click':'open'),request:c.request,...evidence(c),status:sourceStatus[id]??'search_index_only',scope_complete:false}));
const frontier={automatic_execution:false,market_complete:false,
  companies:companyRows.map(c=>({company:c.company_name,industries:c.industries,status:c.recruitment_status,next:c.job_ids.length?'核验在招、正文、其他渠道及分页':'核验官网归属、招聘入口及商业岗位；目录并非已扫'})),
  job_details:jobs.filter(j=>!j.description_complete).map(j=>({id:j.id,company:j.company,title:j.title,url:j.job_url??j.source_url,next:'取得原生详情与薪资、核验雇主；遵守来源准入'})),
  pending_sources:inventory.filter(x=>/dynamic|entry|timeout|first_page|empty|partial/.test(x.status)),
  stops:['BOSS既有风控暂停未解除；仅搜索索引，不代表登录态平台扫描','猎聘既有验证码暂停未解除；仅搜索索引，不代表登录态平台扫描'],
};
const audit=await read('timing-audit.json');
const run={run_id:scope.run_id,status:'partial_with_explicit_backlog',market_scan_complete:false,industry_query_groups:8,
  started_at:scope.frozen_at,finished_at:[...captures.values()].map(c=>c.observed_at).sort().at(-1),
  scope:'8组行业查询的首轮扩展；公司目录、搜索线索及原生JD分别计数，市场宽度仍未通过验收。',
  actual_started_calls:52,persisted_capture_count:captures.size,completed_receipts:52,
  request_count:{web_tool_actual_calls:52,search:32,open:18,click:2,admission_timing_status:audit.status??audit.verdict??'see timing-audit.json'},
  counts:{observations:jobs.length,company_display_names:new Set(jobs.map(j=>j.company)).size,full_jd:jobs.filter(j=>j.description_complete).length,commercial_observations:jobs.filter(j=>j.role_review.eligible).length,salary_disclosed:jobs.filter(j=>j.salary_raw).length,source_hosts:new Set(jobs.map(j=>new URL(j.source_url).hostname)).size,company_discovery_display_names:companyRows.length,unresolved_observations:unresolved.length},
  queries:inventory.filter(i=>i.operation==='search').map(i=>({id:i.id,query:i.request.search_query?.[0]?.q,status:'executed_index_results_not_exhaustive',evidence_file:i.evidence_file})),
  execution:{controller:'current main thread; collection, reviewed extraction and deterministic validation',extraction:{model:'gpt-5.6-luna',reasoning_effort:'medium',agent_id:'01a0aada-0474-7c10-b082-a63845bcc9f6',scope:'offline proposed fields only; company regex output quarantined, not counted'},independent_qa:'pending'},
  depth_scoring_performed:false,external_actions:0,scheduled:false,
  caveats:['搜索返回可以是缓存，读取成功不保证此刻仍在招。','公司目录含历史品牌及子公司；不是已核独立雇主数、不是已扫完公司数。','所有行业仅完成声明查询组合，不能据此宣称市场宽度达标。','原定24次后续请求增加4次原生页续读；没有扩大自动权限。','未对未知薪资补造固定底薪；未进行自动投递。'],
};
run.counts.complete_jd=run.counts.full_jd;
run.counts.commercial_full_jd=jobs.filter(j=>j.role_review.eligible&&j.description_complete).length;
run.counts.commercial_company_display_names=new Set(jobs.filter(j=>j.role_review.eligible).map(j=>j.company)).size;
run.queued_urls=frontier.pending_sources.map(s=>({url:captures.get(s.id).blocks[0]?.url??null,reason:s.status})).filter(s=>s.url);
const industryRows=scope.industries.map(i=>({query_direction:i.label,classification_status:'discovery_buckets_not_verified_company_industry',observations:jobs.filter(j=>(j.discovery_industry??j.industry)===i.label).length,company_names:new Set(jobs.filter(j=>(j.discovery_industry??j.industry)===i.label).map(j=>j.company)).size,full_jd:jobs.filter(j=>(j.discovery_industry??j.industry)===i.label&&j.description_complete).length,company_discoveries:companyRows.filter(c=>c.industries.includes(i.label)).length,market_complete:false}));
await save('jobs.json',jobs);await save('companies.json',companyRows);await save('unresolved.json',unresolved);
await save('directory-name-rejections.json',rejectedNames);await save('capture-inventory.json',inventory);
await save('coverage.json',industryRows);await save('frontier.json',frontier);await save('run.json',run);
const csvCell=x=>'"'+String(x??'').replaceAll('"','""')+'"';
const fields=['company','title','industry','discovery_industry','industry_status','salary_raw','fixed_base_quote','city','location','job_url','source_url','description_complete','attention','description','requirements','evidence_file','evidence_sha256'];
await writeFile(resolve(dir,'jobs.csv'),'\uFEFF'+[fields,...jobs.map(j=>fields.map(f=>j[f]))].map(r=>r.map(csvCell).join(',')).join('\r\n'));
const md=['# 市场宽度扩展检查点','','**状态：仍未通过市场宽度验收，不是正式推荐或全市场清单。**','',
  '实际采集52次：32次搜索、18次打开、2次原生链接点击。执行8组方向查询，不等于8个行业已扫完。',
  `结构化岗位观察${run.counts.observations}条，涉及${run.counts.company_display_names}个公司展示名；完整职责与要求${run.counts.full_jd}条。`,
  `可见薪资${run.counts.salary_disclosed}条；商业主线初筛${run.counts.commercial_observations}条，其中职责与要求完整${run.counts.commercial_full_jd}条，尚未完成个人匹配。公司目录${companyRows.length}个名称只作发现线索，不等于已扫招聘公司数。`,
  '','## 按发现方向对照','查询方向不是已核公司行业；以下公司数跨方向重叠，不得相加为独立公司总数。',
  '|检索/发现方向（行业待核）|岗位观察|公司展示名|完整JD|发现目录名|','|---|---:|---:|---:|---:|',
  ...industryRows.map(i=>`|${i.query_direction}|${i.observations}|${i.company_names}|${i.full_jd}|${i.company_discoveries}|`),
  '','## 主要缺口',
  '- 新发现公司招聘入口及多渠道尚待逐一扫描；见 frontier.json。',
  '- 优刻得ATS、翌擎动态页未取得正文；思迈特社招页显示空结果和错误模板，不能判断全公司无岗。',
  '- APUS页面续读超时；墨天轮只取得第一页，剩余分页未完成。',
  '- BOSS、猎聘既有访问暂停保留，没有绕过限制或代投。',
  '- 年代久远、薪资缺失、校园/研发岗位保留原始观察，不包装成适合的当期岗位。',
  '','## 岗位观察',
  ...jobs.map(j=>`### ${j.company}｜${j.title}\n- ${j.salary_raw??'薪资未取得'}；${j.location??'地点未取得'}\n- ${j.description_complete?'职责与要求已取得':'索引/列表或部分JD'}；${j.attention}\n- 来源：${j.source_url}\n- 证据：${j.evidence_file}\n`),
  '','## 公司发现目录','分组仅依据来源或检索语境，法律主体与公司行业仍待核。',
  ...companyRows.map(c=>`- ${c.company_name}｜${c.industries.join('、')}｜${c.job_ids.length?'已有部分岗位观察':'招聘待扫描'}｜${c.evidence[0].source_url}`),
];
await writeFile(resolve(dir,'README.md'),md.join('\n')+'\n');
console.log(JSON.stringify(run.counts,null,2));
