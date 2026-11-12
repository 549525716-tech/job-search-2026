import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applicationIdentity, legacyOfficialTargetKey, LEGACY_APPLICATION_IDENTITY_VERSION, sha256 } from '../application-identity.mjs';
import { ApplicationLedger } from '../application-ledger.mjs';
import { planApplications } from '../application-planner.mjs';

const candidate = 'candidate-1';
const job = (changes = {}) => ({ title: 'Sales', description_complete: true, description_text: 'Enterprise sales',
  application_identity: { kind: 'official', channel: 'official', employer_id: 'E1', tenant_id: 'T1', requisition_id: 'R1',
    contact_status: 'verified_contact', publisher_id: 'HR1', verified: true, evidence_ref: 'fixture://identity', ...changes } });
const identity = value => applicationIdentity(value, candidate);
const snapshot = value => ({ target_key: identity(value).target_key, jd_sha256: sha256('jd'), profile_sha256: sha256('profile'),
  artifact_sha256: sha256('resume'), review_sha256: sha256('review'), authorization_sha256: sha256('authorization') });
const reserve = (ledger, value) => ledger.reserve({ job: value, candidateId: candidate, snapshot: snapshot(value) });
const profile = { content: 'Confirmed synthetic facts', sha256: sha256('Confirmed synthetic facts') };

function seedLegacy(ledger, value, state = 'submission_unknown') {
  const current = identity(value), basis = current.basis.slice(0, 5), target_key = sha256(JSON.stringify(basis));
  const oldIdentity = { version: LEGACY_APPLICATION_IDENTITY_VERSION, status: 'identified', target_key, basis,
    evidence_ref: 'fixture://legacy-identity', missing: [] };
  const oldSnapshot = { ...snapshot(value), target_key };
  const receipt = state === 'rejected' ? JSON.stringify({ target_key, source_confirmation_id: 'old-receipt' }) : null;
  ledger.db.prepare('INSERT INTO application_targets VALUES(?,?,?,?,?,?,?)')
    .run(target_key, JSON.stringify(oldIdentity), 'legacy-attempt', state, JSON.stringify(oldSnapshot), receipt, '2026-10-17T00:00:00Z');
  ledger.event(target_key, 'legacy-attempt', state, { snapshot: oldSnapshot });
  return target_key;
}

const reconcile = (ledger, legacyTargetKey, value) => ledger.reconcileLegacyTarget({ legacyTargetKey, job: value,
  candidateId: candidate, evidenceRef: 'fixture://historical-contact-readback', evidenceSha256: sha256('readback') });

test('official contact-free entry is explicit, distinct from contacts, and not inferred from unknown data', () => {
  const publicEntry = job({ contact_status: 'verified_no_contact', publisher_id: '' });
  assert.equal(identity(publicEntry).status, 'identified');
  assert.notEqual(identity(publicEntry).target_key, identity(job()).target_key);
  assert.equal(identity(publicEntry).target_key, identity(job({ contact_status: 'verified_no_contact', publisher_id: '', channel: 'mirror' })).target_key);
  for (const value of [job({ contact_status: undefined }), job({ contact_status: 'unknown' }),
    job({ publisher_id: '', publisher_name: 'Lee' }), job({ contact_status: 'verified_no_contact' }),
    job({ contact_status: 'verified_no_contact', publisher_id: '', publisher_name: 'Lee' }),
    { ...job({ publisher_id: '' }), recruiter_name: 'Lee', recruiter_id: 'not-trusted' }]) {
    assert.equal(identity(value).target_key, null);
  }
  assert.notEqual(identity(job({ publisher_id: 'HR1' })).target_key, identity(job({ publisher_id: 'hr1' })).target_key);
});

