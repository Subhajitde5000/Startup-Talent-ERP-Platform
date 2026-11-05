"use client";
import { formatDate } from "@/utils/formatters";
import React, { FormEvent, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  CalendarDays,
  Check,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Info,
  LockKeyhole,
  MoreHorizontal,
  Plus,
  Search,
  TrendingUp,
  X,
} from "lucide-react";
import { useStartupWorkspace } from "@/context/StartupWorkspaceContext";
import { useMentorWorkspace } from "@/context/MentorWorkspaceContext";
import {
  FundraisingRound,
  InvestorAccessRequest,
  InvestorData,
  InvestorFile,
  InvestorMeeting,
  InvestorMessage,
  InvestorRecord,
  InvestorSettings,
  PipelineStage,
  RoundOffer,
  useStartupInvestors,
} from "@/context/StartupInvestorContext";
import styles from "./InvestorPages.module.css";
type View =
  | "hub"
  | "discover"
  | "profile"
  | "pipeline"
  | "data-room"
  | "requests"
  | "messages"
  | "meetings"
  | "rounds"
  | "round"
  | "settings";
const stages: PipelineStage[] = [
  "Interested",
  "Intro / Talking",
  "Meeting held",
  "Data room",
  "Offer",
  "Committed",
  "Passed",
  "Declined by you",
];
const folders = ["Corporate", "Financials", "Legal", "Product", "Team", "Customers", "Pitch"];
const rid = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const money = (n: number) =>
  `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n || 0)}`;
