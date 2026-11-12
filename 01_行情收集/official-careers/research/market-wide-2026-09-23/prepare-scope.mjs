import {readFile, writeFile, copyFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const dir=dirname(fileURLToPath(import.meta.url));
const root=resolve(dir,'../../../..');
const prior=join(dir,'../market-wide-2026-09-22');
const bytes=await readFile(join(prior,'next-company-queue.json'));
const queue=JSON.parse(bytes);
const keywords=[
  ['A','网络安全与数据安全','网络安全 数据安全 公司 招聘 渠道 销售 售前'],
  ['A','能源与电力数字化','能源 电力 数字化 公司 招聘 商务 销售 运营'],
  ['A','医疗数字化与AI','医疗 数字化 人工智能 公司 招聘 商务 销售'],
  ['A','物流与供应链科技','物流 供应链 科技 招聘 大客户 销售运营'],
  ['A','跨境支付与金融科技','跨境支付 金融科技 招聘 商务 渠道 运营'],
  ['A','教育与培训数字化','教育 数字化 AI 公司 招聘 商务 市场 销售管理'],
  ['A','遥感与空间信息','遥感 空间信息 公司 招聘 行业销售 售前'],
  ['A','语音与对话式AI','语音 对话式AI 公司 招聘 销售 生态 商务'],
  ['B','行业能力迁移','招聘 汽车行业 客户经营 大客户 数字化'],
  ['B','业务增长与商业化','招聘 商业化 增长负责人 AI 企业服务'],
  ['B','渠道与生态','招聘 渠道拓展 生态合作 云计算 大模型'],
  ['B','销售管理与经营','招聘 销售管理 经营分析 目标拆解'],
  ['B','市场与产品营销','招聘 产品营销 市场拓展 企业软件'],
  ['B','方案价值与售前','招聘 解决方案顾问 商业价值 ROI'],
  ['B','海外商业称谓','China enterprise AI business development partnerships careers'],
  ['B','经营类英文称谓','China sales operations revenue operations GTM careers']
];
const tasks=queue.companies.map((c,i)=>({id:`c${String(i+1).padStart(3,'0')}`,route:'A-backfill',company:c.display_name,
  operation:'search',request:{search_query:[{q:`${c.display_name} 招聘 销售 商务 运营 售前`}],response_length:'long'},
  prior_evidence:c.evidence,status:'pending',company_identity_verified:false}));
for(const [i,[route,industry,q]] of keywords.entries())tasks.push({id:`k${String(i+1).padStart(2,'0')}`,route,industry,
  operation:'search',request:{search_query:[{q}],response_length:'long'},status:'pending'});
const scope={schema_version:1,run_id:'market-wide-2026-09-23',frozen_at:new Date().toISOString(),
  goal:'全市场已收齐',goal_is_completion:false,prior_frontier:relative(root,join(prior,'next-company-queue.json')),
  prior_frontier_sha256:createHash('sha256').update(bytes).digest('hex'),
  company_display_names:queue.companies.length,industry_and_keyword_queries:keywords.length,tasks,
  public_page_read_checkpoint_budget:60,budget_is_market_completion:false,
  excluded_sources:['zhipin.com','liepin.com','linkedin.com','minimax.cn','farben.com.cn'],
  excluded_sources_note:'Preserve prior access halts and quarantines; other prior restricted sources also remain halted. Search-engine discoveries are leads, not recovery of these sources.',
  prior_failed_pages:'Keep last-batch timeout URLs pending; no automatic retries of failed URLs in this wave.',
  network:'One actual web action per shared web-session admission; serial 10-20s; stop restricted source immediately.',
  external_actions:0,scheduler_enabled:false,market_complete:false};
await mkdir(join(dir,'raw'),{recursive:true});
await writeFile(join(dir,'scope.json'),JSON.stringify(scope,null,2)+'\n',{flag:'wx'});
for(const name of ['persist-capture.mjs','search-index.mjs','search-job-leads.mjs','compose-report-jobs.mjs'])await copyFile(join(prior,name),join(dir,name));
console.log(JSON.stringify({scope:relative(root,join(dir,'scope.json')),companies:queue.companies.length,queries:tasks.length}));
