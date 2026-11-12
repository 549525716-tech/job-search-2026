import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {ROOT,REPORT_DIR} from './paths.mjs';
import {parseSalary} from './salary.mjs';
import {evaluateSalaryTarget} from './salary-target.mjs';
import {classifyRole} from './role-policy.mjs';
import {digest,scoreCapabilities,capabilityCacheKey,companyTierTodo,groupCompanyEntrances} from './capability-scoring.mjs';
import {csvCell} from './overview.mjs';

const OPERATIONS='01_行情收集/official-careers/research/operations-2026-09-14/jobs-and-matches.json';
const COVERAGE='01_行情收集/official-careers/reports/coverage-jobs.json';
const e=(s)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safe=(s)=>{try{const u=new URL(s);return /^https?:$/.test(u.protocol)&&!u.username&&!u.password?u.href:null;}catch{return null;}};
const link=(url,label)=>safe(url)?`<a href="${e(safe(url))}" target="_blank" rel="noopener noreferrer">${e(label)}</a>`:`${e(label)}：未取得`;
const list=(xs)=>`<ul>${xs.map(x=>`<li>${e(x)}</li>`).join('')}</ul>`;
const fixedRule={mode:'fixed_monthly_base_minimum',currency:'CNY',period:'month',min_fixed_monthly_base:20000};
const jobHash=j=>digest([j.title,j.description,j.requirements,j.experience,j.education]);
const factStatus={platform_reported:'平台展示',cross_source_observation:'跨源观察记录',company_self_description:'公司自述',JD_derived:'JD推导',user_reported_pending_platform_capture:'用户补充，平台待复核',user_reported_pending_certificate_verification:'用户补充，资质待核'};

export function deliveryLabel(acceptance) {
  return acceptance?.status==='accepted'&&acceptance.breadth_status==='passed'&&Array.isArray(acceptance.formal_review_evidence)&&acceptance.formal_review_evidence.length>0
    ? '声明范围已验收，仍非全市场穷尽'
    : '阶段样本：未通过宽度验收，非正式推荐';
}

function industryLabel(label) {
  if(/基础大模型|基础模型|MaaS|云、算力|AI基础设施/.test(label))return '大模型、云与AI基础设施';
  if(/营销科技|GEO|跨境营销/.test(label))return '营销科技与企业增长';
  if(/智能硬件|汽车数字化|汽车科技|半导体/.test(label))return '智能硬件与汽车科技';
  if(/AI企业应用|AI应用|企业软件|SaaS/.test(label))return 'AI应用与企业软件';
  if(/互联网|本地生活/.test(label))return '互联网与商业服务';
  return label||'行业待核';
}

export function groupIndustries(groups) {
  const industries=new Map();
  for(const group of groups) {
    const labels=[...new Set((group.profile?.industry?[group.profile.industry]:group.jobs.map(j=>j.industry)).filter(Boolean))];
    const normalized=[...new Set(labels.map(industryLabel))];
    const discovery=[...new Set(group.jobs.map(j=>j.discovery_industry).filter(Boolean).map(industryLabel))];
    const label=normalized.length===1?normalized[0]:normalized.length===0&&discovery.length===1?`检索方向：${discovery[0]}（行业待核）`:'行业待核';
    if(!industries.has(label))industries.set(label,{label,groups:[],source_labels:[]});
    const industry=industries.get(label);
    industry.groups.push(group);
    industry.source_labels.push(...labels.filter(x=>!industry.source_labels.includes(x)));
  }
  return [...industries.values()].sort((a,b)=>Number(a.label==='行业待核')-Number(b.label==='行业待核'));
}

const displayTime=value=>value?new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',dateStyle:'short',timeStyle:'short'}).format(new Date(value)):'未记录';

function companyHTML(g) {
  return `<details class="company" data-group="${e(g.key)}"><summary class="company-summary"><span class="company-heading"><b>${e(g.company)}</b><span class="muted">${e(g.profile?.industry||[...new Set(g.jobs.map(j=>j.industry).filter(Boolean))].join(' / ')||'行业待核')}</span></span><span class="company-count">${g.jobs.length}条观察</span><span class="company-signal"></span></summary><div class="company-body">${g.profile?`<p class="muted">${e(g.profile.legal_name||'法律主体待核')} · ${e(g.profile.identity_note)}</p><div class="facts">${g.profile.facts.map(f=>`<span><b>${e(f.label)}：</b>${e(f.value)} <small>(${e(factStatus[f.status]||f.status)}，${e(f.observed_at)})</small></span>`).join('')||'<span>人数、融资、资质标签：未取得</span>'}</div><p class="warning">${e(g.profile.attention)}</p>`:'<p class="muted">公司背景待补；本组仅用于相邻展示，不代表已确认法律雇主。不同联系入口均保留。</p>'}<div class="jobs">${g.jobs.map(rowHTML).join('')}</div></div></details>`;
}

function collectionHTML(collection) {
  if(!collection.runs?.length)return '';
  return `<details class="policy"><summary>实际采集记录与未完成入口</summary>${collection.runs.map(({data:r})=>`<section><h3>${e(r.run_id)}</h3><p>${e(displayTime(r.started_at))} 至 ${e(displayTime(r.finished_at))} · ${e(r.request_count?.web_tool_actual_calls??'未知')}次工具请求 · ${e(r.counts?.complete_jd??'未知')}条完整职责与要求</p><p>${e(r.scope)}</p>${list((r.queries??[]).map(q=>`${q.query} · ${q.status}`))}${r.request_count?.admission_timing_status==='not_fully_verified'?'<p class="warning"><b>运行记录有缺口：</b>存在未独立落账的重复请求；全程限速未验收，已停止该执行分支。</p>':''}<ul>${(r.queued_urls??[]).map(q=>`<li>${link(q.url,'待续来源')}：${e(q.reason)}</li>`).join('')}</ul></section>`).join('')}</details>`;
}

