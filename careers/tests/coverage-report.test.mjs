import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { DATA_DIR } from '../paths.mjs';
import { renderCoverageReport, loadCoverageJobs } from '../coverage-report.mjs';

const campaign = { channels: ['official', 'boss'], companies: [{ id: 'a', display_name: '公司甲', snapshot_id: 'old' }, { id: 'b', display_name: '公司甲', snapshot_id: 'new' }], ledger: [
  { company_id: 'a', channel: 'official', status: 'attempted', attempted: true, evidence: [], raw_urls: [], last_observed: '2025-01-01T00:00:00Z' },
  { company_id: 'b', channel: 'boss', status: 'blocked', attempted: false, evidence: [], raw_urls: [] },
] };
test('coverage report groups display names but keeps raw vacancies and dates', () => {
  const jobs = ['hr-a', 'hr-b'].map((id) => ({ id, title: '销售经理', company: '公司甲', salary_raw: '15-30K', source_kind: 'search_index', description_complete: false, observed_at: '2025-01-01' }));
  const html = renderCoverageReport(campaign, jobs, '2026-09-14');
  assert.equal((html.match(/class="job"/g) ?? []).length, 2);
  assert.equal((html.match(/<th scope="row">/g) ?? []).length, 1);
  assert.match(html, /受限待接管/);
  assert.match(html, /2025-01-01/);
  assert.match(html, /未核验法律实体/);
  assert.match(html, /仅线索 \/ JD不完整/);
});
test('untrusted job and source content remains text; unsafe links are dropped', () => {
  const html = renderCoverageReport(campaign, [{ title: '<script>bad()</script>', company: '未知', description: '</pre><script>steal()</script>', source_url: 'javascript:alert(1)', apply_url: 'https://user:password@example.com', salary_raw: '未知' }]);
  assert(!html.includes('<script>bad()'));
  assert(!html.includes('<script>steal()'));
  assert(!html.includes('href="javascript:'));
  assert(!html.includes('user:password'));
  assert.match(html, /&lt;script&gt;bad/);
});
test('rendering never truncates raw jobs at 20 or 25', () => {
  const html = renderCoverageReport(campaign, Array.from({ length: 105 }, (_, id) => ({ id, title: '陌生岗位'+id, company: '公司甲' })));
  assert.equal((html.match(/class="job"/g) ?? []).length, 105);
  assert.match(html, /陌生岗位104/);
});

test('writer loader retains missing IDs, different HRs and channels across snapshots', async () => {
  const a = join(DATA_DIR, 'research', 'fixture-a');
  const b = join(DATA_DIR, 'research', 'fixture-b');
  const files = new Map([
    [join(a, 'jobs.json'), JSON.stringify([{ title: '销售', recruiter_id: '1', source_kind: 'boss' }, { title: '销售', recruiter_id: '2', source_kind: 'boss' }, { title: '销售', source_kind: 'liepin' }])],
    [join(b, 'jobs.json'), JSON.stringify([{ title: '销售', source_kind: 'official' }])],
  ]);
  const snapshot = { input_snapshots: [{ files: [...files].map(([path, content]) => ({ path, sha256: createHash('sha256').update(content).digest('hex') })) }] };
  const reader = async (path) => files.get(path);
  const rows = await loadCoverageJobs(snapshot, [a, b, a], reader);
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.map((job) => job.recruiter_id), ['1', '2', undefined, undefined]);
  files.set(join(a, 'jobs.json'), '[]');
  await assert.rejects(loadCoverageJobs(snapshot, [a], reader), /SHA_MISMATCH/);
  await assert.rejects(loadCoverageJobs({ input_snapshots: [] }, [a], reader), /NOT_IN_FROZEN/);
});

test('unwired salary assessment is unknown, never a fabricated zero count', () => {
  const html = renderCoverageReport(campaign, [{ company: '公司甲', salary_raw: '固定月薪人民币25000元', salary_confirmed: true }]);
  assert.match(html, /本累计视图未评估/);
  assert.match(html, /非达标统计/);
  assert(!html.includes('已确认固定底薪20K+'));
});
