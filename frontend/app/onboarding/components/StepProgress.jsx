'use client';

import React from 'react';
import { Check } from 'lucide-react';

export default function StepProgress({ steps, currentStep, onStepClick }) {
  const progressPercent = Math.round(((currentStep - 1) / (steps.length - 1 || 1)) * 100);

  return (
    <div className="w-full space-y-4">
      {/* Top bar with percentage */}
      <div className="flex items-center justify-between text-xs text-[#4A5568]">
        <div className="flex items-center gap-2">
          <span className="font-semibold uppercase tracking-wider text-[#9A7A45]">
            Step {currentStep} of {steps.length}
          </span>
          <span className="text-[#E5E1D8]">|</span>
          <span className="font-medium text-[#0F1B2D]">{steps[currentStep - 1]?.title}</span>
        </div>
        <span className="font-semibold text-[#0F1B2D]">{progressPercent}% complete</span>
      </div>

      {/* Progress Track */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#E5E1D8]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#0F1B2D] via-[#9A7A45] to-[#B8955A] transition-all duration-500 ease-out"
          style={{ width: `${Math.max(progressPercent, 6)}%` }}
        />
      </div>

      {/* Desktop Step Pills */}
      <nav aria-label="Onboarding Progress" className="hidden sm:grid grid-cols-4 gap-3 pt-1">
        {steps.map((s, idx) => {
          const stepNum = idx + 1;
          const isDone = currentStep > stepNum;
          const isCurrent = currentStep === stepNum;
          const isClickable = onStepClick && stepNum <= currentStep;

          return (
            <button
              key={s.id || idx}
              type="button"
              disabled={!isClickable}
              onClick={() => isClickable && onStepClick(stepNum)}
              className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition ${
                isCurrent
                  ? 'border-[#0F1B2D] bg-white shadow-sm ring-1 ring-[#0F1B2D]/20'
                  : isDone
                  ? 'border-[#E5E1D8] bg-[#FAF8F4] text-[#0F1B2D] hover:border-[#9A7A45]'
                  : 'border-[#E5E1D8]/60 bg-white/40 text-[#4A5568]/60 cursor-not-allowed'
              }`}
            >
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${
                  isDone
                    ? 'bg-emerald-600 text-white'
                    : isCurrent
                    ? 'bg-[#0F1B2D] text-white'
                    : 'bg-[#E5E1D8] text-[#4A5568]'
                }`}
              >
                {isDone ? <Check size={13} strokeWidth={3} /> : stepNum}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={`truncate text-xs font-semibold ${
                    isCurrent ? 'text-[#0F1B2D]' : isDone ? 'text-[#4A5568]' : 'text-[#4A5568]/70'
                  }`}
                >
                  {s.title}
                </p>
                <p className="truncate text-[10px] text-[#4A5568]/80">{s.subtitle}</p>
              </div>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
