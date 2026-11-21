'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bookmark } from 'lucide-react';
import { InvestorShell, Card, Button } from '@/components';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api/client';
import { LoadingBlock, EmptyBlock, ErrorBlock } from '@/components/async-state';
import { InvestorBadge, InvestorDisclaimer } from '../../investor-data';

const STAGE_LABELS = {
  idea: 'Idea',
  prototype: 'Prototype',
  early_revenue: 'Early revenue',
  growth: 'Growth',
  mature: 'Mature',
};

function stageLabel(stage) {
  return STAGE_LABELS[stage] || stage;
}

function formatMoney(value, currency = 'INR') {
  if (value === null || value === undefined || value === '') return '—';
  const num = Number(value);
  if (Number.isNaN(num)) return '—';
  const sym = currency === 'INR' ? '₹' : currency + ' ';
  if (num >= 1e7) return sym + (num / 1e7).toFixed(2).replace(/\.?0+$/, '') + ' Cr';
  if (num >= 1e5) return sym + (num / 1e5).toFixed(2).replace(/\.?0+$/, '') + ' L';
  return sym + num.toLocaleString('en-IN');
}

function commitPct(target, committed) {
  if (target == null || target === 0 || committed == null) return '—';
  return Math.round((Number(committed) / Number(target)) * 100) + '%';
}

