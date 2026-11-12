#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { collectionAutomationHandoff, readAuthTransport } from "./auth_transport_policy.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const collectScriptPath = join(projectRoot, "06_自动化采集/scripts/collect_jobs.mjs");
const processedDir = join(projectRoot, "01_行情收集/data/processed");
const defaultCompanyFile = join(projectRoot, "06_自动化采集/config/ai_full_company_targets.txt");
const defaultIndustryFile = join(projectRoot, "06_自动化采集/config/industry_targets.txt");
const defaultRoleFile = join(projectRoot, "06_自动化采集/config/sales_management_roles.txt");
const rateLimitConfigPath = join(projectRoot, "06_自动化采集/config/rate_limits.json");
const authConfigPath = join(projectRoot, "06_自动化采集/config/auth.json");

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
  npm run overnight:research -- --dry-run --city 广州 --max-batches 8 --batch-size 1
  npm run overnight:research -- --city 广州 --max-batches 8 --batch-size 1 --resume-after-risk

Options:
  --city <name>                Default: 广州
  --company-file <path>        Default: ai_full_company_targets.txt
  --industry-file <path>       Default: industry_targets.txt
  --roles-file <path>          Default: sales_management_roles.txt
  --batch-size <n>             Companies/industries per batch. Default: 1
  --max-batches <n>            Maximum batches to execute. Default: 8
  --start-offset <n>           Skip first n planned batches. Default: 0
  --delay-ms <n>               Delay inside each collect batch. Default: 600000
  --cooldown-ms <n>            Delay between batches. Default: 1800000
  --cards-per-search <n>       Default: 2
  --detail-limit <n>           Detail pages per batch. Default: 0
  --max-jobs-per-batch <n>     Default: 30
  --phases <a,b>               company,industry. Default: company,industry
  --jitter-ms <n>              Random extra delay before Boss requests. Default: 180000
  --resume-after-risk          Explicitly resume live BOSS access after manual verification.
  --dry-run                    Write the plan, do not collect.
