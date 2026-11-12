import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createOfflineDOM } from '../dom.mjs';
import { collectFeishuBrowser, parseFeishuBrowserViews } from '../providers/feishu-browser.mjs';

const origin = 'https://jobs.example.test';
const company = {
  source_id: 'fixture-feishu',
  company_name: 'Fixture AI',
  board_url: `${origin}/careers`,
};

const hash = (value) => createHash('sha256').update(value).digest('hex');

function record(id, overrides = {}) {
  return {
    id,
    title: `岗位 ${id}`,
    city_list: [{ i18n_name: '广州' }],
    department: { name: '商业化' },
    recruit_type: { name: '正式' },
    description: '<h2>职责</h2><p>负责客户经营诊断与方案推进。</p>',
    requirement: '<h2>要求</h2><p>具备复杂销售和跨团队协作能力。</p>',
    ...overrides,
  };
}

function response(query, records, overrides = {}) {
  const url = `${origin}/api/v1/search/job/posts?keyword=${encodeURIComponent(query)}&limit=${records.length || 20}&offset=0`;
  const text = JSON.stringify({ code: 0, data: { count: records.length, job_post_list: records } });
  return {
    url,
    status: 200,
    complete: true,
    source_id: company.source_id,
    transport: 'browser_rendered',
    finished_at: '2026-09-09T08:00:00Z',
    body_path: `fixture/${query || 'default'}.body`,
    metadata_path: `fixture/${query || 'default'}.json`,
    text,
    sha256: hash(text),
    data: JSON.parse(text),
    ...overrides,
  };
}

function snapshot(ids, overrides = {}) {
  const anchors = ids.map((id) => `<a href="/index/position/${id}/detail">岗位 ${id}</a>`).join('');
  const text = `<title>${company.company_name} 招聘</title><body>${anchors}</body>`;
  return {
    url: `${origin}/careers`,
    source_id: company.source_id,
    body_path: 'fixture/board.html',
    metadata_path: 'fixture/board.json',
    screenshot_path: 'fixture/board.png',
    text,
    sha256: hash(text),
    complete: true,
    ...overrides,
  };
}

async function withDOM(fn) {
  const dom = await createOfflineDOM();
  try { return await fn(dom); } finally { await dom.close(); }
}

test('deduplicates same ID across queries and preserves native anchor plus full JD', async () => {
  const first = record('same-id', { salary: undefined });
  const second = record('same-id', { requirement: '<p>要求仍来自第二次查询。</p>' });
  const responses = [response('Business', [first]), response('销售', [second])];
  const result = await withDOM((dom) => parseFeishuBrowserViews({
    dom, company, responses, snapshots: [snapshot(['same-id'])], queries: ['Business', '销售'],
  }));

  assert.equal(result.jobs.length, 1);
  assert.deepEqual(result.jobs[0].raw.source_locator.queries, ['Business', '销售']);
  assert.equal(result.jobs[0].raw.job_url, `${origin}/index/position/same-id/detail`);
  assert.match(result.jobs[0].raw.description_text, /客户经营诊断/);
  assert.match(result.jobs[0].raw.description_text, /要求仍来自第二次查询/);
  assert.equal(result.jobs[0].raw.description_complete, true);
  assert.equal(result.jobs[0].raw.salary_raw, null);
  assert.equal(result.source_metadata.selected_unique_records, 1);
  assert.equal(result.source_metadata.observed_queries.every((view) => view.full_jd_scope_complete), true);
});

test('unknown salary stays unknown and keyword coverage remains partial', async () => {
  const responses = [response('Business', [record('salary-unknown')])];
  const result = await withDOM((dom) => parseFeishuBrowserViews({
    dom, company, responses, snapshots: [snapshot(['salary-unknown'])], queries: ['Business'],
  }));

  assert.equal(result.jobs[0].raw.salary_raw, null);
  assert.deepEqual(result.jobs[0].raw.salary_source_fields, { job_post_info: {} });
  assert.equal(result.complete, false);
  assert.equal(result.scope.company_wide, false);
  assert.equal(result.scope.closure_eligible, false);
  assert.match(result.scope.coverage, /no company-wide completeness or closure inference/);
});

test('cap, missing query, damaged hash, and missing anchor remain explicit failures or partials', async () => {
  const records = [record('one'), record('two')];
  const capped = await withDOM((dom) => parseFeishuBrowserViews({
    dom, company, responses: [response('Business', records)], snapshots: [snapshot(['one', 'two'])],
    queries: ['Business'], maxJobs: 1,
  }));
  assert.equal(capped.jobs.length, 1);
  assert.equal(capped.source_metadata.selected_unique_records, 2);
  assert.ok(capped.errors.some((error) => error.code === 'JOB_CAP'));

  const missingQuery = await withDOM((dom) => parseFeishuBrowserViews({
    dom, company, responses: [response('Business', [record('one')])], snapshots: [snapshot(['one'])],
    queries: ['Business', '销售'],
  }));
  assert.ok(missingQuery.errors.some((error) => error.code === 'BROWSER_QUERY_MISSING'));

  const damaged = response('Business', [record('damaged')], { sha256: 'bad-hash' });
  await assert.rejects(
    () => withDOM((dom) => parseFeishuBrowserViews({ dom, company, responses: [damaged], snapshots: [snapshot(['damaged'])], queries: ['Business'] })),
    /BROWSER_PUBLIC_RESPONSE_HASH_MISMATCH/,
  );

  const missingAnchor = await withDOM((dom) => parseFeishuBrowserViews({
    dom, company, responses: [response('Business', [record('no-anchor')])], snapshots: [snapshot([])], queries: ['Business'],
  }));
  assert.equal(missingAnchor.jobs.length, 0);
  assert.ok(missingAnchor.errors.some((error) => error.code === 'BROWSER_JOB_PARSE_FAILED'));
});

test('403 stop keeps captured records partial, closes reader, and never retries', async () => {
  const captured = record('captured');
  const responses = [response('', [captured]), response('Business', [captured])];
  const stop = Object.assign(new Error('Browser HTTP 403; no refresh/retry'), { code: 'BROWSER_HTTP_ACCESS_STOP' });
  let performCalls = 0;
  let closeCalls = 0;
  const reader = {
    responses,
    stopped: stop,
    async navigate({ ready }) {
      await ready({ waitForFunction: async () => {} });
      return snapshot(['captured']);
    },
    async waitForPublicList(query) {
      return responses.find((item) => new URL(item.url).searchParams.get('keyword') === query);
    },
    async perform(action, callback) {
      performCalls += 1;
      if (action === 'search_销售_public_jobs') throw stop;
      await callback({
        waitForFunction: async () => {},
        locator: () => ({ fill: async () => {}, press: async () => {} }),
      });
      return snapshot(['captured']);
    },
    async close() { closeCalls += 1; },
  };
  const result = await collectFeishuBrowser({
    company: { ...company, browser_queries: ['Business', '销售'] },
    http: { fixture: true },
    openBrowser: async () => reader,
    openDOM: async () => createOfflineDOM(),
  });

  assert.equal(result.jobs.length, 1);
  assert.equal(result.complete, false);
  assert.equal(result.source_health, 'stopped_after_partial_browser_capture');
  assert.ok(result.errors.some((error) => error.code === 'HTTP_ACCESS_STOP'));
  assert.ok(result.errors.some((error) => error.code === 'BROWSER_QUERY_MISSING'));
  assert.equal(performCalls, 2);
  assert.equal(closeCalls, 1);
});
