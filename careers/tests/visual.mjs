import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { REPORT_DIR } from '../paths.mjs';
import { renderOverviewHTML } from '../overview.mjs';

const overviewJSON = JSON.parse(await readFile(join(REPORT_DIR, 'overview.json'), 'utf8'));
await writeFile(join(REPORT_DIR, 'overview.html'), renderOverviewHTML(overviewJSON));
const expected = {
  funnel: overviewJSON.funnel?.opportunities?.length ?? 0,
  leads: overviewJSON.market_leads?.leads?.length ?? 0,
  roles: overviewJSON.headhunter?.roles?.length ?? 0,
  decisions: overviewJSON.headhunter?.decisions?.length ?? 0,
  findings: (overviewJSON.headhunter?.roles ?? []).reduce((total, role) => total + (role.findings?.length ?? 0), 0),
};
const browser = await chromium.launch({ channel: 'chrome', headless: true, chromiumSandbox: true });
const qa = join(REPORT_DIR, 'qa');
await mkdir(qa, { recursive: true });
const checks = [];

function assertNoOverflow(page) {
  return page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }))
    .then(({ width, scroll }) => assert(scroll <= width + 1, `document overflow: ${scroll} > ${width}`));
}

try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 820, height: 1000 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, offline: true, serviceWorkers: 'block' });
    await context.route('**/*', async (route) => {
      if (/^https?:/i.test(route.request().url())) return route.abort();
      return route.continue();
    });
    const page = await context.newPage();
    const errors = [];
    const externalRequests = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', (request) => { if (/^https?:/i.test(request.url())) externalRequests.push(request.url()); });
    await page.goto(pathToFileURL(join(REPORT_DIR, 'overview.html')).href);
    assert.equal(await page.title(), '职场机会 · 官方招聘证据');
    assert.equal(await page.getByRole('tab').count(), 9);
    assert.equal(await page.getByRole('tab', { name: /AI优先/ }).getAttribute('aria-selected'), 'true');
    assert.equal(await page.locator('#jobs').isVisible(), true, 'AI worklist must be the default view');
    assert.equal(await page.locator('#funnel').isVisible(), false);
    assert.equal(await page.locator('.job:not(.hidden)').count(), overviewJSON.summary.ai_candidates);
    for (const group of await page.locator('.industry-group:not(.hidden)').all()) {
      assert.equal(Number(await group.locator('[data-group-count]').textContent()), await group.locator('.job:not(.hidden)').count());
    }
    assert(overviewJSON.summary.ai_candidates > 0, 'default AI view must have jobs');
    assert.equal(await page.getByRole('searchbox').inputValue(), '', 'default screenshot must have no search filter');
    const firstJobTop = (await page.locator('.job:not(.hidden)').first().boundingBox()).y;
    if (viewport.width >= 1000) {
      const firstScreen = await page.locator('.job:not(.hidden)').first().boundingBox();
      assert(firstScreen && firstScreen.y < viewport.height, 'desktop first screen must show a job');
    } else {
      assert(firstJobTop <= 450, `mobile first job must start by 450px, got ${firstJobTop}`);
    }
    await page.screenshot({ path: join(qa, `default-ai-${viewport.width}.png`), fullPage: false });
    await assertNoOverflow(page);

    await page.getByRole('tab', { name: /工作清单/ }).click();
    assert.equal(await page.locator('.job:not(.hidden)').count(), overviewJSON.summary.candidates);
    await page.getByRole('tab', { name: /待复核/ }).click();
    assert.equal(await page.locator('.job:not(.hidden)').count(), overviewJSON.summary.review_candidates);
    await page.screenshot({ path: join(qa, `body-review-${viewport.width}.png`), fullPage: false });
    await page.getByRole('tab', { name: /全原始记录/ }).click();
    assert.equal(await page.locator('.job:not(.hidden)').count(), overviewJSON.summary.raw_jobs);
    await page.getByRole('searchbox').fill('量化商业化策略效果');
    assert(await page.locator('.job:not(.hidden)').count() > 0, 'full JD content must be searchable');
    await page.getByRole('searchbox').fill('');
    assert(!/salary_is_not_parsed_or_not_disclosed/.test(await page.locator('#jobs').innerText()));
    await page.getByRole('tab', { name: /固定薪20K/ }).click();
    assert.equal(await page.locator('.job:not(.hidden)').count(), overviewJSON.summary.salary_candidates);
    if (!overviewJSON.summary.salary_candidates) assert(await page.locator('#empty').isVisible());

    await page.getByRole('tab', { name: /薪资线索/ }).click();
    assert.equal(await page.getByRole('searchbox').inputValue(), '', 'leads screenshot must have no search filter');
    assert.equal(await page.locator('#leads').isVisible(), true);
    assert.equal(await page.locator('#leads .compact-list > li').count(), expected.leads);
    assert.equal(await page.locator('#leads .compact-list > li').filter({ hasText: '搜索索引线索' }).count(), expected.leads);
    assert.equal(await page.locator('#leads .compact-list > li').filter({ hasText: '职位直链' }).count(), overviewJSON.market_leads.leads.filter((lead) => lead.job_url).length);
    await page.screenshot({ path: join(qa, `leads-${viewport.width}.png`), fullPage: false });
    await assertNoOverflow(page);

    await page.getByRole('tab', { name: /猎头研判/ }).click();
    assert.equal(await page.getByRole('searchbox').inputValue(), '', 'headhunter screenshot must have no search filter');
    assert.equal(await page.locator('#headhunter').isVisible(), true);
    assert.equal(await page.locator('#headhunter .compact-list > li').count(), expected.roles + expected.decisions);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: join(qa, `headhunter-${viewport.width}.png`), fullPage: false });
    const findingDetails = page.locator('#headhunter details:has(ul)');
    assert.equal(await findingDetails.count(), expected.findings);
    for (let index = 0; index < expected.findings; index += 1) {
      const detail = findingDetails.nth(index);
      await detail.locator('summary').click();
      assert.equal(await detail.locator('ul').isVisible(), true);
    }
    if (expected.findings) {
      const content = await findingDetails.first().locator('ul').boundingBox();
      assert(content.width > viewport.width * 0.7, 'Role details must use the available width, not a narrow nested grid column');
      await findingDetails.first().screenshot({ path: join(qa, `headhunter-detail-${viewport.width}.png`) });
    }
    await assertNoOverflow(page);

    await page.getByRole('tab', { name: /政策\/行业\/公司/ }).click();
    assert.equal(await page.getByRole('searchbox').inputValue(), '', 'funnel screenshot state must have no search filter');
    assert.equal(await page.locator('#funnel tr.opportunity-summary').count(), expected.funnel);
    assert.equal(await page.locator('#funnel tr.opportunity-detail').count(), expected.funnel);
    const funnelDetails = page.locator('#funnel tr.opportunity-detail');
    for (let index = 0; index < expected.funnel; index += 1) {
      const detail = funnelDetails.nth(index);
      await detail.locator('summary').click();
      assert.equal(await detail.locator('pre').isVisible(), true);
      assert((await detail.locator('pre').textContent()).trim().length > 20, `JD ${index + 1} must contain substantive detail text`);
    }
    await assertNoOverflow(page);

    assert.deepEqual(errors, []);
    assert.deepEqual(externalRequests, [], 'visual test must not request external URLs');
    checks.push({ viewport, page_errors: errors, external_requests: externalRequests, document_overflow: false,
      default_view: 'ai', tabs: 9, ai_jobs: overviewJSON.summary.ai_candidates, mobile_first_job_top: viewport.width < 1000 ? firstJobTop : null, leads: expected.leads,
      headhunter_roles: expected.roles, headhunter_findings: expected.findings, funnel_opportunities: expected.funnel,
      screenshots: [`default-ai-${viewport.width}.png`, `leads-${viewport.width}.png`, `headhunter-${viewport.width}.png`] });
    await context.close();
  }
} finally { await browser.close(); }

const digest = createHash('sha256').update(await readFile(join(REPORT_DIR, 'overview.html'))).digest('hex');
const result = { checked_at: new Date().toISOString(), report_sha256: digest, expected, checks, passed: true,
  scope: 'Local report rendering and controls; counts sourced from overview.json; not a live source collection test' };
await writeFile(join(qa, 'visual-checks.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
