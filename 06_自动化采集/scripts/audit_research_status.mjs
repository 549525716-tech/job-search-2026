#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const jobsPath = join(projectRoot, "01_行情收集/data/jobs.jsonl");
const queryPlanPath = join(projectRoot, "01_行情收集/BOSS全行业AI销售岗位查询计划.csv");
const manualSamplingPackCsvPath = join(projectRoot, "01_行情收集/BOSS人工采样作业包.csv");
const manualSamplingPackMdPath = join(projectRoot, "01_行情收集/BOSS人工采样作业包.md");
const manualSamplingWorkbenchCsvPath = join(projectRoot, "01_行情收集/BOSS人工补样工作台.csv");
const manualSamplingWorkbenchMdPath = join(projectRoot, "01_行情收集/BOSS人工补样工作台.md");
const manualSamplingBatchCsvPath = join(projectRoot, "01_行情收集/BOSS人工采样批次包.csv");
const manualSamplingBatchMdPath = join(projectRoot, "01_行情收集/BOSS人工采样批次包.md");
const focusSamplingBatchCsvPath = join(projectRoot, "01_行情收集/BOSS重点公司补样批次包.csv");
const focusSamplingBatchMdPath = join(projectRoot, "01_行情收集/BOSS重点公司补样批次包.md");
const top10SamplingBatchCsvPath = join(projectRoot, "01_行情收集/BOSS细分赛道Top10公司采样批次包.csv");
const top10SamplingBatchMdPath = join(projectRoot, "01_行情收集/BOSS细分赛道Top10公司采样批次包.md");
const manualSamplingBatchStatusCsvPath = join(projectRoot, "01_行情收集/BOSS人工采样批次进度看板.csv");
const manualSamplingBatchStatusMdPath = join(projectRoot, "01_行情收集/BOSS人工采样批次进度看板.md");
const manualSamplingBatchQualityCsvPath = join(projectRoot, "01_行情收集/BOSS人工采样批次质量门禁.csv");
const manualSamplingBatchQualityMdPath = join(projectRoot, "01_行情收集/BOSS人工采样批次质量门禁.md");
const firstManualSamplingExecutionCsvPath = join(projectRoot, "01_行情收集/BOSS首批人工采样执行单.csv");
const firstManualSamplingExecutionMdPath = join(projectRoot, "01_行情收集/BOSS首批人工采样执行单.md");
const firstManualSamplingInboxPath = join(projectRoot, "01_行情收集/BOSS首批人工采样收件箱.md");
const firstManualSamplingInboxTemplatePath = join(projectRoot, "01_行情收集/BOSS首批人工采样收件箱模板.md");
const firstManualSamplingInboxQualityCsvPath = join(projectRoot, "01_行情收集/BOSS首批人工采样收件箱质量预检.csv");
const firstManualSamplingInboxQualityMdPath = join(projectRoot, "01_行情收集/BOSS首批人工采样收件箱质量预检.md");
const nextSamplingQueueCsvPath = join(projectRoot, "01_行情收集/BOSS下一轮优先采样清单.csv");
const nextSamplingQueueMdPath = join(projectRoot, "01_行情收集/BOSS下一轮优先采样清单.md");
const samplingStatusCsvPath = join(projectRoot, "01_行情收集/BOSS采样进度看板.csv");
const samplingStatusMdPath = join(projectRoot, "01_行情收集/BOSS采样进度看板.md");
const bossSampleGapCsvPath = join(projectRoot, "01_行情收集/BOSS全行业样本缺口路线图.csv");
const bossSampleGapMdPath = join(projectRoot, "01_行情收集/BOSS全行业样本缺口路线图.md");
const bossCompletionAcceptanceCsvPath = join(projectRoot, "01_行情收集/BOSS大样本完成门槛与验收路线.csv");
const bossCompletionAcceptanceMdPath = join(projectRoot, "01_行情收集/BOSS大样本完成门槛与验收路线.md");
const conclusionUpgradeConsoleCsvPath = join(projectRoot, "01_行情收集/BOSS结论升级采样控制台.csv");
const conclusionUpgradeConsoleMdPath = join(projectRoot, "01_行情收集/BOSS结论升级采样控制台.md");
const bossSampleQualityCsvPath = join(projectRoot, "01_行情收集/BOSS样本质量验收报告.csv");
const bossSampleQualityMdPath = join(projectRoot, "01_行情收集/BOSS样本质量验收报告.md");
const salaryCapabilityBoardPath = join(projectRoot, "01_行情收集/BOSS薪资能力信号看板.md");
const readableSalaryCsvPath = join(projectRoot, "01_行情收集/BOSS可读薪资样本.csv");
const roleSalaryMatrixCsvPath = join(projectRoot, "01_行情收集/AI销售岗位薪资能力矩阵.csv");
const roleSalaryMatrixMdPath = join(projectRoot, "01_行情收集/AI销售岗位薪资能力矩阵.md");
const compensationGateAnalysisCsvPath = join(projectRoot, "01_行情收集/AI销售岗位薪资待遇与能力门槛分析.csv");
const compensationGateAnalysisMdPath = join(projectRoot, "01_行情收集/AI销售岗位薪资待遇与能力门槛分析.md");
const decisionOverviewCsvPath = join(projectRoot, "01_行情收集/AI销售岗位市场决策总览.csv");
const decisionOverviewMdPath = join(projectRoot, "01_行情收集/AI销售岗位市场决策总览.md");
const salaryCapabilityRadarCsvPath = join(projectRoot, "01_行情收集/AI销售薪资能力证据雷达.csv");
const salaryCapabilityRadarMdPath = join(projectRoot, "01_行情收集/AI销售薪资能力证据雷达.md");
const segmentOpportunityMatrixCsvPath = join(projectRoot, "01_行情收集/AI细分赛道销售机会矩阵.csv");
const segmentOpportunityMatrixMdPath = join(projectRoot, "01_行情收集/AI细分赛道销售机会矩阵.md");
const capabilityRequirementCsvPath = join(projectRoot, "02_岗位画像/AI销售岗位能力要求矩阵.csv");
const capabilityRequirementMdPath = join(projectRoot, "02_岗位画像/AI销售岗位能力要求矩阵.md");
const publicSignalBoardCsvPath = join(projectRoot, "01_行情收集/AI行业公开趋势信号看板.csv");
const publicSignalBoardMdPath = join(projectRoot, "01_行情收集/AI行业公开趋势信号看板.md");
const bossLocalCacheEvidenceCsvPath = join(projectRoot, "01_行情收集/BOSS历史缓存候选线索库.csv");
const bossLocalCacheEvidenceMdPath = join(projectRoot, "01_行情收集/BOSS历史缓存候选线索库.md");
const hardwareSpecialReportCsvPath = join(projectRoot, "01_行情收集/AI硬件算力半导体销售岗位专项分析.csv");
const hardwareSpecialReportMdPath = join(projectRoot, "01_行情收集/AI硬件算力半导体销售岗位专项分析.md");
const hardwarePriorityQueueCsvPath = join(projectRoot, "01_行情收集/BOSS硬件算力半导体优先采样清单.csv");
const hardwarePriorityQueueMdPath = join(projectRoot, "01_行情收集/BOSS硬件算力半导体优先采样清单.md");
const publicRecruitmentEvidenceCsvPath = join(projectRoot, "01_行情收集/AI公开招聘薪资证据库.csv");
const publicRecruitmentEvidenceMdPath = join(projectRoot, "01_行情收集/AI公开招聘薪资证据库.md");
const marketDecisionHandbookCsvPath = join(projectRoot, "01_行情收集/AI销售岗位全行业决策手册.csv");
const marketDecisionHandbookMdPath = join(projectRoot, "01_行情收集/AI销售岗位全行业决策手册.md");
const marketPanoramaBriefCsvPath = join(projectRoot, "01_行情收集/AI销售岗位全景总览.csv");
const marketPanoramaBriefMdPath = join(projectRoot, "01_行情收集/AI销售岗位全景总览.md");
const marketDeliveryBriefCsvPath = join(projectRoot, "01_行情收集/AI销售岗位市场调研交付版.csv");
const marketDeliveryBriefMdPath = join(projectRoot, "01_行情收集/AI销售岗位市场调研交付版.md");
const roleCompanyCrossMatrixCsvPath = join(projectRoot, "01_行情收集/AI销售岗位公司类型岗位族交叉看板.csv");
const roleCompanyCrossMatrixMdPath = join(projectRoot, "01_行情收集/AI销售岗位公司类型岗位族交叉看板.md");
const companyOpportunityMapCsvPath = join(projectRoot, "00_行业资料集/AI产业链头部公司岗位机会地图.csv");
const companyOpportunityMapMdPath = join(projectRoot, "00_行业资料集/AI产业链头部公司岗位机会地图.md");
const segmentTopCompanyEvidenceCsvPath = join(projectRoot, "00_行业资料集/AI细分赛道头部公司Top10证据表.csv");
const segmentTopCompanyEvidenceMdPath = join(projectRoot, "00_行业资料集/AI细分赛道头部公司Top10证据表.md");
const industryLandscapeCompanyCsvPath = join(projectRoot, "00_行业资料集/AI产业链公司资料集.csv");
const industryLandscapeCompanyMdPath = join(projectRoot, "00_行业资料集/AI产业链公司资料集.md");
const industryLandscapeSegmentCsvPath = join(projectRoot, "00_行业资料集/AI产业链销售岗位图谱.csv");
const companySegmentProfileCsvPath = join(projectRoot, "00_行业资料集/AI销售目标公司分层画像.csv");
const companySegmentProfileMdPath = join(projectRoot, "00_行业资料集/AI销售目标公司分层画像.md");
const companyTypeMatrixCsvPath = join(projectRoot, "00_行业资料集/AI销售公司类型岗位打法对照表.csv");
const companyTypeMatrixMdPath = join(projectRoot, "00_行业资料集/AI销售公司类型岗位打法对照表.md");
const targetCompanyPlaybookCsvPath = join(projectRoot, "00_行业资料集/AI目标公司销售岗位打法清单.csv");
const targetCompanyPlaybookMdPath = join(projectRoot, "00_行业资料集/AI目标公司销售岗位打法清单.md");
const targetCompanySamplingCsvPath = join(projectRoot, "01_行情收集/BOSS目标公司采样缺口看板.csv");
const targetCompanySamplingMdPath = join(projectRoot, "01_行情收集/BOSS目标公司采样缺口看板.md");
const focusCoverageAuditCsvPath = join(projectRoot, "01_行情收集/AI重点公司与赛道覆盖审计.csv");
const focusCoverageAuditMdPath = join(projectRoot, "01_行情收集/AI重点公司与赛道覆盖审计.md");
const marketConclusionGateCsvPath = join(projectRoot, "01_行情收集/AI销售市场结论权限总控.csv");
const marketConclusionGateMdPath = join(projectRoot, "01_行情收集/AI销售市场结论权限总控.md");
const marketEvidenceAuditCsvPath = join(projectRoot, "01_行情收集/AI市场资料集证据审计.csv");
const marketEvidenceAuditMdPath = join(projectRoot, "01_行情收集/AI市场资料集证据审计.md");
const roleProfilePath = join(projectRoot, "02_岗位画像/AI全行业销售岗位分层画像.md");
const resumeGapCsvPath = join(projectRoot, "03_简历/AI销售岗位匹配与能力Gap.csv");
const resumeGapMdPath = join(projectRoot, "03_简历/AI销售岗位匹配与能力Gap.md");
const resumeEvidenceCsvPath = join(projectRoot, "03_简历/AI销售能力证据与简历改写矩阵.csv");
const resumeEvidenceMdPath = join(projectRoot, "03_简历/AI销售能力证据与简历改写矩阵.md");
const resumeMarketClosureCsvPath = join(projectRoot, "03_简历/AI销售市场到简历证据闭环.csv");
const resumeMarketClosureMdPath = join(projectRoot, "03_简历/AI销售市场到简历证据闭环.md");
const personalProfilePath = join(projectRoot, "02_岗位画像/data/我的能力画像.json");
const profileInboxPath = join(projectRoot, "02_岗位画像/我的能力画像收件箱.md");
const profileInboxTemplatePath = join(projectRoot, "02_岗位画像/我的能力画像收件箱模板.md");
const resumeMaterialPath = join(projectRoot, "03_简历/简历素材库.md");
const externalSalaryPath = join(projectRoot, "06_自动化采集/config/external_salary_signals.csv");
const bossSignalsPath = join(projectRoot, "06_自动化采集/config/boss_public_company_signals.csv");
const publicMarketSourcesPath = join(projectRoot, "06_自动化采集/config/public_market_sources.csv");
const rateLimitConfigPath = join(projectRoot, "06_自动化采集/config/rate_limits.json");
const processedDir = join(projectRoot, "01_行情收集/data/processed");
const rateLimitStatePath = join(processedDir, "boss_rate_limit_state.json");
const auditPath = process.env.RESEARCH_AUDIT_OUTPUT_PATH || join(projectRoot, "01_行情收集/AI调研进度与缺口.md");

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function readLineCount(filePath, hasHeader = false) {
  if (!existsSync(filePath)) return 0;
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/).filter((line) => line.trim());
  return Math.max(0, lines.length - (hasHeader ? 1 : 0));
}

