#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const companyPoolPath = join(projectRoot, "06_自动化采集/config/ai_company_segments.csv");
const queryPlanPath = join(projectRoot, "01_行情收集/BOSS全行业AI销售岗位查询计划.csv");
const opportunityMapPath = join(projectRoot, "00_行业资料集/AI产业链头部公司岗位机会地图.csv");
const playbookPath = join(projectRoot, "00_行业资料集/AI目标公司销售岗位打法清单.csv");
const manualBatchPath = join(projectRoot, "01_行情收集/BOSS人工采样批次包.csv");
const batchQualityPath = join(projectRoot, "01_行情收集/BOSS人工采样批次质量门禁.csv");
const companySamplingPath = join(projectRoot, "01_行情收集/BOSS目标公司采样缺口看板.csv");
const bossSignalPath = join(projectRoot, "06_自动化采集/config/boss_public_company_signals.csv");
const externalSalaryPath = join(projectRoot, "06_自动化采集/config/external_salary_signals.csv");
const qualityPath = join(projectRoot, "01_行情收集/BOSS样本质量验收报告.csv");
const jobsPath = join(projectRoot, "01_行情收集/data/jobs.jsonl");
const deliveryMdPath = join(projectRoot, "01_行情收集/AI销售岗位市场调研交付版.md");
const fullReportMdPath = join(projectRoot, "01_行情收集/AI全行业销售岗位市场调研.md");
const outputMdPath = join(projectRoot, "01_行情收集/AI重点公司与赛道覆盖审计.md");
const outputCsvPath = join(projectRoot, "01_行情收集/AI重点公司与赛道覆盖审计.csv");
const safeBossHomeUrl = "https://www.zhipin.com/";

