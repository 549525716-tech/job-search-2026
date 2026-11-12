import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT } from '../paths.mjs';
import { captureLines, captureRange, bindDiscoveryQuote } from '../extract-coverage-captures.mjs';
test('web capture supports inline numbered lines without losing titles', () => {
  const lines = captureLines('Header\nL15: link L16: 大模型销售\nL17: \nL18: 内容');
  assert.equal(captureRange(lines, 16), '大模型销售');
  assert.equal(captureRange(lines, [16, 18]), '大模型销售\n\n内容');
  assert.throws(() => captureRange(lines, [18, 19]), /MISSING_SOURCE_LINE/);
  assert.throws(() => captureLines('L0: a\nL0: b'), /CONFLICTING_LINE/);
});
test('preserved real capture restores trailing responsibilities and shared requirements', async () => {
  const dir = join(ROOT, '01_行情收集/official-careers/research/sweep-2026-09-14-coverage');
  const jobs = JSON.parse(await readFile(join(dir, 'jobs.json')));
  for (const [id, file, field, line] of [
    ['firmior-l284-20260914', '206', 'description', 307],
    ['firmior-l284-20260914', '206', 'requirements', 321],
    ['huazheng-l419-20260914', '209', 'description', 429],
  ]) {
    const raw = JSON.parse(await readFile(join(dir, 'raw', file + '.json')));
    assert(jobs.find((j) => j.id === id)[field].includes(captureRange(captureLines(raw.result), line)));
  }
  const common = captureRange(captureLines(JSON.parse(await readFile(join(dir, 'raw/205.json'))).result), [13, 33]);
  const rows = jobs.filter((j) => j.id.startsWith('noumena-'));
  assert.equal(rows.length, 9);
  for (const job of rows) assert(job.requirements.includes(common));
  assert(jobs.find((j) => j.id === 'noumena-l59-20260914').source_role_text.includes('不是传统广告销售或纯客户维护岗'));
});
test('directory quotes cannot borrow another search result URL', () => {
  const text = 'Wrong (https://wrong.example/)\ncitesource0\nNo company--------------------\nRight\nMulti-line PDF title (https://right.example/)\ncitesource1\nAcme Co';
  const entry = { company_name: 'Acme Co', verbatim_quote: 'Acme Co', source_url: 'https://wrong.example/' };
  const fixed = bindDiscoveryQuote(text, entry);
  assert.equal(fixed.source_url, 'https://right.example/');
  assert.equal(fixed.original_source_url, entry.source_url);
  const ambiguous = text + '\n--------------------\nAnother (https://third.example/)\ncitesource2\nAcme Co';
  assert.equal(bindDiscoveryQuote(ambiguous, entry), null);
  assert.equal(bindDiscoveryQuote(ambiguous, entry, 'https://right.example/').source_url, 'https://right.example/');
  assert.equal(bindDiscoveryQuote(text, { ...entry, verbatim_quote: 'Missing' }), null);
});
