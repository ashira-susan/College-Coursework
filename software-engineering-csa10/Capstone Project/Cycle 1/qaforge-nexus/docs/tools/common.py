"""Shared helpers for building the QAForge Nexus deliverables."""
import json, os
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
DOCS = os.path.join(ROOT, 'docs')
DG = os.path.join(DOCS, 'diagrams'); SS = os.path.join(DOCS, 'screenshots')
DATA = json.load(open(os.environ.get('QAF_DATA_JSON', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data.json'))))
BRAND = RGBColor(0x1F, 0x4F, 0xD8)
TITLE = 'QAForge Nexus: A Web-Based Functional Testing and Software Validation Platform Utilizing Automated Black-Box Test Case Execution and Defect Identification Lifecycles'

def field(run, instr):
    for t, txt in (('begin', None), (None, instr), ('end', None)):
        if t:
            e = OxmlElement('w:fldChar'); e.set(qn('w:fldCharType'), t); run._r.append(e)
        else:
            e = OxmlElement('w:instrText'); e.set(qn('xml:space'), 'preserve'); e.text = txt; run._r.append(e)

def shade(cell, hexcolor):
    tcPr = cell._tc.get_or_add_tcPr(); s = OxmlElement('w:shd')
    s.set(qn('w:val'), 'clear'); s.set(qn('w:color'), 'auto'); s.set(qn('w:fill'), hexcolor); tcPr.append(s)

class Doc:
    def __init__(self, title, subtitle, kind):
        self.d = Document()
        s = self.d.sections[0]
        s.page_width, s.page_height = Cm(21), Cm(29.7)
        s.left_margin = s.right_margin = Cm(2.3); s.top_margin = s.bottom_margin = Cm(2.2)
        st = self.d.styles
        st['Normal'].font.name = 'Calibri'; st['Normal'].font.size = Pt(11)
        st['Normal'].paragraph_format.space_after = Pt(6); st['Normal'].paragraph_format.line_spacing = 1.15
        for n, sz in (('Heading 1', 18), ('Heading 2', 14), ('Heading 3', 12)):
            f = st[n].font; f.name = 'Calibri'; f.size = Pt(sz); f.bold = True; f.color.rgb = BRAND
        self.fig = 0; self.tab = 0
        # cover
        for _ in range(4): self.d.add_paragraph()
        p = self.d.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(kind.upper()); r.font.size = Pt(13); r.font.color.rgb = RGBColor(0x66, 0x66, 0x66); r.bold = True
        p = self.d.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(title); r.font.size = Pt(30); r.bold = True; r.font.color.rgb = BRAND
        p = self.d.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(subtitle); r.font.size = Pt(13); r.italic = True
        for _ in range(3): self.d.add_paragraph()
        self.table([['Project', 'QAForge Nexus v1.0.0'], ['Target organisation', 'Nexora Technologies (150 employees, 12 departments)'],
                    ['Document date', '4 November 2026'], ['Status', 'Final draft - editable source'],
                    ['Prepared by', '[Student / Team name - edit]'], ['Guide / Reviewer', '[Guide name - edit]']], header=False, widths=[4.5, 11.5])
        self.d.add_page_break()
        # footer page numbers
        fp = s.footer.paragraphs[0]; fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
        fp.add_run('QAForge Nexus - ' + kind + ' - Page '); field(fp.add_run(), 'PAGE')

    def toc(self):
        st = OxmlElement('w:updateFields'); st.set(qn('w:val'), 'true'); self.d.settings.element.append(st)
        self.h1('Table of Contents', page=False)
        p = self.d.add_paragraph(); field(p.add_run(), 'TOC \\o "1-3" \\h \\z \\u')
        self.p('(Right-click the table and choose "Update Field" in Word to refresh page numbers.)', italic=True)
        self.d.add_page_break()
    def h1(self, t, page=True):
        if page and self.d.paragraphs and len(self.d.paragraphs) > 14: self.d.add_page_break()
        self.d.add_heading(t, 1)
    def h2(self, t): self.d.add_heading(t, 2)
    def h3(self, t): self.d.add_heading(t, 3)
    def p(self, t, bold=False, italic=False, align=None):
        para = self.d.add_paragraph(); r = para.add_run(t); r.bold = bold; r.italic = italic
        if align == 'j': para.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        return para
    def bullets(self, items, style='List Bullet'):
        for i in items:
            para = self.d.add_paragraph(style=style)
            if isinstance(i, tuple):
                r = para.add_run(i[0]); r.bold = True; para.add_run(' ' + i[1])
            else: para.add_run(i)
    def numbered(self, items): self.bullets(items, 'List Number')
    def code(self, text):
        for line in text.strip('\n').split('\n'):
            para = self.d.add_paragraph(); para.paragraph_format.space_after = Pt(0)
            r = para.add_run(line); r.font.name = 'Consolas'; r.font.size = Pt(9)
            pPr = para._p.get_or_add_pPr(); sh = OxmlElement('w:shd'); sh.set(qn('w:val'), 'clear'); sh.set(qn('w:fill'), 'F2F4F8'); pPr.append(sh)
        self.d.add_paragraph()
    def table(self, rows, header=True, widths=None, caption=None, size=9.5):
        if caption:
            self.tab += 1; cp = self.d.add_paragraph(); r = cp.add_run(f'Table {self.tab}: {caption}'); r.bold = True; r.font.size = Pt(10)
        t = self.d.add_table(rows=len(rows), cols=len(rows[0])); t.style = 'Table Grid'; t.alignment = WD_TABLE_ALIGNMENT.CENTER
        if widths:
            t.autofit = False
            for j, w in enumerate(widths): t.columns[j].width = Cm(w)
        for i, row in enumerate(rows):
            for j, val in enumerate(row):
                c = t.cell(i, j); c.text = ''
                para = c.paragraphs[0]; para.paragraph_format.space_after = Pt(2)
                r = para.add_run(str(val)); r.font.size = Pt(size)
                if header and i == 0:
                    r.bold = True; r.font.color.rgb = RGBColor(255, 255, 255); shade(c, '1F4FD8')
                elif not header and j == 0:
                    r.bold = True; shade(c, 'EAF0FF')
                if widths: c.width = Cm(widths[j])
        self.d.add_paragraph()
    def img(self, path, caption, width=15.5):
        self.d.add_picture(path, width=Cm(width)); self.d.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
        self.fig += 1; cp = self.d.add_paragraph(); cp.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = cp.add_run(f'Figure {self.fig}: {caption}'); r.italic = True; r.font.size = Pt(9.5)
    def save(self, name):
        path = os.path.join(DOCS, name); self.d.save(path); print('wrote', path)

ORG = [('Executive Management', 'EXE', 6), ('Product Management', 'PRD', 10), ('Backend Engineering', 'BE', 26),
       ('Frontend Engineering', 'FE', 20), ('Mobile Engineering', 'MOB', 14), ('DevOps & SRE', 'OPS', 9),
       ('Quality Assurance', 'QA', 28), ('UX Design', 'UX', 8), ('Customer Support', 'SUP', 10),
       ('Sales & Marketing', 'SAL', 8), ('HR & Administration', 'HR', 6), ('Finance', 'FIN', 5)]
ROLES = [('Administrator', 'admin', 2), ('QA Manager', 'qa_manager', 3), ('QA Engineer', 'qa_engineer', 25),
         ('Developer', 'developer', 67), ('Product Owner', 'product_owner', 10), ('Viewer / Executive', 'viewer', 43)]
