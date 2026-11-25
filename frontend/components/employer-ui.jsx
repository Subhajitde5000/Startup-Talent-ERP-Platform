'use client';

import React from 'react';
import { Shield, AlertCircle, CheckCircle2 } from 'lucide-react';

export const INK = '#0F1B2D';
export const GOLD = '#B8955A';
export const RADIUS_CARD = 'rounded-2xl';
export const RADIUS_CONTROL = 'rounded-xl';

export function EmployerBtn({
  children,
  onClick,
  primary = false,
  secondary = false,
  destructive = false,
  small = false,
  disabled = false,
  type = 'button',
  className = '',
  ...props
}) {
  const base =
    'inline-flex items-center justify-center gap-1.5 text-xs font-semibold transition-all disabled:opacity-50 disabled:pointer-events-none select-none';
  const styles = primary
    ? 'bg-[#0F1B2D] text-white hover:bg-[#1C2B42] active:bg-[#0A121F] shadow-xs'
    : secondary
    ? 'border border-[#E5E1D8] bg-white text-[#0F1B2D] hover:bg-[#F4F1EA] active:bg-[#ECE7DC]'
    : destructive
    ? 'border border-transparent bg-transparent text-[#B42318] hover:bg-[#FCE8E6]'
    : 'border border-[#E5E1D8] bg-white text-[#0F1B2D] hover:bg-[#F4F1EA]';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${RADIUS_CONTROL} ${
        small ? 'px-3 py-1.5 min-h-[34px]' : 'px-4 py-2 min-h-[40px]'
      } ${styles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function EmployerCard({ title, action, children, padded = true, className = '' }) {
  return (
    <section className={`rounded-2xl border border-[#E5E1D8] bg-white shadow-xs ${className}`}>
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F0EBE0] px-5 py-4">
          {title && <h2 className="text-sm font-serif font-bold text-[#0F1B2D]">{title}</h2>}
          {action && <div>{action}</div>}
        </div>
      )}
      <div className={padded ? 'p-5 sm:p-6' : ''}>{children}</div>
    </section>
  );
}

export function StageChip({ stage, className = '' }) {
  const map = {
    Active: 'bg-[#E7F3EC] text-[#286749] border-[#CDE5D7]',
    Draft: 'bg-[#FAF8F4] text-[#6B7280] border-[#E5E1D8]',
    Paused: 'bg-[#FFF8E8] text-[#806236] border-[#D4C3A3]',
    Closed: 'bg-[#F3F4F6] text-[#4A5568] border-[#E5E1D8]',
    Review: 'bg-[#FFF8E8] text-[#806236] border-[#D4C3A3]',
    Shortlisted: 'bg-[#F3EBDD] text-[#806236] border-[#D4C3A3]',
    Interview: 'bg-[#E7F3EC] text-[#286749] border-[#CDE5D7]',
    Offered: 'bg-[#B8955A] text-white border-transparent',
    Hired: 'bg-[#286749] text-white border-transparent',
    Rejected: 'bg-[#FCE8E6] text-[#B42318] border-[#F8D7DA]',
    // Step 7g/7h: real offer and hire statuses (additive only).
    Sent: 'bg-[#F3EBDD] text-[#806236] border-[#B8955A]',
    Countered: 'bg-[#FFF8E8] text-[#806236] border-[#D4C3A3]',
    Accepted: 'bg-[#E7F3EC] text-[#286749] border-[#CDE5D7]',
    Declined: 'bg-[#FCE8E6] text-[#B42318] border-[#F8D7DA]',
    Expired: 'bg-[#F3F4F6] text-[#6B7280] border-[#E5E1D8]',
    Withdrawn: 'bg-[#F3F4F6] text-[#4A5568] border-[#E5E1D8]',
    'Pending onboarding': 'bg-[#FFF8E8] text-[#806236] border-[#D4C3A3]',
    Onboarding: 'bg-[#F3EBDD] text-[#806236] border-[#B8955A]',
    'No show': 'bg-[#FCE8E6] text-[#B42318] border-[#F8D7DA]',
    Cancelled: 'bg-[#F3F4F6] text-[#4A5568] border-[#E5E1D8]',
    // Step 7i: hiring-request statuses (additive only).
    'Pending approval': 'bg-[#FFF8E8] text-[#806236] border-[#D4C3A3]',
    Approved: 'bg-[#E7F3EC] text-[#286749] border-[#CDE5D7]',
    Fulfilled: 'bg-[#286749] text-white border-transparent',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
        map[stage] || 'bg-[#FAF8F4] text-[#4A5568] border-[#E5E1D8]'
      } ${className}`}
    >
      {stage}
    </span>
  );
}

export function SafetyStrip({
  title = 'Employer Trust & Compliance Guidelines',
  text = 'All job postings must reflect transparent compensation and authentic duties. Never request application fees or sensitive candidate financial credentials.',
}) {
  return (
    <div className="rounded-xl border border-[#D4C3A3] bg-[#F3EBDD]/40 p-4 text-xs text-[#806236] flex items-start gap-2.5">
      <Shield size={16} className="shrink-0 mt-0.5 text-[#806236]" />
      <div className="space-y-0.5">
        <strong className="block text-[#0F1B2D]">{title}</strong>
        <p className="leading-relaxed text-[#4A5568]">{text}</p>
      </div>
    </div>
  );
}
