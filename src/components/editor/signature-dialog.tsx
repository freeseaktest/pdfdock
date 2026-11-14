"use client";

/**
 * PDFDock — the signature pad. Draw with mouse, pen or finger on a
 * transparent-background canvas; the ink is trimmed to its own bounds
 * and inserted as a movable, resizable image object.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser, Signature as SignatureIcon } from "lucide-react";
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
import { useEditor, newId } from "@/lib/editor/store";
import type { ImageObject } from "@/lib/editor/types";

const INK_COLORS = ["#202938", "#173B70", "#3979E8"];
const PAD_W = 480;
const PAD_H = 220;

export function SignatureDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (_open: boolean) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const hasInkRef = useRef(false);
  const [ink, setInk] = useState(INK_COLORS[0]);
  const [width] = useState(3);

  const addObject = useEditor((s) => s.addObject);
  const pages = useEditor((s) => s.pages);
  const pageIndex = useEditor((s) => s.pageIndex);

  const ctxOf = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    return ctx;
  };

  const clear = useCallback(() => {
    const ctx = ctxOf();
    if (!ctx) return;
    ctx.clearRect(0, 0, PAD_W, PAD_H);
    hasInkRef.current = false;
  }, []);

  /* clear + dpr-scale the pad every time the dialog opens */
  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (canvas) {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = PAD_W * dpr;
      canvas.height = PAD_H * dpr;
    }
    clear();
  }, [open, clear]);

  const posFrom = (e: React.PointerEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: ((e.clientX - rect.left) / rect.width) * PAD_W,
      y: ((e.clientY - rect.top) / rect.height) * PAD_H,
    };
  };

  const drawTo = (pt: { x: number; y: number }) => {
    const ctx = ctxOf();
    if (!ctx) return;
    const last = lastRef.current ?? pt;
    ctx.strokeStyle = ink;
    ctx.lineWidth = width * 2; /* thicker ink for signature feel */
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    lastRef.current = pt;
    hasInkRef.current = true;
  };

  const onDown = (e: React.PointerEvent) => {
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    lastRef.current = null;
    drawTo(posFrom(e));
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drawingRef.current) return;
    drawTo(posFrom(e));
  };
  const onUp = () => {
    drawingRef.current = false;
    lastRef.current = null;
  };

  /** trim transparent margins → tight PNG of just the ink */
  const trimmedDataUrl = (): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const dpr = window.devicePixelRatio || 1;
    const img = canvas.getContext("2d")?.getImageData(0, 0, canvas.width, canvas.height);
    if (!img) return null;
    const { data, width: w, height: h } = img;
    let minX = w, minY = h, maxX = 0, maxY = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] > 0) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (minX > maxX || minY > maxY) return null; /* empty */
    const pad = Math.round(2 * dpr);
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(w - 1, maxX + pad);
    maxY = Math.min(h - 1, maxY + pad);
    const out = document.createElement("canvas");
    out.width = maxX - minX + 1;
    out.height = maxY - minY + 1;
    out.getContext("2d")?.drawImage(
      canvas, minX, minY, out.width, out.height, 0, 0, out.width, out.height,
    );
    return out.toDataURL("image/png");
  };

  const insert = () => {
    const src = trimmedDataUrl();
    if (!src) {
      toast.error("Draw your signature first — the pad is empty.");
      return;
    }
    const page = pages[pageIndex];
    if (!page) return;
    /* natural aspect: rendered ink pixels → placed points */
    const img = new Image();
    img.onload = () => {
      const w = Math.min(page.width * 0.4, 200);
      const h = w / (img.naturalWidth / img.naturalHeight);
      const obj: ImageObject = {
        id: newId("sig"),
        pageId: page.id,
        type: "signature",
        x: (page.width - w) / 2,
        y: (page.height - h) / 2,
        w, h,
        src,
        aspect: img.naturalWidth / img.naturalHeight,
      };
      addObject(obj);
      onOpenChange(false);
      toast.success("Signature placed — drag it, resize it, then save.");
    };
    img.onerror = () => toast.error("Something went wrong embedding the signature.");
    img.src = src;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <SignatureIcon className="size-4 text-primary" aria-hidden="true" />
            Draw your signature
          </DialogTitle>
          <DialogDescription>
            Use your mouse, trackpad or finger. The signature is placed
            with a transparent background — drag and resize it on the
            page like any other object.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
              Ink
            </span>
            {INK_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Ink colour ${c}`}
                onClick={() => setInk(c)}
                className={`size-6 rounded-lg border transition-transform hover:scale-110 ${
                  ink === c ? "border-primary ring-2 ring-primary/40" : "border-border"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={clear}
              className="ml-auto gap-1.5"
            >
              <Eraser className="size-3.5" aria-hidden="true" />
              Clear
            </Button>
          </div>

          <div
            role="img"
            aria-label="Signature drawing pad"
            className="relative w-full overflow-hidden rounded-xl border border-dashed border-border bg-[repeating-linear-gradient(0deg,#fafbfc_0px,#fafbfc_23px,var(--border)_23px,var(--border)_24px)] bg-white dark:bg-[#0E1626]"
          >
            <canvas
              ref={canvasRef}
              className="h-[220px] w-full touch-none"
              style={{ display: "block" }}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerLeave={onUp}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={insert}>
            Place on page
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
