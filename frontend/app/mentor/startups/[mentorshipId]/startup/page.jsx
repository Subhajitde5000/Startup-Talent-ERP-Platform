'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  LockKeyhole,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
} from 'lucide-react';
import MentorPageShell from '../../../mentor-page-shell';
import { Card } from '../../../mentor-data';
import { api, ApiError } from '@/lib/api/client';
import { LoadingBlock, ErrorBlock } from '@/components/async-state';
import { STAGE_LABEL } from '@/lib/mentorship-labels';

export default function MenteeStartupProfilePage() {
  const params = useParams();
  const mentorshipId = params?.mentorshipId;

  const [toast, setToast] = useState('');
  const [mentorship, setMentorship] = useState(null);
  const [readiness, setReadiness] = useState(null);
  const [phase, setPhase] = useState('loading'); // loading|ready|error|notfound
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  const notify = (x) => {
    setToast(x);
    setTimeout(() => setToast(''), 2600);
  };

  useEffect(() => {
    if (!mentorshipId) {
      setPhase('notfound');
      return undefined;
    }
    let alive = true;
    setPhase('loading');
    setError('');

    (async () => {
      try {
        const { mentorship: m } = await api.mentorWorkspace.get(mentorshipId);
        if (!alive) return;
        setMentorship(m);

        if (m.startup_org_id) {
          const r = await api.mentorWorkspace.readiness(mentorshipId);
          if (alive) setReadiness(r);
        }
        setPhase('ready');
      } catch (err) {
        if (!alive) return;
        if (err instanceof ApiError && err.status === 404) {
          setPhase('notfound');
          setError('Mentorship not found.');
        } else {
          setPhase('error');
          setError(err instanceof ApiError ? err.message : 'Could not load startup profile.');
        }
      }
    })();

    return () => { alive = false; };
  }, [mentorshipId, reload]);

  const startup = mentorship?.startup;
  const startupName = startup?.display_name || 'Startup';
  const startupStage = startup?.stage ? (STAGE_LABEL[startup.stage] || startup.stage) : 'Stage not specified';
  const readinessSigned = readiness?.summary?.criteria_signed_off ?? 0;
  const readinessTotal = readiness?.summary?.criteria_total ?? 0;
  const readinessPct = readiness?.summary?.readiness_pct ?? 0;

  return (
    <MentorPageShell
      active="My startups"
      backHref={mentorshipId ? `/mentor/startups/${mentorshipId}` : '/mentor/startups'}
      backLabel={`← ${startupName} Workspace`}
      toast={toast}
      notify={notify}
    >
      {phase === 'loading' && (
        <LoadingBlock label="Loading startup profile..." rows={3} />
      )}

      {phase === 'notfound' && (
        <Card title="Startup profile not found">
          <p className="text-xs text-[#4A5568]">
            This mentorship engagement does not exist or you do not have permission to view it.
          </p>
          <Link href="/mentor/startups" className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#9A7A45]">
            <ArrowRight className="rotate-180" size={13} /> Back to my startups
          </Link>
        </Card>
      )}

      {phase === 'error' && (
        <ErrorBlock message={error || 'Could not load startup profile.'} onRetry={() => setReload(n => n + 1)} />
      )}

      {phase === 'ready' && mentorship && (
        <>
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-[#4A5568]">
                Mentor workspace <span className="mx-2 text-[#B8955A]">·</span> {startupName}
              </p>
              <h1 className="serif mt-1 text-[30px] font-semibold text-[#0F1B2D]">
                {startupName} · Overview
              </h1>
              <p className="mt-1 text-sm text-[#4A5568]">
                Read-only view of information {startupName} has chosen to share.
              </p>
            </div>
            <Link
              href={`/mentor/startups/${mentorship.id}`}
              className="inline-flex min-h-10 items-center rounded-lg bg-[#0F1B2D] px-3.5 text-xs font-semibold text-white hover:bg-[#1C2B42]"
            >
              Open workspace
            </Link>
          </div>

          <div className="mb-5 flex items-center gap-2 rounded-lg border border-[#E5E1D8] bg-white p-3 text-xs text-[#4A5568]">
            <LockKeyhole size={15} className="text-[#9A7A45]" />
            Read-only view. Showing profile and readiness details shared with you as a mentor.
          </div>

          <div className="grid items-start gap-5 xl:grid-cols-3">
            <div className="space-y-5 xl:col-span-2">
              <Card title="Startup profile">
                <div className="flex items-start gap-4">
                  <span className="grid h-16 w-16 place-items-center rounded-2xl bg-[#F3EBDD] font-serif text-2xl font-semibold text-[#806236]">
                    {startup?.avatar_initials || startupName.slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <h2 className="serif text-2xl font-semibold text-[#0F1B2D]">{startupName}</h2>
                    {startup?.tagline && <p className="mt-1 text-sm text-[#4A5568]">{startup.tagline}</p>}
                    <span className="mt-2 inline-block rounded-full bg-[#F3EBDD] px-2.5 py-1 text-xs font-semibold text-[#806236]">
                      Stage: {startupStage}
                    </span>
                    <span className="ml-2 inline-flex items-center rounded-full bg-[#E7F3EC] px-2.5 py-1 text-xs font-semibold text-[#286749]">
                      <ShieldCheck className="mr-1" size={11} />
                      Verified startup
                    </span>
                  </div>
                </div>
                <div className="mt-4 border-t border-[#E5E1D8] pt-3 text-xs text-[#4A5568]">
                  {startup?.sector && <span>Sector: {startup.sector} · </span>}
                  {startup?.city && <span>Location: {startup.city}</span>}
                </div>
              </Card>

              {mentorship.goal && (
                <Card title="Mentorship focus & goals">
                  <p className="text-xs font-medium text-[#4A5568]">Primary Goal</p>
                  <p className="mt-1 text-sm font-semibold text-[#0F1B2D]">{mentorship.goal}</p>

                  {mentorship.needs && mentorship.needs.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-[#4A5568]">Focus Areas</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {mentorship.needs.map(n => (
                          <span key={n} className="rounded-md bg-[#FAF8F4] border border-[#E5E1D8] px-2.5 py-1 text-xs text-[#0F1B2D]">
                            {n}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              )}
            </div>

            <aside className="space-y-5">
              <Card title="Readiness sign-off">
                <div className="flex items-center gap-3">
                  <div className="h-2 flex-1 rounded-full bg-[#E5E1D8]">
                    <div
                      className="h-full rounded-full bg-[#B8955A] transition-all"
                      style={{ width: `${readinessPct}%` }}
                    />
                  </div>
                  <b className="text-xs text-[#0F1B2D]">{readinessSigned} / {readinessTotal}</b>
                </div>
                <p className="mt-2 text-xs text-[#4A5568]">
                  {readiness?.summary?.is_ready
                    ? 'Investment Ready badge earned.'
                    : 'Investment Ready badge not yet earned.'}
                </p>
                <Link
                  href={`/mentor/startups/${mentorship.id}/readiness`}
                  className="mt-3 inline-block text-xs font-semibold text-[#9A7A45]"
                >
                  Review sign-off checklist <ArrowRight className="inline" size={12} />
                </Link>
              </Card>

              <Card title="Engagement details">
                <p className="text-xs font-medium text-[#0F1B2D]">Cadence: {mentorship.cadence || 'Flexible'}</p>
                <p className="mt-1 text-xs text-[#4A5568]">
                  Fee: {mentorship.fee_amount ? `${mentorship.currency} ${mentorship.fee_amount} per session` : 'Unpaid / standard'}
                </p>
                {mentorship.equity_pct ? (
                  <p className="mt-1 text-xs text-[#4A5568]">Equity: {mentorship.equity_pct}%</p>
                ) : null}
                <Link
                  href={`/mentor/startups/${mentorship.id}`}
                  className="mt-3 inline-block text-xs font-semibold text-[#9A7A45]"
                >
                  Open mentorship workspace <ArrowRight className="inline" size={12} />
                </Link>
              </Card>
            </aside>
          </div>
        </>
      )}
    </MentorPageShell>
  );
}
