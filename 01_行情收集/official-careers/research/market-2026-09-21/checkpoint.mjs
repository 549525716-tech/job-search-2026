import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join, resolve, relative } from 'node:path';
import { captureMatchesAdmission } from '../../../../careers/capture-contract.mjs';
import { captureTimes } from '../../../../careers/audit-web-session.mjs';

const dir = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(dir, '../../../..');
const read = async p => JSON.parse(await readFile(p, 'utf8'));
const save = (p, v) => writeFile(join(dir, p), JSON.stringify(v, null, 2) + '\n');
const events = (await readFile(join(dir, 'web-session.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
const jobs = await read(join(dir, 'jobs.json'));
const extraction = await read(join(dir, 'run.json'));
const begins = new Map(), finishes = new Map(), issues = [], receipts = [];
let priorFinish = null;
for (const event of events) {
  if (event.event === 'begin') {
    if (begins.has(event.id)) issues.push(`${event.id}: duplicate admission`);
    const gap = priorFinish ? Date.parse(event.queue_admitted_at) - Date.parse(priorFinish) : null;
    if (gap !== null && (!Number.isFinite(gap) || gap < 9990)) issues.push(`${event.id}: short cooldown`);
    begins.set(event.id, {...event, gap_ms: gap});
  } else if (event.event === 'finish') {
    finishes.set(event.id, event);
    priorFinish = event.persisted_at;
    const admission = begins.get(event.id);
    try {
      if (!admission) throw new Error('missing admission');
      const bytes = await readFile(resolve(root, event.evidence_file));
      if (createHash('sha256').update(bytes).digest('hex') !== event.evidence_sha256) throw new Error('SHA mismatch');
      const capture = JSON.parse(bytes);
      if (!captureMatchesAdmission(capture, admission)) throw new Error('capture contract mismatch');
      const timing = captureTimes(capture);
      const times = [admission.queue_admitted_at, timing.started_at, timing.observed_at, event.persisted_at].map(Date.parse);
      if (times.some(n => !Number.isFinite(n)) || times[1] < times[0] - 1000 || times[2] < times[1] || times[3] < times[2] - 1000) throw new Error('timestamp order invalid');
      receipts.push({id:event.id,kind:capture.kind,operation:capture.operation,route:admission.route,
        observed_at:timing.observed_at,started_at:timing.started_at,cooldown_ms:admission.gap_ms,
        evidence_file:event.evidence_file,evidence_sha256:event.evidence_sha256});
    } catch (error) { issues.push(`${event.id}: ${error.message}`); }
  }
}
const unfinished = [...begins.keys()].filter(id => !finishes.has(id));
const audit = {scope:'Only persisted queue records and captures. Does not prove absence of unrecorded activity or fresh HTTP responses.',
  status:issues.length?'needs_review':unfinished.length?'partial_interrupted_admission':'passed_for_recorded_calls',
  admitted:begins.size,completed:finishes.size,verified:receipts.length,unfinished,
  interrupted_outcome:'o19 was admitted before interruption without a saved result; o19r is a separately recorded continuation, not retroactive completion.',
  issues,minimum_cooldown_ms:Math.min(...receipts.map(r=>r.cooldown_ms).filter(Number.isFinite)),receipts};
await save('request-audit.json',audit);
const current = jobs.filter(j=>j.evidence_file?.includes('/market-2026-09-21/raw/'));
await save('current-jobs.json',current);
await save('carried-forward-jobs.json',jobs.filter(j=>!current.includes(j)));
const web = receipts.filter(r=>r.kind==='web_tool_result_not_raw_http');
const reportRun = {run_id:'market-2026-09-21',started_at:receipts.at(0)?.started_at,finished_at:receipts.at(-1)?.observed_at,
  scope:'续接9月20日发现的AI应用、企业软件、工业软件、云算力及ToB渠道来源。新抓取与旧卡片分开；不是全市场扫描完成。',
  request_count:{web_tool_actual_calls:web.length,completed_browser_captures:receipts.length-web.length,
    unfinished_admissions:unfinished,admission_timing_status:audit.status,underlying_http_freshness:'not_verified'},
  counts:{new_observations:current.length,complete_jd:current.filter(j=>j.description_complete).length,
    new_company_names:new Set(current.map(j=>j.company)).size,prior_observations_preserved:jobs.length-current.length},
  source_scan_status:extraction.source_scan_status,
  queries:extraction.source_scan_status.filter(s=>s.file!=='o01.json').map(s=>({query:s.file,status:`${s.status}；${s.extracted_jobs}条；${s.reason??'网页已保存，非全公司覆盖'}`})),
  queued_urls:[
    {url:'https://www.zhipin.com/',reason:'Chrome自动导航仍为空白，等待用户手动打开；不刷新重试。'},
    {url:'https://www.liepin.com/',reason:'Chrome自动导航为空白，等待用户手动打开；此前40张卡片不是完整JD。'},
    {url:'https://www.ymatrix.ai/joinus',reason:'职位名称已取得，详情与薪资待核。'},
    {url:'https://jobs.bytedance.com/experienced/position/7673717322767501621/detail',reason:'官网未取得正文，第三方页面声明职责不完整。'},
    {url:'https://hr.163.com/job-detail.html?id=77241',reason:'第三方JD已保存；官网读取失败，当前开放状态待核。'}
  ],
  market_complete:false,business_acceptance:'not_accepted',applications_sent:0,scheduler_enabled:false,
  extraction_receipt:relative(root,join(dir,'run.json')),request_audit:relative(root,join(dir,'request-audit.json'))};
await save('report-run.json',reportRun);
console.log(JSON.stringify({audit: {...audit,receipts:undefined},counts:reportRun.counts}));