`;
}

function parseArgs(argv) {
  const args = {
    city: "广州",
    companyFile: defaultCompanyFile,
    industryFile: defaultIndustryFile,
    rolesFile: defaultRoleFile,
    batchSize: 1,
    maxBatches: 8,
    startOffset: 0,
    delayMs: 600_000,
    cooldownMs: 1_800_000,
    jitterMs: 180_000,
    cardsPerSearch: 2,
    detailLimit: 0,
    maxJobsPerBatch: 30,
    phases: ["company", "industry"],
    resumeAfterRisk: false,
    dryRun: false
  };

  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const next = () => {
      i += 1;
      if (i >= argv.length) throw new Error(`Missing value for ${key}`);
      return argv[i];
    };
    if (key === "--city") args.city = next();
    else if (key === "--company-file") args.companyFile = resolve(next());
    else if (key === "--industry-file") args.industryFile = resolve(next());
    else if (key === "--roles-file") args.rolesFile = resolve(next());
    else if (key === "--batch-size") args.batchSize = Number.parseInt(next(), 10);
    else if (key === "--max-batches") args.maxBatches = Number.parseInt(next(), 10);
    else if (key === "--start-offset") args.startOffset = Number.parseInt(next(), 10);
    else if (key === "--delay-ms") args.delayMs = Number.parseInt(next(), 10);
    else if (key === "--cooldown-ms") args.cooldownMs = Number.parseInt(next(), 10);
    else if (key === "--cards-per-search") args.cardsPerSearch = Number.parseInt(next(), 10);
    else if (key === "--detail-limit") args.detailLimit = Number.parseInt(next(), 10);
    else if (key === "--max-jobs-per-batch") args.maxJobsPerBatch = Number.parseInt(next(), 10);
    else if (key === "--phases") args.phases = splitList(next());
    else if (key === "--jitter-ms") args.jitterMs = Number.parseInt(next(), 10);
    else if (key === "--resume-after-risk") args.resumeAfterRisk = true;
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

async function readListFile(filePath) {
  const text = await readFile(filePath, "utf8");
  return text
    .split(/\r?\n/)
    .flatMap((line) => {
      const clean = line.trim();
      if (!clean || clean.startsWith("#")) return [];
      return splitList(clean);
    });
}

async function readOptionalJson(filePath, fallback = {}) {
  if (!existsSync(filePath)) return fallback;
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function applyOvernightSafetyLimits(args, rateLimitConfig) {
  const bossLimits = rateLimitConfig.boss || {};
  const before = {
    batchSize: args.batchSize,
    maxBatches: args.maxBatches,
    delayMs: args.delayMs,
    cooldownMs: args.cooldownMs,
    jitterMs: args.jitterMs,
    cardsPerSearch: args.cardsPerSearch,
    detailLimit: args.detailLimit,
    maxJobsPerBatch: args.maxJobsPerBatch,
    resumeAfterRisk: args.resumeAfterRisk
  };

  if (Number.isFinite(bossLimits.overnightBatchSize)) {
    args.batchSize = Math.min(args.batchSize, bossLimits.overnightBatchSize);
  }
  if (Number.isFinite(bossLimits.overnightMaxBatches)) {
    args.maxBatches = Math.min(args.maxBatches, bossLimits.overnightMaxBatches);
  }
  if (Number.isFinite(bossLimits.minRequestIntervalMs)) {
    args.delayMs = Math.max(args.delayMs, bossLimits.minRequestIntervalMs);
  }
  if (Number.isFinite(bossLimits.overnightCooldownMs)) {
    args.cooldownMs = Math.max(args.cooldownMs, bossLimits.overnightCooldownMs);
  }
  if (Number.isFinite(bossLimits.defaultJitterMs)) {
    args.jitterMs = Math.max(args.jitterMs, bossLimits.defaultJitterMs);
  }
  if (Number.isFinite(bossLimits.maxCardsPerSearch)) {
    args.cardsPerSearch = Math.min(args.cardsPerSearch, bossLimits.maxCardsPerSearch);
  }
  if (Number.isFinite(bossLimits.maxDetailPagesPerRun)) {
    args.detailLimit = Math.min(args.detailLimit, bossLimits.maxDetailPagesPerRun);
  }
  if (Number.isFinite(bossLimits.maxJobsPerRun)) {
    args.maxJobsPerBatch = Math.min(args.maxJobsPerBatch, bossLimits.maxJobsPerRun);
  }

  return { before, after: {
    batchSize: args.batchSize,
    maxBatches: args.maxBatches,
    delayMs: args.delayMs,
    cooldownMs: args.cooldownMs,
    jitterMs: args.jitterMs,
    cardsPerSearch: args.cardsPerSearch,
    detailLimit: args.detailLimit,
    maxJobsPerBatch: args.maxJobsPerBatch,
    resumeAfterRisk: args.resumeAfterRisk
  } };
}

function shouldPauseBossLiveRun(args, rateLimitConfig) {
  if (args.dryRun) return false;
  const bossLimits = rateLimitConfig.boss || {};
  return Boolean(bossLimits.requireResumeFlag && !args.resumeAfterRisk);
}

function bossPauseMessage(rateLimitConfig) {
  const bossLimits = rateLimitConfig.boss || {};
  const min = bossLimits.recoveryPauseMinutesMin || 120;
  const max = bossLimits.recoveryPauseMinutesMax || 180;
  return [
    "BOSS风控恢复期：本次不会执行整晚自动采集。",
    `建议先暂停 ${min}-${max} 分钟，并在浏览器中手动完成验证。`,
    "恢复整晚低频采集时，命令需要显式追加 --resume-after-risk。",
    "恢复期更建议手动浏览岗位后使用 npm run import:manual 导入复制的岗位文本。"
  ].join("\n");
}

function chunks(items, size) {
  const result = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

function roleSubset(availableRoles, priority) {
  const set = new Set(availableRoles);
  const selected = priority.filter((role) => set.has(role) || !availableRoles.length);
  return selected.length ? selected : priority;
}

function prioritize(items, priority) {
  const itemSet = new Set(items);
  const front = priority.filter((item) => itemSet.has(item));
  const frontSet = new Set(front);
  return [...front, ...items.filter((item) => !frontSet.has(item))];
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function buildTasks({ companies, industries, roles, args }) {
  const tasks = [];
  const orderedCompanies = prioritize(companies, companyPriority);
  const companyRoles = roleSubset(roles, companyRolePriority);
  const industryRoles = industryRolePriority;

  if (args.phases.includes("company")) {
    for (const role of companyRoles) {
      for (const batch of chunks(orderedCompanies, args.batchSize)) {
        tasks.push({ kind: "company", role, items: batch });
      }
    }
  }

  if (args.phases.includes("industry")) {
    for (const role of industryRoles) {
      for (const batch of chunks(industries, args.batchSize)) {
        tasks.push({ kind: "industry", role, items: batch });
      }
    }
  }

  return tasks.slice(args.startOffset, args.startOffset + args.maxBatches);
}

function collectArgs(task, args) {
  const base = [
    collectScriptPath,
    "--city", args.city,
    "--roles", task.role,
    "--max-searches", String(task.items.length),
    "--cards-per-search", String(args.cardsPerSearch),
    "--max-jobs", String(args.maxJobsPerBatch),
    "--detail-limit", String(args.detailLimit),
    "--delay-ms", String(args.delayMs),
    "--min-request-interval-ms", String(args.delayMs),
    "--jitter-ms", String(args.jitterMs)
  ];

  if (args.resumeAfterRisk) {
    base.push("--resume-after-risk");
  }

  if (task.kind === "company") {
    base.push("--companies", task.items.join(","));
  } else {
    base.push("--industries", task.items.join(","));
  }
  return base;
}

async function newestCollectManifest(afterMs) {
  if (!existsSync(processedDir)) return null;
  const names = await readdir(processedDir);
  const files = names
    .filter((name) => /^collect_run_.*\.json$/.test(name))
    .map((name) => join(processedDir, name))
    .filter((filePath) => statSync(filePath).mtimeMs >= afterMs)
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  if (!files.length) return null;
  const filePath = files[0];
  return {
    filePath,
    data: JSON.parse(await readFile(filePath, "utf8"))
  };
}

async function runCollect(task, args) {
  const startedAtMs = Date.now();
  const childArgs = collectArgs(task, args);
  const output = [];
  const child = spawn(process.execPath, childArgs, { cwd: projectRoot });

  child.stdout.on("data", (chunk) => output.push(chunk.toString()));
  child.stderr.on("data", (chunk) => output.push(chunk.toString()));

  const code = await new Promise((resolvePromise) => {
    child.on("close", resolvePromise);
  });

  const manifest = await newestCollectManifest(startedAtMs);
  const stdout = output.join("");
  const isolationHandoff = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .find((value) => value?.automationAllowed === false);
  const childFailed = code !== 0;
  const blocked = Boolean(
    childFailed ||
    isolationHandoff ||
    stdout.includes("需要登录/验证") ||
    manifest?.data?.blocked?.length ||
    manifest?.data?.pageStats?.some((stat) => stat.needsLogin || stat.needsVerification)
  );

  return {
    code,
    blocked,
    childFailed,
    isolationHandoff: isolationHandoff || null,
    stdout,
    manifestPath: manifest?.filePath || "",
    savedCount: manifest?.data?.savedCount || 0,
    pageStats: manifest?.data?.pageStats || []
  };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(usage());
    return;
  }
  if (!args.dryRun) {
    const transportConfigPath = process.env.AUTH_TRANSPORT_CONFIG_PATH || authConfigPath;
    const transport = readAuthTransport(transportConfigPath);
    console.log(JSON.stringify(collectionAutomationHandoff({
      command: "overnight:research",
      source: "BOSS直聘",
      transport: transport.state === "configured" ? transport.transport : "unknown"
    })));
    process.exitCode = 2;
    return;
  }
  const rateLimitConfig = await readOptionalJson(rateLimitConfigPath, {});
  const safetyLimits = applyOvernightSafetyLimits(args, rateLimitConfig);

  const [companies, industries, roles] = await Promise.all([
    readListFile(args.companyFile),
    readListFile(args.industryFile),
    readListFile(args.rolesFile)
  ]);
  const tasks = buildTasks({ companies, industries, roles, args });
  const runId = stamp();
  await mkdir(processedDir, { recursive: true });
  const runPath = join(processedDir, `overnight_research_${runId}.json`);
  const runState = {
    runId,
    createdAt: new Date().toISOString(),
    args,
    safetyLimits,
    totals: {
      companies: companies.length,
      industries: industries.length,
      roles: roles.length,
      plannedBatches: tasks.length
    },
    tasks,
    results: [],
    status: args.dryRun ? "planned" : "running"
  };

  if (args.dryRun) {
    await writeFile(runPath, JSON.stringify(runState, null, 2));
    console.log(`已生成整晚采集计划：${runPath}`);
    console.log(`计划批次数：${tasks.length}`);
    return;
  }

  if (shouldPauseBossLiveRun(args, rateLimitConfig)) {
    runState.status = "paused_by_risk_recovery_mode";
    runState.message = bossPauseMessage(rateLimitConfig);
    await writeFile(runPath, JSON.stringify(runState, null, 2));
    console.log(bossPauseMessage(rateLimitConfig));
    console.log(`运行记录：${runPath}`);
    return;
  }

  await writeFile(runPath, JSON.stringify(runState, null, 2));
  for (let index = 0; index < tasks.length; index += 1) {
    const task = tasks[index];
    console.log(`批次 ${index + 1}/${tasks.length}: ${task.kind} ${task.role} ${task.items.join(",")}`);
    const result = await runCollect(task, args);
    runState.results.push({
      index,
      task,
      completedAt: new Date().toISOString(),
      ...result,
      stdout: result.stdout.slice(-3000)
    });

    if (result.blocked) {
      runState.status = result.isolationHandoff
        ? "blocked_by_collection_isolation"
        : result.childFailed
          ? "blocked_by_collect_failure"
          : "blocked_by_platform_verification";
      await writeFile(runPath, JSON.stringify(runState, null, 2));
      console.log(result.isolationHandoff || result.childFailed
        ? "采集子进程未获准执行，本轮整晚采集已停止。"
        : "检测到登录/安全验证，本轮整晚采集已停止。请在浏览器中完成验证后续跑。");
      console.log(`运行记录：${runPath}`);
      return;
    }

    await writeFile(runPath, JSON.stringify(runState, null, 2));
    if (index < tasks.length - 1 && args.cooldownMs > 0) {
      await sleep(args.cooldownMs);
    }
  }

  runState.status = "completed";
  await writeFile(runPath, JSON.stringify(runState, null, 2));
  console.log(`整晚采集完成：${runPath}`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
