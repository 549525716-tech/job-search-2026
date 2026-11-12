import test from 'node:test';
import assert from 'node:assert/strict';
import {groupIndustries,deliveryLabel,descriptionStatus,renderDecisionReview,displayCompanyKey} from '../decision-review.mjs';

test('unknown employers retain source-specific groups instead of a shared null employer',()=>{
  assert.equal(displayCompanyKey({key:'source-a',company:null}), 'source-a');
  assert.equal(displayCompanyKey({key:'source-b',company:null}), 'source-b');
  assert.equal(displayCompanyKey({key:'source-c',company:'公司甲'}), 'display-only:公司甲');
});

test('salary sort value is rendered directly and does not depend on search excerpt matching',()=>{
  const base={company:'测试公司',title:'销售经理',role:{eligible:true,category:'销售'},
    salary_opportunity:{eligible:true,pending:false,fixed_base:{eligible:false},parsed:{salary_min:25000}},
    salary_raw:'25-40K',additional_requirements:'补充条件：真实AI项目',search_excerpt:'"><script>throw new Error("untrusted")</script>'};
  const pending={...base,title:'岗位待核',salary_raw:null,
    salary_opportunity:{eligible:false,pending:true,fixed_base:{eligible:false},parsed:{salary_min:null}}};
  const html=renderDecisionReview({groups:[{key:'test',company:'测试公司',jobs:[base,pending]}],
    counts:{observations:2,company_names:1,scored:0,range_eligible:1,full_jd:0},
    tier_todo:{qualified_companies:0,status:'deferred'},keywords:[],keyword_axes:[],next_queries:[]});
  assert.match(html,/<article class="job" data-salary="25000"/);
  assert.match(html,/<article class="job" data-salary="-1"/);
  assert(!html.includes('<script>throw new Error'));
  assert(html.includes('&lt;script&gt;'));
  assert(html.includes('补充条件：真实AI项目'));
  assert.equal(base.requirements,undefined);
});

test('complete source text and separately extracted requirements are distinct',()=>{
  assert.equal(descriptionStatus({source_kind:'search_index_lead',description_complete:true}),'搜索索引线索，未读取岗位正文');
  assert.equal(descriptionStatus({description_complete:true}),'已取得职责与要求');
  assert.equal(descriptionStatus({source_description_complete:true,description_structure_status:'full_source_not_split'}),'官网JD全文已保存，职责/要求未单独拆分');
  assert.equal(descriptionStatus({source_description_complete:false}),'线索/正文未完整取得');
});

test('missing, rejected or unsupported breadth acceptance cannot label a formal delivery',()=>{
  for(const input of [undefined,{}, {status:'not_accepted',breadth_status:'not_passed'}, {status:'accepted',breadth_status:'passed',formal_review_evidence:[]}])assert.match(deliveryLabel(input),/未通过宽度验收/);
  assert.match(deliveryLabel({status:'accepted',breadth_status:'passed',formal_review_evidence:['review-reference']}),/仍非全市场穷尽/);
});

test('industry grouping preserves every company, observation and HR entrance exactly once',()=>{
  const groups=[{key:'a',company:'A',profile:{industry:'AI基础模型 / 商业化生态'},jobs:[{id:'1',hr:'甲'},{id:'2',hr:'乙'}]},
    {key:'b',company:'B',jobs:[{id:'3',industry:'基础大模型与开放平台'}]},
    {key:'c',company:'C',jobs:[{id:'4'}]}];
  const result=groupIndustries(groups);
  assert.equal(result.length,2);
  assert.deepEqual(result[0].groups.map(g=>g.key),['a','b']);
  assert.deepEqual(result.flatMap(i=>i.groups.flatMap(g=>g.jobs.map(j=>j.id))),['1','2','3','4']);
  assert.equal(result[1].label,'行业待核');
});

test('conflicting or missing sector evidence stays pending; no company-name inference',()=>{
  const result=groupIndustries([{company:'AI大模型公司',jobs:[{title:'人工智能销售'}]},
    {company:'多业务',jobs:[{industry:'企业软件与营销数字化'},{industry:'智能硬件与汽车数字化'}]}]);
  assert.equal(result.length,1);
  assert.equal(result[0].label,'行业待核');
  assert.equal(result[0].groups.length,2);
});

test('profile classification takes precedence and source labels are preserved',()=>{
  const result=groupIndustries([{company:'公司',profile:{industry:'AI应用 / 营销科技'},jobs:[{industry:'互联网'}]}]);
  assert.equal(result[0].label,'营销科技与企业增长');
  assert.deepEqual(result[0].source_labels,['AI应用 / 营销科技']);
});

test('query direction is not promoted to verified company industry',()=>{
  const result=groupIndustries([{company:'数据中心公司',jobs:[{industry:null,discovery_industry:'机器人与智能硬件'}]}]);
  assert.match(result[0].label,/检索方向.*行业待核/);
  assert.deepEqual(result[0].source_labels,[]);
  const combined=groupIndustries([{company:'京东',jobs:[{industry:null,discovery_industry:'基础大模型与开放平台'},{industry:'AI企业应用'}]}]);
  assert.equal(combined[0].label,'AI应用与企业软件');
});
