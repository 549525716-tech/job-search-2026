#!/usr/bin/env python3
# 2026-11-11 晚间预备定制：东风奕境、保资利、字节加盟、高德广告
# 方法同鸿粤稿。XTransfer戚女士按指示暂缓，不在本脚本内。
# 只改本地文件，不外发、不开招聘页。

from copy import deepcopy
from pathlib import Path

from docx import Document
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

BASE = Path("/workspace/projects/职场/03_简历/贺文杰_销售与商业化管理.docx")
ROOT = Path("/workspace/projects/职场/03_简历/定制样稿_2026-11-11_预备")

CONTACT_BASE = "广州｜18011771996｜549525716@qq.com｜"


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
    clear_runs(p_elm)
    highlight = bool(annotate)
    for text, bold, size, color in parts:
        p_elm.append(make_run(text, bold=bold, size=size, color=color, highlight=highlight))
    if annotate:
        p_elm.append(make_run(f"〔{annotate}〕", bold=False, size=14, color="C00000"))


def append_p(body, template_p, parts, annotate=None):
    elm = deepcopy(template_p)
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
            pPr.append(OxmlElement("w:keepNext"))
    elif existing is not None:
        pPr.remove(existing)


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
    set_spacing(tpl["h1"], after=0, line=300)
    set_spacing(tpl["edu_h"], after=0, line=300)
    set_spacing(tpl["body"], after=56, line=270)
    set_spacing(tpl["skill"], after=48, line=270)
    set_spacing(tpl["tag"], after=40, line=260)
    set_spacing(tpl["bullet"], after=48, line=270)
    set_spacing(tpl["job"], after=0, line=300)
    set_spacing(tpl["edu1"], after=12, line=260)
    set_spacing(tpl["edu2"], after=0, line=260)


# ======================== 四份岗位内容 ========================
JOBS = []

