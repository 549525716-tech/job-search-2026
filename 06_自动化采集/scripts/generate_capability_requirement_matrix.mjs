#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const roleMatrixPath = join(projectRoot, "01_行情收集/AI销售岗位薪资能力矩阵.csv");
const bossCapabilityPath = join(projectRoot, "01_行情收集/BOSS能力信号样本.csv");
const externalSalarySignalsPath = join(projectRoot, "06_自动化采集/config/external_salary_signals.csv");
const publicMarketSourcesPath = join(projectRoot, "06_自动化采集/config/public_market_sources.csv");
const outputMdPath = join(projectRoot, "02_岗位画像/AI销售岗位能力要求矩阵.md");
const outputCsvPath = join(projectRoot, "02_岗位画像/AI销售岗位能力要求矩阵.csv");

const capabilityTaxonomy = {
  "AI/大模型产品理解": {
    aliases: ["AI", "人工智能", "大模型", "AIGC", "Agent", "智能体", "MaaS", "Maas", "RAG", "数字人", "模型", "DeepSeek", "豆包", "千问"],
    interpretation: "能把大模型、Agent、MaaS、RAG、私有化等概念翻译成客户业务价值。",
    evidence: "写清卖过/讲过的AI产品、客户场景、方案价值、客户为什么需要它。"
  },
  "ToB/企业服务销售": {
    aliases: ["ToB", "B2B", "企业服务", "SaaS", "软件销售", "企业软件", "企业", "机构"],
    interpretation: "面向企业客户做线索、需求、方案、商务和交付协同，而不是零售式销售。",
    evidence: "写清客户类型、客单价、决策链、销售周期、转化率、签约/回款结果。"
  },
  "大客户/KA开发": {
    aliases: ["大客户", "KA", "关键客户", "重点客户", "行业客户", "客户开发", "客户开拓", "客户经理"],
    interpretation: "能进入复杂客户组织，识别关键人、预算、竞品和采购节奏。",
    evidence: "写一个KA从线索到签约的闭环案例，包含金额、周期、关键动作。"
  },
  "行业场景理解": {
    aliases: ["制造", "政企", "金融", "教育", "医疗", "汽车", "游戏", "零售", "运营商", "智慧城市", "行业", "场景"],
    interpretation: "懂客户行业业务流、痛点和采购逻辑，能把AI能力嵌到具体场景。",
    evidence: "选择一个主攻行业，写清客户业务问题、AI解决路径和落地收益。"
  },
  "方案宣讲/解决方案": {
    aliases: ["方案", "解决方案", "售前", "产品汇报", "宣讲", "Demo", "POC", "述标", "API", "模型微调", "私有化", "部署"],
    interpretation: "能把产品能力包装成方案，配合售前/产品完成Demo、POC、述标或方案汇报。",
    evidence: "放一段需求调研、方案演示、POC推进或客户汇报的项目证据。"
  },
  "商机挖掘/销售漏斗": {
    aliases: ["商机", "线索", "拓客", "转化", "销售漏斗", "CRM", "跟进", "挖掘"],
    interpretation: "能持续产生和推进商机，而不是只等线索分配。",
    evidence: "写清线索来源、触达方式、跟进节奏、转化率和有效商机数。"
  },
  "回款/合同/商务闭环": {
    aliases: ["回款", "合同", "签约", "成交", "商务", "客单价", "达成率", "销售业绩", "收入"],
    interpretation: "能把机会推进到合同、回款、续费或增购，承担结果责任。",
    evidence: "写清合同额、回款额、业绩目标、达成率、提成/续费/增购结果。"
  },
  "渠道/生态合作": {
    aliases: ["渠道", "生态", "伙伴", "代理", "合作伙伴", "流量资源", "联合方案"],
    interpretation: "能通过伙伴、渠道或生态联合获客，适合云、硬件、半导体、SaaS等方向。",
    evidence: "写清渠道数量、激活率、联合商机、渠道收入或区域覆盖结果。"
  },
  "市场洞察/竞品反馈": {
    aliases: ["市场", "竞品", "洞察", "趋势", "反馈", "预测", "策略", "信息动态"],
    interpretation: "能把客户反馈、竞品变化和行业趋势反哺产品、方案和销售策略。",
    evidence: "写清一次竞品/客户反馈如何影响报价、方案、话术或产品迭代。"
  },
  "项目推进/跨部门协同": {
    aliases: ["项目推进", "跨部门", "协同", "交付", "实施", "产品", "研发", "法务", "财务", "组织资源"],
    interpretation: "能协调售前、产品、交付、法务、财务等资源推进复杂项目。",
    evidence: "写清协同角色、卡点、推进动作和最终结果。"
  },
  "海外/出海商业化": {
    aliases: ["海外", "出海", "东南亚", "欧美", "国际", "跨境", "Google", "Youtube", "Facebook", "TikTok"],
    interpretation: "面向海外客户、广告主、渠道或区域市场做商业化拓展。",
    evidence: "写清区域、客户类型、语言/渠道资源、获客和收入结果。"
  },
  "硬件/智算/半导体行业销售": {
    aliases: ["硬件", "芯片", "半导体", "GPU", "服务器", "智算", "IDC", "数据中心", "算力", "液冷", "加速卡"],
    interpretation: "理解芯片、服务器、智算中心、云边端和生态链路，能做长周期项目型销售。",
    evidence: "写清硬件/政企/渠道/招投标/交付协同案例，体现项目周期和客户类型。"
  },
  "广告/营销技术销售": {
    aliases: ["广告", "营销", "GEO", "程序化", "CPA", "CPC", "CPM", "DSP", "SSP", "投放", "增长"],
    interpretation: "理解AI营销、广告技术、GEO、程序化投放和增长转化场景。",
    evidence: "写清服务过的广告主/行业、投放或增长指标、客户预算和回款结果。"
  }
};

