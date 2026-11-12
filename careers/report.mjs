import { mkdir, writeFile, rename } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { randomUUID } from 'node:crypto';
import { REPORT_DIR, DB_PATH, repoRelative, evidenceAbsolute, assertId } from './paths.mjs';

export function reportPaths(runId) {
  assertId(runId);
  return { database: repoRelative(DB_PATH), report_json: repoRelative(join(REPORT_DIR, `${runId}.json`)),
    report_markdown: repoRelative(join(REPORT_DIR, `${runId}.md`)) };
}

export function safeText(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/[\\`*_{}[\]()#+.!|~]/g, '\\$&').replace(/[\r\n]/g, ' ');
}

export function safeWebLink(label, value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return safeText(label);
    return `[${safeText(label)}](${url.href.replace(/[()<>]/g, (char) => encodeURIComponent(char))})`;
  } catch { return safeText(label); }
}

function localLink(label, repoPath) {
  const absolute = evidenceAbsolute(repoPath);
  const target = relative(REPORT_DIR, absolute).split('/').map((part) => encodeURIComponent(part)).join('/');
  return `[${safeText(label)}](${target})`;
}

function literalBlock(text) {
  // An indented block keeps untrusted JD text inert, including backticks and HTML.
  return String(text).split(/\r?\n/).map((line) => `    ${line}`).join('\n');
}

export function renderReport(run) {
  const lines = [
    '# Official Careers Source Capture', '',
    `Run: ${safeText(run.run_id)}`, '',
    `Company: ${safeText(run.company_name)} | Source: ${safeText(run.source_id)} | Provider: ${safeText(run.provider)}`, '',
    `Status: **${safeText(run.status)}** | Complete in declared scope: **${run.complete}** | Jobs persisted: **${run.jobs.length}**`, '',
    `Collected: ${safeText(run.started_at)} to ${safeText(run.finished_at)}`, '',
    `Scope: ${safeText(run.scope.coverage)}. Query: ${safeText(run.scope.query ?? 'none')}. Company-wide completeness: ${Boolean(run.scope.company_wide)}.`, '',
    'This is an observation of a public official board, not a new-today or active-hiring claim. Missing salary stays unknown.', '',
    '## Ownership Evidence', '',
    `Verification: ${safeText(run.ownership.status)}`, '',
  ];
  for (const edge of run.ownership.chain ?? []) {
    lines.push(`${safeWebLink('Official company page', edge.from_url)} -> ${safeWebLink('Recruitment board', edge.to_url)}; ` +
      `${localLink('raw company page', edge.body_path)}; ${localLink('response proof', edge.metadata_path)}.`, '',
      `Company identity: ${safeText(edge.legal_name)}. Observed link text: ${safeText(edge.links?.[0]?.text ?? '')}. Verified: ${safeText(edge.verified_at)}.`, '');
  }
  lines.push('## Jobs', '', '| Source Job ID | Title | Location | Source publication date | Salary | Hiring active |',
    '| --- | --- | --- | --- | --- | --- |');
  for (const job of run.jobs) {
    lines.push(`| ${safeText(job.source_job_id)} | ${safeWebLink(job.title, job.job_url)} | ${safeText(job.location_raw ?? 'unknown')} | ` +
      `${safeText(job.published_at ?? 'unknown')} | ${safeText(job.salary_raw ?? 'unknown / not disclosed')} | ${safeText(job.hiring_active)} |`);
  }
  lines.push('', '## Full Descriptions', '');
  for (const job of run.jobs) {
    lines.push(`### ${safeText(job.source_job_id)}: ${safeText(job.title)}`, '',
      `First seen: ${safeText(job.first_seen_at)}. Last seen: ${safeText(job.last_seen_at)}. ` +
      `Source publication: ${safeText(job.published_at_raw ?? 'unknown')}; precision: ${safeText(job.published_at_precision ?? 'unknown')}; timezone: ${safeText(job.published_at_timezone ?? 'unknown')}.`, '',
      `Source createTime: ${safeText(job.source_created_at_raw ?? 'unknown')}; source updateTime: ${safeText(job.source_updated_at_raw ?? 'unknown')}. ` +
      'These original timestamps are not collection times.', '',
      `${localLink('Raw full-JD page', job.body_path)} | ${localLink('HTTP metadata', job.metadata_path)} | Native job ID: ${safeText(job.source_job_id)}`, '',
      literalBlock(job.description_text), '');
  }
  lines.push('## Requests', '', '| Time (UTC) | Method | URL | HTTP | Evidence |', '| --- | --- | --- | --- | --- |');
  for (const item of run.evidence) {
    lines.push(`| ${safeText(item.started_at)} | ${safeText(item.method)} | ${safeWebLink(item.url, item.url)} | ${item.status ?? 'failed'} | ` +
      `${localLink('raw', item.body_path)} / ${localLink('metadata', item.metadata_path)} |`);
  }
  if (run.errors.length) {
    lines.push('', '## Errors', '');
    for (const error of run.errors) lines.push(`- ${safeText(error.code)}: ${safeText(error.message)}`);
  }
  lines.push('', '## Limits', '',
    '- Completeness applies only to the declared scope. Missing jobs in failed, filtered or partial observations do not prove closure.',
    '- No matching, salary estimation, applications, messages, profile edits, LLM calls, or scheduling.',
    '- Original full JD material is retained locally as evidence; do not redistribute it as a bulk public dataset.',
    '- Initial observations are a baseline, not proof of a new publication or that recruitment remains open.', '');
  return lines.join('\n');
}

export async function writeReport(run) {
  await mkdir(REPORT_DIR, { recursive: true });
  const artifacts = reportPaths(run.run_id);
  const result = { schema_version: 1, generated_at: new Date().toISOString(),
    live_collection_success: run.status === 'success' && run.complete && run.ownership.status === 'verified' &&
      run.jobs.length > 0 && run.jobs.every((job) => job.description_complete), runs: [run], artifacts };
  for (const [path, content] of [[artifacts.report_json, JSON.stringify(result, null, 2) + '\n'], [artifacts.report_markdown, renderReport(run)]]) {
    const destination = evidenceAbsolute(path);
    const temporary = `${destination}.${randomUUID()}.tmp`;
    await writeFile(temporary, content, { flag: 'wx' });
    await rename(temporary, destination);
  }
  return result;
}
