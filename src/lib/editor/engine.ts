"use client";

/**
 * PDFDock — the PDF engine.
 *
 * pdf.js renders pages onto canvases (the editing surface, thumbnails,
 * the raster export). pdf-lib edits the document (annotations, page
 * ops, form fields, saving). Both libraries load LAZILY — the landing
 * page never downloads the engine until a PDF is actually opened.
 *
 * The two pdf.js workers ship as static assets in /public so no CDN is
 * ever contacted: everything runs on the visitor's device.
 *
 * Import this module ONLY from client components ("use client").
 */

import type {
  PDFDocumentProxy,
  PDFDocumentLoadingTask,
} from "pdfjs-dist";
import type { PageEntry, EditorObject, FormFieldInfo, FormValues } from "./types";
import { FONTS, fontFileUrl, type FontKey } from "./fonts";
import { displayDims, displayToUser, userToDisplay } from "./geometry";

/* ------------------------------------------------------------------ */
/* lazy library loading                                                */
/* ------------------------------------------------------------------ */

let pdfLibPromise: Promise<typeof import("pdf-lib")> | null = null;

/** pdf-lib (~350 KB): creates, merges, splits and edits PDFs */
export function loadPdfLib(): Promise<typeof import("pdf-lib")> {
  if (!pdfLibPromise) pdfLibPromise = import("pdf-lib");
  return pdfLibPromise;
}

/**
 * Build-time base path. GitHub Pages project sites are served from
 * https://<user>.github.io/<repo>/ — pdf.js worker URLs must include that
 * prefix or page rendering silently fails. Cloudflare / custom-domain /
 * root-repo builds leave NEXT_PUBLIC_BASE_PATH unset → "" → root paths,
 * exactly as before. Inlined by the bundler at build time (no runtime cost).
 */
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

let pdfJsPromise: Promise<typeof import("pdfjs-dist")> | null = null;

/** pdf.js v6 (split workers — workerSrc parses, rendererSrc renders) */
export function loadPdfJs(): Promise<typeof import("pdfjs-dist")> {
  if (!pdfJsPromise) {
    pdfJsPromise = import("pdfjs-dist").then((m) => {
      m.GlobalWorkerOptions.workerSrc = `${BASE_PATH}/pdf.worker.min.mjs`;
      m.GlobalWorkerOptions.rendererSrc = `${BASE_PATH}/pdf.renderer.min.mjs`;
      return m;
    });
  }
  return pdfJsPromise;
}

/* ------------------------------------------------------------------ */
/* errors — honest, typed failure modes (never a blank screen)          */
/* ------------------------------------------------------------------ */

export class PasswordRequiredError extends Error {
  constructor() {
    super("password-required");
    this.name = "PasswordRequiredError";
  }
}

export class CorruptPdfError extends Error {
  constructor() {
    super("corrupt-pdf");
    this.name = "CorruptPdfError";
  }
}

/** friendly, actionable error copy for PDF failures */
export function pdfErrorMessage(err: unknown): string {
  if (err instanceof PasswordRequiredError) {
    return "This PDF is password-protected — remove the protection first (it must open without a password to be edited).";
  }
  if (err instanceof CorruptPdfError) {
    return "This PDF couldn't be opened — the file may be damaged or not a PDF at all.";
  }
  return "Something went wrong while processing this PDF.";
}

/* ------------------------------------------------------------------ */
/* opening documents (pdf.js side — the editing surface)               */
/* ------------------------------------------------------------------ */

/** module-level render document — one at a time, like the UI */
let renderDoc: PDFDocumentProxy | null = null;
let renderTask: PDFDocumentLoadingTask | null = null;

export interface OpenedDocument {
  /** pdf.js proxy used for rendering (NOT for exporting) */
  proxy: PDFDocumentProxy;
  pages: PageEntry[];
}

/** open raw bytes with pdf.js WITHOUT touching the workspace document */
async function openDetached(
  bytes: Uint8Array,
): Promise<{ proxy: PDFDocumentProxy; task: PDFDocumentLoadingTask }> {
  const pdfjs = await loadPdfJs();
  const copy = new Uint8Array(bytes); // pdf.js detaches what it receives
  try {
    const task = pdfjs.getDocument({ data: copy });
    const proxy = await task.promise;
    return { proxy, task };
  } catch (err) {
    const name = String((err as { name?: string })?.name ?? "");
    if (name.includes("PasswordException")) throw new PasswordRequiredError();
    throw new CorruptPdfError();
  }
}

