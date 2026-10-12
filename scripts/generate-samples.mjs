import { mkdir, writeFile } from 'node:fs/promises';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

await mkdir(new URL('../tests/fixtures/', import.meta.url), { recursive: true });

const basic = await PDFDocument.create();
const font = await basic.embedFont(StandardFonts.Helvetica);
for (let index = 0; index < 3; index += 1) {
  const page = basic.addPage(index === 1 ? [792, 612] : [612, 792]);
  page.drawText(`OpenPDF sample page ${index + 1}`, { x: 64, y: page.getHeight() - 90, size: 24, font, color: rgb(0.12, 0.2, 0.35) });
  page.drawText('Selectable source text for search and export tests.', { x: 64, y: page.getHeight() - 130, size: 12, font });
}
await writeFile(new URL('../tests/fixtures/sample.pdf', import.meta.url), await basic.save());

const formPdf = await PDFDocument.create();
const page = formPdf.addPage([612, 792]);
page.drawText('Form sample', { x: 60, y: 720, size: 22, font: await formPdf.embedFont(StandardFonts.Helvetica) });
const form = formPdf.getForm();
form.createTextField('full_name').addToPage(page, { x: 60, y: 650, width: 240, height: 28 });
form.createCheckBox('approved').addToPage(page, { x: 60, y: 600, width: 18, height: 18 });
await writeFile(new URL('../tests/fixtures/form.pdf', import.meta.url), await formPdf.save());

console.log('Generated tests/fixtures/sample.pdf and form.pdf');
