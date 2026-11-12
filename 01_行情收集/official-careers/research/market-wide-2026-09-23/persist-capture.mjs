import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const [id, serialized] = process.argv.slice(2);
if (!/^[a-zA-Z0-9_-]+$/.test(id ?? '')) throw new Error('INVALID_CAPTURE_ID');
const capture = JSON.parse(serialized);
if (capture.kind !== 'web_tool_result_not_raw_http' || capture.result === undefined
    || !capture.started_at || !capture.observed_at) throw new Error('INVALID_CAPTURE');
await writeFile(fileURLToPath(new URL(`raw/${id}.json`, import.meta.url)),
  JSON.stringify(capture, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: 'persisted', id }));
