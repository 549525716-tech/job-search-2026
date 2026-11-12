import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const workspace = "/Users/MR/Documents/职场";
const outputDir = path.join(workspace, "outputs/019f13ff-181a-7900-9662-86b3f5815b23");
const sourceCsv = path.join(workspace, "01_行情收集/公开高薪销售岗位补充线索.csv");
const outputXlsx = path.join(outputDir, "BOSS_AI与20K以上销售岗位双分页总览_2026-07-21_修正版.xlsx");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  const headers = rows.shift();
  return rows
    .filter((values) => values.some((value) => value !== ""))
    .map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

function salaryParts(salary) {
  const match = String(salary).match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*[Kk]/);
  const monthMatch = String(salary).match(/[·・](\d+)薪/);
  return {
    min: match ? Number(match[1]) : null,
    max: match ? Number(match[2]) : null,
    months: monthMatch ? Number(monthMatch[1]) : 12,
  };
}

function locationParts(location) {
  const value = String(location || "未披露").trim();
  const cityMatch = value.match(/^(北京|上海|天津|重庆|香港|澳门|深圳|广州|杭州|南京|苏州|武汉|成都|西安|宁波|东莞|青岛|温州|汕头|嘉兴|合肥|郑州|长沙|厦门|福州|无锡|佛山|珠海|济南|南昌|昆明|大连|沈阳)/);
  return {
    city: cityMatch ? cityMatch[1] : value === "未披露" ? "未披露" : value.slice(0, 2),
    area: value,
  };
}