# ----- 1 东风奕境 张女士（不同于11-07猎聘边先生南区岗） -----
JOBS.append(dict(
    folder="东风汽车_区域经理-奕境",
    stem="贺文杰_东风汽车_区域经理-奕境",
    direction="求职方向：区域经理 / 新能源门店零售经营",
    city="广东优先 / 广州",
    overview=(
        "约4年新能源车销售与门店经营经验，覆盖乐道店长、特斯拉一线销售及字节跳动-懂车帝商户经营。"
        "擅长把销售目标拆解为过程指标，用周/月复盘把握销售节奏，并统筹门店人员、场地与车辆资源，推动团队出结果。"
    ),
    lines=[
        ("门店经营：", "乐道店长同期直管10人，建立周/月看板跟踪渠道、线索、成交与人效；团队季度目标完成率超200%，月人效5–7台，业绩大区前3、全国前10；累计带教21人，培养10人晋升。"),
        ("目标节奏：", "特斯拉任职2022.07—2023.12（无直管），按日/周/月跟踪留资、电联、试驾和成交；华南约600名销售中连续两季个人销冠，核心销售期9个月交付超过600台（9个月为交付统计口径，非任职时长）。"),
        ("区域协同：", "懂车帝主导大区跨区域目标拆解、任务分工与周/月经营复盘（非人事直管）；个人深耕210家商户，年度目标达成130%，职级全国前30%，区域消耗年增约30%。"),
    ],
    skills=[
        ("销售目标管理：", "年/季/月目标拆解、过程指标跟踪与达成复盘"),
        ("门店运营改进：", "用看板诊断渠道、线索、成交与人效，并组织改进"),
        ("一线门店经营：", "新能源直营门店的人员、场地与车辆统筹及销售带教"),
        ("资源协同：", "跨区域任务分工督办，置换服务商等合作方协同"),
        ("市场与增量：", "异业、自媒体、入企、置换等增量项目落地"),
    ],
    dcd_tag="跨区域目标拆解｜商户经营复盘｜广州",
    dcd_bullets=[
        "主导大区跨区域目标拆解与周/月经营复盘，组织其他区域同事分工并督办（非人事直管）。个人深耕210家汽车/二手车商户，年度综合业务目标达成130%，职级全国前30%，区域消耗年增约30%。体现目标部署、过程复盘与资源协同能力。",
    ],
    onvo_tag="单店直管10人｜门店经营｜目标与人效",
    onvo_bullets=[
        "担任店长，同期直管10人（主管、业务主管及一线销售），以周/月看板跟踪渠道、线索、成交与人效并组织改进。团队季度目标完成率超200%，月人效5–7台，业绩大区前3、全国前10；累计带教21人，培养10人晋升。体现一线门店经营管理与目标达成能力。",
        "统筹门店人员、场地与车辆资源，开拓湛江、芜湖下沉市场，组织异业、自媒体、入企和置换等增量项目。自媒体订单占比0%→10%，企业员工订单6%→10%，置换订单8%→14%。体现销售推动、资源统筹与市场推广落地能力。",
    ],
    tesla_tag="一线个人销售｜过程管理｜节奏把控",
    tesla_bullets=[
        "作为一线销售（无直管下属），按日/周/月跟踪留资、电联、试驾和成交。华南约600名销售中连续两季个人销冠；核心销售期9个月交付超过600台（9个月为交付统计口径，非任职时长）。体现新能源销售结果与销售节奏把控能力。",
        "协助员工辅导（非直管），被辅导员工由华南后10%提升至前30%，培养5名员工转正；建立置换服务商流程与KPI，转化率5%→10%。体现带教赋能与合作方协同能力。",
    ],
    confirm=[
        "本科两段学历均保留，全日制口径未确认，干净版不作全日制声明；本科专业为行政管理，不称为汽车或市场营销专业。",
        "乐道为单店经营，懂车帝跨区域督办不是人事直管或多店P&L；不写成已有小区通盘或多店盈利管理经验。",
        "不编造奕境或华为乾崑产品经验，也不写区域销售政策制定权限或重大客诉闭环。",
        "不写创业、英语及未确认数字（含「4→10台」、助手推算「前1%」、最高单日23台、费效比200%等）。",
    ],
    ann={
        "dir": "按JD岗位调整求职方向：区域经理/新能源门店零售经营",
        "contact": "本人确认2026-11-02：城市不限、广东优先",
        "overview": "JD职责1-5、要求2/3：目标拆解·门店经营·节奏复盘｜事实库乐道/特斯拉/懂车帝",
        "line0": "JD职责3、要求3：一线门店经营管理｜事实库乐道：直管10人、季度超200%、大区前3/全国前10、带教21/晋升10",
        "line1": "JD职责1/5：目标与销售节奏｜事实库特斯拉：任职2022.07—2023.12、无直管、9个月交付口径、两季个人销冠",
        "line2": "JD职责1/4、要求4：区域通盘意识（迁移，非多店通盘）｜事实库懂车帝：跨区域分工督办非人事直管；210家、年度130%、前30%、年增约30%",
        "sk1": "JD职责1：制定计划、分解部署、完成销售目标",
        "sk2": "JD职责3/5：优化门店运营、月度季度经营分析",
        "sk3": "JD要求2/3：新能源直营与一线门店经营｜乐道店长+特斯拉一线；不写多店通盘",
        "sk4": "JD职责4：协调资源满足门店需求｜迁移自跨区域督办与服务商协同，无区域预算权限",
        "sk5": "JD职责2、要求5：销售策略落地与市场推广｜乐道增量项目；不写已制定区域销售政策",
        "dcd_title": "本人确认：雇主写法「字节跳动-懂车帝」；职务储备区域经理",
        "dcd_tag": "按本岗突出跨区域目标与复盘，非人事管理",
        "dcd_b0": "JD职责1/4/5｜事实库【本人】跨区域目标拆解与督办非直管；210家、130%、前30%、年增约30%；不写4→10台",
        "onvo_title": "职称保留店长｜事实库：乐道汽车｜店长｜2024.03—2025.06",
        "onvo_tag": "JD要求3：成功的一线门店经营管理；直管10人仅用于乐道【本人2026-11-02】",
        "onvo_b0": "JD职责1/3/5、要求3｜事实库/画像EV-ONVO-MANAGEMENT",
        "onvo_b1": "JD职责2/4、要求5｜事实库：车辆资源统筹、湛江芜湖下沉、增量项目占比【简历】；不写仅画像费效比200%",
        "tesla_title": "职称保留销售主管，不改称店长｜2022.07—2023.12",
        "tesla_tag": "本人确认特斯拉无直管；突出一线结果与过程节奏",
        "tesla_b0": "JD职责1/5、要求2新能源直营/高端品牌优先｜事实库【简历】两季个人销冠、9个月交付口径；删除「前1%」",
        "tesla_b1": "JD要求5门店运营指导（迁移，非区域巡店）｜被辅导员工后10%→前30%、培养5人转正【本人/简历】；置换KPI【简历】",
        "edu": "本人确认2026-11-05：专科与本科都保留；全日制未确认，干净版不作声明",
        "confirm_h": "仅标注版：需本人确认与边界；干净版不写缺口。驾照不再单列。",
        "confirm0": "全日制未确认；专业非汽车/市场营销",
        "confirm1": "单店+平台督办≠小区多店通盘/P&L",
        "confirm2": "不编造奕境/华为产品或区域政策权限",
        "confirm3": "不写创业、英语及未确认数字",
    },
))

