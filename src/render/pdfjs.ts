import * as pdfjsLib from 'pdfjs-dist';
import type { PDFPageProxy } from 'pdfjs-dist';

/**
 * Render a page onto a canvas at the given CSS scale, accounting for device
 * pixel ratio so the raster is crisp on HiDPI screens.
 */
export async function renderPageToCanvas(
  page: PDFPageProxy,
  canvas: HTMLCanvasElement,
  scale: number,
): Promise<void> {
  const viewport = page.getViewport({ scale });
  const dpr = window.devicePixelRatio || 1;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');

  canvas.width = Math.floor(viewport.width * dpr);
  canvas.height = Math.floor(viewport.height * dpr);
  canvas.style.width = `${Math.floor(viewport.width)}px`;
  canvas.style.height = `${Math.floor(viewport.height)}px`;

  await page.render({
    canvas,
    canvasContext: ctx,
    viewport,
    transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
  }).promise;
}

/**
 * Build a selectable text layer of absolutely-positioned transparent spans
 * aligned over the rendered canvas, using pdf.js text-item transforms.
 * Best-effort: a failure here never blocks the visual render.
 */
export async function buildTextLayer(
  page: PDFPageProxy,
  container: HTMLElement,
  scale: number,
): Promise<void> {
  const viewport = page.getViewport({ scale });
  container.textContent = '';
  container.style.width = `${Math.floor(viewport.width)}px`;
  container.style.height = `${Math.floor(viewport.height)}px`;

  const textContent = await page.getTextContent();
  const frag = document.createDocumentFragment();

  for (const item of textContent.items) {
    if (!('str' in item) || item.str.length === 0) continue;
    const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
    const fontHeight = Math.hypot(tx[2], tx[3]);
    if (fontHeight === 0) continue;

    const span = document.createElement('span');
    span.textContent = item.str;
    span.style.left = `${tx[4]}px`;
    span.style.top = `${tx[5] - fontHeight}px`;
    span.style.fontSize = `${fontHeight}px`;
    span.style.fontFamily = item.fontName;
    frag.appendChild(span);
  }

  container.appendChild(frag);
}

/** Render a small thumbnail canvas for a page, sized to a target width. */
export async function renderThumbnail(
  page: PDFPageProxy,
  targetWidth: number,
): Promise<HTMLCanvasElement> {
  const base = page.getViewport({ scale: 1 });
  const scale = targetWidth / base.width;
  const canvas = document.createElement('canvas');
  await renderPageToCanvas(page, canvas, scale);
  return canvas;
}
