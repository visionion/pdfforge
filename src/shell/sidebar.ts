import type { AppState } from './appState';
import type { PageRef } from '../doc/ops';
import { renderThumbnail, renderBlankCanvas } from '../render/pdfjs';
import { scrollToPage } from './viewport';

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
      observer.observe(item);
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
  if (ref.blank) {
    canvas = renderBlankCanvas(ref.blank.width, ref.blank.height, 140 / ref.blank.width);
  } else {
    const page = await state.editor.renderPage(ref);
    if (token !== currentToken() || !page) return;
    canvas = await renderThumbnail(page, 140, ref.rotation);
  }
  if (token !== currentToken()) return;
  item.insertBefore(canvas, item.firstChild);
}
