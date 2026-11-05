"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { SignOutLink } from "@/components/shared/SignOutLink";
import {
  CheckCircle2,
  ChevronDown,
  Clock,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Moon,
  Settings,
  Sun,
  Users,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { useTheme } from "@/components/ThemeProvider";
import {
  CompletedWorkspaceProfile,
  OnboardingRole,
  USER_PROFILE_KEY,
} from "@/lib/registrationDraft";
import styles from "./dashboard.module.css";

function normalizeRole(raw: string | null): OnboardingRole {
  const value = (raw || "").trim().toLowerCase();
  if (value === "mentor") return "Mentor";
  if (value === "investor") return "Investor";
  if (value === "job seeker" || value === "talent") return "Job seeker";
  if (value === "employer") return "Employer";
  return "Startup";
}

const ROLE_WORKSPACE_DATA: Record<
  OnboardingRole,
  {
    modules: string[];
    metrics: Array<{ label: string; value: string; note: string }>;
    panelTitle: string;
    items: Array<{ title: string; subtitle: string; badge: string }>;
  }
> = {
  Startup: {
    modules: ["Overview", "Fundraising & Data Room", "Team & Hiring", "Mentor Office Hours"],
    metrics: [
      {
        label: "Data room readiness",
        value: "84%",
        note: "Cap table and deck uploaded",
      },
      {
        label: "Matched mentors",
        value: "6",
        note: "Go-to-market & Series A operators",
      },
      {
        label: "Candidate pipeline",
        value: "14",
        note: "3 founding engineer intros ready",
      },
    ],
    panelTitle: "Recommended next steps",
    items: [
      {
        title: "Finalize Q4 investor update & diligence room permissions",
        subtitle: "Fundraising & Data Room · Confidential access control",
        badge: "Ready",
      },
      {
        title: "Book office hours with matched GTM advisors",
        subtitle: "Mentors · 2 slots open this Thursday",
        badge: "Available",
      },
      {
        title: "Publish Founding Engineer role to vetted talent pool",
        subtitle: "Team & Hiring · Direct founder-to-candidate outreach",
        badge: "Draft",
      },
    ],
  },
  Mentor: {
    modules: ["Overview", "Assigned Founders", "Office Hours", "Cohort Notes"],
    metrics: [
      {
        label: "Founder matches",
        value: "5",
        note: "Seed & Pre-seed companies in your thesis",
      },
      {
        label: "Upcoming sessions",
        value: "3",
        note: "4 hrs / month commitment",
      },
      {
        label: "Session follow-ups",
        value: "100%",
        note: "All advisory notes shared",
      },
    ],
    panelTitle: "Founder office-hour requests",
    items: [
      {
        title: "Northstar Bio · Enterprise pilot pricing review",
        subtitle: "Seed stage · Requested 45-min GTM session",
        badge: "Pending",
      },
      {
        title: "Kestrel Compute · Seed pitch narrative feedback",
        subtitle: "Pre-seed · Deck attached in confidential room",
        badge: "This week",
      },
      {
        title: "Arbor Energy · First VP Sales hiring scorecard",
        subtitle: "Series A · Org design advisory",
        badge: "Scheduled",
      },
    ],
  },
  Investor: {
    modules: ["Overview", "Curated Deal Flow", "Diligence Rooms", "Portfolio Updates"],
    metrics: [
      {
        label: "Thesis-matched startups",
        value: "12",
        note: "Filtered by stage & sector focus",
      },
      {
        label: "Active diligence rooms",
        value: "4",
        note: "NDA & audit trail enabled",
      },
      {
        label: "Portfolio KPI updates",
        value: "9 / 10",
        note: "Q3 founder reports received",
      },
    ],
    panelTitle: "Thesis-matched deal rooms",
    items: [
      {
        title: "Northstar Bio · Programmable Oncology Therapeutics",
        subtitle: "Seed · Raising $3.5M · Data room verified",
        badge: "96% match",
      },
      {
        title: "Veridian Systems · Autonomous Grid Telemetry",
        subtitle: "Seed · $42k MRR · Warm mentor endorsement",
        badge: "92% match",
      },
      {
        title: "Lattice Ledger · Treasury Automation for Biotech",
        subtitle: "Pre-seed · Founding team ex-Stripe & Broad",
        badge: "New",
      },
    ],
  },
  "Job seeker": {
    modules: ["Overview", "Matched Roles", "Direct Introductions", "Saved Startups"],
    metrics: [
      {
        label: "High-signal role matches",
        value: "9",
        note: "Aligned with stage & stack preferences",
      },
      {
        label: "Founder introductions",
        value: "2",
        note: "Direct replies from hiring founders",
      },
      {
        label: "Profile visibility",
        value: "Confidential",
        note: "Hidden from current employer",
      },
    ],
    panelTitle: "Curated startup opportunities",
    items: [
      {
        title: "Founding Product Engineer · Northstar Bio",
        subtitle: "Seed ($3.5M) · Hybrid · Direct to CTO",
        badge: "Strong match",
      },
      {
        title: "Staff Systems Engineer · Kestrel Compute",
        subtitle: "Series A · AI Infrastructure · Equity-heavy",
        badge: "New",
      },
      {
        title: "Lead Product Designer · Lattice Ledger",
        subtitle: "Seed · Remote-friendly · Founding design seat",
        badge: "Saved",
      },
    ],
  },
  Employer: {
    modules: ["Overview", "Active Requisitions", "Curated Candidates", "Interviews"],
    metrics: [
      {
        label: "Vetted candidate matches",
        value: "18",
        note: "Pre-screened operators & engineers",
      },
      {
        label: "Active interviews",
        value: "5",
        note: "92% response rate on outreach",
      },
      {
        label: "Time to first intro",
        value: "36 hrs",
        note: "Across engineering & product roles",
      },
    ],
    panelTitle: "Shortlisted candidates ready for review",
    items: [
      {
        title: "Senior Full-Stack Engineer · 7 yrs startup experience",
        subtitle: "TypeScript, Rust, AI Infrastructure · Previously Founding Eng",
        badge: "Ready to intro",
      },
      {
        title: "Product Design Lead · 6 yrs B2B & Fintech",
        subtitle: "0-to-1 design systems & enterprise workflows",
        badge: "Reviewed",
      },
      {
        title: "Head of Revenue Operations · Series A–B specialist",
        subtitle: "Scaled ARR from $1M to $18M",
        badge: "New match",
      },
    ],
  },
};

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme, toggleTheme } = useTheme();

  const queryRole = searchParams.get("role");
  const queryEmail = searchParams.get("email");
  const isWelcome = searchParams.get("welcome") === "1";

  const [role, setRole] = useState<OnboardingRole>(normalizeRole(queryRole));
  const [activeTab, setActiveTab] = useState(0);
  const [savedProfile, setSavedProfile] = useState<CompletedWorkspaceProfile | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(USER_PROFILE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CompletedWorkspaceProfile;
        setSavedProfile(parsed);
        if (!queryRole && parsed.role) {
          if (parsed.role === "Startup") {
            router.replace("/startup/dashboard");
            return;
          }
          setRole(parsed.role);
        }
      } else if (!queryRole || normalizeRole(queryRole) === "Startup") {
        router.replace("/startup/dashboard");
      }
    } catch {
      // Ignore storage errors
    }
  }, [queryRole, router]);

  useEffect(() => {
    if (queryRole) {
      const normalized = normalizeRole(queryRole);
      if (normalized === "Startup") {
        router.replace("/startup/dashboard");
        return;
      }
      setRole(normalized);
      setActiveTab(0);
    }
  }, [queryRole, router]);

  const workspace = ROLE_WORKSPACE_DATA[role];
  const displayName = savedProfile?.fullName || "Claire Chen";
  const displayEmail = queryEmail || savedProfile?.email || "claire@northstar.bio";

  const requiresReview =
    (isWelcome || savedProfile?.requiresVerification) &&
    (role === "Investor" || role === "Mentor" || role === "Employer");

  // Build role-specific onboarding summary metadata
  const renderProfileSummary = () => {
    const ob = savedProfile?.onboarding;

    if (role === "Startup") {
      const s = ob?.startup;
      return {
        heading: s?.companyName || "Northstar Bio",
        items: [
          { label: "Overview", value: s?.oneLiner || "Programmable protein therapeutics" },
          { label: "Stage", value: s?.stage || "Seed" },
          { label: "Team size", value: s?.teamSize || "3–10" },
          { label: "Primary sector", value: s?.sector || "Biotech & Health" },
        ],
        tags: s?.priorities?.length ? s.priorities : ["Fundraising", "Hiring talent"],
      };
    }

    if (role === "Mentor") {
      const m = ob?.mentor;
      return {
        heading: m?.headlineRole || "Operating Partner, Horizon Ventures",
        items: [
          { label: "Experience", value: m?.experienceYears || "11–15 years" },
          { label: "Availability", value: m?.availability || "4 hrs / month" },
          {
            label: "Preferred stages",
            value: m?.preferredStages?.join(", ") || "Pre-seed, Seed",
          },
        ],
        tags: m?.expertise?.length ? m.expertise : ["Go-to-market", "Fundraising & pitch"],
      };
    }

    if (role === "Investor") {
      const inv = ob?.investor;
      return {
        heading: inv?.firmName || "Meridian Capital Partners",
        items: [
          { label: "Investor type", value: inv?.investorType || "Venture Fund" },
          { label: "Check size", value: inv?.checkSize || "$250k – $1M" },
          { label: "Target stage", value: inv?.targetStage || "Seed" },
        ],
        tags: inv?.sectors?.length ? inv.sectors : ["AI & Infrastructure", "B2B SaaS"],
      };
    }

    if (role === "Job seeker") {
      const js = ob?.jobSeeker;
      return {
        heading: js?.targetTitle || "Founding Product Engineer",
        items: [
          { label: "Experience", value: js?.experienceYears || "3–5 years" },
          { label: "Work preference", value: js?.workPreference || "Hybrid" },
          {
            label: "Stage focus",
            value: js?.preferredStages?.join(", ") || "Seed, Series A–B",
          },
        ],
        tags: js?.skills?.length ? js.skills : ["Full-stack TypeScript", "AI / ML"],
      };
    }

    const emp = ob?.employer;
    return {
      heading: emp?.companyName || "Vantage Systems",
      items: [
        { label: "Hiring lead", value: emp?.hiringLeadRole || "Head of Talent" },
        { label: "Company size", value: emp?.companySize || "11–50" },
        {
          label: "Hiring timeline",
          value: emp?.hiringTimeline || "Immediate (this month)",
        },
      ],
      tags: emp?.openFunctions?.length
        ? emp.openFunctions
        : ["Software Engineering", "Product & Design"],
    };
  };

  const summary = renderProfileSummary();

  return (
    <div className={styles.layout}>
      {/* Mobile Header */}
      <div className={styles.mobileTopBar}>
        <BrandLogo variant="ivory" />
        <SignOutLink className={styles.sidebarLink} iconSize={15} />
      </div>

      {/* Desktop Architectural Sidebar */}
      <aside className={styles.sidebar} aria-label="Workspace navigation">
        <div className={styles.sidebarTop}>
          <div className={styles.brandWrap}>
            <BrandLogo variant="ivory" />
          </div>

          <div className={styles.roleSwitcherBox}>
            <label htmlFor="workspace-role-select" className={styles.roleSwitcherLabel}>
              Active workspace
            </label>
            <div className={styles.roleSelectWrap}>
              <select
                id="workspace-role-select"
                value={role}
                onChange={(e) => {
                  const nextRole = e.target.value as OnboardingRole;
                  if (nextRole === "Startup") {
                    router.push("/startup/dashboard");
                    return;
                  }
                  setRole(nextRole);
                  setActiveTab(0);
                }}
                className={styles.roleSelect}
              >
                <option value="Startup">Startup</option>
                <option value="Mentor">Mentor</option>
                <option value="Investor">Investor</option>
                <option value="Job seeker">Job seeker</option>
                <option value="Employer">Employer</option>
              </select>
              <ChevronDown
                size={15}
                strokeWidth={1.5}
                className={styles.roleSelectIcon}
                aria-hidden="true"
              />
            </div>
          </div>

          <nav className={styles.navList}>
            {workspace.modules.map((mod, idx) => {
              const active = activeTab === idx;
              return (
                <button
                  key={mod}
                  type="button"
                  onClick={() => setActiveTab(idx)}
                  className={`${styles.navBtn} ${active ? styles.navBtnActive : ""}`}
                >
                  {idx === 0 ? (
                    <LayoutDashboard size={16} strokeWidth={1.5} aria-hidden="true" />
                  ) : idx === 1 ? (
                    <FolderKanban size={16} strokeWidth={1.5} aria-hidden="true" />
                  ) : (
                    <Users size={16} strokeWidth={1.5} aria-hidden="true" />
                  )}
                  <span>{mod}</span>
                  {active && <span className={styles.navAccentDot} aria-hidden="true" />}
                </button>
              );
            })}
          </nav>
        </div>

        <div className={styles.sidebarBottom}>
          <div className={styles.userCard}>
            <span className={styles.userName}>{displayName}</span>
            <span className={styles.userEmail}>{displayEmail}</span>
          </div>

          <Link
            href={`/onboarding?role=${encodeURIComponent(role)}`}
            className={styles.sidebarLink}
          >
            <Settings size={15} strokeWidth={1.5} aria-hidden="true" />
            <span>Edit onboarding profile</span>
          </Link>

          <SignOutLink className={styles.sidebarLink} iconSize={15} />
        </div>
      </aside>

      {/* Main Workspace Canvas */}
      <main className={`${styles.main} animate-form-enter`}>
        <header className={styles.topHeader}>
          <div className={styles.titleGroup}>
            <div className={styles.statusRow}>
              {requiresReview ? (
                <span className={`${styles.statusPill} ${styles.statusPillPending}`}>
                  <Clock size={13} strokeWidth={1.75} aria-hidden="true" />
                  <span>Verification in progress</span>
                </span>
              ) : (
                <span className={styles.statusPill}>
                  <CheckCircle2 size={13} strokeWidth={1.75} aria-hidden="true" />
                  <span>Active {role.toLowerCase()} workspace</span>
                </span>
              )}
            </div>

            <h1 className={styles.pageTitle}>
              {isWelcome ? `Welcome, ${displayName}` : `${summary.heading}`}
            </h1>
            <p className={styles.pageSubtitle}>
              {workspace.modules[activeTab]} &middot; {role} ERP Workspace
            </p>
          </div>

          <div className={styles.headerActions}>
            <Link
              href={`/onboarding?role=${encodeURIComponent(role)}`}
              className={styles.secondaryBtn}
            >
              Edit {role.toLowerCase()} onboarding
            </Link>

            <button
              type="button"
              onClick={toggleTheme}
              className={styles.themeIconBtn}
              aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
            >
              {theme === "light" ? (
                <Moon size={16} strokeWidth={1.5} aria-hidden="true" />
              ) : (
                <Sun size={16} strokeWidth={1.5} aria-hidden="true" />
              )}
            </button>
          </div>
        </header>

        {/* Onboarding Profile Summary Card */}
        <section className={styles.profileCard} aria-label="Onboarding profile summary">
          <div className={styles.profileCardTop}>
            <span className={styles.profileSectionTitle}>
              {role} profile &middot; {summary.heading}
            </span>
            <Link href="/register/role" className="accent-link" style={{ fontSize: "13px" }}>
              Switch or add role
            </Link>
          </div>

          <div className={styles.metaGrid}>
            {summary.items.map((item) => (
              <div key={item.label} className={styles.metaItem}>
                <span className={styles.metaLabel}>{item.label}</span>
                <span className={styles.metaValue}>{item.value}</span>
              </div>
            ))}
          </div>

          <div className={styles.tagRow}>
            {summary.tags.map((tag) => (
              <span key={tag} className={styles.tag}>
                {tag}
              </span>
            ))}
          </div>
        </section>

        {/* Role-Specific Metrics */}
        <section className={styles.metricsGrid} aria-label="Workspace metrics">
          {workspace.metrics.map((metric) => (
            <div key={metric.label} className={styles.metricCard}>
              <span className={styles.metricLabel}>{metric.label}</span>
              <span className={styles.metricValue}>{metric.value}</span>
              <span className={styles.metricNote}>{metric.note}</span>
            </div>
          ))}
        </section>

        {/* Role-Specific Activity / Action Queue */}
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>{workspace.panelTitle}</h2>
          </div>

          <div className={styles.itemList}>
            {workspace.items.map((item) => (
              <div key={item.title} className={styles.listRow}>
                <div className={styles.rowPrimary}>
                  <span className={styles.rowTitle}>{item.title}</span>
                  <span className={styles.rowSub}>{item.subtitle}</span>
                </div>
                <span className={styles.rowBadge}>{item.badge}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardContent />
    </Suspense>
  );
}
