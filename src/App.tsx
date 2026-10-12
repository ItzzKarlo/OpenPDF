import { confirm } from '@tauri-apps/plugin-dialog';
import { useCallback, useEffect, useRef, useState } from 'react';
import { pdfJsAdapter } from './engine/PdfJsAdapter';
import { exportPageSelection, exportPdf } from './engine/PdfExporter';
import { parsePageRange } from './engine/pageOperations';
import { choosePdfFiles, readBrowserFile, readPath, savePdf, type LocalFile } from './services/files';
import { createOpenDocument, isDocumentDirty, useAppStore } from './store/appStore';
import type { SearchMatch, SourceDocument } from './types/document';
import { DocumentViewer } from './components/DocumentViewer';
import { navigateToPage } from './services/navigation';
import { Inspector } from './components/Inspector';
import { Modal } from './components/Modal';
import { Sidebar } from './components/Sidebar';
import { Toolbar } from './components/Toolbar';
import { TopBar } from './components/TopBar';
import { Welcome } from './components/Welcome';

type PasswordRequest = { name: string; resolve: (password: string | null) => void };
type RangeRequest = { title: string; description: string; resolve: (range: string | null) => void };

const isTauri = () => '__TAURI_INTERNALS__' in window;

export function App() {
  const store = useAppStore();
  const active = store.documents.find((document) => document.id === store.activeDocumentId);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [passwordRequest, setPasswordRequest] = useState<PasswordRequest | null>(null);
  const [password, setPassword] = useState('');
  const [rangeRequest, setRangeRequest] = useState<RangeRequest | null>(null);
  const [range, setRange] = useState('');
  const dropDepth = useRef(0);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const dark = store.theme === 'dark' || (store.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    root.classList.toggle('dark', dark);
  }, [store.theme]);

  const askPassword = (name: string) => new Promise<string | null>((resolve) => {
    setPassword(''); setPasswordRequest({ name, resolve });
  });

  const loadFile = useCallback(async (file: LocalFile) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) return;
    const sourceId = crypto.randomUUID();
    const source: SourceDocument = { id: sourceId, name: file.name, bytes: file.bytes };
    let passwordValue: string | undefined;
    let pages;
    for (;;) {
      try { pages = await pdfJsAdapter.inspect(source, passwordValue); break; }
      catch (caught: any) {
        if (caught?.name !== 'PasswordException') throw caught;
        const entered = await askPassword(file.name);
        if (entered == null) return;
        passwordValue = entered;
      }
    }
    const document = createOpenDocument(file.name, file.path, file.bytes, pages, sourceId);
    document.password = passwordValue;
    store.addDocument(document);
  }, [store]);

  const openFiles = useCallback(async () => {
    try {
      const files = await choosePdfFiles(true);
      for (const file of files) await loadFile(file);
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
  }, [loadFile]);

  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;
    void import('@tauri-apps/api/window').then(async ({ getCurrentWindow }) => {
      unlisten = await getCurrentWindow().onDragDropEvent(async (event) => {
        if (event.payload.type === 'over') setDragging(true);
        if (event.payload.type === 'leave') setDragging(false);
        if (event.payload.type === 'drop') {
          setDragging(false);
          for (const path of event.payload.paths) {
            try { await loadFile(await readPath(path)); } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
          }
        }
      });
    });
    return () => unlisten?.();
  }, [loadFile]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (useAppStore.getState().documents.some(isDocumentDirty)) event.preventDefault();
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, []);

  const saveActive = useCallback(async (saveAs = false) => {
    const current = useAppStore.getState().documents.find((item) => item.id === useAppStore.getState().activeDocumentId);
    if (!current) return;
    setStatus('Exporting PDF…');
    try {
      const bytes = await exportPdf(current);
      const path = await savePdf(bytes, current.name, current.path, saveAs);
      if (path) {
        store.markSaved(current.id, path);
        setStatus('Saved'); setTimeout(() => setStatus(null), 1800);
      } else setStatus(null);
    } catch (caught) { setStatus(null); setError(caught instanceof Error ? caught.message : String(caught)); }
  }, [store]);

  const closeDocument = useCallback(async (id: string) => {
    const current = useAppStore.getState().documents.find((item) => item.id === id);
    if (!current) return;
    if (isDocumentDirty(current)) {
      const discard = isTauri()
        ? await confirm(`“${current.name}” has unsaved changes. Close without saving?`, { title: 'Unsaved changes', kind: 'warning', okLabel: 'Discard Changes', cancelLabel: 'Cancel' })
        : window.confirm(`“${current.name}” has unsaved changes. Close without saving?`);
      if (!discard) return;
    }
    for (const sourceId of Object.keys(current.sources)) void pdfJsAdapter.close(sourceId);
    store.closeDocument(id);
  }, [store]);

  const search = useCallback(async (query: string): Promise<SearchMatch[]> => {
    if (!active) return [];
    const results: SearchMatch[] = [];
    for (const source of Object.values(active.sources)) results.push(...await pdfJsAdapter.find(source, active.pages, query, active.password));
    return results.sort((a, b) => a.pageIndex - b.pageIndex);
  }, [active]);

  const merge = async () => {
    if (!active) return;
    try {
      const files = await choosePdfFiles(true);
      for (const file of files) {
        const id = crypto.randomUUID(); const source = { id, name: file.name, bytes: file.bytes };
        const pages = await pdfJsAdapter.inspect(source);
        store.updateDocument(active.id, (document) => { document.sources[id] = source; });
        store.mutateSnapshot(active.id, (snapshot) => { snapshot.pages.push(...pages); });
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
  };

  const saveSelection = async (indices: number[], suffix: string) => {
    if (!active || !indices.length) return;
    const bytes = await exportPageSelection(active, indices);
    await savePdf(bytes, active.name.replace(/\.pdf$/i, '') + suffix + '.pdf', null, true);
  };

  const extract = async () => {
    if (!active) return;
    const selected = new Set(active.selectedPageIds);
    const indices = active.pages.map((page, index) => selected.has(page.id) ? index : -1).filter((index) => index >= 0);
    try { await saveSelection(indices, '-extracted'); } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
  };

  const requestRange = (title: string, description: string) => new Promise<string | null>((resolve) => {
    setRange('1'); setRangeRequest({ title, description, resolve });
  });
  const split = async () => {
    if (!active) return;
    const value = await requestRange('Split by page range', `Enter pages to export from 1–${active.pages.length}, for example 1-3, 6.`);
    if (!value) return;
    try { await saveSelection(parsePageRange(value, active.pages.length), '-split'); }
    catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.matches('input, textarea, select, [contenteditable="true"]')) return;
      const command = event.metaKey || event.ctrlKey;
      if (command && event.key.toLowerCase() === 'o') { event.preventDefault(); void openFiles(); }
      else if (command && event.key.toLowerCase() === 's') { event.preventDefault(); void saveActive(event.shiftKey); }
      else if (command && event.key.toLowerCase() === 'z' && active) {
        event.preventDefault();
        if (event.shiftKey) store.redo(active.id); else store.undo(active.id);
      }
      else if ((event.key === 'Delete' || event.key === 'Backspace') && active?.selectedObjectId) {
        event.preventDefault(); store.mutateSnapshot(active.id, (snapshot) => { snapshot.edits = snapshot.edits.filter((edit) => edit.id !== active.selectedObjectId); });
      } else {
        const keyMap: Record<string, typeof store.tool> = { v: 'select', t: 'text', i: 'image', h: 'highlight', u: 'underline', r: 'rectangle', o: 'ellipse', l: 'line', d: 'draw', e: 'eraser', g: 'signature', c: 'comment' };
        if (keyMap[event.key.toLowerCase()]) store.setTool(keyMap[event.key.toLowerCase()]);
      }
    };
    window.addEventListener('keydown', onKeyDown); return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, openFiles, saveActive, store]);

  const browserDrop = async (event: React.DragEvent) => {
    event.preventDefault(); dropDepth.current = 0; setDragging(false);
    if (isTauri()) return;
    for (const file of [...event.dataTransfer.files]) {
      try { await loadFile(await readBrowserFile(file)); } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    }
  };
  return <div className="app" onDragEnter={(event) => { event.preventDefault(); dropDepth.current += 1; setDragging(true); }} onDragLeave={() => { dropDepth.current -= 1; if (dropDepth.current <= 0) setDragging(false); }} onDragOver={(event) => event.preventDefault()} onDrop={browserDrop}>
    <TopBar onOpen={() => void openFiles()} onClose={(id) => void closeDocument(id)} onSave={(as) => void saveActive(as)} onSearch={search} onNavigate={navigateToPage} />
    <Toolbar />
    {active ? <div className="workspace">
      {store.sidebarOpen && <><div className="panel-wrap" style={{ width: store.sidebarWidth }}><Sidebar onMerge={() => void merge()} onExtract={() => void extract()} onSplit={() => void split()} onNavigate={navigateToPage} /></div><div className="resize-divider" onPointerDown={(event) => { const start = event.clientX; const width = store.sidebarWidth; const move = (e: PointerEvent) => store.setPanelWidth('sidebar', width + e.clientX - start); const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); }; window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); }} /></>}
      <DocumentViewer document={active} />
      {store.inspectorOpen && <><div className="resize-divider" onPointerDown={(event) => { const start = event.clientX; const width = store.inspectorWidth; const move = (e: PointerEvent) => store.setPanelWidth('inspector', width - e.clientX + start); const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); }; window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); }} /><div className="panel-wrap" style={{ width: store.inspectorWidth }}><Inspector /></div></>}
    </div> : <Welcome onOpen={() => void openFiles()} />}
    {dragging && <div className="drop-overlay"><div>Drop PDF to open</div></div>}
    {status && <div className="status-toast">{status}</div>}
    {error && <div className="error-toast" role="alert"><span>{error}</span><button onClick={() => setError(null)}>Dismiss</button></div>}
    {passwordRequest && <Modal title="Password required"><form onSubmit={(event) => { event.preventDefault(); passwordRequest.resolve(password); setPasswordRequest(null); }}><p>Enter the password for <b>{passwordRequest.name}</b>.</p><input autoFocus type="password" value={password} onChange={(event) => setPassword(event.target.value)} /><div className="modal-actions"><button type="button" onClick={() => { passwordRequest.resolve(null); setPasswordRequest(null); }}>Cancel</button><button className="primary-button" type="submit">Unlock</button></div></form></Modal>}
    {rangeRequest && <Modal title={rangeRequest.title} onClose={() => { rangeRequest.resolve(null); setRangeRequest(null); }}><form onSubmit={(event) => { event.preventDefault(); rangeRequest.resolve(range); setRangeRequest(null); }}><p>{rangeRequest.description}</p><input autoFocus value={range} onChange={(event) => setRange(event.target.value)} placeholder="1-3, 6" /><div className="modal-actions"><button type="button" onClick={() => { rangeRequest.resolve(null); setRangeRequest(null); }}>Cancel</button><button className="primary-button" type="submit">Export pages</button></div></form></Modal>}
  </div>;
}
