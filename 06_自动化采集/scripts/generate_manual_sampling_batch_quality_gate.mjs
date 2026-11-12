#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const batchCsvPath = join(projectRoot, "01_行情收集/BOSS人工采样批次包.csv");
const focusBatchCsvPath = join(projectRoot, "01_行情收集/BOSS重点公司补样批次包.csv");
const top10BatchCsvPath = join(projectRoot, "01_行情收集/BOSS细分赛道Top10公司采样批次包.csv");
const jobsPath = join(projectRoot, "01_行情收集/data/jobs.jsonl");
const qualityCsvPath = join(projectRoot, "01_行情收集/BOSS样本质量验收报告.csv");
const outputCsvPath = join(projectRoot, "01_行情收集/BOSS人工采样批次质量门禁.csv");
const outputMdPath = join(projectRoot, "01_行情收集/BOSS人工采样批次质量门禁.md");

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

function boolOf(value) {
  return value === true || String(value).toLowerCase() === "true" || String(value) === "是";
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
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

function isExactBatchMatch(task, job) {
  return Boolean(
    job.samplingBatchId &&
    String(job.samplingBatchId) === String(task.batchId) &&
    String(job.samplingBatchTask) === String(task.taskInBatch)
  );
}

function matchesTask(task, job) {
  if (job.source && job.source !== "BOSS直聘") return false;
  if (isExactBatchMatch(task, job)) return true;
  return matchesCompany(task, job) && matchesRole(task, job);
}

function qualityForJob(job, qualityById) {
  const row = qualityById.get(job.id) || {};
  const qualityScore = numberOf(row.qualityScore);
  const detailTextLength = numberOf(row.detailTextLength) || String(job.detailText || "").length;
  const salaryReadable = boolOf(row.salaryReadable);
  const roleRelevant = row.roleRelevant === undefined ? true : boolOf(row.roleRelevant);
  const aiRelevant = row.aiRelevant === undefined ? true : boolOf(row.aiRelevant);
  return {
    ...row,
    qualityScore,
    detailTextLength,
    salaryReadable,
    roleRelevant,
    aiRelevant,
    usable: qualityScore >= 65 && roleRelevant && aiRelevant,
    readableSalary: salaryReadable,
    detailSample: detailTextLength >= 300
  };
}

function countUniqueJobs(jobs, predicate) {
  return unique(jobs.filter(predicate).map((job) => job.id)).length;
}

function taskGate(row) {
  if (row.matchedCount === 0) return "未开始";
  if (row.metadataMatchedCount === 0) return "仅旧样本参考/未归属批次";
  if (row.qualityUsableCount < row.targetCopies) return "质量不足";
  if (row.readableSalaryCount < Math.min(2, row.targetCopies)) return "可写方向观察/薪资不足";
  if (row.detailSampleCount < Math.min(2, row.targetCopies)) return "可写薪资观察/能力详情不足";
  return "达标";
}

function batchGate(row) {
  if (row.matchedCount === 0) return "未开始";
  if (row.metadataMatchedCount === 0) return "仅旧样本参考/未归属批次";
  if (row.qualityUsableCount < row.targetCopies) return "质量不足";
  if (row.readableSalaryCount < Math.min(5, row.targetCopies)) return "可写方向观察/薪资不足";
  if (row.detailSampleCount < Math.min(5, row.targetCopies)) return "可写薪资观察/能力详情不足";
  return "达标";
}

function nextActionForGate(gate, row) {
  if (gate === "未开始") return `先打开 ${row.company || row.batchId}/${row.role || "下一入口"}，导入 ${row.targetCopies || 1} 条高相关岗位`;
  if (gate === "仅旧样本参考/未归属批次") return "使用批次包里的 import:manual 命令重新导入或补录批次元数据";
  if (gate === "质量不足") return `继续补 ${row.remainingQualitySamples} 条高相关且字段完整的岗位`;
  if (gate.includes("薪资不足")) return "优先复制带可读薪资的岗位详情或卡片";
  if (gate.includes("能力详情不足")) return "优先复制岗位详情页正文，补职责、要求、客户类型和能力关键词";
  return "可进入批后汇总；继续扩大样本以支撑大样本结论";
}

function mdRows(rows, fallback) {
  return rows.length ? rows.join("\n") : fallback;
}

if (!existsSync(qualityCsvPath)) {
  throw new Error(`未找到样本质量报告：${qualityCsvPath}。请先运行 npm run sampling:quality。`);
}

const tasks = readBatchTasks();
const jobs = readJobs();
const qualityRows = readCsv(qualityCsvPath);
const qualityById = new Map(qualityRows.map((row) => [row.id, row]));

const taskRows = tasks.map((task) => {
  const targetCopies = numberOf(task.targetCopies) || 1;
  const matchedJobs = jobs.filter((job) => matchesTask(task, job));
  const exactJobs = matchedJobs.filter((job) => isExactBatchMatch(task, job));
  const usableJobs = matchedJobs.filter((job) => qualityForJob(job, qualityById).usable);
  const readableSalaryJobs = matchedJobs.filter((job) => qualityForJob(job, qualityById).readableSalary);
  const detailJobs = matchedJobs.filter((job) => qualityForJob(job, qualityById).detailSample);
  const matchedCount = unique(matchedJobs.map((job) => job.id)).length;
  const qualityUsableCount = unique(usableJobs.map((job) => job.id)).length;
  const row = {
    level: "入口",
    batchNumber: task.batchNumber || "",
    batchId: task.batchId || "",
    batchMode: task.batchMode || "",
    taskInBatch: task.taskInBatch || "",
    priority: task.priority || "",
    route: task.route || "",
    segment: task.segment || "",
    company: task.company || "",
    role: task.role || "",
    roleFamily: task.roleFamily || "",
    city: task.city || "",
    salaryBand: task.salaryBand || "",
    targetCopies,
    matchedCount,
    metadataMatchedCount: unique(exactJobs.map((job) => job.id)).length,
    legacyMatchedCount: Math.max(0, matchedCount - unique(exactJobs.map((job) => job.id)).length),
    qualityUsableCount,
    readableSalaryCount: unique(readableSalaryJobs.map((job) => job.id)).length,
    detailSampleCount: unique(detailJobs.map((job) => job.id)).length,
    remainingQualitySamples: Math.max(0, targetCopies - qualityUsableCount),
    matchedJobIds: unique(matchedJobs.map((job) => job.id)).join(";"),
    usableJobIds: unique(usableJobs.map((job) => job.id)).join(";"),
    safeHomeUrl: task.safeHomeUrl || "",
    searchKeyword: task.searchKeyword || "",
    referenceUrl: task.referenceUrl || task.manualUrl || "",
    manualUrl: task.manualUrl || "",
    importCommand: task.importCommand || "",
    issueSummary: ""
  };
  const gate = taskGate(row);
  const issues = [];
  if (row.metadataMatchedCount === 0 && row.matchedCount > 0) issues.push("匹配到旧样本但没有批次元数据");
  if (row.qualityUsableCount < row.targetCopies) issues.push("可用样本不足目标");
  if (row.readableSalaryCount < Math.min(2, row.targetCopies)) issues.push("可读薪资不足");
  if (row.detailSampleCount < Math.min(2, row.targetCopies)) issues.push("岗位详情不足");
  return {
    ...row,
    gate,
    issueSummary: issues.join("；") || "可用",
    nextAction: nextActionForGate(gate, row)
  };
});

const batchIds = unique(taskRows.map((row) => row.batchId));
const batchRows = batchIds.map((batchId) => {
  const rows = taskRows.filter((row) => row.batchId === batchId);
  const nextTask = rows.find((item) => item.gate !== "达标") || {};
  const matchedIds = unique(rows.flatMap((row) => String(row.matchedJobIds || "").split(";")));
  const usableIds = unique(rows.flatMap((row) => String(row.usableJobIds || "").split(";")));
  const matchedJobs = jobs.filter((job) => matchedIds.includes(job.id));
  const targetCopies = rows.reduce((sum, row) => sum + numberOf(row.targetCopies), 0);
  const row = {
    level: "批次",
    batchNumber: rows[0]?.batchNumber || "",
    batchId,
    batchMode: rows[0]?.batchMode || "",
    taskInBatch: "",
    priority: unique(rows.map((item) => item.priority)).join(";"),
    route: unique(rows.map((item) => item.route)).join(";"),
    segment: unique(rows.map((item) => item.segment)).join(";"),
    company: nextTask.company || "",
    role: nextTask.role || "",
    roleFamily: unique(rows.map((item) => item.roleFamily)).join(";"),
    city: unique(rows.map((item) => item.city)).join(";"),
    salaryBand: unique(rows.map((item) => item.salaryBand)).join(";"),
    targetCopies,
    matchedCount: matchedIds.length,
    metadataMatchedCount: rows.reduce((sum, item) => sum + numberOf(item.metadataMatchedCount), 0),
    legacyMatchedCount: rows.reduce((sum, item) => sum + numberOf(item.legacyMatchedCount), 0),
    qualityUsableCount: usableIds.length,
    readableSalaryCount: countUniqueJobs(matchedJobs, (job) => qualityForJob(job, qualityById).readableSalary),
    detailSampleCount: countUniqueJobs(matchedJobs, (job) => qualityForJob(job, qualityById).detailSample),
    remainingQualitySamples: Math.max(0, targetCopies - usableIds.length),
    matchedJobIds: matchedIds.join(";"),
    usableJobIds: usableIds.join(";"),
    safeHomeUrl: nextTask.safeHomeUrl || "",
    searchKeyword: nextTask.searchKeyword || "",
    referenceUrl: nextTask.referenceUrl || nextTask.manualUrl || "",
    manualUrl: nextTask.manualUrl || "",
    importCommand: nextTask.importCommand || "",
    issueSummary: "",
    completedTaskCount: rows.filter((item) => item.gate === "达标").length,
    taskCount: rows.length
  };
  const gate = batchGate(row);
  const issues = [];
  if (row.metadataMatchedCount === 0 && row.matchedCount > 0) issues.push("批次样本未用批次命令导入");
  if (row.qualityUsableCount < row.targetCopies) issues.push("可用样本不足批次目标");
  if (row.readableSalaryCount < Math.min(5, row.targetCopies)) issues.push("批次薪资样本不足");
  if (row.detailSampleCount < Math.min(5, row.targetCopies)) issues.push("批次详情样本不足");
  return {
    ...row,
    gate,
    issueSummary: issues.join("；") || "可用",
    nextAction: nextActionForGate(gate, row)
  };
});

const csvHeaders = [
  "level",
  "batchNumber",
  "batchId",
  "batchMode",
  "taskInBatch",
  "priority",
  "route",
  "segment",
  "company",
  "role",
  "roleFamily",
  "city",
  "salaryBand",
  "targetCopies",
  "matchedCount",
  "metadataMatchedCount",
  "legacyMatchedCount",
  "qualityUsableCount",
  "readableSalaryCount",
  "detailSampleCount",
  "remainingQualitySamples",
  "gate",
  "issueSummary",
  "nextAction",
  "safeHomeUrl",
  "searchKeyword",
  "referenceUrl",
  "manualUrl",
  "importCommand",
  "matchedJobIds",
  "usableJobIds"
];

mkdirSync(dirname(outputMdPath), { recursive: true });
writeFileSync(
  outputCsvPath,
  `${csv([csvHeaders, ...[...batchRows, ...taskRows].map((row) => csvHeaders.map((header) => row[header]))])}\n`
);

const batchMdRows = batchRows.map((row) => {
  return `| ${row.batchId} | ${row.batchMode} | ${row.gate} | ${row.completedTaskCount}/${row.taskCount} | ${row.qualityUsableCount}/${row.targetCopies} | ${row.readableSalaryCount} | ${row.detailSampleCount} | ${row.remainingQualitySamples} | ${row.nextAction} |`;
});

const nextTaskRows = taskRows
  .filter((row) => row.gate !== "达标")
  .slice(0, 20)
  .map((row) => {
    return `| ${row.batchId} | ${row.priority} | ${row.segment} | ${row.company} | ${row.role} | ${row.salaryBand || "-"} | ${row.gate} | ${row.qualityUsableCount}/${row.targetCopies} | ${row.readableSalaryCount} | ${row.detailSampleCount} | \`${row.safeHomeUrl}\` | \`${row.searchKeyword}\` | \`${row.importCommand}\` |`;
  });

const totalTargetCopies = batchRows.reduce((sum, row) => sum + numberOf(row.targetCopies), 0);
const totalMatched = unique(batchRows.flatMap((row) => String(row.matchedJobIds || "").split(";"))).length;
const totalUsable = unique(batchRows.flatMap((row) => String(row.usableJobIds || "").split(";"))).length;
const totalMetadataMatched = batchRows.reduce((sum, row) => sum + numberOf(row.metadataMatchedCount), 0);
const totalReadable = unique(
  jobs
    .filter((job) => batchRows.some((row) => String(row.matchedJobIds || "").split(";").includes(job.id)))
    .filter((job) => qualityForJob(job, qualityById).readableSalary)
    .map((job) => job.id)
).length;
const totalDetail = unique(
  jobs
    .filter((job) => batchRows.some((row) => String(row.matchedJobIds || "").split(";").includes(job.id)))
    .filter((job) => qualityForJob(job, qualityById).detailSample)
    .map((job) => job.id)
).length;
const completedBatches = batchRows.filter((row) => row.gate === "达标").length;
const directionBatches = batchRows.filter((row) => row.gate.includes("方向观察") || row.gate === "达标").length;
const salaryBatches = batchRows.filter((row) => row.gate.includes("薪资观察") || row.gate === "达标").length;
const notStartedBatches = batchRows.filter((row) => row.gate === "未开始").length;

const md = `# BOSS人工采样批次质量门禁

更新时间：${formatDate()}

## 一、本质判断

这份门禁不是新增岗位，也不是替代人工采样，而是把“批次是否执行”和“样本是否可用于市场结论”合并验收。它解决的是一个证据链问题：导入了岗位文本，不等于这个批次已经能支撑薪资、能力要求或公司类型判断。

当前最大的矛盾是：既要尽快形成 AI 全行业销售岗位大样本判断，又不能把旧样本、弱样本、没有批次归属的样本写成 BOSS 平台结论。

## 二、总览

| 指标 | 数值 |
| --- | ---: |
| 批次数 | ${batchRows.length} |
| 入口数 | ${taskRows.length} |
| 目标导入岗位数 | ${totalTargetCopies} |
| 已匹配岗位数 | ${totalMatched} |
| 精确批次归属样本 | ${totalMetadataMatched} |
| 可用样本数 | ${totalUsable} |
| 可读薪资样本 | ${totalReadable} |
| 有详情文本样本 | ${totalDetail} |
| 达标批次 | ${completedBatches} |
| 可写方向观察批次 | ${directionBatches} |
| 可写薪资观察批次 | ${salaryBatches} |
| 未开始批次 | ${notStartedBatches} |

## 三、批次门禁

| 批次 | 模式 | 门禁 | 达标入口 | 可用/目标 | 可读薪资 | 详情样本 | 剩余质量样本 | 下一动作 |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
${mdRows(batchMdRows, "| 暂无 | - | - | 0/0 | 0/0 | 0 | 0 | 0 | - |")}

## 四、下一步入口

| 批次 | 优先级 | 赛道 | 公司 | 岗位 | 薪资参考 | 门禁 | 可用/目标 | 可读薪资 | 详情样本 | BOSS首页 | 站内搜索关键词 | 导入命令 |
| --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | --- | --- | --- |
${mdRows(nextTaskRows, "| 暂无 | - | - | - | - | - | - | 0/0 | 0 | 0 | - | - | - |")}

## 五、门禁规则

1. 入口没有匹配样本：未开始。
2. 匹配到旧样本但没有 \`--batch-id\` 和 \`--batch-task\`：只能作参考，不能证明当前批次完成。
3. 可用样本不足目标数：质量不足。
4. 可用样本达标但可读薪资不足：只能写方向观察，不能写薪资区间。
5. 可读薪资达标但详情正文不足：可以写薪资观察，但不能稳定抽取能力要求。
6. 数量、质量、薪资、详情均达标：该批次可进入批后汇总，但仍需继续扩大样本才能支撑全行业大样本结论。
7. 执行动作只使用 BOSS 首页和站内搜索关键词；完整搜索 URL 只保留在 CSV 的 referenceUrl 字段用于审计。

## 六、CSV输出

\`\`\`text
${outputCsvPath}
\`\`\`
`;

writeFileSync(outputMdPath, md);

console.log(`已生成：${outputMdPath}`);
console.log(`已生成：${outputCsvPath}`);
console.log(`批次数：${batchRows.length}`);
console.log(`达标批次：${completedBatches}`);
console.log(`可用样本数：${totalUsable}`);
console.log(`精确批次归属样本：${totalMetadataMatched}`);
