#!/usr/bin/env node

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const jobsPath = join(projectRoot, "01_行情收集/data/jobs.jsonl");
const analyzeScriptPath = join(projectRoot, "06_自动化采集/scripts/analyze_market.mjs");
const opportunityReportPath = join(projectRoot, "01_行情收集/AI岗位机会汇总.md");
const positioningReportPath = join(projectRoot, "02_岗位画像/AI岗位定位与要求汇总.md");

const requirementTaxonomy = [
  { key: "AI/大模型产品理解", aliases: ["大模型", "AI", "人工智能", "AIGC", "智能体", "Agent", "RAG", "知识库"] },
  { key: "ToB/企业服务销售", aliases: ["ToB", "B2B", "企业服务", "SaaS", "软件销售", "企业软件"] },
  { key: "大客户/KA客户开发", aliases: ["大客户", "KA", "关键客户", "客户开发", "客户开拓", "行业客户"] },
  { key: "解决方案设计与表达", aliases: ["解决方案", "方案设计", "方案撰写", "行业方案", "咨询方案"] },
  { key: "售前演示/POC推进", aliases: ["售前", "演示", "Demo", "POC", "技术交流", "需求调研"] },
  { key: "商机管理与销售漏斗", aliases: ["商机", "线索", "销售漏斗", "转化", "CRM", "回款", "签约"] },
  { key: "行业理解", aliases: ["金融", "政企", "制造", "教育", "医疗", "零售", "汽车", "互联网", "行业"] },
  { key: "招投标/述标能力", aliases: ["招投标", "投标", "标书", "述标", "控标"] },
  { key: "交付/客户成功协同", aliases: ["交付", "实施", "客户成功", "上线", "续费", "项目管理"] },
  { key: "技术基础/API/私有化", aliases: ["API", "接口", "私有化", "云服务", "模型", "技术方案", "部署"] }
];

function usage() {
  return `Usage:
  npm run summary:jobs

Outputs:
  01_行情收集/AI岗位机会汇总.md
  02_岗位画像/AI岗位定位与要求汇总.md
  01_行情收集/市场能力需求看板.md
  02_岗位画像/AI互联网销售售前岗位画像.md
  03_简历/简历更新建议.md
`;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === "--help" || key === "-h") args.help = true;
    else throw new Error(`Unknown option: ${key}`);
  }
  return args;
}

async function readJobs() {
  if (!existsSync(jobsPath)) return [];
  const text = await readFile(jobsPath, "utf8");
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function textOf(job) {
  return [
    job.title,
    job.company,
    job.salary,
    job.location,
    job.tags?.join(" "),
    job.rawText,
    job.detailText
  ].filter(Boolean).join("\n");
}

function includesAny(text, aliases) {
  const lower = text.toLowerCase();
  return aliases.some((alias) => lower.includes(alias.toLowerCase()));
}

function countBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item) || "未分类";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function topByRequirements(jobs) {
  return requirementTaxonomy
    .map((requirement) => {
      const matched = jobs.filter((job) => includesAny(textOf(job), requirement.aliases));
      return {
        ...requirement,
        count: matched.length,
        examples: matched.slice(0, 3).map((job) => job.title || job.query).filter(Boolean)
      };
    })
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);
}

function inferPositioning(job) {
  const text = textOf(job);
  if (/售前|解决方案|POC|Demo|演示|技术交流/.test(text)) return "售前/解决方案";
  if (/客户成功|交付|实施|上线|续费/.test(text)) return "客户成功/交付";
  if (/大客户|KA|行业客户|客户开发|销售/.test(text)) return "销售/商务拓展";
  return job.roleFamily || "未分类";
}

