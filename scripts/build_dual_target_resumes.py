from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Inches, Pt, RGBColor


OUTPUT_DIR = Path("/Users/MR/Documents/职场/03_简历")
PHOTO_PATH = Path("/Users/MR/Desktop/面试/证件照.jpg")
FONT = "PingFang SC"
INK = RGBColor(31, 45, 61)
TEAL = RGBColor(0, 121, 116)
MUTED = RGBColor(92, 107, 122)
LIGHT = RGBColor(216, 226, 232)


def set_cell_font(run, size=9.3, bold=False, color=INK):
    run.font.name = FONT
    run._element.get_or_add_rPr().rFonts.set(qn("w:eastAsia"), FONT)
    run.font.size = Pt(size)
    run.bold = bold
    run.font.color.rgb = color


def configure_styles(doc):
    normal = doc.styles["Normal"]
    normal.font.name = FONT
    normal._element.rPr.rFonts.set(qn("w:ascii"), FONT)
    normal._element.rPr.rFonts.set(qn("w:hAnsi"), FONT)
    normal._element.rPr.rFonts.set(qn("w:eastAsia"), FONT)
    normal.font.size = Pt(9.3)
    normal.font.color.rgb = INK
    normal.paragraph_format.space_before = Pt(0)
    normal.paragraph_format.space_after = Pt(2.5)
    normal.paragraph_format.line_spacing = 1.12

    for name, size, color, before, after in [
        ("Heading 1", 11.5, TEAL, 7, 3),
        ("Heading 2", 10.2, INK, 4, 1.5),
    ]:
        style = doc.styles[name]
        style.font.name = FONT
        style._element.rPr.rFonts.set(qn("w:ascii"), FONT)
        style._element.rPr.rFonts.set(qn("w:hAnsi"), FONT)
        style._element.rPr.rFonts.set(qn("w:eastAsia"), FONT)
        style.font.size = Pt(size)
        style.font.bold = True
        style.font.color.rgb = color
        style.paragraph_format.space_before = Pt(before)
        style.paragraph_format.space_after = Pt(after)
        style.paragraph_format.keep_with_next = True


def add_numbering(doc):
    numbering = doc.part.numbering_part.element
    abstract = OxmlElement("w:abstractNum")
    abstract.set(qn("w:abstractNumId"), "77")
    multi = OxmlElement("w:multiLevelType")
    multi.set(qn("w:val"), "singleLevel")
    abstract.append(multi)

    level = OxmlElement("w:lvl")
    level.set(qn("w:ilvl"), "0")
    start = OxmlElement("w:start")
    start.set(qn("w:val"), "1")
    level.append(start)
    num_fmt = OxmlElement("w:numFmt")
    num_fmt.set(qn("w:val"), "bullet")
    level.append(num_fmt)
    lvl_text = OxmlElement("w:lvlText")
    lvl_text.set(qn("w:val"), "•")
    level.append(lvl_text)
    lvl_jc = OxmlElement("w:lvlJc")
    lvl_jc.set(qn("w:val"), "left")
    level.append(lvl_jc)

    p_pr = OxmlElement("w:pPr")
    tabs = OxmlElement("w:tabs")
    tab = OxmlElement("w:tab")
    tab.set(qn("w:val"), "num")
    tab.set(qn("w:pos"), "300")
    tabs.append(tab)
    p_pr.append(tabs)
    ind = OxmlElement("w:ind")
    ind.set(qn("w:left"), "300")
    ind.set(qn("w:hanging"), "220")
    p_pr.append(ind)
    level.append(p_pr)

    r_pr = OxmlElement("w:rPr")
    fonts = OxmlElement("w:rFonts")
    fonts.set(qn("w:ascii"), FONT)
    fonts.set(qn("w:hAnsi"), FONT)
    fonts.set(qn("w:eastAsia"), FONT)
    r_pr.append(fonts)
    level.append(r_pr)
    abstract.append(level)
    numbering.append(abstract)

    num = OxmlElement("w:num")
    num.set(qn("w:numId"), "77")
    abstract_id = OxmlElement("w:abstractNumId")
    abstract_id.set(qn("w:val"), "77")
    num.append(abstract_id)
    numbering.append(num)


def apply_bullet(paragraph):
    p_pr = paragraph._p.get_or_add_pPr()
    num_pr = OxmlElement("w:numPr")
    ilvl = OxmlElement("w:ilvl")
    ilvl.set(qn("w:val"), "0")
    num_id = OxmlElement("w:numId")
    num_id.set(qn("w:val"), "77")
    num_pr.append(ilvl)
    num_pr.append(num_id)
    p_pr.append(num_pr)
    paragraph.paragraph_format.left_indent = Cm(0.53)
    paragraph.paragraph_format.first_line_indent = Cm(-0.38)
    paragraph.paragraph_format.space_after = Pt(1.8)
    paragraph.paragraph_format.line_spacing = 1.08


