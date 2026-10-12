import type { PageModel, Rotation } from '../types/document';
import { normalizeRotation } from './coordinates';

export const makeId = () => crypto.randomUUID();

export function reorderPages(pages: PageModel[], from: number, to: number): PageModel[] {
  if (from === to || from < 0 || to < 0 || from >= pages.length || to >= pages.length) return pages;
  const next = [...pages];
  const [page] = next.splice(from, 1);
  next.splice(to, 0, page);
  return next;
}

export function duplicatePage(pages: PageModel[], id: string): PageModel[] {
  const index = pages.findIndex((page) => page.id === id);
  if (index < 0) return pages;
  const copy = { ...pages[index], id: makeId(), label: `${pages[index].label} copy` };
  return [...pages.slice(0, index + 1), copy, ...pages.slice(index + 1)];
}

export function rotatePages(pages: PageModel[], ids: string[], degrees: 90 | -90): PageModel[] {
  const selected = new Set(ids);
  return pages.map((page) => selected.has(page.id)
    ? { ...page, rotation: normalizeRotation(page.rotation + degrees) as Rotation }
    : page);
}

export function insertBlankPage(pages: PageModel[], afterId?: string, size = { width: 612, height: 792 }): PageModel[] {
  const index = afterId ? pages.findIndex((page) => page.id === afterId) + 1 : pages.length;
  const page: PageModel = {
    id: makeId(), sourceId: null, sourcePageIndex: null,
    width: size.width, height: size.height, rotation: 0, label: 'Blank page',
  };
  return [...pages.slice(0, index), page, ...pages.slice(index)];
}

export function parsePageRange(input: string, pageCount: number): number[] {
  const values = new Set<number>();
  for (const token of input.split(',').map((part) => part.trim()).filter(Boolean)) {
    const match = token.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw new Error(`Invalid page range: ${token}`);
    const start = Number(match[1]);
    const end = Number(match[2] ?? match[1]);
    if (start < 1 || end < 1 || start > pageCount || end > pageCount || start > end) {
      throw new Error(`Page range is outside 1–${pageCount}: ${token}`);
    }
    for (let page = start; page <= end; page += 1) values.add(page - 1);
  }
  return [...values];
}
