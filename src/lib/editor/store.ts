"use client";

/**
 * PDFDock — the editor store (zustand).
 *
 * Holds the open document, its pages, every annotation object, the
 * active tool + tool settings, the selection, undo/redo history and
 * the form-field state. Coordinates are display-space points (see
 * types.ts) so the workspace overlay needs no math beyond zoom.
 */

import { create } from "zustand";
import type {
  EditorObject,
  FormFieldInfo,
  FormValues,
  PageEntry,
  ToolId,
  ToolSettings,
} from "./types";
import { closeRenderDoc, openDocument, renderThumb } from "./engine";
import { rotatePointCw90, displayDims } from "./geometry";
import { FONTS, FONT_FAMILIES, type FontKey } from "./fonts";

/* ------------------------------------------------------------------ */
/* state shapes                                                        */
/* ------------------------------------------------------------------ */

export interface DocState {
  fileName: string;
  fileSize: number;
  /** pristine original bytes — pdf-lib exports start from these */
  bytes: Uint8Array;
}

interface HistoryEntry {
  objects: EditorObject[];
  pages: PageEntry[];
}

export interface EditorStore {
  /* document */
  doc: DocState | null;
  status: "empty" | "loading" | "ready" | "error";
  loadError: string;
  pages: PageEntry[];
  objects: EditorObject[];

  /* view */
  pageIndex: number; // current page (into pages array)
  zoom: number; // 1 = 100%; the workspace clamps 0.5–4
  requestedZoom: number | "fit"; // what the visitor asked for

  /* tools */
  tool: ToolId;
  settings: ToolSettings;
  selectedId: string | null;
  editingTextId: string | null;

  /* forms */
  formFields: FormFieldInfo[] | null;
  formValues: FormValues;

  /* history */
  past: HistoryEntry[];
  future: HistoryEntry[];

  /* ---- actions ---- */
  openBytes: (_bytes: Uint8Array, _fileName: string, _fileSize: number) => Promise<void>;
  reset: () => void;

  setTool: (_tool: ToolId) => void;
  setZoom: (_zoom: number | "fit") => void;
  setPageIndex: (_index: number) => void;
  /** scroll-driven page sync: updates the indicator WITHOUT deselecting */
  setVisiblePage: (_index: number) => void;

  addObject: (_obj: EditorObject, _select?: boolean) => void;
  /** atomic multi-add — ONE undo entry for the whole group (retype assist) */
  addObjects: (_objs: EditorObject[], _selectId: string | null) => void;
  updateObject: (_id: string, _patch: Partial<EditorObject>) => void;
  replaceObject: (_obj: EditorObject) => void;
  deleteObject: (_id: string) => void;
  duplicateObject: (_id: string) => void;
  bringForward: (_id: string) => void;
  sendBackward: (_id: string) => void;
  select: (_id: string | null) => void;
  setEditingText: (_id: string | null) => void;

  patchSettings: (_patch: Partial<ToolSettings>) => void;

  rotatePage: (_pageId: string) => void;
  deletePage: (_pageId: string) => void;
  insertBlankPage: (_afterPageIndex: number) => void;
  setThumb: (_pageId: string, _thumb: string) => void;

  setFormFields: (_fields: FormFieldInfo[] | null) => void;
  setFormValue: (_name: string, _value: string) => void;

  undo: () => void;
  redo: () => void;
  pushHistory: () => void;
}

const DEFAULT_SETTINGS: ToolSettings = {
  fontKey: "helv",
  fontSize: 14,
  textColor: "#202938",
  shapeFillColor: "#20B99A",
  shapeStrokeColor: "#173B70",
  shapeStrokeWidth: 2,
  shapeOpacity: 1,
  penColor: "#3979E8",
  penWidth: 3,
  highlightColor: "#FFE066",
  whiteoutColor: "#FFFFFF",
  highlightWidth: 16,
  whiteoutWidth: 18,
};

/** new ids for objects */
let idCounter = 0;
export function newId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

/* ------------------------------------------------------------------ */
/* the store                                                           */
/* ------------------------------------------------------------------ */

