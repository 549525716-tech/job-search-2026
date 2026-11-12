#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const deliveryPath = join(projectRoot, "01_行情收集/AI销售岗位市场调研交付版.csv");
const compensationPath = join(projectRoot, "01_行情收集/AI销售岗位薪资待遇与能力门槛分析.csv");
const companyTypePath = join(projectRoot, "00_行业资料集/AI销售公司类型岗位打法对照表.csv");
const companySamplingPath = join(projectRoot, "01_行情收集/BOSS目标公司采样缺口看板.csv");
const conclusionGatePath = join(projectRoot, "01_行情收集/AI销售市场结论权限总控.csv");
const resumeEvidencePath = join(projectRoot, "03_简历/AI销售能力证据与简历改写矩阵.csv");
const resumeGapPath = join(projectRoot, "03_简历/AI销售岗位匹配与能力Gap.csv");

const outputMdPath = join(projectRoot, "01_行情收集/AI销售岗位公司类型岗位族交叉看板.md");
const outputCsvPath = join(projectRoot, "01_行情收集/AI销售岗位公司类型岗位族交叉看板.csv");

function splitCsvRecords(text) {
  const records = [];
  let current = "";
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '""';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (current.trim()) records.push(current);
      current = "";
      if (char === "\r" && next === "\n") index += 1;
    } else {
      current += char;
    }
  }
  if (current.trim()) records.push(current);
  return records;
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
  const records = splitCsvRecords(text).filter((line) => line.trim());
  if (!records.length) return [];
  const headers = parseCsvLine(records.shift());
  return records.map((line) => {
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

function splitTerms(value) {
  return String(value || "")
    .split(/[;；、]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniq(items) {
  return [...new Set(items.map((item) => String(item || "").trim()).filter(Boolean))];
}

function topJoined(values, limit = 6, separator = "、") {
  return uniq(values).slice(0, limit).join(separator);
}

function mdRows(rows, fallback) {
  return rows.length ? rows.join("\n") : fallback;
}

function formatDateTime(value = new Date()) {
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

function roleFamily(role) {
  const text = String(role || "");
  if (/售前|解决方案|顾问|POC|技术销售|商业技术/.test(text)) return "售前/解决方案顾问";
  if (/渠道|生态|伙伴|代理/.test(text)) return "渠道/生态/伙伴销售";
  if (/管理|总监|负责人|区域/.test(text)) return "销售管理/区域负责人";
  if (/硬件|智算|半导体|芯片|服务器/.test(text)) return "硬件/智算/半导体行业销售";
  if (/SaaS|应用/.test(text)) return "SaaS/应用销售";
  if (/大客户|行业|KA/.test(text)) return "大客户/行业销售经理";
  if (/大模型|AI软件|AI销售/.test(text)) return "AI软件/大模型销售";
  return text || "销售/商务";
}

function gateFor(gateRows, segment, topic) {
  return gateRows.find((row) => row.segment === segment && row.conclusionTopic === topic) || {};
}

function permissionShort(permission) {
  if (!permission) return "未生成";
  if (permission.includes("不能")) return "不能下结论";
  if (permission.includes("公开薪资")) return "公开薪资假设";
  if (permission.includes("公开信号")) return "公开信号假设";
  if (permission.includes("方向性")) return "BOSS方向观察";
  if (permission.includes("能力趋势")) return "能力趋势假设";
  if (permission.includes("公司池")) return "公司池/采样计划";
  return permission;
}

function decisionScore(row) {
  const priority = /P0/.test(row.priority || "") ? 60 : /P1/.test(row.priority || "") ? 35 : 20;
  const salary = Math.min(30, numberOf(row.salaryMaxK) / 3);
  const evidence = Math.min(20, numberOf(row.salaryEvidenceCount) * 2);
  const samplePenalty = Math.min(20, numberOf(row.sampleGap));
  return Math.round(priority + salary + evidence - samplePenalty);
}

function decisionLabel(row) {
  const score = numberOf(row.decisionScore);
  if (score >= 80) return "优先投递/优先补样";
  if (score >= 60) return "重点观察";
  if (score >= 40) return "补样后判断";
  return "低优先级观察";
}

function sampleAction(segment, role, companyRows, fallback) {
  const family = roleFamily(role);
  const rows = companyRows
    .filter((row) => row.segment === segment)
    .filter((row) => {
      const terms = `${row.nextRole || ""} ${row.recommendedRoles || ""}`;
      if (family === "售前/解决方案顾问") return /售前|解决方案|顾问/.test(terms);
      if (family === "渠道/生态/伙伴销售") return /渠道|生态|伙伴/.test(terms);
      if (family === "销售管理/区域负责人") return /经理|总监|负责人|管理/.test(terms);
      if (family === "硬件/智算/半导体行业销售") return /大客户|行业|渠道|售前|销售/.test(terms);
      return /销售|商务|大客户|行业|AI/.test(terms);
    })
    .sort((a, b) => numberOf(b.sampleGap) - numberOf(a.sampleGap))
    .slice(0, 4);
  if (rows.length) return `优先补 ${rows.map((row) => `${row.company}/${row.nextRole}`).join("；")}`;
  return fallback || "按BOSS目标公司采样缺口看板补样。";
}

function resumeActionFor(segment, role, resumeGapRows) {
  const family = roleFamily(role);
  const direct = resumeGapRows.find((row) => row.segment === segment && roleFamily(row.role) === family);
  const segmentFallback = resumeGapRows.find((row) => row.segment === segment);
  return direct?.resumeActions || segmentFallback?.resumeActions || "补真实项目证据：客户、金额、周期、动作、结果。";
}

function proofForCapabilities(capabilities, resumeEvidenceRows) {
  const capabilitySet = splitTerms(capabilities);
  const rows = resumeEvidenceRows.filter((row) => capabilitySet.includes(row.capability));
  return topJoined(rows.map((row) => row.proofObject), 4, "；");
}

function applicantPositioning(segment, role) {
  const family = roleFamily(role);
  if (/基座大模型|Agent/.test(segment) && family.includes("AI软件")) return "大模型产品语言 + ToB销售闭环";
  if (/基座大模型|Agent/.test(segment) && family.includes("售前")) return "Agent/RAG/MaaS方案表达 + Demo/POC推进";
  if (/云计算/.test(segment)) return "云/MaaS行业客户经营 + 售前协同";
  if (/AI芯片|GPU|半导体/.test(segment)) return "硬件/算力生态理解 + 政企/云/IDC客户";
  if (/AI服务器|智算/.test(segment)) return "智算项目型销售 + 渠道/交付/招投标协同";
  if (/工业AI|智能制造/.test(segment)) return "制造业场景理解 + 工业方案销售";
  if (/智能客服|营销|销售AI/.test(segment)) return "SaaS销售 + 客户成功/续费增购";
  if (family.includes("销售管理")) return "区域经营 + 团队管理 + 销售过程指标";
  return "AI场景理解 + 方案表达 + 商务闭环";
}

function riskBoundary(evidenceLevel, permission) {
  if (/BOSS方向/.test(permission)) return "可写方向观察，不能外推全市场。";
  if (/公开薪资|公开信号|能力趋势/.test(permission)) return "只写公开信号假设，必须标注待BOSS样本校验。";
  if (/弱|不足|需BOSS校验/.test(evidenceLevel || "")) return "样本不足，不能写成确定薪资或普遍要求。";
  return "仍需结合岗位详情人工复核。";
}

const deliveryRows = readCsv(deliveryPath);
const compensationRows = readCsv(compensationPath);
const companyTypeRows = readCsv(companyTypePath);
const companyRows = readCsv(companySamplingPath);
const gateRows = readCsv(conclusionGatePath);
const resumeEvidenceRows = readCsv(resumeEvidencePath);
const resumeGapRows = readCsv(resumeGapPath);

const matrixRows = compensationRows.map((row) => {
  const delivery = deliveryRows.find((item) => item.segment === row.segment) || {};
  const companyType = companyTypeRows.find((item) => item.segment === row.segment) || {};
  const salaryGate = gateFor(gateRows, row.segment, "薪资待遇");
  const capabilityGate = gateFor(gateRows, row.segment, "能力要求");
  const positionGate = gateFor(gateRows, row.segment, "岗位定位");
  const family = roleFamily(row.role);
  const companyGap = companyRows
    .filter((item) => item.segment === row.segment)
    .reduce((sum, item) => sum + numberOf(item.sampleGap), 0);
  const base = {
    priority: row.priority || delivery.priority,
    route: row.route || delivery.route,
    segment: row.segment,
    companyFamily: delivery.companyType || companyType.companyType,
    productSold: companyType.productSold || "",
    roleFamily: family,
    role: row.role,
    salaryBand: row.salaryBand,
    salaryMinK: row.salaryMinK,
    salaryMaxK: row.salaryMaxK,
    salaryEvidenceCount: row.salaryEvidenceCount,
    evidenceLevel: row.evidenceLevel,
    positionPermission: permissionShort(positionGate.conclusionPermission),
    salaryPermission: permissionShort(salaryGate.conclusionPermission),
    capabilityPermission: permissionShort(capabilityGate.conclusionPermission),
    topCompanies: row.topCompanies,
    buyerProfiles: delivery.buyerProfiles || companyType.buyerProfiles,
    salesMotion: companyType.salesMotion,
    coreCapabilities: row.coreCapabilities || delivery.coreCapabilities,
    mustHaveGate: row.mustHaveGate || delivery.mustHaveGate,
    requiredResumeProof: proofForCapabilities(row.coreCapabilities || delivery.coreCapabilities, resumeEvidenceRows),
    sampleProgress: row.sampleProgress || delivery.sampleProgress,
    sampleGap: row.sampleGap || delivery.sampleGap,
    companySampleGap: companyGap,
    applicantPositioning: applicantPositioning(row.segment, row.role),
    nextBossAction: sampleAction(row.segment, row.role, companyRows, row.nextAction),
    nextResumeAction: resumeActionFor(row.segment, row.role, resumeGapRows)
  };
  base.decisionScore = decisionScore(base);
  base.decisionLabel = decisionLabel(base);
  base.riskBoundary = riskBoundary(base.evidenceLevel, `${base.positionPermission}${base.salaryPermission}${base.capabilityPermission}`);
  return base;
}).sort((a, b) => numberOf(b.decisionScore) - numberOf(a.decisionScore));

const roleSummaryRows = [...new Set(matrixRows.map((row) => row.roleFamily))].map((role) => {
  const rows = matrixRows.filter((row) => row.roleFamily === role);
  const maxSalary = Math.max(...rows.map((row) => numberOf(row.salaryMaxK)));
  const topRows = rows.slice().sort((a, b) => numberOf(b.decisionScore) - numberOf(a.decisionScore)).slice(0, 4);
  return {
    roleFamily: role,
    rowCount: rows.length,
    maxSalary,
    topSegments: topJoined(topRows.map((row) => row.segment), 4),
    topCompanies: topJoined(topRows.flatMap((row) => splitTerms(row.topCompanies)), 8),
    coreCapabilities: topJoined(rows.flatMap((row) => splitTerms(row.coreCapabilities)), 8)
  };
}).sort((a, b) => b.maxSalary - a.maxSalary || b.rowCount - a.rowCount);

const companyFamilySummaryRows = [...new Set(matrixRows.map((row) => row.segment))].map((segment) => {
  const rows = matrixRows.filter((row) => row.segment === segment);
  const maxSalary = Math.max(...rows.map((row) => numberOf(row.salaryMaxK)));
  const topRows = rows.slice().sort((a, b) => numberOf(b.decisionScore) - numberOf(a.decisionScore)).slice(0, 3);
  return {
    segment,
    companyFamily: rows[0]?.companyFamily || "",
    topRoles: topJoined(topRows.map((row) => row.roleFamily), 4),
    maxSalary,
    companySampleGap: rows[0]?.companySampleGap || 0,
    applicantPositioning: topJoined(topRows.map((row) => row.applicantPositioning), 3, "；")
  };
}).sort((a, b) => numberOf(b.maxSalary) - numberOf(a.maxSalary));

const headers = [
  "decisionScore",
  "decisionLabel",
  "priority",
  "route",
  "segment",
  "companyFamily",
  "productSold",
  "roleFamily",
  "role",
  "salaryBand",
  "salaryMinK",
  "salaryMaxK",
  "salaryEvidenceCount",
  "evidenceLevel",
  "positionPermission",
  "salaryPermission",
  "capabilityPermission",
  "topCompanies",
  "buyerProfiles",
  "salesMotion",
  "coreCapabilities",
  "mustHaveGate",
  "requiredResumeProof",
  "sampleProgress",
  "sampleGap",
  "companySampleGap",
  "applicantPositioning",
  "nextBossAction",
  "nextResumeAction",
  "riskBoundary"
];

const topMatrixMdRows = matrixRows.slice(0, 20).map((row, index) => {
  return `| ${index + 1} | ${row.decisionLabel} | ${row.segment} | ${row.roleFamily} | ${row.salaryBand} | ${row.topCompanies} | ${row.coreCapabilities} | ${row.nextBossAction} |`;
});

const roleSummaryMdRows = roleSummaryRows.map((row) => {
  return `| ${row.roleFamily} | ${row.rowCount} | ${row.maxSalary || "-"}K | ${row.topSegments} | ${row.topCompanies} | ${row.coreCapabilities} |`;
});

const companySummaryMdRows = companyFamilySummaryRows.map((row, index) => {
  return `| ${index + 1} | ${row.segment} | ${row.companyFamily} | ${row.topRoles} | ${row.maxSalary || "-"}K | ${row.companySampleGap} | ${row.applicantPositioning} |`;
});

const md = `# AI销售岗位公司类型岗位族交叉看板

更新时间：${formatDateTime()}

## 一、本质判断

这张表解决的是“知道赛道以后，到底投什么岗位”的问题。它不是新增 BOSS 采集，而是把现有赛道、公司类型、岗位族、薪资信号、能力门槛、结论权限和补样动作压成一个投递/补样决策矩阵。

当前结论边界仍然不变：BOSS干净样本不足，所有薪资和岗位族判断都必须标注为公开信号假设或方向性观察，不能写成平台大样本结论。

## 二、岗位族优先级

| 岗位族 | 覆盖组合 | 薪资上限信号 | 重点赛道 | 代表公司 | 核心能力 |
| --- | ---: | ---: | --- | --- | --- |
${mdRows(roleSummaryMdRows, "| 暂无 | 0 | - |  |  |  |")}

## 三、公司类型×岗位族交叉优先级

| 排名 | 决策 | 赛道 | 岗位族 | 薪资信号 | 代表公司 | 核心能力 | 下一步BOSS动作 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
${mdRows(topMatrixMdRows, "| - | 暂无 |  |  |  |  |  |  |")}

## 四、公司类型视角

| 排名 | 赛道 | 公司类型 | 优先岗位族 | 薪资上限信号 | 公司样本缺口 | 候选人定位 |
| ---: | --- | --- | --- | ---: | ---: | --- |
${mdRows(companySummaryMdRows, "| - | 暂无 |  |  | - | 0 |  |")}

## 五、使用方式

1. 如果要冲高薪，优先看薪资上限 60K-70K 的大模型软件、AI芯片/半导体、智能汽车/具身智能、云/MaaS 岗位。
2. 如果要提高匹配概率，优先选与你已有经历最接近的岗位族：ToB销售转 AI软件，大客户转云/工业AI/硬件，渠道转芯片/服务器/生态。
3. 如果要改简历，先按矩阵里的核心能力补证据：行业场景、大客户、AI产品理解、回款合同、方案宣讲、跨部门协同。
4. 如果要补样，按“下一步BOSS动作”手动复制岗位详情并导入，不自动打开 BOSS。

输出 CSV：${outputCsvPath}
`;

mkdirSync(dirname(outputMdPath), { recursive: true });
writeFileSync(outputCsvPath, `${csv([headers, ...matrixRows.map((row) => headers.map((header) => row[header]))])}\n`);
writeFileSync(outputMdPath, md);

console.log(`已生成：${outputMdPath}`);
console.log(`已生成：${outputCsvPath}`);
console.log(`交叉组合：${matrixRows.length}`);
console.log(`岗位族：${roleSummaryRows.length}`);
