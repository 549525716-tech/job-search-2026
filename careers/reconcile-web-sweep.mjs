import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, join, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { ROOT, DATA_DIR, repoRelative } from './paths.mjs';
import { auditWebSession } from './audit-web-session.mjs';
import { classifyBrowserCapture } from './browser-admission.mjs';

const directory = resolve(ROOT, process.argv[2] ?? '');
if (!directory.startsWith(resolve(DATA_DIR, 'research') + sep)) throw new Error('RESEARCH_CHILD_DIRECTORY_REQUIRED');
const load = async (name) => JSON.parse(await readFile(join(directory, name), 'utf8'));
const jobs = await load('jobs.json'), scope = await load('scope.json');
const ledger = (await readFile(join(directory, 'web-session.jsonl'), 'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse);
const admitted = new Map(ledger.filter((item) => item.event === 'begin').map((item) => [item.id, item]));
const finished = new Map(ledger.filter((item) => item.event === 'finish').map((item) => [item.id, item]));
// Display aliases only; vacancy and recruiter identities remain untouched.
const aliases = new Map([
  ['探迹', '探迹科技'], ['ADXJ蓝鲸出海', 'ADXJ 蓝鲸出海'],
  ['北京掌上先机网络科技有限公司', '慧策/掌上先机'],
  ['慧策|旺店通(掌上先机)', '慧策/掌上先机'],
]);
const companyName = (name) => aliases.get(name) ?? name;
const companies = new Map(), captures = [];
const companyRow = (name) => {
  const key = companyName(name);
  if (!companies.has(key)) companies.set(key, { company: key, entity_kind: 'company', attempted: false, queries: [], urls: [], evidence_files: [], source_outcomes: [], route: [], jobs: [] });
  return companies.get(key);
};
const bodyText = (raw) => typeof raw.result === 'string' ? raw.result : JSON.stringify(raw.result) ?? '';
const unsuccessful = new Set(['blank_page', 'diagnostic_only', 'access_stopped', 'technical_failure', 'interrupted',
  'no_visible_text', 'unverified_capture', 'unverified_legacy_capture', 'visible_page_auth_unverified']);
const captureStatus = (raw, receipt, text) => {
  if (!receipt) return 'unreceipted_capture';
  if (unsuccessful.has(receipt.outcome)) return receipt.outcome === 'access_stopped' ? 'access_stop' : receipt.outcome;
  if (raw.kind === 'browser_visible_page_capture') {
    const outcome = classifyBrowserCapture(raw);
    return outcome === 'authenticated_page_capture' ? 'page_read' : outcome === 'access_stopped' ? 'access_stop' : outcome;
  }
  const result = raw.result;
  if (result && typeof result === 'object') {
    if (result.access_stop === true || [401, 403, 429].includes(result.status)) return 'access_stop';
    if (/interrupt|abort|cancel/i.test(result.status ?? '')) return 'interrupted';
    if (result.error || result.isError === true || result.ok === false || /error|fail/i.test(result.status ?? '')) return 'technical_failure';
  }
  if (/\b(?:401|403|429)\b|captcha|access denied|forbidden|too many requests/i.test(text.slice(0, 3000))) return 'access_stop';
  if (/Failed to fetch|Internal Error|non-retryable error/i.test(text.slice(0, 2000))) return 'technical_failure';
  if (!text.trim() || text === 'null' || text === '{}') return 'no_visible_text';
  return raw.operation === 'search' ? 'search_result' : ['open', 'click'].includes(raw.operation) ? 'page_read' : 'unverified_capture';
};
for (const name of (await readdir(join(directory, 'raw'))).filter((name) => name.endsWith('.json')).sort()) {
  const path = join(directory, 'raw', name), bytes = await readFile(path), raw = JSON.parse(bytes);
  const id = name.slice(0, -5), entry = admitted.get(id), receipt = finished.get(id), text = bodyText(raw);
  const urls = [...text.matchAll(/^.*?\((https:\/\/[^\s)]+)\)/gm)].map((match) => match[1]);
  const row = { id, operation: raw.operation, route: raw.route, company: entry?.company ?? null,
    request: raw.request, observed_at: raw.observed_at, started_at: raw.started_at,
    evidence_file: repoRelative(path), evidence_sha256: createHash('sha256').update(bytes).digest('hex'),
    queue_receipt_complete: Boolean(receipt), status: captureStatus(raw, receipt, text), urls };
  captures.push(row);
  if (entry?.company) {
    const company = companyRow(entry.company);
    company.attempted = true;
    company.queries.push(...(raw.request.search_query ?? []).map((q) => q.q));
    company.urls.push(...urls);
    company.evidence_files.push(row.evidence_file);
    company.source_outcomes.push({ evidence_file: row.evidence_file, status: row.status, operation: raw.operation, request: raw.request });
    company.route.push(raw.route);
  }
}
for (const job of jobs) {
  const row = companyRow(job.company);
  row.jobs.push(job);
  row.evidence_files.push(job.evidence_file);
  row.urls.push(job.source_url);
  row.route.push(job.route);
}
const seeds = scope.route_A?.companies ?? scope.route_A_seeds ?? scope.route_a_seeds ?? scope.company_seeds ?? [];
for (const seed of seeds) companyRow(typeof seed === 'string' ? seed : seed.name);
const coverage = [...companies.values()].map(({ jobs: observations, ...row }) => {
  const full = observations.filter((job) => job.description_complete).length;
  const leads = observations.filter((job) => job.source_kind === 'search_index').length;
  const stopped = row.source_outcomes.some((outcome) => outcome.status === 'access_stop');
  const failure = row.source_outcomes.some((outcome) => !['page_read', 'search_result', 'access_stop'].includes(outcome.status));
  const unique = (values) => [...new Set(values.filter(Boolean))];
  const status = full ? 'captured_filtered' : leads ? 'search_index_only' : stopped ? 'access_stop' : failure ? 'technical_failure' : row.attempted ? 'controller_search_only' : 'unscanned';
  return { ...row, status, full_jd_count: full, search_index_count: leads, job_count: observations.length, formal_job_count: observations.length,
    queries: unique(row.queries), urls: unique(row.urls), evidence_files: unique(row.evidence_files), route: unique(row.route),
    source_scope_complete: false, current_hiring_verified: false,
    reason: `${full ? `取得${full}条完整职责及要求。` : ''}${leads ? `保留${leads}条索引线索，尚未核验原站及薪资构成。` : ''}${stopped ? '部分来源访问受限，已停止，不据此推断岗位关闭。' : ''}${failure ? '部分详情读取失败，未当作无岗位。' : ''}${!row.attempted ? '未执行这家公司的专门检索/详情访问。' : '已执行有原始请求记录的检索或页面访问。'}未完成全公司招聘分页，不代表当前仍在招。` };
});
for (const [company, reason] of [['BOSS直聘、猎聘', '既有平台暂停，本轮只可能从外部搜索看到索引，未访问平台或解除限制。'],
  ['MiniMax、月之暗面、智谱、第四范式', '既有隔离或停源保持；未通过新账号、同租户其他地址或其他工具绕过。']]) {
  coverage.push({ company, entity_kind: 'paused_source_group', attempted: false, status: 'known_restricted_source_not_retried', job_count: 0, reason, queries: [], urls: [], evidence_files: [] });
}
const audit = await auditWebSession(directory);
const times = captures.map((call) => Date.parse(call.observed_at)).filter(Number.isFinite);
const run = { schema_version: 1, run_id: 'sweep-2026-09-13', status: 'bounded_first_edition_collected',
  started_at: captures.map((call) => call.started_at).filter(Boolean).sort()[0], observed_at: new Date(Math.max(...times)).toISOString(),
  reconciled_at: new Date().toISOString(), model: 'gpt-5.6-luna', effort: 'medium',
  execution: { agent_id: '01a09714-b7ae-77c2-8041-4c1ba9cdf571', model: 'gpt-5.6-luna', reasoning_effort: 'medium', evidence: 'controller accepted explicit spawn parameters; no independent billing measurement' },
  this_agent_web_calls: captures.length, controller_pm_web_calls: 0, tool_calls: captures.length,
  ledger_finish_count: finished.size, searches: captures.filter((call) => call.operation === 'search').length,
  page_read_attempts: captures.filter((call) => ['open', 'click', 'read'].includes(call.operation)).length,
  page_reads: captures.filter((call) => call.status === 'page_read').length,
  failed_or_unverified_captures: captures.filter((call) => !['page_read', 'search_result'].includes(call.status)).length,
  actual_companies_attempted: coverage.filter((row) => row.attempted && row.entity_kind === 'company').length,
  companies_with_full_jd: coverage.filter((row) => row.full_jd_count > 0).length,
  company_count_rule: 'Named-employer search/open requests with existing raw capture; platform names and unvisited employer leads excluded',
  timing_audit_note: audit.issues.length ? `调用记录审计未全通过：${audit.issues.join('；')}。有回执调用的最小冷却${audit.minimum_cooldown_ms}ms；未补造断档日志。` : `已记录调用SHA与串行时间通过审计，最小冷却${audit.minimum_cooldown_ms}ms。`,
  exhaustive_market_scan: false, applications_sent: 0, messages_sent: 0, resume_uploads: 0, scheduled: false,
  observations: jobs.length, raw_capture_inventory: repoRelative(join(directory, 'capture-inventory.json')), actual_token_usage: null };
for (const [name, value] of Object.entries({ 'coverage.json': coverage, 'run.json': run, 'timing-audit.json': audit, 'capture-inventory.json': captures })) {
  await writeFile(join(directory, name), JSON.stringify(value, null, 2) + '\n');
}
console.log(JSON.stringify({ calls: captures.length, companies_attempted: run.actual_companies_attempted, companies_with_full_jd: run.companies_with_full_jd, observations: jobs.length, timing_status: audit.status }));
