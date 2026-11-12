import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const dir=new URL('./',import.meta.url);
const raw=await readFile(new URL('search-index.json',dir));
const index=JSON.parse(raw);
const tasks=JSON.parse(process.argv[2]);
for(const task of tasks) {
  const row=index.results.find(r=>r.result_id===task.source_result_id);
  if(!row||row.url!==task.request.open[0].ref_id)throw new Error('UNOBSERVED_URL');
  if(/(?:zhipin|liepin|linkedin|minimax|farben)\./i.test(new URL(row.url).hostname))throw new Error('PROTECTED_SOURCE');
}
await writeFile(new URL('page-plan.json',dir),JSON.stringify({frozen_at:new Date().toISOString(),
  source_index_sha256:createHash('sha256').update(raw).digest('hex'),tasks,
  selection:'Observed public recruitment URLs, cross-industry breadth; query target is NOT employer identity; source ownership checked only after reading.',
  source_inventory_complete:false},null,2)+'\n',{flag:'wx'});
