'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Save } from 'lucide-react';
import { EmployerBtn } from '@/components';
import { api, fileFieldErrors } from '@/lib/api/client';
import { JobNotice, jobError, jobLabel, useJobsWorkspace } from './employer-jobs-workspace';

const inputStyle = 'w-full h-10 px-3 rounded-xl border border-[#E5E1D8] bg-white text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none';
const departments = ['engineering', 'product', 'design', 'sales', 'marketing', 'operations', 'finance', 'people', 'legal', 'support', 'other'];

/** Currency symbols/group separators are presentation only. No float money math. */
export function parseJobMoney(value, field) {
  if (!value.trim()) return null;
  const cleaned = value.trim().replace(/^(?:₹|INR\s*|Rs\.?\s*)/i, '').replaceAll(',', '').trim();
  const match = cleaned.match(/^(\d+)(?:\.(\d{1,2}))?\s*(LPA|L|lakhs?)?$/i);
  if (!match) throw Object.assign(new Error('Enter an amount with up to two decimals (for example 2200000 or ₹22L).'), { field });
  const scale = match[3] ? BigInt(100000) : BigInt(1);
  const cents = (BigInt(match[1]) * BigInt(100) + BigInt((match[2] || '').padEnd(2, '0'))) * scale;
  return `${cents / BigInt(100)}.${String(cents % BigInt(100)).padStart(2, '0')}`;
}

function initialForm(job) {
  return {
    title: job?.title || '', department: job?.department || '', location: job?.location || '',
    work_mode: job?.work_mode || 'onsite', employment_type: job?.employment_type || 'full_time',
    salary_min: job?.salary_min ?? '', salary_max: job?.salary_max ?? '',
    currency: job?.currency || 'INR', salary_period: job?.salary_period || 'annual',
    equity_min_pct: job?.equity_min_pct ?? '', equity_max_pct: job?.equity_max_pct ?? '',
    description: job?.description || '', requirements: job?.requirements || '',
    visibility: job?.visibility || 'public', show_salary_publicly: job?.show_salary_publicly ?? true,
    fair_hiring_confirmed: job?.fair_hiring_confirmed ?? false,
  };
}

