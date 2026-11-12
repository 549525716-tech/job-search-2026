// Public field mapping shares the attribution retained in THIRD_PARTY_LICENSES.md.
// Browser transport and evidence handling are local; no upstream signing/auth code is used.
import { createHash } from 'node:crypto';
import { htmlText } from './common.mjs';
import { createOfflineDOM } from '../dom.mjs';
import { openPublicBrowser } from './public-browser.mjs';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const name = (value) => typeof value === 'string' ? value : null;
export const FEISHU_BROWSER_QUERIES = Object.freeze(['Business', '\u9500\u552e']);

function validateScope(queries, maxJobs) {
  if (!Number.isSafeInteger(maxJobs) || maxJobs < 1 || maxJobs > 20 || queries.length < 1 || queries.length > 2 ||
      new Set(queries).size !== queries.length || queries.some((query) => typeof query !== 'string' || !query.trim() || query.length > 80)) {
    throw new Error('Public browser scope requires 1-2 distinct queries and at most 20 jobs');
  }
}

// Parse only saved public responses and rendered anchors. This function never requests a URL.
export async function parseFeishuBrowserViews({ dom, company, responses, snapshots, queries = FEISHU_BROWSER_QUERIES, maxJobs = 20 }) {
  validateScope(queries, maxJobs);
  const links = new Map();
  let pageTitle = null;
  for (const snapshot of snapshots) {
    if (snapshot.complete === false) continue;
    if (new URL(snapshot.url).origin !== new URL(company.board_url).origin || snapshot.source_id !== company.source_id) {
      throw new Error('BROWSER_DOM_SOURCE_MISMATCH');
    }
    if (sha256(snapshot.text) !== snapshot.sha256) throw new Error('BROWSER_DOM_HASH_MISMATCH');
    const page = await dom.evaluate(({ html, base }) => {
      const document = new DOMParser().parseFromString(html, 'text/html');
      return { title: document.title, links: [...document.querySelectorAll('a[href]')].flatMap((anchor) => {
        try { return [{ url: new URL(anchor.getAttribute('href'), base).href, text: anchor.textContent.trim() }]; }
        catch { return []; }
      }) };
    }, { html: snapshot.text, base: snapshot.url });
    if (!page.title.includes(company.company_name)) throw new Error('BROWSER_BOARD_IDENTITY_MISMATCH');
    pageTitle = page.title;
    for (const link of page.links) {
      const url = new URL(link.url);
      if (url.origin !== new URL(company.board_url).origin) continue;
      const match = /^\/index\/position\/([\w-]+)\/detail\/?$/.exec(url.pathname);
      if (match) links.set(match[1], { ...link, body_path: snapshot.body_path, metadata_path: snapshot.metadata_path,
        screenshot_path: snapshot.screenshot_path, sha256: snapshot.sha256 });
    }
  }
  const views = [];
  const selected = new Map();
  const errors = [];
  for (const [responseIndex, response] of responses.entries()) {
    if (sha256(response.text) !== response.sha256) throw new Error('BROWSER_PUBLIC_RESPONSE_HASH_MISMATCH');
    if (response.status !== 200 || !response.complete || response.source_id !== company.source_id || response.transport !== 'browser_rendered') {
      throw new Error('BROWSER_PUBLIC_RESPONSE_NOT_SUCCESSFUL');
    }
    const url = new URL(response.url);
    if (url.origin !== new URL(company.board_url).origin || url.pathname !== '/api/v1/search/job/posts') continue;
    try {
      const envelope = JSON.parse(response.text);
      if (envelope?.code !== 0 || !Array.isArray(envelope.data?.job_post_list)) throw new Error('BROWSER_PUBLIC_LIST_SCHEMA');
      const list = envelope.data.job_post_list;
      const total = envelope.data.count;
      const query = url.searchParams.get('keyword') ?? '';
      const limit = Number(url.searchParams.get('limit'));
      const offset = Number(url.searchParams.get('offset'));
      if (!Number.isSafeInteger(total) || total < 0 || !Number.isSafeInteger(limit) || limit < 1 ||
          !Number.isSafeInteger(offset) || offset < 0 || list.length > limit || list.length > total) throw new Error('BROWSER_PUBLIC_LIST_PAGINATION');
      const ids = list.map((record) => typeof record?.id === 'string' || Number.isSafeInteger(record?.id) ? String(record.id) : '');
      if (ids.some((id) => !/^[\w-]+$/.test(id)) || new Set(ids).size !== ids.length) throw new Error('BROWSER_PUBLIC_LIST_IDS');
      const chosen = queries.includes(query);
      const view = { query: query || null, offset, limit, page: Math.floor(offset / limit) + 1,
        reported_total: total, returned_records: list.length, unique_records: ids.length,
        list_scope_complete: offset === 0 && list.length === total, full_jd_scope_complete: false,
        selected_for_normalization: chosen, body_path: response.body_path, metadata_path: response.metadata_path,
        sha256: response.sha256, observed_at: response.finished_at, closure_eligible: false };
      views.push(view);
      if (!chosen) continue;
      for (const record of list) {
        const id = String(record.id);
        const previous = selected.get(id);
        selected.set(id, { record, response, queries: [...new Set([...(previous?.queries ?? []), query])],
          first_observed_at: previous?.first_observed_at ?? response.finished_at });
      }
    } catch (error) {
      errors.push({ code: 'BROWSER_VIEW_PARSE_FAILED', message: error.message, response_index: responseIndex,
        query: url.searchParams.get('keyword') ?? null, evidence: response.metadata_path, body_path: response.body_path });
    }
  }
  const jobs = [];
  for (const [id, item] of selected) {
    if (jobs.length >= maxJobs) break;
    const { record, response } = item;
    try {
      const link = links.get(id);
      if (!link || !link.text.includes(record.title)) throw new Error('Native detail anchor missing from rendered evidence');
      const description = await htmlText(dom, record.description);
      const requirement = await htmlText(dom, record.requirement);
      const combinedDescription = record.requirement === null;
      if (!record.title?.trim() || !description || (!requirement && !combinedDescription)) throw new Error('Full public description or requirements absent');
      const info = record.job_post_info ?? {};
      const salaryFields = Object.fromEntries(['salary', 'salary_range', 'salary_min', 'salary_max', 'salary_currency', 'salary_period', 'compensation']
        .filter((key) => Object.hasOwn(record, key)).map((key) => [key, record[key]]));
      salaryFields.job_post_info = Object.fromEntries(['min_salary', 'max_salary', 'currency']
        .filter((key) => Object.hasOwn(info, key)).map((key) => [key, info[key]]));
      jobs.push({ raw: { source_job_id: id, title: record.title,
        location_raw: record.city_list?.map((city) => name(city.i18n_name) ?? name(city.name)).filter(Boolean).join(' / ') || null,
        department: name(record.department?.name) ?? name(info.department?.name), employment_type: name(record.recruit_type?.name),
        description_text: [description, requirement].filter(Boolean).join('\n\n'),
        responsibilities: combinedDescription ? null : description, requirements: requirement || null,
        description_html: null, description_complete: true,
        detail_completeness: combinedDescription ? 'full_source_description' : 'full_public_list_description_and_requirement',
        published_raw: record.publish_time ?? null, created_raw: record.create_time ?? info.biz_create_time ?? null,
        updated_raw: record.update_time ?? info.biz_modify_time ?? null,
        published_at_semantics: 'Source publish_time preserved verbatim; unit and original versus republication semantics unconfirmed; not first observation',
        source_timestamp_semantics: 'Original source values; never replaced with browser observation time',
        hiring_active: 'unknown', first_observed_at: item.first_observed_at,
        salary_raw: name(record.salary) ?? name(record.salary_range),
        salary_source_fields: salaryFields, salary_hints: { currency: record.salary_currency, period: record.salary_period },
        job_url: link.url, board_url: company.board_url, link_verification: 'rendered_native_anchor_not_navigated',
        capture_mode: 'browser_rendered', source_locator: { kind: 'browser_public_job_list_record', native_id: id,
          queries: item.queries, first_observed_at: item.first_observed_at, native_link_evidence: link }, source_record: record }, response });
    } catch (error) { errors.push({ code: 'BROWSER_JOB_PARSE_FAILED', source_job_id: id, message: error.message, evidence: response.metadata_path }); }
  }
  const normalizedIds = new Set(jobs.map(({ raw }) => raw.source_job_id));
  for (const view of views) {
    const response = responses.find((item) => item.metadata_path === view.metadata_path);
    view.full_jd_scope_complete = view.selected_for_normalization && view.list_scope_complete &&
      JSON.parse(response.text).data.job_post_list.every((record) => normalizedIds.has(String(record.id)));
  }
  const missing = queries.filter((query) => !views.some((view) => view.query === query && view.selected_for_normalization));
  if (missing.length) errors.push({ code: 'BROWSER_QUERY_MISSING', message: `No captured public list for: ${missing.join(', ')}` });
  if (selected.size > maxJobs) errors.push({ code: 'JOB_CAP', message: `${maxJobs} normalized jobs cap reached; remaining records retained raw` });
  const coverage = `Browser-rendered sample only: default list ${views.find((view) => view.query === null)?.returned_records ?? 0}/${views.find((view) => view.query === null)?.reported_total ?? 'unknown'} retained raw, not fully traversed; ` +
    views.filter((view) => view.selected_for_normalization).map((view) => `query=${JSON.stringify(view.query)}, offset=${view.offset}, returned=${view.returned_records}/${view.reported_total}, full-JD query coverage=${view.full_jd_scope_complete}`).join('; ') +
    '; no company-wide completeness or closure inference';
  return { jobs, errors, complete: false, page_title: pageTitle, parser: 'feishu-browser-v1: saved public JSON + rendered native anchors + offline DOM text',
    board: snapshots.at(-1), transport: 'browser_rendered', source_health: 'reachable_query_scoped_sample',
    pagination: { pages_fetched: views.length, max_pages: 3, truncated: true, normalized_jobs: jobs.length, max_jobs: maxJobs },
    scope: { coverage, company_wide: false, closure_eligible: false },
    source_metadata: { capture_mode: 'browser_rendered', observed_queries: views, selected_unique_records: selected.size,
      normalized_jobs: jobs.length, default_list_normalized: false, parser_revision: 'feishu-browser-v1',
      request_semantics: 'Website-owned public responses, not direct API requests; no request body, signature or CSRF emulation',
      public_response_evidence: responses.map(({ text, data, ...receipt }) => receipt) } };
}

