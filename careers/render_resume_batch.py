"""Task-local DOCX render gate using the selected document runtime, no network."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys

from pypdf import PdfReader


parser = argparse.ArgumentParser()
parser.add_argument('--delivery', required=True)
parser.add_argument('--qa', required=True)
parser.add_argument('--renderer', required=True)
parser.add_argument('--fontconfig', required=True)
args = parser.parse_args()
delivery = Path(args.delivery).resolve()
qa = Path(args.qa).resolve()
manifest = json.loads((delivery / '对比数据.json').read_text())
env = {**os.environ, 'FONTCONFIG_FILE': str(Path(args.fontconfig).resolve())}
results = []
for variant in manifest['variants']:
    source = delivery / variant['file']
    output = qa / variant['slug']
    command = [sys.executable, args.renderer, str(source), '--output_dir', str(output), '--emit_pdf']
    run = subprocess.run(command, env=env, capture_output=True, text=True, timeout=150)
    if run.returncode:
        raise RuntimeError(f'{variant["slug"]}: {run.stderr}\n{run.stdout}')
    pdf = output / source.with_suffix('.pdf').name
    reader = PdfReader(pdf)
    text = '\n'.join(page.extract_text() for page in reader.pages)
    required = ['贺文杰', '教育经历', '广东培正学院', '绩效', '方法沉淀']
    missing = [word for word in required if word not in text]
    if missing or len(reader.pages) != 2:
        raise ValueError(f'{variant["slug"]}: pages={len(reader.pages)}, missing={missing}')
    results.append({'slug': variant['slug'], 'pages': len(reader.pages), 'pdf': str(pdf),
                    'text_characters': len(text), 'required_text_present': True,
                    'visual_review': 'pending_not_implied_by_text_check'})
    print(json.dumps(results[-1], ensure_ascii=False), flush=True)
qa.mkdir(parents=True, exist_ok=True)
(qa / 'render-results.json').write_text(json.dumps(results, ensure_ascii=False, indent=2))
