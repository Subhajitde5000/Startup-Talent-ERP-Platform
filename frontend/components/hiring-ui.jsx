"use client";

import { cloneElement, isValidElement, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  api,
  ApiError,
  browserStorageUrl,
  fileFieldErrors,
} from "@/lib/api/client";
import { useCareerResource } from "@/components/career-data";
import {
  JobsPage,
  JobNotice,
  useJobsWorkspace,
} from "@/components/employer-jobs-workspace";
import { EmployerBtn, EmployerCard } from "@/components";

export {
  api,
  useCareerResource,
  useJobsWorkspace,
  EmployerBtn as Button,
  EmployerCard as Card,
};
export const inputClass =
  "w-full rounded-xl border border-[#E5E1D8] bg-white px-3 py-2 text-xs text-[#0F1B2D] disabled:opacity-50";
export const label = (value) =>
  value
    ? String(value)
        .replaceAll("_", " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
    : "Not provided";
export const date = (value) =>
  value
    ? new Date(
        value.length === 10 ? `${value}T00:00:00` : value,
      ).toLocaleString(
        "en-IN",
        value.length === 10
          ? { dateStyle: "medium" }
          : { dateStyle: "medium", timeStyle: "short" },
      )
    : "Not provided";
export const money = (value, currency = "INR") =>
  value == null
    ? "Not provided"
    : `${currency} ${String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
export const terminal = ["withdrawn", "rejected", "hired"];
export function newKey() {
  return crypto.randomUUID();
}
export function Heading({ title, description, children }) {
  return (
    <header className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm flex flex-wrap justify-between items-center gap-4">
      <div>
        <h1 className="font-serif text-2xl font-bold">{title}</h1>
        {description && (
          <p className="mt-1 text-xs text-[#6B7280]">{description}</p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </header>
  );
}
export function HiringPage({ children }) {
  const path = usePathname();
  return (
    <JobsPage activeNav={path}>
      <HiringGate>{children}</HiringGate>
    </JobsPage>
  );
}
function HiringGate({ children }) {
  const { org } = useJobsWorkspace();
  return org.my_role === "viewer" ? (
    <JobNotice>
      Viewers cannot access applicant, interview, offer or hire records.
    </JobNotice>
  ) : (
    children
  );
}
export function State({ resource, empty = false, text = "No records yet." }) {
  if (resource.loading) return <JobNotice>Loading…</JobNotice>;
  if (resource.error)
    return (
      <JobNotice error retry={resource.reload}>
        {resource.error instanceof ApiError && resource.error.status === 404
          ? "Not found or outside your permitted scope."
          : resource.error.message || "Could not connect."}
      </JobNotice>
    );
  return empty ? <JobNotice>{text}</JobNotice> : null;
}
export function Pager({ data, offset, setOffset }) {
  return data ? (
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs py-3">
      <span>
        {data.total} results ·{" "}
        {data.items.length
          ? `${offset + 1}–${offset + data.items.length}`
          : "0 shown"}
      </span>
      <div className="flex gap-2">
        <EmployerBtn
          small
          secondary
          disabled={offset === 0}
          onClick={() => setOffset(Math.max(0, offset - data.limit))}
        >
          Previous
        </EmployerBtn>
        <EmployerBtn
          small
          secondary
          disabled={!(data.has_more ?? offset + data.items.length < data.total)}
          onClick={() => setOffset(offset + data.limit)}
        >
          Next
        </EmployerBtn>
      </div>
    </div>
  ) : null;
}
export function Tabs({ value, onChange, values }) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-[#E5E1D8] pb-3">
      {values.map(([key, text]) => (
        <button
          type="button"
          key={key}
          aria-pressed={value === key}
          onClick={() => onChange(key)}
          className={`rounded-xl px-4 py-2 text-xs font-semibold ${value === key ? "bg-[#0F1B2D] text-white" : "border border-[#E5E1D8] bg-white"}`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
export function Field({ name, title, errors = {}, children, ...props }) {
  return (
    <label className="block text-xs font-medium space-y-1">
      <span>{title || label(name)}</span>
      {(isValidElement(children)
        ? cloneElement(children, {
            "aria-label": children.props["aria-label"] || title || label(name),
            "aria-invalid": Boolean(errors[name]),
          })
        : children) || (
        <input
          name={name}
          aria-label={title || label(name)}
          aria-invalid={Boolean(errors[name])}
          className={inputClass}
          {...props}
        />
      )}
      {errors[name] && (
        <span role="alert" className="block text-red-800">
          {errors[name]}
        </span>
      )}
    </label>
  );
}
export function Select({
  name,
  title,
  value,
  onChange,
  options,
  errors = {},
  ...props
}) {
  return (
    <Field name={name} title={title} errors={errors}>
      <select
        name={name}
        aria-label={title || label(name)}
        aria-invalid={Boolean(errors[name])}
        className={inputClass}
        value={value}
        onChange={onChange}
        {...props}
      >
        {options.map(([id, text]) => (
          <option key={id} value={id}>
            {text}
          </option>
        ))}
      </select>
    </Field>
  );
}
export function useAction() {
  const lock = useRef(false);
  const [state, setState] = useState({
    busy: false,
    error: "",
    message: "",
    fields: {},
  });
  return {
    ...state,
    run: async (fn, success) => {
      if (lock.current) return;
      lock.current = true;
      setState({ busy: true, error: "", message: "", fields: {} });
      try {
        const value = await fn();
        setState({
          busy: false,
          error: "",
          fields: {},
          message: success || "Saved.",
        });
        return value;
      } catch (e) {
        setState({
          busy: false,
          error: e.message || "Could not save.",
          message: "",
          fields: fileFieldErrors(e),
        });
      } finally {
        lock.current = false;
      }
    },
  };
}
export function ActionState({ action }) {
  return (
    <>
      {action.error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800"
        >
          {action.error}
          {Object.entries(action.fields).map(([key, value]) => (
            <p key={key}>
              {label(key)}: {value}
            </p>
          ))}
        </div>
      )}
      {action.message && (
        <p role="status" className="text-xs text-[#286749]">
          {action.message}
        </p>
      )}
    </>
  );
}
export function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 space-y-4"
      >
        <div className="flex justify-between">
          <h2 className="font-serif text-xl font-bold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close dialog">
            ✕
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
export async function download(fn) {
  const result = await fn();
  window.open(browserStorageUrl(result.url), "_blank", "noopener,noreferrer");
}
export function Members({
  value,
  onChange,
  multiple = false,
  managers = false,
  title = "Owner",
  disabled = false,
}) {
  const { org } = useJobsWorkspace();
  const [offset, setOffset] = useState(0);
  const r = useCareerResource(
    `workflow-members:${org.id}:${offset}`,
    (signal) =>
      api.organizations.members(
        org.id,
        { status: "active", limit: 100, offset },
        signal,
      ),
  );
  const rows = (r.data?.items || []).filter(
    (x) =>
      !["viewer"].includes(x.role) &&
      (!managers || ["owner", "admin"].includes(x.role)),
  );
  return (
    <div className="space-y-1">
      <State resource={r} />
      <Field title={title} name="member">
        <select
          aria-label={title}
          multiple={multiple}
          disabled={disabled || r.loading}
          className={inputClass}
          value={value}
          onChange={onChange}
        >
          <option value="">
            {multiple ? "Select one or more" : "Unassigned"}
          </option>
          {rows.map((x) => (
            <option key={x.user_id} value={x.user_id}>
              {x.display_name || x.email || x.user_id} · {x.role}
            </option>
          ))}
        </select>
      </Field>
      {r.data && <Pager data={r.data} offset={offset} setOffset={setOffset} />}
    </div>
  );
}
export function ApplicationPicker({ value, onChange, jobValue, onJobChange }) {
  const { org } = useJobsWorkspace();
  const [jobsOffset, setJobsOffset] = useState(0),
    [appsOffset, setAppsOffset] = useState(0);
  const jobs = useCareerResource(
    `workflow-jobs:${org.id}:${jobsOffset}`,
    (signal) =>
      api.jobs.list(org.id, { limit: 100, offset: jobsOffset }, signal),
  );
  const applications = useCareerResource(
    `workflow-apps:${org.id}:${jobValue}:${appsOffset}`,
    (signal) =>
      jobValue
        ? api.applicants.list(
            org.id,
            jobValue,
            { limit: 100, offset: appsOffset },
            signal,
          )
        : Promise.resolve({
            items: [],
            total: 0,
            has_more: false,
            limit: 100,
            offset: 0,
          }),
  );
  return (
    <div className="space-y-3">
      <State resource={jobs} />
      <Select
        title="Job"
        name="job_id"
        value={jobValue}
        onChange={(e) => {
          onJobChange(e.target.value);
          onChange("");
          setAppsOffset(0);
        }}
        options={[
          ["", "Select job"],
          ...(jobs.data?.items || []).map((x) => [x.id, x.title]),
        ]}
      />
      {jobs.data && (
        <Pager data={jobs.data} offset={jobsOffset} setOffset={setJobsOffset} />
      )}
      <State resource={applications} />
      <Select
        name="application_id"
        title="Applicant"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        options={[
          ["", "Select applicant"],
          ...(applications.data?.items || [])
            .filter((x) => !terminal.includes(x.stage))
            .map((x) => [x.id, `${x.label} · ${label(x.stage)}`]),
        ]}
      />
      {applications.data && jobValue && (
        <Pager
          data={applications.data}
          offset={appsOffset}
          setOffset={setAppsOffset}
        />
      )}
    </div>
  );
}
