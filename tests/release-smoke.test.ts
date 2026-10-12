import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { afterEach, describe, expect, it } from 'vitest';
import { exportPdf } from '../src/engine/PdfExporter';
import { createOpenDocument } from '../src/store/appStore';
import type { PageModel, TextEdit } from '../src/types/document';

let temporaryDirectory: string | undefined;
afterEach(async () => {
  if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
  temporaryDirectory = undefined;
});

describe('release PDF lifecycle smoke test', () => {
  it('loads a fixture, edits it, saves it, and reopens the exported file', async () => {
    const sourceBytes = new Uint8Array(await readFile('tests/fixtures/sample.pdf'));
    const sourcePdf = await PDFDocument.load(sourceBytes);
    const sourceId = 'release-smoke-source';
    const pages: PageModel[] = sourcePdf.getPages().map((page, index) => ({
      id: `page-${index}`,
      sourceId,
      sourcePageIndex: index,
      ...page.getSize(),
      rotation: page.getRotation().angle as PageModel['rotation'],
      label: `Page ${index + 1}`,
    }));
    const document = createOpenDocument('sample.pdf', null, sourceBytes, pages, sourceId);
    const edit: TextEdit = {
      id: 'release-smoke-edit', pageId: pages[0].id, type: 'text',
      x: 36, y: 48, width: 180, height: 24, rotation: 0, opacity: 1, createdAt: 1,
      text: 'Cross-platform save', fontFamily: 'Helvetica', fontSize: 14,
      color: '#172033', alignment: 'left',
    };
    document.edits.push(edit);

    const exported = await exportPdf(document);
    temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'openpdf-release-smoke-'));
    const savedPath = path.join(temporaryDirectory, 'edited output.PDF');
    await writeFile(savedPath, exported);
    const reopened = await PDFDocument.load(await readFile(savedPath));

    expect(reopened.getPageCount()).toBe(sourcePdf.getPageCount());
    expect(reopened.getPage(0).getSize()).toEqual(sourcePdf.getPage(0).getSize());
    expect(exported.byteLength).toBeGreaterThan(sourceBytes.byteLength);
  });
});
