import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createOfflineDOM } from '../dom.mjs';
import { collectGenericOfficial, parseGenericPage } from '../providers/generic-official.mjs';

let dom;
before(async () => { dom = await createOfflineDOM(); });
after(async () => { await dom?.close(); });
const base = 'https://generic.example.com';
const source = (changes = {}) => ({ company_name: 'Fixture Employer', identity_tokens: ['Fixture Employer'],
  board_url: `${base}/careers/`, ownership_url: `${base}/about`, fixed_urls: [`${base}/careers/`, `${base}/careers/page-2`, `${base}/careers/job-1`],
  static: { mode: 'jsonld', page_urls: [`${base}/careers/`], scope_selector: '#careers', jsonld_list_id: `${base}/careers/#jobs` }, ...changes });
const job = (id = 'one') => ({ '@type': 'JobPosting', identifier: { value: id }, title: 'Unfamiliar title without keyword filtering',
  description: '<p>Full original responsibilities for technical architecture and operational support.</p>',
  hiringOrganization: { name: 'Fixture Employer' } });
const page = (records, total = records.length, next = '') => `<main id="careers"><script type="application/ld+json">${JSON.stringify({
  '@type': 'ItemList', '@id': `${base}/careers/#jobs`, numberOfItems: total, itemListElement: records,
})}</script>${next}</main>`;
const response = (text, url = `${base}/careers/`) => ({ url, text, status: 200, complete: true,
  metadata_path: 'fixture.response.json', body_path: 'fixture.body', sha256: 'fixture', finished_at: new Date().toISOString() });

test('static JSON-LD keeps all full descriptions regardless of unfamiliar title', async () => {
  const parsed = await parseGenericPage({ dom, company: source(), response: response(page([job()])) });
  assert.equal(parsed.jobs.length, 1);
  assert.equal(parsed.jobs[0].raw.detail_completeness, 'full_source_description');
  assert.match(parsed.jobs[0].raw.description_text, /technical architecture/);
  assert.deepEqual(parsed.jobs[0].raw.source_record, job());
});

test('only reconciled native zero is empty; structure-free and loading pages are not empty', async () => {
  const collect = (text) => collectGenericOfficial({ dom, company: source(), http: { get: async () => response(text) } });
  const empty = await collect(page([], 0));
  assert.equal(empty.source_status, 'verified_empty');
  assert.equal(empty.complete, true);
  const missing = await collect('<main id="careers">Careers require JavaScript</main>');
  assert.equal(missing.source_status, 'unsupported');
  assert.equal(missing.complete, false);
  const loading = await collect(page([], 0) + '<div aria-busy="true"></div>');
  assert.equal(loading.complete, false);
  assert.equal(loading.source_status, 'partial');
});

test('page checkpoint resumes admitted pagination and reconciles across observation windows', async () => {
  const calls = [];
  const company = source();
  const http = { get: async (url) => { calls.push(url); return response(url.endsWith('page-2') ? page([job('two')], 2)
    : page([job()], 2, '<a rel="next" href="page-2">Next</a>'), url); } };
  const first = await collectGenericOfficial({ dom, company, http, maxPages: 1 });
  assert.equal(first.source_status, 'partial');
  assert.equal(first.cursor.pending[0].url, `${base}/careers/page-2`);
  const second = await collectGenericOfficial({ dom, company, http, cursor: first.cursor, maxPages: 1 });
  assert.equal(second.source_status, 'success');
  assert.equal(second.source_complete, true);
  assert.equal(second.complete, false, 'resumed observations are not a simultaneous full snapshot');
  assert.deepEqual(calls, [`${base}/careers/`, `${base}/careers/page-2`]);
});

test('unapproved next/detail links stay pending and never become URL allowlists', async () => {
  const calls = [];
  const http = { get: async (url) => { calls.push(url); return response(page([{ '@type': 'ListItem', item: 'https://other.example.com/jobs/1' }], 1,
    '<a rel="next" href="/another-tenant/jobs">Next</a>')); } };
  const result = await collectGenericOfficial({ dom, company: source(), http });
  assert.equal(calls.length, 1);
  assert.equal(result.cursor.pending_admission.length, 2);
  assert.equal(result.complete, false);
});

test('source failure after a page keeps collected jobs and pending cursor', async () => {
  const http = { get: async (url) => {
    if (url.endsWith('page-2')) throw Object.assign(new Error('403 fixture'), { code: 'HTTP_ACCESS_STOP' });
    return response(page([job()], 2, '<a rel="next" href="page-2">Next</a>'));
  } };
  const result = await collectGenericOfficial({ dom, company: source(), http });
  assert.equal(result.jobs.length, 1);
  assert.equal(result.source_status, 'blocked');
  assert.equal(result.cursor.pending[0].url, `${base}/careers/page-2`);
});

test('reviewed static HTML selectors read full source rows and native total', async () => {
  const company = source({ static: { mode: 'html-list', page_urls: [`${base}/careers/`], scope_selector: '#careers',
    item_selector: '.job', title_selector: 'h2', description_selector: '.description', id_attribute: 'data-id',
    total_selector: '#total', total_attribute: 'data-total' } });
  const text = '<main id="careers"><span id="total" data-total="1"></span><article class="job" data-id="html-1">'
    + '<h2>Any native title</h2><div class="description"><p>Original full text preserved.</p></div></article></main>';
  const result = await collectGenericOfficial({ dom, company, http: { get: async () => response(text) } });
  assert.equal(result.complete, true);
  assert.equal(result.jobs[0].raw.source_job_id, 'html-1');
});

test('other-employer structured records become discovery evidence, not this employer jobs', async () => {
  const other = { ...job(), hiringOrganization: { name: 'Another Employer', url: 'https://other.example.com/' } };
  const result = await collectGenericOfficial({ dom, company: source(), http: { get: async () => response(page([other])) } });
  assert.equal(result.jobs.length, 0);
  assert.equal(result.complete, false);
  assert.equal(result.cursor.discovered_companies[0].company_name, 'Another Employer');
});
