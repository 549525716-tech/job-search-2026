#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const companyProfilePath = join(projectRoot, "00_行业资料集/AI销售目标公司分层画像.csv");
const opportunityPath = join(projectRoot, "01_行情收集/AI细分赛道销售机会矩阵.csv");
const handbookPath = join(projectRoot, "01_行情收集/AI销售岗位全行业决策手册.csv");
const sampleGapPath = join(projectRoot, "01_行情收集/BOSS全行业样本缺口路线图.csv");
const publicEvidencePath = join(projectRoot, "01_行情收集/AI公开招聘薪资证据库.csv");
const resumeEvidencePath = join(projectRoot, "03_简历/AI销售能力证据与简历改写矩阵.csv");

const outputMdPath = join(projectRoot, "00_行业资料集/AI销售公司类型岗位打法对照表.md");
const outputCsvPath = join(projectRoot, "00_行业资料集/AI销售公司类型岗位打法对照表.csv");

const productMap = {
  "基座大模型/Agent平台": "大模型能力、Agent平台、API/MaaS、企业知识库、行业智能体",
  "云计算/大模型平台": "云资源、MaaS平台、算力服务、模型服务、行业云解决方案",
  "智能客服/营销/销售AI": "智能客服、营销自动化、销售AI、AI外呼、客户体验SaaS",
  "AI芯片/GPU/加速卡": "AI芯片、GPU、加速卡、推理/训练硬件、昇腾生态设备",
  "AI服务器/智算基础设施": "AI服务器、液冷服务器、算力集群、企业IT基础设施",
  "智算中心/数据中心服务": "IDC资源、智算中心、算力租赁、网络互联、运维服务",
  "工业AI/智能制造": "工业AI、工业视觉、质检、排产、设备/产线数字化方案",
  "智能汽车/机器人/具身智能": "自动驾驶方案、激光雷达、机器人、端侧智能硬件",
  "AI视觉/安防/质检": "视觉算法、安防平台、工业质检、园区/产线视觉方案",
  "AI Agent/RPA/流程自动化": "RPA、企业Agent、流程自动化、智能办公/运营工具",
  "数据/MLOps/AI基础软件": "数据平台、向量数据库、MLOps、特征平台、AI基础软件",
  "AI安全/私有化/信创": "AI安全、私有化部署、信创适配、安全合规和政企解决方案"
};

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

