// Offline probes only. Transpile reviewed TS modules in memory without installing Bun.
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { GREENHOUSE, LEVER, ASHBY } from './vendor/ats-jobs/src/providers.js';

const root = fileURLToPath(new URL('.', import.meta.url));
const harvester = join(root, 'vendor/offer-harvester/.agents/skills/company-careers-search/cli/src/');
globalThis.fetch = async () => { throw new Error('Network disabled in offline contract probes'); };
registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.startsWith(pathToFileURL(harvester).href) && specifier.startsWith('.') && specifier.endsWith('.js')) {
      const candidate = new URL(specifier.slice(0, -3) + '.ts', context.parentURL);
      if (existsSync(candidate)) return next(candidate.href, context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith(pathToFileURL(harvester).href) && url.endsWith('.ts')) {
      return { format: 'module', source: stripTypeScriptTypes(readFileSync(new URL(url), 'utf8'), { mode: 'transform' }), shortCircuit: true };
    }
    return next(url, context);
  },
});
const { resolveBoard, fetchPage } = await import(pathToFileURL(join(harvester, 'providers.ts')).href);
const { fetchSearch } = await import(pathToFileURL(join(harvester, 'commands/search.ts')).href);
const { PublicClient } = await import(pathToFileURL(join(harvester, 'http.ts')).href);
const results = [];
async function probe(name, classification, fn) {
  await fn();
  results.push({ name, classification, reproduced: true, network: false });
}

await probe('ats-jobs maps Greenhouse updated_at into publishedAt when publication is absent', 'gap', () => {
  const [row] = GREENHOUSE.parse({ jobs: [{ id: 1, title: 'Sales', updated_at: '2026-09-01T00:00:00Z' }] }, 'fixture');
  assert.equal(row.publishedAt, row.updatedAt);
});
await probe('ats-jobs drops Lever responsibilities/requirements lists', 'gap', () => {
  const [row] = LEVER.parse([{ id: '1', text: 'Sales', hostedUrl: 'https://example.com/1', descriptionPlain: 'Introduction', lists: [{ text: 'Required', content: '<li>Enterprise procurement</li>' }] }], 'fixture');
  assert.equal(row.description.includes('Enterprise procurement'), false);
});
await probe('ats-jobs drops Ashby compensation and does not exclude unlisted postings', 'gap', () => {
  const rows = ASHBY.parse({ jobs: [{ id: '1', title: 'Sales', isListed: false, compensation: { compensationTierSummary: 'CNY 20K-30K/month' } }] }, 'fixture');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].salary, undefined);
});

const company = { id: 'fixture', name: 'Fixture', url: 'https://fixture.jobs.feishu.cn' };
const posting = { id: '1', title: 'AI sales', description: 'Discover customer needs', requirement: 'Business negotiation', city_list: [{ name: 'Guangzhou' }], publish_time: 1788480000 };
await probe('Offer Harvester Feishu fixture retains duties, requirements and city', 'capability', async () => {
  const out = await fetchPage(company, resolveBoard(company), 'sales', 1, async () => ({ code: 0, data: { count: 1, job_post_list: [posting] } }));
  assert.match(out.jobs[0].description, /Discover customer needs/);
  assert.match(out.jobs[0].description, /Business negotiation/);
  assert.equal(out.jobs[0].location, 'Guangzhou');
});
await probe('Offer Harvester page limit is explicitly partial', 'capability', async () => {
  const out = await fetchSearch({ query: 'sales', maxPages: 1 }, { companies: [company], check: async () => {}, read: async () => ({ code: 0, data: { count: 200, job_post_list: [posting] } }) });
  assert.equal(out.meta.runs[0].status, 'partial');
  assert.equal(out.meta.complete, false);
});
await probe('Offer Harvester source failure differs from successful empty result', 'capability', async () => {
  const out = await fetchSearch({ query: 'sales' }, { companies: [company], check: async () => {}, read: async () => { throw new Error('fixture 429'); } });
  assert.equal(out.meta.runs[0].status, 'error');
  assert.equal(out.meta.complete, false);
  const empty = await fetchSearch({ query: 'sales' }, { companies: [company], check: async () => {}, read: async () => ({ code: 0, data: { count: 0, job_post_list: [] } }) });
  assert.equal(empty.meta.runs[0].status, 'ok');
  assert.equal(empty.meta.complete, true);
  assert.equal(empty.results.length, 0);
});
await probe('Offer Harvester stops on robots disallow without API request', 'capability', async () => {
  const calls = [];
  const client = new PublicClient(async url => { calls.push(url); return new Response('User-agent: *\nDisallow: /api'); }, async () => {});
  await assert.rejects(client.json('https://fixture.jobs.feishu.cn/api/jobs'), /robots/);
  assert.equal(calls.length, 1);
});
await probe('Offer Harvester company adapter drops Ashby compensation', 'gap', async () => {
  const c = { id: 'fixture', name: 'Fixture', url: 'https://jobs.ashbyhq.com/fixture' };
  const out = await fetchPage(c, resolveBoard(c), '', 1, async () => ({ jobs: [{ id: '1', title: 'Sales', jobUrl: 'https://jobs.ashbyhq.com/fixture/1', compensation: { compensationTierSummary: 'CNY 20K-30K/month' } }] }));
  assert.equal(out.jobs[0].salary, undefined);
  assert.equal(out.jobs[0].salary_raw, undefined);
});

mkdirSync(join(root, 'evidence'), { recursive: true });
const report = { audited_at: new Date().toISOString(), scope: 'Independent synthetic offline probes, not the complete upstream Bun test suite or live site validation', probes: results };
writeFileSync(join(root, 'evidence/contract-probes.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
