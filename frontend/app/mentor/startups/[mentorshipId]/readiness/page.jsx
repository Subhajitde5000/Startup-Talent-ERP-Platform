'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Check,
  CheckCircle2,
  Clock,
  Target,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import MentorPageShell from '../../../mentor-page-shell';
import { Card } from '../../../mentor-data';
import { api, ApiError } from '@/lib/api/client';
import { LoadingBlock, ErrorBlock } from '@/components/async-state';

export default function StartupReadinessPage() {
  const params = useParams();
  const mentorshipId = params?.mentorshipId;

  const [toast, setToast] = useState('');
  const [mentorship, setMentorship] = useState(null);
  const [readiness, setReadiness] = useState(null);
  const [phase, setPhase] = useState('loading'); // loading|ready|error|notfound
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  const notify = (s) => {
    setToast(s);
    setTimeout(() => setToast(''), 2700);
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
        const m = await api.mentorships.get(mentorshipId);
        if (!alive) return;
        setMentorship(m);

        if (m.startup_org_id) {
          try {
            const r = await api.readiness.board(m.startup_org_id);
            if (alive) setReadiness(r);
          } catch {
            // ignore readiness load failure
          }
        }
        setPhase('ready');
      } catch (err) {
        if (!alive) return;
        if (err instanceof ApiError && err.status === 404) {
          setPhase('notfound');
          setError('Mentorship not found.');
        } else {
          setPhase('error');
          setError(err instanceof ApiError ? err.message : 'Could not load readiness board.');
        }
      }
    })();

    return () => { alive = false; };
  }, [mentorshipId, reload]);

  const startup = mentorship?.startup;
  const startupName = startup?.display_name || 'Startup';
  const signedCount = readiness?.summary?.criteria_signed_off || 0;
  const totalCount = readiness?.summary?.criteria_total || 6;
  const scorePct = readiness?.summary?.readiness_pct || Math.round((signedCount / totalCount) * 100);

  return (
    <MentorPageShell
      active="My startups"
      backHref={mentorshipId ? `/mentor/startups/${mentorshipId}` : '/mentor/startups'}
      backLabel={`← ${startupName} Workspace`}
      toast={toast}
      notify={notify}
    >
      {phase === 'loading' && (
        <LoadingBlock label="Loading readiness review..." rows={3} />
      )}

      {phase === 'notfound' && (
        <Card title="Readiness board not found">
          <p className="text-xs text-[#4A5568]">
            This mentorship engagement does not exist or you do not have permission to view it.
          </p>
          <Link href="/mentor/startups" className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#9A7A45]">
            <ArrowRight className="rotate-180" size={13} /> Back to my startups
          </Link>
        </Card>
      )}

      {phase === 'error' && (
        <ErrorBlock message={error || 'Could not load readiness board.'} onRetry={() => setReload(n => n + 1)} />
      )}

      {phase === 'ready' && mentorship && (
        <>
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-[#4A5568]">
                Mentor workspace <span className="mx-2 text-[#B8955A]">·</span> Sessions & sign-off
              </p>
              <h1 className="serif mt-1 text-[30px] font-semibold text-[#0F1B2D]">
                Readiness sign-off
              </h1>
              <p className="mt-1 text-sm text-[#4A5568]">
                Review evidence and track milestone decisions for {startupName}.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/mentor/startups/${mentorship.id}`}
                className="inline-flex min-h-10 items-center rounded-lg border border-[#E5E1D8] bg-white px-3.5 text-xs font-semibold text-[#0F1B2D] hover:bg-[#FAF8F4]"
              >
                Workspace
              </Link>
            </div>
          </div>

          <div className="mb-5 grid gap-5 lg:grid-cols-3">
            <Card title="Readiness score">
              <div className="flex items-center gap-4">
                <div
                  className="grid h-24 w-24 place-items-center rounded-full"
                  style={{
                    background: `conic-gradient(#B8955A 0deg ${Math.round((scorePct / 100) * 360)}deg,#E5E1D8 ${Math.round((scorePct / 100) * 360)}deg 360deg)`,
                  }}
                >
                  <div className="grid h-[72px] w-[72px] place-items-center rounded-full bg-white">
                    <b className="serif text-3xl text-[#0F1B2D]">{scorePct}</b>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-[#4A5568]">out of 100</p>
                  <p className="mt-2 text-xs font-semibold text-[#0F1B2D]">
                    {signedCount} of {totalCount} signed off
                  </p>
                  {readiness?.summary?.is_ready ? (
                    <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#E7F3EC] px-2.5 py-1 text-xs font-semibold text-[#286749]">
                      <ShieldCheck size={12} /> Investment Ready
                    </span>
                  ) : (
                    <span className="mt-2 inline-block rounded-full bg-[#FFF3D6] px-2 py-1 text-xs font-medium text-[#8A5700]">
                      Badge not yet earned
                    </span>
                  )}
                </div>
              </div>
            </Card>

            <div className="lg:col-span-2">
              <Card title="Sign-off progress">
                <div className="mb-2 flex justify-between text-xs font-medium">
                  <span className="text-[#0F1B2D]">{signedCount} of {totalCount} items signed off</span>
                  <b className="text-[#0F1B2D]">{scorePct}%</b>
                </div>
                <div className="h-2 rounded-full bg-[#E5E1D8]">
                  <div
                    className="h-full rounded-full bg-[#B8955A] transition-all"
                    style={{ width: `${scorePct}%` }}
                  />
                </div>
                <p className="mt-4 text-xs text-[#4A5568]">
                  Sign off criteria as your mentee completes deliverables and provides reviewed evidence. Decisions update the startup's investment readiness status.
                </p>
              </Card>
            </div>
          </div>

          <div className="grid items-start gap-5 xl:grid-cols-3">
            <div className="space-y-3 xl:col-span-2">
              {readiness?.items && readiness.items.length > 0 ? (
                readiness.items.map((item) => {
                  const isSigned = item.status === 'signed_off';
                  return (
                    <article key={item.id} className="rounded-xl border border-[#E5E1D8] bg-white p-4 sm:p-5">
                      <div className="flex flex-wrap items-start gap-3">
                        <span
                          className={`grid h-8 w-8 place-items-center rounded-full ${
                            isSigned
                              ? 'bg-[#E7F3EC] text-[#286749]'
                              : item.status === 'submitted'
                              ? 'bg-[#FFF3D6] text-[#8A5700]'
                              : 'bg-[#F3F4F6] text-[#4A5568]'
                          }`}
                        >
                          {isSigned ? (
                            <Check size={16} />
                          ) : item.status === 'submitted' ? (
                            <Clock size={15} />
                          ) : (
                            <Target size={15} />
                          )}
                        </span>
                        <div className="min-w-[180px] flex-1">
                          <h2 className="text-sm font-semibold text-[#0F1B2D]">{item.title}</h2>
                          <p className="mt-1 text-xs leading-5 text-[#4A5568]">
                            {item.description || 'Verified evidence demonstrating startup readiness.'}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[#4A5568]">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                isSigned
                                  ? 'bg-[#E7F3EC] text-[#286749]'
                                  : item.status === 'submitted'
                                  ? 'bg-[#FFF3D6] text-[#8A5700]'
                                  : 'bg-[#F3F4F6]'
                              }`}
                            >
                              {item.status.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="rounded-xl border border-[#E5E1D8] bg-white p-8 text-center text-xs text-[#4A5568]">
                  No readiness criteria configured yet for {startupName}.
                </div>
              )}
            </div>

            <aside className="space-y-5">
              <Card title="Startup details">
                <b className="text-sm text-[#0F1B2D]">{startupName}</b>
                <p className="mt-1 text-xs text-[#4A5568]">
                  {startup?.stage ? (startup.stage) : 'Stage not specified'}
                </p>
                <div className="mt-3 border-t border-[#E5E1D8] pt-3 text-xs text-[#4A5568]">
                  <Link href={`/mentor/startups/${mentorship.id}`} className="font-semibold text-[#9A7A45]">
                    Open full workspace →
                  </Link>
                </div>
              </Card>
            </aside>
          </div>
        </>
      )}
    </MentorPageShell>
  );
}
