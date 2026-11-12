import { readFile, writeFile, mkdir, lstat, rename, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve, dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { applicationIdentity, sha256 } from './application-identity.mjs';
import { ApplicationLedger } from './application-ledger.mjs';
import { buildResumeTask } from './resume-task.mjs';
import { ROOT, DATA_DIR } from './paths.mjs';
import { classifyRole } from './role-policy.mjs';

export function planApplications(jobs, candidateId, profile, ledger = null, preferences = {}) {
  const observations = jobs.map((job, index) => ({ job, index, identity: applicationIdentity(job, candidateId) }));
  const groups = new Map();
  for (const observation of observations) {
    observation.task = buildResumeTask(observation.job, profile, observation.identity);
    const time = Date.parse(observation.job.fetched_at ?? observation.job.observed_at ?? observation.job.last_seen_at ?? '');
    observation.observed_at_ms = Number.isFinite(time) ? time : -Infinity;
    const key = observation.identity.target_key;
    if (key) { const group = groups.get(key) ?? []; group.push(observation); groups.set(key, group); }
  }
  const selected = new Map();
  for (const [key, group] of groups) {
    const latest = (a, b) => (b.observed_at_ms === a.observed_at_ms ? 0 : b.observed_at_ms > a.observed_at_ms ? 1 : -1)
      || a.task.input.jd_sha256.localeCompare(b.task.input.jd_sha256) || a.index - b.index;
    const full = group.filter(x => x.task.input.jd_complete).sort(latest);
    let winner = full[0] ?? [...group].sort(latest)[0];
    const newerPartial = group.filter(x => !x.task.input.jd_complete && x.observed_at_ms > winner.observed_at_ms).sort(latest)[0];
    // A newer incomplete observation cannot silently renew the freshness of an old full JD.
    if (newerPartial) winner = newerPartial;
    const ambiguous = full.some(x => x.task.input.jd_sha256 !== winner.task.input.jd_sha256
      && (!Number.isFinite(x.observed_at_ms) || !Number.isFinite(winner.observed_at_ms)
        || x.observed_at_ms === winner.observed_at_ms));
    if (winner.task.input.jd_complete && ambiguous) winner.task.blockers.push('conflicting_complete_jd_versions');
    selected.set(key, winner.index);
  }
  const items = observations.map(({ job, index, identity, task }) => {
    const history = identity.target_key && ledger?.historyFor(identity);
    const row = history?.row;
    const duplicate = identity.target_key && selected.get(identity.target_key) !== index;
    const status = !identity.target_key ? 'identity_pending'
      : ['already_reserved_or_attempted', 'history_reconciliation_required'].includes(history?.status) ? history.status
      : duplicate ? 'same_target_in_batch'
      : task.blockers.length ? 'jd_pending' : 'resume_task_pending';
    return { observation_index: index, title: job.title ?? null, identity, status,
      role_review: classifyRole(job, preferences),
      history_status: row?.state ?? 'no_imported_record_not_proof_of_never_applied',
      history_target_key: row?.target_key ?? null,
      duplicate_of_index: duplicate ? selected.get(identity.target_key) : null,
      resume_task: task, ready_to_submit: false };
  });
  const counts = {};
  for (const item of items) counts[item.status] = (counts[item.status] ?? 0) + 1;
  return { schema_version: 1, mode: 'offline_planning_only', candidate_id: candidateId, created_at: new Date().toISOString(),
    counts, raw_observations_preserved: items.length, profile_context: profile, items, external_actions: 0,
    warning: 'No ledger record is not proof of no historical application. Reconcile website history before enabling submission.' };
}

export async function main(args) {
  const { values } = parseArgs({ args, strict: true, options: {
    input: { type: 'string' }, candidate: { type: 'string' }, profile: { type: 'string' },
    ledger: { type: 'string' }, output: { type: 'string' },
  } });
  if (!values.input || !values.candidate?.trim()) throw new Error('applications:plan requires --input JSON and --candidate STABLE_ID');
  const inputPath = resolve(values.input);
  const profilePath = resolve(values.profile ?? join(ROOT, '02_岗位画像/data/我的能力画像.json'));
  const inputBytes = await readFile(inputPath);
  const parsed = JSON.parse(inputBytes);
  const jobs = Array.isArray(parsed) ? parsed : parsed.jobs;
  if (!Array.isArray(jobs) || jobs.some(job => !job || typeof job !== 'object' || Array.isArray(job))) throw new Error('Input must contain job objects');
  let profile;
  let preferences = JSON.parse(await readFile(join(ROOT, 'careers/config/preferences.json'), 'utf8'));
  if (values.profile) {
    const content = await readFile(profilePath, 'utf8');
    profile = { path: profilePath, content, sha256: sha256(content), kind: 'explicit_custom_source_not_confirmed_facts' };
  } else {
    const { loadMatchContext } = await import('./matching.mjs');
    const context = await loadMatchContext();
    const content = JSON.stringify(context.facts, null, 2);
    profile = { path: null, source: 'careers/matching.mjs#loadMatchContext', content, sha256: sha256(content),
      kind: 'existing_evidence_context_not_independently_audited', upstream_profile_sha256: context.profile_hash,
      source_paths: [context.facts.source_profile, context.facts.source_summary, 'careers/config/profile-supplement.json'] };
    preferences = context.preferences;
  }
  // Explicit ledger only; a misspelled/missing path must fail, never create an empty history.
  const ledger = values.ledger ? new ApplicationLedger(resolve(values.ledger), { readOnly: true }) : null;
  try {
    const report = planApplications(jobs, values.candidate, profile, ledger, preferences);
    report.input = { path: inputPath, sha256: sha256(inputBytes), profile_path: profile.path,
      profile_sha256: profile.sha256, upstream_profile_sha256: profile.upstream_profile_sha256 ?? null };
    report.ledger_status = values.ledger ? 'explicit_local_history_read_not_platform_reconciled' : 'not_loaded';
    const output = resolve(values.output ?? join(DATA_DIR, 'applications', 'plan.json'));
    if ([inputPath, profilePath, values.ledger && resolve(values.ledger)].includes(output)) throw new Error('Output cannot overwrite an input');
    await mkdir(dirname(output), { recursive: true });
    try {
      const info = await lstat(output);
      if (!info.isFile() || info.isSymbolicLink()) throw new Error('Output must not be a symlink or non-file');
      const existing = JSON.parse(await readFile(output, 'utf8'));
      if (existing.mode !== 'offline_planning_only') throw new Error('Refusing to overwrite a non-plan artifact');
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    // Atomic private replacement also tightens permissions on an existing report.
    const temporary = `${output}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, JSON.stringify(report, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
      await rename(temporary, output);
    } finally { await rm(temporary, { force: true }); }
    return { mode: report.mode, counts: report.counts, output, observations: report.raw_observations_preserved,
      ledger_status: report.ledger_status, external_actions: 0, ready_to_submit: false };
  } finally { ledger?.close(); }
}

