#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const panoramaPath = join(projectRoot, "01_行情收集/AI销售岗位全景总览.csv");
const sampleQualityPath = join(projectRoot, "01_行情收集/BOSS样本质量验收报告.csv");
const companySamplingPath = join(projectRoot, "01_行情收集/BOSS目标公司采样缺口看板.csv");
const compensationPath = join(projectRoot, "01_行情收集/AI销售岗位薪资待遇与能力门槛分析.csv");
const capabilityPath = join(projectRoot, "02_岗位画像/AI销售岗位能力要求矩阵.csv");
const sampleGapPath = join(projectRoot, "01_行情收集/BOSS全行业样本缺口路线图.csv");
const outputMdPath = join(projectRoot, "01_行情收集/AI销售市场结论权限总控.md");
const outputCsvPath = join(projectRoot, "01_行情收集/AI销售市场结论权限总控.csv");

const supportFiles = [
  "AI销售岗位全景总览",
  "BOSS样本质量验收报告",
  "BOSS目标公司采样缺口看板",
  "AI销售岗位薪资待遇与能力门槛分析",
  "AI销售岗位能力要求矩阵"
].join("；");

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

function numberOf(value) {
  const num = Number.parseFloat(String(value || "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(num) ? num : 0;
}

function boolOf(value) {
  return String(value || "").toLowerCase() === "true" || value === "是";
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + numberOf(row[key]), 0);
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
  }).formatToParts(value instanceof Date ? value : new Date(value));
  const get = (type) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")} Asia/Shanghai`;
}

function uniq(items) {
  return [...new Set(items.filter(Boolean))];
}

function topCapabilities(capabilityRows, limit = 6) {
  return capabilityRows
    .slice()
    .sort((a, b) => numberOf(b.demandScore) - numberOf(a.demandScore))
    .slice(0, limit)
    .map((row) => row.capability)
    .join("；");
}

function segmentCapabilities(row) {
  return (row.coreCapabilities || row.mustHaveGate || "")
    .split(/[;；]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 6)
    .join("；");
}

function evidenceSnapshot({ bossUsable, salaryReadable, detailSamples, publicSalaryEvidence, companyCount, companyGap }) {
  return [
    `BOSS可用样本 ${bossUsable}`,
    `可读薪资 ${salaryReadable}`,
    `详情文本 ${detailSamples}`,
    `公开薪资证据 ${publicSalaryEvidence}`,
    `目标公司 ${companyCount}`,
    `公司级缺口 ${companyGap}`
  ].join("；");
}

function permissionForTopic(topic, metrics) {
  const { bossUsable, salaryReadable, detailSamples, publicSalaryEvidence, companyCount } = metrics;
  if (topic === "BOSS平台大样本结论") {
    if (bossUsable >= 80 && detailSamples >= 50) return "可写BOSS大样本结论";
    return "不能写BOSS平台结论";
  }
  if (topic === "薪资待遇") {
    if (bossUsable >= 8 && salaryReadable >= 5) return "可写BOSS薪资区间观察";
    if (publicSalaryEvidence >= 2) return "只能写公开薪资信号假设";
    return "不能写薪资结论";
  }
  if (topic === "岗位定位") {
    if (bossUsable >= 8 && detailSamples >= 5) return "可写BOSS岗位定位观察";
    if (bossUsable >= 3) return "可写BOSS方向性观察";
    if (companyCount > 0 || publicSalaryEvidence > 0) return "只能写公开信号假设";
    return "不能写BOSS平台结论";
  }
  if (topic === "能力要求") {
    if (bossUsable >= 8 && detailSamples >= 5) return "可写BOSS能力要求观察";
    if (bossUsable >= 3) return "可写BOSS方向性观察";
    return "可写能力趋势假设";
  }
  if (topic === "目标公司机会") {
    if (companyCount > 0) return "可写公司池和采样计划";
    return "不能写公司机会结论";
  }
  return "只能写公开信号假设";
}

