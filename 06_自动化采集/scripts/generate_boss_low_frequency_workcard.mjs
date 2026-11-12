#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const executionCsvPath = join(projectRoot, "01_行情收集/BOSS首批人工采样执行单.csv");
const inboxStatusCsvPath = join(projectRoot, "01_行情收集/BOSS首批人工采样收件箱质量预检.csv");
const inboxPath = join(projectRoot, "01_行情收集/BOSS首批人工采样收件箱.md");
const inboxStatusMdPath = join(projectRoot, "01_行情收集/BOSS首批人工采样收件箱质量预检.md");
const outputCsvPath = join(projectRoot, "01_行情收集/BOSS首页低频手动搜索作业卡.csv");
const outputMdPath = join(projectRoot, "01_行情收集/BOSS首页低频手动搜索作业卡.md");
const outputHtmlPath = join(projectRoot, "01_行情收集/BOSS首页低频手动搜索作业卡.html");

function usage() {
  return `Usage:
  npm run sampling:lowfreq
  npm run sampling:lowfreq -- --cooldown-min 10 --after-three-min 30

Purpose:
  Generate a one-task-at-a-time manual BOSS workcard. This command only reads
  and writes local files. It never opens, reads, refreshes, navigates, or
  controls BOSS pages.
`;
}

