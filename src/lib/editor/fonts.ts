/**
 * PDFDock — font model.
 *
 * Two font tiers, all self-hosted (no CDN at runtime, nothing paid):
 *
 *  1. STANDARD — the 14 PDF base fonts (Helvetica / Times / Courier
 *     in all four styles). They embed with ZERO bytes: every PDF
 *     viewer has them built in, so added text stays tiny, selectable
 *     and searchable.
 *
 *  2. EXTRA — 8 popular open-license families (Inter, Roboto, Open
 *     Sans, Lato, Montserrat, Oswald, Playfair Display, Caveat) that
 *     ship as subsetted static TTFs in public/fonts/ and are served
 *     from the SAME ORIGIN as the app. On export they are embedded
 *     (subsetted to the glyphs actually used), so the PDF renders
 *     identically anywhere. On screen they render via @font-face
 *     through the FontFace API.
 *
 * NOTE: the `standard` values are the raw PDF base-font names. They
 * are plain strings, so this module must NOT import pdf-lib — the
 * editor libs stay lazy and the landing page never downloads the PDF
 * engine.
 */

/** build-time base path (GitHub Pages sub-path; "" on root deploys) */
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

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
  | "courBI"
  | "fInter"
  | "fRoboto"
  | "fOpenSans"
  | "fLato"
  | "fMontserrat"
  | "fOswald"
  | "fPlayfair"
  | "fCaveat";

export interface FontDef {
  key: FontKey;
  label: string;
  /** display family name in the picker */
  family: string;
  group: "standard" | "extra";
  bold: boolean;
  italic: boolean;
  /** raw PDF base-font name (equals pdf-lib's StandardFonts value) */
  standard?: string;
  /** TTF served from public/fonts (extra fonts only) */
  file?: string;
  /** unique CSS family so @font-face never collides with system fonts */
  cssFamily?: string;
  /** the CSS stack used by the on-screen overlay — mirrors the PDF font */
  cssStack: string;
}

const helvStack = '"Helvetica Neue", Helvetica, Arial, "Liberation Sans", sans-serif';
const timesStack = '"Times New Roman", Times, "Liberation Serif", serif';
const courStack = '"Courier New", Courier, "Liberation Mono", monospace';

export const FONTS: Record<FontKey, FontDef> = {
  helv: { key: "helv", label: "Helvetica", family: "Helvetica", group: "standard", bold: false, italic: false, standard: "Helvetica", cssStack: helvStack },
  helvB: { key: "helvB", label: "Helvetica Bold", family: "Helvetica", group: "standard", bold: true, italic: false, standard: "Helvetica-Bold", cssStack: helvStack },
  helvI: { key: "helvI", label: "Helvetica Italic", family: "Helvetica", group: "standard", bold: false, italic: true, standard: "Helvetica-Oblique", cssStack: helvStack },
  helvBI: { key: "helvBI", label: "Helvetica Bold Italic", family: "Helvetica", group: "standard", bold: true, italic: true, standard: "Helvetica-BoldOblique", cssStack: helvStack },
  times: { key: "times", label: "Times", family: "Times", group: "standard", bold: false, italic: false, standard: "Times-Roman", cssStack: timesStack },
  timesB: { key: "timesB", label: "Times Bold", family: "Times", group: "standard", bold: true, italic: false, standard: "Times-Bold", cssStack: timesStack },
  timesI: { key: "timesI", label: "Times Italic", family: "Times", group: "standard", bold: false, italic: true, standard: "Times-Italic", cssStack: timesStack },
  timesBI: { key: "timesBI", label: "Times Bold Italic", family: "Times", group: "standard", bold: true, italic: true, standard: "Times-BoldItalic", cssStack: timesStack },
  cour: { key: "cour", label: "Courier", family: "Courier", group: "standard", bold: false, italic: false, standard: "Courier", cssStack: courStack },
  courB: { key: "courB", label: "Courier Bold", family: "Courier", group: "standard", bold: true, italic: false, standard: "Courier-Bold", cssStack: courStack },
  courI: { key: "courI", label: "Courier Italic", family: "Courier", group: "standard", bold: false, italic: true, standard: "Courier-Oblique", cssStack: courStack },
  courBI: { key: "courBI", label: "Courier Bold Italic", family: "Courier", group: "standard", bold: true, italic: true, standard: "Courier-BoldOblique", cssStack: courStack },

  /* self-hosted extras — regular weight, embedded on export */
  fInter: { key: "fInter", label: "Inter", family: "Inter", group: "extra", bold: false, italic: false, file: "inter-regular.ttf", cssFamily: "PDFD Inter", cssStack: `"PDFD Inter", ${helvStack}` },
  fRoboto: { key: "fRoboto", label: "Roboto", family: "Roboto", group: "extra", bold: false, italic: false, file: "roboto-regular.ttf", cssFamily: "PDFD Roboto", cssStack: `"PDFD Roboto", ${helvStack}` },
  fOpenSans: { key: "fOpenSans", label: "Open Sans", family: "Open Sans", group: "extra", bold: false, italic: false, file: "opensans-regular.ttf", cssFamily: "PDFD Open Sans", cssStack: `"PDFD Open Sans", ${helvStack}` },
  fLato: { key: "fLato", label: "Lato", family: "Lato", group: "extra", bold: false, italic: false, file: "lato-regular.ttf", cssFamily: "PDFD Lato", cssStack: `"PDFD Lato", ${helvStack}` },
  fMontserrat: { key: "fMontserrat", label: "Montserrat", family: "Montserrat", group: "extra", bold: false, italic: false, file: "montserrat-regular.ttf", cssFamily: "PDFD Montserrat", cssStack: `"PDFD Montserrat", ${helvStack}` },
  fOswald: { key: "fOswald", label: "Oswald", family: "Oswald", group: "extra", bold: false, italic: false, file: "oswald-regular.ttf", cssFamily: "PDFD Oswald", cssStack: `"PDFD Oswald", ${helvStack}` },
  fPlayfair: { key: "fPlayfair", label: "Playfair Display", family: "Playfair Display", group: "extra", bold: false, italic: false, file: "playfairdisplay-regular.ttf", cssFamily: "PDFD Playfair", cssStack: `"PDFD Playfair", ${timesStack}` },
  fCaveat: { key: "fCaveat", label: "Caveat (handwriting)", family: "Caveat", group: "extra", bold: false, italic: false, file: "caveat-regular.ttf", cssFamily: "PDFD Caveat", cssStack: `"PDFD Caveat", "Segoe Script", cursive` },
};

