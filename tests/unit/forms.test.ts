import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { detectFields, fillForm } from '../../src/features/forms/forms';

async function makeFormPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([300, 400]);
  const form = doc.getForm();
  const name = form.createTextField('fullName');
  name.addToPage(page, { x: 20, y: 300, width: 160, height: 20 });
  const agree = form.createCheckBox('agree');
  agree.addToPage(page, { x: 20, y: 260, width: 14, height: 14 });
  const color = form.createDropdown('color');
  color.setOptions(['Red', 'Green', 'Blue']);
  color.addToPage(page, { x: 20, y: 220, width: 100, height: 18 });
  return doc.save();
}

describe('AcroForm fill & flatten', () => {
  it('detects fields with types and options', async () => {
    const fields = await detectFields(await makeFormPdf());
    const byName = Object.fromEntries(fields.map((f) => [f.name, f]));
    expect(byName.fullName.type).toBe('text');
    expect(byName.agree.type).toBe('checkbox');
    expect(byName.color.type).toBe('dropdown');
    expect(byName.color.options).toEqual(['Red', 'Green', 'Blue']);
  });

  it('fills values without flattening (fields remain editable)', async () => {
    const filled = await fillForm(await makeFormPdf(), { fullName: 'Alice', agree: true, color: 'Blue' }, false);
    const doc = await PDFDocument.load(filled);
    const form = doc.getForm();
    expect(form.getTextField('fullName').getText()).toBe('Alice');
    expect(form.getCheckBox('agree').isChecked()).toBe(true);
    expect(form.getDropdown('color').getSelected()).toEqual(['Blue']);
  });

  it('flattening removes the interactive fields', async () => {
    const filled = await fillForm(await makeFormPdf(), { fullName: 'Bob' }, true);
    const doc = await PDFDocument.load(filled);
    expect(doc.getForm().getFields()).toHaveLength(0);
  });
});
