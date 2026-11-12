import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { ROOT, REPORT_DIR, evidenceAbsolute, repoRelative } from './paths.mjs';
import { classifyRole } from './role-policy.mjs';
import { parseSalary } from './salary.mjs';
import { evaluateSalaryTarget } from './salary-target.mjs';

const hash = (value) => createHash('sha256').update(value).digest('hex');
const urlOK = (value) => { try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password; } catch { return false; } };
const literal = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function titleSalaryBound(lead, block) {
  // List evidence must place the salary directly after this title, with only an optional location label between them.
  const pattern = new RegExp(`${literal(lead.title)}\\s*(?:〖[^〗\\n]{0,100}〗\\s*)?${literal(lead.salary_raw)}(?=\\s|$)`);
  return pattern.test(block) && pattern.test(lead.evidence.quote);
}
function jobLinkBound(lead, block) {
  if (!lead.job_url) return true;
  const url = new URL(lead.job_url);
  // This index adapter only accepts a separately observed Liepin job-page result, never a list-page link.
  return /^(?:www\.|m\.)?liepin\.com$/.test(url.hostname) && /^\/job\/\d+\.shtml$/.test(url.pathname)
    && !url.search && !url.hash && lead.source_url === lead.job_url && block.includes(`(${lead.job_url})`);
}

export async function loadMarketLeads(preferences, { manifestPath = join(ROOT, 'careers/config/market-leads.json'), readEvidence = (path) => readFile(evidenceAbsolute(path), 'utf8') } = {}) {
  preferences ??= JSON.parse(await readFile(join(ROOT, 'careers/config/preferences.json'), 'utf8'));
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (manifest.schema_version !== 1 || !Array.isArray(manifest.leads)) throw new Error('Invalid public-lead manifest');
  const ids = new Set(); const identities = new Set(); const leads = [];
  for (const lead of manifest.leads) {
    if (!lead.lead_id || ids.has(lead.lead_id)) throw new Error('Duplicate or missing lead ID');
    ids.add(lead.lead_id);
    const identity = [lead.company_name, lead.title, lead.location_raw].join('|');
    if (identities.has(identity)) throw new Error('Duplicate public lead identity');
    identities.add(identity);
    if (!urlOK(lead.source_url) || (lead.job_url && !urlOK(lead.job_url))) throw new Error('Unsafe public-lead URL');
    if (lead.description_complete !== false || lead.evidence_status !== 'search_index_only') throw new Error('Index leads cannot become verified full JDs');
    const raw = await readEvidence(lead.evidence.path);
    const receipt = JSON.parse(raw);
    const sourceBlock = typeof receipt.result === 'string' ? receipt.result.split(/\n-{20,}\n/).find((part) => part.includes(`(${lead.source_url})`)) : null;
    if (receipt.kind !== 'web_tool_result_not_raw_http' || typeof receipt.result !== 'string'
        || !Number.isFinite(Date.parse(receipt.observed_at)) || !lead.evidence.quote
        || !receipt.result.includes(lead.evidence.quote) || !sourceBlock?.includes(lead.evidence.quote.trim()) || (lead.job_url && !sourceBlock.includes(lead.job_url))
        || !lead.evidence.quote.includes(lead.title) || !lead.evidence.quote.includes(lead.salary_raw)
        || !titleSalaryBound(lead, sourceBlock) || !jobLinkBound(lead, sourceBlock)) throw new Error('Public-lead quote or provenance mismatch');
    const parsed = parseSalary(lead.salary_raw, { currency: 'CNY', period: 'month' });
    const salaryTarget = evaluateSalaryTarget(parsed, preferences.salary);
    const role = classifyRole({ title: lead.title, description_text: '' }, preferences);
    if (!role.eligible) continue;
    leads.push({ ...lead, observed_at: receipt.observed_at, role_fit: role,
      evidence: { ...lead.evidence, sha256: hash(raw) },
      salary_target: { ...salaryTarget, eligible: false, pending: true, label: '固定底薪待核', reason: '仅有招聘区间，尚无固定底薪承诺；须另核在招及岗位详情。' },
      salary_context: '招聘平台中国岗位K月薪显示口径；不推算固定底薪或保证薪数',
      hiring_active: 'unknown', application_authorized: false });
  }
  return { schema_version: 1, generated_at: new Date().toISOString(), notice: manifest.notice,
    halted_sources: manifest.halted_sources ?? [], summary: { total: leads.length, companies: new Set(leads.map((x) => x.company_name)).size,
      advertised_salary: leads.filter((x) => x.salary_raw).length, confirmed_base: 0, full_jd: 0 }, leads };
}

export async function writeMarketLeads(preferences) {
  const data = await loadMarketLeads(preferences);
  await mkdir(REPORT_DIR, { recursive: true });
  const cell = (v) => { let s = String(v ?? ''); if (/^[\s\uFEFF]*[=+@-]/.test(s)) s = "'" + s; return '"' + s.replaceAll('"', '""') + '"'; };
  const cols = ['company_name', 'title', 'salary_raw', 'location_raw', 'experience_raw', 'education_raw', 'source_update_raw', 'job_url', 'source_url', 'evidence_status'];
  const csv = '\uFEFF' + [cols.map(cell).join(','), ...data.leads.map((x) => cols.map((c) => cell(x[c])).join(','))].join('\r\n');
  const md = ['# 公开薪资线索', '', data.notice, '', `线索 ${data.summary.total} 条 / 公司 ${data.summary.companies} 家 / 固定底薪达标已确认 0 条`, '',
    ...data.leads.flatMap((x) => [`## ${x.company_name} | ${x.title}`, `- 招聘区间：**${x.salary_raw}**；固定底薪待核。`, `- 地点：${x.location_raw}；经验：${x.experience_raw}；学历：${x.education_raw}。`,
      `- ${x.description_summary}`, `- [${x.job_url ? '索引取得的职位链接' : '招聘来源页，非职位直链'}](${x.job_url || x.source_url})`, `- 来源更新原文：${x.source_update_raw || '未提供'}；索引取得：${x.observed_at}。`, `- 证据：${x.evidence.path}；SHA256：${x.evidence.sha256}`, ''])].join('\n');
  for (const [ext, value] of [['json', JSON.stringify(data, null, 2) + '\n'], ['csv', csv], ['md', md]]) await writeFile(join(REPORT_DIR, `market-leads.${ext}`), value);
  return { ...data.summary, reports: ['json', 'csv', 'md'].map((ext) => repoRelative(join(REPORT_DIR, `market-leads.${ext}`))) };
}