export default function InvestorStartupProfilePage({ params }) {
  const startupId = params?.startupId || 'acme';
  const { user } = useAuth();

  const [phase, setPhase] = useState('loading'); // loading|ready|error|none
  const [startup, setStartup] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('Overview');
  const [shortlisted, setShortlisted] = useState(false);
  const [shortlistPhase, setShortlistPhase] = useState('idle');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPhase('loading');
      setError('');
      try {
        const detail = await api.investorDiscovery.get(startupId);
        if (cancelled) return;
        setStartup(detail);
        // Best-effort rounds for the "Round" tab.
        try {
          const roundList = await api.investorDiscovery.rounds(startupId);
          if (cancelled) return;
          setRounds(roundList.items || roundList);
        } catch {
          setRounds([]);
        }
        setPhase('ready');
      } catch (err) {
        if (cancelled) return;
        setPhase(err instanceof ApiError && err.status === 404 ? 'none' : 'error');
        setError(err instanceof ApiError ? err.message : 'Could not load this startup.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [startupId, user?.id]);

  const toggleSave = async () => {
    if (!startup) return;
    setShortlistPhase('saving');
    try {
      if (shortlisted) {
        const entries = await api.investorShortlist.list();
        const target = entries.find((e) => e.startup_org_id === startup.org_id);
        if (target) {
          await api.investorShortlist.remove(target.id);
        }
        setShortlisted(false);
      } else {
        await api.investorShortlist.add({ startup_org_id: startup.org_id });
        setShortlisted(true);
      }
    } catch (err) {
      setShortlistPhase('error');
      setError(err instanceof ApiError ? err.message : 'Could not update the shortlist.');
    } finally {
      if (shortlistPhase !== 'error') setShortlistPhase('idle');
    }
  };

  const tabs = [
    'Overview',
    'Traction',
    'Round',
    'Mentors and readiness',
    'Team',
    'Documents',
    'Updates',
  ];

  return (
    <InvestorShell
      active="Discover startups"
      module="Deal flow"
      title={startup ? startup.name : 'Startup profile'}
      description={startup ? startup.tagline : 'Loading…'}
      backHref="/investor/discover"
      backLabel="← Back to Discover"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/investor/discover"
            className="inline-flex min-h-10 items-center rounded-lg border border-[#E5E1D8] bg-white px-3.5 text-xs font-semibold text-ink hover:bg-[#FAF8F4]"
          >
            ← Discover
          </Link>
          <Button secondary onClick={toggleSave} disabled={shortlistPhase === 'saving'}>
            <Bookmark size={14} />
            {shortlisted ? 'Saved' : 'Save to shortlist'}
          </Button>
        </div>
      }
    >
      {({ notify }) => (
        <>
          {phase === 'loading' && <LoadingBlock label="Loading startup profile…" />}

          {phase === 'none' && (
            <EmptyBlock
              title="Startup not found"
              description="No opted-in startup matches this profile link. It may have been removed from investor discovery."
              action={
                <Link
                  href="/investor/discover"
                  className="rounded-lg bg-ink px-4 py-2 text-xs font-semibold text-white hover:bg-[#1C2B42]"
                >
                  Back to Discover
                </Link>
              }
            />
          )}

          {phase === 'error' && <ErrorBlock message={error} />}

          {phase === 'ready' && startup && (
            <>
              {/* Header Banner */}
              <div className="mb-6 h-28 rounded-2xl bg-ink p-6 text-white relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-[#B8955A]" />
                <div className="flex items-center gap-4">
                  <span className="grid h-16 w-16 place-items-center rounded-2xl bg-[#F3EBDD] text-2xl font-bold text-ink">
                    {(startup.name || '?').charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <h1 className="serif text-2xl font-bold">{startup.name}</h1>
                    <p className="text-xs text-white/70">
                      {startup.sector || 'Sector not shared'} · {startup.city || 'Location not shared'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Badges & Meta strip */}
              <div className="mb-5 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#F3F4F6] px-3 py-1 text-xs font-semibold text-ink">
                  {stageLabel(startup.stage)}
                </span>
                {startup.sector && (
                  <span className="text-xs font-medium text-[#4A5568]">{startup.sector}</span>
                )}
                {startup.mentor_verified && <InvestorBadge>Verified startup</InvestorBadge>}
                {startup.investment_ready && <InvestorBadge gold>Investment Ready</InvestorBadge>}
                {startup.founded_year && (
                  <span className="text-xs text-[#4A5568]">· Founded {startup.founded_year}</span>
                )}
              </div>

              <div className="mb-6 rounded-lg bg-[#FAF8F4] p-3 text-xs text-[#4A5568] border border-[#E5E1D8]">
                Showing data {startup.name} elected to share with verified investors.
                {startup.updated_at
                  ? ` Last updated ${new Date(startup.updated_at).toLocaleDateString()}.`
                  : ''}
              </div>

              {/* Tab Strip (Responsive Scroll) */}
              <div className="mb-6 flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {tabs.map((x) => (
                  <button
                    key={x}
                    type="button"
                    onClick={() => setTab(x)}
                    className={`min-h-10 shrink-0 rounded-lg px-4 text-xs font-semibold transition ${
                      tab === x
                        ? 'bg-ink text-white'
                        : 'border border-[#E5E1D8] bg-white text-[#4A5568] hover:bg-[#FAF8F4] hover:text-ink'
                    }`}
                  >
                    {x}
                  </button>
                ))}
              </div>

              {/* Main 2-column layout */}
              <div className="grid items-start gap-6 xl:grid-cols-3">
                <div className="space-y-6 xl:col-span-2">
                  {tab === 'Overview' && (
                    <>
                      <Card title="Pitch summary">
                        <p className="text-sm leading-relaxed text-ink">
                          {startup.summary || 'No summary shared.'}
                        </p>
                      </Card>
                      <div className="grid gap-4 md:grid-cols-3">
                        <Card title="Problem">
                          <p className="text-xs leading-relaxed text-ink">
                            {startup.problem || 'Not shared.'}
                          </p>
                        </Card>
                        <Card title="Solution">
                          <p className="text-xs leading-relaxed text-ink">
                            {startup.solution || 'Not shared.'}
                          </p>
                        </Card>
                        <Card title="Market">
                          <p className="text-xs leading-relaxed text-ink">
                            {startup.market || 'Not shared.'}
                          </p>
                        </Card>
                      </div>
                      <Card title="Traction highlights">
                        <p className="text-xs leading-relaxed text-ink">
                          {startup.traction_summary ||
                            'Traction metrics are not shared in this profile.'}
                        </p>
                      </Card>
                      <Card title="Business model">
                        <p className="text-xs text-ink">
                          {startup.business_model || 'Not shared.'}
                        </p>
                      </Card>
                    </>
                  )}

                  {tab === 'Traction' && (
                    <Card title="Shared traction metrics">
                      <p className="text-sm leading-relaxed text-ink">
                        {startup.traction_summary ||
                          'Traction metrics are not shared in this profile.'}
                      </p>
                    </Card>
                  )}

                  {tab === 'Round' && (
                    <>
                      <Card title="Fundraising round terms">
                        {startup.round_visible ? (
                          <>
                            <p className="text-xs text-ink font-medium">
                              Target {formatMoney(startup.round_target, startup.round_currency)} ·{' '}
                              {formatMoney(startup.round_committed, startup.round_currency)} committed
                              ({commitPct(startup.round_target, startup.round_committed)})
                            </p>
                            <div className="mt-3 h-2.5 rounded-full bg-[#E5E1D8] overflow-hidden">
                              <div
                                className="h-full rounded-full bg-[#B8955A]"
                                style={{
                                  width: `${
                                    (commitPct(startup.round_target, startup.round_committed) || '0%') ===
                                    '—'
                                      ? 0
                                      : Math.min(
                                          100,
                                          Number(
                                            commitPct(
                                              startup.round_target,
                                              startup.round_committed
                                            ).replace('%', '')
                                          )
                                        )
                                  }%`,
                                }}
                              />
                            </div>
                          </>
                        ) : (
                          <p className="text-xs text-[#4A5568]">
                            This startup has not shared round terms in its investor profile.
                          </p>
                        )}
                      </Card>
                      {rounds.length > 0 && (
                        <Card title="Open rounds on platform">
                          <div className="space-y-2 text-xs">
                            {rounds.map((r) => (
                              <div
                                key={r.id}
                                className="flex items-center justify-between rounded-lg bg-[#FAF8F4] p-3 border border-[#E5E1D8]"
                              >
                                <span className="font-semibold text-ink">
                                  {r.round_type || r.type || 'Round'} ·{' '}
                                  {formatMoney(r.target_amount || r.target, r.currency)}
                                </span>
                                <span className="text-[#4A5568]">
                                  {r.status || r.state || ''}
                                </span>
                              </div>
                            ))}
                          </div>
                        </Card>
                      )}
                    </>
                  )}

                  {tab === 'Mentors and readiness' && (
                    <Card title="Investment Ready · Mentor-verified">
                      <b className="serif text-4xl font-bold text-ink">
                        {startup.readiness_score != null ? startup.readiness_score : '—'} / 100
                      </b>
                      <p className="mt-2 text-xs text-[#4A5568]">
                        {startup.investment_ready
                          ? 'This profile carries the Investment Ready badge, verified through the platform readiness checklist.'
                          : 'Readiness score has not been published for this startup.'}
                      </p>
                    </Card>
                  )}

                  {tab === 'Team' && (
                    <EmptyBlock
                      title="Team details arrive in a later step"
                      description="Founder identities and team details are revealed after an accepted introduction."
                    />
                  )}

                  {tab === 'Documents' && (
                    <EmptyBlock
                      title="Documents arrive in a later step"
                      description="The data room and document sharing are managed in a later step of the deal-flow build."
                    />
                  )}

                  {tab === 'Updates' && (
                    <EmptyBlock
                      title="Updates arrive in a later step"
                      description="Startup profile updates and the activity timeline are surfaced in a later step."
                    />
                  )}
                </div>

                {/* Right Sticky Sidebar */}
                <aside className="space-y-6">
                  <Card title="Thesis fit summary">
                    <p className="text-xs text-[#4A5568]">
                      Deal-fit scoring and your team's thesis notes are computed in a later step.
                    </p>
                  </Card>

                  <Card title="Quick facts">
                    <dl className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <dt className="text-[#4A5568]">Stage</dt>
                        <dd className="font-semibold text-ink">{stageLabel(startup.stage)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-[#4A5568]">Sector</dt>
                        <dd className="font-semibold text-ink">{startup.sector || '—'}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-[#4A5568]">Location</dt>
                        <dd className="font-semibold text-ink">{startup.city || '—'}</dd>
                      </div>
                      {startup.founded_year && (
                        <div className="flex justify-between">
                          <dt className="text-[#4A5568]">Founded</dt>
                          <dd className="font-semibold text-ink">{startup.founded_year}</dd>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <dt className="text-[#4A5568]">Readiness</dt>
                        <dd className="font-semibold text-ink">
                          {startup.readiness_score != null
                            ? `${startup.readiness_score}/100`
                            : '—'}
                        </dd>
                      </div>
                      {startup.website && (
                        <div className="flex justify-between">
                          <dt className="text-[#4A5568]">Website</dt>
                          <dd className="font-semibold text-ink">
                            <a
                              href={startup.website}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="text-[#9A7A45] hover:underline"
                            >
                              Visit
                            </a>
                          </dd>
                        </div>
                      )}
                    </dl>
                  </Card>

                  <Card title="Private team notes">
                    <p className="text-xs text-[#4A5568]">
                      Private notes for your investment team are stored in a later step.
                    </p>
                  </Card>
                </aside>
              </div>

              <InvestorDisclaimer onLearnMore={() => notify('Platform disclaimer opened.')} />
            </>
          )}
        </>
      )}
    </InvestorShell>
  );
}
