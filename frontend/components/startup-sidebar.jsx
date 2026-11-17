'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Compass,
  ListTodo,
  Users,
  FolderLock,
  Lightbulb,
  Briefcase,
  ChartNoAxesColumn,
  Settings,
  CircleHelp,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  X,
  Building2,
  MessageSquare,
} from 'lucide-react';

export const STARTUP_NAV_ITEMS = [
  ['Dashboard', LayoutDashboard, '/startup/dashboard'],
  ['Stage toolkit', Compass, '/startup/stage'],
  ['Tasks & milestones', ListTodo, '/startup/tasks'],
  ['Team', Users, '/startup/team'],
  ['Startup profile', Building2, '/startup/profile'],
  ['Documents', FolderLock, '/startup/data-room'],
  ['Mentor', Lightbulb, '/startup/mentors'],
  ['Investors', Briefcase, '/startup/investors'],
  ['Hiring', Briefcase, '/startup/hiring'],
  ['Community', MessageSquare, '/startup/community'],
  ['Analytics', ChartNoAxesColumn, '/startup/analytics'],
];

export default function StartupSidebar({
  active,
  compact,
  setCompact,
  mobileOpen = false,
  setMobileOpen,
  onAction,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [localCompact, setLocalCompact] = useState(false);

  const isCompact = compact !== undefined ? compact : localCompact;
  const handleToggleCompact = setCompact || setLocalCompact;

  const getActiveFromPath = () => {
    if (!pathname) return 'Dashboard';
    if (pathname.startsWith('/startup/stage')) return 'Stage toolkit';
    if (pathname.startsWith('/startup/tasks')) return 'Tasks & milestones';
    if (pathname.startsWith('/startup/team')) return 'Team';
    if (pathname.startsWith('/startup/user-profile') || pathname.startsWith('/startup/founder-profile')) return 'Founder Profile';
    if (pathname.startsWith('/startup/profile')) return 'Startup profile';
    if (pathname.startsWith('/startup/data-room')) return 'Documents';
    if (
      pathname.startsWith('/startup/mentors') ||
      pathname.startsWith('/startup/sessions') ||
      pathname.startsWith('/startup/readiness')
    ) {
      return 'Mentor';
    }
    if (
      pathname.startsWith('/startup/investors') ||
      pathname.startsWith('/startup/rounds') ||
      pathname.startsWith('/startup/meetings') ||
      pathname.startsWith('/startup/messages')
    ) {
      return 'Investors';
    }
    if (pathname.startsWith('/startup/hiring')) return 'Hiring';
    if (pathname.startsWith('/startup/community') || pathname.startsWith('/community')) return 'Community';
    if (pathname.startsWith('/startup/analytics')) return 'Analytics';
    return 'Dashboard';
  };

  const currentActive = active || getActiveFromPath();

  const handleAction = (msg) => {
    if (onAction) {
      onAction(msg);
    }
  };

  return (
    <>
      {/* Desktop Sidebar */}
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
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/30 font-serif text-lg">
            F
          </span>
          {!isCompact && (
            <div className="flex items-baseline gap-1.5 font-bold tracking-tight">
              <span>forma</span>
              <span className="text-[10px] font-normal tracking-[0.16em] text-white/50">
                WORKSPACE
              </span>
            </div>
          )}
        </div>

        {/* Section Label */}
        {!isCompact && (
          <p className="px-6 pb-2 pt-5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
            Startup
          </p>
        )}

        {/* Navigation Items */}
        <nav className={`startup-sidebar-scrollbar flex-1 overflow-y-auto space-y-1 ${isCompact ? 'px-2 pt-4' : 'px-3'}`}>
          {STARTUP_NAV_ITEMS.map(([label, Icon, url]) => {
            const isActive = label === currentActive;
            return (
              <Link
                key={label}
                href={url}
                title={isCompact ? label : undefined}
                className={`relative flex h-11 items-center gap-3 rounded-lg text-[13px] font-medium transition ${
                  isCompact ? 'justify-center px-0' : 'px-3'
                } ${
                  isActive
                    ? 'bg-[#1C2B42] text-white'
                    : 'text-white/65 hover:bg-white/5 hover:text-white'
                }`}
              >
                {isActive && (
                  <span className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r bg-[#B8955A]" />
                )}
                <Icon size={18} className="shrink-0" />
                {!isCompact && <span>{label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Collapse Button */}
        <div className="px-3 pt-3">
          <button
            type="button"
            onClick={() => handleToggleCompact(!isCompact)}
            className={`flex h-9 w-full items-center gap-3 rounded-lg text-xs text-white/50 hover:bg-white/5 hover:text-white ${
              isCompact ? 'justify-center px-0' : 'px-3'
            }`}
            title={isCompact ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isCompact ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ChevronRight
              size={16}
              className={`transition-transform duration-200 ${
                isCompact ? 'rotate-0' : 'rotate-180'
              }`}
            />
            {!isCompact && <span>Collapse sidebar</span>}
          </button>
        </div>

        {/* Bottom Actions & User Profile */}
        <div className="mt-auto space-y-1 px-3 pb-5">
          <button
            type="button"
            onClick={() => router.push('/startup/settings')}
            className={`flex h-11 w-full items-center gap-3 rounded-lg text-sm text-white/60 hover:bg-white/5 hover:text-white ${
              isCompact ? 'justify-center px-0' : 'px-3'
            }`}
            title={isCompact ? 'Settings' : undefined}
          >
            <Settings size={18} className="shrink-0" />
            {!isCompact && <span>Settings</span>}
          </button>
          <button
            type="button"
            onClick={() => handleAction('Help and support will be available soon.')}
            className={`flex h-11 w-full items-center gap-3 rounded-lg text-sm text-white/60 hover:bg-white/5 hover:text-white ${
              isCompact ? 'justify-center px-0' : 'px-3'
            }`}
            title={isCompact ? 'Help & support' : undefined}
          >
            <CircleHelp size={18} className="shrink-0" />
            {!isCompact && <span>Help & support</span>}
          </button>

          {/* User Account Capsule */}
          <Link
            href="/startup/user-profile"
            title="My Founder Profile"
            className={`mt-2 flex items-center rounded-lg border border-white/10 hover:border-[#B8955A] hover:bg-white/5 transition ${
              isCompact ? 'justify-center p-2' : 'gap-3 p-3'
            }`}
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#F3EBDD] text-xs font-bold text-ink">
              AK
            </span>
            {!isCompact && (
              <div className="min-w-0 flex-1">
                <b className="block truncate text-xs text-white">Aarav Kapoor</b>
                <small className="block truncate text-[11px] text-white/50">
                  Founder Personal Profile →
                </small>
              </div>
            )}
          </Link>
        </div>
      </aside>

      {/* Mobile Drawer (Responsive < 1024px) */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#0F1B2D]/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen && setMobileOpen(false)}
        >
          <aside
            className="absolute inset-y-0 left-0 w-[270px] bg-[#0F1B2D] p-5 text-white shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Header */}
            <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5 font-bold">
                <span className="grid h-8 w-8 place-items-center rounded-full border border-white/30 font-serif">
                  F
                </span>
                <span>forma · Startup</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen && setMobileOpen(false)}
                className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
                aria-label="Close navigation"
              >
                <X size={18} />
              </button>
            </div>

            {/* Mobile Nav Links */}
            <nav className="startup-sidebar-scrollbar flex-1 space-y-1 overflow-y-auto">
              {STARTUP_NAV_ITEMS.map(([label, Icon, url]) => {
                const isActive = label === currentActive;
                return (
                  <Link
                    key={label}
                    href={url}
                    onClick={() => setMobileOpen && setMobileOpen(false)}
                    className={`flex h-11 items-center gap-3 rounded-lg px-3 text-sm transition ${
                      isActive
                        ? 'bg-[#1C2B42] font-semibold text-white'
                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Icon size={18} />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Mobile Footer */}
            <div className="border-t border-white/10 pt-4 mt-auto">
              <Link
                href="/startup/user-profile"
                onClick={() => setMobileOpen && setMobileOpen(false)}
                className="flex items-center gap-3 rounded-lg border border-white/10 p-2.5 hover:border-[#B8955A] hover:bg-white/5 transition"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#F3EBDD] text-xs font-bold text-ink">
                  AK
                </span>
                <div className="min-w-0 flex-1">
                  <b className="block truncate text-xs text-white">Aarav Kapoor</b>
                  <small className="block truncate text-[11px] text-white/50">Founder Personal Profile →</small>
                </div>
              </Link>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
