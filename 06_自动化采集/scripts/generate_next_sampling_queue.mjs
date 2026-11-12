#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const taskStatusPath = join(projectRoot, "01_行情收集/BOSS采样任务状态.csv");
const companyMapPath = join(projectRoot, "00_行业资料集/AI产业链头部公司岗位机会地图.csv");
const publicSignalPath = join(projectRoot, "01_行情收集/AI行业公开趋势信号看板.csv");
const roleMatrixPath = join(projectRoot, "01_行情收集/AI销售岗位薪资能力矩阵.csv");
const outputCsvPath = join(projectRoot, "01_行情收集/BOSS下一轮优先采样清单.csv");
const outputMdPath = join(projectRoot, "01_行情收集/BOSS下一轮优先采样清单.md");
const safeBossHomeUrl = "https://www.zhipin.com/";

function parseArgs(argv) {
  const args = { limit: 30, city: "广州" };
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const next = () => {
      i += 1;
      if (i >= argv.length) throw new Error(`Missing value for ${key}`);
      return argv[i];
    };
    if (key === "--limit") args.limit = Number.parseInt(next(), 10);
    else if (key === "--city") args.city = next();
    else if (key === "--help" || key === "-h") args.help = true;
    else throw new Error(`Unknown option: ${key}`);
  }
  return args;
}

function usage() {
  return `Usage:
  npm run sampling:next
  npm run sampling:next -- --limit 40 --city 广州

Purpose:
  Generate a manual-first BOSS sampling queue. This script does not open BOSS
  pages and does not collect data automatically.
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

function readCsvIfExists(filePath) {
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

function priorityBase(priority) {
  if (priority === "P0") return 100;
  if (priority === "P1") return 65;
  if (priority === "P2") return 35;
  return 10;
}

function roleFamily(role) {
  const text = String(role || "");
  if (/售前|解决方案|顾问|方案/.test(text)) return "售前/解决方案顾问";
  if (/渠道|生态|伙伴|代理/.test(text)) return "渠道/生态/伙伴销售";
  if (/总监|负责人|管理|销售经理|区域/.test(text)) return "销售管理/区域负责人";
  if (/芯片|硬件|服务器|智算|IDC|数据中心/.test(text)) return "硬件/智算/半导体行业销售";
  if (/大客户|KA|客户经理|行业/.test(text)) return "大客户/行业销售经理";
  if (/SaaS|软件|智能体|应用/.test(text)) return "SaaS/应用销售";
  if (/AI|大模型|人工智能|MaaS|Maas/.test(text)) return "AI软件/大模型销售";
  return "销售/商务";
}

function segmentSignalMap(publicSignals) {
  const result = new Map();
  for (const row of publicSignals) {
    for (const segment of String(row.segments || "").split(";").map((item) => item.trim()).filter(Boolean)) {
      const current = result.get(segment) || { evidenceCount: 0, p0Count: 0, scoreSum: 0 };
      current.evidenceCount += 1;
      current.p0Count += String(row.priority || "").startsWith("P0") ? 1 : 0;
      current.scoreSum += Number(row.score || 0);
      result.set(segment, current);
    }
  }
  return result;
}

function companyMapByName(rows) {
  const result = new Map();
  for (const row of rows) {
    result.set(`${row.segment}|||${row.company}`, row);
    if (!result.has(row.company)) result.set(row.company, row);
  }
  return result;
}

function matrixMap(rows) {
  const result = new Map();
  for (const row of rows) {
    result.set(`${row.segment}|||${row.role}`, row);
  }
  return result;
}

function pickBySegment(scoredRows, limit) {
  const groups = new Map();
  for (const row of scoredRows) {
    const bucket = groups.get(row.segment) || [];
    bucket.push(row);
    groups.set(row.segment, bucket);
  }

  const sortedSegments = [...groups.entries()]
    .map(([segment, rows]) => ({ segment, rows, best: rows[0]?.score || 0 }))
    .sort((a, b) => b.best - a.best)
    .map((item) => item.segment);

  if (!sortedSegments.length) return [];

  const selected = [];
  const seen = new Set();
  let pointer = 0;
  while (selected.length < limit && seen.size < scoredRows.length) {
    const segment = sortedSegments[pointer % sortedSegments.length];
    const rows = groups.get(segment) || [];
    const next = rows.find((row) => !seen.has(row.key));
    if (next) {
      selected.push(next);
      seen.add(next.key);
    } else {
      for (const fallback of scoredRows) {
        if (!seen.has(fallback.key)) {
          selected.push(fallback);
          seen.add(fallback.key);
          break;
        }
      }
    }
    pointer += 1;
  }
  return selected.slice(0, limit).map((row, index) => ({ ...row, rank: index + 1 }));
}

function mdRows(rows, fallback) {
  return rows.length ? rows.join("\n") : fallback;
}

const args = parseArgs(process.argv);
if (args.help) {
  console.log(usage());
  process.exit(0);
}

const tasks = readCsvIfExists(taskStatusPath);
const companyRows = readCsvIfExists(companyMapPath);
const publicSignals = readCsvIfExists(publicSignalPath);
const matrixRows = readCsvIfExists(roleMatrixPath);

const companyByName = companyMapByName(companyRows);
const segmentSignals = segmentSignalMap(publicSignals);
const matrixBySegmentRole = matrixMap(matrixRows);

const scored = tasks
  .filter((task) => task.status !== "已覆盖")
  .filter((task) => !args.city || task.city === args.city)
  .map((task) => {
    const company = companyByName.get(`${task.segment}|||${task.company}`) || companyByName.get(task.company) || {};
    const signals = segmentSignals.get(task.segment) || { evidenceCount: 0, p0Count: 0, scoreSum: 0 };
    const role = roleFamily(task.role);
    const matrix = matrixBySegmentRole.get(`${task.segment}|||${role}`) || {};
    const matchedJobCount = Number(task.matchedJobCount || 0);
    const companyScore = Number(company.opportunityScore || 0);
    const sampleGap = Number(matrix.sampleGap || 0);
    const salaryEvidence = Number(matrix.salaryEvidenceCount || 0);
    const score = priorityBase(task.priority)
      + companyScore
      + signals.p0Count * 8
      + signals.evidenceCount * 3
      + sampleGap * 2
      + Math.max(0, 4 - salaryEvidence) * 4
      + (matchedJobCount ? 0 : 8);
    return {
      key: `${task.segment}|||${task.company}|||${task.role}`,
      sampleOrder: task.sampleOrder,
      priority: task.priority,
      segment: task.segment,
      layer: task.layer,
      company: task.company,
      role: task.role,
      roleFamily: role,
      city: task.city,
      score: Math.round(score),
      safeBossHomeUrl,
      searchKeyword: task.searchKeyword || `${task.company} ${task.role}`.trim(),
      searchUrl: task.searchUrl,
      importCommand: task.importCommand,
      salaryBand: matrix.salaryBand || company.salaryObservation || "待补薪资信号",
      salaryEvidenceCount: salaryEvidence,
      sampleProgress: matrix.sampleProgress || "",
      sampleGap,
      companyOpportunity: company.opportunityLevel || "",
      companyScore,
      trendEvidenceCount: signals.evidenceCount,
      trendP0Count: signals.p0Count,
      reason: [
        `${task.priority}任务`,
        company.opportunityLevel || "公司机会待评估",
        signals.p0Count ? `P0趋势证据${signals.p0Count}条` : `趋势证据${signals.evidenceCount}条`,
        salaryEvidence ? `薪资证据${salaryEvidence}条` : "薪资证据不足",
        sampleGap ? `样本缺口${sampleGap}` : "样本缺口待核"
      ].join("; ")
    };
  })
  .sort((a, b) => b.score - a.score || Number(a.sampleOrder) - Number(b.sampleOrder));

const selected = pickBySegment(scored, args.limit);

mkdirSync(dirname(outputCsvPath), { recursive: true });
const headers = [
  "rank",
  "score",
  "priority",
  "segment",
  "company",
  "role",
  "roleFamily",
  "city",
  "salaryBand",
  "sampleProgress",
  "reason",
  "safeBossHomeUrl",
  "searchKeyword",
  "searchUrl",
  "importCommand"
];
writeFileSync(outputCsvPath, `${csv([headers])}\n${csv(selected.map((row) => headers.map((header) => row[header])))}\n`);

const segmentRows = [...new Set(selected.map((row) => row.segment))].map((segment) => {
  const rows = selected.filter((row) => row.segment === segment);
  const companies = [...new Set(rows.map((row) => row.company))].slice(0, 5).join("、");
  const roles = [...new Set(rows.map((row) => row.role))].join("、");
  return `| ${segment} | ${rows.length} | ${companies} | ${roles} |`;
});

const queueRows = selected.map((row) => {
  return `| ${row.rank} | ${row.score} | ${row.priority} | ${row.segment} | ${row.company} | ${row.role} | ${row.salaryBand} | ${row.safeBossHomeUrl} | \`${row.searchKeyword}\` | \`${row.importCommand}\` |`;
});

