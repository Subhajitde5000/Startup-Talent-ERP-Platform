'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, FileSearch, X } from 'lucide-react';
import { InvestorShell, Card, Button } from '@/components';
import { LoadingBlock, EmptyBlock, ErrorBlock } from '@/components/async-state';
import { api } from '@/lib/api/client';
import { InvestorDisclaimer } from '../investor-data';

export default function InvestorDashboardPage() {
  const [summary, setSummary] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState([]);
  const [drawer, setDrawer] = useState(null);
  const [modal, setModal] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [dash, discover] = await Promise.all([
        api.workspace.dashboardSummary(),
        api.investorDiscovery.list({ limit: 10 }),
      ]);
      setSummary(dash);
      setMatches(discover.items);
    } catch (err) {
      setError(err?.message || 'Could not load your dashboard.');
      setSummary(null);
      setMatches([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <InvestorShell
      active="Dashboard"
      module="Investor workspace"
      title="Good evening, Arjun"
      description="Your deal flow, conversations and upcoming meetings."
      actions={
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[#E7F3EC] px-3 py-1.5 text-xs font-semibold text-[#286749]">
            ✓ Verified investor
          </span>
        </div>
      }
    >
      {({ notify }) => {
        const toggleSave = (id) => {
          setSaved((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
          notify(saved.includes(id) ? 'Removed from shortlist.' : 'Saved to shortlist.');
        };

        const startupCard = (s) => (
          <article
            key={s.org_id}
            className="rounded-xl border border-[#E5E1D8] bg-white p-5 transition hover:shadow-sm"
          >
            <div className="flex items-start gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#F3EBDD] text-lg font-semibold text-ink">
                {(s.name || '?').slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/investor/startups/${s.slug}`}
                    className="text-sm font-semibold text-ink hover:underline"
                  >
                    {s.name}
                  </Link>
                  {s.investment_ready && (
                    <span className="rounded-full bg-[#F3EBDD] px-2.5 py-0.5 text-xs font-semibold text-[#806236]">
                      Investment Ready
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-[#4A5568]">{s.tagline || '—'}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="rounded-full bg-[#F3F4F6] px-2.5 py-1 text-xs text-[#4A5568]">
                    {s.stage}
                  </span>
                  <span className="rounded-full bg-[#F3F4F6] px-2.5 py-1 text-xs text-[#4A5568]">
                    {s.sector || '—'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                aria-label={`Actions for ${s.name}`}
                onClick={() => setDrawer(s)}
                className="text-[#4A5568] hover:text-ink"
              >
                <FileSearch size={18} />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
              <div>
                <span className="block text-xs text-[#4A5568]">Location</span>
                <b className="font-semibold">{s.city || '—'}</b>
              </div>
              <div>
                <span className="block text-xs text-[#4A5568]">Readiness</span>
                <b className="font-semibold text-ink">{s.readiness_score ?? '—'}/100</b>
              </div>
              <div>
                <span className="block text-xs text-[#4A5568]">Round target</span>
                <b className="font-semibold">
                  {s.round_visible ? `${s.round_target ?? '—'} ${s.round_currency || ''}` : '—'}
                </b>
              </div>
              <div>
                <span className="block text-xs text-[#4A5568]">Committed</span>
                <b className="font-semibold">
                  {s.round_visible ? `${s.round_committed ?? '—'} ${s.round_currency || ''}` : '—'}
                </b>
              </div>
            </div>

            <div className="mt-3 rounded-lg bg-[#FAF8F4] p-2.5 text-xs">
              <b className="text-[#806236]">Traction</b> · {s.traction_summary || 'No traction summary shared.'}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E1D8] pt-3">
              <span className="text-xs text-[#4A5568]">
                Profile updated · {new Date(s.updated_at).toLocaleDateString()}
              </span>
              <div className="flex items-center gap-2">
                <Link
                  href={`/investor/startups/${s.slug}`}
                  className="rounded-lg border border-[#E5E1D8] bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-[#FAF8F4]"
                >
                  View profile
                </Link>
                <button
                  type="button"
                  onClick={() => toggleSave(s.org_id)}
                  className="rounded-lg border border-[#E5E1D8] bg-white px-3 py-1.5 text-xs font-medium text-ink hover:bg-[#FAF8F4]"
                >
                  {saved.includes(s.org_id) ? 'Saved' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDrawer(s);
                    setModal('intro');
                  }}
                  className="rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1C2B42]"
                >
                  Request intro
                </button>
              </div>
            </div>
          </article>
        );

        return (
          <>
            {loading && <LoadingBlock label="Loading your dashboard…" />}
            {!loading && error && !summary && <ErrorBlock message={error} onRetry={load} />}

            {!loading && summary && (
              <>
                {/* Top Stat Strip */}
                <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {[
                    ['New matches this week', summary.new_matches_this_week, '+ this week'],
                    [
                      'Intro requests awaiting reply',
                      summary.requests_awaiting_reply,
                      'awaiting your reply',
                    ],
                    ['Meetings this week', summary.meetings_this_week, 'scheduled'],
                    ['Startups in pipeline', summary.startups_in_pipeline, 'tracked'],
                  ].map(([label, value, hint]) => (
                    <div key={label} className="rounded-xl border border-[#E5E1D8] bg-white p-5">
                      <span className="text-xs font-medium text-[#4A5568]">{label}</span>
                      <span className="serif mt-1 block text-3xl font-semibold text-ink">{value}</span>
                      <span className="text-xs text-[#2E7D5B]">{hint}</span>
                    </div>
                  ))}
                </div>

                {/* Main 2-column layout */}
                <div className="grid items-start gap-6 xl:grid-cols-3">
                  <div className="space-y-6 xl:col-span-2">
                    {/* Matches Section */}
                    <Card
                      title="New matches for you · Suggested"
                      action={
                        <Link
                          href="/investor/discover"
                          className="text-xs font-semibold text-[#9A7A45] hover:underline"
                        >
                          View all matches →
                        </Link>
                      }
                    >
                      {matches.length === 0 ? (
                        <EmptyBlock
                          title="No matches yet"
                          hint="Matched startups will appear here as your search criteria surface new deal flow."
                        >
                          <Link
                            href="/investor/discover"
                            className="inline-flex min-h-9 items-center rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs font-semibold text-ink hover:bg-[#FAF8F4]"
                          >
                            Browse discovery
                          </Link>
                        </EmptyBlock>
                      ) : (
                        <div className="space-y-4">{matches.slice(0, 2).map(startupCard)}</div>
                      )}
                    </Card>

                    {/* Pipeline Snapshot */}
                    <Card
                      title="Pipeline snapshot"
                      action={
                        <Link
                          href="/investor/pipeline"
                          className="text-xs font-semibold text-[#9A7A45] hover:underline"
                        >
                          Open pipeline →
                        </Link>
                      }
                    >
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                        {Object.entries(summary.pipeline_snapshot || {}).map(([label, count]) => (
                          <div key={label} className="rounded-lg bg-[#FAF8F4] p-3 text-center">
                            <span className="serif text-xl font-bold text-ink">{count}</span>
                            <span className="block text-xs text-[#4A5568]">{label}</span>
                          </div>
                        ))}
                      </div>
                      {Object.keys(summary.pipeline_snapshot || {}).length === 0 && (
                        <p className="mt-3 text-xs text-[#4A5568]">No pipeline activity yet.</p>
                      )}
                    </Card>

                    {/* Saved Searches */}
                    <Card
                      title="Saved search activity"
                      action={
                        <Link
                          href="/investor/searches"
                          className="text-xs font-semibold text-[#9A7A45] hover:underline"
                        >
                          Manage searches →
                        </Link>
                      }
                    >
                      <EmptyBlock
                        title="Saved-search activity arrives later"
                        hint="Search match tracking is part of the discovery step (a separate module)."
                      />
                    </Card>

                    {/* Market Pulse */}
                    <Card title="Market pulse">
                      <EmptyBlock
                        title="Market pulse arrives later"
                        hint="Platform-wide benchmark intelligence is provided by the analytics module (a separate step)."
                      />
                    </Card>
                  </div>

                  {/* Sidebar Action Cards */}
                  <aside className="space-y-6">
                    <Card
                      title="Needs your reply"
                      action={
                        <Link
                          href="/investor/requests"
                          className="text-xs font-semibold text-[#9A7A45] hover:underline"
                        >
                          All requests
                        </Link>
                      }
                    >
                      {summary.needs_reply.length === 0 ? (
                        <EmptyBlock title="Nothing needs a reply" hint="You're all caught up." />
                      ) : (
                        <div className="space-y-3">
                          {summary.needs_reply.map((r) => (
                            <div
                              key={r.id}
                              className="flex items-start gap-2.5 border-b border-[#E5E1D8] pb-3 last:border-0 last:pb-0"
                            >
                              <AlertCircle size={16} className="text-[#B7791F] shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <b className="block text-xs font-semibold text-ink">{r.startup_name}</b>
                                <span className="text-xs text-[#4A5568]">{r.kind} · {r.ask}</span>
                              </div>
                              <Link
                                href={`/investor/startups/${r.startup_org_id}`}
                                className="text-xs font-semibold text-[#9A7A45] hover:underline"
                              >
                                Open
                              </Link>
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>

                    <Card title="Upcoming meetings">
                      {summary.upcoming_meetings.length === 0 ? (
                        <EmptyBlock title="No upcoming meetings" hint="Scheduled meetings will appear here." />
                      ) : (
                        <>
                          <div className="rounded-lg bg-[#FAF8F4] p-3">
                            <p className="text-xs font-semibold text-ink">
                              {summary.upcoming_meetings[0].startup_name} ·{' '}
                              {summary.upcoming_meetings[0].meeting_type}
                            </p>
                            <p className="mt-1 text-xs text-[#4A5568]">
                              {new Date(summary.upcoming_meetings[0].scheduled_at).toLocaleString()}
                            </p>
                          </div>
                          <Link
                            href="/investor/meetings"
                            className="mt-3 inline-block text-xs font-semibold text-[#9A7A45] hover:underline"
                          >
                            Prepare for meeting →
                          </Link>
                        </>
                      )}
                    </Card>

                    <Card title="Portfolio summary">
                      <span className="serif text-2xl font-bold text-ink">
                        {summary.portfolio_holdings} startups
                      </span>
                      <p className="mt-1 text-xs text-[#4A5568]">
                        {summary.portfolio_updates_this_week} updates this week
                      </p>
                      <Link
                        href="/investor/portfolio"
                        className="mt-3 inline-block text-xs font-semibold text-[#9A7A45] hover:underline"
                      >
                        View portfolio →
                      </Link>
                    </Card>

                    <Card title="Complete your preferences">
                      <p className="text-xs text-[#4A5568] leading-relaxed">
                        Set your preferred stage, sector, ticket size and instruments to improve suggested
                        dealflow matches.
                      </p>
                      <Link
                        href="/investor/settings"
                        className="mt-3 inline-block text-xs font-semibold text-[#9A7A45] hover:underline"
                      >
                        Set investment criteria →
                      </Link>
                    </Card>
                  </aside>
                </div>

                <InvestorDisclaimer onLearnMore={() => notify('Platform disclaimer opened.')} />

                {/* Quick Drawer */}
                {drawer && (
                  <div
                    className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm"
                    onClick={() => setDrawer(null)}
                  >
                    <aside
                      className="absolute right-0 top-0 h-full w-full max-w-lg overflow-y-auto bg-[#FAF8F4] p-6 shadow-2xl"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-[#806236]">
                          Quick preview
                        </span>
                        <button type="button" onClick={() => setDrawer(null)} className="rounded p-1 hover:bg-black/5">
                          <X size={18} />
                        </button>
                      </div>

                      <h2 className="serif mt-4 text-2xl font-bold text-ink">{drawer.name}</h2>
                      <p className="mt-1 text-sm text-[#4A5568]">{drawer.tagline || '—'}</p>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="rounded-full bg-[#F3F4F6] px-2.5 py-0.5 text-xs text-[#4A5568]">
                          {drawer.stage}
                        </span>
                        <span className="rounded-full bg-[#F3F4F6] px-2.5 py-0.5 text-xs text-[#4A5568]">
                          {drawer.sector || '—'}
                        </span>
                      </div>

                      <p className="mt-5 text-xs leading-relaxed text-ink">
                        {drawer.traction_summary || 'No traction summary shared.'}
                      </p>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <div className="rounded-lg border border-[#E5E1D8] bg-white p-3">
                          <span className="block text-xs text-[#4A5568]">Readiness</span>
                          <b className="block text-sm font-semibold text-ink">{drawer.readiness_score ?? '—'}/100</b>
                        </div>
                        <div className="rounded-lg border border-[#E5E1D8] bg-white p-3">
                          <span className="block text-xs text-[#4A5568]">Round target</span>
                          <b className="block text-sm font-semibold text-ink">
                            {drawer.round_visible ? `${drawer.round_target ?? '—'} ${drawer.round_currency || ''}` : '—'}
                          </b>
                        </div>
                      </div>

                      <div className="mt-6 flex flex-wrap gap-3">
                        <Link
                          href={`/investor/startups/${drawer.slug}`}
                          className="rounded-lg border border-[#E5E1D8] bg-white px-4 py-2 text-xs font-semibold text-ink hover:bg-[#FAF8F4]"
                        >
                          View full profile →
                        </Link>
                        <button
                          type="button"
                          onClick={() => toggleSave(drawer.org_id)}
                          className="rounded-lg border border-[#E5E1D8] bg-white px-4 py-2 text-xs font-semibold text-ink hover:bg-[#FAF8F4]"
                        >
                          {saved.includes(drawer.org_id) ? 'Saved' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setModal('intro')}
                          className="rounded-lg bg-ink px-4 py-2 text-xs font-semibold text-white hover:bg-[#1C2B42]"
                        >
                          Request intro
                        </button>
                      </div>
                    </aside>
                  </div>
                )}

                {/* Intro Request Modal */}
                {modal === 'intro' && (
                  <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4 backdrop-blur-sm">
                    <section role="dialog" aria-modal="true" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
                      <div className="mb-4 flex items-center justify-between">
                        <h2 className="serif text-xl font-bold text-ink">Request an introduction</h2>
                        <button type="button" onClick={() => setModal('')}>
                          <X size={18} />
                        </button>
                      </div>
                      <p className="text-xs text-[#4A5568]">
                        To: <b>{drawer?.name || 'Selected startup'}</b> · Investor: Arjun Mehta (Forma)
                      </p>
                      <label htmlFor="intro-msg" className="mt-4 block text-xs font-medium text-ink">
                        Message (50–500 characters)
                      </label>
                      <textarea
                        id="intro-msg"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={4}
                        placeholder="Describe who you are, what you invest in, why this startup and what you'd like next..."
                        className="mt-1 w-full rounded-lg border border-[#E5E1D8] p-3 text-xs focus:border-ink focus:outline-none"
                      />
                      <div className="mt-4 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setModal('')}
                          className="rounded-lg border px-3 py-2 text-xs font-medium text-[#4A5568]"
                        >
                          Cancel
                        </button>
                        <Button
                          onClick={() => {
                            if (message.length < 20) {
                              notify('Please write a slightly longer note for the founder.');
                              return;
                            }
                            notify('Intro request sent! The startup will review and respond.');
                            setModal('');
                            setMessage('');
                          }}
                        >
                          Send intro request
                        </Button>
                      </div>
                    </section>
                  </div>
                )}
              </>
            )}
          </>
        );
      }}
    </InvestorShell>
  );
}
