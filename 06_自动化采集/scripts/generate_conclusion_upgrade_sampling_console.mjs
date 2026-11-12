#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const acceptancePath = join(projectRoot, "01_行情收集/BOSS大样本完成门槛与验收路线.csv");
const firstExecutionPath = join(projectRoot, "01_行情收集/BOSS首批人工采样执行单.csv");
const conclusionGatePath = join(projectRoot, "01_行情收集/AI销售市场结论权限总控.csv");
const publicEvidencePath = join(projectRoot, "01_行情收集/AI公开招聘薪资证据库.csv");
const landscapePath = join(projectRoot, "00_行业资料集/AI产业链销售岗位图谱.csv");
const rateLimitPath = join(projectRoot, "06_自动化采集/config/rate_limits.json");
const outputCsvPath = join(projectRoot, "01_行情收集/BOSS结论升级采样控制台.csv");
const outputMdPath = join(projectRoot, "01_行情收集/BOSS结论升级采样控制台.md");

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

function readJson(filePath, fallback = {}) {
  if (!existsSync(filePath)) return fallback;
  return JSON.parse(readFileSync(filePath, "utf8"));
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

function topJoined(values, limit = 5, separator = "、") {
  return [...new Set(values.filter(Boolean))].slice(0, limit).join(separator);
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

function gateFor(gateRows, segment, topic) {
  return gateRows.find((row) => row.segment === segment && row.conclusionTopic === topic) || {};
}

function segmentPublicEvidence(publicRows, segment) {
  const rows = publicRows.filter((row) => row.segment === segment || row.originalSegment === segment);
  const withSalary = rows.filter((row) => row.salaryRaw);
  const strongest = rows
    .slice()
    .sort((a, b) => numberOf(b.evidenceScore) - numberOf(a.evidenceScore) || numberOf(b.salaryMaxK) - numberOf(a.salaryMaxK))
    .slice(0, 3)
    .map((row) => `${row.platform}/${row.companyOrPage || row.source}/${row.role}/${row.salaryRaw || "无薪资"}`);
  return {
    publicEvidenceCount: rows.length,
    publicSalaryCount: withSalary.length,
    publicSalaryMaxK: Math.max(0, ...withSalary.map((row) => numberOf(row.salaryMaxK))),
    publicEvidenceExamples: topJoined(strongest, 3, "；")
  };
}

function nextUnlock(row) {
  const currentSamples = numberOf(row.currentSamples);
  const currentReadableSalary = numberOf(row.currentReadableSalary);
  const currentDetailSamples = numberOf(row.currentDetailSamples);
  const minimumBoss = numberOf(row.minimumBossConclusionSamples);
  const salaryNeed = numberOf(row.salaryConclusionSamples);
  const detailNeed = Math.max(4, Math.ceil(minimumBoss / 2));

  if (currentSamples < minimumBoss || currentDetailSamples < detailNeed) {
    return "岗位定位/能力观察";
  }
  if (currentReadableSalary < salaryNeed) {
    return "薪资区间观察";
  }
  if (numberOf(row.currentCompanyCoverage) < numberOf(row.companyCoverageRequired)) {
    return "公司覆盖结论";
  }
  return "扩大样本稳定性";
}

function unlockGap(row) {
  const currentSamples = numberOf(row.currentSamples);
  const currentReadableSalary = numberOf(row.currentReadableSalary);
  const currentDetailSamples = numberOf(row.currentDetailSamples);
  const minimumBoss = numberOf(row.minimumBossConclusionSamples);
  const salaryNeed = numberOf(row.salaryConclusionSamples);
  const detailNeed = Math.max(4, Math.ceil(minimumBoss / 2));
  const gaps = [];
  if (currentSamples < minimumBoss) gaps.push(`BOSS样本差${minimumBoss - currentSamples}`);
  if (currentReadableSalary < salaryNeed) gaps.push(`可读薪资差${salaryNeed - currentReadableSalary}`);
  if (currentDetailSamples < detailNeed) gaps.push(`详情文本差${detailNeed - currentDetailSamples}`);
  return gaps.join("；") || "已过基础门槛，继续扩样";
}

function scoreRow(row, firstTasks, publicEvidence) {
  let score = 0;
  if (row.priority === "P0") score += 60;
  else if (row.priority === "P1") score += 35;
  else score += 15;
  score += numberOf(row.missingBossSamples) * 3;
  score += numberOf(row.missingReadableSalary) * 4;
  score += numberOf(row.missingDetailSamples) * 4;
  score += Math.min(20, firstTasks.reduce((sum, task) => sum + numberOf(task.targetCopies), 0));
  score += Math.min(12, publicEvidence.publicSalaryCount * 3);
  if (/基座大模型|芯片|服务器|云计算|工业AI|智能客服/.test(row.segment || "")) score += 15;
  return score;
}

function paceText(rateLimitConfig) {
  const minMs = numberOf(rateLimitConfig.boss?.minRequestIntervalMs) || 600000;
  const cooldownMs = numberOf(rateLimitConfig.boss?.overnightCooldownMs) || 1800000;
  const minMinutes = Math.ceil(minMs / 60000);
  const cooldownMinutes = Math.ceil(cooldownMs / 60000);
  return `每次只做1个入口；入口之间至少间隔${minMinutes}分钟；完成3个入口后冷却${cooldownMinutes}分钟；只复制岗位详情，不自动刷新、不批量跳转。`;
}

function mdRows(rows, fallback) {
  return rows.length ? rows.join("\n") : fallback;
}

const acceptanceRows = readCsv(acceptancePath);
const firstRows = readCsv(firstExecutionPath);
const gateRows = readCsv(conclusionGatePath);
const publicRows = readCsv(publicEvidencePath);
const landscapeRows = readCsv(landscapePath);
const rateLimitConfig = readJson(rateLimitPath, {});
const firstBySegment = groupBy(firstRows, (row) => row.segment);
const landscapeBySegment = groupBy(landscapeRows, (row) => row.segment);

const consoleRows = acceptanceRows.map((row) => {
  const firstTasks = firstBySegment.get(row.segment) || [];
  const publicEvidence = segmentPublicEvidence(publicRows, row.segment);
  const landscape = (landscapeBySegment.get(row.segment) || [])[0] || {};
  const positionGate = gateFor(gateRows, row.segment, "岗位定位");
  const salaryGate = gateFor(gateRows, row.segment, "薪资待遇");
  const capabilityGate = gateFor(gateRows, row.segment, "能力要求");
  const firstTaskText = firstTasks
    .slice()
    .sort((a, b) => numberOf(a.rank) - numberOf(b.rank))
    .map((task) => `${task.rank}.${task.company}/${task.role}/${task.targetCopies}条`)
    .join("；");
  const firstTargetCopies = firstTasks.reduce((sum, task) => sum + numberOf(task.targetCopies), 0);
  const score = scoreRow(row, firstTasks, publicEvidence);
  return {
    rank: 0,
    upgradeScore: score,
    priority: row.priority,
    route: row.route,
    segment: row.segment,
    nextUnlock: nextUnlock(row),
    unlockGap: unlockGap(row),
    currentSamples: numberOf(row.currentSamples),
    currentReadableSalary: numberOf(row.currentReadableSalary),
    currentDetailSamples: numberOf(row.currentDetailSamples),
    targetSamples: numberOf(row.targetSamples),
    missingBossSamples: numberOf(row.missingBossSamples),
    missingReadableSalary: numberOf(row.missingReadableSalary),
    missingDetailSamples: numberOf(row.missingDetailSamples),
    firstWaveEntries: firstTasks.length,
    firstWaveTargetCopies: firstTargetCopies,
    firstWaveTasks: firstTaskText || "未进入首批执行单",
    positionPermission: positionGate.conclusionPermission || row.conclusionAllowed,
    salaryPermission: salaryGate.conclusionPermission || "未生成",
    capabilityPermission: capabilityGate.conclusionPermission || "未生成",
    publicEvidenceCount: publicEvidence.publicEvidenceCount,
    publicSalaryCount: publicEvidence.publicSalaryCount,
    publicSalaryMaxK: publicEvidence.publicSalaryMaxK || row.publicSalaryMaxK || "",
    publicEvidenceExamples: publicEvidence.publicEvidenceExamples || "待补公开薪资证据",
    topCompanies: landscape.topCompanies || row.nextCompanies,
    nextCompanies: row.nextCompanies,
    nextRoles: row.nextRoles,
    salaryBand: row.salaryBand,
    safePace: paceText(rateLimitConfig),
    nextAction: row.nextAction,
    acceptanceCriteria: row.acceptanceCriteria,
    manualUrl: row.manualUrl,
    importCommand: row.importCommand
  };
}).sort((a, b) => b.upgradeScore - a.upgradeScore || numberOf(b.missingBossSamples) - numberOf(a.missingBossSamples));

consoleRows.forEach((row, index) => {
  row.rank = index + 1;
});

const headers = [
  "rank",
  "upgradeScore",
  "priority",
  "route",
  "segment",
  "nextUnlock",
  "unlockGap",
  "currentSamples",
  "currentReadableSalary",
  "currentDetailSamples",
  "targetSamples",
  "missingBossSamples",
  "missingReadableSalary",
  "missingDetailSamples",
  "firstWaveEntries",
  "firstWaveTargetCopies",
  "firstWaveTasks",
  "positionPermission",
  "salaryPermission",
  "capabilityPermission",
  "publicEvidenceCount",
  "publicSalaryCount",
  "publicSalaryMaxK",
  "publicEvidenceExamples",
  "topCompanies",
  "nextCompanies",
  "nextRoles",
  "salaryBand",
  "safePace",
  "nextAction",
  "acceptanceCriteria",
  "manualUrl",
  "importCommand"
];

writeFileSync(outputCsvPath, `${csv([headers, ...consoleRows.map((row) => headers.map((header) => row[header]))])}\n`);

const p0Rows = consoleRows.filter((row) => row.priority === "P0");
const totalMissing = consoleRows.reduce((sum, row) => sum + row.missingBossSamples, 0);
const totalFirstTarget = consoleRows.reduce((sum, row) => sum + row.firstWaveTargetCopies, 0);
const canOnlyPublic = consoleRows.filter((row) => /公开|不能写/.test(`${row.positionPermission}${row.salaryPermission}`)).length;
const topUpgradeRows = consoleRows.slice(0, 8);
const firstExecutionRows = firstRows
  .slice()
  .sort((a, b) => numberOf(a.rank) - numberOf(b.rank))
  .slice(0, 12);

const report = `# BOSS结论升级采样控制台

更新时间：${formatDate()}

## 一、本质判断

这张控制台不是新的采集计划，而是把“大而全 AI 销售岗位调研”拆成结论升级路径：哪些赛道还只能写公开假设，哪些赛道先补几条 BOSS 岗位详情后可以升级为方向观察，哪些赛道缺的是可读薪资。

当前最大的矛盾是：既要尽快得到能支撑薪资、能力和岗位定位的 BOSS 证据，又不能通过自动打开、连续刷新或高频跳转触发风控。所以本控制台只给人工复制顺序和导入命令，不访问 BOSS。

## 二、全局状态

| 指标 | 当前值 |
| --- | ---: |
| 覆盖赛道 | ${consoleRows.length} |
| P0赛道 | ${p0Rows.length} |
| BOSS样本总缺口 | ${totalMissing} |
| 首批执行单目标导入 | ${totalFirstTarget} |
| 仍只能写公开假设或不能写BOSS结论的赛道 | ${canOnlyPublic} |
| 安全节奏 | ${paceText(rateLimitConfig)} |

## 三、结论升级优先级

| 排名 | 优先级 | 赛道 | 下一步解锁 | 还差什么 | 当前样本 | 首批任务 | 薪资信号 | 现在能写什么 |
| ---: | --- | --- | --- | --- | ---: | --- | --- | --- |
${mdRows(topUpgradeRows.map((row) => `| ${row.rank} | ${row.priority} | ${row.segment} | ${row.nextUnlock} | ${row.unlockGap} | ${row.currentSamples}/${row.targetSamples} | ${row.firstWaveTasks || "未进入首批"} | ${row.salaryBand || "待补"} | 岗位：${row.positionPermission}；薪资：${row.salaryPermission}；能力：${row.capabilityPermission} |`), "| - | - | 暂无 | - | - | - | - | - | - |")}

## 四、首批人工执行顺序

先运行 \`npm run auth:boss\` 生成本地安全入口页，再在普通 Chrome 打开 BOSS 首页并输入站内搜索关键词。不要从 Markdown 直接点击 BOSS 搜索链接。

| 顺序 | 轮次 | 公司 | 赛道 | 岗位词 | 薪资参考 | 目标 | BOSS首页 | 站内搜索关键词 | 导入方式 |
| ---: | --- | --- | --- | --- | --- | ---: | --- | --- | --- |
${mdRows(firstExecutionRows.map((row) => `| ${row.rank} | ${row.executionRound} | ${row.company} | ${row.segment} | ${row.role} | ${row.salaryBand || "待补"} | ${row.targetCopies} | ${row.safeHomeUrl || "https://www.zhipin.com/"} | \`${row.searchKeyword || `${row.company} ${row.role}`}\` | 粘贴到收件箱后运行 \`npm run import:inbox -- --refresh\` |`), "| - | 暂无 |  |  |  |  | 0 |  |  |  |")}

## 五、结论边界

| 事项 | 当前边界 |
| --- | --- |
| BOSS平台全行业结论 | 不能写成全平台统计或中位数；当前只支持缺口、公开假设和少量样本方向观察。 |
| 薪资待遇 | 可写公开薪资信号和少量样本区间，必须标注非 BOSS 大样本统计。 |
| 能力要求 | 可以写趋势假设和少量样本方向，重点能力仍需用更多岗位详情校验。 |
| 操作边界 | 不自动打开、不刷新、不批量跳转、不投递、不打招呼、不绕过验证。 |

## 六、使用命令

\`\`\`bash
npm run auth:boss
npm run sampling:upgrade-console
npm run import:inbox -- --dry-run
npm run import:inbox -- --refresh
\`\`\`

输出文件：

\`\`\`text
${outputCsvPath}
${outputMdPath}
\`\`\`
`;

writeFileSync(outputMdPath, report);

console.log(`已生成：${outputMdPath}`);
console.log(`已生成：${outputCsvPath}`);
console.log(`赛道：${consoleRows.length}`);
console.log(`BOSS样本总缺口：${totalMissing}`);
console.log(`首批目标导入：${totalFirstTarget}`);
