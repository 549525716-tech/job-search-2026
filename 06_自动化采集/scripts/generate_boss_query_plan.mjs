#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const searchConfigPath = join(projectRoot, "06_自动化采集/config/searches.json");
const segmentPath = join(projectRoot, "06_自动化采集/config/ai_company_segments.csv");
const industryTargetsPath = join(projectRoot, "06_自动化采集/config/industry_targets.txt");
const rateLimitConfigPath = join(projectRoot, "06_自动化采集/config/rate_limits.json");
const outputCsvPath = join(projectRoot, "01_行情收集/BOSS全行业AI销售岗位查询计划.csv");
const outputMdPath = join(projectRoot, "01_行情收集/BOSS全行业AI销售岗位查询计划.md");

const companyRolePriority = [
  "AI销售",
  "大模型销售",
  "大客户销售",
  "销售经理",
  "销售总监",
  "解决方案顾问",
  "售前",
  "AI售前",
  "渠道销售",
  "政企销售"
];

const industryRolePriority = [
  "销售",
  "AI销售",
  "大客户销售",
  "销售经理",
  "解决方案顾问",
  "售前"
];

const companyPriority = [
  "智谱AI",
  "月之暗面",
  "MiniMax",
  "DeepSeek",
  "阶跃星辰",
  "百川智能",
  "零一万物",
  "面壁智能",
  "商汤科技",
  "昆仑万维",
  "百度智能云",
  "阿里云",
  "腾讯云",
  "火山引擎",
  "华为云",
  "京东云",
  "科大讯飞",
  "金山云",
  "移动云",
  "天翼云",
  "第四范式",
  "Zilliz",
  "明略科技",
  "神策数据",
  "沃丰科技",
  "Udesk",
  "智齿科技",
  "百应科技",
  "实在智能",
  "来也科技",
  "影刀RPA",
  "树根互联",
  "格创东智",
  "创新奇智",
  "黑湖科技",
  "寒武纪",
  "海光信息",
  "摩尔线程",
  "壁仞科技",
  "燧原科技",
  "沐曦集成电路",
  "浪潮信息",
  "新华三",
  "联想",
  "中科曙光"
];

function usage() {
  return `Usage:
  npm run plan:boss -- --city 广州 --batch-size 1

Options:
  --city <name>       Default: 广州
  --batch-size <n>    Default: 1
`;
}

function parseArgs(argv) {
  const args = { city: "广州", batchSize: 1 };
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const next = () => {
      i += 1;
      if (i >= argv.length) throw new Error(`Missing value for ${key}`);
      return argv[i];
    };
    if (key === "--city") args.city = next();
    else if (key === "--batch-size") args.batchSize = Number.parseInt(next(), 10);
    else if (key === "--help" || key === "-h") args.help = true;
    else throw new Error(`Unknown option: ${key}`);
  }
  return args;
}

function readOptionalJson(filePath, fallback = {}) {
  if (!existsSync(filePath)) return fallback;
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const headers = lines.shift().split(",");
  return lines.map((line) => {
    const values = line.split(",");
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
  });
}