/** URL of an extra font's TTF (same origin — the build's base path applies) */
export function fontFileUrl(file: string): string {
  return `${BASE_PATH}/fonts/${file}`;
}

/* ------------------------------------------------------------------ */
/* lazy @font-face loading for the extras                               */
/* ------------------------------------------------------------------ */

const loadedFaces = new Set<FontKey>();

/**
 * Register an extra font with the document so the on-screen overlay
 * mirrors the exported PDF. Idempotent and safe to call from render
 * paths — the fetch happens once per font, from our own origin.
 */
export function ensureFontLoaded(key: FontKey): void {
  const def = FONTS[key];
  if (def.group !== "extra" || !def.file || !def.cssFamily) return;
  if (loadedFaces.has(key)) return;
  loadedFaces.add(key);
  if (typeof window === "undefined" || !("FontFace" in window)) return;
  try {
    const face = new FontFace(def.cssFamily, `url(${fontFileUrl(def.file)})`);
    void face.load().then((f) => {
      document.fonts.add(f);
      /* next paint picks the family up automatically */
    }).catch(() => {
      /* the cssStack fallback still renders sensibly */
      loadedFaces.delete(key);
    });
  } catch {
    /* older browsers: fallback stack renders */
  }
}

/* ------------------------------------------------------------------ */
/* the picker model                                                      */
/* ------------------------------------------------------------------ */

export interface FontFamilyDef {
  family: string;
  group: "standard" | "extra";
  /** true when bold/italic style variants exist for this family */
  hasStyles: boolean;
  keys: { regular: FontKey; bold: FontKey; italic: FontKey; boldItalic: FontKey };
}

/** families for the font picker (bold/italic resolve to concrete keys) */
export const FONT_FAMILIES: FontFamilyDef[] = [
  { family: "Helvetica", group: "standard", hasStyles: true, keys: { regular: "helv", bold: "helvB", italic: "helvI", boldItalic: "helvBI" } },
  { family: "Times", group: "standard", hasStyles: true, keys: { regular: "times", bold: "timesB", italic: "timesI", boldItalic: "timesBI" } },
  { family: "Courier", group: "standard", hasStyles: true, keys: { regular: "cour", bold: "courB", italic: "courI", boldItalic: "courBI" } },
  { family: "Inter", group: "extra", hasStyles: false, keys: { regular: "fInter", bold: "fInter", italic: "fInter", boldItalic: "fInter" } },
  { family: "Roboto", group: "extra", hasStyles: false, keys: { regular: "fRoboto", bold: "fRoboto", italic: "fRoboto", boldItalic: "fRoboto" } },
  { family: "Open Sans", group: "extra", hasStyles: false, keys: { regular: "fOpenSans", bold: "fOpenSans", italic: "fOpenSans", boldItalic: "fOpenSans" } },
  { family: "Lato", group: "extra", hasStyles: false, keys: { regular: "fLato", bold: "fLato", italic: "fLato", boldItalic: "fLato" } },
  { family: "Montserrat", group: "extra", hasStyles: false, keys: { regular: "fMontserrat", bold: "fMontserrat", italic: "fMontserrat", boldItalic: "fMontserrat" } },
  { family: "Oswald", group: "extra", hasStyles: false, keys: { regular: "fOswald", bold: "fOswald", italic: "fOswald", boldItalic: "fOswald" } },
  { family: "Playfair Display", group: "extra", hasStyles: false, keys: { regular: "fPlayfair", bold: "fPlayfair", italic: "fPlayfair", boldItalic: "fPlayfair" } },
  { family: "Caveat", group: "extra", hasStyles: false, keys: { regular: "fCaveat", bold: "fCaveat", italic: "fCaveat", boldItalic: "fCaveat" } },
];

/** overlay CSS for a font key */
export function fontCss(key: FontKey): {
  fontFamily: string;
  fontWeight: number;
  fontStyle: string;
} {
  const def = FONTS[key] ?? FONTS.helv;
  /* make sure an extra family's @font-face is requested */
  if (def.group === "extra") ensureFontLoaded(key);
  return {
    fontFamily: def.cssStack,
    fontWeight: def.bold ? 700 : 400,
    fontStyle: def.italic ? "italic" : "normal",
  };
}
