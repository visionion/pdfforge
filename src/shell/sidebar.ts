import type { AppState } from './appState';
import { renderThumbnail } from '../render/pdfjs';
import { scrollToPage } from './viewport';

/** Thumbnail sidebar. Clicking a thumbnail scrolls the viewport to that page. */
export function createSidebar(state: AppState, viewport: HTMLElement): HTMLElement {
  const root = document.createElement('aside');
  root.className = 'sidebar';

  const list = document.createElement('div');
  list.className = 'thumb-list';
  root.appendChild(list);

  let renderToken = 0;

  async function render(): Promise<void> {
    const token = ++renderToken;
    const doc = state.doc.get();
    list.textContent = '';
    if (!doc) return;

    for (let n = 1; n <= doc.numPages; n++) {
      if (token !== renderToken) return;
      const page = await doc.pdf.getPage(n);
      if (token !== renderToken) return;

      const item = document.createElement('button');
      item.className = 'thumb';
      item.dataset.page = String(n);
      item.title = `Page ${n}`;
      item.addEventListener('click', () => scrollToPage(viewport, n));

      const canvas = await renderThumbnail(page, 140);
      const label = document.createElement('span');
      label.className = 'thumb-label';
      label.textContent = String(n);
      item.append(canvas, label);
      list.appendChild(item);
    }
  }

  function highlight(current: number): void {
    for (const el of list.querySelectorAll<HTMLElement>('.thumb')) {
      el.classList.toggle('active', Number(el.dataset.page) === current);
    }
  }

  state.doc.subscribe(() => void render());
  state.currentPage.subscribe((n) => highlight(n));

  return root;
}
