import { Copy, FileOutput, Merge, Plus, RotateCw, Scissors, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { pdfJsAdapter } from '../engine/PdfJsAdapter';
import { duplicatePage, insertBlankPage, reorderPages, rotatePages } from '../engine/pageOperations';
import { useAppStore } from '../store/appStore';
import type { OpenDocument, PageModel } from '../types/document';
import { IconButton } from './IconButton';

function Thumbnail({ document, page, index }: { document: OpenDocument; page: PageModel; index: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const source = page.sourceId ? document.sources[page.sourceId] : null;
    if (!canvas || !source || page.sourcePageIndex == null) return;
    void pdfJsAdapter.renderThumbnail(source, page.sourcePageIndex, canvas, document.password);
  }, [document.password, document.sources, page]);
  return <div className="thumbnail-paper">{page.sourceId ? <canvas ref={canvasRef} /> : <div className="blank-thumbnail" />}<span>{index + 1}</span></div>;
}

interface Props {
  onMerge: () => void;
  onExtract: () => void;
  onSplit: () => void;
  onNavigate: (pageId: string) => void;
}

export function Sidebar({ onMerge, onExtract, onSplit, onNavigate }: Props) {
  const { documents, activeDocumentId, mutateSnapshot, updateDocument } = useAppStore();
  const document = documents.find((item) => item.id === activeDocumentId);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  if (!document) return <aside className="sidebar" />;
  const selected = new Set(document.selectedPageIds);
  const choosePage = (page: PageModel, additive: boolean) => {
    updateDocument(document.id, (next) => {
      next.activePageId = page.id;
      next.selectedPageIds = additive
        ? (next.selectedPageIds.includes(page.id) ? next.selectedPageIds.filter((id) => id !== page.id) : [...next.selectedPageIds, page.id])
        : [page.id];
    });
    onNavigate(page.id);
  };
  return (
    <aside className="sidebar">
      <div className="panel-heading"><span>Pages</span><span>{document.pages.length}</span></div>
      <div className="page-actions">
        <IconButton icon={Plus} label="Insert blank page" onClick={() => mutateSnapshot(document.id, (snapshot) => { snapshot.pages = insertBlankPage(snapshot.pages, document.activePageId ?? undefined); })} />
        <IconButton icon={Copy} label="Duplicate page" disabled={!document.activePageId} onClick={() => mutateSnapshot(document.id, (snapshot) => { snapshot.pages = duplicatePage(snapshot.pages, document.activePageId!); })} />
        <IconButton icon={RotateCw} label="Rotate selected pages" disabled={!document.selectedPageIds.length} onClick={() => mutateSnapshot(document.id, (snapshot) => { snapshot.pages = rotatePages(snapshot.pages, document.selectedPageIds, 90); })} />
        <IconButton icon={Trash2} label="Delete selected pages" disabled={!document.selectedPageIds.length || document.pages.length === document.selectedPageIds.length} onClick={() => {
          const removed = new Set(document.selectedPageIds);
          const remaining = document.pages.filter((page) => !removed.has(page.id));
          mutateSnapshot(document.id, (snapshot) => {
            snapshot.pages = snapshot.pages.filter((page) => !removed.has(page.id));
            snapshot.edits = snapshot.edits.filter((edit) => !removed.has(edit.pageId));
          });
          updateDocument(document.id, (next) => {
            next.activePageId = remaining[0]?.id ?? null;
            next.selectedPageIds = remaining[0] ? [remaining[0].id] : [];
            next.selectedObjectId = null;
          });
        }} />
      </div>
      <div className="thumbnail-list">
        {document.pages.map((page, index) => (
          <button
            type="button"
            key={page.id}
            className={`thumbnail-item ${selected.has(page.id) ? 'selected' : ''}`}
            draggable
            onClick={(event) => choosePage(page, event.metaKey || event.ctrlKey || event.shiftKey)}
            onDragStart={() => setDragIndex(index)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (dragIndex != null) mutateSnapshot(document.id, (snapshot) => { snapshot.pages = reorderPages(snapshot.pages, dragIndex, index); });
              setDragIndex(null);
            }}
          >
            <Thumbnail document={document} page={page} index={index} />
          </button>
        ))}
      </div>
      <div className="sidebar-footer">
        <button onClick={onMerge}><Merge size={15} />Merge</button>
        <button onClick={onExtract}><FileOutput size={15} />Extract</button>
        <button onClick={onSplit}><Scissors size={15} />Split</button>
      </div>
    </aside>
  );
}
