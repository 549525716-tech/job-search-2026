#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const jobsPath = join(projectRoot, "01_行情收集/data/jobs.jsonl");
const readableSalaryPath = join(projectRoot, "01_行情收集/BOSS可读薪资样本.csv");
const goalAuditPath = join(projectRoot, "01_行情收集/AI销售岗位调研目标完成度审计.csv");

const steps = [
  {
    label: "刷新岗位机会和基础能力看板",
    command: ["npm", "run", "summary:jobs", "--silent"]
  },
  {
    label: "刷新全量市场报告、薪资、能力、采样缺口和目标完成度",
    command: ["npm", "run", "report:full", "--silent"]
  }
];

function usage() {
  return `Usage:
  npm run refresh:market

Purpose:
  Refresh all local market reports after manual BOSS job text import.

Safety:
  This command only reads and writes local project files. It does not open,
  read, refresh, navigate, or control BOSS pages.
`;
}

function parseArgs(argv) {
  const args = {};
  for (let index = 2; index < argv.length; index += 1) {
    const key = argv[index];
    if (key === "--help" || key === "-h") args.help = true;
    else throw new Error(`Unknown option: ${key}`);
  }
  return args;
}

function lineCount(filePath, hasHeader = false) {
  if (!existsSync(filePath)) return 0;
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/).filter((line) => line.trim());
  return Math.max(0, lines.length - (hasHeader ? 1 : 0));
}

function bossJobCount(filePath) {
  if (!existsSync(filePath)) return 0;
  return readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => {
      try {
        const job = JSON.parse(line);
        return !job.source || job.source === "BOSS直聘";
      } catch {
        return false;
      }
    }).length;
}

function csvStatusCounts(filePath) {
  if (!existsSync(filePath)) return {};
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return {};
  const headers = lines[0].split(",");
  const statusIndex = headers.indexOf("status");
  if (statusIndex < 0) return {};
  const counts = {};
  for (const line of lines.slice(1)) {
    const values = line.split(",");
    const status = values[statusIndex] || "未知";
    counts[status] = (counts[status] || 0) + 1;
  }
  return counts;
}

function printSnapshot(label) {
  const statusCounts = csvStatusCounts(goalAuditPath);
  console.log(`\n${label}`);
  console.log(`- BOSS干净样本：${bossJobCount(jobsPath)}`);
  console.log(`- BOSS可读薪资：${lineCount(readableSalaryPath, true)}`);
  if (Object.keys(statusCounts).length) {
    console.log(`- 目标完成度：阶段完成 ${statusCounts["阶段完成"] || 0}，部分完成 ${statusCounts["部分完成"] || 0}，未完成 ${statusCounts["未完成"] || 0}`);
  }
}

function runStep(step) {
  console.log(`\n==> ${step.label}`);
  execFileSync(step.command[0], step.command.slice(1), {
    cwd: projectRoot,
    stdio: "inherit",
    env: process.env
  });
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(usage());
    return;
  }

  console.log("本地刷新模式：不打开、不读取、不刷新、不跳转 BOSS 页面。");
  printSnapshot("刷新前");
  for (const step of steps) runStep(step);
  printSnapshot("刷新后");
}

main();
