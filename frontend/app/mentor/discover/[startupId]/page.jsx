'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Globe,
  MapPin,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Compass,
} from 'lucide-react';
import MentorPageShell from '../../mentor-page-shell';
import { Btn, Card } from '../../mentor-data';
import { api, ApiError } from '@/lib/api/client';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/async-state';
import {
  STAGE_LABEL,
  MENTORSHIP_STATUS_CHIP,
  MENTORSHIP_STATUS_LABEL,
} from '@/lib/mentorship-labels';

export default function MentorDiscoverStartupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const startupId = params?.startupId;

  const [toast, setToast] = useState('');
  const [startup, setStartup] = useState(null);
  const [phase, setPhase] = useState('loading'); // 'loading' | 'ready' | 'notfound' | 'error'
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  const notify = (x) => {
    setToast(x);
    setTimeout(() => setToast(''), 2600);
  };

  useEffect(() => {
    if (!startupId) {
      setPhase('notfound');
      return undefined;
    }

    let alive = true;
    (async () => {
      setPhase('loading');
      setError('');
      try {
        const data = await api.startups.get(String(startupId));
        if (!alive) return;
        setStartup(data);
        setPhase('ready');
      } catch (err) {
        if (!alive) return;
        if (err instanceof ApiError && err.status === 404) {
          setPhase('notfound');
        } else {
          setError(
            err instanceof ApiError
              ? err.message
              : 'Could not load startup profile.',
          );
          setPhase('error');
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [startupId, reload]);

  return (
    <MentorPageShell active="Discover startups" toast={toast} notify={notify}>
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs text-[#4A5568]">
          <Link
            href="/mentor/discover"
            className="inline-flex items-center gap-1 font-medium text-[#0F1B2D] hover:underline"
          >
            <ArrowLeft size={13} />
            Back to discover
          </Link>
          <span className="text-[#B8955A]">·</span>
          <span>Startup Profile</span>
        </div>
      </div>

      {phase === 'loading' && (
        <LoadingBlock label="Loading startup profile…" rows={5} />
      )}

      {phase === 'notfound' && (
        <EmptyBlock
          title="Startup not found"
          hint="This startup may not exist or has not enabled mentor discovery visibility."
          action={
            <Btn onClick={() => router.push('/mentor/discover')}>
              Return to directory
            </Btn>
          }
        />
      )}

      {phase === 'error' && (
        <ErrorBlock
          message={error || 'Failed to load startup details.'}
          onRetry={() => setReload((n) => n + 1)}
        />
      )}

      {phase === 'ready' && startup && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="rounded-2xl border border-[#E5E1D8] bg-white p-6 md:p-8 shadow-sm">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div className="flex items-start gap-4">
                <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-[#F3EBDD] font-serif text-2xl font-bold text-[#806236] shadow-inner">
                  {(startup.name || '?').slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="serif text-2xl font-bold text-[#0F1B2D] md:text-3xl">
                      {startup.name}
                    </h1>
                    {startup.mentor_verified && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#EBF6EE] px-2.5 py-0.5 text-xs font-semibold text-[#1B6E32]">
                        <ShieldCheck size={13} />
                        Mentor Verified
                      </span>
                    )}
                    {startup.stage && (
                      <span className="rounded-full bg-[#F4F1EA] px-2.5 py-0.5 text-xs font-medium text-[#4A5568]">
                        {STAGE_LABEL[startup.stage] || startup.stage}
                      </span>
                    )}
                  </div>

                  {startup.tagline && (
                    <p className="mt-2 text-base text-[#4A5568] max-w-2xl">
                      {startup.tagline}
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-[#6B7280]">
                    {startup.sector && (
                      <span className="inline-flex items-center gap-1">
                        <Building2 size={13} className="text-[#A0A7B4]" />
                        {startup.sector}
                      </span>
                    )}
                    {(startup.city || startup.country) && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={13} className="text-[#A0A7B4]" />
                        {[startup.city, startup.region, startup.country]
                          .filter(Boolean)
                          .join(', ')}
                      </span>
                    )}
                    {startup.founded_year && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar size={13} className="text-[#A0A7B4]" />
                        Founded {startup.founded_year}
                      </span>
                    )}
                    {startup.website && (
                      <a
                        href={
                          startup.website.startsWith('http')
                            ? startup.website
                            : `https://${startup.website}`
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-[#9A7A45] hover:underline"
                      >
                        <Globe size={13} />
                        Visit website
                        <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Status / Workspace Link */}
              <div className="flex flex-col gap-2 shrink-0 md:items-end">
                {startup.existing_mentorship_id ? (
                  <div className="flex flex-col gap-2 md:items-end">
                    <div className="inline-flex items-center gap-1.5 rounded-lg border border-[#D5E3D8] bg-[#F3F9F4] px-3 py-1.5 text-xs font-semibold text-[#1B6E32]">
                      <CheckCircle2 size={13} />
                      Engagement:{' '}
                      {MENTORSHIP_STATUS_LABEL[startup.existing_mentorship_status] ||
                        startup.existing_mentorship_status}
                    </div>
                    <Btn
                      onClick={() =>
                        router.push(
                          `/mentor/startups/${startup.existing_mentorship_id}`,
                        )
                      }
                      className="whitespace-nowrap"
                    >
                      Open Mentorship Workspace →
                    </Btn>
                  </div>
                ) : (
                  <div className="rounded-xl border border-[#E7D4B0] bg-[#FFFBF0] p-4 text-right md:max-w-xs">
                    <p className="text-xs font-semibold text-[#806236]">
                      Interested in mentoring?
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-[#73572E]">
                      Startups initiate mentorship requests directly. When this
                      startup sends a request to you, it will appear in your
                      Requests tab.
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        notify(
                          'Startups review mentor profiles and initiate requests. Keep your profile and preferences up to date!',
                        )
                      }
                      className="mt-2 text-xs font-semibold text-[#9A7A45] hover:underline"
                    >
                      Learn how matching works
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Grid of details */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left 2 Cols: Main Pitch & Deep Dives */}
            <div className="space-y-6 lg:col-span-2">
              {/* Executive Summary */}
              <Card title="About & Overview">
                {startup.summary ? (
                  <p className="whitespace-pre-line text-sm leading-relaxed text-[#374151]">
                    {startup.summary}
                  </p>
                ) : (
                  <p className="text-sm italic text-[#9CA3AF]">
                    No executive summary provided.
                  </p>
                )}
              </Card>

              {/* Problem & Solution */}
              <div className="grid gap-6 md:grid-cols-2">
                <section className="rounded-xl border border-[#E5E1D8] bg-white p-5 sm:p-6">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#FEE2E2] text-[#B91C1C]">
                      <Target size={15} />
                    </span>
                    <h2 className="text-[15px] font-semibold text-[#0F1B2D]">
                      The Problem
                    </h2>
                  </div>
                  {startup.problem ? (
                    <p className="whitespace-pre-line text-xs leading-relaxed text-[#4A5568]">
                      {startup.problem}
                    </p>
                  ) : (
                    <p className="text-xs italic text-[#9CA3AF]">
                      Problem statement not shared publicly.
                    </p>
                  )}
                </section>

                <section className="rounded-xl border border-[#E5E1D8] bg-white p-5 sm:p-6">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#E0F2FE] text-[#0369A1]">
                      <Sparkles size={15} />
                    </span>
                    <h2 className="text-[15px] font-semibold text-[#0F1B2D]">
                      The Solution
                    </h2>
                  </div>
                  {startup.solution ? (
                    <p className="whitespace-pre-line text-xs leading-relaxed text-[#4A5568]">
                      {startup.solution}
                    </p>
                  ) : (
                    <p className="text-xs italic text-[#9CA3AF]">
                      Solution details not shared publicly.
                    </p>
                  )}
                </section>
              </div>

              {/* Business Model & Target Market */}
              <Card title="Business Model & Market">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                      Business & Revenue Model
                    </h3>
                    <p className="mt-1 text-sm text-[#374151]">
                      {startup.business_model || (
                        <span className="italic text-[#9CA3AF]">
                          Not shared.
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="border-t border-[#F3F0EA] pt-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                      Target Market & Customer
                    </h3>
                    <p className="mt-1 text-sm text-[#374151]">
                      {startup.market || (
                        <span className="italic text-[#9CA3AF]">
                          Not shared.
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </Card>

              {/* Traction Summary */}
              <Card title="Traction & Milestones">
                {startup.traction_summary ? (
                  <p className="whitespace-pre-line text-sm leading-relaxed text-[#374151]">
                    {startup.traction_summary}
                  </p>
                ) : (
                  <p className="text-sm italic text-[#9CA3AF]">
                    Traction details have not been made visible.
                  </p>
                )}
              </Card>
            </div>

            {/* Right 1 Col: Readiness, Goals & External Media */}
            <div className="space-y-6">
              {/* Readiness Score Card */}
              <Card title="Readiness & Audit">
                <div className="flex items-center gap-4">
                  <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#FAF8F4] border border-[#E5E1D8]">
                    <span className="font-serif text-xl font-bold text-[#0F1B2D]">
                      {startup.readiness_score !== null &&
                      startup.readiness_score !== undefined
                        ? startup.readiness_score
                        : '—'}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#0F1B2D]">
                      Investor & Operational Readiness
                    </p>
                    <p className="text-[11px] text-[#6B7280]">
                      {startup.readiness_score !== null &&
                      startup.readiness_score !== undefined
                        ? 'Computed from verified milestones and institutional audits.'
                        : 'Readiness score is private or pending assessment.'}
                    </p>
                  </div>
                </div>
              </Card>

              {/* Ecosystem Goals */}
              <Card title="Collaboration Goals">
                {startup.ecosystem_goals && startup.ecosystem_goals.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {startup.ecosystem_goals.map((g, idx) => (
                      <span
                        key={idx}
                        className="rounded-lg border border-[#E5E1D8] bg-[#FAF8F4] px-2.5 py-1 text-xs font-medium text-[#4A5568]"
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs italic text-[#9CA3AF]">
                    No specific collaboration goals listed.
                  </p>
                )}
              </Card>

              {/* Resources & Artifacts */}
              <Card title="Materials & Demos">
                <div className="space-y-3">
                  {startup.demo_url ? (
                    <a
                      href={
                        startup.demo_url.startsWith('http')
                          ? startup.demo_url
                          : `https://${startup.demo_url}`
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between rounded-lg border border-[#E5E1D8] p-3 text-xs font-semibold text-[#0F1B2D] hover:bg-[#FAF8F4]"
                    >
                      <span className="flex items-center gap-2">
                        <Compass size={14} className="text-[#9A7A45]" />
                        Product Demo / Interactive Link
                      </span>
                      <ExternalLink size={12} className="text-[#A0A7B4]" />
                    </a>
                  ) : null}

                  {startup.pitch_deck_url ? (
                    <a
                      href={
                        startup.pitch_deck_url.startsWith('http')
                          ? startup.pitch_deck_url
                          : `https://${startup.pitch_deck_url}`
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between rounded-lg border border-[#E5E1D8] p-3 text-xs font-semibold text-[#0F1B2D] hover:bg-[#FAF8F4]"
                    >
                      <span className="flex items-center gap-2">
                        <TrendingUp size={14} className="text-[#9A7A45]" />
                        Pitch Deck / Deck Presentation
                      </span>
                      <ExternalLink size={12} className="text-[#A0A7B4]" />
                    </a>
                  ) : null}

                  {!startup.demo_url && !startup.pitch_deck_url && (
                    <p className="text-xs italic text-[#9CA3AF]">
                      No additional public links shared.
                    </p>
                  )}
                </div>
              </Card>

              {/* How Mentorship Works Reminder */}
              <div className="rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] p-5">
                <h3 className="flex items-center gap-2 text-xs font-semibold text-[#0F1B2D]">
                  <Users size={14} className="text-[#9A7A45]" />
                  Mentor Advisory Policy
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-[#6B7280]">
                  Forma empowers founders to seek guidance from vetted mentors.
                  Sessions, task boards, and milestones are tracked
                  transparently inside each active engagement workspace.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </MentorPageShell>
  );
}
