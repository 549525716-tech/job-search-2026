#!/usr/bin/env node

import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { legacyPublicSourceReviewHandoff } from "./auth_transport_policy.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const configPath = join(projectRoot, "06_自动化采集/config/pulse_aisepulse_companies.csv");
const rateLimitConfigPath = join(projectRoot, "06_自动化采集/config/rate_limits.json");
const jobsPath = join(projectRoot, "01_行情收集/data/jobs.jsonl");
const rawDir = join(projectRoot, "01_行情收集/data/raw");
const processedDir = join(projectRoot, "01_行情收集/data/processed");
const outputMdPath = join(projectRoot, "01_行情收集/Pulse岗位信息采集报告.md");
const outputCsvPath = join(projectRoot, "01_行情收集/Pulse岗位信息采集报告.csv");

const sourceName = "AISE Pulse";
const sourceBaseUrl = "https://aisepulse.com";

function usage() {
  return `Usage:
  npm run collect:pulse -- --limit 4
  npm run collect:pulse -- --companies anthropic,openai,databricks,salesforce
  npm run collect:pulse -- --limit 4 --delay-ms 15000 --jitter-ms 10000
  npm run collect:pulse -- --include-existing --companies openai
  npm run collect:pulse -- --dry-run

Purpose:
  Collect public AI Sales Engineer company profiles from AISE Pulse at a low frequency.
  This does not log in, submit forms, message employers, or open BOSS/Pulse browser tabs.
`;
}

function parseArgs(argv) {
  const args = {
    limit: 4,
    delayMs: null,
    jitterMs: null,
    includeExisting: false,
    dryRun: false
  };
  for (let index = 2; index < argv.length; index += 1) {
    const key = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${key}`);
      return argv[index];
    };
    if (key === "--limit") args.limit = Number.parseInt(next(), 10);
    else if (key === "--companies") args.companies = splitList(next());
    else if (key === "--delay-ms") args.delayMs = Number.parseInt(next(), 10);
    else if (key === "--jitter-ms") args.jitterMs = Number.parseInt(next(), 10);
    else if (key === "--include-existing") args.includeExisting = true;
    else if (key === "--dry-run") args.dryRun = true;
    else if (key === "--help" || key === "-h") args.help = true;
    else throw new Error(`Unknown option: ${key}`);
  }
  return args;
}

function splitList(value) {
  return String(value || "")
    .split(/[,\n，]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

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

function readCompanyConfig() {
  const text = readFileSync(configPath, "utf8");
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  const headers = parseCsvLine(lines.shift());
  return lines.map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
  });
}

function readOptionalJson(path, fallback = {}) {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function randomInt(max) {
  const value = Number.isFinite(max) && max > 0 ? max : 0;
  return value ? Math.floor(Math.random() * value) : 0;
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
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

function decodeHtml(value) {
  return String(value || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(value) {
  return decodeHtml(String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>|<\/li>|<\/h\d>/gi, "\n")
    .replace(/<[^>]+>/g, " "));
}

function metaContent(html, name) {
  const match = html.match(new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, "i"));
  return decodeHtml(match?.[1] || "");
}

function firstMatch(html, regex) {
  const match = html.match(regex);
  return stripTags(match?.[1] || "");
}

function sectionHtmlByHeading(html, headingPattern) {
  const sections = [...html.matchAll(/<section\b[\s\S]*?<\/section>/gi)].map((match) => match[0]);
  return sections.find((section) => headingPattern.test(stripTags(section))) || "";
}

function paragraphsInSection(sectionHtml) {
  return [...sectionHtml.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean);
}

function listItemsInSection(sectionHtml) {
  return [...sectionHtml.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean);
}

function companyStats(html) {
  const stats = {};
  const regex = /<div class="company-stat__value[^"]*">([\s\S]*?)<\/div>\s*<div class="company-stat__label">([\s\S]*?)<\/div>/gi;
  for (const match of html.matchAll(regex)) {
    const value = stripTags(match[1]);
    const label = stripTags(match[2]);
    if (label) stats[label] = value;
  }
  return stats;
}

function extractLocation(workModel) {
  const text = String(workModel || "");
  const paren = text.match(/\(([^)]+)\)/);
  if (paren) return paren[1];
  if (/remote/i.test(text)) return "Remote";
  return "";
}

function inferRoleFamily(text) {
  if (/Sales Engineer|pre-sales|solution|demo|proof-of-concept|POC|technical evaluation/i.test(text)) return "售前/解决方案";
  if (/account|enterprise customer|deal|sales/i.test(text)) return "销售/商务";
  return "未分类";
}

function recordId(record) {
  return createHash("sha256")
    .update([record.source, record.url, record.title, record.company, record.query, record.rawText].filter(Boolean).join("\n"))
    .digest("hex")
    .slice(0, 12);
}

function existingIds() {
  if (!existsSync(jobsPath)) return new Set();
  return new Set(readFileSync(jobsPath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line).id;
      } catch {
        return "";
      }
    })
    .filter(Boolean));
}

function rawFileName(id) {
  return `${stamp()}_${id}_AISE_Pulse.txt`;
}

async function fetchHtml(url, timeoutMs = 25_000) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "career-market-research/1.0 low-frequency public pages",
      "accept": "text/html,application/xhtml+xml"
    },
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText} for ${url}`);
  return response.text();
}

