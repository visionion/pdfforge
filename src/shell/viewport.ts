import type { AppState } from './appState';
import { renderPageToCanvas, buildTextLayer } from '../render/pdfjs';

/**
 * The scrollable page area. Re-renders all pages when the document or zoom
 * changes, and tracks which page is centered to drive the page indicator.
 */
export function createViewport(state: AppState): HTMLElement {
  const root = document.createElement('main');
  root.className = 'viewport';

  const empty = document.createElement('div');
  empty.className = 'empty-state';
  empty.innerHTML = `
    <div class="empty-card">
      <h1>pdfforge</h1>
      <p>A powerful PDF editor that runs entirely in your browser.</p>
      <p class="muted">Your files never leave your device — no upload, no signup, no watermark.</p>
      <button id="empty-open" class="primary">Open a PDF</button>
      <p class="muted small">or drop a file anywhere</p>
    </div>`;

  const pages = document.createElement('div');
  pages.className = 'pages';

  root.append(empty, pages);

  let renderToken = 0;

  async function render(): Promise<void> {
    const token = ++renderToken;
    const doc = state.doc.get();
    pages.textContent = '';
    empty.style.display = doc ? 'none' : 'grid';
    if (!doc) return;

    const scale = state.scale.get();
    for (let n = 1; n <= doc.numPages; n++) {
      if (token !== renderToken) return; // superseded by a newer render
      const page = await doc.pdf.getPage(n);
      if (token !== renderToken) return;

      const pageEl = document.createElement('div');
      pageEl.className = 'page';
      pageEl.dataset.page = String(n);

      const canvas = document.createElement('canvas');
      const textLayer = document.createElement('div');
      textLayer.className = 'text-layer';
      pageEl.append(canvas, textLayer);
      pages.appendChild(pageEl);

      await renderPageToCanvas(page, canvas, scale);
      buildTextLayer(page, textLayer, scale).catch(() => {
        /* selection layer is best-effort; visual render already succeeded */
      });
    }
  }

  // Track the centered page for the toolbar indicator.
  root.addEventListener('scroll', () => {
    const mid = root.scrollTop + root.clientHeight / 2;
    for (const el of pages.querySelectorAll<HTMLElement>('.page')) {
      if (el.offsetTop <= mid && el.offsetTop + el.offsetHeight >= mid) {
        state.currentPage.set(Number(el.dataset.page));
        break;
      }
    }
  });

  state.doc.subscribe(() => void render());
  state.scale.subscribe(() => void render());

  return root;
}

/** Scroll a specific page into view. */
export function scrollToPage(viewport: HTMLElement, page: number): void {
  const el = viewport.querySelector<HTMLElement>(`.page[data-page="${page}"]`);
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