const focusCompanies = [
  { company: "智谱AI", group: "AI软件落地/大模型", userNamed: "是", aliases: ["智谱", "智谱华章"] },
  { company: "月之暗面", group: "AI软件落地/大模型", userNamed: "是", aliases: ["Kimi", "Moonshot"] },
  { company: "MiniMax", group: "AI软件落地/大模型", userNamed: "是", aliases: ["稀宇科技"] },
  { company: "商汤科技", group: "AI软件落地/大模型", userNamed: "是", aliases: ["商汤"] },
  { company: "DeepSeek", group: "AI软件落地/大模型", userNamed: "是", aliases: ["深度求索"] },
  { company: "阶跃星辰", group: "AI软件落地/大模型", userNamed: "是", aliases: [] },
  { company: "百川智能", group: "AI软件落地/大模型", userNamed: "是", aliases: [] },
  { company: "零一万物", group: "AI软件落地/大模型", userNamed: "是", aliases: [] },
  { company: "面壁智能", group: "AI软件落地/大模型", userNamed: "否", aliases: [] },
  { company: "昆仑万维", group: "AI软件落地/大模型", userNamed: "否", aliases: [] },
  { company: "第四范式", group: "AI软件落地/企业AI平台", userNamed: "是", aliases: [] },
  { company: "百应科技", group: "AI软件落地/智能客服营销", userNamed: "是", aliases: ["百应"] },
  { company: "阿里云", group: "云/MaaS/大模型平台", userNamed: "是", aliases: [] },
  { company: "百度智能云", group: "云/MaaS/大模型平台", userNamed: "是", aliases: ["百度云"] },
  { company: "腾讯云", group: "云/MaaS/大模型平台", userNamed: "是", aliases: [] },
  { company: "火山引擎", group: "云/MaaS/大模型平台", userNamed: "是", aliases: ["字节火山"] },
  { company: "华为云", group: "云/MaaS/大模型平台", userNamed: "是", aliases: [] },
  { company: "科大讯飞", group: "云/MaaS/大模型平台", userNamed: "是", aliases: ["讯飞"] },
  { company: "寒武纪", group: "硬件/芯片/半导体/算力", userNamed: "是", aliases: [] },
  { company: "海光信息", group: "硬件/芯片/半导体/算力", userNamed: "是", aliases: ["海光"] },
  { company: "华为昇腾", group: "硬件/芯片/半导体/算力", userNamed: "是", aliases: ["昇腾"] },
  { company: "海思", group: "硬件/芯片/半导体/算力", userNamed: "否", aliases: ["华为海思"] },
  { company: "摩尔线程", group: "硬件/芯片/半导体/算力", userNamed: "是", aliases: [] },
  { company: "壁仞科技", group: "硬件/芯片/半导体/算力", userNamed: "是", aliases: ["壁仞"] },
  { company: "燧原科技", group: "硬件/芯片/半导体/算力", userNamed: "是", aliases: ["燧原"] },
  { company: "沐曦集成电路", group: "硬件/芯片/半导体/算力", userNamed: "是", aliases: ["沐曦"] },
  { company: "天数智芯", group: "硬件/芯片/半导体/算力", userNamed: "否", aliases: [] },
  { company: "昆仑芯", group: "硬件/芯片/半导体/算力", userNamed: "否", aliases: [] },
  { company: "平头哥", group: "硬件/芯片/半导体/算力", userNamed: "否", aliases: [] },
  { company: "浪潮信息", group: "硬件/服务器/智算基础设施", userNamed: "是", aliases: ["浪潮"] },
  { company: "新华三", group: "硬件/服务器/智算基础设施", userNamed: "是", aliases: ["H3C"] },
  { company: "联想", group: "硬件/服务器/智算基础设施", userNamed: "否", aliases: ["联想集团"] },
  { company: "宁畅", group: "硬件/服务器/智算基础设施", userNamed: "否", aliases: ["宁畅信息"] },
  { company: "中科曙光", group: "硬件/服务器/智算基础设施", userNamed: "是", aliases: ["曙光"] },
  { company: "超聚变", group: "硬件/服务器/智算基础设施", userNamed: "是", aliases: [] },
  { company: "华鲲振宇", group: "硬件/服务器/智算基础设施", userNamed: "是", aliases: [] },
  { company: "宝德计算", group: "硬件/服务器/智算基础设施", userNamed: "否", aliases: [] },
  { company: "世纪互联", group: "智算中心/数据中心服务", userNamed: "是", aliases: [] },
  { company: "创新奇智", group: "工业AI/智能制造", userNamed: "是", aliases: [] },
  { company: "格创东智", group: "工业AI/智能制造", userNamed: "是", aliases: [] },
  { company: "海康威视", group: "工业AI/视觉/安防", userNamed: "否", aliases: ["海康"] },
  { company: "大华股份", group: "工业AI/视觉/安防", userNamed: "否", aliases: ["大华"] },
  { company: "云从科技", group: "工业AI/视觉/安防", userNamed: "否", aliases: ["云从"] },
  { company: "旷视科技", group: "工业AI/视觉/安防", userNamed: "否", aliases: ["旷视"] },
  { company: "依图科技", group: "工业AI/视觉/安防", userNamed: "否", aliases: ["依图"] },
  { company: "地平线", group: "智能汽车/机器人/具身智能", userNamed: "是", aliases: ["地平线机器人"] },
  { company: "黑芝麻智能", group: "智能汽车/机器人/具身智能", userNamed: "是", aliases: ["黑芝麻"] },
  { company: "优必选", group: "智能汽车/机器人/具身智能", userNamed: "否", aliases: [] },
  { company: "宇树科技", group: "智能汽车/机器人/具身智能", userNamed: "否", aliases: ["宇树"] }
];

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

function readText(filePath) {
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
}

