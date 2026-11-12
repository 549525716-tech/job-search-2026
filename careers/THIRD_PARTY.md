# Stage 1 Dependencies

This implementation uses the project's existing Playwright installation (Apache-2.0) and the Babel parser bundled by Playwright (MIT). Their notices remain in `node_modules/playwright/LICENSE` and `node_modules/playwright/lib/transform/babelBundle.js.LICENSE`. The doctor command checks that the installed bundle still exposes the parser contract. No additional dependency was installed.

Nuxt page data is read through an AST and a restrictive literal-only decoder. Downloaded scripts are never executed. DOM parsing uses a fresh, sandboxed, fully offline Chrome context; no existing or persistent browser profile is opened.

No Offer Harvester, ats-jobs, JobSync or job-alerts code was copied or modified in this stage. The checkouts and their original notices in `research/company-careers/vendor/` remain unchanged. The architecture report informed the safety and evidence requirements only.
