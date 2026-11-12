#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const profilePath = join(projectRoot, "02_岗位画像/data/我的能力画像.json");
const inboxPath = join(projectRoot, "02_岗位画像/我的能力画像收件箱.md");
const inboxTemplatePath = join(projectRoot, "02_岗位画像/我的能力画像收件箱模板.md");
const resumeMaterialPath = join(projectRoot, "03_简历/简历素材库.md");

const sectionStart = "<!-- PROFILE_INBOX_ITEM_START -->";
const sectionEnd = "<!-- PROFILE_INBOX_ITEM_END -->";
const textStart = "<!-- PROFILE_INBOX_TEXT_START -->";
const textEnd = "<!-- PROFILE_INBOX_TEXT_END -->";

const capabilityRules = [
  { capability: "AI/大模型产品理解", probes: ["AI", "大模型", "Agent", "RAG", "MaaS", "AIGC", "智能体", "模型", "知识库"] },
  { capability: "ToB/企业服务销售", probes: ["ToB", "B2B", "企业", "SaaS", "软件", "客户", "商机", "销售"] },
  { capability: "大客户/KA开发", probes: ["大客户", "KA", "关键人", "决策链", "预算", "招投标", "客户开发"] },
  { capability: "行业场景理解", probes: ["制造", "政企", "金融", "教育", "医疗", "汽车", "互联网", "行业", "场景", "痛点"] },
  { capability: "方案宣讲/解决方案", probes: ["解决方案", "方案", "售前", "Demo", "POC", "述标", "汇报", "需求调研"] },
  { capability: "回款/合同/商务闭环", probes: ["合同", "回款", "签约", "续费", "增购", "客单价", "达成率", "收入", "GMV"] },
  { capability: "商机挖掘/销售漏斗", probes: ["线索", "商机", "转化率", "漏斗", "CRM", "外呼", "获客"] },
  { capability: "渠道/生态合作", probes: ["渠道", "伙伴", "生态", "代理商", "合作伙伴", "联合商机"] },
  { capability: "市场洞察/竞品反馈", probes: ["竞品", "市场", "反馈", "洞察", "报价", "话术"] },
  { capability: "项目推进/跨部门协同", probes: ["跨部门", "产品", "交付", "法务", "财务", "实施", "协同"] },
  { capability: "海外/出海商业化", probes: ["海外", "出海", "国际", "英文", "跨境"] },
  { capability: "硬件/智算/半导体行业销售", probes: ["硬件", "芯片", "半导体", "服务器", "智算", "IDC", "算力", "GPU"] },
  { capability: "销售管理/区域负责人", probes: ["团队", "管理", "带团队", "目标拆解", "forecast", "预测", "管道"] }
];

function usage() {
  return `Usage:
  npm run profile:inbox
  npm run profile:import
  npm run profile:import -- --dry-run
  npm run profile:status

Direct:
  node 06_自动化采集/scripts/profile_inbox.mjs generate
  node 06_自动化采集/scripts/profile_inbox.mjs import [--dry-run]
  node 06_自动化采集/scripts/profile_inbox.mjs status
`;
}

