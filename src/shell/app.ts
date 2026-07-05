import { AppState } from './appState';
import { createToolbar } from './toolbar';
import { createToolStrip } from './toolstrip';
import { openFormPanel } from './formPanel';
import { openConvertPanel } from './convertPanel';
import { openSignatureDialog } from '../features/sign/signatureDialog';
import { createSidebar } from './sidebar';
import { createViewport } from './viewport';
import { installShortcuts } from './shortcuts';
import { openPdf, PasswordRequiredError, InvalidPdfError } from '../doc/documentModel';
import { downloadPdf } from '../export/download';

/** Build and mount the whole app into the given root element. */
export function mountApp(root: HTMLElement): void {
  const state = new AppState();
  state.setTheme(state.theme.get());

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'application/pdf,.pdf';
  fileInput.style.display = 'none';
  let mode: 'open' | 'add' = 'open';

  const requestOpen = (): void => {
    mode = 'open';
    fileInput.click();
  };
  const requestAdd = (): void => {
    mode = 'add';
    fileInput.click();
  };

  const viewport = createViewport(state);
  const sidebar = createSidebar(state, viewport);
  const toolbar = createToolbar(state, {
    onOpen: requestOpen,
    onAddFile: requestAdd,
    onAddPage: () => state.editor.appendBlank(),
    onDownload: () => void handleDownload(),
    tools: {
      onForm: () => void openFormPanel(state),
      onSign: () => void handleSign(),
      onImages: () => openConvertPanel(state),
    },
  });

  async function handleSign(): Promise<void> {
    const sig = await openSignatureDialog();
    if (!sig) return;
    state.pendingSignature.set(sig);
    state.activeTool.set('sign');
    notify('Click on the page where you want your signature.');
  }

  const toolstrip = createToolStrip(state);

  const body = document.createElement('div');
  body.className = 'app-body';
  body.append(sidebar, viewport);

  const shell = document.createElement('div');
  shell.className = 'app-shell';
  shell.append(toolbar, toolstrip, body, fileInput);
  root.appendChild(shell);

  async function handleFile(file: File, how: 'open' | 'add'): Promise<void> {
    try {
      const buffer = await file.arrayBuffer();
      const doc = await openPdf(buffer, file.name);
      if (how === 'add' && state.editor.hasDoc()) {
        state.editor.addFile(doc);
      } else {
        state.commands.clear();
        state.currentPage.set(1);
        state.editor.loadPrimary(doc);
        document.title = `${file.name} — pdfforge`;
      }
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

  async function handleDownload(): Promise<void> {
    if (!state.editor.hasDoc()) return;
    try {
      const bytes = await state.editor.export();
      downloadPdf(bytes, state.editor.exportName());
    } catch (err) {
      notify('Export failed. Please try again.');
      console.error(err);
    }
  }

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) void handleFile(file, mode);
    fileInput.value = '';
  });

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
    if (file) void handleFile(file, state.editor.hasDoc() ? 'add' : 'open');
  });

  viewport.addEventListener('click', (e) => {
    const id = (e.target as HTMLElement)?.id;
    if (id === 'empty-open') requestOpen();
    else if (id === 'empty-blank') {
      state.currentPage.set(1);
      state.editor.startBlank();
      document.title = 'Untitled — pdfforge';
    } else if (id === 'empty-images') requestImages();
  });

  const imagesInput = document.createElement('input');
  imagesInput.type = 'file';
  imagesInput.accept = 'image/png,image/jpeg';
  imagesInput.multiple = true;
  imagesInput.style.display = 'none';
  shell.appendChild(imagesInput);
  const requestImages = (): void => imagesInput.click();
  imagesInput.addEventListener('change', () => {
    const files = Array.from(imagesInput.files ?? []);
    imagesInput.value = '';
    if (files.length) void buildFromImages(files, state);
  });

  installShortcuts(state, requestOpen);
}

async function buildFromImages(files: File[], state: AppState): Promise<void> {
  const images: Array<{ dataUrl: string; format: 'png' | 'jpg'; wpx: number; hpx: number }> = [];
  for (const file of files) {
    const dataUrl = await readAsDataUrl(file);
    const dims = await imageDims(dataUrl);
    images.push({ dataUrl, format: file.type === 'image/png' ? 'png' : 'jpg', wpx: dims.w, hpx: dims.h });
  }
  if (!images.length) return;
  state.currentPage.set(1);
  state.editor.imagesToPdf(images);
  document.title = 'Images — pdfforge';
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function imageDims(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 595, h: 842 });
    img.src = dataUrl;
  });
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
