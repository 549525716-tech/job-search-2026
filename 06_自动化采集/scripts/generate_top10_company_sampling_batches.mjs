#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const top10CsvPath = join(projectRoot, "00_行业资料集/AI细分赛道头部公司Top10证据表.csv");
const outputCsvPath = join(projectRoot, "01_行情收集/BOSS细分赛道Top10公司采样批次包.csv");
const outputMdPath = join(projectRoot, "01_行情收集/BOSS细分赛道Top10公司采样批次包.md");

const safeHomeUrl = "https://www.zhipin.com/";
const userNamedCompanyPatterns = [
  /月之暗面|月子暗面/i,
  /智谱|智普/i,
  /MiniMax/i,
  /DeepSeek/i,
  /商汤/i,
  /寒武纪/i,
  /海光/i,
  /华为昇腾|昇腾/i,
  /壁仞/i,
  /摩尔线程/i,
  /浪潮/i,
  /新华三|H3C/i,
  /中科曙光/i,
  /超聚变/i,
  /世纪互联/i,
  /百应/i,
  /创新奇智/i,
  /第四范式/i,
  /地平线/i,
  /奇安信/i,
  /深信服/i
];

function parseArgs(argv) {
  const args = {
    limit: 48,
    batchSize: 4,
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
  npm run sampling:top10-batches
  npm run sampling:top10-batches -- --limit 48 --batch-size 4 --city 广州
  npm run sampling:top10-batches -- --limit 118

Purpose:
  Turn the AI segment Top10 company evidence table into low-frequency human
  BOSS sampling batches. This script only writes local files. It never opens,
  reads, refreshes, or controls BOSS pages.
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

function shellQuote(value) {
  return `"${String(value ?? "").replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function metadataFlag(name, value) {
  if (value === undefined || value === null || value === "") return "";
  return `${name} ${shellQuote(value)}`;
}

function topCountLabel(items) {
  const counts = new Map();
  for (const item of items.filter(Boolean)) counts.set(item, (counts.get(item) || 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-Hans-CN"))
    .map(([name, count]) => `${name}(${count})`)
    .join("、");
}

function queryFromUrl(url) {
  try {
    return new URL(url).searchParams.get("query") || "";
  } catch {
    return "";
  }
}

function searchKeyword(row) {
  return queryFromUrl(row.manualUrl) || `${row.company || ""} ${row.nextRole || row.recommendedRoles || ""}`.trim();
}

function companyIsUserNamed(row) {
  const text = `${row.company}\n${row.segment}\n${row.keywords}\n${row.whyTop10}`;
  return userNamedCompanyPatterns.some((pattern) => pattern.test(text));
}

function inferPriority(row) {
  if (row.priority) return row.priority;
  if (companyIsUserNamed(row)) return "P0";
  if (numberOf(row.segmentRank) <= 3 && numberOf(row.top10Slot) <= 3) return "P0";
  if (numberOf(row.top10Slot) <= 5) return "P1";
  return "P2";
}

function inferRoleFamily(role, row = {}) {
  const roleText = String(role || "");
  if (/解决方案|售前|顾问|POC|Demo|方案/.test(roleText)) return "售前/解决方案顾问";
  if (/渠道|生态|伙伴|代理/.test(roleText)) return "渠道/生态/伙伴销售";
  if (/总监|负责人|管理/.test(roleText)) return "销售管理/区域负责人";
  if (/SaaS|软件|AI|大模型|智能体|云|MaaS|Agent/i.test(roleText)) return "AI软件/大模型销售";
  if (/大客户|KA|行业|客户|销售|商务|BD/.test(roleText)) return "大客户/行业销售经理";
  const text = `${row.recommendedRoles || ""}\n${row.salesMotion || ""}`;
  if (/解决方案|售前|顾问|POC|Demo|方案/.test(text)) return "售前/解决方案顾问";
  if (/渠道|生态|伙伴|代理/.test(text)) return "渠道/生态/伙伴销售";
  if (/总监|负责人|管理|经理/.test(text)) return "销售管理/区域负责人";
  if (/SaaS|软件|AI|大模型|智能体|云|MaaS|Agent/i.test(text)) return "AI软件/大模型销售";
  return "大客户/行业销售经理";
}

function targetCopies(row) {
  const gap = Math.max(0, numberOf(row.sampleGap));
  if (!gap) return 0;
  const rank = numberOf(row.top10Slot);
  const current = numberOf(row.currentSamples);
  let target = 1;
  if (companyIsUserNamed(row) || inferPriority(row) === "P0" || rank <= 3) target = 3;
  else if (rank <= 6 || numberOf(row.opportunityScore) >= 60) target = 2;
  if (current > 0) target = Math.min(target, 2);
  return Math.max(1, Math.min(gap, target));
}

function selectionScore(row) {
  const rank = numberOf(row.top10Slot) || 10;
  const priority = inferPriority(row);
  const zeroSampleBoost = numberOf(row.currentSamples) === 0 ? 12 : 0;
  const userBoost = companyIsUserNamed(row) ? 24 : 0;
  const priorityBoost = priority === "P0" ? 16 : priority === "P1" ? 8 : 0;
  const rankBoost = Math.max(0, 11 - rank) * 2;
  const firstExecutionBoost = row.firstExecutionBatch ? 2 : 0;
  return numberOf(row.opportunityScore) + userBoost + priorityBoost + rankBoost + zeroSampleBoost + firstExecutionBoost + Math.min(12, numberOf(row.sampleGap) * 2);
}

function groupBySegment(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = row.segment || "未分类";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  for (const group of groups.values()) {
    group.sort((a, b) => selectionScore(b) - selectionScore(a) ||
      numberOf(a.top10Slot) - numberOf(b.top10Slot) ||
      a.company.localeCompare(b.company, "zh-Hans-CN"));
  }
  return groups;
}

function balancedPick(rows, limit) {
  const groups = groupBySegment(rows);
  const picked = [];
  const pickedKeys = new Set();
  const pickedPerSegment = new Map();
  const target = Number.isFinite(limit) && limit > 0 ? limit : 48;

  while (picked.length < target && [...groups.values()].some((group) => group.length)) {
    const segmentOrder = [...groups.entries()]
      .filter(([, group]) => group.length)
      .sort((a, b) => {
        const aPicked = pickedPerSegment.get(a[0]) || 0;
        const bPicked = pickedPerSegment.get(b[0]) || 0;
        return aPicked - bPicked ||
          numberOf(a[1][0]?.segmentRank) - numberOf(b[1][0]?.segmentRank) ||
          selectionScore(b[1][0]) - selectionScore(a[1][0]) ||
          a[0].localeCompare(b[0], "zh-Hans-CN");
      });

    let progressed = false;
    for (const [segment, group] of segmentOrder) {
      while (group.length) {
        const next = group.shift();
        const key = `${next.segment}::${next.company}::${next.nextRole}`;
        if (pickedKeys.has(key)) continue;
        pickedKeys.add(key);
        picked.push(next);
        pickedPerSegment.set(segment, (pickedPerSegment.get(segment) || 0) + 1);
        progressed = true;
        break;
      }
      if (picked.length >= target) break;
    }
    if (!progressed) break;
  }
  return picked;
}

function chunk(items, size) {
  const result = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function batchMode(rows) {
  const text = rows.map((row) => `${row.route}${row.segment}${row.companyType}`).join("\n");
  const hasHardware = /芯片|GPU|半导体|服务器|智算|算力|数据中心/.test(text);
  const hasSoftware = /大模型|Agent|软件|云|MaaS|SaaS|智能客服/.test(text);
  const hasIndustry = /工业|制造|汽车|机器人|安防|安全/.test(text);
  if (hasHardware && hasSoftware) return "Top10软硬件对照补样";
  if (hasHardware) return "Top10硬件/算力/半导体补样";
  if (hasSoftware) return "Top10 AI软件落地补样";
  if (hasIndustry) return "Top10行业解决方案补样";
  return "Top10综合补样";
}

function batchGoal(rows) {
  return `验证 ${topCountLabel(rows.map((row) => row.segment)) || "AI细分赛道"} 的头部公司销售岗位、薪资和能力要求`;
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
    shellQuote(row.nextRole || "销售"),
    "--city",
    shellQuote(city)
  ].join(" ");
}

function importCommandForBatchTask(batch, row, taskIndex, city) {
  const roleFamily = inferRoleFamily(row.nextRole, row);
  const flags = [
    metadataFlag("--batch-id", batch.batchId),
    metadataFlag("--batch-task", taskIndex + 1),
    metadataFlag("--batch-target-copies", targetCopies(row)),
    metadataFlag("--priority", inferPriority(row)),
    metadataFlag("--route", row.route),
    metadataFlag("--segment", row.segment),
    metadataFlag("--role-family", roleFamily),
    metadataFlag("--salary-band", row.salaryObservation)
  ].filter(Boolean);
  return `${baseImportCommand(row, city)} ${flags.join(" ")}`;
}

function manualAction(row) {
  return `运行 npm run auth:boss；先进入 BOSS 首页；页面稳定后在站内搜索框输入「${searchKeyword(row)}」`;
}

const args = parseArgs(process.argv);
if (args.help) {
  console.log(usage());
  process.exit(0);
}

if (!existsSync(top10CsvPath)) {
  throw new Error(`未找到Top10证据表：${top10CsvPath}。请先运行 npm run company:top10。`);
}

const top10Rows = readCsv(top10CsvPath);
const candidateRows = top10Rows
  .filter((row) => row.company && (row.nextRole || row.recommendedRoles))
  .filter((row) => numberOf(row.sampleGap) > 0)
  .filter((row) => row.manualUrl || searchKeyword(row))
  .map((row) => ({
    ...row,
    nextRole: row.nextRole || String(row.recommendedRoles || "").split(/[;；]/)[0] || "销售",
    searchKeyword: searchKeyword(row),
    targetCopies: targetCopies(row),
    selectionScore: selectionScore(row)
  }))
  .filter((row) => row.targetCopies > 0);

const selectedRows = balancedPick(candidateRows, args.limit);
const batchSize = Number.isFinite(args.batchSize) && args.batchSize > 0 ? args.batchSize : 4;
const batches = chunk(selectedRows, batchSize).map((rows, index) => {
  const batchNumber = index + 1;
  const batchId = `BOSS-TOP10-${String(batchNumber).padStart(2, "0")}`;
  return {
    batchNumber,
    batchId,
    mode: batchMode(rows),
    rows,
    targetCopies: rows.reduce((sum, row) => sum + targetCopies(row), 0),
    goal: batchGoal(rows)
  };
});

const requiredFields = "公司;岗位;薪资;城市;经验;学历;职责;要求;客户类型;销售对象;AI/算力/硬件/行业关键词;是否售前/解决方案;是否销售管理";
const acceptanceCriteria = "只导入销售、售前、解决方案、渠道、销售管理相关岗位；优先详情页正文；必须能看出AI/大模型/算力/硬件/行业解决方案相关性；每个入口按目标导入1到3条";
const rejectRule = "排除纯研发、算法、运营、客服、行政、人事、无AI/算力/硬件/行业场景相关性的岗位；BOSS跳回blank或出现验证时立即停止";
const afterBatchCommand = "npm run summary:jobs && npm run sampling:quality && npm run company:top10 && npm run sampling:top10-batches && npm run audit:evidence && npm run report:full && npm run audit:research";

const csvHeaders = [
  "batchNumber",
  "batchId",
  "batchMode",
  "taskInBatch",
  "globalOrder",
  "priority",
  "route",
  "segment",
  "segmentRank",
  "company",
  "top10Slot",
  "role",
  "roleFamily",
  "city",
  "safeHomeUrl",
  "searchKeyword",
  "referenceUrl",
  "salaryBand",
  "targetSamples",
  "currentSamples",
  "sampleGap",
  "targetCopies",
  "opportunityScore",
  "selectionScore",
  "evidenceStatus",
  "firstExecutionBatch",
  "manualAction",
  "importCommand",
  "requiredFields",
  "acceptanceCriteria",
  "rejectRule",
  "afterBatchCommand"
];

const flatRows = batches.flatMap((batch) => batch.rows.map((row, index) => {
  const globalOrder = index + 1 + (batch.batchNumber - 1) * batchSize;
  return {
    batchNumber: batch.batchNumber,
    batchId: batch.batchId,
    batchMode: batch.mode,
    taskInBatch: index + 1,
    globalOrder,
    priority: inferPriority(row),
    route: row.route,
    segment: row.segment,
    segmentRank: row.segmentRank,
    company: row.company,
    top10Slot: row.top10Slot,
    role: row.nextRole,
    roleFamily: inferRoleFamily(row.nextRole, row),
    city: args.city,
    safeHomeUrl,
    searchKeyword: searchKeyword(row),
    referenceUrl: row.manualUrl,
    salaryBand: row.salaryObservation,
    targetSamples: row.targetSamples,
    currentSamples: row.currentSamples,
    sampleGap: row.sampleGap,
    targetCopies: targetCopies(row),
    opportunityScore: row.opportunityScore,
    selectionScore: row.selectionScore,
    evidenceStatus: row.bossEvidenceStatus,
    firstExecutionBatch: row.firstExecutionBatch,
    manualAction: manualAction(row),
    importCommand: importCommandForBatchTask(batch, row, index, args.city),
    requiredFields,
    acceptanceCriteria,
    rejectRule,
    afterBatchCommand
  };
}));

mkdirSync(dirname(outputCsvPath), { recursive: true });
writeFileSync(outputCsvPath, `${csv([csvHeaders, ...flatRows.map((row) => csvHeaders.map((header) => row[header]))])}\n`);

const batchSummaryRows = batches.map((batch) => {
  return `| ${batch.batchId} | ${batch.mode} | ${topCountLabel(batch.rows.map((row) => inferPriority(row))) || "-"} | ${topCountLabel(batch.rows.map((row) => row.segment)) || "-"} | ${batch.rows.length} | ${batch.targetCopies} | ${batch.goal} |`;
});

const batchSections = batches.map((batch) => {
  const taskRows = batch.rows.map((row, index) => {
    return `| ${index + 1} | ${inferPriority(row)} | ${row.segment} | ${row.company} | ${row.nextRole} | ${row.salaryObservation || "待BOSS样本校验"} | ${row.currentSamples}/${row.targetSamples} | ${targetCopies(row)} | \`${safeHomeUrl}\` | \`${searchKeyword(row)}\` | \`${importCommandForBatchTask(batch, row, index, args.city)}\` |`;
  });
  return `## ${batch.batchId}：${batch.mode}

目标：${batch.goal}

执行方式：先运行 \`npm run auth:boss\`，只进入 BOSS 首页；页面稳定后，逐条把“站内搜索关键词”输入 BOSS 搜索框。不要直接粘贴完整搜索 URL。

| 序号 | 优先级 | 赛道 | 公司 | 岗位词 | 薪资参考 | 当前/目标 | 目标导入 | BOSS首页 | 站内搜索关键词 | 导入命令 |
| ---: | --- | --- | --- | --- | --- | ---: | ---: | --- | --- | --- |
${taskRows.join("\n")}

本批完成后运行：

\`\`\`bash
${afterBatchCommand}
\`\`\`
`;
});

