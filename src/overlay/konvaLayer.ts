import Konva from 'konva';
import type { AppState, Tool } from '../shell/appState';
import type { Annotation } from './annotations';
import { newAnnotationId, annotationsForPage } from './annotations';
import { screenToPdf, pdfToScreen } from './coords';

const DRAW_TOOLS: Tool[] = ['highlight', 'redact', 'ink', 'rect', 'ellipse', 'line', 'arrow', 'text', 'note', 'image', 'link', 'sign'];
// Tools where existing objects can be selected, dragged and resized.
const OBJECT_TOOLS: Tool[] = ['select', 'object'];

/**
 * One Konva overlay per rendered page. Draws the page's annotations and handles
 * both authoring (draw tools) and manipulation. In Select/Move modes every
 * object can be clicked to select, dragged to move, resized (images), and
 * deleted. In Select mode, object interaction turns on only while the pointer is
 * over an object, so text stays selectable everywhere else.
 */
export class PageOverlay {
  private readonly stage: Konva.Stage;
  private readonly layer: Konva.Layer;
  private readonly pageEl: HTMLElement;
  private readonly unsub: () => void;
  private readonly hoverHandler: (e: MouseEvent) => void;
  private start: { x: number; y: number } | null = null;
  private draft: Konva.Shape | null = null;
  private inkPoints: number[] = [];
  private dragStart = { x: 0, y: 0 };

  constructor(
    private readonly container: HTMLDivElement,
    private readonly state: AppState,
    private readonly pageId: string,
    private readonly pageHeightPts: number,
    cssWidth: number,
    cssHeight: number,
  ) {
    this.pageEl = container.parentElement as HTMLElement;
    this.stage = new Konva.Stage({ container, width: cssWidth, height: cssHeight });
    this.layer = new Konva.Layer();
    this.stage.add(this.layer);

    this.applyToolCursor(this.state.activeTool.get());
    this.renderAnnotations();

    const offAnn = state.editor.annotations.subscribe(() => this.renderAnnotations());
    const offTool = state.activeTool.subscribe((t) => {
      // Leaving an object mode clears any selection so its handles disappear.
      if (!OBJECT_TOOLS.includes(t)) state.selectedAnnotationId.set(null);
      this.applyToolCursor(t);
      this.renderAnnotations();
    });
    const offSel = state.selectedAnnotationId.subscribe(() => this.renderAnnotations());
    this.unsub = () => {
      offAnn();
      offTool();
      offSel();
    };

    this.hoverHandler = (e) => this.updateHoverInteractivity(e);
    this.pageEl.addEventListener('mousemove', this.hoverHandler);

    this.stage.on('mousedown touchstart', (e) => this.onDown(e));
    this.stage.on('mousemove touchmove', () => this.onMove());
    this.stage.on('mouseup touchend', () => this.onUp());
  }

  destroy(): void {
    this.unsub();
    this.pageEl.removeEventListener('mousemove', this.hoverHandler);
    this.stage.destroy();
  }

  private get scale(): number {
    return this.state.scale.get();
  }

  private applyToolCursor(tool: Tool): void {
    if (DRAW_TOOLS.includes(tool)) {
      this.container.style.pointerEvents = 'auto';
      this.container.style.cursor = 'crosshair';
    } else if (tool === 'object') {
      this.container.style.pointerEvents = 'auto';
      this.container.style.cursor = 'default';
    } else {
      // 'select' / 'edit-text': off by default; hover re-enables for objects.
      this.container.style.pointerEvents = 'none';
      this.container.style.cursor = 'default';
    }
  }

