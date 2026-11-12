const DESTRUCTIVE_ACTIONS = new Set([
  "stop_project_browser",
  "restart_project_browser",
  "clear_profile",
  "clear_cookies"
]);

export function defaultAuthBrowserPlan({ command, bossTarget = false, daemonAlive = false, launchIssues = [], connectionState = "known" }) {
  if (command === "start" || command === "run") {
    return {
      mode: "start",
      actions: daemonAlive ? ["report_existing_browser"] : ["launch_if_absent"],
      destructiveActions: []
    };
  }

  if (command === "open" && bossTarget) {
    return {
      mode: "boss_handoff",
      actions: ["generate_local_handoff"],
      destructiveActions: [],
      retainExistingBrowser: true
    };
  }

  if (command === "open") {
    if (connectionState !== "known") {
      return {
        mode: "platform_open_manual_takeover",
        actions: ["retain_existing_browser", "report_connection_state", "manual_takeover"],
        destructiveActions: [],
        retainExistingBrowser: true,
        allowBrowserOpen: false
      };
    }
    return {
      mode: "platform_open",
      actions: daemonAlive
        ? ["reuse_or_open_platform", ...(launchIssues.length ? ["report_launch_issues"] : [])]
        : ["launch_if_absent", "reuse_or_open_platform"],
      destructiveActions: [],
      retainExistingBrowser: true,
      allowBrowserOpen: true
    };
  }

  return { mode: "explicit_lifecycle", actions: [], destructiveActions: [] };
}

export function planHasDestructiveAction(plan) {
  return plan.destructiveActions.some((action) => DESTRUCTIVE_ACTIONS.has(action));
}
