#!/usr/bin/env node

import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { collectionAutomationHandoff, readAuthTransport } from "./auth_transport_policy.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const authConfigPath = join(projectRoot, "06_自动化采集/config/auth.json");
const searchConfigPath = join(projectRoot, "06_自动化采集/config/searches.json");
const rateLimitConfigPath = join(projectRoot, "06_自动化采集/config/rate_limits.json");
const jobsPath = join(projectRoot, "01_行情收集/data/jobs.jsonl");
const rawDir = join(projectRoot, "01_行情收集/data/raw");
const processedDir = join(projectRoot, "01_行情收集/data/processed");
const rateLimitStatePath = join(processedDir, "boss_rate_limit_state.json");
let chromium;

const defaultRoleKeywords = [
  "AI销售",
  "大模型销售",
  "企业服务销售",
  "SaaS大客户销售",
  "AI售前",
  "大模型售前",
  "解决方案顾问 AI",
  "POC 售前"
];

const companyAliasMap = {
  "百度智能云": ["百度智能云", "百度", "百度云"],
  "阿里云": ["阿里云", "阿里", "阿里巴巴"],
  "腾讯云": ["腾讯云", "腾讯"],
  "火山引擎": ["火山引擎", "字节", "抖音"],
  "华为云": ["华为云", "华为"],
  "京东云": ["京东云", "京东"],
  "科大讯飞": ["科大讯飞", "讯飞"],
  "金山云": ["金山云", "金山"],
  "移动云": ["移动云", "中国移动"],
  "天翼云": ["天翼云", "中国电信", "电信"],
  "智谱AI": ["智谱AI", "智谱", "智谱华章"],
  "MiniMax": ["MiniMax", "稀宇"],
  "零一万物": ["零一万物", "01.AI"],
  "商汤科技": ["商汤科技", "商汤"],
  "容联云": ["容联云", "容联"],
  "沃丰科技": ["沃丰科技", "沃丰", "Udesk"],
  "网易七鱼": ["网易七鱼", "七鱼", "网易"],
  "小i机器人": ["小i机器人", "小i"],
  "百应科技": ["百应科技", "百应"],
  "来也科技": ["来也科技", "来也"],
  "弘玑Cyclone": ["弘玑Cyclone", "弘玑", "Cyclone"],
  "影刀RPA": ["影刀RPA", "影刀"],
  "卡奥斯": ["卡奥斯", "COSMOPlat"],
  "格创东智": ["格创东智", "格创"],
  "新华三": ["新华三", "H3C"],
  "中科曙光": ["中科曙光", "曙光"],
  "超聚变": ["超聚变", "xFusion"],
  "华鲲振宇": ["华鲲振宇", "华鲲"]
};

function usage() {
  return `Usage:
  npm run collect:jobs -- --groups AI销售,AI售前 --city 全国 --max-jobs 30
  npm run collect:jobs -- --companies 百度,阿里云,火山引擎 --roles AI销售,AI售前 --city 北京
  npm run collect:jobs -- --industries 智能客服,企业知识库,AI Agent --roles 销售,售前
  npm run collect:jobs -- --keywords "大模型销售" --max-searches 1 --detail-limit 0 --delay-ms 600000 --resume-after-risk

Options:
  --source <name>          Default: BOSS直聘
  --city <name>            Default: 全国
  --groups <a,b>           Use configured search groups.
  --keywords <a,b>         Direct custom search keywords.
  --keywords-file <path>   One keyword per line, or comma-separated.
  --companies <a,b>        Company-name based opportunity search.
  --companies-file <path>  One company per line, or comma-separated.
  --industries <a,b>       Industry/track based opportunity search.
  --industries-file <path> One industry/track per line, or comma-separated.
  --roles <a,b>            Role terms combined with companies/industries.
  --roles-file <path>      One role term per line, or comma-separated.
  --max-searches <n>       Maximum search pages to open. Default: 1 for BOSS.
  --max-jobs <n>           Maximum new jobs to save. Default: 3 for BOSS.
  --cards-per-search <n>   Maximum cards read from each search page. Default: 2 for BOSS.
  --detail-limit <n>       Open detail pages for at most n jobs. Default: 0.
  --delay-ms <n>           Delay between search pages. Default: 600000 for BOSS.
  --min-request-interval-ms <n> Hard lower bound between Boss requests. Default: 600000.
  --jitter-ms <n>          Random extra delay before Boss requests. Default: 180000.
  --cdp <url>              Default: http://127.0.0.1:9333
  --resume-after-risk      Records explicit resume intent; BOSS still stays manual-import-only in human_no_cdp mode.
  --allow-cdp-navigation   Ignored for BOSS while manual-first/human_no_cdp protection is enabled.
  --dry-run                Build search plan only.
`;
}

