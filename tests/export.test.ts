import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { exportPageSelection, exportPdf } from '../src/engine/PdfExporter';
import { createOpenDocument } from '../src/store/appStore';
import type { TextEdit } from '../src/types/document';

async function sourcePdf() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const first = pdf.addPage([300, 400]); first.drawText('ORIGINAL SELECTABLE TEXT', { x: 30, y: 350, font, size: 14 });
  const second = pdf.addPage([500, 200]); second.drawRectangle({ x: 20, y: 20, width: 80, height: 50, color: rgb(0.2, 0.5, 0.8) });
  return pdf.save();
}

describe('PDF export integrity', () => {
  it('exports and reopens vector pages with added text', async () => {
    const bytes = await sourcePdf();
    const pages = [
      { id: 'p1', sourceId: 's', sourcePageIndex: 0, width: 300, height: 400, rotation: 0 as const, label: 'Page 1' },
      { id: 'p2', sourceId: 's', sourcePageIndex: 1, width: 500, height: 200, rotation: 0 as const, label: 'Page 2' },
    ];
    const document = createOpenDocument('source.pdf', null, bytes, pages, 's');
    const text: TextEdit = { id: 'e', pageId: 'p1', type: 'text', x: 30, y: 80, width: 180, height: 30, rotation: 0, opacity: 1, createdAt: 1, text: 'ADDED TEXT', fontFamily: 'Helvetica', fontSize: 18, color: '#2457d6', alignment: 'left' };
    document.edits.push(text);
    const exported = await exportPdf(document);
    const reopened = await PDFDocument.load(exported);
    expect(reopened.getPageCount()).toBe(2);
    expect(reopened.getPage(0).getSize()).toEqual({ width: 300, height: 400 });
    expect(exported.byteLength).toBeGreaterThan(500);
  });

  it('preserves requested order, duplicate sources, and split selection', async () => {
    const bytes = await sourcePdf();
    const pages = [
      { id: 'p2', sourceId: 's', sourcePageIndex: 1, width: 500, height: 200, rotation: 0 as const, label: 'Page 2' },
      { id: 'p1', sourceId: 's', sourcePageIndex: 0, width: 300, height: 400, rotation: 0 as const, label: 'Page 1' },
      { id: 'copy', sourceId: 's', sourcePageIndex: 0, width: 300, height: 400, rotation: 90 as const, label: 'Copy' },
    ];
    const document = createOpenDocument('source.pdf', null, bytes, pages, 's');
    const exported = await PDFDocument.load(await exportPdf(document));
    expect(exported.getPages().map((page) => page.getSize())).toEqual([
      { width: 500, height: 200 }, { width: 300, height: 400 }, { width: 300, height: 400 },
    ]);
    expect(exported.getPage(2).getRotation().angle).toBe(90);
    const split = await PDFDocument.load(await exportPageSelection(document, [1, 2]));
    expect(split.getPageCount()).toBe(2);
  });

  it('does not reintroduce a deleted trailing page and applies rotation on the fast path', async () => {
    const bytes = await sourcePdf();
    const allPages = [
      { id: 'p1', sourceId: 's', sourcePageIndex: 0, width: 300, height: 400, rotation: 90 as const, label: 'Page 1' },
      { id: 'p2', sourceId: 's', sourcePageIndex: 1, width: 500, height: 200, rotation: 0 as const, label: 'Page 2' },
    ];
    const rotated = createOpenDocument('source.pdf', null, bytes, allPages, 's');
    const direct = await PDFDocument.load(await exportPdf(rotated));
    expect(direct.getPage(0).getRotation().angle).toBe(90);

    const deleted = createOpenDocument('source.pdf', null, bytes, allPages.slice(0, 1), 's');
    const rebuilt = await PDFDocument.load(await exportPdf(deleted));
    expect(rebuilt.getPageCount()).toBe(1);
  });
});