const currentJobs = [
  {
    collectedAt: "2026-07-21",
    source: "BOSS公开页（用户截图已复核）",
    company: "月之暗面",
    title: "Business Builder & Ecosystem",
    salary: "30-60K",
    location: "上海黄浦区淮海路",
    experience: "5-10年",
    education: "本科",
    segment: "基座大模型/AI商业化生态",
    roleFamily: "渠道/生态/伙伴销售",
    requirementsSummary: "设计并验证AI商业化假设，推进标准订单、非标准交易和生态共建；把探索转化为收入、合作与生态位，对pipeline、revenue和quota负责，并沉淀可复制的商业路径。",
    sourceUrl: "https://www.zhipin.com/web/geek/jobs?query=%E6%9C%88%E4%B9%8B%E6%9A%97%E9%9D%A2&city=101281600&industry=&position=",
    sourceEvidence: "用户2026-07-21提供BOSS岗位详情截图，可见标题、薪资、地点、经验、学历和岗位正文。",
  },
  {
    collectedAt: "2026-07-21",
    source: "BOSS公开页（用户截图已复核）",
    company: "月之暗面",
    title: "网络销售",
    salary: "6-11K",
    location: "宁波奉化区岳林",
    experience: "1-3年",
    education: "大专",
    segment: "基座大模型/互联网销售",
    roleFamily: "AI软件/大模型销售",
    requirementsSummary: "截图仅确认岗位标题、薪资、地点、经验和学历；岗位正文未展开，不补写具体职责。",
    sourceUrl: "https://www.zhipin.com/web/geek/jobs?query=%E6%9C%88%E4%B9%8B%E6%9A%97%E9%9D%A2&city=101281600&industry=&position=",
    sourceEvidence: "用户2026-07-21提供BOSS搜索结果截图，岗位正文未展开。",
  },
  {
    collectedAt: "2026-07-20",
    source: "BOSS公开页（列表页已复核）",
    company: "MiniMax",
    title: "大模型KA客户经理（深圳/广州）",
    salary: "25-40K",
    location: "深圳南山区科技园（兼招广州）",
    experience: "3-5年",
    education: "本科",
    segment: "基座大模型/MaaS",
    roleFamily: "AI软件/大模型销售",
    requirementsSummary: "面向行业大客户，识别客户业务现状、发展规划、技术应用、关键人和决策链；推进商务沟通、高层拜访并协同解决方案团队。",
    sourceUrl: "https://m.zhipin.com/zhaopin/b9c189994da043eb031_3Nu0Ew~~/",
    sourceEvidence: "2026-07-20 BOSS公开列表页展示标题、薪资、地点、经验、学历及职责摘要；详情页触发安全校验。",
  },
  {
    collectedAt: "2026-07-20",
    source: "BOSS公开页（列表页已复核）",
    company: "MiniMax",
    title: "大模型KA客户经理（上海/北京/深圳）",
    salary: "25-40K",
    location: "深圳南山区科技园等",
    experience: "3-5年",
    education: "本科",
    segment: "基座大模型/MaaS",
    roleFamily: "AI软件/大模型销售",
    requirementsSummary: "负责行业KA开拓、客户组织图谱和决策链识别、商务谈判、客户拜访与方案协同。",
    sourceUrl: "https://www.zhipin.com/zhaopin/6d56edc6d17fa0200nBy2tS1Ew~~/",
    sourceEvidence: "2026-07-20 BOSS公开列表页展示标题、薪资、地点、经验、学历及职责摘要。",
  },
  {
    collectedAt: "2026-07-20",
    source: "BOSS公开页（搜索结果已复核）",
    company: "MiniMax",
    title: "资深大模型KA客户经理（北京/上海）",
    salary: "25-40K",
    location: "上海徐汇区漕河泾等",
    experience: "3-5年",
    education: "本科",
    segment: "基座大模型/MaaS",
    roleFamily: "AI软件/大模型销售",
    requirementsSummary: "经营重点客户，围绕业务目标和技术应用挖掘机会，推进决策链和商务过程，并调动内部方案资源。",
    sourceUrl: "https://www.zhipin.com/zhaopin/2be7206fa921c84e03F73d69Fw~~/",
    sourceEvidence: "2026-07-20 BOSS公开搜索结果展示主要字段；打开后进入平台安全校验页。",
  },
  {
    collectedAt: "2026-07-20",
    source: "BOSS公开页（列表页已复核）",
    company: "智谱AI",
    title: "API销售-深圳",
    salary: "15-30K",
    location: "深圳南山区科技园",
    experience: "3-5年",
    education: "本科",
    segment: "基座大模型/MaaS",
    roleFamily: "AI软件/大模型销售",
    requirementsSummary: "推广海外MaaS API，制定销售策略，协同合作伙伴，研究市场趋势并分析客户需求。",
    sourceUrl: "https://www.zhipin.com/zhaopin/3ba23cbf0f2949570nZ82dS_GQ~~/",
    sourceEvidence: "2026-07-20 BOSS公开列表页展示主要字段和职责摘要。",
  },
  {
    collectedAt: "2026-07-20",
    source: "BOSS公开页（列表页已复核）",
    company: "商汤科技",
    title: "AI医疗销售-广东区域",
    salary: "15-20K·15薪",
    location: "广州越秀区华乐",
    experience: "3-5年",
    education: "本科",
    segment: "医疗AI/行业大模型",
    roleFamily: "大客户/行业销售经理",
    requirementsSummary: "制定广东区域医疗AI销售策略，推进影像、病理辅助诊断和医疗大模型平台的区域销售目标。",
    sourceUrl: "https://www.zhipin.com/zhaopin/6661c084fb2d42321ndy2Nu4Eg~~/",
    sourceEvidence: "2026-07-20 BOSS公开列表页展示主要字段和职责摘要。",
  },
  {
    collectedAt: "2026-07-20",
    source: "BOSS公开页（列表页已复核）",
    company: "商汤科技",
    title: "医疗解决方案架构师",
    salary: "20-40K·15薪",
    location: "上海徐汇区漕河泾",
    experience: "5-10年",
    education: "本科",
    segment: "医疗AI/行业大模型",
    roleFamily: "售前/解决方案顾问",
    requirementsSummary: "负责医疗行业售前方案，跟踪医疗大模型政策、技术和竞争格局，支持客户拓展和方案落地。",
    sourceUrl: "https://m.zhipin.com/zhaopin/68843d92f228ad4a1n1_3926FA~~/",
    sourceEvidence: "2026-07-20 BOSS公开列表页展示主要字段和职责摘要。",
  },
  {
    collectedAt: "2026-07-20",
    source: "BOSS公开页（列表页已复核）",
    company: "商汤科技",
    title: "韩国销售经理",
    salary: "25-30K·15薪",
    location: "深圳南山区科技园",
    experience: "3-5年",
    education: "本科",
    segment: "AI解决方案/海外市场",
    roleFamily: "大客户/行业销售经理",
    requirementsSummary: "面向韩国市场开展AI解决方案业务拓展、客户开发和渠道合作。",
    sourceUrl: "https://m.zhipin.com/zhaopin/68843d92f228ad4a1n1_3926FA~~/",
    sourceEvidence: "2026-07-20 BOSS公开列表页展示主要字段和职责摘要。",
  },
  {
    collectedAt: "2026-07-20",
    source: "BOSS公开页（列表页已复核）",
    company: "阿里云/通义",
    title: "通义大模型产品解决方案架构师（华南区域）",
    salary: "25-50K",
    location: "深圳南山区科技园",
    experience: "3-5年",
    education: "本科",
    segment: "基座大模型/云计算",
    roleFamily: "售前/解决方案顾问",
    requirementsSummary: "判断高价值机会，开展深度技术交流，赋能销售和行业团队，参与商业策略、机会筛选和跨团队协同。",
    sourceUrl: "https://www.zhipin.com/zhaopin/d466b401a68c2a9b0X1-09S7/",
    sourceEvidence: "2026-07-20 BOSS公开列表页展示主要字段和职责摘要。",
  },
  {
    collectedAt: "2026-07-20",
    source: "BOSS公开页（列表页已复核）",
    company: "阿里云",
    title: "云原生AI应用架构产品解决方案架构师-深圳",
    salary: "30-60K",
    location: "深圳南山区科技园",
    experience: "3-5年",
    education: "本科",
    segment: "AI Agent/云原生",
    roleFamily: "售前/解决方案顾问",
    requirementsSummary: "为企业设计Agent、LLM网关、Skill/MCP和多Agent应用架构，支持技术交流与商业转化。",
    sourceUrl: "https://www.zhipin.com/zhaopin/d466b401a68c2a9b0X1-09S7/",
    sourceEvidence: "2026-07-20 BOSS公开列表页展示主要字段和职责摘要。",
  },
  {
    collectedAt: "2026-07-20",
    source: "BOSS公开页（列表页已复核）",
    company: "阿里云",
    title: "AI解决方案架构师专家",
    salary: "25-45K",
    location: "宁波海曙区灵桥",
    experience: "5-10年",
    education: "本科",
    segment: "行业大模型/云计算",
    roleFamily: "售前/解决方案顾问",
    requirementsSummary: "在政务、教育、医疗和企业客户中识别高价值AI场景，推进方案设计和商机落地。",
    sourceUrl: "https://m.zhipin.com/zhaopin/1e5acf80ad6e661c1nZ72N-0FA~~/",
    sourceEvidence: "2026-07-20 BOSS公开列表页展示主要字段和职责摘要。",
  },
  {
    collectedAt: "2026-07-20",
    source: "BOSS公开页（列表页已复核）",
    company: "阿里云",
    title: "行业解决方案架构师（战略客户）-北京",
    salary: "45-50K",
    location: "北京朝阳区来广营",
    experience: "5-10年",
    education: "本科",
    segment: "公共云/战略客户解决方案",
    roleFamily: "售前/解决方案顾问",
    requirementsSummary: "支持互联网战略客户销售，以售前项目成功为目标推进客户方案和内部资源协同。",
    sourceUrl: "https://www.zhipin.com/zhaopin/6e23ceed21b0615e0nBz3du-EQ~~/",
    sourceEvidence: "2026-07-20 BOSS公开列表页展示主要字段和职责摘要。",
  },
  {
    collectedAt: "2026-07-20",
    source: "BOSS公开页（列表页已复核）",
    company: "阿里云",
    title: "解决方案架构师-Agent Infra-北京/杭州",
    salary: "35-65K·16薪",
    location: "北京朝阳区太阳宫等",
    experience: "5-10年",
    education: "本科",
    segment: "AI Agent/百炼",
    roleFamily: "售前/解决方案顾问",
    requirementsSummary: "基于百炼、AgentScope和AgentRun等产品设计Agent基础设施方案，支持重点客户项目。",
    sourceUrl: "https://www.zhipin.com/zhaopin/6e23ceed21b0615e0nBz3du-EQ~~/",
    sourceEvidence: "2026-07-20 BOSS公开列表页展示主要字段和职责摘要。",
  },
  {
    collectedAt: "2026-07-20",
    source: "BOSS公开页（列表页已复核）",
    company: "飞创协作（火山引擎合作伙伴）",
    title: "火山引擎&AI&Agent销售专员",
    salary: "10-15K·13薪",
    location: "深圳南山区科技园",
    experience: "3-5年",
    education: "本科",
    segment: "基座大模型/MaaS/Agent",
    roleFamily: "AI软件/大模型销售",
    requirementsSummary: "销售豆包大模型MaaS、Agent和向量数据库等产品；招聘主体为合作伙伴而非字节跳动。",
    sourceUrl: "https://www.zhipin.com/zhaopin/951d252cdb4ddc801nV63Nm-/",
    sourceEvidence: "2026-07-20 BOSS公开列表页展示主要字段和职责摘要。",
  },
  {
    collectedAt: "2026-07-20",
    source: "BOSS公开页（列表页已复核）",
    company: "字节跳动/火山引擎",
    title: "销售策略经理-激励政策-火山引擎",
    salary: "30-60K·15薪",
    location: "北京海淀区中关村",
    experience: "3-5年",
    education: "本科",
    segment: "云计算/大模型销售管理",
    roleFamily: "销售管理/区域负责人",
    requirementsSummary: "设计销售激励、绩效和策略机制，支持销售组织效率和目标达成；不是一线客户销售岗。",
    sourceUrl: "https://www.zhipin.com/zhaopin/d09c2b4363cfaa381nB93d-4Fg~~/",
    sourceEvidence: "2026-07-20 BOSS公开列表页展示主要字段和职责摘要。",
  },
  {
    collectedAt: "2026-07-20",
    source: "BOSS公开页（列表页已复核）",
    company: "中科闻歌",
    title: "大模型销售经理/总监-北京",
    salary: "12-18K·20薪",
    location: "北京海淀区五道口",
    experience: "5-10年",
    education: "大专",
    segment: "政企大模型",
    roleFamily: "销售管理/区域负责人",
    requirementsSummary: "制定并执行政企市场销售策略，识别机会、拓展客户并开展品牌与市场洞察。",
    sourceUrl: "https://www.zhipin.com/zhaopin/4ea682b28a82c38b1XJ739q7Eg~~/",
    sourceEvidence: "2026-07-20 BOSS公开列表页展示主要字段和职责摘要。",
  },
];

