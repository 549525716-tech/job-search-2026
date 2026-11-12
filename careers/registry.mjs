import { readFileSync, existsSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { join, sep } from 'node:path';
import { DATA_DIR, DB_PATH, evidenceAbsolute, assertId } from './paths.mjs';
import { validatePublicUrl } from './http.mjs';

// Collection approval and current ownership verification are separate states.
const BAILIAN = Object.freeze({
  company_id: 'bailian-ai', company_name: '百炼智能', legal_name: '北京百炼智能科技有限公司',
  source_id: 'bailian-official-joinus', tenant: 'www.bailian-ai.com', provider: 'bailian-static-v1',
  ownership_url: 'https://www.bailian-ai.com/about', board_url: 'https://www.bailian-ai.com/joinus',
  allowed_hosts: Object.freeze(['www.bailian-ai.com', 'bailian-ai.com']),
  collection_approval: 'explicit_user_stage1_target', verification_state: 'unverified_until_live_capture',
});

const MINIMAX_HTTP = Object.freeze({
  company_id: 'minimax', company_name: 'MiniMax', legal_name: null,
  identity_tokens: ['MiniMax'], source_id: 'minimax-feishu', tenant: 'vrfi1sk8a0', provider: 'feishu-public-v1',
  ownership_url: 'https://www.minimax.cn/careers', board_url: 'https://vrfi1sk8a0.jobs.feishu.cn/index/',
  allowed_hosts: Object.freeze(['www.minimax.cn', 'minimax.cn', 'www.minimaxi.com', 'minimaxi.com', 'vrfi1sk8a0.jobs.feishu.cn', 'lf-package-cn.feishucdn.com']),
  script_hosts: Object.freeze(['lf-package-cn.feishucdn.com']),
  public_post_urls: Object.freeze(['https://vrfi1sk8a0.jobs.feishu.cn/api/v1/search/job/posts']),
  access_block: Object.freeze({ code: 'PUBLIC_API_REQUIRES_BROWSER_STATE',
    message: 'Observed HTTP 405. Current public client signs list URLs, reads a CSRF cookie, and refreshes tokens after 405; unsupported by this cookie-free collector. Do not retry.',
    evidence: '01_行情收集/official-careers/raw/preflight-minimax-service-script-10d37f7d-4b4b-40e9-a3dc-c3fb7df3896f/003.response.json',
    denial_evidence: '01_行情收集/official-careers/raw/minimax-a6e11fe1-8cdc-4303-9561-3e970859fc22/005.response.json' }),
  collection_approval: 'explicit_user_stage2_target', verification_state: 'unverified_until_live_capture',
});

const MINIMAX = Object.freeze({
  company_id: 'minimax', company_name: 'MiniMax', legal_name: null,
  identity_tokens: Object.freeze(['MiniMax']), source_id: 'minimax-public-browser', tenant: 'vrfi1sk8a0', provider: 'public-browser-v1',
  ownership_url: 'https://www.minimax.cn/careers', board_url: 'https://vrfi1sk8a0.jobs.feishu.cn/index/',
  allowed_hosts: Object.freeze(['www.minimax.cn', 'minimax.cn', 'vrfi1sk8a0.jobs.feishu.cn']),
  related_source_ids: Object.freeze(['minimax-feishu']),
  browser_queries: Object.freeze(['Business', '\u9500\u552e']),
  access_block: Object.freeze({ code: 'BROWSER_ADAPTER_QUARANTINED',
    message: 'Public-browser redirect-hop boundary pending independent verification; existing evidence remains available; no navigation or automatic retry.' }),
  collection_approval: 'explicit_user_public_browser_fallback', verification_state: 'unverified_until_live_capture',
});

const DEEPSEEK = Object.freeze({
  company_id: 'deepseek', company_name: 'DeepSeek', legal_name: null, identity_tokens: ['DeepSeek', '深度求索'],
  source_id: 'deepseek-official', tenant: 'talent.deepseek.com', provider: 'official-embedded-json-v1',
  ownership_url: 'https://www.deepseek.com/', board_url: 'https://talent.deepseek.com/',
  allowed_hosts: Object.freeze(['www.deepseek.com', 'deepseek.com', 'talent.deepseek.com']),
  collection_approval: 'explicit_user_stage2_target', verification_state: 'unverified_until_live_capture',
});

const discovery = JSON.parse(readFileSync(new URL('./config/company-discovery.json', import.meta.url), 'utf8'));
const implemented = new Map([BAILIAN, MINIMAX, DEEPSEEK].map((company) => [company.company_id, company]));
export const discoveryCompanies = Object.freeze(discovery.map((entry) => implemented.get(entry.id) ?? Object.freeze({
  company_id: entry.id, company_name: entry.name, source_id: `${entry.id}-pending`, tenant: null,
  provider: 'not_implemented', ownership_url: entry.homepage, board_url: entry.careers_url,
  collection_approval: 'discovery_only_requires_implementation_and_live_chain', verification_state: 'unverified_until_live_capture',
})));
export const companies = Object.freeze([...implemented.values()]);
// The failed cookie-free API remains independently identifiable and is never selected for automatic retry.
export const sourceVariants = Object.freeze([BAILIAN, MINIMAX_HTTP, MINIMAX, DEEPSEEK]);

export function getCompany(id = 'bailian-ai') {
  const company = implemented.get(id);
  if (!company) throw new Error(`No approved implemented collector for ${id}; discovery does not grant current verification`);
  return company;
}

export const GENERIC_OFFICIAL_PROVIDER = 'generic-official-static-v1';
export const discoverySeeds = Object.freeze(discovery);

const fingerprint = (value) => createHash('sha256').update(value).digest('hex');
const token = (value) => String(value ?? '').normalize('NFKC').trim().toLowerCase();
const strings = (values) => [...new Set(values.filter((value) => typeof value === 'string' && value.trim()).map(token))];
const hostOf = (url) => { try { return new URL(url).hostname; } catch { return null; } };
const sameDomain = (a, b) => a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);

