#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const processedDir = join(projectRoot, "01_行情收集/data/processed");
const jobsPath = join(projectRoot, "01_行情收集/data/jobs.jsonl");
const segmentPath = join(projectRoot, "06_自动化采集/config/ai_company_segments.csv");
const outputCsvPath = join(projectRoot, "01_行情收集/BOSS历史缓存候选线索库.csv");
const outputMdPath = join(projectRoot, "01_行情收集/BOSS历史缓存候选线索库.md");

const inferredBossGlyphDigits = {
  "\uE031": "0",
  "\uE032": "1",
  "\uE033": "2",
  "\uE034": "3",
  "\uE035": "4",
  "\uE036": "5",
  "\uE037": "6",
  "\uE038": "7",
  "\uE039": "8",
  "\uE03A": "9"
};

const capabilityTaxonomy = [
  { key: "AI/大模型产品理解", aliases: ["AI", "人工智能", "大模型", "MaaS", "Maas", "AIGC", "LLM", "智能体", "Agent", "RAG"] },
  { key: "云/算力/基础设施理解", aliases: ["云服务", "公共云", "云计算", "算力", "GPU", "服务器", "IDC", "数据中心"] },
  { key: "ToB/企业服务销售", aliases: ["To B", "ToB", "企业服务", "SaaS", "软件销售", "企业软件", "B端"] },
  { key: "大客户/行业客户开发", aliases: ["大客户", "KA", "行业客户", "客户开拓", "客户开发", "政企", "金融", "制造"] },
  { key: "解决方案/售前协同", aliases: ["解决方案", "售前", "POC", "Demo", "演示", "技术交流", "方案"] },
  { key: "商机推进/签约回款", aliases: ["商机", "签约", "回款", "合同", "销售漏斗", "转化", "业绩"] },
  { key: "渠道/生态合作", aliases: ["渠道", "生态", "伙伴", "代理商", "合作伙伴"] },
  { key: "团队/区域销售管理", aliases: ["团队管理", "销售管理", "区域", "负责人", "总监", "主管"] }
];

const aiProductPattern = /(?<![A-Za-z])AI(?![A-Za-z])|人工智能|大模型|MaaS|Maas|AIGC|LLM|智能体|Agent|RAG/iu;
const cloudHardwarePattern = /云服务|公共云|云计算|算力|GPU|芯片|半导体|服务器|智算|工业自动化|SaaS|软件/u;
const salesPattern = /销售|商务|客户|BD|渠道|市场|售前|解决方案|Sales/iu;

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

