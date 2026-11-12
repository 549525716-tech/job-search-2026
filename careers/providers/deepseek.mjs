import { parsePublicScript, walkScript } from '../structured-script.mjs';
import { htmlText } from './common.mjs';

const member = (node, property) => node?.type === 'MemberExpression' && !node.computed && node.property?.name === property;

export function parseDeepSeekData(script) {
  const ast = parsePublicScript(script);
  const datasets = [];
  const sets = [];
  const filters = [];
  let fullHtmlRenderer = false;
  walkScript(ast, (node) => {
    if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier') {
      const call = node.init;
      if (call?.type === 'CallExpression' && member(call.callee, 'parse') && call.callee.object.name === 'JSON' &&
          call.arguments.length === 1 && call.arguments[0].type === 'StringLiteral') {
        const value = JSON.parse(call.arguments[0].value);
        if (value && Array.isArray(value.jobs) && Object.hasOwn(value, 'crawledAt')) {
          datasets.push({ value, binding: node.id.name, ast_start: call.start, ast_end: call.end });
        }
      }
      if (call?.type === 'NewExpression' && call.callee.name === 'Set' && call.arguments.length === 1 &&
          call.arguments[0].type === 'ArrayExpression' && call.arguments[0].elements.every((item) => item?.type === 'StringLiteral')) {
        sets.push({ binding: node.id.name, values: call.arguments[0].elements.map((item) => item.value), ast_start: call.start });
      }
    }
    if (node.type === 'CallExpression' && member(node.callee, 'filter') && member(node.callee.object, 'jobs')) filters.push(node);
    if (node.type === 'ObjectProperty' && (node.key.name ?? node.key.value) === '__html' && member(node.value, 'descriptionHtml')) fullHtmlRenderer = true;
  });
  if (datasets.length !== 1 || !fullHtmlRenderer) throw new Error('DEEPSEEK_DATA_OR_FULL_RENDERER_CHANGED');
  const dataset = datasets[0];
  const filter = filters.filter((node) => node.callee.object.object.name === dataset.binding);
  if (filter.length !== 1 || filter[0].arguments.length !== 1) throw new Error('DEEPSEEK_VISIBILITY_FILTER_CHANGED');
  const arrow = filter[0].arguments[0];
  const call = arrow.body?.argument;
  if (arrow.type !== 'ArrowFunctionExpression' || arrow.params.length !== 1 || arrow.body?.operator !== '!' ||
      call?.type !== 'CallExpression' || !member(call.callee, 'has') || call.arguments.length !== 1 ||
      !member(call.arguments[0], 'functionName') || call.arguments[0].object.name !== arrow.params[0].name) {
    throw new Error('DEEPSEEK_UNSUPPORTED_VISIBILITY_FILTER');
  }
  const excluded = sets.filter((set) => set.binding === call.callee.object.name);
  if (excluded.length !== 1) throw new Error('DEEPSEEK_VISIBILITY_SET_AMBIGUOUS');
  const data = dataset.value;
  if (!Number.isSafeInteger(data.total) || data.total < 0 || data.total !== data.jobs.length ||
      new Set(data.jobs.map((job) => job.id)).size !== data.total) throw new Error('DEEPSEEK_DATASET_COUNT_MISMATCH');
  return { data, dataset_locator: { ast_start: dataset.ast_start, ast_end: dataset.ast_end },
    visibility: { excluded_categories: excluded[0].values, filter_ast_start: filter[0].start,
      set_ast_start: excluded[0].ast_start, meaning: 'Exact public UI category exclusion; not a collector keyword filter' } };
}

export async function collectDeepSeek({ http, dom, company, board }) {
  const title = await dom.evaluate((html) => new DOMParser().parseFromString(html, 'text/html').title, board.text);
  if (!title.includes('DeepSeek')) throw new Error('DEEPSEEK_BOARD_IDENTITY_MISMATCH');
  const references = await http.registerPageScripts(dom, board);
  const scripts = references.filter((reference) => new URL(reference.to_url).origin === new URL(board.url).origin &&
    /^\/static\/main\.[a-zA-Z0-9]+\.js$/.test(new URL(reference.to_url).pathname));
  if (scripts.length !== 1) throw new Error('DEEPSEEK_DATA_SCRIPT_MISSING');
  const response = await http.getScript(scripts[0].to_url);
  const { data, dataset_locator: locator, visibility } = parseDeepSeekData(response.text);
  const visible = data.jobs.filter((job) => !visibility.excluded_categories.includes(job.functionName));
  const jobs = [];
  const errors = [];
  const listedWithoutFullJd = [];
  for (const record of visible) {
    try {
      if (typeof record.id !== 'string' || !record.id || typeof record.title !== 'string' ||
          !record.title.trim() || typeof record.descriptionHtml !== 'string' || !Array.isArray(record.locations)) {
        throw new Error('DEEPSEEK_INVALID_JOB_RECORD');
      }
      const description = await htmlText(dom, record.descriptionHtml);
      if (!description) throw new Error('DEEPSEEK_EMPTY_DESCRIPTION');
      if (description === '（新部门，虚位以待）') {
        listedWithoutFullJd.push({ source_job_id: record.id, title: record.title, description_text: description });
        throw new Error('SOURCE_PLACEHOLDER_NOT_FULL_JD');
      }
      const application = new URL(record.submitUrl);
      const detail = new URL(record.detailUrl);
      if ([application, detail].some((url) => url.protocol !== 'https:' || url.username || url.password)) throw new Error('DEEPSEEK_INVALID_JOB_LINK');
      jobs.push({ raw: {
        source_job_id: record.id, title: record.title, location_raw: record.locations.join(' / '), department: record.functionName,
        description_html: record.descriptionHtml, description_text: description, description_complete: true,
        detail_completeness: 'full_source_description', responsibilities: null, requirements: null,
        salary_raw: null, hiring_active: 'unknown', published_raw: null,
        published_at_semantics: 'No per-job publication timestamp in this official public dataset',
        source_timestamp_semantics: 'Publisher crawledAt is a board build snapshot, not per-job publication, update or observation time',
        job_url: detail.href, board_url: board.url, link_verification: 'source_embedded_not_navigated',
        application_url: application.href,
        source_locator: { kind: 'official_public_script_json_literal', native_id: record.id,
          upstream_detail_url: detail.href, dataset_locator: locator, publisher_snapshot_at: data.crawledAt },
        source_record: record,
      }, response });
    } catch (error) { errors.push({ code: 'JOB_PARSE_FAILED', source_job_id: record.id, message: error.message, evidence: response.metadata_path }); }
  }
  return { jobs, errors, complete: errors.length === 0 && jobs.length === visible.length, page_title: title,
    parser: 'Babel AST literal JSON + exact public UI visibility filter + offline DOM full HTML text',
    pagination: { pages: 1, current: 1, pages_fetched: 1, total: visible.length, size: visible.length, returned_records: visible.length },
    source_metadata: { publisher_snapshot_at: data.crawledAt, publisher_upstream_url: data.sourceUrl,
      embedded_total: data.total, public_visible_total: visible.length, excluded_record_count: data.total - visible.length,
      listed_without_full_jd: listedWithoutFullJd,
      visibility, script_reference: scripts[0], script_receipt: response.metadata_path,
      timestamp_semantics: 'Publisher snapshot is not a job publication time; first_seen is this collection time' },
    scope: { coverage: 'All jobs actually displayed by this official board; embedded UI-hidden categories excluded; no upstream ATS request' } };
}