def add_decimal_numbering(doc, num_id):
    numbering = doc.part.numbering_part.element
    abstract = OxmlElement("w:abstractNum")
    abstract.set(qn("w:abstractNumId"), str(num_id))

    multi = OxmlElement("w:multiLevelType")
    multi.set(qn("w:val"), "singleLevel")
    abstract.append(multi)

    level = OxmlElement("w:lvl")
    level.set(qn("w:ilvl"), "0")
    start = OxmlElement("w:start")
    start.set(qn("w:val"), "1")
    level.append(start)
    num_fmt = OxmlElement("w:numFmt")
    num_fmt.set(qn("w:val"), "decimal")
    level.append(num_fmt)
    lvl_text = OxmlElement("w:lvlText")
    lvl_text.set(qn("w:val"), "%1）")
    level.append(lvl_text)
    lvl_jc = OxmlElement("w:lvlJc")
    lvl_jc.set(qn("w:val"), "left")
    level.append(lvl_jc)

    p_pr = OxmlElement("w:pPr")
    ind = OxmlElement("w:ind")
    ind.set(qn("w:left"), "430")
    ind.set(qn("w:hanging"), "300")
    p_pr.append(ind)
    level.append(p_pr)

    r_pr = OxmlElement("w:rPr")
    fonts = OxmlElement("w:rFonts")
    fonts.set(qn("w:ascii"), FONT)
    fonts.set(qn("w:hAnsi"), FONT)
    fonts.set(qn("w:eastAsia"), FONT)
    r_pr.append(fonts)
    level.append(r_pr)
    abstract.append(level)
    numbering.append(abstract)

    num = OxmlElement("w:num")
    num.set(qn("w:numId"), str(num_id))
    abstract_id = OxmlElement("w:abstractNumId")
    abstract_id.set(qn("w:val"), str(num_id))
    num.append(abstract_id)
    numbering.append(num)


def apply_numbered(paragraph, num_id):
    p_pr = paragraph._p.get_or_add_pPr()
    num_pr = OxmlElement("w:numPr")
    ilvl = OxmlElement("w:ilvl")
    ilvl.set(qn("w:val"), "0")
    num_id_node = OxmlElement("w:numId")
    num_id_node.set(qn("w:val"), str(num_id))
    num_pr.append(ilvl)
    num_pr.append(num_id_node)
    p_pr.append(num_pr)
    paragraph.paragraph_format.left_indent = Cm(0.76)
    paragraph.paragraph_format.first_line_indent = Cm(-0.52)
    paragraph.paragraph_format.space_after = Pt(4)
    paragraph.paragraph_format.line_spacing = 1.22


def paragraph_rule(paragraph, color="D8E2E8", size="8"):
    p_pr = paragraph._p.get_or_add_pPr()
    p_bdr = p_pr.find(qn("w:pBdr"))
    if p_bdr is None:
        p_bdr = OxmlElement("w:pBdr")
        p_pr.append(p_bdr)
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), size)
    bottom.set(qn("w:space"), "2")
    bottom.set(qn("w:color"), color)
    p_bdr.append(bottom)


def add_run(paragraph, text, size=9.3, bold=False, color=INK):
    run = paragraph.add_run(text)
    set_cell_font(run, size=size, bold=bold, color=color)
    return run


def add_header(doc, target):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(1)
    add_run(p, "贺文杰", size=20, bold=True, color=INK)

    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(2.5)
    add_run(p, target, size=11.2, bold=True, color=TEAL)

    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(5)
    add_run(
        p,
        "广州｜18011771996｜549525716@qq.com｜可接受深圳 / 广州及必要出差",
        size=9.1,
        color=MUTED,
    )
    paragraph_rule(p, color="007974", size="12")


def set_cell_width(cell, width_cm):
    width_twips = int(Cm(width_cm).twips)
    cell.width = Cm(width_cm)
    tc_pr = cell._tc.get_or_add_tcPr()
    tc_w = tc_pr.find(qn("w:tcW"))
    if tc_w is None:
        tc_w = OxmlElement("w:tcW")
        tc_pr.append(tc_w)
    tc_w.set(qn("w:w"), str(width_twips))
    tc_w.set(qn("w:type"), "dxa")


def set_cell_margins(cell, top=0, start=0, bottom=0, end=0):
    tc_pr = cell._tc.get_or_add_tcPr()
    tc_mar = tc_pr.find(qn("w:tcMar"))
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for edge, value in (
        ("top", top),
        ("start", start),
        ("bottom", bottom),
        ("end", end),
    ):
        node = tc_mar.find(qn(f"w:{edge}"))
        if node is None:
            node = OxmlElement(f"w:{edge}")
            tc_mar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def remove_table_borders(table):
    tbl_pr = table._tbl.tblPr
    borders = tbl_pr.find(qn("w:tblBorders"))
    if borders is not None:
        tbl_pr.remove(borders)
    borders = OxmlElement("w:tblBorders")
    tbl_pr.append(borders)
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        node = OxmlElement(f"w:{edge}")
        node.set(qn("w:val"), "none")
        node.set(qn("w:sz"), "0")
        node.set(qn("w:space"), "0")
        node.set(qn("w:color"), "FFFFFF")
        borders.append(node)


def remove_cell_borders(cell):
    tc_pr = cell._tc.get_or_add_tcPr()
    borders = tc_pr.find(qn("w:tcBorders"))
    if borders is not None:
        tc_pr.remove(borders)
    borders = OxmlElement("w:tcBorders")
    tc_pr.append(borders)
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        node = OxmlElement(f"w:{edge}")
        node.set(qn("w:val"), "none")
        node.set(qn("w:sz"), "0")
        node.set(qn("w:space"), "0")
        node.set(qn("w:color"), "FFFFFF")
        borders.append(node)


