"use client";

/**
 * PDFDock — the tool dock: the editor's tool belt. Vertical on desktop,
 * a horizontally scrollable strip on mobile. Includes the Sign dialog
 * trigger and the image picker.
 */

import { useRef } from "react";
import {
  Circle,
  Minus,
  MousePointer2,
  Pencil,
  Signature,
  Square,
  Type,
  Upload,
  Highlighter,
  Eraser,
} from "lucide-react";
import { toast } from "sonner";
import { useEditor } from "@/lib/editor/store";
import type { ToolId } from "@/lib/editor/types";

const TOOLS: { id: ToolId; label: string; icon: typeof Type; hint: string }[] = [
  { id: "select", label: "Select", icon: MousePointer2, hint: "Move, resize and edit objects" },
  { id: "text", label: "Text", icon: Type, hint: "Click the page to type" },
  { id: "signature", label: "Sign", icon: Signature, hint: "Draw or place your signature" },
  { id: "whiteout", label: "White-out", icon: Eraser, hint: "Drag to cover content" },
  { id: "highlight", label: "Highlight", icon: Highlighter, hint: "Drag over a line to mark it" },
  { id: "rect", label: "Rectangle", icon: Square, hint: "Drag to draw a box" },
  { id: "ellipse", label: "Ellipse", icon: Circle, hint: "Drag to draw an ellipse" },
  { id: "line", label: "Line", icon: Minus, hint: "Drag to draw a straight line" },
  { id: "pen", label: "Pen", icon: Pencil, hint: "Draw freehand" },
  { id: "image", label: "Image", icon: Upload, hint: "Place an image or logo" },
];

export function ToolDock({
  onSign,
  onImage,
}: {
  onSign: () => void;
  onImage: (_file: File) => void;
}) {
  const tool = useEditor((s) => s.tool);
  const setTool = useEditor((s) => s.setTool);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const pickTool = (id: ToolId) => {
    if (id === "signature") {
      onSign(); // dialog flow, tool stays 'select' after insert
      return;
    }
    if (id === "image") {
      imageInputRef.current?.click();
      return;
    }
    setTool(id);
  };

  return (
    <>
      <div
        role="toolbar"
        aria-label="Editing tools"
        aria-orientation="vertical"
        className="flex flex-row gap-1 overflow-x-auto p-1 thin-scroll sm:flex-col sm:overflow-x-visible"
      >
        {TOOLS.map((t) => {
          const active = tool === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => pickTool(t.id)}
              aria-pressed={active}
              aria-label={`${t.label} — ${t.hint}`}
              title={`${t.label} — ${t.hint}`}
              className={`flex size-10 shrink-0 items-center justify-center rounded-xl border transition-colors ${
                active
                  ? "border-primary bg-secondary text-primary"
                  : "border-transparent text-muted-foreground hover:border-border hover:bg-secondary/60 hover:text-foreground"
              }`}
            >
              <t.icon className="size-[18px]" aria-hidden="true" />
            </button>
          );
        })}
      </div>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            if (!/image\/(png|jpe?g)/.test(file.type)) {
              toast.error("Pick a PNG or JPEG image.");
            } else {
              onImage(file);
            }
          }
          e.target.value = "";
        }}
      />
    </>
  );
}
