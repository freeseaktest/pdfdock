"use client";

/**
 * PDFDock — the top-level editor app: landing ⇄ workspace, with the
 * dialogs (signature, export, forms) and the mobile page-rail sheet.
 */

import { useCallback, useState } from "react";
import { FileStack } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SiteHeader, SiteFooter } from "@/components/site/chrome";
import { Landing } from "./landing";
import { TopBar } from "./top-bar";
import { PageRail } from "./page-rail";
import { ToolDock } from "./tool-dock";
import { PropertiesPanel } from "./properties";
import { Workspace } from "./workspace";
import { SignatureDialog } from "./signature-dialog";
import { ExportDialog } from "./export-dialog";
import { FormsPanel } from "./forms-panel";
import { readFormFields } from "@/lib/editor/engine";
import { newId, useEditor } from "@/lib/editor/store";
import type { ImageObject } from "@/lib/editor/types";

function readImageFile(file: File): Promise<{ src: string; w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read-failed"));
    reader.onload = () => {
      const src = String(reader.result);
      const img = new Image();
      img.onload = () => resolve({ src, w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => reject(new Error("decode-failed"));
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

export function EditorApp() {
  const status = useEditor((s) => s.status);
  const pages = useEditor((s) => s.pages);
  const pageIndex = useEditor((s) => s.pageIndex);
  const addObject = useEditor((s) => s.addObject);

  const [signOpen, setSignOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [formsOpen, setFormsOpen] = useState(false);
  const [formsBusy, setFormsBusy] = useState(false);
  const [railOpen, setRailOpen] = useState(false);

  /* the Forms button is the single entry point — the fields are read
     with pdf-lib on click, never inside a render effect */
  const onForms = useCallback(async () => {
    setFormsOpen(true);
    const s = useEditor.getState();
    if (!s.doc || s.formFields !== null) return;
    setFormsBusy(true);
    try {
      const fields = await readFormFields(s.doc.bytes);
      useEditor.getState().setFormFields(fields);
      if (fields === null) {
        toast.info(
          "This PDF has no fillable form fields — but you can still type anywhere with the Text tool.",
        );
      }
    } catch {
      toast.error("Couldn't read the form fields of this PDF.");
    } finally {
      setFormsBusy(false);
    }
  }, []);

  const onImage = useCallback(
    async (file: File) => {
      try {
        const { src, w, h } = await readImageFile(file);
        const page = pages[pageIndex];
        if (!page) return;
        /* scale to a sane size: cover at most 40% of the page width */
        const targetW = Math.min(page.width * 0.4, 240);
        const targetH = (targetW / w) * h;
        const obj: ImageObject = {
          id: newId("img"),
          pageId: page.id,
          type: "image",
          x: (page.width - targetW) / 2,
          y: (page.height - targetH) / 2,
          w: targetW,
          h: targetH,
          src,
          aspect: w / h,
        };
        addObject(obj);
        toast.success("Image placed — drag to move; hold Ctrl (⌘/Alt) while resizing to keep proportions.");
      } catch {
        toast.error("Couldn't read that image — try a PNG or JPEG.");
      }
    },
    [pages, pageIndex, addObject],
  );

  /* ---------------- workspace shell ---------------- */

  if (status === "ready") {
    return (
      <>
        <div className="flex h-[100dvh] flex-col overflow-hidden">
          <TopBar
            onExport={() => setExportOpen(true)}
            onForms={() => void onForms()}
          />

          <div className="flex min-h-0 flex-1">
            {/* left: page rail on desktop */}
            <aside className="hidden w-[188px] shrink-0 flex-col border-r border-border bg-card lg:flex">
              <div className="border-b border-border px-3 py-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Pages
                </p>
              </div>
              <div className="min-h-0 flex-1">
                <PageRail />
              </div>
            </aside>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col sm:flex-row">
              {/* tool dock: strip above the canvas on mobile, slim vertical
                  bar to its left on desktop (orientation flips at sm) */}
              <aside className="flex flex-row items-center gap-1.5 border-b border-border bg-card px-1.5 py-1.5 sm:flex-col sm:gap-1 sm:border-b-0 sm:border-r sm:px-1.5 sm:py-2">
                <Sheet open={railOpen} onOpenChange={setRailOpen}>
                  <SheetTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      aria-label="Open page list"
                      className="gap-1.5 lg:hidden"
                    >
                      <FileStack className="size-4" aria-hidden="true" />
                      Pages
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[220px] p-0">
                    <SheetHeader className="border-b border-border px-3 py-3">
                      <SheetTitle className="text-[13px] font-display">
                        Pages
                      </SheetTitle>
                      <SheetDescription className="text-[11.5px]">
                        Tap a thumbnail to jump; use the icons to rotate,
                        add or delete.
                      </SheetDescription>
                    </SheetHeader>
                    <div className="thin-scroll h-[calc(100%-96px)] overflow-y-auto">
                      <PageRail onNavigate={() => setRailOpen(false)} />
                    </div>
                  </SheetContent>
                </Sheet>
                <div className="min-w-0 flex-1 sm:flex-none">
                  <ToolDock
                    onSign={() => setSignOpen(true)}
                    onImage={(f) => void onImage(f)}
                  />
                </div>
              </aside>

              {/* the canvas */}
              <Workspace />
            </div>

            {/* right: properties on wide screens */}
            <aside className="thin-scroll hidden w-[248px] shrink-0 overflow-y-auto border-l border-border bg-card xl:block">
              <div className="border-b border-border px-3 py-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Properties
                </p>
              </div>
              <PropertiesPanel />
            </aside>
          </div>

          {/* mobile: collapsible properties strip */}
          <div className="border-t border-border bg-card xl:hidden">
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground marker:hidden [&::-webkit-details-marker]:hidden">
                Properties
                <span className="text-[10px] font-semibold normal-case tracking-normal text-primary group-open:hidden">
                  tap to open
                </span>
              </summary>
              <div className="thin-scroll max-h-[38vh] overflow-y-auto border-t border-border">
                <PropertiesPanel />
              </div>
            </details>
          </div>
        </div>

        <SignatureDialog open={signOpen} onOpenChange={setSignOpen} />
        <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
        <FormsPanel open={formsOpen} onOpenChange={setFormsOpen} loading={formsBusy} />
      </>
    );
  }

  /* ---------------- landing ---------------- */

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Landing />
      </main>
      <SiteFooter />
    </>
  );
}
