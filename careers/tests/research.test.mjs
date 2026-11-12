import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyObservation } from '../research.mjs';
import { main } from '../cli.mjs';

test('classifies research observations without network access', () => {
  assert.equal(classifyObservation(null, { status: 'captured', text_sha256: 'a' }), 'baseline');
  assert.equal(classifyObservation({ text_sha256: 'a' }, { status: 'captured', text_sha256: 'a' }), 'unchanged');
  assert.equal(classifyObservation({ text_sha256: 'a' }, { status: 'captured', text_sha256: 'b' }), 'content_changed_pending_review');
  assert.equal(classifyObservation({ text_sha256: 'a' }, { status: 'failed', text_sha256: 'b' }), 'not_observed');
  assert.equal(classifyObservation(null, { status: 'failed' }), 'not_observed');
});

test('rejects a comma-only document selection before collectResearch can make a request', async () => {
  await assert.rejects(main(['research:collect', '--documents', ', ,']), /Select at least one explicit document ID/);
});
