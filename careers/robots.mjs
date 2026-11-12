import { createHash } from 'node:crypto';

export const USER_AGENT = 'OfficialCareersEvidence/0.1';
const PRODUCT = 'officialcareersevidence';

export function absentRobotsDecision(response, policy, { companyId, ownershipVerified = false, requestUrl = null } = {}) {
  const deny = { allowed: false, state: 'unknown', reason: 'No exact approved absent-robots policy' };
  if (!companyId || response?.status !== 404 || typeof response.text !== 'string' || response.complete === false) return deny;
  let url;
  try { url = new URL(response.url); } catch { return deny; }
  if (url.pathname !== '/robots.txt' || url.search || url.protocol !== 'https:') return deny;
  const type = String(response.headers?.['content-type'] ?? '').split(';', 1)[0].trim().toLowerCase();
  const rule = policy?.absent_robots_public_read_allowlist?.find((entry) => entry.origin === url.origin && entry.company_id === companyId);
  if (!rule || rule.required_status !== 404 || type !== rule.required_content_type) return deny;
  const seed = rule.trusted_seed_homepage === true && requestUrl === `${url.origin}/` &&
    rule.allowed_paths?.length === 1 && rule.allowed_paths[0] === '/';
  if (!ownershipVerified && !seed) return deny;
  const hash = createHash('sha256').update(response.text).digest('hex');
  const exactBody = rule.required_body === 'Not Found' && type === 'text/plain' && response.text.trim() === 'Not Found';
  const exactHash = /^[a-f0-9]{64}$/.test(rule.required_body_sha256 ?? '') && hash === rule.required_body_sha256 &&
    (!response.sha256 || response.sha256 === hash);
  if (!exactBody && !exactHash) return deny;
  return { allowed: true, state: 'approved_absence', crawl_delay_ms: 0, policy_version: policy.version,
    origin: url.origin, required_body_sha256: rule.required_body_sha256 ?? null,
    allowed_paths: rule.allowed_paths ?? null, allowed_path_prefixes: rule.allowed_path_prefixes ?? null,
    require_page_reference: rule.require_page_reference === true, trusted_seed_homepage: seed,
    standard: rule.standard, policy_evidence: rule.absence_evidence, ownership_policy_evidence: rule.official_ownership_evidence };
}

export function absentRobotsPathAllowed(policy, value, { publicPostUrls = [], pageReferenced = false } = {}) {
  const url = new URL(value);
  if (url.origin !== policy.origin || url.search || url.hash) return false;
  if (policy.require_page_reference && !pageReferenced) return false;
  if (policy.allowed_paths || policy.allowed_path_prefixes) {
    return (policy.allowed_paths ?? []).includes(url.pathname) ||
      ((policy.allowed_path_prefixes ?? []).some((prefix) => url.pathname.startsWith(prefix)) &&
        url.pathname.endsWith('.js') && !url.pathname.includes('%'));
  }
  return url.pathname === '/index/' || url.pathname === '/index' ||
    /^\/index\/position\/[a-zA-Z0-9_-]+\/detail\/?$/.test(url.pathname) || publicPostUrls.includes(url.href);
}

export function parseRobots(text, contentType = 'text/plain') {
  if (!/^text\/plain(?:;|$)/i.test(contentType) || /<\s*(?:!doctype|html|head|body)\b/i.test(text)) {
    return { state: 'unknown', reason: 'Robots is not a plain-text policy', groups: [] };
  }
  const groups = [];
  let group = null;
  let hasRules = false;
  for (const original of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = original.split('#', 1)[0].trim();
    if (!line) continue;
    const colon = line.indexOf(':');
    if (colon < 1) return { state: 'unknown', reason: 'Malformed robots line', groups: [] };
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (key === 'user-agent') {
      if (!value) return { state: 'unknown', reason: 'Empty user agent', groups: [] };
      if (!group || hasRules) {
        group = { agents: [], rules: [], crawl_delay_ms: 0 };
        groups.push(group);
        hasRules = false;
      }
      group.agents.push(value.toLowerCase());
    } else if (key === 'allow' || key === 'disallow') {
      if (!group || (value && !value.startsWith('/'))) {
        return { state: 'unknown', reason: 'Malformed robots rule', groups: [] };
      }
      hasRules = true;
      if (value) group.rules.push({ allow: key === 'allow', path: value });
    } else if (key === 'crawl-delay') {
      if (!group || !/^\d+(?:\.\d+)?$/.test(value)) {
        return { state: 'unknown', reason: 'Malformed crawl delay', groups: [] };
      }
      hasRules = true;
      group.crawl_delay_ms = Number(value) * 1000;
    }
  }
  if (!groups.length) return { state: 'unknown', reason: 'No interpretable agent groups', groups: [] };
  return { state: 'parsed', groups };
}

function canonicalPath(value) {
  return value.replace(/%[0-9a-f]{2}/gi, (escaped) => {
    const char = String.fromCharCode(parseInt(escaped.slice(1), 16));
    return /[A-Za-z0-9_.~-]/.test(char) ? char : escaped.toUpperCase();
  }).replace(/[^\x00-\x7F]/gu, (char) => encodeURIComponent(char));
}

function matchRule(rule, path) {
  const canonical = canonicalPath(rule.path);
  const anchored = canonical.endsWith('$');
  const body = anchored ? canonical.slice(0, -1) : canonical;
  const pattern = body.split('*').map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*');
  return new RegExp(`^${pattern}${anchored ? '$' : ''}`).test(canonicalPath(path));
}

export function robotsDecision(policy, url) {
  if (policy.state !== 'parsed') return { allowed: false, state: 'unknown', reason: policy.reason };
  const ranked = policy.groups.map((group) => ({ group, specificity: Math.max(0,
    ...group.agents.filter((agent) => agent !== '*' && PRODUCT.includes(agent)).map((agent) => agent.length)) }));
  const longest = Math.max(0, ...ranked.map((entry) => entry.specificity));
  const selected = longest ? ranked.filter((entry) => entry.specificity === longest).map((entry) => entry.group)
    : policy.groups.filter((group) => group.agents.includes('*'));
  const parsed = new URL(url);
  const rules = selected.flatMap((group) => group.rules)
    .filter((rule) => matchRule(rule, parsed.pathname + parsed.search))
    .sort((a, b) => canonicalPath(b.path).replace(/\*/g, '').length - canonicalPath(a.path).replace(/\*/g, '').length || Number(b.allow) - Number(a.allow));
  return {
    allowed: rules[0]?.allow ?? true,
    state: rules[0]?.allow === false ? 'disallowed' : 'allowed',
    matched_rule: rules[0] ?? null,
    crawl_delay_ms: Math.max(0, ...selected.map((group) => group.crawl_delay_ms)),
  };
}
