#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const segmentPath = join(projectRoot, "06_自动化采集/config/ai_company_segments.csv");
const playbookPath = join(projectRoot, "00_行业资料集/AI目标公司销售岗位打法清单.csv");
const opportunityPath = join(projectRoot, "01_行情收集/AI细分赛道销售机会矩阵.csv");
const publicEvidencePath = join(projectRoot, "01_行情收集/AI公开招聘薪资证据库.csv");
const publicMarketSourcesPath = join(projectRoot, "06_自动化采集/config/public_market_sources.csv");
const manualSamplingPackPath = join(projectRoot, "01_行情收集/BOSS人工采样作业包.csv");
const nextSamplingPath = join(projectRoot, "01_行情收集/BOSS下一轮优先采样清单.csv");
const cacheEvidencePath = join(projectRoot, "01_行情收集/BOSS历史缓存候选线索库.csv");
const jobsPath = join(projectRoot, "01_行情收集/data/jobs.jsonl");

const outputMdPath = join(projectRoot, "01_行情收集/AI硬件算力半导体销售岗位专项分析.md");
const outputCsvPath = join(projectRoot, "01_行情收集/AI硬件算力半导体销售岗位专项分析.csv");
const outputQueueCsvPath = join(projectRoot, "01_行情收集/BOSS硬件算力半导体优先采样清单.csv");
const outputQueueMdPath = join(projectRoot, "01_行情收集/BOSS硬件算力半导体优先采样清单.md");
const safeBossHomeUrl = "https://www.zhipin.com/";

const hardwareSegments = [
  "AI芯片/GPU/加速卡",
  "AI服务器/智算基础设施",
  "智算中心/数据中心服务",
  "智能汽车/机器人/具身智能",
  "工业AI/智能制造",
  "AI视觉/安防/质检"
];

const coreHardwareSegments = new Set([
  "AI芯片/GPU/加速卡",
  "AI服务器/智算基础设施",
  "智算中心/数据中心服务",
  "智能汽车/机器人/具身智能"
]);

