'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Send, Download, X } from 'lucide-react';
import { InvestorShell, Card, Button } from '@/components';
import { LoadingBlock, EmptyBlock, ErrorBlock } from '@/components/async-state';
import { api, ApiError } from '@/lib/api/client';
import { InvestorDisclaimer } from '../../../investor-data';

const OVERALL_OPTIONS = ['not_started', 'in_progress', 'cleared', 'concern'];
const ITEM_STATUSES = ['not_started', 'in_progress', 'needs_info', 'concern', 'cleared', 'na', 'answered', 'awaiting'];
const SEVERITIES = ['high', 'medium', 'low', 'strength'];

export default function InvestorDiligencePage({ params }) {
  const startupId = params?.startupId;

  const [startup, setStartup] = useState(null);
  const [checklist, setChecklist] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [tab, setTab] = useState('Overview');

  // Notes + scorecard (editable on this page).
  const [notes, setNotes] = useState('');
  const [scorecard, setScorecard] = useState({});

  // New-question form.
  const [question, setQuestion] = useState('');
  // New checklist-item form.
  const [newItem, setNewItem] = useState({ title: '', status: 'not_started' });

  const load = useCallback(async () => {
    if (!startupId) {
      setError('No startup in the URL.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      // Discovery gives the slug → org_id (needed to find/create the checklist).
      const [startups, checklists] = await Promise.all([
        api.investorDiscovery.list({ limit: 50 }),
        api.diligence.listChecklists({ limit: 100 }),
      ]);
      const match = startups.items.find((s) => s.slug === startupId || s.org_id === startupId);
      if (!match) {
        setStartup(null);
        setChecklist(null);
        setItems([]);
        return;
      }
      setStartup(match);
      const cl = checklists.items.find((c) => c.startup_org_id === match.org_id);
      if (!cl) {
        // No workspace yet → create one (idempotent per startup on the server).
        const created = await api.diligence.createChecklist({
          startup_org_id: match.org_id,
        });
        setChecklist(created);
      } else {
        setChecklist(cl);
      }
    } catch (err) {
      setError(err?.message || 'Could not load the diligence workspace.');
      setChecklist(null);
      setStartup(null);
    } finally {
      setLoading(false);
    }
  }, [startupId]);

  const loadItems = useCallback(async () => {
    if (!checklist?.id) return;
    try {
      const page = await api.diligence.listItems(checklist.id, { limit: 100 });
      setItems(page.items);
    } catch (err) {
      setError(err?.message || 'Could not load diligence items.');
    }
  }, [checklist?.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (checklist) {
      setNotes(checklist.notes || '');
      setScorecard(checklist.scorecard || {});
      loadItems();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checklist?.id]);

  const SCORE_WEIGHTS = [
    ['Team', 25],
    ['Market TAM', 20],
    ['Product & IP', 20],
    ['Traction & Moat', 20],
    ['Round Terms & Cap Table', 15],
  ];
  const composite = Math.round(
    (SCORE_WEIGHTS.reduce((s, [dim, w]) => s + (scorecard[dim]?.score || 4) * w, 0) /
      SCORE_WEIGHTS.reduce((s, [, w]) => s + w, 0)) *
      10,
  ) / 10;

  // --- Checklist-level saves ------------------------------------------------
  const saveNotes = async () => {
    if (!checklist) return;
    setBusy(true);
    try {
      const updated = await api.diligence.updateChecklist(checklist.id, { notes });
      setChecklist(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save notes.');
    } finally {
      setBusy(false);
    }
  };

  const saveScorecard = async () => {
    if (!checklist) return;
    setBusy(true);
    try {
      const updated = await api.diligence.updateChecklist(checklist.id, { scorecard });
      setChecklist(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save scorecard.');
    } finally {
      setBusy(false);
    }
  };

  // --- Item writes --------------------------------------------------------
  const setItemStatus = async (item, status) => {
    if (!checklist) return;
    try {
      const updated = await api.diligence.updateItem(checklist.id, item.id, { status });
      setItems((prev) => prev.map((x) => (x.id === item.id ? updated : x)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update item.');
    }
  };

  const removeItem = async (item) => {
    if (!checklist) return;
    try {
      await api.diligence.deleteItem(checklist.id, item.id);
      setItems((prev) => prev.filter((x) => x.id !== item.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not remove item.');
    }
  };

  const addItem = async (e) => {
    e.preventDefault();
    if (!checklist || !newItem.title.trim()) return;
    try {
      const created = await api.diligence.createItem(checklist.id, {
        item_type: 'checklist',
        title: newItem.title,
        status: newItem.status,
      });
      setItems((prev) => [...prev, created]);
      setNewItem({ title: '', status: 'not_started' });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add item.');
    }
  };

  const sendQuestion = async (e) => {
    e.preventDefault();
    if (!checklist || question.trim().length < 10) return;
    try {
      const created = await api.diligence.createItem(checklist.id, {
        item_type: 'question',
        title: question,
        status: 'awaiting',
      });
      setItems((prev) => [...prev, created]);
      setQuestion('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send question.');
    }
  };

  // --- Derived views ------------------------------------------------------
  const byType = (type) => items.filter((i) => i.item_type === type);
  const clearedCount = items.filter((i) => i.status === 'cleared' || i.status === 'na').length;
  const progressPct = items.length ? Math.round((clearedCount / items.length) * 100) : 0;
  const overall = checklist?.overall_status || 'not_started';
  const overallLabel = {
    not_started: 'Not started',
    in_progress: 'In progress',
    cleared: 'Cleared',
    concern: 'Concern flagged',
  }[overall];

  return (
    <InvestorShell
      active="Pipeline"
      module="Deal flow"
      title={startup ? `${startup.name} · Diligence` : 'Diligence'}
      description="A structured, private workspace for deep audit and thesis validation."
      backHref="/investor/pipeline"
      backLabel="← Back to Pipeline"
      actions={
        <div className="flex items-center gap-2">
          <Link
            href="/investor/pipeline"
            className="inline-flex min-h-10 items-center rounded-lg border border-[#E5E1D8] bg-white px-3.5 text-xs font-semibold text-ink hover:bg-[#FAF8F4]"
          >
            ← Pipeline
          </Link>
          <Button secondary onClick={() => notify('Diligence memo exported.')}>
            <Download size={14} /> Export memo
          </Button>
        </div>
      }
    >
      {({ notify: shellNotify }) => (
        <>
          {loading && <LoadingBlock label="Loading diligence workspace…" />}
          {!loading && error && !checklist && <ErrorBlock message={error} onRetry={load} />}

          {!loading && !error && !startup && (
            <EmptyBlock
              title="No such startup"
              hint="This startup is not visible in your discovery feed, so no diligence workspace can be opened."
            >
              <Link
                href="/investor/pipeline"
                className="inline-flex min-h-9 items-center rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs font-semibold text-ink hover:bg-[#FAF8F4]"
              >
                Back to pipeline
              </Link>
            </EmptyBlock>
          )}

          {!loading && !error && startup && checklist && (
            <>
              {/* Progress Header Card */}
              <div className="mb-6 rounded-2xl border border-[#E5E1D8] bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#F3EBDD] font-bold text-ink">
                      {(startup.name || '?').slice(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <h2 className="serif text-lg font-bold text-ink">{startup.name}</h2>
                      <p className="text-xs text-[#4A5568]">
                        {startup.sector || '—'} · {startup.stage || '—'}
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-[#F3EBDD] px-3 py-1 text-xs font-semibold text-[#806236]">
                    Private to your investment team
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-3 text-xs">
                  <label htmlFor="overall-status" className="text-[#4A5568]">
                    Workspace status
                  </label>
                  <select
                    id="overall-status"
                    value={overall}
                    onChange={(e) =>
                      api
                        .diligence.updateChecklist(checklist.id, { overall_status: e.target.value })
                        .then((updated) => setChecklist(updated))
                        .catch((err) =>
                          setError(err instanceof ApiError ? err.message : 'Could not update status.'),
                        )
                    }
                    className="h-9 rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs focus:border-ink focus:outline-none"
                  >
                    {OVERALL_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-4 flex items-center gap-3 text-xs">
                  <span className="font-medium text-ink">
                    {clearedCount} of {items.length} items cleared
                  </span>
                  <div className="h-2 flex-1 rounded-full bg-[#E5E1D8] overflow-hidden">
                    <div className="h-full rounded-full bg-[#B8955A]" style={{ width: `${progressPct}%` }} />
                  </div>
                  <span className="font-bold text-[#806236]">{progressPct}% Complete</span>
                </div>
              </div>

              {/* Sub Tabs */}
              <div className="mb-6 flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {[
                  'Overview',
                  'Checklist',
                  'Questions',
                  'Findings and risks',
                  'Scorecard',
                  'Notes',
                  'Documents',
                ].map((x) => (
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

              {/* Tab Content */}
              {tab === 'Overview' && (
                <div className="grid gap-6 md:grid-cols-2">
                  <Card title="Status by diligence area">
                    <div className="grid grid-cols-2 gap-2.5">
                      {[
                        ['Business Model', 'cleared'],
                        ['Market Size', 'cleared'],
                        ['Product Demo', 'cleared'],
                        ['Team Reference', 'cleared'],
                        ['Financial Audit', 'cleared'],
                        ['Legal & IP', 'concern'],
                        ['Customer Calls', 'needs_info'],
                        ['Round Terms', 'needs_info'],
                      ].map(([area, status]) => {
                        const cls =
                          status === 'cleared'
                            ? 'text-[#286749]'
                            : status === 'concern'
                              ? 'text-red-700'
                              : 'text-[#8A5700]';
                        return (
                          <div key={area} className="rounded-lg bg-[#FAF8F4] p-3 text-xs border border-[#E5E1D8]">
                            <span className="font-medium text-ink">{area}</span>
                            <span className={`mt-1.5 block font-semibold ${cls}`}>
                              {status === 'cleared' ? '✓ Cleared' : status === 'concern' ? 'Concern' : 'Needs info'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-4 rounded-lg bg-[#FAF8F4] p-3 text-xs border border-[#E5E1D8]">
                      <b className="text-ink">Workspace status:</b> {overallLabel}
                    </div>
                  </Card>

                  <Card title="Immediate action items">
                    {items.length === 0 ? (
                      <EmptyBlock
                        title="No action items yet"
                        hint="Add checklist items from the Checklist tab to track work."
                      />
                    ) : (
                      <div className="space-y-3 text-xs">
                        {items
                          .filter((i) => i.status !== 'cleared' && i.status !== 'na')
                          .slice(0, 4)
                          .map((i) => (
                            <div key={i.id} className="rounded-lg border border-[#E5E1D8] p-3">
                              <b className="block text-ink">{i.title}</b>
                              <span className="text-[#4A5568]">
                                {i.item_type} · {i.status}
                                {i.due_on ? ` · Due ${new Date(i.due_on).toLocaleDateString()}` : ''}
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                    <Link
                      href={`/investor/data-rooms/${startup.slug || startup.org_id}`}
                      className="mt-4 inline-block text-xs font-semibold text-[#9A7A45] hover:underline"
                    >
                      Open shared data room →
                    </Link>
                  </Card>
                </div>
              )}

              {tab === 'Checklist' && (
                <Card
                  title="Diligence checklist"
                  action={
                    <Button secondary onClick={() => shellNotify('Use the form below to add items.')}>
                      <Plus size={13} /> Add item
                    </Button>
                  }
                >
                  <form onSubmit={addItem} className="mb-4 flex flex-wrap gap-2">
                    <input
                      value={newItem.title}
                      onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                      placeholder="New checklist item…"
                      className="h-9 min-w-[200px] flex-1 rounded-lg border border-[#E5E1D8] px-3 text-xs focus:border-ink focus:outline-none"
                    />
                    <select
                      value={newItem.status}
                      onChange={(e) => setNewItem({ ...newItem, status: e.target.value })}
                      className="h-9 rounded border border-[#E5E1D8] bg-white px-2 text-xs focus:border-ink focus:outline-none"
                    >
                      {ITEM_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <Button type="submit" secondary>
                      <Plus size={13} /> Add
                    </Button>
                  </form>

                  {items.filter((i) => i.item_type === 'checklist').length === 0 ? (
                    <EmptyBlock title="Checklist is empty" hint="Add your first checklist item above." />
                  ) : (
                    <div className="space-y-2.5">
                      {items
                        .filter((i) => i.item_type === 'checklist')
                        .map((item) => (
                          <div
                            key={item.id}
                            className="flex flex-wrap items-center gap-3 rounded-lg border border-[#E5E1D8] p-3 text-xs hover:bg-[#FAF8F4]"
                          >
                            <span className="flex-1 font-medium text-ink">{item.title}</span>
                            <select
                              value={item.status}
                              onChange={(e) => setItemStatus(item, e.target.value)}
                              className="h-8 rounded border border-[#E5E1D8] bg-white px-2 text-xs focus:border-ink focus:outline-none"
                            >
                              {ITEM_STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => removeItem(item)}
                              className="text-[#4A5568] hover:text-red-600"
                            >
                              Delete
                            </button>
                          </div>
                        ))}
                    </div>
                  )}
                </Card>
              )}

              {tab === 'Questions' && (
                <Card title="Questions to founder">
                  <div className="space-y-3 mb-6">
                    {byType('question').length === 0 ? (
                      <EmptyBlock title="No questions yet" hint="Send a diligence question below." />
                    ) : (
                      byType('question').map((item) => (
                        <div key={item.id} className="rounded-lg border border-[#E5E1D8] p-3 text-xs">
                          <span
                            className={`rounded px-2 py-0.5 text-xs font-semibold ${
                              item.status === 'answered'
                                ? 'bg-[#E7F3EC] text-[#286749]'
                                : 'bg-[#FAF8F4] text-[#806236]'
                            }`}
                          >
                            {item.status}
                          </span>
                          <p className="mt-2 text-sm font-medium text-ink">{item.title}</p>
                          {item.response && (
                            <span className="mt-1 block text-xs text-[#4A5568]">{item.response}</span>
                          )}
                          <div className="mt-2 flex gap-2">
                            <select
                              value={item.status}
                              onChange={(e) => setItemStatus(item, e.target.value)}
                              className="h-8 rounded border border-[#E5E1D8] bg-white px-2 text-xs focus:border-ink focus:outline-none"
                            >
                              {['awaiting', 'answered', 'needs_info', 'concern'].map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => removeItem(item)}
                              className="text-[#4A5568] hover:text-red-600"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="space-y-3 border-t border-[#E5E1D8] pt-4">
                    <label htmlFor="q-input" className="block text-xs font-medium text-ink">
                      Submit new diligence question (Founder will be notified)
                    </label>
                    <textarea
                      id="q-input"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      rows={3}
                      placeholder="Ask a concise, specific question..."
                      className="w-full rounded-lg border border-[#E5E1D8] p-3 text-xs focus:border-ink focus:outline-none"
                    />
                    <Button onClick={sendQuestion} disabled={question.trim().length < 10}>
                      <Send size={13} /> Send question
                    </Button>
                  </div>
                </Card>
              )}

              {tab === 'Findings and risks' && (
                <Card title="Key findings & risk register">
                  <div className="mb-6 grid grid-cols-3 gap-3 text-center">
                    {SEVERITIES.map((level) => {
                      const count = byType('finding').filter((i) => i.severity === level).length;
                      const cls =
                        level === 'high'
                          ? 'text-red-700 bg-red-50 border-red-200'
                          : level === 'medium'
                            ? 'text-amber-700 bg-amber-50 border-amber-200'
                            : 'text-green-700 bg-green-50 border-green-200';
                      return (
                        <div key={level} className={`rounded-xl border p-4 ${cls}`}>
                          <span className="text-xs font-semibold uppercase">{level} risk</span>
                          <span className="serif mt-1 block text-2xl font-bold">{count}</span>
                        </div>
                      );
                    })}
                  </div>

                  {byType('finding').length === 0 ? (
                    <EmptyBlock
                      title="No findings recorded"
                      hint="Add findings from the Checklist tab and mark them as findings."
                    />
                  ) : (
                    <div className="space-y-3 text-xs">
                      {byType('finding').map((item) => (
                        <div key={item.id} className="rounded-lg border border-[#E5E1D8] p-3.5">
                          <div className="flex items-center justify-between">
                            <b className="text-xs font-semibold text-ink">{item.title}</b>
                            <span className="rounded bg-[#FAF8F4] px-2 py-0.5 text-xs font-medium text-ink">
                              {item.severity || '—'}
                            </span>
                          </div>
                          {item.response && <p className="mt-1 text-xs text-[#4A5568]">{item.response}</p>}
                          <div className="mt-2 flex gap-2">
                            <select
                              value={item.status}
                              onChange={(e) => setItemStatus(item, e.target.value)}
                              className="h-8 rounded border border-[#E5E1D8] bg-white px-2 text-xs focus:border-ink focus:outline-none"
                            >
                              {ITEM_STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => removeItem(item)}
                              className="text-[#4A5568] hover:text-red-600"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              )}

              {tab === 'Scorecard' && (
                <Card title="Team diligence scorecard">
                  <p className="mb-4 text-xs text-[#4A5568]">
                    Scores weighted across 5 critical dimensions. Reflects internal judgment, not platform
                    algorithmic rating.
                  </p>
                  <div className="space-y-3">
                    {SCORE_WEIGHTS.map(([dim, weight]) => (
                      <div
                        key={dim}
                        className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E1D8] pb-3"
                      >
                        <div className="w-48">
                          <b className="block text-xs font-semibold text-ink">{dim}</b>
                          <span className="text-xs text-[#4A5568]">{weight}% weight</span>
                        </div>
                        <select
                          value={scorecard[dim]?.score ?? 4}
                          onChange={(e) =>
                            setScorecard({
                              ...scorecard,
                              [dim]: { ...(scorecard[dim] || {}), score: Number(e.target.value) },
                            })
                          }
                          className="h-9 rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs focus:border-ink focus:outline-none"
                        >
                          {[1, 2, 3, 4, 5].map((n) => (
                            <option key={n} value={n}>
                              {n} / 5
                            </option>
                          ))}
                        </select>
                        <input
                          placeholder="Rationale notes (20+ chars)..."
                          value={scorecard[dim]?.rationale || ''}
                          onChange={(e) =>
                            setScorecard({
                              ...scorecard,
                              [dim]: { ...(scorecard[dim] || {}), rationale: e.target.value },
                            })
                          }
                          className="h-9 flex-1 min-w-[200px] rounded-lg border border-[#E5E1D8] px-3 text-xs focus:border-ink focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-[#4A5568]">Weighted Composite Score:</span>
                      <span className="serif ml-2 text-xl font-bold text-ink">
                        {composite} / 5.0
                      </span>
                    </div>
                  </div>
                  <div className="mt-3">
                    <Button onClick={saveScorecard} disabled={busy}>
                      {busy ? 'Saving…' : 'Save scorecard'}
                    </Button>
                  </div>
                </Card>
              )}

              {tab === 'Notes' && (
                <Card title="Private team diligence notes">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={8}
                    placeholder="Private evaluation remarks, partner questions, diligence summaries..."
                    className="w-full rounded-lg border border-[#E5E1D8] p-3 text-xs focus:border-ink focus:outline-none"
                  />
                  <Button className="mt-3" onClick={saveNotes} disabled={busy}>
                    {busy ? 'Saving…' : 'Save notes'}
                  </Button>
                </Card>
              )}

              {tab === 'Documents' && (
                <Card title="Associated data room files">
                  <p className="text-xs text-[#4A5568]">
                    Open the watermarked document viewer to inspect financials and cap table source files.
                  </p>
                  <Link
                    href={`/investor/data-rooms/${startup.slug || startup.org_id}`}
                    className="mt-4 inline-block text-xs font-semibold text-[#9A7A45] hover:underline"
                  >
                    Go to {startup.name} Data Room →
                  </Link>
                </Card>
              )}

              <InvestorDisclaimer onLearnMore={() => shellNotify('Platform disclaimer opened.')} />
            </>
          )}
        </>
      )}
    </InvestorShell>
  );
}
