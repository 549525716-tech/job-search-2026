import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSalary } from '../salary.mjs';
import { evaluateSalaryTarget } from '../salary-target.mjs';
import { readFileSync } from 'node:fs';

const rule = { mode: 'fixed_monthly_base_minimum', currency: 'CNY', period: 'month', min_fixed_monthly_base: 20000 };
const job = (raw = '固定底薪20-30K/月', hints = {}, overrides = {}) => {
  const parsed = parseSalary(raw, hints);
  return {
    salary_raw: parsed.salary_raw,
    currency: parsed.salary_currency,
    period: parsed.salary_period,
    min: parsed.salary_min,
    max: parsed.salary_max,
    status: parsed.salary_status,
    kind: parsed.salary_kind,
    ...overrides,
  };
};

test('real range plus commission enters the opportunity pool without confirming fixed base', () => {
  const jobs=JSON.parse(readFileSync(new URL('../../01_行情收集/official-careers/research/fallback-2026-09-22/jobs.json',import.meta.url),'utf8'));
  const sales=jobs.find(j=>j.id==='fallback-2026-09-22:o04:l169');
  assert.equal(sales.salary_raw,'30K-50K·14薪 + 提成');
  const parsed=parseSalary(sales.salary_raw);
  assert.equal(parsed.salary_min,30000);
  assert.equal(parsed.salary_max,50000);
  assert.equal(parsed.salary_pay_months,14);
  assert.equal(parsed.salary_raw,sales.salary_raw);
  assert.equal(parsed.salary_kind,'range_plus_commission');
  const opportunity={mode:'advertised_monthly_range',currency:'CNY',period:'month',min_monthly_opportunity:20000};
  for(const raw of [sales.salary_raw,'15-30K/月 + 提成','20-30K/月 + 佣金']) {
    const result=evaluateSalaryTarget(parseSalary(raw),opportunity);
    assert.equal(result.eligible,true,raw);
    assert.equal(result.fixed_base.eligible,false,raw);
    assert.equal(result.fixed_base.pending,true,raw);
  }
  for(const raw of ['提成20-30K/月','综合月薪20-30K/月 + 提成','含提成20-30K/月','底薪10K + 提成20K',
    'OTE 20-30K/月 + 提成','USD 20-30K/month + commission','240-360K/年 + 提成']) {
    const result=evaluateSalaryTarget(parseSalary(raw),opportunity);
    assert.equal(result.eligible,false,raw);
    assert.equal(result.fixed_base.eligible,false,raw);
  }
  assert.equal(evaluateSalaryTarget(parseSalary('8-14K/月 + 提成'),opportunity).status,'below_target');
});

test('explicit fixed base at 20K and 20-30K passes', () => {
  const parsed = parseSalary('固定底薪20-30K/月');
  assert.equal(parsed.salary_status, 'parsed');
  assert.equal(evaluateSalaryTarget(job(), rule).eligible, true);
  assert.equal(evaluateSalaryTarget(job('base salary 20-30K/month', { currency: 'CNY' }), rule).eligible, true);
});

test('ordinary 20-30K/month without fixed-base wording stays pending', () => {
  const result = evaluateSalaryTarget(job('20-30K/月'), rule);
  assert.equal(result.eligible, false);
  assert.equal(result.pending, true);
  assert.equal(result.status, 'fixed_base_not_explicit');
});

test('legacy field cannot make ordinary monthly salary pass the new rule', () => {
  const result = evaluateSalaryTarget({ ...job('20-30K/月'), salary_20k_eligible: true }, rule);
  assert.equal(result.eligible, false);
  assert.equal(result.pending, true);
});

test('OTE, commission, total package, annual, foreign and unknown salaries remain pending', () => {
  for (const [raw, hints, overrides] of [
    ['OTE 20-30K/月', {}, {}],
    ['综合月薪20-30K，包含底薪和提成', {}, {}],
    ['固定底薪240-360K/年', {}, {}],
    ['fixed base salary USD 3-4K/month', {}, {}],
    ['面议', {}, {}],
  ]) assert.equal(evaluateSalaryTarget(job(raw, hints, overrides), rule).pending, true, raw);
  assert.equal(evaluateSalaryTarget(job('固定底薪20-30K/月', {}, { kind: 'commission' }), rule).status, 'variable_compensation');
});

test('crossing range needs confirmation, while fully below target is below_target', () => {
  assert.equal(evaluateSalaryTarget(job('固定底薪15-30K/月'), rule).status, 'range_crosses_target');
  assert.deepEqual(evaluateSalaryTarget(job('固定底薪18-19K/月'), rule), { eligible: false, pending: false, status: 'below_target', reason: 'fixed_monthly_base_is_below_20k' });
});

test('negative, conditional and unclear fixed-base wording cannot pass', () => {
  for (const salary_raw of ['非固定底薪20-30K/月', '底薪20K不保证/月', '底薪20-30K不保底/月', '底薪20-30K试用期减半/月', '绩效达标底薪20-30K/月', '有责底薪20-30K/月', '固定底薪20-30K/月，浮动组成另计']) {
    const result = evaluateSalaryTarget(job(salary_raw), rule);
    assert.equal(result.eligible, false, salary_raw);
    assert.equal(result.pending, true, salary_raw);
  }
});

test('invalid numeric bounds are rejected without coercion', () => {
  for (const overrides of [
    { min: '20000' }, { min: Number.NaN }, { max: Number.POSITIVE_INFINITY }, { min: -1 }, { min: 30000, max: 20000 }, { max: 2_000_000_000 },
  ]) assert.equal(evaluateSalaryTarget(job('固定底薪20-30K/月', {}, overrides), rule).status, 'invalid_salary_data');
});

test('a base-pay keyword cannot establish which amount is guaranteed', () => {
  for (const raw of ['月薪20-30K（含基本工资及绩效奖金）', '20-30K/月，底薪另议', '底薪20-30K/月，未达业绩目标扣减', '底薪20-30K/月含绩效', '20-30K/月，底薪不确定']) {
    const result = evaluateSalaryTarget(job(raw, { currency: 'CNY', period: 'month' }), rule);
    assert.equal(result.eligible, false, raw);
    assert.equal(result.pending, true, raw);
  }
  assert.equal(evaluateSalaryTarget(job('固定月薪20000元'), rule).eligible, true);
  assert.equal(evaluateSalaryTarget(job('人民币固定月薪：20-30K/月'), rule).eligible, true);
});

test('invalid rule does not widen eligibility and no mode keeps overview legacy behavior', () => {
  assert.equal(evaluateSalaryTarget(job(), { ...rule, currency: 'USD' }).status, 'unsupported_rule');
  assert.equal(evaluateSalaryTarget(job(), { mode: 'unknown', currency: 'CNY', period: 'month', min_fixed_monthly_base: 20000 }).status, 'unsupported_rule');
  assert.deepEqual(evaluateSalaryTarget({ ...job('20-30K/月'), salary_20k_eligible: true }), { eligible: true, pending: false, status: 'legacy_eligible', reason: 'legacy_salary_20k_eligible' });
  assert.equal(evaluateSalaryTarget({ ...job('20-30K/月'), salary_20k_eligible: false }).pending, false);
  assert.equal(evaluateSalaryTarget({ salary_raw: null, currency: null, period: 'unknown', status: 'unknown_not_disclosed', salary_20k_eligible: false }).pending, true);
});
