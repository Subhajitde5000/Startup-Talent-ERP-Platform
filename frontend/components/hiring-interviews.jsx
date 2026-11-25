"use client";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { JobSeekerShell } from "@/components";
import { useCareerSearch } from "./career-data";
import {
  api,
  useCareerResource,
  useJobsWorkspace,
  Card,
  Button,
  Heading,
  HiringPage,
  State,
  Pager,
  Field,
  Select,
  Members,
  ApplicationPicker,
  Tabs,
  inputClass,
  useAction,
  ActionState,
  Modal,
  label,
  date,
  newKey,
} from "./hiring-ui";

export function EmployerInterviewsPage() {
  return (
    <HiringPage>
      <EmployerInterviews />
    </HiringPage>
  );
}
function EmployerInterviews() {
  const workspace = useJobsWorkspace();
  return <InterviewList orgId={workspace.org.id} user={workspace.user} />;
}
export function CandidateInterviewsPage() {
  const { user } = useAuth();
  return (
    <JobSeekerShell active="Interviews" liveData>
      <div className="space-y-6 max-w-6xl">
        <InterviewList user={user} own />
      </div>
    </JobSeekerShell>
  );
}
export function ApplicantScheduleButton({
  applicationId,
  disabled,
  onScheduled,
}) {
  const { org } = useJobsWorkspace();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button small secondary disabled={disabled} onClick={() => setOpen(true)}>
        Schedule interview
      </Button>
      {open && (
        <Modal title="Schedule interview" onClose={() => setOpen(false)}>
          <InterviewEditor
            initial={{ application_id: applicationId }}
            orgId={org.id}
            done={() => {
              setOpen(false);
              onScheduled?.();
            }}
          />
        </Modal>
      )}
    </>
  );
}
export function InterviewList({
  orgId,
  user,
  own = false,
  applicationId,
  canSchedule = true,
}) {
  const [view, setView] = useState("upcoming"),
    [search, setSearch] = useState(""),
    [from, setFrom] = useState(""),
    [until, setUntil] = useState(""),
    [offset, setOffset] = useState(0),
    [edit, setEdit] = useState(null),
    [detail, setDetail] = useState(null);
  const q = useCareerSearch(search);
  const r = useCareerResource(
    `interviews:${orgId || "own"}:${applicationId || ""}:${view}:${q}:${from}:${until}:${offset}`,
    (signal) => {
      const query = {
        limit: 12,
        offset,
        view,
        q: q || undefined,
        application_id: applicationId,
        scheduled_from: from
          ? new Date(from + "T00:00:00").toISOString()
          : undefined,
        scheduled_until: until
          ? new Date(until + "T00:00:00").toISOString()
          : undefined,
      };
      return own
        ? api.hiring.ownInterviews(query, signal)
        : api.hiring.interviews(orgId, query, signal);
    },
  );
  return (
    <>
      <Heading
        title={applicationId ? "Interviews and feedback" : "Interviews"}
        description="Schedule, attendance and private panel feedback."
      >
        {!own && canSchedule && (
          <Button
            onClick={() => setEdit({ application_id: applicationId || "" })}
          >
            Schedule interview
          </Button>
        )}
      </Heading>
      <Tabs
        value={view}
        onChange={(v) => {
          setView(v);
          setOffset(0);
        }}
        values={
          own
            ? [
                ["upcoming", "Upcoming"],
                ["needs_action", "Needs action"],
                ["past", "Past"],
              ]
            : [
                ["upcoming", "Upcoming"],
                ["needs_feedback", "Needs feedback"],
                ["past", "Past"],
              ]
        }
      />
      <div className="flex flex-wrap gap-3 items-end">
        <Field
          name="search"
          title="Search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOffset(0);
          }}
        />
        <Field
          type="date"
          name="from"
          title="From (inclusive)"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            setOffset(0);
          }}
        />
        <Field
          type="date"
          name="until"
          title="Until (exclusive)"
          value={until}
          onChange={(e) => {
            setUntil(e.target.value);
            setOffset(0);
          }}
        />
      </div>
      <State
        resource={r}
        empty={!r.data?.items.length}
        text="No interviews in this view."
      />
      <div className="grid md:grid-cols-2 gap-4">
        {r.data?.items.map((row) => (
          <Card key={row.id} title={row.round_name}>
            <div className="text-xs space-y-2">
              <p className="font-semibold">
                {row.job_title} · {own ? row.company_name : row.applicant_label}
              </p>
              <p>
                {date(row.scheduled_at)} · {row.duration_min} minutes
              </p>
              <p>
                {label(row.format)} · {label(row.status)}
              </p>
              {row.location && <p>{row.location}</p>}
              <div className="flex flex-wrap gap-2 pt-2">
                <Button small onClick={() => setDetail(row.id)}>
                  View details
                </Button>
                {row.meeting_url &&
                  ["scheduled", "confirmed"].includes(row.status) && (
                    <a
                      className="underline p-2"
                      target="_blank"
                      rel="noopener noreferrer"
                      href={row.meeting_url}
                    >
                      Join meeting
                    </a>
                  )}
                {!own &&
                  row.can_manage &&
                  ["scheduled", "confirmed"].includes(row.status) && (
                    <Button small secondary onClick={() => setEdit(row)}>
                      Reschedule / panel
                    </Button>
                  )}
              </div>
            </div>
          </Card>
        ))}
      </div>
      <Pager data={r.data} offset={offset} setOffset={setOffset} />
      {edit && (
        <Modal
          title={edit.id ? "Reschedule interview" : "Schedule interview"}
          onClose={() => {
            setEdit(null);
            r.reload();
          }}
        >
          <InterviewEditor
            initial={edit}
            orgId={orgId}
            done={() => {
              setEdit(null);
              r.reload();
            }}
          />
        </Modal>
      )}
      {detail && (
        <Modal title="Interview details" onClose={() => setDetail(null)}>
          <InterviewDetails
            id={detail}
            orgId={orgId}
            own={own}
            user={user}
            changed={r.reload}
          />
        </Modal>
      )}
    </>
  );
}
function InterviewEditor({ initial, orgId, done }) {
  const [job, setJob] = useState(""),
    [app, setApp] = useState(initial.application_id || ""),
    [round, setRound] = useState(initial.round_name || ""),
    [format, setFormat] = useState(initial.format || "video"),
    [at, setAt] = useState(
      initial.scheduled_at ? localTime(initial.scheduled_at) : "",
    ),
    [duration, setDuration] = useState(initial.duration_min || 45),
    [location, setLocation] = useState(initial.location || ""),
    [url, setUrl] = useState(initial.meeting_url || ""),
    [panel, setPanel] = useState(
      (initial.participants || [])
        .filter((p) => p.side !== "candidate")
        .map((p) => ({ user_id: p.user_id, side: p.side })),
    );
  const [requestId] = useState(newKey);
  const a = useAction();
  const fields = () => ({
    round_name: round,
    format,
    scheduled_at: new Date(at).toISOString(),
    duration_min: Number(duration),
    location: location || null,
    meeting_url: url || null,
  });
  return (
    <div className="space-y-5">
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const body = fields();
          const value = await a.run(() =>
            initial.id
              ? api.hiring.reschedule(orgId, initial.id, {
                  ...body,
                  expected_version: initial.version,
                })
              : api.hiring.schedule(orgId, {
                  ...body,
                  application_id: app,
                  request_id: requestId,
                  participants: panel,
                }),
          );
          if (value) done();
        }}
      >
        {!initial.id && !initial.application_id && (
          <ApplicationPicker
            value={app}
            onChange={setApp}
            jobValue={job}
            onJobChange={setJob}
          />
        )}
        <Field
          name="round_name"
          title="Round"
          required
          maxLength={200}
          value={round}
          onChange={(e) => setRound(e.target.value)}
          errors={a.fields}
        />
        <Select
          name="format"
          value={format}
          onChange={(e) => setFormat(e.target.value)}
          options={["video", "phone", "onsite", "async"].map((v) => [
            v,
            label(v),
          ])}
        />
        <Field
          name="scheduled_at"
          type="datetime-local"
          title="Scheduled time (your timezone)"
          required
          value={at}
          onChange={(e) => setAt(e.target.value)}
          errors={a.fields}
        />
        <Field
          name="duration_min"
          title="Duration (minutes)"
          type="number"
          min={5}
          max={480}
          required
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
        />
        <Field
          name="location"
          maxLength={500}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
        <Field
          name="meeting_url"
          type="url"
          pattern="https://.*"
          maxLength={2000}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        {!initial.id && <Panel panel={panel} setPanel={setPanel} />}
        <ActionState action={a} />
        <Button
          type="submit"
          disabled={a.busy || (!initial.id && (!app || !panel.length))}
        >
          {initial.id ? "Save new schedule" : "Schedule"}
        </Button>
      </form>
      {initial.id && (
        <form
          className="border-t pt-4 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await a.run(() =>
                api.hiring.participants(orgId, initial.id, {
                  expected_version: initial.version,
                  participants: panel,
                }),
              )
            )
              done();
          }}
        >
          <Panel panel={panel} setPanel={setPanel} />
          <Button type="submit" disabled={a.busy || !panel.length}>
            Replace panel
          </Button>
        </form>
      )}
    </div>
  );
}
function localTime(value) {
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
function Panel({ panel, setPanel }) {
  return (
    <div className="space-y-2">
      <Members
        multiple
        title="Panel members"
        value={panel.map((p) => p.user_id)}
        onChange={(e) =>
          setPanel(
            [...e.target.selectedOptions]
              .filter((o) => o.value)
              .map(
                (o) =>
                  panel.find((p) => p.user_id === o.value) || {
                    user_id: o.value,
                    side: "interviewer",
                  },
              ),
          )
        }
      />
      {panel.map((p) => (
        <Select
          key={p.user_id}
          name="side"
          title={`Panel role · ${p.user_id}`}
          value={p.side}
          onChange={(e) =>
            setPanel(
              panel.map((x) =>
                x.user_id === p.user_id ? { ...x, side: e.target.value } : x,
              ),
            )
          }
          options={[
            ["interviewer", "Interviewer"],
            ["observer", "Observer"],
          ]}
        />
      ))}
    </div>
  );
}
function InterviewDetails({ id, orgId, own, user, changed }) {
  const r = useCareerResource(`interview:${orgId || "own"}:${id}`, (signal) =>
    own
      ? api.hiring.ownInterview(id, signal)
      : api.hiring.interview(orgId, id, signal),
  );
  const a = useAction();
  const [response, setResponse] = useState("accepted"),
    [reason, setReason] = useState("");
  const row = r.data;
  const me = row?.participants.find((p) => own || p.user_id === user.id);
  const live = row && ["scheduled", "confirmed"].includes(row.status);
  async function run(fn) {
    if (await a.run(fn)) {
      r.reload();
      changed();
    }
  }
  return (
    <div className="space-y-4">
      <State resource={r} />
      {row && (
        <>
          <h3 className="font-semibold">
            {row.round_name} · {row.job_title}
          </h3>
          <p className="text-xs">
            {date(row.scheduled_at)} · {row.duration_min} minutes ·{" "}
            {label(row.status)}
          </p>
          <p className="text-xs">{row.location || "Location not provided"}</p>
          {row.meeting_url && (
            <a
              className="text-xs underline"
              target="_blank"
              rel="noopener noreferrer"
              href={row.meeting_url}
            >
              Meeting link
            </a>
          )}
          {row.cancelled_reason && (
            <p className="text-xs">Cancellation: {row.cancelled_reason}</p>
          )}
          <ul className="text-xs space-y-1">
            {row.participants.map((p, i) => (
              <li key={i}>
                {p.display_name} · {label(p.side)} ·{" "}
                {p.response ? label(p.response) : "No response"}
              </li>
            ))}
          </ul>
          {me && live && (
            <form
              className="flex flex-wrap gap-3 items-end"
              onSubmit={(e) => {
                e.preventDefault();
                run(() =>
                  own
                    ? api.hiring.ownAttendance(id, {
                        expected_version: row.version,
                        response,
                      })
                    : api.hiring.attendance(orgId, id, {
                        expected_version: row.version,
                        response,
                      }),
                );
              }}
            >
              <Select
                name="response"
                title="Your attendance"
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                options={["accepted", "tentative", "declined"].map((v) => [
                  v,
                  label(v),
                ])}
              />
              <Button type="submit" disabled={a.busy}>
                Respond
              </Button>
            </form>
          )}
          {!own && row.can_manage && live && (
            <div className="space-y-3 border-t pt-4">
              <Field
                name="reason"
                title="Cancellation / outcome reason"
                maxLength={1000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                {["complete", "no_show", "cancel"].map((v) => (
                  <Button
                    key={v}
                    disabled={a.busy}
                    onClick={() => {
                      if (confirm(`${label(v)} this interview?`))
                        run(() =>
                          api.hiring.interviewTransition(orgId, id, {
                            expected_version: row.version,
                            action: v,
                            reason: reason || null,
                          }),
                        );
                    }}
                  >
                    {label(v)}
                  </Button>
                ))}
              </div>
            </div>
          )}
          <ActionState action={a} />
          {!own && (
            <Feedback
              id={id}
              orgId={orgId}
              canSubmit={
                me?.side === "interviewer" && row.status === "completed"
              }
            />
          )}
        </>
      )}
    </div>
  );
}
function Feedback({ id, orgId, canSubmit }) {
  const [offset, setOffset] = useState(0),
    [recommendation, setRecommendation] = useState("yes"),
    [summary, setSummary] = useState("");
  const r = useCareerResource(`feedback:${orgId}:${id}:${offset}`, (signal) =>
    api.hiring.feedback(orgId, id, { limit: 20, offset }, signal),
  );
  const a = useAction();
  return (
    <Card title="Panel feedback">
      <State
        resource={r}
        empty={!r.data?.items.length}
        text="No feedback available to your role."
      />
      {r.data?.items.map((f) => (
        <div className="text-xs border-b py-3 space-y-1" key={f.id}>
          <p>
            {label(f.recommendation)} · {date(f.updated_at)}
          </p>
          <p className="whitespace-pre-wrap">{f.summary}</p>
        </div>
      ))}
      <Pager data={r.data} offset={offset} setOffset={setOffset} />
      {canSubmit && (
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await a.run(() =>
                api.hiring.saveFeedback(orgId, id, { recommendation, summary }),
              )
            )
              r.reload();
          }}
        >
          <Select
            name="recommendation"
            value={recommendation}
            onChange={(e) => setRecommendation(e.target.value)}
            options={["strong_yes", "yes", "no", "strong_no"].map((v) => [
              v,
              label(v),
            ])}
          />
          <Field name="summary" title="Your feedback">
            <textarea
              required
              maxLength={5000}
              className={inputClass}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </Field>
          <ActionState action={a} />
          <Button type="submit" disabled={a.busy}>
            Save my feedback
          </Button>
        </form>
      )}
    </Card>
  );
}
