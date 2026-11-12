import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { captureLines,captureRange } from '../market-2026-09-21/build.mjs';

const DIR=fileURLToPath(new URL('.',import.meta.url));
const ROOT=fileURLToPath(new URL('../../../../',import.meta.url));
test('captured full JDs bind to raw page lines; failures never become jobs',async()=>{
  const jobs=JSON.parse(await readFile(join(DIR,'jobs.json'),'utf8'));
  const web=jobs.filter(j=>j.field_evidence);
  assert.equal(web.length,16);
  assert.equal(new Set(web.map(j=>j.id)).size,16);
  for(const job of web){
    assert(job.description_complete&&job.description&&job.requirements);
    assert(!/o0[236]\.json$/.test(job.evidence_file));
    const bytes=await readFile(join(ROOT,job.evidence_file));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),job.evidence_sha256);
    const lines=captureLines(JSON.parse(bytes).result);
    for(const field of Object.values(job.field_evidence))assert.equal(captureRange(lines,field.line_range),field.quote);
    assert(job.field_evidence.title.quote.includes(job.title));
    if(job.salary_raw)assert(job.field_evidence.metadata.quote.includes(job.salary_raw));
    if(!job.native_id)assert.equal(job.job_url,null);
  }
  assert.equal(web.find(j=>j.title==='销售总监').salary_raw,'30K-50K·14薪 + 提成');
  assert.equal(web.find(j=>j.title==='运营总监').salary_raw,'25K-40K·14薪');
  assert(web.some(j=>j.title==='产品经理'));
});
test('partial fallback keeps failed, blocked and unexplored entrances separate',async()=>{
  const report=JSON.parse(await readFile(join(DIR,'report-run.json'),'utf8'));
  assert.equal(report.status,'partial');
  assert.equal(report.market_scan_complete,false);
  assert.equal(report.login_repaired,false);
  assert.equal(report.source_results.find(s=>s.capture==='o03').status,'fetch_failed');
  assert.equal(report.source_results.find(s=>s.capture==='o04').complete_jd,7);
  assert.equal(report.queued_urls.find(s=>s.url==='https://c.liepin.com/').status,'blocked');
  assert.equal(report.request_count.web_tool_actual_calls,8);
  assert.equal(report.request_count.http_requests,8);
  assert.equal(report.counts.observations,54);
  assert.equal(report.counts.complete_jd,20);
  assert.equal(report.counts.full_source_not_split,34);
});
