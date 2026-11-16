'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  EmployerShell,
  EmployerBtn,
  EmployerCard,
  StageChip,
  EmployerSafetyStrip as SafetyStrip,
} from '@/components';
import {
  hires as initialHires,
  hireKpis,
} from '@/app/employer/employer-data';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Laptop,
  Mail,
  ShieldCheck,
  UserCheck,
  Users,
  Eye,
} from 'lucide-react';

export default function EmployerHiresPage() {
  const [activeTab, setActiveTab] = useState('Upcoming starts');
  const [hiresList, setHiresList] = useState(initialHires);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleRevealIdentity = (hireId) => {
    setHiresList((prev) =>
      prev.map((h) => (h.id === hireId ? { ...h, blind: false, name: 'Siddharth Rao' } : h))
    );
    showToast('Candidate identity revealed.');
  };

  const tabs = ['Upcoming starts', 'Needs action', 'Started', 'Templates'];

  return (
    <EmployerShell active="/employer/hires">
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 rounded-xl bg-[#0F1B2D] px-4 py-3 text-sm text-white shadow-xl flex items-center gap-2 border border-[#B8955A]/30"
        >
          <CheckCircle2 size={16} className="text-[#D4AF37]" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="mx-auto max-w-[1280px] space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#0F1B2D]">
              Hires Directory
            </h1>
            <p className="text-xs sm:text-sm text-[#4A5568]">
              Directory of accepted hires and upcoming team members.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/employer/templates">
              <EmployerBtn variant="secondary" size="sm">
                Manage Templates
              </EmployerBtn>
            </Link>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {hireKpis.map((k, idx) => (
            <div key={idx} className="rounded-2xl border border-[#E5E1D8] bg-white p-5 shadow-sm">
              <span className="text-xs font-semibold text-[#4A5568]">{k.label}</span>
              <p className="font-serif text-2xl font-bold text-[#0F1B2D] mt-1">{k.value}</p>
              <p className="text-xs text-[#806236] mt-1">{k.change || 'On schedule'}</p>
            </div>
          ))}
        </div>

        {/* Tabs Filter */}
        <div className="flex gap-2 border-b border-[#E5E1D8] pb-2 overflow-x-auto">
          {tabs.map((tab) => {
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`whitespace-nowrap rounded-lg px-4 py-2 text-xs sm:text-sm font-medium transition ${
                  active
                    ? 'bg-[#0F1B2D] text-white shadow-sm'
                    : 'text-[#4A5568] hover:bg-[#FAF8F4] hover:text-[#0F1B2D]'
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>

        {/* Hires Cards List */}
        <div className="space-y-4">
          {hiresList.map((hire) => {
            const pct = Math.round((hire.checklist.done / hire.checklist.total) * 100);
            return (
              <div
                key={hire.id}
                className="rounded-2xl border border-[#E5E1D8] bg-white p-5 shadow-sm transition hover:border-[#B8955A] space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#F3EBDD] font-serif text-lg font-bold text-[#806236] border border-[#B8955A]/30">
                      {hire.name.charAt(0)}
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-serif text-lg font-bold text-[#0F1B2D]">
                          {hire.blind ? 'Candidate (Blind Hired)' : hire.name}
                        </h3>
                        <StageChip stage={hire.status || 'Pre-boarding'} />
                        {hire.blind && (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 border border-amber-200">
                            Identity Masked
                          </span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-[#4A5568]">
                        {hire.role} · <span className="text-[#0F1B2D] font-medium">{hire.team}</span>
                      </p>
                      <p className="text-xs text-[#4A5568]">
                        Manager: <span className="text-[#0F1B2D] font-medium">{hire.manager}</span> · Starting <span className="text-emerald-700 font-semibold">{hire.startDate}</span> ({hire.startsIn})
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {hire.blind && (
                      <EmployerBtn
                        variant="secondary"
                        size="sm"
                        onClick={() => handleRevealIdentity(hire.id)}
                      >
                        <Eye size={14} className="mr-1.5" /> Reveal Identity
                      </EmployerBtn>
                    )}
                    <Link href={`/employer/hires/${hire.id}`}>
                      <EmployerBtn variant="primary" size="sm">
                        View Details <ArrowRight size={14} className="ml-1" />
                      </EmployerBtn>
                    </Link>
                  </div>
                </div>

                {/* Checklist Progress */}
                <div className="rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[#0F1B2D]">
                      Checklist Progress: {hire.checklist.done} of {hire.checklist.total} items complete
                    </span>
                    <span className="font-bold text-[#806236]">{pct}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[#E5E1D8] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#B8955A] transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-[#4A5568] pt-1">
                    <span className="inline-flex items-center gap-1">
                      <ShieldCheck size={14} className="text-emerald-600" /> Background checks verified
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Laptop size={14} className="text-[#806236]" /> Workstation provisioned
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </EmployerShell>
  );
}
