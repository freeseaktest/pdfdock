"use client";

/**
 * PDFDock — the page rail: thumbnails of every page, quick page ops
 * (rotate / delete / insert blank). Rendered as a sidebar on desktop
 * and inside a sheet on mobile.
 */

import { useEffect, useRef } from "react";
import {
  CopyPlus,
  Loader2,
  Plus,
  RotateCw,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEditor, refreshThumb } from "@/lib/editor/store";
import { renderThumb } from "@/lib/editor/engine";
import { navBus } from "./nav";
import type { PageEntry } from "@/lib/editor/types";

function PageThumb({
  page,
  index,
  active,
  onNavigate,
}: {
  page: PageEntry;
  index: number;
  active: boolean;
  onNavigate?: () => void;
}) {
  const setThumb = useEditor((s) => s.setThumb);
  const setPageIndex = useEditor((s) => s.setPageIndex);
  const ref = useRef<HTMLButtonElement>(null);

  /* render lazily once the row scrolls near the viewport */
  useEffect(() => {
    const el = ref.current;
    if (!el || page.thumb || page.srcIndex === null) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          void renderThumb(page.srcIndex as number, page.rotation)
            .then((thumb) => setThumb(page.id, thumb))
            .catch(() => undefined);
        }
      },
      { root: el.closest(".thin-scroll") as Element | null, rootMargin: "160px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [page.id, page.thumb, page.srcIndex, page.rotation, setThumb]);

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => {
        setPageIndex(index);
        navBus.goToPage(index);
        onNavigate?.();
      }}
      aria-label={`Go to page ${index + 1}`}
      aria-current={active ? "true" : undefined}
      className={`flex w-full flex-col items-center gap-1 rounded-xl border p-1.5 transition-colors ${
        active
          ? "border-primary bg-secondary"
          : "border-transparent hover:border-border hover:bg-secondary/50"
      }`}
    >
      <span className="relative flex h-[110px] w-full items-center justify-center overflow-hidden rounded-lg border border-border bg-white">
        {page.srcIndex === null ? (
          <span className="text-[10px] font-semibold text-muted-foreground">
            Blank page
          </span>
        ) : page.thumb ? (
          <img
            src={page.thumb}
            alt=""
            className="h-full w-full object-contain object-top"
            draggable={false}
          />
        ) : (
          <Loader2
            className="size-4 animate-spin text-muted-foreground/50"
            aria-hidden="true"
          />
        )}
      </span>
      <span
        className={`text-[11px] font-bold ${active ? "text-primary" : "text-muted-foreground"}`}
      >
        {index + 1}
      </span>
    </button>
  );
}

export function PageRail({ onNavigate }: { onNavigate?: () => void }) {
  const pages = useEditor((s) => s.pages);
  const pageIndex = useEditor((s) => s.pageIndex);
  const rotatePage = useEditor((s) => s.rotatePage);
  const deletePage = useEditor((s) => s.deletePage);
  const insertBlankPage = useEditor((s) => s.insertBlankPage);

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="thin-scroll flex flex-1 flex-col gap-2 overflow-y-auto px-1.5 py-1">
        {pages.map((page, i) => (
          <div key={page.id} className="group/thumb relative">
            <PageThumb page={page} index={i} active={i === pageIndex} onNavigate={onNavigate} />
            {/* hover controls */}
            <div className="absolute right-1.5 top-1.5 flex gap-0.5 rounded-lg border border-border bg-card/95 p-0.5 opacity-0 shadow-sm transition-opacity group-hover/thumb:opacity-100 focus-within:opacity-100">
              <button
                type="button"
                aria-label={`Rotate page ${i + 1} 90 degrees clockwise`}
                onClick={() => {
                  rotatePage(page.id);
                  void refreshThumb(page.id);
                }}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <RotateCw className="size-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={`Insert a blank page after page ${i + 1}`}
                onClick={() => insertBlankPage(i)}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Plus className="size-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={`Delete page ${i + 1}`}
                disabled={pages.length <= 1}
                onClick={() => deletePage(page.id)}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30 aria-disabled:opacity-30"
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-border pt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => insertBlankPage(pages.length - 1)}
          className="w-full gap-1.5"
        >
          <CopyPlus className="size-3.5" aria-hidden="true" />
          Blank page at end
        </Button>
      </div>
    </div>
  );
}
