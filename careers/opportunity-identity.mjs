import { createHash } from 'node:crypto';

export const OPPORTUNITY_IDENTITY_VERSION = '2026-09-13-channel-contact-v1';
const text = (value) => String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
const opaqueId = (value) => typeof value === 'string' ? value.trim() : typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
const key = (...parts) => createHash('sha256').update(JSON.stringify(parts)).digest('hex');

export function identityURL(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return '';
    // Hash routes and query parameters may contain the native vacancy or recruiter ID.
    for (const name of [...url.searchParams.keys()]) if (/^utm_/i.test(name)) url.searchParams.delete(name);
    return url.href;
  } catch { return ''; }
}

export function channelFamily(job) {
  const urls = [job.job_url, job.source_url, job.board_url].map(identityURL);
  const hosts = urls.filter(Boolean).map((url) => new URL(url).hostname);
  const label = text(job.channel_family || job.channel || job.platform || job.source_kind);
  if (hosts.some((host) => /(^|\.)zhipin\.com$/.test(host)) || /^(boss|boss直聘|boss_zhipin|zhipin)$/.test(label)) return 'boss';
  if (hosts.some((host) => /(^|\.)liepin\.com$/.test(host)) || /^(liepin|猎聘)$/.test(label)) return 'liepin';
  if (/^(official|official_ats)$/.test(label) || /^official-/.test(job.provider ?? '')) return 'official';
  return label || 'unknown';
}

function identity(job, index) {
  const channel = channelFamily(job);
  const url = identityURL(job.job_url);
  const host = url ? new URL(url).hostname : '';
  const observation = key(job.job_key || job.id || '', job.metadata_path || job.evidence_file || '', index);
  const companyId = opaqueId(job.company_id || job.employer_id || job.company_platform_id);
  const namedCompany = job.company_name || job.company || job.employer;
  const companyName = text(typeof namedCompany === 'object' ? namedCompany?.name || namedCompany?.company_name || '' : namedCompany);
  const company = companyId ? ['id', companyId] : companyName ? ['name_in_source', companyName, host || job.source_id || channel] : ['unknown', observation];
  const title = text(job.title);
  const location = text(job.location_raw || job.city || job.location);
  const recruiter = job.recruiter ?? job.contact ?? {};
  const contactId = opaqueId(job.recruiter_id || job.contact_id || job.hr_id || recruiter.id);
  const contactURL = identityURL(job.recruiter_url || job.contact_url || recruiter.url);
  const contactName = String(job.recruiter_name || job.contact_name || job.hr_name || recruiter.name || '');
  const nativeId = opaqueId(job.source_job_id || job.native_job_id || job.requisition_id);
  const contactStatus = contactId || contactURL ? 'identified' : contactName ? 'display_name_only' : 'unknown';
  const possibleVacancy = key('possible_vacancy', company, title, location);
  let target;
  let confidence;
  if (['boss', 'liepin'].includes(channel) && title && (contactId || contactURL)) {
    target = key(channel, company, title, contactId || contactURL, location);
    confidence = 'company_title_contact';
  } else if (channel === 'official' && (nativeId || (job.link_kind === 'job_detail' && url && url !== identityURL(job.board_url))) && title) {
    target = key(channel, company, nativeId ? [job.tenant || host || job.source_id, nativeId] : [url, title, location, text(job.department)]);
    confidence = nativeId ? 'native_vacancy_id' : 'same_detail_url';
  } else {
    // Missing contact/identity is not evidence of equality. Keep an independent target.
    target = key('unresolved_observation', channel, company, observation);
    confidence = 'unresolved_keep_separate';
  }
  return {
    identity_rule_version: OPPORTUNITY_IDENTITY_VERSION,
    channel_family: channel, vacancy_group_key: channel === 'official' && confidence !== 'unresolved_keep_separate' ? target : possibleVacancy,
    vacancy_group_status: channel === 'official' && confidence !== 'unresolved_keep_separate' ? 'source_identity' : 'possible_relation_only',
    application_target_key: target, identity_basis: confidence,
    contact_name: contactName || null, contact_identity_status: contactStatus,
    observation_id: observation,
  };
}

export function annotateOpportunities(jobs) {
  const seen = new Map();
  return jobs.map((job, index) => {
    const fields = identity(job, index);
    const first = seen.get(fields.application_target_key);
    if (!first) seen.set(fields.application_target_key, fields.observation_id);
    return { ...job, ...fields, duplicate_of: first ?? null,
      duplicate_status: first ? 'same_application_target_raw_retained' : fields.identity_basis === 'unresolved_keep_separate' ? 'identity_pending' : 'distinct_target' };
  });
}

export function groupOpportunities(jobs) {
  const groups = new Map();
  for (const job of annotateOpportunities(jobs)) {
    const entries = groups.get(job.application_target_key) ?? [];
    entries.push(job);
    groups.set(job.application_target_key, entries);
  }
  return [...groups.values()].map((observations) => {
    const selected = observations.find((job) => job.description_complete) ?? observations[0];
    return { ...selected, observations, observation_count: observations.length,
      duplicate_status: observations.length > 1 ? 'grouped_raw_retained' : selected.duplicate_status };
  });
}
