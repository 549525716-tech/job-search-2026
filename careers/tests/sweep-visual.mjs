import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { REPORT_DIR, evidenceAbsolute } from '../paths.mjs';

const data = JSON.parse(await readFile(join(REPORT_DIR, 'market-sweep.json'), 'utf8'));
const qa = join(REPORT_DIR, 'qa');
await mkdir(qa, { recursive: true });
for (const job of data.jobs) await access(evidenceAbsolute(job.evidence_file));
const browser = await chromium.launch({ channel: 'chrome', headless: true, chromiumSandbox: true });
const checks = [];
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 820, height: 1000 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, offline: true, serviceWorkers: 'block' });
    await context.route('**/*', (route) => /^https?:/.test(route.request().url()) ? route.abort() : route.continue());
    const page = await context.newPage();
    const errors = [], requests = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', (request) => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
    await page.goto(pathToFileURL(join(REPORT_DIR, 'market-sweep.html')).href);
    const visible = page.locator('.job:not(.hidden)');
    assert.equal(await visible.count(), data.counts.commercial_candidates);
    assert.equal(await page.locator('.industry-group').count(), data.counts.industry_groups);
    const firstTop = (await visible.first().boundingBox()).y;
    assert(firstTop < viewport.height - 80, `first job should be visible: ${firstTop}`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    assert.equal(overflow, false);
    await page.screenshot({ path: join(qa, `sweep-${viewport.width}.png`) });
    await page.locator('[data-filter="full"]').click();
    assert.equal(await visible.count(), data.jobs.filter((job) => job.description_complete && job.role_fit?.eligible).length);
    await page.locator('[data-sweep-filter="raw"]').click();
    assert.equal(await visible.count(), data.counts.complete);
    const first = visible.first();
    await first.locator('details').nth(0).locator('summary').click();
    assert((await first.locator('pre').first().textContent()).length > 20);
    await first.locator('details').nth(1).locator('summary').click();
    if (await first.locator('.analysis').count()) assert(await first.locator('.analysis').isVisible());
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await first.screenshot({ path: join(qa, `sweep-detail-${viewport.width}.png`) });
    await page.locator('[data-filter="lead"]').click();
    assert.equal(await visible.count(), data.counts.leads);
    await page.locator('[data-filter="priority"]').click();
    assert.equal(await visible.count(), data.jobs.filter((job) => job.analysis?.priority === '优先核实').length);
    await page.locator('[data-filter="salary"]').click();
    assert.equal(await visible.count(), data.counts.salary_confirmed);
    if (data.counts.salary_confirmed === 0) assert(await page.locator('#empty').isVisible());
    await page.locator('[data-filter="all"]').click();
    await page.getByRole('searchbox').fill('百度智能云');
    assert.equal(await visible.count(), data.jobs.filter((job) => job.company === '百度智能云').length);
    const searchableIndustry = data.jobs.find((job) => job.industry)?.industry;
    if (searchableIndustry) {
      await page.getByRole('searchbox').fill(searchableIndustry);
      assert.equal(await visible.count(), data.jobs.filter((job) => job.search_text.includes(searchableIndustry.toLowerCase())).length);
    }
    await page.getByRole('searchbox').fill('not-found-example');
    assert.equal(await visible.count(), 0);
    assert.equal(await page.locator('.industry-group:not(.hidden)').count(), 0);
    await page.getByRole('searchbox').fill('');
    await page.locator('[data-sweep-filter="review"]').click();
    assert.equal(await visible.count(), data.counts.body_review);
    await page.locator('[data-sweep-filter="raw"]').click();
    assert.equal(await visible.count(), data.counts.all);
    assert.deepEqual(errors, []); assert.deepEqual(requests, []);
    checks.push({ viewport, first_job_top: firstTop, overflow, errors, external_requests: requests, filters_passed: true });
    await context.close();
  }
} finally { await browser.close(); }
const reportHash = createHash('sha256').update(await readFile(join(REPORT_DIR, 'market-sweep.html'))).digest('hex');
const result = { passed: true, checked_at: new Date().toISOString(), report_sha256: reportHash, checks, counts: data.counts,
  scope: 'Offline local report and controls; not a new source collection or current hiring verification' };
await writeFile(join(qa, 'sweep-visual-checks.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