function splitTerms(value) {
  return String(value || "")
    .split(/[;；、]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function topJoined(values, limit = 6, separator = "、") {
  return [...new Set(values.filter(Boolean))].slice(0, limit).join(separator);
}

function salaryStats(rows) {
  const withSalary = rows.filter((row) => numberOf(row.salaryMaxK));
  if (!withSalary.length) return { count: 0, max: "", examples: "" };
  return {
    count: withSalary.length,
    max: Math.max(...withSalary.map((row) => numberOf(row.salaryMaxK))),
    examples: topJoined(withSalary.slice(0, 3).map((row) => `${row.companyOrPage}/${row.role}/${row.salaryRaw}`), 3, "；")
  };
}

function priorityRank(priority) {
  if (/P0/.test(priority || "")) return 3;
  if (/P1/.test(priority || "")) return 2;
  if (/P2/.test(priority || "")) return 1;
  return 0;
}

function routeAdvice(route) {
  if (/硬件/.test(route || "")) return "优先强调硬件/算力链路、政企/云/IDC大客户、渠道生态、项目交付和回款。";
  if (/行业解决方案/.test(route || "")) return "优先强调行业场景、客户痛点、方案/POC、ROI表达和跨部门交付。";
  if (/AI软件/.test(route || "")) return "优先强调AI产品理解、ToB销售、业务场景拆解、方案表达和商机闭环。";
  return "先补BOSS岗位样本，再判断简历主线。";
}

function mdRows(rows, fallback) {
  return rows.length ? rows.join("\n") : fallback;
}

const companyProfiles = readCsv(companyProfilePath);
const opportunityRows = readCsv(opportunityPath);
const handbookRows = readCsv(handbookPath);
const sampleGapRows = readCsv(sampleGapPath);
const publicEvidenceRows = readCsv(publicEvidencePath);
const resumeEvidenceRows = readCsv(resumeEvidencePath);

const matrixRows = companyProfiles.map((profile) => {
  const segment = profile.segment;
  const opportunity = opportunityRows.find((row) => row.segment === segment) || {};
  const handbook = handbookRows.find((row) => row.segment === segment) || {};
  const sample = sampleGapRows.find((row) => row.segment === segment) || {};
  const evidence = publicEvidenceRows.filter((row) => row.segment === segment);
  const salary = salaryStats(evidence);
  const coreCapabilities = splitTerms(handbook.coreCapabilities || opportunity.coreCapabilities || profile.capabilityFocus);
  const resumeProof = resumeEvidenceRows
    .filter((row) => coreCapabilities.includes(row.capability))
    .sort((a, b) => numberOf(b.demandScore) - numberOf(a.demandScore))
    .slice(0, 3)
    .map((row) => row.proofObject);
  const decisionScore = numberOf(handbook.decisionScore || opportunity.score)
    + priorityRank(handbook.priority || opportunity.priority) * 20
    + numberOf(salary.max)
    - numberOf(sample.sampleGap || profile.sampleGap);

  return {
    rank: 0,
    decisionScore: Math.round(decisionScore),
    priority: handbook.priority || opportunity.priority || "",
    route: handbook.route || opportunity.route || "",
    segment,
    companyType: profile.companyType,
    productSold: productMap[segment] || "AI产品/解决方案",
    companyExamples: profile.topCompanies,
    p0Companies: handbook.p0Companies || profile.nextSamplingCompanies,
    buyerProfiles: profile.buyerProfiles,
    salesMotion: profile.salesMotion,
    whySalesExists: profile.whySalesExists,
    roleFocus: handbook.firstRoles || profile.roleFocus,
    salaryBand: handbook.salaryBand || opportunity.salaryBand || profile.salaryObservation,
    publicSalaryMaxK: salary.max ? `${salary.max}K` : (handbook.publicSalaryMaxK || ""),
    salaryEvidenceCount: salary.count,
    salaryExamples: salary.examples,
    coreCapabilities: coreCapabilities.slice(0, 8).join(";"),
    mustHaveGate: handbook.mustHaveGate || opportunity.mustHaveGate || "",
    resumePositioning: profile.resumePositioning || handbook.resumeEvidence || "",
    requiredResumeProof: resumeProof.join("；"),
    sampleProgress: sample.targetSamples ? `${sample.importedJobs || 0}/${sample.targetSamples}` : "",
    sampleGap: sample.sampleGap || profile.sampleGap || "",
    decisionGate: sample.decisionGate || "",
    nextAction: sample.nextTaskList || profile.nextAction || handbook.bossValidationAction,
    routeAdvice: routeAdvice(handbook.route || opportunity.route),
    evidenceBoundary: handbook.evidenceBoundary || opportunity.evidenceBoundary || "阶段性公司类型判断，需BOSS干净样本校验"
  };
}).sort((a, b) => b.decisionScore - a.decisionScore);

matrixRows.forEach((row, index) => {
  row.rank = index + 1;
});

const headers = [
  "rank",
  "decisionScore",
  "priority",
  "route",
  "segment",
  "companyType",
  "productSold",
  "companyExamples",
  "p0Companies",
  "buyerProfiles",
  "salesMotion",
  "whySalesExists",
  "roleFocus",
  "salaryBand",
  "publicSalaryMaxK",
  "salaryEvidenceCount",
  "salaryExamples",
  "coreCapabilities",
  "mustHaveGate",
  "resumePositioning",
  "requiredResumeProof",
  "sampleProgress",
  "sampleGap",
  "decisionGate",
  "nextAction",
  "routeAdvice",
  "evidenceBoundary"
];

const tableRows = matrixRows.map((row) => {
  return `| ${row.rank} | ${row.priority} | ${row.route} | ${row.segment} | ${row.companyType} | ${row.productSold} | ${row.companyExamples} | ${row.roleFocus} | ${row.salaryBand} | ${row.publicSalaryMaxK || "-"} | ${row.coreCapabilities} | ${row.sampleProgress || "0/0"} | ${row.decisionGate || "-"} |`;
});

const proofRows = matrixRows.slice(0, 12).map((row) => {
  return `| ${row.segment} | ${row.mustHaveGate} | ${row.resumePositioning} | ${row.requiredResumeProof || "-"} | ${row.routeAdvice} |`;
});

mkdirSync(dirname(outputMdPath), { recursive: true });
writeFileSync(outputCsvPath, `${csv([headers, ...matrixRows.map((row) => headers.map((header) => row[header]))])}\n`);

const md = `# AI销售公司类型岗位打法对照表

更新时间：${formatDate()}

## 一、本质判断

这张表回答“这些 AI 公司到底是什么类型、销售岗卖什么、客户是谁、薪资大概在哪、简历要证明什么”。它不是新增结论，而是把公司池、赛道机会、公开薪资、BOSS样本缺口和简历证据合并成一个投递判断表。

当前最大约束是：公司类型判断已经比较完整，但 BOSS 干净样本仍不足，所以这里的薪资和能力门槛仍是阶段性判断，必须继续用 BOSS 岗位详情校验。

## 二、公司类型总表

| 排名 | 优先级 | 路线 | 赛道 | 公司类型 | 主要卖什么 | 代表公司 | 首看岗位 | 薪资观察 | 公开薪资上限 | 核心能力 | 样本进度 | 结论权限 |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- | ---: | --- |
${mdRows(tableRows, "| 1 | 暂无 |  |  |  |  |  |  |  | - |  | 0/0 |  |")}

## 三、简历证明重点

| 赛道 | 硬门槛 | 简历定位 | 必须补的证据 | 投递建议 |
| --- | --- | --- | --- | --- |
${mdRows(proofRows, "| 暂无 |  |  |  |  |")}

## 四、读表方法

1. 如果你要投月之暗面、智谱AI、MiniMax，优先看“基座大模型/Agent平台”：核心是 AI产品理解、场景拆解、解决方案表达、ToB商机推进。
2. 如果你要投芯片/半导体/AI服务器，优先看“AI芯片/GPU/加速卡”和“AI服务器/智算基础设施”：核心是硬件/算力链路、政企/大客户、渠道生态、项目交付。
3. 如果你要投销售管理岗，看每个赛道的销售动作是否需要团队、区域、渠道或大客户经营，不要只看岗位名。
4. 如果样本进度低于 3 条，该赛道不能写成 BOSS 结论，只能作为公开信号和公司池判断。

## 五、输出文件

\`\`\`text
${outputCsvPath}
\`\`\`
`;

writeFileSync(outputMdPath, md);

console.log(`已生成：${outputMdPath}`);
console.log(`已生成：${outputCsvPath}`);
console.log(`公司类型行：${matrixRows.length}`);
