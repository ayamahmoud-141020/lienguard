/**
 * Generates the fictional demo batch in samples/: spreadsheets, waiver/COI PDFs in
 * several visual styles, a fixture extraction per PDF (used by FixtureExtractor in
 * tests/CI) and the hand-written expected results. Run: pnpm samples
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import * as XLSX from "xlsx";
import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { COIS, DEMO_TODAY, GC, INJECTION_TEXT, PAYMENTS, PROJECTS, SUBS, WAIVERS, INBOUND_WAIVERS, type CoiDoc, type WaiverDoc } from "./sample-scenarios";
import type { ExtractionT } from "../src/ai/schemas";

type Fonts = { regular: PDFFont; bold: PDFFont; serif: PDFFont; serifBold: PDFFont; mono: PDFFont; italic: PDFFont };

const BLACK = rgb(0.08, 0.09, 0.11);
const GREY = rgb(0.45, 0.47, 0.5);
const LIGHT = rgb(0.82, 0.84, 0.87);

function sub(code: string) {
  const s = SUBS.find((x) => x.code === code);
  if (!s) throw new Error(`unknown sub ${code}`);
  return s;
}
function project(code: string) {
  const p = PROJECTS.find((x) => x.code === code);
  if (!p) throw new Error(`unknown project ${code}`);
  return p;
}
function payment(id: string) {
  const p = PAYMENTS.find((x) => x.id === id);
  if (!p) throw new Error(`unknown payment ${id}`);
  return p;
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > width && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** Simple top-down writer for one page. */
class Pen {
  y: number;
  constructor(
    public page: PDFPage,
    public f: Fonts,
    public color: RGB = BLACK,
    public left = 60,
    public width = 492,
    public tilt = 0,
  ) {
    this.y = page.getHeight() - 60;
  }
  text(t: string, o: { font?: PDFFont; size?: number; x?: number; color?: RGB; gap?: number } = {}) {
    const size = o.size ?? 10;
    this.page.drawText(t, { x: o.x ?? this.left, y: this.y, size, font: o.font ?? this.f.regular, color: o.color ?? this.color, rotate: degrees(this.tilt) });
    this.y -= o.gap ?? size + 5;
  }
  para(t: string, o: { font?: PDFFont; size?: number; color?: RGB } = {}) {
    const size = o.size ?? 10;
    for (const l of wrap(t, o.font ?? this.f.regular, size, this.width)) this.text(l, { ...o, size, gap: size + 3.5 });
    this.y -= 6;
  }
  field(label: string, value: string, o: { labelWidth?: number; size?: number } = {}) {
    const size = o.size ?? 10;
    this.page.drawText(label, { x: this.left, y: this.y, size, font: this.f.bold, color: this.color, rotate: degrees(this.tilt) });
    this.page.drawText(value, { x: this.left + (o.labelWidth ?? 150), y: this.y, size, font: this.f.regular, color: this.color, rotate: degrees(this.tilt) });
    this.page.drawLine({ start: { x: this.left + (o.labelWidth ?? 150) - 4, y: this.y - 3 }, end: { x: this.left + this.width, y: this.y - 3 }, thickness: 0.5, color: LIGHT });
    this.y -= size + 10;
  }
  rule(gap = 12) {
    this.page.drawLine({ start: { x: this.left, y: this.y + 4 }, end: { x: this.left + this.width, y: this.y + 4 }, thickness: 0.8, color: this.color });
    this.y -= gap;
  }
  space(n: number) {
    this.y -= n;
  }
}

/** A deterministic "handwritten" scribble. */
function drawnSignature(page: PDFPage, x: number, y: number, seed: number, color: RGB) {
  let d = "M 0 0";
  for (let i = 1; i <= 9; i++) {
    const dx = i * 13;
    const dy = ((seed * (i + 3)) % 17) - 8;
    d += ` C ${dx - 8} ${dy + 14}, ${dx - 4} ${dy - 12}, ${dx} ${dy}`;
  }
  page.drawSvgPath(d, { x, y, borderColor: color, borderWidth: 1.2 });
}

