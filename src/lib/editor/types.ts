/**
 * PDFDock — the annotation model.
 *
 * Every object stores its geometry in DISPLAY space: points (1/72 inch),
 * origin at the TOP-LEFT of the page as it is currently displayed
 * (rotation applied). This makes the on-screen overlay trivial
 * (pixel = point x zoom) and lets page-rotation transforms stay local.
 * The export engine converts display points into PDF user space via
 * geometry.ts, compensating for page rotation.
 */

import type { FontKey } from "./fonts";

export type ToolId =
  | "select"
  | "text"
  | "signature"
  | "whiteout"
  | "rect"
  | "ellipse"
  | "line"
  | "pen"
  | "highlight"
  | "image";

interface BaseObject {
  id: string;
  pageId: string;
  /** display-space bbox — top-left corner, points */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TextObject extends BaseObject {
  type: "text";
  text: string;
  fontKey: FontKey;
  fontSize: number;
  color: string;
}

/** filled boxes: white-out, outline/filled rect, highlighter */
export interface BoxObject extends BaseObject {
  type: "whiteout" | "rect" | "highlight";
  fillColor: string;
  /** null → no border */
  strokeColor: string | null;
  strokeWidth: number;
  opacity: number;
}

export interface EllipseObject extends BaseObject {
  type: "ellipse";
  fillColor: string;
  strokeColor: string | null;
  strokeWidth: number;
  opacity: number;
}

/** single straight line — endpoints in display points */
export interface LineObject extends BaseObject {
  type: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  strokeColor: string;
  strokeWidth: number;
}

/** freehand stroke — points RELATIVE to the bbox top-left.
 *  `role` distinguishes the pen (ink) from the white-out brush and
 *  the highlighter brush; they share one model so move/resize/rotate,
 *  undo and export behave identically. */
export interface StrokeObject extends BaseObject {
  type: "pen";
  role: "ink" | "whiteout" | "highlight";
  points: { x: number; y: number }[];
  strokeColor: string;
  strokeWidth: number;
  opacity: number;
}

/** images and drawn signatures — dataURL, rendered as an overlay */
export interface ImageObject extends BaseObject {
  type: "image" | "signature";
  src: string;
  /** width / height of the source pixels, kept on resize */
  aspect: number;
}

export type EditorObject =
  | TextObject
  | BoxObject
  | EllipseObject
  | LineObject
  | StrokeObject
  | ImageObject;

/* ------------------------------------------------------------------ */
/* pages                                                               */
/* ------------------------------------------------------------------ */

export interface PageEntry {
  id: string;
  /** 0-based index into the ORIGINAL pdf.js document (null = blank) */
  srcIndex: number | null;
  /** cumulative /Rotate (original + user rotations), multiples of 90 */
  rotation: number;
  /** display dims in points at the current rotation */
  width: number;
  height: number;
  /** lazily rendered thumbnail (dataURL) */
  thumb?: string;
}

/* ------------------------------------------------------------------ */
/* form fields (AcroForm)                                              */
/* ------------------------------------------------------------------ */

export type FormFieldKind = "text" | "checkbox" | "dropdown" | "radio";

export interface FormFieldInfo {
  /** fully-qualified PDF field name — the key used when writing values */
  name: string;
  /** human label (last path segment) */
  label: string;
  kind: FormFieldKind;
  value: string;
  options?: string[];
}

export type FormValues = Record<string, string>;

/* ------------------------------------------------------------------ */
/* per-tool default settings (live in the store, edited in Properties)  */
/* ------------------------------------------------------------------ */

export interface ToolSettings {
  fontKey: FontKey;
  fontSize: number;
  textColor: string;
  shapeFillColor: string;
  shapeStrokeColor: string;
  shapeStrokeWidth: number;
  shapeOpacity: number;
  penColor: string;
  penWidth: number;
  highlightColor: string;
  whiteoutColor: string;
  /** brush widths (pt) for the highlighter / white-out brushes */
  highlightWidth: number;
  whiteoutWidth: number;
}

export type StrokeRole = "ink" | "whiteout" | "highlight";
