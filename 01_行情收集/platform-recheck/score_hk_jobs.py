# 注意：本脚本是早期误算稿，看板香港分页不要使用本文件产出。
# 官方打分以 hk-scored-2026-11-12.json 为准。
#!/usr/bin/env python3
"""按机会池现有规则分为香港官网岗位打分，供看板「香港」分页更新。

口径对齐 merge_platform_jobs_2026-11-05.py：
  方向底分 + 汽车/互联网/AI/大客户 + 薪资上限 + 广东，扣除统招/年限/总监级。
英语标题与 JD 增加与中文规则等价的识别，避免英文岗漏计。
学历按 careers/config/profile-supplement.json（2026-10-18 简历自报：
  广东培正学院行政管理本科 + 广东工商学院金融管理专科；全日制/统招未单独确认）。
  因此不再沿用旧脚本「本人专科」对普通本科要求扣 5 分；
  统招本科仍扣 10 分；明确只接受硕士/硕博仍扣 5 分。
香港地点不加「广东」10 分。大厂薪资未公布不加薪资分，亦不自动进入 ≥20K 机会池。
语言硬要求只记录、不加减分（事实库未记录英语/粤语/普通话能力）。
"""
from __future__ import annotations
import json, re, csv
from pathlib import Path
from datetime import datetime

HERE = Path(__file__).resolve().parent
COLLECT = HERE / "hk-2026-11-12-collect-1.json"
INDEX = HERE / "hk-2026-11-12-collect-1-index.json"
OUT_JSON = HERE / "hk-jobs-board-2026-11-12.json"
OUT_CSV = HERE / "hk-jobs-board-2026-11-12.csv"

# 与现有脚本相同的方向底分
DIR_SCORE = {
    "销售管理": 30,
    "销售/KA": 28,
    "销售及商业运营": 26,
    "商务渠道生态": 24,
    "市场营销": 20,
}
HIGH = 60
GD = re.compile(r"广州|深圳|东莞|佛山|珠海|惠州|中山|江门|肇庆|汕头|湛江|广东")
AUTO = re.compile(r"汽车|整车|车企|主机厂|二手车|乘用车|新能源车|4S|充电|特斯拉|懂车帝|电动车")
INTERNET = re.compile(
    r"互联网|广告|信息流|本地生活|平台|电商|抖音|字节|商业化|"
    r"\badvertis|\be-?commerce\b|\bdigital advertising\b|\bconsumer internet\b|(?<![A-Za-z])internet(?!\s+of\s+things)(?=\s+(companies|company|business|industry|marketing))|"
    r"ByteDance|Douyin",
    re.I,
)
AI = re.compile(r"(?<![A-Za-z])AI(?![A-Za-z])|人工智能|大模型", re.I)
KA_TITLE = re.compile(r"大客户|\bKA\b", re.I)
TEN_YEARS = re.compile(r"10\s*年|10\s*\+?\s*years?|1[0-9]\s*\+?\s*years?", re.I)
DIRECTOR = re.compile(r"总监|总经理|\bVP\b|大区总|\bDirector\b", re.I)
TONGZHAO = re.compile(r"统招|全日制")
MASTER_ONLY = re.compile(r"硕士|硕博|\bMaster'?s\b|\bMBA\b", re.I)
BACHELOR = re.compile(r"本科|Bachelor|BA/BS|\bB\.?A\.?\b|\bB\.?S\.?\b", re.I)


def direction(t: str) -> str:
    """标题方向分类：中文规则优先，并补英语等价词。"""
    # 职务本身是销售 IC 时，不因团队名含 GTM/Go-to-Market 而改分为销售运营
    sales_ic = re.search(r"Sales Specialist|Account Executive|Account Manager|Client Partner|大客户销售", t, re.I)
    if not sales_ic and re.search(
        r"运营|策略|销售支持|商业分析|SOP|销管|销售管理(?!.*经理)|"
        r"Sales Operations|Revenue Operations|GTM|Go-to-Market|Activation GTM",
        t,
        re.I,
    ):
        if re.search(r"销管|销售管理", t) and not re.search(r"运营", t):
            return "销售管理"
        if re.search(r"运营|策略|销售支持|商业分析|SOP|Sales Operations|Revenue Operations|GTM|Go-to-Market|Activation", t, re.I):
            return "销售及商业运营"
        return "销售管理"
    if re.search(
        r"总监|大区|区域经理|城市经理|负责人|主管|团队|店长|总经理|战区|"
        r"Sales Manager|Senior Manager",
        t,
        re.I,
    ) and re.search(
        r"销售|零售|区域|大区|战区|店长|城市|Sales|Retail|Store",
        t,
        re.I,
    ):
        return "销售管理"
    # Apple 零售店「Senior Manager, Hong Kong」标题无 Sales，但岗位即店面销售管理；
    # 仅在标题精确匹配该已采岗位时归入销售管理，避免把其他 Senior Manager 误分。
    if re.search(r"Senior Manager,\s*Hong Kong", t, re.I):
        return "销售管理"
    if re.search(r"渠道|BD|商务|生态|合作|拓展|招商|加盟|Partner|Business Development|\bBDR\b", t, re.I):
        return "商务渠道生态"
    if re.search(r"市场|营销|品牌|推广|Marketing|增长", t, re.I) and not re.search(r"销售|\bSales\b", t, re.I):
        return "市场营销"
    return "销售/KA"


