#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const searchConfigPath = join(projectRoot, "06_自动化采集/config/searches.json");
const segmentPath = join(projectRoot, "06_自动化采集/config/ai_company_segments.csv");
const outputCsvPath = join(projectRoot, "01_行情收集/BOSS人工采样作业包.csv");
const outputMdPath = join(projectRoot, "01_行情收集/BOSS人工采样作业包.md");

const segmentPriority = {
  "基座大模型/Agent平台": "P0",
  "云计算/大模型平台": "P0",
  "智能客服/营销/销售AI": "P0",
  "AI芯片/GPU/加速卡": "P0",
  "AI服务器/智算基础设施": "P0",
  "工业AI/智能制造": "P1",
  "AI Agent/RPA/流程自动化": "P1",
  "数据/MLOps/AI基础软件": "P1",
  "智能汽车/机器人/具身智能": "P1",
  "AI安全/私有化/信创": "P1",
  "AI视觉/安防/质检": "P2",
  "智算中心/数据中心服务": "P2"
};

const roleTermsBySegment = {
  "基座大模型/Agent平台": ["AI销售", "大模型销售", "解决方案顾问"],
  "云计算/大模型平台": ["AI销售", "大客户销售", "解决方案顾问"],
  "智能客服/营销/销售AI": ["AI销售", "SaaS销售", "销售经理"],
  "AI芯片/GPU/加速卡": ["大客户销售", "渠道销售", "解决方案顾问"],
  "AI服务器/智算基础设施": ["大客户销售", "行业销售", "售前"],
  "工业AI/智能制造": ["大客户销售", "销售经理", "解决方案顾问"],
  "AI Agent/RPA/流程自动化": ["AI销售", "大客户销售", "售前"],
  "数据/MLOps/AI基础软件": ["大客户销售", "解决方案顾问", "售前"],
  "智能汽车/机器人/具身智能": ["渠道销售", "海外销售", "销售经理"],
  "AI安全/私有化/信创": ["政企销售", "大客户销售", "销售经理"],
  "AI视觉/安防/质检": ["行业销售", "渠道销售", "售前"],
  "智算中心/数据中心服务": ["大客户销售", "渠道销售", "销售经理"]
};

const companiesPerPriority = {
  P0: 6,
  P1: 5,
  P2: 4
};

function usage() {
  return `Usage:
  npm run sampling:manual -- --city 广州

Options:
  --city <name>       Default: 广州
  --per-segment <n>   Override companies per segment.
`;
}

