import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname,resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const dir=dirname(fileURLToPath(import.meta.url)),root=resolve(dir,'../../../..');
const ids=['bailian-ai-52901d1d-b3bb-4f55-9957-d7efac4268a5','deepseek-73f5ba27-882a-4c59-87f3-87685b4d1944'];
const jobs=[];
for(const id of ids){
  const path=resolve(root,`01_行情收集/official-careers/reports/${id}.json`);
  const report=JSON.parse(await readFile(path,'utf8'));
  for(const run of report.runs){
    assert.equal(run.status,'success');
    for(const j of run.jobs){
      const body=await readFile(resolve(root,j.body_path));
      const hash=createHash('sha256').update(body).digest('hex');
      assert.equal(hash,j.raw_response_sha256);
      const split=Boolean(j.responsibilities&&j.requirements);
      jobs.push({...j,id:`market-wide-2026-10-08:${j.job_key}`,company:j.company_name,
        location:j.location_raw,city:j.location_raw,description:j.responsibilities||j.description_text,
        source_description_complete:j.description_complete,
        description_complete:j.description_complete&&split,
        description_structure_status:split?'separate_source_sections':'full_source_not_split',
        source_kind:'official_board',channel:'公司官网',source_url:j.board_url,
        apply_url:j.application_url,observed_at:j.fetched_at,
        evidence_file:j.body_path,evidence_sha256:hash,
        supporting_evidence:[{file:relative(root,path),sha256:createHash('sha256').update(await readFile(path)).digest('hex')}],
        source_run_id:run.run_id,source_scope:run.scope,
        industry:j.company_id==='deepseek'?'基础大模型':'AI企业应用',
        salary_fixed_base_confirmed:false,hiring_active:'unknown',
        time_note:'本轮重新读取官网；读取时间不等于首次发布。网页可访问不等于招聘HC已由雇主确认。',
        scope_note:'仅该官网招聘页的声明范围；不代表该公司全渠道或全市场岗位收齐。',
        attention:!split?'官网原文已保存，未单独拆分职责/要求；尚未做个人能力评分。':'尚未做个人能力评分；薪资未披露时保留待核。'});
    }
  }
}
await writeFile(resolve(dir,'official-jobs.json'),JSON.stringify(jobs,null,2)+'\n');
await writeFile(resolve(dir,'jobs.json'),JSON.stringify(jobs,null,2)+'\n');
console.log(JSON.stringify({official_observations:jobs.length,split_full_jd:jobs.filter(j=>j.description_complete).length}));
