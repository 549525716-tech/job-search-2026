import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureLines, captureRange, build } from './build.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
await build();
const jobs = JSON.parse(await readFile(join(ROOT, 'jobs.json')));
const audit = JSON.parse(await readFile(join(ROOT, 'extraction-audit.json')));
const run = JSON.parse(await readFile(join(ROOT, 'run.json')));
const batchOutput = JSON.stringify({ jobs, audit, run });
process.chdir(PROJECT_ROOT);
await build();
const rootOutput = JSON.stringify({
  jobs: JSON.parse(await readFile(join(ROOT, 'jobs.json'))),
  audit: JSON.parse(await readFile(join(ROOT, 'extraction-audit.json'))),
  run: JSON.parse(await readFile(join(ROOT, 'run.json')))
});
assert.equal(rootOutput, batchOutput, 'project-root and batch-directory builds are byte-identical');
const raw = JSON.parse(await readFile(join(ROOT, 'raw/o02.json')));
const lines = captureLines(raw.result);
assert.equal(captureRange(lines, [43, 45]).includes('AI 转型专家'), true);
assert.equal(jobs.filter(j => j.company === 'Noumena（物自体）').length, 9);
assert.equal(jobs.filter(j => j.company === '飞轮科技').length, 15);
assert.ok(jobs.filter(j => j.company === '飞轮科技').every(j => j.title !== '多模实习生 实习' && j.city), 'official SelectDB titles and locations retain the page fields');
assert.ok(jobs.some(j => j.title.includes('产品经理')), 'product manager raw observation retained');
const o03 = jobs.find(j => j.id === 'bytedance:7673717322767501621');
assert.equal(o03.description_complete, false);
assert.equal(o03.description, null);
assert.ok(o03.requirements.includes('理解SMB客户'));
const o07 = jobs.find(j => j.id === 'lenovo-connect:43');
assert.equal(o07.salary_raw, '15-25k');
assert.equal(o07.attention.includes('不推固定'), true);
assert.match(o07.job_url, /lenovoconnect\.com/);
const o06 = jobs.filter(j => j.company === 'YMatrix');
assert.ok(o06.length >= 10 && o06.every(j => j.description_complete === false && j.job_url === null));
const o08 = audit.files.find(x => x.file === 'o08.json');
assert.equal(o08.status, 'failed');
assert.equal(o08.extracted_jobs, 0);
const o10 = jobs.find(j => j.id.startsWith('baidu:'));
assert.ok(o10.scope_note.includes('冲突'));
const o13 = jobs.find(j => j.company === 'Airwallex');
assert.equal(o13.description_complete, true);
assert.equal(o13.city, '广州/深圳/上海/杭州');
const o14 = jobs.filter(j => j.company === '正航软件');
assert.equal(o14.length, 6);
assert.ok(o14.some(j => j.title === 'ERP销售顾问' && j.job_url === null));
assert.equal(o14.find(j => j.title === 'ERP项目经理').recruitment_type, '社招');
const o15 = audit.files.find(x => x.file === 'o15.json');
assert.equal(o15.status, 'failed');
const o16 = jobs.filter(j => j.company === '华天软件');
assert.equal(o16.length, 28);
for (const [rawFile, cities] of Object.entries({
  'o16.json': ['重庆', '苏州', '上海', '苏州', '青岛', '西安', '济南'],
  'o17.json': ['武汉', '北京', '广州', '济南', '西安', '武汉', '苏州'],
  'o18.json': ['青岛', '广州', '济南', '西安', '武汉', '苏州', '青岛'],
  'o19r.json': ['重庆', '广州', '上海', '北京', '济南', '济南', '济南']
})) {
  const page = o16.filter(j => j.evidence_file.endsWith(`raw/${rawFile}`));
  assert.equal(page.length, 7, `${rawFile} has every explicit pagination item`);
  assert.deepEqual(page.map(j => j.city), cities, `${rawFile} preserves per-job city`);
  assert.ok(page.every(j => j.job_url === null && j.description_complete === true && j.description.includes('岗位职责：') && j.requirements), `${rawFile} has complete body and no page URL presented as job URL`);
}
assert.equal(o16.find(j => j.evidence_file.endsWith('raw/o16.json') && j.city === '重庆').education, '大专以上');
assert.equal(audit.files.find(x => x.file === 'o19.json').status, 'interrupted_unknown');
assert.equal(audit.files.find(x => x.file === 'o19r.json').extracted_jobs, 7);
assert.equal(audit.files.find(x => x.file === 'o01.json').status, 'not_recruitment_document');
const noumenaOverseas = jobs.find(j => j.company === 'Noumena（物自体）' && j.title === '出海商业化 BD 负责人');
assert.equal(noumenaOverseas.city, '深圳 / 广州 / 上海');
assert.equal(jobs.filter(j => j.company === 'Noumena（物自体）' && j.city === '上海').length, 8);
assert.equal(audit.files.find(x => x.file === 'o11.json').application_url, 'https://jobs.bytedance.com/experienced/position/7673717322767501621/detail');
assert.equal(audit.files.find(x => x.file === 'o12.json').status, 'failed');
assert.ok(jobs.some(j => j.recruiter_raw && j.hr_display_name === j.recruiter_raw), 'previous recruiter field preserved');
for (const j of jobs.filter(x => x.evidence_file?.includes('market-2026-09-21/raw'))) {
  assert.match(j.evidence_file, /^01_行情收集\/official-careers\/research\/market-2026-09-21\/raw\//);
  assert.match(j.evidence_sha256, /^[a-f0-9]{64}$/);
  for (const item of Object.values(j.field_evidence)) if (item?.line_range) assert.ok(item.quote !== null);
  assert.equal(Object.hasOwn(j, 'display_excluded'), false, 'extraction does not make display policy decisions');
  if (j.description_complete) assert.ok(j.description && j.field_evidence.description?.quote === j.description);
  if (j.salary_raw) assert.ok(j.field_evidence.salary?.quote?.includes(j.salary_raw));
  if (j.job_url) assert.notEqual(j.source_kind, 'official_careers_page');
}
assert.ok(jobs.every(j => !Object.hasOwn(j, 'display_excluded')), 'historical observations also omit extraction-layer display policy');
assert.equal(run.execution.revision_receipt.executor, 'gpt-5.6-terra');
assert.equal(run.execution.revision_receipt.reasoning_effort, 'medium');
assert.equal(run.network_requests, 0);
assert.equal(run.browser_requests, 0);
assert.equal(run.merged_previous_observations, 40);
assert.equal(run.extracted_new_jobs, 81);
assert.equal(run.total_jobs, 121);
assert.ok(jobs.filter(j=>j.source_kind==='official_careers_page').every(j=>j.native_id===null), 'heading positions are not native requisition IDs');
assert.ok(jobs.filter(j=>j.company==='华天软件').every(j=>j.company_facts_quote===null || j.company_facts_quote.includes('山东山大华天软件股份有限公司')), 'company evidence is disclosed legal name or unknown, never the menu');
assert.ok(jobs.some(j=>j.company==='华天软件' && j.company_facts_quote?.includes('山东山大华天软件股份有限公司')));
console.log(JSON.stringify({ok:true,jobs:jobs.length,new_audit_files:audit.files.length}));
