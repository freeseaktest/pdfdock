"use client";

/**
 * PDFDock — the workspace: pdf.js-rendered canvas + the interactive
 * overlay where every annotation lives. All pointer gestures
 * (create / move / resize / draw) and keyboard shortcuts land here.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useEditor, newId } from "@/lib/editor/store";
import { renderPage } from "@/lib/editor/engine";
import type { EditorObject, LineObject, StrokeObject } from "@/lib/editor/types";
import { ObjectView, DraftView, type HandleId } from "./object-renderer";

type Gesture =
  | { kind: "none" }
  | { kind: "create"; anchor: { x: number; y: number } }
  | { kind: "pen"; anchor: { x: number; y: number }; points: { x: number; y: number }[]; obj: StrokeObject }
  | { kind: "move"; id: string; start: { x: number; y: number }; origin: { x: number; y: number } }
  | {
      kind: "resize";
      id: string;
      handle: HandleId | "p1" | "p2";
      start: { x: number; y: number };
      origin: { x: number; y: number; w: number; h: number };
      line?: { x1: number; y1: number; x2: number; y2: number };
    };

const SHAPE_TOOLS = new Set(["whiteout", "highlight", "rect", "ellipse", "line"]);

export function Workspace() {
  const doc = useEditor((s) => s.doc);
  const pages = useEditor((s) => s.pages);
  const pageIndex = useEditor((s) => s.pageIndex);
  const objects = useEditor((s) => s.objects);
  const tool = useEditor((s) => s.tool);
  const settings = useEditor((s) => s.settings);
  const selectedId = useEditor((s) => s.selectedId);
  const editingTextId = useEditor((s) => s.editingTextId);
  const requestedZoom = useEditor((s) => s.requestedZoom);
  const zoom = useEditor((s) => s.zoom);
  const select = useEditor((s) => s.select);
  const setEditingText = useEditor((s) => s.setEditingText);
  const addObject = useEditor((s) => s.addObject);
  const updateObject = useEditor((s) => s.updateObject);
  const pushHistory = useEditor((s) => s.pushHistory);
  /* undo/redo/delete live in the window keydown handler, which reads
     them straight from useEditor.getState() — no subscriptions needed */

  const scrollRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gestureRef = useRef<Gesture>({ kind: "none" });

  const [containerWidth, setContainerWidth] = useState(0);
  const [rendering, setRendering] = useState(true);
  const [draft, setDraft] = useState<EditorObject | null>(null);
  const [dpr, setDpr] = useState(1);

  const page = pages[pageIndex];
  const pageId = page?.id;

  /* ---------------- zoom / fit ---------------- */

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !page) return;
    const observer = new ResizeObserver(() => {
      setContainerWidth(el.clientWidth - 24);
    });
    observer.observe(el);
    setContainerWidth(el.clientWidth - 24);
    return () => observer.disconnect();
  }, [page?.id]);

  useEffect(() => {
    const update = () => setDpr(window.devicePixelRatio || 1);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const fitScale = page && containerWidth > 0 ? containerWidth / page.width : 1;

  useEffect(() => {
    if (!page) return;
    const next = requestedZoom === "fit" ? Math.max(fitScale, 0.1) : requestedZoom;
    useEditor.setState({ zoom: next });
  }, [requestedZoom, fitScale, page?.id]);

  /* ---------------- canvas rendering ---------------- */

  useEffect(() => {
    if (!page || !canvasRef.current) return;
    let cancelled = false;
    const scale = zoom * dpr;
    const canvas = canvasRef.current;
    const run = async () => {
      setRendering(true); /* inside the async runner, before any await */
      try {
        if (page.srcIndex === null) {
          /* blank page: plain white canvas, no pdf.js call */
          const ctx = canvas.getContext("2d");
          canvas.width = Math.max(1, Math.floor(page.width * scale));
          canvas.height = Math.max(1, Math.floor(page.height * scale));
          if (ctx) {
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
          canvas.style.width = `${page.width * zoom}px`;
          canvas.style.height = `${page.height * zoom}px`;
          if (!cancelled) setRendering(false);
          return;
        }
        const size = await renderPage(page.srcIndex, page.rotation, scale, canvas);
        if (size && !cancelled) {
          canvas.style.width = `${size.width}px`;
          canvas.style.height = `${size.height}px`;
          setRendering(false);
        }
      } catch {
        if (!cancelled) setRendering(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [page?.id, page?.srcIndex, page?.rotation, zoom, dpr]);

  /* ---------------- pointer → display points ---------------- */

  const pointFrom = useCallback(
    (e: PointerEvent | React.PointerEvent): { x: number; y: number } => {
      const rect = surfaceRef.current?.getBoundingClientRect();
      if (!rect || !page) return { x: 0, y: 0 };
      return {
        x: Math.max(0, Math.min((e.clientX - rect.left) / zoom, page.width)),
        y: Math.max(0, Math.min((e.clientY - rect.top) / zoom, page.height)),
      };
    },
    [page, zoom],
  );

  /* ---------------- object creation ---------------- */

  const makeObjectAt = useCallback(
    (pt: { x: number; y: number }, size = { w: 180, h: 20 }): EditorObject | null => {
      if (!pageId) return null;
      const base = { id: newId("obj"), pageId, x: pt.x, y: pt.y, w: size.w, h: size.h };
      switch (tool) {
        case "text":
          return {
            ...base, type: "text", text: "",
            fontKey: settings.fontKey, fontSize: settings.fontSize,
            color: settings.textColor,
          };
        case "whiteout":
          return { ...base, type: "whiteout", fillColor: settings.whiteoutColor, strokeColor: null, strokeWidth: 1, opacity: 1 };
        case "highlight":
          return { ...base, type: "highlight", fillColor: settings.highlightColor, strokeColor: null, strokeWidth: 1, opacity: 0.35 };
        case "rect":
          return { ...base, type: "rect", fillColor: settings.shapeFillColor, strokeColor: settings.shapeStrokeColor, strokeWidth: settings.shapeStrokeWidth, opacity: settings.shapeOpacity };
        case "ellipse":
          return { ...base, type: "ellipse", fillColor: settings.shapeFillColor, strokeColor: settings.shapeStrokeColor, strokeWidth: settings.shapeStrokeWidth, opacity: settings.shapeOpacity };
        default:
          return null;
      }
    },
    [pageId, tool, settings],
  );

  /* ---------------- pointer gestures ---------------- */

  const onSurfacePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const pt = pointFrom(e);
    /* a pointer can already be released when this runs (rapid taps,
       synthetic events) — capture is a gesture nicety, never a must */
    try {
      surfaceRef.current?.setPointerCapture(e.pointerId);
    } catch {
      /* pointer already gone — the gesture still works */
    }

    if (tool === "select") {
      select(null);
      return;
    }
    if (tool === "text") {
      const obj = makeObjectAt(pt);
      if (obj) {
        addObject(obj);
        setEditingText(obj.id);
      }
      return;
    }
    if (tool === "pen") {
      if (!pageId) return;
      /* the anchor stays FIXED for the whole stroke — points are
         relative to it, and the bbox is normalized once, on commit */
      const stroke: StrokeObject = {
        id: newId("pen"), pageId, type: "pen",
        x: pt.x, y: pt.y, w: 1, h: 1,
        points: [{ x: 0, y: 0 }],
        strokeColor: settings.penColor,
        strokeWidth: settings.penWidth,
        opacity: settings.shapeOpacity,
      };
      gestureRef.current = { kind: "pen", anchor: pt, points: [{ x: 0, y: 0 }], obj: stroke };
      setDraft(stroke);
      return;
    }
    if (SHAPE_TOOLS.has(tool)) {
      gestureRef.current = { kind: "create", anchor: pt };
      return;
    }
  };

  const onSurfacePointerMove = (e: React.PointerEvent) => {
    const g = gestureRef.current;
    if (g.kind === "none") return;
    const pt = pointFrom(e);

    if (g.kind === "create") {
      if (!pageId) return;
      const x = Math.min(g.anchor.x, pt.x);
      const y = Math.min(g.anchor.y, pt.y);
      const w = Math.abs(pt.x - g.anchor.x);
      const h = Math.abs(pt.y - g.anchor.y);
      if (tool === "line") {
        if (!draft) {
          setDraft({
            id: "draft", pageId, type: "line",
            x, y, w, h,
            x1: g.anchor.x, y1: g.anchor.y, x2: pt.x, y2: pt.y,
            strokeColor: settings.penColor, strokeWidth: settings.penWidth,
          } as LineObject);
        } else {
          setDraft({ ...draft, x, y, w, h, x2: pt.x, y2: pt.y } as LineObject);
        }
        return;
      }
      const obj = makeObjectAt({ x, y }, { w, h });
      if (obj) setDraft(obj);
      return;
    }

    if (g.kind === "pen") {
      const dx = pt.x - g.anchor.x;
      const dy = pt.y - g.anchor.y;
      const last = g.points[g.points.length - 1];
      if (Math.hypot(dx - last.x, dy - last.y) < 1.2) return;
      g.points = [...g.points, { x: dx, y: dy }];
      const xs = g.points.map((p) => p.x);
      const ys = g.points.map((p) => p.y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const stroke: StrokeObject = {
        ...g.obj,
        x: g.anchor.x + minX,
        y: g.anchor.y + minY,
        w: Math.max(...xs) - minX,
        h: Math.max(...ys) - minY,
        /* preview with points normalized to the live bbox, so the ink
           tracks the cursor exactly */
        points: g.points.map((p) => ({ x: p.x - minX, y: p.y - minY })),
      };
      setDraft(stroke);
      return;
    }

    if (g.kind === "move") {
      const dx = pt.x - g.start.x;
      const dy = pt.y - g.start.y;
      updateObject(g.id, { x: g.origin.x + dx, y: g.origin.y + dy });
      return;
    }

    if (g.kind === "resize") {
      const dx = pt.x - g.start.x;
      const dy = pt.y - g.start.y;
      if (g.handle === "p1" || g.handle === "p2") {
        if (!g.line) return;
        const nx1 = g.handle === "p1" ? g.line.x1 + dx : g.line.x1;
        const ny1 = g.handle === "p1" ? g.line.y1 + dy : g.line.y1;
        const nx2 = g.handle === "p2" ? g.line.x2 + dx : g.line.x2;
        const ny2 = g.handle === "p2" ? g.line.y2 + dy : g.line.y2;
        updateObject(g.id, {
          x1: nx1, y1: ny1, x2: nx2, y2: ny2,
          x: Math.min(nx1, nx2), y: Math.min(ny1, ny2),
          w: Math.abs(nx2 - nx1), h: Math.abs(ny2 - ny1),
        });
        return;
      }
      /* corner / edge resize: keep the opposite corner anchored */
      const o = g.origin;
      let { x, y, w, h } = o;
      if (g.handle.includes("e")) w = Math.max(o.w + dx, 6);
      if (g.handle.includes("s")) h = Math.max(o.h + dy, 6);
      if (g.handle.includes("w")) {
        w = Math.max(o.w - dx, 6);
        x = o.x + (o.w - w);
      }
      if (g.handle.includes("n")) {
        h = Math.max(o.h - dy, 6);
        y = o.y + (o.h - h);
      }
      updateObject(g.id, { x, y, w, h });
    }
  };

  const onSurfacePointerUp = (e: React.PointerEvent) => {
    const g = gestureRef.current;
    const pt = pointFrom(e);
    gestureRef.current = { kind: "none" };

    if (g.kind === "create") {
      const minSize = 6;
      if (tool === "line") {
        if (draft && draft.type === "line") {
          const len = Math.hypot(draft.x2 - draft.x1, draft.y2 - draft.y1);
          if (len >= minSize) addObject({ ...draft, id: newId("obj") });
        }
        setDraft(null);
        return;
      }
      const w = draft?.w ?? 0;
      const h = draft?.h ?? 0;
      if (w >= minSize && h >= minSize && draft) {
        addObject({ ...draft, id: newId("obj") });
      } else if (draft) {
        /* too small to be a gesture → make a default-sized object */
        const fallback = { ...draft, id: newId("obj"), w: 160, h: tool === "highlight" ? 16 : 80 };
        addObject(fallback);
      }
      setDraft(null);
      return;
    }

    if (g.kind === "pen") {
      const raw = g.points;
      setDraft(null);
      if (raw.length > 2) {
        /* normalize: points relative to the bbox top-left */
        const xs = raw.map((p) => p.x);
        const ys = raw.map((p) => p.y);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const stroke: StrokeObject = {
          ...g.obj,
          x: g.anchor.x + minX,
          y: g.anchor.y + minY,
          w: Math.max(...xs) - minX,
          h: Math.max(...ys) - minY,
          points: raw.map((p) => ({ x: p.x - minX, y: p.y - minY })),
        };
        addObject({ ...stroke, id: newId("obj") }, false);
      }
      return;
    }

    if (g.kind === "move" || g.kind === "resize") {
      void pt;
      return;
    }
  };

  /* ---------------- object-level handlers ---------------- */

  const onObjectPointerDown = (e: React.PointerEvent, id: string) => {
    if (tool !== "select" && !(tool === "text" && editingTextId)) {
      /* creating with a tool: let the surface handle it */
      return;
    }
    e.stopPropagation();
    const obj = objects.find((o) => o.id === id);
    if (!obj) return;
    if (editingTextId && editingTextId !== id) setEditingText(null);
    if (obj.type === "text" && editingTextId === id) return; /* typing */
    select(id);
    pushHistory();
    const pt = pointFrom(e);
    try {
      surfaceRef.current?.setPointerCapture(e.pointerId);
    } catch {
      /* pointer already gone */
    }
    gestureRef.current = {
      kind: "move",
      id,
      start: pt,
      origin: { x: obj.x, y: obj.y },
    };
  };

  const onHandlePointerDown = (
    e: React.PointerEvent,
    id: string,
    handle: HandleId | "p1" | "p2",
  ) => {
    const obj = objects.find((o) => o.id === id);
    if (!obj) return;
    select(id);
    pushHistory();
    const pt = pointFrom(e);
    try {
      surfaceRef.current?.setPointerCapture(e.pointerId);
    } catch {
      /* pointer already gone */
    }
    gestureRef.current = {
      kind: "resize",
      id,
      handle,
      start: pt,
      origin: { x: obj.x, y: obj.y, w: obj.w, h: obj.h },
      line:
        obj.type === "line"
          ? { x1: obj.x1, y1: obj.y1, x2: obj.x2, y2: obj.y2 }
          : undefined,
    };
  };

  const onEditText = (id: string, text: string) => {
    const obj = objects.find((o) => o.id === id);
    if (!obj || obj.type !== "text") return;
    const lines = text.split("\n").length || 1;
    updateObject(id, { text, h: Math.max(obj.fontSize * 1.3, lines * obj.fontSize * 1.3) });
  };

  const onCommitTextSize = (id: string) => {
    const obj = objects.find((o) => o.id === id);
    if (!obj || obj.type !== "text") return;
    const lines = obj.text.split("\n").length || 1;
    updateObject(id, { h: Math.max(obj.fontSize * 1.3, lines * obj.fontSize * 1.3) });
    setEditingText(null);
  };

  /* ---------------- keyboard shortcuts ---------------- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing =
        t.tagName === "INPUT" ||
        t.tagName === "TEXTAREA" ||
        t.tagName === "SELECT" ||
        t.isContentEditable;
      if (typing) return;

      const s = useEditor.getState();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        s.redo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        if (s.selectedId) {
          e.preventDefault();
          s.duplicateObject(s.selectedId);
        }
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (s.selectedId) {
          e.preventDefault();
          s.deleteObject(s.selectedId);
        }
        return;
      }
      if (e.key === "Escape") {
        if (s.selectedId || s.editingTextId) {
          s.select(null);
          s.setEditingText(null);
        } else if (s.tool !== "select") {
          s.setTool("select");
        }
        return;
      }
      /* nudge the selection with the arrow keys */
      if (s.selectedId && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        const obj = s.objects.find((o) => o.id === s.selectedId);
        if (!obj) return;
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        s.updateObject(obj.id, { x: obj.x + dx, y: obj.y + dy });
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ---------------- render ---------------- */

  if (!doc || !page) return null;

  const pageObjects = objects.filter((o) => o.pageId === page.id);
  const drawTouch =
    tool === "pen" || SHAPE_TOOLS.has(tool) ? "none" : "auto";
  const cursor =
    tool === "select" ? "default" : tool === "text" ? "text" : "crosshair";

  return (
    <div
      ref={scrollRef}
      className="relative flex-1 overflow-auto bg-mist dark:bg-[#0B1220]"
      aria-label="PDF page editing surface"
    >
      <div className="flex min-h-full w-full items-start justify-center p-3">
        <div
          className="relative select-none"
          style={{ width: page.width * zoom, height: page.height * zoom }}
        >
          <canvas
            ref={canvasRef}
            className="page-canvas absolute left-0 top-0 rounded-[3px] bg-white"
            style={{
              width: page.width * zoom,
              height: page.height * zoom,
            }}
            aria-label={`Page ${pageIndex + 1} of ${pages.length}`}
          />
          {/* the interactive overlay. Preventing the compatibility
              mousedown's default keeps the auto-focused text editor from
              losing focus the instant it appears (while still allowing
              real clicks, double-clicks and caret placement). */}
          <div
            ref={surfaceRef}
            role="application"
            aria-label="Annotation layer"
            onMouseDown={(e) => {
              const t = e.target as HTMLElement;
              if (t.tagName !== "TEXTAREA" && t.tagName !== "INPUT") {
                e.preventDefault();
              }
            }}
            onPointerDown={onSurfacePointerDown}
            onPointerMove={onSurfacePointerMove}
            onPointerUp={onSurfacePointerUp}
            onPointerCancel={onSurfacePointerUp}
            className="absolute left-0 top-0"
            style={{
              width: page.width * zoom,
              height: page.height * zoom,
              touchAction: drawTouch,
              cursor,
            }}
          >
            {pageObjects.map((obj) => (
              <ObjectView
                key={obj.id}
                obj={obj}
                scale={zoom}
                selected={obj.id === selectedId}
                editing={obj.id === editingTextId}
                onPointerDownObject={onObjectPointerDown}
                onDoubleClickText={(id) => {
                  const obj2 = objects.find((o) => o.id === id);
                  if (obj2?.type === "text") {
                    pushHistory();
                    setEditingText(id);
                  }
                }}
                onPointerDownHandle={onHandlePointerDown}
                onEditText={onEditText}
                onCommitTextSize={onCommitTextSize}
              />
            ))}
            {draft ? <DraftView obj={draft} scale={zoom} /> : null}
          </div>
          {rendering ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="flex items-center gap-1.5 rounded-full border border-border bg-card/95 px-3 py-1.5 text-[11.5px] font-semibold text-muted-foreground shadow-sm">
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                Rendering page…
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
