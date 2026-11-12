#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const jobsPath = join(projectRoot, "01_行情收集/data/jobs.jsonl");
const segmentPath = join(projectRoot, "06_自动化采集/config/ai_company_segments.csv");
const externalSalarySignalsPath = join(projectRoot, "06_自动化采集/config/external_salary_signals.csv");
const outputMdPath = join(projectRoot, "01_行情收集/BOSS薪资能力信号看板.md");
const salaryDetailCsvPath = join(projectRoot, "01_行情收集/BOSS薪资样本明细.csv");
const salaryCsvPath = join(projectRoot, "01_行情收集/BOSS可读薪资样本.csv");
const capabilityCsvPath = join(projectRoot, "01_行情收集/BOSS能力信号样本.csv");

const capabilityTaxonomy = [
  { key: "AI/大模型产品理解", category: "AI能力", aliases: ["大模型", "人工智能", "AIGC", "MaaS", "Maas", "智能体", "Agent", "RAG", "知识库"] },
  { key: "ToB/企业服务销售", category: "商业能力", aliases: ["To B", "ToB", "B2B", "企业服务", "企业（To B）", "企业软件", "SaaS"] },
  { key: "大客户/KA开发", category: "销售能力", aliases: ["大客户", "KA", "重点客户", "行业客户", "客户开拓", "客户开发"] },
  { key: "行业场景理解", category: "行业能力", aliases: ["政企", "金融", "教育", "医疗", "制造", "零售", "汽车", "游戏", "社交", "工具", "行业"] },
  { key: "方案宣讲/解决方案", category: "售前能力", aliases: ["方案宣讲", "解决方案", "方案", "产品汇报", "售前", "技术交流"] },
  { key: "商机挖掘/销售漏斗", category: "销售能力", aliases: ["商机", "线索", "转化", "拓校", "拓展", "销售业绩", "销售市场"] },
  { key: "渠道/生态合作", category: "商业能力", aliases: ["渠道", "代理商", "生态", "合作伙伴", "网盟", "流量资源"] },
  { key: "回款/合同/商务闭环", category: "经营能力", aliases: ["回款", "合同", "签订", "商务", "提成", "业绩目标"] },
  { key: "市场洞察/竞品反馈", category: "经营能力", aliases: ["市场趋势", "市场信息", "动态搜集", "反馈", "竞对", "洞察"] },
  { key: "项目推进/跨部门协同", category: "交付能力", aliases: ["协作", "协同", "推动", "解决问题", "项目", "交付", "上线"] },
  { key: "海外/出海商业化", category: "国际化能力", aliases: ["海外", "东南亚", "欧美", "Google", "Facebook", "Youtube", "TikTok"] },
  { key: "广告/营销技术销售", category: "应用场景", aliases: ["广告", "程序化", "CPA", "CPC", "CPM", "DSP", "SSP", "广告主"] }
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

function csvEscape(value) {
  const text = String(value ?? "");
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function csv(rows) {
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

function readJobs() {
  if (!existsSync(jobsPath)) return [];
  return readFileSync(jobsPath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function readCsvIfExists(filePath) {
  if (!existsSync(filePath)) return [];
  return parseCsv(readFileSync(filePath, "utf8"));
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

function textOfJob(job) {
  return [
    job.title,
    job.company,
    job.salary,
    job.location,
    job.query,
    job.role,
    job.rawText,
    job.detailText
  ].filter(Boolean).join("\n");
}

function segmentForJob(job, segments) {
  const company = job.companyFilter || job.targetCompanyAlias || job.company || "";
  const exact = segments.find((item) => item.company === company);
  if (exact) return exact.segment;
  return segments.find((item) => company && (company.includes(item.company) || item.company.includes(company)))?.segment || "未映射";
}

function rolePosition(job) {
  const text = textOfJob(job);
  if (/销售总监|销售负责人|区域经理|销售经理|销售主管|管理/.test(text)) return "销售管理";
  if (/售前|解决方案|方案顾问|POC|Demo|演示|技术交流/.test(text)) return "售前/解决方案";
  if (/渠道|生态|伙伴|代理商/.test(text)) return "渠道/生态";
  if (/大客户|KA|重点客户|行业客户/.test(text)) return "大客户/行业销售";
  return "销售/商务";
}

function salaryFromMonthlyYuan(text) {
  const match = text.match(/薪资范围[:：]\s*(\d+(?:\.\d+)?)\s*[-~－—]\s*(\d+(?:\.\d+)?)\s*元\s*\/?\s*月/);
  if (!match) return null;
  const low = Number.parseFloat(match[1]) / 1000;
  const high = Number.parseFloat(match[2]) / 1000;
  return {
    lowK: low,
    highK: high,
    label: `${formatK(low)}-${formatK(high)}K`,
    source: "detail_salary_range"
  };
}

function salaryFromK(text) {
  const clean = String(text || "").replaceAll("k", "K");
  if (/[\uE000-\uF8FF]/.test(clean)) return null;
  const match = clean.match(/(\d+(?:\.\d+)?)\s*[-~－—]\s*(\d+(?:\.\d+)?)\s*K/);
  if (!match) return null;
  return {
    lowK: Number.parseFloat(match[1]),
    highK: Number.parseFloat(match[2]),
    label: `${match[1]}-${match[2]}K`,
    source: "standard_k_range"
  };
}

function formatK(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}

function readableSalary(job) {
  const detailFirst = salaryFromMonthlyYuan(job.detailText || "") || salaryFromMonthlyYuan(job.rawText || "");
  if (detailFirst) return detailFirst;
  const standard = salaryFromK(job.salary || "") || salaryFromK(job.rawText || "");
  if (standard) return standard;
  return null;
}

function salaryVisibility(job) {
  if (readableSalary(job)) return "可读";
  if (/[\uE000-\uF8FF]/.test(String(job.salary || ""))) return "BOSS字体混淆";
  if (job.salary) return "非标准格式";
  return "缺失";
}

function includesAny(text, aliases) {
  const lower = text.toLowerCase();
  return aliases.some((alias) => lower.includes(alias.toLowerCase()));
}

function matchedCapabilities(job) {
  const text = textOfJob(job);
  return capabilityTaxonomy
    .filter((capability) => includesAny(text, capability.aliases))
    .map((capability) => capability.key);
}

function countBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item) || "未分类";
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), "zh-Hans-CN"));
}

function salaryStats(rows, keyFn) {
  const groups = new Map();
  for (const row of rows) {
    if (!row.readableSalary) continue;
    const key = keyFn(row) || "未分类";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.entries()]
    .map(([key, values]) => {
      const lows = values.map((item) => item.salaryLowK);
      const highs = values.map((item) => item.salaryHighK);
      return {
        key,
        count: values.length,
        lowMin: Math.min(...lows),
        lowAvg: avg(lows),
        highAvg: avg(highs),
        highMax: Math.max(...highs),
        examples: values.slice(0, 3).map((item) => `${item.company}/${item.title}/${item.readableSalary}`)
      };
    })
    .sort((a, b) => b.count - a.count || b.highAvg - a.highAvg);
}

function avg(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function mdRows(rows, fallback) {
  return rows.length ? rows.join("\n") : fallback;
}

const jobs = readJobs();
const segments = readCsvIfExists(segmentPath);
const externalSalarySignals = readCsvIfExists(externalSalarySignalsPath);

const salaryRows = jobs.map((job) => {
  const extracted = readableSalary(job);
  return {
    id: job.id,
    collectedAt: job.collectedAt || "",
    segment: segmentForJob(job, segments),
    rolePosition: rolePosition(job),
    company: job.company || "",
    title: job.title || "",
    city: job.city || job.location || "",
    bossSalaryRaw: job.salary || "",
    readableSalary: extracted?.label || "",
    salaryLowK: extracted?.lowK || "",
    salaryHighK: extracted?.highK || "",
    salarySource: extracted?.source || "",
    salaryVisibility: salaryVisibility(job),
    url: job.url || job.detailUrl || ""
  };
});

const capabilityRows = jobs.flatMap((job) => {
  const caps = matchedCapabilities(job);
  return caps.map((capability) => ({
    id: job.id,
    segment: segmentForJob(job, segments),
    rolePosition: rolePosition(job),
    company: job.company || "",
    title: job.title || "",
    capability,
    url: job.url || job.detailUrl || ""
  }));
});

const readableRows = salaryRows.filter((row) => row.readableSalary);

mkdirSync(dirname(outputMdPath), { recursive: true });

const salaryHeaders = [
  "id",
  "collectedAt",
  "segment",
  "rolePosition",
  "company",
  "title",
  "city",
  "bossSalaryRaw",
  "readableSalary",
  "salaryLowK",
  "salaryHighK",
  "salarySource",
  "salaryVisibility",
  "url"
];
writeFileSync(
  salaryDetailCsvPath,
  `${csv([salaryHeaders])}\n${csv(salaryRows.map((row) => salaryHeaders.map((header) => row[header])))}\n`
);
writeFileSync(
  salaryCsvPath,
  `${csv([salaryHeaders])}\n${csv(readableRows.map((row) => salaryHeaders.map((header) => row[header])))}\n`
);

const capabilityHeaders = ["id", "segment", "rolePosition", "company", "title", "capability", "url"];
writeFileSync(
  capabilityCsvPath,
  `${csv([capabilityHeaders])}\n${csv(capabilityRows.map((row) => capabilityHeaders.map((header) => row[header])))}\n`
);

const visibilityRows = countBy(salaryRows, (row) => row.salaryVisibility)
  .map(([status, count]) => `| ${status} | ${count} |`);
const salaryBySegmentRows = salaryStats(salaryRows, (row) => row.segment)
  .map((item) => `| ${item.key} | ${item.count} | ${formatK(item.lowMin)}K | ${formatK(item.lowAvg)}K | ${formatK(item.highAvg)}K | ${formatK(item.highMax)}K | ${item.examples.join("；")} |`);
const salaryByRoleRows = salaryStats(salaryRows, (row) => row.rolePosition)
  .map((item) => `| ${item.key} | ${item.count} | ${formatK(item.lowMin)}K | ${formatK(item.lowAvg)}K | ${formatK(item.highAvg)}K | ${formatK(item.highMax)}K | ${item.examples.join("；")} |`);
const capabilitySummaryRows = countBy(capabilityRows, (row) => row.capability)
  .map(([capability, count], index) => {
    const examples = capabilityRows
      .filter((row) => row.capability === capability)
      .slice(0, 3)
      .map((row) => `${row.company}/${row.title}`)
      .join("；");
    return `| ${index + 1} | ${capability} | ${count} | ${Math.round((count / Math.max(1, jobs.length)) * 100)}% | ${examples} |`;
  });
const readableSalaryMdRows = readableRows.map((row) => {
  return `| ${row.segment} | ${row.rolePosition} | ${row.company} | ${row.title} | ${row.readableSalary} | ${row.city} | ${row.salarySource} |`;
});
const externalSalaryRows = externalSalarySignals.map((item) => {
  return `| ${item.segment} | ${item.role} | ${item.company_or_page} | ${item.salary} | ${item.city} | ${item.requirement_signal} |`;
});

const md = `# BOSS薪资能力信号看板

更新时间：${formatDate()}

## 一、本质判断

这份看板不是替代大样本结论，而是先把 BOSS 已采样本里能读出的薪资和能力要求结构化。当前 BOSS 列表薪资存在字体混淆，详情页中的“薪资范围”更可靠；后续每导入一批岗位，都应刷新本看板。

## 二、薪资可读性

| 状态 | 样本数 |
| --- | ---: |
${mdRows(visibilityRows, "| 暂无 | 0 |")}

## 三、BOSS可读薪资样本

| 赛道 | 岗位层级 | 公司 | 岗位 | 可读薪资 | 城市 | 来源 |
| --- | --- | --- | --- | --- | --- | --- |
${mdRows(readableSalaryMdRows, "| 暂无 |  |  |  |  |  |  |")}

## 四、按赛道薪资统计

| 赛道 | 可读样本 | 最低下限 | 平均下限 | 平均上限 | 最高上限 | 样例 |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
${mdRows(salaryBySegmentRows, "| 暂无 | 0 | 0K | 0K | 0K | 0K |  |")}

## 五、按岗位层级薪资统计

| 岗位层级 | 可读样本 | 最低下限 | 平均下限 | 平均上限 | 最高上限 | 样例 |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
${mdRows(salaryByRoleRows, "| 暂无 | 0 | 0K | 0K | 0K | 0K |  |")}

## 六、能力信号

| 排名 | 能力 | 出现次数 | 样本占比 | 样例岗位 |
| ---: | --- | ---: | ---: | --- |
${mdRows(capabilitySummaryRows, "| - | 暂无 | 0 | 0% |  |")}

## 七、公开薪资补充信号

这些信号用于补足当前 BOSS 可读薪资样本不足的问题，不能替代 BOSS 大样本统计。

| 赛道 | 岗位 | 来源页面/公司 | 薪资 | 城市 | 要求信号 |
| --- | --- | --- | --- | --- | --- |
${mdRows(externalSalaryRows, "| 暂无 |  |  |  |  |  |")}

## 八、结论边界

当前 BOSS 已沉淀样本 ${jobs.length} 条，其中可读薪资 ${readableRows.length} 条。这个数量只能支撑“样本信号”，不能支撑最终市场中位数判断。要形成稳定结论，需要每个 P0 赛道至少补足 10 到 12 条可读岗位样本，并优先复制岗位详情页。

## 九、文件

\`\`\`text
${salaryCsvPath}
${salaryDetailCsvPath}
${capabilityCsvPath}
\`\`\`
`;

writeFileSync(outputMdPath, md);

console.log(`已生成：${outputMdPath}`);
console.log(`已生成：${salaryCsvPath}`);
console.log(`已生成：${salaryDetailCsvPath}`);
console.log(`已生成：${capabilityCsvPath}`);
console.log(`BOSS样本：${jobs.length}`);
console.log(`可读薪资：${readableRows.length}`);
