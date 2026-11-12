#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const nextSamplingPath = join(projectRoot, "01_行情收集/BOSS下一轮优先采样清单.csv");
const sampleGapPath = join(projectRoot, "01_行情收集/BOSS全行业样本缺口路线图.csv");
const manualPackPath = join(projectRoot, "01_行情收集/BOSS人工采样作业包.csv");
const companyTypePath = join(projectRoot, "00_行业资料集/AI销售公司类型岗位打法对照表.csv");
const outputMdPath = join(projectRoot, "01_行情收集/BOSS人工补样工作台.md");
const outputCsvPath = join(projectRoot, "01_行情收集/BOSS人工补样工作台.csv");
const safeBossHomeUrl = "https://www.zhipin.com/";

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

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function batchName(row, index) {
  if (row.priority === "P0" && index < 15) return "A-P0首轮补样";
  if (row.priority === "P0") return "B-P0第二轮补样";
  if (row.priority === "P1") return "C-P1扩展补样";
  return "D-P2补充观察";
}

function actionGoal(row, gap) {
  const gapCount = numberOf(gap.sampleGap);
  if (gapCount >= 10) return "先补3条高相关岗位";
  if (gapCount >= 6) return "先补2条高相关岗位";
  return "补1条高相关岗位";
}

function rolePurpose(roleFamily) {
  if (/售前|解决方案/.test(roleFamily)) return "验证售前/方案/POC能力门槛";
  if (/管理|负责人/.test(roleFamily)) return "验证销售管理和团队/区域经营要求";
  if (/渠道|生态/.test(roleFamily)) return "验证渠道生态、伙伴合作和间接销售要求";
  if (/硬件|智算|半导体/.test(roleFamily)) return "验证硬件/算力/半导体销售门槛";
  return "验证销售岗位职责、薪资和能力要求";
}

function routeFromSegment(segment, sampleGapRows, companyTypeRows) {
  return sampleGapRows.find((row) => row.segment === segment)?.route ||
    companyTypeRows.find((row) => row.segment === segment)?.route ||
    "";
}

function safeImportCommand(row) {
  return row.importCommand || [
    "npm run import:manual --",
    '--source "BOSS直聘"',
    `--query "${row.company} ${row.role}"`,
    `--company "${row.company}"`,
    `--role "${row.role}"`,
    `--city "${row.city || "广州"}"`
  ].join(" ");
}

function mdRows(rows, fallback) {
  return rows.length ? rows.join("\n") : fallback;
}

const nextRows = readCsv(nextSamplingPath);
const sampleGapRows = readCsv(sampleGapPath);
const manualRows = readCsv(manualPackPath);
const companyTypeRows = readCsv(companyTypePath);

const gapBySegment = new Map(sampleGapRows.map((row) => [row.segment, row]));
const companyTypeBySegment = new Map(companyTypeRows.map((row) => [row.segment, row]));
const manualByQuery = new Map(manualRows.map((row) => [row.query, row]));

const workRows = nextRows.slice(0, 30).map((row, index) => {
  const gap = gapBySegment.get(row.segment) || {};
  const companyType = companyTypeBySegment.get(row.segment) || {};
  const manual = manualByQuery.get(`${row.company} ${row.role}`) || {};
  const route = routeFromSegment(row.segment, sampleGapRows, companyTypeRows);
  const sampleGap = numberOf(gap.sampleGap);
  const importedJobs = numberOf(gap.importedJobs);
  const targetSamples = numberOf(gap.targetSamples);
  return {
    workOrder: index + 1,
    batch: batchName(row, index),
    priority: row.priority,
    route,
    segment: row.segment,
    companyType: companyType.companyType || "",
    productSold: companyType.productSold || "",
    company: row.company,
    role: row.role,
    roleFamily: row.roleFamily,
    city: row.city || "广州",
    salaryBand: row.salaryBand || gap.salaryBand || "",
    sampleProgress: row.sampleProgress || `${importedJobs}/${targetSamples}`,
    sampleGap,
    actionGoal: actionGoal(row, gap),
    rolePurpose: rolePurpose(row.roleFamily),
    safeBossHomeUrl,
    searchKeyword: row.searchKeyword || `${row.company} ${row.role}`.trim(),
    manualUrl: row.searchUrl || manual.searchUrl || "",
    importCommand: safeImportCommand(row),
    requiredFields: gap.requiredFields || manual.requiredFields || "",
    acceptanceCriteria: gap.acceptanceGate || manual.acceptanceCriteria || "",
    rejectRule: "排除纯研发、运营、客服、行政、无AI/算力/硬件/行业场景相关性的岗位",
    afterImport: "导入后运行 npm run summary:jobs && npm run sampling:status && npm run brief:market"
  };
});

