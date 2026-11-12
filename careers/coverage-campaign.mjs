import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPORT_DIR, ROOT } from './paths.mjs';

export const COVERAGE_CHANNELS = ['official', 'boss', 'liepin', 'other_platform', 'announcement', 'open_web'];
const array = (v) => Array.isArray(v) ? v : v == null ? [] : [v];
const text = (v) => String(v ?? '').normalize('NFKC').trim();
const key = (v) => text(v).toLowerCase().replace(/\s+/g, ' ');
const hash = (v) => createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex');
const unique = (v) => [...new Set(v.filter((x) => x != null && x !== ''))];
const nameOf = (r) => typeof r === 'string' ? r : typeof r.company === 'object' ? r.company?.name ?? r.company?.company_name :
  r.company ?? r.company_name ?? r.employer ?? r.hiringOrganization?.name ?? r.display_name ?? r.name;
const blocked = (r) => /halt|blocked|denied|access_stop|restricted|login_required|quarantin|paused/.test(key(r.status));
const failed = (r) => /fail|error|timeout|unavailable/.test(key(r.status));
const indexed = (r) => [r.source_kind, r.status, r.operation].some((v) => /search|index/.test(key(v))) || Boolean(r.request?.search_query);
const directoryOnly = (r) => /directory|industry_research|company_discovery/.test(key(r.source_kind) + ' ' + key(r.source_purpose)) || r.entity_kind === 'industry';
const urlHost = (v) => { try { return new URL(v).hostname; } catch { return ''; } };
const httpURL = (v) => typeof v === 'string' && /^https?:\/\//.test(v);
const requestURLs = (r) => unique([...array(r.request?.open), ...array(r.request?.click)].map((x) => x.ref_id).filter(httpURL));
const rawURLs = (r) => unique([...array(r.urls), r.url, r.source_url, r.job_url, r.board_url, r.discovery_url, ...requestURLs(r)]);

function channelFor(r, urls = [], channels = COVERAGE_CHANNELS) {
  const hosts = urls.map(urlHost);
  if (hosts.some((h) => /(^|\.)zhipin\.com$/.test(h))) return 'boss';
  if (hosts.some((h) => /(^|\.)liepin\.com$/.test(h))) return 'liepin';
  const supplied = key(r.channel ?? r.channel_family ?? r.platform ?? r.source_kind);
  if (channels.includes(supplied)) return supplied;
  if (/^(boss|boss直聘|zhipin)$/.test(supplied)) return 'boss';
  if (/^(liepin|猎聘)$/.test(supplied)) return 'liepin';
  if (/announcement|公告/.test(supplied)) return 'announcement';
  if (/official|ats|官网/.test(supplied)) return 'official';
  if (/platform|board|portal/.test(supplied) || hosts.some((h) => /(^|\.)(zhaopin\.com|linkedin\.com|bebee\.com)$/.test(h))) return 'other_platform';
  return 'open_web';
}

function blankCell(company, channel) {
  return { company_id: company.id, display_name: company.display_name, channel, status: 'pending', attempted: false,
    scope_complete: false, channel_exhausted: false, result: 'unknown', evidence: [], source_scope_ids: [], raw_urls: [],
    actual_queries: [], source_kinds: [], next_action: '核验渠道入口并取得访问证据', last_observed: null };
}

