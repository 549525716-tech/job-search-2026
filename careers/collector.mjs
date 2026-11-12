import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { getCompany, GENERIC_OFFICIAL_PROVIDER, validateGenericSource, readDiscoveryHalts, findDiscoveryHalt } from './registry.mjs';
import { acquireCollectionLock } from './lock.mjs';
import { EvidenceHTTP, SourceStop } from './http.mjs';
import { createOfflineDOM } from './dom.mjs';
import { inspectOwnership, parseBailianBoard } from './providers/bailian.mjs';
import { inspectLinkedBoard } from './providers/common.mjs';
import { collectFeishu } from './providers/feishu.mjs';
import { collectDeepSeek } from './providers/deepseek.mjs';
import { collectFeishuBrowser } from './providers/feishu-browser.mjs';
import { collectGenericOfficial } from './providers/generic-official.mjs';
import { normalizeJob } from './normalize.mjs';
import { CareersStore } from './store.mjs';
import { reportPaths, writeReport } from './report.mjs';
import { persist, persistSync } from './persistence.mjs';

export async function collect({ companyId = 'bailian-ai', queueWaitMs = 300_000, ownershipReceipt = null,
  source = null, dataDir = null, cursor = null, maxPages = 3, requestBudget = null,
  collectionLease = null, dependencies = {} } = {}) {
  const company = source ? validateGenericSource(source, source) : getCompany(companyId);
  if (source && !dataDir) throw new Error('Discovery source requires isolated dataDir');
  const initialBudgetUsed = requestBudget?.used ?? 0;
  const initialPages = cursor?.visited?.length ?? 0;
  const lease = collectionLease ?? await acquireCollectionLock({ waitMs: queueWaitMs });
  let store;
  let dom;
  try {
    store = persistSync('database_open', () => new CareersStore(dataDir ? join(dataDir, 'careers.sqlite') : undefined));
    const run = {
      schema_version: 1, run_id: `${company.company_id}-${randomUUID()}`, company_id: company.company_id, company_name: company.company_name,
      source_id: company.source_id, provider: company.provider, tenant: company.tenant,
      started_at: new Date().toISOString(), finished_at: null, status: 'running', complete: false,
      scope: { kind: company.provider === 'public-browser-v1' ? 'official_public_browser_query_sample' : 'official_board',
        board_url: company.board_url, query: null, keywords: company.browser_queries ?? [], filters: {},
        coverage: company.provider === 'public-browser-v1' ? 'Bounded browser query sample; default view retained raw; at most three views and 20 normalized jobs'
          : 'all jobs on this single official board only', company_wide: false, closure_eligible: false,
        pagination: null },
      ownership: { status: 'unverified', chain: [] }, jobs: [], evidence: [], errors: [],
      permission_basis: company.collection_approval, source_health: 'pending',
    };
    if (source) {
      run.scope.kind = 'discovery_static_checkpoint';
      run.scope.coverage = 'Frozen admitted static URLs only; never company-wide or lifecycle closure evidence';
    }
    run.artifacts = dataDir ? { data_namespace: dataDir } : reportPaths(run.run_id);
    persistSync('database_begin_run', () => store.beginRun(run, company));
    const budgetLease = requestBudget ? { ...lease, async beforeRequest() {
      if (requestBudget.used >= requestBudget.limit) throw Object.assign(new Error('Frozen request budget reached; resume at an explicit checkpoint'), { code: 'DISCOVERY_BUDGET_CHECKPOINT' });
      requestBudget.used++;
      return lease.beforeRequest();
    } } : lease;
    const httpOptions = { runId: run.run_id, sourceId: company.source_id, companyId: company.company_id,
      relatedSourceIds: company.related_source_ids ?? [],
      publicPostUrls: company.public_post_urls ?? [], scriptHosts: company.script_hosts ?? [], allowedHosts: company.allowed_hosts,
      lease: budgetLease, ...(dataDir ? { dataDir } : {}) };
    const http = dependencies.httpFactory ? dependencies.httpFactory(httpOptions) : new EvidenceHTTP(httpOptions);
    if (source && typeof http.request === 'function') {
      const request = http.request.bind(http);
      http.request = async (url, purpose, options) => {
        const target = new URL(url);
        if (!company.fixed_urls.includes(target.href) && !(purpose === 'robots' && target.pathname === '/robots.txt' && !target.search)) {
          throw new SourceStop('FIXED_URL_NOT_ADMITTED', 'Redirect or page URL was not explicitly admitted');
        }
        return request(url, purpose, options);
      };
    }
    try {
      const halted = store.haltedReason(company.source_id);
      if (halted) throw new SourceStop('SOURCE_HALTED', `Previous access stop requires review before another collection: ${halted}`);
      if (source) {
        const related = findDiscoveryHalt(company, [...readDiscoveryHalts(), ...readDiscoveryHalts({ databasePath: join(dataDir, 'careers.sqlite') })]);
        if (related) throw new SourceStop(related.applicability === 'confirmed' ? 'SOURCE_HALTED' : 'HALT_SCOPE_VERIFICATION_REQUIRED', JSON.stringify(related.reason));
      }
      if (company.access_block) throw new SourceStop(company.access_block.code, company.access_block.message, company.access_block.evidence);
      dom = await (dependencies.createDOM ?? createOfflineDOM)();
      if (source) {
        // Validate the already-approved original chain offline before making even the ownership request.
        const { readFile } = await import('node:fs/promises');
        const { evidenceAbsolute } = await import('./paths.mjs');
        const proof = company.ownership_evidence;
        await inspectLinkedBoard(dom, { url: company.ownership_url,
          text: await readFile(evidenceAbsolute(proof.body_path), 'utf8') }, company);
      }
      const official = ownershipReceipt ? await http.reuseReceipt(ownershipReceipt, company.ownership_url)
        : await http.get(company.ownership_url, 'ownership');
      const link = await (company.provider === 'bailian-static-v1' ? inspectOwnership : inspectLinkedBoard)(dom, official, company);
      run.ownership = { status: 'verified', chain: [link], verified_at: official.finished_at };
      http.approveOwnedOrigin(new URL(company.board_url).origin, official.metadata_path);
      let board;
      let parsed;
      if (company.provider === 'public-browser-v1') {
        await dom.close(); dom = null;
        parsed = await collectFeishuBrowser({ http, company });
        board = parsed.board;
        run.transport = 'browser_rendered';
      } else if (company.provider === GENERIC_OFFICIAL_PROVIDER) {
        parsed = await collectGenericOfficial({ http, dom, company, cursor, maxPages });
        board = parsed.board;
      } else board = await http.get(company.board_url, 'board_and_full_details');
      if (company.provider === 'bailian-static-v1') {
        parsed = await parseBailianBoard(dom, board);
        parsed.jobs = parsed.jobs.map((raw) => ({ raw, response: board }));
      } else if (company.provider === 'feishu-public-v1') parsed = await collectFeishu({ http, dom, company, board });
      else if (company.provider === 'official-embedded-json-v1') parsed = await collectDeepSeek({ http, dom, company, board });
      else if (!['public-browser-v1', GENERIC_OFFICIAL_PROVIDER].includes(company.provider)) throw new Error('PROVIDER_NOT_IMPLEMENTED');
      for (const job of parsed.jobs) {
        try { run.jobs.push(normalizeJob(job.raw, company, job.response)); }
        catch (error) {
          const failure = { code: 'JOB_NORMALIZE_FAILED', source_job_id: job.raw.source_job_id, message: error.message };
          parsed.errors.push(failure); parsed.complete = false;
          if (parsed.cursor) { parsed.cursor.manual.push(failure); parsed.source_status = 'partial'; parsed.source_complete = false; }
        }
      }
      run.source_metadata = parsed.scope ? { website_id: parsed.scope.website_id ?? null,
        website_path: parsed.scope.website_path ?? null, observed_coverage: parsed.scope.coverage } : {};
      Object.assign(run.source_metadata, parsed.source_metadata ?? {});
      if (parsed.scope?.coverage) run.scope.coverage = parsed.scope.coverage;
      run.scope.pagination = parsed.pagination;
      run.parser = parsed.parser;
      run.errors.push(...parsed.errors);
      run.complete = parsed.complete;
      run.status = parsed.complete ? (run.jobs.length ? 'success' : 'empty') : (run.jobs.length ? 'partial' : 'failed');
      run.source_health = parsed.source_health ?? (parsed.complete ? 'reachable_and_parsed' : 'incomplete_or_schema_changed');
      if (source) run.discovery_result = { status: parsed.source_status, source_complete: parsed.source_complete,
        cursor: parsed.cursor, access_stop: parsed.access_stop, discovered_companies: parsed.source_metadata.discovered_companies };
      if (board) run.ownership.board_evidence = { url: board.url, body_path: board.body_path, metadata_path: board.metadata_path,
        sha256: board.sha256, page_title: parsed.page_title, verified_at: board.finished_at,
        ...(parsed.transport ? { transport: parsed.transport } : {}) };
    } catch (error) {
      run.status = run.jobs.length ? 'partial' : 'failed';
      run.complete = false;
      run.source_health = 'stopped';
      run.errors.push({ code: error.code ?? 'COLLECTION_FAILED', message: error.message, evidence: error.evidence ?? null,
        ...(error.failure_scope ? { failure_scope: error.failure_scope, persistence_stage: error.persistence_stage, cause_code: error.cause_code } : {}) });
      if (source) run.discovery_result = { status: error.code === 'DISCOVERY_BUDGET_CHECKPOINT' ? 'partial' : 'failed',
        source_complete: false, cursor, access_stop: error.code ?? null, discovered_companies: [] };
    } finally {
      if (dom) { await dom.close(); dom = null; }
    }
    run.evidence = http.evidence;
    run.reused_evidence = http.reusedEvidence;
    if (source && requestBudget && initialBudgetUsed === 0
      && run.errors.some((error) => error.code === 'DISCOVERY_BUDGET_CHECKPOINT')
      && (run.discovery_result?.cursor?.visited?.length ?? 0) === initialPages) {
      run.discovery_result.budget_requirement = { request_budget_must_exceed: requestBudget.limit,
        reason: 'No static page was completed with the full execution budget; refreeze with a larger request budget' };
      run.errors.push({ code: 'DISCOVERY_BUDGET_NO_PROGRESS', message: run.discovery_result.budget_requirement.reason,
        request_budget_must_exceed: requestBudget.limit });
    }
    run.finished_at = new Date().toISOString();
    const persisted = persistSync('database_finish_run', () => store.finishRun(run));
    return dataDir ? { schema_version: 1, runs: [persisted] } : await persist('collection_report', () => writeReport(persisted));
  } finally {
    if (dom) await dom.close();
    try { if (store) persistSync('database_close', () => store.close()); }
    finally { if (!collectionLease) lease.release(); }
  }
}
