#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const handbookPath = join(projectRoot, "01_行情收集/AI销售岗位全行业决策手册.csv");
const companyTypePath = join(projectRoot, "00_行业资料集/AI销售公司类型岗位打法对照表.csv");
const sampleGapPath = join(projectRoot, "01_行情收集/BOSS全行业样本缺口路线图.csv");
const publicEvidencePath = join(projectRoot, "01_行情收集/AI公开招聘薪资证据库.csv");
const resumeEvidencePath = join(projectRoot, "03_简历/AI销售能力证据与简历改写矩阵.csv");
const cacheEvidencePath = join(projectRoot, "01_行情收集/BOSS历史缓存候选线索库.csv");
const jobsPath = join(projectRoot, "01_行情收集/data/jobs.jsonl");

const outputMdPath = join(projectRoot, "01_行情收集/AI销售岗位全景总览.md");
const outputCsvPath = join(projectRoot, "01_行情收集/AI销售岗位全景总览.csv");

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

function mdRows(rows, fallback) {
  return rows.length ? rows.join("\n") : fallback;
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

function salaryStats(rows) {
  const withSalary = rows.filter((row) => numberOf(row.salaryMaxK));
  if (!withSalary.length) return { count: 0, max: "", examples: "" };
  return {
    count: withSalary.length,
    max: Math.max(...withSalary.map((row) => numberOf(row.salaryMaxK))),
    examples: topJoined(withSalary.slice(0, 4).map((row) => `${row.companyOrPage}/${row.role}/${row.salaryRaw}`), 4, "；")
  };
}

const handbookRows = readCsv(handbookPath);
const companyTypeRows = readCsv(companyTypePath);
const sampleGapRows = readCsv(sampleGapPath);
const publicEvidenceRows = readCsv(publicEvidencePath);
const resumeEvidenceRows = readCsv(resumeEvidencePath);
const cacheEvidenceRows = readCsv(cacheEvidencePath);
const bossSampleCount = readBossJobCount(jobsPath);

const segmentRows = handbookRows.map((row) => {
  const companyType = companyTypeRows.find((item) => item.segment === row.segment) || {};
  const sample = sampleGapRows.find((item) => item.segment === row.segment) || {};
  const evidence = publicEvidenceRows.filter((item) => item.segment === row.segment);
  const salary = salaryStats(evidence);
  return {
    rank: row.decisionRank,
    priority: row.priority,
    route: row.route,
    segment: row.segment,
    companyType: row.companyType || companyType.companyType,
    productSold: companyType.productSold || "",
    companyExamples: row.p0Companies || row.topCompanies || companyType.companyExamples,
    buyerProfiles: row.buyerProfiles || companyType.buyerProfiles,
    roleFocus: row.firstRoles || row.roleFocus || companyType.roleFocus,
    salaryBand: row.salaryBand || companyType.salaryBand,
    publicSalaryMaxK: row.publicSalaryMaxK || (salary.max ? `${salary.max}K` : ""),
    salaryEvidenceCount: salary.count,
    salaryExamples: row.publicSalaryExamples || salary.examples,
    coreCapabilities: row.coreCapabilities || companyType.coreCapabilities,
    mustHaveGate: row.mustHaveGate || companyType.mustHaveGate,
    resumeEvidence: row.resumeEvidence || companyType.resumePositioning,
    sampleProgress: sample.targetSamples ? `${sample.importedJobs || 0}/${sample.targetSamples}` : companyType.sampleProgress || "",
    sampleGap: sample.sampleGap || row.bossSampleGap,
    decisionGate: sample.decisionGate || companyType.decisionGate || "",
    nextAction: sample.nextTaskList || row.bossValidationAction,
    evidenceBoundary: row.evidenceBoundary || companyType.evidenceBoundary
  };
});

const routeRows = [...new Set(segmentRows.map((row) => row.route || "未分类"))].map((route) => {
  const rows = segmentRows.filter((row) => (row.route || "未分类") === route);
  return {
    route,
    segments: rows.length,
    salaryMaxK: Math.max(...rows.map((row) => numberOf(row.publicSalaryMaxK))),
    targetSamples: sampleGapRows
      .filter((row) => (row.route || "未分类") === route)
      .reduce((sum, row) => sum + numberOf(row.targetSamples), 0),
    importedJobs: sampleGapRows
      .filter((row) => (row.route || "未分类") === route)
      .reduce((sum, row) => sum + numberOf(row.importedJobs), 0),
    sampleGap: sampleGapRows
      .filter((row) => (row.route || "未分类") === route)
      .reduce((sum, row) => sum + numberOf(row.sampleGap), 0),
    topSegments: rows.slice(0, 4).map((row) => row.segment).join("、"),
    capabilities: topJoined(rows.flatMap((row) => splitTerms(row.coreCapabilities)), 8)
  };
}).sort((a, b) => b.sampleGap - a.sampleGap);

const roleSalaryRows = [...new Set(publicEvidenceRows.map((row) => row.roleFamily).filter(Boolean))].map((roleFamily) => {
  const rows = publicEvidenceRows.filter((row) => row.roleFamily === roleFamily);
  const salary = salaryStats(rows);
  return {
    roleFamily,
    count: rows.length,
    salaryMaxK: salary.max,
    segments: topJoined(rows.map((row) => row.segment), 5),
    examples: salary.examples
  };
}).sort((a, b) => numberOf(b.salaryMaxK) - numberOf(a.salaryMaxK) || b.count - a.count);

const topCapabilityRows = resumeEvidenceRows.slice(0, 8).map((row) => {
  return `| ${row.priority} | ${row.capability} | ${row.salaryMaxK || "-"}K | ${row.highValueRoles} | ${row.proofObject} | ${row.nextResumeAction} |`;
});

const routeMdRows = routeRows.map((row) => {
  return `| ${row.route} | ${row.segments} | ${row.importedJobs}/${row.targetSamples} | ${row.sampleGap} | ${row.salaryMaxK || "-"}K | ${row.topSegments} | ${row.capabilities} |`;
});

const segmentMdRows = segmentRows.map((row) => {
  return `| ${row.rank} | ${row.priority} | ${row.route} | ${row.segment} | ${row.companyType} | ${row.productSold} | ${row.companyExamples} | ${row.roleFocus} | ${row.salaryBand} | ${row.sampleProgress || "0/0"} | ${row.decisionGate || "-"} |`;
});

const salaryMdRows = roleSalaryRows.slice(0, 12).map((row) => {
  return `| ${row.roleFamily} | ${row.count} | ${row.salaryMaxK || "-"}K | ${row.segments} | ${row.examples || "-"} |`;
});

const nextMdRows = sampleGapRows.slice(0, 12).map((row, index) => {
  return `| ${index + 1} | ${row.priority} | ${row.route} | ${row.segment} | ${row.sampleGap} | ${row.nextTaskList || "-"} |`;
});

const totalTarget = sampleGapRows.reduce((sum, row) => sum + numberOf(row.targetSamples), 0);
const totalGap = sampleGapRows.reduce((sum, row) => sum + numberOf(row.sampleGap), 0);
const startedSegments = sampleGapRows.filter((row) => numberOf(row.importedJobs) > 0).length;
const notStartedSegments = sampleGapRows.filter((row) => numberOf(row.importedJobs) === 0).length;
const highValueCache = cacheEvidenceRows.filter((row) => row.evidenceLevel === "高价值候选").length;
const pendingCache = cacheEvidenceRows.filter((row) => row.evidenceLevel === "待人工确认").length;

const headers = [
  "rank",
  "priority",
  "route",
  "segment",
  "companyType",
  "productSold",
  "companyExamples",
  "buyerProfiles",
  "roleFocus",
  "salaryBand",
  "publicSalaryMaxK",
  "salaryEvidenceCount",
  "salaryExamples",
  "coreCapabilities",
  "mustHaveGate",
  "resumeEvidence",
  "sampleProgress",
  "sampleGap",
  "decisionGate",
  "nextAction",
  "evidenceBoundary"
];

mkdirSync(dirname(outputMdPath), { recursive: true });
writeFileSync(outputCsvPath, `${csv([headers, ...segmentRows.map((row) => headers.map((header) => row[header]))])}\n`);

const md = `# AI销售岗位全景总览

更新时间：${formatDate()}

## 一、本质判断

这份总览不是又一张岗位清单，而是把 AI 销售市场拆成“路线、赛道、公司类型、岗位、薪资、能力、BOSS样本缺口”七个判断层。它用于回答：你应该怎么看月之暗面、智谱AI、MiniMax 这类 AI 软件公司，也应该怎么看芯片、半导体、AI服务器、智算这类硬件公司。

当前最大约束是：BOSS 干净岗位样本只有 ${bossSampleCount} 条，目标样本量是 ${totalTarget} 条，缺口 ${totalGap} 条。所以本报告是“公开证据 + 公司池 + 本地BOSS样本 + 历史缓存候选 + 采样路线图”的阶段性总览，不能当作最终 BOSS 大样本结论。

## 二、当前证据状态

| 证据项 | 当前值 |
| --- | ---: |
| 覆盖赛道 | ${segmentRows.length} |
| BOSS干净样本 | ${bossSampleCount} |
| BOSS目标样本 | ${totalTarget} |
| BOSS样本缺口 | ${totalGap} |
| 已开始赛道 | ${startedSegments} |
| 未开始赛道 | ${notStartedSegments} |
| BOSS历史缓存候选 | ${cacheEvidenceRows.length} |
| 高价值缓存候选 | ${highValueCache} |
| 待人工确认缓存候选 | ${pendingCache} |
| 公开招聘薪资证据 | ${publicEvidenceRows.length} |

## 三、三条主线

| 路线 | 赛道数 | 样本进度 | 样本缺口 | 公开薪资上限 | 优先赛道 | 核心能力 |
| --- | ---: | ---: | ---: | ---: | --- | --- |
${mdRows(routeMdRows, "| 暂无 | 0 | 0/0 | 0 | - |  |  |")}

## 四、12个赛道全景表

| 排名 | 优先级 | 路线 | 赛道 | 公司类型 | 主要卖什么 | 代表公司 | 首看岗位 | 薪资观察 | 样本进度 | 结论权限 |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- |
${mdRows(segmentMdRows, "| 1 | 暂无 |  |  |  |  |  |  |  | 0/0 |  |")}

## 五、岗位薪资层级

| 岗位族 | 公开证据数 | 最高月薪观察 | 重点赛道 | 示例 |
| --- | ---: | ---: | --- | --- |
${mdRows(salaryMdRows, "| 暂无 | 0 | - |  |  |")}

## 六、能力要求总表

| 优先级 | 能力 | 薪资上限关联 | 高价值岗位 | 必须证明什么 | 简历下一步 |
| --- | --- | ---: | --- | --- | --- |
${mdRows(topCapabilityRows, "| 暂无 |  | - |  |  |  |")}

## 七、你点名方向怎么读

### 月之暗面、智谱AI、MiniMax

它们归入“基座大模型/Agent平台”。这类公司卖的不是普通软件，而是大模型能力、Agent平台、API/MaaS、企业知识库和行业智能体。销售岗通常要把模型能力翻译成客户业务价值，所以重点岗位是解决方案顾问、AI销售、大模型销售和商业化相关岗位。简历要证明 AI产品理解、ToB销售、场景拆解、方案表达和商机闭环。

### 芯片、半导体、AI服务器、智算

它们归入“硬件/算力/半导体路线”。这类岗位不是泛 SaaS 销售，核心是硬件/算力链路、政企/云/IDC大客户、渠道生态、项目交付和回款。优先看 AI芯片/GPU/加速卡、AI服务器/智算基础设施、智算中心/数据中心服务三个赛道。

### 销售管理岗

销售管理岗不能只看 title，要看该赛道是否需要区域经营、渠道体系、大客户推进或团队业绩责任。当前高薪信号更多出现在基座大模型、云/MaaS、智能硬件、芯片/半导体、工业AI和出海AI应用方向。

## 八、下一轮补样入口

| 顺序 | 优先级 | 路线 | 赛道 | 缺口 | 下一批人工动作 |
| ---: | --- | --- | --- | ---: | --- |
${mdRows(nextMdRows, "| 1 | 暂无 |  |  | 0 |  |")}

## 九、结论边界

1. 当前可以做赛道优先级、公司类型、薪资观察和能力要求的阶段性判断。
2. 当前不能宣布 BOSS 平台大样本结论，因为 12 个赛道里只有 1 个赛道有干净样本。
3. 每个赛道至少补到 3 条样本后，才能写方向性观察；达到目标样本后才能写赛道小结。
4. 全行业达到 80 到 200 条高相关 BOSS 样本后，才能把本报告升级为 BOSS 大样本结论。

## 十、输出文件

\`\`\`text
${outputCsvPath}
\`\`\`
`;

writeFileSync(outputMdPath, md);

console.log(`已生成：${outputMdPath}`);
console.log(`已生成：${outputCsvPath}`);
console.log(`赛道数：${segmentRows.length}`);
console.log(`BOSS干净样本：${bossSampleCount}`);
console.log(`BOSS样本缺口：${totalGap}`);
