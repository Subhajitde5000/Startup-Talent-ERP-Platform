'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';

export default function CelebrationModal({ role, roleLabel, profileSummary, dashboardUrl, onClose }) {
  const router = useRouter();

  const handleLaunch = () => {
    if (onClose) onClose();
    router.push(dashboardUrl);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F1B2D]/70 p-4 backdrop-blur-sm animate-enter"
    >
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-[#E5E1D8] bg-white shadow-2xl">
        {/* Top celebratory banner */}
        <div className="relative bg-gradient-to-br from-[#0F1B2D] via-[#1A2E4C] to-[#0F1B2D] px-6 py-8 text-center text-white">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#9A7A45]/20 border border-[#9A7A45]/40 text-[#D4AF37] shadow-inner">
            <Sparkles size={28} />
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 size={13} /> Onboarding Complete
          </span>
          <h2 className="mt-3 font-serif text-2xl sm:text-3xl font-bold tracking-tight">
            Your {roleLabel} Workspace is Ready
          </h2>
          <p className="mx-auto mt-2 max-w-md text-xs sm:text-sm text-stone-300 leading-relaxed">
            Your profile has been saved. We’ve customized your Forma dashboard with tools and workflows tailored for your goals.
          </p>
        </div>

        {/* Profile Snapshot */}
        <div className="p-6 space-y-5">
          <div className="rounded-2xl border border-[#E5E1D8] bg-[#FAF8F4] p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-[#E5E1D8] pb-2 text-xs">
              <span className="font-semibold uppercase tracking-wider text-[#9A7A45]">Active Role</span>
              <span className="rounded-md bg-[#0F1B2D] px-2 py-0.5 text-[11px] font-semibold text-white">
                {roleLabel}
              </span>
            </div>
            <div className="space-y-1.5 text-xs text-[#4A5568]">
              {profileSummary.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-[#4A5568]/80">{item.label}</span>
                  <span className="font-semibold text-[#0F1B2D]">{item.value || 'Configured'}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 border border-amber-200">
            <ShieldCheck size={16} className="shrink-0 text-amber-700" />
            <span>Profile stored locally for this session. You can edit anytime from Settings.</span>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-[#E5E1D8] px-4 py-3 text-xs font-semibold text-[#4A5568] hover:bg-[#FAF8F4] transition"
            >
              Review Responses
            </button>
            <button
              type="button"
              onClick={handleLaunch}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#0F1B2D] px-4 py-3 text-xs font-semibold text-white shadow-md hover:bg-[#1A2E4C] transition"
            >
              Go to Dashboard <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
