"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Check,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  Plus,
  UserCheck,
  UserX,
  X,
} from "lucide-react";
import { EmployerBtn, EmployerCard, StageChip } from "@/components";
import { ErrorBlock } from "@/components/async-state";
import {
  api,
  ApiError,
  browserStorageUrl,
  fileFieldErrors,
} from "@/lib/api/client";
import {
  useCareerResource,
  useCareerSearch,
  dateLabel,
  stageLabels,
} from "@/components/career-data";
import {
  JobsPage,
  JobNotice,
  jobLabel,
  useJobsWorkspace,
} from "@/components/employer-jobs-workspace";

const input =
  "rounded-xl border border-[#E5E1D8] bg-white px-3 py-2 text-xs text-[#0F1B2D] max-w-full";
const reviewStages = ["applied", "review", "shortlisted", "interview"];
const reasons = [
  "skills_mismatch",
  "experience",
  "role_filled",
  "compensation",
  "timing",
  "other",
];
const terminal = ["withdrawn", "rejected", "hired"];
const label = (value) => stageLabels[value] || jobLabel(value);
const errorText = (error) =>
  error instanceof ApiError && error.status === 404
    ? "This application or job is unavailable, or you do not have access."
    : error instanceof ApiError && error.status === 403
      ? "You do not have permission to review these applicants."
      : error instanceof Error
        ? error.message
        : "Could not connect. Please try again.";
