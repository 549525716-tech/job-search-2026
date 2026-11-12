#!/usr/bin/env python3
# 广东鸿粤集团「华为汽车销售顾问」定制简历生成脚本
# 只改本地文件，不外发。底稿：贺文杰_销售与商业化管理.docx

from copy import deepcopy
from pathlib import Path

from docx import Document
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from lxml import etree

BASE = Path("/workspace/projects/职场/03_简历/贺文杰_销售与商业化管理.docx")
OUT = Path("/workspace/projects/职场/03_简历/定制样稿_2026-11-11_鸿粤华为")
STEM = "贺文杰_广东鸿粤集团_华为汽车销售顾问"

DIR_TEXT = "求职方向：华为汽车销售顾问 / 新能源车一线销售"
CONTACT = "广州｜18011771996｜549525716@qq.com｜广东优先 / 广州"


def rpr(bold=False, size=20, color="1F2D3D", highlight=False):
    el = OxmlElement("w:rPr")
    fonts = OxmlElement("w:rFonts")
    fonts.set(qn("w:ascii"), "PingFang SC")
    fonts.set(qn("w:hAnsi"), "PingFang SC")
    fonts.set(qn("w:eastAsia"), "PingFang SC")
    el.append(fonts)
    b = OxmlElement("w:b")
    if not bold:
        b.set(qn("w:val"), "0")
    el.append(b)
    c = OxmlElement("w:color")
    c.set(qn("w:val"), color)
    el.append(c)
    sz = OxmlElement("w:sz")
    sz.set(qn("w:val"), str(size))
    el.append(sz)
    if highlight:
        h = OxmlElement("w:highlight")
        h.set(qn("w:val"), "yellow")
        el.append(h)
    return el


def make_run(text, bold=False, size=20, color="1F2D3D", highlight=False):
    run = OxmlElement("w:r")
    run.append(rpr(bold=bold, size=size, color=color, highlight=highlight))
    t = OxmlElement("w:t")
    if text[:1].isspace() or text[-1:].isspace():
        t.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
    t.text = text
    run.append(t)
    return run


def clear_runs(p_elm):
    for child in list(p_elm):
        if child.tag != qn("w:pPr"):
            p_elm.remove(child)


def add_runs(p_elm, parts, annotate=None):
    """parts: list of (text, bold, size, color)."""
    clear_runs(p_elm)
    highlight = bool(annotate)
    for text, bold, size, color in parts:
        p_elm.append(make_run(text, bold=bold, size=size, color=color, highlight=highlight))
    if annotate:
        p_elm.append(make_run(f"〔{annotate}〕", bold=False, size=14, color="C00000"))


def append_p(body, template_p, parts, annotate=None):
    elm = deepcopy(template_p)
    # avoid leftover page breaks / drawings
    for br in elm.findall(".//" + qn("w:br")):
        parent = br.getparent()
        if parent is not None:
            parent.remove(br)
    for attr in list(elm.attrib):
        if attr.endswith("paraId") or attr.endswith("textId"):
            del elm.attrib[attr]
    add_runs(elm, parts, annotate=annotate)
    body.append(elm)
    return elm


def set_keep_next(elm, on=True):
    pPr = elm.find(qn("w:pPr"))
    if pPr is None:
        return
    existing = pPr.find(qn("w:keepNext"))
    if on:
        if existing is None:
            kn = OxmlElement("w:keepNext")
            pPr.append(kn)
    else:
        if existing is not None:
            pPr.remove(existing)