const segmentSummaryRows = sampleGapRows.map((row) => {
  const relatedTasks = workRows.filter((item) => item.segment === row.segment);
  return {
    priority: row.priority,
    route: row.route,
    segment: row.segment,
    sampleProgress: `${row.importedJobs || 0}/${row.targetSamples || 0}`,
    sampleGap: numberOf(row.sampleGap),
    taskCount: relatedTasks.length,
    firstTasks: relatedTasks.slice(0, 4).map((item) => `${item.company}/${item.role}`).join("；"),
    decisionGate: row.decisionGate,
    nextTaskList: row.nextTaskList
  };
});

const routeSummaryRows = unique(sampleGapRows.map((row) => row.route)).map((route) => {
  const rows = sampleGapRows.filter((row) => row.route === route);
  const tasks = workRows.filter((row) => row.route === route);
  return {
    route,
    segments: rows.length,
    importedJobs: rows.reduce((sum, row) => sum + numberOf(row.importedJobs), 0),
    targetSamples: rows.reduce((sum, row) => sum + numberOf(row.targetSamples), 0),
    sampleGap: rows.reduce((sum, row) => sum + numberOf(row.sampleGap), 0),
    taskCount: tasks.length,
    firstTasks: tasks.slice(0, 5).map((item) => `${item.company}/${item.role}`).join("；")
  };
});

const csvHeaders = [
  "workOrder",
  "batch",
  "priority",
  "route",
  "segment",
  "companyType",
  "productSold",
  "company",
  "role",
  "roleFamily",
  "city",
  "salaryBand",
  "sampleProgress",
  "sampleGap",
  "actionGoal",
  "rolePurpose",
  "safeBossHomeUrl",
  "searchKeyword",
  "manualUrl",
  "importCommand",
  "requiredFields",
  "acceptanceCriteria",
  "rejectRule",
  "afterImport"
];

const routeMdRows = routeSummaryRows.map((row) => {
  return `| ${row.route} | ${row.segments} | ${row.importedJobs}/${row.targetSamples} | ${row.sampleGap} | ${row.taskCount} | ${row.firstTasks || "-"} |`;
});

const segmentMdRows = segmentSummaryRows.map((row) => {
  return `| ${row.priority} | ${row.route} | ${row.segment} | ${row.sampleProgress} | ${row.sampleGap} | ${row.taskCount} | ${row.firstTasks || row.nextTaskList || "-"} | ${row.decisionGate} |`;
});

const workMdRows = workRows.map((row) => {
  return `| ${row.workOrder} | ${row.batch} | ${row.priority} | ${row.route} | ${row.segment} | ${row.company} | ${row.role} | ${row.salaryBand || "-"} | ${row.sampleProgress} | ${row.actionGoal} | ${row.safeBossHomeUrl} | \`${row.searchKeyword}\` | \`${row.importCommand}\` |`;
});

mkdirSync(dirname(outputMdPath), { recursive: true });
writeFileSync(outputCsvPath, `${csv([csvHeaders, ...workRows.map((row) => csvHeaders.map((header) => row[header]))])}\n`);

