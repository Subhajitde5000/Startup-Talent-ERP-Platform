'use client';
import { useState } from 'react';
import Link from 'next/link';
import {
  FileSearch,
  AlertCircle,
  MoreHorizontal,
  Bookmark,
  X,
  Plus,
} from 'lucide-react';
import { InvestorShell, Card, Button } from '@/components';
import {
  startups,
  InvestorBadge,
  InvestorDisclaimer,
} from '../investor-data';

export default function InvestorDashboardPage() {
  const [saved, setSaved] = useState(['greenledger']);
  const [drawer, setDrawer] = useState(null);
  const [modal, setModal] = useState('');
  const [message, setMessage] = useState('');

  const searches = [
    { name: 'Pre-seed fintech · India', criteria: 'Idea, Prototype · Fintech · India', new: 4, total: 18 },
    { name: 'Climate · Seed', criteria: 'Idea, Prototype · Climate · India', new: 2, total: 11 },
  ];

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
          setSaved((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
          );
          notify(saved.includes(id) ? 'Removed from shortlist.' : 'Saved to shortlist.');
        };

        const startupCard = (s) => (
          <article
            key={s.id}
            className="rounded-xl border border-[#E5E1D8] bg-white p-5 transition hover:shadow-sm"
          >
            <div className="flex items-start gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#F3EBDD] text-lg font-semibold text-ink">
                {s.logo}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/investor/startups/${s.id}`}
                    className="text-sm font-semibold text-ink hover:underline"
                  >
                    {s.name}
                  </Link>
                  {s.verified && <InvestorBadge>Verified startup</InvestorBadge>}
                  {s.badge && <InvestorBadge gold>Investment Ready</InvestorBadge>}
                </div>
                <p className="mt-1 text-xs text-[#4A5568]">{s.tag}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="rounded-full bg-[#F3F4F6] px-2.5 py-1 text-xs text-[#4A5568]">
                    {s.stage}
                  </span>
                  <span className="rounded-full bg-[#F3F4F6] px-2.5 py-1 text-xs text-[#4A5568]">
                    {s.sector}
                  </span>
                </div>
              </div>
              <button
                type="button"
                aria-label={`Actions for ${s.name}`}
                onClick={() => setDrawer(s)}
                className="text-[#4A5568] hover:text-ink"
              >
                <MoreHorizontal size={18} />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
              <div>
                <span className="block text-xs text-[#4A5568]">Location · Team</span>
                <b className="font-semibold">{s.loc} · {s.team}</b>
              </div>
              <div>
                <span className="block text-xs text-[#4A5568]">Readiness</span>
                <b className="font-semibold text-ink">
                  {s.ready}/100 {s.badge && <span className="text-[#9A7A45]">✓</span>}
                </b>
              </div>
              <div>
                <span className="block text-xs text-[#4A5568]">MRR · Growth</span>
                <b className="font-semibold">{s.mrr} · {s.growth}</b>
              </div>
              <div>
                <span className="block text-xs text-[#4A5568]">Round</span>
                <b className="font-semibold">{s.raise} · {s.committed}</b>
              </div>
            </div>

            <div className="mt-3 rounded-lg bg-[#FAF8F4] p-2.5 text-xs">
              <b className="text-[#806236]">Why this fit</b> · {s.fit}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E1D8] pt-3">
              <span className="text-xs text-[#4A5568]">
                {s.badge ? 'Mentor-verified readiness' : 'Profile updated'} · {s.updated}
              </span>
              <div className="flex items-center gap-2">
                <Link
                  href={`/investor/startups/${s.id}`}
                  className="rounded-lg border border-[#E5E1D8] bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-[#FAF8F4]"
                >
                  View profile
                </Link>
                <button
                  type="button"
                  onClick={() => toggleSave(s.id)}
                  className="rounded-lg border border-[#E5E1D8] bg-white px-3 py-1.5 text-xs font-medium text-ink hover:bg-[#FAF8F4]"
                >
                  {saved.includes(s.id) ? 'Saved' : 'Save'}
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
            {/* Top Stat Strip */}
            <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                ['New matches this week', '9', '+3 this week'],
                ['Intro requests awaiting reply', '3', '1 received'],
                ['Meetings this week', '2', 'Next · Thu'],
                ['Startups in pipeline', '14', '2 new updates'],
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
                    <Link href="/investor/discover" className="text-xs font-semibold text-[#9A7A45] hover:underline">
                      View all matches →
                    </Link>
                  }
                >
                  <div className="space-y-4">
                    {(startups || []).slice(0, 2).map((s) => startupCard(s))}
                  </div>
                </Card>

                {/* Pipeline Snapshot */}
                <Card
                  title="Pipeline snapshot"
                  action={
                    <Link href="/investor/pipeline" className="text-xs font-semibold text-[#9A7A45] hover:underline">
                      Open pipeline →
                    </Link>
                  }
                >
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {[
                      ['Interested', 8],
                      ['Talking', 4],
                      ['Meeting', 3],
                      ['Data room', 2],
                      ['Offer', 1],
                      ['Committed', 2],
                    ].map(([label, count]) => (
                      <div key={label} className="rounded-lg bg-[#FAF8F4] p-3 text-center">
                        <span className="serif text-xl font-bold text-ink">{count}</span>
                        <span className="block text-xs text-[#4A5568]">{label}</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-xs text-[#4A5568]">
                    Expected commitments: <span className="font-semibold text-ink">₹1.2 Cr</span> · Target not set
                  </p>
                </Card>

                {/* Saved Searches */}
                <Card
                  title="Saved search activity"
                  action={
                    <Link href="/investor/searches" className="text-xs font-semibold text-[#9A7A45] hover:underline">
                      Manage searches →
                    </Link>
                  }
                >
                  <div className="space-y-3">
                    {searches.map((s) => (
                      <div
                        key={s.name}
                        className="flex items-center gap-3 rounded-lg border border-[#E5E1D8] p-3 hover:bg-[#FAF8F4] transition"
                      >
                        <FileSearch size={18} className="text-[#9A7A45] shrink-0" />
                        <div className="flex-1 min-w-0">
                          <b className="block text-xs font-semibold text-ink truncate">{s.name}</b>
                          <span className="text-xs text-[#4A5568]">{s.new} new matches · {s.criteria}</span>
                        </div>
                        <Link
                          href="/investor/discover"
                          className="text-xs font-semibold text-[#9A7A45] hover:underline shrink-0"
                        >
                          View results
                        </Link>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Market Pulse */}
                <Card title="Market pulse">
                  <p className="text-sm text-ink leading-relaxed">
                    Seed-stage climate startups on the platform: <b>18</b>, up <b>20%</b> in the last 90 days.
                  </p>
                  <span className="mt-2 block text-xs text-[#4A5568]">
                    Platform data · Aggregated · Updated Nov 05, 2026 · No forecasts or predictions
                  </span>
                </Card>
              </div>

              {/* Sidebar Action Cards */}
              <aside className="space-y-6">
                <Card
                  title="Needs your reply"
                  action={
                    <Link href="/investor/requests" className="text-xs font-semibold text-[#9A7A45] hover:underline">
                      All requests
                    </Link>
                  }
                >
                  <div className="space-y-3">
                    {[
                      ['Acme Studio', 'Intro request · 4 days ago', 'acme'],
                      ['OrbitPay', 'Replied to your intro · 2 days ago', 'orbitpay'],
                      ['GreenLedger', 'NDA pending signature', 'greenledger'],
                    ].map(([name, note, id]) => (
                      <div key={name} className="flex items-start gap-2.5 border-b border-[#E5E1D8] pb-3 last:border-0 last:pb-0">
                        <AlertCircle size={16} className="text-[#B7791F] shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <b className="block text-xs font-semibold text-ink">{name}</b>
                          <span className="text-xs text-[#4A5568]">{note}</span>
                        </div>
                        <Link
                          href={`/investor/startups/${id}`}
                          className="text-xs font-semibold text-[#9A7A45] hover:underline"
                        >
                          Open
                        </Link>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card title="Upcoming meetings">
                  <div className="rounded-lg bg-[#FAF8F4] p-3">
                    <p className="text-xs font-semibold text-ink">Acme Studio · Intro call</p>
                    <p className="mt-1 text-xs text-[#4A5568]">Thu, Nov 12 · 4:00 PM IST</p>
                  </div>
                  <Link
                    href="/investor/meetings"
                    className="mt-3 inline-block text-xs font-semibold text-[#9A7A45] hover:underline"
                  >
                    Prepare for meeting →
                  </Link>
                </Card>

                <Card title="Portfolio summary">
                  <span className="serif text-2xl font-bold text-ink">6 startups</span>
                  <p className="mt-1 text-xs text-[#4A5568]">2 updates this week · 1 round opened</p>
                  <Link
                    href="/investor/portfolio"
                    className="mt-3 inline-block text-xs font-semibold text-[#9A7A45] hover:underline"
                  >
                    View portfolio →
                  </Link>
                </Card>

                <Card title="Complete your preferences">
                  <p className="text-xs text-[#4A5568] leading-relaxed">
                    Set your preferred stage, sector, ticket size and instruments to improve suggested dealflow matches.
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
                    <button
                      type="button"
                      onClick={() => setDrawer(null)}
                      className="rounded p-1 hover:bg-black/5"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <h2 className="serif mt-4 text-2xl font-bold text-ink">{drawer.name}</h2>
                  <p className="mt-1 text-sm text-[#4A5568]">{drawer.tag}</p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {drawer.badge && <InvestorBadge gold>Investment Ready</InvestorBadge>}
                    <span className="rounded-full bg-[#F3F4F6] px-2.5 py-0.5 text-xs text-[#4A5568]">
                      {drawer.stage}
                    </span>
                    <span className="rounded-full bg-[#F3F4F6] px-2.5 py-0.5 text-xs text-[#4A5568]">
                      {drawer.sector}
                    </span>
                  </div>

                  <p className="mt-5 text-xs leading-relaxed text-ink">{drawer.summary}</p>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {(drawer.items || []).map(([x, y, src]) => (
                      <div key={x} className="rounded-lg border border-[#E5E1D8] bg-white p-3">
                        <span className="block text-xs text-[#4A5568]">{x}</span>
                        <b className="block text-sm font-semibold text-ink">{y}</b>
                        <span className="text-xs text-[#9A7A45]">{src}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 rounded-lg bg-white p-3 text-xs border border-[#E5E1D8]">
                    <b className="text-[#806236]">Why this fit:</b> {drawer.fit}
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link
                      href={`/investor/startups/${drawer.id}`}
                      className="rounded-lg border border-[#E5E1D8] bg-white px-4 py-2 text-xs font-semibold text-ink hover:bg-[#FAF8F4]"
                    >
                      View full profile →
                    </Link>
                    <button
                      type="button"
                      onClick={() => toggleSave(drawer.id)}
                      className="rounded-lg border border-[#E5E1D8] bg-white px-4 py-2 text-xs font-semibold text-ink hover:bg-[#FAF8F4]"
                    >
                      {saved.includes(drawer.id) ? 'Saved' : 'Save'}
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
                <section
                  role="dialog"
                  aria-modal="true"
                  className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
                >
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
                    placeholder="Describe who you are, what you invest in, why this startup and what you’d like next..."
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
        );
      }}
    </InvestorShell>
  );
}
