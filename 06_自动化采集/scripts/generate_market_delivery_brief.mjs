#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const panoramaPath = join(projectRoot, "01_行情收集/AI销售岗位全景总览.csv");
const conclusionGatePath = join(projectRoot, "01_行情收集/AI销售市场结论权限总控.csv");
const companySamplingPath = join(projectRoot, "01_行情收集/BOSS目标公司采样缺口看板.csv");
const sampleQualityPath = join(projectRoot, "01_行情收集/BOSS样本质量验收报告.csv");
const compensationPath = join(projectRoot, "01_行情收集/AI销售岗位薪资待遇与能力门槛分析.csv");
const resumeEvidencePath = join(projectRoot, "03_简历/AI销售能力证据与简历改写矩阵.csv");
const resumeGapPath = join(projectRoot, "03_简历/AI销售岗位匹配与能力Gap.csv");
const publicCompanySignalsPath = join(projectRoot, "06_自动化采集/config/boss_public_company_signals.csv");

const outputMdPath = join(projectRoot, "01_行情收集/AI销售岗位市场调研交付版.md");
const outputCsvPath = join(projectRoot, "01_行情收集/AI销售岗位市场调研交付版.csv");

const namedSoftwareCompanies = ["月之暗面", "智谱AI", "MiniMax", "DeepSeek", "阶跃星辰", "百川智能", "商汤科技"];
const namedHardwareCompanies = ["寒武纪", "海光信息", "华为昇腾", "摩尔线程", "壁仞科技", "海思", "超聚变", "浪潮信息", "新华三", "中科曙光"];

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

