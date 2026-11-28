'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Sparkles, Clock, FileText, X } from 'lucide-react';
import { JobSeekerShell, Card, Button } from '@/components';
import {
  api,
  useCareerResource,
  ResourceState,
  jobView,
  applicationView,
  dateLabel,
  errorLabel,
} from '@/components/career-data';
import { useAuth } from '@/lib/auth-context';
import { JobseekerDisclaimer } from '../jobseeker-data';

// Step 7u: every number on this page comes from the API. Data the platform
// does not track yet (profile views, percentile ranks, portfolio
// verification, "new postings today") is hidden rather than invented.
const ACTIVE_STAGES = ['applied', 'review', 'shortlisted', 'interview', 'offered'];
const FORMAT_LABELS = { video: 'Video call', phone: 'Phone call', onsite: 'On-site', async: 'Async' };
const INTERVIEW_STATUS = {
  confirmed: ['Confirmed', 'bg-[#E7F3EC] text-[#286749]'],
  scheduled: ['Awaiting confirmation', 'bg-[#FFF3D6] text-[#8A5700]'],
};

function interviewWhen(interview) {
  const start = new Date(interview.scheduled_at);
  if (Number.isNaN(start.getTime())) return 'Time not set';
  const end = new Date(start.getTime() + (interview.duration_min || 0) * 60000);
  const day = start.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
  const time = (d) => d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  return interview.duration_min ? `${day} · ${time(start)} – ${time(end)}` : `${day} · ${time(start)}`;
}

function equityLabel(job) {
  const lo = job.equity_min_pct;
  const hi = job.equity_max_pct;
  if (lo == null && hi == null) return null;
  if (lo != null && hi != null && Number(lo) !== Number(hi)) return `${Number(lo)}–${Number(hi)}%`;
  return `${Number(lo ?? hi)}%`;
}

function MetricValue({ resource, value }) {
  if (resource.loading) return <span className="serif mt-1 block text-3xl font-semibold text-[#A0A7B4]">…</span>;
  if (resource.error) return <span className="serif mt-1 block text-3xl font-semibold text-[#A0A7B4]">—</span>;
  return <span className="serif mt-1 block text-3xl font-semibold text-ink">{value}</span>;
}

