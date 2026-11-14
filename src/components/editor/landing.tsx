"use client";

/**
 * PDFDock — the landing page: hero + drop zone + everything a visitor
 * needs to understand the editor before committing a file.
 *
 * SEO content (how-to, FAQ, structured data) lives in app/page.tsx;
 * this component carries the interactive parts (dropzone, sample doc).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FileText,
  Highlighter,
  Image as ImageIcon,
  Loader2,
  Pen,
  RotateCw,
  ShieldCheck,
  Signature,
  Sparkles,
  Type,
  Eraser,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useEditor } from "@/lib/editor/store";
import { createSamplePdfBytes } from "@/lib/editor/sample";

/** loadError stores the engine's error code — map it to honest copy */
function loadErrorMessage(code: string): string {
  if (code === "password-required")
    return "This PDF is password-protected — remove the protection first (it must open without a password to be edited).";
  if (code === "corrupt-pdf")
    return "This PDF couldn't be opened — the file may be damaged or not a PDF at all.";
  return "Something went wrong while processing this PDF.";
}

export function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

/* ------------------------------------------------------------------ */
/* drop zone                                                           */
/* ------------------------------------------------------------------ */

function PdfDropZone({ onFiles }: { onFiles: (_files: File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const files = event.clipboardData?.files;
      if (files && files.length > 0) onFiles(Array.from(files));
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [onFiles]);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Open a PDF"
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files.length > 0) onFiles(Array.from(e.dataTransfer.files));
      }}
      className={`flex cursor-pointer select-none flex-col items-center justify-center gap-2 rounded-2xl border-[1.6px] border-dashed px-6 py-10 text-center transition-colors ${
        dragging
          ? "border-primary bg-secondary"
          : "border-border bg-card hover:border-primary/60 hover:bg-secondary/40"
      }`}
    >
      <div className="pointer-events-none flex flex-col items-center gap-2">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-secondary">
          <FileText className="size-7 text-primary" aria-hidden="true" />
        </span>
        <p className="font-display text-[15px] font-bold text-foreground">
          Drop a PDF here, or click to browse
        </p>
        <p className="max-w-[340px] text-[12px] leading-relaxed text-muted-foreground">
          You can also paste from the clipboard (Ctrl / Cmd + V). The file
          stays on your device — nothing is uploaded, ever.
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onFiles(Array.from(e.target.files));
          }
          e.target.value = "";
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* landing                                                            */
/* ------------------------------------------------------------------ */

const FEATURES: { icon: typeof Type; title: string; text: string }[] = [
  { icon: Type, title: "Add text", text: "Type onto any page — 12 built-in fonts, any size and colour. Exported as real, selectable text." },
  { icon: Signature, title: "Sign by hand", text: "Draw your signature with mouse or touch and place it anywhere. Transparent background, crisp vector export." },
  { icon: Eraser, title: "White-out", text: "Cover a name, a price, a whole clause — then type over it. Optional rasterize export for true redaction." },
  { icon: Highlighter, title: "Highlight", text: "Swipe a translucent marker over the lines that matter, in any tint you like." },
  { icon: Pen, title: "Draw & annotate", text: "Freehand pen, straight lines, rectangles and ellipses with controllable stroke and fill." },
  { icon: FileText, title: "Fill forms", text: "Real AcroForm fields? Fill text boxes, checkboxes, dropdowns and radios right here." },
  { icon: ImageIcon, title: "Images & stamps", text: "Place your logo, a photo or a scanned signature anywhere on the page." },
  { icon: RotateCw, title: "Fix pages", text: "Rotate, delete or add blank pages — the whole document, without leaving your browser." },
];

