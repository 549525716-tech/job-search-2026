#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const paths = {
  jobs: join(projectRoot, "01_行情收集/data/jobs.jsonl"),
  readableSalary: join(projectRoot, "01_行情收集/BOSS可读薪资样本.csv"),
  sampleQuality: join(projectRoot, "01_行情收集/BOSS样本质量验收报告.csv"),
  acceptance: join(projectRoot, "01_行情收集/BOSS大样本完成门槛与验收路线.csv"),
  companyDataset: join(projectRoot, "00_行业资料集/AI产业链公司资料集.csv"),
  segmentDataset: join(projectRoot, "00_行业资料集/AI产业链销售岗位图谱.csv"),
  topCompanyEvidence: join(projectRoot, "00_行业资料集/AI细分赛道头部公司Top10证据表.csv"),
  onepage: join(projectRoot, "01_行情收集/AI销售岗位一页决策总表.csv"),
  crossMatrix: join(projectRoot, "01_行情收集/AI销售岗位公司类型岗位族交叉看板.csv"),
  panorama: join(projectRoot, "01_行情收集/AI销售岗位全景总览.csv"),
  targetCompanySampling: join(projectRoot, "01_行情收集/BOSS目标公司采样缺口看板.csv"),
  conclusionGate: join(projectRoot, "01_行情收集/AI销售市场结论权限总控.csv"),
  evidenceAudit: join(projectRoot, "01_行情收集/AI市场资料集证据审计.csv"),
  externalSalary: join(projectRoot, "06_自动化采集/config/external_salary_signals.csv"),
  capabilityMatrix: join(projectRoot, "02_岗位画像/AI销售岗位能力要求矩阵.csv"),
  profile: join(projectRoot, "02_岗位画像/data/我的能力画像.json"),
  resumeGap: join(projectRoot, "03_简历/AI销售岗位匹配与能力Gap.csv"),
  resumeEvidence: join(projectRoot, "03_简历/AI销售能力证据与简历改写矩阵.csv"),
  firstExecution: join(projectRoot, "01_行情收集/BOSS首批人工采样执行单.csv"),
  top10Batches: join(projectRoot, "01_行情收集/BOSS细分赛道Top10公司采样批次包.csv"),
  safeLoginEntry: join(projectRoot, "01_行情收集/BOSS登录安全入口.html"),
  rateLimits: join(projectRoot, "06_自动化采集/config/rate_limits.json"),
  fullReport: join(projectRoot, "01_行情收集/AI全行业销售岗位市场调研.md"),
  onepageMd: join(projectRoot, "01_行情收集/AI销售岗位一页决策总表.md")
};

