#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const jobsPath = join(projectRoot, "01_行情收集/data/jobs.jsonl");
const queryPlanPath = join(projectRoot, "01_行情收集/BOSS全行业AI销售岗位查询计划.csv");
const companyProfilePath = join(projectRoot, "00_行业资料集/AI销售目标公司分层画像.csv");
const companyMapPath = join(projectRoot, "00_行业资料集/AI产业链头部公司岗位机会地图.csv");
const roleMatrixPath = join(projectRoot, "01_行情收集/AI销售岗位薪资能力矩阵.csv");
const capabilityMatrixPath = join(projectRoot, "02_岗位画像/AI销售岗位能力要求矩阵.csv");
const resumeGapPath = join(projectRoot, "03_简历/AI销售岗位匹配与能力Gap.csv");
const nextSamplingQueuePath = join(projectRoot, "01_行情收集/BOSS下一轮优先采样清单.csv");
const publicSignalPath = join(projectRoot, "01_行情收集/AI行业公开趋势信号看板.csv");
const externalSalaryPath = join(projectRoot, "06_自动化采集/config/external_salary_signals.csv");
const profilePath = join(projectRoot, "02_岗位画像/data/我的能力画像.json");
const outputMdPath = join(projectRoot, "01_行情收集/AI销售岗位市场决策总览.md");
const outputCsvPath = join(projectRoot, "01_行情收集/AI销售岗位市场决策总览.csv");

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

function readCsvIfExists(filePath) {
  if (!existsSync(filePath)) return [];
  return parseCsv(readFileSync(filePath, "utf8"));
}

function readJsonIfExists(filePath, fallback = {}) {
  if (!existsSync(filePath)) return fallback;
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function readLineCount(filePath, hasHeader = false) {
  if (!existsSync(filePath)) return 0;
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/).filter((line) => line.trim());
  return Math.max(0, lines.length - (hasHeader ? 1 : 0));
}

function readBossJobCount(filePath) {
  if (!existsSync(filePath)) return 0;
  return readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => {
      try {
        const job = JSON.parse(line);
        return !job.source || job.source === "BOSS直聘";
      } catch {
        return false;
      }
    }).length;
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