/** Display grouping never changes raw jobs, HR identities or legal-employer identity. */
export function buildCoverageCampaign({ snapshots = [], companyDiscoveries = [], channelDefinitions = [], companies = [] } = {}) {
  const channels = unique([...COVERAGE_CHANNELS, ...array(channelDefinitions).map((v) => key(typeof v === 'string' ? v : v.id))]);
  const targets = new Map(); const cells = new Map(); const scopes = new Map();
  const observations = []; const seenObservations = new Set(); const restrictions = []; const bindingConflicts = [];
  const inputs = [...new Map(snapshots.map((s) => [hash(s), s])).values()];
  function company(name, catalog = false) {
    if (!text(name)) return null;
    const id = `display:${hash(key(name)).slice(0, 20)}`;
    if (!targets.has(id)) {
      const target = { id, display_name: text(name), target_kind: 'candidate_employer_record', legal_entity_status: 'unknown',
        company_entity_unknown: true, source_raw_ids: [], observation_ids: [], snapshot_ids: [] };
      targets.set(id, target);
      for (const channel of channels) cells.set(`${id}:${channel}`, blankCell(target, channel));
    }
    const target = targets.get(id);
    if (catalog) target.target_kind = 'catalog_target';
    return target;
  }
  function ingest(r, snapshotId, kind, boundName = nameOf(r), source = null, evidenceAvailable = true) {
    const target = company(boundName);
    const observationId = hash([snapshotId, kind, source, r]);
    if (seenObservations.has(observationId)) return;
    seenObservations.add(observationId);
    const allURLs = rawURLs(r);
    const exactURLs = kind === 'job' ? unique([r.job_url, r.source_url, r.board_url]) : requestURLs(r);
    const discovery = kind === 'discovery' || kind === 'coverage_summary' || directoryOnly(r);
    const channel = discovery ? 'open_web' : channelFor(r, exactURLs, channels);
    const declaredChannel = r.channel ?? r.channel_family ?? r.platform ?? r.source_kind ?? null;
    const hasReceipt = evidenceAvailable && r.evidence_available !== false && Boolean(r.evidence_file || r.metadata_path);
    const hasRequest = Boolean(requestURLs(r).length || r.request?.search_query?.length);
    const visited = !discovery && !indexed(r) && !blocked(r) && hasReceipt &&
      (kind === 'job' || (hasRequest && /open|click|fetch|request/.test(key(r.operation))));
    const searchAttempt = !discovery && indexed(r) && kind !== 'job' && hasReceipt && Boolean(r.request?.search_query?.length);
    const observed = r.observed_at ?? r.last_observed ?? null;
    const item = { id: observationId, company_id: target?.id ?? null, snapshot_id: snapshotId, kind, source_kind: r.source_kind ?? null,
      channel, declared_channel: declaredChannel,
      channel_definition_status: declaredChannel && channel === 'open_web' && key(declaredChannel) !== 'open_web' ? 'unrecognized_or_discovery_only' : 'resolved',
      raw_id: r.id ?? r.raw_id ?? r.job_key ?? null, evidence_file: r.evidence_file ?? r.metadata_path ?? null,
      evidence_sha256: r.evidence_sha256 ?? null, raw_urls: allURLs, request: r.request ?? null,
      actual_queries: unique(array(r.request?.search_query).map((q) => q.q)), last_observed: observed,
      attempted: Boolean(target && (visited || searchAttempt)), raw: structuredClone(r) };
    observations.push(item);
    if (!target) return;
    target.source_raw_ids = unique([...target.source_raw_ids, item.raw_id]);
    target.observation_ids.push(item.id); target.snapshot_ids = unique([...target.snapshot_ids, snapshotId]);
    target.industries = unique([...(target.industries ?? []), ...array(r.industry)]);
    target.industry = target.industries.join('、') || null;
    // Searches are open-web attempts; indexed platform links remain discovery-only platform evidence.
    const destination = searchAttempt ? 'open_web' : channel;
    const cell = cells.get(`${target.id}:${destination}`);
    cell.evidence.push(item.id); cell.raw_urls = unique([...cell.raw_urls, ...allURLs]);
    cell.actual_queries = unique([...cell.actual_queries, ...item.actual_queries]);
    cell.source_kinds = unique([...cell.source_kinds, r.source_kind ?? 'unknown']);
    if (observed && (!cell.last_observed || observed > cell.last_observed)) cell.last_observed = observed;
    cell.attempted ||= item.attempted;
    if (!discovery && blocked(r)) cell.status = 'blocked';
    else if (cell.status !== 'blocked' && item.attempted) cell.status = failed(r) ? 'failed' : 'attempted';
    if (r.source_id && r.scope_id && !discovery && !indexed(r)) {
      const scopeKey = hash([target.id, destination, snapshotId, r.source_id, r.scope_id]);
      if (!scopes.has(scopeKey)) scopes.set(scopeKey, { id: scopeKey, company_id: target.id, channel: destination, snapshot_id: snapshotId,
        source_id: r.source_id, scope_id: r.scope_id, status: 'pending', scope_complete: false, result: 'unknown', evidence: [], proofs: [] });
      const scope = scopes.get(scopeKey); scope.evidence.push(item.id);
      const p = r.proof ?? r;
      // Both proof flags must be on ONE dated receipt. Never combine partial proof across captures.
      const valid = visited && !failed(r) && observed && p.native_pagination_complete === true && p.detail_completion_complete === true;
      scope.proofs.push({ observation_id: item.id, observed_at: observed, native_pagination_complete: p.native_pagination_complete === true,
        detail_completion_complete: p.detail_completion_complete === true, valid: Boolean(valid), job_count: r.job_count ?? null });
      if (blocked(r)) scope.status = 'blocked';
      else if (scope.status !== 'blocked' && failed(r)) scope.status = 'failed';
      cell.source_scope_ids = unique([...cell.source_scope_ids, scopeKey]);
    }
  }
  for (const snapshot of inputs) {
    const snapshotId = snapshot.id ?? snapshot.run?.run_id ?? hash(snapshot);
    const aliases = new Map();
    const groups = snapshot.scope?.industry_groups;
    const groupRows = Array.isArray(groups) ? groups : groups && typeof groups === 'object' ? Object.values(groups) : [];
    const seeds = [...array(snapshot.scope?.route_A_seeds), ...array(snapshot.scope?.companies), ...array(snapshot.companies),
      ...groupRows.flatMap((g) => [...array(g.companies), ...array(g.company_seeds), ...array(g.route_A_seeds)])];
    for (const seed of seeds) {
      const name = nameOf(seed); company(name, true);
      aliases.set(key(name), name);
      for (const alias of array(seed.aliases)) aliases.set(key(alias), name);
    }
    const coverage = array(snapshot.coverage);
    for (const row of coverage) for (const alias of array(row.aliases)) {
      if (!aliases.has(key(alias))) aliases.set(key(alias), aliases.get(key(nameOf(row))) ?? nameOf(row));
    }
    const canonical = (name) => name ? aliases.get(key(name)) ?? name : null;
    function bindCapture(actual, parent) {
      const original = nameOf(actual);
      const bound = canonical(original);
      if (parent && bound && key(canonical(parent)) !== key(bound)) {
        const conflict = { snapshot_id: snapshotId, evidence_file: actual.evidence_file ?? null,
          parent_company: parent, raw_company: original, bound_company: bound, status: 'pending_identity_review' };
        if (!bindingConflicts.some((c) => hash(c) === hash(conflict))) bindingConflicts.push(conflict);
      }
      return bound;
    }
    for (const row of coverage) {
      if (row.entity_kind === 'paused_source_group') { restrictions.push({ snapshot_id: snapshotId, raw: row }); continue; }
      const name = aliases.get(key(nameOf(row))) ?? nameOf(row);
      // Legacy snapshots without a scope still retain every declared company in coverage.
      company(name, !seeds.length);
      ingest(row, snapshotId, 'coverage_summary', name);
      for (const outcome of array(row.source_outcomes)) {
        const capture = array(snapshot.captures).find((r) => r.evidence_file === outcome.evidence_file);
        const actual = capture ?? outcome;
        const bound = bindCapture(actual, name);
        ingest(actual, snapshotId, 'capture', bound, outcome.evidence_file);
      }
    }
    for (const capture of array(snapshot.captures)) {
      // A generic raw request has no company binding even if several coverage summaries reference it.
      const linked = coverage.filter((r) => r.entity_kind !== 'paused_source_group' &&
        (array(r.evidence_files).includes(capture.evidence_file) || array(r.source_outcomes).some((o) => o.evidence_file === capture.evidence_file)));
      for (const row of linked) bindCapture(capture, nameOf(row));
      const name = bindCapture(capture);
      ingest(capture, snapshotId, 'capture', name, capture.evidence_file);
    }
    for (const job of array(snapshot.jobs)) {
      const receiptAvailable = !snapshot.captures || snapshot.captures.some((c) => c.evidence_file === job.evidence_file && c.evidence_available !== false);
      ingest(job, snapshotId, 'job', aliases.get(key(nameOf(job))) ?? nameOf(job), null, receiptAvailable);
    }
    for (const record of array(snapshot.discoveries)) ingest(record, snapshotId, 'discovery');
    for (const restriction of [...array(snapshot.scope?.source_restrictions_preserved), ...array(snapshot.run?.stopped_sources)]) {
      restrictions.push({ snapshot_id: snapshotId, raw: restriction });
    }
  }
  for (const record of [...array(companyDiscoveries), ...array(companies)]) ingest(record, record.snapshot_id ?? 'external', 'discovery');
  // Historical restrictions are sticky. This accounting layer has no resume or halt-clearing operation.
  for (const restriction of restrictions) {
    const label = typeof restriction.raw === 'string' ? restriction.raw : nameOf(restriction.raw);
    for (const cell of cells.values()) {
      const globalStop = (cell.channel === 'boss' && /boss|zhipin|直聘/i.test(label)) || (cell.channel === 'liepin' && /liepin|猎聘/i.test(label));
      const companyStop = cell.channel === 'official' && key(label).includes(key(cell.display_name));
      if (globalStop || companyStop) { cell.status = 'blocked'; cell.halt_evidence = [...(cell.halt_evidence ?? []), restriction]; }
    }
  }
  for (const scope of scopes.values()) {
    const cell = cells.get(`${scope.company_id}:${scope.channel}`);
    if (cell.status === 'blocked') scope.status = 'blocked';
    if (!['blocked', 'failed'].includes(scope.status)) {
      const valid = scope.proofs.filter((p) => p.valid).sort((a, b) => String(a.observed_at).localeCompare(String(b.observed_at))).at(-1);
      if (valid) { scope.scope_complete = true; scope.status = 'complete'; scope.result = valid.job_count === 0 ? 'zero_with_proof' : 'observed'; }
      else scope.status = 'pending_proof';
    }
  }
  for (const cell of cells.values()) {
    cell.completed_source_scopes = cell.source_scope_ids.filter((id) => scopes.get(id).scope_complete).length;
    cell.next_action = cell.status === 'blocked' ? '保留暂停，等待人工核验与恢复授权' : cell.status === 'failed' ? '核查失败证据；岗位总量未知' :
      cell.status === 'attempted' ? '补齐各入口的原生分页与详情证明，继续发现其他入口' : '核验渠道入口并取得访问证据';
  }
  const ledger = [...cells.values()]; const sourceScopes = [...scopes.values()];
  return { schema_version: 'coverage-campaign/v2', generated_from: 'offline_inputs_only', channels, companies: [...targets.values()],
    ledger, source_scopes: sourceScopes, observations, restrictions, binding_conflicts: bindingConflicts,
    input_snapshots: inputs.map((s) => ({ id: s.id ?? s.run?.run_id ?? hash(s), files: s.input_files ?? [], missing_files: s.missing_files ?? [] })),
    summary: { catalog_targets: [...targets.values()].filter((t) => t.target_kind === 'catalog_target').length,
      candidate_employer_records: observations.filter((o) => o.company_id && ['job', 'discovery'].includes(o.kind)).length,
      distinct_display_names: targets.size, company_entity_unknown: true, verified_company_entities: null,
      sources_pending: ledger.filter((c) => !c.attempted && c.status !== 'blocked').length,
      attempted: ledger.filter((c) => c.attempted).length, blocked: ledger.filter((c) => c.status === 'blocked').length,
      scope_complete: sourceScopes.filter((s) => s.scope_complete).length, unknown_market_total: null, market_complete: false,
      channel_count: channels.length, total_cells: ledger.length } };
}

