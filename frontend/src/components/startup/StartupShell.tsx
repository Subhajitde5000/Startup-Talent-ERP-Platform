'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowLeftRight,
  BarChart3,
  Briefcase,
  Building2,
  Compass,
  FileSpreadsheet,
  FlaskConical,
  FolderKanban,
  Handshake,
  KanbanSquare,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  Menu,
  MessageSquareText,
  Moon,
  PieChart,
  Settings,
  Sun,
  TrendingUp,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { useTheme } from '@/components/ThemeProvider';
import {
  ALL_STARTUP_NAV_ITEMS,
  STARTUP_NAV_GROUPS,
} from '@/config/startupNavigation';
import { useStartupWorkspace } from '@/context/StartupWorkspaceContext';
import styles from './StartupShell.module.css';

function getNavIcon(id: string) {
  const props = { size: 16, strokeWidth: 1.5, 'aria-hidden': true as const };
  switch (id) {
    case 'dashboard':
      return <LayoutDashboard {...props} />;
    case 'profile':
      return <Building2 {...props} />;
    case 'team':
      return <Users {...props} />;
    case 'roadmap':
      return <Compass {...props} />;
    case 'idea-validation':
      return <Lightbulb {...props} />;
    case 'customer-research':
      return <MessageSquareText {...props} />;
    case 'market-analysis':
      return <PieChart {...props} />;
    case 'cofounders':
      return <Handshake {...props} />;
    case 'projects':
      return <KanbanSquare {...props} />;
    case 'prototype-testing':
      return <FlaskConical {...props} />;
    case 'sales':
      return <TrendingUp {...props} />;
    case 'analytics':
      return <BarChart3 {...props} />;
    case 'hiring':
      return <UserPlus {...props} />;
    case 'data-room':
      return <FolderKanban {...props} />;
    default:
      return <Briefcase {...props} />;
  }
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function StartupShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { data } = useStartupWorkspace();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen]);

  const currentStageDef =
    data.stages.find((s) => s.id === data.startup.currentStage) ||
    data.stages[0];

  const activeNavItem = ALL_STARTUP_NAV_ITEMS.find(
    (item) => pathname === item.href || (item.id === 'roadmap' && pathname.startsWith('/startup/stage/'))
  );
  const stageSlug = pathname.startsWith('/startup/stage/') ? pathname.split('/').pop() : undefined;
  const stageBreadcrumb = stageSlug ? data.stages.find((stage) => stage.id === stageSlug)?.label : undefined;
  const currentBreadcrumb =
    pathname === '/startup/settings'
      ? 'Settings'
      : stageBreadcrumb
      ? `${stageBreadcrumb} Toolkit`
      : activeNavItem?.label || 'Dashboard';

  const renderSidebarContents = (isMobile = false) => (
    <>
      <div className={styles.sidebarHeader}>
        <BrandLogo variant="ivory" />
        {isMobile && (
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className={styles.drawerCloseBtn}
            aria-label="Close navigation menu"
          >
            <X size={18} strokeWidth={1.5} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className={styles.workspaceTag}>
        <div className={styles.workspaceTagInfo}>
          <span className={styles.workspaceStartupName}>
            {data.startup.name}
          </span>
          <span className={styles.workspaceSub}>Startup Workspace</span>
        </div>
        <span className={styles.workspaceStageDot}>
          {currentStageDef.label}
        </span>
      </div>

      <nav className={styles.navScroll} aria-label="Startup workspace modules">
        {STARTUP_NAV_GROUPS.map((group) => (
          <div key={group.id} className={styles.navGroup}>
            <span className={styles.navGroupLabel}>{group.label}</span>
            {group.items.map((item) => {
              const isActive = pathname === item.href || (item.id === 'roadmap' && pathname.startsWith('/startup/stage/'));
              const isStageRecommended =
                item.recommendedStage === data.startup.currentStage;

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`${styles.navLink} ${
                    isActive ? styles.navLinkActive : ''
                  }`}
                >
                  {getNavIcon(item.id)}
                  <span>{item.label}</span>
                  {isStageRecommended && !isActive && (
                    <span
                      className={styles.stageHint}
                      title={`Recommended for ${currentStageDef.label} stage`}
                      aria-hidden="true"
                    />
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className={styles.sidebarFooter}>
        <Link
          href="/startup/settings"
          aria-current={pathname === '/startup/settings' ? 'page' : undefined}
          className={`${styles.navLink} ${
            pathname === '/startup/settings' ? styles.navLinkActive : ''
          }`}
        >
          <Settings size={16} strokeWidth={1.5} aria-hidden="true" />
          <span>Settings</span>
        </Link>

        <Link href="/" className={styles.navLink}>
          <LogOut size={16} strokeWidth={1.5} aria-hidden="true" />
          <span>Sign out</span>
        </Link>
      </div>
    </>
  );

  return (
    <div className={styles.appFrame}>
      {/* Permanent Desktop Sidebar */}
      <aside className={styles.sidebar}>{renderSidebarContents(false)}</aside>

      {/* Mobile Slide-Over Sidebar */}
      {drawerOpen && (
        <div
          className={styles.drawerBackdrop}
          onClick={() => setDrawerOpen(false)}
          role="presentation"
        >
          <aside
            className={styles.mobileDrawer}
            onClick={(e) => e.stopPropagation()}
            aria-label="Mobile navigation"
          >
            {renderSidebarContents(true)}
          </aside>
        </div>
      )}

      {/* Right Column: Top Bar + Scrollable Content */}
      <div className={styles.contentColumn}>
        <header className={styles.topBar}>
          <div className={styles.topBarLeft}>
            <button
              type="button"
              className={styles.menuButton}
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu size={18} strokeWidth={1.5} aria-hidden="true" />
            </button>

            <div className={styles.breadcrumbs} aria-label="Breadcrumb">
              <span>Startup Workspace</span>
              <span aria-hidden="true">/</span>
              <span className={styles.breadcrumbCurrent}>
                {currentBreadcrumb}
              </span>
            </div>
          </div>

          <div className={styles.topBarRight}>
            {data.isMockData && (
              <span
                className={styles.mockNoticePill}
                title="Displaying illustrative mock JSON data until backend APIs are connected."
              >
                <FileSpreadsheet size={13} strokeWidth={1.5} aria-hidden="true" />
                <span>Mock data</span>
              </span>
            )}

            <Link
              href="/dashboard?role=Mentor"
              className={styles.switchRoleLink}
              title="Switch active account role"
            >
              <ArrowLeftRight size={13} strokeWidth={1.5} aria-hidden="true" />
              <span>Switch role</span>
            </Link>

            <button
              type="button"
              className={styles.iconBtn}
              onClick={toggleTheme}
              aria-label={
                theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'
              }
              title={theme === 'light' ? 'Dark mode' : 'Light mode'}
            >
              {theme === 'light' ? (
                <Moon size={16} strokeWidth={1.5} aria-hidden="true" />
              ) : (
                <Sun size={16} strokeWidth={1.5} aria-hidden="true" />
              )}
            </button>

            <div className={styles.avatarBadge}>
              <span className={styles.avatarInitials}>
                {getInitials(data.startup.founderName)}
              </span>
              <span className={styles.avatarName}>
                {data.startup.founderName}
              </span>
            </div>
          </div>
        </header>

        <main className={styles.mainScroll}>{children}</main>
      </div>
    </div>
  );
}
