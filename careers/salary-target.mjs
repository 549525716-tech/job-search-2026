const FIXED_BASE_MARKER = /(?:固定(?:月薪|底薪|薪资|工资)|月固定(?:薪资|工资)|底薪|基本工资|基础工资|fixed\s+(?:monthly\s+)?(?:salary|pay|base)|monthly\s+base(?:\s+salary)?|base\s+(?:salary|pay))/i;
const NEGATED_BASE = /(?:非固定|无|没有|不含|不设|不提供)\s*(?:固定底薪|底薪|基本工资|固定薪资|base\s+salary|base\s+pay)|不保底|(?:底薪|固定底薪|base\s+salary|base\s+pay)[^。；，,\n]{0,12}(?:不保证|not\s+guaranteed|non[- ]?guaranteed)|(?:base\s+salary|base\s+pay)\s*(?:is\s+)?(?:not\s+guaranteed|non[- ]?guaranteed)|not\s+guaranteed\s+(?:base|salary)|无底薪/i;
const CONDITIONAL_BASE = /(?:绩效达标|达到绩效|有责底薪|浮动底薪|浮动条件(?:底薪|工资)?|试用期(?:内)?[^。；，,\n]{0,12}(?:减半|折半)|底薪[^。；，,\n]{0,20}试用期[^。；，,\n]{0,12}(?:减半|折半)|conditional\s+base|performance[- ]based\s+base|base\s+(?:salary|pay)\s+(?:subject\s+to|depending\s+on|conditional))/i;
const VARIABLE_TOTAL = /\bOTE\b|on[ -]target earnings|目标总收入|综合(?:月薪|年包|薪资|收入)|总(?:收入|包)|提成奖金总包|浮动(?:组成|收入|薪资|工资)/i;
const ANNUAL = /\b(?:annual|annually|annum|yearly|per\s+year|p\.?a\.?)\b|年薪|年包|每年|\/年/i;
const MAX_REASONABLE_AMOUNT = 1_000_000_000;
export const SALARY_TARGET_VERSION = '2026-09-22-opportunity-range-v4';
const amount = String.raw`\d+(?:,\d{3})*(?:\.\d+)?\s*(?:K|W|万(?:元)?|千(?:元)?|元)?`;
const currency = String.raw`(?:CNY|RMB|人民币|[¥￥])?\s*`;
// Only a complete, simple base-pay statement can bind the amount to fixed pay.
const explicitBaseStatement = new RegExp(String.raw`^${currency}${FIXED_BASE_MARKER.source}\s*[:：]?\s*${currency}${amount}(?:\s*(?:[-–—~至]|to)\s*${amount})?\s*(?:元)?\s*(?:/\s*(?:月|month|mo)|每月|per\s+month|monthly)?\s*(?:[·*]\s*\d{1,2}薪)?\s*[。.]?$`, 'i');

function field(job, name, legacyName) {
  return job?.[name] ?? job?.[legacyName];
}

function validBounds(min, max) {
  return typeof min === 'number' && typeof max === 'number'
    && Number.isFinite(min) && Number.isFinite(max)
    && min >= 0 && max >= 0 && min <= max
    && min <= MAX_REASONABLE_AMOUNT && max <= MAX_REASONABLE_AMOUNT;
}

function legacyEvaluation(job) {
  const raw = field(job, 'salary_raw', 'raw');
  const currency = field(job, 'currency', 'salary_currency');
  const period = field(job, 'period', 'salary_period');
  const status = field(job, 'status', 'salary_status');
  const kind = field(job, 'kind', 'salary_kind');
  const pending = !raw || status !== 'parsed' || period !== 'month' || currency !== 'CNY'
    || Boolean(kind && kind !== 'base_or_unspecified');
  const eligible = job?.salary_20k_eligible === true;
  return {
    eligible,
    pending,
    status: eligible ? 'legacy_eligible' : pending ? 'legacy_pending' : 'legacy_ineligible',
    reason: eligible ? 'legacy_salary_20k_eligible' : pending ? 'legacy_overview_pending' : 'legacy_rule_not_eligible',
  };
}

function pending(status, reason) {
  return { eligible: false, pending: true, status, reason };
}

