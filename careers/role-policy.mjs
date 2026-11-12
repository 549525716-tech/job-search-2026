export const ROLE_POLICY_VERSION = '2026-09-22-commercial-v10';
// Bind negation to a commercial duty in the same clause, not unrelated travel or equipment requirements.
const NEGATED_DUTY = /(?:不负责|不涉及|不承担|不参与|不包含|无需|无须)[^，,。；;\n]{0,40}(?:市场|营销|客户|商户|企业用户|销售|商业|商务|渠道|获客|增长|转化|续费|营收|收入|签约|成交|合同|回款|商机|合作伙伴|经营)|不以[^，,。；;\n]*(?:市场|营销|客户|商户|销售|商业|收入|增长)[^，,。；;\n]*为(?:目标|职责)|(?:not responsible for|no responsibility for)[^,.;\n]{0,80}(?:market|sales|customer|client|revenue|commercial|business|pipeline|partnership|contract|growth|renewal)/i;
function hasNegatedDuty(line) {
  // Optional qualifications do not negate the job's commercial responsibilities.
  const duties = line.replace(/(?:无需|无须)(?!负责|承担|参与|开展|完成|管理|执行)[^，,。；;\n]*(?:经验|经历|背景|资历|证书|学历|资格)[^，,。；;\n]*/g, '');
  return NEGATED_DUTY.test(duties);
}

export function commercialBodySignals(job = {}) {
  const body = [...new Set([job.description_text, job.description, job.responsibilities].filter((value) => typeof value === 'string' && value.trim()))].join('\n');
  const dimensions = [
    ['客户经营', /企业客户|企业用户|大客户|商户|客户分层|客户经营|客户关系|客户需求|enterprise (?:clients|customers)|key accounts|customer (?:needs|relationships|value)/i],
    ['交易推进', /(?<!券)商机|商务谈判|合同谈判|签约|成交|渠道招募|商务合作|合作伙伴|pipeline|negotiat|close deals|partnerships/i],
    ['商业结果', /收入目标|销售收入|营收|续约|续费|增购|回款|商业化|revenue|quota|renewals?|upsell|monetiz/i],
    ['经营管理', /客户分层|经营复盘|区域资源|经营目标|经营策略|商业化指标|销售团队|市场拓展|sales team|go.to.market|commercial (?:strategy|operations)/i],
  ];
  return dimensions.flatMap(([dimension, pattern]) => {
    const quote = body.split(/[。；;\n]/).find((line) => pattern.test(line) && !hasNegatedDuty(line));
    return quote ? [{ dimension, quote: quote.trim() }] : [];
  });
}