def add_header_with_photo(doc, target, photo_path):
    table = doc.add_table(rows=1, cols=2)
    table.style = None
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    table.autofit = False
    layout = OxmlElement("w:tblLayout")
    layout.set(qn("w:type"), "fixed")
    table._tbl.tblPr.append(layout)
    remove_table_borders(table)

    left, right = table.rows[0].cells
    set_cell_width(left, 15.3)
    set_cell_width(right, 2.6)
    set_cell_margins(left)
    set_cell_margins(right)
    remove_cell_borders(left)
    remove_cell_borders(right)
    left.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
    right.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER

    p = left.paragraphs[0]
    p.paragraph_format.space_after = Pt(1)
    add_run(p, "贺文杰", size=20, bold=True, color=INK)

    p = left.add_paragraph()
    p.paragraph_format.space_after = Pt(2.5)
    add_run(p, target, size=10.8, bold=True, color=TEAL)

    p = left.add_paragraph()
    p.paragraph_format.space_after = Pt(0)
    add_run(
        p,
        "广州｜18011771996｜549525716@qq.com｜深圳 / 广州",
        size=9.1,
        color=MUTED,
    )

    p = right.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p.paragraph_format.space_after = Pt(0)
    shape = p.add_run().add_picture(str(photo_path), width=Cm(2.15), height=Cm(2.87))
    shape._inline.docPr.set("descr", "贺文杰证件照")

    rule = doc.add_paragraph()
    rule.paragraph_format.space_before = Pt(0)
    rule.paragraph_format.space_after = Pt(5)
    paragraph_rule(rule, color="007974", size="12")


def add_section_title(doc, text):
    p = doc.add_paragraph(style="Heading 1")
    add_run(p, text, size=11.5, bold=True, color=TEAL)
    paragraph_rule(p, color="D8E2E8", size="5")


def add_summary(doc, text, items=None):
    add_section_title(doc, "职业概述")
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(1.8 if items else 3)
    add_run(p, text, size=9.4, color=INK)
    for label, detail in items or []:
        p = doc.add_paragraph()
        apply_bullet(p)
        add_run(p, f"{label}：", bold=True, color=INK)
        add_run(p, detail)


def add_strengths(doc, items):
    add_section_title(doc, "核心能力")
    for label, detail in items:
        p = doc.add_paragraph()
        apply_bullet(p)
        add_run(p, f"{label}：", bold=True, color=INK)
        add_run(p, detail)


def add_role(doc, company, title, dates, subtitle, bullets):
    p = doc.add_paragraph(style="Heading 2")
    add_run(p, f"{company}｜{title}｜", size=10.2, bold=True, color=INK)
    add_run(p, dates, size=9.1, bold=True, color=MUTED)

    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(1.5)
    add_run(p, subtitle, size=8.9, bold=True, color=TEAL)

    for bullet in bullets:
        p = doc.add_paragraph()
        apply_bullet(p)
        if "：" in bullet:
            label, detail = bullet.split("：", 1)
            add_run(p, f"{label}：", bold=True)
            add_run(p, detail)
        else:
            add_run(p, bullet)


def configure_readable_resume(doc):
    normal = doc.styles["Normal"]
    normal.font.size = Pt(10.2)
    normal.paragraph_format.space_after = Pt(4)
    normal.paragraph_format.line_spacing = 1.22

    heading_1 = doc.styles["Heading 1"]
    heading_1.font.size = Pt(12.5)
    heading_1.paragraph_format.space_before = Pt(8)
    heading_1.paragraph_format.space_after = Pt(4)

    heading_2 = doc.styles["Heading 2"]
    heading_2.font.size = Pt(11.2)
    heading_2.paragraph_format.space_before = Pt(6)
    heading_2.paragraph_format.space_after = Pt(2)


def add_summary_readable(doc, text, items):
    add_section_title(doc, "职业概述")
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.line_spacing = 1.22
    add_run(p, text, size=10.2)
    for label, detail in items:
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.line_spacing = 1.22
        add_run(p, f"{label}：", size=10.1, bold=True)
        add_run(p, detail, size=10.1)


def add_strengths_readable(doc, items):
    add_section_title(doc, "核心能力")
    for label, detail in items:
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(3.4)
        p.paragraph_format.line_spacing = 1.2
        add_run(p, f"{label}：", size=10, bold=True)
        add_run(p, detail, size=10)


def add_role_readable(doc, company, title, dates, subtitle, sections, num_id):
    add_decimal_numbering(doc, num_id)

    p = doc.add_paragraph(style="Heading 2")
    add_run(p, f"{company}｜{title}｜", size=11.2, bold=True)
    add_run(p, dates, size=9.8, bold=True, color=MUTED)

    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(3)
    add_run(p, subtitle, size=9.5, bold=True, color=TEAL)

    for label, items, numbered in sections:
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(3.5)
        p.paragraph_format.space_after = Pt(1.8)
        p.paragraph_format.keep_with_next = True
        add_run(p, label, size=10.3, bold=True, color=INK)

        for item in items:
            p = doc.add_paragraph()
            if numbered:
                apply_numbered(p, num_id)
            else:
                apply_bullet(p)
                p.paragraph_format.space_after = Pt(4)
                p.paragraph_format.line_spacing = 1.22
            add_run(p, item, size=10.1)

    spacer = doc.add_paragraph()
    spacer.paragraph_format.space_after = Pt(3)


def add_ai_project(doc, title, bullets):
    add_section_title(doc, "AI / 技术实践")
    add_role(
        doc,
        "个人能力验证项目",
        title,
        "持续迭代",
        "Codex｜Excel｜CRM｜数据看板｜Prompt / SOP｜API 文档理解",
        bullets,
    )


def add_education(doc):
    add_section_title(doc, "教育经历")
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(1)
    add_run(p, "2020.09—2022.06　广东培正学院　行政管理｜本科", bold=True)
    p = doc.add_paragraph()
    add_run(p, "2016.09—2019.06　广东工商学院　金融管理｜专科", color=MUTED)


