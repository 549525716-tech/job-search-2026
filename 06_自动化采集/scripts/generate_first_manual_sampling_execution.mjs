#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const qualityCsvPath = join(projectRoot, "01_行情收集/BOSS人工采样批次质量门禁.csv");
const outputCsvPath = join(projectRoot, "01_行情收集/BOSS首批人工采样执行单.csv");
const outputMdPath = join(projectRoot, "01_行情收集/BOSS首批人工采样执行单.md");
const inboxTemplatePath = join(projectRoot, "01_行情收集/BOSS首批人工采样收件箱模板.md");
const inboxPath = join(projectRoot, "01_行情收集/BOSS首批人工采样收件箱.md");

const softwareCompanies = ["MiniMax", "月之暗面", "智谱AI", "DeepSeek", "百川智能", "阶跃星辰", "零一万物", "商汤科技"];
const hardwareCompanies = ["海光信息", "寒武纪", "华为昇腾", "壁仞科技", "摩尔线程", "沐曦集成电路", "燧原科技", "超聚变", "华鲲振宇", "浪潮信息", "新华三", "中科曙光"];
const cloudIndustryCompanies = ["华为云", "火山引擎", "百度智能云", "腾讯云", "创新奇智", "格创东智", "地平线", "黑芝麻智能"];