function parseCsvLineForAudit(line) {
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

function csvRecords(filePath) {
  if (!existsSync(filePath)) return [];
  const lines = readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLineForAudit(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLineForAudit(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
  });
}

function sumCsvColumn(filePath, columnName) {
  if (!existsSync(filePath)) return 0;
  const lines = readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim());
  if (lines.length < 2) return 0;
  const headers = parseCsvLineForAudit(lines[0]);
  const columnIndex = headers.indexOf(columnName);
  if (columnIndex === -1) return 0;
  return lines
    .slice(1)
    .reduce((sum, line) => sum + Number.parseFloat(parseCsvLineForAudit(line)[columnIndex] || "0"), 0);
}

function readBatchCount(filePath) {
  if (!existsSync(filePath)) return 0;
  return new Set(readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.split(",")[1])
    .filter(Boolean)).size;
}

function cleanInboxText(text) {
  return String(text || "")
    .split(/\r?\n/)
    .filter((line) => !/^在这里粘贴 .+ 的岗位详情。导入后可清空本段文本，保留标记。$/.test(line.trim()))
    .join("\n")
    .trim();
}

function inboxStats(filePath) {
  if (!existsSync(filePath)) return { tasks: 0, ready: 0 };
  const text = readFileSync(filePath, "utf8");
  const pattern = /<!-- BOSS_INBOX_TASK_START -->[\s\S]*?<!-- BOSS_INBOX_TASK_END -->[\s\S]*?<!-- BOSS_INBOX_TEXT_START -->\s*([\s\S]*?)\s*<!-- BOSS_INBOX_TEXT_END -->/g;
  let tasks = 0;
  let ready = 0;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    tasks += 1;
    if (cleanInboxText(match[1])) ready += 1;
  }
  return { tasks, ready };
}

