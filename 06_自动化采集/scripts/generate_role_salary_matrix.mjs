#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const segmentPath = join(projectRoot, "06_自动化采集/config/ai_company_segments.csv");
const externalSalarySignalsPath = join(projectRoot, "06_自动化采集/config/external_salary_signals.csv");
const bossReadableSalaryPath = join(projectRoot, "01_行情收集/BOSS可读薪资样本.csv");
const bossCapabilityPath = join(projectRoot, "01_行情收集/BOSS能力信号样本.csv");
const samplingStatusPath = join(projectRoot, "01_行情收集/BOSS采样进度看板.csv");
const outputCsvPath = join(projectRoot, "01_行情收集/AI销售岗位薪资能力矩阵.csv");
const outputMdPath = join(projectRoot, "01_行情收集/AI销售岗位薪资能力矩阵.md");

const segmentPriority = {
  "基座大模型/Agent平台": "P0",
  "云计算/大模型平台": "P0",
  "智能客服/营销/销售AI": "P0",
  "AI芯片/GPU/加速卡": "P0",
  "AI服务器/智算基础设施": "P0",
  "工业AI/智能制造": "P1",
  "AI Agent/RPA/流程自动化": "P1",
  "数据/MLOps/AI基础软件": "P1",
  "智能汽车/机器人/具身智能": "P1",
  "AI安全/私有化/信创": "P1",
  "AI视觉/安防/质检": "P2",
  "智算中心/数据中心服务": "P2"
};

const roleArchetypes = {
  "基座大模型/Agent平台": ["AI软件/大模型销售", "大客户/行业销售经理", "售前/解决方案顾问"],
  "云计算/大模型平台": ["AI软件/大模型销售", "大客户/行业销售经理", "售前/解决方案顾问"],
  "智能客服/营销/销售AI": ["SaaS/应用销售", "销售管理/区域负责人", "渠道/生态/伙伴销售"],
  "AI芯片/GPU/加速卡": ["硬件/智算/半导体行业销售", "大客户/行业销售经理", "渠道/生态/伙伴销售"],
  "AI服务器/智算基础设施": ["硬件/智算/半导体行业销售", "大客户/行业销售经理", "售前/解决方案顾问"],
  "工业AI/智能制造": ["大客户/行业销售经理", "售前/解决方案顾问", "销售管理/区域负责人"],
  "AI Agent/RPA/流程自动化": ["SaaS/应用销售", "大客户/行业销售经理", "售前/解决方案顾问"],
  "数据/MLOps/AI基础软件": ["大客户/行业销售经理", "售前/解决方案顾问", "SaaS/应用销售"],
  "智能汽车/机器人/具身智能": ["硬件/智算/半导体行业销售", "渠道/生态/伙伴销售", "销售管理/区域负责人"],
  "AI安全/私有化/信创": ["大客户/行业销售经理", "渠道/生态/伙伴销售", "售前/解决方案顾问"],
  "AI视觉/安防/质检": ["大客户/行业销售经理", "渠道/生态/伙伴销售", "售前/解决方案顾问"],
  "智算中心/数据中心服务": ["硬件/智算/半导体行业销售", "大客户/行业销售经理", "渠道/生态/伙伴销售"]
};

const roleCapabilityMap = {
  "AI软件/大模型销售": ["AI/大模型产品理解", "ToB/企业服务销售", "商机挖掘/销售漏斗", "方案宣讲/解决方案"],
  "SaaS/应用销售": ["ToB/企业服务销售", "商机挖掘/销售漏斗", "回款/合同/商务闭环", "项目推进/跨部门协同"],
  "大客户/行业销售经理": ["大客户/KA开发", "行业场景理解", "回款/合同/商务闭环", "市场洞察/竞品反馈"],
  "售前/解决方案顾问": ["方案宣讲/解决方案", "AI/大模型产品理解", "项目推进/跨部门协同", "行业场景理解"],
  "渠道/生态/伙伴销售": ["渠道/生态合作", "市场洞察/竞品反馈", "回款/合同/商务闭环", "项目推进/跨部门协同"],
  "销售管理/区域负责人": ["大客户/KA开发", "回款/合同/商务闭环", "市场洞察/竞品反馈", "项目推进/跨部门协同"],
  "硬件/智算/半导体行业销售": ["大客户/KA开发", "行业场景理解", "渠道/生态合作", "方案宣讲/解决方案"]
};

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

