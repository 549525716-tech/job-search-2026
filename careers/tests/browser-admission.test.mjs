import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBrowserAdmission, classifyBrowserCapture } from '../browser-admission.mjs';

const admission = (url, operation = 'read') => ({ kind: 'browser_visible_page_capture', operation, request: { browser: 'iab', url } });
test('protected recruiting tabs cannot be automatically claimed after login confirmation', () => {
  for (const url of ['https://c.liepin.com/', 'https://c.liepin.com./', 'https://www.liepin.com/job/1.shtml', 'https://www.zhipin.com/web/geek/jobs']) {
    assert.throws(() => validateBrowserAdmission(admission(url)), /QUARANTINED/);
  }
});
test('ordinary handoff is limited to approved entry URLs and executor', () => {
  const command = admission('https://c.liepin.com/', 'ordinary-page-open');
  assert.throws(() => validateBrowserAdmission(command), /QUARANTINED/);
  command.request.executor = 'codex_app.open_in_codex';
  assert.doesNotThrow(() => validateBrowserAdmission(command));
  assert.throws(() => validateBrowserAdmission(command, [{ ...command, event: 'begin' }]), /ALREADY_ATTEMPTED/);
  command.request.url = 'https://c.liepin.com/account';
  assert.throws(() => validateBrowserAdmission(command), /QUARANTINED/);
});
test('ordinary handoff history treats expected_url and url as the same target', () => {
  const base = { kind: 'browser_visible_page_capture', operation: 'ordinary-page-open', request: { browser: 'iab', executor: 'codex_app.open_in_codex' } };
  for (const current of ['url', 'expected_url']) for (const previous of ['url', 'expected_url']) {
    const command = { ...base, request: { ...base.request, [current]: 'https://c.liepin.com/' } };
    const history = [{ ...base, event: 'begin', request: { ...base.request, [previous]: 'https://c.liepin.com/' } }];
    assert.throws(() => validateBrowserAdmission(command, history), /ALREADY_ATTEMPTED/);
  }
});
test('failed tools and invalid actual URLs cannot authenticate cached text', () => {
  const page = { url: 'https://example.com/', text: 'Hello Test User', authenticated: true, account_evidence: 'Test User' };
  for (const changes of [{ status: 'error', error: 'Debugger unattached' }, { isError: true }, { ok: false }]) {
    assert.equal(classifyBrowserCapture({ result: { ...page, ...changes } }), 'technical_failure');
  }
  assert.equal(classifyBrowserCapture({ result: { ...page, status: 'user_interaction_interrupted' } }), 'interrupted');
  for (const url of ['', 'not a URL', 'file:///tmp/cached.html', 'https://user:pass@example.com/']) {
    assert.equal(classifyBrowserCapture({ result: { ...page, url } }), 'unverified_capture');
  }
});
test('unknown target, desktop browser and credentials fail closed', () => {
  assert.throws(() => validateBrowserAdmission(admission()), /TARGET_URL_REQUIRED/);
  const command = admission('https://example.com/'); command.request.browser = 'chrome';
  assert.throws(() => validateBrowserAdmission(command), /IN_APP/);
  assert.throws(() => validateBrowserAdmission(admission('https://user:secret@example.com/')), /PUBLIC_HTTPS/);
  assert.throws(() => validateBrowserAdmission({ ...admission('https://example.com/'), request: { browser: 'iab', url: 'https://example.com/', expected_url: 'https://c.liepin.com/' } }), /CONFLICT/);
  assert.doesNotThrow(() => validateBrowserAdmission({ kind: 'browser_visible_page_capture', operation: 'inventory', request: { browser: 'iab' } }));
});
test('subframe blank does not mean top-level blank, and title does not mean login', () => {
  assert.equal(classifyBrowserCapture({ result: { url: 'https://example.com/jobs', text: 'iframe about:blank' } }), 'visible_page_auth_unverified');
  assert.equal(classifyBrowserCapture({ result: { url: 'about:blank', text: 'cached page', authenticated: true } }), 'blank_page');
  assert.equal(classifyBrowserCapture({ result: { url: 'https://example.com/jobs', title: 'My homepage', authenticated: true } }), 'no_visible_text');
  assert.equal(classifyBrowserCapture({ result: 'old full AX text' }), 'unverified_legacy_capture');
  assert.equal(classifyBrowserCapture({ result: { url: 'https://example.com/', text: 'captcha', access_stop: true, authenticated: true } }), 'access_stopped');
  assert.equal(classifyBrowserCapture({ result: { url: 'https://example.com/', actual_observation_source: 'application logs' } }), 'diagnostic_only');
  assert.equal(classifyBrowserCapture({ result: { url: 'https://example.com/', text: 'jobs', authenticated: true } }), 'visible_page_auth_unverified');
  assert.equal(classifyBrowserCapture({ result: { url: 'https://example.com/', text: 'Hello Test User\nJobs', authenticated: true, account_evidence: 'Hello Test User' } }), 'authenticated_page_capture');
});