# ----- 2 保资利 周园 -----
JOBS.append(dict(
    folder="广州保资利_新能源销售经理",
    stem="贺文杰_广州保资利_新能源销售经理",
    direction="求职方向：新能源销售经理 / 门店销售团队管理",
    city="广东优先 / 广州",
    overview=(
        "约4年新能源车销售与门店团队管理经验，覆盖乐道店长与特斯拉一线销售，并在字节跳动-懂车帝做过汽车商户经营。"
        "擅长拆解销量目标、督导线索跟进与展厅转化，用周/月复盘改进过程，并带教一线销售持续出结果。"
    ),
    lines=[
        ("团队管理：", "乐道店长同期直管10人，负责招聘、绩效评价与激励分配；团队季度目标完成率超200%，月人效5–7台，业绩大区前3、全国前10；累计带教21人，培养10人晋升。"),
        ("展厅成交：", "特斯拉任职2022.07—2023.12（无直管），按日/周/月跟踪留资、电联、试驾和成交；华南约600名销售中连续两季个人销冠，核心销售期9个月交付超过600台（9个月为交付统计口径，非任职时长）。"),
        ("过程复盘：", "乐道与特斯拉均建立过程看板，跟踪渠道、线索、试驾到成交与人效，定位落后环节并组织改进。"),
    ],
    skills=[
        ("销售团队管理：", "目标拆解、过程督导、招聘绩效激励与带教"),
        ("展厅成交推进：", "留资、电联、试驾到交付的全流程跟进"),
        ("数据复盘改进：", "周/月看板定位转化卡点并组织整改"),
        ("活动与增量：", "异业、自媒体、入企、置换等项目落地"),
        ("目标感与抗压：", "高压销售节奏下持续达成个人与团队结果"),
    ],
    dcd_tag="经营复盘｜线索与成交跟踪｜广州",
    dcd_bullets=[
        "个人深耕210家汽车/二手车商户，建立分层档案并跟踪线索与成交。年度综合业务目标达成130%，职级全国前30%，区域消耗年增约30%。体现数据复盘与经营改进能力。",
    ],
    onvo_tag="单店直管10人｜团队管理｜销量达成",
    onvo_bullets=[
        "担任店长，同期直管10人（主管、业务主管及一线销售），负责招聘、绩效与激励，以周/月看板跟踪渠道、线索、成交与人效并组织改进。团队季度目标完成率超200%，月人效5–7台，业绩大区前3、全国前10；累计带教21人，培养10人晋升。体现销售团队管理、过程督导与业绩攻坚能力。",
        "统筹店内人员、场地与车辆资源，组织异业、自媒体、入企、置换等活动与增量项目。自媒体订单占比0%→10%，企业员工订单6%→10%，置换订单8%→14%。体现资源协同、活动落地与转化提升能力。",
    ],
    tesla_tag="一线成交｜过程督导｜带教协同",
    tesla_bullets=[
        "作为一线销售（无直管下属），按日/周/月跟踪留资、电联、试驾和成交。华南约600名销售中连续两季个人销冠；核心销售期9个月交付超过600台（9个月为交付统计口径，非任职时长）。体现展厅成交与目标达成能力。",
        "协助员工辅导（非直管），被辅导员工由华南后10%提升至前30%，培养5名员工转正；置换线索转化率5%→10%。体现带教与过程改进能力。",
    ],
    confirm=[
        "无已确认的毛利、金融渗透率或装潢增值结果，干净版不写这些指标，也不包装成已精通全部增值业务。",
        "特斯拉段无直管，管理经验以乐道店长为准；职称仍保留销售主管。",
        "不写创业、英语及未确认数字（含「4→10台」、助手推算「前1%」、最高单日23台、费效比200%等）。",
        "JD未写学历硬门槛；专科与本科两段都保留，全日制口径未确认，干净版不作声明。",
    ],
    ann={
        "dir": "按JD岗位调整求职方向：新能源销售经理/门店销售团队管理",
        "contact": "本人确认2026-11-02：城市不限、广东优先",
        "overview": "JD职责1-3、要求1/2：团队管理·目标拆解·展厅成交｜事实库乐道店长+特斯拉一线",
        "line0": "JD职责1、要求1/2：销售主管或经理级管理｜事实库乐道：直管10人、招聘绩效激励、季度超200%、带教21/晋升10",
        "line1": "JD职责2、要求2：展厅成交与销量结果｜事实库特斯拉：无直管、两季个人销冠、9个月交付口径",
        "line2": "JD职责2/3、要求3：线索跟进质量与数据复盘｜事实库乐道看板+特斯拉日/周/月试驾成交跟踪",
        "sk1": "JD职责1/3：团队日常管理、目标拆解、新人培训",
        "sk2": "JD职责2：线索到店分配与成交跟进｜迁移自留资电联试驾交付，不写本店SOP已标准化",
        "sk3": "JD职责2、要求3：定期复盘成交与流失并整改",
        "sk4": "JD职责4：店头活动与销售落地｜乐道增量项目【简历】；不写团购/车展未确认场次",
        "sk5": "JD要求3/4：抗压与持续产出｜销冠、季度超200%",
        "dcd_title": "本人确认：雇主写法「字节跳动-懂车帝」；职务储备区域经理",
        "dcd_tag": "本岗以门店管理为主，懂车帝简写为复盘与线索跟踪",
        "dcd_b0": "迁移证据｜事实库懂车帝【本人】210家、130%、前30%、年增约30%；不写4→10台",
        "onvo_title": "职称保留店长｜2024.03—2025.06",
        "onvo_tag": "JD要求1：销售主管或经理级管理经历｜直管10人仅乐道【本人2026-11-02】",
        "onvo_b0": "JD职责1/3｜事实库/画像EV-ONVO-MANAGEMENT",
        "onvo_b1": "JD职责2/4｜事实库：人员场地车辆统筹、增量项目占比【简历】",
        "tesla_title": "职称保留销售主管｜2022.07—2023.12；本人确认无直管",
        "tesla_tag": "按本岗突出一线成交与过程督导",
        "tesla_b0": "JD职责2、要求2｜事实库【简历】两季个人销冠、9个月交付口径；删除「前1%」",
        "tesla_b1": "JD职责3、要求2带教｜被辅导员工后10%→前30%、培养5人转正；置换转化5%→10%",
        "edu": "本人确认2026-11-05：专科与本科都保留；全日制未确认",
        "confirm_h": "仅标注版：需本人确认与边界；干净版不写缺口。驾照不再单列。",
        "confirm0": "无毛利/金融渗透率/装潢增值确认结果",
        "confirm1": "特斯拉无直管，管理经验以乐道为准",
        "confirm2": "不写创业、英语及未确认数字",
        "confirm3": "全日制未确认，不作声明",
    },
))