def setup_document():
    doc = Document()
    section = doc.sections[0]
    section.page_width = Cm(21.0)
    section.page_height = Cm(29.7)
    section.top_margin = Cm(1.25)
    section.bottom_margin = Cm(1.15)
    section.left_margin = Cm(1.55)
    section.right_margin = Cm(1.55)
    section.header_distance = Cm(0.6)
    section.footer_distance = Cm(0.6)
    configure_styles(doc)
    add_numbering(doc)
    return doc


COMMON_LEDAO = [
    "0-1市场开拓：主导广东湛江、安徽芜湖下沉市场开拓，形成异业合作、自媒体 IP 与入企品宣等增量路径。",
    "团队经营：团队季度目标完成率超过 200%，月人效 5–7 台，业绩保持大区前 3、全国前 10。",
    "渠道验证与复制：自媒体订单占比 0%→10%、企业员工订单 6%→10%、置换订单 8%→14%；带教 21 人，培养 10 人晋升。",
]

COMMON_TESLA = [
    "销售结果：在华南区约 600 名销售中连续两个季度保持销冠（前 1%）；核心销售期 9 个月交付超过 600 台。",
    "私域与内容获客：沉淀约 5000 名微信客户并运营 4 个 500 人意向群；每周开展 3–4 场直播并复盘转化数据。",
    "过程优化：置换线索转化率由 5%→10%，置换订单占比由 8%→14%；团队由华南后 10% 提升至前 30%。",
]


def build_minimax():
    doc = setup_document()
    add_header(doc, "大模型 KA 客户经理｜AI 解决方案销售｜企业服务")
    add_summary(
        doc,
        "4 年汽车行业与互联网广告媒体平台销售、KA 客户经营及团队管理经验。现负责懂车帝广州区域汽车商户商业化，覆盖老板、负责人、店长和运营等关键角色，围绕获客链路、方案组合与 ROI 推动客户从开发/激活、上线陪跑到持续消耗与增购。区域月消耗 30 万→40 万，客户规模 180→210；具备大模型 API、RAG、Agent 基础认知和 AI 销售运营 Demo 实践。",
    )
    add_strengths(
        doc,
        [
            ("行业 KA 与决策链", "客户分层、关键人识别、老板/负责人沟通、客户拜访与长期关系经营"),
            ("需求诊断与方案协同", "业务现状拆解、获客漏斗分析、ROI 测算、经营方案与上线陪跑"),
            ("客户全生命周期", "新客开发、存量增购、流失召回、经营复盘及客户成功"),
            ("AI / 技术对话基础", "API 文档阅读，理解 Token、RAG、Agent，并完成销售场景能力验证 Demo"),
        ],
    )
    add_section_title(doc, "工作经历")
    add_role(
        doc,
        "懂车帝",
        "商户运营（行业 KA / 商业化）",
        "2025.07—至今",
        "汽车行业营销解决方案｜广告媒体平台商业化｜客户诊断与 ROI 量化｜广州区域",
        [
            "经营结果：负责约 180 家汽车商户的开发、运营与回捞，推动客户规模增至 210 家（+16.7%）；区域月消耗由约 30 万元提升至 40 万元（+约 30%），综合目标长期约 130%。",
            "决策链经营：围绕老板、负责人、店长及运营等角色建立客户分层和拜访节奏，识别业务目标、预算关注点与经营阻力。",
            "解决方案销售：建立“业务现状—获客链路—投放组合—成交转化—ROI 测算”诊断框架，输出经营分析、客户诊断和管理层沟通材料。",
            "标杆客户：推动头部客户线索量由 270 提升至约 600 条/月，成交 20–25 台/月，连续稳定经营 6 个月。",
            "全生命周期：累计触达近 60 家沉默客户，召回成功率 30%–40%；召回约 20 家、个人直接开发 10 家，贡献月度约 20% 业务增量。",
            "跨团队协同：协同产品、客服与运营处理客户问题、需求反馈和经营复盘，推动方案落地及持续消耗。",
        ],
    )
    add_role(
        doc,
        "乐道汽车",
        "店长",
        "2024.03—2025.06",
        "门店销售管理｜下沉市场 0-1｜团队带教｜渠道增长",
        COMMON_LEDAO,
    )
    add_role(
        doc,
        "特斯拉",
        "销售主管",
        "2022.07—2023.12",
        "门店销售｜私域获客｜企业客户活动｜销售过程管理",
        COMMON_TESLA,
    )
    add_ai_project(
        doc,
        "AI 辅助客户经营与销售运营",
        [
            "经营分析：结构化客户坐标、历史消耗、客户状态与商机阶段，输出客户分层、高优先级拜访清单和机会预测。",
            "流程提效：沉淀固定 Prompt、数据模板与 SOP，将路线规划、客户复盘和机会判断升级为 AI 辅助决策，每天节省约 1–2 小时。",
            "能力验证：完成话术知识库问答、经营分析助手、销售数据汇总脚本和拜访路线规划；可阅读 API 文档并理解 Token、RAG、Agent 基础概念。该项目为个人实践，不是客户级 POC。",
        ],
    )
    add_education(doc)
    path = OUTPUT_DIR / "贺文杰_大模型KA客户经理_MiniMax定向优化版.docx"
    doc.save(path)
    return path


