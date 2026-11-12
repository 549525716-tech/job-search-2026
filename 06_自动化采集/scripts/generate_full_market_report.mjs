#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const jobsPath = join(projectRoot, "01_行情收集/data/jobs.jsonl");
const segmentPath = join(projectRoot, "06_自动化采集/config/ai_company_segments.csv");
const industryTargetsPath = join(projectRoot, "06_自动化采集/config/industry_targets.txt");
const externalSalarySignalsPath = join(projectRoot, "06_自动化采集/config/external_salary_signals.csv");
const bossPublicCompanySignalsPath = join(projectRoot, "06_自动化采集/config/boss_public_company_signals.csv");
const publicMarketSourcesPath = join(projectRoot, "06_自动化采集/config/public_market_sources.csv");
const rateLimitConfigPath = join(projectRoot, "06_自动化采集/config/rate_limits.json");
const reportPath = join(projectRoot, "01_行情收集/AI全行业销售岗位市场调研.md");
const manualSamplingPackPath = join(projectRoot, "01_行情收集/BOSS人工采样作业包.md");
const manualSamplingWorkbenchPath = join(projectRoot, "01_行情收集/BOSS人工补样工作台.md");
const manualSamplingWorkbenchCsvPath = join(projectRoot, "01_行情收集/BOSS人工补样工作台.csv");
const manualSamplingBatchPath = join(projectRoot, "01_行情收集/BOSS人工采样批次包.md");
const manualSamplingBatchCsvPath = join(projectRoot, "01_行情收集/BOSS人工采样批次包.csv");
const manualSamplingBatchStatusPath = join(projectRoot, "01_行情收集/BOSS人工采样批次进度看板.md");
const manualSamplingBatchStatusCsvPath = join(projectRoot, "01_行情收集/BOSS人工采样批次进度看板.csv");
const firstManualSamplingInboxQualityPath = join(projectRoot, "01_行情收集/BOSS首批人工采样收件箱质量预检.md");
const firstManualSamplingInboxQualityCsvPath = join(projectRoot, "01_行情收集/BOSS首批人工采样收件箱质量预检.csv");
const nextSamplingQueuePath = join(projectRoot, "01_行情收集/BOSS下一轮优先采样清单.md");
const bossSampleGapPath = join(projectRoot, "01_行情收集/BOSS全行业样本缺口路线图.md");
const bossSampleGapCsvPath = join(projectRoot, "01_行情收集/BOSS全行业样本缺口路线图.csv");
const conclusionUpgradeConsolePath = join(projectRoot, "01_行情收集/BOSS结论升级采样控制台.md");
const conclusionUpgradeConsoleCsvPath = join(projectRoot, "01_行情收集/BOSS结论升级采样控制台.csv");
const bossSampleQualityPath = join(projectRoot, "01_行情收集/BOSS样本质量验收报告.md");
const bossSampleQualityCsvPath = join(projectRoot, "01_行情收集/BOSS样本质量验收报告.csv");
const samplingStatusPath = join(projectRoot, "01_行情收集/BOSS采样进度看板.md");
const salaryCapabilityBoardPath = join(projectRoot, "01_行情收集/BOSS薪资能力信号看板.md");
const roleSalaryMatrixPath = join(projectRoot, "01_行情收集/AI销售岗位薪资能力矩阵.md");
const compensationGateAnalysisPath = join(projectRoot, "01_行情收集/AI销售岗位薪资待遇与能力门槛分析.md");
const decisionOverviewPath = join(projectRoot, "01_行情收集/AI销售岗位市场决策总览.md");
const segmentOpportunityMatrixPath = join(projectRoot, "01_行情收集/AI细分赛道销售机会矩阵.md");
const capabilityRequirementMatrixPath = join(projectRoot, "02_岗位画像/AI销售岗位能力要求矩阵.md");
const publicSignalBoardPath = join(projectRoot, "01_行情收集/AI行业公开趋势信号看板.md");
const bossLocalCacheEvidenceCsvPath = join(projectRoot, "01_行情收集/BOSS历史缓存候选线索库.csv");
const bossLocalCacheEvidencePath = join(projectRoot, "01_行情收集/BOSS历史缓存候选线索库.md");
const hardwareSpecialReportCsvPath = join(projectRoot, "01_行情收集/AI硬件算力半导体销售岗位专项分析.csv");
const hardwareSpecialReportPath = join(projectRoot, "01_行情收集/AI硬件算力半导体销售岗位专项分析.md");
const hardwarePriorityQueueCsvPath = join(projectRoot, "01_行情收集/BOSS硬件算力半导体优先采样清单.csv");
const hardwarePriorityQueuePath = join(projectRoot, "01_行情收集/BOSS硬件算力半导体优先采样清单.md");
const publicRecruitmentEvidencePath = join(projectRoot, "01_行情收集/AI公开招聘薪资证据库.md");
const marketDecisionHandbookPath = join(projectRoot, "01_行情收集/AI销售岗位全行业决策手册.md");
const marketPanoramaBriefPath = join(projectRoot, "01_行情收集/AI销售岗位全景总览.md");
const marketPanoramaBriefCsvPath = join(projectRoot, "01_行情收集/AI销售岗位全景总览.csv");
const marketDeliveryBriefPath = join(projectRoot, "01_行情收集/AI销售岗位市场调研交付版.md");
const marketDeliveryBriefCsvPath = join(projectRoot, "01_行情收集/AI销售岗位市场调研交付版.csv");
const roleCompanyCrossMatrixPath = join(projectRoot, "01_行情收集/AI销售岗位公司类型岗位族交叉看板.md");
const roleCompanyCrossMatrixCsvPath = join(projectRoot, "01_行情收集/AI销售岗位公司类型岗位族交叉看板.csv");
const onepageDecisionPath = join(projectRoot, "01_行情收集/AI销售岗位一页决策总表.md");
const onepageDecisionCsvPath = join(projectRoot, "01_行情收集/AI销售岗位一页决策总表.csv");
const goalCompletionAuditPath = join(projectRoot, "01_行情收集/AI销售岗位调研目标完成度审计.md");
const goalCompletionAuditCsvPath = join(projectRoot, "01_行情收集/AI销售岗位调研目标完成度审计.csv");
const companyOpportunityMapPath = join(projectRoot, "00_行业资料集/AI产业链头部公司岗位机会地图.md");
const segmentTopCompanyEvidencePath = join(projectRoot, "00_行业资料集/AI细分赛道头部公司Top10证据表.md");
const segmentTopCompanyEvidenceCsvPath = join(projectRoot, "00_行业资料集/AI细分赛道头部公司Top10证据表.csv");
const top10SamplingBatchPath = join(projectRoot, "01_行情收集/BOSS细分赛道Top10公司采样批次包.md");
const top10SamplingBatchCsvPath = join(projectRoot, "01_行情收集/BOSS细分赛道Top10公司采样批次包.csv");
const industryLandscapeCompanyPath = join(projectRoot, "00_行业资料集/AI产业链公司资料集.md");
const industryLandscapeCompanyCsvPath = join(projectRoot, "00_行业资料集/AI产业链公司资料集.csv");
const industryLandscapeSegmentCsvPath = join(projectRoot, "00_行业资料集/AI产业链销售岗位图谱.csv");
const companySegmentProfilePath = join(projectRoot, "00_行业资料集/AI销售目标公司分层画像.md");
const companyTypeMatrixPath = join(projectRoot, "00_行业资料集/AI销售公司类型岗位打法对照表.md");
const companyTypeMatrixCsvPath = join(projectRoot, "00_行业资料集/AI销售公司类型岗位打法对照表.csv");
const targetCompanyPlaybookPath = join(projectRoot, "00_行业资料集/AI目标公司销售岗位打法清单.md");
const targetCompanySamplingPath = join(projectRoot, "01_行情收集/BOSS目标公司采样缺口看板.md");
const targetCompanySamplingCsvPath = join(projectRoot, "01_行情收集/BOSS目标公司采样缺口看板.csv");
const marketConclusionGatePath = join(projectRoot, "01_行情收集/AI销售市场结论权限总控.md");
const marketConclusionGateCsvPath = join(projectRoot, "01_行情收集/AI销售市场结论权限总控.csv");
const marketEvidenceAuditPath = join(projectRoot, "01_行情收集/AI市场资料集证据审计.md");
const marketEvidenceAuditCsvPath = join(projectRoot, "01_行情收集/AI市场资料集证据审计.csv");
const resumeGapPath = join(projectRoot, "03_简历/AI销售岗位匹配与能力Gap.md");
const resumeEvidenceMatrixPath = join(projectRoot, "03_简历/AI销售能力证据与简历改写矩阵.md");
const resumeMarketClosurePath = join(projectRoot, "03_简历/AI销售市场到简历证据闭环.md");
const roleProfilePath = join(projectRoot, "02_岗位画像/AI全行业销售岗位分层画像.md");
const processedDir = join(projectRoot, "01_行情收集/data/processed");

