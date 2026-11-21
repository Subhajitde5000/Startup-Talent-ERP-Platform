'use client';

import {useCallback, useEffect, useState} from 'react';
import Link from 'next/link';
import {ArrowRight, Plus, X} from 'lucide-react';
import {Btn, Card} from '../../../components';
import {api, ApiError} from '@/lib/api/client';
import {useAuth} from '@/lib/auth-context';

const types = ['pre_seed', 'seed', 'series_a', 'series_b', 'bridge', 'safe', 'other'];
const instruments = ['equity', 'safe', 'convertible_note', 'ccd', 'ccps', 'debt', 'other'];
const transitions = {draft: ['open', 'cancelled'], open: ['paused', 'closed', 'cancelled'], paused: ['open', 'closed', 'cancelled'], closed: ['open'], cancelled: []};
const label = value => value ? value.replaceAll('_', ' ').replace(/\b\w/g, x => x.toUpperCase()) : 'Not set';
const money = (value, currency) => value == null ? 'Not set' : `${currency} ${Number(value).toLocaleString('en-IN', {maximumFractionDigits: 2})}`;
const errorMessage = e => e instanceof ApiError ? e.message : 'Unable to complete the request. Please try again.';
const blank = {name: '', round_type: '', target_amount: '', minimum_raise: '', minimum_ticket: '', pre_money_valuation: '', instrument: '', currency: 'INR', opens_on: '', closes_on: ''};
const fields = [
  ['name', 'Round name', 'text'], ['round_type', 'Round type', 'type'],
  ['target_amount', 'Target raise', 'money'], ['minimum_raise', 'Minimum raise', 'money'],
  ['instrument', 'Instrument', 'instrument'], ['minimum_ticket', 'Minimum ticket', 'money'],
  ['pre_money_valuation', 'Pre-money valuation', 'money'], ['currency', 'Currency (ISO code)', 'text'],
  ['opens_on', 'Opening date', 'date'], ['closes_on', 'Closing date', 'date'],
];

function RoundForm({initial, saving, onCancel, onSave, error, fieldErrors}) {
  const [form, setForm] = useState(initial ? Object.fromEntries(Object.keys(blank).map(k => [k, initial[k] ?? ''])) : blank);
  const change = (key, value) => setForm(old => ({...old, [key]: value}));
  const submit = event => {
    event.preventDefault();
    const payload = {...form};
    for (const key of ['target_amount', 'minimum_raise', 'minimum_ticket', 'pre_money_valuation', 'instrument', 'opens_on', 'closes_on']) if (payload[key] === '') payload[key] = null;
    onSave(payload);
  };
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="round-form-title">
    <form onSubmit={submit} className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-6">
      <div className="mb-5 flex items-center justify-between"><h2 id="round-form-title" className="serif text-2xl font-semibold">{initial ? 'Edit fundraising round' : 'Set up a fundraising round'}</h2><button type="button" onClick={onCancel} aria-label="Close"><X size={18}/></button></div>
      <div className="space-y-3">{fields.map(([key, title, type]) => <label key={key} className="block text-sm">{title}
        {type === 'type' || type === 'instrument' ? <select value={form[key]} onChange={e => change(key, e.target.value)} required={key === 'round_type'} className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 text-sm"><option value="">Select {title.toLowerCase()}</option>{(type === 'type' ? types : instruments).map(v => <option key={v} value={v}>{label(v)}</option>)}</select> : <input value={form[key]} onChange={e => change(key, e.target.value)} type={type === 'money' ? 'number' : type} min={type === 'money' ? '0' : undefined} step={type === 'money' ? '0.01' : undefined} required={key === 'name' || key === 'currency'} maxLength={key === 'name' ? 200 : key === 'currency' ? 3 : undefined} className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-sm" />}
        {fieldErrors[key] && <span role="alert" className="mt-1 block text-xs text-red-700">{fieldErrors[key]}</span>}
      </label>)}</div>
      <p className="mt-3 rounded-lg bg-[#FFF8E8] p-3 text-xs text-[#806236]">Round terms and instruments have legal consequences. Review with a lawyer.</p>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onCancel} className="min-h-10 px-4 text-sm">Cancel</button><button disabled={saving} className="min-h-10 rounded-lg bg-ink px-4 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button></div>
    </form>
  </div>;
}

