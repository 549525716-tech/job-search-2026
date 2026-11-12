import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { DATA_DIR, repoRelative } from '../paths.mjs';
import { verifiedResearchDocument } from '../research.mjs';
import { verifyJobEvidence } from '../funnel.mjs';
import { normalizeJob } from '../normalize.mjs';

const hash = (value) => createHash('sha256').update(value).digest('hex');

async function fixture(t) {
  const directory = await mkdtemp(join(DATA_DIR, 'integrity-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const raw = '<h1>Document</h1><p>Exact evidence text</p>';
  const bodyPath = join(directory, 'source.body');
  const metadataPath = join(directory, 'source.response.json');
  const textPath = join(directory, 'source.txt');
  const receipt = { status: 200, complete: true, error: null, url: 'https://example.test/source',
    body_path: repoRelative(bodyPath), metadata_path: repoRelative(metadataPath), sha256: hash(raw), finished_at: '2026-09-10T00:00:00Z' };
  await writeFile(bodyPath, raw);
  await writeFile(metadataPath, JSON.stringify(receipt));
  await writeFile(textPath, 'Exact evidence text');
  return { directory, bodyPath, metadataPath, textPath, receipt,
    document: { ...receipt, text_path: repoRelative(textPath), text_sha256: hash('Exact evidence text') } };
}

test('research proof rejects altered response, extracted text and metadata', async (t) => {
  const f = await fixture(t);
  assert.equal((await verifiedResearchDocument(f.document)).text, 'Exact evidence text');
  await writeFile(f.textPath, 'Fabricated evidence');
  await assert.rejects(verifiedResearchDocument(f.document), /integrity/);
  await writeFile(f.textPath, 'Exact evidence text');
  await writeFile(f.metadataPath, JSON.stringify({ ...f.receipt, status: 403 }));
  await assert.rejects(verifiedResearchDocument(f.document), /integrity/);
  await writeFile(f.metadataPath, JSON.stringify(f.receipt));
  await writeFile(f.bodyPath, '<p>Changed raw body</p>');
  await assert.rejects(verifiedResearchDocument(f.document), /integrity/);
});

test('JD proof requires normalized content and official ownership evidence, not just a saved body', async (t) => {
  const f = await fixture(t);
  const job = normalizeJob({ source_job_id: 'one', title: 'Sales', location_raw: 'Beijing',
    responsibilities: 'Serve customers', requirements: 'Experience', description_text: 'Serve customers\nExperience',
    published_raw: '2026-09-01', salary_raw: null },
  { source_id: 'test-source', company_id: 'test-company', company_name: 'Test', tenant: 'test-tenant' }, f.receipt);
  job.latest_run_id = 'test-run';
  const run = { run_id: 'test-run', source_id: 'test-source', company_id: 'test-company', ownership: { status: 'verified',
    chain: [{ from_url: f.receipt.url, body_path: f.receipt.body_path, metadata_path: f.receipt.metadata_path }] } };
  assert.equal((await verifyJobEvidence(job, [run])).length, 2);
  await assert.rejects(verifyJobEvidence({ ...job, description_text: 'Invented JD' }, [run]), /content integrity/);
  await assert.rejects(verifyJobEvidence(job, [{ ...run, company_id: 'another-company' }]), /ownership proof missing/);
  await assert.rejects(verifyJobEvidence(job, [{ ...run, ownership: { status: 'verified', chain: [] } }]), /ownership proof missing/);
  await writeFile(f.bodyPath, '<p>Changed raw body</p>');
  await assert.rejects(verifyJobEvidence(job, [run]), /body integrity/);
});
