import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve, join } from 'node:path';

const delivery = resolve('03_简历/JD定向实操_2026-10-18/交付');
const qa = resolve('03_简历/JD定向实操_2026-10-18/qa');
const manifest = JSON.parse(await readFile(join(delivery, '对比数据.json'), 'utf8'));
const browser = await chromium.launch({ channel: 'chrome', headless: true, chromiumSandbox: true });
const results = [];
try {
  for (const viewport of [{width:1440,height:1000},{width:390,height:844}]) {
    const context = await browser.newContext({ viewport, offline:true, serviceWorkers:'block' });
    const page = await context.newPage();
    const requests = [], errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => { if (/^https?:/.test(r.url())) requests.push(r.url()); });
    await page.goto(pathToFileURL(join(delivery, 'index.html')).href);
    assert.equal(await page.locator('details.job').count(), 10);
    assert.equal(await page.locator('details.job[open]').count(), 0);
    await page.screenshot({path:join(qa, `comparison-${viewport.width}.png`)});
    await page.locator('#expand').click();
    assert.equal(await page.locator('details.job[open]').count(), 10);
    assert.equal(await page.locator('.change').count(), manifest.variants.reduce((n,v)=>n+v.changes.length,0));
    assert(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1));
    await page.locator('.change').first().scrollIntoViewIfNeeded();
    await page.screenshot({path:join(qa, `comparison-expanded-${viewport.width}.png`)});
    await page.locator('#collapse').click();
    assert.equal(await page.locator('details[open]').count(), 0);
    assert.deepEqual(requests, []);
    assert.deepEqual(errors, []);
    results.push({viewport, jobs:10, edits:manifest.variants.reduce((n,v)=>n+v.changes.length,0), all_expand_collapse:true, no_horizontal_overflow:true, external_requests:requests, errors});
    await context.close();
  }
} finally { await browser.close(); }
await writeFile(join(qa,'comparison-visual.json'), JSON.stringify(results,null,2));
console.log(JSON.stringify(results));
