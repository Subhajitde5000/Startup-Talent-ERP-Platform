'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { FileText, LockKeyhole } from 'lucide-react';
import { api, AccessRead, InvestorDocumentRead, OrganizationRead, RoomQuery } from '@/lib/api/client';
import { FieldError } from '@/components/async-state';
import { InvestorDisclaimer } from '@/app/investor/investor-data';
import { RoomShell as InvestorShell, Card, EmptyBlock, ErrorBlock, fieldErrorsFrom, buttonClass, date, inputClass, message, Pager, Preview, primaryClass, ResourceState, usePrivatePreview, useResource, useRoomOrganization } from './shared';

type Status = NonNullable<RoomQuery['status']>;
export function InvestorDataRoomList() {
  const organization = useRoomOrganization('investor_firm');
  return <InvestorShell active="Data rooms" module="Deal flow" title="Data room access" description="Manage personal document access, founder approvals and NDA status.">
    <ResourceState resource={organization}>{organization.data ? <AccessList org={organization.data} /> : <EmptyBlock title="No active investor firm" hint="An active investor-firm membership is required to request or use personal data-room access." />}</ResourceState>
  </InvestorShell>;
}
function AccessList({ org }: { org: OrganizationRead }) {
  const [status, setStatus] = useState<Status>('approved'), [offset, setOffset] = useState(0), [ndaOnly, setNdaOnly] = useState(false), [requesting, setRequesting] = useState(false);
  const write = ['owner', 'admin', 'member'].includes(org.my_role ?? '');
  const resource = useResource(useCallback((signal: AbortSignal) => api.dataRoomAccess.list({ status, limit: 20, offset }, signal), [status, offset]));
  const rows = resource.data?.items ?? [];
  const displayed = ndaOnly ? rows.filter(request => request.nda_required && !request.nda_signed_at) : rows;
  const effective = rows.filter(request => request.status === 'approved' && (!request.nda_required || request.nda_signed_at) && request.expires_at && Date.parse(request.expires_at) > Date.now());
  return <>
    <div className="mb-5 flex justify-end"><button className={buttonClass} disabled={!write} onClick={() => setRequesting(true)}>Request new access</button></div>
    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">{[['Rooms open on this page', effective.length], ['NDAs to acknowledge on this page', rows.filter(request => request.status === 'approved' && request.nda_required && !request.nda_signed_at).length], ['Expiring in 7 days on this page', rows.filter(request => request.status === 'approved' && request.expires_at && Date.parse(request.expires_at) > Date.now() && Date.parse(request.expires_at) <= Date.now() + 7 * 86400000).length], ['New documents', 'Not tracked']].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-[#E5E1D8] bg-white p-5"><span className="text-xs text-[#4A5568]">{label}</span><span className="serif mt-1 block text-3xl font-semibold">{resource.loading || resource.error || !resource.data ? '—' : value}</span></div>)}</div>
    <div className="mb-6 flex flex-wrap gap-2">{(['approved', 'pending', 'expired', 'revoked', 'denied'] as const).map(value => <button key={value} className={status === value ? primaryClass : buttonClass} onClick={() => { setStatus(value); setNdaOnly(false); setOffset(0); }}>{({ approved: 'Access granted', pending: 'Requested', expired: 'Expired', revoked: 'Revoked', denied: 'Declined' })[value]}</button>)}{status === 'approved' && <label className="flex items-center gap-2 px-2 text-xs"><input type="checkbox" checked={ndaOnly} onChange={event => setNdaOnly(event.target.checked)} />NDA pending on this page</label>}<button className={buttonClass} onClick={resource.reload}>Refresh</button></div>
    <ResourceState resource={resource}>{resource.data && <>{displayed.length === 0 ? <EmptyBlock title={ndaOnly ? 'No pending NDAs on this page' : `No ${status} requests`} hint={ndaOnly ? 'Try another page or remove the NDA filter.' : 'Request access to a startup’s data room to begin.'} /> : <div className="space-y-4">{displayed.map(request => <Card key={request.id} title={<div className="flex items-center gap-2"><span>{request.startup_name ?? 'Startup'}</span><span className="rounded-full bg-[#F3EBDD] px-2 py-1 text-xs">{request.status}</span></div>} action={<span className="text-xs text-[#4A5568]">Expires {date(request.expires_at)}</span>}>
      <div className="my-2 grid gap-4 border-y border-[#E5E1D8] py-3.5 text-xs sm:grid-cols-3"><div><span className="block text-[#4A5568]">Approved scope</span><b className="mt-1 block">{request.status === 'pending' ? 'Awaiting founder approval' : `${request.scope.length} explicitly approved folders`}</b></div><div><span className="block text-[#4A5568]">NDA status</span><b className="mt-1 block">{request.status === 'pending' ? 'Policy pinned on approval' : !request.nda_required ? 'Not required' : request.nda_signed_at ? `Acknowledged ${date(request.nda_signed_at)}` : 'Pending acknowledgment'}</b></div><div><span className="block text-[#4A5568]">Access policy</span><b className="mt-1 block">Personal access only · retrievals audited</b></div></div>
      <div className="mt-4 flex flex-wrap gap-3">{request.status === 'approved' && request.startup_org_id && <Link className={primaryClass} href={`/investor/data-rooms/${request.startup_org_id}${request.nda_required && !request.nda_signed_at ? '/nda' : ''}`}>{request.nda_required && !request.nda_signed_at ? 'Acknowledge NDA to open' : 'Open data room'}</Link>}<p className="self-center text-xs text-[#4A5568]">Scope extensions and follow-up messaging are not available here.</p></div>
    </Card>)}</div>}<Pager page={resource.data} offset={offset} onChange={setOffset} /></>}</ResourceState>
    <InvestorDisclaimer onLearnMore={undefined} />
    {requesting && <NewRequest onClose={() => setRequesting(false)} onSaved={() => { setStatus('pending'); setOffset(0); resource.reload(); }} />}
  </>;
}
function NewRequest({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [search, setSearch] = useState(''), [query, setQuery] = useState(''), [offset, setOffset] = useState(0), [startupId, setStartupId] = useState(''), [note, setNote] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [fields, setFields] = useState<Record<string, string>>({});
  const resource = useResource(useCallback((signal: AbortSignal) => api.investorDiscovery.list({ q: query || undefined, limit: 20, offset }, signal), [query, offset]));
  return <div className="fixed inset-0 z-50 grid place-items-center overflow-auto bg-ink/50 p-4"><section role="dialog" aria-modal="true" aria-label="Request data room access" className="max-h-[90vh] w-full max-w-xl overflow-auto rounded-2xl bg-white p-6"><h2 className="serif mb-4 text-xl">Request data room access</h2>
    <form className="mb-3 flex gap-2" onSubmit={event => { event.preventDefault(); setQuery(search); setOffset(0); }}><input aria-label="Search startups" className={inputClass} maxLength={200} value={search} onChange={event => setSearch(event.target.value)} /><button className={buttonClass}>Search</button></form>
    <ResourceState resource={resource}>{resource.data && <><div className="max-h-52 space-y-2 overflow-auto">{resource.data.items.length === 0 && <EmptyBlock title="No discoverable startups match" />}{resource.data.items.map(startup => <label key={startup.org_id} className="flex gap-2 rounded-lg border p-3 text-xs"><input type="radio" name="startup" checked={startupId === startup.org_id} onChange={() => setStartupId(startup.org_id)} disabled={busy} />{startup.name}</label>)}</div><Pager page={resource.data} offset={offset} onChange={setOffset} /></>}</ResourceState>
    <form className="mt-4 space-y-3" onSubmit={async event => { event.preventDefault(); if (busy) return; setBusy(true); setError(''); setFields({}); try { await api.dataRoomAccess.create({ startup_org_id: startupId, message: note || null }); onSaved(); onClose(); } catch (error) { setError(message(error)); setFields(fieldErrorsFrom(error)); } finally { setBusy(false); } }}>
      <FieldError>{fields.startup_org_id}</FieldError><label className="block text-xs">Message to the startup<textarea className={inputClass} maxLength={2000} value={note} disabled={busy} onChange={event => setNote(event.target.value)} /></label><FieldError>{fields.message}</FieldError><p className="text-xs text-[#4A5568]">The founder chooses the approved folders and expiry. A startup without an active configured room cannot receive this request.</p>{error && <ErrorBlock message={error} />}<div className="flex justify-end gap-2"><button className={buttonClass} type="button" disabled={busy} onClick={onClose}>Cancel</button><button className={primaryClass} disabled={busy || !startupId}>{busy ? 'Requesting…' : 'Request access'}</button></div>
    </form>
  </section></div>;
}
async function grantForStartup(startupId: string, signal: AbortSignal): Promise<AccessRead | null> {
  const result = await api.dataRoomAccess.list({ startup_org_id: startupId, limit: 20 }, signal);
  return result.items.find(request => request.status === 'approved') ?? result.items[0] ?? null;
}
export function InvestorDataRoomViewer({ startupId }: { startupId: string }) {
  const resource = useResource(useCallback((signal: AbortSignal) => grantForStartup(startupId, signal), [startupId]));
  const { reload: recheckAccess } = resource;
  // Returning to a backgrounded confidential tab always rechecks authorization and drops its blob URL.
  useEffect(() => {
    const recheck = () => { if (document.visibilityState === 'visible') recheckAccess(); };
    document.addEventListener('visibilitychange', recheck);
    return () => document.removeEventListener('visibilitychange', recheck);
  }, [recheckAccess]);
  return <InvestorShell active="Data rooms" module="Deal flow" title={`${resource.data?.startup_name ?? 'Startup'} · Data room`} description="View documents shared under your personal grant." backHref="/investor/data-rooms" backLabel="← Back to Data rooms" actions={<button className={buttonClass} onClick={resource.reload}>Recheck access</button>}>
    <ResourceState resource={resource}>{resource.data ? resource.data.status !== 'approved' ? <EmptyBlock title={`Access ${resource.data.status}`} hint="An effective personal approval is required to open this room." /> : resource.data.nda_required && !resource.data.nda_signed_at ? <EmptyBlock title="NDA acknowledgment required"><Link className={primaryClass} href={`/investor/data-rooms/${startupId}/nda`}>Review pinned NDA</Link></EmptyBlock> : <RoomViewer key={resource.data.id} startupId={startupId} grant={resource.data} onInvalid={resource.reload} /> : <EmptyBlock title="No personal access request" hint="Request access from your data-room list; no sample room is substituted for this URL."><Link className={buttonClass} href="/investor/data-rooms">Back to data rooms</Link></EmptyBlock>}</ResourceState><InvestorDisclaimer onLearnMore={undefined} />
  </InvestorShell>;
}
function RoomViewer({ startupId, grant, onInvalid }: { startupId: string; grant: AccessRead; onInvalid: () => void }) {
  const [folderId, setFolderId] = useState(''), [offset, setOffset] = useState(0), [selected, setSelected] = useState<InvestorDocumentRead | null>(null);
  const resource = useResource(useCallback(async (signal: AbortSignal) => {
    const [room, folders] = await Promise.all([api.dataRoomAccess.room(startupId, signal), api.dataRoomAccess.folders(startupId, { limit: 100 }, signal)]);
    return { room, folders };
  }, [startupId])); // A grant has at most 50 exact folder IDs.
  const documents = useResource(useCallback(async (signal: AbortSignal) => folderId ? api.dataRoomAccess.documents(startupId, { folder_id: folderId, limit: 20, offset }, signal) : null, [startupId, folderId, offset]));
  const previewLoad = useCallback((signal: AbortSignal) => api.dataRooms.content(selected!.id, undefined, signal), [selected]);
  const preview = usePrivatePreview(selected ? previewLoad : null);
  useEffect(() => { if (resource.data) setFolderId(resource.data.folders.items[0]?.id ?? ''); }, [resource.data]);
  useEffect(() => {
    const expiry = grant.expires_at ? Date.parse(grant.expires_at) - Date.now() : 0;
    const timer = setTimeout(onInvalid, Math.min(Math.max(expiry, 0), 2147483647));
    const controller = new AbortController();
    const poll = setInterval(() => { api.dataRoomAccess.room(startupId, controller.signal).catch(() => { if (!controller.signal.aborted) onInvalid(); }); }, 30000);
    return () => { clearTimeout(timer); clearInterval(poll); controller.abort(); };
  }, [grant.expires_at, onInvalid, startupId]);
  return <><div className="mb-6 rounded-lg border border-[#E7D4B0] bg-[#FFF8E8] p-3 text-xs text-[#806236]"><LockKeyhole className="mr-2 inline" size={15} />Confidential · {grant.nda_required ? `NDA acknowledged ${date(grant.nda_signed_at)}` : 'No NDA required by this grant'} · Expires {date(grant.expires_at)}. Retrievals are logged. No watermark or download-prevention guarantee.</div>
    <ResourceState resource={resource}><div className="grid min-h-[640px] gap-4 lg:grid-cols-[200px_240px_1fr]"><Card title="Folders"><div className="space-y-1">{resource.data?.folders.items.length === 0 && <p className="text-xs">No approved folders remain.</p>}{resource.data?.folders.items.map(folder => <button key={folder.id} className={`w-full rounded-lg px-3 py-2 text-left text-xs ${folder.id === folderId ? 'bg-[#F3EBDD] font-semibold' : 'hover:bg-[#FAF8F4]'}`} onClick={() => { setSelected(null); setFolderId(folder.id); setOffset(0); }}>{folder.name}</button>)}</div></Card>
      <Card title={resource.data?.folders.items.find(folder => folder.id === folderId)?.name ?? 'Documents'}><ResourceState resource={documents}>{documents.data && <>{documents.data.items.length === 0 ? <EmptyBlock title="No shared documents" hint="Private documents are not included in this view." /> : <div className="space-y-2">{documents.data.items.map(doc => <button className={`w-full rounded-lg border p-2.5 text-left text-xs ${selected?.id === doc.id ? 'bg-[#F3EBDD]' : 'bg-white'}`} key={doc.id} onClick={() => setSelected(doc)}><FileText size={15} className="mr-1 inline" />{doc.name}<span className="mt-1 block text-[10px] text-[#4A5568]">{doc.version} · {date(doc.updated_at)}</span></button>)}</div>}<Pager page={documents.data} offset={offset} onChange={value => { setSelected(null); setOffset(value); }} /></>}</ResourceState></Card>
      <div className="flex flex-col justify-between rounded-xl border border-[#E5E1D8] bg-white p-5"><div><b className="mb-4 block text-sm">{selected?.name ?? 'Document preview'}</b><Preview preview={preview} title={selected?.name ?? 'Protected document'} /></div><div className="mt-6 border-t pt-4 text-xs text-[#4A5568]">Private document notes, page-review tracking and founder questions are not available in this view.</div></div>
    </div></ResourceState>
  </>;
}
export function InvestorNda({ startupId }: { startupId: string }) {
  const organization = useRoomOrganization('investor_firm');
  const resource = useResource(useCallback((signal: AbortSignal) => grantForStartup(startupId, signal), [startupId]));
  return <InvestorShell active="Data rooms" module="Deal flow" title={`NDA · ${resource.data?.startup_name ?? 'Startup'}`} description="Review the exact agreement pinned to your approval, then record your acknowledgment." backHref="/investor/data-rooms" backLabel="← Back to Data rooms">
    <div className="mx-auto max-w-3xl space-y-6"><ResourceState resource={organization}><ResourceState resource={resource}>{resource.data && organization.data ? resource.data.status !== 'approved' ? <EmptyBlock title={`Access ${resource.data.status}`} hint="Only a current approved personal grant can acknowledge an NDA." /> : !resource.data.nda_required ? <EmptyBlock title="No NDA required by this grant"><Link className={primaryClass} href={`/investor/data-rooms/${startupId}`}>Enter data room</Link></EmptyBlock> : <NdaForm key={resource.data.id} grant={resource.data} org={organization.data} onSaved={resource.reload} /> : <EmptyBlock title="No approved personal access request" hint="Return to your data-room list to request access." />}</ResourceState></ResourceState><InvestorDisclaimer onLearnMore={undefined} /></div>
  </InvestorShell>;
}
function NdaForm({ grant, org, onSaved }: { grant: AccessRead; org: OrganizationRead; onSaved: () => void }) {
  const [legalName, setLegalName] = useState(grant.nda_legal_name ?? ''), [agreed, setAgreed] = useState(false), [purposeAgreed, setPurposeAgreed] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [fields, setFields] = useState<Record<string, string>>({});
  const loader = useCallback((signal: AbortSignal) => api.dataRoomAccess.nda(grant.id, signal), [grant.id]);
  const preview = usePrivatePreview(loader);
  const write = ['owner', 'admin', 'member'].includes(org.my_role ?? '');
  return <><div className="flex flex-wrap justify-between gap-2 text-xs font-semibold">{['1. Review agreement', '2. Confirm legal name', '3. Acknowledge terms', '4. Access granted'].map((step, index) => <span key={step} className={`rounded-full px-3 py-1.5 ${index === 3 && !grant.nda_signed_at ? 'bg-[#F3F4F6]' : 'bg-[#F3EBDD] text-[#806236]'}`}>{step}</span>)}</div>
    <Card title="Key terms & obligations"><p className="text-xs leading-relaxed">The startup’s pinned PDF below is the agreement to review. No generated summary overrides its terms. Your acknowledgment, legal name and server timestamp are recorded; this is not a certified electronic signature.</p></Card>
    <Card title="Full agreement · pinned to your grant"><p className="mb-3 break-all text-xs text-[#4A5568]">SHA-256: {grant.nda_checksum}</p><Preview preview={preview} title="Pinned NDA.pdf" /></Card>
    <Card title="Signatory acknowledgment"><form className="space-y-4" onSubmit={async event => { event.preventDefault(); if (busy || grant.nda_signed_at) return; setBusy(true); setError(''); setFields({}); try { await api.dataRoomAccess.acceptNda(grant.id, { nda_file_id: grant.nda_file_id!, nda_checksum: grant.nda_checksum!, legal_name: legalName, agreed, purpose_agreed: purposeAgreed }); onSaved(); } catch (error) { setError(message(error)); setFields(fieldErrorsFrom(error)); } finally { setBusy(false); } }}>
      {grant.nda_signed_at ? <p className="rounded-lg bg-[#E7F3EC] p-3 text-xs">Acknowledged by {grant.nda_legal_name} on {date(grant.nda_signed_at)}. Evidence is immutable.</p> : <fieldset disabled={busy || !write} className="space-y-4"><label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={agreed} onChange={event => setAgreed(event.target.checked)} />I have read and agree to the pinned NDA.</label><FieldError>{fields.agreed}</FieldError><label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={purposeAgreed} onChange={event => setPurposeAgreed(event.target.checked)} />I will use the materials solely to evaluate an investment in {grant.startup_name}.</label><FieldError>{fields.purpose_agreed}</FieldError><label className="block text-xs">Full legal name<input className={inputClass} required maxLength={160} value={legalName} onChange={event => setLegalName(event.target.value)} /></label><FieldError>{fields.legal_name}</FieldError></fieldset>}
      <FieldError>{fields.nda_file_id || fields.nda_checksum}</FieldError>{!write && !grant.nda_signed_at && <p className="text-xs">Your firm membership is read-only. A writable membership is required to submit your personal acknowledgment.</p>}{error && <ErrorBlock message={error} />}<div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"><Link className={buttonClass} href="/investor/data-rooms">Return without accepting</Link>{grant.nda_signed_at ? <Link className={primaryClass} href={`/investor/data-rooms/${grant.startup_org_id}`}>Enter data room</Link> : <button className={primaryClass} disabled={busy || !write || !agreed || !purposeAgreed || !legalName.trim() || !preview.url}>{busy ? 'Recording…' : 'Acknowledge & continue'}</button>}</div>
    </form></Card>
  </>;
}