function allowedWording(permission, topic, segment) {
  if (permission === "可写BOSS大样本结论") return "BOSS样本已达到阶段性大样本门槛，可以描述平台样本中的主要分布。";
  if (permission === "可写BOSS薪资区间观察") return `现有BOSS样本显示，${segment}的${topic}可作阶段性区间观察。`;
  if (permission === "可写BOSS岗位定位观察" || permission === "可写BOSS能力要求观察") return `现有BOSS样本显示，${segment}可作岗位/能力方向观察。`;
  if (permission === "可写BOSS方向性观察") return `现有少量BOSS样本显示，${segment}有方向性信号，但不能外推到全市场。`;
  if (permission === "可写公司池和采样计划") return `可写${segment}的目标公司池、优先岗位词和下一步采样计划。`;
  if (permission === "可写能力趋势假设") return `可基于公开信号和现有矩阵写${segment}能力趋势假设，需标注待BOSS样本校验。`;
  if (permission === "只能写公开薪资信号假设") return `只能写公开薪资信号显示的${segment}薪资假设，并标注非BOSS大样本统计。`;
  if (permission === "只能写公开信号假设") return `只能写公开资料和公司池显示的${segment}机会假设。`;
  return "仅能写缺口和补样动作，不能写市场结论。";
}

function forbiddenWording(permission) {
  if (permission.startsWith("可写BOSS")) return "不要写成最终结论；不要声称覆盖全行业全部岗位。";
  if (permission === "可写公司池和采样计划") return "不要声称这些公司在BOSS上普遍招聘或薪资已被验证。";
  if (permission.includes("公开")) return "不要写“BOSS数据显示”“市场普遍”“薪资中位数”。";
  return "不要写“BOSS上普遍如此”“该赛道薪资确定为”“头部公司都在招”。";
}

function nextAction(topic, metrics, fallbackAction) {
  const { bossUsable, salaryReadable, detailSamples, companyGap } = metrics;
  if (topic === "薪资待遇" && salaryReadable < 5) return "优先补可读薪资样本：每个核心赛道至少5条可读薪资。";
  if (detailSamples < 5) return "优先补岗位详情文本：复制职责、要求、经验、学历、客户类型和薪资。";
  if (bossUsable < 8) return "先补到8条高相关BOSS样本，再写岗位定位/能力观察。";
  if (companyGap > 0) return `按公司缺口继续人工补样，当前公司级缺口 ${companyGap}。`;
  return fallbackAction || "继续扩大样本并复核结论边界。";
}

function rowFor({ scope, route, segment, topic, metrics, capabilitySignal, action }) {
  const permission = permissionForTopic(topic, metrics);
  return {
    scope,
    route,
    segment,
    conclusionTopic: topic,
    currentEvidence: evidenceSnapshot(metrics),
    bossUsableSamples: metrics.bossUsable,
    readableSalarySamples: metrics.salaryReadable,
    detailSamples: metrics.detailSamples,
    companyCoveredCount: metrics.companyCount,
    sampledCompanyCount: metrics.sampledCompanyCount,
    companyGap: metrics.companyGap,
    publicSalaryEvidenceCount: metrics.publicSalaryEvidence,
    salaryBand: metrics.salaryBand || "",
    capabilitySignal,
    conclusionPermission: permission,
    allowedWording: allowedWording(permission, topic, segment || scope),
    forbiddenWording: forbiddenWording(permission),
    nextEvidenceAction: nextAction(topic, metrics, action),
    supportFiles
  };
}

function mdRows(rows, fallback) {
  return rows.length ? rows.join("\n") : fallback;
}

const panoramaRows = readCsv(panoramaPath);
const qualityRows = readCsv(sampleQualityPath);
const companyRows = readCsv(companySamplingPath);
const compensationRows = readCsv(compensationPath);
const capabilityRows = readCsv(capabilityPath);
const sampleGapRows = readCsv(sampleGapPath);

const allSegments = uniq([
  ...panoramaRows.map((row) => row.segment),
  ...sampleGapRows.map((row) => row.segment),
  ...companyRows.map((row) => row.segment)
]);

const totalBossUsable = qualityRows.filter((row) => row.roleRelevant === "true" && row.aiRelevant === "true" && /^A|^B/.test(row.qualityGrade || "")).length;
const totalReadableSalary = qualityRows.filter((row) => boolOf(row.salaryReadable)).length;
const totalDetailSamples = qualityRows.filter((row) => numberOf(row.detailTextLength) >= 300).length;
const totalCompanyGap = sum(companyRows, "sampleGap");
const sampledCompanies = companyRows.filter((row) => numberOf(row.currentSamples) > 0).length;
const globalCapabilitySignal = topCapabilities(capabilityRows);

