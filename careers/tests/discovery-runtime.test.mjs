import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { registerHooks } from 'node:module';
import { DISCOVERY_DIR, prepareDiscovery, runDiscovery, readDiscoveryExport } from '../discovery.mjs';
import { EvidenceHTTP, validatePublicUrl } from '../http.mjs';
import { discoveryIdentity, validateGenericSource, GENERIC_OFFICIAL_PROVIDER, sourceIdentity, findDiscoveryHalt } from '../registry.mjs';
import { repoRelative, DATA_DIR } from '../paths.mjs';
import { main } from '../cli.mjs';

const sha = (text) => createHash('sha256').update(text).digest('hex');
const lease = { beforeRequest: async () => new Date().toISOString(), afterRequest() {}, release() {} };
async function workspace(t) {
  await mkdir(DISCOVERY_DIR, { recursive: true });
  const directory = await mkdtemp(join(DISCOVERY_DIR, '_fixture-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}
async function json(directory, name, value) {
  const path = join(directory, name); await writeFile(path, JSON.stringify(value)); return path;
}
async function approved(directory, id = 'new-employer', { name = 'New Employer', host = `${id}.example.com`, group = [] } = {}) {
  const root = `https://${host}`;
  const company = { company_name: name, employer_entity_id: `legal:${id}`, homepage: `${root}/`, group_ids: group };
  const ownership = `<title>${name}</title><p>${name}</p><a href="${root}/careers/">Careers</a>`;
  const bodyPath = join(directory, `${id}.ownership.body`);
  const metaPath = join(directory, `${id}.ownership.response.json`);
  await writeFile(bodyPath, ownership);
  const proof = { body_path: repoRelative(bodyPath), metadata_path: repoRelative(metaPath), sha256: sha(ownership), quote: name };
  await writeFile(metaPath, JSON.stringify({ ...proof, url: `${root}/about`, method: 'GET', status: 200,
    complete: true, bytes: Buffer.byteLength(ownership), finished_at: new Date().toISOString() }));
  const source = { company_id: id, company_name: name, employer_entity_id: company.employer_entity_id, homepage: company.homepage,
    legal_name: name, group_ids: group, identity_tokens: [name], source_id: `${id}-official`, provider: GENERIC_OFFICIAL_PROVIDER,
    allowed_hosts: [host], ownership_url: `${root}/about`, board_url: `${root}/careers/`,
    tenant: `${root}/careers/`, tenant_scope_url: `${root}/careers/`,
    fixed_urls: [`${root}/about`, `${root}/careers/`, `${root}/careers/page-2`, `${root}/careers/job-1`],
    static: { mode: 'jsonld', page_urls: [`${root}/careers/`], scope_selector: '#careers', jsonld_list_id: `${root}/careers/#jobs` },
    approval: { status: 'approved', reviewed_by: 'offline-test-only', reviewed_at: new Date().toISOString(), group_relationships_checked: true },
    ownership_evidence: proof };
  const page = (ids = ['one'], total = ids.length, next = '') => `<main id="careers"><script type="application/ld+json">${JSON.stringify({
    '@type': 'ItemList', '@id': `${root}/careers/#jobs`, numberOfItems: total, itemListElement: ids.map((jobId) => ({
      '@type': 'JobPosting', identifier: { value: jobId }, title: 'No matching or title filter is applied',
      hiringOrganization: { name }, description: `<p>Original full job description for ${jobId}, with operational and engineering duties.</p>`,
    })),
  })}</script>${next}</main>`;
  return { company, source, ownership, page, root };
}

function transport(directory, fixtures, calls) {
  // Only request transport is replaced. Production EvidenceHTTP.get/robots, collector, normalizer and SQLite run unchanged.
  class FixtureHTTP extends EvidenceHTTP {
    async request(url, purpose) {
      if (this.stopped) throw this.stopped;
      validatePublicUrl(url, this.allowedHosts);
      assert.equal(this.dataDir, directory);
      const started_at = await this.lease.beforeRequest();
      calls.push({ url: String(url), purpose, company_id: this.companyId });
      const fixture = fixtures.get(String(url));
      assert(fixture !== undefined, `Unplanned fixture request: ${url}`);
      const status = fixture.status ?? 200;
      const text = typeof fixture === 'string' ? fixture : fixture.text ?? '';
      const raw = join(directory, 'raw', this.runId); await mkdir(raw, { recursive: true });
      const sequence = this.evidence.length + 1;
      const metadata = { run_id: this.runId, company_id: this.companyId, source_id: this.sourceId, sequence,
        url: String(url), method: 'GET', purpose, status, complete: true, started_at, finished_at: new Date().toISOString(),
        body_path: repoRelative(join(raw, `${sequence}.body`)), metadata_path: repoRelative(join(raw, `${sequence}.response.json`)),
        sha256: sha(text), bytes: Buffer.byteLength(text), headers: fixture.headers ?? { 'content-type': 'text/html' },
        transport: 'offline_fixture_no_network' };
      await writeFile(join(raw, `${sequence}.body`), text);
      await writeFile(join(raw, `${sequence}.response.json`), JSON.stringify(metadata));
      this.evidence.push(metadata);
      this.lease.afterRequest();
      if ([401, 403, 429].includes(status)) this.stop('HTTP_ACCESS_STOP', `HTTP ${status} fixture`, metadata.metadata_path);
      if (fixture.stop) this.stop(fixture.stop, 'fixture source stop', metadata.metadata_path);
      return { ...metadata, text };
    }
  }
  return { httpFactory: (options) => new FixtureHTTP(options) };
}
function fixturesFor(...companies) {
  return new Map(companies.flatMap((item) => [[`${item.root}/robots.txt`, { text: 'User-agent: *\nAllow: /', headers: { 'content-type': 'text/plain' } }],
    [item.source.ownership_url, item.ownership], [item.source.board_url, item.page()]]));
}
async function prepare(directory, companies, options = {}) {
  const approvalsPath = await json(directory, 'approvals.json', { schema: 'generic-official-approvals/v1',
    approvals: companies.map(({ company, source }) => ({ company, source })) });
  return prepareDiscovery({ directory, approvalsPath, includeSeeds: false, collectionLease: lease, ...options });
}

test('open company/job/channel imports enqueue without filtering or granting access; names alone do not merge employers', async (t) => {
  const directory = await workspace(t);
  const rows = { jobs: [{ company_name: 'Same Name', homepage: 'https://alpha.example.com', title: 'Anything', source_url: 'https://new-board.example.org/post/1' },
    { company_name: 'Same Name', homepage: 'https://beta.example.com', title: 'Another unrelated role' }],
    channels: [{ name: 'An unfamiliar industry publisher', url: 'https://industry.example.net/news' }] };
  const input = await json(directory, 'input.json', rows);
  const first = await prepareDiscovery({ directory, input, includeSeeds: false, collectionLease: lease });
  await prepareDiscovery({ directory, input, includeSeeds: false, collectionLease: lease });
  const output = await readDiscoveryExport({ directory });
  assert.equal(output.companies.length, 2);
  assert.equal(output.channels.length, 2);
  assert.equal(output.companies[0].observations[0].raw.title, 'Anything');
  let accesses = 0;
  const result = await runDiscovery({ directory, batchId: first.batch_id, collectionLease: lease,
    dependencies: { httpFactory() { accesses++; throw new Error('No unapproved HTTP'); } } });
  assert.equal(accesses, 0);
  assert(Object.values(result.results).every((item) => item.status === 'needs_verification'));
});

test('new approved employer uses real production collector and persisted normalized export without a JS registration', async (t) => {
  const directory = await workspace(t);
  const company = await approved(directory);
  const batch = await prepare(directory, [company]);
  const calls = [];
  const result = await runDiscovery({ directory, batchId: batch.batch_id, collectionLease: lease,
    dependencies: transport(directory, fixturesFor(company), calls) });
  assert.equal(Object.values(result.results)[0].status, 'success', JSON.stringify(result.results));
  assert.equal(result.requests_used, 3, 'robots + current ownership + board');
  const output = await readDiscoveryExport({ directory });
  assert.equal(output.jobs.length, 1);
  assert.equal(output.runs[0].ownership.status, 'verified');
  assert.equal(output.jobs[0].provider, GENERIC_OFFICIAL_PROVIDER);
  assert.equal(output.jobs[0].description_complete, true);
  assert(output.jobs[0].job_key.includes('new-employer-official'));
  assert(output.jobs[0].metadata_path.startsWith(repoRelative(directory)));
  const db = new DatabaseSync(join(directory, 'careers.sqlite'), { readOnly: true });
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM jobs').get().n, 1); db.close();
  const before = calls.length;
  const noop = await runDiscovery({ directory, batchId: batch.batch_id, collectionLease: lease,
    dependencies: transport(directory, fixturesFor(company), calls) });
  assert.equal(noop.no_op, true); assert.equal(calls.length, before);
  const persisted = JSON.parse(await readFile(join(directory, 'export.json'), 'utf8'));
  assert.equal(persisted.jobs[0].job_key, output.jobs[0].job_key);
});

test('a completed source enters the next frozen batch as a fresh recheck, while its completed batch remains a no-op', async (t) => {
  const directory = await workspace(t);
  const source = { company_id: 'recheck-fixture', source_id: 'recheck-fixture-official', provider: GENERIC_OFFICIAL_PROVIDER,
    tenant: 'https://recheck-fixture.invalid/careers/', board_url: 'https://recheck-fixture.invalid/careers/' };
  const entry = { queue_id: 'company-recheck-fixture', company_name: 'Recheck Fixture', employer_entity_id: 'legal:recheck-fixture',
    homepage: 'https://recheck-fixture.invalid/', legal_name: 'Recheck Fixture', aliases: [], group_ids: [], status: 'success',
    admission: { status: 'approved_for_current_chain_check', approval_sha256: 'fixture' }, source, source_versions: [], observations: [],
    routes: ['A'], todos: [], cursor: { visited: [source.board_url], pending: [] }, attempts: [{ status: 'success', terminal: true }],
    last_terminal_signature: 'historical-success-signature' };
  await writeFile(join(directory, 'state.json'), JSON.stringify({ schema_version: 1, revision: 1, companies: [entry], channels: [], inputs: [], batches: [], halts: [] }));

  const recheck = await prepareDiscovery({ directory, includeSeeds: false, collectionLease: lease });
  assert.equal(recheck.denominator.selected_companies, 1, 'a later update must not skip a previously successful employer');
  const frozen = (await readDiscoveryExport({ directory })).batches.at(-1);
  assert.equal(frozen.manifest[0].recheck, true);
  assert.equal(frozen.manifest[0].cursor, null, 'a recheck must read current list evidence instead of resuming historical pagination');
  const sameBatch = await prepareDiscovery({ directory, includeSeeds: false, collectionLease: lease });
  assert.equal(sameBatch.batch_id, recheck.batch_id, 'a prepared frozen batch is reused instead of creating duplicate work');
  const output = await readDiscoveryExport({ directory });
  assert.equal(output.companies[0].status, 'success', 'preparing a recheck does not rewrite the historical success state');
});

test('a recheck run passes its frozen null cursor to collection once, then completed batch is a no-op', async (t) => {
  const directory = await workspace(t);
  const company = await approved(directory, 'recheck-execution');
  const entry = { ...company.company, queue_id: 'company-recheck-execution', aliases: [], status: 'success',
    admission: { status: 'approved_for_current_chain_check', approval_sha256: 'fixture' }, source: company.source, source_versions: [],
    observations: [], routes: ['A'], todos: [], cursor: { visited: [company.source.board_url], pending: [] }, attempts: [] };
  const manifest = [{ queue_id: entry.queue_id, company_name: entry.company_name, source: company.source,
    admission: entry.admission, cursor: null, recheck: true, routes: entry.routes, review_signature: 'fixture' }];
  const batch = { batch_id: 'discovery-recheck-execution', manifest, manifest_sha256: sha(JSON.stringify(manifest)),
    budget: { max_companies: 1, max_requests: 3, max_pages_per_company: 3 }, status: 'prepared', results: {}, executions: [], active: null };
  await writeFile(join(directory, 'state.json'), JSON.stringify({ schema_version: 1, revision: 1, companies: [entry], channels: [], inputs: [], batches: [batch], halts: [] }));
  const cursors = [];
  const dependencies = { collectFn: async ({ cursor }) => {
    cursors.push(cursor);
    return { runs: [{ run_id: 'recheck-fixture-run', status: 'success', complete: true, jobs: [], errors: [],
      finished_at: new Date().toISOString(), discovery_result: { status: 'success', source_complete: true,
        cursor: { visited: [company.source.board_url], pending: [] } }, evidence: [] }] };
  } };
  const first = await runDiscovery({ directory, batchId: batch.batch_id, collectionLease: lease, dependencies });
  assert.equal(first.status, 'completed');
  assert.deepEqual(cursors, [null]);
  const repeated = await runDiscovery({ directory, batchId: batch.batch_id, collectionLease: lease, dependencies });
  assert.equal(repeated.no_op, true);
  assert.deepEqual(cursors, [null], 'a completed frozen batch does not invoke collection again');
});

test('successful and verified-empty rechecks rotate by actual completion time under a one-company budget', async (t) => {
  const directory = await workspace(t);
  const alpha = await approved(directory, 'recheck-alpha', { name: 'Recheck Alpha' });
  const beta = await approved(directory, 'recheck-beta', { name: 'Recheck Beta' });
  const entry = (company, status, finished_at) => ({ ...company.company, queue_id: `company-${company.source.company_id}`, aliases: [], status,
    admission: { status: 'approved_for_current_chain_check', approval_sha256: 'fixture' }, source: company.source, source_versions: [],
    observations: [], routes: ['A'], todos: [], cursor: { visited: [company.source.board_url], pending: [] },
    attempts: [{ status, terminal: true, finished_at }] });
  await writeFile(join(directory, 'state.json'), JSON.stringify({ schema_version: 1, revision: 1,
    companies: [entry(alpha, 'success', '2024-01-01T00:00:00.000Z'), entry(beta, 'verified_empty', '2024-01-02T00:00:00.000Z')],
    channels: [], inputs: [], batches: [], halts: [] }));
  let completed = 0;
  const dependencies = { collectFn: async ({ source }) => ({ runs: [{ run_id: `recheck-${source.company_id}-${completed++}`,
    status: 'success', complete: true, jobs: [], errors: [], finished_at: `2030-01-0${completed}T00:00:00.000Z`,
    discovery_result: { status: 'success', source_complete: true, cursor: { visited: [source.board_url], pending: [] } }, evidence: [] }] }) };
  const selected = [];
  for (let wave = 0; wave < 3; wave++) {
    const prepared = await prepareDiscovery({ directory, includeSeeds: false, maxCompanies: 1, collectionLease: lease });
    const frozen = (await readDiscoveryExport({ directory })).batches.at(-1).manifest[0];
    selected.push(frozen.source.company_id);
    assert.equal(frozen.recheck, true);
    await runDiscovery({ directory, batchId: prepared.batch_id, collectionLease: lease, dependencies });
  }
  assert.deepEqual(selected, ['recheck-alpha', 'recheck-beta', 'recheck-alpha']);
});

test('same-priority discovery entries use one completion-time ordering key', async (t) => {
  const directory = await workspace(t);
  const source = await approved(directory, 'recheck-order', { name: 'Recheck Order' });
  const entry = (queue_id, status, attempts, configuredSource = source.source) => ({ ...source.company, queue_id, aliases: [], status,
    admission: { status: 'approved_for_current_chain_check', approval_sha256: 'fixture' }, source: configuredSource, source_versions: [],
    observations: [], routes: ['A'], todos: [], cursor: null, attempts });
  await writeFile(join(directory, 'state.json'), JSON.stringify({ schema_version: 1, revision: 1, channels: [], inputs: [], batches: [], halts: [],
    companies: [
      entry('company-z-old', 'success', [{ finished_at: '2024-01-01T00:00:00.000Z' }]),
      entry('company-a-new', 'verified_empty', [{ finished_at: '2024-01-02T00:00:00.000Z' }]),
      entry('company-m-unattempted', 'needs_verification', [], null),
    ] }));
  const prepared = await prepareDiscovery({ directory, includeSeeds: false, maxCompanies: 3, collectionLease: lease });
  assert.equal(prepared.denominator.selected_companies, 3);
  const manifest = (await readDiscoveryExport({ directory })).batches.at(-1).manifest;
  assert.deepEqual(manifest.map((item) => item.queue_id), ['company-m-unattempted', 'company-z-old', 'company-a-new']);
});

test('a recheck checkpoint resumes the cursor persisted by its first partial collection', async (t) => {
  const directory = await workspace(t);
  const company = await approved(directory, 'recheck-checkpoint');
  const source = company.source;
  const entry = { ...company.company, queue_id: 'company-recheck-checkpoint', aliases: [], status: 'success',
    admission: { status: 'approved_for_current_chain_check', approval_sha256: 'fixture' }, source, source_versions: [], observations: [],
    routes: ['A'], todos: [], cursor: { visited: [source.board_url], pending: [] }, attempts: [] };
  const manifest = [{ queue_id: entry.queue_id, company_name: entry.company_name, source, admission: entry.admission,
    cursor: null, recheck: true, routes: entry.routes, review_signature: 'fixture' }];
  const batch = { batch_id: 'discovery-recheck-checkpoint', manifest, manifest_sha256: sha(JSON.stringify(manifest)),
    budget: { max_companies: 1, max_requests: 3, max_pages_per_company: 3 }, status: 'prepared', results: {}, executions: [], active: null };
  await writeFile(join(directory, 'state.json'), JSON.stringify({ schema_version: 1, revision: 1, companies: [entry], channels: [], inputs: [], batches: [batch], halts: [] }));
  const resumedCursor = { visited: [source.board_url], pending: [`${company.root}/careers/page-2`] };
  const cursors = [];
  const dependencies = { collectFn: async ({ cursor }) => {
    cursors.push(cursor);
    const partial = cursors.length === 1;
    return { runs: [{ run_id: `checkpoint-${cursors.length}`, status: partial ? 'partial' : 'success', complete: !partial, jobs: [], errors: [],
      finished_at: `2030-02-0${cursors.length}T00:00:00.000Z`, discovery_result: { status: partial ? 'partial' : 'success',
        source_complete: !partial, cursor: partial ? resumedCursor : { visited: [...resumedCursor.visited, resumedCursor.pending[0]], pending: [] } }, evidence: [] }] };
  } };
  const first = await runDiscovery({ directory, batchId: batch.batch_id, collectionLease: lease, dependencies });
  assert.equal(first.status, 'checkpoint');
  const second = await runDiscovery({ directory, batchId: batch.batch_id, collectionLease: lease, dependencies });
  assert.equal(second.status, 'completed');
  assert.deepEqual(cursors, [null, resumedCursor]);
});

test('request checkpoint reloads the same frozen batch and resumes the next page without refetching completed pages', async (t) => {
  const directory = await workspace(t);
  const company = await approved(directory);
  const batch = await prepare(directory, [company], { maxRequests: 3 });
  const fixtures = fixturesFor(company);
  fixtures.set(company.source.board_url, company.page(['one'], 2, '<a rel="next" href="page-2">Next</a>'));
  fixtures.set(`${company.root}/careers/page-2`, company.page(['two'], 2));
  const calls = [];
  const first = await runDiscovery({ directory, batchId: batch.batch_id, collectionLease: lease,
    dependencies: transport(directory, fixtures, calls) });
  assert.equal(first.status, 'checkpoint');
  assert.equal(first.requests_used, 3);
  const second = await runDiscovery({ directory, batchId: batch.batch_id, collectionLease: lease,
    dependencies: transport(directory, fixtures, calls) });
  assert.equal(second.status, 'completed');
  const output = await readDiscoveryExport({ directory });
  assert.equal(output.jobs.length, 2);
  assert.equal(output.companies[0].status, 'success');
  assert.equal(output.batches[0].executions.length, 2);
  assert.equal(calls.filter((call) => call.url === company.source.board_url).length, 1);
  assert.equal(output.runs.at(-1).complete, false, 'no same-time completeness or closure claim across checkpoints');
});

test('first access denial halts the employer group even under a new company ID; unaffected company still runs', async (t) => {
  const directory = await workspace(t);
  const denied = await approved(directory, 'denied', { group: ['fixture-halted-group'] });
  const sibling = await approved(directory, 'sibling', { name: 'Sibling Entity', group: ['fixture-halted-group'] });
  const healthy = await approved(directory, 'healthy', { name: 'Unaffected Employer' });
  const batch = await prepare(directory, [denied, sibling, healthy]);
  // This fixture verifies halt propagation inside a specified frozen batch, not prepare's fairness order.
  const statePath = join(directory, 'state.json');
  const state = JSON.parse(await readFile(statePath, 'utf8'));
  const frozen = state.batches.find((item) => item.batch_id === batch.batch_id);
  const order = new Map([['denied', 0], ['sibling', 1], ['healthy', 2]]);
  frozen.manifest.sort((left, right) => order.get(left.source.company_id) - order.get(right.source.company_id));
  frozen.manifest_sha256 = sha(JSON.stringify(frozen.manifest));
  await writeFile(statePath, JSON.stringify(state));
  const fixtures = fixturesFor(denied, sibling, healthy);
  fixtures.set(denied.source.board_url, { status: 403, text: 'Denied' });
  const calls = [];
  const result = await runDiscovery({ directory, batchId: batch.batch_id, collectionLease: lease,
    dependencies: transport(directory, fixtures, calls) });
  const states = Object.values(result.results).map((item) => item.status);
  assert.deepEqual(states, ['blocked', 'blocked', 'success']);
  assert.equal(calls.filter((item) => item.company_id === 'sibling').length, 0);
  const next = await prepare(directory, [sibling]);
  await runDiscovery({ directory, batchId: next.batch_id, collectionLease: lease,
    dependencies: transport(directory, fixtures, calls) });
  assert.equal(calls.filter((item) => item.company_id === 'sibling').length, 0);
});

test('missing ownership, private hosts, cross-tenant paths and changed MiniMax IDs never admit a source', async (t) => {
  const directory = await workspace(t);
  const company = await approved(directory);
  const identity = discoveryIdentity(company.company);
  assert.throws(() => validateGenericSource({ ...company.source, ownership_evidence: null }, identity), /PROOF/);
  assert.throws(() => validateGenericSource({ ...company.source, fixed_urls: [...company.source.fixed_urls, `${company.root}/other-tenant/jobs`] }, identity), /TENANT/);
  assert.throws(() => validateGenericSource({ ...company.source, allowed_hosts: ['localhost'] }, identity), /PUBLIC_HOSTS/);
  const minimax = await approved(directory, 'changed-minimax-id', { name: 'MiniMax', host: 'brand-new.example.com' });
  const batch = await prepare(directory, [minimax]);
  let accesses = 0;
  const result = await runDiscovery({ directory, batchId: batch.batch_id, collectionLease: lease,
    dependencies: { httpFactory() { accesses++; throw new Error('No HTTP'); } } });
  assert.equal(accesses, 0);
  assert.equal(Object.values(result.results)[0].status, 'blocked');
});

test('new imports after freeze remain in the next wave and do not change the denominator', async (t) => {
  const directory = await workspace(t);
  const first = await approved(directory, 'first');
  const batch = await prepare(directory, [first], { maxCompanies: 1 });
  const second = await approved(directory, 'second', { name: 'Second Employer' });
  const imported = await prepare(directory, [second]);
  assert.equal(imported.batch_id, batch.batch_id);
  assert.equal(imported.denominator.known_companies_at_freeze, 1);
  const calls = [];
  await runDiscovery({ directory, batchId: batch.batch_id, collectionLease: lease,
    dependencies: transport(directory, fixturesFor(first, second), calls) });
  assert.equal(calls.filter((item) => item.company_id === 'second').length, 0);
  const next = await prepareDiscovery({ directory, includeSeeds: false, collectionLease: lease });
  assert.notEqual(next.batch_id, batch.batch_id);
  await runDiscovery({ directory, batchId: next.batch_id, collectionLease: lease,
    dependencies: transport(directory, fixturesFor(first, second), calls) });
  assert.equal((await readDiscoveryExport({ directory })).jobs.length, 2);
});

test('CLI rejects unfrozen execution and unbounded budgets without starting collection', async () => {
  await assert.rejects(main(['discovery:run']), /frozen/);
  await assert.rejects(main(['discovery:prepare', '--max-requests', 'Infinity']), /integer/);
  await assert.rejects(main(['collect', '--max-pages', '3']), /preparation/);
});

test('no native total is admissible and still collects full descriptions, but never reports complete or empty', async (t) => {
  const directory = await workspace(t);
  const company = await approved(directory);
  delete company.source.static.jsonld_list_id;
  const batch = await prepare(directory, [company]);
  assert.equal(batch.admission_todos.length, 0);
  const calls = [];
  const result = await runDiscovery({ directory, batchId: batch.batch_id, collectionLease: lease,
    dependencies: transport(directory, fixturesFor(company), calls) });
  assert.equal(Object.values(result.results)[0].status, 'partial');
  const output = await readDiscoveryExport({ directory });
  assert.equal(output.jobs.length, 1);
  assert.equal(output.runs[0].complete, false);
  assert.equal(output.companies[0].cursor.native_total, null);
});

test('unchanged terminal pending employers do not starve later waves', async (t) => {
  const directory = await workspace(t);
  const input = await json(directory, 'frontier.json', [1, 2, 3].map((id) => ({ company_name: `Unknown ${id}`, homepage: `https://unknown-${id}.example.com/` })));
  const selected = [];
  for (let index = 0; index < 3; index++) {
    const batch = await prepareDiscovery({ directory, input, includeSeeds: false, maxCompanies: 1, collectionLease: lease });
    const result = await runDiscovery({ directory, batchId: batch.batch_id, collectionLease: lease });
    selected.push(Object.keys(result.results)[0]);
  }
  assert.equal(new Set(selected).size, 3);
  const empty = await prepareDiscovery({ directory, input, includeSeeds: false, maxCompanies: 1, collectionLease: lease });
  assert.equal(empty.denominator.selected_companies, 0);
  assert.equal((await readDiscoveryExport({ directory })).pending.length, 3, 'parked does not mean discarded');
});

