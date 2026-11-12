import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const rawDir = resolve(here, 'raw');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const clean = value => String(value ?? '').trim();
const isUrl = value => /^https?:\/\//i.test(value);
const rel = file => relative(root, file);

// Keep the existing project segmentation contract: each search result block is
// separated by a run of at least 20 hyphens.
function splitBlocks(result) {
  return result.split(/-{20,}/).map((text, index) => ({ index, text })).filter(block => clean(block.text));
}

function parseHeading(block) {
  const prefix = block.text.split('cite', 1)[0].trim();
  const headingRaw = prefix.split(/\r?\n/, 1)[0] ?? '';
  const withoutCitation = prefix.trim();
  const match = withoutCitation.match(/^(.*?)\s*\((https?:\/\/[^)]+)\)\s*$/);
  if (!match) return { heading_raw: headingRaw, title_raw: withoutCitation, url: null };
  return { heading_raw: headingRaw, title_raw: match[1].trim(), url: match[2] };
}

function sourceKind(url, title, block) {
  if (!url) return 'unknown';
  const path = new URL(url).pathname.toLowerCase();
  const text = `${title}\n${block}`;
  if (/jobdetail|job-info-detail|\/position[/?]|\/jobs?\/[^/]+|\/job_[^/]+|\/job\//i.test(path)) return 'job';
  if (/招聘|加入我们|人才|career|careers|recruit|社会招聘|校招|职位/i.test(text) || /\/jobs?\/?$|\/careers?\/?$/i.test(path)) return 'entry';
  return 'unknown';
}

function isolationFor(url) {
  if (!url) return { status: 'unknown', reason: '无可解析URL' };
  const host = new URL(url).hostname.toLowerCase();
  if (/\bzhipin\.com$|\bliepin\.com$/.test(host)) return { status: 'isolated_pending', reason: 'BOSS/猎聘隔离，仅待补，不访问' };
  if (/minimax\.cn$/.test(host)) return { status: 'isolated_pending', reason: 'MiniMax隔离，仅待补，不访问' };
  if (/linkedin\.com$/.test(host)) return {
    status: 'halted_pending_admission',
    reason: '历史429后已停源；不解除halt，不访问，等待单独准入',
    source_halt_evidence: [
      '01_行情收集/official-careers/research/sweep-2026-09-13/source-review.md',
      '01_行情收集/official-careers/research/sweep-2026-09-13/collection-notes.md',
      '01_行情收集/official-careers/research/sweep-2026-09-13/capture-inventory.json'
    ]
  };
  return { status: 'admission_required', reason: '未确认本轮来源准入；仅登记候选，不可直接读取' };
}

function originHint(url) {
  if (!url) return 'unknown';
  const host = new URL(url).hostname.toLowerCase();
  if (/zhaopin|51job|job5156|nowcoder|michaelpage|haolietou|liepin|zhipin|yingjiesheng|jobcareer|career\.hebut|innohere|zeeklog|wikipedia|dfcfw|cninfo|szse|10jqka/.test(host)) return 'third_party_candidate';
  return 'official_candidate_or_unknown';
}

async function build() {
  const files = (await readdir(rawDir)).filter(file => file.endsWith('.json')).sort();
  const captures = [];
  const results = [];
  const skipped = [];
  for (const file of files) {
    const absolute = resolve(rawDir, file);
    const bytes = await readFile(absolute);
    const data = JSON.parse(bytes);
    if (data.operation !== 'search') { skipped.push({ file: rel(absolute), reason: 'operation_not_search' }); continue; }
    const result = typeof data.capture?.result === 'string' ? data.capture.result : data.result;
    if (typeof result !== 'string') { skipped.push({ file: rel(absolute), reason: 'completed_result_string_missing' }); continue; }
    const captureId = file.replace(/\.json$/, '');
    const captureSha = hash(bytes);
    const capture = {
      capture_id: captureId,
      capture_file: rel(absolute),
      capture_sha256: captureSha,
      result_sha256: hash(result),
      operation: data.operation,
      route: data.route ?? null,
      target_company: data.company ?? null,
      query: data.request?.search_query?.[0]?.q ?? null,
      response_length: data.request?.response_length ?? null,
      started_at: data.started_at ?? null,
      observed_at: data.observed_at ?? null,
      result_chars: result.length,
      segment_rule: '/-{20,}/',
      segment_count: 0,
    };
    const blocks = splitBlocks(result);
    capture.segment_count = blocks.length;
    captures.push(capture);
    for (const block of blocks) {
      const heading = parseHeading(block);
      const lines = block.text.split(/\r?\n/);
      results.push({
        result_id: `${captureId}-r${String(block.index + 1).padStart(3, '0')}`,
        capture_id: captureId,
        capture_file: capture.capture_file,
        capture_sha256: captureSha,
        result_sha256: hash(block.text),
        query: capture.query,
        target_company: capture.target_company,
        route: capture.route,
        started_at: capture.started_at,
        observed_at: capture.observed_at,
        segment_index: block.index,
        heading_raw: heading.heading_raw,
        title_raw: heading.title_raw,
        url: heading.url,
        summary_raw: block.text,
        employer: null,
        employer_status: 'unknown_not_inferred',
        url_status: heading.url ? 'parsed_from_result_heading' : 'unknown_no_result_url',
        source_kind: sourceKind(heading.url, heading.title_raw, block.text),
        source_origin_hint: originHint(heading.url),
        isolation: isolationFor(heading.url),
        employer_binding: 'unknown; target_company is query scope only and is not returned employer',
      });
    }
  }
  const byUrl = new Map();
  for (const item of results) {
    if (!item.url) continue;
    if (!byUrl.has(item.url)) byUrl.set(item.url, {
      url: item.url,
      source_kind: item.source_kind,
      source_origin_hint: item.source_origin_hint,
      isolation: item.isolation,
      evidence: [],
      candidate_status: item.isolation.status === 'halted_pending_admission' ? 'halted_pending_admission'
        : item.isolation.status === 'isolated_pending' ? 'pending_isolated_source' : 'admission_required',
      employer: null,
      employer_status: 'unknown_not_inferred',
      legal_entity: null,
      notes: ['URL-level dedup only; no employer or legal-entity inference from title/summary.'],
    });
    const source = byUrl.get(item.url);
    source.evidence.push({
      result_id: item.result_id,
      capture_id: item.capture_id,
      capture_file: item.capture_file,
      capture_sha256: item.capture_sha256,
      result_sha256: item.result_sha256,
      query: item.query,
      target_company: item.target_company,
      route: item.route,
      started_at: item.started_at,
      observed_at: item.observed_at,
      title_raw: item.title_raw,
    });
  }
  const sourceCandidates = [...byUrl.values()].sort((a, b) => a.url.localeCompare(b.url));
  const eligible = sourceCandidates.filter(x => x.candidate_status === 'admission_required');
  const halted = sourceCandidates.filter(x => x.candidate_status === 'halted_pending_admission');
  const isolated = sourceCandidates.filter(x => x.candidate_status === 'pending_isolated_source');
  const index = {
    schema_version: 'market-wide-search-index.v1',
    generated_from: 'raw/*.json only; deterministic offline rebuild',
    generated_at: 'derived_offline_from_raw_inputs; no runtime clock',
    network_used: false,
    browser_used: false,
    external_actions: 0,
    segmentation: { rule: '/-{20,}/', reused_from: 'careers/extract-coverage-captures.mjs and prior research build.mjs contract', note: 'A result block is retained verbatim; no model summarization.' },
    shape_handling: { preferred: 'capture.result string', observed_current: 'top-level result string', fallback: 'top-level result when capture.result is absent', skipped_records: skipped },
    counts: { raw_files: files.length, completed_search_captures: captures.length, result_entries: results.length, entries_with_url: results.filter(x => x.url).length, entries_without_url: results.filter(x => !x.url).length, distinct_urls: sourceCandidates.length, independent_read_candidates: 0, admission_required_urls: eligible.length, halted_pending_admission_urls: halted.length, isolated_pending_urls: isolated.length },
    captures,
    results,
  };
  const candidates = {
    schema_version: 'market-wide-source-candidates.v1',
    generated_from: 'search-index.json deterministic URL aggregation',
    network_used: false,
    browser_used: false,
    dedup_key: 'actual result URL exact string',
    employer_policy: 'target_company is never assigned as returned employer; employer and legal_entity remain null until independently evidenced',
    source_candidates: sourceCandidates,
  };
  if (!process.argv.includes('--self-test')) {
    await writeFile(resolve(here, 'search-index.json'), JSON.stringify(index, null, 2) + '\n');
    await writeFile(resolve(here, 'source-candidates.json'), JSON.stringify(candidates, null, 2) + '\n');
  }
  return { index, candidates };
}

const { index, candidates } = await build();
if (process.argv.includes('--self-test')) {
  const expectedMainIds = [...Array.from({ length: 8 }, (_, i) => `a${String(i + 1).padStart(2, '0')}`), ...Array.from({ length: 10 }, (_, i) => `b${String(i + 1).padStart(2, '0')}`)];
  const captureIds = index.captures.map(item => item.capture_id);
  const missingMainIds = expectedMainIds.filter(id => !captureIds.includes(id));
  const extraSearchIds = captureIds.filter(id => !expectedMainIds.includes(id));
  const searchFiles = index.captures.length;
  const employerViolations = index.results.filter(item => item.employer !== null || item.employer_status !== 'unknown_not_inferred').length
    + candidates.source_candidates.filter(item => item.employer !== null || item.employer_status !== 'unknown_not_inferred').length;
  const missingEvidence = index.results.filter(item => !item.capture_id || !item.query || !item.capture_sha256 || !item.result_sha256 || !item.observed_at || typeof item.summary_raw !== 'string').length;
  const stateCounts = index.results.reduce((out, item) => {
    for (const state of [item.url_status, item.source_kind, item.isolation.status]) out[state] = (out[state] ?? 0) + 1;
    return out;
  }, {});
  const assertions = {
    expected_main_captures_a01_a08_b01_b10: missingMainIds.length === 0,
    completed_search_capture_count_at_least_18: searchFiles >= 18,
    result_entries_positive: index.results.length > 0,
    employer_never_inferred_from_query_target: employerViolations === 0,
    result_evidence_complete: missingEvidence === 0,
    source_urls_deduplicated: candidates.source_candidates.length === new Set(candidates.source_candidates.map(item => item.url)).size,
    no_direct_read_candidate_status: candidates.source_candidates.every(item => item.candidate_status !== 'candidate_for_independent_read'),
    isolated_sources_not_accessed: index.results.every(item => item.isolation.status !== 'visited') && candidates.source_candidates.every(item => item.isolation.status !== 'visited'),
  };
  if (Object.values(assertions).some(value => !value)) throw new Error(`SELF_TEST_FAILED ${JSON.stringify({ assertions, missingMainIds, extraSearchIds, employerViolations, missingEvidence })}`);
  console.log(JSON.stringify({ mode: 'self-test', assertions, counts: index.counts, expected_main_capture_count: expectedMainIds.length, extra_search_capture_ids: extraSearchIds, missing_main_capture_ids: missingMainIds, state_counts: stateCounts, skipped_non_search_files: index.shape_handling.skipped_records }, null, 2));
  process.exit(0);
}
console.log(JSON.stringify({ captures: index.counts.completed_search_captures, result_entries: index.counts.result_entries, distinct_urls: index.counts.distinct_urls, independent_read_candidates: index.counts.independent_read_candidates, isolated_pending_urls: index.counts.isolated_pending_urls }, null, 2));
