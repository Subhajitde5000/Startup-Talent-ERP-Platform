"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CheckCheck,
  CircleHelp,
  FileText,
  LifeBuoy,
  Search,
  Ticket,
} from "lucide-react";
import { useStartupNotifications } from "@/context/StartupNotificationContext";
import styles from "./StartupSharedPages.module.css";

const FAQS = [
  {
    q: "Where does the demo data come from?",
    a: "Every founder, mentor and investor workspace is seeded with fictional illustrative records stored in the browser. You can edit, filter and save changes locally; Reset demo data in Settings restores the original set.",
  },
  {
    q: "How do stage exit criteria work?",
    a: "Each stage has a checklist of criteria. Mark items complete, attach evidence, and request mentor review. Stage progress is a workspace record — it is not an investment readiness score.",
  },
  {
    q: "Can I switch between roles?",
    a: "Yes. Use the Switch role control in the founder top bar, or open the workspace portal at / to jump directly to the founder, mentor or investor demo workspace.",
  },
  {
    q: "Are notifications delivered?",
    a: "No. Notification records are derived from local workspace activity. Email, push and connected notification services are not part of this demo.",
  },
  {
    q: "How do I change the theme?",
    a: "Use the sun/moon toggle in the top bar of any workspace, or open Settings → Appearance to choose light or dark mode.",
  },
  {
    q: "Is financial or investment advice provided?",
    a: "No. All figures, offers, commitments and valuations are illustrative demo records. The platform does not broker deals, move funds or give regulated advice.",
  },
];

const TICKETS = [
  {
    id: "TKT-2041",
    subject: "Invite link for a new team member",
    category: "Team & permissions",
    status: "In progress",
    updated: "4 Nov 2026",
  },
  {
    id: "TKT-2038",
    subject: "Data room access scope question",
    category: "Investor hub",
    status: "Waiting for you",
    updated: "1 Nov 2026",
  },
  {
    id: "TKT-2029",
    subject: "Export analytics as CSV",
    category: "Business analytics",
    status: "Resolved",
    updated: "24 Oct 2026",
  },
];

function PageHead({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children?: React.ReactNode;
}) {
  return (
    <header className={styles.header}>
      <div>
        <span className={styles.eyebrow}>{eyebrow}</span>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.subtitle}>{subtitle}</p>
      </div>
      {children}
    </header>
  );
}

