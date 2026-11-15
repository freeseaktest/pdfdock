"use client";

/**
 * PDFDock — the properties panel. Two personalities:
 *  - a tool is active (and nothing selected) → edits the defaults for
 *    objects created next;
 *  - an object is selected → edits that object directly.
 *
 * Slider changes stay local until the handle is released, then commit
 * once (one history entry per gesture, not per pixel).
 */

import {
  ArrowDownToLine,
  ArrowUpToLine,
  Bold,
  Copy,
  Italic,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useEditor } from "@/lib/editor/store";
import { FONT_FAMILIES, FONTS, ensureFontLoaded, type FontKey } from "@/lib/editor/fonts";
import type { EditorObject, ToolId } from "@/lib/editor/types";

/* ------------------------------------------------------------------ */
/* color swatches                                                      */
/* ------------------------------------------------------------------ */

const SWATCHES = [
  "#202938", "#FFFFFF", "#3979E8", "#173B70", "#20B99A",
  "#FFE066", "#F97316", "#EF4444", "#9333EA", "#64748B",
];

function ColorField({
  label,
  value,
  onChange,
  allowNone = false,
}: {
  label: string;
  value: string | null;
  onChange: (_color: string | null) => void;
  allowNone?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </Label>
      <div className="flex flex-wrap items-center gap-1">
        {SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Colour ${c}`}
            onClick={() => onChange(c)}
            className={`size-6 rounded-lg border transition-transform hover:scale-110 ${
              (value ?? "").toLowerCase() === c.toLowerCase()
                ? "border-primary ring-2 ring-primary/40"
                : "border-border"
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
        {allowNone ? (
          <button
            type="button"
            aria-label="No fill"
            onClick={() => onChange(null)}
            className={`flex size-6 items-center justify-center rounded-lg border text-[9px] font-bold ${
              value === null || value === "none"
                ? "border-primary text-primary ring-2 ring-primary/40"
                : "border-border text-muted-foreground"
            }`}
          >
            ✕
          </button>
        ) : null}
        <label
          className="relative flex size-6 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-border text-[10px] font-bold text-muted-foreground"
          title="Custom colour"
        >
          +
          <input
            type="color"
            value={value && value !== "none" ? value : "#3979E8"}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label="Custom colour picker"
          />
        </label>
      </div>
    </div>
  );
}

function WidthField({
  label,
  value,
  onCommit,
  min = 0.5,
  max = 24,
  step = 0.5,
  unit = "pt",
}: {
  label: string;
  value: number;
  onCommit: (_v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}) {
  /* local during the drag; committed once on release. The parent
     remounts this component (key) whenever the target changes, so no
     prop-sync effect is needed. */
  const [local, setLocal] = useState(value);

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </Label>
      <div className="flex items-center gap-2">
        <Slider
          value={[local]}
          min={min}
          max={max}
          step={step}
          onValueChange={(v) => setLocal(v[0])}
          onValueCommit={(v) => onCommit(v[0])}
          aria-label={label}
          className="flex-1"
        />
        <span className="w-[46px] text-right text-[11.5px] font-bold text-foreground">
          {local}
          {unit}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* the panel                                                           */
/* ------------------------------------------------------------------ */

export function PropertiesPanel() {
  const tool = useEditor((s) => s.tool);
  const settings = useEditor((s) => s.settings);
  const patchSettings = useEditor((s) => s.patchSettings);
  const objects = useEditor((s) => s.objects);
  const selectedId = useEditor((s) => s.selectedId);
  const updateObject = useEditor((s) => s.updateObject);
  const pushHistory = useEditor((s) => s.pushHistory);
  const deleteObject = useEditor((s) => s.deleteObject);
  const duplicateObject = useEditor((s) => s.duplicateObject);
  const bringForward = useEditor((s) => s.bringForward);
  const sendBackward = useEditor((s) => s.sendBackward);

  const selected = objects.find((o) => o.id === selectedId) ?? null;
  const mode: "object" | "tool" | "none" =
    selected ? "object" : tool === "select" ? "none" : "tool";
  const contextTool: ToolId = selected ? toolForObject(selected) : tool;
  /* remounts the property controls when the editing target changes,
     so slider locals re-sync without effects */
  const targetKey = selected ? `o-${selected.id}` : `t-${tool}`;

  /** object patches go through history once */
  const patchObj = (patch: Record<string, unknown>) => {
    if (!selected) return;
    pushHistory();
    updateObject(selected.id, patch as Partial<EditorObject>);
  };

  if (mode === "none") {
    return (
      <PanelShell>
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          Pick a tool on the left, then drag on the page. Select an object
          to move, resize and restyle it here.
        </p>
        <p className="text-[11.5px] leading-relaxed text-muted-foreground">
          Shortcuts — Ctrl+Z undo · Ctrl+Shift+Z redo · Delete removes
          the selection · arrows nudge · double-click a text to edit it.
        </p>
        <p className="text-[11.5px] leading-relaxed text-muted-foreground">
          <strong>Retyping existing text:</strong> with the Select tool,
          double-click any line of the document — it gets covered and
          your editable copy drops right on top of it.
        </p>
      </PanelShell>
    );
  }

  return (
    <PanelShell>
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        {mode === "object" ? "Selected object" : "Tool defaults"}
      </p>

      {/* ---------------- text ---------------- */}
      {(contextTool === "text" || selected?.type === "text") && (
        <TextControls
          key={selected ? selected.id : "defaults"}
          value={
            selected && selected.type === "text"
              ? selected
              : {
                  fontKey: settings.fontKey,
                  fontSize: settings.fontSize,
                  color: settings.textColor,
                }
          }
          onObject={
            selected && selected.type === "text"
              ? (patch) => patchObj(patch)
              : null
          }
          onDefaults={(patch) => patchSettings(patch)}
        />
      )}

      {/* ---------------- white-out brush ---------------- */}
      {contextTool === "whiteout" && (
        <div key={targetKey} className="flex flex-col gap-3">
          <ColorField
            label="Cover colour"
            value={
              selected && selected.type === "pen"
                ? selected.strokeColor
                : settings.whiteoutColor
            }
            onChange={(c) => {
              if (selected && selected.type === "pen" && selected.role === "whiteout") {
                patchObj({ strokeColor: c ?? "#FFFFFF" });
              } else {
                patchSettings({ whiteoutColor: c ?? "#FFFFFF" });
              }
            }}
          />
          <WidthField
            label="Brush width"
            min={2}
            max={40}
            step={1}
            value={
              selected && selected.type === "pen" && selected.role === "whiteout"
                ? selected.strokeWidth
                : settings.whiteoutWidth
            }
            onCommit={(v) => {
              if (selected && selected.type === "pen" && selected.role === "whiteout") {
                patchObj({ strokeWidth: v });
              } else {
                patchSettings({ whiteoutWidth: v });
              }
            }}
          />
          <p className="text-[11.5px] leading-relaxed text-muted-foreground">
            Brush over anything to cover it. For removal that survives
            copy-paste, tick <strong>Rasterize</strong> in the save
            dialog.
          </p>
        </div>
      )}

      {/* ---------------- highlighter brush ---------------- */}
      {contextTool === "highlight" && (
        <div key={targetKey} className="flex flex-col gap-3">
          <ColorField
            label="Tint"
            value={
              selected && selected.type === "pen"
                ? selected.strokeColor
                : settings.highlightColor
            }
            onChange={(c) => {
              if (selected && selected.type === "pen" && selected.role === "highlight") {
                patchObj({ strokeColor: c ?? "#FFE066" });
              } else {
                patchSettings({ highlightColor: c ?? "#FFE066" });
              }
            }}
          />
          <WidthField
            label="Brush width"
            min={2}
            max={40}
            step={1}
            value={
              selected && selected.type === "pen" && selected.role === "highlight"
                ? selected.strokeWidth
                : settings.highlightWidth
            }
            onCommit={(v) => {
              if (selected && selected.type === "pen" && selected.role === "highlight") {
                patchObj({ strokeWidth: v });
              } else {
                patchSettings({ highlightWidth: v });
              }
            }}
          />
          <WidthField
            label="Opacity"
            min={0.1}
            max={0.8}
            step={0.05}
            unit=""
            value={
              selected && selected.type === "pen" && selected.role === "highlight"
                ? selected.opacity
                : 0.4
            }
            onCommit={(v) => {
              if (selected && selected.type === "pen" && selected.role === "highlight") {
                patchObj({ opacity: v });
              }
            }}
          />
        </div>
      )}

      {/* ---------------- rect / ellipse ---------------- */}
      {(contextTool === "rect" || contextTool === "ellipse") && (
        <div key={targetKey} className="flex flex-col gap-3">
          <ColorField
            label="Fill"
            allowNone
            value={
              selected && (selected.type === "rect" || selected.type === "ellipse")
                ? selected.fillColor === "none"
                  ? null
                  : selected.fillColor
                : settings.shapeFillColor
            }
            onChange={(c) => {
              if (selected && (selected.type === "rect" || selected.type === "ellipse")) {
                patchObj({ fillColor: c ?? "none" });
              } else {
                patchSettings({ shapeFillColor: c ?? "none" });
              }
            }}
          />
          <ColorField
            label="Stroke"
            allowNone
            value={
              selected && (selected.type === "rect" || selected.type === "ellipse")
                ? selected.strokeColor
                : settings.shapeStrokeColor
            }
            onChange={(c) => {
              if (selected && (selected.type === "rect" || selected.type === "ellipse")) {
                patchObj({ strokeColor: c });
              } else {
                patchSettings({ shapeStrokeColor: c ?? "#173B70" });
              }
            }}
          />
          <WidthField
            label="Stroke width"
            min={0.5}
            max={12}
            value={
              selected && (selected.type === "rect" || selected.type === "ellipse")
                ? selected.strokeWidth
                : settings.shapeStrokeWidth
            }
            onCommit={(v) => {
              if (selected && (selected.type === "rect" || selected.type === "ellipse")) {
                patchObj({ strokeWidth: v });
              } else {
                patchSettings({ shapeStrokeWidth: v });
              }
            }}
          />
          <WidthField
            label="Opacity"
            min={0.1}
            max={1}
            step={0.05}
            unit=""
            value={
              selected && (selected.type === "rect" || selected.type === "ellipse")
                ? selected.opacity
                : settings.shapeOpacity
            }
            onCommit={(v) => {
              if (selected && (selected.type === "rect" || selected.type === "ellipse")) {
                patchObj({ opacity: v });
              } else {
                patchSettings({ shapeOpacity: v });
              }
            }}
          />
        </div>
      )}

      {/* ---------------- line / pen ---------------- */}
      {(contextTool === "line" || contextTool === "pen") && (
        <div key={targetKey} className="flex flex-col gap-3">
          <ColorField
            label="Colour"
            value={
              selected && (selected.type === "line" || selected.type === "pen")
                ? selected.strokeColor
                : settings.penColor
            }
            onChange={(c) => {
              if (selected && selected.type === "line") {
                patchObj({ strokeColor: c ?? "#3979E8" });
              } else if (selected && selected.type === "pen") {
                patchObj({ strokeColor: c ?? "#3979E8" });
              } else {
                patchSettings({ penColor: c ?? "#3979E8" });
              }
            }}
          />
          <WidthField
            label="Thickness"
            min={0.5}
            max={16}
            value={
              selected && (selected.type === "line" || selected.type === "pen")
                ? selected.strokeWidth
                : settings.penWidth
            }
            onCommit={(v) => {
              if (selected && selected.type === "line") {
                patchObj({ strokeWidth: v });
              } else if (selected && selected.type === "pen") {
                patchObj({ strokeWidth: v });
              } else {
                patchSettings({ penWidth: v });
              }
            }}
          />
          {contextTool === "pen" ? (
            <WidthField
              label="Opacity"
              min={0.1}
              max={1}
              step={0.05}
              unit=""
              value={selected && selected.type === "pen" ? selected.opacity : 1}
              onCommit={(v) => {
                if (selected && selected.type === "pen") {
                  patchObj({ opacity: v });
                }
              }}
            />
          ) : null}
        </div>
      )}

      {/* ---------------- image / signature ---------------- */}
      {(selected?.type === "image" || selected?.type === "signature") && (
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          Drag to reposition, corner handles resize. Hold
          <strong> Ctrl</strong> (or ⌘ / Alt) while dragging to keep the
          proportions. The image is embedded at full quality on export.
        </p>
      )}

      {/* ---------------- object actions ---------------- */}
      {selected ? (
        <div className="mt-1 flex flex-col gap-2 border-t border-border pt-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Object
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            <Button variant="outline" size="sm" onClick={() => duplicateObject(selected.id)} className="gap-1.5">
              <Copy className="size-3.5" aria-hidden="true" />
              Duplicate
            </Button>
            <Button variant="outline" size="sm" onClick={() => bringForward(selected.id)} className="gap-1.5">
              <ArrowUpToLine className="size-3.5" aria-hidden="true" />
              Forward
            </Button>
            <Button variant="outline" size="sm" onClick={() => sendBackward(selected.id)} className="gap-1.5">
              <ArrowDownToLine className="size-3.5" aria-hidden="true" />
              Backward
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => deleteObject(selected.id)}
              className="gap-1.5 text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              Delete
            </Button>
          </div>
        </div>
      ) : null}
    </PanelShell>
  );
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function PanelShell({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-3 p-3">{children}</div>;
}

function toolForObject(obj: EditorObject): ToolId {
  switch (obj.type) {
    case "text":
      return "text";
    case "whiteout":
      return "whiteout";
    case "rect":
      return "rect";
    case "ellipse":
      return "ellipse";
    case "line":
      return "line";
    case "pen":
      return obj.role === "whiteout" ? "whiteout" : obj.role === "highlight" ? "highlight" : "pen";
    case "highlight":
      return "highlight";
    default:
      return "image";
  }
}

/* ------------------------------------------------------------------ */
/* text controls (used for both defaults and a selected text object)   */
/* ------------------------------------------------------------------ */

function TextControls({
  value,
  onObject,
  onDefaults,
}: {
  value: { fontKey: string; fontSize: number; color: string };
  onObject: ((_patch: Record<string, unknown>) => void) | null;
  onDefaults: (_patch: Record<string, unknown>) => void;
}): React.JSX.Element {
  const key = value.fontKey as FontKey;
  const def = FONTS[key] ?? FONTS.helv;
  const bold = def.bold;
  const italic = def.italic;
  const hasStyles =
    FONT_FAMILIES.find((f) => f.family === def.family)?.hasStyles ?? false;

  const apply = (patch: Record<string, unknown>) => {
    if (onObject) onObject(patch);
    else onDefaults(patch);
  };

  const setFamily = (fam: string) => {
    const map = FONT_FAMILIES.find((f) => f.family === fam)?.keys;
    if (!map) return;
    ensureFontLoaded(map.regular);
    const next = italic ? (bold ? map.boldItalic : map.italic) : bold ? map.bold : map.regular;
    apply({ fontKey: next });
  };

  const setBold = (on: boolean) => {
    const map = FONT_FAMILIES.find((f) => f.family === def.family)?.keys;
    if (!map) return;
    const next = italic ? (on ? map.boldItalic : map.italic) : on ? map.bold : map.regular;
    apply({ fontKey: next });
  };

  const setItalic = (on: boolean) => {
    const map = FONT_FAMILIES.find((f) => f.family === def.family)?.keys;
    if (!map) return;
    const next = bold ? (on ? map.boldItalic : map.bold) : on ? map.italic : map.regular;
    apply({ fontKey: next });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
          Font
        </Label>
        <Select value={def.family} onValueChange={setFamily}>
          <SelectTrigger className="h-8 text-[12.5px]" aria-label="Font family">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Built-in PDF fonts
              </SelectLabel>
              {FONT_FAMILIES.filter((f) => f.group === "standard").map((f) => (
                <SelectItem key={f.family} value={f.family} className="text-[12.5px]">
                  {f.family}
                </SelectItem>
              ))}
            </SelectGroup>
            <SelectGroup>
              <SelectLabel className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Embedded fonts (self-hosted)
              </SelectLabel>
              {FONT_FAMILIES.filter((f) => f.group === "extra").map((f) => (
                <SelectItem key={f.family} value={f.family} className="text-[12.5px]">
                  {f.family}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <div className="flex gap-1.5">
          <Button
            type="button"
            variant={bold ? "secondary" : "outline"}
            size="sm"
            aria-pressed={bold}
            disabled={!hasStyles}
            title={hasStyles ? "Bold" : "This family ships one weight"}
            onClick={() => setBold(!bold)}
            className="h-8 flex-1 gap-1 text-[12px]"
          >
            <Bold className="size-3.5" aria-hidden="true" />
            Bold
          </Button>
          <Button
            type="button"
            variant={italic ? "secondary" : "outline"}
            size="sm"
            aria-pressed={italic}
            disabled={!hasStyles}
            title={hasStyles ? "Italic" : "This family ships one style"}
            onClick={() => setItalic(!italic)}
            className="h-8 flex-1 gap-1 text-[12px]"
          >
            <Italic className="size-3.5" aria-hidden="true" />
            Italic
          </Button>
        </div>
        {!hasStyles ? (
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Embedded at regular weight — the exact file you see is what
            travels inside the PDF.
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label
          htmlFor="prop-font-size"
          className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground"
        >
          Size (pt)
        </Label>
        <Input
          id="prop-font-size"
          type="number"
          min={4}
          max={200}
          value={value.fontSize}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (!Number.isFinite(n) || n < 1) return;
            const clamped = Math.max(4, Math.min(200, Math.round(n)));
            apply({ fontSize: clamped });
          }}
          className="h-8 w-[84px] text-[12.5px]"
        />
      </div>

      <ColorField
        label="Text colour"
        value={value.color}
        onChange={(c) => {
          if (!c) return;
          apply({ color: c });
        }}
      />
    </div>
  );
}
