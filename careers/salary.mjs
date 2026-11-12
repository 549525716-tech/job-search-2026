const PERIODS = {
  month: /^(month|monthly|mo|\u6708|\u6708\u85aa)$/i,
  year: /^(year|yearly|annual|annually|annum|\u5e74|\u5e74\u85aa)$/i,
  day: /^(day|daily|\u65e5|\u5929|\u65e5\u85aa)$/i,
  hour: /^(hour|hourly|hr|\u5c0f\u65f6|\u65f6\u85aa)$/i,
};

function currencyHint(value) {
  const code = String(value ?? '').trim().toUpperCase();
  if (/^(CNY|RMB|CN\u00a5|\u00a5|\uffe5|\u4eba\u6c11\u5e01|\u5143)$/.test(code)) return 'CNY';
  if (/^(USD|US\$|\$|\u7f8e\u5143)$/.test(code)) return 'USD';
  if (/^(EUR|\u20ac|\u6b27\u5143)$/.test(code)) return 'EUR';
  if (/^(GBP|\u00a3|\u82f1\u9551)$/.test(code)) return 'GBP';
  return /^[A-Z]{3}$/.test(code) ? code : null;
}

function inferredCurrency(text) {
  const currencies = [];
  for (const code of ['CNY', 'USD', 'HKD', 'CAD', 'AUD', 'SGD', 'JPY', 'EUR', 'GBP', 'CHF', 'NZD', 'KRW', 'TWD', 'INR', 'VND', 'AED']) {
    if (new RegExp(`(?:^|[^a-z])${code}(?![a-z])`, 'i').test(text)) currencies.push(code);
  }
  for (const [code, pattern] of [
    ['USD', /\bUSD\b|US\$|\u7f8e\u5143/i], ['HKD', /\bHKD\b|HK\$|\u6e2f\u5e01|\u6e2f\u5143/i],
    ['CAD', /\bCAD\b|CA\$|\u52a0\u5143/i], ['AUD', /\bAUD\b|AU\$|\u6fb3\u5143/i],
    ['SGD', /\bSGD\b|S\$|\u65b0\u52a0\u5761\u5143/i], ['JPY', /\bJPY\b|\u65e5\u5143/i],
    ['EUR', /\bEUR\b|\u20ac|\u6b27\u5143/i], ['GBP', /\bGBP\b|\u00a3|\u82f1\u9551/i],
    ['CNY', /\b(?:CNY|RMB)\b|\u4eba\u6c11\u5e01/i],
  ]) if (pattern.test(text) && !currencies.includes(code)) currencies.push(code);
  if (currencies.length) return { currency: currencies.length === 1 ? currencies[0] : null, explicit: true, ambiguous: currencies.length > 1 };
  // A bare dollar sign does not identify USD, CAD, AUD, etc.; provider context may resolve it.
  if (/\$/.test(text)) return { currency: null, explicit: false, ambiguous: false };
  return { currency: /[\u00a5\u5143\u4e07\u5343\u85aa]|\/(?:\u6708|\u5e74|\u65e5|\u5929|\u5c0f\u65f6)/.test(text) ? 'CNY' : null,
    explicit: /[\u00a5\u5143]/.test(text), ambiguous: false };
}

function inferredPeriod(text, payMonths) {
  const periods = [];
  for (const [period, pattern] of [
    ['month', /\b(?:monthly|months?|mo)\b|\u6708\u85aa|(?:\/|\u6bcf)\s*\u6708/i],
    ['year', /\b(?:years?|yearly|annual|annually|annum|yr)\b|\bp\s*\.\s*a\s*\.|\u5e74\u85aa|\u5e74\u5305|(?:\/|\u6bcf)\s*\u5e74/i],
    ['day', /\b(?:days?|daily)\b|\u65e5\u85aa|(?:\/|\u6bcf)\s*(?:\u65e5|\u5929)/i],
    ['hour', /\b(?:hours?|hourly|hr)\b|\u65f6\u85aa|(?:\/|\u6bcf)\s*\u5c0f\u65f6/i],
  ]) if (pattern.test(text)) periods.push(period);
  return { period: periods.length === 1 ? periods[0] : periods.length ? 'unknown' : payMonths ? 'month' : 'unknown',
    explicit: periods.length > 0, ambiguous: periods.length > 1 };
}

function multiplier(unit) {
  if (/^(w|\u4e07(?:\u5143)?)$/i.test(unit ?? '')) return 10000;
  if (/^(k|\u5343(?:\u5143)?)$/i.test(unit ?? '')) return 1000;
  return 1;
}

