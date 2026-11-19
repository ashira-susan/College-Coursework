const fs = require("fs"), path = require("path");
const L = require("./lib");
const { D, FONT, COLORS } = L;
const { Document, Packer, Paragraph, TextRun, Footer, Header, PageNumber, AlignmentType, LevelFormat, BorderStyle } = D;
const ROOT = path.join(__dirname, "..");
const rd = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const names = ["t1_valid", "t2_invalid_tokens", "t3_unterminated_comment", "t4_security", "t5_edge_cases"];
const X = { res: JSON.parse(rd("expected/summary.json")), out: {}, tests: {}, lexer: rd("lexer.l"), makefile: rd("Makefile") };
for (const n of names) { X.out[n] = rd(`expected/${n}.out.txt`); X.tests[n] = rd(`tests/${n}.c`); }
const children = [...require("./part_a")(X), ...require("./part_b")(X), ...require("./part_c")(X)];

const numCfg = [{ reference: "bul", levels: [
  { level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } },
  { level: 1, format: LevelFormat.BULLET, text: "–", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1000, hanging: 270 } } } }] }];
for (const ref of L.numRefs) numCfg.push({ reference: ref, levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 340 } } } }] });
const hs = (size, color) => ({ run: { font: FONT, size, bold: true, color } });
const doc = new Document({
  creator: "Student", title: "CSA1406 Assignment 1 - LEX-Based Lexical Analyzer for Secure Source Code Processing",
  styles: { default: { document: { run: { font: FONT, size: 22 } } }, paragraphStyles: [
    { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, ...hs(34, COLORS.head), paragraph: { spacing: { before: 120, after: 160 }, keepNext: true, outlineLevel: 0 } },
    { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, ...hs(27, COLORS.accent), paragraph: { spacing: { before: 240, after: 100 }, keepNext: true, outlineLevel: 1 } },
    { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, ...hs(23, COLORS.head), paragraph: { spacing: { before: 160, after: 60 }, keepNext: true, outlineLevel: 2 } } ] },
  numbering: { config: numCfg },
  sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "B7C4D6", space: 2 } },
      children: [new TextRun({ text: "CSA1406 Compiler Design – Assignment 1 – LEX-Based Lexical Analyzer", font: FONT, size: 17, color: "6B7280" })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
      new TextRun({ text: "Page ", font: FONT, size: 18, color: "6B7280" }), new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 18, color: "6B7280" }),
      new TextRun({ text: " of ", font: FONT, size: 18, color: "6B7280" }), new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 18, color: "6B7280" })] })] }) },
    children }],
});
const out = path.join(ROOT, "CSA1406_Assignment1_Lexical_Analyzer.docx");
Packer.toBuffer(doc).then(b => { fs.writeFileSync(out, b); console.log("written", out, b.length); });
