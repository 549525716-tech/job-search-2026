import { validateBrowserAdmission } from './browser-admission.mjs';

export const LOGIN_CHECKPOINT_VERSION = '2026-10-18-task-handoff-v1';
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const bindingFields = ['task_id', 'source_id', 'platform_id', 'account_id'];

function validateTask(task, { requireTab = true } = {}) {
  if (bindingFields.some(field => !nonempty(task?.[field])) || !nonempty(task?.stage)
    || task?.page?.browser !== 'iab'
    || ((requireTab || task.page.tab_id !== undefined) && !nonempty(task.page.tab_id))) throw new Error('Incomplete task/page binding');
  if (!['not_sent', 'reserved', 'failed_before_send', 'submission_unknown', 'submitted_verified', 'interview', 'rejected', 'withdrawn']
    .includes(task.submission_state)) throw new Error('Explicit submission state required; missing is not not_sent');
  const url = new URL(task.page.url);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Task page must be public HTTPS');
}

// Pure data contract: this does not inspect, open, retain or operate a browser tab.
export function createLoginCheckpoint(task, { reason, at, evidenceRef } = {}) {
  validateTask(task);
  if (!['login', 'captcha', 'otp', 'mfa', 'identity_verification'].includes(reason)
    || !Number.isFinite(Date.parse(at)) || !nonempty(evidenceRef)) throw new Error('Handoff requires reason, time and evidence');
  return {
    version: LOGIN_CHECKPOINT_VERSION, status: 'waiting_for_user', reason, paused_at: at, evidence_ref: evidenceRef,
    task: structuredClone(task),
    page_policy: { preserve_original: true, refresh: false, close: false, navigate: false,
      poll: false, read: false, screenshot: false, clear_cookies: false, automatic_takeover: false },
    resume_requires: ['user_completion', 'fresh_admission', 'session_revalidation', 'submission_reconciliation_if_unknown'],
    external_actions: 0,
  };
}

function admissionBlocker(task, admission, restrictions) {
  if (!Array.isArray(restrictions)) return 'restriction_state_unknown';
  for (const restriction of restrictions) {
    const field = { source: 'source_id', platform: 'platform_id', account: 'account_id' }[restriction?.scope];
    if (restriction?.scope === 'global') return 'active_halt';
    if (!field || !nonempty(restriction.id)) return 'restriction_state_unknown';
    if (task[field] === restriction.id) return 'active_halt';
  }
  if (admission?.status !== 'admitted' || !nonempty(admission.evidence_ref)
    || bindingFields.some(field => admission[field] !== task[field])
    || admission.url !== task.page.url || admission.browser !== task.page.browser) return 'fresh_admission_required';
  // Reuse the existing quarantine even when a caller mistakenly supplies an admitted flag.
  if (['boss', 'liepin'].includes(task.platform_id.toLowerCase())) return 'BROWSER_CONTROL_QUARANTINED';
  try {
    validateBrowserAdmission({ kind: 'browser_visible_page_capture', operation: 'read',
      request: { browser: task.page.browser, url: task.page.url } });
  } catch (error) { return error.message; }
  return null;
}

function validateCheckpoint(checkpoint) {
  if (checkpoint?.version !== LOGIN_CHECKPOINT_VERSION || checkpoint.status !== 'waiting_for_user') throw new Error('Invalid login checkpoint');
  validateTask(checkpoint.task);
}

export function planOtherTaskDuringLogin(task, checkpoint, { admission, restrictions } = {}) {
  validateCheckpoint(checkpoint);
  validateTask(task, { requireTab: false });
  let blocker = admissionBlocker(task, admission, restrictions);
  if (!blocker && (task.task_id === checkpoint.task.task_id || task.page.tab_id === checkpoint.task.page.tab_id)) blocker = 'preserved_login_page_or_task';
  if (!blocker && task.account_id === checkpoint.task.account_id) blocker = 'shared_account_waiting_for_user';
  return { status: blocker ? 'blocked' : 'independent_task_planned', blocker, task_id: task.task_id,
    page_action: blocker ? 'none' : 'separate_page_after_shared_queue_admission',
    preserved_page: structuredClone(checkpoint.task.page), ready_to_submit: false, external_actions: 0 };
}

export function planLoginResume(checkpoint, { userCompletion, admission, restrictions } = {}) {
  validateCheckpoint(checkpoint);
  const task = checkpoint.task;
  const completed = userCompletion?.confirmed === true && userCompletion.task_id === task.task_id
    && userCompletion.paused_at === checkpoint.paused_at && nonempty(userCompletion.evidence_ref);
  const blocker = completed ? admissionBlocker(task, admission, restrictions) : 'user_completion_required';
  const unknown = task.submission_state === 'submission_unknown';
  const sent = ['submitted_verified', 'interview', 'rejected', 'withdrawn'].includes(task.submission_state);
  return { status: blocker ? 'waiting_for_user_or_admission' : 'session_revalidation_required', blocker,
    task_id: task.task_id, resume_stage: unknown ? 'reconcile_submission' : sent ? 'follow_up_only' : task.stage,
    submission_state: task.submission_state ?? null, page: structuredClone(task.page),
    refresh: false, close: false, retry_submission: false, ready_to_submit: false, external_actions: 0 };
}