function parseCompanyProfile(html, config) {
  const stats = companyStats(html);
  const aiProductsSection = sectionHtmlByHeading(html, /AI Products and Platform/i);
  const roleSection = sectionHtmlByHeading(html, /Role Looks Like|What the AI Sales Engineer/i);
  const technicalSection = sectionHtmlByHeading(html, /Technical Skills and Requirements/i);
  const interviewSection = sectionHtmlByHeading(html, /Interview Process/i);
  const salarySection = sectionHtmlByHeading(html, /Salary and Compensation/i);

  const company = config.company || firstMatch(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i).replace(/\s+AI Sales Engineer.+$/i, "");
  const category = firstMatch(html, /<span class="company-hero__badge">([\s\S]*?)<\/span>/i) || config.category;
  const title = `${company} AI Sales Engineer`;
  const salary = stats["On-Target Earnings"] || firstMatch(salarySection, /<div class="salary-highlight"[^>]*>([\s\S]*?)<\/div>/i);
  const workModel = stats["Work Model"] || "";
  const teamSize = stats["Estimated SE Team Size"] || "";
  const products = paragraphsInSection(aiProductsSection).join(" ");
  const roleDetails = paragraphsInSection(roleSection).join(" ");
  const technicalRequirements = listItemsInSection(technicalSection);
  const interviewProcess = paragraphsInSection(interviewSection).join(" ");
  const compensation = paragraphsInSection(salarySection).join(" ");
  const description = firstMatch(html, /<p class="company-hero__subtitle">([\s\S]*?)<\/p>/i) || metaContent(html, "description");
  const url = `${sourceBaseUrl}/companies/${config.slug}/`;
  const rawText = [
    title,
    `Company: ${company}`,
    `Category: ${category}`,
    `OTE: ${salary}`,
    `Work model: ${workModel}`,
    `Estimated SE team size: ${teamSize}`,
    "",
    "Company positioning",
    description,
    "",
    "AI products and platform",
    products,
    "",
    "Role details",
    roleDetails,
    "",
    "Technical skills and requirements",
    technicalRequirements.map((item) => `- ${item}`).join("\n"),
    "",
    "Interview process",
    interviewProcess,
    "",
    "Salary and compensation",
    compensation,
    "",
    `Source URL: ${url}`
  ].join("\n").replace(/\n{3,}/g, "\n\n").trim();

  const baseRecord = {
    collectedAt: new Date().toISOString(),
    source: sourceName,
    sourceMode: "public_company_profile_low_frequency",
    query: `${company} AI Sales Engineer`,
    queryKind: "pulse_company_profile",
    group: "AI Sales Engineer",
    companyFilter: company,
    industryFilter: config.segment,
    role: "AI Sales Engineer",
    roleFamily: inferRoleFamily(rawText),
    route: config.route,
    segment: config.segment,
    priority: config.priority,
    city: extractLocation(workModel) || "US/Global",
    title,
    company,
    salary,
    location: workModel,
    tags: [category, config.segment, "AI Sales Engineer"].filter(Boolean),
    url,
    searchUrl: `${sourceBaseUrl}/companies/`,
    pulseCategory: category,
    pulseWorkModel: workModel,
    pulseTeamSize: teamSize,
    pulseProducts: products,
    pulseRoleDetails: roleDetails,
    pulseTechnicalRequirements: technicalRequirements,
    pulseInterviewProcess: interviewProcess,
    pulseCompensation: compensation,
    rawText
  };
  return {
    id: recordId(baseRecord),
    ...baseRecord
  };
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function writePulseReport(records) {
  const rows = records
    .filter((record) => record.source === sourceName)
    .sort((a, b) => String(b.collectedAt).localeCompare(String(a.collectedAt)));
  const updatedAt = formatDate();
  const markdownRows = rows.length
    ? rows.map((row, index) => `| ${index + 1} | ${row.company || ""} | ${row.pulseCategory || ""} | ${row.salary || ""} | ${row.pulseWorkModel || ""} | ${row.pulseTeamSize || ""} | ${row.segment || ""} | ${(row.pulseTechnicalRequirements || []).slice(0, 3).join("; ")} | [来源](${row.url}) |`).join("\n")
    : "| - | 暂无 |  |  |  |  |  |  |  |";

  const md = `# Pulse岗位信息采集报告

更新时间：${updatedAt}

## 一、本质判断

这份报告不是 BOSS 大样本结论，而是把 AISE Pulse 公开的 AI Sales Engineer 公司画像转成可复用岗位情报。它适合用来补充“AI售前/解决方案/技术销售”的薪资、职责和能力要求判断。

当前 Pulse 样本数：${rows.length}

## 二、采集边界

- 来源：AISE Pulse 公开公司画像页。
- 方式：低频串行读取公开页面，不登录、不投递、不发送消息。
- 用途：岗位能力、薪资区间、公司类型和简历 Gap 参考。
- 结论边界：不能替代 BOSS/猎聘等招聘平台的实时岗位大样本。

## 三、Pulse岗位样本

| 序号 | 公司 | 公司类型 | OTE薪资 | 工作模式 | SE团队规模 | 归属赛道 | 高频技术要求 | 来源 |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- |
${markdownRows}

## 四、对你的简历含义

Pulse 样本反复强调的不是泛销售，而是技术型售前销售：API 集成、Demo/POC、模型评估、云平台/数据平台、客户业务场景和高管/技术团队沟通。你的汽车行业客户经营和销售管理是可迁移资产，但仍需要补 AI 产品 Demo、POC 和企业技术采购链证据。
`;

  const csvRows = [
    ["collectedAt", "company", "category", "salary", "workModel", "teamSize", "route", "segment", "roleFamily", "technicalRequirements", "url"],
    ...rows.map((row) => [
      row.collectedAt,
      row.company,
      row.pulseCategory,
      row.salary,
      row.pulseWorkModel,
      row.pulseTeamSize,
      row.route,
      row.segment,
      row.roleFamily,
      (row.pulseTechnicalRequirements || []).join("; "),
      row.url
    ])
  ];

  writeFileSync(outputMdPath, md);
  writeFileSync(outputCsvPath, csvRows.map((row) => row.map(csvEscape).join(",")).join("\n"));
}

function readAllJobs() {
  if (!existsSync(jobsPath)) return [];
  return readFileSync(jobsPath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function existingPulseCompanies() {
  return new Set(readAllJobs()
    .filter((job) => job.source === sourceName)
    .map((job) => String(job.company || job.companyFilter || "").trim().toLowerCase())
    .filter(Boolean));
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(usage());
    return;
  }
  if (!args.dryRun) {
    console.log(JSON.stringify(legacyPublicSourceReviewHandoff({
      command: "collect:pulse",
      source: sourceName
    })));
    process.exitCode = 2;
    return;
  }

  const rateLimitConfig = readOptionalJson(rateLimitConfigPath, {});
  const pulseLimits = rateLimitConfig.pulse || {};
  const configuredDelayMs = args.delayMs ?? pulseLimits.minRequestIntervalMs ?? 15_000;
  const configuredJitterMs = args.jitterMs ?? pulseLimits.defaultJitterMs ?? 10_000;
  const maxProfiles = pulseLimits.maxCompanyProfilesPerRun ?? 4;
  const effectiveLimit = Math.min(Number.isFinite(args.limit) ? args.limit : 4, maxProfiles);

  const companyConfig = readCompanyConfig();
  const existingCompanies = existingPulseCompanies();
  const explicitlySelected = args.companies?.length
    ? companyConfig.filter((item) => args.companies.includes(item.slug) || args.companies.includes(item.company))
    : companyConfig;
  const uncollected = args.includeExisting
    ? explicitlySelected
    : explicitlySelected.filter((item) => !existingCompanies.has(String(item.company || "").trim().toLowerCase()));
  const defaultPool = args.companies?.length
    ? uncollected
    : [
      ...uncollected.filter((item) => item.priority === "P0"),
      ...uncollected.filter((item) => item.priority === "P1"),
      ...uncollected.filter((item) => item.priority === "P2")
    ];
  const selected = defaultPool.slice(0, effectiveLimit);

  if (!explicitlySelected.length) throw new Error("没有匹配到 Pulse 公司配置。请检查 --companies 或配置文件。");
  if (args.dryRun) {
    console.log("Pulse dry-run 仅输出本地候选计划，不发起请求、不写入 jobs，也不代表岗位实采。");
  }
  if (!selected.length) {
    console.log("Pulse公司配置已全部采集，本次没有新的公开公司画像需要读取。");
    console.log(`已采集公司数：${existingCompanies.size}/${companyConfig.length}`);
    return;
  }

  console.log(`Pulse低频采集计划：${selected.length} 个公司画像`);
  console.log(`节流策略：第一个立即，后续每个间隔 ${Math.round(configuredDelayMs / 1000)}-${Math.round((configuredDelayMs + configuredJitterMs) / 1000)} 秒`);
  for (const item of selected) {
    console.log(`- ${item.company}: ${sourceBaseUrl}/companies/${item.slug}/`);
  }

  if (args.dryRun) return;

  mkdirSync(rawDir, { recursive: true });
  mkdirSync(processedDir, { recursive: true });
  const seen = existingIds();
  const imported = [];
  const skipped = [];
  const errors = [];

  for (let index = 0; index < selected.length; index += 1) {
    const item = selected[index];
    const waitMs = index === 0 ? 0 : configuredDelayMs + randomInt(configuredJitterMs);
    if (waitMs > 0) {
      console.log(`等待 ${Math.round(waitMs / 1000)} 秒后采集 ${item.company}`);
      await sleep(waitMs);
    }

    const url = `${sourceBaseUrl}/companies/${item.slug}/`;
    try {
      const html = await fetchHtml(url);
      const record = parseCompanyProfile(html, item);
      if (seen.has(record.id)) {
        skipped.push(record);
        console.log(`跳过重复：${record.company}`);
        continue;
      }
      const rawPath = join(rawDir, rawFileName(record.id));
      writeFileSync(rawPath, record.rawText);
      appendFileSync(jobsPath, `${JSON.stringify({ ...record, rawPath })}\n`);
      seen.add(record.id);
      imported.push({ ...record, rawPath });
      console.log(`已导入：${record.company} | ${record.salary || "无薪资"} | ${record.pulseWorkModel || "无工作模式"}`);
    } catch (error) {
      errors.push({ company: item.company, url, error: error.message });
      console.log(`采集失败：${item.company} | ${error.message}`);
    }
  }

  const runPath = join(processedDir, `pulse_aisepulse_run_${stamp()}.json`);
  writeFileSync(runPath, JSON.stringify({
    source: sourceName,
    createdAt: new Date().toISOString(),
    delayMs: configuredDelayMs,
    jitterMs: configuredJitterMs,
    selected,
    importedCount: imported.length,
    skippedCount: skipped.length,
    errorCount: errors.length,
    imported: imported.map((record) => ({ id: record.id, company: record.company, salary: record.salary, url: record.url })),
    skipped: skipped.map((record) => ({ id: record.id, company: record.company, url: record.url })),
    errors
  }, null, 2));

  writePulseReport(readAllJobs());

  console.log(`Pulse采集完成：新增 ${imported.length} 条，跳过重复 ${skipped.length} 条，失败 ${errors.length} 条`);
  console.log(`运行记录：${runPath}`);
  console.log(`报告：${outputMdPath}`);
}

main();
