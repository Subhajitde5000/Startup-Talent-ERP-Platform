'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Briefcase,
  Users,
  CalendarDays,
  Mail,
  Award,
  FileText,
  BarChart3,
  Shield,
  Activity,
  Banknote,
  Settings,
  CircleHelp,
  ChevronDown,
  ChevronRight,
  X,
  Check,
  UserCheck,
  MessageSquare,
} from 'lucide-react';

export const EMPLOYER_NAV_ITEMS = [
  ['Dashboard', LayoutDashboard, '/employer/dashboard'],
  ['Hiring', Briefcase, '/employer/hiring'],
  ['Candidates', UserCheck, '/employer/candidates'],
  ['Talent', Users, '/employer/talent'],
  ['Interviews', CalendarDays, '/employer/interviews'],
  ['Offers', Mail, '/employer/offers'],
  ['Hires', Award, '/employer/hires'],
  ['Templates', FileText, '/employer/templates'],
  ['Analytics', BarChart3, '/employer/analytics'],
  ['Community', MessageSquare, '/employer/community'],
  ['Trust & Safety', Shield, '/employer/trust'],
  ['Activity Log', Activity, '/employer/activity'],
  ['Billing & Plans', Banknote, '/employer/billing'],
];

const ROLES = [
  { name: 'Employer', path: '/employer/dashboard', desc: 'Current active role', current: true },
  { name: 'Startup Founder', path: '/startup/dashboard', desc: 'Forma Founder workspace' },
  { name: 'Investor', path: '/investor/dashboard', desc: 'Dealflow & Portfolio' },
  { name: 'Mentor', path: '/mentor/dashboard', desc: 'Advisory & Impact' },
  { name: 'Job Seeker', path: '/jobseeker/dashboard', desc: 'Opportunities & Profiles' },
];