function requirementFor(job) {
  const hard = [job.experience || "经验未披露", job.education || "学历未披露"].join(" / ");
  const family = job.roleFamily || "销售岗位";
  let common = "客户开拓、需求判断、商务推进、目标管理与跨团队协同";
  if (family.includes("售前") || family.includes("解决方案")) {
    common = "行业场景分析、方案设计、技术交流、价值论证、POC或项目协同";
  } else if (family.includes("管理") || family.includes("负责人")) {
    common = "销售策略、目标拆解、团队管理、预测复盘和组织协同";
  } else if (family.includes("客户成功") || family.includes("交付")) {
    common = "客户经营、交付协同、价值实现、续费增购和问题闭环";
  } else if (family.includes("渠道") || family.includes("生态")) {
    common = "伙伴招募、联合方案、渠道管理、商机协同和生态运营";
  }
  return `${hard}；岗位族共性：${common}`;
}

function matchFor(job) {
  const family = job.roleFamily || "";
  const text = `${job.title} ${job.segment} ${family}`;
  if (/Business Builder|商业化生态/.test(text)) {
    return "懂车帝区域收入增长、乐道0-1市场开拓、ROI验证、客户经营和可复制销售打法与该岗位强相关";
  }
  if (/汽车|零售|消费/.test(text)) {
    return "汽车/零售行业经验直接相关；有客户诊断、ROI量化、增购召回和团队管理证据";
  }
  if (/销售管理|负责人|总监|Leader|VP/i.test(text)) {
    return "有团队目标拆解、培训晋升和业绩改善证据；曾带队完成率超过200%";
  }
  if (/客户成功|交付/.test(text)) {
    return "有存量客户经营、问题闭环、流失召回、增购和价值复盘证据";
  }
  if (/售前|解决方案|架构/.test(text)) {
    return "有业务诊断、方案沟通、ROI呈现和跨团队协同；AI工具实践可支撑Demo表达";
  }
  return "有大客户经营、决策人沟通、商机推进、ROI量化和客户增购证据";
}

