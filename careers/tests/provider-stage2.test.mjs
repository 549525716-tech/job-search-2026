import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDeepSeekData, collectDeepSeek } from '../providers/deepseek.mjs';
import { createOfflineDOM } from '../dom.mjs';

const script = (jobs, excluded = []) => `const data=JSON.parse(${JSON.stringify(JSON.stringify({ jobs, total: jobs.length, crawledAt: '2026-09-07T00:00:00Z' }))});const exclusions=new Set(${JSON.stringify(excluded)});const visible=data.jobs.filter(job=>!exclusions.has(job.functionName));const render=job=>({__html:job.descriptionHtml});`;
const record = { id: 'fixture-1', title: '解决方案顾问', descriptionHtml: '<h2>工作职责</h2><p>为客户进行经营诊断和业务方案分析。</p><h2>要求</h2><p>具备客户沟通和方案推进能力。</p>', locations: ['北京'], functionName: '商业化', submitUrl: 'https://example.com/apply/1', detailUrl: 'https://example.com/jobs/1' };

test('literal script data follows the exact public visibility filter without executing script', () => {
  const parsed = parseDeepSeekData(script([record, { ...record, id: 'hidden', functionName: '未展示' }], ['未展示']));
  assert.equal(parsed.data.jobs.length, 2);
  assert.deepEqual(parsed.visibility.excluded_categories, ['未展示']);
  assert.throws(() => parseDeepSeekData(script([record]).replace('!exclusions.has(job.functionName)', 'true')), /VISIBILITY/);
  assert.throws(() => parseDeepSeekData(script([record, record])), /COUNT_MISMATCH/);
  const withSideEffect = `${script([record])};globalThis.__shouldNotExecute=true;`;
  parseDeepSeekData(withSideEffect);
  assert.equal(globalThis.__shouldNotExecute, undefined);
});

test('placeholder or malformed details make the snapshot partial; hidden records are not jobs', async () => {
  const dom = await createOfflineDOM();
  try {
    const response = { url: 'https://example.com/static/main.123.js', metadata_path: 'fixture.response.json', text: script([
      record, { ...record, id: 'placeholder', descriptionHtml: '（新部门，虚位以待）' }, { ...record, id: 'hidden', functionName: '隐藏' },
    ], ['隐藏']) };
    const http = { registerPageScripts: async () => [{ to_url: response.url }], getScript: async () => response };
    const result = await collectDeepSeek({ http, dom, company: {}, board: { url: 'https://example.com/', text: '<title>DeepSeek</title>' } });
    assert.equal(result.complete, false);
    assert.equal(result.jobs.length, 1);
    assert.equal(result.pagination.total, 2);
    assert.equal(result.source_metadata.listed_without_full_jd.length, 1);
    assert.equal(result.jobs[0].raw.published_raw, null);
    assert.match(result.jobs[0].raw.description_text, /客户沟通和方案推进/);
  } finally { await dom.close(); }
});
