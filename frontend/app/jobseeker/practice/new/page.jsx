'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ChevronLeft,
  MessageSquare,
  Mic,
  Shield,
  Video,
} from 'lucide-react';
import { JobSeekerShell } from '@/components';
import { JobBtn } from '@/components/jobseeker-ui';
import { api } from '@/lib/api/client';
import { errorLabel } from '@/components/career-data';
import { FieldError, fieldErrorsFrom } from '@/components/async-state';

const DIFFICULTIES = [
  { label: 'Standard', value: 'easy' },
  { label: 'Challenging', value: 'medium' },
  { label: 'Founder Strict', value: 'hard' },
];

export default function NewPracticeSetupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const drillId = searchParams?.get('drill') || '';

  const [role, setRole] = useState('Senior Product Designer');
  const [sessionType, setSessionType] = useState('Technical & Architecture');
  const [questionCount, setQuestionCount] = useState(3);
  const [difficulty, setDifficulty] = useState('medium');
  const [mode, setMode] = useState('text');
  const [selectedDrill, setSelectedDrill] = useState(null);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (!drillId) return;
    const ctrl = new AbortController();
    api.practice
      .getDrill(drillId, ctrl.signal)
      .then((d) => {
        if (ctrl.signal.aborted) return;
        setSelectedDrill(d);
        setSessionType(d.category || 'Technical & Architecture');
        if (d.difficulty) setDifficulty(d.difficulty);
        if (d.prompts?.length) {
          setQuestionCount(Math.min(15, Math.max(1, d.prompts.length)));
        }
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [drillId]);

  const handleStart = async () => {
    setIsStarting(true);
    setError('');
    setFieldErrors({});
    try {
      const created = await api.practice.createSession({
        drill_id: selectedDrill?.id || null,
        target_role: role.trim() || null,
        focus_area: sessionType,
        difficulty,
        question_count: questionCount,
        is_video_mode: mode === 'video',
      });
      if (created.is_video_mode) {
        router.push(`/jobseeker/practice/${created.id}/video`);
      } else {
        await api.practice.startSession(created.id);
        router.push(`/jobseeker/practice/${created.id}`);
      }
    } catch (err) {
      setFieldErrors(fieldErrorsFrom(err));
      setError(errorLabel(err, 'Could not start practice session.'));
      setIsStarting(false);
    }
  };

  return (
    <JobSeekerShell active="Interview practice">
      <div className="space-y-6 max-w-4xl pb-10">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-[#6B7280]">
          <Link
            href="/jobseeker/practice"
            className="flex items-center gap-1 hover:text-[#0F1B2D]"
          >
            <ChevronLeft size={14} /> Back to Practice Hub
          </Link>
          <span>/</span>
          <span className="text-[#0F1B2D] font-medium">New Session</span>
        </nav>

        {/* Header */}
        <header className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm">
          <h1 className="text-xl md:text-2xl font-serif font-bold text-[#0F1B2D]">
            Configure AI Practice Session
          </h1>
          <p className="text-xs md:text-sm text-[#6B7280] mt-1">
            {selectedDrill
              ? `Using drill: ${selectedDrill.title} (${selectedDrill.category}).`
              : 'Choose your focus area, difficulty, and question count. Completely private and unshared.'}
          </p>
        </header>

        {error && (
          <div className="rounded-xl border border-[#F2C6C2] bg-[#FEF3F2] px-4 py-3 text-xs text-[#B42318]">
            {error}
          </div>
        )}

        {/* Setup Card */}
        <section className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm space-y-6">
          {/* Target Role */}
          <div>
            <label htmlFor="targetRole" className="block text-xs font-semibold text-[#4A5568] mb-1.5">
              Target Role &amp; Discipline
            </label>
            <input
              id="targetRole"
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-[#E5E1D8] text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
            />
            <FieldError message={fieldErrors.target_role} />
          </div>

          {/* Session Type */}
          <div>
            <span className="block text-xs font-semibold text-[#4A5568] mb-2">
              Interview Focus Area
            </span>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { title: 'Behavioral & Leadership', desc: 'Conflict resolution, prioritization, and ownership' },
                { title: 'Technical & Architecture', desc: 'Design systems, tokens, engineering handoff, scalability' },
                { title: 'Founder Culture Fit', desc: 'Startup pace, vision alignment, and fast-growth adaptation' },
              ].map((t) => {
                const isSelected = sessionType === t.title;
                return (
                  <div
                    key={t.title}
                    onClick={() => setSessionType(t.title)}
                    className={`cursor-pointer rounded-xl border p-4 space-y-1 transition-all ${
                      isSelected
                        ? 'border-[#0F1B2D] bg-[#FAF8F4] shadow-sm'
                        : 'border-[#E5E1D8] bg-white hover:bg-[#FAF8F4]'
                    }`}
                  >
                    <h3 className="text-xs font-bold text-[#0F1B2D]">{t.title}</h3>
                    <p className="text-[11px] text-[#6B7280] leading-relaxed">{t.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Question Count & Difficulty */}
          <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-[#F0EBE0]">
            <div>
              <span className="block text-xs font-semibold text-[#4A5568] mb-2">
                Number of Questions
              </span>
              <div className="flex flex-wrap gap-2">
                {[3, 5, 8].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setQuestionCount(count)}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold border ${
                      questionCount === count
                        ? 'bg-[#0F1B2D] text-white border-[#0F1B2D]'
                        : 'bg-white border-[#E5E1D8] text-[#4A5568]'
                    }`}
                  >
                    {count} Questions (~{count * 3} mins)
                  </button>
                ))}
              </div>
              <FieldError message={fieldErrors.question_count} />
            </div>

            <div>
              <span className="block text-xs font-semibold text-[#4A5568] mb-2">
                Difficulty Level
              </span>
              <div className="flex flex-wrap gap-2">
                {DIFFICULTIES.map((diff) => (
                  <button
                    key={diff.value}
                    type="button"
                    onClick={() => setDifficulty(diff.value)}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold border ${
                      difficulty === diff.value
                        ? 'bg-[#0F1B2D] text-white border-[#0F1B2D]'
                        : 'bg-white border-[#E5E1D8] text-[#4A5568]'
                    }`}
                  >
                    {diff.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Interview Mode */}
          <div>
            <span className="block text-xs font-semibold text-[#4A5568] mb-2">
              Interview Mode
            </span>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                {
                  id: 'text',
                  title: 'Text Mode',
                  desc: 'Type structured answers and receive 4-dimension rubric scoring.',
                  Icon: MessageSquare,
                },
                {
                  id: 'video',
                  title: 'Video Mode (AI Body Language + Voice)',
                  desc: 'Live webcam + speech-to-text with confidence, posture, eye contact & delivery scoring.',
                  Icon: Video,
                },
              ].map((m) => {
                const isSelected = mode === m.id;
                const Icon = m.Icon;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode(m.id)}
                    className={`text-left cursor-pointer rounded-xl border p-4 space-y-1 transition-all ${
                      isSelected
                        ? 'border-[#0F1B2D] bg-[#FAF8F4] shadow-sm'
                        : 'border-[#E5E1D8] bg-white hover:bg-[#FAF8F4]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon size={15} className="text-[#9A7A45]" />
                      <h3 className="text-xs font-bold text-[#0F1B2D]">{m.title}</h3>
                    </div>
                    <p className="text-[11px] text-[#6B7280] leading-relaxed">{m.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Privacy Note */}
          <div className="rounded-xl border border-[#D4C3A3] bg-[#F3EBDD]/40 p-4 text-xs text-[#806236] flex items-start gap-2.5">
            <Shield size={16} className="shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              {mode === 'video'
                ? 'Video and audio are processed locally in your browser. No video is ever uploaded or stored on our servers—only your text transcript and summary scores are saved.'
                : 'Your practice transcripts are private to your account. Nothing is shared with platform employers.'}
            </p>
          </div>

          {/* Start CTA */}
          <div className="pt-2 flex justify-end">
            <JobBtn
              primary
              onClick={handleStart}
              disabled={isStarting}
              className="px-6 min-h-[42px] flex items-center gap-2"
            >
              <Mic size={15} />
              {isStarting ? 'Preparing AI Interviewer...' : 'Launch Practice Session'}
            </JobBtn>
          </div>
        </section>
      </div>
    </JobSeekerShell>
  );
}
