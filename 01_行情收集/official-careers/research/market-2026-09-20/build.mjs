#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)));
const RAW = join(ROOT, 'raw');
const OUT = ROOT;
const EXECUTION = { executor: 'gpt-5.6-luna', reasoning_effort: 'medium', role: 'offline batch extraction', network_requests: 0, browser_requests: 0 };

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const text = value => String(value ?? '').trim();
const json = value => JSON.stringify(value, null, 2) + '\n';
const evidenceFile = name => relative(resolve(process.cwd()), join(RAW, name));

function parseUrl(raw, file, lineNo, audit) {
  try {
    const url = new URL(raw);
    const allowed = /^https?:$/.test(url.protocol) && /(^|\.)liepin\.com$/.test(url.hostname) && /^\/(?:a|job)\/\d+\.shtml$/.test(url.pathname);
    if (!allowed) audit.excluded_links.push({ file, line: lineNo, url: raw, reason: 'non-job link' });
    return allowed ? url : null;
  } catch {
    audit.excluded_links.push({ file, line: lineNo, url: raw, reason: 'invalid URL' });
    return null;
  }
}

function genericValue(line) {
  const quoted = line.match(/^\s*- generic(?: \"([^\"]*)\")?: (.*)$/);
  return quoted ? text(quoted[2] || quoted[1]) : text(line.replace(/^\s*- generic:?\s*/, ''));
}

function parseJobLink(line) {
  const m = line.match(/^\s*- link \"([^\"]*)\":$/);
  return m ? m[1] : null;
}

function parseCard(lines, i, file, digest, observedAt, audit) {
  const label = parseJobLink(lines[i]);
  const urlLine = lines[i + 1] || '';
  const rawUrl = urlLine.match(/^\s*- \/url: (.+)$/)?.[1];
  const url = rawUrl ? parseUrl(rawUrl, file, i + 1, audit) : null;
  if (!label || !url) return null;
  const title = genericValue(lines[i + 2] || '').replace(/^招聘/, '');
  const location = genericValue(lines[i + 4] || '');
  const salary = genericValue(lines[i + 6] || '');
  const experience = genericValue(lines[i + 7] || '');
  const education = genericValue(lines[i + 8] || '');
  const company = genericValue(lines[i + 9] || '');
  const companyTags = genericValue(lines[i + 10] || '');
  const feedLabel = genericValue(lines[i + 11] || '');
  const recruiter = genericValue(lines[i + 12] || '');
  const online = genericValue(lines[i + 13] || '');
  const jobId = url.searchParams.get('job_id');
  const pathId = url.pathname.match(/\/(\d+)\.shtml$/)?.[1] || null;
  const nativeId = jobId || pathId;
  const quote = lines.slice(i, i + 14).join('\n');
  const source = { evidence_file: evidenceFile(file), sha256: digest, quote, source_chunk: { start_line: i + 1, end_line: i + 14 } };
  const id = `liepin:${nativeId || pathId || `card-${i + 1}`}`;
  return {
    id,
    observation_key: `${id}:card-${i + 1}`,
    native_id: nativeId,
    url_path_id: pathId,
    source: 'liepin',
    company,
    company_is_anonymous: /^某/.test(company),
    title,
    location,
    city: location.split('-')[0] || location,
    salary_raw: salary || null,
    salary_upper_monthly_cny: salary.match(/(\d+(?:\.\d+)?)\s*[-至]\s*(\d+(?:\.\d+)?)\s*k/i)?.[2] ? Number(salary.match(/(\d+(?:\.\d+)?)\s*[-至]\s*(\d+(?:\.\d+)?)\s*k/i)[2]) * 1000 : null,
    salary_eligible_upper_ge_20k: Boolean(salary.match(/(\d+(?:\.\d+)?)\s*[-至]\s*(\d+(?:\.\d+)?)\s*k/i)?.[2] && Number(salary.match(/(\d+(?:\.\d+)?)\s*[-至]\s*(\d+(?:\.\d+)?)\s*k/i)[2]) >= 20),
    experience_raw: experience || null,
    education_raw: education || null,
    job_url: url.href,
    source_url: url.href,
    channel: '猎聘推荐职位列表',
    source_kind: 'authenticated_recommendation_card',
    industry: null,
    industry_status: 'unknown_not_derived_from_search_or_recommendation',
    company_tags_raw: companyTags || null,
    recommendation_reason_raw: feedLabel || null,
    recruiter_raw: recruiter || null,
    recruiter_status_raw: online || null,
    description: null,
    requirements: null,
    description_complete: false,
    observed_at: observedAt,
    publication_date: null,
    time_note: '当前观察时间来自可见推荐列表；卡片未提供职位发布日期。',
    scope_note: '仅保留可见卡片字段；非完整JD；原始观察保留，未声明推荐列表穷尽。',
    evidence_file: source.evidence_file,
    evidence_sha256: source.sha256,
    evidence_quote: source.quote,
    evidence: [source],
    raw_variant_key: `${nativeId || pathId || 'unknown'}|${company}|${title}|${location}|${salary}|${recruiter}`,
    display_excluded: /产品经理|客户成功/.test(title),
    display_exclusion_reason: /产品经理|客户成功/.test(title) ? 'display_only_exclusion' : null,
    execution: EXECUTION
  };
}

function parseCapture(name, rawBytes, audit) {
  const capture = JSON.parse(rawBytes.toString('utf8'));
  const digest = sha256(rawBytes);
  const result = typeof capture.result === 'string' ? capture.result : text(capture.structuredContent);
  const lines = result.split('\n');
  const jobs = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/^\s*- link \".+\":$/.test(lines[i])) continue;
    const job = parseCard(lines, i, name, digest, capture.observed_at || capture.started_at || null, audit);
    if (job) jobs.push(job);
  }
  audit.captures.push({ file: evidenceFile(name), id: capture.id, platform: capture.request?.platform || null, kind: capture.kind || null, sha256: digest, observed_at: capture.observed_at || null, bytes: rawBytes.length, result_nonempty: Boolean(result), jobs_extracted: jobs.length, export_unavailable: capture.export_unavailable === true, action_error: capture.action_error || null });
  return jobs;
}

function reviewedSourceSpecs(name, rawBytes) {
  const capture = JSON.parse(rawBytes.toString('utf8'));
  if (!['search', 'open'].includes(capture.operation) || capture.kind !== 'web_tool_result_not_raw_http') return [];
  const value = typeof capture.result === 'string' ? capture.result : typeof capture.structuredContent === 'string' ? capture.structuredContent : '';
  if (!value) return [];
  return value.split(/\n-{8,}\n/).map(chunk => {
    const first = chunk.match(/^([^\n]+?) \((https?:\/\/[^)]+)\)/);
    if (!first) return null;
    const heading = chunk.match(/^#\s+([^\n]+)/m)?.[1] || null;
    const title = heading || first[1].trim();
    const companyLine = chunk.match(/(?:^|\n)(?:[^\n#|]+?)\s+-\s+([^\n|]+?)\s*\|/m)?.[1]?.trim() || null;
    const companyQuote = companyLine ? companyLine : null;
    return {
      source_file: evidenceFile(name),
      source_sha256: sha256(rawBytes),
      source_url: first[2],
      title_quote: first[1].trim(),
      title,
      company_quote: companyQuote,
      source_chunk_quote: chunk.slice(0, 1200),
      extraction_status: 'review_input_only',
      reason: 'web_tool_result_not_raw_http; no job emitted without a source-bound, well-defined job record',
      observed_at: capture.observed_at || capture.started_at || null,
      execution: EXECUTION
    };
  }).filter(Boolean);
}

function makeCompanies(jobs) {
  const groups = new Map();
  for (const job of jobs) {
    const key = job.company_is_anonymous ? `${job.source}:anonymous:${job.native_id || job.observation_key}` : `${job.source}:company:${job.company}`;
    if (!groups.has(key)) groups.set(key, { company_key: key, company: job.company, anonymous: job.company_is_anonymous, industry: null, industry_status: 'unknown_not_derived_from_search_or_recommendation', company_tags_raw: [], observation_ids: [], recruiter_variants: [], evidence: [] });
    const group = groups.get(key);
    if (job.company_tags_raw && !group.company_tags_raw.includes(job.company_tags_raw)) group.company_tags_raw.push(job.company_tags_raw);
    group.observation_ids.push(job.observation_key);
    if (job.recruiter_raw && !group.recruiter_variants.includes(job.recruiter_raw)) group.recruiter_variants.push(job.recruiter_raw);
    group.evidence.push({ evidence_file: job.evidence_file, sha256: job.evidence_sha256, quote: job.evidence_quote });
  }
  return [...groups.values()].sort((a, b) => a.company_key.localeCompare(b.company_key));
}

async function main() {
  const audit = { schema_version: 1, run_id: 'market-2026-09-20', deterministic: true, network_requests: 0, browser_requests: 0, execution: EXECUTION, captures: [], excluded_links: [], hash_verification: [], reviewed_source_specs: [], counts: {} };
  const files = (await import('node:fs/promises')).readdir(RAW).then(xs => xs.filter(x => x.endsWith('.json')).sort());
  const jobs = [];
  for (const name of await files) {
    const bytes = await readFile(join(RAW, name), { encoding: null });
    jobs.push(...parseCapture(name, bytes, audit));
    audit.reviewed_source_specs.push(...reviewedSourceSpecs(name, bytes));
  }
  const seen = new Set();
  const dedup = [];
  for (const job of jobs) {
    const exact = `${job.source}|${job.native_id}|${job.company}|${job.title}|${job.location}|${job.salary_raw}|${job.recruiter_raw}`;
    job.exact_duplicate_key = exact;
    job.exact_duplicate = seen.has(exact);
    seen.add(exact);
    dedup.push(job);
  }
  audit.counts = { captures: audit.captures.length, raw_job_cards: jobs.length, jobs_output: dedup.length, companies_output: makeCompanies(dedup).length, reviewed_source_specs: audit.reviewed_source_specs.length, excluded_links: audit.excluded_links.length, blank_or_failed_captures: audit.captures.filter(x => !x.result_nonempty || x.export_unavailable || x.action_error).length, complete_jd: dedup.filter(x => x.description_complete).length, display_excluded: dedup.filter(x => x.display_excluded).length };
  for (const capture of audit.captures) audit.hash_verification.push({ evidence_file: capture.file, sha256: capture.sha256, verified_from_original_bytes: true });
  await mkdir(OUT, { recursive: true });
  await writeFile(join(OUT, 'jobs.json'), json(dedup));
  await writeFile(join(OUT, 'companies.json'), json(makeCompanies(dedup)));
  await writeFile(join(OUT, 'extraction-specs.json'), json(audit.reviewed_source_specs));
  await writeFile(join(OUT, 'extraction-audit.json'), json(audit));
  console.log(JSON.stringify(audit.counts));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();

export { parseCapture, makeCompanies, sha256 };
