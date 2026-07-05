/** Trigger a browser download of bytes as a file — no server round-trip. */
export function downloadPdf(bytes: Uint8Array, filename: string): void {
  downloadBlob(new Blob([bytes.slice()], { type: 'application/pdf' }), filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

/** Trigger a browser download of a Blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