  /** In Select mode, enable the overlay only while hovering an object/handle. */
  private updateHoverInteractivity(e: MouseEvent): void {
    if (this.state.activeTool.get() !== 'select') return;
    const rect = this.container.getBoundingClientRect();
    const hit = this.stage.getIntersection({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    const overObject = !!hit && hit !== (this.stage as unknown as Konva.Node);
    this.container.style.pointerEvents = overObject ? 'auto' : 'none';
    this.container.style.cursor = overObject ? 'move' : 'default';
  }

  private interactive(): boolean {
    return OBJECT_TOOLS.includes(this.state.activeTool.get());
  }

  private renderAnnotations(): void {
    this.layer.destroyChildren();
    const interactive = this.interactive();
    for (const ann of annotationsForPage(this.state.editor.annotations.get(), this.pageId)) {
      const node = this.toKonva(ann);
      if (!node) continue;
      node.setAttr('annId', ann.id);
      node.setAttr('annType', ann.type);
      node.listening(interactive);
      if (interactive) this.wire(node, ann);
      this.layer.add(node);
    }
    if (interactive) this.attachSelection();
    this.layer.draw();
  }

  /** Make a node clickable/draggable and commit moves/resizes to the model. */
  private wire(node: Konva.Shape, ann: Annotation): void {
    node.draggable(true);
    node.on('mousedown touchstart', (e) => (e.cancelBubble = true));
    node.on('click tap', (e) => {
      e.cancelBubble = true;
      this.state.selectedAnnotationId.set(ann.id);
    });
    node.on('dragstart', () => {
      this.dragStart = { x: node.x(), y: node.y() };
      this.state.selectedAnnotationId.set(ann.id);
    });
    node.on('dragend', () => {
      const dx = (node.x() - this.dragStart.x) / this.scale;
      const dy = -(node.y() - this.dragStart.y) / this.scale;
      this.state.editor.moveAnnotationBy(ann.id, dx, dy);
    });
    if (ann.type === 'image') node.on('transformend', () => this.commitImageResize(ann.id, node as Konva.Image));
  }

  private attachSelection(): void {
    const selId = this.state.selectedAnnotationId.get();
    if (!selId) return;
    const node = this.layer.findOne((n: Konva.Node) => n.getAttr('annId') === selId) as Konva.Shape | undefined;
    if (!node) return;
    const resizable = node.getAttr('annType') === 'image';
    const tr = new Konva.Transformer({
      nodes: [node],
      rotateEnabled: false,
      enabledAnchors: resizable ? undefined : [],
      borderStroke: '#6366f1',
      anchorStroke: '#6366f1',
    });
    this.layer.add(tr);
  }

  private commitImageResize(id: string, node: Konva.Image): void {
    const s = this.scale;
    const width = node.width() * node.scaleX();
    const height = node.height() * node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    const bottomLeft = screenToPdf(node.x(), node.y() + height, this.pageHeightPts, s);
    this.state.editor.updateGeometry(id, { x: bottomLeft.x, y: bottomLeft.y, width: width / s, height: height / s });
  }

  private toKonva(ann: Annotation): Konva.Shape | null {
    const s = this.scale;
    const h = this.pageHeightPts;
    switch (ann.type) {
      case 'highlight':
      case 'whiteout':
      case 'redact':
      case 'rect': {
        const p = pdfToScreen(ann.x, ann.y + ann.height, h, s);
        const filled = ann.type !== 'rect' || ann.fill;
        const fill = ann.type === 'redact' ? '#000000' : filled ? ann.color : undefined;
        return new Konva.Rect({
          x: p.x,
          y: p.y,
          width: ann.width * s,
          height: ann.height * s,
          stroke: ann.type === 'rect' && !ann.fill ? ann.color : undefined,
          strokeWidth: ann.strokeWidth,
          fill,
          opacity: ann.type === 'highlight' ? 0.4 : ann.type === 'rect' && ann.fill ? 0.4 : 1,
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
        });
      }
      case 'line':
      case 'arrow': {
        const a = pdfToScreen(ann.x1, ann.y1, h, s);
        const b = pdfToScreen(ann.x2, ann.y2, h, s);
        const opts = { points: [a.x, a.y, b.x, b.y], stroke: ann.color, strokeWidth: ann.strokeWidth, hitStrokeWidth: 12 };
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
        return new Konva.Line({ points: pts, stroke: ann.color, strokeWidth: ann.strokeWidth, lineCap: 'round', lineJoin: 'round', tension: 0.3, hitStrokeWidth: 12 });
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
        });
      }
      case 'link': {
        const p = pdfToScreen(ann.x, ann.y + ann.height, h, s);
        return new Konva.Rect({ x: p.x, y: p.y, width: ann.width * s, height: ann.height * s, fill: '#3355ee', opacity: 0.12, stroke: '#3355ee', strokeWidth: 1, dash: [4, 3] });
      }
      case 'image':
        return this.imageNode(ann);
    }
  }

  private imageNode(ann: Extract<Annotation, { type: 'image' }>): Konva.Image {
    const s = this.scale;
    const p = pdfToScreen(ann.x, ann.y + ann.height, this.pageHeightPts, s);
    const node = new Konva.Image({ x: p.x, y: p.y, width: ann.width * s, height: ann.height * s, image: undefined });
    const img = new Image();
    img.onload = () => {
      node.image(img);
      node.getLayer()?.batchDraw();
    };
    img.src = ann.dataUrl;
    return node;
  }

  private pointer(): { x: number; y: number } {
    return this.stage.getPointerPosition() ?? { x: 0, y: 0 };
  }

  private onDown(e: Konva.KonvaEventObject<Event>): void {
    const tool = this.state.activeTool.get();
    if (OBJECT_TOOLS.includes(tool)) {
      // Click on empty space deselects.
      if (e.target === this.stage) this.state.selectedAnnotationId.set(null);
      return;
    }
    if (!DRAW_TOOLS.includes(tool)) return;
    const pos = this.pointer();

    if (tool === 'text' || tool === 'note') {
      const text = window.prompt(tool === 'note' ? 'Note text:' : 'Text:');
      if (text) this.commit(this.buildText(tool, pos, text));
      return;
    }
    if (tool === 'image') {
      pickImage().then((picked) => {
        if (!picked) return;
        const ann = this.buildImage(pos, picked);
        this.state.editor.addAnnotation(ann);
        this.selectAndEdit(ann.id); // auto-switch to Move with the new image selected
      });
      return;
    }
    if (tool === 'sign') {
      this.placeSignature(pos);
      return;
    }

    this.start = pos;
    if (tool === 'ink') {
      this.inkPoints = [pos.x, pos.y];
      this.draft = new Konva.Line({ points: this.inkPoints, stroke: this.state.toolColor.get(), strokeWidth: 2, lineCap: 'round', lineJoin: 'round' });
      this.layer.add(this.draft);
    }
  }

