import Konva from 'konva';
import type { AppState, Tool } from '../shell/appState';
import type { Annotation } from './annotations';
import { newAnnotationId, annotationsForPage } from './annotations';
import { screenToPdf, pdfToScreen } from './coords';

const DRAW_TOOLS: Tool[] = ['highlight', 'ink', 'rect', 'ellipse', 'line', 'arrow', 'text', 'note'];

/**
 * One Konva overlay per rendered page. Displays that page's annotations and, when
 * a drawing tool is active, authors new ones (converting screen → PDF points).
 * Deletion is via the shared undo stack, so the overlay is create-only.
 */
export class PageOverlay {
  private readonly stage: Konva.Stage;
  private readonly layer: Konva.Layer;
  private readonly unsub: () => void;
  private start: { x: number; y: number } | null = null;
  private draft: Konva.Shape | null = null;
  private inkPoints: number[] = [];

  constructor(
    private readonly container: HTMLDivElement,
    private readonly state: AppState,
    private readonly pageId: string,
    private readonly pageHeightPts: number,
    cssWidth: number,
    cssHeight: number,
  ) {
    this.stage = new Konva.Stage({ container, width: cssWidth, height: cssHeight });
    this.layer = new Konva.Layer();
    this.stage.add(this.layer);

    this.applyToolCursor(state.activeTool.get());
    this.renderAnnotations();

    const offAnn = state.editor.annotations.subscribe(() => this.renderAnnotations());
    const offTool = state.activeTool.subscribe((t) => this.applyToolCursor(t));
    this.unsub = () => {
      offAnn();
      offTool();
    };

    this.stage.on('mousedown touchstart', () => this.onDown());
    this.stage.on('mousemove touchmove', () => this.onMove());
    this.stage.on('mouseup touchend', () => this.onUp());
  }

  destroy(): void {
    this.unsub();
    this.stage.destroy();
  }

  private get scale(): number {
    return this.state.scale.get();
  }

  private applyToolCursor(tool: Tool): void {
    const drawing = DRAW_TOOLS.includes(tool);
    // Let text selection / page controls through when not drawing.
    this.container.style.pointerEvents = drawing ? 'auto' : 'none';
    this.container.style.cursor = drawing ? 'crosshair' : 'default';
  }

  private renderAnnotations(): void {
    this.layer.destroyChildren();
    const anns = annotationsForPage(this.state.editor.annotations.get(), this.pageId);
    for (const ann of anns) this.layer.add(this.toKonva(ann));
    this.layer.draw();
  }

  private toKonva(ann: Annotation): Konva.Shape {
    const s = this.scale;
    const h = this.pageHeightPts;
    switch (ann.type) {
      case 'highlight':
      case 'whiteout':
      case 'rect': {
        const p = pdfToScreen(ann.x, ann.y + ann.height, h, s);
        const filled = ann.type === 'highlight' || ann.type === 'whiteout' || ann.fill;
        return new Konva.Rect({
          x: p.x,
          y: p.y,
          width: ann.width * s,
          height: ann.height * s,
          stroke: ann.type === 'rect' && !ann.fill ? ann.color : undefined,
          strokeWidth: ann.strokeWidth,
          fill: filled ? ann.color : undefined,
          opacity: ann.type === 'highlight' ? 0.4 : ann.type === 'whiteout' ? 1 : ann.fill ? 0.4 : 1,
          listening: false,
        });
      }
      case 'ellipse': {
        const p = pdfToScreen(ann.x + ann.width / 2, ann.y + ann.height / 2, h, s);
        return new Konva.Ellipse({
          x: p.x,
          y: p.y,
          radiusX: Math.abs(ann.width / 2) * s,
          radiusY: Math.abs(ann.height / 2) * s,
          stroke: ann.color,
          strokeWidth: ann.strokeWidth,
          fill: ann.fill ? ann.color : undefined,
          opacity: ann.fill ? 0.4 : 1,
          listening: false,
        });
      }
      case 'line':
      case 'arrow': {
        const a = pdfToScreen(ann.x1, ann.y1, h, s);
        const b = pdfToScreen(ann.x2, ann.y2, h, s);
        const opts = { points: [a.x, a.y, b.x, b.y], stroke: ann.color, strokeWidth: ann.strokeWidth, listening: false };
        return ann.type === 'arrow'
          ? new Konva.Arrow({ ...opts, pointerLength: 10, pointerWidth: 10, fill: ann.color })
          : new Konva.Line(opts);
      }
      case 'ink': {
        const pts: number[] = [];
        for (let i = 0; i + 1 < ann.points.length; i += 2) {
          const p = pdfToScreen(ann.points[i], ann.points[i + 1], h, s);
          pts.push(p.x, p.y);
        }
        return new Konva.Line({
          points: pts,
          stroke: ann.color,
          strokeWidth: ann.strokeWidth,
          lineCap: 'round',
          lineJoin: 'round',
          tension: 0.3,
          listening: false,
        });
      }
      case 'text':
      case 'note': {
        const p = pdfToScreen(ann.x, ann.y, h, s);
        return new Konva.Text({
          x: p.x + (ann.type === 'note' ? ann.fontSize * s + 4 : 0),
          y: p.y - ann.fontSize * s,
          text: ann.text,
          fontSize: ann.fontSize * s,
          fill: ann.type === 'note' ? '#1a1a1a' : ann.color,
          listening: false,
        });
      }
    }
  }

