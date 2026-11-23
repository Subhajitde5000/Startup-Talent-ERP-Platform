'use client';

import { ComponentProps, FormEvent, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, OrganizationRead, RoomPage, FolderRead } from '@/lib/api/client';
import { useAuth } from '@/lib/auth-context';
import { LoadingBlock, ErrorBlock as LegacyError, EmptyBlock as LegacyEmpty, FieldError, fieldErrorsFrom as legacyFieldErrors } from '@/components/async-state';
import { Card as LegacyCard, InvestorShell as LegacyShell } from '@/components';

// Scoped typed adapters for legacy JavaScript UI components (no global UI changes).
export function EmptyBlock({ title, hint, children }: { title: string; hint?: string; children?: ReactNode }) { return <LegacyEmpty title={title} hint={hint}>{children}</LegacyEmpty>; }
export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) { return <LegacyError message={message} onRetry={onRetry} />; }
export function Card({ title, action, children }: { title: ReactNode; action?: ReactNode; children: ReactNode }) { return <LegacyCard id={undefined} title={title} action={action}>{children}</LegacyCard>; }
type ShellProps = Omit<ComponentProps<typeof LegacyShell>, 'actions' | 'subNav'> & { actions?: ReactNode; subNav?: ReactNode };
export function RoomShell({ actions, subNav, ...props }: ShellProps) { return <LegacyShell {...props} actions={actions} subNav={subNav} />; }
export function fieldErrorsFrom(error: unknown): Record<string, string> { return legacyFieldErrors(error) as Record<string, string>; }

