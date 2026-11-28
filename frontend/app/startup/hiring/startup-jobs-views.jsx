'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  Check,
  Edit3,
  Eye,
  FileText,
  LockKeyhole,
  Mail,
  MapPin,
  Plus,
  Search,
  Share2,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { Btn, Card } from '../../../components';
import { api } from '@/lib/api/client';
import {
  DEPARTMENT_OPTIONS,
  EMPLOYMENT_TYPE_OPTIONS,
  EmptyState,
  ErrorState,
  JOB_STATUS_LABELS,
  LoadingState,
  PIPELINE_STAGES,
  REJECTION_REASONS,
  REVIEWER_MOVE_STAGES,
  STAGE_LABELS,
  VISIBILITY_OPTIONS,
  ViewerRestrictedState,
  WORK_MODE_OPTIONS,
  errorMessage,
  extractFieldErrors,
  formatDate,
  formatDateTime,
  formatMoney,
  labelFor,
} from './startup-hiring-shared';

export function StartupOverviewView({
  org,
  myRole,
  pageHead,
  notify,
  requestsFallback,
}) {
  const isReviewer = myRole === 'owner' || myRole === 'admin' || myRole === 'member';
  const isAdmin = myRole === 'owner' || myRole === 'admin';
  const verified = org.verification_status === 'verified';

  const [tab, setTab] = useState('Jobs');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [state, setState] = useState('loading');
  const [err, setErr] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const [dashboard, setDashboard] = useState(null);
  const [jobsPage, setJobsPage] = useState({ items: [], total: 0 });
  const [upcomingInterviews, setUpcomingInterviews] = useState({ items: [], total: 0 });
  const [sentOffersTotal, setSentOffersTotal] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    setState('loading');
    setErr('');

    (async () => {
      try {
        const [dashRes, jobsRes, ivRes, offersRes] = await Promise.all([
          api.hiringInsights.dashboard(org.id, controller.signal),
          api.jobs.list(
            org.id,
            {
              limit: 50,
              q: search.trim() || undefined,
              status: statusFilter === 'all' ? undefined : statusFilter,
            },
            controller.signal
          ),
          isReviewer
            ? api.interviews.list(org.id, { window: 'upcoming', limit: 5 }, controller.signal)
            : Promise.resolve({ items: [], total: 0 }),
          isReviewer
            ? api.jobOffers.list(org.id, { status: 'sent', limit: 1 }, controller.signal)
            : Promise.resolve(null),
        ]);
        if (controller.signal.aborted) return;
        setDashboard(dashRes);
        setJobsPage(jobsRes);
        setUpcomingInterviews(ivRes);
        setSentOffersTotal(offersRes ? offersRes.total : null);
        setState('ready');
      } catch (e) {
        if (controller.signal.aborted) return;
        setErr(errorMessage(e, 'Could not load hiring overview.'));
        setState('error');
      }
    })();

    return () => controller.abort();
  }, [org.id, isReviewer, search, statusFilter, reloadKey]);

  const applicantCountByJob = useMemo(() => {
    const map = {};
    for (const j of dashboard?.jobs || []) {
      map[j.job_id] = j.applicants;
    }
    return map;
  }, [dashboard]);

  const kpis = dashboard?.kpis;

  return (
    <>
      {pageHead(
        'Hiring',
        'Find the people who will build what’s next.',
        <>
          <Link
            href="/startup/hiring/requests/new"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[9px] border border-[#E5E1D8] bg-white px-3.5 text-sm font-semibold text-ink transition hover:bg-[#F4F1EA]"
          >
            <Plus size={16} /> Hiring request
          </Link>
          {isAdmin && (
            <Link
              href="/startup/hiring/jobs/new"
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[9px] bg-ink px-3.5 text-sm font-semibold text-white transition hover:bg-[#1C2B42]"
            >
              <Plus size={16} /> Job post
            </Link>
          )}
        </>
      )}

      {!verified && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-[#E7D4B0] bg-[#FFF8E8] p-4 text-sm">
          <ShieldCheck size={19} className="text-[#9A7A45]" />
          <span className="flex-1">
            <b>Verify your startup to show the verified badge on your job posts.</b>
            <small className="block text-xs text-[#4A5568]">
              Current status: {org.verification_status || 'unverified'}.
            </small>
          </span>
          <Link
            href="/startup/hiring/employer-page"
            className="rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white"
          >
            Employer page
          </Link>
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[#E5E1D8] bg-[#E5E1D8] sm:grid-cols-5">
        {[
          ['Open jobs', kpis ? kpis.open_jobs : '—'],
          ['Total applicants', kpis ? kpis.total_applicants : '—'],
          ['Upcoming interviews', isReviewer ? upcomingInterviews.total : '—'],
          ['Offers out', isReviewer && sentOffersTotal !== null ? sentOffersTotal : '—'],
          [
            'Avg time to hire',
            kpis?.avg_time_to_hire_days != null ? `${kpis.avg_time_to_hire_days}d` : '—',
          ],
        ].map(([label, value]) => (
          <div key={label} className="bg-white p-4 sm:px-5">
            <p className="text-xs text-[#4A5568]">{label}</p>
            <b className="serif mt-1 block text-2xl">{value}</b>
          </div>
        ))}
      </div>

      <div className="mb-5 flex gap-1 rounded-xl border border-[#E5E1D8] bg-white p-1">
        {['Jobs', 'Requests', 'Needs attention'].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`min-h-10 rounded-lg px-4 text-sm ${
              tab === t ? 'bg-ink font-semibold text-white' : 'text-[#4A5568]'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-3">
        <div className="space-y-3 xl:col-span-2">
          {tab === 'Jobs' ? (
            <>
              <div className="mb-2 flex flex-wrap gap-2">
                <div className="relative min-w-[180px] flex-1">
                  <Search className="absolute left-3 top-2.5 text-[#A0A7B4]" size={16} />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search job title"
                    className="h-10 w-full rounded-lg border border-[#E5E1D8] bg-white pl-9 text-sm"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-10 rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs"
                >
                  <option value="all">All statuses</option>
                  <option value="open">Open</option>
                  <option value="draft">Draft</option>
                  <option value="paused">Paused</option>
                  <option value="closed">Closed</option>
                </select>
              </div>

              {state === 'loading' ? (
                <LoadingState label="Loading jobs…" />
              ) : state === 'error' ? (
                <ErrorState message={err} onRetry={() => setReloadKey((k) => k + 1)} />
              ) : jobsPage.items.length === 0 ? (
                <EmptyState
                  title="No jobs found"
                  description={
                    search || statusFilter !== 'all'
                      ? 'Try clearing your search or status filter.'
                      : 'Create your first job post to start receiving applications.'
                  }
                  action={
                    isAdmin && (
                      <Link
                        href="/startup/hiring/jobs/new"
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-ink px-3.5 text-xs font-semibold text-white"
                      >
                        <Plus size={14} /> Create job post
                      </Link>
                    )
                  }
                />
              ) : (
                jobsPage.items.map((j) => {
                  const applicantCount = applicantCountByJob[j.id] ?? 0;
                  const statusLabel = JOB_STATUS_LABELS[j.status] || j.status;
                  return (
                    <article key={j.id} className="rounded-xl border border-[#E5E1D8] bg-white p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <Link
                            href={`/startup/hiring/${j.id}`}
                            className="text-base font-semibold hover:underline"
                          >
                            {j.title}
                          </Link>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#4A5568]">
                            {j.department && <span>{labelFor(DEPARTMENT_OPTIONS, j.department)}</span>}
                            <span>
                              <MapPin className="mr-1 inline" size={12} />
                              {j.location || labelFor(WORK_MODE_OPTIONS, j.work_mode)}
                            </span>
                            <span>{labelFor(EMPLOYMENT_TYPE_OPTIONS, j.employment_type)}</span>
                            <span>
                              {j.posted_at
                                ? `Posted ${formatDate(j.posted_at)}`
                                : `Created ${formatDate(j.created_at)}`}
                            </span>
                          </div>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            j.status === 'open'
                              ? 'bg-[#E7F3EC] text-[#286749]'
                              : j.status === 'draft'
                                ? 'bg-[#F3F4F6] text-[#4A5568]'
                                : 'bg-[#FFF3D6] text-[#8A5700]'
                          }`}
                        >
                          {statusLabel}
                        </span>
                      </div>
                      <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <b className="text-sm">
                            {applicantCount} {applicantCount === 1 ? 'applicant' : 'applicants'}
                          </b>
                        </div>
                        <div className="flex items-center gap-3">
                          <Link
                            href={`/startup/hiring/${j.id}`}
                            className="text-xs font-semibold text-[#9A7A45]"
                          >
                            View pipeline <ArrowRight className="inline" size={13} />
                          </Link>
                          {isAdmin && (
                            <Link
                              href={`/startup/hiring/jobs/new?jobId=${j.id}`}
                              className="text-xs text-[#4A5568] hover:text-ink"
                            >
                              Edit
                            </Link>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </>
          ) : tab === 'Requests' ? (
            requestsFallback
          ) : state === 'loading' ? (
            <LoadingState label="Checking attention items…" />
          ) : state === 'error' ? (
            <ErrorState message={err} onRetry={() => setReloadKey((k) => k + 1)} />
          ) : (dashboard?.attention || []).length === 0 ? (
            <EmptyState
              title="Nothing needs attention"
              description="All active jobs are up to date with no unreviewed applicants."
            />
          ) : (
            <Card title="Needs attention">
              <div className="space-y-3">
                {dashboard.attention.map((item) => (
                  <div
                    key={item.job_id}
                    className="flex items-center gap-3 rounded-lg border border-[#E5E1D8] p-3"
                  >
                    <AlertCircle className="text-[#B7791F]" size={18} />
                    <span className="flex-1">
                      <b className="block text-xs">
                        {item.unreviewed_applicants} unreviewed{' '}
                        {item.unreviewed_applicants === 1 ? 'applicant' : 'applicants'}
                      </b>
                      <small className="text-[11px] text-[#4A5568]">{item.title}</small>
                    </span>
                    <Link
                      href={`/startup/hiring/${item.job_id}`}
                      className="text-xs font-semibold text-[#9A7A45]"
                    >
                      Review <ArrowRight className="inline" size={13} />
                    </Link>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        <aside className="space-y-5">
          <Card
            title="Upcoming interviews"
            action={
              isReviewer && (
                <Link href="/startup/hiring/interviews" className="text-xs text-[#9A7A45]">
                  View all
                </Link>
              )
            }
          >
            {!isReviewer ? (
              <p className="text-xs text-[#4A5568]">
                Viewers do not have access to interview schedules.
              </p>
            ) : upcomingInterviews.items.length === 0 ? (
              <p className="text-xs text-[#4A5568]">No upcoming interviews scheduled.</p>
            ) : (
              upcomingInterviews.items.map((iv) => (
                <div key={iv.id} className="flex items-center gap-3 border-t border-[#E5E1D8] py-3">
                  <CalendarDays size={15} className="shrink-0 text-[#9A7A45]" />
                  <span>
                    <b className="block text-xs">{iv.candidate_label}</b>
                    <small className="text-[10px] text-[#4A5568]">
                      {formatDateTime(iv.scheduled_at)} · {iv.job_title}
                    </small>
                  </span>
                </div>
              ))
            )}
          </Card>

          <Card title="Hiring budget">
            <p className="text-xs text-[#4A5568]">
              Budget tracking and runway impact will connect when Billing (Step 14) is enabled.
            </p>
          </Card>

          <Card title="Posting plan">
            <p className="text-xs text-[#4A5568]">
              Plan limits and billing options are not enabled yet (Step 14).
            </p>
          </Card>
        </aside>
      </div>
    </>
  );
}

export function StartupJobEditorView({ org, myRole, pageHead, notify }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editJobId = searchParams?.get('jobId') || '';
  const isAdmin = myRole === 'owner' || myRole === 'admin';

  const [loading, setLoading] = useState(Boolean(editJobId));
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');

  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('engineering');
  const [employmentType, setEmploymentType] = useState('full_time');
  const [workMode, setWorkMode] = useState('remote');
  const [location, setLocation] = useState('Remote · India');
  const [description, setDescription] = useState('');
  const [responsibilities, setResponsibilities] = useState('');
  const [requirements, setRequirements] = useState('');
  const [whatWeOffer, setWhatWeOffer] = useState('');
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [showSalaryPublicly, setShowSalaryPublicly] = useState(true);
  const [blindReview, setBlindReview] = useState(false);
  const [visibility, setVisibility] = useState('public');
  const [fairHiring, setFairHiring] = useState(true);
  const [skillQuery, setSkillQuery] = useState('');
  const [skillResults, setSkillResults] = useState([]);
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [jobStatus, setJobStatus] = useState('draft');

  useEffect(() => {
    if (!editJobId || !isAdmin) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setLoadError('');
    api.jobs
      .get(org.id, editJobId, controller.signal)
      .then((job) => {
        if (controller.signal.aborted) return;
        setTitle(job.title || '');
        setDepartment(job.department || 'engineering');
        setEmploymentType(job.employment_type || 'full_time');
        setWorkMode(job.work_mode || 'remote');
        setLocation(job.location || '');
        setDescription(job.description || '');
        setResponsibilities(job.responsibilities || '');
        setRequirements(job.requirements || '');
        setWhatWeOffer(job.what_we_offer || '');
        setSalaryMin(job.salary_min != null ? String(job.salary_min) : '');
        setSalaryMax(job.salary_max != null ? String(job.salary_max) : '');
        setShowSalaryPublicly(Boolean(job.show_salary_publicly));
        setBlindReview(Boolean(job.blind_review_enabled));
        setVisibility(job.visibility || 'public');
        setFairHiring(Boolean(job.fair_hiring_confirmed));
        setJobStatus(job.status || 'draft');
        setSelectedSkills(
          (job.skills || []).map((s) => ({
            skill_id: s.skill_id,
            name: s.name,
            is_required: s.is_required,
          }))
        );
        setLoading(false);
      })
      .catch((e) => {
        if (controller.signal.aborted) return;
        setLoadError(errorMessage(e, 'Could not load job for editing.'));
        setLoading(false);
      });
    return () => controller.abort();
  }, [org.id, editJobId, isAdmin]);

  useEffect(() => {
    const q = skillQuery.trim();
    if (!q) {
      setSkillResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api.skills
        .search({ q, limit: 8, signal: controller.signal })
        .then((rows) => {
          if (!controller.signal.aborted) setSkillResults(rows || []);
        })
        .catch(() => {});
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [skillQuery]);

  const handleSave = async (publishAfter) => {
    setSaving(true);
    setFieldErrors({});
    setFormError('');
    const payload = {
      title: title.trim(),
      department,
      employment_type: employmentType,
      work_mode: workMode,
      location: location.trim() || null,
      description: description.trim() || null,
      responsibilities: responsibilities.trim() || null,
      requirements: requirements.trim() || null,
      what_we_offer: whatWeOffer.trim() || null,
      salary_min: salaryMin.trim() || null,
      salary_max: salaryMax.trim() || null,
      show_salary_publicly: showSalaryPublicly,
      visibility,
      fair_hiring_confirmed: fairHiring,
      skills: selectedSkills.map((s) => ({
        skill_id: s.skill_id,
        is_required: s.is_required !== false,
      })),
    };

    try {
      const savedJob = editJobId
        ? await api.jobs.update(org.id, editJobId, payload)
        : await api.jobs.create(org.id, payload);

      if (blindReview && !savedJob.blind_review_enabled) {
        await api.applicants.settings(org.id, savedJob.id, { blind_review_enabled: true });
      }
      if (publishAfter && savedJob.status !== 'open') {
        await api.jobs.publish(org.id, savedJob.id);
        notify('Job published.');
      } else {
        notify(editJobId ? 'Job updated.' : 'Job draft saved.');
      }
      router.push(`/startup/hiring/${savedJob.id}`);
    } catch (e) {
      setFieldErrors(extractFieldErrors(e));
      setFormError(errorMessage(e, 'Could not save job.'));
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <>
        {pageHead('Job post', 'Create or edit a startup job post.')}
        <ViewerRestrictedState message="Only startup owners and admins can create or edit job posts." />
      </>
    );
  }

  if (loading) {
    return (
      <>
        {pageHead('Edit job post', 'Loading existing job details…')}
        <LoadingState label="Loading job…" />
      </>
    );
  }

  if (loadError) {
    return (
      <>
        {pageHead('Edit job post', 'Could not load job details.')}
        <ErrorState message={loadError} />
      </>
    );
  }

  return (
    <>
      {pageHead(
        editJobId ? 'Edit job post' : 'Create a job post',
        'Tell candidates what the role involves and what success looks like.',
        <Btn secondary disabled={saving} onClick={() => handleSave(false)}>
          {saving ? 'Saving…' : 'Save draft'}
        </Btn>
      )}

      {formError && (
        <div className="mb-4 rounded-lg border border-[#F3C6C6] bg-[#FEF2F2] p-3 text-xs text-[#991B1B]">
          {formError}
        </div>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave(true);
          }}
          className="space-y-5 xl:col-span-3"
        >
          <Card title="Basics">
            <div className="space-y-4">
              <label className="block text-sm font-medium">
                Job title
                <input
                  required
                  minLength={1}
                  maxLength={200}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Backend Engineer"
                  className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] px-3"
                />
                {fieldErrors.title && (
                  <small className="mt-1 block text-xs text-[#B42318]">{fieldErrors.title}</small>
                )}
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm font-medium">
                  Department
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 text-sm"
                  >
                    {DEPARTMENT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm font-medium">
                  Employment type
                  <select
                    value={employmentType}
                    onChange={(e) => setEmploymentType(e.target.value)}
                    className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 text-sm"
                  >
                    {EMPLOYMENT_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm font-medium">
                  Work mode
                  <select
                    value={workMode}
                    onChange={(e) => setWorkMode(e.target.value)}
                    className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 text-sm"
                  >
                    {WORK_MODE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm font-medium">
                  Location
                  <input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Bengaluru / Remote"
                    className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] px-3 text-sm"
                  />
                </label>
              </div>
            </div>
          </Card>

          <Card title="Description">
            <div className="space-y-3">
              <label className="block text-sm font-medium">
                About the role
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the role and its impact."
                  className="mt-2 w-full rounded-lg border border-[#E5E1D8] p-3 text-sm"
                />
                {fieldErrors.description && (
                  <small className="mt-1 block text-xs text-[#B42318]">
                    {fieldErrors.description}
                  </small>
                )}
              </label>

              <label className="block text-sm font-medium">
                What you&apos;ll do
                <textarea
                  rows={3}
                  value={responsibilities}
                  onChange={(e) => setResponsibilities(e.target.value)}
                  placeholder="List responsibilities."
                  className="mt-2 w-full rounded-lg border border-[#E5E1D8] p-3 text-sm"
                />
              </label>

              <label className="block text-sm font-medium">
                What we&apos;re looking for
                <textarea
                  rows={3}
                  value={requirements}
                  onChange={(e) => setRequirements(e.target.value)}
                  placeholder="Share essential skills and experience."
                  className="mt-2 w-full rounded-lg border border-[#E5E1D8] p-3 text-sm"
                />
              </label>

              <label className="block text-sm font-medium">
                What we offer
                <textarea
                  rows={3}
                  value={whatWeOffer}
                  onChange={(e) => setWhatWeOffer(e.target.value)}
                  placeholder="Compensation, benefits and flexibility."
                  className="mt-2 w-full rounded-lg border border-[#E5E1D8] p-3 text-sm"
                />
              </label>
            </div>
            <p className="mt-3 text-[11px] text-[#4A5568]">
              AI wording suggestions are not enabled yet (Step 7v).
            </p>
          </Card>

          <Card title="Requirements & compensation">
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium">
                  Must-have skills
                  <input
                    value={skillQuery}
                    onChange={(e) => setSkillQuery(e.target.value)}
                    placeholder="Search skills to add…"
                    className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs"
                  />
                </label>
                {skillResults.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1.5 rounded-lg border border-[#E5E1D8] bg-[#FAF8F4] p-2">
                    {skillResults
                      .filter((s) => !selectedSkills.some((x) => x.skill_id === s.id))
                      .map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setSelectedSkills((prev) => [
                              ...prev,
                              { skill_id: s.id, name: s.name, is_required: true },
                            ]);
                            setSkillQuery('');
                            setSkillResults([]);
                          }}
                          className="rounded-full border border-[#E5E1D8] bg-white px-2.5 py-1 text-xs hover:bg-[#F3EBDD]"
                        >
                          + {s.name}
                        </button>
                      ))}
                  </div>
                )}
                {selectedSkills.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selectedSkills.map((s) => (
                      <span
                        key={s.skill_id}
                        className="inline-flex items-center gap-1 rounded-full bg-[#F3EBDD] px-2.5 py-1 text-xs text-[#806236]"
                      >
                        {s.name}
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedSkills((prev) =>
                              prev.filter((x) => x.skill_id !== s.skill_id)
                            )
                          }
                          aria-label={`Remove ${s.name}`}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm">
                  Minimum annual salary (INR)
                  <input
                    type="number"
                    min="0"
                    value={salaryMin}
                    onChange={(e) => setSalaryMin(e.target.value)}
                    placeholder="e.g. 1200000"
                    className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs"
                  />
                </label>
                <label className="text-sm">
                  Maximum annual salary (INR)
                  <input
                    type="number"
                    min="0"
                    value={salaryMax}
                    onChange={(e) => setSalaryMax(e.target.value)}
                    placeholder="e.g. 1800000"
                    className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs"
                  />
                </label>
              </div>
              {fieldErrors.salary_max && (
                <small className="block text-xs text-[#B42318]">{fieldErrors.salary_max}</small>
              )}

              <label className="mt-2 flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={showSalaryPublicly}
                  onChange={(e) => setShowSalaryPublicly(e.target.checked)}
                  className="accent-ink"
                />
                Show salary publicly
              </label>
            </div>
          </Card>

          <Card title="Hiring process">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={blindReview}
                onChange={(e) => setBlindReview(e.target.checked)}
                className="accent-ink"
              />
              Enable blind review for first screening
            </label>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={fairHiring}
                onChange={(e) => setFairHiring(e.target.checked)}
                className="accent-ink"
              />
              I confirm this role follows fair hiring practices (required to publish)
            </label>
          </Card>

          <Card title="Publish settings">
            <label className="block text-sm">
              Visibility
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value)}
                className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] bg-white px-3"
              >
                {VISIBILITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </Card>

          <div className="flex justify-end gap-2">
            <Btn secondary disabled={saving} onClick={() => handleSave(false)}>
              Save draft
            </Btn>
            <Btn type="submit" disabled={saving}>
              {saving ? 'Saving…' : jobStatus === 'open' ? 'Save changes' : 'Save & publish'}
            </Btn>
          </div>
        </form>

        <div className="xl:sticky xl:top-24 xl:col-span-2">
          <Card title="Candidate preview" action={<Eye size={16} />}>
            <div className="rounded-xl border border-[#E5E1D8] p-5">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-lg bg-[#F3EBDD] font-bold">
                  {(org.name || 'S').slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <p className="text-sm font-semibold">{org.name}</p>
                  <p className="text-xs text-[#4A5568]">
                    {org.verification_status === 'verified' ? 'Verified startup' : 'Startup'}
                  </p>
                </div>
              </div>
              <h2 className="serif mt-5 text-2xl font-semibold">
                {title || 'Your job title'}
              </h2>
              <p className="mt-2 text-xs text-[#4A5568]">
                {labelFor(DEPARTMENT_OPTIONS, department)} ·{' '}
                {labelFor(EMPLOYMENT_TYPE_OPTIONS, employmentType)} · {location || 'Remote'}
              </p>
              <div className="mt-4 flex gap-2">
                <span className="rounded-full bg-[#F3F4F6] px-2 py-1 text-[10px]">
                  {labelFor(EMPLOYMENT_TYPE_OPTIONS, employmentType)}
                </span>
                <span className="rounded-full bg-[#F3F4F6] px-2 py-1 text-[10px]">
                  {labelFor(WORK_MODE_OPTIONS, workMode)}
                </span>
              </div>
              <p className="mt-5 text-sm font-semibold">About the role</p>
              <p className="mt-2 whitespace-pre-line text-xs leading-5 text-[#4A5568]">
                {description || 'Your job description preview will appear here as you write.'}
              </p>
              <p className="mt-5 text-sm font-semibold">What we’re looking for</p>
              <p className="mt-2 whitespace-pre-line text-xs leading-5 text-[#4A5568]">
                {requirements || 'Add clear and inclusive must-have criteria.'}
              </p>
              <button
                type="button"
                disabled
                className="mt-5 min-h-10 w-full rounded-lg bg-ink text-xs font-semibold text-white opacity-50"
              >
                Apply for this job
              </button>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

export function StartupJobDetailView({ org, myRole, jobId, pageHead, notify }) {
  const isAdmin = myRole === 'owner' || myRole === 'admin';
  const isReviewer = isAdmin || myRole === 'member';

  const [tab, setTab] = useState('Pipeline');
  const [state, setState] = useState('loading');
  const [err, setErr] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const [job, setJob] = useState(null);
  const [applicantsPage, setApplicantsPage] = useState({ items: [], stage_counts: {}, total: 0 });
  const [analytics, setAnalytics] = useState(null);
  const [busyAction, setBusyAction] = useState(false);

  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('skills_mismatch');
  const [rejectDetail, setRejectDetail] = useState('');

  const loadAll = useCallback(
    async (signal) => {
      const [jobRes, appsRes, analyticsRes] = await Promise.all([
        api.jobs.get(org.id, jobId, signal),
        isReviewer
          ? api.applicants.list(org.id, jobId, { limit: 100 }, signal)
          : Promise.resolve({ items: [], stage_counts: {}, total: 0 }),
        api.hiringInsights.analytics(org.id, signal),
      ]);
      if (signal?.aborted) return;
      setJob(jobRes);
      setApplicantsPage(appsRes);
      setAnalytics(analyticsRes);
    },
    [org.id, jobId, isReviewer]
  );

  useEffect(() => {
    const controller = new AbortController();
    setState('loading');
    setErr('');
    loadAll(controller.signal)
      .then(() => {
        if (!controller.signal.aborted) setState('ready');
      })
      .catch((e) => {
        if (controller.signal.aborted) return;
        setErr(errorMessage(e, 'Could not load job details.'));
        setState('error');
      });
    return () => controller.abort();
  }, [loadAll, reloadKey]);

  const handleLifecycle = async (actionName) => {
    if (!job) return;
    setBusyAction(true);
    try {
      const updated = await api.jobs[actionName](org.id, job.id);
      setJob(updated);
      notify(`Job ${updated.status}.`);
    } catch (e) {
      notify(errorMessage(e, 'Could not update job status.'));
    } finally {
      setBusyAction(false);
    }
  };

  const handleStageChange = async (app, nextStage) => {
    if (nextStage === app.stage) return;
    if (nextStage === 'rejected') {
      setRejectTarget(app);
      return;
    }
    try {
      const updated = await api.applicants.update(org.id, jobId, app.id, {
        stage: nextStage,
        expected_stage: app.stage,
      });
      setApplicantsPage((prev) => ({
        ...prev,
        items: prev.items.map((item) => (item.id === app.id ? updated : item)),
      }));
      notify(`Moved to ${STAGE_LABELS[nextStage] || nextStage}.`);
    } catch (e) {
      notify(errorMessage(e, 'Could not update stage.'));
    }
  };

  const handleConfirmReject = async (e) => {
    e.preventDefault();
    if (!rejectTarget) return;
    try {
      const updated = await api.applicants.update(org.id, jobId, rejectTarget.id, {
        stage: 'rejected',
        expected_stage: rejectTarget.stage,
        rejected_reason: rejectReason,
        rejection_detail: rejectReason === 'other' ? rejectDetail.trim() : undefined,
      });
      setApplicantsPage((prev) => ({
        ...prev,
        items: prev.items.map((item) => (item.id === rejectTarget.id ? updated : item)),
      }));
      setRejectTarget(null);
      setRejectDetail('');
      notify('Candidate rejected.');
    } catch (e2) {
      notify(errorMessage(e2, 'Could not reject candidate.'));
    }
  };

  const handleToggleBlind = async () => {
    if (!job || !isAdmin) return;
    try {
      const res = await api.applicants.settings(org.id, job.id, {
        blind_review_enabled: !job.blind_review_enabled,
      });
      setJob((prev) => (prev ? { ...prev, blind_review_enabled: res.blind_review_enabled } : prev));
      setReloadKey((k) => k + 1);
      notify(res.blind_review_enabled ? 'Blind review enabled.' : 'Blind review disabled.');
    } catch (e) {
      notify(errorMessage(e, 'Could not update blind review setting.'));
    }
  };

  if (state === 'loading') return <LoadingState label="Loading job pipeline…" />;
  if (state === 'error') {
    return <ErrorState message={err} onRetry={() => setReloadKey((k) => k + 1)} />;
  }
  if (!job) return null;

  const jobAnalytics = (analytics?.by_job || []).find((j) => j.job_id === job.id);

  return (
    <>
      {pageHead(
        job.title,
        `${labelFor(DEPARTMENT_OPTIONS, job.department)} · ${job.location || 'Remote'} · ${labelFor(
          EMPLOYMENT_TYPE_OPTIONS,
          job.employment_type
        )}`,
        <>
          <Btn
            secondary
            onClick={() => {
              if (typeof window !== 'undefined' && navigator.clipboard) {
                navigator.clipboard.writeText(window.location.href).catch(() => {});
              }
              notify('Job link copied.');
            }}
          >
            <Share2 size={15} /> Share
          </Btn>
          {isAdmin && (
            <>
              <Link
                href={`/startup/hiring/jobs/new?jobId=${job.id}`}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#E5E1D8] bg-white px-3 text-sm font-semibold"
              >
                <Edit3 size={15} /> Edit job
              </Link>
              {job.status === 'open' ? (
                <button
                  type="button"
                  disabled={busyAction}
                  onClick={() => handleLifecycle('pause')}
                  className="min-h-10 rounded-lg border border-[#E5E1D8] bg-white px-3 text-sm font-semibold"
                >
                  Pause
                </button>
              ) : (job.status === 'paused' || job.status === 'draft') ? (
                <button
                  type="button"
                  disabled={busyAction}
                  onClick={() => handleLifecycle('publish')}
                  className="min-h-10 rounded-lg bg-ink px-3 text-sm font-semibold text-white"
                >
                  {job.status === 'paused' ? 'Resume' : 'Publish'}
                </button>
              ) : null}
            </>
          )}
        </>
      )}

      <div className="mb-5 flex flex-wrap gap-2">
        {['Pipeline', 'Applicants', 'Job post', 'Insights'].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`min-h-10 rounded-lg px-4 text-sm ${
              tab === t ? 'bg-ink text-white' : 'border border-[#E5E1D8] bg-white text-[#4A5568]'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Pipeline' ? (
        !isReviewer ? (
          <ViewerRestrictedState message="Viewers cannot access the applicant pipeline." />
        ) : (
          <div className="grid gap-4 overflow-x-auto md:grid-cols-2 2xl:grid-cols-6">
            {PIPELINE_STAGES.map((st) => {
              const items = applicantsPage.items.filter((a) => a.stage === st);
              return (
                <section key={st} className="min-w-[210px] rounded-xl bg-[#F4F1EA] p-3">
                  <h2 className="mb-3 flex justify-between text-sm font-semibold">
                    {STAGE_LABELS[st] || st}
                    <span className="text-xs text-[#4A5568]">{items.length}</span>
                  </h2>
                  {items.map((a) => {
                    const displayName = a.is_blind ? a.label : a.profile?.full_name || a.label;
                    return (
                      <div
                        key={a.id}
                        className="mb-2 rounded-xl border border-[#E5E1D8] bg-white p-3"
                      >
                        <Link
                          href={`/startup/hiring/${job.id}/applicants/${a.id}`}
                          className="block text-xs font-semibold hover:underline"
                        >
                          {displayName}
                        </Link>
                        {a.profile?.headline && (
                          <p className="mt-1 text-[11px] text-[#4A5568]">{a.profile.headline}</p>
                        )}
                        <p className="mt-2 text-[10px] text-[#4A5568]">
                          {formatDate(a.created_at)} · {a.source}
                        </p>
                        {REVIEWER_MOVE_STAGES.includes(a.stage) && (
                          <select
                            value={a.stage}
                            onChange={(e) => handleStageChange(a, e.target.value)}
                            className="mt-2 w-full rounded-md border border-[#E5E1D8] bg-white px-2 py-1 text-[10px]"
                          >
                            {REVIEWER_MOVE_STAGES.map((opt) => (
                              <option key={opt} value={opt}>
                                {STAGE_LABELS[opt] || opt}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    );
                  })}
                  {items.length === 0 && (
                    <p className="rounded-lg border border-dashed border-[#D6D0C5] p-4 text-center text-xs text-[#4A5568]">
                      No candidates here yet.
                    </p>
                  )}
                </section>
              );
            })}
          </div>
        )
      ) : tab === 'Applicants' ? (
        !isReviewer ? (
          <ViewerRestrictedState message="Viewers cannot access applicant details." />
        ) : (
          <Card
            title="Applicants"
            action={
              isAdmin && (
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={Boolean(job.blind_review_enabled)}
                    onChange={handleToggleBlind}
                    className="accent-ink"
                  />
                  Blind review
                </label>
              )
            }
          >
            {applicantsPage.items.length === 0 ? (
              <EmptyState
                title="No applicants yet"
                description="Applications submitted to this job will appear here."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-left text-xs">
                  <thead className="border-b text-[#4A5568]">
                    <tr>
                      {['Candidate', 'Headline', 'Location', 'Experience', 'Stage', 'Applied'].map(
                        (h) => (
                          <th key={h} className="py-3">
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {applicantsPage.items.map((a) => {
                      const displayName = a.is_blind ? a.label : a.profile?.full_name || a.label;
                      return (
                        <tr key={a.id} className="border-b border-[#E5E1D8] hover:bg-[#F4F1EA]">
                          <td className="py-3 font-semibold">
                            <Link
                              href={`/startup/hiring/${job.id}/applicants/${a.id}`}
                              className="hover:underline"
                            >
                              {displayName}
                            </Link>
                          </td>
                          <td>{a.profile?.headline || '—'}</td>
                          <td>{a.profile?.location || '—'}</td>
                          <td>{a.experience_years || '—'}</td>
                          <td>{STAGE_LABELS[a.stage] || a.stage}</td>
                          <td>{formatDate(a.created_at)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )
      ) : tab === 'Job post' ? (
        <Card
          title="Public job post"
          action={
            isAdmin && (
              <Link
                href={`/startup/hiring/jobs/new?jobId=${job.id}`}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#9A7A45]"
              >
                Edit <Edit3 size={13} />
              </Link>
            )
          }
        >
          <h2 className="serif text-2xl">{job.title}</h2>
          <p className="mt-2 text-sm text-[#4A5568]">
            {org.name} · {job.location || labelFor(WORK_MODE_OPTIONS, job.work_mode)} ·{' '}
            {labelFor(EMPLOYMENT_TYPE_OPTIONS, job.employment_type)}
          </p>
          {job.description && (
            <>
              <p className="mt-5 text-sm font-semibold">About this role</p>
              <p className="mt-2 max-w-2xl whitespace-pre-line text-sm leading-6 text-[#4A5568]">
                {job.description}
              </p>
            </>
          )}
          {job.requirements && (
            <>
              <p className="mt-5 text-sm font-semibold">Requirements</p>
              <p className="mt-2 max-w-2xl whitespace-pre-line text-sm leading-6 text-[#4A5568]">
                {job.requirements}
              </p>
            </>
          )}
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <Card title="Total applicants">
            <b className="serif text-3xl">{jobAnalytics ? jobAnalytics.applicants : 0}</b>
            <p className="mt-2 text-xs text-[#4A5568]">Across all stages for this role</p>
          </Card>
          <Card title="Average time to hire">
            <b className="serif text-3xl">
              {jobAnalytics?.avg_time_to_hire_days != null
                ? `${jobAnalytics.avg_time_to_hire_days} days`
                : '—'}
            </b>
            <p className="mt-2 text-xs text-[#4A5568]">Calculated from completed hires</p>
          </Card>
          <Card title="Time to first interview">
            <b className="serif text-3xl">
              {jobAnalytics?.avg_time_to_first_interview_days != null
                ? `${jobAnalytics.avg_time_to_first_interview_days} days`
                : '—'}
            </b>
            <p className="mt-2 text-xs text-[#4A5568]">From application to first interview</p>
          </Card>
        </div>
      )}

      {rejectTarget && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[#0F1B2D]/45 p-4">
          <section
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
          >
            <h2 className="serif text-xl font-semibold">Reject candidate</h2>
            <form onSubmit={handleConfirmReject} className="mt-4 space-y-3">
              <label className="block text-sm">
                Reason
                <select
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 text-sm"
                >
                  {REJECTION_REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
              {rejectReason === 'other' && (
                <label className="block text-sm">
                  Detail
                  <textarea
                    required
                    rows={3}
                    value={rejectDetail}
                    onChange={(e) => setRejectDetail(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-[#E5E1D8] p-2 text-sm"
                  />
                </label>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectTarget(null)}
                  className="min-h-9 px-3 text-sm"
                >
                  Cancel
                </button>
                <Btn type="submit">Confirm rejection</Btn>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}

export function StartupApplicantDetailView({
  org,
  myRole,
  jobId,
  applicantId,
  pageHead,
  notify,
  onOpenScheduleModal,
}) {
  const isReviewer = myRole === 'owner' || myRole === 'admin' || myRole === 'member';
  const [candTab, setCandTab] = useState('Overview');
  const [state, setState] = useState('loading');
  const [err, setErr] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const [app, setApp] = useState(null);
  const [notes, setNotes] = useState([]);
  const [events, setEvents] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [noteBody, setNoteBody] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    if (!isReviewer) {
      setState('ready');
      return;
    }
    const controller = new AbortController();
    setState('loading');
    setErr('');
    Promise.all([
      api.applicants.get(org.id, jobId, applicantId, controller.signal),
      api.applicants.notes(org.id, jobId, applicantId, { limit: 50 }, controller.signal),
      api.applicants.history(org.id, jobId, applicantId, { limit: 50 }, controller.signal),
      api.interviews.list(org.id, { application_id: applicantId, limit: 50 }, controller.signal),
    ])
      .then(([appRes, notesRes, histRes, ivRes]) => {
        if (controller.signal.aborted) return;
        setApp(appRes);
        setNotes(notesRes.items || []);
        setEvents(histRes.items || []);
        setInterviews(ivRes.items || []);
        setState('ready');
      })
      .catch((e) => {
        if (controller.signal.aborted) return;
        setErr(errorMessage(e, 'Could not load applicant details.'));
        setState('error');
      });
    return () => controller.abort();
  }, [org.id, jobId, applicantId, isReviewer, reloadKey]);

  const handleStageUpdate = async (nextStage) => {
    if (!app || nextStage === app.stage) return;
    try {
      const updated = await api.applicants.update(org.id, jobId, app.id, {
        stage: nextStage,
        expected_stage: app.stage,
      });
      setApp(updated);
      notify(`Stage updated to ${STAGE_LABELS[nextStage] || nextStage}.`);
      setReloadKey((k) => k + 1);
    } catch (e) {
      notify(errorMessage(e, 'Could not update stage.'));
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!noteBody.trim()) return;
    setSavingNote(true);
    try {
      const created = await api.applicants.addNote(org.id, jobId, applicantId, {
        body: noteBody.trim(),
      });
      setNotes((prev) => [created, ...prev]);
      setNoteBody('');
      notify('Note added.');
    } catch (e2) {
      notify(errorMessage(e2, 'Could not add note.'));
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (noteId) => {
    try {
      await api.applicants.deleteNote(org.id, jobId, applicantId, noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      notify('Note deleted.');
    } catch (e) {
      notify(errorMessage(e, 'Could not delete note.'));
    }
  };

  const handleResumeDownload = async () => {
    try {
      const dl = await api.applicants.resume(org.id, jobId, applicantId, { disposition: 'inline' });
      if (dl?.url && typeof window !== 'undefined') {
        window.open(dl.url, '_blank', 'noopener,noreferrer');
      }
    } catch (e) {
      notify(errorMessage(e, 'Could not open resume.'));
    }
  };

  if (!isReviewer) {
    return (
      <>
        {pageHead('Applicant', 'Candidate review')}
        <ViewerRestrictedState message="Viewers cannot access applicant details." />
      </>
    );
  }
  if (state === 'loading') return <LoadingState label="Loading applicant…" />;
  if (state === 'error') {
    return <ErrorState message={err} onRetry={() => setReloadKey((k) => k + 1)} />;
  }
  if (!app) return null;

  const displayName = app.is_blind ? app.label : app.profile?.full_name || app.label;

  return (
    <>
      {pageHead(
        displayName,
        `${app.profile?.headline || 'Candidate'} · ${app.profile?.location || 'Location hidden'} · Applied ${formatDate(
          app.created_at
        )}`,
        <>
          <Btn secondary disabled title="Direct messaging arrives in Step 11">
            <Mail size={15} /> Message (Step 11)
          </Btn>
          <Btn
            secondary
            onClick={() => onOpenScheduleModal({ jobId, applicationId: app.id })}
          >
            <CalendarDays size={15} /> Schedule interview
          </Btn>
          {app.stage === 'applied' || app.stage === 'review' ? (
            <Btn onClick={() => handleStageUpdate('shortlisted')}>
              <Check size={15} /> Shortlist
            </Btn>
          ) : null}
        </>
      )}

      <div className="mb-5 flex gap-2 overflow-x-auto">
        {['Overview', 'Resume', 'Interviews & feedback', 'Notes', 'Activity'].map((x) => (
          <button
            key={x}
            type="button"
            onClick={() => setCandTab(x)}
            className={`min-h-10 shrink-0 rounded-lg px-3 text-xs ${
              candTab === x ? 'bg-ink text-white' : 'border border-[#E5E1D8] bg-white'
            }`}
          >
            {x}
          </button>
        ))}
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title={candTab}>
            {candTab === 'Overview' ? (
              <>
                <h3 className="text-sm font-semibold">Profile & background</h3>
                <p className="mt-2 text-sm text-[#4A5568]">
                  {app.experience_years
                    ? `${app.experience_years} of experience`
                    : 'Experience not specified.'}
                </p>
                {app.cover_note && (
                  <>
                    <h3 className="mt-5 text-sm font-semibold">Cover note</h3>
                    <p className="mt-2 whitespace-pre-line text-xs leading-5 text-[#4A5568]">
                      {app.cover_note}
                    </p>
                  </>
                )}
                {app.screening_answers?.length > 0 && (
                  <>
                    <h3 className="mt-5 text-sm font-semibold">Screening answers</h3>
                    <div className="mt-2 space-y-2">
                      {app.screening_answers.map((ans) => (
                        <div key={ans.key} className="rounded-lg bg-[#FAF8F4] p-3 text-xs">
                          <p className="font-semibold text-ink">{ans.prompt || ans.key}</p>
                          <p className="mt-1 text-[#4A5568]">{String(ans.answer ?? '—')}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                <p className="mt-5 text-xs text-[#4A5568]">
                  Contact information and resume shown according to candidate consent{' '}
                  <LockKeyhole className="ml-1 inline" size={12} />
                </p>
              </>
            ) : candTab === 'Resume' ? (
              app.resume_available ? (
                <div className="rounded-lg bg-[#FAF8F4] p-8 text-center">
                  <FileText className="mx-auto mb-3 text-[#9A7A45]" />
                  <p className="text-sm font-semibold">
                    {app.resume_file_name || 'Attached resume'}
                  </p>
                  <button
                    type="button"
                    onClick={handleResumeDownload}
                    className="mt-3 text-xs font-semibold text-[#9A7A45] hover:underline"
                  >
                    Open resume
                  </button>
                </div>
              ) : (
                <EmptyState
                  title="No resume attached"
                  description="This candidate applied with their platform profile."
                />
              )
            ) : candTab === 'Interviews & feedback' ? (
              interviews.length === 0 ? (
                <EmptyState
                  title="No interviews scheduled"
                  description="Use Schedule interview above to invite the candidate."
                />
              ) : (
                <div className="space-y-3">
                  {interviews.map((iv) => (
                    <div key={iv.id} className="rounded-lg border border-[#E5E1D8] p-4 text-xs">
                      <div className="flex items-center justify-between">
                        <b>{iv.round_name || 'Interview'}</b>
                        <span className="rounded-full bg-[#F3EBDD] px-2 py-0.5 text-[10px]">
                          {iv.status}
                        </span>
                      </div>
                      <p className="mt-1 text-[#4A5568]">
                        {formatDateTime(iv.scheduled_at)} · {iv.format} · {iv.duration_min} min
                      </p>
                    </div>
                  ))}
                </div>
              )
            ) : candTab === 'Notes' ? (
              <div className="space-y-4">
                <form onSubmit={handleAddNote} className="space-y-2">
                  <textarea
                    value={noteBody}
                    onChange={(e) => setNoteBody(e.target.value)}
                    placeholder="Add a private team note…"
                    rows={3}
                    className="w-full rounded-lg border border-[#E5E1D8] p-3 text-sm"
                  />
                  <Btn type="submit" disabled={savingNote || !noteBody.trim()}>
                    {savingNote ? 'Saving…' : 'Add note'}
                  </Btn>
                </form>
                {notes.length === 0 ? (
                  <p className="text-xs text-[#4A5568]">No notes yet.</p>
                ) : (
                  <div className="space-y-2">
                    {notes.map((n) => (
                      <div
                        key={n.id}
                        className="flex items-start justify-between gap-3 rounded-lg border border-[#E5E1D8] p-3 text-xs"
                      >
                        <div>
                          <p className="whitespace-pre-line text-ink">{n.body}</p>
                          <small className="mt-1 block text-[10px] text-[#4A5568]">
                            {n.author_name || 'Team member'} · {formatDateTime(n.created_at)}
                          </small>
                        </div>
                        {n.can_delete && (
                          <button
                            type="button"
                            onClick={() => handleDeleteNote(n.id)}
                            aria-label="Delete note"
                            className="text-[#4A5568] hover:text-[#B42318]"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : events.length === 0 ? (
              <p className="text-xs text-[#4A5568]">No stage activity recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {events.map((ev) => (
                  <div key={ev.id} className="rounded-lg border border-[#E5E1D8] p-3 text-xs">
                    <b>
                      {ev.from_stage ? `${STAGE_LABELS[ev.from_stage] || ev.from_stage} → ` : ''}
                      {STAGE_LABELS[ev.to_stage] || ev.to_stage}
                    </b>
                    <small className="mt-1 block text-[10px] text-[#4A5568]">
                      {formatDateTime(ev.created_at)}
                    </small>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <aside className="space-y-5">
          <Card title="Decision">
            <p className="text-xs text-[#4A5568]">Current stage</p>
            {REVIEWER_MOVE_STAGES.includes(app.stage) ? (
              <select
                value={app.stage}
                onChange={(e) => handleStageUpdate(e.target.value)}
                className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs"
              >
                {REVIEWER_MOVE_STAGES.filter((s) => s !== 'rejected').map((s) => (
                  <option key={s} value={s}>
                    {STAGE_LABELS[s] || s}
                  </option>
                ))}
              </select>
            ) : (
              <p className="mt-2 text-sm font-semibold">{STAGE_LABELS[app.stage] || app.stage}</p>
            )}
          </Card>

          <Card title="Candidate details">
            <p className="text-xs">
              <b>Source:</b> {app.source}
            </p>
            <p className="mt-2 text-xs">
              <b>Experience:</b> {app.experience_years || '—'}
            </p>
            <p className="mt-2 text-xs">
              <b>Location:</b> {app.profile?.location || '—'}
            </p>
            {app.salary_expectation != null && (
              <p className="mt-2 text-xs">
                <b>Expected compensation:</b> {formatMoney(app.salary_expectation, app.currency)}
              </p>
            )}
            {!app.is_blind && app.profile?.email && (
              <p className="mt-2 text-xs">
                <b>Email:</b> {app.profile.email}
              </p>
            )}
          </Card>
        </aside>
      </div>
    </>
  );
}