function parseArgs(argv) {
  const args = {
    source: "BOSS直聘",
    city: "全国",
    maxSearches: 1,
    maxJobs: 3,
    cardsPerSearch: 2,
    detailLimit: 0,
    delayMs: 600_000,
    minRequestIntervalMs: 600_000,
    jitterMs: 180_000,
    resumeAfterRisk: false,
    allowCdpNavigation: false,
    dryRun: false
  };
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const next = () => {
      i += 1;
      if (i >= argv.length) throw new Error(`Missing value for ${key}`);
      return argv[i];
    };
    if (key === "--source") args.source = next();
    else if (key === "--city") args.city = next();
    else if (key === "--groups") args.groups = splitList(next());
    else if (key === "--keywords") args.keywords = splitList(next());
    else if (key === "--keywords-file") args.keywordsFile = resolve(next());
    else if (key === "--companies") args.companies = splitList(next());
    else if (key === "--companies-file") args.companiesFile = resolve(next());
    else if (key === "--industries") args.industries = splitList(next());
    else if (key === "--industries-file") args.industriesFile = resolve(next());
    else if (key === "--roles") args.roles = splitList(next());
    else if (key === "--roles-file") args.rolesFile = resolve(next());
    else if (key === "--max-searches") args.maxSearches = Number.parseInt(next(), 10);
    else if (key === "--max-jobs") args.maxJobs = Number.parseInt(next(), 10);
    else if (key === "--cards-per-search") args.cardsPerSearch = Number.parseInt(next(), 10);
    else if (key === "--detail-limit") args.detailLimit = Number.parseInt(next(), 10);
    else if (key === "--delay-ms") args.delayMs = Number.parseInt(next(), 10);
    else if (key === "--min-request-interval-ms") args.minRequestIntervalMs = Number.parseInt(next(), 10);
    else if (key === "--jitter-ms") args.jitterMs = Number.parseInt(next(), 10);
    else if (key === "--cdp") args.cdp = next();
    else if (key === "--resume-after-risk") args.resumeAfterRisk = true;
    else if (key === "--allow-cdp-navigation") args.allowCdpNavigation = true;
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

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function readOptionalJson(filePath, fallback = {}) {
  if (!existsSync(filePath)) return fallback;
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function readListFile(filePath) {
  if (!filePath) return [];
  const text = await readFile(filePath, "utf8");
  return text
    .split(/\r?\n/)
    .flatMap((line) => {
      const clean = line.trim();
      if (!clean || clean.startsWith("#")) return [];
      return splitList(clean);
    });
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function randomInt(max) {
  const value = Number.isFinite(max) && max > 0 ? max : 0;
  return value ? Math.floor(Math.random() * value) : 0;
}

async function readRateLimitState() {
  if (!existsSync(rateLimitStatePath)) return {};
  try {
    return JSON.parse(await readFile(rateLimitStatePath, "utf8"));
  } catch {
    return {};
  }
}

async function reserveBossRequestSlot(args, planItem) {
  if (planItem.source !== "BOSS直聘") return { waitedMs: 0, nextAllowedAt: "" };

  await mkdir(processedDir, { recursive: true });
  const state = await readRateLimitState();
  const now = Date.now();
  const existingNextAllowedAt = Date.parse(state.nextAllowedAt || "");
  const waitMs = Number.isFinite(existingNextAllowedAt) ? Math.max(0, existingNextAllowedAt - now) : 0;
  if (waitMs > 0) await sleep(waitMs);

  const intervalMs = Math.max(args.delayMs || 0, args.minRequestIntervalMs || 0);
  const jitterMs = randomInt(args.jitterMs || 0);
  const reservedAt = Date.now();
  const nextAllowedAt = new Date(reservedAt + intervalMs + jitterMs).toISOString();
  await writeFile(rateLimitStatePath, JSON.stringify({
    source: planItem.source,
    query: planItem.query,
    reservedAt: new Date(reservedAt).toISOString(),
    intervalMs,
    jitterMs,
    nextAllowedAt
  }, null, 2));

  return { waitedMs: waitMs, intervalMs, jitterMs, nextAllowedAt };
}

function cityCode(searchConfig, cityName) {
  return searchConfig.defaultCityCodes[cityName] ?? searchConfig.defaultCityCodes["全国"];
}

function sourceConfig(searchConfig, sourceName) {
  const source = searchConfig.sources.find((item) => item.name === sourceName && item.enabled);
  if (!source) throw new Error(`未找到已启用的数据源：${sourceName}`);
  return source;
}

function applyBossSafetyLimits(args, rateLimitConfig) {
  if (args.source !== "BOSS直聘") return {};
  const bossLimits = rateLimitConfig.boss || {};
  const before = {
    maxSearches: args.maxSearches,
    maxJobs: args.maxJobs,
    cardsPerSearch: args.cardsPerSearch,
    detailLimit: args.detailLimit,
    delayMs: args.delayMs,
    minRequestIntervalMs: args.minRequestIntervalMs,
    jitterMs: args.jitterMs,
    resumeAfterRisk: args.resumeAfterRisk,
    allowCdpNavigation: args.allowCdpNavigation,
    manualNavigationOnly: args.manualNavigationOnly || false
  };

  if (Number.isFinite(bossLimits.maxSearchesPerRun)) {
    args.maxSearches = Math.min(args.maxSearches, bossLimits.maxSearchesPerRun);
  }
  if (Number.isFinite(bossLimits.maxJobsPerRun)) {
    args.maxJobs = Math.min(args.maxJobs, bossLimits.maxJobsPerRun);
  }
  if (Number.isFinite(bossLimits.maxCardsPerSearch)) {
    args.cardsPerSearch = Math.min(args.cardsPerSearch, bossLimits.maxCardsPerSearch);
  }
  if (Number.isFinite(bossLimits.maxDetailPagesPerRun)) {
    args.detailLimit = Math.min(args.detailLimit, bossLimits.maxDetailPagesPerRun);
  }
  if (Number.isFinite(bossLimits.minRequestIntervalMs)) {
    args.delayMs = Math.max(args.delayMs, bossLimits.minRequestIntervalMs);
    args.minRequestIntervalMs = Math.max(args.minRequestIntervalMs, bossLimits.minRequestIntervalMs);
  }
  if (Number.isFinite(bossLimits.defaultJitterMs)) {
    args.jitterMs = Math.max(args.jitterMs, bossLimits.defaultJitterMs);
  }
  const lockedManualNavigation = Boolean(
    bossLimits.manualNavigationOnly || bossLimits.riskRecoveryMode === "manual_first"
  );
  if (lockedManualNavigation && args.allowCdpNavigation) {
    args.allowCdpNavigationIgnored = true;
    args.allowCdpNavigation = false;
  }
  args.manualNavigationOnly = lockedManualNavigation || Boolean(!args.allowCdpNavigation && args.manualNavigationOnly);

  return { before, after: {
    maxSearches: args.maxSearches,
    maxJobs: args.maxJobs,
    cardsPerSearch: args.cardsPerSearch,
    detailLimit: args.detailLimit,
    delayMs: args.delayMs,
    minRequestIntervalMs: args.minRequestIntervalMs,
    jitterMs: args.jitterMs,
    resumeAfterRisk: args.resumeAfterRisk,
    allowCdpNavigation: args.allowCdpNavigation,
    allowCdpNavigationIgnored: args.allowCdpNavigationIgnored || false,
    manualNavigationOnly: args.manualNavigationOnly
  } };
}

function shouldPauseBossLiveRun(args, rateLimitConfig) {
  if (args.source !== "BOSS直聘" || args.dryRun) return false;
  const bossLimits = rateLimitConfig.boss || {};
  return Boolean(bossLimits.requireResumeFlag && !args.resumeAfterRisk);
}

function shouldUseBossManualImportOnly(args, rateLimitConfig) {
  if (args.source !== "BOSS直聘" || args.dryRun) return false;
  const bossLimits = rateLimitConfig.boss || {};
  return Boolean(bossLimits.disableCdpRead || bossLimits.browserMode === "human_no_cdp");
}

function bossPauseMessage(rateLimitConfig) {
  const bossLimits = rateLimitConfig.boss || {};
  const min = bossLimits.recoveryPauseMinutesMin || 120;
  const max = bossLimits.recoveryPauseMinutesMax || 180;
  return [
    "BOSS风控恢复期：本次不会自动打开或刷新 BOSS 页面。",
    `建议先暂停 ${min}-${max} 分钟，并在浏览器中手动完成验证。`,
    "当前 BOSS 已切换为无 CDP 的人工安全浏览器，采集脚本不会读取或控制 BOSS 标签页。",
    "更稳的方式是手动浏览岗位后使用 npm run import:manual 导入复制的岗位文本。"
  ].join("\n");
}

function bossManualImportOnlyMessage() {
  return [
    "BOSS人工安全模式：本次不会连接 9333，也不会读取、打开、刷新或跳转 BOSS 页面。",
    "原因：BOSS 在带 remote-debugging-port/CDP 的浏览器里容易退回 about:blank。",
    "请使用 npm run auth:boss 打开普通 Chrome，只先进入 BOSS 首页；登录态稳定后在站内搜索框输入关键词。",
    "不要直接粘贴完整 BOSS 搜索 URL；岗位文本复制后再用 npm run import:manual 导入。"
  ].join("\n");
}

function makeUrl(template, query, cityName, searchConfig) {
  return template
    .replaceAll("{queryEncoded}", encodeURIComponent(query))
    .replaceAll("{query}", query)
    .replaceAll("{cityCode}", cityCode(searchConfig, cityName))
    .replaceAll("{city}", cityName);
}

function configuredGroupKeywords(searchConfig, groupNames) {
  if (!groupNames?.length) return [];
  const groups = searchConfig.searchGroups.filter((group) => groupNames.includes(group.name));
  return groups.flatMap((group) => group.keywords.map((keyword) => ({
    query: keyword,
    queryKind: "group",
    roleFamily: group.roleFamily,
    group: group.name
  })));
}

function buildSearchPlan(args, searchConfig) {
  const source = sourceConfig(searchConfig, args.source);
  const roleTerms = args.roles?.length ? args.roles : defaultRoleKeywords;
  const plan = [];

  for (const item of configuredGroupKeywords(searchConfig, args.groups)) {
    plan.push({ ...item, source: args.source, city: args.city });
  }

  for (const keyword of args.keywords || []) {
    plan.push({
      query: keyword,
      queryKind: "keyword",
      roleFamily: inferRoleFamily(keyword),
      source: args.source,
      city: args.city
    });
  }

  for (const role of roleTerms) {
    for (const company of args.companies || []) {
      plan.push({
        query: `${company} ${role}`,
        queryKind: "company",
        company,
        role,
        roleFamily: inferRoleFamily(role),
        source: args.source,
        city: args.city
      });
    }
  }

  for (const role of roleTerms) {
    for (const industry of args.industries || []) {
      plan.push({
        query: `${industry} ${role}`,
        queryKind: "industry",
        industry,
        role,
        roleFamily: inferRoleFamily(role),
        source: args.source,
        city: args.city
      });
    }
  }

  if (plan.length === 0) {
    for (const item of configuredGroupKeywords(searchConfig, ["AI销售", "AI售前"])) {
      plan.push({ ...item, source: args.source, city: args.city });
    }
  }

  return dedupeBy(plan, (item) => item.query)
    .slice(0, args.maxSearches)
    .map((item) => ({
      ...item,
      url: makeUrl(source.urlTemplate, item.query, args.city, searchConfig)
    }));
}

function inferRoleFamily(text) {
  if (/售前|解决方案|POC|架构师|顾问/.test(text)) return "售前/解决方案";
  if (/客户成功|交付|实施/.test(text)) return "客户成功/交付";
  if (/销售|BD|商务|大客户|KA/.test(text)) return "销售/商务";
  return "未分类";
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[（）()【】\[\]{}·\s\-_.,，。/\\|]/g, "");
}

function companyAliasCandidates(company) {
  const aliases = new Set([company, ...(companyAliasMap[company] || [])]);
  if (/智能云$/.test(company)) aliases.add(company.replace(/智能云$/, ""));
  if (/云$/.test(company)) aliases.add(company.replace(/云$/, ""));
  if (/科技$/.test(company)) aliases.add(company.replace(/科技$/, ""));
  if (/信息$/.test(company)) aliases.add(company.replace(/信息$/, ""));
  if (/股份$/.test(company)) aliases.add(company.replace(/股份$/, ""));
  return Array.from(aliases)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);
}

function companyMatch(card, targetCompany) {
  if (!targetCompany) return { ok: true, alias: "" };
  const companyText = normalizeText(card.company);
  if (!companyText || /某大型|某中型|不需要融资|已上市|未融资/.test(card.company)) {
    return { ok: false, alias: "" };
  }

  for (const alias of companyAliasCandidates(targetCompany)) {
    const normalizedAlias = normalizeText(alias);
    if (!normalizedAlias || normalizedAlias.length < 2) continue;
    if (companyText.includes(normalizedAlias) || normalizedAlias.includes(companyText)) {
      return { ok: true, alias };
    }
  }
  return { ok: false, alias: "" };
}

function filterCardsByPlan(cards, planItem) {
  if (planItem.queryKind !== "company" || !planItem.company) return cards;
  return cards
    .map((card) => {
      const match = companyMatch(card, planItem.company);
      return { ...card, targetCompanyMatched: match.ok, targetCompanyAlias: match.alias };
    })
    .filter((card) => card.targetCompanyMatched);
}

function dedupeBy(items, keyFn) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

async function existingIds() {
  if (!existsSync(jobsPath)) return new Set();
  const text = await readFile(jobsPath, "utf8");
  return new Set(text
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

function recordId(record) {
  return createHash("sha256")
    .update([record.source, record.url, record.title, record.company, record.query, record.rawText, record.recruiter_id, record.recruiter_name].filter(Boolean).join("\n"))
    .digest("hex")
    .slice(0, 12);
}

async function connectBrowser(cdpUrl) {
  try {
    ({ chromium } = await import("playwright"));
    return await chromium.connectOverCDP(cdpUrl);
  } catch (error) {
    throw new Error(`无法连接登录态浏览器：${cdpUrl}。请先运行 npm run auth:browser，并完成平台登录。原始错误：${error.message}`);
  }
}

async function cdpPageTabs(cdpUrl) {
  try {
    const parsed = new URL(cdpUrl);
    const response = await fetch(`${parsed.origin}/json/list`, {
      signal: AbortSignal.timeout(1500)
    });
    if (!response.ok) return [];
    const tabs = await response.json();
    return tabs.filter((tab) => tab.type === "page");
  } catch {
    return [];
  }
}

function isBossUrl(url) {
  try {
    return /(^|\.)zhipin\.com$/i.test(new URL(url).hostname.replace(/^www\./, ""));
  } catch {
    return false;
  }
}

function isBossSearchPage(url) {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;
    return (
      /\/web\/geek\/jobs?/.test(path) ||
      /\/zhaopin\//.test(path) ||
      parsed.searchParams.has("query")
    );
  } catch {
    return false;
  }
}

function bossQueryFromUrl(url) {
  try {
    return new URL(url).searchParams.get("query") || "";
  } catch {
    return "";
  }
}

function bossManualInstruction(planItem) {
  return {
    source: planItem.source,
    query: planItem.query || bossQueryFromUrl(planItem.url),
    queryKind: planItem.queryKind || "",
    company: planItem.company || "",
    industry: planItem.industry || "",
    role: planItem.role || "",
    city: planItem.city || "",
    safeHomeUrl: "https://www.zhipin.com/",
    instruction: "先通过 npm run auth:boss 进入 BOSS 首页；登录态稳定后在站内搜索框输入 query。完整 URL 仅作记录，不建议直接粘贴打开。",
    referenceUrl: planItem.url
  };
}

function bossManualInstructions(plan, limit) {
  return plan.slice(0, limit).map(bossManualInstruction);
}

function bossManualConsoleHint(planItem) {
  if (!planItem) return "BOSS首页：https://www.zhipin.com/";
  const instruction = bossManualInstruction(planItem);
  return `BOSS首页：${instruction.safeHomeUrl}；站内搜索关键词：${instruction.query || "(按采样任务输入关键词)"}`;
}

function bossManualNavigationIssue(planItem, currentUrl) {
  const plannedQuery = bossQueryFromUrl(planItem.url);
  const currentQuery = bossQueryFromUrl(currentUrl);
  const currentMatchesPlannedQuery = !plannedQuery || !currentQuery || plannedQuery === currentQuery;
  if (isBossUrl(currentUrl) && isBossSearchPage(currentUrl) && currentMatchesPlannedQuery) {
    return null;
  }
  return manualNavigationError(planItem, currentUrl);
}

function manualNavigationError(planItem, currentUrl) {
  const error = new Error([
    "BOSS手动导航保护：本次不会通过协议自动打开、刷新或跳转 BOSS 页面。",
    `当前页面：${currentUrl || "(无)"}`,
    `请先运行 npm run auth:boss，只进入 BOSS 首页；页面稳定后在站内搜索框输入：${planItem.query || bossQueryFromUrl(planItem.url) || "(采样关键词)"}`,
    "完整 BOSS 搜索 URL 只作记录，不建议直接粘贴到地址栏。",
    "页面稳定后再运行同一条 collect:jobs 命令。"
  ].join("\n"));
  error.code = "BOSS_MANUAL_NAV_REQUIRED";
  error.manualUrl = planItem.url;
  error.manualQuery = planItem.query || bossQueryFromUrl(planItem.url) || "";
  error.manualHomeUrl = "https://www.zhipin.com/";
  error.currentUrl = currentUrl || "";
  return error;
}

function pickBossWorkPage(context) {
  return context.pages().find((page) => isBossUrl(page.url()));
}

async function performBossSearch(page, planItem, options = {}) {
  if (planItem.source !== "BOSS直聘") {
    await page.goto(planItem.url, { waitUntil: "domcontentloaded", timeout: 60_000 });
    return;
  }

  if (options.manualNavigationOnly) {
    const currentUrl = page.url();
    const issue = bossManualNavigationIssue(planItem, currentUrl);
    if (issue) throw issue;
    await page.waitForLoadState("domcontentloaded", { timeout: 8_000 }).catch(() => {});
    await waitForBossResults(page, 30_000);
    return;
  }

  await page.goto(planItem.url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForLoadState("domcontentloaded", { timeout: 8_000 }).catch(() => {});

  let state = await waitForBossResults(page, 30_000);
  if (state.needsVerification || state.needsLogin) return;
  if (state.bodyLength < 100 || state.cards === 0) {
    await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => {});
    state = await waitForBossResults(page, 30_000);
  }
}

async function waitForBossResults(page, timeoutMs) {
  const start = Date.now();
  let lastState = { bodyLength: 0, cards: 0, noResult: false, needsLogin: false, needsVerification: false };
  while (Date.now() - start < timeoutMs) {
    try {
      lastState = await page.evaluate(() => {
        const text = String(document.body?.innerText || "").trim();
        const fullText = `${location.href}\n${document.title}\n${text}`;
        return {
          bodyLength: text.length,
          cards: document.querySelectorAll(".card-area, .job-card-wrap").length,
          noResult: /暂无|没有找到|换个关键词/.test(text),
          needsLogin: /登录|注册/.test(document.title) || /登录后|扫码登录|手机登录/.test(text),
          needsVerification: /安全验证|captcha|_security_check|verify\.html/i.test(fullText)
        };
      });
      if (lastState.needsLogin || lastState.needsVerification) return lastState;
      if (lastState.cards > 0 && lastState.bodyLength > 500) return lastState;
      if (lastState.noResult && lastState.bodyLength > 100) return lastState;
    } catch {
      // Boss can destroy the execution context during SPA transitions. Retry.
    }
    await sleep(1000);
  }
  return lastState;
}

async function extractSearchPage(page, planItem, cardsPerSearch, options = {}) {
  await performBossSearch(page, planItem, options);

  return page.evaluate(({ planItem, cardsPerSearch }) => {
    const textOf = (node) => String(node?.innerText || node?.textContent || "").replace(/\u00a0/g, " ").trim();
    const attr = (node, name) => node?.getAttribute(name) || "";
    const absolutize = (href) => {
      if (!href) return "";
      try {
        return new URL(href, location.href).toString();
      } catch {
        return href;
      }
    };
    const bodyText = textOf(document.body);
    const pageStatus = {
      title: document.title,
      url: location.href,
      needsLogin: /登录|注册/.test(document.title) || /登录后|扫码登录|手机登录/.test(bodyText),
      needsVerification: /安全验证|验证|captcha|_security_check/i.test(location.href + "\n" + bodyText)
    };

    const selectors = [
      ".card-area",
      ".job-card-wrap",
      ".job-card-box",
      ".job-card-wrapper",
      ".job-list-box li",
      ".job-primary",
      ".job-card-body",
      ".job-list-container [class*='card']",
      "[class*='job-list'] li"
    ];
    const nodeSet = new Set();
    for (const selector of selectors) {
      for (const node of document.querySelectorAll(selector)) {
        const text = textOf(node);
        if (text.length >= 20) {
          nodeSet.add(node);
        }
      }
    }

    const nodes = Array.from(nodeSet);
    const cards = [];
    const seen = new Set();
    for (const node of nodes) {
      const text = textOf(node);
      const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
      const linkNode = node.querySelector("a[href*='job_detail']");
      const companyLinkNode = node.querySelector("a[href*='/gongsi/']");
      const titleNode = node.querySelector(".job-name, .job-title, [class*='job-name'], [class*='job-title']");
      const companyNode = node.querySelector(".company-name, [class*='company-name'], [class*='company']");
      const salaryNode = node.querySelector(".salary, [class*='salary']");
      const areaNode = node.querySelector(".job-area, [class*='job-area'], [class*='location']");
      const tagNodes = Array.from(node.querySelectorAll(".tag-list span, [class*='tag'] span, .job-card-footer li")).slice(0, 10);
      const url = absolutize(attr(linkNode, "href"));
      const title = textOf(linkNode) || textOf(titleNode) || lines.find((line) => /销售|售前|解决方案|客户成功|商务|BD|顾问|AI|大模型|SaaS/i.test(line)) || lines[0] || "";
      const salary = textOf(salaryNode) || lines.find((line) => /K|薪|元\/时|万|月薪|年薪/.test(line)) || "";
      const company = textOf(companyLinkNode) || (lines.length >= 2 ? lines[lines.length - 2] : "") || textOf(companyNode);
      const location = textOf(areaNode) || (lines.length >= 1 ? lines[lines.length - 1] : "");
      const recruiterNode = node.querySelector('.boss-name, .recruiter-name, [class*="boss-name"], [class*="recruiter-name"]');
      const recruiter_name = textOf(recruiterNode);
      const dedupeKey = JSON.stringify([url, title, company, location, recruiter_name, text]);
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      cards.push({
        title,
        channel: 'BOSS直聘',
        recruiter_name: recruiter_name || null,
        company,
        salary,
        location,
        tags: tagNodes.map(textOf).filter(Boolean),
        url,
        rawText: text
      });
      if (cards.length >= cardsPerSearch) break;
    }

    return { pageStatus, cards, fallbackText: cards.length ? "" : bodyText.slice(0, 5000), planItem };
  }, { planItem, cardsPerSearch });
}

async function extractDetail(context, card, timeoutMs = 45_000) {
  if (!card.url) return {};
  const page = await context.newPage();
  try {
    await page.goto(card.url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
    return await page.evaluate(() => {
      const clean = (value) => String(value || "").replace(/\u00a0/g, " ").trim();
      const pick = (selectors) => {
        for (const selector of selectors) {
          const node = document.querySelector(selector);
          const text = clean(node?.innerText || node?.textContent);
          if (text) return text;
        }
        return "";
      };
      return {
        detailTitle: document.title,
        detailUrl: location.href,
        detailText: pick([".job-detail", ".job-sec", ".job-detail-section", ".detail-content", "main"]) || clean(document.body?.innerText).slice(0, 30000)
      };
    });
  } catch (error) {
    return { detailError: error.message };
  } finally {
    await page.close().catch(() => {});
  }
}

async function saveRecord(record, seenIds) {
  const id = recordId(record);
  if (seenIds.has(id)) return null;
  const rawText = [record.rawText, record.detailText].filter(Boolean).join("\n\n--- DETAIL ---\n\n").trim();
  const rawPath = join(rawDir, `${stamp()}_${id}.txt`);
  const saved = {
    id,
    collectedAt: new Date().toISOString(),
    rawPath,
    ...record,
    rawText
  };
  await mkdir(rawDir, { recursive: true });
  await writeFile(rawPath, rawText);
  await appendFile(jobsPath, `${JSON.stringify(saved)}\n`);
  seenIds.add(id);
  return saved;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(usage());
    return;
  }

  // The old collector attaches to CDP below. Never let it reach that path for
  // a configured login transport; only pure local planning may continue.
  if (!args.dryRun) {
    const transportConfigPath = process.env.AUTH_TRANSPORT_CONFIG_PATH || authConfigPath;
    const transport = readAuthTransport(transportConfigPath);
    console.log(JSON.stringify(collectionAutomationHandoff({
      command: "collect:jobs",
      source: args.source,
      transport: transport.state === "configured" ? transport.transport : "unknown"
    })));
    process.exitCode = 2;
    return;
  }

  const authConfig = await readJson(authConfigPath);
  const searchConfig = await readJson(searchConfigPath);
  const rateLimitConfig = await readOptionalJson(rateLimitConfigPath, {});
  const safetyLimits = applyBossSafetyLimits(args, rateLimitConfig);
  args.keywords = [...(args.keywords || []), ...(await readListFile(args.keywordsFile))];
  args.companies = [...(args.companies || []), ...(await readListFile(args.companiesFile))];
  args.industries = [...(args.industries || []), ...(await readListFile(args.industriesFile))];
  args.roles = [...(args.roles || []), ...(await readListFile(args.rolesFile))];
  const cdpUrl = args.cdp || `http://127.0.0.1:${authConfig.cdpPort || 9333}`;
  const plan = buildSearchPlan(args, searchConfig);
  const runId = stamp();

  if (args.dryRun) {
    console.log(JSON.stringify({ runId, cdpUrl, args, safetyLimits, count: plan.length, plan }, null, 2));
    return;
  }

  if (shouldPauseBossLiveRun(args, rateLimitConfig)) {
    const manifestPath = join(processedDir, `collect_run_${runId}.json`);
    await mkdir(processedDir, { recursive: true });
    await writeFile(manifestPath, JSON.stringify({
      runId,
      createdAt: new Date().toISOString(),
      cdpUrl,
      args,
      safetyLimits,
      searchPlan: plan,
      status: "paused_by_risk_recovery_mode",
      savedCount: 0,
      message: bossPauseMessage(rateLimitConfig)
    }, null, 2));
    console.log(bossPauseMessage(rateLimitConfig));
    console.log(`运行记录：${manifestPath}`);
    return;
  }

  if (shouldUseBossManualImportOnly(args, rateLimitConfig)) {
    const manifestPath = join(processedDir, `collect_run_${runId}.json`);
    await mkdir(processedDir, { recursive: true });
    await writeFile(manifestPath, JSON.stringify({
      runId,
      createdAt: new Date().toISOString(),
      cdpUrl,
      args,
      safetyLimits,
      searchPlan: plan,
      status: "manual_import_only_boss_no_cdp",
      savedCount: 0,
      message: bossManualImportOnlyMessage(),
      manualSearchInstructions: bossManualInstructions(plan, args.maxSearches),
      manualUrls: plan.slice(0, args.maxSearches).map((item) => item.url)
    }, null, 2));
    console.log(bossManualImportOnlyMessage());
    console.log(`建议操作：${bossManualConsoleHint(plan[0])}`);
    console.log("不要直接粘贴完整 BOSS 搜索 URL。");
    console.log(`运行记录：${manifestPath}`);
    return;
  }

  const bossManualNavigation = args.source === "BOSS直聘" && args.manualNavigationOnly;
  if (bossManualNavigation) {
    const tabs = await cdpPageTabs(cdpUrl);
    if (!tabs.some((tab) => isBossUrl(tab.url))) {
      const manifestPath = join(processedDir, `collect_run_${runId}.json`);
      await mkdir(processedDir, { recursive: true });
      await writeFile(manifestPath, JSON.stringify({
        runId,
        createdAt: new Date().toISOString(),
        cdpUrl,
        args,
        safetyLimits,
        searchPlan: plan,
        status: "manual_navigation_required",
        savedCount: 0,
        message: "BOSS手动导航保护：未检测到现有 zhipin.com 标签页，脚本不会自动新建或跳转 BOSS 页面。",
        currentTabs: tabs.map((tab) => ({ title: tab.title || "", url: tab.url || "" })),
        manualSearchInstructions: bossManualInstructions(plan, args.maxSearches),
        manualUrls: plan.slice(0, args.maxSearches).map((item) => item.url)
      }, null, 2));
      console.log("BOSS手动导航保护：未检测到现有 BOSS 标签页，未自动打开新页面。");
      console.log(`请手动操作：${bossManualConsoleHint(plan[0])}`);
      console.log("不要直接粘贴完整 BOSS 搜索 URL。");
      console.log(`运行记录：${manifestPath}`);
      return;
    }
  }

  const browser = await connectBrowser(cdpUrl);
  const context = browser.contexts()[0] || await browser.newContext();
  const workPage = bossManualNavigation
    ? pickBossWorkPage(context)
    : (pickBossWorkPage(context) || await context.newPage());
  const seenIds = await existingIds();
  const collected = [];
  const blocked = [];
  const pageStats = [];

  if (bossManualNavigation && !workPage) {
    const manifestPath = join(processedDir, `collect_run_${runId}.json`);
    await mkdir(processedDir, { recursive: true });
    await writeFile(manifestPath, JSON.stringify({
      runId,
      createdAt: new Date().toISOString(),
      cdpUrl,
      args,
      safetyLimits,
      searchPlan: plan,
      status: "manual_navigation_required",
      savedCount: 0,
      message: "BOSS手动导航保护：未检测到现有 zhipin.com 标签页，脚本不会自动新建或跳转 BOSS 页面。",
      manualSearchInstructions: bossManualInstructions(plan, args.maxSearches),
      manualUrls: plan.slice(0, args.maxSearches).map((item) => item.url)
    }, null, 2));
    if (typeof browser.disconnect === "function") browser.disconnect();
    console.log("BOSS手动导航保护：未检测到现有 BOSS 标签页，未自动打开新页面。");
    console.log(`请手动操作：${bossManualConsoleHint(plan[0])}`);
    console.log("不要直接粘贴完整 BOSS 搜索 URL。");
    console.log(`运行记录：${manifestPath}`);
    return;
  }

  for (const planItem of plan) {
    if (collected.length >= args.maxJobs) break;
    const page = workPage;
    let rateLimit = { waitedMs: 0, nextAllowedAt: "" };
    try {
      if (planItem.source === "BOSS直聘" && bossManualNavigation) {
        const issue = bossManualNavigationIssue(planItem, page.url());
        if (issue) throw issue;
      }
      if (planItem.source === "BOSS直聘") {
        rateLimit = await reserveBossRequestSlot(args, planItem);
      } else if (args.delayMs > 0) {
        await sleep(args.delayMs);
      }
      const result = await extractSearchPage(page, planItem, args.cardsPerSearch, {
        manualNavigationOnly: bossManualNavigation
      });
      const rawCards = result.cards;
      const cards = filterCardsByPlan(rawCards, planItem);
      pageStats.push({
        query: planItem.query,
        url: result.pageStatus.url,
        title: result.pageStatus.title,
        rawCards: rawCards.length,
        cards: cards.length,
        fallbackTextLength: result.fallbackText.length,
        needsLogin: result.pageStatus.needsLogin,
        needsVerification: result.pageStatus.needsVerification,
        rateLimit
      });
      if (result.pageStatus.needsLogin || result.pageStatus.needsVerification) {
        blocked.push({ planItem, pageStatus: result.pageStatus });
        break;
      }

      let detailBudget = Math.max(0, args.detailLimit - collected.filter((item) => item.detailText).length);
      for (const card of cards) {
        if (collected.length >= args.maxJobs) break;
        const detail = detailBudget > 0 ? await extractDetail(context, card) : {};
        if (detailBudget > 0) detailBudget -= 1;
        const record = await saveRecord({
          source: planItem.source,
          query: planItem.query,
          queryKind: planItem.queryKind,
          group: planItem.group || "",
          companyFilter: planItem.company || "",
          industryFilter: planItem.industry || "",
          role: planItem.role || "",
          roleFamily: planItem.roleFamily || inferRoleFamily(`${card.title}\n${card.rawText}`),
          city: planItem.city,
          searchUrl: planItem.url,
          ...card,
          ...detail
        }, seenIds);
        if (record) collected.push(record);
      }

      if (rawCards.length === 0 && result.fallbackText) {
        const record = await saveRecord({
          source: planItem.source,
          query: planItem.query,
          queryKind: planItem.queryKind,
          roleFamily: planItem.roleFamily,
          city: planItem.city,
          searchUrl: planItem.url,
          title: `搜索页文本：${planItem.query}`,
          company: "",
          salary: "",
          location: "",
          tags: [],
          url: result.pageStatus.url,
          rawText: result.fallbackText
        }, seenIds);
        if (record) collected.push(record);
      }
    } catch (error) {
      if (error.code === "BOSS_MANUAL_NAV_REQUIRED") {
        pageStats.push({
          query: planItem.query,
          url: error.currentUrl || page.url(),
          title: await page.title().catch(() => ""),
          cards: 0,
          fallbackTextLength: 0,
          manualNavigationRequired: true,
          manualUrl: error.manualUrl,
          manualHomeUrl: error.manualHomeUrl,
          manualQuery: error.manualQuery,
          error: error.message
        });
        blocked.push({
          planItem,
          pageStatus: {
            manualNavigationRequired: true,
            url: error.currentUrl,
            manualUrl: error.manualUrl,
            manualHomeUrl: error.manualHomeUrl,
            manualQuery: error.manualQuery
          }
        });
        break;
      }
      pageStats.push({
        query: planItem.query,
        url: page.url(),
        title: await page.title().catch(() => ""),
        cards: 0,
        fallbackTextLength: 0,
        error: error.message
      });
    }
  }

  await mkdir(processedDir, { recursive: true });
  const manifestPath = join(processedDir, `collect_run_${runId}.json`);
  const manualNavigationBlocked = blocked.some((item) => item.pageStatus?.manualNavigationRequired);
  await writeFile(manifestPath, JSON.stringify({
    runId,
    createdAt: new Date().toISOString(),
    cdpUrl,
    args,
    safetyLimits,
    searchPlan: plan,
    status: manualNavigationBlocked ? "manual_navigation_required" : (blocked.length ? "blocked" : "completed"),
    savedCount: collected.length,
    pageStats,
    blocked,
    manualSearchInstructions: manualNavigationBlocked ? bossManualInstructions(plan, args.maxSearches) : [],
    savedIds: collected.map((item) => item.id)
  }, null, 2));

  if (typeof browser.disconnect === "function") {
    browser.disconnect();
  }

  console.log(`采集完成：新增 ${collected.length} 条`);
  console.log(`运行记录：${manifestPath}`);
  if (manualNavigationBlocked) {
    const firstManual = blocked.find((item) => item.pageStatus?.manualNavigationRequired);
    console.log("BOSS手动导航保护：未自动打开、刷新或跳转页面。");
    console.log(`请手动操作：BOSS首页：${firstManual?.pageStatus?.manualHomeUrl || "https://www.zhipin.com/"}；站内搜索关键词：${firstManual?.pageStatus?.manualQuery || plan[0]?.query || "(采样关键词)"}`);
    console.log("不要直接粘贴完整 BOSS 搜索 URL。");
  } else if (blocked.length > 0) {
    console.log(`有 ${blocked.length} 个搜索页需要登录/验证处理。请在登录态浏览器中处理后重跑。`);
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
