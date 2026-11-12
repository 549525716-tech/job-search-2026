#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const capabilityMatrixPath = join(projectRoot, "02_岗位画像/AI销售岗位能力要求矩阵.csv");
const opportunityMatrixPath = join(projectRoot, "01_行情收集/AI细分赛道销售机会矩阵.csv");
const compensationPath = join(projectRoot, "01_行情收集/AI销售岗位薪资待遇与能力门槛分析.csv");
const resumeGapPath = join(projectRoot, "03_简历/AI销售岗位匹配与能力Gap.csv");
const profilePath = join(projectRoot, "02_岗位画像/data/我的能力画像.json");
const outputMdPath = join(projectRoot, "03_简历/AI销售能力证据与简历改写矩阵.md");
const outputCsvPath = join(projectRoot, "03_简历/AI销售能力证据与简历改写矩阵.csv");

const evidenceMap = {
  "AI/大模型产品理解": {
    metric: "产品/方案数量、客户场景数、Demo/POC次数、试点转化率",
    proof: "写清大模型/Agent/RAG/MaaS/私有化如何解决客户业务问题",
    bullet: "围绕{客户/行业}场景，梳理{AI产品能力}与业务痛点，输出{方案/Demo/POC}，推动{结果/转化/试点}。"
  },
  "ToB/企业服务销售": {
    metric: "线索数、有效商机数、转化率、客单价、销售周期",
    proof: "证明你做的是企业客户的复杂销售流程，而不是单点成交",
    bullet: "面向{企业客户类型}开展ToB销售，完成{线索获取/需求确认/方案推进/商务谈判}，实现{合同额/回款/转化率}。"
  },
  "大客户/KA开发": {
    metric: "KA数量、合同额、决策链层级、推进周期、赢单率",
    proof: "写出客户组织、关键人、预算、竞品和关键推进动作",
    bullet: "负责{行业/区域}KA客户开发，识别{关键人/预算/采购节奏}，推进{方案/试点/商务}，达成{金额/结果}。"
  },
  "行业场景理解": {
    metric: "行业客户数、场景数、痛点归纳、ROI或效率提升",
    proof: "证明你理解制造/政企/金融/教育/互联网等买方业务流程",
    bullet: "沉淀{行业}客户场景，围绕{业务痛点}设计{AI/数字化/解决方案}，帮助客户实现{收益/效率/成本改善}。"
  },
  "方案宣讲/解决方案": {
    metric: "方案页数、宣讲次数、POC数、述标次数、方案通过率",
    proof: "拿出需求调研、方案演示、POC推进或客户汇报证据",
    bullet: "牵头/协同完成{需求调研/方案设计/产品演示/POC}，向{客户角色}汇报方案价值，推动{下一阶段/签约/上线}。"
  },
  "商机挖掘/销售漏斗": {
    metric: "线索来源、有效商机数、漏斗转化率、跟进节奏",
    proof: "证明你能主动产生和推进商机",
    bullet: "搭建{渠道/活动/私域/外呼/伙伴}线索来源，管理{商机漏斗/CRM节奏}，提升{转化率/有效商机/成交数}。"
  },
  "回款/合同/商务闭环": {
    metric: "合同额、回款额、达成率、续费率、增购额、账期",
    proof: "证明你对结果负责，而不只是参与过程",
    bullet: "推进{客户/项目}商务闭环，完成{报价/合同/回款/续费/增购}，实现{合同额/回款额/达成率}。"
  },
  "渠道/生态合作": {
    metric: "伙伴数、激活率、联合商机、渠道收入、区域覆盖",
    proof: "证明你能通过伙伴或生态放大销售覆盖",
    bullet: "拓展并激活{渠道/生态伙伴}，共建{联合方案/商机机制}，贡献{渠道收入/联合商机/区域覆盖}。"
  },
  "市场洞察/竞品反馈": {
    metric: "竞品分析数、客户反馈数、报价/话术/方案调整结果",
    proof: "证明你能把市场信息反哺销售策略",
    bullet: "跟踪{竞品/客户反馈/市场趋势}，优化{销售话术/报价策略/方案包装}，带来{转化/赢单/效率}提升。"
  },
  "项目推进/跨部门协同": {
    metric: "协同部门数、项目周期、交付节点、上线结果、问题关闭率",
    proof: "证明你能调动售前、产品、交付、法务、财务推进复杂项目",
    bullet: "协调{售前/产品/交付/法务/财务}资源，解决{关键卡点}，推动{项目/POC/上线/回款}按期完成。"
  },
  "海外/出海商业化": {
    metric: "区域市场、海外客户数、渠道数、收入、语言/投放资源",
    proof: "证明你能处理跨区域客户、渠道或增长动作",
    bullet: "面向{海外区域/客户类型}开展商业化拓展，利用{渠道/语言/资源}获取{客户/商机/收入}。"
  },
  "硬件/智算/半导体行业销售": {
    metric: "政企/云/IDC客户数、项目金额、招投标次数、交付周期",
    proof: "证明你理解芯片、服务器、智算、IDC、云和生态链路",
    bullet: "围绕{芯片/服务器/智算/IDC}场景推进{政企/云厂商/渠道}项目，协同{售前/交付/生态}完成{投标/方案/交付/回款}。"
  },
  "广告/营销技术销售": {
    metric: "预算规模、消耗、ROI、投放转化、客户续费/增购",
    proof: "证明你理解AI营销、GEO、广告技术或增长转化",
    bullet: "服务{广告主/行业客户}，围绕{AI营销/GEO/投放增长}优化{方案/预算/转化}，实现{ROI/消耗/续费}提升。"
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

function readCsvIfExists(filePath) {
  if (!existsSync(filePath)) return [];
  return parseCsv(readFileSync(filePath, "utf8"));
}

function readJsonIfExists(filePath, fallback = {}) {
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

function splitTerms(value) {
  return String(value || "")
    .split(/[;；、]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function topJoined(values, limit = 6, separator = "、") {
  return unique(values).slice(0, limit).join(separator);
}

function numberOf(value) {
  const num = Number.parseFloat(String(value || "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(num) ? num : 0;
}

function meaningfulProfileValues(value) {
  if (value === null || value === undefined || value === false) return [];
  if (typeof value === "string") {
    const text = value.trim();
    return text ? [text] : [];
  }
  if (typeof value === "number") return Number.isFinite(value) ? [String(value)] : [];
  if (Array.isArray(value)) return value.flatMap((item) => meaningfulProfileValues(item));
  if (typeof value === "object") {
    return Object.entries(value)
      .filter(([key]) => !["targetRoles", "targetRoutes", "targetConstraints", "constraints", "resumeEvidencePriority", "resumeVersions", "canBeUsedInResume", "evidenceIds", "proofIds"].includes(key))
      .flatMap(([, item]) => meaningfulProfileValues(item));
  }
  return [];
}

function profileEvidencePayload(profile) {
  return {
    currentSummary: profile.currentSummary,
    skills: profile.skills,
    evidence: profile.evidence,
    aiProductUnderstanding: profile.aiProductUnderstanding,
    keyAccountExperience: profile.keyAccountExperience,
    solutionAndPresales: profile.solutionAndPresales,
    commercialClosure: profile.commercialClosure,
    channelAndEcosystem: profile.channelAndEcosystem,
    hardwareComputeSemiconductor: profile.hardwareComputeSemiconductor,
    salesManagement: profile.salesManagement
  };
}

function hasMeaningfulProfile(profile) {
  return meaningfulProfileValues(profileEvidencePayload(profile)).length > 0;
}

function profileHasCapability(profileText, capability) {
  const config = evidenceMap[capability] || {};
  const probes = [capability, ...(config.proof || "").split(/[，、/]/), ...(config.metric || "").split(/[，、/]/)]
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);
  return probes.some((probe) => profileText.includes(probe));
}

const weakPattern = /弱|无|缺|不足|待补|没有|尚不足/;
const strongPattern = /强|充分|前置/;
const mediumPattern = /中|已有|可证明|具备/;

const capabilitySkillNames = {
  "AI/大模型产品理解": ["AI/大模型产品理解"],
  "ToB/企业服务销售": ["ToB/企业服务销售"],
  "大客户/KA开发": ["大客户/KA开发"],
  "行业场景理解": ["行业场景理解"],
  "方案宣讲/解决方案": ["方案宣讲/解决方案"],
  "回款/合同/商务闭环": ["回款/合同/商务闭环"],
  "商机挖掘/销售漏斗": ["商机挖掘/销售漏斗"],
  "渠道/生态合作": ["渠道/生态合作"],
  "项目推进/跨部门协同": ["项目推进/跨部门协同"],
  "硬件/智算/半导体行业销售": ["硬件/智算/半导体行业销售"],
  "销售管理/区域负责人": ["销售管理/区域负责人"],
  "广告/营销技术销售": ["行业场景理解", "ToB/企业服务销售"]
};

function findProfileSkill(profile, capability) {
  const names = capabilitySkillNames[capability] || [capability];
  return ensureArray(profile.skills).find((skill) => names.includes(skill.name));
}

function profileCapabilityStatus(profileReady, profile, profileText, capability) {
  if (!profileReady) return "能力画像为空，待补证据";

  if (capability === "海外/出海商业化") {
    return "明显缺口：简历未见海外客户、英文销售或出海商业化证据";
  }

  if (capability === "硬件/智算/半导体行业销售") {
    const hardware = profile.hardwareComputeSemiconductor || {};
    const hasDirectEvidence = ensureArray(hardware.knownProducts).length
      || ensureArray(hardware.customerTypes).length
      || ensureArray(hardware.projectTypes).length
      || ensureArray(hardware.ecosystemExperience).length;
    return hasDirectEvidence
      ? "部分匹配：已有硬件/智算线索，需补客户、项目、金额和交付证据"
      : "明显缺口：无芯片/GPU/服务器/IDC/智算项目销售证据";
  }

  if (capability === "市场洞察/竞品反馈") {
    return profileText.includes("竞品") || profileText.includes("市场洞察")
      ? "部分匹配：需补竞品、报价、方案策略如何影响成交"
      : "弱匹配：有客户反馈和经营复盘，但缺竞品/市场策略证据";
  }

  const skill = findProfileSkill(profile, capability);
  if (skill) {
    const level = String(skill.level || "");
    const evidenceCount = ensureArray(skill.evidenceIds).length;
    if (strongPattern.test(level) && evidenceCount) {
      return level.includes("中强")
        ? `${level}，已有较强证据，但目标行业仍需迁移`
        : `${level}，可作为简历前置优势`;
    }
    if (/^中弱|弱到中|^弱/.test(level)) return `${level || "弱匹配"}，需补真实业务证据`;
    if (/^中/.test(level) || mediumPattern.test(level) || evidenceCount) return `${level || "已有相关证据"}，需补量化和目标行业迁移`;
    if (weakPattern.test(level)) return `${level || "弱匹配"}，需补真实业务证据`;
  }

  return profileHasCapability(profileText, capability)
    ? "仅有关键词线索，需补真实项目证据"
    : "未见明确证据";
}

function routeForCapability(capability, segmentRows) {
  const routeCounts = new Map();
  for (const row of segmentRows) {
    if (!splitTerms(row.coreCapabilities).includes(capability) && !String(row.mustHaveGate || "").includes(capability)) continue;
    routeCounts.set(row.route, (routeCounts.get(row.route) || 0) + 1);
  }
  return [...routeCounts.entries()].sort((a, b) => b[1] - a[1]).map(([route]) => route).join("、");
}

function profileStatus(profileReady, profileText, capability) {
  if (!profileReady) return "能力画像为空，待补证据";
  return profileHasCapability(profileText, capability) ? "已有相关描述，需量化" : "未见明确证据";
}

const capabilityRows = readCsvIfExists(capabilityMatrixPath);
const opportunityRows = readCsvIfExists(opportunityMatrixPath);
const compensationRows = readCsvIfExists(compensationPath);
const gapRows = readCsvIfExists(resumeGapPath);
const profile = readJsonIfExists(profilePath, {});
const profileReady = hasMeaningfulProfile(profile);
const profileText = meaningfulProfileValues(profileEvidencePayload(profile)).join("\n");

const evidenceRows = capabilityRows.map((row) => {
  const capability = row.capability;
  const config = evidenceMap[capability] || {
    metric: "客户数、动作数、结果数据",
    proof: `补充${capability}的真实业务证据`,
    bullet: `围绕{场景}体现${capability}，补充{动作}和{结果}。`
  };
  const relatedSegments = splitTerms(row.prioritySegments);
  const relatedRoles = splitTerms(row.highValueRoles);
  const compMatches = compensationRows
    .filter((item) => splitTerms(item.coreCapabilities).includes(capability) || String(item.mustHaveGate || "").includes(capability))
    .sort((a, b) => numberOf(b.salaryMaxK) - numberOf(a.salaryMaxK));
  const oppMatches = opportunityRows.filter((item) => splitTerms(item.coreCapabilities).includes(capability) || String(item.mustHaveGate || "").includes(capability));
  const gapMatches = gapRows.filter((item) => splitTerms(item.requiredCapabilities).includes(capability) || splitTerms(item.missingCapabilities).includes(capability));
  const salaryMaxK = Math.max(0, ...compMatches.map((item) => numberOf(item.salaryMaxK)), ...oppMatches.map((item) => numberOf(item.salaryMaxK)));
  const priority = numberOf(row.demandScore) >= 220 || salaryMaxK >= 60 ? "P0 简历核心证据" : numberOf(row.demandScore) >= 150 ? "P1 重点补强" : "P2 辅助证据";
  return {
    priority,
    capability,
    demandScore: row.demandScore,
    salaryMaxK: salaryMaxK || "",
    routes: routeForCapability(capability, opportunityRows),
    prioritySegments: topJoined(relatedSegments, 5),
    highValueRoles: topJoined(relatedRoles, 5),
    marketInterpretation: row.interpretation,
    proofObject: config.proof,
    metricsToCollect: config.metric,
    resumeBulletTemplate: config.bullet,
    interviewStoryTemplate: `背景：{客户/行业/业务痛点}；动作：{你的销售/方案/协同动作}；结果：{合同/回款/转化/POC/上线数据}；复盘：{为什么这能迁移到AI岗位}`,
    profileStatus: profileCapabilityStatus(profileReady, profile, profileText, capability),
    missingEvidenceQuestions: [
      `有没有能证明“${capability}”的真实项目？`,
      "客户是谁、痛点是什么、你做了什么？",
      "结果能否量化到金额、转化率、周期、客户数或效率？"
    ].join(" "),
    nextResumeAction: gapMatches[0]?.resumeActions || row.resumeEvidenceTemplate || config.proof,
    sourceBasis: topJoined([
      ...compMatches.slice(0, 3).map((item) => `${item.segment}/${item.role}/${item.salaryBand}`),
      ...oppMatches.slice(0, 2).map((item) => `${item.segment}/${item.salaryBand}`)
    ], 5, "；")
  };
}).sort((a, b) => {
  const priorityWeight = { "P0 简历核心证据": 3, "P1 重点补强": 2, "P2 辅助证据": 1 };
  return (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0)
    || numberOf(b.demandScore) - numberOf(a.demandScore)
    || numberOf(b.salaryMaxK) - numberOf(a.salaryMaxK);
});

const routeRows = unique(opportunityRows.map((row) => row.route)).map((route) => {
  const rows = opportunityRows.filter((row) => row.route === route);
  const capabilities = topJoined(
    rows
      .flatMap((row) => splitTerms(row.coreCapabilities))
      .filter((capability) => evidenceMap[capability]),
    8
  );
  const highValueSegments = rows.slice(0, 4).map((row) => row.segment).join("、");
  const salaryMaxK = Math.max(...rows.map((row) => numberOf(row.salaryMaxK)));
  const evidenceFocus = route.includes("硬件")
    ? "硬件/算力链路、大客户项目、政企/云/IDC生态、渠道协同、招投标和交付回款"
    : route.includes("行业解决方案")
      ? "行业场景、客户痛点、方案/POC、跨部门推进、上线结果和ROI"
      : "AI产品理解、ToB销售、方案价值表达、KA推进、商机漏斗和商务闭环";
  return { route, highValueSegments, salaryMaxK, capabilities, evidenceFocus };
});

const headers = [
  "priority",
  "capability",
  "demandScore",
  "salaryMaxK",
  "routes",
  "prioritySegments",
  "highValueRoles",
  "marketInterpretation",
  "proofObject",
  "metricsToCollect",
  "resumeBulletTemplate",
  "interviewStoryTemplate",
  "profileStatus",
  "missingEvidenceQuestions",
  "nextResumeAction",
  "sourceBasis"
];

const md = `# AI销售能力证据与简历改写矩阵

更新时间：${formatDate()}

## 一、本质判断

这份矩阵不是帮你“美化简历”，而是把市场上的 AI 销售岗位要求翻译成可验证证据：你需要拿出什么项目、什么数据、什么客户场景，才能支撑大模型软件、云/MaaS、芯片/智算、工业AI和安全私有化这些方向的销售岗位。

${profileReady ? "已检测到能力画像内容，本矩阵会提示哪些能力已有描述但仍需量化。" : "当前能力画像基本为空，所以本矩阵默认按“市场要求”生成证据清单；它不判断你真实能力强弱，只告诉你简历必须补什么。"}

## 二、三条路线的简历证据重点

| 主攻路线 | 高价值赛道 | 薪资上限观察 | 核心能力 | 简历证据重点 |
| --- | --- | ---: | --- | --- |
${routeRows.map((row) => `| ${row.route} | ${row.highValueSegments} | ${row.salaryMaxK || "-"}K | ${row.capabilities} | ${row.evidenceFocus} |`).join("\n")}

## 三、能力证据矩阵

| 优先级 | 能力 | 需求分 | 薪资上限观察 | 相关路线 | 高价值岗位 | 需要证明什么 | 量化指标 | 简历表达模板 | 当前画像状态 |
| --- | --- | ---: | ---: | --- | --- | --- | --- | --- | --- |
${evidenceRows.map((row) => `| ${row.priority} | ${row.capability} | ${row.demandScore} | ${row.salaryMaxK || "-"}K | ${row.routes || "-"} | ${row.highValueRoles} | ${row.proofObject} | ${row.metricsToCollect} | ${row.resumeBulletTemplate} | ${row.profileStatus} |`).join("\n")}

## 四、马上补材料的顺序

1. 先补“大客户/KA开发”：客户是谁、决策链、金额、周期、关键动作、结果。
2. 再补“AI/大模型产品理解”：至少写清一个 AI 产品能力如何对应客户业务场景。
3. 再补“方案宣讲/解决方案”：需求调研、Demo/POC、客户汇报或述标证据。
4. 再补“回款/合同/商务闭环”：合同额、回款、达成率、续费或增购。
5. 如果投硬件/智算/半导体，单独补“硬件/算力/生态链路理解”。
6. 如果投销售管理，单独补团队规模、目标拆解、达成率、机制建设。

## 五、面试故事模板

\`\`\`text
背景：客户是谁，所在行业是什么，业务痛点是什么。
目标：客户为什么需要AI/算力/软件/解决方案，预算或业务目标是什么。
动作：我如何找到关键人、拆需求、组织方案、协调售前/交付/商务。
结果：合同额、回款额、POC结果、转化率、客户数、周期缩短或效率提升。
复盘：这个案例能迁移到目标岗位的哪项能力。
\`\`\`

## 六、输出文件

\`\`\`text
${outputCsvPath}
\`\`\`
`;

writeFileSync(outputMdPath, md);
writeFileSync(outputCsvPath, `${csv([headers, ...evidenceRows.map((row) => headers.map((header) => row[header]))])}\n`);

console.log(`已生成：${outputMdPath}`);
console.log(`已生成：${outputCsvPath}`);
console.log(`能力证据项：${evidenceRows.length}`);
console.log(`P0证据项：${evidenceRows.filter((row) => row.priority.startsWith("P0")).length}`);
