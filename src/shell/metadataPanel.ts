import type { AppState } from './appState';
import type { MetadataValues } from '../features/metadata/metadata';

const FIELDS: Array<[keyof MetadataValues, string]> = [
  ['title', 'Title'],
  ['author', 'Author'],
  ['subject', 'Subject'],
  ['keywords', 'Keywords (comma-separated)'],
  ['creator', 'Creator'],
  ['producer', 'Producer'],
];

/** Modal to view, edit, or remove document metadata (applied on Download). */
export async function openMetadataPanel(state: AppState): Promise<void> {
  const current = state.editor.metadata.get() ?? (await state.editor.readMetadata());

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
  title.textContent = 'Document metadata';
  panel.appendChild(title);

  const inputs = new Map<keyof MetadataValues, HTMLInputElement>();
  const list = document.createElement('div');
  list.className = 'form-fields';
  for (const [key, label] of FIELDS) {
    const row = document.createElement('div');
    row.className = 'form-field';
    const l = document.createElement('label');
    l.textContent = label;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = current[key] ?? '';
    inputs.set(key, input);
    row.append(l, input);
    list.appendChild(row);
  }
  panel.appendChild(list);

  const collect = (): MetadataValues => ({
    title: inputs.get('title')!.value,
    author: inputs.get('author')!.value,
    subject: inputs.get('subject')!.value,
    keywords: inputs.get('keywords')!.value,
    creator: inputs.get('creator')!.value,
    producer: inputs.get('producer')!.value,
  });

  const actions = document.createElement('div');
  actions.className = 'modal-actions';
  const cancel = document.createElement('button');
  cancel.className = 'ghost';
  cancel.textContent = 'Cancel';
  cancel.addEventListener('click', close);
  const removeAll = document.createElement('button');
  removeAll.className = 'ghost';
  removeAll.textContent = 'Remove all';
  removeAll.addEventListener('click', () => {
    for (const input of inputs.values()) input.value = '';
  });
  const apply = document.createElement('button');
  apply.className = 'primary';
  apply.textContent = 'Apply';
  apply.addEventListener('click', () => {
    state.editor.metadata.set(collect());
    close();
  });
  actions.append(cancel, removeAll, apply);
  panel.appendChild(actions);
  document.body.appendChild(backdrop);
}
