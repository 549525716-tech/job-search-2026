import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { DATA_DIR, REPORT_DIR } from '../paths.mjs';
import { buildCoverageCampaign, coverageMarkdown, readCoverageSnapshot, mergeCoverageCapture, validateCoverageOutput, main } from '../coverage-campaign.mjs';

const cell = (r, name, channel) => r.ledger.find((c) => c.display_name === name && c.channel === channel);
const receipt = (patch = {}) => ({ company: 'Alpha', channel: 'official', operation: 'open', status: 'page_read',
  request: { open: [{ ref_id: 'https://alpha.example/jobs' }] }, evidence_file: 'raw/proof.json', observed_at: '2026-09-11T10:00:00Z',
  source_id: 'source-a', scope_id: 'all-jobs', ...patch });
const snapshot = (outcomes = [], patch = {}) => ({ id: 's1', scope: { route_A_seeds: ['Alpha'] },
  coverage: [{ company: 'Alpha', source_outcomes: outcomes }], jobs: [], ...patch });
const build = (outcomes, patch) => buildCoverageCampaign({ snapshots: [snapshot(outcomes, patch)] });

test('all seeds including industry groups survive budgets, duplicate inputs and multiple channels', () => {
  const names = Array.from({ length: 35 }, (_, i) => `Employer ${i}`);
  const s = snapshot([], { scope: { route_A_seeds: names, industry_groups: [{ companies: ['Extra'] }], maxCompanies: 25, maxRequests: 1 } });
  const r = buildCoverageCampaign({ snapshots: [s, s], maxCompanies: 20 });
  assert.equal(r.summary.catalog_targets, 36);
  assert.equal(r.ledger.length, 37 * 6);
  assert.deepEqual(r, buildCoverageCampaign({ snapshots: [s] }));
});

test('partial proofs never OR across source, scope, snapshot or observation time', () => {
  for (const patch of [{ source_id: 'other' }, { scope_id: 'other' }, { observed_at: '2026-09-12T00:00:00Z' }, {}]) {
    const r = build([receipt({ native_pagination_complete: true }), receipt({ detail_completion_complete: true, ...patch })]);
    assert.equal(r.summary.scope_complete, 0);
  }
  const r = buildCoverageCampaign({ snapshots: [snapshot([receipt({ native_pagination_complete: true })]),
    snapshot([receipt({ detail_completion_complete: true })], { id: 's2' })] });
  assert.equal(r.summary.scope_complete, 0);
  assert.equal(r.summary.distinct_display_names, 1);
});

test('one complete dated source scope does not exhaust the channel or close BOSS', () => {
  const r = build([receipt({ native_pagination_complete: true, detail_completion_complete: true, job_count: 0 }), receipt({ source_id: 'pending-source' })]);
  assert.equal(r.summary.scope_complete, 1);
  assert.equal(r.source_scopes[0].result, 'zero_with_proof');
  assert.equal(cell(r, 'Alpha', 'official').scope_complete, false);
  assert.equal(cell(r, 'Alpha', 'official').channel_exhausted, false);
  assert.equal(cell(r, 'Alpha', 'boss').attempted, false);
  for (const patch of [{ scope_id: null }, { source_id: null }, { evidence_file: null }, { observed_at: null }]) {
    assert.equal(build([receipt({ native_pagination_complete: true, detail_completion_complete: true, ...patch })]).summary.scope_complete, 0);
  }
});

test('halts stay blocked after normal jobs and complete proofs, including another snapshot', () => {
  const good = receipt({ native_pagination_complete: true, detail_completion_complete: true });
  const s = snapshot([receipt({ status: 'blocked' })], { jobs: [good] });
  const r = buildCoverageCampaign({ snapshots: [s, snapshot([good], { id: 's2' })] });
  assert.equal(cell(r, 'Alpha', 'official').status, 'blocked');
  assert.equal(r.summary.scope_complete, 0);
  const halted = build([receipt({ channel: 'boss', status: 'blocked' })]);
  assert.equal(cell(halted, 'Alpha', 'boss').attempted, false);
});

test('saved search_index jobs never imply BOSS or Liepin access regardless of status', () => {
  for (const host of ['zhipin.com', 'liepin.com']) {
    const r = build([], { jobs: [{ id: host, company: 'Alpha', source_kind: 'search_index', status: 'captured_job', evidence_file: 'index.json', source_url: `https://${host}/job/1` }] });
    const c = cell(r, 'Alpha', host === 'zhipin.com' ? 'boss' : 'liepin');
    assert.equal(c.attempted, false); assert.equal(c.evidence.length, 1);
  }
});

