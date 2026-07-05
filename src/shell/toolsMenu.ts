import type { AppState } from './appState';

export interface ToolActions {
  onForm: () => void;
  onSign: () => void;
  onImages: () => void;
  onOcr?: () => void;
  onCompress?: () => void;
  onProtect?: () => void;
  onMetadata?: () => void;
}

/** A "Tools ▾" dropdown grouping document-level actions to keep the toolbar tidy. */
export function createToolsMenu(state: AppState, actions: ToolActions): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'tools-menu';

  const button = document.createElement('button');
  button.className = 'ghost';
  button.textContent = 'Tools ▾';

  const menu = document.createElement('div');
  menu.className = 'tools-dropdown';
  menu.hidden = true;

  const items: Array<[string, (() => void) | undefined]> = [
    ['Fill form', actions.onForm],
    ['Add signature', actions.onSign],
    ['OCR / searchable text', actions.onOcr],
    ['Export as images', actions.onImages],
    ['Compress', actions.onCompress],
    ['Password protect', actions.onProtect],
    ['Edit metadata', actions.onMetadata],
  ];
  for (const [label, action] of items) {
    if (!action) continue;
    const item = document.createElement('button');
    item.className = 'tools-item';
    item.textContent = label;
    item.addEventListener('click', () => {
      close();
      action();
    });
    menu.appendChild(item);
  }

  const open = (): void => {
    menu.hidden = false;
    setTimeout(() => document.addEventListener('click', onOutside), 0);
  };
  const close = (): void => {
    menu.hidden = true;
    document.removeEventListener('click', onOutside);
  };
  const onOutside = (e: MouseEvent): void => {
    if (!wrap.contains(e.target as Node)) close();
  };
  button.addEventListener('click', () => (menu.hidden ? open() : close()));

  wrap.append(button, menu);

  const sync = (): void => {
    button.toggleAttribute('disabled', state.editor.pages.get().length === 0);
  };
  state.editor.pages.subscribe(sync);
  sync();

  return wrap;
}
