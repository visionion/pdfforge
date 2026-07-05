/**
 * Coordinate conversion between screen space (CSS pixels, origin top-left, y
 * down — what Konva and the DOM use) and PDF space (points, origin bottom-left,
 * y up — what pdf-lib and annotations are stored in). All annotations persist in
 * PDF points so they are zoom-independent and export directly.
 *
 * These conversions assume an unrotated page. Per-page model rotation is applied
 * by pdf-lib's /Rotate on export, so annotations are authored in unrotated space.
 */
export interface Pt {
  x: number;
  y: number;
}

export function screenToPdf(sx: number, sy: number, pageHeightPts: number, scale: number): Pt {
  return { x: sx / scale, y: pageHeightPts - sy / scale };
}

export function pdfToScreen(x: number, y: number, pageHeightPts: number, scale: number): Pt {
  return { x: x * scale, y: (pageHeightPts - y) * scale };
}

/** Length in PDF points for a screen-pixel length at the given scale. */
export function screenLenToPdf(len: number, scale: number): number {
  return len / scale;
}
