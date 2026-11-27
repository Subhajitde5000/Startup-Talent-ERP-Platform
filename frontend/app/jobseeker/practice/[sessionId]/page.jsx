'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Play,
  Send,
  Sparkles,
  Clock,
  CheckCircle2,
  Award,
} from 'lucide-react';
import { JobSeekerShell } from '@/components';
import { JobBtn } from '@/components/jobseeker-ui';
import { api } from '@/lib/api/client';
import { useCareerResource, ResourceState, errorLabel } from '@/components/career-data';
import { FieldError, fieldErrorsFrom } from '@/components/async-state';

export default function LivePracticeSessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = typeof params?.sessionId === 'string' ? params.sessionId : '';

  const sessionRes = useCareerResource(
    sessionId ? `practice:session:${sessionId}` : null,
    (signal) => api.practice.getSession(sessionId, signal),
  );

  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [starting, setStarting] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [aiNotice, setAiNotice] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const session = sessionRes.data;
  const isInProgress = session?.status === 'in_progress';

  useEffect(() => {
    if (!isInProgress) return undefined;
    const interval = setInterval(() => setSeconds((prev) => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [isInProgress]);

  const formatTimer = (sec) => {
    const mins = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${mins}:${rem < 10 ? '0' : ''}${rem}`;
  };

  const handleStart = async () => {
    if (!sessionId) return;
    setStarting(true);
    setError('');
    try {
      await api.practice.startSession(sessionId);
      sessionRes.reload();
    } catch (err) {
      setError(errorLabel(err, 'Could not start session.'));
    } finally {
      setStarting(false);
    }
  };

  const handleSubmitTurn = async (e) => {
    e.preventDefault();
    if (!sessionId || !answer.trim()) return;
    setSubmitting(true);
    setError('');
    setFieldErrors({});
    try {
      const resp = await api.practice.submitTurn(sessionId, {
        content: answer.trim(),
      });
      setAnswer('');
      if (resp.ai_notice) setAiNotice(resp.ai_notice);
      sessionRes.reload();
    } catch (err) {
      setFieldErrors(fieldErrorsFrom(err));
      setError(errorLabel(err, 'Could not submit response.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleScore = async () => {
    if (!sessionId) return;
    setScoring(true);
    setError('');
    try {
      await api.practice.scoreSession(sessionId, { duration_sec: seconds });
      router.push(`/jobseeker/practice/${sessionId}/report`);
    } catch (err) {
      setError(errorLabel(err, 'Could not generate AI score report.'));
      setScoring(false);
    }
  };

  const candidateTurnsCount = (session?.turns || []).filter((t) => t.speaker === 'candidate').length;
  const currentQuestionNum = Math.min(
    candidateTurnsCount + 1,
    session?.question_count || 1,
  );

  return (
    <JobSeekerShell active="Interview practice">
      <div className="space-y-6 max-w-4xl pb-10">
        <ResourceState
          resource={sessionRes}
          empty={!sessionRes.loading && !sessionRes.error && !session}
          emptyTitle="Practice session not found"
          emptyBody="This session may have been deleted or belongs to another account."
          onRetry={sessionRes.reload}
        >
          {session && (
            <>
              {/* Header bar */}
              <header className="rounded-2xl border border-[#E5E1D8] bg-[#0F1B2D] p-5 text-white flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-semibold text-[#B8955A] uppercase tracking-wider block mb-0.5">
                    Live AI Practice Studio
                  </span>
                  <h1 className="text-lg md:text-xl font-serif font-bold text-white">
                    {session.title || session.target_role || 'Practice Session'}
                  </h1>
                  <p className="text-xs text-white/70 mt-0.5">
                    Question {currentQuestionNum} of {session.question_count} ·{' '}
                    <span className="capitalize">{session.status.replace('_', ' ')}</span>
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="rounded-xl border border-white/20 bg-white/10 px-3.5 py-1.5 flex items-center gap-2 text-xs">
                    <Clock size={14} className="text-[#B8955A]" />
                    <span className="font-mono text-sm font-semibold">{formatTimer(seconds)}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {session.is_video_mode && session.status !== 'completed' && (
                      <Link href={`/jobseeker/practice/${session.id}/video`}>
                        <button
                          type="button"
                          className="rounded-xl bg-[#B8955A] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#9A7A45]"
                        >
                          Open Video Studio
                        </button>
                      </Link>
                    )}
                    <Link href="/jobseeker/practice">
                      <button
                        type="button"
                        className="rounded-xl border border-white/20 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10"
                      >
                        Exit Studio
                      </button>
                    </Link>
                  </div>
                </div>
              </header>

              {error && (
                <div className="rounded-xl border border-[#F2C6C2] bg-[#FEF3F2] px-4 py-3 text-xs text-[#B42318]">
                  {error}
                </div>
              )}

              {aiNotice && (
                <div className="rounded-xl border border-[#D4C3A3] bg-[#FFF8E8] px-4 py-2.5 text-xs text-[#806236]">
                  {aiNotice}
                </div>
              )}

              {session.status === 'scheduled' && (
                <div className="rounded-2xl border border-[#E5E1D8] bg-white p-6 text-center space-y-3">
                  <h2 className="text-base font-serif font-bold text-[#0F1B2D]">
                    Ready to begin your mock interview?
                  </h2>
                  <p className="text-xs text-[#6B7280] max-w-md mx-auto">
                    Your AI interviewer will ask {session.question_count} targeted questions and adapt based on your responses.
                  </p>
                  <JobBtn
                    primary
                    onClick={handleStart}
                    disabled={starting}
                    className="inline-flex items-center gap-1.5"
                  >
                    <Play size={14} /> {starting ? 'Starting...' : 'Start Session'}
                  </JobBtn>
                </div>
              )}

              {session.status === 'completed' && (
                <div className="rounded-2xl border border-[#CDE5D7] bg-[#E7F3EC] p-5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-[#286749] font-medium">
                    <CheckCircle2 size={16} />
                    This session is completed (Score: {session.score ?? '—'}%).
                  </div>
                  <Link href={`/jobseeker/practice/${session.id}/report`}>
                    <JobBtn primary small className="flex items-center gap-1.5">
                      <Award size={13} /> View Feedback Report
                    </JobBtn>
                  </Link>
                </div>
              )}

              {/* Transcript Feed */}
              <section className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm space-y-4">
                <h2 className="text-sm font-serif font-bold text-[#0F1B2D]">
                  Interview Transcript
                </h2>

                {(session.turns || []).length === 0 ? (
                  <p className="text-xs text-[#6B7280] py-4">
                    Click &ldquo;Start Session&rdquo; to receive your first interview question.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {session.turns.map((turn) => {
                      const isInterviewer = turn.speaker === 'interviewer';
                      return (
                        <div
                          key={turn.id}
                          className={`rounded-xl p-4 text-xs leading-relaxed ${
                            isInterviewer
                              ? 'border border-[#D4C3A3] bg-[#FAF8F4] text-[#0F1B2D]'
                              : 'border border-[#CDE5D7] bg-[#E7F3EC]/40 text-[#1F2937] ml-6'
                          }`}
                        >
                          <span className="font-bold uppercase tracking-wider text-[10px] block mb-1 text-[#806236]">
                            {isInterviewer ? 'AI Interviewer' : 'Your Response'}
                          </span>
                          <p className="whitespace-pre-line">{turn.content}</p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Candidate Response Form */}
                {session.status !== 'completed' && session.status !== 'abandoned' && (
                  <form onSubmit={handleSubmitTurn} className="pt-4 border-t border-[#F0EBE0] space-y-3">
                    <label htmlFor="candidateAnswer" className="block text-xs font-semibold text-[#4A5568]">
                      Your Response
                    </label>
                    <textarea
                      id="candidateAnswer"
                      rows={4}
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      placeholder="Write your structured response here (e.g. Situation, Task, Action, Result)..."
                      className="w-full p-3 rounded-xl border border-[#E5E1D8] text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                    />
                    <FieldError message={fieldErrors.content} />

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <JobBtn
                        secondary
                        small
                        type="button"
                        disabled={scoring || candidateTurnsCount === 0}
                        onClick={handleScore}
                        className="flex items-center gap-1.5"
                      >
                        <Sparkles size={13} className="text-[#806236]" />
                        {scoring ? 'Evaluating via AI...' : 'Finish & Score Session'}
                      </JobBtn>

                      <JobBtn
                        primary
                        small
                        type="submit"
                        disabled={submitting || !answer.trim()}
                        className="flex items-center gap-1.5"
                      >
                        <Send size={13} />
                        {submitting ? 'Sending...' : 'Submit Response'}
                      </JobBtn>
                    </div>
                  </form>
                )}
              </section>
            </>
          )}
        </ResourceState>
      </div>
    </JobSeekerShell>
  );
}
