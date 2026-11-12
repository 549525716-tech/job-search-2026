import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname,join,resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {captureLines,captureRange} from '../market-2026-09-21/build.mjs';
const dir=dirname(fileURLToPath(import.meta.url)),root=resolve(dir,'../../../..');
const sha=x=>createHash('sha256').update(x).digest('hex');
const jobs=[],cache=new Map();
async function page(id){
  if(cache.has(id))return cache.get(id);
  const path=join(dir,`raw/${id}.json`),bytes=await readFile(path),c=JSON.parse(bytes),lines=captureLines(c.result);
  const head=c.result.split(/(?:^|\s)L\d+:/)[0];
  const url=c.result.match(/^.*?\((https?:\/\/[^)]+)\)/)?.[1];
  assert(url);const p={id,c,lines,url,head,file:relative(root,path),hash:sha(bytes)};cache.set(id,p);return p;
}
const clean=x=>x.replace(/cite[^†]*†([^]*)/g,'$1').replace(/^#+\s*/, '').trim();
const line=(p,n)=>captureRange(p.lines,[n,n]);
function add(p,s){
  const ev={};
  for(const [k,r]of Object.entries(s.ranges??{})){
    const quote=captureRange(p.lines,r);ev[k]={evidence_file:p.file,evidence_sha256:p.hash,line_range:r,quote,quote_sha256:sha(quote)};
  }
  const block=captureRange(p.lines,s.block??s.ranges.title);
  const companyEvidence=s.companyRange?{...ev.company}: {evidence_file:p.file,evidence_sha256:p.hash,locator:'result_header',quote:p.head};
  if(!s.companyRange)assert(p.head.toLowerCase().includes(s.company.toLowerCase()),'COMPANY_NOT_IN_HEADER:'+s.company);
  const j={id:`market-wide-2026-10-08:${p.id}:l${s.ranges.title[0]}${s.suffix??''}`,capture_id:p.id,
    company:s.company,title:s.title??clean(ev.title.quote),city:s.city??null,location:s.city??null,
    description:s.description??ev.description?.quote??null,requirements:ev.requirements?.quote??null,
    description_complete:Boolean(s.complete),salary_raw:s.salary??null,job_url:s.direct?p.url:null,source_url:p.url,apply_url:s.apply??null,
    observed_at:p.c.observed_at,evidence_file:p.file,evidence_sha256:p.hash,field_evidence:ev,
    source_kind:s.kind??'official_careers_page',source_status:'success',source_crawl_metadata:p.head.match(/Crawled: ([^;\n]+)/)?.[1]??null,
    time_note:'本轮经网页工具读取；工具可能返回缓存。观察时间不是发布时间，也不保证当前仍在招。',
    current_opportunity_status:s.status??'官网/来源页面明示岗位，当前HC仍待确认',hiring_active:'unknown',scope_complete:false,
    attention:s.attention??'薪资未披露；本条采集不代表公司所有岗位或分页均已取得。',
    discovery_industry:s.industry??null,company_facts_quote:s.companyFacts??null,
    company_evidence:companyEvidence,raw_job_block_evidence:{evidence_file:p.file,evidence_sha256:p.hash,line_range:s.block??s.ranges.title,quote:block,quote_sha256:sha(block)},
    execution:{executor:'current conversation model per user instruction',subagents:0,independent_qa:false},...s.extra};
  if(j.description_complete)assert(j.description&&j.requirements,'FULL_REQUIRES_BOTH');
  for(const k of ['title','salary_raw','city'])if(ev[k]&&j[k])assert(clean(ev[k].quote).includes(j[k]),'FIELD_NOT_LITERAL:'+k+':'+j.id);
  jobs.push(j);return j;
}
// Changed page: bind fresh ranges instead of carrying the previous extraction forward.
{
 const p=await page('p05');
 for(const [start,d0,d1,r0,r1,title,city]of [
 [418,422,433,437,447,'海外营销推广','武汉'],[463,467,474,478,478,'解决方案工程师','武汉'],
 [494,498,504,508,513,'AI数据中心网络工程师','武汉'],[529,533,538,542,550,'国际销售总监/经理','武汉'],
 [566,569,577,581,587,'区域销售经理','北京、上海、广州、深圳、武汉、浙江、江苏、成都、长沙']])
 add(p,{company:'Naddod',title,city,complete:true,block:[start,r1],ranges:{title:[start,start],city:[start,start],description:[d0,d1],requirements:[r0,r1]},industry:'AI基础设施、数据中心网络'});
}
{
 const p=await page('p17');add(p,{company:'数势科技',companyRange:[90,92],companyFacts:captureRange(p.lines,[90,92]),title:'销售顾问',city:'北京、上海、广州、深圳',direct:true,complete:true,block:[49,83],ranges:{company:[90,92],title:[49,49],city:[55,55],description:[71,75],requirements:[79,83]},industry:'企业软件、数据智能',extra:{application_contact:'HR@digitforce.com'}});
}
{
 const p=await page('p18');
 for(const [cityN,titleN]of[[34,38],[46,50],[57,61],[69,73],[81,85],[93,97],[105,109]]){
  const city=clean(line(p,cityN));
  for(const [i,title]of clean(line(p,titleN)).split(/\s+/).entries())add(p,{company:'恒为科技',companyRange:[114,115],companyFacts:captureRange(p.lines,[114,115]),title,city,suffix:'-'+i,block:[cityN,titleN],ranges:{company:[114,115],title:[titleN,titleN],city:[cityN,cityN]},industry:'智能硬件与AI基础设施',attention:'仅取得城市岗位列表；详情ATS待接续，薪资、要求未取得。'});
 }
}
{
 const p=await page('p19');const starts=[...p.lines].filter(([n,t])=>n>=470&&n<700&&/^(销售|售前咨询)$/.test(p.lines.get(n+4)??'')&&/以上$/.test(p.lines.get(n+6)??'')).map(([n])=>n);
 for(const [i,n]of starts.entries()){
  const limit=(starts[i+1]??700)-1;
  const find=re=>[...p.lines].find(([l,t])=>l>=n&&l<=limit&&re.test(t))?.[0];
  const d=find(/^岗位职责/),r=find(/^(岗位要求|任职要求)/),end=find(/^简历投递邮箱/)-1;
  add(p,{company:'华天软件',title:line(p,n),city:line(p,n+2),complete:true,block:[n,end],ranges:{title:[n,n],city:[n+2,n+2],description:[d+1,r-1],requirements:[r+1,end]},industry:'工业软件、智能制造',extra:{education:line(p,n+6)}});
 }
}
{
 const p=await page('p21');
 for(const [title,d,r,end]of[[60,64,73,81],[85,89,100,108],[112,116,127,135],[139,143,152,160],[166,170,179,189],[193,197,208,216],[222,226,231,237],[243,247,254,260]])
 add(p,{company:'舜飞科技',title:line(p,title),complete:true,block:[title,end],ranges:{title:[title,title],description:[d,r-3],requirements:[r,end]},industry:'营销科技、广告商业化',attention:'官网正文可读；地点和薪资未明示，不把公司办公地址当岗位地点。',extra:{department:title===222?'粉丝通业务部':title===243?'DSP业务部':null}});
}
{
 const p=await page('p22');add(p,{company:'云祺科技',title:'销售经理',city:'成都',direct:true,complete:true,block:[212,245],ranges:{title:[212,212],city:[214,214],description:[222,232],requirements:[237,245]},industry:'企业软件、数据保护',attention:'地点冲突：页头成都，正文常驻乌鲁木齐、合肥；须确认实际招聘城市。薪资未披露。',extra:{published_at:'2026-07-01',page_date_raw:line(p,216),location_conflict:true,location_alternative_raw:line(p,245)}});
}
{
 const p=await page('p23');for(const [n,cityN,d]of[[6,10,14],[17,21,25],[28,32,36],[39,43,47],[50,54,58]])
 add(p,{company:'NXAI',title:clean(line(p,n)),city:clean(line(p,cityN)).replace(/^Image\s*/,''),block:[n,d],ranges:{title:[n,n],description:[d,d]},industry:'云通信、企业软件',attention:'仅取得岗位列表中的职责摘要；任职要求与详情链接待核。与检索词长江协同不是同一家公司。'});
}
{
 const p=await page('p24');for(const [n,t]of p.lines){if(n<246||n>261)continue;const m=clean(t).match(/^(.+?) (销售售前|系统实施|财务与数字化咨询|产品研发) (.+?) 查看详情$/);assert(m,'MISSING_LIST_ROW:'+n);
 add(p,{company:'中兴新云',companyRange:[322,322],companyFacts:line(p,322),title:m[1],city:m[3],block:[n,n],ranges:{company:[322,322],title:[n,n],city:[n,n]},industry:'企业软件、财务数字化',attention:'列表条目，正文待补；城市含“等”时并非完整城市列表。',extra:{page_date_raw:line(p,243)}});
 }
 const d=await page('d01');add(d,{company:'中兴新云',title:'销售经理',city:line(d,205).trim(),direct:true,complete:true,apply:'https://www.wenjuan.com/s/UZBZJvgJFoO',block:[199,227],ranges:{title:[199,199],city:[205,205],description:[214,219],requirements:[222,227]},industry:'企业软件、财务数字化',extra:{page_date_raw:line(d,208),date_semantics:'page states job-information update, not first publication'}});
}
{
 const p=await page('p25');const titles=['AI Native 产品经理','Agent 产品经理','行业 Agent 产品解决方案 Leader','前沿部署工程师（FDE）','售前咨询顾问','销售助理'];
 for(const [i,n]of[117,119,121,123,124,126].entries())add(p,{company:'DOODOD',title:titles[i],city:'北京 · 海淀区',block:[n,n],ranges:{title:[n,n],city:[n,n],description:[n,n]},industry:'AI应用、企业Agent',attention:'仅列表摘要，任职要求待详情核验；售前摘要明确985/211学历限制，当前学历不满足该标签。产品经理仅保留原始记录。'});
}
for(const [id,title,desc,req,city]of[['p31','大模型销售运营',27,30,'北京、上海'],['p32','大模型技术销售工程师',28,31,'深圳、北京、上海、广州、中国香港']]){
 const p=await page(id);add(p,{company:'MiniMax',title,city,direct:true,complete:true,block:[16,req],ranges:{title:[16,16],city:[24,24],salary_raw:[20,20],description:[desc,desc],requirements:[req,req]},salary:line(p,20).replace(/^\s*\*\s*/,''),kind:'third_party_job_republication',industry:'大模型、AI商业化',attention:'第三方转载，未恢复MiniMax官网采集；薪资出处、周期、底薪构成均未核验，不能当作月薪或offer。',extra:{salary_period_note:'来源仅列CNY数值，未说明月/年或固定与浮动；不转换为月薪。',current_opportunity_status:'第三方转载，原厂HC及内容待确认'}});
}
{
 const p=await page('p33');add(p,{company:'月之暗面',companyRange:[326,326],title:'Business Development & Ecosystem',direct:true,block:[53,59],ranges:{company:[326,326],title:[53,53]},kind:'third_party_expired_reference',status:'第三方页面明确“此职位已不再招聘”，仅作历史参考；原官网状态待核',attention:'该第三方条目已过期；薪资是AI估算，已排除薪资机会池，不据此判定其他渠道同岗下架。',extra:{hiring_active:false,description_summary:'第三方摘要指向AI商业化路径探索、客户开拓与生态合作；不是原始JD，未评分。',salary_estimate_raw:line(p,59),closure_evidence:{evidence_file:p.file,evidence_sha256:p.hash,line_range:[119,121],quote:captureRange(p.lines,[119,121])}}});
}
{
 const p=await page('p34');add(p,{company:'海康威视',title:'广东业务中心-产品市场经理-广州',city:'广东省广州市',direct:true,complete:true,block:[11,30],ranges:{title:[11,11],city:[15,15],description:[27,27],requirements:[30,30]},industry:'智能硬件、企业营销',attention:'产品市场经理属于营销方向，并非产品经理；明确要求3年以上音视频或智能化领域经验，当前履历不直接证明。',extra:{published_at:'2026-06-30',page_date_raw:line(p,23)}});
}
{
 const p=await page('p35');for(const[n,t]of p.lines){if(n<187||n>196)continue;const m=t.match(/cite\d+†(.+?)\s*(.*?) Sales Save job/);assert(m);
 add(p,{company:'Arm',title:m[1],city:m[2],block:[n,n],ranges:{title:[n,n],city:[n,n]},industry:'半导体、AI基础设施',attention:'全球Sales分类列表；未取得详细职责、地区工作许可或薪资。不将页面薪资筛选选项绑定到某条岗位。'});
 }
}
assert.equal(new Set(jobs.map(j=>j.id)).size,jobs.length);
await writeFile(join(dir,'new-page-jobs.json'),JSON.stringify(jobs,null,2)+'\n');
const all=[...JSON.parse(await readFile(join(dir,'official-jobs.json'))),...JSON.parse(await readFile(join(dir,'reobserved-jobs.json'))),...jobs];
assert.equal(new Set(all.map(j=>j.id)).size,all.length);
await writeFile(join(dir,'jobs.json'),JSON.stringify(all,null,2)+'\n');
console.log(JSON.stringify({new_page_observations:jobs.length,all_page_observations:all.length,full_jd:all.filter(j=>j.description_complete).length,company_display_names:new Set(all.map(j=>j.company)).size}));
