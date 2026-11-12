import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptPath = new URL("../scripts/auth_browser.mjs", import.meta.url);
const authArtifacts = [
  ".career-auth-browser.pid",
  ".career-boss-browser.pid",
  ".career-auth-browser.log",
  ".career-boss-browser.log",
  "01_行情收集/BOSS登录安全入口.html",
  "01_行情收集/data/processed/boss_handoff_state.json",
  "01_行情收集/data/processed/boss_action_audit.jsonl"
];

function artifactSnapshot(projectRoot) {
  return authArtifacts.map((relativePath) => {
    const path = join(projectRoot, relativePath);
    return existsSync(path) ? { relativePath, size: statSync(path).size, mtimeMs: statSync(path).mtimeMs } : { relativePath, missing: true };
  });
}

function runHandler(command, configContents, args = []) {
  const tempDir = mkdtempSync(join(tmpdir(), "auth-transport-test-"));
  const configPath = join(tempDir, "auth.json");
  const sentinelPath = join(tempDir, "sentinel");
  const trapDir = join(tempDir, "bin");
  const trapLog = join(tempDir, "forbidden-side-effect.log");
  const fetchTrapPath = join(tempDir, "fetch-trap.cjs");
  const projectRoot = fileURLToPath(new URL("../..", import.meta.url));
  if (configContents !== null) writeFileSync(configPath, configContents, "utf8");
  writeFileSync(sentinelPath, "unchanged", "utf8");
  mkdirSync(trapDir);
  for (const commandName of ["ps", "lsof", "open"]) {
    const commandPath = join(trapDir, commandName);
    writeFileSync(commandPath, `#!/bin/sh\nprintf '%s\\n' ${commandName} >> '${trapLog}'\nexit 97\n`, "utf8");
    chmodSync(commandPath, 0o755);
  }
  writeFileSync(fetchTrapPath, "global.fetch = () => { throw new Error('forbidden fetch'); };", "utf8");
  const before = readFileSync(sentinelPath, "utf8");
  const beforeArtifacts = artifactSnapshot(projectRoot);
  const result = spawnSync(process.execPath, [fileURLToPath(scriptPath), command, ...args], {
    cwd: projectRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      AUTH_TRANSPORT_CONFIG_PATH: configPath,
      NODE_OPTIONS: `--require=${fetchTrapPath}`,
      PATH: `${trapDir}:${process.env.PATH}`
    }
  });
  const after = readFileSync(sentinelPath, "utf8");
  const afterArtifacts = artifactSnapshot(projectRoot);
  const sideEffects = existsSync(trapLog) ? readFileSync(trapLog, "utf8") : "";
  rmSync(tempDir, { recursive: true, force: true });
  return { result, before, after, beforeArtifacts, afterArtifacts, sideEffects };
}

for (const command of ["start", "run", "open", "status", "check", "restart", "stop"]) {
  test(`${command} uses the real handler transport gate without side effects`, () => {
    const { result, before, after, beforeArtifacts, afterArtifacts, sideEffects } = runHandler(command, '{"authTransport":"chrome-native-ui"}');
    assert.equal(result.status, 2, result.stderr);
    assert.equal(before, after);
    assert.deepEqual(afterArtifacts, beforeArtifacts);
    assert.equal(sideEffects, "");
    assert.deepEqual(JSON.parse(result.stdout), {
      status: "NEEDS_NATIVE_UI_CHECK",
      command,
      transport: "chrome-native-ui",
      requestedSource: null,
      requestedUrl: null,
      loginState: "unknown",
      recoveryState: "unknown",
      urlHandling: "record-only",
      cliAction: "none",
      handoff: {
        executor: "supported CUA native Chrome UI",
        instruction: "Use the existing native Chrome tabs to check the account and readable full JD. The CLI is not a native UI executor."
      }
    });
  });
}

for (const [name, contents] of [["missing config file", null], ["missing transport", "{}"], ["damaged config", "{" ]]) {
  test(`${name} fails closed with unknown transport`, () => {
    const { result } = runHandler("status", contents);
    assert.equal(result.status, 2, result.stderr);
    const handoff = JSON.parse(result.stdout);
    assert.equal(handoff.status, "NEEDS_BROWSER_CONFIGURATION");
    assert.equal(handoff.handoff.executor, "none");
    assert.equal(handoff.transport, "unknown");
    assert.equal(handoff.loginState, "unknown");
    assert.equal(handoff.recoveryState, "unknown");
  });
}

test("URL and source are recorded but never opened", () => {
  const { result, sideEffects } = runHandler("open", '{"authTransport":"chrome-native-ui"}', ["--source", "猎聘", "--url", "https://example.test/job/42"]);
  assert.equal(result.status, 2, result.stderr);
  const handoff = JSON.parse(result.stdout);
  assert.equal(handoff.requestedSource, "猎聘");
  assert.equal(handoff.requestedUrl, "https://example.test/job/42");
  assert.equal(sideEffects, "");
});

for (const flag of ["--force-open", "--isolated-boss-profile", "--launch-handoff", "--open-handoff", "--direct-boss", "--direct", "--boss-link", "--reuse-boss"]) {
  test(`${flag} cannot bypass the native transport isolation`, () => {
    const { result, sideEffects, beforeArtifacts, afterArtifacts } = runHandler("open", '{"authTransport":"chrome-native-ui"}', ["--source", "BOSS直聘", flag]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /chrome-native-ui/);
    assert.equal(result.stdout, "");
    assert.equal(sideEffects, "");
    assert.deepEqual(afterArtifacts, beforeArtifacts);
  });
}

for (const command of ["start", "run", "open", "status", "check", "restart", "stop"]) {
  test(`${command} hands off only to IAB with a 10-second check floor and paused login reloads`, () => {
    const { result, sideEffects, beforeArtifacts, afterArtifacts } = runHandler(command, '{"authTransport":"codex-in-app-browser"}');
    assert.equal(result.status, 2, result.stderr);
    assert.equal(sideEffects, "");
    assert.deepEqual(afterArtifacts, beforeArtifacts);
    const handoff = JSON.parse(result.stdout);
    assert.equal(handoff.status, "NEEDS_IN_APP_BROWSER_CHECK");
    assert.equal(handoff.transport, "codex-in-app-browser");
    assert.equal(handoff.handoff.executor, "Codex ordinary browser tab via codex_app.open_in_codex");
    assert.match(handoff.handoff.instruction, /not cua\.createBrowserTab/);
    assert.equal(handoff.cliAction, "none");
    assert.equal(handoff.loginState, "unknown");
    assert.deepEqual(handoff.interactionPolicy, {
      loginEntryMechanism: "codex_app.open_in_codex",
      browserAutomationDuringLogin: false,
      stateCheckIntervalMs: 10000,
      minimumReloadIntervalMs: 10000,
      stateChecksWhileAwaitingUser: false,
      reloadWhileAwaitingUser: false,
      automaticKeepaliveRefresh: false,
      desktopFallback: false
    });
  });
}

test("the project default selects IAB, not desktop Chrome", () => {
  const config = JSON.parse(readFileSync(new URL('../config/auth.json', import.meta.url), 'utf8'));
  assert.equal(config.authTransport, "codex-in-app-browser");
});