function cleanProfileInboxText(text) {
  return String(text || "")
    .split(/\r?\n/)
    .filter((line) => !/^在这里粘贴/.test(line.trim()))
    .filter((line) => !/^可选字段：/.test(line.trim()))
    .join("\n")
    .trim();
}

function profileInboxStats(filePath) {
  if (!existsSync(filePath)) return { tasks: 0, ready: 0 };
  const text = readFileSync(filePath, "utf8");
  const pattern = /<!-- PROFILE_INBOX_ITEM_START -->[\s\S]*?<!-- PROFILE_INBOX_TEXT_START -->\s*([\s\S]*?)\s*<!-- PROFILE_INBOX_TEXT_END -->[\s\S]*?<!-- PROFILE_INBOX_ITEM_END -->/g;
  let tasks = 0;
  let ready = 0;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    tasks += 1;
    if (cleanProfileInboxText(match[1])) ready += 1;
  }
  return { tasks, ready };
}

function personalProfileStats(filePath) {
  if (!existsSync(filePath)) return { ready: false, skills: 0, evidence: 0 };
  const profile = readJson(filePath);
  const skills = Array.isArray(profile.skills)
    ? profile.skills.filter((item) => String(item?.name || "").trim()).length
    : 0;
  const evidence = Array.isArray(profile.evidence)
    ? profile.evidence.filter((item) => String([
      item?.skill,
      item?.project,
      item?.context,
      item?.action,
      item?.result,
      item?.proof
    ].join("")).trim()).length
    : 0;
  const ready = Boolean(String(profile.currentSummary || "").trim() || skills || evidence);
  return { ready, skills, evidence };
}

function latestFile(prefix) {
  if (!existsSync(processedDir)) return "";
  const files = readdirSync(processedDir)
    .filter((name) => name.startsWith(prefix) && name.endsWith(".json"))
    .map((name) => join(processedDir, name))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return files[0] || "";
}

function formatDateTime(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")} Asia/Shanghai`;
}

function statusLabel(tabs) {
  if (tabs === null) return "未检查（控制链路隔离）";
  if (!Array.isArray(tabs)) return "浏览器状态未知";
  if (tabs.some((tab) => /安全验证|verify\.html|captcha|_security_check/i.test(`${tab.title}\n${tab.url}`))) {
    return "BOSS安全验证中";
  }
  if (tabs.some((tab) => /zhipin\.com/.test(tab.url || ""))) return "BOSS页面可见";
  return "未发现BOSS页面";
}

function collectionAdvice(bossStatus, rateLimitConfig) {
  const boss = rateLimitConfig.boss || {};
  if (bossStatus === "未检查（控制链路隔离）") {
    return "暂停自动采集；控制链路隔离，保留当前登录标签，不要求重复登录";
  }
  if (boss.riskRecoveryMode === "manual_first" || boss.requireResumeFlag) {
    return "不建议立即自动采集，当前策略为人工采样优先";
  }
  if (bossStatus === "BOSS页面可见") return "可以极小批量采集";
  return "不建议，需先处理验证/登录态";
}

const browserCheck = {
  status: "BROWSER_CHECK_ISOLATED",
  message: "审计仅读取本地证据；未访问 9333/CDP 或登录标签。"
};
const version = { error: browserCheck.status };
const tabs = null;
const rateLimitConfig = existsSync(rateLimitConfigPath) ? readJson(rateLimitConfigPath) : {};
const rateLimitState = existsSync(rateLimitStatePath) ? readJson(rateLimitStatePath) : {};
const latestOvernight = latestFile("overnight_research_");
const latestCollect = latestFile("collect_run_");
const overnightData = latestOvernight ? readJson(latestOvernight) : null;
const collectData = latestCollect ? readJson(latestCollect) : null;
const bossJobs = readLineCount(jobsPath);
const queryCount = readLineCount(queryPlanPath, true);
const manualSamplingTaskCount = readLineCount(manualSamplingPackCsvPath, true);
const manualSamplingWorkbenchCount = readLineCount(manualSamplingWorkbenchCsvPath, true);
const manualSamplingBatchEntryCount = readLineCount(manualSamplingBatchCsvPath, true);
const manualSamplingBatchCount = readBatchCount(manualSamplingBatchCsvPath);
const focusSamplingBatchEntryCount = readLineCount(focusSamplingBatchCsvPath, true);
const focusSamplingBatchCount = readBatchCount(focusSamplingBatchCsvPath);
const top10SamplingBatchEntryCount = readLineCount(top10SamplingBatchCsvPath, true);
const top10SamplingBatchCount = readBatchCount(top10SamplingBatchCsvPath);
const manualSamplingBatchStatusCount = readLineCount(manualSamplingBatchStatusCsvPath, true);
const manualSamplingBatchDoneCount = existsSync(manualSamplingBatchStatusCsvPath)
  ? readFileSync(manualSamplingBatchStatusCsvPath, "utf8")
    .split(/\r?\n/)
    .slice(1)
    .filter((line) => line.includes(",达标,")).length
  : 0;
const manualSamplingBatchQualityCount = readLineCount(manualSamplingBatchQualityCsvPath, true);
const manualSamplingBatchQualityDoneCount = existsSync(manualSamplingBatchQualityCsvPath)
  ? readFileSync(manualSamplingBatchQualityCsvPath, "utf8")
    .split(/\r?\n/)
    .slice(1)
    .filter((line) => line.startsWith("批次,") && line.includes(",达标,"))
    .length
  : 0;
const firstManualSamplingExecutionCount = readLineCount(firstManualSamplingExecutionCsvPath, true);
const firstManualSamplingTargetCopies = sumCsvColumn(firstManualSamplingExecutionCsvPath, "targetCopies");
const firstManualSamplingInboxStats = inboxStats(firstManualSamplingInboxPath);
const firstManualSamplingInboxQualityRows = csvRecords(firstManualSamplingInboxQualityCsvPath);
const firstManualSamplingInboxQualityReadyCount = firstManualSamplingInboxQualityRows
  .filter((row) => row.readyToImport === "是").length;
