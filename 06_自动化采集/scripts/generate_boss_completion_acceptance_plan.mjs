#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const roadmapPath = join(projectRoot, "01_行情收集/BOSS全行业样本缺口路线图.csv");
const companyGapPath = join(projectRoot, "01_行情收集/BOSS目标公司采样缺口看板.csv");
const sampleQualityPath = join(projectRoot, "01_行情收集/BOSS样本质量验收报告.csv");
const readableSalaryPath = join(projectRoot, "01_行情收集/BOSS可读薪资样本.csv");
const batchQualityPath = join(projectRoot, "01_行情收集/BOSS人工采样批次质量门禁.csv");
const firstExecutionPath = join(projectRoot, "01_行情收集/BOSS首批人工采样执行单.csv");
const focusBatchPath = join(projectRoot, "01_行情收集/BOSS重点公司补样批次包.csv");
const manualBatchPath = join(projectRoot, "01_行情收集/BOSS人工采样批次包.csv");
const radarPath = join(projectRoot, "01_行情收集/AI销售薪资能力证据雷达.csv");
const crossMatrixPath = join(projectRoot, "01_行情收集/AI销售岗位公司类型岗位族交叉看板.csv");
const jobsPath = join(projectRoot, "01_行情收集/data/jobs.jsonl");

const outputCsvPath = join(projectRoot, "01_行情收集/BOSS大样本完成门槛与验收路线.csv");
const outputMdPath = join(projectRoot, "01_行情收集/BOSS大样本完成门槛与验收路线.md");

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