# ----- 3 字节 邵女士 区域经理-加盟（汽车） -----
JOBS.append(dict(
    folder="字节跳动_区域经理-加盟-汽车方向",
    stem="贺文杰_字节跳动_区域经理-加盟-汽车方向",
    direction="求职方向：区域经理（汽车加盟） / 门店赋能",
    city="广东优先 / 深圳",
    overview=(
        "约4年汽车零售与商家经营经验，覆盖字节跳动-懂车帝商户经营、乐道店长及特斯拉一线销售。"
        "擅长用经营诊断和周/月复盘看清能力现状，把目标拆成可执行方案，并沉淀可复制的门店与销售方法。"
    ),
    lines=[
        ("商家经营：", "懂车帝个人深耕210家汽车/二手车商户，建立客户分层与经营档案；年度综合业务目标达成130%，职级全国前30%，区域消耗年增约30%。"),
        ("门店赋能：", "乐道店长同期直管10人，以周/月看板跟踪人效与转化并组织改进；团队季度目标完成率超200%，累计带教21人，培养10人晋升。"),
        ("方法沉淀：", "主导懂车帝大区跨区域目标拆解与复盘（非人事直管）；特斯拉将留资、电联、试驾到成交做成日/周/月过程管理，连续两季个人销冠。"),
    ],
    skills=[
        ("商家经营诊断：", "客户分层、经营档案、目标拆解与周/月复盘"),
        ("门店运营赋能：", "人效与线索到成交跟踪，销售动作带教与复制"),
        ("获客与市场：", "自媒体、异业、入企、置换等增量项目"),
        ("跨部门协同：", "参与推广包、客户政策与资源配置，联合复盘改进"),
        ("目标达成：", "以过程指标跟踪结果，持续推动目标达成"),
    ],
    dcd_tag="个人商户经营｜跨区域复盘｜广州",
    dcd_bullets=[
        "个人深耕210家汽车/二手车商户，建立客户分层与经营档案并跟进经营方案。年度综合业务目标达成130%，职级全国前30%，区域消耗年增约30%。体现商家经营诊断与结果达成能力。",
        "主导大区跨区域目标拆解与周/月复盘，组织其他区域同事分工并督办（非人事直管）；参与推广包、客户政策与资源配置调整。体现区域协同、策略落地与关系维护能力。",
    ],
    onvo_tag="单店经营｜人效管理｜方法带教",
    onvo_bullets=[
        "担任店长，同期直管10人，以周/月看板跟踪渠道、线索、成交与人效并组织改进。团队季度目标完成率超200%，月人效5–7台，业绩大区前3、全国前10；累计带教21人，培养10人晋升。体现门店运营赋能与方法论复制能力。",
        "统筹人员、场地与车辆资源，组织异业、自媒体、入企、置换等获客与市场项目。自媒体订单占比0%→10%，企业员工订单6%→10%，置换订单8%→14%。体现获客、市场活动与销售运营落地能力。",
    ],
    tesla_tag="销售过程管理｜方法沉淀",
    tesla_bullets=[
        "作为一线销售（无直管下属），按日/周/月跟踪留资、电联、试驾和成交。华南约600名销售中连续两季个人销冠；核心销售期9个月交付超过600台（9个月为交付统计口径，非任职时长）。体现销售运营与结果达成能力。",
    ],
    confirm=[
        "JD要求能适应长期出差，事实库未确认出差接受度；干净版不承诺出差。",
        "工作地深圳；本人已确认城市不限、广东优先，干净版已写深圳，最终是否接受由本人决定。",
        "现职为字节跳动-懂车帝储备区域经理，跨区域督办不是加盟商管理或人事直管；不写已有加盟商运营、NPS或客诉闭环经验。",
        "不写创业、英语及未确认数字（含「4→10台」、助手推算「前1%」、最高单日23台、费效比200%等）。",
    ],
    ann={
        "dir": "按JD岗位调整求职方向：区域经理（汽车加盟）/商家运营与门店赋能",
        "contact": "本人确认2026-11-02：城市不限、广东优先；本岗工作地深圳",
        "overview": "JD职责1/2：目标复盘、经营方法论、门店运营赋能｜事实库懂车帝商户+乐道店长",
        "line0": "JD职责1/2、要求2商家运营｜事实库懂车帝【本人】210家、130%、前30%、年增约30%",
        "line1": "JD职责2：帮助门店提升运营效率｜事实库乐道店长直管10人、季度超200%、带教21/晋升10",
        "line2": "JD职责1：过程指标与结果复盘、沉淀方法论｜懂车帝跨区域督办非直管；特斯拉过程管理与两季销冠",
        "sk1": "JD职责1：明确能力现状、输出经营方案｜客户分层与复盘，不写已给加盟商做过方案",
        "sk2": "JD职责2：销售运营与效率提升｜单店人效与带教，不写加盟店盈利数字",
        "sk3": "JD职责2：获客运营、市场及活动运营｜乐道增量项目",
        "sk4": "JD职责3：与中台协作、策略与激励｜参与推广包/客户政策/资源配置；无NPS或客诉闭环实证",
        "sk5": "JD职责1/3：过程与结果达成",
        "dcd_title": "本人确认：雇主写法「字节跳动-懂车帝」；现职储备区域经理，应聘同体系加盟区域经理",
        "dcd_tag": "按本岗突出商家经营与跨区域复盘，地点仍为广州（任职地）",
        "dcd_b0": "JD职责1/2｜事实库第三节懂车帝【本人】；不写4→10台",
        "dcd_b1": "JD职责1/3｜【本人】跨区域分工督办非人事直管；参与政策与资源配置，无P&L权限",
        "onvo_title": "职称保留店长｜2024.03—2025.06",
        "onvo_tag": "JD要求2：零售与门店运营｜直管10人仅乐道",
        "onvo_b0": "JD职责2｜事实库/画像EV-ONVO-MANAGEMENT",
        "onvo_b1": "JD职责2获客/市场/销售运营｜增量项目占比【简历】",
        "tesla_title": "职称保留销售主管｜2022.07—2023.12；无直管",
        "tesla_tag": "按本岗突出销售过程管理与方法沉淀",
        "tesla_b0": "JD职责1过程指标｜事实库【简历】两季个人销冠、9个月交付口径；删除「前1%」",
        "edu": "本人确认2026-11-05：专科与本科都保留；全日制未确认",
        "confirm_h": "仅标注版：需本人确认与边界；干净版不写缺口。驾照不再单列。",
        "confirm0": "长期出差接受度未确认，干净版不承诺",
        "confirm1": "工作地深圳需本人最终确认",
        "confirm2": "现职跨区域督办≠加盟商管理；不写NPS/客诉闭环",
        "confirm3": "不写创业、英语及未确认数字",
    },
))