function gapFor(job) {
  const text = `${job.title} ${job.segment} ${job.roleFamily}`;
  if (/Business Builder|商业化生态/.test(text)) {
    return "缺少AI产品真实商业化收入、生态合作、非标准交易设计、英文提案和明确quota证据";
  }
  if (/医疗|政务|金融|半导体|GPU|数据库|云原生|架构/.test(text)) {
    return "缺少该行业/技术栈项目证据、企业AI POC和正式技术方案材料";
  }
  if (/海外|韩国|国际|South Pacific|香港/.test(`${text} ${job.location}`)) {
    return "缺少海外市场、英文商务或跨境渠道的可验证业绩";
  }
  if (/总监|负责人|Leader|VP/.test(text)) {
    return "管理范围和企业级收入体量仍需证明；缺少AI业务团队管理经验";
  }
  return "缺少真实AI产品签约/POC/交付闭环及合同额、ARR、回款或续费证据";
}

function aiRelevance(job) {
  const text = `${job.company} ${job.title} ${job.segment} ${job.requirementsSummary}`.toLowerCase();
  if (/大模型|maas|genai|agent|ai销售|人工智能|minimax|月之暗面|moonshot|智谱|商汤|通义|豆包|千帆|乐享ai|智算/.test(text)) return "高";
  if (/云计算|云销售|云业务|解决方案|机器人|gpu|npu|智能|飞书|数据|自动化|视觉/.test(text)) return "中";
  return "低";
}

