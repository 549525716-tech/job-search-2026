#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const segmentPath = join(projectRoot, "06_自动化采集/config/ai_company_segments.csv");
const searchConfigPath = join(projectRoot, "06_自动化采集/config/searches.json");
const samplingTaskStatusPath = join(projectRoot, "01_行情收集/BOSS采样任务状态.csv");
const roleSalaryMatrixPath = join(projectRoot, "01_行情收集/AI销售岗位薪资能力矩阵.csv");
const outputCsvPath = join(projectRoot, "00_行业资料集/AI产业链头部公司岗位机会地图.csv");
const outputMdPath = join(projectRoot, "00_行业资料集/AI产业链头部公司岗位机会地图.md");
const safeBossHomeUrl = "https://www.zhipin.com/";

const roleTermsBySegment = {
  "基座大模型/Agent平台": ["AI销售", "大模型销售", "解决方案顾问"],
  "云计算/大模型平台": ["AI销售", "大客户销售", "解决方案顾问"],
  "智能客服/营销/销售AI": ["AI销售", "SaaS销售", "销售经理"],
  "AI芯片/GPU/加速卡": ["大客户销售", "渠道销售", "解决方案顾问"],
  "AI服务器/智算基础设施": ["大客户销售", "行业销售", "售前"],
  "工业AI/智能制造": ["大客户销售", "销售经理", "解决方案顾问"],
  "AI Agent/RPA/流程自动化": ["AI销售", "大客户销售", "售前"],
  "数据/MLOps/AI基础软件": ["大客户销售", "解决方案顾问", "售前"],
  "智能汽车/机器人/具身智能": ["渠道销售", "海外销售", "销售经理"],
  "AI安全/私有化/信创": ["政企销售", "大客户销售", "销售经理"],
  "AI视觉/安防/质检": ["行业销售", "渠道销售", "售前"],
  "智算中心/数据中心服务": ["大客户销售", "渠道销售", "销售经理"]
};

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

