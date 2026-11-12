import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyRole } from '../role-policy.mjs';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const savedPage = new URL('../../01_行情收集/official-careers/raw/minimax-browser-c3b01ddc-0b77-481f-99b1-d21d3a95bce8/browser-public-079.body', import.meta.url);
test('fallback real operations director is recalled by title plus commercial responsibilities',()=>{
  const jobs=JSON.parse(readFileSync(new URL('../../01_行情收集/official-careers/research/fallback-2026-09-22/jobs.json',import.meta.url),'utf8'));
  for(const title of ['运营总监','运营专员']) {
    const job=jobs.find(j=>j.company==='动鑫科技'&&j.title===title);
    assert(job.description_complete);
    assert.equal(classifyRole(job).tier,'primary');
  }
  for(const job of [
    {title:'运营总监',description:'维护内部设备与安全管理制度。'},
    {title:'运营总监',description:'不负责市场增长。'},
    {title:'运营总监',description:'不承担市场增长职责。'},
    {title:'运营总监',description:'无需负责客户获客。'},
    {title:'运营总监',description:'不参与客户社群内容运营。'},
    {title:'运营总监',description:'不以市场增长为目标。'},
    {title:'运营总监',description:'无需承担客户获客职责，有销售经验者优先。'},
    {title:'运营经理',description:'不承担客户增长职责。'},
    {title:'产品运营主管',description:'负责客户增长。'},
    {title:'产品经理',description:'负责客户增长。'}
  ])assert.equal(classifyRole(job).eligible,false);
  assert.equal(classifyRole({title:'运营总监',description:'不承担研发职责。负责市场增长与客户获客。'}).eligible,true);
  for(const description of ['负责市场增长与客户获客，无需出差。','无需出差，负责市场增长与客户获客。','不参与设备巡检，负责市场增长与客户获客。',
    '负责客户社群与内容运营，无需销售经验。','无需行业销售经验，负责市场增长与客户获客。']) {
    assert.equal(classifyRole({title:'运营总监',description}).eligible,true,description);
  }
});
test('APUS commercial titles from the breadth scan are not lost to title aliases', () => {
  for (const title of ['战略合作经理', '海外推广经理', '活动策划/创意策划/线上活动策划', 'Public Relations Manager', '海外网站运营及SEO专员']) {
    assert.equal(classifyRole({ title }).eligible, true, title);
  }
  for (const title of ['营销算法工程师', '市场产品经理', '战略研究员']) {
    assert.equal(classifyRole({ title }).eligible, false, title);
  }
});
test('tele-sales and regional sales management remain visible without promoting civic roles', () => {
  assert.equal(classifyRole({ title: '电销经理' }).eligible, true);
  assert.equal(classifyRole({ title: '城市经理', description: '负责区域销售目标与销售团队建设。' }).eligible, true);
  assert.equal(classifyRole({ title: '区域经理', responsibilities: '完成销售目标。' }).eligible, true);
  assert.equal(classifyRole({ title: '城市经理', description: '负责城市绿化和建筑规划。' }).eligible, false);
  assert.equal(classifyRole({ title: '城市经理', description: '不负责销售目标。' }).eligible, false);
});

const currentSweep = new URL('../../01_行情收集/official-careers/research/sweep-2026-09-13/jobs.json', import.meta.url);
test('real Tungee tele-sales and city-manager JDs pass the commercial presentation gate', { skip: !existsSync(currentSweep) }, () => {
  const jobs = JSON.parse(readFileSync(currentSweep, 'utf8'));
  for (const title of ['电销经理', '城市经理']) {
    const job = jobs.find((item) => item.company === '探迹科技' && item.title === title);
    assert.ok(job?.description_complete);
    assert.equal(classifyRole(job).eligible, true, title);
  }
});

