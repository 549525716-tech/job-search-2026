import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const dir = dirname(fileURLToPath(import.meta.url));
const read = name => readFile(join(dir,name),'utf8').then(JSON.parse);
const [jobBytes, indexBytes, source] = await Promise.all([readFile(join(dir,'jobs.json')),readFile(join(dir,'search-index.json')),read('search-job-leads.json')]);
const jobs = JSON.parse(jobBytes);
assert.equal(createHash('sha256').update(jobBytes).digest('hex'),source.snapshot.jobs_sha256,'JOB_INPUT_CHANGED_REBUILD_LEADS');
assert.equal(createHash('sha256').update(indexBytes).digest('hex'),source.snapshot.index_sha256,'SEARCH_INPUT_CHANGED_REBUILD_LEADS');
const byResult = new Map(source.leads.map(r => [r.result_id,r]));
const additions = [];
for (const group of source.exact_url_groups.filter(g => g.counted_as_new_url_lead)) {
  const variants = new Map();
  for (const resultId of group.result_ids) {
    const lead = byResult.get(resultId);
    assert(lead && lead.url === group.url);
    const key = JSON.stringify([lead.company,lead.title]);
    if (!variants.has(key)) variants.set(key,[]);
    variants.get(key).push(lead);
  }
  for (const [pair, observations] of variants) {
    const latest = observations.toSorted((a,b)=>b.observed_at.localeCompare(a.observed_at))[0];
    additions.push({
      ...latest, id:'search-lead:'+createHash('sha256').update(group.url+'\n'+pair).digest('hex').slice(0,24),
      job_url:group.url,source_url:group.url,apply_url:null,
      source_kind:'search_index_lead',channel:'公开搜索职位线索',
      location:latest.location_raw,city:latest.city,
      description:null,requirements:null,description_complete:false,
      description_structure_status:'search_index_only',
      salary_fixed_base_confirmed:false,hiring_active:'unknown',
      evidence_file:latest.provenance.capture_file,evidence_sha256:latest.provenance.capture_sha256,
      observations,result_ids:observations.map(o=>o.result_id),
      source_url_group:group.url_group_id,source_pair_conflict:group.conflict_status,
      identity_note:'仅按相同URL与相同标题/雇主展示名关联搜索证据；不同URL保留，HR身份未知。',
      time_note:'本次搜索观察时间，不是发布时间、直接打开岗位页面或当前在招确认。',
      attention:'搜索索引线索，尚未取得完整JD；薪资构成、招聘主体与当前HC待核。'+(group.conflict_status!=='no_observed_pair_conflict'?' 同URL出现不同岗位或公司名称，已分开保留，身份待核。':''),
      scope_note:'来源访问权限和历史隔离未解除；收录链接不代表已登录平台、已读详情或已获投递授权。'
    });
  }
}
const output=[...jobs,...additions];
assert.equal(new Set(output.map(j=>j.id)).size,output.length);
assert(additions.every(j=>j.company&&j.title&&!j.description_complete&&!j.description&&!j.requirements));
assert.deepEqual(output.slice(0,jobs.length),jobs);
const audit={page_job_records:jobs.length,search_lead_url_groups:source.counts.exact_url_lead_groups,
  already_in_page_jobs:source.counts.same_url_existing_job_groups,
  added_search_lead_variants:additions.length,search_observations_in_added_variants:additions.reduce((n,j)=>n+j.observations.length,0),
  combined_records:output.length,complete_jd:jobs.filter(j=>j.description_complete).length,
  source_pair_conflicts_preserved:additions.filter(j=>j.source_pair_conflict!=='no_observed_pair_conflict').length,
  market_complete:false,unique_job_count_claim:false};
await writeFile(join(dir,'report-jobs.json'),JSON.stringify(output,null,2)+'\n');
await writeFile(join(dir,'report-composition.json'),JSON.stringify(audit,null,2)+'\n');
console.log(JSON.stringify(audit));
