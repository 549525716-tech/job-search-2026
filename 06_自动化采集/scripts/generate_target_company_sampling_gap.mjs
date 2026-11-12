#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const segmentPath = join(projectRoot, "06_自动化采集/config/ai_company_segments.csv");
const jobsPath = join(projectRoot, "01_行情收集/data/jobs.jsonl");
const sampleGapPath = join(projectRoot, "01_行情收集/BOSS全行业样本缺口路线图.csv");
const companyTypePath = join(projectRoot, "00_行业资料集/AI销售公司类型岗位打法对照表.csv");
const outputMdPath = join(projectRoot, "01_行情收集/BOSS目标公司采样缺口看板.md");
const outputCsvPath = join(projectRoot, "01_行情收集/BOSS目标公司采样缺口看板.csv");
const safeBossHomeUrl = "https://www.zhipin.com/";

const focusCompanies = new Set([
  "月之暗面",
  "智谱AI",
  "MiniMax",
  "DeepSeek",
  "阶跃星辰",
  "百川智能",
  "商汤科技",
  "寒武纪",
  "海光信息",
  "华为昇腾",
  "摩尔线程",
  "壁仞科技",
  "燧原科技",
  "沐曦集成电路",
  "浪潮信息",
  "新华三",
  "超聚变",
  "中科曙光",
  "华鲲振宇",
  "百度智能云",
  "阿里云",
  "腾讯云",
  "火山引擎",
  "华为云",
  "科大讯飞"
]);

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

