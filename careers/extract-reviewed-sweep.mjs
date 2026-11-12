import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { ROOT, DATA_DIR, repoRelative } from './paths.mjs';
import { webLines, lineRange } from './sweep-extract.mjs';

const directory = resolve(ROOT, process.argv[2] ?? '');
if (!directory.startsWith(resolve(DATA_DIR, 'research') + sep)) throw new Error('RESEARCH_CHILD_DIRECTORY_REQUIRED');
const manifest = JSON.parse(await readFile(join(directory, 'extraction-specs.json'), 'utf8'));
const jobs = [], sourceChecks = [];
for (const source of manifest.sources) {
  if (!/^[a-zA-Z0-9_-]+\.json$/.test(source.file)) throw new Error('INVALID_CAPTURE_NAME');
  const file = join(directory, 'raw', source.file), bytes = await readFile(file), raw = JSON.parse(bytes);
  if (raw.kind !== 'web_tool_result_not_raw_http' || !['open', 'click'].includes(raw.operation)) throw new Error('OPEN_CAPTURE_REQUIRED');
  const text = typeof raw.result === 'string' ? raw.result : raw.result.content.filter((x) => x.type === 'text').map((x) => x.text).join('\n');
  if (!text.includes(source.url)) throw new Error('SOURCE_URL_NOT_IN_CAPTURE');
  const lines = webLines(raw.result);
  for (const item of source.jobs) {
    const titleLine = lineRange(lines, item.title_line, item.title_line);
    const title = item.title || titleLine.replace(/^#+\s*/, '').replace(/^\*\s*/, '').trim();
    if (!titleLine.includes(title)) throw new Error('TITLE_NOT_IN_BOUND_LINE');
    const location = lineRange(lines, item.location_line ?? item.title_line, item.location_line ?? item.title_line);
    if (item.city && !location.includes(item.city)) throw new Error('CITY_NOT_IN_BOUND_LINE');
    const description = lineRange(lines, ...item.responsibilities), requirements = lineRange(lines, ...item.requirements);
    jobs.push({ id: item.id || `${source.key}-l${item.title_line}-20260913`, company: source.company,
      title, city: item.city ?? location, location: item.city ?? location, attention: item.attention ?? null,
      salary_raw: item.salary_raw ?? null, salary_evidence_quote: item.salary_quote ?? null,
      job_url: item.job_url ?? null, apply_url: item.apply_url ?? source.apply_url ?? null,
      source_url: source.url, board_url: source.url, source_kind: source.kind ?? 'official',
      link_kind: item.job_url ? 'job_detail' : 'board', industry: source.industry, segment: source.segment, tier: 'unverified',
      description, requirements, description_complete: true, observed_at: raw.observed_at, published_at: item.published_at ?? null,
      time_note: item.time_note || '本次公开页面读取时间，不等于新发布日期；当前招聘有效性与薪资构成待招聘方确认。',
      ownership_note: source.ownership_note,
      scope_note: item.scope_note || '按本次可得原文连续段提取；同页多个职位无独立直链时以来源页和原文标题定位，不声称全站分页完成。',
      hiring_type: item.hiring_type ?? 'social_or_unmarked',
      evidence_file: repoRelative(file), evidence_sha256: createHash('sha256').update(bytes).digest('hex'),
      evidence_quote: lineRange(lines, item.responsibilities[0], item.responsibilities[0]),
      evidence_line_ranges: { title: item.title_line, location: item.location_line ?? item.title_line, responsibilities: item.responsibilities, requirements: item.requirements },
      route: source.route ?? 'A', extraction_method: 'reviewed_line_ranges_no_generated_jd_prose',
    });
  }
  sourceChecks.push({ source: source.url, captured_jobs_extracted: source.jobs.length, evidence_file: repoRelative(file) });
}
const output = join(directory, 'jobs.json');
for (const source of manifest.lead_sources ?? []) {
  if (!/^[a-zA-Z0-9_-]+\.json$/.test(source.file)) throw new Error('INVALID_CAPTURE_NAME');
  const file = join(directory, 'raw', source.file), bytes = await readFile(file), raw = JSON.parse(bytes);
  if (raw.operation !== 'search' || raw.kind !== 'web_tool_result_not_raw_http') throw new Error('SEARCH_CAPTURE_REQUIRED');
  const body = typeof raw.result === 'string' ? raw.result : JSON.stringify(raw.result);
  for (const [index, item] of source.jobs.entries()) {
    if (!body.includes(item.source_url) || !body.includes(item.quote)
        || [item.company, item.title, item.salary_raw, item.city, item.recruiter_name].filter(Boolean).some((value) => !item.quote.includes(value))) throw new Error('LEAD_NOT_BOUND_TO_ORIGINAL_QUOTE');
    jobs.push({ ...item, id: item.id || `index-${source.file.replace('.json', '')}-${index}`, source_kind: 'search_index',
      description: item.quote, requirements: null, description_complete: false,
      job_url: item.job_url ?? null, apply_url: null, location: item.city ?? null, tier: 'unverified',
      observed_at: raw.observed_at, published_at: null, route: 'B',
      evidence_file: repoRelative(file), evidence_sha256: createHash('sha256').update(bytes).digest('hex'), evidence_quote: item.quote,
      salary_evidence_quote: item.salary_raw ? item.quote : null,
      time_note: '仅本次搜索索引读取时间，不代表新发布、当前在招或薪资构成已核实。',
      ownership_note: '雇主和联系人为搜索索引原文显示，尚未通过岗位原站核验。',
      scope_note: '搜索聚合页只是回查入口，无独立职位URL时不补造；不同联系人及不明联系人保留，薪资范围不等于固定底薪。',
      extraction_method: 'reviewed_exact_index_quote_not_full_jd',
    });
  }
}
await writeFile(output, JSON.stringify(jobs, null, 2) + '\n');
console.log(JSON.stringify({ jobs: jobs.length, sources: sourceChecks, output: repoRelative(output) }));
