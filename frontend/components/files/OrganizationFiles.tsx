'use client';

import { useCallback, useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { api, ApiError, FileKind, FilePage, FileRead, fileFieldErrors } from '@/lib/api/client';
import FileUploadControl from './FileUploadControl';

type Props = {
  orgId: string; role: string; userId: string; selectedDeckId?: string | null;
  onSelectDeck: (id: string | null) => Promise<void>;
  onDeleted: (id: string) => void;
};
const TYPES: { value: FileKind; label: string }[] = [
  { value: 'document', label: 'Document' }, { value: 'pitch_deck', label: 'Pitch deck' },
  { value: 'financial_model', label: 'Financial model' }, { value: 'legal', label: 'Legal document' },
];
function status(file: FileRead) {
  if (file.upload_status === 'ready' && file.scan_status === 'clean') return 'Ready';
  if (file.upload_status === 'rejected' || file.scan_status === 'infected') return 'Rejected';
  if (file.scan_status === 'failed') return 'Scanning unavailable';
  return { pending: 'Awaiting upload', uploaded: 'Scanning', ready: 'Unavailable', expired: 'Expired', rejected: 'Rejected' }[file.upload_status];
}
export default function OrganizationFiles({ orgId, role, userId, selectedDeckId, onSelectDeck, onDeleted }: Props) {
  const [page, setPage] = useState<FilePage | null>(null);
  const [offset, setOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState('');
  const [uploadBusy, setUploadBusy] = useState(false);
  const [kind, setKind] = useState<FileKind>('document');
  const canWrite = ['owner', 'admin', 'member'].includes(role);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setPage(null);
    api.files.listOrganization(orgId, { limit: 10, offset }, controller.signal)
      .then(result => { if (!controller.signal.aborted) setPage(result); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof ApiError ? cause.message : 'Could not load files.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [orgId, offset, revision]);
  // Only pending scans poll. Failed scans need explicit retry, not a hot loop.
  useEffect(() => {
    if (!page?.items.some(file => file.upload_status === 'uploaded' && file.scan_status === 'pending')) return;
    const timer = setTimeout(refresh, 4000);
    return () => clearTimeout(timer);
  }, [page, refresh]);

  async function act(file: FileRead, action: 'download' | 'delete' | 'select' | 'retry') {
    if (busyId) return;
    setBusyId(file.id); setRowError({});
    try {
      if (action === 'download') {
        const link = await api.files.download(file.id);
        window.location.assign(link.url);
      } else if (action === 'delete') {
        await api.files.remove(file.id); onDeleted(file.id);
        if (page?.items.length === 1 && offset > 0) setOffset(Math.max(0, offset - 10));
        else refresh();
      } else if (action === 'select') {
        await onSelectDeck(selectedDeckId === file.id ? null : file.id);
      } else {
        await api.files.confirm(file.id); refresh();
      }
    } catch (cause) {
      const fields = Object.values(fileFieldErrors(cause));
      setRowError({ [file.id]: fields.join(' ') || (cause instanceof ApiError ? cause.message : 'Could not complete this file action.') });
    } finally { setBusyId(''); }
  }

  return <div>
    <div className="mb-3 rounded-lg bg-[#FAF8F4] p-3 text-xs text-[#4A5568]">
      Private to active organization members. Investor sharing and NDA controls are not available here.
    </div>
    <button type="button" onClick={refresh} disabled={loading} className="mb-2 text-xs underline disabled:opacity-50">Refresh files</button>
    {loading && <p role="status" className="py-3 text-sm text-[#4A5568]">Loading files…</p>}
    {error && <p role="alert" className="py-3 text-sm text-red-700">{error} <button type="button" onClick={refresh} className="underline">Retry</button></p>}
    {!loading && !error && page?.items.length === 0 && <p className="py-3 text-sm text-[#4A5568]">No organization files yet.</p>}
    <div className="divide-y divide-[#E5E1D8]">
      {page?.items.map(file => {
        const ready = file.upload_status === 'ready' && file.scan_status === 'clean';
        const canDelete = ['owner', 'admin'].includes(role) || (role === 'member' && file.uploaded_by === userId);
        return <div key={file.id} className="py-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#F3EBDD] text-[#806236]"><FileText size={17} /></span>
            <span className="min-w-[130px] flex-1"><b className="block break-all text-sm">{file.file_name}</b><small className="text-xs text-[#4A5568]">{(file.byte_size / 1024).toLocaleString(undefined, { maximumFractionDigits: 1 })} KiB · Updated {new Date(file.updated_at).toLocaleDateString()}</small></span>
            <span className="rounded-full bg-[#F3F4F6] px-2.5 py-1 text-[10px] text-[#4A5568]">{status(file)}{selectedDeckId === file.id ? ' · Selected deck' : ''}</span>
            <button type="button" disabled={!ready || !!busyId} onClick={() => void act(file, 'download')} className="text-xs font-semibold text-[#9A7A45] disabled:opacity-50">Download</button>
            {canWrite && ready && file.kind === 'pitch_deck' && <button type="button" disabled={!!busyId} onClick={() => void act(file, 'select')} className="text-xs underline">{selectedDeckId === file.id ? 'Unselect deck' : 'Use as pitch deck'}</button>}
            {canWrite && (['owner', 'admin'].includes(role) || file.uploaded_by === userId) && file.upload_status === 'uploaded' && file.scan_status === 'failed' && <button type="button" disabled={!!busyId} onClick={() => void act(file, 'retry')} className="text-xs underline">Retry scan</button>}
            {canDelete && <button type="button" disabled={!!busyId} onClick={() => { if (window.confirm(`Delete ${file.file_name}? Any selected logo/deck reference will be removed.`)) void act(file, 'delete'); }} className="text-xs text-red-700 disabled:opacity-50">Delete</button>}
          </div>
          {rowError[file.id] && <p role="alert" className="mt-1 text-xs text-red-700">{rowError[file.id]}</p>}
        </div>;
      })}
    </div>
    {page && page.total > 10 && <div className="my-3 flex items-center justify-between text-xs"><button type="button" disabled={offset === 0 || loading} onClick={() => setOffset(Math.max(0, offset - 10))}>Previous</button><span>{offset + 1}–{Math.min(offset + 10, page.total)} of {page.total}</span><button type="button" disabled={offset + 10 >= page.total || loading} onClick={() => setOffset(offset + 10)}>Next</button></div>}
    {canWrite ? <div className="mt-3 flex flex-wrap items-start gap-2">
      <label className="text-xs">File type<select aria-label="Document kind" disabled={uploadBusy} value={kind} onChange={event => setKind(event.target.value as FileKind)} className="ml-2 rounded-lg border border-[#E5E1D8] p-2">{TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
      <FileUploadControl key={`${orgId}:${kind}`} orgId={orgId} kind={kind} onBusyChange={setUploadBusy} onReady={() => { setOffset(0); refresh(); }} />
    </div> : <p className="mt-3 text-xs text-[#4A5568]">View-only access: you can download ready files, but cannot upload, select, or delete them.</p>}
  </div>;
}
