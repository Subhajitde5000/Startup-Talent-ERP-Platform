'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  EmployerShell,
  EmployerBtn,
  EmployerCard,
  StageChip,
  EmployerSafetyStrip as SafetyStrip,
} from '@/components';
import { hires } from '@/app/employer/employer-data';
import {
  ArrowLeft,
  Briefcase,
  Calendar,
  CheckCircle2,
  Mail,
  MessageSquare,
  Send,
  User,
} from 'lucide-react';

export default function EmployerHireDetailPage() {
  const params = useParams();
  const hireId = params?.hireId || 'hire-1';
  const hire = hires.find((h) => h.id === hireId) || hires[0];

  const [activeTab, setActiveTab] = useState('Overview');
  const [toastMessage, setToastMessage] = useState(null);

  // Messaging state
  const [messages, setMessages] = useState([
    {
      id: 1,
      from: 'recruiter',
      text: 'Hi ' + (hire.blind ? 'Candidate' : hire.name) + '! Welcome to the team.',
      time: 'Yesterday at 11:30 AM',
    },
    {
      id: 2,
      from: 'hire',
      text: 'Thank you! Excited to get started.',
      time: 'Yesterday at 12:15 PM',
    },
  ]);
  const [newMsg, setNewMsg] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMsg.trim()) return;
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        from: 'recruiter',
        text: newMsg.trim(),
        time: 'Just now',
      },
    ]);
    setNewMsg('');
    showToast('Message sent');
  };

  const tabs = ['Overview', 'Messages'];

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
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-[#4A5568]">
          <Link
            href="/employer/hires"
            className="inline-flex items-center gap-1 font-medium text-[#806236] hover:underline"
          >
            <ArrowLeft size={14} /> Back to all hires
          </Link>
          <span>/</span>
          <span className="text-[#0F1B2D] font-medium">{hire.blind ? 'Candidate' : hire.name}</span>
        </div>

        {/* Profile Card */}
        <div className="rounded-2xl border border-[#E5E1D8] bg-white p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#F3EBDD] font-serif text-xl font-bold text-[#806236] border border-[#B8955A]/30">
                {hire.name ? hire.name.charAt(0) : 'H'}
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-serif text-xl sm:text-2xl font-bold text-[#0F1B2D]">
                    {hire.blind ? 'Candidate (Blind Hired)' : hire.name}
                  </h1>
                  <StageChip stage={hire.status || 'Active'} />
                </div>
                <p className="text-xs sm:text-sm text-[#4A5568]">
                  {hire.role} · <span className="text-[#0F1B2D] font-medium">{hire.department || hire.team || 'Team'}</span>
                </p>
                <p className="text-xs text-[#4A5568]">
                  Hiring Manager: <span className="text-[#0F1B2D] font-medium">{hire.manager || hire.owner}</span> · Starting <span className="text-emerald-700 font-semibold">{hire.startDate}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <EmployerBtn
                variant="primary"
                size="sm"
                onClick={() => setActiveTab('Messages')}
              >
                <MessageSquare size={14} className="mr-1.5" /> Message Hire
              </EmployerBtn>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="mt-6 flex gap-1.5 overflow-x-auto border-t border-[#E5E1D8] pt-4 pb-1">
            {tabs.map((tab) => {
              const active = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-medium transition ${
                    active
                      ? 'bg-[#0F1B2D] text-white shadow-sm'
                      : 'border border-[#E5E1D8] text-[#4A5568] hover:bg-[#FAF8F4] hover:text-[#0F1B2D]'
                  }`}
                >
                  {tab}
                </button>
              );
            })}
          </div>
        </div>

        {/* Two Columns */}
        <div className="grid gap-6 lg:grid-cols-12 min-w-0">
          <div className="lg:col-span-8 space-y-6 min-w-0">
            {activeTab === 'Overview' && (
              <div className="space-y-6">
                <EmployerCard title="Hire Information">
                  <div className="grid gap-4 sm:grid-cols-2 text-xs">
                    <div className="rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] p-4 space-y-1">
                      <span className="text-[#4A5568] block">Role</span>
                      <p className="font-semibold text-sm text-[#0F1B2D]">{hire.role}</p>
                    </div>
                    <div className="rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] p-4 space-y-1">
                      <span className="text-[#4A5568] block">Department</span>
                      <p className="font-semibold text-sm text-[#0F1B2D]">{hire.department || hire.team || 'Engineering'}</p>
                    </div>
                    <div className="rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] p-4 space-y-1">
                      <span className="text-[#4A5568] block">Hiring Manager</span>
                      <p className="font-semibold text-sm text-[#0F1B2D]">{hire.manager || hire.owner}</p>
                    </div>
                    <div className="rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] p-4 space-y-1">
                      <span className="text-[#4A5568] block">Start Date</span>
                      <p className="font-semibold text-sm text-emerald-700">{hire.startDate}</p>
                    </div>
                  </div>
                </EmployerCard>
              </div>
            )}

            {activeTab === 'Messages' && (
              <EmployerCard title="Conversation Thread">
                <div className="space-y-4">
                  <div className="rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] p-4 min-h-[220px] max-h-[320px] overflow-y-auto space-y-3">
                    {messages.map((m) => (
                      <div
                        key={m.id}
                        className={`flex flex-col ${m.from === 'recruiter' ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl p-3 text-xs ${
                            m.from === 'recruiter'
                              ? 'bg-[#0F1B2D] text-white'
                              : 'bg-white border border-[#E5E1D8] text-[#0F1B2D]'
                          }`}
                        >
                          {m.text}
                        </div>
                        <span className="text-[10px] text-[#4A5568] mt-1 px-1">{m.time}</span>
                      </div>
                    ))}
                  </div>
                  <form onSubmit={handleSendMessage} className="flex gap-2">
                    <input
                      type="text"
                      value={newMsg}
                      onChange={(e) => setNewMsg(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1 rounded-xl border border-[#E5E1D8] px-3.5 py-2 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                    />
                    <EmployerBtn type="submit" variant="primary" size="sm">
                      <Send size={14} className="mr-1" /> Send
                    </EmployerBtn>
                  </form>
                </div>
              </EmployerCard>
            )}
          </div>

          {/* Right Summary */}
          <div className="lg:col-span-4 space-y-6 min-w-0">
            <EmployerCard title="Summary">
              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center py-1">
                  <span className="text-[#4A5568]">Status:</span>
                  <StageChip stage={hire.status || 'Active'} />
                </div>
                <div className="flex justify-between items-center py-1 border-t border-[#E5E1D8]">
                  <span className="text-[#4A5568]">Start Date:</span>
                  <span className="font-semibold text-emerald-700">{hire.startDate}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-t border-[#E5E1D8]">
                  <span className="text-[#4A5568]">Associated Offer:</span>
                  <Link href="/employer/offers" className="text-[#806236] underline font-medium">
                    View Offers
                  </Link>
                </div>
              </div>
            </EmployerCard>

            <SafetyStrip />
          </div>
        </div>
      </div>
    </EmployerShell>
  );
}
