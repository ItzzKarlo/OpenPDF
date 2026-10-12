import { describe, expect, it } from 'vitest';
import { pdfRectToViewport, pdfToViewport, rotatedSize, viewportRectToPdf, viewportToPdf } from '../src/engine/coordinates';
import type { Rotation } from '../src/types/document';

describe('coordinate transforms', () => {
  for (const rotation of [0, 90, 180, 270] as Rotation[]) {
    for (const scale of [0.25, 1, 1.75, 4]) {
      it(`round-trips points at ${rotation}° and ${scale}x`, () => {
        const page = { width: 612, height: 792, rotation };
        const point = { x: 127.25, y: 618.75 };
        const result = viewportToPdf(pdfToViewport(point, page, scale), page, scale);
        expect(result.x).toBeCloseTo(point.x, 8);
        expect(result.y).toBeCloseTo(point.y, 8);
      });
    }
  }

  it('swaps page dimensions for quarter turns', () => {
    expect(rotatedSize({ width: 612, height: 792, rotation: 90 })).toEqual({ width: 792, height: 612 });
    expect(rotatedSize({ width: 612, height: 792, rotation: 180 })).toEqual({ width: 612, height: 792 });
  });

  it('round-trips rectangles', () => {
    const page = { width: 595, height: 842, rotation: 270 as const };
    const rect = { x: 30, y: 410, width: 182, height: 44 };
    const result = viewportRectToPdf(pdfRectToViewport(rect, page, 1.33), page, 1.33);
    expect(result.x).toBeCloseTo(rect.x);
    expect(result.y).toBeCloseTo(rect.y);
    expect(result.width).toBeCloseTo(rect.width);
    expect(result.height).toBeCloseTo(rect.height);
  });
});
