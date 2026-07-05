import type { AppState } from './appState';
import type { FieldInfo, FormValues } from '../features/forms/forms';

/** Open a modal panel listing the PDF's form fields for filling and flattening. */
export async function openFormPanel(state: AppState): Promise<void> {
  const fields = await state.editor.detectForm();

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
  title.textContent = 'Fill form';
  panel.appendChild(title);

  if (fields.length === 0) {
    const msg = document.createElement('p');
    msg.className = 'muted';
    msg.textContent = 'This PDF has no fillable form fields.';
    panel.append(msg, closeButton(close));
    document.body.appendChild(backdrop);
    return;
  }

  const inputs = new Map<string, HTMLInputElement | HTMLSelectElement>();
  const list = document.createElement('div');
  list.className = 'form-fields';
  for (const field of fields) {
    list.appendChild(fieldRow(field, inputs));
  }
  panel.appendChild(list);

  const flattenRow = document.createElement('label');
  flattenRow.className = 'flatten-row';
  const flatten = document.createElement('input');
  flatten.type = 'checkbox';
  flatten.checked = true;
  flattenRow.append(flatten, document.createTextNode(' Flatten (bake values, remove editable fields)'));
  panel.appendChild(flattenRow);

  const actions = document.createElement('div');
  actions.className = 'modal-actions';
  const cancel = document.createElement('button');
  cancel.className = 'ghost';
  cancel.textContent = 'Cancel';
  cancel.addEventListener('click', close);
  const apply = document.createElement('button');
  apply.className = 'primary';
  apply.textContent = 'Apply';
  apply.addEventListener('click', async () => {
    apply.disabled = true;
    apply.textContent = 'Applying…';
    const values: FormValues = {};
    for (const [name, el] of inputs) {
      values[name] = el instanceof HTMLInputElement && el.type === 'checkbox' ? el.checked : el.value;
    }
    await state.editor.applyForm(values, flatten.checked);
    close();
  });
  actions.append(cancel, apply);
  panel.appendChild(actions);

  document.body.appendChild(backdrop);
}

function fieldRow(field: FieldInfo, inputs: Map<string, HTMLInputElement | HTMLSelectElement>): HTMLElement {
  const row = document.createElement('div');
  row.className = 'form-field';
  const label = document.createElement('label');
  label.textContent = field.name;
  row.appendChild(label);

  if (field.type === 'checkbox') {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = field.value === true;
    inputs.set(field.name, input);
    row.appendChild(input);
  } else if (field.options && field.options.length) {
    const select = document.createElement('select');
    for (const opt of field.options) {
      const o = document.createElement('option');
      o.value = opt;
      o.textContent = opt;
      if (opt === field.value) o.selected = true;
      select.appendChild(o);
    }
    inputs.set(field.name, select);
    row.appendChild(select);
  } else {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = typeof field.value === 'string' ? field.value : '';
    inputs.set(field.name, input);
    row.appendChild(input);
  }
  return row;
}

function closeButton(close: () => void): HTMLElement {
  const actions = document.createElement('div');
  actions.className = 'modal-actions';
  const btn = document.createElement('button');
  btn.className = 'primary';
  btn.textContent = 'Close';
  btn.addEventListener('click', close);
  actions.appendChild(btn);
  return actions;
}
