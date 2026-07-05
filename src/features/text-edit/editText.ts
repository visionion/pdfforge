import type { AppState } from '../../shell/appState';
import type { Annotation } from '../../overlay/annotations';
import { newAnnotationId } from '../../overlay/annotations';
import { screenToPdf } from '../../overlay/coords';

/**
 * Wire click-to-edit on a page's text layer. When the 'edit-text' tool is
 * active, clicking a text run opens an inline editor seeded with the original
 * text; committing draws an opaque whiteout over the original (sampled to the
 * page background) and retypes the new text — the client-side "edit existing
 * text" approach, since true in-place reflow isn't feasible in the browser.
 */
export function attachTextEdit(
  pageEl: HTMLElement,
  canvas: HTMLCanvasElement,
  textLayer: HTMLElement,
  state: AppState,
  pageId: string,
  pageHeightPts: number,
): void {
  textLayer.addEventListener('click', (e) => {
    if (state.activeTool.get() !== 'edit-text') return;
    const span = e.target as HTMLElement;
    if (span.tagName !== 'SPAN') return;
    e.preventDefault();
    e.stopPropagation();
    openEditor(pageEl, canvas, span, state, pageId, pageHeightPts);
  });
}

function openEditor(
  pageEl: HTMLElement,
  canvas: HTMLCanvasElement,
  span: HTMLElement,
  state: AppState,
  pageId: string,
  pageHeightPts: number,
): void {
  const scale = state.scale.get();
  const pr = pageEl.getBoundingClientRect();
  const sr = span.getBoundingClientRect();
  const left = sr.left - pr.left;
  const top = sr.top - pr.top;
  const w = sr.width;
  const h = sr.height;
  const original = span.textContent ?? '';
  const bg = sampleBackground(canvas, left, top, w);

  const input = document.createElement('div');
  input.contentEditable = 'true';
  input.className = 'text-edit-input';
  input.textContent = original;
  Object.assign(input.style, {
    position: 'absolute',
    left: `${left - 2}px`,
    top: `${top - 1}px`,
    minWidth: `${w}px`,
    fontSize: span.style.fontSize || `${h * 0.85}px`,
    lineHeight: `${h}px`,
    background: bg,
    color: '#111',
  });
  pageEl.appendChild(input);
  input.focus();
  selectAll(input);

  let done = false;
  const commit = (): void => {
    if (done) return;
    done = true;
    const text = (input.textContent ?? '').trim();
    input.remove();
    if (text === original.trim()) return; // no change → no annotations

    const fontSizePdf = (h * 0.82) / scale;
    const whiteoutBL = screenToPdf(left - 2, top + h, pageHeightPts, scale);
    const textBaseline = screenToPdf(left, top + h * 0.82, pageHeightPts, scale);
    const anns: Annotation[] = [
      {
        id: newAnnotationId(),
        pageId,
        type: 'whiteout',
        color: bg,
        x: whiteoutBL.x,
        y: whiteoutBL.y,
        width: (w + 4) / scale,
        height: h / scale,
        strokeWidth: 0,
        fill: true,
      },
    ];
    if (text.length > 0) {
      anns.push({
        id: newAnnotationId(),
        pageId,
        type: 'text',
        color: '#111111',
        x: textBaseline.x,
        y: textBaseline.y,
        text,
        fontSize: fontSizePdf,
      });
    }
    state.editor.addAnnotations(anns, 'Edit text');
  };

  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault();
      commit();
    } else if (ev.key === 'Escape') {
      done = true;
      input.remove();
    }
  });
  input.addEventListener('blur', commit);
}

/** Sample the page background near a text run to match the whiteout fill. */
function sampleBackground(canvas: HTMLCanvasElement, left: number, top: number, w: number): string {
  try {
    const cssW = parseFloat(canvas.style.width) || canvas.width;
    const dpr = canvas.width / cssW;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '#ffffff';
    const sx = Math.min(canvas.width - 1, Math.max(0, Math.round((left + w / 2) * dpr)));
    const sy = Math.max(0, Math.round((top - 3) * dpr));
    const d = ctx.getImageData(sx, sy, 1, 1).data;
    if (d[0] > 245 && d[1] > 245 && d[2] > 245) return '#ffffff';
    return `#${[d[0], d[1], d[2]].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
  } catch {
    return '#ffffff';
  }
}

function selectAll(el: HTMLElement): void {
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}