test('shared ATS hosts respect exact tenant scope; unknown historical scope is pending, and an actual robots origin stop still applies', () => {
  const employer = (id, board) => ({ company_id: id, company_name: id, employer_entity_id: `entity:${id}`,
    homepage: `https://${id}.example.com/`, ownership_url: `https://${id}.example.com/about`,
    board_url: `${board}jobs`, tenant_scope_url: board, tenant: board,
    allowed_hosts: ['app.mokahr.com', 'jobs.feishu.cn', new URL(board).hostname] });
  const a = employer('independent-a', 'https://app.mokahr.com/tenant-a/');
  const b = employer('independent-b', 'https://app.mokahr.com/tenant-b/');
  const stopped = { identity: sourceIdentity(a), reason: { code: 'HTTP_ACCESS_STOP' } };
  assert.equal(findDiscoveryHalt(b, [stopped]), null);
  assert.equal(findDiscoveryHalt({ ...a, company_id: 'changed-id', company_name: 'changed-name', employer_entity_id: 'changed-entity' }, [stopped]).applicability, 'confirmed');
  const feishuA = employer('feishu-a', 'https://tenant-a.jobs.feishu.cn/');
  const feishuB = employer('feishu-b', 'https://tenant-b.jobs.feishu.cn/');
  assert.equal(findDiscoveryHalt(feishuB, [{ identity: sourceIdentity(feishuA), reason: {} }]), null);
  const unknown = { identity: { ids: [], names: [], hosts: ['app.mokahr.com'], tenants: [] }, reason: {} };
  assert.equal(findDiscoveryHalt(b, [unknown]).applicability, 'needs_verification');
  const robots = { identity: sourceIdentity({ ...a, halt_scope: { kind: 'origin', origin: 'https://app.mokahr.com' } }), reason: {} };
  assert.equal(findDiscoveryHalt(b, [robots]).applicability, 'confirmed');
});

