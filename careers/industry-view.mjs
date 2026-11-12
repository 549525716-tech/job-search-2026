import { createHash } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { sep } from 'node:path';
import { DATA_DIR, evidenceAbsolute } from './paths.mjs';

const TIERS = ['leader', 'established', 'emerging', 'unverified'];
const TIER_LABELS = { leader: '行业大厂', established: '行业中厂', emerging: '行业小厂', unverified: '地位待核' };
const MAX_EVIDENCE_AGE_MS = 18 * 31 * 24 * 60 * 60 * 1000;

const text = (value, fallback = '') => String(value ?? '').trim() || fallback;

function verifiedProof(evidence) {
  try {
    const url = new URL(evidence.source_url);
    if (url.protocol !== 'https:' || url.username || url.password) return false;
    const path = realpathSync(evidenceAbsolute(evidence.body_path));
    if (!path.startsWith(realpathSync(DATA_DIR) + sep)) return false;
    const metaPath = realpathSync(evidenceAbsolute(evidence.metadata_path));
    if (!metaPath.startsWith(realpathSync(DATA_DIR) + sep)) return false;
    const receipt = JSON.parse(readFileSync(metaPath, 'utf8'));
    const bytes = readFileSync(path);
    return receipt.url === evidence.source_url && receipt.body_path === evidence.body_path
      && receipt.sha256 === evidence.content_sha256 && receipt.status === 200 && receipt.complete === true
      && createHash('sha256').update(bytes).digest('hex') === evidence.content_sha256
      && bytes.toString('utf8').includes(evidence.verbatim_quote);
  } catch { return false; }
}

function evidenceIsCurrent(evidence, asOf, now) {
  const dates = [...(evidence ?? []).flatMap((item) => [item.metric_period, item.published_at, item.observed_at]), asOf].filter(Boolean);
  return dates.length > 0 && dates.every((value) => {
    const time = Date.parse(value);
    return Number.isFinite(time) && time <= now && now - time <= MAX_EVIDENCE_AGE_MS;
  });
}

function validClassification(input, now = Date.now()) {
  const tier = input?.tier;
  const evidence = Array.isArray(input?.evidence) ? input.evidence : [];
  const proofFields = ['source_url', 'publisher', 'original_publisher', 'source_kind', 'verbatim_quote', 'content_sha256',
    'body_path', 'metadata_path', 'published_at', 'observed_at', 'metric_period', 'metric_definition', 'geographic_market', 'segment_definition', 'coverage_and_method'];
  const proven = evidence.filter((item) => proofFields.every((field) => typeof item[field] === 'string' && item[field].trim())
    && item.geographic_market === input.geographic_market && item.segment_definition === input.segment
    && !item.conflicts?.length && verifiedProof(item));
  const publishers = new Set(proven.map((item) => item.original_publisher.trim().toLowerCase()));
  const origins = new Set(proven.map((item) => new URL(item.source_url).hostname.toLowerCase().replace(/^www\./, '')));
  const comparativeKind = { leader: 'independent_leading_cohort', established: 'comparative_mid_cohort', emerging: 'comparative_early_or_limited_footprint' }[tier];
  const businessKind = { leader: 'commercial_delivery', established: 'repeatable_paid_delivery', emerging: 'current_business_stage' }[tier];
  const hasComparative = proven.some((item) => item.evidence_role === comparativeKind && item.independent === true);
  const hasBusiness = proven.some((item) => item.evidence_role === businessKind);
  const reviewedAt = Date.parse(input?.reviewed_at);
  const reviewCurrent = Number.isFinite(reviewedAt) && reviewedAt <= now && now - reviewedAt <= 90 * 86400000;
  const reviewer = input?.review_execution;
  const valid = TIERS.includes(tier) && tier !== 'unverified' && input?.assessment_status === 'supported'
    && Boolean(input.version && input.industry && input.segment && input.geographic_market && input.as_of_period)
    && publishers.size >= 2 && origins.size >= 2 && proven.length === evidence.length
    && hasComparative && hasBusiness && !input.conflicts?.length && reviewCurrent
    && reviewer?.model === 'gpt-6-astra' && reviewer.reasoning_effort === 'max' && Boolean(reviewer.agent_id)
    && evidenceIsCurrent(proven, input.as_of_period, now);
  return { ...input, tier: valid ? tier : 'unverified', tier_label: TIER_LABELS[valid ? tier : 'unverified'], verified: valid,
    validation_reason: valid ? '已满足版本、口径、独立来源、商业证据与时效要求' : '分类证据不足、过期、冲突未解或未通过独立来源校验' };
}

export function normalizeIndustryClassification(input, options = {}) {
  return validClassification(input ?? {}, options.now ?? Date.now());
}

export function getIndustryAnnotation(job, company = {}, classifications = [], options = {}) {
  const matches = classifications.filter((item) => item && job.company_id && (item.company_id === job.company_id || item.employer_entity_id === job.company_id)
    && (!item.business_line_id || item.business_line_id === job.business_line_id));
  const classification = matches.length === 1 ? normalizeIndustryClassification(matches[0], options) : null;
  const industry = text(classification?.industry || job.industry || company.industry || company.sector, '行业待核');
  const segment = text(classification?.segment || job.segment || company.segment || company.sector, '赛道待核');
  const businessLine = text(job.business_line || job.business_line_name || job.department || company.business_line, '业务线待核');
  return { industry, segment, tier: classification?.tier ?? 'unverified', tier_label: classification?.tier_label ?? TIER_LABELS.unverified,
    tier_verified: Boolean(classification?.verified), business_line: businessLine,
    classification_version: classification?.version ?? null, classification_as_of: classification?.as_of_period ?? null,
    classification_evidence: classification?.evidence ?? [], classification_validation_reason: classification?.validation_reason ?? '暂无已核分类输入' };
}

export function groupJobsByIndustry(jobs = []) {
  const groups = new Map();
  for (const job of jobs) {
    const industry = text(job.industry, '行业待核');
    const segment = text(job.segment, '赛道待核');
    const tier = text(job.tier, 'unverified');
    const companyName = text(job.company_name || job.company);
    // Presentation grouping never upgrades an employer identity or merges vacancies.
    const fallback = companyName && job.source_url
      ? `unverified-source:${job.source_url}:${companyName}`
      : `unverified-observation:${text(job.job_key || job.id)}`;
    const companyId = text(job.company_id, fallback);
    const businessLine = text(job.business_line, '业务线待核');
    const key = [industry, segment, tier, companyId, businessLine].join('\u001f');
    if (!groups.has(key)) groups.set(key, { key, industry, segment, tier, tier_label: text(job.tier_label, TIER_LABELS[tier] ?? TIER_LABELS.unverified), company_id: job.company_id,
      company_name: companyName || '公司未披露', business_line: businessLine, jobs: [] });
    groups.get(key).jobs.push(job);
  }
  return [...groups.values()].sort((a, b) => a.industry.localeCompare(b.industry) || a.segment.localeCompare(b.segment)
    || a.tier.localeCompare(b.tier) || a.company_name.localeCompare(b.company_name) || a.business_line.localeCompare(b.business_line));
}

export const industryTierLabels = Object.freeze({ ...TIER_LABELS });
