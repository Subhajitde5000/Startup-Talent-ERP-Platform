'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
import { api, ApiError, FILE_ACCEPT, fileFieldErrors, FileKind, FileRead } from '@/lib/api/client';

type Props = {
  orgId?: string;
  kind: FileKind;
  disabled?: boolean;
  label?: string;
  children?: ReactNode;
  buttonClassName?: string;
  onReady: (file: FileRead) => Promise<void> | void;
  onBusyChange?: (busy: boolean) => void;
};

export default function FileUploadControl({ orgId, kind, disabled, label = 'Upload document', children, buttonClassName, onReady, onBusyChange }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const [busy, setBusy] = useState(false);
  const [candidate, setCandidate] = useState<FileRead | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; controller.current?.abort(); };
  }, []);

  async function run(file?: File) {
    if (busy || disabled) return;
    controller.current?.abort();
    const active = new AbortController();
    controller.current = active;
    setBusy(true); onBusyChange?.(true); setError(''); setFields({});
    setMessage(file ? 'Uploading to private storage…' : 'Checking file…');
    if (file) setCandidate(null);
    try {
      let row = file
        ? await (orgId ? api.files.uploadOrganization(orgId, kind, file, active.signal) : api.files.uploadPersonal(kind, file, active.signal))
        : candidate;
      if (!row) return;
      setCandidate(row);
      if (!file && row.upload_status !== 'ready') await api.files.confirm(row.id, active.signal);
      if (active.signal.aborted) return;
      // Bounded polling. No success until ready+clean and attachment saves.
      for (let attempt = 0; attempt < 30 && row.upload_status !== 'ready'; attempt++) {
        setMessage('Uploaded. Waiting for validation and scanning…');
        await new Promise<void>((resolve) => {
          const finish = () => { clearTimeout(timer); active.signal.removeEventListener('abort', finish); resolve(); };
          const timer = setTimeout(finish, 2000);
          active.signal.addEventListener('abort', finish, { once: true });
        });
        if (active.signal.aborted) return;
        row = await api.files.get(row.id, active.signal);
        setCandidate(row);
        if (row.upload_status === 'rejected' || row.upload_status === 'expired' || row.scan_status === 'infected') {
          throw new ApiError(422, { code: 'FILE_REJECTED', message: 'The file failed validation or scanning. Select a different file.' });
        }
        if (row.scan_status === 'failed') {
          throw new ApiError(503, { code: 'FILE_SCAN_FAILED', message: 'Scanning is unavailable. This file is not downloadable. Retry scanning later.' });
        }
      }
      if (row.upload_status !== 'ready' || row.scan_status !== 'clean') {
        setMessage('Still processing. Check again shortly; the file is not yet available.');
        return;
      }
      await onReady(row);
      if (!mounted.current) return;
      setCandidate(null); setMessage('File ready and saved.');
    } catch (cause) {
      if (active.signal.aborted || !mounted.current) return;
      setError(cause instanceof ApiError ? cause.message : 'Could not save the file. Please retry.');
      setFields(fileFieldErrors(cause)); setMessage('');
    } finally {
      if (mounted.current) { setBusy(false); onBusyChange?.(false); }
    }
  }

  return <div className="text-xs">
    <input ref={input} type="file" accept={FILE_ACCEPT[kind]} className="sr-only" aria-label={label} disabled={disabled || busy}
      onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void run(file); }} />
    <button type="button" disabled={disabled || busy} onClick={() => input.current?.click()}
      className={buttonClassName || 'inline-flex min-h-10 items-center rounded-lg border border-[#E5E1D8] px-3 text-sm font-medium disabled:opacity-50'}>
      {busy ? 'Processing…' : children || label}
    </button>
    {candidate && !busy && !['rejected', 'expired'].includes(candidate.upload_status) && <button type="button" disabled={disabled} className="ml-2 underline disabled:opacity-50" onClick={() => void run()}>
      {candidate.upload_status === 'ready' ? 'Retry selection' : 'Retry / check scan'}
    </button>}
    {message && <p role="status" className="mt-1 text-[#4A5568]">{message}</p>}
    {error && <p role="alert" className="mt-1 text-red-700">{error}</p>}
    {Object.entries(fields).map(([field, detail]) => <p key={field} className="mt-1 text-red-700">{field.replaceAll('_', ' ')}: {detail}</p>)}
  </div>;
}
