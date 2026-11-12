import { createInterface } from 'node:readline';
import { mkdir, appendFile, readFile, access } from 'node:fs/promises';
import { resolve, join, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { acquireCollectionLock } from './lock.mjs';
import { DATA_DIR, ROOT, repoRelative } from './paths.mjs';
import { CAPTURE_KINDS, captureMatchesAdmission, validateWebAdmission } from './capture-contract.mjs';
import { validateBrowserAdmission, classifyBrowserCapture } from './browser-admission.mjs';

const directory = resolve(ROOT, process.argv[2] ?? '');
if (!directory.startsWith(resolve(DATA_DIR, 'research') + sep)) throw new Error('RESEARCH_CHILD_DIRECTORY_REQUIRED');
await mkdir(join(directory, 'raw'), { recursive: true });
const lease = await acquireCollectionLock();
const ledger = join(directory, 'web-session.jsonl');
let historical;
try { historical = await readFile(ledger, 'utf8'); }
catch (error) { if (error.code !== 'ENOENT') { lease.release(); throw error; } historical = ''; }
const seen = new Set();
const history = [];
try {
  for (const line of historical.split('\n').filter(Boolean)) {
    const event = JSON.parse(line);
    history.push(event);
    if (event.id !== undefined && event.id !== null) seen.add(String(event.id));
  }
} catch (error) { lease.release(); throw error; }
let active = null;
let closed = false;
let stopping = false;
let finalization;
const admissionAbort = new AbortController();
const emit = (value) => process.stdout.write(JSON.stringify(value) + '\n');
let recordTail = Promise.resolve();
const record = value => (recordTail = recordTail.then(() => appendFile(ledger, JSON.stringify(value) + '\n')));
const close = () => { if (!closed) { closed = true; lease.release(); } };
const input = createInterface({ input: process.stdin });
const finalize = (reason = 'Input ended before capture finished') => {
  if (finalization) return finalization;
  finalization = (async () => {
    try {
      if (active) {
        const interrupted = active;
        active = null;
        lease.afterRequest();
        await record({ event: 'interrupted', ...interrupted, recorded_at: new Date().toISOString(), reason });
      }
      await recordTail;
    } finally { close(); input.close(); process.stdin.pause(); }
  })();
  return finalization;
};
const stop = signal => {
  if (stopping) return;
  stopping = true;
  admissionAbort.abort();
  input.close();
  process.stdin.pause();
  finalize(signal).then(() => process.exit(1), error => {
    process.stderr.write(error.message + '\n'); process.exit(1);
  });
};
process.on('SIGTERM', () => stop('SIGTERM'));
process.on('SIGINT', () => stop('SIGINT'));
emit({ status: 'session_ready', ledger: repoRelative(ledger), pid: process.pid, network_calls: 0 });
try {
  for await (const line of input) {
    if (stopping) break;
    try {
      const command = JSON.parse(line);
      if (command.op === 'close') {
        if (active) throw new Error('CAPTURE_NOT_FINISHED');
        break;
      }
      if (command.op === 'begin') {
        if (active || typeof command.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(command.id)) throw new Error('INVALID_OR_ACTIVE_CAPTURE');
        if (seen.has(command.id)) throw new Error('CAPTURE_ID_ALREADY_USED');
        try { await access(join(directory, 'raw', command.id + '.json')); throw new Error('CAPTURE_FILE_ALREADY_EXISTS'); }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
        const evidenceKind = command.kind ?? 'web_tool_result_not_raw_http';
        if (!CAPTURE_KINDS.includes(evidenceKind)) throw new Error('INVALID_EVIDENCE_KIND');
        validateWebAdmission({ ...command, kind: evidenceKind });
        validateBrowserAdmission({ ...command, kind: evidenceKind }, history);
        const admittedAt = await lease.beforeRequest({ signal: admissionAbort.signal });
        if (stopping) break;
        active = { id: command.id, operation: command.operation, request: command.request,
          route: command.route, company: command.company ?? null, kind: evidenceKind, queue_admitted_at: admittedAt };
        await record({ event: 'begin', ...active });
        if (stopping) break;
        history.push({ event: 'begin', ...active });
        seen.add(command.id);
        emit({ status: 'admitted', ...active });
      } else if (command.op === 'finish') {
        if (!active || active.id !== command.id) throw new Error('CAPTURE_ID_MISMATCH');
        const path = join(directory, 'raw', active.id + '.json');
        const bytes = await readFile(path);
        if (stopping) break;
        const capture = JSON.parse(bytes);
        if (!captureMatchesAdmission(capture, active)) throw new Error('CAPTURE_RECORD_MISMATCH');
        lease.afterRequest();
        const receipt = { event: 'finish', ...active, persisted_at: new Date().toISOString(),
          outcome: active.kind === 'browser_visible_page_capture' ? classifyBrowserCapture(capture) : 'web_tool_result_recorded',
          evidence_file: repoRelative(path), evidence_sha256: createHash('sha256').update(bytes).digest('hex'),
          timing_scope: 'Queue admission and result persistence; actual tool-call timestamps are recorded separately in the capture' };
        active = null;
        await record(receipt);
        emit({ status: 'recorded', ...receipt });
      } else if (command.op === 'abort') {
        if (!active || active.id !== command.id) throw new Error('CAPTURE_ID_MISMATCH');
        lease.afterRequest();
        const receipt = { event: 'interrupted', ...active, recorded_at: new Date().toISOString(),
          reason: String(command.reason ?? 'Capture unavailable; no result fabricated').slice(0, 500) };
        active = null;
        await record(receipt);
        emit({ status: 'aborted', ...receipt });
      } else throw new Error('UNKNOWN_COMMAND');
    } catch (error) { emit({ status: 'error', error: error.message }); }
  }
} finally {
  await finalize();
}
