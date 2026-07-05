import type { PendingSignature } from '../../shell/appState';

type Mode = 'draw' | 'type' | 'upload';

/**
 * Modal for creating a signature by drawing, typing, or uploading. Returns the
 * signature as a transparent PNG data URL plus an aspect ratio, or null.
 */
export function openSignatureDialog(): Promise<PendingSignature | null> {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    const panel = document.createElement('div');
    panel.className = 'form-panel';
    backdrop.appendChild(panel);

    let settled = false;
    const finish = (result: PendingSignature | null): void => {
      if (settled) return;
      settled = true;
      backdrop.remove();
      resolve(result);
    };
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) finish(null);
    });

    const title = document.createElement('h2');
    title.textContent = 'Add signature';
    panel.appendChild(title);

    const tabs = document.createElement('div');
    tabs.className = 'sign-tabs';
    const content = document.createElement('div');
    content.className = 'sign-content';

    let mode: Mode = 'draw';
    let produce: () => PendingSignature | null = () => null;

    const setMode = (m: Mode): void => {
      mode = m;
      for (const b of tabs.querySelectorAll('button')) b.classList.toggle('active', b.dataset.mode === m);
      content.textContent = '';
      produce = m === 'draw' ? mountDraw(content) : m === 'type' ? mountType(content) : mountUpload(content);
    };

    for (const [m, label] of [['draw', 'Draw'], ['type', 'Type'], ['upload', 'Upload']] as [Mode, string][]) {
      const b = document.createElement('button');
      b.className = 'tool';
      b.dataset.mode = m;
      b.textContent = label;
      b.addEventListener('click', () => setMode(m));
      tabs.appendChild(b);
    }
    panel.append(tabs, content);

    const dateRow = document.createElement('label');
    dateRow.className = 'flatten-row';
    const dateChk = document.createElement('input');
    dateChk.type = 'checkbox';
    dateRow.append(dateChk, document.createTextNode(" Add today's date under the signature"));
    panel.appendChild(dateRow);

    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    const cancel = document.createElement('button');
    cancel.className = 'ghost';
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', () => finish(null));
    const create = document.createElement('button');
    create.className = 'primary';
    create.textContent = 'Place signature';
    create.addEventListener('click', () => {
      const sig = produce();
      if (!sig) return;
      finish({ ...sig, withDate: dateChk.checked });
    });
    actions.append(cancel, create);
    panel.appendChild(actions);

    document.body.appendChild(backdrop);
    setMode('draw');
    void mode; // referenced for lint; active mode tracked via produce()
  });
}

function mountDraw(container: HTMLElement): () => PendingSignature | null {
  const canvas = document.createElement('canvas');
  canvas.width = 440;
  canvas.height = 160;
  canvas.className = 'sign-pad';
  const ctx = canvas.getContext('2d')!;
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  let drawing = false;
  let dirty = false;
  const pos = (e: PointerEvent): [number, number] => {
    const r = canvas.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * canvas.width, ((e.clientY - r.top) / r.height) * canvas.height];
  };
  canvas.addEventListener('pointerdown', (e) => {
    drawing = true;
    dirty = true;
    const [x, y] = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    const [x, y] = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  });
  window.addEventListener('pointerup', () => (drawing = false));

  const clear = document.createElement('button');
  clear.className = 'ghost';
  clear.textContent = 'Clear';
  clear.addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    dirty = false;
  });

  container.append(canvas, clear);
  return () => (dirty ? { dataUrl: canvas.toDataURL('image/png'), aspect: canvas.width / canvas.height, withDate: false } : null);
}

function mountType(container: HTMLElement): () => PendingSignature | null {
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Type your name';
  input.className = 'sign-type-input';
  container.appendChild(input);
  return () => {
    const text = input.value.trim();
    if (!text) return null;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const font = "48px 'Segoe Script', 'Snell Roundhand', 'Brush Script MT', cursive";
    ctx.font = font;
    const w = Math.ceil(ctx.measureText(text).width) + 24;
    canvas.width = w;
    canvas.height = 72;
    const c2 = canvas.getContext('2d')!;
    c2.font = font;
    c2.fillStyle = '#111';
    c2.textBaseline = 'middle';
    c2.fillText(text, 12, canvas.height / 2);
    return { dataUrl: canvas.toDataURL('image/png'), aspect: canvas.width / canvas.height, withDate: false };
  };
}

function mountUpload(container: HTMLElement): () => PendingSignature | null {
  let picked: PendingSignature | null = null;
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/png,image/jpeg';
  const preview = document.createElement('img');
  preview.className = 'sign-preview';
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        picked = { dataUrl, aspect: img.width / img.height || 1, withDate: false };
        preview.src = dataUrl;
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
  container.append(input, preview);
  return () => picked;
}
