import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { REPORT_DIR } from '../paths.mjs';

const report = JSON.parse(await readFile(join(REPORT_DIR, 'personal-matches.json')));
assert(report.priorities.length > 0, 'A real matching report is required');
const qa = join(REPORT_DIR, 'qa');
await mkdir(qa, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, chromiumSandbox: true });
const checks = [];
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, offline: true, serviceWorkers: 'block' });
    await context.route('**/*', (route) => /^https?:/.test(route.request().url()) ? route.abort() : route.continue());
    const page = await context.newPage(), errors = [], requests = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', (request) => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
    await page.goto(pathToFileURL(join(REPORT_DIR, 'personal-matches.html')).href);
    assert.equal(await page.locator('.match:not([hidden])').count(), report.priorities.length);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await page.screenshot({ path: join(qa, `personal-matches-${viewport.width}.png`) });
    await page.locator('[data-filter="优先核实"]').click();
    assert.equal(await page.locator('.match:not([hidden])').count(), report.priorities.filter((row) => row.priority === '优先核实').length);
    await page.locator('[data-filter="all"]').click();
    await page.getByRole('searchbox').fill(report.priorities[0].company);
    const visible = page.locator('.match:not([hidden])').first();
    assert(await visible.isVisible());
    await visible.locator('summary').last().click();
    const text = await visible.innerText();
    assert(text.includes(report.priorities[0].title));
    assert(text.includes(report.priorities[0].raw_job.requirements));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await page.screenshot({ path: join(qa, `personal-matches-detail-${viewport.width}.png`) });
    await page.getByRole('searchbox').fill('no-such-match-example');
    assert.equal(await page.locator('.match:not([hidden])').count(), 0);
    assert.deepEqual(errors, []); assert.deepEqual(requests, []);
    checks.push({ viewport, filters_passed: true, complete_requirements_visible: true, horizontal_overflow: false, page_errors: errors, external_requests: requests });
    await context.close();
  }
} finally { await browser.close(); }
const receipt = { passed: true, checked_at: new Date().toISOString(),
  report_sha256: createHash('sha256').update(await readFile(join(REPORT_DIR, 'personal-matches.html'))).digest('hex'),
  priorities: report.priorities.length, scope: 'Offline rendering and interaction only, not current hiring or independent semantic verification', checks };
await writeFile(join(qa, 'personal-match-visual-checks.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt, null, 2));