  private onMove(): void {
    if (!this.start) return;
    const tool = this.state.activeTool.get();
    const pos = this.pointer();
    const color = tool === 'redact' ? '#000000' : this.state.toolColor.get();
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

  private selectAndEdit(id: string): void {
    this.state.selectedAnnotationId.set(id);
    this.state.activeTool.set('object');
  }

  private placeSignature(pos: { x: number; y: number }): void {
    const pending = this.state.pendingSignature.get();
    if (!pending) return;
    const s = this.scale;
    const widthPts = 160;
    const heightPts = widthPts / pending.aspect;
    const bottomLeft = screenToPdf(pos.x, pos.y + heightPts * s, this.pageHeightPts, s);
    const imgId = newAnnotationId();
    const anns: Annotation[] = [
      { id: imgId, pageId: this.pageId, type: 'image', color: '#000000', x: bottomLeft.x, y: bottomLeft.y, width: widthPts, height: heightPts, dataUrl: pending.dataUrl, format: 'png' },
    ];
    if (pending.withDate) {
      anns.push({ id: newAnnotationId(), pageId: this.pageId, type: 'text', color: '#111111', x: bottomLeft.x, y: bottomLeft.y - 12, text: new Date().toLocaleDateString(), fontSize: 10 });
    }
    this.state.editor.addAnnotations(anns, 'Signature');
    this.state.pendingSignature.set(null);
    this.selectAndEdit(imgId);
  }

  private previewShape(tool: Tool, a: { x: number; y: number }, b: { x: number; y: number }, color: string): Konva.Shape | null {
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    const w = Math.abs(b.x - a.x);
    const hgt = Math.abs(b.y - a.y);
    switch (tool) {
      case 'highlight':
        return new Konva.Rect({ x, y, width: w, height: hgt, fill: color, opacity: 0.4 });
      case 'redact':
        return new Konva.Rect({ x, y, width: w, height: hgt, fill: '#000000' });
      case 'link':
        return new Konva.Rect({ x, y, width: w, height: hgt, stroke: '#3355ee', dash: [4, 3], strokeWidth: 1 });
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
    return { id: newAnnotationId(), pageId: this.pageId, type: tool, color: this.state.toolColor.get(), x: p.x, y: p.y, text, fontSize: 14 };
  }

  private buildImage(pos: { x: number; y: number }, picked: PickedImage): Extract<Annotation, { type: 'image' }> {
    const s = this.scale;
    const targetWidthPts = 200;
    const heightPts = targetWidthPts / picked.aspect;
    const bottomLeft = screenToPdf(pos.x, pos.y + heightPts * s, this.pageHeightPts, s);
    return { id: newAnnotationId(), pageId: this.pageId, type: 'image', color: '#000000', x: bottomLeft.x, y: bottomLeft.y, width: targetWidthPts, height: heightPts, dataUrl: picked.dataUrl, format: picked.format };
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
    if (Math.abs(b.x - a.x) < 3 && Math.abs(b.y - a.y) < 3) return null;
    if (tool === 'line' || tool === 'arrow') {
      const p0 = screenToPdf(a.x, a.y, h, s);
      const p1 = screenToPdf(b.x, b.y, h, s);
      return { id, pageId: this.pageId, type: tool, color, x1: p0.x, y1: p0.y, x2: p1.x, y2: p1.y, strokeWidth: 2 };
    }
    const left = Math.min(a.x, b.x);
    const top = Math.min(a.y, b.y);
    const w = Math.abs(b.x - a.x);
    const hgt = Math.abs(b.y - a.y);
    const bottomLeft = screenToPdf(left, top + hgt, h, s);
    const base = { id, pageId: this.pageId, color, x: bottomLeft.x, y: bottomLeft.y, width: w / s, height: hgt / s };
    if (tool === 'link') {
      const url = window.prompt('Link URL:', 'https://');
      return url ? { ...base, type: 'link', url } : null;
    }
    if (tool === 'highlight' || tool === 'rect' || tool === 'ellipse' || tool === 'redact') {
      return { ...base, type: tool, strokeWidth: 2, fill: tool === 'highlight' || tool === 'redact' };
    }
    return null;
  }

  private commit(ann: Annotation): void {
    this.state.editor.addAnnotation(ann);
  }
}

interface PickedImage {
  dataUrl: string;
  format: 'png' | 'jpg';
  aspect: number;
}

function pickImage(): Promise<PickedImage | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const img = new Image();
        img.onload = () => resolve({ dataUrl, format: file.type === 'image/png' ? 'png' : 'jpg', aspect: img.width / img.height || 1 });
        img.onerror = () => resolve(null);
        img.src = dataUrl;
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
    input.click();
  });
}