export function salaryOpportunity(job,rule) {
  const url=job.job_url||job.source_url||'';
  const hints=/^https:\/\/(?:www\.)?(?:zhipin\.com|liepin\.com)\//.test(url)?{currency:'CNY',period:'month'}:{};
  const parsed=parseSalary(job.salary_raw,hints);
  return {...evaluateSalaryTarget(parsed,rule),parsed,fixed_base:evaluateSalaryTarget(parsed,fixedRule)};
}

export function keywordInventory(jobs,axes,profiles=[]) {
  const profileFor=id=>profiles.find(p=>p.job_ids?.includes(id));
  const terms=[];
  for(const axis of axes) for(const term of axis.terms) {
    const evidence=[];
    for(const job of jobs) {
      for(const field of ['company','title','description','requirements']) {
        const value=String(job[field]??''); const pos=value.toLowerCase().indexOf(term.toLowerCase());
        if(pos<0) continue;
        evidence.push({job_id:job.observation_key??job.id,company:job.company,entity_id:profileFor(job.id)?.identity_reviewed?profileFor(job.id).entity_id:null,
          source_field:field,quote:value.slice(Math.max(0,pos-24),pos+term.length+55),url:job.job_url||job.source_url||null,
          observed_at:job.observed_at??null,evidence_file:job.evidence_file??null,source_sha256:job.evidence_sha256??null,jd_complete:job.description_complete===true});
        break;
      }
    }
    const employers=new Set(evidence.map(x=>x.entity_id).filter(Boolean));
    terms.push({axis:axis.id,axis_label:axis.label,term,evidence,status:employers.size>=2?'跨已核公司样本共性':evidence.length?'样本命中，非市场共性':'启动假设，待研究',independent_employers:employers.size});
  }
  return terms;
}

function assessmentHTML(job) {
  const a=job.assessment;if(!a)return '<p class="muted">尚未结构化评分；标题或正文关键词命中不等于推荐。</p>';
  return `<p><b>岗位本质：</b>${e(a.mission)}</p><p class="muted">${e(a.weight_reason)}</p><div class="table-scroll"><table><thead><tr><th>能力维度</th><th>权重</th><th>维度得分</th><th>计入总分</th></tr></thead><tbody>${a.result.dimensions.map(d=>`<tr><td>${e(d.label)}</td><td>${d.weight}%</td><td>${d.score}/100</td><td>${d.contribution.toFixed(1)}</td></tr>`).join('')}</tbody></table></div>
  ${a.result.dimensions.map(d=>`<details class="dimension"><summary>${e(d.label)} · ${d.score}分</summary>${d.criteria.map(c=>`<section><p><b>${e(c.capability)}</b> · 子权重${c.weight}% · ${c.score}分 · ${e(c.evidence_kind)}</p><p>JD原句：${e(c.jd_quote)}</p><p>${e(c.reason)}</p>${list(c.facts.map(f=>`个人证据（本人陈述）：${f.quote}`))}</section>`).join('')}</details>`).join('')}
  <h4>硬门槛，不用总分抵消</h4>${list(a.hard_gates.map(g=>`${g.label}：${{met:'有证据',unmet:'当前不满足',unknown:'待确认'}[g.status]}。${g.reason}`))}
  <h4>把经历转成对方听得懂的案例</h4><p><b>${e(a.translation.capability)}</b></p><p>${e(a.translation.example)}</p><p class="warning"><b>不能越界：</b>${e(a.translation.boundary)}</p><p><b>下一份材料：</b>${e(a.translation.proof_needed)}</p><p class="muted">${a.result.unknown_weight}%权重目前未举证；不是认定没有能力。未读取并核验基础简历的岗位主线，不建议直接沿用；本轮不修改或发送简历。</p>`;
}

export function descriptionStatus(job) {
  if (job.source_kind === 'search_index_lead') return '搜索索引线索，未读取岗位正文';
  if (job.description_complete) return '已取得职责与要求';
  if (job.source_description_complete && job.description_structure_status === 'full_source_not_split') return '官网JD全文已保存，职责/要求未单独拆分';
  return '线索/正文未完整取得';
}

