#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const profilePath = join(projectRoot, "02_岗位画像/data/我的能力画像.json");
const roleMatrixPath = join(projectRoot, "01_行情收集/AI销售岗位薪资能力矩阵.csv");
const outputMdPath = join(projectRoot, "03_简历/AI销售岗位匹配与能力Gap.md");
const outputCsvPath = join(projectRoot, "03_简历/AI销售岗位匹配与能力Gap.csv");

const capabilityActions = {
  "AI/大模型产品理解": "补一段AI产品理解：能讲清大模型/Agent/RAG/MaaS/私有化在客户业务里的价值。",
  "ToB/企业服务销售": "补一个ToB销售案例：客户类型、痛点、触达方式、推进周期、转化结果。",
  "大客户/KA开发": "补一个KA闭环案例：决策链、关键人、金额/线索规模、推进动作、结果。",
  "行业场景理解": "补行业场景案例：制造/政企/教育/金融/互联网等至少一个具体场景。",
  "方案宣讲/解决方案": "补方案表达证据：需求调研、方案页、Demo/POC、述标或客户汇报。",
  "回款/合同/商务闭环": "补商务闭环数据：合同额、回款、续费、客单价、周期、达成率。",
  "商机挖掘/销售漏斗": "补销售过程指标：线索来源、转化率、跟进节奏、CRM或漏斗管理。",
  "渠道/生态合作": "补渠道/伙伴案例：伙伴数量、激活率、联合商机、渠道收入。",
  "市场洞察/竞品反馈": "补竞品/市场判断：客户为什么买、竞品差异、反馈如何影响方案。",
  "项目推进/跨部门协同": "补协同推进案例：售前/产品/交付/法务/财务如何配合完成项目。",
  "海外/出海商业化": "补出海或跨区域经验：区域、渠道、语言、海外客户或增长动作。",
  "硬件/智算/半导体行业销售": "补硬件链路理解：芯片/服务器/智算中心/IDC/政企项目的销售逻辑。"
};

