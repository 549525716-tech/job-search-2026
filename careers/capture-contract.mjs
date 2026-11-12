import { isDeepStrictEqual } from 'node:util';

export const CAPTURE_KINDS = Object.freeze(['web_tool_result_not_raw_http', 'browser_visible_page_capture']);

export function validateWebAdmission(command) {
  if ((command.kind ?? 'web_tool_result_not_raw_http') !== 'web_tool_result_not_raw_http') return;
  const key = command.operation === 'search' ? 'search_query' : ['open', 'click'].includes(command.operation) ? command.operation : null;
  const request = command.request ?? {};
  if (!key || !Array.isArray(request[key]) || request[key].length !== 1
    || Object.keys(request).some(name => ![key, 'response_length'].includes(name))) {
    throw new Error('ONE_WEB_ACTION_PER_ADMISSION_REQUIRED');
  }
}

export function captureMatchesAdmission(capture, admission) {
  const kind = admission.kind ?? 'web_tool_result_not_raw_http';
  return CAPTURE_KINDS.includes(kind) && capture.kind === kind
    && capture.operation === admission.operation
    && isDeepStrictEqual(capture.request, admission.request)
    && capture.result !== undefined;
}
