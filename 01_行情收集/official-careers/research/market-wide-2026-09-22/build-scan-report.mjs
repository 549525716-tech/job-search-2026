import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { csvCell as csv } from '../../../../careers/overview.mjs';

const dir = dirname(fileURLToPath(import.meta.url));
const read = name => readFile(join(dir, name), 'utf8').then(JSON.parse);
const save = (name, value) => writeFile(join(dir, name), JSON.stringify(value, null, 2) + '\n');
const pipe = value => String(value ?? '').replaceAll('|', '/').replaceAll('\n', ' ');
const [catalog, plan, index, candidates, jobs, extraction, details, timing, wave2, composition, leads, scope] = await Promise.all([
  read('catalog-plan.json'), read('execution-plan-v2.json'), read('search-index.json'),
  read('source-candidates.json'), read('jobs.json'), read('extraction-audit.json'),
  read('detail-backlog.json'), read('timing-audit.json'), read('new-company-wave2-plan.json'),
  read('report-composition.json'), read('search-job-leads.json'), read('scope.json')
]);
const captures = new Map();
for (const file of (await readdir(join(dir, 'raw'))).filter(f => f.endsWith('.json'))) {
  const bytes = await readFile(join(dir, 'raw', file));
  captures.set(file.replace(/\.json$/, ''), {
    data: JSON.parse(bytes), sha256: createHash('sha256').update(bytes).digest('hex')
  });
}
const queryCoverage = q => {
  const raw = captures.get(q.id);
  const recorded = timing.receipts.some(r => r.id === q.id && r.evidence_sha256 === raw?.sha256);
  if (raw && !isDeepStrictEqual(raw.data.request, q.request)) throw new Error(`QUERY_PLAN_MISMATCH:${q.id}`);
  return { ...q, status: recorded ? 'searched_not_exhaustive' : 'not_scanned',
    result_count: index.results.filter(r => r.capture_id === q.id).length,
    urls: [...new Set(index.results.filter(r => r.capture_id === q.id).map(r => r.url).filter(Boolean))],
    observed_at: raw?.data.observed_at ?? null,
    evidence_file: raw ? `01_行情收集/official-careers/research/market-wide-2026-09-22/raw/${q.id}.json` : null,
    evidence_sha256: raw?.sha256 ?? null };
};
const queryRows = plan.queries.map(queryCoverage);
const backfillRows = wave2.queries.map(queryCoverage);
const routeRows = scope.industry_and_keyword_queries.map(queryCoverage);
const companies = catalog.companies.map(c => {
  const queries = queryRows.filter(q => q.company_ids.includes(c.id));
  return { id: c.id, company: c.display_name, industry_labels_raw: c.industry_labels_raw,
    status: !queries.length ? 'identity_pending' : queries.every(q => q.status === 'searched_not_exhaustive') ? 'initial_search_done_details_pending' : 'not_scanned',
    queries, urls: [...new Set(queries.flatMap(q => q.urls))],
    company_identity_verified: false, company_job_inventory_complete: false,
    channels: { public_search: queries.some(q => q.status === 'searched_not_exhaustive') ? 'searched_not_exhaustive' : 'not_scanned',
      official_and_other_platform_detail_coverage: 'see_job_evidence_not_company_complete',
      boss: 'isolated_not_scanned', liepin: 'isolated_not_scanned' } };
});
const all = [...captures.values()].map(c => c.data).sort((a,b) => a.started_at.localeCompare(b.started_at));
const failedReads = all.filter(c => c.operation !== 'search' && /Failed to fetch|Internal Error|403 Forbidden|429 Too Many/.test(String(c.result)));
const counts = {
  industry_queries_executed: routeRows.filter(q => q.route === 'A' && q.status === 'searched_not_exhaustive').length,
  cross_market_queries_executed: routeRows.filter(q => q.route === 'B' && q.status === 'searched_not_exhaustive').length,
  company_display_records: companies.length,
  company_queries_planned: queryRows.length,
  company_queries_executed: queryRows.filter(q => q.status === 'searched_not_exhaustive').length,
  new_company_queries_planned: backfillRows.length,
  new_company_queries_executed: backfillRows.filter(q => q.status === 'searched_not_exhaustive').length,
  company_display_records_search_attempted: companies.filter(c => c.status === 'initial_search_done_details_pending').length,
  anonymous_company_records_pending: companies.filter(c => c.status === 'identity_pending').length,
  searches: all.filter(c => c.operation === 'search').length,
  page_reads: all.filter(c => c.operation !== 'search').length,
  failed_page_reads: failedReads.length,
  search_result_entries: index.counts.result_entries,
  distinct_discovered_urls: index.counts.distinct_urls,
  observations: jobs.length,
  complete_jd: jobs.filter(j => j.description_complete === true).length,
  separate_search_job_leads: composition.added_search_lead_variants,
  combined_report_records: composition.combined_records,
  companies: new Set(jobs.map(j => j.company).filter(Boolean)).size
};
const queue = [
  { url: 'https://www.zhipin.com/web/geek/jobs', reason: '内置自动接管隔离；未动现有普通登录标签；完整JD与HR入口待补', status: 'blocked' },
  { url: 'https://c.liepin.com/', reason: '内置自动接管隔离；未动现有普通登录标签；完整JD与HR入口待补', status: 'blocked' },
  ...failedReads.map(c => ({ url: c.request.open?.[0]?.ref_id ?? String(c.result).match(/Failed to fetch (https?:\/\/[^\s:]+[^\s]*?)(?:: |: \(|\s)/)?.[1] ?? null,
    reason: '本轮详情读取失败；不判定无岗位或下架；完整原始错误见raw', status: 'failed', company: c.company })),
  { url: 'https://www.zhaopin.com/jobdetail/CC541239720J40514030707.htm', reason: '同批智联先前详情超时，后续未执行；不是空结果', status: 'not_scanned' }
];
const run = {
  schema_version: 1, run_id: 'market-wide-2026-09-22', started_at: all[0]?.started_at, finished_at: all.at(-1)?.observed_at,
  status: counts.company_queries_executed === counts.company_queries_planned && counts.new_company_queries_executed === counts.new_company_queries_planned
    ? 'declared_queries_executed_job_inventory_incomplete' : 'partial_company_search_checkpoint_details_pending',
  scope: '八个行业起点、十类跨市场职能/正文/场景查询，逐一检索底册全部可辨识公司查询词，并回补实际岗位卡片中新发现的雇主显示名。公司检索覆盖不是公司全部岗位覆盖，更不是全市场穷尽。',
  counts, request_count: { web_tool_actual_calls: timing.calls, admission_timing_status: timing.status },
  queries: index.captures.map(c => ({ query: c.query, status: 'searched_not_exhaustive', evidence_file: c.capture_file })),
  queued_urls: queue, detail_backlog: '01_行情收集/official-careers/research/market-wide-2026-09-22/detail-backlog.json',
  source_frontier: '01_行情收集/official-careers/research/market-wide-2026-09-22/source-candidates.json',
  new_company_frontier: '01_行情收集/official-careers/research/market-wide-2026-09-22/next-company-queue.json',
  source_results: extraction.files ?? [],
  new_company_queries: backfillRows,
  industry_and_keyword_coverage: routeRows,
  source_explorer: '01_行情收集/official-careers/research/market-wide-2026-09-22/search-explorer.html',
  market_scan_complete: false, company_wide_scan_complete: false, login_repaired: false,
  salary_note: '保留原文；未披露、年包、外币与固定底薪未知分开，不推算补齐。',
  external_applications: 0, scheduler_enabled: false
};
// Exact display-name comparison only; this queue is not legal-entity resolution.
const nameKey = value => String(value ?? '').normalize('NFKC').trim().toLowerCase();
const plannedNames = new Set([...catalog.companies.flatMap(c => [c.display_name, c.query_name, ...(c.aliases ?? [])]),
  ...wave2.queries.map(q => q.company)].map(nameKey));
const frontier = new Map();
for (const record of [...jobs, ...leads.leads]) {
  if (!record.company || plannedNames.has(nameKey(record.company))) continue;
  const key = nameKey(record.company);
  if (!frontier.has(key)) frontier.set(key, { display_name: record.company, status: 'not_scanned_new_display_name',
    company_identity_verified: false, automatic_access_authorized: false, evidence: [] });
  frontier.get(key).evidence.push({ record_id: record.id ?? record.result_id, title: record.title,
    url: record.job_url ?? record.url ?? record.source_url, observed_at: record.observed_at,
    evidence_file: record.evidence_file ?? record.provenance?.capture_file,
    evidence_sha256: record.evidence_sha256 ?? record.provenance?.capture_sha256,
    company_evidence: record.field_evidence?.company });
}
const nextCompanies = [...frontier.values()].sort((a,b) => a.display_name.localeCompare(b.display_name, 'zh'));
counts.next_company_display_names_pending = nextCompanies.length;
await save('next-company-queue.json', { status: 'pending_not_executed', company_identity_deduplicated: false,
  company_count: nextCompanies.length, companies: nextCompanies,
  note: 'Source-observed employer labels not exactly present in this batch plans. Aliases may refer to existing employers; no legal-company count or automatic access permission is inferred.' });
await save('company-coverage.json', { counts, company_records: companies, new_company_queries: backfillRows, completeness: 'initial_search_only_not_job_inventory', market_total: null });
await save('industry-keyword-coverage.json', { coverage: routeRows,
  scope: 'Versioned query coverage only. Industry categories are research starting points, not a complete market taxonomy.' });
await save('report-run.json', run);
await save('backlog.json', { scope: 'Open frontier; candidates are not admitted or complete JDs', company_queries: queryRows.filter(q => q.status === 'not_scanned'),
  new_company_queries: backfillRows.filter(q => q.status === 'not_scanned'),
  identity_pending: companies.filter(c => c.status === 'identity_pending'), source_candidates: candidates.source_candidates, details, failures: queue });
const headers = ['公司显示名','行业原标签','初扫状态','检索ID','发现URL数','发现URL','公司全量岗位已完成'];
await writeFile(join(dir, 'company-coverage.csv'), '\ufeff' + [headers, ...companies.map(c => [c.company,c.industry_labels_raw.join(' / '),c.status,c.queries.map(q => q.id).join(' / '),c.urls.length,c.urls.join('\n'),'否'])].map(row => row.map(csv).join(',')).join('\r\n'));
const table = companies.map(c => `| ${pipe(c.company)} | ${pipe(c.industry_labels_raw.join(' / ') || '待核')} | ${pipe(c.status)} | ${c.queries.map(q => q.id).join(', ') || '身份待核'} | ${c.urls.length} |`).join('\n');
await writeFile(join(dir, 'summary.md'), `# 2026-09-22 岗位市场扫描检查点\n\n本轮是全底册检索与公开招聘页扩展，不是全市场岗位全集。搜索命中不等于完整JD、在招确认或雇主身份核验。\n\n## 实际结果\n\n- 公司检索：${counts.company_queries_executed}/${counts.company_queries_planned}个不同查询词；覆盖${counts.company_display_records_search_attempted}个目录显示名，另${counts.anonymous_company_records_pending}个匿名名称待核。别名显示数不是独立雇主数。\n- ${counts.searches}次搜索、${counts.page_reads}次页面读取；${counts.failed_page_reads}次页面读取失败。\n- ${counts.search_result_entries}条原始搜索结果，${counts.distinct_discovered_urls}个不同URL，均是待核线索，不是岗位数。\n- ${counts.observations}条结构化岗位观察，其中${counts.complete_jd}条有完整职责与要求，涉及${counts.companies}个雇主显示名。列表和详情的关联证据见提取审计。\n- 原文与时间逐条留存；限速核验：${timing.status}。没有投递、发消息或上传简历。\n\n## 未完成\n\nBOSS/猎聘自动接管仍隔离；动态ATS、详情分页、匿名雇主、部分超时页面及新发现URL仍待续。未披露薪资不等于低于20K，招聘区间不等于固定底薪。尚不满足全市场宽度验收。\n\n## 文件\n\n- 岗位：jobs.json；完整字段与SHA：extraction-audit.json。\n- 查询和全部原始命中：search-index.json；新增来源：source-candidates.json。\n- 公司覆盖：company-coverage.json / company-coverage.csv；完整待续：backlog.json。\n- 请求回执：web-session.jsonl；限速与哈希审计：timing-audit.json。\n\n## 公司覆盖明细\n\n| 公司显示名 | 行业原标签 | 初扫状态 | 检索ID | 发现URL数 |\n| --- | --- | --- | --- | ---: |\n${table}\n`);
await writeFile(join(dir, 'new-company-coverage.csv'), '\ufeff' + [['检索名称','状态','检索ID','发现URL数','发现URL'], ...backfillRows.map(q => [q.company,q.status,q.id,q.urls.length,q.urls.join('\n')])].map(row => row.map(csv).join(',')).join('\r\n'));
const extension = [
  '## 新公司回补与岗位线索', '',
  `- 行业查询${counts.industry_queries_executed}/8组，跨市场职能与正文关键词查询${counts.cross_market_queries_executed}/10组；逐项查询、日期和原文见industry-keyword-coverage.json。`,
  `- 新发现雇主名称：已检索${counts.new_company_queries_executed}/${counts.new_company_queries_planned}组；属于实际执行，不只是入队。`,
  `- 独立于${counts.observations}条页面记录，另保留${counts.separate_search_job_leads}条可绑定岗位名称和雇主的搜索职位线索，尚无完整正文，不能评分。`,
  `- 本批送入主报告${counts.combined_report_records}条记录；不是独立岗位数量，也不是全部已确认在招。`,
  `- 继续发现${nextCompanies.length}个未在本批计划出现的雇主显示名，带原文证据保存于next-company-queue.json，尚未续扫；可能包含同一雇主别名。`,
  '- 华天软件仅取得招聘第2页；环信仅取得首段且尾段超时；第四范式仅取得招聘入口。上述范围未扫全，不据此标记零岗位。',
  '- 检索全览：search-explorer.html；全部搜索原文：search-results.csv；页面记录与索引线索组合：report-jobs.json。', ''
].join('\n');
const summary = await readFile(join(dir,'summary.md'),'utf8');
await writeFile(join(dir,'summary.md'), summary.replace('## 未完成', extension + '\n## 未完成'));
console.log(JSON.stringify(counts));
