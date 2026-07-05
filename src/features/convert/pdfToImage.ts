import type { DocEditor } from '../../doc/editor';
import { pageToImageBlob } from '../../render/pdfjs';
import { downloadBlob } from '../../export/download';

export type ImageFormat = 'png' | 'jpg';

function mime(format: ImageFormat): 'image/png' | 'image/jpeg' {
  return format === 'jpg' ? 'image/jpeg' : 'image/png';
}

async function pageBlob(editor: DocEditor, index: number, dpi: number, format: ImageFormat): Promise<Blob> {
  const ref = editor.pages.get()[index];
  const scale = dpi / 72;
  const page = await editor.renderPage(ref);
  if (page) return pageToImageBlob(page, scale, ref.rotation, mime(format));

  // Blank page — render a white canvas of the blank size.
  const size = ref.blank ?? { width: 595, height: 842 };
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(size.width * scale);
  canvas.height = Math.floor(size.height * scale);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), mime(format), 0.92);
  });
}

/** Export one page as a PNG/JPG image. */
export async function exportPageAsImage(editor: DocEditor, index: number, dpi: number, format: ImageFormat): Promise<void> {
  const blob = await pageBlob(editor, index, dpi, format);
  downloadBlob(blob, `${editor.baseName()}-page-${index + 1}.${format}`);
}

/** Export all pages as images: a single file for one page, else a zip. */
export async function exportAllAsImages(editor: DocEditor, dpi: number, format: ImageFormat): Promise<void> {
  const count = editor.pages.get().length;
  if (count <= 1) return exportPageAsImage(editor, 0, dpi, format);

  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  for (let i = 0; i < count; i++) {
    const blob = await pageBlob(editor, i, dpi, format);
    zip.file(`page-${String(i + 1).padStart(3, '0')}.${format}`, blob);
  }
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(zipBlob, `${editor.baseName()}-images.zip`);
}
