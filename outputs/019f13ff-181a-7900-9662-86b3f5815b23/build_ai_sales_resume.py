from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK, WD_LINE_SPACING
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Inches, Pt, RGBColor


WORKSPACE = Path("/Users/MR/Documents/职场")
OUTPUT = WORKSPACE / "03_简历/贺文杰_AI大模型解决方案销售_BOSS市场定向版_2026-07-20.docx"
PHOTO = WORKSPACE / "outputs/019f13ff-181a-7900-9662-86b3f5815b23/image1.png"

DARK = "17324D"
TEAL = "0F766E"
GOLD = "D6A84B"
TEXT = "263238"
MUTED = "64748B"
LIGHT = "EAF1F5"
PALE = "F7FAFC"
WHITE = "FFFFFF"
FONT = "PingFang SC"


def set_cell_shading(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)


def set_cell_border(cell, **kwargs):
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    tc_borders = tc_pr.first_child_found_in("w:tcBorders")
    if tc_borders is None:
        tc_borders = OxmlElement("w:tcBorders")
        tc_pr.append(tc_borders)
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        if edge not in kwargs:
            continue
        edge_data = kwargs.get(edge)
        tag = "w:{}".format(edge)
        element = tc_borders.find(qn(tag))
        if element is None:
            element = OxmlElement(tag)
            tc_borders.append(element)
        for key, value in edge_data.items():
            element.set(qn("w:{}".format(key)), str(value))


def set_cell_margins(cell, top=70, start=90, bottom=70, end=90):
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for margin, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tc_mar.find(qn(f"w:{margin}"))
        if node is None:
            node = OxmlElement(f"w:{margin}")
            tc_mar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def set_run_font(run, size=9.2, bold=False, color=TEXT, font=FONT):
    run.font.name = font
    run._element.rPr.rFonts.set(qn("w:eastAsia"), font)
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = RGBColor.from_string(color)


def set_paragraph(paragraph, before=0, after=0, line=1.08, keep=False):
    fmt = paragraph.paragraph_format
    fmt.space_before = Pt(before)
    fmt.space_after = Pt(after)
    fmt.line_spacing_rule = WD_LINE_SPACING.SINGLE
    fmt.line_spacing = line
    fmt.keep_with_next = keep


def add_text(paragraph, text, size=9.2, bold=False, color=TEXT):
    run = paragraph.add_run(text)
    set_run_font(run, size=size, bold=bold, color=color)
    return run


def set_repeat_table_header(row):
    tr_pr = row._tr.get_or_add_trPr()
    tbl_header = OxmlElement("w:tblHeader")
    tbl_header.set(qn("w:val"), "true")
    tr_pr.append(tbl_header)


def add_section_heading(doc, text):
    table = doc.add_table(rows=1, cols=2)
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    table.autofit = False
    table.columns[0].width = Cm(0.16)
    table.columns[1].width = Cm(17.65)
    set_cell_shading(table.cell(0, 0), GOLD)
    set_cell_shading(table.cell(0, 1), PALE)
    for cell in table.rows[0].cells:
        set_cell_margins(cell, top=45, bottom=45, start=65, end=65)
        set_cell_border(cell, bottom={"val": "single", "sz": "5", "color": "D9E3EA"})
    paragraph = table.cell(0, 1).paragraphs[0]
    set_paragraph(paragraph, keep=True)
    add_text(paragraph, text, size=10.3, bold=True, color=DARK)
    return table


def add_bullet(doc, text, lead=None, after=1.3):
    paragraph = doc.add_paragraph()
    paragraph.style = doc.styles["Normal"]
    paragraph.paragraph_format.left_indent = Cm(0.42)
    paragraph.paragraph_format.first_line_indent = Cm(-0.30)
    set_paragraph(paragraph, after=after, line=1.09)
    add_text(paragraph, "• ", size=9.1, bold=True, color=TEAL)
    if lead and text.startswith(lead):
        add_text(paragraph, lead, size=9.1, bold=True, color=DARK)
        add_text(paragraph, text[len(lead):], size=9.1, color=TEXT)
    else:
        add_text(paragraph, text, size=9.1, color=TEXT)
    return paragraph


