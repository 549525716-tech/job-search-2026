#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const deliveryCsvPath = join(projectRoot, "01_行情收集/AI销售岗位市场调研交付版.csv");
const qualityCsvPath = join(projectRoot, "01_行情收集/BOSS样本质量验收报告.csv");
const externalSalaryPath = join(projectRoot, "06_自动化采集/config/external_salary_signals.csv");
const bossSignalPath = join(projectRoot, "06_自动化采集/config/boss_public_company_signals.csv");
const focusCoveragePath = join(projectRoot, "01_行情收集/AI重点公司与赛道覆盖审计.csv");
const focusBatchPath = join(projectRoot, "01_行情收集/BOSS重点公司补样批次包.csv");
const outputMdPath = join(projectRoot, "01_行情收集/AI销售薪资能力证据雷达.md");
const outputCsvPath = join(projectRoot, "01_行情收集/AI销售薪资能力证据雷达.csv");

const roleFamilies = [
  "销售管理/区域负责人",
  "售前/解决方案顾问",
  "渠道/生态/伙伴销售",
  "大客户/行业销售经理",
  "AI软件/大模型销售",
  "SaaS/应用销售",
  "海外/出海商业化"
];

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return [];
  const headers = parseCsvLine(lines.shift());
  return lines.map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
  });
}

