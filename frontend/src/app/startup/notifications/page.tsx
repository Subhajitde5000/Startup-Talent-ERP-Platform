"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Check,
  CheckCheck,
  Clock3,
  FileText,
  Filter,
  Inbox,
  LockKeyhole,
  MessageSquareText,
  Users,
  X,
} from "lucide-react";
import { useStartupWorkspace } from "@/context/StartupWorkspaceContext";
import {
  useStartupNotifications,
  StartupNotificationCategory,
} from "@/context/StartupNotificationContext";
import styles from "./Notifications.module.css";

type FilterKey = "all" | "unread" | StartupNotificationCategory;
const FILTERS: Array<{ id: FilterKey; label: string; icon: React.ReactNode }> = [
  { id: "all", label: "All activity", icon: <Activity size={14} /> },
  { id: "unread", label: "Unread", icon: <Inbox size={14} /> },
  { id: "tasks", label: "Tasks", icon: <AlertCircle size={14} /> },
  { id: "mentors", label: "Mentors", icon: <MessageSquareText size={14} /> },
  { id: "team", label: "Team", icon: <Users size={14} /> },
  { id: "documents", label: "Documents", icon: <FileText size={14} /> },
  { id: "milestones", label: "Milestones", icon: <CheckCheck size={14} /> },
];
const categoryName: Record<StartupNotificationCategory, string> = {
  tasks: "Tasks",
  mentors: "Mentor activity",
  team: "Team",
  documents: "Documents",
  milestones: "Milestones",
};
export default function NotificationsPage() {
  const { data } = useStartupWorkspace();
  const { notifications, unreadCount, readIds, markRead, markAllRead, markUnread } =
    useStartupNotifications();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [showRead, setShowRead] = useState(true);
  const unread = new Set(readIds);
  const filtered = useMemo(
    () =>
      notifications.filter(
        (item) =>
          (filter === "all" ||
            (filter === "unread" ? !unread.has(item.id) : item.category === filter)) &&
          (showRead || !unread.has(item.id)) &&
          `${item.title} ${item.detail} ${item.category}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [notifications, filter, showRead, search, readIds],
  );
  return (
    <div className={styles.page}>
      <a href="#notifications-main" className={styles.skip}>
        Skip to notifications
      </a>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Startup workspace · Inbox</span>
          <h1>Notifications</h1>
          <p>Workspace events and task reminders. Email and push delivery are not connected.</p>
        </div>
        <div className={styles.headerActions}>
          <Link className={styles.secondaryButton} href="/startup/settings?tab=notifications">
            <LockKeyhole size={14} /> Notification settings
          </Link>
          <button className={styles.primaryButton} onClick={markAllRead} disabled={!unreadCount}>
            <CheckCheck size={14} /> Mark all read
          </button>
        </div>
      </header>
      <div className={styles.disclosure}>
        <Activity size={15} />
        <span>
          <strong>Workspace activity snapshot</strong> · These entries are derived from the current
          workspace tasks and activity feed{data.isMockData ? " (illustrative sample data)" : ""}.
          They are not external email, calendar or push notifications.
        </span>
      </div>
      <main id="notifications-main" className={styles.layout}>
        <aside className={styles.filterPanel}>
          <span className={styles.filterHeading}>
            <Filter size={14} /> Filters
          </span>
          <nav aria-label="Notification filters">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                className={filter === item.id ? styles.filterActive : styles.filterItem}
                onClick={() => setFilter(item.id)}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.id === "unread" && <small>{unreadCount}</small>}
              </button>
            ))}
          </nav>
          <label className={styles.showRead}>
            <input
              type="checkbox"
              checked={showRead}
              onChange={(e) => setShowRead(e.target.checked)}
            />{" "}
            Show read notifications
          </label>
          <div className={styles.sourceNote}>
            <Clock3 size={13} />
            <span>
              Times and statuses come from the workspace data shown on linked pages. Nothing is sent
              to a device or external inbox.
            </span>
          </div>
        </aside>
        <section className={styles.listPanel}>
          <div className={styles.listToolbar}>
            <div>
              <h2>
                {filter === "all"
                  ? "All activity"
                  : filter === "unread"
                    ? "Unread notifications"
                    : categoryName[filter]}
              </h2>
              <p>
                {filtered.length} {filtered.length === 1 ? "item" : "items"} · {unreadCount} unread
              </p>
            </div>
            <label className={styles.search}>
              <Activity size={14} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search notifications"
                aria-label="Search notifications"
              />
              {search && (
                <button onClick={() => setSearch("")} aria-label="Clear search">
                  <X size={13} />
                </button>
              )}
            </label>
          </div>
          {filtered.length ? (
            <div className={styles.notificationList}>
              {filtered.map((item) => {
                const isRead = unread.has(item.id);
                return (
                  <article
                    className={`${styles.notification} ${!isRead ? styles.unread : ""}`}
                    key={item.id}
                  >
                    <span className={`${styles.icon} ${styles[item.category]}`}>
                      {item.category === "tasks" ? (
                        <AlertCircle size={16} />
                      ) : item.category === "mentors" ? (
                        <MessageSquareText size={16} />
                      ) : item.category === "team" ? (
                        <Users size={16} />
                      ) : item.category === "documents" ? (
                        <FileText size={16} />
                      ) : (
                        <CheckCheck size={16} />
                      )}
                    </span>
                    <div className={styles.copy}>
                      <div className={styles.titleRow}>
                        <h3>{item.title}</h3>
                        {!isRead && <span className={styles.newDot} aria-label="Unread" />}
                      </div>
                      <p>{item.detail}</p>
                      <div className={styles.meta}>
                        <span>{categoryName[item.category]}</span>
                        <span>{item.timestamp}</span>
                        <span>{item.source}</span>
                      </div>
                      <div className={styles.actions}>
                        <Link href={item.href} onClick={() => markRead(item.id)}>
                          View source <ArrowRight size={12} />
                        </Link>
                        {isRead ? (
                          <button type="button" onClick={() => markUnread(item.id)}>
                            Mark unread
                          </button>
                        ) : (
                          <button type="button" onClick={() => markRead(item.id)}>
                            <Check size={12} /> Mark read
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className={styles.empty}>
              <span>
                <Inbox size={22} />
              </span>
              <strong>
                {search
                  ? "No matching notifications."
                  : filter === "unread"
                    ? "You’re all caught up."
                    : "No notifications in this view."}
              </strong>
              <p>
                {search
                  ? "Try another search phrase."
                  : "New activity from the workspace and task reminders will appear here when the source data changes."}
              </p>
              {filter !== "all" && (
                <button className={styles.secondaryButton} onClick={() => setFilter("all")}>
                  Show all activity
                </button>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