function priorityFor(job) {
  const relevance = aiRelevance(job);
  const fitText = `${job.title} ${job.segment}`;
  const directFit = /汽车|零售|消费|大客户|KA|AI销售|大模型销售|客户成功/.test(fitText);
  if (relevance === "高" && directFit) return "P0";
  if (relevance === "高" || directFit) return "P1";
  return "P2";
}

function normalizeJob(job) {
  const salary = salaryParts(job.salary);
  const location = locationParts(job.location);
  return {
    ...job,
    minSalary: salary.min,
    maxSalary: salary.max,
    months: salary.months,
    city: location.city,
    area: location.area,
    evidenceStatus: job.collectedAt >= "2026-07-20" ? `${job.collectedAt}本轮公开列表/截图已复核` : `${job.collectedAt}历史BOSS公开线索，本轮未逐条复核`,
    aiRelevance: aiRelevance(job),
    priority: priorityFor(job),
    requirement: requirementFor(job),
    match: matchFor(job),
    gap: gapFor(job),
  };
}

function dedupeJobs(jobs) {
  const map = new Map();
  for (const job of jobs) {
    const key = [job.company, job.title, job.salary, job.location].map((item) => String(item).trim().toLowerCase()).join("|");
    const previous = map.get(key);
    if (!previous || String(job.collectedAt) > String(previous.collectedAt)) map.set(key, job);
  }
  return [...map.values()];
}

const sourceText = await fs.readFile(sourceCsv, "utf8");
const historicBossJobs = parseCsv(sourceText).filter((job) => job.source === "BOSS公开页");
const allBossJobs = dedupeJobs([...historicBossJobs, ...currentJobs]).map(normalizeJob);

const aiJobs = allBossJobs
  .filter((job) => job.aiRelevance !== "低")
  .sort((a, b) => {
    const p = { P0: 0, P1: 1, P2: 2 };
    const r = { 高: 0, 中: 1, 低: 2 };
    return p[a.priority] - p[b.priority]
      || r[a.aiRelevance] - r[b.aiRelevance]
      || (b.collectedAt > a.collectedAt ? 1 : b.collectedAt < a.collectedAt ? -1 : 0)
      || (b.minSalary ?? -1) - (a.minSalary ?? -1)
      || (b.maxSalary ?? -1) - (a.maxSalary ?? -1);
  });

const highSalaryJobs = allBossJobs
  .filter((job) => job.maxSalary !== null && job.maxSalary >= 20)
  .sort((a, b) => (b.minSalary ?? -1) - (a.minSalary ?? -1)
    || (b.maxSalary ?? -1) - (a.maxSalary ?? -1)
    || ({ P0: 0, P1: 1, P2: 2 }[a.priority] - { P0: 0, P1: 1, P2: 2 }[b.priority]));

const columns = [
  "优先级",
  "公司",
  "岗位标题",
  "岗位方向",
  "薪资原文",
  "20K判定",
  "城市/具体区域",
  "经验/学历",
  "JD工作内容摘要",
  "任职门槛（公开字段+岗位族归纳）",
  "你的匹配证据",
  "主要Gap",
  "AI相关度",
  "证据状态",
  "BOSS链接",
  "采集/复核日期",
  "月薪下限K",
  "月薪上限K",
  "年薪月数",
  "年薪估算下限(万)",
  "年薪估算上限(万)",
];

