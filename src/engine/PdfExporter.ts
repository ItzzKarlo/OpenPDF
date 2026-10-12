import {
  PDFDocument, StandardFonts, degrees, rgb, type PDFPage, type PDFFont,
} from 'pdf-lib';
import type { Color, DocumentSnapshot, EditObject, FormValue, OpenDocument, PageModel, SourceDocument } from '../types/document';

const parseColor = (hex: Color) => {
  const value = hex.replace('#', '').padEnd(6, '0');
  return rgb(
    Number.parseInt(value.slice(0, 2), 16) / 255,
    Number.parseInt(value.slice(2, 4), 16) / 255,
    Number.parseInt(value.slice(4, 6), 16) / 255,
  );
};

const fromDataUrl = (dataUrl: string) => Uint8Array.from(atob(dataUrl.split(',')[1]), (char) => char.charCodeAt(0));

async function applyForms(pdf: PDFDocument, values: Record<string, FormValue>) {
  const form = pdf.getForm();
  for (const field of Object.values(values)) {
    try {
      if (field.type === 'text') form.getTextField(field.name).setText(String(field.value));
      else if (field.type === 'checkbox') {
        if (field.value) form.getCheckBox(field.name).check();
        else form.getCheckBox(field.name).uncheck();
      }
      else if (field.type === 'radio') form.getRadioGroup(field.name).select(String(field.value));
      else if (field.type === 'choice') form.getDropdown(field.name).select(String(field.value));
    } catch {
      // Some malformed PDFs advertise fields not represented in the AcroForm tree.
    }
  }
  try { form.updateFieldAppearances(); } catch { /* preserve readable source appearance */ }
}

async function drawEdit(pdf: PDFDocument, page: PDFPage, edit: EditObject, fonts: Record<string, PDFFont>) {
  const opacity = Math.max(0, Math.min(1, edit.opacity));
  if (edit.type === 'text') {
    const font = fonts[edit.fontFamily];
    const width = font.widthOfTextAtSize(edit.text, edit.fontSize);
    const x = edit.alignment === 'center' ? edit.x + (edit.width - width) / 2
      : edit.alignment === 'right' ? edit.x + edit.width - width : edit.x;
    page.drawText(edit.text, {
      x, y: edit.y + Math.max(0, edit.height - edit.fontSize),
      size: edit.fontSize, font, color: parseColor(edit.color), opacity,
      rotate: degrees(edit.rotation), maxWidth: edit.width,
    });
  } else if (edit.type === 'image') {
    const bytes = fromDataUrl(edit.dataUrl);
    const image = edit.mimeType === 'image/png' ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
    page.drawImage(image, { x: edit.x, y: edit.y, width: edit.width, height: edit.height, opacity, rotate: degrees(edit.rotation) });
  } else if (edit.type === 'rectangle') {
    page.drawRectangle({
      x: edit.x, y: edit.y, width: edit.width, height: edit.height,
      borderColor: parseColor(edit.strokeColor), borderWidth: edit.strokeWidth,
      color: edit.fillColor ? parseColor(edit.fillColor) : undefined, opacity,
    });
  } else if (edit.type === 'ellipse') {
    page.drawEllipse({
      x: edit.x + edit.width / 2, y: edit.y + edit.height / 2,
      xScale: edit.width / 2, yScale: edit.height / 2,
      borderColor: parseColor(edit.strokeColor), borderWidth: edit.strokeWidth,
      color: edit.fillColor ? parseColor(edit.fillColor) : undefined, opacity,
    });
  } else if (edit.type === 'line') {
    page.drawLine({
      start: { x: edit.x, y: edit.y }, end: { x: edit.x + edit.width, y: edit.y + edit.height },
      color: parseColor(edit.strokeColor), thickness: edit.strokeWidth, opacity,
    });
  } else if (edit.type === 'draw' || edit.type === 'signature') {
    for (let index = 1; index < edit.points.length; index += 1) {
      page.drawLine({
        start: edit.points[index - 1], end: edit.points[index],
        color: parseColor(edit.color), thickness: edit.strokeWidth, opacity,
      });
    }
  } else if (edit.type === 'highlight') {
    page.drawRectangle({ x: edit.x, y: edit.y, width: edit.width, height: edit.height, color: parseColor(edit.color), opacity: 0.3 });
  } else if (edit.type === 'underline') {
    page.drawLine({ start: { x: edit.x, y: edit.y }, end: { x: edit.x + edit.width, y: edit.y }, color: parseColor(edit.color), thickness: 1.5, opacity });
  } else if (edit.type === 'redaction') {
    // This is intentionally only a visual overlay; secure source removal requires a native content engine.
    page.drawRectangle({ x: edit.x, y: edit.y, width: edit.width, height: edit.height, color: rgb(0, 0, 0), opacity: 1 });
  } else if (edit.type === 'comment') {
    page.drawRectangle({ x: edit.x, y: edit.y, width: 18, height: 18, color: rgb(1, 0.78, 0.12), opacity });
    page.drawText('i', { x: edit.x + 7, y: edit.y + 4, size: 10, font: fonts.Helvetica, color: rgb(0.2, 0.15, 0) });
  }
}

