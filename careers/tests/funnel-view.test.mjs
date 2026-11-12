import test from 'node:test';
import assert from 'node:assert/strict';
import { renderFunnelSection, renderFunnelMarkdown } from '../funnel-view.mjs';

const base = {
  schema_version: 1, generated_at: '2026-09-10T00:00:00Z', scope: 'test', reporting_window: { from: '2026-09-01', to: '2026-09-10' },
  summary: { policies_verified: 1, industries: 1, companies: 1, traceable_jobs: 1, salary_eligible: 0, assessment_pending: 1 }, boundaries: ['只展示证据，不推断订单'],
  policies: [{ id: 'p1', title: '人工智能政策', authority: '主管部门', document_kind: '通知', issued_at: '2026-09-01', published_at: '2026-09-02', effective_at: '2026-09-03', source_url: 'https://gov.example/p', evidence_status: 'observed', observation_kind: 'baseline', excerpt: '政策摘录', evidence: [{ url: 'https://gov.example/p', body_path: '01_行情收集/official-careers/raw/p.html', metadata_path: '01_行情收集/official-careers/raw/p.json', sha256: 'abc', captured_at: '2026-09-10' }], risk_notes: ['待实施核验'] }],
  industries: [{ id: 'ai', name: 'AI', policy_ids: ['p1'], demand_hypothesis: '企业服务需求', limitations: ['假设'] }],
  companies: [{ id: 'c1', name: '示例公司', industry_ids: ['ai'], tier: '观察', tier_basis: '官网自述', source_url: 'https://example.com', careers_url: 'https://example.com/careers', evidence_status: 'self_reported', business_excerpt: '公司自述摘录', evidence: [{ url: 'https://example.com/about', body_path: '01_行情收集/official-careers/raw/company.html' }], job_keys: ['j1'], notes: '公司备注' }],
  opportunities: [{ job_key: 'j1', company_name: '示例公司', title: 'AI销售', location_raw: '上海', salary_raw: '面议', job_url: 'https://example.com/job', application_url: 'mailto:jobs@example.com', description_text: '第一行\n客户方案与交付', published_at: '2023-01-01', hiring_active: 'unknown', source_job_id: 'bl-1', policy_ids: ['p1'], industry_ids: ['ai'], source_checked_at: '2026-09-10', source_health: 'healthy', description_complete: true, salary_target: { eligible: false, pending: true, status: 'pending', reason: '未披露固定底薪' }, career_fit: { path: 'transferable', reason: '需要确认', direct_evidence: ['销售'], transferable_evidence: ['To B'], gaps: ['AI交付'], questions: ['项目规模'] }, evidence: [{ url: 'https://example.com/job', body_path: '01_行情收集/official-careers/raw/j.html', metadata_path: '01_行情收集/official-careers/raw/j.json', sha256: 'def', captured_at: '2026-09-10' }] }],
  issues: [{ id: 'i1', status: 'open', reason: '待核验' }],
};

test('renders the four-stage chain, expandable JD, and explicit salary/boundary semantics', () => {
  const html = renderFunnelSection(base);
  const markdown = renderFunnelMarkdown(base);
  for (const label of ['政策', '赛道', '公司', '岗位机会', '完整 JD 与来源', '首次建立基线不等于本周新政策。', '公司自述不等于已证实头部或稳定。', '薪资待核，不算合格']) assert(html.includes(label));
  assert(html.includes('客户方案与交付'));
  assert(html.includes('政策依据与风险'));
  assert(html.includes('公司自述摘录') && html.includes('公司备注'));
  assert(html.includes('职位发布日期：2023-01-01') && html.includes('最近观察：2026-09-10'));
  assert(html.includes('来源岗位 ID：bl-1') && html.includes('mailto:jobs@example.com'));
  assert(/<tr class="opportunity-summary">[\s\S]*?<\/tr>\s*<tr class="opportunity-detail"><td colspan="5"><details>/.test(html));
  const opportunitySummary = html.match(/<tr class="opportunity-summary">[\s\S]*?<\/tr>/)?.[0] || '';
  assert(!opportunitySummary.includes('<details>'));
  assert(html.includes('已核验政策：1') && html.includes('可追溯岗位：1') && html.includes('待评估：1'));
  assert(markdown.includes('## 政策') && markdown.includes('## 赛道') && markdown.includes('## 公司') && markdown.includes('## 岗位机会'));
  assert(markdown.includes('薪资结论：薪资待核，不算合格'));
  assert(markdown.includes('第一行'));
  assert(markdown.includes('职位发布日期：2023-01-01') && markdown.includes('来源健康/最近观察：healthy / 2026-09-10'));
  assert(markdown.includes('公司自述摘录') && markdown.includes('公司备注'));
});

test('escapes HTML and rejects XSS, credential URLs, and evidence path escape', () => {
  const hostile = structuredClone(base);
  hostile.opportunities[0].title = '<script>alert(1)</script>';
  hostile.opportunities[0].description_text = '<img src=x onerror=alert(1)>';
  hostile.opportunities[0].job_url = 'javascript:alert(1)';
  hostile.opportunities[0].evidence = [{ url: 'https://user:pass@evil.example/x', body_path: '../outside.html', metadata_path: '01_行情收集/official-careers/raw/ok.json' }];
  const html = renderFunnelSection(hostile);
  assert(!html.includes('<script>alert(1)</script>'));
  assert(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert(!html.includes('href="javascript:'));
  assert(!html.includes('user:pass@evil.example'));
  assert(!html.includes('outside.html'));
  assert(html.includes('raw/ok.json'));
  const markdown = renderFunnelMarkdown(hostile);
  assert(!markdown.includes('](javascript:'));
  assert(!markdown.includes('../outside.html'));
});

test('handles empty data and unknown salary without throwing', () => {
  const html = renderFunnelSection({});
  const markdown = renderFunnelMarkdown({ opportunities: [{ title: '未知薪资', salary_target: {} }] });
  assert(html.includes('暂无数据'));
  assert(html.includes('无汇总数据'));
  assert(markdown.includes('薪资结论：不合格或未知'));
});
