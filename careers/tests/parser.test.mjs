import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNuxtLiteral } from '../structured-script.mjs';
import { jobKey, normalizeJob } from '../normalize.mjs';

test('literal Nuxt data is decoded without evaluating JavaScript', () => {
  const parsed = parseNuxtLiteral('window.__NUXT__=(function(a,b){return {data:{title:a,empty:b,items:[1,true,null]}}})("销售","");');
  assert.equal(parsed.data.title, '销售');
  assert.deepEqual(parsed.data.items, [1, true, null]);
});

test('Nuxt scripts cannot execute calls or mutate prototypes', () => {
  for (const script of [
    'window.__NUXT__ = fetch("https://attacker.example/");',
    'window.__NUXT__ = {__proto__: {admin:true}};',
    'window.__NUXT__ = {a: globalThis};',
    'window.__NUXT__ = {}; alert(1);',
    'window.__NUXT__=(function(){throw "boom"})()',
  ]) assert.throws(() => parseNuxtLiteral(script), script);
});

test('native source IDs keep jobs with the same title distinct', () => {
  assert.notEqual(jobKey('source', 'tenant', '1'), jobKey('source', 'tenant', '2'));
  assert.notEqual(jobKey('s:x', 't', '1'), jobKey('s', 'x:t', '1'));
  assert.throws(() => jobKey('s', 't', ''));
});

test('unknown publication timezone and salary are not invented', () => {
  const company = { source_id: 'source', tenant: 'tenant', company_id: 'company', company_name: 'Test', legal_name: 'Test', provider: 'static' };
  const raw = { source_job_id: '42', title: '客户成功经理', responsibilities: '维护客户', requirements: '客户经营经验', description_text: '岗位职责\n维护客户\n任职要求\n客户经营经验', published_raw: '2023-08-23', published_date: '2023-08-23', updated_raw: '2026-09-09 12:00:00', location_raw: '广州' };
  const result = normalizeJob(raw, company, { finished_at: '2026-09-09T12:00:00Z', url: 'https://example.com/jobs' });
  assert.equal(result.published_at, '2023-08-23');
  assert.equal(result.published_at_timezone, null);
  assert.equal(result.source_timestamp_timezone, null);
  assert.equal(result.salary_raw, null);
  assert.equal(result.salary_max, null);
  assert.equal(result.hiring_active, 'unknown');
  assert.notEqual(result.published_at, result.first_seen_at);
  assert.throws(() => normalizeJob({ ...raw, requirements: '' }, company, {}), /Full job/);
});
