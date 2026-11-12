import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureLines, captureRange } from '../../../../careers/extract-coverage-captures.mjs';
const dir=dirname(fileURLToPath(import.meta.url)),root=resolve(dir,'../../../..');
const load=async name=>JSON.parse(await readFile(resolve(dir,name),'utf8'));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const [jobs,companies,run,audit]=[await load('jobs.json'),await load('companies.json'),await load('run.json'),await load('timing-audit.json')];
const cache=new Map();
async function raw(file,hash){
  if(!cache.has(file)){const bytes=await readFile(resolve(root,file));cache.set(file,{hash:digest(bytes),data:JSON.parse(bytes)});}
  const c=cache.get(file);assert.equal(c.hash,hash,file);return c.data;
}
for(const j of jobs){
  const c=await raw(j.evidence_file,j.evidence_sha256);
  assert(c.result.includes(j.source_url),`URL ${j.id}`);
  assert(j.company&&j.title&&!/^confidential$/i.test(j.company));
  assert(c.result.includes(j.evidence_quote),`quote ${j.id}`);
  assert.equal(j.hiring_freshness_verified,false);
  assert.equal(j.apply_url,null);
  assert.equal(j.assessment,undefined);
  if(j.salary_raw){assert(j.salary_raw.length<70);assert(c.result.includes(j.salary_raw));assert(/\d/.test(j.salary_raw));}
  if(j.location)assert(!/Image:|联系人|招聘人数/.test(j.location));
  if(j.description_complete){
    assert.equal(j.extraction_method,'reviewed_source_line_ranges');
    assert(j.description.length>5&&j.requirements.length>5);
    const lines=captureLines(c.result),r=j.evidence_line_ranges;
    assert.equal(captureRange(lines,r.responsibilities),j.description);
    assert.equal(captureRange(lines,r.requirements),j.requirements);
  }
  for(const e of j.supporting_evidence??[])await raw(e.file,e.sha256);
}
for(const c of companies){
  assert.equal(c.identity_status,'unverified_display_name_or_brand');
  for(const e of c.evidence){const r=await raw(e.evidence_file,e.evidence_sha256);assert(r.result.includes(e.verbatim_quote));}
}
assert.equal(new Set(jobs.map(j=>j.id)).size,jobs.length);
assert.equal(run.counts.observations,jobs.length);
assert.equal(run.counts.company_display_names,new Set(jobs.map(j=>j.company)).size);
assert.equal(run.counts.full_jd,jobs.filter(j=>j.description_complete).length);
assert.equal(run.counts.company_discovery_display_names,companies.length);
assert.equal(run.market_scan_complete,false);
assert.equal(audit.calls,52);assert.equal(audit.issues.length,0);assert(audit.minimum_cooldown_ms>=10000);
// Regression checks for this batch's observed extraction failures.
assert.equal(jobs.find(j=>j.id==='breadth-q20-r02').salary_raw,null);
assert.equal(jobs.find(j=>j.id==='breadth-q20-r03').location,'成都双流区空港韩国城二期5栋1单元1115（空港明珠酒店同栋）');
assert.equal(jobs.find(j=>j.id==='breadth-a07-structured-0c4b8eb4').salary_raw,'1.8-2.5万');
assert(jobs.some(j=>j.id==='breadth-o09-l171'&&j.role_review.eligible));
assert.equal(jobs.find(j=>j.id==='breadth-q02-r1').employment_type,'campus');
assert.equal(jobs.find(j=>j.id==='breadth-q02-r2').employment_type,'not_confirmed');
for(const id of ['breadth-q02-r4','breadth-q21-r06','breadth-q18-r08','breadth-q18-r10']){
  assert.equal(jobs.find(j=>j.id===id).employment_type,'campus',id);
  assert.equal(jobs.find(j=>j.id===id).role_review.eligible,false,id);
}
for(const id of ['breadth-a06-r7','breadth-q24-r7','breadth-q03-r2'])assert.equal(jobs.find(j=>j.id===id).industry,null,id);
assert.equal(jobs.find(j=>j.id==='breadth-o11-l14').industry,'AI企业应用');
for(const e of companies.find(c=>c.company_name==='飞轮科技（SelectDB）').evidence)assert.match(e.verbatim_quote,/飞轮科技/);
const result={passed:true,checked_at:new Date().toISOString(),jobs:jobs.length,companies:companies.length,
  scope:'Offline evidence hash, field binding, complete-JD line ranges and prior extraction regressions; not market completeness or live hiring verification',
  jobs_sha256:digest(await readFile(resolve(dir,'jobs.json'))),company_sha256:digest(await readFile(resolve(dir,'companies.json')))};
await writeFile(resolve(dir,'deterministic-validation.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
