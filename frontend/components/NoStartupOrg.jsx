'use client';

import React from 'react';
import Link from 'next/link';
import { Building2, Briefcase, Mail, ArrowRight, Plus } from 'lucide-react';

export default function NoStartupOrg({ title = 'No active startup workspace', subtitle }) {
  return (
    <div className="mx-auto max-w-3xl py-8">
      <div className="overflow-hidden rounded-2xl border border-[#E5E1D8] bg-white p-6 sm:p-8 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#F4F1EA] text-[#0F1B2D]">
            <Building2 size={24} />
          </div>
          <div>
            <h2 className="serif text-xl sm:text-2xl font-bold text-[#0F1B2D]">{title}</h2>
            <p className="mt-0.5 text-xs sm:text-sm text-[#4A5568]">
              {subtitle || 'You are currently not an active member of any startup organization.'}
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {/* Option 1: Create a startup */}
          <div className="rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] p-5 flex flex-col justify-between">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EBF1FA] px-2.5 py-0.5 text-[11px] font-semibold text-[#1E40AF]">
                Founder path
              </span>
              <h3 className="serif mt-2.5 text-base font-bold text-[#0F1B2D]">
                Start your own company
              </h3>
              <p className="mt-1 text-xs text-[#4A5568] leading-relaxed">
                Launch a new startup profile, track milestones, manage cap tables, and assemble your team.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#E5E1D8]">
              <Link
                href="/startup/profile"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F1B2D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1C2B42] transition"
              >
                <Plus size={14} /> Create startup organization
              </Link>
            </div>
          </div>

          {/* Option 2: Explore talent / Job seeker */}
          <div className="rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] p-5 flex flex-col justify-between">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E7F3EC] px-2.5 py-0.5 text-[11px] font-semibold text-[#286749]">
                Talent & Careers
              </span>
              <h3 className="serif mt-2.5 text-base font-bold text-[#0F1B2D]">
                Explore open roles
              </h3>
              <p className="mt-1 text-xs text-[#4A5568] leading-relaxed">
                Switch to Job Seeker to apply to high-growth startups and browse active engineering, product, and design openings.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#E5E1D8]">
              <Link
                href="/jobseeker/dashboard"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E1D8] bg-white px-4 py-2 text-xs font-semibold text-[#0F1B2D] hover:bg-[#FAF8F4] transition"
              >
                <Briefcase size={14} /> Switch to Job Seeker <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </div>

        {/* Option 3: Waiting for invite info */}
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-dashed border-[#D5D0C5] bg-[#FAF8F4] p-4 text-xs text-[#4A5568]">
          <Mail size={18} className="mt-0.5 text-[#9A7A45] shrink-0" />
          <div>
            <span className="font-semibold text-[#0F1B2D]">Waiting to join another team?</span>
            <p className="mt-0.5 leading-relaxed">
              Ask your startup founder or administrator to send an invite link to your email address. Once accepted, your workspace will activate automatically.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