function priorityRank(priority) {
  return { P0: 0, P1: 1, P2: 2 }[priority] ?? 9;
}

function canonicalSegment(value) {
  const text = String(value || "");
  if (/基座大模型\/Agent平台/.test(text)) return "基座大模型/Agent平台";
  if (/云计算\/大模型平台/.test(text)) return "云计算/大模型平台";
  if (/智能客服\/营销\/销售AI/.test(text)) return "智能客服/营销/销售AI";
  if (/AI芯片\/GPU\/加速卡/.test(text)) return "AI芯片/GPU/加速卡";
  if (/AI服务器\/智算基础设施/.test(text)) return "AI服务器/智算基础设施";
  if (/工业AI\/智能制造/.test(text)) return "工业AI/智能制造";
  if (/AI Agent\/RPA\/流程自动化|RPA|流程自动化/.test(text)) return "AI Agent/RPA/流程自动化";
  if (/智算中心\/数据中心服务|IDC|数据中心|智算中心/.test(text)) return "智算中心/数据中心服务";
  if (/AI视觉\/安防\/质检|视觉|安防|质检/.test(text)) return "AI视觉/安防/质检";
  if (/AI安全\/私有化\/信创|安全|信创|私有化/.test(text)) return "AI安全/私有化/信创";
  if (/云计算|大模型平台|阿里云|MaaS|Maas/.test(text)) return "云计算/大模型平台";
  if (/基座|大模型产品|AI软件|人工智能软件|数字人/.test(text)) return "基座大模型/Agent平台";
  if (/客服|营销|GEO|销售AI|智能体|SaaS出海/.test(text)) return "智能客服/营销/销售AI";
  if (/芯片|GPU|加速卡|半导体/.test(text)) return "AI芯片/GPU/加速卡";
  if (/服务器|智算基础|AI服务器/.test(text)) return "AI服务器/智算基础设施";
  if (/工业|智能制造|制造行业/.test(text)) return "工业AI/智能制造";
  if (/大数据|MLOps|数据/.test(text)) return "数据/MLOps/AI基础软件";
  if (/汽车|机器人|具身|智能硬件/.test(text)) return "智能汽车/机器人/具身智能";
  return text || "未映射";
}

function inferRole(value) {
  const text = String(value || "");
  if (/总监|负责人|管理|区域销售经理|销售经理/.test(text)) return "销售管理/区域负责人";
  if (/售前|解决方案|顾问|方案/.test(text)) return "售前/解决方案顾问";
  if (/渠道|生态|伙伴|代理/.test(text)) return "渠道/生态/伙伴销售";
  if (/芯片|硬件|服务器|智算|IDC|数据中心/.test(text)) return "硬件/智算/半导体行业销售";
  if (/大客户|KA|客户经理|行业/.test(text)) return "大客户/行业销售经理";
  if (/SaaS|软件|智能体|应用/.test(text)) return "SaaS/应用销售";
  if (/AI|大模型|人工智能|MaaS|Maas/.test(text)) return "AI软件/大模型销售";
  return "销售/商务";
}

