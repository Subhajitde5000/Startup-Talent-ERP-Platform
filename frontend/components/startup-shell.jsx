'use client';
import { useState } from 'react';
import StartupSidebar from './startup-sidebar';
import StartupHeader from './startup-header';
import PageHeader from './page-header';
import SubNavTabs from './sub-nav-tabs';
import { Toast } from './ui';
import RoleGuard from './role-guard';

export default function StartupShell({
  active,
  module,
  title,
  description,
  actions,
  subNav,
  children,
  backHref = '/startup/dashboard',
  backLabel = '← Dashboard',
  mainId = 'main-content',
  contentClassName = '',
}) {
  const [compact, setCompact] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toast, setToast] = useState('');

  const notify = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2700);
  };

  return (
    <RoleGuard role="startup">
    <div className="min-h-screen bg-[#FAF8F4] text-[#0F1B2D]">
      <a href={`#${mainId}`} className="sr-only focus:not-sr-only">
        Skip to content
      </a>

      <StartupSidebar
        active={active}
        compact={compact}
        setCompact={setCompact}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        onAction={notify}
      />

      <StartupHeader
        compact={compact}
        onToggleMobile={() => setMobileOpen(!mobileOpen)}
        onAction={notify}
        backHref={backHref}
        backLabel={backLabel}
      />

      <main
        id={mainId}
        className={`mx-auto max-w-[1440px] px-4 pb-20 pt-7 transition-[margin] duration-200 sm:px-7 lg:px-8 ${
          compact ? 'lg:ml-[76px]' : 'lg:ml-[240px]'
        } ${contentClassName}`}
      >
        {subNav && <SubNavTabs items={subNav} />}

        {(title || actions) && (
          <PageHeader
            module={module || active}
            title={title}
            description={description}
            actions={actions}
          />
        )}

        {typeof children === 'function' ? children({ notify, compact, toast }) : children}
      </main>

      <Toast message={toast} />
    </div>
    </RoleGuard>
  );
}