function rowHTML(source) {
  // Keep auxiliary requirements visible without rewriting the evidence record.
  const job={...source,requirements:[source.requirements,source.additional_requirements].filter(Boolean).join('\n\n')||null};
  const salary=job.salary_opportunity;const score=job.assessment?.result.score;
  return `<article class="job" data-salary="${salary.parsed.salary_min??-1}" data-opportunity="${salary.eligible}" data-pool="${salary.eligible?2:salary.pending?1:0}" data-salary-comparable="${!salary.pending}" data-score="${score??-1}" data-role="${job.role.eligible}" data-source="${e(job.dataset)}" data-latest="${job.latest_collection===true}" data-search="${e([job.company,job.title,job.industry,job.city,job.description,job.requirements,job.search_excerpt].join(' ').toLowerCase())}"><header><div><h3>${e(job.title||'岗位名称待核')}</h3><p>${e(job.city||job.location||'地区未取得')} · ${e(job.channel||job.source_kind||'来源待核')} · ${e(job.hr_display_name||job.contact_name||'联系人未取得')}</p></div><div class="salary"><strong>${e(job.salary_raw||'薪资待核')}</strong><span>${score==null?'待评分':`能力证据 ${score}/100`}</span></div></header><p class="status"><b>${salary.eligible?'招聘区间覆盖20K':salary.pending?'薪资待确认':'招聘区间低于20K'}</b> · 固定底薪${salary.fixed_base.eligible?'明确披露≥20K':'待核'} · ${e(job.role.category)}${job.assessment?.result.hard_gate_status==='unmet'?' · 硬门槛当前不满足':''}</p><p class="muted">${e(job.identity_note||'')} · 读取：${e(job.observed_at||'未记录')} · ${e(descriptionStatus(job))} · 当前在招状态未重新核验</p><p>${link(job.job_url,'职位入口')} · ${link(job.apply_url||job.application_url,'申请入口')} ${job.source_url?`· ${link(job.source_url,'来源页（不等于职位直链）')}`:''}</p>
  ${job.search_excerpt?`<details><summary>搜索返回片段（非完整JD）</summary><pre>${e(job.search_excerpt.replace(/[^]*/g,''))}</pre></details>`:''}
  ${job.attention?`<p class="warning"><b>注意：</b>${e(job.attention)}</p>`:''}${job.fixed_base_quote?`<p><b>原文底薪：</b>${e(job.fixed_base_quote)}；与招聘总区间分开核验。</p>`:''}${job.assessment?`<p><b>判断：</b>${e(job.assessment.mission)}</p><details class="assessment"><summary>评分拆解、真实缺口与案例表达</summary>${assessmentHTML(job)}</details>`:''}<details><summary>JD全文与取证信息</summary><h4>${job.description_structure_status==='full_source_not_split'?'官网JD全文':'职责'}</h4><pre>${e(job.description||job.source_role_text||'未取得')}</pre><h4>要求</h4><pre>${e(job.requirements||(job.description_structure_status==='full_source_not_split'?'见上方原文，尚未单独拆分':'未取得'))}</pre>${job.company_facts_quote?`<h4>来源所述公司信息（未独立核验）</h4><pre>${e(job.company_facts_quote)}</pre>`:''}<p>${e(job.time_note||'首次看到不等于首次发布')}</p><p>${e(job.salary_period_note||'')}</p><p class="muted">${e(job.evidence_file||'无原文文件')} · SHA ${e(job.evidence_sha256||'未提供')}</p><p>${e(job.scope_note||job.status||'原始观察保留；不据此判断全市场覆盖')}</p></details></article>`;
}

