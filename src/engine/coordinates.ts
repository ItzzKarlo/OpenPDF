import type { PdfPoint, PdfRect, Rotation } from '../types/document';

export interface PageGeometry { width: number; height: number; rotation: Rotation }

export function rotatedSize(page: PageGeometry) {
  return page.rotation % 180 === 0
    ? { width: page.width, height: page.height }
    : { width: page.height, height: page.width };
}

/** Convert PDF points (bottom-left origin, unrotated page) to viewport CSS points. */
export function pdfToViewport(point: PdfPoint, page: PageGeometry, scale = 1): PdfPoint {
  const { x, y } = point;
  switch (page.rotation) {
    case 90: return { x: y * scale, y: x * scale };
    case 180: return { x: (page.width - x) * scale, y: y * scale };
    case 270: return { x: (page.height - y) * scale, y: (page.width - x) * scale };
    default: return { x: x * scale, y: (page.height - y) * scale };
  }
}

/** Convert viewport CSS points to PDF points, independent of zoom and devicePixelRatio. */
export function viewportToPdf(point: PdfPoint, page: PageGeometry, scale = 1): PdfPoint {
  const x = point.x / scale;
  const y = point.y / scale;
  switch (page.rotation) {
    case 90: return { x: y, y: x };
    case 180: return { x: page.width - x, y };
    case 270: return { x: page.width - y, y: page.height - x };
    default: return { x, y: page.height - y };
  }
}

export function pdfRectToViewport(rect: PdfRect, page: PageGeometry, scale = 1): PdfRect {
  const corners = [
    pdfToViewport({ x: rect.x, y: rect.y }, page, scale),
    pdfToViewport({ x: rect.x + rect.width, y: rect.y + rect.height }, page, scale),
  ];
  return {
    x: Math.min(corners[0].x, corners[1].x),
    y: Math.min(corners[0].y, corners[1].y),
    width: Math.abs(corners[1].x - corners[0].x),
    height: Math.abs(corners[1].y - corners[0].y),
  };
}

export function viewportRectToPdf(rect: PdfRect, page: PageGeometry, scale = 1): PdfRect {
  const corners = [
    viewportToPdf({ x: rect.x, y: rect.y }, page, scale),
    viewportToPdf({ x: rect.x + rect.width, y: rect.y + rect.height }, page, scale),
  ];
  return {
    x: Math.min(corners[0].x, corners[1].x),
    y: Math.min(corners[0].y, corners[1].y),
    width: Math.abs(corners[1].x - corners[0].x),
    height: Math.abs(corners[1].y - corners[0].y),
  };
}

export function normalizeRotation(value: number): Rotation {
  return ((((value % 360) + 360) % 360) as Rotation);
}
