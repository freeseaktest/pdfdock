/**
 * PDFDock — display-space ⇄ PDF user-space geometry.
 *
 * Objects are stored in display space (top-left origin, y grows DOWN,
 * rotation already applied — exactly what the visitor sees). PDF user
 * space is bottom-left origin, y grows UP, unrotated. The transforms
 * below mirror pdf.js' viewport math for /Rotate 0/90/180/270 so the
 * export lands each object exactly where it was placed on screen.
 */

export interface PageGeom {
  /** unrotated user-space dims (MediaBox), points */
  userWidth: number;
  userHeight: number;
  /** effective /Rotate (original + user rotations), 0/90/180/270 */
  rotation: number;
}

/** display dims for an effective rotation (90/270 swap sides) */
export function displayDims(
  userWidth: number,
  userHeight: number,
  rotation: number,
): { width: number; height: number } {
  return (rotation % 180 === 0)
    ? { width: userWidth, height: userHeight }
    : { width: userHeight, height: userWidth };
}

/**
 * Map a display-space point (top-left origin, y down) to PDF user
 * space (bottom-left origin, y up), compensating for /Rotate.
 * Derived from pdf.js' viewport transform:
 *   R=0:   X = x,        Y = H - y
 *   R=90:  X = y,        Y = x            (page displayed rotated 90° CW)
 *   R=180: X = W - x,    Y = H - y
 *   R=270: X = W - y,    Y = H - x
 */
export function displayToUser(
  geom: PageGeom,
  x: number,
  y: number,
): { x: number; y: number } {
  const { userWidth: w, userHeight: h } = geom;
  switch (((geom.rotation % 360) + 360) % 360) {
    case 90:
      return { x: y, y: x };
    case 180:
      return { x: w - x, y: h - y };
    case 270:
      return { x: w - y, y: h - x };
    default:
      return { x, y: h - y };
  }
}

/** the angle pdf-lib must draw text at so it appears upright after /Rotate */
export function textDrawRotation(rotation: number): number {
  return ((rotation % 360) + 360) % 360;
}

/**
 * Map a PDF user-space point (bottom-left origin, y up) to display space
 * (top-left origin, y down) — the exact inverse of displayToUser, per
 * pdf.js' viewport math. Used by the retype assist to locate existing
 * document text under the pointer.
 */
export function userToDisplay(
  geom: PageGeom,
  x: number,
  y: number,
): { x: number; y: number } {
  const { userWidth: w, userHeight: h } = geom;
  switch (((geom.rotation % 360) + 360) % 360) {
    case 90:
      return { x: y, y: x };
    case 180:
      return { x: w - x, y: h - y };
    case 270:
      return { x: h - y, y: w - x };
    default:
      return { x, y: h - y };
  }
}

/**
 * Rotate a display-space point by +90° CW when the visitor rotates a
 * page: content must rotate with it.
 * Old display is W×H → new display is H×W; a point (x, y) in the old
 * display moves to (H − y, x) in the new one (corners verified).
 */
export function rotatePointCw90(
  oldHeight: number,
  x: number,
  y: number,
): { x: number; y: number } {
  return { x: oldHeight - y, y: x };
}