function splitSemi(value) {
  return String(value || "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function topJoined(values, limit = 6, separator = "、") {
  return unique(values).slice(0, limit).join(separator);
}

function priorityScore(priority) {
  if (priority === "P0") return 100;
  if (priority === "P1") return 70;
  if (priority === "P2") return 40;
  return 10;
}

function numberOf(value) {
  const num = Number.parseFloat(String(value || "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(num) ? num : 0;
}

function salaryRanges(value) {
  return [...String(value || "").matchAll(/(\d+(?:\.\d+)?)\s*K\s*[-~－—]\s*(\d+(?:\.\d+)?)\s*K/gi)]
    .map((match) => ({
      low: Number.parseFloat(match[1]),
      high: Number.parseFloat(match[2])
    }))
    .filter((range) => Number.isFinite(range.low) && Number.isFinite(range.high));
}

function salaryAttraction(salaryBand) {
  const ranges = salaryRanges(salaryBand);
  if (!ranges.length) return "待校验";
  const highAvg = ranges.reduce((sum, range) => sum + range.high, 0) / ranges.length;
  if (highAvg >= 55) return "高";
  if (highAvg >= 35) return "中高";
  if (highAvg >= 20) return "中";
  return "入门/待观察";
}

function evidenceLevel(row) {
  const salaryEvidence = numberOf(row.salaryEvidenceCount);
  const progress = String(row.sampleProgress || "");
  const matched = progress.match(/^(\d+)\//);
  const bossSamples = matched ? Number.parseInt(matched[1], 10) : 0;
  if (bossSamples >= 10) return "强";
  if (bossSamples >= 4 || salaryEvidence >= 4) return "中";
  if (salaryEvidence > 0) return "弱";
  return "缺";
}

function decisionLabel(row) {
  const attraction = salaryAttraction(row.salaryBand);
  const evidence = evidenceLevel(row);
  if (row.priority === "P0" && ["高", "中高"].includes(attraction) && evidence !== "缺") return "优先深挖";
  if (row.priority === "P0" && evidence !== "缺") return "优先补样";
  if (row.priority === "P0") return "先验证在招";
  if (row.priority === "P1" && ["高", "中高"].includes(attraction)) return "机会跟踪";
  return "观察";
}

function decisionScore(row, segmentProfile) {
  const salaryEvidence = Math.min(40, numberOf(row.salaryEvidenceCount) * 8);
  const sampleGap = Math.min(20, numberOf(row.sampleGap));
  const companyDepth = Math.min(20, numberOf(segmentProfile?.p0CompanyCount) * 3);
  const salaryBoost = { 高: 30, 中高: 20, 中: 10, "入门/待观察": 4, 待校验: 0 }[salaryAttraction(row.salaryBand)] || 0;
  return priorityScore(row.priority) + salaryEvidence + sampleGap + companyDepth + salaryBoost;
}

function profileStatus(profile) {
  const hasSummary = Boolean(String(profile.currentSummary || "").trim());
  const skills = Array.isArray(profile.skills) ? profile.skills.filter(Boolean) : [];
  const evidence = Array.isArray(profile.evidence)
    ? profile.evidence.filter((item) => Object.values(item || {}).some((value) => String(value || "").trim()))
    : [];
  if (hasSummary && skills.length && evidence.length) return "已有能力画像，可做匹配";
  return "能力画像为空，当前只能输出市场要求和简历补证据清单";
}

function profileCompleteness(profile) {
  const checks = [
    Boolean(String(profile.currentSummary || "").trim()),
    Array.isArray(profile.skills) && profile.skills.filter(Boolean).length >= 3,
    Array.isArray(profile.evidence) && profile.evidence.some((item) => String(item?.result || "").trim()),
    Array.isArray(profile.constraints) && profile.constraints.some((item) => String(item?.description || "").trim()),
    Array.isArray(profile.resumeVersions) && profile.resumeVersions.length > 0
  ];
  return `${checks.filter(Boolean).length}/${checks.length}`;
}

function groupBy(rows, keyFn) {
  const map = new Map();
  for (const row of rows) {
    const key = keyFn(row) || "未分类";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return map;
}

function mdTable(rows, fallback = "暂无") {
  return rows.length ? rows.join("\n") : fallback;
}

const jobsCount = readBossJobCount(jobsPath);
const queryCount = readLineCount(queryPlanPath, true);
const companyProfiles = readCsvIfExists(companyProfilePath);
const companyMapRows = readCsvIfExists(companyMapPath);
const roleRows = readCsvIfExists(roleMatrixPath);
const capabilityRows = readCsvIfExists(capabilityMatrixPath);
const resumeGapRows = readCsvIfExists(resumeGapPath);
const nextSamplingRows = readCsvIfExists(nextSamplingQueuePath);
const publicSignalRows = readCsvIfExists(publicSignalPath);
const externalSalaryRows = readCsvIfExists(externalSalaryPath);
const profile = readJsonIfExists(profilePath, {});
const profileBySegment = new Map(companyProfiles.map((row) => [row.segment, row]));
const gapByKey = new Map(resumeGapRows.map((row) => [`${row.segment}::${row.role}`, row]));

const decisionRows = roleRows
  .map((row) => {
    const segmentProfile = profileBySegment.get(row.segment) || {};
    const gap = gapByKey.get(`${row.segment}::${row.role}`) || {};
    const score = decisionScore(row, segmentProfile);
    return {
      score,
      decision: decisionLabel(row),
      evidenceLevel: evidenceLevel(row),
      salaryAttraction: salaryAttraction(row.salaryBand),
      priority: row.priority,
      segment: row.segment,
      role: row.role,
      companyType: segmentProfile.companyType || "",
      topCompanies: row.topCompanies || segmentProfile.topCompanies || "",
      buyerProfiles: segmentProfile.buyerProfiles || "",
      salaryBand: row.salaryBand || "待BOSS样本校验",
      salaryEvidenceCount: row.salaryEvidenceCount || "0",
      sampleProgress: row.sampleProgress || "",
      sampleGap: row.sampleGap || "",
      coreCapabilities: row.coreCapabilities || segmentProfile.capabilityFocus || "",
      resumeActions: gap.resumeActions || "",
      nextAction: row.nextAction || segmentProfile.nextAction || "",
      fitStatus: gap.fitStatus || "无法判断，能力画像为空",
      riskLevel: gap.riskLevel || "高"
    };
  })
  .sort((a, b) => b.score - a.score);

const segmentRows = companyProfiles
  .map((row) => {
    const roles = roleRows.filter((item) => item.segment === row.segment);
    const maxScore = Math.max(0, ...decisionRows.filter((item) => item.segment === row.segment).map((item) => item.score));
    const topSalary = topJoined(roles.map((item) => item.salaryBand).filter((item) => item && item !== "待BOSS样本校验"), 3, "; ");
    return {
      ...row,
      maxScore,
      topSalary: topSalary || row.salaryObservation || "待BOSS样本校验",
      topRoles: topJoined(roles.map((item) => item.role), 4, "、"),
      topDecision: decisionRows.find((item) => item.segment === row.segment)?.decision || "观察"
    };
  })
  .sort((a, b) => b.maxScore - a.maxScore);

const capabilityTop = capabilityRows
  .sort((a, b) => numberOf(b.demandScore) - numberOf(a.demandScore))
  .slice(0, 8);

const softwareSegments = ["基座大模型/Agent平台", "云计算/大模型平台", "智能客服/营销/销售AI", "AI Agent/RPA/流程自动化", "数据/MLOps/AI基础软件", "工业AI/智能制造"];
const hardwareSegments = ["AI芯片/GPU/加速卡", "AI服务器/智算基础设施", "智算中心/数据中心服务", "智能汽车/机器人/具身智能"];
const solutionSegments = ["AI安全/私有化/信创", "AI视觉/安防/质检", "工业AI/智能制造"];

function laneSummary(name, segments) {
  const rows = segmentRows.filter((row) => segments.includes(row.segment));
  const companyCount = rows.reduce((sum, row) => sum + numberOf(row.companyCount), 0);
  return {
    name,
    segments: rows.map((row) => row.segment).join("、"),
    companyCount,
    topCompanies: topJoined(rows.flatMap((row) => splitSemi(row.topCompanies)), 10),
    topRoles: topJoined(rows.flatMap((row) => splitSemi(row.roleFocus || row.topRoles)), 8),
    salary: topJoined(rows.map((row) => row.topSalary), 5, "; ")
  };
}

const laneRows = [
  laneSummary("AI软件落地/应用销售", softwareSegments),
  laneSummary("AI硬件/算力/半导体销售", hardwareSegments),
  laneSummary("行业解决方案/政企私有化销售", solutionSegments)
];

const nextSamplingTop = nextSamplingRows.slice(0, 12);
const publicSignalTop = publicSignalRows.slice(0, 6);
const profileState = profileStatus(profile);
const profileScore = profileCompleteness(profile);
const topCsvRows = [
  [
    "rank",
    "decisionScore",
    "decision",
    "priority",
    "segment",
    "role",
    "companyType",
    "topCompanies",
    "salaryBand",
    "salaryAttraction",
    "evidenceLevel",
    "salaryEvidenceCount",
    "sampleProgress",
    "sampleGap",
    "fitStatus",
    "riskLevel",
    "coreCapabilities",
    "resumeActions",
    "nextAction"
  ],
  ...decisionRows.map((row, index) => [
    index + 1,
    row.score,
    row.decision,
    row.priority,
    row.segment,
    row.role,
    row.companyType,
    row.topCompanies,
    row.salaryBand,
    row.salaryAttraction,
    row.evidenceLevel,
    row.salaryEvidenceCount,
    row.sampleProgress,
    row.sampleGap,
    row.fitStatus,
    row.riskLevel,
    row.coreCapabilities,
    row.resumeActions,
    row.nextAction
  ])
];

const md = `# AI销售岗位市场决策总览

更新时间：${formatDate()}

## 一、本质判断

这件事本质上不是把 BOSS 岗位复制下来，而是建立一个判断系统：AI 产业链里哪些公司在为销售岗位付费、它们到底买什么销售能力、你应该优先补什么岗位样本和简历证据。

当前最大的矛盾是：既要“大而全”覆盖 AI 软件、硬件、半导体、智算、制造业和应用落地，又要避免 BOSS 高频访问触发风控，同时 BOSS 干净样本还不足以支撑最终统计结论。

因此这份总览采用“产业链公司池 + 公开趋势信号 + 已有 BOSS 样本 + 手动优先采样清单”的方式做阶段性决策。它不是最终大样本报告，而是下一步补样、投递方向和简历改写的总控入口。

## 二、证据底座

| 证据项 | 当前数量 | 判断 |
| --- | ---: | --- |
| AI产业链公司池 | ${companyMapRows.length} 家 | 已覆盖上游/中游/下游头部公司 |
| 公司分层画像 | ${companyProfiles.length} 个赛道 | 可判断公司类型、买方和销售打法 |
| BOSS全行业查询计划 | ${queryCount} 条 | 已有大范围采样入口 |
| 下一轮优先采样清单 | ${nextSamplingRows.length} 条 | 风控恢复期优先人工查看 |
| 岗位薪资能力矩阵 | ${roleRows.length} 行 | 可形成薪资和能力假设 |
| 能力要求矩阵 | ${capabilityRows.length} 项能力 | 可指导简历证据补强 |
| 简历Gap矩阵 | ${resumeGapRows.length} 行 | 当前受能力画像为空限制 |
| BOSS干净岗位样本 | ${jobsCount} 条 | 不足，不能作为最终市场统计 |
| 公开薪资补充信号 | ${externalSalaryRows.length} 条 | 用于补足 BOSS 样本不足 |
| 公开趋势信号 | ${publicSignalRows.length} 条 | 用于决定优先采样赛道 |
| 个人能力画像完整度 | ${profileScore} | ${profileState} |

## 三、三条主线判断

| 主线 | 覆盖赛道 | 公司数 | 代表公司 | 重点岗位 | 薪资观察 |
| --- | --- | ---: | --- | --- | --- |
${mdTable(laneRows.map((row) => `| ${row.name} | ${row.segments} | ${row.companyCount} | ${row.topCompanies} | ${row.topRoles} | ${row.salary || "待校验"} |`))}

## 四、赛道优先级

| 排名 | 赛道 | 公司类型 | 公司数 | 代表公司 | 重点岗位 | 薪资观察 | 当前动作 |
| ---: | --- | --- | ---: | --- | --- | --- | --- |
${mdTable(segmentRows.slice(0, 12).map((row, index) => `| ${index + 1} | ${row.segment} | ${row.companyType} | ${row.companyCount} | ${topJoined(splitSemi(row.topCompanies), 6)} | ${row.topRoles || row.roleFocus} | ${row.topSalary} | ${row.topDecision} |`))}

## 五、最值得优先深挖的岗位组合

| 排名 | 决策 | 赛道 | 岗位 | 代表公司 | 薪资观察 | 证据强度 | 样本进度 | 核心能力 |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- |
${mdTable(decisionRows.slice(0, 15).map((row, index) => `| ${index + 1} | ${row.decision} | ${row.segment} | ${row.role} | ${topJoined(splitSemi(row.topCompanies), 6)} | ${row.salaryBand} | ${row.evidenceLevel} | ${row.sampleProgress || "待采样"} | ${topJoined(splitSemi(row.coreCapabilities), 5)} |`))}

## 六、市场正在为哪些能力付费

| 排名 | 能力 | 需求分 | 覆盖赛道 | 高价值岗位 | 简历证据写法 |
| ---: | --- | ---: | --- | --- | --- |
${mdTable(capabilityTop.map((row, index) => `| ${index + 1} | ${row.capability} | ${row.demandScore} | ${topJoined(splitSemi(row.prioritySegments), 6)} | ${topJoined(splitSemi(row.highValueRoles), 5)} | ${row.resumeEvidenceTemplate} |`))}

## 七、对你的简历意味着什么

当前能力画像为空，所以不能判断“你已经匹配哪些岗位”。但市场侧已经很清楚：AI销售简历不能只写销售动作，必须写出行业场景、客户类型、解决方案、商务结果和 AI 产品理解。

优先补的简历证据：

1. KA/大客户闭环：客户类型、决策链、预算、推进周期、合同额、回款或达成率。
2. 行业场景理解：至少选择一个主攻行业，如制造、政企、金融、教育、互联网、智算/IDC，写清业务痛点和解决路径。
3. 方案表达/售前协同：需求调研、Demo、POC、方案汇报、述标或跨部门推进。
4. AI产品理解：大模型、Agent、RAG、MaaS、私有化、智算/算力等概念要落到客户场景和商业价值。
5. 管理岗证据：团队规模、区域/行业盘子、业绩目标、过程管理、渠道伙伴、复盘机制。

## 八、下一轮 BOSS 人工采样

| 排名 | 赛道 | 公司 | 岗位词 | 薪资观察 | 样本进度 | 动作 |
| ---: | --- | --- | --- | --- | --- | --- |
${mdTable(nextSamplingTop.map((row) => `| ${row.rank} | ${row.segment} | ${row.company} | ${row.role} | ${row.salaryBand} | ${row.sampleProgress} | 打开链接后人工复制岗位详情再导入 |`))}

## 九、公开趋势校验信号

| 来源 | 主题 | 优先级 | 相关赛道 | 对销售岗位的含义 |
| --- | --- | --- | --- | --- |
${mdTable(publicSignalTop.map((row) => `| ${row.source} | ${row.topic} | ${row.priority} | ${topJoined(splitSemi(row.segments), 5)} | ${row.salesImplication} |`))}

## 十、执行路径

1. 短期先看 P0：基座大模型/Agent、AI芯片/GPU、AI服务器/智算、云计算/MaaS、工业AI/智能制造。
2. BOSS 不做自动高频采集，优先按“下一轮 BOSS 人工采样”逐条手动查看和复制岗位详情。
3. 每补 10 条岗位后刷新：\`npm run salary:signals && npm run matrix:roles && npm run capability:matrix && npm run gap:resume && npm run decision:overview && npm run report:full\`。
4. 先完善 \`02_岗位画像/data/我的能力画像.json\`，否则简历匹配只能输出市场要求，不能输出真实个人匹配度。
5. 当每个核心赛道达到 10 到 12 条 BOSS 样本后，再把薪资观察升级为稳定薪资判断。

## 十一、风险控制

- BOSS 样本量仍不足，不能把当前薪资区间当成最终市场中位数。
- 公开趋势只能决定采样优先级，不能替代岗位事实。
- 不绕过验证码、不自动投递、不自动联系招聘方。
- 当前风控恢复期继续采用人工复制导入；自动采集必须显式确认并追加 \`--resume-after-risk\`。
`;

writeFileSync(outputMdPath, md);
writeFileSync(outputCsvPath, `${csv(topCsvRows)}\n`);

console.log(`已生成：${outputMdPath}`);
console.log(`已生成：${outputCsvPath}`);
console.log(`决策岗位组合：${decisionRows.length}`);
console.log(`赛道：${segmentRows.length}`);
