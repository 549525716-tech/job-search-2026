from pathlib import Path
import json
import re
import subprocess

from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "outputs/upwork-ai-portfolio"
TMP = ROOT / "tmp/upwork-portfolio"
BIN = Path("/Users/MR/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/override")
for folder in (OUT, TMP):
    folder.mkdir(parents=True, exist_ok=True)

pdfmetrics.registerFont(TTFont("Arial", "/System/Library/Fonts/Supplemental/Arial.ttf"))
pdfmetrics.registerFont(TTFont("Arial-Bold", "/System/Library/Fonts/Supplemental/Arial Bold.ttf"))
INK = "17232C"
TEAL = "087F83"
GRAY = "596773"
LINE = "D9D9D9"
BLUE = "2865A0"


def label(c, x, y, text, size=24, color=INK, bold=False):
    c.setFillColor(HexColor("#" + color))
    c.setFont("Arial-Bold" if bold else "Arial", size)
    c.drawString(x, y, text)


def rule(c, y):
    c.setStrokeColor(HexColor("#" + LINE))
    c.setLineWidth(1)
    c.line(0, y, 1000, y)


def arrow(c, x1, x2, y):
    c.setStrokeColor(HexColor("#" + GRAY))
    c.setLineWidth(2)
    c.line(x1, y, x2, y)
    c.line(x2 - 8, y + 5, x2, y)
    c.line(x2 - 8, y - 5, x2, y)


def graphic(name, height, draw):
    path = TMP / f"{name}.pdf"
    c = canvas.Canvas(str(path), pagesize=(1000, height))
    c.setTitle(name.replace("_", " "))
    c.setAuthor("Wenjie He")
    draw(c)
    c.save()
    subprocess.run([str(BIN / "pdftoppm"), "-singlefile", "-r", "144", "-png", str(path), str(path.with_suffix(""))], check=True)
    return path.with_suffix(".png")


def overview(c):
    cols = [(0, "01", "Prioritize", "Decide who to visit", "and why it matters"),
            (346, "02", "Diagnose", "Find funnel friction", "and choose a test"),
            (688, "03", "Automate", "Prepare reports", "and verify completion")]
    for x, number, title, first, second in cols:
        label(c, x, 215, number, 28, TEAL, True)
        label(c, x, 165, title, 32, INK, True)
        label(c, x, 112, first, 24)
        label(c, x, 77, second, 24)
    rule(c, 40)


def priorities(c):
    for x, title, subtitle in [(0, "Business data", "Reports and IDs"), (350, "Rule engine", "Rank and explain"), (708, "Daily plan", "Actions and route")]:
        label(c, x, 292, title, 29, TEAL, True)
        label(c, x, 252, subtitle, 24)
    arrow(c, 250, 320, 275)
    arrow(c, 610, 680, 275)
    c.setFillColor(HexColor("#EDF3F7"))
    c.rect(0, 165, 1000, 60, fill=1, stroke=0)
    rule(c, 225)
    rule(c, 165)
    headings = [(12, "Priority"), (145, "Account"), (337, "Reason"), (688, "Next action")]
    for x, text in headings:
        label(c, x, 188, text, 24, INK, True)
    rows = [("1", "Account A", "Spend pace below plan", "Review budget and goals"),
            ("2", "Account B", "Clicks without leads", "Review listing conversion"),
            ("3", "Account C", "Account reactivation", "Confirm current needs")]
    for i, row in enumerate(rows):
        y = 141 - i * 51
        for (x, _), text in zip(headings, row):
            label(c, x, y, text, 23)
        rule(c, y - 15)
    for x in (0, 133, 325, 676, 1000):
        c.line(x, 24, x, 225)


