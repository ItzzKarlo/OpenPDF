import type { ExtractedTextItem } from '../types/document';

/**
 * Boundary for true source-content editing. PDF.js provides extraction only.
 * A future MuPDF/PDFium adapter may implement operator/resource replacement.
 */
export interface DocumentContentEngine {
  readonly capabilities: {
    extractText: boolean;
    editExistingText: boolean;
    editExistingImages: boolean;
    secureRedaction: boolean;
  };
  extractText(source: Uint8Array, pageIndex: number, password?: string): Promise<ExtractedTextItem[]>;
  replaceText?(source: Uint8Array, operation: unknown): Promise<Uint8Array>;
  replaceImage?(source: Uint8Array, operation: unknown): Promise<Uint8Array>;
  redactContent?(source: Uint8Array, operation: unknown): Promise<Uint8Array>;
}
