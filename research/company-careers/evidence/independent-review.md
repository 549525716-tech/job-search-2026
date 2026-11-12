# Independent Read-Only Review

Date: 2026-09-08
Reviewer: independent subagent, no implementation changes, network or installation.

Verdict: unchanged deployment/reuse is NO-GO. The recommended research priority is defensible, but no project has been shown ready for live production collection.

## Findings

1. Offer Harvester accepts only 1–100 companies and validates all URLs before selection. Unsupported entries can stop configuration loading. Company identity and live accessibility are not proven by adapters.
2. Salary is absent from the company adapter schema. Independent fixtures also reproduce lost Lever requirements, Greenhouse date conflation, and unlisted Ashby entries in ats-jobs.
3. Offer Harvester's robots handling treats unrecognized HTML as empty rules. The disallow fixture does not prove every ambiguous or challenge response is blocked.
4. JobSync removes Chinese characters from title tokens. Keyword matches can still contribute, so the finding is about Chinese title-ranking reliability, not complete inability to match Chinese content.
5. Offline evidence was labeled correctly. Two probe names initially exceeded their assertions: duty text and a successful empty response needed explicit assertions.

## Disposition

- Findings 1–4 retained as implementation blockers in the architecture report. Vendor code was not modified.
- Finding 5 fixed in the research probe: assert both duties and requirements, and compare failure against an injected successful empty result. Probe rerun completed with eight reproduced outcomes.
- No full Bun suite, JobSync application, real target-company collection or application flow was tested. The report does not claim otherwise.