def funnel(c):
    c.setFillColor(HexColor("#EDF3F7"))
    c.rect(0, 301, 1000, 51, fill=1, stroke=0)
    rule(c, 352)
    cols = [12, 218, 406, 606, 781]
    headers = ["Listing", "Impressions", "Clicks", "Leads", "Diagnosis"]
    for x, text in zip(cols, headers):
        label(c, x, 319, text, 24, INK, True)
    rows = [("Listing A", "100,000", "2,000", "40", "Low CTR"),
            ("Listing B", "100,000", "8,000", "24", "Low CVR")]
    rule(c, 301)
    for i, row in enumerate(rows):
        y = 264 - i * 49
        for x, text in zip(cols, row):
            label(c, x, y, text, 25)
        rule(c, y - 16)
    for x in (0, 206, 394, 594, 769, 1000):
        c.line(x, 199, x, 352)
    label(c, 0, 153, "A   CTR 2.0%  |  CVR 2.0%", 27, BLUE, True)
    label(c, 0, 113, "Test the main image and value proposition.", 24)
    label(c, 0, 59, "B   CTR 8.0%  |  CVR 0.3%", 27, TEAL, True)
    label(c, 0, 19, "Review price, details and the inquiry path.", 24)


def reporting(c):
    steps = [(0, "Match", "ID and period"), (253, "Validate", "Rules and gaps"),
             (508, "Review", "Exceptions"), (765, "Verify", "Saved state")]
    for x, title, sub in steps:
        label(c, x, 277, title, 30, TEAL, True)
        label(c, x, 237, sub, 24)
    for x1, x2 in [(173, 223), (429, 479), (685, 735)]:
        arrow(c, x1, x2, 267)
    rule(c, 206)
    for x, num, text in [(0, "214", "Unique completed records"), (535, "0", "Duplicate completed IDs")]:
        label(c, x, 131, num, 57, INK, True)
        label(c, x, 87, text, 26)
    label(c, 0, 28, "Saved run audit   |   Record completion, not proof of actual sales", 24, GRAY)


graphics = {
    "overview": graphic("workflow_overview", 260, overview),
    "priorities": graphic("prioritization_sample", 340, priorities),
    "funnel": graphic("funnel_sample", 365, funnel),
    "reporting": graphic("reporting_controls", 320, reporting),
}

doc = Document()
sec = doc.sections[0]
sec.page_width = Inches(8.5)
sec.page_height = Inches(11)
sec.top_margin = Inches(0.68)
sec.bottom_margin = Inches(0.65)
sec.left_margin = sec.right_margin = Inches(0.75)
sec.header_distance = sec.footer_distance = Inches(0.2)
styles = doc.styles
for name in ("Normal", "Title", "Subtitle", "Heading 1", "Heading 2", "Heading 3", "Caption"):
    st = styles[name]
    st.font.name = "Arial"
    st.font.color.rgb = RGBColor(0, 0, 0)
    st.paragraph_format.space_before = Pt(0)
    st.paragraph_format.space_after = Pt(6)
    st.paragraph_format.line_spacing = Pt(15)
    st.paragraph_format.widow_control = True
    st.element.get_or_add_rPr().append(OxmlElement("w:lang"))
    st.element.rPr[-1].set(qn("w:val"), "en-US")
styles["Normal"].font.size = Pt(11)
styles["Title"].font.size = Pt(30)
styles["Title"].font.bold = True
styles["Title"].paragraph_format.line_spacing = Pt(34)
styles["Title"].paragraph_format.space_after = Pt(14)
styles["Subtitle"].font.size = Pt(16)
styles["Subtitle"].font.italic = False
styles["Subtitle"].paragraph_format.line_spacing = Pt(20)
styles["Heading 1"].font.size = Pt(22)
styles["Heading 1"].paragraph_format.line_spacing = Pt(26)
styles["Heading 1"].paragraph_format.space_after = Pt(12)
styles["Heading 2"].font.size = Pt(12)
styles["Heading 2"].font.bold = True
styles["Heading 2"].paragraph_format.space_before = Pt(10)
styles["Heading 2"].paragraph_format.space_after = Pt(5)
styles["Caption"].font.size = Pt(9)
styles["Caption"].font.italic = False
styles["Caption"].font.bold = False
styles["Caption"].font.color.rgb = RGBColor.from_string(GRAY)
styles["Caption"].paragraph_format.line_spacing = Pt(12)
styles["Caption"].paragraph_format.space_after = Pt(9)
for st in styles:
    for border in st.element.findall(".//" + qn("w:pBdr")):
        border.getparent().remove(border)
    rpr = st.element.find(qn("w:rPr"))
    if rpr is not None:
        for spacing in rpr.findall(qn("w:spacing")):
            rpr.remove(spacing)

