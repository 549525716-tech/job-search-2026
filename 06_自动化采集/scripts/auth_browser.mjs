#!/usr/bin/env node

import { execFileSync, spawn } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { defaultAuthBrowserPlan } from "./auth_browser_policy.mjs";
import { nativeUiCheckHandoff, readAuthTransport } from "./auth_transport_policy.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const authConfigPath = join(projectRoot, "06_自动化采集/config/auth.json");
const pidPath = join(projectRoot, ".career-auth-browser.pid");
const bossPidPath = join(projectRoot, ".career-boss-browser.pid");
const logPath = join(projectRoot, ".career-auth-browser.log");
const bossLogPath = join(projectRoot, ".career-boss-browser.log");
const bossHandoffPath = join(projectRoot, "01_行情收集/BOSS登录安全入口.html");
const bossLowFrequencyWorkcardPath = join(projectRoot, "01_行情收集/BOSS首页低频手动搜索作业卡.html");
const bossHandoffStatePath = join(projectRoot, "01_行情收集/data/processed/boss_handoff_state.json");
const bossActionAuditPath = join(projectRoot, "01_行情收集/data/processed/boss_action_audit.jsonl");
const bossHandoffOpenCooldownMs = 30 * 60 * 1000;
const platformOpenWaitMs = 10_000;
const platformOpenPollMs = 800;

function usage() {
  return `Usage:
	  npm run auth:browser
	  npm run auth:boss
	  npm run auth:open -- --source BOSS直聘
	  npm run auth:status
	  npm run auth:restart
	  npm run auth:stop

Direct:
	  node 06_自动化采集/scripts/auth_browser.mjs start [--port 9333] [--open-login]
	  node 06_自动化采集/scripts/auth_browser.mjs open [--source BOSS直聘] [--url https://www.zhipin.com/]
	  node 06_自动化采集/scripts/auth_browser.mjs status
	  node 06_自动化采集/scripts/auth_browser.mjs restart
	  node 06_自动化采集/scripts/auth_browser.mjs stop
  node 06_自动化采集/scripts/auth_browser.mjs check

Purpose:
  Auth commands are isolated behind the configured browser handoff. They do not
  inspect processes, connect to CDP, generate handoff files, open URLs, or
  launch/stop Chrome. Login uses an ordinary Codex tab via open_in_codex, not
  an automation-managed tab. Do not acquire or poll that tab during user login.
  After handoff, checks are at least 10 seconds apart. No desktop
  fallback and no automatic refresh timer. Check account and full JDs separately.
	`;
}

function parseArgs(argv) {
  const args = { command: argv[2] || "start" };
  for (let i = 3; i < argv.length; i += 1) {
    const key = argv[i];
    const next = () => {
      i += 1;
      if (i >= argv.length) throw new Error(`Missing value for ${key}`);
      return argv[i];
    };
    if (key === "--source") args.source = next();
    else if (key === "--url") args.url = next();
    else if (key === "--port") args.port = Number.parseInt(next(), 10);
    else if (key === "--profile") args.profile = resolve(next());
    else if (key === "--remote-allow-origins") args.remoteAllowOrigins = next();
    else if (key === "--open-login") args.openLogin = true;
    else if (key === "--force-open" || key === "--isolated-boss-profile" || key === "--launch-handoff" || key === "--open-handoff") {
      throw new Error(`${key} is unavailable under browser handoff isolation (codex-in-app-browser / chrome-native-ui).`);
    }
    else if (key === "--direct-boss" || key === "--direct" || key === "--boss-link" || key === "--reuse-boss") {
      throw new Error(`${key} is unavailable under browser handoff isolation (codex-in-app-browser / chrome-native-ui). Use only the configured supported browser.`);
    }
    else if (key === "--dry-run") args.dryRun = true;
    else if (key === "--help" || key === "-h") args.help = true;
    else throw new Error(`Unknown option: ${key}`);
  }
  return args;
}

function readConfig() {
  return JSON.parse(readFileSync(authConfigPath, "utf8"));
}

function readOptionalJsonSync(filePath, fallback = {}) {
  if (!existsSync(filePath)) return fallback;
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJsonSync(filePath, value) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

function appendBossAudit(event) {
  mkdirSync(dirname(bossActionAuditPath), { recursive: true });
  appendFileSync(bossActionAuditPath, `${JSON.stringify({
    at: new Date().toISOString(),
    ...event
  })}\n`, "utf8");
}

function readPid(path = pidPath) {
  if (!existsSync(path)) return null;
  const pid = Number.parseInt(readFileSync(path, "utf8").trim(), 10);
  return Number.isInteger(pid) ? pid : null;
}

function isAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function processCommand(pid) {
  if (!pid) return "";
  try {
    return execFileSync("ps", ["-p", String(pid), "-o", "command="], {
      encoding: "utf8",
      timeout: 1500
    }).trim();
  } catch {
    return "";
  }
}

function psEntries() {
  try {
    const output = execFileSync("ps", ["-axo", "pid=,command="], {
      encoding: "utf8",
      timeout: 2000
    });
    return output
      .split(/\r?\n/)
      .map((line) => {
        const match = line.match(/^\s*(\d+)\s+(.*)$/);
        if (!match) return null;
        return {
          pid: Number.parseInt(match[1], 10),
          command: match[2]
        };
      })
      .filter((entry) => entry && Number.isInteger(entry.pid));
  } catch {
    return [];
  }
}

function pidsUsingTcpPort(port) {
  if (!port) return [];
  try {
    const output = execFileSync("lsof", ["-ti", `tcp:${port}`], {
      encoding: "utf8",
      timeout: 2000
    });
    return output
      .split(/\s+/)
      .map((item) => Number.parseInt(item, 10))
      .filter(Number.isInteger);
  } catch {
    return [];
  }
}

function projectChromeEntriesByMarker(marker) {
  if (!marker) return [];
  return psEntries().filter((entry) => {
    const command = entry.command || "";
    return (
      command.includes(marker) &&
      /Google Chrome|Chromium/.test(command) &&
      !command.includes(" rg ") &&
      !command.includes(" auth_browser.mjs ")
    );
  });
}

function isChromeAppCommand(command) {
  return (
    command.includes("/Google Chrome.app/") ||
    command.includes("/Google Chrome Canary.app/") ||
    command.includes("/Chromium.app/") ||
    command.includes("/Google Chrome for Testing.app/")
  );
}

function isChromeLikeCommand(command) {
  const lower = String(command || "").toLowerCase();
  return (
    isChromeAppCommand(command) ||
    lower.includes("google chrome") ||
    lower.includes("/chromium.app/") ||
    lower.includes("chromium --") ||
    lower.includes("chrome for testing") ||
    lower.includes("headlesschrome") ||
    lower.includes("chromedriver") ||
    lower.includes("playwright") ||
    (lower.includes("codex") && lower.includes("chrome"))
  );
}

function automationChromeEntries() {
  return psEntries().filter((entry) => {
    const command = entry.command || "";
    return (
      isChromeLikeCommand(command) &&
      (
        command.includes("--no-sandbox") ||
        command.includes("--enable-automation") ||
        command.includes("--remote-debugging-port=")
      ) &&
      !command.includes(" rg ") &&
      !command.includes(" auth_browser.mjs ")
    );
  });
}

function projectChromePidsByProfile(profileDir) {
  const marker = basename(profileDir);
  return projectChromeEntriesByMarker(marker).map((entry) => entry.pid);
}

function mainProjectChromePidsByProfile(profileDir) {
  const marker = basename(profileDir);
  return projectChromeEntriesByMarker(marker)
    .filter((entry) => !entry.command.includes("/Helpers/") && !entry.command.includes(" --type="))
    .map((entry) => entry.pid);
}

function projectCdpPids(port, profileDir) {
  const marker = basename(profileDir);
  const commandPids = psEntries()
    .filter((entry) => {
      const command = entry.command || "";
      return (
        /Google Chrome|Chromium/.test(command) &&
        (
          command.includes(`--remote-debugging-port=${port}`) ||
          (command.includes(marker) && command.includes("--remote-debugging-port="))
        )
      );
    })
    .map((entry) => entry.pid);
  return Array.from(new Set([...commandPids, ...pidsUsingTcpPort(port)]));
}

async function terminatePids(pids, label, timeoutMs = 8_000) {
  const uniquePids = Array.from(new Set(pids.filter((pid) => Number.isInteger(pid) && isAlive(pid))));
  if (!uniquePids.length) return [];

  for (const pid of uniquePids) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // Process already exited.
    }
  }

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const alive = uniquePids.filter((pid) => isAlive(pid));
    if (!alive.length) {
      console.log(`已停止${label}：pid ${uniquePids.join(", ")}`);
      return uniquePids;
    }
    await sleep(250);
  }

  const stillAlive = uniquePids.filter((pid) => isAlive(pid));
  if (stillAlive.length) {
    throw new Error(`${label} pid ${stillAlive.join(", ")} 未在预期时间内退出，请手动关闭相关 Chrome 窗口后重试。`);
  }
  console.log(`已停止${label}：pid ${uniquePids.join(", ")}`);
  return uniquePids;
}

