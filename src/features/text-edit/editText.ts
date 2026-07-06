import type { AppState } from '../../shell/appState';
import type { Annotation } from '../../overlay/annotations';
import { newAnnotationId } from '../../overlay/annotations';

interface Geom {
  px: number;
  py: number;
  pw: number;
  ph: number;
}

/**
 * Wire click / drag text editing on a page's text layer. With the 'edit-text'
 * tool: clicking a text run selects and edits its whole line; dragging selects
 * an arbitrary region of text. The selected text is covered with an opaque
 * whiteout (sampled to the page background) and retyped — the client-side "edit
 * existing text" approach, since true in-place reflow isn't feasible in-browser.
 * Coverage uses pdf.js's exact text-item geometry for pixel-accurate results.
 */
export function attachTextEdit(
  pageEl: HTMLElement,
  canvas: HTMLCanvasElement,
  textLayer: HTMLElement,
  state: AppState,
  pageId: string,
): void {
  let sel: { x0: number; y0: number; moved: boolean; rect: HTMLDivElement | null } | null = null;
  const rel = (e: MouseEvent): { x: number; y: number } => {
    const pr = pageEl.getBoundingClientRect();
    return { x: e.clientX - pr.left, y: e.clientY - pr.top };
  };

  pageEl.addEventListener('mousedown', (e) => {
    if (state.activeTool.get() !== 'edit-text') return;
    if ((e.target as HTMLElement).closest('.text-edit-input')) return;
    const p = rel(e);
    sel = { x0: p.x, y0: p.y, moved: false, rect: null };
  });

  pageEl.addEventListener('mousemove', (e) => {
    if (!sel) return;
    const p = rel(e);
    if (Math.abs(p.x - sel.x0) > 3 || Math.abs(p.y - sel.y0) > 3) sel.moved = true;
    if (!sel.moved) return;
    if (!sel.rect) {
      sel.rect = document.createElement('div');
      sel.rect.className = 'text-select-rect';
      pageEl.appendChild(sel.rect);
    }
    Object.assign(sel.rect.style, {
      left: `${Math.min(p.x, sel.x0)}px`,
      top: `${Math.min(p.y, sel.y0)}px`,
      width: `${Math.abs(p.x - sel.x0)}px`,
      height: `${Math.abs(p.y - sel.y0)}px`,
    });
  });

  pageEl.addEventListener('mouseup', (e) => {
    if (!sel) return;
    const cur = sel;
    sel = null;
    cur.rect?.remove();
    const spans = [...textLayer.querySelectorAll<HTMLElement>('span')];
    let chosen: HTMLElement[];
    if (cur.moved) {
      const p = rel(e);
      const box = { left: Math.min(p.x, cur.x0), top: Math.min(p.y, cur.y0), right: Math.max(p.x, cur.x0), bottom: Math.max(p.y, cur.y0) };
      chosen = spans.filter((s) => intersects(s, pageEl, box));
    } else {
      const target = e.target as HTMLElement;
      if (target.tagName !== 'SPAN') return;
      chosen = sameLine(spans, target);
    }
    if (chosen.length) openEditor(pageEl, canvas, chosen, state, pageId);
  });
}

/** All spans on the same text baseline as the clicked one (a "line"). */
function sameLine(spans: HTMLElement[], target: HTMLElement): HTMLElement[] {
  const g = pdfGeometry(target);
  if (!g) return [target];
  const line = spans.filter((s) => {
    const sg = pdfGeometry(s);
    return sg && Math.abs(sg.py - g.py) < g.ph * 0.6;
  });
  return line.length ? line : [target];
}

function intersects(span: HTMLElement, pageEl: HTMLElement, box: { left: number; top: number; right: number; bottom: number }): boolean {
  const pr = pageEl.getBoundingClientRect();
  const sr = span.getBoundingClientRect();
  const l = sr.left - pr.left;
  const t = sr.top - pr.top;
  return l < box.right && l + sr.width > box.left && t < box.bottom && t + sr.height > box.top;
}

function openEditor(
  pageEl: HTMLElement,
  canvas: HTMLCanvasElement,
  spans: HTMLElement[],
  state: AppState,
  pageId: string,
): void {
  const scale = state.scale.get();
  const geoms = spans.map(pdfGeometry).filter((g): g is Geom => g !== null);
  if (!geoms.length) return;

  // Reading order: top line first (higher py in PDF space), then left-to-right.
  const ordered = spans
    .map((s) => ({ s, g: pdfGeometry(s) }))
    .filter((o): o is { s: HTMLElement; g: Geom } => o.g !== null)
    .sort((a, b) => (Math.abs(a.g.py - b.g.py) > 2 ? b.g.py - a.g.py : a.g.px - b.g.px));
  const original = ordered.map((o) => o.s.textContent ?? '').join(' ').replace(/\s+/g, ' ').trim();

  const minX = Math.min(...geoms.map((g) => g.px));
  const maxX = Math.max(...geoms.map((g) => g.px + g.pw));
  const minBaseline = Math.min(...geoms.map((g) => g.py));
  const maxBaseline = Math.max(...geoms.map((g) => g.py));
  const avgH = geoms.reduce((s, g) => s + g.ph, 0) / geoms.length;

  // Screen rect (relative to page) for positioning the inline editor.
  const pr = pageEl.getBoundingClientRect();
  let sl = Infinity, st = Infinity, sr = -Infinity, sb = -Infinity;
  for (const s of spans) {
    const r = s.getBoundingClientRect();
    sl = Math.min(sl, r.left - pr.left);
    st = Math.min(st, r.top - pr.top);
    sr = Math.max(sr, r.right - pr.left);
    sb = Math.max(sb, r.bottom - pr.top);
  }
  const bg = sampleBackground(canvas, sl, st, sr - sl);

  const input = document.createElement('textarea');
  input.className = 'text-edit-input';
  input.value = original;
  Object.assign(input.style, {
    position: 'absolute',
    left: `${sl - 2}px`,
    top: `${st - 1}px`,
    width: `${Math.max(60, sr - sl + 6)}px`,
    height: `${Math.max(avgH * scale * 1.4, sb - st + 4)}px`,
    fontSize: `${avgH * scale}px`,
    lineHeight: `${avgH * scale * 1.15}px`,
    background: bg,
    color: '#111',
  });
  pageEl.appendChild(input);
  input.focus();
  input.select();

  let done = false;
  const commit = (): void => {
    if (done) return;
    done = true;
    const text = input.value.trim();
    input.remove();
    if (text === original) return;

    const pad = avgH * 0.3;
    const anns: Annotation[] = [
      {
        id: newAnnotationId(),
        pageId,
        type: 'whiteout',
        color: bg,
        x: minX - 1,
        y: minBaseline - pad,
        width: maxX - minX + 2,
        height: maxBaseline - minBaseline + avgH + pad * 1.5,
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
        x: minX,
        y: maxBaseline,
        text,
        fontSize: avgH,
        maxWidth: Math.max(avgH * 4, maxX - minX), // wrap within the selected region
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

/** Read the exact pdf.js text-item geometry (PDF points) stashed on the span. */
function pdfGeometry(span: HTMLElement): Geom | null {
  const px = Number(span.dataset.px);
  const py = Number(span.dataset.py);
  const pw = Number(span.dataset.pw);
  const ph = Number(span.dataset.ph);
  if ([px, py, pw, ph].some((n) => !Number.isFinite(n)) || pw <= 0 || ph <= 0) return null;
  return { px, py, pw, ph };
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
