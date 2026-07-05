import * as pdfjsLib from 'pdfjs-dist';
import type { PDFPageProxy } from 'pdfjs-dist';

/** Total rotation = the page's own /Rotate plus the model's extra rotation. */
function normalizedRotation(page: PDFPageProxy, extra: number): number {
  return (((page.rotate + extra) % 360) + 360) % 360;
}

/**
 * pdf.js cannot run two render tasks concurrently against the same page proxy
 * (getPage returns a cached proxy, so the viewport and the thumbnail sidebar
 * would collide and deadlock). Serialize all render tasks through one chain;
 * with a single pdf.js worker this costs nothing and removes the race.
 */
let renderChain: Promise<unknown> = Promise.resolve();
function enqueueRender<T>(task: () => Promise<T>): Promise<T> {
  const run = renderChain.then(task, task);
  renderChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/**
 * Render a page onto a canvas at the given CSS scale, accounting for device
 * pixel ratio so the raster is crisp on HiDPI screens.
 *
 * Note: pdf.js v6 wants the `canvas` param and derives its own 2D context.
 * Passing a `canvasContext` alongside a non-null `canvas` is contradictory and
 * stalls the render task, so we pass `canvas` only.
 */
export async function renderPageToCanvas(
  page: PDFPageProxy,
  canvas: HTMLCanvasElement,
  scale: number,
  rotation = 0,
): Promise<void> {
  const viewport = page.getViewport({ scale, rotation: normalizedRotation(page, rotation) });
  const dpr = window.devicePixelRatio || 1;
  if (!canvas.getContext('2d')) throw new Error('2D canvas context unavailable');

  canvas.width = Math.floor(viewport.width * dpr);
  canvas.height = Math.floor(viewport.height * dpr);
  canvas.style.width = `${Math.floor(viewport.width)}px`;
  canvas.style.height = `${Math.floor(viewport.height)}px`;

  await enqueueRender(
    () =>
      page.render({
        canvas,
        viewport,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
      }).promise,
  );
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
  rotation = 0,
): Promise<void> {
  const viewport = page.getViewport({ scale, rotation: normalizedRotation(page, rotation) });
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
  rotation = 0,
): Promise<HTMLCanvasElement> {
  const base = page.getViewport({ scale: 1, rotation: normalizedRotation(page, rotation) });
  const scale = targetWidth / base.width;
  const canvas = document.createElement('canvas');
  await renderPageToCanvas(page, canvas, scale, rotation);
  return canvas;
}

/** Render a plain white blank page of the given PDF-point size to a canvas. */
export function renderBlankCanvas(
  width: number,
  height: number,
  scale: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(width * scale * dpr);
  canvas.height = Math.floor(height * scale * dpr);
  canvas.style.width = `${Math.floor(width * scale)}px`;
  canvas.style.height = `${Math.floor(height * scale)}px`;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  return canvas;
}
