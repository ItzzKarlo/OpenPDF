import { RotateCcw, RotateCw, Trash2 } from 'lucide-react';
import { rotatePages } from '../engine/pageOperations';
import { updateEdit, useAppStore } from '../store/appStore';
import type { Color, EditObject } from '../types/document';

const NumberField = ({ label, value, onChange, min, max, step }: { label: string; value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number }) => (
  <label className="field"><span>{label}</span><input type="number" value={Number(value.toFixed(2))} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} /></label>
);

export function Inspector() {
  const { documents, activeDocumentId, mutateSnapshot } = useAppStore();
  const document = documents.find((item) => item.id === activeDocumentId);
  if (!document) return <aside className="inspector"><div className="empty-inspector">Open a PDF to inspect it.</div></aside>;
  const selected = document.edits.find((edit) => edit.id === document.selectedObjectId);
  const page = document.pages.find((item) => item.id === document.activePageId);
  const change = (values: Partial<EditObject>) => selected && mutateSnapshot(document.id, (snapshot) => { snapshot.edits = updateEdit(snapshot.edits, selected.id, values); });
  return (
    <aside className="inspector">
      <div className="panel-heading"><span>Inspector</span></div>
      {selected ? <>
        <section className="inspector-section">
          <h3>{selected.type[0].toUpperCase() + selected.type.slice(1)}</h3>
          <div className="field-grid">
            <NumberField label="X" value={selected.x} onChange={(x) => change({ x })} />
            <NumberField label="Y" value={selected.y} onChange={(y) => change({ y })} />
            <NumberField label="W" value={selected.width} min={1} onChange={(width) => change({ width })} />
            <NumberField label="H" value={selected.height} min={1} onChange={(height) => change({ height })} />
            <NumberField label="Rotation" value={selected.rotation} step={1} onChange={(rotation) => change({ rotation })} />
            <NumberField label="Opacity" value={selected.opacity} min={0} max={1} step={0.1} onChange={(opacity) => change({ opacity })} />
          </div>
        </section>
        {selected.type === 'text' && <section className="inspector-section">
          <h3>Typography</h3>
          <label className="field vertical"><span>Text</span><textarea value={selected.text} onChange={(event) => change({ text: event.target.value } as Partial<EditObject>)} /></label>
          <label className="field"><span>Font</span><select value={selected.fontFamily} onChange={(event) => change({ fontFamily: event.target.value } as Partial<EditObject>)}><option>Helvetica</option><option>Times Roman</option><option>Courier</option></select></label>
          <NumberField label="Size" value={selected.fontSize} min={4} max={144} onChange={(fontSize) => change({ fontSize } as Partial<EditObject>)} />
          <label className="field"><span>Color</span><input type="color" value={selected.color} onChange={(event) => change({ color: event.target.value as Color } as Partial<EditObject>)} /></label>
          <label className="field"><span>Align</span><select value={selected.alignment} onChange={(event) => change({ alignment: event.target.value } as Partial<EditObject>)}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
        </section>}
        {(selected.type === 'rectangle' || selected.type === 'ellipse' || selected.type === 'line') && <section className="inspector-section">
          <h3>Appearance</h3>
          <label className="field"><span>Stroke</span><input type="color" value={selected.strokeColor} onChange={(event) => change({ strokeColor: event.target.value as Color } as Partial<EditObject>)} /></label>
          <NumberField label="Width" value={selected.strokeWidth} min={0.25} max={24} step={0.25} onChange={(strokeWidth) => change({ strokeWidth } as Partial<EditObject>)} />
        </section>}
        {selected.type === 'comment' && <section className="inspector-section"><h3>Comment</h3><textarea value={selected.text} onChange={(event) => change({ text: event.target.value } as Partial<EditObject>)} /></section>}
        {selected.type === 'redaction' && <div className="warning-note">Visual cover only. It does not remove underlying PDF content and is not secure redaction.</div>}
        <button className="danger-button" onClick={() => mutateSnapshot(document.id, (snapshot) => { snapshot.edits = snapshot.edits.filter((edit) => edit.id !== selected.id); })}><Trash2 size={15} />Delete object</button>
      </> : page ? <>
        <section className="inspector-section">
          <h3>Page {document.pages.indexOf(page) + 1}</h3>
          <dl className="page-metadata"><dt>Size</dt><dd>{Math.round(page.width)} × {Math.round(page.height)} pt</dd><dt>Rotation</dt><dd>{page.rotation}°</dd><dt>Source</dt><dd>{page.sourceId ? 'Original PDF' : 'Blank page'}</dd></dl>
          <div className="row-actions">
            <button onClick={() => mutateSnapshot(document.id, (snapshot) => { snapshot.pages = rotatePages(snapshot.pages, [page.id], -90); })}><RotateCcw size={15} />Left</button>
            <button onClick={() => mutateSnapshot(document.id, (snapshot) => { snapshot.pages = rotatePages(snapshot.pages, [page.id], 90); })}><RotateCw size={15} />Right</button>
          </div>
        </section>
        <section className="inspector-section capability-list"><h3>Source content</h3><p>Text selection and extraction are available. Editing existing PDF text, images, or operators requires a future native content engine.</p></section>
      </> : <div className="empty-inspector">Select a page or object.</div>}
    </aside>
  );
}
