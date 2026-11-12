#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const roleMatrixPath = join(projectRoot, "01_行情收集/AI销售岗位薪资能力矩阵.csv");
const capabilityMatrixPath = join(projectRoot, "02_岗位画像/AI销售岗位能力要求矩阵.csv");
const decisionOverviewPath = join(projectRoot, "01_行情收集/AI销售岗位市场决策总览.csv");
const externalSalaryPath = join(projectRoot, "06_自动化采集/config/external_salary_signals.csv");
const jobsPath = join(projectRoot, "01_行情收集/data/jobs.jsonl");
const outputMdPath = join(projectRoot, "01_行情收集/AI销售岗位薪资待遇与能力门槛分析.md");
const outputCsvPath = join(projectRoot, "01_行情收集/AI销售岗位薪资待遇与能力门槛分析.csv");

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

function readBossJobCount(filePath) {
  if (!existsSync(filePath)) return 0;
  return readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => {
      try {
        const job = JSON.parse(line);
        return !job.source || job.source === "BOSS直聘";
      } catch {
        return false;
      }
    }).length;
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

function splitSemi(value) {
  return String(value || "").split(";").map((item) => item.trim()).filter(Boolean);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function topJoined(values, limit = 6, separator = "、") {
  return unique(values).slice(0, limit).join(separator);
}

function numberOf(value) {
  const num = Number.parseFloat(String(value || "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(num) ? num : 0;
}

function salaryRanges(value) {
  return [...String(value || "").matchAll(/(\d+(?:\.\d+)?)\s*K\s*[-~－—]\s*(\d+(?:\.\d+)?)\s*K/gi)]
    .map((match) => ({
      low: Number.parseFloat(match[1]),
      high: Number.parseFloat(match[2])
    }))
    .filter((range) => Number.isFinite(range.low) && Number.isFinite(range.high));
}

function salaryMax(value) {
  const ranges = salaryRanges(value);
  if (!ranges.length) return 0;
  return Math.max(...ranges.map((range) => range.high));
}

function salaryMin(value) {
  const ranges = salaryRanges(value);
  if (!ranges.length) return 0;
  return Math.min(...ranges.map((range) => range.low));
}

function salaryTier(maxSalary) {
  if (maxSalary >= 60) return "高薪核心层";
  if (maxSalary >= 40) return "中高薪成长层";
  if (maxSalary >= 25) return "主流机会层";
  if (maxSalary > 0) return "入门验证层";
  return "待样本校验";
}

function salaryTierInterpretation(tier) {
  return {
    高薪核心层: "通常对应大模型/MaaS、AI芯片、云大客户或高阶管理岗，核心不是会销售，而是能推进复杂客户和高客单价方案。",
    中高薪成长层: "通常对应AI软件、工业AI、智能客服/营销AI、智算/IDC和安全方向，需要同时证明行业客户、方案表达和商务闭环。",
    主流机会层: "通常对应应用型SaaS、AI工具、区域客户经理和部分售前岗位，重点看ToB销售基本功和产品理解。",
    入门验证层: "通常对应泛AI产品销售或线索转化岗，适合补AI产品语言、客户场景和销售漏斗证据。",
    待样本校验: "当前缺少可读薪资样本，先作为采样方向，不能做薪资判断。"
  }[tier] || "";
}

function routeFor(row) {
  const segment = row.segment || "";
  const role = row.role || "";
  if (/芯片|GPU|服务器|智算|数据中心|IDC/.test(segment + role)) return "硬件/算力/半导体路线";
  if (/云计算|MaaS|大模型平台/.test(segment + role)) return "云与MaaS大客户路线";
  if (/基座大模型|Agent|AI软件/.test(segment + role)) return "AI软件/大模型商业化路线";
  if (/智能客服|营销|销售AI|SaaS/.test(segment + role)) return "应用SaaS/销售管理路线";
  if (/工业|制造/.test(segment + role)) return "工业AI/制造业解决方案路线";
  if (/安全|私有化|信创/.test(segment + role)) return "政企私有化/安全路线";
  return "综合AI销售路线";
}

function gateFor(row, maxSalary) {
  const caps = splitSemi(row.coreCapabilities);
  const gates = [];
  if (maxSalary >= 40) gates.push("必须有可量化大客户/行业客户案例");
  if (caps.includes("AI/大模型产品理解")) gates.push("必须能讲清AI产品到业务场景的价值");
  if (caps.includes("方案宣讲/解决方案")) gates.push("需要需求调研、Demo/POC或方案汇报证据");
  if (caps.includes("硬件/智算/半导体行业销售") || /芯片|服务器|智算|数据中心/.test(row.segment + row.role)) gates.push("需要硬件/算力/生态链路理解");
  if (caps.includes("渠道/生态合作")) gates.push("需要渠道伙伴、生态合作或联合商机证据");
  if (caps.includes("回款/合同/商务闭环")) gates.push("需要合同额、回款、达成率或续费增购数据");
  return unique(gates).slice(0, 4).join("；") || "补充真实岗位样本后再定门槛";
}

function evidenceLevel(row, bossJobs) {
  const evidenceCount = numberOf(row.salaryEvidenceCount);
  const progress = String(row.sampleProgress || "").match(/^(\d+)\//);
  const bossSamples = progress ? Number.parseInt(progress[1], 10) : 0;
  if (bossSamples >= 10) return "强：已有赛道级BOSS样本";
  if (bossSamples >= 4) return "中：已有少量BOSS样本";
  if (evidenceCount >= 5 && bossJobs < 20) return "中弱：公开薪资信号较多，但BOSS样本不足";
  if (evidenceCount > 0) return "弱：有公开薪资信号，需BOSS校验";
  return "缺：待采样";
}

function aggregate(rows, keyFn) {
  const map = new Map();
  for (const row of rows) {
    const key = keyFn(row) || "未分类";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return [...map.entries()].map(([key, items]) => {
    const maxSalary = Math.max(0, ...items.map((item) => item.salaryMax));
    const minSalary = Math.min(...items.map((item) => item.salaryMin).filter(Boolean));
    const evidenceCount = items.reduce((sum, item) => sum + numberOf(item.salaryEvidenceCount), 0);
    return {
      key,
      count: items.length,
      minSalary: Number.isFinite(minSalary) ? minSalary : 0,
      maxSalary,
      tier: salaryTier(maxSalary),
      evidenceCount,
      topSegments: topJoined(items.map((item) => item.segment), 8),
      topRoles: topJoined(items.map((item) => item.role), 8),
      topCapabilities: topJoined(items.flatMap((item) => splitSemi(item.coreCapabilities)), 7)
    };
  }).sort((a, b) => b.maxSalary - a.maxSalary || b.evidenceCount - a.evidenceCount);
}

function mdRows(rows, fallback = "暂无") {
  return rows.length ? rows.join("\n") : fallback;
}

const roleRows = readCsvIfExists(roleMatrixPath);
const capabilityRows = readCsvIfExists(capabilityMatrixPath);
const decisionRows = readCsvIfExists(decisionOverviewPath);
const externalSalaryRows = readCsvIfExists(externalSalaryPath);
const bossJobs = readBossJobCount(jobsPath);

const enrichedRows = roleRows.map((row) => {
  const max = salaryMax(row.salaryBand);
  const min = salaryMin(row.salaryBand);
  const tier = salaryTier(max);
  const route = routeFor(row);
  return {
    ...row,
    salaryMin: min,
    salaryMax: max,
    salaryTier: tier,
    route,
    gate: gateFor(row, max),
    evidenceLevel: evidenceLevel(row, bossJobs)
  };
}).sort((a, b) => b.salaryMax - a.salaryMax || numberOf(b.salaryEvidenceCount) - numberOf(a.salaryEvidenceCount));

const tierRows = aggregate(enrichedRows, (row) => row.salaryTier);
const routeRows = aggregate(enrichedRows, (row) => row.route);
const segmentRows = aggregate(enrichedRows, (row) => row.segment);
const roleRowsAgg = aggregate(enrichedRows, (row) => row.role);

const topCapabilities = capabilityRows
  .sort((a, b) => numberOf(b.demandScore) - numberOf(a.demandScore))
  .slice(0, 8);

const decisionTop = decisionRows.slice(0, 12);

const outputHeaders = [
  "rank",
  "salaryTier",
  "route",
  "priority",
  "segment",
  "role",
  "salaryBand",
  "salaryMinK",
  "salaryMaxK",
  "salaryEvidenceCount",
  "evidenceLevel",
  "sampleProgress",
  "sampleGap",
  "topCompanies",
  "mustHaveGate",
  "coreCapabilities",
  "nextAction"
];

const outputRows = [
  outputHeaders,
  ...enrichedRows.map((row, index) => [
    index + 1,
    row.salaryTier,
    row.route,
    row.priority,
    row.segment,
    row.role,
    row.salaryBand,
    row.salaryMin || "",
    row.salaryMax || "",
    row.salaryEvidenceCount,
    row.evidenceLevel,
    row.sampleProgress,
    row.sampleGap,
    row.topCompanies,
    row.gate,
    row.coreCapabilities,
    row.nextAction
  ])
];

const md = `# AI销售岗位薪资待遇与能力门槛分析

更新时间：${formatDate()}

## 一、本质判断

这份报告不是单纯列薪资区间，而是回答：AI行业销售岗位为什么有的只有 8-15K，有的能到 50-70K，以及简历需要证明什么能力，才有资格进入更高薪资层。

当前结论来自 ${externalSalaryRows.length} 条公开薪资补充信号、${roleRows.length} 行岗位薪资能力矩阵和 ${bossJobs} 条 BOSS 登录态样本。由于 BOSS 大样本仍不足，以下是“薪资假设 + 能力门槛”，不是最终市场中位数。

## 二、薪资层级

| 薪资层级 | 岗位组合数 | 观察下限 | 观察上限 | 证据数 | 典型赛道 | 典型岗位 | 判断 |
| --- | ---: | ---: | ---: | ---: | --- | --- | --- |
${mdRows(tierRows.map((row) => `| ${row.key} | ${row.count} | ${row.minSalary || "-"}K | ${row.maxSalary || "-"}K | ${row.evidenceCount} | ${row.topSegments} | ${row.topRoles} | ${salaryTierInterpretation(row.key)} |`))}

## 三、六条求职路线

| 路线 | 岗位组合数 | 观察上限 | 证据数 | 典型赛道 | 典型岗位 | 核心能力 |
| --- | ---: | ---: | ---: | --- | --- | --- |
${mdRows(routeRows.map((row) => `| ${row.key} | ${row.count} | ${row.maxSalary || "-"}K | ${row.evidenceCount} | ${row.topSegments} | ${row.topRoles} | ${row.topCapabilities} |`))}

## 四、赛道薪资与能力门槛

| 排名 | 赛道 | 观察薪资上限 | 薪资层级 | 薪资证据数 | 重点岗位 | 核心能力 |
| ---: | --- | ---: | --- | ---: | --- | --- |
${mdRows(segmentRows.map((row, index) => `| ${index + 1} | ${row.key} | ${row.maxSalary || "-"}K | ${row.tier} | ${row.evidenceCount} | ${row.topRoles} | ${row.topCapabilities} |`))}

## 五、岗位层级薪资与门槛

| 排名 | 岗位层级 | 观察薪资上限 | 薪资层级 | 薪资证据数 | 覆盖赛道 | 核心能力 |
| ---: | --- | ---: | --- | ---: | --- | --- |
${mdRows(roleRowsAgg.map((row, index) => `| ${index + 1} | ${row.key} | ${row.maxSalary || "-"}K | ${row.tier} | ${row.evidenceCount} | ${row.topSegments} | ${row.topCapabilities} |`))}

## 六、高薪岗位的门槛

| 排名 | 薪资层级 | 路线 | 赛道 | 岗位 | 观察薪资 | 证据强度 | 必须证明的能力 | 下一步 |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- |
${mdRows(enrichedRows.slice(0, 15).map((row, index) => `| ${index + 1} | ${row.salaryTier} | ${row.route} | ${row.segment} | ${row.role} | ${row.salaryBand} | ${row.evidenceLevel} | ${row.gate} | ${row.nextAction} |`))}

## 七、市场最看重的能力

| 排名 | 能力 | 需求分 | 覆盖赛道 | 高价值岗位 | 简历证据写法 |
| ---: | --- | ---: | --- | --- | --- |
${mdRows(topCapabilities.map((row, index) => `| ${index + 1} | ${row.capability} | ${row.demandScore} | ${topJoined(splitSemi(row.prioritySegments), 6)} | ${topJoined(splitSemi(row.highValueRoles), 6)} | ${row.resumeEvidenceTemplate} |`))}

## 八、对简历的直接要求

1. 想冲 40K+ 区间，简历不能只写“负责销售”，必须写出客户类型、金额、周期、决策链、方案和回款。
2. 大模型/MaaS 路线要补 Token/调用量/私有化/RAG/Agent/模型服务等业务化语言。
3. 芯片、AI服务器、智算、IDC 路线要补硬件链路、云/IDC/政企/生态伙伴、招投标或长周期项目经验。
4. 智能客服、营销AI、销售AI 路线要补 SaaS 转化、续费、客户成功、渠道和团队管理证据。
5. 工业AI/制造业路线要补制造业场景、产线/质检/设备/工艺痛点、交付协同和可量化业务收益。

## 九、当前证据边界

- BOSS 干净岗位样本只有 ${bossJobs} 条，薪资判断不能升级为中位数或最终市场结论。
- 公开薪资信号用于定位方向和区间，后续要用 BOSS 登录态岗位详情校验。
- 当前能力画像为空，所以本报告只输出岗位门槛，不输出个人真实匹配度。
- 每个 P0 赛道至少补 10 到 12 条 BOSS 岗位详情后，才能做稳定薪资判断。

## 十、优先补样动作

| 排名 | 决策 | 赛道 | 岗位 | 薪资观察 | 核心能力 | 补样动作 |
| ---: | --- | --- | --- | --- | --- | --- |
${mdRows(decisionTop.map((row) => `| ${row.rank} | ${row.decision} | ${row.segment} | ${row.role} | ${row.salaryBand} | ${topJoined(splitSemi(row.coreCapabilities), 5)} | ${row.nextAction} |`))}
`;

writeFileSync(outputMdPath, md);
writeFileSync(outputCsvPath, `${csv(outputRows)}\n`);

console.log(`已生成：${outputMdPath}`);
console.log(`已生成：${outputCsvPath}`);
console.log(`岗位组合：${enrichedRows.length}`);
console.log(`公开薪资信号：${externalSalaryRows.length}`);