function signatureBlock(pen: Pen, w: WaiverDoc, seed: number) {
  pen.space(8);
  const lineY = pen.y;
  if (w.signature?.kind === "drawn") drawnSignature(pen.page, pen.left + 115, lineY + 6, seed, rgb(0.1, 0.18, 0.45));
  if (w.signature?.kind === "typed") pen.page.drawText(`/s/ ${w.signature.name}`, { x: pen.left + 115, y: lineY + 2, size: 12, font: pen.f.italic, color: pen.color });
  pen.page.drawText("Claimant's Signature:", { x: pen.left, y: lineY, size: 10, font: pen.f.bold, color: pen.color });
  pen.page.drawLine({ start: { x: pen.left + 110, y: lineY - 3 }, end: { x: pen.left + 360, y: lineY - 3 }, thickness: 0.7, color: pen.color });
  pen.y -= 22;
  pen.field("Claimant's Title:", w.signature?.title ?? "");
  pen.field("Date of Signature:", w.signature ? "November 12, 2026" : "");
}

function waiverHeading(w: WaiverDoc): string {
  const cond = w.type === "conditional" ? "CONDITIONAL" : "UNCONDITIONAL";
  const scope = w.scope === "final" ? "FINAL" : "PROGRESS";
  return `${cond} WAIVER AND RELEASE ON ${scope} PAYMENT`;
}

function releaseParagraph(w: WaiverDoc, claimant: string, customer: string, job: string): string {
  if (w.type === "conditional") {
    return `This document waives and releases lien, stop payment notice and payment bond rights that the claimant (${claimant}) has for labor and service provided, and equipment and material delivered, to the customer (${customer}) on this job (${job}) through the Through Date of this document, ONLY when the claimant has received payment of ${w.amountText}. Rights based on labor or material furnished after the Through Date are not affected. Until that payment is received, this document has no effect.`;
  }
  return `The claimant (${claimant}) has been paid and has received a progress payment in the sum of ${w.amountText} for labor and service provided, and equipment and material delivered, to the customer (${customer}) on this job (${job}), and does hereby waive and release any lien, stop payment notice and payment bond rights the claimant has through the Through Date of this document. This release covers only that payment.`;
}

function drawCaStyle(page: PDFPage, f: Fonts, w: WaiverDoc, scan: boolean) {
  const p = payment(w.payment);
  const s = sub(p.sub);
  const pr = project(p.project);
  const color = scan ? rgb(0.42, 0.43, 0.46) : BLACK;
  const pen = new Pen(page, f, color, 60, 492, scan ? 0.8 : 0);
  pen.text(waiverHeading(w), { font: f.bold, size: 13, gap: 22 });
  pen.para("NOTICE: THIS DOCUMENT WAIVES THE CLAIMANT'S LIEN, STOP PAYMENT NOTICE, AND PAYMENT BOND RIGHTS FOR THE AMOUNT STATED. READ IT BEFORE SIGNING. (Fictional demo form modeled on common progress-payment releases.)", { font: f.bold, size: 8.5 });
  pen.text("Identifying Information", { font: f.bold, size: 11, gap: 18 });
  pen.field("Name of Claimant:", s.legal);
  pen.field("Name of Customer:", GC.name);
  pen.field("Job Location:", `${pr.name}, ${pr.address}`);
  pen.field("Owner:", pr.owner);
  pen.field("Through Date:", w.throughText);
  pen.space(6);
  pen.text(w.type === "conditional" ? "Conditional Waiver and Release" : "Unconditional Waiver and Release", { font: f.bold, size: 11, gap: 16 });
  if (scan) {
    // Smudged scan: the amount is blurred out in the paragraph and the payment line.
    pen.para(releaseParagraph({ ...w, amountText: "$11,0_ _.00" }, s.legal, GC.name, pr.name), { size: 9.5 });
  } else pen.para(releaseParagraph(w, s.legal, GC.name, pr.name), { size: 9.5 });
  pen.text("Exceptions", { font: f.bold, size: 11, gap: 16 });
  pen.para("This document does not affect: disputed claims for extras in the amount of: $0.00", { size: 9.5 });
  if (scan) {
    pen.field("Amount of Payment:", "$11,0");
    page.drawRectangle({ x: pen.left + 178, y: pen.y + 17, width: 60, height: 14, color: rgb(0.55, 0.56, 0.58), opacity: 0.85 });
  } else pen.field("Amount of Payment:", w.amountText);
  pen.space(4);
  pen.text("Signature", { font: f.bold, size: 11, gap: 16 });
  signatureBlock(pen, w, 7);
  if (scan) {
    // Deterministic speckle noise to look like a poor photocopy.
    for (let i = 0; i < 260; i++) {
      const x = 40 + ((i * 97) % 530);
      const y = 40 + ((i * 193) % 720);
      page.drawRectangle({ x, y, width: 1 + (i % 3), height: 1 + ((i * 7) % 3), color: rgb(0.5, 0.5, 0.52), opacity: 0.6 });
    }
    page.drawRectangle({ x: 0, y: 0, width: 612, height: 792, color: rgb(0.9, 0.88, 0.82), opacity: 0.18 });
  }
}