export function StartupHelpPage() {
  const [query, setQuery] = useState("");
  const faqs = useMemo(
    () =>
      FAQS.filter((item) =>
        `${item.q} ${item.a}`.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [query],
  );
  return (
    <div className={styles.page}>
      <PageHead
        eyebrow="Founder workspace · Help center"
        title="How can we help?"
        subtitle="Guides for the founder workspace, stage workflow, hiring and investor readiness."
      >
        <Link className={styles.button} href="/startup/dashboard">
          Back to dashboard <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </PageHead>

      <section className={styles.card}>
        <h2>Search the help center</h2>
        <p className={styles.cardHint}>Filter the most common founder questions.</p>
        <label className={styles.search}>
          <Search size={16} aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search guides, e.g. stage criteria"
            aria-label="Search help articles"
          />
        </label>
        <div className={styles.faqList}>
          {faqs.length ? (
            faqs.map((item) => (
              <details className={styles.faqItem} key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))
          ) : (
            <p className={styles.empty}>No guide matched “{query}”. Try a shorter search.</p>
          )}
        </div>
      </section>

      <section className={styles.card}>
        <h2>Quick links</h2>
        <p className={styles.cardHint}>Jump straight to the workspace area you need.</p>
        <div className={styles.grid}>
          {[
            {
              href: "/startup/stage",
              label: "Stage roadmap",
              text: "Checklists, evidence and exit criteria.",
            },
            {
              href: "/startup/tasks",
              label: "Tasks",
              text: "Board, list, milestones and calendar views.",
            },
            {
              href: "/startup/hiring",
              label: "Hiring",
              text: "Requisitions, jobs and the candidate pipeline.",
            },
            {
              href: "/startup/investors",
              label: "Investor hub",
              text: "Pipeline, data room and visibility settings.",
            },
            {
              href: "/startup/analytics",
              label: "Business analytics",
              text: "Monthly metrics, runway and market sizing.",
            },
            {
              href: "/startup/settings",
              label: "Settings",
              text: "Theme, notifications and demo data controls.",
            },
          ].map((item) => (
            <Link className={styles.linkCard} href={item.href} key={item.href}>
              <strong>{item.label}</strong>
              <span>{item.text}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className={styles.card}>
        <h2>Contact support</h2>
        <p className={styles.cardHint}>
          Support tickets below are illustrative demo records. No message leaves this browser.
        </p>
        <div className={styles.actions}>
          <Link
            className={`${styles.button} ${styles.buttonPrimary}`}
            href="/help/tickets?role=startup"
          >
            <Ticket size={15} aria-hidden="true" /> View my tickets
          </Link>
          <Link className={styles.button} href="/terms">
            <FileText size={15} aria-hidden="true" /> Terms of service
          </Link>
        </div>
      </section>
    </div>
  );
}

export function StartupNotificationsPage() {
  const { notifications, unreadCount, readIds, markRead, markAllRead, markUnread } =
    useStartupNotifications();
  return (
    <div className={styles.page}>
      <PageHead
        eyebrow="Founder workspace · Notifications"
        title="Notifications"
        subtitle={`${unreadCount} unread · derived from local workspace activity.`}
      >
        <button
          className={styles.button}
          type="button"
          onClick={markAllRead}
          disabled={!unreadCount}
        >
          <CheckCheck size={15} aria-hidden="true" /> Mark all read
        </button>
      </PageHead>
      <section className={styles.card}>
        <h2>Recent activity</h2>
        <p className={styles.cardHint}>Task reminders, team changes and mentor updates.</p>
        {notifications.length ? (
          notifications.map((item) => {
            const unread = !readIds.includes(item.id);
            return (
              <div className={styles.row} key={item.id}>
                <span className={styles.icon}>
                  {item.category === "tasks" ? (
                    <CheckCheck size={17} aria-hidden="true" />
                  ) : item.category === "documents" ? (
                    <FileText size={17} aria-hidden="true" />
                  ) : (
                    <BookOpen size={17} aria-hidden="true" />
                  )}
                </span>
                <span className={styles.rowBody}>
                  <strong>{item.title}</strong>
                  <small>
                    {item.detail} · {item.timestamp}
                  </small>
                </span>
                {unread && <span className={styles.badge}>New</span>}
                <Link className={styles.button} href={item.href}>
                  Open
                </Link>
                <button
                  className={styles.button}
                  type="button"
                  onClick={() => (unread ? markRead(item.id) : markUnread(item.id))}
                >
                  {unread ? "Mark read" : "Mark unread"}
                </button>
              </div>
            );
          })
        ) : (
          <p className={styles.empty}>You&apos;re all caught up.</p>
        )}
      </section>
    </div>
  );
}

export function StartupTicketsPage() {
  return (
    <div className={styles.page}>
      <PageHead
        eyebrow="Founder workspace · Support"
        title="Support tickets"
        subtitle="Illustrative support requests for this demo workspace."
      >
        <Link className={styles.button} href="/help?role=startup">
          <LifeBuoy size={15} aria-hidden="true" /> Help center
        </Link>
      </PageHead>
      <section className={styles.card}>
        <h2>Your tickets</h2>
        <p className={styles.cardHint}>
          Status values are demo records and are not connected to support.
        </p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Subject</th>
                <th>Category</th>
                <th>Status</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {TICKETS.map((ticket) => (
                <tr key={ticket.id}>
                  <td>{ticket.id}</td>
                  <td>{ticket.subject}</td>
                  <td>{ticket.category}</td>
                  <td>
                    <span
                      className={`${styles.badge} ${
                        ticket.status === "Resolved" ? styles.badgeMuted : ""
                      }`}
                    >
                      {ticket.status}
                    </span>
                  </td>
                  <td>{ticket.updated}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className={styles.card}>
        <h2>Still need help?</h2>
        <p className={styles.cardHint}>
          Browse the founder help center for step-by-step guides on every workspace module.
        </p>
        <div className={styles.actions}>
          <Link className={`${styles.button} ${styles.buttonPrimary}`} href="/help?role=startup">
            <CircleHelp size={15} aria-hidden="true" /> Browse guides
          </Link>
          <Link className={styles.button} href="/startup/dashboard">
            Back to dashboard <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  );
}
