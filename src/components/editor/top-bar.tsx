"use client";

/**
 * PDFDock — workspace top bar: identity, history, zoom, page navigation,
 * forms entry point and the download action.
 */

import { useTheme } from "next-themes";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  ListChecks,
  Moon,
  Redo2,
  Sun,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEditor } from "@/lib/editor/store";
import { formatBytes } from "@/lib/editor/engine";
import { LogoMark } from "@/components/site/logo";

export function TopBar({
  onExport,
  onForms,
}: {
  onExport: () => void;
  onForms: () => void;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const doc = useEditor((s) => s.doc);
  const pages = useEditor((s) => s.pages);
  const pageIndex = useEditor((s) => s.pageIndex);
  const setPageIndex = useEditor((s) => s.setPageIndex);
  const zoom = useEditor((s) => s.zoom);
  const setZoom = useEditor((s) => s.setZoom);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const reset = useEditor((s) => s.reset);
  const formFields = useEditor((s) => s.formFields);
  const objects = useEditor((s) => s.objects);

  if (!doc) return null;
  const zoomPct = Math.round(zoom * 100);
  const dirtyCount = objects.length;

  return (
    <div className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur-md">
      <div className="flex h-[54px] items-center gap-2 px-2 sm:px-3">
        <LogoMark className="size-8 shrink-0" />

        {/* file identity */}
        <div className="flex min-w-0 items-center gap-2 rounded-xl border border-border bg-secondary/60 px-2.5 py-1.5">
          <FileText className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[12px] font-bold text-foreground">
              {doc.fileName}
            </p>
            <p className="text-[10.5px] text-muted-foreground">
              {pages.length} page{pages.length > 1 ? "s" : ""} ·{" "}
              {formatBytes(doc.fileSize)} · {dirtyCount} object
              {dirtyCount === 1 ? "" : "s"}
            </p>
          </div>
          <button
            type="button"
            onClick={reset}
            aria-label="Close document and start over"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        {/* actions */}
        <TooltipProvider delayDuration={300}>
          <div className="ml-auto flex items-center gap-1">
            <div className="hidden items-center gap-1 sm:flex">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Undo (Ctrl+Z)"
                    onClick={undo}
                    disabled={!canUndo}
                  >
                    <Undo2 className="size-[17px]" aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Redo (Ctrl+Shift+Z)"
                    onClick={redo}
                    disabled={!canRedo}
                  >
                    <Redo2 className="size-[17px]" aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Redo (Ctrl+Shift+Z)</TooltipContent>
              </Tooltip>
            </div>

            {/* page navigation */}
            <div className="hidden items-center gap-0.5 md:flex">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Previous page"
                onClick={() => setPageIndex(pageIndex - 1)}
                disabled={pageIndex === 0}
              >
                <ChevronLeft className="size-[17px]" aria-hidden="true" />
              </Button>
              <span className="min-w-[64px] text-center text-[12px] font-bold text-muted-foreground">
                {pageIndex + 1} / {pages.length}
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Next page"
                onClick={() => setPageIndex(pageIndex + 1)}
                disabled={pageIndex >= pages.length - 1}
              >
                <ChevronRight className="size-[17px]" aria-hidden="true" />
              </Button>
            </div>

            {/* zoom */}
            <div className="hidden items-center gap-0.5 lg:flex">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Zoom out"
                onClick={() => setZoom(Math.max(0.5, zoom / 1.25))}
              >
                <ZoomOut className="size-[17px]" aria-hidden="true" />
              </Button>
              <button
                type="button"
                aria-label="Reset zoom to fit width"
                onClick={() => setZoom("fit")}
                className="min-w-[54px] rounded-lg px-1 text-center text-[12px] font-bold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {zoomPct}%
              </button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Zoom in"
                onClick={() => setZoom(Math.min(4, zoom * 1.25))}
              >
                <ZoomIn className="size-[17px]" aria-hidden="true" />
              </Button>
            </div>

            {/* forms */}
            <Button
              variant="outline"
              size="sm"
              onClick={onForms}
              className="gap-1.5"
            >
              <ListChecks className="size-3.5" aria-hidden="true" />
              <span className="hidden xl:inline">Forms</span>
              {formFields && formFields.length > 0 ? (
                <span className="rounded-full bg-mint/15 px-1.5 py-0.5 text-[10px] font-bold text-mint-deep dark:text-mint">
                  {formFields.length}
                </span>
              ) : null}
            </Button>

            {/* theme */}
            <Button
              variant="ghost"
              size="icon"
              aria-label="Toggle dark mode"
              onClick={() =>
                setTheme(resolvedTheme === "dark" ? "light" : "dark")
              }
              className="hidden sm:inline-flex"
            >
              <Sun className="hidden size-[17px] dark:block" aria-hidden="true" />
              <Moon className="size-[17px] dark:hidden" aria-hidden="true" />
            </Button>

            {/* download */}
            <Button size="sm" onClick={onExport} className="gap-1.5">
              <Download className="size-3.5" aria-hidden="true" />
              Save PDF
            </Button>
          </div>
        </TooltipProvider>
      </div>

      {/* mobile second row: undo/redo · pages · zoom */}
      <div className="flex items-center justify-between gap-1 border-t border-border px-2 py-1.5 sm:hidden">
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Undo"
            onClick={undo}
            disabled={!canUndo}
            className="size-9"
          >
            <Undo2 className="size-4" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Redo"
            onClick={redo}
            disabled={!canRedo}
            className="size-9"
          >
            <Redo2 className="size-4" aria-hidden="true" />
          </Button>
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Previous page"
            onClick={() => setPageIndex(pageIndex - 1)}
            disabled={pageIndex === 0}
            className="size-9"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Button>
          <span className="min-w-[52px] text-center text-[12px] font-bold text-muted-foreground">
            {pageIndex + 1}/{pages.length}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Next page"
            onClick={() => setPageIndex(pageIndex + 1)}
            disabled={pageIndex >= pages.length - 1}
            className="size-9"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Zoom out"
            onClick={() => setZoom(Math.max(0.5, zoom / 1.25))}
            className="size-9"
          >
            <ZoomOut className="size-4" aria-hidden="true" />
          </Button>
          <button
            type="button"
            aria-label="Reset zoom to fit width"
            onClick={() => setZoom("fit")}
            className="min-w-[46px] rounded-lg text-center text-[12px] font-bold text-muted-foreground"
          >
            {zoomPct}%
          </button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Zoom in"
            onClick={() => setZoom(Math.min(4, zoom * 1.25))}
            className="size-9"
          >
            <ZoomIn className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* the "fit" state is surfaced in the zoom chip */}
    </div>
  );
}
