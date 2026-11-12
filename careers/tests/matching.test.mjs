import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { matchCacheKey, validateAssessment, prepareMatches, importMatches, validAnalyses, hardGateSignals, assessmentDigest } from '../matching.mjs';

const context = { profile_hash: 'profile1', preferences_hash: 'preferences1', rules_hash: 'rules1', base_resume_hash: 'resume1',
  facts: { evidence: [{ id: 'EV-1', action: '真实客户经营' }] },
  preferences: { role_keywords: ['销售'], match_batch_limit: 20, reuse_resume_min_score: 80 },
  rules: { model: 'gpt-6-astra', reasoning_effort: 'xhigh', max_batch: 20, requirement_count: { min: 3, max: 12 }, coverage_values: { direct: 1, transferable: 0.5, gap: 0 }, score_semantics: 'coverage', semantic_review_policy: { model: 'gpt-6-astra', reasoning_effort: 'xhigh', require_registered_reviewer: true, require_distinct_executor: true, required_checks: ['facts_checked', 'hard_gates_checked', 'source_quotes_checked'] } } };
const job = { job_key: 'fixture:1', title: 'AI销售', description_text: '客户需求诊断。负责业务增长。维护客户关系。', description_complete: true, hiring_active: 'unknown' };
function assessment(current = job, ctx = context) {
  return { job_key: current.job_key, cache_key: matchCacheKey(current, ctx), execution: { model: 'gpt-6-astra', reasoning_effort: 'xhigh', agent_id: 'fixture-not-a-live-executor' },
    requirements: ['客户需求诊断', '负责业务增长', '维护客户关系'].map((quote, i) => ({ id: `R${i}`, requirement: quote, jd_quote: quote, weight: 1, coverage: 'direct', evidence_ids: ['EV-1'], evidence_quotes: [{ evidence_id: 'EV-1', quote: '真实客户经营' }], explanation: '有直接客户经营证据', hard_gate: false })),
    hard_gates: [], hard_gate_review_complete: true, same_positioning: true, base_resume_reviewed: true,
    role_mission: '客户价值转为业务增长', value_proposition: '客户经营', verdict: '可以评估', resume_action: 'tailor', resume_advice: '保留真实客户经营证据', questions: [] };
}
function reviewed(input, ctx = context) {
  return { ...ctx, reviewers: [{ agent_id: 'independent-fixture', model: 'gpt-6-astra', reasoning_effort: 'xhigh' }],
    semantic_reviews: [{ reviewer_id: 'independent-fixture', model: 'gpt-6-astra', reasoning_effort: 'xhigh', cache_key: input.cache_key, analysis_sha256: assessmentDigest(input), verdict: 'approved', facts_checked: true, hard_gates_checked: true, source_quotes_checked: true }] };
}

