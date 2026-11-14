"use client";

/**
 * PDFDock — overlay rendering of one annotation object, in display
 * space times the current zoom scale. Interactions (select, move,
 * resize, edit) are wired by the parent through the pointer handlers.
 */

import { fontCss } from "@/lib/editor/fonts";
import type { EditorObject } from "@/lib/editor/types";

export type HandleId = "nw" | "ne" | "sw" | "se" | "w" | "e";

export interface ObjectViewProps {
  obj: EditorObject;
  scale: number;
  selected: boolean;
  editing: boolean;
  onPointerDownObject: (_e: React.PointerEvent, _id: string) => void;
  onDoubleClickText: (_id: string) => void;
  onPointerDownHandle: (
    _e: React.PointerEvent,
    _id: string,
    _handle: HandleId | "p1" | "p2",
  ) => void;
  onEditText: (_id: string, _text: string) => void;
  onCommitTextSize: (_id: string) => void;
}

export function ObjectView({
  obj,
  scale,
  selected,
  editing,
  onPointerDownObject,
  onDoubleClickText,
  onPointerDownHandle,
  onEditText,
  onCommitTextSize,
}: ObjectViewProps) {
  const left = obj.x * scale;
  const top = obj.y * scale;
  const width = Math.max(1, obj.w * scale);
  const height = Math.max(1, obj.h * scale);

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  const handle = (id: HandleId | "p1" | "p2", style: React.CSSProperties) => (
    <span
      role="button"
      tabIndex={-1}
      key={id}
      className="sel-handle"
      style={style}
      onPointerDown={(e) => {
        e.stopPropagation();
        onPointerDownHandle(e, obj.id, id);
      }}
    />
  );

  let body: React.ReactNode = null;

  switch (obj.type) {
    case "text": {
      const css = fontCss(obj.fontKey);
      const fontSizePx = obj.fontSize * scale;
      if (editing) {
        body = (
          <textarea
            autoFocus
            value={obj.text}
            onChange={(e) => onEditText(obj.id, e.target.value)}
            onBlur={() => onCommitTextSize(obj.id)}
            onKeyDown={(e) => {
              if (e.key === "Escape") (e.target as HTMLTextAreaElement).blur();
              e.stopPropagation();
            }}
            onPointerDown={stop}
            spellCheck={false}
            aria-label="Edit text"
            className="thin-scroll absolute inset-0 resize-none overflow-hidden border border-dashed border-primary bg-white/40 p-0 outline-none dark:bg-black/20"
            style={{
              ...css,
              fontSize: `${fontSizePx}px`,
              lineHeight: 1.3,
              color: obj.color,
              width: "100%",
              height: "100%",
              caretColor: obj.color === "#FFFFFF" ? "#202938" : obj.color,
            }}
          />
        );
      } else {
        body = (
          <div
            className="pointer-events-none h-full w-full select-none break-words whitespace-pre-wrap"
            style={{
              ...css,
              fontSize: `${fontSizePx}px`,
              lineHeight: 1.3,
              color: obj.color,
            }}
          >
            {obj.text}
          </div>
        );
      }
      break;
    }

    case "whiteout":
    case "highlight": {
      body = (
        <div
          className="pointer-events-none h-full w-full"
          style={{
            backgroundColor: obj.fillColor,
            opacity: obj.opacity,
          }}
        />
      );
      break;
    }

    case "rect": {
      body = (
        <div
          className="pointer-events-none h-full w-full"
          style={{
            backgroundColor: obj.fillColor === "none" ? "transparent" : obj.fillColor,
            opacity: obj.opacity,
            border: obj.strokeColor
              ? `${Math.max(obj.strokeWidth * scale, 1)}px solid ${obj.strokeColor}`
              : "none",
          }}
        />
      );
      break;
    }

    case "ellipse": {
      body = (
        <div
          className="pointer-events-none h-full w-full"
          style={{
            borderRadius: "50%",
            backgroundColor: obj.fillColor === "none" ? "transparent" : obj.fillColor,
            opacity: obj.opacity,
            border: obj.strokeColor
              ? `${Math.max(obj.strokeWidth * scale, 1)}px solid ${obj.strokeColor}`
              : "none",
          }}
        />
      );
      break;
    }

    case "line": {
      body = (
        <svg
          className="pointer-events-none absolute inset-0"
          width={width}
          height={height}
          aria-hidden="true"
        >
          <line
            x1={(obj.x1 - obj.x) * scale}
            y1={(obj.y1 - obj.y) * scale}
            x2={(obj.x2 - obj.x) * scale}
            y2={(obj.y2 - obj.y) * scale}
            stroke={obj.strokeColor}
            strokeWidth={Math.max(obj.strokeWidth * scale, 1)}
            strokeLinecap="round"
          />
        </svg>
      );
      break;
    }

    case "pen": {
      const d = obj.points
        .map((p, i) => `${i === 0 ? "M" : "L"}${p.x * scale} ${p.y * scale}`)
        .join(" ");
      body = (
        <svg
          className="pointer-events-none absolute inset-0"
          width={width}
          height={height}
          aria-hidden="true"
        >
          <path
            d={d}
            fill="none"
            stroke={obj.strokeColor}
            strokeWidth={Math.max(obj.strokeWidth * scale, 1)}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={obj.opacity}
          />
        </svg>
      );
      break;
    }

    case "image":
    case "signature": {
      body = (
        <img
          src={obj.src}
          alt={obj.type === "signature" ? "Signature" : "Placed image"}
          draggable={false}
          className="pointer-events-none h-full w-full select-none object-fill"
        />
      );
      break;
    }
  }

  /* selected outline + handles */
  const isSelected = selected && !editing;

  return (
    <div
      data-object-id={obj.id}
      role="button"
      tabIndex={-1}
      aria-label={`${obj.type} object`}
      onPointerDown={(e) => onPointerDownObject(e, obj.id)}
      onDoubleClick={(e) => {
        if (obj.type === "text") {
          e.stopPropagation();
          onDoubleClickText(obj.id);
        }
      }}
      className={`absolute cursor-move ${
        isSelected ? "outline-2 outline-offset-2 outline-primary/90" : ""
      } ${obj.type === "text" && !editing ? "cursor-text" : ""}`}
      style={{ left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` }}
    >
      {body}

      {isSelected ? (
        obj.type === "line" ? (
          <>
            {/* endpoint handles for lines */}
            {handle("p1", {
              left: (obj.x1 - obj.x) * scale - 6,
              top: (obj.y1 - obj.y) * scale - 6,
            })}
            {handle("p2", {
              left: (obj.x2 - obj.x) * scale - 6,
              top: (obj.y2 - obj.y) * scale - 6,
            })}
          </>
        ) : obj.type === "text" ? (
          /* text: width handle on the right edge */
          handle("e", {
            left: width - 6,
            top: height / 2 - 6,
          })
        ) : (
          /* everything else: four corner handles */
          <>
            {handle("nw", { left: -6, top: -6 })}
            {handle("ne", { left: width - 6, top: -6 })}
            {handle("sw", { left: -6, top: height - 6 })}
            {handle("se", { left: width - 6, top: height - 6 })}
          </>
        )
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* draft preview (object being created right now)                      */
/* ------------------------------------------------------------------ */

export function DraftView({
  obj,
  scale,
}: {
  obj: EditorObject;
  scale: number;
}) {
  return (
    <ObjectView
      obj={obj}
      scale={scale}
      selected={false}
      editing={false}
      onPointerDownObject={() => undefined}
      onDoubleClickText={() => undefined}
      onPointerDownHandle={() => undefined}
      onEditText={() => undefined}
      onCommitTextSize={() => undefined}
    />
  );
}

