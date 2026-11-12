import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const dir=dirname(fileURLToPath(import.meta.url)),old=resolve(dir,'../market-wide-2026-09-23');
const plan=JSON.parse(await readFile(resolve(dir,'page-plan.json'),'utf8'));
const index=JSON.parse(await readFile(resolve(dir,'search-index.json'),'utf8'));
const priorJobs=JSON.parse(await readFile(resolve(old,'jobs.json'),'utf8'));
const priorIds=['o10','o13','o15','o16','o18','o23','o32','o33','o34','o35','o36','o41','o30','o05','o31','o06'];
let n=1;
for(const id of priorIds){
  const bytes=await readFile(resolve(old,`raw/${id}.json`));
  const capture=JSON.parse(bytes);
  plan.tasks.push({id:`p${String(n++).padStart(2,'0')}`,route:'A-page-refresh',company:priorJobs.find(j=>j.capture_id===id).company,
    operation:'open',request:capture.request,prior_capture_id:id,prior_capture_file:`01_行情收集/official-careers/research/market-wide-2026-09-23/raw/${id}.json`,
    prior_capture_sha256:createHash('sha256').update(bytes).digest('hex'),
    admission_note:'Successful public-page evidence from prior run; re-read before any reuse; no restricted host.'});
}
for(const id of ['c074-r001','c038-r001','k04-r001','k04-r008','k06-r003','c084-r002','c085-r006','c087-r012','c097-r007','s03-r001','s04-r005','s09-r005','c041-r001','c005-r004','s01-r007','s01-r005','s02-r004','k16-r004','c095-r002','c002-r001']){
  const row=index.results.find(r=>r.result_id===id);
  if(!row?.url)throw new Error(`MISSING_SOURCE:${id}`);
  const host=new URL(row.url).hostname;
  if(/(?:^|\.)(?:zhipin|liepin|linkedin|minimax|farben)\./.test(host))throw new Error(`PROTECTED_SOURCE:${host}`);
  plan.tasks.push({id:`p${String(n++).padStart(2,'0')}`,route:'discovery-detail',company:row.target_company,
    operation:'open',request:{open:[{ref_id:row.url}],response_length:'long'},source_result_id:id,
    discovery_capture:row.capture_file,discovery_capture_sha256:row.capture_sha256,
    admission_note:'Observed public URL. Employer, job status, salary and page completeness require separate review; stop this host on access restriction.'});
}
plan.expanded_at=new Date().toISOString();
plan.market_complete=false;
await writeFile(resolve(dir,'page-plan.json'),JSON.stringify(plan,null,2)+'\n');
console.log(JSON.stringify({planned_reads:plan.tasks.length,new_reads:plan.tasks.length-3}));