def add_role_header(doc, company, title, dates, subtitle):
    table = doc.add_table(rows=1, cols=2)
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    table.autofit = False
    table.columns[0].width = Cm(13.2)
    table.columns[1].width = Cm(4.6)
    for cell in table.rows[0].cells:
        set_cell_margins(cell, top=55, bottom=35, start=0, end=0)
        set_cell_border(cell, bottom={"val": "single", "sz": "4", "color": "C9D8E3"})
    left = table.cell(0, 0).paragraphs[0]
    set_paragraph(left, after=0, keep=True)
    add_text(left, company, size=10.2, bold=True, color=DARK)
    add_text(left, f"  |  {title}", size=9.4, bold=True, color=TEAL)
    right = table.cell(0, 1).paragraphs[0]
    right.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    set_paragraph(right, after=0, keep=True)
    add_text(right, dates, size=9.2, bold=True, color=MUTED)
    sub = doc.add_paragraph()
    set_paragraph(sub, after=1.2, line=1.0)
    add_text(sub, subtitle, size=8.5, color=MUTED)


def add_metric_strip(doc):
    data = [
        ("近5年", "销售与客户经营"),
        ("30万→40万", "区域月消耗 +约30%"),
        ("180→210家", "客户规模 +16.7%"),
        ("130%", "长期绩效达成"),
    ]
    table = doc.add_table(rows=1, cols=4)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    for idx, (metric, label) in enumerate(data):
        cell = table.cell(0, idx)
        cell.width = Cm(4.45)
        set_cell_shading(cell, LIGHT if idx % 2 == 0 else PALE)
        set_cell_margins(cell, top=90, bottom=80, start=70, end=70)
        set_cell_border(cell, bottom={"val": "single", "sz": "7", "color": TEAL})
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        set_paragraph(p, after=0, line=1.0)
        add_text(p, metric, size=11.2, bold=True, color=DARK)
        p.add_run().add_break()
        add_text(p, label, size=7.9, color=MUTED)


doc = Document()
section = doc.sections[0]
section.top_margin = Cm(1.05)
section.bottom_margin = Cm(0.90)
section.left_margin = Cm(1.35)
section.right_margin = Cm(1.35)
section.header_distance = Cm(0.45)
section.footer_distance = Cm(0.42)

styles = doc.styles
normal = styles["Normal"]
normal.font.name = FONT
normal._element.rPr.rFonts.set(qn("w:eastAsia"), FONT)
normal.font.size = Pt(9.1)
normal.font.color.rgb = RGBColor.from_string(TEXT)

header = doc.add_table(rows=1, cols=2)
header.alignment = WD_TABLE_ALIGNMENT.CENTER
header.autofit = False
header.columns[0].width = Cm(15.2)
header.columns[1].width = Cm(2.6)
left = header.cell(0, 0)
right = header.cell(0, 1)
for cell in (left, right):
    set_cell_margins(cell, top=0, bottom=100, start=0, end=0)
    set_cell_border(cell, bottom={"val": "single", "sz": "13", "color": DARK})

p = left.paragraphs[0]
set_paragraph(p, after=1.5, line=1.0)
add_text(p, "贺文杰", size=22, bold=True, color=DARK)
p = left.add_paragraph()
set_paragraph(p, after=1, line=1.0)
add_text(p, "AI解决方案销售  |  大模型/MaaS KA销售  |  企业服务销售", size=11.1, bold=True, color=TEAL)
p = left.add_paragraph()
set_paragraph(p, line=1.0)
add_text(p, "电话：18011771996   |   邮箱：549525716@qq.com   |   现居：广州", size=9.1, color=MUTED)

right.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
photo_p = right.paragraphs[0]
photo_p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
if PHOTO.exists():
    photo_p.add_run().add_picture(str(PHOTO), width=Cm(2.25))

add_section_heading(doc, "个人定位")
summary = doc.add_paragraph()
set_paragraph(summary, before=2, after=4, line=1.15)
add_text(summary, "近5年销售、客户经营与团队管理经验", size=9.5, bold=True, color=DARK)
add_text(summary, "，现负责懂车帝广州北汽车行业商户商业化运营。擅长从客户业务目标、获客链路和经营数据出发，识别关键人和决策路径，形成可量化的ROI方案，并通过持续运营、增购和流失召回推动收入增长。已用Codex、Excel、CRM和数据看板改造销售运营流程，具备转型大模型KA销售/AI解决方案销售的行业与方法论基础。", size=9.5, color=TEXT)

add_metric_strip(doc)

