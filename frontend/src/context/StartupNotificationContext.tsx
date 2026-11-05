"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useStartupWorkspace } from "@/context/StartupWorkspaceContext";
import { StartupActivityItem, StartupTaskItem } from "@/types/startup";

export type StartupNotificationCategory = "tasks" | "mentors" | "team" | "documents" | "milestones";
export interface StartupNotification {
  id: string;
  category: StartupNotificationCategory;
  title: string;
  detail: string;
  timestamp: string;
  href: string;
  source: "Workspace activity" | "Task status";
}
const READ_KEY = "meridian-startup-notifications-read-v1";
const SETTINGS_KEY = "meridian-startup-settings-v1";
const DEFAULT_ENABLED = {
  tasks: true,
  mentors: true,
  team: true,
  documents: true,
  milestones: true,
};
function buildNotifications(
  activities: StartupActivityItem[],
  tasks: StartupTaskItem[],
): StartupNotification[] {
  const activityNotifications = activities.map((item) => ({
    id: `activity-${item.id}`,
    category: (item.category === "mentor"
      ? "mentors"
      : item.category === "team"
        ? "team"
        : item.category === "document"
          ? "documents"
          : "milestones") as StartupNotificationCategory,
    title: `${item.actor} ${item.action}`,
    detail: item.target,
    timestamp: item.timestamp,
    href:
      item.category === "mentor"
        ? "/startup/roadmap"
        : item.category === "team"
          ? "/startup/team"
          : item.category === "document"
            ? "/startup/data-room"
            : "/startup/tasks",
    source: "Workspace activity" as const,
  }));
  const overdue = tasks.filter(
    (task) =>
      task.status === "overdue" ||
      (task.status !== "completed" &&
        task.dueDate &&
        new Date(`${task.dueDate}T23:59:59`).getTime() < Date.now()),
  );
  const taskNotifications = overdue.map((task) => ({
    id: `task-overdue-${task.id}`,
    category: "tasks" as const,
    title: "Task overdue",
    detail: task.title,
    timestamp: task.dueLabel || "Due date passed",
    href: "/startup/tasks",
    source: "Task status" as const,
  }));
  return [...taskNotifications, ...activityNotifications];
}
interface NotificationContextValue {
  notifications: StartupNotification[];
  unreadCount: number;
  readIds: string[];
  markRead: (id: string) => void;
  markAllRead: () => void;
  markUnread: (id: string) => void;
}
const NotificationContext = createContext<NotificationContextValue | null>(null);
export function StartupNotificationProvider({ children }: { children: React.ReactNode }) {
  const { data } = useStartupWorkspace();
  const [readIds, setReadIds] = useState<string[]>([]);
  const [enabled, setEnabled] =
    useState<Record<StartupNotificationCategory, boolean>>(DEFAULT_ENABLED);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const load = () => {
      try {
        const saved = localStorage.getItem(READ_KEY);
        setReadIds(saved ? (JSON.parse(saved) as string[]) : []);
        const settings = localStorage.getItem(SETTINGS_KEY);
        if (settings) {
          const parsed = JSON.parse(settings) as {
            notifications?: Partial<typeof DEFAULT_ENABLED>;
          };
          setEnabled({ ...DEFAULT_ENABLED, ...parsed.notifications });
        } else {
          setEnabled(DEFAULT_ENABLED);
        }
      } catch {
        /* use local defaults */
      }
      setHydrated(true);
    };
    load();
    const listener = () => load();
    window.addEventListener("startup-notification-settings-updated", listener);
    return () => window.removeEventListener("startup-notification-settings-updated", listener);
  }, []);
  useEffect(() => {
    if (hydrated) {
      try {
        localStorage.setItem(READ_KEY, JSON.stringify(readIds));
      } catch {
        /* best effort */
      }
    }
  }, [hydrated, readIds]);
  const notifications = useMemo(
    () =>
      buildNotifications(data.recentActivity, data.tasks).filter((item) => enabled[item.category]),
    [data.recentActivity, data.tasks, enabled],
  );
  const readSet = new Set(readIds);
  const value = useMemo(
    () => ({
      notifications,
      unreadCount: notifications.filter((item) => !readSet.has(item.id)).length,
      readIds,
      markRead: (id: string) => setReadIds((ids) => (ids.includes(id) ? ids : [...ids, id])),
      markAllRead: () =>
        setReadIds((ids) => Array.from(new Set([...ids, ...notifications.map((item) => item.id)]))),
      markUnread: (id: string) => setReadIds((ids) => ids.filter((item) => item !== id)),
    }),
    [notifications, readIds],
  );
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}
export function useStartupNotifications() {
  const value = useContext(NotificationContext);
  if (!value)
    throw new Error("useStartupNotifications must be used within StartupNotificationProvider");
  return value;
}