export default function EmployerSidebar({
  jobsWorkspace,
  active,
  activeNav,
  compact = false,
  setCompact,
  collapsed,
  onToggleCollapse,
  mobileOpen = false,
  setMobileOpen,
  onMobileClose,
  onAction,
}) {
  const pathname = usePathname();
  const roles = jobsWorkspace ? ROLES.filter(r => jobsWorkspace.user?.roles?.includes(r.path.split("/")[1]) || jobsWorkspace.user?.organizations?.some(o => (o.type || o.membership_type) === r.path.split("/")[1])) : ROLES;
  const [localCompact, setLocalCompact] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);

  // Normalize compact state from either compact/setCompact or collapsed/onToggleCollapse
  const isCompact = compact !== undefined ? compact : (collapsed !== undefined ? collapsed : localCompact);
  const handleToggleCompact = setCompact || onToggleCollapse || setLocalCompact;
  const handleMobileClose = () => {
    if (setMobileOpen) setMobileOpen(false);
    if (onMobileClose) onMobileClose();
  };

  const getActiveFromPath = () => {
    if (!pathname) return 'Dashboard';
    if (pathname.startsWith('/employer/hiring') || pathname.startsWith('/employer/jobs') || pathname.startsWith('/employer/requests')) return 'Hiring';
    if (pathname.startsWith('/employer/talent')) return 'Talent';
    if (pathname.startsWith('/employer/interviews')) return 'Interviews';
    if (pathname.startsWith('/employer/offers')) return 'Offers';
    if (pathname.startsWith('/employer/hires')) return 'Hires';
    if (pathname.startsWith('/employer/templates')) return 'Templates';
    if (pathname.startsWith('/employer/analytics')) return 'Analytics';
    if (pathname.startsWith('/employer/community') || pathname.startsWith('/community')) return 'Community';
    if (pathname.startsWith('/employer/trust')) return 'Trust & Safety';
    if (pathname.startsWith('/employer/activity')) return 'Activity Log';
    if (pathname.startsWith('/employer/billing')) return 'Billing & Plans';
    return 'Dashboard';
  };

  const resolvedActive = active || activeNav;
  const currentActive = resolvedActive
    ? (resolvedActive.startsWith('/') ? getActiveFromPath() : resolvedActive)
    : getActiveFromPath();

  const handleAction = (msg) => {
    if (onAction) onAction(msg);
  };

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden flex-col bg-[#0F1B2D] text-white transition-all duration-200 lg:flex ${
          isCompact ? 'w-[76px]' : 'w-[240px]'
        }`}
      >
        {/* Workspace Brand Header */}
        <div
          className={`flex h-[76px] items-center border-b border-white/10 ${
            isCompact ? 'justify-center' : 'gap-3 px-6'
          }`}
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/30 font-serif text-lg bg-[#FAF8F4]/10 text-white font-bold">
            N
          </span>
          {!isCompact && (
            <div className="flex flex-col min-w-0">
              <span className="font-serif text-base font-semibold tracking-wide text-white truncate">
                forma
              </span>
              <span className="text-xs font-medium tracking-wider text-white/50 truncate">
                EMPLOYER WORKSPACE
              </span>
            </div>
          )}
        </div>

        {/* Primary Navigation Links */}
        <nav
          aria-label="Employer primary navigation"
          className="mentor-sidebar-scrollbar mt-4 flex-1 space-y-1 overflow-y-auto px-3"
        >
          {EMPLOYER_NAV_ITEMS.map(([label, IconComponent, href]) => {
            const isActive = currentActive.toLowerCase() === label.toLowerCase();
            return (
              <Link
                key={label}
                href={jobsWorkspace && label === "Hiring" ? jobsWorkspace.href(href) : href}
                title={isCompact ? label : undefined}
                className={`group relative flex h-10 items-center rounded-lg text-xs font-medium transition-colors ${
                  isCompact ? 'justify-center px-0' : 'gap-3 px-3'
                } ${
                  isActive
                    ? 'bg-[#1C2B42] text-white font-semibold'
                    : 'text-white/70 hover:bg-white/5 hover:text-white'
                }`}
              >
                {isActive && (
                  <span className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r bg-[#B8955A]" />
                )}
                <IconComponent
                  size={18}
                  className={`shrink-0 transition-colors ${
                    isActive ? 'text-[#B8955A]' : 'text-white/60 group-hover:text-white'
                  }`}
                />
                {!isCompact && <span className="truncate">{label}</span>}
                {!isCompact && !jobsWorkspace && label === 'Hiring' && (
                  <span className="ml-auto rounded-full bg-[#B8955A] px-1.5 py-0.5 text-xs font-bold text-[#0F1B2D]">
                    4
                  </span>
                )}
                {!isCompact && !jobsWorkspace && label === 'Interviews' && (
                  <span className="ml-auto rounded-full bg-white/15 px-1.5 py-0.5 text-xs font-bold text-white">
                    2
                  </span>
                )}
                {!isCompact && !jobsWorkspace && label === 'Offers' && (
                  <span className="ml-auto rounded-full bg-white/15 px-1.5 py-0.5 text-xs font-bold text-white">
                    1
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Compact Toggle Button */}
        <div className="border-t border-white/10 px-3 py-2">
          <button
            type="button"
            onClick={() => handleToggleCompact(!isCompact)}
            className={`flex h-8 w-full items-center rounded-lg text-xs text-white/50 hover:bg-white/5 hover:text-white ${
              isCompact ? 'justify-center' : 'justify-between px-3'
            }`}
            title={isCompact ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isCompact ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {!isCompact && <span>Collapse sidebar</span>}
            <ChevronRight
              size={15}
              className={`transition-transform duration-200 ${isCompact ? '' : 'rotate-180'}`}
            />
          </button>
        </div>

        {/* Footer Utilities */}
        <div className="space-y-1 border-t border-white/10 px-3 pb-5 pt-3">
          <Link
            href="/employer/trust"
            title={isCompact ? 'Trust & Settings' : undefined}
            className={`flex h-10 items-center rounded-lg text-xs font-medium transition-colors ${
              isCompact ? 'justify-center px-0' : 'gap-3 px-3'
            } ${
              currentActive === 'Trust & Safety'
                ? 'bg-[#1C2B42] text-white'
                : 'text-white/60 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Settings size={17} className="shrink-0" />
            {!isCompact && <span>Trust & Settings</span>}
          </Link>

          <Link
            href="/help"
            title={isCompact ? 'Help & support' : undefined}
            className={`flex h-10 items-center rounded-lg text-xs font-medium text-white/60 transition-colors hover:bg-white/5 hover:text-white ${
              isCompact ? 'justify-center px-0' : 'gap-3 px-3'
            }`}
          >
            <CircleHelp size={17} className="shrink-0" />
            {!isCompact && <span>Help & support</span>}
          </Link>

          {/* User Card with Role Switcher Dropdown */}
          <div className="relative pt-2">
            <button
              type="button"
              onClick={() => setRoleMenuOpen(!roleMenuOpen)}
              className={`flex w-full items-center rounded-lg border border-white/10 p-2 text-left transition-colors hover:bg-white/5 ${
                isCompact ? 'justify-center' : 'gap-3'
              }`}
              aria-expanded={roleMenuOpen}
              aria-label="User role switcher menu"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#F3EBDD] text-xs font-bold text-[#0F1B2D]">
                {jobsWorkspace ? jobsWorkspace.user?.avatar_initials || jobsWorkspace.user?.display_name?.slice(0, 2).toUpperCase() || "U" : "SJ"}
              </span>
              {!isCompact && (
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-white">
                    {jobsWorkspace ? jobsWorkspace.user?.display_name || "Your account" : "Sarah Jenkins"}
                  </span>
                  <span className="block truncate text-xs text-white/50">
                    {jobsWorkspace ? `${jobsWorkspace.org?.my_role || "Member"} · Switch role` : "Employer · Switch role"}
                  </span>
                </div>
              )}
              {!isCompact && <ChevronDown size={14} className="shrink-0 text-white/50" />}
            </button>

            {roleMenuOpen && (
              <div className="absolute bottom-full left-0 z-50 mb-2 w-56 rounded-xl border border-white/15 bg-[#1C2B42] p-2 shadow-2xl">
                <div className="px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-white/40">
                  Switch Active Role
                </div>
                {roles.map((role) => (
                  <Link
                    key={role.name}
                    href={role.path}
                    onClick={() => setRoleMenuOpen(false)}
                    className={`flex items-center justify-between rounded-lg px-2.5 py-2 text-xs transition-colors ${
                      role.current
                        ? 'bg-white/15 text-white font-semibold'
                        : 'text-white/80 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <div>
                      <div className="font-medium">{role.name}</div>
                      <div className="text-xs text-white/50">{role.desc}</div>
                    </div>
                    {role.current && <Check size={14} className="text-[#B8955A]" />}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile & Tablet Drawer (< 1024px) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={handleMobileClose}
            aria-hidden="true"
          />

          {/* Drawer content */}
          <div className="relative z-10 flex w-72 max-w-[85vw] flex-col bg-[#0F1B2D] text-white shadow-2xl">
            <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
              <div className="flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-full border border-white/30 font-serif text-base bg-[#FAF8F4]/10 text-white font-bold">
                  N
                </span>
                <span className="font-serif text-base font-semibold">forma · EMPLOYER</span>
              </div>
              <button
                type="button"
                onClick={handleMobileClose}
                className="grid h-8 w-8 place-items-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
                aria-label="Close navigation menu"
              >
                <X size={18} />
              </button>
            </div>

            <nav
              aria-label="Mobile employer navigation"
              className="mentor-sidebar-scrollbar flex-1 space-y-1 overflow-y-auto p-3"
            >
              {EMPLOYER_NAV_ITEMS.map(([label, IconComponent, href]) => {
                const isActive = currentActive.toLowerCase() === label.toLowerCase();
                return (
                  <Link
                    key={label}
                    href={jobsWorkspace && label === "Hiring" ? jobsWorkspace.href(href) : href}
                    onClick={handleMobileClose}
                    className={`flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-[#1C2B42] text-white font-semibold'
                        : 'text-white/75 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <IconComponent
                      size={18}
                      className={isActive ? 'text-[#B8955A]' : 'text-white/60'}
                    />
                    <span>{label}</span>
                    {!jobsWorkspace && label === 'Hiring' && (
                      <span className="ml-auto rounded-full bg-[#B8955A] px-2 py-0.5 text-xs font-bold text-[#0F1B2D]">
                        4
                      </span>
                    )}
                    {!jobsWorkspace && label === 'Interviews' && (
                      <span className="ml-auto rounded-full bg-white/15 px-2 py-0.5 text-xs font-bold text-white">
                        2
                      </span>
                    )}
                    {!jobsWorkspace && label === 'Offers' && (
                      <span className="ml-auto rounded-full bg-white/15 px-2 py-0.5 text-xs font-bold text-white">
                        1
                      </span>
                    )}
                  </Link>
                );
              })}

              <div className="my-3 border-t border-white/10" />

              <Link
                href="/employer/trust"
                onClick={handleMobileClose}
                className={`flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${
                  currentActive === 'Trust & Safety'
                    ? 'bg-[#1C2B42] text-white'
                    : 'text-white/75 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Settings size={18} />
                <span>Trust & Settings</span>
              </Link>
              <Link
                href="/help"
                onClick={handleMobileClose}
                className="flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-white/75 hover:bg-white/5 hover:text-white"
              >
                <CircleHelp size={18} />
                <span>Help & support</span>
              </Link>
            </nav>

            {/* Mobile User Card & Role Switcher */}
            <div className="border-t border-white/10 p-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
                Switch Role
              </div>
              <div className="grid grid-cols-2 gap-2">
                {roles.map((r) => (
                  <Link
                    key={r.name}
                    href={r.path}
                    onClick={handleMobileClose}
                    className={`flex items-center gap-1.5 rounded-lg p-2 text-xs transition-colors ${
                      r.current
                        ? 'bg-white/20 text-white font-semibold'
                        : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span className="truncate">{r.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
