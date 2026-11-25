"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { JobSeekerShell } from "@/components";
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
  money,
  newKey,
  download,
} from "./hiring-ui";
import FileUploadControl from "@/components/files/FileUploadControl";
const terms = [
  "payment_terms",
  "bonus_terms",
  "probation_terms",
  "notice_terms",
  "vesting_terms",
  "exercise_price_terms",
  "joining_bonus_terms",
];
export function EmployerOffersPage() {
  return (
    <HiringPage>
      <StaffOfferList />
    </HiringPage>
  );
}
function StaffOfferList() {
  const { org, href } = useJobsWorkspace();
  const router = useRouter();
  const applicationId = useSearchParams().get("application_id");
  const [status, setStatus] = useState(""),
    [offset, setOffset] = useState(0),
    [create, setCreate] = useState(false);
  const r = useCareerResource(
    `staff-offers:${org.id}:${applicationId || "all"}:${status}:${offset}`,
    (signal) =>
      api.hiring.offers(
        org.id,
        {
          application_id: applicationId || undefined,
          status: status === "approval" ? "draft" : status || undefined,
          submitted: status === "approval" ? true : undefined,
          limit: 12,
          offset,
        },
        signal,
      ),
  );
  return (
    <>
      <Heading
        title="Offers"
        description="Draft, approve and send versioned contractual offers."
      >
        <Button onClick={() => setCreate(true)}>Create offer</Button>
      </Heading>
      <Tabs
        value={status}
        onChange={(v) => {
          setStatus(v);
          setOffset(0);
        }}
        values={[
          "",
          "draft",
          "approval",
          "sent",
          "countered",
          "accepted",
          "declined",
          "expired",
          "withdrawn",
        ].map((v) => [
          v,
          v === "approval" ? "Awaiting approval" : v ? label(v) : "All",
        ])}
      />
      <OfferRows
        resource={r}
        href={(row) => href(`/employer/offers/${row.id}`)}
        staff
      />
      <Pager data={r.data} offset={offset} setOffset={setOffset} />
      {create && (
        <Modal title="Create offer" onClose={() => setCreate(false)}>
          <OfferEditor
            initial={applicationId ? { application_id: applicationId } : {}}
            orgId={org.id}
            done={(row) => router.push(href(`/employer/offers/${row.id}`))}
          />
        </Modal>
      )}
    </>
  );
}
export function EmployerOfferDetail({ offerId }) {
  return (
    <HiringPage>
      <StaffOfferDetail id={offerId} />
    </HiringPage>
  );
}
function StaffOfferDetail({ id }) {
  const { org, href, user } = useJobsWorkspace();
  const router = useRouter();
  const [edit, setEdit] = useState(""),
    [approvers, setApprovers] = useState([]),
    [note, setNote] = useState(""),
    [approvalOffset, setApprovalOffset] = useState(0);
  const r = useCareerResource(`staff-offer:${org.id}:${id}`, (signal) =>
    api.hiring.offer(org.id, id, signal),
  );
  const approvals = useCareerResource(
    `offer-approvals:${org.id}:${id}:${approvalOffset}`,
    (signal) =>
      api.hiring.approvals(
        org.id,
        id,
        { limit: 20, offset: approvalOffset },
        signal,
      ),
  );
  const a = useAction();
  const row = r.data;
  const draft = row?.status === "draft" && !row.submitted_at;
  const writable = row?.pipeline_writable && !row.superseded_at;
  const ownApproval = approvals.data?.items.find(
    (x) => x.approver_id === user.id,
  );
  async function act(fn) {
    const result = await a.run(fn);
    if (result) {
      r.reload();
      approvals.reload();
    }
  }
  return (
    <>
      <Heading
        title="Offer details"
        description="Terms are frozen on submission. Revisions require new approval."
      >
        <Link className="text-xs underline" href={href("/employer/offers")}>
          All offers
        </Link>
        <Button small secondary onClick={r.reload}>
          Refresh record
        </Button>
      </Heading>
      <State resource={r} />
      <ActionState action={a} />
      {row && (
        <>
          <div className="flex flex-wrap gap-2">
            {writable && draft && (
              <>
                <Button onClick={() => setEdit("edit")}>Edit draft</Button>
                <Button
                  disabled={a.busy}
                  onClick={async () => {
                    if (confirm("Archive this unsubmitted draft?")) {
                      const ok = await a.run(async () => {
                        await api.hiring.archiveOffer(org.id, id);
                        return true;
                      });
                      if (ok) router.push(href("/employer/offers"));
                    }
                  }}
                >
                  Archive draft
                </Button>
              </>
            )}
            {writable &&
              ["draft", "sent", "countered"].includes(row.status) && (
                <Button onClick={() => setEdit("revision")}>
                  Create revision
                </Button>
              )}
            {!row.superseded_at &&
              ["draft", "sent", "countered"].includes(row.status) && (
                <Button
                  disabled={a.busy}
                  onClick={() => {
                    if (confirm("Withdraw this offer?"))
                      act(() =>
                        api.hiring.withdrawOffer(org.id, id, {
                          expected_version: row.version,
                        }),
                      );
                  }}
                >
                  Withdraw
                </Button>
              )}
            {row.status === "expired" && !row.superseded_at && (
              <Button
                disabled={a.busy}
                onClick={() =>
                  act(() =>
                    api.hiring.expireOffer(org.id, id, {
                      expected_version: row.version,
                    }),
                  )
                }
              >
                Record expiry
              </Button>
            )}
            {row.document_available && (
              <Button
                disabled={a.busy}
                onClick={() =>
                  a.run(() =>
                    download(() => api.hiring.offerDocument(org.id, id)),
                  )
                }
              >
                Download attached offer
              </Button>
            )}
            {row.status === "accepted" && (
              <Link
                className="rounded-xl border bg-white px-4 py-2 text-xs"
                href={href(`/employer/hires?offer_id=${row.id}`)}
              >
                Create onboarding record
              </Link>
            )}
          </div>
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <OfferTerms row={row} />
            </div>
            <div className="space-y-6">
              <Card title="Candidate & status">
                <p className="text-sm font-semibold">{row.applicant_label}</p>
                <p className="text-xs mt-2">
                  {label(row.status)} · terms v{row.terms_version}
                </p>
                {row.superseded_at && (
                  <p className="text-xs mt-2">
                    Superseded {date(row.superseded_at)}. This version is
                    read-only.
                  </p>
                )}
                <p className="text-xs mt-2">Sent: {date(row.sent_at)}</p>
                {row.counter_note && (
                  <p className="text-xs whitespace-pre-wrap mt-2">
                    Counter: {row.counter_note}
                  </p>
                )}
                {row.decline_detail && (
                  <p className="text-xs whitespace-pre-wrap mt-2">
                    Shared decline reason: {row.decline_detail}
                  </p>
                )}
              </Card>
              <Card title="Approvals">
                <State
                  resource={approvals}
                  empty={!approvals.data?.items.length}
                  text="No approvals requested."
                />
                {approvals.data?.items.map((x) => (
                  <p className="text-xs py-2" key={x.id}>
                    {x.approver_id === user.id
                      ? "You"
                      : x.approver_id || "Former approver"}{" "}
                    · {label(x.status)}
                    {x.note ? ` · ${x.note}` : ""}
                  </p>
                ))}
                <Pager
                  data={approvals.data}
                  offset={approvalOffset}
                  setOffset={setApprovalOffset}
                />
                {writable && draft && (
                  <form
                    className="space-y-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      act(() =>
                        api.hiring.submitOffer(org.id, id, {
                          expected_version: row.version,
                          approver_ids: approvers,
                        }),
                      );
                    }}
                  >
                    <Members
                      multiple
                      managers
                      title="Independent approvers"
                      value={approvers}
                      onChange={(e) =>
                        setApprovers(
                          [...e.target.selectedOptions]
                            .map((o) => o.value)
                            .filter(Boolean),
                        )
                      }
                    />
                    <p className="text-xs">
                      Authors and submitters cannot approve their own offer.
                    </p>
                    <Button
                      type="submit"
                      disabled={a.busy || !approvers.length}
                    >
                      Submit for approval
                    </Button>
                  </form>
                )}
                {writable &&
                  row.status === "draft" &&
                  row.submitted_at &&
                  ownApproval?.status === "pending" && (
                    <div className="space-y-2">
                      <Field
                        name="note"
                        title="Approval note"
                        value={note}
                        maxLength={1000}
                        onChange={(e) => setNote(e.target.value)}
                      />
                      {["approved", "rejected"].map((decision) => (
                        <Button
                          key={decision}
                          disabled={a.busy}
                          onClick={() =>
                            act(() =>
                              api.hiring.decideOffer(org.id, id, {
                                expected_version: row.version,
                                decision,
                                note: note || null,
                              }),
                            )
                          }
                        >
                          {label(decision)}
                        </Button>
                      ))}
                    </div>
                  )}
                {writable &&
                  row.status === "draft" &&
                  row.submitted_at &&
                  approvals.data?.items.length > 0 &&
                  !approvals.data.has_more &&
                  approvals.data.items.every(
                    (x) => x.status === "approved",
                  ) && (
                    <Button
                      disabled={a.busy}
                      onClick={() =>
                        act(() =>
                          api.hiring.sendOffer(org.id, id, {
                            expected_version: row.version,
                          }),
                        )
                      }
                    >
                      Send offer
                    </Button>
                  )}
              </Card>
              <Card title="Unavailable">
                <p className="text-xs">
                  Letter generation, e-signing, reminders and messaging are not
                  connected. Upload an existing document instead.
                </p>
              </Card>
            </div>
          </div>
          {edit && (
            <Modal
              title={edit === "revision" ? "Revise offer" : "Edit offer"}
              onClose={() => {
                setEdit("");
                r.reload();
              }}
            >
              <OfferEditor
                initial={row}
                orgId={org.id}
                revision={edit === "revision"}
                done={(value) => {
                  setEdit("");
                  if (value.id !== id)
                    router.push(href(`/employer/offers/${value.id}`));
                  else r.reload();
                }}
              />
            </Modal>
          )}
        </>
      )}
    </>
  );
}
export function OfferTerms({ row }) {
  return (
    <>
      <Card title="Compensation">
        <dl className="grid sm:grid-cols-2 gap-4 text-xs">
          {[
            ["Title", row.title],
            [
              "Base salary",
              `${money(row.base_salary, row.currency)} / ${label(row.salary_period)}`,
            ],
            ["Bonus", money(row.bonus_amount, row.currency)],
            [
              "Equity",
              row.equity_pct == null ? "Not provided" : `${row.equity_pct}%`,
            ],
            ["Joining bonus", money(row.joining_bonus, row.currency)],
            ["Start date", date(row.start_date)],
            ["Expires", date(row.expires_on)],
            ["Notice period (candidate)", "Not provided"],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-[#6B7280]">{k}</dt>
              <dd className="mt-1 font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <Card title="Contractual terms">
        <dl className="space-y-4 text-xs">
          {terms.map((k) => (
            <div key={k}>
              <dt className="font-semibold">{label(k)}</dt>
              <dd className="whitespace-pre-wrap mt-1">
                {row[k] || "Not provided"}
              </dd>
            </div>
          ))}
        </dl>
      </Card>
      <Card title="Role & benefits">
        <p className="text-xs">
          {row.job_snapshot.company_name} ·{" "}
          {row.job_snapshot.location || "Location not provided"} ·{" "}
          {label(row.job_snapshot.work_mode)} ·{" "}
          {label(row.job_snapshot.employment_type)}
        </p>
        <ul className="text-xs mt-3 list-disc pl-4">
          {row.job_snapshot.benefits.length ? (
            row.job_snapshot.benefits.map((b) => <li key={b}>{b}</li>)
          ) : (
            <li>No benefits provided</li>
          )}
        </ul>
      </Card>
    </>
  );
}
export function OfferEditor({ initial = {}, orgId, revision = false, done }) {
  const [job, setJob] = useState(""),
    [app, setApp] = useState(initial.application_id || ""),
    [form, setForm] = useState({
      ...Object.fromEntries(
        [
          "title",
          "base_salary",
          "bonus_amount",
          "equity_pct",
          "joining_bonus",
          "currency",
          "salary_period",
          "start_date",
          "expires_on",
          ...terms,
        ].map((k) => [k, initial[k] ?? ""]),
      ),
      currency: initial.currency || "INR",
      salary_period: initial.salary_period || "annual",
    }),
    [file, setFile] = useState(undefined),
    [removeFile, setRemoveFile] = useState(false),
    [uploadBusy, setUploadBusy] = useState(false),
    [requestId] = useState(newKey);
  const a = useAction();
  const change = (k, v) => setForm({ ...form, [k]: v });
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const body = {
          ...form,
          ...Object.fromEntries(
            ["bonus_amount", "equity_pct", "joining_bonus", ...terms].map(
              (k) => [k, form[k] || null],
            ),
          ),
        };
        if (file || removeFile || !initial.id || revision)
          body.document_file_id = file?.id || null;
        const value = await a.run(() =>
          initial.id
            ? revision
              ? api.hiring.reviseOffer(orgId, initial.id, {
                  ...body,
                  expected_version: initial.version,
                  request_id: requestId,
                })
              : api.hiring.patchOffer(orgId, initial.id, {
                  ...body,
                  expected_version: initial.version,
                })
            : api.hiring.createOffer(orgId, {
                ...body,
                application_id: app,
                request_id: requestId,
              }),
        );
        if (value) done(value);
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
      <div className="grid sm:grid-cols-2 gap-3">
        {[
          "title",
          "base_salary",
          "bonus_amount",
          "equity_pct",
          "joining_bonus",
          "currency",
          "start_date",
          "expires_on",
        ].map((k) => (
          <Field
            key={k}
            name={k}
            title={label(k)}
            required={[
              "title",
              "base_salary",
              "currency",
              "start_date",
              "expires_on",
            ].includes(k)}
            type={k.endsWith("date") || k === "expires_on" ? "date" : "text"}
            inputMode={
              [
                "base_salary",
                "bonus_amount",
                "equity_pct",
                "joining_bonus",
              ].includes(k)
                ? "decimal"
                : undefined
            }
            value={form[k]}
            onChange={(e) => change(k, e.target.value)}
            errors={a.fields}
          />
        ))}
        <Select
          name="salary_period"
          value={form.salary_period}
          onChange={(e) => change("salary_period", e.target.value)}
          options={["annual", "monthly"].map((v) => [v, label(v)])}
        />
      </div>
      {terms.map((k) => (
        <Field key={k} name={k}>
          <textarea
            maxLength={2000}
            className={inputClass}
            value={form[k]}
            onChange={(e) => change(k, e.target.value)}
          />
        </Field>
      ))}
      <p className="text-xs">
        Optional offer document: personal private upload, shared only through
        this offer. New revisions require reattaching a document.
      </p>
      {initial.document_available && !revision && (
        <label className="text-xs flex gap-2">
          <input
            type="checkbox"
            checked={removeFile}
            onChange={(e) => setRemoveFile(e.target.checked)}
          />
          Remove existing document
        </label>
      )}
      <FileUploadControl
        kind="document"
        disabled={a.busy}
        onBusyChange={setUploadBusy}
        onReady={setFile}
      />
      <ActionState action={a} />
      <Button
        type="submit"
        disabled={a.busy || uploadBusy || (!initial.id && !app)}
      >
        {revision ? "Create revision" : "Save draft"}
      </Button>
    </form>
  );
}
function OfferRows({ resource, href, staff = false, selected = [], onSelect }) {
  return (
    <>
      <State
        resource={resource}
        empty={!resource.data?.items.length}
        text="No offers in this view."
      />
      <div className="grid md:grid-cols-2 gap-4">
        {resource.data?.items.map((row) => (
          <Card key={row.id} title={row.title}>
            <p className="text-sm font-semibold">
              {staff ? row.applicant_label : row.job_snapshot.company_name}
            </p>
            <p className="text-xs mt-2">
              {money(row.base_salary, row.currency)} /{" "}
              {label(row.salary_period)} · {label(row.status)}
            </p>
            <p className="text-xs mt-2">
              Start {date(row.start_date)} · Expires {date(row.expires_on)}
            </p>
            <div className="flex justify-between items-center mt-4">
              <Link className="text-xs underline" href={href(row)}>
                View offer
              </Link>
              {onSelect && (
                <label className="text-xs flex gap-2">
                  <input
                    type="checkbox"
                    checked={selected.includes(row.id)}
                    disabled={
                      selected.length === 3 && !selected.includes(row.id)
                    }
                    onChange={(e) =>
                      onSelect(
                        e.target.checked
                          ? [...selected, row.id]
                          : selected.filter((id) => id !== row.id),
                      )
                    }
                  />
                  Compare
                </label>
              )}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
export function CandidateOffersPage() {
  return (
    <JobSeekerShell active="Offers" liveData>
      <CandidateOfferList />
    </JobSeekerShell>
  );
}
function CandidateOfferList() {
  const [status, setStatus] = useState(""),
    [offset, setOffset] = useState(0),
    [selected, setSelected] = useState([]);
  const r = useCareerResource(`own-offers:${status}:${offset}`, (signal) =>
    api.hiring.ownOffers(
      { status: status || undefined, limit: 12, offset },
      signal,
    ),
  );
  return (
    <div className="space-y-6 max-w-6xl">
      <Heading
        title="Your offers"
        description="Review actual terms, respond or compare offers."
      >
        {selected.length >= 2 && (
          <Link
            className="text-xs underline"
            href={`/jobseeker/offers/compare?${new URLSearchParams(selected.map((id) => ["offer_ids", id]))}`}
          >
            Compare {selected.length} offers
          </Link>
        )}
      </Heading>
      <Tabs
        value={status}
        onChange={(v) => {
          setStatus(v);
          setOffset(0);
        }}
        values={[
          "",
          "sent",
          "countered",
          "accepted",
          "declined",
          "expired",
          "withdrawn",
        ].map((v) => [v, v ? label(v) : "All"])}
      />
      <OfferRows
        resource={r}
        href={(row) => `/jobseeker/offers/${row.id}`}
        selected={selected}
        onSelect={setSelected}
      />
      <Pager data={r.data} offset={offset} setOffset={setOffset} />
    </div>
  );
}
export function CandidateOfferDetail({ offerId }) {
  return (
    <JobSeekerShell active="Offers" liveData>
      <div className="space-y-6 max-w-6xl">
        <CandidateOffer id={offerId} />
      </div>
    </JobSeekerShell>
  );
}
function CandidateOffer({ id }) {
  const r = useCareerResource(`own-offer:${id}`, (signal) =>
    api.hiring.ownOffer(id, signal),
  );
  const [mode, setMode] = useState(""),
    [note, setNote] = useState(""),
    [consent, setConsent] = useState(false),
    [reason, setReason] = useState("");
  const [reasonOffset, setReasonOffset] = useState(0);
  const reasons = useCareerResource(
    `decline-reasons:${reasonOffset}`,
    (signal) =>
      api.hiring.declineReasons({ limit: 100, offset: reasonOffset }, signal),
  );
  const a = useAction();
  const row = r.data;
  async function act(fn) {
    if (await a.run(fn)) {
      setMode("");
      r.reload();
    }
  }
  return (
    <>
      <Heading
        title={row?.title || "Offer details"}
        description={row?.job_snapshot.company_name}
      >
        <Link className="text-xs underline" href="/jobseeker/offers">
          All offers
        </Link>
      </Heading>
      <State resource={r} />
      <ActionState action={a} />
      {row && (
        <>
          <Card title={label(row.status)}>
            <p className="text-xs">
              Terms version {row.terms_version} · Expires {date(row.expires_on)}
              {row.superseded_at ? " · Superseded — read only" : ""}
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              {["sent", "countered"].includes(row.status) &&
                !row.superseded_at && (
                  <>
                    {["accept", "decline", "counter"].map((v) => (
                      <Button
                        key={v}
                        disabled={
                          a.busy ||
                          (v === "counter" && row.status === "countered")
                        }
                        onClick={() => {
                          setMode(v);
                          setNote("");
                        }}
                      >
                        {label(v)}
                      </Button>
                    ))}
                  </>
                )}
              {row.document_available && (
                <Button
                  onClick={() =>
                    a.run(() => download(() => api.hiring.ownOfferDocument(id)))
                  }
                  disabled={a.busy}
                >
                  Download offer document
                </Button>
              )}
            </div>
            {row.counter_note && (
              <p className="text-xs mt-3 whitespace-pre-wrap">
                Your counter: {row.counter_note}
              </p>
            )}
          </Card>
          <OfferTerms row={row} />
          {mode && (
            <Modal
              title={`${label(mode)} offer`}
              onClose={() => {
                setMode("");
                r.reload();
              }}
            >
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (mode === "counter")
                    act(() =>
                      api.hiring.counterOffer(id, {
                        expected_version: row.version,
                        note,
                      }),
                    );
                  else
                    act(() =>
                      api.hiring.respondOffer(id, {
                        expected_version: row.version,
                        action: mode,
                        ...(mode === "decline"
                          ? {
                              share_decline_reason: consent,
                              decline_reason_id:
                                consent && reason ? reason : null,
                              decline_detail: consent && note ? note : null,
                            }
                          : {}),
                      }),
                    );
                }}
              >
                {mode === "accept" ? (
                  <p className="text-sm">
                    Accept these terms? Read the attached document and
                    contractual terms first.
                  </p>
                ) : mode === "counter" ? (
                  <Field name="note" title="Counter proposal">
                    <textarea
                      className={inputClass}
                      required
                      maxLength={500}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </Field>
                ) : (
                  <>
                    <label className="flex gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={consent}
                        onChange={(e) => setConsent(e.target.checked)}
                      />
                      I explicitly consent to sharing my decline reason with
                      this employer.
                    </label>
                    {consent && (
                      <>
                        <State resource={reasons} />
                        <Select
                          name="decline_reason_id"
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          options={[
                            ["", "No reason"],
                            ...(reasons.data?.items || []).map((x) => [
                              x.id,
                              x.label,
                            ]),
                          ]}
                        />
                        <Pager
                          data={reasons.data}
                          offset={reasonOffset}
                          setOffset={setReasonOffset}
                        />
                        <Field name="decline_detail" title="Optional details">
                          <textarea
                            maxLength={500}
                            className={inputClass}
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                          />
                        </Field>
                      </>
                    )}
                  </>
                )}
                <ActionState action={a} />
                <Button type="submit" disabled={a.busy}>
                  Confirm {mode}
                </Button>
              </form>
            </Modal>
          )}
        </>
      )}
    </>
  );
}
export function CandidateOfferComparison() {
  return (
    <JobSeekerShell active="Offers" liveData>
      <Suspense fallback={<p>Loading comparison…</p>}>
        <OfferComparison />
      </Suspense>
    </JobSeekerShell>
  );
}
function OfferComparison() {
  const params = useSearchParams();
  const ids = params.getAll("offer_ids");
  const valid = ids.length >= 2 && ids.length <= 3;
  const r = useCareerResource(
    `own-offer-comparison:${ids.join(",")}`,
    (signal) =>
      valid
        ? api.hiring.compareOffers({ offer_ids: ids }, signal)
        : Promise.resolve(null),
  );
  return (
    <div className="space-y-6 max-w-6xl">
      <Heading
        title="Compare offers"
        description="Only persisted terms. Equity is not a cash valuation."
      >
        <Link className="underline text-xs" href="/jobseeker/offers">
          Choose offers
        </Link>
      </Heading>
      {!valid ? (
        <p className="text-sm">
          Select two or three offers from your offer list.
        </p>
      ) : (
        <State resource={r} />
      )}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {r.data?.items.map((row) => (
          <div className="space-y-4" key={row.id}>
            <Heading
              title={row.job_snapshot.company_name}
              description={`${row.title} · ${label(row.status)}`}
            />
            <OfferTerms row={row} />
            <Link
              className="underline text-xs"
              href={`/jobseeker/offers/${row.id}`}
            >
              Review and respond
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
