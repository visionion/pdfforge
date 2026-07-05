import type { AppState } from './appState';
import { exportPageAsImage, exportAllAsImages, type ImageFormat } from '../features/convert/pdfToImage';

/** Modal to export PDF pages as PNG/JPG images at a chosen DPI. */
export function openConvertPanel(state: AppState): void {
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
    <h2>Export as images</h2>
    <div class="form-field"><label>Format</label>
      <select id="cv-format"><option value="png">PNG</option><option value="jpg">JPG</option></select></div>
    <div class="form-field"><label>Resolution</label>
      <select id="cv-dpi"><option value="72">72 DPI (screen)</option><option value="150" selected>150 DPI</option><option value="300">300 DPI (print)</option></select></div>`;

  const format = (): ImageFormat => (panel.querySelector<HTMLSelectElement>('#cv-format')!.value as ImageFormat);
  const dpi = (): number => Number(panel.querySelector<HTMLSelectElement>('#cv-dpi')!.value);

  const actions = document.createElement('div');
  actions.className = 'modal-actions';
  const cancel = document.createElement('button');
  cancel.className = 'ghost';
  cancel.textContent = 'Cancel';
  cancel.addEventListener('click', close);
  const one = document.createElement('button');
  one.className = 'ghost';
  one.textContent = 'Current page';
  one.addEventListener('click', async () => {
    await exportPageAsImage(state.editor, state.currentPage.get() - 1, dpi(), format());
    close();
  });
  const all = document.createElement('button');
  all.className = 'primary';
  all.textContent = 'All pages';
  all.addEventListener('click', async () => {
    all.disabled = true;
    all.textContent = 'Rendering…';
    await exportAllAsImages(state.editor, dpi(), format());
    close();
  });
  actions.append(cancel, one, all);
  panel.appendChild(actions);

  document.body.appendChild(backdrop);
}
