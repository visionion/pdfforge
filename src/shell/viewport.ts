import type { AppState } from './appState';
import type { PageRef } from '../doc/ops';
import { renderPageToCanvas, buildTextLayer, renderBlankCanvas } from '../render/pdfjs';
import { PageOverlay } from '../overlay/konvaLayer';
import { attachTextEdit } from '../features/text-edit/editText';

/**
 * The scrollable page area. Re-renders from the page model whenever the model
 * or zoom changes, and tracks which page is centered for the page indicator.
 * Each page carries a hover toolbar (rotate / duplicate / delete).
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
      <div class="empty-actions">
        <button id="empty-open" class="primary">Open a PDF</button>
        <button id="empty-blank" class="ghost">Start blank</button>
        <button id="empty-images" class="ghost">Images → PDF</button>
      </div>
      <p class="muted small">or drop a file anywhere</p>
    </div>`;

  const pages = document.createElement('div');
  pages.className = 'pages';
  root.append(empty, pages);

  let renderToken = 0;
  let overlays: PageOverlay[] = [];

  async function render(): Promise<void> {
    const token = ++renderToken;
    for (const o of overlays) o.destroy();
    overlays = [];
    const model = state.editor.pages.get();
    pages.textContent = '';
    empty.style.display = model.length > 0 ? 'none' : 'grid';
    if (model.length === 0) return;

    const scale = state.scale.get();
    for (let i = 0; i < model.length; i++) {
      if (token !== renderToken) return; // superseded
      const ref = model[i];
      const pageEl = buildPageShell(state, i, model.length);
      pages.appendChild(pageEl);
      try {
        const overlay = await renderInto(state, ref, scale, pageEl, token, () => renderToken);
        if (overlay) overlays.push(overlay);
      } catch {
        pageEl.classList.add('page-error');
      }
    }
  }

  root.addEventListener('scroll', () => {
    const mid = root.scrollTop + root.clientHeight / 2;
    for (const el of pages.querySelectorAll<HTMLElement>('.page')) {
      if (el.offsetTop <= mid && el.offsetTop + el.offsetHeight >= mid) {
        state.currentPage.set(Number(el.dataset.page));
        break;
      }
    }
  });

  state.editor.pages.subscribe(() => void render());
  state.scale.subscribe(() => void render());

  return root;
}

function buildPageShell(state: AppState, index: number, total: number): HTMLElement {
  const pageEl = document.createElement('div');
  pageEl.className = 'page';
  pageEl.dataset.page = String(index + 1);

  const controls = document.createElement('div');
  controls.className = 'page-controls';
  controls.append(
    ctrlBtn('⟲', 'Rotate left', () => state.editor.rotate(index, -90)),
    ctrlBtn('⟳', 'Rotate right', () => state.editor.rotate(index, 90)),
    ctrlBtn('⧉', 'Duplicate', () => state.editor.duplicate(index)),
    ctrlBtn('✕', 'Delete', () => state.editor.remove(index), total <= 1),
  );
  pageEl.appendChild(controls);
  return pageEl;
}

async function renderInto(
  state: AppState,
  ref: PageRef,
  scale: number,
  pageEl: HTMLElement,
  token: number,
  currentToken: () => number,
): Promise<PageOverlay | null> {
  if (ref.blank) {
    const canvas = renderBlankCanvas(ref.blank.width, ref.blank.height, scale);
    pageEl.appendChild(canvas);
    const overlayEl = makeOverlayEl(pageEl);
    return new PageOverlay(overlayEl, state, ref.id, ref.blank.height, ref.blank.width * scale, ref.blank.height * scale);
  }
  const page = await state.editor.renderPage(ref);
  if (token !== currentToken() || !page) return null;

  const canvas = document.createElement('canvas');
  const textLayer = document.createElement('div');
  textLayer.className = 'text-layer';
  pageEl.append(canvas, textLayer);

  await renderPageToCanvas(page, canvas, scale, ref.rotation);
  buildTextLayer(page, textLayer, scale, ref.rotation).catch(() => {
    /* selection layer is best-effort */
  });

  // Annotation + text-edit — unrotated pages only (coords are authored in
  // unrotated PDF space; per-page rotation would need a coordinate transform).
  if (ref.rotation !== 0) return null;
  const vp1 = page.getViewport({ scale: 1 });
  attachTextEdit(pageEl, canvas, textLayer, state, ref.id, vp1.height);
  const overlayEl = makeOverlayEl(pageEl);
  return new PageOverlay(overlayEl, state, ref.id, vp1.height, vp1.width * scale, vp1.height * scale);
}

function makeOverlayEl(pageEl: HTMLElement): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'konva-overlay';
  pageEl.appendChild(el);
  return el;
}

function ctrlBtn(label: string, title: string, onClick: () => void, disabled = false): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'page-ctrl';
  b.textContent = label;
  b.title = title;
  if (disabled) b.disabled = true;
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });
  return b;
}

/** Scroll a specific 1-based page into view. */
export function scrollToPage(viewport: HTMLElement, page: number): void {
  const el = viewport.querySelector<HTMLElement>(`.page[data-page="${page}"]`);
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
