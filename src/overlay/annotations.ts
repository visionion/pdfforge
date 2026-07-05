/**
 * Annotation data model. Annotations attach to a page *slot* by its PageRef id
 * (from doc/ops), so they follow their page through reorder/delete. All geometry
 * is stored in PDF points (origin bottom-left). This module is pure and tested;
 * the Konva overlay authors these objects and pdf-lib bakes them on export.
 */
export type AnnotationType =
  | 'highlight'
  | 'ink'
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'text'
  | 'note';

interface Base {
  readonly id: string;
  readonly pageId: string;
  readonly color: string; // hex, e.g. "#ffcc00"
}

export interface RectAnnotation extends Base {
  readonly type: 'rect' | 'ellipse' | 'highlight';
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly strokeWidth: number;
  readonly fill: boolean; // filled vs outline (highlight is always filled/translucent)
}

export interface LineAnnotation extends Base {
  readonly type: 'line' | 'arrow';
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly strokeWidth: number;
}

export interface InkAnnotation extends Base {
  readonly type: 'ink';
  readonly points: readonly number[]; // flat [x0,y0,x1,y1,...] in PDF points
  readonly strokeWidth: number;
}

export interface TextAnnotation extends Base {
  readonly type: 'text' | 'note';
  readonly x: number;
  readonly y: number;
  readonly text: string;
  readonly fontSize: number;
}

export type Annotation = RectAnnotation | LineAnnotation | InkAnnotation | TextAnnotation;

export type AnnotationModel = readonly Annotation[];

let seq = 0;
export function newAnnotationId(): string {
  seq += 1;
  return `a${seq}`;
}

export function annotationsForPage(model: AnnotationModel, pageId: string): Annotation[] {
  return model.filter((a) => a.pageId === pageId);
}

export function addAnnotation(model: AnnotationModel, annotation: Annotation): AnnotationModel {
  return [...model, annotation];
}

export function removeAnnotation(model: AnnotationModel, id: string): AnnotationModel {
  return model.filter((a) => a.id !== id);
}

export function updateAnnotation(
  model: AnnotationModel,
  id: string,
  patch: Partial<Annotation>,
): AnnotationModel {
  return model.map((a) => (a.id === id ? ({ ...a, ...patch } as Annotation) : a));
}

/** Drop annotations whose page slot no longer exists (after page deletion). */
export function pruneAnnotations(model: AnnotationModel, livePageIds: Set<string>): AnnotationModel {
  return model.filter((a) => livePageIds.has(a.pageId));
}
