import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist/types/src/display/api';
import type { DetectedFormField, ExtractedTextItem, PageModel, SearchMatch, SourceDocument } from '../types/document';
import type { DocumentContentEngine } from './DocumentContentEngine';
import { makeId } from './pageOperations';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

interface CachedDocument { fingerprint: string; document: PDFDocumentProxy }

class PdfJsAdapter implements DocumentContentEngine {
  readonly capabilities = {
    extractText: true,
    editExistingText: false,
    editExistingImages: false,
    secureRedaction: false,
  } as const;

  private cache = new Map<string, CachedDocument>();
  private renderTasks = new WeakMap<HTMLCanvasElement, RenderTask>();
  private renderQueues = new WeakMap<HTMLCanvasElement, Promise<void>>();
  private renderVersions = new WeakMap<HTMLCanvasElement, number>();

  async open(source: SourceDocument, password?: string): Promise<PDFDocumentProxy> {
    const fingerprint = `${source.bytes.byteLength}:${password ?? ''}`;
    const cached = this.cache.get(source.id);
    if (cached?.fingerprint === fingerprint) return cached.document;
    if (cached) await cached.document.cleanup();

    const task = pdfjs.getDocument({
      data: source.bytes.slice(),
      password,
      useWorkerFetch: false,
      stopAtErrors: false,
      verbosity: 0,
    });
    const document = await task.promise;
    this.cache.set(source.id, { fingerprint, document });
    return document;
  }

  async inspect(source: SourceDocument, password?: string): Promise<PageModel[]> {
    const document = await this.open(source, password);
    const pages: PageModel[] = [];
    for (let index = 0; index < document.numPages; index += 1) {
      const page = await document.getPage(index + 1);
      const viewport = page.getViewport({ scale: 1, rotation: 0 });
      pages.push({
        id: makeId(), sourceId: source.id, sourcePageIndex: index,
        width: viewport.width, height: viewport.height,
        rotation: (((page.rotate % 360) + 360) % 360) as 0 | 90 | 180 | 270,
        label: `Page ${index + 1}`,
      });
      page.cleanup();
    }
    return pages;
  }

  async getPage(source: SourceDocument, pageIndex: number, password?: string): Promise<PDFPageProxy> {
    return (await this.open(source, password)).getPage(pageIndex + 1);
  }

  async renderPage(
    source: SourceDocument,
    pageIndex: number,
    canvas: HTMLCanvasElement,
    scale: number,
    rotation: number,
    password?: string,
  ): Promise<void> {
    const version = (this.renderVersions.get(canvas) ?? 0) + 1;
    this.renderVersions.set(canvas, version);
    this.renderTasks.get(canvas)?.cancel();
    const previous = this.renderQueues.get(canvas) ?? Promise.resolve();
    const queued = previous.catch(() => undefined).then(async () => {
      if (this.renderVersions.get(canvas) !== version) return;
      await this.renderPageNow(source, pageIndex, canvas, scale, rotation, password);
    });
    this.renderQueues.set(canvas, queued);
    try {
      await queued;
    } finally {
      if (this.renderQueues.get(canvas) === queued) this.renderQueues.delete(canvas);
    }
  }

  private async renderPageNow(
    source: SourceDocument,
    pageIndex: number,
    canvas: HTMLCanvasElement,
    scale: number,
    rotation: number,
    password?: string,
  ): Promise<void> {
    const page = await this.getPage(source, pageIndex, password);
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2.5);
    const viewport = page.getViewport({ scale, rotation });
    canvas.width = Math.floor(viewport.width * pixelRatio);
    canvas.height = Math.floor(viewport.height * pixelRatio);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Canvas rendering is unavailable');
    const task = page.render({
      canvas,
      canvasContext: context,
      viewport,
      transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0],
      intent: 'display',
    });
    this.renderTasks.set(canvas, task);
    try {
      await task.promise;
    } catch (error) {
      if (!(error instanceof pdfjs.RenderingCancelledException)) throw error;
    } finally {
      if (this.renderTasks.get(canvas) === task) this.renderTasks.delete(canvas);
    }
  }

  async renderThumbnail(source: SourceDocument, pageIndex: number, canvas: HTMLCanvasElement, password?: string) {
    const page = await this.getPage(source, pageIndex, password);
    const base = page.getViewport({ scale: 1 });
    const scale = 132 / base.width;
    await this.renderPage(source, pageIndex, canvas, scale, page.rotate, password);
  }

  async extractText(sourceBytes: Uint8Array, pageIndex: number, password?: string): Promise<ExtractedTextItem[]> {
    const temp: SourceDocument = { id: `extract-${sourceBytes.byteLength}`, name: 'source', bytes: sourceBytes };
    const page = await this.getPage(temp, pageIndex, password);
    return this.extractTextFromPage(page);
  }

  async extractTextFromPage(page: PDFPageProxy): Promise<ExtractedTextItem[]> {
    const content = await page.getTextContent();
    return content.items.flatMap((item) => {
      if (!('str' in item)) return [];
      const [, , , d, tx, ty] = item.transform;
      const height = Math.abs(d) || item.height;
      return [{
        text: item.str,
        rect: { x: tx, y: ty - height * 0.2, width: item.width, height },
        fontName: item.fontName,
        direction: item.dir,
      }];
    });
  }

  async find(source: SourceDocument, pages: PageModel[], query: string, password?: string): Promise<SearchMatch[]> {
    if (!query.trim()) return [];
    const needle = query.toLocaleLowerCase();
    const matches: SearchMatch[] = [];
    for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
      const model = pages[pageIndex];
      if (model.sourceId !== source.id || model.sourcePageIndex == null) continue;
      const items = await this.extractTextFromPage(await this.getPage(source, model.sourcePageIndex, password));
      const text = items.map((item) => item.text).join(' ');
      const index = text.toLocaleLowerCase().indexOf(needle);
      if (index >= 0) {
        matches.push({ pageId: model.id, pageIndex, excerpt: text.slice(Math.max(0, index - 30), index + query.length + 45) });
      }
    }
    return matches;
  }

  async getFormFields(source: SourceDocument, pageIndex: number, password?: string): Promise<DetectedFormField[]> {
    const page = await this.getPage(source, pageIndex, password);
    const annotations = await page.getAnnotations({ intent: 'display' });
    return annotations.flatMap((annotation: any) => {
      if (!annotation.fieldName || !annotation.rect) return [];
      const [x1, y1, x2, y2] = annotation.rect as number[];
      const fieldType = annotation.fieldType === 'Tx' ? 'text'
        : annotation.fieldType === 'Btn' ? (annotation.radioButton ? 'radio' : 'checkbox')
        : annotation.fieldType === 'Ch' ? 'choice' : annotation.fieldType;
      return [{
        name: annotation.fieldName,
        fieldType,
        rect: { x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) },
        value: annotation.fieldValue ?? false,
        options: annotation.options?.map((option: any) => option.displayValue ?? option.exportValue),
      }];
    });
  }

  async close(sourceId: string) {
    const cached = this.cache.get(sourceId);
    if (cached) await cached.document.cleanup();
    this.cache.delete(sourceId);
  }
}

export const pdfJsAdapter = new PdfJsAdapter();