const firstManualSamplingInboxQualityEstimatedJobs = firstManualSamplingInboxQualityRows
  .reduce((sum, row) => sum + Number(row.estimatedJobs || 0), 0);
const firstManualSamplingInboxQualityTargetCopies = firstManualSamplingInboxQualityRows
  .reduce((sum, row) => sum + Number(row.targetCopies || 0), 0);
const profileInboxState = profileInboxStats(profileInboxPath);
const personalProfileState = personalProfileStats(personalProfilePath);
const nextSamplingQueueCount = readLineCount(nextSamplingQueueCsvPath, true);
const samplingStatusSegmentCount = readLineCount(samplingStatusCsvPath, true);
const bossSampleGapCount = readLineCount(bossSampleGapCsvPath, true);
const bossCompletionAcceptanceCount = readLineCount(bossCompletionAcceptanceCsvPath, true);
const bossCompletionSampleGap = sumCsvColumn(bossCompletionAcceptanceCsvPath, "missingBossSamples");
const bossCompletionReadableSalaryGap = sumCsvColumn(bossCompletionAcceptanceCsvPath, "missingReadableSalary");
const bossCompletionDetailGap = sumCsvColumn(bossCompletionAcceptanceCsvPath, "missingDetailSamples");
const conclusionUpgradeConsoleCount = readLineCount(conclusionUpgradeConsoleCsvPath, true);
const bossSampleQualityCount = readLineCount(bossSampleQualityCsvPath, true);
const readableSalaryCount = readLineCount(readableSalaryCsvPath, true);
const roleSalaryMatrixCount = readLineCount(roleSalaryMatrixCsvPath, true);
const compensationGateAnalysisCount = readLineCount(compensationGateAnalysisCsvPath, true);
const decisionOverviewCount = readLineCount(decisionOverviewCsvPath, true);
const salaryCapabilityRadarCount = readLineCount(salaryCapabilityRadarCsvPath, true);
const segmentOpportunityMatrixCount = readLineCount(segmentOpportunityMatrixCsvPath, true);
const capabilityRequirementCount = readLineCount(capabilityRequirementCsvPath, true);
const publicSignalBoardCount = readLineCount(publicSignalBoardCsvPath, true);
const bossLocalCacheEvidenceCount = readLineCount(bossLocalCacheEvidenceCsvPath, true);
const hardwareSpecialReportCount = readLineCount(hardwareSpecialReportCsvPath, true);
const hardwarePriorityQueueCount = readLineCount(hardwarePriorityQueueCsvPath, true);
const publicRecruitmentEvidenceCount = readLineCount(publicRecruitmentEvidenceCsvPath, true);
const marketDecisionHandbookCount = readLineCount(marketDecisionHandbookCsvPath, true);
const marketPanoramaBriefCount = readLineCount(marketPanoramaBriefCsvPath, true);
const marketDeliveryBriefCount = readLineCount(marketDeliveryBriefCsvPath, true);
const roleCompanyCrossMatrixCount = readLineCount(roleCompanyCrossMatrixCsvPath, true);
const companyOpportunityCount = readLineCount(companyOpportunityMapCsvPath, true);
const segmentTopCompanyEvidenceCount = readLineCount(segmentTopCompanyEvidenceCsvPath, true);
const industryLandscapeCompanyCount = readLineCount(industryLandscapeCompanyCsvPath, true);
const industryLandscapeSegmentCount = readLineCount(industryLandscapeSegmentCsvPath, true);
const companySegmentProfileCount = readLineCount(companySegmentProfileCsvPath, true);
const companyTypeMatrixCount = readLineCount(companyTypeMatrixCsvPath, true);
const targetCompanyPlaybookCount = readLineCount(targetCompanyPlaybookCsvPath, true);
const targetCompanySamplingCount = readLineCount(targetCompanySamplingCsvPath, true);
const focusCoverageAuditCount = readLineCount(focusCoverageAuditCsvPath, true);
const marketConclusionGateCount = readLineCount(marketConclusionGateCsvPath, true);
const marketEvidenceAuditCount = readLineCount(marketEvidenceAuditCsvPath, true);
const resumeGapCount = readLineCount(resumeGapCsvPath, true);
const resumeEvidenceCount = readLineCount(resumeEvidenceCsvPath, true);
const resumeMarketClosureCount = readLineCount(resumeMarketClosureCsvPath, true);
const externalSalaryCount = readLineCount(externalSalaryPath, true);
const bossSignalCount = readLineCount(bossSignalsPath, true);
const publicMarketSourceCount = readLineCount(publicMarketSourcesPath, true);
const roleProfileReady = existsSync(roleProfilePath);
const bossStatus = statusLabel(tabs);
const tabsRows = Array.isArray(tabs)
  ? tabs
    .filter((tab) => tab.type === "page")
    .map((tab) => `| ${tab.title || ""} | ${tab.url || ""} |`)
    .join("\n")
  : tabs === null
    ? "| 未检查（控制链路隔离） | - |"
    : "| 浏览器状态未知 | - |";

