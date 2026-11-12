import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join, relative, resolve } from 'node:path';
import { captureLines, captureRange } from '../market-2026-09-21/build.mjs';

const DIR = fileURLToPath(new URL('.', import.meta.url));
const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const sha = value => createHash('sha256').update(value).digest('hex');
const rel = path => relative(ROOT, path);
const json = value => JSON.stringify(value, null, 2) + '\n';

export async function build(adapterManifestPath) {
  adapterManifestPath ??= JSON.parse(await readFile(join(DIR,'adapter-input.json'),'utf8')).manifest;
  const jobs = [], captures = new Map(), sourceResults = [];
  for (const id of ['q01', 'q02', 'o01', 'o02', 'o03', 'o04', 'o05', 'o06']) {
    const path = join(DIR, 'raw', id + '.json'), bytes = await readFile(path);
    const raw = JSON.parse(bytes);
    captures.set(id, { raw, lines: captureLines(raw.result), evidence_file: rel(path), evidence_sha256: sha(bytes) });
  }
  function make(id, spec) {
    const source = captures.get(id);
    const get = range => captureRange(source.lines, range);
    const fields = Object.fromEntries(Object.entries(spec.ranges).map(([field, range]) => [field, {
      evidence_file: source.evidence_file, evidence_sha256: source.evidence_sha256,
      line_range: range, quote: get(range)
    }]));
    const result = {
      id: `fallback-2026-09-22:${id}:l${spec.ranges.title[0]}`, native_id: null,
      company: source.raw.company, company_identity_status: 'source_self_description_not_independent_registry_verification',
      title: get(spec.ranges.title).replace(/^#+\s*/, ''),
      city: null, location: null, salary_raw: null, job_url: null, apply_url: null,
      source_url: source.raw.request.open[0].ref_id,
      description: get(spec.ranges.description), requirements: get(spec.ranges.requirements),
      description_complete: true, source_kind: 'official_careers_page', channel: '公司招聘页',
      source_status: 'full_visible_sections_not_company_wide_scan',
      observed_at: source.raw.observed_at, time_note: '工具本次读取时间，不是发布日期；工具缓存新鲜度及实际在招待核。',
      evidence_file: source.evidence_file, evidence_sha256: source.evidence_sha256,
      field_evidence: fields, source_locator: { kind: 'page_line_range', from: spec.ranges.title[0] },
      salary_fixed_base_confirmed: false, hiring_active: 'unknown',
      ...spec.fields
    };
    if (!result.description || !result.requirements) throw new Error('Incomplete JD cannot enter complete batch');
    jobs.push(result);
  }
  make('o01', { ranges: {title:[14,14],metadata:[16,16],description:[20,20],requirements:[23,23]}, fields: {
    native_id: '219504', company:'京东', city:'北京', location:'北京市', industry:'AI企业应用',
    job_url:'https://zhaopin.jd.com/web/job-info-detail?requementId=219504',
    published_at:'2026-06-22', published_at_semantics:'官网发布时间',
    attention:'薪资未披露；至少1年SaaS/AI/大数据销售或解决方案经验、3年以上ToB要求须核查。'
  }});
  function extractBoard(id, max, industry, contact) {
    const source = captures.get(id), lines = source.lines;
    const starts = [...lines].filter(([n, text]) => n <= max && /^### /.test(text)).map(([n])=>n);
    for (const [index, start] of starts.entries()) {
      const end = (starts[index+1] ?? max+1)-1;
      const section = [...lines].filter(([n]) => n>=start && n<=end);
      const responsibilities = section.find(([,text])=>/^#### (岗位职责|工作内容)$/.test(text))?.[0];
      const requirements = section.find(([,text])=>/^#### 任职要求$/.test(text))?.[0];
      if (responsibilities == null || requirements == null) continue;
      const endOf = header => (section.find(([n,text])=>n>header && (/^#### /.test(text)||/^(投递简历：|立即投递)/.test(text)))?.[0] ?? end+1)-1;
      const metadata = section.find(([n,text])=>n>start && text.trim())?.[0];
      const text = lines.get(metadata);
      const salary = text.match(/\d+K-\d+K·\d+薪(?: \+ 提成)?/)?.[0] ?? text.match(/面谈|面议/)?.[0] ?? null;
      const city = id==='o04' ? '上海' : text.split(' ')[0];
      make(id, {ranges:{title:[start,start],metadata:[metadata,metadata],description:[responsibilities+1,endOf(responsibilities)],requirements:[requirements+1,endOf(requirements)]}, fields:{
        industry, city, location:id==='o04'?'上海（中山西路1279弄2号楼3楼）'+(text.includes('base')?'；可base华东':''):city,
        salary_raw:salary, application_contact:contact,
        experience:text.match(/\d+(?:-\d+)?年以上?/)?.[0]??null,
        education:text.match(/硕士以上|本科及以上|本科以上|本科/)?.[0]??null,
        metadata_raw:text,
        company_facts_quote:id==='o04'?captureRange(lines,[8,28]):captureRange(lines,[343,343]),
        company_facts_status:'company_self_description_not_independent_verification',
        attention:'官网展示招聘信息；实际HC及固定/浮动薪酬待确认。非本轮新增发布证明。'
      }});
    }
  }
  extractBoard('o04',190,'企业软件 / SaaS','marketing@hidongxin.com');
  extractBoard('o05',294,'半导体 / AI算力器件','hr@launchsilicon.com');

  const backlog = [
    {url:'https://www.zhipin.com/web/geek/jobs',reason:'BOSS内置自动接管隔离；本轮未操作，完整JD/HR入口待补',status:'blocked'},
    {url:'https://c.liepin.com/',reason:'猎聘内置自动接管隔离；本轮未操作，完整JD/HR入口待补',status:'blocked'},
    {url:'https://firmior.cn/careers',reason:'搜索摘要含高级销售经理，打开官网只取得招聘入口，不能确认仍展示该JD；需核验新ATS',status:'detail_pending'},
    {url:'https://www.juzibot.com/careers/index.html',reason:'本次读取超时，未重试；搜索摘要不是完整JD',status:'failed'},
    {url:'https://www.haolietou.com/j_296373',reason:'硅基流动大客户销售详情读取超时；索引刷新日期2025-06-10，15-25万周期未确认，不作当前完整JD',status:'failed'},
    {url:'https://modelbest.cn/',reason:'本次仅发现公司官网，招聘入口与岗位待续',status:'not_scanned'},
    {url:'https://www.siliconflow.cn/',reason:'公司官网已由搜索发现，官方招聘入口待续；与招聘平台同名主体未独立核验',status:'not_scanned'}
  ];
  const status = {o01:'full_jd',o02:'recruitment_entry_only',o03:'fetch_failed',o04:'full_visible_jds',o05:'full_visible_jds',o06:'fetch_failed'};
  const seenUrls=new Set([...backlog.map(x=>x.url),...['o01','o02','o03','o04','o05','o06'].map(id=>captures.get(id).raw.request.open[0].ref_id)]);
  for(const id of ['q01','q02']) for(const match of String(captures.get(id).raw.result).matchAll(/^([^\n]+) \((https:\/\/[^\n)]+)\)\n/gm)) {
    const [,title,url]=match;
    if(seenUrls.has(url))continue;
    seenUrls.add(url);
    backlog.push({url,title,status:/\b(?:zhipin|liepin)\.com\//.test(url)?'blocked':'not_scanned',
      reason:'搜索发现待核，不是岗位全文；入口归属、招聘有效期与采集准入尚未核验',
      evidence_file:captures.get(id).evidence_file,evidence_sha256:captures.get(id).evidence_sha256});
  }
  for (const [id, value] of Object.entries(status)) {
    const s=captures.get(id);
    sourceResults.push({capture:id,company:s.raw.company,url:s.raw.request.open[0].ref_id,status:value,
      complete_jd:jobs.filter(j=>j.evidence_file===s.evidence_file).length,company_wide_complete:false,
      evidence_file:s.evidence_file,evidence_sha256:s.evidence_sha256});
  }
  let adapterRun = null;
  const httpEvidence=[];
  if (adapterManifestPath) {
    adapterRun=JSON.parse(await readFile(resolve(ROOT,adapterManifestPath),'utf8'));
    for (const source of adapterRun.sources) {
      sourceResults.push({...source,company_wide_complete:false});
      if (!source.report_paths.report_json) continue;
      const report=JSON.parse(await readFile(resolve(ROOT,source.report_paths.report_json),'utf8'));
      for(const run of report.runs) {
        httpEvidence.push(...run.evidence);
        for(const j of run.jobs) {
        jobs.push({id:`fallback-2026-09-22:${j.job_key}`,native_id:j.source_job_id,company:j.company_name,
          title:j.title,city:j.location_raw,location:j.location_raw,salary_raw:j.salary_raw,
          description:j.responsibilities??j.description_text,requirements:j.requirements,
          description_complete:Boolean(j.description_complete&&j.responsibilities&&j.requirements),
          source_description_complete:j.description_complete===true,
          description_structure_status:j.description_complete&&!j.responsibilities?'full_source_not_split':'structured',
          detail_completeness:j.detail_completeness,
          source_url:j.board_url,job_url:j.source_locator?.kind==='inline_job_card'?null:j.job_url,
          apply_url:/^https:/.test(j.application_url??'')?j.application_url:null,application_contact:j.application_url,
          source_locator:j.source_locator,channel:'官网HTTP采集',source_kind:'official_careers_page',
          observed_at:j.fetched_at,published_at:j.published_at,published_at_semantics:j.published_at_semantics,
          source_status:run.status,evidence_file:j.body_path,evidence_sha256:j.raw_response_sha256,
          supporting_evidence:[{file:j.metadata_path,sha256:sha(await readFile(resolve(ROOT,j.metadata_path)))}],
          time_note:'本轮HTTP采集时间；原发布日期单列，不认定为今天新发或当前开放。',
          discovery_industry:j.company_id==='deepseek'?'基础大模型':'AI企业应用',hiring_active:'unknown'});
        }
      }
    }
  }
  const observed=[...captures.values()].map(c=>c.raw.observed_at).sort();
  const audit=JSON.parse(await readFile(join(DIR,'timing-audit.json'),'utf8'));
  const run={schema_version:1,run_id:'fallback-2026-09-22',started_at:captures.get('q01').raw.started_at,
    finished_at:adapterRun?.finished_at??observed.at(-1),status:'partial',
    scope:'来源级兜底验证：3个固定适配器及A/B两次搜索、6次独立公开页面读取；不是完整行情扫描，也未修复BOSS/猎聘。',
    counts:{observations:jobs.length,complete_jd:jobs.filter(j=>j.description_complete).length,
      full_source_descriptions:jobs.filter(j=>j.description_complete||j.source_description_complete).length,
      full_source_not_split:jobs.filter(j=>j.description_structure_status==='full_source_not_split').length,
      companies:new Set(jobs.map(j=>j.company)).size},
    request_count:{web_tool_actual_calls:8,http_requests:httpEvidence.length,admission_timing_status:audit.status},
    http_evidence:httpEvidence.map(e=>({started_at:e.started_at,finished_at:e.finished_at,url:e.url,status:e.status,metadata_path:e.metadata_path})),
    queries:['硅基流动 面壁智能 招聘 销售 商务 官网','企业服务 AI 销售 商务 运营 招聘 加入我们 工作职责'].map(query=>({query,status:'searched_not_exhaustive'})),
    source_results:sourceResults,queued_urls:backlog,adapter_run:adapterRun?.artifacts.run_json??null,
    market_scan_complete:false,login_repaired:false,external_applications:0};
  const companies=[...new Set(jobs.map(j=>j.company))].map(company=>({company,jobs:jobs.filter(j=>j.company===company).length,
    source_urls:[...new Set(jobs.filter(j=>j.company===company).map(j=>j.source_url))],identity:'page_display_not_registry_verification'}));
  for(const [name,value] of Object.entries({'jobs.json':jobs,'report-run.json':run,'backlog.json':backlog,'companies.json':companies})) await writeFile(join(DIR,name),json(value));
  return run;
}
if(process.argv[1]===fileURLToPath(import.meta.url)) build(process.argv[2]).then(r=>console.log(json(r))).catch(e=>{console.error(e);process.exitCode=1;});