def build_business_builder():
    doc = setup_document()
    add_header(doc, "AI 商业化 / Business Builder｜生态 BD｜ToB 增长")
    add_summary(
        doc,
        "4 年商业化、客户增长与销售管理经验，在懂车帝、乐道和特斯拉完成互联网平台收入增长、下沉市场 0-1 和多渠道增长模型验证。现通过客户分层、ROI 方案、商机节奏和经营复盘推动区域月消耗 30 万→40 万；持续使用 Codex、CRM 和数据看板搭建销售 AI 工作流与 Demo，目标是将已验证的商业化、0-1 和结果管理能力迁移到 AI 产品及生态商业化。",
    )
    add_strengths(
        doc,
        [
            ("商业假设与验证", "从业务问题出发设计获客、渠道和经营方案，用转化、消耗及目标结果验证"),
            ("Pipeline 与收入结果", "客户分层、商机阶段、机会预测、经营复盘，推动月消耗增长约 30%"),
            ("0-1 与方法复制", "下沉市场开拓、多渠道模型验证、SOP 沉淀、团队带教和规模化执行"),
            ("AI Native 实践", "将 Codex、数据模板、CRM 和知识库用于销售规划、客户经营与流程提效"),
        ],
    )
    add_section_title(doc, "工作经历")
    add_role(
        doc,
        "懂车帝",
        "商户运营（商业化 / 行业 KA）",
        "2025.07—至今",
        "互联网广告媒体平台｜客户商业化增长｜商机管理｜ROI 量化",
        [
            "收入增长：负责约 180 家汽车商户的开发、运营和回捞，推动客户规模增至 210 家；区域月消耗由约 30 万元提升至 40 万元（+约 30%），综合目标长期约 130%。",
            "商业化诊断：建立“业务现状—获客链路—投放组合—成交转化—ROI”框架，将客户问题转化为可执行的经营方案和管理层沟通材料。",
            "路径验证：推动头部客户线索量 270→约 600 条/月、成交 20–25 台/月，并通过持续复盘稳定经营 6 个月。",
            "Pipeline 管理：结构化客户分层、商机阶段、拜访优先级和经营阻力，累计触达近 60 家沉默客户，召回约 20 家、直接开发 10 家。",
            "打法沉淀：将客户诊断、ROI 测算、拜访节奏和经营复盘沉淀为模板与 SOP，支持团队复用。",
        ],
    )
    add_role(
        doc,
        "乐道汽车",
        "店长",
        "2024.03—2025.06",
        "下沉市场 0-1｜增长模型验证｜资源整合｜团队复制",
        [
            "0-1开拓：主导广东湛江、安徽芜湖下沉市场，围绕异业合作、自媒体 IP、入企品宣和置换设计并验证增量路径。",
            "结果验证：团队季度目标完成率超过 200%，月人效 5–7 台，业绩保持大区前 3、全国前 10。",
            "模型复制：自媒体订单占比 0%→10%、企业员工订单 6%→10%、置换订单 8%→14%；将有效打法纳入团队节奏。",
            "组织放大：累计带教 21 人、培养 10 人晋升，通过目标拆解、过程复盘和能力训练提升团队执行。",
        ],
    )
    add_role(
        doc,
        "特斯拉",
        "销售主管",
        "2022.07—2023.12",
        "强结果销售｜私域增长｜内容获客｜销售过程管理",
        COMMON_TESLA,
    )
    add_ai_project(
        doc,
        "AI 商业化能力验证与销售工作流",
        [
            "AI Native 工作方式：用 Codex、Excel、CRM 和数据看板辅助客户分层、机会判断、销售规划及复盘，每天节省约 1–2 小时。",
            "可复用产物：沉淀 Prompt、数据模板和 SOP，完成经营分析助手、话术知识库问答、销售数据汇总脚本及拜访路线规划。",
            "产品理解：可阅读 API 文档，理解 Token、RAG、Agent 等基础概念，并能从目标客户、业务问题、价值指标和采用风险拆解 AI 场景。以上为个人能力验证，不是实际 AI 签约或客户 POC。",
        ],
    )
    add_education(doc)
    path = OUTPUT_DIR / "贺文杰_AI商业化_BusinessBuilder定向优化版.docx"
    doc.save(path)
    return path