test('same display name retains each raw job, identical HR name, separate IDs and cross-channel evidence', () => {
  const jobs = ['boss', 'liepin', 'official'].map((channel, i) => ({ id: `j${i}`, company: 'New Co', title: 'Sales', recruiter_name: '张女士',
    recruiter_id: `hr${i}`, channel, evidence_file: `raw/${i}.json`, source_url: 'https://example.org/jobs' }));
  const r = buildCoverageCampaign({ snapshots: [snapshot([], { jobs }), snapshot([], { id: 's2', jobs: [jobs[0]] })] });
  assert.equal(r.companies.filter((c) => c.display_name === 'New Co').length, 1);
  assert.equal(r.summary.candidate_employer_records, 4);
  assert.equal(r.observations.filter((o) => o.kind === 'job').length, 4);
  for (const channel of ['boss', 'liepin', 'official']) assert.equal(cell(r, 'New Co', channel).attempted, true);
  assert.deepEqual(r.observations.filter((o) => o.kind === 'job').slice(0, 3).map((o) => o.raw), jobs);
  assert.equal(r.summary.company_entity_unknown, true);
});

test('industry directory discoveries preserve evidence and do not imply any recruitment access', () => {
  const record = { company_name: 'Directory Co', industry: 'AI', source_url: 'https://directory.example/company', evidence_file: 'directory.json',
    verbatim_quote: 'Listed company', observed_at: '2026-09-11', source_purpose: 'industry_directory', channel: 'official', operation: 'open' };
  const r = buildCoverageCampaign({ companyDiscoveries: [record, record] });
  assert.equal(r.summary.distinct_display_names, 1); assert.equal(r.summary.candidate_employer_records, 1);
  assert.equal(r.summary.attempted, 0); assert.deepEqual(r.observations[0].raw, record);
  assert.equal(r.companies[0].industry, 'AI');
});

test('coverage aggregate URLs and generic raw searches cannot become company platform visits', () => {
  const outcome = receipt({ channel: null, request: { open: [{ ref_id: 'https://unknown.example/jobs' }] } });
  const s = snapshot([], { coverage: [{ company: 'Alpha', attempted: true, status: 'captured_filtered',
    urls: ['https://liepin.com/job/1', 'https://zhipin.com/job/1'], source_outcomes: [outcome] }] });
  const r = buildCoverageCampaign({ snapshots: [s] });
  assert.equal(cell(r, 'Alpha', 'liepin').attempted, false); assert.equal(cell(r, 'Alpha', 'boss').attempted, false);
  const generic = receipt({ company: null, operation: 'search', request: { search_query: [{ q: 'AI sales' }] } });
  const g = build([generic], { captures: [generic] });
  assert.equal(g.summary.attempted, 0);
  assert(g.observations.some((o) => o.company_id === null && o.actual_queries.includes('AI sales')));
  assert.equal(build([generic]).summary.attempted, 0);
});

test('missing raw receipt cannot validate a saved job or its complete flags', () => {
  const job = receipt({ native_pagination_complete: true, detail_completion_complete: true });
  const r = build([], { jobs: [job], captures: [{ evidence_file: job.evidence_file, evidence_available: false, company: null }] });
  assert.equal(r.summary.attempted, 0); assert.equal(r.summary.scope_complete, 0);
  assert.deepEqual(r.observations.find((o) => o.kind === 'job').raw, job);
});

test('F2 a named Beta receipt referenced by Alpha and Gamma stays with Beta once', () => {
  const beta = receipt({ company: 'Beta', evidence_file: 'raw/beta.json', native_pagination_complete: true, detail_completion_complete: true });
  const r = build([], { captures: [beta], coverage: ['Alpha', 'Gamma'].map((company) => ({ company, source_outcomes: [{ evidence_file: beta.evidence_file }] })) });
  assert.equal(cell(r, 'Alpha', 'official').attempted, false);
  assert.equal(cell(r, 'Gamma', 'official').attempted, false);
  assert.equal(cell(r, 'Beta', 'official').attempted, true);
  assert.equal(r.source_scopes.length, 1);
  assert.equal(r.source_scopes[0].company_id, r.companies.find((c) => c.display_name === 'Beta').id);
  assert.equal(r.observations.filter((o) => o.kind === 'capture').length, 1);
  assert.deepEqual(r.binding_conflicts.map((c) => c.parent_company), ['Alpha', 'Gamma']);
  assert(r.binding_conflicts.every((c) => c.status === 'pending_identity_review'));
});