const segmentPositioning = {
  "AI芯片/GPU/加速卡": {
    layer: "上游算力芯片",
    buyer: "云厂商、服务器厂商、智算中心、政企科研客户、车企/机器人客户",
    role: "大客户销售、渠道销售、生态合作、解决方案顾问",
    motion: "长周期项目型销售，先进入服务器/云/智算生态，再通过标杆客户和渠道伙伴放大。",
    gate: "必须证明硬件链路理解、政企/大客户项目推进、渠道生态和售前协同。"
  },
  "AI服务器/智算基础设施": {
    layer: "中游算力基础设施",
    buyer: "互联网大客户、金融/教育/运营商、政企客户、IDC/智算中心、渠道伙伴",
    role: "行业销售、大客户销售、售前方案、渠道销售",
    motion: "围绕AI服务器、液冷、算力集群、招投标、交付和回款做复杂项目推进。",
    gate: "必须证明大客户项目、招投标/交付协同、合同额和算力/服务器场景理解。"
  },
  "智算中心/数据中心服务": {
    layer: "算力服务/IDC",
    buyer: "大模型公司、互联网客户、政企客户、运营商、园区/能源合作方",
    role: "IDC大客户销售、算力服务销售、渠道销售、销售经理",
    motion: "从卖机柜/资源升级为卖算力服务、资源池、网络互联、运维和长期合同。",
    gate: "必须证明大客户经营、算力/IDC资源理解、合同周期、续约和回款。"
  },
  "智能汽车/机器人/具身智能": {
    layer: "端侧智能硬件",
    buyer: "主机厂、机器人集成商、工业客户、海外渠道、政企/园区客户",
    role: "车企客户销售、渠道销售、海外销售、生态合作、销售经理",
    motion: "软硬结合商业化，重视车企/机器人客户、渠道、海外市场和生态落地。",
    gate: "必须证明软硬件结合、渠道/海外、行业客户和项目落地。"
  },
  "工业AI/智能制造": {
    layer: "制造业AI落地",
    buyer: "制造业工厂、半导体/新能源/汽车客户、质量/设备/数字化部门",
    role: "制造业行业销售、KA销售、售前方案、销售管理",
    motion: "围绕产线、质检、设备、排产、能耗等场景做方案销售和交付协同。",
    gate: "必须证明制造业业务流程、现场问题识别、POC/项目交付和ROI表达。"
  },
  "AI视觉/安防/质检": {
    layer: "工业视觉/安防质检",
    buyer: "政企客户、制造业客户、集成商、渠道伙伴",
    role: "行业销售、渠道销售、售前方案、政企销售",
    motion: "项目型销售，围绕视觉算法、安防、质检、集成交付和渠道体系推进。",
    gate: "必须证明行业场景、渠道体系、项目交付和方案表达。"
  }
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

function readCsv(filePath) {
  if (!existsSync(filePath)) return [];
  return parseCsv(readFileSync(filePath, "utf8"));
}

function readJsonl(filePath) {
  if (!existsSync(filePath)) return [];
  return readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
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

function splitTerms(value) {
  return String(value || "")
    .split(/[;；、]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function topJoined(values, limit = 6, separator = "、") {
  return unique(values).slice(0, limit).join(separator);
}

function isHardwareSegment(segment) {
  return hardwareSegments.includes(segment);
}

function segmentForJob(job, segmentRows) {
  const company = job.companyFilter || job.company || "";
  const exact = segmentRows.find((row) => row.company === company);
  if (exact) return exact.segment;
  const loose = segmentRows.find((row) => company && (company.includes(row.company) || row.company.includes(company)));
  if (loose) return loose.segment;
  const text = [job.title, job.company, job.rawText, job.detailText].filter(Boolean).join("\n");
  if (/芯片|GPU|加速卡|半导体/.test(text)) return "AI芯片/GPU/加速卡";
  if (/服务器|智算|算力|液冷/.test(text)) return "AI服务器/智算基础设施";
  if (/IDC|数据中心|机柜/.test(text)) return "智算中心/数据中心服务";
  if (/机器人|自动驾驶|车企|激光雷达|智能硬件/.test(text)) return "智能汽车/机器人/具身智能";
  if (/工业|制造|质检|产线/.test(text)) return "工业AI/智能制造";
  return "";
}

function salaryStats(rows) {
  const withSalary = rows.filter((row) => numberOf(row.salaryMaxK));
  if (!withSalary.length) return { count: 0, maxK: "", minK: "", avgMaxK: "", examples: "" };
  const maxValues = withSalary.map((row) => numberOf(row.salaryMaxK));
  const minValues = withSalary.map((row) => numberOf(row.salaryMinK)).filter(Boolean);
  return {
    count: withSalary.length,
    maxK: Math.max(...maxValues),
    minK: minValues.length ? Math.min(...minValues) : "",
    avgMaxK: Math.round(maxValues.reduce((sum, value) => sum + value, 0) / maxValues.length),
    examples: topJoined(withSalary.map((row) => `${row.companyOrPage}/${row.role}/${row.salaryRaw}`), 4, "；")
  };
}

function priorityRank(value) {
  if (/P0|立即|优先/.test(value || "")) return 3;
  if (/P1|重点/.test(value || "")) return 2;
  if (/P2|扩展/.test(value || "")) return 1;
  return 0;
}

function scoreQueue(row) {
  const segmentBoost = coreHardwareSegments.has(row.segment) ? 30 : 12;
  return numberOf(row.score)
    + priorityRank(row.priority) * 40
    + segmentBoost
    + (/(海光|寒武纪|超聚变|浪潮|新华三|华为|地平线|速腾|禾赛|世纪互联|万国数据|创新奇智|大华|海康)/.test(row.company) ? 15 : 0);
}

function mdRows(rows, fallback) {
  return rows.length ? rows.join("\n") : fallback;
}

const segmentRows = readCsv(segmentPath);
const playbookRows = readCsv(playbookPath);
const opportunityRows = readCsv(opportunityPath);
const publicEvidenceRows = readCsv(publicEvidencePath);
const publicMarketRows = readCsv(publicMarketSourcesPath);
const manualSamplingRows = readCsv(manualSamplingPackPath);
const nextSamplingRows = readCsv(nextSamplingPath);
const cacheRows = readCsv(cacheEvidencePath);
function isBossJob(job) {
  return !job.source || job.source === "BOSS直聘";
}

const cleanJobs = readJsonl(jobsPath).filter(isBossJob);

const hardwareCompanyRows = segmentRows.filter((row) => isHardwareSegment(row.segment));
const hardwarePlaybookRows = playbookRows.filter((row) => isHardwareSegment(row.segment));
const hardwareOpportunityRows = opportunityRows.filter((row) => isHardwareSegment(row.segment));
const hardwareEvidenceRows = publicEvidenceRows.filter((row) => isHardwareSegment(row.segment));
const hardwareManualRows = manualSamplingRows.filter((row) => isHardwareSegment(row.segment));
const hardwareNextRows = nextSamplingRows.filter((row) => isHardwareSegment(row.segment));
const hardwareCacheRows = cacheRows.filter((row) => isHardwareSegment(row.segment));
const hardwareCleanJobs = cleanJobs.filter((job) => isHardwareSegment(segmentForJob(job, segmentRows)));
const hardwareSources = publicMarketRows.filter((row) => /芯片|半导体|硬件|服务器|算力|智算|IDC|数据中心|机器人|智能硬件|制造|工业/.test([
  row.topic,
  row.key_signal,
  row.sales_implication
].join("\n")));

const segmentSummaryRows = hardwareSegments.map((segment) => {
  const companies = hardwareCompanyRows.filter((row) => row.segment === segment);
  const playbook = hardwarePlaybookRows.filter((row) => row.segment === segment);
  const opportunity = hardwareOpportunityRows.find((row) => row.segment === segment) || {};
  const publicEvidence = hardwareEvidenceRows.filter((row) => row.segment === segment);
  const salary = salaryStats(publicEvidence);
  const cache = hardwareCacheRows.filter((row) => row.segment === segment);
  const clean = hardwareCleanJobs.filter((job) => segmentForJob(job, segmentRows) === segment);
  const manual = hardwareManualRows.filter((row) => row.segment === segment);
  const next = hardwareNextRows.filter((row) => row.segment === segment);
  const positioning = segmentPositioning[segment] || {};
  const p0Companies = playbook
    .filter((row) => /P0|立即|优先/.test(row.priority || row.opportunityLevel || ""))
    .sort((a, b) => numberOf(b.score) - numberOf(a.score));
  const topCompanies = playbook
    .slice()
    .sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority) || numberOf(b.score) - numberOf(a.score));
  const samplingGap = Number(opportunity.sampleGap || 0) || Math.max(0, (coreHardwareSegments.has(segment) ? 12 : 8) - clean.length);
  const evidenceLevel = clean.length
    ? "已有少量BOSS干净样本"
    : publicEvidence.length
      ? "公开薪资/岗位信号，缺BOSS干净样本"
      : cache.length
        ? "仅有历史缓存候选，需复核"
        : "公司池和趋势信号，需补岗位样本";
  return {
    segment,
    routeLayer: positioning.layer || "",
    companyCount: companies.length,
    p0Companies: topJoined(p0Companies.map((row) => row.company), 6),
    topCompanies: topJoined(topCompanies.map((row) => row.company), 8),
    buyerProfiles: positioning.buyer || opportunity.buyerProfiles || topJoined(playbook.map((row) => row.buyerProfiles), 3, "；"),
    primaryRoles: positioning.role || opportunity.roleFocus || topJoined(playbook.flatMap((row) => splitTerms(row.likelyRoles)), 6),
    salesMotion: positioning.motion || opportunity.salesMotion || topJoined(playbook.map((row) => row.salesMotion), 2, "；"),
    salaryBand: opportunity.salaryBand || topJoined(playbook.map((row) => row.salaryObservation), 2, "；") || "待BOSS样本校验",
    publicSalaryMaxK: salary.maxK ? `${salary.maxK}K` : "",
    publicSalaryEvidenceCount: salary.count,
    publicSalaryExamples: salary.examples,
    bossCleanSamples: clean.length,
    bossCacheCandidates: cache.length,
    manualTasks: manual.length,
    nextQueueTasks: next.length,
    sampleGap: samplingGap,
    coreCapabilities: opportunity.coreCapabilities || topJoined(playbook.flatMap((row) => splitTerms(row.coreCapabilities)), 8),
    mustHaveGate: positioning.gate || opportunity.mustHaveGate || topJoined(playbook.map((row) => row.mustHaveGate), 2, "；"),
    evidenceLevel,
    nextAction: next[0]
      ? `优先人工看 ${next[0].company}/${next[0].role}`
      : playbook[0]?.nextAction || `补 ${segment} BOSS人工样本`
  };
});

const queueRows = [...hardwareNextRows, ...hardwareManualRows]
  .map((row) => ({
    sourceQueue: row.rank ? "下一轮优先采样清单" : "人工采样作业包",
    segment: row.segment,
    company: row.company,
    role: row.role,
    priority: row.priority,
    score: scoreQueue(row),
    salaryBand: row.salaryBand || "",
    sampleProgress: row.sampleProgress || "",
    reason: row.reason || row.acceptanceCriteria || "",
    searchUrl: row.searchUrl,
    importCommand: row.importCommand
  }))
  .filter((row, index, rows) => {
    const key = `${row.segment}|${row.company}|${row.role}`;
    return rows.findIndex((item) => `${item.segment}|${item.company}|${item.role}` === key) === index;
  })
  .sort((a, b) => b.score - a.score || priorityRank(b.priority) - priorityRank(a.priority))
  .slice(0, 50)
  .map((row, index) => ({ rank: index + 1, ...row }));

const roleRows = [...new Set(hardwareEvidenceRows.map((row) => row.roleFamily).filter(Boolean))]
  .map((roleFamily) => {
    const rows = hardwareEvidenceRows.filter((row) => row.roleFamily === roleFamily);
    const salary = salaryStats(rows);
    return {
      roleFamily,
      evidenceCount: rows.length,
      salaryMaxK: salary.maxK,
      segments: topJoined(rows.map((row) => row.segment), 5),
      examples: salary.examples
    };
  })
  .sort((a, b) => numberOf(b.salaryMaxK) - numberOf(a.salaryMaxK) || b.evidenceCount - a.evidenceCount);

const sourceRows = hardwareSources.map((row) => {
  return `| ${row.source} | ${row.year} | ${row.topic} | ${row.key_signal} | ${row.sales_implication} | [来源](${row.url}) |`;
});

const segmentTableRows = segmentSummaryRows.map((row, index) => {
  return `| ${index + 1} | ${row.segment} | ${row.routeLayer} | ${row.companyCount} | ${row.p0Companies || row.topCompanies} | ${row.primaryRoles} | ${row.salaryBand} | ${row.publicSalaryMaxK || "-"} | ${row.publicSalaryEvidenceCount} | ${row.bossCleanSamples} | ${row.bossCacheCandidates} | ${row.sampleGap} | ${row.nextAction} |`;
});

const roleTableRows = roleRows.map((row) => {
  return `| ${row.roleFamily} | ${row.evidenceCount} | ${row.salaryMaxK || "-"}K | ${row.segments} | ${row.examples || "-"} |`;
});

const queueTableRows = queueRows.slice(0, 30).map((row) => {
  const keyword = row.searchKeyword || `${row.company} ${row.role}`.trim();
  return `| ${row.rank} | ${row.score} | ${row.priority} | ${row.segment} | ${row.company} | ${row.role} | ${row.salaryBand || "-"} | ${row.sourceQueue} | ${safeBossHomeUrl} | \`${keyword}\` | \`${row.importCommand}\` |`;
});

const companyTableRows = hardwarePlaybookRows
  .slice()
  .sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority) || numberOf(b.score) - numberOf(a.score))
  .slice(0, 40)
  .map((row, index) => {
    return `| ${index + 1} | ${row.priority} | ${row.segment} | ${row.company} | ${row.companyPosition} | ${row.firstRole} | ${row.salaryObservation} | ${row.coreCapabilities} | ${row.nextAction} |`;
  });