function parseArgs(argv) {
  const args = {
    cooldownMin: 10,
    afterThreeMin: 30,
    queueLimit: 12
  };
  for (let index = 2; index < argv.length; index += 1) {
    const key = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${key}`);
      return argv[index];
    };
    if (key === "--cooldown-min") args.cooldownMin = Number.parseInt(next(), 10);
    else if (key === "--after-three-min") args.afterThreeMin = Number.parseInt(next(), 10);
    else if (key === "--queue-limit") args.queueLimit = Number.parseInt(next(), 10);
    else if (key === "--help" || key === "-h") args.help = true;
    else throw new Error(`Unknown option: ${key}`);
  }
  if (!Number.isFinite(args.cooldownMin) || args.cooldownMin < 1) {
    throw new Error("--cooldown-min must be a positive number.");
  }
  if (!Number.isFinite(args.afterThreeMin) || args.afterThreeMin < args.cooldownMin) {
    throw new Error("--after-three-min must be greater than or equal to --cooldown-min.");
  }
  if (!Number.isFinite(args.queueLimit) || args.queueLimit < 1) {
    throw new Error("--queue-limit must be a positive number.");
  }
  return args;
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
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function csv(rows) {
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

function htmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function mdCell(value) {
  return String(value ?? "").replaceAll("|", "\\|").replace(/\s+/g, " ").trim();
}

function yes(value) {
  return /^是$/i.test(String(value || "").trim());
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

function taskKey(row) {
  return `${row.company || ""}::${row.role || ""}`;
}

function statusFor(row, statusByRank, statusByKey) {
  return statusByRank.get(String(row.rank || "")) || statusByKey.get(taskKey(row)) || {};
}

function taskStage(status) {
  if (yes(status.readyToImport)) return "已粘贴可导入";
  if (yes(status.pasted)) return "已粘贴需补字段";
  return "待低频采样";
}

function nextAction(row, status) {
  const stage = taskStage(status);
  if (stage === "已粘贴可导入") return "先运行 npm run import:inbox -- --refresh，导入后再继续下一个入口。";
  if (stage === "已粘贴需补字段") return `回到该入口补字段：${status.missingFields || "薪资、职责、要求、城市、经验、学历"}`;
  return `复制 BOSS 首页，页面稳定后在站内搜索框输入：${row.searchKeyword || `${row.company} ${row.role}`}`;
}

function rowWithStatus(row, status, args) {
  const stage = taskStage(status);
  return {
    rank: row.rank,
    company: row.company,
    role: row.role,
    route: row.route,
    segment: row.segment,
    roleFamily: row.roleFamily,
    city: row.city,
    salaryBand: row.salaryBand || "待BOSS样本校验",
    targetCopies: row.targetCopies,
    safeHomeUrl: row.safeHomeUrl || "https://www.zhipin.com/",
    searchKeyword: row.searchKeyword || `${row.company || ""} ${row.role || ""}`.trim(),
    stage,
    pasted: status.pasted || "否",
    readyToImport: status.readyToImport || "否",
    qualityScore: status.qualityScore || "0",
    estimatedJobs: status.estimatedJobs || "0",
    missingFields: status.missingFields || "",
    nextAction: nextAction(row, status),
    cooldownMin: args.cooldownMin,
    afterThreeMin: args.afterThreeMin
  };
}

function pickCurrentTask(rows) {
  return rows.find((row) => row.stage === "已粘贴可导入")
    || rows.find((row) => row.stage === "已粘贴需补字段")
    || rows.find((row) => row.stage === "待低频采样")
    || rows[0]
    || null;
}

function stageBadgeClass(stage) {
  if (stage === "已粘贴可导入") return "good";
  if (stage === "已粘贴需补字段") return "warn";
  return "neutral";
}

function fileHref(path) {
  return pathToFileURL(path).href;
}

function buildHtml({ rows, current, args }) {
  const queueRows = rows.slice(0, args.queueLimit).map((row) => {
    const isCurrent = current && row.rank === current.rank;
    return `<tr class="${isCurrent ? "current-row" : ""}">
      <td>${htmlEscape(row.rank)}</td>
      <td>${htmlEscape(row.company)}</td>
      <td>${htmlEscape(row.role)}</td>
      <td>${htmlEscape(row.salaryBand)}</td>
      <td><span class="badge ${stageBadgeClass(row.stage)}">${htmlEscape(row.stage)}</span></td>
      <td>${htmlEscape(row.missingFields || "-")}</td>
      <td><code>${htmlEscape(row.searchKeyword)}</code></td>
    </tr>`;
  }).join("\n");

  const currentBlock = current ? `<section class="hero">
    <div>
      <p class="eyebrow">当前只处理这一个入口</p>
      <h2>${htmlEscape(current.rank)}. ${htmlEscape(current.company)} / ${htmlEscape(current.role)}</h2>
      <p class="meta">${htmlEscape(current.segment || current.route || "AI销售采样")} · 薪资参考：${htmlEscape(current.salaryBand)} · 目标：${htmlEscape(current.targetCopies)} 条</p>
      <p><span class="badge ${stageBadgeClass(current.stage)}">${htmlEscape(current.stage)}</span></p>
    </div>
    <div class="next-action">${htmlEscape(current.nextAction)}</div>
  </section>

  <section class="grid">
    <div class="panel">
      <h3>第一步：复制首页</h3>
      <p>只复制首页，不复制搜索 URL。粘贴到普通 Chrome 地址栏，等登录态和页面稳定。</p>
      <div class="copy-row">
        <input id="boss-home" value="${htmlEscape(current.safeHomeUrl)}" readonly>
        <button data-copy="boss-home" type="button">复制首页</button>
      </div>
    </div>
    <div class="panel">
      <h3>第二步：复制关键词</h3>
      <p>在 BOSS 页面自己的搜索框里输入关键词。每次只做一个关键词。</p>
      <div class="copy-row">
        <input id="boss-keyword" value="${htmlEscape(current.searchKeyword)}" readonly>
        <button data-copy="boss-keyword" type="button">复制关键词</button>
      </div>
    </div>
  </section>` : `<section class="hero"><h2>暂无待处理入口</h2><p>请先运行 npm run sampling:first-execution。</p></section>`;

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>BOSS首页低频手动搜索作业卡</title>
  <style>
    :root { color-scheme: light; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f7f8fa; color: #1f2937; }
    main { max-width: 1120px; margin: 0 auto; padding: 28px 20px 44px; }
    header { display: flex; justify-content: space-between; gap: 20px; align-items: flex-start; margin-bottom: 18px; }
    h1 { margin: 0 0 8px; font-size: 26px; line-height: 1.2; }
    h2, h3 { margin: 0 0 10px; }
    p { margin: 8px 0; line-height: 1.65; }
    a { color: #0f766e; text-decoration: none; }
    .safety { max-width: 440px; padding: 12px 14px; border: 1px solid #f59e0b; background: #fffbeb; color: #78350f; border-radius: 8px; }
    .hero, .panel, .timer, .queue, .links { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 18px; }
    .hero { display: grid; grid-template-columns: 1.3fr 1fr; gap: 18px; margin-bottom: 14px; align-items: stretch; }
    .eyebrow { margin: 0 0 6px; color: #64748b; font-size: 13px; }
    .meta { color: #4b5563; }
    .next-action { display: flex; align-items: center; padding: 14px; border-radius: 8px; background: #f0fdfa; color: #134e4a; font-weight: 600; line-height: 1.6; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
    .copy-row { display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: center; }
    input { box-sizing: border-box; width: 100%; min-width: 0; padding: 12px; border: 1px solid #d1d5db; border-radius: 7px; font-size: 15px; }
    button { min-height: 42px; border: 0; border-radius: 7px; background: #111827; color: #fff; padding: 0 15px; font-size: 14px; cursor: pointer; white-space: nowrap; }
    button.secondary { background: #4b5563; }
    .timer { margin-bottom: 14px; display: grid; grid-template-columns: 1fr auto; gap: 16px; align-items: center; }
    .timer-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
    .timer-status { font-size: 20px; font-weight: 700; color: #0f766e; }
    .badge { display: inline-block; padding: 4px 8px; border-radius: 999px; font-size: 12px; font-weight: 700; }
    .badge.good { background: #dcfce7; color: #166534; }
    .badge.warn { background: #fef3c7; color: #92400e; }
    .badge.neutral { background: #e0f2fe; color: #075985; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { border-bottom: 1px solid #e5e7eb; padding: 9px 8px; text-align: left; vertical-align: top; }
    th { color: #475569; font-weight: 700; background: #f8fafc; }
    tr.current-row td { background: #f0fdfa; }
    code { background: #f3f4f6; padding: 2px 5px; border-radius: 4px; }
    .links { margin-top: 14px; display: flex; gap: 14px; flex-wrap: wrap; }
    .status { min-height: 22px; color: #166534; font-size: 14px; }
    @media (max-width: 760px) {
      header, .hero, .grid, .timer { grid-template-columns: 1fr; display: grid; }
      .copy-row { grid-template-columns: 1fr; }
      .timer-actions { justify-content: flex-start; }
      main { padding: 18px 12px 32px; }
      table { font-size: 12px; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>BOSS首页低频手动搜索作业卡</h1>
        <p>这个本地页只服务人工低频采样：复制首页、复制一个关键词、复制岗位详情到收件箱。</p>
      </div>
      <div class="safety">不自动打开 BOSS，不读取页面，不刷新页面，不批量跳转，不投递，不打招呼，不绕过验证。</div>
    </header>

    ${currentBlock}

    <section class="timer">
      <div>
        <h3>低频节奏闸门</h3>
        <p>每次只做 1 个入口；入口之间至少间隔 ${args.cooldownMin} 分钟；完成 3 个入口后冷却 ${args.afterThreeMin} 分钟。计时只保存在本地浏览器。</p>
        <p class="timer-status" id="timer-status">未开始计时</p>
      </div>
      <div class="timer-actions">
        <button data-timer="${args.cooldownMin}" type="button">开始 ${args.cooldownMin} 分钟冷却</button>
        <button data-timer="${args.afterThreeMin}" class="secondary" type="button">开始 ${args.afterThreeMin} 分钟冷却</button>
        <button id="clear-timer" class="secondary" type="button">清除计时</button>
      </div>
    </section>

    <section class="queue">
      <h3>入口队列</h3>
      <table>
        <thead>
          <tr>
            <th>顺序</th>
            <th>公司</th>
            <th>岗位词</th>
            <th>薪资参考</th>
            <th>状态</th>
            <th>缺失字段</th>
            <th>站内搜索关键词</th>
          </tr>
        </thead>
        <tbody>
          ${queueRows || `<tr><td colspan="7">暂无任务</td></tr>`}
        </tbody>
      </table>
    </section>

    <section class="links">
      <a href="${fileHref(inboxPath)}">打开收件箱</a>
      <a href="${fileHref(inboxStatusMdPath)}">查看收件箱质量预检</a>
      <span>导入命令：<code>npm run import:inbox -- --refresh</code></span>
    </section>
    <p class="status" id="copy-status"></p>
  </main>
  <script>
    const status = document.getElementById("copy-status");
    const timerStatus = document.getElementById("timer-status");
    const timerKey = "boss-lowfreq-cooldown-until";

    async function copyInput(id) {
      const input = document.getElementById(id);
      if (!input) return;
      input.focus();
      input.select();
      try {
        await navigator.clipboard.writeText(input.value);
        status.textContent = id === "boss-home"
          ? "已复制首页。请粘贴到普通 Chrome 地址栏。"
          : "已复制关键词。请粘贴到 BOSS 站内搜索框。";
      } catch {
        document.execCommand("copy");
        status.textContent = "已选中内容。若未复制成功，请按 Cmd+C。";
      }
    }

    function startTimer(minutes) {
      localStorage.setItem(timerKey, String(Date.now() + minutes * 60 * 1000));
      renderTimer();
    }

    function clearTimer() {
      localStorage.removeItem(timerKey);
      renderTimer();
    }

    function renderTimer() {
      const until = Number(localStorage.getItem(timerKey) || 0);
      const remaining = until - Date.now();
      if (!until || remaining <= 0) {
        timerStatus.textContent = "可以开始下一个人工入口";
        return;
      }
      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.ceil((remaining % 60000) / 1000);
      timerStatus.textContent = "冷却中：" + String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
    }

    for (const button of document.querySelectorAll("[data-copy]")) {
      button.addEventListener("click", () => copyInput(button.dataset.copy));
    }
    for (const button of document.querySelectorAll("[data-timer]")) {
      button.addEventListener("click", () => startTimer(Number(button.dataset.timer)));
    }
    document.getElementById("clear-timer").addEventListener("click", clearTimer);
    renderTimer();
    setInterval(renderTimer, 1000);
  </script>
</body>
</html>
`;
}

function buildMarkdown({ rows, current, args }) {
  const queueRows = rows.slice(0, args.queueLimit).map((row) => (
    `| ${mdCell(row.rank)} | ${mdCell(row.company)} | ${mdCell(row.role)} | ${mdCell(row.salaryBand)} | ${mdCell(row.stage)} | ${mdCell(row.missingFields || "-")} | \`${mdCell(row.searchKeyword)}\` |`
  ));

  const currentBlock = current ? `| 字段 | 当前值 |
| --- | --- |
| 当前入口 | ${mdCell(`${current.rank}. ${current.company} / ${current.role}`)} |
| 赛道 | ${mdCell(current.segment || current.route)} |
| 薪资参考 | ${mdCell(current.salaryBand)} |
| 状态 | ${mdCell(current.stage)} |
| BOSS首页 | \`${mdCell(current.safeHomeUrl)}\` |
| 站内搜索关键词 | \`${mdCell(current.searchKeyword)}\` |
| 下一动作 | ${mdCell(current.nextAction)} |` : "暂无待处理入口。";

  return `# BOSS首页低频手动搜索作业卡

更新时间：${formatDate()}

## 一、本质判断

这张作业卡不是自动采集器，而是把“BOSS 首页手动低频搜索”变成一个可执行的单入口流程：一次只处理一个公司和岗位词，复制公开岗位详情到本地收件箱，再由本地脚本导入和刷新报告。

当前最大的矛盾是：既要继续补 BOSS 岗位薪资和职责样本，又不能通过自动打开、连续刷新或批量跳转触发风控。所以这里不放搜索链接，只保留 BOSS 首页和站内搜索关键词。

## 二、当前入口

${currentBlock}

## 三、低频规则

1. 每次只做 1 个入口，不连续打开多个搜索结果。
2. 入口之间至少间隔 ${args.cooldownMin} 分钟。
3. 完成 3 个入口后冷却 ${args.afterThreeMin} 分钟。
4. 只复制公开岗位详情，不投递、不打招呼、不上传简历、不绕过验证。
5. 优先复制薪资、城市、经验、学历、职责、要求、客户类型、管理属性。

## 四、入口队列

| 顺序 | 公司 | 岗位词 | 薪资参考 | 状态 | 缺失字段 | 站内搜索关键词 |
| ---: | --- | --- | --- | --- | --- | --- |
${queueRows.length ? queueRows.join("\n") : "| - | 暂无 |  |  |  |  |  |"}

## 五、操作闭环

\`\`\`bash
npm run auth:boss
npm run sampling:lowfreq
npm run sampling:inbox-status
npm run import:inbox -- --dry-run
npm run import:inbox -- --refresh
\`\`\`

本地 HTML 作业卡：

\`\`\`text
${outputHtmlPath}
\`\`\`
`;
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(usage());
    return;
  }

  const executionRows = readCsv(executionCsvPath);
  if (!executionRows.length) {
    throw new Error(`未找到首批执行单：${executionCsvPath}。请先运行 npm run sampling:first-execution。`);
  }

  const statusRows = readCsv(inboxStatusCsvPath);
  const statusByRank = new Map(statusRows.map((row) => [String(row.rank || ""), row]));
  const statusByKey = new Map(statusRows.map((row) => [taskKey(row), row]));
  const rows = executionRows.map((row) => rowWithStatus(row, statusFor(row, statusByRank, statusByKey), args));
  const current = pickCurrentTask(rows);

  const headers = [
    "rank",
    "company",
    "role",
    "route",
    "segment",
    "roleFamily",
    "city",
    "salaryBand",
    "targetCopies",
    "safeHomeUrl",
    "searchKeyword",
    "stage",
    "pasted",
    "readyToImport",
    "qualityScore",
    "estimatedJobs",
    "missingFields",
    "nextAction",
    "cooldownMin",
    "afterThreeMin"
  ];

  mkdirSync(dirname(outputCsvPath), { recursive: true });
  writeFileSync(outputCsvPath, `${csv([headers])}\n${csv(rows.map((row) => headers.map((header) => row[header])))}\n`, "utf8");
  writeFileSync(outputMdPath, buildMarkdown({ rows, current, args }), "utf8");
  writeFileSync(outputHtmlPath, buildHtml({ rows, current, args }), "utf8");

  console.log(`已生成：${outputMdPath}`);
  console.log(`已生成：${outputCsvPath}`);
  console.log(`已生成：${outputHtmlPath}`);
  if (current) {
    console.log(`当前入口：${current.rank}. ${current.company} / ${current.role}`);
    console.log(`站内搜索关键词：${current.searchKeyword}`);
    console.log(`状态：${current.stage}`);
  }
}

main();
