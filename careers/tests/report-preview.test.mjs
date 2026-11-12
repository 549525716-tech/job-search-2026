import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createReportPreview } from '../report-preview.mjs';

test('report preview supports refresh and exports without exposing other files', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'career-preview-'));
  const server = createReportPreview(directory);
  try {
    await writeFile(join(directory, 'decision-review.html'), '<h1>Report</h1>');
    await writeFile(join(directory, 'decision-review.csv'), 'company,title');
    await writeFile(join(directory, 'private.txt'), 'not public');
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const response = await fetch(`${base}/decision-review.html`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/html/);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(await response.text(), '<h1>Report</h1>');
    await writeFile(join(directory, 'decision-review.html'), '<h1>Updated</h1>');
    assert.equal(await (await fetch(base)).text(), '<h1>Updated</h1>');
    assert.equal(await (await fetch(`${base}/decision-review.csv`)).text(), 'company,title');
    assert.equal((await fetch(`${base}/decision-review.html`, { method: 'HEAD' })).status, 200);
    for (const path of ['/private.txt', '/%2e%2e/private.txt', '/decision-review.json']) {
      assert.equal((await fetch(base + path)).status, 404);
    }
    assert.equal((await fetch(base, { method: 'POST' })).status, 405);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
