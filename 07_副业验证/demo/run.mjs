import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// A narrow, deterministic sample, not the production account-prioritization model.
const bytes = await readFile(new URL('./input.json', import.meta.url));
const input = JSON.parse(bytes);
if (input.data_kind !== 'synthetic_demo_only' || !Array.isArray(input.accounts)) {
  throw new Error('Only the declared synthetic demonstration input is accepted');
}
const rows = input.accounts.map(row => {
  const valid = typeof row.balance === 'number' && Number.isFinite(row.balance) && row.balance >= 0
    && typeof row.daily_spend === 'number' && Number.isFinite(row.daily_spend) && row.daily_spend > 0;
  const days = valid ? row.balance / row.daily_spend : null;
  return { id: row.id, days_remaining: days,
    status: !valid ? '数据待确认' : days <= 3 ? '优先核实' : '正常观察',
    action: !valid ? '补齐数据，不推算为零' : days <= 3 ? '确认预算及是否需要沟通' : '下次例行复查' };
});
const output = { data_kind: input.data_kind, input_sha256: createHash('sha256').update(bytes).digest('hex'),
  rule: '有效余额/正数日均消耗；不超过3天优先核实，缺值或无效值转人工确认',
  scope: '合成数据上的规则演示；没有调用AI、连接客户系统或发送消息', rows };
await writeFile(new URL('./output.json', import.meta.url), JSON.stringify(output, null, 2) + '\n');
console.log('Synthetic demonstration output saved; no external action.');
