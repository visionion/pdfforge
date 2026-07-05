import type { AppState } from './appState';
import { downloadPdf } from '../export/download';
import { track } from '../analytics';

function fmt(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Modal to compress the PDF by rasterizing pages at a chosen DPI/quality. */
export function openCompressPanel(state: AppState): void {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  const panel = document.createElement('div');
  panel.className = 'form-panel';
  backdrop.appendChild(panel);
  const close = (): void => backdrop.remove();
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });

  panel.innerHTML = `
    <h2>Compress PDF</h2>
    <p class="muted small">Rebuilds pages as images. Best for scanned or image-heavy PDFs; page text becomes non-selectable.</p>
    <div class="form-field"><label>Resolution</label>
      <select id="cp-dpi"><option value="72">72 DPI</option><option value="100">100 DPI</option><option value="150" selected>150 DPI</option><option value="200">200 DPI</option></select></div>
    <div class="form-field"><label>Quality</label>
      <input id="cp-quality" type="range" min="30" max="90" value="65" /></div>`;

  const status = document.createElement('p');
  status.className = 'muted small ocr-status';
  panel.appendChild(status);

  const dpi = (): number => Number(panel.querySelector<HTMLSelectElement>('#cp-dpi')!.value);
  const quality = (): number => Number(panel.querySelector<HTMLInputElement>('#cp-quality')!.value) / 100;

  let result: Uint8Array | null = null;
  const actions = document.createElement('div');
  actions.className = 'modal-actions';
  const cancel = document.createElement('button');
  cancel.className = 'ghost';
  cancel.textContent = 'Close';
  cancel.addEventListener('click', close);

  const run = document.createElement('button');
  run.className = 'primary';
  run.textContent = 'Compress';
  run.addEventListener('click', async () => {
    run.disabled = true;
    run.textContent = 'Compressing…';
    result = await state.editor.compress(dpi(), quality(), (r) => {
      status.textContent = `Rendering page ${r.page}/${r.total}…`;
    });
    const before = state.editor.originalSize();
    const after = result.length;
    const pct = before > 0 ? Math.round((1 - after / before) * 100) : 0;
    track('compress', { dpi: dpi(), reduced_pct: pct });
    status.textContent = before > 0
      ? `${fmt(before)} → ${fmt(after)} (${pct >= 0 ? pct + '% smaller' : Math.abs(pct) + '% larger'})`
      : `Compressed to ${fmt(after)}`;
    run.textContent = 'Download';
    run.disabled = false;
    run.onclick = () => {
      if (result) downloadPdf(result, `${state.editor.baseName()}-compressed.pdf`);
    };
  });

  actions.append(cancel, run);
  panel.appendChild(actions);
  document.body.appendChild(backdrop);
}