test('default current-sweep pointer imports original hashed jobs as pending and ignores report approval claims', async (t) => {
  const directory = await workspace(t);
  // Read the existing retained historical batch; never modify research or production report files.
  const current = JSON.parse(await readFile(join(DATA_DIR, 'reports/market-sweep.json'), 'utf8'));
  const reportPath = await json(directory, 'current-sweep.json', { ...current,
    approvals: [{ status: 'approved', allowed_hosts: ['untrusted.example.com'] }] });
  const batch = await prepareDiscovery({ directory, collectionLease: lease, currentSweepReportPath: reportPath });
  assert.equal(batch.automatic_import.jobs_sha256, current.jobs_sha256);
  assert.equal(batch.automatic_import.source_approvals_imported, false);
  const output = await readDiscoveryExport({ directory });
  assert(output.inputs.some((item) => item.kind === 'automatic_current_sweep' && item.sha256 === current.jobs_sha256));
  assert(output.companies.every((entry) => entry.source === null));
  assert.equal(output.jobs.length, 0);
});

test('current-sweep pointer rejects path escape and stale job hash without admitting any company', async (t) => {
  const directory = await workspace(t);
  const current = JSON.parse(await readFile(join(DATA_DIR, 'reports/market-sweep.json'), 'utf8'));
  const outside = await json(directory, 'outside.json', { ...current, input_dir: repoRelative(directory) });
  await assert.rejects(prepareDiscovery({ directory, collectionLease: lease, currentSweepReportPath: outside }), /OUTSIDE_RESEARCH/);
  assert.equal((await readDiscoveryExport({ directory })).companies.length, 0);
  const stale = await json(directory, 'stale.json', { ...current, jobs_sha256: '0'.repeat(64) });
  await assert.rejects(prepareDiscovery({ directory, collectionLease: lease, currentSweepReportPath: stale }), /HASH_MISMATCH/);
  assert.equal((await readDiscoveryExport({ directory })).companies.length, 0);
  const isolated = await prepareDiscovery({ directory, includeSeeds: false, collectionLease: lease, currentSweepReportPath: stale });
  assert.equal(isolated.automatic_import.status, 'disabled_by_no_seeds');
});

