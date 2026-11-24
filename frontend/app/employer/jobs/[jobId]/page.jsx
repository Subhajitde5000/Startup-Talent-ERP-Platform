'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, Columns, Edit3 } from 'lucide-react';
import { EmployerBtn, StageChip } from '@/components';
import { api, fileFieldErrors } from '@/lib/api/client';
import { ApplicantPipeline, ApplicantCount } from '@/components/employer-applicant-pipeline';
import { JobsPage, JobNotice, jobError, jobLabel, jobSalary, useJob, useJobsWorkspace } from '@/components/employer-jobs-workspace';

function JobDetail() {
  const { jobId } = useParams();
  const { org, href, canWrite } = useJobsWorkspace();
  const { job, loading, error, errorStatus, reload } = useJob(jobId);
  const params = useSearchParams();
  const router = useRouter();
  const [tab, setTab] = useState(params.get('tab') === 'pipeline' ? 'Pipeline' : 'Job Details');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [fields, setFields] = useState({});
  const [message, setMessage] = useState('');

  async function changeStatus(action) {
    if (busy || !canWrite) return;
    if (['close', 'archive'].includes(action) && !window.confirm(action === 'close' ? 'Close this job? Closed jobs cannot be reopened.' : 'Archive this job? It will no longer appear in your jobs list.')) return;
    setBusy(true); setActionError(''); setFields({}); setMessage('');
    try {
      await api.jobs[action](org.id, job.id);
      if (action === 'archive') router.replace(href('/employer/hiring'));
      else { setMessage(`Job ${action === 'publish' ? 'published' : action === 'pause' ? 'paused' : 'closed'} successfully.`); reload(); }
    } catch (failure) {
      setActionError(jobError(failure)); setFields(fileFieldErrors(failure));
    } finally { setBusy(false); }
  }

  if (loading) return <JobNotice>Loading job…</JobNotice>;
  if (error && errorStatus === 404) return <ApplicantPipeline jobId={jobId} />;
  if (error) return <JobNotice error retry={reload}>{error}</JobNotice>;
  const actions = job.status === 'draft' ? [['publish', 'Publish'], ['archive', 'Archive']] : job.status === 'open' ? [['pause', 'Pause'], ['close', 'Close']] : job.status === 'paused' ? [['publish', 'Resume'], ['close', 'Close']] : [['archive', 'Archive']];
  return <>
    <nav className="flex items-center gap-2 text-xs text-[#6B7280]"><Link href={href('/employer/hiring')} className="flex items-center gap-1 hover:text-[#0F1B2D]"><ChevronLeft size={14} />Back to Job Openings</Link><span>/</span><span className="text-[#0F1B2D] font-medium truncate">{job.title}</span></nav>
    <header className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-xs space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1 min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h1 className="text-xl md:text-2xl font-serif font-bold text-[#0F1B2D]">{job.title}</h1><StageChip stage={jobLabel(job.status)} /></div><p className="text-xs text-[#6B7280]">{jobLabel(job.department)} · {job.location || 'Not specified'} ({jobLabel(job.work_mode)}) · {jobSalary(job)}</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <span title="Candidate comparison is deferred to Step 7e"><EmployerBtn secondary small disabled><Columns size={13} />Compare Candidates</EmployerBtn></span>
          {canWrite && <Link href={href(`/employer/jobs/${job.id}/edit`)}><EmployerBtn secondary small><Edit3 size={13} />Edit Job</EmployerBtn></Link>}
          <span title="Talent sourcing is deferred to Step 7j"><EmployerBtn primary small disabled>Source Talent</EmployerBtn></span>
          {canWrite && actions.map(([action, label]) => <EmployerBtn key={action} secondary small disabled={busy} onClick={() => changeStatus(action)}>{busy ? 'Working…' : label}</EmployerBtn>)}
        </div>
      </div>
      <div className="pt-3 border-t border-[#F0EBE0] flex items-center gap-2 text-xs">{['Pipeline', 'Job Details'].map(value => <button key={value} type="button" aria-pressed={tab === value} onClick={() => setTab(value)} className={`px-3.5 py-1.5 rounded-xl font-semibold transition-colors ${tab === value ? 'bg-[#0F1B2D] text-white' : 'text-[#4A5568] hover:bg-[#FAF8F4]'}`}>{value}</button>)}</div>
    </header>
    {!canWrite && <p className="text-xs text-[#6B7280]">Read-only access. Only an owner or admin can change this job.</p>}
    {message && <JobNotice>{message}</JobNotice>}
    {actionError && <JobNotice error>{actionError}{Object.entries(fields).length > 0 && <ul className="mt-2 list-disc pl-5">{Object.entries(fields).map(([field, text]) => <li key={field}>{jobLabel(field)}: {text}</li>)}</ul>}{canWrite && <Link href={href(`/employer/jobs/${job.id}/edit`)} className="mt-2 inline-block underline">Edit the highlighted job fields</Link>}</JobNotice>}
    {tab === 'Pipeline' ? <ApplicantPipeline jobId={jobId} /> : <section className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-xs space-y-4">
      <h2 className="text-base font-serif font-bold text-[#0F1B2D]">Job Posting Overview</h2>
      <div className="text-xs text-[#4A5568] space-y-4 leading-relaxed">
        <p className="whitespace-pre-wrap">{job.description || 'No description has been added to this draft.'}</p>
        <div className="pt-2 border-t border-[#F0EBE0] grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[['Department', jobLabel(job.department)], ['Location', `${job.location || 'Not specified'} (${jobLabel(job.work_mode)})`], ['Compensation', jobSalary(job)], ['Permitted Applicants', <ApplicantCount key={jobId} jobId={jobId} />], ['Employment Type', jobLabel(job.employment_type)], ['Openings', job.openings], ['Visibility', jobLabel(job.visibility)], ['Salary Publicly Visible', job.show_salary_publicly ? 'Yes' : 'No'], ['Equity', job.equity_min_pct == null && job.equity_max_pct == null ? 'Not specified' : `${job.equity_min_pct ?? 'Not specified'}% – ${job.equity_max_pct ?? 'Not specified'}%`], ['Experience', job.experience_min_yrs == null && job.experience_max_yrs == null ? 'Not specified' : `${job.experience_min_yrs ?? 'Not specified'} – ${job.experience_max_yrs ?? 'Not specified'} years`], ['Fair-hiring Confirmation', job.fair_hiring_confirmed ? 'Confirmed' : 'Not confirmed'], ['Posted', job.posted_at ? new Date(job.posted_at).toLocaleDateString() : 'Not published']].map(([label, value]) => <div key={label}><span className="text-[#6B7280] block">{label}</span><strong className="text-[#0F1B2D]">{value}</strong></div>)}
        </div>
        {[['Responsibilities', job.responsibilities], ['Must-have Skills & Qualifications', job.requirements], ['What We Offer', job.what_we_offer]].map(([label, value]) => <div key={label}><h3 className="font-semibold text-[#0F1B2D]">{label}</h3><p className="whitespace-pre-wrap">{value || 'Not specified'}</p></div>)}
        <div><h3 className="font-semibold text-[#0F1B2D]">Skills</h3>{job.skills.length ? <ul className="list-disc pl-5">{job.skills.map(skill => <li key={skill.skill_id}>{skill.name} ({skill.is_required ? 'Required' : 'Nice to have'})</li>)}</ul> : <p>No catalogue skills specified.</p>}</div>
        <div><h3 className="font-semibold text-[#0F1B2D]">Benefits</h3>{job.benefits.length ? <ul className="list-disc pl-5">{job.benefits.map(benefit => <li key={benefit.id}>{benefit.label}</li>)}</ul> : <p>No benefits specified.</p>}</div>
      </div>
    </section>}
  </>;
}

export default function JobDetailPage() {
  return <JobsPage><JobDetail /></JobsPage>;
}
