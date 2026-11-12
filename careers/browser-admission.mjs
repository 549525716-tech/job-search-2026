const protectedHost = (hostname) => {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  return ['zhipin.com', 'liepin.com'].some(root => host === root || host.endsWith('.' + root));
};
const entries = new Set([
  'https://www.zhipin.com/', 'https://www.zhipin.com/web/geek/jobs',
  'https://www.zhipin.com/web/user/?ka=header-login',
  'https://c.liepin.com/', 'https://passport.liepin.com/login/',
]);
const requestTarget = request => request?.url ?? request?.expected_url;

// This gates project admissions, not the external Codex browser implementation.
export function validateBrowserAdmission(command, history = []) {
  if (command.kind !== 'browser_visible_page_capture') return;
  const request = command.request ?? {};
  if (request.browser !== 'iab') throw new Error('CODEX_IN_APP_BROWSER_REQUIRED');
  if (command.operation === 'inventory' && !request.url && !request.expected_url) return;
  const target = requestTarget(request);
  if (request.url && request.expected_url && request.url !== request.expected_url) throw new Error('BROWSER_TARGET_URL_CONFLICT');
  let url;
  try { url = new URL(target); } catch { throw new Error('BROWSER_TARGET_URL_REQUIRED'); }
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('BROWSER_TARGET_NOT_PUBLIC_HTTPS');
  if (protectedHost(url.hostname)) {
    if (command.operation !== 'ordinary-page-open' || request.executor !== 'codex_app.open_in_codex'
      || !entries.has(url.href)) throw new Error('BROWSER_CONTROL_QUARANTINED');
    const root = url.hostname.endsWith('liepin.com') ? 'liepin.com' : 'zhipin.com';
    if (history.some(event => {
      if (event.event !== 'begin' || event.operation !== 'ordinary-page-open') return false;
      try { const host = new URL(requestTarget(event.request)).hostname.toLowerCase().replace(/\.$/, ''); return host === root || host.endsWith('.' + root); }
      catch { return false; }
    })) throw new Error('ORDINARY_HANDOFF_ALREADY_ATTEMPTED');
  }
}

export function classifyBrowserCapture(capture) {
  const result = capture.result;
  if (!result || typeof result !== 'object' || Array.isArray(result)) return 'unverified_legacy_capture';
  const status = String(result.status ?? '').toLowerCase();
  if (/interrupt|abort|cancel/.test(status)) return 'interrupted';
  if (result.error || result.isError === true || result.ok === false || /error|fail/.test(status)) return 'technical_failure';
  if (result.actual_observation_source || result.evidence_source === 'app_lifecycle_log') return 'diagnostic_only';
  if (result.access_stop === true) return 'access_stopped';
  if (typeof result.url !== 'string') return 'unverified_capture';
  if (/^about:blank(?:[?#]|$)/i.test(result.url)) return 'blank_page';
  try {
    const url = new URL(result.url);
    if (url.protocol !== 'https:' || url.username || url.password) return 'unverified_capture';
  } catch { return 'unverified_capture'; }
  if (typeof result.text !== 'string' || !result.text.trim()) return 'no_visible_text';
  if (result.authenticated !== true || typeof result.account_evidence !== 'string'
    || !result.account_evidence.trim() || !result.text.includes(result.account_evidence)) return 'visible_page_auth_unverified';
  return 'authenticated_page_capture';
}
