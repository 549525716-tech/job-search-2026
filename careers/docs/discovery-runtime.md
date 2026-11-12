# Bounded Discovery Runtime

## Implemented Boundary

This runtime implements local evidence import -> persistent employer/channel frontier -> explicit source approval -> frozen bounded execution -> normalized results and restartable checkpoints. It does not implement an internet search engine, automatic company research, authenticated collection, dynamic ATS automation, application submission, or market-wide exhaustion.

Any reasonable recruitment, industry, announcement or company website can enter discovery through explicit JSON input. Existing config files are seeds, not a source whitelist. By default, preparation also reads `reports/market-sweep.json`, follows its `input_dir` only within a real `official-careers/research/` child directory, and imports the referenced `jobs.json` only if its original bytes match `jobs_sha256`. Its original file hash and report hash are retained. Report-supplied source approvals are ignored. Missing reports are reported as unavailable; path escape or stale hashes fail the command, not silently succeed. `--no-seeds` disables both the seeds and this automatic pointer for isolated explicit-input runs.

Unknown channels remain in `channels` with a pending implementation/verification task. Unverified employer identity records remain in `companies` and `pending`; their count is not a count of independently verified companies. A URL found in a document never becomes an HTTP allowlist entry.

New runtime artifacts are confined to `01_行情收集/official-careers/discovery/`: `state.json`, atomic `export.json`, immutable original `inputs/<sha256>.json`, `careers.sqlite`, `raw/<run_id>/`, and `requests.jsonl`. The existing shared collection lease/control database is reused for serialization and 10-20s pacing; existing jobs, evidence and halt state are read-only. HTTP uses its `dataDir` option, with no copied transport implementation.

## Commands

```bash
# Offline only. Imports existing seeds unless --no-seeds is passed.
npm run careers:discovery:prepare -- --input /absolute/path/discoveries.json --max-companies 5 --max-requests 30 --max-pages 3

# A separate explicit approval file is required for automatic source access.
npm run careers:discovery:prepare -- --approvals /absolute/path/reviewed-sources.json

# Explicitly runs one bounded execution of the returned frozen batch.
npm run careers:discovery:run -- --batch discovery-UUID

# Read-only report integration; never triggers scanning.
npm run careers:discovery:export

# Existing full collection now also prepares and executes ONE bounded discovery wave.
npm run careers:collect -- --all
```

`discovery:run` requires a frozen batch ID. Repeating it after a completed batch is a no-op. Repeating it after a checkpoint explicitly renews that batch's per-execution request/page budget and resumes only outstanding URLs. Every execution records its own budget, request use and timestamps. Request budget includes robots, ownership, redirects, lists and details. Company count freezes the wave, not the total market. New arrivals wait for the next wave; preparation while a batch remains unfinished returns that existing batch without changing its scope or budget.

Ready sources are selected first. Unchanged terminal pending/blocked/unsupported entries are not repeatedly selected and cannot starve the tail. New evidence or changed admission produces a new review signature. Technical failures are isolated; no access-stop reset or automatic retry loop exists. Request-budget checkpoints are resumable; unresolved parsing/URL admission is a review task, not an endless crawl.

An obsolete frozen approval terminates only its old batch item; it cannot overwrite or mark the current approval revision as reviewed. The current revision remains available for the next wave. If an entire execution budget completes no static page, that source is parked with `budget_requirement.request_budget_must_exceed` and `REFREEZE_LARGER_REQUEST_BUDGET`. Repeating the old batch will not repeat its ownership requests. Finish any other remaining frozen work, then prepare with a larger `--max-requests`; the source remains in the queue and its cursor is preserved. A source that only received the tail of another source's budget can still resume with the full original budget. None of these cases skip ownership or access checks.

## Open Input

The importer accepts an array, a single object, or objects containing `companies`, `jobs`, `leads`, `results`, `channels`, and `sources` arrays. It preserves the entire original input file and each relevant raw record. No matching score, job title, role policy or company tier filters discovery.

```json
{
  "jobs": [{
    "company_name": "Example Employer",
    "homepage": "https://company.example.org/",
    "title": "An unfamiliar native title",
    "description_text": "Original supplied text, never replaced by a generated JD",
    "source_url": "https://unfamiliar-board.example.net/jobs/123",
    "route": "B"
  }],
  "channels": [{
    "name": "A newly found industry publication",
    "url": "https://industry.example.net/recruitment"
  }]
}
```

Employer identity uses an explicit `employer_entity_id` when present, otherwise official-host plus company/legal name. A bare name or recruiter contact is never enough to merge employers. Without identity evidence, separate observations remain pending. `company` and `hiringOrganization` objects are also recognized. Source IDs and employer entities remain distinct from queue IDs.

## Separate Source Approval

Approval flags embedded in ordinary discoveries grant no permission. Use a separately supplied document with this schema. The example domains and evidence paths below are placeholders, not approved live endpoints.

