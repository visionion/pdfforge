import type { AppState } from './appState';

/**
 * Global keyboard shortcuts. Ignored while the user is typing in an editable
 * field so text editing (U6) and form fills (U8) aren't hijacked.
 */
export function installShortcuts(state: AppState, requestOpen: () => void): void {
  window.addEventListener('keydown', (e) => {
    if (isEditableTarget(e.target)) return;
    const mod = e.metaKey || e.ctrlKey;

    if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault();
      state.commands.undo();
    } else if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
      e.preventDefault();
      state.commands.redo();
    } else if (mod && e.key === 'o') {
      e.preventDefault();
      requestOpen();
    } else if (mod && (e.key === '=' || e.key === '+')) {
      e.preventDefault();
      state.zoomIn();
    } else if (mod && e.key === '-') {
      e.preventDefault();
      state.zoomOut();
    }
  });
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  );
}
