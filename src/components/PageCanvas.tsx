import { MessageSquare } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { pdfRectToViewport, rotatedSize, viewportRectToPdf, viewportToPdf } from '../engine/coordinates';
import { pdfJsAdapter } from '../engine/PdfJsAdapter';
import { makeId } from '../engine/pageOperations';
import { fileToDataUrl, chooseImage } from '../services/files';
import { updateEdit, useAppStore } from '../store/appStore';
import type { DetectedFormField, EditObject, OpenDocument, PageModel, PdfPoint, PdfRect, Tool } from '../types/document';

const newBase = (pageId: string, rect: PdfRect) => ({
  id: makeId(), pageId, ...rect, rotation: 0, opacity: 1, createdAt: Date.now(),
});

function createRectEdit(tool: Tool, pageId: string, rect: PdfRect): EditObject | null {
  const base = newBase(pageId, rect);
  if (tool === 'rectangle' || tool === 'ellipse' || tool === 'line') return { ...base, type: tool, strokeColor: '#2457d6', strokeWidth: 2 };
  if (tool === 'highlight') return { ...base, type: 'highlight', color: '#ffd84d', opacity: 0.45 };
  if (tool === 'underline') return { ...base, type: 'underline', color: '#e34b4b' };
  if (tool === 'redaction') return { ...base, type: 'redaction', color: '#000000' };
  return null;
}

function ObjectOverlay({ edit, page, scale, document }: { edit: EditObject; page: PageModel; scale: number; document: OpenDocument }) {
  const { tool, mutateSnapshot, updateDocument } = useAppStore();
  const selected = document.selectedObjectId === edit.id;
  const rect = pdfRectToViewport(edit, page, scale);
  const [delta, setDelta] = useState({ x: 0, y: 0 });
  const move = (event: React.PointerEvent) => {
    event.stopPropagation();
    if (tool === 'eraser') {
      mutateSnapshot(document.id, (snapshot) => { snapshot.edits = snapshot.edits.filter((item) => item.id !== edit.id); });
      return;
    }
    updateDocument(document.id, (next) => { next.selectedObjectId = edit.id; next.activePageId = page.id; });
    if (tool !== 'select') return;
    const start = { x: event.clientX, y: event.clientY };
    const onMove = (pointer: PointerEvent) => setDelta({ x: pointer.clientX - start.x, y: pointer.clientY - start.y });
    const onUp = (pointer: PointerEvent) => {
      const a = viewportToPdf({ x: 0, y: 0 }, page, scale);
      const b = viewportToPdf({ x: pointer.clientX - start.x, y: pointer.clientY - start.y }, page, scale);
      mutateSnapshot(document.id, (snapshot) => {
        snapshot.edits = updateEdit(snapshot.edits, edit.id, { x: edit.x + b.x - a.x, y: edit.y + b.y - a.y });
      });
      setDelta({ x: 0, y: 0 });
      window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);
  };
  const resize = (event: React.PointerEvent) => {
    event.stopPropagation(); event.preventDefault();
    const start = { x: event.clientX, y: event.clientY };
    const onMove = (pointer: PointerEvent) => setDelta({ x: pointer.clientX - start.x, y: pointer.clientY - start.y });
    const onUp = (pointer: PointerEvent) => {
      const changed = viewportRectToPdf({ ...rect, width: Math.max(8, rect.width + pointer.clientX - start.x), height: Math.max(8, rect.height + pointer.clientY - start.y) }, page, scale);
      mutateSnapshot(document.id, (snapshot) => { snapshot.edits = updateEdit(snapshot.edits, edit.id, changed); });
      setDelta({ x: 0, y: 0 });
      window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);
  };
  const style: React.CSSProperties = {
    left: rect.x + delta.x, top: rect.y + delta.y,
    width: Math.max(2, rect.width + (selected ? Math.max(0, delta.x) : 0)),
    height: Math.max(2, rect.height + (selected ? Math.max(0, delta.y) : 0)),
    transform: `rotate(${edit.rotation}deg)`, opacity: edit.opacity,
  };
  let content: React.ReactNode;
  if (edit.type === 'text') content = <div className="edit-text" style={{ color: edit.color, fontFamily: edit.fontFamily, fontSize: edit.fontSize * scale, textAlign: edit.alignment }}>{edit.text}</div>;
  else if (edit.type === 'image') content = <img src={edit.dataUrl} draggable={false} />;
  else if (edit.type === 'rectangle') content = <div className="shape rectangle" style={{ borderColor: edit.strokeColor, borderWidth: edit.strokeWidth * scale, background: edit.fillColor ?? 'transparent' }} />;
  else if (edit.type === 'ellipse') content = <div className="shape ellipse" style={{ borderColor: edit.strokeColor, borderWidth: edit.strokeWidth * scale, background: edit.fillColor ?? 'transparent' }} />;
  else if (edit.type === 'line') content = <svg width="100%" height="100%" overflow="visible"><line x1="0" y1="100%" x2="100%" y2="0" stroke={edit.strokeColor} strokeWidth={edit.strokeWidth * scale} /></svg>;
  else if (edit.type === 'draw' || edit.type === 'signature') {
    const points = edit.points.map((point) => {
      const mapped = pdfRectToViewport({ ...point, width: 0, height: 0 }, page, scale);
      return `${mapped.x - rect.x},${mapped.y - rect.y}`;
    }).join(' ');
    content = <svg width="100%" height="100%" overflow="visible"><polyline points={points} fill="none" stroke={edit.color} strokeWidth={edit.strokeWidth * scale} strokeLinecap="round" strokeLinejoin="round" /></svg>;
  } else if (edit.type === 'highlight') content = <div className="markup highlight" style={{ background: edit.color }} />;
  else if (edit.type === 'underline') content = <div className="markup underline" style={{ borderColor: edit.color }} />;
  else if (edit.type === 'redaction') content = <div className="markup redaction" />;
  else if (edit.type === 'comment') content = <div className="comment-pin" title={edit.text}><MessageSquare size={13} /></div>;
  else content = null;
  return (
    <div className={`edit-object ${selected ? 'selected' : ''}`} style={style} onPointerDown={move} data-edit-id={edit.id}>
      {content}
      {selected && tool === 'select' && <button className="resize-handle" aria-label="Resize object" onPointerDown={resize} />}
    </div>
  );
}