for (const initiallyApproved of [true, false]) test(`D1 stale ${initiallyApproved ? 'approved' : 'pending'} manifest cannot retire a newer approval`, async (t) => {
  const directory = await workspace(t);
  const company = await approved(directory);
  const original = initiallyApproved ? await prepare(directory, [company])
    : await prepareDiscovery({ directory, input: await json(directory, 'company.json', company.company),
      includeSeeds: false, collectionLease: lease });
  const frozenBefore = (await readDiscoveryExport({ directory })).batches[0].manifest_sha256;
  company.source.approval.reviewed_by = 'new-explicit-reviewer';
  await prepare(directory, [company]);
  const revised = (await readDiscoveryExport({ directory })).companies[0];
  let calls = 0;
  const oldRun = await runDiscovery({ directory, batchId: original.batch_id, collectionLease: lease,
    dependencies: { httpFactory() { calls++; throw new Error('Stale approval must not access HTTP'); } } });
  assert.equal(calls, 0);
  assert.equal(Object.values(oldRun.results)[0].errors[0].code, 'SOURCE_APPROVAL_CHANGED_AFTER_FREEZE');
  const after = await readDiscoveryExport({ directory });
  assert.equal(after.companies[0].status, 'queued');
  assert.equal(after.companies[0].last_terminal_signature, revised.last_terminal_signature);
  assert.deepEqual(after.companies[0].admission, revised.admission);
  assert.equal(after.batches[0].manifest_sha256, frozenBefore);
  const next = await prepareDiscovery({ directory, includeSeeds: false, collectionLease: lease });
  assert.equal(next.denominator.selected_companies, 1);
  assert.notEqual(next.batch_id, original.batch_id);
  const result = await runDiscovery({ directory, batchId: next.batch_id, collectionLease: lease,
    dependencies: transport(directory, fixturesFor(company), []) });
  assert.equal(Object.values(result.results)[0].status, 'success');
  assert.equal((await readDiscoveryExport({ directory })).jobs.length, 1);
});

