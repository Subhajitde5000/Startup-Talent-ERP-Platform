"use client";
import Link from "next/link";
import { useState } from "react";
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
  inputClass,
  useAction,
  ActionState,
  Modal,
  label,
} from "./hiring-ui";

export function ApplicantScorecard({ jobId, applicationId, locked = false }) {
  const { org } = useJobsWorkspace();
  const [saved, setSaved] = useState(false);
  const r = useCareerResource(
    `scores:${org.id}:${jobId}:${applicationId}`,
    (signal) => api.hiring.scores(org.id, jobId, applicationId, signal),
  );
  return (
    <Card title="Evaluation scorecard">
      {saved && (
        <p role="status" className="text-xs text-[#286749] mb-3">
          Evaluation saved.
        </p>
      )}
      <State resource={r} />
      {r.data && (
        <Ratings
          key={
            r.data.scorecard.id + JSON.stringify(r.data.evaluation.own_scores)
          }
          data={r.data}
          locked={locked}
          save={async (body) => {
            const result = await api.hiring.saveScores(
              org.id,
              jobId,
              applicationId,
              body,
            );
            setSaved(true);
            return result;
          }}
          reload={r.reload}
        />
      )}
    </Card>
  );
}
function Ratings({ data, locked, save, reload }) {
  const action = useAction();
  const [scores, setScores] = useState(
    Object.fromEntries(
      data.evaluation.own_scores.map((x) => [
        x.criterion_id,
        { score: String(x.score), note: x.note || "" },
      ]),
    ),
  );
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const result = await action.run(() =>
          save({
            scores: Object.entries(scores)
              .filter(([, v]) => v.score)
              .map(([criterion_id, v]) => ({
                criterion_id,
                score: Number(v.score),
                note: v.note || null,
              })),
          }),
        );
        if (result) reload();
      }}
    >
      <p className="text-xs">
        Scores 1–5. Notes are private to you. Peer scores are aggregate-only.
      </p>
      {data.scorecard.criteria.map((c) => {
        const value = scores[c.id] || { score: "", note: "" };
        const mean = data.evaluation.aggregates.find(
          (a) => a.criterion_id === c.id,
        );
        return (
          <div key={c.id} className="border-b pb-3 space-y-2">
            <h3 className="text-sm font-semibold">
              {c.name} · weight {c.weight}
            </h3>
            {c.anchors.length > 0 && (
              <p className="text-xs">{c.anchors.join(" · ")}</p>
            )}
            <Select
              name={c.id}
              title="Your rating"
              disabled={locked || action.busy}
              value={value.score}
              onChange={(e) =>
                setScores({
                  ...scores,
                  [c.id]: { ...value, score: e.target.value },
                })
              }
              options={[
                ["", "Not rated"],
                ...[1, 2, 3, 4, 5].map((n) => [String(n), String(n)]),
              ]}
            />
            <Field name="note" title="Your private note">
              <textarea
                maxLength={2000}
                disabled={locked || action.busy}
                className={inputClass}
                value={value.note}
                onChange={(e) =>
                  setScores({
                    ...scores,
                    [c.id]: { ...value, note: e.target.value },
                  })
                }
              />
            </Field>
            <p className="text-xs">
              Mean: {mean?.mean ?? "Not rated"} · {mean?.rating_count || 0}{" "}
              ratings
            </p>
          </div>
        );
      })}
      <p className="text-xs">
        Weighted mean: {data.evaluation.weighted_mean ?? "Not rated"} · Coverage{" "}
        {data.evaluation.coverage_pct}%
      </p>
      <ActionState action={action} />
      {!locked && (
        <Button type="submit" disabled={action.busy}>
          Save my evaluation
        </Button>
      )}
    </form>
  );
}
export function ComparisonPage({ jobId }) {
  return (
    <HiringPage>
      <Comparison jobId={jobId} />
    </HiringPage>
  );
}
function Comparison({ jobId }) {
  const { org, href, canWrite } = useJobsWorkspace();
  const [offset, setOffset] = useState(0),
    [selected, setSelected] = useState([]),
    [template, setTemplate] = useState(""),
    [templateOffset, setTemplateOffset] = useState(0);
  const action = useAction();
  const candidates = useCareerResource(
    `compare-candidates:${org.id}:${jobId}:${offset}`,
    (signal) =>
      api.applicants.list(org.id, jobId, { limit: 20, offset }, signal),
  );
  const templates = useCareerResource(
    `compare-templates:${org.id}:${templateOffset}`,
    (signal) =>
      api.hiring.cards(
        org.id,
        { kind: "templates", limit: 100, offset: templateOffset },
        signal,
      ),
  );
  const job = useCareerResource(`compare-job:${org.id}:${jobId}`, (signal) =>
    api.jobs.get(org.id, jobId, signal),
  );
  const card = useCareerResource(`compare-card:${org.id}:${jobId}`, (signal) =>
    api.hiring.jobCard(org.id, jobId, signal),
  );
  const comparison = useCareerResource(
    `compare:${org.id}:${jobId}:${selected.join(",")}`,
    (signal) =>
      selected.length >= 2
        ? api.hiring.compare(
            org.id,
            jobId,
            { application_ids: selected },
            signal,
          )
        : Promise.resolve(null),
  );
  const canSelect =
    canWrite &&
    job.data &&
    job.data.status !== "closed" &&
    !job.data.deleted_at;
  return (
    <>
      <Heading
        title="Compare candidates"
        description="Evidence-based scorecards. No ATS rank or inferred consensus."
      >
        <Link
          className="text-xs underline"
          href={href(`/employer/jobs/${jobId}?tab=pipeline`)}
        >
          Back to applicants
        </Link>
      </Heading>
      <Card title="Job scorecard">
        <State resource={card} />
        {card.data && (
          <p className="text-sm">
            {card.data.name} · {card.data.criteria.length} criteria{" "}
            {card.data.locked_at ? "· locked after first rating" : ""}
          </p>
        )}
        {canSelect && !card.data?.locked_at && (
          <form
            className="space-y-3 mt-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await action.run(() =>
                  api.hiring.selectCard(org.id, jobId, {
                    template_id: template,
                  }),
                )
              )
                card.reload();
            }}
          >
            <State resource={templates} />
            <Select
              name="template_id"
              title="Select scorecard template"
              required
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              options={[
                ["", "Choose template"],
                ...(templates.data?.items || []).map((c) => [c.id, c.name]),
              ]}
            />
            <Button type="submit" disabled={!template || action.busy}>
              Use template for this job
            </Button>
            <Pager
              data={templates.data}
              offset={templateOffset}
              setOffset={setTemplateOffset}
            />
            <Link
              className="text-xs underline ml-3"
              href={href("/employer/templates?category=scorecards")}
            >
              Manage templates
            </Link>
          </form>
        )}
        <ActionState action={action} />
      </Card>
      <Card title="Select 2–5 candidates">
        <State resource={candidates} empty={!candidates.data?.items.length} />
        <div className="grid sm:grid-cols-2 gap-3">
          {candidates.data?.items.map((c) => (
            <label
              key={c.id}
              className="rounded-xl border p-3 text-xs flex gap-3"
            >
              <input
                type="checkbox"
                checked={selected.includes(c.id)}
                disabled={selected.length === 5 && !selected.includes(c.id)}
                onChange={(e) =>
                  setSelected(
                    e.target.checked
                      ? [...selected, c.id]
                      : selected.filter((id) => id !== c.id),
                  )
                }
              />
              <span>
                {c.label} · {label(c.stage)}
                {c.is_blind ? " · Blind application" : ""}
              </span>
            </label>
          ))}
        </div>
        <Pager data={candidates.data} offset={offset} setOffset={setOffset} />
      </Card>
      <State resource={comparison} />
      {comparison.data && (
        <Card title={comparison.data.scorecard.name}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left p-3">Criterion</th>
                  {comparison.data.items.map((x) => (
                    <th className="p-3" key={x.applicant.id}>
                      {x.applicant.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparison.data.scorecard.criteria.map((c) => (
                  <tr key={c.id}>
                    <td className="p-3">
                      {c.name} (weight {c.weight})
                    </td>
                    {comparison.data.items.map((x) => {
                      const a = x.evaluation.aggregates.find(
                        (a) => a.criterion_id === c.id,
                      );
                      return (
                        <td className="p-3 text-center" key={x.applicant.id}>
                          {a?.mean ?? "Not rated"} · n={a?.rating_count || 0}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {[
                  ["Weighted mean", "weighted_mean"],
                  ["Coverage %", "coverage_pct"],
                ].map(([title, key]) => (
                  <tr key={key}>
                    <td className="p-3">{title}</td>
                    {comparison.data.items.map((x) => (
                      <td className="p-3 text-center" key={x.applicant.id}>
                        {x.evaluation[key] ?? "Not rated"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
export function ScorecardTemplates() {
  const { org, canWrite } = useJobsWorkspace();
  const [offset, setOffset] = useState(0),
    [edit, setEdit] = useState(null);
  const action = useAction();
  const r = useCareerResource(`cards:${org.id}:${offset}`, (signal) =>
    api.hiring.cards(org.id, { kind: "templates", limit: 12, offset }, signal),
  );
  return (
    <>
      <Heading
        title="Scorecard templates"
        description="Reusable weighted criteria and anchored scales."
      >
        {canWrite && (
          <Button
            onClick={() =>
              setEdit({
                name: "",
                criteria: [{ name: "", weight: 1, anchors: [] }],
              })
            }
          >
            New scorecard
          </Button>
        )}
      </Heading>
      <ActionState action={action} />
      <State resource={r} empty={!r.data?.items.length} />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {r.data?.items.map((c) => (
          <Card key={c.id} title={c.name}>
            <p className="text-xs">
              {c.criteria.length} criteria{" "}
              {c.is_platform ? "· Platform template" : ""}
            </p>
            <ul className="text-xs my-3 space-y-1">
              {c.criteria.map((x) => (
                <li key={x.id}>
                  {x.name} · weight {x.weight}
                </li>
              ))}
            </ul>
            {canWrite && !c.is_platform && (
              <div className="flex gap-2">
                <Button small secondary onClick={() => setEdit(c)}>
                  Edit
                </Button>
                <Button
                  small
                  secondary
                  disabled={action.busy}
                  onClick={async () => {
                    if (
                      confirm(
                        "Archive this template? Existing job snapshots are retained.",
                      )
                    ) {
                      await action.run(() =>
                        api.hiring.archiveCard(org.id, c.id),
                      );
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
        <Modal title="Scorecard template" onClose={() => setEdit(null)}>
          <CardEditor
            initial={edit}
            save={(body) =>
              edit.id
                ? api.hiring.patchCard(org.id, edit.id, body)
                : api.hiring.createCard(org.id, body)
            }
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
function CardEditor({ initial, save, done }) {
  const [name, setName] = useState(initial.name),
    [criteria, setCriteria] = useState(
      initial.criteria.map(({ name, weight, anchors }) => ({
        name,
        weight,
        anchors,
      })),
    );
  const a = useAction();
  const patch = (i, k, v) =>
    setCriteria(criteria.map((x, n) => (n === i ? { ...x, [k]: v } : x)));
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await a.run(() => save({ name, criteria }))) done();
      }}
    >
      <Field
        name="name"
        required
        maxLength={200}
        value={name}
        onChange={(e) => setName(e.target.value)}
        errors={a.fields}
      />
      {criteria.map((c, i) => (
        <fieldset className="rounded-xl border p-3 space-y-2" key={i}>
          <Field
            name="criterion"
            title="Criterion"
            required
            maxLength={200}
            value={c.name}
            onChange={(e) => patch(i, "name", e.target.value)}
          />
          <Field
            name="weight"
            type="number"
            min={1}
            max={100}
            required
            value={c.weight}
            onChange={(e) => patch(i, "weight", Number(e.target.value))}
          />
          <Field name="anchors" title="Scale anchors (one per line; up to 5)">
            <textarea
              className={inputClass}
              value={c.anchors.join("\n")}
              onChange={(e) => patch(i, "anchors", e.target.value.split("\n"))}
            />
          </Field>
          <Button
            small
            secondary
            disabled={criteria.length === 1}
            onClick={() => setCriteria(criteria.filter((_, n) => n !== i))}
          >
            Remove criterion
          </Button>
        </fieldset>
      ))}
      <Button
        secondary
        disabled={criteria.length === 20}
        onClick={() =>
          setCriteria([...criteria, { name: "", weight: 1, anchors: [] }])
        }
      >
        Add criterion
      </Button>
      <ActionState action={a} />
      <Button type="submit" disabled={a.busy}>
        Save template
      </Button>
    </form>
  );
}
