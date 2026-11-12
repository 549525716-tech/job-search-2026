import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname,join,resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {captureLines,captureRange} from '../market-2026-09-21/build.mjs';
const dir=dirname(fileURLToPath(import.meta.url)),root=resolve(dir,'../../../..');
const old=resolve(dir,'../market-wide-2026-09-23');
const previous=JSON.parse(await readFile(join(old,'jobs.json'),'utf8'));
const jobs=[],checks=[];
const sha=x=>createHash('sha256').update(x).digest('hex');
const priors=new Map();
for(const j of previous){
  if(!priors.has(j.capture_id))priors.set(j.capture_id,JSON.parse(await readFile(join(old,`raw/${j.capture_id}.json`),'utf8')));
}
for(const file of (await readdir(join(dir,'raw'))).filter(f=>f.endsWith('.json')).sort()){
  const bytes=await readFile(join(dir,'raw',file)),c=JSON.parse(bytes);
  if(c.operation!=='open')continue;
  const url=c.request.open[0].ref_id;
  const priorEntry=[...priors].find(([,p])=>p.request?.open?.[0]?.ref_id===url);
  if(!priorEntry)continue;
  const [oldId,priorCapture]=priorEntry;
  const lines=captureLines(c.result),header=c.result.split(/(?:^|\s)L\d+:/)[0];
  const currentRef=header.match(/cite([^]+)/)?.[1]??null;
  const priorRef=priorCapture.result.match(/cite([^]+)/)?.[1]??null;
  const currentFile=relative(root,join(dir,'raw',file)),oldFile=relative(root,join(old,'raw',`${oldId}.json`));
  const priorLines=captureLines(priorCapture.result);
  const normalize=v=>v.replace(/cite[^†]*†([^]*)/g,'$1').replace(/\s+/g,' ').trim();
  const previousText=new Set([...priorLines.values()].map(normalize).filter(Boolean));
  const unseenLines=[...lines].filter(([,v])=>normalize(v)&&!previousText.has(normalize(v)));
  const entry={capture_id:c.id,url,prior_capture_id:oldId,reobserved:0,pending:[],evidence_file:currentFile,evidence_sha256:sha(bytes),
    page_content_changed:/Internal Error|Failed to fetch/.test(c.result.slice(0,700))?null:unseenLines.length>0,
    comparison_status:/Internal Error|Failed to fetch/.test(c.result.slice(0,700))?'read_failed_not_compared':'visible_text_compared',
    unreviewed_new_lines:unseenLines.map(([line,text])=>({line,text})),
    inventory_complete:false,inventory_note:'Block reuse does not prove that every newly added role or pagination page was collected.'};
  function bind(v){
    if(Array.isArray(v))return v.map(bind);
    if(v===priorRef)return currentRef;
    if(!v||typeof v!=='object')return v;
    const out=Object.fromEntries(Object.entries(v).map(([k,x])=>[k,bind(x)]));
    if(v.evidence_file){
      assert.equal(v.evidence_file,oldFile,'CROSS_CAPTURE_EVIDENCE_REQUIRES_SEPARATE_REVIEW');
      if(v.line_range&&v.quote!==undefined){
        const quote=captureRange(lines,v.line_range);
        assert.equal(quote,v.quote,'SOURCE_TEXT_CHANGED');
        out.quote=quote;out.quote_sha256=sha(quote);
      }else if(v.locator==='result_header'){
        out.quote=header;out.quote_sha256=sha(header);
      }else if(v.locator==='capture_metadata')out.value=c.observed_at;
      out.evidence_file=currentFile;out.evidence_sha256=sha(bytes);
      if('capture_id' in v)out.capture_id=c.id;
      if('result_sha256' in v)out.result_sha256=sha(c.result);
    }
    return out;
  }
  for(const j of previous.filter(j=>j.capture_id===oldId)){
    try{
      assert(!/Internal Error|Failed to fetch/.test(c.result.slice(0,700)),'PAGE_READ_FAILED');
      assert(j.raw_job_block_evidence?.quote,'NO_PRIOR_BOUND_BLOCK');
      const copy=bind(j);
      for(const [field,e]of Object.entries(copy.field_evidence??{})){
        if(typeof copy[field]==='string'&&e?.quote){
          const at=e.quote.indexOf(copy[field]);assert(at>=0,`UNBOUND_FIELD:${field}`);
          e.value_char_range=[at,at+copy[field].length];
        }
      }
      copy.id=`market-wide-2026-10-08:${c.id}:${j.id.split(':').at(-1)}`;
      copy.capture_id=c.id;copy.observed_at=c.observed_at;copy.prior_observation_id=j.id;
      copy.supporting_evidence=[];
      copy.reobservation_status='visible_block_and_bound_fields_retrieved_and_equal';
      copy.source_crawl_metadata=header.match(/Crawled: ([^;\n]+)/)?.[1]??null;
      copy.time_note='本轮经网页检索工具重新取证，已核对岗位片段与字段；工具可能返回缓存内容。观察时间不是发布时间，也不是雇主确认HC时间。';
      copy.hiring_active='unknown';copy.scope_complete=false;
      if(/续读失败|源内容截断/.test(copy.attention??''))copy.attention='历史片段不完整；本轮只核对到相同片段，完整JD仍待补。';
      jobs.push(copy);entry.reobserved++;
    }catch(e){entry.pending.push({prior_id:j.id,title:j.title,reason:e.message.split('\n')[0]});}
  }
  checks.push(entry);
}
assert.equal(new Set(jobs.map(j=>j.id)).size,jobs.length);
await writeFile(join(dir,'reobserved-jobs.json'),JSON.stringify(jobs,null,2)+'\n');
await writeFile(join(dir,'reobservation-audit.json'),JSON.stringify({jobs:jobs.length,full_jd:jobs.filter(j=>j.description_complete).length,checks,network_requests:0,source_complete:false,independent_qa:false},null,2)+'\n');
console.log(JSON.stringify({jobs:jobs.length,full_jd:jobs.filter(j=>j.description_complete).length,checks:checks.map(c=>({id:c.capture_id,kept:c.reobserved,pending:c.pending.length,reasons:[...new Set(c.pending.map(p=>p.reason))]}))}));
