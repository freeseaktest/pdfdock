"use client";

/**
 * PDFDock — the workspace: a continuously scrolling column of pages
 * (pdf.js-rendered canvases) with the interactive overlay where every
 * annotation lives. All pointer gestures (create / move / resize /
 * draw / retype) and the keyboard shortcuts land here.
 *
 * Pages render lazily (the visible window plus one page of buffer);
 * the rest are height-accurate placeholders so the scrollbar is
 * always truthful, even for 200-page documents.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useEditor, newId } from "@/lib/editor/store";
import { renderPage, findTextAt } from "@/lib/editor/engine";
import type {
  BoxObject,
  EditorObject,
  LineObject,
  PageEntry,
  StrokeObject,
  TextObject,
} from "@/lib/editor/types";
import { ObjectView, DraftView, type HandleId } from "./object-renderer";
import { navBus } from "./nav";

type Gesture =
  | { kind: "none" }
  | { kind: "create"; page: PageEntry; anchor: { x: number; y: number } }
  | {
      kind: "pen";
      page: PageEntry;
      anchor: { x: number; y: number };
      points: { x: number; y: number }[];
      obj: StrokeObject;
    }
  | { kind: "move"; id: string; page: PageEntry; start: { x: number; y: number }; origin: { x: number; y: number } }
  | {
      kind: "resize";
      id: string;
      page: PageEntry;
      handle: HandleId | "p1" | "p2";
      start: { x: number; y: number };
      origin: { x: number; y: number; w: number; h: number };
      aspect?: number;
      line?: { x1: number; y1: number; x2: number; y2: number };
    };

/** tools that drag out a box / line (brushes excluded) */
const SHAPE_TOOLS = new Set(["rect", "ellipse", "line"]);
/** tools that draw freehand strokes */
const STROKE_TOOLS = new Set(["pen", "whiteout", "highlight"]);

/** vertical spacing between pages, px */
const SLOT_GAP = 24;

/** the retype hint is toasted once per session, not on every click */
let retypeHintShown = false;

