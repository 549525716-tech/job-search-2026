import { chromium } from 'playwright';

export async function createOfflineDOM() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, chromiumSandbox: true });
  try {
    const context = await browser.newContext({ offline: true, javaScriptEnabled: false, serviceWorkers: 'block' });
    await context.route('**/*', (route) => route.abort());
    const page = await context.newPage();
    return {
      // Only detached DOMParser documents are evaluated; no website JS or navigation.
      evaluate(fn, input) { return page.evaluate(fn, input); },
      close() { return browser.close(); },
    };
  } catch (error) { await browser.close(); throw error; }
}
