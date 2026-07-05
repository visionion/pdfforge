import type { AppState } from './appState';
import type { PageRef } from '../doc/ops';
import type { PageOverlay } from '../overlay/konvaLayer';
import { renderPageToCanvas, buildTextLayer, renderBlankCanvas } from '../render/pdfjs';
import { attachTextEdit } from '../features/text-edit/editText';

type OverlayCtor = typeof PageOverlay;
let overlayCtor: OverlayCtor | null = null;
async function ensureOverlayCtor(): Promise<OverlayCtor> {
  // Lazy-load Konva (~57 KB gzip) only once a document is open.
  if (!overlayCtor) overlayCtor = (await import('../overlay/konvaLayer')).PageOverlay;
  return overlayCtor;
}

/**
 * The scrollable page area. Page shells are created immediately (sized to each
 * page) but their canvas/overlay render lazily via IntersectionObserver, so a
 * 100+ page document opens instantly and memory stays bounded.
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
  let observer: IntersectionObserver | null = null;

  async function render(): Promise<void> {
    const token = ++renderToken;
    for (const o of overlays) o.destroy();
    overlays = [];
    observer?.disconnect();

    const model = state.editor.pages.get();
    pages.textContent = '';
    empty.style.display = model.length > 0 ? 'none' : 'grid';
    if (model.length === 0) return;

    const scale = state.scale.get();
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const shell = entry.target as HTMLElement;
          if (shell.dataset.rendered) continue;
          shell.dataset.rendered = '1';
          observer?.unobserve(shell);
          void renderShell(shell);
        }
      },
      { root, rootMargin: '600px 0px' },
    );

    async function renderShell(shell: HTMLElement): Promise<void> {
      const ref = model[Number(shell.dataset.idx)];
      try {
        const overlay = await renderInto(state, ref, scale, shell, token, () => renderToken);
        if (overlay) overlays.push(overlay);
      } catch {
        shell.classList.add('page-error');
      }
    }

    for (let i = 0; i < model.length; i++) {
      if (token !== renderToken) return;
      const ref = model[i];
      const dims = await pageDims(state, ref);
      if (token !== renderToken) return;
      const shell = buildPageShell(state, i, model.length);
      shell.dataset.idx = String(i);
      shell.style.width = `${Math.floor(dims.w * scale)}px`;
      shell.style.height = `${Math.floor(dims.h * scale)}px`;
      pages.appendChild(shell);
      observer.observe(shell);
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

async function pageDims(state: AppState, ref: PageRef): Promise<{ w: number; h: number }> {
  if (ref.blank) return { w: ref.blank.width, h: ref.blank.height };
  const page = await state.editor.renderPage(ref);
  if (!page) return { w: 595, h: 842 };
  const vp = page.getViewport({ scale: 1 });
  // Account for 90/270 rotation swapping the page aspect.
  return ref.rotation % 180 === 0 ? { w: vp.width, h: vp.height } : { w: vp.height, h: vp.width };
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
    const Ctor = await ensureOverlayCtor();
    return new Ctor(makeOverlayEl(pageEl), state, ref.id, ref.blank.height, ref.blank.width * scale, ref.blank.height * scale);
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

  if (ref.rotation !== 0) return null; // annotations author in unrotated space only
  const vp1 = page.getViewport({ scale: 1 });
  attachTextEdit(pageEl, canvas, textLayer, state, ref.id, vp1.height);
  const Ctor = await ensureOverlayCtor();
  return new Ctor(makeOverlayEl(pageEl), state, ref.id, vp1.height, vp1.width * scale, vp1.height * scale);
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
