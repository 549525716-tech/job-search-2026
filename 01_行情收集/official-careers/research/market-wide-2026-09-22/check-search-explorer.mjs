import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';

const dir = dirname(fileURLToPath(import.meta.url));
const file = join(dir, 'search-explorer.html');
const index = JSON.parse(await readFile(join(dir, 'search-index.json')));
const checks = [];
const browser = await chromium.launch({ channel: 'chrome', headless: true, chromiumSandbox: true });
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, offline: true, serviceWorkers: 'block' });
    const externalRequests = [], errors = [];
    await context.route('**/*', route => {
      if (/^https?:/.test(route.request().url())) {
        externalRequests.push(route.request().url());
        return route.abort();
      }
      return route.continue();
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(file).href);
    assert.equal(await page.locator('.company').count(), index.captures.length);
    assert.equal(await page.locator('.entry').count(), index.results.length);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await page.screenshot({ path: join(dir, `search-explorer-${viewport.width}.png`) });
    await page.getByRole('button', { name: '全部收起', exact: true }).click();
    assert.equal(await page.locator('details[open]').count(), 0);
    await page.getByRole('button', { name: '展开公司', exact: true }).click();
    assert.equal(await page.locator('.company[open]').count(), index.captures.length);
    await page.getByRole('searchbox').fill('销售');
    assert((await page.locator('.company:not([hidden])').count()) > 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await page.getByRole('searchbox').fill('no-such-query-20260922');
    assert.equal(await page.locator('.company:not([hidden])').count(), 0);
    await page.getByRole('searchbox').fill('');
    assert.equal(await page.locator('.company:not([hidden])').count(), index.captures.length);
    assert.deepEqual(errors, []);
    assert.deepEqual(externalRequests, []);
    checks.push({ viewport, all_queries_retained: true, all_results_retained: true,
      overflow: false, collapse_expand: true, filter_reset: true, errors, externalRequests });
    await context.close();
  }
} finally {
  await browser.close();
}
const result = { passed: true, scope: 'Offline rendering only; no platform session access or source completeness claim',
  checked_at: new Date().toISOString(), html_sha256: createHash('sha256').update(await readFile(file)).digest('hex'),
  search_captures: index.captures.length, search_results: index.results.length, checks };
await writeFile(join(dir, 'search-explorer-qa.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
