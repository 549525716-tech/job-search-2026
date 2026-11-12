#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const companyMapPath = join(projectRoot, "00_行业资料集/AI产业链头部公司岗位机会地图.csv");
const companyProfilePath = join(projectRoot, "00_行业资料集/AI销售目标公司分层画像.csv");
const compensationPath = join(projectRoot, "01_行情收集/AI销售岗位薪资待遇与能力门槛分析.csv");
const decisionPath = join(projectRoot, "01_行情收集/AI销售岗位市场决策总览.csv");
const nextSamplingPath = join(projectRoot, "01_行情收集/BOSS下一轮优先采样清单.csv");
const outputMdPath = join(projectRoot, "01_行情收集/AI细分赛道销售机会矩阵.md");
const outputCsvPath = join(projectRoot, "01_行情收集/AI细分赛道销售机会矩阵.csv");

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

function splitTerms(value) {
  return String(value || "")
    .split(/[;；、]/)
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

function average(values) {
  const nums = values.filter((value) => Number.isFinite(value));
  if (!nums.length) return 0;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

function routeForSegment(segment) {
  if (/芯片|服务器|智算|数据中心|算力/.test(segment)) return "硬件/算力/半导体路线";
  if (/工业|制造|视觉|安防|安全|私有化|信创|汽车|机器人|具身/.test(segment)) return "行业解决方案路线";
  if (/大模型|Agent|云计算|MaaS|数据|MLOps|客服|营销|SaaS|RPA/.test(segment)) return "AI软件落地路线";
  return "AI产业链综合路线";
}

function directionForSegment(segment) {
  if (/基座大模型|Agent平台/.test(segment)) return "用模型能力切业务场景，重点看商业化、行业方案和生态合作。";
  if (/云计算|MaaS/.test(segment)) return "用云资源和模型服务进入客户IT预算，重点看大客户、售前和行业客户经营。";
  if (/客服|营销|销售AI|SaaS/.test(segment)) return "更接近应用SaaS销售，重点看线索转化、续费增购和客户成功。";
  if (/数据|MLOps|基础软件/.test(segment)) return "偏复杂软件和数据平台销售，重点看方案能力、行业客户和项目周期。";
  if (/芯片|GPU|半导体/.test(segment)) return "偏上游硬科技，重点看云/服务器/智算生态、大客户和渠道。";
  if (/服务器|智算|数据中心|算力/.test(segment)) return "偏算力基础设施，重点看政企、IDC、云厂商和项目交付协同。";
  if (/工业|制造/.test(segment)) return "偏制造业项目型销售，重点看行业工艺、现场问题和ROI表达。";
  if (/视觉|安防|质检/.test(segment)) return "偏行业解决方案，重点看渠道、行业客户、方案落地和项目结果。";
  if (/安全|私有化|信创/.test(segment)) return "偏政企安全和私有化部署，重点看招投标、合规、渠道和回款。";
  if (/汽车|机器人|具身/.test(segment)) return "偏软硬结合和生态销售，重点看行业客户、渠道、海外和项目落地。";
  return "先按公司类型判断销售打法，再用BOSS样本校验。";
}

function resumeEvidenceForSegment(segment) {
  if (/芯片|服务器|智算|数据中心|算力|半导体/.test(segment)) {
    return "大客户项目、硬件/算力链路、政企/云/IDC生态、招投标、交付协同、合同额和回款。";
  }
  if (/工业|制造|视觉|安防|质检/.test(segment)) {
    return "行业场景、客户痛点、方案/POC、跨部门推进、上线结果和可量化业务收益。";
  }
  if (/安全|私有化|信创/.test(segment)) {
    return "政企客户、合规/安全诉求、招投标、私有化交付、渠道生态和回款闭环。";
  }
  if (/大模型|Agent|云计算|MaaS|数据|MLOps/.test(segment)) {
    return "AI产品理解、行业场景拆解、方案表达、Demo/POC、KA推进和商业化结果。";
  }
  if (/客服|营销|销售AI|SaaS|RPA/.test(segment)) {
    return "ToB/SaaS销售、线索转化、销售漏斗、客户成功、续费增购和行业案例。";
  }
  return "客户类型、销售动作、成交结果和可迁移能力证据。";
}

function evidenceBoundary(evidenceLevel, sampleGap) {
  if (sampleGap > 0) return `${evidenceLevel || "公开信号"}；BOSS样本缺口 ${sampleGap}，需人工校验`;
  return evidenceLevel || "已由现有样本覆盖";
}

function priorityLabel(score, salaryMaxK, p0CompanyCount) {
  if (score >= 170 || salaryMaxK >= 60 || p0CompanyCount >= 5) return "P0 优先深挖";
  if (score >= 130 || salaryMaxK >= 45 || p0CompanyCount >= 3) return "P1 重点跟进";
  if (score >= 90) return "P2 扩展观察";
  return "P3 暂缓";
}

const companyRows = readCsvIfExists(companyMapPath);
const profileRows = readCsvIfExists(companyProfilePath);
const compensationRows = readCsvIfExists(compensationPath);
const decisionRows = readCsvIfExists(decisionPath);
const nextSamplingRows = readCsvIfExists(nextSamplingPath);
const profileBySegment = new Map(profileRows.map((row) => [row.segment, row]));

const segments = unique([
  ...companyRows.map((row) => row.segment),
  ...profileRows.map((row) => row.segment),
  ...compensationRows.map((row) => row.segment),
  ...decisionRows.map((row) => row.segment)
]);

const matrixRows = segments.map((segment) => {
  const companies = companyRows.filter((row) => row.segment === segment);
  const profile = profileBySegment.get(segment) || {};
  const comps = compensationRows
    .filter((row) => row.segment === segment)
    .sort((a, b) => numberOf(b.salaryMaxK) - numberOf(a.salaryMaxK) || numberOf(b.salaryEvidenceCount) - numberOf(a.salaryEvidenceCount));
  const decisions = decisionRows
    .filter((row) => row.segment === segment)
    .sort((a, b) => numberOf(b.decisionScore) - numberOf(a.decisionScore));
  const nextTasks = nextSamplingRows.filter((row) => row.segment === segment);
  const bestComp = comps[0] || {};
  const bestDecision = decisions[0] || {};
  const companyScoreAvg = average(companies.map((row) => numberOf(row.opportunityScore)));
  const p0CompanyCount = companies.filter((row) => /P0/.test(row.opportunityLevel || "")).length || numberOf(profile.p0CompanyCount);
  const salaryMaxK = numberOf(bestComp.salaryMaxK);
  const sampleGap = Math.max(
    numberOf(bestComp.sampleGap),
    numberOf(bestDecision.sampleGap),
    numberOf(profile.sampleGap)
  );
  const decisionScore = numberOf(bestDecision.decisionScore);
  const score = Math.round(companyScoreAvg + p0CompanyCount * 8 + salaryMaxK * 1.2 + decisionScore * 0.2);
  const sortedCompanies = companies
    .slice()
    .sort((a, b) => numberOf(b.opportunityScore) - numberOf(a.opportunityScore) || numberOf(a.priority) - numberOf(b.priority));
  const roles = topJoined([
    bestDecision.role,
    ...comps.map((row) => row.role),
    ...companies.flatMap((row) => splitSemi(row.roleTerms)),
    ...splitTerms(profile.roleFocus)
  ], 6);
  const topCompanies = topJoined([
    ...splitSemi(profile.topCompanies),
    ...sortedCompanies.map((row) => row.company)
  ], 8);
  const nextAction = nextTasks.length
    ? `优先人工看 ${topJoined(nextTasks.map((row) => `${row.company}/${row.role}`), 3, "、")}`
    : profile.nextAction || bestComp.nextAction || bestDecision.nextAction || `补 ${topJoined(sortedCompanies.map((row) => row.company), 3, "/")} 岗位样本`;
  return {
    score,
    priority: priorityLabel(score, salaryMaxK, p0CompanyCount),
    route: routeForSegment(segment),
    segment,
    companyType: profile.companyType || "",
    companyCount: companies.length || numberOf(profile.companyCount),
    p0CompanyCount,
    topCompanies,
    roleFocus: roles,
    salaryBand: bestComp.salaryBand || profile.salaryObservation || topJoined(companies.map((row) => row.salaryObservation), 3, "; ") || "待BOSS样本校验",
    salaryTier: bestComp.salaryTier || "待样本校验",
    salaryMaxK: salaryMaxK || "",
    evidenceLevel: bestComp.evidenceLevel || bestDecision.evidenceLevel || "待样本校验",
    sampleGap,
    buyerProfiles: profile.buyerProfiles || "",
    salesMotion: profile.salesMotion || directionForSegment(segment),
    marketDirection: directionForSegment(segment),
    coreCapabilities: bestComp.coreCapabilities || profile.capabilityFocus || bestDecision.coreCapabilities || topJoined(companies.flatMap((row) => splitSemi(row.coreCapabilities)), 6, ";"),
    mustHaveGate: bestComp.mustHaveGate || "",
    resumeEvidence: profile.resumePositioning || resumeEvidenceForSegment(segment),
    nextAction,
    risk: sampleGap > 0 ? "BOSS样本不足，结论需校验" : "已有样本覆盖",
    evidenceBoundary: evidenceBoundary(bestComp.evidenceLevel || bestDecision.evidenceLevel, sampleGap)
  };
}).sort((a, b) => b.score - a.score || numberOf(b.salaryMaxK) - numberOf(a.salaryMaxK));

const headers = [
  "rank",
  "score",
  "priority",
  "route",
  "segment",
  "companyType",
  "companyCount",
  "p0CompanyCount",
  "topCompanies",
  "roleFocus",
  "salaryBand",
  "salaryTier",
  "salaryMaxK",
  "evidenceLevel",
  "sampleGap",
  "buyerProfiles",
  "salesMotion",
  "marketDirection",
  "coreCapabilities",
  "mustHaveGate",
  "resumeEvidence",
  "nextAction",
  "risk",
  "evidenceBoundary"
];

const routeGroups = unique(matrixRows.map((row) => row.route)).map((route) => {
  const rows = matrixRows.filter((row) => row.route === route);
  return {
    route,
    segments: rows.map((row) => row.segment).join("、"),
    topSegments: rows.slice(0, 3).map((row) => row.segment).join("、"),
    salaryMax: Math.max(...rows.map((row) => numberOf(row.salaryMaxK))),
    roles: topJoined(rows.flatMap((row) => splitTerms(row.roleFocus)), 6),
    resumeEvidence: topJoined(rows.map((row) => row.resumeEvidence), 3, "；")
  };
});

const userExampleCompanies = ["月之暗面", "智谱AI", "MiniMax", "寒武纪", "海光信息", "超聚变", "商汤科技", "百度智能云", "第四范式", "创新奇智"];
const exampleRows = userExampleCompanies
  .map((company) => {
    const companyRow = companyRows.find((row) => row.company === company);
    if (!companyRow) return null;
    const segmentRow = matrixRows.find((row) => row.segment === companyRow.segment) || {};
    return {
      company,
      segment: companyRow.segment,
      route: segmentRow.route || routeForSegment(companyRow.segment),
      roles: companyRow.roleTerms,
      salary: companyRow.salaryObservation || segmentRow.salaryBand,
      resumeEvidence: segmentRow.resumeEvidence,
      nextAction: companyRow.nextAction || segmentRow.nextAction
    };
  })
  .filter(Boolean);

const csvRows = [
  headers,
  ...matrixRows.map((row, index) => headers.map((header) => (header === "rank" ? index + 1 : row[header])))
];

const md = `# AI细分赛道销售机会矩阵

更新时间：${formatDate()}

## 一、本质判断

这份矩阵不是岗位清单，而是把“AI行业很大”拆成可投递、可采样、可改简历的赛道决策表。它回答：哪个赛道优先看、典型销售岗位是什么、薪资上限在哪里、客户是谁、销售打法是什么、简历证据应该怎么准备。

当前最大的矛盾是：BOSS大样本仍不足，不能把阶段性薪资和岗位判断当作最终事实；但可以先用公司池、公开薪资信号、公开趋势信号和人工采样任务建立优先级，再用低频人工采样校验。

## 二、赛道机会总览

| 排名 | 优先级 | 路线 | 赛道 | 公司类型 | 代表公司 | 典型岗位 | 薪资观察 | 能力门槛 | 样本缺口 | 下一步 |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- |
${matrixRows.map((row, index) => `| ${index + 1} | ${row.priority} | ${row.route} | ${row.segment} | ${row.companyType} | ${row.topCompanies} | ${row.roleFocus} | ${row.salaryBand} | ${topJoined(splitTerms(row.mustHaveGate || row.coreCapabilities), 3)} | ${row.sampleGap} | ${row.nextAction} |`).join("\n")}

## 三、三条主攻路线

| 路线 | 覆盖赛道 | 优先赛道 | 薪资上限观察 | 主要岗位 | 简历证据重点 |
| --- | --- | --- | ---: | --- | --- |
${routeGroups.map((row) => `| ${row.route} | ${row.segments} | ${row.topSegments} | ${row.salaryMax || "-"}K | ${row.roles} | ${row.resumeEvidence} |`).join("\n")}

## 四、你点名公司的归属

| 公司 | 所属赛道 | 主攻路线 | 可能岗位 | 薪资观察 | 简历贴合证据 | 下一步 |
| --- | --- | --- | --- | --- | --- | --- |
${exampleRows.map((row) => `| ${row.company} | ${row.segment} | ${row.route} | ${row.roles} | ${row.salary} | ${row.resumeEvidence} | ${row.nextAction} |`).join("\n")}

## 五、使用方式

1. 先按三条路线选主攻方向：AI软件落地、硬件/算力/半导体、行业解决方案。
2. 每条路线优先看 P0/P1 赛道，不要平均分配精力。
3. 每个赛道先补 2 到 3 个 BOSS 人工样本，优先补样本缺口大的高薪赛道。
4. 简历先围绕共同能力证据改：大客户、AI产品理解、方案/POC、回款闭环、行业场景。
5. 本矩阵的薪资和能力判断是阶段性结论，最终以 BOSS 实际岗位详情为准。

## 六、输出文件

\`\`\`text
${outputCsvPath}
\`\`\`
`;

writeFileSync(outputMdPath, md);
writeFileSync(outputCsvPath, `${csv(csvRows)}\n`);

console.log(`已生成：${outputMdPath}`);
console.log(`已生成：${outputCsvPath}`);
console.log(`赛道数：${matrixRows.length}`);
console.log(`P0/P1赛道数：${matrixRows.filter((row) => /^P[01]/.test(row.priority)).length}`);
