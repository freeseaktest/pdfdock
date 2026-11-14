"use client";

/**
 * PDFDock — the save/export dialog. Two honest modes:
 *  - vector (default): annotations become real PDF content — real
 *    text, real drawings, images embedded;
 *  - rasterize: pages are rendered flat — tamper-proof, and the only
 *    way to truly REMOVE white-out covered content (true redaction).
 */

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileDown,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useEditor } from "@/lib/editor/store";
import {
  exportDocument,
  downloadBlob,
  formatBytes,
  pdfErrorMessage,
} from "@/lib/editor/engine";

type Phase = "settings" | "working" | "done";

export function ExportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (_open: boolean) => void;
}) {
  const doc = useEditor((s) => s.doc);
  const pages = useEditor((s) => s.pages);
  const objects = useEditor((s) => s.objects);
  const formFields = useEditor((s) => s.formFields);
  const formValues = useEditor((s) => s.formValues);

  const defaultName = useMemo(() => {
    if (!doc) return "edited.pdf";
    const base = doc.fileName.replace(/\.pdf$/i, "");
    return `${base}-edited.pdf`;
  }, [doc]);

  const [fileName, setFileName] = useState(defaultName);
  const [flattenForms, setFlattenForms] = useState(false);
  const [rasterize, setRasterize] = useState(false);
  const [phase, setPhase] = useState<Phase>("settings");
  const [note, setNote] = useState<string | null>(null);
  const [outSize, setOutSize] = useState(0);

  /* reset per open */
  const [lastOpen, setLastOpen] = useState<boolean | null>(null);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setPhase("settings");
      setFileName(defaultName);
      setFlattenForms(false);
      setRasterize(false);
      setNote(null);
      setOutSize(0);
    }
  }

  if (!doc) return null;
  const hasForm = (formFields?.length ?? 0) > 0;

  const run = async () => {
    let name = fileName.trim();
    if (!name) name = defaultName;
    if (!/\.pdf$/i.test(name)) name = `${name}.pdf`;

    setPhase("working");
    setNote(rasterize ? "Rendering pages flat…" : "Burning annotations…");
    try {
      const blob = await exportDocument({
        bytes: doc.bytes,
        pages,
        objects,
        options: {
          fileName: name,
          formValues: hasForm ? formValues : undefined,
          flattenForms: hasForm && flattenForms,
          rasterize,
        },
      });
      downloadBlob(blob, name);
      setOutSize(blob.size);
      setPhase("done");
    } catch (err) {
      setPhase("settings");
      toast.error(pdfErrorMessage(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <FileDown className="size-4 text-primary" aria-hidden="true" />
            Save your PDF
          </DialogTitle>
          <DialogDescription>
            {objects.length} object{objects.length === 1 ? "" : "s"} across{" "}
            {pages.length} page{pages.length === 1 ? "" : "s"} will be burned
            into the file. The original file on your disk is never touched.
          </DialogDescription>
        </DialogHeader>

        {phase === "settings" ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="export-name">File name</Label>
              <Input
                id="export-name"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                autoFocus
              />
            </div>

            {hasForm ? (
              <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-secondary/40 px-3.5 py-3">
                <div>
                  <p className="text-[13px] font-bold text-foreground">
                    Flatten form fields
                  </p>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
                    Make the {formFields?.length} filled field
                    {formFields?.length === 1 ? "" : "s"} permanent and
                    read-only — nobody can change your answers later.
                  </p>
                </div>
                <Switch
                  checked={flattenForms}
                  onCheckedChange={setFlattenForms}
                  aria-label="Flatten form fields"
                />
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-secondary/40 px-3.5 py-3">
              <div>
                <p className="text-[13px] font-bold text-foreground">
                  Rasterize pages
                  <span className="ml-1.5 rounded-full bg-mint/15 px-1.5 py-0.5 text-[10px] font-bold text-mint-deep dark:text-mint">
                    true redaction
                  </span>
                </p>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
                  Turn every page into a flat image. Removes white-out
                  covered content permanently — but text stops being
                  selectable and the file gets bigger.
                </p>
              </div>
              <Switch
                checked={rasterize}
                onCheckedChange={setRasterize}
                aria-label="Rasterize pages for true redaction"
              />
            </div>

            {rasterize ? (
              <p className="flex items-start gap-2 rounded-xl border border-mint/45 bg-mint/[0.06] px-3 py-2.5 text-[11.5px] leading-relaxed text-muted-foreground">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-mint-deep dark:text-mint" aria-hidden="true" />
                Rasterized output is rendered at ~180 DPI — great on
                screen and for everyday printing; use vector mode for
                press-quality documents.
              </p>
            ) : (
              <p className="flex items-start gap-2 rounded-xl border border-border bg-secondary/30 px-3 py-2.5 text-[11.5px] leading-relaxed text-muted-foreground">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-mint-deep dark:text-mint" aria-hidden="true" />
                Vector mode keeps everything as standard PDF content:
                text stays selectable and searchable, files stay small.
              </p>
            )}
          </div>
        ) : null}

        {phase === "working" ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 className="size-7 animate-spin text-primary" aria-hidden="true" />
            <p className="text-[13px] font-semibold text-foreground">{note}</p>
            <p className="text-[11.5px] text-muted-foreground">
              Everything happens on this device — keep the tab open.
            </p>
          </div>
        ) : null}

        {phase === "done" ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <CheckCircle2 className="size-9 text-mint-deep dark:text-mint" aria-hidden="true" />
            <div>
              <p className="font-display text-[16px] font-bold text-foreground">
                Downloaded
              </p>
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                {fileName} · {formatBytes(outSize)} · nothing was uploaded
              </p>
            </div>
            <p className="text-[11.5px] leading-relaxed text-muted-foreground">
              You can keep editing — every save starts again from your
              original file plus the current objects.
            </p>
          </div>
        ) : null}

        <DialogFooter>
          {phase === "settings" ? (
            <>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Keep editing
              </Button>
              <Button type="button" onClick={() => void run()} className="gap-1.5">
                <Download className="size-3.5" aria-hidden="true" />
                Save PDF
              </Button>
            </>
          ) : phase === "working" ? (
            <Button type="button" disabled className="gap-1.5">
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              Working…
            </Button>
          ) : (
            <Button type="button" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