const dtext = (s: string) => formatDate(s, "Not set");
const cls = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, "-");
export default function InvestorPages({
  view,
  investorId,
  roundId,
}: {
  view: View;
  investorId?: string;
  roundId?: string;
}) {
  const { data, setData } = useStartupInvestors();
  const startup = useStartupWorkspace();
  const mentor = useMentorWorkspace();
  const member = startup.data.team.find((t) => t.name === startup.data.startup.founderName);
  const role = member?.permission || "Owner";
  const owner = role === "Owner";
  const manager = owner || role === "Admin";
  const ready =
    mentor.data.readiness.length > 0 &&
    mentor.data.readiness.every((i) => i.status === "Signed off");
  const visible =
    data.settings.visibility === "Mentors and verified investors" && !data.settings.paused;
  const canContact = ready && visible;
  const investor = data.investors.find((i) => i.id === investorId);
  const round = data.rounds.find((r) => r.id === roundId);
  const [toast, setToast] = useState("");
  const notify = (s: string) => {
    setToast(s);
    window.setTimeout(() => setToast(""), 3200);
  };
  let content: React.ReactNode;
  switch (view) {
    case "hub":
      content = (
        <Hub
          ready={ready}
          visible={visible}
          manager={manager}
          data={data}
          setData={setData}
          notify={notify}
        />
      );
      break;
    case "discover":
      content = <Discover data={data} canContact={canContact} />;
      break;
    case "profile":
      content = investor ? (
        <InvestorProfile
          investor={investor}
          data={data}
          setData={setData}
          canManage={manager}
          notify={notify}
        />
      ) : (
        <Missing
          title="Investor profile unavailable"
          text="This is not in your private pipeline or a connected directory. No verified investor profiles are available in this demo."
        />
      );
      break;
    case "pipeline":
      content = <Pipeline data={data} setData={setData} canManage={manager} notify={notify} />;
      break;
    case "data-room":
      content = (
        <DataRoom data={data} setData={setData} canManage={manager} owner={owner} notify={notify} />
      );
      break;
    case "requests":
      content = (
        <AccessRequests data={data} setData={setData} canManage={manager} notify={notify} />
      );
      break;
    case "messages":
      content = <Messages data={data} setData={setData} canManage={manager} notify={notify} />;
      break;
    case "meetings":
      content = <Meetings data={data} setData={setData} canManage={manager} notify={notify} />;
      break;
    case "rounds":
      content = <Rounds data={data} setData={setData} owner={owner} notify={notify} />;
      break;
    case "round":
      content = round ? (
        <RoundDetail round={round} data={data} setData={setData} owner={owner} notify={notify} />
      ) : (
        <Missing
          title="Round not found"
          text="This round is not saved in this browser."
          action="View rounds"
          href="/startup/rounds"
        />
      );
      break;
    default:
      content = (
        <VisibilitySettingsPage
          data={data}
          setData={setData}
          owner={owner}
          ready={ready}
          notify={notify}
        />
      );
  }
  return (
    <div className={styles.page}>
      <a className={styles.skip} href="#investor-main">
        Skip to investor content
      </a>
      {content}
      {toast && (
        <div className={styles.toast} role="status">
          <CheckCircle2 size={15} />
          {toast}
          <button onClick={() => setToast("")} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
function Header({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children?: React.ReactNode;
}) {
  return (
    <header className={styles.header}>
      <div>
        <span className={styles.eyebrow}>Startup workspace · Investors</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className={styles.headerActions}>{children}</div>
    </header>
  );
}
function Card({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className={styles.card}>
      <div className={styles.cardTitle}>
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
function Button({
  children,
  onClick,
  disabled,
  kind = "secondary",
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  kind?: "primary" | "secondary" | "danger";
  type?: "button" | "submit";
}) {
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={styles[kind]}>
      {children}
    </button>
  );
}
function Chip({ children, status }: { children: React.ReactNode; status: string }) {
  return <span className={`${styles.chip} ${styles["s-" + cls(status)] || ""}`}>{children}</span>;
}
function Notice({ children, warning = false }: { children: React.ReactNode; warning?: boolean }) {
  return (
    <div className={`${styles.notice} ${warning ? styles.warning : ""}`}>
      <Info size={15} />
      <span>{children}</span>
    </div>
  );
}
function Disclaimer() {
  return (
    <p className={styles.disclaimer}>
      <Info size={12} /> The platform introduces startups and investors. It is not a broker or
      adviser unless licensed. Get independent legal and financial advice.
    </p>
  );
}
function VisibilityBanner({ visible }: { visible: boolean }) {
  return (
    <div className={styles.visibilityBanner}>
      <span className={visible ? styles.goldDot : styles.grayDot} />
      <span>
        <strong>
          {visible ? "Local preference: investor visibility enabled" : "Your profile is private"}
        </strong>
        <small>
          {visible
            ? "This preference has not been published; no investor directory is connected."
            : "Investors can't find you. Visibility changes are not published from this demo."}
        </small>
      </span>
      <Link href="/startup/investors/settings">
        {visible ? "Manage" : "Change visibility"} <ArrowRight size={12} />
      </Link>
    </div>
  );
}
function Missing({
  title,
  text,
  action,
  href,
}: {
  title: string;
  text: string;
  action?: string;
  href?: string;
}) {
  return (
    <>
      <Header title={title} subtitle={text} />
      {action && href && (
        <Link className={styles.secondary} href={href}>
          <ArrowLeft size={13} />
          {action}
        </Link>
      )}
    </>
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
      <span>
        <Briefcase size={18} />
      </span>
      <strong>{title}</strong>
      <p>{detail}</p>
      {action && href && (
        <Link className={styles.secondary} href={href}>
          {action} <ArrowRight size={12} />
        </Link>
      )}
    </div>
  );
}
function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
function Progress({ value }: { value: number }) {
  return (
    <div className={styles.progress}>
      <i style={{ width: `${value}%` }} />
    </div>
  );
}
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className={styles.backdrop} onMouseDown={onClose}>
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header>
          <h2>{title}</h2>
          <button className={styles.iconButton} onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
function VisibilityChecklist({
  ready,
  profileComplete,
  fileCount,
  visible,
}: {
  ready: boolean;
  profileComplete: boolean;
  fileCount: number;
  visible: boolean;
}) {
  const rows = [
    {
      done: ready,
      title: "Earn the Investment Ready badge",
      href: "/startup/readiness",
      detail: ready ? "Mentor sign-offs recorded" : "Mentor sign-off service is not connected",
    },
    {
      done: profileComplete,
      title: "Complete the public profile",
      href: "/startup/profile",
      detail: "Profile data may be illustrative",
    },
    {
      done: fileCount >= 3,
      title: "Prepare the data room",
      href: "/startup/data-room",
      detail: `${fileCount} local document entr${fileCount === 1 ? "y" : "ies"}; no file uploads connected`,
    },
    {
      done: visible,
      title: "Choose visibility",
      href: "/startup/investors/settings",
      detail: visible ? "Local preference only" : "Private by default",
    },
  ];
  return (
    <div className={styles.checklist}>
      {rows.map((r, i) => (
        <Link href={r.href} key={r.title} className={styles.checkItem}>
          <span className={r.done ? styles.checked : styles.unchecked}>
            {r.done ? <Check size={13} /> : i + 1}
          </span>
          <span>
            <strong>{r.title}</strong>
            <small>{r.detail}</small>
          </span>
          <ArrowRight size={13} />
        </Link>
      ))}
    </div>
  );
}
function Hub({
  ready,
  visible,
  manager,
  data,
  setData,
  notify,
}: {
  ready: boolean;
  visible: boolean;
  manager: boolean;
  data: InvestorData;
  setData: React.Dispatch<React.SetStateAction<InvestorData>>;
  notify: (s: string) => void;
}) {
  const { data: startup } = useStartupWorkspace();
  const [preview, setPreview] = useState(false);
  const profileComplete = Boolean(startup.startup.name && startup.startup.industry);
  const prepare = !ready || !visible;
  const upcoming = data.meetings
    .filter((m) => ["Scheduled", "Confirmed"].includes(m.status) && new Date(m.date) > new Date())
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);
  return (
    <>
      <Header
        title="Investors"
        subtitle="Control visibility, prepare fundraising materials and track investor conversations."
      >
        <Link className={styles.primary} href="/startup/investors/discover">
          <Search size={14} /> Find investors
        </Link>
        <Link className={styles.secondary} href="/startup/investors/pipeline">
          Pipeline <ArrowRight size={12} />
        </Link>
      </Header>
      <VisibilityBanner visible={visible} />
      {prepare && !preview ? (
        <Card
          title="Prepare before you raise"
          subtitle="Discovery and sharing remain locked until readiness and visibility are confirmed."
        >
          <VisibilityChecklist
            ready={ready}
            profileComplete={profileComplete}
            fileCount={data.files.length}
            visible={visible}
          />
          <div className={styles.inlineActions}>
            <Link
              className={styles.primary}
              href={ready ? "/startup/investors/settings" : "/startup/readiness"}
            >
              Continue preparing <ArrowRight size={13} />
            </Link>
            <Button onClick={() => setPreview(true)}>Show me anyway</Button>
          </div>
          <Notice warning>
            Read-only preview. No contact, public visibility or data-room sharing actions are
            enabled.
          </Notice>
        </Card>
      ) : (
        <>
          <section className={styles.stats}>
            {[
              ["Profile views (30 days)", "—", "Analytics not connected"],
              [
                "Shortlisted by",
                data.investors.filter((i) => i.stage === "Interested").length,
                "Private records only",
              ],
              ["Conversations", data.messages.length, "Local drafts only"],
              [
                "Meetings this month",
                data.meetings.filter((m) => new Date(m.date).getMonth() === new Date().getMonth())
                  .length,
                "No calendar sync",
              ],
              ["Data room visitors", "—", "Audit tracking not connected"],
            ].map((r) => (
              <div key={String(r[0])}>
                <span>{r[0]}</span>
                <strong>{r[1]}</strong>
                <small>{r[2]}</small>
              </div>
            ))}
          </section>
          <div id="investor-main" className={styles.grid}>
            <main className={styles.mainCol}>
              <Card title="Needs your reply" subtitle="No synced requests are available.">
                <Empty
                  title="No live investor requests."
                  detail="Messages, intro requests, access requests and offers are not connected."
                  action="Review pipeline"
                  href="/startup/investors/pipeline"
                />
              </Card>
              <Card
                title="Interested investors"
                subtitle="Manual contacts stay private and separate from verified activity."
              >
                {data.investors.length ? (
                  data.investors
                    .filter((i) => !i.blocked && !i.hidden)
                    .slice(0, 5)
                    .map((i) => <InvestorRow key={i.id} investor={i} />)
                ) : (
                  <Empty
                    title="No investor activity yet."
                    detail="No verified investor directory is connected. You may record people you already know privately."
                    action="Open pipeline"
                    href="/startup/investors/pipeline"
                  />
                )}
              </Card>
              <Card title="Interest trend" subtitle="Analytics integration is not connected.">
                <div className={styles.noChart}>
                  <TrendingUp size={20} />
                  <strong>No verified views or shortlists to chart</strong>
                  <small>No investor analytics have been imported.</small>
                </div>
              </Card>
            </main>
            <aside className={styles.sideCol}>
              <Card title="Round snapshot" subtitle="No active fundraising round.">
                {data.rounds.filter((r) => ["Open", "Closing"].includes(r.status)).length ? (
                  data.rounds
                    .filter((r) => ["Open", "Closing"].includes(r.status))
                    .map((r) => (
                      <div className={styles.roundMini} key={r.id}>
                        <strong>{r.name}</strong>
                        <span>Target {money(r.target)} · local record</span>
                        <Progress
                          value={
                            r.target
                              ? Math.min(
                                  100,
                                  (r.offers
                                    .filter((o) =>
                                      ["Committed", "Funds received"].includes(o.status),
                                    )
                                    .reduce((n, o) => n + o.amount, 0) /
                                    r.target) *
                                    100,
                                )
                              : 0
                          }
                        />
                        <Link href={`/startup/rounds/${r.id}`}>Open round</Link>
                      </div>
                    ))
                ) : (
                  <Empty
                    title="Not currently raising."
                    detail="Create a private planning record; terms aren't legally recorded."
                    action="Start a round"
                    href="/startup/rounds"
                  />
                )}
                <Disclaimer />
              </Card>
              <Card title="Upcoming meetings">
                {upcoming.length ? (
                  upcoming.map((m) => <MeetingMini key={m.id} meeting={m} />)
                ) : (
                  <p className={styles.emptyText}>
                    No locally saved upcoming meetings. Calendar/video are disconnected.
                  </p>
                )}
                <Link className={styles.textLink} href="/startup/meetings">
                  Meetings <ArrowRight size={12} />
                </Link>
              </Card>
              <Card title="Readiness">
                <div className={styles.readyStatus}>
                  <span className={ready ? styles.checked : styles.unchecked}>
                    {ready ? <Check size={12} /> : <LockKeyhole size={12} />}
                  </span>
                  <span>
                    <strong>{ready ? "Sign-offs complete" : "Not yet investment ready"}</strong>
                    <small>No score or badge is generated here.</small>
                  </span>
                </div>
                <Link className={styles.textLink} href="/startup/readiness">
                  Review readiness <ArrowRight size={12} />
                </Link>
              </Card>
            </aside>
          </div>
        </>
      )}
      <Disclaimer />
    </>
  );
}
function InvestorRow({ investor }: { investor: InvestorRecord }) {
  return (
    <Link className={styles.investorRow} href={`/startup/investors/${investor.id}`}>
      <span className={styles.avatar}>{investor.firm.slice(0, 2).toUpperCase()}</span>
      <span>
        <strong>
          {investor.name}
          {investor.manual && <em>Manual entry · private</em>}
        </strong>
        <small>
          {investor.firm} · {investor.type} · {investor.sector || "Sector not entered"}
        </small>
      </span>
      <span className={styles.chip}>{investor.stage}</span>
      <ArrowRight size={13} />
    </Link>
  );
}
function MeetingMini({ meeting }: { meeting: InvestorMeeting }) {
  return (
    <div className={styles.meetingMini}>
      <CalendarDays size={14} />
      <span>
        <strong>
          {meeting.investorName} · {meeting.type}
        </strong>
        <small>{dtext(meeting.date)} · local record</small>
      </span>
      <span className={styles.chip}>{meeting.status}</span>
    </div>
  );
}
function Discover({ canContact, data }: { canContact: boolean; data: InvestorData }) {
  const [query, setQuery] = useState("");
  return (
    <>
      <Header
        title="Find investors"
        subtitle="Browse verified investors who opted in to discovery."
      >
        <Link className={styles.secondary} href="/startup/investors">
          <ArrowLeft size={13} /> Investor hub
        </Link>
      </Header>
      <VisibilityBanner
        visible={
          data.settings.visibility === "Mentors and verified investors" && !data.settings.paused
        }
      />
      <Notice warning>
        No verified investor directory or KYC feed is connected. No investor profiles are shown as
        live facts.
      </Notice>
      <div className={styles.discoverLayout}>
        <aside className={styles.card}>
          <h2>Filters</h2>
          <Field label="Investor type">
            <select>
              <option>Any type</option>
              <option>Angel</option>
              <option>Angel group</option>
              <option>Fund</option>
            </select>
          </Field>
          <Field label="Stage focus">
            <select>
              <option>Any stage</option>
              <option>Pre-seed</option>
              <option>Seed</option>
              <option>Series A</option>
            </select>
          </Field>
          <Field label="Sector focus">
            <input placeholder="Choose sector" />
          </Field>
          <Field label="Ticket size">
            <input placeholder="₹ minimum – maximum" />
          </Field>
          <Field label="Location">
            <input placeholder="Region or city" />
          </Field>
          <label className={styles.checkField}>
            <input type="checkbox" checked disabled readOnly /> Verified investors only{" "}
            <small>Always on; verification service absent.</small>
          </label>
          <label className={styles.checkField}>
            <input type="checkbox" /> Active recently
          </label>
          <label className={styles.checkField}>
            <input type="checkbox" /> Similar investments
          </label>
        </aside>
        <main id="investor-main" className={styles.results}>
          <label className={styles.search}>
            <Search size={14} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search verified investor directory"
            />
          </label>
          <div className={styles.resultTop}>
            <h2>Recommended investors</h2>
            <span>0 verified profiles</span>
          </div>
          <Empty
            title="No verified investors available."
            detail="Investor verification, opt-in visibility and directory services are not connected. Discovery remains browse-only."
            action="Prepare readiness"
            href="/startup/readiness"
          />
          {!canContact && (
            <Notice warning>
              Intro requests are locked. Verified readiness and public visibility are not confirmed.
            </Notice>
          )}
          <small className={styles.caption}>
            Search “{query || "any investor"}” · no backend search was called.
          </small>
        </main>
      </div>
      <Disclaimer />
    </>
  );
}
function Pipeline({
  data,
  setData,
  canManage,
  notify,
}: {
  data: InvestorData;
  setData: React.Dispatch<React.SetStateAction<InvestorData>>;
  canManage: boolean;
  notify: (s: string) => void;
}) {
  const [view, setView] = useState<"Board" | "Table" | "Funnel">("Board");
  const [query, setQuery] = useState("");
  const [show, setShow] = useState(false);
  const list = data.investors.filter(
    (i) =>
      !i.blocked && !i.hidden && `${i.name} ${i.firm}`.toLowerCase().includes(query.toLowerCase()),
  );
  const [form, setForm] = useState({
    name: "",
    firm: "",
    type: "Angel",
    ticket: "",
    sector: "",
    location: "",
    owner: "",
    stage: "Interested",
  });
  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.firm.trim()) return;
    const rec: InvestorRecord = {
      id: rid("manual"),
      name: form.name.trim(),
      firm: form.firm.trim(),
      type: form.type as InvestorRecord["type"],
      stage: form.stage as PipelineStage,
      ticket: form.ticket,
      sector: form.sector,
      location: form.location,
      owner: form.owner,
      lastActivity: new Date().toISOString(),
      nextStep: "",
      nextStepDate: "",
      expectedAmount: 0,
      probability: 0,
      notes: "",
      manual: true,
      blocked: false,
      hidden: false,
      createdAt: new Date().toISOString(),
    };
    setData((d) => ({ ...d, investors: [rec, ...d.investors] }));
    setShow(false);
    notify("Private manual entry saved locally. No contact was made.");
  };
  const exportCsv = () => {
    const rows = [
      ["Name", "Firm", "Stage", "Owner", "Ticket", "Expected", "Probability", "Notes"],
      ...list.map((i) => [
        i.name,
        i.firm,
        i.stage,
        i.owner,
        i.ticket,
        i.expectedAmount,
        i.probability,
        i.notes,
      ]),
    ];
    const csv = rows
      .map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const u = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = u;
    a.download = "private-investor-pipeline.csv";
    a.click();
    URL.revokeObjectURL(u);
  };
  return (
    <>
      <Header
        title="Investor pipeline"
        subtitle="Privately track investors and contacts met outside the platform."
      >
        <Button kind="primary" disabled={!canManage} onClick={() => setShow(true)}>
          <Plus size={14} /> Add investor
        </Button>
      </Header>
      <Notice>
        Manual entries remain private to this browser and are not verified profiles. Amounts and
        probability are founder-entered estimates.
      </Notice>
      <div className={styles.toolbar}>
        <label className={styles.search}>
          <Search size={14} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or firm"
          />
        </label>
        <nav className={styles.viewTabs}>
          {(["Board", "Table", "Funnel"] as const).map((v) => (
            <button
              key={v}
              className={view === v ? styles.activeTab : styles.tab}
              onClick={() => setView(v)}
            >
              {v}
            </button>
          ))}
        </nav>
        {view === "Table" && (
          <Button disabled={!canManage} onClick={exportCsv}>
            <Download size={13} /> Export CSV
          </Button>
        )}
      </div>
      <div id="investor-main">
        {view === "Board" ? (
          <div className={styles.board}>
            {stages.map((stage) => (
              <section className={styles.boardColumn} key={stage}>
                <header>
                  <strong>{stage}</strong>
                  <span>{list.filter((i) => i.stage === stage).length}</span>
                </header>
                {list
                  .filter((i) => i.stage === stage)
                  .map((i) => (
                    <article className={styles.pipelineCard} key={i.id}>
                      <Link href={`/startup/investors/${i.id}`}>
                        <strong>{i.name}</strong>
                      </Link>
                      <small>
                        {i.firm} · {i.type}
                      </small>
                      {i.manual && <em>Manual entry · private</em>}
                      <span className={styles.chip}>{i.stage}</span>
                      <small>
                        Ticket {i.ticket || "not entered"} · {i.owner || "No owner"}
                      </small>
                      <small>Activity {dtext(i.lastActivity.slice(0, 10))}</small>
                      <label className={styles.moveLabel}>
                        Move to…
                        <select
                          aria-label={`Move ${i.name} to another stage`}
                          disabled={!canManage}
                          value={i.stage}
                          onChange={(e) => {
                            const next = e.target.value as PipelineStage;
                            setData((d) => ({
                              ...d,
                              investors: d.investors.map((x) =>
                                x.id === i.id
                                  ? { ...x, stage: next, lastActivity: new Date().toISOString() }
                                  : x,
                              ),
                            }));
                            notify(`Moved to ${next} in the local record.`);
                          }}
                        >
                          {stages.map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </label>
                    </article>
                  ))}
              </section>
            ))}
          </div>
        ) : view === "Table" ? (
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  {[
                    "Investor",
                    "Status",
                    "Last activity",
                    "Owner",
                    "Ticket",
                    "Expected amount",
                    "Next step",
                    "Probability",
                  ].map((x) => (
                    <th key={x}>{x}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <Link href={`/startup/investors/${i.id}`}>
                        {i.name}
                        <small>
                          {i.firm}
                          {i.manual ? " · Manual entry" : ""}
                        </small>
                      </Link>
                    </td>
                    <td>{i.stage}</td>
                    <td>{dtext(i.lastActivity.slice(0, 10))}</td>
                    <td>{i.owner || "—"}</td>
                    <td>{i.ticket || "—"}</td>
                    <td>{money(i.expectedAmount)}</td>
                    <td>{i.nextStep || "—"}</td>
                    <td>{i.probability ? `${i.probability}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!list.length && (
              <Empty
                title="Pipeline is empty."
                detail="Add private manual entries for people you already know."
              />
            )}
          </div>
        ) : (
          <div className={styles.funnel}>
            {stages.slice(0, 6).map((s, i) => {
              const n = list.filter((x) => x.stage === s).length;
              return (
                <div
                  key={s}
                  style={{ "--funnel": `${Math.max(30, 100 - i * 12)}%` } as React.CSSProperties}
                >
                  <span>{s}</span>
                  <strong>{n}</strong>
                  <small>
                    {list.length
                      ? `${Math.round((n / list.length) * 100)}% of private records`
                      : "No records"}
                  </small>
                </div>
              );
            })}
            <p>Conversion rates are descriptive of local records only, not verified activity.</p>
          </div>
        )}
      </div>
      {view === "Board" && !list.length && (
        <Empty
          title="Your pipeline will fill as investors show interest."
          detail="No verified activity is connected. Add investors you have met as private manual entries."
          action={canManage ? "Add investor" : undefined}
          href={undefined}
        />
      )}
      <Disclaimer />
      {show && (
        <InvestorForm form={form} setForm={setForm} close={() => setShow(false)} submit={add} />
      )}
    </>
  );
}
function InvestorForm({
  form,
  setForm,
  close,
  submit,
}: {
  form: {
    name: string;
    firm: string;
    type: string;
    ticket: string;
    sector: string;
    location: string;
    owner: string;
    stage: string;
  };
  setForm: React.Dispatch<
    React.SetStateAction<{
      name: string;
      firm: string;
      type: string;
      ticket: string;
      sector: string;
      location: string;
      owner: string;
      stage: string;
    }>
  >;
  close: () => void;
  submit: (e: FormEvent) => void;
}) {
  return (
    <Modal title="Add private investor record" onClose={close}>
      <form className={styles.modalBody} onSubmit={submit}>
        <Notice>This does not create a verified profile or send an invitation.</Notice>
        <div className={styles.formGrid}>
          <Field label="Name">
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Firm">
            <input
              required
              value={form.firm}
              onChange={(e) => setForm({ ...form, firm: e.target.value })}
            />
          </Field>
          <Field label="Type">
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option>Angel</option>
              <option>Angel group</option>
              <option>Fund</option>
            </select>
          </Field>
          <Field label="Stage">
            <select
              value={form.stage}
              onChange={(e) => setForm({ ...form, stage: e.target.value })}
            >
              {stages.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          {(["ticket", "sector", "location", "owner"] as const).map((k) => (
            <Field label={k[0].toUpperCase() + k.slice(1)} key={k}>
              <input value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
            </Field>
          ))}
        </div>
        <footer>
          <Button onClick={close}>Cancel</Button>
          <Button kind="primary" type="submit">
            Save private entry
          </Button>
        </footer>
      </form>
    </Modal>
  );
}
function InvestorProfile({
  investor,
  data,
  setData,
  canManage,
  notify,
}: {
  investor: InvestorRecord;
  data: InvestorData;
  setData: React.Dispatch<React.SetStateAction<InvestorData>>;
  canManage: boolean;
  notify: (s: string) => void;
}) {
  const [note, setNote] = useState(investor.notes);
  const [body, setBody] = useState("");
  const update = (patch: Partial<InvestorRecord>) =>
    setData((d) => ({
      ...d,
      investors: d.investors.map((i) => (i.id === investor.id ? { ...i, ...patch } : i)),
    }));
  const thread = data.messages.filter((m) => m.investorId === investor.id);
  return (
    <>
      <Header
        title={investor.name}
        subtitle={`${investor.firm} · ${investor.type} · Private manual record`}
      >
        <Link className={styles.secondary} href="/startup/investors/pipeline">
          <ArrowLeft size={13} /> Pipeline
        </Link>
        <Button
          onClick={() => {
            update({ blocked: !investor.blocked });
            notify(
              investor.blocked ? "Unblocked locally." : "Blocked locally; no service was notified.",
            );
          }}
        >
          {investor.blocked ? "Unblock" : "Block"}
        </Button>
      </Header>
      <Notice warning>
        This contact was entered by your team. It is not verified. Contact details, KYC, messaging,
        meetings and data-room access are disconnected.
      </Notice>
      <div id="investor-main" className={styles.twoCol}>
        <main className={styles.stack}>
          <Card title="Investor information" subtitle="Founder-entered details · not verified">
            <div className={styles.infoGrid}>
              {[
                ["Firm", investor.firm],
                ["Type", investor.type],
                ["Ticket range", investor.ticket || "Not entered"],
                ["Sector", investor.sector || "Not entered"],
                ["Location", investor.location || "Not entered"],
                ["Owner", investor.owner || "Not assigned"],
              ].map(([k, v]) => (
                <div key={k}>
                  <small>{k}</small>
                  <strong>{v}</strong>
                </div>
              ))}
            </div>
            <div className={styles.fieldRow}>
              <Field label="Stage">
                <select
                  disabled={!canManage}
                  value={investor.stage}
                  onChange={(e) => update({ stage: e.target.value as PipelineStage })}
                >
                  {stages.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="Expected amount">
                <input
                  type="number"
                  min="0"
                  disabled={!canManage}
                  value={investor.expectedAmount || ""}
                  onChange={(e) => update({ expectedAmount: +e.target.value })}
                />
              </Field>
              <Field label="Probability (%)">
                <input
                  type="number"
                  min="0"
                  max="100"
                  disabled={!canManage}
                  value={investor.probability || ""}
                  onChange={(e) => update({ probability: +e.target.value })}
                />
              </Field>
            </div>
            <small className={styles.caption}>
              Estimates only; not an offer, commitment, valuation or verified signal.
            </small>
          </Card>
          <Card title="Activity on your startup">
            <p className={styles.emptyText}>
              No profile views, shortlist events, messages or data-room events are connected.
            </p>
          </Card>
          <Card title="Conversation" subtitle="Drafts saved locally; nothing is delivered.">
            {thread.map((m) => (
              <div className={styles.messageBubble} key={m.id}>
                <p>{m.body}</p>
                <small>
                  {dtext(m.date)} · {m.status}
                </small>
              </div>
            ))}
            <form
              className={styles.compose}
              onSubmit={(e) => {
                e.preventDefault();
                if (!body.trim()) return;
                setData((d) => ({
                  ...d,
                  messages: [
                    {
                      id: rid("msg"),
                      investorId: investor.id,
                      investorName: investor.name,
                      body: body.trim(),
                      date: new Date().toISOString(),
                      status: "Local draft",
                    },
                    ...d.messages,
                  ],
                }));
                setBody("");
                notify("Message draft saved locally; not delivered.");
              }}
            >
              <textarea
                maxLength={500}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Draft only. No message will be sent."
              />
              <Button kind="primary" type="submit" disabled={!canManage || !body.trim()}>
                Save draft
              </Button>
            </form>
          </Card>
        </main>
        <aside className={styles.stack}>
          <Card title="Status & next step">
            <Chip status={investor.stage}>{investor.stage}</Chip>
            <Field label="Next step">
              <input
                disabled={!canManage}
                value={investor.nextStep}
                onChange={(e) => update({ nextStep: e.target.value })}
                placeholder="Add a next step"
              />
            </Field>
            <Field label="Reminder date">
              <input
                disabled={!canManage}
                type="date"
                value={investor.nextStepDate}
                onChange={(e) => update({ nextStepDate: e.target.value })}
              />
            </Field>
            <div className={styles.buttonStack}>
              <Button disabled>Schedule meeting · disconnected</Button>
              <Button disabled>Grant data room access · disconnected</Button>
              <Button disabled={!canManage} onClick={() => update({ stage: "Passed" })}>
                Mark as passed
              </Button>
            </div>
          </Card>
          <Card title="Private notes" subtitle="Not visible to the investor.">
            <textarea
              className={styles.textarea}
              value={note}
              disabled={!canManage}
              onChange={(e) => setNote(e.target.value)}
            />
            <Button
              kind="primary"
              disabled={!canManage}
              onClick={() => {
                update({ notes: note });
                notify("Private notes saved locally.");
              }}
            >
              Save notes
            </Button>
          </Card>
          <Card title="Access summary">
            <p className={styles.emptyText}>
              No access grants exist. NDA and document-sharing services are not connected.
            </p>
            <Link className={styles.textLink} href="/startup/data-room">
              Manage data room
            </Link>
          </Card>
        </aside>
      </div>
      <Disclaimer />
    </>
  );
}
function DataRoom({
  data,
  setData,
  canManage,
  owner,
  notify,
}: {
  data: InvestorData;
  setData: React.Dispatch<React.SetStateAction<InvestorData>>;
  canManage: boolean;
  owner: boolean;
  notify: (s: string) => void;
}) {
  const [tab, setTab] = useState("Files");
  const [folder, setFolder] = useState("All folders");
  const [show, setShow] = useState(false);
  const [preview, setPreview] = useState(false);
  const [selected, setSelected] = useState<InvestorFile | null>(null);
  const [form, setForm] = useState({ title: "", folder: "Pitch", size: "", access: "Private" });
  const files = data.files.filter((f) => folder === "All folders" || f.folder === folder);
  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    const file: InvestorFile = {
      id: rid("file"),
      title: form.title.trim(),
      folder: form.folder,
      size: form.size || "Not recorded",
      updatedAt: new Date().toISOString(),
      uploadedBy: "Workspace user",
      access: form.access as InvestorFile["access"],
      views: 0,
    };
    setData((d) => ({ ...d, files: [file, ...d.files] }));
    setShow(false);
    notify("Metadata saved locally; no file was uploaded.");
  };
  const update = (patch: Partial<InvestorFile>) =>
    selected &&
    setData((d) => ({
      ...d,
      files: d.files.map((f) => (f.id === selected.id ? { ...f, ...patch } : f)),
    }));
  const completeness = Math.min(100, Math.round((data.files.length / 7) * 100));
  return (
    <>
      <Header
        title="Data room"
        subtitle="Organize document metadata and review access preferences. File storage and access control are disconnected."
      >
        <Button kind="primary" disabled={!canManage} onClick={() => setShow(true)}>
          <Plus size={14} /> Add document entry
        </Button>
        <Button onClick={() => setPreview(true)}>
          <Eye size={13} /> Preview as investor
        </Button>
        <Link className={styles.secondary} href="/startup/data-room/requests">
          Access requests <ArrowRight size={12} />
        </Link>
      </Header>
      <Notice warning>
        No file upload, NDA enforcement, watermarking, virus scan or audit service is connected. Do
        not add confidential material to this demo.
      </Notice>
      <div className={styles.dataRoomTop}>
        <span>
          <strong>Completeness guide</strong>
          <small>{data.files.length} local entries · not uploaded documents</small>
        </span>
        <Progress value={completeness} />
      </div>
      <nav className={styles.viewTabs}>
        {["Files", "Access", "Audit trail", "Settings"].map((t) => (
          <button
            key={t}
            className={tab === t ? styles.activeTab : styles.tab}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </nav>
      <div id="investor-main">
        {tab === "Files" ? (
          <div className={styles.roomLayout}>
            <aside className={styles.card}>
              <h2>Folders</h2>
              {folders.map((f) => (
                <button
                  key={f}
                  className={folder === f ? styles.folderActive : styles.folder}
                  onClick={() => setFolder(folder === f ? "All folders" : f)}
                >
                  {f}
                  <span>{data.files.filter((x) => x.folder === f).length}</span>
                </button>
              ))}
            </aside>
            <section className={styles.card}>
              <Field label="Filter folder">
                <select value={folder} onChange={(e) => setFolder(e.target.value)}>
                  <option>All folders</option>
                  {folders.map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </Field>
              <div className={styles.tableWrap}>
                <table>
                  <thead>
                    <tr>
                      {["Name", "Folder", "Size", "Updated", "Uploaded by", "Access", "Views"].map(
                        (x) => (
                          <th key={x}>{x}</th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {files.map((f) => (
                      <tr key={f.id}>
                        <td>
                          <button className={styles.tableLink} onClick={() => setSelected(f)}>
                            {f.title}
                          </button>
                        </td>
                        <td>{f.folder}</td>
                        <td>{f.size}</td>
                        <td>{dtext(f.updatedAt)}</td>
                        <td>{f.uploadedBy}</td>
                        <td>{f.access}</td>
                        <td>{f.views}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!files.length && (
                <Empty
                  title="No documents entered."
                  detail="Start with your pitch deck and cap table. Add metadata only; this demo stores no file contents."
                />
              )}
              <div className={styles.placeholderGrid}>
                {["Pitch deck", "Cap table", "Financial model", "Incorporation documents"]
                  .filter(
                    (x) =>
                      !data.files.some((f) =>
                        f.title.toLowerCase().includes(x.split(" ")[0].toLowerCase()),
                      ),
                  )
                  .map((x) => (
                    <div key={x}>
                      <FileText size={14} />
                      <span>{x}: missing</span>
                      <button
                        disabled={!canManage}
                        onClick={() => {
                          setForm((f) => ({ ...f, title: x }));
                          setShow(true);
                        }}
                      >
                        Add entry
                      </button>
                    </div>
                  ))}
              </div>
            </section>
            <aside className={styles.card}>
              <h2>Access defaults</h2>
              <div className={styles.miniSetting}>
                <span>NDA</span>
                <strong>{data.settings.ndaRequired ? "Required" : "Not required"}</strong>
              </div>
              <div className={styles.miniSetting}>
                <span>Downloads</span>
                <strong>{data.settings.downloadPolicy}</strong>
              </div>
              <div className={styles.miniSetting}>
                <span>Watermark</span>
                <strong>{data.settings.watermark ? "Preferred" : "Off"}</strong>
              </div>
              <Link className={styles.textLink} href="/startup/investors/settings">
                Edit defaults
              </Link>
            </aside>
          </div>
        ) : tab === "Access" ? (
          <Card title="Investors with access" subtitle="No live access grants exist.">
            <Empty
              title="No investors have access."
              detail="Approval cannot expose files until NDA signing and secure-sharing services are connected."
              action="Review access requests"
              href="/startup/data-room/requests"
            />
          </Card>
        ) : tab === "Audit trail" ? (
          <Card title="Audit trail" subtitle="No document activity is recorded.">
            <Empty
              title="No audit events."
              detail="This local prototype is not a compliance audit log. No document views or downloads are tracked."
            />
          </Card>
        ) : (
          <Card
            title="Data room defaults"
            subtitle="Local preferences, not enforced security controls."
          >
            <label className={styles.checkField}>
              <input
                type="checkbox"
                checked={data.settings.ndaRequired}
                disabled={!owner}
                onChange={(e) =>
                  setData((d) => ({
                    ...d,
                    settings: { ...d.settings, ndaRequired: e.target.checked },
                  }))
                }
              />{" "}
              Require NDA <small>Cannot be enforced here.</small>
            </label>
            <label className={styles.checkField}>
              <input
                type="checkbox"
                checked={data.settings.watermark}
                disabled={!owner}
                onChange={(e) =>
                  setData((d) => ({
                    ...d,
                    settings: { ...d.settings, watermark: e.target.checked },
                  }))
                }
              />{" "}
              Recommend watermark <small>No watermark service.</small>
            </label>
            <Field label="Download policy">
              <select
                disabled={!owner}
                value={data.settings.downloadPolicy}
                onChange={(e) =>
                  setData((d) => ({
                    ...d,
                    settings: {
                      ...d.settings,
                      downloadPolicy: e.target.value as InvestorSettings["downloadPolicy"],
                    },
                  }))
                }
              >
                <option>View only</option>
                <option>Allow selected downloads</option>
              </select>
            </Field>
            <Field label="Default expiry">
              <input
                type="date"
                disabled={!owner}
                value={data.settings.accessExpiry}
                onChange={(e) =>
                  setData((d) => ({
                    ...d,
                    settings: { ...d.settings, accessExpiry: e.target.value },
                  }))
                }
              />
            </Field>
          </Card>
        )}
      </div>
      {selected && (
        <Modal title={selected.title} onClose={() => setSelected(null)}>
          <div className={styles.modalBody}>
            <Notice warning>
              This is metadata only. There is no file to preview, download, watermark or replace.
            </Notice>
            <Field label="Access label">
              <select
                value={selected.access}
                disabled={!canManage}
                onChange={(e) => update({ access: e.target.value as InvestorFile["access"] })}
              >
                <option>Private</option>
                <option>Public to approved investors</option>
                <option>Per investor</option>
              </select>
            </Field>
            <Button
              kind="danger"
              disabled={!canManage}
              onClick={() => {
                setData((d) => ({ ...d, files: d.files.filter((f) => f.id !== selected.id) }));
                setSelected(null);
              }}
            >
              Delete local entry
            </Button>
          </div>
        </Modal>
      )}
      {show && (
        <Modal title="Add document metadata" onClose={() => setShow(false)}>
          <form className={styles.modalBody} onSubmit={add}>
            <Notice>No file bytes are stored or uploaded.</Notice>
            <Field label="Title">
              <input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </Field>
            <Field label="Folder">
              <select
                value={form.folder}
                onChange={(e) => setForm({ ...form, folder: e.target.value })}
              >
                {folders.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </Field>
            <Field label="Size (optional)">
              <input
                value={form.size}
                onChange={(e) => setForm({ ...form, size: e.target.value })}
              />
            </Field>
            <Field label="Access">
              <select
                value={form.access}
                onChange={(e) => setForm({ ...form, access: e.target.value })}
              >
                <option>Private</option>
                <option>Public to approved investors</option>
                <option>Per investor</option>
              </select>
            </Field>
            <footer>
              <Button onClick={() => setShow(false)}>Cancel</Button>
              <Button kind="primary" type="submit">
                Save entry
              </Button>
            </footer>
          </form>
        </Modal>
      )}
      {preview && (
        <Modal title="Preview as investor" onClose={() => setPreview(false)}>
          <div className={styles.modalBody}>
            <Notice warning>Preview only. No investor session or access policy is enforced.</Notice>
            {data.files.filter((f) => f.access !== "Private").length ? (
              data.files
                .filter((f) => f.access !== "Private")
                .map((f) => <p key={f.id}>{f.title} · metadata only</p>)
            ) : (
              <Empty
                title="Nothing is visible to investors."
                detail="All entries are private or no entries exist."
              />
            )}
          </div>
        </Modal>
      )}
      <Disclaimer />
    </>
  );
}
function AccessRequests({
  data,
  setData,
  canManage,
  notify,
}: {
  data: InvestorData;
  setData: React.Dispatch<React.SetStateAction<InvestorData>>;
  canManage: boolean;
  notify: (s: string) => void;
}) {
  const [tab, setTab] = useState<"Pending" | "Approved" | "Declined">("Pending");
  const [selected, setSelected] = useState<InvestorAccessRequest | null>(null);
  const list = data.accessRequests.filter((r) => r.status === tab);
  const decide = (r: InvestorAccessRequest, status: InvestorAccessRequest["status"]) => {
    setData((d) => ({
      ...d,
      accessRequests: d.accessRequests.map((x) => (x.id === r.id ? { ...x, status } : x)),
    }));
    setSelected(null);
    notify(`Marked ${status} locally. No data access was granted or denied.`);
  };
  return (
    <>
      <Header
        title="Data room access requests"
        subtitle="Review access requests; local decisions cannot grant document access."
      >
        <Link className={styles.secondary} href="/startup/data-room">
          <ArrowLeft size={13} /> Data room
        </Link>
      </Header>
      <Notice warning>
        Investor requests are not synced. Approving a local record does not sign an NDA or expose
        documents.
      </Notice>
      <nav className={styles.viewTabs}>
        {(["Pending", "Approved", "Declined"] as const).map((t) => (
          <button
            className={tab === t ? styles.activeTab : styles.tab}
            onClick={() => setTab(t)}
            key={t}
          >
            {t} · {data.accessRequests.filter((r) => r.status === t).length}
          </button>
        ))}
      </nav>
      <section id="investor-main" className={styles.card}>
        {list.length ? (
          list.map((r) => (
            <article className={styles.accessRow} key={r.id}>
              <div>
                <strong>
                  {r.investorName} · {r.firm}
                </strong>
                <small>
                  {r.scope.join(", ")} · NDA {r.nda} · {dtext(r.date)}
                </small>
                <p>{r.message}</p>
              </div>
              <span className={styles.chip}>{r.status}</span>
              <Button onClick={() => setSelected(r)}>Review</Button>
            </article>
          ))
        ) : (
          <Empty
            title={`No ${tab.toLowerCase()} requests.`}
            detail="Incoming investor requests are not connected."
          />
        )}
      </section>
      {selected && (
        <Modal title={`Review ${selected.investorName}`} onClose={() => setSelected(null)}>
          <div className={styles.modalBody}>
            <p>{selected.message}</p>
            <p>
              <b>Scope:</b> {selected.scope.join(", ")}
            </p>
            <p>
              <b>NDA:</b> {selected.nda}
            </p>
            <Notice warning>
              A local approval does not grant real access. Secure sharing is disconnected.
            </Notice>
            <footer>
              <Button disabled={!canManage} onClick={() => decide(selected, "Declined")}>
                Decline locally
              </Button>
              <Button
                kind="primary"
                disabled={!canManage || selected.nda !== "Signed"}
                onClick={() => decide(selected, "Approved")}
              >
                Mark approved locally
              </Button>
            </footer>
          </div>
        </Modal>
      )}
      <Disclaimer />
    </>
  );
}
function Messages({
  data,
  setData,
  canManage,
  notify,
}: {
  data: InvestorData;
  setData: React.Dispatch<React.SetStateAction<InvestorData>>;
  canManage: boolean;
  notify: (s: string) => void;
}) {
  const investors = data.investors.filter((i) => !i.blocked && !i.hidden);
  const [selected, setSelected] = useState(investors[0]?.id || "");
  const [body, setBody] = useState("");
  const current = investors.find((i) => i.id === selected);
  const thread = data.messages.filter((m) => m.investorId === selected);
  return (
    <>
      <Header
        title="Investor messages"
        subtitle="Drafts are saved locally. Secure chat and delivery services are not connected."
      >
        <Notice warning>
          Do not include confidential information. No message will be sent from this page.
        </Notice>
      </Header>
      <div id="investor-main" className={styles.inbox}>
        <aside className={styles.inboxList}>
          <label className={styles.search}>
            <Search size={13} />
            <input placeholder="Search conversations" />
          </label>
          {investors.length ? (
            investors.map((i) => (
              <button
                className={selected === i.id ? styles.conversationSelected : styles.conversation}
                key={i.id}
                onClick={() => setSelected(i.id)}
              >
                <span className={styles.avatar}>{i.firm.slice(0, 2).toUpperCase()}</span>
                <span>
                  <strong>{i.name}</strong>
                  <small>{i.firm} · private</small>
                  <small>
                    {data.messages.find((m) => m.investorId === i.id)?.body || "No local drafts"}
                  </small>
                </span>
              </button>
            ))
          ) : (
            <Empty
              title="No investor conversations."
              detail="Add private pipeline records to draft messages."
              action="Open pipeline"
              href="/startup/investors/pipeline"
            />
          )}
        </aside>
        <main className={styles.thread}>
          {current ? (
            <>
              <header>
                <div>
                  <strong>{current.name}</strong>
                  <small>{current.firm} · manual record, not verified</small>
                </div>
                <span className={styles.chip}>{current.stage}</span>
              </header>
              <Notice warning>Messages are not sent, encrypted or logged by a service.</Notice>
              <div className={styles.threadBody}>
                {thread
                  .slice()
                  .reverse()
                  .map((m) => (
                    <article className={styles.messageBubble} key={m.id}>
                      <p>{m.body}</p>
                      <small>
                        {dtext(m.date)} · {m.status}
                      </small>
                    </article>
                  ))}
              </div>
              <form
                className={styles.compose}
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!body.trim()) return;
                  setData((d) => ({
                    ...d,
                    messages: [
                      {
                        id: rid("msg"),
                        investorId: current.id,
                        investorName: current.name,
                        body: body.trim(),
                        date: new Date().toISOString(),
                        status: "Local draft",
                      },
                      ...d.messages,
                    ],
                  }));
                  setBody("");
                  notify("Draft saved locally; not delivered.");
                }}
              >
                <textarea
                  maxLength={500}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Draft only; no message will be sent."
                />
                <div>
                  <small>{body.length}/500</small>
                  <Button kind="primary" type="submit" disabled={!canManage || !body.trim()}>
                    Save draft
                  </Button>
                </div>
              </form>
            </>
          ) : (
            <Empty
              title="Choose a private contact."
              detail="Connected investor conversations are unavailable."
            />
          )}
        </main>
        <aside className={styles.inboxAside}>
          <Card title="Investor profile">
            <p>
              {current
                ? `${current.firm} · ${current.type} · ${current.stage}`
                : "Select a conversation"}
            </p>
            <p className={styles.caption}>Pipeline records aren't verified profiles.</p>
            {current && (
              <Link className={styles.textLink} href={`/startup/investors/${current.id}`}>
                Open record <ArrowRight size={12} />
              </Link>
            )}
          </Card>
          <Card title="Quick actions">
            <Button disabled>Schedule meeting</Button>
            <Button disabled>Share file</Button>
            <Button disabled>Grant access</Button>
            <Button disabled>Mark passed</Button>
          </Card>
        </aside>
      </div>
      <small className={styles.caption}>
        No attachment upload, moderation, delivery receipts or messaging integration.
      </small>
    </>
  );
}
function Meetings({
  data,
  setData,
  canManage,
  notify,
}: {
  data: InvestorData;
  setData: React.Dispatch<React.SetStateAction<InvestorData>>;
  canManage: boolean;
  notify: (s: string) => void;
}) {
  const [tab, setTab] = useState("Upcoming");
  const [show, setShow] = useState(false);
  const contacts = data.investors.filter((i) => !i.blocked && !i.hidden);
  const [form, setForm] = useState({
    investorId: "",
    type: "Intro call",
    date: "",
    duration: "30",
    attendees: "",
    agenda: "",
  });
  const [error, setError] = useState("");
  const future = data.meetings.filter(
    (m) => new Date(m.date) >= new Date() && !["Cancelled", "Completed"].includes(m.status),
  );
  const past = data.meetings.filter((m) => !future.includes(m));
  const create = (e: FormEvent) => {
    e.preventDefault();
    const inv = contacts.find((i) => i.id === form.investorId);
    const date = new Date(form.date);
    if (!inv || !form.date) {
      setError("Select a pipeline contact and date.");
      return;
    }
    if (date.getTime() < Date.now() + 12 * 3600000) {
      setError("Choose a time at least 12 hours ahead.");
      return;
    }
    const rec: InvestorMeeting = {
      id: rid("meeting"),
      investorId: inv.id,
      investorName: inv.name,
      type: form.type,
      date: date.toISOString(),
      duration: +form.duration,
      attendees: form.attendees
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
      agenda: form.agenda,
      status: "Scheduled",
      notes: "",
      outcome: "",
    };
    setData((d) => ({ ...d, meetings: [rec, ...d.meetings] }));
    setShow(false);
    notify("Meeting saved locally; no invite or video room created.");
  };
  const list = tab === "Upcoming" ? future : tab === "Past" ? past : data.meetings;
  return (
    <>
      <Header
        title="Investor meetings"
        subtitle="Track meeting details. Calendar, video, invites and reminders are disconnected."
      >
        <Button
          kind="primary"
          disabled={!canManage || !contacts.length}
          onClick={() => setShow(true)}
        >
          <Plus size={14} /> Schedule meeting
        </Button>
      </Header>
      <Notice warning>
        A saved meeting is a local record only. No investor is invited and no calendar time is
        reserved.
      </Notice>
      <nav className={styles.viewTabs}>
        {["Upcoming", "Requests", "Past", "Calendar"].map((t) => (
          <button
            key={t}
            className={tab === t ? styles.activeTab : styles.tab}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </nav>
      <section id="investor-main" className={styles.card}>
        {tab === "Requests" ? (
          <Empty
            title="No incoming meeting requests."
            detail="Investor scheduling requests are not connected."
          />
        ) : tab === "Calendar" ? (
          data.meetings.length ? (
            data.meetings
              .slice()
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((m) => <MeetingRow key={m.id} meeting={m} notify={notify} />)
          ) : (
            <Empty
              title="No meetings on the calendar."
              detail="Calendar synchronization is not connected."
            />
          )
        ) : list.length ? (
          list.map((m) => <MeetingRow key={m.id} meeting={m} notify={notify} />)
        ) : (
          <Empty
            title={`No ${tab.toLowerCase()} meetings.`}
            detail="Create a local meeting record for a private pipeline contact."
          />
        )}
      </section>
      {show && (
        <Modal title="Schedule a meeting" onClose={() => setShow(false)}>
          <form className={styles.modalBody} onSubmit={create}>
            <Notice warning>
              Local record only; no invitation, availability check or video link.
            </Notice>
            <Field label="Investor">
              <select
                value={form.investorId}
                onChange={(e) => setForm({ ...form, investorId: e.target.value })}
              >
                <option value="">Select private contact</option>
                {contacts.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} · {i.firm}
                  </option>
                ))}
              </select>
            </Field>
            <div className={styles.formGrid}>
              <Field label="Meeting type">
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  {["Intro call", "Pitch", "Diligence", "Follow-up"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </Field>
              <Field label="Time">
                <input
                  type="datetime-local"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </Field>
              <Field label="Duration">
                <select
                  value={form.duration}
                  onChange={(e) => setForm({ ...form, duration: e.target.value })}
                >
                  {["15", "30", "45", "60"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </Field>
              <Field label="Attendees">
                <input
                  value={form.attendees}
                  onChange={(e) => setForm({ ...form, attendees: e.target.value })}
                />
              </Field>
              <Field label="Agenda">
                <textarea
                  value={form.agenda}
                  onChange={(e) => setForm({ ...form, agenda: e.target.value })}
                />
              </Field>
            </div>
            {error && <p className={styles.errorText}>{error}</p>}
            <footer>
              <Button onClick={() => setShow(false)}>Cancel</Button>
              <Button kind="primary" type="submit" disabled={!canManage}>
                Save local record
              </Button>
            </footer>
          </form>
        </Modal>
      )}
      <Disclaimer />
    </>
  );
}
function MeetingRow({
  meeting,
  notify,
}: {
  meeting: InvestorMeeting;
  notify: (s: string) => void;
}) {
  return (
    <article className={styles.meetingRow}>
      <CalendarDays size={16} />
      <div>
        <strong>
          {meeting.investorName} · {meeting.type}
        </strong>
        <small>
          {dtext(meeting.date)} ·{" "}
          {new Date(meeting.date).toLocaleTimeString("en-IN", {
            hour: "numeric",
            minute: "2-digit",
          })}{" "}
          · Asia/Kolkata · {meeting.duration} min
        </small>
        <small>
          {meeting.attendees.join(", ") || "No attendees"} · {meeting.agenda || "No agenda"}
        </small>
      </div>
      <span className={styles.chip}>{meeting.status}</span>
      <Button onClick={() => notify("Managed video is disconnected; there is no join link.")}>
        Join
      </Button>
    </article>
  );
}
function Rounds({
  data,
  setData,
  owner,
  notify,
}: {
  data: InvestorData;
  setData: React.Dispatch<React.SetStateAction<InvestorData>>;
  owner: boolean;
  notify: (s: string) => void;
}) {
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({
    name: "",
    type: "Pre-seed",
    target: "",
    minimum: "",
    maximum: "",
    instrument: "SAFE",
    valuation: "",
    discount: "",
    minimumTicket: "",
    closingDate: "",
    visibility: "Private",
    leadInvestor: "",
    useOfFunds: "",
  });
  const create = (e: FormEvent) => {
    e.preventDefault();
    const target = +form.target,
      min = +form.minimum;
    if (!form.name.trim() || target <= 0 || min > target) {
      notify("Enter a name, positive target and minimum no greater than target.");
      return;
    }
    if (["Equity", "SAFE"].includes(form.instrument) && !form.valuation.trim()) {
      notify("Valuation or cap is required for Equity and SAFE.");
      return;
    }
    const r: FundraisingRound = {
      id: rid("round"),
      name: form.name.trim(),
      type: form.type,
      target,
      minimum: min,
      maximum: +form.maximum || 0,
      instrument: form.instrument,
      valuation: form.valuation,
      discount: form.discount,
      minimumTicket: +form.minimumTicket || 0,
      openedAt: new Date().toISOString().slice(0, 10),
      closingDate: form.closingDate,
      visibility: form.visibility as FundraisingRound["visibility"],
      leadInvestor: form.leadInvestor,
      useOfFunds: form.useOfFunds,
      status: "Planning",
      offers: [],
      createdAt: new Date().toISOString(),
    };
    setData((d) => ({ ...d, rounds: [r, ...d.rounds] }));
    setShow(false);
    notify("Private planning record saved locally; no terms were published.");
  };
  return (
    <>
      <Header
        title="Fundraising rounds"
        subtitle="Plan a round and track manual records. No legal, cap-table or payment integration is connected."
      >
        <Button kind="primary" disabled={!owner} onClick={() => setShow(true)}>
          <Plus size={14} /> New round
        </Button>
      </Header>
      <Disclaimer />
      <Notice warning>
        Round records are not legal offers or executed securities documents. The platform is not a
        broker or adviser. Review all terms with counsel.
      </Notice>
      <section className={styles.stats}>
        {[
          ["Rounds", data.rounds.length],
          ["Active", data.rounds.filter((r) => ["Open", "Closing"].includes(r.status)).length],
          [
            "Target · local",
            money(
              data.rounds
                .filter((r) => ["Open", "Closing"].includes(r.status))
                .reduce((n, r) => n + r.target, 0),
            ),
          ],
          [
            "Committed · manual",
            money(
              data.rounds.reduce(
                (n, r) =>
                  n +
                  r.offers
                    .filter((o) => ["Committed", "Funds received"].includes(o.status))
                    .reduce((v, o) => v + o.amount, 0),
                0,
              ),
            ),
          ],
        ].map((x) => (
          <div key={String(x[0])}>
            <span>{x[0]}</span>
            <strong>{x[1]}</strong>
          </div>
        ))}
      </section>
      <section id="investor-main" className={styles.card}>
        {data.rounds.length ? (
          data.rounds.map((r) => (
            <Link className={styles.roundRow} key={r.id} href={`/startup/rounds/${r.id}`}>
              <span>
                <strong>{r.name}</strong>
                <small>
                  {r.type} · {r.instrument} · private planning record
                </small>
              </span>
              <span className={styles.chip}>{r.status}</span>
              <span>
                {money(r.target)} target
                <small>
                  {money(
                    r.offers
                      .filter((o) => ["Committed", "Funds received"].includes(o.status))
                      .reduce((n, o) => n + o.amount, 0),
                  )}{" "}
                  local records
                </small>
              </span>
              <ArrowRight size={14} />
            </Link>
          ))
        ) : (
          <div className={styles.empty}>
            <span>
              <TrendingUp size={18} />
            </span>
            <strong>Not currently raising.</strong>
            <p>Start a private planning record. Nothing will be published to investors.</p>
            <Button kind="primary" disabled={!owner} onClick={() => setShow(true)}>
              Start a round
            </Button>
          </div>
        )}
      </section>
      {show && (
        <RoundForm form={form} setForm={setForm} close={() => setShow(false)} submit={create} />
      )}
    </>
  );
}
function RoundForm({
  form,
  setForm,
  close,
  submit,
}: {
  form: {
    name: string;
    type: string;
    target: string;
    minimum: string;
    maximum: string;
    instrument: string;
    valuation: string;
    discount: string;
    minimumTicket: string;
    closingDate: string;
    visibility: string;
    leadInvestor: string;
    useOfFunds: string;
  };
  setForm: React.Dispatch<
    React.SetStateAction<{
      name: string;
      type: string;
      target: string;
      minimum: string;
      maximum: string;
      instrument: string;
      valuation: string;
      discount: string;
      minimumTicket: string;
      closingDate: string;
      visibility: string;
      leadInvestor: string;
      useOfFunds: string;
    }>
  >;
  close: () => void;
  submit: (e: FormEvent) => void;
}) {
  return (
    <Modal title="Create round planning record" onClose={close}>
      <form className={styles.modalBody} onSubmit={submit}>
        <Notice warning>
          Draft metadata only. Terms aren't legally agreed, published or sent to investors.
        </Notice>
        <div className={styles.formGrid}>
          <Field label="Round name">
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Type">
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {["Pre-seed", "Seed", "Series A", "Bridge", "Other"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
          <Field label="Target raise (₹)">
            <input
              type="number"
              min="1"
              required
              value={form.target}
              onChange={(e) => setForm({ ...form, target: e.target.value })}
            />
          </Field>
          <Field label="Minimum raise (₹)">
            <input
              type="number"
              min="0"
              value={form.minimum}
              onChange={(e) => setForm({ ...form, minimum: e.target.value })}
            />
          </Field>
          <Field label="Maximum raise (₹)">
            <input
              type="number"
              min="0"
              value={form.maximum}
              onChange={(e) => setForm({ ...form, maximum: e.target.value })}
            />
          </Field>
          <Field label="Instrument">
            <select
              value={form.instrument}
              onChange={(e) => setForm({ ...form, instrument: e.target.value })}
            >
              {["Equity", "SAFE", "Convertible note", "Other"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
          <Field label="Valuation / cap">
            <input
              required={["Equity", "SAFE"].includes(form.instrument)}
              value={form.valuation}
              onChange={(e) => setForm({ ...form, valuation: e.target.value })}
            />
          </Field>
          <Field label="Discount">
            <input
              value={form.discount}
              onChange={(e) => setForm({ ...form, discount: e.target.value })}
            />
          </Field>
          <Field label="Minimum ticket (₹)">
            <input
              type="number"
              min="0"
              value={form.minimumTicket}
              onChange={(e) => setForm({ ...form, minimumTicket: e.target.value })}
            />
          </Field>
          <Field label="Expected close">
            <input
              type="date"
              value={form.closingDate}
              onChange={(e) => setForm({ ...form, closingDate: e.target.value })}
            />
          </Field>
          <Field label="Visibility">
            <select
              value={form.visibility}
              onChange={(e) => setForm({ ...form, visibility: e.target.value })}
            >
              <option>Private</option>
              <option>Visible on profile</option>
            </select>
          </Field>
          <Field label="Lead investor">
            <input
              value={form.leadInvestor}
              onChange={(e) => setForm({ ...form, leadInvestor: e.target.value })}
            />
          </Field>
          <Field label="Use of funds">
            <textarea
              value={form.useOfFunds}
              onChange={(e) => setForm({ ...form, useOfFunds: e.target.value })}
            />
          </Field>
        </div>
        <p className={styles.legal}>
          Terms and instruments have legal consequences. Review them with a lawyer. This platform
          does not provide legal or financial advice.
        </p>
        <footer>
          <Button onClick={close}>Cancel</Button>
          <Button kind="primary" type="submit">
            Save private plan
          </Button>
        </footer>
      </form>
    </Modal>
  );
}

function RoundDetail({
  round,
  data,
  setData,
  owner,
  notify,
}: {
  round: FundraisingRound;
  data: ReturnType<typeof useStartupInvestors>["data"];
  setData: ReturnType<typeof useStartupInvestors>["setData"];
  owner: boolean;
  notify: (t: string) => void;
}) {
  const [tab, setTab] = useState("Overview");
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({
    investorId: "",
    amount: "",
    instrument: round.instrument,
    status: "Offer received",
    notes: "",
  });
  const [confirm, setConfirm] = useState(false);
  const update = (p: Partial<FundraisingRound>) =>
    setData((d) => ({
      ...d,
      rounds: d.rounds.map((r) => (r.id === round.id ? { ...r, ...p } : r)),
    }));
  const committed = round.offers
    .filter((o) => ["Committed", "Funds received"].includes(o.status))
    .reduce((n, o) => n + o.amount, 0);
  const offers = (e: FormEvent) => {
    e.preventDefault();
    const inv = data.investors.find((i) => i.id === form.investorId);
    if (!inv || +form.amount <= 0) return;
    const offer: RoundOffer = {
      id: rid("offer"),
      investorId: inv.id,
      investorName: inv.name,
      amount: +form.amount,
      instrument: form.instrument,
      status: form.status as RoundOffer["status"],
      date: new Date().toISOString(),
      notes: form.notes,
      manual: true,
    };
    update({ offers: [offer, ...round.offers] });
    setShow(false);
    notify("Offer record saved locally; no offer was received, accepted or transmitted.");
  };
  const postStatus = (o: RoundOffer, status: RoundOffer["status"]) => {
    update({ offers: round.offers.map((x) => (x.id === o.id ? { ...x, status } : x)) });
    notify(`Local offer record marked ${status}. No legal acceptance or funds transfer occurred.`);
  };
  const tabList = [
    "Overview",
    "Offers and commitments",
    "Term sheets",
    "Cap table impact",
    "Documents",
    "Activity",
  ];
  return (
    <>
      <Header
        title={round.name}
        subtitle={`${round.type} · ${round.status} · local planning record`}
      >
        <Link className={styles.secondary} href="/startup/rounds">
          <ArrowLeft size={13} /> Rounds
        </Link>
        <Button disabled={!owner || round.status === "Closed"} onClick={() => setShow(true)}>
          <Plus size={13} /> Record manual offer
        </Button>
        <Button
          kind="primary"
          disabled={!owner || round.status === "Closed"}
          onClick={() => setConfirm(true)}
        >
          Close round
        </Button>
      </Header>
      <Notice warning>
        Nothing here is a legal offer, signed term sheet, funding commitment, funds received or
        updated cap table. Verify all terms and consult counsel.
      </Notice>
      <div className={styles.roundSummary}>
        <div>
          <span>Target</span>
          <strong>{money(round.target)}</strong>
        </div>
        <div>
          <span>Local manual commitments</span>
          <strong>{money(committed)}</strong>
        </div>
        <div>
          <span>Remaining</span>
          <strong>{money(Math.max(0, round.target - committed))}</strong>
        </div>
        <div>
          <span>Recorded investors</span>
          <strong>{round.offers.length}</strong>
        </div>
        <Progress value={round.target ? Math.min(100, (committed / round.target) * 100) : 0} />
        <small>Progress includes only local manual status entries; not evidence of funds.</small>
      </div>
      <nav className={styles.viewTabs}>
        {tabList.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={tab === t ? styles.activeTab : styles.tab}
          >
            {t}
          </button>
        ))}
      </nav>
      <div id="investor-main">
        {tab === "Overview" ? (
          <div className={styles.twoCol}>
            <main className={styles.stack}>
              <Card title="Round overview">
                <div className={styles.infoGrid}>
                  {[
                    ["Status", round.status],
                    ["Instrument", round.instrument],
                    ["Valuation / cap", round.valuation || "Not set"],
                    ["Discount", round.discount || "Not set"],
                    ["Minimum", money(round.minimum)],
                    ["Maximum", round.maximum ? money(round.maximum) : "Not set"],
                    ["Closing date", dtext(round.closingDate)],
                    ["Visibility", round.visibility],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <small>{k}</small>
                      <strong>{v}</strong>
                    </div>
                  ))}
                </div>
                <p>{round.useOfFunds || "Use of funds not entered."}</p>
              </Card>
              <Card title="Timeline">
                <div className={styles.timeline}>
                  <span>Planning record created · {dtext(round.createdAt)}</span>
                  <span>Opening date entered · {dtext(round.openedAt)}</span>
                  <span>Offers and commitments are manual entries only</span>
                </div>
              </Card>
            </main>
            <aside className={styles.stack}>
              <Card title="Round terms">
                <p>
                  {round.name} · {round.type}
                </p>
                <p>
                  {round.instrument} · {round.valuation || "No valuation/cap"}
                </p>
                <p>
                  Target {money(round.target)} · minimum {money(round.minimum)}
                </p>
                <p className={styles.caption}>No signed term sheet is stored.</p>
              </Card>
              <Card title="Closing checklist">
                <ul className={styles.checkList}>
                  <li>
                    Minimum raise met:{" "}
                    {committed >= round.minimum && round.minimum > 0
                      ? "Local entries reach minimum"
                      : "Not verified"}
                  </li>
                  <li>Term sheet signed: not connected</li>
                  <li>Legal documents: not connected</li>
                  <li>Funds received: not verified</li>
                  <li>Cap table updated: not connected</li>
                </ul>
              </Card>
            </aside>
          </div>
        ) : tab === "Offers and commitments" ? (
          <Card
            title="Offers and commitments"
            subtitle="All entries below are founder-entered records."
          >
            <Button disabled={!owner} onClick={() => setShow(true)}>
              <Plus size={13} /> Record offer
            </Button>
            {round.offers.length ? (
              round.offers.map((o) => (
                <article className={styles.offerRow} key={o.id}>
                  <div>
                    <strong>{o.investorName}</strong>
                    <small>
                      {money(o.amount)} · {o.instrument} · {dtext(o.date)}
                    </small>
                    <Chip status={o.status}>{o.status}</Chip>
                    <small>{o.notes || "No notes"} · Manual entry</small>
                  </div>
                  <Field label="Local status">
                    <select
                      disabled={!owner}
                      value={o.status}
                      onChange={(e) => postStatus(o, e.target.value as RoundOffer["status"])}
                    >
                      {[
                        "Offer received",
                        "Under review",
                        "Accepted",
                        "Declined",
                        "Committed",
                        "Funds received",
                      ].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </Field>
                </article>
              ))
            ) : (
              <Empty
                title="No offer records."
                detail="Investor offer integrations are disconnected. You may record an external conversation as a private manual entry."
              />
            )}
          </Card>
        ) : tab === "Term sheets" ? (
          <Card title="Term sheets" subtitle="No generated or signed documents are connected.">
            <Empty
              title="No term sheets stored."
              detail="Term-sheet version history, signatures and vault storage are unavailable."
            />
            <p className={styles.legal}>
              For information only, not legal advice. Have counsel review all proposed terms.
            </p>
          </Card>
        ) : tab === "Cap table impact" ? (
          <Card
            title="Cap table impact"
            subtitle="Illustrative arithmetic only; no cap-table integration."
          >
            <Notice warning>
              Estimates are not an ownership model. Confirm with your lawyer or finance adviser.
            </Notice>
            <div className={styles.infoGrid}>
              <div>
                <small>Target raise</small>
                <strong>{money(round.target)}</strong>
              </div>
              <div>
                <small>Pre-money valuation / cap</small>
                <strong>{round.valuation || "Not set"}</strong>
              </div>
              <div>
                <small>Simple dilution estimate</small>
                <strong>Not calculated</strong>
              </div>
            </div>
            <p className={styles.emptyText}>
              No holder-level ownership data is connected, so dilution and post-round ownership are
              intentionally not inferred.
            </p>
          </Card>
        ) : tab === "Documents" ? (
          <Card title="Round documents">
            <Empty
              title="No round documents."
              detail="Upload, signatures and document sharing are not connected."
              action="Open data room"
              href="/startup/data-room"
            />
          </Card>
        ) : (
          <Card title="Activity">
            <p className={styles.emptyText}>
              A tamper-resistant audit log is not connected. Browser-local edits are not a legal
              audit trail.
            </p>
          </Card>
        )}
      </div>
      {show && (
        <Modal title="Record an external offer" onClose={() => setShow(false)}>
          <form className={styles.modalBody} onSubmit={offers}>
            <Notice warning>
              This is a private manual record, not an offer received or accepted by the platform.
            </Notice>
            <Field label="Investor">
              <select
                required
                value={form.investorId}
                onChange={(e) => setForm({ ...form, investorId: e.target.value })}
              >
                <option value="">Select a private pipeline record</option>
                {data.investors.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} · {i.firm}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Amount (₹)">
              <input
                type="number"
                min="1"
                required
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </Field>
            <Field label="Instrument">
              <select
                value={form.instrument}
                onChange={(e) => setForm({ ...form, instrument: e.target.value })}
              >
                {["Equity", "SAFE", "Convertible note", "Other"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
            <Field label="Local status">
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                {[
                  "Offer received",
                  "Under review",
                  "Accepted",
                  "Declined",
                  "Committed",
                  "Funds received",
                ].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
            <Field label="Notes">
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
            <footer>
              <Button onClick={() => setShow(false)}>Cancel</Button>
              <Button type="submit" kind="primary" disabled={!owner}>
                Save private record
              </Button>
            </footer>
          </form>
        </Modal>
      )}
      {confirm && (
        <Modal title="Close this local round record?" onClose={() => setConfirm(false)}>
          <div className={styles.modalBody}>
            <Notice warning>
              Changing this local status does not notify investors, close a financing, update a
              profile or modify a cap table.
            </Notice>
            <p>
              Minimum raise: {money(round.minimum)} · manual commitments: {money(committed)}.
            </p>
            <footer>
              <Button onClick={() => setConfirm(false)}>Cancel</Button>
              <Button
                kind="primary"
                disabled={!owner}
                onClick={() => {
                  update({ status: "Closed" });
                  setConfirm(false);
                  notify("Round record marked closed locally only.");
                }}
              >
                Mark local record closed
              </Button>
            </footer>
          </div>
        </Modal>
      )}
      <Disclaimer />
    </>
  );
}
function VisibilitySettingsPage({
  data,
  setData,
  owner,
  ready,
  notify,
}: {
  data: ReturnType<typeof useStartupInvestors>["data"];
  setData: ReturnType<typeof useStartupInvestors>["setData"];
  owner: boolean;
  ready: boolean;
  notify: (t: string) => void;
}) {
  const setting = data.settings;
  const change = (patch: Partial<typeof setting>) => {
    setData((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
    notify("Preference saved in this browser only; no visibility or access change was published.");
  };
  const visibilityOptions: [InvestorData["settings"]["visibility"], string, string][] = [
    ["Private", "Private", "Only your team can see investor settings."],
    [
      "Mentors only",
      "Mentors only",
      "Mentors may see shared preparation information; access service is not connected.",
    ],
    [
      "Mentors and verified investors",
      "Mentors and verified investors",
      "Not available until verified Investment Ready sign-off; no directory is connected.",
    ],
  ];
  const toggles: [keyof InvestorSettings, string, string][] = [
    ["profileSummary", "Profile summary", "Company description and profile basics"],
    ["traction", "Traction numbers", "Choose which verified metrics to show"],
    ["team", "Team details", "Founder and team information"],
    ["funding", "Funding details", "Funding context"],
    ["round", "Round information", "Round target and instrument"],
    ["readiness", "Readiness score and badge", "Only after verified mentor sign-off"],
  ];
  const blocked = data.investors.filter((i) => i.blocked);
  const hidden = data.investors.filter((i) => i.hidden);
  return (
    <>
      <Header
        title="Investor visibility settings"
        subtitle="Keep investor visibility private by default and review what would be shared."
      >
        <Link className={styles.secondary} href="/startup/investors">
          <ArrowLeft size={13} /> Investor hub
        </Link>
      </Header>
      <Notice warning>
        Settings persist only in this browser. Visibility publication, identity verification and
        investor access controls are not connected.
      </Notice>
      <div id="investor-main" className={styles.settingsLayout}>
        <nav className={styles.settingsNav}>
          {[
            "Visibility",
            "What investors can see",
            "Investor controls",
            "Data room defaults",
            "Notifications",
            "Pause visibility",
          ].map((x, i) => (
            <a href={`#investor-setting-${i}`} key={x}>
              {x}
            </a>
          ))}
        </nav>
        <main className={styles.stack}>
          <Card
            title="Who can see my startup"
            subtitle="Private is the default. Selecting a preference does not publish your profile."
          >
            <div id="investor-setting-0" className={styles.visibilityOptions}>
              {visibilityOptions.map(([value, title, desc]) => (
                <label
                  key={value}
                  className={setting.visibility === value ? styles.optionActive : styles.option}
                >
                  <input
                    type="radio"
                    name="visibility"
                    checked={setting.visibility === value}
                    disabled={!owner || (value === "Mentors and verified investors" && !ready)}
                    onChange={() => change({ visibility: value })}
                  />
                  <span>
                    <strong>{title}</strong>
                    <small>{desc}</small>
                  </span>
                  {value === "Mentors and verified investors" && !ready && (
                    <Chip status="locked">Locked</Chip>
                  )}
                </label>
              ))}
            </div>
            {!ready && (
              <Notice warning>
                Investor visibility stays locked because mentor sign-off is not verified. There is
                no owner override in this disconnected demo.
              </Notice>
            )}
          </Card>
          <Card title="What investors can see">
            <div id="investor-setting-1">
              {toggles.map(([key, title, desc]) => (
                <label className={styles.toggleRow} key={key}>
                  <span>
                    <strong>{title}</strong>
                    <small>{desc}</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(setting[key])}
                    disabled={!owner || (!ready && key === "readiness")}
                    onChange={(e) =>
                      change({ [key]: e.target.checked } as Partial<InvestorSettings>)
                    }
                  />
                  <i />
                </label>
              ))}
              <Button
                onClick={() => notify("Preview is illustrative; no investor view session exists.")}
              >
                Preview as investor
              </Button>
            </div>
          </Card>
          <Card title="Investor controls">
            <div id="investor-setting-2" className={styles.twoCol}>
              <Field label="Preferred investor types">
                <select disabled={!owner}>
                  <option>Any verified type · not synced</option>
                  <option>Angel</option>
                  <option>Angel group</option>
                  <option>Fund</option>
                </select>
              </Field>
              <Field label="Preferred ticket range">
                <input disabled={!owner} placeholder="Not set · not synced" />
              </Field>
            </div>
            <h3>Blocked investors</h3>
            {blocked.length ? (
              blocked.map((i) => (
                <div className={styles.settingRow} key={i.id}>
                  <span>
                    {i.name} · {i.firm}
                    <small>Private manual record</small>
                  </span>
                  <Button
                    disabled={!owner}
                    onClick={() =>
                      setData((d) => ({
                        ...d,
                        investors: d.investors.map((x) =>
                          x.id === i.id ? { ...x, blocked: false } : x,
                        ),
                      }))
                    }
                  >
                    Unblock
                  </Button>
                </div>
              ))
            ) : (
              <p className={styles.emptyText}>No blocked investor records.</p>
            )}
            <h3>Hidden from recommendations</h3>
            {hidden.length ? (
              hidden.map((i) => (
                <div className={styles.settingRow} key={i.id}>
                  <span>
                    {i.name} · {i.firm}
                  </span>
                  <Button
                    disabled={!owner}
                    onClick={() =>
                      setData((d) => ({
                        ...d,
                        investors: d.investors.map((x) =>
                          x.id === i.id ? { ...x, hidden: false } : x,
                        ),
                      }))
                    }
                  >
                    Unhide
                  </Button>
                </div>
              ))
            ) : (
              <p className={styles.emptyText}>No hidden contacts.</p>
            )}
          </Card>
          <Card title="Data room defaults">
            <div id="investor-setting-3" className={styles.stack}>
              <label className={styles.checkField}>
                <input
                  type="checkbox"
                  checked={setting.ndaRequired}
                  disabled={!owner}
                  onChange={(e) => change({ ndaRequired: e.target.checked })}
                />{" "}
                Require NDA <small>Workflow cannot enforce this setting.</small>
              </label>
              <label className={styles.checkField}>
                <input
                  type="checkbox"
                  checked={setting.watermark}
                  disabled={!owner}
                  onChange={(e) => change({ watermark: e.target.checked })}
                />{" "}
                Recommend watermarking <small>No watermark service is connected.</small>
              </label>
              <Field label="Download policy">
                <select
                  disabled={!owner}
                  value={setting.downloadPolicy}
                  onChange={(e) =>
                    change({ downloadPolicy: e.target.value as InvestorSettings["downloadPolicy"] })
                  }
                >
                  <option>View only</option>
                  <option>Allow selected downloads</option>
                </select>
              </Field>
              <Field label="Default access expiry">
                <input
                  type="date"
                  disabled={!owner}
                  value={setting.accessExpiry}
                  onChange={(e) => change({ accessExpiry: e.target.value })}
                />
              </Field>
            </div>
          </Card>
          <Card title="Notifications">
            <div id="investor-setting-4">
              {["views", "shortlists", "messages", "access requests", "offers"].map((x) => (
                <label className={styles.checkField} key={x}>
                  <input
                    type="checkbox"
                    checked={setting.alerts.includes(x)}
                    onChange={(e) =>
                      change({
                        alerts: e.target.checked
                          ? [...setting.alerts, x]
                          : setting.alerts.filter((a) => a !== x),
                      })
                    }
                  />
                  {x}
                </label>
              ))}
              <Field label="Digest frequency">
                <select>
                  <option>Daily · local preference</option>
                  <option>Weekly</option>
                  <option>Immediate</option>
                </select>
              </Field>
            </div>
          </Card>
          <Card title="Pause investor visibility">
            <div id="investor-setting-5" className={styles.pauseRow}>
              <span>
                <strong>{setting.paused ? "Visibility paused" : "Visibility not paused"}</strong>
                <small>Pause is a local preference and does not unpublish a live profile.</small>
              </span>
              <Button
                kind={setting.paused ? "primary" : "danger"}
                disabled={!owner}
                onClick={() => change({ paused: !setting.paused })}
              >
                {setting.paused ? "Resume" : "Pause visibility"}
              </Button>
            </div>
          </Card>
          <Disclaimer />
        </main>
      </div>
    </>
  );
}