function cleanupStalePid(path) {
  const pid = readPid(path);
  if (pid && isAlive(pid)) return pid;
  if (existsSync(path)) unlinkSync(path);
  return null;
}

function remoteAllowOriginsFor(config, args = {}) {
  const value = args.remoteAllowOrigins || config.remoteAllowOrigins || [];
  if (Array.isArray(value)) return value.filter(Boolean).join(",");
  if (typeof value === "string") return value.trim();
  return "";
}

function launchDiagnostics(pid, config, args = {}) {
  const command = processCommand(pid);
  const remoteAllowOrigins = remoteAllowOriginsFor(config, args);
  const issues = [];
  if (!command) {
    return {
      launchCommand: "",
      expectedRemoteAllowOrigins: remoteAllowOrigins,
      launchIssues: issues
    };
  }
  if (/\sabout:blank(?:\s|$)/.test(command)) {
    issues.push("当前登录态浏览器仍以 about:blank 启动；该观察不触发自动重启");
  }
  if (command.includes("chrome://newtab/")) {
    issues.push("当前登录态浏览器仍以 chrome://newtab/ 启动，Chrome 可能显示为 about:blank；该观察不触发自动重启");
  }
  if (command.includes("--no-sandbox")) {
    issues.push("当前浏览器带有 --no-sandbox 自动化特征，BOSS 页面可能打开后被打回 blank");
  }
  if (remoteAllowOrigins && !command.includes("--remote-allow-origins=")) {
    issues.push("当前登录态浏览器缺少 --remote-allow-origins，Chrome 插件连接 9333 端口可能被拒绝");
  }
  return {
    launchCommand: command,
    expectedRemoteAllowOrigins: remoteAllowOrigins,
    launchIssues: issues
  };
}

async function waitForProcessExit(pid, timeoutMs = 8_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (!isAlive(pid)) return true;
    await sleep(250);
  }
  return !isAlive(pid);
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

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

async function cdpStatus(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/version`, {
      signal: AbortSignal.timeout(1500)
    });
    if (!response.ok) return { ok: false, error: `HTTP ${response.status}` };
    const data = await response.json();
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function cdpTabs(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`, {
      signal: AbortSignal.timeout(1500)
    });
    if (!response.ok) return { ok: false, tabs: [], error: `HTTP ${response.status}` };
    return { ok: true, tabs: await response.json(), error: null };
  } catch (error) {
    return { ok: false, tabs: [], error: error.message };
  }
}

async function activateTab(port, tabId) {
  const response = await fetch(`http://127.0.0.1:${port}/json/activate/${tabId}`, {
    signal: AbortSignal.timeout(1500)
  });
  return response.ok;
}

function hostnameFor(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function platformDomains(source, url) {
  const host = hostnameFor(url);
  if (source === "猎聘" || /(^|\.)liepin\.com$/i.test(host)) {
    return new Set(["liepin.com", "www.liepin.com", "passport.liepin.com", "m.liepin.com"]);
  }
  return host ? new Set([host]) : new Set();
}

function sameSite(left, right, source) {
  const leftHost = hostnameFor(left);
  return Boolean(leftHost && platformDomains(source, right).has(leftHost));
}

function isBossTarget(source, url) {
  return source === "BOSS直聘" || /(^|\.)zhipin\.com$/i.test(hostnameFor(url));
}

function pageTabs(tabs) {
  return tabs.filter((tab) => tab.type === "page");
}

function tabSnapshot(tab) {
  return {
    title: tab.title || "",
    url: tab.url || ""
  };
}

async function waitForSiteTab(port, url, source, timeoutMs = platformOpenWaitMs) {
  const observedTabs = new Map();
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const tabResult = await cdpTabs(port);
    if (!tabResult.ok) return { matchingTab: null, visibleTabs: [], observedTabs: [], elapsedMs: Date.now() - start, readError: tabResult.error };
    const tabs = pageTabs(tabResult.tabs);
    for (const tab of tabs) observedTabs.set(tab.id, tabSnapshot(tab));

    const matchingTab = tabs.find((tab) => sameSite(tab.url, url, source));
    if (matchingTab?.webSocketDebuggerUrl) {
      return {
        matchingTab,
        visibleTabs: tabs.map(tabSnapshot),
        observedTabs: Array.from(observedTabs.values()),
        elapsedMs: Date.now() - start
      };
    }

    await sleep(platformOpenPollMs);
  }

  const tabResult = await cdpTabs(port);
  if (!tabResult.ok) return { matchingTab: null, visibleTabs: [], observedTabs: Array.from(observedTabs.values()), elapsedMs: Date.now() - start, readError: tabResult.error };
  const tabs = pageTabs(tabResult.tabs);
  for (const tab of tabs) observedTabs.set(tab.id, tabSnapshot(tab));
  return {
    matchingTab: null,
    visibleTabs: tabs.map(tabSnapshot),
    observedTabs: Array.from(observedTabs.values()),
    elapsedMs: Date.now() - start
  };
}

