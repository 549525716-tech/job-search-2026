import { DatabaseSync } from 'node:sqlite';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomInt, randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { CONTROL_PATH } from './paths.mjs';

function alive(pid) {
  try { process.kill(pid, 0); return true; }
  catch (error) { return error.code !== 'ESRCH'; }
}

// A fixed database, rather than a run-local mutex, coordinates every CLI process.
export async function acquireCollectionLock({ controlPath = CONTROL_PATH, waitMs = 300_000 } = {}) {
  await mkdir(dirname(controlPath), { recursive: true });
  const db = new DatabaseSync(controlPath);
  db.exec(`PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS queue (
      seq INTEGER PRIMARY KEY AUTOINCREMENT, token TEXT UNIQUE NOT NULL,
      pid INTEGER NOT NULL, queued_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS lease (
      id INTEGER PRIMARY KEY CHECK(id=1), token TEXT, pid INTEGER,
      acquired_at TEXT, next_request_at INTEGER NOT NULL DEFAULT 0);
    INSERT OR IGNORE INTO lease(id) VALUES(1);`);
  const token = randomUUID();
  db.prepare('INSERT INTO queue(token,pid,queued_at) VALUES(?,?,?)')
    .run(token, process.pid, new Date().toISOString());
  const queued = Date.now();
  let acquired = false;
  try {
    while (!acquired) {
      db.exec('BEGIN IMMEDIATE');
      try {
        for (const ticket of db.prepare('SELECT * FROM queue').all()) {
          if (!alive(ticket.pid)) db.prepare('DELETE FROM queue WHERE token=?').run(ticket.token);
        }
        const owner = db.prepare('SELECT * FROM lease WHERE id=1').get();
        if (owner.pid && !alive(owner.pid)) {
          db.prepare('UPDATE lease SET token=NULL,pid=NULL,acquired_at=NULL WHERE id=1').run();
        }
        const current = db.prepare('SELECT * FROM lease WHERE id=1').get();
        const head = db.prepare('SELECT token FROM queue ORDER BY seq LIMIT 1').get();
        if (!current.token && head?.token === token) {
          db.prepare('UPDATE lease SET token=?,pid=?,acquired_at=? WHERE id=1')
            .run(token, process.pid, new Date().toISOString());
          db.prepare('DELETE FROM queue WHERE token=?').run(token);
          acquired = true;
        }
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
      if (!acquired) {
        if (Date.now() - queued >= waitMs) throw new Error('COLLECTION_QUEUE_TIMEOUT');
        await sleep(250);
      }
    }
  } catch (error) {
    db.prepare('DELETE FROM queue WHERE token=?').run(token);
    db.close();
    throw error;
  }
  let released = false;
  const check = () => {
    if (released || db.prepare('SELECT token FROM lease WHERE id=1').get()?.token !== token) {
      throw new Error('COLLECTION_LOCK_LOST');
    }
  };
  let scheduling = false;
  let inFlight = false;
  return {
    token,
    controlPath,
    async beforeRequest({ signal } = {}) {
      check();
      signal?.throwIfAborted();
      if (scheduling || inFlight) throw new Error('Concurrent requests are forbidden');
      scheduling = true;
      try {
        const next = db.prepare('SELECT next_request_at FROM lease WHERE id=1').get().next_request_at;
        if (next > Date.now()) await sleep(next - Date.now(), undefined, { signal });
        signal?.throwIfAborted();
        check();
        const now = Date.now();
        db.prepare('UPDATE lease SET next_request_at=? WHERE id=1 AND token=?')
          .run(now + randomInt(10_000, 20_001), token);
        inFlight = true;
        return new Date(now).toISOString();
      } finally { scheduling = false; }
    },
    afterRequest(crawlDelayMs = 0) {
      check();
      inFlight = false;
      const next = Date.now() + Math.max(randomInt(10_000, 20_001), crawlDelayMs);
      db.prepare('UPDATE lease SET next_request_at=MAX(next_request_at,?) WHERE id=1 AND token=?')
        .run(next, token);
    },
    release() {
      if (released) return;
      if (inFlight) {
        db.prepare('UPDATE lease SET next_request_at=MAX(next_request_at,?) WHERE id=1 AND token=?')
          .run(Date.now() + randomInt(10_000, 20_001), token);
        inFlight = false;
      }
      db.prepare('UPDATE lease SET token=NULL,pid=NULL,acquired_at=NULL WHERE id=1 AND token=?').run(token);
      db.close();
      released = true;
    },
  };
}