# ----- 正文（干净版只写已确认事实；不写缺口、驾照、华为/鸿蒙经验） -----
OVERVIEW = (
    "约4年新能源车销售与门店经营经验，覆盖特斯拉一线销售、乐道店长及字节跳动-懂车帝汽车商户经营。"
    "熟悉留资、电联、试驾到交付，能统筹门店人员、场地与车辆资源，并把过程数据整理为可汇报的周/月复盘。"
)
LINES = [
    (
        "一线销售：",
        "特斯拉任职2022.07—2023.12（无直管）；华南约600名销售中连续两季个人销冠，核心销售期9个月交付超过600台（9个月为交付统计口径，非任职时长）。",
    ),
    (
        "门店运营：",
        "乐道店长同期直管10人，统筹人员、场地与车辆资源；团队季度目标完成率超200%，月人效5–7台，业绩大区前3、全国前10；累计带教21人，培养10人晋升。",
    ),
    (
        "经销商理解：",
        "懂车帝个人深耕210家汽车/二手车商户，年度综合业务目标达成130%，岗位职级全国前30%，所负责区域商业消耗年增长约30%。",
    ),
]
SKILLS = [
    ("一线零售销售：", "新能源车客户沟通与跟进，覆盖留资、电联、试驾到交付"),
    ("试驾与客户反馈：", "跟踪试驾过程与转化卡点，整理客户跟进信息并纳入复盘"),
    ("门店车辆协同：", "统筹门店人员、场地与车辆资源，保障日常运营"),
    ("标准化汇报：", "将线索、试驾、成交等过程数据整理为可向销售管理侧汇报的材料"),
    ("目标感与抗压：", "拆解个人与团队目标，在高压销售节奏下持续达成结果"),
]
DCD_TAG = "个人商户经营｜汽车经销商理解｜广州"
DCD_BULLETS = [
    "个人深耕广州北210家汽车/二手车商户，开展信息流广告与营销经营并建立客户分层档案。年度综合业务目标达成130%，职级全国前30%，区域消耗年增约30%，体现对经销商经营节奏和门店需求的理解。",
]
ONVO_TAG = "单店直管10人｜门店运营｜车辆与交付协同"
ONVO_BULLETS = [
    "担任店长，同期直管10人（主管、业务主管及一线销售），以周/月看板跟踪渠道、线索、成交与人效并组织改进。团队季度目标完成率超200%，月人效5–7台，业绩大区前3、全国前10；累计带教21人，培养10人晋升。体现门店目标管理、带教协作与抗压达成能力。",
    "统筹门店人员、场地与车辆资源，协调日常运营及异业、自媒体、入企、置换等增量项目。自媒体订单占比0%→10%，企业员工订单6%→10%，置换订单8%→14%。体现门店车辆协同与成交转化能力。",
]
TESLA_TAG = "一线个人销售｜试驾跟进｜过程复盘"
TESLA_BULLETS = [
    "作为一线销售（无直管下属），按日/周/月跟踪留资、电联、试驾和成交。华南约600名销售中连续两季个人销冠；核心销售期9个月交付超过600台（9个月为交付统计口径，非任职时长）。体现新能源一线销售、试驾转化与目标达成能力。",
    "维护约5000名微信客户、4个500人意向群，持续跟进并复盘转化。体现客户沟通与持续跟进能力。",
    "建立置换服务商合作流程与KPI并联合复盘；置换线索转化率5%→10%，置换订单占比8%→14%。体现跨角色协同与过程改进。",
]
CONFIRM_NOTES = [
    "JD职位标签含「C1以上驾驶证」，履历事实库、能力画像、profile-supplement均无驾照信息；干净版未写，待本人确认后再决定是否补充。",
    "未编造任何华为/鸿蒙智行产品经验或到岗承诺；JD任职要求为「对华为鸿蒙智行系列产品有兴趣，学习能力强」，不作为已有经验写入。",
    "无5S管理、试驾体验反馈表、商超展厅车源调度的直接实证；干净版只用已确认的试驾跟踪、车辆资源统筹和周/月复盘，不包装成本岗既有动作。",
    "不把特斯拉/乐道经历写成传统4S店经验；不写创业经历、英语水平和未确认数字（含「4→10台」、助手推算「前1%」、最高单日23台、费效比200%等）。",
]