/** Evaluate the current fixed monthly base salary target without changing legacy salary parsing. */
export function evaluateSalaryTarget(job = {}, rule = {}) {
  const hasMode = rule !== null && typeof rule === 'object' && Object.prototype.hasOwnProperty.call(rule, 'mode');
  if (!hasMode || rule.mode == null) return legacyEvaluation(job);
  if (rule.mode === 'advertised_monthly_range') {
    const fixedBase = evaluateSalaryTarget(job, {mode:'fixed_monthly_base_minimum',currency:'CNY',period:'month',min_fixed_monthly_base:20000});
    const min=field(job,'min','salary_min'), max=field(job,'max','salary_max');
    const raw=String(field(job,'salary_raw','raw')??'');
    if (rule.currency !== 'CNY' || rule.period !== 'month' || rule.min_monthly_opportunity !== 20000) return pending('unsupported_rule','invalid_opportunity_rule');
    const known=field(job,'status','salary_status')==='parsed' && field(job,'currency','salary_currency')==='CNY'
      && field(job,'period','salary_period')==='month' && validBounds(min,max) && !VARIABLE_TOTAL.test(raw)
      && !ANNUAL.test(raw) && !['ote','commission'].includes(field(job,'kind','salary_kind'));
    if (!known) return {...pending('opportunity_pending','monthly_range_not_comparable'),fixed_base:fixedBase};
    const eligible=max>=rule.min_monthly_opportunity;
    return {eligible,pending:false,status:eligible?'range_eligible':'below_target',reason:eligible?'advertised_monthly_range_reaches_20k_not_fixed_base_confirmation':'advertised_monthly_upper_bound_below_20k',fixed_base:fixedBase};
  }
  if (rule.mode !== 'fixed_monthly_base_minimum') return pending('unsupported_rule', 'unknown_salary_target_mode');
  if (rule.currency !== 'CNY' || rule.period !== 'month' || rule.min_fixed_monthly_base !== 20000) {
    return pending('unsupported_rule', 'salary_target_rule_must_be_cny_month_20k_fixed_base');
  }

  const raw = field(job, 'salary_raw', 'raw');
  const text = typeof raw === 'string' ? raw.normalize('NFKC').trim() : '';
  const currency = field(job, 'currency', 'salary_currency');
  const period = field(job, 'period', 'salary_period');
  const status = field(job, 'status', 'salary_status');
  const kind = field(job, 'kind', 'salary_kind');
  const min = field(job, 'min', 'salary_min');
  const max = field(job, 'max', 'salary_max');

  if (status !== 'parsed' || !text) return pending('insufficient_evidence', 'salary_is_not_parsed_or_not_disclosed');
  if (currency !== 'CNY') return pending('currency_mismatch', 'salary_currency_is_not_cny');
  if (period !== 'month') return pending('period_mismatch', 'salary_period_is_not_month');
  if (!validBounds(min, max)) return pending('invalid_salary_data', 'salary_bounds_must_be_finite_nonnegative_numbers');

  if (NEGATED_BASE.test(text)) return pending('negative_base_evidence', 'fixed_base_is_explicitly_not_guaranteed_or_excluded');
  if (VARIABLE_TOTAL.test(text) || ['ote', 'commission', 'range_plus_commission'].includes(kind)) return pending('variable_compensation', 'salary_is_ote_or_commission_or_variable_total_compensation');
  if (ANNUAL.test(text)) return pending('non_monthly_compensation', 'salary_is_annual_or_yearly');
  if (CONDITIONAL_BASE.test(text)) return pending('conditional_base', 'base_salary_depends_on_performance_or_variable_conditions');
  if (!FIXED_BASE_MARKER.test(text)) return pending('fixed_base_not_explicit', 'original_text_does_not_explicitly_identify_fixed_monthly_base');
  if (!explicitBaseStatement.test(text)) return pending('base_amount_unconfirmed', 'amount_is_not_bound_to_a_simple_explicit_fixed_base_statement');

  if (min < rule.min_fixed_monthly_base) {
    if (max >= rule.min_fixed_monthly_base) return pending('range_crosses_target', 'fixed_base_range_crosses_20k_and_needs_confirmation');
    return { eligible: false, pending: false, status: 'below_target', reason: 'fixed_monthly_base_is_below_20k' };
  }
  return { eligible: true, pending: false, status: 'eligible', reason: 'explicit_fixed_monthly_base_minimum_meets_20k' };
}
