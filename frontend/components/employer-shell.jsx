'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Briefcase,
  Users,
  CalendarDays,
  Menu,
} from 'lucide-react';
import EmployerSidebar from './employer-sidebar';
import EmployerHeader from './employer-header';
import RoleGuard from './role-guard';

export default function EmployerShell({
  children,
  active,
  activeNav,
  className = '',
  contentClassName = '',
  mainId = 'employer-main',
  backHref,
  backLabel,
}) {
  const [compact, setCompact] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const currentActive = active || activeNav;

  const mobileNavItems = [
    { label: 'Dashboard', href: '/employer/dashboard', icon: LayoutDashboard },
    { label: 'Hiring', href: '/employer/hiring', icon: Briefcase },
    { label: 'Talent', href: '/employer/talent', icon: Users },
    { label: 'Interviews', href: '/employer/interviews', icon: CalendarDays },
  ];

  return (
    <RoleGuard role="employer">
    <div className="min-h-screen bg-[#FAF8F4] text-[#0F1B2D] overflow-x-hidden relative">
      {/* Skip to Main Content Link for Accessibility (WCAG 2.1) */}
      <a
        href={`#${mainId}`}
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-xl focus:bg-[#0F1B2D] focus:px-4 focus:py-2 focus:text-xs focus:font-semibold focus:text-white"
      >
        Skip to main content
      </a>

      {/* Reusable Employer Sidebar (Desktop & Mobile Drawer) */}
      <EmployerSidebar
        active={currentActive}
        activeNav={currentActive}
        compact={compact}
        setCompact={setCompact}
        collapsed={compact}
        onToggleCollapse={() => setCompact(!compact)}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* Top Header with matching responsive margin offset */}
      <EmployerHeader
        compact={compact}
        onToggleMobile={() => setMobileOpen(!mobileOpen)}
        onOpenMobileNav={() => setMobileOpen(true)}
        backHref={backHref}
        backLabel={backLabel}
      />

      {/* Main Content Area - exact responsive margin offset prevents content going behind sidebar */}
      <main
        id={mainId}
        className={`mx-auto max-w-[1440px] px-4 pb-24 pt-7 transition-[margin] duration-200 sm:px-7 lg:px-8 min-w-0 ${
          compact ? 'lg:ml-[76px]' : 'lg:ml-[240px]'
        } ${contentClassName || className}`}
      >
        {children}
      </main>

      {/* Mobile Bottom Quick-Navigation Bar (< 1024px) */}
      <nav
        aria-label="Mobile quick navigation"
        className="fixed bottom-0 left-0 right-0 z-30 flex h-16 items-center justify-around border-t border-[#E5E1D8] bg-[#FAF8F4]/98 px-2 backdrop-blur lg:hidden"
      >
        {mobileNavItems.map(({ label, href, icon: IconComponent }) => {
          const isActive =
            pathname === href ||
            (href !== '/employer/dashboard' && pathname?.startsWith(href));
          return (
            <Link
              key={label}
              href={href}
              className={`flex flex-col items-center gap-1 p-1 text-xs font-medium transition-colors ${
                isActive ? 'text-[#B8955A] font-semibold' : 'text-[#4A5568] hover:text-[#0F1B2D]'
              }`}
            >
              <IconComponent size={19} className={isActive ? 'text-[#B8955A]' : 'text-[#4A5568]'} />
              <span>{label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex flex-col items-center gap-1 p-1 text-xs font-medium text-[#4A5568] hover:text-[#0F1B2D]"
          aria-label="Open full menu"
        >
          <Menu size={19} />
          <span>Menu</span>
        </button>
      </nav>
    </div>
    </RoleGuard>
  );
}
