import { parseNuxtLiteral } from '../structured-script.mjs';

export async function inspectOwnership(dom, response, company) {
  const result = await dom.evaluate(({ html, baseUrl, expectedUrl, legalName, companyName }) => {
    const document = new DOMParser().parseFromString(html, 'text/html');
    document.querySelectorAll('script,style,noscript').forEach((node) => node.remove());
    const links = [...document.querySelectorAll('a[href]')].flatMap((anchor) => {
      try {
        const url = new URL(anchor.getAttribute('href'), baseUrl);
        if (url.href !== expectedUrl || !anchor.textContent.includes('加入我们')) return [];
        return [{ text: anchor.textContent.trim(), href_raw: anchor.getAttribute('href'), resolved_url: url.href }];
      } catch { return []; }
    });
    return { page_title: document.title, legal_name_present: document.body.textContent.includes(legalName),
      company_name_present: document.title.includes(companyName), links };
  }, { html: response.text, baseUrl: response.url, expectedUrl: company.board_url,
    legalName: company.legal_name, companyName: company.company_name });
  if (!result.links.length || !result.legal_name_present || !result.company_name_present) {
    throw new Error('OWNERSHIP_CHAIN_MISSING');
  }
  return { status: 'verified_official_link', verified_at: response.finished_at,
    company_id: company.company_id, legal_name: company.legal_name,
    from_url: response.url, to_url: company.board_url, body_path: response.body_path,
    metadata_path: response.metadata_path, sha256: response.sha256, ...result };
}

export async function parseBailianBoard(dom, response) {
  const extracted = await dom.evaluate(({ html }) => {
    const document = new DOMParser().parseFromString(html, 'text/html');
    const scripts = [...document.scripts].filter((script) => !script.src && script.textContent.includes('window.__NUXT__='))
      .map((script) => script.textContent);
    const text = (node) => {
      if (!node) return '';
      const copy = node.cloneNode(true);
      copy.querySelectorAll('script,style,noscript').forEach((child) => child.remove());
      copy.querySelectorAll('br').forEach((child) => child.replaceWith('\n'));
      return copy.textContent.replace(/\r\n?/g, '\n').trim();
    };
    const boards = [...document.querySelectorAll('[class^="jobs_"]')];
    const cards = boards.length === 1 ? [...boards[0].querySelectorAll(':scope > ul > li')] : [];
    return { title: document.title, scripts, board_count: boards.length,
      has_recruitment_heading: [...document.querySelectorAll('h2')].some((node) => text(node) === '招聘信息'),
      cards: cards.map((card, index) => {
        const header = card.querySelector('[class^="job-head_"]');
        const detail = card.querySelector('[class^="job-detal_"]');
        const sections = detail ? [...detail.children].filter((node) => node.matches('[class^="title_"]'))
          .map((node) => ({ label: text(node), text: text(node.nextElementSibling) })) : [];
        return { index, title: text(header?.querySelector('p')), location: text(header?.querySelector('[class^="location_"]')),
          published_raw: text(header?.querySelector('[class^="time_"]')), sections,
          html: card.outerHTML, application_contact: detail?.querySelector('a[href^="mailto:"]')?.getAttribute('href') ?? null };
      }) };
  }, { html: response.text });
  if (extracted.scripts.length !== 1 || extracted.board_count !== 1 || !extracted.has_recruitment_heading ||
      !extracted.title.includes('百炼智能') || !extracted.title.includes('加入我们')) throw new Error('BOARD_SCHEMA_CHANGED');
  const payload = parseNuxtLiteral(extracted.scripts[0]);
  const lists = Object.values(payload.data ?? {}).filter((value) => value?.msg === '查询招聘列表成功！');
  if (lists.length !== 1 || lists[0].code !== 200 || !Array.isArray(lists[0].data?.records)) {
    throw new Error('JOB_DATA_NOT_FOUND');
  }
  const data = lists[0].data;
  const errors = [];
  const jobs = [];
  const normalize = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
  const seen = new Set();
  for (const record of data.records) {
    const id = record?.id;
    try {
      if ((!Number.isSafeInteger(id) && typeof id !== 'string') || String(id).length === 0 || seen.has(String(id))) {
        throw new Error('Missing or duplicate native ID');
      }
      seen.add(String(id));
      if (!record.jobTitle || !record.jobResponsibility || !record.jobRequirements) throw new Error('Incomplete JD fields');
      const cards = extracted.cards.filter((card) => normalize(card.title) === normalize(record.jobTitle) &&
        normalize(card.location) === normalize(record.workPlace) && normalize(card.published_raw) === normalize(record.publishTime).slice(0, 10) &&
        card.sections.some((section) => section.label === '岗位职责' && normalize(section.text) === normalize(record.jobResponsibility)) &&
        card.sections.some((section) => section.label === '任职要求' && normalize(section.text) === normalize(record.jobRequirements)));
      if (cards.length !== 1) throw new Error('DOM/native data mismatch or ambiguous card');
      const card = cards[0];
      if (card.sections.some((section) => !section.label || !section.text)) throw new Error('Empty detail section');
      jobs.push({ source_job_id: String(id), title: record.jobTitle, location_raw: record.workPlace ?? null,
        published_raw: record.publishTime ?? null, published_date: card.published_raw,
        created_raw: record.createTime ?? null, updated_raw: record.updateTime ?? null,
        description_text: card.sections.map((section) => `${section.label}\n${section.text}`).join('\n\n'),
        description_html: card.html, responsibilities: record.jobResponsibility, requirements: record.jobRequirements,
        source_record: record, application_url: card.application_contact,
        source_locator: { kind: 'inline_job_card', native_id: String(id), card_index: card.index,
          selector: `[class^="jobs_"] > ul > li:nth-child(${card.index + 1})`, data_path: 'window.__NUXT__.data.*.data.records' },
      });
    } catch (error) { errors.push({ code: 'JOB_PARSE_FAILED', source_job_id: id ?? null, message: error.message }); }
  }
  const countsValid = Number.isSafeInteger(data.total) && data.total >= 0 && Number.isSafeInteger(data.current) &&
    Number.isSafeInteger(data.pages) && data.current === 1 && (data.total > 0 ? data.pages === 1 : [0, 1].includes(data.pages)) &&
    Number.isSafeInteger(data.size) && data.size > 0 && data.records.length <= data.size &&
    data.total === data.records.length && extracted.cards.length === data.records.length;
  if (!countsValid) errors.push({ code: 'INCOMPLETE_BOARD', message: 'Page/card/total counts do not prove a complete single-page board' });
  const complete = errors.length === 0 && countsValid && jobs.length === data.total;
  return { jobs, errors, complete,
    pagination: { current: data.current, pages: data.pages, total: data.total, size: data.size,
      returned_records: data.records.length, dom_cards: extracted.cards.length, pages_fetched: 1 },
    page_title: extracted.title, parser: 'Bailian DOM + literal Nuxt AST cross-check; no script execution' };
}
