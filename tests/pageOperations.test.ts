import { describe, expect, it } from 'vitest';
import { duplicatePage, insertBlankPage, parsePageRange, reorderPages, rotatePages } from '../src/engine/pageOperations';
import type { PageModel } from '../src/types/document';

const pages = ['a', 'b', 'c'].map((id, index): PageModel => ({
  id, sourceId: 'source', sourcePageIndex: index, width: 600, height: 800, rotation: 0, label: id,
}));

describe('page operations', () => {
  it('reorders without mutating the source array', () => {
    expect(reorderPages(pages, 0, 2).map((page) => page.id)).toEqual(['b', 'c', 'a']);
    expect(pages.map((page) => page.id)).toEqual(['a', 'b', 'c']);
  });

  it('duplicates the selected page after itself', () => {
    const result = duplicatePage(pages, 'b');
    expect(result).toHaveLength(4);
    expect(result[2].sourcePageIndex).toBe(1);
    expect(result[2].id).not.toBe('b');
  });

  it('inserts a source-free blank page', () => {
    const result = insertBlankPage(pages, 'a');
    expect(result[1]).toMatchObject({ sourceId: null, sourcePageIndex: null, width: 612, height: 792 });
  });

  it('normalizes rotations', () => {
    expect(rotatePages([{ ...pages[0], rotation: 270 }], ['a'], 90)[0].rotation).toBe(0);
    expect(rotatePages(pages, ['a'], -90)[0].rotation).toBe(270);
  });

  it('parses ranges, de-duplicates pages, and rejects invalid pages', () => {
    expect(parsePageRange('1-3, 3, 5', 5)).toEqual([0, 1, 2, 4]);
    expect(() => parsePageRange('0-2', 5)).toThrow();
    expect(() => parsePageRange('6', 5)).toThrow();
  });
});
