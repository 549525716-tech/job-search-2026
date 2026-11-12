import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { ROOT, repoRelative } from '../paths.mjs';
import { loadSweepInput, buildSweepReport } from '../sweep-report.mjs';

const hash = (value) => createHash('sha256').update(value).digest('hex');
test('exact source proof, dispatch receipt, hash expiry and rejected analysis', async () => {
  const dir = await mkdtemp(join(ROOT, '01_行情收集/official-careers/research/evidence-test-'));
  const put = (name, value) => writeFile(join(dir, name), JSON.stringify(value));
  try {
    await mkdir(join(dir, 'raw'));
    const job = { id: 'one', company: 'Example', title: '客户经理', city: '上海', source_kind: 'official',
      source_url: 'https://example.com/jobs', description: '管理客户，推进销售。', requirements: '三年销售经验。',
      description_complete: true, evidence_quote: '三年销售经验。', evidence_file: repoRelative(join(dir, 'raw/open.json')) };
    const jobs = [job];
    const dispatch = { agent_id: 'actual-agent', model: 'gpt-6-astra', reasoning_effort: 'max' };
    const analysis = { schema_version: 1, input_sha256: hash(JSON.stringify(jobs)), context_sha256: hash('{}'), execution: dispatch,
      priorities: [{ job_id: 'one', priority: '优先核实', job_quotes: ['管理客户，推进销售。'] }], summary: '审查完成' };
    const raw = { operation: 'open', kind: 'web_tool_result_not_raw_http', result: 'https://example.com/jobs\nL1: 客户经理\nL2: 管理客户，推进销售。\nL3: 三年销售经验。' };
    await put('jobs.json', jobs); await put('context.json', {}); await put('coverage.json', []); await put('run.json', {});
    await put('raw/open.json', raw); await put('analysis-dispatch.json', dispatch); await put('analysis.json', analysis);
    const load = () => loadSweepInput(repoRelative(dir));
    let result = await load();
    assert.equal(result.jobs[0].description_complete, true);
    assert.equal(result.analysis.status, 'valid');
    assert.equal(result.jobs[0].analysis.priority, '优先核实');
    await put('raw/open.json', { ...raw, kind: 'model_summary' });
    assert.equal((await load()).jobs[0].description_complete, false);
    await put('raw/open.json', raw);
    await put('analysis.json', { ...analysis, execution: { ...dispatch, model: 'gpt-5.6-luna' } });
    assert.equal((await load()).analysis.status, 'invalid');
    await put('analysis.json', { ...analysis, input_sha256: 'stale' });
    assert.equal((await load()).analysis.status, 'expired');
    await put('analysis.json', { ...analysis, context_sha256: 'stale' });
    assert.equal((await load()).analysis.status, 'expired');
    await put('analysis.json', { ...analysis, priorities: [...analysis.priorities, ...analysis.priorities] });
    assert.equal((await load()).analysis.status, 'partial');
    await put('analysis.json', { ...analysis, priorities: Array(21).fill(analysis.priorities[0]) });
    assert.equal((await load()).analysis.status, 'invalid');
    await put('analysis.json', { ...analysis, priorities: [{ job_id: 'one', job_quotes: ['不在原文的要求'] }] });
    assert.equal((await load()).analysis.status, 'partial');
    await put('analysis.json', analysis);
    await put('raw/open.json', { ...raw, result: 'https://example.com/jobs\nL1: 客户经理\nL2: 管理客户，另一岗位推进销售。\nL3: 三年销售经验。' });
    result = await load();
    assert.equal(result.jobs[0].description_complete, false, 'stitched fragments are not source evidence');
    assert.equal(result.analysis.status, 'partial', 'partial JD cannot receive a full-job recommendation');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('coverage counter excludes paused source groups and unattempted companies', () => {
  const data = buildSweepReport({ jobs: [], run: {}, coverage: [
    { company: 'A', attempted: true, entity_kind: 'company' },
    { company: 'B', attempted: false, entity_kind: 'company' },
    { company: 'Platform', attempted: false, entity_kind: 'paused_source_group' },
  ], analysis: { status: 'absent', invalid: [] } });
  assert.equal(data.counts.companies, 1);
});