const md = `# BOSS下一轮优先采样清单

更新时间：${formatDate()}

## 一、本质判断

这份清单不是自动采集任务，而是把 ${tasks.length} 条人工采样任务压缩成下一轮优先动作。它解决的问题是：在 BOSS 风控恢复期，先把最能补足“大而全”调研缺口的公司和岗位看完。

## 二、生成规则

综合四类信号排序：

1. BOSS人工采样任务优先级。
2. 公司机会地图里的公司机会分。
3. 公开趋势信号看板里的 P0 证据。
4. 薪资能力矩阵里的薪资证据和样本缺口。

本脚本只生成 BOSS 首页、站内搜索关键词和导入命令，不打开 BOSS 页面，不读取网页。

## 三、本轮覆盖

| 赛道 | 任务数 | 优先公司 | 岗位词 |
| --- | ---: | --- | --- |
${mdRows(segmentRows, "| 暂无 | 0 |  |  |")}

## 四、优先采样任务

| 排名 | 分数 | 优先级 | 赛道 | 公司 | 岗位词 | 薪资观察 | BOSS首页 | 站内搜索关键词 | 导入命令 |
| ---: | ---: | --- | --- | --- | --- | --- | --- | --- | --- |
${mdRows(queueRows, "| 暂无 | 0 |  |  |  |  |  |  |  |  |")}

## 五、执行方式

1. 每次只处理 1 个站内搜索关键词，人工判断是否有真实相关岗位。
2. 复制岗位详情页文本后，执行对应导入命令。
3. 每导入 5 到 10 条后运行：

\`\`\`bash
npm run sampling:status
npm run salary:signals
npm run matrix:roles
npm run gap:resume
npm run report:full
npm run audit:research
\`\`\`

## 六、文件

\`\`\`text
${outputCsvPath}
\`\`\`
`;

writeFileSync(outputMdPath, md);

console.log(`已生成：${outputMdPath}`);
console.log(`已生成：${outputCsvPath}`);
console.log(`任务数：${selected.length}`);
