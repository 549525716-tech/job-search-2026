#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const resumeEvidencePath = join(projectRoot, "03_简历/AI销售能力证据与简历改写矩阵.csv");
const resumeGapPath = join(projectRoot, "03_简历/AI销售岗位匹配与能力Gap.csv");
const bossAcceptancePath = join(projectRoot, "01_行情收集/BOSS大样本完成门槛与验收路线.csv");
const profilePath = join(projectRoot, "02_岗位画像/data/我的能力画像.json");

const outputMdPath = join(projectRoot, "03_简历/AI销售市场到简历证据闭环.md");
const outputCsvPath = join(projectRoot, "03_简历/AI销售市场到简历证据闭环.csv");

const profileFieldHints = {
  "AI/大模型产品理解": "aiProductUnderstanding.productsOrScenarios / aiProductUnderstanding.canExplain / aiProductUnderstanding.demoOrPocExperience",
  "ToB/企业服务销售": "evidence[].customerType / evidence[].salesCycle / evidence[].conversionRate",
  "大客户/KA开发": "keyAccountExperience.customerExamples / keyAccountExperience.decisionChainExperience / keyAccountExperience.largestDeal",
  "行业场景理解": "keyAccountExperience.customerIndustries / evidence[].industry / evidence[].context",
  "方案宣讲/解决方案": "solutionAndPresales.requirementsResearch / solutionAndPresales.solutionDocs / solutionAndPresales.demoPoc",
  "回款/合同/商务闭环": "commercialClosure.contractExamples / commercialClosure.collectionExamples / commercialClosure.quotaAchievement",
  "商机挖掘/销售漏斗": "evidence[].action / evidence[].conversionRate / evidence[].proof",
  "渠道/生态合作": "channelAndEcosystem.partnerTypes / channelAndEcosystem.partnerCount / channelAndEcosystem.channelRevenue",
  "市场洞察/竞品反馈": "evidence[].context / evidence[].action / evidence[].proof",
  "项目推进/跨部门协同": "solutionAndPresales.deliveryCoordination / evidence[].collaborators / evidence[].roleInProject",
  "海外/出海商业化": "evidence[].customerType / evidence[].industry / constraints[]",
  "硬件/智算/半导体行业销售": "hardwareComputeSemiconductor.knownProducts / hardwareComputeSemiconductor.customerTypes / hardwareComputeSemiconductor.projectTypes",
  "广告/营销技术销售": "evidence[].industry / evidence[].revenueOrGMV / evidence[].conversionRate"
};

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
  const records = splitCsvRecords(text).filter((record) => record.trim());
  if (!records.length) return [];
  const headers = parseCsvLine(records.shift());
  return records.map((record) => {
    const values = parseCsvLine(record);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
  });
}

function readCsv(filePath) {
  if (!existsSync(filePath)) return [];
  return parseCsv(readFileSync(filePath, "utf8"));
}

