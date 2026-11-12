import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname,join,resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const dir=dirname(fileURLToPath(import.meta.url)),root=resolve(dir,'../../../..');
const sha=b=>createHash('sha256').update(b).digest('hex');
const read=p=>readFile(p,'utf8').then(JSON.parse);
const reportPath=join(root,'01_行情收集/official-careers/reports');
const jobs=await read(join(dir,'jobs.json')),run=await read(join(dir,'report-run.json')),report=await read(join(reportPath,'decision-review.json'));
const jobHash=sha(await readFile(join(dir,'jobs.json')));
const issues=[];
for(const source of report.source_manifest)assert.equal(sha(await readFile(join(root,source.path))),source.sha256,source.path);
assert.equal(report.delivery_acceptance.status,'not_accepted');
assert.equal(report.collection.scheduler_enabled,false);
assert.equal(run.market_scan_complete,false);
assert.equal(report.groups.flatMap(g=>g.jobs).filter(j=>j.latest_collection).length,run.counts.combined_report_records);
assert.equal(report.groups.flatMap(g=>g.jobs).filter(j=>!j.company).length,report.counts.company_unknown);
assert(jobs.every(j=>j.hiring_active==='unknown'&&!j.salary_fixed_base_confirmed));
assert.equal(jobs.filter(j=>j.capture_id==='o06').length,34);
assert.equal(jobs.filter(j=>j.capture_id==='o06tail').length,0);
assert.equal(jobs.find(j=>j.id.endsWith('o15:l498')).description_complete,false);
assert(jobs.find(j=>j.capture_id==='d09').salary_raw===null);
assert(jobs.filter(j=>j.capture_id==='o34').every(j=>j.company==='河南信安世纪科技有限公司'));
const csv=await readFile(join(reportPath,'decision-review.csv'),'utf8'),md=await readFile(join(reportPath,'decision-review.md'),'utf8'),html=await readFile(join(reportPath,'decision-review.html'),'utf8');
for(const token of ['additional_requirements','recruitment_period_raw','attention','salary_period_note'])assert(csv.split('\n')[0].includes(token));
assert(md.includes('2020-12-30'));assert(md.includes('源栏目异常'));assert(md.includes('Cursor、Claude Code、Coze、Dify'));
assert(html.includes('Cursor、Claude Code、Coze、Dify'));
const testFiles=['decision-review','role-policy','salary-target','opportunity-identity'].map(n=>`careers/tests/${n}.test.mjs`);
const test=spawnSync(process.execPath,['--test',...testFiles],{cwd:root,encoding:'utf8'});
await writeFile(join(dir,'targeted-tests.txt'),test.stdout+test.stderr);assert.equal(test.status,0,test.stdout+test.stderr);
const visual=spawnSync(process.execPath,['careers/tests/decision-review-visual.mjs'],{cwd:root,encoding:'utf8'});assert.equal(visual.status,0,visual.stdout+visual.stderr);
const mainVisual=await read(join(reportPath,'qa/decision-review-visual.json'));
assert.equal(mainVisual.report_sha256,sha(await readFile(join(reportPath,'decision-review.html'))));
const explorerVisual=spawnSync(process.execPath,[join(dir,'check-search-explorer.mjs')],{cwd:root,encoding:'utf8'});assert.equal(explorerVisual.status,0,explorerVisual.stdout+explorerVisual.stderr);
const admission=await read(join(dir,'admission-audit.json'));assert.equal(admission.status,'passed_for_recorded_calls');assert.equal(admission.calls,190);
const qa=await read(join(dir,'independent-qa-retest.json'));
assert.equal(qa.status,'passed_scoped_retest');
assert.equal(qa.snapshot.manifest.find(f=>f.file==='jobs.json').sha256,jobHash);
const result={status:'deterministic_delivery_checks_passed',verified_at:new Date().toISOString(),scope:'Current batch artifacts, source manifests, offline rendering and regression tests; not full market or hiring acceptance',
  jobs_sha256:jobHash,counts:run.counts,cumulative:report.counts,tests:{exit_code:test.status,passed:Number(test.stdout.match(/(?:ℹ |# )pass (\d+)/)?.[1]),failed:0,log:relative(root,join(dir,'targeted-tests.txt'))},
  main_visual:mainVisual,explorer_visual:await read(join(dir,'search-explorer-qa.json')),admission:{status:admission.status,calls:admission.calls,minimum_queue_cooldown_ms:admission.minimum_cooldown_ms,issues:admission.issues,warnings:admission.warnings.length},
  independent_qa_file:relative(root,join(dir,'independent-qa-retest.json')),independent_qa_status:qa.status??qa.verdict??qa.conclusion??'see referenced QA file',issues,
  market_complete:false,background_collection_running:false,applications:0,scheduled:false,
  hashes:Object.fromEntries(await Promise.all(['jobs.json','report-jobs.json','report-run.json','summary.md','search-explorer.html','independent-qa-retest.json'].map(async name=>[name,sha(await readFile(join(dir,name)))])))};
await writeFile(join(dir,'final-verification.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({...result,hashes:undefined,main_visual:undefined,explorer_visual:undefined}));