def build_common_v2():
    doc = setup_document()
    add_header(
        doc,
        "大模型商业化 / 行业 KA｜AI 解决方案销售｜Business Development",
    )
    add_summary(
        doc,
        "4 年汽车行业与互联网广告媒体平台商业化、行业 KA 及销售管理经验。面向老板、负责人、店长和运营等角色，围绕获客链路、经营数据和 ROI 完成客户分层、需求诊断、方案沟通、上线陪跑及持续消耗；区域月消耗 30 万→40 万、客户规模 180→210。基于真实汽车商户场景完成“大模型线索经营助手”个人能力验证，形成客户场景、AI 能力映射、POC 指标和商业价值测算，目标转向大模型 KA 与 AI 商业化岗位。",
    )
    add_strengths(
        doc,
        [
            (
                "行业洞察与决策链",
                "理解汽车零售、二手车、广告投放和线索转化，覆盖老板、负责人、店长及运营等关键角色",
            ),
            (
                "场景发现与价值方案",
                "从业务问题和经营数据识别机会，形成获客漏斗、方案组合、成功指标与 ROI 逻辑",
            ),
            (
                "Pipeline 与项目推进",
                "客户分层、商机阶段、拜访节奏、上线陪跑、经营复盘、增购和流失召回",
            ),
            (
                "AI 产品与技术基础",
                "理解大模型 API、Token、RAG、Agent 基础边界，能将模型能力映射到客户业务流程",
            ),
            (
                "结果责任与路径复制",
                "对收入和目标负责，通过数据验证有效打法，并沉淀模板、SOP 和团队复制机制",
            ),
        ],
    )
    add_section_title(doc, "AI 商业化能力验证")
    add_role(
        doc,
        "个人项目",
        "汽车商户大模型线索经营助手",
        "持续迭代",
        "行业场景｜大模型 API｜RAG｜Agent｜POC 设计｜商业价值测算",
        [
            "场景来源：基于真实头部二手车客户每月约 600 条线索、20–25 台成交的经营漏斗，识别线索标签不统一、跟进依赖个人经验、业务知识分散和过程不可视等共性问题。",
            "产品方案：将大模型意图识别、RAG 业务知识检索、下一步跟进建议和 CRM 记录回写映射到线索经营流程，明确人工确认、低置信度转人工和敏感数据脱敏边界。",
            "验证设计：完成输入输出样例、数据字段、14 天 POC 范围及验收指标设计，指标覆盖高意向识别准确率、跟进完成率、响应时间和报表人效。",
            "商业化思考：区分使用人、业务负责人和预算人，以业务增量和人效作为价值指标，形成从场景访谈、方案演示到付费 POC 的推进框架。",
            "项目边界：该项目为个人能力验证，未作为真实客户签约或客户级 POC 业绩。",
        ],
    )
    add_section_title(doc, "工作经历")
    add_role(
        doc,
        "懂车帝",
        "商户运营（行业 KA / 商业化）",
        "2025.07—至今",
        "汽车行业营销解决方案｜互联网广告媒体平台｜客户经营与 ROI 量化｜广州区域",
        [
            "客户洞察与决策链：负责约 180 家汽车商户，围绕老板、负责人、店长和运营等角色建立客户分层与拜访节奏，识别获客目标、预算关注点和经营阻力。",
            "价值方案：建立“业务现状—获客链路—投放组合—成交转化—ROI”诊断框架，将客户问题转化为经营方案、成功指标和管理层沟通材料。",
            "收入结果：推动客户规模增至 210 家（+16.7%），区域月消耗由约 30 万元提升至 40 万元（+约 30%），综合目标长期约 130%。",
            "案例验证：推动头部客户线索量由 270 提升至约 600 条/月、成交 20–25 台/月，并通过持续复盘稳定经营 6 个月。",
            "Pipeline 与协同：累计触达近 60 家沉默客户，召回约 20 家、直接开发 10 家；协同产品、客服和运营处理需求反馈、方案落地及持续经营。",
        ],
    )
    add_role(
        doc,
        "乐道汽车",
        "店长",
        "2024.03—2025.06",
        "下沉市场 0-1｜增长路径验证｜资源协同｜团队复制",
        [
            "0-1与验证：主导广东湛江、安徽芜湖下沉市场开拓，围绕异业、自媒体、入企品宣和置换设计并验证增量路径。",
            "结果与复制：团队季度目标完成率超过 200%，自媒体订单占比 0%→10%、企业员工订单 6%→10%、置换订单 8%→14%。",
            "组织放大：带教 21 人、培养 10 人晋升，通过目标拆解、过程复盘和能力训练推动有效打法进入团队节奏。",
        ],
    )
    add_role(
        doc,
        "特斯拉",
        "销售主管",
        "2022.07—2023.12",
        "强结果销售｜客户池经营｜内容获客｜销售过程管理",
        [
            "销售结果：在华南区约 600 名销售中连续两个季度保持销冠（前 1%）；核心销售期 9 个月交付超过 600 台。",
            "客户经营：沉淀约 5000 名微信客户并运营 4 个 500 人意向群；每周开展 3–4 场直播并复盘转化数据。",
            "过程优化：置换线索转化率由 5%→10%、置换订单占比由 8%→14%；团队由华南后 10% 提升至前 30%。",
        ],
    )
    add_education(doc)
    path = OUTPUT_DIR / "贺文杰_大模型商业化与KA销售_双岗位交叉能力版_V2.docx"
    doc.save(path)
    return path


