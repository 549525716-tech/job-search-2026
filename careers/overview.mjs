import { access, readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ROOT, REPORT_DIR, repoRelative, evidenceAbsolute } from './paths.mjs';
import { evaluateSalaryTarget } from './salary-target.mjs';
import { buildFunnel, writeFunnelSnapshot, funnelReportFiles } from './funnel.mjs';
import { renderFunnelSection } from './funnel-view.mjs';
import { classifyRole } from './role-policy.mjs';
import { getIndustryAnnotation, groupJobsByIndustry } from './industry-view.mjs';
import { annotateOpportunities } from './opportunity-identity.mjs';

export const escapeHTML = (text) => String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export function safeURL(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password ? u.href : ''; }
  catch { return ''; }
}
const statusName = (status) => ({ success: '完整采集', empty: '完整扫描无岗位', partial: '部分采集', failed: '采集失败', running: '运行中', unscanned: '尚未采集', blocked: '来源受限' })[status] ?? status;
const effectiveStatus = (run) => !run ? 'unscanned' : ['success', 'empty'].includes(run.status) && run.complete !== true ? 'partial' : run.status;
const sourceStatus = (run, sources) => {
  const source = sources.find((entry) => entry.source_id === run?.source_id);
  return source?.halted_reason || source?.source_health === 'halted_pending_review' ? 'blocked' : effectiveStatus(run);
};
const markdownURL = (url) => safeURL(url).replace(/[()[\]]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
const markdown = (text) => String(text ?? '').replace(/[\r\n]+/g, ' ').replace(/([\\`*_{}[\]()#+.!|<>])/g, '\\$1');
const link = (label, url) => safeURL(url) ? `<a href="${escapeHTML(safeURL(url))}" target="_blank" rel="noopener noreferrer">${escapeHTML(label)}</a>` : escapeHTML(label);
const reviewLabel = (analysis) => analysis.semantic_review_status === 'approved' ? '已复核' : analysis.semantic_review_status === 'rejected' ? '复核未通过，需修订' : '草稿待复核';
const salaryReasonLabel = (reason) => {
  const normalized = String(reason ?? '').toLowerCase().replaceAll('_', ' ');
  if (/salary is not parsed or not disclosed|not parsed|not disclosed|undisclosed/.test(normalized)) return '未披露固定底薪';
  if (normalized.includes('below 20k')) return '固定底薪低于20K';
  if (normalized.includes('range crosses')) return '固定底薪区间跨20K，待确认';
  return '固定底薪待核';
};
const leadEvidenceStatusLabel = (status) => ({ search_index_only: '搜索索引线索，非在招核验', observed: '已观察', pending: '待核验' })[status] ?? '证据状态待核验';
const roleStatusLabel = (status) => ({ primary: '主方向', adjacent: '相邻方向', exploratory: '探索方向', excluded: '不纳入', complete: '已完成', not_run: '本轮未启动', stale_or_invalid: '输入变更或证据失效' })[status] ?? '状态待核';
const discoveryStatusLabel = (status) => ({ queued: '已核入口，待扫描', needs_verification: '雇主/来源待核', blocked: '既有访问限制，未重试', unsupported: '待适配', partial: '部分取得，待续', success: '声明范围对账完成', verified_empty: '声明范围核验为空', failed: '采集失败', seeded: '种子公司' })[status] ?? '新发现待核';

export function csvCell(value) {
  let text = String(value ?? '');
  if (/^[\s\uFEFF]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function recallJob(job, preferences) {
  const fit = classifyRole(job, preferences);
  if (['closed', 'missing_pending_review'].includes(job.hiring_active)) return false;
  return Boolean(fit?.eligible || fit?.review_required === true || fit?.tier === 'review');
}

function localHref(repoPath) {
  try { return relative(REPORT_DIR, evidenceAbsolute(repoPath)).split('/').map(encodeURIComponent).join('/'); }
  catch { return null; }
}

function localEvidenceLink(label, repoPath) {
  const href = localHref(repoPath);
  return href ? `<a href="${escapeHTML(href)}">${escapeHTML(label)}</a>` : escapeHTML(label);
}

export function buildOverview({ jobs, runs, sources = [], companies, events = [], analyses = [], preferences, classifications = [], discovery = {}, market_leads = [], headhunter = {}, generatedAt = new Date().toISOString() }) {
  const assessments = new Map(analyses.map((entry) => [entry.job_key, entry]));
  const rows = annotateOpportunities(jobs).map((job) => {
    const company = companies.find((c) => c.id === job.company_id);
    const sourceRuns = runs.filter((r) => r.source_id === job.source_id).sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at));
    const latest = sourceRuns[0];
    const role_fit = classifyRole(job, preferences) ?? { eligible: false, tier: '未知', category: '未知', reason: '角色政策未返回结果' };
    const reviewRequired = Boolean(role_fit.review_required === true || role_fit.tier === 'review');
    const candidate = Boolean(role_fit.eligible) && !reviewRequired;
    const recalled = candidate || reviewRequired;
    const salaryTarget = evaluateSalaryTarget(job, preferences.salary);
    const groupSource = ['tencent-cloud', 'aliyun', 'volcengine'].includes(job.company_id);
    const explicitAISignal = /大模型|人工智能|\bAI\b|MaaS|\bAgent\b|机器学习/i.test(`${job.title} ${job.department ?? ''} ${job.description_text}`);
    const ai = explicitAISignal || (Boolean(company?.ai_related) && !groupSource);
    const industry = getIndustryAnnotation(job, company ?? {}, classifications);
    return { ...job, ...industry, candidate, recalled, review_required: reviewRequired, role_fit, ai_related: ai,
      ai_relation_basis: explicitAISignal ? 'source_JD_keyword_signal_not_employer_tier_proof' : company?.ai_related && !groupSource ? 'configured_company_business_context' : 'not_established', analysis: assessments.get(job.job_key) ?? null,
      salary_legacy_20k_eligible: job.salary_20k_eligible, salary_20k_eligible: salaryTarget.eligible,
      salary_target_status: salaryTarget.status, salary_target_reason: salaryTarget.reason,
      source_health: sourceStatus(latest, sources), source_checked_at: latest?.finished_at ?? null,
      source_stale_warning: Boolean(latest && !['success', 'empty'].includes(sourceStatus(latest, sources))),
      views: [...(candidate ? ['all'] : []), ...(candidate && ai ? ['ai'] : []), ...(candidate && salaryTarget.eligible ? ['salary'] : []), ...(candidate && salaryTarget.pending ? ['unknown'] : []), ...(reviewRequired ? ['review'] : []), 'raw'] };
  });
  const roleCategoryRank = (category) => ({
    '销售及商业化运营': 0, '销售与大客户': 1, '商务生态渠道': 2, '市场营销': 3,
    '业务型售前及解决方案': 5, '客户成功与客户经营': 6, '技术或交付探索': 9,
  })[category] ?? 7;
  rows.sort((a, b) => Number(b.candidate) - Number(a.candidate)
    || roleCategoryRank(a.role_fit?.category) - roleCategoryRank(b.role_fit?.category)
    || Number(b.ai_related) - Number(a.ai_related)
    || (b.analysis?.score ?? -1) - (a.analysis?.score ?? -1) || a.company_name.localeCompare(b.company_name));
  const companyById = new Map(companies.map((company) => [company.id, company]));
  for (const discovered of (Array.isArray(discovery?.companies) ? discovery.companies : [])) {
    const id = discovered.source?.company_id || discovered.company_id_hint || discovered.id || discovered.company_id || discovered.employer_entity_id || discovered.queue_id || discovered.identity?.company_id;
    if (id) companyById.set(id, { ...companyById.get(id), id, name: discovered.name || discovered.company_name || id,
      sector: discovered.sector || discovered.industry || companyById.get(id)?.sector, homepage: discovered.homepage || companyById.get(id)?.homepage, careers_url: discovered.careers_url || companyById.get(id)?.careers_url,
      discovery_status: discovered.status || 'discovered_unverified', discovery_record: discovered });
  }
  for (const row of rows) if (!companyById.has(row.company_id)) companyById.set(row.company_id, { id: row.company_id, name: row.company_name, sector: row.sector, homepage: row.company_homepage, careers_url: row.careers_url, discovery_status: 'discovered_unverified' });
  const radar = [...companyById.values()].map((company) => {
    const latest = runs.filter((r) => r.company_id === company.id).sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at))[0];
    return { ...company, collection_status: sourceStatus(latest, sources), last_run_id: latest?.run_id ?? null,
      last_checked_at: latest?.finished_at ?? null, last_error: latest?.errors?.map((e) => `${e.code}: ${e.message}`).join('; ') || company.preflight_check?.reason || '',
      jobs_count: rows.filter((j) => j.company_id === company.id).length,
      candidate_count: rows.filter((j) => j.company_id === company.id && j.candidate).length,
      live_ownership: latest?.ownership?.status ?? 'unverified', scope: latest?.scope ?? null,
      discovery_status: company.discovery_status ?? (companies.some((known) => known.id === company.id) ? 'seeded' : 'discovered_unverified') };
  });
  const changes = events.filter((event) => !['baseline', 'first_seen'].includes(event.event_type ?? event.type));
  return { schema_version: 3, generated_at: generatedAt, preferences_version: preferences.version,
    salary_target_rule: preferences.salary ?? null, jobs: rows, companies: radar, classifications, discovery, industry_groups: groupJobsByIndustry(rows), sources, runs, events, changes, market_leads, headhunter,
    summary: { companies: radar.length, complete_sources: radar.filter((c) => ['success', 'empty'].includes(c.collection_status)).length,
      incomplete_sources: radar.filter((c) => ['failed', 'partial', 'blocked'].includes(c.collection_status)).length,
      unscanned_sources: radar.filter((c) => c.collection_status === 'unscanned').length, jobs: rows.length,
      candidates: rows.filter((j) => j.candidate).length, review_candidates: rows.filter((j) => j.review_required).length, raw_jobs: rows.length, ai_candidates: rows.filter((j) => j.views.includes('ai')).length,
      salary_candidates: rows.filter((j) => j.views.includes('salary')).length, unknown_salary_candidates: rows.filter((j) => j.views.includes('unknown')).length,
      assessed_candidates: rows.filter((j) => j.candidate && j.analysis).length,
      independently_reviewed_candidates: rows.filter((j) => j.candidate && j.analysis?.semantic_review_status === 'approved').length,
      pending_review_candidates: rows.filter((j) => j.candidate && j.analysis?.semantic_review_status === 'pending').length,
      revision_required_candidates: rows.filter((j) => j.candidate && j.analysis?.semantic_review_status === 'rejected').length,
      changes: changes.length },
    boundaries: ['首次观察不等于新发布；官网展示不保证仍在招聘。', '评分是证据覆盖判断，不是面试概率。',
      ...(preferences.salary?.mode === 'fixed_monthly_base_minimum' ? ['薪酬门槛：明确披露的人民币固定月薪下界至少20K；未说明底薪或跨门槛区间待确认。', '管理与长期To B方向已纳入评估输入；旧偏好下的评估不沿用。'] : []),
      '未披露薪资不估算；失败或部分扫描不推断下架。', '当前未启用自动投递、消息、简历上传或定时任务。'] };
}

function assessmentHTML(analysis) {
  if (!analysis) return '<p class="muted">尚未完成个人画像评估</p>';
  const lists = [['直接证据', analysis.direct_evidence], ['可迁移证据', analysis.transferable_evidence], ['真实缺口', analysis.gaps]];
  return `<h3>岗位价值与匹配</h3><p>${escapeHTML(analysis.role_mission ?? '')}</p><p>${escapeHTML(analysis.verdict ?? '')} · ${escapeHTML(analysis.score ?? '未评分')} / 100</p><p class="muted">${reviewLabel(analysis)}，评分不是面试概率。</p>${analysis.semantic_review_status === 'rejected' ? `<p>${escapeHTML(analysis.semantic_review?.notes ?? '评估需修订，暂不作为推荐依据。')}</p>` : ''}` +
    lists.map(([title, entries]) => `<h4>${title}</h4><ul>${(entries ?? []).map((e) => `<li>${escapeHTML(typeof e === 'string' ? e : `${e.requirement ?? ''}：${e.explanation ?? e.evidence ?? ''}`)}</li>`).join('')}</ul>`).join('') +
    `<h4>简历建议</h4><p>${escapeHTML(analysis.resume_action ?? '')}</p><p>${escapeHTML(analysis.resume_advice ?? '')}</p><h4>门槛核查</h4><ul>${(analysis.hard_gates ?? []).map((g) => `<li>${escapeHTML(g.requirement)}：${escapeHTML(g.status)}。${escapeHTML(g.reason ?? '')}</li>`).join('')}</ul><h4>需要补充的事实</h4><ul>${(analysis.questions ?? []).map((question) => `<li>${escapeHTML(question)}</li>`).join('')}</ul>`;
}

export function renderOverviewHTML(data) {
  const h = escapeHTML;
  const reportDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date(data.generated_at));
  const sweepLink = data.market_sweep ? '<a href="market-sweep.html"><b>本轮市场扫描</b></a>' : '';
  const tab = (view, label, count = '') => `<button role="tab" data-view="${view}" aria-selected="false">${label}${count !== '' ? ` <b>${count}</b>` : ''}</button>`;
  const status = (job) => job.hiring_active === 'closed' ? '已关闭' : job.source_stale_warning ? '来源异常，保留上次结果' : ['open', 'active'].includes(job.hiring_active) ? '来源标记开放' : '招聘状态待确认';
  const salaryLabel = (job) => job.salary_raw || '未披露';
  const renderJob = (job, index) => {
    const raw = localHref(job.body_path); const meta = localHref(job.metadata_path); const screenshot = localHref(job.source_locator?.native_link_evidence?.screenshot_path);
    const match = job.analysis ? `${reviewLabel(job.analysis)} · ${job.analysis.score}/100` : job.role_fit?.reason || '待评估';
    return `<article class="job" data-views="${h(job.views.join(' '))}" data-search="${h(`${job.company_name} ${job.title} ${job.location_raw ?? ''} ${job.industry} ${job.segment} ${job.business_line} ${job.description_text ?? ''} ${job.contact_name ?? ''}`.toLowerCase())}">
      <div class="job-main"><div class="job-title"><strong>${h(job.title)}</strong><span class="muted">${h(job.company_name)} · ${h(job.industry)} / ${h(job.segment)} / ${h(job.tier_label)}</span><span class="muted">${h(job.location_raw || '地点未披露')} · 联系人：${h(job.contact_name || '未披露')}</span></div>
      <div class="job-field salary ${job.salary_20k_eligible ? 'verified' : job.salary_target_status === 'pending' ? 'pending' : ''}"><b>${h(salaryLabel(job))}</b><span>${h(job.salary_20k_eligible ? (data.salary_target_rule?.mode === 'advertised_monthly_range' ? '招聘区间覆盖20K，固定底薪待核' : '固定月薪20K+ 已核验') : salaryReasonLabel(job.salary_target_reason))}</span></div>
      <div class="job-field"><b>${h(job.business_line)}</b><span>${h(job.role_fit?.category || '销售运营')} · ${h(status(job))}</span></div>
      <div class="job-field"><b>${h(job.published_at || '日期未披露')}</b><span>${h(match)}</span></div>
      <div class="job-actions">${link('岗位原文', job.job_url)}<button class="detail-toggle" type="button" aria-expanded="false" data-detail="job-${index}">全文与证据</button></div></div>
      <div id="job-${index}" class="job-detail hidden"><div><h3>职位描述</h3><pre>${h(job.description_text || '无完整 JD')}</pre></div><div><h3>岗位判断</h3>${assessmentHTML(job.analysis)}<p><b>角色政策：</b>${h(job.role_fit?.reason || '未返回')}${job.review_required ? '；正文商业信号待复核，不是已通过推荐' : ''}</p><h3>行业与归属证据</h3><p>行业：${h(job.industry)}；赛道：${h(job.segment)}；地位：${h(job.tier_label)}；业务线：${h(job.business_line)}<br>分类版本：${h(job.classification_version || '未提供')}；参考日期：${h(job.classification_as_of || '未提供')}<br>${h(job.classification_validation_reason)}</p><h3>来源记录</h3><p>首次观察：${h(job.first_seen_at)}<br>最近观察：${h(job.last_seen_at)}<br>原始发布日期：${h(job.published_at_raw || '未披露')}<br>时间语义：${h(job.published_at_semantics || '未知')}<br>原生岗位 ID：${h(job.source_job_id)}</p><p>${raw ? `<a href="${h(raw)}">原始响应</a>` : '原始证据不可用'} · ${meta ? `<a href="${h(meta)}">采集回执</a>` : '回执不可用'}${screenshot ? ` · <a href="${h(screenshot)}">实际搜索截图</a>` : ''}</p><p>${link('申请入口', job.application_url || job.job_url)}</p></div></div></article>`;
  };
  const rows = groupJobsByIndustry(data.jobs).map((group) => `<div class="industry-group" data-group="${h(group.key)}"><h3 class="industry-heading">${h([...new Set([group.industry, group.segment, group.tier_label])].join(' · '))} <span class="muted">${h(group.company_name)} · ${h(group.business_line)} · <b data-group-count>${group.jobs.length}</b> 条</span></h3>${group.jobs.map((job) => renderJob(job, data.jobs.indexOf(job))).join('')}</div>`).join('');
  const displayGroups = new Map();
  for (const c of data.companies) { const entries = displayGroups.get(c.name) ?? []; entries.push(c); displayGroups.set(c.name, entries); }
  const radar = [...displayGroups.entries()].map(([name, entries]) => `<li><strong>${h(name)}</strong><span>${entries.length > 1 ? `${entries.length} 条同名雇主线索，实体关系待核` : h(discoveryStatusLabel(entries[0].discovery_status))}</span><details><summary>来源、进度与待办</summary>${entries.map((c) => `<p>${h(c.sector || '赛道未披露')} · ${h(discoveryStatusLabel(c.discovery_status))} · 历史${h(statusName(c.collection_status))} · ${c.jobs_count} 条原始岗位<br>${h(c.last_error || c.notes || c.last_checked_at || '')} ${link('官网', c.homepage)} ${link('招聘入口', c.careers_url)}</p>`).join('')}</details></li>`).join('');
  const funnel = data.funnel ? `<section id="funnel" class="panel hidden"><div class="exports"><a href="funnel.md">漏斗 Markdown</a><a href="funnel.csv">漏斗 CSV</a><a href="funnel.json">漏斗 JSON</a></div>${renderFunnelSection(data.funnel)}</section>` : '';
  const leadData = data.market_leads && !Array.isArray(data.market_leads) ? data.market_leads : { leads: data.market_leads ?? [] };
  const leadItems = Array.isArray(leadData.leads) ? leadData.leads : [];
  const leadCount = leadData.summary?.total ?? leadItems.length;
  const leads = leadItems.length ? `<p class="notice">${h(leadData.notice || '来自搜索索引，不代表在线在招核验。')}</p><ul class="compact-list">${leadItems.map((lead) => `<li><strong>${h(lead.company_name || '公司未披露')} · ${h(lead.title || '薪资线索')}</strong><span><b>${h(lead.salary_raw || '原始薪资未披露')}</b> · ${h(lead.location_raw || '地点未披露')} · ${h(lead.experience_raw || '经验未披露')}</span><span class="muted">${h(lead.salary_target?.label || '固定底薪待核')} · ${h(leadEvidenceStatusLabel(lead.evidence_status))} · ${h(lead.observed_at || '')}</span><span>${lead.job_url ? link('职位直链', lead.job_url) : `来源页：${link('打开来源页', lead.source_url)}`}</span><details><summary>线索摘要与证据</summary><p>${h(lead.description_summary || '无摘要')}</p><p>${h(lead.salary_target?.reason || '固定底薪待核')}；角色：${h(lead.role_fit?.category || '未判断')}，${h(lead.role_fit?.reason || '')}</p><p>${h((lead.risks || []).join('；') || '无额外风险备注')}</p><p>${localEvidenceLink('本地证据', lead.evidence?.path)}${lead.evidence?.sha256 ? ` · SHA256 ${h(lead.evidence.sha256)}` : ''}</p></details></li>`).join('')}</ul>` : '<div class="placeholder"><strong>暂无真实数据</strong><span>公开薪酬线索由主控提供；当前不把搜索索引称作在线在招，也不从非完整 JD 推断职位详情。</span></div>';
  const headhunterData = data.headhunter && typeof data.headhunter === 'object' ? data.headhunter : {};
  const renderFinding = (finding) => `<details><summary>${finding.status === 'resolved' ? '<b>已修复</b> · ' : ''}${h(finding.title || '发现')}</summary><ul><li><b>结论：</b>${h(finding.conclusion || '无')}</li><li><b>风险：</b>${h(finding.risk || '无')}</li><li><b>下一步：</b>${h(finding.next_action || '无')}</li></ul></details>`;
  const renderRole = (role) => `<li><strong>${h(role.name || role.role_id || '角色研判')} · ${h(roleStatusLabel(role.status))}</strong><span>${h(role.summary || '无角色摘要')}</span><div>${(role.findings || []).map(renderFinding).join('') || '<span class="muted">暂无 findings</span>'}</div><details><summary>模型与证据</summary><p>模型：${h(role.model || '未提供')}；effort：${h(role.reasoning_effort || '未提供')}；agent：${h(role.agent_id || '未提供')}</p><p>${h((role.evidence || []).join('；') || '无附加证据')}</p></details></li>`;
  const headhunter = headhunterData.status ? `<p class="notice">状态：<b>${h(headhunterData.status)}</b> · ${h(headhunterData.summary || '无综合摘要')}</p><ul class="compact-list">${(headhunterData.decisions || []).map((item) => `<li><strong>${h(item.title || '综合决策')}</strong><span>${h(item.conclusion || '无结论')}</span><span class="muted">${h((item.evidence || []).join('；') || '无附加证据')}</span></li>`).join('')}${(headhunterData.roles || []).map(renderRole).join('')}</ul><p>未运行：${h((headhunterData.not_run || []).join('、') || '无')}；问题：${h((headhunterData.questions || []).join('、') || '无')}；报告：${localEvidenceLink('打开报告', headhunterData.report_path)}</p>` : '<div class="placeholder"><strong>暂无真实数据</strong><span>主控提供猎头综合 role 输出后，这里显示证据化研判。</span></div>';
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; connect-src 'none"><title>职场机会 · 官方招聘证据</title><style>
  *{box-sizing:border-box}body{margin:0;background:#f4f6f7;color:#20262d;font:14px/1.5 -apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif}a{color:#08776b;text-underline-offset:3px}main{max-width:1500px;margin:auto;padding:20px 28px 48px}header{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:16px;border-bottom:1px solid #d8dde2;padding-bottom:12px}h1{font-size:24px;line-height:1.2;margin:0 0 4px}h2{font-size:18px;margin:18px 0 8px}h3{font-size:15px;margin:0 0 7px}p{margin:6px 0}.muted{color:#68717d;font-size:12px}.exports{display:flex;gap:10px;flex-wrap:nowrap;white-space:nowrap}.summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:10px 0}.metric{background:#fff;border-left:3px solid #167c70;padding:9px 12px}.metric strong{display:block;font-size:21px;line-height:1.1}.metric>span{display:block;margin-top:4px;white-space:nowrap}.metric.warn{border-left-color:#c47a12}.metric.pending{border-left-color:#8a6a9d}.notice{margin:8px 0;padding:7px 10px;border:1px solid #e1e4e8;background:#fafbfb;color:#626b75;font-size:12px}.toolbar{display:flex;justify-content:space-between;gap:14px;align-items:end;margin:9px 0 8px;flex-wrap:wrap}nav{display:flex;gap:2px;flex-wrap:wrap}button{font:inherit;border:0;background:transparent;border-bottom:2px solid transparent;padding:7px 10px;color:#5d6570;cursor:pointer}button[aria-selected=true]{color:#075f56;border-bottom-color:#08776b;font-weight:700}button b{font-size:12px}input{font:inherit;width:250px;max-width:100%;padding:8px 10px;border:1px solid #bdc5ce;border-radius:3px;background:#fff}.job-list{display:grid;gap:8px}.job{background:#fff;border:1px solid #e0e4e8}.job-main{display:grid;grid-template-columns:minmax(230px,2.1fr) minmax(140px,1.1fr) minmax(130px,1fr) minmax(150px,1.2fr) auto;gap:12px;align-items:start;padding:12px 14px}.job-title strong{display:block;font-size:15px}.job-title .muted{display:block;margin-top:2px}.job-field b,.job-field span{display:block}.job-field b{font-weight:700}.job-field span{color:#68717d;font-size:12px}.salary.verified b{color:#08776b}.salary.pending b{color:#9a6213}.job-actions{display:flex;gap:9px;align-items:center;white-space:nowrap}.job-actions button{padding:0;color:#08776b;text-decoration:underline}.job-detail{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:24px;border-top:1px solid #e4e7eb;padding:14px}.job-detail pre,.panel pre{white-space:pre-wrap;overflow-wrap:anywhere;max-width:100%;margin:0;line-height:1.7}.job-detail ul{padding-left:18px}.compact-list,.radar{list-style:none;padding:0;margin:0}.compact-list li,.radar li{display:grid;grid-template-columns:minmax(180px,1.3fr) minmax(180px,1fr) minmax(160px,1fr);gap:12px;padding:9px 10px;border-bottom:1px solid #e5e8eb;background:#fff}.panel{margin-top:8px}.panel .funnel-view{margin-top:10px}.panel table{width:100%;border-collapse:collapse;table-layout:auto;background:#fff}.panel th{background:#edf0f2;text-align:left;padding:8px 10px;color:#525c68;font-size:12px}.panel td{vertical-align:top;padding:8px 10px;border-bottom:1px solid #e5e8eb;overflow-wrap:anywhere}.panel .scroll{overflow:visible}.panel summary{cursor:pointer;color:#08776b}.placeholder{display:flex;gap:8px;flex-direction:column;padding:28px 16px;background:#fff;border:1px dashed #cbd2d8;color:#66717c}.hidden{display:none!important}.count{color:#68717d;font-size:12px;margin:6px 0}.empty{padding:28px 12px;text-align:center;background:#fff;color:#737b85}.warning{color:#9a6213}.verified-label{color:#08776b}.pending-label{color:#8a6a9d}footer{margin-top:22px;padding-top:12px;border-top:1px solid #d9dde2;color:#68717d;font-size:12px}@media(max-width:760px){main{padding:8px 12px 28px}header{grid-template-columns:minmax(0,1fr) auto;gap:8px;padding-bottom:8px}h1{font-size:21px}.exports{gap:7px;font-size:12px;align-self:start}.summary{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:8px 0}.metric{padding:8px 7px}.metric strong{font-size:18px}.metric>span{font-size:11px;overflow:hidden;text-overflow:clip}.notice{margin:6px 0;padding:6px 8px}.toolbar{display:block;margin:6px 0}nav{width:100%;margin-bottom:6px;flex-wrap:nowrap;overflow-x:auto;white-space:nowrap;scrollbar-width:none}nav::-webkit-scrollbar{display:none}nav button{flex:0 0 auto;padding:5px 7px;font-size:13px}input{width:100%;padding:7px 9px}.job-main{display:block;padding:11px 12px}.job-title,.job-field,.job-actions{margin-bottom:9px}.job-actions{white-space:normal;gap:14px}.job-detail{display:block;padding:12px}.job-detail>div+div{margin-top:16px}.compact-list li,.radar li{display:block;padding:10px}.compact-list li>*{display:block;margin-bottom:3px}.panel table,.panel tbody,.panel tr,.panel td{display:block;width:100%}.panel thead{display:none}.panel tr{padding:9px 10px;border-bottom:1px solid #e0e4e8}.panel td{padding:2px 0;border:0}.panel tr.opportunity-detail td{padding:0}}
  #headhunter .compact-list>li{display:block;padding:12px 14px}#headhunter .compact-list>li>strong{display:block;margin-bottom:5px}#headhunter .compact-list>li>span{display:block;max-width:1100px}#headhunter .compact-list>li>div{margin-top:8px}#headhunter details{padding:4px 0}#headhunter details li{display:list-item;padding:3px 0;border:0;background:transparent}#headhunter details ul{padding-left:20px}#headhunter .compact-list>li>details{font-size:12px;color:#68717d}.compact-list>li>details[open]{grid-column:1/-1}.compact-list>li>details{overflow-wrap:anywhere}.salary span{color:#936017}.job-title .muted{overflow-wrap:anywhere}
  @media(min-width:761px) and (max-width:980px){.job-main{grid-template-columns:minmax(0,2fr) minmax(0,1fr)}.job-actions{grid-column:1/-1}.compact-list>li,.radar li{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.compact-list>li>details[open]{grid-column:1/-1}}
  </style></head><body><main><header><div><h1>职场机会</h1><div class="muted">市场 · 销售 · 商业运营 / AI优先 / ${data.salary_target_rule?.mode === 'advertised_monthly_range' ? '薪资区间覆盖20K' : '固定月薪20K'} · ${h(reportDay)}</div></div><div class="exports">${sweepLink}<a href="decision-review.html">能力匹配与公司信息</a><a href="overview.csv">CSV</a><a href="overview.md">Markdown</a><a href="overview.json">JSON</a></div></header>
  <div class="summary"><div class="metric"><strong>${data.summary.candidates}</strong><span>商业候选</span></div><div class="metric pending"><strong>${leadCount}</strong><span>薪资线索</span></div><div class="metric warn"><strong>${data.summary.salary_candidates}</strong><span>${data.salary_target_rule?.mode === 'advertised_monthly_range' ? '区间覆盖20K' : '固定薪达标'}</span></div></div>
  <div class="notice">只展示已采集证据；地位待核不等于小厂，review 仅表示正文商业信号待复核，不是推荐已通过；原始档案含排除职能。申请由你决定，本项目未发送简历或招聘消息。</div><div class="toolbar"><nav role="tablist" aria-label="机会视图">${tab('ai', 'AI优先', data.summary.ai_candidates)}${tab('all', '工作清单', data.summary.candidates)}${tab('review', '待复核', data.summary.review_candidates)}${tab('raw', '全原始记录', data.summary.raw_jobs)}${tab('salary', data.salary_target_rule?.mode === 'advertised_monthly_range' ? '区间20K+' : '固定薪20K+', data.summary.salary_candidates)}${tab('unknown', '薪资待核', data.summary.unknown_salary_candidates)}${tab('leads', '薪资线索', leadCount)}${tab('headhunter', '猎头研判')}${tab('funnel', '政策/行业/公司')}</nav><input type="search" id="search" aria-label="搜索公司、岗位或地区" placeholder="搜索公司、岗位、地区"></div>
  <section id="jobs"><div id="count" class="count"></div><div class="job-list">${rows}</div><div id="empty" class="empty hidden">本视图暂无符合条件的已采集岗位。薪资未披露或来源失败不代表市场没有机会。</div></section><section id="leads" class="panel hidden"><h2>薪资线索</h2><div class="exports"><a href="market-leads.csv">线索CSV</a><a href="market-leads.md">线索文档</a><a href="market-leads.json">线索JSON</a></div>${leads}</section><section id="headhunter" class="panel hidden"><h2>猎头研判</h2><div class="exports"><a href="headhunter.md">综合文档</a><a href="headhunter.json">完整角色结果</a></div>${headhunter}</section><section id="companies" class="panel hidden"><h2>政策 / 行业 / 公司</h2><ul class="radar">${radar || '<li>暂无公司记录</li>'}</ul></section>${funnel}<footer>本地证据报告。完整岗位原文、原始响应、采集回执与 CSV/Markdown 下载仍可回查。</footer></main>
  <script>(()=>{let view='ai';const jobs=[...document.querySelectorAll('.job')];const groups=[...document.querySelectorAll('.industry-group')];const search=document.getElementById('search');const special=['leads','headhunter','funnel'];function update(){const q=search.value.toLowerCase().trim();let n=0;jobs.forEach((job)=>{const show=!special.includes(view)&&job.dataset.views.split(' ').includes(view)&&job.dataset.search.includes(q);job.classList.toggle('hidden',!show);if(show)n++;});groups.forEach((group)=>{const visible=group.querySelectorAll('.job:not(.hidden)').length;group.classList.toggle('hidden',!visible);group.querySelector('[data-group-count]').textContent=visible;});document.getElementById('jobs').classList.toggle('hidden',special.includes(view));for(const id of ['leads','headhunter'])document.getElementById(id)?.classList.toggle('hidden',view!==id);document.getElementById('companies')?.classList.toggle('hidden',view!=='funnel');document.getElementById('funnel')?.classList.toggle('hidden',view!=='funnel');search.disabled=special.includes(view);document.querySelectorAll('[data-view]').forEach((b)=>b.setAttribute('aria-selected',String(b.dataset.view===view)));document.getElementById('count').textContent=n+' 条已采集岗位';document.getElementById('empty').classList.toggle('hidden',n!==0);}document.querySelectorAll('[data-view]').forEach((b)=>b.addEventListener('click',()=>{view=b.dataset.view;update();}));document.querySelectorAll('.detail-toggle').forEach((b)=>b.addEventListener('click',()=>{const detail=document.getElementById(b.dataset.detail);const open=detail.classList.toggle('hidden')===false;b.setAttribute('aria-expanded',String(open));}));search.addEventListener('input',update);update();})();</script></body></html>`;
}

export function renderOverviewCSV(data) {
  const columns = ['job_key', 'company_name', 'title', 'industry', 'segment', 'tier', 'tier_label', 'business_line', 'contact_name', 'contact_identity_status', 'channel_family', 'duplicate_of', 'duplicate_status', 'location_raw', 'salary_raw', 'salary_currency', 'salary_period', 'salary_kind', 'salary_status', 'salary_min', 'salary_max', 'salary_20k_eligible', 'salary_target_status', 'salary_target_reason', 'salary_legacy_20k_eligible', 'published_at', 'published_at_raw', 'published_at_semantics', 'first_seen_at', 'last_seen_at', 'source_health', 'hiring_active', 'description_complete', 'candidate', 'recalled', 'review_required', 'ai_related', 'match_score', 'match_verdict', 'resume_advice', 'evidence_mapping', 'hard_gates', 'questions', 'job_url', 'application_url', 'description_text', 'body_path', 'metadata_path'];
  return '\uFEFF' + [columns.map(csvCell).join(','), ...data.jobs.map((job) => {
    const row = { ...job, match_score: job.analysis?.score, match_verdict: job.analysis ? `${reviewLabel(job.analysis)}: ${job.analysis.verdict}` : null, resume_advice: job.analysis?.resume_advice,
      evidence_mapping: job.analysis ? JSON.stringify(job.analysis.requirements) : null,
      hard_gates: job.analysis ? JSON.stringify(job.analysis.hard_gates) : null, questions: job.analysis?.questions?.join('\n') };
    return columns.map((column) => csvCell(row[column])).join(',');
  })].join('\r\n') + '\r\n';
}

export function renderOverviewMarkdown(data) {
  const lines = ['# 职场机会：官方招聘证据', '', `生成时间：${data.generated_at}`, '', ...data.boundaries.map((s) => `- ${s}`), '',
    `公司/雇主待核记录 ${data.summary.companies}（含未确认同名实体，不是已核法人总数）；完整采集 ${data.summary.complete_sources}；失败或部分 ${data.summary.incomplete_sources}；未采集 ${data.summary.unscanned_sources}。`, ''];
  for (const [view, title] of [['ai', 'AI 优先'], ['all', '工作清单'], ['review', '待复核'], ['salary', data.salary_target_rule?.mode === 'fixed_monthly_base_minimum' ? '固定月薪20K+' : '20K+ 薪酬方向'], ['unknown', '薪资待确认'], ['raw', '全原始记录']]) {
    lines.push(`## ${title}`, '', '| 公司 | 岗位 | 薪资原文 | 地区 | 匹配状态 | 岗位链接 |', '| --- | --- | --- | --- | --- | --- |');
    const selected = data.jobs.filter((job) => job.views.includes(view));
    if (!selected.length) lines.push('| 暂无符合条件的已采集岗位 | | | | | |');
    for (const job of selected) lines.push(`| ${markdown(`${job.industry} / ${job.tier_label} / ${job.company_name}`)} | ${markdown(job.title)} | ${markdown(job.salary_raw || '未披露')} | ${markdown(job.location_raw || '未披露')} | ${markdown(`${job.contact_name || '联系人未披露'}；${job.analysis ? `${reviewLabel(job.analysis)}: ${job.analysis.verdict}` : job.review_required ? '正文商业信号待复核' : '待评估'}`)} | ${safeURL(job.job_url) ? `[原文](${markdownURL(job.job_url)})` : '无有效链接'} |`);
    lines.push('');
  }
  lines.push('## 公司雷达', '');
  for (const c of data.companies) lines.push(`- ${markdown(c.name)}：${statusName(c.collection_status)}；${markdown(c.last_error || c.notes || '')}`);
  lines.push('', '## 原始档案全文（含已排除职能，不是当前推荐）', '');
  for (const job of data.jobs) {
    lines.push(`### ${markdown(job.company_name)} · ${markdown(job.title)}`, '', `薪资：${markdown(job.salary_raw || '未披露')}；地区：${markdown(job.location_raw || '未披露')}；招聘状态：${markdown(job.hiring_active)}。`, '',
      `原生ID：${markdown(job.source_job_id)}；首次观察：${markdown(job.first_seen_at)}；原始发布日期：${markdown(job.published_at_raw || '未披露')}。`, '',
      safeURL(job.job_url) ? `[岗位原文](${markdownURL(job.job_url)})` : '岗位链接未取得', '', ...String(job.description_text).split('\n').map((line) => `    ${line}`), '');
    lines.push(`时间语义：${markdown(job.published_at_semantics || '未知')}。`, '', `证据：${markdown(job.body_path || '未取得')}；回执：${markdown(job.metadata_path || '未取得')}。`, '');
    if (job.analysis) {
      lines.push(`匹配：${reviewLabel(job.analysis)}；${markdown(job.analysis.verdict)}；证据覆盖：${job.analysis.score}/100。`, '', `岗位价值：${markdown(job.analysis.role_mission)}`, '');
      if (job.analysis.semantic_review_status === 'rejected') lines.push(`修订原因：${markdown(job.analysis.semantic_review?.notes ?? '暂不作为推荐依据。')}`, '');
      for (const [label, entries] of [['直接证据', job.analysis.direct_evidence], ['可迁移证据', job.analysis.transferable_evidence], ['真实缺口', job.analysis.gaps]]) {
        lines.push(`**${label}**`, ...(entries?.length ? entries.map((entry) => `- ${markdown(entry.requirement)}：${markdown(entry.explanation)}`) : ['- 无已确认条目。']), '');
      }
      lines.push('**门槛核查**', ...(job.analysis.hard_gates ?? []).map((gate) => `- ${markdown(gate.requirement)}：${markdown(gate.status)}。${markdown(gate.reason)}`), '',
        `简历建议：${markdown(job.analysis.resume_advice)}`, '', '**需要补充的事实**', ...(job.analysis.questions ?? []).map((question) => `- ${markdown(question)}`), '');
    }
  }
  return lines.join('\n');
}

async function optionalReport(moduleName, loader, fallback) {
  try {
    await access(new URL(moduleName, import.meta.url));
  } catch (error) {
    if (error?.code === 'ENOENT') return fallback;
    throw error;
  }
  const module = await import(moduleName);
  return await loader(module);
}

async function loadDiscoveryExport(directory) {
  try {
    const module = await import('./discovery.mjs');
    if (typeof module.readDiscoveryExport === 'function') return await module.readDiscoveryExport({ directory });
  } catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error; }
  const path = join(directory ?? join(ROOT, '01_行情收集/official-careers/discovery'), 'export.json');
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return {}; throw error; }
}

export async function writeOverview(input) {
  const companies = input.companies ?? JSON.parse(await readFile(join(ROOT, 'careers/config/company-discovery.json'), 'utf8'));
  const preferences = input.preferences ?? JSON.parse(await readFile(join(ROOT, 'careers/config/preferences.json'), 'utf8'));
  const discovery = input.discovery ?? await loadDiscoveryExport(input.discoveryDirectory);
  const knownJobKeys = new Set(input.jobs.map((job) => job.job_key));
  const discoveredJobs = (discovery.jobs ?? []).filter((job) => !knownJobKeys.has(job.job_key));
  const knownRuns = new Set(input.runs.map((run) => run.run_id));
  const discoveredRuns = (discovery.runs ?? []).filter((run) => !knownRuns.has(run.run_id));
  const knownSources = new Set((input.sources ?? []).map((source) => source.source_id));
  const sources = [...(input.sources ?? []), ...(discovery.sources ?? []).filter((source) => !knownSources.has(source.source_id))];
  const data = buildOverview({ ...input, jobs: [...input.jobs, ...discoveredJobs], runs: [...input.runs, ...discoveredRuns], sources, companies, preferences, discovery });
  data.market_leads = input.market_leads ?? await optionalReport('./market-leads.mjs', (module) => module.loadMarketLeads(preferences), {});
  data.headhunter = input.headhunter ?? await optionalReport('./headhunter.mjs', (module) => module.loadHeadhunterReport(), {});
  try {
    const sweep = JSON.parse(await readFile(join(REPORT_DIR, 'market-sweep.json'), 'utf8'));
    data.market_sweep = { report: 'market-sweep.html', generated_at: sweep.generated_at, summary: sweep.counts,
      scope: 'Independent public-market observation batch; not merged into historical official collector counts' };
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  data.funnel = await buildFunnel({ overview: data });
  data.funnel.snapshot_path = await writeFunnelSnapshot(data.funnel);
  await mkdir(REPORT_DIR, { recursive: true });
  const files = { 'overview.json': JSON.stringify(data, null, 2) + '\n', 'overview.html': renderOverviewHTML(data), 'overview.csv': renderOverviewCSV(data), 'overview.md': renderOverviewMarkdown(data), ...funnelReportFiles(data.funnel, csvCell) };
  for (const [name, content] of Object.entries(files)) {
    const destination = join(REPORT_DIR, name);
    const temporary = `${destination}.${randomUUID()}.tmp`;
    await writeFile(temporary, content);
    await rename(temporary, destination);
  }
  return { ok: true, summary: data.summary, funnel_summary: data.funnel.summary, funnel_snapshot: data.funnel.snapshot_path, reports: Object.keys(files).map((name) => repoRelative(join(REPORT_DIR, name))) };
}
