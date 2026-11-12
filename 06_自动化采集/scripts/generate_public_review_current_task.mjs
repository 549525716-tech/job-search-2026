#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const statusCsvPath = join(projectRoot, "01_行情收集/BOSS公开线索复核收件箱质量预检.csv");
const queueCsvPath = join(projectRoot, "01_行情收集/BOSS公开高薪线索低频复核清单.csv");
const outputMdPath = join(projectRoot, "01_行情收集/BOSS公开线索当前复核任务.md");

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
  const lines = readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim());
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

function mdTable(rows) {
  return [
    "| 字段 | 内容 |",
    "| --- | --- |",
    ...rows.map(([key, value]) => `| ${key} | ${String(value ?? "").replaceAll("|", "/")} |`)
  ].join("\n");
}

function main() {
  const statusRows = readCsv(statusCsvPath);
  const queueRows = readCsv(queueCsvPath);
  const queueByRank = new Map(queueRows.map((row) => [String(row.rank || ""), row]));
  const current = statusRows.find((row) => row.pasted !== "是")
    || statusRows.find((row) => row.readyToImport !== "是")
    || statusRows[0];

  if (!current) {
    throw new Error("未找到公开复核任务。请先运行 npm run leads:public-highsalary && npm run sampling:public-review-status");
  }

  const queue = queueByRank.get(String(current.rank || "")) || {};
  const pasted = statusRows.filter((row) => row.pasted === "是").length;
  const ready = statusRows.filter((row) => row.readyToImport === "是").length;
  const estimatedJobs = statusRows.reduce((sum, row) => sum + Number(row.estimatedJobs || 0), 0);

  const report = `# BOSS公开线索当前复核任务

更新时间：${formatDate()}

## 一、当前状态

${mdTable([
  ["复核入口总数", statusRows.length],
  ["已粘贴段落", pasted],
  ["可导入段落", ready],
  ["估算岗位数", estimatedJobs],
  ["当前状态", current.pasted === "是" ? current.status : "等待人工复制岗位详情"]
])}

## 二、当前只处理这一条

${mdTable([
  ["排名", current.rank],
  ["公司", current.company],
  ["岗位", current.role],
  ["赛道", current.segment],
  ["岗位族", current.roleFamily],
  ["薪资参考", queue.salary || "见公开线索"],
  ["复核阶段", queue.reviewStage || "BOSS首页优先复核"],
  ["站内搜索关键词", `\`${queue.searchKeyword || `${current.company} ${current.role}`}\``],
  ["来源", queue.source || "公开线索"],
  ["公开来源URL", queue.sourceUrl || "-"],
  ["粘贴命令", `npm run paste:public-review-current -- --rank ${current.rank}`],
  ["预检命令", "npm run sampling:public-review-status"],
  ["导入命令", "npm run import:public-review-inbox -- --dry-run && npm run import:public-review-inbox -- --refresh"]
])}

## 三、低频规则

1. 只从系统 Chrome 的 BOSS 首页进入，在站内搜索框输入当前关键词。
2. 本轮只处理这一条，不连续搜索多个关键词。
3. 复制 1 到 3 条岗位详情后停止。
4. 处理完本条后至少间隔 10-20 分钟；连续 3 条后冷却 30 分钟。
5. 不使用 9333/CDP/内置浏览器，不打开脚本搜索 URL，不批量刷新。

## 四、复制岗位时至少包含

- 岗位名称
- 公司名称
- 薪资
- 城市
- 经验
- 学历
- 岗位职责
- 任职要求

## 五、粘贴后运行

\`\`\`bash
npm run paste:public-review-current -- --rank ${current.rank}
npm run sampling:public-review-status
npm run import:public-review-inbox -- --dry-run
npm run import:public-review-inbox -- --refresh
\`\`\`

## 六、相关文件

- \`01_行情收集/BOSS公开高薪线索低频复核清单.md\`
- \`01_行情收集/BOSS公开线索复核收件箱.md\`
- \`01_行情收集/BOSS公开线索复核收件箱质量预检.md\`
`;

  writeFileSync(outputMdPath, report, "utf8");
  console.log(`已生成：${outputMdPath}`);
  console.log(`当前关键词：${queue.searchKeyword || `${current.company} ${current.role}`}`);
}

main();