function readJsonl(filePath) {
  if (!existsSync(filePath)) return [];
  return readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function candidateCacheFiles() {
  if (!existsSync(processedDir)) return [];
  return readdirSync(processedDir)
    .filter((name) => name.startsWith("jobs_before_company_filter_") && name.endsWith(".jsonl"))
    .map((name) => join(processedDir, name))
    .sort((a, b) => statSync(a).mtimeMs - statSync(b).mtimeMs);
}

function readCleanJobs() {
  return readJsonl(jobsPath);
}

function textOf(row, includeQuery = true) {
  return [
    includeQuery ? row.query : "",
    row.title,
    row.company,
    row.companyFilter,
    row.role,
    row.roleFamily,
    row.location,
    row.rawText,
    row.detailText
  ].filter(Boolean).join("\n");
}

function bodyTextOf(row) {
  return [
    row.title,
    row.company,
    row.location,
    row.rawText,
    row.detailText
  ].filter(Boolean).join("\n");
}

function includesAny(text, aliases) {
  return aliases.some((alias) => {
    if (alias === "AI") return /(?<![A-Za-z])AI(?![A-Za-z])/iu.test(text);
    return text.toLowerCase().includes(alias.toLowerCase());
  });
}

function decodeBossGlyphSalary(value) {
  const text = String(value || "");
  if (!/[\uE000-\uF8FF]/.test(text)) return "";
  let decoded = "";
  let unknown = false;
  for (const char of text) {
    if (inferredBossGlyphDigits[char]) decoded += inferredBossGlyphDigits[char];
    else if (/[\uE000-\uF8FF]/.test(char)) {
      decoded += "?";
      unknown = true;
    } else decoded += char;
  }
  return unknown ? `${decoded}（部分字体未映射）` : `${decoded}（字体推断）`;
}

function salaryVisibility(row) {
  if (decodeBossGlyphSalary(row.salary)) return "字体推断";
  if (/\d+\s*-\s*\d+\s*K/i.test(String(row.salary || ""))) return "可读";
  if (row.salary) return "非标准";
  return "缺失";
}

function roleFamily(row) {
  const text = bodyTextOf(row);
  if (/销售总监|销售负责人|团队管理|区域负责人|区域经理|销售管理|主管/.test(text)) return "销售管理/区域负责人";
  if (/售前|解决方案|方案顾问|POC|Demo|演示|技术交流|技术销售/.test(text)) return "售前/解决方案";
  if (/渠道|生态|伙伴|代理商/.test(text)) return "渠道/生态销售";
  if (/大客户|KA|行业客户|客户经理|销售经理|销售顾问/.test(text)) return "大客户/行业销售";
  if (/商务|BD|销售|客户/.test(text)) return "销售/商务";
  if (/市场|海外市场/.test(text)) return "市场/海外商业化";
  return row.roleFamily || "未分类";
}

function segmentFor(row, segments) {
  const candidates = [
    row.company
  ].filter(Boolean);
  for (const candidate of candidates) {
    const exact = segments.find((item) => item.company === candidate);
    if (exact) return exact.segment;
    const loose = segments.find((item) => candidate.includes(item.company) || item.company.includes(candidate));
    if (loose) return loose.segment;
  }

  const text = bodyTextOf(row);
  if (/MaaS|Maas|公共云|云服务|云计算|大模型平台/.test(text)) return "云计算/大模型平台";
  if (/大模型|智能体|Agent|LLM|RAG|AI产品|人工智能软件/.test(text)) return "基座大模型/Agent平台";
  if (/SaaS|CRM|客服|营销|电商AI/.test(text)) return "智能客服/营销/销售AI";
  if (/芯片|半导体|GPU|加速卡/.test(text)) return "AI芯片/GPU/加速卡";
  if (/服务器|智算|算力|IDC|数据中心/.test(text)) return "AI服务器/智算基础设施";
  if (/工业|制造|自动化|产线|质检/.test(text)) return "工业AI/智能制造";
  return "待人工确认";
}

function capabilitySignals(row) {
  const text = bodyTextOf(row);
  return capabilityTaxonomy
    .filter((capability) => includesAny(text, capability.aliases))
    .map((capability) => capability.key)
    .slice(0, 6)
    .join(";");
}

function relevance(row) {
  const bodyText = bodyTextOf(row);
  const allText = textOf(row, true);
  let score = 0;
  const reasons = [];

  if (aiProductPattern.test(bodyText)) {
    score += 35;
    reasons.push("岗位文本含AI/大模型");
  }
  if (cloudHardwarePattern.test(bodyText)) {
    score += 20;
    reasons.push("岗位文本含云/硬件/工业AI线索");
  }
  if (salesPattern.test(bodyText)) {
    score += 25;
    reasons.push("岗位文本含销售/商业化职责");
  }
  if (String(row.detailText || "").length > 500) {
    score += 15;
    reasons.push("有岗位详情文本");
  }
  if (String(row.url || "").includes("job_detail")) {
    score += 5;
    reasons.push("有岗位详情链接");
  }
  if (/算法|研发|开发工程师|测试|实习生/.test(String(row.title || "")) && !/销售|商业|客户|售前|解决方案/.test(String(row.title || ""))) {
    score -= 35;
    reasons.push("标题偏技术岗");
  }
  if (!aiProductPattern.test(bodyText) && !cloudHardwarePattern.test(bodyText)
    && /AI|智能云|大模型/.test(String(row.query || ""))) {
    score -= 10;
    reasons.push("AI线索主要来自查询词，需人工确认");
  }
  if (salesPattern.test(allText) && !salesPattern.test(bodyText)) {
    score -= 20;
    reasons.push("销售线索主要来自查询词，需人工确认");
  }

  const clamped = Math.max(0, Math.min(100, score));
  let level = "剔除/低相关";
  if (clamped >= 70) level = "高价值候选";
  else if (clamped >= 45) level = "待人工确认";

  return { score: clamped, level, reasons: reasons.join(";") };
}

function bestByUrl(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = row.url || `${row.title}|${row.company}|${row.salary}`;
    const prev = map.get(key);
    if (!prev || String(row.detailText || "").length > String(prev.detailText || "").length) {
      map.set(key, row);
    }
  }
  return [...map.values()];
}

