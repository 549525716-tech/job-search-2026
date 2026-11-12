import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";
import * as path from "node:path";
import * as url from "node:url";

const scriptUrl = new URL("../scripts/auth_browser.mjs", import.meta.url);
const policyUrl = new URL("../scripts/auth_browser_policy.mjs", import.meta.url);
const transportPolicyUrl = new URL("../scripts/auth_transport_policy.mjs", import.meta.url);
const script = readFileSync(scriptUrl, "utf8");
const policy = readFileSync(policyUrl, "utf8");
const config = {
  cdpPort: 9333,
  profileDir: ".career-browser-profile",
  bossProfileDir: ".career-boss-profile",
  startUrl: "data:text/html,ready",
  defaultLoginSource: "BOSS直聘",
  loginUrls: { "BOSS直聘": "https://www.zhipin.com/", "猎聘": "https://passport.liepin.com/login/" }
};

async function runOpen(fixture) {
  const calls = { spawn: [], open: [], kill: [], writes: [], fetch: [] };
  const profileCommand = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome --user-data-dir=/Users/MR/Documents/职场/.career-browser-profile --remote-debugging-port=9333";
  const activePids = new Set([...(fixture.pidAlive ? [101] : []), ...(fixture.profileAlive ? [202] : []), ...(fixture.bossAlive ? [303] : [])]);
  const pidExists = (file) => String(file).endsWith(".career-auth-browser.pid") && Boolean(fixture.pidFile);
  const bossPidExists = (file) => String(file).endsWith(".career-boss-browser.pid") && Boolean(fixture.bossPidFile);
  const fs = {
    existsSync(file) {
      const value = String(file);
      return value.endsWith("auth.json") || value.includes("Google Chrome.app") || pidExists(file) || bossPidExists(file);
    },
    readFileSync(file) {
      const value = String(file);
      if (value.endsWith("auth.json")) return JSON.stringify(config);
      if (value.endsWith(".career-auth-browser.pid")) return "101";
      if (value.endsWith(".career-boss-browser.pid")) return "303";
      throw new Error(`unexpected read: ${value}`);
    },
    appendFileSync() { calls.writes.push("append"); },
    mkdirSync() { calls.writes.push("mkdir"); },
    openSync() { calls.open.push("file"); return 9; },
    unlinkSync() { calls.writes.push("unlink"); },
    writeFileSync() { calls.writes.push("write"); }
  };
  const child = { pid: 701, unref() {} };
  const childProcess = {
    spawn(command, args) { calls.spawn.push({ command, args }); return child; },
    execFileSync(command, args) {
      if (command === "ps" && args[0] === "-axo") return fixture.profileAlive ? `202 ${profileCommand}\n` : "";
      if (command === "ps") return fixture.pidAlive ? profileCommand : "";
      if (command === "lsof") return "";
      throw new Error(`unexpected command: ${command}`);
    }
  };
  const fetch = async (value) => {
    const request = String(value);
    calls.fetch.push(request);
    if (request.endsWith("/json/version")) {
      if (fixture.version === "error") throw new Error("version timeout");
      return { ok: true, status: 200, json: async () => ({ Browser: "mock" }) };
    }
    if (request.endsWith("/json/list")) {
      if (fixture.list === "error") throw new Error("list timeout");
      if (fixture.list === "503") return { ok: false, status: 503, json: async () => [] };
      return { ok: true, status: 200, json: async () => fixture.tabs || [] };
    }
    if (request.includes("/json/activate/")) {
      if (fixture.activate === "error") throw new Error("activate timeout");
      return { ok: fixture.activate !== "false", status: fixture.activate === "false" ? 500 : 200, json: async () => ({}) };
    }
    throw new Error(`unexpected fetch: ${request}`);
  };
  const context = createContext({
    URL, AbortSignal, fetch, console: { log() {}, error() {} },
    process: {
      argv: ["node", "auth_browser.mjs", fixture.command || "open", "--source", "猎聘"],
      env: {},
      kill(pid, signal) { calls.kill.push({ pid, signal }); if (signal === 0 && activePids.has(pid)) return; throw new Error("not alive"); },
      exit(code) { throw new Error(`unexpected exit ${code}`); }
    }
  });
  const moduleMap = new Map();
  const mock = (specifier, exports) => moduleMap.set(specifier, new SyntheticModule(Object.keys(exports), function setExports() {
    for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
  }, { context }));
  mock("node:fs", fs);
  mock("node:child_process", childProcess);
  mock("node:path", path);
  mock("node:url", url);
  const policyModule = new SourceTextModule(policy, { context, identifier: policyUrl.href });
  moduleMap.set("./auth_browser_policy.mjs", policyModule);
  mock("./auth_transport_policy.mjs", {
    readAuthTransport: () => ({ state: "configured", transport: "chrome-native-ui" }),
    nativeUiCheckHandoff: ({ command, source, transport, url }) => ({ status: "NEEDS_NATIVE_UI_CHECK", command, source, transport, url })
  });
  const executable = script.replace(/\nmain\(\)\.catch\([\s\S]*$/, "\nglobalThis.authRun = main();\n");
  const mainModule = new SourceTextModule(executable, {
    context,
    identifier: scriptUrl.href,
    initializeImportMeta(meta) { meta.url = scriptUrl.href; }
  });
  await mainModule.link((specifier) => {
    assert.ok(moduleMap.has(specifier), `unexpected import: ${specifier}`);
    return moduleMap.get(specifier);
  });
  await mainModule.evaluate();
  await context.authRun;
  return calls;
}

const liepinTab = { id: "liepin-home", type: "page", url: "https://www.liepin.com/", title: "猎聘", webSocketDebuggerUrl: "ws://mock" };

for (const [name, fixture] of [
  ["CDP read failure retains without spawn", { pidFile: true, pidAlive: true, version: "error" }],
  ["tab-list failure retains without spawn", { pidFile: true, pidAlive: true, list: "503" }],
  ["activation failure retains matching tab without spawn", { pidFile: true, pidAlive: true, tabs: [liepinTab], activate: "error" }],
  ["blank tab retains without spawn", { pidFile: true, pidAlive: true, tabs: [{ id: "blank", type: "page", url: "about:blank", title: "", webSocketDebuggerUrl: "ws://blank" }] }],
  ["start with missing PID and live profile retains without spawn", { command: "start", profileAlive: true }],
  ["missing PID with live profile retains without spawn", { profileAlive: true, tabs: [liepinTab] }],
  ["start refusal from active BOSS retains without spawn", { bossPidFile: true, bossAlive: true }],
  ["Liepin homepage is reused across approved domains", { pidFile: true, pidAlive: true, tabs: [liepinTab] }]
]) {
  test(name, async () => {
    const calls = await runOpen(fixture);
    assert.equal(calls.spawn.length, 0);
    assert.equal(calls.open.length, 0);
    assert.equal(calls.writes.length, 0);
    assert.equal(calls.kill.filter((item) => item.signal && item.signal !== 0).length, 0);
    assert.equal(calls.fetch.some((value) => /\/json\/(?:close|reload)/.test(value)), false);
  });
}

test("similar Liepin-looking hostname is not reused", async () => {
  const calls = await runOpen({
    pidFile: true,
    pidAlive: true,
    tabs: [
      { id: "impostor", type: "page", url: "https://passport.liepin.com.evil.test/", title: "fake", webSocketDebuggerUrl: "ws://fake" },
      { id: "blank", type: "page", url: "about:blank", title: "", webSocketDebuggerUrl: "ws://blank" }
    ]
  });
  assert.equal(calls.spawn.length, 0);
  assert.equal(calls.fetch.some((value) => value.includes("/json/activate/")), false);
});
