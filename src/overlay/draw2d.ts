import type { Annotation } from './annotations';
import { pdfToScreen } from './coords';

/**
 * Draw annotations onto a 2D canvas (used for thumbnails, which render the page
 * raster and then overlay the annotations). `cssScale` maps PDF points to the
 * canvas's CSS pixels; the context is scaled by `dpr` so drawing happens in CSS
 * coordinates. Assumes an unrotated page (annotations are authored unrotated).
 */
export function drawAnnotations2D(
  ctx: CanvasRenderingContext2D,
  anns: Annotation[],
  cssScale: number,
  pageHeightPts: number,
  dpr: number,
): void {
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const pt = (x: number, y: number): { x: number; y: number } => pdfToScreen(x, y, pageHeightPts, cssScale);
  for (const ann of anns) {
    switch (ann.type) {
      case 'highlight':
      case 'whiteout':
      case 'redact':
      case 'rect': {
        const p = pt(ann.x, ann.y + ann.height);
        const w = ann.width * cssScale;
        const h = ann.height * cssScale;
        const filled = ann.type !== 'rect' || ann.fill;
        if (filled) {
          ctx.globalAlpha = ann.type === 'highlight' ? 0.4 : ann.type === 'rect' ? 0.4 : 1;
          ctx.fillStyle = ann.type === 'redact' ? '#000000' : ann.color;
          ctx.fillRect(p.x, p.y, w, h);
          ctx.globalAlpha = 1;
        } else {
          ctx.strokeStyle = ann.color;
          ctx.lineWidth = ann.strokeWidth;
          ctx.strokeRect(p.x, p.y, w, h);
        }
        break;
      }
      case 'ellipse': {
        const p = pt(ann.x + ann.width / 2, ann.y + ann.height / 2);
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, Math.abs(ann.width / 2) * cssScale, Math.abs(ann.height / 2) * cssScale, 0, 0, Math.PI * 2);
        if (ann.fill) {
          ctx.globalAlpha = 0.4;
          ctx.fillStyle = ann.color;
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        ctx.strokeStyle = ann.color;
        ctx.lineWidth = ann.strokeWidth;
        ctx.stroke();
        break;
      }
      case 'line':
      case 'arrow': {
        const a = pt(ann.x1, ann.y1);
        const b = pt(ann.x2, ann.y2);
        ctx.strokeStyle = ann.color;
        ctx.lineWidth = ann.strokeWidth;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        break;
      }
      case 'ink': {
        ctx.strokeStyle = ann.color;
        ctx.lineWidth = ann.strokeWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        for (let i = 0; i + 1 < ann.points.length; i += 2) {
          const p = pt(ann.points[i], ann.points[i + 1]);
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
        break;
      }
      case 'text':
      case 'note': {
        const p = pt(ann.x, ann.y);
        ctx.fillStyle = ann.type === 'note' ? '#1a1a1a' : ann.color;
        ctx.font = `${ann.fontSize * cssScale}px system-ui, sans-serif`;
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(ann.text, p.x + (ann.type === 'note' ? ann.fontSize * cssScale + 2 : 0), p.y);
        break;
      }
      case 'link': {
        const p = pt(ann.x, ann.y + ann.height);
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = '#3355ee';
        ctx.fillRect(p.x, p.y, ann.width * cssScale, ann.height * cssScale);
        ctx.globalAlpha = 1;
        break;
      }
      case 'image': {
        const p = pt(ann.x, ann.y + ann.height);
        const w = ann.width * cssScale;
        const h = ann.height * cssScale;
        const img = new Image();
        img.onload = () => {
          ctx.save();
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.drawImage(img, p.x, p.y, w, h);
          ctx.restore();
        };
        img.src = ann.dataUrl;
        break;
      }
    }
  }
  ctx.restore();
}
