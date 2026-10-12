import { FileText, Plus, X } from 'lucide-react';
import { isDocumentDirty, useAppStore } from '../store/appStore';

interface Props { onOpen: () => void; onClose: (id: string) => void }

export function DocumentTabs({ onOpen, onClose }: Props) {
  const { documents, activeDocumentId, setActiveDocument } = useAppStore();
  return (
    <div className="document-tabs" role="tablist">
      {documents.map((document) => (
        <button
          type="button"
          role="tab"
          aria-selected={document.id === activeDocumentId}
          className={`document-tab ${document.id === activeDocumentId ? 'active' : ''}`}
          key={document.id}
          onClick={() => setActiveDocument(document.id)}
        >
          <FileText size={14} />
          <span className="tab-name">{document.name}</span>
          {isDocumentDirty(document) && <span className="dirty-dot" title="Unsaved changes" />}
          <span
            className="tab-close"
            role="button"
            tabIndex={0}
            aria-label={`Close ${document.name}`}
            onClick={(event) => { event.stopPropagation(); onClose(document.id); }}
            onKeyDown={(event) => event.key === 'Enter' && onClose(document.id)}
          ><X size={13} /></span>
        </button>
      ))}
      <button type="button" className="new-tab" onClick={onOpen} aria-label="Open PDF" title="Open PDF (⌘O)"><Plus size={16} /></button>
    </div>
  );
}
