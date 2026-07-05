import {
  PDFDocument,
  PDFTextField,
  PDFCheckBox,
  PDFRadioGroup,
  PDFDropdown,
  PDFOptionList,
} from 'pdf-lib';

export type FieldType = 'text' | 'checkbox' | 'radio' | 'dropdown' | 'optionlist';

export interface FieldInfo {
  readonly name: string;
  readonly type: FieldType;
  readonly options?: string[];
  readonly value: string | boolean;
}

export type FormValues = Record<string, string | boolean>;

/** Read the AcroForm fields (name, type, options, current value) from a PDF. */
export async function detectFields(bytes: Uint8Array): Promise<FieldInfo[]> {
  const doc = await PDFDocument.load(bytes);
  const form = doc.getForm();
  return form.getFields().map((f): FieldInfo => {
    const name = f.getName();
    if (f instanceof PDFTextField) return { name, type: 'text', value: f.getText() ?? '' };
    if (f instanceof PDFCheckBox) return { name, type: 'checkbox', value: f.isChecked() };
    if (f instanceof PDFRadioGroup) return { name, type: 'radio', options: f.getOptions(), value: f.getSelected() ?? '' };
    if (f instanceof PDFDropdown) return { name, type: 'dropdown', options: f.getOptions(), value: f.getSelected()[0] ?? '' };
    if (f instanceof PDFOptionList) return { name, type: 'optionlist', options: f.getOptions(), value: f.getSelected()[0] ?? '' };
    return { name, type: 'text', value: '' };
  });
}

/**
 * Fill the form fields with the given values and optionally flatten. Flattening
 * bakes the values into page content so the page-model export (which copies page
 * content) preserves them even without the interactive AcroForm.
 */
export async function fillForm(bytes: Uint8Array, values: FormValues, flatten: boolean): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes);
  const form = doc.getForm();
  for (const field of form.getFields()) {
    const name = field.getName();
    if (!(name in values)) continue;
    const val = values[name];
    if (field instanceof PDFTextField) field.setText(val == null ? '' : String(val));
    else if (field instanceof PDFCheckBox) (val ? field.check() : field.uncheck());
    else if (field instanceof PDFRadioGroup && val) field.select(String(val));
    else if (field instanceof PDFDropdown && val) field.select(String(val));
    else if (field instanceof PDFOptionList && val) field.select(String(val));
  }
  if (flatten) form.flatten();
  return doc.save();
}
