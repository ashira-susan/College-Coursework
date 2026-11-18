// Helper library for building the assignment .docx with docx-js
const fs = require("fs");
const path = require("path");
const D = require("docx");
const { Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle, AlignmentType,
  HeadingLevel, ImageRun, PageBreak } = D;

const FONT = "Calibri";
const MONO = "Consolas";
const CONTENT_W = 9638;           // A4, 2 cm margins (DXA)
const FIG_DIR = path.join(__dirname, "..", "figures");
const COLORS = { head: "1F3864", accent: "2E75B6", light: "DEEAF6", note: "FFF2CC", warn: "FCE4D6", ok: "E2EFDA", grey: "F2F2F2", border: "9DB2CC" };

let tblCount = 0, figCount = 0;
const numRefs = [];
let numCounter = 0;

// ---- inline markup: **bold**, `code`, _{sub}, ^{sup}
function runs(text, base = {}) {
  const out = [];
  const parts = String(text).split(/(\*\*[^*]+\*\*|(?<!\*)\*[^*\s][^*]*\*(?!\*)|`[^`]+`|_\{[^}]+\}|\^\{[^}]+\})/g).filter(x => x !== "");
  for (const p of parts) {
    if (p.startsWith("**")) out.push(new TextRun({ text: p.slice(2, -2), bold: true, font: FONT, ...base }));
    else if (p.startsWith("*")) out.push(new TextRun({ text: p.slice(1, -1), italics: true, font: FONT, ...base }));
    else if (p.startsWith("`")) out.push(new TextRun({ text: p.slice(1, -1), font: MONO, size: (base.size || 22) - 2, shading: { type: ShadingType.CLEAR, fill: "EEF2F7", color: "auto" }, ...stripSize(base) }));
    else if (p.startsWith("_{")) out.push(new TextRun({ text: p.slice(2, -1), subScript: true, font: FONT, ...base }));
    else if (p.startsWith("^{")) out.push(new TextRun({ text: p.slice(2, -1), superScript: true, font: FONT, ...base }));
    else out.push(new TextRun({ text: p, font: FONT, ...base }));
  }
  return out;
}
function stripSize(b) { const c = { ...b }; delete c.size; return c; }

const P = (text, o = {}) => new Paragraph({ children: runs(text, o.run || {}), alignment: o.align || AlignmentType.JUSTIFIED,
  spacing: { before: o.before ?? 0, after: o.after ?? 120, line: o.line ?? 276 }, keepNext: o.keepNext, indent: o.indent });
const H1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: t, font: FONT })], pageBreakBefore: true });
const H1n = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: t, font: FONT })] });
const H2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: t, font: FONT })] });
const H3 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun({ text: t, font: FONT })] });

const B = (text, level = 0) => new Paragraph({ numbering: { reference: "bul", level }, children: runs(text), spacing: { after: 60, line: 264 }, alignment: AlignmentType.LEFT });
function NL(items) {          // numbered list that restarts
  const ref = "num" + (++numCounter); numRefs.push(ref);
  return items.map(t => new Paragraph({ numbering: { reference: ref, level: 0 }, children: runs(t), spacing: { after: 60, line: 264 }, alignment: AlignmentType.LEFT }));
}
const bullets = (arr) => arr.map(x => B(x));

// ---- equation line:  centred, Cambria Math, with number on the right via tab
function EQ(text, num) {
  return new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 100 },
    tabStops: [{ type: D.TabStopType.CENTER, position: CONTENT_W / 2 }, { type: D.TabStopType.RIGHT, position: CONTENT_W }],
    children: [new TextRun({ text: "\t" + text, font: "Cambria Math", italics: false, size: 23 }), new TextRun({ text: num ? "\t(" + num + ")" : "", font: FONT, size: 21 })] });
}

// ---- code block
function CODE(lines) {
  const arr = Array.isArray(lines) ? lines : String(lines).split("\n");
  return arr.map((l, i) => new Paragraph({
    shading: { type: ShadingType.CLEAR, fill: "F3F4F6" }, spacing: { before: 0, after: 0, line: 240 },
    border: { left: { style: BorderStyle.SINGLE, size: 12, color: COLORS.accent, space: 6 } },
    indent: { left: 120 },
    children: [new TextRun({ text: l === "" ? " " : l, font: MONO, size: 17 })], keepLines: true, keepNext: i < arr.length - 1 && arr.length < 14
  })).concat([new Paragraph({ spacing: { after: 100 }, children: [] })]);
}