def build_common_v5_project_evidence(with_photo=False):
    doc = setup_document()
    target = "大模型商业化 / 行业 KA｜AI 解决方案销售｜Business Development"
    if with_photo:
        add_header_with_photo(
            doc,
            "大模型商业化 / 行业 KA｜AI 解决方案销售｜商业 BD",
            PHOTO_PATH,
        )
    else:
        add_header(doc, target)
    add_summary(
        doc,
        "4 年汽车行业与互联网广告媒体平台商业化、行业 KA 及销售管理经验，具备区域客户增长、存量经营和商业化目标负责经验。",
        [
            (
                "业绩表现",
                "岗位职级全国前30%；客户规模稳定增长至210家（180→210，+16.7%），区域月均商业消耗环比稳定增长2%–2.5%、年增长约30%，年度综合业务目标达成130%。",
            ),
            (
                "AI业务价值",
                "设计AI客户地图，将拜访效率提升150%；将分散经营数据转为客户优先级、拜访路线、CTR/CVR问题诊断和商家行动建议，团队内使用率100%，每天减少约2小时规划与复盘时间。",
            ),
        ],
    )
    add_strengths(
        doc,
        [
            (
                "行业洞察与决策链",
                "理解汽车零售、二手车、广告投放和线索转化，覆盖老板、负责人、店长及运营等关键角色",
            ),
            (
                "AI驱动经营提效",
                "用多报表整合、客户价值评分和路线优化解决商机优先级不清、拜访规划耗时等问题",
            ),
            (
                "场景发现与价值方案",
                "将AI能力落到客户分层、车型漏斗诊断、ROI方案和商家可执行经营动作",
            ),
            (
                "Pipeline与项目推进",
                "客户分层、商机阶段、拜访节奏、上线陪跑、经营复盘、增购和流失召回",
            ),
            (
                "结果责任与路径复制",
                "对收入和目标负责，通过数据验证有效打法，并沉淀Prompt、模板、SOP和团队机制",
            ),
        ],
    )
    add_section_title(doc, "工作经历")
    add_role(
        doc,
        "懂车帝",
        "储备区域经理",
        "2025.07—至今",
        "汽车行业营销解决方案｜互联网广告媒体平台｜AI驱动客户经营｜广州区域",
        [
            "业绩结果：1）岗位职级全国前30%；2）客户规模稳定增长至210家（180→210，+16.7%），区域月均商业消耗环比稳定增长2%–2.5%、年增长约30%，年度综合业务目标达成130%；3）区域头部二手车商户线索量增长约122%（270→约600条/月）、成交量增长150%（4→10台/月），连续稳定经营6个月；4）召回约20家沉默客户、直接开发10家。",
            "关键动作：建立客户分层与经营档案，以客户规模、商业消耗、线索、成交及商机阶段为核心设计推进节奏，主导区域目标拆解和周/月经营复盘，并基于经营数据提出优化建议与建设方案；参与推广包、客户政策、资源配置和运营策略调整，协同产品、客服及运营推进落地。",
            "经营提效：设计AI客户地图，将拜访效率提升150%；解决经营报表分散、客户优先级不清和路线依赖人工判断的问题，整合当月、对比、推广包、线索、车型和位置数据，输出每日8家优先商户、命中原因、到店动作及路线；团队内使用率100%，每天减少约2小时规划与复盘时间。",
            "方法沉淀：沉淀“行业洞察—客户分层—经营档案—业务决策链—经营诊断—优化方案—复盘增长”的可复用方法；结合约9.2万条车源记录和近4000个车型四象限分析，将CTR/CVR漏斗问题转化为补曝光、首图/价格/详情承接、补车或去库存等可执行建议。",
        ],
    )
    add_role(
        doc,
        "乐道汽车",
        "店长",
        "2024.03—2025.06",
        "下沉市场0-1｜增长路径验证｜资源协同｜团队复制",
        [
            "业绩结果：1）团队季度目标完成率超过200%，月人效5–7台，业绩保持大区前3、全国前10；2）自媒体订单占比0%→10%；3）企业员工订单6%→10%、置换订单8%→14%。",
            "关键动作：主导广东湛江、安徽芜湖下沉市场0-1开拓，围绕异业、自媒体、入企品宣和置换设计并验证增量路径。",
            "经营提效：围绕目标、渠道、线索、成交和人效建立周/月度看板及复盘机制，通过目标拆解和过程管理推动增量项目进入团队节奏。",
            "方法沉淀：累计带教21人、培养10人晋升，沉淀渠道打法、销售动作和能力训练机制，推动有效方法复制。",
        ],
    )
    add_role(
        doc,
        "特斯拉",
        "销售主管",
        "2022.07—2023.12",
        "强结果销售｜客户池经营｜内容获客｜销售过程管理",
        [
            "业绩结果：1）华南区约600名销售中连续两个季度保持销冠（前1%），核心销售期9个月交付超过600台；2）置换线索转化率5%→10%、置换订单占比8%→14%；3）团队由华南后10%提升至前30%。",
            "关键动作：围绕留资、电联、试驾和成交转化管理销售漏斗，沉淀约5000名微信客户并运营4个500人意向群，每周开展3–4场直播。",
            "经营提效：按日/周/月复盘留资量、电联量、试驾量和转化率，通过客户分层、私域运营及直播获客提升跟进效率。",
            "方法沉淀：标准化置换开口话术、服务商KPI和联合复盘机制，并完成团队带教，任期内培养5名员工转正。",
        ],
    )
    add_education(doc)
    if with_photo:
        path = OUTPUT_DIR / "贺文杰_大模型商业化与KA销售_AI项目业务价值版_V5_照片版.docx"
    else:
        path = OUTPUT_DIR / "贺文杰_大模型商业化与KA销售_AI项目业务价值版_V5.docx"
    doc.save(path)
    return path


