#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const batchCsvPath = join(projectRoot, "01_行情收集/BOSS人工采样批次包.csv");
const focusBatchCsvPath = join(projectRoot, "01_行情收集/BOSS重点公司补样批次包.csv");
const top10BatchCsvPath = join(projectRoot, "01_行情收集/BOSS细分赛道Top10公司采样批次包.csv");
const jobsPath = join(projectRoot, "01_行情收集/data/jobs.jsonl");
const outputBatchCsvPath = join(projectRoot, "01_行情收集/BOSS人工采样批次进度看板.csv");
const outputTaskCsvPath = join(projectRoot, "01_行情收集/BOSS人工采样批次任务状态.csv");
const outputMdPath = join(projectRoot, "01_行情收集/BOSS人工采样批次进度看板.md");

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

function readBatchTasks() {
  const paths = [batchCsvPath, focusBatchCsvPath, top10BatchCsvPath];
  const existingPaths = paths.filter((filePath) => existsSync(filePath));
  if (!existingPaths.length) {
    throw new Error(`未找到批次包：${batchCsvPath}。请先运行 npm run sampling:batches。`);
  }
  return existingPaths.flatMap((filePath) => readCsv(filePath).map((row) => normalizeTaskFields({
    ...row,
    batchPackage: filePath
  })));
}

function queryFromUrl(url) {
  try {
    return new URL(url).searchParams.get("query") || "";
  } catch {
    return "";
  }
}

function normalizeTaskFields(row) {
  const referenceUrl = row.referenceUrl || row.manualUrl || row.searchUrl || "";
  const searchKeyword = row.searchKeyword || queryFromUrl(referenceUrl) || `${row.company || ""} ${row.role || ""}`.trim();
  return {
    ...row,
    safeHomeUrl: row.safeHomeUrl || "https://www.zhipin.com/",
    searchKeyword,
    referenceUrl,
    manualUrl: row.manualUrl || referenceUrl
  };
}

function readJobs() {
  if (!existsSync(jobsPath)) return [];
  return readFileSync(jobsPath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
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

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[（）()【】\[\]{}·\s\-_.,，。/\\|]/g, "");
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
    job.route,
    job.segment,
    job.priority,
    job.samplingBatchId,
    job.samplingBatchTask,
    job.searchUrl,
    job.rawText,
    job.detailText
  ].filter(Boolean).join("\n");
}

function companyAliases(company) {
  const aliases = new Set([company]);
  const clean = String(company || "").trim();
  if (/智能云$/.test(clean)) aliases.add(clean.replace(/智能云$/, ""));
  if (/云$/.test(clean)) aliases.add(clean.replace(/云$/, ""));
  if (/科技$/.test(clean)) aliases.add(clean.replace(/科技$/, ""));
  if (/信息$/.test(clean)) aliases.add(clean.replace(/信息$/, ""));
  if (/股份$/.test(clean)) aliases.add(clean.replace(/股份$/, ""));
  return [...aliases].filter((item) => item.length >= 2);
}

function matchesCompany(task, job) {
  const company = String(task.company || "").trim();
  if (!company) return false;
  const jobCompanyCandidates = [
    job.company,
    job.companyFilter,
    job.targetCompanyAlias,
    job.query
  ].filter(Boolean);
  const normalizedJobCandidates = jobCompanyCandidates.map(normalizeText).filter(Boolean);

  for (const alias of companyAliases(company)) {
    const normalizedAlias = normalizeText(alias);
    if (!normalizedAlias) continue;
    if (normalizedJobCandidates.some((candidate) => candidate.includes(normalizedAlias) || normalizedAlias.includes(candidate))) {
      return true;
    }
  }
  return false;
}

function rolePatternFor(role, roleFamily = "") {
  const text = `${role}\n${roleFamily}`;
  if (/解决方案|售前|顾问|POC|Demo|方案/.test(text)) return /售前|解决方案|方案|POC|Demo|技术交流|顾问/;
  if (/渠道|生态|伙伴|代理/.test(text)) return /渠道|生态|伙伴|代理|合作伙伴/;
  if (/管理|负责人|总监|销售经理|区域/.test(text)) return /销售经理|区域经理|销售主管|销售总监|负责人|管理|leader/i;
  if (/大客户|KA|行业|客户经理/.test(text)) return /大客户|KA|行业客户|客户经理|政企|行业销售/i;
  if (/SaaS|软件|智能体|应用/.test(text)) return /SaaS|软件|智能体|应用|AI|人工智能|销售/;
  if (/AI|大模型|MaaS|Maas|人工智能/.test(text)) return /AI|大模型|MaaS|Maas|人工智能|智能|销售/;
  return /销售|商务|BD|客户|经理|售前|渠道/;
}

