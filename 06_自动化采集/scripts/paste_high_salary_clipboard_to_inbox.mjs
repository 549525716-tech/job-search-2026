#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const inboxPath = join(projectRoot, "01_行情收集/BOSS高薪销售岗位采样收件箱.md");
const highSalaryQueuePath = join(projectRoot, "01_行情收集/BOSS高薪销售岗位低频采样清单.csv");
const statusScriptPath = join(projectRoot, "06_自动化采集/scripts/import_manual_sampling_inbox.mjs");

function usage() {
  return `Usage:
  npm run paste:highsalary-current
  npm run paste:highsalary-current -- --rank 1
  npm run paste:highsalary-current -- --file ./job.txt
  npm run paste:highsalary-current -- --append
  npm run paste:highsalary-current -- --replace

Purpose:
  Paste manually copied BOSS job text into the matching high-salary inbox
  section. This command only reads your local clipboard or a local file and
  writes local project files. It never opens, reads, refreshes, or controls
  BOSS pages.
`;
}

function parseArgs(argv) {
  const args = {
    rank: null,
    append: false,
    replace: false,
    status: true
  };
  for (let index = 2; index < argv.length; index += 1) {
    const key = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${key}`);
      return argv[index];
    };
    if (key === "--rank") args.rank = Number.parseInt(next(), 10);
    else if (key === "--file") args.file = resolve(next());
    else if (key === "--append") args.append = true;
    else if (key === "--replace") args.replace = true;
    else if (key === "--no-status") args.status = false;
    else if (key === "--help" || key === "-h") args.help = true;
    else throw new Error(`Unknown option: ${key}`);
  }
  if (args.rank !== null && (!Number.isInteger(args.rank) || args.rank <= 0)) throw new Error("--rank must be a positive integer");
  if (args.append && args.replace) throw new Error("--append and --replace cannot be used together");
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

function readCurrentRank() {
  if (!existsSync(highSalaryQueuePath)) return 1;
  const lines = readFileSync(highSalaryQueuePath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim());
  if (lines.length < 2) return 1;
  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
  });
  const current = rows.find((row) => row.currentTask === "是") || rows.find((row) => Number(row.remainingCopies || 0) > 0) || rows[0];
  const rank = Number.parseInt(current?.rank || "1", 10);
  return Number.isInteger(rank) && rank > 0 ? rank : 1;
}

function readInputText(args) {
  if (args.file) {
    if (!existsSync(args.file)) throw new Error(`未找到输入文件：${args.file}`);
    return readFileSync(args.file, "utf8");
  }
  try {
    return execFileSync("pbpaste", { encoding: "utf8" });
  } catch {
    throw new Error("无法读取剪贴板。也可以使用 --file 指定文本文件。");
  }
}

function cleanPlaceholder(text) {
  return String(text || "")
    .split(/\r?\n/)
    .filter((line) => !/^在这里粘贴 .+ 的岗位详情。导入后可清空本段文本，保留标记。$/.test(line.trim()))
    .join("\n")
    .trim();
}

function normalizePastedText(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .trim();
}

function parseInboxSections(text) {
  const pattern = /(<!-- BOSS_INBOX_TASK_START -->\s*([\s\S]*?)\s*<!-- BOSS_INBOX_TASK_END -->[\s\S]*?<!-- BOSS_INBOX_TEXT_START -->)([\s\S]*?)(<!-- BOSS_INBOX_TEXT_END -->)/g;
  const sections = [];
  let match;
  while ((match = pattern.exec(text)) !== null) {
    let metadata = {};
    try {
      metadata = JSON.parse(match[2].trim());
    } catch (error) {
      throw new Error(`收件箱元数据解析失败：${error.message}`);
    }
    sections.push({
      start: match.index,
      end: match.index + match[0].length,
      prefix: match[1],
      rawText: match[3],
      suffix: match[4],
      metadata
    });
  }
  return sections;
}

function mergeInboxText(existingRawText, pastedText, args) {
  const existing = cleanPlaceholder(existingRawText);
  if (!existing || args.replace) return pastedText;
  if (args.append) return `${existing}\n\n---\n\n${pastedText}`;
  throw new Error("目标段落已有岗位文本。请使用 --append 追加，或使用 --replace 覆盖。");
}

function updateInbox(inboxText, section, mergedText) {
  const replacement = `${section.prefix}\n${mergedText.trim()}\n${section.suffix}`;
  return `${inboxText.slice(0, section.start)}${replacement}${inboxText.slice(section.end)}`;
}

function runStatus() {
  execFileSync(process.execPath, [
    statusScriptPath,
    "--file",
    inboxPath,
    "--status"
  ], {
    cwd: projectRoot,
    stdio: "inherit",
    maxBuffer: 1024 * 1024 * 10
  });
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(usage());
    return;
  }
  if (!existsSync(inboxPath)) throw new Error(`未找到高薪收件箱：${inboxPath}`);
  const targetRank = args.rank || readCurrentRank();

  const pastedText = normalizePastedText(readInputText(args));
  if (!pastedText) throw new Error("输入内容为空。请先在 BOSS 岗位详情页复制岗位文本。");

  const inboxText = readFileSync(inboxPath, "utf8");
  const sections = parseInboxSections(inboxText);
  const section = sections.find((item) => Number(item.metadata.rank) === targetRank);
  if (!section) throw new Error(`未找到 rank=${targetRank} 的收件箱段落。请先运行 npm run sampling:highsalary。`);

  const mergedText = mergeInboxText(section.rawText, pastedText, args);
  writeFileSync(inboxPath, updateInbox(inboxText, section, mergedText), "utf8");

  console.log(`已写入高薪收件箱第 ${targetRank} 段：${section.metadata.company} / ${section.metadata.role}`);
  console.log(`文本长度：${pastedText.length} 字符`);
  console.log(`收件箱：${inboxPath}`);

  if (args.status) runStatus();
}

main();