function readIndustryTargets() {
  return readFileSync(industryTargetsPath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .flatMap((line) => line.split(/[，,]/).map((item) => item.trim()).filter(Boolean));
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function csv(rows) {
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

function prioritize(items, priority, keyFn = (item) => item) {
  const byKey = new Map(items.map((item) => [keyFn(item), item]));
  const front = priority.map((key) => byKey.get(key)).filter(Boolean);
  const frontKeys = new Set(front.map(keyFn));
  return [...front, ...items.filter((item) => !frontKeys.has(keyFn(item)))];
}

function makeUrl(template, query, cityCode, cityName) {
  return template
    .replaceAll("{queryEncoded}", encodeURIComponent(query))
    .replaceAll("{query}", query)
    .replaceAll("{cityCode}", cityCode)
    .replaceAll("{city}", cityName);
}

function formatDateTime(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")} Asia/Shanghai`;
}

function buildPlan(args) {
  const searchConfig = JSON.parse(readFileSync(searchConfigPath, "utf8"));
  const source = searchConfig.sources.find((item) => item.name === "BOSS直聘" && item.enabled);
  const cityCode = searchConfig.defaultCityCodes[args.city] || searchConfig.defaultCityCodes["全国"];
  const segments = parseCsv(readFileSync(segmentPath, "utf8"));
  const industries = readIndustryTargets();
  const orderedCompanies = prioritize(segments, companyPriority, (item) => item.company);
  const rows = [];

  let searchIndex = 1;
  for (const role of companyRolePriority) {
    for (const item of orderedCompanies) {
      const query = `${item.company} ${role}`;
      rows.push({
        searchIndex,
        batchIndex: Math.ceil(searchIndex / args.batchSize),
        queryKind: "company",
        layer: item.layer,
        segment: item.segment,
        target: item.company,
        role,
        query,
        city: args.city,
        url: makeUrl(source.urlTemplate, query, cityCode, args.city),
        priority: item.priority,
        salesFit: item.sales_fit
      });
      searchIndex += 1;
    }
  }

  for (const role of industryRolePriority) {
    for (const industry of industries) {
      const query = `${industry} ${role}`;
      rows.push({
        searchIndex,
        batchIndex: Math.ceil(searchIndex / args.batchSize),
        queryKind: "industry",
        layer: "",
        segment: industry,
        target: industry,
        role,
        query,
        city: args.city,
        url: makeUrl(source.urlTemplate, query, cityCode, args.city),
        priority: "",
        salesFit: ""
      });
      searchIndex += 1;
    }
  }
  return rows;
}

const args = parseArgs(process.argv);
if (args.help) {
  console.log(usage());
  process.exit(0);
}
const rateLimitConfig = readOptionalJson(rateLimitConfigPath, {});
if (Number.isFinite(rateLimitConfig.boss?.overnightBatchSize)) {
  args.batchSize = Math.min(args.batchSize, rateLimitConfig.boss.overnightBatchSize);
}

const plan = buildPlan(args);
mkdirSync(dirname(outputCsvPath), { recursive: true });
const headers = ["searchIndex", "batchIndex", "queryKind", "layer", "segment", "target", "role", "query", "city", "priority", "salesFit", "safeBossHomeUrl", "url"];
writeFileSync(outputCsvPath, `${csv([headers])}\n${csv(plan.map((row) => headers.map((header) => header === "safeBossHomeUrl" ? "https://www.zhipin.com/" : row[header])))}\n`);

const byKind = plan.reduce((map, item) => {
  map[item.queryKind] = (map[item.queryKind] || 0) + 1;
  return map;
}, {});
const firstRows = plan.slice(0, 40).map((item) => {
  return `| ${item.searchIndex} | ${item.batchIndex} | ${item.queryKind} | ${item.segment} | ${item.target} | ${item.role} | https://www.zhipin.com/ | \`${item.query}\` |`;
});
const md = `# BOSS全行业AI销售岗位查询计划

更新时间：${formatDateTime()}

## 一、本质判断

这份计划不是报告正文，而是 BOSS 平台全行业采集的作业清单。它把 AI 软件落地、大模型公司、云平台、芯片/半导体、工业AI、智能客服、AI安全等公司和赛道，拆成可逐批执行的 BOSS 站内搜索关键词。

## 二、计划规模

| 类型 | 搜索数 |
| --- | ---: |
| 公司定向搜索 | ${byKind.company || 0} |
| 赛道关键词搜索 | ${byKind.industry || 0} |
| 合计 | ${plan.length} |

批次大小：${args.batchSize}

预计批次数：${Math.ceil(plan.length / args.batchSize)}

## 三、前40条优先查询

| 序号 | 批次 | 类型 | 赛道 | 目标 | 岗位词 | BOSS首页 | 站内搜索关键词 |
| ---: | ---: | --- | --- | --- | --- | --- | --- |
${firstRows.join("\n")}

## 四、运行方式

当前处于 BOSS 风控恢复期。优先手动浏览并导入岗位文本：

\`\`\`bash
npm run import:manual -- --source BOSS直聘 --query "智谱AI AI销售" --company 智谱AI --role AI销售 --city ${args.city}
npm run summary:jobs
npm run report:full
\`\`\`

确认手动验证完成并且页面稳定后，才执行极低频自动采集：

\`\`\`bash
npm run overnight:research -- --city ${args.city} --max-batches ${rateLimitConfig.boss?.overnightMaxBatches ?? 8} --batch-size ${args.batchSize} --cards-per-search ${rateLimitConfig.boss?.maxCardsPerSearch ?? 2} --detail-limit ${rateLimitConfig.boss?.maxDetailPagesPerRun ?? 0} --delay-ms ${rateLimitConfig.boss?.minRequestIntervalMs ?? 600000} --cooldown-ms ${rateLimitConfig.boss?.overnightCooldownMs ?? 1800000} --jitter-ms ${rateLimitConfig.boss?.defaultJitterMs ?? 180000} --resume-after-risk
npm run summary:jobs
npm run report:full
\`\`\`

完整 CSV：

\`\`\`text
${outputCsvPath}
\`\`\`
`;
writeFileSync(outputMdPath, md);

console.log(`已生成：${outputCsvPath}`);
console.log(`已生成：${outputMdPath}`);
console.log(`查询数：${plan.length}`);
