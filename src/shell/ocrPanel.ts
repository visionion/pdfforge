import type { AppState } from './appState';
import { downloadPdf } from '../export/download';

const LANGS: Array<[string, string]> = [
  ['eng', 'English'],
  ['fra', 'French'],
  ['deu', 'German'],
  ['spa', 'Spanish'],
  ['ita', 'Italian'],
  ['por', 'Portuguese'],
  ['nld', 'Dutch'],
];

/** Modal for OCR: make a scanned PDF searchable, or extract its text. */
export function openOcrPanel(state: AppState): void {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  const panel = document.createElement('div');
  panel.className = 'form-panel';
  backdrop.appendChild(panel);
  const close = (): void => backdrop.remove();
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });

  const title = document.createElement('h2');
  title.textContent = 'OCR — searchable text';
  panel.appendChild(title);

  const langRow = document.createElement('div');
  langRow.className = 'form-field';
  const langLabel = document.createElement('label');
  langLabel.textContent = 'Language';
  const lang = document.createElement('select');
  for (const [code, name] of LANGS) {
    const o = document.createElement('option');
    o.value = code;
    o.textContent = name;
    lang.appendChild(o);
  }
  langRow.append(langLabel, lang);
  panel.appendChild(langRow);

  const status = document.createElement('p');
  status.className = 'muted small ocr-status';
  const bar = document.createElement('div');
  bar.className = 'ocr-bar';
  const barFill = document.createElement('div');
  barFill.className = 'ocr-bar-fill';
  bar.appendChild(barFill);
  panel.append(status, bar);

  const output = document.createElement('textarea');
  output.className = 'ocr-output';
  output.readOnly = true;
  output.hidden = true;
  panel.appendChild(output);

  const onProgress = (r: { page: number; total: number; status: string; progress: number }): void => {
    status.textContent = `Page ${r.page}/${r.total} — ${r.status} ${Math.round(r.progress * 100)}%`;
    barFill.style.width = `${Math.round(((r.page - 1 + r.progress) / r.total) * 100)}%`;
  };

  const actions = document.createElement('div');
  actions.className = 'modal-actions';
  const cancel = document.createElement('button');
  cancel.className = 'ghost';
  cancel.textContent = 'Close';
  cancel.addEventListener('click', close);

  const extract = document.createElement('button');
  extract.className = 'ghost';
  extract.textContent = 'Extract text';
  extract.addEventListener('click', async () => {
    setBusy(true);
    const text = await state.editor.extractText(lang.value, 150, onProgress);
    output.value = text;
    output.hidden = false;
    status.textContent = 'Done.';
    setBusy(false);
  });

  const searchable = document.createElement('button');
  searchable.className = 'primary';
  searchable.textContent = 'Make searchable PDF';
  searchable.addEventListener('click', async () => {
    setBusy(true);
    const bytes = await state.editor.makeSearchable(lang.value, 150, onProgress);
    downloadPdf(bytes, `${state.editor.baseName()}-searchable.pdf`);
    status.textContent = 'Downloaded searchable PDF.';
    setBusy(false);
  });

  function setBusy(busy: boolean): void {
    for (const b of [extract, searchable, lang]) b.toggleAttribute('disabled', busy);
  }

  actions.append(cancel, extract, searchable);
  panel.appendChild(actions);
  document.body.appendChild(backdrop);
}
