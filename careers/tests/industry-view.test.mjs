import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeIndustryClassification, getIndustryAnnotation, groupJobsByIndustry } from '../industry-view.mjs';

test('unverified company names group only within the same source without changing job identity', () => {
  const jobs = [{ id: '1', company: '甲公司', source_url: 'https://example.com/jobs' },
    { id: '2', company: '甲公司', source_url: 'https://example.com/jobs' },
    { id: '3', company: '甲公司', source_url: 'https://elsewhere.example/jobs' }];
  const groups = groupJobsByIndustry(jobs);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].company_name, '甲公司');
  assert.equal(groups.flatMap((group) => group.jobs).length, 3);
  assert(groups.every((group) => group.company_id === undefined));
});
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { DATA_DIR, repoRelative } from '../paths.mjs';

const evidence = [
  { publisher: '独立研究甲', original_publisher: '独立研究甲', comparative: true, business: true, published_at: '2026-08-01', verbatim_quote: '市场梯队与客户交付' },
  { publisher: '独立研究乙', original_publisher: '独立研究乙', comparative: true, business: true, published_at: '2026-08-02', verbatim_quote: '市场份额与商业化客户' },
];

test('arbitrary tier claims remain unverified without the full evidence contract', () => {
  const result = normalizeIndustryClassification({ tier: 'leader', assessment_status: 'supported', version: 'v1', industry: 'AI', segment: '企业服务', geographic_market: '中国', as_of_period: '2026-08-01', evidence: [] }, { now: Date.parse('2026-09-13') });
  assert.equal(result.tier, 'unverified');
  assert.equal(result.verified, false);
});

test('self-reported comparison flags and publisher names are not supported classifications', () => {
  const result = normalizeIndustryClassification({ tier: 'leader', assessment_status: 'supported', version: 'v1', industry: 'AI', segment: '企业服务', geographic_market: '中国', as_of_period: '2026-08-02', evidence }, { now: Date.parse('2026-09-13') });
  assert.equal(result.tier, 'unverified');
});

test('source-linked quotes and current tier-specific review pass, stale review and altered proof do not', async () => {
  await mkdir(join(DATA_DIR, 'research'), { recursive: true });
  const directory = await mkdtemp(join(DATA_DIR, 'research', '_tier-test-'));
  try {
    const proofs = [];
    for (const [index, role] of ['independent_leading_cohort', 'commercial_delivery'].entries()) {
      const body = `Fixture evidence ${index}: measured segment position and actual commercial delivery.`;
      const sha = createHash('sha256').update(body).digest('hex');
      const body_path = repoRelative(join(directory, `${index}.body`));
      const metadata_path = repoRelative(join(directory, `${index}.response.json`));
      const source_url = `https://publisher-${index}.example/research`;
      await writeFile(join(directory, `${index}.body`), body);
      await writeFile(join(directory, `${index}.response.json`), JSON.stringify({ url: source_url, body_path, sha256: sha, status: 200, complete: true }));
      proofs.push({ source_url, body_path, metadata_path, content_sha256: sha, verbatim_quote: body,
        publisher: `p${index}`, original_publisher: `p${index}`, source_kind: 'research', independent: true,
        evidence_role: role, published_at: '2026-08-01', observed_at: '2026-09-01', metric_period: '2026-08-01',
        metric_definition: 'fixture only', geographic_market: '中国', segment_definition: '企业服务', coverage_and_method: 'fixture comparison' });
    }
    const input = { company_id: 'c1', tier: 'leader', assessment_status: 'supported', version: 'test-v1', industry: 'AI', segment: '企业服务',
      geographic_market: '中国', as_of_period: '2026-08-01', reviewed_at: '2026-09-01',
      review_execution: { agent_id: 'fixture-only', model: 'gpt-6-astra', reasoning_effort: 'max' }, evidence: proofs };
    const options = { now: Date.parse('2026-09-13') };
    assert.equal(normalizeIndustryClassification(input, options).verified, true);
    assert.equal(normalizeIndustryClassification({ ...input, reviewed_at: '2026-03-01' }, options).verified, false);
    assert.equal(normalizeIndustryClassification({ ...input, tier: 'established' }, options).verified, false);
    assert.equal(getIndustryAnnotation({ company_name: 'Unknown' }, {}, [input], options).tier_verified, false);
    assert.equal(getIndustryAnnotation({ company_id: 'other' }, {}, [input], options).tier_verified, false);
    await writeFile(join(directory, '0.body'), 'Changed raw source');
    assert.equal(normalizeIndustryClassification(input, options).verified, false);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('company sector is only a fallback clue and jobs remain grouped when tier is unknown', () => {
  const company = { id: 'c1', name: '公司', sector: 'AI' };
  const first = getIndustryAnnotation({ company_id: 'c1', title: '销售', department: '企业服务' }, company, []);
  assert.deepEqual(first, { industry: 'AI', segment: 'AI', tier: 'unverified', tier_label: '地位待核', tier_verified: false, business_line: '企业服务', classification_version: null, classification_as_of: null, classification_evidence: [], classification_validation_reason: '暂无已核分类输入' });
  const groups = groupJobsByIndustry([{ ...first, company_id: 'c1', company_name: '公司' }, { ...first, company_id: 'c1', company_name: '公司', job_key: '2' }]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].jobs.length, 2);
});
