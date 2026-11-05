"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  Archive,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BellOff,
  BookOpen,
  CalendarClock,
  Check,
  ChevronRight,
  Clock3,
  Download,
  ExternalLink,
  FileText,
  Filter,
  HelpCircle,
  Inbox,
  Info,
  KeyRound,
  LifeBuoy,
  LockKeyhole,
  Mail,
  MessageSquare,
  Monitor,
  MoreHorizontal,
  Paperclip,
  Plus,
  Search,
  Send,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Ticket,
  Trash2,
  Undo2,
  UserRound,
  X,
} from "lucide-react";
import {
  MentorConversation,
  MentorNotification,
  MentorNotificationCategory,
  MentorRoleData,
  useMentorRole,
} from "@/context/MentorRoleContext";
import styles from "./MentorSharedPages.module.css";

const dateLabel = (value: string) =>
  value
    ? new Date(value).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";
const todayLabel = (value: string) => {
  const d = new Date(value),
    n = new Date();
  if (d.toDateString() === n.toDateString()) return "Today";
  const y = new Date(n);
  y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return "Earlier this week";
};
const conversationMatches = (c: MentorConversation, filter: string) => {
  if (filter === "All") return !c.archived;
  if (filter === "Unread") return c.unread > 0;
  if (filter === "Archived") return c.archived;
  if (filter === "Admin and support") return c.context === "Support";
  if (filter === "Startups") return c.context === "Startup";
  if (filter === "Sessions") return c.context === "Session";
  if (filter === "Sign-offs") return c.context === "Sign-off";
  return true;
};