const totalTargetCopies = batches.reduce((sum, batch) => sum + batch.targetCopies, 0);
const coveredSegments = new Set(selectedRows.map((row) => row.segment).filter(Boolean)).size;
const allSegments = new Set(candidateRows.map((row) => row.segment).filter(Boolean)).size;
const userNamedCount = selectedRows.filter(companyIsUserNamed).length;
const zeroSampleCount = selectedRows.filter((row) => numberOf(row.currentSamples) === 0).length;
const hardwareCount = selectedRows.filter((row) => /芯片|GPU|半导体|服务器|智算|算力|数据中心/.test(`${row.segment}${row.route}`)).length;
const softwareCount = selectedRows.filter((row) => /大模型|Agent|软件|云|MaaS|SaaS|智能客服/.test(`${row.segment}${row.route}`)).length;
const remainingGap = candidateRows.reduce((sum, row) => sum + numberOf(row.sampleGap), 0) - selectedRows.reduce((sum, row) => sum + numberOf(row.sampleGap), 0);

const md = `# BOSS细分赛道Top10公司采样批次包

更新时间：${formatDate()}

## 一、本质判断

这份批次包不是再扩公司名单，而是把“AI上中下游Top10公司证据表”转成可执行的低频人工采样队列。它解决的是：我们已经知道每个赛道该看哪些头部公司，但还缺 BOSS 岗位文本去验证这些公司是否在招销售、售前、渠道或销售管理岗位，以及薪资和能力要求。

当前最大的矛盾是：既要覆盖月之暗面、智谱AI、MiniMax、大模型平台、芯片、半导体、AI服务器、智算中心、工业AI等全行业方向，又不能用自动打开、自动刷新、自动读取的方式触发 BOSS 风控。

## 二、执行边界

- 本文件只提供人工搜索关键词和导入命令，不自动打开 BOSS。
- 正确入口是 \`npm run auth:boss\` 打开的普通 Chrome 本地安全页。
- 每条任务先进入 BOSS 首页，再在站内搜索框输入关键词；完整 URL 只保留在 CSV 的 referenceUrl 字段作审计，不作为操作入口。
- 每次只执行一个批次；如果页面跳回 \`about:blank\`、出现验证或登录异常，立即停止，不连续重试。

## 三、批次总览

| 指标 | 数值 |
| --- | ---: |
| 候选Top10公司入口 | ${candidateRows.length} |
| 本次输出入口 | ${selectedRows.length} |
| 覆盖赛道 | ${coveredSegments}/${allSegments} |
| 批次数 | ${batches.length} |
| 每批入口数 | ${batchSize} |
| 目标导入岗位数 | ${totalTargetCopies} |
| 0样本公司入口 | ${zeroSampleCount} |
| 用户点名/强关注入口 | ${userNamedCount} |
| 硬件/半导体/智算入口 | ${hardwareCount} |
| AI软件/云/MaaS入口 | ${softwareCount} |
| 未进入本批的Top10样本缺口 | ${Math.max(0, remainingGap)} |

| 批次 | 模式 | 优先级 | 覆盖赛道 | 入口数 | 目标导入 | 目标 |
| --- | --- | --- | --- | ---: | ---: | --- |
${batchSummaryRows.join("\n")}

## 四、批次明细

${batchSections.join("\n")}

## 五、验收标准

1. 每个入口优先导入 1 到 3 条高相关岗位文本，岗位必须属于销售、售前、解决方案、渠道或销售管理。
2. 复制内容必须包含岗位名称、公司、薪资、城市、职责、要求，以及能证明 AI/大模型/算力/硬件/行业场景相关性的关键词。
3. 同一公司同一岗位词如果没有销售相关结果，不要硬凑；记录为“无高相关岗位”，后续换岗位词或城市。
4. 本批导入后运行批后命令，让样本质量、Top10证据表、资料集审计和全量报告同步更新。

## 六、CSV输出

\`\`\`text
${outputCsvPath}
\`\`\`
`;

writeFileSync(outputMdPath, md);

console.log(`已生成：${outputMdPath}`);
console.log(`已生成：${outputCsvPath}`);
console.log(`候选入口：${candidateRows.length}`);
console.log(`输出入口：${selectedRows.length}`);
console.log(`批次数：${batches.length}`);
console.log(`目标导入岗位数：${totalTargetCopies}`);
