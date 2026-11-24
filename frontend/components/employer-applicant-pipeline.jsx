"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, UserCheck, UserX, X } from "lucide-react";
import { EmployerBtn, EmployerCard, StageChip } from "@/components";
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
            <EmployerBtn
              secondary
              small
              disabled
              title="Scorecards and comparison require the Step 7e backend"
            >
              Compare Candidates (not connected)
            </EmployerBtn>
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
  const resource = useCareerResource(
    `applicant:${org.id}:${jobId}:${applicationId}`,
    (signal) => api.applicants.get(org.id, jobId, applicationId, signal),
  );
  const row = resource.data;
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
  async function resume() {
    setAction({ busy: true, error: "", fields: {}, message: "" });
    try {
      const result = await api.applicants.resume(org.id, jobId, applicationId);
      window.open(
        browserStorageUrl(result.url),
        "_blank",
        "noopener,noreferrer",
      );
      setAction({
        busy: false,
        error: "",
        fields: {},
        message: "Resume download link opened.",
      });
    } catch (error) {
      setAction({
        busy: false,
        error: errorText(error),
        fields: fileFieldErrors(error),
        message: "",
      });
    }
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
              primary
              small
              disabled={!canMove || action.busy || row.stage === "offered"}
              onClick={() => move("shortlisted")}
            >
              <UserCheck size={14} />
              Shortlist
            </EmployerBtn>
            <EmployerBtn
              secondary
              small
              disabled
              title="Interview scheduling is not connected"
            >
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
      {action.message && <JobNotice>{action.message}</JobNotice>}
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
            <EmployerCard title="Submitted Resume">
              <p className="text-xs mb-4">
                {row.is_blind
                  ? "Resume access is hidden during blind review."
                  : row.resume_available
                    ? "The candidate’s attached resume is available through a short-lived private link. No resume parsing or qualification verification is claimed."
                    : "No ready, clean submitted resume is available."}
              </p>
              <EmployerBtn
                secondary
                disabled={!row.resume_available || row.is_blind || action.busy}
                onClick={resume}
              >
                <Download size={14} />
                Download submitted resume
              </EmployerBtn>
            </EmployerCard>
          )}
          {tab === "Notes" && <PrivateNotes row={row} locked={locked} />}
          {tab === "Activity" && (
            <StageHistory jobId={jobId} applicationId={applicationId} />
          )}
          {[
            "Interview practice",
            "Interviews and feedback",
            "Messages",
          ].includes(tab) && (
            <EmployerCard title={tab}>
              <p className="text-sm">
                {tab === "Interviews and feedback"
                  ? "Interview scheduling and scorecard feedback are not connected. No rounds or recommendations are available."
                  : tab === "Interview practice"
                    ? "Shared practice results are not connected. No practice score or consent is inferred."
                    : "Candidate messaging is not connected. No messages are sent by this page."}
              </p>
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
            <p className="text-xs mt-2">
              Scorecards and comparison are unavailable until the Step 7e
              backend is connected.
            </p>
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
    </>
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
