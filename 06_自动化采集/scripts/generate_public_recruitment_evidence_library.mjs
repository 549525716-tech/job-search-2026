#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const externalSalaryPath = join(projectRoot, "06_自动化采集/config/external_salary_signals.csv");
const bossPublicSignalsPath = join(projectRoot, "06_自动化采集/config/boss_public_company_signals.csv");
const outputMdPath = join(projectRoot, "01_行情收集/AI公开招聘薪资证据库.md");
const outputCsvPath = join(projectRoot, "01_行情收集/AI公开招聘薪资证据库.csv");

const canonicalSegments = [
  "基座大模型/Agent平台",
  "云计算/大模型平台",
  "智能客服/营销/销售AI",
  "AI芯片/GPU/加速卡",
  "AI服务器/智算基础设施",
  "工业AI/智能制造",
  "AI Agent/RPA/流程自动化",
  "数据/MLOps/AI基础软件",
  "智能汽车/机器人/具身智能",
  "AI安全/私有化/信创",
  "AI视觉/安防/质检",
  "智算中心/数据中心服务",
  "企业协同/AI办公"
];

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

function normalizeSegment(value) {
  const text = String(value || "");
  if (canonicalSegments.includes(text)) return text;
  if (/AI软件|大模型产品|基座|智谱|月之暗面|MiniMax|商汤|DeepSeek/.test(text)) return "基座大模型/Agent平台";
  if (/云|MaaS|Maas|API|模型微调|千帆|火山|阿里云|百度智能云/.test(text)) return "云计算/大模型平台";
  if (/客服|营销|销售AI|GEO|广告|增长|SaaS|数字人|AI营销/.test(text)) return "智能客服/营销/销售AI";
  if (/芯片|GPU|半导体|加速卡|端侧/.test(text)) return "AI芯片/GPU/加速卡";
  if (/服务器|英伟达|GB200|H100|智算基础/.test(text)) return "AI服务器/智算基础设施";
  if (/工业|制造|数字化|产线/.test(text)) return "工业AI/智能制造";
  if (/RPA|流程|智能体/.test(text)) return "AI Agent/RPA/流程自动化";
  if (/大数据|数据|MLOps/.test(text)) return "数据/MLOps/AI基础软件";
  if (/智能硬件|机器人|具身|汽车/.test(text)) return "智能汽车/机器人/具身智能";
  if (/安全|信创|私有化/.test(text)) return "AI安全/私有化/信创";
  if (/视觉|安防|质检/.test(text)) return "AI视觉/安防/质检";
  if (/IDC|数据中心|智算中心/.test(text)) return "智算中心/数据中心服务";
  if (/飞书|协同|办公/.test(text)) return "企业协同/AI办公";
  return text || "未归一";
}

function roleFamily(value) {
  const text = String(value || "");
  if (/总监|负责人|Head|管理岗|团队管理|区域负责人|销售leader/i.test(text)) return "销售管理/区域负责人";
  if (/售前|解决方案|顾问|方案|POC|Demo/.test(text)) return "售前/解决方案顾问";
  if (/渠道|生态|伙伴|代理/.test(text)) return "渠道/生态/伙伴销售";
  if (/芯片|服务器|智算|IDC|数据中心|半导体|硬件/.test(text)) return "硬件/智算/半导体行业销售";
  if (/大客户|KA|客户经理|行业|销售经理|区域销售/.test(text)) return "大客户/行业销售经理";
  if (/SaaS|软件|智能体|AI销售|大模型|人工智能|产品销售/.test(text)) return "AI软件/大模型销售";
  return "销售/商务";
}

function parseSalary(value) {
  const text = String(value || "").replaceAll("k", "K");
  if (!text) return null;
  const monthly = text.match(/(\d+(?:\.\d+)?)\s*[-~－—]\s*(\d+(?:\.\d+)?)\s*K/i);
  if (!monthly) return null;
  const min = Number.parseFloat(monthly[1]);
  const max = Number.parseFloat(monthly[2]);
  const monthCountMatch = text.match(/[·xX*]\s*(\d{2})\s*薪/);
  const monthCount = monthCountMatch ? Number.parseInt(monthCountMatch[1], 10) : 12;
  return {
    minK: min,
    maxK: max,
    monthCount,
    annualMinWan: Math.round(min * monthCount / 10 * 10) / 10,
    annualMaxWan: Math.round(max * monthCount / 10 * 10) / 10
  };
}

function evidenceScore(row) {
  let score = 35;
  if (row.salaryRaw) score += 20;
  if (row.salaryMaxK) score += 15;
  if (row.companyOrPage && !/招聘信息|招聘页|招聘网|人工智能/.test(row.companyOrPage)) score += 10;
  if (/BOSS公开公司页|BOSS公开搜索|BOSS直聘/.test(`${row.platform}${row.signalType}`)) score += 10;
  if (/猎聘|领英|智乐聘/.test(row.platform)) score += 8;
  if (row.requirementSignal) score += 7;
  if (row.url) score += 5;
  return Math.min(100, score);
}