export function discoveryIdentity(record) {
  const nested = record.company && typeof record.company === 'object' ? record.company
    : record.hiringOrganization && typeof record.hiringOrganization === 'object' ? record.hiringOrganization : {};
  const name = nested.company_name ?? nested.name ?? record.company_name ?? record.employer_name
    ?? (typeof record.company === 'string' ? record.company : null) ?? record.name;
  const homepage = nested.homepage ?? nested.url ?? record.homepage ?? record.company_url ?? null;
  const entity = nested.employer_entity_id ?? record.employer_entity_id ?? null;
  const legal = nested.legal_name ?? record.legal_name ?? null;
  // A title, recruiter contact, or bare display name is never an employer identity key.
  const identity = entity ? ['entity', token(entity)] : hostOf(homepage)
    ? ['official_host_and_name', hostOf(homepage), token(legal ?? name)] : ['unverified_record', fingerprint(JSON.stringify(record))];
  return { queue_id: `company-${fingerprint(JSON.stringify(identity)).slice(0, 24)}`, identity_key: identity,
    employer_entity_id: entity, company_name: name ?? null, legal_name: legal, homepage,
    company_id_hint: record.company_id ?? (!record.title ? record.id : null),
    careers_url: record.careers_url ?? record.board_url ?? null,
    aliases: strings([...(record.aliases ?? []), ...(nested.aliases ?? [])]), group_ids: strings(record.group_ids ?? []) };
}

export function sourceIdentity(source) {
  const urlOf = (value) => { try { return new URL(value); } catch { return null; } };
  const tenantUrl = urlOf(source.tenant_scope_url ?? source.tenant);
  const board = urlOf(source.board_url ?? source.careers_url);
  return {
    schema_version: 2,
    ids: strings([source.company_id, source.company_id_hint, source.source_id, source.employer_entity_id,
      ...(source.related_source_ids ?? []), ...(source.group_ids ?? [])]),
    names: strings([source.company_name, source.name, source.legal_name, ...(source.aliases ?? []), ...(source.identity_tokens ?? [])]),
    employer_entities: strings([source.employer_entity_id]),
    hosts: strings([hostOf(source.homepage), hostOf(source.ownership_url),
      hostOf(source.board_url), hostOf(source.careers_url)]),
    official_hosts: strings([hostOf(source.homepage), hostOf(source.ownership_url)]),
    broad_domains: strings(source.halted_domains ?? []),
    board_scope: board ? { origin: board.origin, path: tenantUrl?.origin === board.origin ? tenantUrl.pathname : null } : null,
    network_scope: source.halt_scope ?? null,
    tenants: strings([source.tenant, source.tenant_scope_url]),
  };
}