/**
 * Open a document for editing and read every page's geometry.
 * pdf.js transfers (detaches) the buffer, so a fresh copy is passed —
 * the caller's pristine bytes stay valid for pdf-lib work.
 */
export async function openDocument(bytes: Uint8Array): Promise<OpenedDocument> {
  const { proxy, task } = await openDetached(bytes);
  renderTask?.destroy().catch(() => undefined);
  renderTask = task;
  renderDoc = proxy;

  const pages: PageEntry[] = [];
  for (let i = 0; i < proxy.numPages; i++) {
    const page = await proxy.getPage(i + 1); // pdf.js pages are 1-based
    const view = page.view; // [x0, y0, x1, y1] — unrotated user dims
    const uw = view[2] - view[0];
    const uh = view[3] - view[1];
    const rotation = ((page.rotate % 360) + 360) % 360;
    const dims = displayDims(uw, uh, rotation);
    pages.push({
      id: `p${i}-${Math.random().toString(36).slice(2, 9)}`,
      srcIndex: i,
      rotation,
      width: dims.width,
      height: dims.height,
    });
  }
  return { proxy, pages };
}

/** close the workspace render document (start over) */
export function closeRenderDoc(): void {
  renderTask?.destroy().catch(() => undefined);
  renderTask = null;
  renderDoc = null;
  textHitsCache.clear();
}

/* ------------------------------------------------------------------ */
/* existing-text hit testing (the retype assist)                       */
/* ------------------------------------------------------------------ */

export interface TextHit {
  str: string;
  /** display-space bbox of the whole line of text */
  x: number;
  y: number;
  w: number;
  h: number;
  /** detected font size (pt) */
  size: number;
  /** display-space baseline y — null on sideways pages */
  baselineY: number | null;
}

const textHitsCache = new Map<number, TextHit[]>();

/**
 * Locate the line of existing document text under a display-space
 * point — the heart of "double-click to retype". Horizontal text
 * only; angled or vertical runs are skipped honestly.
 */
