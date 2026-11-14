/**
 * PDFDock — font model.
 *
 * v1 ships the PDF standard fonts (Helvetica, Times, Courier in all
 * four styles). They embed with ZERO bytes — the PDF viewer has them
 * built in — so added text stays small, selectable and searchable.
 *
 * NOTE: the `standard` values are the raw PDF base-font names. They are
 * plain strings, so this module must NOT import pdf-lib — the editor
 * libs stay lazy and the landing page never downloads the PDF engine.
 */

export type FontKey =
  | "helv"
  | "helvB"
  | "helvI"
  | "helvBI"
  | "times"
  | "timesB"
  | "timesI"
  | "timesBI"
  | "cour"
  | "courB"
  | "courI"
  | "courBI";

export interface FontDef {
  key: FontKey;
  label: string;
  family: "Helvetica" | "Times" | "Courier";
  bold: boolean;
  italic: boolean;
  /** raw PDF base-font name (equals pdf-lib's StandardFonts value) */
  standard: string;
  /** the CSS stack used by the on-screen overlay — mirrors the PDF font */
  cssStack: string;
}

const helvStack = '"Helvetica Neue", Helvetica, Arial, "Liberation Sans", sans-serif';
const timesStack = '"Times New Roman", Times, "Liberation Serif", serif';
const courStack = '"Courier New", Courier, "Liberation Mono", monospace';

export const FONTS: Record<FontKey, FontDef> = {
  helv: { key: "helv", label: "Helvetica", family: "Helvetica", bold: false, italic: false, standard: "Helvetica", cssStack: helvStack },
  helvB: { key: "helvB", label: "Helvetica Bold", family: "Helvetica", bold: true, italic: false, standard: "Helvetica-Bold", cssStack: helvStack },
  helvI: { key: "helvI", label: "Helvetica Italic", family: "Helvetica", bold: false, italic: true, standard: "Helvetica-Oblique", cssStack: helvStack },
  helvBI: { key: "helvBI", label: "Helvetica Bold Italic", family: "Helvetica", bold: true, italic: true, standard: "Helvetica-BoldOblique", cssStack: helvStack },
  times: { key: "times", label: "Times", family: "Times", bold: false, italic: false, standard: "Times-Roman", cssStack: timesStack },
  timesB: { key: "timesB", label: "Times Bold", family: "Times", bold: true, italic: false, standard: "Times-Bold", cssStack: timesStack },
  timesI: { key: "timesI", label: "Times Italic", family: "Times", bold: false, italic: true, standard: "Times-Italic", cssStack: timesStack },
  timesBI: { key: "timesBI", label: "Times Bold Italic", family: "Times", bold: true, italic: true, standard: "Times-BoldItalic", cssStack: timesStack },
  cour: { key: "cour", label: "Courier", family: "Courier", bold: false, italic: false, standard: "Courier", cssStack: courStack },
  courB: { key: "courB", label: "Courier Bold", family: "Courier", bold: true, italic: false, standard: "Courier-Bold", cssStack: courStack },
  courI: { key: "courI", label: "Courier Italic", family: "Courier", bold: false, italic: true, standard: "Courier-Oblique", cssStack: courStack },
  courBI: { key: "courBI", label: "Courier Bold Italic", family: "Courier", bold: true, italic: true, standard: "Courier-BoldOblique", cssStack: courStack },
};

/** families for the font picker (bold/italic resolve to concrete keys) */
export const FONT_FAMILIES: {
  family: string;
  keys: { regular: FontKey; bold: FontKey; italic: FontKey; boldItalic: FontKey };
}[] = [
  { family: "Helvetica", keys: { regular: "helv", bold: "helvB", italic: "helvI", boldItalic: "helvBI" } },
  { family: "Times", keys: { regular: "times", bold: "timesB", italic: "timesI", boldItalic: "timesBI" } },
  { family: "Courier", keys: { regular: "cour", bold: "courB", italic: "courI", boldItalic: "courBI" } },
];

/** overlay CSS for a font key */
export function fontCss(key: FontKey): {
  fontFamily: string;
  fontWeight: number;
  fontStyle: string;
} {
  const def = FONTS[key];
  return {
    fontFamily: def.cssStack,
    fontWeight: def.bold ? 700 : 400,
    fontStyle: def.italic ? "italic" : "normal",
  };
}