async function focusExistingBrowserTab(port, url, options = {}) {
  const { activateExisting = true, source = "" } = options;
  const status = await cdpStatus(port);
  if (!status.ok) return { reuseState: "unknown_cdp", platformVisible: false, fallbackReason: status.error || "CDP unavailable", visibleTabs: [] };

  const tabResult = await cdpTabs(port);
  if (!tabResult.ok) return { reuseState: "unknown_tab_read", platformVisible: false, fallbackReason: tabResult.error, visibleTabs: [] };
  const tabs = pageTabs(tabResult.tabs);
  const matchingTab = tabs.find((tab) => sameSite(tab.url, url, source));
  if (!matchingTab) {
    const blankTab = tabs.find((tab) => /^(?:about:blank|chrome:\/\/newtab\/?)$/i.test(tab.url || ""));
    return { reuseState: blankTab ? "unknown_blank_tab" : "confirmed_absent", platformVisible: false, fallbackReason: blankTab ? "检测到 blank 标签页，不能据此判断原会话不存在" : "已确认未检测到平台标签页", visibleTabs: tabs.map(tabSnapshot) };
  }

  if (activateExisting) {
    try {
      const activated = await activateTab(port, matchingTab.id);
      if (!activated) return { reuseState: "activation_failed", tabId: matchingTab.id, reusedExistingSite: true, navigatedByCdp: false, activatedByCdp: false, platformVisible: true, fallbackReason: "现有平台标签页置前失败，已保留原标签", visibleTabs: tabs.map(tabSnapshot) };
    } catch (error) {
      return { reuseState: "activation_failed", tabId: matchingTab.id, reusedExistingSite: true, navigatedByCdp: false, activatedByCdp: false, platformVisible: true, fallbackReason: `现有平台标签页置前失败：${error.message}`, visibleTabs: tabs.map(tabSnapshot) };
    }
  }

  return {
    reuseState: "reused",
    tabId: matchingTab.id,
    reusedExistingSite: true,
    navigatedByCdp: false,
    activatedByCdp: Boolean(activateExisting),
    platformVisible: true,
    visibleTabs: tabs.map(tabSnapshot)
  };
}

async function waitForCdp(port, timeoutMs = 10_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const status = await cdpStatus(port);
    if (status.ok) return status;
    await sleep(300);
  }
  return cdpStatus(port);
}

function loginUrlFor(config, source) {
  return config.loginUrls?.[source] || config.loginUrls?.["BOSS直聘"] || "https://www.zhipin.com/";
}

