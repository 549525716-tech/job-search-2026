import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadMarketLeads } from '../market-leads.mjs';

const pref = { salary: { mode: 'fixed_monthly_base_minimum', currency: 'CNY', period: 'month', min_fixed_monthly_base: 20000 } };
test('public salary index retains provenance and never confirms fixed salary', async () => {
  const data = await loadMarketLeads(pref);
  assert.equal(data.summary.total, 15);
  assert.equal(data.summary.companies, 8);
  assert.equal(data.summary.confirmed_base, 0);
  assert.ok(data.leads.every((x) => !x.description_complete && !x.salary_target.eligible && x.evidence.sha256.length === 64));
  assert.equal(data.leads.filter((x) => x.job_url).length, 1);
});
test('fabricated evidence, duplicated identity, unsafe URLs and promoted completeness fail closed', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'career-leads-'));
  const manifestPath = join(dir, 'manifest.json');
  const lead = { lead_id: 'one', company_name: 'A', title: 'AI产品销售', salary_raw: '25-30k', location_raw: '北京', source_url: 'https://example.org/jobs', description_complete: false, evidence_status: 'search_index_only', evidence: { path: 'source.json', quote: 'AI产品销售 25-30k' } };
  const receipt = { kind: 'web_tool_result_not_raw_http', observed_at: '2026-09-10T12:00:00Z', result: '(https://example.org/jobs) AI产品销售 25-30k' };
  const run = async (leads, source = receipt) => { await writeFile(manifestPath, JSON.stringify({ schema_version: 1, leads })); return loadMarketLeads(pref, { manifestPath, readEvidence: async () => JSON.stringify(source) }); };
  try {
    assert.equal((await run([lead])).summary.confirmed_base, 0);
    await assert.rejects(run([lead], { ...receipt, result: 'Unrelated salary' }));
    await assert.rejects(run([lead, { ...lead, lead_id: 'two' }]));
    await assert.rejects(run([{ ...lead, job_url: 'javascript:alert(1)' }]));
    await assert.rejects(run([{ ...lead, job_url: 'https://unrelated.example/job' }]));
    await assert.rejects(run([lead], { ...receipt, result: '(https://example.org/jobs) Unrelated\n------------------------------\n(https://other.example/jobs) AI产品销售 25-30k' }));
    await assert.rejects(run([{ ...lead, description_complete: true }]));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('real same-page neighboring salary and company/search URLs cannot become a job fact', async () => {
  const manifest = JSON.parse(await readFile(new URL('../config/market-leads.json', import.meta.url), 'utf8'));
  const lead = manifest.leads.find((x) => x.lead_id === '360-ai-sales');
  const dir = await mkdtemp(join(tmpdir(), 'career-lead-binding-')); const manifestPath = join(dir, 'manifest.json');
  const run = async (change) => { await writeFile(manifestPath, JSON.stringify({ schema_version: 1, leads: [{ ...lead, ...change }] })); return loadMarketLeads(pref, { manifestPath }); };
  try {
    assert.equal((await run({})).summary.total, 1);
    await assert.rejects(run({ salary_raw: '80-110k·15薪' }));
    await assert.rejects(run({ job_url: lead.source_url }));
    await assert.rejects(run({ job_url: 'https://m.liepin.com/s/search/' }));
    await assert.rejects(run({ job_url: 'https://www.liepin.com/job/1985206063.shtml' }));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
