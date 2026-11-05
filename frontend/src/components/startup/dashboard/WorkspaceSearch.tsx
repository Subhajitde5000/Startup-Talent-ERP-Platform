"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useStartupWorkspace } from "@/context/StartupWorkspaceContext";
import { ALL_STARTUP_NAV_ITEMS } from "@/config/startupNavigation";
import styles from "./WorkspaceSearch.module.css";

type Result = {
  id: string;
  group: string;
  title: string;
  detail: string;
  href: string;
};

const MAX_RESULTS = 8;

/** Dashboard search / command palette. Opens with ⌘K or Ctrl+K, closes with Escape. */
export function WorkspaceSearch() {
  const router = useRouter();
  const { data } = useStartupWorkspace();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const results = useMemo<Result[]>(() => {
    const all: Result[] = [
      ...ALL_STARTUP_NAV_ITEMS.map((item) => ({
        id: `page-${item.id}`,
        group: "Pages",
        title: item.label,
        detail: item.description,
        href: item.href,
      })),
      ...data.tasks.map((task) => ({
        id: `task-${task.id}`,
        group: "Tasks",
        title: task.title,
        detail: `${task.status} · ${task.owner || "Unassigned"} · ${task.dueLabel}`,
        href: "/startup/tasks",
      })),
      ...data.team.map((member) => ({
        id: `team-${member.id}`,
        group: "Team",
        title: member.name,
        detail: `${member.role} · ${member.permission}`,
        href: "/startup/team",
      })),
      ...data.documents.map((doc) => ({
        id: `doc-${doc.id}`,
        group: "Documents",
        title: doc.title,
        detail: `${doc.folder} · updated ${doc.updatedAt}`,
        href: "/startup/data-room",
      })),
      ...data.stages.map((stage) => ({
        id: `stage-${stage.id}`,
        group: "Stages",
        title: `${stage.label} toolkit`,
        detail: `${stage.exitCriteria.length} exit criteria`,
        href: `/startup/stage/${stage.id}`,
      })),
    ];
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return all.filter((item) => item.group === "Pages").slice(0, MAX_RESULTS);
    }
    return all
      .filter((item) => `${item.title} ${item.detail} ${item.group}`.toLowerCase().includes(needle))
      .slice(0, MAX_RESULTS);
  }, [query, data.tasks, data.team, data.documents, data.stages]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (event.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => setHighlight(0), [query]);

  const go = (result: Result) => {
    setOpen(false);
    setQuery("");
    router.push(result.href);
  };

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setHighlight((value) => (value + 1) % Math.max(1, results.length));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight(
        (value) => (value - 1 + Math.max(1, results.length)) % Math.max(1, results.length),
      );
    } else if (event.key === "Enter" && results[highlight]) {
      event.preventDefault();
      go(results[highlight]);
    }
  };

  const groups = results.reduce<Record<string, Result[]>>((acc, item) => {
    (acc[item.group] ||= []).push(item);
    return acc;
  }, {});

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <div className={styles.box}>
        <Search size={16} aria-hidden="true" />
        <input
          ref={inputRef}
          className={styles.input}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onInputKeyDown}
          placeholder="Search tasks, people, files…"
          aria-label="Search workspace"
          role="combobox"
          aria-expanded={open}
          aria-controls="workspace-search-results"
          aria-autocomplete="list"
        />
        <kbd className={styles.kbd}>⌘ K</kbd>
      </div>
      {open && (
        <div className={styles.panel} id="workspace-search-results" role="listbox">
          {results.length ? (
            Object.entries(groups).map(([group, items]) => (
              <div key={group}>
                <div className={styles.groupLabel}>{group}</div>
                {items.map((item) => {
                  const index = results.findIndex((result) => result.id === item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="option"
                      aria-selected={index === highlight}
                      className={`${styles.result} ${index === highlight ? styles.resultActive : ""}`}
                      onMouseEnter={() => setHighlight(index)}
                      onClick={() => go(item)}
                    >
                      <span className={styles.resultIcon}>
                        <Search size={14} aria-hidden="true" />
                      </span>
                      <span>
                        <strong>{item.title}</strong>
                        <small>{item.detail}</small>
                      </span>
                    </button>
                  );
                })}
              </div>
            ))
          ) : (
            <p className={styles.empty}>No workspace matches for “{query}”.</p>
          )}
        </div>
      )}
    </div>
  );
}