export function discoveryHaltApplicability(a, b) {
  const overlaps = (key) => (a[key] ?? []).some((value) => (b[key] ?? []).includes(value));
  const entityConflict = a.employer_entities?.length && b.employer_entities?.length && !overlaps('employer_entities');
  let uncertain = false;
  if (overlaps('ids')) return 'confirmed';
  if (overlaps('names')) { if (!entityConflict) return 'confirmed'; uncertain = true; }
  if ((a.hosts ?? []).some((host) => (b.broad_domains ?? []).some((domain) => sameDomain(host, domain)))) return 'confirmed';
  if (b.network_scope?.kind === 'origin' && a.hosts.some((host) => `https://${host}` === b.network_scope.origin)) return 'confirmed';
  if (overlaps('official_hosts')) { if (!entityConflict) return 'confirmed'; uncertain = true; }
  const target = b.network_scope?.kind === 'tenant' ? b.network_scope : b.board_scope;
  if (a.board_scope && target && a.board_scope.origin === target.origin) {
    if (!a.board_scope.path || !target.path) return 'needs_verification';
    const path = (value) => value.endsWith('/') ? value : `${value}/`;
    const left = path(a.board_scope.path), right = path(target.path);
    return left.startsWith(right) || right.startsWith(left) ? 'confirmed' : uncertain ? 'needs_verification' : null;
  }
  // Legacy domain-only evidence cannot prove another hosted tenant was denied.
  if (b.schema_version !== 2 && (a.hosts ?? []).some((host) => (b.hosts ?? []).some((other) => sameDomain(host, other)))) return 'needs_verification';
  return uncertain ? 'needs_verification' : null;
}

export function identitiesOverlap(a, b) {
  return discoveryHaltApplicability(a, b) === 'confirmed';
}

