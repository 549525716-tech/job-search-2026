#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const companyMapPath = join(projectRoot, "00_行业资料集/AI产业链头部公司岗位机会地图.csv");
const companyProfilePath = join(projectRoot, "00_行业资料集/AI销售目标公司分层画像.csv");
const compensationPath = join(projectRoot, "01_行情收集/AI销售岗位薪资待遇与能力门槛分析.csv");
const nextSamplingPath = join(projectRoot, "01_行情收集/BOSS下一轮优先采样清单.csv");
const outputMdPath = join(projectRoot, "00_行业资料集/AI目标公司销售岗位打法清单.md");
const outputCsvPath = join(projectRoot, "00_行业资料集/AI目标公司销售岗位打法清单.csv");
const safeBossHomeUrl = "https://www.zhipin.com/";

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

function splitSemi(value) {
  return String(value || "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function topJoined(values, limit = 6, separator = "、") {
  return unique(values).slice(0, limit).join(separator);
}

function numberOf(value) {
  const num = Number.parseFloat(String(value || "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(num) ? num : 0;
}

function roleFamily(role) {
  const text = String(role || "");
  if (/售前|解决方案|顾问|方案/.test(text)) return "售前/解决方案顾问";
  if (/渠道|生态|伙伴|代理/.test(text)) return "渠道/生态/伙伴销售";
  if (/总监|负责人|管理|销售经理|区域/.test(text)) return "销售管理/区域负责人";
  if (/芯片|硬件|服务器|智算|IDC|数据中心|半导体/.test(text)) return "硬件/智算/半导体行业销售";
  if (/大客户|KA|客户经理|行业/.test(text)) return "大客户/行业销售经理";
  if (/SaaS|软件|智能体|应用|AI销售|大模型/.test(text)) return "AI软件/大模型销售";
  return "销售/商务";
}

function priorityLabel(score) {
  if (score >= 75) return "P0 立即人工看";
  if (score >= 60) return "P1 重点跟进";
  if (score >= 40) return "P2 扩展观察";
  return "P3 暂缓";
}

function searchUrl(company, role, city = "广州") {
  const cityCode = city === "广州" ? "101280100" : "";
  const query = encodeURIComponent(`${company} ${role}`);
  return `https://www.zhipin.com/web/geek/jobs?query=${query}${cityCode ? `&city=${cityCode}` : ""}`;
}

function searchKeyword(company, role) {
  return `${company} ${role}`.trim();
}

function shellQuote(value) {
  return `"${String(value || "").replaceAll('"', '\\"')}"`;
}

function importCommand(company, role, city = "广州") {
  return [
    "npm run import:manual --",
    "--source",
    shellQuote("BOSS直聘"),
    "--query",
    shellQuote(`${company} ${role}`),
    "--company",
    shellQuote(company),
    "--role",
    shellQuote(role),
    "--city",
    shellQuote(city)
  ].join(" ");
}

function companyPosition(row, profile) {
  const segment = String(row.segment || "");
  const text = [row.segment, row.layer, profile?.companyType, row.keywords].join(" ");
  if (/安全|私有化|信创/.test(segment)) return "政企安全/私有化公司";
  if (/工业|制造/.test(segment)) return "行业解决方案公司";
  if (/视觉|安防|质检/.test(segment)) return "行业解决方案公司";
  if (/服务器|智算|数据中心|IDC|算力基础/.test(segment)) return "中游算力基础设施公司";
  if (/芯片|GPU|加速卡|半导体/.test(segment)) return "上游硬件核心公司";
  if (/云计算|MaaS|大模型平台/.test(segment)) return "中游平台型公司";
  if (/基座大模型|Agent平台/.test(segment)) return "模型/Agent商业化公司";
  if (/客服|营销|销售AI|SaaS|RPA|流程/.test(segment)) return "下游应用SaaS公司";
  if (/安全|私有化|信创|政企安全/.test(text)) return "政企安全/私有化公司";
  if (/工业|制造|产线|工厂|质检|视觉|安防/.test(text)) return "行业解决方案公司";
  if (/服务器|智算|数据中心|IDC|算力基础/.test(text)) return "中游算力基础设施公司";
  if (/芯片|GPU|加速卡|半导体/.test(text)) return "上游硬件核心公司";
  if (/云厂商|云计算|MaaS|大模型平台/.test(text)) return "中游平台型公司";
  if (/基座大模型|模型能力|Agent平台|大模型商业化/.test(text)) return "模型/Agent商业化公司";
  if (/客服|营销|销售AI|SaaS|RPA|流程/.test(text)) return "下游应用SaaS公司";
  return profile?.companyType || "AI产业链公司";
}

function strongestCompensation(segment, roles, compensationRows) {
  const roleFamilies = splitSemi(roles).map(roleFamily);
  const matched = compensationRows
    .filter((row) => row.segment === segment && roleFamilies.includes(row.role))
    .sort((a, b) => numberOf(b.salaryMaxK) - numberOf(a.salaryMaxK) || numberOf(b.salaryEvidenceCount) - numberOf(a.salaryEvidenceCount));
  return matched[0] || compensationRows
    .filter((row) => row.segment === segment)
    .sort((a, b) => numberOf(b.salaryMaxK) - numberOf(a.salaryMaxK))[0] || {};
}

function mdRows(rows, fallback = "暂无") {
  return rows.length ? rows.join("\n") : fallback;
}

const companyRows = readCsvIfExists(companyMapPath);
const profileRows = readCsvIfExists(companyProfilePath);
const compensationRows = readCsvIfExists(compensationPath);
const nextSamplingRows = readCsvIfExists(nextSamplingPath);
const profileBySegment = new Map(profileRows.map((row) => [row.segment, row]));
const nextByCompany = new Map(nextSamplingRows.map((row) => [row.company, row]));

const playbookRows = companyRows.map((row) => {
  const profile = profileBySegment.get(row.segment) || {};
  const comp = strongestCompensation(row.segment, row.roleTerms, compensationRows);
  const next = nextByCompany.get(row.company) || {};
  const roles = splitSemi(row.roleTerms);
  const firstRole = next.role || roles[0] || "AI销售";
  const score = numberOf(row.opportunityScore) + (next.company ? 20 : 0) + (row.opportunityLevel === "P0优先采样" ? 15 : 0);
  const search = next.searchUrl || row.firstSearchUrl || searchUrl(row.company, firstRole);
  const keyword = next.searchKeyword || row.searchKeyword || searchKeyword(row.company, firstRole);
  return {
    score,
    priority: priorityLabel(score),
    segment: row.segment,
    layer: row.layer,
    company: row.company,
    companyType: profile.companyType || "",
    companyPosition: companyPosition(row, profile),
    opportunityLevel: row.opportunityLevel,
    keywords: row.keywords,
    buyerProfiles: profile.buyerProfiles || "",
    salesMotion: profile.salesMotion || "",
    whySalesExists: profile.whySalesExists || "",
    likelyRoles: roles.join(";"),
    firstRole,
    salaryObservation: row.salaryObservation || profile.salaryObservation || comp.salaryBand || "待BOSS样本校验",
    salaryTier: comp.salaryTier || "待样本校验",
    salaryMaxK: comp.salaryMaxK || "",
    evidenceLevel: comp.evidenceLevel || "待样本校验",
    coreCapabilities: row.coreCapabilities || profile.capabilityFocus || comp.coreCapabilities || "",
    mustHaveGate: comp.mustHaveGate || "",
    resumePositioning: profile.resumePositioning || "",
    samplingStatus: row.samplingStatus || "",
    nextAction: next.company ? `优先人工看 ${next.company}/${next.role}` : row.nextAction,
    safeBossHomeUrl,
    searchKeyword: keyword,
    searchUrl: search,
    importCommand: next.importCommand || importCommand(row.company, firstRole),
    evidenceBoundary: "公司池和薪资为阶段性假设，最终以BOSS实际岗位详情为准"
  };
}).sort((a, b) => b.score - a.score || a.company.localeCompare(b.company, "zh-Hans-CN"));

const headers = [
  "rank",
  "score",
  "priority",
  "segment",
  "layer",
  "company",
  "companyType",
  "companyPosition",
  "opportunityLevel",
  "keywords",
  "buyerProfiles",
  "salesMotion",
  "whySalesExists",
  "likelyRoles",
  "firstRole",
  "salaryObservation",
  "salaryTier",
  "salaryMaxK",
  "evidenceLevel",
  "coreCapabilities",
  "mustHaveGate",
  "resumePositioning",
  "samplingStatus",
  "nextAction",
  "safeBossHomeUrl",
  "searchKeyword",
  "searchUrl",
  "importCommand",
  "evidenceBoundary"
];

const csvRows = [
  headers,
  ...playbookRows.map((row, index) => headers.map((header) => (header === "rank" ? index + 1 : row[header])))
];

const p0Rows = playbookRows.filter((row) => row.priority.startsWith("P0")).slice(0, 40);
const bySegment = [...new Map(playbookRows.map((row) => [row.segment, true])).keys()]
  .map((segment) => {
    const rows = playbookRows.filter((row) => row.segment === segment);
    return {
      segment,
      count: rows.length,
      p0Count: rows.filter((row) => row.priority.startsWith("P0")).length,
      topCompanies: rows.slice(0, 8).map((row) => row.company).join("、"),
      topRoles: topJoined(rows.flatMap((row) => splitSemi(row.likelyRoles)), 6),
      salary: topJoined(rows.map((row) => row.salaryObservation), 3, "; "),
      capability: topJoined(rows.flatMap((row) => splitSemi(row.coreCapabilities)), 6)
    };
  })
  .sort((a, b) => b.p0Count - a.p0Count || b.count - a.count);

const userExampleCompanies = ["月之暗面", "智谱AI", "MiniMax", "寒武纪", "海光信息", "超聚变", "商汤科技", "百度智能云", "第四范式", "创新奇智"];
const exampleRows = playbookRows.filter((row) => userExampleCompanies.includes(row.company));

const md = `# AI目标公司销售岗位打法清单

更新时间：${formatDate()}

## 一、本质判断

这份清单不是公司名录，而是把 AI 产业链公司转成求职打法：这家公司属于哪类 AI 公司、为什么会有销售岗、应该看什么岗位词、薪资假设是什么、简历要怎么贴合、下一步在 BOSS 上如何低频人工采样。

当前公司池覆盖 ${playbookRows.length} 家公司。由于 BOSS 干净岗位样本仍不足，公司级判断是“公司池 + 赛道画像 + 公开薪资信号 + 下一轮采样任务”的阶段性打法，最终岗位事实仍以 BOSS 实际在招岗位为准。

## 二、你点名方向的公司

| 公司 | 赛道 | 公司定位 | 可能岗位 | 薪资假设 | 能力门槛 | BOSS首页 | 站内搜索关键词 |
| --- | --- | --- | --- | --- | --- | --- | --- |
${mdRows(exampleRows.map((row) => `| ${row.company} | ${row.segment} | ${row.companyPosition} | ${row.likelyRoles} | ${row.salaryObservation} | ${topJoined(splitSemi(row.mustHaveGate || row.coreCapabilities), 3)} | ${row.safeBossHomeUrl} | \`${row.searchKeyword}\` |`))}

