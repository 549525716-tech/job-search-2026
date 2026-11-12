"""Verify delivered bytes and build a private, self-contained review package."""
from hashlib import sha256
import json
from pathlib import Path
from urllib.parse import unquote, urlparse
from zipfile import ZIP_DEFLATED, ZipFile

from lxml import etree, html

ROOT = Path(__file__).resolve().parent.parent
TASK = ROOT / '03_简历/JD定向实操_2026-10-18'
DELIVERY = TASK / '交付'
batch = json.loads((TASK / 'batch.json').read_text())
manifest = json.loads((DELIVERY / '对比数据.json').read_text())
base = ROOT / batch['base_file']
assert sha256(base.read_bytes()).hexdigest() == batch['base_sha256']
assert (DELIVERY / '原版简历.docx').read_bytes() == base.read_bytes()
ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
protected = [13, 16, 17, 18, 19, 32, 35, 36, 37, 39, 48, 51, 52, 53, 55, 65, 66]
checks = []
with ZipFile(base) as original:
    before = etree.fromstring(original.read('word/document.xml')).find('w:body', ns).findall('w:p', ns)
    for v in manifest['variants']:
        file = DELIVERY / v['file']
        assert sha256(file.read_bytes()).hexdigest() == v['docx_sha256']
        with ZipFile(file) as z:
            assert not any('footer' in name for name in z.namelist())
            doc = etree.fromstring(z.read('word/document.xml'))
            ps = doc.find('w:body', ns).findall('w:p', ns)
            assert len(ps) == len(before)
            for i in protected:
                assert etree.tostring(ps[i]) == etree.tostring(before[i]), (v['slug'], i)
            for name in original.namelist():
                if name != 'word/document.xml':
                    assert original.read(name) == z.read(name), (v['slug'], name)
        evidence = v['job']['evidence_file']
        expected = v['job']['evidence_sha256']
        if evidence and expected:
            assert sha256((ROOT / evidence).read_bytes()).hexdigest() == expected, evidence
        checks.append({'slug': v['slug'], 'protected_facts_and_photo_unchanged': True, 'no_footer_part': True,
                       'source_evidence_file_hash_verified': bool(evidence and expected)})
for file in DELIVERY.glob('*.html'):
    doc = html.fromstring(file.read_text())
    for href in doc.xpath('//a/@href'):
        if not urlparse(href).scheme:
            assert (file.parent / unquote(href)).is_file(), (file.name, href)
archive = TASK / '10份定向简历与前后对比.zip'
with ZipFile(archive, 'w', ZIP_DEFLATED) as z:
    for file in sorted(DELIVERY.iterdir()):
        if file.is_file():
            z.write(file, '交付/' + file.name)
archive.chmod(0o600)
with ZipFile(archive) as z:
    assert z.testzip() is None
    for file in DELIVERY.iterdir():
        if file.is_file():
            assert z.read('交付/' + file.name) == file.read_bytes()
result = {'original_unchanged': True, 'variants': checks, 'all_local_links_valid': True,
          'archive': str(archive), 'archive_sha256': sha256(archive.read_bytes()).hexdigest(),
          'archive_verified_against_delivery': True, 'ready_to_submit': False}
(TASK / 'qa/delivery-check.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
print(json.dumps({'variants':len(checks), 'archive':str(archive), 'all_checks_passed':True}, ensure_ascii=False))
