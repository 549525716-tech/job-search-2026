#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const defaultInboxPath = join(projectRoot, "01_行情收集/BOSS首批人工采样收件箱.md");
const firstExecutionCsvPath = join(projectRoot, "01_行情收集/BOSS首批人工采样执行单.csv");
const statusCsvPath = join(projectRoot, "01_行情收集/BOSS首批人工采样收件箱质量预检.csv");
const statusMdPath = join(projectRoot, "01_行情收集/BOSS首批人工采样收件箱质量预检.md");
const importScriptPath = join(projectRoot, "06_自动化采集/scripts/import_clipboard_job.mjs");
const refreshScriptPath = join(projectRoot, "06_自动化采集/scripts/refresh_after_manual_import.mjs");
const highSalarySamplingScriptPath = join(projectRoot, "06_自动化采集/scripts/generate_high_salary_sales_sampling.mjs");
const highSalaryOverviewScriptPath = join(projectRoot, "06_自动化采集/scripts/generate_high_salary_sampling_overview.mjs");
const tmpDir = join(projectRoot, "01_行情收集/data/processed/manual_inbox_imports");

function usage() {
  return `Usage:
	  npm run import:inbox
	  npm run import:inbox -- --file 01_行情收集/BOSS首批人工采样收件箱.md
	  npm run import:inbox -- --status
	  npm run import:inbox -- --dry-run
	  npm run import:inbox -- --refresh

Purpose:
  Import manually pasted BOSS job text from the sampling inbox. This command
  only reads local files and writes local records. It never opens, reads,
  refreshes, or controls BOSS pages.

  Add --refresh after a real import to regenerate local reports without
  opening or controlling BOSS.
`;
}

