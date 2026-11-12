"""Render an explicitly authored, evidence-linked tailoring batch. Never sends it."""
import argparse
from copy import deepcopy
from hashlib import sha256
from html import escape
import json
import os
from pathlib import Path
import re
import shutil
import tempfile
from urllib.parse import quote, urlparse
from zipfile import ZipFile

from lxml import etree

ROOT = Path(__file__).resolve().parent.parent
NS = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
W = '{' + NS['w'] + '}'
ALLOWED = {2, 3, 4, 5, 7, 8, 9, 10, 11, 14, 21, 22, 24, 25, 27, 28,
           33, 40, 42, 43, 45, 46, 49, 56, 58, 59, 61, 62}


def digest(data):
    return sha256(data).hexdigest()


def ptext(p):
    return ''.join(p.itertext()) if p.tag == W + 't' else ''.join(p.xpath('.//w:t/text()', namespaces=NS))


def job_text(job):
    desc = next((str(job[k]).strip() for k in ('description_text', 'jd_text', 'description_raw', 'description') if job.get(k) is not None), '')
    req = str(job.get('requirements_text') or job.get('requirements') or '').strip()
    return desc + ('\n\n' + req if req and req not in desc else '')


def local_path(value):
    path = (ROOT / value).resolve()
    if not path.is_relative_to(ROOT):
        raise ValueError('Input must stay inside project')
    return path


def read_inputs(batch):
    base = local_path(batch['base_file'])
    source = local_path(batch['jobs_file'])
    if digest(base.read_bytes()) != batch['base_sha256']:
        raise ValueError('Base resume changed; re-review facts before generation')
    if digest(source.read_bytes()) != batch['jobs_sha256']:
        raise ValueError('JD source changed; re-freeze and re-review batch')
    jobs = json.loads(source.read_text())
    with ZipFile(base) as z:
        root = etree.fromstring(z.read('word/document.xml'))
    paragraphs = root.find('w:body', NS).findall('w:p', NS)
    header = root.find('w:body/w:tbl', NS).findall('.//w:p', NS)
    if len(paragraphs) != 67 or ptext(header[0]) != '贺文杰':
        raise ValueError('Template structure changed; remap slots')
    return base, jobs, root, paragraphs, header


def validate(batch, jobs, paragraphs):
    variants = batch['variants']
    if not variants or len({v['slug'] for v in variants}) != len(variants):
        raise ValueError('Missing or duplicated variants')
    for v in variants:
        if not re.fullmatch('[a-z0-9-]+', v['slug']):
            raise ValueError('Unsafe filename')
        job = jobs[v['job_index']]
        jd = job_text(job)
        if job.get('id') != v['job_id'] or job.get('description_complete') is not True or not jd.strip():
            raise ValueError('Wrong or incomplete JD')
        if not v['mission'] or not v['case'] or not v['gaps'] or not v['positioning']:
            raise ValueError('Top-down reasoning and boundaries required')
        reqs = v['requirements']
        if not reqs:
            raise ValueError('No requirement mapping')
        for r in reqs:
            if not r['quote'] or r['quote'] not in jd or not r['capability']:
                raise ValueError('JD quote not found or no capability translation')
            if r['type'] not in ('direct', 'transferable', 'gap') or not r['boundary']:
                raise ValueError('Evidence boundary missing')
            if r['type'] != 'gap' and not r['facts']:
                raise ValueError('Evidence required')
            for i in r['facts']:
                if not isinstance(i, int) or i not in range(len(paragraphs)) or not ptext(paragraphs[i]):
                    raise ValueError('Invalid evidence paragraph')
        if len({c['slot'] for c in v['changes']}) != len(v['changes']):
            raise ValueError('Duplicate edit slot')
        for c in v['changes']:
            if c['slot'] != 'direction' and c['slot'] not in ALLOWED:
                raise ValueError('Protected template slot')
            if not c['text'].strip() or not c['facts'] or not c['reason']:
                raise ValueError('Empty edit/evidence/rationale')
            if c['requirement'] not in range(len(reqs)):
                raise ValueError('Unmapped requirement')
            for i in c['facts']:
                if i not in range(len(paragraphs)) or not ptext(paragraphs[i]):
                    raise ValueError('Invalid edit evidence')
            if re.search(r'4\s*(?:→|到|至|-)\s*10\s*台', c['text']):
                raise ValueError('User removed absolute vehicle sales metric')


def replace_paragraph(paragraph, text, labeled=False):
    # Retain paragraph/list geometry and run appearance; only editable text changes.
    first = paragraph.find('w:r/w:rPr', NS)
    props = deepcopy(first) if first is not None else etree.Element(W + 'rPr')
    for child in list(paragraph):
        if child.tag != W + 'pPr':
            paragraph.remove(child)
    parts = text.split('：', 1) if labeled and '：' in text else [text]
    for n, part in enumerate(parts):
        r = etree.SubElement(paragraph, W + 'r')
        style = deepcopy(props)
        if labeled:
            for b in style.findall('w:b', NS):
                style.remove(b)
            if n == 0 and len(parts) == 2:
                etree.SubElement(style, W + 'b')
        r.append(style)
        t = etree.SubElement(r, W + 't')
        t.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
        t.text = part + ('：' if n == 0 and len(parts) == 2 else '')