function salaryRange(value) {
  const text = String(value || "").replace(/k/g, "K").replace(/月/g, "");
  const match = text.match(/(\d+(?:\.\d+)?)\s*[-~－—]\s*(\d+(?:\.\d+)?)\s*K/);
  if (match) {
    return {
      low: Number.parseFloat(match[1]),
      high: Number.parseFloat(match[2])
    };
  }
  const annualMatch = text.match(/(\d+(?:\.\d+)?)\s*[-~－—]\s*(\d+(?:\.\d+)?)\s*W\s*\/?\s*年/i);
  if (annualMatch) {
    return {
      low: Number.parseFloat(annualMatch[1]) * 10 / 12,
      high: Number.parseFloat(annualMatch[2]) * 10 / 12
    };
  }
  const yuanMatch = text.match(/(\d+(?:\.\d+)?)\s*[-~－—]\s*(\d+(?:\.\d+)?)\s*元/);
  if (yuanMatch) {
    return {
      low: Number.parseFloat(yuanMatch[1]) / 1000,
      high: Number.parseFloat(yuanMatch[2]) / 1000
    };
  }
  return null;
}

function formatK(value) {
  if (!Number.isFinite(value)) return "";
  return `${Number.isInteger(value) ? value : value.toFixed(1).replace(/\.0$/, "")}K`;
}

