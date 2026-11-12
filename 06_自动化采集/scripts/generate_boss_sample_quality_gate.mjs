#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const jobsPath = join(projectRoot, "01_行情收集/data/jobs.jsonl");
const segmentPath = join(projectRoot, "06_自动化采集/config/ai_company_segments.csv");
const sampleGapPath = join(projectRoot, "01_行情收集/BOSS全行业样本缺口路线图.csv");
const companyTypePath = join(projectRoot, "00_行业资料集/AI销售公司类型岗位打法对照表.csv");
const outputMdPath = join(projectRoot, "01_行情收集/BOSS样本质量验收报告.md");
const outputCsvPath = join(projectRoot, "01_行情收集/BOSS样本质量验收报告.csv");

const roleTerms = ["销售", "售前", "解决方案", "渠道", "商务", "BD", "大客户", "KA", "客户经理", "销售经理", "销售总监", "政企"];
const aiTerms = [
  "AI",
  "人工智能",
  "大模型",
  "智能体",
  "Agent",
  "RAG",
  "MaaS",
  "云",
  "算力",
  "智算",
  "芯片",
  "GPU",
  "半导体",
  "服务器",
  "私有化",
  "信创",
  "智能制造",
  "工业",
  "机器人",
  "自动驾驶",
  "智能客服",
  "SaaS",
  "数据",
  "MLOps"
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

function isBossJob(job) {
  return !job.source || job.source === "BOSS直聘";
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

function textOf(job) {
  return [
    job.title,
    job.company,
    job.companyFilter,
    job.query,
    job.role,
    job.roleFamily,
    job.salary,
    job.location,
    job.city,
    job.rawText,
    job.detailText
  ].filter(Boolean).join("\n");
}

function includesAny(text, terms) {
  const lower = String(text || "").toLowerCase();
  return terms.some((term) => lower.includes(term.toLowerCase()));
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

function salaryInfo(job) {
  const text = [job.salary, job.rawText, job.detailText].filter(Boolean).join("\n");
  const hasPrivateFont = /[\uE000-\uF8FF]/.test(String(job.salary || ""));
  const detailMatch = text.match(/薪资范围[:：]?\s*(\d+)\s*[-~－—到]\s*(\d+)\s*元\/?月/i);
  if (detailMatch) {
    return {
      readable: true,
      source: "detail_salary_range",
      lowK: Number(detailMatch[1]) / 1000,
      highK: Number(detailMatch[2]) / 1000,
      label: `${Number(detailMatch[1]) / 1000}-${Number(detailMatch[2]) / 1000}K`
    };
  }
  const standardMatch = String(job.salary || "").replace(/k/g, "K").match(/(\d+(?:\.\d+)?)\s*[-~－—到]\s*(\d+(?:\.\d+)?)\s*K/);
  if (standardMatch && !hasPrivateFont) {
    return {
      readable: true,
      source: "standard_k_range",
      lowK: Number(standardMatch[1]),
      highK: Number(standardMatch[2]),
      label: `${standardMatch[1]}-${standardMatch[2]}K`
    };
  }
  return {
    readable: false,
    source: hasPrivateFont ? "boss_font_obfuscated" : "missing_or_nonstandard",
    lowK: "",
    highK: "",
    label: job.salary || ""
  };
}

function fieldCompleteness(job, salary) {
  const checks = [
    Boolean(job.title),
    Boolean(job.company),
    Boolean(job.salary || salary.readable),
    Boolean(job.location || job.city),
    Boolean(job.url || job.searchUrl),
    Boolean(job.rawText),
    Boolean(job.experience || /经验|年/.test(textOf(job))),
    Boolean(job.education || /本科|大专|硕士|博士|学历/.test(textOf(job))),
    String(job.detailText || "").length >= 300
  ];
  const passed = checks.filter(Boolean).length;
  return {
    passed,
    total: checks.length,
    rate: Math.round((passed / checks.length) * 100)
  };
}

function segmentFor(job, segmentRows) {
  const company = job.companyFilter || job.company || "";
  const exact = segmentRows.find((row) => row.company === company);
  if (exact) return exact.segment;
  const fuzzy = segmentRows.find((row) => company && (company.includes(row.company) || row.company.includes(company)));
  if (fuzzy) return fuzzy.segment;
  const text = textOf(job);
  const querySegment = segmentRows.find((row) => row.segment && text.includes(row.segment));
  return querySegment?.segment || "未映射";
}

function routeFor(segment, sampleGapRows, companyTypeRows) {
  return sampleGapRows.find((row) => row.segment === segment)?.route ||
    companyTypeRows.find((row) => row.segment === segment)?.route ||
    "";
}

function roleFamily(job) {
  const text = textOf(job);
  if (/销售总监|销售负责人|区域经理|销售经理|主管|leader/i.test(text)) return "销售管理";
  if (/售前|解决方案|POC|Demo|演示|技术交流|顾问/i.test(text)) return "售前/解决方案";
  if (/渠道|生态|伙伴|代理商/i.test(text)) return "渠道/生态";
  if (/大客户|KA|行业客户|客户经理|销售|商务|BD/i.test(text)) return "销售/商务";
  return job.roleFamily || "未分类";
}

function qualityGrade(score, roleRelevant, aiRelevant, completenessRate) {
  if (!roleRelevant || !aiRelevant) return "需人工复核/可能剔除";
  if (score >= 80 && completenessRate >= 75) return "A 可用于阶段结论";
  if (score >= 65) return "B 可用于方向观察";
  if (score >= 50) return "C 只作弱信号";
  return "D 暂不用于结论";
}

function reviewReason(row) {
  const reasons = [];
  if (!row.roleRelevant) reasons.push("岗位不像销售/售前/渠道/管理");
  if (!row.aiRelevant) reasons.push("AI/算力/硬件/行业相关性不足");
  if (!row.salaryReadable) reasons.push("薪资不可读或非标准");
  if (row.detailTextLength < 300) reasons.push("详情文本不足");
  if (row.segment === "未映射") reasons.push("赛道未映射");
  if (row.completenessRate < 70) reasons.push("字段不完整");
  return reasons.join("；") || "可用";
}

const allJobs = readJobs();
const jobs = allJobs.filter(isBossJob);
const segmentRows = readCsv(segmentPath);
const sampleGapRows = readCsv(sampleGapPath);
const companyTypeRows = readCsv(companyTypePath);

const qualityRows = jobs.map((job) => {
  const text = textOf(job);
  const segment = segmentFor(job, segmentRows);
  const route = routeFor(segment, sampleGapRows, companyTypeRows);
  const salary = salaryInfo(job);
  const completeness = fieldCompleteness(job, salary);
  const roleRelevant = includesAny(text, roleTerms);
  const aiRelevant = segment !== "未映射" || includesAny(text, aiTerms);
  const detailTextLength = String(job.detailText || "").length;
  const rawTextLength = String(job.rawText || "").length;
  const role = roleFamily(job);
  const score = Math.min(100, Math.round(
    (roleRelevant ? 22 : 0) +
    (aiRelevant ? 22 : 0) +
    completeness.rate * 0.25 +
    (salary.readable ? 12 : 4) +
    (segment !== "未映射" ? 10 : 0) +
    (detailTextLength >= 1000 ? 9 : detailTextLength >= 300 ? 5 : 0)
  ));
  const row = {
    id: job.id,
    collectedAt: job.collectedAt || "",
    sourceMode: job.sourceMode || "auto_or_legacy",
    segment,
    route,
    roleFamily: role,
    company: job.company || "",
    title: job.title || "",
    city: job.city || job.location || "",
    salaryRaw: job.salary || "",
    salaryReadable: salary.readable,
    salaryReadableText: salary.label,
    salaryLowK: salary.lowK,
    salaryHighK: salary.highK,
    salarySource: salary.source,
    roleRelevant,
    aiRelevant,
    completenessRate: completeness.rate,
    fieldsPassed: `${completeness.passed}/${completeness.total}`,
    rawTextLength,
    detailTextLength,
    qualityScore: score,
    qualityGrade: qualityGrade(score, roleRelevant, aiRelevant, completeness.rate),
    url: job.url || job.searchUrl || ""
  };
  return { ...row, reviewReason: reviewReason(row) };
});

const segmentSummaryRows = sampleGapRows.map((row) => {
  const rows = qualityRows.filter((item) => item.segment === row.segment);
  const usable = rows.filter((item) => item.qualityScore >= 65 && item.roleRelevant && item.aiRelevant);
  const stageReady = usable.length >= 3;
  const salaryReady = usable.length >= 8 && usable.filter((item) => item.salaryReadable).length >= 5;
  const targetSamples = numberOf(row.targetSamples);
  return {
    priority: row.priority,
    route: row.route,
    segment: row.segment,
    targetSamples,
    importedJobs: rows.length,
    usableSamples: usable.length,
    readableSalarySamples: rows.filter((item) => item.salaryReadable).length,
    detailSamples: rows.filter((item) => item.detailTextLength >= 300).length,
    remainingGap: Math.max(0, targetSamples - usable.length),
    stageConclusionGate: stageReady ? "可写方向性观察" : "不足3条，不能写BOSS方向结论",
    salaryConclusionGate: salaryReady ? "可写薪资区间观察" : "薪资样本不足",
    largeSampleGate: usable.length >= targetSamples ? "达到目标样本" : "未达到目标样本"
  };
});

const csvHeaders = [
  "id",
  "collectedAt",
  "sourceMode",
  "segment",
  "route",
  "roleFamily",
  "company",
  "title",
  "city",
  "salaryRaw",
  "salaryReadable",
  "salaryReadableText",
  "salaryLowK",
  "salaryHighK",
  "salarySource",
  "roleRelevant",
  "aiRelevant",
  "completenessRate",
  "fieldsPassed",
  "rawTextLength",
  "detailTextLength",
  "qualityScore",
  "qualityGrade",
  "reviewReason",
  "url"
];

function mdRows(rows, fallback) {
  return rows.length ? rows.join("\n") : fallback;
}

const summaryMdRows = segmentSummaryRows.map((row) => {
  return `| ${row.priority} | ${row.route} | ${row.segment} | ${row.usableSamples}/${row.targetSamples} | ${row.readableSalarySamples} | ${row.detailSamples} | ${row.remainingGap} | ${row.stageConclusionGate} | ${row.salaryConclusionGate} |`;
});

const sampleMdRows = qualityRows.map((row) => {
  return `| ${row.qualityScore} | ${row.qualityGrade} | ${row.segment} | ${row.roleFamily} | ${row.company} | ${row.title} | ${row.salaryReadableText || row.salaryRaw || "-"} | ${row.fieldsPassed} | ${row.reviewReason} |`;
});

const usableCount = qualityRows.filter((row) => row.qualityScore >= 65 && row.roleRelevant && row.aiRelevant).length;
const readableCount = qualityRows.filter((row) => row.salaryReadable).length;
const detailCount = qualityRows.filter((row) => row.detailTextLength >= 300).length;
const unmappedCount = qualityRows.filter((row) => row.segment === "未映射").length;
const p0ReadySegments = segmentSummaryRows.filter((row) => row.priority === "P0" && row.usableSamples >= 3).length;

mkdirSync(dirname(outputMdPath), { recursive: true });
writeFileSync(outputCsvPath, `${csv([csvHeaders, ...qualityRows.map((row) => csvHeaders.map((header) => row[header]))])}\n`);

const md = `# BOSS样本质量验收报告

更新时间：${formatDate()}

## 一、本质判断

这份报告不是新增岗位样本，而是判断现有 BOSS 样本能不能支撑“AI销售岗位市场结论”。当前最重要的不是样本条数，而是样本是否高相关、字段是否完整、薪资是否可读、详情是否足够支撑能力要求判断。

当前最大的矛盾是：我们已经有全行业公司池和公开薪资信号，但 BOSS 干净样本只有 ${jobs.length} 条；如果不做质量闸门，很容易把弱相关岗位当成市场结论。

## 二、总体质量

| 指标 | 当前值 |
| --- | ---: |
| BOSS样本总数 | ${jobs.length} |
| 可用于方向观察样本 | ${usableCount} |
| 可读薪资样本 | ${readableCount} |
| 有详情文本样本 | ${detailCount} |
| 未映射赛道样本 | ${unmappedCount} |
| P0赛道达到方向观察门槛 | ${p0ReadySegments} |

## 三、赛道结论权限

| 优先级 | 路线 | 赛道 | 可用/目标 | 可读薪资 | 有详情 | 剩余缺口 | 方向结论 | 薪资结论 |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- |
${mdRows(summaryMdRows, "| 暂无 |  |  | 0/0 | 0 | 0 | 0 | - | - |")}

## 四、逐条样本验收

| 分数 | 等级 | 赛道 | 岗位族 | 公司 | 岗位 | 薪资 | 字段 | 问题/结论 |
| ---: | --- | --- | --- | --- | --- | --- | ---: | --- |
${mdRows(sampleMdRows, "| 0 | 暂无 |  |  |  |  |  | 0/0 | - |")}

## 五、结论闸门

1. 单赛道少于 3 条可用样本：不能写 BOSS 方向结论。
2. 单赛道可用样本不少于 3 条：只能写方向性观察，不能写稳定薪资结论。
3. 单赛道可用样本不少于 8 条且可读薪资不少于 5 条：可以写薪资区间观察。
4. 单赛道达到目标样本：可以写赛道小结。
5. 全行业达到 80 到 200 条高相关样本：才能升级为 BOSS 大样本结论。

## 六、下一步动作

1. 继续按 \`BOSS人工补样工作台.md\` 执行 P0 补样。
2. 优先补仍为 0 的 P0 赛道：基座大模型/Agent、AI芯片/GPU、AI服务器/智算、智能客服/营销AI。
3. 每导入 10 到 20 条样本后运行：

\`\`\`bash
npm run sampling:quality
npm run sampling:status
npm run sampling:gap
npm run brief:market
npm run report:full
npm run audit:research
\`\`\`

## 七、CSV输出

\`\`\`text
${outputCsvPath}
\`\`\`
`;

writeFileSync(outputMdPath, md);

console.log(`已生成：${outputMdPath}`);
console.log(`已生成：${outputCsvPath}`);
console.log(`BOSS样本总数：${jobs.length}`);
console.log(`可用于方向观察样本：${usableCount}`);
console.log(`可读薪资样本：${readableCount}`);
