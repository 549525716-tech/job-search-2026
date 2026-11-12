import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';

export async function main(args = process.argv.slice(2)) {
  if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('Node 24+ required. Use careers/run.mjs or the bundled Node24 binary.');
  if (args[0] === 'applications:plan') return await (await import('./application-planner.mjs')).main(args.slice(1));
  if (args[0] === 'resume:build') return (await import('./resume-tailor.mjs')).main(args.slice(1));
  if (args[0] === 'coverage:build') return await (await import('./coverage-campaign.mjs')).main(args.slice(1));
  if (args[0] === 'coverage:report') return await (await import('./coverage-report.mjs')).writeCoverageReport(args.slice(1));
  if (args[0] === 'fallback') {
    const { values, positionals } = parseArgs({ args: args.slice(1), strict: true,
      options: { companies: { type: 'string' } } });
    if (positionals.length || !values.companies?.trim()) throw new Error('fallback requires an explicit --companies ID,ID list');
    const companyIds = values.companies.split(',').map(id => id.trim());
    if (companyIds.some(id => !id)) throw new Error('Empty company ID');
    return await (await import('./fallback.mjs')).runFallback({ companyIds });
  }
  if (args[0] === 'decision:report') {
    if(args.length!==1) throw new Error('decision:report takes no arguments');
    return await (await import('./decision-review.mjs')).writeDecisionReview();
  }
  const { values, positionals } = parseArgs({ args, allowPositionals: true, strict: true, options: {
    company: { type: 'string' }, companies: { type: 'string' }, all: { type: 'boolean' },
    run: { type: 'string' }, help: { type: 'boolean' }, file: { type: 'string' }, limit: { type: 'string' }, documents: { type: 'string' }, input: { type: 'string' },
    approvals: { type: 'string' }, batch: { type: 'string' }, 'max-companies': { type: 'string' },
    'max-requests': { type: 'string' }, 'max-pages': { type: 'string' }, 'no-seeds': { type: 'boolean' },
  } });
  const command = positionals[0] ?? 'doctor';
  if (values.help) return { commands: ['doctor', 'collect --company COMPANY_ID', 'collect --companies ID,ID', 'collect --all (fixed adapters + one bounded discovery wave)', 'discovery:prepare [--input JSON --approvals JSON --max-companies 5 --max-requests 30 --max-pages 3 --no-seeds] (offline)', 'discovery:run --batch FROZEN_ID (explicit bounded execution)', 'discovery:export (read only)', 'match:prepare [--limit 20]', 'match:import --file PATH', 'research:collect --documents ID,ID', 'funnel:build (offline report rebuild)', 'agents:prepare (no model dispatch)', 'agents:report', 'leads:report', 'sweep:report --input RESEARCH_DIR (offline)', 'report [--run RUN_ID]'], mode: 'manual' };
  if (positionals.length > 1 || !['doctor', 'collect', 'report', 'match:prepare', 'match:import', 'research:collect', 'funnel:build', 'agents:prepare', 'agents:report', 'leads:report', 'sweep:report', 'discovery:prepare', 'discovery:run', 'discovery:export'].includes(command)) throw new Error('Unknown careers command');
  if (values.input && !['sweep:report', 'discovery:prepare'].includes(command)) throw new Error('Input option requires sweep:report or discovery:prepare');
  if (command === 'sweep:report' && !values.input?.trim()) throw new Error('sweep:report requires --input');
  if (values.documents && command !== 'research:collect') throw new Error('Documents option requires research:collect');
  if (command === 'research:collect' && !values.documents?.trim()) throw new Error('Explicit --documents required for bounded research capture');
  if (((values.company || values.companies || values.all) && command !== 'collect') || (values.run && command !== 'report')) throw new Error('Option not valid for command');
  if ([values.company, values.companies, values.all].filter(Boolean).length > 1) throw new Error('Choose only one of --company, --companies or --all');
  if ((values.file && command !== 'match:import') || (values.limit && command !== 'match:prepare')) throw new Error('Matching option not valid for command');
  if (command === 'match:import' && !values.file) throw new Error('match:import requires --file');
  if ([values.approvals, values['max-companies'], values['max-requests'], values['max-pages'], values['no-seeds']].some((value) => value !== undefined)
    && command !== 'discovery:prepare') throw new Error('Discovery preparation option requires discovery:prepare');
  if (values.batch && command !== 'discovery:run') throw new Error('Batch option requires discovery:run');
  if (command === 'discovery:run' && !values.batch?.trim()) throw new Error('Explicit frozen --batch required');
  if (command === 'discovery:prepare') return await (await import('./discovery.mjs')).prepareDiscovery({ input: values.input,
    approvalsPath: values.approvals, includeSeeds: !values['no-seeds'],
    maxCompanies: values['max-companies'] === undefined ? undefined : Number(values['max-companies']),
    maxRequests: values['max-requests'] === undefined ? undefined : Number(values['max-requests']),
    maxPages: values['max-pages'] === undefined ? undefined : Number(values['max-pages']) });
  if (command === 'discovery:run') return await (await import('./discovery.mjs')).runDiscovery({ batchId: values.batch });
  if (command === 'discovery:export') return await (await import('./discovery.mjs')).readDiscoveryExport();
  if (command === 'agents:prepare') return await (await import('./headhunter.mjs')).prepareAgentTasks();
  if (command === 'agents:report') return await (await import('./headhunter.mjs')).writeHeadhunterReport();
  if (command === 'leads:report') return await (await import('./market-leads.mjs')).writeMarketLeads();
  if (command === 'sweep:report') return await (await import('./sweep-report.mjs')).writeSweepReport({ inputDir: values.input });
  if (command === 'research:collect') {
    const { collectResearch } = await import('./research.mjs');
    const ids = values.documents.split(',').map((id) => id.trim()).filter(Boolean);
    if (!ids.length) throw new Error('Select at least one explicit document ID');
    return await collectResearch({ ids });
  }
  if (command === 'doctor') {
    const { DatabaseSync } = await import('node:sqlite');
    const { createOfflineDOM } = await import('./dom.mjs');
    const { parseNuxtLiteral } = await import('./structured-script.mjs');
    const { DATA_DIR, DB_PATH, CONTROL_PATH, repoRelative } = await import('./paths.mjs');
    const { companies } = await import('./registry.mjs');
    const db = new DatabaseSync(':memory:');
    const sqliteVersion = db.prepare('SELECT sqlite_version() AS version').get().version;
    db.close();
    const dom = await createOfflineDOM();
    try {
      const parsed = await dom.evaluate(() => new DOMParser().parseFromString('<h1>offline</h1>', 'text/html').body.textContent);
      const literal = parseNuxtLiteral('window.__NUXT__=(function(a){return {value:a}}("literal"));');
      if (parsed !== 'offline' || literal.value !== 'literal') throw new Error('Offline parsers failed');
    } finally { await dom.close(); }
    return { command, ok: true, mode: 'manual', node: process.version, node_executable: process.execPath, sqlite: sqliteVersion,
      data_namespace: repoRelative(DATA_DIR), database: repoRelative(DB_PATH), collection_control: repoRelative(CONTROL_PATH),
      live_requests: 0, dom: 'offline DOMParser; fresh sandboxed Chrome; no persistent profile or navigation',
      public_browser_policy: 'Approved MiniMax/Moonshot fallback only; disposable anonymous context, normal site JS, no personal cookies or signature emulation',
      structured_parser: 'installed Playwright Babel AST; only literal Nuxt data; never eval',
      supported_sources: companies.map((company) => ({ company_id: company.company_id, source_id: company.source_id,
        collection_approval: company.collection_approval, verification_state: company.verification_state,
        configured_collection_enabled: !company.access_block, disabled_reason: company.access_block ?? null })),
      limits: { min_interval_ms: 10000, max_jitter_interval_ms: 20000, network_timeout_ms: 30000, redirects: 2,
        retries: 0, cookies: false, auth: false, llm: false, legacy_data_writes: false } };
  }
  if (command === 'collect') {
    const { collect } = await import('./collector.mjs');
    const { companies } = await import('./registry.mjs');
    const requested = values.all ? companies.map((c) => c.company_id)
      : String(values.companies ?? values.company ?? 'bailian-ai').split(',').map((id) => id.trim()).filter(Boolean);
    if (!requested.length) throw new Error('No companies selected');
    const result = { command, mode: 'manual', runs: [], skipped: [] };
    for (const companyId of [...new Set(requested)]) {
      if (!companies.some((company) => company.company_id === companyId)) {
        result.skipped.push({ company_id: companyId, reason: 'No fixed adapter registered; not scanned',
          next_action: 'Use careers:discovery:prepare with explicit company/job JSON and reviewed source approvals; generic static sources need no per-company JS registration' });
        continue;
      }
      const collected = await collect({ companyId });
      result.runs.push(...collected.runs.map((run) => ({ run_id: run.run_id, company_id: run.company_id, source_id: run.source_id,
        status: run.status, complete: run.complete, job_count: run.jobs.length, observation_kind: run.observation_kind,
        events_count: run.events?.length ?? 0, errors: run.errors, reports: run.artifacts })));
    }
    if (values.all) {
      const { prepareDiscovery, runDiscovery, readDiscoveryExport } = await import('./discovery.mjs');
      const prepared = await prepareDiscovery();
      result.discovery = await runDiscovery({ batchId: prepared.batch_id });
      const runIds = new Set(Object.values(result.discovery.results ?? {}).map((item) => item.run_id).filter(Boolean));
      result.runs.push(...(await readDiscoveryExport()).runs.filter((run) => runIds.has(run.run_id)).map((run) => ({
        run_id: run.run_id, company_id: run.company_id, source_id: run.source_id, status: run.status,
        discovery_status: run.discovery_result?.status, complete: run.complete, job_count: run.jobs.length,
        observation_kind: run.observation_kind, errors: run.errors, reports: run.artifacts,
      })));
    }
    return result;
  }
  const { CareersStore } = await import('./store.mjs');
  const { writeReport } = await import('./report.mjs');
  const store = new CareersStore();
  try {
    const { loadMatchContext, prepareMatches, importMatches, validAnalyses } = await import('./matching.mjs');
    const context = await loadMatchContext();
    if (['match:prepare', 'match:import'].includes(command)) {
      const { readDiscoveryExport } = await import('./discovery.mjs');
      const jobs = [...store.listJobs(), ...(await readDiscoveryExport()).jobs];
      if (command === 'match:prepare') return await prepareMatches(jobs, context, { limit: values.limit ? Number(values.limit) : 20 });
      return await importMatches(values.file, jobs, context);
    }
    if (!values.run) {
      const { writeOverview } = await import('./overview.mjs');
      const { readDiscoveryExport } = await import('./discovery.mjs');
      const jobs = [...store.listJobs(), ...(await readDiscoveryExport()).jobs];
      return await writeOverview({ jobs, runs: store.listRuns(), sources: store.listSources(), events: store.listEvents(),
        analyses: await validAnalyses(jobs, context), preferences: context.preferences });
    }
    const run = store.readRun(values.run);
    if (!run) throw new Error('No completed collection run available');
    return await writeReport(run);
  } finally { store.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await main();
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    if (result.skipped?.length || ['partial', 'failed', 'checkpoint', 'terminated'].includes(result.status)
      || result.discovery?.status === 'checkpoint'
      || result.discovery?.results && Object.values(result.discovery.results).some((item) => !['success', 'verified_empty'].includes(item.status))
      || result.results && Object.values(result.results).some((item) => !['success', 'verified_empty'].includes(item.status))
      || result.runs?.some((run) => !['success', 'empty'].includes(run.status))) process.exitCode = 2;
  } catch (error) {
    process.stderr.write(JSON.stringify({ ok: false, code: error.code ?? 'COMMAND_FAILED', error: error.message }) + '\n');
    process.exitCode = 1;
  }
}