// Values remain in the disclosed currency and period; eligibility never uses FX or annualization.
export function parseSalary(raw, hints = {}) {
  hints = hints && typeof hints === 'object' ? hints : {};
  const original = raw == null ? null : typeof raw === 'string' || typeof raw === 'number' ? String(raw) : null;
  const text = (original ?? '').normalize('NFKC').trim().replace(/[\u2010-\u2015\u2212~\u301c\uff5e]/g, '-');
  // Only a separately disclosed numeric range may be compared; never add commission to it.
  const additiveRange = text.match(/^((?:(?:CNY|RMB|人民币|[¥￥])\s*)?\d+(?:\.\d+)?\s*(?:K|W|万(?:元)?|千(?:元)?|元)?\s*-\s*\d+(?:\.\d+)?\s*(?:K|W|万(?:元)?|千(?:元)?|元)?\s*(?:\/\s*(?:月|年|month|year)|每月|每年)?\s*(?:[·*]\s*\d{1,2}薪)?)\s*\+\s*(?:提成|佣金|commission)\s*$/i);
  if (additiveRange) {
    const range = parseSalary(additiveRange[1], hints);
    return { ...range, salary_raw: original, salary_range_raw: additiveRange[1],
      salary_kind: 'range_plus_commission', salary_20k_eligible: false };
  }
  const inferred = inferredCurrency(text);
  const suppliedCurrency = hints.currency ?? hints.salary_currency;
  const suppliedPeriod = hints.period ?? hints.salary_period;
  const kind = /\bOTE(?![a-z])|on[ -]target earnings|\u76ee\u6807\u603b\u6536\u5165/i.test(text) ? 'ote'
    : /\bcommissions?\b|\u63d0\u6210|\u4f63\u91d1/i.test(text) ? 'commission' : 'base_or_unspecified';
  const result = {
    salary_raw: original, salary_currency: suppliedCurrency != null ? currencyHint(suppliedCurrency) : inferred.currency,
    salary_period: 'unknown', salary_min: null, salary_max: null, salary_pay_months: null,
    salary_kind: kind, salary_status: 'unknown_not_disclosed', salary_20k_eligible: false,
  };
  const months = [...text.matchAll(/(\d+(?:\.\d+)?)\s*\u85aa/g)];
  if (months.length === 1) result.salary_pay_months = Number(months[0][1]);
  const detectedPeriod = inferredPeriod(text, result.salary_pay_months);
  result.salary_period = suppliedPeriod != null
    ? Object.entries(PERIODS).find(([, pattern]) => pattern.test(String(suppliedPeriod).trim()))?.[0] ?? 'unknown'
    : detectedPeriod.period;
  const reject = (status) => ({ ...result, salary_min: null, salary_max: null, salary_status: status });
  const currencyConflict = suppliedCurrency != null && inferred.explicit && inferred.currency && result.salary_currency
    && inferred.currency !== result.salary_currency;
  const periodConflict = suppliedPeriod != null && detectedPeriod.explicit && result.salary_period !== 'unknown'
    && detectedPeriod.period !== result.salary_period;
  if (currencyConflict) result.salary_currency = null;
  if (periodConflict) result.salary_period = 'unknown';
  if (currencyConflict || periodConflict || inferred.ambiguous || detectedPeriod.ambiguous) return reject('ambiguous');
  if (!text || /\u9762\u8bae|\u5f85\u5b9a|\u672a\u516c\u5f00|\u4fdd\u5bc6|negotiable|not disclosed|competitive|^n\/?a$|^unknown$/i.test(text)) return result;
  if (/\b(?:infinity|nan)\b|\d\s*[eE][+-]?\d/i.test(text)
    || (months.length && (!Number.isFinite(result.salary_pay_months) || result.salary_pay_months <= 0))) return reject('invalid');
  if (months.length > 1 || (suppliedCurrency == null && inferred.ambiguous)) return reject('ambiguous');
  const amountsText = text.replace(/\d+(?:\.\d+)?\s*\u85aa/g, '')
    .replace(/\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b/g, (value) => value.replaceAll(',', ''))
    .replace(/(?:CNY|RMB|USD|HKD|CAD|AUD|SGD|JPY|EUR|GBP|CHF|NZD|KRW|TWD|INR|VND|AED)(?![a-z])|(?:US|HK|CA|AU|S)?\$|[\u00a5\u20ac\u00a3]|\u4eba\u6c11\u5e01|\u7f8e\u5143|\u6e2f\u5e01|\u6e2f\u5143|\u52a0\u5143|\u6fb3\u5143|\u65b0\u52a0\u5761\u5143|\u65e5\u5143|\u6b27\u5143|\u82f1\u9551/gi, '');
  const amounts = [...amountsText.matchAll(/(\d+(?:\.\d+)?)\s*(\u4e07\u5143|\u5343\u5143|[kw]|\u4e07|\u5343|\u5143)?/gi)];
  if (!amounts.length) return result;
  if (amounts.length > 2 || /[%+]|\u4ee5\u4e0a|\u4ee5\u4e0b|\u8d77|\b(?:from|up to|at least)\b/i.test(amountsText)) return reject('ambiguous');
  if (/-\s*$/.test(amountsText.slice(0, amounts[0].index))) return reject('invalid');
  if (amounts.length === 2) {
    const between = amountsText.slice(amounts[0].index + amounts[0][0].length, amounts[1].index);
    if (!/^\s*(?:-|\u81f3|to)\s*$/i.test(between)) return reject('ambiguous');
  }
  const first = amounts[0];
  const last = amounts.at(-1);
  if (!first[2] && !last[2] && suppliedCurrency == null && !inferred.explicit) return reject('unknown_unit');
  const minimum = Number(first[1]) * multiplier(first[2] ?? last[2]);
  const maximum = Number(last[1]) * multiplier(last[2] ?? first[2]);
  if (![minimum, maximum].every(Number.isFinite) || minimum < 0 || maximum < minimum) return reject('invalid');
  result.salary_min = minimum;
  result.salary_max = maximum;
  result.salary_status = 'parsed';
  result.salary_20k_eligible = result.salary_currency === 'CNY' && result.salary_period === 'month'
    && kind === 'base_or_unspecified' && maximum >= 20000;
  return result;
}
