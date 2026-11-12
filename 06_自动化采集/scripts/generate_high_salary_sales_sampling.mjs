#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const nextQueuePath = join(projectRoot, "01_行情收集/BOSS下一轮优先采样清单.csv");
const hardwareQueuePath = join(projectRoot, "01_行情收集/BOSS硬件算力半导体优先采样清单.csv");
const roleMatrixPath = join(projectRoot, "01_行情收集/AI销售岗位薪资能力矩阵.csv");
const outputCsvPath = join(projectRoot, "01_行情收集/BOSS高薪销售岗位低频采样清单.csv");
const outputMdPath = join(projectRoot, "01_行情收集/BOSS高薪销售岗位低频采样清单.md");
const outputHtmlPath = join(projectRoot, "01_行情收集/BOSS高薪销售岗位低频采样清单.html");
const outputCurrentTaskPath = join(projectRoot, "01_行情收集/BOSS当前高薪销售采样任务.md");
const outputInboxPath = join(projectRoot, "01_行情收集/BOSS高薪销售岗位采样收件箱.md");
const outputInboxStatusPath = join(projectRoot, "01_行情收集/BOSS高薪销售岗位采样收件箱质量预检.md");
const jobsPath = join(projectRoot, "01_行情收集/data/jobs.jsonl");
const bossSafeEntryPath = join(projectRoot, "01_行情收集/BOSS登录安全入口.html");
const safeBossHomeUrl = "https://www.zhipin.com/";
const highSalaryBatchId = "BOSS-HIGHSALARY";