const capabilityTaxonomy = [
  { key: "AI/大模型产品理解", aliases: ["大模型", "AI", "人工智能", "AIGC", "智能体", "Agent", "RAG", "知识库"] },
  { key: "ToB/企业服务销售", aliases: ["ToB", "B2B", "企业服务", "SaaS", "软件销售", "企业软件"] },
  { key: "大客户/KA开发", aliases: ["大客户", "KA", "关键客户", "行业客户", "客户开发", "客户开拓"] },
  { key: "行业解决方案表达", aliases: ["解决方案", "方案设计", "行业方案", "方案顾问", "售前"] },
  { key: "售前演示/POC", aliases: ["演示", "Demo", "POC", "技术交流", "需求调研", "述标"] },
  { key: "商机管理/回款", aliases: ["商机", "线索", "转化", "回款", "签约", "销售漏斗", "CRM"] },
  { key: "渠道/生态合作", aliases: ["渠道", "伙伴", "生态", "代理商", "合作伙伴"] },
  { key: "行业客户理解", aliases: ["金融", "政企", "制造", "教育", "医疗", "零售", "汽车", "互联网", "行业"] },
  { key: "项目交付协同", aliases: ["交付", "实施", "上线", "客户成功", "项目管理", "续费"] },
  { key: "技术/API/私有化基础", aliases: ["API", "接口", "私有化", "云服务", "部署", "模型", "技术方案"] }
];

function formatDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function readJobs() {
  if (!existsSync(jobsPath)) return [];
  return readFileSync(jobsPath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function isBossJob(job) {
  return !job.source || job.source === "BOSS直聘";
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const headers = lines.shift().split(",");
  return lines.map((line) => {
    const values = line.split(",");
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
  });
}

function readLineCount(filePath, hasHeader = false) {
  if (!existsSync(filePath)) return 0;
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/).filter((line) => line.trim());
  return Math.max(0, lines.length - (hasHeader ? 1 : 0));
}

function readSegments() {
  return parseCsv(readFileSync(segmentPath, "utf8"));
}

function readIndustryTargets() {
  if (!existsSync(industryTargetsPath)) return [];
  return readFileSync(industryTargetsPath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .flatMap((line) => line.split(/[，,]/).map((item) => item.trim()).filter(Boolean));
}

function readExternalSalarySignals() {
  if (!existsSync(externalSalarySignalsPath)) return [];
  return parseCsv(readFileSync(externalSalarySignalsPath, "utf8"));
}

function readBossPublicCompanySignals() {
  if (!existsSync(bossPublicCompanySignalsPath)) return [];
  return parseCsv(readFileSync(bossPublicCompanySignalsPath, "utf8"));
}

function readPublicMarketSources() {
  if (!existsSync(publicMarketSourcesPath)) return [];
  return parseCsv(readFileSync(publicMarketSourcesPath, "utf8"));
}

function readOptionalJson(filePath, fallback = {}) {
  if (!existsSync(filePath)) return fallback;
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function countBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item) || "未分类";
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function textOf(job) {
  return [
    job.title,
    job.company,
    job.salary,
    job.location,
    job.tags?.join(" "),
    job.rawText,
    job.detailText
  ].filter(Boolean).join("\n");
}

function textOfPublicSignal(item) {
  return [
    item.role,
    item.company_or_page,
    item.segment,
    item.salary,
    item.city,
    item.requirement_signal,
    item.company,
    item.role_signal,
    item.public_signal,
    item.salary_signal
  ].filter(Boolean).join("\n");
}

function includesAny(text, aliases) {
  const lower = text.toLowerCase();
  return aliases.some((alias) => lower.includes(alias.toLowerCase()));
}

function segmentForJob(job, segments) {
  const company = job.companyFilter || job.company;
  const exact = segments.find((item) => item.company === company);
  if (exact) return exact;
  return segments.find((item) => company && (company.includes(item.company) || item.company.includes(company))) || null;
}

function rolePosition(job) {
  const text = textOf(job);
  if (/销售总监|销售负责人|区域经理|销售经理|主管/.test(text)) return "销售管理";
  if (/售前|解决方案|POC|Demo|演示|技术交流|顾问/.test(text)) return "售前/解决方案";
  if (/渠道|生态|伙伴|代理商/.test(text)) return "渠道/生态";
  if (/大客户|KA|行业客户|销售|商务|BD/.test(text)) return "销售/商务";
  return job.roleFamily || "未分类";
}

function salaryStatus(salary) {
  if (!salary) return "未提取";
  if (/[\uE000-\uF8FF]/.test(salary)) return "BOSS字体混淆，保留原文";
  const match = salary.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*K/i);
  if (!match) return "非标准薪资";
  return `${match[1]}-${match[2]}K`;
}

function salaryRange(salary) {
  const text = String(salary || "").replace(/k/g, "K");
  const match = text.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*K/);
  if (match) {
    return {
      low: Number.parseFloat(match[1]),
      high: Number.parseFloat(match[2]),
      label: `${match[1]}-${match[2]}K`
    };
  }
  const annualMatch = text.match(/(\d+(?:\.\d+)?)\s*[-~－—]\s*(\d+(?:\.\d+)?)\s*W\s*\/?\s*年/i);
  if (annualMatch) {
    const low = Number.parseFloat(annualMatch[1]) * 10 / 12;
    const high = Number.parseFloat(annualMatch[2]) * 10 / 12;
    return {
      low,
      high,
      label: `${low.toFixed(1).replace(/\.0$/, "")}-${high.toFixed(1).replace(/\.0$/, "")}K/月折算`
    };
  }
  return null;
}