function evidenceLevel(score) {
  if (score >= 85) return "强：岗位/薪资/来源较完整";
  if (score >= 70) return "中：可用于薪资和能力假设";
  if (score >= 55) return "弱：只作方向参考";
  return "线索：待人工校验";
}

function dedupeKey(row) {
  return [
    row.platform,
    row.companyOrPage,
    row.role,
    row.salaryRaw,
    row.segment,
    row.url
  ].map((item) => String(item || "").trim().toLowerCase()).join("::");
}

function topJoined(values, limit = 6, separator = "、") {
  return [...new Set(values.filter(Boolean))].slice(0, limit).join(separator);
}

function countBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item) || "未分类";
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), "zh-Hans-CN"));
}

function salaryStats(items, keyFn) {
  const grouped = new Map();
  for (const item of items) {
    if (!item.salaryMaxK) continue;
    const key = keyFn(item);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(item);
  }
  return [...grouped.entries()].map(([key, rows]) => ({
    key,
    count: rows.length,
    minK: Math.min(...rows.map((row) => Number(row.salaryMinK))),
    maxK: Math.max(...rows.map((row) => Number(row.salaryMaxK))),
    avgMaxK: rows.reduce((sum, row) => sum + Number(row.salaryMaxK), 0) / rows.length,
    examples: topJoined(rows.map((row) => `${row.companyOrPage}/${row.role}/${row.salaryRaw}`), 3, "；")
  })).sort((a, b) => b.maxK - a.maxK || b.count - a.count);
}

function isBossUrl(value) {
  return /zhipin\.com/i.test(String(value || ""));
}

