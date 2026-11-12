#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const rawDir = join(projectRoot, "01_行情收集/data/raw");
const jobsPath = join(projectRoot, "01_行情收集/data/jobs.jsonl");
const refreshScriptPath = join(projectRoot, "06_自动化采集/scripts/refresh_after_manual_import.mjs");

function usage() {
  return `Usage:
  npm run import:manual -- --source BOSS直聘 --query "智谱AI AI销售"
  npm run import:manual -- --file ./pasted_jobs.txt --source BOSS直聘 --query "大模型销售"
  npm run import:manual -- --company 智谱AI --role AI销售 --city 广州

Options:
  --file <path>          Read text from file. Default: macOS clipboard.
  --source <name>        Default: BOSS直聘
  --query <text>         Search/query context.
  --url <url>            Optional source URL.
  --company <name>       Force company name when copied text is incomplete.
  --recruiter-id <id>    Platform recruiter ID, when actually observed.
  --recruiter-name <name> Recruiter display name; not a verified unique ID.
  --city <name>          Force city/location context.
  --industry <name>      Industry/track context.
  --role <name>          Role context.
  --role-family <name>   Role family override.
  --route <name>         Market route context.
  --segment <name>       Segment context.
  --priority <P0|P1|P2>  Sampling priority context.
  --batch-id <id>        Manual sampling batch id.
  --batch-task <n>       Manual sampling task index in batch.
  --batch-target-copies <n> Target sample count for this batch task.
  --salary-band <text>   Salary signal shown in the sampling batch.
  --dry-run              Parse only, do not write files.
  --refresh              After real import, refresh local reports only.
`;
}

function parseArgs(argv) {
  const args = {
    source: "BOSS直聘",
    query: "",
    url: "",
    company: "",
    city: "",
    industry: "",
    role: "",
    roleFamily: "",
    route: "",
    segment: "",
    priority: "",
    batchId: "",
    batchTask: "",
    batchTargetCopies: "",
    salaryBand: "",
    dryRun: false,
    refresh: false
  };

  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const next = () => {
      i += 1;
      if (i >= argv.length) throw new Error(`Missing value for ${key}`);
      return argv[i];
    };
    if (key === "--file") args.file = resolve(next());
    else if (key === "--source") args.source = next();
    else if (key === "--query") args.query = next();
    else if (key === "--url") args.url = next();
    else if (key === "--company") args.company = next();
    else if (key === "--recruiter-id") args.recruiterId = next();
    else if (key === "--recruiter-name") args.recruiterName = next();
    else if (key === "--city") args.city = next();
    else if (key === "--industry") args.industry = next();
    else if (key === "--role") args.role = next();
    else if (key === "--role-family") args.roleFamily = next();
    else if (key === "--route") args.route = next();
    else if (key === "--segment") args.segment = next();
    else if (key === "--priority") args.priority = next();
    else if (key === "--batch-id") args.batchId = next();
    else if (key === "--batch-task") args.batchTask = next();
    else if (key === "--batch-target-copies") args.batchTargetCopies = next();
    else if (key === "--salary-band") args.salaryBand = next();
    else if (key === "--dry-run") args.dryRun = true;
    else if (key === "--refresh") args.refresh = true;
    else if (key === "--help" || key === "-h") args.help = true;
    else throw new Error(`Unknown option: ${key}`);
  }
  return args;
}

