'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Search,
  Bookmark,
  Bell,
  Building2,
  Briefcase,
  CalendarDays,
  Award,
  FileText,
  Mic,
  Sparkles,
  MessageCircle,
  Settings,
  CircleHelp,
  ChevronDown,
  ChevronRight,
  X,
  Check,
  MessageSquare,
} from 'lucide-react';

export const JOBSEEKER_NAV_ITEMS = [
  ['Dashboard', LayoutDashboard, '/jobseeker/dashboard'],
  ['Jobs', Search, '/jobseeker/jobs'],
  ['Saved jobs', Bookmark, '/jobseeker/saved'],
  ['Job alerts', Bell, '/jobseeker/alerts'],
  ['Startups', Building2, '/jobseeker/startups'],
  ['Applications', Briefcase, '/jobseeker/applications'],
  ['Interviews', CalendarDays, '/jobseeker/interviews'],
  ['Offers', Award, '/jobseeker/offers'],
  ['Resumes', FileText, '/jobseeker/resumes'],
  ['Interview practice', Mic, '/jobseeker/practice'],
  ['Readiness', Sparkles, '/jobseeker/readiness'],
  ['Messages', MessageCircle, '/jobseeker/messages'],
  ['Community', MessageSquare, '/jobseeker/community'],
];

const ROLES = [
  { name: 'Job Seeker', path: '/jobseeker/dashboard', desc: 'Careers & Opportunities', current: true },
  { name: 'Startup Founder', path: '/startup/dashboard', desc: 'Forma Founder workspace' },
  { name: 'Mentor', path: '/mentor/dashboard', desc: 'Advisory & Sessions' },
  { name: 'Investor', path: '/investor/dashboard', desc: 'Dealflow & Portfolio' },
  { name: 'Employer', path: '/employer/dashboard', desc: 'Talent & Hiring' },
];

