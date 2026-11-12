import { createHash } from 'node:crypto';
import { htmlText } from './common.mjs';

const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const isType = (node, type) => [node?.['@type']].flat().some((value) => value === type || value === `https://schema.org/${type}`);
const canonical = (value, base) => { const url = new URL(value, base); url.hash = ''; return url.href; };

export function initialGenericCursor(company) {
  return { schema_version: 1, pending: company.static.page_urls.map((url) => ({ url, kind: 'list' })),
    visited: [], seen: {}, native_total: null, pending_admission: [], manual: [], discovered_companies: [], done: false };
}

export async function parseGenericPage({ dom, response, company, kind = 'list' }) {
  const spec = company.static;
  const page = await dom.evaluate(({ html, spec, kind }) => {
    const document = new DOMParser().parseFromString(html, 'text/html');
    const scope = document.querySelector(spec.scope_selector);
    const value = (node, selector) => node.querySelector(selector)?.textContent?.trim() ?? '';
    const next = [...document.querySelectorAll(spec.next_selector ?? 'a[rel~="next"]')]
      .filter((node) => !node.hasAttribute('disabled') && node.getAttribute('aria-disabled') !== 'true')
      .map((node) => node.getAttribute('href')).filter(Boolean);
    const totalNode = spec.total_selector ? document.querySelector(spec.total_selector) : null;
    const totalText = totalNode ? (spec.total_attribute ? totalNode.getAttribute(spec.total_attribute) : totalNode.textContent)?.trim() : null;
    const total = typeof totalText === 'string' && /^\d+$/.test(totalText) ? Number(totalText) : null;
    const scripts = [...document.querySelectorAll('script[type="application/ld+json"]')].map((node) => node.textContent);
    const rows = spec.mode === 'html-list' && scope ? [...scope.querySelectorAll(spec.item_selector)].map((node) => ({
      id: node.getAttribute(spec.id_attribute), title: value(node, spec.title_selector),
      description: node.querySelector(spec.description_selector)?.innerHTML ?? '',
      url: spec.link_selector ? node.querySelector(spec.link_selector)?.getAttribute('href') : null,
      location: spec.location_selector ? value(node, spec.location_selector) : null,
      html: node.outerHTML,
    })) : [];
    return { title: document.title, scope_present: Boolean(scope), scripts, rows, next, total,
      loading: Boolean(document.querySelector('[aria-busy="true"]')),
      login: Boolean(document.querySelector('input[type="password"]')), kind };
  }, { html: response.text, spec, kind });
  if (page.login) throw Object.assign(new Error('Login form in static response; no anonymous fallback'), { code: 'LOGIN_REQUIRED' });
  const errors = [];
  const originals = [];
  const nodes = [];
  const links = [];
  const employers = [];
  let nativeTotal = page.total;
  let listFound = spec.mode === 'html-list' && page.scope_present;
  if (spec.mode === 'jsonld') {
    const visit = (value) => {
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value)) { value.forEach(visit); return; }
      if (isType(value, 'JobPosting')) nodes.push(value);
      if (isType(value, 'ItemList') && spec.jsonld_list_id && value['@id'] === spec.jsonld_list_id) {
        listFound = true;
        const total = value.numberOfItems;
        if (Number.isSafeInteger(total) && total >= 0) {
          if (nativeTotal !== null && nativeTotal !== total) errors.push({ code: 'NATIVE_TOTAL_CONFLICT' });
          nativeTotal = total;
        }
        for (const element of value.itemListElement ?? []) {
          const item = element.item ?? element;
          if (!isType(item, 'JobPosting')) {
            const url = typeof item === 'string' ? item : item.url ?? item['@id'];
            if (typeof url === 'string') links.push(url);
            else errors.push({ code: 'LIST_ITEM_UNRESOLVED', record: element });
          }
        }
      }
      for (const child of Object.values(value)) if (child && typeof child === 'object') visit(child);
    };
    for (const script of page.scripts) {
      try { const data = JSON.parse(script); originals.push(data); visit(data); }
      catch { errors.push({ code: 'JSONLD_INVALID', message: 'JSON-LD was not valid JSON; script never executed' }); }
    }
  }
  const jobs = [];
  const pending = [];
  const records = spec.mode === 'jsonld' ? nodes : page.rows;
  for (const record of records) {
    const org = record.hiringOrganization;
    if (org?.name && ![company.company_name, company.legal_name, ...company.identity_tokens]
      .filter(Boolean).some((name) => name.normalize('NFKC').toLowerCase() === String(org.name).normalize('NFKC').toLowerCase())) {
      errors.push({ code: 'EMPLOYER_IDENTITY_MISMATCH', employer: org.name });
      employers.push({ company_name: org.name, homepage: org.url ?? null, source_url: response.url, source_record: record,
        route: 'B', evidence: { metadata_path: response.metadata_path, body_path: response.body_path, sha256: response.sha256 } });
      pending.push({ reason: 'employer_verification', record });
      continue;
    }
    const id = spec.mode === 'jsonld' ? record.identifier?.value ?? (typeof record.identifier === 'string' ? record.identifier : null)
      ?? record['@id'] ?? record.url : record.id;
    const title = record.title;
    const description = await htmlText(dom, record.description);
    if (id == null || !String(id).trim() || typeof title !== 'string' || !title.trim() || !description
      || /^(?:loading[.\s]*|加载中[.\s]*|待补充|coming soon[.\s]*)$/i.test(description)) {
      if (record.url) links.push(record.url);
      else pending.push({ reason: 'full_description_or_stable_id_missing', record });
      continue;
    }
    let jobUrl = response.url;
    if (record.url) {
      try {
        const url = new URL(record.url, response.url);
        if (url.protocol === 'https:' && !url.username && !url.password) jobUrl = url.href;
      } catch { /* Invalid source links remain in source_record, never navigated. */ }
    }
    const location = spec.mode === 'jsonld' && record.jobLocation
      ? JSON.stringify(record.jobLocation) : record.location ?? null;
    jobs.push({ raw: { source_job_id: String(id), title: title.trim(), description_text: description,
      description_html: record.description, description_complete: true, detail_completeness: 'full_source_description',
      location_raw: location, employment_type: record.employmentType ?? null, salary_raw: null,
      salary_source_fields: record.baseSalary ?? null, published_raw: record.datePosted ?? null,
      published_date: record.datePosted ?? null, published_at: record.datePosted ?? null,
      published_at_semantics: 'Source datePosted retained without inferring publication from crawl time',
      job_url: jobUrl, board_url: company.board_url, link_verification: jobUrl === response.url ? 'captured_response' : 'source_embedded_not_navigated',
      source_locator: { response_url: response.url, structured_type: spec.mode }, source_record: record }, response });
  }
  if (kind === 'detail' && !records.length) pending.push({ reason: 'detail_requires_parser', url: response.url });
  const structured = records.length > 0 || listFound;
  if (!structured) errors.push({ code: 'PARSER_REQUIRED', message: 'No supported static job structure; not an empty board' });
  if (!page.scope_present && kind === 'list') errors.push({ code: 'STATIC_SCOPE_MISSING' });
  if (page.loading) errors.push({ code: 'PAGE_LOADING_INCOMPLETE' });
  return { jobs, errors, originals, links, next: page.next, native_total: nativeTotal, pending,
    employers, structured, page_title: page.title, scope_present: page.scope_present };
}

