"use client";

import { initials } from "@/utils/formatters";
import React, { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowDownWideNarrow,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  Columns3,
  Download,
  ExternalLink,
  FileText,
  Filter,
  Flag,
  Link2,
  List,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Plus,
  Search,
  Send,
  Sparkles,
  Target,
  Trash2,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { useStartupWorkspace } from "@/context/StartupWorkspaceContext";
import { StartupStageId, StartupTaskItem, TaskPriority, TaskStatus } from "@/types/startup";
import styles from "./StartupTasks.module.css";

type TaskView = "board" | "list" | "milestones" | "calendar";
type BoardStatus = "pending" | "in-progress" | "in-review" | "completed";
type DueFilter = "all" | "overdue" | "today" | "week" | "no-date";
type GroupMode = "none" | "status" | "assignee" | "due" | "milestone" | "criterion";
const COLUMNS: Array<{ id: BoardStatus; label: string }> = [
  { id: "pending", label: "To do" },
  { id: "in-progress", label: "In progress" },
  { id: "in-review", label: "In review" },
  { id: "completed", label: "Done" },
];
const PRIORITIES: TaskPriority[] = ["Low", "Medium", "High", "Urgent"];
const VIEWS: Array<{ id: TaskView; label: string; icon: React.ReactNode }> = [
  { id: "board", label: "Board", icon: <Columns3 size={15} /> },
  { id: "list", label: "List", icon: <List size={15} /> },
  { id: "milestones", label: "Milestones", icon: <Flag size={15} /> },
  { id: "calendar", label: "Calendar", icon: <CalendarDays size={15} /> },
];
const TEMPLATES = [
  {
    title: "Run 10 customer interviews",
    moduleLabel: "Customer Research",
    moduleHref: "/startup/customer-research",
    linkedCriterionId: "idea-interviews",
    priority: "High" as TaskPriority,
    labels: ["Discovery"],
  },
  {
    title: "Write the problem statement",
    moduleLabel: "Idea Validation",
    moduleHref: "/startup/idea-validation",
    linkedCriterionId: "idea-problem",
    priority: "Medium" as TaskPriority,
    labels: ["Validation"],
  },
  {
    title: "Review the MVP scope with your mentor",
    moduleLabel: "Projects & Sprints",
    moduleHref: "/startup/projects",
    linkedCriterionId: "prototype-scope",
    priority: "Medium" as TaskPriority,
    labels: ["Mentor review"],
    mentorDeliverable: true,
  },
];
const STAGE_NAMES: Record<StartupStageId, string> = {
  idea: "Idea",
  prototype: "Prototype",
  "early-revenue": "Early Revenue",
  mature: "Mature",
};
const STAGE_HREFS: Record<StartupStageId, string> = {
  idea: "/startup/stage/idea",
  prototype: "/startup/stage/prototype",
  "early-revenue": "/startup/stage/early-revenue",
  mature: "/startup/stage/mature",
};

function parseDate(task: StartupTaskItem): Date | null {
  if (task.dueDate) {
    const date = new Date(`${task.dueDate}T12:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const match = task.dueLabel.match(/(?:Due|Overdue).*?([A-Za-z]{3,9})\s+(\d{1,2})/i);
  if (!match) return null;
  const date = new Date(`${match[1]} ${match[2]}, ${new Date().getFullYear()} 12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}
function isoToday(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}
function dayDiff(date: Date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}
function workflowStatus(task: StartupTaskItem): BoardStatus {
  if (task.status === "completed") return "completed";
  if (task.status === "in-progress" || task.status === "in-review") return task.status;
  return "pending";
}
function isOverdue(task: StartupTaskItem) {
  const date = parseDate(task);
  return (
    task.status !== "completed" && (task.status === "overdue" || (!!date && dayDiff(date) < 0))
  );
}
function dueKind(task: StartupTaskItem): "overdue" | "today" | "soon" | "normal" | "none" | "done" {
  if (task.status === "completed") return "done";
  const date = parseDate(task);
  if (!date) return "none";
  const diff = dayDiff(date);
  if (diff < 0 || task.status === "overdue") return "overdue";
  if (diff === 0) return "today";
  if (diff <= 2) return "soon";
  return "normal";
}
function formatDate(task: StartupTaskItem) {
  if (task.status === "completed")
    return task.completedAt
      ? `Completed ${new Date(task.completedAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}`
      : "Done";
  const date = parseDate(task);
  if (!date) return "No date";
  const diff = dayDiff(date);
  if (diff < 0)
    return `Overdue · ${date.toLocaleDateString("en-IN", { month: "short", day: "numeric" })}`;
  if (diff === 0) return "Today";
  return date.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}
function dueFilterMatches(task: StartupTaskItem, filter: DueFilter) {
  if (filter === "all") return true;
  if (filter === "overdue") return isOverdue(task);
  const date = parseDate(task);
  if (filter === "no-date") return !date;
  if (!date || task.status === "completed") return false;
  const diff = dayDiff(date);
  return filter === "today" ? diff === 0 : diff >= 0 && diff <= 7;
}
function getTaskLink(task: StartupTaskItem, data: ReturnType<typeof useStartupWorkspace>["data"]) {
  if (task.linkedCriterionId) {
    const stage = data.stages.find((entry) =>
      entry.exitCriteria.some((criterion) => criterion.id === task.linkedCriterionId),
    );
    const criterion = stage?.exitCriteria.find((entry) => entry.id === task.linkedCriterionId);
    if (stage && criterion)
      return { label: `${stage.label}: ${criterion.label}`, href: STAGE_HREFS[stage.id] };
  }
  return { label: task.moduleLabel, href: task.moduleHref };
}
function priorityRank(priority?: TaskPriority) {
  return priority === "Urgent" ? 0 : priority === "High" ? 1 : priority === "Medium" ? 2 : 3;
}
function parseQuickInput(raw: string, team: Array<{ name: string }>, founder: string) {
  let text = raw.trim();
  let owner = founder;
  let dueDate = "";
  const labels = Array.from(text.matchAll(/#([\w-]+)/g), (match) => match[1]);
  text = text.replace(/#[\w-]+/g, " ");
  const assignee = text.match(/@([\w.-]+)/);
  if (assignee) {
    const member = team.find((item) =>
      item.name.toLowerCase().startsWith(assignee[1].toLowerCase()),
    );
    if (member) owner = member.name;
    text = text.replace(assignee[0], " ");
  }
  const dateToken = text.match(
    /\/(today|tomorrow|mon|monday|tue|tuesday|wed|wednesday|thu|thursday|fri|friday|sat|saturday|sun|sunday)\b/i,
  );
  if (dateToken) {
    const dayMap: Record<string, number> = {
      sun: 0,
      sunday: 0,
      mon: 1,
      monday: 1,
      tue: 2,
      tuesday: 2,
      wed: 3,
      wednesday: 3,
      thu: 4,
      thursday: 4,
      fri: 5,
      friday: 5,
      sat: 6,
      saturday: 6,
    };
    const date = new Date();
    if (dateToken[1].toLowerCase() === "today") {
    } else if (dateToken[1].toLowerCase() === "tomorrow") date.setDate(date.getDate() + 1);
    else {
      const target = dayMap[dateToken[1].toLowerCase()];
      let delta = (target - date.getDay() + 7) % 7;
      if (delta === 0) delta = 7;
      date.setDate(date.getDate() + delta);
    }
    dueDate = isoToday(date);
    text = text.replace(dateToken[0], " ");
  }
  return { title: text.replace(/\s+/g, " ").trim(), owner, dueDate, labels };
}

export default function StartupTasksPage() {
  const { data, addTask, updateTask, deleteTask, restoreTask, toggleTaskStatus } =
    useStartupWorkspace();
  const [view, setView] = useState<TaskView>("board");
  const [search, setSearch] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [dueFilter, setDueFilter] = useState<DueFilter>("all");
  const [labelFilter, setLabelFilter] = useState("all");
  const [milestoneFilter, setMilestoneFilter] = useState<"all" | "yes" | "no">("all");
  const [linkedFilter, setLinkedFilter] = useState<"all" | "criterion" | "mentor" | "none">("all");
  const [groupBy, setGroupBy] = useState<GroupMode>("none");
  const [sortBy, setSortBy] = useState<"due" | "priority" | "title" | "newest">("due");
  const [mineOnly, setMineOnly] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [newTaskStatus, setNewTaskStatus] = useState<BoardStatus>("pending");
  const [newTaskIsMilestone, setNewTaskIsMilestone] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; undo?: () => void } | null>(null);
  const [importMessage, setImportMessage] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [calendarMode, setCalendarMode] = useState<"month" | "week">("month");
  const [selectedDay, setSelectedDay] = useState(isoToday());
  const founder = data.startup.founderName;
  const currentMember = data.team.find((member) => member.name === founder);
  const canEdit = !currentMember || currentMember.permission !== "Viewer";
  const canManage =
    !currentMember || currentMember.permission === "Owner" || currentMember.permission === "Admin";
  const focusedTask = data.tasks.find((task) => task.id === focusedTaskId) || null;

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 700) setView("list");
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const labels = useMemo(
    () => Array.from(new Set(data.tasks.flatMap((task) => task.labels || []))).sort(),
    [data.tasks],
  );
  const tasks = useMemo(() => {
    const filtered = data.tasks.filter((task) => {
      const query = search.trim().toLowerCase();
      const linked = getTaskLink(task, data).label.toLowerCase();
      const matchesSearch =
        !query ||
        task.title.toLowerCase().includes(query) ||
        task.owner.toLowerCase().includes(query) ||
        linked.includes(query) ||
        (task.labels || []).some((label) => label.toLowerCase().includes(query));
      return (
        matchesSearch &&
        (assigneeFilter === "all" || task.owner === assigneeFilter) &&
        (!mineOnly || task.owner === founder) &&
        (statusFilter === "all" ||
          (statusFilter === "overdue" ? isOverdue(task) : workflowStatus(task) === statusFilter)) &&
        (priorityFilter === "all" || (task.priority || "Medium") === priorityFilter) &&
        dueFilterMatches(task, dueFilter) &&
        (labelFilter === "all" || task.labels?.includes(labelFilter)) &&
        (milestoneFilter === "all" ||
          (milestoneFilter === "yes" ? task.isMilestone === true : !task.isMilestone)) &&
        (linkedFilter === "all" ||
          (linkedFilter === "criterion"
            ? Boolean(task.linkedCriterionId)
            : linkedFilter === "mentor"
              ? task.mentorDeliverable === true
              : !task.linkedCriterionId && !task.mentorDeliverable))
      );
    });
    return filtered.sort((a, b) =>
      sortBy === "title"
        ? a.title.localeCompare(b.title)
        : sortBy === "priority"
          ? priorityRank(a.priority) - priorityRank(b.priority)
          : sortBy === "newest"
            ? b.id.localeCompare(a.id)
            : (parseDate(a)?.getTime() ?? Infinity) - (parseDate(b)?.getTime() ?? Infinity),
    );
  }, [
    data,
    search,
    assigneeFilter,
    mineOnly,
    founder,
    statusFilter,
    priorityFilter,
    dueFilter,
    labelFilter,
    milestoneFilter,
    linkedFilter,
    sortBy,
  ]);

  const openNewTask = (status: BoardStatus = "pending", milestone = false) => {
    setNewTaskStatus(status);
    setNewTaskIsMilestone(milestone);
    setNewTaskOpen(true);
  };
  const makeTask = (input: {
    title: string;
    owner: string;
    dueDate: string;
    priority: TaskPriority;
    labels: string[];
    description: string;
    milestone: boolean;
    milestoneId?: string;
    criterionId: string;
    mentorDeliverable: boolean;
    status?: BoardStatus;
  }) => {
    const criterion = data.stages
      .flatMap((stage) => stage.exitCriteria.map((item) => ({ stage, item })))
      .find((entry) => entry.item.id === input.criterionId);
    const moduleHref =
      criterion?.item.moduleHref ||
      data.stages.find((stage) => stage.id === data.startup.currentStage)?.exitCriteria[0]
        ?.moduleHref ||
      "/startup/tasks";
    const moduleLabel = criterion ? `${criterion.stage.label} stage` : "Tasks";
    const dueLabel = input.dueDate
      ? `Due ${new Date(`${input.dueDate}T12:00:00`).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}`
      : "No due date";
    const id = addTask({
      title: input.title.trim(),
      owner: input.owner || founder,
      dueDate: input.dueDate || undefined,
      dueLabel,
      priority: input.priority,
      labels: input.labels,
      description: input.description,
      isMilestone: input.milestone,
      milestoneId: input.milestoneId || undefined,
      linkedCriterionId: input.criterionId || undefined,
      moduleHref,
      moduleLabel,
      mentorDeliverable: input.mentorDeliverable,
      status: input.status || newTaskStatus,
    });
    setToast({ message: "Task created.", undo: () => deleteTask(id) });
    return id;
  };
  const changeStatus = (task: StartupTaskItem, status: BoardStatus) => {
    const oldStatus = task.status;
    const oldCompletedAt = task.completedAt;
    updateTask(task.id, {
      status,
      completedAt: status === "completed" ? new Date().toISOString() : undefined,
    });
    setToast({
      message:
        status === "completed"
          ? "Task completed."
          : `Moved to ${COLUMNS.find((item) => item.id === status)?.label}.`,
      undo: () => updateTask(task.id, { status: oldStatus, completedAt: oldCompletedAt }),
    });
  };
  const toggleTask = (task: StartupTaskItem) => {
    if (task.status === "completed") {
      const before = task;
      toggleTaskStatus(task.id);
      setToast({ message: "Task reopened.", undo: () => updateTask(before.id, before) });
    } else {
      const before = task;
      toggleTaskStatus(task.id);
      setToast({ message: "Task completed.", undo: () => updateTask(before.id, before) });
    }
  };
  const bulkStatus = (status: BoardStatus) => {
    selected.forEach((id) =>
      updateTask(id, {
        status,
        completedAt: status === "completed" ? new Date().toISOString() : undefined,
      }),
    );
    setSelected([]);
    setToast({ message: `${selected.length} task${selected.length === 1 ? "" : "s"} updated.` });
  };
  const handleDelete = (task: StartupTaskItem) => {
    deleteTask(task.id);
    setFocusedTaskId(null);
    setToast({ message: "Task deleted.", undo: () => restoreTask(task) });
  };
  const clearFilters = () => {
    setSearch("");
    setAssigneeFilter("all");
    setStatusFilter("all");
    setPriorityFilter("all");
    setDueFilter("all");
    setLabelFilter("all");
    setMilestoneFilter("all");
    setLinkedFilter("all");
    setMineOnly(false);
  };

  const handleExport = () => {
    const lines = [
      ["Task", "Assignee", "Due date", "Priority", "Status", "Linked to", "Labels", "Description"],
      ...tasks.map((task) => [
        task.title,
        task.owner,
        task.dueDate || formatDate(task),
        task.priority || "Medium",
        workflowStatus(task),
        getTaskLink(task, data).label,
        (task.labels || []).join("; "),
        task.description || "",
      ]),
    ];
    const csv = lines
      .map((line) => line.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${data.startup.name.toLowerCase().replace(/\s+/g, "-")}-tasks.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setToast({ message: `${tasks.length} tasks exported.` });
  };
  const handleImport = async (file?: File) => {
    if (!file) return;
    const content = await file.text();
    const rows = content.split(/\r?\n/).filter(Boolean).slice(1);
    let imported = 0;
    for (const row of rows) {
      const cells =
        row
          .match(/("(?:[^"]|"")*"|[^,]*)(?:,|$)/g)
          ?.map((cell) =>
            cell.replace(/,$/, "").replace(/^"|"$/g, "").replaceAll('""', '"').trim(),
          ) || [];
      const title = cells[0];
      if (!title) continue;
      addTask({
        title: title.slice(0, 140),
        owner: data.team.some((member) => member.name === cells[1]) ? cells[1] : founder,
        dueDate: cells[2] || undefined,
        dueLabel: cells[2] ? `Due ${cells[2]}` : "No due date",
        moduleLabel: "Tasks",
        moduleHref: "/startup/tasks",
        priority: PRIORITIES.includes(cells[3] as TaskPriority)
          ? (cells[3] as TaskPriority)
          : "Medium",
        status: "pending",
        labels: cells[4]
          ? cells[4]
              .split(";")
              .map((label) => label.trim())
              .filter(Boolean)
              .slice(0, 8)
          : [],
      });
      imported++;
    }
    setImportMessage(`${imported} task${imported === 1 ? "" : "s"} imported from ${file.name}.`);
    window.setTimeout(() => setImportMessage(""), 4500);
  };
  const useTemplate = (template: (typeof TEMPLATES)[number]) => {
    makeTask({
      title: template.title,
      owner: founder,
      dueDate: "",
      priority: template.priority,
      labels: template.labels,
      description: "",
      milestone: false,
      criterionId: template.linkedCriterionId,
      mentorDeliverable: !!template.mentorDeliverable,
    });
    setTemplateOpen(false);
  };
  const quickAdd = (raw: string) => {
    const parsed = parseQuickInput(raw, data.team, founder);
    if (!parsed.title) return;
    makeTask({
      title: parsed.title,
      owner: parsed.owner,
      dueDate: parsed.dueDate,
      priority: "Medium",
      labels: parsed.labels,
      description: "",
      milestone: false,
      criterionId: "",
      mentorDeliverable: false,
    });
  };

  const openTasks = data.tasks.filter((task) => task.status !== "completed");
  const overdueCount = openTasks.filter(isOverdue).length;
  const dueThisWeekCount = openTasks.filter((task) => dueFilterMatches(task, "week")).length;
  const completedThisMonth = data.tasks.filter(
    (task) =>
      task.completedAt &&
      new Date(task.completedAt).getMonth() === new Date().getMonth() &&
      new Date(task.completedAt).getFullYear() === new Date().getFullYear(),
  ).length;
  const completedCount = data.tasks.filter((task) => task.status === "completed").length;
  const sprintPercent = data.tasks.length
    ? Math.round((completedCount / data.tasks.length) * 100)
    : 0;
  const filtersActive = Boolean(
    search ||
    assigneeFilter !== "all" ||
    statusFilter !== "all" ||
    priorityFilter !== "all" ||
    dueFilter !== "all" ||
    labelFilter !== "all" ||
    milestoneFilter !== "all" ||
    linkedFilter !== "all" ||
    mineOnly,
  );
  const allCriteria = data.stages.flatMap((stage) =>
    stage.exitCriteria.map((criterion) => ({
      ...criterion,
      stageId: stage.id as StartupStageId,
      stageLabel: stage.label,
    })),
  );
  const activeStage =
    data.stages.find((stage) => stage.id === data.startup.currentStage) || data.stages[0];
  const activeCriteriaDone = activeStage.exitCriteria.filter(
    (criterion) => criterion.completed,
  ).length;
  const mentorTasks = data.tasks.filter((task) => task.mentorDeliverable);
  const focusTasks = data.tasks
    .filter(
      (task) =>
        task.owner === founder &&
        (isOverdue(task) || dueFilterMatches(task, "today")) &&
        task.status !== "completed",
    )
    .sort((a, b) => Number(isOverdue(b)) - Number(isOverdue(a)))
    .slice(0, 5);

  return (
    <div className={styles.tasksPage}>
      <a href="#tasks-main" className={styles.skipLink}>
        Skip to tasks
      </a>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>Startup workspace · Work hub</span>
          <h1>Tasks</h1>
          <p>Plan the work, track the milestones.</p>
        </div>
        <div className={styles.headerActions}>
          <label className={styles.secondaryButton}>
            <Upload size={15} /> Import CSV
            <input
              type="file"
              accept=".csv,text/csv"
              disabled={!canEdit}
              onChange={(event) => {
                void handleImport(event.target.files?.[0]);
                event.currentTarget.value = "";
              }}
            />
          </label>
          <button type="button" className={styles.secondaryButton} onClick={handleExport}>
            <Download size={15} /> Export
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => openNewTask()}
            disabled={!canEdit}
          >
            <Plus size={16} /> New task
          </button>
        </div>
      </header>
      {importMessage && (
        <div className={styles.importToast} role="status">
          <CheckCircle2 size={15} />
          {importMessage}
        </div>
      )}
      {!canEdit && (
        <div className={styles.readOnlyNote}>
          <AlertCircle size={15} /> You have read-only access. Ask an Owner or Admin to make
          changes.
        </div>
      )}

      <section className={styles.summaryCard} aria-label="Task summary">
        <div className={styles.statsGrid}>
          <button
            type="button"
            className={styles.stat}
            onClick={() => {
              setStatusFilter("all");
              setDueFilter("all");
            }}
          >
            <span>Open tasks</span>
            <strong>{openTasks.length}</strong>
            <small>Across the workspace</small>
          </button>
          <button
            type="button"
            className={`${styles.stat} ${dueThisWeekCount ? styles.statWarning : ""}`}
            onClick={() => {
              setDueFilter("week");
              setStatusFilter("all");
            }}
          >
            <span>Due this week</span>
            <strong>{dueThisWeekCount}</strong>
            <small>Next 7 days</small>
          </button>
          <button
            type="button"
            className={`${styles.stat} ${overdueCount ? styles.statError : ""}`}
            onClick={() => {
              setDueFilter("overdue");
              setStatusFilter("all");
            }}
          >
            <span>Overdue</span>
            <strong>{overdueCount}</strong>
            <small>Needs attention</small>
          </button>
          <div className={styles.stat}>
            <span>Completed this month</span>
            <strong>{completedThisMonth}</strong>
            <small>{completedCount} completed in this sample</small>
          </div>
        </div>
        <div className={styles.sprintProgress}>
          <div>
            <span>Sprint or month progress</span>
            <strong>
              {completedCount} of {data.tasks.length} tasks complete <small>{sprintPercent}%</small>
            </strong>
          </div>
          <div
            className={styles.progressTrack}
            role="progressbar"
            aria-valuenow={sprintPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${sprintPercent}% of tasks complete`}
          >
            <span style={{ width: `${sprintPercent}%` }} />
          </div>
          <small>Sample workspace count · not a readiness score</small>
        </div>
      </section>

      <div className={styles.viewToolbar}>
        <div className={styles.tabs} role="tablist" aria-label="Task views">
          {VIEWS.map((item) => (
            <button
              key={item.id}
              id={`task-view-tab-${item.id}`}
              type="button"
              role="tab"
              aria-selected={view === item.id}
              aria-controls="task-view-panel"
              onClick={() => setView(item.id)}
              className={view === item.id ? styles.tabActive : styles.tab}
            >
              {item.icon}
              {item.label}
              {item.id === "list" && <span>{data.tasks.length}</span>}
            </button>
          ))}
        </div>
        <div className={styles.filterBar}>
          <label className={styles.searchBox}>
            <Search size={15} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search tasks, labels, people…"
              aria-label="Search tasks, labels or assignees"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} aria-label="Clear search">
                <X size={13} />
              </button>
            )}
          </label>
          <label className={styles.selectFilter}>
            <UserRound size={13} />
            <select
              aria-label="Filter by assignee"
              value={assigneeFilter}
              onChange={(event) => setAssigneeFilter(event.target.value)}
            >
              <option value="all">All assignees</option>
              {data.team
                .filter((member) => member.status !== "Deactivated")
                .map((member) => (
                  <option key={member.id} value={member.name}>
                    {member.name}
                  </option>
                ))}
            </select>
          </label>
          <label className={styles.selectFilter}>
            <Filter size={13} />
            <select
              aria-label="Filter by due date"
              value={dueFilter}
              onChange={(event) => setDueFilter(event.target.value as DueFilter)}
            >
              <option value="all">All due dates</option>
              <option value="overdue">Overdue</option>
              <option value="today">Today</option>
              <option value="week">This week</option>
              <option value="no-date">No date</option>
            </select>
          </label>
          <button
            type="button"
            className={`${styles.mineToggle} ${mineOnly ? styles.mineActive : ""}`}
            aria-pressed={mineOnly}
            onClick={() => setMineOnly(!mineOnly)}
          >
            Assigned to me
          </button>
          <details className={styles.moreFilters}>
            <summary>
              <Filter size={14} /> More
            </summary>
            <div className={styles.moreFilterMenu}>
              <label>
                Status
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="all">All statuses</option>
                  <option value="pending">To do</option>
                  <option value="in-progress">In progress</option>
                  <option value="in-review">In review</option>
                  <option value="completed">Done</option>
                  <option value="overdue">Overdue</option>
                </select>
              </label>
              <label>
                Priority
                <select
                  value={priorityFilter}
                  onChange={(event) => setPriorityFilter(event.target.value)}
                >
                  <option value="all">All priorities</option>
                  {PRIORITIES.map((priority) => (
                    <option key={priority}>{priority}</option>
                  ))}
                </select>
              </label>
              <label>
                Label
                <select
                  value={labelFilter}
                  onChange={(event) => setLabelFilter(event.target.value)}
                >
                  <option value="all">All labels</option>
                  {labels.map((label) => (
                    <option key={label}>{label}</option>
                  ))}
                </select>
              </label>
              <label>
                Milestone
                <select
                  value={milestoneFilter}
                  onChange={(event) =>
                    setMilestoneFilter(event.target.value as typeof milestoneFilter)
                  }
                >
                  <option value="all">All tasks</option>
                  <option value="yes">Milestones only</option>
                  <option value="no">Not milestones</option>
                </select>
              </label>
              <label>
                Linked to
                <select
                  value={linkedFilter}
                  onChange={(event) => setLinkedFilter(event.target.value as typeof linkedFilter)}
                >
                  <option value="all">Any link</option>
                  <option value="criterion">Stage criterion</option>
                  <option value="mentor">Mentor deliverable</option>
                  <option value="none">Not linked</option>
                </select>
              </label>
              <label>
                Group by
                <select
                  value={groupBy}
                  onChange={(event) => setGroupBy(event.target.value as GroupMode)}
                >
                  <option value="none">None</option>
                  <option value="status">Status</option>
                  <option value="assignee">Assignee</option>
                  <option value="due">Due date</option>
                  <option value="milestone">Milestone</option>
                  <option value="criterion">Stage criterion</option>
                </select>
              </label>
              <label>
                Sort by
                <select
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
                >
                  <option value="due">Due date</option>
                  <option value="priority">Priority</option>
                  <option value="title">Title</option>
                  <option value="newest">Recently added</option>
                </select>
              </label>
            </div>
          </details>
          {filtersActive && (
            <button type="button" className={styles.clearFilters} onClick={clearFilters}>
              Clear
            </button>
          )}
        </div>
      </div>

      {selected.length > 0 && view === "list" && canManage && (
        <div className={styles.bulkBar}>
          <span>{selected.length} selected</span>
          <label>
            Set status
            <select
              defaultValue=""
              onChange={(event) => {
                if (event.target.value) bulkStatus(event.target.value as BoardStatus);
              }}
            >
              <option value="" disabled>
                Choose…
              </option>
              {COLUMNS.map((column) => (
                <option key={column.id} value={column.id}>
                  {column.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              const selectedTasks = data.tasks.filter((task) => selected.includes(task.id));
              selectedTasks.forEach((task) => deleteTask(task.id));
              setSelected([]);
              setToast({
                message: `${selectedTasks.length} tasks deleted.`,
                undo: () => selectedTasks.forEach(restoreTask),
              });
            }}
            className={styles.deleteText}
          >
            <Trash2 size={14} /> Delete
          </button>
          <button type="button" onClick={() => setSelected([])}>
            Clear selection
          </button>
        </div>
      )}

      <div className={styles.mainGrid} id="tasks-main">
        <main
          className={styles.mainView}
          id="task-view-panel"
          role="tabpanel"
          aria-labelledby={`task-view-tab-${view}`}
        >
          {view === "board" && (
            <BoardView
              tasks={tasks}
              canEdit={canEdit}
              hasFilters={filtersActive}
              onOpen={setFocusedTaskId}
              onMove={changeStatus}
              onAdd={openNewTask}
            />
          )}
          {view === "list" && (
            <ListView
              tasks={tasks}
              groupBy={groupBy}
              canEdit={canEdit}
              canManage={canManage}
              hasFilters={filtersActive}
              onClearFilters={clearFilters}
              founder={founder}
              data={data}
              selected={selected}
              onSelect={setSelected}
              onOpen={setFocusedTaskId}
              onToggle={toggleTask}
              onQuickAdd={quickAdd}
              onAdd={openNewTask}
            />
          )}
          {view === "milestones" && (
            <MilestonesView
              tasks={data.tasks}
              criteria={allCriteria}
              data={data}
              canManage={canManage}
              canEdit={canEdit}
              onOpen={setFocusedTaskId}
              onNew={() => openNewTask("pending", true)}
              onCreateMilestone={() => openNewTask("pending", true)}
            />
          )}
          {view === "calendar" && (
            <CalendarView
              tasks={tasks}
              canEdit={canEdit}
              month={calendarMonth}
              mode={calendarMode}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
              onChangeMonth={setCalendarMonth}
              onMode={setCalendarMode}
              onOpen={setFocusedTaskId}
              onNew={() => openNewTask()}
            />
          )}
          {tasks.length === 0 && filtersActive && view === "board" && (
            <div className={styles.noResults}>
              <Search size={22} />
              <strong>No tasks match your filters.</strong>
              <button type="button" onClick={clearFilters}>
                Clear filters
              </button>
            </div>
          )}
        </main>
        <aside className={styles.sidePanel} aria-label="Task workspace summary">
          <section className={styles.sideCard}>
            <div className={styles.sideHeader}>
              <div>
                <h2>My focus</h2>
                <p>Today and overdue · up to 5</p>
              </div>
              <Clock3 size={16} />
            </div>
            {focusTasks.length ? (
              <div className={styles.focusList}>
                {focusTasks.map((task) => (
                  <div className={styles.focusRow} key={task.id}>
                    <button
                      type="button"
                      disabled={!canEdit}
                      className={styles.roundCheck}
                      aria-label={`Complete ${task.title}`}
                      onClick={() => toggleTask(task)}
                    >
                      {task.status === "completed" ? <Check size={13} /> : <Circle size={14} />}
                    </button>
                    <button
                      type="button"
                      className={styles.focusTitle}
                      onClick={() => setFocusedTaskId(task.id)}
                    >
                      {task.title}
                      <small className={dueKind(task) === "overdue" ? "textError" : ""}>
                        {formatDate(task)} · {task.owner}
                      </small>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.sideEmpty}>No overdue or due-today tasks assigned to you.</div>
            )}
            <button
              type="button"
              className={styles.sideLink}
              onClick={() => {
                setMineOnly(true);
                setDueFilter("all");
                setView("list");
              }}
            >
              View all assigned tasks <ArrowRight size={13} />
            </button>
          </section>
          <section className={styles.sideCard}>
            <div className={styles.sideHeader}>
              <div>
                <h2>Stage progress</h2>
                <p>{activeStage.label} stage</p>
              </div>
              <Target size={16} />
            </div>
            <div className={styles.stageProgressLine}>
              <span>
                {activeCriteriaDone} of {activeStage.exitCriteria.length} checklist items marked met
              </span>
              <span>
                {activeStage.exitCriteria.length
                  ? Math.round((activeCriteriaDone / activeStage.exitCriteria.length) * 100)
                  : 0}
                %
              </span>
            </div>
            <div className={styles.progressTrack}>
              <span
                style={{
                  width: `${activeStage.exitCriteria.length ? Math.round((activeCriteriaDone / activeStage.exitCriteria.length) * 100) : 0}%`,
                }}
              />
            </div>
            <div className={styles.linkedCriteriaList}>
              {activeStage.exitCriteria
                .filter((criterion) => !criterion.completed)
                .slice(0, 3)
                .map((criterion) => {
                  const linked = data.tasks.filter(
                    (task) =>
                      task.linkedCriterionId === criterion.id && task.status !== "completed",
                  );
                  return (
                    <div key={criterion.id}>
                      <span>{criterion.label}</span>
                      <small>
                        {linked.length} open task{linked.length === 1 ? "" : "s"} linked
                      </small>
                    </div>
                  );
                })}
            </div>
            <Link href="/startup/stage" className={styles.sideLink}>
              Open stage toolkit <ArrowRight size={13} />
            </Link>
            <small className={styles.dataNote}>
              Checklist progress is not an investment-readiness score.
            </small>
          </section>
          <section className={styles.sideCard}>
            <div className={styles.sideHeader}>
              <div>
                <h2>Mentor deliverables</h2>
                <p>Tasks from mentor sessions</p>
              </div>
              <MessageSquare size={16} />
            </div>
            {mentorTasks.length ? (
              <div className={styles.deliverableList}>
                {mentorTasks.slice(0, 3).map((task) => (
                  <div key={task.id} className={styles.deliverableRow}>
                    <button type="button" onClick={() => setFocusedTaskId(task.id)}>
                      {task.title}
                    </button>
                    <span
                      className={
                        task.mentorStatus === "submitted"
                          ? styles.submittedStatus
                          : styles.neutralStatus
                      }
                    >
                      {task.mentorStatus === "submitted" ? "Submitted" : "Deliverable"}
                    </span>
                    {canEdit &&
                      task.status === "completed" &&
                      task.mentorStatus !== "submitted" &&
                      task.mentorStatus !== "approved" && (
                        <button
                          type="button"
                          className={styles.submitDeliverable}
                          onClick={() => {
                            updateTask(task.id, { mentorStatus: "submitted" });
                            setToast({
                              message:
                                "Deliverable submitted locally. Mentor sign-off is not connected.",
                            });
                          }}
                        >
                          Submit for review <Send size={12} />
                        </button>
                      )}
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.sideEmpty}>No mentor deliverables in this workspace yet.</div>
            )}
            <small className={styles.dataNote}>
              Review and sign-off are not connected in this demo.
            </small>
          </section>
          <section className={styles.sideCard}>
            <div className={styles.sideHeader}>
              <div>
                <h2>Workload</h2>
                <p>Open tasks by team member · counts only</p>
              </div>
              <UserRound size={16} />
            </div>
            <div className={styles.workloadList}>
              {data.team
                .filter((member) => member.status !== "Deactivated")
                .map((member) => {
                  const count = openTasks.filter((task) => task.owner === member.name).length;
                  const max = Math.max(
                    5,
                    ...data.team.map(
                      (person) => openTasks.filter((task) => task.owner === person.name).length,
                    ),
                  );
                  return (
                    <div className={styles.workloadRow} key={member.id}>
                      <span className={styles.avatar}>{initials(member.name)}</span>
                      <span className={styles.workloadName}>{member.name}</span>
                      <div
                        className={styles.workloadTrack}
                        role="img"
                        aria-label={`${count} open tasks assigned to ${member.name}`}
                      >
                        <span style={{ width: `${Math.min(100, (count / max) * 100)}%` }} />
                      </div>
                      <strong>{count}</strong>
                    </div>
                  );
                })}
            </div>
            <small className={styles.dataNote}>
              Workload is an allocation aid, not a performance measure.
            </small>
          </section>
        </aside>
      </div>
      <button
        type="button"
        className={styles.mobileNewTask}
        onClick={() => openNewTask()}
        disabled={!canEdit}
      >
        <Plus size={17} /> New task
      </button>
      {newTaskOpen && (
        <NewTaskDialog
          team={data.team.filter((member) => member.status !== "Deactivated")}
          founder={founder}
          criteria={allCriteria}
          milestones={data.tasks.filter((task) => task.isMilestone)}
          initialStatus={newTaskStatus}
          initialMilestone={newTaskIsMilestone}
          onClose={() => setNewTaskOpen(false)}
          onCreate={(input, addAnother) => {
            makeTask(input);
            if (!addAnother) setNewTaskOpen(false);
          }}
          onTemplate={() => {
            setNewTaskOpen(false);
            setTemplateOpen(true);
          }}
        />
      )}
      {templateOpen && (
        <TemplateDialog onClose={() => setTemplateOpen(false)} onSelect={useTemplate} />
      )}
      {focusedTask && (
        <TaskDrawer
          key={focusedTask.id}
          task={focusedTask}
          data={data}
          canEdit={canEdit}
          canManage={canManage}
          milestones={data.tasks.filter((task) => task.isMilestone && task.id !== focusedTask.id)}
          onClose={() => setFocusedTaskId(null)}
          onUpdate={(updates) => updateTask(focusedTask.id, updates)}
          onDelete={() => handleDelete(focusedTask)}
          onToggle={() => toggleTask(focusedTask)}
          onMove={(status) => changeStatus(focusedTask, status)}
          onDuplicate={() => {
            makeTask({
              title: `${focusedTask.title} (copy)`,
              owner: focusedTask.owner,
              dueDate: focusedTask.dueDate || "",
              priority: focusedTask.priority || "Medium",
              labels: focusedTask.labels || [],
              description: focusedTask.description || "",
              milestone: false,
              milestoneId: focusedTask.milestoneId,
              criterionId: focusedTask.linkedCriterionId || "",
              mentorDeliverable: !!focusedTask.mentorDeliverable,
            });
            setFocusedTaskId(null);
          }}
        />
      )}
      {toast && (
        <div className={styles.toast} role="status">
          <CheckCircle2 size={15} />
          <span>{toast.message}</span>
          {toast.undo && (
            <button
              type="button"
              onClick={() => {
                toast.undo?.();
                setToast({ message: "Action undone." });
              }}
            >
              Undo
            </button>
          )}
          <button type="button" aria-label="Dismiss notification" onClick={() => setToast(null)}>
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

function BoardView({
  tasks,
  canEdit,
  hasFilters,
  onOpen,
  onMove,
  onAdd,
}: {
  tasks: StartupTaskItem[];
  canEdit: boolean;
  hasFilters: boolean;
  onOpen: (id: string) => void;
  onMove: (task: StartupTaskItem, status: BoardStatus) => void;
  onAdd: (status: BoardStatus) => void;
}) {
  const [dragged, setDragged] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(true);
  const [announcement, setAnnouncement] = useState("");
  return (
    <div className={styles.boardWrap}>
      <div className={styles.boardIntro}>
        <div>
          <h2>Board</h2>
          <p>Move tasks between steps. Drag a card or use its status menu.</p>
        </div>
        <span>{tasks.filter((task) => task.status !== "completed").length} open</span>
      </div>
      <div className={styles.boardColumns} aria-label="Tasks by status">
        {COLUMNS.map((column) => {
          const columnTasks = tasks.filter((task) => workflowStatus(task) === column.id);
          const display = column.id === "completed" && !showDone ? [] : columnTasks;
          return (
            <section
              key={column.id}
              className={`${styles.boardColumn} ${column.id === "completed" ? styles.doneColumn : ""}`}
              aria-labelledby={`column-${column.id}`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const task = tasks.find(
                  (item) => item.id === (event.dataTransfer.getData("text/plain") || dragged),
                );
                if (task && canEdit) {
                  onMove(task, column.id);
                  setAnnouncement(`Moved ${task.title} to ${column.label}`);
                }
                setDragged(null);
              }}
            >
              <header className={styles.columnHeader}>
                <div>
                  <span className={`${styles.columnDot} ${styles[`dot-${column.id}`]}`} />
                  <h3 id={`column-${column.id}`}>{column.label}</h3>
                  <span className={styles.countPill}>{columnTasks.length}</span>
                </div>
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => onAdd(column.id)}
                  aria-label={`Add task to ${column.label}`}
                >
                  <Plus size={15} />
                </button>
              </header>
              <div className={styles.columnBody} role="list" aria-label={`${column.label} tasks`}>
                {display.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    canEdit={canEdit}
                    onOpen={() => onOpen(task.id)}
                    onDragStart={() => {
                      setDragged(task.id);
                    }}
                    onQuickMove={(status) => {
                      onMove(task, status);
                      setAnnouncement(
                        `Moved ${task.title} to ${COLUMNS.find((item) => item.id === status)?.label}`,
                      );
                    }}
                  />
                ))}
                {!columnTasks.length && <div className={styles.columnEmpty}>No tasks here</div>}
              </div>
              {column.id === "completed" && columnTasks.length > 0 && (
                <button
                  type="button"
                  className={styles.showDone}
                  onClick={() => setShowDone(!showDone)}
                >
                  {showDone
                    ? "Hide done tasks"
                    : `Show ${columnTasks.length} done task${columnTasks.length === 1 ? "" : "s"}`}
                </button>
              )}
            </section>
          );
        })}
      </div>
      {tasks.length === 0 && !hasFilters && (
        <div className={styles.emptyState}>
          <Target size={22} />
          <strong>Nothing here yet.</strong>
          <span>Add your first task or start from a stage template.</span>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={!canEdit}
            onClick={() => onAdd("pending")}
          >
            <Plus size={14} /> New task
          </button>
        </div>
      )}
      <p className={styles.srOnly} aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
function TaskCard({
  task,
  canEdit,
  onOpen,
  onDragStart,
  onQuickMove,
}: {
  task: StartupTaskItem;
  canEdit: boolean;
  onOpen: () => void;
  onDragStart: () => void;
  onQuickMove: (status: BoardStatus) => void;
}) {
  const status = workflowStatus(task);
  const linked = task.linkedCriterionId ? task.linkedCriterionId : task.moduleLabel;
  return (
    <article
      className={`${styles.taskCard} ${task.status === "completed" ? styles.doneTask : ""}`}
      role="listitem"
      draggable={canEdit}
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", task.id);
        onDragStart();
      }}
    >
      <div className={styles.taskCardTop}>
        <button type="button" className={styles.taskCardTitle} onClick={onOpen}>
          {task.title}
        </button>
        <details className={styles.cardMenu}>
          <summary aria-label={`Task actions for ${task.title}`}>
            <MoreHorizontal size={16} />
          </summary>
          <div className={styles.cardMenuItems}>
            <button type="button" onClick={onOpen}>
              Open details
            </button>
            {COLUMNS.filter((column) => column.id !== status).map((column) => (
              <button
                type="button"
                key={column.id}
                disabled={!canEdit}
                onClick={() => {
                  onQuickMove(column.id);
                }}
              >
                Move to {column.label}
              </button>
            ))}
          </div>
        </details>
      </div>
      <div className={styles.taskCardLabels}>
        {(task.labels || []).slice(0, 3).map((label) => (
          <span className={styles.labelPill} key={label}>
            {label}
          </span>
        ))}
        {task.isMilestone && (
          <span className={styles.milestonePill}>
            <Flag size={10} /> Milestone
          </span>
        )}
      </div>
      <div className={styles.taskCardMeta}>
        <span className={styles.avatar}>{initials(task.owner)}</span>
        <span className={styles.taskOwner}>{task.owner.split(" ")[0]}</span>
        <span className={`${styles.dueChip} ${styles[`due-${dueKind(task)}`]}`}>
          <CalendarDays size={11} />
          {formatDate(task)}
        </span>
      </div>
      <div className={styles.taskCardFooter}>
        <span
          className={`${styles.priority} ${styles[`priority-${(task.priority || "Medium").toLowerCase()}`]}`}
        >
          <i />
          {task.priority || "Medium"}
        </span>
        <button type="button" className={styles.linkedMini} onClick={onOpen} title={linked}>
          {task.comments?.length ? (
            <>
              <MessageSquare size={11} />
              {task.comments.length}
            </>
          ) : task.subtasks?.length ? (
            <>
              <CheckSquareMini />
              {task.subtasks.filter((item) => item.completed).length}/{task.subtasks.length}
            </>
          ) : (
            <>
              <Link2 size={11} />
              {linked}
            </>
          )}
        </button>
      </div>
    </article>
  );
}
function CheckSquareMini() {
  return <Check size={11} />;
}

function ListView({
  tasks,
  groupBy,
  canEdit,
  canManage,
  hasFilters,
  onClearFilters,
  founder,
  data,
  selected,
  onSelect,
  onOpen,
  onToggle,
  onQuickAdd,
  onAdd,
}: {
  tasks: StartupTaskItem[];
  groupBy: GroupMode;
  canEdit: boolean;
  canManage: boolean;
  hasFilters: boolean;
  onClearFilters: () => void;
  founder: string;
  data: ReturnType<typeof useStartupWorkspace>["data"];
  selected: string[];
  onSelect: (ids: string[]) => void;
  onOpen: (id: string) => void;
  onToggle: (task: StartupTaskItem) => void;
  onQuickAdd: (title: string) => void;
  onAdd: (status: BoardStatus) => void;
}) {
  const [quick, setQuick] = useState("");
  const groups = useMemo(() => {
    if (groupBy === "none") return [{ label: "All tasks", items: tasks }];
    const map = new Map<string, StartupTaskItem[]>();
    for (const task of tasks) {
      let key = "";
      if (groupBy === "status")
        key = COLUMNS.find((column) => column.id === workflowStatus(task))?.label || "To do";
      else if (groupBy === "assignee") key = task.owner;
      else if (groupBy === "due")
        key =
          dueKind(task) === "none"
            ? "No date"
            : dueKind(task) === "overdue"
              ? "Overdue"
              : dueKind(task) === "today"
                ? "Today"
                : "Upcoming";
      else if (groupBy === "milestone") key = task.isMilestone ? "Milestones" : "Other tasks";
      else key = getTaskLink(task, data).label;
      map.set(key, [...(map.get(key) || []), task]);
    }
    return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
  }, [tasks, groupBy, data]);
  const submitQuick = (event: FormEvent) => {
    event.preventDefault();
    if (!canEdit || !quick.trim()) return;
    onQuickAdd(quick.trim());
    setQuick("");
  };
  return (
    <div className={styles.listCard}>
      <div className={styles.listHeading}>
        <div>
          <h2>List</h2>
          <p>
            {tasks.length} task{tasks.length === 1 ? "" : "s"} · click a row to open details
          </p>
        </div>
        <button
          type="button"
          className={styles.addSmall}
          disabled={!canEdit}
          onClick={() => onAdd("pending")}
        >
          <Plus size={14} /> New task
        </button>
      </div>
      <form className={styles.quickAdd} onSubmit={submitQuick}>
        <Plus size={16} />
        <input
          value={quick}
          onChange={(event) => setQuick(event.target.value)}
          placeholder="Add a task quickly… Press Enter. Use @name, #label or /fri"
          disabled={!canEdit}
          aria-label="Quick add a task"
        />
        <button type="submit" disabled={!canEdit || !quick.trim()}>
          Add
        </button>
      </form>
      <p className={styles.syntaxHint}>
        Quick add supports @assignee, #label and /today, /tomorrow or /fri. For full details, use
        New task.
      </p>
      {groups.map((group) => (
        <section className={styles.listGroup} key={group.label}>
          <h3>
            {group.label}
            <span>{group.items.length}</span>
          </h3>
          <div className={styles.tableScroller}>
            <table className={styles.taskTable}>
              <thead>
                <tr>
                  <th className={styles.checkColumn}>
                    <input
                      type="checkbox"
                      disabled={!canManage}
                      aria-label={`Select all ${group.label}`}
                      checked={
                        group.items.length > 0 &&
                        group.items.every((task) => selected.includes(task.id))
                      }
                      onChange={(event) =>
                        onSelect(
                          event.target.checked
                            ? Array.from(
                                new Set([...selected, ...group.items.map((task) => task.id)]),
                              )
                            : selected.filter((id) => !group.items.some((task) => task.id === id)),
                        )
                      }
                    />
                  </th>
                  <th>Task</th>
                  <th>Assignee</th>
                  <th>Due date</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Linked to</th>
                  <th>Labels</th>
                </tr>
              </thead>
              <tbody>
                {group.items.map((task) => {
                  const link = getTaskLink(task, data);
                  const status = workflowStatus(task);
                  return (
                    <tr key={task.id} className={task.status === "completed" ? styles.doneRow : ""}>
                      <td>
                        <input
                          type="checkbox"
                          disabled={!canManage}
                          checked={selected.includes(task.id)}
                          onChange={(event) =>
                            onSelect(
                              event.target.checked
                                ? [...selected, task.id]
                                : selected.filter((id) => id !== task.id),
                            )
                          }
                          aria-label={`Select ${task.title}`}
                        />
                      </td>
                      <td>
                        <div className={styles.tableTask}>
                          <button
                            type="button"
                            disabled={!canEdit}
                            className={styles.roundCheck}
                            onClick={() => onToggle(task)}
                            aria-label={
                              task.status === "completed" ? "Reopen task" : "Mark task complete"
                            }
                          >
                            {task.status === "completed" ? (
                              <Check size={13} />
                            ) : (
                              <Circle size={14} />
                            )}
                          </button>
                          <button
                            type="button"
                            className={styles.tableTaskTitle}
                            onClick={() => onOpen(task.id)}
                          >
                            {task.title}
                          </button>
                        </div>
                      </td>
                      <td>
                        <span className={styles.tableAssignee}>
                          <span className={styles.avatar}>{initials(task.owner)}</span>
                          {task.owner}
                        </span>
                      </td>
                      <td>
                        <span className={`${styles.dueChip} ${styles[`due-${dueKind(task)}`]}`}>
                          {formatDate(task)}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`${styles.priority} ${styles[`priority-${(task.priority || "Medium").toLowerCase()}`]}`}
                        >
                          <i />
                          {task.priority || "Medium"}
                        </span>
                      </td>
                      <td>
                        <span className={`${styles.statusPill} ${styles[`status-${status}`]}`}>
                          {COLUMNS.find((column) => column.id === status)?.label}
                        </span>
                      </td>
                      <td>
                        <Link href={link.href} className={styles.tableLink}>
                          {link.label}
                          <ExternalLink size={11} />
                        </Link>
                      </td>
                      <td>
                        <div className={styles.tableLabels}>
                          {(task.labels || []).slice(0, 2).map((label) => (
                            <span className={styles.labelPill} key={label}>
                              {label}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      {!tasks.length &&
        (hasFilters ? (
          <div className={styles.noResults}>
            <Search size={22} />
            <strong>No tasks match your filters.</strong>
            <button type="button" onClick={onClearFilters}>
              Clear filters
            </button>
          </div>
        ) : (
          <div className={styles.emptyState}>
            <Target size={22} />
            <strong>Nothing here yet.</strong>
            <span>Add your first task or start from a stage template.</span>
            <button
              type="button"
              className={styles.primaryButton}
              disabled={!canEdit}
              onClick={() => onAdd("pending")}
            >
              <Plus size={14} /> New task
            </button>
          </div>
        ))}
    </div>
  );
}

function MilestonesView({
  tasks,
  criteria,
  data,
  canManage,
  canEdit,
  onOpen,
  onNew,
  onCreateMilestone,
}: {
  tasks: StartupTaskItem[];
  criteria: Array<{
    id: string;
    label: string;
    stageId: StartupStageId;
    stageLabel: string;
    moduleHref: string;
  }>;
  data: ReturnType<typeof useStartupWorkspace>["data"];
  canManage: boolean;
  canEdit: boolean;
  onOpen: (id: string) => void;
  onNew: () => void;
  onCreateMilestone: () => void;
}) {
  const milestones = tasks.filter((task) => task.isMilestone);
  const ordered = [...milestones].sort(
    (a, b) => (parseDate(a)?.getTime() ?? Infinity) - (parseDate(b)?.getTime() ?? Infinity),
  );
  return (
    <div className={styles.milestonesView}>
      <div className={styles.listHeading}>
        <div>
          <h2>Milestones</h2>
          <p>Major outcomes and the tasks linked to them.</p>
        </div>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={onCreateMilestone}
          disabled={!canManage}
        >
          <Plus size={14} /> New milestone
        </button>
      </div>
      {ordered.length ? (
        <>
          <div className={styles.timelineStrip}>
            {ordered.map((milestone, index) => {
              const state =
                milestone.status === "completed"
                  ? "done"
                  : isOverdue(milestone)
                    ? "risk"
                    : index === 0
                      ? "next"
                      : "future";
              return (
                <button
                  type="button"
                  className={`${styles.timelineMilestone} ${styles[`timeline-${state}`]}`}
                  key={milestone.id}
                  onClick={() => onOpen(milestone.id)}
                >
                  <span className={styles.timelineDot}>
                    {state === "done" ? <Check size={12} /> : index + 1}
                  </span>
                  <strong>{milestone.title}</strong>
                  <small>{formatDate(milestone)}</small>
                </button>
              );
            })}
          </div>
          <div className={styles.milestoneCards}>
            {ordered.map((milestone) => {
              const children = tasks.filter(
                (task) => task.milestoneId === milestone.id && task.id !== milestone.id,
              );
              const all = [milestone, ...children];
              const done = all.filter((task) => task.status === "completed").length;
              const progress = Math.round((done / all.length) * 100);
              const criterion = criteria.find((item) => item.id === milestone.linkedCriterionId);
              const status =
                milestone.status === "completed"
                  ? "Done"
                  : isOverdue(milestone)
                    ? "At risk"
                    : dayDiff(parseDate(milestone) || new Date()) < 3
                      ? "On track"
                      : "Not started";
              return (
                <article
                  className={`${styles.milestoneCard} ${milestone.status === "completed" ? styles.milestoneDone : milestone.id === ordered.find((item) => item.status !== "completed")?.id ? styles.milestoneNext : ""}`}
                  key={milestone.id}
                >
                  <div className={styles.milestoneCardHead}>
                    <div>
                      <span className={styles.eyebrow}>Milestone · {milestone.owner}</span>
                      <h3>{milestone.title}</h3>
                    </div>
                    <span
                      className={`${styles.milestoneStatus} ${status === "At risk" ? styles.statusRisk : status === "Done" ? styles.statusDone : ""}`}
                    >
                      {status}
                    </span>
                  </div>
                  <p className={styles.milestoneDescription}>
                    {milestone.description ||
                      "A major outcome linked to the startup’s day-to-day work."}
                  </p>
                  <div className={styles.milestoneFacts}>
                    <span>
                      <CalendarDays size={13} />
                      Target {formatDate(milestone)}
                    </span>
                    <span>
                      <UserRound size={13} />
                      {milestone.owner}
                    </span>
                  </div>
                  <div className={styles.milestoneProgress}>
                    <div>
                      <span>Linked task progress</span>
                      <strong>
                        {done} of {all.length} done
                      </strong>
                    </div>
                    <div className={styles.progressTrack}>
                      <span style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                  {criterion && (
                    <Link href={STAGE_HREFS[criterion.stageId]} className={styles.criterionLink}>
                      <Target size={13} />
                      {criterion.stageLabel}: {criterion.label}
                      <ArrowRight size={12} />
                    </Link>
                  )}
                  <div className={styles.milestoneTasks}>
                    {all.map((task) => (
                      <button type="button" key={task.id} onClick={() => onOpen(task.id)}>
                        <span
                          className={
                            task.status === "completed" ? styles.subtaskDone : styles.subtaskOpen
                          }
                        >
                          {task.status === "completed" ? <Check size={12} /> : <Circle size={12} />}
                        </span>
                        {task.title}
                        <span>{formatDate(task)}</span>
                      </button>
                    ))}
                    {!children.length && (
                      <small>Link tasks to this milestone from a task’s detail drawer.</small>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      ) : (
        <div className={styles.emptyState}>
          <Flag size={22} />
          <strong>No milestones yet.</strong>
          <span>Create a milestone, then connect the tasks that move it forward.</span>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={onNew}
            disabled={!canManage}
          >
            <Plus size={14} /> New milestone
          </button>
        </div>
      )}
      <p className={styles.dataNote}>
        Milestones are task records marked as milestones in this local workspace sample.
      </p>
    </div>
  );
}

function CalendarView({
  tasks,
  canEdit,
  month,
  mode,
  selectedDay,
  onSelectDay,
  onChangeMonth,
  onMode,
  onOpen,
  onNew,
}: {
  tasks: StartupTaskItem[];
  canEdit: boolean;
  month: Date;
  mode: "month" | "week";
  selectedDay: string;
  onSelectDay: (day: string) => void;
  onChangeMonth: (date: Date) => void;
  onMode: (mode: "month" | "week") => void;
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  const year = month.getFullYear(),
    monthIndex = month.getMonth();
  const first = new Date(year, monthIndex, 1);
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const today = isoToday();
  const cells = Array.from({ length: Math.ceil((offset + daysInMonth) / 7) * 7 }, (_, index) => {
    const day = index - offset + 1;
    if (day < 1 || day > daysInMonth) return "";
    return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  });
  let visibleDays = cells;
  if (mode === "week") {
    const selected = new Date(`${selectedDay}T12:00:00`);
    const monday = new Date(selected);
    monday.setDate(selected.getDate() - ((selected.getDay() + 6) % 7));
    visibleDays = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      return isoToday(date);
    });
  }
  const tasksByDay = (day: string) =>
    tasks.filter((task) => {
      const date = parseDate(task);
      return date && isoToday(date) === day;
    });
  const selectedTasks = tasksByDay(selectedDay);
  return (
    <div className={styles.calendarCard}>
      <div className={styles.calendarHeader}>
        <div>
          <h2>Calendar</h2>
          <p>Tasks are shown on their due dates. No external calendar is connected.</p>
        </div>
        <div className={styles.calendarActions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => {
              onChangeMonth(new Date());
              onSelectDay(isoToday());
            }}
          >
            Today
          </button>
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => onChangeMonth(new Date(year, monthIndex - 1, 1))}
          >
            <ChevronLeft size={16} />
          </button>
          <strong>{month.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</strong>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => onChangeMonth(new Date(year, monthIndex + 1, 1))}
          >
            <ChevronRight size={16} />
          </button>
          <div className={styles.toggleGroup}>
            <button type="button" aria-pressed={mode === "month"} onClick={() => onMode("month")}>
              Month
            </button>
            <button type="button" aria-pressed={mode === "week"} onClick={() => onMode("week")}>
              Week
            </button>
          </div>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={onNew}
            disabled={!canEdit}
          >
            <Plus size={14} /> New task
          </button>
        </div>
      </div>
      <div className={`${styles.calendarGrid} ${mode === "week" ? styles.weekGrid : ""}`}>
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
          <div className={styles.weekday} key={day}>
            {day}
          </div>
        ))}
        {visibleDays.map((day, index) =>
          day ? (
            <button
              type="button"
              key={day}
              onClick={() => {
                onSelectDay(day);
                onChangeMonth(new Date(`${day}T12:00:00`));
              }}
              className={`${styles.calendarDay} ${day === today ? styles.calendarToday : ""} ${day === selectedDay ? styles.calendarSelected : ""}`}
            >
              <strong>{Number(day.slice(-2))}</strong>
              <div className={styles.calendarChips}>
                {tasksByDay(day)
                  .slice(0, 3)
                  .map((task) => (
                    <span
                      key={task.id}
                      className={`${styles.calendarChip} ${task.isMilestone ? styles.calendarMilestone : ""}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpen(task.id);
                      }}
                    >
                      {task.isMilestone && <Flag size={10} />}
                      {task.title}
                    </span>
                  ))}
                {tasksByDay(day).length > 3 && <small>+{tasksByDay(day).length - 3} more</small>}
              </div>
            </button>
          ) : (
            <div className={styles.calendarBlank} key={`blank-${index}`} />
          ),
        )}
      </div>
      <div className={styles.selectedDayPanel}>
        <div>
          <h3>
            {new Date(`${selectedDay}T12:00:00`).toLocaleDateString("en-IN", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </h3>
          <p>
            {selectedTasks.length} task{selectedTasks.length === 1 ? "" : "s"} scheduled
          </p>
        </div>
        {selectedTasks.length ? (
          <div className={styles.selectedDayTasks}>
            {selectedTasks.map((task) => (
              <button type="button" key={task.id} onClick={() => onOpen(task.id)}>
                <span className={`${styles.dueDot} ${isOverdue(task) ? styles.dotRisk : ""}`} />
                {task.title}
                <small>
                  {task.owner} · {task.priority || "Medium"}
                </small>
              </button>
            ))}
          </div>
        ) : (
          <p className={styles.sideEmpty}>Nothing due on this date.</p>
        )}
      </div>
    </div>
  );
}

