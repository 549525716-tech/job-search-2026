# Collector checkpoint

- status: stopped_before_network
- campaign: sweep-2026-09-14-coverage
- execution_id: unique001
- cwd: `/Users/MR/Documents/职场`
- helper: `careers/web-session.mjs`
- attempted_command: `node careers/web-session.mjs research/sweep-2026-09-14-coverage`
- observed_runtime: `node v22.22.0`
- failure: `RESEARCH_CHILD_DIRECTORY_REQUIRED`
- session_ready: false
- network_calls: 0
- admitted_calls: 0
- completed_queries: 0
- completed_followup_reads: 0
- remaining: 12 initial discovery queries and 8 follow-up directory/job reads; no web calls were made.
- boundary: Stopped immediately after helper startup failure. No alternate helper invocation, web call, source retry, bypass, application action, scheduling, or code change was performed.
- note: A bundled Node runtime was located locally after stopping, but it was not used to restart the helper. The requested `web-session.jsonl`, `company-discoveries.json`, and `job-leads.json` were therefore not created because no capture was admitted.

## Authorized continuation attempt

- corrected_start: `/Users/MR/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node /Users/MR/Documents/职场/careers/web-session.mjs /Users/MR/Documents/职场/01_行情收集/official-careers/research/sweep-2026-09-14-coverage`
- helper_started: true
- helper_pid: `96010`
- runtime: bundled Node runtime requested by the user
- capture_id: `unique001`
- queue_admitted_at: `2026-09-14T13:22:51.595Z`
- operation: `search_query`
- request: `site:cac.gov.cn 生成式人工智能 服务 备案 信息 公告 2026`
- web_call: issued once after admission
- persistence_failure: orchestration failed before writing the full web-tool result because `Buffer is not defined` in the wrapper
- finish: not recorded; helper was interrupted after the persistence failure and exited with code 1
- continuation_status: stopped; no retry of the query and no subsequent web calls
- current_actual_counts: web calls 1; admitted captures 1; persisted raw captures 0; company candidates 0; complete JD pages 0
- remaining: 11 initial discovery queries and 8 follow-up directory/job reads, plus unresolved `unique001` raw evidence