const headers = [
  "segment",
  "routeLayer",
  "companyCount",
  "p0Companies",
  "topCompanies",
  "buyerProfiles",
  "primaryRoles",
  "salesMotion",
  "salaryBand",
  "publicSalaryMaxK",
  "publicSalaryEvidenceCount",
  "publicSalaryExamples",
  "bossCleanSamples",
  "bossCacheCandidates",
  "manualTasks",
  "nextQueueTasks",
  "sampleGap",
  "coreCapabilities",
  "mustHaveGate",
  "evidenceLevel",
  "nextAction"
];

const queueHeaders = [
  "rank",
  "score",
  "priority",
  "segment",
  "company",
  "role",
  "salaryBand",
  "sampleProgress",
  "sourceQueue",
  "reason",
  "safeBossHomeUrl",
  "searchKeyword",
  "searchUrl",
  "importCommand"
];

mkdirSync(dirname(outputMdPath), { recursive: true });
writeFileSync(outputCsvPath, `${csv([headers, ...segmentSummaryRows.map((row) => headers.map((header) => row[header]))])}\n`);
writeFileSync(outputQueueCsvPath, `${csv([queueHeaders, ...queueRows.map((row) => queueHeaders.map((header) => {
  if (header === "safeBossHomeUrl") return safeBossHomeUrl;
  if (header === "searchKeyword") return row.searchKeyword || `${row.company} ${row.role}`.trim();
  return row[header];
}))])}\n`);

