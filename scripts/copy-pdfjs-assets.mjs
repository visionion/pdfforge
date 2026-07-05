// Copy pdf.js standard fonts and CJK cmaps into public/ so pages that reference
// non-embedded standard-14 fonts (Helvetica, Times, …) and CJK cmaps render.
// Runs before dev and build; the copied assets are gitignored.
import { cpSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = resolve(root, 'node_modules/pdfjs-dist');
const dest = resolve(root, 'public/pdfjs');

if (!existsSync(src)) {
  console.error('pdfjs-dist not found — run npm install first.');
  process.exit(1);
}

mkdirSync(dest, { recursive: true });
for (const dir of ['standard_fonts', 'cmaps']) {
  cpSync(resolve(src, dir), resolve(dest, dir), { recursive: true });
}
console.log('Copied pdf.js standard_fonts + cmaps to public/pdfjs/');
