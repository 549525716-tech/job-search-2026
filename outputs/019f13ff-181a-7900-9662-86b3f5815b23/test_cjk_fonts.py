from docx import Document
from docx.oxml.ns import qn
from docx.shared import Pt

fonts = [
    "Arial Unicode MS",
    "PingFang SC",
    "Hiragino Sans GB",
    "Heiti SC",
    "STHeiti",
    "SimSong",
    "Songti SC",
    "Kaiti SC",
]

doc = Document()
for font in fonts:
    p = doc.add_paragraph()
    r = p.add_run(f"{font}：贺文杰 AI解决方案销售 大模型客户经理")
    r.font.name = font
    r._element.rPr.rFonts.set(qn("w:eastAsia"), font)
    r.font.size = Pt(14)
doc.save("cjk_font_test.docx")