doc.core_properties.title = "AI Workflow Automation Portfolio"
doc.core_properties.subject = "Business workflow automation and operational analytics"
doc.core_properties.author = "Wenjie He"
doc.core_properties.keywords = "AI workflow, Python, business automation, data analysis"
doc.core_properties.comments = ""
all_text = []


def para(text, style=None, lead=None):
    all_text.append(text)
    p = doc.add_paragraph(style=style)
    if lead:
        assert text.startswith(lead)
        p.add_run(lead).bold = True
        p.add_run(text[len(lead):])
    else:
        p.add_run(text)
    return p


def heading(text):
    return para(text, "Heading 2")


def picture(name, caption):
    p = doc.add_paragraph()
    p.paragraph_format.line_spacing = 1.0
    p.paragraph_format.space_before = Pt(7)
    p.paragraph_format.space_after = Pt(5)
    p.paragraph_format.keep_with_next = True
    p.add_run().add_picture(str(graphics[name]), width=Inches(7))
    return para(caption, "Caption")


def new_page(kicker, title, summary):
    doc.add_page_break()
    p = para(kicker)
    p.runs[0].font.size = Pt(9)
    p.runs[0].bold = True
    p.paragraph_format.space_after = Pt(8)
    para(title, "Heading 1")
    para(summary)


para("WENJIE HE", "Subtitle")
para("AI Workflow\nAutomation Portfolio", "Title")
para("Practical tools for sales and operations teams", "Subtitle")
para("I turn fragmented business data into prioritized actions, clearer diagnostics and repeatable reporting workflows. My approach combines business process design, AI-assisted development and explicit checks on the output.")
picture("overview", "Selected internal projects built around real operating needs.")
heading("What I can help you deliver")
para("A daily sales worklist with clear priorities; a repeatable analysis that explains where a funnel breaks; or a reporting workflow that checks the data and records what actually completed.")
heading("Why my business background matters")
para("My automotive sales and operations experience includes Tesla, ONVO and Dongchedi. I have directly managed a 10-person team and personally managed a portfolio of 210 merchant accounts. This helps me define useful workflows, practical review steps and outputs that frontline users can act on.")
heading("My role in these projects")
para("I defined the business problems and rules, used AI-assisted coding to build and iterate the tools, and checked their outputs against the operating process. My focus is applied automation and analytics, not model training.")
para("The following cases are internal operating projects, not paid Upwork engagements. Employer names describe my background only. Example visuals use synthetic data unless explicitly identified as saved run results.", "Caption")

new_page("CASE STUDY 01", "Sales Prioritization and Route Planning",
         "An AI-assisted workbench that turns scattered account data into an explainable daily visit plan.")
heading("The business problem")
para("Account reviews relied on separate reports and manual judgment. Sales representatives needed to know which accounts required attention, why they mattered and what to do during the visit.")
picture("priorities", "Illustrative English output using synthetic accounts. Not a production screenshot or actual client data.")
heading("What I built")
para("I translated account-management needs into a local web workbench: Excel imports, merchant ID matching, rule-based opportunity screening, a ranked worklist and route planning. Each suggested visit carries a reason and a proposed action.")
para("AI explains structured results and suggests next steps. Deterministic rules retain control of thresholds and ranking. Freshness checks block automated projections when linked source periods do not align.")
heading("Results and evidence")
para("About 2 hours a day saved on my own planning and review, based on my estimate. All members of my team use the tool, based on my reported adoption. I also measured a 150% increase in my visit efficiency; this is not a team-wide benchmark.")
para("These results are self-reported, not a controlled study. The tool supports decisions; no revenue uplift is attributed to AI alone. The reviewed implementation is local, not a deployed multi-tenant service.", "Caption")
heading("Client application")
para("Useful for field sales, account reviews and service visits. A scoped version can deliver a data import, configurable priority rules, an explained worklist and a route output.")
para("Implementation: Python, JavaScript, HTML/CSS, Excel/JSON and map routing integration.", "Caption")

