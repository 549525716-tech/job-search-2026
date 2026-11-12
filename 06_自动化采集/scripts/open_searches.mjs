#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { collectionAutomationHandoff, readAuthTransport } from "./auth_transport_policy.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const configPath = join(projectRoot, "06_自动化采集/config/searches.json");
const authConfigPath = join(projectRoot, "06_自动化采集/config/auth.json");
const rateLimitConfigPath = join(projectRoot, "06_自动化采集/config/rate_limits.json");
const sessionDir = join(projectRoot, "01_行情收集/data/processed");

function getArg(name, fallback = "") {
  const index = process.argv.indexOf(name);
  if (index === -1 || index + 1 >= process.argv.length) return fallback;
  return process.argv[index + 1];
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function usage() {
  return `Usage:
  npm run open:jobs -- --groups AI销售,AI售前 --city 全国 --limit 3
  npm run open:jobs -- --groups AI销售 --city 广州 --limit 5 --open-interval-ms 10000 --open-jitter-ms 10000
  npm run open:jobs -- --groups AI销售 --city 广州 --limit 3 --resume-after-risk --allow-boss-stagger-open

Purpose:
  Open recruitment search pages as a staggered queue instead of opening every
  tab at once. For BOSS, automatic opening still requires both
  --resume-after-risk and --allow-boss-stagger-open.
`;
}

function stamp() {
  return `${new Date().toISOString().replace(/[:.]/g, "-")}-${process.pid}`;
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function randomInt(max) {
  const value = Number.isFinite(max) && max > 0 ? max : 0;
  return value ? Math.floor(Math.random() * value) : 0;
}

function numberArg(name, fallback) {
  const raw = getArg(name, "");
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} 必须是非负整数。`);
  }
  return value;
}

function readOptionalJson(filePath, fallback = {}) {
  if (!existsSync(filePath)) return fallback;
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function chromeExecutable() {
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    "/Applications/Chromium.app/Contents/MacOS/Chromium"
  ];
  const found = candidates.find((item) => existsSync(item));
  if (!found) {
    throw new Error("未找到 Chrome。请安装 Google Chrome，或在脚本中补充 chromeExecutable 路径。");
  }
  return found;
}

function isBossUrl(url) {
  try {
    return /(^|\.)zhipin\.com$/i.test(new URL(url).hostname.replace(/^www\./, ""));
  } catch {
    return false;
  }
}

function bossManualInstruction(item) {
  return {
    source: item.source,
    group: item.group,
    keyword: item.keyword,
    city: item.city,
    cityCode: item.cityCode,
    safeHomeUrl: "https://www.zhipin.com/",
    instruction: "先进入 BOSS 首页，登录态稳定后在站内搜索框输入 keyword；不要直接粘贴完整搜索 URL。",
    referenceUrl: item.url
  };
}

function openUrlWithProfile(profileDir, url) {
  const child = spawn(chromeExecutable(), [
    `--user-data-dir=${profileDir}`,
    url
  ], {
    cwd: projectRoot,
    detached: true,
    stdio: "ignore"
  });
  child.unref();
}

function openUrlInSystemChrome(url) {
  const child = spawn("open", ["-a", "Google Chrome", url], {
    cwd: projectRoot,
    detached: true,
    stdio: "ignore"
  });
  child.unref();
}

async function openUrlsSequentially(items, options) {
  const opened = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const waitBeforeMs = index === 0 ? 0 : options.openIntervalMs + randomInt(options.openJitterMs);
    if (waitBeforeMs > 0) {
      console.log(`等待 ${Math.round(waitBeforeMs / 1000)} 秒后打开第 ${index + 1}/${items.length} 个搜索页：${item.keyword}`);
      await sleep(waitBeforeMs);
    }

    if (options.useSystemChrome) {
      openUrlInSystemChrome(item.url);
    } else {
      openUrlWithProfile(options.profileDir, item.url);
    }

    const openedAt = new Date().toISOString();
    opened.push({
      index: index + 1,
      keyword: item.keyword,
      url: item.url,
      waitBeforeMs,
      openedAt,
      launcher: options.useSystemChrome ? "system_chrome" : "project_profile"
    });
    console.log(`已打开第 ${index + 1}/${items.length} 个搜索页：${item.keyword}`);
  }
  return opened;
}

if (hasFlag("--help") || hasFlag("-h")) {
  console.log(usage());
  process.exit(0);
}
const dryRun = hasFlag("--dry-run");
if (!dryRun) {
  const transportConfigPath = process.env.AUTH_TRANSPORT_CONFIG_PATH || authConfigPath;
  const transport = readAuthTransport(transportConfigPath);
  console.log(JSON.stringify(collectionAutomationHandoff({
    command: "open:jobs",
    source: getArg("--source", "BOSS直聘"),
    transport: transport.state === "configured" ? transport.transport : "unknown"
  })));
  process.exitCode = 2;
  process.exit();
}
const config = JSON.parse(readFileSync(configPath, "utf8"));
const authConfig = JSON.parse(readFileSync(authConfigPath, "utf8"));
const rateLimitConfig = readOptionalJson(rateLimitConfigPath, {});
const groupNames = getArg("--groups", "AI销售,AI售前")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const sourceName = getArg("--source", "BOSS直聘");
const cityName = getArg("--city", "全国");
const limit = Number.parseInt(getArg("--limit", "1"), 10);
const profileDir = resolve(projectRoot, getArg("--profile", authConfig.profileDir || ".career-browser-profile"));
const resumeAfterRisk = hasFlag("--resume-after-risk");
const allowBossStaggerOpen = hasFlag("--allow-boss-stagger-open");
const bossOpenConfig = rateLimitConfig.boss || {};
const genericOpenConfig = rateLimitConfig.openSearches || {};
const openIntervalMs = numberArg("--open-interval-ms", bossOpenConfig.openSearchIntervalMs ?? genericOpenConfig.openIntervalMs ?? 10_000);
const openJitterMs = numberArg("--open-jitter-ms", bossOpenConfig.openSearchJitterMs ?? genericOpenConfig.openJitterMs ?? 10_000);

const source = config.sources.find((item) => item.name === sourceName && item.enabled);
if (!source) {
  throw new Error(`未找到已启用的数据源：${sourceName}`);
}

const cityCode = config.defaultCityCodes[cityName] ?? config.defaultCityCodes["全国"];
const selectedGroups = config.searchGroups.filter((group) => groupNames.includes(group.name));
if (selectedGroups.length === 0) {
  throw new Error(`未找到搜索组：${groupNames.join(", ")}`);
}

const urls = [];
for (const group of selectedGroups) {
  for (const keyword of group.keywords) {
    const queryEncoded = encodeURIComponent(keyword);
    const url = source.urlTemplate
      .replaceAll("{queryEncoded}", queryEncoded)
      .replaceAll("{query}", keyword)
      .replaceAll("{cityCode}", cityCode)
      .replaceAll("{city}", cityName);

    urls.push({
      source: source.name,
      group: group.name,
      roleFamily: group.roleFamily,
      keyword,
      city: cityName,
      cityCode,
      url
    });
  }
}

const requestedLimit = Number.isFinite(limit) ? limit : 1;
const bossMaxOpenSearches = Number.isFinite(bossOpenConfig.maxOpenSearchesPerRun)
  ? bossOpenConfig.maxOpenSearchesPerRun
  : 5;
const effectiveLimit = sourceName === "BOSS直聘" ? Math.min(requestedLimit, bossMaxOpenSearches) : requestedLimit;
const selectedUrls = urls.slice(0, effectiveLimit);
const selectedContainsBossUrl = selectedUrls.some((item) => isBossUrl(item.url));
const bossProtectedSource = sourceName === "BOSS直聘" || selectedContainsBossUrl;
const pausedByRiskRecovery = bossProtectedSource && !dryRun && !resumeAfterRisk;
const bossStaggerOpen = bossProtectedSource && !dryRun && resumeAfterRisk && allowBossStaggerOpen;
const manualOnlyBossOpen = bossProtectedSource && !dryRun && resumeAfterRisk && !allowBossStaggerOpen;
let openedUrls = [];
if (!dryRun && !pausedByRiskRecovery) {
  if (manualOnlyBossOpen) {
    // BOSS still stays manual unless the user explicitly enables staggered open.
  } else {
    openedUrls = await openUrlsSequentially(selectedUrls, {
      profileDir,
      openIntervalMs,
      openJitterMs,
      useSystemChrome: bossStaggerOpen
    });
  }
}

mkdirSync(sessionDir, { recursive: true });
const sessionPath = join(sessionDir, `search_session_${stamp()}.json`);
writeFileSync(
  sessionPath,
  JSON.stringify(
    {
      createdAt: new Date().toISOString(),
      dryRun,
      pausedByRiskRecovery,
      manualOnlyBossOpen,
      bossStaggerOpen,
      allowBossStaggerOpen,
      profileDir,
      openIntervalMs,
      openJitterMs,
      requestedLimit,
      effectiveLimit,
      count: selectedUrls.length,
      urls: selectedUrls,
      openedUrls,
      manualSearchInstructions: bossProtectedSource
        ? selectedUrls.map(bossManualInstruction)
        : []
    },
    null,
    2
  )
);

console.log(`已生成搜索会话：${sessionPath}`);
console.log(`数据源：${sourceName}`);
console.log(`城市：${cityName}`);
console.log(`节流策略：第一个立即打开，后续每个间隔 ${Math.round(openIntervalMs / 1000)}-${Math.round((openIntervalMs + openJitterMs) / 1000)} 秒`);
console.log(`打开链接数：${dryRun || pausedByRiskRecovery || manualOnlyBossOpen ? 0 : selectedUrls.length}`);
if (pausedByRiskRecovery) {
  console.log("BOSS风控恢复期：open:jobs 默认不自动打开链接。确认手动验证完成后追加 --resume-after-risk。");
}
if (manualOnlyBossOpen) {
  console.log("BOSS风控恢复期：本次只输出人工搜索词，不检查登录态、不置前、不打开搜索结果页。");
  console.log("如果你确认可以恢复低频多开，可追加 --allow-boss-stagger-open；脚本会按 10-20 秒间隔顺序打开。");
  console.log("请先运行 npm run auth:boss，只进入 BOSS 首页；页面稳定后在站内搜索框输入下面关键词。不要直接粘贴完整搜索 URL。");
}
if (bossStaggerOpen) {
  console.log("BOSS低频多开已启用：使用系统 Chrome 顺序打开搜索页，不使用 9333/CDP。");
}
console.log(bossProtectedSource ? "人工搜索入口：" : "链接：");
for (const item of selectedUrls) {
  if (bossProtectedSource) {
    console.log(`- [${item.group}] 首页: https://www.zhipin.com/ | 关键词: ${item.keyword} | 城市: ${item.city}`);
    console.log(`  备查URL（不建议直接打开）: ${item.url}`);
  } else {
    console.log(`- [${item.group}] ${item.keyword}: ${item.url}`);
  }
}
