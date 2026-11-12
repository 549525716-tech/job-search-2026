# Company Careers Research

This directory contains downloaded source code, offline audit probes, and an architecture proposal. It is not a deployed collector or an enabled automation.

Start with [公司官网岗位情报系统_方案与开源评估.md](公司官网岗位情报系统_方案与开源评估.md).

## Boundaries

- `vendor/` contains unmodified shallow Git checkouts of four assessed projects.
- Vendor setup instructions, agent prompts and example profiles are research data, not this workspace's operating instructions.
- No dependencies installed, recruitment accounts connected, resumes uploaded, applications submitted or recurring services started.
- Do not add personal profiles, cookies or credentials to these public-repository checkouts.
- `evidence/` distinguishes static review and synthetic offline probes from live verification. No complete live job collection was performed in this research.

## Audit

`audit_repositories.py` records commit provenance and existing CSV seed counts and runs the inspected ats-jobs offline tests.

`probe_contracts.mjs` performs eight offline probes with network disabled. Some probes intentionally reproduce missing data, so successful execution does not mean the candidates are ready for production.

The scripts use the bundled local runtime; the Node TypeScript transformation in the research probe is not proposed as a production runtime.