function readInputText(args) {
  if (args.file) return readFileSync(args.file, "utf8");

  try {
    return execFileSync("pbpaste", { encoding: "utf8" });
  } catch {
    throw new Error("无法读取剪贴板。也可以使用 --file 指定文本文件。");
  }
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function cleanLine(line) {
  return String(line || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function meaningfulLines(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map(cleanLine)
    .filter(Boolean);
}

function isSalaryLine(line) {
  return /(\d+\s*[-~到]\s*\d+\s*[kK万]|[kK]\s*·?\s*\d+\s*薪|\d+\s*-\s*\d+\s*元|月薪|年薪|薪资|[\uE000-\uF8FF]{2,})/.test(line);
}

function isExperienceLine(line) {
  return /(\d+\s*[-~到]\s*\d+\s*年|\d+\s*年(以上|以内)?|经验|应届|不限经验|经验不限)/.test(line);
}

function isEducationLine(line) {
  return /(博士|硕士|本科|大专|中专|学历不限|不限学历)/.test(line);
}

function isLocationLine(line) {
  return /(北京|上海|广州|深圳|杭州|成都|武汉|南京|苏州|西安|重庆|天津|佛山|东莞|珠海|厦门|合肥|长沙|郑州|全国|远程)([·\-\s]|$)/.test(line);
}

function isTitleLike(line) {
  if (!line || line.length > 80) return false;
  if (isSalaryLine(line) || isExperienceLine(line) || isEducationLine(line) || isLocationLine(line)) return false;
  return /(销售|售前|解决方案|客户成功|商务|BD|渠道|KA|大客户|经理|总监|顾问|架构师|AI|大模型|SaaS|云|智能体|Agent)/i.test(line);
}

function isMetaLine(line) {
  return isSalaryLine(line) || isExperienceLine(line) || isEducationLine(line) || isLocationLine(line);
}

function hasSalaryNearby(lines, index) {
  return lines.slice(index + 1, index + 6).some(isSalaryLine);
}

function splitBlocks(text) {
  const explicitBlocks = String(text)
    .split(/\n\s*(?:-{3,}|={3,}|--- JOB ---|###)\s*\n/i)
    .map((block) => block.trim())
    .filter(Boolean);
  if (explicitBlocks.length > 1) return explicitBlocks;

  const paragraphBlocks = String(text)
    .split(/\n\s*\n+/)
    .map((block) => block.trim())
    .filter(Boolean);
  if (paragraphBlocks.length > 1 && paragraphBlocks.some((block) => meaningfulLines(block).some(isSalaryLine))) {
    return paragraphBlocks;
  }

  const lines = meaningfulLines(text);
  const starts = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (isTitleLike(lines[index]) && hasSalaryNearby(lines, index)) starts.push(index);
  }
  if (starts.length <= 1) return [String(text).trim()];

  const blocks = [];
  for (let i = 0; i < starts.length; i += 1) {
    const start = starts[i];
    const end = starts[i + 1] ?? lines.length;
    blocks.push(lines.slice(start, end).join("\n"));
  }
  return blocks.filter(Boolean);
}

function inferRoleFamily(text) {
  if (/售前|解决方案|POC|架构师|顾问/.test(text)) return "售前/解决方案";
  if (/客户成功|交付|实施/.test(text)) return "客户成功/交付";
  if (/销售|BD|商务|大客户|KA|渠道/.test(text)) return "销售/商务";
  return "未分类";
}

function pickCompany(lines, args, locationIndex, salaryIndex, title) {
  if (args.company) return args.company;

  const afterSalary = salaryIndex >= 0 ? lines.slice(salaryIndex + 1) : lines;
  const localLocationIndex = afterSalary.findIndex(isLocationLine);
  if (localLocationIndex > 0) {
    const beforeLocation = afterSalary
      .slice(0, localLocationIndex)
      .filter((line) => !isMetaLine(line) && line !== title);
    if (beforeLocation.length) return beforeLocation.at(-1);
  }

  if (locationIndex > 0) {
    const beforeLocation = lines
      .slice(Math.max(0, locationIndex - 5), locationIndex)
      .filter((line) => !isMetaLine(line) && line !== title);
    if (beforeLocation.length) return beforeLocation.at(-1);
  }

  const companySectionIndex = lines.findIndex((line) => /公司基本信息|公司介绍|公司名称/.test(line));
  if (companySectionIndex >= 0) {
    const candidate = lines
      .slice(companySectionIndex + 1, companySectionIndex + 5)
      .find((line) => !isMetaLine(line) && !/融资|人数|行业|企业服务/.test(line));
    if (candidate) return candidate;
  }

  return "";
}

function extractBlock(block, args) {
  const lines = meaningfulLines(block);
  const salaryIndex = lines.findIndex(isSalaryLine);
  const salary = salaryIndex >= 0 ? lines[salaryIndex] : "";
  const locationIndex = lines.findIndex(isLocationLine);
  const location = args.city || (locationIndex >= 0 ? lines[locationIndex] : "");
  const experience = lines.find(isExperienceLine) || "";
  const education = lines.find(isEducationLine) || "";

  let title = "";
  if (salaryIndex > 0) {
    title = lines
      .slice(0, salaryIndex)
      .reverse()
      .find((line) => isTitleLike(line) || (!isMetaLine(line) && line.length <= 80)) || "";
  }
  if (!title) title = lines.find(isTitleLike) || lines[0] || "";

  const company = pickCompany(lines, args, locationIndex, salaryIndex, title);
  const combined = `${title}\n${block}`;

  return {
    title,
    company,
    salary,
    location,
    city: args.city || location,
    experience,
    education,
    firstLines: lines.slice(0, 10),
    roleFamily: args.roleFamily || inferRoleFamily(combined),
    rawText: block
  };
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

function recordId(record) {
  return createHash("sha256")
    .update([record.source, record.url, record.title, record.company, record.query, record.rawText, record.recruiter_id, record.recruiter_name].filter(Boolean).join("\n"))
    .digest("hex")
    .slice(0, 12);
}

function rawFileName(source, id) {
  return `${stamp()}_${id}_${basename(source).replace(/[^\w.-]+/g, "_")}.txt`;
}

function buildRecord(extracted, args) {
  const base = {
    collectedAt: new Date().toISOString(),
    source: args.source,
    sourceMode: "manual_clipboard",
    channel: args.source,
    recruiter_id: args.recruiterId || null,
    recruiter_name: args.recruiterName || null,
    query: args.query,
    queryKind: "manual",
    url: args.url,
    searchUrl: "",
    companyFilter: args.company,
    industryFilter: args.industry,
    role: args.role,
    route: args.route,
    segment: args.segment || args.industry,
    priority: args.priority,
    samplingBatchId: args.batchId,
    samplingBatchTask: args.batchTask,
    samplingBatchTargetCopies: args.batchTargetCopies,
    samplingSalaryBand: args.salaryBand,
    ...extracted
  };
  return {
    id: recordId(base),
    ...base
  };
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(usage());
    return;
  }

  const text = readInputText(args).trim();
  if (!text) {
    throw new Error("没有可导入的岗位文本。请先复制岗位详情，或使用 --file 指定文本文件。");
  }

  const blocks = splitBlocks(text);
  const records = blocks
    .map((block) => buildRecord(extractBlock(block, args), args))
    .filter((record) => record.title || record.rawText);

  if (args.dryRun) {
    console.log(JSON.stringify({
      dryRun: true,
      source: args.source,
      query: args.query,
      parsedCount: records.length,
      records: records.map((record) => ({
        id: record.id,
        title: record.title,
        company: record.company,
        recruiter_id: record.recruiter_id,
        recruiter_name: record.recruiter_name,
        salary: record.salary,
        location: record.location,
        experience: record.experience,
        education: record.education,
        roleFamily: record.roleFamily,
        route: record.route,
        segment: record.segment,
        samplingBatchId: record.samplingBatchId,
        samplingBatchTask: record.samplingBatchTask,
        firstLines: record.firstLines
      }))
    }, null, 2));
    return;
  }

  mkdirSync(rawDir, { recursive: true });
  const seenIds = existingIds();
  const imported = [];
  const skipped = [];

  for (const record of records) {
    if (seenIds.has(record.id)) {
      skipped.push(record);
      continue;
    }
    const rawPath = join(rawDir, rawFileName(args.source, record.id));
    writeFileSync(rawPath, record.rawText);
    appendFileSync(jobsPath, `${JSON.stringify({ ...record, rawPath })}\n`);
    seenIds.add(record.id);
    imported.push({ ...record, rawPath });
  }

  console.log(`人工导入完成：新增 ${imported.length} 条，跳过重复 ${skipped.length} 条`);
  if (imported.length) {
    console.log(`数据文件：${jobsPath}`);
    console.log(`首条标题：${imported[0].title || "未识别"}`);
    console.log(`首条公司：${imported[0].company || "未识别"}`);
  }
  if (args.refresh) {
    console.log("\n开始刷新本地市场报告。该步骤不打开、不读取、不刷新 BOSS 页面。");
    execFileSync(process.execPath, [refreshScriptPath], {
      cwd: projectRoot,
      stdio: "inherit",
      maxBuffer: 1024 * 1024 * 20
    });
  }
}

main();
