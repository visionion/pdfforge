/**
 * The page-level edit model. A document is an ordered list of PageRefs; each
 * either points at a page in a loaded source PDF or describes a blank page.
 * Page operations are pure functions that return a new model, which makes them
 * trivial to wrap in undo/redo Commands and to unit-test without a real PDF.
 */
export interface PageRef {
  /** Stable id for this slot — survives reorder, drives drag + undo. */
  readonly id: string;
  /** Extra rotation applied on top of the source page, in degrees. */
  readonly rotation: 0 | 90 | 180 | 270;
  /** Source page reference (absent for blank pages). */
  readonly sourceId?: string;
  readonly sourceIndex?: number;
  /** Blank page spec in PDF points (absent for source pages). */
  readonly blank?: { readonly width: number; readonly height: number };
}

export type PageModel = readonly PageRef[];

let idCounter = 0;

/** Fresh unique slot id. Monotonic so ids stay stable and comparable. */
export function newPageId(): string {
  idCounter += 1;
  return `p${idCounter}`;
}

/** Build an initial model: one slot per page of a freshly opened source. */
export function modelFromSource(sourceId: string, numPages: number): PageModel {
  return Array.from({ length: numPages }, (_, i) => ({
    id: newPageId(),
    rotation: 0 as const,
    sourceId,
    sourceIndex: i,
  }));
}

function normalizeRotation(deg: number): 0 | 90 | 180 | 270 {
  const n = ((deg % 360) + 360) % 360;
  return (n - (n % 90)) as 0 | 90 | 180 | 270;
}

export function deletePage(model: PageModel, index: number): PageModel {
  return model.filter((_, i) => i !== index);
}

export function duplicatePage(model: PageModel, index: number): PageModel {
  const ref = model[index];
  if (!ref) return model;
  const copy: PageRef = { ...ref, id: newPageId() };
  return [...model.slice(0, index + 1), copy, ...model.slice(index + 1)];
}

export function rotatePage(model: PageModel, index: number, delta: number): PageModel {
  return model.map((ref, i) =>
    i === index ? { ...ref, rotation: normalizeRotation(ref.rotation + delta) } : ref,
  );
}

/** Move the page at `from` so it sits at position `to` in the result. */
export function movePage(model: PageModel, from: number, to: number): PageModel {
  if (from === to || from < 0 || from >= model.length) return model;
  const next = [...model];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function insertBlankPage(
  model: PageModel,
  index: number,
  size: { width: number; height: number } = { width: 595, height: 842 },
): PageModel {
  const blank: PageRef = { id: newPageId(), rotation: 0, blank: { ...size } };
  return [...model.slice(0, index), blank, ...model.slice(index)];
}

/** New model containing only the given page indices, in the order supplied. */
export function extractPages(model: PageModel, indices: number[]): PageModel {
  return indices.filter((i) => i >= 0 && i < model.length).map((i) => model[i]);
}

export function mergeModels(...models: PageModel[]): PageModel {
  return models.flat();
}

/** Insert another model's pages at `index` (insert-from-file). */
export function insertModel(model: PageModel, other: PageModel, index: number): PageModel {
  return [...model.slice(0, index), ...other, ...model.slice(index)];
}

/** Split into chunks of at most `n` pages each. */
export function splitEveryN(model: PageModel, n: number): PageModel[] {
  if (n < 1) throw new Error('split size must be >= 1');
  const chunks: PageModel[] = [];
  for (let i = 0; i < model.length; i += n) chunks.push(model.slice(i, i + n));
  return chunks;
}

/** Split by inclusive 0-based ranges, e.g. [{start:0,end:1},{start:2,end:2}]. */
export function splitByRanges(model: PageModel, ranges: Array<{ start: number; end: number }>): PageModel[] {
  return ranges.map(({ start, end }) => model.slice(start, end + 1));
}
