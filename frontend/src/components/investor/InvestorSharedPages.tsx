"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BellOff,
  BookOpen,
  CalendarClock,
  Check,
  ChevronRight,
  CircleHelp,
  Download,
  Eye,
  FileText,
  Filter,
  Info,
  Inbox,
  LifeBuoy,
  LockKeyhole,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Search,
  Send,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Ticket,
  UserRound,
  X,
} from "lucide-react";
import {
  InvestorConversation,
  InvestorNotification,
  InvestorNotificationCategory,
  useInvestorRole,
} from "@/context/InvestorRoleContext";
import styles from "./InvestorSharedPages.module.css";

const dateTime = (value: string) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "Not available"
    : d.toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Kolkata",
      }) + " IST";
};
const dayGroup = (value: string) => {
  const d = new Date(value),
    n = new Date();
  if (Number.isNaN(d.getTime())) return "Earlier";
  if (d.toDateString() === n.toDateString()) return "Today";
  const y = new Date(n);
  y.setDate(y.getDate() - 1);
  return d.toDateString() === y.toDateString() ? "Yesterday" : "Earlier";
};
const bannerText = (verified: boolean) =>
  verified
    ? "Investor verification status is stored locally; no identity service confirms it."
    : "Your investor account is under review. Messaging is limited to admin and support; notifications, help and basic settings remain available.";
