// Public list shape informed by Offer Harvester cd0086ea and career-ops.
// See THIRD_PARTY_LICENSES.md. No upstream transport, auth or application code is used.
import { htmlText } from './common.mjs';

export async function inspectFeishuBoard(dom, response, company) {
  const page = await dom.evaluate((html) => {
    const document = new DOMParser().parseFromString(html, 'text/html');
    return { title: document.title, data: [...document.querySelectorAll('script[type="text/json"]')].map((script) => script.textContent) };
  }, response.text);
  const states = page.data.map((text) => JSON.parse(text)).filter((value) => value.tenant_info && value.website_info);
  if (states.length !== 1 || !page.title.includes(company.company_name) ||
      !JSON.stringify(states[0].tenant_info).includes(company.company_name)) throw new Error('FEISHU_BOARD_IDENTITY_MISMATCH');
  return { page_title: page.title, tenant_name: states[0].tenant_info.tenant_name,
    website_id: states[0].website_info.id, website_path: states[0].website_info.path };
}

export async function collectFeishu({ http, dom, company, board }) {
  const identity = await inspectFeishuBoard(dom, board, company);
  const jobs = [];
  const errors = [];
  const seen = new Set();
  let total = null;
  let returned = 0;
  let pagesFetched = 0;
  let complete = false;
  const limit = 100;
  const endpoint = company.public_post_urls[0];
  for (let page = 0; page < 3; page++) {
    try {
      const response = await http.postJson(endpoint, { limit, offset: page * limit, keyword: '' }, {
        board_metadata_path: board.metadata_path, board_url: board.url, website_id: identity.website_id,
        public_contract: 'Feishu public career-board job list; unauthenticated; no private ATS endpoints',
        reference: 'research/company-careers/vendor/offer-harvester/.agents/skills/company-careers-search/cli/src/providers.ts',
        vendor_commit: 'cd0086ea48786c0216e6a5905be613bcfa8471cd',
      });
      if (!String(response.headers['content-type'] ?? '').includes('application/json')) throw new Error('FEISHU_NON_JSON');
      const envelope = JSON.parse(response.text);
      if (envelope.code !== 0 || !Array.isArray(envelope.data?.job_post_list)) throw new Error(`FEISHU_SCHEMA_ERROR: code=${envelope.code}`);
      const list = envelope.data.job_post_list;
      const count = envelope.data.count;
      if (!Number.isSafeInteger(count) || count < 0 || (total !== null && total !== count) || list.length > limit) throw new Error('FEISHU_UNSTABLE_TOTAL');
      total = count;
      pagesFetched++;
      returned += list.length;
      for (const record of list) {
        try {
          if ((typeof record.id !== 'string' && !Number.isSafeInteger(record.id)) || !String(record.id) || seen.has(String(record.id))) throw new Error('Missing/duplicate native ID');
          seen.add(String(record.id));
          const description = await htmlText(dom, record.description);
          const requirement = await htmlText(dom, record.requirement);
          if (!record.title?.trim() || !description || !requirement) throw new Error('Full description/requirements absent from public list');
          const location = Array.isArray(record.city_list) ? record.city_list.map((city) => city?.name).filter(Boolean).join(' / ') : null;
          const salaryFields = Object.fromEntries(['salary', 'salary_range', 'salary_min', 'salary_max', 'salary_currency', 'salary_period', 'compensation']
            .filter((key) => Object.hasOwn(record, key)).map((key) => [key, record[key]]));
          const salaryRaw = typeof record.salary === 'string' ? record.salary : typeof record.salary_range === 'string' ? record.salary_range : null;
          jobs.push({ raw: { source_job_id: String(record.id), title: record.title, location_raw: location || null,
            department: record.department?.name ?? null, employment_type: record.recruit_type?.name ?? null,
            description_text: [description, requirement].join('\n\n'), responsibilities: description, requirements: requirement,
            description_html: null, description_complete: true, detail_completeness: 'full_public_list_description_and_requirement',
            published_raw: record.publish_time ?? null, created_raw: record.create_time ?? null, updated_raw: record.update_time ?? null,
            published_at_semantics: 'Source publish_time retained verbatim; original versus republished date and timestamp unit unconfirmed',
            source_timestamp_semantics: 'Source publish/create/update timestamps retained verbatim; not observation timestamps',
            hiring_active: 'unknown', salary_raw: salaryRaw,
            salary_hints: { currency: record.salary_currency, period: record.salary_period }, salary_source_fields: salaryFields,
            job_url: `${new URL(board.url).origin}/index/position/${encodeURIComponent(record.id)}/detail`,
            source_locator: { kind: 'public_job_list_record', native_id: String(record.id), page: page + 1, offset: page * limit },
            source_record: record }, response });
        } catch (error) { errors.push({ code: 'JOB_PARSE_FAILED', source_job_id: record?.id ?? null, message: error.message, evidence: response.metadata_path }); }
      }
      if (returned === total) { complete = errors.length === 0 && jobs.length === total; break; }
      if (list.length === 0 || returned > total) throw new Error('FEISHU_MISSING_OR_EXCESS_PAGE');
    } catch (error) {
      errors.push({ code: error.code ?? 'FEISHU_COLLECTION_FAILED', message: error.message, evidence: error.evidence ?? null });
      break;
    }
  }
  if (total !== null && returned < total && pagesFetched === 3) errors.push({ code: 'PAGE_CAP', message: 'Three public-list pages reached; snapshot incomplete, no closure inference' });
  return { jobs, errors, complete, page_title: identity.page_title, parser: 'Feishu public JSON + offline DOM text decoding',
    pagination: { current: pagesFetched, pages: total === null ? null : Math.ceil(total / limit), total, size: limit,
      returned_records: returned, pages_fetched: pagesFetched, max_pages: 3 }, scope: { query: null, filters: {},
      coverage: 'public social-career board only; maximum three pages; no campus or company-wide closure inference',
      company_wide: false, closure_eligible: false, website_id: identity.website_id, website_path: identity.website_path } };
}
