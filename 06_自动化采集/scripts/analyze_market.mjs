#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const jobsPath = join(projectRoot, "01_行情收集/data/jobs.jsonl");
const profilePath = join(projectRoot, "02_岗位画像/data/我的能力画像.json");
const marketReportPath = join(projectRoot, "01_行情收集/市场能力需求看板.md");
const personaReportPath = join(projectRoot, "02_岗位画像/AI互联网销售售前岗位画像.md");
const resumeReportPath = join(projectRoot, "03_简历/简历更新建议.md");

const skillTaxonomy = [
  { key: "大模型/AI产品理解", category: "AI能力", aliases: ["大模型", "人工智能", "AI", "AIGC", "智能体", "Agent", "RAG", "知识库"] },
  { key: "SaaS/企业服务销售", category: "商业能力", aliases: ["SaaS", "企业服务", "软件销售", "企业软件", "ToB", "B2B"] },
  { key: "大客户/KA销售", category: "销售能力", aliases: ["大客户", "KA", "关键客户", "行业客户", "客户开拓"] },
  { key: "商机挖掘与线索转化", category: "销售能力", aliases: ["商机", "线索", "转化", "拓客", "客户开发", "BD"] },
  { key: "解决方案能力", category: "售前能力", aliases: ["解决方案", "方案顾问", "方案设计", "方案撰写", "行业方案"] },
  { key: "售前演示/POC", category: "售前能力", aliases: ["售前", "演示", "Demo", "POC", "技术交流", "需求调研"] },
  { key: "行业客户理解", category: "行业能力", aliases: ["金融", "汽车", "教育", "政企", "制造", "零售", "医疗", "行业"] },
  { key: "CRM与销售过程管理", category: "销售能力", aliases: ["CRM", "销售流程", "销售漏斗", "回款", "续费", "预测"] },
  { key: "招投标/标书", category: "售前能力", aliases: ["招投标", "投标", "标书", "述标", "控标"] },
  { key: "客户成功/交付协同", category: "交付能力", aliases: ["客户成功", "交付", "实施", "上线", "项目管理", "续约"] },
  { key: "渠道/生态合作", category: "商业能力", aliases: ["渠道", "伙伴", "生态", "代理商", "合作伙伴"] },
  { key: "数据分析与业务复盘", category: "经营能力", aliases: ["数据分析", "复盘", "指标", "增长", "ROI", "转化率"] },
  { key: "沟通谈判与高层对话", category: "通用能力", aliases: ["沟通", "谈判", "高层", "决策链", "影响力"] },
  { key: "产品/API/技术基础", category: "技术理解", aliases: ["API", "接口", "私有化", "云服务", "模型", "技术方案"] }
];