function StatusBanner({ verified }: { verified: boolean }) {
  return (
    <div className={styles.statusBanner}>
      <ShieldAlert size={16} />
      <span>
        <strong>
          {verified ? "Verified investor account" : "Your investor account is under review"}
        </strong>
        <small>{bannerText(verified)}</small>
      </span>
    </div>
  );
}
function PageHeading({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <header className={styles.heading}>
      <span className={styles.headingIcon}>{icon}</span>
      <div className={styles.headingText}>
        <span className={styles.eyebrow}>MERIDIAN · INVESTOR ROLE</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action && <div className={styles.headingAction}>{action}</div>}
    </header>
  );
}
function Notice({ children, warning = false }: { children: React.ReactNode; warning?: boolean }) {
  return (
    <div className={warning ? styles.warning : styles.notice}>
      <Info size={14} />
      <span>{children}</span>
    </div>
  );
}
function Empty({
  title,
  detail,
  action,
  href,
}: {
  title: string;
  detail: string;
  action?: string;
  href?: string;
}) {
  return (
    <div className={styles.empty}>
      <strong>{title}</strong>
      <p>{detail}</p>
      {action && href && (
        <Link className={styles.secondary} href={href}>
          {action}
          <ArrowRight size={13} />
        </Link>
      )}
    </div>
  );
}
function Button({
  children,
  disabled = false,
  onClick,
  kind = "secondary",
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  kind?: "primary" | "secondary" | "danger";
}) {
  return (
    <button
      className={
        kind === "primary" ? styles.primary : kind === "danger" ? styles.danger : styles.secondary
      }
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

const messageFilters = [
  "All",
  "Startups",
  "Offers",
  "Diligence",
  "Team",
  "Admin and support",
  "Unread",
  "Archived",
];
function matchesConversation(c: InvestorConversation, filter: string) {
  if (filter === "All") return !c.archived;
  if (filter === "Unread") return c.unread > 0;
  if (filter === "Archived") return c.archived;
  if (filter === "Startups") return c.threadType === "Startup" || c.threadType === "Intro";
  if (filter === "Offers") return c.threadType === "Offer";
  if (filter === "Diligence") return c.threadType === "Diligence";
  if (filter === "Team") return c.threadType === "Team";
  if (filter === "Admin and support") return c.threadType === "Support";
  return true;
}
export function InvestorMessagesPage() {
  const { data, setData } = useInvestorRole();
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [compose, setCompose] = useState(false);
  const [toast, setToast] = useState("");
  const verified = data.kycStatus === "Verified";
  const conversations = data.conversations
    .filter((c) => verified || c.threadType === "Support")
    .filter((c) => matchesConversation(c, filter))
    .filter((c) =>
      `${c.participantName} ${c.preview} ${c.messages.map((m) => m.body).join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    );
  const active = conversations.find((c) => c.id === selected) || conversations[0];
  const unread = data.conversations.reduce((n, c) => n + c.unread, 0);
  const notice = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3000);
  };
  const open = (c: InvestorConversation) => {
    setSelected(c.id);
    setData((d) => ({
      ...d,
      conversations: d.conversations.map((x) => (x.id === c.id ? { ...x, unread: 0 } : x)),
    }));
  };
  const contacts = data.startups.filter(
    (s) =>
      data.requests.some(
        (r) => r.startupId === s.id && r.direction === "Sent" && r.status === "Accepted",
      ) || data.conversations.some((c) => c.startupId === s.id && c.threadType === "Startup"),
  );
  return (
    <div className={styles.page}>
      <PageHeading
        icon={<MessageSquare />}
        title="Messages"
        subtitle="Startup, offer, diligence, colleague and support conversations. Keep deal discussions on platform."
        action={
          <Button
            kind="primary"
            disabled={!verified || !contacts.length}
            onClick={() => setCompose(true)}
          >
            New message
          </Button>
        }
      />
      <StatusBanner verified={verified} />
      <Notice>
        The platform introduces parties; it is not a broker or adviser unless licensed. Messages do
        not recommend investments or guarantee returns.
      </Notice>
      <Notice warning>
        The secure messaging, attachment, moderation and audit services are not connected. No
        conversations are seeded; this page is not a secure inbox.
      </Notice>
      <div className={styles.messagesLayout}>
        <aside className={styles.conversationPane}>
          <label className={styles.search}>
            <Search size={15} />
            <input
              aria-label="Search messages"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search names, messages, files"
            />
          </label>
          <div className={styles.filterBar}>
            {messageFilters.map((t) => (
              <button
                key={t}
                className={filter === t ? styles.filterActive : styles.filter}
                onClick={() => setFilter(t)}
              >
                {t}
                {t === "Unread" && unread > 0 && <b>{unread}</b>}
              </button>
            ))}
          </div>
          <div className={styles.conversationList}>
            {conversations.length ? (
              conversations.map((c) => (
                <button
                  key={c.id}
                  className={`${styles.conversation} ${active?.id === c.id ? styles.conversationActive : ""}`}
                  onClick={() => open(c)}
                >
                  <span className={styles.avatar}>
                    {c.threadType === "Support" ? (
                      <LifeBuoy size={16} />
                    ) : (
                      c.participantName.slice(0, 1)
                    )}
                  </span>
                  <span className={styles.conversationText}>
                    <span className={styles.conversationTop}>
                      <strong>{c.participantName}</strong>
                      <small>{dateTime(c.updatedAt)}</small>
                    </span>
                    <span className={styles.preview}>{c.preview || "No preview"}</span>
                    <span className={styles.chips}>
                      <i>
                        {c.threadType}
                        {c.threadType === "Offer" && c.version ? ` · v${c.version}` : ""}
                        {c.status ? ` · ${c.status}` : ""}
                      </i>
                      {c.unread > 0 && <b className={styles.unreadCount}>{c.unread}</b>}
                    </span>
                  </span>
                  {c.unread > 0 && <span className={styles.unreadDot} />}
                </button>
              ))
            ) : (
              <Empty
                title={query ? "No matching conversations." : "No conversations yet."}
                detail={
                  verified
                    ? "Threads appear after an accepted introduction, a startup-initiated conversation, or an authorized team/support thread."
                    : "Only admin and support conversations are available until verification."
                }
                action="View intro requests"
                href="/investor/requests"
              />
            )}
          </div>
        </aside>
        <main className={styles.threadPane}>
          {active ? (
            <>
              <header className={styles.threadHead}>
                <span className={styles.threadAvatar}>{active.participantName.slice(0, 1)}</span>
                <div>
                  <h2>{active.participantName}</h2>
                  <small>
                    {active.threadType}
                    {active.stage ? ` · ${active.stage}` : ""}
                    {active.status ? ` · ${active.status}` : ""}
                  </small>
                </div>
                <div className={styles.threadActions}>
                  {active.startupId && (
                    <Link
                      className={styles.secondary}
                      href={`/investor/startups/${active.startupId}`}
                    >
                      Open profile <ArrowUpRight size={12} />
                    </Link>
                  )}
                  {active.offerId && (
                    <Link className={styles.secondary} href={`/investor/offers/${active.offerId}`}>
                      Open offer <ArrowUpRight size={12} />
                    </Link>
                  )}
                </div>
              </header>
              {active.readOnly && <Notice warning>This conversation is read-only.</Notice>}
              <div className={styles.messages}>
                {active.messages.length ? (
                  active.messages.map((m) => (
                    <article
                      key={m.id}
                      className={`${styles.message} ${m.sender === "Investor" ? styles.myMessage : m.sender === "System" ? styles.systemMessage : ""}`}
                    >
                      <strong>
                        {m.sender === "Investor"
                          ? "You"
                          : m.sender === "System"
                            ? "Platform"
                            : active.participantName}
                      </strong>
                      <p>{m.body}</p>
                      <small>
                        {dateTime(m.date)}
                        {m.sender === "Investor" && m.read ? " · Read" : ""}
                      </small>
                    </article>
                  ))
                ) : (
                  <Empty
                    title="No messages in this thread."
                    detail="No conversation history has been fabricated."
                  />
                )}
              </div>
              <div className={styles.composer}>
                <div className={styles.composerTools}>
                  <select defaultValue="" aria-label="Insert related item">
                    <option value="" disabled>
                      Insert related item
                    </option>
                    <option>Link an offer</option>
                    <option>Link a diligence question</option>
                    <option>Link a meeting</option>
                    <option>Link a data-room document</option>
                  </select>
                  <select defaultValue="" aria-label="Message template">
                    <option value="" disabled>
                      Templates
                    </option>
                    <option>Thanks for the intro</option>
                    <option>Request a data-room folder</option>
                    <option>Schedule a diligence call</option>
                    <option>Follow up on my questions</option>
                    <option>Polite pass with feedback</option>
                  </select>
                  <button className={styles.iconButton} disabled aria-label="Attach file">
                    <Paperclip size={14} />
                  </button>
                </div>
                <textarea
                  value={draft}
                  maxLength={5000}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Secure messaging is not connected. Your draft remains in this page only."
                />
                <div className={styles.composerBottom}>
                  <small>{draft.length}/5,000 · Draft is not sent or saved.</small>
                  <Button
                    kind="primary"
                    disabled={!draft.trim() || active.readOnly}
                    onClick={() => notice("Messaging service is not connected. Nothing was sent.")}
                  >
                    <Send size={13} /> Send
                  </Button>
                </div>
                <div className={styles.safetyText}>
                  <LockKeyhole size={12} /> Keep deal steps on platform. Verify any payment
                  instructions by a second channel. Avoid return promises or urgency pressure.
                </div>
              </div>
            </>
          ) : (
            <div className={styles.threadEmpty}>
              <MessageSquare size={23} />
              <strong>Select a conversation</strong>
              <span>
                Conversations are not connected; no participant names or message content are shown.
              </span>
            </div>
          )}
        </main>
        <aside className={styles.contextPane}>
          <h3>{active?.threadType === "Support" ? "Support ticket" : "Conversation context"}</h3>
          {active?.startupId ? (
            (() => {
              const s = data.startups.find((x) => x.id === active.startupId);
              return s ? (
                <>
                  <div className={styles.contextCard}>
                    <span className={styles.avatar}>{s.name.slice(0, 1)}</span>
                    <strong>{s.name}</strong>
                    <small>
                      {s.stage} · {s.sectors.join(", ") || "Sector not shared"}
                    </small>
                    <Link href={`/investor/startups/${s.id}`}>
                      Open profile <ArrowRight size={12} />
                    </Link>
                  </div>
                  <div className={styles.contextGroup}>
                    <strong>Deal status</strong>
                    <span>
                      Pipeline:{" "}
                      {data.pipeline.find((p) => p.startupId === s.id)?.stage || "Not recorded"}
                    </span>
                    <span>
                      Data room:{" "}
                      {data.dataRooms.find((r) => r.startupId === s.id)?.status || "Not requested"}
                    </span>
                    <span>
                      Diligence:{" "}
                      {data.diligence.find((r) => r.startupId === s.id)?.items.length ||
                        "Not started"}
                    </span>
                    <span>
                      Offer:{" "}
                      {data.offers.find((o) => o.startupId === s.id)?.status || "No offer record"}
                    </span>
                  </div>
                </>
              ) : (
                <Empty
                  title="Context unavailable."
                  detail="Only fields shared with you are shown."
                />
              );
            })()
          ) : (
            <Empty
              title="No context available."
              detail="No startup, ticket or organization thread is selected."
            />
          )}
          <div className={styles.contextGroup}>
            <strong>Quick actions</strong>
            <Button disabled>Schedule meeting</Button>
            <Button disabled>Request data-room access</Button>
            <Button disabled>Add private note</Button>
            <Button disabled>Report</Button>
          </div>
          <p className={styles.helper}>
            Private notes, shared files and audit events require connected services.
          </p>
        </aside>
      </div>
      {compose && (
        <div className={styles.overlay}>
          <section className={styles.dialog} role="dialog" aria-modal="true">
            <header>
              <h2>New message</h2>
              <button
                className={styles.iconButton}
                onClick={() => setCompose(false)}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </header>
            <p>
              Only startups with an accepted intro or an existing startup-initiated conversation can
              be contacted here. Cold messages are not available.
            </p>
            {contacts.map((s) => (
              <button
                className={styles.recipient}
                key={s.id}
                onClick={() => notice("Messaging service is not connected; no thread was created.")}
              >
                {s.name} · {s.stage} <ArrowRight size={12} />
              </button>
            ))}
            <Notice>
              Messaging is disconnected. No recipient list is available beyond existing authorized
              relationships.
            </Notice>
          </section>
        </div>
      )}
      {toast && (
        <div className={styles.toast} role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

const notificationTabs = [
  "All",
  "Unread",
  "Deal flow",
  "Diligence",
  "Meetings",
  "Offers and money",
  "Portfolio",
  "Events",
  "System",
  "Messages",
];
const notificationHref = (item: InvestorNotification) => item.href || "/investor/dashboard";
export function InvestorNotificationsPage() {
  const { data, setData } = useInvestorRole();
  const [filter, setFilter] = useState("All");
  const [toast, setToast] = useState("");
  const eligible = data.notifications.filter(
    (n) =>
      data.kycStatus === "Verified" ||
      n.security ||
      n.category === "System" ||
      /billing|invoice|plan|subscription|payment (?:succeeded|failed|method|retry|retried)/i.test(
        `${n.title} ${n.detail}`,
      ),
  );
  const visible = eligible
    .filter((n) =>
      filter === "All" || filter === "Unread"
        ? filter === "Unread"
          ? n.unread
          : true
        : n.category === filter,
    )
    .sort(
      (a, b) =>
        Number(b.urgent) - Number(a.urgent) ||
        new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  const unread = eligible.filter((n) => n.unread).length;
  const notice = (s: string) => {
    setToast(s);
    window.setTimeout(() => setToast(""), 2800);
  };
  const mark = (id: string) =>
    setData((d) => ({
      ...d,
      notifications: d.notifications.map((n) => (n.id === id ? { ...n, unread: false } : n)),
    }));
  const grouped = visible.reduce<Record<string, InvestorNotification[]>>((a, n) => {
    const g = dayGroup(n.date);
    (a[g] ??= []).push(n);
    return a;
  }, {});
  return (
    <div className={styles.page}>
      <PageHeading
        icon={<Bell />}
        title="Notifications"
        subtitle="Investor deal flow, diligence, offers, portfolio, billing, events and security updates."
        action={
          <div className={styles.actionRow}>
            <Button
              disabled={!unread}
              onClick={() => {
                setData((d) => ({
                  ...d,
                  notifications: d.notifications.map((n) =>
                    eligible.some((v) => v.id === n.id) ? { ...n, unread: false } : n,
                  ),
                }));
                notice("Read state saved in this browser only.");
              }}
            >
              <Check size={14} /> Mark all as read
            </Button>
            <Link className={styles.primary} href="/investor/settings#notifications">
              <Settings size={14} /> Preferences
            </Link>
          </div>
        }
      />
      <StatusBanner verified={data.kycStatus === "Verified"} />
      <Notice>
        Notification delivery and routing are not connected. Security and billing-failure alerts
        must remain unmutable in production.
      </Notice>
      <div className={styles.filterBar}>
        {notificationTabs.map((t) => (
          <button
            key={t}
            className={filter === t ? styles.filterActive : styles.filter}
            onClick={() => setFilter(t)}
          >
            {t}
            {t === "Unread" && unread > 0 && <b>{unread}</b>}
          </button>
        ))}
      </div>
      {visible.length ? (
        Object.entries(grouped).map(([group, items]) => (
          <section className={styles.notificationGroup} key={group}>
            <h2>{group}</h2>
            {items.map((n) => (
              <article
                className={`${styles.notification} ${n.urgent ? styles.urgent : ""} ${!n.unread ? styles.read : ""}`}
                key={n.id}
              >
                <span className={styles.notificationIcon}>
                  {n.security ? (
                    <ShieldCheck size={17} />
                  ) : n.category === "Messages" ? (
                    <MessageSquare size={17} />
                  ) : n.category === "Meetings" ? (
                    <CalendarClock size={17} />
                  ) : n.category === "System" ? (
                    <Activity size={17} />
                  ) : (
                    <Inbox size={17} />
                  )}
                </span>
                <div>
                  <Link href={notificationHref(n)} onClick={() => mark(n.id)}>
                    <strong>{n.title}</strong>
                  </Link>
                  <p>{n.detail}</p>
                  <small>
                    {dateTime(n.date)} · <i>Investor</i>
                  </small>
                </div>
                {n.unread && <span className={styles.unreadDot} />}
                <button
                  className={styles.iconButton}
                  onClick={() => mark(n.id)}
                  aria-label="Mark as read"
                >
                  <Check size={14} />
                </button>
                <button
                  className={styles.iconButton}
                  disabled={
                    n.security ||
                    /billing|invoice|payment failed|payment method|subscription/i.test(
                      `${n.title} ${n.detail}`,
                    )
                  }
                  title={
                    n.security ||
                    /billing|invoice|payment failed|payment method|subscription/i.test(
                      `${n.title} ${n.detail}`,
                    )
                      ? "Security and billing alerts cannot be muted"
                      : "Mute notification type"
                  }
                  onClick={() => notice("Notification preferences are not connected.")}
                  aria-label="Mute notification type"
                >
                  <BellOff size={14} />
                </button>
              </article>
            ))}
          </section>
        ))
      ) : (
        <div className={styles.emptyLarge}>
          <Bell size={22} />
          <h2>{filter === "Unread" ? "No unread notifications." : "You're all caught up."}</h2>
          <p>
            Investor notifications appear here when connected services emit verified events. No
            sample messages or alerts are seeded.
          </p>
        </div>
      )}
      {toast && (
        <div className={styles.toast} role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

const settingsSections = [
  "Account",
  "Security",
  "Verification",
  "Organization",
  "Notifications",
  "Privacy and visibility",
  "Investing preferences",
  "Data room and diligence defaults",
  "Membership and billing",
  "Connected accounts",
  "Roles",
  "Help and legal",
  "Danger zone",
];
const prefRows = [
  "Suggested matches and saved search alerts",
  "Intro requests and replies",
  "Shortlist updates",
  "Data room access, NDA and document changes",
  "Diligence answers and reminders",
  "Meetings",
  "Offers and negotiation",
  "Commitments, funds and closing",
  "Portfolio updates and reports",
  "Portfolio rights deadlines",
  "Events",
  "Market insights digest",
  "Billing and invoices",
  "Messages",
  "Platform updates",
  "Security alerts",
];
export function InvestorSettingsPage() {
  const { data } = useInvestorRole();
  const [section, setSection] = useState("Account");
  useEffect(() => {
    if (window.location.hash === "#notifications") setSection("Notifications");
  }, []);
  const verified = data.kycStatus === "Verified";
  const unavailable = (
    <Notice warning>
      Identity, account, preference and organization settings are browser-local or disconnected. No
      change is sent or applied to a secure account.
    </Notice>
  );
  return (
    <div className={styles.page}>
      <PageHeading
        icon={<Settings />}
        title="Settings"
        subtitle="Investor account, security, verification, privacy and communication preferences."
      />
      <StatusBanner verified={verified} />
      <div className={styles.settingsLayout}>
        <nav className={styles.settingsNav} aria-label="Investor settings">
          {settingsSections.map((s) => (
            <button
              key={s}
              className={section === s ? styles.settingsActive : styles.settingsItem}
              onClick={() => setSection(s)}
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
                text="Basic account details and display preferences."
              />
              {unavailable}
              <div className={styles.formGrid}>
                {[
                  ["Name", data.investorName],
                  ["Email", "Not connected"],
                  ["Phone", "Not connected"],
                  ["Language", "English · not configured"],
                  ["Time zone", "Asia/Kolkata · default"],
                  ["Date format", "Not configured"],
                  ["Currency display", "INR · default"],
                ].map(([label, value]) => (
                  <label key={label}>
                    {label}
                    <input value={value} disabled readOnly />
                  </label>
                ))}
              </div>
            </>
          )}
          {section === "Security" && (
            <>
              <SettingsTitle
                title="Security"
                text="Protect access to confidential investor information."
              />
              {unavailable}
              <div className={styles.settingsCard}>
                <h3>Two-factor authentication</h3>
                <p>2FA setup, recovery codes and recent sign-in records are not connected.</p>
                <Button disabled>Set up 2FA</Button>
              </div>
              <div className={styles.settingsCard}>
                <h3>Password and sessions</h3>
                <p>Password change requires re-authentication. Session inventory is unavailable.</p>
                <div className={styles.actionRow}>
                  <Button disabled>Change password</Button>
                  <Button disabled>Sign out everywhere</Button>
                  <Link href="/investor/activity">
                    Open activity log <ArrowRight size={12} />
                  </Link>
                </div>
              </div>
            </>
          )}
          {section === "Verification" && (
            <>
              <SettingsTitle
                title="Verification"
                text="KYC level, eligibility and document status."
              />
              <div className={styles.settingsCard}>
                <strong>Current status · {data.kycStatus}</strong>
                <p>
                  Identity verification, eligibility and secure document storage are not connected.
                  Offer and data-room permissions cannot be established by this preview.
                </p>
                <Button disabled>Update verification</Button>
              </div>
            </>
          )}
          {section === "Organization" && (
            <>
              <SettingsTitle
                title="Organization"
                text="Shared membership and approval controls for a fund or angel group."
              />
              <Empty
                title={
                  data.organizationName
                    ? "Organization settings unavailable."
                    : "No organization record."
                }
                detail="Organization membership, roles, invites, approvals and thresholds are not connected. Owner/Admin authorization is required."
              />
              <Button disabled>Invite member</Button>
            </>
          )}
          {section === "Notifications" && (
            <>
              <SettingsTitle
                title="Notification preferences"
                text="Security alerts and billing-failure alerts are always on."
              />
              {unavailable}
              <div className={styles.tableWrap}>
                <table>
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>In-app</th>
                      <th>Email</th>
                      <th>Push</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prefRows.map((r, i) => (
                      <tr key={r}>
                        <td>
                          {r}
                          {r === "Security alerts" && <small> Required · cannot be muted</small>}
                        </td>
                        {[0, 1, 2].map((c) => (
                          <td key={c}>
                            <input
                              type="checkbox"
                              aria-label={`${r} channel ${c + 1}`}
                              disabled
                              checked={r === "Security alerts" || (i < 4 && c === 0)}
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
                  <select disabled>
                    <option>Instant · not configured</option>
                    <option>Daily</option>
                    <option>Weekly</option>
                  </select>
                </label>
                <label>
                  Quiet hours
                  <input type="time" disabled value="21:00" readOnly />
                </label>
                <label>
                  Quiet hours end
                  <input type="time" disabled value="08:00" readOnly />
                </label>
              </div>
            </>
          )}
          {section === "Privacy and visibility" && (
            <>
              <SettingsTitle
                title="Privacy and visibility"
                text="Control what startups may see and your anonymous analytics contribution."
              />
              {unavailable}
              <div className={styles.settingsCard}>
                <h3>Investor profile visibility</h3>
                <p>
                  Visibility changes require verified account controls. Contact details are not
                  shown publicly.
                </p>
                <button className={styles.secondary} disabled>
                  Visibility controls unavailable
                </button>
              </div>
              <div className={styles.settingsCard}>
                <h3>What startups see</h3>
                <p>
                  Name or firm, investor type, stage and sector focus, ticket range, verified
                  portfolio highlights and response time are not configured.
                </p>
              </div>
              <div className={styles.settingsCard}>
                <h3>Hidden and passed startups</h3>
                <p>
                  {data.hiddenStartupIds.length + data.passedStartupIds.length || "No"} local
                  records. Restore controls require the connected investor profile service.
                </p>
                <Button disabled>Manage hidden startups</Button>
              </div>
              <div className={styles.settingsCard}>
                <h3>Data and anonymized contribution</h3>
                <p>
                  Data export and deletion require identity checks and retention controls. NDAs,
                  offers and financial records may be retained under policy and law.
                </p>
                <div className={styles.actionRow}>
                  <Button disabled>
                    <Download size={13} /> Download my data
                  </Button>
                  <Button disabled kind="danger">
                    Delete my data
                  </Button>
                </div>
              </div>
            </>
          )}
          {section === "Investing preferences" && (
            <>
              <SettingsTitle
                title="Investing preferences"
                text="Investor-facing profile and search controls."
              />
              <SettingsLink
                title="Investor profile"
                detail="Profile service is not connected."
                href="/investor/dashboard"
              />
              <SettingsLink
                title="Investment criteria"
                detail="Set stage, sector, region, ticket and instrument preferences."
                href="/investor/discover"
              />
              <SettingsLink
                title="Saved searches and alerts"
                detail={`${data.savedSearches.length} local saved searches.`}
                href="/investor/searches"
              />
              <SettingsLink
                title="Pipeline defaults"
                detail="Manage your private investor pipeline."
                href="/investor/pipeline"
              />
            </>
          )}
          {section === "Data room and diligence defaults" && (
            <>
              <SettingsTitle
                title="Data room and diligence defaults"
                text="Secure viewer and investor checklist preferences."
              />
              {unavailable}
              <div className={styles.settingsCard}>
                <h3>Watermark and viewer</h3>
                <p>
                  Watermark identity, zoom, page layout and idle lock are set by the secure document
                  service.
                </p>
                <Button disabled>Viewer preferences</Button>
              </div>
              <div className={styles.settingsCard}>
                <h3>Diligence templates</h3>
                <p>Checklist, scorecard, call-notes and question templates are not configured.</p>
                <Link href="/investor/pipeline">
                  Open diligence workspace <ArrowRight size={12} />
                </Link>
              </div>
            </>
          )}
          {section === "Membership and billing" && (
            <>
              <SettingsTitle
                title="Membership and billing"
                text="Billing changes happen in the billing workspace with re-authentication."
              />
              <SettingsLink
                title="Membership and billing"
                detail="Plan, invoices, payment methods and fees."
                href="/investor/billing"
              />
            </>
          )}
          {section === "Connected accounts" && (
            <>
              <SettingsTitle
                title="Connected accounts"
                text="Authentication and calendar providers are not connected."
              />
              {["Google sign-in", "Microsoft sign-in", "Read-only calendar sync", "LinkedIn"].map(
                (x) => (
                  <div className={styles.rowCard} key={x}>
                    <strong>{x}</strong>
                    <span>Not connected</span>
                    <Button disabled>Connect</Button>
                  </div>
                ),
              )}
            </>
          )}
          {section === "Roles" && (
            <>
              <SettingsTitle
                title="Roles"
                text="The active role determines which workspace content is shown."
              />
              <div className={styles.settingsCard}>
                <h3>Active role: Investor</h3>
                <p>
                  Role switching and multi-role verification are project dependencies, not connected
                  in this preview.
                </p>
                <Button disabled>Add a role</Button>
              </div>
            </>
          )}
          {section === "Help and legal" && (
            <>
              <SettingsTitle
                title="Help and legal"
                text="Investor-specific help, legal information and conduct guidance."
              />
              <SettingsLink
                title="Help and Support"
                detail="Investor topics, contact support and report a concern."
                href="/help?role=investor"
              />
              <SettingsLink
                title="Terms and privacy"
                detail="Platform terms, privacy and legal notices."
                href="/terms"
              />
              <p className={styles.disclaimer}>
                The platform introduces parties. It is not a broker or adviser unless licensed and
                does not give legal, tax, financial or investment advice.
              </p>
            </>
          )}
          {section === "Danger zone" && (
            <>
              <SettingsTitle
                title="Danger zone"
                text="Sensitive account actions require re-authentication and a complete checklist."
              />
              {["Pause investor profile", "Close investor role", "Delete account"].map((x) => (
                <div className={styles.dangerCard} key={x}>
                  <h3>{x}</h3>
                  <p>Unavailable until identity, billing and open-record checks are connected.</p>
                  <Button kind="danger" disabled>
                    {x}
                  </Button>
                </div>
              ))}
            </>
          )}
        </main>
      </div>
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
function SettingsLink({ title, detail, href }: { title: string; detail: string; href: string }) {
  return (
    <article className={styles.settingsLink}>
      <span>
        <strong>{title}</strong>
        <small>{detail}</small>
      </span>
      <Link href={href}>
        Open <ArrowRight size={12} />
      </Link>
    </article>
  );
}

const investorHelpArticles = [
  {
    topic: "Getting started",
    title: "Investor verification and eligibility",
    text: "Verification status and eligibility level determine which investor actions are available. Keep submitted identity documents in the secure verification flow; do not send them through messages.",
  },
  {
    topic: "Discover and shortlist",
    title: "Using filters and Investment Ready",
    text: "Filters describe fit to your chosen criteria, not investment quality. Investment Ready is a preparation guide, not a recommendation or assurance.",
  },
  {
    topic: "Intros and messaging",
    title: "Requesting introductions safely",
    text: "Use Intro Requests to contact a startup. Messaging a startup is available only after it accepts an introduction or initiates a conversation.",
  },
  {
    topic: "Data rooms and NDAs",
    title: "Requesting data-room access",
    text: "Access depends on startup approval, a signed NDA and continuing authorization. Views can be logged. Do not share confidential documents outside their permitted scope.",
  },
  {
    topic: "Diligence",
    title: "Using checklists and comparisons",
    text: "Investor notes are private to you or your organization according to permissions. Scores are prompts for your own evaluation, not an investment rating.",
  },
  {
    topic: "Meetings",
    title: "Scheduling investor meetings",
    text: "Confirm the time zone, agenda and any recording consent with participants. Calendar integration is not connected in this preview.",
  },
  {
    topic: "Offers and term sheets",
    title: "Understanding offer versions and binding terms",
    text: "Platform offer records are non-binding unless signed documents say otherwise. Have your lawyer review all binding terms.",
  },
  {
    topic: "Commitments and funds",
    title: "Funds and payment safety",
    text: "The platform does not hold or move funds. Verify payment instructions by calling a contact number you obtained independently; funds are received only when the startup confirms.",
  },
  {
    topic: "Portfolio",
    title: "Investor updates and manual holdings",
    text: "Manual holdings are investor-entered records. Startup reporting appears only when a company shares it with investors.",
  },
  {
    topic: "Membership and billing",
    title: "Plans, invoices and fees",
    text: "Review the plan, tax details, renewal and cancellation terms before checkout. Billing is not connected in this preview.",
  },
  {
    topic: "Events and insights",
    title: "How event access and market insights work",
    text: "Event registration depends on verification, plan and invitation. Insights should be aggregated and anonymized, with small groups suppressed.",
  },
  {
    topic: "Teams and organizations",
    title: "Organization roles and approvals",
    text: "Organization membership controls access to shared notes, inboxes and approvals. Owners and Admins manage billing and organization settings.",
  },
  {
    topic: "Safety and conduct",
    title: "Fraud, conflicts and reporting",
    text: "Do not share passwords or verification codes. The platform is not a broker or adviser unless licensed; it does not promise returns or move funds.",
  },
  {
    topic: "Account and privacy",
    title: "Security and data requests",
    text: "Use Settings for security and privacy controls. Account deletion may retain legally required NDA, offer, commitment and financial records.",
  },
];
export function InvestorHelpPage() {
  const { data } = useInvestorRole();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<string | null>(null);
  const [contact, setContact] = useState(false);
  const [report, setReport] = useState(false);
  const articles = investorHelpArticles.filter((a) =>
    `${a.topic} ${a.title} ${a.text}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className={styles.page}>
      <PageHeading
        icon={<CircleHelp />}
        title="Help and Support"
        subtitle="Investor guidance, account support, safety and reporting."
        action={
          <Link className={styles.primary} href="/help/tickets?role=investor">
            <Ticket size={14} /> My tickets
          </Link>
        }
      />
      <StatusBanner verified={data.kycStatus === "Verified"} />
      <div className={styles.roleNotice}>
        <span>Investor</span>
        <small>Investor help content · role-specific</small>
        <Link href="/investor/dashboard">Investor workspace</Link>
      </div>
      <label className={styles.helpSearch}>
        <Search size={16} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search help for investors"
        />
      </label>
      <div className={styles.helpGrid}>
        <main>
          <section className={styles.helpSection}>
            <h2>{query ? "Search results" : "Investor help topics"}</h2>
            {articles.length ? (
              <div className={styles.articleGrid}>
                {articles.map((a) => (
                  <article className={styles.articleCard} key={a.title}>
                    <button
                      className={styles.articleSelect}
                      aria-expanded={active === a.title}
                      onClick={() => setActive(active === a.title ? null : a.title)}
                    >
                      <span className={styles.articleIcon}>
                        <BookOpen size={16} />
                      </span>
                      <span>
                        <strong>{a.topic}</strong>
                        <small>{a.title}</small>
                      </span>
                      <ChevronRight size={14} />
                    </button>
                    {active === a.title && (
                      <div className={styles.articleExpand}>
                        <p>{a.text}</p>
                        <small>Knowledge base integration is not connected.</small>
                        <div className={styles.helpful}>
                          Was this helpful? <button disabled>Yes</button>
                          <button disabled>No</button>
                        </div>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <Empty
                title="No articles found."
                detail="Try a different phrase or contact investor support."
              />
            )}
          </section>
          <section className={styles.helpSection}>
            <h2>Fraud and safety center</h2>
            <ul className={styles.safetyList}>
              <li>Verify payment instructions by phone using a number you found independently.</li>
              <li>The platform never asks you to transfer funds through chat or email.</li>
              <li>Be wary of urgency, pressure or changed bank details.</li>
              <li>
                Do not share passwords, verification codes or identity documents outside secure
                flows.
              </li>
              <li>If you suspect fraud, stop contact, contact your bank and keep records.</li>
            </ul>
            <Link className={styles.secondary} href="/investor/commitments">
              Review commitment safety guidance
            </Link>
          </section>
          <section className={styles.helpSection}>
            <h2>Investor conduct</h2>
            <p>
              Disclose conflicts and keep deal communications respectful. Presentations and platform
              insights are not investment recommendations.
            </p>
            <p className={styles.disclaimer}>
              The platform introduces startups and investors. It is not a broker or adviser unless
              licensed, and it does not give legal, tax, financial or investment advice.
            </p>
          </section>
        </main>
        <aside className={styles.helpAside}>
          <div className={styles.supportCard}>
            <LifeBuoy size={18} />
            <h2>Need more help?</h2>
            <p>
              Support service is not connected in this preview; expected response times are not
              available.
            </p>
            <Button kind="primary" onClick={() => setContact(true)}>
              Contact support
            </Button>
            <Link className={styles.secondary} href="/help/tickets?role=investor">
              View tickets
            </Link>
          </div>
          <div className={styles.supportCard}>
            <ShieldAlert size={18} />
            <h3>Report a concern</h3>
            <p>
              Suspicious payment instructions, impersonation, conduct, confidential data or security
              issues.
            </p>
            <Button kind="danger" onClick={() => setReport(true)}>
              Report a concern
            </Button>
          </div>
          <div className={styles.supportCard}>
            <h3>Platform status</h3>
            <p>Status page and active incident feed are unavailable.</p>
            <Button disabled>View status</Button>
          </div>
        </aside>
      </div>
      {(contact || report) && (
        <InvestorSupportForm
          report={report}
          onClose={() => {
            setContact(false);
            setReport(false);
          }}
        />
      )}
    </div>
  );
}
function InvestorSupportForm({ report, onClose }: { report: boolean; onClose: () => void }) {
  const [type, setType] = useState("Suspicious payment instructions");
  const [description, setDescription] = useState("");
  return (
    <div className={styles.overlay}>
      <form
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        onSubmit={(e) => e.preventDefault()}
      >
        <header>
          <h2>{report ? "Report a concern" : "Contact investor support"}</h2>
          <button type="button" className={styles.iconButton} onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </header>
        {report && (
          <label className={styles.formField}>
            Concern type
            <select value={type} onChange={(e) => setType(e.target.value)}>
              {[
                "Suspicious payment instructions",
                "Report a startup",
                "Report a message or user",
                "Data-room or document issue",
                "Event concern",
                "Conflict or compliance concern",
                "Safety or security issue",
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
        )}
        {report && type === "Suspicious payment instructions" && (
          <Notice warning>
            Stop contact. Do not send funds. Verify any details with the startup using a separate,
            independently obtained phone number. Contact your bank if you may have paid.
          </Notice>
        )}
        <label className={styles.formField}>
          Category
          <select>
            <option>Account and privacy</option>
            <option>Offers and commitments</option>
            <option>Data rooms and diligence</option>
            <option>Membership and billing</option>
            <option>Events and insights</option>
          </select>
        </label>
        <label className={styles.formField}>
          Related record
          <select disabled>
            <option>No records available</option>
          </select>
        </label>
        <label className={styles.formField}>
          Preferred contact method
          <select disabled>
            <option>Email · not configured</option>
            <option>In-app</option>
          </select>
        </label>
        <label className={styles.formField}>
          Urgency
          <select disabled>
            <option>Normal</option>
            <option>Urgent · payment, access or security</option>
          </select>
        </label>
        <label className={styles.formField}>
          Attachments · up to 5 files, 10 MB each
          <input type="file" multiple disabled />
          <small className={styles.helper}>Secure upload and virus scanning are unavailable.</small>
        </label>
        <label className={styles.formField}>
          Description · 20–2,000 characters
          <textarea
            minLength={20}
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the issue. This draft is kept on this page only."
          />
        </label>
        <p className={styles.helper}>
          Ticket submission, confidential routing and attachments are not connected. Nothing will be
          sent.
        </p>
        <div className={styles.actionRow}>
          <Button onClick={onClose}>Cancel</Button>
          <Button kind={report ? "danger" : "primary"} disabled>
            Submit · support unavailable
          </Button>
        </div>
      </form>
    </div>
  );
}

export function InvestorTicketsPage() {
  const { data } = useInvestorRole();
  return (
    <div className={styles.page}>
      <PageHeading
        icon={<Ticket />}
        title="My support tickets"
        subtitle="Investor support and confidential reports."
        action={
          <Link className={styles.secondary} href="/help?role=investor">
            Help centre <ArrowRight size={13} />
          </Link>
        }
      />
      <StatusBanner verified={data.kycStatus === "Verified"} />
      <Notice warning>
        Ticketing is not connected. No ticket IDs, statuses, replies or records are fabricated.
      </Notice>
      <Empty
        title="No support tickets."
        detail="Support tickets will appear after a connected ticket service is available."
        action="Investor help"
        href="/help?role=investor"
      />
    </div>
  );
}