function FormField({ field, page, scale, document }: { field: DetectedFormField; page: PageModel; scale: number; document: OpenDocument }) {
  const { mutateSnapshot } = useAppStore();
  const rect = pdfRectToViewport(field.rect, page, scale);
  const stored = document.formValues[field.name]?.value ?? field.value;
  const change = (value: string | boolean) => mutateSnapshot(document.id, (snapshot) => {
    snapshot.formValues[field.name] = { name: field.name, type: field.fieldType as 'text' | 'checkbox' | 'radio' | 'choice', value };
  });
  const style = { left: rect.x, top: rect.y, width: rect.width, height: rect.height };
  if (field.fieldType === 'checkbox' || field.fieldType === 'radio') return <input className="pdf-form-field" style={style} aria-label={field.name} type={field.fieldType} checked={Boolean(stored)} onChange={(event) => change(event.target.checked)} />;
  if (field.fieldType === 'choice') return <select className="pdf-form-field" style={style} aria-label={field.name} value={String(stored ?? '')} onChange={(event) => change(event.target.value)}>{field.options?.map((option) => <option key={option}>{option}</option>)}</select>;
  return <input className="pdf-form-field" style={style} aria-label={field.name} value={String(stored ?? '')} onChange={(event) => change(event.target.value)} />;
}

interface Props { document: OpenDocument; page: PageModel; scale: number; active: boolean; onVisible: () => void }

