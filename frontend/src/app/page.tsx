import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, GraduationCap, LayoutDashboard } from "lucide-react";
import { ThemeTogglePill } from "@/components/ThemeTogglePill";
import styles from "./home.module.css";

export const metadata: Metadata = {
  title: "Meridian — Startup & Talent ERP",
  description: "Explore the founder, mentor and investor demo workspaces.",
};

const roles = [
  {
    href: "/startup/dashboard",
    label: "Founder workspace",
    description:
      "Stage roadmap, tasks, team, hiring, investor hub and a data room — all populated with illustrative records.",
    meta: "Open founder demo",
    icon: <LayoutDashboard size={21} aria-hidden="true" />,
  },
  {
    href: "/mentor/dashboard",
    label: "Mentor workspace",
    description:
      "Mentorships, sessions, deliverables, readiness sign-offs, earnings and reviews with a complete demo caseload.",
    meta: "Open mentor demo",
    icon: <GraduationCap size={21} aria-hidden="true" />,
  },
  {
    href: "/investor/dashboard",
    label: "Investor workspace",
    description:
      "Discover startups, manage a pipeline, review diligence, track offers and portfolio holdings on demo deal flow.",
    meta: "Open investor demo",
    icon: <BriefcaseBusiness size={21} aria-hidden="true" />,
  },
];

export default function HomePage() {
  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <Link className={styles.brand} href="/" aria-label="Meridian home">
          <span className={styles.brandMark}>M</span>
          Meridian
        </Link>
        <div className={styles.topActions}>
          <ThemeTogglePill />
          <Link className={styles.topLink} href="/login">
            Sign in
          </Link>
        </div>
      </header>

      <main>
        <section className={styles.hero}>
          <span className={styles.eyebrow}>Startup &amp; Talent ERP · Demo</span>
          <h1 className={styles.heroTitle}>
            One calm workspace for <em>building what&apos;s next</em>
          </h1>
          <p className={styles.heroCopy}>
            Meridian brings founders, mentors and investors into one shared, evidence-led workflow.
            Explore any role below — every screen is pre-filled with fictional demo records you can
            edit, filter and save locally.
          </p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryButton} href="/startup/dashboard">
              Explore the founder workspace <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link className={styles.secondaryButton} href="/register">
              Create an account
            </Link>
          </div>
          <p className={styles.demoNote}>
            No backend connected · changes are saved in this browser · reset any time from Settings
          </p>
        </section>

        <section className={styles.section} aria-labelledby="workspace-heading">
          <div className={styles.sectionHead}>
            <div>
              <h2 id="workspace-heading">Choose a workspace</h2>
              <p>Three role-specific experiences, one consistent design system.</p>
            </div>
          </div>
          <div className={styles.cardGrid}>
            {roles.map((role) => (
              <Link className={styles.roleCard} href={role.href} key={role.href}>
                <span className={styles.roleIcon}>{role.icon}</span>
                <h3>{role.label}</h3>
                <p>{role.description}</p>
                <span className={styles.roleMeta}>
                  {role.meta} <ArrowRight size={13} aria-hidden="true" />
                </span>
              </Link>
            ))}
          </div>
          <div className={styles.statRow}>
            <div className={styles.stat}>
              <strong>3</strong>
              <span>role workspaces</span>
            </div>
            <div className={styles.stat}>
              <strong>80+</strong>
              <span>working screens</span>
            </div>
            <div className={styles.stat}>
              <strong>100%</strong>
              <span>local demo data</span>
            </div>
            <div className={styles.stat}>
              <strong>0</strong>
              <span>external services required</span>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        Illustrative product demo · <Link href="/terms">Terms</Link> ·{" "}
        <Link href="/privacy">Privacy</Link> · <Link href="/help?role=startup">Help center</Link>
      </footer>
    </div>
  );
}