function drawTxStyle(page: PDFPage, f: Fonts, w: WaiverDoc) {
  const p = payment(w.payment);
  const s = sub(p.sub);
  const pr = project(p.project);
  const pen = new Pen(page, f);
  pen.text(`WAIVER AND RELEASE OF LIEN UPON ${w.type.toUpperCase()} ${w.scope === "final" ? "FINAL" : "PROGRESS"} PAYMENT`, { font: f.serifBold, size: 12.5, gap: 20 });
  pen.para("NOTICE: This document waives rights effective on its execution as stated below. A person should not execute it unless the stated conditions are met. (Fictional demo form.)", { font: f.serif, size: 9 });
  pen.field("Project:", pr.name, { labelWidth: 120 });
  pen.field("Job No.:", `${pr.code}-${p.invoice}`, { labelWidth: 120 });
  pen.field("Property address:", pr.address, { labelWidth: 120 });
  pen.field("Owner:", pr.owner, { labelWidth: 120 });
  pen.field("Customer:", GC.name, { labelWidth: 120 });
  pen.space(4);
  pen.para(
    w.type === "unconditional"
      ? `The signer of this document has been paid and has received a progress payment in the sum of ${w.amountText} for all labor, services, equipment, or materials furnished to the property or to ${GC.name} on the property through ${w.throughText}, and does hereby waive and release any mechanic's lien right, any right arising from a payment bond, and any rights under the laws of the State of Texas relating to payment, to the extent of that payment, through that date.`
      : `On receipt by the signer of payment of ${w.amountText}, the signer waives and releases its lien and payment bond rights for work through ${w.throughText}. This waiver is effective only on receipt of that payment.`,
    { font: f.serif, size: 10 },
  );
  pen.para("Exceptions: none.", { font: f.serif, size: 10 });
  pen.field("Claimant:", s.legal, { labelWidth: 120 });
  signatureBlock(pen, w, 11);
  pen.space(8);
  pen.rule(16);
  pen.text("NOTARY ACKNOWLEDGMENT", { font: f.serifBold, size: 11, gap: 16 });
  pen.text("STATE OF TEXAS  §   COUNTY OF TRAVIS  §", { font: f.serif, size: 10, gap: 16 });
  if (w.notarized) {
    pen.para(`Sworn to and subscribed before me on November 12, 2026 by ${w.signature?.name ?? ""}, ${w.signature?.title ?? ""} of ${s.legal}.`, { font: f.serif, size: 10 });
    drawnSignature(page, pen.left + 150, pen.y + 4, 5, BLACK);
    pen.text("Notary Public signature: ____________________________", { font: f.serif, size: 10, gap: 14 });
    pen.text("Rosa Delgado, Notary Public, State of Texas · Commission expires 06/30/2029", { font: f.serif, size: 9, gap: 14 });
    page.drawCircle({ x: pen.left + 440, y: pen.y - 20, size: 34, borderColor: rgb(0.1, 0.2, 0.5), borderWidth: 1.5 });
    page.drawText("NOTARY", { x: pen.left + 420, y: pen.y - 18, size: 9, font: f.bold, color: rgb(0.1, 0.2, 0.5) });
    page.drawText("SEAL", { x: pen.left + 428, y: pen.y - 29, size: 9, font: f.bold, color: rgb(0.1, 0.2, 0.5) });
  } else {
    pen.text("Sworn to and subscribed before me on ______________ by ______________________.", { font: f.serif, size: 10, gap: 16 });
    pen.text("Notary Public signature: ____________________________", { font: f.serif, size: 10, gap: 14 });
    pen.text("(seal)", { font: f.serif, size: 9, color: GREY });
  }
}