export const useEditor = create<EditorStore>((set, get) => ({
  doc: null,
  status: "empty",
  loadError: "",
  pages: [],
  objects: [],

  pageIndex: 0,
  zoom: 1,
  requestedZoom: "fit",

  tool: "select",
  settings: DEFAULT_SETTINGS,
  selectedId: null,
  editingTextId: null,

  formFields: null,
  formValues: {},

  past: [],
  future: [],

  /* ---------------- open / close ---------------- */

  openBytes: async (bytes, fileName, fileSize) => {
    set({ status: "loading", loadError: "" });
    try {
      const opened = await openDocument(bytes);
      set({
        doc: { fileName, fileSize, bytes },
        pages: opened.pages,
        objects: [],
        status: "ready",
        pageIndex: 0,
        tool: "select",
        selectedId: null,
        editingTextId: null,
        formFields: null,
        formValues: {},
        past: [],
        future: [],
        zoom: 1,
        requestedZoom: "fit",
      });
    } catch (err) {
      set({
        status: "error",
        loadError: err instanceof Error ? err.message : String(err),
      });
    }
  },

  reset: () => {
    closeRenderDoc();
    set({
      doc: null,
      status: "empty",
      loadError: "",
      pages: [],
      objects: [],
      pageIndex: 0,
      selectedId: null,
      editingTextId: null,
      formFields: null,
      formValues: {},
      past: [],
      future: [],
      tool: "select",
    });
  },

  /* ---------------- tools & view ---------------- */

  setTool: (tool) => set({ tool, selectedId: null, editingTextId: null }),
  setZoom: (zoom) => set({ requestedZoom: zoom }),
  setPageIndex: (index) =>
    set((s) => ({
      pageIndex: Math.max(0, Math.min(index, s.pages.length - 1)),
      selectedId: null,
      editingTextId: null,
    })),
  setVisiblePage: (index) =>
    set((s) => ({
      pageIndex: Math.max(0, Math.min(index, s.pages.length - 1)),
    })),

  /* ---------------- objects ---------------- */

  addObject: (obj, select = true) => {
    get().pushHistory();
    set((s) => ({
      objects: [...s.objects, obj],
      selectedId: select ? obj.id : s.selectedId,
    }));
  },

  addObjects: (objs, selectId) => {
    if (objs.length === 0) return;
    get().pushHistory();
    set((s) => ({
      objects: [...s.objects, ...objs],
      selectedId: selectId ?? s.selectedId,
    }));
  },

  updateObject: (id, patch) =>
    set((s) => ({
      objects: s.objects.map((o) =>
        o.id === id ? ({ ...o, ...patch } as EditorObject) : o,
      ),
    })),

  replaceObject: (obj) =>
    set((s) => ({
      objects: s.objects.map((o) => (o.id === obj.id ? obj : o)),
    })),

  deleteObject: (id) => {
    get().pushHistory();
    set((s) => ({
      objects: s.objects.filter((o) => o.id !== id),
      selectedId: null,
      editingTextId: null,
    }));
  },

  duplicateObject: (id) => {
    const obj = get().objects.find((o) => o.id === id);
    if (!obj) return;
    get().pushHistory();
    /* spread of a union needs the explicit assertion to stay EditorObject */
    const copy = {
      ...obj,
      id: newId("dup"),
      x: obj.x + 16,
      y: obj.y + 16,
    } as EditorObject;
    set((s) => ({ objects: [...s.objects, copy], selectedId: copy.id }));
  },

  bringForward: (id) => {
    const s = get();
    const i = s.objects.findIndex((o) => o.id === id);
    if (i < 0 || i === s.objects.length - 1) return;
    s.pushHistory();
    const next = [...s.objects];
    [next[i], next[i + 1]] = [next[i + 1], next[i]];
    set({ objects: next });
  },

  sendBackward: (id) => {
    const s = get();
    const i = s.objects.findIndex((o) => o.id === id);
    if (i <= 0) return;
    s.pushHistory();
    const next = [...s.objects];
    [next[i], next[i - 1]] = [next[i - 1], next[i]];
    set({ objects: next });
  },

  select: (id) => set({ selectedId: id, editingTextId: null }),
  setEditingText: (id) => set({ editingTextId: id }),

  patchSettings: (patch) => {
    const s = get();
    set({ settings: { ...s.settings, ...patch } });
    /* live-apply to the selected object of the matching type */
    const sel = s.objects.find((o) => o.id === s.selectedId);
    if (!sel) return;
    if (sel.type === "text") {
      const patchObj: Partial<typeof sel> = {};
      if (patch.fontKey) {
        const picked = FONTS[patch.fontKey];
        const cur = FONTS[sel.fontKey];
        if (picked.family === cur.family) {
          /* same family — a pure style change */
          patchObj.fontKey = patch.fontKey;
        } else {
          /* family change — keep the current bold/italic intent */
          const map = FONT_FAMILIES_BY_FAMILY[picked.family].keys;
          patchObj.fontKey = cur.italic
            ? cur.bold
              ? map.boldItalic
              : map.italic
            : cur.bold
              ? map.bold
              : map.regular;
        }
      }
      if (patch.fontSize) patchObj.fontSize = patch.fontSize;
      if (patch.textColor) patchObj.color = patch.textColor;
      if (Object.keys(patchObj).length > 0)
        set({
          objects: s.objects.map((o) =>
            o.id === sel.id
              ? ({ ...o, ...patchObj } as EditorObject)
              : o,
          ),
        });
    } else if (
      sel.type === "whiteout" ||
      sel.type === "rect" ||
      sel.type === "highlight" ||
      sel.type === "ellipse"
    ) {
      const patchObj: Record<string, unknown> = {};
      if (sel.type === "highlight" && patch.highlightColor !== undefined)
        patchObj.fillColor = patch.highlightColor;
      if (sel.type !== "highlight" && patch.shapeFillColor !== undefined)
        patchObj.fillColor = patch.shapeFillColor;
      if (sel.type === "whiteout" && patch.whiteoutColor !== undefined)
        patchObj.fillColor = patch.whiteoutColor;
      if (patch.shapeStrokeColor !== undefined)
        patchObj.strokeColor = patch.shapeStrokeColor;
      if (patch.shapeStrokeWidth !== undefined)
        patchObj.strokeWidth = patch.shapeStrokeWidth;
      if (patch.shapeOpacity !== undefined) patchObj.opacity = patch.shapeOpacity;
      if (Object.keys(patchObj).length > 0)
        set({
          objects: s.objects.map((o) =>
            o.id === sel.id ? ({ ...o, ...patchObj } as EditorObject) : o,
          ),
        });
    } else if (sel.type === "pen") {
      const patchObj: Record<string, unknown> = {};
      if (sel.role === "whiteout") {
        if (patch.whiteoutColor !== undefined) patchObj.strokeColor = patch.whiteoutColor;
        if (patch.whiteoutWidth !== undefined) patchObj.strokeWidth = patch.whiteoutWidth;
      } else if (sel.role === "highlight") {
        if (patch.highlightColor !== undefined) patchObj.strokeColor = patch.highlightColor;
        if (patch.highlightWidth !== undefined) patchObj.strokeWidth = patch.highlightWidth;
        if (patch.shapeOpacity !== undefined) patchObj.opacity = patch.shapeOpacity;
      } else {
        if (patch.penColor !== undefined) patchObj.strokeColor = patch.penColor;
        if (patch.penWidth !== undefined) patchObj.strokeWidth = patch.penWidth;
        if (patch.shapeOpacity !== undefined) patchObj.opacity = patch.shapeOpacity;
      }
      if (Object.keys(patchObj).length > 0)
        set({
          objects: s.objects.map((o) =>
            o.id === sel.id ? ({ ...o, ...patchObj } as EditorObject) : o,
          ),
        });
    } else if (sel.type === "line") {
      const patchObj: Record<string, unknown> = {};
      if (patch.penColor !== undefined) patchObj.strokeColor = patch.penColor;
      if (patch.penWidth !== undefined) patchObj.strokeWidth = patch.penWidth;
      if (Object.keys(patchObj).length > 0)
        set({
          objects: s.objects.map((o) =>
            o.id === sel.id ? ({ ...o, ...patchObj } as EditorObject) : o,
          ),
        });
    }
  },

  /* ---------------- pages ---------------- */

  rotatePage: (pageId) => {
    const s = get();
    const idx = s.pages.findIndex((p) => p.id === pageId);
    if (idx < 0) return;
    s.pushHistory();
    const page = s.pages[idx];
    const oldH = page.height;
    const newRotation = ((page.rotation + 90) % 360 + 360) % 360;

    /* content rotates with the page: transform every object on it.
       boxes: the bbox itself rotates (anchor + swapped sides). text &
       images: only the anchor moves — they stay upright and readable.
       pen: absolute points rotate, then the bbox re-normalizes. */
    const objects: EditorObject[] = s.objects.map((o): EditorObject => {
      if (o.pageId !== pageId) return o;
      if (o.type === "line") {
        const a = rotatePointCw90(oldH, o.x1, o.y1);
        const b = rotatePointCw90(oldH, o.x2, o.y2);
        return {
          ...o,
          x1: a.x, y1: a.y, x2: b.x, y2: b.y,
          x: Math.min(a.x, b.x), y: Math.min(a.y, b.y),
          w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y),
        };
      }
      if (o.type === "pen") {
        const abs = o.points.map((p) => ({ x: o.x + p.x, y: o.y + p.y }));
        const rot = abs.map((p) => rotatePointCw90(oldH, p.x, p.y));
        const xs = rot.map((p) => p.x);
        const ys = rot.map((p) => p.y);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        return {
          ...o,
          points: rot.map((p) => ({ x: p.x - minX, y: p.y - minY })),
          x: minX, y: minY,
          w: Math.max(...xs) - minX,
          h: Math.max(...ys) - minY,
        };
      }
      if (
        o.type === "whiteout" || o.type === "rect" ||
        o.type === "highlight" || o.type === "ellipse"
      ) {
        const corner = rotatePointCw90(oldH, o.x, o.y + o.h);
        return { ...o, x: corner.x, y: corner.y, w: o.h, h: o.w };
      }
      /* text / image / signature: anchor-only, stays upright */
      const corner = rotatePointCw90(oldH, o.x, o.y);
      return { ...o, x: corner.x, y: corner.y };
    });

    const pages = [...s.pages];
    pages[idx] = {
      ...page,
      rotation: newRotation,
      width: newRotation % 180 === 0 ? page.width : page.height,
      height: newRotation % 180 === 0 ? page.height : page.width,
      thumb: undefined,
    };
    set({ pages, objects });
  },

  deletePage: (pageId) => {
    const s = get();
    if (s.pages.length <= 1) return; // never delete the last page
    s.pushHistory();
    const pages = s.pages.filter((p) => p.id !== pageId);
    const objects = s.objects.filter((o) => o.pageId !== pageId);
    const idx = Math.min(s.pageIndex, pages.length - 1);
    set({ pages, objects, pageIndex: idx, selectedId: null, editingTextId: null });
  },

  insertBlankPage: (afterPageIndex) => {
    const s = get();
    if (s.pages.length === 0) return;
    const neighbor = s.pages[Math.min(afterPageIndex, s.pages.length - 1)];
    /* blank pages inherit the neighbor's display size, rotation 0 */
    const { width, height } = displayDims(
      neighbor.width, neighbor.height, 0,
    );
    s.pushHistory();
    const page: PageEntry = {
      id: newId("blank"),
      srcIndex: null,
      rotation: 0,
      width, height,
    };
    const pages = [...s.pages];
    pages.splice(afterPageIndex + 1, 0, page);
    set({ pages, pageIndex: afterPageIndex + 1, selectedId: null });
  },

  setThumb: (pageId, thumb) =>
    set((s) => ({
      pages: s.pages.map((p) => (p.id === pageId ? { ...p, thumb } : p)),
    })),

  /* ---------------- forms ---------------- */

  setFormFields: (fields) => set({ formFields: fields }),
  setFormValue: (name, value) =>
    set((s) => ({ formValues: { ...s.formValues, [name]: value } })),

  /* ---------------- history ---------------- */

  pushHistory: () =>
    set((s) => ({
      past: [...s.past.slice(-59), { objects: s.objects, pages: s.pages }],
      future: [],
    })),

  undo: () =>
    set((s) => {
      const prev = s.past[s.past.length - 1];
      if (!prev) return s;
      return {
        past: s.past.slice(0, -1),
        future: [{ objects: s.objects, pages: s.pages }, ...s.future.slice(0, 59)],
        objects: prev.objects,
        pages: prev.pages,
        selectedId: null,
        editingTextId: null,
        pageIndex: Math.min(s.pageIndex, prev.pages.length - 1),
      };
    }),

  redo: () =>
    set((s) => {
      const next = s.future[0];
      if (!next) return s;
      return {
        future: s.future.slice(1),
        past: [...s.past.slice(-59), { objects: s.objects, pages: s.pages }],
        objects: next.objects,
        pages: next.pages,
        selectedId: null,
        editingTextId: null,
        pageIndex: Math.min(s.pageIndex, next.pages.length - 1),
      };
    }),
}));

/* helpers used by patchSettings above ------------------------------ */

/* derived from the picker model so extra families resolve too */
const FONT_FAMILIES_BY_FAMILY: Record<
  string,
  { keys: { regular: FontKey; bold: FontKey; italic: FontKey; boldItalic: FontKey } }
> = Object.fromEntries(
  FONT_FAMILIES.map((f) => [f.family, { keys: f.keys }]),
);

/* convenience: re-render a page's thumbnail after page-level edits */
export async function refreshThumb(pageId: string): Promise<void> {
  const s = useEditor.getState();
  const page = s.pages.find((p) => p.id === pageId);
  if (!page || page.srcIndex === null) return;
  try {
    const thumb = await renderThumb(page.srcIndex, page.rotation);
    useEditor.getState().setThumb(pageId, thumb);
  } catch {
    /* thumbnails are best-effort */
  }
}
