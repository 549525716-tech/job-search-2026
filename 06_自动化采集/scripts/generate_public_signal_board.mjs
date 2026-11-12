#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const publicMarketSourcesPath = join(projectRoot, "06_自动化采集/config/public_market_sources.csv");
const segmentPath = join(projectRoot, "06_自动化采集/config/ai_company_segments.csv");
const samplingStatusPath = join(projectRoot, "01_行情收集/BOSS采样进度看板.csv");
const outputMdPath = join(projectRoot, "01_行情收集/AI行业公开趋势信号看板.md");
const outputCsvPath = join(projectRoot, "01_行情收集/AI行业公开趋势信号看板.csv");

const segmentRules = [
  { segment: "基座大模型/Agent平台", aliases: ["大模型", "模型层", "MaaS", "Agent", "智能助手", "模型平台"] },
  { segment: "云计算/大模型平台", aliases: ["公有云", "云", "MaaS", "API", "模型调用", "私有化"] },
  { segment: "AI芯片/GPU/加速卡", aliases: ["芯片", "GPU", "半导体", "加速", "算力芯片"] },
  { segment: "AI服务器/智算基础设施", aliases: ["服务器", "基础设施", "智能算力", "液冷", "绿色算力"] },
  { segment: "智算中心/数据中心服务", aliases: ["智算中心", "AIDC", "IDC", "数据中心", "算力调度"] },
  { segment: "工业AI/智能制造", aliases: ["工业", "制造", "产线", "工业智算", "制造业"] },
  { segment: "智能汽车/机器人/具身智能", aliases: ["具身智能", "机器人", "智能硬件", "汽车", "车"] },
  { segment: "智能客服/营销/销售AI", aliases: ["智能客服", "营销", "销售AI", "GEO", "客户联络", "坐席", "增长转化"] },
  { segment: "AI Agent/RPA/流程自动化", aliases: ["Agent", "流程", "RPA", "智能自动化"] },
  { segment: "数据/MLOps/AI基础软件", aliases: ["数据", "MLOps", "平台层", "技术层"] },
  { segment: "AI安全/私有化/信创", aliases: ["安全", "合规", "私有化", "政务", "信创"] },
  { segment: "AI视觉/安防/质检", aliases: ["视觉", "质检", "安防"] }
];