function drawLetterStyle(page: PDFPage, f: Fonts, w: WaiverDoc) {
  const p = payment(w.payment);
  const s = sub(p.sub);
  const pr = project(p.project);
  page.drawRectangle({ x: 0, y: 742, width: 612, height: 50, color: rgb(0.12, 0.25, 0.32) });
  page.drawText(s.legal.toUpperCase(), { x: 60, y: 766, size: 14, font: f.bold, color: rgb(1, 1, 1) });
  page.drawText(`${s.email} · License on file`, { x: 60, y: 751, size: 8.5, font: f.regular, color: rgb(0.85, 0.9, 0.92) });
  const pen = new Pen(page, f);
  pen.y = 705;
  pen.text("November 12, 2026", { gap: 22 });
  pen.text(`To: ${GC.name}`, { gap: 14 });
  pen.text(GC.address, { gap: 22, color: GREY, size: 9 });
  pen.text(`Re: ${w.scope === "final" ? "Final" : "Partial"} Lien Waiver (${w.type === "conditional" ? "Conditional" : "Unconditional"}) · ${pr.name}`, { font: f.bold, size: 11, gap: 22 });
  pen.para(
    w.type === "conditional"
      ? `Upon receipt of payment in the amount of ${w.amountText} for invoice ${p.invoice}, ${s.legal} will waive and release all mechanic's lien and bond rights against ${pr.name} (owner: ${pr.owner}) for labor and materials furnished through ${w.throughText}. This waiver is conditioned on that payment actually clearing and is void if payment is not received.`
      : `${s.legal} acknowledges receipt of payment in the amount of ${w.amountText} for invoice ${p.invoice} and hereby unconditionally waives and releases all mechanic's lien and bond rights against ${pr.name} (owner: ${pr.owner}) for labor and materials furnished through ${w.throughText}.`,
  );
  pen.para("Exceptions: none. Retention is not covered by this waiver.");
  pen.field("Amount:", w.amountText, { labelWidth: 110 });
  pen.field("Through date:", w.throughText, { labelWidth: 110 });
  pen.field("Customer:", GC.name, { labelWidth: 110 });
  pen.space(10);
  pen.text("Sincerely,", { gap: 34 });
  if (w.signature?.kind === "drawn") drawnSignature(page, pen.left, pen.y + 22, 3, rgb(0.1, 0.18, 0.45));
  if (w.signature?.kind === "typed") page.drawText(`/s/ ${w.signature.name}`, { x: pen.left, y: pen.y + 14, size: 12, font: f.italic, color: BLACK });
  page.drawLine({ start: { x: pen.left, y: pen.y + 8 }, end: { x: pen.left + 220, y: pen.y + 8 }, thickness: 0.7, color: BLACK });
  pen.text(w.signature ? `${w.signature.name}, ${w.signature.title}` : "Name / Title: ______________________", { gap: 14 });
  pen.text(s.legal, { color: GREY, size: 9 });
  if (w.variant === "injection") {
    pen.space(40);
    pen.para(INJECTION_TEXT, { size: 7, color: rgb(0.72, 0.73, 0.75) });
  }
}