const outputCsvPath = join(projectRoot, "01_行情收集/AI销售岗位调研目标完成度审计.csv");
const outputMdPath = join(projectRoot, "01_行情收集/AI销售岗位调研目标完成度审计.md");

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
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function readJson(filePath, fallback = {}) {
  if (!existsSync(filePath)) return fallback;
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function csv(rows) {
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
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

function numberOf(value) {
  const num = Number.parseFloat(String(value || "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(num) ? num : 0;
}

function mdRows(rows, fallback) {
  return rows.length ? rows.join("\n") : fallback;
}

function statusRank(status) {
  return { "未完成": 0, "部分完成": 1, "阶段完成": 2 }[status] ?? 0;
}

function stageStatus(condition, partialCondition = true) {
  if (condition) return "阶段完成";
  if (partialCondition) return "部分完成";
  return "未完成";
}

function textBlob(rows) {
  return rows.map((row) => Object.values(row).join(" ")).join("\n");
}

function containsAll(text, terms) {
  return terms.every((term) => text.includes(term));
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

function evidenceList(items) {
  return items.filter(Boolean).join("；");
}

function isBossJob(job) {
  return !job.source || job.source === "BOSS直聘";
}

const allJobs = readJsonl(paths.jobs);
const jobs = allJobs.filter(isBossJob);
const readableSalaryRows = readCsv(paths.readableSalary);
const sampleQualityRows = readCsv(paths.sampleQuality);
const acceptanceRows = readCsv(paths.acceptance);
const companyRows = readCsv(paths.companyDataset);
const segmentRows = readCsv(paths.segmentDataset);
const topCompanyRows = readCsv(paths.topCompanyEvidence);
const onepageRows = readCsv(paths.onepage);
const crossRows = readCsv(paths.crossMatrix);
const panoramaRows = readCsv(paths.panorama);
const targetCompanyRows = readCsv(paths.targetCompanySampling);
const conclusionGateRows = readCsv(paths.conclusionGate);
const evidenceAuditRows = readCsv(paths.evidenceAudit);
const externalSalaryRows = readCsv(paths.externalSalary);
const capabilityRows = readCsv(paths.capabilityMatrix);
const resumeGapRows = readCsv(paths.resumeGap);
const resumeEvidenceRows = readCsv(paths.resumeEvidence);
const firstExecutionRows = readCsv(paths.firstExecution);
const top10BatchRows = readCsv(paths.top10Batches);
const profile = readJson(paths.profile, {});
const rateLimits = readJson(paths.rateLimits, {});

const companyText = textBlob(companyRows);
const onepageText = textBlob(onepageRows);
const crossText = textBlob(crossRows);
const targetText = textBlob(targetCompanyRows);
const allCompanyEvidenceText = [companyText, onepageText, targetText].join("\n");

const softwareCompanies = ["月之暗面", "智谱AI", "MiniMax"];
const hardwareCompanies = ["寒武纪", "海光信息", "华为昇腾"];
const roleFamilies = ["AI软件/大模型销售", "大客户/行业销售经理", "售前/解决方案顾问", "销售管理/区域负责人"];

const totalBossTarget = acceptanceRows.reduce((sum, row) => sum + numberOf(row.targetSamples), 0);
const totalBossGap = acceptanceRows.reduce((sum, row) => sum + numberOf(row.missingBossSamples || row.sampleGap), 0);
const totalReadableTarget = acceptanceRows.reduce((sum, row) => sum + numberOf(row.salaryConclusionSamples), 0);
const totalDetailTarget = acceptanceRows.reduce((sum, row) => sum + numberOf(row.minimumBossConclusionSamples), 0);
const detailSamples = sampleQualityRows.filter((row) => numberOf(row.detailTextLength) >= 500).length;
const p0Segments = panoramaRows.filter((row) => /P0/.test(row.priority || "")).length;
const profileReady = meaningfulProfileValues(profileEvidencePayload(profile)).length > 0;
const autoPaused = Boolean(rateLimits?.boss?.requireResumeFlag);

const requirements = [
  {
    id: "R01",
    layer: "行业图谱",
    requirement: "建立 AI 上游、中游、下游及应用落地的行业/公司资料集",
    status: stageStatus(companyRows.length >= 100 && segmentRows.length >= 10 && topCompanyRows.length >= 100, companyRows.length > 0),
    currentEvidence: `公司资料集 ${companyRows.length} 家；销售岗位图谱 ${segmentRows.length} 个赛道；Top公司证据 ${topCompanyRows.length} 家`,
    missingEvidence: companyRows.length >= 100 ? "继续随市场变化维护头部公司" : "公司池不足 100 家，需要补全赛道头部公司",
    acceptanceCriteria: "至少 10 个 AI 细分赛道、100 家以上目标公司、每赛道 Top10 入口可追踪",
    evidenceFiles: evidenceList([
      "00_行业资料集/AI产业链公司资料集.csv",
      "00_行业资料集/AI产业链销售岗位图谱.csv",
      "00_行业资料集/AI细分赛道头部公司Top10证据表.csv"
    ]),
    nextAction: "持续补头部公司变动；新增赛道时先进入公司资料集，再进入 BOSS 低频采样队列"
  },
  {
    id: "R02",
    layer: "软件落地",
    requirement: "覆盖月之暗面、智谱AI、MiniMax 等 AI 软件落地公司",
    status: containsAll(allCompanyEvidenceText, softwareCompanies) && jobs.filter((job) => softwareCompanies.includes(job.company)).length >= 3 ? "阶段完成" : "部分完成",
    currentEvidence: `点名公司覆盖：${softwareCompanies.filter((name) => allCompanyEvidenceText.includes(name)).join("、") || "未覆盖"}；对应 BOSS 干净样本 ${jobs.filter((job) => softwareCompanies.includes(job.company)).length} 条`,
    missingEvidence: "点名公司已有资料/搜索入口，但缺少这些公司的 BOSS 岗位详情样本",
    acceptanceCriteria: "每个点名公司至少 2 到 3 条销售/售前/商业化/生态岗位详情，且含薪资、职责、要求",
    evidenceFiles: evidenceList([
      "01_行情收集/AI销售岗位一页决策总表.csv",
      "01_行情收集/BOSS目标公司采样缺口看板.csv"
    ]),
    nextAction: "人工低频在 BOSS 首页站内搜索：月之暗面 AI销售、智谱AI AI销售、MiniMax AI销售，并导入岗位详情"
  },
  {
    id: "R03",
    layer: "硬件算力",
    requirement: "覆盖芯片、半导体、AI服务器、智算中心等硬件相关销售岗位",
    status: containsAll(allCompanyEvidenceText, hardwareCompanies) && jobs.filter((job) => /寒武纪|海光|昇腾|芯片|半导体|服务器|智算/.test([job.company, job.title, job.rawText, job.detailText].join(" "))).length >= 8 ? "阶段完成" : "部分完成",
    currentEvidence: `硬件重点公司覆盖：${hardwareCompanies.filter((name) => allCompanyEvidenceText.includes(name)).join("、") || "未覆盖"}；硬件相关 BOSS 干净样本仍不足`,
    missingEvidence: "芯片/半导体/AI服务器方向已有专项表和采样队列，但缺少足够 BOSS 岗位详情",
    acceptanceCriteria: "AI芯片/GPU、AI服务器/智算、智算中心/IDC 至少各 10 到 12 条高相关样本",
    evidenceFiles: evidenceList([
      "01_行情收集/AI硬件算力半导体销售岗位专项分析.csv",
      "01_行情收集/BOSS硬件算力半导体优先采样清单.csv",
      "00_行业资料集/AI产业链公司资料集.csv"
    ]),
    nextAction: "优先补海光信息、寒武纪、华为昇腾、超聚变、浪潮信息、新华三、中科曙光的大客户销售/渠道/售前岗位"
  },
  {
    id: "R04",
    layer: "岗位拆解",
    requirement: "拆解 AI 销售、售前、销售管理、大客户、渠道等岗位族",
    status: stageStatus(crossRows.length >= 30 && roleFamilies.every((role) => crossText.includes(role)), crossRows.length > 0),
    currentEvidence: `公司类型 x 岗位族组合 ${crossRows.length} 个；全景赛道 ${panoramaRows.length} 个；P0 赛道 ${p0Segments} 个`,
    missingEvidence: "岗位族框架已成型，仍需用更多 BOSS 详情校验每个岗位族的真实职责差异",
    acceptanceCriteria: "每个核心岗位族在 P0 赛道中都有样本、薪资、职责、能力要求和简历证据",
    evidenceFiles: evidenceList([
      "01_行情收集/AI销售岗位公司类型岗位族交叉看板.csv",
      "01_行情收集/AI销售岗位全景总览.csv"
    ]),
    nextAction: "按销售、售前、渠道、销售管理四类分别补 BOSS 样本，避免只采到单一销售岗位"
  },
  {
    id: "R05",
    layer: "薪资字段",
    requirement: "岗位表必须附薪资区间、薪资参考和薪资证据等级",
    status: stageStatus(onepageRows.length >= 50 && crossRows.every((row) => row.salaryBand) && externalSalaryRows.length >= 30, onepageRows.length > 0),
    currentEvidence: `一页决策表 ${onepageRows.length} 行；岗位交叉表 ${crossRows.length} 行；公开薪资信号 ${externalSalaryRows.length} 条；BOSS可读薪资 ${readableSalaryRows.length} 条`,
    missingEvidence: readableSalaryRows.length >= 30 ? "继续提高薪资样本覆盖" : `BOSS可读薪资只有 ${readableSalaryRows.length} 条，不能计算稳定中位数`,
    acceptanceCriteria: "所有主表有薪资字段；每个 P0 赛道至少 6 条可读 BOSS 薪资；能区分公开薪资假设和 BOSS 样本统计",
    evidenceFiles: evidenceList([
      "01_行情收集/AI销售岗位一页决策总表.csv",
      "01_行情收集/AI销售岗位公司类型岗位族交叉看板.csv",
      "06_自动化采集/config/external_salary_signals.csv",
      "01_行情收集/BOSS可读薪资样本.csv"
    ]),
    nextAction: "后续人工导入岗位时必须复制薪资；每个 P0 赛道先补 6 条可读薪资"
  },
  {
    id: "R06",
    layer: "能力要求",
    requirement: "汇总 AI 销售岗位对于人员能力的要求",
    status: capabilityRows.length >= 10 && detailSamples >= 20 ? "阶段完成" : "部分完成",
    currentEvidence: `能力矩阵 ${capabilityRows.length} 条；BOSS详情文本样本 ${detailSamples} 条；样本质量报告 ${sampleQualityRows.length} 条`,
    missingEvidence: `详情文本样本只有 ${detailSamples} 条，能力要求仍主要依赖公开信号和少量样本`,
    acceptanceCriteria: "每个核心赛道至少 6 条岗位详情文本，能力要求能回溯到岗位职责/任职要求",
    evidenceFiles: evidenceList([
      "02_岗位画像/AI销售岗位能力要求矩阵.csv",
      "01_行情收集/BOSS样本质量验收报告.csv"
    ]),
    nextAction: "导入岗位时优先复制完整职责、任职要求、客户类型和经验学历要求"
  },
  {
    id: "R07",
    layer: "BOSS证据",
    requirement: "在 BOSS 平台形成可支撑全行业结论的大样本",
    status: jobs.length >= 80 && readableSalaryRows.length >= 40 && detailSamples >= 40 ? "阶段完成" : jobs.length >= 20 ? "部分完成" : "未完成",
    currentEvidence: `BOSS干净样本 ${jobs.length}/${totalBossTarget || 0}；可读薪资 ${readableSalaryRows.length}/${totalReadableTarget || 0}；详情文本 ${detailSamples}/${totalDetailTarget || 0}；总缺口约 ${totalBossGap || 0}`,
    missingEvidence: "当前只能写公开信号假设和少量样本方向观察，不能写 BOSS 平台大样本结论",
    acceptanceCriteria: "至少 80 条高相关样本；P0 赛道各 10 到 12 条；每个 P0 赛道至少 6 条可读薪资和 6 条详情文本",
    evidenceFiles: evidenceList([
      "01_行情收集/BOSS大样本完成门槛与验收路线.csv",
      "01_行情收集/BOSS样本质量验收报告.csv",
      "01_行情收集/data/jobs.jsonl"
    ]),
    nextAction: "暂停自动高频访问；改为 BOSS 首页站内搜索 + 人工复制导入，优先执行首批采样单"
  },
  {
    id: "R08",
    layer: "安全采集",
    requirement: "解决登录态与安全低频采集流程，避免自动返回 blank 和触发风控",
    status: stageStatus(existsSync(paths.safeLoginEntry) && existsSync(paths.rateLimits) && autoPaused, existsSync(paths.safeLoginEntry)),
    currentEvidence: `安全入口：${existsSync(paths.safeLoginEntry) ? "已生成" : "未生成"}；rate_limits：${existsSync(paths.rateLimits) ? "已配置" : "未配置"}；自动访问默认${autoPaused ? "暂停" : "未强制暂停"}`,
    missingEvidence: autoPaused ? "需要用户手动确认页面稳定后再低频采样" : "需要把自动访问设为恢复期默认暂停",
    acceptanceCriteria: "默认不自动打开/刷新 BOSS；使用本地安全入口保留登录态；采样动作由人工确认或极低频执行",
    evidenceFiles: evidenceList([
      "01_行情收集/BOSS登录安全入口.html",
      "06_自动化采集/config/rate_limits.json",
      "06_自动化采集/scripts/auth_browser.mjs"
    ]),
    nextAction: "继续维持人工低频流程；除非用户明确确认，否则不自动打开 BOSS 页面"
  },
  {
    id: "R09",
    layer: "大而全交付",
    requirement: "输出一份全行业 AI 销售岗位拆解、公司、薪资、能力的汇总报告",
    status: stageStatus(existsSync(paths.fullReport) && existsSync(paths.onepageMd) && evidenceAuditRows.length >= 10 && conclusionGateRows.length >= 10, existsSync(paths.fullReport)),
    currentEvidence: `主报告已生成；一页决策总表 ${onepageRows.length} 行；资料集证据审计 ${evidenceAuditRows.length} 行；结论权限门禁 ${conclusionGateRows.length} 行`,
    missingEvidence: "报告结构已经完整，但最终市场结论仍受 BOSS 样本缺口限制",
    acceptanceCriteria: "报告包含赛道、公司、岗位族、薪资、能力、BOSS证据边界、下一步采样路线",
    evidenceFiles: evidenceList([
      "01_行情收集/AI全行业销售岗位市场调研.md",
      "01_行情收集/AI销售岗位一页决策总表.md",
      "01_行情收集/AI市场资料集证据审计.csv"
    ]),
    nextAction: "每次新增样本后运行 npm run report:full，刷新主报告和完成度审计"
  },
  {
    id: "R10",
    layer: "简历匹配",
    requirement: "把市场要求与个人能力画像/简历 Gap 关联",
    status: profileReady && resumeGapRows.length >= 30 ? "阶段完成" : resumeGapRows.length >= 30 ? "部分完成" : "未完成",
    currentEvidence: `简历Gap表 ${resumeGapRows.length} 行；能力证据改写矩阵 ${resumeEvidenceRows.length} 行；个人能力画像${profileReady ? "已有有效内容" : "基本为空"}`,
    missingEvidence: profileReady ? "继续补真实量化证据" : "用户个人经历、项目、业绩、客户类型、金额、团队规模等画像待填写",
    acceptanceCriteria: "能力画像有真实项目证据；每个目标岗位都有匹配度、缺口、简历改写证据和面试故事",
    evidenceFiles: evidenceList([
      "03_简历/AI销售岗位匹配与能力Gap.csv",
      "03_简历/AI销售能力证据与简历改写矩阵.csv",
      "02_岗位画像/data/我的能力画像.json"
    ]),
    nextAction: "补能力画像收件箱：客户、行业、动作、金额/转化/回款、销售周期、团队和协同证据"
  },
  {
    id: "R11",
    layer: "下一步执行",
    requirement: "把未完成项转成可执行的 BOSS 人工采样任务",
    status: stageStatus(firstExecutionRows.length >= 20 && top10BatchRows.length >= 50, firstExecutionRows.length > 0 || top10BatchRows.length > 0),
    currentEvidence: `首批人工采样执行单 ${firstExecutionRows.length} 条；Top10 公司采样批次 ${top10BatchRows.length} 条；目标公司缺口看板 ${targetCompanyRows.length} 家`,
    missingEvidence: "采样任务已生成，尚未完成足够人工导入",
    acceptanceCriteria: "首批执行单导入后，P0 赛道样本、薪资、详情文本、公司覆盖都有明显提升",
    evidenceFiles: evidenceList([
      "01_行情收集/BOSS首批人工采样执行单.csv",
      "01_行情收集/BOSS细分赛道Top10公司采样批次包.csv",
      "01_行情收集/BOSS目标公司采样缺口看板.csv"
    ]),
    nextAction: "先完成首批 20 到 36 个低频搜索入口，每个入口复制 2 到 3 条高相关岗位详情"
  }
];

const headers = [
  "id",
  "layer",
  "requirement",
  "status",
  "currentEvidence",
  "missingEvidence",
  "acceptanceCriteria",
  "evidenceFiles",
  "nextAction"
];

const sortedRequirements = requirements.sort((a, b) => {
  return statusRank(a.status) - statusRank(b.status) || a.id.localeCompare(b.id);
});

mkdirSync(dirname(outputCsvPath), { recursive: true });
writeFileSync(outputCsvPath, `${csv([headers])}\n${csv(sortedRequirements.map((row) => headers.map((header) => row[header])))}\n`);

const statusCounts = requirements.reduce((acc, row) => {
  acc[row.status] = (acc[row.status] || 0) + 1;
  return acc;
}, {});

const requirementRows = sortedRequirements.map((row) => {
  return `| ${row.id} | ${row.layer} | ${row.requirement} | ${row.status} | ${row.currentEvidence} | ${row.missingEvidence} | ${row.nextAction} |`;
});

const incompleteRows = sortedRequirements
  .filter((row) => row.status !== "阶段完成")
  .map((row) => `| ${row.id} | ${row.layer} | ${row.missingEvidence} | ${row.acceptanceCriteria} |`);

const md = `# AI销售岗位调研目标完成度审计

更新时间：${formatDateTime()}

## 一、本质判断

这张表不是新增市场结论，而是判断最初“大而全 AI 销售岗位市场调研”目标到底完成到哪里。当前项目已经搭好了行业图谱、公司池、岗位族、薪资字段、能力矩阵、简历Gap和安全采样流程；但 BOSS 大样本仍未完成，所以不能把阶段性薪资区间写成 BOSS 平台最终结论。

当前最大的矛盾是：既要全行业覆盖、薪资和能力都能下判断，又不能用 4 条 BOSS 干净样本去代表全市场。

## 二、总览

| 指标 | 当前值 |
| --- | ---: |
| 阶段完成 | ${statusCounts["阶段完成"] || 0} |
| 部分完成 | ${statusCounts["部分完成"] || 0} |
| 未完成 | ${statusCounts["未完成"] || 0} |
| BOSS干净样本 | ${jobs.length} |
| BOSS可读薪资 | ${readableSalaryRows.length} |
| BOSS详情文本样本 | ${detailSamples} |
| AI产业链公司池 | ${companyRows.length} |
| AI细分赛道 | ${segmentRows.length} |
| 公开薪资信号 | ${externalSalaryRows.length} |
| 一页决策总表 | ${onepageRows.length} 行 |

## 三、目标完成度表

| ID | 层级 | 原始目标拆解 | 状态 | 当前证据 | 缺口 | 下一步 |
| --- | --- | --- | --- | --- | --- | --- |
${mdRows(requirementRows, "| - | - | - | 未完成 | - | - | - |")}

## 四、未达最终交付的关键原因

| ID | 层级 | 仍缺什么 | 完成门槛 |
| --- | --- | --- | --- |
${mdRows(incompleteRows, "| - | - | - | - |")}

## 五、下一步最小闭环

1. 不自动打开 BOSS，不刷新，不批量访问；先使用 BOSS 首页和站内搜索关键词人工低频补样。
2. 先补 P0 赛道：基座大模型/Agent、云计算/大模型平台、智能客服/营销/销售AI、AI芯片/GPU、AI服务器/智算、工业AI/智能制造。
3. 每个入口复制 2 到 3 条高相关岗位详情，必须包含公司、岗位、城市、薪资、职责、要求、经验学历、客户类型。
4. 每补完一批运行 \`npm run import:manual\` 或收件箱导入，再运行 \`npm run report:full\` 刷新所有结论。
5. 当 BOSS 干净样本达到 80 条以上，且 P0 赛道各 10 到 12 条、可读薪资和详情文本各 6 条以上，再升级为 BOSS 平台大样本结论。

## 六、结论权限

当前可以交付的是“AI销售岗位市场研究框架 + 公开薪资假设 + 少量 BOSS 样本方向观察 + 补样执行系统”。当前还不能交付的是“BOSS 平台全行业最终薪资统计”和“所有头部公司正在招聘销售岗位的确定性结论”。
`;

writeFileSync(outputMdPath, md);

console.log(`已生成：${outputMdPath}`);
console.log(`已生成：${outputCsvPath}`);
console.log(`阶段完成：${statusCounts["阶段完成"] || 0}`);
console.log(`部分完成：${statusCounts["部分完成"] || 0}`);
console.log(`未完成：${statusCounts["未完成"] || 0}`);
