import {readFile,writeFile} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {digest,scoreCapabilities} from '../../../../careers/capability-scoring.mjs';
const dir=dirname(fileURLToPath(import.meta.url)),root=resolve(dir,'../../../..');
const read=async path=>JSON.parse(await readFile(resolve(root,path),'utf8'));
const input=await read('careers/config/capability-review-input.json'),rubric=await read('careers/config/capability-rubric.json');
for(const fact of input.facts)assert((await readFile(resolve(root,fact.path),'utf8')).includes(fact.quote),'FACT_QUOTE_CHANGED');
for(const [path,hash]of Object.entries(input.context_sources))assert.equal(digest(await readFile(resolve(root,path),'utf8')),hash,'CONTEXT_CHANGED');
const jobs=JSON.parse(await readFile(join(dir,'enriched-report-jobs.json'),'utf8'));
const c=(capability,jd_quote,anchor,fact_ids,reason,weight=100)=>({capability,jd_quote,anchor,fact_ids,reason,weight});
const gate=(label,jd_quote,status,fact_ids,reason)=>({label,jd_quote,status,fact_ids,reason});
const defs=[
 {
  id:'market-wide-2026-10-08:p31:l16',profile:'sales_operations',
  mission:'把大模型销售从个人跟单转为规则、指标、资源和风险可管理的经营体系；这比技术售前更接近当前经历。',
  weight_reason:'采用销售运营权重20/15/25/20/10/10，重视指标诊断与机制执行；财务及跨部门治理缺证单独扣分。第三方转载尚待原厂核验。',
  criteria:[
   [c('销售规则与业绩机制','设计并优化销售管理规则','transfer_strong',['F-management','F-target'],'招聘、绩效与激励决策和区域复盘可迁移；没有证明建立过大模型厂商的企业级销售制度。')],
   [c('客户分层与资源覆盖','客户分层及业务团队分工','direct_partial',['F-target','F-map'],'有客户优先级工具与同事分工督办；资源流转权限及组织级覆盖增量还未量化。')],
   [c('指标问题诊断','针对核心数据和指标链路，能准确、快速定位问题并反馈','direct_partial',['F-analysis','F-map'],'CTR/CVR分析与经营诊断直接相关，尚需展示一次从诊断到经营动作验证的完整闭环。',60),c('财务和销售指标关联','有基本的财务分析能力','unknown',[],'现有材料没有毛利、费用、收入确认或回款预测分析案例，不能用商业消耗替代。',40)],
   [c('跨部门经营规则执行','联动财务、产品、研发等团队','transfer_partial',['F-target'],'已确认跨区域协作及政策参与，但未确认与财务、产品、研发共同落地的规则变化。')],
   [c('数据系统化','推动数据看板线上化','transfer_strong',['F-map','F-analysis'],'能用内部AI工具证明业务数据转决策；不能写成企业级数据治理或正式销售系统建设。')],
   [c('组织采用和反馈闭环','提升组织效能与产能','transfer_strong',['F-map','F-target'],'团队全员使用与周期复盘有证据；150%是个人测量，不代表团队或企业产能提升。')]
  ],
  gates:[gate('本科学历','本科及以上学历','met',['F-degree'],'有本科学历材料；未做背景调查。'),gate('三年以上相关经历','3年以上销售管理、销售运营或相关岗位工作经验','met',['F-tenure','F-management','F-target'],'汽车销售管理及平台经营属于相关经历，不能据此称三年以上大模型销售运营。'),gate('财务分析能力','有基本的财务分析能力','unknown',[],'需要一个真实的财务指标与销售指标联动案例。')],
  translation:{capability:'把区域经营经验转成销售运营机制能力',example:'主导目标拆解、客户分层和周月复盘，用经营数据判断资源优先级，再以AI客户地图把客户选择、拜访动作与复盘形成可复用工作流。',boundary:'不宣称已建立AI厂商收入、合同、财务或风险管理体系；薪资周期和原厂在招状态均待核。',proof_needed:'脱敏展示一份目标拆解表、客户优先级规则和复盘行动闭环；补充真实财务分析样例，明确你参与政策调整的决策边界。'}
 },
 {
  id:'market-wide-2026-10-08:p32:l16',profile:'technical_sales',
  mission:'面向头部客户完成从AI场景识别、技术演示到POC和规模化商业落地的技术销售闭环，当前不是高匹配主攻岗。',
  weight_reason:'技术销售权重15/20/20/15/25/5；技术Demo、客户POC及云/MaaS经历是核心要求，不用零售业绩抵消。',
  criteria:[
   [c('KA开拓与深耕','头部 KA 开拓与深耕','transfer_partial',['F-customers','F-recovery'],'个人商户开拓经营可以迁移，但不等于集团级AI采购与百万级合同闭环。')],
   [c('多层次客户决策关系','建立并维护产品、技术、业务、高管等多层次客户关系','transfer_partial',['F-contact'],'已接触业务负责人；缺少企业产品技术高管多方共同采购的证据。')],
   [c('AI场景与业务价值','能快速识别客户最具 ROI 价值的 AI 落地场景','transfer_strong',['F-map','F-analysis'],'内部AI项目说明业务问题识别能力；客户购买与收益验收尚未验证。')],
   [c('跨职能项目落地','能高效整合研发、产品、交付等内部资源','transfer_partial',['F-target'],'区域分工督办有相邻能力，但缺外部客户工程项目资源整合。')],
   [c('独立技术Demo','独立制作并演示技术 Demo','unknown',[],'内部地图不等于独立制作模型API Demo；未读取可运行演示和技术方案证据。',50),c('客户级POC','推动 POC 快速推进','gap',['F-ai-gap'],'本人事实画像明确尚无客户级POC。',50)],
   [c('客户内部规模化','推动 AI 应用在客户内部规模化复制','transfer_partial',['F-map'],'内部团队采用可作迁移案例，不是客户侧AI产品上线及扩容合同。')]
  ],
  gates:[gate('本科学历','本科及以上学历','met',['F-degree'],'有本科材料。'),gate('云厂商/MaaS ToB年限','3 年以上云厂商或MaaS 平台ToB 销售经验','unmet',['F-tenure','F-ai-gap'],'已知经历为汽车零售管理与广告平台商户经营，不符合明确的三年云/MaaS销售年限。'),gate('独立技术演示','独立制作并演示技术 Demo','unknown',[],'需技术演示作品和实操验证。')],
  translation:{capability:'业务场景诊断是切入点，技术销售闭环仍有明显缺口',example:'展示如何将分散的商业消耗、客户位置和线索表现转成可执行客户优先级规则，说明问题定义、工具验证与团队采用过程。',boundary:'不把内部工具称为客户级POC，不补造云厂商年限、API签约和AI回款。',proof_needed:'先补一个可运行API Demo与评价指标，并形成客户试点设计；即使补作品，也不能消除三年行业年限门槛。'}
 },
 {
  id:'market-wide-2026-10-08:o03:l43',profile:'business_builder',
  mission:'理解客户业务并把AI变为可执行的改造方案和项目成果，而不只是介绍AI工具；适合以真实行业案例探索转型。',
  weight_reason:'采用商业探索20/15/20/15/15/15，关注场景判断、方案落地和可复用验证；不能把内部实践当咨询交付业绩。',
  criteria:[
   [c('方案交付导向','推动方案真正落地','transfer_strong',['F-map','F-target'],'工作流有团队采用与督办，外部付费咨询交付及验收未证明。')],
   [c('理解客户业务','快速理解客户业务场景','direct_partial',['F-customers','F-contact'],'深耕汽车商户经营有直接证据；不外推为跨行业专家。')],
   [c('结构化业务诊断','拆解复杂问题，形成清晰、可执行的解决方案','direct_partial',['F-analysis','F-map'],'车型诊断与优先级工具是直接案例；需要具体改善回查。')],
   [c('沟通与项目推进','参与客户沟通、方案汇报与项目推进','transfer_strong',['F-contact','F-target'],'客户沟通和跨区域督办可迁移，咨询项目预算、周期和验收经验未知。')],
   [c('AI与真实流程结合','判断 AI 如何进入客户的真实业务场景','transfer_strong',['F-map','F-analysis'],'能说明AI在本人业务中的实际用途；还需模型局限、数据安全与效果评价。')],
   [c('把方案转为结果','能推动项目，而不只是产出材料','transfer_strong',['F-map','F-target'],'全员使用和复盘机制证明采用，但缺外部客户的持续收益证据。')]
  ],
  gates:[gate('相关业务经验','有咨询、品牌策略、营销增长、平台解决方案、数字化转型或 AI 商业化相关经验','met',['F-customers','F-analysis'],'平台商业化经营与营销增长具有相关证据，不等同已做AI咨询签约。'),gate('结构化表达与协作','具备较强的结构化思考、表达与跨团队协作能力','met',['F-target','F-map'],'有跨区域督办和业务工具落地，需用案例展示质量。')],
  translation:{capability:'行业知识驱动的AI业务改造',example:'从汽车商户经营中的信息分散和客户优先级判断出发，设计客户地图与车型分析流程，把诊断转换为每日客户选择、拜访动作和商户经营建议，推动团队采用。',boundary:'个人测量的效率提升不推广为团队或客户ROI；不宣称外部AI付费交付、合同或财务收益。',proof_needed:'一份脱敏案例：业务问题、原流程、AI介入点、人工校验、使用记录和前后对比；明确上海工作意愿、薪资与项目职责。'}
 },
 {
  id:'market-wide-2026-10-08:p05:l566',profile:'industry_ka',
  mission:'在AI数据中心及网络产品市场开拓区域客户，联动售前与渠道，完成方案推进、回款和行业标杆。',
  weight_reason:'行业KA20/25/20/15/10/10；客户推进经验可迁移，但技术理解与IT产品交易链路不能默认具备。',
  criteria:[
   [c('独立开发','独立开拓新客户','direct_partial',['F-recovery','F-customers'],'有独立新增客户及存量经营结果；产品客单和决策链复杂度不同。',50),c('回款与库存流转','协调收取客户货款及产品存货流转','transfer_partial',['F-tenure'],'汽车销售经验相邻，未证实IT设备回款及库存财务管理。',50)],
   [c('行业重点客户覆盖','聚焦所负责区域中的行业头部客户','transfer_strong',['F-customers','F-map'],'客户分层和区域经营可迁移；教科研或数据中心头部资源待补。')],
   [c('客户需求转产品方案','根据客户需求制订产品方案','transfer_strong',['F-analysis','F-contact'],'业务诊断到方案建议可迁移，但网络/GPU配置与招投标未证实。')],
   [c('售前与渠道协作','与总代理紧密配合','transfer_partial',['F-target','F-channel'],'有渠道增长与资源协作，缺IT总代理联合商机和渠道规则案例。')],
   [c('技术与行业理解','对于光通信、数据中心技术和人工智能未来发展有深入理解','unknown',[],'内部AI工具使用不证明光通信或数据中心技术能力。')],
   [c('行业标杆复制','建立行业标杆','transfer_partial',['F-map','F-target'],'可展示流程沉淀，尚无数据中心客户标杆或横向复制订单。')]
  ],
  gates:[gate('技术行业理解','对于光通信、数据中心技术和人工智能未来发展有深入理解','unknown',[],'需要产品与行业知识验证。'),gate('优先项：IT产品销售年限','具有2年以上IT产品、网络产品、GPU或数据中心相关产品销售经验优先','unknown',[],'此项写明优先，不当作必需淘汰门槛；当前履历也不证明已有该经验。')],
  translation:{capability:'区域客户经营和售前协同',example:'用客户分层、优先级地图及经营复盘证明能管理区域客户覆盖和行动节奏，再解释如何与售前共同把需求变成方案。',boundary:'不声称已有GPU销售、数据中心投标、教科研资源或设备回款经验。',proof_needed:'准备区域拓客案例、客户决策链和跟进计划；补产品线与典型客户场景学习，确认薪资构成。'}
 }
];
const assessments=[],results=[];
for(const s of defs){
 const job=jobs.find(j=>j.id===s.id);assert(job,'JOB_NOT_FOUND');
 const a={profile:s.profile,mission:s.mission,weight_reason:s.weight_reason,dimensions:rubric.dimensions.map((d,i)=>({id:d.id,criteria:s.criteria[i]})),hard_gates:s.gates,hard_gate_review_complete:true,translation:s.translation,job_ids:[job.id],jd_hashes:[digest([job.title,job.description,job.requirements,job.experience,job.education])],execution:{type:'current_conversation_review',model:'current conversation per user; model not independently verified',independent_qa:false}};
 const result=scoreCapabilities(a,job,input.facts,rubric);assessments.push(a);results.push({id:job.id,company:job.company,title:job.title,score:result.score,hard_gate_status:result.hard_gate_status,unknown_weight:result.unknown_weight,mission:a.mission,translation:a.translation,source:job.job_url??job.source_url});
}
await writeFile(join(dir,'current-assessments.json'),JSON.stringify(assessments,null,2)+'\n');
await writeFile(join(dir,'current-match-summary.json'),JSON.stringify({scope:'四条完整JD的证据覆盖初评，不是录用概率或独立验收；未读取基础简历，不建议直接沿用。',results},null,2)+'\n');
console.log(JSON.stringify(results.map(({company,title,score,hard_gate_status,unknown_weight})=>({company,title,score,hard_gate_status,unknown_weight}))));