test('next batch carries strategy and separates fixed-base eligibility from legacy pay signals', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'career-strategy-test-'));
  try {
    const ctx = { ...context, career_strategy: { version: 'private-headhunter-test', assessment_dimensions: ['career_direction_fit'] },
      preferences: { ...context.preferences, salary: { mode: 'fixed_monthly_base_minimum', currency: 'CNY', period: 'month', min_fixed_monthly_base: 20000 } } };
    const prepared = await prepareMatches([{ ...job, salary_raw: '20-30K/月', salary_status: 'parsed', salary_currency: 'CNY', salary_period: 'month', salary_min: 20000, salary_max: 30000, salary_20k_eligible: true }], ctx, { directory });
    const batch = JSON.parse(await readFile(prepared.batch_path, 'utf8'));
    assert.deepEqual(batch.career_strategy, ctx.career_strategy);
    assert.equal(batch.jobs[0].salary_target.eligible, false);
    assert.equal(batch.jobs[0].salary_target.pending, true);
    assert.equal(prepared.model_calls, 0);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('unfamiliar-title body review enters a full-JD batch with an explicit review gate', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'career-body-review-'));
  try {
    const reviewJob = { ...job, title: 'Customer Value Lead', company_id: 'distinct-employer', description_text: '负责企业客户分层、合同谈判与收入目标。' };
    const result = await prepareMatches([reviewJob], context, { directory });
    const batch = JSON.parse(await readFile(result.batch_path, 'utf8'));
    assert.equal(result.count, 1);
    assert.equal(batch.jobs[0].role_recall.review_required, true);
    assert.equal(batch.jobs[0].role_recall.eligible, false);
    assert.equal(batch.jobs[0].company_id, 'distinct-employer');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('cache changes when JD, profile, preferences, rules or base resume change', () => {
  const key = matchCacheKey(job, context);
  assert.notEqual(key, matchCacheKey({ ...job, description_text: `${job.description_text}新增要求` }, context));
  for (const field of ['profile_hash', 'preferences_hash', 'rules_hash', 'base_resume_hash']) {
    assert.notEqual(key, matchCacheKey(job, { ...context, [field]: 'changed' }));
  }
  for (const field of ['employment_type', 'department', 'requirements', 'responsibilities', 'locations', 'salary_kind', 'salary_status', 'detail_completeness']) {
    assert.notEqual(key, matchCacheKey({ ...job, [field]: 'changed' }, context));
  }
});

test('score is computed from evidence and cannot override reuse safety flags', () => {
  const input = { ...assessment(), score: 1 };
  assert.equal(validateAssessment(input, job, context).score, 100);
  input.resume_action = 'reuse';
  assert.throws(() => validateAssessment(input, job, context), /reuse guard/);
  assert.equal(validateAssessment(input, job, reviewed(input)).resume_reuse_eligible, true);
  for (const flag of ['hard_gate_review_complete', 'same_positioning', 'base_resume_reviewed']) {
    const changed = { ...input, [flag]: false };
    assert.throws(() => validateAssessment(changed, job, reviewed(changed)), /reuse guard/);
  }
  const incomplete = { ...job, description_complete: false };
  assert.throws(() => validateAssessment({ ...assessment(incomplete), resume_action: 'reuse' }, incomplete, context), /reuse guard/);
});

test('unknown gates, fabricated facts and unavailable models are rejected', () => {
  const input = assessment();
  input.requirements[0].hard_gate = true;
  input.hard_gates = [{ requirement_id: 'R0', status: 'unknown', reason: '尚待确认' }];
  input.resume_action = 'reuse';
  assert.throws(() => validateAssessment(input, job, context), /reuse guard/);
  input.resume_action = 'tailor';
  assert.equal(validateAssessment(input, job, context).resume_reuse_eligible, false);
  input.requirements[0].evidence_ids = ['INVENTED'];
  assert.throws(() => validateAssessment(input, job, context), /fabricated/);
  assert.throws(() => validateAssessment({ ...assessment(), execution: { model: 'cheaper-unapproved' } }, job, context), /model/);
});

test('independent rejection remains visible and never authorizes resume reuse', () => {
  const input = assessment();
  const ctx = reviewed(input);
  ctx.semantic_reviews[0].verdict = 'rejected';
  ctx.semantic_reviews[0].notes = 'Missing a material JD requirement';
  const result = validateAssessment(input, job, ctx);
  assert.equal(result.semantic_review_status, 'rejected');
  assert.equal(result.semantic_review.notes, 'Missing a material JD requirement');
  assert.equal(result.resume_reuse_eligible, false);
  input.resume_action = 'reuse';
  ctx.semantic_reviews[0].analysis_sha256 = assessmentDigest(input);
  assert.throws(() => validateAssessment(input, job, ctx), /reuse guard/);
});

test('only a registered independent Astra xhigh review can authorize reuse; max history remains non-current', () => {
  const input = { ...assessment(), resume_action: 'reuse' };
  const current = reviewed(input);
  assert.equal(validateAssessment(input, job, current).resume_reuse_eligible, true);
  for (const change of [
    { reviewer_id: input.execution.agent_id },
    { model: 'gpt-6-astra', reasoning_effort: 'max' },
    { model: 'gpt-5.6-terra', reasoning_effort: 'medium' },
    { facts_checked: false },
    { source_quotes_checked: false }
  ]) {
    const rejected = reviewed(input);
    Object.assign(rejected.semantic_reviews[0], change);
    assert.throws(() => validateAssessment(input, job, rejected), /reuse guard/);
  }
  const unknownReviewer = reviewed(input);
  unknownReviewer.reviewers = [];
  assert.throws(() => validateAssessment(input, job, unknownReviewer), /reuse guard/);
  const historicalMax = reviewed(input);
  historicalMax.reviewers = [{ agent_id: 'legacy-max-reviewer', model: 'gpt-6-astra', reasoning_effort: 'max' }];
  Object.assign(historicalMax.semantic_reviews[0], { reviewer_id: 'legacy-max-reviewer', model: 'gpt-6-astra', reasoning_effort: 'max' });
  assert.throws(() => validateAssessment(input, job, historicalMax), /reuse guard/);
});

test('JD quotes must exist and removed public metrics cannot reappear', () => {
  const input = assessment();
  input.requirements[0].jd_quote = '并不存在的JD';
  assert.throws(() => validateAssessment(input, job, context), /quote/);
  assert.throws(() => validateAssessment({ ...assessment(), resume_advice: '成交4到10台' }, job, context), /Removed/);
});

test('explicit education gates cannot be silently omitted', () => {
  const withGate = { ...job, description_text: `${job.description_text}本科以上学历，3年以上工作经验。` };
  assert(hardGateSignals(withGate.description_text).includes('本科'));
  assert.throws(() => validateAssessment(assessment(withGate), withGate, context), /gate has not been reviewed/);
  const englishGate = { ...job, description_text: `${job.description_text}Required: PhD in Computer Science. Must have valid US work authorization.` };
  assert.throws(() => validateAssessment(assessment(englishGate), englishGate, context), /gate has not been reviewed/);
});

test('degree contradictions and unsupported AI revenue claims cannot masquerade as direct evidence', () => {
  const phdJob = { ...job, description_text: `${job.description_text}必须具有计算机专业博士学历` };
  const input = assessment(phdJob);
  input.requirements.push({ id: 'EDU', requirement: '计算机博士', jd_quote: '必须具有计算机专业博士学历', weight: 5, hard_gate: true, coverage: 'direct', evidence_ids: ['EV-1'], evidence_quotes: [{ evidence_id: 'EV-1', quote: '真实客户经营' }], explanation: '尝试伪造满足' });
  input.hard_gates = [{ requirement_id: 'EDU', status: 'met', reason: '伪造满足' }];
  assert.throws(() => validateAssessment(input, phdJob, { ...context, facts: { ...context.facts, attributes: { degree_level: 'bachelor', computer_science_degree: false } } }), /Degree hard gate/);
  assert.throws(() => validateAssessment({ ...assessment(), value_proposition: '已经完成AI产品签约回款并交付企业级AI POC，合同额1000万元' }, job, context), /Unverified AI/);
  const fakeQuote = assessment();
  fakeQuote.requirements[0].evidence_quotes[0].quote = '不存在的成交证据';
  assert.throws(() => validateAssessment(fakeQuote, job, context), /quote not found/);
});

test('bounded preparation, import, cache hit and stale import are deterministic without LLM calls', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'career-match-test-'));
  try {
    const many = Array.from({ length: 25 }, (_, i) => ({ ...job, job_key: `fixture:${i}` }));
    const prepared = await prepareMatches(many, context, { directory });
    assert.equal(prepared.count, 20);
    assert.equal(prepared.remaining, 5);
    assert.equal(prepared.model_calls, 0);
    assert.equal((await prepareMatches(many, context, { directory })).batch_id, prepared.batch_id);
    const batch = JSON.parse(await readFile(prepared.batch_path, 'utf8'));
    const selected = batch.jobs[0];
    const path = join(directory, 'answers.json');
    await writeFile(path, JSON.stringify({ batch_id: batch.batch_id, analyses: [assessment(selected)] }));
    assert.equal((await importMatches(path, many, context, { directory })).count, 1);
    assert.equal((await validAnalyses(many, context, directory)).length, 1);
    assert.equal((await prepareMatches(many, context, { directory })).cached, 1);
    assert.equal((await validAnalyses(many, { ...context, profile_hash: 'new' }, directory)).length, 0);
    await assert.rejects(importMatches(path, many, { ...context, profile_hash: 'new' }, { directory }), /invalidated/);
    await assert.rejects(prepareMatches(many, context, { directory, limit: 21 }), /limit/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
