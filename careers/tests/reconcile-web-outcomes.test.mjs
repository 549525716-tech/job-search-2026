import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

test('reconciliation never promotes blank, diagnostic, error or incomplete reads to success', async t => {
  const root = await mkdtemp(join(tmpdir(), 'careers-outcomes-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const dir = join(root, 'research/run');
  await mkdir(join(dir, 'raw'), { recursive: true });
  await writeFile(join(dir, 'jobs.json'), '[]');
  await writeFile(join(dir, 'scope.json'), '{}');
  const page = { url: 'https://example.com/job', text: 'Hello Test User, job description', authenticated: true, account_evidence: 'Test User' };
  const cases = [
    ['blank', { ...page, url: 'about:blank' }, 'blank_page'],
    ['diagnostic', { ...page, evidence_source: 'app_lifecycle_log' }, 'diagnostic_only'],
    ['error', { ...page, error: 'Debugger unattached' }, 'technical_failure'],
    ['stopped', { ...page, access_stop: true }, 'access_stop'],
    ['empty', { ...page, text: '' }, 'no_visible_text'],
    ['cancel', { ...page, status: 'user_interaction_interrupted' }, 'interrupted'],
    ['invalid', { ...page, url: '' }, 'unverified_capture'],
    ['valid', page, 'page_read'],
    ['noreceipt', page, 'unreceipted_capture'],
    ['receipt_failure', page, 'blank_page', 'blank_page'],
    ['web_error', { error: 'Request failed' }, 'technical_failure', null, 'web_tool_result_not_raw_http'],
    ['web_empty', '', 'no_visible_text', null, 'web_tool_result_not_raw_http'],
  ];
  const ledger = [];
  for (const [id, result, , outcome, kind = 'browser_visible_page_capture'] of cases) {
    const capture = { kind, operation: 'open', route: 'A', request: {}, started_at: '2026-09-21T10:00:00Z', observed_at: '2026-09-21T10:00:01Z', result };
    await writeFile(join(dir, 'raw', id + '.json'), JSON.stringify(capture));
    ledger.push({ ...capture, result: undefined, event: 'begin', id, company: id });
    if (id !== 'noreceipt') ledger.push({ event: 'finish', id, outcome });
  }
  await writeFile(join(dir, 'web-session.jsonl'), ledger.map(JSON.stringify).join('\n'));
  const hook = join(root, 'hook.mjs');
  await writeFile(hook, `import { registerHooks } from 'node:module';
registerHooks({load(url,context,next){
 if(url.endsWith('/careers/paths.mjs'))return {format:'module',shortCircuit:true,source:${JSON.stringify(`export const ROOT=${JSON.stringify(root)},DATA_DIR=ROOT;export const repoRelative=p=>p.slice(ROOT.length+1);`)}};
 if(url.endsWith('/careers/audit-web-session.mjs'))return {format:'module',shortCircuit:true,source:'export async function auditWebSession(){return {issues:[],minimum_cooldown_ms:10000,status:"fixture_only"}}'};
 return next(url,context);
}});`);
  const child = spawnSync(process.execPath, ['--import', pathToFileURL(hook).href, fileURLToPath(new URL('../reconcile-web-sweep.mjs', import.meta.url)), dir], { encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr);
  const inventory = JSON.parse(await readFile(join(dir, 'capture-inventory.json')));
  for (const [id, , expected] of cases) assert.equal(inventory.find(row => row.id === id).status, expected, id);
  const run = JSON.parse(await readFile(join(dir, 'run.json')));
  assert.equal(run.page_reads, 1);
  assert.equal(run.page_read_attempts, cases.length);
  assert.equal(run.failed_or_unverified_captures, cases.length - 1);
});