function parseArgs(argv) {
  const args = { city: "广州" };
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const next = () => {
      i += 1;
      if (i >= argv.length) throw new Error(`Missing value for ${key}`);
      return argv[i];
    };
    if (key === "--city") args.city = next();
    else if (key === "--per-segment") args.perSegment = Number.parseInt(next(), 10);
    else if (key === "--help" || key === "-h") args.help = true;
    else throw new Error(`Unknown option: ${key}`);
  }
  return args;
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const headers = lines.shift().split(",");
  return lines.map((line) => {
    const values = line.split(",");
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

function shellDoubleQuote(value) {
  return `"${String(value ?? "").replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function cityCode(searchConfig, cityName) {
  return searchConfig.defaultCityCodes[cityName] ?? searchConfig.defaultCityCodes["全国"];
}

function makeUrl(template, query, cityName, searchConfig) {
  return template
    .replaceAll("{queryEncoded}", encodeURIComponent(query))
    .replaceAll("{query}", query)
    .replaceAll("{cityCode}", cityCode(searchConfig, cityName))
    .replaceAll("{city}", cityName);
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

function targetSamples(priority) {
  if (priority === "P0") return 12;
  if (priority === "P1") return 10;
  return 8;
}

function requiredFields(segment) {
  const base = "公司;岗位;薪资;城市;经验;学历;职责;要求;客户类型;是否销售管理;是否售前/解决方案";
  if (/芯片|服务器|智算|数据中心/.test(segment)) return `${base};硬件/算力关键词;渠道/政企/IDC线索`;
  if (/基座大模型|云计算|Agent平台/.test(segment)) return `${base};大模型/API/RAG/私有化关键词;行业场景`;
  if (/工业|制造|视觉|质检/.test(segment)) return `${base};制造业场景;项目交付/POC线索`;
  return base;
}

function acceptanceCriteria(segment) {
  if (/芯片|服务器|智算|数据中心/.test(segment)) return "优先保留明确写到政企/云/IDC/渠道/算力/服务器生态的岗位";
  if (/基座大模型|云计算|Agent平台/.test(segment)) return "优先保留明确写到大模型/API/RAG/企业知识库/私有化/行业客户的岗位";
  if (/客服|营销|RPA|流程自动化/.test(segment)) return "优先保留明确写到SaaS/CRM/客户运营/线索转化/续费的岗位";
  if (/工业|制造|视觉|质检/.test(segment)) return "优先保留明确写到制造业/质检/产线/项目交付/POC的岗位";
  return "优先保留职责完整、薪资可读、客户类型清晰的销售/售前/管理岗位";
}

function buildTasks(args) {
  const searchConfig = JSON.parse(readFileSync(searchConfigPath, "utf8"));
  const source = searchConfig.sources.find((item) => item.name === "BOSS直聘" && item.enabled);
  const segments = parseCsv(readFileSync(segmentPath, "utf8"));
  const grouped = new Map();

  for (const item of segments) {
    const priority = segmentPriority[item.segment] || "P2";
    if (!grouped.has(item.segment)) grouped.set(item.segment, { priority, items: [] });
    grouped.get(item.segment).items.push(item);
  }

  const tasks = [];
  for (const [segment, group] of grouped.entries()) {
    const priority = group.priority;
    const companyLimit = Number.isFinite(args.perSegment) ? args.perSegment : companiesPerPriority[priority];
    const companies = group.items
      .slice()
      .sort((a, b) => Number(a.priority || 99) - Number(b.priority || 99))
      .slice(0, companyLimit);
    const roles = roleTermsBySegment[segment] || ["AI销售", "大客户销售", "解决方案顾问"];

    for (const company of companies) {
      for (const role of roles) {
        const query = `${company.company} ${role}`;
        tasks.push({
          priority,
          segment,
          layer: company.layer,
          company: company.company,
          role,
          query,
          city: args.city,
          targetSamples: targetSamples(priority),
          requiredFields: requiredFields(segment),
          acceptanceCriteria: acceptanceCriteria(segment),
          searchUrl: makeUrl(source.urlTemplate, query, args.city, searchConfig)
        });
      }
    }
  }

  return tasks
    .sort((a, b) => {
      const rank = { P0: 0, P1: 1, P2: 2 };
      return rank[a.priority] - rank[b.priority] || a.segment.localeCompare(b.segment, "zh-Hans-CN") || a.company.localeCompare(b.company, "zh-Hans-CN");
    })
    .map((task, index) => ({
      sampleOrder: index + 1,
      ...task,
      importCommand: [
        "npm run import:manual --",
        "--source",
        shellDoubleQuote("BOSS直聘"),
        "--query",
        shellDoubleQuote(task.query),
        "--company",
        shellDoubleQuote(task.company),
        "--role",
        shellDoubleQuote(task.role),
        "--city",
        shellDoubleQuote(task.city)
      ].join(" ")
    }));
}

const args = parseArgs(process.argv);
if (args.help) {
  console.log(usage());
  process.exit(0);
}

const tasks = buildTasks(args);
mkdirSync(dirname(outputCsvPath), { recursive: true });
const headers = [
  "sampleOrder",
  "priority",
  "segment",
  "layer",
  "company",
  "role",
  "query",
  "city",
  "targetSamples",
  "requiredFields",
  "acceptanceCriteria",
  "searchUrl",
  "importCommand"
];
writeFileSync(outputCsvPath, `${csv([headers])}\n${csv(tasks.map((task) => headers.map((header) => task[header])))}\n`);

const topRows = tasks.slice(0, 80).map((task) => {
  return `| ${task.sampleOrder} | ${task.priority} | ${task.segment} | ${task.company} | ${task.role} | https://www.zhipin.com/ | \`${task.query || `${task.company} ${task.role}`}\` | \`${task.importCommand}\` |`;
});
const byPriority = tasks.reduce((map, task) => {
  map[task.priority] = (map[task.priority] || 0) + 1;
  return map;
}, {});
const md = `# BOSS人工采样作业包

更新时间：${formatDate()}

## 一、本质判断

这份作业包不是自动采集脚本，而是 BOSS 风控恢复期的人工采样清单。它把 AI 全行业销售岗位调研拆成可逐条执行的搜索任务：打开 BOSS 首页、站内搜索关键词、人工判断岗位质量、复制岗位文本、用导入命令沉淀样本。

## 二、作业规模

| 优先级 | 任务数 | 说明 |
| --- | ---: | --- |
| P0 | ${byPriority.P0 || 0} | 先补足大模型、云平台、智能客服/营销、AI芯片、AI服务器/智算 |
| P1 | ${byPriority.P1 || 0} | 再补工业AI、RPA/Agent、数据/MLOps、机器人/具身、AI安全 |
| P2 | ${byPriority.P2 || 0} | 最后补视觉安防质检、智算中心/IDC |
| 合计 | ${tasks.length} | 每个任务建议人工挑选 1 条高相关岗位导入 |

## 三、执行方法

1. 每次只处理 1 个站内搜索关键词，不连续刷新。
2. 优先选择薪资可读、职责完整、客户类型清晰的销售/售前/销售管理岗位。
3. 复制岗位卡片或岗位详情全文。
4. 执行该行的导入命令。
5. 每导入 10 条后运行：

\`\`\`bash
npm run summary:jobs
npm run report:full
npm run audit:research
\`\`\`

## 四、前80条采样任务

| 序号 | 优先级 | 赛道 | 公司 | 岗位词 | BOSS首页 | 站内搜索关键词 | 导入命令 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
${topRows.join("\n")}

完整 CSV：

\`\`\`text
${outputCsvPath}
\`\`\`
`;
writeFileSync(outputMdPath, md);

console.log(`已生成：${outputCsvPath}`);
console.log(`已生成：${outputMdPath}`);
console.log(`任务数：${tasks.length}`);