# 标注：改动对应的JD条目 + 事实来源
ANN = {
    "dir": "按JD岗位名称调整求职方向；干净版突出一线销售而非管理岗",
    "contact": "本人确认2026-11-02：城市不限、广东优先",
    "overview": "JD职责1-4、要求1/3：一线新能源销售·试驾链路·门店协同·目标抗压｜事实库第一/二/三节",
    "line_sales": "JD职责2、要求3；职位标签新车销售/新能源车/线下销售｜事实库特斯拉：任职2022.07—2023.12、无直管、核心销售期9个月交付口径、连续两季个人销冠",
    "line_store": "JD职责1/4、职责5门店经营优先｜事实库乐道：直管10人、季度超200%、月人效5–7台、大区前3/全国前10、累计带教21人、培养10人晋升",
    "line_dcd": "按投递要求将懂车帝简写为对经销商的理解｜事实库懂车帝：个人210家、年度130%、全国前30%、区域消耗年增约30%；不写4→10台",
    "sk1": "JD要求1；职位标签新车销售/新能源车/线下销售｜事实库特斯拉个人销售与试驾跟进",
    "sk2": "JD职责1/2/3：试驾指导、功能答疑、收集反馈并汇报｜迁移自特斯拉留资/电联/试驾/成交复盘；不写已制定反馈表",
    "sk3": "JD职责1/4：展车试驾车5S与车源协调｜迁移自乐道统筹人员、场地与车辆资源；不写5S或商超展厅调度",
    "sk4": "JD职责3：整理试驾感受、标准文档向销售经理汇报｜迁移自日/周/月过程复盘；不写已做过本岗标准文档",
    "sk5": "JD要求3：目标感明确、能承受一定压力｜事实库：特斯拉两季销冠与600+交付、乐道季度超200%",
    "dcd_title": "本人确认2026-11-02：雇主写法「字节跳动-懂车帝」；职务为储备区域经理",
    "dcd_tag": "按本岗改写标签，突出经销商理解；地点广州来自事实库懂车帝段落",
    "dcd_b0": "JD无直接对应，按投递要求简写｜事实库第三节懂车帝【本人】：210家、年度130%、前30%、年增约30%；不写4→10台、未确认消耗金额",
    "onvo_title": "职称保留店长｜事实库：乐道汽车｜店长｜2024.03—2025.06",
    "onvo_tag": "JD职责1/4/5：门店运营、车辆协同、经营优先｜直管10人仅用于乐道【本人确认2026-11-02】",
    "onvo_b0": "JD职责3、要求3：过程复盘与目标达成｜事实库/画像EV-ONVO-MANAGEMENT：看板跟踪渠道线索成交人效、季度超200%、月人效5–7台、大区前3/全国前10",
    "onvo_b1": "JD职责1/4：车辆与场地协同｜事实库：统筹门店人员、场地与车辆资源；增量项目占比来自【简历】；不写仅画像的下沉费效比200%",
    "onvo_b2": "JD职责5团队合作｜事实库：累计带教21人、培养10人晋升；累计≠同期团队规模，晋升为参与推荐",
    "tesla_title": "职称保留销售主管，不改称店长｜事实库：特斯拉｜销售主管｜2022.07—2023.12",
    "tesla_tag": "按本岗突出一线个人销售与试驾跟进；本人确认特斯拉无直管，删除原「10人团队直接管理」标签",
    "tesla_b0": "JD职责1/2、要求3；职位标签新能源/线下销售｜事实库特斯拉【简历】：留资电联试驾成交、华南约600人连续两季个人销冠、核心销售期9个月交付超600台；删除助手推算「前1%」；无直管【本人2026-11-02】",
    "tesla_b1": "JD要求3沟通与服务意识｜事实库【简历】：约5000名微信客户、4个500人意向群；干净版不写直播以贴合本岗线下场景",
    "tesla_b2": "JD职责5团队合作｜事实库【简历】：置换服务商流程与KPI，转化率5%→10%、订单占比8%→14%",
    "edu": "本人确认2026-11-05：专科与本科两段都保留；全日制口径未确认，干净版不作声明",
    "confirm_h": "仅标注版：需本人确认项；干净版不写缺口",
    "confirm0": "需本人确认｜JD职位标签C1以上驾驶证，事实源均无驾照记录",
    "confirm1": "边界说明｜不编造华为/鸿蒙智行产品经验",
    "confirm2": "边界说明｜5S、反馈表、商超车源无直接实证，仅迁移已有动作",
    "confirm3": "边界说明｜不写4S店、创业、英语及未确认数字",
}



def set_spacing(elm, before=None, after=None, line=None):
    pPr = elm.find(qn("w:pPr"))
    if pPr is None:
        return
    sp = pPr.find(qn("w:spacing"))
    if sp is None:
        sp = OxmlElement("w:spacing")
        pPr.append(sp)
    if before is not None:
        sp.set(qn("w:before"), str(before))
    if after is not None:
        sp.set(qn("w:after"), str(after))
    if line is not None:
        sp.set(qn("w:line"), str(line))
        sp.set(qn("w:lineRule"), "exact")


def tighten_spacing(tpl):
    # 略收段距，把教育经历收回一页；不改变字体与配色
    set_spacing(tpl["h1"], after=0, line=300)
    set_spacing(tpl["edu_h"], after=0, line=300)
    set_spacing(tpl["body"], after=56, line=270)
    set_spacing(tpl["skill"], after=48, line=270)
    set_spacing(tpl["tag"], after=40, line=260)
    set_spacing(tpl["bullet"], after=48, line=270)
    set_spacing(tpl["job"], after=0, line=300)
    set_spacing(tpl["edu1"], after=12, line=260)
    set_spacing(tpl["edu2"], after=0, line=260)


def set_header(doc, annotate):
    cell = doc.tables[0].rows[0].cells[0]
    paras = cell.paragraphs
    add_runs(
        paras[1]._p,
        [("求职方向：华为汽车销售顾问 / 新能源车一线销售", True, 21, "007974")],
        annotate=ANN["dir"] if annotate else None,
    )
    add_runs(
        paras[2]._p,
        [(CONTACT, False, 18, "5C6B7A")],
        annotate=ANN["contact"] if annotate else None,
    )


