#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const companyDatasetPath = join(projectRoot, "00_行业资料集/AI产业链公司资料集.csv");
const opportunityMapPath = join(projectRoot, "00_行业资料集/AI产业链头部公司岗位机会地图.csv");
const segmentGraphPath = join(projectRoot, "00_行业资料集/AI产业链销售岗位图谱.csv");
const targetCompanySamplingPath = join(projectRoot, "01_行情收集/BOSS目标公司采样缺口看板.csv");
const bossSampleQualityPath = join(projectRoot, "01_行情收集/BOSS样本质量验收报告.csv");
const firstExecutionPath = join(projectRoot, "01_行情收集/BOSS首批人工采样执行单.csv");
const focusCoveragePath = join(projectRoot, "01_行情收集/AI重点公司与赛道覆盖审计.csv");
const marketEvidenceAuditPath = join(projectRoot, "01_行情收集/AI市场资料集证据审计.csv");

const outputCsvPath = join(projectRoot, "00_行业资料集/AI细分赛道头部公司Top10证据表.csv");
const outputMdPath = join(projectRoot, "00_行业资料集/AI细分赛道头部公司Top10证据表.md");
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
  return `${rows.map((row) => row.map(csvEscape).join(",")).join("\n")}\n`;
}

function numberOf(value) {
  const num = Number.parseFloat(String(value || "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(num) ? num : 0;
}

function priorityRank(value) {
  if (/P0/.test(value || "")) return 4;
  if (/P1/.test(value || "")) return 3;
  if (/P2/.test(value || "")) return 2;
  const num = Number(value || 99);
  return Number.isFinite(num) ? Math.max(0, 5 - num) : 0;
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
  }).formatToParts(value instanceof Date ? value : new Date(value));
  const get = (type) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")} Asia/Shanghai`;
}

function uniq(values) {
  return [...new Set(values.map((item) => String(item || "").trim()).filter(Boolean))];
}