function readJobs() {
  if (!existsSync(jobsPath)) return [];
  return readFileSync(jobsPath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
}

function isBossJob(job) {
  return !job.source || job.source === "BOSS直聘";
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

function numberOf(value) {
  const num = Number.parseFloat(String(value || "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(num) ? num : 0;
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[（）()【】\[\]{}·\s\-_.,，。/\\|]/g, "");
}

function companyAliases(company) {
  const aliases = new Set([company]);
  if (/智能云$/.test(company)) aliases.add(company.replace(/智能云$/, ""));
  if (/云$/.test(company)) aliases.add(company.replace(/云$/, ""));
  if (/科技$/.test(company)) aliases.add(company.replace(/科技$/, ""));
  if (/信息$/.test(company)) aliases.add(company.replace(/信息$/, ""));
  if (company === "智谱AI") aliases.add("智谱");
  if (company === "月之暗面") aliases.add("Kimi");
  if (company === "MiniMax") aliases.add("稀宇");
  if (company === "华为昇腾") aliases.add("昇腾");
  if (company === "新华三") aliases.add("H3C");
  return [...aliases].filter(Boolean);
}

function companyMatches(job, company) {
  const text = normalize([job.companyFilter, job.company, job.query, job.rawText].filter(Boolean).join("\n"));
  return companyAliases(company).some((alias) => {
    const needle = normalize(alias);
    return needle.length >= 2 && text.includes(needle);
  });
}

function salaryReadable(job) {
  const text = [job.salary, job.rawText, job.detailText].filter(Boolean).join("\n");
  if (/薪资范围[:：]?\s*\d+\s*[-~－—到]\s*\d+\s*元\/?月/i.test(text)) return true;
  const hasPrivateFont = /[\uE000-\uF8FF]/.test(String(job.salary || ""));
  return !hasPrivateFont && /\d+(?:\.\d+)?\s*[-~－—到]\s*\d+(?:\.\d+)?\s*K/i.test(String(job.salary || ""));
}

function roleFamily(text) {
  if (/销售总监|销售负责人|区域经理|销售经理|主管|leader/i.test(text)) return "销售管理";
  if (/售前|解决方案|POC|Demo|演示|技术交流|顾问/i.test(text)) return "售前/解决方案";
  if (/渠道|生态|伙伴|代理商/i.test(text)) return "渠道/生态";
  if (/大客户|KA|行业客户|客户经理|销售|商务|BD/i.test(text)) return "销售/商务";
  return "未分类";
}

function roleTermsFor(row) {
  const segment = row.segment || "";
  const fit = row.sales_fit || "";
  if (/芯片|GPU|加速卡|半导体/.test(segment)) return ["大客户销售", "渠道销售", "行业销售", "销售经理", "解决方案顾问"];
  if (/服务器|智算|数据中心|IDC/.test(segment)) return ["大客户销售", "行业销售", "售前", "渠道销售", "解决方案顾问"];
  if (/基座大模型|Agent平台/.test(segment)) return ["AI销售", "大模型销售", "解决方案顾问", "生态合作", "销售经理"];
  if (/云计算|大模型平台/.test(segment)) return ["AI销售", "大客户销售", "解决方案顾问", "售前", "渠道销售"];
  if (/客服|营销|销售AI/.test(segment)) return ["SaaS销售", "AI销售", "销售经理", "大客户销售", "售前"];
  if (/工业|制造|视觉|安防|质检/.test(segment)) return ["大客户销售", "销售经理", "行业销售", "解决方案顾问", "售前"];
  if (/汽车|机器人|具身/.test(segment)) return ["渠道销售", "销售经理", "大客户销售", "海外销售", "行业销售"];
  if (/安全|私有化|信创/.test(segment)) return ["大客户销售", "政企销售", "渠道销售", "销售经理", "售前"];
  if (/渠道|生态|伙伴/.test(fit)) return ["渠道销售", "大客户销售", "销售经理", "售前", "AI销售"];
  return ["AI销售", "大客户销售", "销售经理", "售前", "解决方案顾问"];
}

function routeFor(row, sampleRows, companyTypeRows) {
  return sampleRows.find((item) => item.segment === row.segment)?.route ||
    companyTypeRows.find((item) => item.segment === row.segment)?.route ||
    (/芯片|服务器|智算|数据中心/.test(row.segment || "") ? "硬件/算力/半导体路线" : "AI软件落地路线");
}

function companyTypeFor(row, companyTypeRows) {
  return companyTypeRows.find((item) => item.segment === row.segment)?.companyType || "";
}

function targetSamples(row) {
  if (focusCompanies.has(row.company)) return 3;
  const priority = numberOf(row.priority);
  if (priority <= 1) return 3;
  if (priority === 2) return 2;
  return 1;
}

function priorityLabel(row, gap, currentSamples) {
  const priority = numberOf(row.priority);
  if (gap <= 0) return "已达公司最小样本";
  if (focusCompanies.has(row.company) || priority <= 1) return currentSamples ? "P0 继续补齐" : "P0 首轮必看";
  if (priority === 2) return currentSamples ? "P1 补强" : "P1 首轮看";
  return "P2 扩展观察";
}

function searchUrl(company, role, city = "广州") {
  const query = encodeURIComponent(`${company} ${role}`);
  return `https://www.zhipin.com/web/geek/jobs?query=${query}&city=101280100`;
}

function shellQuote(value) {
  return `"${String(value || "").replaceAll('"', '\\"')}"`;
}

function importCommand(company, role, city = "广州") {
  return [
    "npm run import:manual --",
    "--source",
    shellQuote("BOSS直聘"),
    "--query",
    shellQuote(`${company} ${role}`),
    "--company",
    shellQuote(company),
    "--role",
    shellQuote(role),
    "--city",
    shellQuote(city)
  ].join(" ");
}

function pickNextRole(roles, jobs) {
  const sampledFamilies = new Set(jobs.map((job) => roleFamily([job.title, job.role, job.roleFamily, job.rawText].join("\n"))));
  for (const role of roles) {
    if (!sampledFamilies.has(roleFamily(role))) return role;
  }
  return roles[0] || "AI销售";
}

function coverageStatus(gap, currentSamples, readableSalarySamples, detailSamples) {
  if (gap <= 0 && readableSalarySamples >= 1 && detailSamples >= 1) return "公司最小样本可用";
  if (currentSamples > 0) return "有样本但证据不足";
  return "未采到BOSS样本";
}

function mdRows(rows, fallback) {
  return rows.length ? rows.join("\n") : fallback;
}

const segmentRows = readCsv(segmentPath);
const allJobs = readJobs();
const jobs = allJobs.filter(isBossJob);
const sampleRows = readCsv(sampleGapPath);
const companyTypeRows = readCsv(companyTypePath);

const companyRows = segmentRows.map((row) => {
  const matchedJobs = jobs.filter((job) => companyMatches(job, row.company));
  const roles = roleTermsFor(row);
  const nextRole = pickNextRole(roles, matchedJobs);
  const segmentSample = sampleRows.find((item) => item.segment === row.segment) || {};
  const target = targetSamples(row);
  const currentSamples = matchedJobs.length;
  const readableSalarySamples = matchedJobs.filter(salaryReadable).length;
  const detailSamples = matchedJobs.filter((job) => String(job.detailText || "").length >= 300).length;
  const gap = Math.max(0, target - currentSamples);
  const sampledRoleFamilies = [...new Set(matchedJobs.map((job) => roleFamily([job.title, job.role, job.roleFamily, job.rawText].join("\n"))))].filter((item) => item !== "未分类");

  return {
    priority: priorityLabel(row, gap, currentSamples),
    route: routeFor(row, sampleRows, companyTypeRows),
    segment: row.segment,
    layer: row.layer,
    company: row.company,
    focusCompany: focusCompanies.has(row.company) ? "是" : "否",
    companyType: companyTypeFor(row, companyTypeRows),
    keywords: row.keywords,
    salesFit: row.sales_fit,
    recommendedRoles: roles.join(";"),
    nextRole,
    salaryBand: segmentSample.salaryBand || "待BOSS样本校验",
    targetSamples: target,
    currentSamples,
    sampleGap: gap,
    readableSalarySamples,
    detailSamples,
    sampledRoleFamilies: sampledRoleFamilies.join(";"),
    coverageStatus: coverageStatus(gap, currentSamples, readableSalarySamples, detailSamples),
    safeBossHomeUrl,
    searchKeyword: `${row.company} ${nextRole}`.trim(),
    searchUrl: searchUrl(row.company, nextRole),
    importCommand: importCommand(row.company, nextRole),
    acceptanceGate: "只导入销售、售前、解决方案、渠道、销售管理相关岗位；正文必须体现AI/算力/硬件/行业场景；薪资、经验、学历、职责、要求尽量完整",
    nextAction: gap > 0 ? `打开BOSS首页，站内搜索 ${row.company} ${nextRole}，补 ${gap} 条高相关样本` : "保持观察，优先补薪资/详情不足项"
  };
}).sort((a, b) => {
  const priorityRank = (value) => /P0/.test(value) ? 3 : /P1/.test(value) ? 2 : /P2/.test(value) ? 1 : 0;
  return priorityRank(b.priority) - priorityRank(a.priority) ||
    b.sampleGap - a.sampleGap ||
    a.segment.localeCompare(b.segment, "zh-Hans-CN") ||
    a.company.localeCompare(b.company, "zh-Hans-CN");
});

const headers = [
  "priority",
  "route",
  "segment",
  "layer",
  "company",
  "focusCompany",
  "companyType",
  "keywords",
  "salesFit",
  "recommendedRoles",
  "nextRole",
  "salaryBand",
  "targetSamples",
  "currentSamples",
  "sampleGap",
  "readableSalarySamples",
  "detailSamples",
  "sampledRoleFamilies",
  "coverageStatus",
  "safeBossHomeUrl",
  "searchKeyword",
  "searchUrl",
  "importCommand",
  "acceptanceGate",
  "nextAction"
];

const focusRows = companyRows
  .filter((row) => row.focusCompany === "是")
  .slice(0, 30)
  .map((row) => `| ${row.priority} | ${row.route} | ${row.segment} | ${row.company} | ${row.currentSamples}/${row.targetSamples} | ${row.readableSalarySamples} | ${row.detailSamples} | ${row.nextRole} | ${row.salaryBand} | ${row.safeBossHomeUrl} | \`${row.searchKeyword}\` | ${row.nextAction} |`);

const p0Rows = companyRows
  .filter((row) => /P0/.test(row.priority))
  .slice(0, 40)
  .map((row) => `| ${row.priority} | ${row.segment} | ${row.company} | ${row.companyType || "-"} | ${row.currentSamples}/${row.targetSamples} | ${row.sampleGap} | ${row.recommendedRoles.replaceAll(";", "、")} | ${row.nextRole} | ${row.salaryBand} | ${row.safeBossHomeUrl} | \`${row.searchKeyword}\` |`);

const routeRows = [...new Map(companyRows.map((row) => [row.route, row.route])).keys()].map((route) => {
  const rows = companyRows.filter((row) => row.route === route);
  return `| ${route} | ${rows.length} | ${rows.filter((row) => row.currentSamples > 0).length} | ${rows.reduce((sum, row) => sum + row.sampleGap, 0)} | ${rows.filter((row) => /P0/.test(row.priority)).length} |`;
});

const totalCompanies = companyRows.length;
const coveredCompanies = companyRows.filter((row) => row.currentSamples > 0).length;
const totalCompanyGap = companyRows.reduce((sum, row) => sum + row.sampleGap, 0);
const p0CompanyCount = companyRows.filter((row) => /P0/.test(row.priority)).length;
const focusGap = companyRows.filter((row) => row.focusCompany === "是").reduce((sum, row) => sum + row.sampleGap, 0);

mkdirSync(dirname(outputMdPath), { recursive: true });
writeFileSync(outputCsvPath, `${csv([headers, ...companyRows.map((row) => headers.map((header) => row[header]))])}\n`);

const md = `# BOSS目标公司采样缺口看板

更新时间：${formatDate()}

## 一、本质判断

这份看板不是再列一遍 AI 公司名单，而是把“大而全的 AI 销售岗位调研”落到公司级执行。赛道结论最终要靠公司和岗位样本支撑：每家公司至少要有销售、售前/解决方案、销售管理或渠道中的代表性样本，才能判断它到底卖什么、怎么卖、薪资如何、能力门槛是什么。

当前最大的矛盾是：公司池已经覆盖 ${totalCompanies} 家，但真正有 BOSS 干净样本的公司只有 ${coveredCompanies} 家；如果不按公司补样，结论会停在赛道假设，无法回答“月之暗面、智谱AI、MiniMax、寒武纪、超聚变这类公司到底在招什么销售岗”。

## 二、总体状态

| 指标 | 当前值 |
| --- | ---: |
| 目标公司总数 | ${totalCompanies} |
| 已有BOSS样本公司 | ${coveredCompanies} |
| 公司级最小样本缺口 | ${totalCompanyGap} |
| P0公司任务数 | ${p0CompanyCount} |
| 点名/重点公司缺口 | ${focusGap} |

## 三、路线级缺口

| 路线 | 公司数 | 已采公司 | 公司级缺口 | P0任务 |
| --- | ---: | ---: | ---: | ---: |
${mdRows(routeRows, "| 暂无 | 0 | 0 | 0 | 0 |")}

## 四、点名/重点公司

| 优先级 | 路线 | 赛道 | 公司 | 当前/目标 | 可读薪资 | 详情样本 | 下一岗位词 | 薪资观察 | BOSS首页 | 站内搜索关键词 | 下一动作 |
| --- | --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- | --- |
${mdRows(focusRows, "| 暂无 |  |  |  | 0/0 | 0 | 0 |  |  |  |  |  |")}

## 五、P0公司优先补样队列

| 优先级 | 赛道 | 公司 | 公司类型 | 当前/目标 | 缺口 | 推荐岗位词 | 下一岗位词 | 薪资观察 | BOSS首页 | 站内搜索关键词 |
| --- | --- | --- | --- | ---: | ---: | --- | --- | --- | --- | --- |
${mdRows(p0Rows, "| 暂无 |  |  |  | 0/0 | 0 |  |  |  |  |  |")}

## 六、使用方式

1. 先从“点名/重点公司”和“P0公司优先补样队列”里选一家公司。
2. 执行 \`npm run auth:boss\`，先只进入 BOSS 首页；页面稳定后在站内搜索框输入公司名 + 推荐岗位词。
3. 找到销售、售前、解决方案、渠道或销售管理岗位后复制详情文本。
4. 使用 CSV 中的 \`importCommand\` 导入样本。
5. 每导入 10 到 20 条后运行：

\`\`\`bash
npm run sampling:companies
npm run sampling:quality
npm run sampling:gap
npm run brief:market
npm run report:full
npm run audit:research
\`\`\`

## 七、CSV输出

\`\`\`text
${outputCsvPath}
\`\`\`
`;

writeFileSync(outputMdPath, md);

console.log(`已生成：${outputMdPath}`);
console.log(`已生成：${outputCsvPath}`);
console.log(`目标公司总数：${totalCompanies}`);
console.log(`已有BOSS样本公司：${coveredCompanies}`);
console.log(`公司级最小样本缺口：${totalCompanyGap}`);
