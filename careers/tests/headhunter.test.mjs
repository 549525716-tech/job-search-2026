import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { verifyRoleOutput, projectPath, sqliteLogicalSnapshot } from '../headhunter.mjs';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const sha = (x) => createHash('sha256').update(x).digest('hex');
function fixture() {
  const role = { id: 'test_role', name: 'Test', model: 'gpt-6-astra', reasoning_effort: 'max', inputs: ['fact.md'], output: 'answer.json' };
  const output = { role_id: role.id, status: 'complete', execution: { agent_id: 'real-agent', model: role.model, reasoning_effort: 'max' }, input_files: ['fact.md'], findings: [{ title: 'Claim', conclusion: 'Claim', evidence: [{ path: 'fact.md', quote: 'Direct fact' }] }] };
  const files = { 'fact.md': 'Direct fact', 'answer.json': JSON.stringify(output) };
  const registration = { agent_id: 'real-agent', output_sha256: sha(files['answer.json']), input_sha256: { 'fact.md': sha(files['fact.md']) } };
  return { role, output, files, registration, readSource: async (p) => files[p] };
}
test('independent role needs an actual registered dispatch and verifiable quote', async () => {
  const f = fixture();
  assert.equal((await verifyRoleOutput(f.role)).status, 'not_run');
  assert.equal((await verifyRoleOutput(f.role, f.registration, f)).status, 'complete');
  f.registration.agent_id = 'made-up';
  assert.equal((await verifyRoleOutput(f.role, f.registration, f)).status, 'stale_or_invalid');
});
test('changed inputs and altered output cannot remain current', async () => {
  const f = fixture(); f.files['fact.md'] += ' changed';
  assert.equal((await verifyRoleOutput(f.role, f.registration, f)).status, 'stale_or_invalid');
  f.registration.input_sha256['fact.md'] = sha(f.files['fact.md']);
  f.files['answer.json'] += ' ';
  assert.equal((await verifyRoleOutput(f.role, f.registration, f)).status, 'stale_or_invalid');
});
test('matching hashes cannot legitimize a fabricated quote or external path', async () => {
  const f = fixture(); f.output.findings[0].evidence[0].quote = 'Invented fact'; f.files['answer.json'] = JSON.stringify(f.output); f.registration.output_sha256 = sha(f.files['answer.json']);
  assert.equal((await verifyRoleOutput(f.role, f.registration, f)).status, 'stale_or_invalid');
  assert.throws(() => projectPath('../outside'));
  assert.throws(() => projectPath('/etc/passwd'));
});
test('SQLite logical input digest ignores WAL and no-op transactions but detects data changes', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'career-agent-db-')); const path = join(dir, 'data.sqlite');
  const db = new DatabaseSync(path);
  try {
    db.exec("PRAGMA journal_mode=WAL;CREATE TABLE jobs(id TEXT PRIMARY KEY,jd TEXT);INSERT INTO jobs VALUES('1','original');");
    const before = sha(sqliteLogicalSnapshot(path));
    db.exec("BEGIN IMMEDIATE;UPDATE jobs SET jd=jd;COMMIT;PRAGMA wal_checkpoint(TRUNCATE);");
    assert.equal(sha(sqliteLogicalSnapshot(path)), before);
    db.exec("UPDATE jobs SET jd='changed';");
    assert.notEqual(sha(sqliteLogicalSnapshot(path)), before);
  } finally { db.close(); await rm(dir, { recursive: true, force: true }); }
});
