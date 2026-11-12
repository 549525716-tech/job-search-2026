import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('source catalogue is an open discovery taxonomy, never a channel whitelist or an access bypass', () => {
  const policy = JSON.parse(readFileSync(new URL('../config/source-catalog.json', import.meta.url)));
  assert.equal(policy.source_scope.mode, 'open_world');
  assert.equal(policy.source_scope.named_channels_are_examples_not_whitelist, true);
  assert.equal(policy.source_scope.access_gate_unchanged, true);
  assert.equal(policy.source_scope.unverified_source_is_full_jd, false);
  assert.equal(policy.gates.catalog_entry_authorizes_network, false);
});