function readCsvIfExists(filePath) {
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

function priorityRank(value) {
  const number = Number(value || 99);
  return Number.isFinite(number) ? number : 99;
}

function searchUrl(company, role, cityName, searchConfig) {
  const source = searchConfig.sources.find((item) => item.name === "BOSS直聘" && item.enabled);
  const cityCode = searchConfig.defaultCityCodes[cityName] ?? searchConfig.defaultCityCodes["全国"];
  const query = `${company} ${role}`;
  return source.urlTemplate
    .replaceAll("{queryEncoded}", encodeURIComponent(query))
    .replaceAll("{query}", query)
    .replaceAll("{cityCode}", cityCode)
    .replaceAll("{city}", cityName);
}

function searchKeyword(company, role) {
  return `${company} ${role}`.trim();
}

function opportunityScore(company, taskRows, matrixRows) {
  const base = Math.max(1, 6 - priorityRank(company.priority));
  const taskMatches = taskRows.filter((task) => task.company === company.company);
  const uncovered = taskMatches.filter((task) => task.status !== "已覆盖").length;
  const covered = taskMatches.filter((task) => task.status === "已覆盖").length;
  const segmentRows = matrixRows.filter((row) => row.segment === company.segment);
  const salaryEvidence = segmentRows.reduce((sum, row) => sum + Number(row.salaryEvidenceCount || 0), 0);
  const sampleGap = Math.max(...segmentRows.map((row) => Number(row.sampleGap || 0)), 0);
  return base * 10 + Math.min(20, uncovered * 2) + Math.min(20, sampleGap) + Math.min(10, salaryEvidence) - covered * 2;
}

function opportunityLevel(score) {
  if (score >= 70) return "P0优先采样";
  if (score >= 50) return "P1重点跟进";
  return "P2补充观察";
}

function mdRows(rows, fallback) {
  return rows.length ? rows.join("\n") : fallback;
}

const companies = readCsvIfExists(segmentPath);
const taskRows = readCsvIfExists(samplingTaskStatusPath);
const matrixRows = readCsvIfExists(roleSalaryMatrixPath);
const searchConfig = JSON.parse(readFileSync(searchConfigPath, "utf8"));
const city = "广州";

const opportunityRows = companies
  .map((company) => {
    const roles = roleTermsBySegment[company.segment] || ["AI销售", "大客户销售", "解决方案顾问"];
    const tasks = taskRows.filter((task) => task.company === company.company);
    const totalTasks = tasks.length;
    const coveredTasks = tasks.filter((task) => task.status === "已覆盖").length;
    const pendingTasks = tasks.filter((task) => task.status !== "已覆盖").length;
    const matrix = matrixRows.filter((row) => row.segment === company.segment);
    const score = opportunityScore(company, taskRows, matrixRows);
    return {
      segment: company.segment,
      layer: company.layer,
      company: company.company,
      priority: company.priority,
      opportunityLevel: opportunityLevel(score),
      opportunityScore: score,
      keywords: company.keywords,
      salesFit: company.sales_fit,
      roleTerms: roles.join(";"),
      salaryObservation: matrix.map((row) => `${row.role}:${row.salaryBand}`).slice(0, 3).join(";"),
      coreCapabilities: matrix.map((row) => row.coreCapabilities).filter(Boolean).slice(0, 1).join(";"),
      samplingStatus: totalTasks ? `${coveredTasks}/${totalTasks} 覆盖，${pendingTasks} 待采` : "未进入189任务包",
      coveredTasks,
      totalTasks,
      pendingTasks,
      safeBossHomeUrl,
      searchKeyword: searchKeyword(company.company, roles[0]),
      firstSearchUrl: searchUrl(company.company, roles[0], city, searchConfig),
      nextAction: `先搜 ${company.company} ${roles[0]}，再补 ${roles.slice(1).join("/")}`
    };
  })
  .sort((a, b) => b.opportunityScore - a.opportunityScore || priorityRank(a.priority) - priorityRank(b.priority) || a.segment.localeCompare(b.segment, "zh-Hans-CN"));

mkdirSync(dirname(outputCsvPath), { recursive: true });

const headers = [
  "segment",
  "layer",
  "company",
  "priority",
  "opportunityLevel",
  "opportunityScore",
  "keywords",
  "salesFit",
  "roleTerms",
  "salaryObservation",
  "coreCapabilities",
  "samplingStatus",
  "coveredTasks",
  "totalTasks",
  "pendingTasks",
  "safeBossHomeUrl",
  "searchKeyword",
  "firstSearchUrl",
  "nextAction"
];
writeFileSync(outputCsvPath, `${csv([headers])}\n${csv(opportunityRows.map((row) => headers.map((header) => row[header])))}\n`);

const segmentSummaryRows = [...new Set(companies.map((item) => item.segment))].map((segment) => {
  const rows = opportunityRows.filter((row) => row.segment === segment);
  const topCompanies = rows.slice(0, 10).map((row) => row.company).join("、");
  const avgScore = rows.reduce((sum, row) => sum + row.opportunityScore, 0) / Math.max(1, rows.length);
  const covered = rows.reduce((sum, row) => sum + Number(row.coveredTasks || 0), 0);
  const pending = rows.reduce((sum, row) => sum + Number(row.pendingTasks || 0), 0);
  return `| ${segment} | ${rows.length} | ${avgScore.toFixed(1)} | ${covered} | ${pending} | ${topCompanies} |`;
});

const topRows = opportunityRows.slice(0, 60).map((row, index) => {
  return `| ${index + 1} | ${row.opportunityLevel} | ${row.segment} | ${row.company} | ${row.roleTerms} | ${row.salaryObservation || "待补薪资样本"} | ${row.samplingStatus} | ${row.safeBossHomeUrl} | \`${row.searchKeyword}\` | ${row.nextAction} |`;
});

const segmentSections = [...new Set(companies.map((item) => item.segment))].map((segment) => {
  const rows = opportunityRows
    .filter((row) => row.segment === segment)
    .slice(0, 10)
    .map((row, index) => `| ${index + 1} | ${row.company} | ${row.layer} | ${row.salesFit} | ${row.roleTerms} | ${row.salaryObservation || "待补薪资样本"} | ${row.samplingStatus} |`);
  return `### ${segment}

| 序号 | 公司 | 层级 | 销售机会 | 优先岗位词 | 薪资观察 | 样本状态 |
| ---: | --- | --- | --- | --- | --- | --- |
${mdRows(rows, "| 暂无 |  |  |  |  |  |  |")}`;
});

const md = `# AI产业链头部公司岗位机会地图

更新时间：${formatDate()}

## 一、本质判断

这份地图不是公司名录，而是把 AI 产业链公司池转成求职采样路径：哪些公司优先看、看什么销售岗位、当前有没有 BOSS 样本、下一步搜索什么。

## 二、赛道总览

| 赛道 | 公司数 | 平均机会分 | 已覆盖任务 | 待采样任务 | 优先公司 |
| --- | ---: | ---: | ---: | ---: | --- |
${mdRows(segmentSummaryRows, "| 暂无 | 0 | 0 | 0 | 0 |  |")}

## 三、前60个优先采样公司

| 序号 | 机会等级 | 赛道 | 公司 | 优先岗位词 | 薪资观察 | 样本状态 | BOSS首页 | 站内搜索关键词 | 下一步动作 |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${mdRows(topRows, "| 暂无 |  |  |  |  |  |  |  |  |  |")}

## 四、分赛道头部公司

${segmentSections.join("\n\n")}

## 五、使用方法

1. 优先按“前60个优先采样公司”逐个处理：先打开 BOSS 首页，再在站内搜索框输入“站内搜索关键词”。
2. 复制岗位卡片或详情页后，使用对应公司和岗位词运行 \`npm run import:manual\`。
3. 每导入 10 条后运行：\`npm run sampling:status && npm run salary:signals && npm run matrix:roles && npm run audit:research\`。
4. 当某赛道达到 10 到 12 条 BOSS 样本后，再更新薪资判断和简历匹配策略。

## 六、边界

机会分是求职采样优先级，不是公司财务排名。它综合了公司池优先级、BOSS采样缺口、薪资证据和岗位词覆盖情况；最终仍要以 BOSS 实际在招岗位为准。

## 七、文件

\`\`\`text
${outputCsvPath}
\`\`\`
`;

writeFileSync(outputMdPath, md);

console.log(`已生成：${outputCsvPath}`);
console.log(`已生成：${outputMdPath}`);
console.log(`公司数：${opportunityRows.length}`);
