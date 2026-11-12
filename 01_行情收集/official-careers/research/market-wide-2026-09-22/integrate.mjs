import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve } from 'node:path';
import { createHash } from 'node:crypto';

const dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(dir, '../../../..');
const read = path => readFile(path, 'utf8').then(JSON.parse);
const save = (path, data) => writeFile(path, JSON.stringify(data, null, 2) + '\n');
const jobs = await read(join(dir, 'jobs.json'));
const definitions = await read(join(dir, 'company-enrichment.json'));
const companyPath = join(root, 'careers/config/company-facts.json');
const companyData = await read(companyPath);
for (const d of definitions) {
  const file = join(dir, 'raw', d.capture + '.json');
  const bytes = await readFile(file, 'utf8');
  const raw = JSON.parse(bytes);
  for (const f of d.facts) if (!bytes.includes(f.quote)) throw new Error(`COMPANY_QUOTE_MISSING:${d.id}:${f.label}`);
  if (d.legal_name && !String(raw.result).includes(d.legal_name)) throw new Error(`LEGAL_DISPLAY_MISSING:${d.id}`);
  const profile = {
    entity_id: `market-wide-display-${d.id}`, name: d.display, legal_name: d.legal_name,
    job_ids: jobs.filter(j => j.company === d.source_company).map(j => j.id),
    identity_reviewed: false,
    identity_note: '按同站品牌、招聘页或平台展示归组；未独立核验法律雇主，不合并跨平台联系人。',
    industry: d.industry, industry_basis: '页面业务自述或JD场景分类，不是第三方行业排名',
    facts: d.facts.map(f => ({ ...f, file: relative(root, file),
      source_url: raw.request.open?.[0]?.ref_id ?? null,
      evidence_sha256: createHash('sha256').update(bytes).digest('hex'), observed_at: raw.observed_at })),
    attention: '业务/人数/融资按注明来源展示，不证明行业地位或最终合同主体；未披露字段保持未知。薪资与当前HC需另核。'
  };
  const index = companyData.companies.findIndex(p => p.entity_id === profile.entity_id);
  if (index >= 0) companyData.companies[index] = profile; else companyData.companies.push(profile);
}
companyData.version = '2026-09-22-market-wide-company-facts-v1';
const inputPath = join(root, 'careers/config/capability-review-input.json');
const input = await read(inputPath);
const source = { jobs: relative(root, join(dir, 'report-jobs.json')), run: relative(root, join(dir, 'report-run.json')) };
input.sources.additional ??= [];
const sourceIndex = input.sources.additional.findIndex(s => s.run === source.run);
if (sourceIndex >= 0) input.sources.additional[sourceIndex] = source;
else input.sources.additional.push(source);
input.version = '2026-09-22-market-wide-review-v1';
// Store prepared values only after every source quote has passed validation.
await save(companyPath, companyData);
await save(inputPath, input);
console.log(JSON.stringify({ company_profiles: definitions.length, collection_input: source, applications: 0 }));
