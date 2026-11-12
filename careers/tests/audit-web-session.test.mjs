import test from 'node:test';
import assert from 'node:assert/strict';
import { captureTimes } from '../audit-web-session.mjs';

test('accepts original and explicit actual tool timestamp field names', () => {
  const started_at = '2026-09-16T15:30:00.000Z';
  const observed_at = '2026-09-16T15:30:10.000Z';
  assert.deepEqual(captureTimes({ started_at, observed_at }), { started_at, observed_at });
  assert.deepEqual(captureTimes({ tool_started_at: started_at, tool_finished_at: observed_at }), { started_at, observed_at });
  assert.deepEqual(captureTimes({ started_at, observed_at, tool_started_at: started_at, tool_finished_at: observed_at }), { started_at, observed_at });
});

test('does not repair missing timestamps or accept conflicting times', () => {
  assert.equal(captureTimes({}).started_at, undefined);
  assert.throws(() => captureTimes({ started_at: '2026-09-16', tool_started_at: '2026-09-17' }), /conflicting/);
});