def safe_link(url):
    return url if urlparse(url or '').scheme in ('https', 'http') else ''


def comparison_html(manifest):
    e = escape
    sections = []
    for n, v in enumerate(manifest['variants'], 1):
        file = quote(v['file'])
        j = v['job']
        mapping = ''.join('<li><b>' + e(r['capability']) + '</b> · ' + e({'direct': '直接证据', 'transferable': '可迁移证据', 'gap': '真实缺口'}[r['type']])
                          + '<p>JD：' + e(r['quote']) + '</p><p>依据：' + e('；'.join(r['fact_quotes']) or '暂无对应事实')
                          + '</p><p>边界：' + e(r['boundary']) + '</p></li>' for r in v['requirements'])
        changes = ''.join('<div class="change"><h4>' + e(c['section']) + '</h4><div class="pair"><div><small>原版</small><p>' + e(c['before'])
                          + '</p></div><div><small>定向版</small><p>' + e(c['after']) + '</p></div></div><p class="reason">' + e(c['reason'])
                          + ' · 对应能力：' + e(v['requirements'][c['requirement']]['capability']) + '</p></div>' for c in v['changes'])
        sections.append(f'''<details class="job"><summary><span>{n:02d}　{e(j['company'])}｜{e(j['title'])}</span><small>{e(v['status'])} · {len(v['changes'])}处修改</small></summary>
<div class="inside"><p class="meta">{e(j['location'])} · 薪资原文：{e(j['salary'])} · {e(j['source_kind'])}</p>
<p class="warning">{e(j['source_warning'])}</p><nav><a href="{file}">定向简历 DOCX</a><a href="{quote(v['preview_file'])}">完整正文</a><a href="{e(safe_link(j['url']))}" target="_blank" rel="noopener noreferrer">岗位来源页</a></nav>
<h3>岗位需要什么</h3><p>{e(v['mission'])}</p><h3>这份简历如何证明</h3><p>{e(v['positioning'])}</p><p><b>主案例：</b>{e(v['case'])}</p>
<p class="warning"><b>不能靠改写解决：</b>{e('；'.join(v['gaps']))}</p><details><summary>JD能力与已有事实逐项对应</summary><ol>{mapping}</ol></details>
<h3>全部修改前后对比</h3>{changes}<details><summary>本地JD全文及任职要求</summary><pre>{e(j['jd'])}</pre></details></div></details>''')
    return '''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>10份JD定向简历 前后对比</title><style>
*{box-sizing:border-box}body{margin:0;color:#243039;background:#f5f7f8;font:15px/1.7 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;letter-spacing:0}main{max-width:1180px;margin:auto;padding:26px 24px}h1{font-size:26px;margin:0}h2{font-size:21px}h3{font-size:18px;margin:20px 0 6px}h4,p{margin:6px 0}a{color:#006e69}nav{display:flex;gap:20px;flex-wrap:wrap}.toolbar{display:flex;gap:10px;align-items:center;padding:16px 0;flex-wrap:wrap}.toolbar button{border:1px solid #bdcbd0;background:white;padding:7px 12px;cursor:pointer;border-radius:4px;font:inherit}.job{background:#fff;border-bottom:1px solid #cad3d6}.job>summary{padding:16px;cursor:pointer;font-size:17px;font-weight:650;display:list-item}.job summary small{display:block;font-size:13px;color:#67777e;font-weight:400}.inside{padding:0 22px 22px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:24px}.pair>div{min-width:0}.pair small{color:#67777e}.pair>div+div{border-left:3px solid #00877e;padding-left:16px}.change{border-top:1px solid #e4e9eb;padding:12px 0}.reason,.meta{font-size:13px;color:#596a71}.warning{color:#865511}.inside details{margin:14px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}li{padding:8px 0}summary{cursor:pointer}span,a,p{overflow-wrap:anywhere}@media(max-width:700px){main{padding:18px 12px}.pair{grid-template-columns:1fr;gap:8px}.inside{padding:0 14px 16px}h1{font-size:23px}}</style>
<main><h1>10份JD定向简历 前后对比</h1><p>基于当前销售与商业化管理简历逐岗改写。原件和照片保留；已生成材料，未上传、未投递。</p>
<p class="warning">使用10月8日本地JD快照，本轮未核实在招状态；并非10份均满足门槛或固定月薪20K。MiniMax为第三方转载，工业商务样本发布日期较早。</p>
<nav><a href="原版简历.docx">原版 DOCX</a><a href="原版正文.html">原版完整正文</a><a href="对比数据.json">修改及证据清单</a></nav>
<div class="toolbar"><button id="expand">＋ 全部展开</button><button id="collapse">− 全部收起</button><span>按公司相邻排列，点击岗位查看修改</span></div>''' + ''.join(sections) + '''</main><script>
document.getElementById('expand').onclick=()=>document.querySelectorAll('details.job').forEach(x=>x.open=true);
document.getElementById('collapse').onclick=()=>document.querySelectorAll('details').forEach(x=>x.open=false);
</script></html>'''


