import type { AppState } from './appState';

export interface ToolbarCallbacks {
  onOpen: () => void;
  onAddFile: () => void;
  onDownload: () => void;
  onForm: () => void;
}

/** Top toolbar: open, add, download, page indicator, zoom, undo/redo, theme. */
export function createToolbar(state: AppState, cb: ToolbarCallbacks): HTMLElement {
  const root = document.createElement('header');
  root.className = 'toolbar';

  const brand = document.createElement('div');
  brand.className = 'brand';
  brand.innerHTML = `<span class="brand-mark">PDF</span><span class="brand-name">forge</span>`;

  const openBtn = button('Open', 'primary', cb.onOpen);
  const addBtn = button('Add PDF', 'ghost', cb.onAddFile);
  const formBtn = button('Form', 'ghost', cb.onForm);
  const downloadBtn = button('Download', 'primary', cb.onDownload);

  const pageInfo = document.createElement('span');
  pageInfo.className = 'page-info';

  const zoomOut = button('−', 'icon', () => state.zoomOut());
  const zoomLevel = document.createElement('span');
  zoomLevel.className = 'zoom-level';
  const zoomIn = button('+', 'icon', () => state.zoomIn());

  const undoBtn = button('Undo', 'ghost', () => state.commands.undo());
  const redoBtn = button('Redo', 'ghost', () => state.commands.redo());

  const themeBtn = button('◐', 'icon', () => state.toggleTheme());
  themeBtn.title = 'Toggle theme';

  const spacer = document.createElement('span');
  spacer.className = 'spacer';

  root.append(
    brand,
    openBtn,
    addBtn,
    spacer,
    pageInfo,
    group(zoomOut, zoomLevel, zoomIn),
    group(undoBtn, redoBtn),
    formBtn,
    downloadBtn,
    themeBtn,
  );

  function syncDocControls(): void {
    const count = state.editor.pages.get().length;
    const has = count > 0;
    pageInfo.textContent = has ? `Page ${state.currentPage.get()} / ${count}` : '';
    zoomLevel.textContent = `${Math.round(state.scale.get() * 100)}%`;
    for (const el of [zoomOut, zoomIn, addBtn, downloadBtn, formBtn]) el.toggleAttribute('disabled', !has);
  }

  function syncHistory(): void {
    undoBtn.toggleAttribute('disabled', !state.commands.canUndo());
    redoBtn.toggleAttribute('disabled', !state.commands.canRedo());
  }

  state.editor.pages.subscribe(syncDocControls);
  state.scale.subscribe(syncDocControls);
  state.currentPage.subscribe(syncDocControls);
  state.commands.subscribe(syncHistory);
  syncDocControls();
  syncHistory();

  return root;
}

function button(label: string, variant: string, onClick: () => void): HTMLButtonElement {
  const el = document.createElement('button');
  el.className = variant;
  el.textContent = label;
  el.addEventListener('click', onClick);
  return el;
}

function group(...children: HTMLElement[]): HTMLElement {
  const g = document.createElement('div');
  g.className = 'btn-group';
  g.append(...children);
  return g;
}