function markdownRows(rows, empty) {
  return rows.length ? rows.join("\n") : empty;
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

function safeSourceCell(job) {
  const url = String(job.url || job.searchUrl || "");
  const keyword = [job.company, job.title]
    .map((value) => String(value || "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" ")
    .slice(0, 80);
  if (/zhipin\.com/i.test(url)) return `BOSS首页站内复核：\`${keyword || "公司 岗位"}\``;
  return url || "-";
}

async function runAnalyzeMarket() {
  return new Promise((resolvePromise, rejectPromise) => {
    execFile(process.execPath, [analyzeScriptPath], { cwd: projectRoot }, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        rejectPromise(error);
        return;
      }
      resolvePromise({ stdout, stderr });
    });
  });
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(usage());
    return;
  }

  const jobs = await readJobs();
  const now = formatDate();
  const byQueryKind = countBy(jobs, (job) => job.queryKind || "手动导入");
  const byPositioning = countBy(jobs, inferPositioning);
  const byCompany = countBy(jobs.filter((job) => job.company), (job) => job.company).slice(0, 20);
  const byQuery = countBy(jobs, (job) => job.query).slice(0, 20);
  const requirements = topByRequirements(jobs);
  const latestJobs = [...jobs]
    .sort((a, b) => String(b.collectedAt).localeCompare(String(a.collectedAt)))
    .slice(0, 30);

  const opportunityReport = `# AI岗位机会汇总

更新时间：${now}

## 一、本质判断

这份报告不是岗位列表，而是市场机会地图：从公司、行业、关键词和岗位名称里判断 AI/互联网相关销售、售前、解决方案机会集中在哪里。

当前样本数：${jobs.length}

${jobs.length < 20 ? "> 样本仍偏少。建议先积累 20 到 30 条高相关岗位，再做稳定判断。\n" : ""}

## 二、采集入口分布

| 入口类型 | 样本数 |
| --- | ---: |
${markdownRows(byQueryKind.map(([key, count]) => `| ${key} | ${count} |`), "| 暂无数据 | 0 |")}

## 三、岗位定位分布

| 岗位定位 | 样本数 |
| --- | ---: |
${markdownRows(byPositioning.map(([key, count]) => `| ${key} | ${count} |`), "| 暂无数据 | 0 |")}

## 四、高频公司

| 公司 | 样本数 |
| --- | ---: |
${markdownRows(byCompany.map(([key, count]) => `| ${key} | ${count} |`), "| 暂无公司信息 | 0 |")}

## 五、高频搜索线索

| 搜索线索 | 样本数 |
| --- | ---: |
${markdownRows(byQuery.map(([key, count]) => `| ${key || "未标注"} | ${count} |`), "| 暂无搜索线索 | 0 |")}

## 六、最新岗位样本

| 时间 | 岗位 | 公司 | 薪资 | 城市 | 来源 | 复核方式 |
| --- | --- | --- | --- | --- | --- | --- |
${markdownRows(latestJobs.map((job) => `| ${job.collectedAt ? formatDate(job.collectedAt) : ""} | ${job.title || ""} | ${job.company || ""} | ${job.salary || ""} | ${job.location || job.city || ""} | ${job.source || ""} | ${safeSourceCell(job)} |`), "| 暂无岗位 |  |  |  |  |  |  |")}
`;

  const positioningReport = `# AI岗位定位与要求汇总

更新时间：${now}

## 一、本质判断

AI领域相关销售/售前岗位，本质上不是传统泛销售，而是“懂产品价值、懂行业场景、能推进客户决策、能协同售前或交付落地”的复合型商业岗位。

## 二、高频能力要求

| 排名 | 能力要求 | 出现次数 | 典型岗位 |
| ---: | --- | ---: | --- |
${markdownRows(requirements.map((item, index) => `| ${index + 1} | ${item.key} | ${item.count} | ${item.examples.join("；")} |`), "| - | 暂无数据 | 0 | - |")}

## 三、岗位定位判断

销售岗更看重：

- 客户开发、商机推进、行业客户资源、销售结果。
- AI/大模型产品理解能否转化为客户价值表达。
- 是否具备企业服务、SaaS、软件或解决方案销售经验。

售前/解决方案岗更看重：

- 需求调研、方案设计、演示、POC、投标/述标。
- 能否把 AI 能力翻译成行业场景和业务收益。
- 能否和销售、产品、交付团队协同推进项目。

客户成功/交付相关岗位更看重：

- 项目推进、上线落地、客户培训、续费扩展。
- 是否能把客户需求反馈到产品和方案迭代中。

## 四、简历反向要求

你的简历需要能证明三类事：

1. 你理解 AI/企业服务产品，不只是会说概念。
2. 你能找到客户业务问题，并把问题转成方案和商机。
3. 你有推进结果的证据，包括客户、项目、金额、转化、回款、上线或续费。

## 五、下一轮采集建议

- 如果要找头部公司机会，用公司名 + AI销售/AI售前/解决方案顾问组合搜索。
- 如果要找细分赛道机会，用赛道词 + 销售/售前组合搜索，例如智能客服、企业知识库、AI Agent、数据智能。
- 如果要判断高薪门槛，单独采集薪资更高的岗位，并把要求与普通岗位分开比较。
`;

  await mkdir(dirname(opportunityReportPath), { recursive: true });
  await mkdir(dirname(positioningReportPath), { recursive: true });
  await writeFile(opportunityReportPath, opportunityReport);
  await writeFile(positioningReportPath, positioningReport);
  await runAnalyzeMarket();

  console.log(`样本数量：${jobs.length}`);
  console.log(`已更新：${opportunityReportPath}`);
  console.log(`已更新：${positioningReportPath}`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