function parseArgs(argv) {
  const args = { limit: 12 };
  for (let index = 2; index < argv.length; index += 1) {
    const key = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${key}`);
      return argv[index];
    };
    if (key === "--limit") args.limit = Number.parseInt(next(), 10);
    else if (key === "--help" || key === "-h") args.help = true;
    else throw new Error(`Unknown option: ${key}`);
  }
  return args;
}

function usage() {
  return `Usage:
  npm run sampling:first-execution
  npm run sampling:first-execution -- --limit 12

Purpose:
  Generate the first human-executable BOSS sampling sheet from batch quality
  gates. This command only writes local files. It never opens, reads, refreshes,
  or controls BOSS pages.
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

function numberOf(value) {
  const num = Number.parseFloat(String(value || "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(num) ? num : 0;
}

function queryFromUrl(url) {
  try {
    return new URL(url).searchParams.get("query") || "";
  } catch {
    return "";
  }
}

function normalizedExecutionFields(row) {
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

function includesCompany(list, company) {
  return list.some((item) => item === company);
}

function bucketFor(row) {
  if (includesCompany(softwareCompanies, row.company) || /基座大模型|Agent/.test(row.segment || "")) return "AI软件落地首批";
  if (includesCompany(hardwareCompanies, row.company) || /硬件|芯片|GPU|半导体|服务器|智算|数据中心/.test(`${row.route}${row.segment}`)) return "硬件/算力/半导体首批";
  if (includesCompany(cloudIndustryCompanies, row.company) || /云计算|工业AI|智能制造|机器人|汽车/.test(row.segment || "")) return "云/MaaS/行业方案验证";
  return "补充观察";
}

function companyRank(company, bucket) {
  const order = bucket === "AI软件落地首批"
    ? softwareCompanies
    : bucket === "硬件/算力/半导体首批"
      ? hardwareCompanies
      : cloudIndustryCompanies;
  const index = order.indexOf(company);
  return index === -1 ? 999 : index;
}

function taskScore(row) {
  let score = 0;
  if (String(row.batchId || "").startsWith("BOSS-FOCUS")) score += 30;
  if (row.priority === "P0") score += 24;
  else if (row.priority === "P1") score += 12;
  if (numberOf(row.matchedCount) === 0) score += 12;
  if (numberOf(row.qualityUsableCount) === 0) score += 12;
  if (numberOf(row.readableSalaryCount) === 0) score += 6;
  if (/未开始|旧样本|不足/.test(row.gate || "")) score += 8;
  if (/--batch-id/.test(row.importCommand || "")) score += 6;
  score += Math.min(5, numberOf(row.targetCopies));
  return score;
}

function pickBestRows(rows) {
  const bestByCompany = new Map();
  for (const row of rows) {
    const key = row.company;
    if (!key) continue;
    const current = bestByCompany.get(key);
    if (!current || taskScore(row) > taskScore(current)) {
      bestByCompany.set(key, row);
    }
  }
  return [...bestByCompany.values()];
}

function selectFromBucket(rows, bucket, limit) {
  return rows
    .filter((row) => bucketFor(row) === bucket)
    .sort((a, b) => companyRank(a.company, bucket) - companyRank(b.company, bucket) || taskScore(b) - taskScore(a))
    .slice(0, limit);
}

function uniqueByTask(rows) {
  const seen = new Set();
  const result = [];
  for (const row of rows) {
    const key = `${row.company}::${row.role}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(row);
  }
  return result;
}

function whyFirst(row) {
  const reasons = [];
  if (softwareCompanies.includes(row.company)) reasons.push("用户点名/强关注AI软件公司");
  if (hardwareCompanies.includes(row.company)) reasons.push("芯片/半导体/算力硬件重点公司");
  if (cloudIndustryCompanies.includes(row.company)) reasons.push("云/MaaS/行业落地验证入口");
  if (numberOf(row.qualityUsableCount) === 0) reasons.push("缺可用BOSS样本");
  if (numberOf(row.readableSalaryCount) === 0) reasons.push("缺可读薪资");
  if (String(row.batchId || "").startsWith("BOSS-FOCUS")) reasons.push("已进入重点补样批次");
  return reasons.slice(0, 4).join("；") || "补齐全行业样本缺口";
}

function mdRows(rows, fallback) {
  return rows.length ? rows.join("\n") : fallback;
}

function inboxTaskMetadata(row) {
  return {
    rank: row.rank,
    company: row.company,
    role: row.role,
    safeHomeUrl: row.safeHomeUrl,
    searchKeyword: row.searchKeyword,
    targetCopies: row.targetCopies,
    args: {
      source: "BOSS直聘",
      query: `${row.company} ${row.role}`,
      company: row.company,
      role: row.role,
      city: row.city,
      batchId: row.batchId,
      batchTask: row.taskInBatch,
      batchTargetCopies: row.targetCopies,
      priority: row.priority,
      route: row.route,
      segment: row.segment,
      roleFamily: row.roleFamily,
      salaryBand: row.salaryBand
    }
  };
}

function cleanInboxPlaceholder(text) {
  return String(text || "")
    .split(/\r?\n/)
    .filter((line) => !/^在这里粘贴 .+ 的岗位详情。导入后可清空本段文本，保留标记。$/.test(line.trim()))
    .join("\n")
    .trim();
}

function inboxHasUserText(filePath) {
  if (!existsSync(filePath)) return false;
  const text = readFileSync(filePath, "utf8");
  const pattern = /<!-- BOSS_INBOX_TEXT_START -->\s*([\s\S]*?)\s*<!-- BOSS_INBOX_TEXT_END -->/g;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    if (cleanInboxPlaceholder(match[1])) return true;
  }
  return false;
}

function buildInboxTemplate(rows) {
  return `# BOSS首批人工采样收件箱

更新时间：${formatDate()}

## 使用边界

- 这个文件只接收你人工复制回来的岗位文本。
- 不要在这里粘贴简历、账号、聊天记录或隐私信息。
- 每个公司段落可以一次粘贴 1 到 3 条岗位详情；多条岗位之间用空行或 \`---\` 分隔。
- 粘贴后运行 \`npm run import:inbox -- --refresh\`，系统会按段落里的批次元数据导入，并刷新本地报告。

${rows.map((row) => {
  const metadata = JSON.stringify(inboxTaskMetadata(row));
  return `## ${row.rank}. ${row.company} / ${row.role}

目标导入：${row.targetCopies} 条

薪资参考：${row.salaryBand || "待BOSS样本校验"}

BOSS首页：${row.safeHomeUrl}

站内搜索关键词：${row.searchKeyword}

<!-- BOSS_INBOX_TASK_START -->
${metadata}
<!-- BOSS_INBOX_TASK_END -->

<!-- BOSS_INBOX_TEXT_START -->
在这里粘贴 ${row.company} / ${row.role} 的岗位详情。导入后可清空本段文本，保留标记。
<!-- BOSS_INBOX_TEXT_END -->
`;
}).join("\n")}
`;
}

const args = parseArgs(process.argv);
if (args.help) {
  console.log(usage());
  process.exit(0);
}

if (!existsSync(qualityCsvPath)) {
  throw new Error(`未找到质量门禁：${qualityCsvPath}。请先运行 npm run sampling:batch-quality。`);
}

const sourceRows = readCsv(qualityCsvPath)
  .filter((row) => row.level === "入口")
  .filter((row) => row.gate !== "达标")
  .filter((row) => row.importCommand && (row.searchKeyword || row.manualUrl || row.referenceUrl))
  .map(normalizedExecutionFields);

const bestRows = pickBestRows(sourceRows);
const softwareQuota = Math.max(3, Math.round(args.limit * 0.34));
const hardwareQuota = Math.max(4, Math.round(args.limit * 0.42));
const cloudQuota = Math.max(2, args.limit - softwareQuota - hardwareQuota);

const selected = uniqueByTask([
  ...selectFromBucket(bestRows, "AI软件落地首批", softwareQuota),
  ...selectFromBucket(bestRows, "硬件/算力/半导体首批", hardwareQuota),
  ...selectFromBucket(bestRows, "云/MaaS/行业方案验证", cloudQuota)
]);

const filledSelected = selected.length >= args.limit
  ? selected.slice(0, args.limit)
  : uniqueByTask([
    ...selected,
    ...bestRows
      .filter((row) => !selected.some((item) => item.company === row.company && item.role === row.role))
      .sort((a, b) => taskScore(b) - taskScore(a))
  ]).slice(0, args.limit);

const executionRows = filledSelected.map((row, index) => {
  const bucket = bucketFor(row);
  return {
    rank: index + 1,
    executionRound: index < 4 ? "第1轮：大模型软件" : index < 9 ? "第2轮：硬件算力" : "第3轮：云与行业方案",
    bucket,
    company: row.company,
    route: row.route,
    segment: row.segment,
    role: row.role,
    roleFamily: row.roleFamily,
    city: row.city,
    salaryBand: row.salaryBand,
    priority: row.priority,
    batchId: row.batchId,
    taskInBatch: row.taskInBatch,
    targetCopies: row.targetCopies,
    matchedCount: row.matchedCount,
    qualityUsableCount: row.qualityUsableCount,
    readableSalaryCount: row.readableSalaryCount,
    gate: row.gate,
    whyFirst: whyFirst(row),
    safeHomeUrl: row.safeHomeUrl,
    searchKeyword: row.searchKeyword,
    referenceUrl: row.referenceUrl,
    manualUrl: row.manualUrl,
    importCommand: row.importCommand,
    copyRequirement: "优先复制详情页全文；至少包含公司、岗位、薪资、城市、经验、职责、要求、AI/算力/行业关键词",
    acceptanceCheck: "销售/售前/解决方案/渠道/销售管理相关；可见薪资或职责要求；正文能证明AI/算力/硬件/行业场景相关性",
    afterImportCommand: "npm run refresh:market"
  };
});

mkdirSync(dirname(outputCsvPath), { recursive: true });

const headers = [
  "rank",
  "executionRound",
  "bucket",
  "company",
  "route",
  "segment",
  "role",
  "roleFamily",
  "city",
  "salaryBand",
  "priority",
  "batchId",
  "taskInBatch",
  "targetCopies",
  "matchedCount",
  "qualityUsableCount",
  "readableSalaryCount",
  "gate",
  "whyFirst",
  "safeHomeUrl",
  "searchKeyword",
  "referenceUrl",
  "manualUrl",
  "importCommand",
  "copyRequirement",
  "acceptanceCheck",
  "afterImportCommand"
];

writeFileSync(outputCsvPath, `${csv([headers])}\n${csv(executionRows.map((row) => headers.map((header) => row[header])))}\n`);

const bucketSummary = [...new Set(executionRows.map((row) => row.bucket))].map((bucket) => {
  const rows = executionRows.filter((row) => row.bucket === bucket);
  const target = rows.reduce((sum, row) => sum + numberOf(row.targetCopies), 0);
  return `| ${bucket} | ${rows.length} | ${target} | ${rows.map((row) => row.company).join("、")} |`;
});

const taskRows = executionRows.map((row) => {
  return `| ${row.rank} | ${row.executionRound} | ${row.bucket} | ${row.company} | ${row.role} | ${row.salaryBand || "待BOSS样本校验"} | ${row.targetCopies} | ${row.gate} | ${row.whyFirst} | \`${row.safeHomeUrl}\` | \`${row.searchKeyword}\` |`;
});

const commandBlocks = executionRows.map((row) => {
  return `### ${row.rank}. ${row.company} / ${row.role}

复制岗位详情后运行：

\`\`\`bash
${row.importCommand}
\`\`\`
`;
});

const totalTargetCopies = executionRows.reduce((sum, row) => sum + numberOf(row.targetCopies), 0);
const md = `# BOSS首批人工采样执行单

更新时间：${formatDate()}

## 一、本质判断

这份执行单不是新的搜索计划，而是把已有批次压缩成“最先动手的 12 个入口”。它解决的是：AI 软件落地公司、芯片/半导体/算力公司已经进入公司池和查询计划，但 BOSS 可用样本太少，薪资和能力要求不能写成大样本结论。

当前最大的矛盾是：既要尽快拿到能支撑报告的 BOSS 岗位详情，又不能通过自动打开、自动刷新或高频操作触发风控。

## 二、执行边界

- 本文件只提供 BOSS 首页、站内搜索关键词和导入命令，不自动打开 BOSS。
- 先运行 \`npm run auth:boss\` 生成本地安全入口页，再在正常 Chrome 里手动打开入口页并访问 BOSS。
- 运行 \`npm run sampling:lowfreq\` 生成单入口作业卡；实际操作时优先看作业卡，不要在一张大表里连续处理多个入口。
- 每次只做一个入口，按人工阅读节奏复制岗位详情，不连续快速跳转。
- 不投递、不打招呼、不绕过验证，只复制公开岗位信息后导入。
- 不要点击或粘贴完整 BOSS 搜索 URL；完整 URL 只保留在 CSV 的 \`referenceUrl\` 字段用于审计。

## 三、首批目标

| 指标 | 数值 |
| --- | ---: |
| 首批入口 | ${executionRows.length} |
| 目标导入岗位 | ${totalTargetCopies} |
| AI软件落地入口 | ${executionRows.filter((row) => row.bucket === "AI软件落地首批").length} |
| 硬件/算力/半导体入口 | ${executionRows.filter((row) => row.bucket === "硬件/算力/半导体首批").length} |
| 云/MaaS/行业方案入口 | ${executionRows.filter((row) => row.bucket === "云/MaaS/行业方案验证").length} |

| 方向 | 入口数 | 目标导入 | 公司 |
| --- | ---: | ---: | --- |
${mdRows(bucketSummary, "| 暂无 | 0 | 0 | - |")}

## 四、执行顺序

| 排名 | 轮次 | 方向 | 公司 | 岗位词 | 薪资参考 | 目标导入 | 当前门禁 | 为什么先做 | BOSS首页 | 站内搜索关键词 |
| ---: | --- | --- | --- | --- | --- | ---: | --- | --- | --- | --- |
${mdRows(taskRows, "| 暂无 |  |  |  |  | 0 |  |  |  |  |  |")}

## 五、导入命令

${commandBlocks.join("\n")}

## 六、单入口验收规则

每个入口优先复制 2 到 3 条岗位详情。合格样本必须满足：

1. 岗位属于销售、售前、解决方案、渠道、商务或销售管理。
2. 正文能看出 AI、大模型、算力、硬件、半导体、云、工业或行业解决方案相关性。
3. 优先保留薪资、城市、经验、学历、职责、要求、客户类型、管理属性。
4. 排除纯研发、纯运营、客服、行政和与 AI/算力/硬件/行业场景无关的岗位。

每完成 1 到 2 个入口后运行：

\`\`\`bash
npm run refresh:market

# 如需重新生成单入口低频作业卡
npm run sampling:lowfreq
\`\`\`

## 七、CSV输出

\`\`\`text
${outputCsvPath}
\`\`\`
`;

writeFileSync(outputMdPath, md);

const inboxTemplate = buildInboxTemplate(executionRows);
writeFileSync(inboxTemplatePath, inboxTemplate);
if (!existsSync(inboxPath) || !inboxHasUserText(inboxPath)) {
  writeFileSync(inboxPath, inboxTemplate);
}

console.log(`已生成：${outputMdPath}`);
console.log(`已生成：${outputCsvPath}`);
console.log(`已生成：${inboxTemplatePath}`);
console.log(`${existsSync(inboxPath) ? "已保留/创建" : "未创建"}：${inboxPath}`);
console.log(`首批入口：${executionRows.length}`);
console.log(`目标导入岗位：${totalTargetCopies}`);