export function Landing() {
  const openBytes = useEditor((s) => s.openBytes);
  const status = useEditor((s) => s.status);
  const loadError = useEditor((s) => s.loadError);

  const [sampleBusy, setSampleBusy] = useState(false);

  const onFiles = useCallback(
    (files: File[]) => {
      const pdf = files.find(isPdfFile);
      if (!pdf) {
        toast.error("That file is not a PDF — pick a .pdf file to edit.");
        return;
      }
      void pdf.arrayBuffer().then((buf) => {
        void openBytes(new Uint8Array(buf), pdf.name, pdf.size);
      });
    },
    [openBytes],
  );

  const onSample = useCallback(async () => {
    setSampleBusy(true);
    try {
      const bytes = await createSamplePdfBytes();
      await openBytes(bytes, "pdfdock-sample.pdf", bytes.length);
    } catch {
      toast.error("Couldn't build the sample document — please try again.");
    } finally {
      setSampleBusy(false);
    }
  }, [openBytes]);

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      {/* hero */}
      <section className="flex flex-col items-center gap-4 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-mint/45 bg-mint/5 px-3 py-1 text-[11.5px] font-semibold text-mint-deep dark:text-mint">
          <ShieldCheck className="size-3.5" aria-hidden="true" />
          100% in your browser — no uploads, no sign-up, no limits
        </span>
        <h1 className="max-w-[640px] font-display text-[30px] font-extrabold leading-[1.15] tracking-tight text-foreground sm:text-[40px]">
          Edit any PDF like a document,{" "}
          <span className="text-primary">right in your browser</span>
        </h1>
        <p className="max-w-[560px] text-[14px] leading-relaxed text-muted-foreground sm:text-[15px]">
          Add text, sign by hand, white-out sensitive lines, highlight,
          draw, stamp images, fill forms and fix pages — then download the
          finished PDF. Free forever, and your file never leaves this
          device.
        </p>
      </section>

      {/* drop zone */}
      <section id="open" className="mx-auto w-full max-w-[640px] scroll-mt-20">
        {status === "error" ? (
          <div
            role="alert"
            className="mb-3 flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 px-4 py-3"
          >
            <FileText className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
            <div>
              <p className="text-[13px] font-bold text-foreground">
                That PDF didn't open
              </p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">
                {loadErrorMessage(loadError)}
              </p>
            </div>
          </div>
        ) : null}
        <PdfDropZone onFiles={onFiles} />
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void onSample()}
            disabled={sampleBusy || status === "loading"}
            className="gap-1.5"
          >
            {sampleBusy ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
            )}
            No PDF handy? Try the sample document
          </Button>
          {status === "loading" ? (
            <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              Opening…
            </span>
          ) : null}
        </div>
      </section>

      {/* features */}
      <section aria-label="What you can do">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 shadow-sm"
            >
              <span className="flex size-9 items-center justify-center rounded-xl bg-secondary">
                <f.icon className="size-[18px] text-primary" aria-hidden="true" />
              </span>
              <h2 className="font-display text-[13.5px] font-bold text-foreground">
                {f.title}
              </h2>
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                {f.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* privacy strip */}
      <section className="flex flex-col items-center gap-3 rounded-2xl border border-mint/35 bg-mint/[0.04] px-6 py-6 text-center">
        <ShieldCheck className="size-6 text-mint-deep dark:text-mint" aria-hidden="true" />
        <h2 className="font-display text-[15px] font-bold text-foreground">
          Privacy by architecture
        </h2>
        <p className="max-w-[520px] text-[12.5px] leading-relaxed text-muted-foreground">
          There is no server to upload to. The editor, the renderer and the
          export all run as JavaScript on your device — contracts,
          payslips, medical letters and IDs stay exactly where they
          already are: with you. Files up to any size, free, no account.
        </p>
      </section>

      {/* how it works (SEO copy, server-rendered in page.tsx too) */}
      <section id="how" className="scroll-mt-20">
        <h2 className="font-display text-[16px] font-bold text-foreground">
          How to edit a PDF in three steps
        </h2>
        <ol className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {[
            "Open your PDF — drag it onto the page, browse, paste, or try the sample. It opens instantly because nothing travels over the network.",
            "Edit — click Text and type, draw a signature, white-out a line, highlight, place shapes and images, fill form fields, rotate or delete pages. Undo and redo are unlimited.",
            "Download — one click burns every change into the file as standard PDF content: real text, real drawings, real redaction when you rasterize. The original file is never touched.",
          ].map((step, i) => (
            <li
              key={i}
              className="flex items-start gap-2.5 rounded-2xl border border-border bg-card p-4"
            >
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-navy text-[11px] font-bold text-white dark:bg-[#22477F]">
                {i + 1}
              </span>
              <span className="text-[12.5px] leading-relaxed text-muted-foreground">
                {step}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20">
        <h2 className="font-display text-[16px] font-bold text-foreground">
          Frequently asked questions
        </h2>
        <div className="mt-3 flex flex-col gap-2">
          {[
            {
              q: "Is PDFDock really free?",
              a: "Yes — completely. There is no paid tier, no watermark, no daily quota and no account. Because the editor runs on your own device, there are no server costs to recover, and nothing is ever charged to you or to any API.",
            },
            {
              q: "Are my files uploaded anywhere?",
              a: "No. The file you open stays in your browser's memory and every edit is applied by JavaScript locally. Closing the tab clears everything. The only copy that exists is the one you download.",
            },
            {
              q: "Can I edit the existing text of a paragraph?",
              a: "Not by rewriting it in place — no honest browser tool can do that well, because PDF text isn't stored as a flowable document. The professional approach (the one desktop editors use) is cover-and-replace: white-out the old line and type the new one. That is exactly what the White-out + Text tools do here.",
            },
            {
              q: "Can I sign a PDF without printing it?",
              a: "Yes. The Sign tool opens a drawing pad — use your mouse, trackpad or finger — and inserts your signature with a transparent background at any size and position. You can also place an image file of your signature.",
            },
            {
              q: "What does 'rasterize' do on export?",
              a: "Rasterize turns each page into a flat image. That makes the document tamper-proof and is the only way to truly remove (not just hide) white-out-covered content — but the text stops being selectable. Use it when redaction matters more than text selection.",
            },
            {
              q: "Does it work with password-protected PDFs?",
              a: "It tells you honestly if a PDF is password-protected and refuses to guess. Remove the protection first (it must open without a password), then edit it here.",
            },
            {
              q: "Which languages can I type in?",
              a: "The built-in PDF fonts cover Western and Central European languages well. Right-to-left scripts and CJK are not supported in v1 — typed text is stored as-is and standard-font coverage decides how it renders.",
            },
          ].map((f) => (
            <details
              key={f.q}
              className="group rounded-xl border border-border bg-card px-4 py-3"
            >
              <summary className="cursor-pointer list-none text-[13px] font-bold text-foreground marker:hidden [&::-webkit-details-marker]:hidden">
                {f.q}
              </summary>
              <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
                {f.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* a final nudge */}
      <section className="flex flex-col items-center gap-2.5 pb-4 text-center">
        <h2 className="font-display text-[16px] font-bold text-foreground">
          Ready when you are
        </h2>
        <p className="max-w-[420px] text-[12.5px] leading-relaxed text-muted-foreground">
          Your documents, your device, your browser. Drop a PDF above to
          begin — it takes about two seconds.
        </p>
        <a
          href="#open"
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-[13px] font-bold text-primary-foreground shadow-sm transition hover:opacity-90"
        >
          Open a PDF
        </a>
      </section>
    </div>
  );
}
