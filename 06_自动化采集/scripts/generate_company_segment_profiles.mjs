#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const companyMapPath = join(projectRoot, "00_行业资料集/AI产业链头部公司岗位机会地图.csv");
const roleMatrixPath = join(projectRoot, "01_行情收集/AI销售岗位薪资能力矩阵.csv");
const capabilityMatrixPath = join(projectRoot, "02_岗位画像/AI销售岗位能力要求矩阵.csv");
const nextSamplingQueuePath = join(projectRoot, "01_行情收集/BOSS下一轮优先采样清单.csv");
const outputMdPath = join(projectRoot, "00_行业资料集/AI销售目标公司分层画像.md");
const outputCsvPath = join(projectRoot, "00_行业资料集/AI销售目标公司分层画像.csv");

const segmentStrategy = {
  "基座大模型/Agent平台": {
    companyType: "模型能力和Agent平台型公司",
    buyerProfiles: "企业创新部门;业务部门负责人;IT/数据/数字化部门;生态伙伴",
    salesMotion: "从AI能力认知和业务场景切入，靠Demo/POC、行业方案、生态合作推进。",
    whySalesExists: "模型能力需要被翻译成行业应用和付费场景，销售岗位承担教育市场、发现场景、推进试点和商业化转化。",
    resumePositioning: "简历要突出AI产品理解、场景拆解、解决方案表达和ToB商机推进。"
  },
  "云计算/大模型平台": {
    companyType: "云厂商和MaaS平台型公司",
    buyerProfiles: "政企客户;金融/制造/教育/医疗客户;互联网平台;ISV生态伙伴",
    salesMotion: "典型为大客户/行业销售+售前解决方案协同，围绕算力、模型服务、私有化和行业方案推进。",
    whySalesExists: "云和MaaS平台需要进入客户IT预算和业务场景，销售岗位负责行业客户开拓、解决方案包装和长期账户经营。",
    resumePositioning: "简历要突出KA开发、行业客户、云/AI/MaaS语言、项目周期和回款闭环。"
  },
  "智能客服/营销/销售AI": {
    companyType: "AI应用SaaS和业务效率工具公司",
    buyerProfiles: "销售/客服/市场负责人;增长负责人;中小企业老板;电商/零售/本地生活客户",
    salesMotion: "更接近SaaS销售和应用型解决方案销售，强调线索转化、行业话术、续费和客户成功。",
    whySalesExists: "产品需要快速进入业务团队并证明ROI，销售岗位承担获客、转化、续费和客户反馈。",
    resumePositioning: "简历要突出SaaS/ToB销售、线索转化、客户成功、续费增购和行业案例。"
  },
  "AI芯片/GPU/加速卡": {
    companyType: "AI芯片、GPU和加速卡硬科技公司",
    buyerProfiles: "云厂商;服务器厂商;智算中心;政企科研客户;渠道和生态伙伴",
    salesMotion: "长周期大客户销售，通常需要生态伙伴、硬件方案、政企项目和技术售前协同。",
    whySalesExists: "芯片和加速卡不是单品买卖，需要进入服务器/云/智算生态链，销售岗位负责客户导入、生态合作和项目落地。",
    resumePositioning: "简历要突出硬件链路理解、政企/大客户、渠道生态、项目型销售和跨部门协同。"
  },
  "AI服务器/智算基础设施": {
    companyType: "AI服务器、算力基础设施和企业IT厂商",
    buyerProfiles: "互联网大客户;金融/教育/运营商;政企客户;IDC/智算中心;渠道伙伴",
    salesMotion: "以行业大客户、政企项目、渠道销售和售前方案为主，强调算力、液冷、交付和生态整合。",
    whySalesExists: "AI算力采购金额高、链条长，销售岗位负责需求挖掘、方案匹配、招投标、交付协同和回款。",
    resumePositioning: "简历要突出大客户项目、硬件/算力场景、招投标/交付协同、合同额和回款。"
  },
  "工业AI/智能制造": {
    companyType: "工业软件、工业互联网和制造业AI解决方案公司",
    buyerProfiles: "制造业工厂;集团数字化部门;产线/质量/设备负责人;工业园区",
    salesMotion: "典型项目型销售，围绕产线、质检、设备、排产、能耗等场景做方案和交付协同。",
    whySalesExists: "工业AI需要深度理解客户工艺和现场问题，销售岗位负责场景识别、方案推进和复杂项目落地。",
    resumePositioning: "简历要突出制造业客户、项目推进、方案宣讲、跨部门协同和可量化业务收益。"
  },
  "AI Agent/RPA/流程自动化": {
    companyType: "流程自动化、RPA和企业Agent工具公司",
    buyerProfiles: "财务/人力/运营/客服部门;企业数字化部门;共享服务中心",
    salesMotion: "从流程效率和人力替代ROI切入，靠试点场景、Demo、低门槛落地和横向扩展推进。",
    whySalesExists: "Agent/RPA需要把自动化能力映射到客户流程，销售岗位负责发现高频流程、推动试点和扩展采购。",
    resumePositioning: "简历要突出流程理解、ROI表达、ToB销售、Demo/POC和客户成功。"
  },
  "数据/MLOps/AI基础软件": {
    companyType: "数据平台、MLOps和AI基础软件公司",
    buyerProfiles: "数据部门;算法平台团队;IT/数字化部门;金融/零售/制造大客户",
    salesMotion: "偏技术型大客户销售和解决方案销售，需要和售前/架构师深度协同。",
    whySalesExists: "数据和MLOps项目通常预算大、决策链复杂，销售岗位负责技术价值转商务价值。",
    resumePositioning: "简历要突出复杂解决方案销售、技术协同、行业客户和项目周期。"
  },
  "智能汽车/机器人/具身智能": {
    companyType: "智能硬件、自动驾驶、机器人和传感器公司",
    buyerProfiles: "主机厂;机器人集成商;工业客户;海外渠道;政企和园区客户",
    salesMotion: "软硬结合销售，常见渠道/海外/行业客户拓展，重视生态合作和项目交付。",
    whySalesExists: "具身智能和智能硬件商业化需要渠道、场景和生态落地，销售岗位负责进入行业客户和区域市场。",
    resumePositioning: "简历要突出软硬结合、渠道/海外、行业客户、合作伙伴和项目落地。"
  },
  "AI安全/私有化/信创": {
    companyType: "安全、私有化部署和信创生态公司",
    buyerProfiles: "政企客户;金融/运营商;信创生态伙伴;安全/合规负责人",
    salesMotion: "政企大客户和渠道生态为主，常伴随招投标、安全合规、私有化交付和售前方案。",
    whySalesExists: "客户购买的是可信、安全和可落地的AI能力，销售岗位负责政企关系、方案合规和项目推进。",
    resumePositioning: "简历要突出政企客户、招投标、安全/合规、私有化项目和回款闭环。"
  },
  "AI视觉/安防/质检": {
    companyType: "视觉算法、安防和工业质检公司",
    buyerProfiles: "制造工厂;安防/园区客户;渠道集成商;行业解决方案客户",
    salesMotion: "行业销售+渠道销售+售前方案，围绕视觉检测、安防、园区和产线场景推进。",
    whySalesExists: "视觉AI需要绑定具体摄像头/产线/园区场景，销售岗位负责找到场景、协同方案和交付。",
    resumePositioning: "简历要突出行业场景、渠道资源、方案落地和项目结果。"
  },
  "智算中心/数据中心服务": {
    companyType: "IDC、智算中心和算力服务公司",
    buyerProfiles: "大模型公司;互联网客户;政企客户;运营商;渠道/生态伙伴",
    salesMotion: "偏大客户和渠道销售，围绕算力资源、机柜、网络、电力、运维和服务合同推进。",
    whySalesExists: "智算中心需要高客单价长期客户和稳定资源匹配，销售岗位负责客户引入、资源方案和续约。",
    resumePositioning: "简历要突出大客户经营、算力/IDC理解、合同周期、渠道生态和回款。"
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

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function splitSemi(value) {
  return String(value || "").split(";").map((item) => item.trim()).filter(Boolean);
}

function topJoined(values, limit = 8, separator = "、") {
  return unique(values).slice(0, limit).join(separator);
}

function layerMix(rows) {
  const counts = new Map();
  for (const row of rows) counts.set(row.layer, (counts.get(row.layer) || 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([layer, count]) => `${layer}${count}`)
    .join(";");
}

function salarySummary(rows) {
  const values = unique(rows.map((row) => row.salaryBand).filter((item) => item && item !== "待BOSS样本校验"));
  return values.slice(0, 4).join(";") || "待BOSS样本校验";
}

function mdRows(rows, fallback) {
  return rows.length ? rows.join("\n") : fallback;
}

const companyRows = readCsvIfExists(companyMapPath);
const matrixRows = readCsvIfExists(roleMatrixPath);
const capabilityRows = readCsvIfExists(capabilityMatrixPath);
const nextSamplingRows = readCsvIfExists(nextSamplingQueuePath);

const segments = unique(companyRows.map((row) => row.segment));
const profileRows = segments.map((segment) => {
  const companies = companyRows
    .filter((row) => row.segment === segment)
    .sort((a, b) => Number(b.opportunityScore || 0) - Number(a.opportunityScore || 0));
  const matrix = matrixRows.filter((row) => row.segment === segment);
  const sampling = nextSamplingRows.filter((row) => row.segment === segment);
  const strategy = segmentStrategy[segment] || {};
  const roleCapabilities = matrix.flatMap((row) => splitSemi(row.coreCapabilities));
  const marketCapabilities = capabilityRows
    .filter((row) => String(row.prioritySegments || "").includes(segment))
    .sort((a, b) => Number(b.demandScore || 0) - Number(a.demandScore || 0))
    .map((row) => row.capability);
  const priorityCompanies = companies.filter((row) => row.opportunityLevel === "P0优先采样");
  return {
    segment,
    layerMix: layerMix(companies),
    companyType: strategy.companyType || "",
    companyCount: companies.length,
    p0CompanyCount: priorityCompanies.length,
    topCompanies: companies.slice(0, 10).map((row) => row.company).join(";"),
    nextSamplingCompanies: topJoined(sampling.map((row) => row.company), 6, ";"),
    roleFocus: topJoined(companies.flatMap((row) => splitSemi(row.roleTerms)), 6, ";"),
    salaryObservation: salarySummary(matrix),
    capabilityFocus: topJoined([...marketCapabilities, ...roleCapabilities], 6, ";"),
    buyerProfiles: strategy.buyerProfiles || "",
    salesMotion: strategy.salesMotion || "",
    whySalesExists: strategy.whySalesExists || "",
    resumePositioning: strategy.resumePositioning || "",
    sampleGap: Math.max(...matrix.map((row) => Number(row.sampleGap || 0)), 0),
    nextAction: sampling.length
      ? `优先人工看 ${topJoined(sampling.map((row) => `${row.company}/${row.role}`), 4, "、")}`
      : `优先看 ${companies.slice(0, 3).map((row) => row.company).join("、")} 的 ${topJoined(companies.flatMap((row) => splitSemi(row.roleTerms)), 3, "/")}`
  };
});

profileRows.sort((a, b) => b.p0CompanyCount - a.p0CompanyCount || b.sampleGap - a.sampleGap || a.segment.localeCompare(b.segment, "zh-Hans-CN"));

mkdirSync(dirname(outputMdPath), { recursive: true });

const headers = [
  "segment",
  "layerMix",
  "companyType",
  "companyCount",
  "p0CompanyCount",
  "topCompanies",
  "nextSamplingCompanies",
  "roleFocus",
  "salaryObservation",
  "capabilityFocus",
  "buyerProfiles",
  "salesMotion",
  "whySalesExists",
  "resumePositioning",
  "sampleGap",
  "nextAction"
];
writeFileSync(outputCsvPath, `${csv([headers])}\n${csv(profileRows.map((row) => headers.map((header) => row[header])))}\n`);

const summaryRows = profileRows.map((row) => {
  return `| ${row.segment} | ${row.companyType} | ${row.companyCount} | ${row.topCompanies} | ${row.roleFocus} | ${row.salaryObservation} | ${row.capabilityFocus} |`;
});

const interpretationRows = profileRows.map((row) => {
  return `| ${row.segment} | ${row.buyerProfiles} | ${row.salesMotion} | ${row.whySalesExists} |`;
});

const resumeRows = profileRows.map((row) => {
  return `| ${row.segment} | ${row.resumePositioning} | ${row.nextAction} |`;
});

const topCompanyRows = companyRows
  .sort((a, b) => Number(b.opportunityScore || 0) - Number(a.opportunityScore || 0))
  .slice(0, 40)
  .map((row, index) => {
    const profile = profileRows.find((item) => item.segment === row.segment) || {};
    return `| ${index + 1} | ${row.opportunityLevel} | ${row.segment} | ${row.company} | ${profile.companyType || ""} | ${row.roleTerms} | ${row.salaryObservation || "待补薪资样本"} | ${row.nextAction} |`;
  });

const md = `# AI销售目标公司分层画像

更新时间：${formatDate()}

## 一、本质判断

这份画像不是公司排行榜，而是回答“这些 AI 公司为什么会招销售、招什么类型的销售、对应什么客户和能力”。它把公司池、薪资矩阵、能力矩阵和下一轮采样清单合并成公司侧理解框架。

当前最大的矛盾是：AI公司类型跨度很大，不能用同一套 SaaS 销售逻辑理解月之暗面、智谱AI、MiniMax、寒武纪、海光、超聚变和工业AI公司。

## 二、公司类型总览

| 赛道 | 公司类型 | 公司数 | 代表公司 | 典型销售岗位 | 薪资观察 | 高频能力 |
| --- | --- | ---: | --- | --- | --- | --- |
${mdRows(summaryRows, "| 暂无 |  | 0 |  |  |  |  |")}

## 三、客户与销售打法

| 赛道 | 典型客户/买方 | 销售打法 | 为什么需要销售 |
| --- | --- | --- | --- |
${mdRows(interpretationRows, "| 暂无 |  |  |  |")}

## 四、前40个优先理解的公司

| 排名 | 机会等级 | 赛道 | 公司 | 公司类型 | 优先岗位词 | 薪资观察 | 下一步动作 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
${mdRows(topCompanyRows, "| 暂无 |  |  |  |  |  |  |  |")}

## 五、简历定位启发

| 赛道 | 简历应强调什么 | 下一步采样动作 |
| --- | --- | --- |
${mdRows(resumeRows, "| 暂无 |  |  |")}

## 六、使用方法

1. 先用这份画像判断目标公司属于“模型平台、云MaaS、应用SaaS、硬件算力、工业AI、智算中心”等哪类。
2. 再到 \`BOSS下一轮优先采样清单.md\` 按对应公司和岗位词人工查看。
3. 每复制导入 5 到 10 条岗位后，重新运行 \`npm run company:profile && npm run capability:matrix && npm run report:full\`。
4. 简历不要写“懂AI”这种空话，要按目标公司类型写客户、场景、方案、合同和结果。

## 七、边界

公司类型和销售打法来自当前项目内公司池、公开趋势、薪资矩阵和少量 BOSS 样本的合成判断，不等于公司官方组织结构。最终岗位事实仍以 BOSS 实际在招岗位为准。

## 八、文件

\`\`\`text
${outputCsvPath}
\`\`\`
`;

writeFileSync(outputMdPath, md);

console.log(`已生成：${outputMdPath}`);
console.log(`已生成：${outputCsvPath}`);
console.log(`赛道数：${profileRows.length}`);
console.log(`公司数：${companyRows.length}`);