new_page("CASE STUDY 02", "Vehicle Listing Performance Diagnostics",
         "A repeatable analysis that separates visibility problems from conversion problems and turns them into specific tests.")
heading("The business problem")
para("Large listing reports showed activity but did not make it easy to choose an intervention. Low click-through and low inquiry conversion require different actions; one generic recommendation is not enough.")
picture("funnel", "Synthetic examples. Illustrative thresholds: CTR 5%, CVR 1%. Actual report benchmarks are calculated from its own data.")
heading("What I built")
para("I designed the diagnostic logic and an AI-assisted Python reporting pipeline. It validates source rows, groups listing performance and produces an Excel report plus an action summary. CTR is clicks divided by impressions; CVR is leads divided by clicks. Aggregate rates use summed counts, not averages of row percentages.")
heading("Documented output")
para("91,951 valid rows covering 32,232 unique listing IDs were analyzed in one saved report. The output identified 1,807 full listing-name groups with clicks but no leads, helping focus review on pricing, listing details and the inquiry path.")
para("Zero-conversion rows remain in the analysis. Diagnostic opportunity estimates are not realized leads. This run had no merchant lookup table, so it did not support merchant-level benchmarking.", "Caption")
heading("Client application")
para("The same approach can support marketplace listings, product catalogs and lead funnels. Deliverables include a cleaned data model, reproducible calculations, a diagnostic workbook and a prioritized test plan.")
para("Implementation: Python, pandas, NumPy and Excel. AI-assisted development and interpretation; code calculates the metrics.", "Caption")

new_page("CASE STUDY 03", "Auditable Reporting Automation",
         "A controlled workflow for repetitive reporting where completeness, identity matching and visible saved state matter.")
heading("The business problem")
para("Large reporting batches are easy to miscount or partially complete. A successful click does not prove that the right account, reporting period and values were saved.")
picture("reporting", "Actual aggregate counts from a saved internal run audit. No individual merchant records are shown.")
heading("What I built")
para("I organized the reporting process into a resumable queue with exact account IDs and reporting periods. Source checks, calculation rules and reviewable exceptions precede authorized form entry. Completion is recorded only after checking the resulting saved state.")
para("AI-assisted browser steps handle interface work; deterministic checks handle identity, duplicate detection and reconciliation. Uncertain cases remain visible for review rather than being silently treated as completed.")
heading("Documented output")
para("The saved audit recorded 214 completed merchant records, zero duplicate completed IDs and zero pending records. Reconciliation identified 14 additional records beyond an initial interface count of 200.")
para("This is saved run evidence, not a new live verification. Some fields in the source workflow were approved rule-based estimates, not observed transactions. Completion checks do not prove the factual accuracy of estimated sales.", "Caption")
heading("Client application")
para("Useful for recurring operational reports and structured data-entry workflows. A scoped version can include validation checks, an exception queue, a completion log and an operating guide. External writes require approval and permitted access.")
para("Implementation: Python, Excel/JSON, browser-assisted automation and persisted verification logs.", "Caption")

new_page("SERVICES", "What You Can Hire Me For",
         "Start with one business process, a representative sample and a clear definition of a useful result.")
