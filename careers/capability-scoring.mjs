import { createHash } from 'node:crypto';

export const digest = (value) => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const required = (value, label) => { if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing ${label}`); };
const sum100 = (values) => values.length && values.every((x) => Number.isFinite(x) && x > 0) && Math.abs(values.reduce((a,b) => a+b,0)-100) < 1e-8;

export function capabilityCacheKey(job, facts, rubric, preferences) {
  return digest({ job: { id:job.id, title:job.title, description:job.description, requirements:job.requirements,
    salary_raw:job.salary_raw, experience:job.experience, education:job.education, description_complete:job.description_complete }, facts, rubric, preferences });
}

// The model supplies evidence-bound judgements; arithmetic and guardrails are deterministic.
export function scoreCapabilities(assessment, job, facts, rubric) {
  if (!job.description_complete || !job.description?.trim() || !job.requirements?.trim()) throw new Error('Incomplete JD cannot receive a score');
  required(assessment.mission, 'role mission');
  required(assessment.weight_reason, 'JD-based weight reasoning');
  const weights = assessment.dimension_weights ?? rubric.profiles[assessment.profile];
  if (!weights || weights.length !== rubric.dimensions.length || !sum100(weights)) throw new Error('Dimension weights must sum to 100');
  if (assessment.dimensions?.length !== rubric.dimensions.length) throw new Error('All dimensions must be reviewed');
  const jd = `${job.description}\n${job.requirements}\n${job.experience ?? ''}\n${job.education ?? ''}`;
  const factsMap = new Map(facts.map((f) => [f.id,f]));
  const dimensions = rubric.dimensions.map((definition,i) => {
    const dim = assessment.dimensions[i];
    if (dim.id !== definition.id || !sum100((dim.criteria??[]).map((c) => c.weight))) throw new Error('Subcriterion weights must sum to 100 in each ordered dimension');
    const criteria = dim.criteria.map((c) => {
      required(c.capability,'inferred capability'); required(c.jd_quote,'JD quote'); required(c.reason,'evidence reasoning');
      if (!jd.includes(c.jd_quote)) throw new Error(`JD quote not found: ${c.jd_quote}`);
      const anchor = rubric.anchors[c.anchor];
      if (!anchor) throw new Error('Unknown evidence anchor');
      if (!Array.isArray(c.fact_ids) || (['direct','transferable'].includes(anchor.kind) && !c.fact_ids.length)) throw new Error('Personal evidence required');
      if (c.fact_ids.some((id) => !factsMap.has(id))) throw new Error('Unknown personal fact');
      return {...c,score:anchor.score,evidence_kind:anchor.kind,facts:c.fact_ids.map((id)=>factsMap.get(id))};
    });
    const score = criteria.reduce((n,c)=>n+c.score*c.weight/100,0);
    return {...definition,weight:weights[i],score,contribution:score*weights[i]/100,criteria};
  });
  if (!Array.isArray(assessment.hard_gates) || !assessment.hard_gate_review_complete) throw new Error('Hard gate review required');
  for(const g of assessment.hard_gates) {
    if (!['met','unmet','unknown'].includes(g.status) || !jd.includes(g.jd_quote) || !g.reason) throw new Error('Invalid hard gate evidence');
    if (g.status === 'met' && (!g.fact_ids?.length || g.fact_ids.some(id=>!factsMap.has(id)))) throw new Error('Met gate requires personal facts');
  }
  const explicitGates=[job.education,job.experience,...String(job.requirements).matchAll(/本科|硕士|博士|\d+\s*年以上[^，；。\n]{0,60}(?:经验|经历)/g)].map(x=>Array.isArray(x)?x[0]:x).filter(x=>x&&!/未披露|未知|不限/.test(x));
  const comparable=x=>x.normalize('NFKC').replace(/\s/g,'');
  if(explicitGates.some(quote=>!assessment.hard_gates.some(g=>comparable(g.jd_quote).includes(comparable(quote))))) throw new Error('Explicit education or experience gate omitted');
  const score = Math.round(dimensions.reduce((n,d)=>n+d.contribution,0)*10)/10;
  const unknownWeight = dimensions.reduce((n,d)=>n+d.weight*d.criteria.filter(c=>c.evidence_kind==='unknown').reduce((s,c)=>s+c.weight,0)/100,0);
  return {score,dimensions,unknown_weight:unknownWeight,hard_gate_status:assessment.hard_gates.some(g=>g.status==='unmet')?'unmet':assessment.hard_gates.some(g=>g.status==='unknown')?'unknown':'met',
    resume_reuse_eligible:false,score_semantics:rubric.score_semantics};
}

export function companyTierTodo(companies, threshold=100) {
  const ids=new Set(companies.filter(c=>c.identity_reviewed===true && c.sample_evidence_verified===true && c.sample_job_count>0).map(c=>c.entity_id).filter(Boolean));
  return {status:ids.size>threshold?'ask_user_for_criteria':'deferred',qualified_companies:ids.size,trigger_more_than:threshold,auto_classify:false};
}

export function groupCompanyEntrances(jobs, profiles=[]) {
  const groups=new Map();
  for(const job of jobs) {
    const profile=profiles.find(p=>p.job_ids?.includes(job.id));
    // A display name alone is not a verified legal identity. Keep uncertain records apart.
    const key=profile?.entity_id ?? (job.company_identity?.verified && job.company_identity?.id ? job.company_identity.id : `unverified:${job.channel??job.source_kind??''}:${job.source_url??job.job_url??job.id}:${job.company}`);
    if(!groups.has(key)) groups.set(key,{key,company:profile?.name??job.company,profile, jobs:[]});
    groups.get(key).jobs.push(job);
  }
  return [...groups.values()];
}
