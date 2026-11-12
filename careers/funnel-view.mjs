import { relative } from 'node:path';
import { REPORT_DIR, evidenceAbsolute } from './paths.mjs';

const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

const markdown = (value) => String(value ?? '')
  .replace(/[\r\n]+/g, ' ')
  .replace(/([\\`*_{}\[\]()#+.!|<>])/g, '\\$1');

const text = (value, fallback = '未披露') => {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
};

const list = (value) => Array.isArray(value) ? value : [];
const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const summaryLabels = {
  policies_verified: '已核验政策', industries: '赛道', companies: '公司', traceable_jobs: '可追溯岗位',
  salary_eligible: '薪资合格', assessment_pending: '待评估',
};

function safeHTTPS(value) {
  try {
    const url = new URL(String(value));
    if (url.protocol !== 'https:' || url.username || url.password) return '';
    return url.href;
  } catch {
    return '';
  }
}

function evidenceHref(value) {
  if (typeof value !== 'string' || !value || value.startsWith('/') || /^[a-z][a-z0-9+.-]*:/i.test(value)) return '';
  try {
    const absolute = evidenceAbsolute(value);
    return relative(REPORT_DIR, absolute).split('/').map(encodeURIComponent).join('/');
  } catch {
    return '';
  }
}

function linkHTML(label, value) {
  const url = safeHTTPS(value);
  if (url) return `<a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(label)}</a>`;
  const path = evidenceHref(value);
  if (path) return `<a href="${escapeHTML(path)}">${escapeHTML(label)}</a>`;
  return escapeHTML(label);
}

function linkMarkdown(label, value) {
  const url = safeHTTPS(value);
  if (url) return `[${markdown(label)}](${url.replace(/[()[\]]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)})`;
  const path = evidenceHref(value);
  return path ? `[${markdown(label)}](${path.replace(/[()[\]]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)})` : markdown(label);
}

function fieldHTML(label, value, fallback = '未披露') {
  return `${escapeHTML(label)}：${escapeHTML(text(value, fallback))}`;
}

function applicationHTML(value) {
  if (typeof value === 'string' && value.toLowerCase().startsWith('mailto:')) return escapeHTML(value);
  return linkHTML('申请入口', value);
}

function evidenceHTML(evidence) {
  return list(evidence).map((item) => {
    const entry = object(item);
    const links = [
      entry.url && linkHTML('来源', entry.url),
      entry.body_path && linkHTML('正文证据', entry.body_path),
      entry.metadata_path && linkHTML('元数据回执', entry.metadata_path),
    ].filter(Boolean);
    const meta = [entry.sha256 && `sha256 ${escapeHTML(entry.sha256)}`, entry.captured_at && escapeHTML(entry.captured_at)].filter(Boolean).join(' · ');
    return `<li>${links.join(' · ') || '无有效证据链接'}${meta ? `<div class="muted">${meta}</div>` : ''}</li>`;
  }).join('') || '<li>无证据记录</li>';
}

function evidenceMarkdown(evidence) {
  return list(evidence).map((item) => {
    const entry = object(item);
    const links = [
      entry.url && linkMarkdown('来源', entry.url),
      entry.body_path && linkMarkdown('正文证据', entry.body_path),
      entry.metadata_path && linkMarkdown('元数据回执', entry.metadata_path),
    ].filter(Boolean);
    const meta = [entry.sha256 && `sha256 ${markdown(entry.sha256)}`, entry.captured_at && markdown(entry.captured_at)].filter(Boolean).join(' · ');
    return `- ${links.join(' · ') || '无有效证据链接'}${meta ? `；${meta}` : ''}`;
  }).join('\n') || '- 无证据记录';
}

function statusSalary(salary) {
  const value = object(salary);
  if (value.eligible === true) return '合格';
  if (value.pending === true || value.status === 'pending' || value.status === 'unknown') return '薪资待核，不算合格';
  return text(value.status, '不合格或未知');
}

function bulletsHTML(values, empty = '无记录') {
  const items = list(values).map((value) => `<li>${escapeHTML(typeof value === 'string' ? value : JSON.stringify(value))}</li>`).join('');
  return items || `<li>${escapeHTML(empty)}</li>`;
}

function bulletsMarkdown(values, empty = '无记录') {
  return list(values).map((value) => `- ${markdown(typeof value === 'string' ? value : JSON.stringify(value))}`).join('\n') || `- ${markdown(empty)}`;
}

function renderPolicyHTML(policy) {
  const item = object(policy);
  return `<tr><td><strong>${escapeHTML(text(item.title, item.id || '未命名政策'))}</strong><div class="muted">${escapeHTML(text(item.id, '无编号'))}</div></td><td>${escapeHTML(text(item.authority))}<div class="muted">${escapeHTML(text(item.document_kind))}</div></td><td>${escapeHTML(text(item.issued_at))}<br>${escapeHTML(text(item.published_at, '公布时间未知'))}<br>${escapeHTML(text(item.effective_at, '生效时间未知'))}</td><td>${escapeHTML(text(item.evidence_status, '未知'))}<div class="muted">${escapeHTML(text(item.observation_kind, '观察类型未知'))}</div></td><td><details><summary>政策依据与风险</summary><p>官方来源：${linkHTML('打开来源', item.source_url)}</p><p>${escapeHTML(text(item.excerpt, '无摘录'))}</p><ul>${evidenceHTML(item.evidence)}</ul><p class="muted">${list(item.risk_notes).map(escapeHTML).join('；') || '无风险备注'}</p></details></td></tr>`;
}

function renderIndustryHTML(industry) {
  const item = object(industry);
  return `<tr><td><strong>${escapeHTML(text(item.name, item.id || '未命名赛道'))}</strong><div class="muted">${escapeHTML(text(item.id, '无编号'))}</div></td><td>${escapeHTML(list(item.policy_ids).join('、') || '无关联政策')}</td><td>${escapeHTML(text(item.demand_hypothesis, '无需求假设'))}</td><td>${list(item.limitations).map(escapeHTML).join('；') || '无边界备注'}</td></tr>`;
}

function renderCompanyHTML(company) {
  const item = object(company);
  return `<tr><td><strong>${escapeHTML(text(item.name, item.id || '未命名公司'))}</strong><div class="muted">${escapeHTML(text(item.id, '无编号'))}</div></td><td>${escapeHTML(list(item.industry_ids).join('、') || '无关联赛道')}</td><td>${escapeHTML(text(item.tier, '层级未知'))}<div class="muted">${escapeHTML(text(item.tier_basis, '层级依据未知'))}</div></td><td>${escapeHTML(text(item.evidence_status, '未知'))}<br>${linkHTML('官网', item.source_url)} · ${linkHTML('招聘入口', item.careers_url)}<details><summary>公司自述与证据</summary><p>${escapeHTML(text(item.business_excerpt, '无公司自述摘录'))}</p><ul>${evidenceHTML(item.evidence)}</ul></details></td><td><div>${escapeHTML(list(item.job_keys).join('、') || '无岗位记录')}</div><div class="muted">备注：${escapeHTML(text(item.notes, '无备注'))}</div></td></tr>`;
}

function renderOpportunityHTML(opportunity) {
  const item = object(opportunity);
  const fit = object(item.career_fit);
  const salary = statusSalary(item.salary_target);
  const fitParagraphs = [fit.verdict, fit.role_mission, fit.resume_advice].filter(Boolean);
  const gates = list(fit.hard_gates).map((gate) => `${gate.requirement}：${({ met: '已证明', unmet: '未满足', unknown: '待核查' })[gate.status] || gate.status}。${gate.reason || ''}`);
  return `<tr class="opportunity-summary"><td><strong>${escapeHTML(text(item.title, '未命名岗位'))}</strong><div class="muted">${escapeHTML(text(item.company_name))} · ${escapeHTML(text(item.location_raw))}</div></td><td>${escapeHTML(text(item.salary_raw))}<div class="muted">${escapeHTML(salary)}</div></td><td>${escapeHTML(text(item.source_health, '来源健康未知'))}<br>${escapeHTML(text(item.source_checked_at, '最近观察未知'))}</td><td>${escapeHTML(text(fit.path, '路径未判断'))}</td><td>${linkHTML('岗位原文', item.job_url)}<br>${applicationHTML(item.application_url)}</td></tr>
  <tr class="opportunity-detail"><td colspan="5"><details><summary>完整 JD 与来源</summary>
  <h3>职位描述</h3><pre>${escapeHTML(text(item.description_text, '无完整 JD'))}</pre>
  <h3>岗位时间与状态</h3><p>${fieldHTML('职位发布日期', item.published_at)}<br>${fieldHTML('最近观察', item.source_checked_at)}<br>${fieldHTML('最近采集尝试', item.source_latest_attempt_at)}<br>${fieldHTML('招聘状态', item.hiring_active)}<br>${fieldHTML('来源岗位 ID', item.source_job_id)}<br>岗位链接：${linkHTML('打开岗位原文', item.job_url)}<br>申请入口：${applicationHTML(item.application_url)}</p>
  <h3>岗位与判断</h3><p>薪资结论：${escapeHTML(salary)}；完整 JD：${escapeHTML(text(item.description_complete, '未知'))}</p><p>${escapeHTML(text(item.salary_target?.reason, '薪资结构待确认'))}</p><p>政策：${escapeHTML(list(item.policy_ids).join('、') || '无')}；赛道：${escapeHTML(list(item.industry_ids).join('、') || '无')}</p>
  <h3>职业匹配</h3>${(fitParagraphs.length ? fitParagraphs : [text(fit.reason, '无匹配说明')]).map((paragraph) => `<p>${escapeHTML(paragraph)}</p>`).join('')}<p>直接证据</p><ul>${bulletsHTML(fit.direct_evidence)}</ul><p>可迁移证据</p><ul>${bulletsHTML(fit.transferable_evidence)}</ul><p>未覆盖要求</p><ul>${bulletsHTML(fit.gaps, '无单列未覆盖项，不代表硬门槛全部通过；请核对下方门槛状态。')}</ul><p>硬门槛核查</p><ul>${bulletsHTML(gates, '尚未核查，不视为满足。')}</ul><p>待确认问题</p><ul>${bulletsHTML(fit.questions)}</ul>
  <h3>证据记录</h3><ul>${evidenceHTML(item.evidence)}</ul></details></td></tr>`;
}

function tableSectionHTML(title, headers, rows, empty = '暂无数据') {
  return `<section><h2>${escapeHTML(title)}</h2><div class="scroll"><table><thead><tr>${headers.map((header) => `<th>${escapeHTML(header)}</th>`).join('')}</tr></thead><tbody>${rows || `<tr><td colspan="${headers.length}" class="muted">${escapeHTML(empty)}</td></tr>`}</tbody></table></div></section>`;
}

export function renderFunnelSection(data = {}) {
  const value = object(data);
  const summary = object(value.summary);
  const window = object(value.reporting_window);
  const summaryText = Object.keys(summary).map((key) => `${escapeHTML(summaryLabels[key] || key)}：${escapeHTML(text(summary[key], '未知'))}`).join(' · ') || '无汇总数据';
  const notices = ['首次建立基线不等于本周新政策。', '公司自述不等于已证实头部或稳定。', '薪资待核不是合格岗位。', ...list(value.boundaries)];
  return `<section class="funnel-view"><h1>私人猎头漏斗</h1><p class="muted">生成时间：${escapeHTML(text(value.generated_at))} · 范围：${escapeHTML(text(value.scope))} · 窗口：${escapeHTML(text(window.from))} 至 ${escapeHTML(text(window.to))}</p><p>${summaryText}</p><div class="notice">${notices.map(escapeHTML).join(' ')}</div>${tableSectionHTML('政策', ['政策', '发布机关 / 文种', '日期', '证据状态', '依据与风险'], list(value.policies).map(renderPolicyHTML).join(''))}${tableSectionHTML('赛道', ['赛道', '关联政策', '需求假设', '局限'], list(value.industries).map(renderIndustryHTML).join(''))}${tableSectionHTML('公司', ['公司', '赛道', '层级', '证据状态与入口', '岗位与备注'], list(value.companies).map(renderCompanyHTML).join(''))}${tableSectionHTML('岗位机会', ['岗位 / 公司', '薪资', '来源健康', '职业匹配', '岗位原文 / 申请'], list(value.opportunities).map(renderOpportunityHTML).join(''))}<section><h2>问题与边界</h2><ul>${list(value.issues).map((issue) => `<li>${escapeHTML(text(issue?.id, '问题'))}：${escapeHTML(text(issue?.status, '状态未知'))}；${escapeHTML(text(issue?.reason, '无原因'))}</li>`).join('') || '<li>无记录</li>'}</ul></section></section>`;
}

function policyMarkdown(policy) {
  const item = object(policy);
  return `### ${markdown(text(item.title, item.id || '未命名政策'))}\n- 编号：${markdown(text(item.id, '无编号'))}\n- 权威机构：${markdown(item.authority)}\n- 文种：${markdown(item.document_kind)}\n- 发布/公布/生效：${markdown(item.issued_at)} / ${markdown(item.published_at)} / ${markdown(item.effective_at)}\n- 证据状态：${markdown(item.evidence_status)}；观察类型：${markdown(item.observation_kind)}\n- 官方来源：${linkMarkdown('打开来源', item.source_url)}\n- 摘录：${markdown(text(item.excerpt, '无摘录'))}\n- 风险：${markdown(list(item.risk_notes).join('；') || '无风险备注')}\n${evidenceMarkdown(item.evidence)}`;
}

function opportunityMarkdown(opportunity) {
  const item = object(opportunity);
  const fit = object(item.career_fit);
  const application = typeof item.application_url === 'string' && item.application_url.toLowerCase().startsWith('mailto:') ? markdown(item.application_url) : linkMarkdown('申请入口', item.application_url);
  return `### ${markdown(text(item.title, '未命名岗位'))} · ${markdown(item.company_name)}\n- 地点：${markdown(item.location_raw)}\n- 薪资原文：${markdown(item.salary_raw)}\n- 薪资结论：${markdown(statusSalary(item.salary_target))}\n- 岗位链接：${linkMarkdown('岗位原文', item.job_url)}\n- 申请入口：${application}\n- 来源健康/最近观察：${markdown(item.source_health)} / ${markdown(item.source_checked_at)}\n- 职位发布日期：${markdown(item.published_at)}\n- 招聘状态：${markdown(item.hiring_active)}；来源岗位 ID：${markdown(item.source_job_id)}\n- 完整 JD：${markdown(item.description_complete)}\n- 政策：${markdown(list(item.policy_ids).join('、') || '无')}；赛道：${markdown(list(item.industry_ids).join('、') || '无')}\n\n<details><summary>完整 JD 与职业匹配</summary>\n\n${String(text(item.description_text, '无完整 JD')).split(/\r?\n/).map((line) => `    ${line}`).join('\n')}\n\n职业路径：${markdown(fit.path)}\n\n${markdown(text(fit.reason, '无匹配说明'))}\n\n直接证据\n${bulletsMarkdown(fit.direct_evidence)}\n\n可迁移证据\n${bulletsMarkdown(fit.transferable_evidence)}\n\n真实缺口\n${bulletsMarkdown(fit.gaps)}\n\n待确认问题\n${bulletsMarkdown(fit.questions)}\n\n证据记录\n${evidenceMarkdown(item.evidence)}\n</details>`;
}

function companyMarkdown(company) {
  const item = object(company);
  return `### ${markdown(text(item.name, item.id || '未命名公司'))}\n- 编号：${markdown(item.id)}\n- 赛道：${markdown(list(item.industry_ids).join('、') || '无')}\n- 层级：${markdown(item.tier)}；依据：${markdown(item.tier_basis)}\n- 证据状态：${markdown(item.evidence_status)}\n- 官网：${linkMarkdown('官网', item.source_url)}；招聘入口：${linkMarkdown('招聘入口', item.careers_url)}\n- 岗位记录：${markdown(list(item.job_keys).join('、') || '无岗位记录')}\n- 备注：${markdown(text(item.notes, '无备注'))}\n\n<details><summary>公司自述与证据</summary>\n\n${markdown(text(item.business_excerpt, '无公司自述摘录'))}\n\n${evidenceMarkdown(item.evidence)}\n</details>`;
}

export function renderFunnelMarkdown(data = {}) {
  const value = object(data);
  const summary = object(value.summary);
  const window = object(value.reporting_window);
  const lines = ['# 私人猎头漏斗', '', `生成时间：${markdown(value.generated_at)}；范围：${markdown(value.scope)}；报告窗口：${markdown(window.from)} 至 ${markdown(window.to)}`, '', '首次建立基线不等于本周新政策。', '公司自述不等于已证实头部或稳定。', '薪资待核不是合格岗位。', ...list(value.boundaries).map((entry) => `边界：${markdown(entry)}`), '', `汇总：${Object.entries(summary).map(([key, item]) => `${markdown(summaryLabels[key] || key)}=${markdown(item)}`).join('；') || '无汇总数据'}`, '', '## 政策', ''];
  lines.push(...(list(value.policies).length ? list(value.policies).map(policyMarkdown).flatMap((item) => [item, '']) : ['暂无数据', '']), '## 赛道', '');
  lines.push(...(list(value.industries).length ? list(value.industries).map((item) => `### ${markdown(text(item?.name, item?.id || '未命名赛道'))}\n- 编号：${markdown(item?.id)}\n- 关联政策：${markdown(list(item?.policy_ids).join('、') || '无')}\n- 需求假设：${markdown(text(item?.demand_hypothesis, '无需求假设'))}\n- 局限：${markdown(list(item?.limitations).join('；') || '无边界备注')}`).flatMap((item) => [item, '']) : ['暂无数据', '']), '## 公司', '');
  lines.push(...(list(value.companies).length ? list(value.companies).map(companyMarkdown).flatMap((item) => [item, '']) : ['暂无数据', '']), '## 岗位机会', '');
  lines.push(...(list(value.opportunities).length ? list(value.opportunities).map(opportunityMarkdown).flatMap((item) => [item, '']) : ['暂无数据', '']), '## 问题与边界', '');
  lines.push(...(list(value.issues).length ? list(value.issues).map((issue) => `- ${markdown(text(issue?.id, '问题'))}：${markdown(text(issue?.status, '状态未知'))}；${markdown(text(issue?.reason, '无原因'))}`) : ['- 无记录']));
  return lines.join('\n');
}