function readJsonIfExists(filePath, fallback = {}) {
  if (!existsSync(filePath)) return fallback;
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function csv(rows) {
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
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

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function topJoined(items, limit = 6, separator = "、") {
  return uniq(items).slice(0, limit).join(separator);
}

function numberOf(value) {
  const num = Number.parseFloat(String(value || "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(num) ? num : 0;
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

function meaningfulProfileValues(value) {
  if (value === null || value === undefined || value === false) return [];
  if (typeof value === "string") {
    const text = value.trim();
    return text ? [text] : [];
  }
  if (typeof value === "number") return Number.isFinite(value) ? [String(value)] : [];
  if (Array.isArray(value)) return value.flatMap((item) => meaningfulProfileValues(item));
  if (typeof value === "object") {
    return Object.entries(value)
      .filter(([key]) => !["targetRoles", "targetRoutes", "targetConstraints", "constraints", "resumeEvidencePriority", "resumeVersions", "canBeUsedInResume", "evidenceIds", "proofIds"].includes(key))
      .flatMap(([, item]) => meaningfulProfileValues(item));
  }
  return [];
}

function profileEvidencePayload(profile) {
  return {
    currentSummary: profile.currentSummary,
    skills: profile.skills,
    evidence: profile.evidence,
    aiProductUnderstanding: profile.aiProductUnderstanding,
    keyAccountExperience: profile.keyAccountExperience,
    solutionAndPresales: profile.solutionAndPresales,
    commercialClosure: profile.commercialClosure,
    channelAndEcosystem: profile.channelAndEcosystem,
    hardwareComputeSemiconductor: profile.hardwareComputeSemiconductor,
    salesManagement: profile.salesManagement
  };
}

function hasMeaningfulProfile(profile) {
  return meaningfulProfileValues(profileEvidencePayload(profile)).length > 0;
}

function mdRows(rows, fallback) {
  return rows.length ? rows.join("\n") : fallback;
}

function evidencePriorityRank(value) {
  if (/P0/.test(value || "")) return 3;
  if (/P1/.test(value || "")) return 2;
  return 1;
}

function relatedAcceptanceRows(acceptanceRows, segmentsText) {
  const segments = splitTerms(segmentsText);
  return acceptanceRows.filter((row) => segments.includes(row.segment));
}

function profileStatusFor(row, profileReady) {
  if (!profileReady) return "能力画像为空：不能判断个人真实匹配度";
  if (/已有/.test(row.profileStatus || "")) return "已有描述但需要量化";
  return row.profileStatus || "待补证据";
}

const resumeEvidenceRows = readCsv(resumeEvidencePath);
const resumeGapRows = readCsv(resumeGapPath);
const bossAcceptanceRows = readCsv(bossAcceptancePath);
const profile = readJsonIfExists(profilePath);
const profileReady = hasMeaningfulProfile(profile);
const p0Rows = resumeEvidenceRows
  .slice()
  .sort((a, b) => evidencePriorityRank(b.priority) - evidencePriorityRank(a.priority) || numberOf(b.demandScore) - numberOf(a.demandScore))
  .slice(0, 12);

const closureRows = p0Rows.map((row, index) => {
  const relatedAcceptances = relatedAcceptanceRows(bossAcceptanceRows, row.prioritySegments);
  const topAcceptanceRows = relatedAcceptances
    .slice()
    .sort((a, b) => numberOf(b.missingBossSamples) - numberOf(a.missingBossSamples))
    .slice(0, 4);
  const topGap = resumeGapRows.find((item) => splitTerms(item.requiredCapabilities).includes(row.capability) || splitTerms(item.missingCapabilities).includes(row.capability)) || {};
  return {
    rank: index + 1,
    priority: row.priority,
    capability: row.capability,
    demandScore: row.demandScore,
    salaryMaxK: row.salaryMaxK,
    profileStatus: profileStatusFor(row, profileReady),
    targetRoutes: row.routes,
    targetSegments: topJoined(splitTerms(row.prioritySegments), 5),
    highValueRoles: row.highValueRoles,
    bossEvidenceState: topAcceptanceRows.map((item) => `${item.segment} ${item.currentSamples}/${item.targetSamples}`).join("；"),
    bossSampleGap: topAcceptanceRows.reduce((sum, item) => sum + numberOf(item.missingBossSamples), 0),
    nextBossCompanies: topJoined(topAcceptanceRows.flatMap((item) => splitTerms(item.nextCompanies)), 8),
    nextBossRoles: topJoined(topAcceptanceRows.flatMap((item) => splitTerms(item.nextRoles)), 6),
    resumeRisk: topGap.riskLevel || (profileReady ? "待量化" : "高"),
    profileFieldsToFill: profileFieldHints[row.capability] || "evidence[].context / evidence[].action / evidence[].result / evidence[].proof",
    questionsToAnswer: row.missingEvidenceQuestions,
    metricsToCollect: row.metricsToCollect,
    resumeBulletTemplate: row.resumeBulletTemplate,
    nextResumeAction: row.nextResumeAction,
    nextBossAction: topAcceptanceRows[0]?.nextAction || topGap.nextAction || "继续补 BOSS 岗位详情样本"
  };
});

const headers = [
  "rank",
  "priority",
  "capability",
  "demandScore",
  "salaryMaxK",
  "profileStatus",
  "targetRoutes",
  "targetSegments",
  "highValueRoles",
  "bossEvidenceState",
  "bossSampleGap",
  "nextBossCompanies",
  "nextBossRoles",
  "resumeRisk",
  "profileFieldsToFill",
  "questionsToAnswer",
  "metricsToCollect",
  "resumeBulletTemplate",
  "nextResumeAction",
  "nextBossAction"
];

mkdirSync(dirname(outputMdPath), { recursive: true });
writeFileSync(outputCsvPath, `${csv([headers, ...closureRows.map((row) => headers.map((header) => row[header]))])}\n`);

const evidenceMdRows = closureRows.slice(0, 10).map((row) => {
  return `| ${row.rank} | ${row.priority} | ${row.capability} | ${row.demandScore} | ${row.salaryMaxK || "-"}K | ${row.profileStatus} | ${row.targetSegments} | ${row.bossEvidenceState || "-"} | ${row.profileFieldsToFill} |`;
});

const gapMdRows = resumeGapRows.slice(0, 10).map((row, index) => {
  return `| ${index + 1} | ${row.priority} | ${row.segment} | ${row.role} | ${row.salaryBand} | ${row.riskLevel} | ${row.missingCapabilities} | ${row.nextAction} |`;
});

const profileFieldRows = closureRows.slice(0, 8).map((row) => {
  return `| ${row.capability} | ${row.profileFieldsToFill} | ${row.questionsToAnswer} | ${row.metricsToCollect} |`;
});

const totalBossGap = bossAcceptanceRows.reduce((sum, row) => sum + numberOf(row.missingBossSamples), 0);
const readableSalaryGap = bossAcceptanceRows.reduce((sum, row) => sum + numberOf(row.missingReadableSalary), 0);
const detailGap = bossAcceptanceRows.reduce((sum, row) => sum + numberOf(row.missingDetailSamples), 0);
const p0Count = closureRows.filter((row) => /P0/.test(row.priority)).length;
const profileMemory = profile.profileMemory || {};
const twoStepSelf = profile.twoStepMemory?.step1SelfSummary || {};
const twoStepMarket = profile.twoStepMemory?.step2MarketComparison || {};
const directProof = ensureArray(profileMemory.directProof || twoStepSelf.directEvidence).slice(0, 6).join("<br>");
const transferableProof = ensureArray(profileMemory.transferableProof).slice(0, 5).join("<br>");
const hardBoundaries = ensureArray(profileMemory.hardBoundaries).slice(0, 6).join("<br>");
const priorityRoutes = ensureArray(twoStepMarket.priorityRoutes).slice(0, 6).join("；");
const comparisonRule = profileMemory.comparisonRule || twoStepMarket.comparisonRule || "每个岗位先判断直接匹配、可迁移、硬缺口，再决定简历前置、转译或补课。";

const md = `# AI销售市场到简历证据闭环

更新时间：${formatDateTime()}

## 一、本质判断

这份文件固定按两步使用：先形成你的个人事实记忆，再把市场岗位要求转成能力 gap 和简历证据任务。

它不是单独改简历，也不是单独列岗位要求。真正要连接的是四件事：个人能力画像、岗位能力要求、BOSS/公开样本验收门槛、简历表达模板。

当前最大的矛盾是：你的销售结果、客户经营和销售管理证据很强，但市场侧高薪 AI/互联网/云/硬件岗位会继续追问 AI 产品商业化、企业级采购链路、方案/POC、合同回款和目标行业语言。

## 二、第一步：先总结你自己

| 维度 | 当前结论 |
| --- | --- |
| 当前身份 | ${profileMemory.positioning || twoStepSelf.coreIdentity || profile.currentSummary || "待补"} |
| 直接证据 | ${directProof || "待补"} |
| 可迁移证据 | ${transferableProof || "待补"} |
| 不能夸大的边界 | ${hardBoundaries || "待补"} |
| 岗位匹配规则 | ${comparisonRule} |

## 三、第二步：再对比市场

### 闭环状态

| 指标 | 当前值 |
| --- | ---: |
| P0/P1/P2 简历证据项 | ${resumeEvidenceRows.length} |
| 本轮闭环优先证据 | ${closureRows.length} |
| P0 简历核心证据 | ${p0Count} |
| BOSS样本缺口 | ${totalBossGap} |
| 可读薪资缺口 | ${readableSalaryGap} |
| 详情文本缺口 | ${detailGap} |
| 能力画像状态 | ${profileReady ? "已有部分内容，仍需量化" : "基本为空"} |
| 当前优先路线 | ${priorityRoutes || "AI应用/营销AI/SaaS、互联网广告/平台型2B、大模型/Agent商业化、云/MaaS、汽车AI补充线"} |

## 四、优先补的简历证据

| 排名 | 优先级 | 能力 | 需求分 | 薪资上限 | 当前画像状态 | 关联赛道 | BOSS证据状态 | 建议填写字段 |
| ---: | --- | --- | ---: | ---: | --- | --- | --- | --- |
${mdRows(evidenceMdRows, "| 1 | 暂无 |  | 0 | - |  |  |  |  |")}

## 五、岗位方向上的简历风险

| 排名 | 优先级 | 赛道 | 岗位方向 | 薪资观察 | 风险 | 缺口能力 | 下一步 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
${mdRows(gapMdRows, "| 1 | 暂无 |  |  |  |  |  |  |")}

## 六、能力画像补全任务

| 能力 | 建议填写字段 | 必答问题 | 量化指标 |
| --- | --- | --- | --- |
${mdRows(profileFieldRows, "| 暂无 |  |  |  |")}

## 七、执行路径

1. 先按上表补能力画像，不要先改正式简历。
2. 每导入 5 到 10 条 BOSS 岗位详情后，运行 \`npm run report:full && npm run resume:closure && npm run audit:research\`。
3. 当某个能力已经有真实项目证据，再把 \`resumeBulletTemplate\` 改写成正式简历条目。
4. 如果能力画像仍为空，所有“匹配/不匹配”判断都只能视为市场侧建议，不能代表个人真实竞争力。

## 八、输出文件

\`\`\`text
${outputCsvPath}
${outputMdPath}
\`\`\`
`;

writeFileSync(outputMdPath, md);

console.log(`已生成：${outputMdPath}`);
console.log(`已生成：${outputCsvPath}`);
console.log(`闭环证据项：${closureRows.length}`);
console.log(`P0证据项：${p0Count}`);
console.log(`能力画像状态：${profileReady ? "已有部分内容" : "基本为空"}`);
