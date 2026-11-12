#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const opportunityPath = join(projectRoot, "01_行情收集/AI细分赛道销售机会矩阵.csv");
const publicEvidencePath = join(projectRoot, "01_行情收集/AI公开招聘薪资证据库.csv");
const bossLocalCacheEvidencePath = join(projectRoot, "01_行情收集/BOSS历史缓存候选线索库.csv");
const hardwareSpecialReportPath = join(projectRoot, "01_行情收集/AI硬件算力半导体销售岗位专项分析.csv");
const hardwarePriorityQueuePath = join(projectRoot, "01_行情收集/BOSS硬件算力半导体优先采样清单.csv");
const companyTypeMatrixPath = join(projectRoot, "00_行业资料集/AI销售公司类型岗位打法对照表.csv");
const companyPlaybookPath = join(projectRoot, "00_行业资料集/AI目标公司销售岗位打法清单.csv");
const resumeEvidencePath = join(projectRoot, "03_简历/AI销售能力证据与简历改写矩阵.csv");
const jobsPath = join(projectRoot, "01_行情收集/data/jobs.jsonl");
const outputMdPath = join(projectRoot, "01_行情收集/AI销售岗位全行业决策手册.md");
const outputCsvPath = join(projectRoot, "01_行情收集/AI销售岗位全行业决策手册.csv");

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