heading("Sales workflow prototype")
para("Outcome: a repeatable way to decide which accounts need attention and what to do next.", lead="Outcome:")
para("Inputs: account exports, performance measures, business rules and location data where needed.", lead="Inputs:")
para("Deliverables: a structured import, agreed prioritization rules, an explained worklist, a lightweight interface and a usage guide. Routing is scoped to the available map provider and geography.", lead="Deliverables:")
heading("Funnel analysis and diagnostic reporting")
para("Outcome: a clearer view of where performance drops and which action to test first.", lead="Outcome:")
para("Inputs: listing, product or sales-funnel exports with agreed metric definitions.", lead="Inputs:")
para("Deliverables: a data-quality check, reusable analysis script, diagnostic workbook, visual summary and prioritized recommendations. Recommendations are hypotheses to validate, not guaranteed uplift.", lead="Deliverables:")
heading("Recurring reporting automation")
para("Outcome: less repetitive preparation and a clearer record of what is complete.", lead="Outcome:")
para("Inputs: recurring source files, an output template, reporting rules and access to approved systems when needed.", lead="Inputs:")
para("Deliverables: a repeatable preparation workflow, validation checks, exception handling, a completion log and a handover guide. Form submission is optional and separately approved.", lead="Deliverables:")
heading("Scope before scale")
para("The first milestone is a working prototype on an agreed sample. Cloud deployment, authentication, ongoing hosting, third-party API fees and maintenance need separate scope. I do not bypass platform restrictions or promise unattended operation in systems that require human verification.")

new_page("DELIVERY", "How We Work Together",
         "A small, testable workflow is the starting point. Expansion follows evidence that the output is useful and reliable.")
heading("1  Define the decision")
para("We identify the user, the recurring task and the action the output should support. I ask for a sample input, the current output and a definition of success before proposing the automation.")
heading("2  Build a bounded prototype")
para("I implement one agreed workflow using approved sample data. We keep business rules explicit, distinguish facts from estimates and show exceptions that need human review.")
heading("3  Validate against the source")
para("We compare records and totals, test missing and duplicate data, and review the recommendations. Where external writes are included, we verify the saved state rather than treating a click as success.")
heading("4  Hand over a repeatable process")
para("The handover includes the agreed scripts or interface, input requirements, an example output, a short runbook and known limitations. Maintenance and further integrations are agreed separately.")
heading("What acceptance looks like")
para("The agreed records reconcile to source; the same inputs reproduce the same calculations; missing data is visible; and the output answers the business question. AI-generated interpretation remains reviewable and separate from numerical truth.")
heading("Tools used in the selected projects")
para("Python, pandas, NumPy, JavaScript, HTML/CSS, Excel and JSON; AI-assisted development with Codex; browser-assisted workflows and map integrations where required. Tool choice follows the problem rather than a fixed platform stack.")
heading("Start a conversation on Upwork")
para("Send me a short description of the repetitive task, a sanitized sample and the result you need. I can help define a focused first milestone before expanding the workflow.")

for section in doc.sections:
    for footer in (section.footer, section.first_page_footer, section.even_page_footer):
        for p in footer.paragraphs:
            p.clear()
for p in doc.paragraphs:
    prop = p._p.get_or_add_pPr()
    grid = OxmlElement("w:snapToGrid")
    grid.set(qn("w:val"), "0")
    prop.append(grid)