function splitTerms(value) {
  return String(value || "")
    .split(/[;；、]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function mdRows(rows, fallback) {
  return rows.length ? rows.join("\n") : fallback;
}

function companyKey(segment, company) {
  return `${segment}::${company}`;
}

function findByCompany(rows, segment, company) {
  return rows.find((row) => row.segment === segment && row.company === company)
    || rows.find((row) => row.company === company)
    || {};
}

function evidenceStatus(row) {
  if (numberOf(row.currentSamples) >= numberOf(row.targetSamples) && numberOf(row.targetSamples) > 0) return "BOSS公司样本达标";
  if (numberOf(row.currentSamples) > 0) return "已有BOSS样本但不足";
  if (row.focusCoverageGate === "缺人工批次") return "已进公司池但缺人工批次";
  return "待人工BOSS验证";
}

function whyTopCompany(company, opportunity, sampling, segmentEvidence) {
  const parts = [
    company.companyType,
    company.salesFit,
    `机会分${opportunity.opportunityScore || "-"}`,
    segmentEvidence.evidenceGrade || segmentEvidence.segmentEvidenceGrade || "",
    sampling.coverageStatus || sampling.bossEvidenceStatus || ""
  ].filter(Boolean);
  return parts.join("；");
}

function topCompanyRowsBySegment(companyRows, opportunityRows) {
  const opportunityByKey = new Map(opportunityRows.map((row) => [companyKey(row.segment, row.company), row]));
  const segments = uniq(companyRows.map((row) => row.segment));
  return segments.flatMap((segment) => {
    const rows = companyRows
      .filter((row) => row.segment === segment)
      .slice()
      .sort((a, b) => {
        const opportunityA = opportunityByKey.get(companyKey(a.segment, a.company)) || {};
        const opportunityB = opportunityByKey.get(companyKey(b.segment, b.company)) || {};
        return numberOf(opportunityB.opportunityScore) - numberOf(opportunityA.opportunityScore)
          || priorityRank(b.priority) - priorityRank(a.priority)
          || a.company.localeCompare(b.company, "zh-Hans-CN");
      })
      .slice(0, 10);
    return rows.map((row, index) => ({ segmentRank: index + 1, ...row }));
  });
}

const companyRows = readCsv(companyDatasetPath);
const opportunityRows = readCsv(opportunityMapPath);
const segmentGraphRows = readCsv(segmentGraphPath);
const targetCompanySamplingRows = readCsv(targetCompanySamplingPath);
const bossSampleQualityRows = readCsv(bossSampleQualityPath);
const firstExecutionRows = readCsv(firstExecutionPath);
const focusCoverageRows = readCsv(focusCoveragePath);
const marketEvidenceRows = readCsv(marketEvidenceAuditPath);

const firstExecutionByCompany = new Map(firstExecutionRows.map((row) => [companyKey(row.segment, row.company), row]));
const topRows = topCompanyRowsBySegment(companyRows, opportunityRows).map((company) => {
  const opportunity = findByCompany(opportunityRows, company.segment, company.company);
  const sampling = findByCompany(targetCompanySamplingRows, company.segment, company.company);
  const focus = findByCompany(focusCoverageRows, company.segment, company.company);
  const segmentGraph = segmentGraphRows.find((row) => row.segment === company.segment) || {};
  const segmentEvidence = marketEvidenceRows.find((row) => row.scope === "赛道" && row.segment === company.segment) || {};
  const firstExecution = firstExecutionByCompany.get(companyKey(company.segment, company.company)) || {};
  const bossSamples = bossSampleQualityRows.filter((row) => row.company === company.company);
  const usableBossSamples = bossSamples.filter((row) => row.roleRelevant === "true" && row.aiRelevant === "true" && /^A|^B/.test(row.qualityGrade || ""));
  const targetSamples = numberOf(sampling.targetSamples) || numberOf(opportunity.totalTasks) || 3;
  const currentSamples = usableBossSamples.length;
  const sampleGap = Math.max(0, targetSamples - currentSamples);
  const recommendedRoles = sampling.recommendedRoles || opportunity.roleTerms || company.roleTerms || "";
  const nextRole = sampling.nextRole || firstExecution.role || splitTerms(recommendedRoles)[0] || "";
  const manualUrl = sampling.searchUrl || firstExecution.manualUrl || opportunity.firstSearchUrl || company.manualUrl || "";
  const searchKeyword = sampling.searchKeyword || firstExecution.searchKeyword || opportunity.searchKeyword || company.searchKeyword || `${company.company} ${nextRole || "销售"}`;
  return {
    route: company.route || sampling.route || segmentGraph.route || "",
    segment: company.segment,
    segmentRank: company.segmentRank,
    layer: company.layer,
    company: company.company,
    top10Slot: `${company.segmentRank}/10`,
    poolCompanyCount: companyRows.filter((row) => row.segment === company.segment).length,
    priority: company.priority || opportunity.priority || "",
    opportunityLevel: opportunity.opportunityLevel || "",
    opportunityScore: opportunity.opportunityScore || "",
    companyType: company.companyType,
    keywords: company.keywords,
    salesFit: company.salesFit,
    buyerProfiles: segmentGraph.buyerProfiles || "",
    salesMotion: segmentGraph.salesMotion || "",
    recommendedRoles,
    nextRole,
    salaryObservation: company.salaryObservation || opportunity.salaryObservation || segmentGraph.salarySignal || "",
    coreCapabilities: company.coreCapabilities || opportunity.coreCapabilities || segmentGraph.capabilityFocus || "",
    targetSamples,
    currentSamples,
    sampleGap,
    readableSalarySamples: bossSamples.filter((row) => row.salaryReadable === "true").length,
    detailSamples: bossSamples.filter((row) => numberOf(row.detailTextLength) >= 300).length,
    bossEvidenceStatus: evidenceStatus({
      ...sampling,
      currentSamples,
      targetSamples,
      focusCoverageGate: focus.coverageGate
    }),
    focusCoverageGate: focus.coverageGate || "",
    firstExecutionBatch: firstExecution.batchId || "",
    firstExecutionCopies: firstExecution.targetCopies || "",
    segmentEvidenceGrade: segmentEvidence.evidenceGrade || "",
    segmentConclusionBoundary: segmentEvidence.conclusionBoundary || segmentGraph.evidenceBoundary || "",
    publicEvidence: segmentGraph.publicEvidence || segmentEvidence.publicSourceExamples || "",
    sourceUrls: segmentGraph.sourceUrls || "",
    whyTop10: "",
    safeBossHomeUrl,
    searchKeyword,
    manualUrl,
    importCommand: sampling.importCommand || firstExecution.importCommand || "",
    nextAction: sampling.nextAction || firstExecution.whyFirst || opportunity.nextAction || company.nextAction || ""
  };
}).map((row) => ({
  ...row,
  whyTop10: whyTopCompany(row, row, row, row)
}));

const headers = [
  "route",
  "segment",
  "segmentRank",
  "layer",
  "company",
  "top10Slot",
  "poolCompanyCount",
  "priority",
  "opportunityLevel",
  "opportunityScore",
  "companyType",
  "keywords",
  "salesFit",
  "buyerProfiles",
  "salesMotion",
  "recommendedRoles",
  "nextRole",
  "salaryObservation",
  "coreCapabilities",
  "targetSamples",
  "currentSamples",
  "sampleGap",
  "readableSalarySamples",
  "detailSamples",
  "bossEvidenceStatus",
  "focusCoverageGate",
  "firstExecutionBatch",
  "firstExecutionCopies",
  "segmentEvidenceGrade",
  "segmentConclusionBoundary",
  "publicEvidence",
  "sourceUrls",
  "whyTop10",
  "safeBossHomeUrl",
  "searchKeyword",
  "manualUrl",
  "importCommand",
  "nextAction"
];

const segmentSummaryRows = uniq(topRows.map((row) => row.segment)).map((segment) => {
  const rows = topRows.filter((row) => row.segment === segment);
  const totalPool = rows[0]?.poolCompanyCount || rows.length;
  const withBoss = rows.filter((row) => row.currentSamples > 0).length;
  const sampleGap = rows.reduce((sum, row) => sum + row.sampleGap, 0);
  const firstCompanies = rows.slice(0, 10).map((row) => row.company).join("、");
  const boundary = rows[0]?.segmentConclusionBoundary || "";
  return {
    route: rows[0]?.route || "",
    segment,
    top10Count: rows.length,
    totalPool,
    withBoss,
    sampleGap,
    boundary,
    firstCompanies
  };
}).sort((a, b) => b.sampleGap - a.sampleGap || b.top10Count - a.top10Count);

const segmentSummaryMdRows = segmentSummaryRows.map((row) => {
  return `| ${row.route} | ${row.segment} | ${row.top10Count}/${Math.min(10, row.totalPool)} | ${row.withBoss} | ${row.sampleGap} | ${row.boundary} | ${row.firstCompanies} |`;
});

const priorityMdRows = topRows
  .slice()
  .sort((a, b) => b.sampleGap - a.sampleGap || numberOf(b.opportunityScore) - numberOf(a.opportunityScore))
  .slice(0, 30)
  .map((row, index) => {
    return `| ${index + 1} | ${row.segment} | ${row.company} | ${row.nextRole || "-"} | ${row.salaryObservation || "待补"} | ${row.currentSamples}/${row.targetSamples} | ${row.bossEvidenceStatus} | ${row.firstExecutionBatch || "-"} | ${row.safeBossHomeUrl} | \`${row.searchKeyword}\` |`;
  });

const segmentSections = segmentSummaryRows.map((summary) => {
  const rows = topRows
    .filter((row) => row.segment === summary.segment)
    .sort((a, b) => a.segmentRank - b.segmentRank)
    .map((row) => {
      return `| ${row.segmentRank} | ${row.company} | ${row.layer} | ${row.companyType} | ${row.recommendedRoles} | ${row.salaryObservation || "待补"} | ${row.currentSamples}/${row.targetSamples} | ${row.bossEvidenceStatus} | ${row.nextAction} |`;
    });
  return `### ${summary.segment}

| 排名 | 公司 | 层级 | 公司类型 | 优先岗位词 | 薪资观察 | BOSS样本 | 证据状态 | 下一步 |
| ---: | --- | --- | --- | --- | --- | ---: | --- | --- |
${mdRows(rows, "| 暂无 |  |  |  |  |  | 0/0 |  |  |")}`;
});

const totalTargetSamples = topRows.reduce((sum, row) => sum + row.targetSamples, 0);
const totalCurrentSamples = topRows.reduce((sum, row) => sum + row.currentSamples, 0);
const totalSampleGap = topRows.reduce((sum, row) => sum + row.sampleGap, 0);
const top10FullSegments = segmentSummaryRows.filter((row) => row.top10Count >= 10).length;

const md = `# AI细分赛道头部公司Top10证据表

更新时间：${formatDateTime()}

## 一、本质判断

这份表不是普通公司名单，而是把“AI上中下游图谱”落到公司级求职证据：每个细分赛道最多取 Top10 公司，说明为什么看它、看什么销售/售前/销售管理岗位、现有 BOSS 样本是否支撑结论，以及下一步人工采样入口。

当前最大的矛盾是：公司池和公开资料已经能支撑“看哪些公司”，但 BOSS 平台样本仍不足以支撑“这些公司正在普遍招聘、薪资区间已经稳定”的结论。

## 二、总控看板

| 指标 | 当前值 |
| --- | ---: |
| 赛道数 | ${segmentSummaryRows.length} |
| Top10公司行 | ${topRows.length} |
| Top10满额赛道 | ${top10FullSegments}/${segmentSummaryRows.length} |
| Top10目标BOSS样本 | ${totalTargetSamples} |
| Top10当前BOSS样本 | ${totalCurrentSamples} |
| Top10样本缺口 | ${totalSampleGap} |

## 三、赛道Top10覆盖

| 路线 | 赛道 | Top10覆盖 | 已有BOSS样本公司 | Top10样本缺口 | 结论边界 | Top公司 |
| --- | --- | ---: | ---: | ---: | --- | --- |
${mdRows(segmentSummaryMdRows, "| 暂无 |  | 0/0 | 0 | 0 |  |  |")}

## 四、优先补证公司

这些入口只用于人工低频检索：先运行 \`npm run auth:boss\` 生成本地安全入口页，再手动打开普通 Chrome 访问 BOSS 首页，在站内搜索框输入关键词；不自动打开、不自动刷新 BOSS。

| 顺序 | 赛道 | 公司 | 下一岗位词 | 薪资观察 | BOSS样本 | 证据状态 | 首批批次 | BOSS首页 | 站内搜索关键词 |
| ---: | --- | --- | --- | --- | ---: | --- | --- | --- | --- |
${mdRows(priorityMdRows, "| 1 | 暂无 |  |  |  | 0/0 |  |  |  |  |")}

## 五、分赛道Top10公司

${segmentSections.join("\n\n")}

## 六、写报告规则

1. Top10公司表只能证明“应优先关注和采样”，不能单独证明“BOSS正在大量招聘”。
2. 公司行的薪资观察来自公开信号和少量BOSS样本，只有当可读薪资样本补齐后才能写成稳定薪资区间。
3. 结论边界仍以 \`AI市场资料集证据审计\` 和 \`AI销售市场结论权限总控\` 为准。
4. 当前最有效动作是按“优先补证公司”人工复制岗位详情，再导入本地样本库。

CSV明细：${outputCsvPath}
`;

mkdirSync(dirname(outputCsvPath), { recursive: true });
writeFileSync(outputCsvPath, csv([headers, ...topRows.map((row) => headers.map((header) => row[header]))]));
writeFileSync(outputMdPath, md);

console.log(`已生成：${outputMdPath}`);
console.log(`已生成：${outputCsvPath}`);
console.log(`Top10公司行：${topRows.length}`);
console.log(`Top10目标BOSS样本：${totalTargetSamples}`);
console.log(`Top10当前BOSS样本：${totalCurrentSamples}`);
console.log(`Top10样本缺口：${totalSampleGap}`);
