'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Search, ChevronDown, Menu, Settings, Users, LogOut, Moon, Sun, Building2, MessageSquare, User } from 'lucide-react';
import NotificationDropdown from './notification-dropdown';
import { useAuth } from '@/lib/auth-context';

export default function StartupHeader({
  compact = false,
  onToggleMobile,
  onAction,
  backHref = '/startup/dashboard',
  backLabel = '← Dashboard',
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search workspace',
  showThemeToggle = false,
  darkmode = false,
  onToggleTheme,
  showProfileMenu = false,
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
        <div className="relative hidden sm:block">
          <Search className="absolute left-3 top-2.5 text-[#A0A7B4]" size={17} />
          <input
            aria-label="Search workspace"
            value={searchValue}
            onChange={onSearchChange}
            placeholder={searchPlaceholder}
            className="h-10 w-64 rounded-lg border border-[#E5E1D8] bg-white pl-9 pr-3 text-sm focus:border-ink focus:outline-none"
          />
        </div>
        {backHref && (
          <Link href={backHref} className="text-sm font-semibold sm:hidden">
            {backLabel}
          </Link>
        )}
      </div>
      <div className="flex items-center gap-3">
        {showThemeToggle && (
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={darkmode ? 'Switch to light mode' : 'Switch to dark mode'}
            title={darkmode ? 'Switch to light mode' : 'Switch to dark mode'}
            className="grid h-10 w-10 place-items-center rounded-full transition hover:bg-black/5"
          >
            {darkmode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        )}
        <NotificationDropdown role="startup" />
        <div className="relative">
          <button
            type="button"
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2 rounded-lg p-1 text-xs hover:bg-black/5"
            aria-label="User account details"
            aria-expanded={profileOpen}
          >
            <span className="grid h-8 w-8 place-items-center rounded-full bg-ink font-semibold text-white">
              AK
            </span>
            <span className="hidden text-left sm:block">
              <b className="block text-xs">Aarav Kapoor</b>
              <small className="text-[#4A5568]">Startup Founder</small>
            </span>
            <ChevronDown size={14} className="text-[#4A5568]" />
          </button>
          {profileOpen && (
            <div className="absolute right-0 top-12 z-30 w-56 rounded-xl border border-[#E5E1D8] bg-white p-2 text-[#0F1B2D] shadow-lg animate-in fade-in">
              <div className="px-3 py-2 border-b border-[#F2EFE9] mb-1">
                <p className="text-xs font-bold text-[#0F1B2D]">Aarav Kapoor</p>
                <p className="text-[11px] text-[#5A6E85]">Founder & CEO • FinFlow</p>
              </div>
              <Link
                href="/startup/user-profile"
                onClick={() => setProfileOpen(false)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-[#0F1B2D] hover:bg-[#FAF8F4] transition"
              >
                <User size={15} className="text-[#B8955A]" />
                <span>My Founder Profile</span>
              </Link>
              <Link
                href="/startup/profile"
                onClick={() => setProfileOpen(false)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-[#0F1B2D] hover:bg-[#FAF8F4] transition"
              >
                <Building2 size={15} className="text-[#5A6E85]" />
                <span>Startup Company Profile</span>
              </Link>
              <Link
                href="/startup/community"
                onClick={() => setProfileOpen(false)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-[#0F1B2D] hover:bg-[#FAF8F4] transition"
              >
                <MessageSquare size={15} className="text-[#5A6E85]" />
                <span>Community Discussion</span>
              </Link>
              <button
                type="button"
                onClick={() => {
                  setProfileOpen(false);
                  notify('Account settings opened.');
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-[#0F1B2D] hover:bg-[#FAF8F4] transition text-left"
              >
                <Settings size={15} className="text-[#5A6E85]" />
                <span>Account Settings</span>
              </button>
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