function rowFor(job) {
  const threshold = job.minSalary >= 20 ? "下限≥20K" : job.maxSalary >= 20 ? "上限≥20K" : "低于20K";
  return [
    job.priority,
    job.company,
    job.title,
    job.roleFamily,
    job.salary,
    threshold,
    job.area,
    `${job.experience || "未披露"} / ${job.education || "未披露"}`,
    job.requirementsSummary,
    job.requirement,
    job.match,
    job.gap,
    job.aiRelevance,
    job.evidenceStatus,
    job.sourceUrl,
    job.collectedAt,
    job.minSalary,
    job.maxSalary,
    job.months,
    null,
    null,
  ];
}

function styleSheet(sheet, jobs, mode) {
  const title = mode === "ai" ? "AI方向：大模型厂商与AI相关销售/售前岗位" : "薪酬方向：BOSS月薪区间上限20K以上销售岗位";
  const note = mode === "ai"
    ? "排序逻辑：AI相关度、与贺文杰现有证据匹配度、本轮复核状态、薪资。月之暗面商业化/生态BD已按用户截图补录。"
    : "口径：当前项目BOSS公开证据池的全部可解析样本；月薪区间上限≥20K即纳入。历史线索保留采集日期，不能视为今天仍在招。";
  const startRow = 6;
  const endRow = startRow + jobs.length - 1;

  sheet.showGridLines = false;
  sheet.mergeCells("A1:U1");
  sheet.getRange("A1").values = [[title]];
  sheet.getRange("A1:U1").format = {
    fill: "#17324D",
    font: { bold: true, color: "#FFFFFF", size: 18 },
    verticalAlignment: "center",
  };
  sheet.getRange("A1:U1").format.rowHeight = 34;

  sheet.mergeCells("A2:U2");
  sheet.getRange("A2").values = [[note]];
  sheet.getRange("A2:U2").format = {
    fill: "#E8EFF5",
    font: { color: "#334155", size: 10 },
    wrapText: true,
    verticalAlignment: "center",
  };
  sheet.getRange("A2:U2").format.rowHeight = 34;

  sheet.getRange("A3:H3").values = [["岗位数", null, "下限≥20K", null, "本轮已复核", null, "AI高相关", null]];
  sheet.getRange("B3").formulas = [[`=COUNTA(B${startRow}:B${endRow})`]];
  sheet.getRange("D3").formulas = [[`=COUNTIF(F${startRow}:F${endRow},\"下限≥20K\")`]];
  sheet.getRange("F3").formulas = [[`=COUNTIF(P${startRow}:P${endRow},\"2026-07-20\")+COUNTIF(P${startRow}:P${endRow},\"2026-07-21\")`]];
  sheet.getRange("H3").formulas = [[`=COUNTIF(M${startRow}:M${endRow},\"高\")`]];
  sheet.getRange("A3:H3").format = {
    fill: "#F7FAFC",
    font: { color: "#17324D", bold: true },
    verticalAlignment: "center",
  };
  sheet.getRange("A3:H3").format.borders = { preset: "outside", style: "thin", color: "#CBD5E1" };
  sheet.getRange("A3:H3").format.rowHeight = 26;

  sheet.getRange("A5:U5").values = [columns];
  sheet.getRange("A5:U5").format = {
    fill: "#0F766E",
    font: { bold: true, color: "#FFFFFF", size: 10 },
    wrapText: true,
    horizontalAlignment: "center",
    verticalAlignment: "center",
    borders: { preset: "inside", style: "thin", color: "#D4E5E2" },
  };
  sheet.getRange("A5:U5").format.rowHeight = 34;

  if (jobs.length) {
    sheet.getRange(`A${startRow}:U${endRow}`).values = jobs.map(rowFor);
    sheet.getRange(`T${startRow}`).formulas = [[`=IF(OR(Q${startRow}=\"\",S${startRow}=\"\"),\"\",Q${startRow}*S${startRow}/10)`]];
    sheet.getRange(`T${startRow}:T${endRow}`).fillDown();
    sheet.getRange(`U${startRow}`).formulas = [[`=IF(OR(R${startRow}=\"\",S${startRow}=\"\"),\"\",R${startRow}*S${startRow}/10)`]];
    sheet.getRange(`U${startRow}:U${endRow}`).fillDown();

    const body = sheet.getRange(`A${startRow}:U${endRow}`);
    body.format = {
      font: { color: "#1F2937", size: 9 },
      verticalAlignment: "top",
      wrapText: true,
      borders: {
        insideHorizontal: { style: "thin", color: "#E2E8F0" },
      },
    };
    body.format.rowHeight = 68;

    sheet.getRange(`A${startRow}:A${endRow}`).format.horizontalAlignment = "center";
    sheet.getRange(`E${startRow}:F${endRow}`).format.horizontalAlignment = "center";
    sheet.getRange(`M${startRow}:N${endRow}`).format.horizontalAlignment = "center";
    sheet.getRange(`P${startRow}:U${endRow}`).format.horizontalAlignment = "center";
    sheet.getRange(`Q${startRow}:S${endRow}`).format.numberFormat = "0.0";
    sheet.getRange(`T${startRow}:U${endRow}`).format.numberFormat = "0.0";

    sheet.getRange(`A${startRow}:A${endRow}`).conditionalFormats.add("containsText", {
      text: "P0",
      format: { fill: "#DCFCE7", font: { bold: true, color: "#166534" } },
    });
    sheet.getRange(`A${startRow}:A${endRow}`).conditionalFormats.add("containsText", {
      text: "P1",
      format: { fill: "#FEF3C7", font: { bold: true, color: "#92400E" } },
    });
    sheet.getRange(`A${startRow}:A${endRow}`).conditionalFormats.add("containsText", {
      text: "P2",
      format: { fill: "#F1F5F9", font: { color: "#475569" } },
    });
    sheet.getRange(`M${startRow}:M${endRow}`).conditionalFormats.add("containsText", {
      text: "高",
      format: { fill: "#D1FAE5", font: { bold: true, color: "#065F46" } },
    });
    sheet.getRange(`N${startRow}:N${endRow}`).conditionalFormats.add("containsText", {
      text: "2026-07-20",
      format: { fill: "#DBEAFE", font: { color: "#1E40AF" } },
    });
    sheet.getRange(`F${startRow}:F${endRow}`).conditionalFormats.add("containsText", {
      text: "下限≥20K",
      format: { fill: "#DCFCE7", font: { color: "#166534" } },
    });

    const tableName = mode === "ai" ? "AIJobsTable" : "HighSalaryJobsTable";
    const table = sheet.tables.add(`A5:U${endRow}`, true, tableName);
    table.style = "TableStyleMedium2";
    table.showBandedColumns = false;
    table.showFilterButton = true;
  }

  const widths = [9, 19, 30, 20, 14, 14, 24, 18, 52, 46, 45, 42, 11, 32, 48, 15, 12, 12, 10, 17, 17];
  widths.forEach((width, index) => {
    sheet.getRangeByIndexes(0, index, Math.max(endRow, 5), 1).format.columnWidth = width;
  });
  sheet.freezePanes.freezeRows(5);
  sheet.freezePanes.freezeColumns(3);
}