const money = (row) =>
  row.salary_expectation == null
    ? "Not provided"
    : `${row.currency} ${String(row.salary_expectation).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
const isReadOnly = (context) => context.archived || context.status === "closed";

function State({ resource, text = "Loading applicants…" }) {
  if (resource.loading) return <JobNotice>{text}</JobNotice>;
  if (resource.error)
    return (
      <JobNotice error retry={resource.reload}>
        {errorText(resource.error)}
      </JobNotice>
    );
  return null;
}
function FieldError({ fields, name }) {
  return fields[name] ? (
    <p role="alert" className="mt-1 text-xs text-red-800">
      {fields[name]}
    </p>
  ) : null;
}
function Pager({ data, offset, setOffset }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-4 text-xs">
      <span>
        {data.total
          ? `${offset + 1}–${Math.min(offset + data.limit, data.total)} of ${data.total}`
          : "0 results"}
      </span>
      <div className="flex gap-2">
        <EmployerBtn
          secondary
          small
          disabled={offset === 0}
          onClick={() => setOffset(Math.max(0, offset - data.limit))}
        >
          Previous
        </EmployerBtn>
        <EmployerBtn
          secondary
          small
          disabled={!data.has_more}
          onClick={() => setOffset(offset + data.limit)}
        >
          Next
        </EmployerBtn>
      </div>
    </div>
  );
}
function useMemberDirectory() {
  const { org } = useJobsWorkspace();
  const [offset, setOffset] = useState(0);
  const resource = useCareerResource(
    `hiring-members:${org.id}:${offset}`,
    (signal) =>
      api.organizations.members(
        org.id,
        { limit: 100, offset, status: "active" },
        signal,
      ),
  );
  return { ...resource, offset, setOffset };
}
function MemberOptions({ directory, excludeViewers = false }) {
  return (
    <>
      {directory.data?.items
        .filter((member) => !excludeViewers || member.role !== "viewer")
        .map((member) => (
          <option key={member.user_id} value={member.user_id}>
            {member.display_name} ({member.role})
          </option>
        ))}
    </>
  );
}
function MemberPaging({ directory }) {
  if (directory.loading)
    return <p className="text-xs">Loading team members…</p>;
  if (directory.error)
    return (
      <JobNotice error retry={directory.reload}>
        {errorText(directory.error)}
      </JobNotice>
    );
  const page = directory.data;
  return page &&
    (directory.offset > 0 || directory.offset + page.limit < page.total) ? (
    <div className="flex gap-2 text-xs">
      <button
        type="button"
        disabled={!directory.offset}
        onClick={() =>
          directory.setOffset(Math.max(0, directory.offset - page.limit))
        }
      >
        Previous team members
      </button>
      <button
        type="button"
        disabled={directory.offset + page.limit >= page.total}
        onClick={() => directory.setOffset(directory.offset + page.limit)}
      >
        More team members
      </button>
    </div>
  ) : null;
}

/** Mounted only on the two approved employer applicant surfaces. */
export function ApplicantPipeline({ jobId }) {
  const { org } = useJobsWorkspace();
  if (org.my_role === "viewer")
    return (
      <JobNotice>
        Viewers can read jobs, but cannot access applicant records or candidate
        counts.
      </JobNotice>
    );
  return <PipelineContent key={jobId} jobId={jobId} />;
}
function PipelineContent({ jobId }) {
  const { org, href, canWrite } = useJobsWorkspace();
  const [q, setQ] = useState("");
  const query = useCareerSearch(q);
  const [stage, setStage] = useState("");
  const [source, setSource] = useState("");
  const [assignee, setAssignee] = useState("");
  const [sort, setSort] = useState("newest");
  const [offset, setOffset] = useState(0);
  const [action, setAction] = useState({ busy: false, error: "", fields: {} });
  const directory = useMemberDirectory();
  const resource = useCareerResource(
    `pipeline:${org.id}:${jobId}:${query}:${stage}:${source}:${assignee}:${sort}:${offset}`,
    (signal) =>
      api.applicants.list(
        org.id,
        jobId,
        {
          q: query || undefined,
          stage: stage || undefined,
          source: source || undefined,
          assignee_id: assignee || undefined,
          sort,
          limit: 20,
          offset,
        },
        signal,
      ),
  );
  function filter(setter, value) {
    setter(value);
    setOffset(0);
  }
  async function setting(enabled) {
    setAction({ busy: true, error: "", fields: {} });
    try {
      await api.applicants.settings(org.id, jobId, {
        blind_review_enabled: enabled,
      });
      resource.reload();
      setAction({ busy: false, error: "", fields: {} });
    } catch (error) {
      setAction({
        busy: false,
        error: errorText(error),
        fields: fileFieldErrors(error),
      });
      resource.reload();
    }
  }
  const data = resource.data;
  return (
    <section className="space-y-4" aria-label="Applicant pipeline">
      {data && (
        <>
          <div className="flex flex-wrap justify-between items-center gap-3">
            <h2 className="font-serif text-lg font-bold">
              {data.context.title} — Applicant pipeline
            </h2>
            <Link href={`/employer/jobs/${jobId}/compare`}>
              <EmployerBtn secondary small>
                Compare Candidates
              </EmployerBtn>
            </Link>
          </div>
          <p className="text-xs text-[#6B7280]">
            Only applicants within your hiring permissions are shown. Identity
            search excludes all blind applications.
          </p>
          {isReadOnly(data.context) && (
            <JobNotice>
              This job is {data.context.archived ? "archived" : "closed"}. Its
              pipeline is read-only.
            </JobNotice>
          )}
          <div className="rounded-xl border border-[#E5E1D8] bg-white p-4 text-xs space-y-2">
            <label className="flex gap-2 items-center">
              <input
                aria-label="Enable blind review"
                type="checkbox"
                checked={data.context.blind_review_enabled}
                disabled={
                  !canWrite ||
                  isReadOnly(data.context) ||
                  data.context.review_settings_locked ||
                  action.busy
                }
                onChange={(e) => setting(e.target.checked)}
              />
              Blind review during screening
            </label>
            <p>
              {data.context.review_settings_locked
                ? "This setting is locked because the job has received an application."
                : "Owner/admin only. This setting locks after the first application."}
            </p>
            <FieldError fields={action.fields} name="blind_review_enabled" />
          </div>
        </>
      )}
      {action.error && <JobNotice error>{action.error}</JobNotice>}
      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-xs">
          Search applicants
          <input
            aria-label="Search applicants"
            maxLength={100}
            value={q}
            onChange={(e) => filter(setQ, e.target.value)}
            className={`${input} block mt-1`}
          />
        </label>
        <label className="text-xs">
          Stage
          <select
            aria-label="Filter by stage"
            value={stage}
            onChange={(e) => filter(setStage, e.target.value)}
            className={`${input} block mt-1`}
          >
            <option value="">All stages</option>
            {Object.keys(stageLabels).map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          Source
          <select
            aria-label="Filter by source"
            value={source}
            onChange={(e) => filter(setSource, e.target.value)}
            className={`${input} block mt-1`}
          >
            <option value="">All sources</option>
            {[
              "platform",
              "referral",
              "marketplace",
              "outreach",
              "agency",
              "other",
            ].map((s) => (
              <option key={s} value={s}>
                {jobLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          Assignee
          <select
            aria-label="Filter by assignee"
            value={assignee}
            onChange={(e) => filter(setAssignee, e.target.value)}
            className={`${input} block mt-1`}
          >
            <option value="">All permitted assignees</option>
            <MemberOptions directory={directory} />
          </select>
        </label>
        <label className="text-xs">
          Sort
          <select
            aria-label="Sort applicants"
            value={sort}
            onChange={(e) => filter(setSort, e.target.value)}
            className={`${input} block mt-1`}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="stage_changed">Recently moved</option>
          </select>
        </label>
      </div>
      <MemberPaging directory={directory} />
      <State resource={resource} />
      {data && (
        <>
          <div
            className="flex flex-wrap gap-2 text-xs"
            aria-label="Applicant stage counts"
          >
            {Object.keys(stageLabels).map((s) => (
              <span
                key={s}
                className="rounded-xl border border-[#E5E1D8] px-3 py-2 bg-white"
              >
                {label(s)}: {data.stage_counts[s] || 0}
              </span>
            ))}
          </div>
          {!data.items.length ? (
            <JobNotice>
              No applicants match these filters within your permissions.
            </JobNotice>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-[#E5E1D8] bg-white">
              <table className="w-full text-left text-xs min-w-[680px]">
                <thead className="bg-[#FAF8F4]">
                  <tr>
                    {[
                      "Applicant",
                      "Stage",
                      "Applied",
                      "Source",
                      "Experience",
                      "Expected pay",
                      "Action",
                    ].map((title) => (
                      <th className="p-4" key={title}>
                        {title}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((row) => (
                    <tr key={row.id} className="border-t border-[#E5E1D8]">
                      <td className="p-4">
                        <Link
                          className="font-semibold underline"
                          href={href(
                            `/employer/jobs/${jobId}/applicants/${row.id}`,
                          )}
                        >
                          {row.label}
                        </Link>
                        {row.is_blind && <p>Blind review</p>}
                      </td>
                      <td className="p-4">
                        <StageChip stage={label(row.stage)} />
                      </td>
                      <td className="p-4">{dateLabel(row.created_at)}</td>
                      <td className="p-4">{jobLabel(row.source)}</td>
                      <td className="p-4">
                        {row.experience_years == null
                          ? "Not provided"
                          : `${row.experience_years} years`}
                      </td>
                      <td className="p-4">{money(row)}</td>
                      <td className="p-4">
                        <Link
                          href={href(
                            `/employer/jobs/${jobId}/applicants/${row.id}`,
                          )}
                        >
                          Review applicant
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pager data={data} offset={offset} setOffset={setOffset} />
        </>
      )}
    </section>
  );
}

export function ApplicantDetailPage({ jobId, applicationId }) {
  return (
    <JobsPage>
      <ApplicantGate
        key={`${jobId}:${applicationId}`}
        jobId={jobId}
        applicationId={applicationId}
      />
    </JobsPage>
  );
}
/** Step 7f: this application's interviews, from the org interview list. */
function ApplicantInterviews({ jobId, applicationId, onSchedule }) {
  const { org } = useJobsWorkspace();
  const resource = useCareerResource(
    `applicant-interviews:${org.id}:${jobId}:${applicationId}`,
    (signal) => api.interviews.list(org.id, { job_id: jobId, limit: 50 }, signal),
  );
  const items = (resource.data?.items || []).filter(
    (item) => item.application_id === applicationId,
  );
  if (resource.loading && !resource.data)
    return <p className="text-sm text-[#6B7280]">Loading interviews…</p>;
  if (resource.error)
    return (
      <ErrorBlock
        message={
          resource.error instanceof ApiError
            ? resource.error.message
            : "Could not load interviews."
        }
        onRetry={resource.reload}
        title="Could not load interviews"
      />
    );
  if (items.length === 0)
    return (
      <div className="space-y-3">
        <p className="text-sm text-[#4A5568]">
          No interviews scheduled for this applicant yet.
        </p>
        <div className="flex flex-wrap gap-3 items-center">
          {onSchedule && (
            <EmployerBtn small primary onClick={onSchedule}>
              <Plus size={14} className="mr-1" />
              Schedule interview
            </EmployerBtn>
          )}
          <Link
            href={`/employer/interviews?jobId=${jobId}&applicationId=${applicationId}`}
            className="text-xs font-semibold text-[#806236] hover:underline"
          >
            Open Interview Management →
          </Link>
        </div>
      </div>
    );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-2 border-b border-[#E5E1D8] pb-3">
        <span className="text-xs text-[#6B7280]">
          {items.length} {items.length === 1 ? "round scheduled" : "rounds scheduled"}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {onSchedule && (
            <EmployerBtn small secondary onClick={onSchedule}>
              <Plus size={14} className="mr-1" />
              Schedule another round
            </EmployerBtn>
          )}
          <Link
            href={`/employer/interviews?jobId=${jobId}&applicationId=${applicationId}`}
            className="text-xs font-semibold text-[#806236] hover:underline"
          >
            Manage in calendar →
          </Link>
        </div>
      </div>
      <ul className="space-y-3">
        {items.map((item) => {
          const when = new Date(item.scheduled_at);
          const panelists = item.participants
            .filter((p) => p.side === "interviewer")
            .map((p) => p.display_name);
          return (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] p-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#0F1B2D]">
                  {item.round_name || "Interview"} ·{" "}
                  {when.toLocaleString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                <p className="text-xs text-[#6B7280] mt-0.5">
                  {panelists.length > 0 ? panelists.join(", ") : "No panelists"} ·{" "}
                  {item.duration_min} min · {item.format}
                  {item.meeting_url && (
                    <>
                      {" "}·{" "}
                      <a
                        href={item.meeting_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#806236] underline hover:text-[#0F1B2D]"
                      >
                        Join link
                      </a>
                    </>
                  )}
                </p>
              </div>
              <StageChip stage={item.status.charAt(0).toUpperCase() + item.status.slice(1)} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ScheduleInterviewModal({
  open,
  onClose,
  orgId,
  jobId,
  applicationId,
  candidateLabel,
  onSuccess,
}) {
  const directory = useMemberDirectory();
  const members = (directory.data?.items || []).filter((m) => m.role !== "viewer");

  const tomorrow = () => {
    const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const [round, setRound] = useState("Technical Panel");
  const [format, setFormat] = useState("video");
  const [date, setDate] = useState(tomorrow);
  const [time, setTime] = useState("14:30");
  const [duration, setDuration] = useState(45);
  const [meetingUrl, setMeetingUrl] = useState("");
  const [location, setLocation] = useState("");
  const [panelists, setPanelists] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  if (!open) return null;

  const togglePanelist = (id) => {
    setPanelists((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setFieldErrors({});

    if (panelists.length === 0) {
      setFieldErrors({ interviewer_ids: "Select at least one panelist." });
      return;
    }

    setBusy(true);
    try {
      const scheduledAt = new Date(`${date}T${time}`);
      const body = {
        round_name: round,
        format,
        scheduled_at: scheduledAt.toISOString(),
        duration_min: Number(duration) || 45,
        interviewer_ids: panelists,
      };
      if (meetingUrl.trim()) body.meeting_url = meetingUrl.trim();
      if (location.trim()) body.location = location.trim();

      await api.interviews.schedule(orgId, jobId, applicationId, body);
      onSuccess();
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setFieldErrors(fileFieldErrors(err));
      }
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not schedule interview. Please check the details and try again."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-heading"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 border border-[#E5E1D8] shadow-xl my-8">
        <div className="flex justify-between items-center border-b border-[#E5E1D8] pb-3">
          <div>
            <h2 id="schedule-heading" className="font-serif font-bold text-lg text-[#0F1B2D]">
              Schedule Interview
            </h2>
            <p className="text-xs text-[#6B7280]">
              Candidate: <span className="font-semibold text-[#0F1B2D]">{candidateLabel}</span>
            </p>
          </div>
          <button
            type="button"
            aria-label="Close scheduling dialog"
            onClick={onClose}
            disabled={busy}
            className="text-[#6B7280] hover:text-[#0F1B2D]"
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="modal-round" className="block text-xs font-medium text-[#0F1B2D] mb-1">
                Interview Round
              </label>
              <select
                id="modal-round"
                value={round}
                onChange={(e) => setRound(e.target.value)}
                className="w-full rounded-lg border border-[#E5E1D8] bg-white px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
              >
                <option value="Initial Recruiter Screen">Recruiter Screen</option>
                <option value="Technical Panel">Technical Panel</option>
                <option value="Portfolio Walkthrough">Portfolio Walkthrough</option>
                <option value="System Design">System Design</option>
                <option value="Executive / Founder Fit">Executive / Founder Fit</option>
              </select>
              {fieldErrors.round_name && (
                <p className="mt-1 text-xs text-rose-700">{fieldErrors.round_name}</p>
              )}
            </div>

            <div>
              <label htmlFor="modal-format" className="block text-xs font-medium text-[#0F1B2D] mb-1">
                Interview Format
              </label>
              <select
                id="modal-format"
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                className="w-full rounded-lg border border-[#E5E1D8] bg-white px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
              >
                <option value="video">Video call</option>
                <option value="phone">Phone / audio only</option>
                <option value="onsite">On-site</option>
                <option value="async">Async (take-home)</option>
              </select>
              {fieldErrors.format && (
                <p className="mt-1 text-xs text-rose-700">{fieldErrors.format}</p>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="modal-date" className="block text-xs font-medium text-[#0F1B2D] mb-1">
                Date
              </label>
              <input
                id="modal-date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
              />
              {fieldErrors.scheduled_at && (
                <p className="mt-1 text-xs text-rose-700">{fieldErrors.scheduled_at}</p>
              )}
            </div>

            <div>
              <label htmlFor="modal-time" className="block text-xs font-medium text-[#0F1B2D] mb-1">
                Time
              </label>
              <input
                id="modal-time"
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="modal-duration" className="block text-xs font-medium text-[#0F1B2D] mb-1">
                Duration
              </label>
              <select
                id="modal-duration"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full rounded-lg border border-[#E5E1D8] bg-white px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
              >
                <option value="30">30 min</option>
                <option value="45">45 min</option>
                <option value="60">60 min</option>
                <option value="90">90 min</option>
              </select>
            </div>
          </div>

          {format === "video" && (
            <div>
              <label htmlFor="modal-url" className="block text-xs font-medium text-[#0F1B2D] mb-1">
                Meeting Link (optional)
              </label>
              <input
                id="modal-url"
                type="url"
                placeholder="https://meet.google.com/... or Zoom link"
                value={meetingUrl}
                onChange={(e) => setMeetingUrl(e.target.value)}
                className="w-full rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
              />
              {fieldErrors.meeting_url && (
                <p className="mt-1 text-xs text-rose-700">{fieldErrors.meeting_url}</p>
              )}
            </div>
          )}

          {format === "onsite" && (
            <div>
              <label htmlFor="modal-location" className="block text-xs font-medium text-[#0F1B2D] mb-1">
                Location / Room (optional)
              </label>
              <input
                id="modal-location"
                type="text"
                placeholder="Office Address, Room 2B"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
              />
              {fieldErrors.location && (
                <p className="mt-1 text-xs text-rose-700">{fieldErrors.location}</p>
              )}
            </div>
          )}

          <div>
            <span className="block text-xs font-medium text-[#0F1B2D] mb-1">
              Interview Panelists (required)
            </span>
            <div className="max-h-36 overflow-y-auto rounded-lg border border-[#E5E1D8] p-2 space-y-1.5 bg-[#FAF8F4]">
              {members.length === 0 ? (
                <p className="text-xs text-[#6B7280]">Loading team members…</p>
              ) : (
                members.map((m) => (
                  <label key={m.user_id} className="flex items-center gap-2 text-xs text-[#0F1B2D] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={panelists.includes(m.user_id)}
                      onChange={() => togglePanelist(m.user_id)}
                      className="rounded border-[#E5E1D8] text-[#806236]"
                    />
                    <span>
                      {m.display_name} <span className="text-[#6B7280]">({m.role})</span>
                    </span>
                  </label>
                ))
              )}
            </div>
            {fieldErrors.interviewer_ids && (
              <p className="mt-1 text-xs text-rose-700">{fieldErrors.interviewer_ids}</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E5E1D8]">
            <EmployerBtn secondary small type="button" onClick={onClose} disabled={busy}>
              Cancel
            </EmployerBtn>
            <EmployerBtn primary small type="submit" disabled={busy}>
              {busy ? "Scheduling…" : "Confirm & Schedule"}
            </EmployerBtn>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Step 7e: the applicant-page scoring panel. Loads the organization's
 * scorecards (preferring one attached to this job), shows my current
 * scores with team averages, and saves through the replace-set PUT.
 */
function EvaluationScorePanel({ jobId, applicationId, locked }) {
  const { org } = useJobsWorkspace();
  const cardsRes = useCareerResource(`scorecards:${org.id}`, (signal) =>
    api.scorecards.list(org.id, { limit: 20 }, signal),
  );
  const scoresRes = useCareerResource(
    `scores:${org.id}:${jobId}:${applicationId}`,
    (signal) => api.scorecards.scores(org.id, jobId, applicationId, signal),
  );
  const [edits, setEdits] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!scoresRes.data) return;
    const next = {};
    for (const item of scoresRes.data.items) {
      next[item.criterion_id] = item.my_score == null ? "" : String(item.my_score);
    }
    setEdits(next);
  }, [scoresRes.data]);

  const cards = cardsRes.data?.items || [];
  const card =
    cards.find((c) => c.job_id === jobId) || cards.find((c) => !c.job_id) || cards[0];

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    setFields({});
    setSaved(false);
    try {
      const scores = Object.entries(edits)
        .filter(([, value]) => value !== "")
        .map(([criterionId, value]) => ({
          criterion_id: criterionId,
          score: Number(value),
        }));
      await api.scorecards.putScores(org.id, jobId, applicationId, { scores });
      setSaved(true);
      scoresRes.reload();
    } catch (err) {
      if (err instanceof ApiError && err.status === 422 && Array.isArray(err.details)) {
        const next = {};
        for (const d of err.details) {
          const loc = Array.isArray(d.loc) ? d.loc : [];
          const key = loc[loc.length - 1];
          if (typeof key === "string" && !next[key]) next[key] = d.msg || "Invalid value.";
        }
        setFields(next);
      }
      setError(
        err instanceof ApiError ? err.message : "Could not save scores. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (cardsRes.loading || (scoresRes.loading && !scoresRes.data))
    return <p className="text-xs text-[#6B7280] mt-2">Loading scorecard…</p>;
  if (cardsRes.error || scoresRes.error)
    return (
      <div className="mt-2">
        <ErrorBlock
          message={
            (cardsRes.error instanceof ApiError
              ? cardsRes.error.message
              : cardsRes.error
                ? "Could not load scorecards."
                : null) ||
            (scoresRes.error instanceof ApiError
              ? scoresRes.error.message
              : "Could not load scores.")
          }
          onRetry={() => {
            if (cardsRes.error) cardsRes.reload();
            if (scoresRes.error) scoresRes.reload();
          }}
          title="Scorecard unavailable"
        />
      </div>
    );
  if (!card)
    return (
      <p className="text-xs mt-2 text-[#6B7280]">
        No scorecard template yet. Create an organization scorecard to start
        scoring this applicant.
      </p>
    );
  if (card.criteria.length === 0)
    return (
      <p className="text-xs mt-2 text-[#6B7280]">
        The “{card.name}” scorecard has no criteria yet.
      </p>
    );

  const totals = scoresRes.data;
  return (
    <div className="mt-2 space-y-3">
      <p className="text-xs text-[#6B7280]">
        {card.name}
        {totals?.my_weighted_total != null && (
          <span className="font-semibold text-[#0F1B2D]">
            {" "}
            · my total {totals.my_weighted_total.toFixed(1)}/5
          </span>
        )}
        {totals?.weighted_total != null && (
          <span className="text-[#6B7280]"> · team {totals.weighted_total.toFixed(1)}/5</span>
        )}
      </p>
      {error && (
        <p className="text-xs text-[#B42318]" role="alert">
          {error}
        </p>
      )}
      {fields.scores && (
        <p className="text-xs text-[#B42318]" role="alert">
          {fields.scores}
        </p>
      )}
      {card.criteria.map((criterion) => {
        const item = totals?.items.find((i) => i.criterion_id === criterion.id);
        return (
          <label key={criterion.id} className="flex items-center justify-between gap-2 text-xs">
            <span className="min-w-0 truncate text-[#4A5568]">
              {criterion.name}{" "}
              <span className="text-[#A0A7B4]">({criterion.weight}%)</span>
              {item?.average != null && (
                <span className="text-[#A0A7B4]"> · avg {item.average.toFixed(1)}</span>
              )}
            </span>
            <select
              aria-label={`Score for ${criterion.name}`}
              className={`${input} w-20 shrink-0`}
              value={edits[criterion.id] ?? ""}
              disabled={locked || busy}
              onChange={(e) => {
                setSaved(false);
                setEdits((prev) => ({ ...prev, [criterion.id]: e.target.value }));
              }}
            >
              <option value="">—</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        );
      })}
      <div className="flex items-center justify-between gap-2 pt-1">
        <button
          type="button"
          className="text-xs font-semibold text-[#806236] hover:underline disabled:opacity-50"
          disabled={locked || busy}
          onClick={save}
        >
          {busy ? "Saving…" : "Save scores"}
        </button>
        {saved && (
          <span className="text-xs text-[#286749]" role="status">
            Saved
          </span>
        )}
      </div>
      {locked && (
        <p className="text-xs text-[#6B7280]">
          This application is read-only, so scores cannot be changed.
        </p>
      )}
    </div>
  );
}

function ApplicantGate(props) {
  const { org } = useJobsWorkspace();
  return org.my_role === "viewer" ? (
    <JobNotice>Viewers cannot access candidate personal data.</JobNotice>
  ) : (
    <ApplicantDetail {...props} />
  );
}
function ApplicantDetail({ jobId, applicationId }) {
  const { org, user, href, canWrite } = useJobsWorkspace();
  const [tab, setTab] = useState("Overview");
  const [rejection, setRejection] = useState(false);
  const [reason, setReason] = useState("skills_mismatch");
  const [detail, setDetail] = useState("");
  const [action, setAction] = useState({
    busy: false,
    error: "",
    fields: {},
    message: "",
  });
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [interviewKey, setInterviewKey] = useState(0);
  const resource = useCareerResource(
    `applicant:${org.id}:${jobId}:${applicationId}`,
    (signal) => api.applicants.get(org.id, jobId, applicationId, signal),
  );
  const row = resource.data;
  const isShortlisted = row?.stage === "shortlisted";
  const locked =
    !row || isReadOnly(row.context) || terminal.includes(row.stage);
  const canMove = !locked && (canWrite || row.context.owner_id === user.id);
  async function mutate(body) {
    if (action.busy) return;
    setAction({ busy: true, error: "", fields: {}, message: "" });
    try {
      await api.applicants.update(org.id, jobId, applicationId, body);
      setRejection(false);
      setAction({
        busy: false,
        error: "",
        fields: {},
        message: "Application updated.",
      });
      resource.reload();
    } catch (error) {
      setAction({
        busy: false,
        error: errorText(error),
        fields: fileFieldErrors(error),
        message: "",
      });
      if (error instanceof ApiError && [403, 404, 409].includes(error.status))
        resource.reload();
    }
  }
  function move(stage) {
    if (stage === "rejected") {
      setRejection(true);
      return;
    }
    if (
      row?.is_blind &&
      stage === "interview" &&
      !window.confirm(
        "Moving to interview permanently reveals this applicant’s identity. Continue?",
      )
    )
      return;
    mutate({ stage, expected_stage: row.stage });
  }
  if (resource.loading || resource.error)
    return <State resource={resource} text="Loading applicant…" />;
  return (
    <>
      <nav className="flex flex-wrap gap-2 text-xs break-all">
        <Link
          className="text-[#806236] underline inline-flex gap-1"
          href={href(`/employer/jobs/${jobId}?tab=pipeline`)}
        >
          <ArrowLeft size={14} />
          Back to {row.context.title}
        </Link>
        <span>/</span>
        <span>{row.label}</span>
      </nav>
      <header className="rounded-2xl border border-[#E5E1D8] bg-white p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap justify-between items-start gap-4">
          <div className="flex gap-4 min-w-0 max-w-full">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#F3EBDD] font-serif text-xl text-[#806236]">
              {row.is_blind ? "?" : row.label.slice(0, 1)}
            </div>
            <div className="min-w-0 break-words">
              <h1 className="font-serif text-2xl font-bold">{row.label}</h1>
              <StageChip stage={label(row.stage)} />
              <p className="text-xs mt-2">
                {row.is_blind
                  ? "Identity hidden during screening"
                  : row.profile?.headline || "Headline not provided"}{" "}
                · Applied {dateLabel(row.created_at)}
              </p>
              <p className="text-xs">Targeting: {row.context.title}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <EmployerBtn
              primary={!isShortlisted}
              secondary={isShortlisted}
              small
              disabled={
                !canMove || action.busy || row.stage === "offered" || isShortlisted
              }
              aria-pressed={isShortlisted}
              onClick={() => move("shortlisted")}
            >
              {isShortlisted ? <Check size={14} /> : <UserCheck size={14} />}
              {isShortlisted ? "Shortlisted" : "Shortlist"}
            </EmployerBtn>
            <EmployerBtn
              secondary
              small
              disabled={!canMove || action.busy}
              onClick={() => setShowScheduleModal(true)}
            >
              <Calendar size={14} />
              Schedule interview
            </EmployerBtn>
            <EmployerBtn
              secondary
              small
              disabled
              title="Messaging is not connected"
            >
              Message
            </EmployerBtn>
            <EmployerBtn
              destructive
              small
              disabled={!canMove || action.busy}
              onClick={() => setRejection(true)}
            >
              <UserX size={14} />
              Decline
            </EmployerBtn>
          </div>
        </div>
        <div className="border-t border-[#E5E1D8] pt-4 flex gap-2 overflow-x-auto">
          {[
            "Overview",
            "Resume",
            "Interview practice",
            "Interviews and feedback",
            "Notes",
            "Messages",
            "Activity",
          ].map((value) => (
            <button
              type="button"
              aria-pressed={value === tab}
              onClick={() => setTab(value)}
              key={value}
              className={`whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs ${tab === value ? "bg-[#0F1B2D] text-white" : "border border-[#E5E1D8]"}`}
            >
              {value}
            </button>
          ))}
        </div>
      </header>
      {locked && (
        <JobNotice>
          This application or job is read-only. Stage, assignment and note
          changes are unavailable.
        </JobNotice>
      )}
      {row.is_blind && (
        <JobNotice>
          Blind review: identifying profile text, contact, links, free-text
          answers and resume access are hidden until interview. Rejection does
          not reveal identity.
        </JobNotice>
      )}
      {action.error && <JobNotice error>{action.error}</JobNotice>}
      {action.message && (
        <JobNotice>
          <span>{action.message}</span>
          {row.stage !== "interview" && !terminal.includes(row.stage) && canMove && (
            <button
              type="button"
              onClick={() => move("interview")}
              className="ml-2 underline font-semibold hover:text-[#0F1B2D]"
            >
              Move to Interview stage now →
            </button>
          )}
        </JobNotice>
      )}
      <div className="grid gap-6 lg:grid-cols-12 min-w-0">
        <div className="lg:col-span-8 space-y-6 min-w-0">
          {tab === "Overview" && (
            <>
              <EmployerCard title="Professional Summary">
                <p className="text-sm whitespace-pre-wrap">
                  {row.is_blind
                    ? "Hidden during blind review."
                    : row.profile?.summary || "Not provided."}
                </p>
                <h3 className="text-xs font-semibold mt-4 mb-2">
                  Relevant Core Skills
                </h3>
                <div className="flex flex-wrap gap-2">
                  {row.is_blind ? (
                    <p className="text-xs">Hidden during blind review.</p>
                  ) : row.profile?.skills.length ? (
                    row.profile.skills.map((skill) => (
                      <span
                        key={skill}
                        className="rounded-md bg-[#F3EBDD] px-2.5 py-1 text-xs"
                      >
                        {skill}
                      </span>
                    ))
                  ) : (
                    <p className="text-xs">Not provided.</p>
                  )}
                </div>
                <h3 className="text-xs font-semibold mt-4 mb-2">Cover note</h3>
                <p className="text-xs whitespace-pre-wrap">
                  {row.is_blind
                    ? "Hidden during blind review."
                    : row.cover_note || "Not provided."}
                </p>
              </EmployerCard>
              <EmployerCard title="Candidate Screening Responses">
                {row.screening_answers.length ? (
                  row.screening_answers.map((answer) => (
                    <div
                      className="rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] p-4 mb-3 text-xs"
                      key={answer.key}
                    >
                      <h3 className="font-semibold">{answer.prompt}</h3>
                      <p className="mt-1 whitespace-pre-wrap">
                        {typeof answer.value === "boolean"
                          ? answer.value
                            ? "Yes"
                            : "No"
                          : answer.type === "choice"
                            ? jobLabel(answer.value)
                            : answer.value}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs">
                    {row.is_blind
                      ? "No non-identifying answers to show during blind review."
                      : "No screening answers submitted."}
                  </p>
                )}
              </EmployerCard>
            </>
          )}
          {tab === "Resume" && (
            <ApplicantResumeSection
              row={row}
              orgId={org.id}
              jobId={jobId}
              applicationId={applicationId}
              action={action}
              setAction={setAction}
            />
          )}
          {tab === "Notes" && <PrivateNotes row={row} locked={locked} />}
          {tab === "Activity" && (
            <StageHistory jobId={jobId} applicationId={applicationId} />
          )}
          {["Interview practice", "Messages"].includes(tab) && (
            <EmployerCard title={tab}>
              <p className="text-sm">
                {tab === "Interview practice"
                  ? "Shared practice results are not connected. No practice score or consent is inferred."
                  : "Candidate messaging is not connected. No messages are sent by this page."}
              </p>
            </EmployerCard>
          )}
          {tab === "Interviews and feedback" && (
            <EmployerCard title="Interviews and feedback">
              <ApplicantInterviews
                key={interviewKey}
                jobId={jobId}
                applicationId={applicationId}
                onSchedule={canMove ? () => setShowScheduleModal(true) : undefined}
              />
            </EmployerCard>
          )}
        </div>
        <aside className="lg:col-span-4 space-y-6 min-w-0">
          <EmployerCard title="Decision Box">
            <label className="text-xs block">
              Move Pipeline Stage
              <select
                aria-label="Move pipeline stage"
                className={`${input} block mt-2 w-full`}
                value={row.stage}
                disabled={!canMove || action.busy}
                onChange={(e) => move(e.target.value)}
              >
                {[
                  ...new Set([
                    row.stage,
                    ...(row.stage === "offered" ? [] : reviewStages),
                    "rejected",
                  ]),
                ].map((s) => (
                  <option key={s} value={s}>
                    {label(s)}
                  </option>
                ))}
              </select>
            </label>
            <FieldError fields={action.fields} name="stage" />
            <FieldError fields={action.fields} name="expected_stage" />
            <p className="text-xs mt-4">
              Only owners/admins or the job owner may move stages. Offers and
              hires require their own workflows.
            </p>
            <h3 className="text-xs font-semibold mt-4">
              Quick Evaluation Score
            </h3>
            <EvaluationScorePanel
              jobId={jobId}
              applicationId={applicationId}
              locked={locked}
            />
          </EmployerCard>
          <EmployerCard title="Application Details">
            <dl className="text-xs space-y-3">
              {[
                [
                  "Experience",
                  row.experience_years == null
                    ? "Not provided"
                    : `${row.experience_years} years`,
                ],
                [
                  "Location",
                  row.is_blind
                    ? "Hidden during blind review"
                    : row.profile?.current_location || "Not provided",
                ],
                [
                  "Email",
                  row.is_blind
                    ? "Hidden during blind review"
                    : row.profile?.contact.email || "Not provided",
                ],
                [
                  "Phone",
                  row.is_blind
                    ? "Hidden during blind review"
                    : row.profile?.contact.phone || "Not provided",
                ],
                ["Expected pay", money(row)],
                ["Source", jobLabel(row.source)],
                ["Last stage change", dateLabel(row.stage_changed_at)],
              ].map(([key, value]) => (
                <div key={key}>
                  <dt className="text-[#6B7280]">{key}</dt>
                  <dd className="break-words">{value}</dd>
                </div>
              ))}
            </dl>
            {!row.is_blind && row.profile && (
              <div className="mt-4 flex flex-wrap gap-3 text-xs">
                {["linkedin_url", "portfolio_url", "github_url"].map(
                  (key) =>
                    row.profile.contact[key] && (
                      <a
                        key={key}
                        href={row.profile.contact[key]}
                        rel="noopener noreferrer"
                        target="_blank"
                        className="underline"
                      >
                        {jobLabel(key.replace("_url", ""))}
                      </a>
                    ),
                )}
              </div>
            )}
            {row.rejected_reason && (
              <p className="mt-4 text-xs whitespace-pre-wrap">
                Internal rejection reason: {row.rejected_reason}
              </p>
            )}
          </EmployerCard>
          <Assignment
            key={`${row.id}:${row.assignee_id || ""}`}
            row={row}
            locked={locked || !canWrite || action.busy}
            onSave={(assignee_id) => mutate({ assignee_id })}
            fields={action.fields}
          />
          <EmployerCard title="Candidate Comparison">
            <p className="text-xs">
              Not connected: comparison requires Step 7e. No ATS match, ranking
              or panel consensus is fabricated.
            </p>
          </EmployerCard>
        </aside>
      </div>
      {rejection && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reject-heading"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 border border-[#E5E1D8]">
            <div className="flex justify-between">
              <h2 id="reject-heading" className="font-serif font-bold">
                Reject application
              </h2>
              <button
                type="button"
                aria-label="Close rejection dialog"
                onClick={() => setRejection(false)}
                disabled={action.busy}
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-xs mt-3">
              This is terminal and records an internal reason. It does not send
              a message to the candidate.
            </p>
            <form
              className="space-y-4 mt-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (
                  window.confirm(
                    "Reject this application? This cannot be undone here.",
                  )
                )
                  mutate({
                    stage: "rejected",
                    expected_stage: row.stage,
                    rejected_reason: reason,
                    rejection_detail: detail || undefined,
                  });
              }}
            >
              <label className="block text-xs">
                Reason
                <select
                  aria-label="Rejection reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className={`${input} block w-full mt-1`}
                >
                  {reasons.map((value) => (
                    <option key={value} value={value}>
                      {jobLabel(value)}
                    </option>
                  ))}
                </select>
                <FieldError fields={action.fields} name="rejected_reason" />
              </label>
              <label className="block text-xs">
                Internal detail
                {reason === "other" ? " (required)" : " (optional)"}
                <textarea
                  aria-label="Rejection detail"
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                  maxLength={1000}
                  required={reason === "other"}
                  className={`${input} block w-full mt-1`}
                />
                <FieldError fields={action.fields} name="rejection_detail" />
              </label>
              {action.error && <JobNotice error>{action.error}</JobNotice>}
              <div className="flex justify-end gap-2">
                <EmployerBtn
                  secondary
                  onClick={() => setRejection(false)}
                  disabled={action.busy}
                >
                  Cancel
                </EmployerBtn>
                <EmployerBtn
                  primary
                  type="submit"
                  disabled={action.busy || !canMove}
                >
                  Confirm rejection
                </EmployerBtn>
              </div>
            </form>
          </div>
        </div>
      )}
      {showScheduleModal && (
        <ScheduleInterviewModal
          open={showScheduleModal}
          onClose={() => setShowScheduleModal(false)}
          orgId={org.id}
          jobId={jobId}
          applicationId={applicationId}
          candidateLabel={row.label}
          onSuccess={() => {
            setInterviewKey((k) => k + 1);
            setAction({
              busy: false,
              error: "",
              fields: {},
              message: "Interview scheduled successfully.",
            });
            resource.reload();
          }}
        />
      )}
    </>
  );
}
function ApplicantResumeSection({
  row,
  orgId,
  jobId,
  applicationId,
  action,
  setAction,
}) {
  const [preview, setPreview] = useState({
    active: false,
    loading: false,
    url: "",
    error: "",
  });

  if (row.is_blind) {
    return (
      <EmployerCard title="Submitted Resume">
        <p className="text-xs text-[#6B7280]">
          Resume access is hidden during blind review. Move the candidate to interview stage to unlock their resume and identity.
        </p>
      </EmployerCard>
    );
  }

  if (!row.resume_available) {
    return (
      <EmployerCard title="Submitted Resume">
        <div className="rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] p-8 text-center text-xs space-y-2">
          <FileText className="mx-auto text-[#9CA3AF]" size={36} />
          <p className="font-semibold text-sm text-[#0F1B2D]">No Resume Attached</p>
          <p className="text-[#6B7280]">
            The candidate did not attach a verified resume file when submitting this application.
          </p>
        </div>
      </EmployerCard>
    );
  }

  const fileName = row.resume_file_name || "candidate_resume.pdf";
  const isPdf =
    !row.resume_content_type ||
    row.resume_content_type === "application/pdf" ||
    fileName.toLowerCase().endsWith(".pdf");

  async function togglePreview() {
    if (preview.active) {
      setPreview((prev) => ({ ...prev, active: false }));
      return;
    }
    if (preview.url) {
      setPreview((prev) => ({ ...prev, active: true }));
      return;
    }
    setPreview({ active: true, loading: true, url: "", error: "" });
    try {
      const result = await api.applicants.resume(orgId, jobId, applicationId, {
        disposition: "inline",
      });
      setPreview({
        active: true,
        loading: false,
        url: browserStorageUrl(result.url),
        error: "",
      });
    } catch (err) {
      setPreview({
        active: true,
        loading: false,
        url: "",
        error: errorText(err)
          ? "Resume file not found or expired."
          : "Could not generate secure preview link. Try downloading directly.",
      });
    }
  }

  async function download() {
    setAction({ busy: true, error: "", fields: {}, message: "" });
    try {
      const result = await api.applicants.resume(orgId, jobId, applicationId, {
        disposition: "attachment",
      });
      window.open(browserStorageUrl(result.url), "_blank", "noopener,noreferrer");
      setAction({
        busy: false,
        error: "",
        fields: {},
        message: "Resume download opened.",
      });
    } catch (error) {
      setAction({
        busy: false,
        error: errorText(error) ? "Resume not available." : "Download failed.",
        fields: fileFieldErrors(error),
        message: "",
      });
    }
  }

  return (
    <EmployerCard title="Submitted Resume">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] p-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#F3EBDD] text-[#806236]">
              <FileText size={20} />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-xs text-[#0F1B2D] truncate" title={fileName}>
                {fileName}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="rounded bg-[#E5E1D8] px-1.5 py-0.5 text-[10px] font-medium text-[#4A5568]">
                  {isPdf ? "PDF" : "DOCX"}
                </span>
                <span className="text-[11px] text-[#6B7280]">
                  Clean scan verified · Private link
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <EmployerBtn
              primary={!preview.active}
              secondary={preview.active}
              small
              disabled={action.busy || preview.loading}
              onClick={togglePreview}
            >
              {preview.loading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : preview.active ? (
                <EyeOff size={14} />
              ) : (
                <Eye size={14} />
              )}
              {preview.active ? "Hide preview" : "Preview resume"}
            </EmployerBtn>
            <EmployerBtn
              secondary
              small
              disabled={action.busy}
              onClick={download}
            >
              <Download size={14} />
              Download
            </EmployerBtn>
          </div>
        </div>

        {preview.active && (
          <div className="rounded-xl border border-[#E5E1D8] bg-white p-3 space-y-3">
            <div className="flex items-center justify-between border-b border-[#E5E1D8] pb-2 text-xs">
              <span className="font-medium text-[#0F1B2D]">Resume Preview</span>
              {preview.url && (
                <a
                  href={preview.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[#806236] hover:underline"
                >
                  <ExternalLink size={12} />
                  Open in new tab
                </a>
              )}
            </div>

            {preview.loading && (
              <div className="flex h-64 items-center justify-center text-xs text-[#6B7280]">
                <Loader2 size={20} className="animate-spin mr-2 text-[#806236]" />
                Generating secure resume preview…
              </div>
            )}

            {preview.error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
                <p className="font-semibold">Unable to load preview</p>
                <p className="mt-1">{preview.error}</p>
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={togglePreview}
                    className="underline font-medium hover:text-rose-900"
                  >
                    Retry preview
                  </button>
                </div>
              </div>
            )}

            {preview.url && isPdf && (
              <div className="space-y-2">
                <iframe
                  src={preview.url}
                  className="w-full h-[650px] rounded-lg border border-[#E5E1D8] bg-[#FAF8F4]"
                  title={`Resume preview for ${row.label}`}
                />
                <p className="text-[11px] text-[#6B7280] text-center">
                  If the preview does not display in your browser, click{" "}
                  <a
                    href={preview.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#806236] underline"
                  >
                    Open in new tab
                  </a>{" "}
                  or use the Download button.
                </p>
              </div>
            )}

            {preview.url && !isPdf && (
              <div className="rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] p-8 text-center text-xs space-y-3">
                <FileText className="mx-auto text-[#806236]" size={36} />
                <p className="font-semibold text-sm text-[#0F1B2D]">
                  Microsoft Word Document (.docx)
                </p>
                <p className="text-[#6B7280] max-w-md mx-auto">
                  Web browsers cannot display Microsoft Word documents inline. Please download the resume to view it in your desktop Word processor.
                </p>
                <EmployerBtn secondary small onClick={download} disabled={action.busy}>
                  <Download size={14} />
                  Download {fileName}
                </EmployerBtn>
              </div>
            )}
          </div>
        )}
      </div>
    </EmployerCard>
  );
}
function Assignment({ row, locked, onSave, fields }) {
  const directory = useMemberDirectory();
  const [selected, setSelected] = useState(row.assignee_id || "");
  return (
    <EmployerCard title="Assignee">
      <label className="block text-xs">
        Hiring member
        <select
          aria-label="Assign hiring member"
          className={`${input} block w-full my-2`}
          disabled={locked}
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">Unassigned</option>
          {selected &&
            !directory.data?.items.some(
              (member) => member.user_id === selected,
            ) && (
              <option value={selected}>
                Assigned team member (not in this page)
              </option>
            )}
          <MemberOptions directory={directory} excludeViewers />
        </select>
      </label>
      <MemberPaging directory={directory} />
      <FieldError fields={fields} name="assignee_id" />
      <EmployerBtn
        secondary
        small
        disabled={
          locked ||
          directory.loading ||
          Boolean(directory.error) ||
          selected === (row.assignee_id || "")
        }
        onClick={() => onSave(selected || null)}
      >
        Save assignee
      </EmployerBtn>
      <p className="text-xs mt-2">
        Owner/admin only. The server checks hiring eligibility.
      </p>
    </EmployerCard>
  );
}
function PrivateNotes({ row, locked }) {
  const { org } = useJobsWorkspace();
  const [offset, setOffset] = useState(0);
  const [body, setBody] = useState("");
  const [action, setAction] = useState({ busy: false, error: "", fields: {} });
  const resource = useCareerResource(
    `notes:${org.id}:${row.id}:${offset}`,
    (signal) =>
      api.applicants.notes(
        org.id,
        row.job_id,
        row.id,
        { limit: 20, offset },
        signal,
      ),
  );
  async function save(event) {
    event.preventDefault();
    setAction({ busy: true, error: "", fields: {} });
    try {
      await api.applicants.addNote(org.id, row.job_id, row.id, { body });
      setBody("");
      setOffset(0);
      resource.reload();
      setAction({ busy: false, error: "", fields: {} });
    } catch (error) {
      setAction({
        busy: false,
        error: errorText(error),
        fields: fileFieldErrors(error),
      });
    }
  }
  async function remove(note) {
    if (!window.confirm("Delete your private note?")) return;
    setAction({ busy: true, error: "", fields: {} });
    try {
      await api.applicants.deleteNote(org.id, row.job_id, row.id, note.id);
      setOffset(0);
      resource.reload();
      setAction({ busy: false, error: "", fields: {} });
    } catch (error) {
      setAction({
        busy: false,
        error: errorText(error),
        fields: fileFieldErrors(error),
      });
    }
  }
  return (
    <EmployerCard title="Your Private Notes">
      <p className="text-xs mb-4">
        Only you can read these notes—even other owners/admins cannot. They are
        not shared with the hiring panel or candidate.
      </p>
      <form onSubmit={save} className="space-y-3">
        <label className="block text-xs">
          Add private note
          <textarea
            aria-label="Private note"
            maxLength={5000}
            required
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={locked || action.busy}
            className={`${input} block w-full mt-2`}
            rows={3}
          />
        </label>
        <FieldError fields={action.fields} name="body" />
        <EmployerBtn
          primary
          type="submit"
          disabled={locked || action.busy || !body.trim()}
        >
          Save Note
        </EmployerBtn>
      </form>
      {action.error && <JobNotice error>{action.error}</JobNotice>}
      <div className="mt-4">
        <State resource={resource} text="Loading private notes…" />
        {resource.data && (
          <>
            {!resource.data.items.length && (
              <p className="text-xs">
                You have no private notes for this application.
              </p>
            )}
            {resource.data.items.map((note) => (
              <article
                key={note.id}
                className="border-t border-[#E5E1D8] py-4 text-xs space-y-2"
              >
                <p>You · {dateLabel(note.created_at)}</p>
                <p className="whitespace-pre-wrap break-words">{note.body}</p>
                <EmployerBtn
                  destructive
                  small
                  disabled={locked || action.busy}
                  onClick={() => remove(note)}
                >
                  Delete note
                </EmployerBtn>
              </article>
            ))}
            <Pager data={resource.data} offset={offset} setOffset={setOffset} />
          </>
        )}
      </div>
    </EmployerCard>
  );
}
function StageHistory({ jobId, applicationId }) {
  const { org } = useJobsWorkspace();
  const [offset, setOffset] = useState(0);
  const resource = useCareerResource(
    `history:${org.id}:${applicationId}:${offset}`,
    (signal) =>
      api.applicants.history(
        org.id,
        jobId,
        applicationId,
        { limit: 20, offset },
        signal,
      ),
  );
  return (
    <EmployerCard title="Stage History">
      <p className="text-xs mb-4">
        Actual stage changes only; no actor names or communication events are
        inferred.
      </p>
      <State resource={resource} text="Loading stage history…" />
      {resource.data && (
        <>
          {resource.data.items.map((event) => (
            <div
              key={event.id}
              className="border-t border-[#E5E1D8] py-3 text-xs"
            >
              <p>
                {event.from_stage
                  ? label(event.from_stage)
                  : "Application received"}{" "}
                → {label(event.to_stage)}
              </p>
              <p>{dateLabel(event.created_at)}</p>
            </div>
          ))}
          {!resource.data.items.length && <p>No stage history is available.</p>}
          <Pager data={resource.data} offset={offset} setOffset={setOffset} />
        </>
      )}
    </EmployerCard>
  );
}

export function ApplicantCount({ jobId }) {
  const { org } = useJobsWorkspace();
  return org.my_role === "viewer" ? "Not permitted" : <Count jobId={jobId} />;
}
function Count({ jobId }) {
  const { org } = useJobsWorkspace();
  const resource = useCareerResource(
    `applicant-count:${org.id}:${jobId}`,
    (signal) => api.applicants.list(org.id, jobId, { limit: 1 }, signal),
  );
  return resource.loading
    ? "Loading…"
    : resource.error
      ? "Unavailable"
      : resource.data.total;
}
