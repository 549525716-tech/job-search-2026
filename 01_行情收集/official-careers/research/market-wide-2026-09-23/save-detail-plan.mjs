import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const dir=new URL('./',import.meta.url);
const tasks=JSON.parse(process.argv[2]);
const index=JSON.parse(await readFile(new URL('search-index.json',dir)));
const failures=JSON.parse(await readFile(new URL('../market-wide-2026-09-22/detail-backlog.json',dir)));
for(const t of tasks){
  const url=t.request.open[0].ref_id;
  assert(index.results.some(r=>r.url===url));
  assert(!failures.items.some(r=>r.pending&&r.request?.open?.[0]?.ref_id===url));
}
await writeFile(new URL('detail-plan.json',dir),JSON.stringify({frozen_at:new Date().toISOString(),tasks,
  note:'Four continuations of readable but truncated pages, then eleven observed role-detail URLs. Failures stop the source; remaining tasks stay pending.'},null,2)+'\n',{flag:'wx'});