export function classifyRole(job = {}, preferences = {}) {
  const title = String(job.title ?? '');
  const jd = [job.description_text, job.description, job.responsibilities].filter((value) => typeof value === 'string').join('\n');
  const result = (tier, category, reason) => ({ eligible: ['primary', 'adjacent'].includes(tier)
    || (tier === 'exploratory' && preferences.role_policy?.include_exploratory === true), tier, category, reason,
    collection_eligible: true, review_required: tier === 'review' });
  if (['closed', 'missing_pending_review'].includes(job.hiring_active)) return result('excluded', '招聘状态异常', '已关闭或连续未观察到的岗位不进入当前推荐。');
  if (/客户成功|customer success/i.test(title) && preferences.role_policy?.excluded?.some(x=>/客户成功|customer success/i.test(x))) return result('excluded','客户成功','用户明确排除客户成功主岗，原始记录保留。');
  if (/实习|校招|应届|\bintern(?:ship)?\b|\bcampus\b/i.test(`${title} ${job.employment_type ?? ''}`)) return result('excluded', '实习校招', '不符合当前有经验商业岗位方向。');
  if (/产品(?:高级|资深|高级资深)?经理|产品负责人|产品总监|\b(?:product|growth product|AI product)\s+(?:manager|owner|lead|director)\b/i.test(title)) return result('excluded', '产品经理', '用户明确排除产品经理主线；保留原始记录，不继续用JD反推适合。');
  if (/算法|研发|前端|后端|软件工程|数据工程|机器学习工程|software engineer|research scientist|machine learning engineer|backend|frontend/i.test(title)
    && !/售前|销售工程师|技术销售|sales engineer|solutions? (?:consultant|architect)/i.test(title)) return result('excluded', '技术研发主线', '原始岗位保留；研发职责不能因营销业务域或销售协作就视为商业岗位。');
  if (/FDE|forward.deployed|项目经理|实施工程|交付工程|产品运营|developer (?:relations|advocate)/i.test(title)) return result('exploratory', '技术或交付探索', '不是默认市场销售运营主线，需另行确认职责及技术门槛。');
  if (/销售运营|销售管理|商业化运营|商业运营|业务运营|sales operations|revenue operations|business operations/i.test(title)) return result('primary', '销售及商业化运营', '以经营规则、指标、资源协同和商业结果为核心；管理权限仍须单独核验。');
  if (/市场|营销|社媒运营|活动策划|推广经理|marketing|public relations|\bSEO\b|\bGTM\b/i.test(title)) return result('primary', '市场营销', '市场、需求获取或商业增长方向；品牌/传播专项经验不能自动视为已有。');
  if (/售前|解决方案|presales|pre.sales|solution[s]? (?:consultant|architect)|sales engineer|销售工程师|技术销售/i.test(title)) return result('adjacent', '业务型售前及解决方案', '可结合行业诊断与客户方案经验探索，Demo/POC等技术要求单独核查。');
  if (/客户成功|客户运营|customer success/i.test(title)) return result('adjacent', '客户成功与客户经营', '长期客户经营相关，续费/交付与收入稳定性需要实证。');
  if (/商务|生态|渠道|合作伙伴|战略合作|商业合作|partnership|business builder|business development|\bBD\b/i.test(title)) return result('primary', '商务生态渠道', '商业合作、渠道或生态增长方向，不以岗位名称推定团队管理权。');
  if (/销售|电销|大客户|客户经理|商业化|account executive|account manager|\bKA\b|regional general manager|country manager|\bsales\s+(?:manager|director|executive|representative|lead|specialist|consultant|supervisor)\b|\b(?:head|vp|vice president|director)\s+(?:of\s+)?sales\b/i.test(title)) return result('primary', '销售与大客户', '客户拓展、经营与商业化主线，需区分一线配额岗与实际带队岗。');
  if (/城市经理|区域经理/.test(title) && jd.split(/[。；;\n]/).some((line) => /销售团队|销售目标/.test(line) && !hasNegatedDuty(line))) return result('primary', '区域商业经营', '正文明确区域销售团队或销售目标，保留核查管理年限、实际权限及薪资构成。');
  if (/运营(?:总监|负责人|主管|专员)/.test(title) && jd.split(/[。；;\n]/).some(line =>
    /市场|营销|客户|商户/.test(line) && /增长|获客|转化|续费|品牌|社群|内容/.test(line)
    && !hasNegatedDuty(line))) return result('primary', '销售及商业化运营', '运营标题与正文的市场/客户经营动作共同确认商业主线，不代表候选人已满足经验或管理门槛。');
  if (/增长|运营经理|运营专家|行业运营|growth/i.test(title) && jd.split(/[。；;\n]/).some(line => /客户|商户|销售|商业|市场|营销|revenue|commercial|customer/i.test(line) && !hasNegatedDuty(line))) return result('primary', '销售及商业化运营', '标题与JD都出现商业客户经营证据，保留进一步核查。');
  const signals = commercialBodySignals(job);
  if (signals.length >= 2 && signals.some((signal) => ['交易推进', '商业结果'].includes(signal.dimension))) {
    return { ...result('review', '正文商业职责待复核', '标题不在已知词表，但正文具有多维商业职责信号；进入复核，不等于推荐或已满足门槛。'), body_signals: signals };
  }
  return result('excluded', '非当前主线', '未找到市场、销售、商务或商业运营的明确岗位职责信号。');
}
