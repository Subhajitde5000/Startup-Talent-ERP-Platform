"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Database,
  Globe2,
  Info,
  LockKeyhole,
  Mail,
  Moon,
  Plug,
  Save,
  ShieldCheck,
  Sun,
  Users,
  X,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useStartupWorkspace } from "@/context/StartupWorkspaceContext";
import { useTheme } from "@/components/ThemeProvider";
import { STARTUP_PROFILE_KEY } from "@/lib/startupProfileStorage";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { resetDemoWorkspaces } from "@/config/demoStorage";
import styles from "./Settings.module.css";

type Tab = "Workspace" | "Notifications" | "Privacy & data" | "Connected apps" | "Appearance";
type SettingsState = {
  timezone: string;
  currency: string;
  dateFormat: string;
  fiscalYear: string;
  weekStarts: string;
  notifications: {
    tasks: boolean;
    mentors: boolean;
    team: boolean;
    documents: boolean;
    milestones: boolean;
    digest: "off" | "daily" | "weekly";
    quietHours: boolean;
  };
  privacy: { mentorVisibility: boolean; investorDiscovery: boolean; retention: "12" | "24" | "36" };
};
const KEY = "meridian-startup-settings-v1";
const DEFAULT: SettingsState = {
  timezone: "Asia/Kolkata",
  currency: "INR",
  dateFormat: "DD MMM YYYY",
  fiscalYear: "April",
  weekStarts: "Monday",
  notifications: {
    tasks: true,
    mentors: true,
    team: true,
    documents: true,
    milestones: true,
    digest: "off",
    quietHours: false,
  },
  privacy: { mentorVisibility: true, investorDiscovery: false, retention: "12" },
};
const TABS: Tab[] = [
  "Workspace",
  "Notifications",
  "Privacy & data",
  "Connected apps",
  "Appearance",
];
function Toggle({
  checked,
  onChange,
  label,
  detail,
  disabled = false,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  detail: string;
  disabled?: boolean;
}) {
  return (
    <label className={styles.toggleRow}>
      <span>
        <strong>{label}</strong>
        <small>{detail}</small>
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <i aria-hidden="true" />
    </label>
  );
}
export default function StartupSettingsPage() {
  const searchParams = useSearchParams();
  const { data, updateStartupIdentity } = useStartupWorkspace();
  const { theme, toggleTheme } = useTheme();
  const [tab, setTab] = useState<Tab>("Workspace");
  const [settings, setSettings] = useState<SettingsState>(DEFAULT);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tagline, setTagline] = useState(data.startup.tagline);
  const [confirmReset, setConfirmReset] = useState<"settings" | "demo" | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SettingsState>;
        setSettings({
          ...DEFAULT,
          ...parsed,
          notifications: { ...DEFAULT.notifications, ...parsed.notifications },
          privacy: { ...DEFAULT.privacy, ...parsed.privacy },
        });
      }
    } catch {
      /* use defaults */
    }
    setLoaded(true);
  }, []);
  useEffect(() => {
    setTagline(data.startup.tagline);
  }, [data.startup.tagline]);
  useEffect(() => {
    if (searchParams.get("tab") === "notifications") setTab("Notifications");
  }, [searchParams]);
  const update = (section: "notifications" | "privacy", key: string, value: unknown) =>
    setSettings((s) => ({ ...s, [section]: { ...s[section], [key]: value } }));
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
      const profile = JSON.parse(localStorage.getItem(STARTUP_PROFILE_KEY) || "{}") as Record<
        string,
        unknown
      >;
      localStorage.setItem(
        STARTUP_PROFILE_KEY,
        JSON.stringify({ ...profile, name: data.startup.name, tagline }),
      );
      window.dispatchEvent(new Event("startup-notification-settings-updated"));
      updateStartupIdentity({ tagline });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch {
      setSaved(false);
    }
  };
  return (
    <div className={styles.page}>
      <a className={styles.skip} href="#settings-main">
        Skip to settings
      </a>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Startup workspace · Preferences</span>
          <h1>Settings</h1>
          <p>Manage workspace defaults, notification preferences and data controls.</p>
        </div>
        <button className={styles.primaryButton} onClick={save} disabled={!loaded}>
          <Save size={14} />
          {saved ? "Saved locally" : "Save changes"}
        </button>
      </header>
      <div className={styles.statusBar}>
        <span className={styles.localDot} />
        <span>
          Settings save in this browser only. No account settings API or notification delivery
          service is connected.
        </span>
        <Link href="/startup/profile">
          Edit startup profile <ChevronRight size={13} />
        </Link>
      </div>
      <div id="settings-main" className={styles.settingsLayout}>
        <nav className={styles.sideNav} aria-label="Settings sections">
          {TABS.map((item, index) => (
            <button
              key={item}
              className={tab === item ? styles.sideActive : styles.sideItem}
              onClick={() => setTab(item)}
            >
              {index === 0 ? (
                <Globe2 size={15} />
              ) : index === 1 ? (
                <Bell size={15} />
              ) : index === 2 ? (
                <ShieldCheck size={15} />
              ) : index === 3 ? (
                <Plug size={15} />
              ) : (
                <Sun size={15} />
              )}
              <span>{item}</span>
              <ChevronRight size={13} />
            </button>
          ))}
        </nav>
        <main className={styles.content}>
          {tab === "Workspace" && (
            <section className={styles.card}>
              <div className={styles.cardHeading}>
                <div>
                  <h2>Workspace defaults</h2>
                  <p>
                    Regional settings are used for dates, currency and calendar labels. These do not
                    change existing records.
                  </p>
                </div>
                <Globe2 size={17} />
              </div>
              <div className={styles.identity}>
                <span className={styles.avatar}>
                  {data.startup.founderName
                    .split(" ")
                    .map((s) => s[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </span>
                <div>
                  <strong>{data.startup.founderName}</strong>
                  <small>
                    {data.startup.founderEmail} ·{" "}
                    {data.team.find((m) => m.name === data.startup.founderName)?.permission ||
                      "Workspace member"}
                  </small>
                </div>
                <PillLocal>Signed in</PillLocal>
              </div>
              <label className={styles.field}>
                Workspace name
                <input value={data.startup.name} readOnly aria-readonly="true" />
                <small>Change this in Startup Profile to keep company identity consistent.</small>
              </label>
              <label className={styles.field}>
                Tagline
                <input
                  maxLength={140}
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="A short company description"
                />
                <small>Saved to your local Startup Profile.</small>
              </label>
              <div className={styles.fieldsGrid}>
                <label className={styles.field}>
                  Time zone
                  <select
                    value={settings.timezone}
                    onChange={(e) => setSettings((s) => ({ ...s, timezone: e.target.value }))}
                  >
                    {[
                      "Asia/Kolkata",
                      "UTC",
                      "America/New_York",
                      "Europe/London",
                      "Asia/Singapore",
                    ].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  Currency
                  <select
                    value={settings.currency}
                    onChange={(e) => setSettings((s) => ({ ...s, currency: e.target.value }))}
                  >
                    {["INR", "USD", "EUR", "GBP", "SGD"].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  Date format
                  <select
                    value={settings.dateFormat}
                    onChange={(e) => setSettings((s) => ({ ...s, dateFormat: e.target.value }))}
                  >
                    <option>DD MMM YYYY</option>
                    <option>MMM DD, YYYY</option>
                    <option>YYYY-MM-DD</option>
                  </select>
                </label>
                <label className={styles.field}>
                  Fiscal year starts
                  <select
                    value={settings.fiscalYear}
                    onChange={(e) => setSettings((s) => ({ ...s, fiscalYear: e.target.value }))}
                  >
                    {["January", "April", "July", "October"].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  Week starts on
                  <select
                    value={settings.weekStarts}
                    onChange={(e) => setSettings((s) => ({ ...s, weekStarts: e.target.value }))}
                  >
                    <option>Monday</option>
                    <option>Sunday</option>
                  </select>
                </label>
              </div>
              <div className={styles.infoBox}>
                <InfoIcon />
                <span>
                  <strong>
                    Current stage:{" "}
                    {data.stages.find((s) => s.id === data.startup.currentStage)?.label ||
                      "Not set"}
                  </strong>
                  <small>
                    Stage changes stay in the Stage Roadmap; settings do not change your stage or
                    readiness status.
                  </small>
                </span>
                <Link href="/startup/stage">Open roadmap</Link>
              </div>
            </section>
          )}
          {tab === "Notifications" && (
            <section className={styles.card}>
              <div className={styles.cardHeading}>
                <div>
                  <h2>Notification preferences</h2>
                  <p>
                    Choose which local workspace events appear in your notification center. Email
                    and push delivery are unavailable.
                  </p>
                </div>
                <Bell size={17} />
              </div>
              {(
                [
                  ["tasks", "Task reminders", "Overdue tasks and due-date reminders."],
                  ["mentors", "Mentor activity", "Mentor feedback and session updates."],
                  ["team", "Team activity", "Member joins and team changes."],
                  ["documents", "Documents", "Document uploads and workspace files."],
                  ["milestones", "Milestones", "Stage and milestone activity."],
                ] as Array<[keyof SettingsState["notifications"], string, string]>
              ).map(([key, label, detail]) => (
                <Toggle
                  key={key}
                  label={label}
                  detail={detail}
                  checked={settings.notifications[key] as boolean}
                  onChange={(value) => update("notifications", key, value)}
                />
              ))}
              <div className={styles.field}>
                <span>Email digest preference</span>
                <select
                  value={settings.notifications.digest}
                  onChange={(e) => update("notifications", "digest", e.target.value)}
                >
                  <option value="off">Off</option>
                  <option value="daily">Daily digest</option>
                  <option value="weekly">Weekly digest</option>
                </select>
                <small>
                  Saved as a preference only; no email digest will be sent until a delivery service
                  is connected.
                </small>
              </div>
              <Toggle
                label="Quiet hours"
                detail="Do not send push notifications during quiet hours (delivery service not connected)."
                checked={settings.notifications.quietHours}
                onChange={(value) => update("notifications", "quietHours", value)}
              />
              <Link className={styles.inlineLink} href="/startup/notifications">
                Open notification center <ChevronRight size={13} />
              </Link>
            </section>
          )}
          {tab === "Privacy & data" && (
            <section className={styles.card}>
              <div className={styles.cardHeading}>
                <div>
                  <h2>Privacy & data</h2>
                  <p>
                    Controls are local preferences until account and data services are connected.
                  </p>
                </div>
                <LockKeyhole size={17} />
              </div>
              <Toggle
                label="Share startup profile with mentors"
                detail="A preference only. No external profile sharing is active from this workspace."
                checked={settings.privacy.mentorVisibility}
                onChange={(value) => update("privacy", "mentorVisibility", value)}
              />
              <Toggle
                label="Allow investor discovery"
                detail="Off by default. Investor discovery and profile visibility are not connected."
                checked={settings.privacy.investorDiscovery}
                onChange={(value) => update("privacy", "investorDiscovery", value)}
              />
              <div className={styles.field}>
                <span>Applicant data retention preference</span>
                <select
                  value={settings.privacy.retention}
                  onChange={(e) => update("privacy", "retention", e.target.value)}
                >
                  <option value="12">12 months after a job closes</option>
                  <option value="24">24 months after a job closes</option>
                  <option value="36">36 months after a job closes</option>
                </select>
                <small>
                  Preference only; no automatic deletion timer is active. Handle candidate data
                  according to your policy and applicable law.
                </small>
              </div>
              <div className={styles.warningBox}>
                <Database size={15} />
                <span>
                  <strong>Local data note</strong>
                  <small>
                    Hiring records, analytics inputs and these settings live in this browser.
                    Clearing browser storage removes local changes. Do not use this demo workspace
                    for confidential production data.
                  </small>
                </span>
              </div>
              <button
                className={styles.secondaryButton}
                onClick={() => setConfirmReset("settings")}
              >
                <X size={14} /> Reset settings and notification read status
              </button>
              <button className={styles.secondaryButton} onClick={() => setConfirmReset("demo")}>
                <Database size={14} /> Restore all demo data
              </button>
              <p className={styles.subtle}>
                Restores the fictional founder, mentor and investor records used across the demo.
              </p>
            </section>
          )}
          {tab === "Connected apps" && (
            <section className={styles.card}>
              <div className={styles.cardHeading}>
                <div>
                  <h2>Connected apps</h2>
                  <p>Connections and sync status for workspace tools.</p>
                </div>
                <Plug size={17} />
              </div>
              <div className={styles.integrationList}>
                {[
                  {
                    name: "Email & notifications",
                    detail: "Digest and transactional notification delivery",
                  },
                  { name: "Calendar", detail: "Interview scheduling and availability" },
                  {
                    name: "Jobs marketplace",
                    detail: "Job publishing, applicants and opted-in talent search",
                  },
                  { name: "Finance", detail: "Hiring budget and runway impact" },
                  { name: "Cloud storage", detail: "Resume and offer-letter attachments" },
                ].map((item) => (
                  <div className={styles.integration} key={item.name}>
                    <span className={styles.integrationIcon}>
                      <Plug size={15} />
                    </span>
                    <div>
                      <strong>{item.name}</strong>
                      <small>{item.detail}</small>
                    </div>
                    <PillLocal>Not connected</PillLocal>
                    <button disabled title="Integration setup is not available yet">
                      Connect
                    </button>
                  </div>
                ))}
              </div>
              <div className={styles.infoBox}>
                <LockKeyhole size={15} />
                <span>
                  <strong>No external sync is enabled.</strong>
                  <small>
                    Pages label local-only data and will not claim an email, calendar or third-party
                    update was sent.
                  </small>
                </span>
              </div>
            </section>
          )}
          {tab === "Appearance" && (
            <section className={styles.card}>
              <div className={styles.cardHeading}>
                <div>
                  <h2>Appearance</h2>
                  <p>Choose how the workspace looks on this device.</p>
                </div>
                {theme === "dark" ? <Moon size={17} /> : <Sun size={17} />}
              </div>
              <div className={styles.themeOptions}>
                <button
                  className={theme === "light" ? styles.themeActive : styles.themeOption}
                  onClick={() => theme !== "light" && toggleTheme()}
                >
                  <Sun size={17} />
                  <span>
                    <strong>Light</strong>
                    <small>Ivory surfaces and ink text</small>
                  </span>
                  {theme === "light" && <CheckCircle2 size={16} />}
                </button>
                <button
                  className={theme === "dark" ? styles.themeActive : styles.themeOption}
                  onClick={() => theme !== "dark" && toggleTheme()}
                >
                  <Moon size={17} />
                  <span>
                    <strong>Dark</strong>
                    <small>Deep navy surfaces and soft text</small>
                  </span>
                  {theme === "dark" && <CheckCircle2 size={16} />}
                </button>
              </div>
              <p className={styles.subtle}>
                Appearance is saved by this browser’s theme preference.
              </p>
            </section>
          )}
        </main>
      </div>
      <ConfirmDialog
        open={confirmReset === "settings"}
        title="Reset local settings?"
        description="Notification read status and workspace settings return to their defaults. Hiring and analytics records are kept."
        confirmLabel="Reset settings"
        onCancel={() => setConfirmReset(null)}
        onConfirm={() => {
          localStorage.removeItem(KEY);
          localStorage.removeItem("meridian-startup-notifications-read-v1");
          setSettings(DEFAULT);
          window.dispatchEvent(new Event("startup-notification-settings-updated"));
          setSaved(false);
          setConfirmReset(null);
        }}
      />
      <ConfirmDialog
        open={confirmReset === "demo"}
        title="Restore all demo data?"
        description="This clears every local edit across the founder, mentor and investor workspaces and reloads the original fictional demo records."
        confirmLabel="Restore demo data"
        tone="danger"
        onCancel={() => setConfirmReset(null)}
        onConfirm={() => resetDemoWorkspaces()}
      />
    </div>
  );
}
function PillLocal({ children }: { children: React.ReactNode }) {
  return <span className={styles.pill}>{children}</span>;
}
function InfoIcon() {
  return <Info size={15} aria-hidden="true" />;
}