const channelNames = { official: '官网及ATS', boss: 'BOSS', liepin: '猎聘', other_platform: '其他招聘平台', announcement: '招聘公告', open_web: '开放发现' };
const statusNames = { pending: '待核验', attempted: '已有访问证据', failed: '访问失败', blocked: '暂停' };
const md = (v) => String(v ?? '').replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');
export function coverageMarkdown(campaign) {
  const s = campaign.summary;
  return ['# 累计覆盖清单', '', `目录目标 ${s.catalog_targets}；不同展示名 ${s.distinct_display_names}；候选雇主原始记录 ${s.candidate_employer_records}。`,
    `渠道访问单元 ${s.attempted}；待核验 ${s.sources_pending}；暂停 ${s.blocked}；已完成明确源范围 ${s.scope_complete}。`,
    '公司法律主体数量未知；全市场总量未知；市场及渠道均未声明穷尽。历史观察时间保持原值。', '',
    '| 公司展示名 | 渠道 | 状态 | 源范围完成数 | 最近观察 | 下一步 |', '| --- | --- | --- | --- | --- | --- |',
    ...campaign.ledger.map((c) => `| ${md(c.display_name)} | ${md(channelNames[c.channel] ?? c.channel)} | ${statusNames[c.status]} | ${c.completed_source_scopes} | ${md(c.last_observed ?? '未知')} | ${c.next_action} |`), ''].join('\n');
}