// ---- tables
const thin = { style: BorderStyle.SINGLE, size: 4, color: "B7C4D6" };
const borders = { top: thin, bottom: thin, left: thin, right: thin };
function cell(content, w, o = {}) {
  const c = typeof content === "object" && content !== null && !Array.isArray(content) ? content : { t: content };
  const fill = c.fill || o.fill;
  const paras = (Array.isArray(c.t) ? c.t : String(c.t ?? "").split("\n")).map(line => new Paragraph({
    alignment: c.align || o.align || AlignmentType.LEFT, spacing: { before: 20, after: 20, line: 250 },
    children: runs(line, { size: o.fs || 19, bold: c.bold || o.bold, color: c.color || o.color, italics: c.italics }) }));
  return new TableCell({ children: paras, width: { size: w, type: WidthType.DXA }, borders,
    shading: fill ? { type: ShadingType.CLEAR, fill, color: "auto" } : undefined,
    margins: { top: 40, bottom: 40, left: 90, right: 90 }, verticalAlign: D.VerticalAlign.CENTER, columnSpan: c.span });
}
function TBL(widths, rows, o = {}) {   // rows[0] is header unless o.noHeader
  const total = widths.reduce((a, b) => a + b, 0);
  const trs = rows.map((r, ri) => {
    const isH = !o.noHeader && ri === 0;
    let ci = 0;
    const cells = r.map((c) => {
      const span = (typeof c === "object" && c && c.span) || 1;
      const w = widths.slice(ci, ci + span).reduce((a, b) => a + b, 0); ci += span;
      return cell(c, w, { fill: isH ? COLORS.head : (o.firstColFill && ci - span === 0 ? COLORS.light : (o.zebra && ri % 2 === 0 ? "F7F9FC" : undefined)),
        color: isH ? "FFFFFF" : undefined, bold: isH || (o.firstColBold && ci - span === 0), fs: o.fs, align: isH ? AlignmentType.CENTER : (o.align && o.align[ci - span]) });
    });
    return new TableRow({ children: cells, tableHeader: isH, cantSplit: true });
  });
  return new Table({ width: { size: total, type: WidthType.DXA }, columnWidths: widths, rows: trs });
}
function CAP(text, kind = "Table") {
  const n = kind === "Table" ? ++tblCount : ++figCount;
  return new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 160 }, keepNext: kind === "Table" ? false : false,
    children: [new TextRun({ text: `${kind} ${n}: `, bold: true, font: FONT, size: 19, color: COLORS.head }), ...runs(text, { size: 19, italics: true })] });
}
function CAPT(text) { // table caption placed ABOVE the table, keepNext
  const n = ++tblCount;
  return new Paragraph({ alignment: AlignmentType.LEFT, spacing: { before: 120, after: 80 }, keepNext: true,
    children: [new TextRun({ text: `Table ${n}: `, bold: true, font: FONT, size: 19, color: COLORS.head }), ...runs(text, { size: 19, italics: true })] });
}

// ---- figures
function pngSize(file) {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}
function FIG(name, caption, widthPx = 610) {
  const file = path.join(FIG_DIR, name + ".png");
  const s = pngSize(file);
  const h = Math.round(widthPx * s.h / s.w);
  return [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 100, after: 40 }, keepNext: true,
      children: [new ImageRun({ type: "png", data: fs.readFileSync(file), transformation: { width: widthPx, height: h },
        altText: { title: caption, description: caption, name } })] }),
    CAP(caption, "Figure")];
}

// ---- call-out boxes (single-cell shaded table)
function BOX(title, lines, fill = COLORS.note, edge = "BF9000") {
  const kids = [];
  if (title) kids.push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: title, bold: true, font: FONT, size: 21, color: "1F2937" })] }));
  (Array.isArray(lines) ? lines : [lines]).forEach(l => kids.push(new Paragraph({ spacing: { after: 50, line: 258 },
    children: runs(l, { size: 20 }), alignment: AlignmentType.LEFT })));
  const bd = { style: BorderStyle.SINGLE, size: 8, color: edge };
  return new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: [CONTENT_W],
    rows: [new TableRow({ cantSplit: true, children: [new TableCell({ children: kids, width: { size: CONTENT_W, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill, color: "auto" }, borders: { top: bd, bottom: bd, left: { style: BorderStyle.SINGLE, size: 24, color: edge }, right: bd },
      margins: { top: 100, bottom: 100, left: 160, right: 160 } })] })] });
}
const NOTE = (t, l) => BOX(t, l, COLORS.light, COLORS.accent);
const KEY = (t, l) => BOX(t, l, COLORS.ok, "548235");
const TODO = (t, l) => BOX(t, l, COLORS.note, "BF9000");
function PLACE(text, h = 1400) {   // empty slot for the student's own screenshot / figure
  const bd = { style: BorderStyle.DASHED, size: 8, color: "BF9000" };
  return new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: [CONTENT_W],
    rows: [new TableRow({ height: { value: h, rule: D.HeightRule.ATLEAST }, cantSplit: true, children: [new TableCell({
      width: { size: CONTENT_W, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: "FFFBEA", color: "auto" },
      borders: { top: bd, bottom: bd, left: bd, right: bd }, verticalAlign: D.VerticalAlign.CENTER,
      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: runs("**[ INSERT YOUR OWN OUTPUT ]**  " + text, { size: 19, color: "7F6000" }) })] })] })] });
}
const SP = (n = 100) => new Paragraph({ spacing: { after: n }, children: [] });
const PB = () => new Paragraph({ children: [new PageBreak()] });

// ---- number formatting
const f = (x, d = 1) => Number(x).toFixed(d);
const pc = (x, d = 1) => (100 * Number(x)).toFixed(d) + " %";
const k = (x, d = 0) => (Number(x) / 1e3).toFixed(d) + "k";

module.exports = { D, P, H1, H1n, H2, H3, B, NL, bullets, EQ, CODE, TBL, CAP, CAPT, FIG, BOX, NOTE, KEY, TODO, PLACE, SP, PB,
  runs, f, pc, k, COLORS, FONT, MONO, CONTENT_W, numRefs };
