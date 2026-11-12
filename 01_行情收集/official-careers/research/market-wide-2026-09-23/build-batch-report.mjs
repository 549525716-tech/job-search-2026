import assert from 'node:assert/strict';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname,join,relative,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {csvCell} from '../../../../careers/overview.mjs';

const dir=dirname(fileURLToPath(import.meta.url)),root=resolve(dir,'../../../..');
const base=relative(root,dir),sha=b=>createHash('sha256').update(b).digest('hex');
const read=n=>readFile(join(dir,n),'utf8').then(JSON.parse);
const save=(n,v)=>writeFile(join(dir,n),JSON.stringify(v,null,2)+'\n');
const csv=(name,headers,rows)=>writeFile(join(dir,name),'\ufeff'+[headers,...rows].map(r=>r.map(csvCell).join(',')).join('\r\n'));
const scope=await read('scope.json'),index=await read('search-index.json'),pagePlan=await read('page-plan.json'),detailPlan=await read('detail-plan.json');
const jobs=await read('jobs.json'),composition=await read('report-composition.json'),leads=await read('search-job-leads.json'),extraction=await read('extraction-audit.json');
const candidates=await read('source-candidates.json');
const ledger=(await readFile(join(dir,'web-session.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);
const captures=[];
for(const f of await readdir(join(dir,'raw'))){const bytes=await readFile(join(dir,'raw',f));captures.push({raw:JSON.parse(bytes),file:base+'/raw/'+f,sha:sha(bytes)});}
captures.sort((a,b)=>a.raw.started_at.localeCompare(b.raw.started_at));
const byID=new Map(captures.map(c=>[c.raw.id,c]));
assert.equal(byID.size,captures.length);
const receipts=captures.map((c,i)=>{
  const begin=ledger.filter(l=>l.event==='begin'&&l.id===c.raw.id),finish=ledger.filter(l=>l.event==='finish'&&l.id===c.raw.id);
  assert.equal(begin.length,1);assert.equal(finish.length,1);assert.equal(finish[0].evidence_sha256,c.sha);
  assert(isDeepStrictEqual(begin[0].request,c.raw.request));
  const cooldown=i?Date.parse(c.raw.started_at)-Date.parse(captures[i-1].raw.observed_at):null;
  if(cooldown!==null)assert(cooldown>=10000,`RATE:${c.raw.id}`);
  return{id:c.raw.id,started_at:c.raw.started_at,finished_at:c.raw.observed_at,cooldown_ms:cooldown,evidence_file:c.file,evidence_sha256:c.sha};
});
assert.equal(ledger.length,captures.length*2);
const timing={status:'passed_for_recorded_calls',calls:captures.length,minimum_cooldown_ms:Math.min(...receipts.slice(1).map(r=>r.cooldown_ms)),receipts};
await save('timing-audit.json',timing);
const queryRows=scope.tasks.map(q=>{
  const c=byID.get(q.id);assert(c&&isDeepStrictEqual(q.request,c.raw.request));
  const found=index.results.filter(r=>r.capture_id===q.id);
  return{...q,query:q.request.search_query[0].q,status:'searched_not_exhaustive',urls:[...new Set(found.map(r=>r.url).filter(Boolean))],result_count:found.length,observed_at:c.raw.observed_at,evidence_file:c.file,evidence_sha256:c.sha};
});
const companyRows=queryRows.filter(q=>q.company).map(q=>({company:q.company,id:q.id,industry_labels_raw:[],queries:[q],urls:q.urls,status:'initial_search_done_details_pending',company_identity_verified:false,company_job_inventory_complete:false}));
const pageRows=[...pagePlan.tasks,...detailPlan.tasks].map(q=>{
  const c=byID.get(q.id),a=extraction.files.find(x=>x.capture_id===q.id);
  if(c)assert(isDeepStrictEqual(q.request,c.raw.request));
  return{...q,status:a?.status??'not_scanned_source_stopped_after_timeout',raw_jobs:a?.roles??0,complete_jd:a?.full_jd??0,evidence_file:c?.file??null,evidence_sha256:c?.sha??null,source_inventory_complete:false};
});
const failed=pageRows.filter(q=>q.status==='read_failed'),unscanned=pageRows.filter(q=>!byID.has(q.id));
const pageUrls=new Set(pageRows.filter(q=>byID.has(q.id)).map(q=>q.request.open[0].ref_id));
const exactKey=s=>String(s??'').normalize('NFKC').trim().toLowerCase();
const oldCatalog=JSON.parse(await readFile(join(dir,'../market-wide-2026-09-22/catalog-plan.json'),'utf8'));
const knownNames=new Set([...scope.tasks.map(q=>q.company),...oldCatalog.companies.flatMap(c=>[c.display_name,c.query_name,...(c.aliases??[])])].filter(Boolean).map(exactKey));
const frontier=new Map();
for(const j of [...jobs,...leads.leads]){
  if(!j.company||knownNames.has(exactKey(j.company)))continue;
  const k=exactKey(j.company);if(!frontier.has(k))frontier.set(k,{display_name:j.company,status:'not_scanned_new_display_name',company_identity_verified:false,automatic_access_authorized:false,evidence:[]});
  frontier.get(k).evidence.push({record_id:j.id??j.result_id,title:j.title,url:j.job_url??j.url??j.source_url,observed_at:j.observed_at,evidence_file:j.evidence_file??j.provenance?.capture_file,evidence_sha256:j.evidence_sha256??j.provenance?.capture_sha256,company_evidence:j.field_evidence?.company});
}
const next=[...frontier.values()].sort((a,b)=>a.display_name.localeCompare(b.display_name,'zh'));
const counts={company_queries_planned:companyRows.length,company_queries_executed:companyRows.length,new_company_queries_planned:0,new_company_queries_executed:0,
  carried_frontier_names_searched:companyRows.length,industry_queries_executed:queryRows.filter(q=>q.route==='A').length,cross_market_queries_executed:queryRows.filter(q=>q.route==='B').length,
  searches:captures.filter(c=>c.raw.operation==='search').length,page_reads:captures.filter(c=>c.raw.operation==='open').length,failed_page_reads:failed.length,
  empty_extraction_pages:pageRows.filter(q=>q.status==='empty_extraction_not_zero_jobs').length,unscanned_planned_reads:unscanned.length,
  search_result_entries:index.counts.result_entries,distinct_discovered_urls:index.counts.distinct_urls,page_job_records:jobs.length,
  complete_jd:jobs.filter(j=>j.description_complete).length,incomplete_page_jobs:jobs.filter(j=>!j.description_complete).length,
  separate_search_job_leads:composition.added_search_lead_variants,combined_report_records:composition.combined_records,
  page_employer_display_names:new Set(jobs.map(j=>j.company).filter(Boolean)).size,next_company_display_names_pending:next.length};
const queued=[{url:'https://www.zhipin.com/web/geek/jobs',status:'blocked',reason:'BOSS自动接管隔离，普通登录标签未动；JD和HR待补'},
  {url:'https://c.liepin.com/',status:'blocked',reason:'猎聘自动接管隔离，普通登录标签未动；JD和HR待补'},
  ...pageRows.filter(q=>['read_failed','empty_extraction_not_zero_jobs','not_scanned_source_stopped_after_timeout'].includes(q.status)).map(q=>({url:q.request.open[0].ref_id,status:q.status,reason:q.status==='read_failed'?'读取失败，不推断零岗位或下架':'未取得正文，不推断零岗位',capture_id:q.id}))];
const run={schema_version:1,run_id:scope.run_id,started_at:captures[0].raw.started_at,finished_at:captures.at(-1).raw.observed_at,
  status:'declared_queries_executed_job_inventory_incomplete',scope:'接续上一波120个雇主显示名，8组行业和8组跨市场关键词，逐源读取公开招聘页。仅查询计划执行完毕，不是公司岗位或全市场完整覆盖。',counts,
  request_count:{web_tool_actual_calls:timing.calls,admission_timing_status:timing.status},queries:queryRows,source_results:pageRows,queued_urls:queued,
  market_scan_complete:false,company_wide_scan_complete:false,login_repaired:false,external_applications:0,scheduler_enabled:false,
  source_frontier:base+'/source-candidates.json',new_company_frontier:base+'/next-company-queue.json',source_explorer:base+'/search-explorer.html',
  salary_note:'未披露不补齐；第三方AI估算薪资不入机会池。官网区间与固定底薪分别核验。',
  execution:{live_collection:'current main session; model unverified',deterministic_extraction:'Node.js; no model API',unavailable_dispatch:'gpt-5.6-luna medium rejected; no silent fallback',qa_dispatch:{agent_id:'01a0ca48-6bb8-70c2-812a-2a64966b08a7',model:'gpt-6-astra',reasoning_effort:'xhigh',status:'see independent-qa.json'}}};
await save('company-coverage.json',{counts,company_records:companyRows,new_company_queries:[],completeness:'initial_search_only_not_job_inventory',market_total:null});
await save('industry-keyword-coverage.json',{coverage:queryRows.filter(q=>!q.company),scope:'查询起点及关键词假设，不是已核实的全市场行业分类'});
await save('next-company-queue.json',{status:'pending_not_executed',company_identity_deduplicated:false,company_count:next.length,companies:next,note:'原文雇主显示名的增量队列；未做法律实体或别名归并，不是独立企业数量。'});
await save('report-run.json',run);
await save('backlog.json',{company_queries:[],company_inventory_status:'all_incomplete',page_read_plan:pageRows,source_candidates:candidates.source_candidates,unread_distinct_urls:index.counts.distinct_urls-pageUrls.size,failures:queued,next_company_queue:base+'/next-company-queue.json',market_total:null});
await csv('company-coverage.csv',['公司显示名','初扫状态','查询ID','发现URL数','发现URL','公司岗位已扫全'],companyRows.map(c=>[c.company,c.status,c.id,c.urls.length,c.urls.join('\n'),'否']));
await csv('new-company-coverage.csv',['新显示名','状态','证据数'],next.map(c=>[c.display_name,c.status,c.evidence.length]));
await writeFile(join(dir,'summary.md'),`# 2026-09-23 岗位市场扫描检查点\n\n**本轮已实际联网采集并保存原文；尚未全市场收齐。**\n\n## 本轮结果\n\n- 接续上一波 ${counts.company_queries_executed} 个公司/品牌显示名查询，另执行 ${counts.industry_queries_executed} 组行业和 ${counts.cross_market_queries_executed} 组跨市场关键词查询。显示名可能含别名，不代表独立法律雇主。\n- ${counts.searches} 次搜索返回 ${counts.search_result_entries} 条结果、${counts.distinct_discovered_urls} 个不同URL；这些不是岗位数量。\n- ${counts.page_reads} 次页面读取，${counts.failed_page_reads} 次失败、${counts.empty_extraction_pages} 次空提取；${counts.unscanned_planned_reads} 项因同源失败未执行。\n- 页面提取 ${counts.page_job_records} 条岗位记录，其中 ${counts.complete_jd} 条职责和要求完整可见；另保留 ${counts.separate_search_job_leads} 组搜索岗位线索，尚未取得完整原文。\n- 主报告本批输入 ${counts.combined_report_records} 条观察；跨批、跨渠道及列表/详情可能指向相同岗位，不是新增在招岗位数。\n- 最小请求冷却 ${timing.minimum_cooldown_ms/1000} 秒，${timing.calls} 次真实调用均有请求回执和文件SHA。\n\n## 重要边界\n\n- BOSS、猎聘普通登录标签未接管、未刷新、未关闭，自动控制隔离未解除。\n- 腾讯第三方聚合页的薪资和详细地址为AI估算，未写入核实字段；正文仍待腾讯原JD核对。\n- 环信标题年份与2020年正文日期冲突；北斗智联部分岗位明确为过往招聘期间。旧公告保留并警示，不冒充当前在招。\n- 所有来源分页/全量库存仍未验收。首次访问成功不等于官网全部岗位取得；搜索无命中不等于不招聘。\n- 固定底薪仍需逐岗确认；不把区间上界当作固定收入。未投递、未发送消息、未创建定时任务。\n\n## 后续队列\n\n继续发现 ${next.length} 个未在历史底册和本轮查询出现的雇主显示名，见 next-company-queue.json；新入口、失败、未扫和待补详情见 backlog.json。本轮运行已结束于检查点，无后台扫描继续运行。\n\n## 查看结果\n\n- [岗位主报告](../../reports/decision-review.html)\n- [全部搜索线索](search-explorer.html)\n- [公司覆盖表](company-coverage.csv)\n- [搜索原文CSV](search-results.csv)\n- 原始抓取：raw/；字段证据：jobs.json、extraction-audit.json；限速证据：timing-audit.json。\n\n目标：全市场已收齐。\n`);
console.log(JSON.stringify(counts));
