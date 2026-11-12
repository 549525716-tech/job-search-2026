#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const companySegmentsPath = join(projectRoot, "06_自动化采集/config/ai_company_segments.csv");
const companyMapPath = join(projectRoot, "00_行业资料集/AI产业链头部公司岗位机会地图.csv");
const segmentProfilePath = join(projectRoot, "00_行业资料集/AI销售目标公司分层画像.csv");
const roleSalaryMatrixPath = join(projectRoot, "01_行情收集/AI销售岗位薪资能力矩阵.csv");
const acceptancePath = join(projectRoot, "01_行情收集/BOSS大样本完成门槛与验收路线.csv");
const publicSourcesPath = join(projectRoot, "06_自动化采集/config/public_market_sources.csv");
const outputMdPath = join(projectRoot, "00_行业资料集/AI产业链公司资料集.md");
const outputCsvPath = join(projectRoot, "00_行业资料集/AI产业链公司资料集.csv");
const outputSegmentCsvPath = join(projectRoot, "00_行业资料集/AI产业链销售岗位图谱.csv");
const safeBossHomeUrl = "https://www.zhipin.com/";

const routeBySegment = {
  "基座大模型/Agent平台": "AI软件落地路线",
  "云计算/大模型平台": "AI软件落地路线",
  "智能客服/营销/销售AI": "AI软件落地路线",
  "数据/MLOps/AI基础软件": "AI软件落地路线",
  "AI Agent/RPA/流程自动化": "AI软件落地路线",
  "工业AI/智能制造": "行业解决方案路线",
  "AI视觉/安防/质检": "行业解决方案路线",
  "智能汽车/机器人/具身智能": "行业解决方案路线",
  "AI安全/私有化/信创": "行业解决方案路线",
  "AI芯片/GPU/加速卡": "硬件/算力/半导体路线",
  "AI服务器/智算基础设施": "硬件/算力/半导体路线",
  "智算中心/数据中心服务": "硬件/算力/半导体路线"
};

const segmentOrder = [
  "AI芯片/GPU/加速卡",
  "AI服务器/智算基础设施",
  "智算中心/数据中心服务",
  "云计算/大模型平台",
  "基座大模型/Agent平台",
  "数据/MLOps/AI基础软件",
  "AI Agent/RPA/流程自动化",
  "智能客服/营销/销售AI",
  "工业AI/智能制造",
  "AI视觉/安防/质检",
  "智能汽车/机器人/具身智能",
  "AI安全/私有化/信创"
];

