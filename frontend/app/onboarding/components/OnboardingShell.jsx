'use client';

import React from 'react';
import Link from 'next/link';
import { LogOut, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { clearTokens } from '@/lib/api/client';

export default function OnboardingShell({ children }) {
  const { logout } = useAuth() || {};
  return (
    <div className="min-h-screen bg-[#FAF8F4] text-[#0F1B2D]">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-[#E5E1D8] bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 group">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#0F1B2D] font-serif text-sm font-bold text-[#D4AF37] shadow-sm">
                F
              </span>
              <span className="font-serif text-lg font-bold tracking-tight text-[#0F1B2D] group-hover:text-[#9A7A45] transition">
                Forma
              </span>
            </Link>
            <span className="hidden sm:inline-block text-xs font-medium text-[#4A5568] border-l border-[#E5E1D8] pl-3">
              Onboarding Workspace
            </span>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            <span className="hidden md:inline-flex items-center gap-1.5 rounded-full bg-[#FAF8F4] border border-[#E5E1D8] px-3 py-1 text-xs text-[#4A5568]">
              <Sparkles size={13} className="text-[#9A7A45]" /> Auto-saving draft
            </span>
            <button
              type="button"
              onClick={() => {
                try {
                  clearTokens();
                  window.localStorage.clear();
                  window.sessionStorage.clear();
                } catch {}
                window.location.href = '/login';
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#E5E1D8] px-3 py-1.5 text-xs font-semibold text-[#4A5568] hover:bg-[#FAF8F4] hover:text-[#0F1B2D] transition"
            >
              <LogOut size={13} /> Exit
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
        {children}
      </main>

      {/* Footer note */}
      <footer className="mx-auto max-w-4xl px-4 pb-12 pt-4 text-center text-xs text-[#4A5568]">
        <p>
          Forma Enterprise Resource Platform · Unified ecosystem for Startups, Mentors, Investors & Talent.
        </p>
      </footer>
    </div>
  );
}
