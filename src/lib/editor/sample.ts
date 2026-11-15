"use client";

/**
 * PDFDock — the built-in sample document.
 *
 * "No PDF handy? Try the sample" — generated in the browser with
 * pdf-lib (lazy-loaded, so the landing page pays nothing). Two pages:
 * a contract-style document with a signature line and a form, so every
 * editor feature has something to try: text, white-out, signature,
 * shapes, highlighting and AcroForm filling.
 */

import { loadPdfLib } from "./engine";

export async function createSamplePdfBytes(): Promise<Uint8Array> {
  const lib = await loadPdfLib();
  const { PDFDocument, StandardFonts, rgb } = lib;

  const doc = await PDFDocument.create();
  doc.setTitle("PDFDock Sample Document");
  doc.setAuthor("PDFDock");
  doc.setSubject("Sample file for the in-browser PDF editor");
  doc.setProducer("PDFDock — pdf-lib (client-side)");

  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvB = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.13, 0.16, 0.22);
  const navy = rgb(0.09, 0.23, 0.44);
  const muted = rgb(0.39, 0.45, 0.55);
  const line = rgb(0.82, 0.86, 0.92);

  /* ---------------- page 1 — a contract-style letter ---------------- */
  const p1 = doc.addPage([612, 792]); // US Letter, points
  const L = 56; // left margin
  const W = 612;
  let y = 736;

  p1.drawText("CONSULTING SERVICES AGREEMENT", {
    x: L, y, size: 17, font: helvB, color: navy,
  });
  y -= 14;
  p1.drawText("PDFDock Sample Document — page 1 of 2", {
    x: L, y, size: 9.5, font: helv, color: muted,
  });
  y -= 22;
  p1.drawLine({ start: { x: L, y }, end: { x: W - L, y }, thickness: 1, color: line });

  y -= 24;
  const para = (text: string, size = 10.5, gap = 16) => {
    let lineY = y;
    for (const ln of text.split("\n")) {
      p1.drawText(ln, { x: L, y: lineY, size, font: helv, color: ink });
      lineY -= size + 4;
    }
    y = lineY - (gap - size - 4);
    return y;
  };
  para(
    "This sample agreement was generated entirely in your browser to demonstrate the\n" +
    "PDFDock editor. Nothing was uploaded, and nothing will be — every edit you make\n" +
    "stays on this device.",
    10.5, 26,
  );
  para(
    "1. Scope of work. The Consultant agrees to deliver the quarterly design review,\n" +
    "including three working sessions and one written report.",
    10.5, 18,
  );
  para(
    "2. Compensation. The Client agrees to pay the total sum of $4,800 (four thousand\n" +
    "eight hundred dollars) within 30 days of each delivered milestone.",
    10.5, 18,
  );
  para(
    "3. Term. This agreement begins on the date both parties sign below and continues\n" +
    "for twelve (12) months.",
    10.5, 26,
  );

  p1.drawRectangle({
    x: L, y: y - 8, width: W - 2 * L, height: 64,
    borderColor: navy, borderWidth: 1,
  });
  p1.drawText("Try it: white-out this box, then type your own clause.", {
    x: L + 10, y: y + 24, size: 9, font: helv, color: muted,
  });
  y -= 84;

  p1.drawText("Client signature:", { x: L, y: y + 4, size: 10, font: helv, color: ink });
  p1.drawText("____________________", { x: L + 105, y: y + 4, size: 10, font: helv, color: ink });
  p1.drawText("Date:", { x: 388, y: y + 4, size: 10, font: helv, color: ink });
  p1.drawText("____________", { x: 418, y: y + 4, size: 10, font: helv, color: ink });
  y -= 26;
  p1.drawText("Tip: use the Sign tool to draw your signature right on the line above.", {
    x: L, y: y + 4, size: 8.5, font: helv, color: muted,
  });

  /* ---------------- page 2 — a form to fill ------------------------- */
  const p2 = doc.addPage([612, 792]);
  let y2 = 736;
  p2.drawText("PROJECT DETAILS FORM", { x: L, y: y2, size: 15, font: helvB, color: navy });
  y2 -= 24;
  p2.drawText("This page carries real AcroForm fields — open the Forms panel and fill them in.", {
    x: L, y: y2, size: 9.5, font: helv, color: muted,
  });
  y2 -= 16;
  p2.drawLine({ start: { x: L, y: y2 }, end: { x: W - L, y: y2 }, thickness: 1, color: line });

  const form = doc.getForm();

  const fieldRow = (label: string, name: string, currentY: number, width = 220) => {
    p2.drawText(label, { x: L, y: currentY, size: 10, font: helvB, color: ink });
    const field = form.createTextField(`sample.${name}`);
    field.setText("");
    field.addToPage(p2, { x: 210, y: currentY - 4, width, height: 22 });
    field.setFontSize(11);
  };
  fieldRow("Full name:", "fullname", y2 - 34);
  fieldRow("Company:", "company", y2 - 74);
  fieldRow("Project code:", "projectcode", y2 - 114, 120);

  p2.drawText("Delivery format:", { x: L, y: y2 - 154, size: 10, font: helvB, color: ink });
  const radio = form.createRadioGroup("sample.format");
  const options = [
    { label: "PDF report", at: y2 - 154 },
    { label: "Live dashboard", at: y2 - 178 },
    { label: "Printed binder", at: y2 - 202 },
  ];
  options.forEach((opt) => {
    radio.addOptionToPage(opt.label, p2, { x: 210, y: opt.at - 2, width: 14, height: 14 });
    p2.drawText(opt.label, { x: 230, y: opt.at - 3, size: 10, font: helv, color: ink });
  });

  p2.drawText("Confirmed:", { x: L, y: y2 - 240, size: 10, font: helvB, color: ink });
  const check = form.createCheckBox("sample.confirmed");
  check.addToPage(p2, { x: 210, y: y2 - 244, width: 14, height: 14 });

  y2 -= 280;
  p2.drawText("Try it here:", { x: L, y: y2, size: 10, font: helvB, color: ink });
  const tips = [
    "Draw over this text with the Highlighter brush.",
    "Circle a line with the Ellipse or Pen tool.",
    "Double-click any line of text to retype it.",
    "Stamp your logo with the Image tool.",
    "Rotate this page 90 degrees — the whole page turns.",
    "Delete this page, or add a blank page after it.",
  ];
  tips.forEach((t, i) => {
    p2.drawText(`${i + 1}.  ${t}`, { x: L, y: y2 - 16 * (i + 1), size: 9.5, font: helv, color: ink });
  });

  const bytes = await doc.save();
  return bytes;
}
