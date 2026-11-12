import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSalary } from '../salary.mjs';

test('annual package and p.a. cannot be overridden by a monthly hint', () => {
  for (const raw of ['综合年包30-60万', 'CNY 30-60K p.a.']) {
    assert.equal(parseSalary(raw).salary_period, 'year');
    assert.equal(parseSalary(raw, { currency: 'CNY', period: 'month' }).salary_20k_eligible, false);
    assert.equal(parseSalary(raw, { currency: 'CNY', period: 'month' }).salary_status, 'ambiguous');
  }
});

test('OTE adjoining the numeric salary is still variable total compensation', () => {
  for (const raw of ['OTE30-60K/月', 'OTE 30-60K/月', 'OTE：30-60K/月']) {
    assert.equal(parseSalary(raw).salary_kind, 'ote');
    assert.equal(parseSalary(raw).salary_20k_eligible, false);
  }
});