def parse_salary(s: str):
    if not s or s in {"未公布", "未披露", "面议"}:
        return None, None, s or "未公布"
    m = re.match(r"\s*(\d*)\s*-\s*(\d+)\s*[kK]", s)
    if not m:
        return None, None, s
    lo = int(m.group(1)) if m.group(1) else None
    hi = int(m.group(2))
    if hi >= 100:
        return (round(lo / 12, 1) if lo else None), round(hi / 12, 1), s + "(年薪,已÷12)"
    return lo, hi, s


def normalize_posted(raw: str) -> tuple[str, str, bool]:
    """返回 (展示, 排序键 YYYY-MM-DD 或空, 可能过期)."""
    if not raw or raw == "未公布":
        return "未公布", "", False
    m = re.search(r"(20\d{2})[/-](\d{1,2})[/-](\d{1,2})", raw)
    if m:
        y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
        key = f"{y:04d}-{mo:02d}-{d:02d}"
        expired = y <= 2024
        return key if raw.strip() in {key, f"{y}/{mo}/{d}", f"{y}/{mo:02d}/{d:02d}"} else f"{key}", key, expired
    m = re.search(r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),\s*(20\d{2})", raw, re.I)
    if m:
        months = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()
        mo = months.index(m.group(1)[:3].title()) + 1
        d, y = int(m.group(2)), int(m.group(3))
        key = f"{y:04d}-{mo:02d}-{d:02d}"
        return key, key, y <= 2024
    return raw, "", False


def lang_short(s: str) -> str:
    return s or "未写明"


def edu_exp_short(edu: str, exp: str) -> str:
    parts = []
    if edu and edu != "未公布":
        parts.append(edu)
    else:
        parts.append("学历未公布")
    if exp and exp != "未公布":
        parts.append(exp)
    else:
        parts.append("年限未公布")
    return "；".join(parts)


def score_job(job: dict) -> dict:
    title = job.get("title") or ""
    company = job.get("company") or ""
    loc = job.get("location") or ""
    jd = job.get("jd_full") or ""
    edu = job.get("education") or ""
    exp = job.get("experience") or ""
    sal_raw = job.get("salary") or "未公布"
    lo, hi, sal_show = parse_salary(sal_raw)
    d = direction(title)
    txt = title + company + jd
    s = DIR_SCORE[d]
    why = [d]
    if AUTO.search(title + company):
        s += 25
        why.append("汽车行业(特斯拉/乐道/字节跳动-懂车帝)")
    elif INTERNET.search(txt):
        s += 15
        why.append("互联网/广告商业化(字节跳动-懂车帝)")
    if AI.search(txt):
        s += 5
        why.append("AI")
    if KA_TITLE.search(title):
        s += 5
        why.append("大客户经验")
    if hi:
        s += 15 if hi >= 50 else 10 if hi >= 35 else 5 if hi >= 20 else 0
        why.append(f"薪资上限{hi}K")
    else:
        why.append("薪资未公布(不加分，亦不自动入池)")
    if GD.search(loc):
        s += 10
        why.append("广东")
    # 学历：已自报本科，普通本科要求不扣；统招/全日制未确认仍扣；纯硕士要求扣 5
    edu_field = edu
    if TONGZHAO.search(edu_field):
        s -= 10
        why.append("要求统招/全日制本科(全日制口径未单独确认)")
    elif MASTER_ONLY.search(edu_field) and not BACHELOR.search(edu_field) and "or equivalent" not in edu_field.lower() and "或同等" not in edu_field:
        s -= 5
        why.append("要求硕士(无硕博证据)")
    elif BACHELOR.search(edu_field):
        why.append("要求本科(简历自报有本科，不扣分；统招/全日制未单独确认)")
    if TEN_YEARS.search(exp) or TEN_YEARS.search(title):
        s -= 10
        why.append("要求10年以上")
    if DIRECTOR.search(title) and d == "销售管理":
        s -= 5
        why.append("总监级需多店/大区管理")
    if d == "销售管理" and AUTO.search(txt):
        why.append("乐道店长直管10人；特斯拉段无直管下属")
    posted_show, posted_key, maybe_expired = normalize_posted(job.get("posted_or_updated") or "")
    if job.get("note") and "2022" in (job.get("note") or ""):
        maybe_expired = True
    score = max(0, min(100, s))
    in_pool = bool(hi and hi >= 20)
    return {
        "公司": company,
        "岗位": title,
        "城市": loc,
        "薪资原文": sal_show,
        "薪资下限K": lo,
        "薪资上限K": hi,
        "薪资标注": "" if hi else "未公布",
        "来源": job.get("source") or "官网",
        "URL": job.get("url") or "",
        "发布日期": posted_show,
        "发布日期排序": posted_key,
        "可能过期": maybe_expired,
        "过期说明": (job.get("note") or "发布于 2022-03-09，列表仍在公开搜索结果中") if maybe_expired else "",
        "语言硬要求": lang_short(job.get("languages_required") or ""),
        "学历要求": edu or "未公布",
        "年限要求": exp or "未公布",
        "学历年限": edu_exp_short(edu, exp),
        "工作许可": job.get("visa_or_work_auth") or "未公布",
        "方向分类": d,
        "匹配分": score,
        "匹配依据": "；".join(why),
        "进入机会池": in_pool,
        "完整JD已采": True,
        "抓取时间": job.get("collected_at") or "",
        "法律主体": job.get("legal_entity") or "",
        "职位编号": job.get("job_number") or "",
        "采集备注": job.get("note") or "",
    }