function readBossJobCount(filePath) {
  if (!existsSync(filePath)) return 0;
  return readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => {
      try {
        const job = JSON.parse(line);
        return !job.source || job.source === "BOSS直聘";
      } catch {
        return false;
      }
    }).length;
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function csv(rows) {
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

function markdownRows(rows, emptyRow) {
  return rows.length ? rows.join("\n") : emptyRow;
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

function splitTerms(value) {
  return String(value || "")
    .split(/[;；、]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function topJoined(values, limit = 6, separator = "、") {
  return [...new Set(values.filter(Boolean))].slice(0, limit).join(separator);
}

function numberOf(value) {
  const num = Number.parseFloat(String(value || "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(num) ? num : 0;
}

function priorityRank(priority) {
  if (/P0/.test(priority || "")) return 3;
  if (/P1/.test(priority || "")) return 2;
  if (/P2/.test(priority || "")) return 1;
  return 0;
}

function salaryStats(rows) {
  const salaryRows = rows.filter((row) => numberOf(row.salaryMaxK));
  if (!salaryRows.length) return { count: 0, max: "", examples: "" };
  return {
    count: salaryRows.length,
    max: Math.max(...salaryRows.map((row) => numberOf(row.salaryMaxK))),
    examples: topJoined(salaryRows.slice(0, 4).map((row) => `${row.companyOrPage}/${row.role}/${row.salaryRaw}`), 4, "；")
  };
}

function evidenceSummary(rows) {
  if (!rows.length) return "无公开招聘薪资证据";
  const strong = rows.filter((row) => Number(row.evidenceScore || 0) >= 85).length;
  const salary = rows.filter((row) => numberOf(row.salaryMaxK)).length;
  return `${rows.length}条公开证据，${salary}条可解析薪资，${strong}条强证据`;
}

function companyRowsForSegment(rows, segment, limit = 6) {
  return rows
    .filter((row) => row.segment === segment)
    .sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority) || numberOf(b.score) - numberOf(a.score))
    .slice(0, limit);
}

function routeAdvice(route) {
  if (/硬件/.test(route)) return "适合有政企/大客户、硬件链路、渠道生态、项目推进和交付协同证据的人优先投。";
  if (/行业解决方案/.test(route)) return "适合能讲清行业场景、客户痛点、方案/POC、跨部门推进和ROI的人优先投。";
  if (/软件/.test(route)) return "适合能讲AI产品价值、ToB销售、方案表达、商机漏斗和商务闭环的人优先投。";
  return "先用岗位样本校验，再判断是否主投。";
}

function samplingAdvice(row) {
  const gap = numberOf(row.sampleGap);
  if (gap >= 10) return "优先补2-3条BOSS人工样本，再判断是否扩大投递";
  if (gap >= 5) return "继续补样本，重点校验薪资和能力门槛";
  return "已有少量样本，可进入简历匹配和公司筛选";
}

const opportunityRows = readCsvIfExists(opportunityPath);
const publicEvidenceRows = readCsvIfExists(publicEvidencePath);
const bossLocalCacheEvidenceRows = readCsvIfExists(bossLocalCacheEvidencePath);
const hardwareSpecialRows = readCsvIfExists(hardwareSpecialReportPath);
const hardwarePriorityRows = readCsvIfExists(hardwarePriorityQueuePath);
const companyTypeRows = readCsvIfExists(companyTypeMatrixPath);
const companyPlaybookRows = readCsvIfExists(companyPlaybookPath);
const resumeEvidenceRows = readCsvIfExists(resumeEvidencePath);
const bossSampleCount = readBossJobCount(jobsPath);

const handbookRows = opportunityRows.map((row) => {
  const segmentEvidence = publicEvidenceRows.filter((item) => item.segment === row.segment);
  const segmentCompanies = companyRowsForSegment(companyPlaybookRows, row.segment);
  const salary = salaryStats(segmentEvidence);
  const coreCapabilities = splitTerms(row.coreCapabilities).slice(0, 6);
  const evidenceCapabilities = resumeEvidenceRows
    .filter((item) => coreCapabilities.includes(item.capability))
    .sort((a, b) => numberOf(b.demandScore) - numberOf(a.demandScore));
  const decisionScore = numberOf(row.score)
    + salary.count * 3
    + numberOf(salary.max) * 1.2
    - numberOf(row.sampleGap) * 2;
  return {
    decisionRank: 0,
    decisionScore: Math.round(decisionScore),
    priority: row.priority,
    route: row.route,
    segment: row.segment,
    companyType: row.companyType,
    whyThisSegment: row.marketDirection || row.salesMotion,
    buyerProfiles: row.buyerProfiles,
    topCompanies: row.topCompanies,
    p0Companies: topJoined(segmentCompanies.map((item) => item.company), 8),
    firstRoles: topJoined(segmentCompanies.map((item) => item.firstRole), 6),
    roleFocus: row.roleFocus,
    salaryBand: row.salaryBand,
    publicSalaryMaxK: salary.max ? `${salary.max}K` : "",
    publicSalaryExamples: salary.examples,
    evidenceSummary: evidenceSummary(segmentEvidence),
    evidenceLevel: row.evidenceLevel,
    coreCapabilities: coreCapabilities.join(";"),
    resumeEvidence: row.resumeEvidence,
    requiredResumeProof: topJoined(evidenceCapabilities.map((item) => item.proofObject), 4, "；"),
    mustHaveGate: row.mustHaveGate,
    bossSampleGap: row.sampleGap,
    risk: row.risk,
    bossValidationAction: row.nextAction,
    samplingAdvice: samplingAdvice(row),
    routeAdvice: routeAdvice(row.route),
    evidenceBoundary: row.evidenceBoundary
  };
}).sort((a, b) => numberOf(b.decisionScore) - numberOf(a.decisionScore));

handbookRows.forEach((row, index) => {
  row.decisionRank = index + 1;
});

const roleSalaryRows = [...new Map(publicEvidenceRows.map((row) => [row.roleFamily, true])).keys()]
  .filter(Boolean)
  .map((roleFamily) => {
    const rows = publicEvidenceRows.filter((row) => row.roleFamily === roleFamily);
    const salary = salaryStats(rows);
    const segments = topJoined(rows.map((row) => row.segment), 5);
    return { roleFamily, count: rows.length, salaryMaxK: salary.max, segments, examples: salary.examples };
  })
  .sort((a, b) => numberOf(b.salaryMaxK) - numberOf(a.salaryMaxK) || b.count - a.count);

const routeRows = [...new Map(handbookRows.map((row) => [row.route, true])).keys()].map((route) => {
  const rows = handbookRows.filter((row) => row.route === route);
  return {
    route,
    topSegments: topJoined(rows.slice(0, 4).map((row) => row.segment), 4),
    salaryMaxK: Math.max(...rows.map((row) => numberOf(row.publicSalaryMaxK || row.salaryMaxK || row.salaryBand))),
    capabilities: topJoined(rows.flatMap((row) => splitTerms(row.coreCapabilities)), 8),
    advice: routeAdvice(route)
  };
});

const hardwareSpecialTableRows = hardwareSpecialRows.map((row, index) => {
  return `| ${index + 1} | ${row.segment} | ${row.routeLayer} | ${row.companyCount} | ${row.p0Companies || row.topCompanies} | ${row.primaryRoles} | ${row.salaryBand} | ${row.publicSalaryMaxK || "-"} | ${row.bossCleanSamples || 0} | ${row.sampleGap || 0} | ${row.nextAction} |`;
});

const hardwareQueueTableRows = hardwarePriorityRows.slice(0, 10).map((row) => {
  return `| ${row.rank} | ${row.priority} | ${row.segment} | ${row.company} | ${row.role} | ${row.salaryBand || "-"} | ${row.sourceQueue} |`;
});

const companyTypeTableRows = companyTypeRows.slice(0, 12).map((row) => {
  return `| ${row.rank} | ${row.route} | ${row.segment} | ${row.companyType} | ${row.productSold} | ${row.companyExamples} | ${row.roleFocus} | ${row.salaryBand} | ${row.sampleProgress || "0/0"} | ${row.routeAdvice} |`;
});

const userCompanies = ["月之暗面", "智谱AI", "MiniMax", "寒武纪", "海光信息", "超聚变", "商汤科技", "百度智能云", "第四范式", "创新奇智"];
const userCompanyRows = companyPlaybookRows.filter((row) => userCompanies.includes(row.company));

const headers = [
  "decisionRank",
  "decisionScore",
  "priority",
  "route",
  "segment",
  "companyType",
  "whyThisSegment",
  "buyerProfiles",
  "topCompanies",
  "p0Companies",
  "firstRoles",
  "roleFocus",
  "salaryBand",
  "publicSalaryMaxK",
  "publicSalaryExamples",
  "evidenceSummary",
  "evidenceLevel",
  "coreCapabilities",
  "resumeEvidence",
  "requiredResumeProof",
  "mustHaveGate",
  "bossSampleGap",
  "risk",
  "bossValidationAction",
  "samplingAdvice",
  "routeAdvice",
  "evidenceBoundary"
];

const md = `# AI销售岗位全行业决策手册

更新时间：${formatDate()}

## 一、本质判断

这份手册不是再做一张清单，而是把目前已有的赛道、公司、岗位、薪资、能力和简历证据合成一个求职决策系统。它回答：AI销售岗位到底分哪几条路线、哪些赛道先看、哪些公司优先看、薪资上限在哪里、简历要证明什么、BOSS还需要补哪些样本。

当前最大约束是：BOSS干净岗位样本只有 ${bossSampleCount} 条；另有 ${bossLocalCacheEvidenceRows.length} 条 BOSS 历史缓存候选，但候选需人工复核后才能进入正式样本。所以本手册是“公开证据 + 公司池 + 采样计划 + 少量BOSS样本 + 历史缓存候选”的阶段性决策版，不能替代最终 BOSS 大样本结论。

## 二、当前证据基座

| 证据层 | 当前数量 | 用途 | 边界 |
| --- | ---: | --- | --- |
| 细分赛道机会矩阵 | ${opportunityRows.length} 个赛道 | 决定主攻路线和采样优先级 | 需BOSS样本校验 |
| 公开招聘薪资证据 | ${publicEvidenceRows.length} 条 | 补充薪资、岗位族、能力信号 | 公开页面/搜索信号，不等于岗位详情 |
| BOSS历史缓存候选 | ${bossLocalCacheEvidenceRows.length} 条 | 在不新增访问BOSS的情况下筛出人工复核对象 | 候选不是干净样本，需人工复核 |
| 硬件/算力/半导体专项 | ${hardwareSpecialRows.length} 个赛道 | 单独拆解芯片、服务器、智算、智能硬件、工业AI | 阶段性专项，需BOSS干净样本校验 |
| 硬件方向优先采样 | ${hardwarePriorityRows.length} 条 | 给硬件/半导体方向下一批人工复核入口 | 不自动打开BOSS |
| 公司类型岗位打法对照 | ${companyTypeRows.length} 个赛道 | 解释不同AI公司卖什么、客户是谁、销售动作是什么 | 阶段性公司类型判断，需BOSS样本校验 |
| 目标公司打法清单 | ${companyPlaybookRows.length} 家公司 | 决定公司名+岗位词采样顺序 | 公司池假设，需验证在招状态 |
| 简历能力证据矩阵 | ${resumeEvidenceRows.length} 项能力 | 把市场要求转成简历证据 | 需填入真实个人项目 |
| BOSS干净岗位样本 | ${bossSampleCount} 条 | 平台实证样本 | 当前不足，不能宣布大样本完成 |

## 三、三条主攻路线

| 路线 | 优先赛道 | 公开薪资上限观察 | 核心能力 | 适合什么人 |
| --- | --- | ---: | --- | --- |
${routeRows.map((row) => `| ${row.route} | ${row.topSegments} | ${row.salaryMaxK || "-"}K | ${row.capabilities} | ${row.advice} |`).join("\n")}

## 四、硬件/算力/半导体专项判断

你点名关注的芯片、半导体、AI服务器、智算、智能硬件和制造业AI，不适合只放在泛 AI 销售表里看。它的销售动作更偏项目型、大客户、渠道生态和交付协同，所以单独作为一条主线跟踪。

| 排名 | 赛道 | 产业位置 | 公司数 | 优先公司 | 典型岗位 | 薪资观察 | 公开薪资上限 | BOSS干净样本 | 样本缺口 | 下一步 |
| ---: | --- | --- | ---: | --- | --- | --- | ---: | ---: | ---: | --- |
${markdownRows(hardwareSpecialTableRows, "| 1 | 暂无 |  | 0 |  |  |  | - | 0 | 0 |  |")}

| 优先级排序 | 优先级 | 赛道 | 公司 | 岗位词 | 薪资观察 | 来源队列 |
| ---: | --- | --- | --- | --- | --- | --- |
${markdownRows(hardwareQueueTableRows, "| 1 | 暂无 |  |  |  |  |  |")}

## 五、公司类型怎么选

| 排名 | 路线 | 赛道 | 公司类型 | 主要卖什么 | 代表公司 | 首看岗位 | 薪资观察 | 样本进度 | 投递建议 |
| ---: | --- | --- | --- | --- | --- | --- | --- | ---: | --- |
${markdownRows(companyTypeTableRows, "| 1 | 暂无 |  |  |  |  |  |  | 0/0 |  |")}

## 六、全行业赛道决策总表

| 排名 | 优先级 | 路线 | 赛道 | 公司类型 | 代表公司 | 首看岗位 | 薪资观察 | 公开薪资上限 | 证据状态 | 核心能力 | BOSS缺口 | 下一步 |
| ---: | --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- | ---: | --- |
${handbookRows.map((row) => `| ${row.decisionRank} | ${row.priority} | ${row.route} | ${row.segment} | ${row.companyType} | ${row.p0Companies || row.topCompanies} | ${row.firstRoles || row.roleFocus} | ${row.salaryBand} | ${row.publicSalaryMaxK || "-"} | ${row.evidenceSummary} | ${topJoined(splitTerms(row.coreCapabilities), 5)} | ${row.bossSampleGap} | ${row.samplingAdvice} |`).join("\n")}

## 七、岗位族薪资观察

| 岗位族 | 公开证据数 | 最高月薪观察 | 重点赛道 | 示例 |
| --- | ---: | ---: | --- | --- |
${roleSalaryRows.map((row) => `| ${row.roleFamily} | ${row.count} | ${row.salaryMaxK || "-"}K | ${row.segments} | ${row.examples} |`).join("\n")}

## 八、你点名公司的投递打法

| 公司 | 赛道 | 公司定位 | 首看岗位 | 薪资假设 | 简历贴合点 | BOSS校验动作 |
| --- | --- | --- | --- | --- | --- | --- |
${userCompanyRows.map((row) => `| ${row.company} | ${row.segment} | ${row.companyPosition} | ${row.firstRole} | ${row.salaryObservation} | ${row.resumePositioning || row.coreCapabilities} | ${row.nextAction} |`).join("\n")}

## 九、简历必须优先补的证据

| 优先级 | 能力 | 薪资上限关联 | 高价值岗位 | 必须证明什么 | 量化指标 |
| --- | --- | ---: | --- | --- | --- |
${resumeEvidenceRows.slice(0, 10).map((row) => `| ${row.priority} | ${row.capability} | ${row.salaryMaxK || "-"}K | ${row.highValueRoles} | ${row.proofObject} | ${row.metricsToCollect} |`).join("\n")}

## 十、下一步执行顺序

1. 先补 BOSS 人工样本，不要自动刷新：基座大模型/Agent、云/MaaS、AI芯片/GPU、AI服务器/智算、工业AI各补 2 到 3 条。
2. 每条样本必须包含岗位名、公司、薪资、职责、要求、城市、链接或来源。
3. 每补 10 条样本后刷新：\`evidence:boss-cache\`、\`salary:signals\`、\`matrix:roles\`、\`compensation:analysis\`、\`opportunity:matrix\`、\`company:type\`、\`hardware:market\`、\`evidence:resume\`、\`handbook:market\`。
4. 简历先补五类证据：大客户、AI产品理解、方案/POC、回款闭环、行业场景。
5. 等 BOSS 干净样本达到 20 到 30 条，再把“阶段性判断”升级为“BOSS实证结论”。

## 十一、输出文件

\`\`\`text
${outputCsvPath}
\`\`\`
`;

writeFileSync(outputMdPath, md);
writeFileSync(outputCsvPath, `${csv([headers, ...handbookRows.map((row) => headers.map((header) => row[header]))])}\n`);

console.log(`已生成：${outputMdPath}`);
console.log(`已生成：${outputCsvPath}`);
console.log(`赛道决策行：${handbookRows.length}`);
console.log(`公开招聘薪资证据：${publicEvidenceRows.length}`);