function countBy(rows, keyFn) {
  const map = new Map();
  for (const row of rows) {
    const key = keyFn(row) || "未分类";
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), "zh-Hans-CN"));
}

function mdRows(rows, fallback) {
  return rows.length ? rows.join("\n") : fallback;
}

function sourceDateFromFile(filePath) {
  const match = filePath.match(/jobs_before_company_filter_(.+)\.jsonl$/);
  return match?.[1] || "";
}

const cacheFiles = candidateCacheFiles();
const sourceRows = cacheFiles.flatMap((filePath) => {
  return readJsonl(filePath).map((row) => ({ ...row, cacheSourceFile: filePath, cacheSourceDate: sourceDateFromFile(filePath) }));
});
const cleanJobs = readCleanJobs();
const cleanJobUrls = new Set(cleanJobs.map((job) => job.url).filter(Boolean));
const segments = existsSync(segmentPath) ? parseCsv(readFileSync(segmentPath, "utf8")) : [];
const dedupedRows = bestByUrl(sourceRows);

const evidenceRows = dedupedRows.map((row) => {
  const rel = relevance(row);
  return {
    evidenceLevel: rel.level,
    relevanceScore: rel.score,
    sourceType: "BOSS本地历史缓存",
    inCleanSample: cleanJobUrls.has(row.url) ? "是" : "否",
    segment: segmentFor(row, segments),
    roleFamily: roleFamily(row),
    company: row.company || "",
    title: row.title || "",
    salaryRaw: row.salary || "",
    salaryInferred: decodeBossGlyphSalary(row.salary),
    salaryVisibility: salaryVisibility(row),
    city: row.city || "",
    location: row.location || "",
    query: row.query || "",
    detailTextLength: String(row.detailText || "").length,
    capabilitySignals: capabilitySignals(row),
    evidenceReasons: rel.reasons,
    evidenceBoundary: "来自本地历史缓存，未新增访问BOSS；未进入干净样本的候选需人工复核",
    url: row.url || "",
    cacheSourceFile: row.cacheSourceFile.replace(`${projectRoot}/`, ""),
    cacheSourceDate: row.cacheSourceDate
  };
}).sort((a, b) => {
  const levelRank = { "高价值候选": 0, "待人工确认": 1, "剔除/低相关": 2 };
  return levelRank[a.evidenceLevel] - levelRank[b.evidenceLevel]
    || Number(b.relevanceScore) - Number(a.relevanceScore)
    || Number(b.detailTextLength) - Number(a.detailTextLength);
});

const headers = [
  "evidenceLevel",
  "relevanceScore",
  "sourceType",
  "inCleanSample",
  "segment",
  "roleFamily",
  "company",
  "title",
  "salaryRaw",
  "salaryInferred",
  "salaryVisibility",
  "city",
  "location",
  "query",
  "detailTextLength",
  "capabilitySignals",
  "evidenceReasons",
  "evidenceBoundary",
  "url",
  "cacheSourceFile",
  "cacheSourceDate"
];

mkdirSync(dirname(outputCsvPath), { recursive: true });
writeFileSync(outputCsvPath, `${csv([headers])}\n${csv(evidenceRows.map((row) => headers.map((header) => row[header])))}\n`);

const usableRows = evidenceRows.filter((row) => row.evidenceLevel !== "剔除/低相关");
const highValueRows = evidenceRows.filter((row) => row.evidenceLevel === "高价值候选");
const withDetailRows = evidenceRows.filter((row) => Number(row.detailTextLength) > 500);
const inferredSalaryRows = evidenceRows.filter((row) => row.salaryInferred);
const byLevelRows = countBy(evidenceRows, (row) => row.evidenceLevel)
  .map(([level, count]) => `| ${level} | ${count} |`);
const bySegmentRows = countBy(usableRows, (row) => row.segment)
  .map(([segment, count]) => `| ${segment} | ${count} | ${usableRows.filter((row) => row.segment === segment).slice(0, 4).map((row) => `${row.company}/${row.title}`).join("；")} |`);
