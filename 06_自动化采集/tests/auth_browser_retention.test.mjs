import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { defaultAuthBrowserPlan, planHasDestructiveAction } from "../scripts/auth_browser_policy.mjs";

for (const scenario of [
  { name: "start retains an existing project browser", input: { command: "start", daemonAlive: true } },
  { name: "BOSS open retains CDP and prior project profiles", input: { command: "open", bossTarget: true, daemonAlive: true } },
  { name: "ordinary open reports stale launch diagnostics without restart", input: { command: "open", daemonAlive: true, launchIssues: ["about:blank"] } }
]) {
  test(scenario.name, () => {
    const plan = defaultAuthBrowserPlan(scenario.input);
    assert.equal(planHasDestructiveAction(plan), false);
    assert.deepEqual(plan.destructiveActions, []);
    assert.equal(plan.actions.includes("stop_project_browser"), false);
    assert.equal(plan.actions.includes("restart_project_browser"), false);
    assert.equal(plan.actions.includes("clear_profile"), false);
    assert.equal(plan.actions.includes("clear_cookies"), false);
  });
}

test("real default command handlers do not call lifecycle termination helpers", () => {
  const source = readFileSync(new URL("../scripts/auth_browser.mjs", import.meta.url), "utf8");
  const functions = [...source.matchAll(/^async function (\w+)\(/gm)];
  for (const name of ["startDaemon", "openBossHumanMode", "openPlatform"]) {
    const index = functions.findIndex(match => match[1] === name);
    assert.notEqual(index, -1, `Missing actual handler ${name}`);
    const body = source.slice(functions[index].index, functions[index + 1]?.index ?? source.length);
    assert.doesNotMatch(body, /\b(?:stopBrowser|stopAllBrowsers|stopBossHumanBrowser|restartDaemon|terminatePids)\s*\(/, name);
    assert.doesNotMatch(body, /process\.kill\s*\(/, name);
  }
  assert.match(source, /args\.command === "stop"\) await stopAllBrowsers\(/);
});
