import { readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { evidenceAbsolute } from './paths.mjs';

export function webLines(result) {
  const text = typeof result === 'string' ? result : result.content.filter((x) => x.type === 'text').map((x) => x.text).join('\n');
  return new Map([...text.matchAll(/^L(\d+):[ \t]?(.*)$/gm)].map((m) => [Number(m[1]), m[2]]));
}

export function lineRange(lines, from, to) {
  const values = [];
  for (let i = from; i <= to; i++) {
    if (!lines.has(i)) throw new Error(`Missing original source line ${i}`);
    values.push(lines.get(i));
  }
  return values.join('\n').trim();
}

// Line boundaries are reviewed against this immutable public-page capture, not inferred from job titles.
export async function extractTungee(inputDir) {
  const file = `${inputDir}/raw/007-open-tungee-mobile.json`;
  const raw = JSON.parse(await readFile(evidenceAbsolute(file), 'utf8'));
  const lines = webLines(raw.result);
  const specs = [
    ['business-expert', 85, 87, 90, 95, 99, 100],
    ['channel-manager', 104, 106, 109, 112, 116, 120],
    ['sales-consultant', 124, 126, 130, 133, 136, 140],
    ['telesales-manager', 144, 146, 150, 152, 156, 158],
    ['customer-success', 182, 184, 187, 192, 195, 202],
    ['city-manager', 206, 208, 211, 214, 218, 220],
    ['ka-sales-director', 224, 226, 229, 233, 237, 242],
  ];
  return specs.map(([id, title, city, dutyStart, dutyEnd, reqStart, reqEnd]) => ({
    id: `tungee-${id}-20260911`, company: '探迹科技', title: lines.get(title),
    city: lines.get(city), location: lines.get(city), salary_raw: null, job_url: null, apply_url: null,
    source_url: 'https://m.tungee.com/about/join-us/', source_kind: 'official', description_complete: true,
    description: lineRange(lines, dutyStart, dutyEnd), requirements: lineRange(lines, reqStart, reqEnd),
    observed_at: raw.observed_at, published_at: null,
    time_note: '工具结果记录时间，原调用起止未独立记录；官网未披露岗位发布日期，不证明新增或仍开放。',
    evidence_file: file, evidence_quote: lines.get(dutyStart).trim(),
    evidence_line_ranges: { title, city, responsibilities: [dutyStart, dutyEnd], requirements: [reqStart, reqEnd] },
    ownership_note: 'tungee.com子域招聘页；页脚为广州探迹科技有限公司，正文包含探迹AI销售产品。',
    scope_note: '同一官网列表页展示的独立职位，没有发现单岗位直链；不把列表URL当职位ID。电销专员应届岗未纳入。薪资及当前开放状态待确认。',
  }));
}

export async function extractInitialSweep(inputDir) {
  const jobs = await extractTungee(inputDir);
  const file = `${inputDir}/raw/002-search-salesforce.json`;
  const raw = JSON.parse(await readFile(evidenceAbsolute(file), 'utf8'));
  const text = raw.result;
  const block = text.split(/\n-{20,}/)[0];
  const quote = 'The Enterprise Account Executive maintains and expands relationships with strategically important and large enterprises.';
  if (!block.includes(quote) || !block.includes('Taiwan - Remote') || !block.includes('JR317761')) throw new Error('Salesforce lead source changed');
  jobs.push({ id: 'salesforce-jr317761-20260911', company: 'Salesforce', title: 'Named Account Executive',
    city: null, location: 'Taiwan - Remote', salary_raw: null,
    job_url: 'https://careers.salesforce.com/en/jobs/jr317761/named-account-executive/', apply_url: null,
    source_url: 'https://careers.salesforce.com/en/jobs/jr317761/named-account-executive/', source_kind: 'search_index',
    description_complete: false, description: block.slice(block.indexOf('## Description'), block.indexOf('Requirements:')).trim(),
    requirements: block.slice(block.indexOf('Requirements:'), block.indexOf('## Unleash Your Potential')).trim(),
    observed_at: (await stat(evidenceAbsolute(file))).mtime.toISOString(), published_at: '2026-08-26',
    time_note: '观察时间取原始结果文件持久化时间；采集草稿的未来占位时间不采纳。索引标Posted 26 August 2026；两次open返回0行，非当前在招核验。',
    evidence_file: file, evidence_quote: quote,
    ownership_note: 'Salesforce招聘域名的搜索索引；直接详情跳转后未取得正文。',
    scope_note: '索引工作地与要求中新加坡市场销售经历应分别核查，不能当成大陆远程工作。',
  });
  await writeFile(join(evidenceAbsolute(inputDir), 'jobs.json'), JSON.stringify(jobs, null, 2) + '\n');
  return { jobs: jobs.length, complete: jobs.filter((j) => j.description_complete).length };
}

export async function extractFxiaoke(inputDir) {
  const file = `${inputDir}/raw/013-open-fxiaoke.json`;
  const raw = JSON.parse(await readFile(evidenceAbsolute(file), 'utf8'));
  const lines = webLines(raw.result);
  const specs = [
    ['ka', 410, 412, 416, 424, 427, 437],
    ['csm-regional', 441, 443, 447, 455, 458, 470],
    ['channel', 474, 476, 480, 488, 491, 497],
    ['channel-partner', 501, 503, 507, 515, 518, 526],
    ['csm-advisory', 559, 561, 565, 575, 578, 588],
    ['after-sales', 592, 594, 598, 600, 603, 609],
  ];
  return specs.map(([id, title, city, dutyStart, dutyEnd, reqStart, reqEnd]) => ({
    id: `fxiaoke-${id}-20260911`, company: '纷享销客', title: lines.get(title).replace(/^#\s+/, ''),
    city: lines.get(city).split(' | ')[0], location: lines.get(city), salary_raw: null, job_url: null, apply_url: null,
    source_url: 'https://www.fxiaoke.com/crm/about-join/', source_kind: 'official', description_complete: true,
    description: lineRange(lines, dutyStart, dutyEnd), requirements: lineRange(lines, reqStart, reqEnd),
    observed_at: raw.observed_at, published_at: null, time_note: '官网未披露发布日期；工具结果记录时间并非岗位新发布或仍开放证明。',
    evidence_file: file, evidence_quote: lines.get(dutyStart).trim(),
    evidence_line_ranges: { title, city, responsibilities: [dutyStart, dutyEnd], requirements: [reqStart, reqEnd] },
    ownership_note: '纷享销客CRM官网的加入我们页面，正文直接列示岗位及公司域名招聘邮箱；没有发送邮件或申请。',
    scope_note: id === 'channel-partner' ? '渠道合伙人是否雇佣岗位、代理商合作或费用投资要求未知，不能按固定薪资管理岗认定。' : '同页岗位无独立链接，地点和职责不同的两条客户成功经理分别保留；研发/产品经理/实施工程岗未纳入主攻。',
  }));
}

export async function extractBaidu(inputDir) {
  const jobs = [];
  for (const [id, reqLine, city] of [['j100045', 19, '上海市'], ['j101343', 18, '北京市']]) {
    const file = `${inputDir}/raw/pm-open-baidu-${id}.json`;
    const raw = JSON.parse(await readFile(evidenceAbsolute(file), 'utf8'));
    const lines = webLines(raw.result);
    const url = raw.request.open[0].ref_id;
    if (!url.startsWith('https://talent.baidu.com/jobs/detail/SOCIAL/')) throw new Error('Unexpected Baidu source');
    jobs.push({ id: `baidu-${id}-20260911`, company: '百度智能云', title: lines.get(7), city, location: city,
      salary_raw: null, job_url: url, apply_url: null, source_url: url, source_kind: 'official', description_complete: true,
      description: lineRange(lines, 15, 15), requirements: lineRange(lines, reqLine, reqLine),
      observed_at: raw.observed_at, published_at: lines.get(11).match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null,
      time_note: '日期取岗位正文；HTML标题虽为百度校园招聘，原生URL为SOCIAL且JD非校招。后续另一条详情只返回登录，来源停止继续访问。',
      evidence_file: file, evidence_quote: lines.get(15).slice(0, 50),
      evidence_line_ranges: { title: 7, city: 11, responsibilities: [15, 15], requirements: [reqLine, reqLine] },
      ownership_note: '百度官方talent.baidu.com社会招聘详情，职责明确百度智能云产品及ACG业务。',
      scope_note: '公开JD读取成功；不能据其他详情受限推断本岗关闭，也不把标题经理推定为人员管理。固定薪资未知。',
    });
  }
  return jobs;
}

export async function extractAWS(inputDir) {
  const file = `${inputDir}/raw/025-open-aws.json`;
  const raw = JSON.parse(await readFile(evidenceAbsolute(file), 'utf8'));
  const lines = webLines(raw.result);
  return [{ id: 'aws-10464449-20260911', company: 'Amazon Web Services', title: 'BD Manager, Strategic Account',
    city: '上海、广州、南京', location: lineRange(lines, 59, 61), salary_raw: null,
    job_url: 'https://www.amazon.jobs/jobs/10464449', apply_url: null, source_url: 'https://www.amazon.jobs/jobs/10464449',
    source_kind: 'official', description_complete: true, description: lineRange(lines, 23, 32), requirements: lineRange(lines, 49, 55),
    observed_at: raw.observed_at, published_at: null, time_note: '官方页面观察时间，不代表新发布或录用薪资。',
    evidence_file: file, evidence_quote: lines.get(28),
    evidence_line_ranges: { responsibilities: [23, 32], requirements: [49, 55], location: [59, 61] },
    ownership_note: 'Amazon官方职位页，原生Job ID10464449，主体为亚马逊北京公司上海分公司；不是第三方代理职位。',
    scope_note: '云业务发展岗位，Manager不等于直管团队；英文、计算机相关学历及云架构经历需核查。',
  }];
}

export async function extractBaiduIndex(inputDir) {
  const file = `${inputDir}/raw/pm-002-baidu.json`;
  const raw = JSON.parse(await readFile(evidenceAbsolute(file), 'utf8'));
  const jobs = [];
  for (const block of raw.result.split(/\n?-{20,}/)) {
    const url = block.match(/\((https:\/\/talent\.baidu\.com\/jobs\/detail\/SOCIAL\/[^)]+)\)/)?.[1];
    if (!url) continue;
    const title = block.split('\n').find((line) => /^[^#\s].*[（(]J\d+[）)]\s*$/.test(line));
    const native = title?.match(/J\d+/)?.[0].toLowerCase();
    if (!native || ['j100045', 'j101343'].includes(native)) continue;
    const meta = block.split('\n').find((line) => /^ACG.+\d{4}-\d{2}-\d{2}/.test(line));
    const city = meta?.match(/^ACG(.+?)(?:政企|销售)/)?.[1] ?? null;
    const [before, requirements] = block.split('职责要求：');
    const description = before.split('工作职责：')[1]?.trim() ?? null;
    jobs.push({ id: `baidu-${native}-index-20260911`, company: '百度智能云', title, city, location: city,
      salary_raw: null, job_url: url, apply_url: null, source_url: url, source_kind: 'search_index', description_complete: false,
      description, requirements: requirements?.trim() ?? null, observed_at: raw.observed_at,
      published_at: meta?.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null,
      time_note: '日期仅为搜索索引中的正文日期；未直接核验该条完整页面。', evidence_file: file, evidence_quote: title,
      ownership_note: '百度官方SOCIAL原生链接的公开索引，和已读取的其他岗位不是同一验证状态。',
      scope_note: native === 'j98717' ? '该条open仅返回登录，已停止百度后续访问；保留此前索引，不视为开放。' : '本轮索引线索；部分技术售前门槛较高，非自动推荐或自动投递。',
    });
  }
  return jobs;
}

export async function extractSalesYi(inputDir) {
  const file = `${inputDir}/raw/029-open-salesyi.json`;
  const raw = JSON.parse(await readFile(evidenceAbsolute(file), 'utf8'));
  const lines = webLines(raw.result);
  const specs = [
    ['account', '客户经理', '北京/上海/广州/深圳/成都/杭州/南京', 509, 513, 517, 520],
    ['solutions', '方案顾问', '北京/上海/广州/深圳/杭州', 525, 530, 534, 537],
    ['csm', '客户成功经理', '北京/上海/广州/深圳', 542, 547, 550, 555],
  ];
  return specs.map(([id, title, city, dutyStart, dutyEnd, reqStart, reqEnd]) => ({
    id: `salesyi-${id}-20260911`, company: '销售易', title, city, location: city, salary_raw: null,
    job_url: null, apply_url: null, source_url: 'https://www.xiaoshouyi.com/about-us/career', source_kind: 'official',
    description_complete: true, description: lineRange(lines, dutyStart, dutyEnd), requirements: lineRange(lines, reqStart, reqEnd),
    observed_at: raw.observed_at, published_at: null, time_note: '官网未披露社招发布日期，首次观察不等于新发布；与同页校招块分开。',
    evidence_file: file, evidence_quote: lines.get(dutyStart).trim(),
    evidence_line_ranges: { responsibilities: [dutyStart, dutyEnd], requirements: [reqStart, reqEnd] },
    ownership_note: '销售易官方career页，按CBG社招区块提取，未把同页校招或产品工程岗混入。',
    scope_note: '没有取得独立岗位链接；通过官网来源页的同名条目回查。薪资、真实管理权限和招聘有效性待核。',
  }));
}