function drawCoi(page: PDFPage, f: Fonts, c: CoiDoc) {
  const s = sub(c.sub);
  const box = (x: number, y: number, w: number, h: number) => page.drawRectangle({ x, y, width: w, height: h, borderColor: BLACK, borderWidth: 0.7 });
  const t = (txt: string, x: number, y: number, size = 8, font = f.regular) => page.drawText(txt, { x, y, size, font, color: BLACK });
  t("CERTIFICATE OF LIABILITY INSURANCE", 40, 752, 15, f.bold);
  box(470, 740, 100, 28);
  t("DATE (MM/DD/YYYY)", 476, 758, 6.5, f.bold);
  t("11/01/2026", 490, 745, 9);
  const disclaimer = wrap("THIS CERTIFICATE IS ISSUED FOR INFORMATION ONLY AND CONFERS NO RIGHTS UPON THE CERTIFICATE HOLDER. IT DOES NOT AMEND, EXTEND OR ALTER THE COVERAGE AFFORDED BY THE POLICIES BELOW. (Fictional demo certificate.)", f.regular, 6.5, 530);
  disclaimer.forEach((l, i) => t(l, 40, 728 - i * 8, 6.5));
  box(40, 610, 265, 90);
  t("PRODUCER", 46, 690, 6.5, f.bold);
  t("Bayline Insurance Services", 46, 676, 9);
  t("72 Harbor Court, San Pedro, CA 90731", 46, 664, 8);
  box(305, 610, 265, 90);
  t("INSURERS AFFORDING COVERAGE", 311, 690, 6.5, f.bold);
  t(`INSURER A: ${c.insurer}`, 311, 676, 8.5);
  t("INSURER B: Harborline Auto Indemnity", 311, 664, 8.5);
  box(40, 530, 530, 80);
  t("INSURED", 46, 600, 6.5, f.bold);
  t(s.legal, 46, 586, 10, f.bold);
  t("Business address on file", 46, 573, 8);
  t("COVERAGES", 40, 515, 9, f.bold);
  const cols = [40, 200, 285, 360, 435];
  const heads = ["TYPE OF INSURANCE", "POLICY NUMBER", "POLICY EFF", "POLICY EXP", "LIMITS"];
  box(40, 360, 530, 148);
  heads.forEach((h, i) => t(h, (cols[i] ?? 0) + 6, 496, 6.5, f.bold));
  page.drawLine({ start: { x: 40, y: 490 }, end: { x: 570, y: 490 }, thickness: 0.7, color: BLACK });
  const rows: [string, string, string, string, string[]][] = [
    ["A  COMMERCIAL GENERAL LIABILITY", c.policy, c.glEffective, c.glExpiry, ["EACH OCCURRENCE $1,000,000", "GENERAL AGGREGATE $2,000,000"]],
    ["B  AUTOMOBILE LIABILITY", `AU-${c.policy.slice(-4)}`, c.glEffective, c.glExpiry, ["COMBINED SINGLE LIMIT $1,000,000"]],
    ["A  WORKERS COMPENSATION", `WC-${c.policy.slice(-4)}`, c.glEffective, c.glExpiry, ["E.L. EACH ACCIDENT $1,000,000"]],
  ];
  rows.forEach((r, i) => {
    const y = 474 - i * 40;
    t(r[0], cols[0]! + 6, y, 7.5, f.bold);
    t(r[1], cols[1]! + 6, y, 8);
    t(r[2], cols[2]! + 6, y, 8);
    t(r[3], cols[3]! + 6, y, 8);
    r[4].forEach((l, j) => t(l, cols[4]! + 6, y - j * 10, 6.8));
  });
  box(40, 250, 265, 90);
  t("CERTIFICATE HOLDER", 46, 330, 6.5, f.bold);
  t(GC.name, 46, 314, 9.5, f.bold);
  t(GC.address, 46, 300, 7.5);
  box(305, 250, 265, 90);
  t("AUTHORIZED REPRESENTATIVE", 311, 330, 6.5, f.bold);
  drawnSignature(page, 330, 285, 13, rgb(0.1, 0.18, 0.45));
}

