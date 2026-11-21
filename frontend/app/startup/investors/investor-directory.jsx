'use client';

import {useEffect, useState} from 'react';
import Link from 'next/link';
import {ArrowRight, Search, ShieldCheck} from 'lucide-react';
import {Card} from '../../../components';
import {api, ApiError} from '@/lib/api/client';
import {useAuth} from '@/lib/auth-context';

const messageFor = error => error instanceof ApiError ? error.message : 'Unable to load investors. Please try again.';
const location = investor => [investor.city, investor.region, investor.country].filter(Boolean).join(', ') || 'Location not provided';
const safeWebsite = url => /^https?:\/\//i.test(url || '') ? url : null;

function InvestorCard({investor}) {
  return <article className="rounded-xl border border-[#E5E1D8] bg-white p-4 sm:p-5">
    <div className="flex flex-wrap items-start gap-3">
      <span className="grid h-12 w-12 place-items-center rounded-xl bg-[#F3EBDD] font-serif text-lg font-semibold text-[#806236]">{investor.logo_initials || investor.name.slice(0, 1).toUpperCase()}</span>
      <div className="min-w-[180px] flex-1"><div className="flex flex-wrap items-center gap-2">
        <Link href={`/startup/investors/${investor.id}`} className="font-semibold hover:underline">{investor.name}</Link>
        <span className="inline-flex items-center gap-1 rounded-full bg-[#F3EBDD] px-2 py-1 text-[10px] font-semibold text-[#806236]"><ShieldCheck size={12}/>Verified organization</span>
      </div><p className="mt-1 text-xs text-[#4A5568]">{location(investor)}</p>
      <p className="mt-1 text-xs"><b>Typical ticket:</b> Not available</p></div>
    </div>
    <p className="mt-3 text-xs leading-5 text-[#4A5568]">{investor.summary || 'No description provided.'}</p>
    <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-[#E5E1D8] pt-3"><Link href={`/startup/investors/${investor.id}`} className="inline-flex min-h-9 items-center rounded-lg border border-[#E5E1D8] px-3 text-xs font-semibold">View profile</Link></div>
  </article>;
}

export default function InvestorDirectory({detail, id}) {
  const {user} = useAuth();
  const [orgs, setOrgs] = useState([]);
  const [org, setOrg] = useState(null);
  const [orgVersion, setOrgVersion] = useState(0);
  const [version, setVersion] = useState(0);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [draft, setDraft] = useState({q: '', city: '', country: ''});
  const [filters, setFilters] = useState({q: '', city: '', country: ''});
  const [offset, setOffset] = useState(0);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [investor, setInvestor] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading'); setError('');
    api.organizations.mine(controller.signal).then(all => {
      const startups = all.filter(row => row.type === 'startup');
      setOrgs(startups); setOrg(startups[0] || null);
      if (!startups.length) {setStatus('empty'); setError('No startup organization found.');}
    }).catch(err => {if (!controller.signal.aborted) {setStatus('error'); setError(messageFor(err));}});
    return () => controller.abort();
  }, [user?.id, orgVersion]);

  useEffect(() => {
    if (!org) return;
    const controller = new AbortController();
    setStatus('loading'); setError(''); setFieldErrors({}); setInvestor(null);
    const request = detail
      ? api.investorDirectory.get(org.id, id, controller.signal)
      : api.investorDirectory.list(org.id, {limit: 20, offset, q: filters.q || undefined, city: filters.city || undefined, country: filters.country || undefined}, controller.signal);
    request.then(data => {
      if (controller.signal.aborted) return;
      if (detail) setInvestor(data);
      else {setItems(data.items); setTotal(data.total);}
      setStatus('ready');
    }).catch(err => {
      if (controller.signal.aborted) return;
      setStatus('error'); setError(messageFor(err));
      if (err instanceof ApiError && Array.isArray(err.details)) {
        const fields = {};
        err.details.forEach(item => {if (item.loc?.[0] === 'query' && item.loc?.[1]) fields[item.loc[1]] = item.msg;});
        setFieldErrors(fields);
      }
    });
    return () => controller.abort();
  }, [org, detail, id, filters, offset, version]);

  const search = event => {event.preventDefault(); setOffset(0); setFilters({...draft, q: draft.q.trim(), city: draft.city.trim(), country: draft.country.trim().toUpperCase()});};
  const reset = () => {const empty = {q: '', city: '', country: ''}; setDraft(empty); setOffset(0); setFilters(empty);};
  const retry = () => {if (org) setVersion(value => value + 1); else setOrgVersion(value => value + 1);};
  const website = safeWebsite(investor?.website);
  return <>
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4"><div>
      <p className="text-sm text-[#4A5568]">{org?.name || 'Startup'} <span className="mx-2 text-[#B8955A]">·</span> Investors</p>
      <h1 className="serif mt-1 text-[30px] font-semibold">{detail ? (investor?.name || 'Investor profile') : 'Find investors'}</h1>
      <p className="mt-1 text-sm text-[#4A5568]">{detail ? 'Verified investor organization' : 'Browse verified investor firms.'}</p>
      {orgs.length > 1 && <label className="mt-2 block text-xs">Organization <select value={org?.id || ''} onChange={e => {setOrg(orgs.find(row => row.id === e.target.value)); setOffset(0);}} className="ml-2 rounded border p-1">{orgs.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>}
    </div><Link href={detail ? '/startup/investors/discover' : '/startup/investors/settings'} className="rounded-lg border border-[#E5E1D8] bg-white px-3 py-2 text-xs font-semibold">{detail ? '← Find investors' : 'Visibility settings'}</Link></div>
    {!detail && <div className="grid items-start gap-5 lg:grid-cols-4"><aside className="rounded-xl border border-[#E5E1D8] bg-white p-5">
      <h2 className="font-semibold">Investor filters</h2>
      <form id="investor-filters" onSubmit={search} className="mt-4 space-y-4">
        <label className="block text-xs font-semibold">City <input value={draft.city} onChange={e => setDraft({...draft, city: e.target.value})} maxLength={100} className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs"/>{fieldErrors.city && <span role="alert" className="text-red-700">{fieldErrors.city}</span>}</label>
        <label className="block text-xs font-semibold">Country code <input value={draft.country} onChange={e => setDraft({...draft, country: e.target.value.toUpperCase()})} maxLength={2} pattern="[A-Za-z]{2}" placeholder="IN" className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs"/>{fieldErrors.country && <span role="alert" className="text-red-700">{fieldErrors.country}</span>}</label>
        <div className="flex gap-2"><button type="submit" className="min-h-9 rounded-lg bg-ink px-3 text-xs font-semibold text-white">Apply</button><button type="button" onClick={reset} className="min-h-9 rounded-lg border px-3 text-xs">Reset</button></div>
      </form><p className="mt-4 text-xs text-[#4A5568]">Verified organizations only. Stage, sector and ticket filters are not available yet.</p>
    </aside><div className="space-y-3 lg:col-span-3">
      <label className="block text-xs font-semibold">Search verified investors <div className="relative mt-2"><Search className="absolute left-3 top-3 text-[#A0A7B4]" size={16}/><input form="investor-filters" value={draft.q} onChange={e => setDraft({...draft, q: e.target.value})} maxLength={100} placeholder="Search verified investors" className="h-11 w-full rounded-lg border border-[#E5E1D8] bg-white pl-9 text-sm"/></div>{fieldErrors.q && <span role="alert" className="text-red-700">{fieldErrors.q}</span>}</label>
      {status === 'loading' && <p role="status">Loading investors…</p>}
      {(status === 'error' || status === 'empty') && <div role="alert" className="rounded-lg border bg-white p-4 text-sm">{error}{status === 'error' && <button onClick={retry} className="ml-3 underline">Try again</button>}</div>}
      {status === 'ready' && !items.length && <Card title="No investors found"><p className="text-sm text-[#4A5568]">Try a different search or check back later.</p></Card>}
      {status === 'ready' && items.map(row => <InvestorCard key={row.id} investor={row}/>)}
      {status === 'ready' && total > 20 && <div className="flex gap-3 text-sm"><button disabled={!offset} onClick={() => setOffset(Math.max(0, offset - 20))}>Previous</button><span>{offset + 1}–{Math.min(offset + 20, total)} of {total}</span><button disabled={offset + 20 >= total} onClick={() => setOffset(offset + 20)}>Next</button></div>}
    </div></div>}
    {detail && <>
      {status === 'loading' && <p role="status">Loading investor profile…</p>}
      {(status === 'error' || status === 'empty') && <div role="alert" className="rounded-lg border bg-white p-4 text-sm">{error}{status === 'error' && <button onClick={retry} className="ml-3 underline">Try again</button>}</div>}
      {status === 'ready' && investor && <div className="grid items-start gap-5 xl:grid-cols-3"><div className="space-y-5 xl:col-span-2">
        <Card title="Investor profile"><div className="flex items-start gap-4"><span className="grid h-16 w-16 place-items-center rounded-xl bg-[#F3EBDD] font-serif text-2xl">{investor.logo_initials || investor.name.slice(0, 1).toUpperCase()}</span><div><h2 className="text-lg font-semibold">{investor.name}</h2><span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#F3EBDD] px-2 py-1 text-[10px] font-semibold text-[#806236]"><ShieldCheck size={12}/>Verified organization</span><p className="mt-2 text-xs text-[#4A5568]">{location(investor)} · Typical ticket not available</p></div></div><p className="mt-5 text-sm leading-6 text-[#4A5568]">{investor.summary || 'No description provided.'}</p>{website && <a href={website} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-xs font-semibold text-[#9A7A45]">Visit website <ArrowRight className="inline" size={12}/></a>}</Card>
        <Card title="Portfolio and track record"><p className="text-sm text-[#4A5568]">Portfolio information is not available yet.</p></Card>
        <Card title="Activity on your startup"><p className="text-sm text-[#4A5568]">Investor activity is not available yet.</p></Card>
        <Card title="Conversation"><p className="text-sm text-[#4A5568]">Investor messages are not available yet.</p></Card>
      </div><aside className="space-y-5"><Card title="Pipeline status"><p className="text-sm text-[#4A5568]">Pipeline information is not available yet.</p></Card><Card title="Access summary"><p className="text-sm text-[#4A5568]">Data-room access information is not available yet.</p></Card></aside></div>}
    </>}
    <p className="mt-5 text-[10px] leading-4 text-[#4A5568]">The platform introduces startups and investors. It is not a broker or adviser unless licensed. Get your own legal and financial advice.</p>
  </>;
}