function readOptionalJson(path, fallback) {
  try { return JSON.parse(readFileSync(path, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
}

export function readDiscoveryHalts({ databasePath = DB_PATH } = {}) {
  const halts = [];
  const add = (source, reason) => halts.push({ identity: sourceIdentity(source), reason });
  for (const source of sourceVariants) if (source.access_block) {
    const seed = discovery.find((item) => item.id === source.company_id) ?? {};
    add({ ...seed, ...source, homepage: seed.homepage }, source.access_block);
  }
  for (const seed of discovery) if (seed.preflight_check?.status === 'stopped') {
    add({ ...seed, company_id: seed.id }, { code: 'EXISTING_PREFLIGHT_STOP', ...seed.preflight_check });
  }
  // Read legacy state without opening CareersStore, whose constructor performs migrations.
  if (existsSync(databasePath)) {
    const db = new DatabaseSync(databasePath, { readOnly: true });
    try {
      for (const source of db.prepare('SELECT * FROM sources WHERE halted_reason IS NOT NULL').all()) {
        const seed = discovery.find((item) => item.id === source.company_id) ?? {};
        add({ ...seed, ...source }, { code: 'EXISTING_SOURCE_HALT', message: source.halted_reason });
      }
    } finally { db.close(); }
  }
  const research = readOptionalJson(join(DATA_DIR, 'research/state.json'), {});
  for (const [origin, reason] of Object.entries(research.halted_origins ?? {})) add({ board_url: origin, halt_scope: { kind: 'origin', origin } }, reason);
  const leads = readOptionalJson(new URL('./config/market-leads.json', import.meta.url), {});
  for (const halt of leads.halted_sources ?? []) add({ halted_domains: [halt.domain] }, halt);
  // These quarantined platform families cannot be reintroduced under an official-source ID.
  add({ halted_domains: ['zhipin.com', 'liepin.com'], company_name: 'BOSS直聘', aliases: ['猎聘'] }, { code: 'PLATFORM_PAUSED' });
  return halts;
}

export function findDiscoveryHalt(source, halts) {
  const identity = sourceIdentity(source);
  const matched = halts.map((halt) => ({ ...halt, applicability: discoveryHaltApplicability(identity, halt.identity) }));
  return matched.find((halt) => halt.applicability === 'confirmed') ?? matched.find((halt) => halt.applicability === 'needs_verification') ?? null;
}

export function validateGenericSource(source, company) {
  if (!source || source.provider !== GENERIC_OFFICIAL_PROVIDER) throw new Error('UNSUPPORTED_PROVIDER');
  for (const id of ['company_id', 'source_id']) assertId(source[id]);
  const approval = source.approval;
  if (approval?.status !== 'approved' || !approval.reviewed_by?.trim() || !Number.isFinite(Date.parse(approval.reviewed_at))
    || Date.parse(approval.reviewed_at) > Date.now() || approval.group_relationships_checked !== true
    || !Array.isArray(source.group_ids) || !source.employer_entity_id?.trim()
    || source.employer_entity_id !== company.employer_entity_id || source.company_name !== company.company_name) {
    throw new Error('EXPLICIT_EMPLOYER_AND_GROUP_APPROVAL_REQUIRED');
  }
  if (!Array.isArray(source.identity_tokens) || !source.identity_tokens.length
    || !source.identity_tokens.every((value) => typeof value === 'string' && value.trim())) throw new Error('IDENTITY_TOKENS_REQUIRED');
  if (!Array.isArray(source.allowed_hosts) || !source.allowed_hosts.length
    || source.allowed_hosts.some((host) => !/^[a-z0-9.-]+$/.test(host) || !host.includes('.')
      || /(?:^|\.)(?:localhost|local|internal|lan|home|test|invalid)$/.test(host))) throw new Error('EXPLICIT_PUBLIC_HOSTS_REQUIRED');
  const fixed = source.fixed_urls;
  if (!Array.isArray(fixed) || !fixed.length || fixed.length > 500 || new Set(fixed).size !== fixed.length) throw new Error('FIXED_URL_ADMISSION_REQUIRED');
  for (const value of [...fixed, source.ownership_url, source.board_url, source.tenant_scope_url]) {
    if (validatePublicUrl(value, source.allowed_hosts).href !== value) throw new Error('CANONICAL_FIXED_URL_REQUIRED');
  }
  if (!fixed.includes(source.ownership_url) || !fixed.includes(source.board_url)) throw new Error('OWNERSHIP_AND_BOARD_NOT_ADMITTED');
  const tenant = new URL(source.tenant_scope_url);
  if (tenant.search || !tenant.pathname.endsWith('/') || source.tenant !== tenant.href) throw new Error('EXACT_TENANT_SCOPE_REQUIRED');
  const inTenant = (value) => {
    const url = new URL(value);
    return url.origin === tenant.origin && (url.pathname.startsWith(tenant.pathname)
      || url.pathname === tenant.pathname.slice(0, -1));
  };
  if (!inTenant(source.board_url) || fixed.some((value) => value !== source.ownership_url && !inTenant(value))) throw new Error('CROSS_TENANT_URL');
  if (hostOf(source.ownership_url) !== hostOf(company.homepage)) throw new Error('OFFICIAL_HOST_IDENTITY_MISMATCH');
  const spec = source.static;
  if (!spec || !['jsonld', 'html-list'].includes(spec.mode) || !Array.isArray(spec.page_urls)
    || spec.page_urls[0] !== source.board_url || new Set(spec.page_urls).size !== spec.page_urls.length
    || spec.page_urls.some((url) => !fixed.includes(url)) || !spec.scope_selector) throw new Error('STATIC_SCOPE_REQUIRED');
  if (spec.mode === 'html-list' && (!spec.item_selector || !spec.title_selector || !spec.description_selector || !spec.id_attribute)) {
    throw new Error('STATIC_LIST_SELECTORS_REQUIRED');
  }
  const proof = source.ownership_evidence;
  if (!proof?.metadata_path || !proof.body_path || !/^[a-f0-9]{64}$/.test(proof.sha256 ?? '') || !proof.quote?.trim()) throw new Error('OWNERSHIP_RAW_PROOF_REQUIRED');
  const readEvidence = (path) => {
    const absolute = realpathSync(evidenceAbsolute(path));
    if (!absolute.startsWith(realpathSync(DATA_DIR) + sep)) throw new Error('OWNERSHIP_PROOF_PATH_ESCAPE');
    return readFileSync(absolute);
  };
  const metadata = JSON.parse(readEvidence(proof.metadata_path).toString('utf8'));
  const body = readEvidence(proof.body_path);
  if (metadata.url !== source.ownership_url || metadata.body_path !== proof.body_path || metadata.metadata_path !== proof.metadata_path
    || metadata.status !== 200 || !metadata.complete || metadata.error || metadata.method !== 'GET'
    || fingerprint(body) !== proof.sha256 || metadata.sha256 !== proof.sha256 || metadata.bytes !== body.length
    || !Number.isFinite(Date.parse(metadata.finished_at)) || Date.parse(metadata.finished_at) > Date.now()
    || !body.toString('utf8').includes(proof.quote)) throw new Error('OWNERSHIP_PROOF_INTEGRITY_FAILED');
  return { ...structuredClone(source), collection_approval: `reviewed_static_source:${approval.reviewed_by}`,
    verification_state: 'approved_raw_chain_requires_current_capture', approval_sha256: fingerprint(JSON.stringify(source)) };
}