const md = `# AI硬件算力半导体销售岗位专项分析

更新时间：${formatDate()}

## 一、本质判断

这件事本质上不是“找芯片公司销售岗”，而是判断 AI 算力产业链里哪些商业化岗位真正适合你：上游芯片/GPU、中游AI服务器和智算基础设施、IDC/智算中心服务、端侧智能硬件，以及制造业AI落地。

当前最大的矛盾是：硬件/算力方向的公司池和公开趋势证据已经比较完整，但 BOSS 干净岗位样本仍为 ${hardwareCleanJobs.length} 条，不能把薪资和能力门槛写成最终事实。现阶段应把它作为高优先级人工复核队列。

## 二、证据基座

| 证据层 | 数量 | 用途 | 边界 |
| --- | ---: | --- | --- |
| 硬件相关公司池 | ${hardwareCompanyRows.length} 家 | 覆盖芯片、服务器、智算、端侧硬件、工业制造和视觉质检 | 公司池假设，需验证在招状态 |
| 目标公司打法清单 | ${hardwarePlaybookRows.length} 行 | 判断公司定位、销售打法、首看岗位和简历证据 | 阶段性打法，不等于岗位详情 |
| 公开招聘/薪资证据 | ${hardwareEvidenceRows.length} 条 | 形成薪资区间和岗位族假设 | 公开页面/搜索信号，需BOSS详情校验 |
| BOSS历史缓存候选 | ${hardwareCacheRows.length} 条 | 不新增访问BOSS的情况下筛人工复核对象 | 候选不是干净样本 |
| BOSS干净岗位样本 | ${hardwareCleanJobs.length} 条 | 平台实证样本 | 当前不足 |
| 硬件相关公开趋势来源 | ${hardwareSources.length} 条 | 校验为什么该方向值得看 | 趋势信号，不等于招聘需求 |
| 人工采样任务 | ${hardwareManualRows.length} 条 | 后续补样本入口 | 需人工打开/复制/导入 |
| 下一轮优先采样 | ${hardwareNextRows.length} 条 | 风控恢复期优先动作 | 不自动打开BOSS |

## 三、硬件/算力/半导体岗位地图

| 排名 | 赛道 | 产业位置 | 公司数 | 优先公司 | 典型岗位 | 薪资观察 | 公开薪资上限 | 薪资证据 | BOSS干净样本 | 缓存候选 | 样本缺口 | 下一步 |
| ---: | --- | --- | ---: | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
${mdRows(segmentTableRows, "| 1 | 暂无 |  | 0 |  |  |  | - | 0 | 0 | 0 | 0 |  |")}

## 四、岗位族薪资观察

| 岗位族 | 公开证据数 | 最高月薪观察 | 重点赛道 | 示例 |
| --- | ---: | ---: | --- | --- |
${mdRows(roleTableRows, "| 暂无 | 0 | - |  |  |")}

## 五、重点公司打法

| 排名 | 优先级 | 赛道 | 公司 | 公司定位 | 首看岗位 | 薪资假设 | 核心能力 | 下一步 |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- |
${mdRows(companyTableRows, "| 1 | 暂无 |  |  |  |  |  |  |  |")}

## 六、BOSS硬件方向优先采样清单

这份清单只生成 BOSS 首页、站内搜索关键词和导入命令，不自动打开 BOSS 页面。当前风控恢复期建议每次人工只看 1 个关键词。

| 排名 | 分数 | 优先级 | 赛道 | 公司 | 岗位词 | 薪资观察 | 来源队列 | BOSS首页 | 站内搜索关键词 | 导入命令 |
| ---: | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${mdRows(queueTableRows, "| 1 | 0 |  |  |  |  |  |  |  |  |  |")}

## 七、能力门槛

硬件/算力/半导体方向不要用泛 SaaS 销售话术。简历必须证明：

1. 大客户/KA开发：能进入复杂客户组织，识别关键人、预算、竞品和采购节奏。
2. 硬件/算力链路理解：能讲清芯片、服务器、智算中心、云/IDC、交付和生态关系。
3. 项目型销售：能推进招投标、POC/测试、方案、合同、交付和回款。
4. 渠道/生态合作：能通过服务器厂商、集成商、渠道伙伴或区域生态放大商机。
5. 行业场景理解：能把金融、教育、运营商、政企、制造、车企/机器人客户的采购逻辑讲清楚。

## 八、公开趋势校验

| 来源 | 年份 | 主题 | 关键信号 | 对销售岗位采样的含义 | 链接 |
| --- | --- | --- | --- | --- | --- |
${mdRows(sourceRows, "| 暂无 |  |  |  |  |  |")}

## 九、结论边界

这份专项已经补足硬件方向的公司池、岗位打法、薪资假设和人工采样入口；但它还不是 BOSS 大样本结论。下一步必须优先把海光信息、寒武纪、超聚变、浪潮信息/新华三、地平线、世纪互联/万国数据等公司的销售/渠道/售前岗位人工导入正式样本。

## 十、输出文件

\`\`\`text
${outputCsvPath}
${outputQueueCsvPath}
${outputQueueMdPath}
\`\`\`
`;

