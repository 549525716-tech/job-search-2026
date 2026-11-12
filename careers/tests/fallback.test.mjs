import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runFallback } from '../fallback.mjs';
import { persistenceError } from '../persistence.mjs';

async function fixture(work) {
  const directory = await mkdtemp(join(tmpdir(), 'careers-fallback-'));
  try { return await work(directory); } finally { await rm(directory, { recursive: true, force: true }); }
}
const clock = () => '2026-09-22T00:00:00.000Z';
const collected = (id, status = 'success', jobs = [], errors = [], complete = status === 'success' || status === 'empty') => ({
  runs: [{ run_id: `${id}-run`, status, complete, jobs, errors, started_at: clock(), finished_at: clock(), artifacts: { report_json: `${id}.json` } }],
});

test('freezes every source before collection, deduplicates, and runs serially', async () => fixture(async (outputDir) => {
  const calls = [];
  let active = 0;
  let peak = 0;
  const result = await runFallback({ companyIds: ['bailian-ai', 'deepseek', 'bailian-ai'], outputDir, now: clock,
    collectFn: async ({ companyId }) => {
      calls.push(companyId);
      const [runDirectory] = await readdir(join(outputDir, 'fallback-runs'));
      const saved = JSON.parse(await readFile(join(outputDir, 'fallback-runs', runDirectory, 'run.json'), 'utf8'));
      if (calls.length === 1) {
        assert.deepEqual(saved.sources.map((source) => source.company_id), ['bailian-ai', 'deepseek']);
        assert.equal(saved.sources[0].status, 'running');
        assert.equal(saved.sources[1].status, 'pending');
      }
      peak = Math.max(peak, ++active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
      return collected(companyId);
    } });
  assert.deepEqual(calls, ['bailian-ai', 'deepseek']);
  assert.equal(peak, 1);
  assert.equal(result.status, 'completed');
  assert.match(await readFile(result.artifacts.summary_markdown, 'utf8'), /not a full-market completion claim/);
}));

test('a recoverable source failure updates one entry and continues to the next source', async () => fixture(async (outputDir) => {
  const calls = [];
  const result = await runFallback({ companyIds: ['bailian-ai', 'deepseek'], outputDir, now: clock,
    collectFn: async ({ companyId }) => { calls.push(companyId); if (companyId === 'bailian-ai') throw Object.assign(new Error('source failed'), { code: 'HTTP_ACCESS_STOP' }); return collected(companyId); } });
  assert.deepEqual(calls, ['bailian-ai', 'deepseek']);
  assert.equal(result.status, 'partial');
  assert.equal(result.sources.length, 2);
  assert.equal(result.sources[0].status, 'failed');
  assert.equal(result.sources[1].status, 'success');
}));

test('registry access blocks are skipped without collector calls', async () => fixture(async (outputDir) => {
  let calls = 0;
  const result = await runFallback({ companyIds: ['minimax'], outputDir, now: clock, collectFn: async () => { calls++; return collected('minimax'); } });
  assert.equal(calls, 0);
  assert.equal(result.sources[0].status, 'blocked');
  assert.equal(result.sources[0].errors[0].code, 'BROWSER_ADAPTER_QUARANTINED');
}));

test('unknown IDs are not scanned and empty remains distinct from partial', async () => fixture(async (outputDir) => {
  const result = await runFallback({ companyIds: ['unknown', 'bailian-ai', 'deepseek'], outputDir, now: clock,
    collectFn: async ({ companyId }) => companyId === 'bailian-ai' ? collected(companyId, 'empty') : collected(companyId, 'partial', [{ id: 'observed' }]) });
  assert.equal(result.sources[0].status, 'not_scanned');
  assert.equal(result.sources[1].status, 'empty');
  assert.equal(result.sources[2].status, 'partial');
  assert.equal(result.sources[2].complete, false);
}));

test('running, incomplete success, and malformed empty collector returns become source failures', async () => fixture(async (outputDir) => {
  const returns = [collected('bailian-ai', 'running', [], [], false), collected('deepseek', 'success', [], [], false)];
  const result = await runFallback({ companyIds: ['bailian-ai', 'deepseek'], outputDir, now: clock,
    collectFn: async () => returns.shift() });
  assert.deepEqual(result.sources.map((source) => source.status), ['failed', 'failed']);
  assert.ok(result.sources.every((source) => source.errors[0].code === 'COLLECTOR_RESULT_INVALID'));
}));

test('returned global lock errors terminate and preserve the remaining source as pending', async () => fixture(async (outputDir) => {
  let calls = 0;
  const result = await runFallback({ companyIds: ['bailian-ai', 'deepseek'], outputDir, now: clock,
    collectFn: async ({ companyId }) => { calls++; return collected(companyId, 'failed', [], [{ code: 'COLLECTION_LOCK_LOST', message: 'lock no longer held' }]); } });
  assert.equal(calls, 1);
  assert.equal(result.status, 'terminated');
  assert.equal(result.finished_at, clock());
  assert.equal(result.sources[0].status, 'terminated');
  assert.equal(result.sources[1].status, 'pending');
}));

test('known SQLite and lock concurrency failures terminate rather than continuing', async () => fixture(async (outputDir) => {
  for (const failure of [Object.assign(new Error('database failed'), { code: 'ERR_SQLITE_ERROR' }), new Error('Concurrent requests are forbidden')]) {
    let calls = 0;
    const result = await runFallback({ companyIds: ['bailian-ai', 'deepseek'], outputDir, now: clock,
      collectFn: async () => { calls++; throw failure; } });
    assert.equal(calls, 1);
    assert.equal(result.status, 'terminated');
    assert.equal(result.sources[1].status, 'pending');
  }
}));

test('checkpoint write failure after collection rejects without catching or starting another source', async () => fixture(async (outputDir) => {
  const calls = [];
  await assert.rejects(runFallback({ companyIds: ['bailian-ai', 'deepseek'], outputDir, now: clock,
    collectFn: async ({ companyId }) => {
      calls.push(companyId);
      await rm(join(outputDir, 'fallback-runs'), { recursive: true, force: true });
      await writeFile(join(outputDir, 'fallback-runs'), 'not a directory');
      return collected(companyId);
    } }));
  assert.deepEqual(calls, ['bailian-ai']);
}));

test('initial fallback report write failures reject instead of being hidden', async () => {
  await assert.rejects(runFallback({ companyIds: ['bailian-ai'], outputDir: '/dev/null', now: clock,
    collectFn: async ({ companyId }) => collected(companyId) }));
});

test('persistence stage terminates thrown and returned failures regardless of errno', async () => fixture(async outputDir => {
  for (const code of ['EROFS', 'EMFILE', 'UNLISTED_STORAGE_ERROR']) {
    for (const returnsError of [false, true]) {
      let calls = 0;
      const error = persistenceError('collection_report', Object.assign(new Error('write failed'), {code}));
      const result = await runFallback({companyIds:['bailian-ai','deepseek'], outputDir, now:clock,
        collectFn:async id => {
          calls++;
          if (returnsError) return collected(id.companyId, 'failed', [], [{code:error.code, message:error.message}]);
          throw error;
        }});
      assert.equal(calls,1);
      assert.equal(result.status,'terminated');
      const saved=JSON.parse(await readFile(result.artifacts.run_json,'utf8'));
      assert.equal(saved.sources[1].status,'pending');
      assert.equal(saved.sources[0].complete,false);
    }
  }
}));

test('unwrapped filesystem failures from older collectors stop the batch', async () => fixture(async outputDir => {
  for (const code of ['EROFS', 'EMFILE']) {
    let calls=0;
    const result=await runFallback({companyIds:['bailian-ai','deepseek'],outputDir,
      collectFn:async()=>{calls++;throw Object.assign(new Error('write report failed'),{code,syscall:'open',path:'reports/result.json'});}});
    assert.equal(calls,1);
    assert.equal(result.status,'terminated');
  }
}));
