import { beforeEach, describe, expect, it } from 'vitest';
import { createOpenDocument, isDocumentDirty, useAppStore } from '../src/store/appStore';
import type { TextEdit } from '../src/types/document';

const page = { id: 'page', sourceId: 'source', sourcePageIndex: 0, width: 600, height: 800, rotation: 0 as const, label: 'Page 1' };

describe('document history and save state', () => {
  beforeEach(() => useAppStore.setState({ documents: [], activeDocumentId: null }));

  it('undoes and redoes a structured edit', () => {
    const document = createOpenDocument('sample.pdf', null, new Uint8Array([1]), [page], 'source');
    useAppStore.getState().addDocument(document);
    const edit: TextEdit = {
      id: 'text', pageId: 'page', type: 'text', x: 20, y: 40, width: 100, height: 30,
      rotation: 0, opacity: 1, createdAt: 1, text: 'Hello', fontFamily: 'Helvetica',
      fontSize: 14, color: '#000000', alignment: 'left',
    };
    useAppStore.getState().mutateSnapshot(document.id, (snapshot) => snapshot.edits.push(edit));
    expect(useAppStore.getState().documents[0].edits).toHaveLength(1);
    expect(isDocumentDirty(useAppStore.getState().documents[0])).toBe(true);
    useAppStore.getState().undo(document.id);
    expect(useAppStore.getState().documents[0].edits).toHaveLength(0);
    useAppStore.getState().redo(document.id);
    expect(useAppStore.getState().documents[0].edits[0]).toMatchObject({ text: 'Hello' });
  });

  it('transitions back to saved after marking the current snapshot', () => {
    const document = createOpenDocument('sample.pdf', null, new Uint8Array([1]), [page], 'source');
    useAppStore.getState().addDocument(document);
    useAppStore.getState().mutateSnapshot(document.id, (snapshot) => { snapshot.pages[0].rotation = 90; });
    expect(isDocumentDirty(useAppStore.getState().documents[0])).toBe(true);
    useAppStore.getState().markSaved(document.id, '/tmp/sample.pdf');
    expect(isDocumentDirty(useAppStore.getState().documents[0])).toBe(false);
    expect(useAppStore.getState().documents[0].path).toBe('/tmp/sample.pdf');
  });
});