test('platform key remains byte-for-byte compatible with v1', () => {
  const value = job({ kind: 'platform', channel: 'boss' });
  const oldKey = sha256(JSON.stringify(['platform', 'boss', 'E1', 'sales', 'HR1', candidate]));
  assert.equal(identity(value).target_key, oldKey);
  const ledger = new ApplicationLedger();
  try {
    const attempt = reserve(ledger, value);
    ledger.db.prepare('UPDATE application_targets SET identity_json=? WHERE target_key=?')
      .run(JSON.stringify({ ...identity(value), version: LEGACY_APPLICATION_IDENTITY_VERSION }), oldKey);
    ledger.markDispatch(oldKey, attempt.attempt_id, snapshot(value));
    assert.equal(reserve(ledger, value).state, 'submission_unknown');
  } finally { ledger.close(); }
});

test('unmapped legacy attempts block every contact and the public entry, but not another requisition/candidate', () => {
  for (const state of ['reserved', 'submission_unknown', 'submitted_verified', 'interview', 'rejected', 'withdrawn']) {
    const ledger = new ApplicationLedger();
    try {
      const oldKey = seedLegacy(ledger, job(), state);
      for (const value of [job(), job({ publisher_id: 'HR2' }), job({ contact_status: 'verified_no_contact', publisher_id: '' })]) {
        const result = reserve(ledger, value);
        assert.equal(result.status, 'history_reconciliation_required');
        assert.equal(result.history_target_key, oldKey);
        assert.equal(result.state, state);
      }
      assert.equal(reserve(ledger, job({ requisition_id: 'R2' })).status, 'reserved');
      assert.equal(ledger.historyFor(applicationIdentity(job(), 'candidate-2')).status, 'no_blocking_local_record');
      const report = planApplications([job(), job({ publisher_id: 'HR2' })], candidate, profile, ledger);
      assert.equal(report.counts.history_reconciliation_required, 2);
      assert(report.items.every(item => item.history_target_key === oldKey && item.ready_to_submit === false));
    } finally { ledger.close(); }
  }
});

test('evidence-bound legacy alias retains old receipts and unknown status, permits only other verified contacts', () => {
  for (const state of ['submission_unknown', 'rejected', 'withdrawn']) {
    const ledger = new ApplicationLedger();
    try {
      const oldKey = seedLegacy(ledger, job(), state), before = ledger.get(oldKey);
      const mapping = reconcile(ledger, oldKey, job());
      assert.equal(mapping.target_key, identity(job()).target_key);
      assert.deepEqual(ledger.get(oldKey), before);
      assert.equal(ledger.get(identity(job()).target_key), null, 'no replacement history or fabricated attempt');
      assert.equal(reserve(ledger, job()).status, 'already_reserved_or_attempted');
      assert.equal(reserve(ledger, job()).state, state);
      assert.equal(reserve(ledger, job({ publisher_id: 'HR2' })).status, 'reserved');
      assert.equal(planApplications([job()], candidate, profile, ledger).counts.already_reserved_or_attempted, 1);
      reconcile(ledger, oldKey, job());
      assert.equal(ledger.db.prepare('SELECT COUNT(*) AS n FROM application_events').get().n, 3);
      assert.throws(() => reconcile(ledger, oldKey, job({ publisher_id: 'HR3' })), /already mapped/);
      assert.throws(() => reconcile(ledger, oldKey, job({ requisition_id: 'R2' })), /matching identity/);
      assert.throws(() => ledger.reconcileLegacyTarget({ legacyTargetKey: oldKey, job: job(), candidateId: candidate }), /evidence/);
    } finally { ledger.close(); }
  }
});

test('legacy public-entry mapping requires explicit evidence; pre-send cancellation alone permits re-preparation', () => {
  const ledger = new ApplicationLedger();
  try {
    const publicEntry = job({ contact_status: 'verified_no_contact', publisher_id: '' });
    const oldKey = seedLegacy(ledger, publicEntry);
    assert.equal(reserve(ledger, publicEntry).status, 'history_reconciliation_required');
    reconcile(ledger, oldKey, publicEntry);
    assert.equal(reserve(ledger, publicEntry).state, 'submission_unknown');
    assert.equal(reserve(ledger, job()).status, 'reserved');
    const cancelled = job({ requisition_id: 'cancelled' });
    seedLegacy(ledger, cancelled, 'failed_before_send');
    assert.equal(reserve(ledger, cancelled).status, 'reserved');
  } finally { ledger.close(); }
});

