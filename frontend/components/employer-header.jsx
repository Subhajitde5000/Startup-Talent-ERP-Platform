'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Menu,
  Search,
  CheckCircle2,
  ChevronDown,
  Briefcase,
  X,
  Settings,
  CircleHelp,
  Shield,
  FileText,
  User,
  MessageSquare,
  LogOut,
} from 'lucide-react';
import NotificationDropdown from './notification-dropdown';
import { useAuth } from '@/lib/auth-context';

export default function EmployerHeader({
  compact = false,
  collapsed,
  onToggleMobile,
  onOpenMobileNav,
  onAction,
  backHref = '/employer/dashboard',
  backLabel = '← Dashboard',
}) {
  const isCompact = compact !== undefined ? compact : (collapsed !== undefined ? collapsed : false);
  const handleToggleMobile = onToggleMobile || onOpenMobileNav;

  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { logout } = useAuth();

  const notify = (msg) => {
    if (onAction) onAction(msg);
  };

  const notifications = [
    { id: 1, title: 'New candidate applied', detail: 'Aanya Sen applied for Senior Product Designer', time: '10m ago', unread: true },
    { id: 2, title: 'Interview confirmed', detail: 'Technical session with Rohan Mehta tomorrow at 2:00 PM', time: '1h ago', unread: true },
    { id: 3, title: 'Offer letter signed', detail: 'Karan Verma accepted Lead Fullstack Engineer offer', time: '1d ago', unread: false },
  ];

  return (
    <header
      className={`sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-[#E5E1D8] bg-[#FAF8F4]/95 px-4 backdrop-blur transition-[margin] duration-200 sm:px-7 ${
        isCompact ? 'lg:ml-[76px]' : 'lg:ml-[240px]'
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Mobile Hamburger Trigger */}
        <button
          type="button"
          onClick={handleToggleMobile}
          className="grid h-9 w-9 place-items-center rounded-lg border border-[#E5E1D8] bg-white text-[#0F1B2D] hover:bg-[#F4F1EA] lg:hidden"
          aria-label="Open navigation menu"
        >
          <Menu size={18} />
        </button>

        {/* Company Title & Verification */}
        <div className="hidden sm:flex items-center gap-2">
          <span className="font-serif text-sm font-bold text-[#0F1B2D]">
            Northstar Labs
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[#E7F3EC] px-2 py-0.5 text-xs font-semibold text-[#286749]">
            <CheckCircle2 size={11} /> Verified Employer
          </span>
        </div>

        {/* Search Input */}
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            notify('Search filter applied.');
          }}
          className="relative hidden md:block ml-2"
        >
          <Search className="absolute left-3 top-2.5 text-[#A0A7B4]" size={16} />
          <input
            id="employer-workspace-search"
            name="search"
            type="search"
            aria-label="Search candidates, jobs, or records"
            placeholder="Search candidates, jobs, or records..."
            className="h-9 w-64 lg:w-80 rounded-lg border border-[#E5E1D8] bg-white pl-9 text-xs focus:border-[#B8955A] focus:outline-none"
          />
        </form>

        {backHref && (
          <Link href={backHref} className="text-xs font-semibold text-[#806236] sm:hidden">
            {backLabel}
          </Link>
        )}
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2.5">
        {/* Post a Job Quick CTA */}
        <Link href="/employer/jobs/new" className="hidden sm:inline-block">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-[#0F1B2D] text-white text-xs font-semibold hover:bg-[#1C2B42] transition-colors"
          >
            <Briefcase size={13} /> Post a Job
          </button>
        </Link>

        {/* Notifications Dropdown */}
        <NotificationDropdown role="employer" />

        {/* User Profile Avatar & Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2 rounded-lg border border-[#E5E1D8] bg-white p-1 hover:bg-[#F4F1EA] transition-colors"
            aria-label="User profile options"
          >
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#0F1B2D] text-xs font-bold text-white">
              SJ
            </span>
            <span className="hidden sm:block text-xs font-medium text-[#0F1B2D]">Sarah Jenkins</span>
            <ChevronDown size={13} className="text-[#6B7280] mr-1" />
          </button>

          {profileOpen && (
            <div className="absolute right-0 mt-2 w-60 rounded-2xl border border-[#E5E1D8] bg-white p-2 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-2 border-b border-[#F0EBE0] mb-1">
                <div className="flex items-center gap-1.5">
                  <strong className="block text-xs text-[#0F1B2D]">Sarah Jenkins</strong>
                  <CheckCircle2 size={12} className="text-[#286749]" />
                </div>
                <span className="text-[11px] text-[#6B7280]">Northstar Labs · Head of People</span>
              </div>
              <div className="pt-1 text-xs space-y-0.5">
                <Link
                  href="/employer/profile"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium text-[#0F1B2D] hover:bg-[#FAF8F4] transition"
                >
                  <User size={14} className="text-[#B8955A]" />
                  <span>Company & Recruiter Profile</span>
                </Link>
                <Link
                  href="/employer/billing"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[#4A5568] hover:bg-[#FAF8F4] hover:text-[#0F1B2D] transition"
                >
                  <FileText size={14} className="text-[#5A6E85]" />
                  <span>Plan & Invoices</span>
                </Link>
                <Link
                  href="/employer/trust"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[#4A5568] hover:bg-[#FAF8F4] hover:text-[#0F1B2D] transition"
                >
                  <Shield size={14} className="text-[#5A6E85]" />
                  <span>Verification & Trust</span>
                </Link>
                <Link
                  href="/employer/community"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[#4A5568] hover:bg-[#FAF8F4] hover:text-[#0F1B2D] transition"
                >
                  <MessageSquare size={14} className="text-[#5A6E85]" />
                  <span>Community Exchange</span>
                </Link>
                <div className="border-t border-[#F0EBE0] my-1 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      logout();
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition"
                >
                  <LogOut size={14} />
                    <span>Sign out</span>
                </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