def build(annotate=False):
    doc = Document(str(BASE))
    set_header(doc, annotate)

    paras = doc.paragraphs
    tpl = {
        "spacer": deepcopy(paras[0]._p),
        "h1": deepcopy(paras[1]._p),
        "body": deepcopy(paras[2]._p),
        "skill": deepcopy(paras[7]._p),
        "job": deepcopy(paras[13]._p),
        "tag": deepcopy(paras[14]._p),
        "bullet": deepcopy(paras[21]._p),
        "edu_h": deepcopy(paras[64]._p),
        "edu1": deepcopy(paras[65]._p),
        "edu2": deepcopy(paras[66]._p),
    }
    tighten_spacing(tpl)

    body = doc.element.body
    sect = body.find(qn("w:sectPr"))
    # 删除底稿全部正文段落，只留表格 + 重建段落 + sectPr
    for child in list(body):
        if child.tag == qn("w:p"):
            body.remove(child)

    def add(template, parts, annotate_key=None, keep_next=False):
        note = ANN[annotate_key] if (annotate and annotate_key) else None
        elm = append_p(body, template, parts, annotate=note)
        if keep_next:
            set_keep_next(elm, True)
        return elm

    def h1(text, key=None):
        add(tpl["h1"], [(text, True, 23, "007974")], key)

    def job_title(company, title, dates, key=None):
        add(
            tpl["job"],
            [
                (company, True, 22, "1F2D3D"),
                (title, True, 22, "1F2D3D"),
                (dates, True, 19, "5C6B7A"),
            ],
            key,
            keep_next=True,
        )

    def tagline(text, key=None):
        add(tpl["tag"], [(text, True, 19, "007974")], key, keep_next=True)

    def bullet(text, key=None):
        add(tpl["bullet"], [(text, False, 20, "1F2D3D")], key)

    def labeled(label, text, key=None):
        add(
            tpl["skill"] if "：" in label and len(label) < 12 else tpl["body"],
            [(label, True, 20, "1F2D3D"), (text, False, 20, "1F2D3D")],
            key,
        )

    # spacer under header
    sp = deepcopy(tpl["spacer"])
    for attr in list(sp.attrib):
        if attr.endswith("paraId") or attr.endswith("textId"):
            del sp.attrib[attr]
    body.append(sp)

    h1("职业概述")
    add(tpl["body"], [(OVERVIEW, False, 20, "1F2D3D")], "overview")
    labeled(*LINES[0], "line_sales")
    labeled(*LINES[1], "line_store")
    labeled(*LINES[2], "line_dcd")

    h1("核心能力")
    for i, (lab, txt) in enumerate(SKILLS, 1):
        labeled(lab, txt, f"sk{i}")

    h1("工作经历")
    job_title("字节跳动-懂车帝", "｜储备区域经理｜", "2025.07—至今", "dcd_title")
    tagline(DCD_TAG, "dcd_tag")
    for i, t in enumerate(DCD_BULLETS):
        bullet(t, f"dcd_b{i}")

    job_title("乐道汽车", "｜店长｜", "2024.03—2025.06", "onvo_title")
    tagline(ONVO_TAG, "onvo_tag")
    for i, t in enumerate(ONVO_BULLETS):
        bullet(t, f"onvo_b{i}")

    job_title("特斯拉", "｜销售主管｜", "2022.07—2023.12", "tesla_title")
    tagline(TESLA_TAG, "tesla_tag")
    for i, t in enumerate(TESLA_BULLETS):
        bullet(t, f"tesla_b{i}")

    add(tpl["edu_h"], [("教育经历", True, 23, "007974")], "edu" if annotate else None, keep_next=True)
    add(
        tpl["edu1"],
        [("2020.09—2022.06　广东培正学院　行政管理｜本科", True, 18, "1F2D3D")],
        "edu" if annotate else None,
        keep_next=True,
    )
    add(
        tpl["edu2"],
        [("2016.09—2019.06　广东工商学院　金融管理｜专科", False, 18, "5C6B7A")],
        "edu" if annotate else None,
    )

    if annotate:
        h1("需本人确认（仅标注版，干净版未写）", "confirm_h")
        for i, note in enumerate(CONFIRM_NOTES):
            bullet(note, f"confirm{i}")

    if sect is not None:
        body.remove(sect)
        body.append(sect)

    suffix = "_标注版" if annotate else ""
    path = OUT / f"{STEM}{suffix}.docx"
    doc.save(str(path))
    return path


if __name__ == "__main__":
    p1 = build(False)
    p2 = build(True)
    print("wrote", p1)
    print("wrote", p2)