const capabilityAliases = {
  "AI/大模型产品理解": ["AI", "大模型", "人工智能", "Agent", "RAG", "MaaS", "AIGC", "模型"],
  "ToB/企业服务销售": ["ToB", "B2B", "企业服务", "SaaS", "软件销售", "企业软件"],
  "大客户/KA开发": ["大客户", "KA", "关键客户", "行业客户", "客户开发"],
  "行业场景理解": ["制造", "政企", "金融", "教育", "医疗", "行业", "场景"],
  "方案宣讲/解决方案": ["解决方案", "售前", "方案", "Demo", "POC", "述标"],
  "回款/合同/商务闭环": ["回款", "合同", "签约", "商务", "客单价", "达成率"],
  "商机挖掘/销售漏斗": ["商机", "线索", "转化", "销售漏斗", "CRM"],
  "渠道/生态合作": ["渠道", "生态", "伙伴", "代理商", "合作伙伴"],
  "市场洞察/竞品反馈": ["竞品", "市场", "洞察", "反馈"],
  "项目推进/跨部门协同": ["项目推进", "跨部门", "交付", "实施", "产品", "法务"],
  "海外/出海商业化": ["海外", "出海", "国际", "英文", "跨境"],
  "硬件/智算/半导体行业销售": ["硬件", "智算", "半导体", "芯片", "服务器", "IDC", "算力"]
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

function csvEscape(value) {
  const text = String(value ?? "");
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function csv(rows) {
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function readJsonIfExists(filePath, fallback) {
  if (!existsSync(filePath)) return fallback;
  return JSON.parse(readFileSync(filePath, "utf8"));
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

function profileText(profile) {
  return meaningfulProfileValues(profileEvidencePayload(profile)).join("\n");
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

function assessBaseCapability(profile, capability, text, profileReady) {
  if (!profileReady) {
    return { status: "能力画像未填写，待补证据", weight: 1, severity: "高" };
  }

  if (capability === "海外/出海商业化") {
    return { status: "明显缺口：简历未见海外客户、英文销售或出海商业化证据", weight: 1, severity: "高" };
  }

  if (capability === "市场洞察/竞品反馈") {
    return text.includes("竞品") || text.includes("市场洞察")
      ? { status: "部分匹配：有市场/客户反馈描述，需补竞品和报价策略证据", weight: 0.5, severity: "中" }
      : { status: "弱匹配：有客户反馈和经营复盘，但缺竞品、报价、市场策略证据", weight: 0.75, severity: "中" };
  }

  if (capability === "硬件/智算/半导体行业销售") {
    const hardware = profile.hardwareComputeSemiconductor || {};
    const hasDirectEvidence = ensureArray(hardware.knownProducts).length
      || ensureArray(hardware.customerTypes).length
      || ensureArray(hardware.projectTypes).length
      || ensureArray(hardware.ecosystemExperience).length;
    return hasDirectEvidence
      ? { status: "部分匹配：已有硬件/智算线索，需量化客户和项目", weight: 0.5, severity: "中" }
      : { status: "明显缺口：无芯片/GPU/服务器/IDC/智算项目销售证据", weight: 1, severity: "高" };
  }

  const skill = findProfileSkill(profile, capability);
  if (skill) {
    const level = String(skill.level || "");
    const evidenceCount = ensureArray(skill.evidenceIds).length;
    if (strongPattern.test(level) && evidenceCount) {
      const weight = level.includes("中强") ? 0.25 : 0;
      return {
        status: weight ? `${level}，已有较强证据，但目标行业仍需迁移` : `${level}，可作为简历前置优势`,
        weight,
        severity: weight ? "中低" : "低"
      };
    }
    if (/^中弱|弱到中|^弱/.test(level)) {
      return { status: `${level || "弱匹配"}，需补真实项目证据`, weight: level.includes("中弱") || level.includes("弱到中") ? 0.75 : 1, severity: "中高" };
    }
    if (/^中/.test(level) || mediumPattern.test(level) || evidenceCount) {
      return { status: `${level || "已有相关证据"}，需补量化和目标行业迁移`, weight: 0.5, severity: "中" };
    }
    if (weakPattern.test(level)) {
      return { status: `${level || "弱匹配"}，需补真实项目证据`, weight: 0.75, severity: "中高" };
    }
  }

  const aliases = capabilityAliases[capability] || [capability];
  return aliases.some((alias) => text.includes(alias))
    ? { status: "仅有关键词线索，需补真实证据", weight: 0.75, severity: "中高" }
    : { status: "未见证据，需补强", weight: 1, severity: "高" };
}

function adjustForSegment(row, capability, assessment, profile) {
  const segment = String(row.segment || "");
  const automotiveEvidence = String(profile.currentSummary || "").includes("汽车")
    || ensureArray(profile.evidence).some((item) => String(item.industry || "").includes("汽车"));
  const hardwareSegment = /芯片|GPU|服务器|智算|数据中心|半导体|IDC/.test(segment);
  const industrialSegment = /工业|制造/.test(segment);
  const modelCloudSegment = /大模型|MaaS|云计算|Agent/.test(segment);

  if (hardwareSegment && ["行业场景理解", "大客户/KA开发", "渠道/生态合作", "方案宣讲/解决方案", "回款/合同/商务闭环"].includes(capability)) {
    const note = capability === "行业场景理解"
      ? "行业迁移风险：现有强证据主要在汽车/平台营销，不是硬件、政企、云、IDC或智算客户"
      : "项目迁移风险：现有证据可迁移，但缺硬件/智算项目型销售语境";
    return {
      status: assessment.weight === 0 ? note : `${assessment.status}；${note}`,
      weight: Math.max(assessment.weight, 0.5),
      severity: assessment.severity === "高" ? "高" : "中"
    };
  }

  if (industrialSegment && capability === "行业场景理解" && automotiveEvidence) {
    return {
      status: "行业迁移风险：有汽车客户场景理解，但缺制造业产线、设备、质检、工艺场景证据",
      weight: Math.max(assessment.weight, 0.5),
      severity: "中"
    };
  }

  if (modelCloudSegment && capability === "AI/大模型产品理解" && assessment.weight > 0) {
    return {
      status: `${assessment.status}；高薪大模型/云/MaaS岗位还需要客户级Demo/POC或产品方案证据`,
      weight: Math.max(assessment.weight, 0.75),
      severity: "中高"
    };
  }

  return assessment;
}

function capabilityStatus(row, capability, profile, text, profileReady) {
  return adjustForSegment(row, capability, assessBaseCapability(profile, capability, text, profileReady), profile);
}

function riskLevel(row, gapWeight, severeCount, totalCount, profileReady) {
  if (!profileReady) return "高";
  if (severeCount >= 2 || gapWeight / Math.max(1, totalCount) >= 0.65) return "高";
  if (row.priority === "P0" && (severeCount >= 1 || gapWeight >= 2)) return "中高";
  if (gapWeight >= 1) return "中";
  return "低";
}

function priorityWeight(row) {
  const priority = row.priority === "P0" ? 3 : row.priority === "P1" ? 2 : 1;
  const sampleGap = Number(row.sampleGap || 0);
  const salaryEvidence = Number(row.salaryEvidenceCount || 0);
  return priority * 100 + sampleGap * 2 + salaryEvidence;
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

function mdRows(rows, fallback) {
  return rows.length ? rows.join("\n") : fallback;
}

const profile = readJsonIfExists(profilePath, {});
const matrixRows = existsSync(roleMatrixPath) ? parseCsv(readFileSync(roleMatrixPath, "utf8")) : [];
const profileReady = hasMeaningfulProfile(profile);
const text = profileText(profile);

const gapRows = matrixRows
  .map((row) => {
    const capabilities = String(row.coreCapabilities || "").split(";").map((item) => item.trim()).filter(Boolean);
    const statuses = capabilities.map((capability) => {
      const assessment = capabilityStatus(row, capability, profile, text, profileReady);
      return {
        capability,
        ...assessment,
        action: capabilityActions[capability] || `补充“${capability}”的真实项目证据。`
      };
    });
    const gaps = statuses.filter((item) => item.weight > 0);
    const severe = statuses.filter((item) => item.weight >= 0.75);
    const gapWeight = statuses.reduce((sum, item) => sum + item.weight, 0);
    const matched = statuses.filter((item) => item.weight === 0);
    return {
      priority: row.priority,
      segment: row.segment,
      role: row.role,
      salaryBand: row.salaryBand,
      salaryEvidenceCount: row.salaryEvidenceCount,
      topCompanies: row.topCompanies,
      sampleProgress: row.sampleProgress,
      sampleGap: row.sampleGap,
      fitStatus: profileReady
        ? `${matched.length}/${capabilities.length}项强证据；${severe.length}项硬缺口`
        : "无法判断，能力画像为空",
      riskLevel: riskLevel(row, gapWeight, severe.length, capabilities.length, profileReady),
      requiredCapabilities: capabilities.join(";"),
      missingCapabilities: gaps.map((item) => `${item.capability}（${item.status}）`).join(";") || "暂无明显缺口",
      resumeActions: gaps.length
        ? gaps.map((item) => item.action).slice(0, 4).join(" ")
        : statuses.map((item) => item.action).slice(0, 4).join(" "),
      evidenceExamples: row.evidenceExamples,
      nextAction: row.nextAction,
      gapWeight,
      weight: priorityWeight(row)
    };
  })
  .sort((a, b) => {
    const risk = { "高": 3, "中高": 2.5, "中": 2, "低": 1 };
    return (risk[b.riskLevel] || 0) - (risk[a.riskLevel] || 0) || b.gapWeight - a.gapWeight || b.weight - a.weight;
  });

mkdirSync(dirname(outputMdPath), { recursive: true });

const headers = [
  "priority",
  "segment",
  "role",
  "salaryBand",
  "salaryEvidenceCount",
  "topCompanies",
  "sampleProgress",
  "fitStatus",
  "riskLevel",
  "requiredCapabilities",
  "missingCapabilities",
  "resumeActions",
  "nextAction"
];
writeFileSync(outputCsvPath, `${csv([headers])}\n${csv(gapRows.map((row) => headers.map((header) => row[header])))}\n`);

const topGapRows = gapRows.slice(0, 18).map((row, index) => {
  return `| ${index + 1} | ${row.priority} | ${row.segment} | ${row.role} | ${row.salaryBand} | ${row.fitStatus} | ${row.riskLevel} | ${row.missingCapabilities} | ${row.resumeActions} |`;
});

const roleFocusRows = ["AI软件/大模型销售", "大客户/行业销售经理", "售前/解决方案顾问", "渠道/生态/伙伴销售", "销售管理/区域负责人", "硬件/智算/半导体行业销售"].map((role) => {
  const rows = gapRows.filter((row) => row.role === role);
  const topSegments = rows.slice(0, 4).map((row) => row.segment).join("、");
  const salary = rows.find((row) => row.salaryBand && row.salaryBand !== "待BOSS样本校验")?.salaryBand || "待BOSS样本校验";
  const actions = [...new Set(rows.flatMap((row) => row.missingCapabilities.split(";").filter(Boolean)))].slice(0, 5).join("、");
  return `| ${role} | ${topSegments || "待补"} | ${salary} | ${actions || "暂无明显缺口"} |`;
});

const profileWarning = profileReady
  ? "当前已读取能力画像，但仍需要用真实项目数据校验匹配度。"
  : "当前 `02_岗位画像/data/我的能力画像.json` 基本为空，所以本看板先按“市场要求”生成待补证据清单，不能代表真实能力强弱。";

const profileMemory = profile.profileMemory || {};
const twoStepSelf = profile.twoStepMemory?.step1SelfSummary || {};
const twoStepMarket = profile.twoStepMemory?.step2MarketComparison || {};
const directProof = ensureArray(profileMemory.directProof || twoStepSelf.directEvidence).slice(0, 6).join("<br>");
const transferableProof = ensureArray(profileMemory.transferableProof).slice(0, 5).join("<br>");
const hardBoundaries = ensureArray(profileMemory.hardBoundaries).slice(0, 6).join("<br>");
const priorityRoutes = ensureArray(twoStepMarket.priorityRoutes).slice(0, 6).join("；");
const comparisonRule = profileMemory.comparisonRule || twoStepMarket.comparisonRule || "每个岗位先判断直接匹配、可迁移、硬缺口，再决定简历前置、转译或补课。";

const md = `# AI销售岗位匹配与能力Gap

更新时间：${formatDate()}

## 一、本质判断

这份文件固定按两步使用：先总结你自己，再对比市场岗位。

它不是简历润色，也不是把 JD 关键词直接写进简历。它要先确认你真实能证明什么，再判断 AI/互联网/云/硬件销售岗位要求里哪些是直接匹配、哪些是可迁移、哪些是硬缺口。

${profileWarning}

## 二、第一步：先总结你自己

| 维度 | 当前结论 |
| --- | --- |
| 当前身份 | ${profileMemory.positioning || twoStepSelf.coreIdentity || profile.currentSummary || "待补"} |
| 直接证据 | ${directProof || "待补"} |
| 可迁移证据 | ${transferableProof || "待补"} |
| 不能夸大的边界 | ${hardBoundaries || "待补"} |
| 岗位匹配规则 | ${comparisonRule} |

## 三、第二步：再对比市场

### 核心结论

1. 当前最高优先级不是改措辞，而是补证据：客户、场景、动作、结果、数据、证明材料。
2. 主投 AI软件/大模型销售，需要优先补“AI产品理解 + ToB销售 + 方案价值表达”。
3. 主投硬件/智算/半导体销售，需要补“芯片/服务器/智算链路 + 政企/云/IDC客户 + 长周期项目”。
4. 主投销售管理，需要补“团队规模、目标拆解、达成率、关键客户攻坚、机制建设”。
5. 当前优先路线：${priorityRoutes || "AI应用/营销AI/SaaS、互联网广告/平台型2B、大模型/Agent商业化、云/MaaS、汽车AI补充线"}。

## 四、前18个优先Gap

| 序号 | 优先级 | 赛道 | 岗位方向 | 薪资观察 | 匹配状态 | 风险 | 缺口能力 | 简历补强动作 |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- |
${mdRows(topGapRows, "| 暂无 |  |  |  |  |  |  |  |  |")}

## 五、按岗位方向的简历补强重点

| 岗位方向 | 优先赛道 | 薪资观察 | 需要优先补的能力证据 |
| --- | --- | --- | --- |
${mdRows(roleFocusRows, "| 暂无 |  |  |  |")}

## 六、能力画像补全模板

把下面内容补进 \`02_岗位画像/data/我的能力画像.json\` 或直接整理成简历素材：

1. AI产品理解：你能讲清哪些AI产品/场景？例如大模型、Agent、知识库、智能客服、工业质检、智算服务。
2. 大客户案例：客户是谁？什么行业？你如何进入决策链？周期多长？金额/结果是多少？
3. 售前/方案证据：是否做过需求调研、Demo、POC、方案讲解、投标述标或交付协同？
4. 商务闭环：合同额、回款、续费、客单价、转化率、达成率、团队指标。
5. 硬件/智算经验：是否接触过服务器、IDC、云、芯片、算力、政企项目、渠道伙伴？
6. 管理证据：团队规模、目标拆解、销售预测、过程管理、关键客户攻坚、复盘机制。

## 七、下一步动作

1. 先补能力画像，再运行 \`npm run gap:resume\`。
2. 每补 10 条 BOSS 岗位样本后，运行 \`npm run matrix:roles && npm run gap:resume && npm run report:full\`。
3. 简历首页只放 3 到 4 个已能被项目证明的能力，不放无法举证的关键词。

## 八、文件

\`\`\`text
${outputCsvPath}
\`\`\`
`;

writeFileSync(outputMdPath, md);

console.log(`已生成：${outputMdPath}`);
console.log(`已生成：${outputCsvPath}`);
console.log(`能力画像状态：${profileReady ? "已填写部分信息" : "基本为空"}`);
console.log(`Gap行数：${gapRows.length}`);