function salaryLabel(ranges) {
  if (!ranges.length) return "待BOSS样本校验";
  const lows = ranges.map((range) => range.low);
  const highs = ranges.map((range) => range.high);
  return `${formatK(Math.min(...lows))}-${formatK(Math.max(...highs))}`;
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function capabilityFromText(value) {
  const text = String(value || "");
  const caps = [];
  if (/AI|大模型|人工智能|MaaS|Maas|智能体|Agent|数字人/.test(text)) caps.push("AI/大模型产品理解");
  if (/ToB|中大客户|企业|SaaS|软件/.test(text)) caps.push("ToB/企业服务销售");
  if (/大客户|KA|客户经理|行业客户|重点客户/.test(text)) caps.push("大客户/KA开发");
  if (/制造|政企|金融|教育|医疗|汽车|游戏|行业/.test(text)) caps.push("行业场景理解");
  if (/方案|解决方案|售前|产品汇报|API|模型微调/.test(text)) caps.push("方案宣讲/解决方案");
  if (/渠道|生态|伙伴|代理|流量/.test(text)) caps.push("渠道/生态合作");
  if (/回款|合同|成交|商务|销售/.test(text)) caps.push("回款/合同/商务闭环");
  if (/海外|出海|东南亚|欧美/.test(text)) caps.push("海外/出海商业化");
  return caps;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function countBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item) || "未分类";
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function topValues(values, limit = 8) {
  return countBy(values, (item) => item)
    .slice(0, limit)
    .map(([value]) => value);
}

function mdRows(rows, fallback) {
  return rows.length ? rows.join("\n") : fallback;
}

const segments = readCsvIfExists(segmentPath);
const externalSalarySignals = readCsvIfExists(externalSalarySignalsPath);
const bossSalaryRows = readCsvIfExists(bossReadableSalaryPath);
const bossCapabilityRows = readCsvIfExists(bossCapabilityPath);
const samplingStatusRows = readCsvIfExists(samplingStatusPath);
const canonicalSegments = Object.keys(segmentPriority);

const segmentInfo = new Map(canonicalSegments.map((segment) => {
  const companies = segments
    .filter((item) => item.segment === segment)
    .sort((a, b) => Number(a.priority || 99) - Number(b.priority || 99));
  const sampling = samplingStatusRows.find((item) => item.segment === segment) || {};
  return [segment, {
    companies,
    sampling,
    salesFits: unique(companies.flatMap((item) => String(item.sales_fit || "").split(";"))),
    keywords: unique(companies.flatMap((item) => String(item.keywords || "").split(";")))
  }];
}));

const salaryEvidence = [
  ...externalSalarySignals.map((item) => {
    const segment = canonicalSegment([item.segment, item.role, item.requirement_signal, item.company_or_page].join(" "));
    const role = inferRole([item.role, item.requirement_signal, item.segment].join(" "));
    const range = salaryRange(item.salary);
    return {
      source: item.platform || "公开信号",
      segment,
      role,
      salary: item.salary,
      range,
      requirement: item.requirement_signal || "",
      example: `${item.company_or_page || ""}/${item.role || ""}`
    };
  }),
  ...bossSalaryRows.map((item) => {
    const segment = canonicalSegment(item.segment);
    const role = inferRole([item.rolePosition, item.title].join(" "));
    const range = salaryRange(item.readableSalary);
    return {
      source: "BOSS已采样本",
      segment,
      role,
      salary: item.readableSalary,
      range,
      requirement: "",
      example: `${item.company || ""}/${item.title || ""}`
    };
  })
].filter((item) => canonicalSegments.includes(item.segment));

const matrixRows = [];
for (const segment of canonicalSegments) {
  const info = segmentInfo.get(segment);
  const roles = roleArchetypes[segment] || ["销售/商务"];
  for (const role of roles) {
    const matchedEvidence = salaryEvidence.filter((item) => item.segment === segment && (item.role === role || role === "大客户/行业销售经理" && /大客户|行业|销售管理/.test(item.role)));
    const segmentEvidence = salaryEvidence.filter((item) => item.segment === segment);
    const evidenceForSalary = matchedEvidence.length ? matchedEvidence : segmentEvidence;
    const ranges = evidenceForSalary.map((item) => item.range).filter(Boolean);
    const caps = unique([
      ...(roleCapabilityMap[role] || []),
      ...info.salesFits.map((item) => capabilityFromText(item)).flat(),
      ...matchedEvidence.map((item) => capabilityFromText(item.requirement)).flat(),
      ...bossCapabilityRows
        .filter((item) => canonicalSegment(item.segment) === segment && inferRole([item.rolePosition, item.title].join(" ")) === role)
        .map((item) => item.capability)
    ]);
    const examples = evidenceForSalary.slice(0, 4).map((item) => `${item.source}:${item.example} ${item.salary}`).join("; ");
    const targetSamples = Number.parseInt(info.sampling.targetSamples || "0", 10) || 0;
    const importedJobs = Number.parseInt(info.sampling.importedJobs || "0", 10) || 0;
    const sampleGap = Number.parseInt(info.sampling.sampleGap || "0", 10) || Math.max(0, targetSamples - importedJobs);
    matrixRows.push({
      priority: segmentPriority[segment],
      segment,
      role,
      companyCount: info.companies.length,
      topCompanies: info.companies.slice(0, 6).map((item) => item.company).join(";"),
      salaryBand: salaryLabel(ranges),
      salaryEvidenceCount: evidenceForSalary.filter((item) => item.range).length,
      salaryLowAvg: ranges.length ? formatK(average(ranges.map((item) => item.low))) : "",
      salaryHighAvg: ranges.length ? formatK(average(ranges.map((item) => item.high))) : "",
      coreCapabilities: topValues(caps, 6).join(";"),
      sampleProgress: targetSamples ? `${importedJobs}/${targetSamples}` : "待设定",
      sampleGap,
      evidenceExamples: examples,
      nextAction: `优先补 ${info.companies.slice(0, 3).map((item) => item.company).join("/")} 的 ${role} 岗位`
    });
  }
}

matrixRows.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || b.sampleGap - a.sampleGap || a.segment.localeCompare(b.segment, "zh-Hans-CN") || a.role.localeCompare(b.role, "zh-Hans-CN"));

mkdirSync(dirname(outputCsvPath), { recursive: true });

const headers = [
  "priority",
  "segment",
  "role",
  "companyCount",
  "topCompanies",
  "salaryBand",
  "salaryEvidenceCount",
  "salaryLowAvg",
  "salaryHighAvg",
  "coreCapabilities",
  "sampleProgress",
  "sampleGap",
  "evidenceExamples",
  "nextAction"
];
writeFileSync(outputCsvPath, `${csv([headers])}\n${csv(matrixRows.map((row) => headers.map((header) => row[header])))}\n`);