function parseArgs(argv) {
  const args = {
    file: defaultInboxPath,
    status: false,
    dryRun: false,
    refresh: false
  };
  for (let index = 2; index < argv.length; index += 1) {
    const key = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${key}`);
      return argv[index];
    };
    if (key === "--file") args.file = resolve(next());
    else if (key === "--status") args.status = true;
    else if (key === "--dry-run") args.dryRun = true;
    else if (key === "--refresh") args.refresh = true;
    else if (key === "--help" || key === "-h") args.help = true;
    else throw new Error(`Unknown option: ${key}`);
  }
  return args;
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function cleanPastedText(text) {
  return String(text || "")
    .split(/\r?\n/)
    .filter((line) => !/^在这里粘贴 .+ 的岗位详情。导入后可清空本段文本，保留标记。$/.test(line.trim()))
    .join("\n")
    .trim();
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function writeCsv(filePath, rows) {
  if (!rows.length) {
    writeFileSync(filePath, "");
    return;
  }
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))
  ];
  writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
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

function readCsvRecords(filePath) {
  if (!existsSync(filePath)) return [];
  const lines = readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
  });
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

function includesPattern(text, pattern) {
  return pattern.test(String(text || ""));
}

function estimateJobBlocks(text) {
  const clean = String(text || "").trim();
  if (!clean) return 0;
  const chunks = clean
    .split(/\n\s*(?:-{3,}|={3,}|#{2,}\s*岗位|岗位\s*\d+[:：]?|第\s*\d+\s*条[:：]?)\s*\n/g)
    .map((item) => item.trim())
    .filter((item) => item.length >= 30);
  if (chunks.length > 1) return chunks.length;

  const salaryHits = (clean.match(/(?:\d+(?:\.\d+)?\s*[-~－—]\s*\d+(?:\.\d+)?\s*[Kk]|[\uE000-\uF8FF][\uE000-\uF8FF\s\-－—~·]*[Kk]|薪资范围|薪资待遇|元\/月)/g) || []).length;
  const titleHits = clean
    .split(/\r?\n/)
    .filter((line) => /销售|售前|商务|客户经理|解决方案|渠道|BD|商业化|销售管理|负责人/.test(line))
    .length;
  return Math.max(1, Math.min(5, Math.max(salaryHits, Math.ceil(titleHits / 4))));
}

function checkTaskQuality(task, latestTask = null) {
  const metadata = task.metadata || {};
  const args = metadata.args || {};
  const text = task.pastedText || "";
  const context = [
    text,
    metadata.company,
    metadata.role,
    args.company,
    args.role,
    args.segment,
    args.route,
    args.roleFamily
  ].filter(Boolean).join("\n");
  const pasted = Boolean(text.trim());
  const estimatedJobs = estimateJobBlocks(text);
  const checks = {
    hasSalary: includesPattern(text, /(?:\d+(?:\.\d+)?\s*[-~－—]\s*\d+(?:\.\d+)?\s*[Kk]|[\uE000-\uF8FF][\uE000-\uF8FF\s\-－—~·]*[Kk]|薪资范围|薪资待遇|薪资详情|元\/月|面议)/),
    hasCompany: includesPattern(context, new RegExp(String(metadata.company || args.company || "公司").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))),
    hasTitle: includesPattern(context, /销售|售前|商务|客户经理|解决方案|渠道|BD|商业化|销售管理|负责人|总监/),
    hasCity: includesPattern(context, /北京|上海|广州|深圳|杭州|成都|武汉|南京|苏州|西安|厦门|重庆|天津|全国|远程/),
    hasExperience: includesPattern(text, /\d+\s*[-~－—]\s*\d+\s*年|\d+\s*年及以上|经验|应届|不限经验/),
    hasEducation: includesPattern(text, /本科|大专|硕士|博士|学历|统招/),
    hasResponsibility: includesPattern(text, /职位描述|岗位职责|工作职责|负责|客户开发|商机|销售目标|回款|签约|销售额|客户需求/),
    hasRequirement: includesPattern(text, /任职要求|岗位要求|职位要求|要求|熟悉|具备|优先|能力|经验/),
    hasAiKeyword: includesPattern(context, /AI|人工智能|大模型|AIGC|智能体|Agent|RAG|MaaS|云计算|算力|GPU|芯片|半导体|智算|机器人|工业AI|智能制造|SaaS|数据智能/),
    hasSalesKeyword: includesPattern(context, /销售|售前|商务|客户|渠道|BD|解决方案|商业化|KA|大客户|客户经理|销售管理|区域|生态/)
  };
  const weights = {
    hasSalary: 18,
    hasCompany: 8,
    hasTitle: 10,
    hasCity: 6,
    hasExperience: 7,
    hasEducation: 6,
    hasResponsibility: 14,
    hasRequirement: 14,
    hasAiKeyword: 8,
    hasSalesKeyword: 9
  };
  const baseScore = pasted ? 0 : -100;
  const score = Math.max(0, Math.min(100, baseScore + Object.entries(weights)
    .reduce((sum, [key, value]) => sum + (checks[key] ? value : 0), 0)));
  const missing = Object.entries({
    hasSalary: "薪资",
    hasCompany: "公司",
    hasTitle: "岗位标题",
    hasCity: "城市",
    hasExperience: "经验",
    hasEducation: "学历",
    hasResponsibility: "职责",
    hasRequirement: "要求",
    hasAiKeyword: "AI/行业关键词",
    hasSalesKeyword: "销售/售前关键词"
  }).filter(([key]) => !checks[key]).map(([, label]) => label);
  const readyToImport = pasted &&
    estimatedJobs > 0 &&
    score >= 70 &&
    checks.hasSalary &&
    checks.hasTitle &&
    checks.hasSalesKeyword &&
    checks.hasAiKeyword &&
    (checks.hasResponsibility || checks.hasRequirement);
  let status = "未粘贴";
  let action = "粘贴1到3条岗位详情";
  if (pasted && readyToImport) {
    status = "可导入";
    action = "可先执行 dry-run";
  } else if (pasted && !checks.hasSalary) {
    status = "需补薪资";
    action = "补复制岗位薪资行";
  } else if (pasted && !(checks.hasResponsibility || checks.hasRequirement)) {
    status = "需补职责要求";
    action = "补复制职位描述和任职要求";
  } else if (pasted && !checks.hasAiKeyword) {
    status = "需补AI/行业关键词";
    action = "补复制岗位标签或完整详情";
  } else if (pasted && score < 70) {
    status = "质量不足";
    action = "补完整岗位详情后再导入";
  }

  return {
    rank: metadata.rank || "",
    company: metadata.company || args.company || "",
    role: metadata.role || args.role || "",
    route: args.route || "",
    segment: args.segment || "",
    roleFamily: args.roleFamily || "",
    targetCopies: latestTask?.targetCopies || metadata.targetCopies || args.batchTargetCopies || "",
    inboxTargetCopies: metadata.targetCopies || args.batchTargetCopies || "",
    targetSync: latestTask?.targetCopies && String(latestTask.targetCopies) !== String(metadata.targetCopies || args.batchTargetCopies || "") ? "否" : "是",
    pasted: pasted ? "是" : "否",
    estimatedJobs,
    qualityScore: score,
    status,
    readyToImport: readyToImport ? "是" : "否",
    hasSalary: checks.hasSalary ? "是" : "否",
    hasCompany: checks.hasCompany ? "是" : "否",
    hasTitle: checks.hasTitle ? "是" : "否",
    hasCity: checks.hasCity ? "是" : "否",
    hasExperience: checks.hasExperience ? "是" : "否",
    hasEducation: checks.hasEducation ? "是" : "否",
    hasResponsibility: checks.hasResponsibility ? "是" : "否",
    hasRequirement: checks.hasRequirement ? "是" : "否",
    hasAiKeyword: checks.hasAiKeyword ? "是" : "否",
    hasSalesKeyword: checks.hasSalesKeyword ? "是" : "否",
    missingFields: missing.join("；") || "-",
    action,
    manualUrl: metadata.manualUrl || ""
  };
}

function generateStatusReport(filePath) {
  const inboxText = readFileSync(filePath, "utf8");
  const tasks = parseInbox(inboxText);
  const latestRows = readCsvRecords(firstExecutionCsvPath);
  const latestByRank = new Map(latestRows.map((row) => [String(row.rank || ""), row]));
  const rows = tasks.map((task) => checkTaskQuality(task, latestByRank.get(String(task.metadata?.rank || ""))));
  const statusPaths = statusPathsFor(filePath);
  mkdirSync(dirname(statusPaths.csv), { recursive: true });
  writeCsv(statusPaths.csv, rows);

  const pasted = rows.filter((row) => row.pasted === "是").length;
  const ready = rows.filter((row) => row.readyToImport === "是").length;
  const estimatedJobs = rows.reduce((sum, row) => sum + Number(row.estimatedJobs || 0), 0);
  const targetCopies = rows.reduce((sum, row) => sum + Number(row.targetCopies || 0), 0);
  const inboxTargetCopies = rows.reduce((sum, row) => sum + Number(row.inboxTargetCopies || 0), 0);
  const targetMismatch = rows.filter((row) => row.targetSync === "否").length;
  const averageScore = rows.length
    ? rows.reduce((sum, row) => sum + Number(row.qualityScore || 0), 0) / rows.length
    : 0;
  const tableRows = rows.map((row) => {
    return `| ${row.rank} | ${row.company} | ${row.role} | ${row.segment} | ${row.targetCopies} | ${row.inboxTargetCopies} | ${row.targetSync} | ${row.pasted} | ${row.estimatedJobs} | ${row.qualityScore} | ${row.status} | ${row.readyToImport} | ${row.missingFields} | ${row.action} |`;
  });
  const report = `# ${statusPaths.title}

更新时间：${formatDateTime()}

## 一、结论

| 指标 | 当前值 |
| --- | ---: |
| 收件箱段落 | ${rows.length} |
| 已粘贴段落 | ${pasted} |
| 可导入段落 | ${ready} |
| 估算岗位数 | ${estimatedJobs} |
| 最新执行单目标岗位数 | ${targetCopies} |
| 收件箱内目标岗位数 | ${inboxTargetCopies} |
| 目标不同步段落 | ${targetMismatch} |
| 平均质量分 | ${averageScore.toFixed(1)} |

## 二、使用边界

- 这个预检只读取本地收件箱，不打开、不读取、不刷新 BOSS。
- \`可导入\` 表示文本包含薪资、岗位、销售/售前、AI/行业、职责或要求等关键字段，适合先 dry-run。
- \`需补薪资\`、\`需补职责要求\`、\`质量不足\` 的段落可以导入为线索，但不应直接支撑薪资或能力结论。
- 如果“目标是否同步”为“否”，说明收件箱保留了旧模板目标数；当前统计以最新执行单目标为准，不自动覆盖已保留的收件箱文本。

## 三、逐段预检

| 排名 | 公司 | 岗位词 | 赛道 | 最新目标 | 收件箱目标 | 目标是否同步 | 已粘贴 | 估算岗位 | 分数 | 状态 | 可导入 | 缺失字段 | 下一步 |
| ---: | --- | --- | --- | ---: | ---: | --- | --- | ---: | ---: | --- | --- | --- | --- |
${tableRows.length ? tableRows.join("\n") : "| - | 暂无 |  |  | 0 | 0 | 是 | 否 | 0 | 0 | 未生成 | 否 | - | 生成收件箱 |"}

## 四、推荐命令

\`\`\`bash
${statusPaths.statusCommand}
${statusPaths.importCommand} -- --dry-run
${statusPaths.importCommand} -- --refresh
\`\`\`
`;
  writeFileSync(statusPaths.md, report, "utf8");
  console.log(`收件箱质量预检完成：${ready}/${rows.length} 个段落可导入，估算岗位 ${estimatedJobs} 条`);
  console.log(`- ${statusPaths.md}`);
  console.log(`- ${statusPaths.csv}`);
}

function statusPathsFor(filePath) {
  const resolved = resolve(filePath);
  if (resolved === resolve(defaultInboxPath)) {
    return {
      md: statusMdPath,
      csv: statusCsvPath,
      title: "BOSS首批人工采样收件箱质量预检",
      statusCommand: "npm run sampling:inbox-status",
      importCommand: "npm run import:inbox"
    };
  }
  const stem = basename(resolved, ".md");
  if (stem.includes("公开线索复核收件箱")) {
    return {
      md: join(dirname(resolved), `${stem}质量预检.md`),
      csv: join(dirname(resolved), `${stem}质量预检.csv`),
      title: `${stem}质量预检`,
      statusCommand: "npm run sampling:public-review-status",
      importCommand: "npm run import:public-review-inbox"
    };
  }
  const highSalary = stem.includes("高薪");
  return {
    md: join(dirname(resolved), `${stem}质量预检.md`),
    csv: join(dirname(resolved), `${stem}质量预检.csv`),
    title: `${stem}质量预检`,
    statusCommand: highSalary
      ? "npm run sampling:highsalary-status"
      : `npm run import:inbox -- --file "${resolved}" --status`,
    importCommand: highSalary
      ? "npm run import:highsalary-inbox"
      : `npm run import:inbox -- --file "${resolved}"`
  };
}

function isHighSalaryInbox(filePath) {
  return basename(resolve(filePath), ".md").includes("高薪");
}

function parseInbox(text) {
  const tasks = [];
  const pattern = /<!-- BOSS_INBOX_TASK_START -->\s*([\s\S]*?)\s*<!-- BOSS_INBOX_TASK_END -->[\s\S]*?<!-- BOSS_INBOX_TEXT_START -->\s*([\s\S]*?)\s*<!-- BOSS_INBOX_TEXT_END -->/g;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    let metadata;
    try {
      metadata = JSON.parse(match[1].trim());
    } catch (error) {
      throw new Error(`收件箱元数据解析失败：${error.message}`);
    }
    const pastedText = cleanPastedText(match[2]);
    tasks.push({
      metadata,
      pastedText
    });
  }
  return tasks;
}

