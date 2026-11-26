'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FileText,
  Search,
  Star,
  Sparkles,
  Plus,
  Trash2,
  Copy,
  Eye,
} from 'lucide-react';
import { JobSeekerShell } from '@/components';
import { JobBtn } from '@/components/jobseeker-ui';
import { api } from '@/lib/api/client';
import { useCareerResource, ResourceState, Pagination, errorLabel } from '@/components/career-data';
import { exportResumeAsPdf, exportResumeAsDocx } from '@/lib/resume-export';
import { ResumePreviewModal } from '@/components/resume-preview-modal';

export default function MyResumesPage() {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('updated_at');
  const [offset, setOffset] = useState(0);
  const [actionError, setActionError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [previewResume, setPreviewResume] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [userContact, setUserContact] = useState(null);

  useEffect(() => {
    const ctrl = new AbortController();
    Promise.all([
      api.users.me(ctrl.signal).catch(() => null),
      api.talentProfile.me(ctrl.signal).catch(() => null),
    ]).then(([u, tp]) => {
      if (ctrl.signal.aborted || !u) return;
      setUserContact({
        display_name: u.display_name || '',
        email: u.email || '',
        phone: u.phone || '',
        location: tp?.current_location || u.region || '',
        linkedin_url: u.linkedin_url || '',
        github_url: u.github_url || '',
      });
    });
    return () => ctrl.abort();
  }, []);

  const listRes = useCareerResource(
    `resumes:${search}:${sort}:${offset}`,
    (signal) =>
      api.resumes.list(
        { q: search.trim() || undefined, sort, order: 'desc', limit: 12, offset },
        signal,
      ),
  );
  const summaryRes = useCareerResource('resumes:summary', (signal) => api.resumes.summary(signal));

  const reloadAll = () => {
    listRes.reload();
    summaryRes.reload();
  };

  const setPrimary = async (id) => {
    setBusyId(id);
    setActionError('');
    try {
      await api.resumes.setDefault(id);
      reloadAll();
    } catch (err) {
      setActionError(errorLabel(err, 'Could not set primary resume.'));
    } finally {
      setBusyId(null);
    }
  };

  const handleDuplicate = async (id) => {
    setBusyId(id);
    setActionError('');
    try {
      await api.resumes.duplicate(id);
      reloadAll();
    } catch (err) {
      setActionError(errorLabel(err, 'Could not duplicate resume.'));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id) => {
    setBusyId(id);
    setActionError('');
    try {
      await api.resumes.remove(id);
      reloadAll();
    } catch (err) {
      setActionError(errorLabel(err, 'Could not delete resume.'));
    } finally {
      setBusyId(null);
    }
  };

  const handleView = async (id) => {
    setBusyId(id);
    setActionError('');
    try {
      const full = await api.resumes.get(id);
      setPreviewResume(full);
    } catch (err) {
      setActionError(errorLabel(err, 'Could not load resume preview.'));
    } finally {
      setBusyId(null);
    }
  };

  const handleExportPdf = async () => {
    if (!previewResume) return;
    setExporting(true);
    try {
      exportResumeAsPdf(previewResume, userContact);
    } catch (err) {
      setActionError(errorLabel(err, 'Could not export PDF.'));
    } finally {
      setExporting(false);
    }
  };

  const handleExportDocx = async () => {
    if (!previewResume) return;
    setExporting(true);
    try {
      await exportResumeAsDocx(previewResume, userContact);
    } catch (err) {
      setActionError(errorLabel(err, 'Could not export Word document.'));
    } finally {
      setExporting(false);
    }
  };

  const resumeList = listRes.data?.items || [];
  const total = listRes.data?.total ?? 0;
  const summary = summaryRes.data;

  return (
    <JobSeekerShell active="Resumes">
      <div className="space-y-6 max-w-5xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-serif font-bold text-[#0F1B2D]">
              Resume Studio & ATS Optimizer
            </h1>
            <p className="text-xs md:text-sm text-[#6B7280] mt-1">
              Build role-specific resumes, test ATS compatibility, and tailor descriptions to match job postings.
            </p>
          </div>

          <Link href="/jobseeker/resumes/new">
            <JobBtn primary small className="flex items-center gap-1.5">
              <Plus size={14} /> New Resume
            </JobBtn>
          </Link>
        </div>

        {/* Quick Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-[#E5E1D8] bg-white p-4">
            <span className="text-xs text-[#6B7280]">Total Resumes</span>
            <div className="mt-1 text-2xl font-serif font-bold text-[#0F1B2D]">
              {summary ? summary.total : '—'}
            </div>
            <span className="text-xs text-[#286749]">
              {summary ? `${summary.primary_count} primary active` : 'Loading...'}
            </span>
          </div>
          <div className="rounded-xl border border-[#E5E1D8] bg-white p-4">
            <span className="text-xs text-[#6B7280]">Average ATS Score</span>
            <div className="mt-1 text-2xl font-serif font-bold text-[#806236]">
              {summary?.avg_ats_score != null ? `${summary.avg_ats_score}%` : '—'}
            </div>
            <span className="text-xs text-[#6B7280]">
              {summary?.avg_ats_score != null ? 'Across scored resumes' : 'Run an ATS check to score'}
            </span>
          </div>
          <div className="rounded-xl border border-[#E5E1D8] bg-white p-4">
            <span className="text-xs text-[#6B7280]">Showing</span>
            <div className="mt-1 text-2xl font-serif font-bold text-[#0F1B2D]">
              {resumeList.length}
            </div>
            <span className="text-xs text-[#6B7280]">of {total} total resumes</span>
          </div>
        </div>

        {/* Search & Sort */}
        <div className="rounded-xl border border-[#E5E1D8] bg-white p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0A7B4]" size={15} />
            <input
              type="text"
              aria-label="Search resumes"
              placeholder="Search by resume title or role..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setOffset(0);
              }}
              className="w-full h-8 pl-8 pr-3 rounded-lg border border-[#E5E1D8] bg-[#FAF8F4]/50 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#6B7280]">Sort by:</span>
            <select
              aria-label="Sort resumes"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setOffset(0);
              }}
              className="h-8 rounded-lg border border-[#E5E1D8] bg-white px-2.5 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
            >
              <option value="updated_at">Recently Updated</option>
              <option value="created_at">Recently Created</option>
            </select>
          </div>
        </div>

        {actionError && (
          <div className="rounded-xl border border-[#F2C6C2] bg-[#FEF3F2] px-4 py-3 text-xs text-[#B42318]">
            {actionError}
          </div>
        )}

        <ResourceState
          resource={listRes}
          empty={!listRes.loading && !listRes.error && resumeList.length === 0}
          emptyTitle="No resumes yet"
          emptyBody="Create your first tailored resume to run ATS checks and apply faster."
          onRetry={reloadAll}
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {resumeList.map((res) => {
              const isPrimary = !!res.is_default;
              const score = res.ats_score;
              const isBusy = busyId === res.id;
              return (
                <div
                  key={res.id}
                  className="rounded-xl border border-[#E5E1D8] bg-white p-5 shadow-sm space-y-4 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#F3EBDD] font-bold text-sm text-[#806236]">
                          <FileText size={18} />
                        </span>
                        <div className="min-w-0">
                          <Link
                            href={`/jobseeker/resumes/${res.id}`}
                            className="text-sm font-semibold text-[#0F1B2D] hover:underline truncate block"
                          >
                            {res.title}
                          </Link>
                          <span className="text-xs text-[#6B7280] block truncate">
                            {res.target_role || 'No target role set'}
                          </span>
                        </div>
                      </div>

                      {isPrimary && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#F3EBDD] px-2 py-0.5 text-xs font-semibold text-[#806236] shrink-0">
                          <Star size={11} className="fill-[#806236]" /> Primary
                        </span>
                      )}
                    </div>

                    <div className="mt-3 pt-3 border-t border-[#F0EBE0] flex items-center justify-between text-xs">
                      <span className="text-[#6B7280]">ATS Compatibility:</span>
                      {score != null ? (
                        <span
                          className={`font-bold ${
                            score >= 80
                              ? 'text-[#286749]'
                              : score >= 65
                                ? 'text-[#B7791F]'
                                : 'text-[#B42318]'
                          }`}
                        >
                          {score}/100
                        </span>
                      ) : (
                        <span className="text-[#6B7280]">Not scored yet</span>
                      )}
                    </div>

                    <div className="mt-1 flex items-center justify-between text-xs text-[#6B7280]">
                      <span>Last updated:</span>
                      <span>{new Date(res.updated_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#F0EBE0] space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <JobBtn
                        secondary
                        small
                        disabled={isBusy}
                        onClick={() => handleView(res.id)}
                        className="w-full flex items-center justify-center gap-1"
                      >
                        <Eye size={12} /> View
                      </JobBtn>
                      <Link href={`/jobseeker/resumes/${res.id}`} className="w-full">
                        <JobBtn secondary small className="w-full">
                          Edit
                        </JobBtn>
                      </Link>
                      <Link href={`/jobseeker/resumes/${res.id}/tailor`} className="w-full">
                        <JobBtn primary small className="w-full flex items-center justify-center gap-1">
                          <Sparkles size={12} /> Tailor
                        </JobBtn>
                      </Link>
                    </div>

                    <div className="flex items-center justify-between pt-1 text-xs">
                      <Link
                        href={`/jobseeker/resumes/${res.id}/ats`}
                        className="text-[#9A7A45] hover:underline font-medium"
                      >
                        ATS Breakdown
                      </Link>
                      <div className="flex items-center gap-2">
                        {!isPrimary && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => setPrimary(res.id)}
                            className="text-[#6B7280] hover:text-[#0F1B2D] disabled:opacity-50"
                          >
                            Set Primary
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleDuplicate(res.id)}
                          aria-label={`Duplicate ${res.title}`}
                          className="text-[#6B7280] hover:text-[#0F1B2D] disabled:opacity-50"
                        >
                          <Copy size={13} />
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleDelete(res.id)}
                          aria-label={`Delete ${res.title}`}
                          className="text-[#6B7280] hover:text-[#B42318] disabled:opacity-50"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <Pagination
            total={total}
            limit={12}
            offset={offset}
            onPageChange={setOffset}
          />
        </ResourceState>
      </div>

      <ResumePreviewModal
        open={Boolean(previewResume)}
        onClose={() => setPreviewResume(null)}
        resumeData={previewResume}
        contact={userContact}
        onExportPdf={handleExportPdf}
        onExportDocx={handleExportDocx}
        exporting={exporting}
      />
    </JobSeekerShell>
  );
}