# ----- 4 高德关女士 汽车广告销售 -----
JOBS.append(dict(
    folder="杭州高德云图_汽车行业广告销售专家",
    stem="贺文杰_杭州高德云图_汽车行业广告销售专家",
    direction="求职方向：汽车行业广告销售 / 商户与经销商业化",
    city="广东优先 / 广州",
    overview=(
        "约4年汽车行业销售与商业化经营经验，当前在字节跳动-懂车帝负责汽车/二手车商户广告与营销经营，并有特斯拉、乐道一线零售与门店经营背景。"
        "擅长客户开拓与持续经营，把需求转化为可落地的经营方案，并以目标达成为导向推进合作。"
    ),
    lines=[
        ("商户商业化：", "懂车帝个人深耕210家汽车/二手车商户的信息流广告与营销经营，年度综合业务目标达成130%，职级全国前30%，区域消耗年增约30%。"),
        ("客户开拓：", "直接开发10家新客户、召回约20家沉默客户，建立客户分层与经营档案，按商机阶段制定经营方案并跟进。"),
        ("销售结果：", "特斯拉华南约600名销售中连续两季个人销冠，核心销售期9个月交付超过600台（9个月为交付统计口径，非任职时长）；乐道店长团队季度目标完成率超200%。"),
    ],
    skills=[
        ("汽车行业商业化：", "汽车/二手车商户广告投放与营销经营"),
        ("客户需求跟进：", "分层经营、方案沟通与持续维护"),
        ("跨部门协同：", "参与推广包、客户政策与资源配置，推动执行落地"),
        ("经营分析：", "用线索与转化数据定位问题，输出可执行经营建议"),
        ("目标与抗压：", "以结果为导向，在明确目标下持续推进"),
    ],
    dcd_tag="汽车商户广告｜客户经营｜广州",
    dcd_bullets=[
        "个人负责广州北210家汽车/二手车商户的信息流广告与营销经营，年度综合业务目标达成130%，职级全国前30%，区域消耗年增约30%。体现汽车行业广告销售与商业目标达成能力。",
        "直接开发10家新客户、召回约20家沉默客户，建立分层档案并按商机阶段跟进。区域头部商户线索量增长约122%（270→约600条/月），成交量增长150%，稳定经营6个月。体现客户开拓、需求跟进与持续经营能力。",
        "参与推广包、客户政策与资源配置调整，主导大区跨区域目标拆解与周/月复盘（非人事直管）。体现内部资源协同与执行跟踪能力。",
    ],
    onvo_tag="门店经营｜客户触达",
    onvo_bullets=[
        "担任店长，同期直管10人，团队季度目标完成率超200%，月人效5–7台，业绩大区前3、全国前10。组织异业、自媒体、入企、置换等增量项目，自媒体订单占比0%→10%，置换订单8%→14%。体现客户触达与销售推进能力。",
    ],
    tesla_tag="销售推进｜客户经营",
    tesla_bullets=[
        "作为一线销售（无直管下属），华南约600名销售中连续两季个人销冠；核心销售期9个月交付超过600台（9个月为交付统计口径，非任职时长）。维护约5000名微信客户、4个500人意向群并持续跟进。体现销售推进、客户维护与目标达成能力。",
    ],
    confirm=[
        "本科两段学历均保留，全日制口径未确认，干净版不作全日制声明。",
        "「5年以上销售经验」为优先项，实际约4年，干净版不改写或夸大年限。",
        "懂车帝服务对象为汽车/二手车商户，不是汽车厂商或主机厂；不写已有高德地图商业化方案或厂商客情。",
        "不写「4→10台」、创业、英语及其他未确认数字（含助手推算「前1%」、最高单日23台、费效比200%等）。",
    ],
    ann={
        "dir": "按JD岗位调整求职方向：汽车行业广告销售/商户与经销商业化",
        "contact": "本人确认2026-11-02：城市不限、广东优先",
        "overview": "JD职责1-4、要求2：汽车商业化与客户经营｜事实库懂车帝商户广告为直接证据",
        "line0": "JD职责2/4、要求2经销商网络产品优先（迁移）｜事实库懂车帝【本人】210家、130%、前30%、年增约30%；对象是商户不是厂商",
        "line1": "JD职责1/3：拓展维护合作、跟踪需求｜事实库【本人】开发10家、召回约20家、分层经营档案",
        "line2": "JD要求4目标性与抗压｜特斯拉两季销冠、9个月交付口径；乐道季度超200%",
        "sk1": "JD要求2：熟悉汽车媒体/经销侧商业模式优先｜懂车帝信息流广告，不写高德产品经验",
        "sk2": "JD职责2/3：按客户需求跟进方案与交付｜经营方案与跟进，不写已做高德商业化方案整合",
        "sk3": "JD职责3、要求3：协调内部资源与跨部门协同｜参与推广包/政策/资源配置",
        "sk4": "JD职责4：洞察客户动态并推动商业目标｜线索/转化诊断；不写4→10台",
        "sk5": "JD要求4：目标性、抗压、沟通",
        "dcd_title": "本人确认：雇主写法「字节跳动-懂车帝」；职务储备区域经理",
        "dcd_tag": "按本岗突出汽车商户广告与客户经营",
        "dcd_b0": "JD职责2/4｜事实库第三节懂车帝【本人】210家、年度130%、前30%、年增约30%",
        "dcd_b1": "JD职责1｜【本人】开发10家、召回约20家；头部商户线索+122%、成交+150%、稳定6个月；按本人要求不写4→10台",
        "dcd_b2": "JD职责3｜参与资源配置；跨区域督办非人事直管",
        "onvo_title": "职称保留店长｜2024.03—2025.06",
        "onvo_tag": "本岗以商业化为主，乐道简写为销售推进与客户触达",
        "onvo_b0": "要求4销售结果佐证｜事实库乐道管理结果与增量占比【简历】",
        "tesla_title": "职称保留销售主管｜2022.07—2023.12；无直管",
        "tesla_tag": "按本岗突出销售推进与客户经营",
        "tesla_b0": "要求4｜事实库【简历】两季个人销冠、9个月交付口径、约5000微信客户；删除「前1%」",
        "edu": "本人确认2026-11-05：专科与本科都保留；全日制未确认；JD要求本科及以上",
        "confirm_h": "仅标注版：需本人确认与边界；干净版不写缺口。驾照不再单列。",
        "confirm0": "全日制未确认，不作声明",
        "confirm1": "5年以上为优先项，实际约4年，不夸大",
        "confirm2": "商户广告≠厂商/主机厂客情；不写高德产品经验",
        "confirm3": "不写4→10台、创业、英语及其他未确认数字",
    },
))