async function waitForNativeLinks(page, response, company) {
  const ids = response.data.data.job_post_list.map((record) => String(record.id));
  if (!ids.length) return;
  await page.waitForFunction(({ ids, origin }) => {
    const links = new Set([...document.querySelectorAll('a[href]')].map((anchor) => anchor.href));
    return ids.every((id) => links.has(`${origin}/index/position/${encodeURIComponent(id)}/detail`));
  }, { ids, origin: new URL(company.board_url).origin }, { timeout: 15_000 });
}

export async function collectFeishuBrowser({ http, company, openBrowser = openPublicBrowser, openDOM = createOfflineDOM }) {
  const queries = company.browser_queries ?? FEISHU_BROWSER_QUERIES;
  validateScope(queries, 20);
  const snapshots = [];
  const errors = [];
  const rememberError = (error) => {
    const code = error.code === 'BROWSER_HTTP_ACCESS_STOP' ? 'HTTP_ACCESS_STOP'
      : ['BROWSER_CHALLENGE_OR_LOGIN', 'BROWSER_LOGIN_OR_UNAPPROVED_NAVIGATION'].includes(error.code) ? 'CHALLENGE_STOP'
        : error.code ?? 'BROWSER_COLLECTION_FAILED';
    if (!errors.some((item) => item.code === code && item.message === error.message)) {
      errors.push({ code, browser_code: error.code ?? null, message: error.message, evidence: error.evidence ?? null });
    }
  };
  let reader;
  try {
    reader = await openBrowser({ company, http });
    snapshots.push(await reader.navigate({ ready: async (page) => {
      await waitForNativeLinks(page, await reader.waitForPublicList(''), company);
    } }));
    for (const query of queries) {
      const after = reader.responses.length;
      snapshots.push(await reader.perform(`search_${query}_public_jobs`, async (page) => {
        const input = page.locator('input[placeholder="\u641c\u7d22\u804c\u4f4d"]');
        await input.fill(query);
        await input.press('Enter');
        await waitForNativeLinks(page, await reader.waitForPublicList(query, { after }), company);
      }));
    }
  } catch (error) {
    rememberError(error);
  } finally {
    if (reader) {
      try { await reader.close(); }
      catch (error) { errors.push({ code: 'BROWSER_CLOSE_FAILED', message: error.message }); }
    }
  }
  if (reader?.stopped) rememberError(reader.stopped);
  // The live context is closed before starting the isolated, network-disabled DOM decoder.
  const dom = await openDOM();
  try {
    let parsed;
    try { parsed = await parseFeishuBrowserViews({ dom, company, responses: reader?.responses ?? [], snapshots, queries }); }
    catch (error) {
      parsed = { jobs: [], complete: false, errors: [{ code: 'BROWSER_PARSE_FAILED', message: error.message }],
        parser: 'feishu-browser-v1', board: snapshots.at(-1), transport: 'browser_rendered', source_metadata: {},
        pagination: { pages_fetched: snapshots.length, max_pages: 3, truncated: true } };
    }
    parsed.errors.push(...errors);
    if (errors.length) parsed.source_health = 'stopped_after_partial_browser_capture';
    return parsed;
  } finally { await dom.close(); }
}