export function MentorMessagesPage() {
  const router = useRouter();
  const { data, setData } = useMentorRole();
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [toast, setToast] = useState("");
  const verified = data.verifiedStatus === "Verified";
  const visible = data.conversations
    .filter((c) => verified || c.participantType !== "Startup")
    .filter((c) => conversationMatches(c, filter))
    .filter((c) =>
      `${c.participantName} ${c.preview} ${c.messages.flatMap((m) => [m.body, ...(m.files || [])]).join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    );
  const active = visible.find((c) => c.id === selected) || visible[0];
  const notice = (s: string) => {
    setToast(s);
    window.setTimeout(() => setToast(""), 3200);
  };
  const openConversation = (c: MentorConversation) => {
    setSelected(c.id);
    setData((d) => ({
      ...d,
      conversations: d.conversations.map((x) => (x.id === c.id ? { ...x, unread: 0 } : x)),
    }));
  };
  return (
    <div className={styles.page}>
      <PageHeading
        icon={<MessageSquare />}
        title="Messages"
        subtitle="Mentor conversations with startups, sessions, sign-offs and support."
        role="Mentor"
        action={
          <button className={styles.primary} onClick={() => setNewOpen(true)}>
            <Plus size={15} /> New message
          </button>
        }
      />
      <StatusBanner status={data.verifiedStatus} />
      <div className={styles.inbox}>
        <aside className={styles.conversationPane}>
          <div className={styles.search}>
            <Search size={15} />
            <input
              aria-label="Search messages"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search names, messages, files"
            />
          </div>
          <div className={styles.filterBar}>
            {[
              "All",
              "Startups",
              "Sessions",
              "Sign-offs",
              "Admin and support",
              "Unread",
              "Archived",
            ].map((t) => (
              <button
                key={t}
                className={filter === t ? styles.filterActive : styles.filter}
                onClick={() => setFilter(t)}
              >
                {t}
                {t === "Unread" && (
                  <b>{data.conversations.reduce((n, c) => n + c.unread, 0) || ""}</b>
                )}
              </button>
            ))}
          </div>
          <div className={styles.conversationList}>
            {visible.length ? (
              visible.map((c) => (
                <button
                  key={c.id}
                  className={`${styles.conversation} ${active?.id === c.id ? styles.conversationActive : ""}`}
                  onClick={() => openConversation(c)}
                >
                  <span className={styles.avatar}>
                    {c.participantType === "Startup" ? (
                      c.participantName.slice(0, 1)
                    ) : (
                      <LifeBuoy size={17} />
                    )}
                  </span>
                  <span className={styles.conversationText}>
                    <span className={styles.conversationTop}>
                      <strong>{c.participantName}</strong>
                      <small>{dateLabel(c.updatedAt)}</small>
                    </span>
                    <span className={styles.preview}>{c.preview}</span>
                    <span className={styles.chips}>
                      <i>
                        {c.context === "Support"
                          ? "Support"
                          : c.context === "Startup"
                            ? `${c.status || "Mentorship"} · ${data.startups.find((s) => s.id === c.mentorshipId)?.stage || "Startup"}`
                            : c.context}
                      </i>
                      {c.unread > 0 && <b className={styles.unreadCount}>{c.unread}</b>}
                    </span>
                  </span>
                  {c.unread > 0 && <span className={styles.unreadDot} />}
                </button>
              ))
            ) : (
              <div className={styles.listEmpty}>
                <span className={styles.emptyIcon}>
                  <Inbox size={19} />
                </span>
                <strong>{query ? "No matching conversations." : "No messages yet."}</strong>
                <p>
                  {verified
                    ? "Conversations appear when you accept a startup or reply to a request."
                    : "Until verification, only admin and support conversations are available."}
                </p>
                {!query && (
                  <Link className={styles.textLink} href="/mentor/requests">
                    View requests <ArrowRight size={13} />
                  </Link>
                )}
              </div>
            )}
          </div>
        </aside>
        <main className={styles.threadPane}>
          {active ? (
            <>
              <header className={styles.threadHead}>
                <div className={styles.threadAvatar}>{active.participantName.slice(0, 1)}</div>
                <div>
                  <h2>{active.participantName}</h2>
                  <small>
                    {active.context === "Support"
                      ? `Support · ${active.ticketRef || "Ticket reference unavailable"}`
                      : `${active.status || "Mentorship"} · ${active.context}`}
                  </small>
                </div>
                <div className={styles.threadActions}>
                  <Link
                    className={styles.softButton}
                    href={
                      active.mentorshipId
                        ? `/mentor/startups/${active.mentorshipId}`
                        : "/help/tickets"
                    }
                  >
                    {active.context === "Support" ? "Open ticket" : "Open workspace"}{" "}
                    <ArrowUpRight size={13} />
                  </Link>
                  <button
                    className={styles.iconButton}
                    aria-label="Conversation options"
                    onClick={() => notice("Conversation actions are not connected.")}
                  >
                    <MoreHorizontal size={17} />
                  </button>
                </div>
              </header>
              {active.readOnly && (
                <div className={styles.readonly}>
                  <LockKeyhole size={14} /> This mentorship has ended. Messages are read-only.
                </div>
              )}
              <div className={styles.messages}>
                {active.messages.length ? (
                  active.messages.map((m) => (
                    <div
                      key={m.id}
                      className={`${styles.message} ${m.sender === "Mentor" ? styles.myMessage : m.sender === "System" ? styles.systemMessage : ""}`}
                    >
                      <span className={styles.messageSender}>
                        {m.sender === "Mentor"
                          ? "You"
                          : m.sender === "System"
                            ? "Platform"
                            : active.participantName}
                      </span>
                      <p>{m.body}</p>
                      {m.files?.map((f) => (
                        <span className={styles.fileChip} key={f}>
                          <Paperclip size={12} />
                          {f}
                        </span>
                      ))}
                      <small>
                        {dateLabel(m.date)}
                        {m.sender === "Mentor" && m.read ? " · Read" : ""}
                      </small>
                      <button
                        className={styles.privateButton}
                        onClick={() =>
                          notice("Private-note storage is not connected; nothing was saved.")
                        }
                      >
                        Save as private note
                      </button>
                    </div>
                  ))
                ) : (
                  <div className={styles.threadEmpty}>
                    <MessageSquare size={23} />
                    <strong>No messages to show.</strong>
                    <span>Messages are not connected; no conversation history is fabricated.</span>
                  </div>
                )}
              </div>
              <div className={styles.composer}>
                <div className={styles.composerTools}>
                  <select aria-label="Insert related item" defaultValue="">
                    <option value="" disabled>
                      Insert related item
                    </option>
                    <option>Link a task</option>
                    <option>Link a deliverable</option>
                    <option>Link a session</option>
                    <option>Link a readiness item</option>
                  </select>
                  <select aria-label="Message template" defaultValue="">
                    <option value="" disabled>
                      Templates
                    </option>
                    <option>Prep for our next session</option>
                    <option>Following up on the deliverable</option>
                    <option>Request a document</option>
                    <option>Session summary shared</option>
                    <option>Sign-off request needs changes</option>
                  </select>
                  <button className={styles.iconButton} disabled aria-label="Attach file">
                    <Paperclip size={15} />
                  </button>
                </div>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value.slice(0, 5000))}
                  maxLength={5000}
                  disabled={active.readOnly}
                  placeholder="Keep mentorship conversations on the platform. Secure messaging is not connected."
                />
                <div className={styles.composerBottom}>
                  <small>
                    {draft.length}/5,000 · Startups usually expect a reply within 2 days.
                  </small>
                  <button
                    className={styles.primary}
                    disabled={!draft.trim() || active.readOnly}
                    onClick={() =>
                      notice(
                        "Message service unavailable. Your text remains in the composer draft.",
                      )
                    }
                  >
                    <Send size={13} /> Send
                  </button>
                </div>
                <small className={styles.composerCaption}>
                  Keep mentorship conversations on the platform. No off-platform payment, equity
                  promises, or investment solicitation.
                </small>
              </div>
            </>
          ) : (
            <div className={styles.threadEmpty}>
              <MessageSquare size={24} />
              <strong>Select a conversation</strong>
              <span>Or start a permitted message after a relationship is connected.</span>
              <button className={styles.secondary} onClick={() => setNewOpen(true)}>
                New message
              </button>
            </div>
          )}
        </main>
        <aside className={styles.contextPane}>
          <div className={styles.contextHeader}>
            <h3>{active?.context === "Support" ? "Support ticket" : "Mentorship context"}</h3>
            <button
              className={styles.iconButton}
              aria-label="Collapse context"
              onClick={() => notice("Context panel collapse is not connected.")}
            >
              <X size={14} />
            </button>
          </div>
          {active?.context === "Support" ? (
            <div className={styles.contextCard}>
              <strong>{active.ticketRef || "Ticket reference unavailable"}</strong>
              <p>Support thread status and ticket details are not connected.</p>
              <Link href="/help/tickets?role=mentor" className={styles.textLink}>
                View support tickets <ArrowRight size={12} />
              </Link>
            </div>
          ) : active?.mentorshipId && data.startups.find((s) => s.id === active.mentorshipId) ? (
            <MentorshipContext startup={data.startups.find((s) => s.id === active.mentorshipId)!} />
          ) : (
            <div className={styles.contextEmpty}>
              <LockKeyhole size={18} />
              <strong>Context unavailable</strong>
              <p>Only information shared in a verified mentorship appears here.</p>
            </div>
          )}
          <div className={styles.contextGroup}>
            <h4>Quick actions</h4>
            <button
              onClick={() => notice("Session booking is not connected.")}
              disabled={!active?.mentorshipId}
            >
              <CalendarClock size={14} /> Book session
            </button>
            <button
              onClick={() => notice("Document request is not connected.")}
              disabled={!active?.mentorshipId}
            >
              <FileText size={14} /> Request a document
            </button>
            <button
              onClick={() => notice("Private-note storage is not connected; nothing was saved.")}
            >
              <LockKeyhole size={14} /> Add private note
            </button>
            <button onClick={() => notice("Report workflow is not connected.")}>
              <ShieldAlert size={14} /> Report
            </button>
          </div>
          <p className={styles.dataNotice}>
            <Info size={13} /> Data is local to this browser. Secure chat, audit logs and
            server-side access controls are not connected.
          </p>
        </aside>
      </div>
      {newOpen && (
        <div className={styles.overlay}>
          <section
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-message-title"
          >
            <header>
              <div>
                <span className={styles.eyebrow}>Mentor inbox</span>
                <h2 id="new-message-title">New message</h2>
              </div>
              <button
                className={styles.iconButton}
                onClick={() => setNewOpen(false)}
                aria-label="Close"
              >
                <X size={17} />
              </button>
            </header>
            <p>
              Choose only a startup you are mentoring, a pending request, or support. Investor
              messaging and unrelated startups are not available.
            </p>
            <div className={styles.recipientList}>
              {data.startups
                .filter((s) => ["Active", "Paused", "Completed"].includes(s.status))
                .map((s) => (
                  <button
                    key={s.id}
                    onClick={() => notice("Messaging is not connected; no new thread was created.")}
                  >
                    <span className={styles.avatar}>{s.startupName.slice(0, 1)}</span>
                    <span>
                      <strong>{s.startupName}</strong>
                      <small>{s.status} mentorship</small>
                    </span>
                    <ChevronRight size={14} />
                  </button>
                ))}
              {data.requests
                .filter((r) => r.status === "Requested")
                .map((r) => (
                  <button
                    key={r.id}
                    onClick={() => notice("Messaging is not connected; no new thread was created.")}
                  >
                    <span className={styles.avatar}>{r.startupName.slice(0, 1)}</span>
                    <span>
                      <strong>{r.startupName}</strong>
                      <small>Pending request</small>
                    </span>
                    <ChevronRight size={14} />
                  </button>
                ))}
              <button
                onClick={() => {
                  setNewOpen(false);
                  router.push("/help/tickets?role=mentor");
                }}
              >
                <span className={styles.avatar}>
                  <LifeBuoy size={16} />
                </span>
                <span>
                  <strong>Support</strong>
                  <small>Contact mentor support</small>
                </span>
                <ChevronRight size={14} />
              </button>
            </div>
            <div className={styles.dialogFooter}>
              <Link href="/mentor/discover" className={styles.textLink}>
                No relationship? Discover startups instead.
              </Link>
            </div>
          </section>
        </div>
      )}
      {toast && <Toast>{toast}</Toast>}
    </div>
  );
}
function MentorshipContext({ startup }: { startup: MentorRoleData["startups"][number] }) {
  const signed = startup.readinessItems.filter((i) => i.status === "Signed off").length;
  return (
    <>
      <div className={styles.startupCard}>
        <div className={styles.avatar}>{startup.startupName.slice(0, 1)}</div>
        <strong>{startup.startupName}</strong>
        <span>
          {startup.stage} · {startup.status}
        </span>
        <small>
          Readiness: not shared · Sign-offs: {signed}/{startup.readinessItems.length}
        </small>
        <Link className={styles.textLink} href={`/mentor/startups/${startup.id}`}>
          Open workspace <ArrowRight size={12} />
        </Link>
      </div>
      <div className={styles.contextGroup}>
        <h4>Mentorship</h4>
        <p>
          {startup.status} · {startup.cadence}
        </p>
        <p>Next session: not connected</p>
        <p>
          Open deliverables: {startup.deliverables.filter((d) => d.status !== "Accepted").length}
        </p>
        <p>
          Pending sign-offs:{" "}
          {startup.readinessItems.filter((i) => i.status === "Submitted for sign-off").length}
        </p>
      </div>
      <div className={styles.contextGroup}>
        <h4>Shared files</h4>
        <p className={styles.muted}>No shared file service connected.</p>
      </div>
    </>
  );
}

export function MentorNotificationsPage() {
  const { data, setData } = useMentorRole();
  const [filter, setFilter] = useState("All");
  const [toast, setToast] = useState("");
  const categories = [
    "All",
    "Unread",
    "Requests",
    "Sessions",
    "Sign-offs",
    "Money",
    "Events",
    "System",
  ];
  const list = data.notifications
    .filter(
      (n) =>
        (data.verifiedStatus === "Verified" || !["Requests", "Money"].includes(n.category)) &&
        !n.muted &&
        !data.notificationPreferences.mutedCategories.includes(n.category) &&
        (filter === "All" || filter === "Unread"
          ? filter === "Unread"
            ? n.unread
            : true
          : n.category === filter),
    )
    .sort(
      (a, b) =>
        Number(!!b.urgent) - Number(!!a.urgent) ||
        new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  const toggleRead = (item: MentorNotification) =>
    setData((d) => ({
      ...d,
      notifications: d.notifications.map((n) =>
        n.id === item.id ? { ...n, unread: !n.unread } : n,
      ),
    }));
  const notice = (s: string) => {
    setToast(s);
    window.setTimeout(() => setToast(""), 2800);
  };
  const grouped = list.reduce<Record<string, MentorNotification[]>>((acc, n) => {
    const group = todayLabel(n.date);
    (acc[group] ??= []).push(n);
    return acc;
  }, {});
  return (
    <div className={styles.page}>
      <PageHeading
        icon={<Bell />}
        title="Notifications"
        subtitle="Mentor requests, sessions, sign-offs, money and event updates."
        role="Mentor"
        action={
          <div className={styles.headingActions}>
            <button
              className={styles.secondary}
              onClick={() =>
                setData((d) => ({
                  ...d,
                  notifications: d.notifications.map((n) => ({ ...n, unread: false })),
                }))
              }
              disabled={!data.notifications.some((n) => n.unread)}
            >
              <Check size={14} /> Mark all as read
            </button>
            <Link className={styles.primary} href="/mentor/settings#notifications">
              <Settings2 size={14} /> Preferences
            </Link>
          </div>
        }
      />
      <StatusBanner status={data.verifiedStatus} />
      <div className={styles.notice}>
        <Info size={14} /> Notifications contain no sensitive financial amounts. Security alerts
        cannot be muted. In this preview, notifications are empty and the delivery service is
        disconnected.
      </div>
      <div className={styles.notificationTabs}>
        {categories.map((t) => (
          <button
            key={t}
            className={filter === t ? styles.filterActive : styles.filter}
            onClick={() => setFilter(t)}
          >
            {t}
            {t === "Unread" && <b>{data.notifications.filter((n) => n.unread).length || ""}</b>}
          </button>
        ))}
      </div>
      {list.length ? (
        Object.entries(grouped).map(([group, items]) => (
          <section className={styles.notificationGroup} key={group}>
            <h2>{group}</h2>
            {items.map((n) => (
              <NotificationRow
                key={n.id}
                item={n}
                onRead={() => toggleRead(n)}
                onMute={() => {
                  if (n.security) {
                    notice("Security alerts cannot be muted.");
                    return;
                  }
                  setData((d) => ({
                    ...d,
                    notificationPreferences: {
                      ...d.notificationPreferences,
                      mutedCategories: d.notificationPreferences.mutedCategories.includes(
                        n.category,
                      )
                        ? d.notificationPreferences.mutedCategories
                        : [...d.notificationPreferences.mutedCategories, n.category],
                    },
                  }));
                }}
              />
            ))}
          </section>
        ))
      ) : (
        <div className={styles.emptyPanel}>
          <span className={styles.emptyIcon}>
            <Bell size={20} />
          </span>
          <h2>{filter === "Unread" ? "No unread notifications." : "You're all caught up."}</h2>
          <p>
            New requests, session reminders, sign-offs, payments, agreements and event updates will
            appear here when connected services provide them.
          </p>
          <Link className={styles.secondary} href="/mentor/dashboard">
            Back to mentor dashboard
          </Link>
        </div>
      )}
      {toast && <Toast>{toast}</Toast>}
    </div>
  );
}
function NotificationRow({
  item,
  onRead,
  onMute,
}: {
  item: MentorNotification;
  onRead: () => void;
  onMute: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const Icon =
    item.category === "Sessions"
      ? CalendarClock
      : item.category === "Messages"
        ? MessageSquare
        : item.category === "Money"
          ? FileText
          : item.category === "System"
            ? ShieldCheck
            : item.category === "Events"
              ? Bell
              : item.category === "Sign-offs"
                ? Check
                : Inbox;
  return (
    <article
      className={`${styles.notificationRow} ${item.urgent ? styles.urgent : ""} ${!item.unread ? styles.notificationRead : ""}`}
    >
      <div className={styles.notificationIcon}>
        <Icon size={17} />
      </div>
      <div className={styles.notificationBody}>
        <Link href={item.href || "/mentor/dashboard"} onClick={onRead}>
          <strong>{item.title}</strong>
        </Link>
        <p>{item.detail}</p>
        <small>
          {dateLabel(item.date)} <span className={styles.roleChip}>Mentor</span>
        </small>
      </div>
      {item.unread && <span className={styles.unreadDot} />}
      <Link
        className={styles.actionButton}
        href={item.href || "/mentor/dashboard"}
        onClick={onRead}
      >
        Open <ArrowRight size={13} />
      </Link>
      <div className={styles.menuWrap}>
        <button
          className={styles.iconButton}
          onClick={() => setMenu((v) => !v)}
          aria-label="Notification options"
        >
          <MoreHorizontal size={16} />
        </button>
        {menu && (
          <div className={styles.menu}>
            <button
              onClick={() => {
                onRead();
                setMenu(false);
              }}
            >
              {item.unread ? "Mark as read" : "Mark as unread"}
            </button>
            <button
              disabled={item.security}
              onClick={() => {
                onMute();
                setMenu(false);
              }}
            >
              <BellOff size={12} /> Mute this type
            </button>
            <button disabled>
              <UserRound size={12} /> Mute this startup
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

const preferenceCategories = [
  "Startup requests and invitations",
  "Sessions",
  "Session summary reminders",
  "Sign-off and deliverable submissions",
  "Messages",
  "Payments, payouts and tax documents",
  "Agreements",
  "Reviews and impact",
  "Investor events",
  "Platform updates",
  "Security alerts",
];
const settingSections = [
  "Account",
  "Security",
  "Notifications",
  "Privacy and visibility",
  "Mentoring preferences",
  "Payments and payouts",
  "Connected accounts",
  "Roles",
  "Help and legal",
  "Danger zone",
];
export function MentorSettingsPage() {
  const router = useRouter();
  const { data, setData } = useMentorRole();
  const [section, setSection] = useState("Account");
  const [draft, setDraft] = useState(data);
  const [dirty, setDirty] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [discardIntent, setDiscardIntent] = useState<{
    type: "navigate" | "section";
    value: string;
  } | null>(null);
  const [toast, setToast] = useState("");
  const notice = (s: string) => {
    setToast(s);
    window.setTimeout(() => setToast(""), 3200);
  };
  useEffect(() => {
    if (!dirty) return;
    const before = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const click = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest("a");
      if (anchor && dirty) {
        e.preventDefault();
        e.stopPropagation();
        setDiscardIntent({
          type: "navigate",
          value: anchor.getAttribute("href") || "",
        });
      }
    };
    window.addEventListener("beforeunload", before);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", before);
      document.removeEventListener("click", click, true);
    };
  }, [dirty]);
  const patch = (fn: (d: MentorRoleData) => MentorRoleData) => {
    setDraft(fn);
    setDirty(true);
  };
  const save = () => {
    if (
      section === "Notifications" &&
      (!draft.notificationPreferences.quietStart || !draft.notificationPreferences.quietEnd)
    ) {
      notice("Enter both quiet-hours times before saving.");
      return;
    }
    const safe = {
      ...draft,
      notificationPreferences: {
        ...draft.notificationPreferences,
        channels: {
          ...draft.notificationPreferences.channels,
          "Security alerts": { inApp: true, email: true, push: true },
        },
      },
    };
    setDraft(safe);
    setData(safe);
    setDirty(false);
    notice("Preferences saved in this browser only. No account service was updated.");
  };
  const undo = () => {
    setDraft(data);
    setDirty(false);
  };
  const updateChannel = (category: string, key: "inApp" | "email" | "push", value: boolean) =>
    patch((d) => ({
      ...d,
      notificationPreferences: {
        ...d.notificationPreferences,
        channels: {
          ...d.notificationPreferences.channels,
          [category]: {
            ...d.notificationPreferences.channels[category],
            [key]: category === "Security alerts" ? true : value,
          },
        },
      },
    }));
  return (
    <div className={styles.page}>
      <PageHeading
        icon={<Settings2 />}
        title="Settings"
        subtitle="Mentor account, security, notification and privacy preferences."
        role="Mentor"
        action={
          <div className={styles.headingActions}>
            {dirty && (
              <button className={styles.secondary} onClick={undo}>
                <Undo2 size={14} /> Undo
              </button>
            )}
            <button className={styles.primary} onClick={save} disabled={!dirty}>
              <Check size={14} /> Save changes
            </button>
          </div>
        }
      />
      <StatusBanner status={data.verifiedStatus} />
      <div className={styles.settingsLayout}>
        <nav className={styles.settingsNav} aria-label="Settings sections">
          {settingSections.map((s) => (
            <button
              key={s}
              className={section === s ? styles.settingsActive : styles.settingsItem}
              onClick={() => {
                if (dirty) {
                  setDiscardIntent({ type: "section", value: s });
                  return;
                }
                setSection(s);
              }}
            >
              {s}
              <ChevronRight size={13} />
            </button>
          ))}
        </nav>
        <main className={styles.settingsMain}>
          {section === "Account" && (
            <>
              <SettingsTitle
                title="Account"
                text="Basic details and display preferences for your mentor account."
              />
              <div className={styles.formGrid}>
                <label>
                  Name
                  <input
                    value={draft.privateProfile.name}
                    onChange={(e) =>
                      patch((d) => ({
                        ...d,
                        privateProfile: { ...d.privateProfile, name: e.target.value },
                      }))
                    }
                  />
                </label>
                <label>
                  Email
                  <input
                    value={draft.mentorSettings.accountEmail}
                    onChange={(e) =>
                      patch((d) => ({
                        ...d,
                        mentorSettings: { ...d.mentorSettings, accountEmail: e.target.value },
                      }))
                    }
                    placeholder="Email service not connected"
                    type="email"
                  />
                </label>
                <label>
                  Phone
                  <input
                    value={draft.mentorSettings.phone}
                    onChange={(e) =>
                      patch((d) => ({
                        ...d,
                        mentorSettings: { ...d.mentorSettings, phone: e.target.value },
                      }))
                    }
                    placeholder="Phone service not connected"
                  />
                </label>
                <label>
                  Language
                  <select
                    value={draft.mentorSettings.language}
                    onChange={(e) =>
                      patch((d) => ({
                        ...d,
                        mentorSettings: { ...d.mentorSettings, language: e.target.value },
                      }))
                    }
                  >
                    <option>English</option>
                    <option>বাংলা</option>
                    <option>हिन्दी</option>
                  </select>
                </label>
                <label>
                  Time zone
                  <select
                    value={draft.mentorSettings.timezone}
                    onChange={(e) =>
                      patch((d) => ({
                        ...d,
                        mentorSettings: { ...d.mentorSettings, timezone: e.target.value },
                      }))
                    }
                  >
                    <option>Asia/Kolkata</option>
                    <option>UTC</option>
                    <option>Asia/Singapore</option>
                  </select>
                </label>
                <label>
                  Date format
                  <select
                    value={draft.mentorSettings.dateFormat}
                    onChange={(e) =>
                      patch((d) => ({
                        ...d,
                        mentorSettings: { ...d.mentorSettings, dateFormat: e.target.value },
                      }))
                    }
                  >
                    <option>DD MMM YYYY</option>
                    <option>MM/DD/YYYY</option>
                    <option>YYYY-MM-DD</option>
                  </select>
                </label>
                <label>
                  Currency display
                  <select
                    value={draft.mentorSettings.currencyDisplay}
                    onChange={(e) =>
                      patch((d) => ({
                        ...d,
                        mentorSettings: { ...d.mentorSettings, currencyDisplay: e.target.value },
                      }))
                    }
                  >
                    <option>INR (₹)</option>
                    <option>USD ($)</option>
                    <option>GBP (£)</option>
                  </select>
                </label>
              </div>
              <div className={styles.notice}>
                <Info size={14} /> Email and phone changes require identity verification, which is
                not connected.
              </div>
            </>
          )}
          {section === "Security" && (
            <>
              <SettingsTitle
                title="Security"
                text="Identity and security controls are managed by the account service."
              />
              <div className={styles.securityNudge}>
                <ShieldAlert size={18} />
                <span>
                  <strong>
                    {draft.mentorSettings.twoFactorEnabled
                      ? "Two-factor authentication enabled"
                      : "Protect your account with two-factor authentication"}
                  </strong>
                  <small>2FA setup and recovery codes are not connected in this prototype.</small>
                </span>
                <button className={styles.secondary} disabled>
                  Set up 2FA
                </button>
              </div>
              <div className={styles.settingsCard}>
                <h3>Password</h3>
                <p>Password changes require re-authentication and identity-provider support.</p>
                <button className={styles.secondary} disabled>
                  <KeyRound size={14} /> Change password
                </button>
              </div>
              <div className={styles.settingsCard}>
                <h3>Active sessions and devices</h3>
                <p>No device or login activity service is connected.</p>
                <div className={styles.deviceRow}>
                  <Monitor size={15} /> Session listing unavailable{" "}
                  <button className={styles.secondary} disabled>
                    Sign out everywhere
                  </button>
                </div>
              </div>
              <div className={styles.settingsCard}>
                <h3>Recent security activity</h3>
                <p>No security activity records.</p>
              </div>
            </>
          )}
          {section === "Notifications" && (
            <>
              <SettingsTitle
                title="Notification preferences"
                text="Choose channels for mentor events. Security alerts remain locked on."
              />
              <div className={styles.tableWrap}>
                <table className={styles.preferenceTable}>
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>In-app</th>
                      <th>Email</th>
                      <th>Push</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preferenceCategories.map((cat) => (
                      <tr key={cat}>
                        <td>
                          {cat}
                          {cat === "Security alerts" && (
                            <small> Required for account protection</small>
                          )}
                        </td>
                        {(["inApp", "email", "push"] as const).map((k) => (
                          <td key={k}>
                            <input
                              type="checkbox"
                              aria-label={`${cat} ${k}`}
                              checked={
                                cat === "Security alerts"
                                  ? true
                                  : (draft.notificationPreferences.channels[cat]?.[k] ?? false)
                              }
                              disabled={cat === "Security alerts"}
                              onChange={(e) => updateChannel(cat, k, e.target.checked)}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className={styles.formGrid}>
                <label>
                  Digest
                  <select
                    value={draft.notificationPreferences.digest}
                    onChange={(e) =>
                      patch((d) => ({
                        ...d,
                        notificationPreferences: {
                          ...d.notificationPreferences,
                          digest: e.target.value as "Instant" | "Daily" | "Weekly",
                        },
                      }))
                    }
                  >
                    <option>Instant</option>
                    <option>Daily</option>
                    <option>Weekly</option>
                  </select>
                </label>
                <label>
                  Quiet hours start
                  <input
                    type="time"
                    value={draft.notificationPreferences.quietStart}
                    onChange={(e) =>
                      patch((d) => ({
                        ...d,
                        notificationPreferences: {
                          ...d.notificationPreferences,
                          quietStart: e.target.value,
                        },
                      }))
                    }
                  />
                </label>
                <label>
                  Quiet hours end
                  <input
                    type="time"
                    value={draft.notificationPreferences.quietEnd}
                    onChange={(e) =>
                      patch((d) => ({
                        ...d,
                        notificationPreferences: {
                          ...d.notificationPreferences,
                          quietEnd: e.target.value,
                        },
                      }))
                    }
                  />
                </label>
                <label>
                  Session reminders
                  <select
                    value={draft.notificationPreferences.sessionReminders.join(",")}
                    onChange={(e) =>
                      patch((d) => ({
                        ...d,
                        notificationPreferences: {
                          ...d.notificationPreferences,
                          sessionReminders: e.target.value.split(",").map(Number),
                        },
                      }))
                    }
                  >
                    <option value="10,60,1440">10 minutes, 1 hour, 1 day</option>
                    <option value="10,60">10 minutes, 1 hour</option>
                    <option value="60,1440">1 hour, 1 day</option>
                  </select>
                </label>
              </div>
              <p className={styles.helper}>
                Urgent security alerts are excepted from quiet hours. Mute preferences are local
                only.
              </p>
              <div className={styles.settingsCard}>
                <h3>Muted startups</h3>
                {draft.notificationPreferences.mutedStartups.length ? (
                  draft.notificationPreferences.mutedStartups.map((s) => (
                    <div key={s} className={styles.deviceRow}>
                      {s}
                      <button
                        className={styles.textLink}
                        onClick={() =>
                          patch((d) => ({
                            ...d,
                            notificationPreferences: {
                              ...d.notificationPreferences,
                              mutedStartups: d.notificationPreferences.mutedStartups.filter(
                                (x) => x !== s,
                              ),
                            },
                          }))
                        }
                      >
                        Unmute
                      </button>
                    </div>
                  ))
                ) : (
                  <p>No muted startups.</p>
                )}
              </div>
              <div className={styles.settingsCard}>
                <h3>Muted notification types</h3>
                {draft.notificationPreferences.mutedCategories.length ? (
                  draft.notificationPreferences.mutedCategories.map((s) => (
                    <div key={s} className={styles.deviceRow}>
                      {s}
                      <button
                        className={styles.textLink}
                        onClick={() =>
                          patch((d) => ({
                            ...d,
                            notificationPreferences: {
                              ...d.notificationPreferences,
                              mutedCategories: d.notificationPreferences.mutedCategories.filter(
                                (x) => x !== s,
                              ),
                            },
                          }))
                        }
                      >
                        Unmute
                      </button>
                    </div>
                  ))
                ) : (
                  <p>No muted notification types.</p>
                )}
              </div>
            </>
          )}
          {section === "Privacy and visibility" && (
            <>
              <SettingsTitle
                title="Privacy and visibility"
                text="Control mentor profile visibility and how verified information may be shown."
              />
              <div className={styles.securityNudge}>
                <EyeOffIcon />
                <span>
                  <strong>
                    {draft.mentorSettings.profileVisibility ? "Visible" : "Hidden"} to new startup
                    requests
                  </strong>
                  <small>
                    {draft.mentorSettings.profileVisibility
                      ? "Approved mentors may be discovered."
                      : "Hidden profiles receive no new requests; active mentorships continue."}
                  </small>
                </span>
                <Toggle
                  checked={draft.mentorSettings.profileVisibility}
                  disabled={data.verifiedStatus !== "Verified"}
                  onChange={(v) =>
                    patch((d) => ({
                      ...d,
                      mentorSettings: { ...d.mentorSettings, profileVisibility: v },
                    }))
                  }
                />
              </div>
              <div className={styles.settingsCard}>
                <h3>Public impact record</h3>
                <p>
                  Public impact remains hidden until platform verification and startup consent are
                  connected.
                </p>
                <Toggle checked={false} disabled onChange={() => {}} />
                <Link href="/mentor/impact" className={styles.textLink}>
                  Manage per-item controls <ArrowRight size={12} />
                </Link>
              </div>
              <div className={styles.settingsCard}>
                <h3>What startups see</h3>
                <p>Only verified items could be shown.</p>
                {[
                  ["Response time", "showResponseTime"],
                  ["Number of startups mentored", "showStartupCount"],
                  ["Rating", "showRating"],
                  ["Past exits", "showPastExits"],
                ].map(([label, key]) => (
                  <ToggleRow
                    key={key}
                    label={label}
                    checked={
                      draft.mentorSettings[
                        key as
                          "showResponseTime" | "showStartupCount" | "showRating" | "showPastExits"
                      ]
                    }
                    disabled
                    onChange={() => {}}
                  />
                ))}
                <small className={styles.helper}>
                  Profile data sharing service is not connected.
                </small>
              </div>
              <div className={styles.settingsCard}>
                <h3>Contact details</h3>
                <p>Never displayed publicly; shared only inside a mentorship.</p>
              </div>
              <div className={styles.settingsCard}>
                <h3>Blocked startups</h3>
                <p>No blocked startup records are stored.</p>
              </div>
              <div className={styles.settingsCard}>
                <h3>Your data</h3>
                <p>
                  Data export and deletion are not connected. Retention rules for agreements,
                  finances and sign-off history must be reviewed before deletion.
                </p>
                <div className={styles.buttonRow}>
                  <button disabled className={styles.secondary}>
                    <Download size={14} /> Download my data
                  </button>
                  <button disabled className={styles.danger}>
                    <Trash2 size={14} /> Delete my data
                  </button>
                </div>
              </div>
              <ToggleRow
                label="Contribute anonymized platform statistics"
                checked={draft.mentorSettings.analyticsOptIn}
                disabled={false}
                onChange={(v) =>
                  patch((d) => ({
                    ...d,
                    mentorSettings: { ...d.mentorSettings, analyticsOptIn: v },
                  }))
                }
              />
            </>
          )}
          {section === "Mentoring preferences" && (
            <>
              <SettingsTitle
                title="Mentoring preferences"
                text="Update your mentor profile, availability and agreement defaults."
              />
              <LinkCard
                title="Mentor profile"
                detail={draft.privateProfile.headline}
                href="/mentor/settings"
                label="Edit profile"
              />
              <LinkCard
                title="Availability and capacity"
                detail={`${data.availability} · ${data.capacity} startup slots`}
                href="/mentor/settings"
                label="Edit availability"
              />
              <LinkCard
                title="Pricing and agreement defaults"
                detail="No fee defaults connected"
                href="/mentor/agreements"
                label="Review agreements"
              />
              <p className={styles.helper}>
                Profile and availability changes remain read-only until verified.
              </p>
            </>
          )}
          {section === "Payments and payouts" && (
            <>
              <SettingsTitle
                title="Payments and payouts"
                text="Sensitive payout changes belong in Earnings and require re-authentication."
              />
              <LinkCard
                title="Payout method and tax details"
                detail="No payout method or tax records available"
                href="/mentor/earnings"
                label="Open Earnings"
              />
              <div className={styles.notice}>
                <LockKeyhole size={14} /> Payout changes require secure re-authentication. Bank and
                tax details must never be entered in this demo.
              </div>
            </>
          )}
          {section === "Connected accounts" && (
            <>
              <SettingsTitle
                title="Connected accounts"
                text="Sign-in and calendar connections are not configured."
              />
              {[
                ["Google", "google", Mail],
                ["Microsoft", "microsoft", Mail],
                ["Calendar sync (read only)", "calendar", CalendarClock],
                ["LinkedIn", "linkedin", UserRound],
              ].map(([label, key, Icon]) => (
                <div className={styles.deviceRow} key={key as string}>
                  <Icon size={15} />
                  <span>{label as string}</span>
                  <small>
                    {draft.mentorSettings.connectedAccounts[
                      key as "google" | "microsoft" | "calendar" | "linkedin"
                    ]
                      ? "Connected"
                      : "Not connected"}
                  </small>
                  <button className={styles.secondary} disabled>
                    Connect
                  </button>
                </div>
              ))}
            </>
          )}
          {section === "Roles" && (
            <>
              <SettingsTitle title="Roles" text="This preview is scoped to the mentor workspace." />
              <div className={styles.settingsCard}>
                <h3>Active role: Mentor</h3>
                <p>Multi-role identity and unread counts per role are not connected.</p>
                <div className={styles.buttonRow}>
                  <button className={styles.secondary} disabled>
                    <Plus size={14} /> Add a role
                  </button>
                  <label className={styles.inlineField}>
                    Default role
                    <select
                      value={draft.mentorSettings.defaultRole}
                      onChange={(e) =>
                        patch((d) => ({
                          ...d,
                          mentorSettings: { ...d.mentorSettings, defaultRole: e.target.value },
                        }))
                      }
                    >
                      <option>Mentor</option>
                    </select>
                  </label>
                </div>
              </div>
            </>
          )}
          {section === "Help and legal" && (
            <>
              <SettingsTitle
                title="Help and legal"
                text="Mentor-specific guidance and platform terms."
              />
              <LinkCard
                title="Help and Support"
                detail="Search mentor guides or contact support"
                href="/help?role=mentor"
                label="Open help"
              />
              <LinkCard
                title="Terms and privacy"
                detail="Legal pages are shared across roles"
                href="/terms"
                label="Read terms"
              />
              <LinkCard
                title="Mentor code of conduct"
                detail="Conflict, confidentiality and platform conduct guidance"
                href="/help?role=mentor"
                label="View guidance"
              />
              <p className={styles.disclaimer}>
                The platform introduces startups, mentors and investors. It does not give legal,
                tax, financial or investment advice.
              </p>
            </>
          )}
          {section === "Danger zone" && (
            <>
              <SettingsTitle
                title="Danger zone"
                text="High-impact account actions need re-authentication and an active-record checklist."
              />
              <div className={styles.dangerCard}>
                <h3>Pause mentoring</h3>
                <p>
                  Hide your profile and stop new requests. Active mentorships continue unless paused
                  individually.
                </p>
                <button className={styles.secondary} disabled>
                  Pause mentoring
                </button>
              </div>
              <div className={styles.dangerCard}>
                <h3>Close mentor role</h3>
                <p>
                  Before closing, resolve active mentorships, pending sign-offs and payouts.
                  Checklist service is not connected.
                </p>
                <button className={styles.danger} disabled>
                  Close mentor role
                </button>
              </div>
              <div className={styles.dangerCard}>
                <h3>Delete account</h3>
                <p>Deletion requires re-authentication and explains retained legal records.</p>
                <button className={styles.danger} onClick={() => setConfirm("Delete account")}>
                  Review deletion requirements
                </button>
              </div>
            </>
          )}
          {dirty && (
            <div className={styles.stickySave}>
              <span>Unsaved changes</span>
              <button className={styles.secondary} onClick={undo}>
                Discard
              </button>
              <button className={styles.primary} onClick={save}>
                Save section
              </button>
            </div>
          )}
        </main>
      </div>
      {confirm && (
        <div className={styles.overlay}>
          <section className={styles.dialog} role="dialog" aria-modal="true">
            <header>
              <h2>{confirm}</h2>
              <button className={styles.iconButton} onClick={() => setConfirm("")}>
                <X size={16} />
              </button>
            </header>
            <p>
              Account deletion is unavailable. Re-authentication and a retention checklist are
              required.
            </p>
            <button className={styles.secondary} onClick={() => setConfirm("")}>
              Close
            </button>
          </section>
        </div>
      )}
      {toast && <Toast>{toast}</Toast>}
      <ConfirmDialog
        open={!!discardIntent}
        title="Discard unsaved changes?"
        description="Your unsaved settings edits will be lost. Choose Cancel to go back and save first."
        confirmLabel="Discard changes"
        tone="danger"
        onCancel={() => setDiscardIntent(null)}
        onConfirm={() => {
          if (discardIntent?.type === "section" && discardIntent.value) {
            undo();
            setSection(discardIntent.value);
          } else if (discardIntent?.type === "navigate" && discardIntent.value) {
            undo();
            router.push(discardIntent.value);
          }
          setDiscardIntent(null);
        }}
      />
    </div>
  );
}
function EyeOffIcon() {
  return <LockKeyhole size={18} />;
}
function Toggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={`${styles.toggle} ${checked ? styles.toggleOn : ""}`}
      onClick={() => onChange(!checked)}
    >
      <i />
    </button>
  );
}
function ToggleRow({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className={styles.toggleRow}>
      <span>{label}</span>
      <Toggle checked={checked} disabled={disabled} onChange={onChange} />
    </div>
  );
}
function SettingsTitle({ title, text }: { title: string; text: string }) {
  return (
    <header className={styles.settingsTitle}>
      <h2>{title}</h2>
      <p>{text}</p>
    </header>
  );
}
function LinkCard({
  title,
  detail,
  href,
  label,
}: {
  title: string;
  detail: string;
  href: string;
  label: string;
}) {
  return (
    <article className={styles.linkCard}>
      <span>
        <strong>{title}</strong>
        <small>{detail}</small>
      </span>
      <Link href={href}>
        {label} <ArrowRight size={13} />
      </Link>
    </article>
  );
}

const helpArticles = [
  {
    topic: "Getting started",
    title: "Mentor verification and your profile",
    text: "Complete your mentor profile and submit verification details. Until approval, some mentoring actions are unavailable.",
  },
  {
    topic: "Requests and startups",
    title: "Responding to a startup request",
    text: "Review the startup-shared details, consider conflicts of interest, and respond using the platform workflow.",
  },
  {
    topic: "Sessions",
    title: "Scheduling and rescheduling sessions",
    text: "Schedule sessions only within an active mentorship. Confirm timezone, agenda and recording consent.",
  },
  {
    topic: "Sign-offs and readiness",
    title: "How readiness sign-off works",
    text: "Review evidence against criteria, leave specific feedback, and request changes when requirements are not met.",
  },
  {
    topic: "Deliverables",
    title: "Reviewing submitted deliverables",
    text: "Check the requested format and provide actionable feedback. Do not disclose private notes in shared feedback.",
  },
  {
    topic: "Earnings and payouts",
    title: "Payments, commissions and tax documents",
    text: "Review payment records and payout statements in Earnings. Contact an accountant for tax advice.",
  },
  {
    topic: "Agreements and equity",
    title: "Understanding mentor agreements",
    text: "Read fee, equity, scope and exit terms carefully. Seek legal advice where appropriate.",
  },
  {
    topic: "Impact and reviews",
    title: "Consent and your public impact record",
    text: "Only verified outcomes with startup consent may appear publicly. Mentoring outcomes do not establish causation.",
  },
  {
    topic: "Investor events",
    title: "Priority event access and recommendations",
    text: "Event availability, registration and recommendations depend on an organizer-published event.",
  },
  {
    topic: "Safety and conduct",
    title: "Conflicts of interest and reporting",
    text: "Disclose conflicts, keep records on platform, and do not offer investment or legal advice unless qualified.",
  },
  {
    topic: "Account and privacy",
    title: "Roles, security and data privacy",
    text: "Security, data export and deletion controls require connected identity services.",
  },
];
export function MentorHelpPage() {
  const { data } = useMentorRole();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<string | null>(null);
  const [helpful, setHelpful] = useState<Record<string, boolean | null>>({});
  const [contact, setContact] = useState(false);
  const [report, setReport] = useState(false);
  const [toast, setToast] = useState("");
  const matches = helpArticles.filter((a) =>
    `${a.topic} ${a.title} ${a.text}`.toLowerCase().includes(query.toLowerCase()),
  );
  const notice = (s: string) => {
    setToast(s);
    window.setTimeout(() => setToast(""), 3000);
  };
  return (
    <div className={styles.page}>
      <PageHeading
        icon={<HelpCircle />}
        title="Help and Support"
        subtitle="Mentor guidance, platform support and reporting."
        role="Mentor"
        action={
          <Link href="/help/tickets?role=mentor" className={styles.primary}>
            <Ticket size={14} /> My tickets
          </Link>
        }
      />
      <StatusBanner status={data.verifiedStatus} />
      <div className={styles.roleNotice}>
        <span className={styles.roleChip}>Mentor</span>
        <span>Mentor help preview · active-role switching is not connected.</span>
        <Link href="/mentor/dashboard">Mentor workspace</Link>
      </div>
      <label className={styles.helpSearch}>
        <Search size={17} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search help for mentors"
        />
        <kbd>⌘ K</kbd>
      </label>
      <div className={styles.helpGrid}>
        <main>
          <section className={styles.helpSection}>
            <h2>{query ? "Search results" : "Mentor help topics"}</h2>
            {matches.length ? (
              <div className={styles.articleGrid}>
                {matches.map((a) => (
                  <article key={a.title} className={styles.articleCard}>
                    <button
                      className={styles.articleSelect}
                      aria-expanded={active === a.title}
                      onClick={() => setActive(active === a.title ? null : a.title)}
                    >
                      <span className={styles.articleIcon}>
                        <BookOpen size={17} />
                      </span>
                      <span>
                        <strong>{a.topic}</strong>
                        <small>{a.title}</small>
                      </span>
                      <ChevronRight size={15} />
                    </button>
                    {active === a.title && (
                      <div className={styles.articleExpand}>
                        <p>
                          {a.text}
                          <br />
                          <small>Guide preview · support knowledge base is not connected.</small>
                        </p>
                        <div className={styles.helpfulControl}>
                          Was this helpful?{" "}
                          <button onClick={() => setHelpful((h) => ({ ...h, [a.title]: true }))}>
                            Yes
                          </button>
                          <button onClick={() => setHelpful((h) => ({ ...h, [a.title]: false }))}>
                            No
                          </button>
                          {helpful[a.title] !== undefined && (
                            <small>Thanks for your feedback. This preview does not send it.</small>
                          )}
                        </div>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <div className={styles.emptyPanel}>
                <strong>No articles found.</strong>
                <p>Try another term or contact mentor support.</p>
                <button className={styles.secondary} onClick={() => setContact(true)}>
                  Contact support
                </button>
              </div>
            )}
          </section>
          <section className={styles.helpSection}>
            <h2>Popular articles</h2>
            <div className={styles.popularList}>
              {helpArticles.slice(0, 4).map((a, i) => (
                <button
                  key={a.title}
                  onClick={() => {
                    setActive(a.title);
                    setQuery("");
                  }}
                >
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  {a.title}
                  <ArrowUpRight size={13} />
                </button>
              ))}
            </div>
          </section>
          <section className={styles.helpSection}>
            <h2>Mentor guidelines</h2>
            <p>
              Keep mentorship work on platform. Disclose conflicts of interest. Do not request
              off-platform payment, equity promises or investment solicitation.
            </p>
            <Link className={styles.textLink} href="/terms">
              Code of conduct and terms <ArrowRight size={12} />
            </Link>
          </section>
        </main>
        <aside className={styles.helpAside}>
          <div className={styles.supportCard}>
            <span className={styles.supportIcon}>
              <LifeBuoy size={19} />
            </span>
            <h2>Need more help?</h2>
            <p>
              We usually reply within 1 business day. Support service is not connected in this
              preview.
            </p>
            <button className={styles.primary} onClick={() => setContact(true)}>
              Contact support
            </button>
            <Link className={styles.secondary} href="/help/tickets?role=mentor">
              View tickets
            </Link>
          </div>
          <div className={styles.supportCard}>
            <ShieldAlert size={18} />
            <h3>Report a concern</h3>
            <p>Misconduct, conflict of interest, review, payment or safety concern.</p>
            <button className={styles.danger} onClick={() => setReport(true)}>
              Report a concern
            </button>
          </div>
          <div className={styles.supportCard}>
            <h3>Platform status</h3>
            <p>Status page and live incidents are not connected.</p>
            <button className={styles.secondary} disabled>
              View platform status <ExternalLink size={12} />
            </button>
          </div>
        </aside>
      </div>
      <p className={styles.disclaimer}>
        The platform introduces startups, mentors and investors. It does not give legal, tax,
        financial or investment advice.
      </p>
      {(contact || report) && (
        <SupportForm
          report={report}
          onClose={() => {
            setContact(false);
            setReport(false);
          }}
          onNotice={notice}
        />
      )}
      {toast && <Toast>{toast}</Toast>}
    </div>
  );
}
function SupportForm({
  report,
  onClose,
  onNotice,
}: {
  report: boolean;
  onClose: () => void;
  onNotice: (s: string) => void;
}) {
  const [category, setCategory] = useState("Account and privacy");
  const [reportType, setReportType] = useState("Report a startup");
  const [description, setDescription] = useState("");
  return (
    <div className={styles.overlay}>
      <form
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        onSubmit={(e) => {
          e.preventDefault();
          onNotice(
            "Support service is unavailable. Your draft remains on this page; nothing was submitted.",
          );
        }}
      >
        <header>
          <div>
            <span className={styles.eyebrow}>
              {report ? "Confidential reporting" : "Mentor support"}
            </span>
            <h2>{report ? "Report a concern" : "Contact support"}</h2>
          </div>
          <button type="button" className={styles.iconButton} onClick={onClose}>
            <X size={16} />
          </button>
        </header>
        {report && (
          <label className={styles.formLabel}>
            Concern type
            <select value={reportType} onChange={(e) => setReportType(e.target.value)}>
              <option>Report a startup</option>
              <option>Report a review</option>
              <option>Report a payment or agreement issue</option>
              <option>Report a conflict of interest or sign-off concern</option>
              <option>Report a safety issue</option>
            </select>
          </label>
        )}
        {report && reportType === "Report a safety issue" && (
          <div className={styles.notice}>
            <ShieldAlert size={13} /> If anyone is in immediate danger, contact local emergency
            services. The platform has no connected safety hotline in this preview.
          </div>
        )}
        <label className={styles.formLabel}>
          Category
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {[
              "Getting started",
              "Requests and startups",
              "Sessions",
              "Sign-offs and readiness",
              "Deliverables",
              "Earnings and payouts",
              "Agreements and equity",
              "Impact and reviews",
              "Investor events",
              "Safety and conduct",
              "Account and privacy",
            ].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label className={styles.formLabel}>
          Related item
          <select>
            <option>None</option>
            {["My startups", "Sessions", "Payments", "Agreements"].map((x) => (
              <option key={x}>{x} · none available</option>
            ))}
          </select>
        </label>
        <label className={styles.formLabel}>
          Preferred contact method
          <select>
            <option>Email</option>
            <option>In-app</option>
          </select>
        </label>
        <label className={styles.formLabel}>
          Attachments (up to 5 files, 10 MB each)
          <input type="file" multiple disabled />
          <small className={styles.helper}>
            Secure upload and virus scanning are not connected.
          </small>
        </label>
        <label className={styles.formLabel}>
          Description
          <textarea
            required
            minLength={20}
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what happened (20–2,000 characters)."
          />
        </label>
        <div className={styles.notice}>
          <Info size={13} /> Attachments, confidential delivery and ticket creation are not
          connected. This draft is not sent.
        </div>
        <div className={styles.dialogFooter}>
          <button type="button" className={styles.secondary} onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className={styles.primary}
            disabled={description.trim().length < 20}
          >
            Submit report
          </button>
        </div>
      </form>
    </div>
  );
}
export function MentorTicketsPage() {
  const { data } = useMentorRole();
  return (
    <div className={styles.page}>
      <PageHeading
        icon={<Ticket />}
        title="My support tickets"
        subtitle="Mentor support requests and confidential reports."
        role="Mentor"
        action={
          <Link className={styles.primary} href="/help?role=mentor">
            <HelpCircle size={14} /> Help centre
          </Link>
        }
      />
      <StatusBanner status={data.verifiedStatus} />
      <div className={styles.notice}>
        <Info size={14} /> Ticket service is not connected. No ticket history is fabricated.
      </div>
      <div className={styles.settingsCard}>
        <h2>Tickets</h2>
        {data.tickets.length ? (
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Subject</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {data.tickets.map((t) => (
                  <tr key={t.id}>
                    <td>{t.id}</td>
                    <td>{t.subject}</td>
                    <td>{t.category}</td>
                    <td>{t.status}</td>
                    <td>{dateLabel(t.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.emptyPanel}>
            <span className={styles.emptyIcon}>
              <Ticket size={20} />
            </span>
            <strong>No support tickets.</strong>
            <p>
              Tickets you send to support will appear here after the support system is connected.
            </p>
            <Link className={styles.secondary} href="/help?role=mentor">
              Contact support
            </Link>
          </div>
        )}
      </div>
      <div className={styles.disclaimer}>
        We usually reply within 1 business day. This estimate is illustrative and support is not
        connected.
      </div>
    </div>
  );
}

function PageHeading({
  icon,
  title,
  subtitle,
  role,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  role: string;
  action?: React.ReactNode;
}) {
  return (
    <header className={styles.pageHeading}>
      <span className={styles.headingIcon}>{icon}</span>
      <div className={styles.headingText}>
        <span className={styles.eyebrow}>MERIDIAN · {role} ROLE</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action && <div className={styles.headingAction}>{action}</div>}
    </header>
  );
}
function StatusBanner({ status }: { status: string }) {
  return status === "Verified" ? (
    <div className={styles.statusBanner}>
      <ShieldCheck size={16} />
      <span>
        <strong>Mentor profile verified</strong>
        <small>Verification status is stored locally; no admin service confirms it.</small>
      </span>
    </div>
  ) : (
    <div className={styles.statusBanner}>
      <ShieldAlert size={16} />
      <span>
        <strong>Your mentor profile is under review</strong>
        <small>
          Profile, security and support pages remain available. Messaging is limited to
          admin/support; payout and availability changes are unavailable.
        </small>
      </span>
    </div>
  );
}
function Toast({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.toast} role="status">
      <Check size={14} />
      {children}
    </div>
  );
}
