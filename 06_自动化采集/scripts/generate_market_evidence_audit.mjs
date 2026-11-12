#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const companyDatasetPath = join(projectRoot, "00_行业资料集/AI产业链公司资料集.csv");
const publicMarketSourcesPath = join(projectRoot, "06_自动化采集/config/public_market_sources.csv");
const externalSalarySignalsPath = join(projectRoot, "06_自动化采集/config/external_salary_signals.csv");
const jobsPath = join(projectRoot, "01_行情收集/data/jobs.jsonl");
const sampleQualityPath = join(projectRoot, "01_行情收集/BOSS样本质量验收报告.csv");
const readableSalaryPath = join(projectRoot, "01_行情收集/BOSS可读薪资样本.csv");
const sampleGapPath = join(projectRoot, "01_行情收集/BOSS全行业样本缺口路线图.csv");
const companySamplingPath = join(projectRoot, "01_行情收集/BOSS目标公司采样缺口看板.csv");
const conclusionGatePath = join(projectRoot, "01_行情收集/AI销售市场结论权限总控.csv");

const outputCsvPath = join(projectRoot, "01_行情收集/AI市场资料集证据审计.csv");
const outputMdPath = join(projectRoot, "01_行情收集/AI市场资料集证据审计.md");

const supportFiles = [
  "AI产业链公司资料集",
  "公开趋势校验来源",
  "公开招聘薪资信号",
  "BOSS样本质量验收报告",
  "BOSS全行业样本缺口路线图",
  "BOSS目标公司采样缺口看板",
  "AI销售市场结论权限总控"
].join("；");

const segmentAliasSeed = {
  "基座大模型/Agent平台": [
    "基座大模型",
    "大模型",
    "Agent",
    "智能体",
    "AI软件",
    "AI产品",
    "人工智能软件",
    "月之暗面",
    "智谱",
    "MiniMax",
    "DeepSeek",
    "商汤",
    "阶跃星辰"
  ],
  "云计算/大模型平台": [
    "云计算",
    "MaaS",
    "智能云",
    "云服务",
    "公共云",
    "阿里云",
    "百度智能云",
    "火山引擎",
    "腾讯云",
    "华为云",
    "科大讯飞",
    "文心千帆"
  ],
  "智能客服/营销/销售AI": [
    "智能客服",
    "营销",
    "销售AI",
    "GEO",
    "数字人",
    "SaaS",
    "客服",
    "CRM",
    "容联云",
    "Udesk",
    "智齿",
    "百应",
    "网易七鱼"
  ],
  "AI芯片/GPU/加速卡": [
    "AI芯片",
    "GPU",
    "加速卡",
    "半导体",
    "电子半导体",
    "DCU",
    "昇腾",
    "寒武纪",
    "海光",
    "摩尔线程",
    "壁仞",
    "燧原",
    "沐曦"
  ],
  "AI服务器/智算基础设施": [
    "AI服务器",
    "服务器",
    "智算基础设施",
    "液冷",
    "浪潮",
    "新华三",
    "联想",
    "中科曙光",
    "超聚变",
    "华鲲振宇"
  ],
  "智算中心/数据中心服务": [
    "智算中心",
    "数据中心",
    "IDC",
    "算力租赁",
    "算力服务",
    "万国数据",
    "世纪互联",
    "润泽",
    "奥飞",
    "光环新网"
  ],
  "工业AI/智能制造": [
    "工业AI",
    "智能制造",
    "工业互联网",
    "制造",
    "制造业",
    "工业视觉",
    "AI质检",
    "工业大模型",
    "格创东智",
    "创新奇智",
    "树根互联",
    "卡奥斯",
    "黑湖"
  ],
  "AI Agent/RPA/流程自动化": [
    "RPA",
    "流程自动化",
    "流程挖掘",
    "自动化",
    "低代码",
    "来也",
    "影刀",
    "弘玑",
    "实在智能",
    "达观"
  ],
  "数据/MLOps/AI基础软件": [
    "MLOps",
    "数据平台",
    "向量数据库",
    "数据",
    "AI基础软件",
    "RAG",
    "第四范式",
    "星环",
    "Zilliz",
    "神策",
    "明略",
    "袋鼠云"
  ],
  "智能汽车/机器人/具身智能": [
    "智能汽车",
    "机器人",
    "具身智能",
    "智能硬件",
    "车企",
    "激光雷达",
    "地平线",
    "速腾聚创",
    "禾赛",
    "优必选",
    "宇树",
    "文远知行"
  ],
  "AI安全/私有化/信创": [
    "AI安全",
    "私有化",
    "信创",
    "安全",
    "政企",
    "合规",
    "奇安信",
    "深信服",
    "安恒",
    "360数字安全",
    "绿盟",
    "天融信"
  ],
  "AI视觉/安防/质检": [
    "AI视觉",
    "视觉",
    "安防",
    "质检",
    "机器视觉",
    "海康",
    "大华",
    "旷视",
    "云从",
    "凌云光"
  ]
};

