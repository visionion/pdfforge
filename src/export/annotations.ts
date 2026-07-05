import { rgb, BlendMode, type PDFPage, type PDFFont, type RGB } from 'pdf-lib';
import type { Annotation } from '../overlay/annotations';

export function hexToRgb(hex: string): RGB {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return rgb(0, 0, 0);
  const n = parseInt(m[1], 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Draw a single annotation onto a pdf-lib page (coordinates already in PDF points). */
export function drawAnnotation(page: PDFPage, ann: Annotation, font: PDFFont): void {
  const color = hexToRgb(ann.color);
  switch (ann.type) {
    case 'highlight':
      page.drawRectangle({
        x: ann.x,
        y: ann.y,
        width: ann.width,
        height: ann.height,
        color,
        opacity: 0.4,
        blendMode: BlendMode.Multiply,
      });
      break;
    case 'whiteout':
      // Opaque cover over original content (sampled background color).
      page.drawRectangle({ x: ann.x, y: ann.y, width: ann.width, height: ann.height, color });
      break;
    case 'rect':
      if (ann.fill) {
        page.drawRectangle({ x: ann.x, y: ann.y, width: ann.width, height: ann.height, color, opacity: 0.4 });
      } else {
        page.drawRectangle({
          x: ann.x,
          y: ann.y,
          width: ann.width,
          height: ann.height,
          borderColor: color,
          borderWidth: ann.strokeWidth,
        });
      }
      break;
    case 'ellipse':
      page.drawEllipse({
        x: ann.x + ann.width / 2,
        y: ann.y + ann.height / 2,
        xScale: Math.abs(ann.width / 2),
        yScale: Math.abs(ann.height / 2),
        borderColor: color,
        borderWidth: ann.strokeWidth,
        ...(ann.fill ? { color, opacity: 0.4 } : {}),
      });
      break;
    case 'line':
      page.drawLine({
        start: { x: ann.x1, y: ann.y1 },
        end: { x: ann.x2, y: ann.y2 },
        thickness: ann.strokeWidth,
        color,
      });
      break;
    case 'arrow':
      drawArrow(page, ann, color);
      break;
    case 'ink':
      for (let i = 0; i + 3 < ann.points.length; i += 2) {
        page.drawLine({
          start: { x: ann.points[i], y: ann.points[i + 1] },
          end: { x: ann.points[i + 2], y: ann.points[i + 3] },
          thickness: ann.strokeWidth,
          color,
        });
      }
      break;
    case 'text':
      page.drawText(ann.text, { x: ann.x, y: ann.y, size: ann.fontSize, font, color });
      break;
    case 'note':
      // A small filled marker plus the note text beside it.
      page.drawRectangle({ x: ann.x, y: ann.y - ann.fontSize, width: ann.fontSize, height: ann.fontSize, color });
      page.drawText(ann.text, {
        x: ann.x + ann.fontSize + 4,
        y: ann.y - ann.fontSize + 2,
        size: ann.fontSize,
        font,
        color: rgb(0.1, 0.1, 0.1),
      });
      break;
  }
}

function drawArrow(
  page: PDFPage,
  ann: { x1: number; y1: number; x2: number; y2: number; strokeWidth: number },
  color: RGB,
): void {
  page.drawLine({ start: { x: ann.x1, y: ann.y1 }, end: { x: ann.x2, y: ann.y2 }, thickness: ann.strokeWidth, color });
  const angle = Math.atan2(ann.y2 - ann.y1, ann.x2 - ann.x1);
  const head = Math.max(6, ann.strokeWidth * 3);
  for (const off of [Math.PI - 0.4, Math.PI + 0.4]) {
    page.drawLine({
      start: { x: ann.x2, y: ann.y2 },
      end: { x: ann.x2 + head * Math.cos(angle + off), y: ann.y2 + head * Math.sin(angle + off) },
      thickness: ann.strokeWidth,
      color,
    });
  }
}