function parseArgs(argv) {
  const args = { command: argv[2] || "generate" };
  for (let i = 3; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === "--dry-run") args.dryRun = true;
    else if (key === "--help" || key === "-h") args.help = true;
    else throw new Error(`Unknown option: ${key}`);
  }
  return args;
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function formatDateTime(value = new Date()) {
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

function readJsonIfExists(filePath, fallback = {}) {
  if (!existsSync(filePath)) return fallback;
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeText(value) {
  return String(value || "").replace(/\r/g, "").trim();
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function addUnique(array, value) {
  const text = normalizeText(value);
  if (!text) return array;
  if (!array.includes(text)) array.push(text);
  return array;
}

function splitList(value) {
  return String(value || "")
    .split(/[;；、,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getField(fields, ...names) {
  for (const name of names) {
    if (fields[name]) return fields[name];
  }
  return "";
}

function parseFields(text) {
  const fields = {};
  const lines = normalizeText(text).split(/\n/);
  let currentKey = "";
  for (const line of lines) {
    const match = line.match(/^\s*([^：:]{2,24})[：:]\s*(.*)$/);
    if (match) {
      currentKey = match[1].trim();
      fields[currentKey] = [match[2].trim()].filter(Boolean).join("\n");
    } else if (currentKey && line.trim()) {
      fields[currentKey] = `${fields[currentKey] ? `${fields[currentKey]}\n` : ""}${line.trim()}`;
    }
  }
  return fields;
}

function cleanInboxText(text) {
  return normalizeText(text)
    .split(/\n/)
    .filter((line) => !/^在这里粘贴/.test(line.trim()))
    .filter((line) => !/^可选字段：/.test(line.trim()))
    .join("\n")
    .trim();
}

function parseInboxItems(text) {
  const items = [];
  const pattern = new RegExp(`${sectionStart}[\\s\\S]*?${textStart}\\s*([\\s\\S]*?)\\s*${textEnd}[\\s\\S]*?${sectionEnd}`, "g");
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const body = cleanInboxText(match[1]);
    if (!body) continue;
    items.push({
      rawText: body,
      fields: parseFields(body)
    });
  }
  return items;
}

function inferCapabilities(text) {
  const source = String(text || "");
  return capabilityRules
    .filter((rule) => rule.probes.some((probe) => source.includes(probe)))
    .map((rule) => rule.capability);
}

function inferRoute(text) {
  if (/芯片|半导体|硬件|服务器|智算|IDC|算力|GPU/.test(text)) return "硬件/算力/半导体路线";
  if (/制造|工业|政企|安全|信创|汽车|机器人|视觉|质检/.test(text)) return "行业解决方案路线";
  if (/AI|大模型|Agent|RAG|MaaS|SaaS|云|软件|AIGC/.test(text)) return "AI软件落地路线";
  return "";
}

function inferRoleFamily(text) {
  if (/销售管理|负责人|总监|团队|管理|区域/.test(text)) return "销售管理/区域负责人";
  if (/售前|解决方案|方案|POC|Demo|述标/.test(text)) return "售前/解决方案顾问";
  if (/渠道|生态|伙伴|代理/.test(text)) return "渠道/生态/伙伴销售";
  if (/硬件|芯片|半导体|服务器|智算|IDC|算力/.test(text)) return "硬件/智算/半导体行业销售";
  if (/大客户|KA|政企|行业客户/.test(text)) return "大客户/行业销售经理";
  if (/SaaS|软件|AI|大模型/.test(text)) return "AI软件/大模型销售";
  return "销售/商务";
}

function evidenceFromItem(item, index) {
  const fields = item.fields;
  const raw = item.rawText;
  const id = `PROFILE-${stamp()}-${String(index + 1).padStart(2, "0")}`;
  const project = getField(fields, "项目名称", "公司/项目", "项目", "经历名称") || raw.split(/\n/)[0]?.slice(0, 40) || `能力证据 ${index + 1}`;
  const industry = getField(fields, "客户/行业", "行业", "客户行业");
  const customerType = getField(fields, "客户类型", "客户/行业", "客户");
  const context = getField(fields, "客户痛点", "背景", "场景", "目标");
  const action = getField(fields, "关键动作", "动作", "负责内容", "我做了什么");
  const result = getField(fields, "结果数据", "结果", "业务结果");
  const proof = getField(fields, "可证明材料", "证明材料", "材料");
  const roleInProject = getField(fields, "岗位角色", "我的角色", "角色");
  const commercial = getField(fields, "合同/回款/转化", "合同", "回款", "转化");
  const collaborators = splitList(getField(fields, "协同对象", "协同部门", "协作者"));
  const evidenceText = [raw, project, industry, customerType, context, action, result, proof, roleInProject, commercial].join("\n");
  const capabilities = inferCapabilities(evidenceText);
  return {
    id,
    skill: capabilities[0] || "",
    project,
    context,
    action,
    result,
    proof,
    customerType,
    industry,
    roleInProject,
    contractAmount: /合同|签约/.test(commercial) ? commercial : "",
    revenueOrGMV: /收入|GMV|消耗|预算/.test(commercial) ? commercial : "",
    collectionAmount: /回款/.test(commercial) ? commercial : "",
    conversionRate: /转化|转化率|达成率|赢单/.test(`${commercial}\n${result}`) ? `${commercial || result}` : "",
    salesCycle: getField(fields, "销售周期", "周期"),
    teamSize: getField(fields, "团队人数", "团队规模"),
    collaborators,
    relatedRoute: inferRoute(evidenceText),
    relatedRoleFamily: inferRoleFamily(evidenceText),
    canBeUsedInResume: Boolean(result || commercial || proof),
    importedAt: new Date().toISOString(),
    importedFrom: "我的能力画像收件箱",
    inferredCapabilities: capabilities,
    rawText: raw
  };
}

function blankEvidence(evidence) {
  return !normalizeText([
    evidence.id,
    evidence.skill,
    evidence.project,
    evidence.context,
    evidence.action,
    evidence.result,
    evidence.proof
  ].join(""));
}

function normalizeProfile(profile) {
  const next = cloneJson(profile);
  next.targetRoles = ensureArray(next.targetRoles);
  next.targetRoutes = ensureArray(next.targetRoutes);
  next.skills = ensureArray(next.skills).filter((item) => normalizeText(item?.name));
  next.evidence = ensureArray(next.evidence).filter((item) => !blankEvidence(item));
  next.aiProductUnderstanding ||= { productsOrScenarios: [], canExplain: [], demoOrPocExperience: [], weakPoints: [] };
  next.keyAccountExperience ||= { customerIndustries: [], customerExamples: [], decisionChainExperience: "", largestDeal: "", typicalSalesCycle: "", proofIds: [] };
  next.solutionAndPresales ||= { requirementsResearch: [], solutionDocs: [], demoPoc: [], biddingOrPresentation: [], deliveryCoordination: [], proofIds: [] };
  next.commercialClosure ||= { contractExamples: [], collectionExamples: [], renewalOrUpsell: [], quotaAchievement: "", proofIds: [] };
  next.channelAndEcosystem ||= { partnerTypes: [], partnerCount: "", activationResult: "", jointOpportunities: "", channelRevenue: "", proofIds: [] };
  next.hardwareComputeSemiconductor ||= { knownProducts: [], customerTypes: [], projectTypes: [], ecosystemExperience: [], weakPoints: [] };
  next.salesManagement ||= { managedTeamSize: "", managedQuota: "", quotaAchievement: "", forecastingOrPipelineProcess: "", coachingMechanism: "", keyAccountBreakthrough: [], proofIds: [] };
  next.aiProductUnderstanding.productsOrScenarios = ensureArray(next.aiProductUnderstanding.productsOrScenarios);
  next.aiProductUnderstanding.canExplain = ensureArray(next.aiProductUnderstanding.canExplain);
  next.aiProductUnderstanding.demoOrPocExperience = ensureArray(next.aiProductUnderstanding.demoOrPocExperience);
  next.aiProductUnderstanding.weakPoints = ensureArray(next.aiProductUnderstanding.weakPoints);
  next.keyAccountExperience.customerIndustries = ensureArray(next.keyAccountExperience.customerIndustries);
  next.keyAccountExperience.customerExamples = ensureArray(next.keyAccountExperience.customerExamples);
  next.keyAccountExperience.proofIds = ensureArray(next.keyAccountExperience.proofIds);
  next.solutionAndPresales.requirementsResearch = ensureArray(next.solutionAndPresales.requirementsResearch);
  next.solutionAndPresales.solutionDocs = ensureArray(next.solutionAndPresales.solutionDocs);
  next.solutionAndPresales.demoPoc = ensureArray(next.solutionAndPresales.demoPoc);
  next.solutionAndPresales.biddingOrPresentation = ensureArray(next.solutionAndPresales.biddingOrPresentation);
  next.solutionAndPresales.deliveryCoordination = ensureArray(next.solutionAndPresales.deliveryCoordination);
  next.solutionAndPresales.proofIds = ensureArray(next.solutionAndPresales.proofIds);
  next.commercialClosure.contractExamples = ensureArray(next.commercialClosure.contractExamples);
  next.commercialClosure.collectionExamples = ensureArray(next.commercialClosure.collectionExamples);
  next.commercialClosure.renewalOrUpsell = ensureArray(next.commercialClosure.renewalOrUpsell);
  next.commercialClosure.proofIds = ensureArray(next.commercialClosure.proofIds);
  next.channelAndEcosystem.partnerTypes = ensureArray(next.channelAndEcosystem.partnerTypes);
  next.channelAndEcosystem.proofIds = ensureArray(next.channelAndEcosystem.proofIds);
  next.hardwareComputeSemiconductor.knownProducts = ensureArray(next.hardwareComputeSemiconductor.knownProducts);
  next.hardwareComputeSemiconductor.customerTypes = ensureArray(next.hardwareComputeSemiconductor.customerTypes);
  next.hardwareComputeSemiconductor.projectTypes = ensureArray(next.hardwareComputeSemiconductor.projectTypes);
  next.hardwareComputeSemiconductor.ecosystemExperience = ensureArray(next.hardwareComputeSemiconductor.ecosystemExperience);
  next.hardwareComputeSemiconductor.weakPoints = ensureArray(next.hardwareComputeSemiconductor.weakPoints);
  next.salesManagement.keyAccountBreakthrough = ensureArray(next.salesManagement.keyAccountBreakthrough);
  next.salesManagement.proofIds = ensureArray(next.salesManagement.proofIds);
  next.resumeEvidencePriority = ensureArray(next.resumeEvidencePriority);
  return next;
}

function upsertSkill(profile, capability, evidenceId) {
  if (!capability) return;
  let skill = profile.skills.find((item) => item.name === capability);
  if (!skill) {
    skill = { name: capability, level: "待量化", keywords: [], evidenceIds: [] };
    profile.skills.push(skill);
  }
  skill.evidenceIds = ensureArray(skill.evidenceIds);
  addUnique(skill.evidenceIds, evidenceId);
}

function appendMaterialFile(evidenceRows) {
  if (!evidenceRows.length) return;
  const existing = existsSync(resumeMaterialPath) ? readFileSync(resumeMaterialPath, "utf8") : "# 简历素材库\n";
  const blockRows = evidenceRows.map((item) => {
    return `| ${new Date().toISOString().slice(0, 10)} | ${item.project} | ${item.roleInProject || item.relatedRoleFamily || ""} | ${item.context || item.rawText.slice(0, 40)} | ${item.action || ""} | ${item.result || item.contractAmount || item.collectionAmount || ""} | ${item.proof || ""} | ${item.inferredCapabilities.join("；")} |`;
  });
  const block = `\n\n## 能力画像收件箱导入 ${formatDateTime()}\n\n| 时间 | 公司/项目 | 角色 | 负责内容 | 关键动作 | 结果数据 | 可证明材料 | 可匹配能力 |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n${blockRows.join("\n")}\n`;
  writeFileSync(resumeMaterialPath, `${existing.trimEnd()}${block}`, "utf8");
}

function applyEvidence(profile, evidenceRows) {
  const next = normalizeProfile(profile);
  const existingRaw = new Set(next.evidence.map((item) => normalizeText(item.rawText || `${item.project}\n${item.context}\n${item.action}\n${item.result}`)));
  const added = [];
  for (const item of evidenceRows) {
    const rawKey = normalizeText(item.rawText || `${item.project}\n${item.context}\n${item.action}\n${item.result}`);
    if (existingRaw.has(rawKey)) continue;
    next.evidence.push(item);
    added.push(item);
    existingRaw.add(rawKey);

    for (const capability of item.inferredCapabilities) upsertSkill(next, capability, item.id);
    for (const capability of item.inferredCapabilities) addUnique(next.resumeEvidencePriority, capability);
    if (item.relatedRoute) addUnique(next.targetRoutes, item.relatedRoute);

    if (item.industry) addUnique(next.keyAccountExperience.customerIndustries, item.industry);
    if (item.customerType || item.project) addUnique(next.keyAccountExperience.customerExamples, item.customerType || item.project);
    if (!next.keyAccountExperience.largestDeal && item.contractAmount) next.keyAccountExperience.largestDeal = item.contractAmount;
    if (!next.keyAccountExperience.typicalSalesCycle && item.salesCycle) next.keyAccountExperience.typicalSalesCycle = item.salesCycle;
    addUnique(next.keyAccountExperience.proofIds, item.id);

    if (/AI|大模型|Agent|RAG|MaaS|AIGC|模型/.test(item.rawText)) {
      addUnique(next.aiProductUnderstanding.productsOrScenarios, item.project);
      addUnique(next.aiProductUnderstanding.canExplain, item.context || item.action);
      if (/Demo|POC|方案|演示/.test(item.rawText)) addUnique(next.aiProductUnderstanding.demoOrPocExperience, item.project);
    }

    if (/需求调研|方案|Demo|POC|述标|汇报|售前/.test(item.rawText)) {
      addUnique(next.solutionAndPresales.requirementsResearch, item.context || item.project);
      addUnique(next.solutionAndPresales.solutionDocs, item.action || item.project);
      if (/Demo|POC/.test(item.rawText)) addUnique(next.solutionAndPresales.demoPoc, item.project);
      if (/述标|投标|汇报/.test(item.rawText)) addUnique(next.solutionAndPresales.biddingOrPresentation, item.project);
      if (item.collaborators.length) addUnique(next.solutionAndPresales.deliveryCoordination, item.collaborators.join("、"));
      addUnique(next.solutionAndPresales.proofIds, item.id);
    }

    if (item.contractAmount) addUnique(next.commercialClosure.contractExamples, item.contractAmount);
    if (item.collectionAmount) addUnique(next.commercialClosure.collectionExamples, item.collectionAmount);
    if (/续费|增购/.test(item.rawText)) addUnique(next.commercialClosure.renewalOrUpsell, item.result || item.rawText.slice(0, 80));
    if (!next.commercialClosure.quotaAchievement && /达成率|quota|目标/.test(item.rawText)) next.commercialClosure.quotaAchievement = item.result || item.rawText.slice(0, 80);
    addUnique(next.commercialClosure.proofIds, item.id);

    if (/渠道|伙伴|生态|代理商/.test(item.rawText)) {
      addUnique(next.channelAndEcosystem.partnerTypes, item.customerType || item.project);
      if (!next.channelAndEcosystem.jointOpportunities && /联合商机|商机/.test(item.rawText)) next.channelAndEcosystem.jointOpportunities = item.result || item.rawText.slice(0, 80);
      if (!next.channelAndEcosystem.channelRevenue && /收入|回款|合同/.test(item.rawText)) next.channelAndEcosystem.channelRevenue = item.result || item.contractAmount || item.collectionAmount;
      addUnique(next.channelAndEcosystem.proofIds, item.id);
    }

    if (/硬件|芯片|半导体|服务器|智算|IDC|算力|GPU/.test(item.rawText)) {
      addUnique(next.hardwareComputeSemiconductor.knownProducts, item.project);
      addUnique(next.hardwareComputeSemiconductor.customerTypes, item.customerType || item.industry);
      addUnique(next.hardwareComputeSemiconductor.projectTypes, item.context || item.action);
      if (item.collaborators.length) addUnique(next.hardwareComputeSemiconductor.ecosystemExperience, item.collaborators.join("、"));
    }

    if (/团队|管理|目标拆解|forecast|预测|管道/.test(item.rawText)) {
      if (!next.salesManagement.managedTeamSize && item.teamSize) next.salesManagement.managedTeamSize = item.teamSize;
      if (!next.salesManagement.quotaAchievement && /达成率|目标/.test(item.rawText)) next.salesManagement.quotaAchievement = item.result || item.rawText.slice(0, 80);
      addUnique(next.salesManagement.keyAccountBreakthrough, item.project);
      addUnique(next.salesManagement.proofIds, item.id);
    }
  }
  return { profile: next, added };
}

function inboxTemplate() {
  const example = `项目名称：示例：某制造业客户AI质检方案推进
客户/行业：制造业/工厂质检
客户痛点：人工质检效率低，缺陷漏检率高，需要评估AI视觉方案。
岗位角色：销售负责人/方案协同
目标：推动客户从需求调研进入POC。
关键动作：梳理客户产线流程，协调售前输出方案，组织Demo演示，跟进商务报价。
协同对象：售前、产品、交付、客户IT负责人、业务负责人
结果数据：完成2轮方案汇报，进入POC，预计合同额xx万。
合同/回款/转化：合同额/回款/转化率/销售周期可以写区间。
可证明材料：方案页、会议纪要、CRM记录、合同/回款截图等。
可匹配岗位：AI销售/解决方案顾问/大客户销售`;
  return `# 我的能力画像收件箱

更新时间：${formatDateTime()}

## 使用方式

把你的真实项目、客户、岗位经历粘贴到下面标记之间。每个项目一个块；不需要写得漂亮，但要尽量有客户、场景、动作、结果、金额或证明材料。

导入命令：

\`\`\`bash
npm run profile:import -- --dry-run
npm run profile:import
npm run report:full
npm run audit:research
\`\`\`

## 示例格式

下面只是填写示例，不在导入标记内，不会被 \`profile:import\` 导入。

\`\`\`text
${example}
\`\`\`

## 项目 1

${sectionStart}
${textStart}
在这里粘贴第一个真实项目。建议包含：项目名称、客户/行业、客户痛点、岗位角色、关键动作、协同对象、结果数据、合同/回款/转化、可证明材料、可匹配岗位。
${textEnd}
${sectionEnd}

## 项目 2

${sectionStart}
${textStart}
在这里粘贴第二个项目。导入后可以清空本段文本，保留标记。
${textEnd}
${sectionEnd}

## 项目 3

${sectionStart}
${textStart}
在这里粘贴第三个项目。导入后可以清空本段文本，保留标记。
${textEnd}
${sectionEnd}
`;
}

function generateInbox() {
  mkdirSync(dirname(inboxPath), { recursive: true });
  const template = inboxTemplate();
  writeFileSync(inboxTemplatePath, template, "utf8");
  if (!existsSync(inboxPath)) {
    writeFileSync(inboxPath, template, "utf8");
    console.log(`已创建：${inboxPath}`);
  } else {
    console.log(`已保留：${inboxPath}`);
  }
  console.log(`已生成模板：${inboxTemplatePath}`);
}

function importInbox(args = {}) {
  if (!existsSync(inboxPath)) {
    generateInbox();
    console.log("能力画像收件箱刚创建，尚未导入。请先填写真实项目，再运行 npm run profile:import -- --dry-run。");
    return;
  }
  const inboxText = readFileSync(inboxPath, "utf8");
  const items = parseInboxItems(inboxText);
  const evidenceRows = items.map((item, index) => evidenceFromItem(item, index));
  const profile = readJsonIfExists(profilePath, {});
  const result = applyEvidence(profile, evidenceRows);

  if (args.dryRun) {
    console.log(JSON.stringify({
      dryRun: true,
      inboxPath,
      importableItems: items.length,
      newEvidenceCount: result.added.length,
      newEvidence: result.added.map((item) => ({
        id: item.id,
        project: item.project,
        capabilities: item.inferredCapabilities,
        route: item.relatedRoute,
        roleFamily: item.relatedRoleFamily
      }))
    }, null, 2));
    return;
  }

  mkdirSync(dirname(profilePath), { recursive: true });
  if (existsSync(profilePath)) {
    const backupPath = `${profilePath}.bak-${stamp()}`;
    writeFileSync(backupPath, readFileSync(profilePath, "utf8"), "utf8");
    console.log(`已备份：${backupPath}`);
  }
  writeFileSync(profilePath, `${JSON.stringify(result.profile, null, 2)}\n`, "utf8");
  appendMaterialFile(result.added);
  console.log(`已更新：${profilePath}`);
  console.log(`新增证据：${result.added.length}`);
  console.log(`同步素材库：${resumeMaterialPath}`);
}

function status() {
  const profile = readJsonIfExists(profilePath, {});
  const normalized = normalizeProfile(profile);
  const profileReady = Boolean(normalized.evidence.length > 0 || normalized.skills.length > 0 || normalizeText(normalized.currentSummary));
  console.log(JSON.stringify({
    profilePath,
    inboxPath,
    inboxExists: existsSync(inboxPath),
    profileReady,
    evidenceCount: normalized.evidence.length,
    skillCount: normalized.skills.length,
    targetRoles: normalized.targetRoles,
    targetRoutes: normalized.targetRoutes,
    resumeEvidencePriority: normalized.resumeEvidencePriority
  }, null, 2));
}

const args = parseArgs(process.argv);
if (args.help) {
  console.log(usage());
} else if (args.command === "generate" || args.command === "inbox") {
  generateInbox();
} else if (args.command === "import") {
  importInbox(args);
} else if (args.command === "status") {
  status();
} else {
  console.log(usage());
  process.exit(1);
}