function readCsv(filePath) {
  if (!existsSync(filePath)) return [];
  return parseCsv(readFileSync(filePath, "utf8"));
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function csv(rows) {
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

function formatDate(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(value);
  const get = (type) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")} Asia/Shanghai`;
}

function numberOf(value) {
  const num = Number.parseFloat(String(value || "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(num) ? num : 0;
}

function boolOf(value) {
  return value === true || String(value).toLowerCase() === "true" || String(value) === "是";
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function splitList(value) {
  return String(value || "")
    .split(/[;；、]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function topItems(values, limit = 6) {
  return unique(values).slice(0, limit).join(";");
}

function salaryRanges(value) {
  const text = String(value || "");
  const kRanges = [...text.matchAll(/(\d+(?:\.\d+)?)\s*[Kk]?\s*[-~－—到]\s*(\d+(?:\.\d+)?)\s*[Kk]/g)]
    .map((match) => ({
      low: Number.parseFloat(match[1]),
      high: Number.parseFloat(match[2])
    }));
  const yuanRanges = [...text.matchAll(/(\d{4,6})\s*[-~－—到]\s*(\d{4,6})\s*元\/?月/g)]
    .map((match) => ({
      low: Math.round(Number.parseFloat(match[1]) / 100) / 10,
      high: Math.round(Number.parseFloat(match[2]) / 100) / 10
    }));
  return [...kRanges, ...yuanRanges].filter((range) => Number.isFinite(range.low) && Number.isFinite(range.high));
}

function salaryBand(ranges) {
  if (!ranges.length) return "待样本校验";
  const low = Math.min(...ranges.map((range) => range.low));
  const high = Math.max(...ranges.map((range) => range.high));
  return `${low}-${high}K`;
}

function salaryTier(maxK) {
  if (maxK >= 60) return "高薪核心层";
  if (maxK >= 40) return "中高薪成长层";
  if (maxK >= 25) return "主流机会层";
  if (maxK > 0) return "入门验证层";
  return "待样本校验";
}

function routeFor(segment, fallback = "") {
  const text = `${segment}\n${fallback}`;
  if (/芯片|GPU|服务器|智算|数据中心|IDC|半导体|算力/.test(text)) return "硬件/算力/半导体路线";
  if (/工业|制造|视觉|安防|质检|汽车|机器人|具身/.test(text)) return "行业解决方案路线";
  return "AI软件落地路线";
}

function roleFamilyFor(value) {
  const text = String(value || "");
  if (/总监|负责人|管理|主管|经理-管理|销售经理-管理/.test(text)) return "销售管理/区域负责人";
  if (/售前|解决方案|顾问|方案|POC|Demo|述标|技术交流/.test(text)) return "售前/解决方案顾问";
  if (/渠道|生态|伙伴|代理/.test(text)) return "渠道/生态/伙伴销售";
  if (/海外|出海|国际|跨境/.test(text)) return "海外/出海商业化";
  if (/SaaS|智能体|AI销售|大模型|软件销售|人工智能/.test(text)) return "AI软件/大模型销售";
  if (/应用|客服|营销|销售AI/.test(text)) return "SaaS/应用销售";
  if (/销售|客户|KA|BD|商务|行业/.test(text)) return "大客户/行业销售经理";
  return "大客户/行业销售经理";
}

function conclusionPermission(row) {
  if (row.bossReadableSalaryCount >= 3 && row.bossDetailCount >= 3) return "可写BOSS薪资/能力方向结论";
  if (row.bossReadableSalaryCount >= 1 && row.bossUsableCount >= 1) return "可写BOSS薪资观察";
  if (row.bossUsableCount >= 1) return "可写BOSS方向观察";
  if (row.publicSalaryEvidenceCount >= 3) return "只能写公开薪资假设";
  if (row.publicSignalCount >= 1) return "只能写公开岗位信号";
  return "待采样，不写结论";
}

function evidenceGrade(row) {
  if (row.bossReadableSalaryCount >= 3 && row.bossDetailCount >= 3) return "强";
  if (row.bossReadableSalaryCount >= 1 || row.bossUsableCount >= 2) return "中";
  if (row.publicSalaryEvidenceCount >= 3) return "中弱";
  if (row.publicSalaryEvidenceCount >= 1 || row.publicSignalCount >= 1) return "弱";
  return "缺";
}

function ensureGroup(map, route, segment, roleFamily) {
  const key = `${route}||${segment || "未分赛道"}||${roleFamily}`;
  if (!map.has(key)) {
    map.set(key, {
      route,
      segment: segment || "未分赛道",
      roleFamily,
      companyTypes: [],
      representativeCompanies: [],
      salaryRanges: [],
      bossUsableCount: 0,
      bossReadableSalaryCount: 0,
      bossDetailCount: 0,
      publicSalaryEvidenceCount: 0,
      publicSignalCount: 0,
      sourceExamples: [],
      coreCapabilities: [],
      mustHaveGates: [],
      focusCompanies: [],
      focusBatchIds: [],
      sampleProgress: "",
      sampleGap: ""
    });
  }
  return map.get(key);
}

function addExample(row, text) {
  if (text && row.sourceExamples.length < 5) row.sourceExamples.push(text);
}

const deliveryRows = readCsv(deliveryCsvPath);
const qualityRows = readCsv(qualityCsvPath);
const externalRows = readCsv(externalSalaryPath);
const bossSignalRows = readCsv(bossSignalPath);
const focusRows = readCsv(focusCoveragePath);
const focusBatchRows = readCsv(focusBatchPath);

const groups = new Map();

for (const row of deliveryRows) {
  const roles = splitList(row.roleFocus).length ? splitList(row.roleFocus) : ["AI销售"];
  for (const role of roles) {
    const roleFamily = roleFamilyFor(role);
    const group = ensureGroup(groups, row.route || routeFor(row.segment), row.segment, roleFamily);
    group.companyTypes.push(row.companyType);
    group.representativeCompanies.push(...splitList(row.representativeCompanies));
    group.salaryRanges.push(...salaryRanges(row.salaryBand));
    group.publicSalaryEvidenceCount += /公开薪资/.test(row.salaryPermission || "") ? 1 : 0;
    group.coreCapabilities.push(...splitList(row.coreCapabilities));
    group.mustHaveGates.push(...splitList(row.mustHaveGate));
    group.sampleProgress = group.sampleProgress || row.sampleProgress;
    group.sampleGap = group.sampleGap || row.sampleGap;
    addExample(group, `${row.segment}/${role}/${row.salaryBand}`);
  }
}

for (const row of externalRows) {
  const roleFamily = roleFamilyFor(row.role);
  const route = routeFor(row.segment, row.role);
  const group = ensureGroup(groups, route, row.segment, roleFamily);
  group.salaryRanges.push(...salaryRanges(row.salary));
  group.publicSalaryEvidenceCount += salaryRanges(row.salary).length ? 1 : 0;
  group.coreCapabilities.push(...splitList(row.requirement_signal));
  group.representativeCompanies.push(row.company_or_page);
  addExample(group, `${row.platform}/${row.role}/${row.salary}`);
}

for (const row of bossSignalRows) {
  const roleFamily = roleFamilyFor(row.role_signal);
  const route = routeFor(row.segment, row.role_signal);
  const group = ensureGroup(groups, route, row.segment, roleFamily);
  group.salaryRanges.push(...salaryRanges(row.salary_signal));
  group.publicSignalCount += 1;
  group.publicSalaryEvidenceCount += salaryRanges(row.salary_signal).length ? 1 : 0;
  group.representativeCompanies.push(row.company);
  addExample(group, `BOSS公开信号/${row.company}/${row.role_signal}${row.salary_signal ? `/${row.salary_signal}` : ""}`);
}

for (const row of qualityRows) {
  const roleFamily = row.roleFamily || roleFamilyFor(`${row.title}\n${row.roleFamily}`);
  const route = row.route || routeFor(row.segment, row.title);
  const group = ensureGroup(groups, route, row.segment, roleFamily);
  const ranges = salaryRanges(row.salaryReadableText || row.salaryRaw);
  group.salaryRanges.push(...ranges);
  group.bossUsableCount += numberOf(row.qualityScore) >= 65 && boolOf(row.roleRelevant) && boolOf(row.aiRelevant) ? 1 : 0;
  group.bossReadableSalaryCount += boolOf(row.salaryReadable) ? 1 : 0;
  group.bossDetailCount += numberOf(row.detailTextLength) >= 300 ? 1 : 0;
  group.representativeCompanies.push(row.company);
  addExample(group, `BOSS样本/${row.company}/${row.title}/${row.salaryReadableText || row.salaryRaw}`);
}

for (const row of focusRows) {
  if (!["缺人工批次", "待人工导入BOSS样本", "已有旧样本/缺当前人工批次"].includes(row.coverageGate)) continue;
  const roleFamily = roleFamilyFor(row.nextRole);
  const group = ensureGroup(groups, row.route || routeFor(row.segment, row.nextRole), row.segment || row.focusGroup, roleFamily);
  group.focusCompanies.push(row.company);
}

for (const row of focusBatchRows) {
  const group = ensureGroup(groups, row.route || routeFor(row.segment, row.role), row.segment, row.roleFamily || roleFamilyFor(row.role));
  group.focusBatchIds.push(row.batchId);
  group.focusCompanies.push(row.company);
}

const outputRows = [...groups.values()].map((row) => {
  const salaryMinK = row.salaryRanges.length ? Math.min(...row.salaryRanges.map((item) => item.low)) : 0;
  const salaryMaxK = row.salaryRanges.length ? Math.max(...row.salaryRanges.map((item) => item.high)) : 0;
  const normalized = {
    ...row,
    salaryMinK,
    salaryMaxK,
    salaryBand: salaryBand(row.salaryRanges),
    salaryTier: salaryTier(salaryMaxK),
    companyType: topItems(row.companyTypes, 3),
    representativeCompanies: topItems(row.representativeCompanies, 8),
    publicSalaryEvidenceCount: row.publicSalaryEvidenceCount,
    publicSignalCount: row.publicSignalCount,
    coreCapabilitiesText: topItems(row.coreCapabilities, 8),
    mustHaveGateText: topItems(row.mustHaveGates, 5),
    focusCompaniesText: topItems(row.focusCompanies, 6),
    focusBatchIdsText: topItems(row.focusBatchIds, 6),
    sourceExamplesText: topItems(row.sourceExamples, 5)
  };
  normalized.evidenceGrade = evidenceGrade(normalized);
  normalized.conclusionPermission = conclusionPermission(normalized);
  normalized.nextAction = normalized.focusCompaniesText
    ? `优先补 ${normalized.focusCompaniesText} 的 ${normalized.roleFamily} 岗位详情`
    : `继续扩大 ${normalized.segment}/${normalized.roleFamily} 样本`;
  normalized.evidenceBoundary = normalized.conclusionPermission.includes("BOSS")
    ? "可写阶段观察，但不能外推为全市场统计"
    : "只能作为公开资料假设，必须等BOSS详情样本校验";
  return normalized;
}).sort((a, b) => {
  const gradeRank = { 强: 4, 中: 3, 中弱: 2, 弱: 1, 缺: 0 };
  return b.salaryMaxK - a.salaryMaxK ||
    (gradeRank[b.evidenceGrade] || 0) - (gradeRank[a.evidenceGrade] || 0) ||
    b.publicSalaryEvidenceCount - a.publicSalaryEvidenceCount;
});

const csvHeaders = [
  "route",
  "segment",
  "roleFamily",
  "salaryTier",
  "salaryBand",
  "salaryMinK",
  "salaryMaxK",
  "bossUsableCount",
  "bossReadableSalaryCount",
  "bossDetailCount",
  "publicSalaryEvidenceCount",
  "publicSignalCount",
  "evidenceGrade",
  "conclusionPermission",
  "companyType",
  "representativeCompanies",
  "coreCapabilitiesText",
  "mustHaveGateText",
  "focusCompaniesText",
  "focusBatchIdsText",
  "nextAction",
  "evidenceBoundary",
  "sourceExamplesText"
];

mkdirSync(dirname(outputMdPath), { recursive: true });
writeFileSync(outputCsvPath, `${csv([csvHeaders, ...outputRows.map((row) => csvHeaders.map((header) => row[header]))])}\n`);

const tierSummary = [...new Map(outputRows.map((row) => [row.salaryTier, row.salaryTier])).keys()].map((tier) => {
  const rows = outputRows.filter((row) => row.salaryTier === tier);
  return `| ${tier} | ${rows.length} | ${Math.max(...rows.map((row) => row.salaryMaxK)) || 0}K | ${topItems(rows.map((row) => row.segment), 6).replaceAll(";", "、")} | ${topItems(rows.flatMap((row) => splitList(row.coreCapabilitiesText)), 6).replaceAll(";", "、")} |`;
});

const routeSummary = [...new Map(outputRows.map((row) => [row.route, row.route])).keys()].map((route) => {
  const rows = outputRows.filter((row) => row.route === route);
  const bossReadable = rows.reduce((sum, row) => sum + row.bossReadableSalaryCount, 0);
  const publicSalary = rows.reduce((sum, row) => sum + row.publicSalaryEvidenceCount, 0);
  return `| ${route} | ${rows.length} | ${salaryBand(rows.flatMap((row) => row.salaryRanges))} | ${bossReadable} | ${publicSalary} | ${topItems(rows.flatMap((row) => splitList(row.focusCompaniesText)), 5).replaceAll(";", "、") || "-"} |`;
});

const radarRows = outputRows.slice(0, 20).map((row) => {
  return `| ${row.evidenceGrade} | ${row.route} | ${row.segment} | ${row.roleFamily} | ${row.salaryBand} | ${row.bossReadableSalaryCount}/${row.publicSalaryEvidenceCount} | ${row.conclusionPermission} | ${row.coreCapabilitiesText.replaceAll(";", "、") || "-"} | ${row.nextAction} |`;
});

const capabilityCounts = new Map();
for (const row of outputRows) {
  for (const capability of splitList(row.coreCapabilitiesText)) {
    capabilityCounts.set(capability, (capabilityCounts.get(capability) || 0) + 1);
  }
}
const capabilityRows = [...capabilityCounts.entries()]
  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-Hans-CN"))
  .slice(0, 12)
  .map(([capability, count]) => `| ${capability} | ${count} | ${capabilityAdvice(capability)} |`);

function capabilityAdvice(capability) {
  if (/大客户|KA/.test(capability)) return "简历必须补大客户闭环：客户、周期、金额、关键动作、结果";
  if (/AI|大模型|模型|智能/.test(capability)) return "补AI产品到业务场景的表达，避免只写概念";
  if (/方案|售前|POC|Demo/.test(capability)) return "补需求调研、方案宣讲、POC或述标证据";
  if (/回款|合同|商务/.test(capability)) return "补合同额、回款、达成率、续费或增购";
  if (/渠道|生态/.test(capability)) return "补伙伴数量、联合商机和渠道收入";
  if (/硬件|智算|半导体|芯片/.test(capability)) return "补算力/硬件链路、政企或渠道项目经验";
  if (/行业|场景/.test(capability)) return "补一个制造/政企/教育/金融等行业场景案例";
  return "补可量化项目证据";
}

const sourceStats = {
  deliveryRows: deliveryRows.length,
  bossQualityRows: qualityRows.length,
  bossReadableRows: qualityRows.filter((row) => boolOf(row.salaryReadable)).length,
  externalSalaryRows: externalRows.length,
  bossSignalRows: bossSignalRows.length,
  focusCoverageRows: focusRows.length,
  focusBatchRows: focusBatchRows.length,
  radarRows: outputRows.length
};

const md = `# AI销售薪资能力证据雷达

更新时间：${formatDate()}

## 一、本质判断

这份雷达不是新的 BOSS 抓取结果，而是把现有证据按“薪资、岗位族、能力要求、结论权限”重新组织。它解决的是：你需要知道 AI 销售岗位到底值多少钱、要求什么能力，但当前 BOSS 干净样本还不足，必须把 BOSS样本、公开薪资信号和待采样缺口分层表达。

当前最大的矛盾是：既要给出可用的市场判断，又不能把公开信号或少量样本写成 BOSS 平台大样本统计。

## 二、证据来源

| 来源 | 数量 |
| --- | ---: |
| 交付版赛道/岗位行 | ${sourceStats.deliveryRows} |
| BOSS质量样本 | ${sourceStats.bossQualityRows} |
| BOSS可读薪资样本 | ${sourceStats.bossReadableRows} |
| 公开薪资信号 | ${sourceStats.externalSalaryRows} |
| BOSS公开公司/岗位信号 | ${sourceStats.bossSignalRows} |
| 重点覆盖审计公司 | ${sourceStats.focusCoverageRows} |
| 重点补样入口 | ${sourceStats.focusBatchRows} |
| 雷达组合行 | ${sourceStats.radarRows} |

## 三、薪资层级

| 薪资层级 | 组合数 | 最高月薪信号 | 主要赛道 | 高频能力 |
| --- | ---: | ---: | --- | --- |
${tierSummary.join("\n")}

## 四、路线视角

| 路线 | 组合数 | 薪资信号范围 | BOSS可读薪资 | 公开薪资证据 | 下一批重点公司 |
| --- | ---: | --- | ---: | ---: | --- |
${routeSummary.join("\n")}

## 五、岗位族雷达

| 证据等级 | 路线 | 赛道 | 岗位族 | 薪资信号 | BOSS/公开薪资 | 结论权限 | 高频能力 | 下一动作 |
| --- | --- | --- | --- | --- | ---: | --- | --- | --- |
${radarRows.join("\n")}

## 六、能力要求雷达

| 能力 | 覆盖组合数 | 简历证据动作 |
| --- | ---: | --- |
${capabilityRows.join("\n")}

## 七、结论边界

- “强/中”等级可以写阶段观察，但不能写成全市场统计。
- “中弱/弱”等级只能写公开信号假设，必须标注待 BOSS 样本校验。
- 薪资范围保留月薪 K 口径，不把不同平台、不同薪制强行换算成中位数。
- 能力要求优先来自岗位详情和交付矩阵；公开信号只用于补充方向。

## 八、CSV输出

\`\`\`text
${outputCsvPath}
\`\`\`
`;

writeFileSync(outputMdPath, md);

console.log(`已生成：${outputMdPath}`);
console.log(`已生成：${outputCsvPath}`);
console.log(`雷达组合行：${outputRows.length}`);
console.log(`BOSS可读薪资样本：${sourceStats.bossReadableRows}`);
console.log(`公开薪资信号：${sourceStats.externalSalaryRows}`);