text = "\n".join(all_text)
assert text.isascii(), "Public portfolio must use English ASCII text"
assert not re.search(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", text)
assert "/Users/" not in text
doc.save(OUT / "Wenjie_He_AI_Workflow_Portfolio.docx")
(TMP / "portfolio_text.txt").write_text(text)

entries = [
    {
        "title": "AI Assisted Sales Prioritization and Route Planning",
        "role": "Business workflow designer and AI assisted automation builder",
        "description": "I built an internal workbench that converts account reports into ranked visit priorities, reasons and suggested actions. Python and JavaScript handle imports, business rules and route planning; AI explains the results. Freshness checks block projections from misaligned sources. I report about two hours a day saved on my own planning and review, with adoption across my team. These are self-reported results, not a controlled ROI study. Portfolio examples use synthetic accounts.",
        "skills": ["Business Process Automation", "Python", "JavaScript", "Data Analysis", "Data Visualization"],
    },
    {
        "title": "Vehicle Listing Funnel Analytics and Diagnostic Reporting",
        "role": "Business analyst and AI assisted workflow builder",
        "description": "I designed a repeatable Python analysis to distinguish low click-through from low inquiry conversion and recommend specific tests. One saved report analyzed 91,951 valid rows covering 32,232 unique listing IDs. Outputs included an Excel diagnostic report and an action summary. Aggregate rates use summed counts, and zero-conversion rows remain visible. Opportunity estimates are diagnostic, not realized growth. The English examples use synthetic data.",
        "skills": ["Data Analysis", "Python", "pandas", "Microsoft Excel", "Data Visualization"],
    },
    {
        "title": "Auditable Reporting Automation with Completion Verification",
        "role": "Workflow designer and AI assisted automation builder",
        "description": "I organized an internal reporting workflow around exact IDs, source validation, a resumable queue and saved-state checks. A saved run audit recorded 214 completed records, zero duplicate completed IDs and zero pending records. Reconciliation found 14 records beyond the initial interface count. Some source fields were approved rule-based estimates, not observed transactions. The evidence demonstrates record completion and traceability, not independently verified sales or paid Upwork delivery.",
        "skills": ["Business Process Automation", "Python", "Data Validation", "Microsoft Excel", "Data Processing"],
    },
]
headline = "AI Workflow Automation | Python, Excel and Business Analytics"
overview_copy = """I build practical workflows that turn scattered business data into useful actions.

My background is in automotive sales and commercial operations, including direct team management and hands-on account management. I use that experience to define the business problem, build a focused tool with AI-assisted development, and check whether the output supports the real task.

I can help with:
- Sales prioritization and daily account worklists.
- Excel and CSV analysis, funnel diagnostics and reporting.
- Recurring reporting workflows with validation and exception handling.
- Lightweight internal tools and documented handover.

Selected internal projects include a sales prioritization and route workbench, a listing analysis covering 91,951 valid rows, and a reporting workflow with a saved audit of 214 completed records.

I keep calculations reproducible, missing data visible and AI-generated interpretation reviewable. These are internal operating projects, not paid Upwork engagements. I do not claim model-training expertise or guaranteed revenue uplift.

Share the task, a sanitized sample and the result you need. We can define a small first milestone and validate it before expanding."""
copy = ["# Upwork Profile and Portfolio Copy", "", "## Suggested Profile Headline", "", headline,
        "", "## Profile Overview", "", overview_copy]
for i, entry in enumerate(entries, 1):
    assert len(entry["title"]) <= 70
    assert len(entry["role"]) <= 100
    assert len(entry["description"]) <= 600
    assert len(entry["skills"]) <= 5
    copy += ["", f"## Portfolio Entry {i}", "", "### Title", "", entry["title"], "", "### Role", "", entry["role"],
             "", "### Description", "", entry["description"], "", "### Suggested Skills", "", ", ".join(entry["skills"])]
copy += ["", "## Publishing Notes", "",
         "These are proposed listings, not published projects. Confirm that you may publicly share employer-related project descriptions and aggregate metrics before uploading. Do not attach private workbooks, raw screenshots, credentials or contact information. Skill labels are suggestions; select the closest available tags in Upwork.", "",
         "The titles, roles and descriptions above fit the published limits of 70, 100 and 600 characters, with up to five skills per project. Platform fields may change.", "",
         "Source: [Upwork portfolio guidance](https://support.upwork.com/hc/en-us/articles/360016144974-How-to-enhance-your-freelancer-profile).", ""]
(OUT / "Upwork_Portfolio_Copy.md").write_text("\n".join(copy))
(TMP / "content_checks.json").write_text(json.dumps({"english_ascii": True, "contact_information": False,
    "entries": [{"title_length": len(e["title"]), "role_length": len(e["role"]), "description_length": len(e["description"])} for e in entries]}, indent=2))
print(OUT / "Wenjie_He_AI_Workflow_Portfolio.docx")
print(OUT / "Upwork_Portfolio_Copy.md")
