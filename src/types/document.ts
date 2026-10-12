export type Tool =
  | 'select' | 'text' | 'image' | 'highlight' | 'underline' | 'rectangle'
  | 'ellipse' | 'line' | 'draw' | 'eraser' | 'signature' | 'redaction' | 'comment';

export type Color = `#${string}`;
export type Rotation = 0 | 90 | 180 | 270;

export interface PdfPoint { x: number; y: number }
export interface PdfRect extends PdfPoint { width: number; height: number }

export interface BaseEdit extends PdfRect {
  id: string;
  pageId: string;
  rotation: number;
  opacity: number;
  createdAt: number;
}

export interface TextEdit extends BaseEdit {
  type: 'text';
  text: string;
  fontFamily: 'Helvetica' | 'Times Roman' | 'Courier';
  fontSize: number;
  color: Color;
  alignment: 'left' | 'center' | 'right';
}

export interface ImageEdit extends BaseEdit {
  type: 'image';
  mimeType: 'image/png' | 'image/jpeg';
  dataUrl: string;
}

export interface ShapeEdit extends BaseEdit {
  type: 'rectangle' | 'ellipse' | 'line';
  strokeColor: Color;
  fillColor?: Color;
  strokeWidth: number;
}

export interface InkEdit extends BaseEdit {
  type: 'draw' | 'signature';
  points: PdfPoint[];
  color: Color;
  strokeWidth: number;
}

export interface MarkupEdit extends BaseEdit {
  type: 'highlight' | 'underline' | 'redaction';
  color: Color;
}

export interface CommentEdit extends BaseEdit {
  type: 'comment';
  text: string;
  author: string;
}

export type EditObject = TextEdit | ImageEdit | ShapeEdit | InkEdit | MarkupEdit | CommentEdit;

export interface PageModel {
  id: string;
  sourceId: string | null;
  sourcePageIndex: number | null;
  width: number;
  height: number;
  rotation: Rotation;
  label: string;
}

export interface FormValue {
  name: string;
  type: 'text' | 'checkbox' | 'radio' | 'choice';
  value: string | boolean;
}

export interface SourceDocument {
  id: string;
  name: string;
  bytes: Uint8Array;
}

export interface DocumentSnapshot {
  pages: PageModel[];
  edits: EditObject[];
  formValues: Record<string, FormValue>;
}

export interface OpenDocument extends DocumentSnapshot {
  id: string;
  name: string;
  path: string | null;
  sources: Record<string, SourceDocument>;
  savedSnapshot: string;
  undoStack: DocumentSnapshot[];
  redoStack: DocumentSnapshot[];
  selectedPageIds: string[];
  selectedObjectId: string | null;
  activePageId: string | null;
  password?: string;
}

export interface ExtractedTextItem {
  text: string;
  rect: PdfRect;
  fontName: string;
  direction: string;
}

export interface DetectedFormField {
  name: string;
  fieldType: string;
  rect: PdfRect;
  value: string | boolean;
  options?: string[];
}

export interface SearchMatch {
  pageId: string;
  pageIndex: number;
  excerpt: string;
}