export function renderDecisionReview(report) {
  const industries=groupIndustries(report.groups);
  const groups=industries.map((g,i)=>`<details class="industry" data-industry="${e(g.label)}" open><summary class="industry-summary"><h2>${e(g.label)}</h2><span class="industry-count">${g.groups.length}家公司 / 品牌</span></summary><div class="industry-companies" id="industry-${i}">${g.groups.map(companyHTML).join('')}</div></details>`).join('');
  const collection=report.collection??{};
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>私人猎头 · 机会研判</title><style>
  *{box-sizing:border-box;letter-spacing:0}body{margin:0;background:#fff;color:#20262b;font:14px/1.55 -apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif;overflow-wrap:anywhere}main{max-width:1320px;margin:auto;padding:20px 24px}h1{font-size:23px;margin:0}h2{font-size:19px;margin:0}h3{font-size:16px;margin:0}h4{font-size:14px;margin:12px 0 4px}p{margin:5px 0}a{color:#006c64}header,.company-head{display:flex;justify-content:space-between;gap:16px;align-items:start}.top{align-items:center;border-bottom:1px solid #ccd4d8;padding-bottom:12px}.metrics,.facts{display:flex;gap:10px 24px;flex-wrap:wrap}.metrics{padding:12px 0}.metrics b{font-size:22px}.notice{border-left:3px solid #c18429;background:#fff8e7;padding:8px 12px}.muted,small{color:#5d6870;font-size:12px}.warning{color:#845200}.toolbar{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:14px 0}input,select{font:inherit;border:1px solid #89969c;border-radius:4px;padding:7px 10px;max-width:100%}input{width:260px}label{display:flex;align-items:center;gap:6px}label input{width:auto}.company{border-top:2px solid #08776e;margin-top:16px;padding:12px 0 0}.company-head{color:#075f58}.facts{padding:7px 0}.job{padding:12px 0;border-top:1px solid #d9e0e3}.salary{text-align:right;min-width:170px;flex-shrink:0}.salary strong{font-size:18px;color:#9a342d;display:block}.salary span{color:#005f5a;font-weight:600}.status{font-size:12px}.status b{color:#075f58}summary{color:#006c64;cursor:pointer;padding:5px 0}details{margin-top:4px}pre{white-space:pre-wrap;font:inherit;background:#f6f7f8;padding:10px;overflow-wrap:anywhere}ul{padding-left:20px;margin:5px 0}.dimension section{border-left:2px solid #d3dcde;padding:4px 12px;margin:5px 0}.table-scroll{overflow:auto}table{border-collapse:collapse;width:100%;font-size:13px}th,td{text-align:left;padding:6px 10px;border-bottom:1px solid #d9e0e3}th{background:#f1f4f5}.keywords{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 20px}.keyword{border-top:1px solid #d9e0e3;padding:8px 0}.keyword p{margin:2px 0}details.policy{border-bottom:1px solid #ccd4d8;padding:6px 0}[hidden]{display:none!important}@media(max-width:650px){main{padding:14px 12px}.top,header,.company-head{display:block}.salary{text-align:left;margin-top:4px;min-width:0}.keywords{grid-template-columns:1fr}.toolbar{gap:8px}.toolbar>input{width:100%}.facts{display:block}.facts>span{display:block}h1{font-size:21px}.metrics b{font-size:19px}}
  .industry{border-top:2px solid #08776e;margin-top:14px}.industry-summary,.company-summary{display:flex;align-items:center;gap:12px;list-style:none}.industry-summary::-webkit-details-marker,.company-summary::-webkit-details-marker{display:none}.industry-summary:before,.company-summary:before{content:'›';font:24px/1 sans-serif;flex:0 0 12px;text-align:center;transform:rotate(0deg)}.industry[open]>.industry-summary:before,.company[open]>.company-summary:before{transform:rotate(90deg)}.industry-summary{padding:12px 4px;background:#f1f6f5}.industry-summary h2{flex:1;min-width:0;font-size:17px}.industry-count{color:#536267;font-size:12px}.company{border-top:1px solid #d9e0e3;margin:0;padding:0}.company-summary{padding:10px 5px;color:#20262b}.company-summary:hover{background:#f6f8f9}.company-heading{flex:1;min-width:0;display:flex;gap:2px;flex-direction:column}.company-heading b{font-size:15px}.company-count{font-size:12px;color:#586970;white-space:nowrap}.company-signal{width:240px;max-width:40%;text-align:right;color:#8a3730;font-size:12px}.company-body{padding:0 12px 8px 29px}.industry-companies{padding-left:12px}.depth-controls{display:flex;gap:0;flex-wrap:wrap}.depth-controls button{font:inherit;background:#fff;color:#41555b;border:1px solid #7c8e93;padding:7px 11px;cursor:pointer;margin-right:-1px}.depth-controls button:first-child{border-radius:4px 0 0 4px}.depth-controls button:last-child{border-radius:0 4px 4px 0}.depth-controls button[aria-pressed=true]{background:#075f58;color:#fff}.funnel-toolbar{position:sticky;top:0;background:#fff;z-index:2;border-bottom:1px solid #ccd4d8;padding-bottom:12px;justify-content:space-between}.update-status{display:flex;flex-wrap:wrap;gap:6px 20px;padding:6px 0;font-size:12px;color:#536267}summary:focus-visible,button:focus-visible{outline:2px solid #08776e;outline-offset:3px}@media(max-width:650px){.industry-companies{padding-left:4px}.industry-summary,.company-summary{gap:7px;flex-wrap:wrap}.industry-count{font-size:11px}.company-heading{flex-basis:60%}.company-signal{width:auto;max-width:100%;flex-basis:100%;text-align:left;padding-left:19px}.company-body{padding-left:16px}.funnel-toolbar{align-items:start}.industry-summary h2{font-size:16px}}
  </style></head><body><main><header class="top"><div><h1>私人猎头 · 机会研判</h1><p class="muted">行业 → 公司 → 岗位 · 薪资先筛，能力再排序</p></div><p><a href="decision-review.csv">CSV</a> · <a href="decision-review.md">Markdown</a> · <a href="decision-review.json">JSON</a></p></header>
  <div class="metrics"><span><b>${report.counts.observations}</b> 原始观察</span><span><b>${report.counts.company_names}</b> 公司/品牌名称</span><span><b>${report.counts.scored}</b> 已评分入口</span><span><b>${report.counts.range_eligible}</b> 区间覆盖20K</span><span><b>${report.counts.full_jd}</b> 职责与要求完整</span></div>
  <div class="update-status"><span><b>更新方式：</b>按请求执行，未启用定时扫描</span><span><b>最近取证（含检索）：</b>${e(displayTime(collection.latest_observation_at))}</span><span><b>报告生成：</b>${e(displayTime(report.generated_at))}</span></div>
  <div class="notice"><b>${e(deliveryLabel(report.delivery_acceptance))}。</b> 观察数包含跨渠道入口和复核记录，不是独立岗位数；读取成功不保证当前仍在招。${collection.added_observations?`已追加批次累计 ${collection.added_observations} 条观察，完整职责与要求 ${collection.added_full_jd} 条。`:'当前展示已有样本的重组。'}15–30K可入池，固定底薪另核。能力分不是面试概率。</div>
  <details class="policy research-info"><summary>评分口径、行业词库与后续采集</summary><details class="policy"><summary>能力框架、评分公式与分层待办</summary><p><b>JD细节 → 岗位使命/能力框架 → 个人证据 → 迁移桥梁 → 案例表达 → 真实缺口。</b></p><p>维度分＝Σ（子项分×子项权重）；总分＝Σ（维度分×维度权重）。同类完整100、同类部分80、强迁移60、部分迁移40、缺口0、未知0；未知权重另列。六项权重合计100%，因岗位主责而异。</p><p>行业内按薪资范围分池；池内默认能力分降序、同分比较招聘区间下界。可切换按区间下界排序。同公司相邻，入口不合并；行业依据不足的统一放入待核组。</p><p><b>公司分层：暂不执行。</b> 严格身份与样本证据已核 ${report.tier_todo.qualified_companies} 家；超过100家再提出候选标准并请你确认。${report.tier_todo.status==='ask_user_for_criteria'?'已达到讨论触发点，请确认是否开始讨论分层标准。':'目录名称和待核品牌不计入触发数。'}</p></details>
  <p><b>行业关键词：</b>${e(report.keywords.filter(k=>k.axis==='industry_and_value_chain'&&k.evidence.length).map(k=>k.term).join(' · '))} <a href="#keywords">查看十轴词库与出处</a></p><details class="policy" id="keywords"><summary>行业、趋势、公司、岗位等10类关键词与出处</summary><div class="keywords">${report.keyword_axes.map(axis=>`<section class="keyword"><h3>${e(axis.label)}</h3>${report.keywords.filter(k=>k.axis===axis.id).map(k=>`<details><summary><b>${e(k.term)}</b> · ${e(k.status)} · ${k.evidence.length}条观察命中</summary>${list(k.evidence.slice(0,4).map(v=>`${v.company}｜${v.source_field}｜${v.quote}｜${v.observed_at||'日期未知'}`))}<p>${k.evidence[0]?link(k.evidence[0].url,'首条来源'):'未找到样本命中，不视为已核政策或趋势'}</p></details>`).join('')}</section>`).join('')}</div></details>
  <details class="policy"><summary>下一波扩展与待办</summary>${list(report.next_queries.map(q=>`${q.query} · ${q.status} · ${q.reason}`))}<p>完整关键词出处及待分析清单见JSON；未执行的搜索不算采集成果。每批重点分析20条，不限制收集总量。</p></details>${collectionHTML(collection)}</details>
  <div class="toolbar"><input type="search" aria-label="搜索岗位" placeholder="行业、公司、岗位或正文"><select id="view" aria-label="机会视图"><option value="all">全部原始观察</option><option value="latest">最新采集批次</option><option value="pool">20K区间机会池</option><option value="scored">已评分入口</option><option value="pending">待评分岗位与线索</option></select><select id="sort" aria-label="排序"><option value="fit">薪资分池后按能力分</option><option value="salary">按招聘区间下界</option></select><label><input id="commercial" type="checkbox" checked>仅商业主线</label></div><div class="toolbar funnel-toolbar"><div class="depth-controls" role="group" aria-label="展开层级"><button type="button" data-depth="0" aria-pressed="false" title="收起所有行业和公司">收起全部</button><button type="button" data-depth="1" aria-pressed="true" title="展开所有行业，收起公司下的岗位">展开到公司</button><button type="button" data-depth="2" aria-pressed="false" title="展开所有行业和公司，JD全文仍按需查看">全部展开</button></div><span id="visible-count" aria-live="polite"></span></div><section id="companies">${groups}</section><p id="empty" hidden>没有符合当前条件的记录。</p></main>
  <script>
const search=document.querySelector('input[type=search]'),view=document.querySelector('#view'),sort=document.querySelector('#sort'),commercial=document.querySelector('#commercial'),groups=[...document.querySelectorAll('.company')],industries=[...document.querySelectorAll('.industry')],depthButtons=[...document.querySelectorAll('[data-depth]')];
let searchState=null;
const salaryValue=j=>j.dataset.salaryComparable==='true'?Number(j.dataset.salary):-1;
const poolValue=j=>Number(j.dataset.pool);
const fitCompare=(a,b)=>poolValue(b)-poolValue(a)||Number(b.dataset.score)-Number(a.dataset.score)||salaryValue(b)-salaryValue(a);
const groupCompare=(a,b)=>sort.value==='salary'?Number(b.dataset.sortSalary)-Number(a.dataset.sortSalary)||Number(b.dataset.sortScore)-Number(a.dataset.sortScore):Number(b.dataset.sortPool)-Number(a.dataset.sortPool)||Number(b.dataset.sortScore)-Number(a.dataset.sortScore)||Number(b.dataset.sortTieSalary)-Number(a.dataset.sortTieSalary);
function syncDepth(){
  const level=industries.every(i=>!i.open)&&groups.every(g=>!g.open)?0:industries.every(i=>i.open)&&groups.every(g=>!g.open)?1:industries.every(i=>i.open)&&groups.every(g=>g.open)?2:-1;
  for(const b of depthButtons)b.setAttribute('aria-pressed',String(Number(b.dataset.depth)===level));
}
for(const b of depthButtons)b.addEventListener('click',()=>{
  const depth=Number(b.dataset.depth);
  for(const i of industries)i.open=depth>0;
  for(const g of groups)g.open=depth>1;
  if(searchState)searchState=new Map([...industries,...groups].map(el=>[el,el.open]));
  syncDepth();
});
for(const el of [...industries,...groups])el.addEventListener('toggle',syncDepth);
function update(){
  let total=0;const query=search.value.trim().toLowerCase();
  if(query&&!searchState)searchState=new Map([...industries,...groups].map(el=>[el,el.open]));
  if(!query&&searchState){for(const [el,open] of searchState)el.open=open;searchState=null;}
  for(const g of groups){
    const rows=[...g.querySelectorAll('.job')];
    for(const j of rows){
      const show=(j.dataset.search+' '+g.closest('.industry').dataset.industry).toLowerCase().includes(query)&&(!commercial.checked||j.dataset.role==='true')&&(view.value==='all'||view.value==='latest'&&j.dataset.latest==='true'||view.value==='scored'&&Number(j.dataset.score)>=0||view.value==='pending'&&Number(j.dataset.score)<0||view.value==='pool'&&j.dataset.opportunity==='true');
      j.hidden=!show;if(show)total++;
    }
    rows.sort((a,b)=>sort.value==='salary'?salaryValue(b)-salaryValue(a)||fitCompare(a,b):fitCompare(a,b));
    for(const r of rows)g.querySelector('.jobs').append(r);
    const visible=rows.filter(j=>!j.hidden);
    g.hidden=visible.length===0;
    const best=visible.slice().sort(fitCompare)[0];
    g.dataset.sortSalary=visible.length?Math.max(...visible.map(salaryValue)):-1;
    g.dataset.sortPool=best?poolValue(best):-1;
    g.dataset.sortScore=best?Number(best.dataset.score):-1;
    g.dataset.sortTieSalary=best?salaryValue(best):-1;
    g.querySelector('.company-count').textContent=visible.length+'条观察';
    const salaryJob=visible.slice().sort((a,b)=>salaryValue(b)-salaryValue(a)).find(j=>salaryValue(j)>=0);
    const topScore=visible.length?Math.max(...visible.map(j=>Number(j.dataset.score))):-1;
    g.querySelector('.company-signal').textContent=(salaryJob?'招聘区间 '+salaryJob.querySelector('.salary strong').textContent:'薪资待确认')+' · '+(topScore>=0?'最高能力分 '+topScore:'待评分');
    if(query&&!g.hidden)g.open=true;
  }
  for(const industry of industries){
    const children=groups.filter(g=>g.closest('.industry')===industry).sort(groupCompare);
    for(const g of children)industry.querySelector('.industry-companies').append(g);
    const visible=children.filter(g=>!g.hidden);industry.hidden=!visible.length;
    industry.querySelector('.industry-count').textContent=visible.length+'家公司 / 品牌 · '+visible.reduce((n,g)=>n+g.querySelectorAll('.job:not([hidden])').length,0)+'条观察';
    for(const key of ['sortSalary','sortPool','sortScore','sortTieSalary'])industry.dataset[key]=visible[0]?.dataset[key]??'-1';
    if(query&&!industry.hidden)industry.open=true;
  }
  industries.sort((a,b)=>Number(a.dataset.industry==='行业待核')-Number(b.dataset.industry==='行业待核')||groupCompare(a,b));
  for(const i of industries)document.querySelector('#companies').append(i);
  document.querySelector('#visible-count').textContent=industries.filter(i=>!i.hidden).length+'个分组（含待核方向） · '+groups.filter(g=>!g.hidden).length+'家公司 / 品牌 · '+total+'条观察';document.querySelector('#empty').hidden=total!==0;syncDepth();
}
for(const x of [search,view,sort,commercial])x.addEventListener('input',update);
update();
</script></body></html>`;
}

export function displayCompanyKey(group,related) {
  return group.profile ? group.key : related ? related.entity_id
    : group.company ? `display-only:${group.company}` : group.key;
}

export async function writeDecisionReview({root=ROOT,outputDir=REPORT_DIR}={}) {
  const manifest=[];const rawCache=new Map();
  async function read(path,expected) {
    const full=resolve(root,path);if(!full.startsWith(resolve(root)+'/'))throw new Error('Input outside project');
    const body=await readFile(full,'utf8'); const sha256=digest(body);if(expected&&expected!==sha256)throw new Error(`Source hash changed: ${path}`);
    if(!manifest.some(x=>x.path===path))manifest.push({path,sha256});return body;
  }
  const json=async p=>JSON.parse(await read(p));
  const input=await json('careers/config/capability-review-input.json');
  const deliveryAcceptance=(await json('careers/progress.json')).business_acceptance??{status:'not_reviewed',breadth_status:'not_reviewed'};
  const [ops,archive,rubric,prefs,companyData,axes]=await (async()=>{
    const values=[];for(const p of [input.sources?.operations??OPERATIONS,input.sources?.coverage??COVERAGE,'careers/config/capability-rubric.json','careers/config/preferences.json','careers/config/company-facts.json','careers/config/keyword-axes.json'])values.push(await json(p));return values;
  })();
  let contextCurrent=Boolean(input.context_sources&&Object.keys(input.context_sources).length>=4);
  for(const [p,sha] of Object.entries(input.context_sources??{}))if(digest(await read(p))!==sha)contextCurrent=false;
  for(const fact of input.facts)if(!(await read(fact.path)).includes(fact.quote))throw new Error(`Personal quote not found: ${fact.id}`);
  const additions=[],collectionRuns=[];
  for(const source of input.sources?.additional??[]) {
    const jobs=await json(source.jobs);
    if(!Array.isArray(jobs))throw new Error('Additional collection must be a jobs array');
    for(const [i,job] of jobs.entries())additions.push({...job,dataset:'expansion',collection_batch:source.jobs,observation_key:`${source.jobs}#${i}`});
    if(source.run)collectionRuns.push({path:source.run,data:await json(source.run)});
  }
  const rows=[...ops.jobs.map(j=>({...j,dataset:'operations'})),...archive.map((j,i)=>({...j,dataset:'archive',observation_key:`coverage#${i}`})),...ops.leads.map((j,i)=>({...j,id:`lead-${i}`,dataset:'leads',observation_key:`operations-lead#${i}`,description_complete:false,observed_at:j.observed_at??ops.generated_at})),...additions];
  const latestBatch=additions.at(-1)?.collection_batch;
  for(const job of rows)job.latest_collection=Boolean(latestBatch&&job.collection_batch===latestBatch);
  for(const job of rows) {
    job.observation_key??=`operations#${job.id}`;
    if(job.evidence_file&&typeof job.evidence_file!=='string')throw new Error(`Evidence path must be a string: ${job.observation_key}`);
    if(job.evidence_file){if(!rawCache.has(job.evidence_file))rawCache.set(job.evidence_file,await read(job.evidence_file,job.evidence_sha256));const raw=rawCache.get(job.evidence_file);if(job.evidence_sha256&&digest(raw)!==job.evidence_sha256)throw new Error('Evidence hash mismatch');job.evidence_sha256=digest(raw);}
    for(const evidence of job.supporting_evidence??[])await read(evidence.file,evidence.sha256);
    job.salary_opportunity=salaryOpportunity(job,prefs.salary);job.role=classifyRole(job,prefs);
    const a=['operations','expansion'].includes(job.dataset)?input.assessments.find(a=>a.job_ids.includes(job.id)):null;
    if(a&&contextCurrent&&a.jd_hashes[a.job_ids.indexOf(job.id)]===jobHash(job)){
      job.assessment={...a,result:scoreCapabilities(a,job,input.facts,rubric),cache_key:capabilityCacheKey(job,input.facts,rubric,prefs),review_status:'main_thread_evidence_review_not_independent_semantic_approval'};
    }
    else if(a)job.assessment_status='stale_context_or_JD_reassessment_required';
  }
  const profiles=companyData.companies;
  for(const profile of profiles) {
    for(const f of profile.facts)if(f.file&&!(await read(f.file)).includes(f.quote))throw new Error('Company fact quote missing');
    profile.sample_job_count=rows.filter(j=>profile.job_ids.includes(j.id)&&j.description_complete).length;
    profile.sample_evidence_verified=profile.sample_job_count>0 && rows.filter(j=>profile.job_ids.includes(j.id)).every(j=>Boolean(j.evidence_sha256));
  }
  const exactGroups=groupCompanyEntrances(rows,profiles);
  // Co-locate uncertain same-display-name records without asserting identity or deleting contacts.
  const displayGroups=new Map();
  for(const g of exactGroups){const related=g.company?profiles.find(p=>p.name===g.company):null;const key=displayCompanyKey(g,related);
    if(!displayGroups.has(key))displayGroups.set(key,{...g,key,company:g.company||'公司待核',profile:g.profile??related,jobs:[]});
    for(const j of g.jobs)if(!g.profile)j.identity_note='仅按展示名称归组，不确认与本组法律主体一致；派遣/同名主体须单独复核';
    displayGroups.get(key).jobs.push(...g.jobs);
  }
  const groups=[...displayGroups.values()];
  const poolRank=j=>j.salary_opportunity.eligible?2:j.salary_opportunity.pending?1:0;
  const score=j=>j.assessment?.result.score??-1;
  for(const g of groups){g.jobs.sort((a,b)=>poolRank(b)-poolRank(a)||score(b)-score(a)||(b.salary_opportunity.parsed.salary_min??-1)-(a.salary_opportunity.parsed.salary_min??-1));g.max_score=Math.max(...g.jobs.map(score));g.max_salary=Math.max(...g.jobs.map(j=>j.salary_opportunity.parsed.salary_min??-1));g.pool=Math.max(...g.jobs.map(poolRank));}
  groups.sort((a,b)=>b.pool-a.pool||b.max_score-a.max_score||b.max_salary-a.max_salary||a.company.localeCompare(b.company,'zh-CN'));
  const keywords=keywordInventory(rows,axes.axes,profiles);
  const next_queries=[['跨境营销 销售运营','钛动经营JD与公司自述延展'],['大模型 商业化 生态','月之暗面已取JD的业务主线'],['汽车 行业运营 大客户','字节汽车JD与个人行业直接证据'],['SaaS 营收运营 Revenue Operations','GEO岗位的流程/指标相邻方向'],['企业服务 销售管理 PDCA','经营机制而非仅按岗位名称召回'],['智能硬件 AI BD','MiniMax行业场景延展，技术门槛仍须检查']].map(([query,reason])=>({query,reason,status:'待执行，不是已搜索结果'}));
  const observedTimes=rows.map(j=>j.observed_at).filter(x=>x&&Number.isFinite(Date.parse(x))).sort((a,b)=>Date.parse(a)-Date.parse(b));
  const report={schema_version:2,generated_at:new Date().toISOString(),scope:'Offline report generation from traceable historical and explicitly appended collection batches; not full-market coverage or a live hiring guarantee',execution:input.execution,review_status:'main_thread_review_not_independent_semantic_approval',rubric,preferences:prefs,source_manifest:manifest,
    delivery_acceptance:deliveryAcceptance,
    collection:{mode:'on_request',scheduler_enabled:false,earliest_observation_at:observedTimes[0]??null,latest_observation_at:observedTimes.at(-1)??null,added_observations:additions.length,added_full_jd:additions.filter(j=>j.description_complete).length,runs:collectionRuns},
    counts:{observations:rows.length,company_names:new Set(rows.map(j=>j.company).filter(Boolean)).size,company_unknown:rows.filter(j=>!j.company).length,scored:rows.filter(j=>j.assessment).length,full_jd:rows.filter(j=>j.description_complete).length,range_eligible:rows.filter(j=>j.salary_opportunity.eligible).length,fixed_base_confirmed:rows.filter(j=>j.salary_opportunity.fixed_base.eligible).length},
    tier_todo:companyTierTodo(profiles,rubric.company_tiers.trigger_more_than),keyword_axes:axes.axes,keywords,next_queries,groups,
    industries:groupIndustries(groups).map(g=>({label:g.label,company_keys:g.groups.map(c=>c.key),source_labels:g.source_labels,classification_status:'display_group_from_existing_industry_fields_not_company_identity_verification'})),
    next_analysis_queue:rows.filter(j=>j.role.eligible&&!j.assessment).sort((a,b)=>poolRank(b)-poolRank(a)).slice(0,20).map(j=>({observation_key:j.observation_key,company:j.company,title:j.title,next:j.description_complete?'JD复核及能力拆解':'先取得并核对完整JD'})),external_actions:0};
  await mkdir(outputDir,{recursive:true});
  let html=renderDecisionReview(report);
  for(const g of groups)html=html.replace(`data-group="${e(g.key)}"`,`data-group="${e(g.key)}" data-score="${g.max_score}" data-salary="${g.max_salary}" data-pool="${g.pool}"`);
  const md=['# 私人猎头机会研判','',deliveryLabel(report.delivery_acceptance),'',report.scope,'','薪资区间上界≥20K进入机会池，固定底薪单独待核。历史样本，不保证当前在招。','',`原始观察 ${rows.length}；已评分入口 ${report.counts.scored}。公司层级暂缓，严格已核样本 ${report.tier_todo.qualified_companies}，超过100家再讨论。`, '', ...groups.flatMap(g=>[`## ${g.company}`,g.profile?.attention||'公司背景待补',...(g.profile?.facts??[]).map(f=>`- ${f.label}：${f.value}（${factStatus[f.status]||f.status}；${f.observed_at}；${f.file||f.source||'来源待核'}）`),...g.jobs.flatMap(j=>[`### ${j.title}`,`- 薪资：${j.salary_raw||'未披露'}；区间机会：${j.salary_opportunity.eligible?'是':j.salary_opportunity.pending?'待核':'否'}；固定底薪：${j.salary_opportunity.fixed_base.eligible?'已明确披露≥20K':'待核'}`,`- 地点：${j.city||j.location||'未取得'}；入口：${j.channel||j.source_kind||'待核'}；联系人：${j.hr_display_name||'未取得'}`,`- 职位：${j.job_url||'无直链'}；申请：${j.apply_url||'无指定入口'}；来源：${j.source_url||j.job_url||'未取得'}`,`- 观察日期：${j.observed_at||'未取得'}；证据：${j.evidence_file||'未取得'}`,j.assessment?`- 能力证据分：${j.assessment.result.score}。岗位本质：${j.assessment.mission}\n${j.assessment.result.dimensions.map(d=>`- ${d.label}：${d.score}分 × ${d.weight}% = ${d.contribution.toFixed(1)}`).join('\n')}\n- 案例表达：${j.assessment.translation.example}\n- 边界：${j.assessment.translation.boundary}\n- 补强：${j.assessment.translation.proof_needed}`:'- 未评分',`\n职责：\n${j.description||'未取得'}\n\n要求：\n${j.requirements||'未取得'}\n`])]),'## 关键词轴',...axes.axes.map(a=>`- ${a.label}：${a.terms.join('、')}（命中状态及原文见JSON/HTML，不全是已核市场词）`)].join('\n');
  const cols=['observation_key','company','title','channel','source_kind','salary_raw','city','job_url','source_url','apply_url','observed_at','published_at','page_date_raw','recruitment_period_raw','current_opportunity_status','attention','salary_period_note','description','requirements','additional_requirements','description_summary','description_complete','search_excerpt','evidence_file','evidence_sha256','match_score','range_eligible','fixed_base_confirmed','company_legal_name','company_industry','company_facts','company_attention','hard_gate_status','weighted_dimensions','case_translation','translation_boundary'];
  const csv='\uFEFF'+[cols,...groups.flatMap(g=>g.jobs).map(j=>cols.map(c=>({...j,match_score:j.assessment?.result.score??null,range_eligible:j.salary_opportunity.eligible,fixed_base_confirmed:j.salary_opportunity.fixed_base.eligible,company_legal_name:profiles.find(p=>p.job_ids.includes(j.id))?.legal_name,company_industry:profiles.find(p=>p.job_ids.includes(j.id))?.industry,company_facts:JSON.stringify(profiles.find(p=>p.job_ids.includes(j.id))?.facts??[]),company_attention:profiles.find(p=>p.job_ids.includes(j.id))?.attention,hard_gate_status:j.assessment?.result.hard_gate_status,weighted_dimensions:JSON.stringify(j.assessment?.result.dimensions??[]),case_translation:j.assessment?.translation.example,translation_boundary:j.assessment?.translation.boundary})[c]))].map(r=>r.map(csvCell).join(',')).join('\r\n');
  const supplements=rows.filter(j=>j.current_opportunity_status||j.additional_requirements||j.source_section_mislabeled||j.description_summary||j.page_date_raw||j.published_at||j.salary_period_note)
    .flatMap(j=>[`### ${j.company||'公司待核'} | ${j.title}`,`- 记录：${j.observation_key}`,`- 来源：${j.source_url||j.job_url||'未取得'}`,
      j.attention?`- 注意：${j.attention}`:'',j.published_at?`- 来源标注发布时间：${j.published_at}`:'',j.page_date_raw?`- 页面日期原文（不等于发布时间）：${j.page_date_raw}`:'',
      j.recruitment_period_raw?`- 招聘期间：${j.recruitment_period_raw}`:'',j.salary_period_note?`- 薪资口径：${j.salary_period_note}`:'',
      j.additional_requirements?`补充要求原文：\n${j.additional_requirements}`:'',j.description_summary?`已取得摘要（非完整JD）：\n${j.description_summary}`:'',
      j.source_section_mislabeled?`源栏目异常：\n${j.source_section_mislabeled.content}\n${j.source_section_mislabeled.interpretation}`:'']).filter(Boolean).join('\n');
  for(const [ext,body] of [['json',JSON.stringify(report,null,2)],['html',html],['md',md+'\n\n## 来源日期、异常与补充原文\n\n'+supplements],['csv',csv]])await writeFile(join(outputDir,`decision-review.${ext}`),body);
  return {report:join(outputDir,'decision-review.html'),counts:report.counts,tier_todo:report.tier_todo,new_network_requests:0};
}
