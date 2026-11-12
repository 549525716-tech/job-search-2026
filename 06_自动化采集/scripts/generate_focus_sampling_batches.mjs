#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const coverageCsvPath = join(projectRoot, "01_行情收集/AI重点公司与赛道覆盖审计.csv");
const outputCsvPath = join(projectRoot, "01_行情收集/BOSS重点公司补样批次包.csv");
const outputMdPath = join(projectRoot, "01_行情收集/BOSS重点公司补样批次包.md");
const safeHomeUrl = "https://www.zhipin.com/";

function parseArgs(argv) {
  const args = {
    limit: 30,
    batchSize: 5,
    city: "广州"
  };
  for (let index = 2; index < argv.length; index += 1) {
    const key = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${key}`);
      return argv[index];
    };
    if (key === "--limit") args.limit = Number.parseInt(next(), 10);
    else if (key === "--batch-size") args.batchSize = Number.parseInt(next(), 10);
    else if (key === "--city") args.city = next();
    else if (key === "--help" || key === "-h") args.help = true;
    else throw new Error(`Unknown option: ${key}`);
  }
  return args;
}

function usage() {
  return `Usage:
  npm run sampling:focus-batches
  npm run sampling:focus-batches -- --limit 30 --batch-size 5 --city 广州

Purpose:
  Turn focus coverage gaps into human-executable BOSS sampling batches. This
  script only writes local files. It never opens, reads, refreshes, or controls
  BOSS pages.
`;
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

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function shellQuote(value) {
  return `"${String(value ?? "").replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function metadataFlag(name, value) {
  if (value === undefined || value === null || value === "") return "";
  return `${name} ${shellQuote(value)}`;
}

function queryFromUrl(url) {
  try {
    return new URL(url).searchParams.get("query") || "";
  } catch {
    return "";
  }
}

function searchKeyword(row) {
  return row.searchKeyword || queryFromUrl(row.manualUrl) || `${row.company || ""} ${row.nextRole || ""}`.trim();
}

function inferPriority(row) {
  if (row.userNamed === "是" && /芯片|半导体|服务器|智算|大模型|MaaS|工业/.test(`${row.focusGroup}${row.segment}`)) return "P0";
  if (row.userNamed === "是") return "P1";
  return "P2";
}

function inferRoleFamily(role) {
  if (/解决方案|售前|顾问|POC|Demo|方案/.test(role)) return "售前/解决方案顾问";
  if (/渠道|生态|伙伴|代理/.test(role)) return "渠道/生态/伙伴销售";
  if (/总监|负责人|管理|经理/.test(role)) return "销售管理/区域负责人";
  if (/SaaS|软件|AI|大模型|智能体/.test(role)) return "AI软件/大模型销售";
  return "大客户/行业销售经理";
}

function inferSalaryBand(row) {
  if (row.externalSalaryBands) return row.externalSalaryBands;
  if (/芯片|GPU|半导体/.test(`${row.focusGroup}${row.segment}`)) return "40K-70K";
  if (/服务器|智算|数据中心/.test(`${row.focusGroup}${row.segment}`)) return "20K-35K";
  if (/工业|制造|汽车|机器人/.test(`${row.focusGroup}${row.segment}`)) return "15K-60K";
  if (/云|MaaS/.test(`${row.focusGroup}${row.segment}`)) return "10K-65K";
  if (/大模型|Agent/.test(`${row.focusGroup}${row.segment}`)) return "8K-70K";
  return "待BOSS校验";
}

function targetCopies(row) {
  if (row.coverageGate === "已有旧样本/缺当前人工批次") return 2;
  if (row.userNamed === "是") return 3;
  if (numberOf(row.publicBossSignalCount) + numberOf(row.externalSalarySignalCount) > 0) return 2;
  return 1;
}

function gateRank(row) {
  const ranks = {
    "缺人工批次": 5,
    "已有旧样本/缺当前人工批次": 4,
    "缺可读薪资": 3,
    "缺岗位详情": 3,
    "有样本但质量不足": 2,
    "待人工导入BOSS样本": 1
  };
  return ranks[row.coverageGate] || 0;
}

function groupRank(row) {
  const text = `${row.focusGroup}${row.segment}`;
  if (/大模型|MaaS|Agent/.test(text)) return 5;
  if (/芯片|GPU|半导体/.test(text)) return 5;
  if (/服务器|智算|数据中心/.test(text)) return 4;
  if (/工业|制造/.test(text)) return 3;
  if (/汽车|机器人/.test(text)) return 2;
  return 1;
}

function chunk(items, size) {
  const result = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function baseImportCommand(row, city) {
  return [
    "npm run import:manual --",
    "--source",
    shellQuote("BOSS直聘"),
    "--query",
    shellQuote(searchKeyword(row)),
    "--company",
    shellQuote(row.company),
    "--role",
    shellQuote(row.nextRole),
    "--city",
    shellQuote(city)
  ].join(" ");
}

function importCommandForBatchTask(batch, row, taskIndex, city) {
  const roleFamily = inferRoleFamily(row.nextRole);
  const flags = [
    metadataFlag("--batch-id", batch.batchId),
    metadataFlag("--batch-task", taskIndex + 1),
    metadataFlag("--batch-target-copies", targetCopies(row)),
    metadataFlag("--priority", inferPriority(row)),
    metadataFlag("--route", row.route),
    metadataFlag("--segment", row.segment || row.focusGroup),
    metadataFlag("--role-family", roleFamily),
    metadataFlag("--salary-band", inferSalaryBand(row))
  ].filter(Boolean);
  return `${baseImportCommand(row, city)} ${flags.join(" ")}`;
}

function topCountLabel(items) {
  const counts = new Map();
  for (const item of items.filter(Boolean)) counts.set(item, (counts.get(item) || 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-Hans-CN"))
    .map(([name, count]) => `${name}(${count})`)
    .join("、");
}

function batchMode(rows) {
  const text = rows.map((row) => `${row.focusGroup}${row.segment}${row.route}`).join("\n");
  const hasChip = /芯片|GPU|半导体/.test(text);
  const hasCompute = /服务器|智算|数据中心/.test(text);
  const hasSoftware = /大模型|MaaS|Agent|软件|云/.test(text);
  if ((hasChip || hasCompute) && hasSoftware) return "重点软硬件对照补样";
  if (hasChip) return "重点芯片/半导体补样";
  if (hasCompute) return "重点算力基础设施补样";
  if (hasSoftware) return "重点AI软件落地补样";
  return "重点公司综合补样";
}

function batchGoal(rows) {
  return `补齐 ${topCountLabel(rows.map((row) => row.focusGroup)) || "重点方向"} 的公司级BOSS证据闭环`;
}

const args = parseArgs(process.argv);
if (args.help) {
  console.log(usage());
  process.exit(0);
}

if (!existsSync(coverageCsvPath)) {
  throw new Error(`未找到重点覆盖审计：${coverageCsvPath}。请先运行 npm run coverage:focus。`);
}

const coverageRows = readCsv(coverageCsvPath);
const candidateRows = coverageRows
  .filter((row) => ["缺人工批次", "已有旧样本/缺当前人工批次"].includes(row.coverageGate))
  .filter((row) => row.company && row.nextRole && row.manualUrl)
  .sort((a, b) => {
    return (b.userNamed === "是") - (a.userNamed === "是") ||
      gateRank(b) - gateRank(a) ||
      groupRank(b) - groupRank(a) ||
      (numberOf(b.publicBossSignalCount) + numberOf(b.externalSalarySignalCount)) - (numberOf(a.publicBossSignalCount) + numberOf(a.externalSalarySignalCount)) ||
      a.company.localeCompare(b.company, "zh-Hans-CN");
  })
  .slice(0, Number.isFinite(args.limit) && args.limit > 0 ? args.limit : 30);

const batchSize = Number.isFinite(args.batchSize) && args.batchSize > 0 ? args.batchSize : 5;
const batches = chunk(candidateRows, batchSize).map((rows, index) => {
  const batchNumber = index + 1;
  const batchId = `BOSS-FOCUS-${String(batchNumber).padStart(2, "0")}`;
  return {
    batchNumber,
    batchId,
    mode: batchMode(rows),
    rows,
    targetCopies: rows.reduce((sum, row) => sum + targetCopies(row), 0),
    goal: batchGoal(rows)
  };
});

const csvHeaders = [
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
  "safeHomeUrl",
  "searchKeyword",
  "referenceUrl",
  "salaryBand",
  "sampleProgress",
  "sampleGap",
  "targetCopies",
  "manualUrl",
  "importCommand",
  "requiredFields",
  "acceptanceCriteria",
  "rejectRule",
  "afterBatchCommand"
];

const requiredFields = "公司;岗位;薪资;城市;经验;学历;职责;要求;客户类型;是否销售管理;是否售前/解决方案;AI/大模型/硬件/行业关键词";
const acceptanceCriteria = "只导入销售、售前、解决方案、渠道、销售管理相关岗位；岗位正文必须能看出AI/算力/硬件/行业场景相关性；优先复制详情页正文和可读薪资";
const rejectRule = "排除纯研发、运营、客服、行政、无AI/算力/硬件/行业场景相关性的岗位";
const afterBatchCommand = "npm run summary:jobs && npm run sampling:quality && npm run sampling:batch-status && npm run sampling:batch-quality && npm run coverage:focus && npm run report:full && npm run audit:research";

const flatRows = batches.flatMap((batch) => batch.rows.map((row, index) => ({
  batchNumber: batch.batchNumber,
  batchId: batch.batchId,
  batchMode: batch.mode,
  taskInBatch: index + 1,
  globalOrder: index + 1 + (batch.batchNumber - 1) * batchSize,
  priority: inferPriority(row),
  route: row.route || "",
  segment: row.segment || row.focusGroup || "",
  company: row.company,
  role: row.nextRole,
  roleFamily: inferRoleFamily(row.nextRole),
  city: args.city,
  safeHomeUrl,
  searchKeyword: searchKeyword(row),
  referenceUrl: row.manualUrl,
  salaryBand: inferSalaryBand(row),
  sampleProgress: `${row.bossUsableCount || 0}/${targetCopies(row)}`,
  sampleGap: Math.max(0, targetCopies(row) - numberOf(row.bossUsableCount)),
  targetCopies: targetCopies(row),
  manualUrl: row.manualUrl,
  importCommand: importCommandForBatchTask(batch, row, index, args.city),
  requiredFields,
  acceptanceCriteria,
  rejectRule,
  afterBatchCommand
})));

mkdirSync(dirname(outputCsvPath), { recursive: true });
writeFileSync(outputCsvPath, `${csv([csvHeaders, ...flatRows.map((row) => csvHeaders.map((header) => row[header]))])}\n`);

const batchSummaryRows = batches.map((batch) => {
  return `| ${batch.batchId} | ${batch.mode} | ${topCountLabel(batch.rows.map((row) => inferPriority(row))) || "-"} | ${topCountLabel(batch.rows.map((row) => row.focusGroup)) || "-"} | ${batch.rows.length} | ${batch.targetCopies} | ${batch.goal} |`;
});

const batchSections = batches.map((batch) => {
  const taskRows = batch.rows.map((row, index) => {
    return `| ${index + 1} | ${inferPriority(row)} | ${row.focusGroup || "-"} | ${row.company} | ${row.nextRole} | ${inferSalaryBand(row)} | ${row.coverageGate} | ${targetCopies(row)} | \`${safeHomeUrl}\` | \`${searchKeyword(row)}\` | \`${importCommandForBatchTask(batch, row, index, args.city)}\` |`;
  });
  return `## ${batch.batchId}：${batch.mode}

目标：${batch.goal}

| 序号 | 优先级 | 重点方向 | 公司 | 岗位词 | 薪资参考 | 覆盖门禁 | 目标导入 | BOSS首页 | 站内搜索关键词 | 导入命令 |
| ---: | --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- |
${taskRows.join("\n")}

本批完成后运行：

\`\`\`bash
${afterBatchCommand}
\`\`\`
`;
});

const totalTargetCopies = batches.reduce((sum, batch) => sum + batch.targetCopies, 0);
const userNamedCount = candidateRows.filter((row) => row.userNamed === "是").length;
const hardwareCount = candidateRows.filter((row) => /芯片|GPU|半导体|服务器|智算|数据中心/.test(`${row.focusGroup}${row.segment}`)).length;
const softwareCount = candidateRows.filter((row) => /大模型|MaaS|Agent|软件|云/.test(`${row.focusGroup}${row.segment}`)).length;

const md = `# BOSS重点公司补样批次包

更新时间：${formatDate()}

## 一、本质判断

这份批次包不是替代全量人工采样包，而是专门补“用户点名/强关注方向”的证据缺口。它解决的是：月之暗面、智谱AI、MiniMax、芯片/半导体/智算基础设施等公司已经进入公司池和查询计划，但还没有进入当前批次或只有旧样本，导致薪资和能力要求不能写成 BOSS 结论。

当前最大的矛盾是：既要把重点公司尽快纳入 BOSS 样本闭环，又不能用自动打开、自动刷新、自动读取的方式触发风控。

## 二、执行边界

- 本文件只提供人工搜索入口和导入命令，不自动打开 BOSS。
- 先运行 \`npm run auth:boss\` 生成本地安全入口页，再在正常 Chrome 里手动打开入口页并访问 BOSS。
- 每条任务先进入 BOSS 首页，再在站内搜索框输入关键词；完整 URL 只保留在 CSV 的 referenceUrl 字段作审计，不作为操作入口。
- 每次只做一个批次，入口之间按人工阅读节奏停留。
- 每条样本必须是销售、售前、解决方案、渠道或销售管理相关岗位。

## 三、批次总览

| 指标 | 数值 |
| --- | ---: |
| 批次数 | ${batches.length} |
| 搜索入口 | ${candidateRows.length} |
| 目标导入岗位数 | ${totalTargetCopies} |
| 用户点名/强关注入口 | ${userNamedCount} |
| 硬件/半导体/智算入口 | ${hardwareCount} |
| AI软件/云/MaaS入口 | ${softwareCount} |

| 批次 | 模式 | 优先级 | 重点方向 | 入口数 | 目标导入 | 目标 |
| --- | --- | --- | --- | ---: | ---: | --- |
${batchSummaryRows.join("\n")}

## 四、批次明细

${batchSections.join("\n")}

## 五、CSV输出

\`\`\`text
${outputCsvPath}
\`\`\`
`;

writeFileSync(outputMdPath, md);

console.log(`已生成：${outputMdPath}`);
console.log(`已生成：${outputCsvPath}`);
console.log(`批次数：${batches.length}`);
console.log(`搜索入口：${candidateRows.length}`);
console.log(`目标导入岗位数：${totalTargetCopies}`);