async function makePdf(draw: (page: PDFPage, f: Fonts) => void, title: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create({ updateMetadata: false });
  doc.setTitle(title);
  const f: Fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    serif: await doc.embedFont(StandardFonts.TimesRoman),
    serifBold: await doc.embedFont(StandardFonts.TimesRomanBold),
    mono: await doc.embedFont(StandardFonts.Courier),
    italic: await doc.embedFont(StandardFonts.TimesRomanItalic),
  };
  draw(doc.addPage([612, 792]), f);
  return doc.save({ useObjectStreams: false });
}

const field = <T>(value: T | null, sourceText: string, confidence = 0.96) => ({ value, confidence, sourceText });

function waiverFixture(w: WaiverDoc): ExtractionT {
  const p = payment(w.payment);
  const s = sub(p.sub);
  const pr = project(p.project);
  const scan = w.variant === "scan";
  const sig = w.signature;
  return {
    kind: "waiver",
    waiver: {
      claimantName: field(s.legal, s.legal, scan ? 0.82 : 0.97),
      customerName: field(GC.name, GC.name),
      projectName: field(pr.name, pr.name, scan ? 0.8 : 0.96),
      type: field(w.type, waiverHeading(w)),
      scope: field(w.scope, waiverHeading(w)),
      amount: scan ? field(w.amountText, "$11,0_ _.00", 0.42) : field(w.amountText, w.amountText),
      throughDate: field(w.throughText, w.throughText, scan ? 0.66 : 0.96),
      signed: field(sig !== null, sig ? (sig.kind === "typed" ? `/s/ ${sig.name}` : `[handwritten signature] ${sig.name}`) : "Claimant's Signature: ________", 0.93),
      notarized: field(w.notarized, w.style === "tx" ? (w.notarized ? "Sworn to and subscribed before me ... Rosa Delgado, Notary Public" : "Sworn to and subscribed before me on ______") : "", 0.92),
      exceptions: field(null, "Exceptions: none", 0.9),
    },
    coi: null,
    notes:
      w.variant === "injection"
        ? "The document contains text addressed to AI systems asking to change the waiver type, amount and signature status. It was ignored; values reflect the document's own content."
        : scan
          ? "Low-quality scan; the payment amount is partly illegible."
          : "",
  };
}

function coiFixture(c: CoiDoc): ExtractionT {
  const s = sub(c.sub);
  return {
    kind: "coi",
    waiver: null,
    coi: {
      insuredName: field(s.legal, s.legal),
      certificateHolder: field(GC.name, GC.name),
      glExpiry: field(c.glExpiry, `COMMERCIAL GENERAL LIABILITY ${c.policy} ${c.glEffective} ${c.glExpiry}`, 0.94),
    },
    notes: "",
  };
}

function writeWorkbook(path: string, sheets: Record<string, unknown[][]>) {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows, { cellDates: true }), name);
  writeFileSync(path, XLSX.write(wb, { type: "buffer", bookType: "xlsx", compression: true }) as Buffer);
}

const isoToDate = (iso: string) => new Date(`${iso}T00:00:00Z`);