for (const requestLimit of [1, 3]) test(`D2 full budget ${requestLimit} without page progress requires explicit larger-budget refreeze`, async (t) => {
  const directory = await workspace(t);
  const company = await approved(directory);
  const fixtures = fixturesFor(company);
  if (requestLimit === 3) {
    // A current ownership redirect adds work that cannot be predicted by a universal minimum budget.
    company.source.fixed_urls.push(`${company.root}/careers/about`);
    fixtures.set(company.source.ownership_url, { status: 302, text: '', headers: { location: `${company.root}/careers/about` } });
    fixtures.set(`${company.root}/careers/about`, company.ownership);
  }
  const batch = await prepare(directory, [company], { maxRequests: requestLimit });
  const calls = [];
  const dependencies = transport(directory, fixtures, calls);
  const first = await runDiscovery({ directory, batchId: batch.batch_id, collectionLease: lease, dependencies });
  const result = Object.values(first.results)[0];
  assert.equal(first.requests_used, requestLimit);
  assert.equal(result.status, 'partial');
  assert.equal(result.terminal, true);
  assert.equal(result.budget_requirement.request_budget_must_exceed, requestLimit);
  assert(result.errors.some((error) => error.code === 'DISCOVERY_BUDGET_NO_PROGRESS'));
  assert.match(first.next_action, /Prepare a new batch.*--max-requests/);
  for (let repeat = 0; repeat < 2; repeat++) {
    assert.equal((await runDiscovery({ directory, batchId: batch.batch_id, collectionLease: lease, dependencies })).no_op, true);
  }
  assert.equal(calls.length, requestLimit, 'replaying the same frozen budget makes zero further HTTP requests');
  assert.equal((await prepareDiscovery({ directory, includeSeeds: false, maxRequests: requestLimit, collectionLease: lease })).denominator.selected_companies, 0);
  const larger = await prepareDiscovery({ directory, includeSeeds: false, maxRequests: 4, collectionLease: lease });
  assert.equal(larger.denominator.selected_companies, 1);
  const complete = await runDiscovery({ directory, batchId: larger.batch_id, collectionLease: lease, dependencies });
  assert.equal(Object.values(complete.results)[0].status, 'success');
  const exported = await readDiscoveryExport({ directory });
  assert.equal(exported.jobs.length, 1);
  assert.equal(exported.companies[0].budget_requirement, null);
});

