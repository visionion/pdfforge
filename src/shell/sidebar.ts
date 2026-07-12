import type { AppState } from './appState';
import type { PageRef } from '../doc/ops';
import { renderThumbnail, renderBlankCanvas } from '../render/pdfjs';
import { scrollToPage } from './viewport';
import { annotationsForPage } from '../overlay/annotations';
import { drawAnnotations2D } from '../overlay/draw2d';

/**
 * Thumbnail sidebar rendered lazily from the page model. Clicking scrolls the
 * viewport; dragging a thumbnail reorders pages. Thumbnails render only as they
 * scroll into view, so large documents stay responsive.
 */
export function createSidebar(state: AppState, viewport: HTMLElement): HTMLElement {
  const root = document.createElement('aside');
  root.className = 'sidebar';

  const list = document.createElement('div');
  list.className = 'thumb-list';
  root.appendChild(list);

  let renderToken = 0;
  let dragFrom: number | null = null;
  let observer: IntersectionObserver | null = null;

  function render(): void {
    const token = ++renderToken;
    observer?.disconnect();
    const model = state.editor.pages.get();
    list.textContent = '';
    if (model.length === 0) return;

    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const item = entry.target as HTMLElement;
          if (item.dataset.rendered) continue;
          item.dataset.rendered = '1';
          observer?.unobserve(item);
          void paintThumb(state, model[Number(item.dataset.idx)], item, token, () => renderToken);
        }
      },
      { root, rootMargin: '400px 0px' },
    );

    for (let i = 0; i < model.length; i++) {
      const item = buildThumb(i);
      item.dataset.idx = String(i);
      list.appendChild(item);
      // Eagerly paint thumbnails near the current scroll position; the observer
      // only handles ones scrolled into view later (IO delivery can be deferred
      // in background tabs and must never gate first paint).
      if (item.offsetTop < root.scrollTop + root.clientHeight + 400) {
        item.dataset.rendered = '1';
        void paintThumb(state, model[i], item, token, () => renderToken);
      } else {
        observer.observe(item);
      }
    }
    highlight(state.currentPage.get());
  }

  function buildThumb(index: number): HTMLElement {
    const item = document.createElement('div');
    item.className = 'thumb';
    item.dataset.page = String(index + 1);
    item.draggable = true;
    item.title = `Page ${index + 1}`;
    item.addEventListener('click', () => scrollToPage(viewport, index + 1));

    item.addEventListener('dragstart', () => {
      dragFrom = index;
      item.classList.add('drag-src');
    });
    item.addEventListener('dragend', () => {
      dragFrom = null;
      list.querySelectorAll('.thumb').forEach((t) => t.classList.remove('drag-over', 'drag-src'));
    });
    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      item.classList.add('drag-over');
    });
    item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
    item.addEventListener('drop', (e) => {
      e.preventDefault();
      item.classList.remove('drag-over');
      if (dragFrom !== null && dragFrom !== index) state.editor.move(dragFrom, index);
    });

    const label = document.createElement('span');
    label.className = 'thumb-label';
    label.textContent = String(index + 1);
    item.appendChild(label);
    return item;
  }

  function highlight(current: number): void {
    for (const el of list.querySelectorAll<HTMLElement>('.thumb')) {
      el.classList.toggle('active', Number(el.dataset.page) === current);
    }
  }

  state.editor.pages.subscribe(() => render());
  state.currentPage.subscribe((n) => highlight(n));

  // Re-paint thumbnails when annotations change (debounced so it doesn't thrash
  // while drawing). Only the currently-visible thumbnails re-render (lazy).
  let annTimer: ReturnType<typeof setTimeout> | undefined;
  state.editor.annotations.subscribe(() => {
    clearTimeout(annTimer);
    annTimer = setTimeout(() => render(), 250);
  });

  return root;
}

async function paintThumb(
  state: AppState,
  ref: PageRef,
  item: HTMLElement,
  token: number,
  currentToken: () => number,
): Promise<void> {
  let canvas: HTMLCanvasElement;
  let widthPts: number;
  let heightPts: number;
  if (ref.blank) {
    widthPts = ref.blank.width;
    heightPts = ref.blank.height;
    canvas = renderBlankCanvas(widthPts, heightPts, 140 / widthPts);
  } else {
    const page = await state.editor.renderPage(ref);
    if (token !== currentToken() || !page) return;
    const vp1 = page.getViewport({ scale: 1 });
    widthPts = vp1.width;
    heightPts = vp1.height;
    canvas = await renderThumbnail(page, 140, ref.rotation);
  }
  if (token !== currentToken()) return;

  // Overlay this page's annotations onto the thumbnail (unrotated pages only).
  const anns = annotationsForPage(state.editor.annotations.get(), ref.id);
  if (anns.length && ref.rotation === 0) {
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const cssScale = 140 / widthPts;
      const dpr = canvas.width / (parseFloat(canvas.style.width) || 140);
      drawAnnotations2D(ctx, anns, cssScale, heightPts, dpr);
    }
  }
  item.insertBefore(canvas, item.firstChild);
}
