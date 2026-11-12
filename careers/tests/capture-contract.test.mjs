import test from 'node:test';
import assert from 'node:assert/strict';
import { captureMatchesAdmission } from '../capture-contract.mjs';

test('legacy web capture remains distinct from browser page evidence', () => {
  const admission = { operation: 'open', request: { open: [{ ref_id: 'https://example.com/' }] } };
  const capture = { ...admission, kind: 'web_tool_result_not_raw_http', result: 'visible text' };
  assert.equal(captureMatchesAdmission(capture, admission), true);
  assert.equal(captureMatchesAdmission({ ...capture, kind: 'browser_visible_page_capture' }, admission), false);
});

test('browser capture must retain admitted URL, operation and evidence kind', () => {
  const admission = { kind: 'browser_visible_page_capture', operation: 'click', request: { url: 'https://example.com/job/1' } };
  const capture = { ...admission, result: { status: 'user_interaction_interrupted' } };
  assert.equal(captureMatchesAdmission(capture, admission), true);
  assert.equal(captureMatchesAdmission({ ...capture, request: { url: 'https://example.com/job/2' } }, admission), false);
  assert.equal(captureMatchesAdmission({ ...capture, kind: 'raw_http' }, admission), false);
  assert.equal(captureMatchesAdmission({ ...capture, result: undefined }, admission), false);
  assert.equal(captureMatchesAdmission({ ...capture, operation: 'search' }, admission), false);
});
