import { FilePlus2, FileText, LockKeyhole, MonitorDown } from 'lucide-react';

export function Welcome({ onOpen }: { onOpen: () => void }) {
  return <main className="welcome" onDoubleClick={onOpen}>
    <div className="welcome-mark"><FileText size={35} strokeWidth={1.35} /></div>
    <h1>OpenPDF</h1>
    <p>Edit PDFs privately on your computer.</p>
    <button className="primary-button" onClick={onOpen}><FilePlus2 size={17} />Open PDF</button>
    <div className="drop-hint">or drop PDF files anywhere in this window</div>
    <div className="privacy-points"><span><LockKeyhole size={14} />No uploads</span><span><MonitorDown size={14} />Works offline</span></div>
  </main>;
}
