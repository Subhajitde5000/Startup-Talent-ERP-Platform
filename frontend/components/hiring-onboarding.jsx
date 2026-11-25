"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import FileUploadControl from "@/components/files/FileUploadControl";
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
  Tabs,
  inputClass,
  useAction,
  ActionState,
  Modal,
  label,
  date,
  newKey,
  download,
} from "./hiring-ui";
export function EmployerHiresPage() {
  return (
    <HiringPage>
      <Hires />
    </HiringPage>
  );
}
function Hires() {
  const { org, href } = useJobsWorkspace();
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState(""),
    [offset, setOffset] = useState(0),
    [create, setCreate] = useState(Boolean(params.get("offer_id")));
  const r = useCareerResource(`hires:${org.id}:${status}:${offset}`, (signal) =>
    api.hiring.hires(
      org.id,
      { status: status || undefined, limit: 12, offset },
      signal,
    ),
  );
  return (
    <>
      <Heading
        title="Hires & onboarding"
        description="Accepted offers become accountable onboarding records."
      >
        <Button onClick={() => setCreate(true)}>Add hire</Button>
        <Link
          className="text-xs underline"
          href={href("/employer/templates?category=onboarding")}
        >
          Onboarding templates
        </Link>
      </Heading>
      <Tabs
        value={status}
        onChange={(v) => {
          setStatus(v);
          setOffset(0);
        }}
        values={[
          "",
          "pending_onboarding",
          "onboarding",
          "active",
          "no_show",
          "cancelled",
        ].map((v) => [v, v ? label(v) : "All"])}
      />
      <State resource={r} empty={!r.data?.items.length} />
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {r.data?.items.map((row) => (
          <Card title={row.applicant_label} key={row.id}>
            <div className="text-xs space-y-2">
              <p>
                {row.job_title} · {label(row.department)}
              </p>
              <p>
                {label(row.status)} · Starts {date(row.start_date)}
              </p>
              <p>
                {row.completed_items} / {row.total_items} checklist items
                completed or waived
              </p>
              <Link
                className="inline-block underline pt-3"
                href={href(`/employer/hires/${row.id}`)}
              >
                Open onboarding
              </Link>
            </div>
          </Card>
        ))}
      </div>
      <Pager data={r.data} offset={offset} setOffset={setOffset} />
      {create && (
        <Modal title="Create hire" onClose={() => setCreate(false)}>
          <HireCreate
            initialOffer={params.get("offer_id") || ""}
            done={(row) => router.push(href(`/employer/hires/${row.id}`))}
          />
        </Modal>
      )}
    </>
  );
}
function HireCreate({ initialOffer, done }) {
  const { org } = useJobsWorkspace();
  const [offer, setOffer] = useState(initialOffer),
    [template, setTemplate] = useState(""),
    [owner, setOwner] = useState(""),
    [manager, setManager] = useState(""),
    [department, setDepartment] = useState(""),
    [offset, setOffset] = useState(0),
    [templateOffset, setTemplateOffset] = useState(0);
  const r = useCareerResource(`accepted-offers:${org.id}:${offset}`, (signal) =>
    api.hiring.offers(
      org.id,
      { status: "accepted", limit: 50, offset },
      signal,
    ),
  );
  const templates = useCareerResource(
    `hire-templates:${org.id}:${templateOffset}`,
    (signal) =>
      api.hiring.templates(
        org.id,
        { limit: 50, offset: templateOffset },
        signal,
      ),
  );
  const a = useAction();
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const value = await a.run(() =>
          api.hiring.createHire(org.id, {
            offer_id: offer,
            template_id: template || null,
            owner_id: owner || null,
            manager_id: manager || null,
            department: department || null,
          }),
        );
        if (value) done(value);
      }}
    >
      <State resource={r} />
      <Select
        name="offer_id"
        title="Accepted offer"
        required
        value={offer}
        onChange={(e) => setOffer(e.target.value)}
        options={[
          ["", "Select accepted offer"],
          ...(initialOffer && !r.data?.items.some((x) => x.id === initialOffer)
            ? [[initialOffer, "Selected accepted offer"]]
            : []),
          ...(r.data?.items || []).map((x) => [
            x.id,
            `${x.applicant_label} · ${x.title}`,
          ]),
        ]}
      />
      <Pager data={r.data} offset={offset} setOffset={setOffset} />
      <State resource={templates} />
      <Select
        name="template_id"
        title="Copy onboarding template"
        value={template}
        onChange={(e) => setTemplate(e.target.value)}
        options={[
          ["", "No template (empty checklist)"],
          ...(templates.data?.items || []).map((x) => [x.id, x.name]),
        ]}
      />
      <Pager
        data={templates.data}
        offset={templateOffset}
        setOffset={setTemplateOffset}
      />
      <Select
        name="department"
        value={department}
        onChange={(e) => setDepartment(e.target.value)}
        options={[
          ["", "Not provided"],
          ...[
            "engineering",
            "product",
            "design",
            "sales",
            "marketing",
            "operations",
            "finance",
            "people",
            "legal",
            "support",
            "other",
          ].map((v) => [v, label(v)]),
        ]}
      />
      <Members
        title="Hire owner (defaults to you)"
        value={owner}
        onChange={(e) => setOwner(e.target.value)}
      />
      <Members
        title="Manager"
        value={manager}
        onChange={(e) => setManager(e.target.value)}
      />
      <p className="text-xs">
        Copied owners and due dates are snapshots; later changes to this
        template do not alter existing hires.
      </p>
      <ActionState action={a} />
      <Button type="submit" disabled={a.busy || !offer}>
        Create onboarding record
      </Button>
    </form>
  );
}
export function EmployerHireDetail({ hireId }) {
  return (
    <HiringPage>
      <HireDetail id={hireId} />
    </HiringPage>
  );
}
function HireDetail({ id }) {
  const { org, href } = useJobsWorkspace();
  const r = useCareerResource(`hire:${org.id}:${id}`, (signal) =>
    api.hiring.hire(org.id, id, signal),
  );
  const [edit, setEdit] = useState(false);
  const a = useAction();
  const row = r.data;
  return (
    <>
      <Heading
        title={row?.applicant_label || "Hire details"}
        description={row?.job_title}
      >
        <Link className="text-xs underline" href={href("/employer/hires")}>
          All hires
        </Link>
        <Button small secondary onClick={r.reload}>
          Refresh record
        </Button>
      </Heading>
      <State resource={r} />
      <ActionState action={a} />
      {row && (
        <>
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card title="Onboarding overview">
                <dl className="text-xs grid grid-cols-2 gap-4">
                  {[
                    ["Status", label(row.status)],
                    ["Start date", date(row.start_date)],
                    ["Department", label(row.department)],
                    [
                      "Checklist",
                      `${row.completed_items} / ${row.total_items} complete or waived`,
                    ],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-[#6B7280]">{k}</dt>
                      <dd className="mt-1 font-semibold">{v}</dd>
                    </div>
                  ))}
                </dl>
                {row.can_edit && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    <Button onClick={() => setEdit(true)}>Edit hire</Button>
                    {(row.status === "pending_onboarding"
                      ? ["onboard", "no_show", "cancel"]
                      : ["activate", "no_show", "cancel"]
                    ).map((action) => (
                      <Button
                        key={action}
                        disabled={
                          a.busy ||
                          (["activate", "no_show"].includes(action) &&
                            row.start_date >
                              new Date().toISOString().slice(0, 10))
                        }
                        onClick={async () => {
                          if (confirm(`${label(action)} this hire?`)) {
                            if (
                              await a.run(() =>
                                api.hiring.hireTransition(org.id, id, {
                                  expected_version: row.version,
                                  action,
                                }),
                              )
                            )
                              r.reload();
                          }
                        }}
                      >
                        {label(action)}
                      </Button>
                    ))}
                  </div>
                )}
              </Card>
              <Checklist hire={row} changed={r.reload} />
            </div>
            <div className="space-y-6">
              {row.can_access_documents ? (
                <Documents hire={row} />
              ) : (
                <Card title="Documents">
                  <p className="text-xs">
                    Private documents are restricted to organization managers,
                    the hire owner and assigned manager.
                  </p>
                </Card>
              )}
              <Card title="Related records">
                <div className="text-xs space-y-3">
                  <Link
                    className="underline block"
                    href={href(`/employer/offers/${row.offer_id}`)}
                  >
                    Accepted offer
                  </Link>
                  <Link
                    className="underline block"
                    href={href(
                      `/employer/jobs/${row.job_id}/applicants/${row.application_id}`,
                    )}
                  >
                    Application
                  </Link>
                </div>
              </Card>
            </div>
          </div>
          {edit && (
            <Modal
              title="Edit hire"
              onClose={() => {
                setEdit(false);
                r.reload();
              }}
            >
              <HireEdit
                hire={row}
                done={() => {
                  setEdit(false);
                  r.reload();
                }}
              />
            </Modal>
          )}
        </>
      )}
    </>
  );
}
function HireEdit({ hire, done }) {
  const { org } = useJobsWorkspace();
  const [start, setStart] = useState(hire.start_date),
    [owner, setOwner] = useState(hire.owner_id || ""),
    [manager, setManager] = useState(hire.manager_id || "");
  const a = useAction();
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (
          await a.run(() =>
            api.hiring.patchHire(org.id, hire.id, {
              expected_version: hire.version,
              start_date: start,
              owner_id: owner || null,
              manager_id: manager || null,
            }),
          )
        )
          done();
      }}
    >
      <Field
        name="start_date"
        type="date"
        required
        value={start}
        onChange={(e) => setStart(e.target.value)}
      />
      <Members
        title="Hire owner"
        value={owner}
        onChange={(e) => setOwner(e.target.value)}
      />
      <Members
        title="Manager"
        value={manager}
        onChange={(e) => setManager(e.target.value)}
      />
      <p className="text-xs">
        Existing checklist due dates and assignees do not change automatically.
      </p>
      <ActionState action={a} />
      <Button type="submit" disabled={a.busy}>
        Save hire
      </Button>
    </form>
  );
}
function Checklist({ hire, changed }) {
  const { org, user } = useJobsWorkspace();
  const [offset, setOffset] = useState(0),
    [edit, setEdit] = useState(null);
  const r = useCareerResource(
    `hire-tasks:${org.id}:${hire.id}:${offset}`,
    (signal) =>
      api.hiring.tasks(org.id, hire.id, { limit: 20, offset }, signal),
  );
  const writable = !["active", "no_show", "cancelled"].includes(hire.status);
  return (
    <Card title="Onboarding checklist">
      <State
        resource={r}
        empty={!r.data?.items.length}
        text="No checklist items visible. Tasks are copied from a template when creating the hire."
      />
      <div className="divide-y">
        {r.data?.items.map((item) => (
          <div
            key={item.id}
            className="flex justify-between gap-3 py-3 text-xs"
          >
            <div>
              <p className="font-semibold">{item.title}</p>
              <p className="mt-1">
                {item.section} · {label(item.status)} · Due {date(item.due_on)}
              </p>
              {item.note && (
                <p className="mt-1 whitespace-pre-wrap">{item.note}</p>
              )}
            </div>
            {writable &&
              (hire.can_manage_tasks || item.owner_id === user.id) && (
                <Button small onClick={() => setEdit(item)}>
                  Update
                </Button>
              )}
          </div>
        ))}
      </div>
      <Pager data={r.data} offset={offset} setOffset={setOffset} />
      {edit && (
        <Modal
          title="Update checklist item"
          onClose={() => {
            setEdit(null);
            r.reload();
          }}
        >
          <TaskEdit
            hire={hire}
            item={edit}
            done={() => {
              setEdit(null);
              r.reload();
              changed();
            }}
          />
        </Modal>
      )}
    </Card>
  );
}
function TaskEdit({ hire, item, done }) {
  const { org } = useJobsWorkspace();
  const [status, setStatus] = useState(item.status),
    [note, setNote] = useState(item.note || ""),
    [owner, setOwner] = useState(item.owner_id || ""),
    [due, setDue] = useState(item.due_on);
  const a = useAction();
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (
          await a.run(() =>
            api.hiring.saveTask(org.id, hire.id, item.id, {
              expected_version: item.version,
              status,
              note: note || null,
              ...(hire.can_manage_tasks
                ? { owner_id: owner || null, due_on: due }
                : {}),
            }),
          )
        )
          done();
      }}
    >
      <Select
        name="status"
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        options={[
          "pending",
          "in_progress",
          "done",
          "blocked",
          ...(hire.can_manage_tasks ? ["waived"] : []),
        ].map((v) => [v, label(v)])}
      />
      <Field name="note">
        <textarea
          maxLength={2000}
          className={inputClass}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
      {hire.can_manage_tasks && (
        <>
          <Members
            title="Task owner"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
          />
          <Field
            name="due_on"
            type="date"
            required
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
        </>
      )}
      <ActionState action={a} />
      <Button type="submit" disabled={a.busy}>
        Save task
      </Button>
    </form>
  );
}
function Documents({ hire }) {
  const { org } = useJobsWorkspace();
  const [offset, setOffset] = useState(0),
    [create, setCreate] = useState(false);
  const r = useCareerResource(
    `hire-docs:${org.id}:${hire.id}:${offset}`,
    (signal) =>
      api.hiring.documents(org.id, hire.id, { limit: 10, offset }, signal),
  );
  const writable = !["active", "no_show", "cancelled"].includes(hire.status);
  return (
    <Card title="Private documents">
      <State resource={r} empty={!r.data?.items.length} />
      {r.data?.items.map((row) => (
        <Document
          key={row.id + ":" + row.version}
          row={row}
          hire={hire}
          writable={writable}
          changed={r.reload}
        />
      ))}
      <Pager data={r.data} offset={offset} setOffset={setOffset} />
      {writable && (
        <Button small onClick={() => setCreate(true)}>
          Request document
        </Button>
      )}
      {create && (
        <Modal title="Request document" onClose={() => setCreate(false)}>
          <DocumentCreate
            hire={hire}
            done={() => {
              setCreate(false);
              r.reload();
            }}
          />
        </Modal>
      )}
    </Card>
  );
}
function DocumentCreate({ hire, done }) {
  const { org } = useJobsWorkspace();
  const [name, setName] = useState(""),
    [purpose, setPurpose] = useState(""),
    [retention, setRetention] = useState(""),
    [due, setDue] = useState(""),
    [requestId] = useState(newKey);
  const a = useAction();
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (
          await a.run(() =>
            api.hiring.requestDocument(org.id, hire.id, {
              request_id: requestId,
              name,
              purpose,
              retention,
              due_on: due || null,
            }),
          )
        )
          done();
      }}
    >
      {[
        ["name", name, setName, 200],
        ["purpose", purpose, setPurpose, 1000],
        ["retention", retention, setRetention, 1000],
      ].map(([k, v, set, max]) => (
        <Field
          key={k}
          name={k}
          required
          maxLength={max}
          value={v}
          onChange={(e) => set(e.target.value)}
        />
      ))}
      <Field
        name="due_on"
        type="date"
        value={due}
        onChange={(e) => setDue(e.target.value)}
      />
      <p className="text-xs">
        State a specific purpose and retention policy. Collect only necessary
        personal information.
      </p>
      <ActionState action={a} />
      <Button type="submit" disabled={a.busy}>
        Request
      </Button>
    </form>
  );
}
function Document({ row, hire, writable, changed }) {
  const { org } = useJobsWorkspace();
  const [reason, setReason] = useState("");
  const a = useAction();
  async function review(action, file_id) {
    const value = await api.hiring.reviewDocument(org.id, hire.id, row.id, {
      expected_version: row.version,
      action,
      ...(file_id ? { file_id } : {}),
      ...(action === "reject" ? { reason } : {}),
    });
    changed();
    return value;
  }
  return (
    <div className="border-b py-4 text-xs space-y-2">
      <h3 className="font-semibold">
        {row.name} · {label(row.status)}
      </h3>
      <p>Purpose: {row.purpose}</p>
      <p>Retention: {row.retention}</p>
      <p>Due: {date(row.due_on)}</p>
      {row.review_reason && <p>Review: {row.review_reason}</p>}
      {writable && ["requested", "rejected"].includes(row.status) && (
        <FileUploadControl
          kind="document"
          onReady={(file) => review("attach", file.id)}
        />
      )}
      <div className="flex flex-wrap gap-2">
        {["received", "verified"].includes(row.status) && (
          <Button
            small
            disabled={a.busy}
            onClick={() =>
              a.run(() =>
                download(() =>
                  api.hiring.hireDocument(org.id, hire.id, row.id),
                ),
              )
            }
          >
            Download
          </Button>
        )}
        {writable && row.status === "received" && (
          <Button
            small
            disabled={a.busy}
            onClick={() => a.run(() => review("verify"))}
          >
            Verify
          </Button>
        )}
        {writable && row.status !== "expired" && (
          <Button
            small
            disabled={a.busy}
            onClick={() => a.run(() => review("expire"))}
          >
            Expire
          </Button>
        )}
      </div>
      {writable && row.status === "received" && (
        <form
          className="flex flex-wrap gap-2 items-end"
          onSubmit={(e) => {
            e.preventDefault();
            a.run(() => review("reject"));
          }}
        >
          <Field
            name="reason"
            title="Rejection reason"
            required
            maxLength={1000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <Button small type="submit" disabled={a.busy}>
            Reject document
          </Button>
        </form>
      )}
      <ActionState action={a} />
    </div>
  );
}
export function OnboardingTemplates() {
  const { org, canWrite } = useJobsWorkspace();
  const [offset, setOffset] = useState(0),
    [edit, setEdit] = useState(null);
  const r = useCareerResource(
    `onboarding-templates:${org.id}:${offset}`,
    (signal) => api.hiring.templates(org.id, { limit: 12, offset }, signal),
  );
  const a = useAction();
  return (
    <>
      <Heading
        title="Onboarding templates"
        description="Reusable checklist sections, owners and relative due dates."
      >
        {canWrite && (
          <Button onClick={() => setEdit({ name: "", items: [] })}>
            New onboarding template
          </Button>
        )}
      </Heading>
      <ActionState action={a} />
      <State resource={r} empty={!r.data?.items.length} />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {r.data?.items.map((row) => (
          <Card key={row.id} title={row.name}>
            <p className="text-xs">{row.items.length} checklist items</p>
            <ul className="text-xs space-y-2 my-3">
              {row.items.map((item) => (
                <li key={item.id}>
                  {item.section}: {item.title} · day {item.due_offset_days}
                </li>
              ))}
            </ul>
            {canWrite && (
              <div className="flex gap-2">
                <Button small onClick={() => setEdit(row)}>
                  Edit
                </Button>
                <Button
                  small
                  disabled={a.busy}
                  onClick={async () => {
                    if (
                      confirm(
                        "Archive template? Existing hire checklists remain unchanged.",
                      )
                    ) {
                      await a.run(async () => {
                        await api.hiring.archiveTemplate(org.id, row.id);
                        return true;
                      });
                      r.reload();
                    }
                  }}
                >
                  Archive
                </Button>
              </div>
            )}
          </Card>
        ))}
      </div>
      <Pager data={r.data} offset={offset} setOffset={setOffset} />
      {edit && (
        <Modal
          title="Onboarding template"
          onClose={() => {
            setEdit(null);
            r.reload();
          }}
        >
          <TemplateEditor
            initial={edit}
            done={() => {
              setEdit(null);
              r.reload();
            }}
          />
        </Modal>
      )}
    </>
  );
}
function TemplateEditor({ initial, done }) {
  const { org } = useJobsWorkspace();
  const [name, setName] = useState(initial.name),
    [items, setItems] = useState(
      initial.items.map(({ section, title, owner_role, due_offset_days }) => ({
        section,
        title,
        owner_role,
        due_offset_days,
      })),
    );
  const a = useAction();
  const patch = (i, k, v) =>
    setItems(items.map((x, n) => (n === i ? { ...x, [k]: v } : x)));
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (
          await a.run(() =>
            initial.id
              ? api.hiring.saveTemplate(org.id, initial.id, { name, items })
              : api.hiring.createTemplate(org.id, { name, items }),
          )
        )
          done();
      }}
    >
      <Field
        name="name"
        required
        maxLength={200}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      {items.map((item, i) => (
        <fieldset key={i} className="rounded-xl border p-3 space-y-2">
          <Field
            name="section"
            required
            maxLength={100}
            value={item.section}
            onChange={(e) => patch(i, "section", e.target.value)}
          />
          <Field
            name="title"
            required
            maxLength={200}
            value={item.title}
            onChange={(e) => patch(i, "title", e.target.value)}
          />
          <Select
            name="owner_role"
            value={item.owner_role || ""}
            onChange={(e) => patch(i, "owner_role", e.target.value || null)}
            options={[
              ["", "Unassigned"],
              ["owner", "Hire owner"],
              ["manager", "Hire manager"],
            ]}
          />
          <Field
            name="due_offset_days"
            title="Days relative to start date"
            type="number"
            min={-365}
            max={365}
            required
            value={item.due_offset_days}
            onChange={(e) =>
              patch(i, "due_offset_days", Number(e.target.value))
            }
          />
          <Button
            small
            onClick={() => setItems(items.filter((_, n) => i !== n))}
          >
            Remove item
          </Button>
        </fieldset>
      ))}
      <Button
        disabled={items.length >= 50}
        onClick={() =>
          setItems([
            ...items,
            { section: "", title: "", owner_role: null, due_offset_days: 0 },
          ])
        }
      >
        Add checklist item
      </Button>
      <ActionState action={a} />
      <Button type="submit" disabled={a.busy}>
        Save template
      </Button>
    </form>
  );
}
