import { createHash } from 'node:crypto';
import { parseSalary } from './salary.mjs';

export function jobKey(sourceId, tenant, sourceJobId) {
  if ([sourceId, tenant, sourceJobId].some((part) => typeof part !== 'string' || !part.trim())) throw new Error('Stable job key components required');
  return [sourceId, tenant, sourceJobId].map(encodeURIComponent).join(':');
}

export function normalizeJob(raw, company, response) {
  const fullUnstructured = raw.description_complete === true && raw.detail_completeness === 'full_source_description';
  if (!raw.title?.trim() || !raw.description_text?.trim() ||
      (!fullUnstructured && (!raw.responsibilities?.trim() || !raw.requirements?.trim()))) {
    throw new Error('Full job description required');
  }
  const dateCandidate = raw.published_date ?? raw.published_raw;
  const publication = typeof dateCandidate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateCandidate) ? dateCandidate : null;
  const exactTimestamp = typeof raw.published_at === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(raw.published_at) &&
    Number.isFinite(Date.parse(raw.published_at)) ? raw.published_at : null;
  const salary = parseSalary(raw.salary_raw ?? null, raw.salary_hints ?? {});
  return {
    job_key: jobKey(company.source_id, company.tenant, raw.source_job_id),
    company_id: company.company_id, company_name: company.company_name, employer: company.legal_name,
    source_id: company.source_id, tenant: company.tenant, source_job_id: raw.source_job_id, provider: company.provider,
    channel_family: raw.channel_family ?? company.channel_family ?? 'official',
    recruiter_id: raw.recruiter_id ?? raw.contact_id ?? null,
    recruiter_name: raw.recruiter_name ?? raw.contact_name ?? null,
    recruiter_url: raw.recruiter_url ?? raw.contact_url ?? null,
    title: raw.title, location_raw: raw.location_raw ?? null, department: raw.department ?? null, employment_type: raw.employment_type ?? null,
    ...salary, salary_source_fields: raw.salary_source_fields ?? null, hiring_active: raw.hiring_active ?? 'unknown',
    hiring_active_reason: 'Listed on a reachable official page; publication/status flags do not prove hiring is still open',
    published_at: exactTimestamp ?? publication, published_at_raw: raw.published_raw ?? null,
    published_at_semantics: raw.published_at_semantics ?? 'Official card calendar date agrees with source publishTime; full original string retained; not first observation',
    published_at_precision: exactTimestamp ? 'second' : publication ? 'day' : 'unknown',
    published_at_timezone: exactTimestamp ? raw.published_at_timezone ?? 'source_explicit_offset' : null,
    source_created_at_raw: raw.created_raw ?? null, source_updated_at_raw: raw.updated_raw ?? null,
    source_timestamp_timezone: raw.source_timestamp_timezone ?? null,
    source_timestamp_semantics: raw.source_timestamp_semantics ?? 'Source createTime/updateTime strings; timezone not declared',
    fetched_at: response.finished_at, first_seen_at: raw.first_observed_at ?? response.finished_at, last_seen_at: response.finished_at,
    description_text: raw.description_text, description_html: raw.description_html ?? null,
    responsibilities: raw.responsibilities ?? null, requirements: raw.requirements ?? null,
    description_complete: true, detail_completeness: raw.detail_completeness ?? 'full_inline_sections_cross_checked_with_page_data',
    job_url: raw.job_url ?? response.url, board_url: raw.board_url ?? company.board_url,
    link_verification: raw.link_verification ?? 'source_response_or_native_board_link',
    capture_mode: raw.capture_mode ?? 'raw_http',
    application_url: raw.application_url ?? null, source_locator: raw.source_locator ?? null,
    source_record: raw.source_record, body_path: response.body_path, metadata_path: response.metadata_path,
    raw_response_sha256: response.sha256,
    content_sha256: createHash('sha256').update(JSON.stringify({ title: raw.title, location: raw.location_raw,
      description: raw.description_text, publication: raw.published_raw, salary: salary.salary_raw })).digest('hex'),
    observation_semantics: 'observed_on_official_page; not new_today; no closure inference',
  };
}
