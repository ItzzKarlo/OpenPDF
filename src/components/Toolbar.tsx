import {
  Circle, Eraser, Highlighter, Image, MessageSquare, MousePointer2, PenLine,
  RectangleHorizontal, Redo2, RemoveFormatting, Signature, Slash, Type, Undo2,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import type { Tool } from '../types/document';
import { IconButton } from './IconButton';

const tools: { tool: Tool; label: string; icon: typeof MousePointer2; key?: string }[] = [
  { tool: 'select', label: 'Select (V)', icon: MousePointer2 },
  { tool: 'text', label: 'Add text (T)', icon: Type },
  { tool: 'image', label: 'Insert image (I)', icon: Image },
  { tool: 'highlight', label: 'Highlight (H)', icon: Highlighter },
  { tool: 'underline', label: 'Underline (U)', icon: RemoveFormatting },
  { tool: 'rectangle', label: 'Rectangle (R)', icon: RectangleHorizontal },
  { tool: 'ellipse', label: 'Ellipse (O)', icon: Circle },
  { tool: 'line', label: 'Line (L)', icon: Slash },
  { tool: 'draw', label: 'Draw (D)', icon: PenLine },
  { tool: 'eraser', label: 'Erase object (E)', icon: Eraser },
  { tool: 'signature', label: 'Signature (G)', icon: Signature },
  { tool: 'comment', label: 'Comment (C)', icon: MessageSquare },
  { tool: 'redaction', label: 'Visual redaction (not secure)', icon: RemoveFormatting },
];

export function Toolbar() {
  const { tool, setTool, documents, activeDocumentId, undo, redo } = useAppStore();
  const document = documents.find((item) => item.id === activeDocumentId);
  return (
    <div className="toolbar" role="toolbar" aria-label="Editing tools">
      <div className="tool-group">
        <IconButton icon={Undo2} label="Undo (⌘Z)" disabled={!document?.undoStack.length} onClick={() => document && undo(document.id)} />
        <IconButton icon={Redo2} label="Redo (⇧⌘Z)" disabled={!document?.redoStack.length} onClick={() => document && redo(document.id)} />
      </div>
      <div className="toolbar-rule" />
      <div className="tool-group scrollable-tools">
        {tools.map((item) => (
          <IconButton
            key={item.tool}
            icon={item.icon}
            label={item.label}
            active={tool === item.tool}
            disabled={!document}
            onClick={() => setTool(item.tool)}
          />
        ))}
      </div>
    </div>
  );
}
