/** About / help modal: what pdfforge is, the privacy promise, and a short FAQ. */
export function openAboutPanel(): void {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  const panel = document.createElement('div');
  panel.className = 'form-panel about-panel';
  backdrop.appendChild(panel);
  const close = (): void => backdrop.remove();
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });

  panel.innerHTML = `
    <h2>About pdfforge</h2>
    <p>A powerful PDF editor and builder that runs <strong>entirely in your browser</strong>.
       Edit text, annotate, fill &amp; sign forms, merge and split pages, OCR scanned documents,
       build PDFs from scratch, compress, and more.</p>
    <p class="muted"><strong>Private by design:</strong> your files are opened, edited and saved
       on your device. Nothing is uploaded — no signup, no watermark, no limits.</p>
    <h3>FAQ</h3>
    <p><strong>Is it free?</strong> Yes, completely free with no account.</p>
    <p><strong>Do my files get uploaded?</strong> No. All processing happens locally in your browser.</p>
    <p><strong>Does it work offline?</strong> Yes — install it (the “Install” button) and it works without a connection.</p>
    <p><strong>Can it edit scanned PDFs?</strong> Yes — use OCR to make scans searchable and selectable.</p>`;

  const actions = document.createElement('div');
  actions.className = 'modal-actions';
  const btn = document.createElement('button');
  btn.className = 'primary';
  btn.textContent = 'Close';
  btn.addEventListener('click', close);
  actions.appendChild(btn);
  panel.appendChild(actions);
  document.body.appendChild(backdrop);
}