const byRoleRows = countBy(usableRows, (row) => row.roleFamily)
  .map(([role, count]) => `| ${role} | ${count} | ${usableRows.filter((row) => row.roleFamily === role).slice(0, 4).map((row) => `${row.company}/${row.title}`).join("；")} |`);
const capabilityRows = countBy(
  usableRows.flatMap((row) => String(row.capabilitySignals || "").split(";").filter(Boolean)),
  (item) => item
).map(([capability, count]) => `| ${capability} | ${count} |`);

function safeBossReviewCell(row) {
  const keyword = [row.company, row.title]
    .map((value) => String(value || "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" ")
    .slice(0, 80);
  return `BOSS首页站内复核：\`${keyword || "公司 岗位"}\``;
}

const topRows = evidenceRows.slice(0, 30).map((row, index) => {
  return `| ${index + 1} | ${row.evidenceLevel} | ${row.relevanceScore} | ${row.segment} | ${row.roleFamily} | ${row.company} | ${row.title} | ${row.salaryInferred || row.salaryRaw || "-"} | ${row.detailTextLength} | ${row.evidenceReasons || "-"} | ${safeBossReviewCell(row)} |`;
});

const md = `# BOSS历史缓存候选线索库

更新时间：${new Date().toISOString()}

## 一、本质判断

这份文件不是新增采集结果，而是把本地已经存在的 BOSS 历史缓存重新去重、分层和打分。它解决的问题是：在 BOSS 风控恢复期，不继续刷新页面，也能先从已抓到的缓存里扩大岗位线索视野。

当前最大边界是：这里的“候选线索”不等于“干净样本”。只有已进入 \`01_行情收集/data/jobs.jsonl\` 的岗位才算正式干净样本；其余岗位必须人工复核后再进入正式样本库。

## 二、证据概览

| 项目 | 数量 |
| --- | ---: |
| 历史缓存源文件 | ${cacheFiles.length} |
| 缓存原始记录 | ${sourceRows.length} |
| 去重后候选 | ${evidenceRows.length} |
| 高价值候选 | ${highValueRows.length} |
| 可用于人工复核候选 | ${usableRows.length} |
| 带详情文本候选 | ${withDetailRows.length} |
| 可字体推断薪资候选 | ${inferredSalaryRows.length} |
| 已进入干净样本 | ${evidenceRows.filter((row) => row.inCleanSample === "是").length} |

## 三、候选分层

| 分层 | 数量 |
| --- | ---: |
${mdRows(byLevelRows, "| 暂无 | 0 |")}

## 四、赛道分布

| 赛道 | 候选数 | 代表岗位 |
| --- | ---: | --- |
${mdRows(bySegmentRows, "| 暂无 | 0 |  |")}

## 五、岗位类型分布

| 岗位类型 | 候选数 | 代表岗位 |
| --- | ---: | --- |
${mdRows(byRoleRows, "| 暂无 | 0 |  |")}

## 六、能力信号

| 能力信号 | 候选数 |
| --- | ---: |
${mdRows(capabilityRows, "| 暂无 | 0 |")}

## 七、Top 候选线索

| 序号 | 分层 | 分数 | 赛道 | 岗位类型 | 公司 | 岗位 | 薪资 | 详情长度 | 评分原因 | 链接 |
| ---: | --- | ---: | --- | --- | --- | --- | --- | ---: | --- | --- |
${mdRows(topRows, "| 1 | 暂无 | 0 |  |  |  |  |  | 0 |  |  |")}

## 八、使用方式

1. 优先从“高价值候选”里人工打开或核对岗位详情。
2. 如果候选仍在 BOSS 页面可见，用 \`import:manual\` 导入正式样本。
3. 每导入 10 条后刷新 \`salary:signals\`、\`matrix:roles\`、\`capability:matrix\`、\`handbook:market\`、\`audit:research\`。
4. 对“待人工确认”的岗位，只在岗位正文明确写到 AI/大模型/云/算力/软件销售后再纳入正式样本。

## 九、输出

\`\`\`text
${outputCsvPath}
${outputMdPath}
\`\`\`
`;

writeFileSync(outputMdPath, md);
console.log(`已生成：${outputMdPath}`);
console.log(`已生成：${outputCsvPath}`);
console.log(`历史缓存候选：${evidenceRows.length}`);
console.log(`高价值候选：${highValueRows.length}`);
console.log(`可人工复核候选：${usableRows.length}`);
