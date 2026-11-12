import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoginCheckpoint, planOtherTaskDuringLogin, planLoginResume } from '../login-checkpoint.mjs';

const task = (changes = {}) => ({ task_id: 'task-A', source_id: 'source-A', platform_id: 'official-A', account_id: 'account-A',
  stage: 'inspect_form', submission_state: 'not_sent',
  page: { browser: 'iab', tab_id: 'tab-A', url: 'https://a.example.test/job/1' }, ...changes });
const pause = value => createLoginCheckpoint(value, { reason: 'captcha', at: '2026-10-18T01:00:00Z', evidenceRef: 'fixture://captcha' });
const admission = value => ({ status: 'admitted', task_id: value.task_id, source_id: value.source_id, platform_id: value.platform_id,
  account_id: value.account_id, url: value.page.url, browser: value.page.browser, evidence_ref: 'fixture://shared-queue-admission' });
const other = () => task({ task_id: 'task-B', source_id: 'source-B', platform_id: 'official-B', account_id: 'account-B',
  page: { browser: 'iab', tab_id: 'tab-B', url: 'https://b.example.test/job/2' } });
const completion = checkpoint => ({ confirmed: true, task_id: checkpoint.task.task_id, paused_at: checkpoint.paused_at, evidence_ref: 'fixture://user-said-done' });

test('checkpoint copies task position and freezes the original page contract without any browser actions', () => {
  const value = task(), checkpoint = pause(value);
  const before = structuredClone(checkpoint);
  assert.equal(checkpoint.page_policy.preserve_original, true);
  for (const action of ['refresh', 'close', 'navigate', 'poll', 'read', 'screenshot', 'clear_cookies', 'automatic_takeover']) assert.equal(checkpoint.page_policy[action], false);
  value.page.url = 'https://changed.example.test/';
  assert.deepEqual(checkpoint, before);
  assert.equal(checkpoint.status, 'waiting_for_user');
  assert.equal(checkpoint.external_actions, 0);
  assert.throws(() => pause(task({ account_id: '' })), /binding/);
  assert.throws(() => pause(task({ submission_state: undefined })), /Explicit submission state/);
  assert.throws(() => pause(task({ page: { browser: 'iab', url: 'https://a.example.test/' } })), /binding/);
  assert.throws(() => createLoginCheckpoint(task(), { reason: 'timeout' }), /Handoff/);
});

test('only admitted independent work may plan a separate page while user logs in', () => {
  const checkpoint = pause(task()), value = other(), before = structuredClone(checkpoint);
  const result = planOtherTaskDuringLogin(value, checkpoint, { admission: admission(value), restrictions: [] });
  assert.equal(result.status, 'independent_task_planned');
  assert.equal(result.page_action, 'separate_page_after_shared_queue_admission');
  assert.equal(result.external_actions, 0);
  assert.equal(result.ready_to_submit, false);
  const unopened = other(); delete unopened.page.tab_id;
  assert.equal(planOtherTaskDuringLogin(unopened, checkpoint, { admission: admission(unopened), restrictions: [] }).status, 'independent_task_planned');
  assert.deepEqual(checkpoint, before);
  for (const blocked of [task(), otherWith({ task_id: 'task-A' }), otherWith({ account_id: 'account-A' }),
    otherWith({ page: { ...value.page, tab_id: 'tab-A' } })]) {
    assert.equal(planOtherTaskDuringLogin(blocked, checkpoint, { admission: admission(blocked), restrictions: [] }).status, 'blocked');
  }
  function otherWith(changes) { return { ...other(), ...changes }; }
  assert.equal(planOtherTaskDuringLogin(value, checkpoint, { restrictions: [] }).blocker, 'fresh_admission_required');
  assert.equal(planOtherTaskDuringLogin(value, checkpoint, { admission: admission(task()), restrictions: [] }).blocker, 'fresh_admission_required');
  assert.equal(planOtherTaskDuringLogin(value, checkpoint, { admission: admission(value) }).blocker, 'restriction_state_unknown');
});

test('task continuation cannot bypass global/platform/account/source halts or BOSS/Liepin quarantine', () => {
  const checkpoint = pause(task()), value = other();
  for (const restriction of [{ scope: 'global' }, { scope: 'platform', id: value.platform_id },
    { scope: 'account', id: value.account_id }, { scope: 'source', id: value.source_id }]) {
    assert.equal(planOtherTaskDuringLogin(value, checkpoint, { admission: admission(value), restrictions: [restriction] }).blocker, 'active_halt');
  }
  assert.equal(planOtherTaskDuringLogin(value, checkpoint, { admission: admission(value), restrictions: [{ scope: 'source', id: 'source-A' }] }).status, 'independent_task_planned');
  for (const url of ['https://www.zhipin.com/web/geek/jobs', 'https://c.liepin.com/']) {
    const protectedTask = other(); protectedTask.page.url = url;
    assert.equal(planOtherTaskDuringLogin(protectedTask, checkpoint, { admission: admission(protectedTask), restrictions: [] }).blocker, 'BROWSER_CONTROL_QUARANTINED');
  }
  const platform = other(); platform.platform_id = 'boss';
  assert.equal(planOtherTaskDuringLogin(platform, checkpoint, { admission: admission(platform), restrictions: [] }).blocker, 'BROWSER_CONTROL_QUARANTINED');
});

test('user completion permits only original-page revalidation; halts and unknown sends remain blocked', () => {
  const checkpoint = pause(task({ submission_state: 'submission_unknown', stage: 'submit' }));
  const options = { admission: admission(checkpoint.task), restrictions: [], userCompletion: completion(checkpoint) };
  assert.equal(planLoginResume(checkpoint).blocker, 'user_completion_required');
  assert.equal(planLoginResume(checkpoint, { ...options, userCompletion: { ...options.userCompletion, paused_at: 'stale' } }).blocker, 'user_completion_required');
  assert.equal(planLoginResume(checkpoint, { ...options, restrictions: [{ scope: 'account', id: 'account-A' }] }).blocker, 'active_halt');
  assert.equal(planLoginResume(checkpoint, { ...options, admission: undefined }).blocker, 'fresh_admission_required');
  const resumed = planLoginResume(checkpoint, options);
  assert.equal(resumed.status, 'session_revalidation_required');
  assert.equal(resumed.resume_stage, 'reconcile_submission');
  assert.equal(resumed.submission_state, 'submission_unknown');
  assert.equal(resumed.retry_submission, false);
  assert.equal(resumed.ready_to_submit, false);
  assert.equal(resumed.refresh, false); assert.equal(resumed.close, false);
  assert.deepEqual(resumed.page, checkpoint.task.page);
  assert.equal(resumed.external_actions, 0);
  assert.equal(checkpoint.status, 'waiting_for_user');
  const ordinary = pause(task());
  assert.equal(planLoginResume(ordinary, { ...options, userCompletion: completion(ordinary) }).resume_stage, 'inspect_form');
  const sent = pause(task({ submission_state: 'submitted_verified', stage: 'submit' }));
  assert.equal(planLoginResume(sent, { ...options, userCompletion: completion(sent) }).resume_stage, 'follow_up_only');
});

test('login confirmation does not lift protected-platform automatic-control isolation', () => {
  const value = task({ platform_id: 'liepin', page: { browser: 'iab', tab_id: 'liepin-original', url: 'https://c.liepin.com/' } });
  const checkpoint = pause(value);
  assert.equal(planLoginResume(checkpoint, { userCompletion: completion(checkpoint), admission: admission(value), restrictions: [] }).blocker, 'BROWSER_CONTROL_QUARANTINED');
});
