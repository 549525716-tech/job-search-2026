#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const profilePath = join(projectRoot, "02_岗位画像/data/我的能力画像.json");
const publicLeadsPath = join(projectRoot, "01_行情收集/公开高薪销售岗位补充线索.csv");
const gapCsvPath = join(projectRoot, "03_简历/AI销售岗位匹配与能力Gap.csv");
const outputPath = join(projectRoot, "03_简历/两步法_个人画像优先主控台.md");

function splitCsvRecords(text) {
  const records = [];
  let current = "";
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '""';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (current.trim()) records.push(current);
      current = "";
      if (char === "\r" && next === "\n") index += 1;
    } else {
      current += char;
    }
  }
  if (current.trim()) records.push(current);
  return records;
}

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
  const records = splitCsvRecords(text).filter((record) => record.trim());
  if (!records.length) return [];
  const headers = parseCsvLine(records.shift());
  return records.map((record) => {
    const values = parseCsvLine(record);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
  });
}

function readCsvIfExists(filePath) {
  if (!existsSync(filePath)) return [];
  return parseCsv(readFileSync(filePath, "utf8"));
}

function readJsonIfExists(filePath, fallback = {}) {
  if (!existsSync(filePath)) return fallback;
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function formatDateTime(value = new Date()) {
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

function countBy(rows, key) {
  const counts = new Map();
  for (const row of rows) {
    const value = row[key] || "未分类";
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function tableRows(rows, fallback) {
  return rows.length ? rows.join("\n") : fallback;
}

function list(items, limit = 8) {
  return Array.isArray(items) ? items.slice(0, limit).join("<br>") : "";
}

function normalizeScore(value) {
  const num = Number.parseFloat(String(value || "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(num) ? num : 0;
}

function topGapRows(rows) {
  const riskRank = { "高": 4, "中高": 3, "中": 2, "低": 1 };
  return rows
    .slice()
    .sort((a, b) => {
      return (riskRank[b.riskLevel] || 0) - (riskRank[a.riskLevel] || 0)
        || normalizeScore(b.salaryEvidenceCount) - normalizeScore(a.salaryEvidenceCount);
    })
    .slice(0, 8);
}

const profile = readJsonIfExists(profilePath);
const leads = readCsvIfExists(publicLeadsPath);
const gapRows = readCsvIfExists(gapCsvPath);
const routes = profile.marketComparisonSnapshot?.bestFitRoutes || profile.twoStepMemory?.step2MarketComparison?.priorityRoutes || [];
const gapStack = profile.twoStepMemory?.step2MarketComparison?.gapStack || [];

const roleRows = countBy(leads, "roleFamily").map(([role, count]) => `| ${role} | ${count} |`);
const sourceRows = countBy(leads, "source").map(([source, count]) => `| ${source} | ${count} |`);
const routeRows = routes.map((route) => {
  if (typeof route === "string") return `| ${route} | - | 来自个人画像优先路线 |`;
  return `| ${route.route} | ${route.fitScore ?? "-"} | ${route.reason || ""} |`;
});
const p0Rows = gapStack.map((gap) => `| ${gap.priority || "-"} | ${gap.gap} | ${gap.minimumOutput} |`);
const topMarketGapRows = topGapRows(gapRows).map((row, index) => {
  return `| ${index + 1} | ${row.segment} | ${row.role} | ${row.salaryBand} | ${row.fitStatus} | ${row.riskLevel} | ${row.missingCapabilities} |`;
});

const md = `# 两步法：个人画像优先主控台

更新时间：${formatDateTime()}

## 一、本质判断

这件事本质上不是先抓岗位、再把简历往岗位上套，而是先建立你的个人事实记忆，再用市场岗位验证能力差值。

固定顺序：

1. **先总结自己**：读取简历事实，确认直接证据、可迁移证据、不能夸大的边界。
2. **再对比市场**：读取岗位样本和薪资信号，判断市场买什么能力、你覆盖了什么、缺什么。

## 二、第一步：你的当前画像

| 维度 | 当前结论 |
| --- | --- |
| 当前身份 | ${profile.profileMemory?.positioning || profile.twoStepMemory?.step1SelfSummary?.coreIdentity || profile.currentSummary || "待补"} |
| 直接证据 | ${list(profile.profileMemory?.directProof || profile.twoStepMemory?.step1SelfSummary?.directEvidence)} |
| 可迁移证据 | ${list(profile.profileMemory?.transferableProof)} |
| 不能夸大的边界 | ${list(profile.profileMemory?.hardBoundaries)} |
| 固定判断规则 | ${profile.profileMemory?.comparisonRule || profile.twoStepMemory?.step2MarketComparison?.comparisonRule || "先判断直接匹配、可迁移、硬缺口，再决定简历表达。"} |

### 当前最强证据

1. 销售结果强：特斯拉个人销冠、600+ 台交付、单日 23 台。
2. 销售管理强：乐道团队季度目标超 200%，带教 21 人，培养 10 人晋升。
3. 客户经营强：懂车帝区域月消耗 30 万到 40 万，二手车 KA 稳定消耗 6 个月。
4. 可迁移到 AI/互联网销售的能力：客户诊断、销售漏斗、ROI 表达、多层级沟通、销售管理、AI 工具提效。
5. 不能硬写的能力：真实 AI 产品签约回款、客户级 AI POC、企业 IT 采购链路、硬件/智算/半导体项目。

## 三、第二步：市场对比

本轮市场对比基于项目内已有岗位样本和公开高薪销售线索，不新增 BOSS 自动化采集。

| 指标 | 当前值 |
| --- | ---: |
| 公开高薪销售线索 | ${leads.length} |
| 岗位匹配 Gap 行 | ${gapRows.length} |
| 个人画像来源 | ${Array.isArray(profile.sourceFiles) ? profile.sourceFiles.length : 0} 份简历/画像文件 |

### 高薪线索岗位族分布

| 岗位族 | 线索数 |
| --- | ---: |
${tableRows(roleRows, "| 暂无 | 0 |")}

### 高薪线索来源分布

| 来源 | 线索数 |
| --- | ---: |
${tableRows(sourceRows, "| 暂无 | 0 |")}

### 最适合优先主攻的路线

| 路线 | 匹配分 | 判断 |
| --- | ---: | --- |
${tableRows(routeRows, "| 暂无 | - | - |")}

## 四、能力差值

| 优先级 | Gap | 最小补强产出 |
| --- | --- | --- |
${tableRows(p0Rows, "| P0 | 待补 | 待补 |")}

### 市场岗位映射出的前置风险

| 序号 | 赛道 | 岗位方向 | 薪资观察 | 当前匹配状态 | 风险 | 缺口能力 |
| ---: | --- | --- | --- | --- | --- | --- |
${tableRows(topMarketGapRows, "| 暂无 |  |  |  |  |  |  |")}

## 五、下一步动作

1. 先补个人画像，不先改正式简历：把合同/回款、销售周期、关键人、预算、竞品、异议处理补成 STAR 证据。
2. 优先做 4 个最小产出：AI 产品销售方案、2 个 Demo 说明、商业结果口径表、KA 推进 STAR 案例。
3. 市场采样继续低频进行，但每次新增岗位后都要先回到本文件，判断是直接匹配、可迁移还是硬缺口。
4. 第一阶段主攻 AI 应用/营销 AI/SaaS、互联网广告/平台型 2B、平台型工业品/汽车 AI 补充线；硬件/智算/半导体先观察和补课。
`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, md);

console.log(`已生成：${outputPath}`);
console.log(`公开高薪线索：${leads.length}`);
console.log(`岗位匹配Gap行：${gapRows.length}`);