function parseArgs(argv) {
  const args = {
    limit: 30,
    city: "广州",
    cooldownMin: 10,
    afterThreeMin: 30,
    minSalaryMaxK: 30
  };
  for (let index = 2; index < argv.length; index += 1) {
    const key = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${key}`);
      return argv[index];
    };
    if (key === "--limit") args.limit = Number.parseInt(next(), 10);
    else if (key === "--city") args.city = next();
    else if (key === "--cooldown-min") args.cooldownMin = Number.parseInt(next(), 10);
    else if (key === "--after-three-min") args.afterThreeMin = Number.parseInt(next(), 10);
    else if (key === "--min-salary-max-k") args.minSalaryMaxK = Number.parseInt(next(), 10);
    else if (key === "--help" || key === "-h") args.help = true;
    else throw new Error(`Unknown option: ${key}`);
  }
  return args;
}

function usage() {
  return `Usage:
  npm run sampling:highsalary
  npm run sampling:highsalary -- --limit 30 --city 广州

Purpose:
  Generate a manual low-frequency BOSS queue for high-pay sales roles. This
  script only writes local files. It never opens, reads, refreshes, navigates,
  or controls BOSS pages.
`;
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

function readCsvIfExists(filePath) {
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

function inboxKeyFromParts(company, role) {
  return `${String(company || "").trim()}|||${String(role || "").trim()}`;
}

function inboxKeyFromMetadata(metadata = {}) {
  const args = metadata.args || {};
  return inboxKeyFromParts(metadata.company || args.company, metadata.role || args.role);
}

function cleanInboxText(text) {
  return String(text || "")
    .split(/\r?\n/)
    .filter((line) => !/^在这里粘贴 .+ 的岗位详情。导入后可清空本段文本，保留标记。$/.test(line.trim()))
    .join("\n")
    .trim();
}

function readPreservedInboxText(filePath) {
  const preserved = new Map();
  if (!existsSync(filePath)) return preserved;
  const text = readFileSync(filePath, "utf8");
  const pattern = /<!-- BOSS_INBOX_TASK_START -->\s*([\s\S]*?)\s*<!-- BOSS_INBOX_TASK_END -->[\s\S]*?<!-- BOSS_INBOX_TEXT_START -->\s*([\s\S]*?)\s*<!-- BOSS_INBOX_TEXT_END -->/g;
  for (const match of text.matchAll(pattern)) {
    let metadata = {};
    try {
      metadata = JSON.parse(match[1]);
    } catch {
      continue;
    }
    const key = inboxKeyFromMetadata(metadata);
    const pastedText = cleanInboxText(match[2]);
    if (key !== "|||" && pastedText) preserved.set(key, pastedText);
  }
  return preserved;
}

function readHighSalaryImportCounts(filePath) {
  const counts = new Map();
  if (!existsSync(filePath)) return counts;
  const lines = readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (const line of lines) {
    try {
      const record = JSON.parse(line);
      if (record.samplingBatchId !== highSalaryBatchId) continue;
      const task = String(record.samplingBatchTask || "");
      if (!task) continue;
      counts.set(task, (counts.get(task) || 0) + 1);
    } catch {
      // Ignore malformed historical records.
    }
  }
  return counts;
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

function roleFamily(role) {
  const text = String(role || "");
  if (/售前|解决方案|顾问|方案/.test(text)) return "售前/解决方案顾问";
  if (/渠道|生态|伙伴|代理/.test(text)) return "渠道/生态/伙伴销售";
  if (/总监|负责人|管理|销售经理|区域/.test(text)) return "销售管理/区域负责人";
  if (/芯片|硬件|服务器|智算|IDC|数据中心|算力/.test(text)) return "硬件/智算/半导体行业销售";
  if (/大客户|KA|客户经理|行业/.test(text)) return "大客户/行业销售经理";
  if (/SaaS|软件|智能体|应用/.test(text)) return "SaaS/应用销售";
  if (/AI|大模型|人工智能|MaaS|Maas/.test(text)) return "AI软件/大模型销售";
  return "销售/商务";
}

function matrixKey(row) {
  return `${row.segment || ""}|||${row.role || ""}`;
}

function buildRoleMatrix(rows) {
  const result = new Map();
  for (const row of rows) result.set(matrixKey(row), row);
  return result;
}

function maxSalaryK(value) {
  const nums = [...String(value || "").matchAll(/(\d+(?:\.\d+)?)\s*K/gi)]
    .map((match) => Number.parseFloat(match[1]))
    .filter(Number.isFinite);
  return nums.length ? Math.max(...nums) : 0;
}

function segmentBoost(segment) {
  const text = String(segment || "");
  if (/芯片|GPU|半导体|昇腾|智算|数据中心|服务器/.test(text)) return 70;
  if (/基座大模型|Agent平台|云计算|大模型平台|MaaS/.test(text)) return 60;
  if (/智能汽车|机器人|具身智能|工业AI|智能制造|MLOps|AI基础软件/.test(text)) return 45;
  if (/智能客服|营销|销售AI|安全|信创|RPA/.test(text)) return 30;
  return 10;
}

function roleBoost(role) {
  const family = roleFamily(role);
  if (family === "大客户/行业销售经理") return 40;
  if (family === "渠道/生态/伙伴销售") return 36;
  if (family === "销售管理/区域负责人") return 34;
  if (family === "AI软件/大模型销售") return 32;
  if (family === "硬件/智算/半导体行业销售") return 30;
  if (family === "售前/解决方案顾问") return 24;
  return 10;
}

function priorityBoost(priority) {
  if (priority === "P0") return 50;
  if (priority === "P1") return 30;
  if (priority === "P2") return 15;
  return 0;
}

function normalizeRow(row, sourceQueue, matrixByRole) {
  const family = row.roleFamily || roleFamily(row.role);
  const matrix = matrixByRole.get(`${row.segment || ""}|||${family}`) || {};
  const salaryBand = row.salaryBand || matrix.salaryBand || "待BOSS样本校验";
  const salaryMaxK = maxSalaryK(salaryBand);
  const searchKeyword = row.searchKeyword || `${row.company || ""} ${row.role || ""}`.trim();
  const importCommand = row.importCommand
    || `npm run import:manual -- --source "BOSS直聘" --query "${searchKeyword}" --company "${row.company || ""}" --role "${row.role || ""}" --city "${row.city || "广州"}"`;
  const score = salaryMaxK * 10
    + segmentBoost(row.segment)
    + roleBoost(row.role)
    + priorityBoost(row.priority)
    + Number(row.score || 0) / 3
    + Number(row.salaryEvidenceCount || matrix.salaryEvidenceCount || 0) * 6
    + Number(row.sampleGap || matrix.sampleGap || 0) * 2;
  return {
    priority: row.priority || matrix.priority || "",
    segment: row.segment || "",
    company: row.company || "",
    role: row.role || "",
    roleFamily: family,
    city: row.city || "广州",
    salaryBand,
    salaryMaxK,
    sourceQueue,
    score: Math.round(score),
    safeBossHomeUrl,
    searchKeyword,
    importCommand,
    reason: [
      salaryMaxK ? `观察薪资上限${salaryMaxK}K` : "薪资待BOSS校验",
      row.priority ? `${row.priority}队列` : "",
      /芯片|GPU|半导体|智算|服务器|数据中心/.test(row.segment || "") ? "硬件/算力/半导体优先" : "",
      /大模型|MaaS|云|Agent|AI/.test(row.segment || "") ? "AI/互联网高薪方向" : "",
      matrix.coreCapabilities ? `核心能力：${String(matrix.coreCapabilities).split(";").slice(0, 3).join("/")}` : ""
    ].filter(Boolean).join("；")
  };
}

function uniqueRows(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = `${row.segment}|||${row.company}|||${row.role}`;
    const current = map.get(key);
    if (!current || row.score > current.score) map.set(key, row);
  }
  return [...map.values()];
}

function currentRow(rows) {
  return rows.find((row) => row.currentTask === "是") || rows.find((row) => Number(row.remainingCopies || 0) > 0) || rows[0] || null;
}

function buildHtml(rows, args) {
  const current = currentRow(rows);
  const safeEntryHref = existsSync(bossSafeEntryPath) ? pathToFileURL(bossSafeEntryPath).href : safeBossHomeUrl;
  const currentBlock = current ? `<section class="current panel">
      <p class="eyebrow">当前只处理这一个入口</p>
      <h2>${htmlEscape(current.rank)}. ${htmlEscape(current.company)} / ${htmlEscape(current.role)}</h2>
      <dl>
        <div><dt>赛道</dt><dd>${htmlEscape(current.segment)}</dd></div>
        <div><dt>薪资观察</dt><dd>${htmlEscape(current.salaryBand)}</dd></div>
        <div><dt>站内搜索词</dt><dd><code id="currentKeyword">${htmlEscape(current.searchKeyword)}</code></dd></div>
        <div><dt>已导入</dt><dd>${htmlEscape(current.importedCount)}/${htmlEscape(current.targetCopies)}</dd></div>
        <div><dt>剩余目标</dt><dd>${htmlEscape(current.remainingCopies)}</dd></div>
        <div><dt>收件箱文本</dt><dd>${htmlEscape(current.inboxHasText)}</dd></div>
      </dl>
      <div class="actions">
        <button type="button" data-copy="${htmlEscape(current.searchKeyword)}">复制关键词</button>
        <a class="button secondary" href="${htmlEscape(safeEntryHref)}">打开BOSS安全入口</a>
        <a class="button secondary" href="${htmlEscape(pathToFileURL(outputInboxPath).href)}">打开高薪收件箱</a>
        <a class="button secondary" href="${htmlEscape(pathToFileURL(outputInboxStatusPath).href)}">查看预检</a>
      </div>
      <div class="timer">
        <span id="timerLabel">${args.cooldownMin}:00</span>
        <button type="button" id="startTimer">开始${args.cooldownMin}分钟冷却</button>
      </div>
    </section>` : "";
  const bodyRows = rows.map((row) => `<tr class="${row.currentTask === "是" ? "is-current" : ""}">
    <td>${row.rank}</td>
    <td>${htmlEscape(row.company)}</td>
    <td>${htmlEscape(row.role)}</td>
    <td>${htmlEscape(row.segment)}</td>
    <td>${htmlEscape(row.salaryBand)}</td>
    <td>${htmlEscape(row.importedCount)}/${htmlEscape(row.targetCopies)}</td>
    <td>${htmlEscape(row.inboxHasText)}</td>
    <td><code>${htmlEscape(row.searchKeyword)}</code></td>
  </tr>`).join("\n");
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>BOSS高薪销售岗位低频采样清单</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; color: #172033; background: #f7f8fb; }
    main { max-width: 1180px; margin: 0 auto; padding: 32px 24px 48px; }
    h1 { font-size: 28px; margin: 0 0 8px; }
    h2 { font-size: 24px; margin: 4px 0 16px; }
    p { line-height: 1.65; }
    .panel { background: #fff; border: 1px solid #e5e7ef; border-radius: 8px; padding: 18px; margin: 18px 0; }
    .eyebrow { margin: 0; color: #64748b; font-size: 13px; font-weight: 700; letter-spacing: 0; }
    .rules { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .rule { background: #f1f5f9; border-radius: 8px; padding: 12px; }
    dl { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 0 0 18px; }
    dt { color: #64748b; font-size: 13px; margin-bottom: 6px; }
    dd { margin: 0; font-weight: 700; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
    button, a.button { border: 0; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 8px; background: #172033; color: #fff; text-decoration: none; font-size: 14px; }
    .secondary { background: #334155; }
    .timer { margin-top: 14px; display: flex; align-items: center; gap: 12px; }
    #timerLabel { font-variant-numeric: tabular-nums; font-size: 22px; font-weight: 800; }
    table { width: 100%; border-collapse: collapse; background: #fff; }
    th, td { border-bottom: 1px solid #e5e7ef; padding: 10px; text-align: left; vertical-align: top; font-size: 14px; }
    th { background: #eef2f7; font-weight: 700; }
    code { white-space: nowrap; }
    tr.is-current td { background: #fff7ed; }
    @media (max-width: 760px) { .rules, dl { grid-template-columns: 1fr; } table { font-size: 12px; } code { white-space: normal; } }
  </style>
</head>
<body>
  <main>
    <h1>BOSS高薪销售岗位低频采样清单</h1>
    <p>更新时间：${htmlEscape(formatDate())}</p>
    ${currentBlock}
    <div class="panel">
      <a class="button" href="${htmlEscape(safeEntryHref)}">打开BOSS安全入口</a>
      <a class="button" href="${htmlEscape(pathToFileURL(outputInboxPath).href)}">打开高薪岗位收件箱</a>
      <p>只用 BOSS 首页的站内搜索框输入关键词，不打开脚本生成的搜索 URL，不批量刷新。</p>
    </div>
    <div class="rules">
      <div class="rule">每次只处理 1 个入口。</div>
      <div class="rule">两个入口间隔至少 ${args.cooldownMin} 分钟。</div>
      <div class="rule">连续处理 3 个入口后冷却 ${args.afterThreeMin} 分钟。</div>
    </div>
    <div class="panel">
      <table>
        <thead><tr><th>#</th><th>公司</th><th>岗位</th><th>赛道</th><th>薪资</th><th>已导入</th><th>收件箱</th><th>站内搜索词</th></tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>
  </main>
  <script>
    const timerSeconds = ${Number(args.cooldownMin) * 60};
    document.querySelectorAll("[data-copy]").forEach((button) => {
      button.addEventListener("click", async () => {
        const text = button.getAttribute("data-copy") || "";
        try {
          await navigator.clipboard.writeText(text);
          button.textContent = "已复制";
          setTimeout(() => { button.textContent = "复制关键词"; }, 1800);
        } catch {
          window.prompt("复制关键词", text);
        }
      });
    });
    const start = document.getElementById("startTimer");
    const label = document.getElementById("timerLabel");
    if (start && label) {
      let interval = null;
      start.addEventListener("click", () => {
        clearInterval(interval);
        let left = timerSeconds;
        const render = () => {
          const minutes = String(Math.floor(left / 60)).padStart(2, "0");
          const seconds = String(left % 60).padStart(2, "0");
          label.textContent = minutes + ":" + seconds;
        };
        render();
        interval = setInterval(() => {
          left -= 1;
          render();
          if (left <= 0) {
            clearInterval(interval);
            start.textContent = "冷却完成";
          }
        }, 1000);
      });
    }
  </script>
</body>
</html>
`;
}

function buildCurrentTask(rows, args) {
  const current = currentRow(rows);
  if (!current) {
    return `# BOSS当前高薪销售采样任务

更新时间：${formatDate()}

当前没有可用采样入口。请先运行 \`npm run sampling:highsalary\` 生成队列。
`;
  }

  return `# BOSS当前高薪销售采样任务

更新时间：${formatDate()}

## 一、当前只处理这一条

| 字段 | 内容 |
| --- | --- |
| 排名 | ${current.rank} |
| 公司 | ${current.company} |
| 岗位 | ${current.role} |
| 赛道 | ${current.segment} |
| 薪资参考 | ${current.salaryBand} |
| 已导入/目标 | ${current.importedCount}/${current.targetCopies} |
| 剩余目标 | ${current.remainingCopies} |
| 收件箱是否已有文本 | ${current.inboxHasText} |
| BOSS 首页 | ${current.safeBossHomeUrl} |
| 站内搜索关键词 | \`${current.searchKeyword}\` |
| 收件箱位置 | \`01_行情收集/BOSS高薪销售岗位采样收件箱.md\` 第 ${current.rank} 段 |

## 二、低频规则

1. 只从 BOSS 首页进入，在站内搜索框输入关键词。
2. 本轮只处理这一个关键词：\`${current.searchKeyword}\`。
3. 复制 1 到 3 条岗位详情后停止。
4. 处理完本条后至少冷却 ${args.cooldownMin} 分钟；连续 3 条后冷却 ${args.afterThreeMin} 分钟。
5. 不打开脚本搜索 URL，不批量刷新，不使用 9333/CDP/内置浏览器访问 BOSS。

## 三、复制岗位时至少包含

- 岗位名称
- 公司名称
- 薪资
- 城市
- 经验
- 学历
- 岗位职责
- 任职要求

## 四、粘贴格式

把 BOSS 页面中复制到的岗位详情粘贴到收件箱第 ${current.rank} 段的这两个标记之间：

\`\`\`text
<!-- BOSS_INBOX_TEXT_START -->
岗位1完整文本

---

岗位2完整文本
<!-- BOSS_INBOX_TEXT_END -->
\`\`\`

## 五、粘贴后运行

如果你已经在 BOSS 页面复制了岗位详情，优先用这个命令写入当前段落：

\`\`\`bash
npm run paste:highsalary-current
\`\`\`

然后运行：

\`\`\`bash
npm run sampling:highsalary-status
npm run import:highsalary-inbox -- --dry-run
npm run import:highsalary-inbox -- --refresh
\`\`\`

## 六、为什么先采这条

${current.reason}

## 七、推进状态

- 已导入：${current.importedCount}/${current.targetCopies}
- 剩余目标：${current.remainingCopies}
- 收件箱已有文本：${current.inboxHasText}
- 判断：${current.currentTaskReason}
`;
}

function buildInbox(rows, preservedTextByKey = new Map()) {
  const sections = rows.map((row) => {
    const preservedText = preservedTextByKey.get(inboxKeyFromParts(row.company, row.role));
    const inboxText = preservedText || `在这里粘贴 ${row.company} / ${row.role} 的岗位详情。导入后可清空本段文本，保留标记。`;
    const metadata = {
      rank: row.rank,
      company: row.company,
      role: row.role,
      safeHomeUrl: row.safeBossHomeUrl,
      searchKeyword: row.searchKeyword,
      targetCopies: "3",
      args: {
        source: "BOSS直聘",
        query: row.searchKeyword,
        company: row.company,
        role: row.role,
        city: row.city || "广州",
        batchId: "BOSS-HIGHSALARY",
        batchTask: String(row.rank),
        batchTargetCopies: "3",
        priority: row.priority,
        route: /芯片|GPU|半导体|智算|服务器|数据中心/.test(row.segment) ? "硬件/算力/半导体路线" : "AI/互联网高薪销售路线",
        segment: row.segment,
        roleFamily: row.roleFamily,
        salaryBand: row.salaryBand
      }
    };
    return `## ${row.rank}. ${row.company} / ${row.role}

目标导入：3 条

薪资参考：${row.salaryBand}

BOSS首页：${row.safeBossHomeUrl}

站内搜索关键词：${row.searchKeyword}

<!-- BOSS_INBOX_TASK_START -->
${JSON.stringify(metadata)}
<!-- BOSS_INBOX_TASK_END -->

<!-- BOSS_INBOX_TEXT_START -->
${inboxText}
<!-- BOSS_INBOX_TEXT_END -->`;
  }).join("\n\n");

  return `# BOSS高薪销售岗位采样收件箱

更新时间：${formatDate()}

## 使用边界

- 这个文件只接收你人工复制回来的高薪销售岗位文本。
- 不要在这里粘贴简历、账号、聊天记录或隐私信息。
- 每个公司段落可以一次粘贴 1 到 3 条岗位详情；多条岗位之间用空行或 \`---\` 分隔。
- 粘贴后先运行 \`npm run sampling:highsalary-status\` 做质量预检。
- 预检可导入后运行 \`npm run import:highsalary-inbox -- --refresh\`，系统会按段落里的批次元数据导入，并刷新本地报告。
- 采样时只从 BOSS 首页站内搜索进入，不直开搜索 URL，不批量刷新。

${sections}
`;
}

const args = parseArgs(process.argv);
if (args.help) {
  console.log(usage());
  process.exit(0);
}

const matrixByRole = buildRoleMatrix(readCsvIfExists(roleMatrixPath));
const sourceRows = [
  ...readCsvIfExists(nextQueuePath).map((row) => normalizeRow(row, "下一轮优先采样清单", matrixByRole)),
  ...readCsvIfExists(hardwareQueuePath).map((row) => normalizeRow(row, "硬件算力半导体优先采样清单", matrixByRole))
];

const rows = uniqueRows(sourceRows)
  .filter((row) => row.company && row.role)
  .filter((row) => row.salaryMaxK >= args.minSalaryMaxK || /芯片|GPU|半导体|智算|服务器|数据中心|大模型|MaaS|云|Agent/.test(row.segment))
  .sort((a, b) => b.salaryMaxK - a.salaryMaxK || b.score - a.score)
  .slice(0, args.limit)
  .map((row, index) => ({
    rank: index + 1,
    ...row,
    cooldownRule: `每个入口至少间隔${args.cooldownMin}分钟；连续3个入口后冷却${args.afterThreeMin}分钟`
  }));

mkdirSync(dirname(outputCsvPath), { recursive: true });
const preservedInboxText = readPreservedInboxText(outputInboxPath);
const importedCounts = readHighSalaryImportCounts(jobsPath);
let currentAssigned = false;
for (const row of rows) {
  row.targetCopies = 3;
  row.importedCount = importedCounts.get(String(row.rank)) || 0;
  row.remainingCopies = Math.max(0, row.targetCopies - row.importedCount);
  row.inboxHasText = preservedInboxText.has(inboxKeyFromParts(row.company, row.role)) ? "是" : "否";
  row.currentTask = !currentAssigned && row.remainingCopies > 0 ? "是" : "否";
  row.currentTaskReason = row.currentTask === "是"
    ? (row.inboxHasText === "是"
      ? "该入口已有收件箱文本但尚未达到目标导入数，优先预检/导入或补齐缺失字段。"
      : "这是当前第一条尚未达到目标导入数的高薪入口。")
    : (row.remainingCopies <= 0 ? "已达到目标导入数，后续生成会自动跳过。" : "等待前序入口完成。");
  if (row.currentTask === "是") currentAssigned = true;
}

const headers = [
  "rank",
  "score",
  "priority",
  "segment",
  "company",
  "role",
  "roleFamily",
  "city",
  "salaryBand",
  "salaryMaxK",
  "sourceQueue",
  "reason",
  "targetCopies",
  "importedCount",
  "remainingCopies",
  "inboxHasText",
  "currentTask",
  "currentTaskReason",
  "cooldownRule",
  "safeBossHomeUrl",
  "searchKeyword",
  "importCommand"
];

writeFileSync(outputCsvPath, `${csv([headers, ...rows.map((row) => headers.map((header) => row[header]))])}\n`);

const md = `# BOSS高薪销售岗位低频采样清单

更新时间：${formatDate()}

## 一、本质判断

这张表不是自动爬取清单，而是高薪销售岗位的人工低频采样队列。当前 BOSS 处于风控友好模式，只走 BOSS 首页站内搜索，不直开搜索 URL，不批量刷新，不自动读取页面。

## 二、低频规则

1. 每次只处理 1 个入口。
2. 两个入口之间至少间隔 ${args.cooldownMin} 分钟。
3. 连续处理 3 个入口后冷却 ${args.afterThreeMin} 分钟。
4. 优先复制岗位名称、公司、薪资、城市、经验、学历、岗位职责、任职要求。
5. 粘贴到 \`01_行情收集/BOSS高薪销售岗位采样收件箱.md\` 后，先运行 \`npm run sampling:highsalary-status\` 预检。
6. 预检可导入后运行 \`npm run import:highsalary-inbox -- --refresh\`。

## 三、高薪优先队列

| 排名 | 赛道 | 公司 | 岗位 | 薪资观察 | 站内搜索关键词 | 采样理由 |
| ---: | --- | --- | --- | --- | --- | --- |
${rows.map((row) => `| ${row.rank} | ${mdCell(row.segment)} | ${mdCell(row.company)} | ${mdCell(row.role)} | ${mdCell(row.salaryBand)} | \`${mdCell(row.searchKeyword)}\` | ${mdCell(row.reason)} |`).join("\n")}

## 四、文件

\`\`\`text
${outputCsvPath}
${outputHtmlPath}
\`\`\`
`;

writeFileSync(outputMdPath, md);
writeFileSync(outputHtmlPath, buildHtml(rows, args));
writeFileSync(outputCurrentTaskPath, buildCurrentTask(rows, args));
writeFileSync(outputInboxPath, buildInbox(rows, preservedInboxText));

console.log(`已生成：${outputMdPath}`);
console.log(`已生成：${outputCsvPath}`);
console.log(`已生成：${outputHtmlPath}`);
console.log(`已生成：${outputCurrentTaskPath}`);
console.log(`已生成：${outputInboxPath}`);
console.log(`高薪采样入口：${rows.length}`);
console.log(`已保留收件箱粘贴段落：${preservedInboxText.size}`);
console.log(`HTML：${pathToFileURL(outputHtmlPath).href}`);