function safeKeyword(...values) {
  return values
    .map((value) => String(value || "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" ")
    .slice(0, 80);
}

function safeSourceCell(row) {
  if (!row.url) return "-";
  if (isBossUrl(row.url)) return `BOSS首页站内复核：\`${safeKeyword(row.companyOrPage, row.role)}\``;
  return `[链接](${row.url})`;
}

const externalRows = readCsvIfExists(externalSalaryPath).map((row) => {
  const salary = parseSalary(row.salary);
  return {
    sourceKind: "公开薪资岗位信号",
    platform: row.platform,
    source: row.source,
    companyOrPage: row.company_or_page,
    role: row.role,
    signalType: row.source,
    segment: normalizeSegment(`${row.segment} ${row.role} ${row.company_or_page} ${row.requirement_signal}`),
    originalSegment: row.segment,
    roleFamily: roleFamily(row.role),
    salaryRaw: row.salary,
    salaryMinK: salary?.minK || "",
    salaryMaxK: salary?.maxK || "",
    annualMinWan: salary?.annualMinWan || "",
    annualMaxWan: salary?.annualMaxWan || "",
    city: row.city,
    requirementSignal: row.requirement_signal,
    url: row.url
  };
});

const bossRows = readCsvIfExists(bossPublicSignalsPath).map((row) => {
  const salary = parseSalary(row.salary_signal);
  return {
    sourceKind: "BOSS公开公司/岗位线索",
    platform: "BOSS直聘",
    source: row.signal_type,
    companyOrPage: row.company,
    role: row.role_signal,
    signalType: row.signal_type,
    segment: normalizeSegment(`${row.segment} ${row.company} ${row.role_signal} ${row.public_signal}`),
    originalSegment: row.segment,
    roleFamily: roleFamily(row.role_signal),
    salaryRaw: row.salary_signal,
    salaryMinK: salary?.minK || "",
    salaryMaxK: salary?.maxK || "",
    annualMinWan: salary?.annualMinWan || "",
    annualMaxWan: salary?.annualMaxWan || "",
    city: "",
    requirementSignal: row.public_signal,
    url: row.source_url
  };
});

const seen = new Set();
const evidenceRows = [...externalRows, ...bossRows]
  .map((row) => {
    const score = evidenceScore(row);
    return {
      ...row,
      evidenceScore: score,
      evidenceLevel: evidenceLevel(score),
      evidenceBoundary: "公开页面/搜索信号，需BOSS登录态岗位详情人工校验"
    };
  })
  .filter((row) => {
    const key = dedupeKey(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  })
  .sort((a, b) => Number(b.evidenceScore) - Number(a.evidenceScore) || Number(b.salaryMaxK || 0) - Number(a.salaryMaxK || 0));

const segmentRows = countBy(evidenceRows, (row) => row.segment).map(([segment, count]) => {
  const rows = evidenceRows.filter((row) => row.segment === segment);
  const salaryRows = rows.filter((row) => row.salaryMaxK);
  return {
    segment,
    count,
    salaryCount: salaryRows.length,
    maxSalaryK: salaryRows.length ? Math.max(...salaryRows.map((row) => Number(row.salaryMaxK))) : "",
    topRoles: topJoined(rows.map((row) => row.roleFamily), 6),
    topCompanies: topJoined(rows.map((row) => row.companyOrPage), 8),
    requirementSignals: topJoined(rows.map((row) => row.requirementSignal), 4, "；")
  };
}).sort((a, b) => Number(b.maxSalaryK || 0) - Number(a.maxSalaryK || 0) || b.count - a.count);

const roleRows = salaryStats(evidenceRows, (row) => row.roleFamily);
const platformRows = countBy(evidenceRows, (row) => row.platform).map(([platform, count]) => ({ platform, count }));

const headers = [
  "sourceKind",
  "platform",
  "source",
  "companyOrPage",
  "role",
  "signalType",
  "segment",
  "originalSegment",
  "roleFamily",
  "salaryRaw",
  "salaryMinK",
  "salaryMaxK",
  "annualMinWan",
  "annualMaxWan",
  "city",
  "requirementSignal",
  "evidenceScore",
  "evidenceLevel",
  "evidenceBoundary",
  "url"
];

const md = `# AI公开招聘薪资证据库

更新时间：${formatDate()}

## 一、本质判断

这份证据库不是 BOSS 大样本采集结果，而是把已有公开招聘/薪资线索统一去重、归类和评分。它用于在 BOSS 风控恢复期增强薪资区间、岗位方向和能力要求的阶段性判断。

当前最大的矛盾是：公开信号能帮助判断方向，但不能替代登录态岗位详情。因此每条证据都保留来源、证据分和边界说明，后续仍要用 BOSS 人工样本校验。

## 二、证据总览

| 项目 | 数量 |
| --- | ---: |
| 公开招聘/薪资证据 | ${evidenceRows.length} |
| 其中可解析薪资 | ${evidenceRows.filter((row) => row.salaryMaxK).length} |
| 覆盖赛道 | ${new Set(evidenceRows.map((row) => row.segment)).size} |
| 覆盖岗位族 | ${new Set(evidenceRows.map((row) => row.roleFamily)).size} |
| BOSS公开线索 | ${evidenceRows.filter((row) => row.sourceKind.includes("BOSS")).length} |

## 三、赛道薪资和岗位信号

| 赛道 | 证据数 | 可解析薪资数 | 最高月薪观察 | 主要岗位族 | 代表公司/页面 | 能力/要求信号 |
| --- | ---: | ---: | ---: | --- | --- | --- |
${segmentRows.map((row) => `| ${row.segment} | ${row.count} | ${row.salaryCount} | ${row.maxSalaryK ? `${row.maxSalaryK}K` : "-"} | ${row.topRoles} | ${row.topCompanies} | ${row.requirementSignals} |`).join("\n")}

## 四、岗位族薪资观察

| 岗位族 | 可解析薪资数 | 最低月薪 | 平均上限 | 最高月薪 | 示例 |
| --- | ---: | ---: | ---: | ---: | --- |
${roleRows.map((row) => `| ${row.key} | ${row.count} | ${row.minK}K | ${row.avgMaxK.toFixed(1)}K | ${row.maxK}K | ${row.examples} |`).join("\n")}

## 五、证据来源分布

| 平台 | 证据数 |
| --- | ---: |
${platformRows.map((row) => `| ${row.platform} | ${row.count} |`).join("\n")}

## 六、高分证据Top 20

| 序号 | 证据分 | 证据等级 | 平台 | 赛道 | 岗位 | 公司/页面 | 薪资 | 要求信号 | 来源 |
| ---: | ---: | --- | --- | --- | --- | --- | --- | --- | --- |
${evidenceRows.slice(0, 20).map((row, index) => `| ${index + 1} | ${row.evidenceScore} | ${row.evidenceLevel} | ${row.platform} | ${row.segment} | ${row.role} | ${row.companyOrPage} | ${row.salaryRaw || "-"} | ${row.requirementSignal || "-"} | ${safeSourceCell(row)} |`).join("\n")}

## 七、使用边界

1. 这里的薪资是公开信号，不等于已验证岗位详情。
2. 同一公开搜索页可能包含多个职位，已做基础去重，但仍需人工核验。
3. BOSS公开公司页只证明存在招聘入口，不证明当前岗位仍在招。
4. 这份证据库用于排序和假设，最终结论以 BOSS 登录态岗位详情样本为准。

## 八、输出文件

\`\`\`text
${outputCsvPath}
\`\`\`
`;

writeFileSync(outputMdPath, md);
writeFileSync(outputCsvPath, `${csv([headers, ...evidenceRows.map((row) => headers.map((header) => row[header]))])}\n`);

console.log(`已生成：${outputMdPath}`);
console.log(`已生成：${outputCsvPath}`);
console.log(`公开招聘/薪资证据：${evidenceRows.length}`);
console.log(`可解析薪资：${evidenceRows.filter((row) => row.salaryMaxK).length}`);