function readJsonl(filePath) {
  if (!existsSync(filePath)) return [];
  return readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function isBossJob(job) {
  return !job.source || job.source === "BOSS直聘";
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
  return /^(true|是|可读|1)$/i.test(String(value || "").trim());
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

function topJoined(items, limit = 8, separator = "、") {
  return uniq(items).slice(0, limit).join(separator);
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

function priorityRank(value) {
  if (/P0/.test(value || "")) return 3;
  if (/P1/.test(value || "")) return 2;
  if (/P2/.test(value || "")) return 1;
  return 0;
}

function roleCoverageRequired(priority, targetSamples) {
  if (/P0/.test(priority || "")) return 3;
  if (/P1/.test(priority || "")) return 2;
  return Math.min(2, Math.max(1, Math.ceil(targetSamples / 6)));
}

function companyCoverageRequired(priority, companyCount) {
  if (!companyCount) return /P0/.test(priority || "") ? 5 : 3;
  if (/P0/.test(priority || "")) return Math.min(6, Math.max(5, Math.ceil(companyCount / 2)));
  if (/P1/.test(priority || "")) return Math.min(5, Math.max(4, Math.ceil(companyCount / 2)));
  return Math.min(4, Math.max(3, Math.ceil(companyCount / 2)));
}

function salarySamplesRequired(priority, targetSamples) {
  if (/P0/.test(priority || "")) return Math.min(targetSamples, 6);
  return Math.min(targetSamples, 5);
}

function detailSamplesRequired(priority, targetSamples) {
  if (/P0/.test(priority || "")) return Math.min(targetSamples, 6);
  return Math.min(targetSamples, 4);
}

function evidenceStatus(row) {
  if (row.currentSamples <= 0) return "未开始：不能写BOSS结论";
  if (row.currentSamples < 3) return "案例观察：只能引用单点岗位";
  if (row.currentSamples < row.targetSamples) return "方向观察：不能写薪资中位数或普遍结论";
  const missingStrictGate =
    row.missingReadableSalary > 0 ||
    row.missingDetailSamples > 0 ||
    row.currentRoleFamilyCoverage < row.roleFamilyCoverageRequired ||
    row.currentCompanyCoverage < row.companyCoverageRequired;
  return missingStrictGate
    ? "赛道样本量达标但结构不足：暂缓薪资/公司覆盖结论"
    : "赛道验收通过：可写赛道小结";
}

function conclusionAllowed(row) {
  if (row.currentSamples <= 0) return "不能写BOSS结论";
  if (row.currentSamples < 3) return "只能写案例观察";
  if (row.currentSamples < row.targetSamples) return "可写方向性观察，不能外推全市场";
  if (row.missingReadableSalary > 0) return "可写岗位方向，薪资仍只能写公开假设";
  if (row.missingDetailSamples > 0) return "可写数量观察，能力要求仍需详情文本补证";
  if (row.currentRoleFamilyCoverage < row.roleFamilyCoverageRequired) return "可写赛道观察，岗位族覆盖不足";
  if (row.currentCompanyCoverage < row.companyCoverageRequired) return "可写赛道观察，公司覆盖不足";
  return "可写赛道小结";
}

function segmentMatches(row, segment) {
  return splitTerms(row.segment).includes(segment) || row.segment === segment;
}

function sortTasks(rows) {
  return rows.slice().sort((a, b) => {
    return numberOf(a.rank || a.globalOrder || a.taskInBatch) - numberOf(b.rank || b.globalOrder || b.taskInBatch);
  });
}

function taskKey(row) {
  return `${row.batchId || ""}|${row.company || ""}|${row.role || ""}|${row.roleFamily || ""}`;
}

function nextTasksFor(segment, taskSources) {
  const rows = taskSources.flatMap((source) => source.rows
    .filter((row) => segmentMatches(row, segment))
    .map((row) => ({ ...row, sourceName: source.name })));
  const seen = new Set();
  return sortTasks(rows)
    .filter((row) => {
      const key = taskKey(row);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
}

function firstNonEmpty(...values) {
  return values.find((value) => String(value || "").trim()) || "";
}

const roadmapRows = readCsv(roadmapPath);
const companyGapRows = readCsv(companyGapPath);
const qualityRows = readCsv(sampleQualityPath);
const readableSalaryRows = readCsv(readableSalaryPath);
const batchQualityRows = readCsv(batchQualityPath);
const firstExecutionRows = readCsv(firstExecutionPath);
const focusBatchRows = readCsv(focusBatchPath);
const manualBatchRows = readCsv(manualBatchPath);
const radarRows = readCsv(radarPath);
const crossRows = readCsv(crossMatrixPath);
const allJobs = readJsonl(jobsPath);
const jobs = allJobs.filter(isBossJob);

const taskSources = [
  { name: "首批执行单", rows: firstExecutionRows },
  { name: "重点公司批次", rows: focusBatchRows },
  { name: "人工采样批次", rows: manualBatchRows }
];

const acceptanceRows = roadmapRows.map((roadmap, index) => {
  const segment = roadmap.segment;
  const segmentCompanyRows = companyGapRows.filter((row) => row.segment === segment);
  const segmentQualityRows = qualityRows.filter((row) => row.segment === segment);
  const segmentSalaryRows = readableSalaryRows.filter((row) => row.segment === segment);
  const segmentRadarRows = radarRows.filter((row) => row.segment === segment);
  const segmentCrossRows = crossRows.filter((row) => row.segment === segment);
  const segmentBatchRows = batchQualityRows.filter((row) => segmentMatches(row, segment));
  const segmentTasks = nextTasksFor(segment, taskSources);

  const targetSamples = numberOf(roadmap.targetSamples);
  const currentSamples = numberOf(roadmap.importedJobs) || segmentQualityRows.length;
  const currentReadableSalary = Math.max(
    segmentSalaryRows.length,
    segmentQualityRows.filter((row) => boolOf(row.salaryReadable) || boolOf(row.salaryVisibility)).length
  );
  const currentDetailSamples = segmentQualityRows.filter((row) => numberOf(row.detailTextLength) >= 500).length;
  const currentRoleFamilyCoverage = uniq([
    ...segmentQualityRows.map((row) => row.roleFamily),
    ...segmentCrossRows.filter((row) => numberOf(row.bossUsableCount) > 0).map((row) => row.roleFamily)
  ]).length;
  const currentCompanyCoverage = uniq(segmentQualityRows.map((row) => row.company)).length;
  const companyCount = segmentCompanyRows.length || splitTerms(roadmap.topCompanies).length;
  const targetCompanyGap = segmentCompanyRows.reduce((sum, row) => sum + numberOf(row.sampleGap), 0);
  const requiredRoleFamilies = roleCoverageRequired(roadmap.priority, targetSamples);
  const requiredCompanies = companyCoverageRequired(roadmap.priority, companyCount);
  const requiredReadableSalary = salarySamplesRequired(roadmap.priority, targetSamples);
  const requiredDetailSamples = detailSamplesRequired(roadmap.priority, targetSamples);
  const missingBossSamples = Math.max(0, targetSamples - currentSamples);
  const missingReadableSalary = Math.max(0, requiredReadableSalary - currentReadableSalary);
  const missingDetailSamples = Math.max(0, requiredDetailSamples - currentDetailSamples);
  const firstWaveCoverage = firstExecutionRows.filter((row) => row.segment === segment).length;
  const nextBatchIds = topJoined([
    ...segmentTasks.map((row) => row.batchId),
    ...segmentBatchRows.map((row) => row.batchId)
  ], 6);
  const nextCompanies = topJoined(segmentTasks.map((row) => row.company), 8);
  const nextRoles = topJoined(segmentTasks.map((row) => firstNonEmpty(row.role, row.roleFamily)), 6);
  const strongestRadar = segmentRadarRows
    .slice()
    .sort((a, b) => numberOf(b.salaryEvidenceCount) - numberOf(a.salaryEvidenceCount))
    .slice(0, 3);

  const row = {
    rank: index + 1,
    priority: roadmap.priority || "",
    route: roadmap.route || "",
    segment,
    currentSamples,
    targetSamples,
    sampleGap: Math.max(0, targetSamples - currentSamples),
    minimumBossConclusionSamples: targetSamples,
    salaryConclusionSamples: requiredReadableSalary,
    roleFamilyCoverageRequired: requiredRoleFamilies,
    companyCoverageRequired: requiredCompanies,
    currentRoleFamilyCoverage,
    currentCompanyCoverage,
    currentReadableSalary,
    currentDetailSamples,
    targetCompanyGap,
    missingBossSamples,
    missingReadableSalary,
    missingDetailSamples,
    missingRoleFamilyCoverage: Math.max(0, requiredRoleFamilies - currentRoleFamilyCoverage),
    missingCompanyCoverage: Math.max(0, requiredCompanies - currentCompanyCoverage),
    firstWaveCoverage,
    nextBatchIds,
    nextCompanies,
    nextRoles,
    salaryBand: roadmap.salaryBand || "",
    publicSalaryMaxK: roadmap.publicSalaryMaxK || "",
    evidenceLevel: roadmap.evidenceLevel || "",
    nextAction: segmentTasks.length
      ? `先补 ${segmentTasks[0].company}/${firstNonEmpty(segmentTasks[0].role, segmentTasks[0].roleFamily)}，再按批次补 ${nextCompanies || "目标公司"}。`
      : "先生成或复核人工采样入口，再补高相关岗位详情。",
    acceptanceCriteria: [
      `BOSS样本 ${currentSamples}/${targetSamples}`,
      `可读薪资 ${currentReadableSalary}/${requiredReadableSalary}`,
      `详情文本 ${currentDetailSamples}/${requiredDetailSamples}`,
      `岗位族覆盖 ${currentRoleFamilyCoverage}/${requiredRoleFamilies}`,
      `公司覆盖 ${currentCompanyCoverage}/${requiredCompanies}`
    ].join("；"),
    supportingSignals: topJoined(strongestRadar.map((item) => `${item.roleFamily || item.role || "岗位族"} ${item.salaryBand || ""}`), 4),
    importCommand: segmentTasks[0]?.importCommand || roadmap.nextImportCommand || "",
    manualUrl: segmentTasks[0]?.manualUrl || segmentTasks[0]?.searchUrl || roadmap.nextSearchUrl || ""
  };
  return {
    ...row,
    evidenceStatus: evidenceStatus(row),
    conclusionAllowed: conclusionAllowed(row)
  };
}).sort((a, b) => {
  const priorityDiff = priorityRank(b.priority) - priorityRank(a.priority);
  if (priorityDiff) return priorityDiff;
  return b.sampleGap - a.sampleGap || b.targetCompanyGap - a.targetCompanyGap;
}).map((row, index) => ({ ...row, rank: index + 1 }));

const totalTargetSamples = acceptanceRows.reduce((sum, row) => sum + row.targetSamples, 0);
const totalCurrentSamples = acceptanceRows.reduce((sum, row) => sum + row.currentSamples, 0);
const totalSampleGap = acceptanceRows.reduce((sum, row) => sum + row.missingBossSamples, 0);
const totalReadableSalary = acceptanceRows.reduce((sum, row) => sum + row.currentReadableSalary, 0);
const totalReadableSalaryTarget = acceptanceRows.reduce((sum, row) => sum + row.salaryConclusionSamples, 0);
const totalDetailSamples = acceptanceRows.reduce((sum, row) => sum + row.currentDetailSamples, 0);
const totalDetailTarget = acceptanceRows.reduce((sum, row) => sum + detailSamplesRequired(row.priority, row.targetSamples), 0);
const totalCompanyGap = companyGapRows.reduce((sum, row) => sum + numberOf(row.sampleGap), 0);
const allIndustryMinimum = 80;
const allIndustryRecommended = 200;
const allIndustryMinimumGap = Math.max(0, allIndustryMinimum - jobs.length);
const passedSegments = acceptanceRows.filter((row) => row.conclusionAllowed === "可写赛道小结").length;
const directionSegments = acceptanceRows.filter((row) => row.conclusionAllowed.includes("方向性")).length;
const noConclusionSegments = acceptanceRows.filter((row) => row.conclusionAllowed === "不能写BOSS结论").length;

const routeRows = uniq(acceptanceRows.map((row) => row.route || "未分类")).map((route) => {
  const rows = acceptanceRows.filter((row) => (row.route || "未分类") === route);
  return {
    route,
    segments: rows.length,
    currentSamples: rows.reduce((sum, row) => sum + row.currentSamples, 0),
    targetSamples: rows.reduce((sum, row) => sum + row.targetSamples, 0),
    sampleGap: rows.reduce((sum, row) => sum + row.missingBossSamples, 0),
    readableSalary: rows.reduce((sum, row) => sum + row.currentReadableSalary, 0),
    readableSalaryTarget: rows.reduce((sum, row) => sum + row.salaryConclusionSamples, 0),
    detailSamples: rows.reduce((sum, row) => sum + row.currentDetailSamples, 0),
    detailTarget: rows.reduce((sum, row) => sum + detailSamplesRequired(row.priority, row.targetSamples), 0),
    topMissingSegments: rows
      .slice()
      .sort((a, b) => b.missingBossSamples - a.missingBossSamples)
      .slice(0, 4)
      .map((row) => row.segment)
      .join("、")
  };
}).sort((a, b) => b.sampleGap - a.sampleGap);

const headers = [
  "rank",
  "priority",
  "route",
  "segment",
  "currentSamples",
  "targetSamples",
  "sampleGap",
  "minimumBossConclusionSamples",
  "salaryConclusionSamples",
  "roleFamilyCoverageRequired",
  "companyCoverageRequired",
  "currentRoleFamilyCoverage",
  "currentCompanyCoverage",
  "currentReadableSalary",
  "currentDetailSamples",
  "targetCompanyGap",
  "missingBossSamples",
  "missingReadableSalary",
  "missingDetailSamples",
  "missingRoleFamilyCoverage",
  "missingCompanyCoverage",
  "evidenceStatus",
  "conclusionAllowed",
  "firstWaveCoverage",
  "nextBatchIds",
  "nextCompanies",
  "nextRoles",
  "salaryBand",
  "publicSalaryMaxK",
  "evidenceLevel",
  "supportingSignals",
  "nextAction",
  "acceptanceCriteria",
  "manualUrl",
  "importCommand"
];

mkdirSync(dirname(outputCsvPath), { recursive: true });
writeFileSync(outputCsvPath, `${csv([headers, ...acceptanceRows.map((row) => headers.map((header) => row[header]))])}\n`);

const globalRows = [
  ["BOSS干净样本", jobs.length, `全行业最小门槛 ${allIndustryMinimum}，建议门槛 ${allIndustryRecommended}`],
  ["赛道目标样本", `${totalCurrentSamples}/${totalTargetSamples}`, `缺口 ${totalSampleGap}`],
  ["可读薪资样本", `${totalReadableSalary}/${totalReadableSalaryTarget}`, "不足则不能写薪资中位数/普遍薪资"],
  ["详情文本样本", `${totalDetailSamples}/${totalDetailTarget}`, "不足则不能写能力要求实证结论"],
  ["目标公司采样缺口", totalCompanyGap, "用于判断公司覆盖是否足够"],
  ["可写赛道小结", `${passedSegments}/${acceptanceRows.length}`, "只统计同时满足样本、薪资、详情、岗位族、公司覆盖的赛道"],
  ["方向观察赛道", directionSegments, "能写方向，不能外推"],
  ["不能写BOSS结论赛道", noConclusionSegments, "只能写公开信号、公司池和补样动作"]
].map((row) => `| ${row[0]} | ${row[1]} | ${row[2]} |`);

const routeMdRows = routeRows.map((row) => {
  return `| ${row.route} | ${row.segments} | ${row.currentSamples}/${row.targetSamples} | ${row.sampleGap} | ${row.readableSalary}/${row.readableSalaryTarget} | ${row.detailSamples}/${row.detailTarget} | ${row.topMissingSegments || "-"} |`;
});

const segmentMdRows = acceptanceRows.map((row) => {
  return `| ${row.rank} | ${row.priority} | ${row.route} | ${row.segment} | ${row.currentSamples}/${row.targetSamples} | ${row.currentReadableSalary}/${row.salaryConclusionSamples} | ${row.currentDetailSamples}/${detailSamplesRequired(row.priority, row.targetSamples)} | ${row.currentRoleFamilyCoverage}/${row.roleFamilyCoverageRequired} | ${row.currentCompanyCoverage}/${row.companyCoverageRequired} | ${row.evidenceStatus} | ${row.nextCompanies || "-"} |`;
});

const nextRows = acceptanceRows
  .filter((row) => row.missingBossSamples > 0)
  .slice(0, 12)
  .map((row) => {
    return `| ${row.rank} | ${row.priority} | ${row.segment} | ${row.nextBatchIds || "-"} | ${row.nextCompanies || "-"} | ${row.nextRoles || "-"} | ${row.nextAction} |`;
  });

const md = `# BOSS大样本完成门槛与验收路线

更新时间：${formatDateTime()}

## 一、本质判断

这份文件不是再做一张采样清单，而是给“大而全 AI 销售岗位调研”设定验收门槛：什么时候只能写公开资料假设，什么时候可以写 BOSS 案例观察，什么时候能写赛道小结，什么时候才够资格写全行业大样本结论。

当前最大的矛盾是：AI产业链、公司池、岗位族和公开薪资框架已经很完整，但 BOSS 干净样本只有 ${jobs.length} 条；如果不设门槛，很容易把公开信号、历史缓存或个别岗位误写成 BOSS 平台结论。

## 二、总体验收门槛

| 指标 | 当前值 | 验收解释 |
| --- | ---: | --- |
${mdRows(globalRows, "| 暂无 | 0 | - |")}

全行业结论的硬门槛是至少 ${allIndustryMinimum} 条高相关 BOSS 样本，建议门槛是 ${allIndustryRecommended} 条。当前距离最小全行业门槛还差 ${allIndustryMinimumGap} 条；距离赛道目标样本总量还差 ${totalSampleGap} 条。因此现在只能交付“框架、公开信号、采样计划、少量 BOSS 方向观察”，不能交付“BOSS平台大样本最终结论”。

## 三、按路线看缺口

| 路线 | 赛道数 | BOSS样本进度 | 样本缺口 | 可读薪资 | 详情文本 | 优先补样赛道 |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
${mdRows(routeMdRows, "| 暂无 | 0 | 0/0 | 0 | 0/0 | 0/0 | - |")}

## 四、按赛道验收

| 排名 | 优先级 | 路线 | 赛道 | BOSS样本 | 可读薪资 | 详情文本 | 岗位族覆盖 | 公司覆盖 | 证据状态 | 下一批公司 |
| ---: | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
${mdRows(segmentMdRows, "| 1 | 暂无 |  |  | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 |  | - |")}

## 五、下一步执行路线

每次只处理一个入口，人工复制岗位详情，再导入收件箱或 \`import:manual\`。不要让脚本自动打开、刷新或读取 BOSS。

| 顺序 | 优先级 | 赛道 | 批次 | 公司 | 岗位词 | 动作 |
| ---: | --- | --- | --- | --- | --- | --- |
${mdRows(nextRows, "| 1 | 暂无 |  |  |  |  | - |")}

## 六、结论权限

1. 单赛道 0 条 BOSS 样本：不能写 BOSS 结论，只能写公司池、公开信号和补样动作。
2. 单赛道 1 到 2 条样本：只能写案例观察，不能写“普遍”。
3. 单赛道 3 条以上但未达目标：可以写方向性观察，不能写薪资中位数或全行业外推。
4. 单赛道样本量达标，但可读薪资、详情文本、岗位族或公司覆盖不足：可以写岗位方向，薪资和能力要求仍需标注“待样本校验”。
5. 单赛道同时满足样本量、可读薪资、详情文本、岗位族覆盖和公司覆盖：可以写赛道小结。
6. 全行业达到 ${allIndustryMinimum} 到 ${allIndustryRecommended} 条高相关 BOSS 样本后，才可把阶段性判断升级为 BOSS 平台大样本结论。

## 七、输出文件

\`\`\`text
${outputCsvPath}
${outputMdPath}
\`\`\`
`;

writeFileSync(outputMdPath, md);

console.log(`已生成：${outputMdPath}`);
console.log(`已生成：${outputCsvPath}`);
console.log(`BOSS干净样本：${jobs.length}`);
console.log(`赛道目标样本：${totalCurrentSamples}/${totalTargetSamples}`);
console.log(`赛道样本缺口：${totalSampleGap}`);
console.log(`全行业最小门槛缺口：${allIndustryMinimumGap}`);
console.log(`公司级采样缺口：${totalCompanyGap}`);
