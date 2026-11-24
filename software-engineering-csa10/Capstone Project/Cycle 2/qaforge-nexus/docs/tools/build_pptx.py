import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from common import DG, SS, DOCS

BL = RGBColor(0x1F, 0x4F, 0xD8); DK = RGBColor(0x1B, 0x22, 0x33); GR = RGBColor(0x55, 0x5F, 0x73)
prs = Presentation(); prs.slide_width, prs.slide_height = Inches(13.333), Inches(7.5)
blank = prs.slide_layouts[6]

def tb(s, x, y, w, h, text, size=18, bold=False, color=DK, align=None):
    t = s.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h)); tf = t.text_frame; tf.word_wrap = True
    lines = text if isinstance(text, list) else [text]
    for i, ln in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.text = ln; p.font.size = Pt(size); p.font.bold = bold; p.font.color.rgb = color; p.space_after = Pt(8)
        if align: p.alignment = align
    return t
def slide(title, notes=None):
    s = prs.slides.add_slide(blank)
    bar = s.shapes.add_shape(1, 0, 0, prs.slide_width, Inches(0.18)); bar.fill.solid(); bar.fill.fore_color.rgb = BL; bar.line.fill.background()
    tb(s, 0.6, 0.4, 12, 0.9, title, 30, True, BL)
    if notes: s.notes_slide.notes_text_frame.text = notes
    return s
def bullets(s, items, x=0.7, y=1.5, w=12, size=20):
    tb(s, x, y, w, 5.5, ['•  ' + i for i in items], size)
def pic(s, path, x, y, w=None, h=None):
    s.shapes.add_picture(path, Inches(x), Inches(y), width=Inches(w) if w else None, height=Inches(h) if h else None)

s = prs.slides.add_slide(blank)
bg = s.shapes.add_shape(1, 0, 0, prs.slide_width, prs.slide_height); bg.fill.solid(); bg.fill.fore_color.rgb = BL; bg.line.fill.background()
tb(s, 0.9, 1.6, 11.5, 1.2, 'QAForge Nexus', 54, True, RGBColor(255, 255, 255))
tb(s, 0.9, 3.0, 11.5, 1.8, 'A Web-Based Functional Testing and Software Validation Platform Utilizing Automated Black-Box Test Case Execution and Defect Identification Lifecycles', 22, False, RGBColor(255, 255, 255))
tb(s, 0.9, 5.6, 11, 0.8, ['Prepared by: [Name - edit]     Guide: [Guide - edit]', 'Target organisation: 100-200 employees (demo: Nexora Technologies, 150)', 'Data: Defects4J public dataset, 168 real bugs  |  Database: PostgreSQL 16'], 16, False, RGBColor(220, 230, 255))

s = slide('The problem')
bullets(s, ['Test cases in spreadsheets, results in CI logs, bugs in a separate tracker', 'Failed checks are re-typed into bug reports: slow, incomplete, duplicated',
            'Fixes are marked done without proof; regressions reach users', 'Managers cannot see requirement coverage or true defect flow',
            'Anyone can close a bug: no role separation, SLA or audit trail'])
s = slide('Objectives')
bullets(s, ['One platform: requirements -> test design -> execution -> defects', 'Automated black-box execution against any HTTP/JSON system',
            'Automatic defect identification with de-duplication and regression reopen', 'Governed 11-state lifecycle with RBAC, SLA and audit', 'Dashboards, traceability and CSV export for 100-200 employees'])
s = slide('Proposed solution: a closed quality loop')
tb(s, 0.7, 1.6, 12, 1, 'Requirement  ->  Test case  ->  Automated run  ->  Evidence  ->  Defect  ->  Fix  ->  Automated retest  ->  Verified  ->  Closed', 22, True, BL)
bullets(s, ['Failures become defects automatically, with request/response evidence', 'Retries separate flaky behaviour from genuine faults', 'Closed defects reopen themselves when a regression returns'], y=3.2)
s = slide('Public dataset: Defects4J (168 real bugs)')
bullets(s, ['Real, reproducible bugs from five open-source Java projects: Commons Lang 61, CLI 39, CSV 16, JFreeChart 26, Joda-Time 26',
            'Each bug becomes a defect with its upstream report link; each trigger test becomes a test case (369) linked to a requirement',
            'Employees, workflow progress and run history are simulated; defect titles derived from report id, class and exception',
            'Source: Just, Jalali, Ernst, ISSTA 2014 (MIT licence)'], size=19)
s = slide('Architecture'); pic(s, os.path.join(DG, 'architecture.png'), 3.4, 1.2, h=6.1)
s = slide('Defect lifecycle'); pic(s, os.path.join(DG, 'defect-lifecycle.png'), 3.2, 1.1, h=6.2)
s = slide('Automated run sequence'); pic(s, os.path.join(DG, 'run-sequence.png'), 3.2, 1.1, h=6.2)
s = slide('Data model (PostgreSQL 16)'); pic(s, os.path.join(DG, 'er-diagram.png'), 3.4, 1.1, h=6.2)
s = slide('Dashboard'); pic(s, os.path.join(SS, '02-dashboard.png'), 1.4, 1.3, w=10.5)
s = slide('Test cases and runs'); pic(s, os.path.join(SS, '05-test-cases.png'), 0.5, 1.4, w=6.2); pic(s, os.path.join(SS, '06-runs.png'), 6.8, 1.4, w=6.2)
s = slide('Defect register and traceability'); pic(s, os.path.join(SS, '07-defects.png'), 0.5, 1.4, w=6.2); pic(s, os.path.join(SS, '08-traceability.png'), 6.8, 1.4, w=6.2)
s = slide('Organisation and security')
bullets(s, ['150 employees, 12 departments, 6 roles (2 admins, 3 QA managers, 25 QA engineers, 67 developers, 10 product owners, 43 viewers)',
            'scrypt password hashing, signed tokens, 5-failure lockout, per-IP rate limit', 'RBAC on every route; developers act only on their own defects',
            'SSRF guard and secret redaction in evidence; full audit log'], size=19)
s = slide('Validation results')
bullets(s, ['22 of 22 automated tests pass on PostgreSQL 16 (13 platform + 9 dataset)', 'Demo target: 35 black-box cases, 11 planted faults', 'Run 1: 25 pass / 10 fail -> 10 defects raised and auto-assigned; flaky endpoint absorbed by retry',
            'Run 2: 0 duplicate defects (occurrence counters rise)', 'After fixes: 35/35 pass; after reverting a fix: closed defect reopened automatically'], size=19)
s = slide('Conclusion and future work')
bullets(s, ['Compact, self-hosted platform unifying test design, automated execution and defect governance', 'Future: browser UI automation, CI webhooks and scheduling, Jira/GitHub sync, SSO, distributed runners'])
prs.save(DOCS + '/06_Presentation.pptx'); print('saved')
