import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';

const isTauri = () => '__TAURI_INTERNALS__' in window;

export interface LocalFile { name: string; path: string | null; bytes: Uint8Array }

export async function choosePdfFiles(multiple = true): Promise<LocalFile[]> {
  if (isTauri()) {
    const selected = await open({
      multiple,
      directory: false,
      filters: [{ name: 'PDF documents', extensions: ['pdf'] }],
    });
    const paths = selected ? (Array.isArray(selected) ? selected : [selected]) : [];
    return Promise.all(paths.map(readPath));
  }
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'application/pdf,.pdf'; input.multiple = multiple;
    input.onchange = async () => resolve(Promise.all([...input.files ?? []].map(readBrowserFile)));
    input.click();
  });
}

export async function chooseImage(): Promise<LocalFile | null> {
  if (isTauri()) {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }],
    });
    return typeof selected === 'string' ? readPath(selected) : null;
  }
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/png,image/jpeg';
    input.onchange = async () => resolve(input.files?.[0] ? readBrowserFile(input.files[0]) : null);
    input.click();
  });
}

export async function readPath(path: string): Promise<LocalFile> {
  const bytes = await invoke<number[]>('read_binary', { path });
  return { name: path.split(/[\\/]/).pop() ?? 'Document.pdf', path, bytes: new Uint8Array(bytes) };
}

export async function readBrowserFile(file: File): Promise<LocalFile> {
  return { name: file.name, path: null, bytes: new Uint8Array(await file.arrayBuffer()) };
}

export async function savePdf(bytes: Uint8Array, suggestedName: string, currentPath: string | null, forceDialog = false) {
  if (isTauri()) {
    let path = !forceDialog ? currentPath : null;
    if (!path) {
      path = await save({
        defaultPath: suggestedName.toLowerCase().endsWith('.pdf') ? suggestedName : `${suggestedName}.pdf`,
        filters: [{ name: 'PDF document', extensions: ['pdf'] }],
      });
    }
    if (!path) return null;
    await invoke('write_pdf_safe', { path, data: [...bytes], allowOverwrite: path === currentPath || forceDialog });
    return path;
  }
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = suggestedName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1_000);
  return currentPath ?? suggestedName;
}

export function fileToDataUrl(file: LocalFile, mime: 'image/png' | 'image/jpeg') {
  let binary = '';
  for (let index = 0; index < file.bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...file.bytes.subarray(index, index + 0x8000));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}