async function buildPages(pdf: PDFDocument, pages: PageModel[], sources: Record<string, SourceDocument>) {
  const sourceDocs = new Map<string, PDFDocument>();
  for (const source of Object.values(sources)) {
    sourceDocs.set(source.id, await PDFDocument.load(source.bytes, { updateMetadata: false }));
  }
  for (const pageModel of pages) {
    let page: PDFPage;
    if (pageModel.sourceId && pageModel.sourcePageIndex != null) {
      const source = sourceDocs.get(pageModel.sourceId);
      if (!source) throw new Error(`Missing page source ${pageModel.sourceId}`);
      [page] = await pdf.copyPages(source, [pageModel.sourcePageIndex]);
      pdf.addPage(page);
    } else {
      page = pdf.addPage([pageModel.width, pageModel.height]);
    }
    page.setRotation(degrees(pageModel.rotation));
  }
}

function canEditOriginalDirectly(document: OpenDocument, pages: PageModel[], sourcePageCount: number) {
  const sources = Object.values(document.sources);
  return sources.length === 1 && pages.length === sourcePageCount && pages.length > 0 && pages.every((page, index) =>
    page.sourceId === sources[0].id && page.sourcePageIndex === index);
}

export async function exportPdf(document: OpenDocument, snapshot: DocumentSnapshot = document): Promise<Uint8Array> {
  const source = Object.values(document.sources)[0];
  const originalPdf = source ? await PDFDocument.load(source.bytes, { updateMetadata: false }) : null;
  const direct = originalPdf && canEditOriginalDirectly(document, snapshot.pages, originalPdf.getPageCount());
  const pdf = direct
    ? originalPdf
    : await PDFDocument.create();

  if (!direct) await buildPages(pdf, snapshot.pages, document.sources);
  else snapshot.pages.forEach((page, index) => pdf.getPage(index).setRotation(degrees(page.rotation)));
  await applyForms(pdf, snapshot.formValues);
  const fonts = {
    Helvetica: await pdf.embedFont(StandardFonts.Helvetica),
    'Times Roman': await pdf.embedFont(StandardFonts.TimesRoman),
    Courier: await pdf.embedFont(StandardFonts.Courier),
  };
  for (const edit of snapshot.edits) {
    const pageIndex = snapshot.pages.findIndex((page) => page.id === edit.pageId);
    if (pageIndex >= 0) await drawEdit(pdf, pdf.getPage(pageIndex), edit, fonts);
  }
  pdf.setProducer('OpenPDF');
  pdf.setModificationDate(new Date());
  return pdf.save({ useObjectStreams: true, addDefaultPage: false });
}

export async function exportPageSelection(document: OpenDocument, pageIndices: number[]): Promise<Uint8Array> {
  const pageIds = new Set(pageIndices.map((index) => document.pages[index]?.id).filter(Boolean));
  const snapshot: DocumentSnapshot = {
    pages: pageIndices.map((index) => document.pages[index]).filter(Boolean),
    edits: document.edits.filter((edit) => pageIds.has(edit.pageId)),
    formValues: {},
  };
  return exportPdf(document, snapshot);
}