test('read-only v1 databases fail closed without schema writes; aliases and timeout blocks survive reopening', () => {
  const dir = mkdtempSync(join(tmpdir(), 'career-legacy-'));
  const path = join(dir, 'legacy.sqlite');
  try {
    const initial = new ApplicationLedger(path);
    const oldKey = seedLegacy(initial, job());
    initial.db.exec('DROP TABLE application_identity_mappings');
    initial.close();
    const old = new ApplicationLedger(path, { readOnly: true });
    try {
      assert.equal(old.historyFor(identity(job())).status, 'history_reconciliation_required');
      assert.equal(old.db.prepare("SELECT name FROM sqlite_master WHERE name='application_identity_mappings'").get(), undefined);
    } finally { old.close(); }
    const writable = new ApplicationLedger(path);
    reconcile(writable, oldKey, job()); writable.close();
    const reopened = new ApplicationLedger(path, { readOnly: true });
    try {
      assert.equal(reopened.historyFor(identity(job())).status, 'already_reserved_or_attempted');
      assert.equal(reopened.historyFor(identity(job())).row.state, 'submission_unknown');
      assert.equal(legacyOfficialTargetKey(identity(job())), oldKey);
    } finally { reopened.close(); }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('official timeout does not retry, but different contact remains independently reservable', () => {
  const ledger = new ApplicationLedger();
  try {
    const first = reserve(ledger, job());
    ledger.markDispatch(first.target_key, first.attempt_id, snapshot(job()));
    assert.equal(reserve(ledger, job({ channel: 'mirror' })).state, 'submission_unknown');
    assert.throws(() => ledger.cancelBeforeSend(first.target_key, first.attempt_id, 'timeout'));
    assert.equal(reserve(ledger, job({ publisher_id: 'HR2' })).status, 'reserved');
    const plan = planApplications([job(), job({ publisher_id: 'HR3' }), job({ publisher_id: 'HR3' })], candidate, profile, ledger);
    assert.equal(plan.items.length, 3);
    assert.deepEqual(plan.counts, { already_reserved_or_attempted: 1, resume_task_pending: 1, same_target_in_batch: 1 });
  } finally { ledger.close(); }
});

test('invalid legacy version and malformed alias cannot release blocked history', () => {
  const ledger = new ApplicationLedger();
  try {
    const oldKey = seedLegacy(ledger, job());
    const original = ledger.get(oldKey).identity;
    ledger.db.prepare('UPDATE application_targets SET identity_json=? WHERE target_key=?')
      .run(JSON.stringify({ ...original, version: 'unrecognized' }), oldKey);
    assert.throws(() => reconcile(ledger, oldKey, job()), /unambiguously/);
    assert.equal(reserve(ledger, job()).status, 'history_reconciliation_required');
    ledger.db.prepare('UPDATE application_targets SET identity_json=? WHERE target_key=?').run(JSON.stringify(original), oldKey);
    reconcile(ledger, oldKey, job());
    ledger.db.prepare('UPDATE application_identity_mappings SET target_key=?').run(sha256('wrong'));
    assert.equal(reserve(ledger, job()).status, 'history_reconciliation_required');
    assert.equal(reserve(ledger, job({ publisher_id: 'HR2' })).status, 'history_reconciliation_required');
  } finally { ledger.close(); }
});

test('pre-send v2 cancellation cannot shadow an unresolved v1 attempt', () => {
  const ledger = new ApplicationLedger();
  try {
    const attempt = reserve(ledger, job());
    ledger.cancelBeforeSend(attempt.target_key, attempt.attempt_id, 'cancelled before send');
    seedLegacy(ledger, job());
    assert.equal(reserve(ledger, job()).status, 'history_reconciliation_required');
    assert.equal(planApplications([job()], candidate, profile, ledger).counts.history_reconciliation_required, 1);
  } finally { ledger.close(); }
});
