'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Bookmark,
  Trash2,
  ExternalLink,
  Search,
  LayoutGrid,
  List,
  Clock,
  Sparkles,
  ArrowRight,
  Edit3,
  Check,
} from 'lucide-react';
import { JobSeekerShell } from '@/components';
import {
  JobBtn,
  StatusChip,
} from '@/components/jobseeker-ui';
import { api } from '@/lib/api/client';
import { useCareerResource, ResourceState, Pagination, errorLabel } from '@/components/career-data';
import { FieldError, fieldErrorsFrom } from '@/components/async-state';

export default function SavedJobsPage() {
  const [tab, setTab] = useState('All');
  const [viewMode, setViewMode] = useState('cards');
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [pending, setPending] = useState(false);
  const resource = useCareerResource(`saved-jobs:${offset}`, signal => api.savedJobs.list({limit: 20, offset}, signal));
  const savedList = (resource.data?.items || []).map(row => ({
    id: row.job_id, title: row.job?.title || 'Job unavailable', status: row.status,
    company: row.job?.org_name || '', loc: row.job?.location || 'Location not specified',
    type: row.job?.employment_type?.replaceAll('_', ' ') || '', note: row.note || '',
    salary: row.job?.salary_min || row.job?.salary_max ? `${row.job.currency} ${row.job.salary_min || '—'} – ${row.job.salary_max || '—'} / ${row.job.salary_period}` : 'Salary not disclosed',
    deadline: row.job?.application_deadline, available: !!row.job,
  }));
  const filtered = savedList.filter(j => tab === 'Open' ? j.status === 'open' : tab === 'Closing soon' ? j.status === 'open' && j.deadline && new Date(j.deadline) >= new Date() && new Date(j.deadline) <= new Date(Date.now() + 7 * 86400000) : true);
  const handleRemove = async id => {
    setPending(true); setError('');
    try { await api.savedJobs.delete(id); if (savedList.length === 1 && offset) setOffset(Math.max(0, offset - 20)); else resource.reload(); }
    catch (err) { setError(errorLabel(err)); } finally { setPending(false); }
  };
  const handleSaveNote = async (id, text) => {
    setPending(true); setError(''); setFieldErrors({});
    try { await api.savedJobs.update(id, {note: text || null}); setEditingNoteId(null); resource.reload(); }
    catch (err) { setError(errorLabel(err)); setFieldErrors(fieldErrorsFrom(err)); } finally { setPending(false); }
  };

  return (
    <JobSeekerShell active="Saved jobs" liveData>
      <div className="space-y-6 max-w-5xl">
        {resource.loading || resource.error ? <ResourceState resource={resource} /> : null}
        {error && <div role="alert" className="text-red-700 text-sm">{error}</div>}
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-serif font-bold text-[#0F1B2D]">
              Saved Jobs & Bookmarks
            </h1>
            <p className="text-xs md:text-sm text-[#6B7280] mt-1">
              Keep track of roles you&apos;re considering and attach private application notes.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`p-2 rounded-lg border text-xs ${
                viewMode === 'cards'
                  ? 'border-[#B8955A] bg-[#FFF8E8] text-[#806236]'
                  : 'border-[#E5E1D8] bg-white text-[#4A5568]'
              }`}
              aria-label="Grid view"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-lg border text-xs ${
                viewMode === 'table'
                  ? 'border-[#B8955A] bg-[#FFF8E8] text-[#806236]'
                  : 'border-[#E5E1D8] bg-white text-[#4A5568]'
              }`}
              aria-label="Table view"
            >
              <List size={15} />
            </button>
          </div>
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-2 border-b border-[#E5E1D8] pb-2 text-xs">
          {['All', 'Open', 'Closing soon'].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-3.5 py-1.5 rounded-lg font-medium transition-colors ${
                tab === t
                  ? 'bg-[#0F1B2D] text-white'
                  : 'text-[#4A5568] hover:bg-[#FAF8F4]'
              }`}
            >
              {t} {t === 'All' ? `(${resource.data?.total ?? 0})` : ''}
            </button>
          ))}
        </div>

        {/* Content Area */}
        {!resource.loading && !resource.error && filtered.length === 0 ? (
          <div className="rounded-xl border border-[#E5E1D8] bg-white p-12 text-center space-y-3">
            <span className="grid h-12 w-12 mx-auto place-items-center rounded-full bg-[#FAF8F4] text-[#A0A7B4]">
              <Bookmark size={22} />
            </span>
            <h3 className="text-base font-semibold text-[#0F1B2D]">No saved jobs found</h3>
            <p className="text-xs text-[#6B7280] max-w-sm mx-auto">
              Saved roles will appear here. Saving from job search is not wired yet.
            </p>
            <Link href="/jobseeker/jobs" className="inline-block pt-2">
              <JobBtn primary small>
                Discover Open Roles
              </JobBtn>
            </Link>
          </div>
        ) : viewMode === 'cards' ? (
          <div className="space-y-4">
            {tab !== 'All' && resource.data?.total > 20 && <p className="text-xs">Filters apply to the current page.</p>}
            {filtered.map((job) => {
              const note = job.note;
              const isEditing = editingNoteId === job.id;
              return (
                <div
                  key={job.id}
                  className="rounded-xl border border-[#E5E1D8] bg-white p-5 shadow-sm space-y-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#F3EBDD] font-bold text-base text-[#806236]">
                        {job.logo || job.company?.name?.[0] || 'J'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          {job.available ? <Link href={`/jobseeker/jobs/${job.id}`} className="text-sm font-semibold text-[#0F1B2D] hover:underline">{job.title}</Link> : <span className="text-sm font-semibold">{job.title}</span>}
                          <StatusChip status={job.status ? job.status[0].toUpperCase() + job.status.slice(1) : 'Unavailable'} />
                        </div>
                        <p className="text-xs text-[#4A5568]">
                          {job.company?.name || job.company} · {job.loc} · {job.type}
                        </p>
                        <p className="text-xs font-semibold text-[#0F1B2D] mt-1">{job.salary}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {job.available && job.status === 'open' && <Link href={`/jobseeker/jobs/${job.id}/apply`}>
                        <JobBtn primary small>
                          Apply <ArrowRight size={13} />
                        </JobBtn>
                      </Link>}
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => handleRemove(job.id)}
                        className="p-2 text-[#A0A7B4] hover:text-[#B42318] transition-colors rounded-lg hover:bg-[#FCE8E6]"
                        title="Remove bookmark"
                        aria-label="Remove bookmark"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Private Note Section */}
                  <div className="rounded-lg border border-[#F0EBE0] bg-[#FAF8F4] p-3 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-[#6B7280] flex items-center gap-1.5">
                        <Edit3 size={12} /> Private Note
                      </span>
                      {!isEditing && (
                        <button
                          type="button"
                          onClick={() => setEditingNoteId(job.id)}
                          className="text-[#9A7A45] hover:underline font-medium"
                        >
                          {note ? 'Edit Note' : '+ Add Note'}
                        </button>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="space-y-2 pt-1">
                        <input
                          type="text"
                          defaultValue={note}
                          id={`note-${job.id}`}
                          maxLength={2000}
                          placeholder="Add a private note"
                          className="w-full h-8 px-2.5 rounded border border-[#E5E1D8] bg-white text-xs text-[#0F1B2D] focus:outline-none focus:border-[#B8955A]"
                        />
                        <FieldError>{fieldErrors.note}</FieldError>
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingNoteId(null)}
                            className="px-2.5 py-1 text-xs rounded border border-[#E5E1D8] bg-white"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const el = document.getElementById(`note-${job.id}`);
                              handleSaveNote(job.id, el?.value || '');
                            }}
                            className="px-2.5 py-1 text-xs rounded bg-[#0F1B2D] text-white font-medium"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[#4A5568] italic">
                        {note || 'No notes added yet. Click to keep private notes for this role.'}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Table View with responsive overflow-x-auto wrapper */
          <div className="rounded-xl border border-[#E5E1D8] bg-white overflow-hidden shadow-sm">
            <div className="overflow-x-auto min-w-0">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF8F4] border-b border-[#E5E1D8] text-[#6B7280] uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="p-3.5 pl-5">Role & Company</th>
                    <th className="p-3.5">Location</th>
                    <th className="p-3.5">Compensation</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 pr-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0EBE0] text-[#0F1B2D]">
                  {filtered.map((job) => (
                    <tr key={job.id} className="hover:bg-[#FAF8F4]/50 transition-colors">
                      <td className="p-3.5 pl-5">
                        {job.available ? <Link href={`/jobseeker/jobs/${job.id}`} className="font-semibold hover:underline block">{job.title}</Link> : <span className="font-semibold">{job.title}</span>}
                        <span className="text-[#6B7280]">
                          {job.company?.name || job.company}
                        </span>
                      </td>
                      <td className="p-3.5 text-[#4A5568]">{job.loc}</td>
                      <td className="p-3.5 font-medium">{job.salary}</td>
                      <td className="p-3.5">
                        <StatusChip status={job.status ? job.status[0].toUpperCase() + job.status.slice(1) : 'Unavailable'} />
                      </td>
                      <td className="p-3.5 pr-5 text-right space-x-2">
                        {job.available && job.status === 'open' && <Link href={`/jobseeker/jobs/${job.id}/apply`}>
                          <JobBtn primary small>
                            Apply
                          </JobBtn>
                        </Link>}
                        <button
                          type="button"
                          disabled={pending}
                        onClick={() => handleRemove(job.id)}
                          className="text-[#A0A7B4] hover:text-[#B42318] p-1.5"
                          title="Remove"
                          aria-label="Remove"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <Pagination page={resource.data} onChange={setOffset} />
      </div>
    </JobSeekerShell>
  );
}
