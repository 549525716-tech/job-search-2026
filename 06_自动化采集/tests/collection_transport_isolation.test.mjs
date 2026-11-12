import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../..", import.meta.url));
const scripts = {
  "collect:jobs": new URL("../scripts/collect_jobs.mjs", import.meta.url),
  "open:jobs": new URL("../scripts/open_searches.mjs", import.meta.url),
  "overnight:research": new URL("../scripts/overnight_research.mjs", import.meta.url),
  "collect:pulse": new URL("../scripts/collect_pulse_aisepulse.mjs", import.meta.url),
  "audit:research": new URL("../scripts/audit_research_status.mjs", import.meta.url)
};
const browserAutomationScripts = ["collect:jobs", "open:jobs"];
const protectedPaths = [
  "01_行情收集/data/processed",
  "01_行情收集/data/raw",
  "01_行情收集/data/jobs.jsonl",
  "01_行情收集/Pulse岗位信息采集报告.md",
  "01_行情收集/Pulse岗位信息采集报告.csv",
  ".career-auth-browser.pid",
  ".career-boss-browser.pid"
];

function snapshot() {
  return protectedPaths.map((relativePath) => {
    const path = join(projectRoot, relativePath);
    if (!existsSync(path)) return { relativePath, missing: true };
    const stat = statSync(path);
    return { relativePath, size: stat.size, mtimeMs: stat.mtimeMs };
  });
}

function run(command, configContents, args = ["--source", "猎聘"], {
  trapSpawn = true,
  trapFetch = true,
  trapHttp = true
} = {}) {
  const tempDir = mkdtempSync(join(tmpdir(), "collection-transport-test-"));
  const configPath = join(tempDir, "auth.json");
  const trapDir = join(tempDir, "bin");
  const trapLog = join(tempDir, "forbidden-browser-command.log");
  const spawnLog = join(tempDir, "forbidden-spawn.log");
  const fetchLog = join(tempDir, "forbidden-fetch.log");
  const httpLog = join(tempDir, "forbidden-http.log");
  const spawnTrapPath = join(tempDir, "spawn-trap.cjs");
  const fetchTrapPath = join(tempDir, "fetch-trap.cjs");
  const httpTrapPath = join(tempDir, "http-trap.cjs");
  const auditOutputPath = join(tempDir, "audit.md");
  if (configContents !== null) writeFileSync(configPath, configContents);
  mkdirSync(trapDir);
  for (const name of ["open", "Google Chrome", "Chromium"]) {
    const path = join(trapDir, name);
    writeFileSync(path, `#!/bin/sh\nprintf '%s\\n' '${name}' >> '${trapLog}'\nexit 97\n`);
    chmodSync(path, 0o755);
  }
  if (trapSpawn) {
    writeFileSync(spawnTrapPath, `const fs = require('node:fs'); const cp = require('node:child_process'); const mod = require('node:module'); cp.spawn = (...args) => { fs.appendFileSync(process.env.COLLECTION_TEST_SPAWN_LOG, JSON.stringify(args) + '\\n'); throw new Error('forbidden spawn'); }; mod.syncBuiltinESMExports();`);
  }
  if (trapFetch) {
    writeFileSync(fetchTrapPath, `const fs = require('node:fs'); global.fetch = (...args) => { fs.appendFileSync(process.env.COLLECTION_TEST_FETCH_LOG, JSON.stringify(args) + '\\n'); throw new Error('forbidden fetch'); };`);
  }
  if (trapHttp) {
    writeFileSync(httpTrapPath, `const fs = require('node:fs'); const mod = require('node:module'); for (const name of ['node:http', 'node:https']) { const client = require(name); for (const method of ['get', 'request']) { client[method] = (...args) => { fs.appendFileSync(process.env.COLLECTION_TEST_HTTP_LOG, JSON.stringify({ name, method, args }) + '\\n'); throw new Error('forbidden HTTP request'); }; } } mod.syncBuiltinESMExports();`);
  }
  const before = snapshot();
  const preload = [
    trapSpawn ? `--require=${spawnTrapPath}` : "",
    trapFetch ? `--require=${fetchTrapPath}` : "",
    trapHttp ? `--require=${httpTrapPath}` : "",
    process.env.NODE_OPTIONS || ""
  ].filter(Boolean).join(" ");
  const result = spawnSync(process.execPath, [fileURLToPath(scripts[command]), ...args], {
    cwd: projectRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      AUTH_TRANSPORT_CONFIG_PATH: configPath,
      COLLECTION_TEST_SPAWN_LOG: spawnLog,
      COLLECTION_TEST_FETCH_LOG: fetchLog,
      COLLECTION_TEST_HTTP_LOG: httpLog,
      RESEARCH_AUDIT_OUTPUT_PATH: auditOutputPath,
      NODE_OPTIONS: preload,
      PATH: `${trapDir}:${process.env.PATH}`
    }
  });
  const after = snapshot();
  const sideEffects = existsSync(trapLog) ? readFileSync(trapLog, "utf8") : "";
  const spawnEffects = existsSync(spawnLog) ? readFileSync(spawnLog, "utf8") : "";
  const fetchEffects = existsSync(fetchLog) ? readFileSync(fetchLog, "utf8") : "";
  const httpEffects = existsSync(httpLog) ? readFileSync(httpLog, "utf8") : "";
  const auditOutput = existsSync(auditOutputPath) ? readFileSync(auditOutputPath, "utf8") : "";
  rmSync(tempDir, { recursive: true, force: true });
  return { before, after, result, sideEffects, spawnEffects, fetchEffects, httpEffects, auditOutput };
}

