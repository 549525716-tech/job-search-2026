import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { REPORT_DIR } from '../paths.mjs';
import { classifyRole } from '../role-policy.mjs';

const jobs = JSON.parse(await readFile(join(REPORT_DIR, 'coverage-jobs.json')));
const campaign = JSON.parse(await readFile(join(REPORT_DIR, 'coverage-campaign.json')));
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
    await page.goto(pathToFileURL(join(REPORT_DIR, 'coverage-campaign.html')).href);
    assert.equal(await page.locator('tbody tr:not([hidden])').count(), campaign.companies.length);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await page.screenshot({ path: join(qa, `coverage-companies-${viewport.width}.png`) });
    await page.locator('[data-tab=jobs]').click();
    assert.equal(await page.locator('.job:not([hidden])').count(), jobs.length);
    await page.screenshot({ path: join(qa, `coverage-jobs-${viewport.width}.png`) });
    await page.locator('#commercial').check();
    assert.equal(await page.locator('.job:not([hidden])').count(), jobs.filter((j) => classifyRole(j).eligible).length);
    await page.locator('#commercial').uncheck();
    await page.getByRole('searchbox').fill('广东创云');
    assert.equal(await page.locator('.job:not([hidden])').count(), jobs.filter((j) => j.company.includes('广东创云')).length);
    await page.locator('.job:not([hidden]) summary').first().click();
    assert((await page.locator('.job:not([hidden]) pre').first().textContent()).length > 20);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await page.screenshot({ path: join(qa, `coverage-detail-${viewport.width}.png`) });
    await page.getByRole('searchbox').fill('no-such-record-example');
    assert(await page.locator('#empty').isVisible());
    assert.deepEqual(errors, []); assert.deepEqual(requests, []);
    checks.push({ viewport, controls_passed: true, page_overflow: false, errors, external_requests: requests });
    await context.close();
  }
} finally { await browser.close(); }
const result = { passed: true, checked_at: new Date().toISOString(),
  report_sha256: createHash('sha256').update(await readFile(join(REPORT_DIR, 'coverage-campaign.html'))).digest('hex'),
  jobs: jobs.length, company_display_names: campaign.companies.length, checks, scope: 'offline UI only; not hiring verification' };
await writeFile(join(qa, 'coverage-visual-checks.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