def one_line_reason(p: dict) -> str:
    """一句匹配理由：规则依据 + 关键缺口，不编造。"""
    base = p["匹配依据"]
    gaps = []
    lang = p["语言硬要求"]
    if "硬性" in lang or "required" in lang.lower() or "Fluency" in lang:
        gaps.append("语言硬要求在事实库中无英语/粤语/普通话记录，未计入加减分，需本人确认")
    if "要求10年以上" in base:
        gaps.append("年限门槛10年+")
    if p["可能过期"]:
        gaps.append("发布于2022-03-09，可能已过期")
    if p["薪资标注"] == "未公布":
        gaps.append("薪资未公布")
    # 角色缺口只引用已有事实边界，不新造经历
    title = p["岗位"]
    if re.search(r"Technical Sales|Solution Specialist|Workspace Sales|Cloud|Azure|Web3|Apple Pay", title, re.I):
        gaps.append("云/SaaS/支付或Web3产品销售与企业IT采购链路仍是已知缺口")
    if re.search(r"Client Solutions Manager", title, re.I):
        gaps.append("电商广告方案与媒体策划为主，平台广告经营可迁移但缺Meta广告产品证据")
    if re.search(r"Account Strategist|Industry Manager, Travel", title, re.I):
        gaps.append("广告客户经营可迁移，但粤语为硬性要求")
    if re.search(r"Senior Manager, Hong Kong", title, re.I):
        gaps.append("零售店面管理与乐道店长可部分对应，但是多年前的岗位")
    if re.search(r"GTM Director", title, re.I):
        gaps.append("偏GCR安全产品的GTM/销售激活，不是一线销售经理")
    if re.search(r"Enterprise Technical Sales Manager", title, re.I):
        gaps.append("要求12年企业销售及5年带队，职责还写主要服务EMEA客户")
    tail = "。".join(gaps)
    return f"{base}。{tail}" if tail else base