export default function JobSeekerSidebar({
  liveData = false,
  active,
  compact = false,
  setCompact,
  mobileOpen = false,
  setMobileOpen,
  onAction,
}) {
  const pathname = usePathname();
  const { user, hasRole } = useAuth();
  const [localCompact, setLocalCompact] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);

  const isCompact = compact !== undefined ? compact : localCompact;
  const handleToggleCompact = setCompact || setLocalCompact;

  const getActiveFromPath = () => {
    if (!pathname) return 'Dashboard';
    if (pathname.startsWith('/jobseeker/jobs') || pathname.startsWith('/jobseeker/companies')) return 'Jobs';
    if (pathname.startsWith('/jobseeker/saved')) return 'Saved jobs';
    if (pathname.startsWith('/jobseeker/alerts')) return 'Job alerts';
    if (pathname.startsWith('/jobseeker/startups')) return 'Startups';
    if (pathname.startsWith('/jobseeker/applications')) return 'Applications';
    if (pathname.startsWith('/jobseeker/interviews')) return 'Interviews';
    if (pathname.startsWith('/jobseeker/offers')) return 'Offers';
    if (pathname.startsWith('/jobseeker/resumes')) return 'Resumes';
    if (pathname.startsWith('/jobseeker/practice')) return 'Interview practice';
    if (pathname.startsWith('/jobseeker/readiness')) return 'Readiness';
    if (pathname.startsWith('/jobseeker/messages')) return 'Messages';
    if (pathname.startsWith('/jobseeker/community') || pathname.startsWith('/community')) return 'Community';
    if (pathname.startsWith('/jobseeker/settings')) return 'Settings';
    return 'Dashboard';
  };

  const currentActive = active || getActiveFromPath();

  const handleAction = (msg) => {
    if (onAction) onAction(msg);
  };

  const renderNavList = (onNavigate) => (
    <nav className="jobseeker-sidebar-scrollbar flex-1 space-y-1 overflow-y-auto px-3 py-2" aria-label="Job Seeker navigation">
      {JOBSEEKER_NAV_ITEMS.map(([name, Icon, href]) => {
        const isCurrent = currentActive === name;
        const badgeCount = liveData ? 0 :
          name === 'Applications' ? 4 :
          name === 'Interviews' ? 2 :
          name === 'Offers' ? 2 :
          name === 'Messages' ? 1 : 0;

        return (
          <Link
            key={name}
            href={href}
            onClick={onNavigate}
            title={isCompact ? name : undefined}
            className={`group relative flex h-10 items-center gap-3 rounded-lg px-3 text-xs font-medium transition-colors ${
              isCurrent
                ? 'bg-[#1C2B42] text-white font-semibold'
                : 'text-white/70 hover:bg-white/10 hover:text-white'
            }`}
          >
            {isCurrent && (
              <span className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r bg-[#B8955A]" />
            )}
            <Icon size={17} className={`shrink-0 ${isCurrent ? 'text-[#B8955A]' : 'text-white/70 group-hover:text-white'}`} />
            {!isCompact && <span className="truncate">{name}</span>}
            {!isCompact && badgeCount > 0 && (
              <span className="ml-auto rounded-full bg-[#B8955A] px-2 py-0.5 text-[10px] font-semibold text-ink">
                {badgeCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  const renderFooter = (onNavigate) => (
    <div className="mt-auto border-t border-white/10 p-3 space-y-1">
      <Link
        href="/jobseeker/settings"
        onClick={onNavigate}
        className={`flex h-10 items-center gap-3 rounded-lg px-3 text-xs text-white/70 hover:bg-white/10 hover:text-white transition-colors ${
          currentActive === 'Settings' ? 'bg-[#1C2B42] text-white font-semibold' : ''
        }`}
      >
        <Settings size={17} />
        {!isCompact && <span>Settings</span>}
      </Link>

      <button
        type="button"
        onClick={() => handleAction(liveData ? 'Help & support is unavailable in this step.' : 'Forma Careers Help Center opened.')}
        className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-xs text-white/70 hover:bg-white/10 hover:text-white transition-colors"
      >
        <CircleHelp size={17} />
        {!isCompact && <span>Help & Support</span>}
      </button>

      {/* Role Switcher */}
      <div className="relative pt-1">
        <button
          type="button"
          onClick={() => setRoleMenuOpen(!roleMenuOpen)}
          aria-expanded={roleMenuOpen}
          aria-haspopup="true"
          className="flex w-full items-center gap-2.5 rounded-lg border border-white/15 bg-white/5 p-2.5 text-left transition hover:bg-white/10"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#F3EBDD] text-xs font-bold text-ink">
            {liveData ? user?.display_name?.slice(0, 2).toUpperCase() : 'AD'}
          </span>
          {!isCompact && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white">{liveData ? user?.display_name : 'Ananya Das'}</p>
              <p className="text-[10px] text-white/60">{liveData ? 'Forma Careers' : 'Product Designer · Forma'}</p>
            </div>
          )}
          {!isCompact && <ChevronDown size={14} className="text-white/60 shrink-0" />}
        </button>

        {roleMenuOpen && (
          <div className="absolute bottom-full left-0 mb-2 w-64 rounded-xl border border-white/15 bg-[#1C2B42] p-2 text-white shadow-xl z-50">
            <p className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/50">
              Switch role
            </p>
            <div className="space-y-1">
              {ROLES.filter(r => !liveData || hasRole(r.path.split('/')[1])).map((r) => (
                <Link
                  key={r.name}
                  href={r.path}
                  onClick={() => {
                    setRoleMenuOpen(false);
                    if (onNavigate) onNavigate();
                  }}
                  className={`flex items-center justify-between rounded-lg p-2 text-xs transition ${
                    r.current ? 'bg-white/15 font-semibold text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <div>
                    <p className="font-medium text-white">{r.name}</p>
                    <p className="text-[10px] text-white/50">{r.desc}</p>
                  </div>
                  {r.current && <Check size={14} className="text-[#B8955A]" />}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden flex-col bg-[#0F1B2D] text-white transition-all duration-200 lg:flex ${
          isCompact ? 'w-[76px]' : 'w-[240px]'
        }`}
      >
        {/* Brand Header */}
        <div className="flex h-[68px] items-center justify-between border-b border-white/10 px-4">
          <Link href="/jobseeker/dashboard" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#B8955A] font-serif font-bold text-ink text-base">
              F
            </span>
            {!isCompact && (
              <div className="flex flex-col">
                <span className="serif text-base font-semibold tracking-wide text-white">forma</span>
                <span className="text-[9px] uppercase tracking-wider text-[#B8955A] font-medium">Careers</span>
              </div>
            )}
          </Link>
          <button
            type="button"
            onClick={() => handleToggleCompact(!isCompact)}
            className="grid h-7 w-7 place-items-center rounded text-white/60 hover:bg-white/10 hover:text-white transition"
            aria-label={isCompact ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCompact ? <ChevronRight size={16} /> : <ChevronDown size={16} className="-rotate-90" />}
          </button>
        </div>

        {renderNavList()}
        {renderFooter()}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-ink/60 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative flex w-full max-w-[280px] flex-col bg-[#0F1B2D] text-white shadow-2xl">
            <div className="flex h-[68px] items-center justify-between border-b border-white/10 px-4">
              <Link
                href="/jobseeker/dashboard"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2.5"
              >
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#B8955A] font-serif font-bold text-ink">
                  F
                </span>
                <div>
                  <span className="serif text-base font-semibold text-white">forma</span>
                  <span className="block text-[9px] uppercase tracking-wider text-[#B8955A]">Careers</span>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
                aria-label="Close navigation drawer"
              >
                <X size={18} />
              </button>
            </div>

            {renderNavList(() => setMobileOpen(false))}
            {renderFooter(() => setMobileOpen(false))}
          </aside>
        </div>
      )}
    </>
  );
}