const canonicalSegments = [
  "基座大模型/Agent平台",
  "云计算/大模型平台",
  "智能客服/营销/销售AI",
  "AI芯片/GPU/加速卡",
  "AI服务器/智算基础设施",
  "工业AI/智能制造",
  "AI Agent/RPA/流程自动化",
  "数据/MLOps/AI基础软件",
  "智能汽车/机器人/具身智能",
  "AI安全/私有化/信创",
  "AI视觉/安防/质检",
  "智算中心/数据中心服务"
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

function weightForPriority(priority) {
  if (priority === "P0") return 8;
  if (priority === "P1") return 5;
  if (priority === "P2") return 3;
  return 1;
}

function canonicalSegment(value) {
  const text = String(value || "");
  if (canonicalSegments.includes(text)) return text;
  if (/基座|大模型产品|AI软件|人工智能软件|数字人|智谱|月之暗面|MiniMax/.test(text)) return "基座大模型/Agent平台";
  if (/云计算|大模型平台|阿里云|MaaS|Maas|公有云|私有化MaaS/.test(text)) return "云计算/大模型平台";
  if (/客服|营销|GEO|销售AI|广告|增长|智能体|SaaS出海/.test(text)) return "智能客服/营销/销售AI";
  if (/芯片|GPU|加速卡|半导体/.test(text)) return "AI芯片/GPU/加速卡";
  if (/服务器|AI服务器|智算基础|英伟达产业链/.test(text)) return "AI服务器/智算基础设施";
  if (/工业|智能制造|制造行业/.test(text)) return "工业AI/智能制造";
  if (/RPA|流程自动化/.test(text)) return "AI Agent/RPA/流程自动化";
  if (/大数据|MLOps|数据/.test(text)) return "数据/MLOps/AI基础软件";
  if (/汽车|机器人|具身|智能硬件/.test(text)) return "智能汽车/机器人/具身智能";
  if (/安全|信创|私有化/.test(text)) return "AI安全/私有化/信创";
  if (/视觉|安防|质检/.test(text)) return "AI视觉/安防/质检";
  if (/IDC|数据中心|智算中心/.test(text)) return "智算中心/数据中心服务";
  return "";
}

function capabilitiesInText(value) {
  const text = String(value || "");
  return Object.entries(capabilityTaxonomy)
    .filter(([, config]) => config.aliases.some((alias) => text.includes(alias)))
    .map(([capability]) => capability);
}

function ensureRecord(map, capability) {
  if (!map.has(capability)) {
    map.set(capability, {
      capability,
      demandScore: 0,
      matrixRoleCount: 0,
      bossEvidenceCount: 0,
      publicEvidenceCount: 0,
      salarySignalCount: 0,
      segments: new Set(),
      roles: new Set(),
      companies: new Set(),
      sourceExamples: []
    });
  }
  return map.get(capability);
}

function addEvidence(map, capability, options) {
  const record = ensureRecord(map, capability);
  record.demandScore += options.score || 0;
  record.matrixRoleCount += options.matrixRoleCount || 0;
  record.bossEvidenceCount += options.bossEvidenceCount || 0;
  record.publicEvidenceCount += options.publicEvidenceCount || 0;
  record.salarySignalCount += options.salarySignalCount || 0;
  const normalizedSegment = canonicalSegment(options.segment);
  if (normalizedSegment) record.segments.add(normalizedSegment);
  if (options.role) record.roles.add(options.role);
  if (options.company) record.companies.add(options.company);
  if (options.example && record.sourceExamples.length < 5) record.sourceExamples.push(options.example);
}

function topList(values, limit = 6) {
  return [...values].filter(Boolean).slice(0, limit).join(";");
}

function mdRows(rows, fallback) {
  return rows.length ? rows.join("\n") : fallback;
}

const roleMatrixRows = readCsvIfExists(roleMatrixPath);
const bossCapabilityRows = readCsvIfExists(bossCapabilityPath);
const externalSalaryRows = readCsvIfExists(externalSalarySignalsPath);
const publicSourceRows = readCsvIfExists(publicMarketSourcesPath);

const records = new Map();

for (const row of roleMatrixRows) {
  const score = weightForPriority(row.priority);
  for (const capability of String(row.coreCapabilities || "").split(";").map((item) => item.trim()).filter(Boolean)) {
    addEvidence(records, capability, {
      score,
      matrixRoleCount: 1,
      segment: row.segment,
      role: row.role,
      company: String(row.topCompanies || "").split(";")[0],
      example: `${row.segment}/${row.role}`
    });
  }
}

for (const row of bossCapabilityRows) {
  addEvidence(records, row.capability, {
    score: 6,
    bossEvidenceCount: 1,
    segment: row.segment,
    role: row.rolePosition,
    company: row.company,
    example: `BOSS:${row.company}/${row.title}`
  });
}

for (const row of externalSalaryRows) {
  const text = [row.role, row.company_or_page, row.segment, row.requirement_signal].join(" ");
  for (const capability of capabilitiesInText(text)) {
    addEvidence(records, capability, {
      score: 3,
      salarySignalCount: 1,
      segment: canonicalSegment(text),
      role: row.role,
      company: row.company_or_page,
      example: `${row.platform}:${row.company_or_page}/${row.role}`
    });
  }
}

for (const row of publicSourceRows) {
  const text = [row.topic, row.key_signal, row.sales_implication].join(" ");
  for (const capability of capabilitiesInText(text)) {
    addEvidence(records, capability, {
      score: 2,
      publicEvidenceCount: 1,
      segment: canonicalSegment(text),
      role: "公开趋势",
      company: row.source,
      example: `${row.source}:${row.topic}`
    });
  }
}

const capabilityRows = [...records.values()]
  .map((record) => {
    const config = capabilityTaxonomy[record.capability] || {};
    return {
      capability: record.capability,
      demandScore: record.demandScore,
      matrixRoleCount: record.matrixRoleCount,
      bossEvidenceCount: record.bossEvidenceCount,
      publicEvidenceCount: record.publicEvidenceCount,
      salarySignalCount: record.salarySignalCount,
      segmentCount: record.segments.size,
      roleCount: record.roles.size,
      prioritySegments: topList(record.segments, 8),
      highValueRoles: topList(record.roles, 8),
      interpretation: config.interpretation || "",
      resumeEvidenceTemplate: config.evidence || "",
      sourceExamples: record.sourceExamples.join("; ")
    };
  })
  .sort((a, b) => b.demandScore - a.demandScore || b.segmentCount - a.segmentCount || a.capability.localeCompare(b.capability, "zh-Hans-CN"));

const segmentCapabilityRows = [...new Set(roleMatrixRows.map((row) => row.segment))]
  .map((segment) => {
    const rows = roleMatrixRows.filter((row) => row.segment === segment);
    const capabilityScores = new Map();
    for (const row of rows) {
      for (const capability of String(row.coreCapabilities || "").split(";").map((item) => item.trim()).filter(Boolean)) {
        capabilityScores.set(capability, (capabilityScores.get(capability) || 0) + weightForPriority(row.priority) + Number(row.salaryEvidenceCount || 0));
      }
    }
    const topCapabilities = [...capabilityScores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([capability]) => capability)
      .join(";");
    const salaryBands = [...new Set(rows.map((row) => row.salaryBand).filter((item) => item && item !== "待BOSS样本校验"))].slice(0, 3).join(";");
    const sampleGap = Math.max(...rows.map((row) => Number(row.sampleGap || 0)));
    const priority = rows[0]?.priority || "";
    return { priority, segment, topCapabilities, salaryBands: salaryBands || "待BOSS样本校验", sampleGap };
  })
  .sort((a, b) => weightForPriority(b.priority) - weightForPriority(a.priority) || b.sampleGap - a.sampleGap);

const roleCapabilityRows = [...new Set(roleMatrixRows.map((row) => row.role))]
  .map((role) => {
    const rows = roleMatrixRows.filter((row) => row.role === role);
    const capabilityScores = new Map();
    for (const row of rows) {
      for (const capability of String(row.coreCapabilities || "").split(";").map((item) => item.trim()).filter(Boolean)) {
        capabilityScores.set(capability, (capabilityScores.get(capability) || 0) + weightForPriority(row.priority));
      }
    }
    const topCapabilities = [...capabilityScores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([capability]) => capability)
      .join(";");
    const topSegments = rows.slice(0, 5).map((row) => row.segment).join(";");
    const salaryBands = [...new Set(rows.map((row) => row.salaryBand).filter((item) => item && item !== "待BOSS样本校验"))].slice(0, 3).join(";");
    return { role, topSegments, topCapabilities, salaryBands: salaryBands || "待BOSS样本校验" };
  });

mkdirSync(dirname(outputMdPath), { recursive: true });

const headers = [
  "capability",
  "demandScore",
  "matrixRoleCount",
  "bossEvidenceCount",
  "publicEvidenceCount",
  "salarySignalCount",
  "segmentCount",
  "roleCount",
  "prioritySegments",
  "highValueRoles",
  "interpretation",
  "resumeEvidenceTemplate",
  "sourceExamples"
];
writeFileSync(outputCsvPath, `${csv([headers])}\n${csv(capabilityRows.map((row) => headers.map((header) => row[header])))}\n`);

const topCapabilityMdRows = capabilityRows.slice(0, 12).map((row, index) => {
  return `| ${index + 1} | ${row.capability} | ${row.demandScore} | ${row.segmentCount} | ${row.matrixRoleCount} | ${row.bossEvidenceCount} | ${row.publicEvidenceCount + row.salarySignalCount} | ${row.prioritySegments} | ${row.resumeEvidenceTemplate} |`;
});

const segmentMdRows = segmentCapabilityRows.map((row) => {
  return `| ${row.priority} | ${row.segment} | ${row.topCapabilities} | ${row.salaryBands} | ${row.sampleGap} |`;
});

const roleMdRows = roleCapabilityRows.map((row) => {
  return `| ${row.role} | ${row.topSegments} | ${row.topCapabilities} | ${row.salaryBands} |`;
});

const evidenceMdRows = capabilityRows.slice(0, 10).map((row) => {
  return `| ${row.capability} | ${row.interpretation} | ${row.resumeEvidenceTemplate} | ${row.sourceExamples || "待补样本"} |`;
});

const md = `# AI销售岗位能力要求矩阵

更新时间：${formatDate()}

## 一、本质判断

这份矩阵不是简历关键词表，而是把 BOSS 样本、岗位薪资矩阵、公开薪资信号和产业趋势信号合并后，反推“AI销售岗位正在为什么能力付费”。

当前最大的矛盾是：市场需要复合型能力，但简历不能只堆概念，必须把能力转换成能被招聘方验证的项目证据。

## 二、全局能力优先级

| 排名 | 能力 | 需求分 | 覆盖赛道 | 矩阵岗位行 | BOSS证据 | 公开/薪资证据 | 重点赛道 | 简历证据写法 |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
${mdRows(topCapabilityMdRows, "| 暂无 |  | 0 | 0 | 0 | 0 | 0 |  |  |")}

## 三、分赛道能力要求

| 优先级 | 赛道 | 最核心能力 | 薪资观察 | BOSS样本缺口 |
| --- | --- | --- | --- | ---: |
${mdRows(segmentMdRows, "| 暂无 |  |  |  | 0 |")}

## 四、岗位层级能力要求

| 岗位层级 | 重点赛道 | 高频能力 | 薪资观察 |
| --- | --- | --- | --- |
${mdRows(roleMdRows, "| 暂无 |  |  |  |")}

## 五、能力到简历证据

| 能力 | 市场含义 | 简历证据模板 | 证据样例 |
| --- | --- | --- | --- |
${mdRows(evidenceMdRows, "| 暂无 |  |  |  |")}

## 六、下一步使用方法

1. 简历首页只放排名前 6 且自己能举证的能力。
2. 每补 5 到 10 条 BOSS 岗位样本后，运行 \`npm run capability:matrix && npm run gap:resume && npm run report:full\`。
3. 如果某个能力只有公开趋势证据、缺少 BOSS 证据，先不要写成强结论，只作为采样方向。
4. 简历改写时优先使用“客户类型 + 场景 + 动作 + 结果”的证据格式。

## 七、边界

当前输入包括岗位薪资能力矩阵 ${roleMatrixRows.length} 行、BOSS能力信号 ${bossCapabilityRows.length} 条、公开薪资信号 ${externalSalaryRows.length} 条、公开趋势来源 ${publicSourceRows.length} 条。由于 BOSS 大样本仍不足，这份能力矩阵是“市场要求假设 + 已采样本验证”的阶段性版本。

## 八、文件

\`\`\`text
${outputCsvPath}
\`\`\`
`;

writeFileSync(outputMdPath, md);

console.log(`已生成：${outputMdPath}`);
console.log(`已生成：${outputCsvPath}`);
console.log(`能力项：${capabilityRows.length}`);
console.log(`BOSS能力证据：${bossCapabilityRows.length}`);
