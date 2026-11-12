"""Record read-only repository provenance and existing company seed statistics."""
import csv
import datetime
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parent
WORKSPACE = ROOT.parents[1]
NODE = "/Users/MR/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
OUT = ROOT / "evidence"
OUT.mkdir(exist_ok=True)


def git(repo, *args):
    return subprocess.check_output(["git", "-C", str(repo), *args], text=True).strip()


repositories = []
for name in ("ats-jobs", "jobsync", "job-alerts", "offer-harvester"):
    repo = ROOT / "vendor" / name
    repositories.append({
        "name": name,
        "origin": git(repo, "remote", "get-url", "origin"),
        "commit": git(repo, "rev-parse", "HEAD"),
        "commit_date": git(repo, "show", "-s", "--format=%cI", "HEAD"),
        "license": "AGPL-3.0" if name == "job-alerts" else "MIT",
        "modified_files": git(repo, "status", "--porcelain"),
        "installed": False,
        "deployed": False,
    })

seeds = []
for filename in ("AI产业链公司资料集.csv", "AI细分赛道头部公司Top10证据表.csv"):
    path = WORKSPACE / "00_行业资料集" / filename
    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        rows = list(reader)
        columns = reader.fieldnames
    seeds.append({
        "path": str(path.relative_to(WORKSPACE)),
        "rows": len(rows),
        "unique_company_labels": len({row["company"] for row in rows}),
        "segments": len({row["segment"] for row in rows}),
        "columns": columns,
        "status": "historical_seed_not_current_jobs_or_verified_company_ranking",
    })

test_files = sorted((ROOT / "vendor" / "ats-jobs" / "test").glob("*.test.js"))
test = subprocess.run([NODE, "--test", *map(str, test_files)], text=True, capture_output=True)
(OUT / "ats-jobs-upstream-tests.txt").write_text(test.stdout + test.stderr, encoding="utf-8")
result = {
    "audited_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "repositories": repositories,
    "existing_seeds": seeds,
    "upstream_test": {"repository": "ats-jobs", "exit_code": test.returncode, "network": False},
    "scope": "Downloaded source review and offline probes only; no account, application, scheduler or production deployment.",
}
(OUT / "repository-audit.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(result, ensure_ascii=False, indent=2))
raise SystemExit(test.returncode)
