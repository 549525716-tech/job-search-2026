import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../01_行情收集/official-careers/reports');
const types = { html: 'text/html', csv: 'text/csv', md: 'text/plain', json: 'application/json' };

// Serve only the report and its exports, never the workspace or login profiles.
export function createReportPreview(directory = root) {
  return createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    const path = request.url.split('?')[0];
    const match = /^\/decision-review\.(html|csv|md|json)$/.exec(path);
    if (path !== '/' && !match) {
      response.writeHead(404).end('Not found');
      return;
    }
    const extension = match?.[1] ?? 'html';
    const file = join(directory, `decision-review.${extension}`);
    try {
      const info = await stat(file);
      response.writeHead(200, {
        'Content-Type': `${types[extension]}; charset=utf-8`,
        'Content-Length': info.size,
      });
      if (request.method === 'HEAD') response.end();
      else createReadStream(file).on('error', () => response.destroy()).pipe(response);
    } catch {
      response.writeHead(404).end('Report unavailable');
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 8787);
  const server = createReportPreview();
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => {
    console.log(`Report: http://127.0.0.1:${server.address().port}/decision-review.html`);
  });
}
