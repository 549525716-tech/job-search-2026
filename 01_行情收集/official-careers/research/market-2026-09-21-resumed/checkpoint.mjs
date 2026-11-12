import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const base = new URL('./', import.meta.url);
const bytes = await readFile(new URL('raw/l01.json', base));
const capture = JSON.parse(bytes);
const text = capture.result;
assert.equal(typeof text, 'string');
const pattern = /link Description: (.*?) 【 (.*?) 】 (.*?), Value: (liepin\.com\/(?:job|a)\/\d+\.shtml)/g;
const hits = [...text.matchAll(pattern)];
const cards = hits.map((hit, index) => {
  const block = text.slice(hit.index + hit[0].length, hits[index + 1]?.index ?? text.indexOf('text 加载中...', hit.index));
  const lines = [...block.matchAll(/\btext (.*)/g)].map(match => match[1]);
  const companyLine = lines.find(line => !/与您求职|根据你的行为/.test(line)) ?? null;
  const recruiter = lines.find(line => /(?:先生|女士)/.test(line)) ?? null;
  const salary = hit[3].match(/^\S+/)?.[0] ?? null;
  return {
    title: hit[1], city: hit[2], salary_raw: salary,
    experience_education_raw: hit[3].slice(salary?.length ?? 0).trim(),
    company_metadata_raw: companyLine, recruiter_display_raw: recruiter,
    url: `https://${hit[4]}`, source: '猎聘登录后首页推荐',
    observed_at: capture.observed_at, publication_date: null,
    jd_complete: false, description: null, fixed_base_verified: false,
    evidence_file: 'raw/l01.json', evidence_sha256: createHash('sha256').update(bytes).digest('hex'),
    status: 'card_only_pending_detail', novelty: 'not_compared_to_history'
  };
});
assert.equal(cards.length, 40, 'Reconcile against captured homepage, not market coverage');
assert.equal(new Set(cards.map(card => card.url)).size, 40);
assert.ok(cards.every(card => card.company_metadata_raw && card.recruiter_display_raw));
const cols = ['title', 'company_metadata_raw', 'salary_raw', 'city', 'experience_education_raw', 'recruiter_display_raw', 'url', 'observed_at', 'status'];
const csv = [cols, ...cards.map(card => cols.map(key => card[key]))].map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
await writeFile(new URL('cards.json', base), JSON.stringify(cards, null, 2) + '\n');
await writeFile(new URL('cards.csv', base), '\uFEFF' + csv + '\n');
const rows = cards.map(card => `| ${card.title.replaceAll('|', '/')} | ${card.company_metadata_raw} | ${card.salary_raw} | ${card.city} | [岗位入口](${card.url}) |`);
await writeFile(new URL('checkpoint.md', base), [
  '# 2026-09-21登录后采集检查点', '',
  '**状态：受阻，未完成行情交付。** 本轮实际保存40条猎聘卡片；不是40条新增岗位，也不是40份完整JD。',
  '已取得标题、薪酬原文、地区、公司展示信息及招聘联系人。完整JD、固定底薪与个人匹配均待核验。',
  '采集读取时间：' + capture.observed_at + '。不是职位发布时间。广告区间不是固定底薪承诺。',
  '', '## 当前阻塞', '',
  '猎聘登录后页面可读；自动控制连接注册后7.693秒顶层变成about:blank。原标签恢复一次后再次变空白，停止重试。BOSS普通标签恢复后未再接管。没有清Cookie、退出账号、提交简历或发消息。',
  '该现象指向自动控制接入后的兼容性问题，但没有证明具体导航发起者，不能声称根因已修复。',
  '', '## 待续范围', '',
  '登录后自动读取稳定性 → 完整JD → 大模型/具身智能商务/销售运营/企业服务销售检索 → MiniMax/月之暗面公司核查 → 行业公司回补 → 匹配与合并报告。以上未执行项不标完成。',
  '', '## 已保存卡片', '',
  '| 岗位 | 公司展示信息 | 薪资原文 | 地区 | 来源 |',
  '|---|---|---|---|---|', ...rows, ''
].join('\n'));
console.log(JSON.stringify({cards: cards.length, unique_urls: 40, complete_jd: 0, verified_fixed_base: 0, status: 'checkpoint_only', assertions: 'passed'}));
