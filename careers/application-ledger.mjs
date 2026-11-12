import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { applicationIdentity, legacyOfficialTargetKey, APPLICATION_IDENTITY_VERSION, LEGACY_APPLICATION_IDENTITY_VERSION, sha256 } from './application-identity.mjs';

const digest = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;

// Offline persistence primitive only. This class does not authorize or perform external actions.
export class ApplicationLedger {
  constructor(path = ':memory:', { readOnly = false } = {}) {
    this.db = new DatabaseSync(path, { readOnly });
    this.db.exec('PRAGMA busy_timeout = 5000');
    if (!readOnly) this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS application_targets (
        target_key TEXT PRIMARY KEY, identity_json TEXT NOT NULL,
        attempt_id TEXT NOT NULL, state TEXT NOT NULL,
        snapshot_json TEXT NOT NULL, receipt_json TEXT, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS application_events (
        sequence INTEGER PRIMARY KEY, target_key TEXT NOT NULL,
        attempt_id TEXT NOT NULL, state TEXT NOT NULL, payload_json TEXT NOT NULL, at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS application_identity_mappings (
        legacy_target_key TEXT PRIMARY KEY, target_key TEXT NOT NULL,
        identity_json TEXT NOT NULL, evidence_json TEXT NOT NULL, created_at TEXT NOT NULL
      );
    `);
  }

  close() { this.db.close(); }

  get(targetKey) {
    const row = this.db.prepare('SELECT * FROM application_targets WHERE target_key=?').get(targetKey);
    return row ? { ...row, identity: JSON.parse(row.identity_json), snapshot: JSON.parse(row.snapshot_json),
      receipt: row.receipt_json ? JSON.parse(row.receipt_json) : null } : null;
  }

  legacyMapping(key) {
    // Read-only planning must also work against a database created before v2.
    if (!this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='application_identity_mappings'").get()) return null;
    const row = this.db.prepare('SELECT * FROM application_identity_mappings WHERE legacy_target_key=?').get(key);
    return row ? { ...row, identity: JSON.parse(row.identity_json), evidence: JSON.parse(row.evidence_json) } : null;
  }

  historyFor(identity) {
    if (!identity.target_key) return { status: 'identity_pending', row: null };
    const current = this.get(identity.target_key);
    if (current && current.state !== 'failed_before_send') return { status: 'already_reserved_or_attempted', row: current };
    const legacyKey = legacyOfficialTargetKey(identity);
    const legacy = legacyKey && this.get(legacyKey);
    if (legacy && legacy.state !== 'failed_before_send') {
      const mapping = this.legacyMapping(legacyKey);
      const validMapping = mapping && mapping.identity?.version === APPLICATION_IDENTITY_VERSION
        && mapping.identity.target_key === mapping.target_key
        && legacyOfficialTargetKey(mapping.identity) === legacyKey
        && sha256(JSON.stringify(mapping.identity.basis)) === mapping.target_key
        && nonempty(mapping.evidence?.evidence_ref) && digest(mapping.evidence?.evidence_sha256);
      if (!validMapping) return { status: 'history_reconciliation_required', row: legacy, legacy_target_key: legacyKey };
      if (mapping.target_key === identity.target_key) {
        return { status: 'already_reserved_or_attempted', row: legacy, legacy_target_key: legacyKey };
      }
    }
    return { status: 'no_blocking_local_record', row: current };
  }

  reconcileLegacyTarget({ legacyTargetKey, job, candidateId, evidenceRef, evidenceSha256 }) {
    const identity = applicationIdentity(job, candidateId);
    if (!identity.target_key || legacyOfficialTargetKey(identity) !== legacyTargetKey
      || !nonempty(evidenceRef) || !digest(evidenceSha256)) throw new Error('Legacy reconciliation requires matching identity and source evidence');
    return this.transaction(() => {
      const row = this.get(legacyTargetKey);
      if (!row || row.identity.version !== LEGACY_APPLICATION_IDENTITY_VERSION
        || sha256(JSON.stringify(row.identity.basis)) !== legacyTargetKey
        || JSON.stringify(row.identity.basis) !== JSON.stringify(identity.basis.slice(0, 5))) {
        throw new Error('Legacy identity cannot be mapped unambiguously');
      }
      const prior = this.legacyMapping(legacyTargetKey);
      if (prior) {
        if (prior.target_key !== identity.target_key) throw new Error('Legacy identity already mapped to another contact');
        return prior;
      }
      const evidence = { evidence_ref: evidenceRef, evidence_sha256: evidenceSha256 };
      // Alias history without rewriting the old attempt, material bindings or receipts.
      this.db.prepare('INSERT INTO application_identity_mappings VALUES(?,?,?,?,?)')
        .run(legacyTargetKey, identity.target_key, JSON.stringify(identity), JSON.stringify(evidence), new Date().toISOString());
      this.event(legacyTargetKey, row.attempt_id, 'identity_reconciled', { identity, evidence });
      return this.legacyMapping(legacyTargetKey);
    });
  }

  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }

  event(key, attempt, state, payload) {
    this.db.prepare('INSERT INTO application_events(target_key,attempt_id,state,payload_json,at) VALUES(?,?,?,?,?)')
      .run(key, attempt, state, JSON.stringify(payload), new Date().toISOString());
  }

  reserve({ job, candidateId, snapshot }) {
    const identity = applicationIdentity(job, candidateId);
    if (!identity.target_key) return { status: 'identity_pending', missing: identity.missing };
    const key = identity.target_key;
    for (const field of ['jd_sha256', 'profile_sha256', 'artifact_sha256', 'review_sha256', 'authorization_sha256']) {
      if (!digest(snapshot?.[field])) throw new Error(`Missing snapshot digest: ${field}`);
    }
    if (snapshot.target_key !== key) throw new Error('Snapshot belongs to another application target');
    return this.transaction(() => {
      const history = this.historyFor(identity);
      if (['already_reserved_or_attempted', 'history_reconciliation_required'].includes(history.status)) {
        return { status: history.status, target_key: key, state: history.row.state,
          history_target_key: history.row.target_key };
      }
      const attemptId = randomUUID();
      this.db.prepare(`INSERT INTO application_targets VALUES(?,?,?,?,?,NULL,?)
        ON CONFLICT(target_key) DO UPDATE SET attempt_id=excluded.attempt_id,state=excluded.state,
        identity_json=excluded.identity_json,snapshot_json=excluded.snapshot_json,receipt_json=NULL,updated_at=excluded.updated_at`)
        .run(key, JSON.stringify(identity), attemptId, 'reserved', JSON.stringify(snapshot), new Date().toISOString());
      this.event(key, attemptId, 'reserved', { snapshot, identity });
      return { status: 'reserved', target_key: key, attempt_id: attemptId };
    });
  }

  transition(key, attemptId, from, to, payload, receipt = null) {
    return this.transaction(() => {
      const row = this.get(key);
      if (!row || row.attempt_id !== attemptId || !from.includes(row.state)) throw new Error('Stale attempt or invalid application transition');
      this.db.prepare('UPDATE application_targets SET state=?,receipt_json=COALESCE(?,receipt_json),updated_at=? WHERE target_key=?')
        .run(to, receipt ? JSON.stringify(receipt) : null, new Date().toISOString(), key);
      this.event(key, attemptId, to, payload);
      return this.get(key);
    });
  }

  cancelBeforeSend(key, attemptId, reason) {
    if (!nonempty(reason)) throw new Error('Cancellation requires a reason');
    return this.transition(key, attemptId, ['reserved'], 'failed_before_send', { reason });
  }

  markDispatch(key, attemptId, snapshot) {
    const row = this.get(key);
    if (!row || sha256(JSON.stringify(row.snapshot)) !== sha256(JSON.stringify(snapshot))) throw new Error('Pinned material/authorization changed');
    // Commit uncertainty BEFORE any potentially external send. Expiry never retries this state.
    return this.transition(key, attemptId, ['reserved'], 'submission_unknown', { snapshot });
  }

  recordReceipt(key, attemptId, receipt) {
    const row = this.get(key);
    let https = false;
    try { const url = new URL(receipt?.url); https = url.protocol === 'https:' && !url.username && !url.password; } catch { /* invalid receipt */ }
    if (!https || receipt?.target_key !== key || !nonempty(receipt?.evidence_ref)
      || !digest(receipt?.evidence_sha256) || receipt?.artifact_sha256 !== row?.snapshot.artifact_sha256
      || !nonempty(receipt?.source_confirmation_id)) throw new Error('Receipt must bind target, artifact and source evidence');
    return this.transition(key, attemptId, ['submission_unknown'], 'submitted_verified', { receipt }, receipt);
  }

  recordOutcome(key, attemptId, state, evidenceRef) {
    if (!['interview', 'rejected', 'withdrawn'].includes(state) || !nonempty(evidenceRef)) throw new Error('Outcome requires a supported state and evidence');
    return this.transition(key, attemptId, ['submitted_verified', 'interview'], state, { evidence_ref: evidenceRef });
  }
}