function assertNoForbiddenEffects({ sideEffects, spawnEffects, fetchEffects, httpEffects }) {
  assert.equal(sideEffects, "");
  assert.equal(spawnEffects, "");
  assert.equal(fetchEffects, "");
  assert.equal(httpEffects, "");
}

for (const transport of ["codex-in-app-browser", "chrome-native-ui"]) {
  for (const command of browserAutomationScripts) {
    test(`${command} blocks browser automation for ${transport}`, () => {
      const resultState = run(command, JSON.stringify({ authTransport: transport }));
      const { before, after, result } = resultState;
      assert.equal(result.status, 2, result.stderr);
      assertNoForbiddenEffects(resultState);
      assert.deepEqual(after, before);
      const handoff = JSON.parse(result.stdout);
      assert.equal(handoff.transport, transport);
      assert.equal(handoff.requestedAction, "browser_collection");
      assert.equal(handoff.automationAllowed, false);
      assert.match(handoff.instruction, /Do not launch Chrome, connect to CDP\/Playwright/);
    });
  }
}

for (const [name, configContents] of [["unknown transport", "{}"], ["missing config", null]]) {
  for (const command of browserAutomationScripts) {
    test(`${command} fails closed for ${name}`, () => {
      const resultState = run(command, configContents);
      const { before, after, result } = resultState;
      assert.equal(result.status, 2, result.stderr);
      assertNoForbiddenEffects(resultState);
      assert.deepEqual(after, before);
      const handoff = JSON.parse(result.stdout);
      assert.equal(handoff.status, "NEEDS_BROWSER_CONFIGURATION");
      assert.equal(handoff.transport, "unknown");
      assert.equal(handoff.automationAllowed, false);
    });
  }
}

test("overnight:research blocks before spawning a collect child or writing a run report", () => {
  const resultState = run(
    "overnight:research",
    JSON.stringify({ authTransport: "codex-in-app-browser" }),
    []
  );
  const { before, after, result } = resultState;
  assert.equal(result.status, 2, result.stderr);
  assertNoForbiddenEffects(resultState);
  assert.deepEqual(after, before);
  const handoff = JSON.parse(result.stdout);
  assert.equal(handoff.command, "overnight:research");
  assert.equal(handoff.automationAllowed, false);
});

test("collect:pulse is isolated before fetch or production writes", () => {
  const resultState = run(
    "collect:pulse",
    JSON.stringify({ authTransport: "codex-in-app-browser" }),
    []
  );
  const { before, after, result } = resultState;
  assert.equal(result.status, 2, result.stderr);
  assertNoForbiddenEffects(resultState);
  assert.deepEqual(after, before);
  const handoff = JSON.parse(result.stdout);
  assert.equal(handoff.status, "LEGACY_PUBLIC_SOURCE_REQUIRES_REVIEW");
  assert.equal(handoff.collectionAllowed, false);
});

test("collect:pulse dry-run remains local planning, not job collection", () => {
  const resultState = run(
    "collect:pulse",
    JSON.stringify({ authTransport: "codex-in-app-browser" }),
    ["--dry-run"]
  );
  const { before, after, result } = resultState;
  assert.equal(result.status, 0, result.stderr);
  assertNoForbiddenEffects(resultState);
  assert.deepEqual(after, before);
  assert.match(result.stdout, /仅输出本地候选计划.*不代表岗位实采/);
});

test("audit:research reads local evidence without HTTP or fetch", () => {
  const resultState = run(
    "audit:research",
    JSON.stringify({ authTransport: "codex-in-app-browser" }),
    []
  );
  const { result, auditOutput } = resultState;
  assert.equal(result.status, 0, result.stderr);
  assertNoForbiddenEffects(resultState);
  assert.match(auditOutput, /浏览器检查.*未访问 9333\/CDP/);
  assert.match(auditOutput, /BOSS状态.*未检查（控制链路隔离）/);
  assert.match(auditOutput, /暂停自动采集；控制链路隔离.*不要求重复登录/);
  assert.match(auditOutput, /Codex 普通浏览页中；不要重新登录、不要接管该标签/);
  assert.match(auditOutput, /控制通道尚未验收前.*保持自动采集暂停/);
  assert.doesNotMatch(auditOutput, /持久化 Chrome|npm run (?:overnight:research|collect:jobs)|--resume-after-risk/);
});