test('F2 explicit aliases permit display binding; absent raw company uses inventory but explicit null stays generic', () => {
  const beta = receipt({ company: 'Alpha Ltd' });
  const r = build([beta], { captures: [beta], scope: { route_A_seeds: [{ name: 'Alpha', aliases: ['Alpha Ltd'] }] } });
  assert.equal(r.summary.distinct_display_names, 1); assert.equal(r.binding_conflicts.length, 0);
  assert.equal(cell(r, 'Alpha', 'official').attempted, true);
  const raw = { operation: 'search', request: { search_query: [{ q: 'AI sales' }] } };
  const inventory = { company: 'From ledger', evidence_file: 'raw/search.json' };
  assert.equal(mergeCoverageCapture(raw, inventory).company, 'From ledger');
  assert.equal(mergeCoverageCapture(raw, inventory).company_binding_origin, 'capture_inventory');
  assert.equal(mergeCoverageCapture({ ...raw, company: null }, inventory).company, null);
  assert.equal(mergeCoverageCapture({ ...raw, company: 'Original' }, inventory).company, 'Original');
  assert.equal(mergeCoverageCapture(null, inventory).company, null);
});

test('F4 custom channels receive their jobs; unknown labels and directory purpose stay explicit', () => {
  const r = buildCoverageCampaign({ channelDefinitions: ['association', { id: 'niche_board' }], snapshots: [snapshot([], {
    jobs: ['association', 'niche_board', 'never_defined'].map((channel) => ({ company: 'Alpha', channel, evidence_file: `${channel}.json` }))
  })], companyDiscoveries: [{ company_name: 'Directory', channel: 'association', source_purpose: 'industry_directory', evidence_file: 'dir.json' }] });
  assert.equal(cell(r, 'Alpha', 'association').attempted, true);
  assert.equal(cell(r, 'Alpha', 'niche_board').attempted, true);
  assert.equal(cell(r, 'Directory', 'association').attempted, false);
  const unknown = r.observations.find((o) => o.declared_channel === 'never_defined');
  assert.equal(unknown.channel_definition_status, 'unrecognized_or_discovery_only');
  assert.equal(unknown.raw.channel, 'never_defined');
});

test('F4 actual CLI reads channels from companies JSON; fs mock prevents all writes', () => {
  const script = `
    import { mock } from 'node:test';
    import * as fs from 'node:fs/promises';
    import { resolve, join } from 'node:path';
    import assert from 'node:assert/strict';
    const root = resolve('01_行情收集/official-careers/research/f4-memory');
    const companies = resolve('companies-memory.json'); const writes = new Map();
    const records = new Map([
      [join(root, 'scope.json'), {route_A_seeds:['Alpha']}],
      [join(root, 'coverage.json'), []],
      [join(root, 'jobs.json'), [{company:'Alpha', channel:'association', evidence_file:'raw/job.json'}]],
      [join(root, 'capture-inventory.json'), [{evidence_file:'raw/job.json', company:'Alpha'}, {evidence_file:'raw/generic.json', company:'Wrong ledger company'}]],
      [join(root, 'raw/job.json'), {operation:'open'}],
      [join(root, 'raw/generic.json'), {company:null, operation:'search', request:{search_query:[{q:'generic sales'}]}}],
      [companies, {channels:[{id:'association'}], companies:[{company_name:'Directory', source_purpose:'industry_directory', channel:'association'}]}]
    ]);
    const missing = () => Object.assign(new Error('missing'), {code:'ENOENT'});
    mock.module('node:fs/promises', {namedExports:{...fs,
      realpath: async p => resolve(p), lstat: async () => {throw missing()}, mkdir: async () => {},
      readFile: async (p, encoding) => {if(!records.has(p)) throw missing(); const s=JSON.stringify(records.get(p));return encoding?s:Buffer.from(s)},
      writeFile: async (p, data) => writes.set(p, data)
    }});
    const {main} = await import('./careers/coverage-campaign.mjs');
    const result = await main(['--input', root, '--companies', companies]);
    const campaign = JSON.parse(writes.get(result.json_path));
    assert(campaign.channels.includes('association'));
    assert(campaign.ledger.find(c=>c.display_name==='Alpha' && c.channel==='association').attempted);
    assert(!campaign.ledger.find(c=>c.display_name==='Directory' && c.channel==='association').attempted);
    const captures = campaign.observations.filter(o=>o.kind==='capture');
    assert.equal(captures.find(o=>o.evidence_file==='raw/job.json').raw.company_binding_origin, 'capture_inventory');
    assert.equal(captures.find(o=>o.evidence_file==='raw/job.json').raw.company, 'Alpha');
    assert.equal(captures.find(o=>o.evidence_file==='raw/generic.json').company_id, null);
    assert.equal(writes.size, 2);
  `;
  const result = spawnSync(process.execPath, ['--experimental-test-module-mocks', '--input-type=module', '-e', script], { encoding: 'utf8', cwd: join(DATA_DIR, '../..') });
  assert.equal(result.status, 0, result.stderr);
});

