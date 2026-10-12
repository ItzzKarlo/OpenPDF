import { X } from 'lucide-react';
import type { ReactNode } from 'react';

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose?: () => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}>
    <section className="modal" role="dialog" aria-modal="true" aria-label={title}>
      <header><h2>{title}</h2>{onClose && <button onClick={onClose} aria-label="Close"><X size={16} /></button>}</header>
      {children}
    </section>
  </div>;
}