function matchesRole(task, job) {
  const role = String(task.role || "").trim();
  const roleFamily = String(task.roleFamily || "").trim();
  const text = textOfJob(job);
  if (role && text.includes(role)) return true;
  return rolePatternFor(role, roleFamily).test(text);
}

function matchesTask(task, job) {
  if (job.source && job.source !== "BOSS直聘") return false;
  if (
    job.samplingBatchId &&
    String(job.samplingBatchId) === String(task.batchId) &&
    String(job.samplingBatchTask) === String(task.taskInBatch)
  ) {
    return true;
  }
  return matchesCompany(task, job) && matchesRole(task, job);
}

function taskStatus(matched, target) {
  if (target > 0 && matched >= target) return "达标";
  if (matched > 0) return "进行中";
  return "未开始";
}

function batchStatus(done, total, matched, target) {
  if (total > 0 && done >= total && matched >= target) return "达标";
  if (matched > 0 || done > 0) return "进行中";
  return "未开始";
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function mdRows(rows, fallback) {
  return rows.length ? rows.join("\n") : fallback;
}

const tasks = readBatchTasks();
const jobs = readJobs();

const taskRows = tasks.map((task) => {
  const targetCopies = numberOf(task.targetCopies) || 1;
  const matchedJobs = jobs.filter((job) => matchesTask(task, job));
  const matchedIds = unique(matchedJobs.map((job) => job.id));
  const matchedTitles = matchedJobs
    .map((job) => `${job.company || ""}${job.title ? `/${job.title}` : ""}`)
    .filter(Boolean);
  const matchedCount = matchedIds.length;
  return {
    ...task,
    targetCopies,
    matchedCount,
    remainingCopies: Math.max(0, targetCopies - matchedCount),
    status: taskStatus(matchedCount, targetCopies),
    matchedJobIds: matchedIds.join(";"),
    matchedTitles: matchedTitles.join(";")
  };
});

const batchIds = unique(taskRows.map((row) => row.batchId));
const batchRows = batchIds.map((batchId) => {
  const rows = taskRows.filter((row) => row.batchId === batchId);
  const matchedIds = unique(rows.flatMap((row) => String(row.matchedJobIds || "").split(";")));
  const targetCopies = rows.reduce((sum, row) => sum + numberOf(row.targetCopies), 0);
  const matchedCount = matchedIds.length;
  const completedTasks = rows.filter((row) => row.status === "达标").length;
  const nextTask = rows.find((row) => row.status !== "达标") || {};
  return {
    batchNumber: rows[0]?.batchNumber || "",
    batchId,
    batchMode: rows[0]?.batchMode || "",
    priorityMix: unique(rows.map((row) => row.priority)).join(";"),
    routeMix: unique(rows.map((row) => row.route)).join(";"),
    segmentMix: unique(rows.map((row) => row.segment)).join(";"),
    taskCount: rows.length,
    completedTasks,
    targetCopies,
    matchedCount,
    remainingCopies: Math.max(0, targetCopies - matchedCount),
    status: batchStatus(completedTasks, rows.length, matchedCount, targetCopies),
    nextCompany: nextTask.company || "",
    nextRole: nextTask.role || "",
    nextSalaryBand: nextTask.salaryBand || "",
    nextSafeHomeUrl: nextTask.safeHomeUrl || "",
    nextSearchKeyword: nextTask.searchKeyword || "",
    nextReferenceUrl: nextTask.referenceUrl || nextTask.manualUrl || "",
    nextImportCommand: nextTask.importCommand || "",
    matchedJobIds: matchedIds.join(";")
  };
});

const batchHeaders = [
  "batchNumber",
  "batchId",
  "batchMode",
  "priorityMix",
  "routeMix",
  "segmentMix",
  "taskCount",
  "completedTasks",
  "targetCopies",
  "matchedCount",
  "remainingCopies",
  "status",
  "nextCompany",
  "nextRole",
  "nextSalaryBand",
  "nextSafeHomeUrl",
  "nextSearchKeyword",
  "nextReferenceUrl",
  "nextImportCommand",
  "matchedJobIds"
];
const taskHeaders = [
  "batchNumber",
  "batchId",
  "batchMode",
  "taskInBatch",
  "globalOrder",
  "priority",
  "route",
  "segment",
  "company",
  "role",
  "roleFamily",
  "city",
  "salaryBand",
  "safeHomeUrl",
  "searchKeyword",
  "referenceUrl",
  "targetCopies",
  "matchedCount",
  "remainingCopies",
  "status",
  "manualUrl",
  "importCommand",
  "matchedJobIds",
  "matchedTitles"
];

mkdirSync(dirname(outputMdPath), { recursive: true });
writeFileSync(outputBatchCsvPath, `${csv([batchHeaders, ...batchRows.map((row) => batchHeaders.map((header) => row[header]))])}\n`);
writeFileSync(outputTaskCsvPath, `${csv([taskHeaders, ...taskRows.map((row) => taskHeaders.map((header) => row[header]))])}\n`);

const batchMdRows = batchRows.map((row) => {
  const next = row.nextSearchKeyword ? `${row.nextCompany}/${row.nextRole}：\`${row.nextSearchKeyword}\`` : "-";
  return `| ${row.batchId} | ${row.batchMode} | ${row.status} | ${row.completedTasks}/${row.taskCount} | ${row.matchedCount}/${row.targetCopies} | ${row.remainingCopies} | ${row.nextSalaryBand || "-"} | ${row.nextSafeHomeUrl || "-"} | ${next} |`;
});

const nextTaskRows = taskRows
  .filter((row) => row.status !== "达标")
  .slice(0, 20)
  .map((row) => {
    return `| ${row.batchId} | ${row.priority} | ${row.route} | ${row.segment} | ${row.company} | ${row.role} | ${row.salaryBand || "-"} | ${row.status} | ${row.matchedCount}/${row.targetCopies} | \`${row.safeHomeUrl}\` | \`${row.searchKeyword}\` | \`${row.importCommand}\` |`;
  });

const completedBatches = batchRows.filter((row) => row.status === "达标").length;
const inProgressBatches = batchRows.filter((row) => row.status === "进行中").length;
const notStartedBatches = batchRows.filter((row) => row.status === "未开始").length;
const totalTargetCopies = batchRows.reduce((sum, row) => sum + numberOf(row.targetCopies), 0);
const totalMatched = batchRows.reduce((sum, row) => sum + numberOf(row.matchedCount), 0);
const totalRemaining = Math.max(0, totalTargetCopies - totalMatched);

const md = `# BOSS人工采样批次进度看板

更新时间：${formatDate()}

## 一、本质判断

这份看板不是新增搜索任务，而是验收“人工采样批次包”执行到了哪里。它把已导入的 BOSS 岗位样本反向匹配到每个批次、公司和岗位入口，用来判断哪一批已经达标、哪一批还缺岗位文本、下一步应该继续看哪个入口。

当前最大的矛盾是：批次包已经把补样路径拆出来，但只有导入足够多的高相关岗位文本，才能把公开信号升级为 BOSS 平台实证结论。

## 二、总览

| 指标 | 数值 |
| --- | ---: |
| 批次数 | ${batchRows.length} |
| 达标批次 | ${completedBatches} |
| 进行中批次 | ${inProgressBatches} |
| 未开始批次 | ${notStartedBatches} |
| 批次入口 | ${taskRows.length} |
| 目标导入岗位数 | ${totalTargetCopies} |
| 已匹配导入岗位数 | ${totalMatched} |
| 剩余岗位数 | ${totalRemaining} |

## 三、批次进度

| 批次 | 模式 | 状态 | 达标入口 | 样本进度 | 剩余岗位 | 下一岗位薪资 | BOSS首页 | 下一站内搜索词 |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- |
${mdRows(batchMdRows, "| 暂无 | - | - | 0/0 | 0/0 | 0 | - | - | - |")}

## 四、下一步入口

| 批次 | 优先级 | 路线 | 赛道 | 公司 | 岗位 | 薪资参考 | 状态 | 样本进度 | BOSS首页 | 站内搜索关键词 | 导入命令 |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- |
${mdRows(nextTaskRows, "| 暂无 | - | - | - | - | - | - | - | 0/0 | - | - | - |")}

## 五、验收规则

- 单个入口达标：匹配导入岗位数达到该入口的目标导入数。
- 单个批次达标：批次内所有入口达标，且批次匹配岗位总数达到批次目标。
- 只统计 BOSS 直聘来源的岗位样本。
- 匹配逻辑以公司名和岗位族为核心，结果仍需人工复核，尤其是简称、集团公司和岗位标题泛化的情况。
- 执行入口只展示 BOSS 首页和站内搜索关键词；完整搜索 URL 只保留在 CSV 的 referenceUrl 字段用于审计，不作为点击入口。
`;

writeFileSync(outputMdPath, md);

console.log(`已生成：${outputMdPath}`);
console.log(`已生成：${outputBatchCsvPath}`);
console.log(`已生成：${outputTaskCsvPath}`);
console.log(`批次数：${batchRows.length}`);
console.log(`达标批次：${completedBatches}`);
console.log(`已匹配导入岗位数：${totalMatched}`);
console.log(`剩余岗位数：${totalRemaining}`);
