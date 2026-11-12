import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { csvCell as csv } from '../../../../careers/overview.mjs';

const dir = dirname(fileURLToPath(import.meta.url));
const read = name => readFile(join(dir, name), 'utf8').then(JSON.parse);
const [index, coverage, run] = await Promise.all([read('search-index.json'), read('company-coverage.json'), read('report-run.json')]);
const displayTime = value => new Intl.DateTimeFormat('zh-CN', { timeZone:'Asia/Shanghai',dateStyle:'medium',timeStyle:'short' }).format(new Date(value));
run.started_at = displayTime(run.started_at);
run.finished_at = displayTime(run.finished_at) + '（北京时间）';
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeURL = value => { try { const u = new URL(value); return /^https?:$/.test(u.protocol) ? escape(u.href) : ''; } catch { return ''; } };
const text = value => String(value ?? '').replace(/[^]*/g, '');
const byQuery = new Map(index.captures.map(c => [c.capture_id, { ...c, results: [] }]));
for (const r of index.results) { assert(byQuery.has(r.capture_id)); byQuery.get(r.capture_id).results.push(r); }
const industries = new Map();
for (const q of byQuery.values()) {
  const companyRows = coverage.company_records.filter(c => c.queries.some(p => p.id === q.capture_id));
  q.industry = [...new Set(companyRows.flatMap(c => c.industry_labels_raw))].filter(Boolean).join(' / ')
    || (q.capture_id.startsWith('a') ? '行业发现' : q.capture_id.startsWith('b') ? '跨市场关键词' : '新发现或行业待核');
  if (!industries.has(q.industry)) industries.set(q.industry, []);
  industries.get(q.industry).push(q);
}
const entryHTML = r => {
  const url = safeURL(r.url);
  const heading = escape(text(r.title_raw || r.url || '未提取到标题').replace(/\s+/g, ' ').trim());
  return `<article class="entry"><h4 style="overflow-wrap:anywhere">${url ? `<a href="${url}" target="_blank" rel="noopener noreferrer">${heading}</a>` : heading}</h4><p class="muted">${escape(r.source_kind)} · ${escape(r.isolation?.status)} · 读取 ${escape(r.observed_at)}</p><details><summary>搜索返回原文</summary><pre>${escape(text(r.summary_raw))}</pre><p style="overflow-wrap:anywhere">证据：${escape(r.capture_file)} · ${escape(r.capture_sha256)}</p></details></article>`;
};
const groups = [...industries].sort(([a],[b]) => a.localeCompare(b,'zh')).map(([name, queries]) => `<details class="industry" open><summary><strong>${escape(name)}</strong><span>${queries.length}组查询</span></summary>${queries.map(q => `<details class="company" data-search="${escape((q.target_company + ' ' + q.query + ' ' + q.results.map(r => text(r.title_raw)+' '+text(r.summary_raw)).join(' ')).toLowerCase())}"><summary><b>${escape(q.target_company || q.query)}</b><span>${q.results.length}条检索线索</span></summary><p class="query">${escape(q.query)} · ${escape(q.capture_id)}</p><p class="muted">检索名称不是已核验的招聘雇主；同名、猎头、校招和旧页线索保留待核。</p>${q.results.map(entryHTML).join('')}</details>`).join('')}</details>`).join('');
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>全域检索线索 · 2026-09-22</title><style>
*{box-sizing:border-box}body{margin:0;background:#f5f6f7;color:#20282c;font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:0}main{max-width:1440px;margin:auto;padding:20px 24px}h1{font-size:24px;margin:0 0 8px}h4{font-size:15px;margin:0}a{color:#096f69;overflow-wrap:anywhere}p{margin:6px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;color:#36464f;margin:8px 0}.muted{font-size:12px;color:#65727b}.notice{border-left:3px solid #b0781b;padding:8px 12px;background:#fff8e9}.toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:14px 0;position:sticky;top:0;background:#f5f6f7;padding:10px 0;z-index:1}input{min-width:180px;flex:1;max-width:520px;padding:9px;border:1px solid #aeb7bf;border-radius:4px;font:inherit}button{border:1px solid #aeb7bf;background:white;padding:9px 12px;border-radius:4px;font:inherit;cursor:pointer}summary{cursor:pointer;overflow-wrap:anywhere}summary span{color:#687680;font-size:12px;margin-left:12px}.industry{border-top:2px solid #c8d1d5;margin:14px 0}.industry>summary{padding:10px 0;font-size:16px}.company{border-top:1px solid #dce2e5;background:white;padding:0 12px}.company>summary{padding:10px 0}.query{font-size:12px;color:#53626b}.entry{border-top:1px solid #e8ecee;padding:10px 0}.entry details{margin-top:5px}.entry summary{color:#53626b;font-size:13px}[hidden]{display:none!important}@media(max-width:640px){main{padding:14px 12px}h1{font-size:21px}.toolbar{position:static}input{max-width:none;flex-basis:100%}.company{padding:0 8px}summary span{display:block;margin-left:16px}}
</style><main><h1>全域检索线索</h1><p>${escape(run.started_at)} 至 ${escape(run.finished_at)}</p><p><b>${run.counts.company_queries_executed}/${run.counts.company_queries_planned}</b> 底册公司查询 · <b>${run.counts.new_company_queries_executed}/${run.counts.new_company_queries_planned}</b> 新发现名称回补 · <b>${index.counts.result_entries}</b> 条搜索返回 · <b>${index.counts.distinct_urls}</b> 个不同URL</p><p class="notice"><b>不是全市场岗位全集。</b>以下是检索线索，不等于完整JD或当前在招。薪资、雇主、发布日期及页面归属须在原页核验；隔离来源没有被自动接管。</p><p><a href="../../reports/decision-review.html">岗位主报告</a> · <a href="company-coverage.csv">公司覆盖表</a> · <a href="new-company-coverage.csv">新公司回补表</a> · <a href="search-results.csv">全部检索原文CSV</a> · <a href="summary.md">本轮执行说明</a></p><div class="toolbar"><input id="filter" type="search" placeholder="搜索公司、行业、岗位或正文关键词" aria-label="检索线索筛选"><button id="collapse">全部收起</button><button id="industries">展开行业</button><button id="companies">展开公司</button><span id="count" class="muted"></span></div>${groups}</main><script>
const companies=[...document.querySelectorAll('.company')],industries=[...document.querySelectorAll('.industry')];
const count=()=>document.querySelector('#count').textContent=companies.filter(c=>!c.hidden).length+'组查询可见';
document.querySelector('#filter').addEventListener('input',event=>{const value=event.target.value.trim().toLowerCase();for(const c of companies)c.hidden=!!value&&!c.dataset.search.includes(value);for(const i of industries){i.hidden=![...i.querySelectorAll('.company')].some(c=>!c.hidden);if(value&&!i.hidden)i.open=true}count()});
document.querySelector('#collapse').onclick=()=>document.querySelectorAll('details').forEach(d=>d.open=false);
document.querySelector('#industries').onclick=()=>{industries.forEach(d=>d.open=true);companies.forEach(d=>d.open=false)};
document.querySelector('#companies').onclick=()=>{industries.forEach(d=>d.open=true);companies.forEach(d=>d.open=true)};count();
</script></html>`;
assert(!html.includes('<script>alert('));
await writeFile(join(dir,'search-explorer.html'),html);
const fields=['result_id','capture_id','route','target_company','query','title_raw','url','source_kind','observed_at','summary_raw','capture_file','capture_sha256'];
await writeFile(join(dir,'search-results.csv'),'\ufeff'+[fields,...index.results.map(r=>fields.map(f=>r[f]))].map(row=>row.map(csv).join(',')).join('\r\n'));
console.log(JSON.stringify({queries:byQuery.size,results:index.results.length,industry_display_groups:industries.size,html:'search-explorer.html',csv:'search-results.csv'}));