export async function findTextAt(
  srcIndex: number,
  rotation: number,
  px: number,
  py: number,
): Promise<TextHit | null> {
  if (!renderDoc || srcIndex === null) return null;
  let hits = textHitsCache.get(srcIndex);
  if (!hits) {
    const page = await renderDoc.getPage(srcIndex + 1);
    const content = await page.getTextContent();
    const view = page.view;
    const geom = {
      userWidth: view[2] - view[0],
      userHeight: view[3] - view[1],
      rotation: ((rotation % 360) + 360) % 360,
    };
    hits = [];
    for (const item of content.items) {
      if (!("transform" in item) || typeof item.str !== "string") continue;
      if (item.str.trim().length === 0) continue;
      const [a, b, c, d, e, f] = item.transform;
      /* horizontal text only — skip angled and vertical runs */
      if (Math.abs(b) > 0.01 || Math.abs(c) > 0.01) continue;
      const size = Math.abs(d ?? 0) || Math.abs(a ?? 0) || 10;
      if (size < 4 || size > 72) continue;
      const advance = (item as { width?: number }).width ?? 0;
      /* user-space corners: baseline start/end, extended for ascent+descent */
      const p1 = userToDisplay(geom, e, f - 0.3 * size);
      const p2 = userToDisplay(geom, e + Math.max(advance, 1), f + 0.85 * size);
      const base = userToDisplay(geom, e, f);
      hits.push({
        str: item.str,
        x: Math.min(p1.x, p2.x),
        y: Math.min(p1.y, p2.y),
        w: Math.abs(p2.x - p1.x),
        h: Math.abs(p2.y - p1.y),
        size,
        baselineY:
          geom.rotation % 180 === 0 ? base.y : null,
      });
    }
    page.cleanup();
    textHitsCache.set(srcIndex, hits);
  }
  const tol = 2.5;
  let best: TextHit | null = null;
  let bestDist = Infinity;
  for (const h of hits) {
    const inside =
      px >= h.x - tol && px <= h.x + h.w + tol &&
      py >= h.y - tol && py <= h.y + h.h + tol;
    if (!inside) continue;
    const dx = Math.max(h.x - px, px - (h.x + h.w), 0);
    const dy = Math.max(h.y - py, py - (h.y + h.h), 0);
    const dist = Math.hypot(dx, dy);
    if (dist < bestDist) {
      best = h;
      bestDist = dist;
    }
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* rendering                                                           */
/* ------------------------------------------------------------------ */

/**
 * Render one page (0-based source index) at `scale` device pixels per
 * point onto the given canvas, at the store's cumulative rotation.
 * `scale` includes zoom and devicePixelRatio; the returned width and
 * height are CSS pixels for layout.
 */
export async function renderPage(
  srcIndex: number,
  rotation: number,
  scale: number,
  canvas: HTMLCanvasElement,
): Promise<{ width: number; height: number }> {
  if (!renderDoc) throw new Error("no-document");
  const page = await renderDoc.getPage(srcIndex + 1);
  const viewport = page.getViewport({ scale, rotation });
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  await page.render({ canvas, viewport }).promise;
  page.cleanup();
  return { width: viewport.width / scale, height: viewport.height / scale };
}

/** small thumbnail for the page rail (JPEG dataURL, ~104 px wide) */
export async function renderThumb(
  srcIndex: number,
  rotation: number,
  widthPx = 104,
): Promise<string> {
  if (!renderDoc) throw new Error("no-document");
  const page = await renderDoc.getPage(srcIndex + 1);
  const base = page.getViewport({ scale: 1, rotation });
  const scale = widthPx / base.width;
  const viewport = page.getViewport({ scale, rotation });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  await page.render({ canvas, viewport }).promise;
  page.cleanup();
  return canvas.toDataURL("image/jpeg", 0.75);
}

/* ------------------------------------------------------------------ */
/* AcroForm reading (pdf-lib side)                                     */
/* ------------------------------------------------------------------ */

/**
 * Read the form field list + current values, for the fill-in panel.
 * Returns null when the document has no fillable fields.
 */
export async function readFormFields(
  bytes: Uint8Array,
): Promise<FormFieldInfo[] | null> {
  const lib = await loadPdfLib();
  const doc = await loadLibDoc(lib, bytes);
  let form;
  try {
    form = doc.getForm();
  } catch {
    return null; // no AcroForm dictionary
  }
  const fields = form.getFields();
  if (fields.length === 0) return null;

  const out: FormFieldInfo[] = [];
  for (const field of fields) {
    const name = field.getName();
    const label = name.split(".").pop() ?? name;
    if (field instanceof lib.PDFTextField) {
      out.push({ name, label, kind: "text", value: field.getText() ?? "" });
    } else if (field instanceof lib.PDFCheckBox) {
      out.push({ name, label, kind: "checkbox", value: field.isChecked() ? "true" : "false" });
    } else if (field instanceof lib.PDFDropdown) {
      out.push({ name, label, kind: "dropdown", value: field.getSelected()[0] ?? "", options: field.getOptions() });
    } else if (field instanceof lib.PDFRadioGroup) {
      out.push({ name, label, kind: "radio", value: field.getSelected() ?? "", options: field.getOptions() });
    }
    // option lists and signature fields exist but are not fillable — skipped
  }
  return out.length > 0 ? out : null;
}

/* ------------------------------------------------------------------ */
/* export — burning annotations into the PDF                           */
/* ------------------------------------------------------------------ */

export interface ExportOptions {
  fileName: string;
  /** filled form values, written before saving */
  formValues?: FormValues;
  /** flatten AcroForm fields (read-only) after filling */
  flattenForms: boolean;
  /** rasterize every page — true redaction, tamper-proof output */
  rasterize: boolean;
}

type LibPdfDoc = import("pdf-lib").PDFDocument;

async function loadLibDoc(
  lib: typeof import("pdf-lib"),
  bytes: Uint8Array,
): Promise<LibPdfDoc> {
  try {
    return await lib.PDFDocument.load(new Uint8Array(bytes), {
      ignoreEncryption: false,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/encrypt/i.test(msg)) throw new PasswordRequiredError();
    throw new CorruptPdfError();
  }
}

/** "#336699" → pdf-lib rgb() */
function hexColor(lib: typeof import("pdf-lib"), hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const n = m ? parseInt(m[1], 16) : 0x333333;
  return lib.rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** dataURL → raw bytes for embedPng/embedJpg */
async function dataUrlToBytes(dataUrl: string): Promise<Uint8Array> {
  const res = await fetch(dataUrl);
  return new Uint8Array(await res.arrayBuffer());
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image-load-failed"));
    img.src = src;
  });
}

/**
 * Pre-rotate an image by q × 90° clockwise so it appears upright once
 * the viewer applies /Rotate (only needed on rotated pages).
 */
async function rotateImageSrc(src: string, quarterTurns: number): Promise<string> {
  const q = ((quarterTurns % 4) + 4) % 4;
  if (q === 0) return src;
  const img = await loadImage(src);
  const canvas = document.createElement("canvas");
  const swap = q % 2 === 1;
  canvas.width = swap ? img.naturalHeight : img.naturalWidth;
  canvas.height = swap ? img.naturalWidth : img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return src;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((q * Math.PI) / 2);
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  return canvas.toDataURL("image/png");
}

/** wrap text to a point width using the embedded font's exact metrics */
function wrapText(
  measure: (_text: string) => number,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  for (const rawLine of text.split("\n")) {
    if (rawLine.length === 0) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of rawLine.split(/(\s+)/)) {
      const candidate = line + word;
      if (measure(candidate) <= maxWidth || line.length === 0) {
        line = candidate;
      } else {
        lines.push(line.trimEnd());
        line = word.trimStart();
      }
    }
    lines.push(line);
  }
  return lines;
}

/** display bbox → user-space bbox (axis-aligned for any 90° rotation) */
function userBox(
  geom: { userWidth: number; userHeight: number; rotation: number },
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const a = displayToUser(geom, x, y);
  const b = displayToUser(geom, x + w, y + h);
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}

/**
 * Burn every annotation into the document (vector), apply page ops and
 * form values. Returns the finished PDF bytes.
 */
async function burnAnnotations(
  lib: typeof import("pdf-lib"),
  bytes: Uint8Array,
  pages: PageEntry[],
  objects: EditorObject[],
  formValues: FormValues | undefined,
  flattenForms: boolean,
): Promise<Uint8Array> {
  const doc = await loadLibDoc(lib, bytes);
  const { degrees } = lib;

  /* --- 1. page ops: deletions (descending), then blank inserts ----- */
  const kept = new Set(
    pages.filter((p) => p.srcIndex !== null).map((p) => p.srcIndex as number),
  );
  const originalCount = doc.getPageCount();
  for (let i = originalCount - 1; i >= 0; i--) {
    if (!kept.has(i)) doc.removePage(i);
  }
  pages.forEach((p, finalIndex) => {
    if (p.srcIndex === null) doc.insertPage(finalIndex, [p.width, p.height]);
  });

  /* --- 2. rotations (absolute /Rotate, cumulative in PageEntry) ---- */
  const docPages = doc.getPages();
  pages.forEach((p, i) => {
    if (p.rotation % 360 !== 0 && i < docPages.length) {
      docPages[i].setRotation(degrees(((p.rotation % 360) + 360) % 360));
    }
  });

  /* --- 3. page geometry (user dims from the live doc pages) -------- */
  const geoms = pages.map((p, i) => {
    const size =
      i < docPages.length
        ? docPages[i].getSize()
        : { width: p.width, height: p.height };
    return {
      userWidth: size.width,
      userHeight: size.height,
      rotation: ((p.rotation % 360) + 360) % 360,
      displayWidth: p.width,
      displayHeight: p.height,
    };
  });
  const pageIndexById = new Map(pages.map((p, i) => [p.id, i]));

  /* --- 4. fonts (one embed per key actually used) ----------------- */
  /* extra families embed the self-hosted TTF (subsetted to the glyphs
     actually used) via fontkit; standard fonts stay zero-byte. */
  let fontkitRegistered = false;
  const fontCache = new Map<FontKey, Awaited<ReturnType<typeof doc.embedFont>>>();
  const fontFor = async (key: FontKey) => {
    let font = fontCache.get(key);
    if (!font) {
      const def = FONTS[key] ?? FONTS.helv;
      if (def.group === "extra" && def.file) {
        if (!fontkitRegistered) {
          doc.registerFontkit((await import("@pdf-lib/fontkit")).default);
          fontkitRegistered = true;
        }
        const res = await fetch(fontFileUrl(def.file));
        if (!res.ok) throw new Error("font-fetch-failed");
        const bytes = new Uint8Array(await res.arrayBuffer());
        font = await doc.embedFont(bytes, { subset: true });
      } else {
        font = await doc.embedFont((def.standard ?? "Helvetica") as never);
      }
      fontCache.set(key, font);
    }
    return font;
  };

  /* --- 5. draw objects, page by page, in z-order -------------------- */
  const byPage = new Map<string, EditorObject[]>();
  for (const obj of objects) {
    const list = byPage.get(obj.pageId) ?? [];
    list.push(obj);
    byPage.set(obj.pageId, list);
  }

  for (const [pageId, list] of byPage) {
    const pageIdx = pageIndexById.get(pageId);
    if (pageIdx === undefined || pageIdx >= docPages.length) continue;
    const page = docPages[pageIdx];
    const geom = geoms[pageIdx];
    const rot = geom.rotation;

    for (const obj of list) {
      switch (obj.type) {
        case "text": {
          const font = await fontFor(obj.fontKey);
          const size = obj.fontSize;
          const lines = wrapText(
            (t) => font.widthOfTextAtSize(t, size),
            obj.text,
            Math.max(obj.w, size * 0.5),
          );
          const ascent = size * 0.75;
          const lineHeight = size * 1.3;
          lines.forEach((line, i) => {
            if (line.length === 0) return;
            const anchor = displayToUser(
              geom,
              obj.x,
              obj.y + ascent + i * lineHeight,
            );
            page.drawText(line, {
              x: anchor.x,
              y: anchor.y,
              size,
              font,
              color: hexColor(lib, obj.color),
              rotate: degrees(rot),
            });
          });
          break;
        }

        case "whiteout":
        case "rect":
        case "highlight": {
          const box = userBox(geom, obj.x, obj.y, obj.w, obj.h);
          page.drawRectangle({
            ...box,
            color:
              obj.fillColor === "none"
                ? undefined
                : hexColor(lib, obj.fillColor),
            opacity: obj.opacity,
            borderWidth: obj.strokeColor ? obj.strokeWidth : 0,
            borderColor: obj.strokeColor ? hexColor(lib, obj.strokeColor) : undefined,
          });
          break;
        }

        case "ellipse": {
          const a = displayToUser(geom, obj.x, obj.y);
          const b = displayToUser(geom, obj.x + obj.w, obj.y + obj.h);
          page.drawEllipse({
            x: (a.x + b.x) / 2,
            y: (a.y + b.y) / 2,
            xScale: Math.abs(a.x - b.x) / 2,
            yScale: Math.abs(a.y - b.y) / 2,
            color:
              obj.fillColor === "none"
                ? undefined
                : hexColor(lib, obj.fillColor),
            opacity: obj.opacity,
            borderWidth: obj.strokeColor ? obj.strokeWidth : 0,
            borderColor: obj.strokeColor ? hexColor(lib, obj.strokeColor) : undefined,
          });
          break;
        }

        case "line": {
          page.drawLine({
            start: displayToUser(geom, obj.x1, obj.y1),
            end: displayToUser(geom, obj.x2, obj.y2),
            thickness: obj.strokeWidth,
            color: hexColor(lib, obj.strokeColor),
            lineCap: lib.LineCapStyle.Round,
          });
          break;
        }

        case "pen": {
          const thickness = obj.strokeWidth;
          const color = hexColor(lib, obj.strokeColor);
          for (let i = 1; i < obj.points.length; i++) {
            const prev = obj.points[i - 1];
            const cur = obj.points[i];
            page.drawLine({
              start: displayToUser(geom, obj.x + prev.x, obj.y + prev.y),
              end: displayToUser(geom, obj.x + cur.x, obj.y + cur.y),
              thickness,
              color,
              opacity: obj.opacity,
              lineCap: lib.LineCapStyle.Round,
            });
          }
          break;
        }

        case "image":
        case "signature": {
          if (obj.w < 0.5 || obj.h < 0.5) break;
          const quarter = Math.round(rot / 90) % 4;
          const src =
            quarter === 0
              ? obj.src
              : await rotateImageSrc(obj.src, (4 - quarter) % 4);
          const bytes = await dataUrlToBytes(src);
          const image = src.startsWith("data:image/jpeg")
            ? await doc.embedJpg(bytes)
            : await doc.embedPng(bytes);
          const box = userBox(geom, obj.x, obj.y, obj.w, obj.h);
          page.drawImage(image, box);
          break;
        }
      }
    }
  }

  /* --- 6. form values + optional flattening ------------------------ */
  try {
    const form = doc.getForm();
    const fields = form.getFields();
    for (const field of fields) {
      const value = formValues?.[field.getName()];
      if (value === undefined) continue;
      if (field instanceof lib.PDFTextField) {
        field.setText(value);
      } else if (field instanceof lib.PDFCheckBox) {
        if (value === "true") field.check();
        else field.uncheck();
      } else if (field instanceof lib.PDFDropdown || field instanceof lib.PDFRadioGroup) {
        if (value) field.select(value);
      }
    }
    if (flattenForms && fields.length > 0) {
      try {
        form.flatten();
      } catch {
        /* some fields lack appearance streams; flattening stays best-effort */
      }
    }
  } catch {
    /* no AcroForm — nothing to fill */
  }

  return doc.save({ useObjectStreams: true });
}

/* ------------------------------------------------------------------ */
/* rasterize (flatten) — render burned pages via pdf.js, rebuild PNG    */
/* ------------------------------------------------------------------ */

const RASTER_SCALE = 2.5; // ~180 DPI — crisp screen + decent print

async function rasterizeDocument(burned: Uint8Array): Promise<Uint8Array> {
  const lib = await loadPdfLib();
  const { proxy, task } = await openDetached(burned);
  try {
    const out = await lib.PDFDocument.create();
    for (let i = 1; i <= proxy.numPages; i++) {
      const page = await proxy.getPage(i);
      const viewport = page.getViewport({ scale: RASTER_SCALE });
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));
      await page.render({ canvas, viewport }).promise;
      page.cleanup();
      const blob = await new Promise<Blob | null>((res) =>
        canvas.toBlob(res, "image/png"),
      );
      if (!blob) continue;
      const image = await out.embedPng(new Uint8Array(await blob.arrayBuffer()));
      const w = viewport.width / RASTER_SCALE;
      const h = viewport.height / RASTER_SCALE;
      out.addPage([w, h]).drawImage(image, { x: 0, y: 0, width: w, height: h });
    }
    return out.save({ useObjectStreams: true });
  } finally {
    task.destroy().catch(() => undefined);
  }
}

/* ------------------------------------------------------------------ */
/* the export entry point                                              */
/* ------------------------------------------------------------------ */

export interface ExportInput {
  /** pristine original bytes (pdf.js got its own detached copy) */
  bytes: Uint8Array;
  /** final page order with ops applied (deletions, blanks, rotation) */
  pages: PageEntry[];
  objects: EditorObject[];
  options: ExportOptions;
}

export async function exportDocument(input: ExportInput): Promise<Blob> {
  const lib = await loadPdfLib();
  const burned = await burnAnnotations(
    lib,
    input.bytes,
    input.pages,
    input.objects,
    input.options.formValues,
    input.options.flattenForms,
  );
  const finalBytes = input.options.rasterize
    ? await rasterizeDocument(burned)
    : burned;
  return new Blob([finalBytes as BlobPart], { type: "application/pdf" });
}

/* ------------------------------------------------------------------ */
/* download helper                                                     */
/* ------------------------------------------------------------------ */

export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}