const immediateCollectionAdvice = collectionAdvice(bossStatus, rateLimitConfig);
const report = `# AI调研进度与缺口

更新时间：${formatDateTime()}

## 一、当前状态

| 项目 | 状态 |
| --- | --- |
| 浏览器检查 | ${browserCheck.message} |
| CDP端口 | 已隔离：${version.error} |
| BOSS状态 | ${bossStatus} |
| 是否建议立即自动采集 | ${immediateCollectionAdvice} |
| BOSS干净岗位样本 | ${bossJobs} |
| BOSS全行业查询计划 | ${queryCount} 条 |
| BOSS人工采样作业包 | ${manualSamplingTaskCount ? `${manualSamplingTaskCount} 条` : "未生成"} |
| BOSS人工补样工作台 | ${manualSamplingWorkbenchCount ? `${manualSamplingWorkbenchCount} 条任务` : "未生成"} |
| BOSS人工采样批次包 | ${manualSamplingBatchEntryCount ? `${manualSamplingBatchCount} 批 / ${manualSamplingBatchEntryCount} 个入口` : "未生成"} |
| BOSS重点公司补样批次包 | ${focusSamplingBatchEntryCount ? `${focusSamplingBatchCount} 批 / ${focusSamplingBatchEntryCount} 个入口` : "未生成"} |
| BOSS细分赛道Top10公司采样批次包 | ${top10SamplingBatchEntryCount ? `${top10SamplingBatchCount} 批 / ${top10SamplingBatchEntryCount} 个入口` : "未生成"} |
| BOSS人工采样批次进度 | ${manualSamplingBatchStatusCount ? `${manualSamplingBatchDoneCount}/${manualSamplingBatchStatusCount} 批达标` : "未生成"} |
| BOSS人工采样批次质量门禁 | ${manualSamplingBatchQualityCount ? `${manualSamplingBatchQualityDoneCount} 批达标 / ${manualSamplingBatchQualityCount} 行门禁` : "未生成"} |
| BOSS首批人工采样执行单 | ${firstManualSamplingExecutionCount ? `${firstManualSamplingExecutionCount} 个入口 / 目标 ${firstManualSamplingTargetCopies} 条` : "未生成"} |
| BOSS首批人工采样收件箱 | ${firstManualSamplingInboxStats.tasks ? `${firstManualSamplingInboxStats.ready}/${firstManualSamplingInboxStats.tasks} 个段落已粘贴` : "未生成"} |
| BOSS首批人工采样质量预检 | ${firstManualSamplingInboxQualityRows.length ? `${firstManualSamplingInboxQualityReadyCount}/${firstManualSamplingInboxQualityRows.length} 段可导入 / 估算 ${firstManualSamplingInboxQualityEstimatedJobs} 条 / 目标 ${firstManualSamplingInboxQualityTargetCopies} 条` : "未生成"} |
| 个人能力画像 | ${personalProfileState.ready ? `${personalProfileState.skills} 项能力 / ${personalProfileState.evidence} 条证据` : "基本为空"} |
| 能力画像收件箱 | ${profileInboxState.tasks ? `${profileInboxState.ready}/${profileInboxState.tasks} 个项目已填写` : "未生成"} |
| BOSS下一轮优先采样清单 | ${nextSamplingQueueCount ? `${nextSamplingQueueCount} 条` : "未生成"} |
| BOSS采样进度看板 | ${samplingStatusSegmentCount ? `${samplingStatusSegmentCount} 个赛道` : "未生成"} |
| BOSS全行业样本缺口路线图 | ${bossSampleGapCount ? `${bossSampleGapCount} 个赛道` : "未生成"} |
| BOSS大样本完成门槛与验收路线 | ${bossCompletionAcceptanceCount ? `${bossCompletionAcceptanceCount} 个赛道 / BOSS样本缺口 ${bossCompletionSampleGap} / 可读薪资缺口 ${bossCompletionReadableSalaryGap} / 详情文本缺口 ${bossCompletionDetailGap}` : "未生成"} |
| BOSS结论升级采样控制台 | ${conclusionUpgradeConsoleCount ? `${conclusionUpgradeConsoleCount} 个赛道 / BOSS样本缺口 ${bossCompletionSampleGap}` : "未生成"} |
| BOSS样本质量验收报告 | ${bossSampleQualityCount ? `${bossSampleQualityCount} 条样本` : "未生成"} |
| BOSS可读薪资样本 | ${readableSalaryCount} 条 |
| 岗位薪资能力矩阵 | ${roleSalaryMatrixCount ? `${roleSalaryMatrixCount} 行` : "未生成"} |
| AI销售薪资待遇与能力门槛分析 | ${compensationGateAnalysisCount ? `${compensationGateAnalysisCount} 行` : "未生成"} |
| AI销售岗位市场决策总览 | ${decisionOverviewCount ? `${decisionOverviewCount} 行` : "未生成"} |
| AI销售薪资能力证据雷达 | ${salaryCapabilityRadarCount ? `${salaryCapabilityRadarCount} 个组合` : "未生成"} |
| AI细分赛道销售机会矩阵 | ${segmentOpportunityMatrixCount ? `${segmentOpportunityMatrixCount} 个赛道` : "未生成"} |
| AI销售能力要求矩阵 | ${capabilityRequirementCount ? `${capabilityRequirementCount} 项能力` : "未生成"} |
| 公开趋势信号看板 | ${publicSignalBoardCount ? `${publicSignalBoardCount} 条证据` : "未生成"} |
| BOSS历史缓存候选线索库 | ${bossLocalCacheEvidenceCount ? `${bossLocalCacheEvidenceCount} 条候选` : "未生成"} |
| AI硬件算力半导体销售岗位专项分析 | ${hardwareSpecialReportCount ? `${hardwareSpecialReportCount} 个赛道` : "未生成"} |
| BOSS硬件算力半导体优先采样清单 | ${hardwarePriorityQueueCount ? `${hardwarePriorityQueueCount} 条任务` : "未生成"} |
| AI公开招聘薪资证据库 | ${publicRecruitmentEvidenceCount ? `${publicRecruitmentEvidenceCount} 条证据` : "未生成"} |
| AI销售岗位全行业决策手册 | ${marketDecisionHandbookCount ? `${marketDecisionHandbookCount} 个赛道` : "未生成"} |
| AI销售岗位全景总览 | ${marketPanoramaBriefCount ? `${marketPanoramaBriefCount} 个赛道` : "未生成"} |
| AI销售岗位市场调研交付版 | ${marketDeliveryBriefCount ? `${marketDeliveryBriefCount} 个赛道` : "未生成"} |
| AI销售岗位公司类型岗位族交叉看板 | ${roleCompanyCrossMatrixCount ? `${roleCompanyCrossMatrixCount} 个组合` : "未生成"} |
| AI产业链销售岗位图谱 | ${industryLandscapeSegmentCount ? `${industryLandscapeSegmentCount} 个赛道 / ${industryLandscapeCompanyCount} 家公司` : "未生成"} |
| 头部公司岗位机会地图 | ${companyOpportunityCount ? `${companyOpportunityCount} 家公司` : "未生成"} |
| AI细分赛道头部公司Top10证据表 | ${segmentTopCompanyEvidenceCount ? `${segmentTopCompanyEvidenceCount} 家公司` : "未生成"} |
| AI销售目标公司分层画像 | ${companySegmentProfileCount ? `${companySegmentProfileCount} 个赛道` : "未生成"} |
| AI销售公司类型岗位打法对照表 | ${companyTypeMatrixCount ? `${companyTypeMatrixCount} 个赛道` : "未生成"} |
| AI目标公司销售岗位打法清单 | ${targetCompanyPlaybookCount ? `${targetCompanyPlaybookCount} 家公司` : "未生成"} |
| BOSS目标公司采样缺口看板 | ${targetCompanySamplingCount ? `${targetCompanySamplingCount} 家公司` : "未生成"} |
| AI重点公司与赛道覆盖审计 | ${focusCoverageAuditCount ? `${focusCoverageAuditCount} 家重点公司` : "未生成"} |
| AI销售市场结论权限总控 | ${marketConclusionGateCount ? `${marketConclusionGateCount} 条门禁` : "未生成"} |
| AI市场资料集证据审计 | ${marketEvidenceAuditCount ? `${Math.max(0, marketEvidenceAuditCount - 1)} 个赛道 / 1 条全局` : "未生成"} |
| 简历匹配Gap看板 | ${resumeGapCount ? `${resumeGapCount} 行` : "未生成"} |
| AI销售能力证据与简历改写矩阵 | ${resumeEvidenceCount ? `${resumeEvidenceCount} 项证据` : "未生成"} |
| AI销售市场到简历证据闭环 | ${resumeMarketClosureCount ? `${resumeMarketClosureCount} 项闭环证据` : "未生成"} |
| 公开薪资补充信号 | ${externalSalaryCount} 条 |
| BOSS公开公司/岗位信号 | ${bossSignalCount} 条 |
| 公开趋势校验来源 | ${publicMarketSourceCount} 条 |
| 全行业岗位分层画像 | ${roleProfileReady ? "已生成" : "未生成"} |
| 单次搜索最小间隔 | ${rateLimitConfig.boss?.minRequestIntervalMs || "-"} ms |
| 批次冷却 | ${rateLimitConfig.boss?.overnightCooldownMs || "-"} ms |
| 下一次允许请求 | ${rateLimitState.nextAllowedAt || "无记录"} |
| 自动恢复标记 | 已隔离；不执行恢复采集命令 |

## 二、浏览器页面

| 标题 | URL |
| --- | --- |
${tabsRows}

## 三、最近采集断点

| 类型 | 文件 | 状态 | 新增样本 |
| --- | --- | --- | ---: |
| 整晚采集 | ${latestOvernight || "无"} | ${overnightData?.status || "无"} | ${overnightData?.results?.reduce((sum, item) => sum + (item.savedCount || 0), 0) || 0} |
| 单次采集 | ${latestCollect || "无"} | ${collectData?.status || (collectData?.blocked?.length ? "blocked" : "completed/unknown")} | ${collectData?.savedCount || 0} |

## 四、完成度判断

| 要求 | 当前证据 | 状态 |
| --- | --- | --- |
| 覆盖 AI软件落地、大模型、芯片/半导体、工业AI等全行业 | 查询计划 ${queryCount} 条，覆盖 121 家公司和 59 个赛道关键词 | 框架完成 |
| 人工采样执行包 | ${manualSamplingTaskCount ? `${manualSamplingTaskCount} 条任务，${manualSamplingPackMdPath}` : "未生成"} | ${manualSamplingTaskCount ? "已生成" : "未完成"} |
| BOSS人工补样工作台 | ${manualSamplingWorkbenchCount ? `${manualSamplingWorkbenchCount} 条任务，${manualSamplingWorkbenchMdPath}` : "未生成"} | ${manualSamplingWorkbenchCount ? "已生成，用于把缺口、优先队列、导入命令和验收规则合成执行台" : "未完成"} |
| BOSS人工采样批次包 | ${manualSamplingBatchEntryCount ? `${manualSamplingBatchCount} 批 / ${manualSamplingBatchEntryCount} 个入口，${manualSamplingBatchMdPath}` : "未生成"} | ${manualSamplingBatchEntryCount ? "已生成，用于把补样工作台拆成低频人工小批次" : "未完成"} |
| BOSS重点公司补样批次包 | ${focusSamplingBatchEntryCount ? `${focusSamplingBatchCount} 批 / ${focusSamplingBatchEntryCount} 个入口，${focusSamplingBatchMdPath}` : "未生成"} | ${focusSamplingBatchEntryCount ? "已生成，用于把MiniMax、芯片/半导体/智算等缺人工批次的重点公司纳入BOSS人工补样闭环" : "未完成"} |
| BOSS细分赛道Top10公司采样批次包 | ${top10SamplingBatchEntryCount ? `${top10SamplingBatchCount} 批 / ${top10SamplingBatchEntryCount} 个入口，${top10SamplingBatchMdPath}` : "未生成"} | ${top10SamplingBatchEntryCount ? "已生成，用于把12个细分赛道的Top10公司转成低频人工采样队列" : "未完成"} |
| BOSS人工采样批次进度看板 | ${manualSamplingBatchStatusCount ? `${manualSamplingBatchDoneCount}/${manualSamplingBatchStatusCount} 批达标，${manualSamplingBatchStatusMdPath}` : "未生成"} | ${manualSamplingBatchStatusCount ? "已生成，用于验收每个人工补样批次是否完成" : "未完成"} |
| BOSS人工采样批次质量门禁 | ${manualSamplingBatchQualityCount ? `${manualSamplingBatchQualityDoneCount} 批达标，${manualSamplingBatchQualityMdPath}` : "未生成"} | ${manualSamplingBatchQualityCount ? "已生成，用于把批次进度和样本质量合并验收，区分旧样本参考与当前批次证据" : "未完成"} |
| BOSS首批人工采样执行单 | ${firstManualSamplingExecutionCount ? `${firstManualSamplingExecutionCount} 个入口，目标 ${firstManualSamplingTargetCopies} 条，${firstManualSamplingExecutionMdPath}` : "未生成"} | ${firstManualSamplingExecutionCount ? "已生成，用于把重点公司和批次质量门禁压缩成当天可执行的人工采样顺序" : "未完成"} |
| BOSS首批人工采样收件箱 | ${firstManualSamplingInboxStats.tasks ? `${firstManualSamplingInboxStats.ready}/${firstManualSamplingInboxStats.tasks} 个段落已粘贴，${firstManualSamplingInboxPath}` : "未生成"} | ${firstManualSamplingInboxStats.tasks ? `已生成；模板文件：${firstManualSamplingInboxTemplatePath}` : "未完成"} |
| BOSS首批人工采样质量预检 | ${firstManualSamplingInboxQualityRows.length ? `${firstManualSamplingInboxQualityReadyCount}/${firstManualSamplingInboxQualityRows.length} 段可导入，估算 ${firstManualSamplingInboxQualityEstimatedJobs} 条，${firstManualSamplingInboxQualityMdPath}` : "未生成"} | ${firstManualSamplingInboxQualityRows.length ? "已生成，用于在导入前判断岗位文本是否包含薪资、职责、要求、AI/行业关键词和销售/售前关键词" : "未完成"} |
| 能力画像收件箱 | ${profileInboxState.tasks ? `${profileInboxState.ready}/${profileInboxState.tasks} 个项目已填写，${profileInboxPath}` : "未生成"} | ${profileInboxState.tasks ? `已生成；模板文件：${profileInboxTemplatePath}；导入后同步 ${personalProfilePath} 和 ${resumeMaterialPath}` : "未完成"} |
| 下一轮低频采样清单 | ${nextSamplingQueueCount ? `${nextSamplingQueueCount} 条任务，${nextSamplingQueueMdPath}` : "未生成"} | ${nextSamplingQueueCount ? "已生成，适合风控恢复期人工执行" : "未完成"} |
| 采样进度追踪 | ${samplingStatusSegmentCount ? `${samplingStatusSegmentCount} 个赛道，${samplingStatusMdPath}` : "未生成"} | ${samplingStatusSegmentCount ? "已生成" : "未完成"} |
| BOSS全行业样本缺口路线图 | ${bossSampleGapCount ? `${bossSampleGapCount} 个赛道，${bossSampleGapMdPath}` : "未生成"} | ${bossSampleGapCount ? "已生成，用于验收距离BOSS大样本结论还差多少样本" : "未完成"} |
| BOSS大样本完成门槛与验收路线 | ${bossCompletionAcceptanceCount ? `${bossCompletionAcceptanceCount} 个赛道，${bossCompletionAcceptanceMdPath}` : "未生成"} | ${bossCompletionAcceptanceCount ? `已生成，用于判定全行业/赛道/薪资/能力结论权限；当前BOSS样本缺口 ${bossCompletionSampleGap}，可读薪资缺口 ${bossCompletionReadableSalaryGap}，详情文本缺口 ${bossCompletionDetailGap}` : "未完成"} |
| BOSS结论升级采样控制台 | ${conclusionUpgradeConsoleCount ? `${conclusionUpgradeConsoleCount} 个赛道，${conclusionUpgradeConsoleMdPath}` : "未生成"} | ${conclusionUpgradeConsoleCount ? "已生成，用于把每个赛道还差几条样本、下一步能解锁什么结论和首批人工入口合并成一张控制台" : "未完成"} |
| BOSS样本质量验收报告 | ${bossSampleQualityCount ? `${bossSampleQualityCount} 条样本，${bossSampleQualityMdPath}` : "未生成"} | ${bossSampleQualityCount ? "已生成，用于判断现有样本是否可支撑方向、薪资和赛道结论" : "未完成"} |
| 薪资/能力信号提取 | ${readableSalaryCount ? `${readableSalaryCount} 条可读薪资，${salaryCapabilityBoardPath}` : "未生成或无可读薪资"} | ${readableSalaryCount ? "初版完成，需大样本校验" : "未完成"} |
| 赛道岗位薪资能力矩阵 | ${roleSalaryMatrixCount ? `${roleSalaryMatrixCount} 行，${roleSalaryMatrixMdPath}` : "未生成"} | ${roleSalaryMatrixCount ? "初版完成，需大样本校验" : "未完成"} |
| 薪资待遇与能力门槛分析 | ${compensationGateAnalysisCount ? `${compensationGateAnalysisCount} 行，${compensationGateAnalysisMdPath}` : "未生成"} | ${compensationGateAnalysisCount ? "已生成，用于解释薪资层级和能力门槛" : "未完成"} |
| AI销售岗位市场决策总览 | ${decisionOverviewCount ? `${decisionOverviewCount} 行，${decisionOverviewMdPath}` : "未生成"} | ${decisionOverviewCount ? "已生成，用于投递方向/补样/简历证据总控" : "未完成"} |
| AI销售薪资能力证据雷达 | ${salaryCapabilityRadarCount ? `${salaryCapabilityRadarCount} 个组合，${salaryCapabilityRadarMdPath}` : "未生成"} | ${salaryCapabilityRadarCount ? "已生成，用于把BOSS样本、公开薪资信号、岗位族和能力要求按证据等级分层" : "未完成"} |
| AI细分赛道销售机会矩阵 | ${segmentOpportunityMatrixCount ? `${segmentOpportunityMatrixCount} 个赛道，${segmentOpportunityMatrixMdPath}` : "未生成"} | ${segmentOpportunityMatrixCount ? "已生成，用于赛道优先级、路线选择和简历证据规划" : "未完成"} |
| AI销售能力要求矩阵 | ${capabilityRequirementCount ? `${capabilityRequirementCount} 项能力，${capabilityRequirementMdPath}` : "未生成"} | ${capabilityRequirementCount ? "初版完成，已可指导简历证据补强" : "未完成"} |
| 公开趋势到采样优先级 | ${publicSignalBoardCount ? `${publicSignalBoardCount} 条趋势证据，${publicSignalBoardMdPath}` : "未生成"} | ${publicSignalBoardCount ? "已生成，用于非侵入式校验赛道优先级" : "未完成"} |
| BOSS历史缓存候选线索库 | ${bossLocalCacheEvidenceCount ? `${bossLocalCacheEvidenceCount} 条候选，${bossLocalCacheEvidenceMdPath}` : "未生成"} | ${bossLocalCacheEvidenceCount ? "已生成，不新增访问BOSS；候选需人工复核后才能进入干净样本" : "未完成"} |
| AI硬件算力半导体专项分析 | ${hardwareSpecialReportCount ? `${hardwareSpecialReportCount} 个赛道，${hardwareSpecialReportMdPath}` : "未生成"} | ${hardwareSpecialReportCount ? "已生成，用于单独跟踪芯片、服务器、智算、智能硬件、工业AI方向" : "未完成"} |
| BOSS硬件算力半导体优先采样清单 | ${hardwarePriorityQueueCount ? `${hardwarePriorityQueueCount} 条任务，${hardwarePriorityQueueMdPath}` : "未生成"} | ${hardwarePriorityQueueCount ? "已生成，不自动打开BOSS；适合风控恢复期人工复核" : "未完成"} |
| AI公开招聘薪资证据库 | ${publicRecruitmentEvidenceCount ? `${publicRecruitmentEvidenceCount} 条证据，${publicRecruitmentEvidenceMdPath}` : "未生成"} | ${publicRecruitmentEvidenceCount ? "已生成，用于公开招聘/薪资信号去重、归类和证据评分" : "未完成"} |
| AI销售岗位全行业决策手册 | ${marketDecisionHandbookCount ? `${marketDecisionHandbookCount} 个赛道，${marketDecisionHandbookMdPath}` : "未生成"} | ${marketDecisionHandbookCount ? "已生成，用于整合赛道、公司、薪资、能力和BOSS补样动作" : "未完成"} |
| AI销售岗位全景总览 | ${marketPanoramaBriefCount ? `${marketPanoramaBriefCount} 个赛道，${marketPanoramaBriefMdPath}` : "未生成"} | ${marketPanoramaBriefCount ? "已生成，用于一页总控路线、赛道、公司类型、岗位薪资、能力要求和样本缺口" : "未完成"} |
| AI销售岗位市场调研交付版 | ${marketDeliveryBriefCount ? `${marketDeliveryBriefCount} 个赛道，${marketDeliveryBriefMdPath}` : "未生成"} | ${marketDeliveryBriefCount ? "已生成，用于直接交付公司类型、岗位、薪资、能力、结论边界和补样动作" : "未完成"} |
| AI销售岗位公司类型岗位族交叉看板 | ${roleCompanyCrossMatrixCount ? `${roleCompanyCrossMatrixCount} 个组合，${roleCompanyCrossMatrixMdPath}` : "未生成"} | ${roleCompanyCrossMatrixCount ? "已生成，用于判断不同公司类型下优先投销售、售前、渠道还是管理岗" : "未完成"} |
| AI产业链公司资料集 | ${industryLandscapeSegmentCount ? `${industryLandscapeSegmentCount} 个赛道 / ${industryLandscapeCompanyCount} 家公司，${industryLandscapeCompanyMdPath}` : "未生成"} | ${industryLandscapeSegmentCount ? "已生成，用于把上中下游公司池、销售岗位、薪资信号、能力门槛和BOSS补样缺口串起来" : "未完成"} |
| 头部公司岗位机会地图 | ${companyOpportunityCount ? `${companyOpportunityCount} 家公司，${companyOpportunityMapMdPath}` : "未生成"} | ${companyOpportunityCount ? "已生成，需BOSS样本校验" : "未完成"} |
| AI细分赛道头部公司Top10证据表 | ${segmentTopCompanyEvidenceCount ? `${segmentTopCompanyEvidenceCount} 家公司，${segmentTopCompanyEvidenceMdPath}` : "未生成"} | ${segmentTopCompanyEvidenceCount ? "已生成，用于逐赛道列出头部公司、优先岗位词、薪资观察、BOSS样本状态和下一步人工入口" : "未完成"} |
| AI销售目标公司分层画像 | ${companySegmentProfileCount ? `${companySegmentProfileCount} 个赛道，${companySegmentProfileMdPath}` : "未生成"} | ${companySegmentProfileCount ? "已生成，用于解释公司类型和销售打法" : "未完成"} |
| AI销售公司类型岗位打法对照表 | ${companyTypeMatrixCount ? `${companyTypeMatrixCount} 个赛道，${companyTypeMatrixMdPath}` : "未生成"} | ${companyTypeMatrixCount ? "已生成，用于解释不同AI公司卖什么、客户是谁、销售岗怎么做" : "未完成"} |
| AI目标公司销售岗位打法清单 | ${targetCompanyPlaybookCount ? `${targetCompanyPlaybookCount} 家公司，${targetCompanyPlaybookMdPath}` : "未生成"} | ${targetCompanyPlaybookCount ? "已生成，用于公司级岗位打法和人工采样" : "未完成"} |
| BOSS目标公司采样缺口看板 | ${targetCompanySamplingCount ? `${targetCompanySamplingCount} 家公司，${targetCompanySamplingMdPath}` : "未生成"} | ${targetCompanySamplingCount ? "已生成，用于逐家公司追踪BOSS样本、薪资、详情文本和下一岗位词" : "未完成"} |
| AI重点公司与赛道覆盖审计 | ${focusCoverageAuditCount ? `${focusCoverageAuditCount} 家重点公司，${focusCoverageAuditMdPath}` : "未生成"} | ${focusCoverageAuditCount ? "已生成，用于检查月之暗面、智谱AI、MiniMax、芯片/半导体/智算等重点方向是否进入证据闭环" : "未完成"} |
| AI销售市场结论权限总控 | ${marketConclusionGateCount ? `${marketConclusionGateCount} 条门禁，${marketConclusionGateMdPath}` : "未生成"} | ${marketConclusionGateCount ? "已生成，用于防止把公开信号或少量样本写成BOSS大样本结论" : "未完成"} |
| AI市场资料集证据审计 | ${marketEvidenceAuditCount ? `${Math.max(0, marketEvidenceAuditCount - 1)} 个赛道，${marketEvidenceAuditMdPath}` : "未生成"} | ${marketEvidenceAuditCount ? "已生成，用于区分公司池、公开趋势、公开薪资、BOSS样本和结论边界" : "未完成"} |
| 简历匹配与能力Gap | ${resumeGapCount ? `${resumeGapCount} 行，${resumeGapMdPath}` : "未生成"} | ${resumeGapCount ? "已生成，需补真实能力画像" : "未完成"} |
| AI销售能力证据与简历改写矩阵 | ${resumeEvidenceCount ? `${resumeEvidenceCount} 项证据，${resumeEvidenceMdPath}` : "未生成"} | ${resumeEvidenceCount ? "已生成，用于把市场能力要求转换成简历项目证据和表达模板" : "未完成"} |
| AI销售市场到简历证据闭环 | ${resumeMarketClosureCount ? `${resumeMarketClosureCount} 项闭环证据，${resumeMarketClosureMdPath}` : "未生成"} | ${resumeMarketClosureCount ? "已生成，用于把BOSS样本缺口、市场能力要求、能力画像字段和简历证据动作串起来" : "未完成"} |
| BOSS平台大样本岗位采集 | 当前干净样本 ${bossJobs} 条 | 未完成 |
| 薪资待遇分析 | 公开薪资补充信号 ${externalSalaryCount} 条，公开趋势来源 ${publicMarketSourceCount} 条，BOSS可读薪资 ${readableSalaryCount} 条，其余样本保留字体混淆原文 | 初版完成，需大样本校验 |
| 人员能力要求分析 | BOSS样本、公开薪资信号和趋势来源已有初步矩阵 | 初版完成，需大样本校验 |
| 岗位分层画像 | ${roleProfileReady ? roleProfilePath : "未生成"} | 初版完成，需BOSS大样本校验 |
| 整晚自动运行 | 脚本可运行且遇验证会停止 | 等待验证解除 |

## 五、风控保护

| 保护项 | 当前值 |
| --- | --- |
| 每次运行最多搜索页 | ${rateLimitConfig.boss?.maxSearchesPerRun ?? "-"} |
| 每页最多读取卡片 | ${rateLimitConfig.boss?.maxCardsPerSearch ?? "-"} |
| 每次运行最多保存岗位 | ${rateLimitConfig.boss?.maxJobsPerRun ?? "-"} |
| 每次运行最多打开详情页 | ${rateLimitConfig.boss?.maxDetailPagesPerRun ?? "-"} |
| 搜索间最小间隔 | ${rateLimitConfig.boss?.minRequestIntervalMs ?? "-"} ms |
| 随机抖动 | ${rateLimitConfig.boss?.defaultJitterMs ?? "-"} ms |
| 整晚采集批次大小 | ${rateLimitConfig.boss?.overnightBatchSize ?? "-"} |
| 整晚采集批次冷却 | ${rateLimitConfig.boss?.overnightCooldownMs ?? "-"} ms |

## 六、下一步命令

当前处于风控恢复期。优先手动浏览 BOSS 并复制岗位详情，然后导入：

\`\`\`bash
npm run sampling:manual -- --city 广州
npm run sampling:next -- --city 广州 --limit 30
npm run sampling:workbench
npm run sampling:batches
npm run sampling:companies
npm run coverage:focus
npm run sampling:focus-batches
npm run sampling:top10-batches
npm run sampling:quality
npm run sampling:batch-status
npm run sampling:batch-quality
npm run sampling:first-execution
npm run sampling:inbox-status
npm run import:inbox -- --dry-run
npm run import:inbox
npm run profile:inbox
npm run profile:import -- --dry-run
npm run profile:import
npm run profile:status
npm run sampling:status
npm run sampling:gap
npm run sampling:acceptance
npm run sampling:upgrade-console
npm run import:manual -- --source BOSS直聘 --query "智谱AI AI销售" --company 智谱AI --role AI销售 --city 广州
npm run salary:signals
npm run signals:public
npm run evidence:boss-cache
npm run matrix:roles
npm run compensation:analysis
npm run capability:matrix
npm run gap:resume
npm run evidence:resume
npm run resume:closure
npm run industry:landscape
npm run company:map
npm run company:profile
npm run company:type
npm run company:playbook
npm run company:top10
npm run decision:overview
npm run hardware:market
npm run brief:market
npm run report:delivery
npm run radar:salary-capability
npm run matrix:cross
npm run sampling:companies
npm run sampling:quality
npm run gate:conclusion
npm run audit:evidence
npm run summary:jobs
npm run report:full
\`\`\`

当前登录页应保留在 Codex 普通浏览页中；不要重新登录、不要接管该标签，也不要以自动采集命令作为验证动作。

浏览器控制通道、账号可读性、列表可读性和详情可读性需要分别验收。控制通道尚未验收前，本报告只使用本地证据并保持自动采集暂停。
`;

writeFileSync(auditPath, report);
console.log(`已更新：${auditPath}`);
console.log(`BOSS状态：${bossStatus}`);
console.log(`BOSS干净岗位样本：${bossJobs}`);
console.log(`查询计划：${queryCount}`);
