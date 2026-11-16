'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import JobSeekerSidebar from './jobseeker-sidebar';
import JobSeekerHeader from './jobseeker-header';
import PageHeader from './page-header';
import SubNavTabs from './sub-nav-tabs';
import { Toast } from './ui';
import { LayoutDashboard, Search, Briefcase, MessageCircle, Menu } from 'lucide-react';
import RoleGuard from './role-guard';

export default function JobSeekerShell({
  active,
  module,
  title,
  description,
  actions,
  subNav,
  children,
  backHref = '/jobseeker/dashboard',
  backLabel = '← Dashboard',
  mainId = 'jobseeker-main',
  contentClassName = '',
}) {
  const pathname = usePathname();
  const [compact, setCompact] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toast, setToast] = useState('');

  const notify = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2700);
  };

  const mobileNavItems = [
    { label: 'Dashboard', href: '/jobseeker/dashboard', icon: LayoutDashboard },
    { label: 'Jobs', href: '/jobseeker/jobs', icon: Search },
    { label: 'Applications', href: '/jobseeker/applications', icon: Briefcase },
    { label: 'Messages', href: '/jobseeker/messages', icon: MessageCircle },
  ];

  return (
    <RoleGuard role="jobseeker">
    <div className="min-h-screen bg-[#FAF8F4] text-[#0F1B2D]">
      <a href={`#${mainId}`} className="sr-only focus:not-sr-only">
        Skip to content
      </a>

      {/* Reusable Job Seeker Sidebar (Desktop & Drawer) */}
      <JobSeekerSidebar
        active={active}
        compact={compact}
        setCompact={setCompact}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        onAction={notify}
      />

      {/* Reusable Job Seeker Top Header */}
      <JobSeekerHeader
        compact={compact}
        onToggleMobile={() => setMobileOpen(!mobileOpen)}
        onAction={notify}
        backHref={backHref}
        backLabel={backLabel}
      />

      {/* Main Content Area */}
      <main
        id={mainId}
        className={`mx-auto max-w-[1440px] px-4 pb-24 pt-7 transition-[margin] duration-200 sm:px-7 lg:px-8 ${
          compact ? 'lg:ml-[76px]' : 'lg:ml-[240px]'
        } ${contentClassName}`}
      >
        {subNav && <SubNavTabs items={subNav} />}

        {(title || actions) && (
          <PageHeader
            module={module || 'Forma Careers'}
            title={title}
            description={description}
            actions={actions}
          />
        )}

        {typeof children === 'function' ? children({ notify, compact, toast }) : children}
      </main>

      {/* Mobile Bottom Quick Navigation Bar (< 1024px) */}
      <nav
        aria-label="Mobile quick navigation"
        className="fixed bottom-0 left-0 right-0 z-30 flex h-16 items-center justify-around border-t border-[#E5E1D8] bg-[#FAF8F4]/98 px-2 backdrop-blur lg:hidden"
      >
        {mobileNavItems.map(({ label, href, icon: IconComponent }) => {
          const isActive =
            pathname === href || (href !== '/jobseeker/dashboard' && pathname?.startsWith(href));
          return (
            <Link
              key={label}
              href={href}
              className={`flex flex-col items-center gap-1 p-1 text-xs font-medium transition-colors ${
                isActive ? 'text-[#B8955A] font-semibold' : 'text-[#4A5568] hover:text-ink'
              }`}
            >
              <IconComponent size={18} />
              <span>{label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex flex-col items-center gap-1 p-1 text-xs font-medium text-[#4A5568] hover:text-ink transition-colors"
          aria-label="Open full menu"
        >
          <Menu size={18} />
          <span>Menu</span>
        </button>
      </nav>

      {/* Shared Toast */}
      {toast && <Toast message={toast} />}
    </div>
    </RoleGuard>
  );
}
