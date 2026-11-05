"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Plus, Search } from "lucide-react";
import { useStartupWorkspace } from "@/context/StartupWorkspaceContext";
import { ALL_STARTUP_NAV_ITEMS } from "@/config/startupNavigation";
import {
  DEFAULT_MODULE_WORKSPACE,
  MODULE_WORKSPACES,
  ModuleRecord,
} from "@/config/moduleWorkspaces";
import styles from "./ModuleWorkspace.module.css";

const STATUS_ORDER: ModuleRecord["status"][] = ["Not started", "In progress", "Review", "Done"];

export default function StartupModulePage() {
  const params = useParams<{ module: string }>();
  const slug = params?.module || "idea-validation";
  const { data } = useStartupWorkspace();
  const config = MODULE_WORKSPACES[slug] || DEFAULT_MODULE_WORKSPACE;
  const navItem = ALL_STARTUP_NAV_ITEMS.find((item) => item.id === slug);

  const [records, setRecords] = useState<ModuleRecord[]>(config.records);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [checked, setChecked] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ title: "", detail: "", owner: "" });

  useEffect(() => {
    setRecords(config.records);
    setQuery("");
    setStatusFilter("All statuses");
    setChecked([]);
    setAdding(false);
  }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(
    () =>
      records.filter(
        (record) =>
          (statusFilter === "All statuses" || record.status === statusFilter) &&
          `${record.title} ${record.detail} ${record.owner} ${record.tag}`
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
      ),
    [records, query, statusFilter],
  );

  const moduleTasks = data.tasks.filter((task) => task.moduleHref === `/startup/${slug}`);
  const stats = [
    { label: config.recordLabel, value: String(records.length), hint: "Local demo records" },
    {
      label: "In progress",
      value: String(records.filter((record) => record.status === "In progress").length),
      hint: "Being worked on",
    },
    {
      label: "Completed",
      value: String(records.filter((record) => record.status === "Done").length),
      hint: "Signed off locally",
    },
    ...config.stats.slice(2),
  ];

  const advance = (id: string) => {
    setRecords((current) =>
      current.map((record) => {
        if (record.id !== id) return record;
        const index = STATUS_ORDER.indexOf(record.status);
        return {
          ...record,
          status: STATUS_ORDER[Math.min(index + 1, STATUS_ORDER.length - 1)],
          updated: "Just now",
        };
      }),
    );
  };

  const addRecord = () => {
    if (!draft.title.trim()) return;
    setRecords((current) => [
      {
        id: `local-${Date.now()}`,
        title: draft.title.trim(),
        detail: draft.detail.trim() || "New local demo record.",
        owner: draft.owner.trim() || data.startup.founderName,
        status: "Not started",
        tag: "Added by you",
        updated: "Just now",
      },
      ...current,
    ]);
    setDraft({ title: "", detail: "", owner: "" });
    setAdding(false);
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>{config.eyebrow}</span>
          <h1 className={styles.title}>{navItem?.label || config.title}</h1>
          <p className={styles.purpose}>{config.purpose}</p>
        </div>
        <Link className={styles.backLink} href="/startup/dashboard">
          <ArrowLeft size={15} aria-hidden="true" /> Back to dashboard
        </Link>
      </header>

      <section className={styles.stats} aria-label="Module overview">
        {stats.slice(0, 4).map((stat) => (
          <div className={styles.stat} key={stat.label}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
            <small>{stat.hint}</small>
          </div>
        ))}
      </section>

      <section className={styles.card} aria-labelledby="module-records-heading">
        <div className={styles.cardHeader}>
          <div>
            <h2 id="module-records-heading">{config.recordLabel}</h2>
            <p>Filter, add and move demo records through the workflow.</p>
          </div>
          <button
            className={`${styles.button} ${styles.buttonPrimary}`}
            type="button"
            onClick={() => setAdding((value) => !value)}
          >
            <Plus size={15} aria-hidden="true" /> Add record
          </button>
        </div>
        <div className={styles.toolbar}>
          <label className={styles.search}>
            <Search size={15} aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${config.recordLabel.toLowerCase()}`}
              aria-label={`Search ${config.recordLabel.toLowerCase()}`}
            />
          </label>
          <select
            className={styles.select}
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            aria-label="Filter by status"
          >
            <option>All statuses</option>
            {config.statuses.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>

        {adding && (
          <div className={styles.addForm}>
            <input
              className={styles.input}
              value={draft.title}
              onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))}
              placeholder="Record title"
              aria-label="Record title"
            />
            <input
              className={styles.input}
              value={draft.detail}
              onChange={(event) => setDraft((value) => ({ ...value, detail: event.target.value }))}
              placeholder="Short detail"
              aria-label="Record detail"
            />
            <button
              className={`${styles.button} ${styles.buttonPrimary}`}
              type="button"
              onClick={addRecord}
            >
              Save record
            </button>
          </div>
        )}

        {filtered.length ? (
          <div className={styles.records}>
            {filtered.map((record) => (
              <article className={styles.record} key={record.id}>
                <div className={styles.recordHead}>
                  <strong>{record.title}</strong>
                  <span
                    className={`${styles.badge} ${
                      record.status === "Done"
                        ? styles.badgeDone
                        : record.status === "Review"
                          ? styles.badgeReview
                          : ""
                    }`}
                  >
                    {record.status}
                  </span>
                </div>
                <p>{record.detail}</p>
                <div className={styles.meta}>
                  <span>{record.owner}</span>
                  <span>·</span>
                  <span>{record.tag}</span>
                  <span>·</span>
                  <span>{record.updated}</span>
                </div>
                <div className={styles.recordActions}>
                  <button
                    className={styles.smallButton}
                    type="button"
                    onClick={() => advance(record.id)}
                    disabled={record.status === "Done"}
                  >
                    {record.status === "Done" ? "Completed" : "Advance status"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className={styles.empty}>
            No records match these filters. Try a different search or status.
          </p>
        )}
      </section>

      <div className={styles.twoColumn}>
        <section className={styles.card} aria-labelledby="module-checklist-heading">
          <div className={styles.cardHeader}>
            <div>
              <h2 id="module-checklist-heading">Stage checklist</h2>
              <p>Local progress for this module&apos;s exit criteria.</p>
            </div>
            <span className={styles.badge}>
              {checked.length} / {config.checklist.length} complete
            </span>
          </div>
          <div className={styles.checklist}>
            {config.checklist.map((item) => (
              <label className={styles.checkItem} key={item}>
                <input
                  type="checkbox"
                  checked={checked.includes(item)}
                  onChange={(event) =>
                    setChecked((current) =>
                      event.target.checked
                        ? [...current, item]
                        : current.filter((value) => value !== item),
                    )
                  }
                />
                {item}
              </label>
            ))}
          </div>
        </section>

        <section className={styles.card} aria-labelledby="module-tasks-heading">
          <div className={styles.cardHeader}>
            <div>
              <h2 id="module-tasks-heading">Linked tasks</h2>
              <p>From the shared founder workspace.</p>
            </div>
          </div>
          {moduleTasks.length ? (
            moduleTasks.map((task) => (
              <div className={styles.taskRow} key={task.id}>
                <span>{task.title}</span>
                <small>{task.dueLabel}</small>
              </div>
            ))
          ) : (
            <p className={styles.empty}>
              No tasks are linked to this module yet. Manage all work in the Tasks board.
            </p>
          )}
          <Link className={styles.button} href="/startup/tasks">
            Open Tasks board
          </Link>
        </section>
      </div>

      <p className={styles.demoNote}>
        Illustrative demo data · records you add are kept in this browser session only.
      </p>
    </div>
  );
}
