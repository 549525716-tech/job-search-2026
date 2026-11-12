import { createHash } from 'node:crypto';

export const LEGACY_APPLICATION_IDENTITY_VERSION = '2026-10-18-once-per-publisher-v1';
export const APPLICATION_IDENTITY_VERSION = '2026-10-18-once-per-contact-v2';
const id = (value) => typeof value === 'string' ? value.trim() : '';
const title = (value) => id(value).normalize('NFKC').replace(/\s+/g, ' ').toLowerCase();
export const sha256 = (value) => createHash('sha256').update(value).digest('hex');

// Collection grouping is deliberately NOT an authority to send an application.
// An adapter/reviewer must supply stable IDs and the evidence that binds them.
export function applicationIdentity(job, candidateId) {
  const identity = job.application_identity ?? {};
  const missing = [];
  const candidate = id(candidateId);
  const channel = id(identity.channel);
  if (!candidate) missing.push('candidate_id');
  if (!['platform', 'official'].includes(identity.kind)) missing.push('channel_kind');
  if (!channel) missing.push('channel');
  for (const field of ['employer_id', 'evidence_ref']) {
    if (!id(identity[field])) missing.push(field);
  }
  if (identity.verified !== true) missing.push('identity_verification');
  let parts;
  if (identity.kind === 'platform') {
    if (!title(job.title)) missing.push('job_title');
    if (!id(identity.publisher_id)) missing.push('stable_publisher_id');
    // IDs are case-sensitive. Reposts, city, JD edits and resume versions do not reset history.
    parts = ['platform', channel, id(identity.employer_id), title(job.title), id(identity.publisher_id), candidate];
  } else if (identity.kind === 'official') {
    for (const field of ['tenant_id', 'requisition_id']) if (!id(identity[field])) missing.push(field);
    // Missing contact data is not evidence of a contact-free public entry.
    parts = ['official', id(identity.employer_id), id(identity.tenant_id), id(identity.requisition_id), candidate];
    if (identity.contact_status === 'verified_contact') {
      if (!id(identity.publisher_id)) missing.push('stable_publisher_id');
      parts.push('verified_contact', id(identity.publisher_id));
    } else if (identity.contact_status === 'verified_no_contact') {
      if (id(identity.publisher_id) || id(identity.publisher_name) || id(job.recruiter_name)) missing.push('conflicting_contact_evidence');
      parts.push('verified_no_contact');
    } else missing.push('contact_status');
  }
  return { version: APPLICATION_IDENTITY_VERSION, status: missing.length ? 'identity_pending' : 'identified',
    target_key: missing.length ? null : sha256(JSON.stringify(parts)), basis: missing.length ? null : parts,
    evidence_ref: id(identity.evidence_ref) || null, missing };
}

// Compatibility lookup only; never use this broad v1 key to authorize a new send.
export function legacyOfficialTargetKey(identity) {
  return identity?.status === 'identified' && identity.basis?.[0] === 'official'
    ? sha256(JSON.stringify(identity.basis.slice(0, 5))) : null;
}
