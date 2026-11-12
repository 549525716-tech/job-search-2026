#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const samplingPackCsvPath = join(projectRoot, "01_行情收集/BOSS人工采样作业包.csv");
const jobsPath = join(projectRoot, "01_行情收集/data/jobs.jsonl");
const outputSummaryCsvPath = join(projectRoot, "01_行情收集/BOSS采样进度看板.csv");
const outputTaskCsvPath = join(projectRoot, "01_行情收集/BOSS采样任务状态.csv");
const outputMdPath = join(projectRoot, "01_行情收集/BOSS采样进度看板.md");

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

function csvEscape(value) {
  const text = String(value ?? "");
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function csv(rows) {
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

function readJobs() {
  if (!existsSync(jobsPath)) return [];
  return readFileSync(jobsPath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
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

function textOfJob(job) {
  return [
    job.query,
    job.role,
    job.roleFamily,
    job.title,
    job.company,
    job.companyFilter,
    job.targetCompanyAlias,
    job.rawText,
    job.detailText
  ].filter(Boolean).join("\n");
}

function matchesCompany(task, job) {
  const company = String(task.company || "").trim();
  const candidates = [
    job.company,
    job.companyFilter,
    job.targetCompanyAlias,
    job.query
  ].filter(Boolean).map(String);
  return candidates.some((item) => item.includes(company) || company.includes(item));
}

function matchesRole(task, job) {
  const role = String(task.role || "").trim();
  if (!role) return false;
  const text = textOfJob(job);
  if (text.includes(role)) return true;
  if (role === "AI销售" && /AI|大模型|人工智能|MaaS|Maas|智能/.test(text) && /销售|商务|客户/.test(text)) return true;
  if (role === "售前" && /售前|解决方案|方案|POC|Demo|技术交流/.test(text)) return true;
  if (role === "销售经理" && /销售经理|客户经理|区域经理|销售主管|销售总监/.test(text)) return true;
  if (role === "大客户销售" && /大客户|KA|行业客户|客户经理/.test(text)) return true;
  return false;
}

function matchesTask(task, job) {
  if (job.source && job.source !== "BOSS直聘") return false;
  return matchesCompany(task, job) && matchesRole(task, job);
}

function statusFor(count) {
  if (count > 0) return "已覆盖";
  return "待采样";
}

function priorityRank(priority) {
  return { P0: 0, P1: 1, P2: 2 }[priority] ?? 9;
}

function progressLabel(importedJobs, targetSamples) {
  if (importedJobs >= targetSamples) return "达标";
  if (importedJobs > 0) return "样本不足";
  return "未开始";
}

function mdTable(rows, fallback) {
  return rows.length ? rows.join("\n") : fallback;
}

if (!existsSync(samplingPackCsvPath)) {
  throw new Error(`未找到人工采样作业包：${samplingPackCsvPath}。请先运行 npm run sampling:manual -- --city 广州`);
}

const tasks = parseCsv(readFileSync(samplingPackCsvPath, "utf8"));
const jobs = readJobs();
const taskRows = tasks.map((task) => {
  const matchedJobs = jobs.filter((job) => matchesTask(task, job));
  return {
    ...task,
    matchedJobCount: matchedJobs.length,
    matchedJobIds: matchedJobs.map((job) => job.id).join(";"),
    matchedTitles: matchedJobs.map((job) => `${job.company || ""}${job.title ? `/${job.title}` : ""}`).join(";"),
    status: statusFor(matchedJobs.length)
  };
});

const segments = [...new Set(taskRows.map((task) => task.segment))];
const summaryRows = segments.map((segment) => {
  const segmentTasks = taskRows.filter((task) => task.segment === segment);
  const taskJobIds = new Set(
    segmentTasks
      .flatMap((task) => String(task.matchedJobIds || "").split(";"))
      .filter(Boolean)
  );
  const targetSamples = Number.parseInt(segmentTasks[0]?.targetSamples || "0", 10) || 0;
  const coveredTasks = segmentTasks.filter((task) => task.matchedJobCount > 0).length;
  const priority = segmentTasks[0]?.priority || "";
  const companies = [...new Set(segmentTasks.map((task) => task.company))];
  const roles = [...new Set(segmentTasks.map((task) => task.role))];
  return {
    priority,
    segment,
    targetSamples,
    importedJobs: taskJobIds.size,
    sampleGap: Math.max(0, targetSamples - taskJobIds.size),
    taskCount: segmentTasks.length,
    coveredTasks,
    uncoveredTasks: segmentTasks.length - coveredTasks,
    companyCount: companies.length,
    roleTerms: roles.join(";"),
    status: progressLabel(taskJobIds.size, targetSamples)
  };
}).sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || b.sampleGap - a.sampleGap || a.segment.localeCompare(b.segment, "zh-Hans-CN"));

const priorityRows = ["P0", "P1", "P2"].map((priority) => {
  const rows = summaryRows.filter((row) => row.priority === priority);
  return {
    priority,
    segments: rows.length,
    targetSamples: rows.reduce((sum, row) => sum + row.targetSamples, 0),
    importedJobs: rows.reduce((sum, row) => sum + row.importedJobs, 0),
    sampleGap: rows.reduce((sum, row) => sum + row.sampleGap, 0),
    uncoveredTasks: rows.reduce((sum, row) => sum + row.uncoveredTasks, 0)
  };
});

const nextTasks = taskRows
  .filter((task) => task.status === "待采样")
  .sort((a, b) => {
    const priorityDiff = priorityRank(a.priority) - priorityRank(b.priority);
    if (priorityDiff) return priorityDiff;
    return Number(a.sampleOrder) - Number(b.sampleOrder);
  })
  .slice(0, 40);

mkdirSync(dirname(outputSummaryCsvPath), { recursive: true });

const summaryHeaders = [
  "priority",
  "segment",
  "targetSamples",
  "importedJobs",
  "sampleGap",
  "taskCount",
  "coveredTasks",
  "uncoveredTasks",
  "companyCount",
  "roleTerms",
  "status"
];
writeFileSync(
  outputSummaryCsvPath,
  `${csv([summaryHeaders])}\n${csv(summaryRows.map((row) => summaryHeaders.map((header) => row[header])))}\n`
);

const taskHeaders = [
  "sampleOrder",
  "priority",
  "segment",
  "layer",
  "company",
  "role",
  "query",
  "city",
  "matchedJobCount",
  "status",
  "matchedJobIds",
  "matchedTitles",
  "searchUrl",
  "importCommand"
];
writeFileSync(
  outputTaskCsvPath,
  `${csv([taskHeaders])}\n${csv(taskRows.map((row) => taskHeaders.map((header) => row[header])))}\n`
);

const priorityMdRows = priorityRows.map((row) => {
  return `| ${row.priority} | ${row.segments} | ${row.targetSamples} | ${row.importedJobs} | ${row.sampleGap} | ${row.uncoveredTasks} |`;
});
const summaryMdRows = summaryRows.map((row) => {
  return `| ${row.priority} | ${row.segment} | ${row.status} | ${row.importedJobs}/${row.targetSamples} | ${row.sampleGap} | ${row.coveredTasks}/${row.taskCount} | ${row.roleTerms} |`;
});
const nextTaskMdRows = nextTasks.map((task) => {
  return `| ${task.sampleOrder} | ${task.priority} | ${task.segment} | ${task.company} | ${task.role} | https://www.zhipin.com/ | \`${task.query || `${task.company} ${task.role}`}\` | \`${task.importCommand}\` |`;
});

const md = `# BOSS采样进度看板

更新时间：${formatDate()}

## 一、本质判断

这份看板不是新增采集动作，而是把 BOSS 人工采样任务和已沉淀岗位样本做对账。它回答三个问题：哪些赛道已经有样本，哪些赛道仍是空白，下一批应该优先采哪些公司和岗位词。

## 二、总体状态

| 指标 | 数值 |
| --- | ---: |
| 人工采样任务 | ${tasks.length} |
| BOSS已沉淀岗位样本 | ${jobs.length} |
| 已覆盖任务 | ${taskRows.filter((task) => task.status === "已覆盖").length} |
| 待采样任务 | ${taskRows.filter((task) => task.status === "待采样").length} |
| 已达标赛道 | ${summaryRows.filter((row) => row.status === "达标").length} |
| 样本不足赛道 | ${summaryRows.filter((row) => row.status === "样本不足").length} |
| 未开始赛道 | ${summaryRows.filter((row) => row.status === "未开始").length} |

## 三、优先级汇总

| 优先级 | 赛道数 | 目标样本 | 已有样本 | 缺口 | 未覆盖任务 |
| --- | ---: | ---: | ---: | ---: | ---: |
${mdTable(priorityMdRows, "| 暂无 | 0 | 0 | 0 | 0 | 0 |")}

## 四、分赛道进度

| 优先级 | 赛道 | 状态 | 样本进度 | 样本缺口 | 任务覆盖 | 岗位词 |
| --- | --- | --- | ---: | ---: | ---: | --- |
${mdTable(summaryMdRows, "| 暂无 |  |  | 0/0 | 0 | 0/0 |  |")}

## 五、下一批优先任务

每次只处理 1 个站内搜索关键词，不连续刷新。复制岗位卡片或详情后，执行对应导入命令。

| 序号 | 优先级 | 赛道 | 公司 | 岗位词 | BOSS首页 | 站内搜索关键词 | 导入命令 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
${mdTable(nextTaskMdRows, "| 暂无 |  |  |  |  |  |  |  |")}

## 六、文件

\`\`\`text
${outputSummaryCsvPath}
${outputTaskCsvPath}
\`\`\`
`;

writeFileSync(outputMdPath, md);

console.log(`已生成：${outputSummaryCsvPath}`);
console.log(`已生成：${outputTaskCsvPath}`);
console.log(`已生成：${outputMdPath}`);
console.log(`任务数：${tasks.length}`);
console.log(`BOSS样本：${jobs.length}`);
