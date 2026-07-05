import { AppState } from './appState';
import { createToolbar } from './toolbar';
import { createSidebar } from './sidebar';
import { createViewport } from './viewport';
import { installShortcuts } from './shortcuts';
import { openPdf, PasswordRequiredError, InvalidPdfError } from '../doc/documentModel';

/** Build and mount the whole app into the given root element. */
export function mountApp(root: HTMLElement): void {
  const state = new AppState();
  state.setTheme(state.theme.get()); // apply data-theme + persist

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'application/pdf,.pdf';
  fileInput.style.display = 'none';

  const requestOpen = (): void => fileInput.click();

  const viewport = createViewport(state);
  const sidebar = createSidebar(state, viewport);
  const toolbar = createToolbar(state, { onOpen: requestOpen });

  const body = document.createElement('div');
  body.className = 'app-body';
  body.append(sidebar, viewport);

  const shell = document.createElement('div');
  shell.className = 'app-shell';
  shell.append(toolbar, body, fileInput);
  root.appendChild(shell);

  async function handleFile(file: File): Promise<void> {
    try {
      const buffer = await file.arrayBuffer();
      const doc = await openPdf(buffer, file.name);
      state.commands.clear();
      state.currentPage.set(1);
      state.doc.set(doc);
      document.title = `${file.name} — pdfforge`;
    } catch (err) {
      if (err instanceof PasswordRequiredError) {
        notify('This PDF is password protected. Unlocking is coming soon.');
      } else if (err instanceof InvalidPdfError) {
        notify('That file could not be opened as a PDF.');
      } else {
        notify('Something went wrong opening that file.');
        console.error(err);
      }
    }
  }

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) void handleFile(file);
    fileInput.value = '';
  });

  // Drag-and-drop open, anywhere on the window.
  window.addEventListener('dragover', (e) => {
    e.preventDefault();
    shell.classList.add('dragging');
  });
  window.addEventListener('dragleave', (e) => {
    if (e.relatedTarget === null) shell.classList.remove('dragging');
  });
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    shell.classList.remove('dragging');
    const file = e.dataTransfer?.files?.[0];
    if (file) void handleFile(file);
  });

  // Open button inside the empty state.
  viewport.addEventListener('click', (e) => {
    if ((e.target as HTMLElement)?.id === 'empty-open') requestOpen();
  });

  installShortcuts(state, requestOpen);
}

function notify(message: string): void {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
