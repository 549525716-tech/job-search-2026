import { readFileSync } from "node:fs";

export const NATIVE_UI_CHECK_STATUS = "NEEDS_NATIVE_UI_CHECK";
export const NATIVE_UI_TRANSPORT = "chrome-native-ui";
export const IN_APP_TRANSPORT = "codex-in-app-browser";
export const LEGACY_PUBLIC_SOURCE_REQUIRES_REVIEW = "LEGACY_PUBLIC_SOURCE_REQUIRES_REVIEW";
export const LOGIN_INTERACTION_POLICY = Object.freeze({
  loginEntryMechanism: "codex_app.open_in_codex",
  browserAutomationDuringLogin: false,
  stateCheckIntervalMs: 10_000,
  minimumReloadIntervalMs: 10_000,
  stateChecksWhileAwaitingUser: false,
  reloadWhileAwaitingUser: false,
  automaticKeepaliveRefresh: false,
  desktopFallback: false
});

export function readAuthTransport(configPath) {
  try {
    const config = JSON.parse(readFileSync(configPath, "utf8"));
    return [NATIVE_UI_TRANSPORT, IN_APP_TRANSPORT].includes(config?.authTransport)
      ? { state: "configured", transport: config.authTransport }
      : { state: "unknown", transport: null };
  } catch {
    return { state: "unknown", transport: null };
  }
}

export function nativeUiCheckHandoff({ command, source, transport, url }) {
  const inApp = transport === IN_APP_TRANSPORT;
  const native = transport === NATIVE_UI_TRANSPORT;
  return {
    status: inApp ? "NEEDS_IN_APP_BROWSER_CHECK" : native ? NATIVE_UI_CHECK_STATUS : "NEEDS_BROWSER_CONFIGURATION",
    command,
    transport,
    requestedSource: source || null,
    requestedUrl: url || null,
    loginState: "unknown",
    recoveryState: "unknown",
    urlHandling: "record-only",
    cliAction: "none",
    ...(inApp ? { interactionPolicy: LOGIN_INTERACTION_POLICY } : {}),
    handoff: inApp ? {
      executor: "Codex ordinary browser tab via codex_app.open_in_codex",
      instruction: "Open the login entry once with codex_app.open_in_codex, not cua.createBrowserTab or an automation-managed tab. A queued reply is not proof of a visible page. During login handoff do not acquire the tab through CUA/Playwright, poll, inspect, click, reload, or navigate; wait for the user to report completion. Preserve the ordinary tab without acquiring it just to mark retention. Browser-controlled collection after login requires separate validation and must not restart a reload loop. After handoff, checks must be at least 10 seconds apart. No desktop Chrome fallback. The CLI does not execute browser actions or schedule refreshes."
    } : native ? {
      executor: "supported CUA native Chrome UI",
      instruction: "Use the existing native Chrome tabs to check the account and readable full JD. The CLI is not a native UI executor."
    } : {
      executor: "none",
      instruction: "Resolve the browser configuration before operating any browser. Do not automatically fall back to desktop Chrome."
    }
  };
}

// CLI collectors cannot control either supported login surface. Keep this
// separate from dry-run planning, which never attaches to or opens a browser.
export function collectionAutomationHandoff({ command, source, transport }) {
  const handoff = nativeUiCheckHandoff({ command, source, transport });
  return {
    ...handoff,
    requestedAction: "browser_collection",
    automationAllowed: false,
    instruction: "Browser collection is unavailable from this CLI while login transport isolation is active. Do not launch Chrome, connect to CDP/Playwright, open tabs, navigate, reload, or inspect the retained login tab. Use the configured Codex IAB handoff and a separately validated collection path. --dry-run remains local planning only."
  };
}

export function legacyPublicSourceReviewHandoff({ command, source }) {
  return {
    status: LEGACY_PUBLIC_SOURCE_REQUIRES_REVIEW,
    command,
    requestedSource: source || null,
    cliAction: "none",
    collectionAllowed: false,
    instruction: "This legacy public-source collector is isolated pending a reviewed modern adapter. It must not fetch, retry 403/429 responses, or write job records. --dry-run is local planning only and is not job collection."
  };
}
