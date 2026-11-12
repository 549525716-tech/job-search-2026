from pathlib import Path
import hashlib
import json
import re
import shutil
import zipfile

from docx import Document
import pdfplumber


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "outputs/upwork-ai-portfolio"
TMP = ROOT / "tmp/upwork-portfolio"
STEM = "Wenjie_He_AI_Workflow_Portfolio"
doc_path = OUT / f"{STEM}.docx"
rendered = TMP / "render-final" / f"{STEM}.pdf"
doc = Document(doc_path)
paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
normalize = lambda text: re.sub(r"\s+", "", text)
with pdfplumber.open(rendered) as pdf:
    assert len(pdf.pages) == 6
    page_text = [p.extract_text() or "" for p in pdf.pages]
    joined = normalize("\n".join(page_text))
    assert all(normalize(p) in joined for p in paragraphs), "Missing or changed rendered text"
    assert not re.search(r"[\u3400-\u9fff]", joined), "Non-English public text"
    assert not re.search(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", joined)
    assert "/Users/" not in joined
    bounds = []
    for p in pdf.pages:
        assert all(48 <= char["x0"] and char["x1"] <= 564 for char in p.chars)
        assert all(44 <= char["top"] and char["bottom"] <= 746 for char in p.chars)
        bounds.append(round(max(char["bottom"] for char in p.chars), 1))
with zipfile.ZipFile(doc_path) as archive:
    for name in archive.namelist():
        if name.startswith("word/footer") and name.endswith(".xml"):
            assert "<w:t>" not in archive.read(name).decode()

source_paths = [
    ROOT / "02_岗位画像/我的当前情况总结.md",
    Path("/Users/MR/Documents/地图1/docs/bd-map-workbench-product-doc.md"),
    Path("/Users/MR/Documents/地图1/docs/local-project-audit-20260906.md"),
    Path("/Users/MR/Documents/New project/outputs/vehicle-analysis-20260629-latest/车源效果分析报告_最新版_20260629.md"),
    Path("/Users/MR/Documents/自动化工作流/outputs/postlink-202608-20260906/final-audit-summary.json"),
]
sources = [{"path": str(p), "sha256": hashlib.sha256(p.read_bytes()).hexdigest()} for p in source_paths]
audit = json.loads(source_paths[-1].read_text())
assert audit["verified_submitted"] == 214
assert audit["duplicate_verified_ids"] == 0
assert audit["pending"] == 0
assert audit["count_difference_from_initial_ui"] == 14
vehicle_report = source_paths[-2].read_text()
assert all(number in vehicle_report for number in ("91,951", "32,232", "1,807"))
assert abs(2000 / 100000 - .02) < 1e-9
assert abs(40 / 2000 - .02) < 1e-9
assert abs(8000 / 100000 - .08) < 1e-9
assert abs(24 / 8000 - .003) < 1e-9

shutil.copyfile(rendered, OUT / f"{STEM}.pdf")
result = {
    "pages": 6,
    "english_text_check": "passed",
    "docx_pdf_text_match": "passed",
    "text_bounds_check": "passed",
    "footer_text": "absent",
    "contact_information": "absent",
    "synthetic_example_arithmetic": "passed",
    "upwork_copy_lengths": json.loads((TMP / "content_checks.json").read_text())["entries"],
    "page_text_bottom_points": bounds,
    "source_evidence": sources,
    "measurement_limits": "Personal efficiency and team adoption are user-reported. Saved reporting logs are not a new live verification. No AI revenue uplift claimed.",
    "publication_status": "Local files only. Not uploaded to Upwork.",
}
(TMP / "final_checks.json").write_text(json.dumps(result, ensure_ascii=False, indent=2))
print(json.dumps({k: v for k, v in result.items() if k != "source_evidence"}, indent=2))