const md = `# BOSS人工补样工作台

更新时间：${formatDate()}

## 一、本质判断

这个工作台不是新增一批自动采集任务，而是把“样本缺口、下一轮优先队列、人工采样包、公司类型打法”合并成一个人工执行界面。当前 BOSS 处于风控恢复期，正确动作是：先打开 BOSS 首页、站内搜索关键词、人工判断岗位相关性、复制岗位卡片或详情页、用 \`import:manual\` 导入。

当前最大的矛盾是：既要尽快补齐 BOSS 大样本，又不能再让脚本替你打开、刷新或跳转 BOSS 页面。

## 二、执行总览

| 指标 | 数值 |
| --- | ---: |
| 本轮工作台任务 | ${workRows.length} |
| 覆盖路线 | ${routeSummaryRows.length} |
| 覆盖赛道 | ${unique(workRows.map((row) => row.segment)).length} |
| P0任务 | ${workRows.filter((row) => row.priority === "P0").length} |
| P1任务 | ${workRows.filter((row) => row.priority === "P1").length} |
| P2任务 | ${workRows.filter((row) => row.priority === "P2").length} |
| 全行业目标样本 | ${sampleGapRows.reduce((sum, row) => sum + numberOf(row.targetSamples), 0)} |
| 当前样本缺口 | ${sampleGapRows.reduce((sum, row) => sum + numberOf(row.sampleGap), 0)} |

## 三、路线级补样压力

| 路线 | 赛道数 | 样本进度 | 样本缺口 | 本轮任务 | 本轮先做 |
| --- | ---: | ---: | ---: | ---: | --- |
${mdRows(routeMdRows, "| 暂无 | 0 | 0/0 | 0 | 0 | - |")}

## 四、赛道级验收

| 优先级 | 路线 | 赛道 | 样本进度 | 缺口 | 本轮任务 | 先做任务 | 结论权限 |
| --- | --- | --- | ---: | ---: | ---: | --- | --- |
${mdRows(segmentMdRows, "| 暂无 |  |  | 0/0 | 0 | 0 | - | - |")}

## 五、本轮30个手工动作

每个动作的执行方式相同：在普通 Chrome 打开 BOSS 首页，站内搜索对应关键词，筛选高相关销售/售前/渠道/销售管理岗位，复制岗位文本，再运行对应导入命令。

| 顺序 | 批次 | 优先级 | 路线 | 赛道 | 公司 | 岗位词 | 薪资观察 | 样本进度 | 本轮目标 | BOSS首页 | 站内搜索关键词 | 导入命令 |
| ---: | --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- | --- |
${mdRows(workMdRows, "| 1 | 暂无 |  |  |  |  |  |  | 0/0 |  |  |  |  |")}

## 六、采样验收规则

1. 只导入销售、售前、解决方案、渠道、销售管理相关岗位。
2. 岗位正文必须能看出 AI、大模型、算力、硬件、半导体、智能制造、数据、云、私有化、行业场景中的至少一个相关信号。
3. 每条导入样本尽量包含公司、岗位、薪资、城市、经验、学历、职责、要求、客户类型、是否管理岗、是否售前/解决方案。
4. 如果同一搜索页没有高相关岗位，不要强行导入，直接换下一条任务。
5. 每补 10 到 20 条样本后，运行：

\`\`\`bash
npm run summary:jobs
npm run sampling:status
npm run sampling:gap
npm run brief:market
npm run report:full
npm run audit:research
\`\`\`

## 七、停止规则

1. 出现安全验证、登录异常、页面跳回 blank，立即停止，不连续重试。
2. 每个站内搜索关键词优先复制 1 到 2 条强相关岗位，不追求一次性翻页。
3. 如果同一赛道已经达到 3 条样本，可以先转向仍为 0 的 P0 赛道。
4. 只有当全行业达到 80 到 200 条高相关 BOSS 样本后，才把市场报告升级为 BOSS 大样本结论。

## 八、CSV输出

\`\`\`text
${outputCsvPath}
\`\`\`
`;

writeFileSync(outputMdPath, md);

console.log(`已生成：${outputMdPath}`);
console.log(`已生成：${outputCsvPath}`);
console.log(`工作台任务：${workRows.length}`);
console.log(`覆盖赛道：${unique(workRows.map((row) => row.segment)).length}`);
