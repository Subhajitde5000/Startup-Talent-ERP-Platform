'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Search, ChevronDown, Menu, User, CalendarDays, Wallet, MessageSquare, Settings, LogOut, CheckCircle2 } from 'lucide-react';
import NotificationDropdown from './notification-dropdown';
import { useAuth } from '@/lib/auth-context';

export default function MentorHeader({
  compact = false,
  onToggleMobile,
  onAction,
  backHref = '/mentor/dashboard',
  backLabel = '← Dashboard',
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const { logout } = useAuth();

  const notify = (msg) => {
    if (onAction) onAction(msg);
  };

  return (
    <header
      className={`sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-[#E5E1D8] bg-[#FAF8F4]/95 px-4 backdrop-blur transition-[margin] duration-200 sm:px-7 ${
        compact ? 'lg:ml-[76px]' : 'lg:ml-[240px]'
      }`}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleMobile}
          className="grid h-9 w-9 place-items-center rounded-lg border border-[#E5E1D8] bg-white text-ink lg:hidden"
          aria-label="Open navigation menu"
        >
          <Menu size={18} />
        </button>
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            notify('Search filter applied.');
          }}
          className="relative hidden sm:block"
        >
          <Search className="absolute left-3 top-2.5 text-[#A0A7B4]" size={17} />
          <input
            id="mentor-workspace-search"
            name="search"
            type="search"
            aria-label="Search mentor workspace"
            placeholder="Search mentor workspace"
            className="h-10 w-64 rounded-lg border border-[#E5E1D8] bg-white pl-9 text-sm focus:border-ink focus:outline-none"
          />
        </form>
        {backHref && (
          <Link href={backHref} className="text-sm font-semibold sm:hidden">
            {backLabel}
          </Link>
        )}
      </div>

      <div className="flex items-center gap-3">
        <NotificationDropdown role="mentor" />

        <div className="relative">
          <button
            type="button"
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2 rounded-lg p-1 text-xs hover:bg-black/5 transition"
            aria-label="User account details"
            aria-expanded={profileOpen}
          >
            <span className="grid h-8 w-8 place-items-center rounded-full bg-ink font-semibold text-white">
              RM
            </span>
            <span className="hidden sm:block font-medium text-left">
              <span className="block text-xs font-bold text-[#0F1B2D]">Rhea Mukherjee</span>
              <span className="block text-[10px] text-[#5A6E85]">Verified Mentor</span>
            </span>
            <ChevronDown size={14} className="text-[#4A5568]" />
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-12 z-30 w-56 rounded-xl border border-[#E5E1D8] bg-white p-2 text-[#0F1B2D] shadow-lg animate-in fade-in">
              <div className="px-3 py-2 border-b border-[#F2EFE9] mb-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-bold text-[#0F1B2D]">Rhea Mukherjee</p>
                  <CheckCircle2 size={12} className="text-[#B8955A]" />
                </div>
                <p className="text-[11px] text-[#5A6E85]">Tech Architecture & Scaling</p>
              </div>

              <Link
                href="/mentor/profile"
                onClick={() => setProfileOpen(false)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-[#0F1B2D] hover:bg-[#FAF8F4] transition"
              >
                <User size={15} className="text-[#B8955A]" />
                <span>Mentor Profile & Bio</span>
              </Link>
              <Link
                href="/mentor/sessions"
                onClick={() => setProfileOpen(false)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-[#0F1B2D] hover:bg-[#FAF8F4] transition"
              >
                <CalendarDays size={15} className="text-[#5A6E85]" />
                <span>Sessions & Calendar</span>
              </Link>
              <Link
                href="/mentor/earnings"
                onClick={() => setProfileOpen(false)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-[#0F1B2D] hover:bg-[#FAF8F4] transition"
              >
                <Wallet size={15} className="text-[#5A6E85]" />
                <span>Earnings & Payouts</span>
              </Link>
              <Link
                href="/mentor/community"
                onClick={() => setProfileOpen(false)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-[#0F1B2D] hover:bg-[#FAF8F4] transition"
              >
                <MessageSquare size={15} className="text-[#5A6E85]" />
                <span>Community Advisory Hub</span>
              </Link>
              <Link
                href="/mentor/settings"
                onClick={() => setProfileOpen(false)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-[#0F1B2D] hover:bg-[#FAF8F4] transition"
              >
                <Settings size={15} className="text-[#5A6E85]" />
                <span>Account Settings</span>
              </Link>

              <div className="border-t border-[#F2EFE9] my-1 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    logout();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 transition"
                >
                  <LogOut size={15} />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
