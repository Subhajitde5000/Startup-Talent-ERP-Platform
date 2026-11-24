'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ChevronLeft, AlertTriangle } from 'lucide-react';
import { JobSeekerShell } from '@/components';
import { JobBtn, SafetyStrip } from '@/components/jobseeker-ui';
import {
  StageChip,
  api,
  useCareerResource,
  ResourceState,
  Pagination,
  applicationView,
  stageLabels,
  dateLabel,
  errorLabel,
  Unavailable,
} from '@/components/career-data';

export default function ApplicationDetailPage() {
  const params = useParams();
  const rawId = params?.applicationId;
  const resource = useCareerResource(`application:${rawId}`, (signal) =>
    api.careers.application(rawId, signal)
  );
  const [historyOffset, setHistoryOffset] = useState(0);
  const history = useCareerResource(
    `history:${rawId}:${historyOffset}`,
    (signal) =>
      api.careers.history(rawId, { limit: 20, offset: historyOffset }, signal)
  );
  const [updated, setUpdated] = useState(null);
  const app = resource.data
    ? applicationView(updated?.id === rawId ? updated : resource.data)
    : null;
  const [tab, setTab] = useState('Overview');
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [actionError, setActionError] = useState('');
  const [resumeError, setResumeError] = useState('');
  const handleWithdraw = async () => {
    if (withdrawing) return;
    setWithdrawing(true);
    setActionError('');
    try {
      setUpdated(await api.careers.withdraw(rawId));
      setShowWithdrawModal(false);
      history.reload();
    } catch (error) {
      setActionError(errorLabel(error));
    } finally {
      setWithdrawing(false);
    }
  };
  const downloadResume = async () => {
    setResumeError('');
    try {
      const result = await api.files.download(app.resume_file_id);
      window.open(result.url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      setResumeError(errorLabel(error));
    }
  };
  if (!app)
    return (
      <JobSeekerShell active="Applications" liveData>
        <ResourceState resource={resource} />
      </JobSeekerShell>
    );
  const withdrawn = app.stageKey === 'withdrawn';

  return (
    <JobSeekerShell active="Applications" liveData>
      <div className="space-y-6 max-w-5xl">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-[#6B7280]">
          <Link
            href="/jobseeker/applications"
            className="flex items-center gap-1 hover:text-[#0F1B2D]"
          >
            <ChevronLeft size={14} /> Back to Applications
          </Link>
          <span>/</span>
          <span className="text-[#0F1B2D] font-medium truncate">
            {app.title}
          </span>
        </nav>

        {/* Header Card */}
        <header className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4 min-w-0 flex-1">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#F3EBDD] font-bold text-xl text-[#806236]">
                {app.logo || app.company?.[0] || 'A'}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h1 className="text-xl md:text-2xl font-serif font-bold text-[#0F1B2D]">
                    {app.title}
                  </h1>
                  <StageChip stage={withdrawn ? 'Withdrawn' : app.stage} />
                </div>
                <div className="flex flex-wrap items-center gap-x-3 text-xs text-[#4A5568]">
                  <span className="font-semibold text-[#0F1B2D]">
                    {app.company}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-[#6B7280]">
                Messaging unavailable
              </span>
              {!['withdrawn', 'hired', 'rejected'].includes(app.stageKey) && (
                <JobBtn
                  destructive
                  small
                  onClick={() => setShowWithdrawModal(true)}
                >
                  Withdraw
                </JobBtn>
              )}
            </div>
          </div>

          <section className="pt-4 border-t border-[#F0EBE0] space-y-3">
            <h2 className="text-xs font-semibold uppercase">
              Application stage history
            </h2>
            <ResourceState
              resource={history}
              empty={!history.data?.items.length}
              emptyLabel="No stage history available."
            />
            <ol className="space-y-2 text-xs">
              {history.data?.items.map((event) => (
                <li key={event.id}>
                  {dateLabel(event.created_at)} ·{' '}
                  {event.from_stage
                    ? stageLabels[event.from_stage] + ' → '
                    : ''}
                  {stageLabels[event.to_stage]}
                </li>
              ))}
            </ol>
            <Pagination page={history.data} onChange={setHistoryOffset} />
          </section>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 border-t border-[#E5E1D8] pt-3 overflow-x-auto min-w-0">
            {['Overview', 'Shared Materials', 'Interviews', 'Notes'].map(
              (t) => {
                const active = tab === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      active
                        ? 'bg-[#0F1B2D] text-white'
                        : 'text-[#4A5568] hover:bg-[#FAF8F4]'
                    }`}
                  >
                    {t}
                  </button>
                );
              }
            )}
          </div>
        </header>

        {/* Tab 1: Overview */}
        {tab === 'Overview' && (
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-8 space-y-6">
              <section className="rounded-xl border border-[#E5E1D8] bg-white p-6 shadow-sm space-y-4">
                <h2 className="text-base font-serif font-bold text-[#0F1B2D]">
                  Current Status
                </h2>
                <div className="rounded-xl border border-[#CDE5D7] bg-[#E7F3EC]/30 p-4 text-xs text-[#286749] space-y-1">
                  <span className="font-bold block text-sm">
                    Application Status: {app.stage}
                  </span>
                  <p>
                    {
                      'This is the latest recorded stage. Interview scheduling and feedback are unavailable in this step.'
                    }
                  </p>
                </div>

                <div className="pt-2 text-xs text-[#4A5568] space-y-2">
                  <div className="flex justify-between py-1.5 border-b border-[#F0EBE0]">
                    <span className="text-[#6B7280]">Application ID:</span>
                    <strong className="text-[#0F1B2D]">{app.id}</strong>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-[#F0EBE0]">
                    <span className="text-[#6B7280]">Submission Date:</span>
                    <span>{app.appliedDate}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-[#F0EBE0]">
                    <span className="text-[#6B7280]">Last Activity:</span>
                    <span>{app.lastUpdate}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-[#6B7280]">Source:</span>
                    <span>{app.source}</span>
                  </div>
                </div>
              </section>

              <SafetyStrip liveData />
            </div>

            <aside className="lg:col-span-4 space-y-5">
              <div className="rounded-xl border border-[#E5E1D8] bg-white p-5 shadow-sm space-y-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                  Hiring Contacts
                </span>
                <Unavailable>Hiring contacts and messaging</Unavailable>
              </div>
            </aside>
          </div>
        )}

        {tab === 'Shared Materials' && (
          <section className="rounded-xl border border-[#E5E1D8] bg-white p-6 shadow-sm space-y-4">
            <h2 className="font-serif font-bold">Submitted materials</h2>
            <dl className="space-y-2 text-xs">
              <dt>Contact</dt>
              <dd>
                {app.profile_snapshot.contact.name} ·{' '}
                {app.profile_snapshot.contact.email} ·{' '}
                {app.profile_snapshot.contact.phone || 'No phone'}
              </dd>
              <dt>Links</dt>
              <dd>
                {[
                  app.profile_snapshot.contact.linkedin_url,
                  app.profile_snapshot.contact.portfolio_url,
                  app.profile_snapshot.contact.github_url,
                ]
                  .filter(Boolean)
                  .join(' · ') || 'None provided'}
              </dd>
              <dt>Profile headline</dt>
              <dd>{app.profile_snapshot.headline || 'Not provided'}</dd>
              <dt>Profile summary</dt>
              <dd className="whitespace-pre-wrap">
                {app.profile_snapshot.summary || 'Not provided'}
              </dd>
              <dt>Experience / location</dt>
              <dd>
                {app.profile_snapshot.experience_years ?? 'Not provided'} years
                · {app.profile_snapshot.current_location || 'Not provided'}
              </dd>
              <dt>Skills</dt>
              <dd>
                {app.profile_snapshot.skills.join(', ') || 'None provided'}
              </dd>
              <dt>Cover note</dt>
              <dd className="whitespace-pre-wrap">
                {app.cover_note || 'Not provided'}
              </dd>
              <dt>Annual salary expectation</dt>
              <dd>{app.salaryExpectation}</dd>
              {app.screening_answers.map((answer) => (
                <React.Fragment key={answer.key}>
                  <dt>{answer.prompt}</dt>
                  <dd>
                    {typeof answer.value === 'boolean'
                      ? answer.value
                        ? 'Yes'
                        : 'No'
                      : answer.value}
                  </dd>
                </React.Fragment>
              ))}
              <dt>Sharing consent recorded</dt>
              <dd>{dateLabel(app.consent_shared_at)}</dd>
              <dt>Accuracy confirmed</dt>
              <dd>{dateLabel(app.accuracy_confirmed_at)}</dd>
            </dl>
            {app.resume_file_id ? (
              <JobBtn secondary small onClick={downloadResume}>
                Download submitted resume
              </JobBtn>
            ) : (
              <p className="text-xs">No resume was attached.</p>
            )}
            {resumeError && (
              <p role="alert" className="text-xs text-rose-700">
                {resumeError}
              </p>
            )}
          </section>
        )}
        {tab === 'Interviews' && (
          <Unavailable>Interview scheduling</Unavailable>
        )}
        {tab === 'Notes' && <Unavailable>Private candidate notes</Unavailable>}
        {actionError && !showWithdrawModal && (
          <p role="alert" className="text-sm text-rose-700">
            {actionError}
          </p>
        )}

        {/* Withdraw Confirmation Modal */}
        {showWithdrawModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
              <div className="flex items-center gap-2 text-[#B42318]">
                <AlertTriangle size={20} />
                <h3 className="text-base font-bold">Withdraw Application?</h3>
              </div>
              <p className="text-xs text-[#4A5568] leading-relaxed">
                Are you sure you want to withdraw your application for{' '}
                <strong>{app.title}</strong> at {app.company}? This changes the
                application stage to Withdrawn. You cannot submit a new
                application for this job.
              </p>
              <div className="pt-2 flex items-center justify-end gap-2">
                <JobBtn
                  secondary
                  small
                  onClick={() => setShowWithdrawModal(false)}
                >
                  Cancel
                </JobBtn>
                {actionError && (
                  <p role="alert" className="text-xs text-rose-700">
                    {actionError}
                  </p>
                )}
                <JobBtn
                  destructive
                  small
                  disabled={withdrawing}
                  onClick={handleWithdraw}
                >
                  {withdrawing ? 'Withdrawing…' : 'Confirm Withdrawal'}
                </JobBtn>
              </div>
            </div>
          </div>
        )}
      </div>
    </JobSeekerShell>
  );
}