const outputRows = [
  rowFor({
    scope: "全局",
    route: "全行业",
    segment: "AI销售全行业",
    topic: "BOSS平台大样本结论",
    metrics: {
      bossUsable: totalBossUsable,
      salaryReadable: totalReadableSalary,
      detailSamples: totalDetailSamples,
      publicSalaryEvidence: compensationRows.length,
      companyCount: companyRows.length,
      sampledCompanyCount: sampledCompanies,
      companyGap: totalCompanyGap,
      salaryBand: "8K-70K"
    },
    capabilitySignal: globalCapabilitySignal,
    action: "达到80到200条高相关样本前，不写BOSS大样本结论。"
  }),
  rowFor({
    scope: "全局",
    route: "全行业",
    segment: "AI销售全行业",
    topic: "薪资待遇",
    metrics: {
      bossUsable: totalBossUsable,
      salaryReadable: totalReadableSalary,
      detailSamples: totalDetailSamples,
      publicSalaryEvidence: compensationRows.length,
      companyCount: companyRows.length,
      sampledCompanyCount: sampledCompanies,
      companyGap: totalCompanyGap,
      salaryBand: "公开信号约8K-70K"
    },
    capabilitySignal: globalCapabilitySignal,
    action: "补足每个核心赛道至少5条可读薪资，再写薪资区间。"
  }),
  rowFor({
    scope: "全局",
    route: "全行业",
    segment: "AI销售全行业",
    topic: "能力要求",
    metrics: {
      bossUsable: totalBossUsable,
      salaryReadable: totalReadableSalary,
      detailSamples: totalDetailSamples,
      publicSalaryEvidence: compensationRows.length,
      companyCount: companyRows.length,
      sampledCompanyCount: sampledCompanies,
      companyGap: totalCompanyGap,
      salaryBand: ""
    },
    capabilitySignal: globalCapabilitySignal,
    action: "能力结论可先作为趋势假设，用后续岗位详情样本校验。"
  })
];

for (const segment of allSegments) {
  const panorama = panoramaRows.find((row) => row.segment === segment) || {};
  const sampleGap = sampleGapRows.find((row) => row.segment === segment) || {};
  const segmentQuality = qualityRows.filter((row) => row.segment === segment);
  const segmentCompanies = companyRows.filter((row) => row.segment === segment);
  const segmentCompensation = compensationRows.filter((row) => row.segment === segment);
  const metrics = {
    bossUsable: segmentQuality.filter((row) => row.roleRelevant === "true" && row.aiRelevant === "true" && /^A|^B/.test(row.qualityGrade || "")).length || numberOf(sampleGap.importedJobs),
    salaryReadable: segmentQuality.filter((row) => boolOf(row.salaryReadable)).length,
    detailSamples: segmentQuality.filter((row) => numberOf(row.detailTextLength) >= 300).length,
    publicSalaryEvidence: segmentCompensation.length || numberOf(panorama.salaryEvidenceCount),
    companyCount: segmentCompanies.length,
    sampledCompanyCount: segmentCompanies.filter((row) => numberOf(row.currentSamples) > 0).length,
    companyGap: sum(segmentCompanies, "sampleGap") || numberOf(sampleGap.sampleGap),
    salaryBand: panorama.salaryBand || sampleGap.salaryBand || ""
  };
  const route = panorama.route || sampleGap.route || segmentCompanies[0]?.route || "";
  const capabilitySignal = segmentCapabilities(panorama) || sampleGap.mustHaveGate || globalCapabilitySignal;
  const action = panorama.nextAction || sampleGap.nextTaskList || sampleGap.nextImportCommand || "";
  for (const topic of ["岗位定位", "薪资待遇", "能力要求", "目标公司机会"]) {
    outputRows.push(rowFor({
      scope: "赛道",
      route,
      segment,
      topic,
      metrics,
      capabilitySignal,
      action
    }));
  }
}

const csvHeaders = [
  "scope",
  "route",
  "segment",
  "conclusionTopic",
  "currentEvidence",
  "bossUsableSamples",
  "readableSalarySamples",
  "detailSamples",
  "companyCoveredCount",
  "sampledCompanyCount",
  "companyGap",
  "publicSalaryEvidenceCount",
  "salaryBand",
  "capabilitySignal",
  "conclusionPermission",
  "allowedWording",
  "forbiddenWording",
  "nextEvidenceAction",
  "supportFiles"
];

const csvText = csv([
  csvHeaders,
  ...outputRows.map((row) => csvHeaders.map((key) => row[key]))
]);

