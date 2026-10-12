import {
  Download, FolderOpen, Moon, PanelLeftClose, PanelLeftOpen, PanelRightClose,
  PanelRightOpen, Save, Search, Sun, ZoomIn, ZoomOut,
} from 'lucide-react';
import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { primaryModifierLabel } from '../services/platform';
import type { SearchMatch } from '../types/document';
import { DocumentTabs } from './DocumentTabs';
import { IconButton } from './IconButton';

interface Props {
  onOpen: () => void;
  onClose: (id: string) => void;
  onSave: (as?: boolean) => void;
  onSearch: (query: string) => Promise<SearchMatch[]>;
  onNavigate: (pageId: string) => void;
}

export function TopBar({ onOpen, onClose, onSave, onSearch, onNavigate }: Props) {
  const store = useAppStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchMatch[]>([]);
  const active = store.documents.find((document) => document.id === store.activeDocumentId);
  const runSearch = async (value: string) => {
    setQuery(value);
    setResults(value.trim() ? await onSearch(value) : []);
  };
  return (
    <header className="topbar" data-tauri-drag-region>
      <div className="window-drag-space" data-tauri-drag-region />
      <DocumentTabs onOpen={onOpen} onClose={onClose} />
      <div className="top-actions">
        <IconButton icon={store.sidebarOpen ? PanelLeftClose : PanelLeftOpen} label="Toggle thumbnails" onClick={() => store.setPanel('sidebar', !store.sidebarOpen)} />
        <div className="zoom-control">
          <IconButton icon={ZoomOut} label="Zoom out" onClick={() => store.setZoom(store.zoom - 0.1)} />
          <button className="zoom-value" onClick={() => store.setFitMode('width')} title="Fit width">{Math.round(store.zoom * 100)}%</button>
          <IconButton icon={ZoomIn} label="Zoom in" onClick={() => store.setZoom(store.zoom + 0.1)} />
        </div>
        <select className="fit-select" value={store.fitMode} onChange={(event) => store.setFitMode(event.target.value as 'custom' | 'width' | 'page')} aria-label="Zoom mode">
          <option value="custom">Custom</option><option value="width">Fit width</option><option value="page">Fit page</option>
        </select>
        <div className="search-box">
          <Search size={15} />
          <input value={query} onChange={(event) => void runSearch(event.target.value)} placeholder="Find" aria-label="Find in document" />
          {query && <div className="search-results">
            <div className="search-count">{results.length} {results.length === 1 ? 'match' : 'matches'}</div>
            {results.map((result) => <button key={result.pageId} onClick={() => onNavigate(result.pageId)}><b>{result.pageIndex + 1}</b><span>{result.excerpt}</span></button>)}
          </div>}
        </div>
        <IconButton icon={FolderOpen} label="Open PDF" onClick={onOpen} />
        <IconButton icon={Save} label={`Save (${primaryModifierLabel()}S)`} disabled={!active} onClick={() => onSave(false)} />
        <IconButton icon={Download} label={`Save As (Shift+${primaryModifierLabel()}S)`} disabled={!active} onClick={() => onSave(true)} />
        <IconButton icon={store.inspectorOpen ? PanelRightClose : PanelRightOpen} label="Toggle inspector" onClick={() => store.setPanel('inspector', !store.inspectorOpen)} />
        <IconButton icon={store.theme === 'dark' ? Sun : Moon} label="Toggle appearance" onClick={() => store.setTheme(store.theme === 'dark' ? 'light' : 'dark')} />
      </div>
    </header>
  );
}