def main():
    jobs_raw = json.loads(COLLECT.read_text())
    index = json.loads(INDEX.read_text())
    scored = [score_job(j) for j in jobs_raw]
    for p in scored:
        p["匹配理由"] = one_line_reason(p)
    scored.sort(key=lambda r: (-r["匹配分"], r["发布日期排序"] or "", r["公司"], r["岗位"]))

    pending_detail = []
    for x in index:
        if x.get("relevant") is True and not x.get("detail_collected") and x.get("title"):
            pending_detail.append({
                "公司": x.get("company"),
                "岗位": x.get("title"),
                "城市": x.get("location") or "Hong Kong",
                "发布日期": x.get("posted_or_updated") or "未公布",
                "来源": x.get("source") or "官网",
                "URL": x.get("url") or "https://jobs.careers.microsoft.com/global/en/search",
                "URL说明": "索引未保存详情页链接，暂指向微软全球职位搜索（需按香港特区筛选）" if not x.get("url") else "",
                "匹配分": None,
                "匹配理由": "相关但未采集完整JD，按口径不编造、暂不打分。",
                "采集备注": x.get("note") or "",
                "完整JD已采": False,
            })

    portals = {
        "大厂香港官方招聘入口": [
            {"公司": "Meta", "状态": "已采集", "入口": "https://www.metacareers.com/jobsearch/?offices=Hong+Kong"},
            {"公司": "Google", "状态": "已采集", "入口": "https://www.google.com/about/careers/applications/jobs/results/?location=Hong%20Kong"},
            {"公司": "Apple", "状态": "已采集", "入口": "https://jobs.apple.com/en-us/search?location=hong-kong-HKG"},
            {"公司": "Amazon", "状态": "已采集", "入口": "https://amazon.jobs/content/en/locations/china/hong-kong-sar"},
            {"公司": "Microsoft", "状态": "已采集（3条相关岗待补完整JD）", "入口": "https://jobs.careers.microsoft.com/global/en/search", "筛选说明": "按香港特区筛选"},
            {"公司": "字节跳动", "状态": "待采集", "入口": "https://joinbytedance.com/search"},
            {"公司": "腾讯", "状态": "待采集", "入口": "https://careers.tencent.com/en-us/home.html"},
            {"公司": "阿里巴巴", "状态": "待采集", "入口": "https://talent.alibaba.com/en/home"},
        ],
        "香港招聘网站": [
            {"名称": "CTgoodjobs", "入口": "https://www.ctgoodjobs.hk/zh"},
            {"名称": "香港劳工处", "入口": "https://www.jobs.gov.hk/"},
            {"名称": "Jobsdb", "入口": "https://hk.jobsdb.com/"},
        ],
    }

    scanned = [x for x in index if x.get("title")]
    meta = {
        "生成": "2026-11-12 (Asia/Shanghai, UTC+8)",
        "数据来源": [
            "01_行情收集/platform-recheck/hk-2026-11-12-collect-1.json",
            "01_行情收集/platform-recheck/hk-2026-11-12-collect-1-index.json",
            "careers/config/preferences.json",
            "careers/config/profile-supplement.json",
            "01_行情收集/platform-recheck/merge_platform_jobs_2026-11-05.py",
        ],
        "打分说明": "规则分(方向+行业匹配+大客户+薪资上限+广东-统招/年限/总监级)，非正式能力评分。香港地点不加广东分。学历已按2026-10-18简历自报本科学历校正，不再按旧脚本「本人专科」扣普通本科要求。语言硬要求只记录不加减分。",
        "机会池规则": "招聘人民币月薪区间上界≥20K进入机会池；未知薪资单独保留，不编造。本批已采详情岗位薪资均为未公布，故进入机会池=否，仍在香港分页展示。",
        "索引扫描": {
            "标题记录数": len(scanned),
            "相关且已采详情": sum(1 for x in scanned if x.get("relevant") and x.get("detail_collected")),
            "相关但未采详情": len(pending_detail),
            "不相关/已跳过": sum(1 for x in scanned if x.get("relevant") is False),
            "涉及公司": sorted({x.get("company") for x in scanned if x.get("company")}),
        },
        "待采集公司": ["字节跳动", "腾讯", "阿里巴巴"],
        "海外工作许可": "preferences.json：overseas work authorization remains unconfirmed；本批签证要求均为未公布。",
        "岗位条数_已评分": len(scored),
        "岗位条数_待补JD": len(pending_detail),
    }
    out = {"meta": meta, "portals": portals, "jobs": scored, "pending_detail": pending_detail}
    OUT_JSON.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    cols = [
        "匹配分", "公司", "岗位", "方向分类", "城市", "薪资原文", "薪资标注",
        "语言硬要求", "学历年限", "发布日期", "可能过期", "匹配理由", "URL",
        "进入机会池", "抓取时间",
    ]
    with OUT_CSV.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, cols, extrasaction="ignore")
        w.writeheader()
        w.writerows(scored)
    print("wrote", OUT_JSON, "n=", len(scored))
    print("pending_detail", len(pending_detail))
    for r in scored:
        print(f"{r['匹配分']:3d} {r['方向分类']:8s} {r['公司']:10s} {r['岗位'][:60]}")
        print("    ", r["匹配依据"])
        print("    ", r["发布日期"], "过期" if r["可能过期"] else "", r["薪资原文"])

if __name__ == "__main__":
    main()