function NewTaskDialog({
  team,
  founder,
  criteria,
  milestones,
  initialStatus,
  initialMilestone,
  onClose,
  onCreate,
  onTemplate,
}: {
  team: ReturnType<typeof useStartupWorkspace>["data"]["team"];
  founder: string;
  criteria: Array<{ id: string; label: string; stageId: StartupStageId; stageLabel: string }>;
  milestones: StartupTaskItem[];
  initialStatus: BoardStatus;
  initialMilestone: boolean;
  onClose: () => void;
  onCreate: (
    input: {
      title: string;
      owner: string;
      dueDate: string;
      priority: TaskPriority;
      labels: string[];
      description: string;
      milestone: boolean;
      criterionId: string;
      mentorDeliverable: boolean;
      milestoneId?: string;
      status?: BoardStatus;
    },
    addAnother: boolean,
  ) => void;
  onTemplate: () => void;
}) {
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState(founder);
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("Medium");
  const [labels, setLabels] = useState("");
  const [description, setDescription] = useState("");
  const [milestone, setMilestone] = useState(initialMilestone);
  const [milestoneId, setMilestoneId] = useState("");
  const [criterionId, setCriterionId] = useState("");
  const [mentorDeliverable, setMentorDeliverable] = useState(false);
  const [error, setError] = useState("");
  const submit = (event?: FormEvent<HTMLFormElement>, another = false) => {
    event?.preventDefault();
    if (!title.trim()) {
      setError("Enter a task title.");
      return;
    }
    if (title.trim().length > 140) {
      setError("Task titles are limited to 140 characters.");
      return;
    }
    onCreate(
      {
        title: title.trim(),
        owner,
        dueDate,
        priority,
        labels: labels
          .split(",")
          .map((label) => label.trim())
          .filter(Boolean)
          .slice(0, 8),
        description: description.slice(0, 5000),
        milestone,
        milestoneId,
        criterionId,
        mentorDeliverable,
        status: initialStatus,
      },
      another,
    );
    if (another) {
      setTitle("");
      setDescription("");
      setLabels("");
      setDueDate("");
      setCriterionId("");
      setMilestone(initialMilestone);
      setMilestoneId("");
      setMentorDeliverable(false);
      setError("");
    }
  };
  return (
    <div className={styles.modalBackdrop} role="presentation" onMouseDown={onClose}>
      <div
        className={styles.taskDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-task-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className={styles.dialogHeader}>
          <div>
            <span className={styles.eyebrow}>Work hub</span>
            <h2 id="new-task-title">New task</h2>
            <p>One clear next action is enough to get started.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close new task dialog">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={(event) => submit(event)}>
          <label className={styles.field}>
            <span>
              Task title <small>Required · max 140</small>
            </span>
            <input
              autoFocus
              maxLength={140}
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                setError("");
              }}
              placeholder="What needs to get done?"
            />
          </label>
          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span>Assignee</span>
              <select value={owner} onChange={(event) => setOwner(event.target.value)}>
                {team.map((member) => (
                  <option key={member.id} value={member.name}>
                    {member.name}
                    {member.name === founder ? " · me" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Due date</span>
              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span>Priority</span>
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value as TaskPriority)}
              >
                {PRIORITIES.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Link to stage criterion</span>
              <select value={criterionId} onChange={(event) => setCriterionId(event.target.value)}>
                <option value="">No criterion</option>
                {criteria.map((criterion) => (
                  <option key={criterion.id} value={criterion.id}>
                    {criterion.stageLabel} · {criterion.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className={styles.field}>
            <span>
              Labels <small>Comma-separated · up to 8</small>
            </span>
            <input
              value={labels}
              onChange={(event) => setLabels(event.target.value)}
              placeholder="Discovery, Mentor review"
            />
          </label>
          <label className={styles.field}>
            <span>
              Description <small>Optional · max 5,000</small>
            </span>
            <textarea
              rows={3}
              maxLength={5000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Add context, definition of done or useful links…"
            />
          </label>
          <div className={styles.checkOptions}>
            <label>
              <input
                type="checkbox"
                checked={milestone}
                onChange={(event) => setMilestone(event.target.checked)}
              />
              <span>
                <Flag size={14} /> Mark as milestone
              </span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={mentorDeliverable}
                onChange={(event) => setMentorDeliverable(event.target.checked)}
              />
              <span>
                <MessageSquare size={14} /> Mentor deliverable
              </span>
            </label>
          </div>
          <label className={styles.field}>
            <span>Milestone</span>
            <select value={milestoneId} onChange={(event) => setMilestoneId(event.target.value)}>
              <option value="">No milestone</option>
              {milestones.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
          {error && (
            <p className={styles.formError} role="alert">
              {error}
            </p>
          )}
          <button type="button" className={styles.templateLink} onClick={onTemplate}>
            <Sparkles size={14} /> Use a stage template
          </button>
          <p className={styles.dialogNote}>
            Changes are held in this workspace’s local demo state. Notifications and external
            integrations are not connected.
          </p>
          <div className={styles.dialogActions}>
            <button type="button" className={styles.secondaryButton} onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => submit(undefined, true)}
            >
              Create and add another
            </button>
            <button type="submit" className={styles.primaryButton}>
              <Plus size={14} /> Create task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
function TemplateDialog({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (template: (typeof TEMPLATES)[number]) => void;
}) {
  return (
    <div className={styles.modalBackdrop} role="presentation" onMouseDown={onClose}>
      <div
        className={styles.templateDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className={styles.dialogHeader}>
          <div>
            <span className={styles.eyebrow}>Starter tasks</span>
            <h2 id="template-title">Use a stage template</h2>
            <p>Templates add editable tasks to your current workspace.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close templates">
            <X size={18} />
          </button>
        </div>
        {TEMPLATES.map((template) => (
          <button
            type="button"
            className={styles.templateRow}
            key={template.title}
            onClick={() => onSelect(template)}
          >
            <span>
              <strong>{template.title}</strong>
              <small>
                {template.moduleLabel} · {template.priority} priority
              </small>
            </span>
            <Plus size={15} />
          </button>
        ))}
      </div>
    </div>
  );
}

function TaskDrawer({
  task,
  data,
  canEdit,
  canManage,
  milestones,
  onClose,
  onUpdate,
  onDelete,
  onToggle,
  onMove,
  onDuplicate,
}: {
  task: StartupTaskItem;
  data: ReturnType<typeof useStartupWorkspace>["data"];
  canEdit: boolean;
  canManage: boolean;
  milestones: StartupTaskItem[];
  onClose: () => void;
  onUpdate: (updates: Partial<StartupTaskItem>) => void;
  onDelete: () => void;
  onToggle: () => void;
  onMove: (status: BoardStatus) => void;
  onDuplicate: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [comment, setComment] = useState("");
  const [subtask, setSubtask] = useState("");
  const [labelText, setLabelText] = useState((task.labels || []).join(", "));
  const status = workflowStatus(task);
  const linked = getTaskLink(task, data);
  const subtasks = task.subtasks || [];
  useEffect(() => {
    const handler = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);
  const saveComment = (event: FormEvent) => {
    event.preventDefault();
    if (!comment.trim()) return;
    onUpdate({
      comments: [
        ...(task.comments || []),
        {
          id: `c-${Date.now()}`,
          author: data.startup.founderName,
          text: comment.trim(),
          createdAt: new Date().toISOString(),
        },
      ],
    });
    setComment("");
  };
  const addSubtask = (event: FormEvent) => {
    event.preventDefault();
    if (!subtask.trim() || subtasks.length >= 50) return;
    onUpdate({
      subtasks: [...subtasks, { id: `st-${Date.now()}`, title: subtask.trim(), completed: false }],
    });
    setSubtask("");
  };
  return (
    <div className={styles.drawerBackdrop} role="presentation" onMouseDown={onClose}>
      <aside
        className={styles.taskDrawer}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-task-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={styles.drawerHead}>
          <div>
            <span className={styles.eyebrow}>Task details</span>
            <p>
              {task.isMilestone && (
                <span className={styles.milestonePill}>
                  <Flag size={10} /> Milestone
                </span>
              )}{" "}
              {task.mentorDeliverable && (
                <span className={styles.mentorPill}>Mentor deliverable</span>
              )}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close task details">
            <X size={18} />
          </button>
        </header>
        <div className={styles.drawerScroll}>
          <label className={styles.drawerTitleLabel}>
            <span className={styles.srOnly}>Task title</span>
            <textarea
              id="drawer-task-title"
              value={title}
              maxLength={140}
              rows={2}
              disabled={!canEdit}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={() => {
                if (title.trim() && title !== task.title) onUpdate({ title: title.trim() });
              }}
            />
          </label>
          <div className={styles.drawerStatusBar}>
            <label>
              Status
              <select
                value={status}
                disabled={!canEdit}
                onChange={(event) => onMove(event.target.value as BoardStatus)}
              >
                {COLUMNS.map((column) => (
                  <option key={column.id} value={column.id}>
                    {column.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Priority
              <select
                value={task.priority || "Medium"}
                disabled={!canEdit}
                onChange={(event) => onUpdate({ priority: event.target.value as TaskPriority })}
              >
                {PRIORITIES.map((priority) => (
                  <option key={priority}>{priority}</option>
                ))}
              </select>
            </label>
          </div>
          <section className={styles.drawerSection}>
            <h3>Task fields</h3>
            <div className={styles.drawerFields}>
              <label>
                Assignee
                <select
                  value={task.owner}
                  disabled={!canEdit}
                  onChange={(event) => onUpdate({ owner: event.target.value })}
                >
                  {data.team
                    .filter((member) => member.status !== "Deactivated")
                    .map((member) => (
                      <option key={member.id}>{member.name}</option>
                    ))}
                </select>
              </label>
              <label>
                Due date
                <input
                  type="date"
                  value={task.dueDate || ""}
                  disabled={!canEdit}
                  onChange={(event) =>
                    onUpdate({
                      dueDate: event.target.value || undefined,
                      dueLabel: event.target.value
                        ? `Due ${new Date(`${event.target.value}T12:00:00`).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}`
                        : "No due date",
                    })
                  }
                />
              </label>
              <label>
                Milestone
                <select
                  value={task.milestoneId || ""}
                  disabled={!canEdit}
                  onChange={(event) => onUpdate({ milestoneId: event.target.value || undefined })}
                >
                  <option value="">No milestone</option>
                  {milestones.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Stage criterion
                <select
                  value={task.linkedCriterionId || ""}
                  disabled={!canEdit}
                  onChange={(event) =>
                    onUpdate({ linkedCriterionId: event.target.value || undefined })
                  }
                >
                  <option value="">No criterion</option>
                  {data.stages.flatMap((stage) =>
                    stage.exitCriteria.map((criterion) => (
                      <option key={criterion.id} value={criterion.id}>
                        {stage.label} · {criterion.label}
                      </option>
                    )),
                  )}
                </select>
              </label>
              <label className={styles.fullField}>
                Labels
                <input
                  value={labelText}
                  disabled={!canEdit}
                  onChange={(event) => setLabelText(event.target.value)}
                  onBlur={() =>
                    onUpdate({
                      labels: labelText
                        .split(",")
                        .map((label) => label.trim())
                        .filter(Boolean)
                        .slice(0, 8),
                    })
                  }
                  placeholder="Comma-separated · max 8"
                />
              </label>
            </div>
          </section>
          <section className={styles.drawerSection}>
            <h3>Description</h3>
            <textarea
              rows={4}
              value={description}
              maxLength={5000}
              disabled={!canEdit}
              onChange={(event) => setDescription(event.target.value)}
              onBlur={() => onUpdate({ description })}
              placeholder="Add context, acceptance criteria or links…"
            />
          </section>
          <section className={styles.drawerSection}>
            <div className={styles.sectionTitle}>
              <h3>
                Subtasks{" "}
                <span>
                  {subtasks.filter((item) => item.completed).length}/{subtasks.length}
                </span>
              </h3>
            </div>
            {subtasks.map((item) => (
              <label className={styles.subtaskRow} key={item.id}>
                <input
                  type="checkbox"
                  checked={item.completed}
                  disabled={!canEdit}
                  onChange={(event) =>
                    onUpdate({
                      subtasks: subtasks.map((sub) =>
                        sub.id === item.id ? { ...sub, completed: event.target.checked } : sub,
                      ),
                    })
                  }
                />
                <span className={item.completed ? styles.subtaskDoneText : ""}>{item.title}</span>
              </label>
            ))}
            {canEdit && (
              <form className={styles.inlineAdd} onSubmit={addSubtask}>
                <input
                  value={subtask}
                  onChange={(event) => setSubtask(event.target.value)}
                  placeholder="Add a subtask"
                  maxLength={140}
                />
                <button
                  type="submit"
                  disabled={!subtask.trim() || subtasks.length >= 50}
                  aria-label="Add subtask"
                >
                  <Plus size={15} />
                </button>
              </form>
            )}
          </section>
          <section className={styles.drawerSection}>
            <h3>Linked to</h3>
            <Link href={linked.href} className={styles.linkedChip}>
              <Link2 size={13} />
              {linked.label}
              <ExternalLink size={11} />
            </Link>
            {task.milestoneId && (
              <span className={styles.linkedChip}>
                <Flag size={13} />
                {milestones.find((item) => item.id === task.milestoneId)?.title ||
                  "Linked milestone"}
              </span>
            )}
          </section>
          <section className={styles.drawerSection}>
            <div className={styles.sectionTitle}>
              <h3>Attachments</h3>
              <Paperclip size={14} />
            </div>
            <div className={styles.attachmentNote}>
              <FileText size={16} />
              <span>Document Vault attachment picker isn’t connected in this demo.</span>
            </div>
          </section>
          <section className={styles.drawerSection}>
            <h3>
              Comments <span>{task.comments?.length || 0}</span>
            </h3>
            {(task.comments || []).map((item) => (
              <article className={styles.comment} key={item.id}>
                <span className={styles.avatar}>{initials(item.author)}</span>
                <div>
                  <strong>
                    {item.author}{" "}
                    {item.mentor && <small className={styles.mentorPill}>Mentor</small>}
                  </strong>
                  <p>{item.text}</p>
                  <time>
                    {new Date(item.createdAt).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </time>
                </div>
              </article>
            ))}
            {canEdit ? (
              <form className={styles.commentForm} onSubmit={saveComment}>
                <textarea
                  rows={2}
                  maxLength={2000}
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="Write a comment…"
                />
                <button type="submit" disabled={!comment.trim()}>
                  <Send size={14} /> Comment
                </button>
              </form>
            ) : (
              <p className={styles.dataNote}>Comments are read only.</p>
            )}
          </section>
          <section className={styles.drawerSection}>
            <h3>Activity</h3>
            {data.recentActivity
              .filter((activity) => activity.target === task.title)
              .slice(0, 5)
              .map((activity) => (
                <div className={styles.activityItem} key={activity.id}>
                  <span className={styles.activityDot} />
                  <p>
                    <strong>{activity.actor}</strong> {activity.action}
                    <small>{activity.timestamp}</small>
                  </p>
                </div>
              ))}
            {!data.recentActivity.some((activity) => activity.target === task.title) && (
              <p className={styles.dataNote}>No recent activity recorded for this task.</p>
            )}
          </section>
        </div>
        <footer className={styles.drawerFooter}>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={!canEdit || task.status === "completed"}
            onClick={onToggle}
          >
            <CheckCircle2 size={15} /> Mark complete
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            disabled={!canEdit}
            onClick={onDuplicate}
          >
            Duplicate
          </button>
          {canManage && (
            <button type="button" className={styles.dangerText} onClick={onDelete}>
              <Trash2 size={14} /> Delete
            </button>
          )}
        </footer>
      </aside>
    </div>
  );
}