export function PageCanvas({ document, page, scale, active, onVisible }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(active);
  const [textItems, setTextItems] = useState<Awaited<ReturnType<typeof pdfJsAdapter.extractTextFromPage>>>([]);
  const [fields, setFields] = useState<DetectedFormField[]>([]);
  const [draft, setDraft] = useState<{ start: PdfPoint; current: PdfPoint; points: PdfPoint[] } | null>(null);
  const { tool, mutateSnapshot, updateDocument, setTool } = useAppStore();
  const size = rotatedSize(page);
  const source = page.sourceId ? document.sources[page.sourceId] : null;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); onVisible(); }
    }, { rootMargin: '700px 0px', threshold: 0.01 });
    observer.observe(root); return () => observer.disconnect();
  }, [onVisible]);

  useEffect(() => {
    if (!visible || !source || page.sourcePageIndex == null || !canvasRef.current) return;
    let cancelled = false;
    void (async () => {
      await pdfJsAdapter.renderPage(source, page.sourcePageIndex!, canvasRef.current!, scale, page.rotation, document.password);
      const pdfPage = await pdfJsAdapter.getPage(source, page.sourcePageIndex!, document.password);
      const [text, formFields] = await Promise.all([
        pdfJsAdapter.extractTextFromPage(pdfPage),
        pdfJsAdapter.getFormFields(source, page.sourcePageIndex!, document.password),
      ]);
      if (!cancelled) { setTextItems(text); setFields(formFields); }
    })();
    return () => { cancelled = true; };
  }, [document.password, page.rotation, page.sourcePageIndex, scale, source, visible]);

  const localPoint = (event: React.PointerEvent): PdfPoint => {
    const bounds = rootRef.current!.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  };
  const begin = async (event: React.PointerEvent) => {
    if ((event.target as HTMLElement).closest('.edit-object,.pdf-form-field')) return;
    updateDocument(document.id, (next) => { next.activePageId = page.id; next.selectedPageIds = [page.id]; next.selectedObjectId = null; });
    if (tool === 'select' || tool === 'eraser') return;
    const viewport = localPoint(event);
    const pdf = viewportToPdf(viewport, page, scale);
    if (tool === 'text') {
      const edit: EditObject = { ...newBase(page.id, { x: pdf.x, y: Math.max(0, pdf.y - 32), width: 180, height: 32 }), type: 'text', text: 'Text', fontFamily: 'Helvetica', fontSize: 16, color: '#172033', alignment: 'left' };
      mutateSnapshot(document.id, (snapshot) => snapshot.edits.push(edit));
      updateDocument(document.id, (next) => { next.selectedObjectId = edit.id; }); setTool('select'); return;
    }
    if (tool === 'comment') {
      const edit: EditObject = { ...newBase(page.id, { x: pdf.x, y: pdf.y, width: 18, height: 18 }), type: 'comment', text: 'New comment', author: 'Local user' };
      mutateSnapshot(document.id, (snapshot) => snapshot.edits.push(edit)); updateDocument(document.id, (next) => { next.selectedObjectId = edit.id; }); setTool('select'); return;
    }
    if (tool === 'image') {
      const file = await chooseImage(); if (!file) return;
      const mime = file.name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
      const dataUrl = fileToDataUrl(file, mime); const image = new Image(); image.src = dataUrl; await image.decode();
      const width = Math.min(220, image.naturalWidth); const height = width * image.naturalHeight / image.naturalWidth;
      const edit: EditObject = { ...newBase(page.id, { x: pdf.x, y: Math.max(0, pdf.y - height), width, height }), type: 'image', mimeType: mime, dataUrl };
      mutateSnapshot(document.id, (snapshot) => snapshot.edits.push(edit)); updateDocument(document.id, (next) => { next.selectedObjectId = edit.id; }); setTool('select'); return;
    }
    setDraft({ start: viewport, current: viewport, points: [pdf] });
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const continueDraft = (event: React.PointerEvent) => {
    if (!draft) return;
    const current = localPoint(event);
    const points = (tool === 'draw' || tool === 'signature') ? [...draft.points, viewportToPdf(current, page, scale)] : draft.points;
    setDraft({ ...draft, current, points });
  };
  const finish = (event: React.PointerEvent) => {
    if (!draft) return;
    const current = localPoint(event);
    if (tool === 'draw' || tool === 'signature') {
      const points = [...draft.points, viewportToPdf(current, page, scale)];
      const xs = points.map((point) => point.x); const ys = points.map((point) => point.y);
      const edit: EditObject = { ...newBase(page.id, { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(1, Math.max(...xs) - Math.min(...xs)), height: Math.max(1, Math.max(...ys) - Math.min(...ys)) }), type: tool, points, color: '#16213a', strokeWidth: tool === 'signature' ? 2.2 : 1.8 };
      mutateSnapshot(document.id, (snapshot) => snapshot.edits.push(edit));
    } else {
      const viewportRect = { x: Math.min(draft.start.x, current.x), y: Math.min(draft.start.y, current.y), width: Math.abs(current.x - draft.start.x), height: Math.abs(current.y - draft.start.y) };
      if (viewportRect.width > 3 && viewportRect.height > 3) {
        const edit = createRectEdit(tool, page.id, viewportRectToPdf(viewportRect, page, scale));
        if (edit) mutateSnapshot(document.id, (snapshot) => snapshot.edits.push(edit));
      }
    }
    setDraft(null);
  };
  const draftRect = draft ? { left: Math.min(draft.start.x, draft.current.x), top: Math.min(draft.start.y, draft.current.y), width: Math.abs(draft.current.x - draft.start.x), height: Math.abs(draft.current.y - draft.start.y) } : null;
  return (
    <div className={`page-shell ${active ? 'active' : ''}`} id={`page-${page.id}`} ref={rootRef} style={{ width: size.width * scale, height: size.height * scale }} onPointerDown={begin} onPointerMove={continueDraft} onPointerUp={finish}>
      {source ? <canvas ref={canvasRef} className="pdf-canvas" /> : <div className="blank-page" />}
      <div className="text-layer" aria-label={`Selectable text on ${page.label}`}>
        {textItems.map((item, index) => {
          const rect = pdfRectToViewport(item.rect, page, scale);
          return <span key={`${index}-${item.text}`} style={{ left: rect.x, top: rect.y, width: Math.max(1, rect.width), height: Math.max(1, rect.height), fontSize: Math.max(4, rect.height * 0.92), lineHeight: `${Math.max(1, rect.height)}px` }}>{item.text}</span>;
        })}
      </div>
      <div className="form-layer">{fields.map((field) => <FormField key={field.name} field={field} page={page} scale={scale} document={document} />)}</div>
      <div className={`edit-layer tool-${tool}`}>
        {document.edits.filter((edit) => edit.pageId === page.id).map((edit) => <ObjectOverlay key={edit.id} edit={edit} page={page} scale={scale} document={document} />)}
        {draftRect && <div className={`creation-draft ${tool}`} style={draftRect} />}
      </div>
      <div className="page-number-badge">{document.pages.indexOf(page) + 1}</div>
    </div>
  );
}