function readJobs() {
  if (!existsSync(jobsPath)) return [];
  return readFileSync(jobsPath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function readProfile() {
  if (!existsSync(profilePath)) {
    return {
      name: "",
      targetRoles: [],
      skills: [],
      evidence: [],
      constraints: []
    };
  }
  return JSON.parse(readFileSync(profilePath, "utf8"));
}

function includesAny(text, aliases) {
  const lower = text.toLowerCase();
  return aliases.some((alias) => lower.includes(alias.toLowerCase()));
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

function profileEvidenceText(profile) {
  return meaningfulProfileValues({
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
  }).join("\n");
}

function countSkills(jobs) {
  return skillTaxonomy
    .map((skill) => {
      const matchedJobs = jobs.filter((job) => {
        const text = [job.title, job.query, job.roleFamily, job.rawText, job.detailText].filter(Boolean).join("\n");
        return includesAny(text, skill.aliases);
      });
      return {
        ...skill,
        count: matchedJobs.length,
        ratio: jobs.length === 0 ? 0 : matchedJobs.length / jobs.length
      };
    })
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key, "zh-Hans-CN"));
}

function countRoleFamilies(jobs) {
  const counts = new Map();
  for (const job of jobs) {
    const family = job.roleFamily || inferFamily(job);
    counts.set(family, (counts.get(family) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function inferFamily(job) {
  const text = [job.title, job.query, job.rawText].filter(Boolean).join(" ");
  if (/售前|解决方案|POC|架构师|顾问/.test(text)) return "售前/解决方案";
  if (/客户成功|交付|实施/.test(text)) return "客户成功/交付";
  if (/销售|BD|商务|大客户|KA/.test(text)) return "销售/商务";
  return "未分类";
}

function hasCandidateSkill(profile, skill) {
  return includesAny(profileEvidenceText(profile), [skill.key, ...skill.aliases]);
}

function tableRows(rows, emptyRow) {
  if (rows.length === 0) return emptyRow;
  return rows.join("\n");
}

function formatDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

const jobs = readJobs();
const profile = readProfile();
const skills = countSkills(jobs);
const roleFamilies = countRoleFamilies(jobs);
const topSkills = skills.filter((skill) => skill.count > 0).slice(0, 12);
const gaps = topSkills.filter((skill) => !hasCandidateSkill(profile, skill));
const strengths = topSkills.filter((skill) => hasCandidateSkill(profile, skill));
const now = formatDate();

const marketReport = `# 市场能力需求看板

更新时间：${now}

## 一、本质判断

当前看板不是简单统计关键词，而是判断 AI/互联网销售与售前岗位正在反复购买哪些能力。

样本数量：${jobs.length}

${jobs.length < 20 ? "> 样本量还不够稳定。建议至少收集 20 到 30 条高相关岗位后再做强结论。\n" : ""}

## 二、岗位方向分布

| 岗位方向 | 样本数 |
| --- | ---: |
${tableRows(roleFamilies.map(([family, count]) => `| ${family} | ${count} |`), "| 暂无数据 | 0 |")}

## 三、高频能力需求

| 排名 | 能力 | 类别 | 出现次数 | 样本占比 |
| ---: | --- | --- | ---: | ---: |
${tableRows(topSkills.map((skill, index) => `| ${index + 1} | ${skill.key} | ${skill.category} | ${skill.count} | ${Math.round(skill.ratio * 100)}% |`), "| - | 暂无数据 | - | 0 | 0% |")}

## 四、初步判断

从当前样本看，市场更关注的不是单一销售动作，而是“AI/企业服务理解 + 行业客户开发 + 解决方案表达 + 售前协同”的复合能力。

## 五、下一步采集重点

- 补足近期发布岗位，避免只看旧岗位。
- 分开统计销售岗与售前岗，不把两类能力混在一起。
- 对高薪岗位单独建样本，观察高薪背后的硬门槛。
- 记录每个岗位的业务对象：政企、金融、汽车、教育、制造、零售等。
`;

const personaReport = `# AI/互联网销售售前岗位画像

更新时间：${now}

## 一、岗位本质

这类岗位表面上是销售、售前或解决方案岗位。

本质上是帮助公司把 AI、SaaS、企业软件或技术产品转化成客户可理解、可采购、可落地的业务方案。

## 二、核心能力模型

| 能力 | 市场热度 | 你的匹配状态 | 简历证据要求 |
| --- | ---: | --- | --- |
${tableRows(topSkills.map((skill) => `| ${skill.key} | ${skill.count} | ${hasCandidateSkill(profile, skill) ? "已有线索" : "待补证据"} | 需要具体项目、客户、动作、结果 |`), "| 暂无数据 | 0 | 待补样本 | 先采集岗位样本 |")}

## 三、当前能力缺口

${gaps.length === 0 ? "暂未识别明确缺口。可能是样本不足，或能力画像尚未填写。" : gaps.map((skill, index) => `${index + 1}. ${skill.key}：需要补充经历证据，或在简历中解释迁移能力。`).join("\n")}

## 四、当前可强化优势

${strengths.length === 0 ? "请先补充 `02_岗位画像/data/我的能力画像.json`，否则无法判断已有优势。" : strengths.map((skill, index) => `${index + 1}. ${skill.key}：可以前置到简历核心摘要或重点项目。`).join("\n")}

## 五、岗位筛选建议

优先看：

- AI/大模型、SaaS、企业服务方向的销售和售前岗位。
- JD 中同时出现客户开发、方案、演示、POC、行业客户的岗位。
- 对行业理解和项目推进有要求，而不是只看电话销售数量的岗位。

谨慎看：

- 只强调陌拜、电话量、地推，缺少产品或方案含量的岗位。
- 岗位职责混乱，同时要求销售、运营、交付、客服全包的岗位。
- 薪资很高但 JD 没有清晰业务对象的岗位。
`;

const resumeReport = `# 简历更新建议

更新时间：${now}

## 一、简历主线

目标简历不应写成泛销售简历，而应写成：

AI/互联网/企业服务方向的商业化人才，能够理解产品价值、识别客户需求、推进商机转化，并与售前或交付协同完成解决方案落地。

## 二、需要前置的能力

${topSkills.length === 0 ? "暂无岗位样本。请先采集岗位后再生成简历建议。" : topSkills.slice(0, 8).map((skill, index) => `${index + 1}. ${skill.key}`).join("\n")}

## 三、需要补充的简历证据

${gaps.length === 0 ? "请补充能力画像或更多岗位样本后再判断。" : gaps.slice(0, 8).map((skill, index) => `${index + 1}. ${skill.key}：补充一个真实案例，按“客户/场景 + 我的动作 + 结果数据 + 可证明材料”整理。`).join("\n")}

## 四、改写方向

- 把“负责销售工作”改成“围绕什么客户、什么产品、什么业务目标推进商机”。
- 把“沟通能力强”改成“如何识别需求、影响决策链、推动方案或签约”。
- 把“了解 AI/互联网”改成“理解哪些 AI 产品、使用过哪些场景、能讲清楚什么业务价值”。
- 把“参与项目”改成“我在项目中承担什么角色，推动了什么结果”。

## 五、下一版简历结构

1. 个人定位：AI/企业服务商业化或售前解决方案方向。
2. 核心优势：从市场高频能力中选 3 到 4 个与你最匹配的能力。
3. 代表项目：每个项目对应一个岗位高频要求。
4. 工作经历：突出客户、产品、动作、结果。
5. 技能关键词：只放能被项目证明的关键词。
`;

mkdirSync(dirname(marketReportPath), { recursive: true });
mkdirSync(dirname(personaReportPath), { recursive: true });
mkdirSync(dirname(resumeReportPath), { recursive: true });

writeFileSync(marketReportPath, marketReport);
writeFileSync(personaReportPath, personaReport);
writeFileSync(resumeReportPath, resumeReport);

console.log(`样本数量：${jobs.length}`);
console.log(`已更新：${marketReportPath}`);
console.log(`已更新：${personaReportPath}`);
console.log(`已更新：${resumeReportPath}`);
