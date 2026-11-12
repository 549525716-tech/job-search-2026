import { createHash } from 'node:crypto';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, DATA_DIR, repoRelative } from './paths.mjs';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
export function bindDiscoveryQuote(result, entry, reviewedUrl = null) {
  const blocks = result.split(/-{20,}/).map((block) => ({
    text: block, url: block.split('cite')[0].trim().match(/\((https?:\/\/[^)]+)\)\s*$/)?.[1],
  }));
  const matching = blocks.filter((block) => block.url && block.text.includes(entry.verbatim_quote));
  const exact = matching.find((block) => block.url === entry.source_url);
  if (exact) return { ...entry };
  const candidates = [...new Set(matching.map((block) => block.url))];
  const selected = reviewedUrl && candidates.includes(reviewedUrl) ? reviewedUrl : candidates.length === 1 ? candidates[0] : null;
  if (!selected) return null;
  return { ...entry, source_url: selected, original_source_url: entry.source_url,
    citation_correction: 'Rebound to a reviewed result item containing the exact company quote; no new page visit.' };
}
export function captureLines(text) {
  const rows = [...text.matchAll(/(?:^|\s)L(\d+):[ \t]?([\s\S]*?)(?=\sL\d+:|$)/g)];
  const lines = new Map();
  for (const [, id, value] of rows) {
    if (lines.has(Number(id)) && lines.get(Number(id)) !== value.trimEnd()) throw new Error(`CONFLICTING_LINE_${id}`);
    lines.set(Number(id), value.trimEnd());
  }
  return lines;
}
export function captureRange(lines, bounds) {
  if (!bounds) return null;
  const [from, to = from] = Array.isArray(bounds) ? bounds : [bounds];
  const values = [];
  for (let i = from; i <= to; i++) {
    if (!lines.has(i)) throw new Error(`MISSING_SOURCE_LINE_${i}`);
    values.push(lines.get(i));
  }
  return values.join('\n').trim();
}
export async function extractCoverageCaptures(input) {
  const dir = resolve(ROOT, input);
  if (!dir.startsWith(join(DATA_DIR, 'research') + sep)) throw new Error('RESEARCH_CHILD_DIRECTORY_REQUIRED');
  const manifest = JSON.parse(await readFile(join(dir, 'extraction-specs.json')));
  const jobs = [], inventory = [], sourceResults = [];
  for (const file of (await readdir(join(dir, 'raw'))).filter((x) => /^\d+\.json$/.test(x)).sort()) {
    const path = join(dir, 'raw', file), bytes = await readFile(path), raw = JSON.parse(bytes);
    const evidence_file = repoRelative(path), evidence_sha256 = sha(bytes);
    const lines = captureLines(raw.result);
    const spec = manifest.sources.find((s) => s.file === file);
    const timestampValid = Number.isFinite(Date.parse(raw.observed_at));
    const status = ['202.json', '208.json'].includes(file) ? 'failed_technical' : raw.operation === 'search' ? 'search_index_only' : 'partial';
    inventory.push({ id: file.replace('.json', ''), evidence_file, evidence_sha256, company: raw.company,
      status, observed_at: timestampValid ? raw.observed_at : null, timing_valid: timestampValid,
      source_kind: spec?.kind ?? (raw.operation === 'search' ? 'search_index' : file === '208.json' ? 'official' : 'industry_directory'),
      source_purpose: spec || file === '208.json' ? 'job_content' : 'company_discovery', operation: raw.operation,
      request: raw.request, native_pagination_complete: false, detail_completion_complete: false });
    if (!spec) continue;
    if (raw.operation !== 'open' || !raw.result.includes(spec.url) || !timestampValid) throw new Error('INVALID_JOB_CAPTURE');
    for (const item of spec.jobs) {
      const originalTitle = captureRange(lines, item.title_line);
      const title = item.title ?? originalTitle.replace(/^#+\s*/, '').trim();
      if (!originalTitle.includes(title)) throw new Error('TITLE_NOT_IN_BOUND_LINE');
      const location = captureRange(lines, item.location_line);
      if (item.city && !location?.includes(item.city)) throw new Error('CITY_NOT_IN_BOUND_LINE');
      const description = captureRange(lines, item.responsibilities);
      const shared = captureRange(lines, spec.shared_requirements);
      const requirements = [captureRange(lines, item.requirements), shared].filter(Boolean).join('\n\n');
      if (!description || !requirements) throw new Error('EMPTY_JD_SECTION');
      const salaryQuote = item.salary_lines?.map((line) => captureRange(lines, line)).join('\n') ?? null;
      if (item.salary_raw && !salaryQuote?.includes(item.salary_raw)) throw new Error('SALARY_NOT_BOUND_TO_SOURCE');
      const id = `${spec.key}-l${item.title_line}-20260914`;
      jobs.push({ id, company: spec.company, title, city: item.city ?? null, location,
        salary_raw: item.salary_raw ?? salaryQuote, salary_evidence_quote: salaryQuote,
        job_url: spec.detail ? spec.url : null, apply_url: null, source_url: spec.url,
        board_url: spec.url, source_kind: spec.kind, link_kind: spec.detail ? 'job_detail' : 'board',
        industry: spec.industry, tier: 'unverified', description, requirements, description_complete: true,
        ...(shared ? { shared_requirements: shared, shared_requirements_lines: spec.shared_requirements,
          source_role_text: captureRange(lines, [item.title_line, item.requirements[1]]) } : {}),
        observed_at: raw.observed_at, published_at: item.published_at ?? null,
        time_note: item.time_note ?? '本次公开页面读取时间；不是新发布日期或当前开放状态核验。',
        ownership_note: spec.ownership_note, scope_note: '仅本页可取得职责及要求；未证明招聘全站、其他渠道或全部分页已完成。',
        attention: item.attention ?? (item.variant_of ? '同一页面另一展示版本，疑似对应主区岗位；原始观察保留，不计为新增独立机会。' : null),
        suspected_variant_of: item.variant_of ?? null, hiring_freshness_verified: false,
        evidence_file, evidence_sha256, evidence_quote: description.split('\n')[0],
        evidence_line_ranges: { title: item.title_line, location: item.location_line ?? null,
          responsibilities: item.responsibilities, requirements: item.requirements, salary: item.salary_lines ?? [] },
        route: raw.route, extraction_method: 'reviewed_source_line_ranges',
      });
    }
    sourceResults.push({ company: spec.company, source_url: spec.url, source_kind: spec.kind,
      status: 'partial', evidence_files: [evidence_file], source_outcomes: [inventory.at(-1)],
      source_scope_complete: false, extracted_observations: spec.jobs.length });
  }
  const discoveryInput = JSON.parse(await readFile(join(dir, 'company-discoveries.json')));
  const discoveries = Array.isArray(discoveryInput) ? discoveryInput : discoveryInput.companies;
  if (!Array.isArray(discoveries)) throw new Error('DISCOVERY_COMPANIES_ARRAY_REQUIRED');
  const accepted = [], rejected = [];
  for (const entry of discoveries) {
    const rawPath = resolve(ROOT, entry.evidence_file);
    if (!rawPath.startsWith(join(dir, 'raw') + sep)) throw new Error('DISCOVERY_EVIDENCE_ESCAPE');
    const bytes = await readFile(rawPath), raw = JSON.parse(bytes);
    const valid = sha(bytes) === entry.evidence_sha256 && entry.verbatim_quote.includes(entry.company_name);
    const correction = (manifest.citation_corrections ?? []).find((c) => entry.evidence_file.endsWith('/' + c.file) && entry.source_url === c.old_url);
    const bound = valid ? bindDiscoveryQuote(raw.result, entry, correction?.new_url) : null;
    if (bound) {
      if (bound.source_url.includes('nda.gov.cn/sjj/zhuanti/ztdsjblh/')) {
        bound.source_purpose = 'event_participation_company_discovery';
        bound.context_note = '原文语境是活动承办方，不是产业图谱成员；行业分类及招聘情况待核。';
      }
      accepted.push(bound);
    } else rejected.push({ ...entry, validation_error: 'URL_AND_QUOTE_NOT_BOUND_TO_ONE_SEARCH_RESULT' });
  }
  const events = (await readFile(join(dir, 'web-session.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
  const begins = events.filter((e) => e.event === 'begin'), finishes = events.filter((e) => e.event === 'finish');
  const unfinished = begins.filter((b) => !finishes.some((f) => f.id === b.id)).map((b) => b.id);
  const captureHashesValid = finishes.every((f) => inventory.some((i) => i.evidence_file === f.evidence_file && i.evidence_sha256 === f.evidence_sha256));
  const run = { run_id: manifest.run_id, status: 'partial_with_explicit_backlog', market_scan_complete: false,
    actual_started_calls: begins.length, persisted_capture_count: inventory.length, completed_receipts: finishes.length,
    unfinished_receipt_ids: unfinished, capture_hashes_valid: captureHashesValid, audit_status: unfinished.length ? 'partial_failed_early_receipts' : 'passed',
    jobs: jobs.length, suspected_same_page_variants: jobs.filter((j) => j.suspected_variant_of).length,
    company_discovery_records: accepted.length, rejected_discovery_records: rejected.length,
    corrected_discovery_source_bindings: accepted.filter((entry) => entry.original_source_url).length,
    stopped_sources: ['BOSS直聘：旧安全暂停，未获恢复确认', '猎聘：旧验证码暂停，未获恢复确认'],
    failed_sources: inventory.filter((i) => i.status === 'failed_technical'),
    execution: { collection: 'controller tools after Luna wrapper failures; 21 valid captures',
      directory_extraction: 'Luna medium; 104 raw candidate records; offline quote and hash validation',
      engineering: 'Terra medium plus controller integration', independent_qa: 'pending' },
    caveats: ['001回执无原始结果；002有结果但原时间无效且未完成队列回执；均未修造历史。',
      '来源页面公开可读不证明当前仍招聘；目录记录不等于招聘公司；主体与行业层级待核。',
      '搜索摘要仍保存在raw中，未全部结构化；新公司各渠道待续，不视作扫描完成。'] };
  const outputs = { 'jobs.json': jobs, 'coverage.json': sourceResults, 'capture-inventory.json': inventory,
    'run.json': run, 'company-discoveries-reviewed.json': accepted, 'company-discoveries-rejected.json': rejected };
  for (const [file, data] of Object.entries(outputs)) await writeFile(join(dir, file), JSON.stringify(data, null, 2) + '\n');
  return run;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) extractCoverageCaptures(process.argv[2]).then(console.log).catch((error) => { console.error(error); process.exitCode = 1; });