def text_preview(root, title):
    paragraphs = root.xpath('//w:body//w:p', namespaces=NS)
    lines = [escape(ptext(p)) for p in paragraphs if ptext(p)]
    return '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + escape(title) + '</title><style>body{max-width:900px;margin:24px auto;padding:0 20px;font:16px/1.8 -apple-system,"PingFang SC",sans-serif;color:#243039}p{margin:10px 0}</style><p>正文核对视图；正式排版及照片以DOCX为准。</p><p>' + '</p><p>'.join(lines) + '</p></html>'


def build(batch, output):
    base, jobs, original, paragraphs, header = read_inputs(batch)
    validate(batch, jobs, paragraphs)
    output = Path(output).resolve()
    if not output.is_relative_to(ROOT) or output.exists():
        raise ValueError('Output must be a NEW directory inside project; never overwrite a review')
    output.parent.mkdir(parents=True, exist_ok=True)
    stage = Path(tempfile.mkdtemp(prefix='.resume-build-', dir=output.parent))
    os.chmod(stage, 0o700)
    manifest = {'schema_version': 1, 'base_sha256': batch['base_sha256'], 'jobs_sha256': batch['jobs_sha256'],
                'generation': 'Current Codex authored semantic drafts; deterministic local OOXML renderer',
                'ready_to_submit': False, 'live_requests': 0, 'variants': []}
    try:
        shutil.copyfile(base, stage / '原版简历.docx')
        (stage / '原版正文.html').write_text(text_preview(original, '原版正文'))
        for number, v in enumerate(batch['variants'], 1):
            root = deepcopy(original)
            ps = root.find('w:body', NS).findall('w:p', NS)
            hs = root.find('w:body/w:tbl', NS).findall('.//w:p', NS)
            changes = []
            for c in v['changes']:
                slot = c['slot']
                target = hs[1] if slot == 'direction' else ps[slot]
                before = ptext(target)
                replace_paragraph(target, c['text'], labeled=slot in [3, 4, 5, 7, 8, 9, 10, 11])
                section = '求职方向' if slot == 'direction' else ('职业概述' if slot < 6 else '核心能力' if slot < 12 else '懂车帝经历' if slot < 30 else '乐道经历' if slot < 48 else '特斯拉经历')
                changes.append({**c, 'section': section, 'before': before, 'after': c['text'], 'fact_quotes': [ptext(paragraphs[i]) for i in c['facts']]})
            filename = f'{number:02d}_{v["slug"]}_贺文杰.docx'
            with ZipFile(base) as zin, ZipFile(stage / filename, 'w') as zout:
                for info in zin.infolist():
                    data = etree.tostring(root, xml_declaration=True, encoding='UTF-8', standalone=True) if info.filename == 'word/document.xml' else zin.read(info.filename)
                    zout.writestr(info, data)
            with ZipFile(base) as a, ZipFile(stage / filename) as b:
                preserved = all(a.read(n) == b.read(n) for n in a.namelist() if n != 'word/document.xml')
                if not preserved:
                    raise ValueError('Template asset preservation failed')
            preview = filename.replace('.docx', '.html')
            (stage / preview).write_text(text_preview(root, v['slug']))
            job = jobs[v['job_index']]
            requirements = [{**r, 'fact_quotes': [ptext(paragraphs[i]) for i in r['facts']]} for r in v['requirements']]
            manifest['variants'].append({**{k: v[k] for k in ('slug', 'mission', 'positioning', 'status', 'case', 'gaps')},
                'job': {'id': job['id'], 'company': job.get('company_name') or job.get('company'), 'title': job['title'],
                        'jd': job_text(job), 'jd_sha256': digest(job_text(job).encode()), 'location': job.get('location') or job.get('city') or '来源未披露',
                        'salary': job.get('salary_raw') or '未披露', 'source_kind': job.get('source_kind') or '来源类型待核',
                        'url': job.get('job_url') or job.get('source_url'), 'source_warning': job.get('attention') or '本地历史快照；当前在招及薪酬构成未核实。',
                        'observed_at': job.get('observed_at'), 'published_at': job.get('published_at'),
                        'evidence_file': job.get('evidence_file'), 'evidence_sha256': job.get('evidence_sha256')},
                'file': filename, 'preview_file': preview, 'docx_sha256': digest((stage / filename).read_bytes()),
                'all_non_document_parts_preserved': preserved, 'requirements': requirements, 'changes': changes})
        (stage / '对比数据.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
        (stage / 'index.html').write_text(comparison_html(manifest))
        for file in stage.iterdir():
            file.chmod(0o600)
        stage.rename(output)
    except BaseException:
        shutil.rmtree(stage)
        raise
    return {'status': 'drafts_generated_not_submitted', 'count': len(manifest['variants']), 'output': str(output),
            'review': str(output / 'index.html'), 'ready_to_submit': False,
            'remaining_gates': ['semantic_review', 'render_all_pages', 'live_job_and_identity_verification', 'submission_authority_and_channel']}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--batch', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    print(json.dumps(build(json.loads(Path(args.batch).read_text()), args.output), ensure_ascii=False))