test('D2 a source started on another source remaining budget can resume once with the full unchanged budget', async (t) => {
  const directory = await workspace(t);
  const first = await approved(directory, 'budget-first', { name: 'Budget First' });
  const second = await approved(directory, 'budget-second', { name: 'Budget Second' });
  const batch = await prepare(directory, [first, second], { maxRequests: 4 });
  const calls = [];
  const dependencies = transport(directory, fixturesFor(first, second), calls);
  const partial = await runDiscovery({ directory, batchId: batch.batch_id, collectionLease: lease, dependencies });
  assert.equal(partial.status, 'checkpoint');
  const pending = Object.values(partial.results).find((result) => result.status === 'partial');
  assert.equal(pending.terminal, false);
  assert.equal(pending.budget_requirement, null);
  const complete = await runDiscovery({ directory, batchId: batch.batch_id, collectionLease: lease, dependencies });
  assert.equal(complete.status, 'completed');
  assert.equal((await readDiscoveryExport({ directory })).jobs.length, 2);
  assert.equal(calls.filter((call) => call.url === first.source.board_url).length, 1);
});

test('CLI help declares the discovery wave and report validates analyses against both normalized job stores', async () => {
  assert((await main(['--help'])).commands.includes('collect --all (fixed adapters + one bounded discovery wave)'));
  const fixture = { legacy: [{ job_key: 'legacy:one', description_complete: true }],
    discovery: [{ job_key: 'discovery:one', description_complete: true }],
    analyses: [{ job_key: 'discovery:one', semantic_review_status: 'approved' }], checked: [] };
  globalThis.__discoveryCLIRegression = fixture;
  const target = new URL('../cli.mjs?discovery-report-regression', import.meta.url).href;
  const modules = new Map([
    ['./store.mjs', `export class CareersStore { listJobs(){return globalThis.__discoveryCLIRegression.legacy} listRuns(){return []} listSources(){return []} listEvents(){return []} close(){} }`],
    ['./discovery.mjs', `export const readDiscoveryExport=async()=>({jobs:globalThis.__discoveryCLIRegression.discovery});`],
    ['./report.mjs', `export const writeReport=async value=>value;`],
    ['./overview.mjs', `export const writeOverview=async value=>value;`],
    ['./matching.mjs', `export const loadMatchContext=async()=>({});export const prepareMatches=async jobs=>({jobs});export const importMatches=async(file,jobs)=>({jobs});export const validAnalyses=async jobs=>{const f=globalThis.__discoveryCLIRegression;f.checked=jobs;return f.analyses.filter(a=>jobs.some(j=>j.job_key===a.job_key));};`],
  ]);
  const hook = registerHooks({ resolve(specifier, context, next) {
    if (context.parentURL === target && modules.has(specifier)) return { url: `discovery-cli-regression:${specifier}`, shortCircuit: true };
    return next(specifier, context);
  }, load(url, context, next) {
    if (url.startsWith('discovery-cli-regression:')) return { format: 'module', source: modules.get(url.slice('discovery-cli-regression:'.length)), shortCircuit: true };
    return next(url, context);
  } });
  try {
    const { main: isolatedMain } = await import(target);
    const report = await isolatedMain(['report']);
    assert.deepEqual(fixture.checked.map((job) => job.job_key), ['legacy:one', 'discovery:one']);
    assert.deepEqual(report.analyses, fixture.analyses);
    assert.deepEqual((await isolatedMain(['match:prepare'])).jobs, fixture.checked);
    assert.deepEqual((await isolatedMain(['match:import', '--file', 'in-memory.json'])).jobs, fixture.checked);
  } finally { hook.deregister(); delete globalThis.__discoveryCLIRegression; }
});
