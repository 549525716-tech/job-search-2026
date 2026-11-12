import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('tailor', ROOT / 'careers/resume_tailor.py')
tailor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tailor)
BATCH = ROOT / '03_简历/JD定向实操_2026-10-18/batch.json'


class TailoringTests(unittest.TestCase):
    def setUp(self):
        self.batch = json.loads(BATCH.read_text())
        self.base, self.jobs, self.root, self.ps, self.header = tailor.read_inputs(self.batch)

    def test_all_ten_have_traceable_quotes(self):
        tailor.validate(self.batch, self.jobs, self.ps)
        self.assertEqual(len(self.batch['variants']), 10)

    def test_base_change_fails_closed(self):
        self.batch['base_sha256'] = '0' * 64
        with self.assertRaisesRegex(ValueError, 'Base resume changed'):
            tailor.read_inputs(self.batch)

    def test_jd_change_fails_closed(self):
        self.batch['jobs_sha256'] = '0' * 64
        with self.assertRaisesRegex(ValueError, 'JD source changed'):
            tailor.read_inputs(self.batch)

    def test_forged_quote_rejected(self):
        self.batch['variants'][0]['requirements'][0]['quote'] = 'not a quote'
        with self.assertRaisesRegex(ValueError, 'JD quote'):
            tailor.validate(self.batch, self.jobs, self.ps)

    def test_immutable_work_title(self):
        self.batch['variants'][0]['changes'][0]['slot'] = 13
        with self.assertRaisesRegex(ValueError, 'Protected'):
            tailor.validate(self.batch, self.jobs, self.ps)

    def test_unknown_fact_rejected(self):
        self.batch['variants'][0]['changes'][0]['facts'] = [999]
        with self.assertRaisesRegex(ValueError, 'Invalid edit evidence'):
            tailor.validate(self.batch, self.jobs, self.ps)

    def test_removed_absolute_metric_rejected(self):
        self.batch['variants'][0]['changes'][1]['text'] = '成交4→10台'
        with self.assertRaisesRegex(ValueError, 'removed'):
            tailor.validate(self.batch, self.jobs, self.ps)

    def test_package_and_source_preserved(self):
        self.batch['variants'] = self.batch['variants'][:1]
        before = self.base.read_bytes()
        with tempfile.TemporaryDirectory(dir=ROOT) as temp:
            output = Path(temp) / 'new'
            result = tailor.build(self.batch, output)
            self.assertFalse(result['ready_to_submit'])
            self.assertEqual(before, self.base.read_bytes())
            generated = next(output.glob('01_*.docx'))
            with ZipFile(self.base) as a, ZipFile(generated) as b:
                self.assertEqual(a.namelist(), b.namelist())
                for name in a.namelist():
                    if name != 'word/document.xml':
                        self.assertEqual(a.read(name), b.read(name), name)
            with self.assertRaisesRegex(ValueError, 'NEW directory'):
                tailor.build(self.batch, output)

    def test_untrusted_jd_is_escaped_not_executed(self):
        self.assertEqual(tailor.safe_link('javascript:alert(1)'), '')
        manifest = json.loads((ROOT / '03_简历/JD定向实操_2026-10-18/交付/对比数据.json').read_text())
        manifest['variants'][0]['job']['jd'] = '<script>attack()</script>'
        html = tailor.comparison_html(manifest)
        self.assertIn('&lt;script&gt;attack()', html)
        self.assertNotIn('<script>attack()', html)


if __name__ == '__main__':
    unittest.main()