const capabilityRules = [
  { key: "AI/大模型产品理解", aliases: ["AI", "大模型", "AIGC", "模型", "智能"] },
  { key: "行业场景理解", aliases: ["行业", "场景", "制造", "金融", "政务", "医疗", "教育"] },
  { key: "大客户/政企销售", aliases: ["大客户", "政企", "客户结构", "高级管理", "商务"] },
  { key: "解决方案/售前表达", aliases: ["解决方案", "MaaS", "私有化", "方案", "行业落地"] },
  { key: "硬件/智算链路理解", aliases: ["芯片", "服务器", "智算", "AIDC", "IDC", "算力"] },
  { key: "生态/渠道合作", aliases: ["生态", "伙伴", "渠道", "产业链"] },
  { key: "客户成功/续费/增长", aliases: ["应用", "商业化", "续费", "增长", "SaaS"] }
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

function matches(text, aliases) {
  return aliases.some((alias) => text.includes(alias));
}

function inferSegments(row) {
  const text = [row.topic, row.key_signal, row.sales_implication].join(" ");
  const matched = segmentRules.filter((rule) => matches(text, rule.aliases)).map((rule) => rule.segment);
  return matched.length ? [...new Set(matched)] : ["全行业AI岗位"];
}

function inferCapabilities(row) {
  const text = [row.topic, row.key_signal, row.sales_implication].join(" ");
  const matched = capabilityRules.filter((rule) => matches(text, rule.aliases)).map((rule) => rule.key);
  return matched.length ? [...new Set(matched)] : ["AI行业趋势理解"];
}

function priorityScore(row, segments) {
  const text = [row.topic, row.key_signal, row.sales_implication].join(" ");
  let score = 40;
  if (/销售|商务|管理|大客户|政企/.test(text)) score += 20;
  if (/芯片|半导体|服务器|智算|AIDC|IDC|算力/.test(text)) score += 15;
  if (/大模型|MaaS|Agent|应用|SaaS|私有化/.test(text)) score += 15;
  if (/工业|制造|实体经济/.test(text)) score += 10;
  score += Math.min(10, segments.length * 2);
  return Math.min(100, score);
}

function priorityLabel(score) {
  if (score >= 80) return "P0直接进入采样策略";
  if (score >= 65) return "P1作为赛道校验";
  return "P2作为背景信号";
}

function sampleStatusForSegment(segment, samplingRows) {
  const row = samplingRows.find((item) => item.segment === segment);
  if (!row) return "未进入采样看板";
  return `${row.currentSamples || 0}/${row.targetSamples || 0} 样本，缺口 ${row.sampleGap || 0}`;
}

function mdRows(rows, fallback) {
  return rows.length ? rows.join("\n") : fallback;
}

const publicSources = readCsvIfExists(publicMarketSourcesPath);
const companies = readCsvIfExists(segmentPath);
const samplingRows = readCsvIfExists(samplingStatusPath);

const evidenceRows = publicSources.map((row) => {
  const segments = inferSegments(row);
  const capabilities = inferCapabilities(row);
  const score = priorityScore(row, segments);
  return {
    source: row.source,
    year: row.year,
    topic: row.topic,
    priority: priorityLabel(score),
    score,
    segments: segments.join(";"),
    capabilities: capabilities.join(";"),
    keySignal: row.key_signal,
    salesImplication: row.sales_implication,
    url: row.url
  };
}).sort((a, b) => b.score - a.score || a.topic.localeCompare(b.topic, "zh-Hans-CN"));

const allSegments = [...new Set(companies.map((item) => item.segment).filter(Boolean))];
const segmentRows = allSegments.map((segment) => {
  const evidence = evidenceRows.filter((row) => row.segments.includes(segment));
  const segmentCompanies = companies.filter((item) => item.segment === segment);
  const topCompanies = segmentCompanies.slice(0, 8).map((item) => item.company).join("、");
  const capabilitySet = [...new Set(evidence.flatMap((item) => item.capabilities.split(";").filter(Boolean)))];
  const p0Count = evidence.filter((item) => item.priority.startsWith("P0")).length;
  return {
    segment,
    evidenceCount: evidence.length,
    p0Count,
    sampleStatus: sampleStatusForSegment(segment, samplingRows),
    topCompanies,
    capabilities: capabilitySet.slice(0, 6).join(";") || "待补趋势证据",
    nextAction: evidence.length
      ? `优先用 ${segmentCompanies.slice(0, 3).map((item) => item.company).join("、")} 做公司名+岗位词采样`
      : "作为补充赛道，待核心赛道采样后再扩展"
  };
}).sort((a, b) => b.p0Count - a.p0Count || b.evidenceCount - a.evidenceCount || a.segment.localeCompare(b.segment, "zh-Hans-CN"));

mkdirSync(dirname(outputMdPath), { recursive: true });

const evidenceHeaders = ["source", "year", "topic", "priority", "score", "segments", "capabilities", "keySignal", "salesImplication", "url"];
writeFileSync(outputCsvPath, `${csv([evidenceHeaders])}\n${csv(evidenceRows.map((row) => evidenceHeaders.map((header) => row[header])))}\n`);

const evidenceMdRows = evidenceRows.map((row, index) => {
  return `| ${index + 1} | ${row.priority} | ${row.topic} | ${row.segments} | ${row.capabilities} | ${row.salesImplication} | [来源](${row.url}) |`;
});

const segmentMdRows = segmentRows.map((row, index) => {
  return `| ${index + 1} | ${row.segment} | ${row.evidenceCount} | ${row.p0Count} | ${row.sampleStatus} | ${row.capabilities} | ${row.topCompanies} | ${row.nextAction} |`;
});

const md = `# AI行业公开趋势信号看板

更新时间：${formatDate()}

## 一、本质判断

这份看板不是新增岗位样本，而是把公开趋势信号转成 BOSS 采样优先级。它解决的问题是：在 BOSS 大样本不足时，先用产业趋势判断哪些赛道更值得优先补样。

## 二、核心结论

1. AI销售机会已经从“AI软件公司”扩散到云平台、智算中心、芯片服务器、工业AI、智能硬件和行业应用。
2. 岗位能力不只是销售话术，而是“AI产品理解 + 行业场景 + 大客户推进 + 方案表达 + 商务闭环”。
3. 高薪线索更容易集中在云和大模型平台、工业AI、AI硬件/智算、出海和智能硬件负责人岗。
4. 当前 BOSS 样本不足，公开趋势只能用于排序和假设，不能替代登录态岗位样本。

## 三、趋势证据到采样优先级

| 序号 | 优先级 | 主题 | 映射赛道 | 能力信号 | 对采样的含义 | 来源 |
| ---: | --- | --- | --- | --- | --- | --- |
${mdRows(evidenceMdRows, "| 暂无 |  |  |  |  |  |  |")}

## 四、赛道采样优先级

| 序号 | 赛道 | 趋势证据数 | P0证据数 | 当前采样状态 | 能力关键词 | 代表公司 | 下一步动作 |
| ---: | --- | ---: | ---: | --- | --- | --- | --- |
${mdRows(segmentMdRows, "| 暂无 |  | 0 | 0 |  |  |  |  |")}

## 五、使用方式

1. 先处理 P0 证据对应赛道：云/大模型平台、AI芯片与服务器、智算中心、工业AI、智能客服/营销/销售AI。
2. 每个赛道先人工采 10 到 12 条 BOSS 岗位详情，再刷新薪资能力矩阵。
3. 若某赛道 BOSS 搜索结果不足，先保留为“公开趋势强、BOSS待验证”，不要把趋势当成岗位事实。

## 六、文件

\`\`\`text
${outputCsvPath}
\`\`\`
`;

writeFileSync(outputMdPath, md);

console.log(`已生成：${outputMdPath}`);
console.log(`已生成：${outputCsvPath}`);
console.log(`公开趋势源：${publicSources.length}`);