export default function EmployerJobForm({ job = null }) {
  const { org, canWrite, href } = useJobsWorkspace();
  const router = useRouter();
  const [form, setForm] = useState(() => initialForm(job));
  const [saved, setSaved] = useState(job);
  const [baseline, setBaseline] = useState(() => initialForm(job));
  const [band, setBand] = useState(job ? `${job.salary_min ?? ''} – ${job.salary_max ?? ''}` : '');
  const [status, setStatus] = useState(job?.status || 'draft');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [partial, setPartial] = useState(false);
  const back = href(job ? `/employer/jobs/${job.id}` : '/employer/hiring');
  const change = e => {
    const { name, type, checked, value } = e.target;
    setForm(previous => ({ ...previous, [name]: type === 'checkbox' ? checked : value }));
    setErrors(previous => ({ ...previous, [name]: '' }));
  };
  const control = (name, label, options) => <div>
    <label htmlFor={name} className="block font-semibold text-[#4A5568] mb-1.5">{label}</label>
    {options ? <select id={name} name={name} value={form[name]} onChange={change} className={inputStyle} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `${name}-error` : undefined}>
      {options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
    </select> : <input id={name} name={name} value={form[name]} onChange={change} maxLength={name === 'title' || name === 'location' ? 200 : undefined} className={inputStyle} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `${name}-error` : undefined} />}
    {errors[name] && <p id={`${name}-error`} role="alert" className="mt-1 text-red-700">{errors[name]}</p>}
  </div>;
  const textarea = (name, label, rows) => <div>
    <label htmlFor={name} className="block font-semibold text-[#4A5568] mb-1.5">{label}</label>
    <textarea id={name} name={name} rows={rows} maxLength={10000} value={form[name]} onChange={change} className="w-full p-3 rounded-xl border border-[#E5E1D8] text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none leading-relaxed" aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `${name}-error` : undefined} />
    {errors[name] && <p id={`${name}-error`} role="alert" className="mt-1 text-red-700">{errors[name]}</p>}
  </div>;

  if (!canWrite) return <JobNotice>Only an organization owner or admin can {job ? 'edit' : 'create'} jobs. Members and viewers have read-only access. <Link href={back} className="underline">Back to {job ? 'job details' : 'jobs'}</Link>.</JobNotice>;

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const intent = event.nativeEvent.submitter?.value || 'save';
    setBusy(true); setErrors({}); setError(''); setPartial(false);
    let stored = saved;
    let contentSaved = false;
    try {
      const current = { ...form };
      if (job && band !== `${baseline.salary_min} – ${baseline.salary_max}`) {
        const parts = band.split(/\s*[–—-]\s*/);
        if (parts.length !== 2) throw Object.assign(new Error('Enter a minimum and maximum separated by a dash, for example 2200000 – 2800000.'), { field: 'salary_min' });
        current.salary_min = parts[0]; current.salary_max = parts[1];
      }
      const payload = {};
      for (const [key, value] of Object.entries(current)) {
        if (stored && value === baseline[key]) continue;
        if (['salary_min', 'salary_max'].includes(key)) payload[key] = parseJobMoney(String(value), key);
        else if (['equity_min_pct', 'equity_max_pct'].includes(key)) payload[key] = value === '' ? null : String(value);
        else if (['department', 'location', 'description', 'requirements'].includes(key)) payload[key] = String(value).trim() || null;
        else payload[key] = value;
      }
      stored = stored ? (Object.keys(payload).length ? await api.jobs.update(org.id, stored.id, payload) : stored) : await api.jobs.create(org.id, payload);
      contentSaved = true;
      setSaved(stored);
      setBaseline(initialForm(stored));
      setForm(initialForm(stored));
      if (job) setBand(`${stored.salary_min ?? ''} – ${stored.salary_max ?? ''}`);
      const nextStatus = intent === 'publish' ? 'open' : (job ? status : 'draft');
      if (stored.status !== nextStatus) {
        const action = { open: 'publish', paused: 'pause', closed: 'close' }[nextStatus];
        if (action) stored = await api.jobs[action](org.id, stored.id);
      }
      router.push(href(`/employer/jobs/${stored.id}`));
    } catch (failure) {
      setErrors(failure.field ? { [failure.field]: failure.message } : fileFieldErrors(failure));
      setPartial(contentSaved);
      setError(`${contentSaved ? 'Your changes were saved, but the status change failed. ' : ''}${failure.field ? failure.message : jobError(failure)}`);
    } finally {
      setBusy(false);
    }
  }

  const statusOptions = saved?.status === 'closed' ? ['closed'] : saved?.status === 'draft' || !saved ? ['draft', 'open'] : ['open', 'paused', 'closed'];
  return <div className="mx-auto max-w-[1080px] space-y-6 min-w-0">
    <nav className="flex items-center gap-2 text-xs text-[#6B7280]"><Link href={back} className="flex items-center gap-1 hover:text-[#0F1B2D]"><ChevronLeft size={14} /> Back to {job ? 'Job Details' : 'Hiring'}</Link><span>/</span><span className="text-[#0F1B2D] font-medium">{job ? `Edit: ${job.title}` : 'Create New Job'}</span></nav>
    <header className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-xs">
      <h1 className="text-xl md:text-2xl font-serif font-bold text-[#0F1B2D]">{job ? 'Edit Job Opening' : 'Create a New Job Opening'}</h1>
      <p className="text-xs md:text-sm text-[#6B7280] mt-1">{job ? 'Update role parameters, compensation limits, or pause new applications.' : 'Post roles with clear responsibilities and transparent compensation.'}</p>
    </header>
    {error && <JobNotice error>{error}{partial && saved && <> <Link className="underline" href={href(`/employer/jobs/${saved.id}`)}>View saved job</Link>. Retry below without creating a duplicate.</>}</JobNotice>}
    <form onSubmit={submit} className="space-y-6" noValidate>
      <fieldset disabled={busy} className="space-y-6 disabled:opacity-60">
        <section className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-xs space-y-5">
          <h2 className="text-base font-serif font-bold text-[#0F1B2D]">{job ? 'Role Settings' : 'Role Details & Categorization'}</h2>
          <div className="space-y-4 text-xs">
            {control('title', 'Job Title *')}
            <div className="grid gap-4 sm:grid-cols-2">
              {control('department', 'Department', [['', 'Not specified'], ...departments.map(d => [d, jobLabel(d)])])}
              {job ? <div><label htmlFor="job-status" className="block font-semibold text-[#4A5568] mb-1.5">Job Status</label><select id="job-status" value={status} onChange={e => setStatus(e.target.value)} className={inputStyle}>{statusOptions.map(s => <option key={s} value={s}>{jobLabel(s)}</option>)}</select></div> : control('employment_type', 'Employment Type', ['full_time', 'part_time', 'contract', 'internship', 'temporary'].map(v => [v, jobLabel(v)]))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">{control('location', 'Office Location')}{control('work_mode', 'Work Arrangement', ['onsite', 'hybrid', 'remote'].map(v => [v, jobLabel(v)]))}</div>
            {job && <div className="grid gap-4 sm:grid-cols-2">{control('employment_type', 'Employment Type', ['full_time', 'part_time', 'contract', 'internship', 'temporary'].map(v => [v, jobLabel(v)]))}<div><label htmlFor="salary-band" className="block font-semibold text-[#4A5568] mb-1.5">Salary Band (min – max)</label><input id="salary-band" value={band} onChange={e => { setBand(e.target.value); setErrors(previous => ({ ...previous, salary_min: '', salary_max: '' })); }} className={inputStyle} aria-invalid={Boolean(errors.salary_min || errors.salary_max)} />{(errors.salary_min || errors.salary_max) && <p role="alert" className="mt-1 text-red-700">{errors.salary_min || errors.salary_max}</p>}</div></div>}
          </div>
        </section>
        <section className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-xs space-y-4">
          <h2 className="text-base font-serif font-bold text-[#0F1B2D]">Transparent Compensation</h2>
          {!job && <div className="grid gap-4 sm:grid-cols-2 text-xs">{control('salary_min', 'Minimum Base Pay')}{control('salary_max', 'Maximum Base Pay')}</div>}
          <div className="grid gap-4 sm:grid-cols-2 text-xs">{control('currency', 'Currency (ISO code)')}{control('salary_period', 'Salary Period', [['annual', 'Annual'], ['monthly', 'Monthly']])}</div>
          <div className="grid gap-4 sm:grid-cols-2 text-xs">{control('equity_min_pct', 'Minimum Equity (%)')}{control('equity_max_pct', 'Maximum Equity (%)')}</div>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="show_salary_publicly" checked={form.show_salary_publicly} onChange={change} />Show salary publicly</label>
        </section>
        <section className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-xs space-y-4">
          <h2 className="text-base font-serif font-bold text-[#0F1B2D]">Job Scope & Requirements</h2>
          <div className="space-y-4 text-xs">{textarea('description', 'Role Overview & Responsibilities', 4)}{textarea('requirements', 'Must-have Skills & Qualifications', 3)}{control('visibility', 'Visibility', [['public', 'Public on Jobs marketplace'], ['platform_members', 'Platform members only'], ['link_only', 'Link only']])}</div>
        </section>
        <div className="rounded-2xl border border-[#E5E1D8] bg-[#FAF8F4] p-4 text-xs">
          <label className="flex items-start gap-2.5 text-[#4A5568] leading-relaxed"><input name="fair_hiring_confirmed" type="checkbox" checked={form.fair_hiring_confirmed} onChange={change} className="mt-0.5 h-4 w-4" />I confirm that this job opening adheres to platform fair hiring policies, does not collect application fees, and offers legitimate employment terms.</label>
          {errors.fair_hiring_confirmed && <p role="alert" className="mt-1 text-red-700">{errors.fair_hiring_confirmed}</p>}
        </div>
        <div className="flex items-center justify-end gap-3 pt-2"><Link href={back}><EmployerBtn secondary small disabled={busy}>Cancel</EmployerBtn></Link>
          {!job && <EmployerBtn secondary type="submit" value="save" disabled={busy}>Save Draft</EmployerBtn>}
          <EmployerBtn type="submit" value={job ? 'save' : 'publish'} primary disabled={busy} className="px-6 min-h-[42px]">{job && <Save size={14} />}{busy ? 'Saving…' : job ? 'Save Job Opening' : saved ? 'Retry Publish' : 'Publish Job Post'}</EmployerBtn>
        </div>
      </fieldset>
    </form>
  </div>;
}