await fs.mkdir(outputDir, { recursive: true });
const workbook = Workbook.create();
const aiSheet = workbook.worksheets.add("AI大模型厂商");
const salarySheet = workbook.worksheets.add("20K以上高薪销售");
styleSheet(aiSheet, aiJobs, "ai");
styleSheet(salarySheet, highSalaryJobs, "salary");

const inspect = await workbook.inspect({
  kind: "sheet,table,formula",
  maxChars: 6000,
  tableMaxRows: 4,
  tableMaxCols: 8,
  options: { maxResults: 100 },
});
await fs.writeFile(path.join(outputDir, "workbook_inspect.txt"), inspect.ndjson ?? String(inspect), "utf8");

for (const sheetName of ["AI大模型厂商", "20K以上高薪销售"]) {
  const preview = await workbook.render({ sheetName, autoCrop: "all", scale: 0.75, format: "png" });
  const fileName = sheetName === "AI大模型厂商" ? "preview_ai.png" : "preview_high_salary.png";
  await fs.writeFile(path.join(outputDir, fileName), new Uint8Array(await preview.arrayBuffer()));
}

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputXlsx);

const audit = {
  historicBossJobs: historicBossJobs.length,
  currentJobs: currentJobs.length,
  dedupedBossJobs: allBossJobs.length,
  aiJobs: aiJobs.length,
  highSalaryJobs: highSalaryJobs.length,
  outputXlsx,
};
await fs.writeFile(path.join(outputDir, "workbook_audit.json"), JSON.stringify(audit, null, 2), "utf8");
console.log(JSON.stringify(audit, null, 2));
