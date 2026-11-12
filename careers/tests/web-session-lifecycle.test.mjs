import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';

async function fixture(t, { history = [], existing = false, commands, signal, waiting = false }) {
  const root = await mkdtemp(join(tmpdir(), 'web-session-contract-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const dir = join(root, 'research/run');
  await mkdir(join(dir, 'raw'), { recursive: true });
  if (history.length) await writeFile(join(dir, 'web-session.jsonl'), history.map(JSON.stringify).join('\n') + '\n');
  if (existing) await writeFile(join(dir, 'raw/a.json'), 'original');
  // Only dependency isolation for tests: no real queue, browser, network or production writes.
  const hook = join(root, 'test-hook.mjs');
  await writeFile(hook, `import { registerHooks } from 'node:module';
registerHooks({ load(url, context, next) {
 if (url.endsWith('/careers/paths.mjs')) return {format:'module', shortCircuit:true, source:${JSON.stringify(`export const ROOT=${JSON.stringify(root)}, DATA_DIR=ROOT; export const repoRelative=p=>p.slice(ROOT.length+1);`)}};
 if (url.endsWith('/careers/lock.mjs')) return {format:'module', shortCircuit:true, source:${JSON.stringify(`export async function acquireCollectionLock(){return {beforeRequest:async({signal}={})=>{${waiting ? `console.log(JSON.stringify({status:'waiting'})); await new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('Aborted')),{once:true}));` : ''}return new Date().toISOString()},afterRequest(){console.log(JSON.stringify({status:'cooled'}))},release(){console.log(JSON.stringify({status:'released'}))}}}`)}};
 return next(url, context);
}});`);
  const child = spawn(process.execPath, ['--import', pathToFileURL(hook).href, fileURLToPath(new URL('../web-session.mjs', import.meta.url)), dir], { stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  let signalled = false;
  child.stdout.on('data', data => {
    stdout += data;
    if (signal && !signalled && stdout.includes('"status":"' + (waiting ? 'waiting' : 'admitted') + '"')) {
      signalled = true; child.kill(signal);
    }
  });
  child.stderr.on('data', data => { stderr += data; });
  const timer = setTimeout(() => child.kill('SIGTERM'), 5000);
  const finished = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', code => resolve(code));
  });
  if (signal) child.stdin.write(commands.map(JSON.stringify).join('\n') + '\n');
  else child.stdin.end(commands.map(JSON.stringify).join('\n') + '\n');
  let code;
  try { code = await finished; } finally { clearTimeout(timer); }
  assert.equal(code, signal ? 1 : 0, stderr);
  return { output: stdout.trim().split('\n').map(JSON.parse), ledger: await readFile(join(dir, 'web-session.jsonl'), 'utf8').catch(() => ''),
    original: existing ? await readFile(join(dir, 'raw/a.json'), 'utf8') : null };
}

const begin = { op: 'begin', id: 'a', operation: 'search', request: { search_query: [{ q: 'AI sales' }] }, route: 'B' };
test('reopening a run cannot reuse a historic capture ID or overwrite raw evidence', async t => {
  for (const options of [{ history: [{ event: 'begin', id: 'a' }] }, { existing: true }]) {
    const result = await fixture(t, { ...options, commands: [begin, { op: 'close' }] });
    assert.match(result.output.find(item => item.status === 'error').error, /ALREADY_USED|ALREADY_EXISTS/);
    assert.equal(result.output.filter(item => item.status === 'admitted').length, 0);
    if (options.existing) assert.equal(result.original, 'original');
  }
});
test('capture IDs must be strings and cannot collide with legacy numeric IDs', async t => {
  const result = await fixture(t, { history: [{ event: 'begin', id: 7 }], commands: [
    ...[7, ['a'], {}].map(id => ({ ...begin, id })), { ...begin, id: '7' }, { op: 'close' }
  ] });
  assert.deepEqual(result.output.filter(item => item.status === 'error').map(item => item.error),
    ['INVALID_OR_ACTIVE_CAPTURE', 'INVALID_OR_ACTIVE_CAPTURE', 'INVALID_OR_ACTIVE_CAPTURE', 'CAPTURE_ID_ALREADY_USED']);
  assert.equal(result.output.filter(item => item.status === 'admitted').length, 0);
});
test('expected_url-only handoff cannot repeat after abort or process restart', async t => {
  const entry = { op: 'begin', id: 'o1', kind: 'browser_visible_page_capture', operation: 'ordinary-page-open', request: { browser: 'iab', executor: 'codex_app.open_in_codex', expected_url: 'https://c.liepin.com/' } };
  const duplicate = { ...entry, id: 'o2', request: { ...entry.request, url: entry.request.expected_url } };
  for (const history of [[], [{ ...entry, event: 'begin' }]]) {
    const result = await fixture(t, { history, commands: [
      ...(history.length ? [] : [entry, { op: 'abort', id: 'o1' }]), duplicate, { op: 'close' }
    ] });
    assert.ok(result.output.some(item => item.error === 'ORDINARY_HANDOFF_ALREADY_ATTEMPTED'));
  }
});
test('SIGINT and SIGTERM record interruptions and cool before releasing the lease', async t => {
  for (const signal of ['SIGINT', 'SIGTERM']) {
    const result = await fixture(t, { commands: [begin], signal });
    const events = result.ledger.trim().split('\n').map(JSON.parse);
    assert.deepEqual(events.map(event => event.event), ['begin', 'interrupted']);
    assert.equal(events[1].reason, signal);
    assert.deepEqual(result.output.filter(item => ['cooled', 'released'].includes(item.status)).map(item => item.status), ['cooled', 'released']);
  }
});
test('a signal while waiting for admission releases without fabricating a capture', async t => {
  for (const signal of ['SIGINT', 'SIGTERM']) {
    const result = await fixture(t, { commands: [begin], signal, waiting: true });
    assert.equal(result.ledger, '');
    assert.equal(result.output.filter(item => item.status === 'released').length, 1);
    assert.equal(result.output.filter(item => item.status === 'admitted').length, 0);
  }
});
test('an interrupted read can abort and close without inventing a result', async t => {
  const result = await fixture(t, { commands: [begin, { op: 'abort', id: 'a', reason: 'Tab disappeared' }, { op: 'close' }] });
  assert.ok(result.output.some(item => item.status === 'aborted'));
  assert.match(result.ledger, /interrupted/);
  assert.doesNotMatch(result.ledger, /"event":"finish"/);
});
test('browser quarantine and one-action pacing apply at the real session entry point', async t => {
  const result = await fixture(t, { commands: [
    { ...begin, request: { search_query: [{ q: 'one' }, { q: 'two' }] } },
    { ...begin, request: { ...begin.request, finance: [{ ticker: 'TEST' }] } },
    { ...begin, kind: 'browser_visible_page_capture', operation: 'read', request: { browser: 'iab', url: 'https://c.liepin.com/' } },
    { op: 'close' }
  ] });
  assert.deepEqual(result.output.filter(item => item.status === 'error').map(item => item.error), ['ONE_WEB_ACTION_PER_ADMISSION_REQUIRED', 'ONE_WEB_ACTION_PER_ADMISSION_REQUIRED', 'BROWSER_CONTROL_QUARANTINED']);
  assert.equal(result.ledger, '');
});
