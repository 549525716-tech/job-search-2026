#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const samplingStatusPath = join(projectRoot, "01_行情收集/BOSS采样进度看板.csv");
const nextSamplingPath = join(projectRoot, "01_行情收集/BOSS下一轮优先采样清单.csv");
const hardwareQueuePath = join(projectRoot, "01_行情收集/BOSS硬件算力半导体优先采样清单.csv");
const opportunityPath = join(projectRoot, "01_行情收集/AI细分赛道销售机会矩阵.csv");
const handbookPath = join(projectRoot, "01_行情收集/AI销售岗位全行业决策手册.csv");
const jobsPath = join(projectRoot, "01_行情收集/data/jobs.jsonl");

const outputCsvPath = join(projectRoot, "01_行情收集/BOSS全行业样本缺口路线图.csv");
const outputMdPath = join(projectRoot, "01_行情收集/BOSS全行业样本缺口路线图.md");
const safeBossHomeUrl = "https://www.zhipin.com/";

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

function readBossJsonlCount(filePath) {
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

function numberOf(value) {
  const num = Number.parseFloat(String(value || "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(num) ? num : 0;
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
  if (/P0/.test(value || "")) return 3;
  if (/P1/.test(value || "")) return 2;
  if (/P2/.test(value || "")) return 1;
  return 0;
}

function statusFor(importedJobs, targetSamples) {
  if (targetSamples > 0 && importedJobs >= targetSamples) return "达标";
  if (importedJobs > 0) return "有样本但不足";
  return "未开始";
}

function decisionGate(importedJobs, targetSamples) {
  if (targetSamples > 0 && importedJobs >= targetSamples) return "可进入赛道小结";
  if (importedJobs >= 3) return "可写方向性观察，不能写薪资结论";
  if (importedJobs > 0) return "只能作案例观察";
  return "不能下BOSS结论";
}

function splitTerms(value) {
  return String(value || "")
    .split(/[;；、]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function topJoined(values, limit = 6, separator = "、") {
  return [...new Set(values.filter(Boolean))].slice(0, limit).join(separator);
}

function mdRows(rows, fallback) {
  return rows.length ? rows.join("\n") : fallback;
}

function queryTaskRows(rows, segment, limit = 3) {
  return rows
    .filter((row) => row.segment === segment)
    .sort((a, b) => numberOf(b.score) - numberOf(a.score) || numberOf(a.rank) - numberOf(b.rank))
    .slice(0, limit);
}

const statusRows = readCsv(samplingStatusPath);
const nextRows = readCsv(nextSamplingPath);
const hardwareRows = readCsv(hardwareQueuePath);
const opportunityRows = readCsv(opportunityPath);
const handbookRows = readCsv(handbookPath);
const bossSampleCount = readBossJsonlCount(jobsPath);
const allQueueRows = [...nextRows, ...hardwareRows].filter((row, index, rows) => {
  const key = `${row.segment}|${row.company}|${row.role}`;
  return rows.findIndex((item) => `${item.segment}|${item.company}|${item.role}` === key) === index;
});

const roadmapRows = statusRows.map((row) => {
  const opportunity = opportunityRows.find((item) => item.segment === row.segment) || {};
  const handbook = handbookRows.find((item) => item.segment === row.segment) || {};
  const importedJobs = numberOf(row.importedJobs);
  const targetSamples = numberOf(row.targetSamples);
  const sampleGap = Math.max(0, targetSamples - importedJobs);
  const nextTasks = queryTaskRows(allQueueRows, row.segment, 4);
  const firstTask = nextTasks[0] || {};
  return {
    priority: row.priority || handbook.priority || opportunity.priority || "",
    route: handbook.route || opportunity.route || "",
    segment: row.segment,
    targetSamples,
    importedJobs,
    sampleGap,
    completionRate: targetSamples ? `${Math.round(importedJobs / targetSamples * 100)}%` : "0%",
    status: statusFor(importedJobs, targetSamples),
    decisionGate: decisionGate(importedJobs, targetSamples),
    salaryBand: handbook.salaryBand || opportunity.salaryBand || "",
    publicSalaryMaxK: handbook.publicSalaryMaxK || opportunity.salaryMaxK || "",
    evidenceLevel: handbook.evidenceLevel || opportunity.evidenceLevel || "",
    topCompanies: handbook.p0Companies || handbook.topCompanies || opportunity.topCompanies || "",
    roleFocus: handbook.firstRoles || handbook.roleFocus || opportunity.roleFocus || row.roleTerms || "",
    mustHaveGate: handbook.mustHaveGate || opportunity.mustHaveGate || "",
    nextCompany: firstTask.company || "",
    nextRole: firstTask.role || "",
    nextSafeHomeUrl: safeBossHomeUrl,
    nextSearchKeyword: firstTask.searchKeyword || (firstTask.company && firstTask.role ? `${firstTask.company} ${firstTask.role}` : ""),
    nextSearchUrl: firstTask.searchUrl || "",
    nextImportCommand: firstTask.importCommand || "",
    nextTaskList: nextTasks.map((task) => `${task.company}/${task.role}`).join("；"),
    requiredFields: "公司;岗位;薪资;城市;经验;学历;职责;要求;客户类型;是否销售管理;是否售前/解决方案;AI/大模型/硬件/行业关键词",
    acceptanceGate: "只导入销售、售前、解决方案、渠道、销售管理相关岗位；岗位正文必须能看出AI/算力/硬件/行业场景相关性"
  };
}).sort((a, b) => {
  const priorityDiff = priorityRank(b.priority) - priorityRank(a.priority);
  if (priorityDiff) return priorityDiff;
  return b.sampleGap - a.sampleGap || a.segment.localeCompare(b.segment, "zh-Hans-CN");
});

const routeRows = [...new Set(roadmapRows.map((row) => row.route || "未分类"))].map((route) => {
  const rows = roadmapRows.filter((row) => (row.route || "未分类") === route);
  return {
    route,
    segments: rows.length,
    targetSamples: rows.reduce((sum, row) => sum + row.targetSamples, 0),
    importedJobs: rows.reduce((sum, row) => sum + row.importedJobs, 0),
    sampleGap: rows.reduce((sum, row) => sum + row.sampleGap, 0),
    topSegments: rows
      .slice()
      .sort((a, b) => b.sampleGap - a.sampleGap)
      .slice(0, 4)
      .map((row) => row.segment)
      .join("、")
  };
}).sort((a, b) => b.sampleGap - a.sampleGap);

const nightlyRows = roadmapRows
  .filter((row) => row.sampleGap > 0)
  .flatMap((row) => queryTaskRows(allQueueRows, row.segment, 2).map((task) => ({
    priority: row.priority,
    route: row.route,
    segment: row.segment,
    sampleGap: row.sampleGap,
    company: task.company,
    role: task.role,
    salaryBand: task.salaryBand || row.salaryBand,
    safeBossHomeUrl,
    searchKeyword: task.searchKeyword || `${task.company} ${task.role}`.trim(),
    searchUrl: task.searchUrl,
    importCommand: task.importCommand
  })))
  .slice(0, 24)
  .map((row, index) => ({ rank: index + 1, ...row }));

const headers = [
  "priority",
  "route",
  "segment",
  "targetSamples",
  "importedJobs",
  "sampleGap",
  "completionRate",
  "status",
  "decisionGate",
  "salaryBand",
  "publicSalaryMaxK",
  "evidenceLevel",
  "topCompanies",
  "roleFocus",
  "mustHaveGate",
  "nextCompany",
  "nextRole",
  "nextSafeHomeUrl",
  "nextSearchKeyword",
  "nextSearchUrl",
  "nextImportCommand",
  "nextTaskList",
  "requiredFields",
  "acceptanceGate"
];

mkdirSync(dirname(outputCsvPath), { recursive: true });
writeFileSync(outputCsvPath, `${csv([headers, ...roadmapRows.map((row) => headers.map((header) => row[header]))])}\n`);

const routeMdRows = routeRows.map((row) => {
  return `| ${row.route} | ${row.segments} | ${row.importedJobs}/${row.targetSamples} | ${row.sampleGap} | ${row.topSegments} |`;
});

const segmentMdRows = roadmapRows.map((row) => {
  return `| ${row.priority} | ${row.route} | ${row.segment} | ${row.status} | ${row.importedJobs}/${row.targetSamples} | ${row.sampleGap} | ${row.decisionGate} | ${row.salaryBand || "-"} | ${row.nextTaskList || "-"} |`;
});

const nightlyMdRows = nightlyRows.map((row) => {
  return `| ${row.rank} | ${row.priority} | ${row.route} | ${row.segment} | ${row.company} | ${row.role} | ${row.salaryBand || "-"} | ${row.safeBossHomeUrl} | \`${row.searchKeyword}\` | \`${row.importCommand}\` |`;
});

const totalTarget = roadmapRows.reduce((sum, row) => sum + row.targetSamples, 0);
const totalGap = roadmapRows.reduce((sum, row) => sum + row.sampleGap, 0);
const startedSegments = roadmapRows.filter((row) => row.importedJobs > 0).length;
const notStartedSegments = roadmapRows.filter((row) => row.importedJobs === 0).length;
const highPriorityGap = roadmapRows
  .filter((row) => /P0/.test(row.priority || ""))
  .reduce((sum, row) => sum + row.sampleGap, 0);

const md = `# BOSS全行业样本缺口路线图

更新时间：${formatDate()}

## 一、本质判断

这份路线图不是再生成一批搜索链接，而是把“大而全 BOSS 平台调研”变成可验收的样本工程：每个赛道需要多少条 BOSS 干净样本、当前差多少、下一条应该人工看哪家公司和岗位、什么情况下才能把阶段性判断升级为 BOSS 实证结论。

当前最大矛盾是：全行业框架和公司池已经搭起来，但 BOSS 干净样本只有 ${bossSampleCount} 条；如果继续写结论而不补样本，就会把公开信号误当成平台实证。所以当前优先级不是扩展更多公司，而是按缺口补齐每个核心赛道的最小样本量。

## 二、总体验收状态

| 指标 | 当前值 |
| --- | ---: |
| 赛道数 | ${roadmapRows.length} |
| BOSS干净样本 | ${bossSampleCount} |
| 目标样本总量 | ${totalTarget} |
| 当前缺口 | ${totalGap} |
| 已开始赛道 | ${startedSegments} |
| 未开始赛道 | ${notStartedSegments} |
| P0赛道缺口 | ${highPriorityGap} |

## 三、按路线看缺口

| 路线 | 赛道数 | 样本进度 | 缺口 | 优先补样赛道 |
| --- | ---: | ---: | ---: | --- |
${mdRows(routeMdRows, "| 暂无 | 0 | 0/0 | 0 |  |")}

## 四、按赛道验收

| 优先级 | 路线 | 赛道 | 状态 | 样本进度 | 缺口 | 结论权限 | 薪资观察 | 下一批人工动作 |
| --- | --- | --- | --- | ---: | ---: | --- | --- | --- |
${mdRows(segmentMdRows, "| 暂无 |  |  |  | 0/0 | 0 |  |  |  |")}

## 五、下一轮 24 个手工入口

这些入口只用于人工低频检索，不自动打开、不自动刷新。每次建议只处理 1 个站内搜索关键词，完成复制导入后再继续下一条。

| 顺序 | 优先级 | 路线 | 赛道 | 公司 | 岗位词 | 薪资观察 | BOSS首页 | 站内搜索关键词 | 导入命令 |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${mdRows(nightlyMdRows, "| 1 | 暂无 |  |  |  |  |  |  |  |  |")}

## 六、导入验收标准

每条样本至少保留：

1. 公司、岗位、薪资、城市、经验、学历。
2. 岗位职责和任职要求原文。
3. 客户类型：政企、金融、制造、教育、互联网、渠道、海外等。
4. 岗位类型：销售、销售管理、售前/解决方案、渠道/生态。
5. AI相关性：大模型、Agent、MaaS、算力、芯片、服务器、智算、工业AI、智能硬件、私有化等关键词。

## 七、结论升级标准

1. 单赛道 0 条样本：不能写 BOSS 结论，只能写公司池和公开信号。
2. 单赛道 1 到 2 条样本：只能写案例观察。
3. 单赛道 3 到 9 条样本：可以写方向性观察，不能写薪资中位数。
4. 单赛道达到目标样本：可以写赛道小结。
5. 全行业达到 80 到 200 条高相关样本后，才能把“阶段性判断”升级为“BOSS 平台大样本结论”。

## 八、输出文件

\`\`\`text
${outputCsvPath}
\`\`\`
`;

writeFileSync(outputMdPath, md);

console.log(`已生成：${outputMdPath}`);
console.log(`已生成：${outputCsvPath}`);
console.log(`赛道数：${roadmapRows.length}`);
console.log(`BOSS干净样本：${bossSampleCount}`);
console.log(`目标样本总量：${totalTarget}`);
console.log(`当前缺口：${totalGap}`);
