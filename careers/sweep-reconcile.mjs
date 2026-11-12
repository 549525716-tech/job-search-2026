import { readFile, writeFile, readdir, copyFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { ROOT, evidenceAbsolute } from './paths.mjs';

// Reconcile counters from immutable collection outputs, never from agent summaries.
const dir = evidenceAbsolute(process.argv[2]);
const read = async (name) => JSON.parse(await readFile(join(dir, name), 'utf8'));
const jobs = await read('jobs.json');
const coverage = await read('coverage.json');
const run = await read('run.json');
await copyFile(join(dir, 'run.json'), join(dir, 'run.network-executor-close.json'), 1).catch((error) => {
  if (error.code !== 'EEXIST') throw error;
});
const aliases = { AWS: 'Amazon Web Services', 百度云: '百度智能云' };
const notes = {
  华为云: '官网读到2018年发布的历史岗位，不能作为当前招聘机会；原文保留，不纳入本轮正式岗位。',
  科大讯飞: '高校承载的营销类校招信息，页面含2026-06-30和campus邮箱；非已核实社招，不纳入正式岗位。',
  Microsoft: '已读深圳聚合招聘页，商业与技术岗位混合；独立链接及逐岗证据尚未完成提取，本轮仅保留原文。',
  销售易: '提取CBG社会招聘块3条；同页校招不混入，单个岗位无发布日期和独立详情链接，仍在招待核。',
  腾讯云: '仅完成搜索索引检索，未取得可确认的销售完整JD；不能据此判定官网没有岗位。',
  阿里云: '搜索返回开发、财经或校园相关结果，未核实可纳入本轮的社招销售JD。',
  美团: '本次搜索以校园招聘结果为主，未核实可纳入本轮的社招商业岗位。',
  金蝶: '搜索含营销文章与海外招聘入口，未核实国内销售完整JD。',
  用友: '本次结果包含伙伴招募，不能当作员工招聘；未取得可纳入的完整JD。',
};
for (const row of coverage) {
  row.company = aliases[row.company] || row.company;
  row.entity_kind = row.attempted ? 'company' : 'paused_source_group';
  const candidates = jobs.filter((job) => job.company === row.company);
  row.formal_job_count = candidates.length;
  row.full_jd_count = candidates.filter((job) => job.description_complete).length;
  row.index_count = candidates.filter((job) => job.source_kind === 'search_index').length;
  row.job_count = row.formal_job_count;
  if (notes[row.company]) row.reason = notes[row.company];
  if (['华为云', '科大讯飞'].includes(row.company)) row.status = 'excluded_historical_or_campus';
  if (row.company === 'Microsoft') row.status = 'raw_read_extraction_pending';
  if (row.company === '销售易') row.status = 'captured_filtered';
  const records = await Promise.all((row.evidence_files || []).map(async (path) => JSON.parse(await readFile(join(ROOT, path), 'utf8'))));
  row.queries = [...new Set(records.flatMap((record) => (record.request?.search_query || []).map((query) => query.q)))];
  row.urls = [...new Set(records.flatMap((record) => {
    const requested = (record.request?.open || []).map((item) => item.ref_id).filter((url) => /^https:\/\//.test(url));
    const header = record.operation === 'open' && typeof record.result === 'string' ? record.result.split('\n')[0].match(/\((https:\/\/[^\s]+)\)$/)?.[1] : null;
    return [...requested, ...(header ? [header] : [])];
  }))];
}
const files = (await readdir(join(dir, 'raw'))).filter((file) => file.endsWith('.json')).sort();
const placeholders = new Set(run.timestamp_integrity?.unverified_placeholder_files || []);
const ledger = [];
for (const file of files) {
  const record = await read(`raw/${file}`);
  const placeholder = placeholders.has(file);
  ledger.push({ file, execution: file.startsWith('pm-') ? 'controller' : 'gpt-5.6-luna / medium',
    operation: record.operation, request: record.request,
    started_at: record.started_at || null, observed_at: placeholder ? null : record.observed_at,
    timestamp_status: placeholder ? 'unverified_placeholder_preserved_in_raw' : record.started_at ? 'call_start_recorded' : 'result_persistence_time_only',
    evidence_kind: record.kind, direct_http_audit: false });
}
run.status = 'collection_complete_with_limitations';
run.formal_job_counts_from_controller = {
  jobs_total: jobs.length, description_complete: jobs.filter((job) => job.description_complete).length,
  index_only: jobs.filter((job) => job.source_kind === 'search_index').length,
  companies_with_complete_jobs: new Set(jobs.filter((job) => job.description_complete).map((job) => job.company)).size,
};
run.jobs_count_note = '执行器收尾时22条口径先于总控新增销售易3条；最终以固定jobs.json逐条核算为25条，未改动原文。';
run.companies_attempted_count = coverage.filter((row) => row.attempted).length;
run.raw_file_count = files.length;
run.web_calls_total = files.length;
run.call_ledger_source = 'capture-ledger.json';
run.timing_audit_status = 'partial_not_passed_full_call_interval_audit';
run.timing_audit_note = '使用共用限速队列；4份早期记录为占位时间，其余部分仅记录结果落盘时间。因此不能证明38次调用的全部实际间隔，不伪造调用起始时间。';
for (const [name, value] of [['coverage.json', coverage], ['run.json', run], ['capture-ledger.json', { schema_version: 1, entries: ledger, timing_audit_status: run.timing_audit_status }]]) {
  await writeFile(join(dir, name), `${JSON.stringify(value, null, 2)}\n`);
}
console.log(JSON.stringify({ directory: basename(dir), counts: run.formal_job_counts_from_controller, companies: run.companies_attempted_count, raw_calls: files.length }));