export function Workspace() {
  const doc = useEditor((s) => s.doc);
  const pages = useEditor((s) => s.pages);
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
  const addObjects = useEditor((s) => s.addObjects);
  const updateObject = useEditor((s) => s.updateObject);
  const pushHistory = useEditor((s) => s.pushHistory);
  /* undo/redo/delete live in the window keydown handler, which reads
     them straight from useEditor.getState() — no subscriptions needed */

  const scrollRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<Gesture>({ kind: "none" });

  const [containerWidth, setContainerWidth] = useState(0);
  const [visible, setVisible] = useState<[number, number]>([0, 1]);
  const [draft, setDraft] = useState<EditorObject | null>(null);
  const [dpr, setDpr] = useState(1);

  const maxPageWidth = pages.length > 0 ? Math.max(...pages.map((p) => p.width)) : 1;

  /* ---------------- zoom / fit ---------------- */

  useEffect(() => {
    const update = () => setDpr(window.devicePixelRatio || 1);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const fitScale = containerWidth > 0 ? containerWidth / maxPageWidth : 1;

  useEffect(() => {
    const next = requestedZoom === "fit" ? Math.max(fitScale, 0.1) : requestedZoom;
    useEditor.setState({ zoom: next });
  }, [requestedZoom, fitScale, maxPageWidth, pages.length]);

  /* ---------------- virtualized range + page sync ---------------- */

  const recomputeRange = useCallback(() => {
    const el = scrollRef.current;
    if (!el || pages.length === 0) return;
    const top = el.scrollTop;
    const vh = el.clientHeight;
    const center = top + vh / 2;
    let acc = 0;
    let start = pages.length - 1;
    let end = 0;
    let centerPage = 0;
    for (let i = 0; i < pages.length; i++) {
      const h = pages[i].height * zoom + SLOT_GAP;
      const bottom = acc + h;
      if (bottom > top && acc < top + vh) {
        start = Math.min(start, i);
        end = Math.max(end, i);
      }
      if (acc <= center && center < bottom) centerPage = i;
      acc += h;
    }
    const s = Math.max(0, start - 1);
    const e = Math.min(pages.length - 1, end + 1);
    setVisible((prev) => (prev[0] === s && prev[1] === e ? prev : [s, e]));
    if (centerPage !== useEditor.getState().pageIndex) {
      useEditor.getState().setVisiblePage(centerPage);
    }
  }, [pages, zoom]);

  /* container resize: re-fit width and recompute the visible window */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      setContainerWidth(el.clientWidth - 24);
      recomputeRange();
    });
    observer.observe(el);
    setContainerWidth(el.clientWidth - 24);
    return () => observer.disconnect();
  }, [recomputeRange, doc?.fileName]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        recomputeRange();
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    recomputeRange();
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [recomputeRange]);

  /* ---------------- page jumps (rail / top bar / keys) ---------------- */

  useEffect(() => {
    navBus.goToPage = (index) => {
      const el = scrollRef.current;
      if (!el || pages.length === 0) return;
      const i = Math.max(0, Math.min(index, pages.length - 1));
      let acc = 0;
      for (let k = 0; k < i; k++) acc += pages[k].height * zoom + SLOT_GAP;
      el.scrollTo({ top: Math.max(0, acc - 8), behavior: "smooth" });
    };
    return () => {
      navBus.goToPage = () => undefined;
    };
  }, [pages, zoom]);

  /* after a zoom change, keep the current page in view */
  const zoomRef = useRef(zoom);
  useEffect(() => {
    const el = scrollRef.current;
    const changed = zoomRef.current !== zoom;
    zoomRef.current = zoom;
    if (!el || !changed || pages.length === 0) return;
    const target = useEditor.getState().pageIndex;
    let acc = 0;
    for (let k = 0; k < target; k++) acc += pages[k].height * zoom + SLOT_GAP;
    el.scrollTo({ top: Math.max(0, acc - 8) });
  }, [zoom, pages]);

  /* ---------------- pointer → display points ---------------- */

  const pointFrom = useCallback(
    (
      e: PointerEvent | React.PointerEvent | React.MouseEvent,
      page: PageEntry,
      surface: HTMLElement,
    ): { x: number; y: number } => {
      const rect = surface.getBoundingClientRect();
      return {
        x: Math.max(0, Math.min((e.clientX - rect.left) / zoom, page.width)),
        y: Math.max(0, Math.min((e.clientY - rect.top) / zoom, page.height)),
      };
    },
    [zoom],
  );

  /* ---------------- object creation ---------------- */

  const makeObjectAt = useCallback(
    (page: PageEntry, pt: { x: number; y: number }, size = { w: 180, h: 20 }): EditorObject | null => {
      const base = { id: newId("obj"), pageId: page.id, x: pt.x, y: pt.y, w: size.w, h: size.h };
      switch (tool) {
        case "text":
          return {
            ...base, type: "text", text: "",
            fontKey: settings.fontKey, fontSize: settings.fontSize,
            color: settings.textColor,
          };
        case "rect":
          return { ...base, type: "rect", fillColor: settings.shapeFillColor, strokeColor: settings.shapeStrokeColor, strokeWidth: settings.shapeStrokeWidth, opacity: settings.shapeOpacity };
        case "ellipse":
          return { ...base, type: "ellipse", fillColor: settings.shapeFillColor, strokeColor: settings.shapeStrokeColor, strokeWidth: settings.shapeStrokeWidth, opacity: settings.shapeOpacity };
        default:
          return null;
      }
    },
    [tool, settings],
  );

  /* ---------------- retype assist (double-click existing text) ------- */

  const retypeAt = useCallback(
    async (page: PageEntry, surface: HTMLElement, e: React.MouseEvent) => {
      if (page.srcIndex === null) return;
      if (tool !== "select") return;
      /* double-clicked an object (or inside one)? let the object win */
      const t = e.target as HTMLElement;
      if (t.closest("[data-object-id]")) return;
      const pt = pointFrom(e, page, surface);
      const hit = await findTextAt(page.srcIndex, page.rotation, pt.x, pt.y);
      if (!hit) return;

      const size = Math.max(5, Math.min(60, Math.round(hit.size * 10) / 10));
      const pad = 2;
      /* the cover hides the original line; the new text sits on top of it */
      const cover: BoxObject = {
        id: newId("obj"),
        pageId: page.id,
        type: "whiteout",
        x: hit.x - pad,
        y: hit.y - pad,
        w: hit.w + pad * 2,
        h: hit.h + pad * 2,
        fillColor: settings.whiteoutColor,
        strokeColor: null,
        strokeWidth: 1,
        opacity: 1,
      };
      const ascent = size * 0.75;
      const text: TextObject = {
        id: newId("obj"),
        pageId: page.id,
        type: "text",
        text: hit.str,
        fontKey: settings.fontKey,
        fontSize: size,
        color: settings.textColor,
        x: hit.x,
        y: hit.baselineY !== null ? hit.baselineY - ascent : hit.y,
        w: Math.max(hit.w + 12, size * 4),
        h: Math.max(size * 1.3, hit.h + 4),
      };
      addObjects([cover, text], text.id);
      setEditingText(text.id);
      if (!retypeHintShown) {
        retypeHintShown = true;
        toast.info(
          "Retype: the original line is covered and your new text sits on top — edit it freely, then save.",
        );
      }
    },
    [tool, settings, pointFrom, addObjects, setEditingText],
  );

  /* ---------------- slot handlers (bound per page) ---------------- */

  const slotApi = {
    down: (e: React.PointerEvent, page: PageEntry, surface: HTMLElement) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      const pt = pointFrom(e, page, surface);
      /* a pointer can already be released when this runs (rapid taps,
         synthetic events) — capture is a gesture nicety, never a must */
      try {
        surface.setPointerCapture(e.pointerId);
      } catch {
        /* pointer already gone — the gesture still works */
      }

      if (tool === "select") {
        select(null);
        return;
      }
      if (tool === "text") {
        const obj = makeObjectAt(page, pt);
        if (obj) {
          addObject(obj);
          setEditingText(obj.id);
        }
        return;
      }
      if (STROKE_TOOLS.has(tool)) {
        const role: StrokeObject["role"] =
          tool === "pen" ? "ink" : tool === "whiteout" ? "whiteout" : "highlight";
        /* the anchor stays FIXED for the whole stroke — points are
           relative to it, and the bbox is normalized once, on commit */
        const stroke: StrokeObject = {
          id: newId("pen"), pageId: page.id, type: "pen", role,
          x: pt.x, y: pt.y, w: 1, h: 1,
          points: [{ x: 0, y: 0 }],
          strokeColor:
            role === "whiteout" ? settings.whiteoutColor
            : role === "highlight" ? settings.highlightColor
            : settings.penColor,
          strokeWidth:
            role === "whiteout" ? settings.whiteoutWidth
            : role === "highlight" ? settings.highlightWidth
            : settings.penWidth,
          opacity:
            role === "highlight" ? 0.4
            : role === "ink" ? settings.shapeOpacity
            : 1,
        };
        gestureRef.current = { kind: "pen", page, anchor: pt, points: [{ x: 0, y: 0 }], obj: stroke };
        setDraft(stroke);
        return;
      }
      if (SHAPE_TOOLS.has(tool)) {
        gestureRef.current = { kind: "create", page, anchor: pt };
        return;
      }
    },

    move: (e: React.PointerEvent, page: PageEntry, surface: HTMLElement) => {
      const g = gestureRef.current;
      if (g.kind === "none") return;
      const pt = pointFrom(e, page, surface);

      if (g.kind === "create") {
        if (g.page.id !== page.id) return;
        const x = Math.min(g.anchor.x, pt.x);
        const y = Math.min(g.anchor.y, pt.y);
        const w = Math.abs(pt.x - g.anchor.x);
        const h = Math.abs(pt.y - g.anchor.y);
        if (tool === "line") {
          if (!draft) {
            setDraft({
              id: "draft", pageId: page.id, type: "line",
              x, y, w, h,
              x1: g.anchor.x, y1: g.anchor.y, x2: pt.x, y2: pt.y,
              strokeColor: settings.penColor, strokeWidth: Math.max(settings.penWidth, 1.5),
            } as LineObject);
          } else {
            setDraft({ ...draft, x, y, w, h, x2: pt.x, y2: pt.y } as LineObject);
          }
          return;
        }
        const obj = makeObjectAt(page, { x, y }, { w, h });
        if (obj) setDraft(obj);
        return;
      }

      if (g.kind === "pen") {
        if (g.page.id !== page.id) return;
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
        /* Ctrl / Cmd / Alt on images & signatures → keep proportions.
           Shift on boxes/ellipses → perfect square. Free otherwise. */
        const modifier = e.ctrlKey || e.metaKey || e.altKey || e.shiftKey;
        const ratio = g.aspect;
        if (modifier && ratio && ratio > 0 && (w !== o.w || h !== o.h)) {
          if (Math.abs(w - o.w) >= Math.abs(h - o.h)) h = w / ratio;
          else w = h * ratio;
          x = g.handle.includes("w") ? o.x + (o.w - w) : o.x;
          y = g.handle.includes("n") ? o.y + (o.h - h) : o.y;
        }
        updateObject(g.id, { x, y, w, h });
      }
    },

    up: (e: React.PointerEvent, page: PageEntry, _surface: HTMLElement) => {
      const g = gestureRef.current;
      const pt = pointFrom(e, page, _surface);
      gestureRef.current = { kind: "none" };

      if (g.kind === "create") {
        if (g.page.id !== page.id) {
          setDraft(null);
          return;
        }
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
          const fallback = { ...draft, id: newId("obj"), w: 160, h: 80 };
          addObject(fallback);
        }
        setDraft(null);
        return;
      }

      if (g.kind === "pen") {
        if (g.page.id !== page.id) {
          setDraft(null);
          return;
        }
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
    },

    objectDown: (e: React.PointerEvent, page: PageEntry, surface: HTMLElement, id: string) => {
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
      const pt = pointFrom(e, page, surface);
      try {
        surface.setPointerCapture(e.pointerId);
      } catch {
        /* pointer already gone */
      }
      gestureRef.current = {
        kind: "move",
        id,
        page,
        start: pt,
        origin: { x: obj.x, y: obj.y },
      };
    },

    handleDown: (
      e: React.PointerEvent,
      page: PageEntry,
      surface: HTMLElement,
      id: string,
      handle: HandleId | "p1" | "p2",
    ) => {
      const obj = objects.find((o) => o.id === id);
      if (!obj) return;
      select(id);
      pushHistory();
      const pt = pointFrom(e, page, surface);
      try {
        surface.setPointerCapture(e.pointerId);
      } catch {
        /* pointer already gone */
      }
      const aspect =
        (obj.type === "image" || obj.type === "signature")
          ? obj.aspect
          : obj.type === "rect" || obj.type === "ellipse"
            ? obj.w / Math.max(obj.h, 1)
            : undefined;
      gestureRef.current = {
        kind: "resize",
        id,
        page,
        handle,
        start: pt,
        origin: { x: obj.x, y: obj.y, w: obj.w, h: obj.h },
        aspect,
        line:
          obj.type === "line"
            ? { x1: obj.x1, y1: obj.y1, x2: obj.x2, y2: obj.y2 }
            : undefined,
      };
    },

    dblclick: (e: React.MouseEvent, page: PageEntry, surface: HTMLElement) => {
      void retypeAt(page, surface, e);
    },

    doubleClickText: (id: string) => {
      const obj = objects.find((o) => o.id === id);
      if (obj?.type === "text") {
        pushHistory();
        setEditingText(id);
      }
    },

    editText: (id: string, text: string) => {
      const obj = objects.find((o) => o.id === id);
      if (!obj || obj.type !== "text") return;
      const lines = text.split("\n").length || 1;
      updateObject(id, { text, h: Math.max(obj.fontSize * 1.3, lines * obj.fontSize * 1.3) });
    },

    commitText: (id: string) => {
      const obj = objects.find((o) => o.id === id);
      if (!obj || obj.type !== "text") return;
      const lines = obj.text.split("\n").length || 1;
      updateObject(id, { h: Math.max(obj.fontSize * 1.3, lines * obj.fontSize * 1.3) });
      setEditingText(null);
    },
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
      if (e.key === "PageUp" || e.key === "PageDown") {
        e.preventDefault();
        navBus.goToPage(
          s.pageIndex + (e.key === "PageUp" ? -1 : 1),
        );
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
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ---------------- render ---------------- */

  if (!doc || pages.length === 0) return null;

  const objectsByPage = new Map<string, EditorObject[]>();
  for (const obj of objects) {
    const list = objectsByPage.get(obj.pageId) ?? [];
    list.push(obj);
    objectsByPage.set(obj.pageId, list);
  }

  const drawTouch = STROKE_TOOLS.has(tool) || SHAPE_TOOLS.has(tool) ? "none" : "auto";
  const cursor =
    tool === "select" ? "default" : tool === "text" ? "text" : "crosshair";

  return (
    <div
      ref={scrollRef}
      className="relative flex-1 overflow-auto bg-mist dark:bg-[#0B1220]"
      aria-label="PDF page editing surface"
    >
      <div
        className="mx-auto flex w-fit flex-col items-center"
        style={{ width: maxPageWidth * zoom + 24, padding: "12px 12px 48px" }}
      >
        {pages.map((page, i) =>
          i >= visible[0] && i <= visible[1] ? (
            <PageSlot
              key={page.id}
              page={page}
              index={i}
              zoom={zoom}
              dpr={dpr}
              drawTouch={drawTouch}
              cursor={cursor}
              objects={objectsByPage.get(page.id) ?? []}
              draft={draft && draft.pageId === page.id ? draft : null}
              selectedId={selectedId}
              editingTextId={editingTextId}
              api={slotApi}
            />
          ) : (
            <PagePlaceholder key={page.id} page={page} index={i} zoom={zoom} />
          ),
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* one rendered page (canvas + overlay)                                */
/* ------------------------------------------------------------------ */

function PageSlot({
  page,
  index,
  zoom,
  dpr,
  drawTouch,
  cursor,
  objects,
  draft,
  selectedId,
  editingTextId,
  api,
}: {
  page: PageEntry;
  index: number;
  zoom: number;
  dpr: number;
  drawTouch: string;
  cursor: string;
  objects: EditorObject[];
  draft: EditorObject | null;
  selectedId: string | null;
  editingTextId: string | null;
  api: {
    down: (_e: React.PointerEvent, _page: PageEntry, _surface: HTMLElement) => void;
    move: (_e: React.PointerEvent, _page: PageEntry, _surface: HTMLElement) => void;
    up: (_e: React.PointerEvent, _page: PageEntry, _surface: HTMLElement) => void;
    objectDown: (_e: React.PointerEvent, _page: PageEntry, _surface: HTMLElement, _id: string) => void;
    handleDown: (
      _e: React.PointerEvent,
      _page: PageEntry,
      _surface: HTMLElement,
      _id: string,
      _handle: HandleId | "p1" | "p2",
    ) => void;
    dblclick: (_e: React.MouseEvent, _page: PageEntry, _surface: HTMLElement) => void;
    doubleClickText: (_id: string) => void;
    editText: (_id: string, _text: string) => void;
    commitText: (_id: string) => void;
  };
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [rendering, setRendering] = useState(true);

  useEffect(() => {
    if (!canvasRef.current) return;
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
  }, [page.id, page.srcIndex, page.rotation, zoom, dpr]);

  return (
    <div style={{ marginBottom: SLOT_GAP }}>
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
          aria-label={`Page ${index + 1} of the document`}
        />
        {/* the interactive overlay. Preventing the compatibility
            mousedown's default keeps the auto-focused text editor from
            losing focus the instant it appears (while still allowing
            real clicks, double-clicks and caret placement). */}
        <div
          ref={surfaceRef}
          role="application"
          aria-label={`Annotation layer — page ${index + 1}`}
          onMouseDown={(e) => {
            const t = e.target as HTMLElement;
            if (t.tagName !== "TEXTAREA" && t.tagName !== "INPUT") {
              e.preventDefault();
            }
          }}
          onPointerDown={(e) => api.down(e, page, e.currentTarget)}
          onPointerMove={(e) => api.move(e, page, e.currentTarget)}
          onPointerUp={(e) => api.up(e, page, e.currentTarget)}
          onPointerCancel={(e) => api.up(e, page, e.currentTarget)}
          onDoubleClick={(e) => api.dblclick(e, page, e.currentTarget)}
          className="absolute left-0 top-0"
          style={{
            width: page.width * zoom,
            height: page.height * zoom,
            touchAction: drawTouch,
            cursor,
          }}
        >
          {objects.map((obj) => (
            <ObjectView
              key={obj.id}
              obj={obj}
              scale={zoom}
              selected={obj.id === selectedId}
              editing={obj.id === editingTextId}
              onPointerDownObject={(e, id) =>
                api.objectDown(e, page, surfaceRef.current as HTMLElement, id)
              }
              onDoubleClickText={(id) => api.doubleClickText(id)}
              onPointerDownHandle={(e, id, handle) =>
                api.handleDown(e, page, surfaceRef.current as HTMLElement, id, handle)
              }
              onEditText={(id, text) => api.editText(id, text)}
              onCommitTextSize={(id) => api.commitText(id)}
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
  );
}

/* ------------------------------------------------------------------ */
/* height-accurate placeholder for virtualized (off-screen) pages      */
/* ------------------------------------------------------------------ */

function PagePlaceholder({
  page,
  index,
  zoom,
}: {
  page: PageEntry;
  index: number;
  zoom: number;
}) {
  return (
    <div
      style={{
        marginBottom: SLOT_GAP,
        width: page.width * zoom,
        height: page.height * zoom,
      }}
      className="flex items-center justify-center rounded-[3px] border border-dashed border-border/70 bg-card/40"
      aria-hidden="true"
    >
      <span className="text-[11px] font-semibold text-muted-foreground/70">
        Page {index + 1}
      </span>
    </div>
  );
}
