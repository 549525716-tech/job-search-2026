import {readFile,writeFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const dir=dirname(fileURLToPath(import.meta.url)),sha=x=>createHash('sha256').update(x).digest('hex');
const input=await readFile(join(dir,'report-jobs.json'));
const jobs=JSON.parse(input),audit=[];
function extract(job){
 if(job.source_kind!=='search_index_lead'||!job.template?.startsWith('zhaopin_'))return null;
 const text=job.search_excerpt;
 const headings=[...text.matchAll(/^# (.+)$/gm)];
 if(headings.length!==1||headings[0][1]!==job.title)return null;
 const start=headings[0].index+headings[0][0].length;
 const tail=text.slice(start),end=tail.search(/^#{1,6} /m),meta=tail.slice(0,end<0?tail.length:end);
 const salary=meta.trim().split('\n')[0].trim();
 if(!/^\d+(?:\.\d+)?(?:万|千|[kK]|元)?\s*[-–~]\s*\d+(?:\.\d+)?(?:万|千|[kK]|元)(?:\/(?:月|年))?(?:·\d+薪)?$/.test(salary))return null;
 const pos=text.indexOf(salary,start);
 const location=meta.match(/^\s*\* ([\p{Script=Han}]{2,8}(?: [\p{Script=Han}]{2,10})?)\s*$/mu)?.[1]??null;
 return {salary,pos,location,primary_metadata:meta};
}
assert.equal(extract({source_kind:'search_index_lead',template:'zhaopin_title_employer',title:'销售',search_excerpt:'# 销售\n\n营收30000元\n\n### 职责\n'}),null);
assert.equal(extract({source_kind:'search_index_lead',template:'zhaopin_title_employer',title:'销售',search_excerpt:'# 销售\n\n15000-30000元\n\n# 其他工作\n'}),null);
assert.equal(extract({source_kind:'search_index_lead',template:'zhaopin_title_employer',title:'销售',search_excerpt:'# 销售\n\n15000-30000元\n\n### 职责\n利润50000元'}).salary,'15000-30000元');
for(const j of jobs){
 const x=extract(j);if(!x)continue;
 const evidence={evidence_file:j.evidence_file,evidence_sha256:j.evidence_sha256,locator:'search_excerpt',excerpt_char_range:[x.pos,x.pos+x.salary.length],quote:x.salary,quote_sha256:sha(x.salary)};
 assert.equal(j.search_excerpt.slice(...evidence.excerpt_char_range),x.salary);
 j.salary_raw=x.salary;j.salary_period_note='薪资原文来自搜索索引主职位标题下的薪酬栏，非平台实时核验；未明示月/年时不猜周期，也不证明固定底薪。';
 j.salary_period=/\/月/.test(x.salary)?'month':/\/年/.test(x.salary)?'year':null;
 j.field_evidence.salary_raw=evidence;j.field_status.salary='primary_header_salary_search_excerpt_not_live';
 if(x.location&&!j.city&&!j.location){j.location=x.location;j.field_evidence.location={...evidence,quote:x.location,quote_sha256:sha(x.location),excerpt_char_range:[j.search_excerpt.indexOf(x.location),j.search_excerpt.indexOf(x.location)+x.location.length]};}
 const companyBlock=j.search_excerpt.split('### 公司信息')[1]?.split(/### 职位发布者|### 公司基本信息/)[0];
 if(companyBlock?.includes('\n'+j.company+'\n')){
  const tag=companyBlock.split('\n').find(t=>/\d+-\d+人/.test(t)&&/·/.test(t));
  if(tag)j.company_facts_quote='搜索索引展示，非本轮直读公司认证：'+tag.replace(/Image:.*/, '').trim();
 }
 audit.push({id:j.id,result_id:j.result_id,salary_raw:x.salary,source:evidence,period:j.salary_period,live_source_retrieved:false});
}
await writeFile(join(dir,'enriched-report-jobs.json'),JSON.stringify(jobs,null,2)+'\n');
await writeFile(join(dir,'metadata-enrichment-audit.json'),JSON.stringify({input_sha256:sha(input),records:audit.length,monthly_confirmed:audit.filter(x=>x.period==='month').length,self_tests_passed:3,network_requests:0,entries:audit},null,2)+'\n');
console.log(JSON.stringify({enriched_salary_headers:audit.length,explicit_monthly:audit.filter(x=>x.period==='month').length,company_tag_observations:jobs.filter(j=>j.company_facts_quote).length}));
