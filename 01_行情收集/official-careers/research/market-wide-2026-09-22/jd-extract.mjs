import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureLines, captureRange } from '../market-2026-09-21/build.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(DIR, '../../../..');
const EXPECTED = ['o01', 'o01b', ...Array.from({ length: 9 }, (_, i) => `o${String(i + 2).padStart(2, '0')}`)];
const sha = value => createHash('sha256').update(value).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const filePattern = /^[od]\d+[a-z]*\.json$/;
const textOnly = value => value.replace(/cite\d+†([^†]+)(?:†[^]*)?/g, '$1');
const titleOnly = value => textOnly(value).replace(/^\s*(?:#{1,6}\s+|\*\s+)/, '').trim();
const extraSpecBytes = await readFile(join(DIR, 'extra-board-specs.json'), 'utf8').catch(error => {
  if (error.code === 'ENOENT') return null;
  throw error;
});
const extraSpecs = extraSpecBytes ? JSON.parse(extraSpecBytes).sources : [];
assert(Array.isArray(extraSpecs));

function validUrl(value) {
  try { const u = new URL(value); return /https?:/.test(u.protocol) ? value : null; } catch { return null; }
}

export function decodeCapture(file, bytes) {
  const raw = JSON.parse(bytes.toString('utf8'));
  const body = raw.capture && typeof raw.capture === 'object' ? raw.capture : raw;
  const result = body.result;
  const header = typeof result === 'string' ? result.slice(0, result.search(/(?:^|\s)L\d+:/) < 0 ? result.length : result.search(/(?:^|\s)L\d+:/)) : '';
  const first = header.split('\n')[0];
  const sourceUrl = validUrl(first.match(/\((https?:\/\/[^\r\n]+)\)\s*$/)?.[1]);
  let lines = new Map(), parseError = null;
  try { if (typeof result === 'string') lines = captureLines(result); } catch (e) { parseError = e.message; }
  return {
    id: file.replace(/\.json$/, ''), file, raw, result, header, source_url: sourceUrl,
    ref_id: header.match(/cite([^]+)/)?.[1] ?? null,
    operation: raw.operation ?? body.operation ?? null,
    request: raw.request ?? body.request ?? null,
    query_target_company: raw.company ?? body.company ?? null,
    observed_at: body.observed_at ?? raw.observed_at ?? null,
    observed_pointer: body.observed_at !== undefined && body !== raw ? '/capture/observed_at' : '/observed_at',
    reported_total_lines: Number(header.match(/Total lines: (\d+)/)?.[1]) || null,
    lines, parse_error: parseError,
    evidence_file: relative(ROOT, join(DIR, 'raw', file)), evidence_sha256: sha(bytes),
    result_sha256: typeof result === 'string' ? sha(result) : null,
  };
}

const rows = c => [...c.lines].sort((a, b) => a[0] - b[0]);
const lineText = (c, n) => c.lines.get(n) ?? '';
const findLine = (c, predicate, from = 0, to = Infinity) => rows(c).find(([n, v]) => n >= from && n <= to && predicate(v))?.[0] ?? null;

function rangeEvidence(c, range, value = null) {
  if (range == null) return null;
  const quote = captureRange(c.lines, range);
  const start = typeof value === 'string' ? quote.indexOf(value) : -1;
  return { evidence_file: c.evidence_file, evidence_sha256: c.evidence_sha256,
    capture_id: c.id, result_sha256: c.result_sha256,
    line_range: range, quote, quote_sha256: sha(quote),
    value_char_range: start >= 0 ? [start, start + value.length] : null };
}

function headerEvidence(c, value) {
  const start = c.header.indexOf(value);
  return { evidence_file: c.evidence_file, evidence_sha256: c.evidence_sha256,
    capture_id: c.id, result_sha256: c.result_sha256,
    line_range: null, locator: 'result_header', quote: c.header, quote_sha256: sha(c.header),
    value_char_range: start >= 0 ? [start, start + value.length] : null };
}

function trimRange(c, from, to) {
  while (from <= to && /^\s*#*\s*$/.test(lineText(c, from))) from++;
  while (to >= from && /^\s*#*\s*$/.test(lineText(c, to))) to--;
  if (from > to) return null;
  // captureRange deliberately rejects internal gaps instead of joining a partial JD.
  captureRange(c.lines, [from, to]);
  return [from, to];
}

function companyClaim(c, literal, predicate = v => v.includes(literal)) {
  const line = findLine(c, predicate);
  return line == null || !lineText(c, line).includes(literal) ? null : { value: literal, range: [line, line] };
}

function admission(url) {
  if (!url) return 'target_url_unknown_admission_required';
  const host = new URL(url).hostname;
  if (['zhipin.com', 'liepin.com', 'minimax.cn', 'linkedin.com'].some(d => host === d || host.endsWith('.' + d))) return 'historical_restriction_pending';
  return 'admission_required';
}

function linksIn(c, from, to, { anyLabel = false } = {}) {
  const links = [];
  for (const [n, value] of rows(c).filter(([n]) => n >= from && n <= to)) {
    for (const m of value.matchAll(/cite(\d+)†([^]+)/g)) {
      const [label, ...tail] = m[2].split('†');
      if (!anyLabel && !/查看(?:详情|岗位)|职位详情|岗位详情|View (?:job|details)/i.test(label)) continue;
      const url = tail.map(validUrl).find(Boolean) ?? null;
      links.push({ link_id: Number(m[1]), ref_id: c.ref_id, label_raw: label, url,
        url_status: url ? 'literal_url' : 'not_exposed_linkid_only', admission_status: admission(url),
        evidence: rangeEvidence(c, [n, n], m[0]) });
    }
    for (const m of value.matchAll(/\[([^\]]+)\]\((https?:\/\/[^\s]+)\)/g)) {
      if (!anyLabel && !/查看(?:详情|岗位)|职位详情|View (?:job|details)/i.test(m[1])) continue;
      const url = validUrl(m[2]);
      if (url) links.push({ link_id: null, ref_id: c.ref_id, label_raw: m[1], url,
        url_status: 'literal_url', admission_status: admission(url), evidence: rangeEvidence(c, [n, n], m[0]) });
    }
  }
  return links;
}

function makeJob(c, spec) {
  const titleRaw = lineText(c, spec.title_line);
  const title = spec.title ?? titleOnly(titleRaw);
  assert(title && titleRaw.includes(title), `TITLE_NOT_BOUND:${c.id}:${spec.title_line}`);
  const fields = Object.fromEntries(['company', 'title', 'source_url', 'job_url', 'location', 'city', 'salary_raw',
    'published_at', 'page_date_raw', 'description', 'requirements', 'description_summary', 'education', 'observed_at', 'hiring_active'].map(k => [k, null]));
  fields.title = rangeEvidence(c, [spec.title_line, spec.title_line], title);
  fields.source_url = c.source_url ? headerEvidence(c, c.source_url) : null;
  fields.company = spec.company ? rangeEvidence(c, spec.company.range, spec.company.value) : null;
  if (c.observed_at != null) fields.observed_at = { evidence_file: c.evidence_file, evidence_sha256: c.evidence_sha256,
    line_range: null, locator: 'capture_metadata', json_pointer: c.observed_pointer, value: c.observed_at };
  const values = {};
  for (const field of ['location', 'salary_raw', 'published_at', 'page_date_raw', 'education']) {
    const bound = spec[field];
    values[field] = bound?.value ?? null;
    if (bound) {
      fields[field] = rangeEvidence(c, bound.range, bound.value);
      assert(fields[field].value_char_range, `FIELD_NOT_LITERAL:${field}`);
    }
  }
  fields.city = fields.location;
  for (const field of ['description', 'requirements', 'description_summary']) {
    const range = spec[field + '_range'];
    values[field] = range ? captureRange(c.lines, range) : null;
    fields[field] = rangeEvidence(c, range);
  }
  const complete = Boolean(values.description && values.requirements && spec.sections_closed === true
    && !/(?:\.\.\.|…|未完|待补)\s*$/.test(values.description + '\n' + values.requirements));
  const detailLinks = spec.detail_links ?? linksIn(c, spec.title_line, spec.end_line);
  // A title link may be an anchor, application page or detail page. Preserve it
  // without treating it as a verified detail URL or changing job identity.
  const sourceLinks = spec.preserve_title_link
    ? linksIn(c, spec.title_line, spec.title_line, { anyLabel: true })
      .map(link => ({ ...link, target_type: 'unknown_source_title_link' })) : [];
  const actualJobUrl = spec.is_detail ? c.source_url : detailLinks.find(l => l.url)?.url ?? null;
  if (actualJobUrl) fields.job_url = spec.is_detail ? headerEvidence(c, actualJobUrl)
    : rangeEvidence(c, detailLinks.find(l => l.url === actualJobUrl).evidence.line_range, actualJobUrl);
  const job = {
    id: `market-wide-2026-09-22:${c.id}:l${spec.title_line}`,
    capture_id: c.id, native_id: null,
    query_target_company: c.query_target_company,
    company: spec.company?.value ?? null,
    company_identity_status: spec.company ? 'page_self_identification_not_independently_verified' : 'unknown_no_page_claim',
    employer_legal_entity: null, employer_legal_entity_status: 'unknown_not_inferred',
    title, title_raw: titleRaw, ...values, city: values.location,
    source_url: c.source_url, job_url: actualJobUrl, apply_url: null,
    source_kind: spec.source_kind ?? 'public_careers_page', source_origin_status: 'page_claim_observed_ownership_not_independently_verified',
    observation_kind: spec.observation_kind ?? (spec.is_detail ? 'main_detail' : complete ? 'inline_detail' : 'main_list'),
    description_complete: complete,
    completeness_status: complete ? 'responsibilities_and_requirements_visible_with_boundaries'
      : values.description_summary ? 'list_summary_only' : values.description || values.requirements ? 'partial_jd' : 'title_only',
    published_at_semantics: values.published_at ? 'page_explicit_publication_label_raw' : 'unknown',
    observed_at: c.observed_at, time_note: 'capture observation time is not publication time or live hiring verification',
    hiring_active: 'unknown', hiring_active_evidence: null,
    salary_currency: null, salary_period: null, salary_monthly_upper_cny: null,
    salary_fixed_base: null, salary_fixed_base_confirmed: false,
    salary_status: values.salary_raw ? 'raw_only_components_unverified' : 'unknown_not_disclosed',
    detail_links: detailLinks, field_evidence: fields,
    ...(spec.preserve_title_link ? { source_links: sourceLinks } : {}),
    raw_job_block_evidence: rangeEvidence(c, [spec.start_line ?? spec.title_line, spec.end_line]),
    block_boundary_status: spec.sections_closed ? 'explicit_section_boundary' : 'list_or_partial',
    evidence_file: c.evidence_file, evidence_sha256: c.evidence_sha256,
    scope_complete: false, role_filter_applied: false,
    status: { company: spec.company ? 'page_claim_only' : 'unknown', location: values.location ? 'page_stated' : 'unknown',
      salary: values.salary_raw ? 'page_stated_raw_only' : 'unknown', publication: values.published_at ? 'page_stated' : 'unknown',
      hiring: 'unknown', job_url: actualJobUrl ? 'observed_literal' : detailLinks.length ? 'linkid_only' : 'unknown_not_exposed' },
  };
  if (spec.common_requirements_range) job.common_requirements_evidence = rangeEvidence(c, spec.common_requirements_range);
  return job;
}

function qingcloud(c) {
  const company = companyClaim(c, '青云QingCloud', v => v.startsWith('青云QingCloud 是一家'));
  const starts = rows(c).filter(([, v]) => /^######\s+\S/.test(v)).map(([n]) => n);
  const jobs = starts.map((start, i) => {
    const end = (starts[i + 1] ?? findLine(c, v => /QingCloud Technologies/.test(v), start) ?? Math.max(...c.lines.keys()) + 1) - 1;
    const cityLine = findLine(c, v => Boolean(v.trim()) && !v.includes('cite'), start + 1, end);
    const value = cityLine != null ? lineText(c, cityLine).trim() : null;
    const location = value && /^(?:北京|上海|广州|深圳|武汉)(?:\s*[/、]\s*(?:北京|上海|广州|深圳|武汉))*$/.test(value)
      ? { value, range: [cityLine, cityLine] } : null;
    return makeJob(c, { title_line: start, end_line: end, company, location });
  });
  return { jobs, status: jobs.length ? 'title_list_partial' : 'readable_fragment_without_visible_job_cards' };
}

function digitforce(c) {
  const company = companyClaim(c, '数势科技', v => /©.*数势科技/.test(v));
  const beginning = findLine(c, v => v === '## 热门职位');
  const endBoard = findLine(c, v => v === 'DIGIT FORCE', beginning ?? 0);
  if (beginning == null || endBoard == null) return { jobs: [], status: 'pending_format_review' };
  const starts = rows(c).filter(([n, v]) => n > beginning && n < endBoard && /^##\s+\S/.test(v)).map(([n]) => n);
  const jobs = starts.map((start, i) => {
    const next = (starts[i + 1] ?? endBoard) - 1;
    const locLine = rows(c).filter(([n, v]) => n < start && n > (starts[i - 1] ?? beginning) && v.trim()).at(-1)?.[0];
    const m = lineText(c, locLine).match(/^(.+?)\s+\/\s+[^/]+$/);
    const linkLine = findLine(c, v => /†查看岗位/.test(v), start, next);
    const end = linkLine ?? next;
    const summary = linkLine == null ? null : trimRange(c, start + 1, linkLine - 1);
    return makeJob(c, { title_line: start, start_line: locLine ?? start, end_line: end, company,
      location: m ? { value: m[1], range: [locLine, locLine] } : null, description_summary_range: summary });
  });
  return { jobs, status: jobs.length ? 'summary_list_partial' : 'pending_format_review' };
}

function noumena(c) {
  const company = companyClaim(c, 'Noumena（物自体）', v => v.startsWith('Noumena（物自体）是一家'));
  const names = [
    'AI 转型专家 / 咨询顾问', '资深商务拓展经理 / Sales（解决方案方向）',
    'AI 产品经理 / AI 产品专家', 'AI Agent 全栈工程师', '研发实习生（AI Agent 方向）',
    'AI 产品运营实习生', '招聘经理 / TA（社媒营销 & 商业化方向）', '出海商业化 BD 负责人', '小红书线索广告投放专员',
  ];
  const starts = rows(c).filter(([, v]) => names.some(name => v.startsWith(name))).map(([n, v]) => ({ n, title: names.find(name => v.startsWith(name)) }));
  const common = findLine(c, v => /^工作地点均为/.test(v));
  const jobs = starts.map(({ n: start, title }, i) => {
    const boundary = starts[i + 1]?.n ?? findLine(c, v => /^## 期待遇见/.test(v), start);
    const max = boundary == null ? Math.max(...c.lines.keys()) : boundary - 1;
    const chapter = findLine(c, v => /^\d{2} · /.test(v), start + 1, max);
    const end = chapter == null ? max : chapter - 1;
    const d = findLine(c, v => v === '你将负责', start, end);
    const r = findLine(c, v => v === '我们期待你', start, end);
    const benefits = findLine(c, v => v === '你能得到', r ?? start, end);
    const locLine = findLine(c, v => /^工作地点：/.test(v), start, end) ?? common;
    const loc = lineText(c, locLine).match(/^工作地点(?:均为|：)([^，。]+)/)?.[1] ?? null;
    return makeJob(c, { title_line: start, title, end_line: end, company,
      location: loc ? { value: loc, range: [locLine, locLine] } : null,
      description_range: d != null && r > d ? trimRange(c, d + 1, r - 1) : null,
      requirements_range: r != null ? trimRange(c, r + 1, benefits == null ? end : benefits - 1) : null,
      sections_closed: boundary != null || chapter != null,
      common_requirements_range: c.lines.has(12) && c.lines.has(34) && lineText(c, 12) === 'Who We Look For' ? [12, 34] : null });
  });
  return { jobs, status: jobs.length ? 'inline_roles_extracted_not_site_complete' : 'pending_format_review' };
}

function hegong(c) {
  const company = companyClaim(c, '上海合共软件科技有限公司', v => /Copyright.*上海合共软件科技有限公司/.test(v));
  const starts = rows(c).filter(([n, v]) => /^\s*\*\s+[^]+$/.test(v)
    && findLine(c, x => /^部门：.+地点：.+学历：.+发布时间：/.test(x), n + 1, n + 3) != null).map(([n]) => n);
  const jobs = starts.map((start, i) => {
    const max = (starts[i + 1] ?? Math.max(...c.lines.keys()) + 1) - 1;
    const closure = findLine(c, v => /^投递简历 \(/.test(v), start, max);
    const end = closure == null ? max : closure - 1;
    const metaLine = findLine(c, v => /^部门：/.test(v), start, end);
    const metadata = lineText(c, metaLine).match(/^部门：(.+?) 地点：(.+?) 学历：(.+?) 发布时间：(.+)$/);
    const d = findLine(c, v => /^#+ 岗位职责$/.test(v), start, end);
    const r = findLine(c, v => /^#+ 任职要求$/.test(v), start, end);
    const bound = index => metadata ? { value: metadata[index], range: [metaLine, metaLine] } : null;
    const job = makeJob(c, { title_line: start, end_line: end, company, location: bound(2), education: bound(3), published_at: bound(4),
      description_range: d != null && r > d ? trimRange(c, d + 1, r - 1) : null,
      requirements_range: r != null ? trimRange(c, r + 1, end) : null, sections_closed: closure != null });
    const degreeLine = r == null ? null : findLine(c, v => /(?:专科|本科|硕士|博士).{0,12}学历/.test(v), r + 1, end);
    const degree = degreeLine == null ? null : lineText(c, degreeLine).match(/(?:专科|本科|硕士|博士)/)?.[0];
    if (degree && job.education && !job.education.includes(degree)) {
      const bodyClaim = lineText(c, degreeLine);
      job.field_conflicts = [{ field: 'education', values: [job.education, bodyClaim],
        status: 'header_body_conflict_requires_verification',
        evidence: [job.field_evidence.education, rangeEvidence(c, [degreeLine, degreeLine], bodyClaim)] }];
      job.education_status = 'conflicting_source_claims_do_not_hard_filter';
      job.attention = `学历信息冲突：标题栏为${job.education}，正文为“${bodyClaim}”。需向招聘方确认，不能据单一字段筛除。`;
    }
    return job;
  });
  return { jobs, status: jobs.length ? 'inline_roles_extracted_not_site_complete' : 'pending_format_review' };
}

function siteDetail(c, site) {
  const q = site === 'qingcloud';
  const back = findLine(c, v => q ? v.includes('← 全部职位') : v.includes('←岗位列表'));
  const start = back == null ? null : findLine(c, v => q ? /^#### \S/.test(v) : /^# \S/.test(v), back + 1);
  if (start == null) return { jobs: [], status: 'detail_body_not_in_capture', reason: 'Navigation alone is not a job; a numbered body/tail capture is required.' };
  const d = findLine(c, v => v === (q ? '职位描述' : '岗位职责'), start);
  const r = findLine(c, v => v === (q ? '职位要求' : '任职要求'), d ?? start);
  const closure = findLine(c, v => /^(?:现在申请|立即申请)(?: \(|$)/.test(v), r ?? start);
  const footer = findLine(c, v => q ? /QingCloud Technologies/.test(v) : v === 'DIGIT FORCE', start);
  const end = (closure ?? footer ?? Math.max(...c.lines.keys()) + 1) - 1;
  const company = q
    ? companyClaim(c, '青云QingCloud', v => /品牌云服务的运营商/.test(v) && v.includes('青云QingCloud'))
    : companyClaim(c, '数势科技', v => /©.*数势科技/.test(v));
  const locLine = q ? findLine(c, v => Boolean(v.trim()), start + 1, (d ?? start) - 1)
    : findLine(c, v => /^.+?\s+\/\s+[^/]+$/.test(v), start + 1, (d ?? start) - 1);
  const loc = locLine == null ? null : q ? lineText(c, locLine).trim() : lineText(c, locLine).match(/^(.+?)\s+\/\s+[^/]+$/)?.[1];
  return { jobs: [makeJob(c, { title_line: start, end_line: end, company, is_detail: true,
    location: loc ? { value: loc, range: [locLine, locLine] } : null,
    description_range: d != null && r > d ? trimRange(c, d + 1, r - 1) : null,
    requirements_range: r != null ? trimRange(c, r + 1, end) : null,
    sections_closed: closure != null })], status: 'detail_extracted_not_live_hiring_verified' };
}

function yonchang(c) {
  const board = findLine(c, v => v === '## 人才招聘');
  const footer = findLine(c, v => v === '用畅科技', board ?? 0);
  if (board == null || footer == null) return { jobs: [], status: 'pending_format_review' };
  const company = companyClaim(c, '上海用畅信息科技有限公司', v => v === '上海用畅信息科技有限公司');
  const dLabel = /^(?:岗位职责|职位描述)[:：]?$/;
  const rLabel = /^(?:岗位要求|任职资格|任职要求)[:：]?$/;
  // A title directly precedes a responsibility label; numbered body items never start a new role.
  const candidates = rows(c).filter(([n, v]) => n > board && n < footer && v.trim()
    && !/^(?:\d|#)/.test(v) && !dLabel.test(v) && !rLabel.test(v)
    && dLabel.test(lineText(c, n + 1))).map(([n]) => n);
  const starts = [];
  for (const n of candidates) {
    if (!starts.length || findLine(c, v => rLabel.test(v), starts.at(-1) + 1, n - 1) != null) starts.push(n);
  }
  const jobs = starts.map((start, i) => {
    const end = (starts[i + 1] ?? footer) - 1;
    const d = start + 1, r = findLine(c, v => rLabel.test(v), d + 1, end);
    const benefits = findLine(c, v => /^福利待遇[:：]/.test(v), r ?? start, end);
    const text = lineText(c, start), salary = text.match(/[（(]((?:年薪)?\d+\s*-\s*\d+(?:万|K))[）)]/)?.[1];
    const title = salary ? text.slice(0, text.indexOf(salary) - 1) : text;
    return makeJob(c, { title_line: start, title, end_line: end, company,
      salary_raw: salary ? { value: salary, range: [start, start] } : null,
      description_range: r > d ? trimRange(c, d + 1, r - 1) : null,
      requirements_range: r == null ? null : trimRange(c, r + 1, benefits == null ? end : benefits - 1), sections_closed: true });
  });
  return { jobs, status: 'inline_roles_extracted_not_site_complete' };
}

function haier(c) {
  const number = findLine(c, v => /^机会编号：/.test(v));
  const start = number == null ? null : findLine(c, v => / 薪资面议$/.test(v), number + 1);
  if (start == null) return { jobs: [], status: 'pending_format_review' };
  const company = companyClaim(c, '卡奥斯平台', v => v.startsWith('全部机会 /') && v.includes('/ 卡奥斯平台 /'));
  const meta = findLine(c, v => / · .* · /.test(v), start + 1);
  const parts = lineText(c, meta).split(' · ');
  const date = findLine(c, v => /^\d{4}-\d{2}-\d{2}$/.test(v), start, start + 8);
  const d = findLine(c, v => v === '职责描述', start), r = findLine(c, v => v === '任职要求', start);
  const closure = findLine(c, v => v === '工作地点', r ?? start);
  const end = (closure ?? Math.max(...c.lines.keys()) + 1) - 1;
  const job = makeJob(c, { title_line: start, title: lineText(c, start).replace(/ 薪资面议$/, ''), end_line: end,
    company, is_detail: true,
    location: meta == null ? null : { value: parts[0], range: [meta, meta] },
    education: parts[1] ? { value: parts[1], range: [meta, meta] } : null,
    salary_raw: { value: '薪资面议', range: [start, start] },
    page_date_raw: date == null ? null : { value: lineText(c, date), range: [date, date] },
    description_range: d != null && r > d ? trimRange(c, d + 1, r - 1) : null,
    requirements_range: r != null ? trimRange(c, r + 1, end) : null, sections_closed: closure != null });
  job.native_id = lineText(c, number).replace('机会编号：', '');
  job.field_evidence.native_id = rangeEvidence(c, [number, number], job.native_id);
  job.company_identity_status = company ? 'page_organization_path_not_legal_employer' : 'unknown_no_page_claim';
  job.page_date_semantics = 'unlabelled_page_date_not_assumed_publication';
  return { jobs: [job], status: 'detail_extracted_not_live_hiring_verified' };
}

function citationLink(c, n, token) {
  const m = token.match(/cite(\d+)†([^]+)/);
  const [label, ...tail] = m[2].split('†'), url = tail.map(validUrl).find(Boolean) ?? null;
  return { link_id: Number(m[1]), ref_id: c.ref_id, label_raw: label, url,
    url_status: url ? 'literal_url' : 'not_exposed_linkid_only', admission_status: admission(url),
    evidence: rangeEvidence(c, [n, n], m[0]) };
}

function zhaopin(c) {
  const start = findLine(c, v => /^# \S/.test(v));
  const similar = findLine(c, v => v === '### 相似职位');
  if (start == null || similar == null) return { jobs: [], status: 'pending_format_review' };
  const d = findLine(c, v => v === '工作职责', start, similar - 1);
  const r = findLine(c, v => v === '任职要求', d ?? start, similar - 1);
  const closure = findLine(c, v => v === '### 工作地点', r ?? start, similar - 1);
  const companyHead = findLine(c, v => v === '### 公司信息', start, similar - 1);
  const companyLine = companyHead == null ? null : findLine(c, v => /^cite\d+†[^†]+$/.test(v), companyHead + 1, similar - 1);
  const company = companyLine == null ? null : { value: textOnly(lineText(c, companyLine)), range: [companyLine, companyLine] };
  const locLine = findLine(c, v => /^\s*\* cite\d+†[^†]+/.test(v), start, d ?? similar - 1);
  const city = lineText(c, locLine).match(/cite\d+†([^†]+)/)?.[1];
  const educationLine = findLine(c, v => /^\s*\* (?:本科|大专|硕士|博士|高中)(?:及以上)?$/.test(v), start, d ?? similar - 1);
  const job = makeJob(c, { title_line: start, end_line: similar - 1, company, is_detail: true, source_kind: 'third_party_job_detail',
    location: city ? { value: city, range: [locLine, locLine] } : null,
    education: educationLine == null ? null : { value: titleOnly(lineText(c, educationLine)), range: [educationLine, educationLine] },
    description_range: d != null && r > d ? trimRange(c, d + 1, r - 1) : null,
    requirements_range: r != null && closure != null ? trimRange(c, r + 1, closure - 1) : null,
    sections_closed: closure != null });
  const masked = findLine(c, v => v.includes('查看薪资'), start, d ?? similar - 1);
  if (masked != null) job.salary_unavailable_evidence = rangeEvidence(c, [masked, masked]);
  job.company_identity_status = company ? 'third_party_employer_display_claim_not_legal_verification' : 'unknown_no_page_claim';
  const jobs = [job];
  const end = findLine(c, v => v === '最新招聘', similar + 1) ?? Math.max(...c.lines.keys()) + 1;
  const cards = rows(c).filter(([n, v]) => n > similar && n < end
    && /^cite\d+†[^]+\s+[^]+\s+cite\d+†[^]+$/.test(v));
  for (let i = 0; i < cards.length; i++) {
    const [n, v] = cards[i], parts = [...v.matchAll(/cite\d+†[^]+/g)];
    const roleLink = citationLink(c, n, parts[0][0]), employerLink = citationLink(c, n, parts[1][0]);
    const salary = v.slice(parts[0].index + parts[0][0].length, parts[1].index).trim();
    const last = (cards[i + 1]?.[0] ?? end) - 1;
    const record = makeJob(c, { title_line: n, title: roleLink.label_raw, end_line: last,
      company: { value: employerLink.label_raw, range: [n, n] },
      salary_raw: salary ? { value: salary, range: [n, n] } : null,
      description_summary_range: trimRange(c, n + 1, last), detail_links: [roleLink],
      observation_kind: 'similar_list_only', source_kind: 'third_party_similar_job_list' });
    record.company_links = [employerLink];
    record.company_identity_status = 'third_party_card_employer_display_claim_not_legal_verification';
    jobs.push(record);
  }
  return { jobs, status: 'primary_detail_and_separate_similar_list_only', primary_block_line_range: [start, similar - 1],
    similar_block_line_range: [similar, end - 1] };
}

function inequal(c) {
  const start = findLine(c, v => v === 'OPEN ROLES'), end = findLine(c, v => v === '项目矩阵');
  if (start == null || end == null) return { jobs: [], status: 'pending_format_review' };
  const company = companyClaim(c, '北京不等式科技有限公司', v => /^©/.test(v));
  const jobs = [];
  for (const [n, v] of rows(c).filter(([n]) => n > start && n < end)) {
    const token = v.match(/cite\d+†[^]+/)?.[0];
    if (!token) continue;
    const link = citationLink(c, n, token);
    const m = link.label_raw.match(/^(.+?)(?: 急聘)? (?:Engineering|Sales) · (.+?) · 全职 · /);
    if (!m) continue;
    const job = makeJob(c, { title_line: n, title: m[1], end_line: n, company,
      location: { value: m[2], range: [n, n] }, detail_links: [link] });
    job.hiring_statement_evidence = rangeEvidence(c, [13, 13]);
    jobs.push(job);
  }
  return { jobs, status: 'title_list_partial' };
}

export function parseCapture(c) {
  if (!['open', 'click'].includes(c.operation)) return { jobs: [], status: 'unsupported_operation_pending' };
  if (typeof c.result !== 'string') return { jobs: [], status: 'pending_result_string' };
  if (c.parse_error) return { jobs: [], status: 'line_parse_error', reason: c.parse_error };
  if (/^Internal Error|^Error\b/.test(c.header) || /(?:^|\n)L0:.*(?:Failed to fetch|Timeout|non-retryable)/i.test(c.result)) {
    return { jobs: [], status: /429|403|401|captcha|access denied/i.test(c.result) ? 'access_restricted'
      : /timeout/i.test(c.result) ? 'fetch_timeout_no_retry' : 'fetch_failed' };
  }
  if (!c.lines.size) return { jobs: [], status: 'no_numbered_lines_pending' };
  if (!c.source_url) return { jobs: [], status: 'source_url_unknown_pending' };
  const u = new URL(c.source_url), path = u.pathname.replace(/\/$/, '');
  try {
    const spec = extraSpecs.find(s => s.capture_id === c.id && s.source_url === c.source_url);
    if (spec) {
      assert.equal(spec.evidence_sha256, c.evidence_sha256, 'EXTRA_SPEC_SOURCE_CHANGED');
      const jobs = spec.jobs.map(item => ({ ...makeJob(c, { ...item, preserve_title_link: true, company: item.company ?? spec.company }),
        industry: spec.industry_range ? spec.industry ?? null : null,
        industry_evidence: spec.industry_range ? rangeEvidence(c, spec.industry_range) : null,
        industry_status: spec.industry_range ? 'source_derived_category_not_market_rank' : 'unknown',
        ...(item.attention ? { attention: item.attention } : {}) }));
      return { jobs, status: spec.status ?? 'reviewed_page_ranges_not_site_complete', reason: spec.reason ?? null };
    }
    if (u.hostname === 'www.qingcloud.com' && path === '/jobs') return qingcloud(c);
    if (u.hostname === 'www.qingcloud.com' && path.startsWith('/jobs/')) return siteDetail(c, 'qingcloud');
    if (u.hostname === 'www.digitforce.com' && path === '/jobs') return digitforce(c);
    if (u.hostname === 'www.digitforce.com' && /^\/jobinfo\/\d+$/.test(path)) return siteDetail(c, 'digitforce');
    if (u.hostname === 'www.noumena.com.cn' && path === '/career') return noumena(c);
    if (u.hostname === 'www.hegongsoft.com' && path === '/about/joinus') return hegong(c);
    if (u.hostname === 'www.yonchang.cn' && path === '/Contact/hr') return yonchang(c);
    if (u.hostname === 'maker.haier.net' && path.startsWith('/client/job/detail/')) return haier(c);
    if (u.hostname === 'www.zhaopin.com' && path.startsWith('/jobdetail/')) return zhaopin(c);
    if (u.hostname === 'in-equal.com' && path === '/careers') return inequal(c);
  } catch (e) { return { jobs: [], status: 'field_binding_error', reason: e.message }; }
  return { jobs: [], status: 'pending_format_review', reason: 'No reviewed offline parser for this URL/template; raw retained for the next format review.' };
}

function validate(jobs, captures) {
  const byFile = new Map(captures.map(c => [c.evidence_file, c]));
  let checked = 0, quoteChecks = 0;
  function checkQuotedEvidence(value) {
    if (!value || typeof value !== 'object') return;
    if (value.quote_sha256) {
      const c = byFile.get(value.evidence_file);
      assert(c && c.evidence_sha256 === value.evidence_sha256);
      assert.equal(value.quote_sha256, sha(value.quote));
      assert.equal(value.quote, value.line_range ? captureRange(c.lines, value.line_range) : c.header);
      quoteChecks++;
    }
    for (const nested of Object.values(value)) if (nested && typeof nested === 'object') checkQuotedEvidence(nested);
  }
  assert.equal(new Set(jobs.map(j => j.id)).size, jobs.length);
  for (const job of jobs) {
    checkQuotedEvidence(job);
    for (const [field, evidence] of Object.entries(job.field_evidence)) {
      if (job[field] != null && field !== 'hiring_active') assert(evidence, `MISSING_FIELD_EVIDENCE:${job.id}:${field}`);
      if (!evidence) continue;
      const c = byFile.get(evidence.evidence_file);
      assert(c && c.evidence_sha256 === evidence.evidence_sha256);
      const quote = evidence.line_range ? captureRange(c.lines, evidence.line_range) : evidence.locator === 'result_header' ? c.header : null;
      if (quote != null) {
        assert.equal(evidence.quote, quote); assert.equal(evidence.quote_sha256, sha(quote));
        if (evidence.value_char_range) assert.equal(quote.slice(...evidence.value_char_range), job[field]);
      } else assert.equal(evidence.value, c.observed_at);
      checked++;
    }
    for (const link of job.detail_links) assert.equal(captureRange(byFile.get(link.evidence.evidence_file).lines, link.evidence.line_range), link.evidence.quote);
    assert.equal(job.employer_legal_entity, null);
    assert.equal(job.salary_fixed_base_confirmed, false);
    assert.equal(job.hiring_active, 'unknown');
    if (job.description_complete) assert(job.description && job.requirements && job.field_evidence.description && job.field_evidence.requirements);
  }
  return { field_evidence_checks: checked, nested_quote_sha_checks: quoteChecks, all_passed: true };
}

function captureAttempt(c, index) {
  const click = c.request.click[index];
  const failureUrl = lineText(c, 0).match(/Failed to fetch (https?:\/\/\S+?)(?=: |$)/)?.[1] ?? null;
  return { capture_id: c.id, source_ref_id: click.ref_id, source_link_id: click.id,
    response_url: c.source_url, attempted_url: c.source_url ?? failureUrl,
    status: parseCapture(c).status, retry_allowed: false,
    request_evidence: { evidence_file: c.evidence_file, evidence_sha256: c.evidence_sha256,
      json_pointer: `/request/click/${index}`, value: click },
    response_evidence: c.source_url ? headerEvidence(c, c.source_url) : c.lines.has(0) ? rangeEvidence(c, [0, 0]) : null };
}

function consolidate(observations, captures) {
  const clicks = new Map();
  for (const c of captures) for (let i = 0; i < (c.request?.click?.length ?? 0); i++) {
    const attempt = captureAttempt(c, i), key = `${attempt.source_ref_id}:${attempt.source_link_id}`;
    if (!clicks.has(key)) clicks.set(key, []);
    clicks.get(key).push(attempt);
  }
  const groups = new Map();
  for (const record of observations) {
    const resolutions = record.detail_links.map(link => {
      const attempts = clicks.get(`${link.ref_id}:${link.link_id}`) ?? [];
      const urls = [...new Set([link.url, ...attempts.map(a => a.response_url)].filter(Boolean))];
      const sameSource = urls.filter(url => new URL(url).hostname === new URL(record.source_url).hostname);
      return { ref_id: link.ref_id, link_id: link.link_id, attempts,
        resolved_url: urls.length === 1 && sameSource.length === 1 ? urls[0] : null,
        status: urls.length > 1 ? 'conflicting_urls_pending' : urls.length && !sameSource.length ? 'cross_source_link_pending'
          : urls.length ? 'observed_response_header_url' : attempts.length ? 'attempt_failed_no_retry' : 'not_read' };
    });
    const resolvedUrls = [...new Set(resolutions.map(r => r.resolved_url).filter(Boolean))];
    const direct = record.observation_kind === 'main_detail' ? record.job_url : record.job_url ?? (resolvedUrls.length === 1 ? resolvedUrls[0] : null);
    const firstLink = record.detail_links[0];
    const identityKey = direct ? `native_url:${direct}` : firstLink ? `native_link:${firstLink.ref_id}:${firstLink.link_id}`
      : `page_slot:${record.source_url}:${record.field_evidence.title.line_range[0]}:${record.title}`;
    record.link_resolutions = resolutions;
    if (!groups.has(identityKey)) groups.set(identityKey, []);
    groups.get(identityKey).push(record);
  }
  const jobs = [];
  for (const [identityKey, records] of groups) {
    const sorted = [...records].sort((a, b) => Number(b.description_complete) - Number(a.description_complete)
      || Number(b.observation_kind === 'main_detail') - Number(a.observation_kind === 'main_detail') || a.id.localeCompare(b.id));
    const representative = sorted[0];
    const fields = ['title', 'company', 'location', 'salary_raw', 'published_at'];
    const conflicts = fields.flatMap(field => {
      const variants = [...new Set(records.map(r => r[field]).filter(v => v != null))];
      return variants.length > 1 ? [{ field, values: variants, status: 'source_values_differ_not_silently_normalized' }] : [];
    });
    jobs.push({ ...representative, id: `job:${sha(identityKey).slice(0, 24)}`, identity_key: identityKey,
      identity_basis: identityKey.split(':')[0], representative_observation_id: representative.id,
      report_scope: records.every(r => r.observation_kind === 'similar_list_only') ? 'similar_list_only' : 'main',
      observation_ids: records.map(r => r.id), observations: records,
      field_conflicts: [...records.flatMap(r => r.field_conflicts ?? []), ...conflicts],
      identity_note: 'Only exact response URL, captured ref/link mapping or a page slot. No title/company fuzzy merge or legal-entity deduplication.' });
  }
  return jobs.sort((a, b) => a.identity_key < b.identity_key ? -1 : a.identity_key > b.identity_key ? 1 : 0);
}

export function extract(captures, inputFiles = captures.map(c => c.file)) {
  const observations = [], files = [], items = [];
  for (const c of captures) {
    const parsed = parseCapture(c);
    observations.push(...parsed.jobs);
    files.push({ capture_id: c.id, source_url: c.source_url, request: c.request, query_target_company: c.query_target_company,
      evidence_file: c.evidence_file, evidence_sha256: c.evidence_sha256, result_sha256: c.result_sha256,
      observed_at: c.observed_at, available_line_count: c.lines.size, reported_total_lines: c.reported_total_lines,
      status: parsed.status, reason: parsed.reason ?? null, extracted_jobs: parsed.jobs.length,
      complete_jds: parsed.jobs.filter(j => j.description_complete).length, source_scope_complete: false,
      primary_block_line_range: parsed.primary_block_line_range ?? null,
      similar_block_line_range: parsed.similar_block_line_range ?? null });
    const companion = captures.filter(other => other.id !== c.id && c.source_url && other.source_url === c.source_url
      && parseCapture(other).jobs.length > 0).map(other => other.id);
    const entrySpec = extraSpecs.find(spec => spec.capture_id === c.id && spec.source_url === c.source_url
      && spec.evidence_sha256 === c.evidence_sha256);
    const entryLinks = (entrySpec?.entry_link_lines ?? []).flatMap(line => linksIn(c, line, line))
      .map(link => ({ ...link, target_type: 'recruiting_entry_not_job_detail' }));
    if (!parsed.jobs.length) items.push({ capture_id: c.id, kind: 'source', status: parsed.status,
      source_url: c.source_url, url: null, request: c.request, evidence_file: c.evidence_file, evidence_sha256: c.evidence_sha256,
      companion_captures_with_jobs: companion, pending: companion.length === 0,
      ...(entryLinks.length ? { source_links: entryLinks } : {}),
      retry_allowed: false, execution_authorized: false,
      reason: companion.length ? 'This observation is navigation/fragment only; jobs exist in a separate same-URL capture.'
        : parsed.reason ?? 'No visible jobs extracted; not evidence of zero vacancies.', admission_status: 'offline_review_required' });
  }
  const jobs = consolidate(observations, captures);
  for (const job of jobs.filter(j => !j.description_complete)) items.push({
    kind: 'job_detail', job_id: job.id, capture_id: job.capture_id, title: job.title, company: job.company,
    query_target_company: job.query_target_company, source_url: job.source_url, url: job.job_url,
    status: job.link_resolutions.some(r => r.status === 'attempt_failed_no_retry') ? 'attempt_failed_no_retry'
      : job.job_url ? 'partial_detail_pending' : job.detail_links.length ? 'pending_detail_read'
        : job.source_links?.length ? 'source_link_target_verification_pending' : 'detail_locator_unknown',
    reason: job.completeness_status, admission_status: job.detail_links.length || job.source_links?.length ? 'admission_required' : 'locator_required',
    links: job.detail_links, link_resolutions: job.link_resolutions, report_scope: job.report_scope,
    ...(job.source_links?.length ? { source_links: job.source_links } : {}),
    retry_allowed: false, evidence_file: job.evidence_file, evidence_sha256: job.evidence_sha256,
    field_evidence: { title: job.field_evidence.title, company: job.field_evidence.company }, execution_authorized: false,
  });
  const missing = EXPECTED.filter(id => !inputFiles.includes(id + '.json'));
  for (const id of missing) items.push({ kind: 'planned_capture', capture_id: id,
    status: id === 'o09' ? 'not_executed_batch_stopped_pending' : 'pending_not_in_input_snapshot',
    expected_file: relative(ROOT, join(DIR, 'raw', id + '.json')), source_url: null, url: null,
    retry_allowed: false, execution_authorized: false,
    reason: id === 'o09' ? 'Controller stopped the Zhaopin branch before o09 after a source timeout; no capture or zero-result claim.'
      : 'Absent in this frozen file list; no waiting or polling.',
    status_source: id === 'o09' ? 'controller_batch_stop_2026-09-22' : 'input_snapshot' });
  const validation = validate(observations, captures);
  const audit = {
    schema_version: 2, mode: 'deterministic_offline', batch: 'market-wide-2026-09-22',
    network_requests: 0, browser_operations: 0, external_actions: 0, model_calls_by_script: 0,
    requested_executor: { model: 'gpt-5.6-luna', reasoning_effort: 'medium' },
    actual_execution: {
      original_code_author: { agent_id: '01a0c4f7-d532-7643-a09a-b5530f3ca759',
        dispatch_model: 'gpt-5.6-luna', dispatch_reasoning_effort: 'medium',
        basis: 'Parent session accepted model-specific subagent dispatch; not independently verified billing telemetry.' },
      follow_up_repair_author: { actor: 'parent_codex_session', model: 'not_independently_verified',
        scope: 'Source education conflicts, execution attribution, reviewed page-range adapter and unresolved source-link preservation.' },
      runtime: 'Node.js deterministic local extraction', model_calls: 0,
      subagents_dispatched_by_script: 0, billing_model_verification: 'unknown',
      independent_review: 'See data-qa.json for separate reviewer findings and reviewed artifact hashes.' },
    input_snapshot: inputFiles, input_manifest_sha256: sha(json(captures.map(c => ({ file: c.file, sha256: c.evidence_sha256 })))),
    helper_source: '01_行情收集/official-careers/research/market-2026-09-21/build.mjs#captureLines,captureRange',
    extra_page_specification: extraSpecBytes ? { file: relative(ROOT, join(DIR,'extra-board-specs.json')), sha256: sha(extraSpecBytes) } : null,
    reviewed_templates: ['www.qingcloud.com/jobs[/role]', 'www.digitforce.com/jobs + /jobinfo/id',
      'www.noumena.com.cn/career/', 'www.hegongsoft.com/about/joinus', 'www.yonchang.cn/Contact/hr',
      'maker.haier.net/client/job/detail/', 'www.zhaopin.com/jobdetail/ primary + separate similar cards', 'in-equal.com/careers'],
    files, missing_planned_captures: missing, detail_capture_status: captures.some(c => c.id.startsWith('d')) ? 'see_files' : 'none_in_input_snapshot',
    counts: { captures: captures.length, job_observations: observations.length, jobs: jobs.length,
      main_jobs: jobs.filter(j => j.report_scope === 'main').length,
      similar_list_only_jobs: jobs.filter(j => j.report_scope === 'similar_list_only').length,
      linked_duplicate_observations: observations.length - jobs.length,
      complete_jds: jobs.filter(j => j.description_complete).length,
      incomplete_jobs: jobs.filter(j => !j.description_complete).length, company_display_names: new Set(jobs.map(j => j.company).filter(Boolean)).size,
      unknown_company_jobs: jobs.filter(j => j.company == null).length, pending_planned_captures: missing.length,
      detail_backlog_jobs: items.filter(i => i.kind === 'job_detail').length,
      main_detail_backlog_jobs: items.filter(i => i.kind === 'job_detail' && i.report_scope === 'main').length,
      similar_detail_backlog_jobs: items.filter(i => i.kind === 'job_detail' && i.report_scope === 'similar_list_only').length,
      pending_format_captures: files.filter(f => f.status === 'pending_format_review').length,
      timeout_captures: files.filter(f => f.status === 'fetch_timeout_no_retry').length },
    validation, market_scan_complete: false, entity_deduplication_claim: false,
    unknown_field_counts: Object.fromEntries(['company', 'employer_legal_entity', 'job_url', 'location', 'salary_raw',
      'salary_currency', 'salary_period', 'salary_fixed_base', 'published_at'].map(field => [field, jobs.filter(j => j[field] == null).length])),
    evidence_policy: 'Every populated field binds to numbered source text, the response URL header or observed_at metadata. Query target never proves employer. Brand/footer claims are not legal verification.',
    completeness_policy: 'Visible, bounded responsibilities AND requirements; list summaries never complete. Unknown/new templates stay pending; no source-wide completeness inferred.',
    salary_policy: 'Salary strings retained literally, including annual pay, K, yuan/wan and negotiable. Currency/period and monthly conversion remain unknown unless explicitly parsed; no fixed-base inference.',
    retention_policy: 'All visible roles in reviewed templates retained, including engineering, product, internships and customer success. No matching or ranking; per-capture observations retained.',
    job_count_policy: 'jobs.json is a canonical-job array with all source observations embedded. Main count excludes similar-list-only leads; 1 list plus 1 matched detail is 1 job. No cross-employer/title heuristic merge.',
  };
  return { jobs, audit, backlog: { schema_version: 2, offline_only: true, network_requests: 0,
    input_manifest_sha256: audit.input_manifest_sha256, items, planned_detail_capture_ids: null,
    note: 'Only source-observed URL or citation ref/link ID is supplied. No invented detail URL; later o/d templates remain pending until reviewed.' } };
}

function selfTest(captures, output) {
  assert.deepEqual(extract(captures), output, 'same frozen inputs must yield identical outputs');
  const poisoned = captures.map(c => ({ ...c, query_target_company: 'UNRELATED_QUERY_TARGET' }));
  const altered = extract(poisoned);
  assert.deepEqual(altered.jobs.map(j => j.company), output.jobs.map(j => j.company));
  assert(output.jobs.every(j => j.company !== 'UNRELATED_QUERY_TARGET'));
  const q = captures.find(c => c.id === 'o01b'), d = captures.find(c => c.id === 'o02');
  const n = captures.find(c => c.id === 'o03'), h = captures.find(c => c.id === 'o04');
  if (q) {
    const jobs = parseCapture(q).jobs; assert.equal(jobs.length, 11);
    assert(jobs.every(j => !j.description_complete && !j.job_url && j.detail_links.length === 1));
    assert.deepEqual(jobs.map(j => j.detail_links[0].link_id), Array.from({ length: 11 }, (_, i) => i + 151));
  }
  if (d) { const jobs = parseCapture(d).jobs; assert.equal(jobs.length, 13); assert(jobs.every(j => !j.description_complete && j.description_summary)); }
  if (n) {
    const jobs = parseCapture(n).jobs; assert.equal(jobs.length, 9); assert(jobs.every(j => j.description_complete));
    assert.equal(jobs.find(j => j.title === '出海商业化 BD 负责人').location, '深圳 / 广州 / 上海');
    assert(jobs.some(j => j.title === 'AI 产品经理 / AI 产品专家'));
    const cut = { ...n, lines: new Map(rows(n).filter(([line]) => line < 211)) };
    assert.equal(parseCapture(cut).jobs.at(-1).description_complete, false, 'truncated requirements cannot pass');
    const unbound = { ...n, lines: new Map(n.lines) }; unbound.lines.set(6, '');
    assert(parseCapture(unbound).jobs.every(j => j.company === null), 'missing page identity must stay unknown');
  }
  if (h) {
    const jobs = parseCapture(h).jobs; assert.equal(jobs.length, 12);
    assert(jobs.every(j => j.description_complete && j.published_at));
    const conflicts = jobs.filter(j => j.field_conflicts?.length);
    assert.equal(conflicts.length, 5);
    assert(conflicts.every(j => j.education === '本科' && j.attention && j.field_conflicts[0].evidence.length === 2));
    assert.equal(output.jobs.filter(j => j.field_conflicts.some(f => f.field === 'education')).length, 5);
  }
  const y = captures.find(c => c.id === 'o05');
  if (y) {
    const jobs = parseCapture(y).jobs;
    assert.equal(jobs.length, 10); assert(jobs.every(j => j.description_complete));
    assert(jobs.every(j => j.location === null && j.salary_fixed_base === null && j.salary_monthly_upper_cny === null));
    assert.equal(jobs.filter(j => j.salary_raw).length, 6);
  }
  const z = captures.find(c => c.id === 'o07');
  if (z) {
    const parsed = parseCapture(z), primary = parsed.jobs[0], related = parsed.jobs.slice(1);
    assert.equal(related.length, 36); assert.equal(primary.company, '东风汽车');
    assert.equal(primary.location, '成都'); assert.equal(primary.salary_raw, null); assert(primary.description_complete);
    assert.deepEqual(primary.field_evidence.description.line_range, [51, 64]);
    assert.deepEqual(primary.field_evidence.requirements.line_range, [66, 70]);
    assert(related.every(j => j.company !== primary.company && j.location === null && j.published_at === null
      && j.description === null && j.requirements === null && !j.description_complete && j.detail_links.length === 1));
    assert(related.every(j => j.field_evidence.company.line_range[0] >= 121 && j.company_links.length === 1));
    const contaminated = { ...z, lines: new Map(rows(z).map(([n, v]) => [n, n > 117 ? v.replace(/\d+(?:\.\d+)?-\d+(?:\.\d+)?万/g, '999-9999万') : v])) };
    assert.deepEqual(parseCapture(contaminated).jobs[0], primary, 'similar cards must not affect any primary field');
  }
  for (const c of captures.filter(c => /^d0[1-5]tail$/.test(c.id) || /^d0[78]$/.test(c.id))) {
    const jobs = parseCapture(c).jobs; assert.equal(jobs.length, 1); assert(jobs[0].description_complete);
    assert.equal(jobs[0].job_url, c.source_url);
    if (c.id.includes('tail')) assert(jobs[0].field_evidence.description.line_range[0] > 747);
    const r = jobs[0].field_evidence.requirements.line_range;
    const cut = { ...c, lines: new Map(rows(c).filter(([n]) => n < r[1])) };
    assert.equal(parseCapture(cut).jobs[0]?.description_complete, false);
  }
  for (const c of captures.filter(c => /^d0[1-5]$/.test(c.id))) {
    assert.equal(parseCapture(c).jobs.length, 0, 'navigation is not a job');
  }
  for (const c of captures.filter(c => ['d06', 'd09', 'o08'].includes(c.id))) {
    assert.equal(parseCapture(c).status, 'fetch_timeout_no_retry'); assert.equal(parseCapture(c).jobs.length, 0);
  }
  for (const [id, expected] of [['o01b', 11], ['o02', 13]]) if (captures.some(c => c.id === id)) {
    assert.equal(output.jobs.filter(j => j.observations.some(o => o.capture_id === id)).length, expected);
  }
  assert.equal(output.jobs.flatMap(j => j.observations).length, output.audit.counts.job_observations);
  assert.equal(new Set(output.jobs.map(j => j.identity_key)).size, output.jobs.length);
  assert(output.jobs.every(j => j.report_scope !== 'similar_list_only' || !j.description_complete));
  const completeFromLists = output.jobs.filter(j => j.description_complete && j.observations.some(o => o.observation_kind === 'main_list'));
  assert(completeFromLists.every(j => j.observations.some(o => o.job_url === j.job_url)
    && j.observations.some(o => o.link_resolutions.some(r => r.resolved_url === j.job_url))));
  if (captures.length) {
    const unknown = { ...captures[0], source_url: 'https://example.invalid/unreviewed' };
    assert.equal(parseCapture(unknown).status, 'pending_format_review');
  }
  return { deterministic_rebuild: true, query_target_never_employer: true, title_list_not_jd: true,
    detail_link_ids_bound: true, noncommercial_retained: true, truncated_sections_incomplete: true,
    missing_company_unknown: true, unknown_templates_pending: true, all_field_sha_quotes_checked: true,
    similar_cards_isolated: true, navigation_not_jd: true, header_detail_url_preserved: true,
    list_detail_native_link_dedup: true, unknown_salary_not_base: true, timeout_not_empty_or_retried: true };
}

export async function build({ selectedFiles = null, checkOnly = false } = {}) {
  const files = (selectedFiles ?? (await readdir(join(DIR, 'raw'))).filter(f => filePattern.test(f))).slice().sort();
  assert(files.every(f => filePattern.test(f)), 'Only raw/o* or raw/d* filenames accepted');
  const captures = [];
  for (const file of files) captures.push(decodeCapture(file, await readFile(join(DIR, 'raw', file))));
  const output = extract(captures, files);
  output.audit.self_test = selfTest(captures, output);
  // Freeze one directory listing and verify only its files. New captures belong to the next run.
  for (const c of captures) assert.equal(sha(await readFile(join(DIR, 'raw', c.file))), c.evidence_sha256, `INPUT_CHANGED:${c.file}`);
  if (!checkOnly) {
    await writeFile(join(DIR, 'jobs.json'), json(output.jobs));
    await writeFile(join(DIR, 'extraction-audit.json'), json(output.audit));
    await writeFile(join(DIR, 'detail-backlog.json'), json(output.backlog));
  }
  return output;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const flag = process.argv.indexOf('--files');
  const selectedFiles = flag < 0 ? null : process.argv[flag + 1]?.split(',');
  build({ selectedFiles, checkOnly: process.argv.includes('--self-test') }).then(({ audit }) => {
    console.log(json({ counts: audit.counts, files: audit.files.map(f => ({ capture_id: f.capture_id, status: f.status, jobs: f.extracted_jobs })),
      missing_planned_captures: audit.missing_planned_captures, validation: audit.validation, self_test: audit.self_test ?? null }));
  }).catch(error => { console.error(error); process.exitCode = 1; });
}
