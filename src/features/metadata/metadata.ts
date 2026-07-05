import { PDFDocument } from 'pdf-lib';

export interface MetadataValues {
  title: string;
  author: string;
  subject: string;
  keywords: string; // comma-separated
  creator: string;
  producer: string;
}

export const EMPTY_METADATA: MetadataValues = {
  title: '',
  author: '',
  subject: '',
  keywords: '',
  creator: '',
  producer: '',
};

/** Read document metadata from PDF bytes. */
export async function readMetadata(bytes: Uint8Array): Promise<MetadataValues> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  return {
    title: doc.getTitle() ?? '',
    author: doc.getAuthor() ?? '',
    subject: doc.getSubject() ?? '',
    keywords: (doc.getKeywords() ?? '').toString(),
    creator: doc.getCreator() ?? '',
    producer: doc.getProducer() ?? '',
  };
}

/** Apply metadata values onto a pdf-lib document (used during export). */
export function applyMetadata(doc: PDFDocument, m: MetadataValues): void {
  doc.setTitle(m.title);
  doc.setAuthor(m.author);
  doc.setSubject(m.subject);
  doc.setKeywords(m.keywords ? m.keywords.split(',').map((s) => s.trim()).filter(Boolean) : []);
  doc.setCreator(m.creator);
  doc.setProducer(m.producer);
}