export const inputClass = 'mt-1 w-full rounded-lg border border-[#E5E1D8] bg-white p-2.5 text-xs disabled:opacity-50';
export const buttonClass = 'inline-flex min-h-9 items-center justify-center rounded-lg border border-[#E5E1D8] bg-white px-3 py-2 text-xs font-semibold hover:bg-[#FAF8F4] disabled:cursor-not-allowed disabled:opacity-50';
export const primaryClass = buttonClass + ' !bg-ink text-white';
export function date(value?: string | null) { return value ? new Date(value).toLocaleString() : '—'; }
export function message(error: unknown) { return error instanceof Error ? error.message : 'Could not complete this action.'; }
export function useResource<T>(loader: (signal: AbortSignal) => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState(0);
  const reload = useCallback(() => setKey(k => k + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setData(null);
    loader(controller.signal).then(value => {
      if (!controller.signal.aborted) setData(value);
    }).catch(error => {
      if (!controller.signal.aborted) setError(message(error));
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [loader, key]);
  return { data, error, loading, reload };
}
export function useRoomOrganization(type: 'startup' | 'investor_firm') {
  const { user } = useAuth();
  return useResource(useCallback(async (signal: AbortSignal) => {
    if (!user) return null;
    const orgs = await api.organizations.mine(signal);
    return orgs.find((org: OrganizationRead) => org.type === type && org.status === 'active') ?? null;
  }, [type, user]));
}
export function ResourceState({ resource, children }: { resource: { loading: boolean; error: string; reload: () => void }; children: ReactNode }) {
  if (resource.loading) return <LoadingBlock label="Loading data room…" />;
  if (resource.error) return <ErrorBlock message={resource.error} onRetry={resource.reload} />;
  return <>{children}</>;
}
export function Pager({ page, offset, onChange }: { page: { total: number; limit: number }; offset: number; onChange: (offset: number) => void }) {
  return <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-2 text-xs">
    <span>{page.total ? `${offset + 1}–${Math.min(offset + page.limit, page.total)} of ${page.total}` : '0 records'}</span>
    <div className="flex gap-2"><button className={buttonClass} disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - page.limit))}>Previous</button><button className={buttonClass} disabled={offset + page.limit >= page.total} onClick={() => onChange(offset + page.limit)}>Next</button></div>
  </nav>;
}
export type FormField = { name: string; label: string; type?: 'text' | 'textarea' | 'checkbox' | 'datetime-local' | 'select' | 'multi'; value?: string | string[] | boolean; required?: boolean; maxLength?: number; options?: { value: string; label: string }[] };
export type Values = Record<string, FormDataEntryValue | FormDataEntryValue[]>;
export function DialogForm({ title, fields = [], children, submitLabel = 'Save', onSubmit, onClose }: { title: string; fields?: FormField[]; children?: ReactNode; submitLabel?: string; onSubmit: (values: Values) => Promise<void>; onClose: () => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { formRef.current?.querySelector<HTMLElement>('input,select,textarea,button')?.focus(); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const form = new FormData(event.currentTarget), values: Values = {};
    fields.forEach(field => { values[field.name] = field.type === 'multi' ? form.getAll(field.name) : form.get(field.name) ?? ''; });
    setBusy(true); setError(''); setErrors({});
    try { await onSubmit(values); onClose(); }
    catch (error) { setError(message(error)); setErrors(fieldErrorsFrom(error)); }
    finally { setBusy(false); }
  }
  return <div className="fixed inset-0 z-50 grid place-items-center overflow-auto bg-ink/50 p-4 backdrop-blur-sm"><section role="dialog" aria-modal="true" aria-label={title} className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl bg-white p-6 shadow-xl">
    <h2 className="serif mb-4 text-xl font-bold">{title}</h2><form ref={formRef} onSubmit={submit}>
      <fieldset disabled={busy} className="space-y-3">{fields.map(field => <div key={field.name}>
        {field.type === 'multi' ? <fieldset><legend className="text-xs font-medium">{field.label}</legend>{field.options?.map(option => <label key={option.value} className="mt-2 flex items-center gap-2 text-xs"><input name={field.name} type="checkbox" value={option.value} defaultChecked={Array.isArray(field.value) && field.value.includes(option.value)} />{option.label}</label>)}</fieldset> : <label className="block text-xs font-medium">
          {field.type === 'checkbox' ? <><input name={field.name} type="checkbox" defaultChecked={!!field.value} className="mr-2" />{field.label}</> : <>{field.label}{field.type === 'select' ? <select name={field.name} required={field.required} defaultValue={String(field.value ?? '')} className={inputClass}>{field.options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : field.type === 'textarea' ? <textarea name={field.name} defaultValue={String(field.value ?? '')} maxLength={field.maxLength} className={inputClass} /> : <input name={field.name} type={field.type ?? 'text'} defaultValue={String(field.value ?? '')} maxLength={field.maxLength} required={field.required} className={inputClass} />}</>}
        </label>}<FieldError>{errors[field.name]}</FieldError>
      </div>)}{children}</fieldset>
      {error && <div className="mt-3"><ErrorBlock message={error} /></div>}
      <div className="mt-5 flex justify-end gap-2"><button type="button" disabled={busy} onClick={onClose} className={buttonClass}>Cancel</button><button type="submit" disabled={busy} className={primaryClass}>{busy ? 'Saving…' : submitLabel}</button></div>
    </form>
  </section></div>;
}
export async function allFolders(orgId: string, signal?: AbortSignal): Promise<FolderRead[]> {
  const first = await api.dataRooms.folders(orgId, { limit: 100 }, signal);
  const rest = await Promise.all(Array.from({ length: Math.ceil(first.total / 100) - 1 }, (_, index) => api.dataRooms.folders(orgId, { limit: 100, offset: (index + 1) * 100 }, signal)));
  return [...first.items, ...rest.flatMap(p => p.items)];
}
export function usePrivatePreview(load: ((signal: AbortSignal) => Promise<Blob>) | null) {
  const [url, setUrl] = useState(''), [mime, setMime] = useState(''), [error, setError] = useState(''), [loading, setLoading] = useState(false);
  useEffect(() => {
    const controller = new AbortController(); let objectUrl = '';
    setUrl(''); setMime(''); setError(''); setLoading(!!load);
    if (load) load(controller.signal).then(blob => {
      if (!controller.signal.aborted) { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); setMime(blob.type); }
    }).catch(error => { if (!controller.signal.aborted) setError(message(error)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [load]);
  return { url, mime, error, loading };
}
export function Preview({ preview, title }: { preview: ReturnType<typeof usePrivatePreview>; title: string }) {
  if (preview.loading) return <LoadingBlock label="Retrieving protected content…" rows={1} />;
  if (preview.error) return <ErrorBlock message={preview.error} />;
  if (!preview.url) return <EmptyBlock title="Select a document to preview" />;
  return <div className="space-y-3"><p className="text-xs text-[#4A5568]">Confidential. This retrieval is audited. Authorized recipients can save or capture content; this is not DRM.</p>
    {preview.mime === 'application/pdf' || preview.mime.startsWith('image/') || preview.mime === 'text/plain' ? <iframe title={title} src={preview.url} sandbox="allow-same-origin" referrerPolicy="no-referrer" className="h-[480px] w-full rounded-xl border bg-[#F4F1EA]" /> : <EmptyBlock title="Inline preview is unavailable for this file type" hint="Use the authorized file link to open it in a compatible application." />}
    <a href={preview.url} download={title} className={buttonClass}>Open / save authorized file</a>
  </div>;
}
export function emptyPage<T>(): RoomPage<T> { return { items: [], total: 0, limit: 20, offset: 0 }; }
export function isNotFound(error: unknown) { return error instanceof ApiError && error.status === 404; }