def build_business_operations_top_down(with_photo=False):
    doc = setup_document()
    configure_readable_resume(doc)
    target = "商业化运营 / Business Operations｜行业经营策略｜AI驱动业务提效"
    if with_photo:
        add_header_with_photo(
            doc,
            "商业化运营 / Business Operations｜行业经营与增长",
            PHOTO_PATH,
        )
    else:
        add_header(doc, target)
    add_summary_readable(
        doc,
        "4年汽车行业与互联网广告媒体平台商业化、区域经营及销售管理经验，具备从目标拆解、客户分层、经营诊断到策略执行和复盘增长的完整业务经验。",
        [
            (
                "业务结果",
                "岗位职级全国前30%；客户规模稳定增长至210家（180→210，+16.7%），区域月均商业消耗环比稳定增长2%–2.5%、年增长约30%，年度综合业务目标达成130%。",
            ),
            (
                "经营机制",
                "建立区域经营管理机制，主导目标拆解和周/月经营复盘，参与推广包、客户政策、资源配置及运营策略调整，将业务目标转化为客户分层、经营节奏和执行动作。",
            ),
            (
                "AI规模化",
                "设计AI客户地图，将拜访效率提升150%；团队内使用率100%，将分散数据转为客户优先级、拜访路线、CTR/CVR诊断和商家行动建议，每天减少约2小时规划与复盘时间。",
            ),
        ],
    )
    add_strengths_readable(
        doc,
        [
            (
                "商业目标与经营机制",
                "目标拆解、周/月经营复盘、客户分层、商机节奏和结果追踪",
            ),
            (
                "行业与客户洞察",
                "深耕汽车零售及二手车行业，覆盖KA、区域头部、中小商户及多层级业务角色",
            ),
            (
                "数据诊断与增长",
                "建立客户规模、商业消耗、线索、成交、回捞、ROI及CTR/CVR数据诊断框架",
            ),
            (
                "AI与流程规模化",
                "将多报表、客户地图、车型数据和行动建议整合为团队100%采用的经营工作流",
            ),
            (
                "策略协同与组织复制",
                "参与推广包、客户政策、资源配置和运营策略调整，并沉淀SOP、模板及团队机制",
            ),
        ],
    )
    add_section_title(doc, "工作经历")
    add_role_readable(
        doc,
        "懂车帝",
        "储备区域经理",
        "2025.07—至今",
        "汽车及二手车商业化运营｜区域经营策略｜AI经营系统｜广州",
        [
            (
                "业绩结果",
                [
                    "岗位职级全国前30%。",
                    "客户规模稳定增长至210家（180→210，+16.7%）；区域月均商业消耗环比稳定增长2%–2.5%、年增长约30%，年度综合业务目标达成130%。",
                    "区域头部二手车商户线索量增长约122%（270→约600条/月），成交量增长150%（4→10台/月），连续稳定经营6个月。",
                    "召回约20家沉默客户，直接开发10家。",
                ],
                True,
            ),
            (
                "关键动作",
                [
                    "建立客户分层与经营档案，以客户规模、商业消耗、线索、成交及商机阶段为核心设计推进节奏。",
                    "主导区域目标拆解和周/月经营复盘，基于经营数据提出优化建议与建设方案；参与推广包、客户政策、资源配置和运营策略调整。",
                ],
                False,
            ),
            (
                "经营提效",
                [
                    "设计AI客户地图，将拜访效率提升150%；团队内使用率100%，每天减少约2小时规划与复盘时间。",
                    "解决经营报表分散、客户优先级不清和路线依赖人工判断的问题，整合当月、对比、推广包、线索、车型和位置数据，输出每日8家优先商户、命中原因、到店动作及路线。",
                ],
                False,
            ),
            (
                "方法沉淀",
                [
                    "沉淀“行业洞察—客户分层—经营档案—业务决策链—经营诊断—优化方案—复盘增长”的可复用方法。",
                    "结合约9.2万条车源记录和近4000个车型四象限分析，将CTR/CVR漏斗问题转化为补曝光、首图/价格/详情承接、补车或去库存等可执行建议。",
                ],
                False,
            ),
        ],
        101,
    )

    doc.add_page_break()
    add_section_title(doc, "工作经历（续）")
    add_role_readable(
        doc,
        "乐道汽车",
        "店长",
        "2024.03—2025.06",
        "下沉市场Business Operations｜0-1运营机制｜增长验证｜组织复制",
        [
            (
                "业绩结果",
                [
                    "团队季度目标完成率超过200%，月人效5–7台，业绩保持大区前3、全国前10。",
                    "自媒体订单占比由0%提升至10%。",
                    "企业员工订单占比6%→10%，置换订单占比8%→14%。",
                ],
                True,
            ),
            (
                "关键动作",
                [
                    "搭建下沉市场0-1增长路径，主导广东湛江、安徽芜湖市场开拓，识别区域增长约束。",
                    "验证异业、自媒体、入企品宣和置换等增量路径。",
                ],
                False,
            ),
            (
                "经营提效",
                [
                    "建立周/月度经营看板及复盘机制，统一管理目标、渠道、线索、成交和人效。",
                    "以目标拆解、过程管理和资源协同推动增量项目进入团队节奏。",
                ],
                False,
            ),
            (
                "方法沉淀",
                [
                    "沉淀渠道打法、销售动作和项目复盘机制，将0-1经验转化为可复制的组织能力。",
                    "累计带教21人，培养10人晋升。",
                ],
                False,
            ),
        ],
        102,
    )
    add_role_readable(
        doc,
        "特斯拉",
        "销售主管",
        "2022.07—2023.12",
        "客户全生命周期运营｜转化漏斗｜私域增长｜机制标准化",
        [
            (
                "业绩结果",
                [
                    "华南区约600名销售中连续两个季度保持销冠（前1%），核心销售期9个月交付超过600台。",
                    "置换线索转化率5%→10%，置换订单占比8%→14%。",
                    "团队排名由华南后10%提升至前30%。",
                ],
                True,
            ),
            (
                "关键动作",
                [
                    "搭建客户全生命周期转化漏斗，统一管理留资、电联、试驾和成交。",
                    "沉淀约5000名微信客户，运营4个500人意向群，每周开展3–4场直播。",
                ],
                False,
            ),
            (
                "经营提效",
                [
                    "建立日/周/月转化复盘机制，跟踪留资量、电联量、试驾量和转化率。",
                    "配合客户分层、私域运营、直播获客和重点商机跟进提升转化效率。",
                ],
                False,
            ),
            (
                "方法沉淀",
                [
                    "沉淀置换开口话术、服务商KPI、客户池运营和联合复盘机制。",
                    "完成团队带教，任期内培养5名员工转正。",
                ],
                False,
            ),
        ],
        103,
    )
    add_education(doc)
    if with_photo:
        path = OUTPUT_DIR / "贺文杰_商业化运营_BusinessOperations_照片版.docx"
    else:
        path = OUTPUT_DIR / "贺文杰_商业化运营_BusinessOperations.docx"
    doc.save(path)
    return path


if __name__ == "__main__":
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for output in (
        build_minimax(),
        build_business_builder(),
        build_common_v2(),
        build_common_v5_project_evidence(),
        build_common_v5_project_evidence(with_photo=True),
        build_business_operations_top_down(),
        build_business_operations_top_down(with_photo=True),
    ):
        print(output)