```json
{
  "schema": "generic-official-approvals/v1",
  "approvals": [{
    "company": {
      "company_name": "Example Employer",
      "employer_entity_id": "verified-legal-entity-id",
      "homepage": "https://company.example.org/"
    },
    "source": {
      "company_id": "example-employer",
      "company_name": "Example Employer",
      "employer_entity_id": "verified-legal-entity-id",
      "legal_name": "Example Employer Legal Name",
      "homepage": "https://company.example.org/",
      "group_ids": [],
      "identity_tokens": ["Example Employer"],
      "source_id": "example-official-static",
      "provider": "generic-official-static-v1",
      "allowed_hosts": ["company.example.org"],
      "ownership_url": "https://company.example.org/about",
      "board_url": "https://company.example.org/careers/",
      "tenant": "https://company.example.org/careers/",
      "tenant_scope_url": "https://company.example.org/careers/",
      "fixed_urls": ["https://company.example.org/about", "https://company.example.org/careers/"],
      "static": {
        "mode": "jsonld",
        "scope_selector": "#careers",
        "page_urls": ["https://company.example.org/careers/"],
        "jsonld_list_id": "https://company.example.org/careers/#jobs"
      },
      "approval": {
        "status": "approved",
        "reviewed_by": "actual-reviewer",
        "reviewed_at": "2026-09-13T00:00:00Z",
        "group_relationships_checked": true
      },
      "ownership_evidence": {
        "metadata_path": "01_行情收集/official-careers/discovery/raw/actual-run/001.response.json",
        "body_path": "01_行情收集/official-careers/discovery/raw/actual-run/001.body",
        "sha256": "actual-64-character-lowercase-sha256",
        "quote": "A continuous original quote containing the employer identity"
      }
    }
  }]
}
```

The ownership evidence must be an existing successful GET receipt with matching URL, body path, byte count, SHA and timestamp. Its raw HTML must contain the company identity and a link to the exact configured board. Both preparation and collection check this offline; collection then obtains and checks the current official chain before reading the board. Review attestation is not independent research performed by this program. The reviewer must actually verify the entity, domain, group relationships and tenant; an empty `group_ids` array means the reviewer checked and found none.

`tenant_scope_url` must end with `/`; `tenant` equals its full canonical URL. Every fixed non-ownership URL must belong to that exact origin/path scope. Credentials, private literals, non-HTTPS, local host suffixes, cross-tenant paths and non-admitted redirect targets fail closed. Existing public-DNS pinning, robots, challenge and access-denial rules still apply. Derived identities, names, aliases, domains, groups and existing halt records prevent changing company/source IDs to escape a stop. BOSS, Liepin and MiniMax restrictions are not relaxed.

No JavaScript registry edit is needed per employer. The generic provider reads JSON-LD `JobPosting` with JSON.parse and the existing offline DOM only. It also supports an explicitly reviewed `html-list` specification with `scope_selector`, `item_selector`, `title_selector`, `description_selector`, `id_attribute`, and optional `link_selector`/`location_selector`. Source descriptions stay whole; responsibilities and requirements are not fabricated from an unsplit description.

Shared hosting is not shared employer identity. Different admitted paths on `app.mokahr.com`, or different employer subdomains of `jobs.feishu.cn`, do not inherit each other's company stop merely because of the provider domain. A confirmed same-company/group identity or overlapping exact origin/tenant scope still stops access. An actual origin-wide robots stop applies to that origin. Historical host-only records with unknown scope require verification and zero access, rather than claiming the unrelated employer was denied. This distinction does not waive any HTTP, DNS, robots or challenge check.

`jsonld_list_id`, or `total_selector` with optional `total_attribute`, can establish a native count. These fields are OPTIONAL for admission: missing totals do not prevent collecting full original descriptions. Without reconciled native count the result stays partial/unknown, never empty or complete. A linked detail or next page is fetched only if its fixed URL was separately approved. An unapproved link becomes `pending_admission`, not a request. Missing structured content is unsupported/pending parser or manual-tool execution, not a zero-job result.

## Results And Integration

```js
import { readDiscoveryExport } from './careers/discovery.mjs';
const discovery = await readDiscoveryExport();
// discovery.jobs: normalized job arrays persisted by production normalizeJob + CareersStore.
// discovery.runs: production finishRun result arrays; each run.jobs is also normalized.
// discovery.sources: read-only source identities, latest-run state and retained halt/ownership fields.
// discovery.companies: identity, source, routes, raw observations, admission, todos, cursor, attempts.
// discovery.channels: open-channel candidates, including unsupported/pending publishers.
// discovery.batches: immutable scope/budget manifests plus per-execution results.
```

`jobs` and `runs` are ready to merge into overview/matching inputs without reparsing raw discoveries. Unverified company records must not be promoted to jobs. The read function reads the authoritative snapshot and the discovery SQLite in read-only mode; it creates no database and runs no migrations. `export.json` is the atomically written equivalent for external readers, with `schema_version: 1` and a monotonically increasing revision.

Both `match:prepare` and `match:import` merge discovery-normalized jobs with the existing job store. Discovery does not rewrite matching rules or source facts, and unverified imported market records do not enter matching through this path.

Queue statuses are `queued`, `success`, `verified_empty`, `partial`, `blocked`, `unsupported`, `needs_verification`, and `failed`. Batch completion means the frozen work items reached a terminal disposition, not that all sources succeeded. Counts and errors remain per company/source.

Continuation can reconcile all approved static URLs across multiple observation windows. The queue can then report those URLs accounted for, but an individual resumed collector run remains incomplete as a same-time snapshot. It cannot infer disappearance or closure. A process crash after a saved checkpoint resumes from that checkpoint. If a crash leaves an in-flight company without a completed collector receipt, that company is blocked for review because an access stop may have occurred before the queue checkpoint was written; other companies continue. Saved complete collector receipts are recovered instead of refetched.

## Offline Verification

```bash
/Users/MR/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test careers/tests/discovery-runtime.test.mjs careers/tests/generic-official.test.mjs
```

Fixtures replace only the transport request boundary. Production EvidenceHTTP.get/robots checks, collection orchestration, generic provider, normalizeJob and CareersStore are exercised. Fixture raw receipts are explicitly labeled `offline_fixture_no_network`, use isolated temporary children of the discovery directory, and are cleaned after each test. These tests are not live access or source-acceptance evidence; the main task owns controlled live validation.