export async function collectGenericOfficial({ http, dom, company, cursor = null, maxPages = 3 }) {
  if (!Number.isSafeInteger(maxPages) || maxPages < 1) throw new Error('Positive bounded page budget required');
  const progress = structuredClone(cursor ?? initialGenericCursor(company));
  const jobs = [];
  const errors = [];
  const rawPages = [];
  let board;
  let pagesFetched = 0;
  let accessStop = null;
  const knownTasks = () => new Set([...progress.pending.map((item) => item.url), ...progress.visited.map((item) => item.url)]);
  const enqueue = (raw, from, kind) => {
    let url;
    try { url = canonical(raw, from); }
    catch { progress.manual.push({ code: 'INVALID_SOURCE_LINK', url_raw: raw, from_url: from }); return; }
    if (!company.fixed_urls.includes(url) || url === company.ownership_url && url !== company.board_url) {
      if (!progress.pending_admission.some((item) => item.url === url)) progress.pending_admission.push({ url, from_url: from, kind });
      return;
    }
    if (!knownTasks().has(url)) progress.pending.push({ url, kind });
    else if (kind === 'list' && progress.visited.some((item) => item.url === url)) {
      progress.manual.push({ code: 'PAGINATION_CYCLE', url, from_url: from });
    }
  };
  while (progress.pending.length && pagesFetched < maxPages) {
    const task = progress.pending[0];
    try {
      const response = await http.get(task.url, task.kind === 'list' ? 'static_job_list' : 'static_job_detail');
      board ??= response;
      pagesFetched++;
      const parsed = await parseGenericPage({ dom, response, company, kind: task.kind });
      rawPages.push({ url: response.url, metadata_path: response.metadata_path, records: parsed.originals });
      for (const item of parsed.jobs) {
        const id = item.raw.source_job_id;
        const digest = hash(item.raw.source_record);
        if (Object.hasOwn(progress.seen, id) && progress.seen[id] !== digest) {
          progress.manual.push({ code: 'NATIVE_ID_CONTENT_CONFLICT', source_job_id: id });
        } else if (!Object.hasOwn(progress.seen, id)) {
          Object.defineProperty(progress.seen, id, { value: digest, enumerable: true, configurable: true, writable: true });
          jobs.push(item);
        }
      }
      if (parsed.native_total !== null && task.kind === 'list') {
        if (progress.native_total !== null && progress.native_total !== parsed.native_total) progress.manual.push({ code: 'NATIVE_TOTAL_CHANGED' });
        progress.native_total = parsed.native_total;
      }
      progress.manual.push(...parsed.pending, ...parsed.errors);
      progress.discovered_companies.push(...parsed.employers);
      progress.pending.shift();
      // Mark the task before inspecting links so a self-next link cannot create an infinite crawl.
      progress.visited.push({ url: task.url, kind: task.kind, metadata_path: response.metadata_path, fetched_at: response.finished_at });
      for (const url of parsed.next) enqueue(url, response.url, 'list');
      for (const url of parsed.links) enqueue(url, response.url, 'detail');
    } catch (error) {
      errors.push({ code: error.code ?? 'STATIC_COLLECTION_FAILED', message: error.message, evidence: error.evidence ?? null });
      accessStop = error.code === 'DISCOVERY_BUDGET_CHECKPOINT' ? null : error.code ?? null;
      break;
    }
  }
  const count = Object.keys(progress.seen).length;
  const accounted = !progress.pending.length && !progress.pending_admission.length && !progress.manual.length
    && progress.native_total !== null && progress.native_total === count;
  if (!progress.pending.length && progress.native_total !== count) errors.push({ code: 'NATIVE_COUNT_UNRECONCILED', total: progress.native_total, returned: count });
  errors.push(...progress.manual.map((item) => ({ code: item.code ?? 'DETAIL_PARSE_PENDING', ...item })));
  if (progress.pending_admission.length) errors.push({ code: 'FIXED_URL_APPROVAL_PENDING', urls: progress.pending_admission });
  if (progress.pending.length && !errors.length) errors.push({ code: 'DISCOVERY_BUDGET_CHECKPOINT' });
  progress.done = !progress.pending.length;
  const unsupported = !count && progress.manual.some((item) => item.code === 'PARSER_REQUIRED');
  return { jobs, board, errors, complete: accounted && !cursor && !errors.length,
    source_status: accessStop ? 'blocked' : accounted ? (count ? 'success' : 'verified_empty')
      : unsupported ? 'unsupported' : 'partial',
    source_complete: accounted, access_stop: accessStop, cursor: progress,
    parser: { id: 'generic-official-static-v1', scripts_executed: false },
    pagination: { total: progress.native_total, returned_records: count, pages_fetched: pagesFetched,
      complete: accounted && !cursor, has_more: progress.pending.length > 0, pending_urls: progress.pending,
      pending_admission: progress.pending_admission, observation_windows_combined: Boolean(cursor) },
    source_metadata: { raw_structured_pages: rawPages, pending_parse: progress.manual,
      discovered_companies: progress.discovered_companies, source_scope_accounted: accounted,
      coverage_semantics: 'Only frozen static URLs and explicitly admitted linked details; no company-wide or same-time snapshot claim' },
    source_health: unsupported ? 'pending_parser_or_manual_tool' : accounted ? 'reachable_and_parsed' : 'checkpoint_or_incomplete' };
}