test('real preserved MiniMax B-end analytics JD reaches review while its SQL/Python gates remain intact', { skip: !existsSync(savedPage) }, () => {
  const bytes = readFileSync(savedPage);
  const receipt = JSON.parse(readFileSync(new URL('browser-public-079.response.json', savedPage), 'utf8'));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), receipt.sha256);
  const raw = JSON.parse(bytes).data.job_post_list.find((job) => job.id === '7655546603629922610');
  assert.ok(raw.description.includes('量化商业化策略效果'));
  assert.ok(raw.requirement.includes('SQL/Python/Excel'));
  const result = classifyRole({ title: raw.title, responsibilities: raw.description, description_text: `${raw.description}\n${raw.requirement}` });
  assert.equal(result.tier, 'review');
  assert.equal(result.eligible, false);
  assert.ok(result.body_signals.some((signal) => signal.dimension === '客户经营'));
});

test('unfamiliar names enter body review without becoming recommendations', () => {
  for (const title of ['Business Expansion Lead', 'Customer Value Lead', '行业增长合伙人']) {
    const result = classifyRole({ title, description_text: '负责企业客户分层、商机管道、合同谈判与销售收入目标，统筹区域资源。' });
    assert.equal(result.review_required || result.eligible, true, title);
    if (result.review_required) assert.equal(result.eligible, false);
    assert.equal(result.collection_eligible, true);
  }
});
test('body mentions do not promote engineers, product managers or generic soft skills', () => {
  const description_text = '负责企业客户商机管道与销售收入目标';
  for (const title of ['软件工程师', 'Product Manager']) assert.equal(classifyRole({ title, description_text }).review_required, false);
  assert.equal(classifyRole({ title: '特别人才', description_text: '热爱AI，与客户和销售保持沟通，具备团队合作精神。' }).review_required, false);
  assert.equal(classifyRole({ title: '投资者关系', description_text: '维护券商机构业务团队关系，理解公司商业化进展。' }).review_required, false);
});
test('partial responsibilities do not shadow the complete body, and marketing engineering stays technical', () => {
  assert.equal(classifyRole({ title: '特别人才', responsibilities: '负责日常协调。', description_text: '负责企业客户经营、合同谈判及销售收入目标。' }).review_required, true);
  assert.equal(classifyRole({ title: '营销算法工程师', description_text: '研发广告排序算法，负责模型训练和线上推理性能。' }).eligible, false);
  assert.equal(classifyRole({ title: 'Product Marketing Manager' }).eligible, true);
});

test('commercial policy excludes product managers and engineering without deleting product marketing', () => {
  for (const title of ['AI产品经理', '高级产品经理', 'Senior Product Manager', 'Product Owner', '算法工程师', '销售运营实习生']) assert.equal(classifyRole({ title }).eligible, false, title);
  for (const title of ['销售运营', 'AI产品销售', '海外产品营销（3C消费电子）', 'Product Marketing Manager', 'Business Builder & Ecosystem', 'B2B销售主管/经理', '海外社媒运营']) assert.equal(classifyRole({ title }).eligible, true, title);
});
test('adjacent solutions and opt-in FDE are distinct; hiring state overrides title', () => {
  assert.equal(classifyRole({ title: '解决方案顾问' }).tier, 'adjacent');
  assert.equal(classifyRole({ title: 'FDE' }).eligible, false);
  assert.equal(classifyRole({ title: 'FDE' }, { role_policy: { include_exploratory: true } }).eligible, true);
  assert.equal(classifyRole({ title: '销售经理', hiring_active: 'closed' }).eligible, false);
  assert.equal(classifyRole({ title: '研发运营经理', description_text: '测试基础设施' }).eligible, false);
});
test('English sales management is recalled without widening product or technical roles', () => {
  for (const title of ['Sales Manager', 'Enterprise Sales Director', 'Head of Sales', 'VP of Sales', 'Sales Executive']) assert.equal(classifyRole({ title }).tier, 'primary', title);
  assert.equal(classifyRole({ title: 'Sales Engineer' }).tier, 'adjacent');
  assert.equal(classifyRole({ title: 'Sales Operations Manager' }).category, '销售及商业化运营');
  assert.equal(classifyRole({ title: 'Salesforce Developer' }).eligible, false);
});
