#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const queueCsvPath = join(projectRoot, "01_行情收集/BOSS高薪销售岗位低频采样清单.csv");
const statusCsvPath = join(projectRoot, "01_行情收集/BOSS高薪销售岗位采样收件箱质量预检.csv");
const jobsPath = join(projectRoot, "01_行情收集/data/jobs.jsonl");
const currentTaskPath = join(projectRoot, "01_行情收集/BOSS当前高薪销售采样任务.md");
const overviewPath = join(projectRoot, "01_行情收集/BOSS高薪销售采样状态总览.md");

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

function readCsv(filePath) {
  if (!existsSync(filePath)) return [];
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
  });
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

function countJobs(filePath) {
  if (!existsSync(filePath)) return { total: 0, boss: 0, highSalary: 0 };
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/).filter((line) => line.trim());
  let boss = 0;
  let highSalary = 0;
  for (const line of lines) {
    try {
      const job = JSON.parse(line);
      if (job.source === "BOSS直聘") boss += 1;
      if (job.samplingBatchId === "BOSS-HIGHSALARY") highSalary += 1;
    } catch {
      // Ignore malformed historical rows.
    }
  }
  return { total: lines.length, boss, highSalary };
}

function numberOf(value) {
  const num = Number.parseFloat(String(value || "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(num) ? num : 0;
}

const queueRows = readCsv(queueCsvPath);
const statusRows = readCsv(statusCsvPath);
const jobCounts = countJobs(jobsPath);
const current = queueRows.find((row) => row.currentTask === "是") || queueRows.find((row) => numberOf(row.remainingCopies) > 0) || queueRows[0] || {};
const pastedRows = statusRows.filter((row) => row.pasted === "是");
const readyRows = statusRows.filter((row) => row.readyToImport === "是");
const estimatedJobs = statusRows.reduce((sum, row) => sum + numberOf(row.estimatedJobs), 0);
const importedTotalTarget = queueRows.reduce((sum, row) => sum + numberOf(row.targetCopies), 0);
const importedTotal = queueRows.reduce((sum, row) => sum + numberOf(row.importedCount), 0);
const remainingTotal = queueRows.reduce((sum, row) => sum + numberOf(row.remainingCopies), 0);
const status = readyRows.length
  ? "可导入"
  : pastedRows.length
    ? "已粘贴但需预检/补字段"
    : "等待人工复制岗位详情";

const md = `# BOSS高薪销售采样状态总览

更新时间：${formatDate()}

## 一、当前状态

| 指标 | 当前值 |
| --- | ---: |
| 高薪队列入口 | ${queueRows.length} |
| 高薪目标岗位数 | ${importedTotalTarget} |
| 高薪已导入岗位数 | ${importedTotal} |
| 高薪剩余目标岗位数 | ${remainingTotal} |
| 收件箱已粘贴段落 | ${pastedRows.length} |
| 收件箱可导入段落 | ${readyRows.length} |
| 收件箱估算岗位数 | ${estimatedJobs} |
| 全部岗位库样本 | ${jobCounts.total} |
| BOSS岗位样本 | ${jobCounts.boss} |
| BOSS高薪批次样本 | ${jobCounts.highSalary} |
| 当前状态 | ${status} |

## 二、当前只处理这一条

| 字段 | 内容 |
| --- | --- |
| 排名 | ${current.rank || "-"} |
| 公司 | ${current.company || "-"} |
| 岗位 | ${current.role || "-"} |
| 赛道 | ${current.segment || "-"} |
| 薪资参考 | ${current.salaryBand || "-"} |
| 已导入/目标 | ${current.importedCount || 0}/${current.targetCopies || 0} |
| 剩余目标 | ${current.remainingCopies || 0} |
| 收件箱已有文本 | ${current.inboxHasText || "否"} |
| 站内搜索关键词 | \`${current.searchKeyword || ""}\` |

## 三、判断

${readyRows.length
    ? "收件箱里已有可导入岗位文本，可以直接执行导入刷新。"
    : pastedRows.length
      ? "收件箱里已有文本，但预检未达到可导入标准；需要补齐薪资、城市、经验、学历、职责或任职要求。"
      : "当前阻塞点不是脚本或登录态，而是还没有从 BOSS 页面人工复制岗位详情到本地收件箱。"}

## 四、下一步命令

如果你已经在 BOSS 页面复制了岗位详情：

\`\`\`bash
npm run paste:highsalary-current
npm run import:highsalary-inbox -- --refresh
\`\`\`

如果还没有复制岗位详情：

\`\`\`bash
npm run auth:boss -- --launch-handoff
\`\`\`

然后在系统 Chrome 的 BOSS 首页站内搜索：

\`\`\`text
${current.searchKeyword || ""}
\`\`\`

## 五、相关文件

- \`01_行情收集/BOSS当前高薪销售采样任务.md\`
- \`01_行情收集/BOSS高薪销售岗位低频采样清单.html\`
- \`01_行情收集/BOSS高薪销售岗位采样收件箱.md\`
- \`01_行情收集/BOSS高薪销售岗位采样收件箱质量预检.md\`
`;

writeFileSync(overviewPath, md, "utf8");
console.log(`已生成：${overviewPath}`);
console.log(`当前状态：${status}`);
console.log(`当前关键词：${current.searchKeyword || ""}`);
