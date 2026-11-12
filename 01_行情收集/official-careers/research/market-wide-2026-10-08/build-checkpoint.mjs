import {readFile,writeFile,readdir} from 'node:fs/promises';
import {dirname,join,resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {captureLines,captureRange} from '../market-2026-09-21/build.mjs';
const dir=dirname(fileURLToPath(import.meta.url)),root=resolve(dir,'../../../..'),prefix=relative(root,dir);
const sha=x=>createHash('sha256').update(x).digest('hex');
const read=async f=>JSON.parse(await readFile(join(dir,f),'utf8'));
const write=async(f,v)=>writeFile(join(dir,f),JSON.stringify(v,null,2)+'\n');
const [scope,jobs,index,composition,enrichment,oldAudit]=await (async()=>{const xs=[];for(const f of ['scope.json','enriched-report-jobs.json','search-index.json','report-composition.json','metadata-enrichment-audit.json','reobservation-audit.json'])xs.push(await read(f));return xs;})();
const ledger=(await readFile(join(dir,'web-session.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);
const finish=ledger.filter(x=>x.event==='finish'),captures=[];
for(const f of (await readdir(join(dir,'raw'))).filter(f=>f.endsWith('.json'))){
 const bytes=await readFile(join(dir,'raw',f)),c=JSON.parse(bytes),receipt=finish.filter(x=>x.id===c.id);
 assert.equal(receipt.length,1,'EXACTLY_ONE_FINISH:'+c.id);assert.equal(receipt[0].evidence_sha256,sha(bytes));assert.deepEqual(receipt[0].request,c.request);
 assert(c.started_at&&c.observed_at);captures.push(c);
}
assert.equal(finish.length,captures.length);captures.sort((a,b)=>Date.parse(a.started_at)-Date.parse(b.started_at));
const intervals=captures.slice(1).map((c,i)=>({from:captures[i].id,to:c.id,ms:Date.parse(c.started_at)-Date.parse(captures[i].observed_at)}));
assert(intervals.every(x=>x.ms>=10000),'ACTUAL_TOOL_GAP_BELOW_10_SECONDS');
const rawCache=new Map();let evidenceChecks=0;
for(const j of jobs){
 const key=j.evidence_file;assert(key);if(!rawCache.has(key))rawCache.set(key,await readFile(resolve(root,key)));
 const bytes=rawCache.get(key);assert.equal(sha(bytes),j.evidence_sha256,'JOB_SOURCE_CHANGED:'+j.id);
 if(j.raw_job_block_evidence?.line_range){
  const c=JSON.parse(bytes),q=captureRange(captureLines(c.result),j.raw_job_block_evidence.line_range);
  assert.equal(q,j.raw_job_block_evidence.quote,'BLOCK_MISMATCH:'+j.id);evidenceChecks++;
 }
 for(const ev of Object.values(j.field_evidence??{})){
  if(ev?.line_range&&ev.quote!==undefined){
   const file=ev.evidence_file??key,b=rawCache.get(file)??await readFile(resolve(root,file));rawCache.set(file,b);
   assert.equal(sha(b),ev.evidence_sha256);const c=JSON.parse(b),lines=captureLines(c.result);
   const quote=Array.isArray(ev.line_range[0])?ev.line_range.map(r=>captureRange(lines,r)).join('\n\n'):captureRange(lines,ev.line_range);
   assert.equal(quote,ev.quote,'FIELD_MISMATCH:'+j.id);evidenceChecks++;
  }
 }
 if(j.description_complete)assert(j.description&&j.requirements,'INCOMPLETE_JD_MISCLASSIFIED');
}
assert.equal(new Set(jobs.map(j=>j.id)).size,jobs.length);
assert(jobs.filter(j=>j.source_kind==='search_index_lead').every(j=>!j.description_complete&&!j.description&&!j.requirements));
assert(jobs.find(j=>j.capture_id==='p33').salary_raw===null,'AI_ESTIMATE_MUST_NOT_BE_SALARY');
assert(jobs.find(j=>j.capture_id==='p22').location_conflict===true);
assert(jobs.filter(j=>j.capture_id==='p24').every(j=>j.city&&!/查看详情/.test(j.title)));
const searches=captures.filter(c=>c.operation==='search'),pages=captures.filter(c=>c.operation!=='search');
assert.equal(searches.length,scope.tasks.length);
const fallback=JSON.parse(await readFile(resolve(root,'01_行情收集/official-careers/reports/fallback-runs/fallback-24a4deb3-5484-4eba-a3c2-25bc5fb016d2/run.json'),'utf8'));
const errors=pages.filter(c=>/Internal Error|Failed to fetch/.test(c.result.slice(0,700)));
const source_results=pages.map(c=>{
 const own=jobs.filter(j=>j.capture_id===c.id&&j.source_kind!=='search_index_lead');
 const failed=errors.includes(c),empty=/Total lines: 0/.test(c.result);
 const status=failed?'read_failed':empty?'empty_representation_not_zero_jobs':own.length?'partial_observed_records':'entry_or_empty_state_requires_detail';
 return {capture_id:c.id,requested_url:c.request.open?.[0]?.ref_id??null,source_url:c.result.match(/^.*?\((https?:\/\/[^)]+)\)/)?.[1]??null,status,observations:own.length,full_jd:own.filter(j=>j.description_complete).length,source_complete:false,
  error:failed?c.result.slice(-350):null,evidence_file:`${prefix}/raw/${c.id}.json`,observed_at:c.observed_at};
});
const previous=JSON.parse(await readFile(resolve(root,'01_行情收集/official-careers/reports/decision-review.json'),'utf8'));
// Compare against all prior batches, not against a partially regenerated current report.
const priorJobs=previous.groups.flatMap(g=>g.jobs).filter(j=>!j.collection_batch?.startsWith(prefix));
const priorNames=new Set(priorJobs.map(j=>j.company));
const companies=[...new Set(jobs.map(j=>j.company).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'zh-CN'));
const frontier=companies.filter(c=>!priorNames.has(c)).map(company=>({company_display_name:company,identity_verified:false,status:'new_display_name_pending_identity_and_all_channel_scan',evidence:jobs.filter(j=>j.company===company).map(j=>({id:j.id,url:j.job_url??j.source_url,evidence_file:j.evidence_file})),next_routes:['official_and_ATS','independent_public_channels','BOSS_Liepin_only_after_isolation_cleared']}));
await write('new-company-frontier.json',{generated_at:new Date().toISOString(),count:frontier.length,denominator:'display names, not verified employers',companies:frontier});
const pageUrls=new Set(source_results.map(x=>x.source_url).filter(Boolean));
const pendingSources=[...new Map(index.results.filter(r=>r.url&&!pageUrls.has(r.url)).map(r=>[r.url,{url:r.url,title:r.title_raw,status:r.isolation?.status??'admission_required',reason:'本轮仅检索发现；公司归属、来源准入、分页和正文待接续',evidence_file:r.capture_file}])).values()];
await write('next-wave-queue.json',{status:'pending_not_scheduled',source_candidates:pendingSources,new_company_display_names:frontier.length,detail_backlog:jobs.filter(j=>!j.description_complete).map(j=>({id:j.id,company:j.company,title:j.title,url:j.job_url??j.source_url,reason:'完整职责和要求尚未取得，原始记录保留'})),platform_quarantines:['BOSS','猎聘','LinkedIn','MiniMax自动适配器'],market_complete:false});
const counts={searches:searches.length,search_result_entries:index.results.length,distinct_search_urls:new Set(index.results.map(r=>r.url).filter(Boolean)).size,page_read_attempts:pages.length,page_read_failures:errors.length,page_read_with_records:source_results.filter(s=>s.observations>0).length,
 page_observations:composition.page_job_records,structured_search_leads:composition.added_search_lead_variants,observations:jobs.length,complete_jd:jobs.filter(j=>j.description_complete).length,full_source_not_split:jobs.filter(j=>j.source_description_complete&&j.description_structure_status==='full_source_not_split').length,
 company_display_names:companies.length,new_company_display_names:frontier.length,page_company_display_names:new Set(jobs.filter(j=>j.source_kind!=='search_index_lead').map(j=>j.company)).size,
 salary_raw_observations:jobs.filter(j=>j.salary_raw).length,salary_headers_from_search:enrichment.records,structured_new_scores:4,policy_documents_refreshed:0};
const run={schema_version:1,run_id:scope.run_id,started_at:fallback.started_at,finished_at:captures.at(-1).observed_at,status:'partial_checkpoint',scope:'先宽度后深度：126次公司/行业/岗位词检索、39次公开页面读取及2家官网适配采集。来源部分取得；不是全市场或所有公司招聘页穷尽。',
 counts,request_count:{web_tool_actual_calls:captures.length,admission_timing_status:'verified_from_capture_and_ledger',minimum_actual_gap_ms:Math.min(...intervals.map(i=>i.ms)),collector_requests_counted_separately:true},
 queries:scope.tasks.map(t=>({query:t.request.search_query[0].q,status:'search_response_saved_not_company_scan_complete',route:t.route})),source_results,official_adapter_results:fallback.sources,
 queued_urls:[...source_results.filter(s=>s.status!=='partial_observed_records').map(s=>({url:s.source_url??s.requested_url,reason:s.status})),{url:'https://careers.kimi.com/social',reason:'普通社招入口可读，具体Moka职位待准入与读取'},{url:'https://www.zhipuai.cn/zh/joinus',reason:'有销售类别，但尚未获得具体岗位正文'}],
 remaining_scope:['BOSS/猎聘登录后自动读取隔离未解除，保持用户标签不动','MiniMax原厂适配器仍隔离；第三方转载不算恢复','新发现公司与独立来源继续核验和扫描，动态ATS及分页待补','没有完整JD的线索不评分；薪资固定构成及当前HC普遍待确认','本轮未更新国家政策周报；政策不能据此标为最新'],
 execution:{type:'single_current_conversation',model:'current conversation per user instruction; model/effort not independently verified',subagents:0,independent_qa:false,external_llm_api_calls:0},market_scan_complete:false,company_wide_scan_complete:false,external_actions:0,scheduler_enabled:false,
 artifacts:{jobs:`${prefix}/enriched-report-jobs.json`,index:`${prefix}/search-index.json`,queue:`${prefix}/next-wave-queue.json`,company_frontier:`${prefix}/new-company-frontier.json`,matches:`${prefix}/current-match-summary.json`,ledger:`${prefix}/web-session.jsonl`}};
await write('report-run.json',run);
const validation={status:'passed_deterministic_checks_not_business_acceptance',capture_files:captures.length,finish_receipts:finish.length,raw_job_evidence_files:rawCache.size,field_and_block_quote_checks:evidenceChecks,minimum_actual_web_gap_ms:run.request_count.minimum_actual_gap_ms,matching_scores:4,source_failures:errors.map(c=>c.id),market_complete:false,independent_qa:false};
await write('validation.json',validation);
const match=await read('current-match-summary.json');
await writeFile(join(dir,'summary.md'),[
 '# 岗位行情更新检查点｜2026-10-09','',
 '本轮已保存可回查证据，但未通过全市场宽度验收。不是全市场已收齐，也不是所有条目均已确认在招。','',
 `- 执行126次检索，取得${counts.search_result_entries}条结果、${counts.distinct_search_urls}个不同链接。`,
 `- 公开页面读取${pages.length}次，${errors.length}次失败；官网适配器另取得38条记录。`,
 `- 结构化${counts.observations}条观察：页面${counts.page_observations}条、搜索索引线索${counts.structured_search_leads}条；职责和要求完整${counts.complete_jd}条，另${counts.full_source_not_split}条官网全文未拆分。`,
 `- 涉及${companies.length}个公司/品牌展示名，其中${frontier.length}个为相对历史汇总新增名称，均不等于已核法律主体。`,
 `- 薪资原文${counts.salary_raw_observations}条；88条来自搜索标题下的薪酬栏，未标明周期时不推断月薪。底薪20K仍须核实。`,
 '- BOSS/猎聘未操作、未刷新、未重新登录；没有投递、上传或外发。','',
 '## 本轮重点能力初评','',
 ...match.results.map(m=>`- **${m.company}｜${m.title}：${m.score}/100**（证据覆盖分，不是面试概率）。${m.mission} [原页](${m.source})\n  缺口与材料：${m.translation.proof_needed}`),
 '', '## 必须关注','',
 '- 月之暗面第三方条目已过期，AI估算薪资不入薪资池；不反推原厂其他入口全部关闭。',
 '- 云祺销售经理页头写成都，正文写乌鲁木齐、合肥，已标地点冲突。',
 '- MiniMax两份全文来自第三方转载，原厂状态、薪资周期和固定构成未核实。',
 '- 财务数字化、数据中心网络、AI业务改造及广告商业化均有可继续探索的销售/运营入口，但行业门槛需逐项检查。','',
 '## 未完成与下一波','',...run.remaining_scope.map(x=>'- '+x),
 `- ${frontier.length}个新增展示名及${pendingSources.length}条尚未直接读取的来源链接已存续接队列；不是后台已自动运行。`,
 '', '目标：全市场已收齐'
 ].join('\n')+'\n');
console.log(JSON.stringify({counts,validation,pending_sources:pendingSources.length}));
