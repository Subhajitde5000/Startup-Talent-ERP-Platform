'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Bell,
  Sparkles,
  Settings,
  Sliders,
  CheckCircle2,
  Trash2,
  Pause,
  Play,
  ArrowRight,
  ExternalLink,
  Info,
} from 'lucide-react';
import { JobSeekerShell } from '@/components';
import {
  JobBtn,
} from '@/components/jobseeker-ui';
import { api } from '@/lib/api/client';
import { useCareerResource, ResourceState, Pagination, errorLabel } from '@/components/career-data';
import { FieldError, fieldErrorsFrom } from '@/components/async-state';

export default function AlertsPage() {
  const [tab, setTab] = useState('Saved Searches');
  const [offset, setOffset] = useState(0);
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const resource = useCareerResource(`job-alerts:${offset}`, signal => api.jobAlerts.list({limit: 20, offset}, signal));
  const alertList = resource.data?.items || [];
  const run = async action => { setError(''); setPending(true); try { await action(); resource.reload(); } catch (e) { setError(errorLabel(e)); } finally { setPending(false); } };
  const togglePauseAlert = a => run(() => api.jobAlerts.update(a.id, {is_active: !a.is_active}));
  const deleteAlert = a => run(async () => { await api.jobAlerts.delete(a.id); if (alertList.length === 1 && offset) setOffset(Math.max(0, offset - 20)); });
  const submit = async e => {
    e.preventDefault(); setErrors({}); setError(''); setPending(true);
    const criteria = {keywords: form.keywords || null, location: form.location || null, work_mode: form.work_mode || null, employment_type: form.employment_type || null, salary_min: form.salary_min || null, currency: form.currency || null, remote_only: form.remote_only ?? null};
    try { if (form.id) await api.jobAlerts.update(form.id, {title:form.title, criteria, frequency:form.frequency}); else await api.jobAlerts.create({title:form.title, criteria, frequency:form.frequency}); setForm(null); resource.reload(); }
    catch (err) { setErrors(fieldErrorsFrom(err)); setError(errorLabel(err)); } finally { setPending(false); }
  };

  return (
    <JobSeekerShell active="Job alerts" liveData>
      <div className="space-y-6 max-w-5xl">
        {/* Header */}
        <div className="rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] p-4 text-left flex items-start gap-3">
          <Info size={18} className="text-[#806236] shrink-0 mt-0.5" />
          <p className="text-xs text-[#4A5568] leading-relaxed">
            Saved searches are stored here. Delivery of alerts is not available yet.
          </p>
        </div>

        {/* Tab Navigation with horizontal scroll on mobile to prevent blowout */}
        <div className="border-b border-[#E5E1D8] overflow-x-auto min-w-0">
          <div className="flex gap-2 pb-1 min-w-max">
            {['Recommended', 'Saved Searches', 'Alerts Feed', 'Preferences'].map((t) => {
              const active = tab === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
                    active
                      ? 'border-[#B8955A] text-[#0F1B2D]'
                      : 'border-transparent text-[#6B7280] hover:text-[#0F1B2D]'
                  }`}
                >
                  {t} {t === 'Saved Searches' && `(${resource.data?.total ?? 0})`}
                </button>
              );
            })}
          </div>
        </div>

        {tab === 'Recommended' && <div className="rounded-xl border border-[#E5E1D8] bg-white p-8 text-center text-xs">Recommendations are not available yet.</div>}
        {error && <div role="alert" className="text-red-700 text-sm">{error}</div>}
        {form && <form onSubmit={submit} className="rounded-xl border border-[#E5E1D8] bg-white p-5 space-y-3">
          <h2 className="font-semibold">{form.id ? 'Edit alert' : 'New search alert'}</h2>
          {['title', 'keywords', 'location', 'salary_min', 'currency'].map(name => <label key={name} className="block text-xs font-semibold">{name.replaceAll('_',' ')}
            <input value={form[name] || ''} onChange={e => setForm({...form, [name]:e.target.value})} className="block w-full rounded border border-[#E5E1D8] p-2 mt-1" />
            <FieldError>{errors[name]}</FieldError></label>)}
          {Object.entries({work_mode:['onsite','hybrid','remote'], employment_type:['full_time','part_time','contract','internship','temporary'], frequency:['instant','daily','weekly']}).map(([name, values]) => <label key={name} className="block text-xs font-semibold">{name.replaceAll('_',' ')}
            <select value={form[name] || ''} onChange={e => setForm({...form, [name]:e.target.value})} className="block w-full rounded border border-[#E5E1D8] p-2 mt-1">{name !== 'frequency' && <option value="">Any</option>}{values.map(v => <option value={v} key={v}>{v.replaceAll('_',' ')}</option>)}</select><FieldError>{errors[name]}</FieldError></label>)}
          <button type="submit" disabled={pending} className="rounded bg-[#0F1B2D] text-white px-4 py-2 text-xs">Save alert</button>{' '}
          <button type="button" onClick={() => setForm(null)} className="rounded border px-4 py-2 text-xs">Cancel</button>
        </form>}

        {/* Tab 2: Saved Searches */}
        {tab === 'Saved Searches' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-serif font-bold text-[#0F1B2D]">
                  Search Alerts ({resource.data?.total ?? 0})
                </h2>
                <p className="text-xs text-[#6B7280]">
                  Manage your saved search criteria and desired frequency.
                </p>
              </div>
              <JobBtn primary small onClick={() => setForm({title:'', frequency:'daily'})}>+ New Search Alert</JobBtn>
            </div>

            {resource.loading || resource.error ? <ResourceState resource={resource} /> : alertList.length === 0 ? (
              <div className="rounded-xl border border-[#E5E1D8] bg-white p-8 text-center text-xs text-[#6B7280]">
                You have no saved search alerts. Create one to get started.
              </div>
            ) : (
              <div className="space-y-3">
                {alertList.map((a) => (
                  <div
                    key={a.id}
                    className="rounded-xl border border-[#E5E1D8] bg-white p-5 shadow-sm space-y-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-[#0F1B2D]">{a.title}</h3>
                          {!a.is_active ? (
                            <span className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-xs text-[#6B7280]">
                              Paused
                            </span>
                          ) : (
                            <span className="rounded-full bg-[#E7F3EC] px-2 py-0.5 text-xs text-[#286749]">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#4A5568] mt-1">
                          Criteria:{' '}
                          {Object.entries(a.criteria || {}).filter(([,v]) => v !== null && v !== false).map(([k,v]) => `${k.replaceAll('_',' ')}: ${v}`).join(' · ') || 'Any job'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button type="button" className="text-xs underline" onClick={() => setForm({id:a.id, title:a.title, frequency:a.frequency, ...a.criteria})}>Edit</button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => togglePauseAlert(a)}
                          className="p-2 rounded-lg border border-[#E5E1D8] text-xs text-[#4A5568] hover:bg-[#FAF8F4]"
                          title={!a.is_active ? 'Resume' : 'Pause'}
                          aria-label={!a.is_active ? 'Resume' : 'Pause'}
                        >
                          {!a.is_active ? <Play size={14} /> : <Pause size={14} />}
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => deleteAlert(a)}
                          className="p-2 rounded-lg text-[#A0A7B4] hover:text-[#B42318] hover:bg-[#FCE8E6]"
                          title="Delete alert"
                          aria-label="Delete alert"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-[#6B7280] pt-2 border-t border-[#F0EBE0]">
                      <span>Delivery not yet available</span>
                      <span>·</span>
                      <span>Frequency: {a.frequency}</span>
                      <span>·</span>
                      <span>Last run: {a.last_sent_at ? new Date(a.last_sent_at).toLocaleString() : 'Not sent'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Pagination page={resource.data} onChange={setOffset} />
          </div>
        )}

        {tab === 'Alerts Feed' && <div className="rounded-xl border border-[#E5E1D8] bg-white p-8 text-center text-xs">Alert delivery is not available yet.</div>}
        {tab === 'Preferences' && <div className="rounded-xl border border-[#E5E1D8] bg-white p-8 text-center text-xs">Delivery preferences are not available yet.</div>}

      </div>
    </JobSeekerShell>
  );
}