const genericAliasTerms = new Set([
  "AI",
  "云",
  "数据",
  "安全",
  "政企",
  "合规",
  "客户",
  "行业",
  "销售",
  "渠道",
  "大客户",
  "售前",
  "解决方案",
  "企业服务",
  "公司"
]);

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

function readJobs(filePath) {
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

function uniq(items) {
  return [...new Set(items.filter(Boolean).map((item) => String(item).trim()).filter(Boolean))];
}

function splitTerms(value) {
  return String(value || "")
    .split(/[;；、/]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function textOf(row, keys = Object.keys(row || {})) {
  return keys.map((key) => row?.[key]).filter(Boolean).join(" ");
}

function includesAny(text, terms) {
  const lower = String(text || "").toLowerCase();
  return terms.some((term) => lower.includes(String(term).toLowerCase()));
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

function priorityRank(value) {
  if (/P0/.test(value || "")) return 3;
  if (/P1/.test(value || "")) return 2;
  if (/P2/.test(value || "")) return 1;
  return 0;
}

function maxPriority(rows) {
  const sorted = rows
    .map((row) => row.priority)
    .filter(Boolean)
    .sort((a, b) => priorityRank(b) - priorityRank(a));
  return sorted[0] || "";
}

function buildSegmentAliases(companyRows) {
  const map = new Map();
  for (const row of companyRows) {
    if (!row.segment) continue;
    const existing = map.get(row.segment) || [];
    map.set(row.segment, [
      ...existing,
      row.segment,
      row.route,
      row.company,
      row.companyType,
      ...splitTerms(row.keywords),
      ...(segmentAliasSeed[row.segment] || [])
    ]);
  }
  return new Map([...map.entries()].map(([segment, terms]) => {
    const filtered = uniq(terms).filter((term) => {
      const value = String(term).trim();
      return value.length >= 2 && !genericAliasTerms.has(value);
    });
    return [segment, filtered];
  }));
}

function bestSegmentForText(text, aliasMap) {
  let best = null;
  for (const [segment, terms] of aliasMap.entries()) {
    const score = terms.reduce((sum, term) => {
      if (!term || String(term).length < 2) return sum;
      return sum + (String(text).toLowerCase().includes(String(term).toLowerCase()) ? 1 : 0);
    }, 0);
    if (score > 0 && (!best || score > best.score)) best = { segment, score };
  }
  return best?.segment || "";
}

function matchedRowsForSegment(rows, segment, aliasMap, fields) {
  const aliases = aliasMap.get(segment) || [segment];
  return rows.filter((row) => {
    if (row.segment === segment) return true;
    return includesAny(textOf(row, fields), aliases);
  });
}

function bossSegmentForJob(job, companyRows, aliasMap) {
  const company = job.companyFilter || job.company || "";
  const exact = companyRows.find((row) => row.company === company);
  if (exact) return exact.segment;
  const partial = companyRows.find((row) => company && (company.includes(row.company) || row.company.includes(company)));
  if (partial) return partial.segment;
  return bestSegmentForText(textOf(job), aliasMap);
}

function gradeFor(row) {
  if (row.bossCleanSamples >= 12 && row.readableSalarySamples >= 5 && row.detailSamples >= 5 && row.publicTrendSources >= 2) {
    return "A：BOSS阶段样本可支撑赛道小结";
  }
  if (row.bossCleanSamples >= 4 && row.publicTrendSources >= 1 && row.publicSalarySignals >= 2) {
    return "B：可写BOSS方向性观察";
  }
  if (row.companyCount >= 6 && row.publicTrendSources + row.publicSalarySignals >= 2) {
    return "C：公司池和公开信号已成型，BOSS待验证";
  }
  if (row.companyCount > 0) return "D：只有公司池，必须补公开和BOSS证据";
  return "E：资料集不足";
}

function permissionRank(permission) {
  if (/可写BOSS大样本/.test(permission)) return 5;
  if (/可写BOSS薪资|可写BOSS岗位定位|可写BOSS能力/.test(permission)) return 4;
  if (/可写BOSS方向/.test(permission)) return 3;
  if (/可写公司池|可写能力趋势/.test(permission)) return 2;
  if (/只能写/.test(permission)) return 1;
  return 0;
}

function conclusionBoundary(permissions) {
  if (!permissions.length) return "未建立结论门禁";
  const sorted = permissions.slice().sort((a, b) => permissionRank(b.conclusionPermission) - permissionRank(a.conclusionPermission));
  const best = sorted[0]?.conclusionPermission || "";
  const hasBlocked = permissions.some((row) => /不能写|只能写/.test(row.conclusionPermission || ""));
  if (/可写BOSS大样本/.test(best) && !hasBlocked) return "可写BOSS大样本结论";
  if (/可写BOSS/.test(best)) return "只能写BOSS阶段性/方向性观察";
  if (/可写公司池/.test(best)) return "可写公司池和补样计划";
  if (/可写能力趋势|只能写/.test(best)) return "只能写公开信号或能力趋势假设";
  return "不能写市场结论";
}

function allowedWording(boundary, segment) {
  if (boundary === "可写BOSS大样本结论") return `${segment}可描述BOSS样本中的主要分布，但仍要标注采样范围。`;
  if (boundary === "只能写BOSS阶段性/方向性观察") return `${segment}可以写“现有BOSS样本显示的方向性信号”，不能外推到全市场。`;
  if (boundary === "可写公司池和补样计划") return `${segment}可以写头部公司池、岗位词和下一步补样计划。`;
  if (boundary === "只能写公开信号或能力趋势假设") return `${segment}只能写公开资料/薪资信号形成的假设，等待BOSS样本校验。`;
  return `${segment}当前只写缺口和补证动作。`;
}

function forbiddenWording(boundary) {
  if (boundary === "可写BOSS大样本结论") return "不要写成覆盖所有城市、所有公司和所有岗位。";
  if (boundary.includes("BOSS阶段性")) return "不要写“市场普遍”“头部公司都在招”“薪资中位数”。";
  if (boundary.includes("公司池")) return "不要声称这些公司已在BOSS验证招聘或薪资已被确认。";
  if (boundary.includes("公开信号")) return "不要写“BOSS数据显示”或“BOSS样本证明”。";
  return "不要写任何市场结论。";
}

function publicSalaryMax(rows) {
  const highs = rows
    .map((row) => {
      const match = String(row.salary || "").replace(/k/g, "K").match(/[-~－—]\s*(\d+(?:\.\d+)?)\s*K/i);
      return match ? Number.parseFloat(match[1]) : 0;
    })
    .filter((value) => value > 0);
  return highs.length ? `${Math.max(...highs)}K` : "";
}

function mdRows(rows, fallback) {
  return rows.length ? rows.join("\n") : fallback;
}

const companyRows = readCsv(companyDatasetPath);
const publicSourceRows = readCsv(publicMarketSourcesPath);
const externalSalaryRows = readCsv(externalSalarySignalsPath);
const bossQualityRows = readCsv(sampleQualityPath);
const readableSalaryRows = readCsv(readableSalaryPath);
const sampleGapRows = readCsv(sampleGapPath);
const companySamplingRows = readCsv(companySamplingPath);
const conclusionGateRows = readCsv(conclusionGatePath);
function isBossJob(job) {
  return !job.source || job.source === "BOSS直聘";
}

const allJobs = readJobs(jobsPath);
const jobs = allJobs.filter(isBossJob);
const aliasMap = buildSegmentAliases(companyRows);

const segments = uniq(companyRows.map((row) => row.segment));
const segmentRows = segments.map((segment) => {
  const companies = companyRows.filter((row) => row.segment === segment);
  const sampleGap = sampleGapRows.find((row) => row.segment === segment) || {};
  const companySampling = companySamplingRows.filter((row) => row.segment === segment);
  const publicSources = matchedRowsForSegment(publicSourceRows, segment, aliasMap, ["source", "topic", "key_signal", "sales_implication"]);
  const salarySignals = matchedRowsForSegment(externalSalaryRows, segment, aliasMap, ["role", "company_or_page", "segment", "requirement_signal"]);
  const qualityRows = bossQualityRows.filter((row) => row.segment === segment);
  const fallbackBossJobs = jobs.filter((job) => bossSegmentForJob(job, companyRows, aliasMap) === segment);
  const cleanQualityRows = qualityRows.filter((row) => row.roleRelevant === "true" && row.aiRelevant === "true" && /^A|^B/.test(row.qualityGrade || ""));
  const bossCleanSamples = cleanQualityRows.length || numberOf(sampleGap.importedJobs) || fallbackBossJobs.length;
  const readableSalarySamples = qualityRows.filter((row) => boolOf(row.salaryReadable)).length
    || readableSalaryRows.filter((row) => row.segment === segment).length;
  const detailSamples = qualityRows.filter((row) => numberOf(row.detailTextLength) >= 300).length
    || fallbackBossJobs.filter((job) => String(job.detailText || "").length >= 300).length;
  const gateRows = conclusionGateRows.filter((row) => row.segment === segment);
  const boundary = conclusionBoundary(gateRows);
  const row = {
    scope: "赛道",
    route: companies[0]?.route || sampleGap.route || "",
    segment,
    priority: maxPriority(companies) || sampleGap.priority || "",
    companyCount: companies.length,
    p0CompanyCount: companies.filter((item) => /P0/.test(item.priority || "")).length,
    topCompanies: companies
      .slice()
      .sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority))
      .slice(0, 8)
      .map((item) => item.company)
      .join("、"),
    publicTrendSources: publicSources.length,
    publicSourceExamples: publicSources.slice(0, 3).map((item) => `${item.source}:${item.topic}`).join("；"),
    publicSalarySignals: salarySignals.length,
    publicSalaryMaxK: publicSalaryMax(salarySignals) || sampleGap.publicSalaryMaxK || "",
    bossCleanSamples,
    readableSalarySamples,
    detailSamples,
    targetSamples: numberOf(sampleGap.targetSamples),
    sampleGap: numberOf(sampleGap.sampleGap),
    companyGap: companySampling.reduce((sum, item) => sum + numberOf(item.sampleGap), 0),
    evidenceGrade: "",
    conclusionBoundary: boundary,
    allowedWording: allowedWording(boundary, segment),
    forbiddenWording: forbiddenWording(boundary),
    nextEvidenceAction: sampleGap.nextTaskList || sampleGap.nextImportCommand || sampleGap.nextAction || companies[0]?.nextAction || "",
    nextCompany: sampleGap.nextCompany || "",
    nextRole: sampleGap.nextRole || "",
    nextSearchUrl: sampleGap.nextSearchUrl || "",
    supportFiles
  };
  row.evidenceGrade = gradeFor(row);
  return row;
}).sort((a, b) => {
  const priorityDiff = priorityRank(b.priority) - priorityRank(a.priority);
  if (priorityDiff) return priorityDiff;
  return b.sampleGap - a.sampleGap || b.companyGap - a.companyGap || a.segment.localeCompare(b.segment, "zh-Hans-CN");
});

const totalCompanyCount = segmentRows.reduce((sum, row) => sum + row.companyCount, 0);
const totalBossCleanSamples = segmentRows.reduce((sum, row) => sum + row.bossCleanSamples, 0);
const totalReadableSalarySamples = segmentRows.reduce((sum, row) => sum + row.readableSalarySamples, 0);
const totalDetailSamples = segmentRows.reduce((sum, row) => sum + row.detailSamples, 0);
const totalTargetSamples = segmentRows.reduce((sum, row) => sum + row.targetSamples, 0);
const totalSampleGap = segmentRows.reduce((sum, row) => sum + row.sampleGap, 0);
const totalCompanyGap = segmentRows.reduce((sum, row) => sum + row.companyGap, 0);
const segmentsWithBoss = segmentRows.filter((row) => row.bossCleanSamples > 0).length;
const segmentsWithPublicTrend = segmentRows.filter((row) => row.publicTrendSources > 0).length;
const segmentsWithPublicSalary = segmentRows.filter((row) => row.publicSalarySignals > 0).length;

const globalRow = {
  scope: "全局",
  route: "全行业",
  segment: "AI销售全行业",
  priority: "P0-P2",
  companyCount: totalCompanyCount,
  p0CompanyCount: segmentRows.reduce((sum, row) => sum + row.p0CompanyCount, 0),
  topCompanies: segmentRows.slice(0, 6).map((row) => row.topCompanies.split("、")[0]).filter(Boolean).join("、"),
  publicTrendSources: publicSourceRows.length,
  publicSourceExamples: publicSourceRows.slice(0, 4).map((item) => `${item.source}:${item.topic}`).join("；"),
  publicSalarySignals: externalSalaryRows.length,
  publicSalaryMaxK: publicSalaryMax(externalSalaryRows),
  bossCleanSamples: totalBossCleanSamples,
  readableSalarySamples: totalReadableSalarySamples,
  detailSamples: totalDetailSamples,
  targetSamples: totalTargetSamples,
  sampleGap: totalSampleGap,
  companyGap: totalCompanyGap,
  evidenceGrade: totalBossCleanSamples >= 80 ? "A：可进入全行业BOSS样本结论" : "C：资料集已成型但BOSS大样本不足",
  conclusionBoundary: totalBossCleanSamples >= 80 ? "可写BOSS大样本结论" : "不能写BOSS全行业大样本结论",
  allowedWording: totalBossCleanSamples >= 80 ? "可描述本轮BOSS样本分布。" : "只能写公司池、公开信号、少量BOSS样本方向和补样缺口。",
  forbiddenWording: "不要把少量BOSS样本写成全行业统计结论。",
  nextEvidenceAction: "优先补P0赛道和点名公司的岗位详情、可读薪资、经验学历、职责要求。",
  nextCompany: segmentRows.find((row) => row.nextCompany)?.nextCompany || "",
  nextRole: segmentRows.find((row) => row.nextRole)?.nextRole || "",
  nextSearchUrl: segmentRows.find((row) => row.nextSearchUrl)?.nextSearchUrl || "",
  supportFiles
};

const outputRows = [globalRow, ...segmentRows];
const headers = [
  "scope",
  "route",
  "segment",
  "priority",
  "companyCount",
  "p0CompanyCount",
  "topCompanies",
  "publicTrendSources",
  "publicSourceExamples",
  "publicSalarySignals",
  "publicSalaryMaxK",
  "bossCleanSamples",
  "readableSalarySamples",
  "detailSamples",
  "targetSamples",
  "sampleGap",
  "companyGap",
  "evidenceGrade",
  "conclusionBoundary",
  "allowedWording",
  "forbiddenWording",
  "nextEvidenceAction",
  "nextCompany",
  "nextRole",
  "nextSearchUrl",
  "supportFiles"
];

const evidenceRows = segmentRows.map((row) => {
  return `| ${row.priority} | ${row.route} | ${row.segment} | ${row.companyCount} | ${row.publicTrendSources} | ${row.publicSalarySignals} | ${row.bossCleanSamples}/${row.targetSamples} | ${row.sampleGap} | ${row.evidenceGrade} | ${row.conclusionBoundary} |`;
});

const nextActionRows = segmentRows
  .filter((row) => row.sampleGap > 0 || row.companyGap > 0)
  .slice(0, 12)
  .map((row, index) => {
    return `| ${index + 1} | ${row.priority} | ${row.segment} | ${row.nextCompany || "-"} | ${row.nextRole || "-"} | ${row.sampleGap} | ${row.nextEvidenceAction || "-"} |`;
  });

const boundaryRows = [...new Map(segmentRows.map((row) => [row.conclusionBoundary, 0])).keys()]
  .map((boundary) => {
    const matched = segmentRows.filter((row) => row.conclusionBoundary === boundary);
    return `| ${boundary} | ${matched.length} | ${matched.slice(0, 6).map((row) => row.segment).join("、")} |`;
  });

const md = `# AI市场资料集证据审计

更新时间：${formatDate()}

## 一、本质判断

这份文件不是再多列一批公司，而是给 AI 行业资料集加一层“证据强度审计”：每个赛道到底是由公司池、公开趋势、公开薪资、BOSS岗位样本中的哪一类证据支撑，哪些结论可以写，哪些必须等补样。

当前最大的矛盾是：AI上下游公司池已经覆盖 ${totalCompanyCount} 家公司和 ${segmentRows.length} 个赛道，但 BOSS干净样本只有 ${jobs.length} 条；所以当前不能把公开信号或少量BOSS样本包装成全行业实证结论。

## 二、总控看板

| 指标 | 当前值 |
| --- | ---: |
| 赛道数 | ${segmentRows.length} |
| 公司池公司数 | ${totalCompanyCount} |
| P0公司数 | ${globalRow.p0CompanyCount} |
| 公开趋势来源 | ${publicSourceRows.length} |
| 公开薪资/招聘信号 | ${externalSalaryRows.length} |
| BOSS干净样本 | ${totalBossCleanSamples} |
| BOSS可读薪资样本 | ${totalReadableSalarySamples} |
| BOSS详情文本样本 | ${totalDetailSamples} |
| BOSS目标样本 | ${totalTargetSamples} |
| BOSS样本缺口 | ${totalSampleGap} |
| 公司级样本缺口 | ${totalCompanyGap} |
| 有BOSS样本的赛道 | ${segmentsWithBoss}/${segmentRows.length} |
| 有公开趋势证据的赛道 | ${segmentsWithPublicTrend}/${segmentRows.length} |
| 有公开薪资信号的赛道 | ${segmentsWithPublicSalary}/${segmentRows.length} |

## 三、分赛道证据强度

| 优先级 | 路线 | 赛道 | 公司数 | 公开趋势 | 公开薪资 | BOSS样本 | 样本缺口 | 证据等级 | 结论边界 |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
${mdRows(evidenceRows, "| 暂无 |  |  | 0 | 0 | 0 | 0/0 | 0 |  |  |")}

## 四、结论边界分布

| 结论边界 | 赛道数 | 代表赛道 |
| --- | ---: | --- |
${mdRows(boundaryRows, "| 暂无 | 0 |  |")}

## 五、优先补证动作

这些动作只指向人工低频采样和本地导入，不自动打开、不自动刷新 BOSS。

| 顺序 | 优先级 | 赛道 | 下一家公司 | 下一岗位词 | 样本缺口 | 动作 |
| ---: | --- | --- | --- | --- | ---: | --- |
${mdRows(nextActionRows, "| 1 | 暂无 |  |  |  | 0 |  |")}

## 六、使用规则

1. 先看本文件的证据等级，再看结论权限总控，最后再写市场判断。
2. A/B 等级可以进入阶段性赛道小结；C 等级只能写公司池和公开信号假设；D/E 等级只写缺口和补样动作。
3. 写“BOSS数据显示”之前，必须确认对应赛道有足够 BOSS 样本和结论权限。
4. 写薪资区间之前，必须优先检查可读薪资样本；公开薪资只能叫“公开信号”，不能叫“BOSS统计”。
5. 风控恢复期继续采用人工复制岗位详情导入，不进行自动连续访问。

CSV明细：${outputCsvPath}
`;

mkdirSync(dirname(outputCsvPath), { recursive: true });
writeFileSync(outputCsvPath, `${csv([headers, ...outputRows.map((row) => headers.map((header) => row[header]))])}\n`);
writeFileSync(outputMdPath, md);

console.log(`已更新：${outputMdPath}`);
console.log(`已更新：${outputCsvPath}`);
console.log(`赛道数：${segmentRows.length}`);
console.log(`公司池公司数：${totalCompanyCount}`);
console.log(`BOSS干净样本：${totalBossCleanSamples}`);
console.log(`BOSS样本缺口：${totalSampleGap}`);