export function mergeCoverageCapture(raw, inventory = {}, evidenceFile = null) {
  const explicitCompany = raw && ['company', 'company_name', 'employer', 'hiringOrganization'].some((field) => Object.hasOwn(raw, field));
  const companyName = raw ? explicitCompany ? nameOf(raw) ?? null : nameOf(inventory) ?? null : null;
  return { ...inventory, ...(raw ?? {}), company: companyName, company_binding_origin: explicitCompany ? 'raw' : raw && companyName ? 'capture_inventory' : 'unbound',
    evidence_file: evidenceFile ?? raw?.evidence_file ?? inventory.evidence_file ?? null, evidence_available: Boolean(raw) };
}

export async function readCoverageSnapshot(directory) {
  const root = await realpath(directory); const inputFiles = []; const missingFiles = [];
  async function read(name, optional = false) {
    const path = join(root, name);
    try { const bytes = await readFile(path); inputFiles.push({ path, sha256: hash(bytes.toString()) }); return JSON.parse(bytes); }
    catch (error) { if (optional && error.code === 'ENOENT') { missingFiles.push(path); return null; } throw error; }
  }
  const scope = await read('scope.json', true); const coverage = await read('coverage.json'); const jobs = await read('jobs.json');
  const run = await read('run.json', true); const inventory = await read('capture-inventory.json', true) ?? [];
  const discoveries = await read('discoveries.json', true) ?? [];
  const paths = unique([...coverage.flatMap((r) => [...array(r.evidence_files), ...array(r.source_outcomes).map((o) => o.evidence_file)]),
    ...jobs.map((j) => j.evidence_file), ...inventory.map((r) => r.evidence_file)]);
  const captures = [];
  for (const path of paths) {
    const absolute = path.startsWith('raw/') ? resolve(root, path) : resolve(ROOT, path);
    if (!inside(root, absolute)) throw new Error('Capture path escapes research snapshot');
    const loaded = await read(relative(root, absolute), true);
    const meta = inventory.find((r) => r.evidence_file === path) ?? {};
    captures.push(mergeCoverageCapture(loaded, meta, path));
  }
  return { id: run?.run_id ?? basename(root), directory: root, scope, coverage, jobs, run, captures, discoveries,
    input_files: inputFiles, missing_files: missingFiles };
}