export async function generateSamples(outDir: string): Promise<void> {
  mkdirSync(join(outDir, "pdfs"), { recursive: true });
  mkdirSync(join(outDir, "fixtures"), { recursive: true });

  writeWorkbook(join(outDir, "payments.xlsx"), {
    Payments: [
      ["Payment ID", "Project", "Sub", "Invoice", "Amount", "Period End", "Paid Date", "Final"],
      ...PAYMENTS.map((p) => [p.id, p.project, p.sub, p.invoice, p.amountDollars, isoToDate(p.periodEnd), p.paidDate ? isoToDate(p.paidDate) : "", p.isFinal ? "Yes" : "No"]),
    ],
    Projects: [["Code", "Name", "State", "Owner"], ...PROJECTS.map((p) => [p.code, p.name, p.state, p.owner])],
  });
  writeWorkbook(join(outDir, "subcontractors.xlsx"), {
    Subcontractors: [["Code", "Name", "Email", "Contact"], ...SUBS.map((s) => [s.code, s.name, s.email, s.contact])],
  });

  for (const w of WAIVERS) {
    const bytes = await makePdf((page, f) => {
      if (w.style === "ca") drawCaStyle(page, f, w, w.variant === "scan");
      else if (w.style === "tx") drawTxStyle(page, f, w);
      else drawLetterStyle(page, f, w);
    }, `Lien waiver ${w.file}`);
    writeFileSync(join(outDir, "pdfs", `${w.file}.pdf`), bytes);
    writeFileSync(join(outDir, "fixtures", `${w.file}.json`), JSON.stringify(waiverFixture(w), null, 2) + "\n");
  }
  mkdirSync(join(outDir, "inbound", "pdfs"), { recursive: true });
  mkdirSync(join(outDir, "inbound", "fixtures"), { recursive: true });
  for (const w of INBOUND_WAIVERS) {
    const bytes = await makePdf((page, f) => drawTxStyle(page, f, w), `Lien waiver ${w.file}`);
    writeFileSync(join(outDir, "inbound", "pdfs", `${w.file}.pdf`), bytes);
    writeFileSync(join(outDir, "inbound", "fixtures", `${w.file}.json`), JSON.stringify(waiverFixture(w), null, 2) + "\n");
  }
  for (const c of COIS) {
    const bytes = await makePdf((page, f) => drawCoi(page, f, c), `Certificate of insurance ${c.file}`);
    writeFileSync(join(outDir, "pdfs", `${c.file}.pdf`), bytes);
    writeFileSync(join(outDir, "fixtures", `${c.file}.json`), JSON.stringify(coiFixture(c), null, 2) + "\n");
  }

  const expected = {
    today: DEMO_TODAY,
    batchExposedCents: PAYMENTS.reduce((s, p) => s + p.expected.exposedDollars * 100, 0),
    payments: PAYMENTS.map((p) => ({
      id: p.id,
      sub: p.sub,
      project: p.project,
      scenario: p.scenario,
      paid: p.paidDate !== null,
      decision: p.expected.decision,
      ruleIds: [...p.expected.ruleIds].sort(),
      exposedCents: p.expected.exposedDollars * 100,
    })),
  };
  writeFileSync(join(outDir, "expected.json"), JSON.stringify(expected, null, 2) + "\n");

  const money = (d: number) => `$${d.toLocaleString("en-US")}`;
  const md = [
    "# Expected results for the sample batch",
    "",
    `Rules run with today = **${DEMO_TODAY}**. All companies and people are fictional.`,
    "",
    "| Payment | Sub | Project | Amount | Paid | Scenario | Expected | Rules | Exposed |",
    "|---|---|---|---|---|---|---|---|---|",
    ...PAYMENTS.map((p) => `| ${p.id} | ${sub(p.sub).name} | ${p.project} | ${money(p.amountDollars)} | ${p.paidDate ?? "not paid"} | ${p.scenario} | **${p.expected.decision}** | ${p.expected.ruleIds.join(", ") || "—"} | ${money(p.expected.exposedDollars)} |`),
    "",
    `**Batch exposure: ${money(expected.batchExposedCents / 100)}**`,
    "",
  ].join("\n");
  writeFileSync(join(outDir, "EXPECTED.md"), md);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  generateSamples("samples").then(() => console.log("samples/ written"));
}