function average(values) {
  const nums = values.filter((value) => Number.isFinite(value));
  if (!nums.length) return 0;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

function roleBand(role) {
  if (/总监|负责人|Head|海外市场负责人|市场总监/i.test(role)) return "负责人/总监";
  if (/销售经理|客户经理|KA|大客户|区域客户|行业/.test(role)) return "大客户/行业销售经理";
  if (/售前|解决方案|顾问/.test(role)) return "售前/解决方案";
  if (/渠道|生态|伙伴/.test(role)) return "渠道/生态";
  return "销售/商务";
}

function salaryStatsBy(items, keyFn) {
  return countBy(items.filter((item) => salaryRange(item.salary)), keyFn)
    .map(([key]) => {
      const matched = items.filter((item) => keyFn(item) === key && salaryRange(item.salary));
      const ranges = matched.map((item) => salaryRange(item.salary));
      return {
        key,
        count: matched.length,
        lowMin: Math.min(...ranges.map((range) => range.low)),
        lowAvg: average(ranges.map((range) => range.low)),
        highAvg: average(ranges.map((range) => range.high)),
        highMax: Math.max(...ranges.map((range) => range.high)),
        examples: matched.slice(0, 3).map((item) => `${item.role} ${item.salary}`)
      };
    })
    .sort((a, b) => b.count - a.count || b.highAvg - a.highAvg);
}

function roleTermsForSegment(segment) {
  if (/芯片|服务器|智算|数据中心/.test(segment)) return "大客户销售、渠道销售、行业销售、售前/解决方案";
  if (/云计算|大模型平台|基座大模型|Agent平台/.test(segment)) return "大客户销售、商业化、解决方案顾问、生态合作";
  if (/客服|营销|销售AI|RPA|流程自动化/.test(segment)) return "SaaS销售、客户成功、渠道销售、销售经理";
  if (/工业|制造|视觉|质检/.test(segment)) return "制造业行业销售、KA销售、售前方案、项目型销售";
  if (/汽车|机器人|具身/.test(segment)) return "车企客户销售、渠道/海外销售、生态合作、行业方案";
  if (/安全|信创|私有化/.test(segment)) return "政企销售、行业销售、渠道管理、解决方案";
  return "AI销售、大客户销售、售前/解决方案、销售管理";
}

function targetSamplesForSegment(segment) {
  if (/云计算|大模型平台|基座大模型|客服|营销|工业|芯片|服务器|智算/.test(segment)) return 12;
  if (/Agent|RPA|视觉|汽车|机器人|安全/.test(segment)) return 10;
  return 8;
}

const segmentPlaybooks = [
  {
    segment: "基座大模型/Agent平台",
    priority: "P0",
    salaryHypothesis: "商业化/销售 20-40K；大客户/解决方案 30-60K；海外或负责人更高",
    coreRoles: "商业化销售、大客户销售、解决方案顾问、生态合作",
    capabilities: "大模型产品理解、企业场景识别、API/RAG/知识库基础、标杆案例表达",
    sampleAction: "优先采智谱AI、月之暗面、MiniMax、商汤科技、DeepSeek相关销售/商业化/解决方案岗位"
  },
  {
    segment: "云计算/大模型平台",
    priority: "P0",
    salaryHypothesis: "客户经理/行业销售 25-50K；高阶客户经理可见 35-65K·多薪",
    coreRoles: "行业客户经理、MaaS/云销售、售前解决方案、生态销售",
    capabilities: "云产品与大模型平台理解、行业客户资源、售前协同、方案和招投标",
    sampleAction: "优先补百度智能云、阿里云、火山引擎、腾讯云、华为云、科大讯飞"
  },
  {
    segment: "智能客服/营销/销售AI",
    priority: "P0",
    salaryHypothesis: "SaaS销售 8-20K；销售经理/KA 20-40K；团队负责人看业绩责任",
    coreRoles: "SaaS销售、KA销售、渠道销售、客户成功/续费",
    capabilities: "SaaS销售方法、线索转化、CRM过程管理、客户服务/营销场景理解",
    sampleAction: "优先补沃丰/Udesk、容联云、智齿、百应、网易七鱼、美洽"
  },
  {
    segment: "AI芯片/GPU/加速卡",
    priority: "P0",
    salaryHypothesis: "硬件渠道/行业销售 20-45K；政企/大客户/生态岗位可能更高",
    coreRoles: "大客户销售、渠道销售、生态合作、行业解决方案",
    capabilities: "算力芯片和服务器生态理解、长周期项目销售、政企/云/IDC客户开发",
    sampleAction: "优先补寒武纪、海光、摩尔线程、壁仞、燧原、沐曦、华为昇腾生态"
  },
  {
    segment: "AI服务器/智算基础设施",
    priority: "P0",
    salaryHypothesis: "行业销售/渠道 20-45K；智算中心和大客户方案岗更偏高薪",
    coreRoles: "服务器大客户销售、智算销售、渠道销售、售前方案",
    capabilities: "AI服务器/液冷/数据中心基础、政企大客户、金融教育运营商行业方案",
    sampleAction: "优先补浪潮、新华三、联想、中科曙光、超聚变、华鲲振宇"
  },
  {
    segment: "工业AI/智能制造",
    priority: "P1",
    salaryHypothesis: "行业销售 15-35K；制造业KA/方案销售 25-50K",
    coreRoles: "制造业行业销售、KA销售、售前方案、项目型销售",
    capabilities: "制造业业务流程、工业视觉/质检/数字化场景、项目交付协同",
    sampleAction: "优先补格创东智、创新奇智、树根互联、卡奥斯、黑湖、赛意信息"
  },
  {
    segment: "AI Agent/RPA/流程自动化",
    priority: "P1",
    salaryHypothesis: "SaaS/企业销售 12-30K；大客户/售前 25-45K",
    coreRoles: "企业销售、大客户销售、售前顾问、渠道合作",
    capabilities: "流程自动化、ROI测算、业务流程拆解、Demo/POC推进",
    sampleAction: "优先补实在智能、来也、影刀、弘玑、达观、合合信息"
  },
  {
    segment: "数据/MLOps/AI基础软件",
    priority: "P1",
    salaryHypothesis: "企业软件销售 20-45K；金融/制造大客户和售前更高",
    coreRoles: "企业软件销售、数据库/数据平台销售、售前方案、客户成功",
    capabilities: "数据平台/向量数据库/MLOps/RAG基础、技术客户沟通、行业解决方案",
    sampleAction: "优先补第四范式、星环、Zilliz、神策、明略、袋鼠云"
  },
  {
    segment: "智能汽车/机器人/具身智能",
    priority: "P1",
    salaryHypothesis: "渠道/海外销售 20-45K；负责人/出海岗位可能 40K+",
    coreRoles: "车企客户销售、生态合作、海外销售、渠道管理",
    capabilities: "软硬件结合、车企/机器人渠道、海外市场、生态伙伴管理",
    sampleAction: "优先补地平线、速腾聚创、禾赛、优必选、宇树、文远知行"
  },
  {
    segment: "AI安全/私有化/信创",
    priority: "P1",
    salaryHypothesis: "政企销售 15-35K；行业销售/销售管理 25-50K",
    coreRoles: "政企销售、行业客户经理、渠道管理、解决方案",
    capabilities: "政企客户、招投标、安全/合规/私有化交付、渠道生态",
    sampleAction: "优先补奇安信、深信服、安恒、360数字安全、绿盟、天融信"
  },
  {
    segment: "AI视觉/安防/质检",
    priority: "P2",
    salaryHypothesis: "渠道/行业销售 15-35K；制造业和政企方案岗 25-45K",
    coreRoles: "政企销售、渠道销售、制造业销售、售前方案",
    capabilities: "视觉AI/质检/安防场景、渠道体系、政企/制造客户、项目型销售",
    sampleAction: "优先补海康、大华、旷视、云从、凌云光、创新奇智"
  },
  {
    segment: "智算中心/数据中心服务",
    priority: "P2",
    salaryHypothesis: "IDC/算力销售 20-45K；大客户和能源/园区方案岗更高",
    coreRoles: "IDC大客户销售、算力服务销售、政企销售、渠道生态",
    capabilities: "数据中心/算力租赁/网络互联、园区/政企客户、长周期项目推进",
    sampleAction: "优先补万国数据、世纪互联、润泽、奥飞、光环新网、科华数据"
  }
];

const roleProfiles = [
  {
    role: "AI软件/大模型销售",
    targetCompanies: "智谱AI、月之暗面、MiniMax、商汤、百度智能云、阿里云",
    salaryHypothesis: "20-40K为主要观察区间；高阶大客户可上探30-60K",
    mustHave: "AI/大模型产品语言、ToB销售、客户痛点识别、方案价值表达",
    evidence: "AI产品或企业服务销售案例；客户场景、商机推进、签约/回款/转化数据"
  },
  {
    role: "大客户/行业销售经理",
    targetCompanies: "云厂商、工业AI、智算、半导体、AI安全和企业协同公司",
    salaryHypothesis: "30-60K是高薪样本重点区间；多薪制常见于平台型公司",
    mustHave: "行业客户资源、KA开发、决策链影响、项目型销售和回款管理",
    evidence: "单个大客户从线索到签约的闭环；金额、周期、决策人、竞争态势"
  },
  {
    role: "售前/解决方案顾问",
    targetCompanies: "云平台、AI基础软件、工业AI、AI安全、智算基础设施",
    salaryHypothesis: "20-45K为主要观察区间；复杂行业方案可能更高",
    mustHave: "需求调研、Demo/POC、方案设计、API/私有化/交付基础",
    evidence: "方案文档、POC推进、客户技术交流、投标/述标、上线结果"
  },
  {
    role: "渠道/生态/伙伴销售",
    targetCompanies: "AI芯片、服务器、云平台、智能硬件、SaaS应用公司",
    salaryHypothesis: "15-35K为基础区间；生态负责人和区域管理更高",
    mustHave: "渠道开发、伙伴激活、联合方案、区域经营和销售过程管理",
    evidence: "渠道数量、激活率、联合商机、渠道收入、区域覆盖结果"
  },
  {
    role: "销售管理/区域负责人",
    targetCompanies: "AI应用SaaS、出海AI、智能硬件、云平台、政企安全",
    salaryHypothesis: "30-70K是负责人类岗位重点观察区间，常与业绩责任绑定",
    mustHave: "团队管理、目标拆解、销售预测、关键客户攻坚、跨部门协同",
    evidence: "团队规模、年度目标、达成率、关键客户案例、机制建设"
  },
  {
    role: "硬件/智算/半导体行业销售",
    targetCompanies: "寒武纪、海光、摩尔线程、浪潮、新华三、超聚变、智算中心",
    salaryHypothesis: "20-45K为主；政企/云/IDC大客户和生态岗位更高",
    mustHave: "算力链条理解、硬件产品语言、长周期项目推进、政企/渠道生态",
    evidence: "服务器/硬件/政企项目经验；招投标、渠道、交付协同、回款周期"
  }
];

function segmentPlaybookRows() {
  return segmentPlaybooks.map((item) => {
    return `| ${item.priority} | ${item.segment} | ${item.salaryHypothesis} | ${item.coreRoles} | ${item.capabilities} | ${item.sampleAction} |`;
  });
}

function roleProfileRows() {
  return roleProfiles.map((item) => {
    return `| ${item.role} | ${item.targetCompanies} | ${item.salaryHypothesis} | ${item.mustHave} | ${item.evidence} |`;
  });
}

function segmentSampleMatrixRows(segments, jobs) {
  const grouped = countBy(segments, (item) => item.segment).map(([segment]) => segment);
  return grouped.map((segment) => {
    const companies = segments
      .filter((item) => item.segment === segment)
      .sort((a, b) => Number(a.priority || 99) - Number(b.priority || 99))
      .slice(0, 6)
      .map((item) => item.company)
      .join("、");
    const current = jobs.filter((job) => segmentForJob(job, segments)?.segment === segment).length;
    const target = targetSamplesForSegment(segment);
    const gap = Math.max(0, target - current);
    return `| ${segment} | ${companies} | ${roleTermsForSegment(segment)} | ${current} | ${target} | ${gap} |`;
  });
}

function safeBossCommand(rateLimitConfig) {
  const boss = rateLimitConfig.boss || {};
  const maxBatches = boss.overnightMaxBatches ?? 8;
  const batchSize = boss.overnightBatchSize ?? 1;
  const cards = boss.maxCardsPerSearch ?? 2;
  const detailLimit = boss.maxDetailPagesPerRun ?? 0;
  const delayMs = boss.minRequestIntervalMs ?? 600000;
  const cooldownMs = boss.overnightCooldownMs ?? 1800000;
  const jitterMs = boss.defaultJitterMs ?? 180000;
  return `npm run overnight:research -- --city 广州 --max-batches ${maxBatches} --batch-size ${batchSize} --cards-per-search ${cards} --detail-limit ${detailLimit} --delay-ms ${delayMs} --cooldown-ms ${cooldownMs} --jitter-ms ${jitterMs} --resume-after-risk`;
}

function latestFile(prefix) {
  if (!existsSync(processedDir)) return "";
  const files = readdirSync(processedDir)
    .filter((name) => name.startsWith(prefix) && name.endsWith(".json"))
    .map((name) => join(processedDir, name))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return files[0] || "";
}

function markdownRows(rows, emptyRow) {
  return rows.length ? rows.join("\n") : emptyRow;
}

function isBossUrl(value) {
  return /zhipin\.com/i.test(String(value || ""));
}

function safeKeyword(...values) {
  return values
    .map((value) => String(value || "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" ")
    .slice(0, 80);
}

function safeSourceCell(url, keyword) {
  if (!url) return "-";
  if (isBossUrl(url)) return `BOSS首页站内复核：\`${keyword || "公司 岗位"}\``;
  return `[来源](${url})`;
}

const allJobs = readJobs();
const jobs = allJobs.filter(isBossJob);
const segments = readSegments();
const industries = readIndustryTargets();
const externalSalarySignals = readExternalSalarySignals();
const bossPublicCompanySignals = readBossPublicCompanySignals();
const publicMarketSources = readPublicMarketSources();
const bossLocalCacheEvidenceRows = existsSync(bossLocalCacheEvidenceCsvPath)
  ? parseCsv(readFileSync(bossLocalCacheEvidenceCsvPath, "utf8"))
  : [];
const manualSamplingWorkbenchRows = existsSync(manualSamplingWorkbenchCsvPath)
  ? parseCsv(readFileSync(manualSamplingWorkbenchCsvPath, "utf8"))
  : [];
const manualSamplingBatchRows = existsSync(manualSamplingBatchCsvPath)
  ? parseCsv(readFileSync(manualSamplingBatchCsvPath, "utf8"))
  : [];
const manualSamplingBatchStatusRows = existsSync(manualSamplingBatchStatusCsvPath)
  ? parseCsv(readFileSync(manualSamplingBatchStatusCsvPath, "utf8"))
  : [];
const firstManualSamplingInboxQualityRows = existsSync(firstManualSamplingInboxQualityCsvPath)
  ? parseCsv(readFileSync(firstManualSamplingInboxQualityCsvPath, "utf8"))
  : [];
const bossSampleGapRows = existsSync(bossSampleGapCsvPath)
  ? parseCsv(readFileSync(bossSampleGapCsvPath, "utf8"))
  : [];
const conclusionUpgradeConsoleRows = existsSync(conclusionUpgradeConsoleCsvPath)
  ? parseCsv(readFileSync(conclusionUpgradeConsoleCsvPath, "utf8"))
  : [];
const bossSampleQualityRows = existsSync(bossSampleQualityCsvPath)
  ? parseCsv(readFileSync(bossSampleQualityCsvPath, "utf8"))
  : [];
const hardwareSpecialRows = existsSync(hardwareSpecialReportCsvPath)
  ? parseCsv(readFileSync(hardwareSpecialReportCsvPath, "utf8"))
  : [];
const hardwarePriorityRows = existsSync(hardwarePriorityQueueCsvPath)
  ? parseCsv(readFileSync(hardwarePriorityQueueCsvPath, "utf8"))
  : [];
const companyTypeRows = existsSync(companyTypeMatrixCsvPath)
  ? parseCsv(readFileSync(companyTypeMatrixCsvPath, "utf8"))
  : [];
const marketPanoramaRows = existsSync(marketPanoramaBriefCsvPath)
  ? parseCsv(readFileSync(marketPanoramaBriefCsvPath, "utf8"))
  : [];
const marketDeliveryBriefCount = readLineCount(marketDeliveryBriefCsvPath, true);
const roleCompanyCrossMatrixCount = readLineCount(roleCompanyCrossMatrixCsvPath, true);
const onepageDecisionCount = readLineCount(onepageDecisionCsvPath, true);
const goalCompletionAuditCount = readLineCount(goalCompletionAuditCsvPath, true);
const industryLandscapeCompanyCount = readLineCount(industryLandscapeCompanyCsvPath, true);
const industryLandscapeSegmentCount = readLineCount(industryLandscapeSegmentCsvPath, true);
const targetCompanySamplingRows = existsSync(targetCompanySamplingCsvPath)
  ? parseCsv(readFileSync(targetCompanySamplingCsvPath, "utf8"))
  : [];
const marketConclusionGateRows = existsSync(marketConclusionGateCsvPath)
  ? parseCsv(readFileSync(marketConclusionGateCsvPath, "utf8"))
  : [];
const marketEvidenceAuditRows = existsSync(marketEvidenceAuditCsvPath)
  ? parseCsv(readFileSync(marketEvidenceAuditCsvPath, "utf8"))
  : [];
const segmentTopCompanyEvidenceRows = existsSync(segmentTopCompanyEvidenceCsvPath)
  ? parseCsv(readFileSync(segmentTopCompanyEvidenceCsvPath, "utf8"))
  : [];
const top10SamplingBatchRows = existsSync(top10SamplingBatchCsvPath)
  ? parseCsv(readFileSync(top10SamplingBatchCsvPath, "utf8"))
  : [];
const rateLimitConfig = readOptionalJson(rateLimitConfigPath, {});
const now = formatDate();
const latestPlanPath = latestFile("overnight_research_");
const manualSamplingBatchCount = new Set(manualSamplingBatchRows.map((row) => row.batchId).filter(Boolean)).size;
const top10SamplingBatchCount = new Set(top10SamplingBatchRows.map((row) => row.batchId).filter(Boolean)).size;
const manualSamplingBatchDoneCount = manualSamplingBatchStatusRows.filter((row) => row.status === "达标").length;
const firstManualSamplingInboxReadyCount = firstManualSamplingInboxQualityRows
  .filter((row) => row.readyToImport === "是").length;
const firstManualSamplingInboxEstimatedJobs = firstManualSamplingInboxQualityRows
  .reduce((sum, row) => sum + Number(row.estimatedJobs || 0), 0);
const firstManualSamplingInboxTargetCopies = firstManualSamplingInboxQualityRows
  .reduce((sum, row) => sum + Number(row.targetCopies || 0), 0);
const segmentCounts = countBy(segments, (item) => item.segment);
const layerCounts = countBy(segments, (item) => item.layer);
const jobsBySegment = countBy(jobs, (job) => segmentForJob(job, segments)?.segment || "未映射");
const jobsByCompany = countBy(jobs, (job) => job.company).slice(0, 20);
const jobsByPosition = countBy(jobs, rolePosition);
const capabilities = capabilityTaxonomy
  .map((capability) => {
    const matched = jobs.filter((job) => includesAny(textOf(job), capability.aliases));
    return { ...capability, count: matched.length, examples: matched.slice(0, 3).map((job) => job.title).filter(Boolean) };
  })
  .filter((item) => item.count > 0)
  .sort((a, b) => b.count - a.count);
const publicSignals = [...externalSalarySignals, ...bossPublicCompanySignals];
const publicCapabilities = capabilityTaxonomy
  .map((capability) => {
    const matched = publicSignals.filter((item) => includesAny(textOfPublicSignal(item), capability.aliases));
    return {
      ...capability,
      count: matched.length,
      examples: matched.slice(0, 4).map((item) => item.role || `${item.company} ${item.role_signal}`).filter(Boolean)
    };
  })
  .filter((item) => item.count > 0)
  .sort((a, b) => b.count - a.count);
const sampleRows = jobs
  .slice()
  .sort((a, b) => String(b.collectedAt).localeCompare(String(a.collectedAt)))
  .slice(0, 30)
  .map((job) => {
    const segment = segmentForJob(job, segments)?.segment || "";
    return `| ${job.collectedAt ? formatDate(job.collectedAt) : ""} | ${segment} | ${job.title || ""} | ${job.company || ""} | ${job.salary || ""} | ${salaryStatus(job.salary)} | ${job.location || job.city || ""} | ${safeSourceCell(job.url, safeKeyword(job.company, job.title))} |`;
  });
const externalSalaryRows = externalSalarySignals.map((item) => {
  return `| ${item.platform} | ${item.segment} | ${item.role} | ${item.company_or_page} | ${item.salary} | ${item.city} | ${item.requirement_signal} | ${safeSourceCell(item.url, safeKeyword(item.company_or_page, item.role))} |`;
});
const publicCompanyRows = bossPublicCompanySignals.map((item) => {
  return `| ${item.company} | ${item.segment} | ${item.signal_type} | ${item.role_signal} | ${item.salary_signal || "-"} | ${item.public_signal} | ${safeSourceCell(item.source_url, safeKeyword(item.company, item.role_signal))} |`;
});
const publicMarketSourceRows = publicMarketSources.map((item) => {
  return `| ${item.source} | ${item.year} | ${item.topic} | ${item.key_signal} | ${item.sales_implication} | ${safeSourceCell(item.url, item.topic)} |`;
});
const hardwareSpecialTableRows = hardwareSpecialRows.map((item, index) => {
  return `| ${index + 1} | ${item.segment} | ${item.routeLayer} | ${item.companyCount} | ${item.p0Companies || item.topCompanies} | ${item.primaryRoles} | ${item.salaryBand} | ${item.publicSalaryMaxK || "-"} | ${item.bossCleanSamples || 0} | ${item.bossCacheCandidates || 0} | ${item.sampleGap || 0} | ${item.nextAction} |`;
});
const hardwarePriorityTableRows = hardwarePriorityRows.slice(0, 15).map((item) => {
  const keyword = item.searchKeyword || `${item.company} ${item.role}`.trim();
  return `| ${item.rank} | ${item.priority} | ${item.segment} | ${item.company} | ${item.role} | ${item.salaryBand || "-"} | ${item.sourceQueue} | https://www.zhipin.com/ | \`${keyword}\` |`;
});
const companyTypeTableRows = companyTypeRows.slice(0, 12).map((item) => {
  return `| ${item.rank} | ${item.priority} | ${item.route} | ${item.segment} | ${item.companyType} | ${item.productSold} | ${item.companyExamples} | ${item.roleFocus} | ${item.salaryBand} | ${item.sampleProgress || "0/0"} |`;
});
const marketEvidenceAuditTableRows = marketEvidenceAuditRows
  .filter((item) => item.scope === "赛道")
  .slice(0, 12)
  .map((item) => {
    return `| ${item.priority} | ${item.route} | ${item.segment} | ${item.companyCount} | ${item.publicTrendSources} | ${item.publicSalarySignals} | ${item.bossCleanSamples}/${item.targetSamples} | ${item.sampleGap} | ${item.evidenceGrade} | ${item.conclusionBoundary} |`;
  });
const segmentTopCompanyEvidenceTableRows = segmentTopCompanyEvidenceRows
  .filter((item) => Number(item.segmentRank || 0) <= 3)
  .slice(0, 36)
  .map((item) => {
    return `| ${item.route} | ${item.segment} | ${item.segmentRank} | ${item.company} | ${item.layer} | ${item.recommendedRoles} | ${item.currentSamples}/${item.targetSamples} | ${item.bossEvidenceStatus} | ${item.segmentConclusionBoundary} |`;
  });
const top10SamplingBatchTableRows = top10SamplingBatchRows
  .slice(0, 16)
  .map((item) => {
    return `| ${item.batchId} | ${item.priority} | ${item.segment} | ${item.company} | ${item.role} | ${item.salaryBand || "待补"} | ${item.currentSamples}/${item.targetSamples} | ${item.targetCopies} | \`${item.safeHomeUrl}\` | \`${item.searchKeyword}\` |`;
  });
const segmentPlaybookMdRows = segmentPlaybookRows();
const roleProfileMdRows = roleProfileRows();
const publicCapabilityRows = publicCapabilities.map((item, index) => {
  return `| ${index + 1} | ${item.key} | ${item.count} | ${item.examples.join("；")} |`;
});
const salaryBySegmentRows = salaryStatsBy(externalSalarySignals, (item) => item.segment).map((item) => {
  return `| ${item.key} | ${item.count} | ${item.lowMin.toFixed(0)}K | ${item.lowAvg.toFixed(1)}K | ${item.highAvg.toFixed(1)}K | ${item.highMax.toFixed(0)}K | ${item.examples.join("；")} |`;
});
const salaryByRoleRows = salaryStatsBy(externalSalarySignals, (item) => roleBand(item.role)).map((item) => {
  return `| ${item.key} | ${item.count} | ${item.lowMin.toFixed(0)}K | ${item.lowAvg.toFixed(1)}K | ${item.highAvg.toFixed(1)}K | ${item.highMax.toFixed(0)}K | ${item.examples.join("；")} |`;
});
const sampleMatrixRows = segmentSampleMatrixRows(segments, jobs);
const bossLimits = rateLimitConfig.boss || {};
const autoCollectionPaused = Boolean(bossLimits.requireResumeFlag);
const safeOvernightCommand = safeBossCommand(rateLimitConfig);

const report = `# AI全行业销售岗位市场调研

更新时间：${now}

## 一、本质判断

这件事本质上不是简单找“AI销售”岗位，而是建立一个横跨 AI 软件落地、基座大模型、云和算力、芯片/半导体、工业制造、智能客服/营销、机器人和 AI 安全的销售岗位市场地图。

当前最大的矛盾是：既要“大而全”覆盖全行业，又要保证 BOSS 样本真实相关，同时不能因为高频采集触发平台风控。

## 二、调研范围

| 维度 | 当前覆盖 |
| --- | ---: |
| AI产业链公司池 | ${segments.length} 家 |
| 细分赛道关键词 | ${industries.length} 个 |
| BOSS干净岗位样本 | ${jobs.length} 条 |
| BOSS历史缓存候选线索 | ${bossLocalCacheEvidenceRows.length} 条 |
| BOSS人工补样工作台 | ${manualSamplingWorkbenchRows.length ? `${manualSamplingWorkbenchRows.length} 条任务` : "未生成"} |
| BOSS人工采样批次包 | ${manualSamplingBatchRows.length ? `${manualSamplingBatchCount} 批 / ${manualSamplingBatchRows.length} 个入口` : "未生成"} |
| BOSS细分赛道Top10公司采样批次包 | ${top10SamplingBatchRows.length ? `${top10SamplingBatchCount} 批 / ${top10SamplingBatchRows.length} 个入口` : "未生成"} |
| BOSS人工采样批次进度 | ${manualSamplingBatchStatusRows.length ? `${manualSamplingBatchDoneCount}/${manualSamplingBatchStatusRows.length} 批达标` : "未生成"} |
| BOSS首批收件箱质量预检 | ${firstManualSamplingInboxQualityRows.length ? `${firstManualSamplingInboxReadyCount}/${firstManualSamplingInboxQualityRows.length} 段可导入 / 估算 ${firstManualSamplingInboxEstimatedJobs} 条 / 目标 ${firstManualSamplingInboxTargetCopies} 条` : "未生成"} |
| BOSS全行业样本缺口路线图 | ${bossSampleGapRows.length} 个赛道 |
| BOSS结论升级采样控制台 | ${conclusionUpgradeConsoleRows.length ? `${conclusionUpgradeConsoleRows.length} 个赛道` : "未生成"} |
| BOSS样本质量验收报告 | ${bossSampleQualityRows.length ? `${bossSampleQualityRows.length} 条样本` : "未生成"} |
| BOSS目标公司采样缺口看板 | ${targetCompanySamplingRows.length ? `${targetCompanySamplingRows.length} 家公司` : "未生成"} |
| AI销售市场结论权限总控 | ${marketConclusionGateRows.length ? `${marketConclusionGateRows.length} 条结论门禁` : "未生成"} |
| AI市场资料集证据审计 | ${marketEvidenceAuditRows.length ? `${Math.max(0, marketEvidenceAuditRows.length - 1)} 个赛道 / 1 条全局` : "未生成"} |
| 硬件/算力/半导体专项赛道 | ${hardwareSpecialRows.length} 个 |
| BOSS硬件方向优先采样任务 | ${hardwarePriorityRows.length} 条 |
| AI销售公司类型岗位打法对照 | ${companyTypeRows.length} 个赛道 |
| AI销售岗位全景总览 | ${marketPanoramaRows.length ? `${marketPanoramaRows.length} 个赛道` : "未生成"} |
| AI销售岗位市场调研交付版 | ${marketDeliveryBriefCount ? `${marketDeliveryBriefCount} 个赛道` : "未生成"} |
| AI销售岗位公司类型岗位族交叉看板 | ${roleCompanyCrossMatrixCount ? `${roleCompanyCrossMatrixCount} 个组合` : "未生成"} |
| AI销售岗位一页决策总表 | ${onepageDecisionCount ? `${onepageDecisionCount} 行决策入口` : "未生成"} |
| AI销售岗位调研目标完成度审计 | ${goalCompletionAuditCount ? `${goalCompletionAuditCount} 条目标拆解` : "未生成"} |
| AI产业链销售岗位图谱 | ${industryLandscapeSegmentCount ? `${industryLandscapeSegmentCount} 个赛道 / ${industryLandscapeCompanyCount} 家公司` : "未生成"} |
| AI细分赛道头部公司Top10证据表 | ${segmentTopCompanyEvidenceRows.length ? `${segmentTopCompanyEvidenceRows.length} 家公司` : "未生成"} |
| 公开搜索补充薪资信号 | ${externalSalarySignals.length} 条 |
| BOSS公开公司/岗位在招信号 | ${bossPublicCompanySignals.length} 条 |
| 公开趋势校验来源 | ${publicMarketSources.length} 条 |
| 公开趋势信号看板 | ${existsSync(publicSignalBoardPath) ? publicSignalBoardPath : "未生成"} |
| BOSS历史缓存候选线索库 | ${existsSync(bossLocalCacheEvidencePath) ? bossLocalCacheEvidencePath : "未生成"} |
| AI硬件算力半导体销售岗位专项分析 | ${existsSync(hardwareSpecialReportPath) ? hardwareSpecialReportPath : "未生成"} |
| BOSS硬件算力半导体优先采样清单 | ${existsSync(hardwarePriorityQueuePath) ? hardwarePriorityQueuePath : "未生成"} |
| AI公开招聘薪资证据库 | ${existsSync(publicRecruitmentEvidencePath) ? publicRecruitmentEvidencePath : "未生成"} |
| AI销售岗位全行业决策手册 | ${existsSync(marketDecisionHandbookPath) ? marketDecisionHandbookPath : "未生成"} |
| AI销售岗位全景总览 | ${existsSync(marketPanoramaBriefPath) ? marketPanoramaBriefPath : "未生成"} |
| AI销售岗位市场调研交付版 | ${existsSync(marketDeliveryBriefPath) ? marketDeliveryBriefPath : "未生成"} |
| AI销售岗位公司类型岗位族交叉看板 | ${existsSync(roleCompanyCrossMatrixPath) ? roleCompanyCrossMatrixPath : "未生成"} |
| AI销售岗位一页决策总表 | ${existsSync(onepageDecisionPath) ? onepageDecisionPath : "未生成"} |
| AI销售岗位调研目标完成度审计 | ${existsSync(goalCompletionAuditPath) ? goalCompletionAuditPath : "未生成"} |
| AI产业链公司资料集 | ${existsSync(industryLandscapeCompanyPath) ? industryLandscapeCompanyPath : "未生成"} |
| AI产业链销售岗位图谱 | ${existsSync(industryLandscapeSegmentCsvPath) ? industryLandscapeSegmentCsvPath : "未生成"} |
| AI细分赛道头部公司Top10证据表 | ${existsSync(segmentTopCompanyEvidencePath) ? segmentTopCompanyEvidencePath : "未生成"} |
| BOSS细分赛道Top10公司采样批次包 | ${existsSync(top10SamplingBatchPath) ? top10SamplingBatchPath : "未生成"} |
| AI销售薪资待遇与能力门槛分析 | ${existsSync(compensationGateAnalysisPath) ? compensationGateAnalysisPath : "未生成"} |
| AI销售能力要求矩阵 | ${existsSync(capabilityRequirementMatrixPath) ? capabilityRequirementMatrixPath : "未生成"} |
| AI销售岗位市场决策总览 | ${existsSync(decisionOverviewPath) ? decisionOverviewPath : "未生成"} |
| AI细分赛道销售机会矩阵 | ${existsSync(segmentOpportunityMatrixPath) ? segmentOpportunityMatrixPath : "未生成"} |
| AI销售目标公司分层画像 | ${existsSync(companySegmentProfilePath) ? companySegmentProfilePath : "未生成"} |
| AI销售公司类型岗位打法对照表 | ${existsSync(companyTypeMatrixPath) ? companyTypeMatrixPath : "未生成"} |
| AI目标公司销售岗位打法清单 | ${existsSync(targetCompanyPlaybookPath) ? targetCompanyPlaybookPath : "未生成"} |
| BOSS目标公司采样缺口看板 | ${existsSync(targetCompanySamplingPath) ? targetCompanySamplingPath : "未生成"} |
| AI销售市场结论权限总控 | ${existsSync(marketConclusionGatePath) ? marketConclusionGatePath : "未生成"} |
| AI市场资料集证据审计 | ${existsSync(marketEvidenceAuditPath) ? marketEvidenceAuditPath : "未生成"} |
| 简历匹配Gap看板 | ${existsSync(resumeGapPath) ? resumeGapPath : "未生成"} |
| AI销售能力证据与简历改写矩阵 | ${existsSync(resumeEvidenceMatrixPath) ? resumeEvidenceMatrixPath : "未生成"} |
| AI销售市场到简历证据闭环 | ${existsSync(resumeMarketClosurePath) ? resumeMarketClosurePath : "未生成"} |
| BOSS人工补样工作台 | ${existsSync(manualSamplingWorkbenchPath) ? manualSamplingWorkbenchPath : "未生成"} |
| BOSS人工采样批次包 | ${existsSync(manualSamplingBatchPath) ? manualSamplingBatchPath : "未生成"} |
| BOSS人工采样批次进度看板 | ${existsSync(manualSamplingBatchStatusPath) ? manualSamplingBatchStatusPath : "未生成"} |
| BOSS首批人工采样收件箱质量预检 | ${existsSync(firstManualSamplingInboxQualityPath) ? firstManualSamplingInboxQualityPath : "未生成"} |
| 下一轮低频采样清单 | ${existsSync(nextSamplingQueuePath) ? nextSamplingQueuePath : "未生成"} |
| BOSS全行业样本缺口路线图 | ${existsSync(bossSampleGapPath) ? bossSampleGapPath : "未生成"} |
| BOSS结论升级采样控制台 | ${existsSync(conclusionUpgradeConsolePath) ? conclusionUpgradeConsolePath : "未生成"} |
| BOSS样本质量验收报告 | ${existsSync(bossSampleQualityPath) ? bossSampleQualityPath : "未生成"} |
| 最新整晚采集计划 | ${latestPlanPath || "未生成"} |
| BOSS自动访问策略 | ${autoCollectionPaused ? "风控恢复期：默认暂停，需 --resume-after-risk" : "可低频执行"} |

| 产业层级 | 公司数 |
| --- | ---: |
${markdownRows(layerCounts.map(([layer, count]) => `| ${layer} | ${count} |`), "| 暂无 | 0 |")}

## 三、AI行业销售岗位赛道拆解

| 细分赛道 | 公司池数量 | 销售机会类型 |
| --- | ---: | --- |
${markdownRows(segmentCounts.map(([segment, count]) => {
  const examples = segments.filter((item) => item.segment === segment).slice(0, 3).map((item) => item.sales_fit).join("；");
  return `| ${segment} | ${count} | ${examples} |`;
}), "| 暂无 | 0 |  |")}

### 分赛道采样矩阵

这张表用于把“大而全”的目标拆成可执行样本配额。当前 BOSS 自动访问处于恢复期，优先通过人工复制岗位详情导入；恢复自动访问后也按每个赛道逐批低频采集。

| 细分赛道 | 优先公司 | 优先岗位词 | 当前BOSS样本 | 目标样本 | 缺口 |
| --- | --- | --- | ---: | ---: | ---: |
${markdownRows(sampleMatrixRows, "| 暂无 |  |  | 0 | 0 | 0 |")}

### 公开趋势校验来源

这些来源不替代 BOSS 岗位样本，但用于判断哪些赛道值得优先采样，以及为什么 AI 销售岗位不能只看互联网和纯软件公司。

| 来源 | 年份 | 主题 | 关键信号 | 对销售岗位采样的含义 | 链接 |
| --- | --- | --- | --- | --- | --- |
${markdownRows(publicMarketSourceRows, "| 暂无 |  |  |  |  |  |")}

### 赛道优先级与销售打法

| 优先级 | 赛道 | 薪资假设 | 核心岗位 | 核心能力 | 下一步采样动作 |
| --- | --- | --- | --- | --- | --- |
${markdownRows(segmentPlaybookMdRows, "| 暂无 |  |  |  |  |  |")}

### 公司类型与岗位打法

这张表用于回答“这些公司到底卖什么、客户是谁、销售岗怎么做”。它把大模型软件公司、云/MaaS、AI应用SaaS、芯片/半导体、AI服务器、智算中心、工业AI等公司类型放在同一套口径里比较。

| 排名 | 优先级 | 路线 | 赛道 | 公司类型 | 主要卖什么 | 代表公司 | 首看岗位 | 薪资观察 | 样本进度 |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- | ---: |
${markdownRows(companyTypeTableRows, "| 1 | 暂无 |  |  |  |  |  |  |  | 0/0 |")}

### 细分赛道头部公司Top10

这张表回答“每个细分领域到底先看哪些公司”。主报告只展示每个赛道前3家公司，完整 Top10 证据表见：${existsSync(segmentTopCompanyEvidencePath) ? segmentTopCompanyEvidencePath : "未生成"}。

| 路线 | 赛道 | 排名 | 公司 | 层级 | 优先岗位词 | BOSS样本 | 证据状态 | 结论边界 |
| --- | --- | ---: | --- | --- | --- | ---: | --- | --- |
${markdownRows(segmentTopCompanyEvidenceTableRows, "| 暂无 |  | 0 |  |  |  | 0/0 |  |  |")}

### Top10公司低频人工采样批次

这张表把 Top10 公司证据表转成可人工执行的低频 BOSS 采样队列。完整批次包见：${existsSync(top10SamplingBatchPath) ? top10SamplingBatchPath : "未生成"}。

执行方式不是点击或粘贴完整搜索 URL，而是先运行 \`npm run auth:boss\` 生成本地安全入口页，再手动打开普通 Chrome 进入 BOSS 首页，页面稳定后在站内搜索框输入关键词。

| 批次 | 优先级 | 赛道 | 公司 | 岗位词 | 薪资参考 | 当前/目标 | 目标导入 | BOSS首页 | 站内搜索关键词 |
| --- | --- | --- | --- | --- | --- | ---: | ---: | --- | --- |
${markdownRows(top10SamplingBatchTableRows, "| 暂无 |  |  |  |  |  | 0/0 | 0 |  |  |")}

### 资料集证据审计

这张表用于区分“公司池/公开资料已经成型”和“BOSS岗位样本已经验证”。目前它是写市场判断前的证据闸门，避免把 AI 图谱、公开薪资或少量岗位样本误写成全行业结论。

| 优先级 | 路线 | 赛道 | 公司数 | 公开趋势 | 公开薪资 | BOSS样本 | 样本缺口 | 证据等级 | 结论边界 |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
${markdownRows(marketEvidenceAuditTableRows, "| 暂无 |  |  | 0 | 0 | 0 | 0/0 | 0 |  |  |")}

## 四、BOSS当前样本分布

> 当前 BOSS 自动访问处于${autoCollectionPaused ? "风控恢复期：默认暂停自动打开和刷新页面" : "低频采样模式"}。以下只代表已采到的干净样本，不代表完整市场结论。

| 岗位定位 | 样本数 |
| --- | ---: |
${markdownRows(jobsByPosition.map(([position, count]) => `| ${position} | ${count} |`), "| 暂无 | 0 |")}

| 赛道 | 样本数 |
| --- | ---: |
${markdownRows(jobsBySegment.map(([segment, count]) => `| ${segment} | ${count} |`), "| 暂无 | 0 |")}

| 公司 | 样本数 |
| --- | ---: |
${markdownRows(jobsByCompany.map(([company, count]) => `| ${company} | ${count} |`), "| 暂无 | 0 |")}

### BOSS历史缓存候选线索

这部分不是新增采集，也不是正式干净样本；它来自本地历史缓存，用于在风控恢复期减少对 BOSS 页面的访问，同时筛出下一批最值得人工复核的岗位。

| 指标 | 数量 |
| --- | ---: |
| 缓存候选总数 | ${bossLocalCacheEvidenceRows.length} |
| 高价值候选 | ${bossLocalCacheEvidenceRows.filter((row) => row.evidenceLevel === "高价值候选").length} |
| 待人工确认 | ${bossLocalCacheEvidenceRows.filter((row) => row.evidenceLevel === "待人工确认").length} |
| 带详情文本 | ${bossLocalCacheEvidenceRows.filter((row) => Number(row.detailTextLength || 0) > 500).length} |
| 已进入干净样本 | ${bossLocalCacheEvidenceRows.filter((row) => row.inCleanSample === "是").length} |

候选库路径：${existsSync(bossLocalCacheEvidencePath) ? bossLocalCacheEvidencePath : "未生成"}

## 五、硬件/算力/半导体专项拆解

这部分把你明确关注的芯片、半导体、AI服务器、智算中心、智能硬件和制造业AI单独拉出来。当前结论仍是“公开证据 + 公司池 + BOSS缓存候选 + 人工采样队列”的阶段性判断，不把它包装成 BOSS 大样本结论。

| 排名 | 赛道 | 产业位置 | 公司数 | 优先公司 | 典型岗位 | 薪资观察 | 公开薪资上限 | BOSS干净样本 | 缓存候选 | 样本缺口 | 下一步 |
| ---: | --- | --- | ---: | --- | --- | --- | ---: | ---: | ---: | ---: | --- |
${markdownRows(hardwareSpecialTableRows, "| 1 | 暂无 |  | 0 |  |  |  | - | 0 | 0 | 0 |  |")}

### 硬件方向下一批人工采样

| 排名 | 优先级 | 赛道 | 公司 | 岗位词 | 薪资观察 | 来源队列 | BOSS首页 | 站内搜索关键词 |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- |
${markdownRows(hardwarePriorityTableRows, "| 1 | 暂无 |  |  |  |  |  |  |  |")}

## 六、薪资待遇样本

BOSS 网页端薪资存在平台字体混淆，脚本会保留原始薪资文本；后续若需要精确薪资统计，建议结合人工可见页面或导出后的可读文本做二次校验。

| 采集时间 | 赛道 | 岗位 | 公司 | 薪资原文 | 薪资状态 | 城市 | 复核方式 |
| --- | --- | --- | --- | --- | --- | --- | --- |
${markdownRows(sampleRows, "| 暂无样本 |  |  |  |  |  |  |  |")}

### 公开搜索补充薪资信号

以下为公开可访问搜索结果中的补充信号，用于在 BOSS 登录态样本不足时先建立薪资区间假设。它们不是本地登录态采集样本，后续需要用 BOSS 登录态批量样本校验。

| 平台 | 赛道 | 岗位 | 公司/页面 | 薪资 | 城市 | 要求信号 | 链接 |
| --- | --- | --- | --- | --- | --- | --- | --- |
${markdownRows(externalSalaryRows, "| 暂无 |  |  |  |  |  |  |  |")}

### 薪资初步分层

按赛道看：

| 赛道 | 样本数 | 最低下限 | 平均下限 | 平均上限 | 最高上限 | 典型样本 |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
${markdownRows(salaryBySegmentRows, "| 暂无 | 0 | - | - | - | - | - |")}

按岗位层级看：

| 岗位层级 | 样本数 | 最低下限 | 平均下限 | 平均上限 | 最高上限 | 典型样本 |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
${markdownRows(salaryByRoleRows, "| 暂无 | 0 | - | - | - | - | - |")}

初步薪资判断：

1. 泛 AI/AI 工具销售多落在 8-15K。
2. AI软件/大模型产品销售常见在 20-40K。
3. 大客户/行业销售经理常见在 30-60K。
4. 云和大模型平台高阶客户经理可见 35-65K·16薪。
5. AI出海/智能硬件负责人可见 40-70K·13薪。

需要注意：以上薪资分层来自公开搜索补充样本和少量 BOSS 登录态样本，是“采样假设”，不是最终大样本统计。后续每个核心赛道补足 10 到 12 条岗位后，才能做更稳定的薪资中位数和高薪门槛判断。

### BOSS公开公司/岗位在招信号

这些信号用于确认重点公司是否值得进入下一轮登录态采集，不作为最终薪资统计样本。

| 公司 | 赛道 | 信号类型 | 岗位信号 | 薪资信号 | 公开信号 | 链接 |
| --- | --- | --- | --- | --- | --- | --- |
${markdownRows(publicCompanyRows, "| 暂无 |  |  |  |  |  |  |")}

## 七、当前能力要求信号

### 登录态 BOSS 样本能力信号

| 排名 | 能力要求 | BOSS样本出现次数 | 典型岗位 |
| ---: | --- | ---: | --- |
${markdownRows(capabilities.map((item, index) => `| ${index + 1} | ${item.key} | ${item.count} | ${item.examples.join("；")} |`), "| - | 暂无 | 0 | - |")}

### 公开补充信号能力矩阵

这部分来自公开搜索薪资信号和公开公司/岗位在招信号，用于在 BOSS 登录态大样本不足时先判断能力趋势。

| 排名 | 能力要求 | 补充信号出现次数 | 典型岗位/公司 |
| ---: | --- | ---: | --- |
${markdownRows(publicCapabilityRows, "| - | 暂无 | 0 | - |")}

### 能力要求初步判断

1. AI/大模型产品理解已经不是加分项，而是进入 AI 销售/售前岗位的基础语言。
2. 大客户/KA 与行业客户开发是高薪段岗位的核心关键词，尤其在云、大模型平台、工业AI和企业协同方向。
3. SaaS/企业服务销售经验对 AI 软件落地公司更有迁移价值。
4. 解决方案、售前、POC、API/私有化部署能力会把岗位从普通销售推向更高客单价和更高薪资段。
5. 渠道/生态/海外增长在大模型应用、智能硬件、AI出海方向更容易对应管理岗或负责人岗。
6. 硬件、智算、半导体和具身智能方向会更强调软硬件结合、行业客户、生态伙伴和解决方案销售，不宜用纯 SaaS 销售模型套用。

### 岗位分层画像

| 岗位层级 | 代表公司/赛道 | 薪资假设 | 必备能力 | 简历证据 |
| --- | --- | --- | --- | --- |
${markdownRows(roleProfileMdRows, "| 暂无 |  |  |  |  |")}

## 八、岗位类型判断

1. 基座大模型/AI软件落地公司：更可能要求懂大模型产品、企业场景、生态合作和行业客户开拓。
2. 云计算/大模型平台：更偏政企、金融、制造、教育等行业大客户销售，售前和解决方案协同要求更高。
3. 智能客服/营销/销售AI：销售岗位密度通常更高，更接近 SaaS/企业服务销售逻辑。
4. 工业AI/智能制造：更看重制造业场景、项目型销售、方案表达和交付协同。
5. 芯片/半导体/AI服务器/智算：更偏硬件、政企、大客户、渠道和生态销售，销售周期更长，专业门槛更高。
6. AI安全/私有化/信创：更偏政企行业销售、招投标、合规、安全和私有化交付。

## 九、整晚采集执行建议

当前不建议直接跑整晚自动采集。先按“人工优先、自动兜底”的方式推进：

1. 手动打开 BOSS，按上面的分赛道采样矩阵逐个公司/岗位搜索。
2. 复制岗位卡片或岗位详情，导入到本项目：

\`\`\`bash
npm run import:manual -- --source BOSS直聘 --query "智谱AI AI销售" --company 智谱AI --role AI销售 --city 广州
npm run salary:signals
npm run matrix:roles
npm run compensation:analysis
npm run capability:matrix
npm run company:map
npm run company:profile
npm run company:type
npm run company:playbook
npm run company:top10
npm run decision:overview
npm run hardware:market
npm run brief:market
npm run report:delivery
npm run matrix:cross
npm run sampling:companies
npm run sampling:quality
npm run gate:conclusion
npm run audit:evidence
npm run summary:jobs
npm run report:full
\`\`\`

也可以先生成人工采样作业包，按优先级逐条执行：

\`\`\`bash
npm run sampling:manual -- --city 广州
npm run sampling:next -- --city 广州 --limit 30
npm run sampling:workbench
npm run sampling:batches
npm run sampling:top10-batches
npm run sampling:batch-status
npm run sampling:first-execution
npm run sampling:inbox-status
npm run sampling:companies
npm run sampling:quality
npm run sampling:status
npm run sampling:gap
\`\`\`

作业包路径：

\`\`\`text
${manualSamplingPackPath}
${manualSamplingWorkbenchPath}
${manualSamplingBatchPath}
${top10SamplingBatchPath}
${manualSamplingBatchStatusPath}
${firstManualSamplingInboxQualityPath}
${nextSamplingQueuePath}
${bossSampleGapPath}
${conclusionUpgradeConsolePath}
${conclusionUpgradeConsoleCsvPath}
${marketEvidenceAuditPath}
${marketEvidenceAuditCsvPath}
${samplingStatusPath}
${salaryCapabilityBoardPath}
${roleSalaryMatrixPath}
${compensationGateAnalysisPath}
${decisionOverviewPath}
${segmentOpportunityMatrixPath}
${hardwareSpecialReportPath}
${hardwarePriorityQueuePath}
${publicRecruitmentEvidencePath}
${marketDecisionHandbookPath}
${marketPanoramaBriefPath}
${marketDeliveryBriefPath}
${roleCompanyCrossMatrixPath}
${onepageDecisionPath}
${goalCompletionAuditPath}
${industryLandscapeCompanyPath}
${industryLandscapeCompanyCsvPath}
${industryLandscapeSegmentCsvPath}
${segmentTopCompanyEvidencePath}
${segmentTopCompanyEvidenceCsvPath}
${top10SamplingBatchPath}
${top10SamplingBatchCsvPath}
${capabilityRequirementMatrixPath}
${companyOpportunityMapPath}
${companySegmentProfilePath}
${companyTypeMatrixPath}
${targetCompanyPlaybookPath}
${marketConclusionGatePath}
${resumeGapPath}
${resumeEvidenceMatrixPath}
\`\`\`

确认 BOSS 验证已手动完成，并且页面稳定后，才执行极低频自动采集：

\`\`\`bash
${safeOvernightCommand}
npm run summary:jobs
npm run report:full
\`\`\`

如果验证再次触发，脚本会自动停止，并把断点写入：

\`\`\`text
01_行情收集/data/processed/overnight_research_*.json
\`\`\`

续跑时使用运行记录里的批次序号，设置 \`--start-offset\` 跳过已完成批次，并保留 \`--resume-after-risk\`。

## 十、当前结论边界

当前文件已经完成“全行业研究框架”“公司池”“BOSS采集管道”“公开薪资/能力补充信号”“BOSS历史缓存候选线索库”“硬件/算力/半导体专项框架”“资料集证据审计”“目标完成度审计”和“结论权限门禁”。但 BOSS干净样本只有 ${jobs.length} 条，历史缓存候选 ${bossLocalCacheEvidenceRows.length} 条仍需人工复核，硬件专项的 BOSS干净样本仍不足，不能把它当作最终大样本市场结论。具体哪些证据支撑哪些赛道，以 ${marketEvidenceAuditPath} 为准；具体哪些目标已完成、哪些仍缺证据，以 ${goalCompletionAuditPath} 为准；具体哪些结论能写、哪些只能写公开信号假设，以 ${marketConclusionGatePath} 为准。要达到“大而全”的要求，至少需要完成 60 到 120 个搜索批次，并积累 80 到 200 条高相关岗位样本。自动访问恢复前，最稳妥的推进方式是人工复制导入，每个核心赛道先补足 10 到 12 条高相关岗位。
`;

writeFileSync(reportPath, report);
const roleProfileReport = `# AI全行业销售岗位分层画像

更新时间：${now}

## 一、本质判断

这份画像不是只服务“找销售岗”，而是把 AI 全行业商业化岗位拆成可以匹配简历和采样验证的岗位层级。

当前结论来自三类证据：本地 BOSS 登录态样本 ${jobs.length} 条、公开薪资补充信号 ${externalSalarySignals.length} 条、公开趋势校验来源 ${publicMarketSources.length} 条。由于 BOSS 样本仍不足，以下是岗位画像假设，需要通过后续每赛道 10 到 12 条 BOSS 样本校验。

## 二、岗位分层画像

| 岗位层级 | 代表公司/赛道 | 薪资假设 | 必备能力 | 简历证据 |
| --- | --- | --- | --- | --- |
${markdownRows(roleProfileMdRows, "| 暂无 |  |  |  |  |")}

## 三、赛道优先级与销售打法

| 优先级 | 赛道 | 薪资假设 | 核心岗位 | 核心能力 | 下一步采样动作 |
| --- | --- | --- | --- | --- | --- |
${markdownRows(segmentPlaybookMdRows, "| 暂无 |  |  |  |  |  |")}

## 四、简历匹配策略

1. 如果主投 AI 软件/大模型销售，简历首页要先证明“AI产品理解 + ToB商业化 + 客户场景价值表达”。
2. 如果主投云和大模型平台客户经理，要把行业客户、项目金额、决策链推进和售前协同写清楚。
3. 如果主投硬件/智算/半导体销售，要弱化泛 SaaS 话术，强化政企/云/IDC/服务器生态、渠道和长周期项目经验。
4. 如果主投售前/解决方案，要准备可展示的需求调研、方案设计、Demo/POC、投标述标和交付协同证据。
5. 如果主投销售管理，要补团队规模、目标拆解、达成率、关键客户攻坚和销售机制建设。

## 五、下一步采样标准

每个 P0 赛道先补足 10 到 12 条 BOSS 岗位样本，再判断薪资中位数和高薪门槛。采样时必须记录公司、赛道、岗位层级、薪资、城市、职责、要求、是否管理岗、是否售前/解决方案、客户类型。
`;
writeFileSync(roleProfilePath, roleProfileReport);
console.log(`已更新：${reportPath}`);
console.log(`已更新：${roleProfilePath}`);