  private pointer(): { x: number; y: number } {
    return this.stage.getPointerPosition() ?? { x: 0, y: 0 };
  }

  private onDown(): void {
    const tool = this.state.activeTool.get();
    if (!DRAW_TOOLS.includes(tool)) return;
    const pos = this.pointer();

    if (tool === 'text' || tool === 'note') {
      const text = window.prompt(tool === 'note' ? 'Note text:' : 'Text:');
      if (text) this.commit(this.buildText(tool, pos, text));
      return;
    }

    this.start = pos;
    if (tool === 'ink') {
      this.inkPoints = [pos.x, pos.y];
      this.draft = new Konva.Line({
        points: this.inkPoints,
        stroke: this.state.toolColor.get(),
        strokeWidth: 2,
        lineCap: 'round',
        lineJoin: 'round',
      });
      this.layer.add(this.draft);
    }
  }

  private onMove(): void {
    if (!this.start) return;
    const tool = this.state.activeTool.get();
    const pos = this.pointer();
    const color = this.state.toolColor.get();
    if (tool === 'ink' && this.draft) {
      this.inkPoints.push(pos.x, pos.y);
      (this.draft as Konva.Line).points(this.inkPoints);
      this.layer.batchDraw();
      return;
    }
    this.draft?.destroy();
    this.draft = this.previewShape(tool, this.start, pos, color);
    if (this.draft) this.layer.add(this.draft);
    this.layer.batchDraw();
  }

  private onUp(): void {
    const tool = this.state.activeTool.get();
    if (!this.start) return;
    const pos = this.pointer();
    const ann = this.buildShape(tool, this.start, pos);
    this.start = null;
    this.draft?.destroy();
    this.draft = null;
    if (ann) this.commit(ann);
    else this.renderAnnotations();
  }

  private previewShape(
    tool: Tool,
    a: { x: number; y: number },
    b: { x: number; y: number },
    color: string,
  ): Konva.Shape | null {
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    const w = Math.abs(b.x - a.x);
    const hgt = Math.abs(b.y - a.y);
    switch (tool) {
      case 'highlight':
        return new Konva.Rect({ x, y, width: w, height: hgt, fill: color, opacity: 0.4 });
      case 'rect':
        return new Konva.Rect({ x, y, width: w, height: hgt, stroke: color, strokeWidth: 2 });
      case 'ellipse':
        return new Konva.Ellipse({ x: x + w / 2, y: y + hgt / 2, radiusX: w / 2, radiusY: hgt / 2, stroke: color, strokeWidth: 2 });
      case 'line':
        return new Konva.Line({ points: [a.x, a.y, b.x, b.y], stroke: color, strokeWidth: 2 });
      case 'arrow':
        return new Konva.Arrow({ points: [a.x, a.y, b.x, b.y], stroke: color, fill: color, strokeWidth: 2 });
      default:
        return null;
    }
  }

  private buildText(tool: 'text' | 'note', pos: { x: number; y: number }, text: string): Annotation {
    const p = screenToPdf(pos.x, pos.y, this.pageHeightPts, this.scale);
    return {
      id: newAnnotationId(),
      pageId: this.pageId,
      type: tool,
      color: this.state.toolColor.get(),
      x: p.x,
      y: p.y,
      text,
      fontSize: 14,
    };
  }

  private buildShape(tool: Tool, a: { x: number; y: number }, b: { x: number; y: number }): Annotation | null {
    const s = this.scale;
    const h = this.pageHeightPts;
    const color = this.state.toolColor.get();
    const id = newAnnotationId();
    if (tool === 'ink') {
      const pts: number[] = [];
      for (let i = 0; i + 1 < this.inkPoints.length; i += 2) {
        const p = screenToPdf(this.inkPoints[i], this.inkPoints[i + 1], h, s);
        pts.push(p.x, p.y);
      }
      this.inkPoints = [];
      return pts.length >= 4 ? { id, pageId: this.pageId, type: 'ink', color, points: pts, strokeWidth: 2 } : null;
    }
    if (Math.abs(b.x - a.x) < 3 && Math.abs(b.y - a.y) < 3) return null; // ignore stray clicks
    if (tool === 'line' || tool === 'arrow') {
      const p0 = screenToPdf(a.x, a.y, h, s);
      const p1 = screenToPdf(b.x, b.y, h, s);
      return { id, pageId: this.pageId, type: tool, color, x1: p0.x, y1: p0.y, x2: p1.x, y2: p1.y, strokeWidth: 2 };
    }
    if (tool === 'highlight' || tool === 'rect' || tool === 'ellipse') {
      const left = Math.min(a.x, b.x);
      const top = Math.min(a.y, b.y);
      const w = Math.abs(b.x - a.x);
      const hgt = Math.abs(b.y - a.y);
      const bottomLeft = screenToPdf(left, top + hgt, h, s);
      return {
        id,
        pageId: this.pageId,
        type: tool,
        color,
        x: bottomLeft.x,
        y: bottomLeft.y,
        width: w / s,
        height: hgt / s,
        strokeWidth: 2,
        fill: tool === 'highlight',
      };
    }
    return null;
  }

  private commit(ann: Annotation): void {
    this.state.editor.addAnnotation(ann); // triggers annotations subscribe → renderAnnotations
  }
}