const queueMd = `# BOSS硬件算力半导体优先采样清单

更新时间：${formatDate()}

这份清单从人工采样作业包和下一轮优先清单中筛出硬件/算力/半导体相关任务。它不打开 BOSS 页面，只给人工复核关键词。

| 排名 | 分数 | 优先级 | 赛道 | 公司 | 岗位词 | 薪资观察 | 来源队列 | BOSS首页 | 站内搜索关键词 | 导入命令 |
| ---: | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${mdRows(queueTableRows, "| 1 | 0 |  |  |  |  |  |  |  |  |  |")}

执行建议：

1. 每次只处理 1 个站内搜索关键词。
2. 岗位正文明确写到芯片/GPU/服务器/智算/IDC/车企/机器人/制造业AI时再导入。
3. 导入后运行 \`npm run salary:signals && npm run hardware:market && npm run audit:research\`。

\`\`\`text
${outputQueueCsvPath}
\`\`\`
`;

writeFileSync(outputMdPath, md);
writeFileSync(outputQueueMdPath, queueMd);

console.log(`已生成：${outputMdPath}`);
console.log(`已生成：${outputCsvPath}`);
console.log(`已生成：${outputQueueMdPath}`);
console.log(`已生成：${outputQueueCsvPath}`);
console.log(`硬件公司池：${hardwareCompanyRows.length}`);
console.log(`硬件优先采样任务：${queueRows.length}`);