function inside(root, path) { const r = relative(root, path); return r !== '' && r !== '..' && !r.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) && !isAbsolute(r); }
async function physical(path) {
  try { return await realpath(path); } catch (e) { if (e.code !== 'ENOENT') throw e; return join(await physical(dirname(path)), basename(path)); }
}
export async function validateCoverageOutput(output, inputPaths = []) {
  const jsonPath = resolve(output ?? join(REPORT_DIR, 'coverage-campaign.json'));
  if (!/\.json$/i.test(jsonPath) || !inside(REPORT_DIR, jsonPath)) throw new Error('Output must be a JSON file under reports');
  const markdownPath = jsonPath.replace(/\.json$/i, '.md'); const reportRoot = await physical(REPORT_DIR);
  for (const path of [jsonPath, markdownPath]) {
    const actual = await physical(path);
    if (!inside(reportRoot, actual)) throw new Error('Output escapes reports through symlink');
    try { const info = await lstat(path); if (info.isSymbolicLink() || info.nlink > 1 || !info.isFile()) throw new Error('Unsafe output link or non-file'); }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
    for (const input of inputPaths) {
      const protectedPath = await physical(resolve(input));
      if (actual === protectedPath || inside(protectedPath, actual)) throw new Error('Output would overwrite input');
    }
  }
  return { json_path: jsonPath, markdown_path: markdownPath };
}

export async function main(argv = process.argv.slice(2)) {
  const inputs = []; let output; let companiesPath;
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (!['--input', '--output', '--companies'].includes(flag)) throw new Error(`Unknown argument: ${flag}`);
    const value = argv[++i]; if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`);
    if (flag === '--input') inputs.push(value); else if (flag === '--output') output = value; else companiesPath = value;
  }
  if (!inputs.length) throw new Error('At least one --input is required');
  const paths = await validateCoverageOutput(output, [...inputs, ...array(companiesPath)]);
  const directories = unique(await Promise.all(inputs.map((p) => realpath(p))));
  const snapshots = []; for (const directory of directories) snapshots.push(await readCoverageSnapshot(directory));
  const extra = companiesPath ? JSON.parse(await readFile(companiesPath, 'utf8')) : [];
  const companyDiscoveries = Array.isArray(extra) ? extra : [...array(extra.companies), ...array(extra.discoveries), ...array(extra.jobs), ...array(extra.results)];
  const channelDefinitions = Array.isArray(extra) ? [] : array(extra.channels);
  const campaign = buildCoverageCampaign({ snapshots, companyDiscoveries, channelDefinitions });
  await mkdir(dirname(paths.json_path), { recursive: true });
  await writeFile(paths.json_path, JSON.stringify(campaign, null, 2) + '\n');
  await writeFile(paths.markdown_path, coverageMarkdown(campaign));
  return { ...paths, summary: campaign.summary };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((r) => console.log(JSON.stringify(r))).catch((e) => { console.error(e.message); process.exitCode = 1; });
}