## 三、赛道公司池总览

| 赛道 | 公司数 | P0公司数 | 代表公司 | 重点岗位词 | 薪资假设 | 核心能力 |
| --- | ---: | ---: | --- | --- | --- | --- |
${mdRows(bySegment.map((row) => `| ${row.segment} | ${row.count} | ${row.p0Count} | ${row.topCompanies} | ${row.topRoles} | ${row.salary} | ${row.capability} |`))}

## 四、优先人工看的 40 家公司

| 排名 | 优先级 | 公司 | 赛道 | 公司定位 | 首看岗位词 | 薪资假设 | 简历贴合点 | BOSS首页 | 站内搜索关键词 | 下一步 |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${mdRows(p0Rows.map((row, index) => `| ${index + 1} | ${row.priority} | ${row.company} | ${row.segment} | ${row.companyPosition} | ${row.firstRole} | ${row.salaryObservation} | ${row.resumePositioning || topJoined(splitSemi(row.coreCapabilities), 4)} | ${row.safeBossHomeUrl} | \`${row.searchKeyword}\` | ${row.nextAction} |`))}

## 五、公司打法怎么用

1. 先看“你点名方向的公司”：智谱AI、月之暗面、MiniMax、商汤科技、寒武纪、海光信息、超聚变等。
2. 每家公司先打开 BOSS 首页，再用“站内搜索关键词”搜一个最相关岗位词；不连续刷新，复制岗位详情后用对应导入命令沉淀样本。
3. 对模型/Agent公司，简历重点放在 AI产品理解、行业场景、解决方案表达和ToB商机推进。
4. 对芯片/服务器/智算公司，简历重点放在大客户、硬件链路、政企/云/IDC生态、项目周期和回款。
5. 对工业AI/视觉/安全公司，简历重点放在行业场景、方案/POC、交付协同、招投标或私有化部署。

## 六、输出文件

\`\`\`text
${outputCsvPath}
\`\`\`
`;

writeFileSync(outputMdPath, md);
writeFileSync(outputCsvPath, `${csv(csvRows)}\n`);

console.log(`已生成：${outputMdPath}`);
console.log(`已生成：${outputCsvPath}`);
console.log(`公司数：${playbookRows.length}`);
console.log(`P0公司数：${playbookRows.filter((row) => row.priority.startsWith("P0")).length}`);