function splitTerms(value) {
  return String(value || "")
    .split(/[;；、]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniq(items) {
  return [...new Set(items.map((item) => String(item || "").trim()).filter(Boolean))];
}

function topJoined(values, limit = 6, separator = "、") {
  return uniq(values).slice(0, limit).join(separator);
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

function gateFor(gateRows, segment, topic) {
  return gateRows.find((row) => row.segment === segment && row.conclusionTopic === topic) || {};
}

function globalGate(gateRows, topic) {
  return gateRows.find((row) => row.scope === "全局" && row.conclusionTopic === topic) || {};
}

function permissionShort(permission) {
  if (!permission) return "未生成";
  if (permission.includes("不能")) return "不能下结论";
  if (permission.includes("公开薪资")) return "只能写公开薪资假设";
  if (permission.includes("公开信号")) return "只能写公开信号假设";
  if (permission.includes("公司池")) return "可写公司池/采样计划";
  if (permission.includes("方向性")) return "可写方向性观察";
  if (permission.includes("能力趋势")) return "可写能力趋势假设";
  return permission;
}

function segmentCompanyRows(companyRows, segment) {
  return companyRows
    .filter((row) => row.segment === segment)
    .sort((a, b) => {
      const priorityScore = (value) => {
        if (/P0/.test(value)) return 3;
        if (/P1/.test(value)) return 2;
        if (/P2/.test(value)) return 1;
        return 0;
      };
      return priorityScore(b.priority) - priorityScore(a.priority)
        || numberOf(b.sampleGap) - numberOf(a.sampleGap)
        || Number(b.focusCompany === "是") - Number(a.focusCompany === "是");
    });
}

function deliveryLevel(row, positionPermission) {
  const segment = row.segment || "";
  const route = row.route || "";
  if (/基座大模型|Agent平台/.test(segment)) return "P0点名关注：AI软件落地公司";
  if (/AI芯片|GPU|服务器|智算|半导体|算力/.test(`${segment}${route}`)) return "P0/P1硬件算力主线";
  if (/云计算|MaaS|大模型平台/.test(segment)) return "P0云与MaaS平台主线";
  if (/工业AI|智能制造/.test(segment)) return "P0制造业AI落地主线";
  if (/可写BOSS方向性观察/.test(positionPermission)) return "已有少量BOSS样本，可方向观察";
  if (/P0/.test(row.priority || "")) return "P0公开信号强，待BOSS补样";
  return "观察队列，补样后再判断";
}

function applicantPositioning(row) {
  const segment = row.segment || "";
  if (/基座大模型|Agent平台/.test(segment)) return "AI产品理解 + ToB大客户/解决方案销售";
  if (/云计算|MaaS|大模型平台/.test(segment)) return "云/MaaS + 行业客户 + 售前协同";
  if (/AI芯片|GPU|加速卡|半导体/.test(segment)) return "硬件/算力链路 + 政企/云/IDC大客户 + 渠道生态";
  if (/AI服务器|智算基础设施|数据中心/.test(segment)) return "AI服务器/智算项目 + 政企/金融/教育/运营商客户";
  if (/工业AI|智能制造/.test(segment)) return "制造业场景 + 工业软件/视觉/质检方案销售";
  if (/智能客服|营销|销售AI/.test(segment)) return "SaaS销售 + 客户成功/续费增购 + 业务效率场景";
  if (/机器人|具身|智能汽车/.test(segment)) return "软硬结合 + 渠道/海外 + 主机厂/集成商客户";
  if (/AI安全|私有化|信创/.test(segment)) return "政企行业销售 + 私有化/安全/信创合规";
  return "AI场景理解 + ToB销售闭环 + 方案表达";
}

function routeDecision(route) {
  if (/AI软件落地/.test(route)) {
    return "优先看大模型、Agent、MaaS、智能客服/营销这类能快速商业化的软件销售岗位。";
  }
  if (/硬件|算力|半导体/.test(route)) {
    return "优先看芯片、AI服务器、智算中心和智能硬件链路，销售更偏项目型、大客户和渠道生态。";
  }
  if (/行业解决方案/.test(route)) {
    return "优先看制造、工业AI、视觉质检、政企行业方案，能力门槛在行业场景和交付协同。";
  }
  return "作为补充观察方向，补足样本后再决定是否进入投递主线。";
}

function canSayFor(positionGate, salaryGate, capabilityGate) {
  const parts = [
    positionGate.allowedWording,
    salaryGate.allowedWording,
    capabilityGate.allowedWording
  ].filter(Boolean);
  return topJoined(parts, 3, "；");
}

function cannotSayFor(positionGate, salaryGate) {
  const parts = [
    positionGate.forbiddenWording,
    salaryGate.forbiddenWording
  ].filter(Boolean);
  return topJoined(parts, 2, "；");
}

function sampleActionFor(companyRows, fallback) {
  const companies = companyRows.slice(0, 4).map((row) => `${row.company}/${row.nextRole || "销售"}`);
  if (companies.length) return `优先手动复核 ${companies.join("；")}。`;
  return fallback || "按人工补样工作台继续补样。";
}

function fallbackSegmentForNamedCompany(company) {
  if (namedSoftwareCompanies.includes(company)) return "基座大模型/Agent平台";
  if (["超聚变", "浪潮信息", "新华三", "中科曙光"].includes(company)) return "AI服务器/智算基础设施";
  if (namedHardwareCompanies.includes(company)) return "AI芯片/GPU/加速卡";
  return "";
}

function roleHitScore(compensationRow, roleText) {
  const role = String(compensationRow.role || "");
  const text = String(roleText || "");
  if (text && role.includes(text)) return 30;
  if (/解决方案|售前|顾问|方案/.test(text) && /售前|解决方案|顾问/.test(role)) return 20;
  if (/大客户|KA|行业/.test(text) && /大客户|行业/.test(role)) return 20;
  if (/渠道|生态|伙伴/.test(text) && /渠道|生态|伙伴/.test(role)) return 20;
  if (/管理|负责人|经理|总监/.test(text) && /管理|负责人|经理|总监/.test(role)) return 15;
  if (/AI销售|大模型|软件/.test(text) && /AI软件|大模型|SaaS|应用/.test(role)) return 15;
  return 0;
}

function salarySignalForCompany(company, signal, companyTask) {
  const direct = signal?.salary_signal || signal?.salarySignal || signal?.salary;
  if (direct) return direct;
  const segment = companyTask?.segment || signal?.segment || fallbackSegmentForNamedCompany(company);
  const roleText = companyTask?.nextRole || signal?.role_signal || signal?.roleSignal || signal?.role || "";
  const matchedCompensation = compensationRows
    .filter((row) => row.segment === segment)
    .sort((a, b) => roleHitScore(b, roleText) - roleHitScore(a, roleText) || numberOf(b.salaryMaxK) - numberOf(a.salaryMaxK));
  const panorama = panoramaRows.find((row) => row.segment === segment);
  return matchedCompensation[0]?.salaryBand || panorama?.salaryBand || "待BOSS样本校验";
}

function summarizeSamples(qualityRows) {
  const usable = qualityRows.filter((row) => row.roleRelevant === "true" && row.aiRelevant === "true" && /^A|^B/.test(row.qualityGrade || "")).length;
  const readable = qualityRows.filter((row) => row.salaryReadable === "true").length;
  const detail = qualityRows.filter((row) => numberOf(row.detailTextLength) >= 300).length;
  return { usable, readable, detail };
}

function topResumeEvidence(rows, limit = 8) {
  return rows
    .slice()
    .sort((a, b) => numberOf(b.demandScore) - numberOf(a.demandScore))
    .slice(0, limit);
}

function pickResumeAction(segment, resumeGapRows) {
  const rows = resumeGapRows.filter((row) => row.segment === segment);
  const p0 = rows.find((row) => /P0/.test(row.priority || "")) || rows[0];
  return p0?.resumeActions || p0?.nextAction || "补真实能力画像：客户、项目、合同额、回款、方案和行业场景证据。";
}

function signalRowsForCompanies(signalRows, companies) {
  return signalRows.filter((row) => companies.some((company) => String(row.company || "").includes(company)));
}

const panoramaRows = readCsv(panoramaPath);
const gateRows = readCsv(conclusionGatePath);
const companyRows = readCsv(companySamplingPath);
const qualityRows = readCsv(sampleQualityPath);
const compensationRows = readCsv(compensationPath);
const resumeEvidenceRows = readCsv(resumeEvidencePath);
const resumeGapRows = readCsv(resumeGapPath);
const publicCompanySignals = readCsv(publicCompanySignalsPath);

const sampleSummary = summarizeSamples(qualityRows);
const totalCompanyGap = companyRows.reduce((sum, row) => sum + numberOf(row.sampleGap), 0);
const sampledCompanies = companyRows.filter((row) => numberOf(row.currentSamples) > 0).length;
const globalBossGate = globalGate(gateRows, "BOSS平台大样本结论");
const globalSalaryGate = globalGate(gateRows, "薪资待遇");
const globalCapabilityGate = globalGate(gateRows, "能力要求");
const topEvidenceRows = topResumeEvidence(resumeEvidenceRows);

const deliveryRows = panoramaRows.map((row) => {
  const companiesForSegment = segmentCompanyRows(companyRows, row.segment);
  const positionGate = gateFor(gateRows, row.segment, "岗位定位");
  const salaryGate = gateFor(gateRows, row.segment, "薪资待遇");
  const capabilityGate = gateFor(gateRows, row.segment, "能力要求");
  const companyGate = gateFor(gateRows, row.segment, "目标公司机会");
  const representativeCompanies = topJoined([
    ...companiesForSegment.map((item) => item.company),
    ...splitTerms(row.companyExamples)
  ], 10);
  return {
    rank: row.rank,
    priority: row.priority,
    route: row.route,
    segment: row.segment,
    decisionLevel: deliveryLevel(row, positionGate.conclusionPermission),
    routeDecision: routeDecision(row.route),
    companyType: row.companyType,
    representativeCompanies,
    namedConcernHit: topJoined([
      ...namedSoftwareCompanies.filter((company) => representativeCompanies.includes(company)),
      ...namedHardwareCompanies.filter((company) => representativeCompanies.includes(company))
    ], 12),
    buyerProfiles: row.buyerProfiles,
    roleFocus: row.roleFocus,
    salaryBand: row.salaryBand,
    salaryPermission: permissionShort(salaryGate.conclusionPermission),
    positionPermission: permissionShort(positionGate.conclusionPermission),
    capabilityPermission: permissionShort(capabilityGate.conclusionPermission),
    companyPermission: permissionShort(companyGate.conclusionPermission),
    sampleProgress: row.sampleProgress,
    sampleGap: row.sampleGap,
    companyGap: companiesForSegment.reduce((sum, item) => sum + numberOf(item.sampleGap), 0),
    coreCapabilities: row.coreCapabilities,
    mustHaveGate: row.mustHaveGate,
    resumeEvidence: row.resumeEvidence,
    recommendedApplicantPositioning: applicantPositioning(row),
    canSay: canSayFor(positionGate, salaryGate, capabilityGate),
    cannotSay: cannotSayFor(positionGate, salaryGate),
    nextBossAction: sampleActionFor(companiesForSegment, row.nextAction),
    nextResumeAction: pickResumeAction(row.segment, resumeGapRows),
    evidenceBoundary: row.evidenceBoundary
  };
});

const headers = [
  "rank",
  "priority",
  "route",
  "segment",
  "decisionLevel",
  "routeDecision",
  "companyType",
  "representativeCompanies",
  "namedConcernHit",
  "buyerProfiles",
  "roleFocus",
  "salaryBand",
  "salaryPermission",
  "positionPermission",
  "capabilityPermission",
  "companyPermission",
  "sampleProgress",
  "sampleGap",
  "companyGap",
  "coreCapabilities",
  "mustHaveGate",
  "resumeEvidence",
  "recommendedApplicantPositioning",
  "canSay",
  "cannotSay",
  "nextBossAction",
  "nextResumeAction",
  "evidenceBoundary"
];

const softwareSignalRows = signalRowsForCompanies(publicCompanySignals, namedSoftwareCompanies);
const hardwareSignalRows = signalRowsForCompanies(publicCompanySignals, namedHardwareCompanies);
const highSalaryRows = compensationRows
  .slice()
  .sort((a, b) => numberOf(b.salaryMaxK) - numberOf(a.salaryMaxK))
  .slice(0, 10);
const prioritySamplingRows = companyRows
  .slice()
  .sort((a, b) => {
    const score = (row) => (/P0/.test(row.priority || "") ? 100 : /P1/.test(row.priority || "") ? 50 : 0)
      + numberOf(row.sampleGap) * 5
      + (row.focusCompany === "是" ? 20 : 0);
    return score(b) - score(a);
  })
  .slice(0, 20);

const routeOverviewRows = [...new Set(deliveryRows.map((row) => row.route))].map((route) => {
  const rows = deliveryRows.filter((row) => row.route === route);
  return `| ${route} | ${rows.length} | ${topJoined(rows.map((row) => row.segment), 5)} | ${topJoined(rows.map((row) => row.salaryBand), 5, "；")} | ${routeDecision(route)} |`;
});

const deliveryMdRows = deliveryRows.map((row) => {
  return `| ${row.rank} | ${row.decisionLevel} | ${row.route} | ${row.segment} | ${row.representativeCompanies} | ${row.roleFocus} | ${row.salaryBand} | ${row.positionPermission}/${row.salaryPermission}/${row.capabilityPermission} | ${row.recommendedApplicantPositioning} |`;
});

const salaryMdRows = highSalaryRows.map((row, index) => {
  return `| ${index + 1} | ${row.segment} | ${row.role} | ${row.salaryBand} | ${row.salaryEvidenceCount} | ${row.evidenceLevel} | ${row.topCompanies} |`;
});

const capabilityMdRows = topEvidenceRows.map((row) => {
  return `| ${row.priority} | ${row.capability} | ${row.demandScore} | ${row.salaryMaxK || "-"}K | ${row.highValueRoles} | ${row.proofObject} |`;
});

const softwareMdRows = namedSoftwareCompanies.map((company) => {
  const signal = softwareSignalRows.find((row) => String(row.company || "").includes(company));
  const companyTask = companyRows.find((row) => row.company === company);
  return `| ${company} | ${signal?.signal_type || signal?.signalType || "公司池/公开信号待补"} | ${signal?.role_signal || signal?.roleSignal || signal?.role || "-"} | ${salarySignalForCompany(company, signal, companyTask)} | ${companyTask?.nextRole || "AI销售/解决方案顾问"} | ${companyTask?.sampleGap || 3} |`;
});

const hardwareMdRows = namedHardwareCompanies.map((company) => {
  const signal = hardwareSignalRows.find((row) => String(row.company || "").includes(company));
  const companyTask = companyRows.find((row) => row.company === company);
  return `| ${company} | ${companyTask?.segment || signal?.segment || "硬件/算力/半导体"} | ${signal?.role_signal || signal?.roleSignal || signal?.role || "-"} | ${salarySignalForCompany(company, signal, companyTask)} | ${companyTask?.nextRole || "大客户销售/渠道销售/售前"} | ${companyTask?.sampleGap || 3} |`;
});

const samplingMdRows = prioritySamplingRows.map((row, index) => {
  return `| ${index + 1} | ${row.priority} | ${row.route} | ${row.segment} | ${row.company} | ${row.nextRole} | ${salarySignalForCompany(row.company, null, row)} | ${row.sampleGap} | ${row.nextAction} |`;
});

const md = `# AI销售岗位市场调研交付版

更新时间：${formatDateTime()}

## 一、本质判断

这件事本质上不是“抓一批 BOSS 岗位”，而是建立一套 AI 行业销售岗位市场判断系统：先把 AI 产业链拆成可投递的公司类型和岗位类型，再用 BOSS 样本、公开招聘信号、薪资信号和能力矩阵持续校验。

当前最大的矛盾是：既要覆盖 AI 软件落地、芯片半导体、智算硬件、制造业 AI 等大范围，又要保证 BOSS 样本真实可靠，同时不能因高频操作继续触发风控。

## 二、当前可交付结论

| 结论项 | 当前状态 |
| --- | --- |
| BOSS大样本结论 | ${globalBossGate.conclusionPermission || "未生成"} |
| 薪资结论权限 | ${globalSalaryGate.conclusionPermission || "未生成"} |
| 能力要求结论权限 | ${globalCapabilityGate.conclusionPermission || "未生成"} |
| BOSS可用样本 | ${sampleSummary.usable} 条 |
| BOSS可读薪资 | ${sampleSummary.readable} 条 |
| BOSS详情文本 | ${sampleSummary.detail} 条 |
| 目标公司覆盖 | ${companyRows.length} 家，已采样公司 ${sampledCompanies} 家 |
| 公司级样本缺口 | ${totalCompanyGap} 条 |
| 当前结论边界 | 可以写市场地图、公开薪资假设、能力趋势和补样计划；不能写成 BOSS 平台全行业大样本结论。 |

## 三、优先关注路线

| 路线 | 赛道数 | 代表赛道 | 薪资信号 | 判断 |
| --- | ---: | --- | --- | --- |
${mdRows(routeOverviewRows, "| 暂无 | 0 | - | - | - |")}

## 四、赛道交付表

| 排名 | 决策层级 | 路线 | 赛道 | 代表公司 | 重点岗位 | 薪资信号 | 结论权限 | 候选人定位 |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- |
${mdRows(deliveryMdRows, "| - | 暂无 |  |  |  |  |  |  |  |")}

## 五、薪资待遇当前说法

只能把以下内容写成“公开薪资信号 + 少量 BOSS 样本待校验”，不能写成 BOSS 统计中位数。

| 排名 | 赛道 | 岗位 | 薪资信号 | 证据数 | 证据级别 | 代表公司 |
| ---: | --- | --- | --- | ---: | --- | --- |
${mdRows(salaryMdRows, "| - | 暂无 |  |  | 0 |  |  |")}

## 六、人员能力要求

| 优先级 | 能力 | 需求分 | 薪资上限信号 | 高价值岗位 | 简历证明对象 |
| --- | --- | ---: | ---: | --- | --- |
${mdRows(capabilityMdRows, "| 暂无 |  | 0 | - |  |  |")}

## 七、点名公司处理

### AI软件落地公司

| 公司 | 当前信号 | 岗位信号 | 薪资信号 | 下一步岗位词 | 样本缺口 |
| --- | --- | --- | --- | --- | ---: |
${mdRows(softwareMdRows, "| 暂无 |  |  |  |  | 0 |")}

### 硬件/芯片/半导体/智算公司

| 公司 | 赛道 | 岗位信号 | 薪资信号 | 下一步岗位词 | 样本缺口 |
| --- | --- | --- | --- | --- | ---: |
${mdRows(hardwareMdRows, "| 暂无 |  |  |  |  | 0 |")}

## 八、下一步补样优先级

| 排名 | 优先级 | 路线 | 赛道 | 公司 | 岗位词 | 薪资信号 | 缺口 | 动作 |
| ---: | --- | --- | --- | --- | --- | --- | ---: | --- |
${mdRows(samplingMdRows, "| - | 暂无 |  |  |  |  |  | 0 |  |")}

## 九、简历改写方向

1. 主线定位：把自己包装成“AI场景理解 + ToB销售闭环 + 解决方案表达”的候选人，而不是普通销售。
2. 软件落地方向：补大模型、Agent、RAG、MaaS、私有化、企业知识库等产品语言，并用客户业务场景解释价值。
3. 硬件/半导体/智算方向：补算力链路、服务器/芯片生态、政企/IDC/云厂商客户、渠道伙伴和项目型销售证据。
4. 高薪岗位共性：大客户/KA、行业场景、合同额/回款、方案宣讲、跨部门协同是最需要量化的证据。
5. 当前简历风险：能力画像为空，匹配看板只能给出“需要补什么证据”，还不能判断真实匹配度。

## 十、下一步动作

1. 用 \`npm run auth:boss\` 打开普通 Chrome，不要在 9333/CDP 窗口里访问 BOSS。
2. 按第八部分优先补样，每个核心赛道先补 10 到 12 条高相关岗位。
3. 每复制一个岗位详情，用 \`npm run import:manual\` 导入，保留岗位职责、要求、薪资、经验、学历和客户类型。
4. 每新增 10 条样本后运行 \`npm run report:full\` 和 \`npm run audit:research\`。
5. 补个人能力画像：至少准备 1 个 KA 闭环案例、1 个行业场景案例、1 个商务回款案例、1 个方案/售前协同案例。

输出 CSV：${outputCsvPath}
`;

mkdirSync(dirname(outputMdPath), { recursive: true });
writeFileSync(outputCsvPath, `${csv([headers, ...deliveryRows.map((row) => headers.map((header) => row[header]))])}\n`);
writeFileSync(outputMdPath, md);

console.log(`已生成：${outputMdPath}`);
console.log(`已生成：${outputCsvPath}`);
console.log(`赛道：${deliveryRows.length}`);
console.log(`BOSS可用样本：${sampleSummary.usable}`);
console.log(`公司级样本缺口：${totalCompanyGap}`);
