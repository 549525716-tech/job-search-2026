#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const panoramaPath = join(projectRoot, "01_行情收集/AI销售岗位全景总览.csv");
const crossMatrixPath = join(projectRoot, "01_行情收集/AI销售岗位公司类型岗位族交叉看板.csv");
const companySamplingPath = join(projectRoot, "01_行情收集/BOSS目标公司采样缺口看板.csv");
const conclusionGatePath = join(projectRoot, "01_行情收集/AI销售市场结论权限总控.csv");
const jobsPath = join(projectRoot, "01_行情收集/data/jobs.jsonl");
const outputCsvPath = join(projectRoot, "01_行情收集/AI销售岗位一页决策总表.csv");
const outputMdPath = join(projectRoot, "01_行情收集/AI销售岗位一页决策总表.md");

const namedCompanies = new Set([
  "月之暗面",
  "智谱AI",
  "MiniMax",
  "DeepSeek",
  "阶跃星辰",
  "百川智能",
  "商汤科技",
  "第四范式",
  "寒武纪",
  "海光信息",
  "华为昇腾",
  "摩尔线程",
  "壁仞科技",
  "海思",
  "超聚变",
  "浪潮信息",
  "新华三",
  "中科曙光"
]);

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

function readBossJsonlCount(filePath) {
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

function uniq(values) {
  return [...new Set(values.map((item) => String(item || "").trim()).filter(Boolean))];
}

function topJoined(values, limit = 5, separator = "、") {
  return uniq(values).slice(0, limit).join(separator);
}

function mdRows(rows, fallback) {
  return rows.length ? rows.join("\n") : fallback;
}

function shortText(value, max = 80) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function confidenceLabel(row) {
  const permission = [row.positionPermission, row.salaryPermission, row.capabilityPermission, row.decisionGate].join(" ");
  const evidence = row.evidenceLevel || row.evidenceBoundary || "";
  if (/BOSS方向观察|可写方向性观察|已有少量BOSS样本/.test(permission) || /已有少量BOSS样本/.test(evidence)) {
    return "BOSS少量样本方向观察";
  }
  if (/公开薪资|公开信号|公开资料/.test(permission) || /公开薪资|公开信号/.test(evidence)) {
    return "公开信号假设";
  }
  return "待BOSS样本校验";
}

function permissionForSegment(gateRows, segment, topic) {
  return gateRows.find((row) => row.scope === "赛道" && row.segment === segment && row.conclusionTopic === topic)?.conclusionPermission || "";
}

function bestCrossRows(crossRows, segment, limit = 3) {
  return crossRows
    .filter((row) => row.segment === segment)
    .sort((a, b) => numberOf(b.decisionScore) - numberOf(a.decisionScore) || numberOf(b.salaryMaxK) - numberOf(a.salaryMaxK))
    .slice(0, limit);
}

function sampleCountFromProgress(progress) {
  const match = String(progress || "").match(/(\d+)\s*\/\s*(\d+)/);
  return {
    current: match ? Number(match[1]) : 0,
    target: match ? Number(match[2]) : 0
  };
}

const panoramaRows = readCsv(panoramaPath);
const crossRows = readCsv(crossMatrixPath);
const companyRows = readCsv(companySamplingPath);
const gateRows = readCsv(conclusionGatePath);
const bossSampleCount = readBossJsonlCount(jobsPath);

const segmentRows = panoramaRows.map((row) => {
  const roles = bestCrossRows(crossRows, row.segment, 3);
  const bestRole = roles[0] || {};
  const progress = sampleCountFromProgress(row.sampleProgress);
  return {
    rowType: "赛道决策",
    rank: row.rank,
    decisionLayer: row.priority,
    route: row.route,
    segment: row.segment,
    companyType: row.companyType,
    companies: row.companyExamples,
    roleFamily: topJoined(roles.map((item) => item.roleFamily || item.role), 3),
    roleFocus: row.roleFocus,
    salaryBand: row.salaryBand,
    salaryEvidenceCount: row.salaryEvidenceCount,
    bossProgress: row.sampleProgress,
    bossUsableSamples: progress.current,
    bossTargetSamples: progress.target,
    bossSampleGap: row.sampleGap,
    companySampleGap: bestRole.companySampleGap || row.sampleGap,
    evidenceLevel: row.evidenceBoundary,
    conclusionPermission: [
      permissionForSegment(gateRows, row.segment, "岗位定位"),
      permissionForSegment(gateRows, row.segment, "薪资待遇"),
      permissionForSegment(gateRows, row.segment, "能力要求")
    ].filter(Boolean).join(" / "),
    confidence: confidenceLabel({ ...row, ...bestRole }),
    coreCapabilities: row.coreCapabilities,
    mustHaveGate: row.mustHaveGate,
    applicantPositioning: bestRole.applicantPositioning || row.resumeEvidence,
    nextBossAction: row.nextAction,
    nextResumeAction: bestRole.nextResumeAction || row.resumeEvidence,
    safeBossHomeUrl: "https://www.zhipin.com/",
    searchKeyword: "",
    riskBoundary: row.evidenceBoundary
  };
});

const roleRows = crossRows
  .slice()
  .sort((a, b) => numberOf(b.decisionScore) - numberOf(a.decisionScore) || numberOf(b.salaryMaxK) - numberOf(a.salaryMaxK))
  .slice(0, 18)
  .map((row, index) => ({
    rowType: "岗位薪资组合",
    rank: index + 1,
    decisionLayer: row.decisionLabel,
    route: row.route,
    segment: row.segment,
    companyType: row.companyFamily,
    companies: row.topCompanies,
    roleFamily: row.roleFamily,
    roleFocus: row.role,
    salaryBand: row.salaryBand,
    salaryEvidenceCount: row.salaryEvidenceCount,
    bossProgress: row.sampleProgress,
    bossUsableSamples: sampleCountFromProgress(row.sampleProgress).current,
    bossTargetSamples: sampleCountFromProgress(row.sampleProgress).target,
    bossSampleGap: row.sampleGap,
    companySampleGap: row.companySampleGap,
    evidenceLevel: row.evidenceLevel,
    conclusionPermission: `岗位：${row.positionPermission}; 薪资：${row.salaryPermission}; 能力：${row.capabilityPermission}`,
    confidence: confidenceLabel(row),
    coreCapabilities: row.coreCapabilities,
    mustHaveGate: row.mustHaveGate,
    applicantPositioning: row.applicantPositioning,
    nextBossAction: row.nextBossAction,
    nextResumeAction: row.nextResumeAction,
    safeBossHomeUrl: "https://www.zhipin.com/",
    searchKeyword: "",
    riskBoundary: row.riskBoundary
  }));

const focusCompanyRows = companyRows
  .filter((row) => namedCompanies.has(row.company) || row.focusCompany === "是")
  .sort((a, b) => {
    const priorityScore = (row) => (/P0/.test(row.priority || "") ? 100 : /P1/.test(row.priority || "") ? 50 : 0) + numberOf(row.sampleGap);
    return priorityScore(b) - priorityScore(a) || a.company.localeCompare(b.company, "zh-Hans-CN");
  })
  .slice(0, 30)
  .map((row, index) => ({
    rowType: "点名/重点公司",
    rank: index + 1,
    decisionLayer: row.priority,
    route: row.route,
    segment: row.segment,
    companyType: row.companyType,
    companies: row.company,
    roleFamily: row.nextRole,
    roleFocus: row.recommendedRoles,
    salaryBand: row.salaryBand,
    salaryEvidenceCount: "",
    bossProgress: `${row.currentSamples}/${row.targetSamples}`,
    bossUsableSamples: row.currentSamples,
    bossTargetSamples: row.targetSamples,
    bossSampleGap: row.sampleGap,
    companySampleGap: row.sampleGap,
    evidenceLevel: row.coverageStatus,
    conclusionPermission: row.coverageStatus,
    confidence: numberOf(row.currentSamples) > 0 ? "已有BOSS公司样本" : "待BOSS公司样本",
    coreCapabilities: "",
    mustHaveGate: row.acceptanceGate,
    applicantPositioning: row.salesFit,
    nextBossAction: row.nextAction,
    nextResumeAction: "按该公司岗位详情补简历证据：客户、场景、业绩、方案、回款。",
    safeBossHomeUrl: row.safeBossHomeUrl || "https://www.zhipin.com/",
    searchKeyword: row.searchKeyword || `${row.company} ${row.nextRole}`.trim(),
    riskBoundary: "公司级机会需以BOSS岗位详情和质量门禁校验。"
  }));

const outputRows = [...segmentRows, ...roleRows, ...focusCompanyRows];

const headers = [
  "rowType",
  "rank",
  "decisionLayer",
  "route",
  "segment",
  "companyType",
  "companies",
  "roleFamily",
  "roleFocus",
  "salaryBand",
  "salaryEvidenceCount",
  "bossProgress",
  "bossUsableSamples",
  "bossTargetSamples",
  "bossSampleGap",
  "companySampleGap",
  "evidenceLevel",
  "conclusionPermission",
  "confidence",
  "coreCapabilities",
  "mustHaveGate",
  "applicantPositioning",
  "nextBossAction",
  "nextResumeAction",
  "safeBossHomeUrl",
  "searchKeyword",
  "riskBoundary"
];

const segmentMdRows = segmentRows.map((row) => {
  return `| ${row.rank} | ${row.decisionLayer} | ${row.route} | ${row.segment} | ${shortText(row.companies, 36)} | ${row.roleFocus} | ${row.salaryBand} | ${row.bossProgress} | ${row.confidence} | ${shortText(row.coreCapabilities, 58)} |`;
});

const roleMdRows = roleRows.slice(0, 12).map((row) => {
  return `| ${row.rank} | ${row.decisionLayer} | ${row.segment} | ${row.roleFamily} | ${row.salaryBand} | ${row.salaryEvidenceCount || 0} | ${row.bossProgress} | ${row.confidence} | ${shortText(row.applicantPositioning, 44)} |`;
});

const companyMdRows = focusCompanyRows.slice(0, 20).map((row) => {
  return `| ${row.rank} | ${row.companies} | ${row.segment} | ${row.roleFamily} | ${row.salaryBand} | ${row.bossProgress} | ${row.safeBossHomeUrl} | \`${row.searchKeyword}\` |`;
});

const globalSalaryGate = gateRows.find((row) => row.scope === "全局" && row.conclusionTopic === "薪资待遇") || {};
const globalBossGate = gateRows.find((row) => row.scope === "全局" && row.conclusionTopic === "BOSS平台大样本结论") || {};

const md = `# AI销售岗位一页决策总表

更新时间：${formatDate()}

## 一、本质判断

这张表不是新增结论，而是把现有 AI 行业公司池、岗位族、薪资信号、能力门槛、BOSS样本进度和下一步补样动作压成一个决策入口。

当前最重要的判断：可以用它做方向选择、岗位优先级和简历补强，但不能把公开薪资信号写成 BOSS 大样本统计。

## 二、总控状态

| 指标 | 当前值 |
| --- | --- |
| AI赛道 | ${panoramaRows.length} 个 |
| 决策岗位组合 | ${crossRows.length} 个 |
| 重点/点名公司 | ${focusCompanyRows.length} 家 |
| BOSS干净样本 | ${bossSampleCount} 条 |
| 薪资结论权限 | ${globalSalaryGate.conclusionPermission || "未生成"} |
| BOSS大样本结论权限 | ${globalBossGate.conclusionPermission || "未生成"} |

## 三、赛道总表

| 排名 | 优先级 | 路线 | 赛道 | 代表公司 | 重点岗位 | 薪资区间 | BOSS样本 | 证据强度 | 核心能力 |
| ---: | --- | --- | --- | --- | --- | --- | ---: | --- | --- |
${mdRows(segmentMdRows, "| - | 暂无 |  |  |  |  |  | 0/0 |  |  |")}

## 四、岗位薪资组合 Top12

| 排名 | 决策 | 赛道 | 岗位族 | 薪资区间 | 薪资证据 | BOSS样本 | 证据强度 | 候选人定位 |
| ---: | --- | --- | --- | --- | ---: | ---: | --- | --- |
${mdRows(roleMdRows, "| - | 暂无 |  |  |  | 0 | 0/0 |  |  |")}

## 五、点名/重点公司低频补样入口

这部分只给人工低频检索入口：先打开 BOSS 首页，再输入站内搜索关键词；不自动打开、不自动刷新。

| 排名 | 公司 | 赛道 | 下一岗位词 | 薪资区间 | BOSS样本 | BOSS首页 | 站内搜索关键词 |
| ---: | --- | --- | --- | --- | ---: | --- | --- |
${mdRows(companyMdRows, "| - | 暂无 |  |  |  | 0/0 |  |  |")}

## 六、使用规则

1. 先看第三部分选赛道：优先是基座大模型/Agent、云/MaaS、工业AI、AI芯片/服务器、智能客服/营销AI。
2. 再看第四部分选岗位族：高薪通常集中在大客户/行业销售、AI软件/大模型销售、售前/解决方案、渠道/生态和销售管理。
3. 最后看第五部分做低频补样：每家公司先复制 1 到 3 条高相关岗位详情，再运行导入命令。
4. 简历补强优先围绕：AI产品理解、行业场景、KA开发、方案宣讲/POC、商务回款、渠道生态、跨部门推进。
5. 薪资区间是公开信号和少量样本的阶段性区间，只有补足 BOSS 可读薪资样本后才能写成稳定统计。

CSV明细：

\`\`\`text
${outputCsvPath}
\`\`\`
`;

mkdirSync(dirname(outputCsvPath), { recursive: true });
writeFileSync(outputCsvPath, `${csv([headers, ...outputRows.map((row) => headers.map((header) => row[header]))])}\n`);
writeFileSync(outputMdPath, md);

console.log(`已生成：${outputMdPath}`);
console.log(`已生成：${outputCsvPath}`);
console.log(`赛道行：${segmentRows.length}`);
console.log(`岗位组合行：${roleRows.length}`);
console.log(`重点公司行：${focusCompanyRows.length}`);