export default function RoundPages({id, detail}) {
  const {user} = useAuth();
  const [orgs, setOrgs] = useState([]);
  const [org, setOrg] = useState(null);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);
  const [round, setRound] = useState(null);
  const [progress, setProgress] = useState(null);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [version, setVersion] = useState(0);
  const [orgVersion, setOrgVersion] = useState(0);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [tab, setTab] = useState('Overview');

  useEffect(() => {
    let live = true;
    api.organizations.mine().then(all => {
      if (!live) return;
      const startups = all.filter(o => o.type === 'startup');
      setOrgs(startups); setOrg(startups[0] || null);
      if (!startups.length) {setState('empty'); setError('No startup organization found.');}
    }).catch(e => {if (live) {setError(errorMessage(e)); setState('error');}});
    return () => {live = false;};
  }, [user, orgVersion]);

  useEffect(() => {
    if (!org) return;
    if (org.my_role === 'viewer') {setState('forbidden'); return;}
    let live = true;
    setState('loading'); setError(''); setRound(null); setProgress(null);
    const request = detail ? Promise.all([api.fundingRounds.get(org.id, id), api.fundingRounds.progress(org.id, id)]) : api.fundingRounds.list(org.id, 20, offset);
    request.then(result => {
      if (!live) return;
      if (detail) {setRound(result[0]); setProgress(result[1]);}
      else {setItems(result.items); setTotal(result.total);}
      setState('ready');
    }).catch(e => {if (live) {setError(errorMessage(e)); setState('error');}});
    return () => {live = false;};
  }, [org, id, detail, offset, version]);

  const save = async payload => {
    setSaving(true); setFormError(''); setFieldErrors({});
    try {
      if (detail) await api.fundingRounds.update(org.id, id, payload);
      else await api.fundingRounds.create(org.id, payload);
      setModal(false); setVersion(v => v + 1);
    } catch (e) {
      setFormError(errorMessage(e));
      if (e instanceof ApiError && Array.isArray(e.details)) {
        const errors = {};
        e.details.forEach(item => {const key = item.loc?.[1]; if (key) errors[key] = item.msg;});
        setFieldErrors(errors);
      }
    } finally {setSaving(false);}
  };
  const action = useCallback(async status => {
    setSaving(true); setError('');
    try {await api.fundingRounds.status(org.id, id, status); setVersion(v => v + 1);}
    catch (e) {setError(errorMessage(e));}
    finally {setSaving(false);}
  }, [org, id]);
  const canEdit = org && ['owner', 'admin', 'member'].includes(org.my_role);
  const title = detail ? (round?.name || 'Round details') : 'Fundraising rounds';
  return <>
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4"><div>
      <p className="text-sm text-[#4A5568]">{org?.name || 'Startup'} <span className="mx-2 text-[#B8955A]">·</span> Investors</p>
      <h1 className="serif mt-1 text-[30px] font-semibold">{title}</h1><p className="mt-1 text-sm text-[#4A5568]">{detail ? 'Track commitments, documents and closing progress.' : 'Plan your raise and track offers through to close.'}</p>
      {orgs.length > 1 && <label className="mt-2 block text-xs">Organization <select value={org?.id || ''} onChange={e => {setOrg(orgs.find(o => o.id === e.target.value)); setOffset(0);}} className="ml-2 rounded border p-1">{orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>}
    </div><div className="flex flex-wrap gap-2">{canEdit && state === 'ready' && (!detail ? <Btn onClick={() => {setFormError(''); setFieldErrors({}); setModal(true);}}><Plus size={15}/> New round</Btn> : round && <>
      {['draft', 'open', 'paused'].includes(round.status) && <Btn secondary onClick={() => {setFormError(''); setFieldErrors({}); setModal(true);}}>Edit round</Btn>}
      {(transitions[round.status] || []).map(s => <Btn key={s} secondary disabled={saving} onClick={() => action(s)}>{s === 'open' && round.status === 'closed' ? 'Reopen' : label(s)}</Btn>)}
    </>)}</div></div>
    {state === 'loading' && <p role="status">Loading rounds…</p>}
    {state === 'forbidden' && <p role="alert">Round details are restricted to startup owners, admins and members.</p>}
    {(state === 'error' || state === 'empty') && <p role="alert">{error}</p>}
    {state === 'error' && <button className="mt-2 underline" onClick={() => org ? setVersion(v => v + 1) : setOrgVersion(v => v + 1)}>Try again</button>}
    {state === 'ready' && error && <p role="alert" className="mb-3 text-red-700">{error}</p>}
    {state === 'ready' && !detail && <div className="grid gap-5 lg:grid-cols-3"><div className="space-y-3 lg:col-span-2">
      {!items.length && <Card title="Rounds"><p className="text-sm text-[#4A5568]">No funding rounds yet.</p></Card>}
      {items.map(r => <Card key={r.id} title={r.name} action={<span className="rounded-full bg-[#E7F3EC] px-2 py-1 text-xs">{label(r.status)}</span>}><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[['Target', money(r.target_amount, r.currency)], ['Committed', 'Unavailable'], ['Remaining', 'Unavailable'], ['Investors', 'Unavailable']].map(([k,v]) => <div key={k} className="rounded-lg bg-[#FAF8F4] p-3"><small className="text-xs text-[#4A5568]">{k}</small><b className="serif mt-1 block text-xl">{v}</b></div>)}</div><p className="mt-3 text-xs text-[#4A5568]">Commitment progress is not available yet.</p><div className="mt-4 flex flex-wrap justify-between gap-3"><span className="text-xs text-[#4A5568]">{label(r.round_type)} · {label(r.instrument)} · {r.closes_on ? `Closing target ${r.closes_on}` : 'No closing date'}</span><Link href={`/startup/rounds/${r.id}`} className="text-xs font-semibold text-[#9A7A45]">Open round <ArrowRight className="inline" size={12}/></Link></div></Card>)}
      {total > 20 && <div className="flex gap-3 text-sm"><button disabled={!offset} onClick={() => setOffset(Math.max(0, offset - 20))}>Previous</button><span>{offset + 1}–{Math.min(offset + 20, total)} of {total}</span><button disabled={offset + 20 >= total} onClick={() => setOffset(offset + 20)}>Next</button></div>}
      <Card title="Round milestones"><p className="text-sm text-[#4A5568]">Round milestones are not available yet.</p></Card>
    </div><aside><Card title="Getting started"><p className="text-xs leading-5 text-[#4A5568]">Set round terms, prepare your data room, connect with investors, record offers and close with your counsel.</p></Card></aside></div>}
    {state === 'ready' && detail && round && <><div className="mb-5 rounded-xl border border-[#E5E1D8] bg-white p-5"><div className="flex justify-between text-sm"><b>Target {money(round.target_amount, round.currency)}</b><span>{round.closes_on ? `Closes ${round.closes_on}` : 'No closing date'}</span></div><p className="mt-3 text-xs text-[#4A5568]">{progress?.available ? 'Progress available' : 'Commitment progress is not available yet.'}</p></div>
      <div className="mb-4 flex gap-2 overflow-x-auto">{['Overview', 'Offers and commitments', 'Term sheets', 'Cap table impact', 'Documents', 'Activity'].map(x => <button key={x} type="button" onClick={() => setTab(x)} className={`min-h-10 shrink-0 rounded-lg px-3 text-xs ${tab === x ? 'bg-ink text-white' : 'border border-[#E5E1D8] bg-white'}`}>{x}</button>)}</div>
      <Card title={tab}>{tab === 'Overview' ? <div className="grid gap-3 sm:grid-cols-4">{[['Status', label(round.status)], ['Type', label(round.round_type)], ['Instrument', label(round.instrument)], ['Valuation', money(round.pre_money_valuation, round.currency)], ['Minimum raise', money(round.minimum_raise, round.currency)], ['Minimum ticket', money(round.minimum_ticket, round.currency)], ['Opens', round.opens_on || 'Not set'], ['Closes', round.closes_on || 'Not set']].map(([k,v]) => <div key={k} className="rounded-lg bg-[#FAF8F4] p-4"><small className="text-xs text-[#4A5568]">{k}</small><b className="serif mt-1 block text-lg">{v}</b></div>)}</div> : <div className="py-5 text-sm text-[#4A5568]">{tab} is not available yet.</div>}</Card></>}
    <p className="mt-5 text-[10px] leading-4 text-[#4A5568]">The platform introduces startups and investors. It is not a broker or adviser unless licensed. Get your own legal and financial advice.</p>
    {modal && <RoundForm initial={detail ? round : null} saving={saving} onCancel={() => setModal(false)} onSave={save} error={formError} fieldErrors={fieldErrors}/>}
  </>;
}
