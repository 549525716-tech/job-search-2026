import {readFile, writeFile, copyFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const dir=dirname(fileURLToPath(import.meta.url));
const root=resolve(dir,'../../../..');
const prior=join(dir,'../market-wide-2026-09-23');
const bytes=await readFile(join(prior,'next-company-queue.json'));
const queue=JSON.parse(bytes);
const rejected=queue.companies.filter(c=>/^20\d\d/.test(c.display_name));
const companies=queue.companies.filter(c=>!rejected.includes(c));
const seeds=['MiniMax','月之暗面','智谱','第四范式','科大讯飞','火山引擎','阿里云','腾讯云','商汤科技','百度智能云'];
const keywords=[
  ['A','大模型与AI应用','大模型 AI Agent 公司 招聘 商业化 销售 生态合作'],
  ['A','企业软件与SaaS','企业软件 SaaS 招聘 大客户 渠道 销售运营'],
  ['A','智能硬件与具身智能','具身智能 机器人 智能硬件 招聘 销售 商务 渠道'],
  ['A','工业与制造数字化','工业软件 制造业 数字化 招聘 解决方案 销售'],
  ['A','汽车与出行科技','汽车 数字化 商业化 招聘 大客户 运营 管理'],
  ['A','营销科技与广告','营销科技 广告 招聘 商业化 销售运营 区域经理'],
  ['A','云计算与算力','云计算 算力 招聘 行业销售 生态合作 渠道'],
  ['A','数据与网络安全','数据安全 网络安全 招聘 销售 售前 渠道'],
  ['A','能源与物流科技','能源 物流 科技 招聘 商务拓展 大客户'],
  ['A','医疗与教育AI','医疗 教育 AI 招聘 商务 市场 销售'],
  ['B','商业化与业务构建','Business Builder Ecosystem AI 招聘 商业化'],
  ['B','AI行业客户经营','大模型 行业KA 客户经理 招聘 20 40'],
  ['B','合作伙伴与渠道','AI 招聘 Partner Development 生态 合作伙伴'],
  ['B','经营分析与销管','销售运营 经营分析 目标拆解 招聘 20 30'],
  ['B','区域管理与团队','企业服务 区域负责人 销售经理 招聘 团队管理'],
  ['B','产品市场营销','产品市场经理 AI B2B 招聘 营销'],
  ['B','业务价值与售前','AI 解决方案顾问 售前 招聘 客户 ROI'],
  ['B','非标准英文岗位','China AI GTM revenue operations business development careers']
];
const tasks=seeds.map((company,i)=>({id:`s${String(i+1).padStart(2,'0')}`,route:'A-refresh',company,
  operation:'search',request:{search_query:[{q:`${company} 招聘 销售 商务 商业化 售前`}],response_length:'long'},status:'pending'}));
for(const [i,c] of companies.entries())tasks.push({id:`c${String(i+1).padStart(3,'0')}`,route:'A-backfill',company:c.display_name,
  operation:'search',request:{search_query:[{q:`${c.display_name} 招聘 销售 商务 运营 售前`}],response_length:'long'},
  prior_evidence:c.evidence,status:'pending',company_identity_verified:false});
for(const [i,[route,industry,q]] of keywords.entries())tasks.push({id:`k${String(i+1).padStart(2,'0')}`,route,industry,
  operation:'search',request:{search_query:[{q}],response_length:'long'},status:'pending'});
const scope={schema_version:1,run_id:'market-wide-2026-10-08',frozen_at:new Date().toISOString(),
  goal:'全市场已收齐',goal_is_completion:false,prior_frontier:relative(root,join(prior,'next-company-queue.json')),
  prior_frontier_sha256:createHash('sha256').update(bytes).digest('hex'),
  company_display_names:companies.length,refresh_company_names:seeds.length,industry_and_keyword_queries:keywords.length,tasks,
  identity_review_queue:rejected.map(c=>({...c,reason:'Search template captured a year/city/role string, not verified employer identity. Retain source evidence; do not count as company.'})),
  public_page_read_checkpoint_budget:40,budget_is_market_completion:false,
  excluded_sources:['zhipin.com','liepin.com','linkedin.com','minimax.cn','farben.com.cn'],
  excluded_sources_note:'Existing halts retained. Search index is independent discovery evidence, never recovery of restricted platforms.',
  network:'One actual web action per shared web-session admission; serial 10-20s; stop restricted sources immediately.',
  model_allocation:'Current conversation model only, as explicitly requested; no dispatched subagents or model API calls.',
  external_actions:0,scheduler_enabled:false,market_complete:false};
await mkdir(join(dir,'raw'),{recursive:true});
await writeFile(join(dir,'scope.json'),JSON.stringify(scope,null,2)+'\n',{flag:'wx'});
for(const name of ['persist-capture.mjs','search-index.mjs','search-job-leads.mjs','compose-report-jobs.mjs'])await copyFile(join(prior,name),join(dir,name));
console.log(JSON.stringify({scope:relative(root,join(dir,'scope.json')),companies:companies.length,identity_review:rejected.length,queries:tasks.length}));
