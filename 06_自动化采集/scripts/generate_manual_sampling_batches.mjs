#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const workbenchPath = join(projectRoot, "01_行情收集/BOSS人工补样工作台.csv");
const nextQueuePath = join(projectRoot, "01_行情收集/BOSS下一轮优先采样清单.csv");
const gapPath = join(projectRoot, "01_行情收集/BOSS全行业样本缺口路线图.csv");
const outputCsvPath = join(projectRoot, "01_行情收集/BOSS人工采样批次包.csv");
const outputMdPath = join(projectRoot, "01_行情收集/BOSS人工采样批次包.md");
const safeHomeUrl = "https://www.zhipin.com/";

function parseArgs(argv) {
  const args = {
    limit: 30,
    batchSize: 5,
    city: ""
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
  npm run sampling:batches
  npm run sampling:batches -- --limit 30 --batch-size 5 --city 广州

Purpose:
  Turn the manual BOSS workbench into small human-executable batches. This
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

function topCountLabel(items) {
  const counts = new Map();
  for (const item of items.filter(Boolean)) counts.set(item, (counts.get(item) || 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-Hans-CN"))
    .map(([name, count]) => `${name}(${count})`)
    .join("、");
}

function targetCopies(row) {
  const actionGoal = String(row.actionGoal || "");
  const explicit = actionGoal.match(/补(\d+)条/);
  if (explicit) return Number.parseInt(explicit[1], 10);
  const gap = numberOf(row.sampleGap);
  if (gap >= 10) return 3;
  if (gap >= 6) return 2;
  return 1;
}

function chunk(items, size) {
  const result = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function safeImportCommand(row) {
  if (row.importCommand) return row.importCommand;
  const source = '"BOSS直聘"';
  const query = `"${row.company} ${row.role}"`;
  const company = `"${row.company}"`;
  const role = `"${row.role}"`;
  const city = `"${row.city || "广州"}"`;
  return `npm run import:manual -- --source ${source} --query ${query} --company ${company} --role ${role} --city ${city}`;
}

function shellQuote(value) {
  return `"${String(value ?? "").replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function metadataFlag(name, value) {
  if (value === undefined || value === null || value === "") return "";
  return `${name} ${shellQuote(value)}`;
}

function importCommandForBatchTask(batch, row, taskIndex) {
  const baseCommand = safeImportCommand(row);
  const flags = [
    metadataFlag("--batch-id", batch.batchId),
    metadataFlag("--batch-task", taskIndex + 1),
    metadataFlag("--batch-target-copies", targetCopies(row)),
    metadataFlag("--priority", row.priority),
    metadataFlag("--route", row.route),
    metadataFlag("--segment", row.segment),
    metadataFlag("--role-family", row.roleFamily),
    metadataFlag("--salary-band", row.salaryBand)
  ].filter(Boolean);
  return `${baseCommand} ${flags.join(" ")}`;
}

function batchMode(batchRows) {
  const hasHardware = batchRows.some((row) => /芯片|硬件|智算|服务器|半导体|算力/.test(`${row.route}${row.segment}${row.roleFamily}`));
  const hasSoftware = batchRows.some((row) => /大模型|Agent|软件|SaaS|云/.test(`${row.route}${row.segment}${row.roleFamily}`));
  if (hasHardware && hasSoftware) return "软硬件对照补样";
  if (hasHardware) return "硬件/算力集中补样";
  if (hasSoftware) return "AI软件/应用集中补样";
  return "综合补样";
}

function batchGoal(batchRows) {
  const routeText = topCountLabel(batchRows.map((row) => row.route));
  const roleText = topCountLabel(batchRows.map((row) => row.roleFamily));
  return `验证 ${routeText || "AI相关路线"} 下 ${roleText || "销售岗位"} 的薪资、职责和能力门槛`;
}

function batchAcceptance(batchRows) {
  const target = batchRows.reduce((sum, row) => sum + targetCopies(row), 0);
  return `本批至少导入 ${target} 条高相关岗位文本；每条必须包含公司、岗位、薪资、城市、职责/要求，以及AI/算力/硬件/行业场景关键词。`;
}

function inferQuery(row) {
  if (row.query) return row.query;
  return `${row.company || ""} ${row.role || ""}`.trim();
}

function queryFromUrl(url) {
  try {
    return new URL(url).searchParams.get("query") || "";
  } catch {
    return "";
  }
}

function searchKeyword(row) {
  return row.searchKeyword || queryFromUrl(row.manualUrl) || inferQuery(row);
}

function normalizeWorkbenchRows(rows) {
  return rows.map((row, index) => ({
    order: numberOf(row.workOrder) || index + 1,
    priority: row.priority || "",
    route: row.route || "",
    segment: row.segment || "",
    company: row.company || "",
    role: row.role || "",
    roleFamily: row.roleFamily || "",
    city: row.city || "广州",
    salaryBand: row.salaryBand || "",
    sampleProgress: row.sampleProgress || "",
    sampleGap: row.sampleGap || "",
    actionGoal: row.actionGoal || "",
    rolePurpose: row.rolePurpose || "",
    manualUrl: row.manualUrl || row.searchUrl || "",
    importCommand: safeImportCommand(row),
    requiredFields: row.requiredFields || "",
    acceptanceCriteria: row.acceptanceCriteria || "",
    rejectRule: row.rejectRule || "排除纯研发、运营、客服、行政、无AI/算力/硬件/行业场景相关性的岗位",
    afterImport: row.afterImport || "导入后运行 npm run report:full && npm run audit:research"
  }));
}

function normalizeNextRows(rows, gapRows) {
  const gapBySegment = new Map(gapRows.map((row) => [row.segment, row]));
  return rows.map((row, index) => {
    const gap = gapBySegment.get(row.segment) || {};
    return {
      order: numberOf(row.rank) || index + 1,
      priority: row.priority || gap.priority || "",
      route: gap.route || "",
      segment: row.segment || "",
      company: row.company || "",
      role: row.role || "",
      roleFamily: row.roleFamily || "",
      city: row.city || "广州",
      salaryBand: row.salaryBand || gap.salaryBand || "",
      sampleProgress: row.sampleProgress || `${gap.importedJobs || 0}/${gap.targetSamples || 0}`,
      sampleGap: row.sampleGap || gap.sampleGap || "",
      actionGoal: numberOf(gap.sampleGap) >= 10 ? "先补3条高相关岗位" : "先补1条高相关岗位",
      rolePurpose: "验证销售岗位职责、薪资和能力要求",
      manualUrl: row.searchUrl || gap.nextSearchUrl || "",
      importCommand: safeImportCommand(row),
      requiredFields: gap.requiredFields || "",
      acceptanceCriteria: gap.acceptanceGate || "",
      rejectRule: "排除纯研发、运营、客服、行政、无AI/算力/硬件/行业场景相关性的岗位",
      afterImport: "导入后运行 npm run report:full && npm run audit:research"
    };
  });
}

const args = parseArgs(process.argv);
if (args.help) {
  console.log(usage());
  process.exit(0);
}

const gapRows = readCsv(gapPath);
const workbenchRows = readCsv(workbenchPath);
const nextRows = readCsv(nextQueuePath);
const sourceRows = workbenchRows.length
  ? normalizeWorkbenchRows(workbenchRows)
  : normalizeNextRows(nextRows, gapRows);

const filteredRows = sourceRows
  .filter((row) => !args.city || row.city === args.city)
  .slice()
  .sort((a, b) => a.order - b.order)
  .slice(0, Number.isFinite(args.limit) && args.limit > 0 ? args.limit : 30);

const batchSize = Number.isFinite(args.batchSize) && args.batchSize > 0 ? args.batchSize : 5;
const batches = chunk(filteredRows, batchSize).map((rows, index) => {
  const batchNumber = index + 1;
  const batchId = `BOSS-MANUAL-${String(batchNumber).padStart(2, "0")}`;
  return {
    batchNumber,
    batchId,
    mode: batchMode(rows),
    priorityMix: topCountLabel(rows.map((row) => row.priority)),
    routeMix: topCountLabel(rows.map((row) => row.route)),
    segmentMix: topCountLabel(rows.map((row) => row.segment)),
    roleMix: topCountLabel(rows.map((row) => row.roleFamily)),
    targetCopies: rows.reduce((sum, row) => sum + targetCopies(row), 0),
    goal: batchGoal(rows),
    acceptance: batchAcceptance(rows),
    rows
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

const afterBatchCommand = "npm run summary:jobs && npm run sampling:status && npm run sampling:quality && npm run sampling:batch-quality && npm run gate:conclusion && npm run report:full && npm run audit:research";
const flatRows = batches.flatMap((batch) => batch.rows.map((row, index) => ({
  batchNumber: batch.batchNumber,
  batchId: batch.batchId,
  batchMode: batch.mode,
  taskInBatch: index + 1,
  globalOrder: row.order,
  priority: row.priority,
  route: row.route,
  segment: row.segment,
  company: row.company,
  role: row.role,
  roleFamily: row.roleFamily,
  city: row.city,
  safeHomeUrl,
  searchKeyword: searchKeyword(row),
  referenceUrl: row.manualUrl,
  salaryBand: row.salaryBand,
  sampleProgress: row.sampleProgress,
  sampleGap: row.sampleGap,
  targetCopies: targetCopies(row),
  manualUrl: row.manualUrl,
  importCommand: importCommandForBatchTask(batch, row, index),
  requiredFields: row.requiredFields,
  acceptanceCriteria: row.acceptanceCriteria,
  rejectRule: row.rejectRule,
  afterBatchCommand
})));

mkdirSync(dirname(outputCsvPath), { recursive: true });
writeFileSync(outputCsvPath, `${csv([csvHeaders, ...flatRows.map((row) => csvHeaders.map((header) => row[header]))])}\n`);

const batchSummaryRows = batches.map((batch) => {
  return `| ${batch.batchId} | ${batch.mode} | ${batch.priorityMix || "-"} | ${batch.routeMix || "-"} | ${batch.rows.length} | ${batch.targetCopies} | ${batch.goal} |`;
});

const batchSections = batches.map((batch) => {
  const taskRows = batch.rows.map((row, index) => {
    return `| ${index + 1} | ${row.priority || "-"} | ${row.route || "-"} | ${row.segment || "-"} | ${row.company || "-"} | ${row.role || "-"} | ${row.salaryBand || "-"} | ${row.sampleProgress || "-"} | ${targetCopies(row)} | \`${safeHomeUrl}\` | \`${searchKeyword(row)}\` | \`${importCommandForBatchTask(batch, row, index)}\` |`;
  });
  return `## ${batch.batchId}：${batch.mode}

目标：${batch.goal}

验收：${batch.acceptance}

| 序号 | 优先级 | 路线 | 赛道 | 公司 | 岗位 | 薪资参考 | 样本进度 | 目标导入 | BOSS首页 | 站内搜索关键词 | 导入命令 |
| ---: | --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- |
${taskRows.join("\n")}

本批完成后运行：

\`\`\`bash
${afterBatchCommand}
\`\`\`
`;
});

const totalTargetCopies = batches.reduce((sum, batch) => sum + batch.targetCopies, 0);
const coveredSegments = unique(filteredRows.map((row) => row.segment)).length;
const coveredRoutes = unique(filteredRows.map((row) => row.route)).length;
const p0Tasks = filteredRows.filter((row) => row.priority === "P0").length;

const md = `# BOSS人工采样批次包

更新时间：${formatDate()}

## 一、本质判断

这份批次包不是自动采集脚本，而是把 BOSS 大样本补齐工作拆成可控的人工小批次。当前系统已经有全行业公司池、岗位族矩阵和样本缺口看板，但 BOSS 干净样本不足，所以真正要推进的是“少量入口、低频打开、人工复制、结构化导入、批后复盘”的补样闭环。

当前最大的矛盾是：既要尽快补齐 AI 全行业销售岗位样本，又不能再让脚本替你打开、刷新或跳转 BOSS 页面。

## 二、执行边界

- 先运行 \`npm run auth:boss\`，只使用独立 BOSS 人工窗口。
- 不在 \`Career Auth Browser\` / 9333 窗口里输入 BOSS 地址。
- 每次只做一个批次；批次内每个搜索入口之间至少停留几分钟，按人工阅读节奏操作。
- 只复制销售、售前、解决方案、渠道、销售管理相关岗位。
- 不自动投递、不自动沟通、不绕过验证码或验证。

## 三、批次总览

| 指标 | 数值 |
| --- | ---: |
| 批次数 | ${batches.length} |
| 搜索入口 | ${filteredRows.length} |
| 目标导入岗位数 | ${totalTargetCopies} |
| 覆盖路线 | ${coveredRoutes} |
| 覆盖赛道 | ${coveredSegments} |
| P0任务 | ${p0Tasks} |
| 每批入口数 | ${batchSize} |

| 批次 | 模式 | 优先级 | 路线 | 入口数 | 目标导入 | 目标 |
| --- | --- | --- | --- | ---: | ---: | --- |
${batchSummaryRows.join("\n")}

## 四、操作顺序

1. 执行 \`npm run auth:boss\` 生成本地安全入口页，在正常 Chrome 中手动打开入口页并登录。
2. 从下方批次中选一个公司和岗位词；先进入 BOSS 首页，页面稳定后在站内搜索框输入关键词，人工查看结果。
3. 对每个入口复制 1 到 3 条高相关岗位卡片或详情文本。
4. 回到终端执行对应 \`import:manual\` 命令导入剪贴板内容。
5. 完成一个批次后运行批后命令，更新样本、薪资、能力、结论权限和全量报告。

## 五、批次明细

${batchSections.join("\n")}

## 六、验收标准

一个批次算完成，必须同时满足：

- 每个入口都人工判断过是否有高相关岗位。
- 导入岗位正文能看出 AI/算力/硬件/行业场景相关性。
- 岗位属于销售、售前、解决方案、渠道或销售管理。
- 薪资、城市、公司、岗位、职责和要求尽量完整。
- 批后已运行 \`npm run audit:research\`，确认样本数和结论权限已更新。
`;

writeFileSync(outputMdPath, md);

console.log(`已生成：${outputMdPath}`);
console.log(`已生成：${outputCsvPath}`);
console.log(`批次数：${batches.length}`);
console.log(`搜索入口：${filteredRows.length}`);
console.log(`目标导入岗位数：${totalTargetCopies}`);