export default function JobSeekerDashboardPage() {
  const { user } = useAuth();
  const [modal, setModal] = useState('');
  const [prepTarget, setPrepTarget] = useState(null);
  const [savingId, setSavingId] = useState('');

  const upcoming = useCareerResource('dash:interviews:upcoming', (signal) =>
    api.interviews.mine({ window: 'upcoming', limit: 5 }, signal)
  );
  // One count per active stage (limit 1) so the total is exact, not a page sum.
  const activeCounts = useCareerResource('dash:applications:counts', (signal) =>
    Promise.all(
      ACTIVE_STAGES.map((stage) => api.careers.applications({ stage, limit: 1 }, signal).then((p) => p.total))
    ).then((totals) => totals.reduce((a, b) => a + b, 0))
  );
  const recentApps = useCareerResource('dash:applications:recent', (signal) =>
    api.careers.applications({ limit: 20 }, signal)
  );
  const saved = useCareerResource('dash:saved', (signal) => api.savedJobs.list({ limit: 100 }, signal));
  const openRoles = useCareerResource('dash:open-roles', (signal) =>
    api.careers.jobs({ sort: 'newest', limit: 3 }, true, signal)
  );
  const readiness = useCareerResource('dash:readiness', (signal) => api.users.readiness(signal));
  const resumes = useCareerResource('dash:resumes', (signal) =>
    api.resumes.list({ sort: 'updated_at', order: 'desc', limit: 20 }, signal)
  );

  const nextInterview = upcoming.data?.items?.[0] || null;
  const upcomingTotal = upcoming.data?.total ?? 0;
  const savedIds = new Set((saved.data?.items || []).map((s) => s.job_id));
  const activeApps = (recentApps.data?.items || [])
    .filter((a) => ACTIVE_STAGES.includes(a.stage))
    .slice(0, 3)
    .map(applicationView);
  const roles = (openRoles.data?.items || []).map((j) => ({ raw: j, view: jobView(j) }));
  const resumeItems = resumes.data?.items || [];
  const primaryResume = resumeItems.find((r) => r.is_default) || resumeItems[0] || null;
  const firstName = (user?.display_name || '').trim().split(/\s+/)[0];

  const description = upcoming.loading
    ? 'Here is where your job search stands today.'
    : upcomingTotal > 0
      ? `You have ${upcomingTotal} upcoming interview${upcomingTotal === 1 ? '' : 's'}.`
      : 'No interviews scheduled yet — keep applying to open roles.';

  return (
    <JobSeekerShell
      active="Dashboard"
      module="Forma Careers"
      title={firstName ? `Welcome back, ${firstName}` : 'Welcome back'}
      description={description}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/jobseeker/practice"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[#E5E1D8] bg-white px-3.5 text-xs font-semibold text-ink hover:bg-[#FAF8F4] transition"
          >
            <Sparkles size={14} className="text-[#806236]" /> Practice interview
          </Link>
          <Link
            href="/jobseeker/jobs"
            className="inline-flex min-h-10 items-center rounded-lg bg-ink px-4 text-xs font-semibold text-white hover:bg-[#1C2B42] transition"
          >
            Explore jobs
          </Link>
        </div>
      }
    >
      {({ notify }) => {
        const toggleSave = async (jobId) => {
          if (savingId) return;
          setSavingId(jobId);
          const wasSaved = savedIds.has(jobId);
          try {
            if (wasSaved) await api.savedJobs.delete(jobId);
            else await api.savedJobs.create({ job_id: jobId });
            notify(wasSaved ? 'Removed from saved roles.' : 'Saved to your bookmarks.');
            saved.reload();
          } catch (error) {
            notify(errorLabel(error));
          } finally {
            setSavingId('');
          }
        };

        const metrics = [
          [
            'Active applications',
            activeCounts,
            activeCounts.data ?? 0,
            upcoming.data ? `${upcomingTotal} interview${upcomingTotal === 1 ? '' : 's'} scheduled` : '',
          ],
          [
            'Upcoming interviews',
            upcoming,
            upcomingTotal,
            nextInterview ? interviewWhen(nextInterview) : upcoming.data ? 'None scheduled' : '',
          ],
          ['Saved job roles', saved, saved.data?.total ?? 0, ''],
        ];

        return (
          <>
            {/* Top Metrics Strip */}
            <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {metrics.map(([label, resource, val, hint]) => (
                <div key={label} className="rounded-xl border border-[#E5E1D8] bg-white p-5 shadow-sm">
                  <span className="text-xs font-medium text-[#4A5568]">{label}</span>
                  <MetricValue resource={resource} value={val} />
                  <span className="text-xs text-[#286749]">{resource.error ? 'Could not load' : hint}</span>
                </div>
              ))}
            </div>

            {/* Main 2-Column Grid */}
            <div className="grid items-start gap-6 xl:grid-cols-3">
              <div className="space-y-6 xl:col-span-2 min-w-0">
                {/* Upcoming Interview Card */}
                <Card
                  title="Next upcoming interview"
                  action={
                    nextInterview && INTERVIEW_STATUS[nextInterview.status] ? (
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${INTERVIEW_STATUS[nextInterview.status][1]}`}
                      >
                        {INTERVIEW_STATUS[nextInterview.status][0]}
                      </span>
                    ) : null
                  }
                >
                  <ResourceState
                    resource={upcoming}
                    empty={!nextInterview}
                    emptyTitle="No upcoming interviews"
                    emptyBody="When an employer schedules an interview on one of your applications, it appears here."
                  >
                    {nextInterview && (
                      <div className="rounded-xl bg-[#FAF8F4] p-4 border border-[#E5E1D8]">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <b className="text-sm font-bold text-ink">
                              {nextInterview.company_name} · {nextInterview.job_title}
                            </b>
                            {nextInterview.round_name && (
                              <p className="mt-1 text-xs text-[#4A5568]">{nextInterview.round_name}</p>
                            )}
                            <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs text-ink">
                              <span className="flex items-center gap-1 font-semibold text-[#806236]">
                                <Clock size={14} /> {interviewWhen(nextInterview)}
                              </span>
                              <span className="text-[#4A5568]">·</span>
                              <span className="text-[#4A5568]">
                                {FORMAT_LABELS[nextInterview.format] || nextInterview.format}
                                {nextInterview.location ? ` (${nextInterview.location})` : ''}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              href="/jobseeker/practice/new"
                              className="rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1C2B42]"
                            >
                              AI Mock Practice →
                            </Link>
                            <Button
                              secondary
                              onClick={() => {
                                setPrepTarget(nextInterview);
                                setModal('prep');
                              }}
                            >
                              Prep checklist
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </ResourceState>
                </Card>

                {/* Open roles (newest public postings) */}
                <Card
                  title="Open roles"
                  action={
                    <Link
                      href="/jobseeker/jobs"
                      className="text-xs font-semibold text-[#9A7A45] hover:underline"
                    >
                      Browse all roles →
                    </Link>
                  }
                >
                  <ResourceState
                    resource={openRoles}
                    empty={roles.length === 0}
                    emptyTitle="No open roles right now"
                    emptyBody="New postings from startups and employers will show up here."
                  >
                    <div className="space-y-4">
                      {roles.map(({ raw, view: j }) => {
                        const equity = equityLabel(raw);
                        return (
                          <article
                            key={j.id}
                            className="rounded-xl border border-[#E5E1D8] p-4 transition hover:border-ink hover:shadow-sm bg-white"
                          >
                            <div className="flex items-start gap-3">
                              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#F3EBDD] text-lg font-bold text-ink">
                                {j.logo}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div>
                                    <Link
                                      href={`/jobseeker/jobs/${j.id}`}
                                      className="text-sm font-semibold text-ink hover:underline"
                                    >
                                      {j.title}
                                    </Link>
                                    <p className="text-xs text-[#4A5568]">
                                      {[j.company.name, j.loc, j.stage].filter(Boolean).join(' · ')}
                                    </p>
                                  </div>
                                </div>

                                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E1D8] pt-3">
                                  <span className="text-xs font-semibold text-ink">
                                    {j.salary}
                                    {equity && <span className="font-normal text-[#4A5568]"> · Equity {equity}</span>}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => toggleSave(j.id)}
                                      disabled={savingId === j.id || saved.loading}
                                      className="rounded-lg border border-[#E5E1D8] bg-white px-3 py-1.5 text-xs font-medium text-ink hover:bg-[#FAF8F4] disabled:opacity-50"
                                    >
                                      {savedIds.has(j.id) ? 'Saved' : 'Save'}
                                    </button>
                                    {raw.own_application_id ? (
                                      <Link
                                        href={`/jobseeker/applications/${raw.own_application_id}`}
                                        className="rounded-lg border border-[#E5E1D8] bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-[#FAF8F4]"
                                      >
                                        View application
                                      </Link>
                                    ) : raw.can_apply ? (
                                      <Link
                                        href={`/jobseeker/jobs/${j.id}/apply`}
                                        className="rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1C2B42]"
                                      >
                                        Apply now
                                      </Link>
                                    ) : (
                                      <span className="text-xs text-[#6B7280]">Not accepting applications</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </ResourceState>
                </Card>

                {/* Applications Pipeline Snapshot */}
                <Card
                  title="Active applications"
                  action={
                    <Link
                      href="/jobseeker/applications"
                      className="text-xs font-semibold text-[#9A7A45] hover:underline"
                    >
                      View all applications →
                    </Link>
                  }
                >
                  <ResourceState
                    resource={recentApps}
                    empty={activeApps.length === 0}
                    emptyTitle="No active applications"
                    emptyBody="Applications you submit and that are still in progress appear here."
                  >
                    <div className="space-y-3">
                      {activeApps.map((app) => (
                        <div
                          key={app.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#E5E1D8] p-3 hover:bg-[#FAF8F4] transition"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#F3EBDD] text-xs font-bold text-ink">
                              {app.logo}
                            </span>
                            <div className="min-w-0">
                              <b className="block text-xs font-semibold text-ink truncate">{app.title}</b>
                              <span className="text-xs text-[#4A5568]">{app.company} · {app.updated}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                app.stageKey === 'interview' || app.stageKey === 'offered'
                                  ? 'bg-[#E7F3EC] text-[#286749]'
                                  : app.stageKey === 'shortlisted'
                                    ? 'bg-[#F3EBDD] text-[#806236]'
                                    : 'bg-[#F3F4F6] text-[#4A5568]'
                              }`}
                            >
                              {app.stage}
                            </span>
                            <Link
                              href={`/jobseeker/applications/${app.id}`}
                              className="text-xs font-semibold text-[#9A7A45] hover:underline"
                            >
                              Details →
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ResourceState>
                </Card>
              </div>

              {/* Right Sidebar */}
              <aside className="space-y-6 min-w-0">
                {/* Readiness Score */}
                <Card title="Candidate readiness">
                  <ResourceState resource={readiness}>
                    {readiness.data && (
                      <>
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="serif text-4xl font-bold text-ink">{readiness.data.overall_score}</span>
                            <span className="text-xs text-[#4A5568]"> / 100</span>
                            <p className="mt-1 text-xs text-[#4A5568]">
                              Profile {readiness.data.profile_complete}% complete
                            </p>
                          </div>
                          <span className="rounded-full bg-[#E7F3EC] p-3 text-[#286749]">
                            <Sparkles size={24} />
                          </span>
                        </div>
                        <div className="mt-4 space-y-2 text-xs border-t border-[#E5E1D8] pt-3">
                          <div className="flex justify-between">
                            <span className="text-[#4A5568]">Resume ATS Optimization</span>
                            <b className="text-ink">{readiness.data.resume_score}%</b>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#4A5568]">Mock Interview Score</span>
                            <b className="text-ink">{readiness.data.practice_score}%</b>
                          </div>
                        </div>
                      </>
                    )}
                  </ResourceState>
                  <Link
                    href="/jobseeker/readiness"
                    className="mt-4 inline-block text-xs font-semibold text-[#9A7A45] hover:underline"
                  >
                    View detailed rubric report →
                  </Link>
                </Card>

                {/* Primary Resume Snapshot */}
                <Card title="Primary resume">
                  <ResourceState
                    resource={resumes}
                    empty={!primaryResume}
                    emptyTitle="No resume yet"
                    emptyBody="Build a resume to apply faster and run an ATS check."
                  >
                    {primaryResume && (
                      <>
                        <div className="flex items-start gap-3">
                          <FileText size={20} className="text-[#806236] shrink-0 mt-0.5" />
                          <div>
                            <b className="text-xs font-semibold text-ink">
                              {primaryResume.title}
                              {primaryResume.is_default && !/\(primary\)/i.test(primaryResume.title) ? ' (Primary)' : ''}
                            </b>
                            <p className="text-xs text-[#4A5568]">
                              Updated {dateLabel(primaryResume.updated_at)}
                              {primaryResume.ats_score != null ? ` · ATS Score ${primaryResume.ats_score}` : ' · No ATS scan yet'}
                            </p>
                          </div>
                        </div>
                        <div className="mt-4 flex gap-2">
                          <Link
                            href={`/jobseeker/resumes/${primaryResume.id}`}
                            className="rounded-lg border border-[#E5E1D8] bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-[#FAF8F4]"
                          >
                            Edit resume
                          </Link>
                          <Link
                            href={`/jobseeker/resumes/${primaryResume.id}/ats`}
                            className="rounded-lg border border-[#E5E1D8] bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-[#FAF8F4]"
                          >
                            Run ATS scan
                          </Link>
                        </div>
                      </>
                    )}
                  </ResourceState>
                  {!resumes.loading && !resumes.error && !primaryResume && (
                    <Link
                      href="/jobseeker/resumes/new"
                      className="mt-3 inline-block rounded-lg border border-[#E5E1D8] bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-[#FAF8F4]"
                    >
                      Create resume
                    </Link>
                  )}
                </Card>

                {/* Practice Shortcut */}
                <Card title="AI Interview trainer">
                  <p className="text-xs text-[#4A5568] leading-relaxed">
                    Practice realistic behavioral and system design interview prompts with real-time feedback.
                  </p>
                  <Link
                    href="/jobseeker/practice/new"
                    className="mt-3 inline-block rounded-lg bg-ink px-4 py-2 text-xs font-semibold text-white hover:bg-[#1C2B42]"
                  >
                    Start 15-min practice session
                  </Link>
                </Card>
              </aside>
            </div>

            <JobseekerDisclaimer onLearnMore={() => notify('Platform guidelines opened.')} />

            {/* Preparation Modal — generic guidance, no stored state. */}
            {modal === 'prep' && prepTarget && (
              <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4 backdrop-blur-sm">
                <section
                  role="dialog"
                  aria-modal="true"
                  className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="serif text-xl font-bold text-ink">Interview prep checklist</h2>
                    <button type="button" onClick={() => setModal('')} aria-label="Close">
                      <X size={18} />
                    </button>
                  </div>
                  <p className="text-xs text-[#4A5568]">
                    Target: <b>{prepTarget.company_name}</b> · {prepTarget.job_title}
                  </p>
                  <div className="mt-4 space-y-2.5 text-xs">
                    {[
                      `Review ${prepTarget.company_name}'s product and the ${prepTarget.job_title} job description`,
                      'Prepare 2 deep-dive examples explaining your decisions and tradeoffs',
                      'Prepare STAR stories for cross-functional collaboration and conflict',
                      'Check your camera, audio and screen sharing before the call',
                    ].map((item) => (
                      <label key={item} className="flex items-start gap-2.5 cursor-pointer">
                        <input type="checkbox" defaultChecked={false} className="mt-0.5 h-4 w-4 rounded accent-ink" />
                        <span className="text-ink">{item}</span>
                      </label>
                    ))}
                  </div>
                  <div className="mt-6 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setModal('')}
                      className="rounded-lg border px-3 py-2 text-xs font-medium text-[#4A5568]"
                    >
                      Close
                    </button>
                    <Link
                      href="/jobseeker/practice/new"
                      className="rounded-lg bg-ink px-4 py-2 text-xs font-semibold text-white"
                    >
                      Practice AI Mock
                    </Link>
                  </div>
                </section>
              </div>
            )}
          </>
        );
      }}
    </JobSeekerShell>
  );
}