test('unknown and missing source kinds survive; failure is not zero; historical dates are unchanged', () => {
  const r = build([receipt({ channel: null, source_kind: 'new_industry_source', status: 'technical_failure', job_count: 0 }),
    receipt({ channel: null, source_kind: null, evidence_file: 'missing-kind.json' })]);
  assert(cell(r, 'Alpha', 'open_web').source_kinds.includes('new_industry_source'));
  assert(cell(r, 'Alpha', 'open_web').source_kinds.includes('unknown'));
  assert.equal(r.summary.scope_complete, 0);
  assert.equal(cell(r, 'Alpha', 'open_web').result, 'unknown');
  assert.equal(cell(r, 'Alpha', 'open_web').last_observed, '2026-09-11T10:00:00Z');
});

test('CLI validates JSON under reports, rejects input collisions and missing option values without writing', async () => {
  for (const path of ['/tmp/output.json', join(REPORT_DIR, 'output.md'), join(REPORT_DIR, '../jobs.json')]) {
    await assert.rejects(validateCoverageOutput(path), /JSON.*reports/);
  }
  const path = join(REPORT_DIR, 'coverage-test-output.json');
  const valid = await validateCoverageOutput(path); assert.notEqual(valid.json_path, valid.markdown_path);
  await assert.rejects(validateCoverageOutput(path, [path]), /overwrite input/);
  await assert.rejects(validateCoverageOutput(path, [valid.markdown_path]), /overwrite input/);
  await assert.rejects(main(['--input']), /Missing value/);
});

test('Markdown is Chinese and renders display names with pending and blocked rows, not hashes', () => {
  const r = build([receipt({ channel: 'boss', status: 'blocked' })]); const markdown = coverageMarkdown(r);
  assert.match(markdown, /公司展示名/); assert.match(markdown, /Alpha/); assert.match(markdown, /暂停/); assert.match(markdown, /待核验/);
  assert(!markdown.includes(r.companies[0].id));
});

test('real 09-13 + 09-11 snapshots: all seeds, jobs, generic captures, halts and immutable inputs', async (t) => {
  const snapshots = [];
  for (const day of ['2026-09-13', '2026-09-11']) snapshots.push(await readCoverageSnapshot(join(DATA_DIR, 'research', `sweep-${day}`)));
  const r = buildCoverageCampaign({ snapshots });
  assert.equal(r.observations.filter((o) => o.kind === 'job').length, snapshots.reduce((n, s) => n + s.jobs.length, 0));
  assert.equal(r.observations.filter((o) => o.kind === 'job').length, 75);
  for (const name of snapshots[0].scope.route_A_seeds ?? []) assert(r.companies.some((c) => c.display_name === name));
  assert(r.summary.distinct_display_names > 25);
  assert.equal(r.companies.filter((c) => c.display_name === '探迹科技').length, 1);
  assert.equal(r.summary.scope_complete, 0); assert.equal(r.summary.market_complete, false);
  assert(r.ledger.filter((c) => ['boss', 'liepin'].includes(c.channel)).every((c) => !c.attempted && c.status === 'blocked'));
  assert(r.ledger.every((c) => !c.channel_exhausted && !c.scope_complete));
  assert.equal(cell(r, '沃丰科技', 'liepin').attempted, false);
  assert(r.observations.filter((o) => o.kind === 'capture' && !o.raw.company).every((o) => !o.attempted && o.company_id === null));
  const repeated = buildCoverageCampaign({ snapshots: [...snapshots, snapshots[0]] });
  assert.deepEqual(repeated.summary, r.summary); assert.equal(repeated.observations.length, r.observations.length);
  for (const snapshot of snapshots) for (const file of snapshot.input_files) {
    assert.equal(createHash('sha256').update(await readFile(file.path)).digest('hex'), file.sha256, file.path);
  }
  t.diagnostic(JSON.stringify({ summary: r.summary, jobs: 75, observations: r.observations.length,
    missing_files: snapshots.map((s) => ({ id: s.id, files: s.missing_files })) }));
});
