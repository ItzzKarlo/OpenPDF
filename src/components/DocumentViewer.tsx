import { useCallback, useEffect, useRef, useState } from 'react';
import { rotatedSize } from '../engine/coordinates';
import { useAppStore } from '../store/appStore';
import type { OpenDocument } from '../types/document';
import { PageCanvas } from './PageCanvas';

export function DocumentViewer({ document }: { document: OpenDocument }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState({ width: 900, height: 700 });
  const { zoom, fitMode, updateDocument } = useAppStore();
  useEffect(() => {
    const root = rootRef.current; if (!root) return;
    const observer = new ResizeObserver(([entry]) => setBounds({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(root); return () => observer.disconnect();
  }, []);
  const visible = useCallback((pageId: string) => {
    updateDocument(document.id, (next) => { next.activePageId = pageId; });
  }, [document.id, updateDocument]);
  return (
    <main className="document-viewer" ref={rootRef} tabIndex={0}>
      <div className="page-stack">
        {document.pages.map((page) => {
          const size = rotatedSize(page);
          const scale = fitMode === 'width' ? Math.max(0.25, Math.min(3, (bounds.width - 80) / size.width))
            : fitMode === 'page' ? Math.max(0.2, Math.min((bounds.width - 80) / size.width, (bounds.height - 70) / size.height))
            : zoom;
          return <PageCanvas key={page.id} document={document} page={page} scale={scale} active={document.activePageId === page.id} onVisible={() => visible(page.id)} />;
        })}
      </div>
    </main>
  );
}