const prioritySummaryRows = ["P0", "P1", "P2"].map((priority) => {
  const rows = matrixRows.filter((row) => row.priority === priority);
  const segmentsInPriority = unique(rows.map((row) => row.segment)).length;
  const roles = rows.length;
  const evidence = rows.reduce((sum, row) => sum + Number(row.salaryEvidenceCount || 0), 0);
  const gap = unique(rows.map((row) => `${row.segment}:${row.sampleGap}`))
    .reduce((sum, item) => sum + Number(item.split(":").pop() || 0), 0);
  return `| ${priority} | ${segmentsInPriority} | ${roles} | ${evidence} | ${gap} |`;
});

const matrixMdRows = matrixRows.map((row) => {
  return `| ${row.priority} | ${row.segment} | ${row.role} | ${row.salaryBand} | ${row.salaryEvidenceCount} | ${row.coreCapabilities} | ${row.sampleProgress} | ${row.nextAction} |`;
});

const highValueRows = matrixRows
  .filter((row) => row.salaryEvidenceCount > 0 || row.priority === "P0")
  .slice(0, 18)
  .map((row) => `| ${row.segment} | ${row.role} | ${row.salaryBand} | ${row.salaryLowAvg || "-"} | ${row.salaryHighAvg || "-"} | ${row.evidenceExamples || "待补样本"} |`);

const md = `# AI销售岗位薪资能力矩阵

更新时间：${formatDate()}

## 一、本质判断

这份矩阵不是岗位列表，而是把“AI行业赛道、岗位层级、薪资观察、能力要求、采样缺口”合并成一张决策表。它用于判断下一步该优先补哪些岗位样本，以及简历应该围绕哪些能力建立证据。

## 二、优先级汇总

| 优先级 | 赛道数 | 岗位层级行 | 薪资证据点 | BOSS样本缺口 |
| --- | ---: | ---: | ---: | ---: |
${mdRows(prioritySummaryRows, "| 暂无 | 0 | 0 | 0 | 0 |")}

## 三、岗位薪资能力矩阵

| 优先级 | 赛道 | 岗位层级 | 薪资观察区间 | 薪资证据点 | 核心能力 | BOSS样本进度 | 下一步采样 |
| --- | --- | --- | --- | ---: | --- | ---: | --- |
${mdRows(matrixMdRows, "| 暂无 |  |  |  | 0 |  |  |  |")}

## 四、高价值岗位观察

| 赛道 | 岗位层级 | 薪资观察区间 | 平均下限 | 平均上限 | 证据样例 |
| --- | --- | --- | ---: | ---: | --- |
${mdRows(highValueRows, "| 暂无 |  |  | - | - |  |")}

## 五、使用方法

1. 先补 P0 中“样本缺口大、薪资证据少”的岗位层级。
2. 每导入 10 条 BOSS 岗位后运行 \`npm run salary:signals && npm run matrix:roles && npm run audit:research\`。
3. 当某个赛道达到 10 到 12 条 BOSS 样本后，再把“薪资观察区间”升级为更稳定的薪资判断。
4. 简历匹配时，优先把矩阵里的核心能力改写成可证明项目，而不是只堆关键词。

## 六、边界

当前矩阵合并了公开薪资信号 ${externalSalarySignals.length} 条、BOSS可读薪资 ${bossSalaryRows.length} 条、公司赛道池 ${segments.length} 家。由于 BOSS 大样本仍不足，矩阵里的薪资是观察区间，不是最终中位数。

## 七、文件

\`\`\`text
${outputCsvPath}
\`\`\`
`;

writeFileSync(outputMdPath, md);

console.log(`已生成：${outputCsvPath}`);
console.log(`已生成：${outputMdPath}`);
console.log(`矩阵行数：${matrixRows.length}`);
console.log(`薪资证据：${salaryEvidence.filter((item) => item.range).length}`);