const sourceKeywordsBySegment = {
  "AI芯片/GPU/加速卡": ["芯片", "半导体", "算力", "先进计算", "智能算力", "硬科技", "电子半导体"],
  "AI服务器/智算基础设施": ["服务器", "智算", "算力", "液冷", "先进计算", "智能算力", "AIDC"],
  "智算中心/数据中心服务": ["智算中心", "数据中心", "IDC", "算力", "AIDC", "智能算力服务"],
  "云计算/大模型平台": ["MaaS", "云", "大模型服务", "Token", "智能算力服务", "模型服务"],
  "基座大模型/Agent平台": ["大模型", "Agent", "智能体", "Token", "模型层", "规模化落地"],
  "数据/MLOps/AI基础软件": ["数据", "MLOps", "平台层", "基础软件", "企业智能"],
  "AI Agent/RPA/流程自动化": ["Agent", "智能体", "流程", "运营管理", "应用实践", "规模化落地"],
  "智能客服/营销/销售AI": ["客户体验", "营销", "客服", "销售AI", "AI Agent", "员工生产力"],
  "工业AI/智能制造": ["工业", "制造", "工业智算", "产线", "智能制造"],
  "AI视觉/安防/质检": ["视觉", "质检", "安防", "制造", "工业"],
  "智能汽车/机器人/具身智能": ["具身智能", "机器人", "智能硬件", "自动驾驶", "硬科技"],
  "AI安全/私有化/信创": ["安全", "私有化", "信创", "政企", "合规"]
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

function csvEscape(value) {
  const text = String(value ?? "");
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function csv(rows) {
  return `${rows.map((row) => row.map(csvEscape).join(",")).join("\n")}\n`;
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

function unique(values) {
  return [...new Set(values.map((item) => String(item || "").trim()).filter(Boolean))];
}

function splitSemi(value) {
  return String(value || "")
    .split(/[;；、]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function top(values, limit = 10, separator = "、") {
  return unique(values).slice(0, limit).join(separator);
}

function uniqueSources(sources) {
  const seen = new Set();
  const result = [];
  for (const source of sources) {
    const key = source?.url || `${source?.source}-${source?.topic}`;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(source);
  }
  return result;
}

function byKey(rows, key) {
  const map = new Map();
  for (const row of rows) {
    const value = row[key] || "";
    if (!map.has(value)) map.set(value, []);
    map.get(value).push(row);
  }
  return map;
}

function number(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function layerSummary(rows) {
  const counts = new Map();
  for (const row of rows) counts.set(row.layer, (counts.get(row.layer) || 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([layer, count]) => `${layer}${count}`)
    .join("；");
}

function salarySignal(rows, profileRow) {
  const values = [
    ...splitSemi(profileRow?.salaryObservation),
    ...rows.flatMap((row) => splitSemi(row.salaryObservation))
  ].filter((item) => item && item !== "待BOSS样本校验");
  return top(values, 5, "；") || "待BOSS补样";
}

function sourceEvidenceFor(segment, route, publicSources) {
  const segmentWords = sourceKeywordsBySegment[segment] || splitSemi(segment);
  const routeWords = route === "硬件/算力/半导体路线"
    ? ["算力", "服务器", "芯片", "半导体", "智算"]
    : route === "AI软件落地路线"
      ? ["大模型", "MaaS", "Agent", "智能体", "应用", "平台"]
      : ["行业", "制造", "政企", "场景", "解决方案"];
  const scored = publicSources
    .map((source) => {
      const text = `${source.topic}\n${source.key_signal}\n${source.sales_implication}`;
      const score =
        segmentWords.filter((word) => word && text.includes(word)).length * 3 +
        routeWords.filter((word) => word && text.includes(word)).length;
      return { source, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.source);
  const general = publicSources.filter((source) => /AI岗位需求|AI非技术岗位扩散|AI人才需求/.test(`${source.topic}\n${source.key_signal}`));
  return uniqueSources([...scored, ...general]).slice(0, 4);
}

function evidenceBoundary(acceptanceRow, currentSamples) {
  if (!acceptanceRow) return "公司池/公开信号阶段，需BOSS补样";
  const sampleGap = number(acceptanceRow.sampleGap);
  if (currentSamples >= 12 && sampleGap <= 0) return "可写赛道方向结论，仍需持续校验";
  if (currentSamples > 0) return "只能写BOSS方向观察，不能写全行业统计结论";
  return "只能写公开信号假设，不能写BOSS平台结论";
}

function bossGapText(acceptanceRow) {
  if (!acceptanceRow) return "待生成验收门槛";
  return `${acceptanceRow.currentSamples || 0}/${acceptanceRow.targetSamples || 0}，缺口 ${acceptanceRow.sampleGap || 0}`;
}

function segmentPriority(segmentRows, acceptanceRow) {
  const p0 = segmentRows.filter((row) => row.priority === "1").length;
  const gap = number(acceptanceRow?.sampleGap);
  if (["AI芯片/GPU/加速卡", "基座大模型/Agent平台", "云计算/大模型平台", "AI服务器/智算基础设施", "工业AI/智能制造"].includes(acceptanceRow?.segment)) {
    return "P0 首轮必补";
  }
  if (p0 >= 4 && gap >= 8) return "P0 首轮必补";
  if (p0 >= 2) return "P1 重点跟进";
  return "P2 观察补样";
}

function mdTable(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows
  ].join("\n");
}

const companySegments = readCsv(companySegmentsPath);
const companyMap = readCsv(companyMapPath);
const segmentProfiles = readCsv(segmentProfilePath);
const roleSalaryRows = readCsv(roleSalaryMatrixPath);
const acceptanceRows = readCsv(acceptancePath);
const publicSources = readCsv(publicSourcesPath);

const segmentsByName = byKey(companySegments, "segment");
const companyMapBySegment = byKey(companyMap, "segment");
const roleRowsBySegment = byKey(roleSalaryRows, "segment");
const profileBySegment = new Map(segmentProfiles.map((row) => [row.segment, row]));
const acceptanceBySegment = new Map(acceptanceRows.map((row) => [row.segment, row]));

const segmentRows = segmentOrder
  .filter((segment) => segmentsByName.has(segment))
  .map((segment, index) => {
    const configRows = segmentsByName.get(segment) || [];
    const mapRows = (companyMapBySegment.get(segment) || [])
      .sort((a, b) => number(b.opportunityScore) - number(a.opportunityScore));
    const profile = profileBySegment.get(segment) || {};
    const acceptance = acceptanceBySegment.get(segment) || {};
    const roleRows = roleRowsBySegment.get(segment) || [];
    const route = routeBySegment[segment] || "";
    const publicEvidence = sourceEvidenceFor(segment, route, publicSources);
    const currentSamples = number(acceptance.currentSamples);
    const companyList = mapRows.length ? mapRows.map((row) => row.company) : configRows.map((row) => row.company);
    const p0Companies = configRows.filter((row) => row.priority === "1").map((row) => row.company);
    const roleFocus = top([
      ...splitSemi(profile.roleFocus),
      ...roleRows.map((row) => row.roleFamily),
      ...mapRows.flatMap((row) => splitSemi(row.roleTerms))
    ], 6);
    const capabilities = top([
      ...splitSemi(profile.capabilityFocus),
      ...roleRows.flatMap((row) => splitSemi(row.coreCapabilities)),
      ...mapRows.flatMap((row) => splitSemi(row.coreCapabilities))
    ], 8);
    return {
      rank: index + 1,
      route,
      segment,
      layerMix: layerSummary(configRows),
      companyCount: configRows.length,
      p0CompanyCount: p0Companies.length,
      priority: segmentPriority(configRows, acceptance),
      topCompanies: top(companyList, 10),
      p0Companies: top(p0Companies, 8),
      companyType: profile.companyType || "",
      buyerProfiles: profile.buyerProfiles || "",
      salesMotion: profile.salesMotion || "",
      whySalesExists: profile.whySalesExists || "",
      roleFocus,
      salarySignal: salarySignal(mapRows, profile),
      capabilityFocus: capabilities,
      bossProgress: bossGapText(acceptance),
      evidenceBoundary: evidenceBoundary(acceptance, currentSamples),
      publicEvidence: publicEvidence.map((source) => `${source.source}/${source.topic}`).join("；"),
      sourceUrls: publicEvidence.map((source) => source.url).join("；"),
      nextAction: acceptance.nextAction || profile.nextAction || `先补 ${top(companyList, 3)} 的销售/售前/管理岗样本`
    };
  });

const companyRows = companySegments.map((row) => {
  const mapRow = companyMap.find((item) => item.segment === row.segment && item.company === row.company) || {};
  const profile = profileBySegment.get(row.segment) || {};
  const route = routeBySegment[row.segment] || "";
  const roleTerms = mapRow.roleTerms || profile.roleFocus || "";
  const firstRole = splitSemi(roleTerms)[0] || "销售/售前/销售管理";
  const searchKeyword = mapRow.searchKeyword || `${row.company} ${firstRole}`;
  return {
    route,
    segment: row.segment,
    layer: row.layer,
    company: row.company,
    priority: row.priority === "1" ? "P0" : row.priority === "2" ? "P1" : "P2",
    keywords: row.keywords,
    salesFit: row.sales_fit,
    companyType: profile.companyType || "",
    roleTerms,
    salaryObservation: mapRow.salaryObservation || profile.salaryObservation || "",
    coreCapabilities: mapRow.coreCapabilities || profile.capabilityFocus || "",
    samplingStatus: mapRow.samplingStatus || "待BOSS补样",
    safeBossHomeUrl,
    searchKeyword,
    manualUrl: mapRow.firstSearchUrl || "",
    nextAction: mapRow.nextAction || `打开BOSS首页，站内搜索 ${searchKeyword}`
  };
});

const segmentHeaders = [
  "rank",
  "route",
  "segment",
  "layerMix",
  "companyCount",
  "p0CompanyCount",
  "priority",
  "topCompanies",
  "p0Companies",
  "companyType",
  "buyerProfiles",
  "salesMotion",
  "whySalesExists",
  "roleFocus",
  "salarySignal",
  "capabilityFocus",
  "bossProgress",
  "evidenceBoundary",
  "publicEvidence",
  "sourceUrls",
  "nextAction"
];

const companyHeaders = [
  "route",
  "segment",
  "layer",
  "company",
  "priority",
  "keywords",
  "salesFit",
  "companyType",
  "roleTerms",
  "salaryObservation",
  "coreCapabilities",
  "samplingStatus",
  "safeBossHomeUrl",
  "searchKeyword",
  "manualUrl",
  "nextAction"
];

const routeSummaryRows = ["AI软件落地路线", "硬件/算力/半导体路线", "行业解决方案路线"].map((route) => {
  const rows = segmentRows.filter((row) => row.route === route);
  return `| ${route} | ${rows.length} | ${rows.reduce((sum, row) => sum + row.companyCount, 0)} | ${top(rows.flatMap((row) => splitSemi(row.topCompanies.replaceAll("、", ";"))), 8)} | ${top(rows.flatMap((row) => splitSemi(row.roleFocus.replaceAll("、", ";"))), 6)} |`;
});

const segmentMdRows = segmentRows.map((row) => {
  return `| ${row.rank} | ${row.route} | ${row.segment} | ${row.layerMix} | ${row.companyCount} | ${row.topCompanies} | ${row.roleFocus} | ${row.salarySignal} | ${row.bossProgress} | ${row.evidenceBoundary} |`;
});

const topCompanyMdRows = companyRows
  .filter((row) => row.priority === "P0")
  .slice(0, 60)
  .map((row, index) => {
    return `| ${index + 1} | ${row.route} | ${row.segment} | ${row.layer} | ${row.company} | ${row.salesFit} | ${row.roleTerms || "-"} | ${row.salaryObservation || "待BOSS补样"} | ${row.safeBossHomeUrl} | \`${row.searchKeyword}\` |`;
  });

const sourceMdRows = publicSources.slice(0, 18).map((source) => {
  return `| ${source.source} | ${source.year} | ${source.topic} | ${source.key_signal} | ${source.sales_implication} | [来源](${source.url}) |`;
});

const md = `# AI产业链公司资料集

更新时间：${formatDateTime()}

## 一、本质判断

这份资料集不是泛泛罗列 AI 公司，而是为“找 AI 相关销售、售前、渠道和销售管理岗位”服务的可执行公司池。

这件事本质上不是找最技术前沿的公司，而是找 AI 产业链里正在商业化、需要销售把技术能力转成客户预算和业务结果的公司。

## 二、当前边界

| 项目 | 状态 |
| --- | --- |
| 公司池 | ${companyRows.length} 家 |
| 赛道 | ${segmentRows.length} 个 |
| BOSS干净样本 | ${acceptanceRows.reduce((sum, row) => sum + number(row.currentSamples), 0)} 条 |
| BOSS赛道样本目标 | ${acceptanceRows.reduce((sum, row) => sum + number(row.targetSamples), 0)} 条 |
| BOSS赛道样本缺口 | ${acceptanceRows.reduce((sum, row) => sum + number(row.sampleGap), 0)} 条 |
| 结论权限 | 当前可写产业链地图、公开薪资信号和能力趋势；不能写成 BOSS 平台全行业统计结论 |

## 三、路线总览

${mdTable(["路线", "赛道数", "公司数", "代表公司", "典型岗位"], routeSummaryRows)}

## 四、产业链分层图谱

${mdTable(["排名", "路线", "赛道", "层级", "公司数", "头部公司池", "重点岗位", "薪资信号", "BOSS进度", "结论边界"], segmentMdRows)}

## 五、P0 公司优先采样池

以下公司不是严格财务排名，而是“求职采样优先级”：优先看是否有 AI 销售、售前、渠道、销售管理、大客户/行业销售岗位。

${mdTable(["序号", "路线", "赛道", "层级", "公司", "销售机会", "岗位词", "薪资信号", "BOSS首页", "站内搜索关键词"], topCompanyMdRows)}

## 六、人员能力要求总括

1. AI软件落地路线：重点证明 AI/大模型产品理解、ToB销售闭环、方案表达、Demo/POC、客户场景和回款结果。
2. 硬件/算力/半导体路线：重点证明芯片/服务器/智算链路理解、政企/云/IDC客户、大客户项目、渠道生态、招投标和交付协同。
3. 行业解决方案路线：重点证明制造/政企/金融/教育/汽车/安防等行业场景理解、客户痛点拆解、方案价值表达和复杂项目推进。
4. 销售管理岗位：必须补团队规模、目标拆解、forecast/管道管理、关键客户突破和业绩达成率，不能只写“带团队”。

## 七、公开来源信号

${mdTable(["来源", "年份", "主题", "关键信号", "对销售岗位的含义", "链接"], sourceMdRows)}

## 八、使用方法

1. 先按第四部分确定目标赛道属于软件落地、硬件算力，还是行业解决方案。
2. 再按第五部分选择公司和岗位词；执行 \`npm run auth:boss\` 后先进入 BOSS 首页，页面稳定后在站内搜索框输入公司名 + 岗位词。
3. 每复制一个岗位详情，用 \`npm run import:manual\` 或 \`npm run import:inbox\` 导入。
4. 每新增 10 条样本后运行 \`npm run report:full && npm run audit:research\`。
5. 用 \`npm run profile:inbox\` 补个人真实项目，才能把市场要求转成真实人岗匹配和简历改写。

## 九、输出文件

\`\`\`text
${outputMdPath}
${outputCsvPath}
${outputSegmentCsvPath}
\`\`\`
`;

mkdirSync(dirname(outputMdPath), { recursive: true });
writeFileSync(outputMdPath, md, "utf8");
writeFileSync(outputCsvPath, csv([companyHeaders, ...companyRows.map((row) => companyHeaders.map((header) => row[header]))]), "utf8");
writeFileSync(outputSegmentCsvPath, csv([segmentHeaders, ...segmentRows.map((row) => segmentHeaders.map((header) => row[header]))]), "utf8");

console.log(`已生成：${outputMdPath}`);
console.log(`已生成：${outputCsvPath}`);
console.log(`已生成：${outputSegmentCsvPath}`);
console.log(`赛道：${segmentRows.length}`);
console.log(`公司：${companyRows.length}`);