function bossSafeHandoffDetails(targetUrl) {
  const homeUrl = "https://www.zhipin.com/";
  let searchKeyword = "";
  let cityCode = "";
  let directUrlIsSearch = false;
  try {
    const parsed = new URL(targetUrl);
    if (/(^|\.)zhipin\.com$/i.test(parsed.hostname.replace(/^www\./, ""))) {
      searchKeyword = parsed.searchParams.get("query") || "";
      cityCode = parsed.searchParams.get("city") || "";
      directUrlIsSearch = Boolean(searchKeyword || /\/web\/geek\/jobs?/.test(parsed.pathname) || /\/zhaopin\//.test(parsed.pathname));
    }
  } catch {
    // Keep the handoff page useful even if a caller passes a non-standard URL.
  }
  return {
    homeUrl,
    searchKeyword,
    cityCode,
    targetUrl,
    directUrlIsSearch
  };
}

function profileDirFor(config, args) {
  return args.profile || resolve(projectRoot, config.profileDir || ".career-browser-profile");
}

function bossProfileDirFor(config, args) {
  if (args.profile) return resolve(args.profile);
  return resolve(projectRoot, config.bossProfileDir || ".career-boss-profile");
}

function htmlEscape(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function writeBossHandoffPage(targetUrl, profileDir) {
  const handoff = bossSafeHandoffDetails(targetUrl);
  const lowFrequencyWorkcardBlock = existsSync(bossLowFrequencyWorkcardPath)
    ? `<details open>
      <summary>本地低频作业卡</summary>
      <p>如果你要补岗位样本，先打开本地作业卡；它只显示一个当前入口、站内搜索关键词和冷却计时，不会访问 BOSS。</p>
      <p><a class="button secondary" href="${pathToFileURL(bossLowFrequencyWorkcardPath).href}">打开低频作业卡</a></p>
    </details>`
    : `<details>
      <summary>本地低频作业卡</summary>
      <p>还未生成作业卡。回到终端运行 <code>npm run sampling:lowfreq</code> 后，再重新运行 <code>npm run auth:boss</code>。</p>
    </details>`;
  const searchBlock = handoff.searchKeyword
    ? `<label for="boss-keyword">第二步：站内搜索关键词</label>
    <div class="copy-row">
      <input id="boss-keyword" value="${htmlEscape(handoff.searchKeyword)}" readonly>
      <button type="button" data-copy="boss-keyword">复制关键词</button>
    </div>
    <p>等首页稳定、登录态正常后，在 BOSS 页面自己的搜索框里粘贴这个关键词再搜索。${handoff.cityCode ? `城市码仅作记录：<code>${htmlEscape(handoff.cityCode)}</code>。` : ""}</p>`
    : `<p>如果你要查公司或岗位，不要从外部直接打开搜索 URL；先进入首页，再在 BOSS 站内搜索框输入公司名、岗位词或行业词。</p>`;
  const referenceBlock = handoff.directUrlIsSearch
    ? `<details>
      <summary>原始搜索 URL（只作记录，不建议直接粘贴打开）</summary>
      <p><code>${htmlEscape(handoff.targetUrl)}</code></p>
    </details>`
    : "";
  mkdirSync(dirname(bossHandoffPath), { recursive: true });
  writeFileSync(bossHandoffPath, `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>BOSS 登录安全入口</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; color: #1f2937; background: #f8fafc; }
    main { max-width: 820px; margin: 7vh auto; padding: 32px; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; }
    h1 { font-size: 22px; margin: 0 0 12px; }
    p { line-height: 1.7; margin: 10px 0; }
    label { display: block; margin-top: 18px; font-weight: 600; }
    input { box-sizing: border-box; width: 100%; margin-top: 8px; padding: 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 15px; }
    button, a.button { display: inline-block; margin-top: 8px; margin-right: 8px; padding: 11px 16px; border-radius: 8px; border: 0; background: #111827; color: #fff; text-decoration: none; font-size: 14px; cursor: pointer; white-space: nowrap; }
    a.secondary { background: #4b5563; }
    .copy-row { display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: end; }
    .warning { padding: 12px 14px; border: 1px solid #f59e0b; border-radius: 8px; background: #fffbeb; color: #78350f; }
    .status { min-height: 22px; color: #166534; font-size: 14px; }
    code { background: #f3f4f6; padding: 2px 5px; border-radius: 4px; }
    details { margin-top: 16px; padding: 12px 14px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb; }
    summary { cursor: pointer; font-weight: 600; }
    @media (max-width: 680px) {
      main { margin: 0; min-height: 100vh; border-radius: 0; border-left: 0; border-right: 0; }
      .copy-row { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main>
    <h1>BOSS 登录安全入口</h1>
    <p>当前 profile：<code>${htmlEscape(profileDir)}</code>。</p>
    <p class="warning">如果 BOSS 一打开就跳回 <code>about:blank</code>，不要连续刷新，也不要直接粘贴带 query 的搜索 URL。先只进首页，等登录态稳定后再在站内搜索。</p>
    <p>这个本地页不会自动跳转，不会通过 CDP 控制浏览器，也不会把 BOSS 搜索链接放进启动参数。</p>
    <p>确认浏览器顶部没有 <code>--no-sandbox</code> 提示后，按下面顺序操作。</p>
    <label for="boss-home">第一步：BOSS 首页</label>
    <div class="copy-row">
      <input id="boss-home" value="${htmlEscape(handoff.homeUrl)}" readonly>
      <button type="button" data-copy="boss-home">复制首页</button>
    </div>
    ${searchBlock}
    ${lowFrequencyWorkcardBlock}
    ${referenceBlock}
    <p class="status" id="copy-status"></p>
  </main>
  <script>
    const status = document.getElementById("copy-status");
    async function copyInput(id) {
      const input = document.getElementById(id);
      input.focus();
      input.select();
      try {
        await navigator.clipboard.writeText(input.value);
        status.textContent = id === "boss-home"
          ? "已复制首页。请粘贴到当前正常 Chrome 窗口地址栏并回车。"
          : "已复制关键词。请在 BOSS 站内搜索框粘贴。";
      } catch {
        document.execCommand("copy");
        status.textContent = "已选中内容。若未复制成功，请按 Cmd+C。";
      }
    }
    for (const button of document.querySelectorAll("[data-copy]")) {
      button.addEventListener("click", () => copyInput(button.dataset.copy));
    }
  </script>
</body>
</html>
`, "utf8");
  return pathToFileURL(bossHandoffPath).href;
}

function bossHandoffUrl() {
  return pathToFileURL(bossHandoffPath).href;
}

function bossHumanLaunchPlan(profileDir, targetUrl, options = {}) {
  const handoff = bossSafeHandoffDetails(targetUrl);
  const startUrl = options.writeHandoff === false
    ? bossHandoffUrl()
    : writeBossHandoffPage(targetUrl, profileDir);
  const launchArgs = [
    `--user-data-dir=${profileDir}`,
    "--profile-directory=Default",
    "--new-window",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-session-crashed-bubble",
    startUrl
  ];
  return {
    targetUrl,
    safeHomeUrl: handoff.homeUrl,
    searchKeyword: handoff.searchKeyword,
    cityCode: handoff.cityCode,
    handoffMode: "home_then_in_site_search",
    startUrl,
    handoffPath: bossHandoffPath,
    directNavigation: false,
    bossLink: false,
    launchArgs
  };
}

function bossSystemChromeLaunchPlan(targetUrl, options = {}) {
  const profileLabel = "系统默认 Google Chrome profile（项目不创建、不接管、不调试）";
  const handoff = bossSafeHandoffDetails(targetUrl);
  const startUrl = options.writeHandoff === false
    ? bossHandoffUrl()
    : writeBossHandoffPage(targetUrl, profileLabel);
  const launchArgs = ["open", "-a", "Google Chrome", startUrl];
  return {
    targetUrl,
    safeHomeUrl: handoff.homeUrl,
    searchKeyword: handoff.searchKeyword,
    cityCode: handoff.cityCode,
    handoffMode: "home_then_in_site_search",
    startUrl,
    handoffPath: bossHandoffPath,
    directNavigation: false,
    bossLink: false,
    usesProjectProfile: false,
    launchArgs
  };
}

function bossHandoffCooldownStatus(now = Date.now()) {
  const state = readOptionalJsonSync(bossHandoffStatePath, {});
  const lastOpenedMs = Date.parse(state.lastOpenedAt || "");
  if (!Number.isFinite(lastOpenedMs)) {
    return {
      allowed: true,
      remainingMs: 0,
      lastOpenedAt: "",
      state
    };
  }

  const elapsedMs = now - lastOpenedMs;
  const remainingMs = Math.max(0, bossHandoffOpenCooldownMs - elapsedMs);
  return {
    allowed: remainingMs <= 0,
    remainingMs,
    lastOpenedAt: state.lastOpenedAt || "",
    state
  };
}

function openBossHandoffInSystemChrome(url, dryRun = false, options = {}) {
  const launchPlan = bossSystemChromeLaunchPlan(url, {
    writeHandoff: !dryRun
  });
  const cooldown = bossHandoffCooldownStatus();
  if (dryRun) {
    console.log(JSON.stringify({
      dryRun: true,
      mode: "boss_system_chrome_handoff",
      url,
      safeHomeUrl: launchPlan.safeHomeUrl,
      searchKeyword: launchPlan.searchKeyword,
      cityCode: launchPlan.cityCode,
      handoffMode: launchPlan.handoffMode,
      startUrl: launchPlan.startUrl,
      handoffPath: launchPlan.handoffPath,
      directNavigation: false,
      bossLink: false,
      usesProjectProfile: false,
      launcher: "open -a Google Chrome",
      launchArgs: launchPlan.launchArgs,
      remoteDebuggingPort: false,
      handoffOpenCooldownMs: bossHandoffOpenCooldownMs,
      cooldownAllowedNow: cooldown.allowed,
      cooldownRemainingMs: cooldown.remainingMs
    }, null, 2));
    return launchPlan;
  }

  if (!options.forceOpen && !cooldown.allowed) {
    appendBossAudit({
      action: "boss_handoff_open_skipped",
      reason: "cooldown",
      targetUrl: url,
      startUrl: launchPlan.startUrl,
      handoffPath: launchPlan.handoffPath,
      remainingMs: cooldown.remainingMs,
      lastOpenedAt: cooldown.lastOpenedAt
    });
    return {
      ...launchPlan,
      opened: false,
      skippedOpen: true,
      skipReason: "cooldown",
      cooldownRemainingMs: cooldown.remainingMs,
      lastOpenedAt: cooldown.lastOpenedAt
    };
  }

  execFileSync("open", ["-a", "Google Chrome", launchPlan.startUrl], {
    cwd: projectRoot,
    timeout: 5000
  });
  const openedAt = new Date().toISOString();
  writeJsonSync(bossHandoffStatePath, {
    lastOpenedAt: openedAt,
    targetUrl: url,
    startUrl: launchPlan.startUrl,
    handoffPath: launchPlan.handoffPath,
    cooldownMs: bossHandoffOpenCooldownMs
  });
  appendBossAudit({
    action: "boss_handoff_opened",
    targetUrl: url,
    startUrl: launchPlan.startUrl,
    handoffPath: launchPlan.handoffPath,
    cooldownMs: bossHandoffOpenCooldownMs,
    forceOpen: Boolean(options.forceOpen)
  });
  return {
    ...launchPlan,
    opened: true,
    skippedOpen: false,
    cooldownRemainingMs: 0,
    openedAt
  };
}

function bossHumanLaunchArgs(profileDir, url, options = {}) {
  return bossHumanLaunchPlan(profileDir, url, options).launchArgs;
}

function bossHumanLauncherLabel() {
  return chromeExecutable();
}

function openUrlWithProfile(profileDir, url, dryRun = false) {
  if (dryRun) {
    console.log(JSON.stringify({ dryRun: true, profileDir, url }, null, 2));
    return;
  }

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

function openUrlWithHumanProfile(profileDir, url, dryRun = false, options = {}) {
  const launchPlan = bossHumanLaunchPlan(profileDir, url, {
    writeHandoff: !dryRun
  });
  if (dryRun) {
    console.log(JSON.stringify({
      dryRun: true,
      mode: "boss_isolated_profile_handoff",
      profileDir,
      url,
      startUrl: launchPlan.startUrl,
      handoffPath: launchPlan.handoffPath,
      directNavigation: false,
      bossLink: false,
      usesProjectProfile: true,
      launcher: bossHumanLauncherLabel(),
      launchArgs: launchPlan.launchArgs,
      remoteDebuggingPort: false
    }, null, 2));
    return null;
  }

  const child = spawn(chromeExecutable(), launchPlan.launchArgs, {
    cwd: projectRoot,
    detached: true,
    stdio: [
      "ignore",
      openSync(bossLogPath, "a"),
      openSync(bossLogPath, "a")
    ]
  });
  child.unref();
  writeFileSync(bossPidPath, String(child.pid));
  return child.pid;
}

async function waitForMainProjectChromePids(profileDir, baselinePids = [], timeoutMs = 8_000) {
  const baseline = new Set(baselinePids);
  const start = Date.now();
  let latest = [];
  while (Date.now() - start < timeoutMs) {
    latest = mainProjectChromePidsByProfile(profileDir).filter((pid) => isAlive(pid));
    const newPids = latest.filter((pid) => !baseline.has(pid));
    if (newPids.length) return newPids;
    if (latest.length) return latest;
    await sleep(500);
  }
  return latest;
}

async function openUrl(profileDir, port, url, options = {}) {
  const { dryRun = false, allowBrowserOpen = true, activateExisting = true, source = "" } = options;
  if (dryRun) {
    console.log(JSON.stringify({ dryRun: true, profileDir, url, allowBrowserOpen, activateExisting }, null, 2));
    return { openedBy: "dry-run" };
  }

  const focused = await focusExistingBrowserTab(port, url, { activateExisting, source });
  if (focused.reuseState === "reused") return { openedBy: "existing", ...focused };
  if (!allowBrowserOpen || focused.reuseState !== "confirmed_absent") {
    return {
      openedBy: "manual_required",
      navigatedByCdp: false,
      platformVisible: focused.platformVisible,
      manualUrl: url,
      fallbackReason: focused.fallbackReason,
      visibleTabs: focused.visibleTabs,
      ...focused
    };
  }

  // Browser dispatch is only permitted after CDP positively confirms absence.
  openUrlWithProfile(profileDir, url, false);
  const settled = await waitForSiteTab(port, url, source);
    const matchingTab = settled.matchingTab;
    if (matchingTab) {
      await activateTab(port, matchingTab.id).catch(() => false);
      return {
        openedBy: "profile",
        tabId: matchingTab.id,
        reusedExistingSite: false,
        navigatedByCdp: false,
        platformVisible: true,
        openedWithBrowserDispatch: true,
        fallbackReason: focused.fallbackReason,
        waitMs: settled.elapsedMs,
        visibleTabs: settled.visibleTabs
      };
    }

    return {
      openedBy: "profile",
      navigatedByCdp: false,
      platformVisible: false,
      openedWithBrowserDispatch: true,
      fallbackReason: focused.fallbackReason,
      waitMs: settled.elapsedMs,
      visibleTabs: settled.visibleTabs,
      observedTabs: settled.observedTabs
    };
}

async function startDaemon(args) {
  const config = readConfig();
  const port = args.port || config.cdpPort || 9333;
  const profileDir = profileDirFor(config, args);
  const bossProfileDir = bossProfileDirFor(config, {});
  const source = args.source || config.defaultLoginSource || "BOSS直聘";
  const loginUrl = loginUrlFor(config, source);
  const bossTarget = isBossTarget(source, loginUrl);
  const initialUrl = args.openLogin && !bossTarget ? loginUrl : (config.startUrl || "chrome://newtab/");
  const remoteAllowOrigins = remoteAllowOriginsFor(config, args);
  const pid = readPid();
  const bossPid = cleanupStalePid(bossPidPath);
  const profilePids = mainProjectChromePidsByProfile(profileDir).filter((item) => isAlive(item));

  if (bossPid) {
    console.log(`BOSS人工浏览器正在运行：pid ${bossPid}`);
    console.log(`BOSS Profile：${bossProfileDir}`);
    console.log("为避免误把 BOSS 放回协议浏览器，本次不启动 9333 协议浏览器。");
    console.log("需要重新启用 9333 时，先执行 npm run auth:stop 关闭项目浏览器，再执行 npm run auth:browser。");
    return { started: false, ready: false, retainedExisting: true, reason: "boss_browser_active" };
  }

  if (isAlive(pid)) {
    console.log(`登录态浏览器已在运行：pid ${pid}`);
    console.log(`CDP：http://127.0.0.1:${port}`);
    console.log("未在 9333 浏览器中打开 BOSS；如需访问 BOSS，执行 npm run auth:boss 切到普通 Chrome。");
    const diagnostics = launchDiagnostics(pid, config, args);
    if (diagnostics.launchIssues.length) {
      console.log("启动参数提示：");
      for (const issue of diagnostics.launchIssues) console.log(`- ${issue}`);
      console.log("默认保留当前浏览器；如需变更生命周期，必须由用户显式执行 npm run auth:restart。");
    }
    const status = await cdpStatus(port);
    return { started: false, ready: status.ok, retainedExisting: true, reason: status.ok ? "pid_alive" : "pid_alive_cdp_unavailable" };
  }

  if (profilePids.length) {
    console.log(`检测到同一登录 profile 的 Chrome 主进程：pid ${profilePids.join(", ")}`);
    console.log("PID 记录缺失不等于会话不存在；默认保留现有 profile，不派生浏览器。请人工确认窗口或连接状态后再操作。");
    return { started: false, ready: false, retainedExisting: true, reason: "profile_process_detected", profilePids };
  }

  mkdirSync(profileDir, { recursive: true });

  const childArgs = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-sync",
    "--disable-session-crashed-bubble",
    initialUrl
  ];
  if (remoteAllowOrigins) {
    childArgs.splice(childArgs.length - 1, 0, `--remote-allow-origins=${remoteAllowOrigins}`);
  }

  const child = spawn(chromeExecutable(), childArgs, {
    cwd: projectRoot,
    detached: true,
    stdio: [
      "ignore",
      openSync(logPath, "a"),
      openSync(logPath, "a")
    ]
  });
  child.unref();
  writeFileSync(pidPath, String(child.pid));
  const status = await waitForCdp(port);

  console.log(`登录态浏览器已后台启动：pid ${child.pid}`);
  console.log(`CDP：http://127.0.0.1:${port}`);
  console.log(`Profile：${profileDir}`);
  console.log(`Start URL：${initialUrl}`);
  if (args.openLogin && bossTarget) {
    console.log("BOSS人工安全模式：已忽略 --open-login，避免在 9333 协议浏览器中打开 BOSS 后返回 blank。");
    console.log(`请使用 npm run auth:boss 打开无 CDP 的普通 Chrome：${loginUrl}`);
  }
  if (remoteAllowOrigins) console.log(`Remote allow origins：${remoteAllowOrigins}`);
  console.log(`CDP status：${status.ok ? "ok" : status.error}`);
  console.log(`日志：${logPath}`);
  console.log("浏览器已启动。需要访问 BOSS 时，执行 npm run auth:boss 切到普通 Chrome。");
  return { started: true, ready: status.ok, retainedExisting: false, reason: status.ok ? "started" : "started_cdp_unavailable", pid: child.pid };
}

async function stopBrowser(args = {}) {
  const config = readConfig();
  const port = args.port || config.cdpPort || 9333;
  const profileDir = profileDirFor(config, args);
  const pid = readPid(pidPath);
  const pids = Array.from(new Set([
    ...(isAlive(pid) ? [pid] : []),
    ...projectCdpPids(port, profileDir),
    ...projectChromePidsByProfile(profileDir)
  ]));

  if (existsSync(pidPath)) unlinkSync(pidPath);
  if (!pids.length) {
    console.log("登录态浏览器未运行。");
    return [];
  }
  return terminatePids(pids, "登录态浏览器");
}

async function stopBossHumanBrowser() {
  const pid = readPid(bossPidPath);
  const config = readConfig();
  const profileDir = bossProfileDirFor(config, {});
  const pids = Array.from(new Set([
    ...(isAlive(pid) ? [pid] : []),
    ...projectChromePidsByProfile(profileDir)
  ]));

  if (existsSync(bossPidPath)) unlinkSync(bossPidPath);
  if (!pids.length) {
    console.log("BOSS人工浏览器未运行。");
    return [];
  }
  return terminatePids(pids, "BOSS人工浏览器");
}

async function stopAllBrowsers() {
  const stopped = [];
  stopped.push(...await stopBrowser());
  stopped.push(...await stopBossHumanBrowser());
  return stopped;
}

async function restartDaemon(args) {
  const stoppedPids = await stopAllBrowsers();
  for (const stoppedPid of stoppedPids) {
    const exited = await waitForProcessExit(stoppedPid);
    if (!exited) {
      throw new Error(`登录态浏览器 pid ${stoppedPid} 未在预期时间内退出，请手动关闭后再重试。`);
    }
  }
  await startDaemon({ ...args, openLogin: false });
}

async function openBossHumanMode(args, url) {
  const config = readConfig();
  const port = args.port || config.cdpPort || 9333;
  const cdpProfileDir = profileDirFor(config, {});
  const profileDir = bossProfileDirFor(config, args);
  const useIsolatedBossProfile = Boolean(args.isolatedBossProfile || args.profile);
  const cdpPid = readPid(pidPath);
  const activeCdpPids = Array.from(new Set([
    ...(isAlive(cdpPid) ? [cdpPid] : []),
    ...projectCdpPids(port, cdpProfileDir)
  ]));
  const retentionPlan = defaultAuthBrowserPlan({
    command: "open",
    bossTarget: true,
    daemonAlive: activeCdpPids.length > 0
  });

  if (args.dryRun) {
    const launchPlan = useIsolatedBossProfile
      ? bossHumanLaunchPlan(profileDir, url, { writeHandoff: false })
      : bossSystemChromeLaunchPlan(url, { writeHandoff: false });
    const cooldown = bossHandoffCooldownStatus();
    console.log(JSON.stringify({
      dryRun: true,
      mode: useIsolatedBossProfile ? "boss_isolated_profile_handoff" : "boss_system_chrome_handoff",
      url,
      safeHomeUrl: launchPlan.safeHomeUrl,
      searchKeyword: launchPlan.searchKeyword,
      cityCode: launchPlan.cityCode,
      handoffMode: launchPlan.handoffMode,
      startUrl: launchPlan.startUrl,
      profileDir: useIsolatedBossProfile ? profileDir : null,
      cdpProfileDir,
      cdpPortStoppedFirst: false,
      cdpPortRetained: activeCdpPids.length > 0,
      activeCdpPids,
      handoffPath: launchPlan.handoffPath,
      directNavigation: false,
      bossLink: false,
      usesProjectProfile: useIsolatedBossProfile,
      launcher: useIsolatedBossProfile
        ? bossHumanLauncherLabel()
        : (args.launchHandoff ? "open -a Google Chrome" : "manual_open_handoff_file"),
      launchArgs: useIsolatedBossProfile || args.launchHandoff ? launchPlan.launchArgs : [],
      manualOpenPath: !useIsolatedBossProfile && !args.launchHandoff ? launchPlan.handoffPath : "",
      remoteDebuggingPort: false,
      handoffOpenCooldownMs: bossHandoffOpenCooldownMs,
      cooldownAllowedNow: cooldown.allowed,
      cooldownRemainingMs: cooldown.remainingMs,
      lastHandoffOpenedAt: cooldown.lastOpenedAt
    }, null, 2));
    return;
  }

  if (activeCdpPids.length) {
    console.log(`检测到 9333 协议浏览器正在运行：pid ${activeCdpPids.join(", ")}`);
    console.log("默认保留该浏览器；about:blank 或自动化风险提示不会触发停止、重启或清理 Cookie。");
  }

  const riskyAutomationEntries = automationChromeEntries()
    .filter((entry) => !entry.command.includes(basename(profileDir)));
  if (riskyAutomationEntries.length) {
    console.log("检测到其他自动化/调试 Chrome 窗口仍在运行：");
    for (const entry of riskyAutomationEntries.slice(0, 6)) {
      const flags = [
        entry.command.includes("--no-sandbox") ? "--no-sandbox" : "",
        entry.command.includes("--remote-debugging-port=") ? "--remote-debugging-port" : "",
        entry.command.includes("--enable-automation") ? "--enable-automation" : ""
      ].filter(Boolean).join(", ");
      console.log(`- pid ${entry.pid}${flags ? ` (${flags})` : ""}`);
    }
    console.log("不要在这些窗口里访问 BOSS；本命令默认只生成本地安全入口页，不自动打开浏览器。");
  }

  cleanupStalePid(bossPidPath);
  let existingBossPids = mainProjectChromePidsByProfile(profileDir);
  if (existingBossPids.length) {
    console.log(`检测到旧 BOSS profile 窗口：pid ${existingBossPids.join(", ")}`);
    console.log("默认保留旧 BOSS profile 窗口；about:blank 不会触发自动关闭或重新启动。");
  }

  if (!useIsolatedBossProfile) {
    const launchPlan = args.launchHandoff
      ? openBossHandoffInSystemChrome(url, false, { forceOpen: args.forceOpen })
      : bossSystemChromeLaunchPlan(url, { writeHandoff: true });
    appendBossAudit({
      action: args.launchHandoff ? "boss_handoff_launch_command" : "boss_handoff_generated",
      targetUrl: url,
      startUrl: launchPlan.startUrl,
      handoffPath: launchPlan.handoffPath,
      opened: Boolean(launchPlan.opened),
      skippedOpen: Boolean(launchPlan.skippedOpen),
      skipReason: launchPlan.skipReason || "",
      note: "handoff_only_not_job_collection"
    });
    if (args.launchHandoff && launchPlan.skippedOpen) {
      console.log("BOSS人工安全入口：已生成本地安全页，但本次没有再次打开 Chrome，因为仍在 30 分钟冷却期。");
      console.log(`上次打开：${launchPlan.lastOpenedAt || "未知"}`);
      console.log(`剩余冷却：约 ${Math.ceil((launchPlan.cooldownRemainingMs || 0) / 60_000)} 分钟`);
    } else {
      console.log(args.launchHandoff
        ? "BOSS人工安全入口：已交给系统 Google Chrome 打开本地安全页。"
        : "BOSS人工安全入口：已生成本地安全页，默认不自动打开任何浏览器。");
    }
    console.log(`目标：${url}`);
    console.log(`启动页：${launchPlan.startUrl}`);
    if (launchPlan.handoffPath) console.log(`安全入口页：${launchPlan.handoffPath}`);
    console.log(`CDP Profile：${cdpProfileDir}`);
    console.log("模式：系统真实 Chrome profile，无 9333、无 CDP、无项目 user-data-dir、无协议置前/跳转/刷新。");
    console.log(`保留策略：${retentionPlan.actions.join("、")}；不停止、不重启、不清理 Cookie。`);
    console.log("默认安全模式：只生成本地安全入口页，不在命令行直接访问 zhipin.com，也不自动唤起 Chrome；请在正常 Chrome 里手动打开入口页，先复制首页进入 BOSS，再在站内搜索框输入关键词。");
    if (!args.launchHandoff) console.log("如需打开本地入口页，可显式执行 npm run auth:boss -- --launch-handoff；该动作有 30 分钟冷却，避免重复打开大量入口页。");
    if (args.launchHandoff) console.log("注意：打开安全入口页只代表登录/人工搜索交接，不代表已经采集到岗位；岗位采集必须以后续收件箱导入或 raw 原文新增为准。");
    if (launchPlan.searchKeyword) console.log(`站内搜索关键词：${launchPlan.searchKeyword}`);
    console.log("注意：不要在 Career Auth Browser / 9333 / Codex 内置浏览器 / 顶部提示 --no-sandbox 的窗口里访问 BOSS。");
    console.log("如果页面要求登录或验证，请手动完成；后续岗位文本用 npm run import:manual 导入。");
    console.log("如确实需要独立项目 profile，可执行 npm run auth:boss -- --isolated-boss-profile；当前默认不再使用该方式。");
    console.log(`CDP：http://127.0.0.1:${port} 当前不会用于 BOSS。`);
    return;
  }

  mkdirSync(profileDir, { recursive: true });
  const launchPlan = bossHumanLaunchPlan(profileDir, url, {
    writeHandoff: true
  });
  const launchPid = openUrlWithHumanProfile(profileDir, url, false);
  const currentBossPids = await waitForMainProjectChromePids(profileDir, existingBossPids);
  const stablePid = currentBossPids[0] || launchPid;
  if (stablePid) writeFileSync(bossPidPath, String(stablePid));
  console.log(`BOSS人工安全浏览器：${existingBossPids.length ? `复用/唤起 pid ${existingBossPids.join(", ")}` : `pid ${stablePid || launchPid}`}`);
  console.log(`目标：${url}`);
  console.log(`启动页：${launchPlan.startUrl}`);
  if (launchPlan.handoffPath) console.log(`安全入口页：${launchPlan.handoffPath}`);
  console.log(`Profile：${profileDir}`);
  console.log(`CDP Profile：${cdpProfileDir}`);
  console.log("模式：普通 Chrome 可执行文件直启，独立 BOSS profile，无 9333、无 CDP、无协议置前/跳转/刷新。");
  console.log("提示：这是显式启用的独立 profile 模式；若进入 BOSS 后仍返回 blank，请改用默认 npm run auth:boss 的系统 Chrome 模式。");
  console.log("默认安全模式：先打开本地安全入口页，不在启动命令里直接访问 zhipin.com，也不提供默认跳转；请先复制首页进入 BOSS，再在站内搜索框输入关键词。");
  if (launchPlan.searchKeyword) console.log(`站内搜索关键词：${launchPlan.searchKeyword}`);
  console.log("注意：不要在 Career Auth Browser / 9333 窗口里手动输入 BOSS 地址；只使用这次打开的 BOSS 人工窗口。");
  if (!currentBossPids.length && !existingBossPids.length) {
    console.log("警告：未检测到独立 BOSS profile 的 Chrome 主进程。若仍看到 about:blank 或 --no-sandbox 提示，说明打开动作被其他浏览器接管，请先完全退出该窗口后重试 npm run auth:boss。");
  }
  console.log("如果页面要求登录或验证，请手动完成；后续岗位文本用 npm run import:manual 导入。");
  console.log(`如需恢复 9333 协议浏览器，先关闭该窗口或执行 npm run auth:stop，再执行 npm run auth:browser。`);
  console.log(`CDP：http://127.0.0.1:${port} 当前不会用于 BOSS。`);
}

async function openPlatform(args) {
  const config = readConfig();
  const port = args.port || config.cdpPort || 9333;
  const profileDir = profileDirFor(config, args);
  const source = args.source || config.defaultLoginSource || "BOSS直聘";
  const url = args.url || loginUrlFor(config, source);
  const pid = readPid();
  const bossTarget = isBossTarget(source, url);

  if (bossTarget) {
    await openBossHumanMode(args, url);
    return;
  }

  if (args.dryRun) {
    await openUrl(profileDir, port, url, {
      dryRun: true,
      allowBrowserOpen: true,
      activateExisting: true,
      source
    });
    return;
  }

  const profilePids = mainProjectChromePidsByProfile(profileDir).filter((item) => isAlive(item));
  let retainedProfileWithoutPid = false;
  if (!isAlive(pid) && profilePids.length) {
    retainedProfileWithoutPid = true;
    console.log(`检测到同一登录 profile 的 Chrome 主进程：pid ${profilePids.join(", ")}`);
    console.log("PID 记录缺失不等于会话不存在；本次保留现场，不派生浏览器或平台页。");
  } else if (!isAlive(pid)) {
    console.log("登录态浏览器未运行，先启动空白登录态浏览器。");
    const startResult = await startDaemon({ ...args, openLogin: false });
    if (!startResult?.ready) {
      console.log("启动未就绪或被保留策略拒绝；本次不继续打开平台页，请人工接管。");
      return { openedBy: "manual_required", reuseState: "startup_not_ready", platformVisible: false, fallbackReason: startResult?.reason || "startup_not_ready" };
    }
  } else {
    const diagnostics = launchDiagnostics(pid, config, args);
    if (diagnostics.launchIssues.length) {
      console.log("检测到登录态浏览器仍使用旧启动参数：");
      for (const issue of diagnostics.launchIssues) console.log(`- ${issue}`);
      console.log("默认保留当前浏览器；不会因这些诊断自动重启。需要变更生命周期时，请显式执行 npm run auth:restart。");
    }
  }

  const connectionState = retainedProfileWithoutPid ? "profile_process_detected" : "known";
  const retentionPlan = defaultAuthBrowserPlan({ command: "open", daemonAlive: isAlive(pid) || profilePids.length > 0, connectionState });
  const allowBrowserOpen = retentionPlan.allowBrowserOpen;
  const activateExisting = true;
  const result = await openUrl(profileDir, port, url, {
    dryRun: args.dryRun,
    allowBrowserOpen,
    activateExisting,
    source
  });
  if (!args.dryRun) {
    console.log(`登录态入口目标：${url}`);
    console.log(`Profile：${profileDir}`);
    const method =
      result.openedBy === "existing"
        ? (result.activatedByCdp ? "复用现有标签页并置前" : "只检测现有标签页，不通过协议置前")
        : result.openedBy === "manual_required"
          ? "安全模式：不自动新开平台页"
          : "交给 Chrome 自身打开";
    console.log(`处理方式：${method}`);
    if (result.reusedExistingSite && result.activatedByCdp) console.log("已检测到现有平台标签页，本次只置前，不重复刷新。");
    if (result.openedWithBrowserDispatch) console.log("未使用 CDP 强制导航，避免打开后被打回 about:blank。");
    if (result.platformVisible === false) {
      console.log("警告：未检测到平台标签页。为避免连续触发，本脚本不会自动重试。");
      if (result.visibleTabs?.length) {
        console.log("当前可见标签页：");
        for (const tab of result.visibleTabs) console.log(`- ${tab.title || "(无标题)"} ${tab.url}`);
      }
    }
    if (result.fallbackReason) console.log(`回退原因：${result.fallbackReason}`);
  }
  return result;
}

async function printStatus(args) {
  const config = readConfig();
  const port = args.port || config.cdpPort || 9333;
  const pid = readPid(pidPath);
  const bossPid = readPid(bossPidPath);
  const profileDir = resolve(projectRoot, config.profileDir || ".career-browser-profile");
  const bossProfileDir = bossProfileDirFor(config, {});
  const cdpPids = projectCdpPids(port, profileDir).filter((item) => isAlive(item));
  const profilePids = projectChromePidsByProfile(profileDir).filter((item) => isAlive(item));
  const bossProfilePids = projectChromePidsByProfile(bossProfileDir).filter((item) => isAlive(item));
  const automationEntries = automationChromeEntries();
  const status = await cdpStatus(port);
  const tabResult = await cdpTabs(port);
  const diagnostics = launchDiagnostics(pid, config, args);
  console.log(JSON.stringify({
    pid,
    processAlive: isAlive(pid),
    bossHumanPid: bossPid,
    bossHumanProcessAlive: isAlive(bossPid),
    cdpPort: port,
    cdpUrl: `http://127.0.0.1:${port}`,
    cdpOk: status.ok,
    browser: status.data?.Browser,
    webSocketDebuggerUrl: status.data?.webSocketDebuggerUrl,
    error: status.error,
    tabs: tabResult.tabs.map((tab) => ({
      type: tab.type,
      title: tab.title,
      url: tab.url
    })),
    tabReadError: tabResult.error,
    profileDir,
    bossProfileDir,
    cdpPids,
    profilePids,
    bossProfilePids,
    automationBrowserPids: automationEntries.map((entry) => entry.pid),
    automationBrowserRisks: automationEntries.map((entry) => ({
      pid: entry.pid,
      noSandbox: entry.command.includes("--no-sandbox"),
      remoteDebuggingPort: entry.command.includes("--remote-debugging-port="),
      enableAutomation: entry.command.includes("--enable-automation")
    })),
    bossHumanMode: "BOSS 默认只生成本地安全入口页，不自动打开浏览器、不创建项目 profile、不接入 CDP、不直开 zhipin.com；运行 npm run auth:boss 保留项目 9333 与旧项目 BOSS profile 窗口，不因 about:blank 自动停止、重启或清理 Cookie。需要脚本打开本地入口页时显式使用 npm run auth:boss -- --launch-handoff；需要独立项目 profile 时才使用 npm run auth:boss -- --isolated-boss-profile。",
    bossBlankRisk: cdpPids.length || automationEntries.some((entry) => entry.command.includes("--no-sandbox")) || tabResult.tabs.some((tab) => /zhipin\.com/.test(tab.url || ""))
      ? "不要在 9333/CDP/--no-sandbox/Career Auth Browser 窗口访问 BOSS；请运行 npm run auth:boss 生成本地安全入口页，再在正常系统 Chrome 中手动打开入口页，先只进入 BOSS 首页，页面稳定后再在站内搜索框输入关键词。"
      : "",
    expectedRemoteAllowOrigins: diagnostics.expectedRemoteAllowOrigins,
    launchIssues: diagnostics.launchIssues,
    launchCommand: diagnostics.launchCommand
  }, null, 2));
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(usage());
    return;
  }

  const transportConfigPath = process.env.AUTH_TRANSPORT_CONFIG_PATH || authConfigPath;
  const transport = readAuthTransport(transportConfigPath);
  console.log(JSON.stringify(nativeUiCheckHandoff({
    command: args.command,
    source: args.source,
    transport: transport.state === "configured" ? transport.transport : "unknown",
    url: args.url
  })));
  process.exitCode = 2;
  return;

  if (args.command === "run") await startDaemon(args);
  else if (args.command === "start") await startDaemon(args);
  else if (args.command === "open") await openPlatform(args);
  else if (args.command === "restart") await restartDaemon(args);
  else if (args.command === "status") await printStatus(args);
  else if (args.command === "check") await printStatus(args);
  else if (args.command === "stop") await stopAllBrowsers();
  else {
    console.log(usage());
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
