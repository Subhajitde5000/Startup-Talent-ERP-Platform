'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Search, ChevronDown, Menu, User, PieChart, Activity, MessageSquare, Settings, LogOut, CheckCircle2 } from 'lucide-react';
import NotificationDropdown from './notification-dropdown';
import { useAuth } from '@/lib/auth-context';

export default function InvestorHeader({
  compact = false,
  liveIdentity = false,
  onToggleMobile,
  onAction,
  backHref,
  backLabel = '← Back',
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const { logout, user } = useAuth();

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
          className="grid h-9 w-9 place-items-center rounded-lg border border-[#E5E1D8] bg-white text-ink lg:hidden hover:bg-[#FAF8F4] transition"
          aria-label="Open navigation menu"
        >
          <Menu size={18} />
        </button>

        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            if (!liveIdentity) notify('Searching investor workspace...');
          }}
          className="relative hidden sm:block"
        >
          <Search className="absolute left-3 top-2.5 text-[#A0A7B4]" size={17} />
          <input
            id="investor-workspace-search"
            name="search"
            type="search"
            aria-label="Search investor workspace"
            disabled={liveIdentity}
            placeholder={liveIdentity ? 'Workspace search unavailable' : 'Search startups, deals & documents'}
            className="h-10 w-64 rounded-lg border border-[#E5E1D8] bg-white pl-9 text-xs focus:border-ink focus:outline-none transition"
          />
        </form>

        {backHref && (
          <Link
            href={backHref}
            className="inline-flex items-center text-xs font-semibold text-[#806236] hover:text-ink sm:hidden transition"
          >
            {backLabel}
          </Link>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Link
          href="/investor/dashboard"
          className="rounded-full bg-[#E7F3EC] px-3 py-1.5 text-xs font-semibold text-[#286749] hidden sm:inline-flex items-center gap-1"
        >
          {liveIdentity ? 'Investor workspace' : '✓ Verified Investor'}
        </Link>

        {!liveIdentity && <NotificationDropdown role="investor" />}

        <div className="relative">
          <button
            type="button"
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2 rounded-lg p-1 text-xs hover:bg-black/5 transition"
            aria-label="User account details"
            aria-expanded={profileOpen}
          >
            <span className="grid h-8 w-8 place-items-center rounded-full bg-ink font-semibold text-white">
              {liveIdentity ? (user?.display_name?.slice(0, 2).toUpperCase() || '—') : 'AM'}
            </span>
            <span className="hidden sm:block text-left">
              <span className="block text-xs font-bold text-ink">{liveIdentity ? user?.display_name : 'Arjun Mehta'}</span>
              <span className="block text-[10px] text-[#5A6E85]">{liveIdentity ? 'Personal investor account' : 'Forma Ventures'}</span>
            </span>
            <ChevronDown size={14} className="text-[#4A5568]" />
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-12 z-30 w-56 rounded-xl border border-[#E5E1D8] bg-white p-2 text-[#0F1B2D] shadow-lg animate-in fade-in">
              <div className="px-3 py-2 border-b border-[#F2EFE9] mb-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-bold text-[#0F1B2D]">{liveIdentity ? user?.display_name : 'Arjun Mehta'}</p>
                  {!liveIdentity && <CheckCircle2 size={12} className="text-[#286749]" />}
                </div>
                <p className="text-[11px] text-[#5A6E85]">{liveIdentity ? 'Investor' : 'Angel Syndicate Lead'}</p>
              </div>

              <Link
                href="/investor/profile"
                onClick={() => setProfileOpen(false)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-[#0F1B2D] hover:bg-[#FAF8F4] transition"
              >
                <User size={15} className="text-[#B8955A]" />
                <span>Investor Profile & Thesis</span>
              </Link>
              <Link
                href="/investor/portfolio"
                onClick={() => setProfileOpen(false)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-[#0F1B2D] hover:bg-[#FAF8F4] transition"
              >
                <PieChart size={15} className="text-[#5A6E85]" />
                <span>Portfolio & Cap Tables</span>
              </Link>
              <Link
                href="/investor/activity"
                onClick={() => setProfileOpen(false)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-[#0F1B2D] hover:bg-[#FAF8F4] transition"
              >
                <Activity size={15} className="text-[#5A6E85]" />
                <span>Activity & Due Diligence</span>
              </Link>
              <Link
                href="/investor/community"
                onClick={() => setProfileOpen(false)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-[#0F1B2D] hover:bg-[#FAF8F4] transition"
              >
                <MessageSquare size={15} className="text-[#5A6E85]" />
                <span>Investor Syndicate Forum</span>
              </Link>
              <Link
                href="/investor/settings"
                onClick={() => setProfileOpen(false)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-[#0F1B2D] hover:bg-[#FAF8F4] transition"
              >
                <Settings size={15} className="text-[#5A6E85]" />
                <span>Account & KYC Settings</span>
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