function cliArgsFromMetadata(metadata, filePath, dryRun) {
  const args = metadata.args || {};
  const cli = [importScriptPath, "--file", filePath];
  const pairs = [
    ["--source", args.source || "BOSS直聘"],
    ["--query", args.query],
    ["--company", args.company],
    ["--role", args.role],
    ["--city", args.city],
    ["--batch-id", args.batchId],
    ["--batch-task", args.batchTask],
    ["--batch-target-copies", args.batchTargetCopies],
    ["--priority", args.priority],
    ["--route", args.route],
    ["--segment", args.segment],
    ["--role-family", args.roleFamily],
    ["--salary-band", args.salaryBand]
  ];
  for (const [flag, value] of pairs) {
    if (value !== undefined && value !== null && value !== "") {
      cli.push(flag, String(value));
    }
  }
  if (dryRun) cli.push("--dry-run");
  return cli;
}

function parsedCountFromDryRun(output) {
  try {
    const data = JSON.parse(output);
    return Number(data.parsedCount || 0);
  } catch {
    return 0;
  }
}

function importedCountFromOutput(output) {
  const match = String(output).match(/新增\s+(\d+)\s+条/);
  return match ? Number.parseInt(match[1], 10) : 0;
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(usage());
    return;
  }
  if (!existsSync(args.file)) {
    throw new Error(`未找到收件箱文件：${args.file}。请先运行 npm run sampling:first-execution。`);
  }
  if (args.status) {
    generateStatusReport(args.file);
    return;
  }

  const inboxText = readFileSync(args.file, "utf8");
  const tasks = parseInbox(inboxText);
  const readyTasks = tasks.filter((task) => task.pastedText);
  if (!readyTasks.length) {
    console.log("收件箱没有可导入岗位文本。请先把岗位详情粘贴到 BOSS_INBOX_TEXT_START/END 标记之间。");
    return;
  }

  mkdirSync(tmpDir, { recursive: true });
  let totalParsed = 0;
  let totalImported = 0;
  const results = [];

  for (const task of readyTasks) {
    const rank = task.metadata.rank || results.length + 1;
    const company = task.metadata.company || task.metadata.args?.company || "";
    const role = task.metadata.role || task.metadata.args?.role || "";
    const tmpPath = join(tmpDir, `${stamp()}_${rank}_${company}_${role}.txt`.replace(/[^\w.\-\u4e00-\u9fa5]+/g, "_"));
    writeFileSync(tmpPath, task.pastedText);
    const cli = cliArgsFromMetadata(task.metadata, tmpPath, args.dryRun);
    let output = "";
    try {
      output = execFileSync(process.execPath, cli, {
        cwd: projectRoot,
        encoding: "utf8",
        maxBuffer: 1024 * 1024 * 10
      });
    } finally {
      if (args.dryRun && existsSync(tmpPath)) unlinkSync(tmpPath);
    }
    const count = args.dryRun ? parsedCountFromDryRun(output) : importedCountFromOutput(output);
    if (args.dryRun) totalParsed += count;
    else totalImported += count;
    results.push({ rank, company, role, count, tmpPath });
  }

  if (args.dryRun) {
    console.log(`收件箱预检完成：可导入段落 ${readyTasks.length} 个，预计解析岗位 ${totalParsed} 条`);
  } else {
    console.log(`收件箱导入完成：处理段落 ${readyTasks.length} 个，新增岗位 ${totalImported} 条`);
  }
  for (const result of results) {
    console.log(`- ${result.rank}. ${result.company}/${result.role}: ${result.count} 条`);
  }
  if (!args.dryRun && args.refresh) {
    console.log("\n开始刷新本地市场报告。该步骤不打开、不读取、不刷新 BOSS 页面。");
    execFileSync(process.execPath, [refreshScriptPath], {
      cwd: projectRoot,
      stdio: "inherit",
      maxBuffer: 1024 * 1024 * 20
    });

    if (isHighSalaryInbox(args.file)) {
      console.log("\n开始刷新高薪采样队列和当前任务卡。该步骤只读写本地文件，不打开、不读取、不刷新 BOSS 页面。");
      execFileSync(process.execPath, [highSalarySamplingScriptPath], {
        cwd: projectRoot,
        stdio: "inherit",
        maxBuffer: 1024 * 1024 * 20
      });
      generateStatusReport(args.file);
      execFileSync(process.execPath, [highSalaryOverviewScriptPath], {
        cwd: projectRoot,
        stdio: "inherit",
        maxBuffer: 1024 * 1024 * 10
      });
    }
  }
}

main();
