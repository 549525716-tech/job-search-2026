import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, REPORT_DIR, DATA_DIR } from './paths.mjs';
import { escapeHTML as e, safeURL, csvCell } from './sweep-report.mjs';
import { classifyRole } from './role-policy.mjs';

const labels = { official: '官网 / ATS', boss: 'BOSS', liepin: '猎聘', other_platform: '其他招聘平台', announcement: '招聘公告', open_web: '开放网页' };
const statuses = { pending: '待扫描', attempted: '已取得部分证据', blocked: '受限待接管', failed: '读取失败', complete: '部分来源范围完成', zero: '来源零结果', query_only: '仅搜索线索' };
const link = (url, label) => safeURL(url) ? `<a href="${e(safeURL(url))}" target="_blank" rel="noopener noreferrer">${e(label)}</a>` : '';

export function renderCoverageReport(campaign, jobs = [], generatedAt = new Date().toISOString()) {
  const names = new Map();
  for (const company of campaign.companies) {
    const key = company.display_name.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
    if (!names.has(key)) names.set(key, { name: company.display_name, ids: [], snapshots: new Set(), industries: new Set() });
    const row = names.get(key); row.ids.push(company.id); row.snapshots.add(company.snapshot_id);
    if (company.industry) row.industries.add(company.industry);
  }
  const rows = [...names.values()];
  const cells = new Map();
  for (const cell of campaign.ledger) cells.set(`${cell.company_id}:${cell.channel}`, cell);
  const byCompany = new Map();
  for (const job of jobs) {
    const key = String(job.company ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
    if (!byCompany.has(key)) byCompany.set(key, []); byCompany.get(key).push(job);
  }
  const companyHTML = rows.map((row) => {
    const jobRows = byCompany.get(row.name.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()) ?? [];
    const industry = [...new Set([...row.industries, ...jobRows.map((job) => job.industry).filter(Boolean)])].join('、') || '行业待核';
    return `<tr data-search="${e(`${row.name} ${industry}`.toLowerCase())}"><th scope="row">${e(row.name)}<small>${e(industry)} · 地位待核</small><small>原始岗位观察 ${jobRows.length}</small></th>${campaign.channels.map((channel) => {
      const observations = row.ids.map((id) => cells.get(`${id}:${channel}`)).filter(Boolean);
      const blocked = observations.some((cell) => cell.status === 'blocked');
      const attempted = observations.some((cell) => cell.attempted);
      const failed = observations.some((cell) => cell.status === 'failed');
      const entries = observations.flatMap((cell) => cell.evidence ?? []);
      const dates = observations.map((cell) => cell.last_observed).filter(Boolean).sort();
      const status = blocked ? 'blocked' : failed ? 'failed' : attempted ? 'attempted' : entries.length ? 'query_only' : 'pending';
      const urls = [...new Set(observations.flatMap((cell) => cell.raw_urls ?? []))];
      const queries = [...new Set(observations.flatMap((cell) => cell.actual_queries ?? []))];
      return `<td><strong class="status ${status}">${statuses[status]}</strong>${dates.length ? `<small>${e(dates.at(-1).slice(0, 10))}</small>` : ''}${entries.length ? `<details><summary>${entries.length} 条证据</summary>${queries.map((query) => `<p>${e(query)}</p>`).join('')}${urls.map((url) => `<p class="url">${link(url, url)}</p>`).join('')}<small>单个来源有结果不代表本渠道收全。</small></details>` : ''}</td>`;
    }).join('')}</tr>`;
  }).join('');
  const jobHTML = [...jobs].sort((a, b) => String(b.observed_at ?? '').localeCompare(String(a.observed_at ?? ''))).map((job) => {
    const fit = classifyRole(job);
    return `<article class="job" data-commercial="${fit.eligible ? 'yes' : 'no'}" data-search="${e([job.company, job.title, job.industry, job.city, job.description, job.requirements].join(' ').toLowerCase())}">
      <header><h3>${e(job.title || '标题待核')}</h3><strong>${e(job.salary_raw || '薪资未披露')}</strong></header>
      <p><b>${e(job.company)}</b> · ${e(job.city || job.location || '地点未披露')} · ${e(job.industry || '行业待核')}</p>
      <p class="muted">固定底薪：<b>本累计视图未评估</b> · ${job.description_complete ? '已取得职责及要求' : '仅线索 / JD不完整'} · 读取 ${e(job.observed_at || '时间未核')} · 当前在招状态待确认</p>
      ${job.attention ? `<p><b>关注：</b>${e(job.attention)}</p>` : ''}
      <p>${link(job.job_url, '职位链接')} ${link(job.apply_url, '申请入口')} ${link(job.source_url || job.board_url, '原始来源')}</p>
      <details><summary>职位内容与证据</summary><h4>${job.source_role_text ? '岗位原文（含定位）' : '工作内容'}</h4><pre>${e(job.source_role_text || job.description || '未取得')}</pre><h4>任职要求</h4><pre>${e(job.requirements || '未取得')}</pre><small>${e(job.evidence_file || '来源待核')} · ${e(job.scope_note || '')}</small></details>
    </article>`;
  }).join('');
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>行业岗位累计扫描</title><style>
*{box-sizing:border-box}body{margin:0;color:#20282b;background:#fff;font:14px/1.55 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;letter-spacing:0}main{padding:22px 24px;max-width:1600px;margin:auto}h1{font-size:24px;margin:0 0 7px}h2{font-size:19px}h3{font-size:16px;margin:0}h4{margin-bottom:5px}p{margin:6px 0}a{color:#006a68;margin-right:12px;overflow-wrap:anywhere}.muted,small{color:#606b70}small{display:block;font-size:12px}.notice{border-left:4px solid #ba710a;background:#fff8e7;padding:9px 12px;margin:12px 0}.metrics{display:flex;gap:24px;flex-wrap:wrap;padding:10px 0;border-bottom:1px solid #d9e0e2}.metrics b{font-size:22px;color:#006a68}.toolbar{display:flex;gap:15px;align-items:center;flex-wrap:wrap;padding:14px 0}input[type=search]{font:inherit;padding:8px 10px;width:340px;max-width:100%;border:1px solid #a5b0b5;border-radius:4px}.tabs{display:flex;gap:20px;border-bottom:1px solid #d9e0e2}.tabs button{border:0;background:none;padding:10px 0;font:inherit;font-weight:600;cursor:pointer;color:#586167}.tabs button[aria-selected=true]{border-bottom:3px solid #00817e;color:#006a68}table{border-collapse:collapse;width:100%;table-layout:fixed;font-size:13px}th,td{border-bottom:1px solid #e0e5e7;text-align:left;vertical-align:top;padding:11px 9px}thead th{background:#f1f5f5;font-weight:600}th:first-child{width:24%}tbody th{font-weight:600}details{margin-top:5px}summary{cursor:pointer;color:#006a68;font-size:13px}.status{font-size:12px;font-weight:500}.blocked,.failed{color:#a63d27}.attempted{color:#00766b}.query_only{color:#886300}.pending{color:#777}.url{overflow-wrap:anywhere;font-size:11px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;margin:5px 0}.job{padding:16px 0;border-bottom:1px solid #d9e0e2}.job header{display:flex;align-items:baseline;justify-content:space-between;gap:12px}.job header>strong{color:#a64627;font-size:16px}[hidden]{display:none!important}#empty{padding:20px 0;color:#777}@media(max-width:700px){main{padding:16px 12px}h1{font-size:22px}.metrics{gap:15px}.table-wrap{overflow:auto}table{min-width:870px}th:first-child{width:24%}.job header{flex-direction:column;gap:2px}.toolbar{gap:10px}input[type=search]{width:100%}}
</style></head><body><main><h1>行业岗位累计扫描</h1><p class="muted">已知公司逐渠道对账 · 开放来源 · ${e(generatedAt.slice(0, 10))}生成</p><div class="notice"><b>扫描尚未完成，市场总量未知。</b> 名录不等于正在招聘；同名公司仅作展示分组，未核验法律实体。BOSS与猎聘保留待采，安全验证前不自动访问。</div>
<div class="metrics"><span><b>${rows.length}</b> 公司 / 品牌名称</span><span><b>${jobs.length}</b> 岗位观察</span><span><b>${jobs.filter((job) => job.description_complete).length}</b> 职责与要求完整</span><span><b>20K+</b> 固定月薪目标，非达标统计</span></div>
<p><b>岗位观察不等于独立职位数：</b>保留跨日期记录及同页版本，未按标题去重；${jobs.filter((job) => job.suspected_variant_of).length} 条已标记疑似同页版本。行业大中小厂均需证据，未核验者不强行分层。</p>
<p><a href="coverage-campaign.json">覆盖JSON</a><a href="coverage-campaign.md">覆盖明细</a><a href="coverage-jobs.csv">岗位CSV</a><a href="personal-matches.html">个人匹配</a><a href="market-sweep.html">前批岗位研判</a></p>
<div class="toolbar"><input type="search" aria-label="搜索公司、行业、岗位正文" placeholder="公司、行业、岗位正文"><label id="commercial-control" hidden><input type="checkbox" id="commercial"> 仅商业相关候选</label><span id="count"></span></div>
<nav class="tabs" aria-label="报告视图"><button data-tab="companies" aria-selected="true">公司与渠道</button><button data-tab="jobs" aria-selected="false">全部岗位观察</button></nav>
<section id="companies"><div class="table-wrap"><table><thead><tr><th>行业 / 公司</th>${campaign.channels.map((channel) => `<th>${e(labels[channel] || channel)}</th>`).join('')}</tr></thead><tbody>${companyHTML}</tbody></table></div></section>
<section id="jobs" hidden>${jobHTML}</section><p id="empty" hidden>未找到符合筛选条件的记录。</p><p class="muted">历史记录保留原读取日期。来源受限、分页未完成、详情缺失不会记为零岗位或已收全。</p></main><script>
let tab='companies';const search=document.querySelector('input[type=search]'),commercial=document.querySelector('#commercial');
function update(){const needle=search.value.toLowerCase().trim();let shown=0;for(const row of document.querySelectorAll('#'+tab+' [data-search]')){row.hidden=!row.dataset.search.includes(needle)||(tab==='jobs'&&commercial.checked&&row.dataset.commercial!=='yes');if(!row.hidden)shown++}document.querySelector('#count').textContent=shown+' 条显示';document.querySelector('#empty').hidden=shown!==0}
for(const button of document.querySelectorAll('[data-tab]'))button.addEventListener('click',()=>{tab=button.dataset.tab;for(const name of ['companies','jobs'])document.getElementById(name).hidden=name!==tab;for(const item of document.querySelectorAll('[data-tab]'))item.setAttribute('aria-selected',String(item===button));document.querySelector('#commercial-control').hidden=tab!=='jobs';update()});search.addEventListener('input',update);commercial.addEventListener('change',update);update();
</script></body></html>`;
}

export async function loadCoverageJobs(campaign, directories, read = readFile) {
  const jobs = [];
  for (const directory of [...new Set(directories.map((value) => resolve(ROOT, value)))]) {
    if (!directory.startsWith(join(DATA_DIR, 'research') + sep)) throw new Error('RESEARCH_CHILD_DIRECTORY_REQUIRED');
    const path = join(directory, 'jobs.json');
    const receipt = (campaign.input_snapshots ?? []).flatMap((snapshot) => snapshot.files ?? []).find((file) => resolve(file.path) === path);
    if (!receipt?.sha256) throw new Error('JOBS_NOT_IN_FROZEN_COVERAGE_INPUT');
    const bytes = await read(path);
    if (createHash('sha256').update(bytes).digest('hex') !== receipt.sha256) throw new Error('JOBS_COVERAGE_SNAPSHOT_SHA_MISMATCH');
    const rows = JSON.parse(bytes);
    if (!Array.isArray(rows)) throw new Error('JOBS_ARRAY_REQUIRED');
    for (const [index, job] of rows.entries()) {
      jobs.push({ ...job, research_directory: relative(ROOT, directory), raw_observation_index: index });
    }
  }
  return jobs;
}

export async function writeCoverageReport(directories) {
  const campaign = JSON.parse(await readFile(join(REPORT_DIR, 'coverage-campaign.json'), 'utf8'));
  const jobs = await loadCoverageJobs(campaign, directories);
  await writeFile(join(REPORT_DIR, 'coverage-campaign.html'), renderCoverageReport(campaign, jobs));
  await writeFile(join(REPORT_DIR, 'coverage-jobs.json'), JSON.stringify(jobs, null, 2) + '\n');
  const columns = ['company','title','city','location','salary_raw','description','requirements','source_role_text','job_url','apply_url','source_url','source_kind','observed_at','description_complete','evidence_file','id'];
  await writeFile(join(REPORT_DIR, 'coverage-jobs.csv'), '\uFEFF' + [columns.map(csvCell).join(','), ...jobs.map((job) => columns.map((column) => csvCell(job[column] ?? '')).join(','))].join('\r\n'));
  return { jobs: jobs.length, html: join(REPORT_DIR, 'coverage-campaign.html') };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) writeCoverageReport(process.argv.slice(2)).then(console.log).catch((error) => { console.error(error); process.exitCode = 1; });