const permissionCounts = outputRows.reduce((map, row) => {
  map.set(row.conclusionPermission, (map.get(row.conclusionPermission) || 0) + 1);
  return map;
}, new Map());
const permissionRows = [...permissionCounts.entries()]
  .sort((a, b) => b[1] - a[1])
  .map(([permission, count]) => `| ${permission} | ${count} |`);

const blockedRows = outputRows
  .filter((row) => /不能写|只能写/.test(row.conclusionPermission))
  .slice(0, 18)
  .map((row) => `| ${row.scope} | ${row.segment} | ${row.conclusionTopic} | ${row.conclusionPermission} | ${row.nextEvidenceAction} |`);

const segmentRows = outputRows
  .filter((row) => row.scope === "赛道" && row.conclusionTopic === "岗位定位")
  .map((row) => `| ${row.route} | ${row.segment} | ${row.bossUsableSamples} | ${row.readableSalarySamples} | ${row.companyGap} | ${row.conclusionPermission} | ${row.allowedWording} |`);

const md = `# AI销售市场结论权限总控

更新时间：${formatDate()}

## 一、本质判断

这份文件不是岗位行情汇总，而是“结论权限门禁”。它决定最终市场报告里哪些话可以强写，哪些只能写成公开信号假设，哪些必须等 BOSS 样本补齐后再写。

当前最大的矛盾是：既要覆盖 AI 软件落地、大模型、芯片、半导体、算力、工业AI等全行业，又不能把 ${totalBossUsable} 条可用 BOSS 样本包装成全行业大样本结论。

## 二、全局门禁

| 指标 | 当前值 | 门槛判断 |
| --- | ---: | --- |
| BOSS可用样本 | ${totalBossUsable} | 低于80条，不能写BOSS全行业大样本结论 |
| BOSS可读薪资样本 | ${totalReadableSalary} | 低于全行业薪资统计门槛 |
| BOSS详情文本样本 | ${totalDetailSamples} | 只够局部观察，不够全行业能力统计 |
| 目标公司池 | ${companyRows.length} | 可写公司池和采样计划 |
| 已有样本公司 | ${sampledCompanies} | 公司级覆盖不足 |
| 公司级样本缺口 | ${totalCompanyGap} | 需要继续人工补样 |
| 公开薪资/岗位证据行 | ${compensationRows.length} | 可写公开信号假设，不能替代BOSS结论 |

## 三、权限分布

| 结论权限 | 条数 |
| --- | ---: |
${mdRows(permissionRows, "| 暂无 | 0 |")}

## 四、赛道结论权限

| 路线 | 赛道 | BOSS可用样本 | 可读薪资 | 公司级缺口 | 权限 | 允许写法 |
| --- | --- | ---: | ---: | ---: | --- | --- |
${mdRows(segmentRows, "| 暂无 |  | 0 | 0 | 0 |  |  |")}

## 五、禁止强写的结论

| 范围 | 赛道 | 结论主题 | 当前权限 | 下一步补证 |
| --- | --- | --- | --- | --- |
${mdRows(blockedRows, "| 暂无 |  |  |  |  |")}

## 六、落地规则

1. 写“BOSS数据显示”之前，必须检查对应行是否是“可写BOSS...”权限。
2. 写薪资区间之前，必须至少有 5 条可读薪资样本；否则只能写“公开薪资信号显示”。
3. 写月之暗面、智谱AI、MiniMax、寒武纪、海光信息、超聚变等重点公司时，若公司级样本为 0，只能写目标公司池和采样动作。
4. 写能力要求时，可以先写趋势假设，但要标注来自公开信号、能力矩阵和少量样本，待岗位详情样本校验。
5. 当前最优先动作不是继续扩大结论，而是补齐 P0 赛道和点名公司的岗位详情、薪资、经验、学历、职责和要求。

CSV明细：${outputCsvPath}
`;

mkdirSync(dirname(outputMdPath), { recursive: true });
writeFileSync(outputCsvPath, csvText);
writeFileSync(outputMdPath, md);

console.log(`已更新：${outputMdPath}`);
console.log(`已更新：${outputCsvPath}`);
console.log(`结论权限行数：${outputRows.length}`);
console.log(`可写BOSS强/方向结论：${outputRows.filter((row) => row.conclusionPermission.startsWith("可写BOSS")).length}`);
console.log(`只能写公开信号或不能写：${outputRows.filter((row) => /只能写|不能写/.test(row.conclusionPermission)).length}`);