def build_one(job, annotate=False):
    doc = Document(str(BASE))
    contact = CONTACT_BASE + job["city"]
    ann = job["ann"]

    cell = doc.tables[0].rows[0].cells[0]
    paras = cell.paragraphs
    add_runs(paras[1]._p, [(job["direction"], True, 21, "007974")], annotate=ann["dir"] if annotate else None)
    add_runs(paras[2]._p, [(contact, False, 18, "5C6B7A")], annotate=ann["contact"] if annotate else None)

    src = doc.paragraphs
    tpl = {
        "spacer": deepcopy(src[0]._p),
        "h1": deepcopy(src[1]._p),
        "body": deepcopy(src[2]._p),
        "skill": deepcopy(src[7]._p),
        "job": deepcopy(src[13]._p),
        "tag": deepcopy(src[14]._p),
        "bullet": deepcopy(src[21]._p),
        "edu_h": deepcopy(src[64]._p),
        "edu1": deepcopy(src[65]._p),
        "edu2": deepcopy(src[66]._p),
    }
    tighten_spacing(tpl)

    body = doc.element.body
    sect = body.find(qn("w:sectPr"))
    for child in list(body):
        if child.tag == qn("w:p"):
            body.remove(child)

    def add(template, parts, annotate_key=None, keep_next=False):
        note = ann.get(annotate_key) if (annotate and annotate_key) else None
        elm = append_p(body, template, parts, annotate=note)
        if keep_next:
            set_keep_next(elm, True)
        return elm

    def h1(text, key=None):
        add(tpl["h1"], [(text, True, 23, "007974")], key)

    def job_title(company, title, dates, key=None):
        add(tpl["job"], [(company, True, 22, "1F2D3D"), (title, True, 22, "1F2D3D"), (dates, True, 19, "5C6B7A")], key, keep_next=True)

    def tagline(text, key=None):
        add(tpl["tag"], [(text, True, 19, "007974")], key, keep_next=True)

    def bullet(text, key=None):
        add(tpl["bullet"], [(text, False, 20, "1F2D3D")], key)

    def labeled(label, text, key=None):
        add(tpl["skill"], [(label, True, 20, "1F2D3D"), (text, False, 20, "1F2D3D")], key)

    sp = deepcopy(tpl["spacer"])
    for attr in list(sp.attrib):
        if attr.endswith("paraId") or attr.endswith("textId"):
            del sp.attrib[attr]
    body.append(sp)

    h1("职业概述")
    add(tpl["body"], [(job["overview"], False, 20, "1F2D3D")], "overview")
    for i, (lab, txt) in enumerate(job["lines"]):
        labeled(lab, txt, f"line{i}")

    h1("核心能力")
    for i, (lab, txt) in enumerate(job["skills"], 1):
        labeled(lab, txt, f"sk{i}")

    h1("工作经历")
    job_title("字节跳动-懂车帝", "｜储备区域经理｜", "2025.07—至今", "dcd_title")
    tagline(job["dcd_tag"], "dcd_tag")
    for i, t in enumerate(job["dcd_bullets"]):
        bullet(t, f"dcd_b{i}")

    job_title("乐道汽车", "｜店长｜", "2024.03—2025.06", "onvo_title")
    tagline(job["onvo_tag"], "onvo_tag")
    for i, t in enumerate(job["onvo_bullets"]):
        bullet(t, f"onvo_b{i}")

    job_title("特斯拉", "｜销售主管｜", "2022.07—2023.12", "tesla_title")
    tagline(job["tesla_tag"], "tesla_tag")
    for i, t in enumerate(job["tesla_bullets"]):
        bullet(t, f"tesla_b{i}")

    add(tpl["edu_h"], [("教育经历", True, 23, "007974")], "edu" if annotate else None, keep_next=True)
    add(tpl["edu1"], [("2020.09—2022.06　广东培正学院　行政管理｜本科", True, 18, "1F2D3D")], "edu" if annotate else None, keep_next=True)
    add(tpl["edu2"], [("2016.09—2019.06　广东工商学院　金融管理｜专科", False, 18, "5C6B7A")], "edu" if annotate else None)

    if annotate:
        h1("需本人确认（仅标注版，干净版未写）", "confirm_h")
        for i, note in enumerate(job["confirm"]):
            bullet(note, f"confirm{i}")

    if sect is not None:
        body.remove(sect)
        body.append(sect)

    outdir = ROOT / job["folder"]
    outdir.mkdir(parents=True, exist_ok=True)
    suffix = "_标注版" if annotate else ""
    path = outdir / f"{job['stem']}{suffix}.docx"
    doc.save(str(path))
    return path


if __name__ == "__main__":
    for job in JOBS:
        p1 = build_one(job, False)
        p2 = build_one(job, True)
        print("wrote", p1.name, p2.name)
