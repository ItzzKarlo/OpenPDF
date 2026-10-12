import { create } from 'zustand';
import type { DocumentSnapshot, EditObject, OpenDocument, PageModel, Tool } from '../types/document';

const cloneSnapshot = (document: DocumentSnapshot): DocumentSnapshot => structuredClone({
  pages: document.pages,
  edits: document.edits,
  formValues: document.formValues,
});

export const snapshotKey = (document: DocumentSnapshot) => JSON.stringify({
  pages: document.pages,
  edits: document.edits,
  formValues: document.formValues,
});

interface AppState {
  documents: OpenDocument[];
  activeDocumentId: string | null;
  tool: Tool;
  zoom: number;
  fitMode: 'custom' | 'width' | 'page';
  sidebarOpen: boolean;
  inspectorOpen: boolean;
  sidebarWidth: number;
  inspectorWidth: number;
  theme: 'light' | 'dark' | 'system';
  addDocument: (document: OpenDocument) => void;
  closeDocument: (id: string) => void;
  setActiveDocument: (id: string) => void;
  updateDocument: (id: string, recipe: (document: OpenDocument) => void, recordHistory?: boolean) => void;
  mutateSnapshot: (id: string, recipe: (snapshot: DocumentSnapshot) => void) => void;
  undo: (id: string) => void;
  redo: (id: string) => void;
  markSaved: (id: string, path?: string | null, bytes?: Uint8Array) => void;
  setTool: (tool: Tool) => void;
  setZoom: (zoom: number) => void;
  setFitMode: (mode: 'custom' | 'width' | 'page') => void;
  setPanel: (panel: 'sidebar' | 'inspector', open: boolean) => void;
  setPanelWidth: (panel: 'sidebar' | 'inspector', width: number) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

const restore = (document: OpenDocument, snapshot: DocumentSnapshot) => {
  document.pages = structuredClone(snapshot.pages);
  document.edits = structuredClone(snapshot.edits);
  document.formValues = structuredClone(snapshot.formValues);
};

export const useAppStore = create<AppState>((set) => ({
  documents: [], activeDocumentId: null,
  tool: 'select', zoom: 1, fitMode: 'width',
  sidebarOpen: true, inspectorOpen: true,
  sidebarWidth: 190, inspectorWidth: 280,
  theme: 'system',
  addDocument: (document) => set((state) => ({
    documents: [...state.documents, document], activeDocumentId: document.id,
  })),
  closeDocument: (id) => set((state) => {
    const documents = state.documents.filter((document) => document.id !== id);
    const oldIndex = state.documents.findIndex((document) => document.id === id);
    return {
      documents,
      activeDocumentId: state.activeDocumentId === id
        ? documents[Math.min(oldIndex, documents.length - 1)]?.id ?? null
        : state.activeDocumentId,
    };
  }),
  setActiveDocument: (activeDocumentId) => set({ activeDocumentId }),
  updateDocument: (id, recipe) => set((state) => ({
    documents: state.documents.map((document) => {
      if (document.id !== id) return document;
      // Metadata changes (selection, active page, etc.) must not clone the PDF
      // byte sources. A cloned source retriggers every canvas render.
      const next = { ...document, sources: { ...document.sources } };
      recipe(next);
      return next;
    }),
  })),
  mutateSnapshot: (id, recipe) => set((state) => ({
    documents: state.documents.map((document) => {
      if (document.id !== id) return document;
      const next = structuredClone(document);
      next.sources = document.sources;
      next.undoStack.push(cloneSnapshot(document));
      if (next.undoStack.length > 100) next.undoStack.shift();
      next.redoStack = [];
      const editable = cloneSnapshot(next);
      recipe(editable);
      restore(next, editable);
      return next;
    }),
  })),
  undo: (id) => set((state) => ({
    documents: state.documents.map((document) => {
      if (document.id !== id || document.undoStack.length === 0) return document;
      const next = structuredClone(document);
      next.sources = document.sources;
      const previous = next.undoStack.pop()!;
      next.redoStack.push(cloneSnapshot(document));
      restore(next, previous);
      return next;
    }),
  })),
  redo: (id) => set((state) => ({
    documents: state.documents.map((document) => {
      if (document.id !== id || document.redoStack.length === 0) return document;
      const next = structuredClone(document);
      next.sources = document.sources;
      const following = next.redoStack.pop()!;
      next.undoStack.push(cloneSnapshot(document));
      restore(next, following);
      return next;
    }),
  })),
  markSaved: (id, path, bytes) => set((state) => ({
    documents: state.documents.map((document) => {
      if (document.id !== id) return document;
      const next = { ...document };
      if (path !== undefined) next.path = path;
      if (bytes) {
        const source = Object.values(next.sources)[0];
        if (source) next.sources = { ...next.sources, [source.id]: { ...source, bytes } };
      }
      next.savedSnapshot = snapshotKey(next);
      return next;
    }),
  })),
  setTool: (tool) => set({ tool }),
  setZoom: (zoom) => set({ zoom: Math.max(0.25, Math.min(4, zoom)), fitMode: 'custom' }),
  setFitMode: (fitMode) => set({ fitMode }),
  setPanel: (panel, open) => set(panel === 'sidebar' ? { sidebarOpen: open } : { inspectorOpen: open }),
  setPanelWidth: (panel, width) => set(panel === 'sidebar'
    ? { sidebarWidth: Math.max(150, Math.min(360, width)) }
    : { inspectorWidth: Math.max(230, Math.min(420, width)) }),
  setTheme: (theme) => set({ theme }),
}));

export const isDocumentDirty = (document: OpenDocument) => snapshotKey(document) !== document.savedSnapshot;

export function createOpenDocument(
  name: string,
  path: string | null,
  bytes: Uint8Array,
  pages: PageModel[],
  sourceId: string = crypto.randomUUID(),
): OpenDocument {
  const base: DocumentSnapshot = { pages, edits: [], formValues: {} };
  return {
    id: crypto.randomUUID(), name, path,
    sources: { [sourceId]: { id: sourceId, name, bytes } },
    ...base,
    savedSnapshot: snapshotKey(base),
    undoStack: [], redoStack: [],
    selectedPageIds: pages[0] ? [pages[0].id] : [],
    selectedObjectId: null, activePageId: pages[0]?.id ?? null,
  };
}

export function updateEdit(edits: EditObject[], id: string, values: Partial<EditObject>): EditObject[] {
  return edits.map((edit) => edit.id === id ? ({ ...edit, ...values } as EditObject) : edit);
}