function readJobs() {
  if (!existsSync(jobsPath)) return [];
  return readFileSync(jobsPath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
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

function boolOf(value) {
  return value === true || String(value).toLowerCase() === "true" || String(value) === "是";
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[（）()【】\[\]{}·\s\-_.,，。/\\|]/g, "");
}

function aliasesFor(focus) {
  const aliases = new Set([focus.company, ...(focus.aliases || [])]);
  const company = focus.company;
  if (/智能云$/.test(company)) aliases.add(company.replace(/智能云$/, ""));
  if (/科技$/.test(company)) aliases.add(company.replace(/科技$/, ""));
  if (/信息$/.test(company)) aliases.add(company.replace(/信息$/, ""));
  if (/股份$/.test(company)) aliases.add(company.replace(/股份$/, ""));
  if (company === "智谱AI") aliases.add("智普");
  if (company === "月之暗面") aliases.add("月子暗面");
  if (company === "MiniMax") aliases.add("minimax");
  return [...aliases].filter(Boolean);
}

function rowText(row) {
  return Object.values(row || {}).filter(Boolean).join("\n");
}

function textMatchesCompany(text, focus) {
  const normalizedText = normalize(text);
  return aliasesFor(focus).some((alias) => {
    const needle = normalize(alias);
    return needle.length >= 2 && normalizedText.includes(needle);
  });
}

function rowsForCompany(rows, focus, fields = []) {
  return rows.filter((row) => {
    const text = fields.length ? fields.map((field) => row[field]).join("\n") : rowText(row);
    return textMatchesCompany(text, focus);
  });
}

function findFirstCompanyRow(rows, focus) {
  return rowsForCompany(rows, focus, ["company", "target", "query", "representativeCompanies"])[0] ||
    rowsForCompany(rows, focus)[0] ||
    {};
}

function salaryReadableFromJob(job, qualityById) {
  const row = qualityById.get(job.id) || {};
  if (row.salaryReadable !== undefined) return boolOf(row.salaryReadable);
  const text = [job.salary, job.rawText, job.detailText].filter(Boolean).join("\n");
  if (/薪资范围[:：]?\s*\d+\s*[-~－—到]\s*\d+\s*元\/?月/i.test(text)) return true;
  const hasPrivateFont = /[\uE000-\uF8FF]/.test(String(job.salary || ""));
  return !hasPrivateFont && /\d+(?:\.\d+)?\s*[-~－—到]\s*\d+(?:\.\d+)?\s*K/i.test(String(job.salary || ""));
}

function qualityForJob(job, qualityById) {
  const row = qualityById.get(job.id) || {};
  const qualityScore = numberOf(row.qualityScore);
  const detailTextLength = numberOf(row.detailTextLength) || String(job.detailText || "").length;
  const roleRelevant = row.roleRelevant === undefined ? true : boolOf(row.roleRelevant);
  const aiRelevant = row.aiRelevant === undefined ? true : boolOf(row.aiRelevant);
  return {
    qualityScore,
    detailTextLength,
    roleRelevant,
    aiRelevant,
    usable: qualityScore >= 65 && roleRelevant && aiRelevant,
    readableSalary: salaryReadableFromJob(job, qualityById),
    detailSample: detailTextLength >= 300
  };
}

function searchUrlFor(company, role = "AI销售") {
  const query = encodeURIComponent(`${company} ${role}`);
  return `https://www.zhipin.com/web/geek/jobs?query=${query}&city=101280100`;
}

function shellQuote(value) {
  return `"${String(value || "").replaceAll('"', '\\"')}"`;
}

function importCommand(company, role = "AI销售") {
  return [
    "npm run import:manual --",
    "--source",
    shellQuote("BOSS直聘"),
    "--query",
    shellQuote(`${company} ${role}`),
    "--company",
    shellQuote(company),
    "--role",
    shellQuote(role),
    "--city",
    shellQuote("广州")
  ].join(" ");
}

function pickNextRole(focus, row, batchRows, samplingRow) {
  if (batchRows[0]?.role) return batchRows[0].role;
  if (samplingRow.nextRole) return samplingRow.nextRole;
  const text = `${row.segment || ""}\n${focus.group || ""}`;
  if (/芯片|GPU|半导体|服务器|智算|数据中心/.test(text)) return "大客户销售";
  if (/工业|制造|视觉|安防/.test(text)) return "销售经理";
  if (/云|MaaS|大模型|Agent|软件/.test(text)) return "AI销售";
  return "AI销售";
}

function coverageGate(row) {
  if (row.inCompanyPool !== "是") return "缺公司池";
  if (row.queryPlanCount === 0) return "缺BOSS查询入口";
  if (row.inOpportunityMap !== "是" && row.inPlaybook !== "是") return "缺机会地图/打法清单";
  if (row.manualBatchCount === 0 && row.bossImportedCount > 0) return "已有旧样本/缺当前人工批次";
  if (row.manualBatchCount === 0) return "缺人工批次";
  if (row.bossImportedCount === 0) return "待人工导入BOSS样本";
  if (row.bossUsableCount === 0) return "有样本但质量不足";
  if (row.readableSalaryCount === 0) return "缺可读薪资";
  if (row.detailSampleCount === 0) return "缺岗位详情";
  return "阶段可用/仍需扩样";
}

function nextAction(row) {
  if (row.coverageGate === "缺公司池") return `先把 ${row.company} 补进 ai_company_segments.csv，并分配赛道、层级、关键词和销售适配`;
  if (row.coverageGate === "缺BOSS查询入口") return `为 ${row.company} 增加 BOSS 查询计划入口`;
  if (row.coverageGate === "缺机会地图/打法清单") return `为 ${row.company} 补公司类型、销售打法、买方画像和岗位词`;
  if (row.coverageGate === "已有旧样本/缺当前人工批次") return `保留 ${row.company} 旧样本作方向参考，并把 ${row.company}/${row.nextRole} 纳入当前人工批次补齐元数据`;
  if (row.coverageGate === "缺人工批次") return `把 ${row.company}/${row.nextRole} 加入下一轮人工批次`;
  if (row.coverageGate === "待人工导入BOSS样本") return `手动打开 ${row.company}/${row.nextRole}，导入 2-3 条销售/售前/销售管理岗位`;
  if (row.coverageGate === "有样本但质量不足") return `继续导入 ${row.company} 的高相关岗位详情，确保职责、要求、客户类型完整`;
  if (row.coverageGate === "缺可读薪资") return `优先复制 ${row.company} 带可读薪资的岗位详情或卡片`;
  if (row.coverageGate === "缺岗位详情") return `优先复制 ${row.company} 岗位详情页正文，补职责和能力要求`;
  return `保持 ${row.company} 观察，继续扩到 3 条以上可用样本`;
}

function mdRows(rows, fallback) {
  return rows.length ? rows.join("\n") : fallback;
}

const companyPoolRows = readCsv(companyPoolPath);
const queryRows = readCsv(queryPlanPath);
const opportunityRows = readCsv(opportunityMapPath);
const playbookRows = readCsv(playbookPath);
const batchRows = readCsv(manualBatchPath);
const batchQualityRows = readCsv(batchQualityPath);
const companySamplingRows = readCsv(companySamplingPath);
const bossSignalRows = readCsv(bossSignalPath);
const salarySignalRows = readCsv(externalSalaryPath);
const qualityRows = readCsv(qualityPath);
const jobs = readJobs();
const deliveryText = readText(deliveryMdPath);
const fullReportText = readText(fullReportMdPath);
const qualityById = new Map(qualityRows.map((row) => [row.id, row]));

const companyRows = focusCompanies.map((focus) => {
  const poolRow = findFirstCompanyRow(companyPoolRows, focus);
  const queryMatches = rowsForCompany(queryRows, focus, ["target", "query"]);
  const opportunityMatches = rowsForCompany(opportunityRows, focus, ["company"]);
  const playbookMatches = rowsForCompany(playbookRows, focus, ["company"]);
  const batchMatches = rowsForCompany(batchRows, focus, ["company"]);
  const batchQualityMatches = rowsForCompany(batchQualityRows.filter((row) => row.level === "入口"), focus, ["company"]);
  const samplingRow = findFirstCompanyRow(companySamplingRows, focus);
  const bossSignalMatches = rowsForCompany(bossSignalRows, focus, ["company", "public_signal", "role_signal"]);
  const salarySignalMatches = rowsForCompany(salarySignalRows, focus, ["company_or_page", "role", "requirement_signal", "segment"]);
  const jobMatches = jobs.filter((job) => job.source === "BOSS直聘" && textMatchesCompany(rowText(job), focus));
  const jobQuality = jobMatches.map((job) => qualityForJob(job, qualityById));
  const firstEvidenceRow = poolRow.company ? poolRow : opportunityMatches[0] || playbookMatches[0] || queryMatches[0] || {};
  const route = samplingRow.route || playbookMatches[0]?.route || opportunityMatches[0]?.route || (/芯片|硬件|半导体|服务器|智算/.test(focus.group) ? "硬件/算力/半导体路线" : "AI软件落地路线");
  const nextRole = pickNextRole(focus, firstEvidenceRow, batchMatches, samplingRow);
  const manualUrl = batchMatches[0]?.manualUrl || samplingRow.searchUrl || queryMatches[0]?.url || searchUrlFor(focus.company, nextRole);
  const row = {
    focusGroup: focus.group,
    userNamed: focus.userNamed,
    route,
    segment: firstEvidenceRow.segment || samplingRow.segment || bossSignalMatches[0]?.segment || "",
    layer: firstEvidenceRow.layer || "",
    company: focus.company,
    aliases: aliasesFor(focus).filter((item) => item !== focus.company).join(";"),
    inCompanyPool: poolRow.company ? "是" : "否",
    queryPlanCount: queryMatches.length,
    inOpportunityMap: opportunityMatches.length ? "是" : "否",
    inPlaybook: playbookMatches.length ? "是" : "否",
    manualBatchCount: batchMatches.length,
    manualBatchIds: unique(batchMatches.map((item) => item.batchId)).join(";"),
    batchQualityGates: unique(batchQualityMatches.map((item) => item.gate)).join(";"),
    publicBossSignalCount: bossSignalMatches.length,
    publicBossSignals: unique(bossSignalMatches.map((item) => [item.role_signal, item.salary_signal].filter(Boolean).join("/"))).join(";"),
    externalSalarySignalCount: salarySignalMatches.length,
    externalSalaryBands: unique(salarySignalMatches.map((item) => item.salary)).join(";"),
    bossImportedCount: jobMatches.length,
    bossUsableCount: jobQuality.filter((item) => item.usable).length,
    readableSalaryCount: jobQuality.filter((item) => item.readableSalary).length,
    detailSampleCount: jobQuality.filter((item) => item.detailSample).length,
    companySampleGap: samplingRow.sampleGap || "",
    companyCoverageStatus: samplingRow.coverageStatus || "",
    mentionedInDelivery: textMatchesCompany(deliveryText, focus) ? "是" : "否",
    mentionedInFullReport: textMatchesCompany(fullReportText, focus) ? "是" : "否",
    nextRole,
    safeBossHomeUrl,
    searchKeyword: `${focus.company} ${nextRole}`.trim(),
    manualUrl,
    importCommand: batchMatches[0]?.importCommand || samplingRow.importCommand || importCommand(focus.company, nextRole),
    evidenceBoundary: "公司池/公开信号/查询计划不等于BOSS大样本结论；薪资与能力判断需以人工导入的岗位详情和质量门禁为准"
  };
  row.coverageGate = coverageGate(row);
  row.nextAction = nextAction(row);
  return row;
}).sort((a, b) => {
  const gateRank = {
    "待人工导入BOSS样本": 8,
    "缺人工批次": 7,
    "缺可读薪资": 6,
    "缺岗位详情": 5,
    "已有旧样本/缺当前人工批次": 5,
    "有样本但质量不足": 4,
    "缺BOSS查询入口": 3,
    "缺机会地图/打法清单": 2,
    "缺公司池": 1,
    "阶段可用/仍需扩样": 0
  };
  return (b.userNamed === "是") - (a.userNamed === "是") ||
    (gateRank[b.coverageGate] || 0) - (gateRank[a.coverageGate] || 0) ||
    a.focusGroup.localeCompare(b.focusGroup, "zh-Hans-CN") ||
    a.company.localeCompare(b.company, "zh-Hans-CN");
});

const segmentRows = [...new Map(companyRows.map((row) => [row.focusGroup, row.focusGroup])).keys()]
  .map((focusGroup) => {
    const rows = companyRows.filter((row) => row.focusGroup === focusGroup);
    return {
      focusGroup,
      companies: rows.length,
      companyPool: rows.filter((row) => row.inCompanyPool === "是").length,
      queryPlan: rows.filter((row) => row.queryPlanCount > 0).length,
      manualBatch: rows.filter((row) => row.manualBatchCount > 0).length,
      publicSignals: rows.filter((row) => row.publicBossSignalCount > 0 || row.externalSalarySignalCount > 0).length,
      imported: rows.filter((row) => row.bossImportedCount > 0).length,
      usable: rows.filter((row) => row.bossUsableCount > 0).length,
      topGate: unique(rows.map((row) => row.coverageGate)).join(";")
    };
  });

const headers = [
  "focusGroup",
  "userNamed",
  "route",
  "segment",
  "layer",
  "company",
  "aliases",
  "inCompanyPool",
  "queryPlanCount",
  "inOpportunityMap",
  "inPlaybook",
  "manualBatchCount",
  "manualBatchIds",
  "batchQualityGates",
  "publicBossSignalCount",
  "publicBossSignals",
  "externalSalarySignalCount",
  "externalSalaryBands",
  "bossImportedCount",
  "bossUsableCount",
  "readableSalaryCount",
  "detailSampleCount",
  "companySampleGap",
  "companyCoverageStatus",
  "mentionedInDelivery",
  "mentionedInFullReport",
  "coverageGate",
  "nextRole",
  "safeBossHomeUrl",
  "searchKeyword",
  "manualUrl",
  "importCommand",
  "nextAction",
  "evidenceBoundary"
];

const summary = {
  focusCompanyCount: companyRows.length,
  userNamedCount: companyRows.filter((row) => row.userNamed === "是").length,
  inCompanyPoolCount: companyRows.filter((row) => row.inCompanyPool === "是").length,
  queryPlanCompanyCount: companyRows.filter((row) => row.queryPlanCount > 0).length,
  manualBatchCompanyCount: companyRows.filter((row) => row.manualBatchCount > 0).length,
  publicSignalCompanyCount: companyRows.filter((row) => row.publicBossSignalCount > 0 || row.externalSalarySignalCount > 0).length,
  importedCompanyCount: companyRows.filter((row) => row.bossImportedCount > 0).length,
  usableCompanyCount: companyRows.filter((row) => row.bossUsableCount > 0).length
};

const namedRows = companyRows
  .filter((row) => row.userNamed === "是")
  .map((row) => `| ${row.focusGroup} | ${row.company} | ${row.inCompanyPool} | ${row.queryPlanCount} | ${row.manualBatchCount || 0} | ${row.publicBossSignalCount + row.externalSalarySignalCount} | ${row.bossUsableCount}/${row.bossImportedCount} | ${row.coverageGate} | ${row.nextAction} |`);

const segmentMdRows = segmentRows
  .map((row) => `| ${row.focusGroup} | ${row.companies} | ${row.companyPool} | ${row.queryPlan} | ${row.manualBatch} | ${row.publicSignals} | ${row.imported} | ${row.usable} | ${row.topGate} |`);

const priorityRows = companyRows
  .filter((row) => row.coverageGate !== "阶段可用/仍需扩样")
  .slice(0, 25)
  .map((row) => `| ${row.coverageGate} | ${row.focusGroup} | ${row.company} | ${row.nextRole} | ${row.externalSalaryBands || "待补"} | ${row.safeBossHomeUrl} | \`${row.searchKeyword}\` |`);

const md = `# AI重点公司与赛道覆盖审计

更新时间：${formatDate()}

## 一、本质判断

这份审计不是再生成一份 AI 公司名单，而是检查“大而全 AI 销售岗位调研”是否已经进入证据闭环。真正能支撑薪资、岗位要求和简历 Gap 的链路应当是：公司池 -> BOSS 查询入口 -> 公司打法/机会地图 -> 人工低频采样批次 -> 岗位详情导入 -> 样本质量门禁。

当前最大的矛盾是：重点公司和赛道已经大多进入公司池与查询计划，但 BOSS 可用样本仍主要集中在少数云/MaaS 公司；对月之暗面、智谱AI、MiniMax、芯片/半导体/智算基础设施等方向，现阶段还不能写成“BOSS 大样本结论”，只能写成“公司池 + 公开信号 + 待人工校验”的阶段判断。

## 二、总览

| 指标 | 当前值 |
| --- | ---: |
| 审计重点公司 | ${summary.focusCompanyCount} |
| 用户点名/强关注公司 | ${summary.userNamedCount} |
| 已进入公司池 | ${summary.inCompanyPoolCount} |
| 已进入BOSS查询计划 | ${summary.queryPlanCompanyCount} |
| 已进入人工采样批次 | ${summary.manualBatchCompanyCount} |
| 有公开BOSS/薪资信号 | ${summary.publicSignalCompanyCount} |
| 已导入BOSS样本公司 | ${summary.importedCompanyCount} |
| 有可用BOSS样本公司 | ${summary.usableCompanyCount} |

## 三、用户点名方向覆盖

| 方向 | 公司 | 公司池 | 查询入口 | 人工批次 | 公开信号 | 可用/导入样本 | 覆盖门禁 | 下一动作 |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- |
${mdRows(namedRows, "| 暂无 | 暂无 | 否 | 0 | 0 | 0 | 0/0 | 缺数据 | 补公司池 |")}

## 四、赛道覆盖总览

| 重点方向 | 公司数 | 公司池 | 查询入口 | 人工批次 | 公开信号 | 已导入 | 可用样本 | 主要门禁 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
${mdRows(segmentMdRows, "| 暂无 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | - |")}

## 五、下一轮优先动作

| 门禁 | 方向 | 公司 | 下一岗位词 | 薪资信号 | BOSS首页 | 站内搜索关键词 |
| --- | --- | --- | --- | --- | --- | --- |
${mdRows(priorityRows, "| 暂无 |  |  |  |  |  |  |")}

## 六、使用方式

1. 先从“用户点名方向覆盖”和“下一轮优先动作”里选择公司。
2. 打开 BOSS 首页后，手动输入站内搜索关键词；不让脚本自动打开 BOSS。
3. 复制销售、售前、解决方案、渠道、销售管理岗位详情文本。
4. 使用 CSV 中的 \`importCommand\` 导入。
5. 导入后运行：

\`\`\`bash
npm run sampling:quality
npm run sampling:batch-quality
npm run coverage:focus
npm run report:full
npm run audit:research
\`\`\`

## 七、结论边界

- 公司池、机会地图和公开信号只能证明“值得采样”，不能证明“BOSS 市场结论已成立”。
- 薪资判断必须优先使用可读薪资样本；BOSS 字体混淆薪资只能保留原文，不做精确统计。
- 能力要求必须优先来自岗位详情页正文；只有岗位卡片时只能写方向观察。
- 当前输出的正确用途是安排低频人工补样和控制结论权限。

## 八、CSV输出

\`\`\`text
${outputCsvPath}
\`\`\`
`;

mkdirSync(dirname(outputMdPath), { recursive: true });
writeFileSync(outputCsvPath, `${csv([headers, ...companyRows.map((row) => headers.map((header) => row[header]))])}\n`);
writeFileSync(outputMdPath, md);

console.log(`已生成：${outputMdPath}`);
console.log(`已生成：${outputCsvPath}`);
console.log(`审计重点公司：${summary.focusCompanyCount}`);
console.log(`已进入公司池：${summary.inCompanyPoolCount}`);
console.log(`已进入BOSS查询计划：${summary.queryPlanCompanyCount}`);
console.log(`已进入人工采样批次：${summary.manualBatchCompanyCount}`);
console.log(`有可用BOSS样本公司：${summary.usableCompanyCount}`);