add_section_heading(doc, "核心能力")
skills = doc.add_table(rows=3, cols=2)
skills.alignment = WD_TABLE_ALIGNMENT.CENTER
skills.autofit = False
skills.columns[0].width = Cm(8.9)
skills.columns[1].width = Cm(8.9)
skill_items = [
    ("行业KA与决策链", "客户分层｜老板/负责人沟通｜关键人图谱｜商务推进"),
    ("场景诊断与价值销售", "业务问题拆解｜获客转化｜ROI测算｜经营复盘"),
    ("商机与客户经营", "新客开发｜存量增购｜流失召回｜客户成功"),
    ("解决方案协同", "需求澄清｜方案表达｜产品反馈｜跨团队闭环"),
    ("AI销售运营实践", "Codex｜CRM｜数据看板｜知识库问答｜自动化脚本"),
    ("团队管理", "目标拆解｜过程管理｜销售辅导｜人才培养"),
]
for idx, (title, detail) in enumerate(skill_items):
    cell = skills.cell(idx // 2, idx % 2)
    set_cell_shading(cell, PALE if idx % 2 == 0 else WHITE)
    set_cell_margins(cell, top=65, bottom=65, start=95, end=95)
    set_cell_border(cell, bottom={"val": "single", "sz": "3", "color": "D9E3EA"})
    p = cell.paragraphs[0]
    set_paragraph(p, line=1.08)
    add_text(p, title, size=8.9, bold=True, color=DARK)
    p.add_run().add_break()
    add_text(p, detail, size=8.2, color=MUTED)

add_section_heading(doc, "工作经历")
add_role_header(
    doc,
    "懂车帝",
    "商户运营 / 汽车行业营销解决方案",
    "2025.07－至今",
    "行业KA经营｜消耗型产品商业化｜客户诊断与ROI量化｜广州北",
)
add_bullet(doc, "经营增长：负责约180家汽车行业商户的开发、运营与回捞，推动客户规模增至210家、净增30家（+16.7%）；区域月消耗由约30万元增至40万元（+约30%）。", "经营增长：")
add_bullet(doc, "解决方案销售：建立“业务现状—获客链路—投放组合—成交转化—ROI测算”诊断框架，输出经营分析、客户诊断、ROI测算、月度建议及老板沟通PPT。", "解决方案销售：")
add_bullet(doc, "标杆客户：针对头部二手车客户获客受阻，联合获客负责人拆解线索与成交差距，以行业案例、平台数据和ROI推动老板决策；客户从0提升至约600条线索/月、20–25台成交/月、1.6–2万元月消耗，转化率3%–4%，稳定6个月。", "标杆客户：")
add_bullet(doc, "存量经营：累计触达近30家沉默客户，召回成功率70%–80%；召回约20家、个人直接开发9家，贡献月度约20%业务增量。", "存量经营：")
add_bullet(doc, "决策链与协同：面向老板、区域经理、店长和运营设计差异化价值表达；协同产品、客服和运营闭环Bug、数据复盘、客户需求及客诉，提升持续消耗意愿。", "决策链与协同：")
add_bullet(doc, "业绩表现：综合目标长期约130%，最高单月实际完成180%；获得M+和M绩效，M+对应公司前20%门槛。", "业绩表现：", after=2)

doc.add_page_break()

add_section_heading(doc, "AI / 技术实践")
add_role_header(
    doc,
    "个人项目",
    "AI辅助客户经营分析与拜访规划",
    "持续迭代",
    "Codex｜Excel｜CRM｜数据看板｜销售运营提效",
)
add_bullet(doc, "将客户坐标、历史消耗、客户状态和商机阶段标签结构化，输出客户分层、高优先级拜访清单、路线规划、月度目标拆解和机会预测。")
add_bullet(doc, "沉淀固定Prompt、数据模板和SOP，把路线规划、客户复盘和机会判断从人工经验升级为数据与AI辅助决策，每天节省约1–2小时。")
add_bullet(doc, "完成话术知识库问答、经营分析助手、销售数据汇总脚本和路线规划等简单Demo；可阅读API文档，理解Token、上下文、RAG、Agent和多模态等基础概念。")

add_section_heading(doc, "销售管理与一线销售经历")
add_role_header(
    doc,
    "乐道汽车",
    "店长",
    "2024.03－2025.06",
    "门店销售管理｜下沉市场0-1开拓｜团队带教｜渠道增长",
)
add_bullet(doc, "主导广东湛江、安徽芜湖下沉市场开拓，参与立项、目标拆解、渠道搭建、落地与复盘，形成异业合作、自媒体IP和入企品宣等增量模型。")
add_bullet(doc, "团队季度目标完成率超过200%，月人效5–7台，业绩保持大区前3、全国前10；下沉市场增量订单多次超过目标150%。")
add_bullet(doc, "推动自媒体订单占比0%→10%、企业员工订单6%→10%、置换订单8%→14%；项目费效比超过区域目标200%。")
add_bullet(doc, "累计带教21人，培养10人晋升；团队成员在广州、安徽区域多次获得销冠。", after=2)

add_role_header(
    doc,
    "特斯拉",
    "销售主管",
    "2022.07－2023.12",
    "门店销售｜自媒体获客｜企业大客户活动｜销售过程管理",
)
add_bullet(doc, "华南区约600名销售中连续两个季度保持销冠（前1%）；在职9个月交付超过600台，最高单日销售23台。")
add_bullet(doc, "搭建线上与自媒体获客体系，沉淀约5000名微信客户并运营4个500人意向群；每周开展3–4场直播并复盘留资与转化数据。")
add_bullet(doc, "负责置换项目管理，标准化话术、服务商KPI和复盘机制，使置换线索转化率5%→10%、置换订单占比8%→14%。")
add_bullet(doc, "策划企业试驾会、员工活动和亲子活动；培养5名员工转正，团队由华南后10%提升至前30%。", after=2)

add_section_heading(doc, "AI销售岗位匹配摘要")
match_table = doc.add_table(rows=4, cols=2)
match_table.alignment = WD_TABLE_ALIGNMENT.CENTER
match_table.autofit = False
match_table.columns[0].width = Cm(4.0)
match_table.columns[1].width = Cm(13.8)
match_rows = [
    ("行业KA销售", "有汽车/零售客户经营、关键人沟通、客户分层、新客开发和存量增购证据"),
    ("需求与方案", "能从业务目标、获客链路和经营数据识别场景，并形成ROI方案与管理层沟通材料"),
    ("客户成功", "有上线陪跑、经营复盘、流失召回、产品反馈和跨团队问题闭环经验"),
    ("AI原生工作方式", "已把AI工具用于客户经营、销售规划和数据分析，可继续补齐API Demo与POC证据"),
]
for idx, (label, detail) in enumerate(match_rows):
    c1, c2 = match_table.rows[idx].cells
    set_cell_shading(c1, LIGHT)
    set_cell_shading(c2, WHITE if idx % 2 else PALE)
    for cell in (c1, c2):
        set_cell_margins(cell, top=65, bottom=65, start=95, end=95)
        set_cell_border(cell, bottom={"val": "single", "sz": "3", "color": "D9E3EA"})
    p1 = c1.paragraphs[0]
    set_paragraph(p1, line=1.05)
    add_text(p1, label, size=8.8, bold=True, color=DARK)
    p2 = c2.paragraphs[0]
    set_paragraph(p2, line=1.05)
    add_text(p2, detail, size=8.6, color=TEXT)

add_section_heading(doc, "教育经历")
education = doc.add_table(rows=2, cols=3)
education.alignment = WD_TABLE_ALIGNMENT.CENTER
education.autofit = False
education.columns[0].width = Cm(4.0)
education.columns[1].width = Cm(9.5)
education.columns[2].width = Cm(4.3)
education_rows = [
    ("2020.09－2022.06", "广东培正学院", "行政管理｜本科"),
    ("2016.09－2019.06", "广东工商学院", "金融管理｜专科"),
]
for idx, values in enumerate(education_rows):
    for col, value in enumerate(values):
        cell = education.cell(idx, col)
        set_cell_margins(cell, top=55, bottom=55, start=70, end=70)
        set_cell_border(cell, bottom={"val": "single", "sz": "3", "color": "D9E3EA"})
        p = cell.paragraphs[0]
        set_paragraph(p, line=1.0)
        add_text(p, value, size=8.8, bold=(col == 1), color=DARK if col == 1 else MUTED)

for section in doc.sections:
    footer = section.footer
    p = footer.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    set_paragraph(p, line=1.0)
    add_text(p, "贺文杰｜AI解决方案销售定向简历｜2026-07-20", size=7.5, color=MUTED)

doc.core_properties.title = "贺文杰_AI大模型解决方案销售_BOSS市场定向版"
doc.core_properties.subject = "AI解决方案销售 / 大模型KA销售"
doc.core_properties.author = "贺文杰"
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
doc.save(OUTPUT)
print(OUTPUT)
