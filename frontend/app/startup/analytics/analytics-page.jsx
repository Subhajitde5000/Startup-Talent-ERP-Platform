'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { StartupSidebar, Card } from '../../../components';
import { api, ApiError } from '@/lib/api/client';
import {
  Search,
  Bell,
  ChevronDown,
  ArrowUpRight,
  ArrowRight,
  Download,
  RefreshCw,
  Share2,
  TrendingUp,
  TrendingDown,
  Target,
  Clock,
  CheckCircle2,
  AlertCircle,
  Info,
  X,
  BarChart3,
  LockKeyhole,
  Eye,
  Building2,
  FileText,
  UsersRound,
  Wallet,
  CalendarDays,
  Menu
} from 'lucide-react';

const tabs = ['Overview', 'Journey', 'Business', 'Market'];

/**
 * Named metric helpers. The backend stores eight keys; the analytics page
 * labels them in words, so every label/format lives here rather than being
 * repeated in each card.
 */
const METRIC_META = {
  mrr: { label: 'MRR', money: true },
  arr: { label: 'ARR', money: true },
  customers: { label: 'Customers', money: false },
  burn: { label: 'Burn', money: true },
  runway_months: { label: 'Runway', money: false, suffix: ' months' },
  growth_mom: { label: 'Growth MoM', money: false, suffix: '%' },
  headcount: { label: 'Headcount', money: false },
  active_users: { label: 'Active users', money: false },
};

const METRIC_KEYS = Object.keys(METRIC_META);

/** Rupee-style short form used across the page (₹4.8L, ₹1.2Cr). */
function formatMoney(value, currency) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const cur = currency || 'INR';
  const symbol = cur === 'INR' ? '₹' : `${cur} `;
  const abs = Math.abs(n);
  if (abs >= 1e7) return `${symbol}${(n / 1e7).toFixed(2).replace(/\.00$/, '')}Cr`;
  if (abs >= 1e5) return `${symbol}${(n / 1e5).toFixed(1).replace(/\.0$/, '')}L`;
  if (abs >= 1e3) return `${symbol}${(n / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
  return `${symbol}${n.toLocaleString('en-IN')}`;
}

/** One stored metric value, formatted for its key. `null` renders a dash. */
function formatMetricValue(item) {
  if (!item) return '—';
  const meta = METRIC_META[item.metric_key];
  if (!meta) return item.value;
  const n = Number(item.value);
  if (!Number.isFinite(n)) return '—';
  if (meta.money) return formatMoney(n, item.currency);
  const body = Number.isInteger(n) ? n.toLocaleString('en-IN') : String(Number(n.toFixed(2)));
  return `${body}${meta.suffix || ''}`;
}

/** "Oct 2026" from an ISO date, never a locale-dependent guess. */
function periodLabel(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function shortMonth(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });
}

/** "2h ago" style age from a server timestamp; '' when unparseable. */
function timeAgo(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/**
 * Range options map to a history window. Metrics are reported per month, so
 * a 30-day window can hold at most one month-end: the short ranges still ask
 * for enough months to draw a trend rather than a single dot.
 */
const RANGE_MONTHS = {
  'Last 30 days': 6,
  'Last 90 days': 6,
  'This quarter': 6,
  '12 months': 12,
  Custom: 12,
};

/** Server `source` value in the words the page already uses. */
function sourceLabel(source) {
  if (source === 'startup_reported') return 'Entered by team';
  if (source === 'calculated') return 'Calculated';
  if (source === 'mentor_verified') return 'Mentor verified';
  if (source === 'admin_verified') return 'Admin verified';
  return source;
}

function EmptyNote({ children }) {
  return (
    <div className="rounded-lg border border-dashed border-[#E5E1D8] bg-[#FAF8F4] p-4 text-xs leading-5 text-[#4A5568]">
      {children}
    </div>
  );
}

function ChartSkeleton() {
  return <div className="h-[190px] animate-pulse rounded-lg bg-[#F3F4F6]" />;
}

/**
 * Normalises a series to 0..100 for the SVG viewBox. A flat series (all
 * values equal, e.g. a single month) sits in the middle instead of dividing
 * by zero; a single point is drawn as a dot.
 */
function normalise(values) {
  if (values.length === 0) return [];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  if (hi === lo) return values.map(() => 50);
  return values.map(v => 8 + ((v - lo) / (hi - lo)) * 84);
}

/** The Business tab's sample series, kept until that tab is wired. */
const DEMO_LINE = {
  values: [26, 35, 30, 48, 44, 60, 68],
  labels: ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'],
};

/**
 * Two modes, never mixed: pass `points` for real reported data (Overview
 * drawer), or omit it for the Business tab's labelled demo series.
 */
function LineChart({ points = null, values = null, labels = null, unit = '', compare = false }) {
  const width = 660, height = 210, pad = 28;
  const demo = points === null;
  const demoValues = values || DEMO_LINE.values;
  const demoLabels = labels || DEMO_LINE.labels;
  // Chronological order for the line; the API returns newest first.
  const series = demo ? [] : [...points].reverse();
  const nums = series.map(p => Number(p.value));
  const scaled = normalise(nums);
  const step = series.length > 1 ? (width - pad * 2) / (series.length - 1) : 0;
  const x = i => (series.length > 1 ? pad + i * step : width / 2);
  const y = v => height - pad - v * (height - pad * 2) / 100;
  const path = scaled.map((v, i) => `${i ? 'L' : 'M'} ${x(i)} ${y(v)}`).join(' ');
  const path2 = scaled.map((v, i) => `${i ? 'L' : 'M'} ${x(i)} ${y(Math.max(8, v - 13))}`).join(' ');
  const ariaLabel = demo ? 'Sample trend chart' : series.length
    ? `Line chart of ${series.length} reported period${series.length === 1 ? '' : 's'}, from ${periodLabel(series[0].period_end)} to ${periodLabel(series[series.length - 1].period_end)}`
    : 'No chart data';
  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel} className="h-[190px] w-full">
        <title>{demo ? 'Sample trend' : 'Reported trend'}</title>
        {[0, 1, 2, 3].map(i => (
          <line key={i} x1={pad} x2={width - pad} y1={pad + i * (height - pad * 2) / 3} y2={pad + i * (height - pad * 2) / 3} stroke="#E5E1D8" strokeDasharray="3 4" />
        ))}
        {demo && demoValues.map((v, i) => (
          <g key={i}>
            <text x="2" y={pad + i * (height - pad * 2) / 3 + 4} fontSize="10" fill="#4A5568">{100 - i * 30}</text>
          </g>
        ))}
        {demo ? (
          <>
            {compare && (
              <path d={demoValues.map((v, i) => `${i ? 'L' : 'M'} ${pad + i * (width - pad * 2) / (demoValues.length - 1)} ${height - pad - Math.max(8, v - 13) * (height - pad * 2) / 100}`).join(' ')} fill="none" stroke="#A0A7B4" strokeWidth="2" strokeDasharray="5 5" />
            )}
            <path d={demoValues.map((v, i) => `${i ? 'L' : 'M'} ${pad + i * (width - pad * 2) / (demoValues.length - 1)} ${height - pad - v * (height - pad * 2) / 100}`).join(' ')} fill="none" stroke="#0F1B2D" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            {demoValues.map((v, i) => (
              <circle key={i} cx={pad + i * (width - pad * 2) / (demoValues.length - 1)} cy={height - pad - v * (height - pad * 2) / 100} r={i === demoValues.length - 1 ? 5 : 2.5} fill={i === demoValues.length - 1 ? '#B8955A' : '#0F1B2D'} />
            ))}
            {demoLabels.map((l, i) => (
              <text key={l} x={pad + i * (width - pad * 2) / (demoLabels.length - 1)} y={height - 5} textAnchor="middle" fontSize="10" fill="#4A5568">{l}</text>
            ))}
          </>
        ) : (
          <>
            {compare && series.length > 1 && <path d={path2} fill="none" stroke="#A0A7B4" strokeWidth="2" strokeDasharray="5 5" />}
            {series.length > 1 && <path d={path} fill="none" stroke="#0F1B2D" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
            {scaled.map((v, i) => (
              <circle key={i} cx={x(i)} cy={y(v)} r={i === scaled.length - 1 ? 5 : 2.5} fill={i === scaled.length - 1 ? '#B8955A' : '#0F1B2D'} />
            ))}
            {series.map((p, i) => (
              <text key={`${p.period_end}-${i}`} x={x(i)} y={height - 5} textAnchor="middle" fontSize="10" fill="#4A5568">{shortMonth(p.period_end)}</text>
            ))}
            {series.length === 0 && (
              <text x={width / 2} y={height / 2} textAnchor="middle" fontSize="11" fill="#4A5568">No reported values yet</text>
            )}
          </>
        )}
      </svg>
      {!demo && series.length > 0 && (
        <p className="mt-1 text-[10px] text-[#4A5568]">
          {formatMetricValue({ metric_key: 'mrr', value: series[series.length - 1].value, currency: null }).replace(/^₹/, '')}
          {unit ? ` ${unit}` : ''} in {periodLabel(series[series.length - 1].period_end)}
        </p>
      )}
    </div>
  );
}

/**
 * Two-series bars (revenue vs burn). Real mode takes the reported months;
 * omitting both series keeps the Business tab's labelled sample values.
 */
function Bars({ revenue, burn, loading = false }) {
  const demo = revenue === undefined && burn === undefined;
  if (demo) {
    const values = [43, 58, 51, 70, 62, 82];
    const labels = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'];
    return (
      <div className="flex h-[190px] items-end justify-around gap-3 border-b border-[#E5E1D8] px-2 pt-3">
        {values.map((v, i) => (
          <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
            <div className="flex h-[150px] w-full items-end justify-center gap-1">
              <div title={`Revenue ${v}`} className="w-5 max-w-[35%] rounded-t bg-ink" style={{ height: `${v}%` }} />
              <div title={`Burn ${Math.max(22, v - 18)}`} className="w-5 max-w-[35%] rounded-t bg-[#A0A7B4]" style={{ height: `${Math.max(22, v - 18)}%` }} />
            </div>
            <span className="text-[10px] text-[#4A5568]">{labels[i]}</span>
          </div>
        ))}
      </div>
    );
  }
  const rev = revenue || [];
  const brn = burn || [];
  const months = [...new Set([...rev, ...brn].map(p => p.period_end))].sort();
  const revBy = Object.fromEntries(rev.map(p => [p.period_end, Number(p.value)]));
  const brnBy = Object.fromEntries(brn.map(p => [p.period_end, Number(p.value)]));
  const all = months.flatMap(m => [revBy[m], brnBy[m]]).filter(v => Number.isFinite(v));
  const peak = all.length ? Math.max(...all.map(Math.abs)) : 0;
  const pct = v => (Number.isFinite(v) && peak > 0 ? Math.max(4, (Math.abs(v) / peak) * 100) : 0);

  if (loading) return <ChartSkeleton />;
  if (months.length === 0) {
    return (
      <div className="grid h-[190px] place-items-center rounded-lg border border-dashed border-[#E5E1D8] bg-[#FAF8F4] text-center text-xs text-[#4A5568]">
        No revenue or burn reported yet.
      </div>
    );
  }
  return (
    <div className="flex h-[190px] items-end justify-around gap-3 border-b border-[#E5E1D8] px-2 pt-3">
      {months.map(m => (
        <div key={m} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
          <div className="flex h-[150px] w-full items-end justify-center gap-1">
            {Number.isFinite(revBy[m]) && (
              <div title={`Revenue ${revBy[m]}`} className="w-5 max-w-[35%] rounded-t bg-ink" style={{ height: `${pct(revBy[m])}%` }} />
            )}
            {Number.isFinite(brnBy[m]) && (
              <div title={`Burn ${brnBy[m]}`} className="w-5 max-w-[35%] rounded-t bg-[#A0A7B4]" style={{ height: `${pct(brnBy[m])}%` }} />
            )}
          </div>
          <span className="text-[10px] text-[#4A5568]">{shortMonth(m)}</span>
        </div>
      ))}
    </div>
  );
}

function Source({ children = 'Entered by team' }) {
  return <span className="rounded-full bg-[#F3F4F6] px-2 py-1 text-[10px] text-[#4A5568]">{children}</span>;
}

export default function AnalyticsPage() {
  const [tab, setTab] = useState('Overview');
  const [range, setRange] = useState('Last 30 days');
  const [compare, setCompare] = useState('Previous period');
  const [toast, setToast] = useState('');
  const [drawer, setDrawer] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [share, setShare] = useState(false);
  const [opted, setOpted] = useState(false);
  const [scenario, setScenario] = useState('Base');
  const [mobileNav, setMobileNav] = useState(false);
  const [compact, setCompact] = useState(false);

  // Step 5e: real metrics. `metricsPhase` gates the Overview/Journey tabs;
  // Business and Market stay on demo data (their data belongs to later
  // steps), so they never consult this state.
  const [metricsPhase, setMetricsPhase] = useState('loading'); // loading|ready|error|none
  const [metricsError, setMetricsError] = useState('');
  const [org, setOrg] = useState(null); // OrganizationRead (carries my_role)
  const [latest, setLatest] = useState(null); // MetricLatestRead
  const [history, setHistory] = useState({}); // key -> MetricPoint[] (newest first)
  const [historyLoading, setHistoryLoading] = useState(true);
  // Readiness is 5f's data, read here only to label the Overview KPI
  // honestly. A failure leaves the tile empty rather than blocking the page.
  const [readinessScore, setReadinessScore] = useState(null);
  const [reload, setReload] = useState(0);
  const [lastLoaded, setLastLoaded] = useState(null);

  // Entry form (the "Add data" action). Hidden for viewers.
  const [entryOpen, setEntryOpen] = useState(false);
  const [entry, setEntry] = useState({ metric_key: 'mrr', value: '', period_end: '', unit: '', currency: 'INR' });
  const [entryErrs, setEntryErrs] = useState({});
  const [entryFormErr, setEntryFormErr] = useState('');
  const [entryBusy, setEntryBusy] = useState(false);

  const alive = useRef(true);

  const notify = (s) => {
    setToast(s);
    setTimeout(() => setToast(''), 2800);
  };

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  // Load the startup org, then its latest values, then the history for the
  // two keys the charts draw (mrr, burn). One function so the Refresh button
  // and the first paint share the same path.
  useEffect(() => {
    (async () => {
      setMetricsPhase('loading');
      setMetricsError('');
      setHistoryLoading(true);
      let startup = null;
      try {
        const orgs = await api.organizations.mine();
        startup = orgs.find(o => o.type === 'startup') || null;
      } catch (err) {
        if (!alive.current) return;
        setMetricsError(err instanceof ApiError ? err.message : 'Could not load your organization.');
        setMetricsPhase('error');
        setHistoryLoading(false);
        return;
      }
      if (!alive.current) return;
      if (!startup) {
        setMetricsPhase('none');
        setHistoryLoading(false);
        return;
      }
      setOrg(startup);

      try {
        const read = await api.metrics.latest(startup.id);
        if (!alive.current) return;
        setLatest(read);
        setMetricsPhase('ready');
        setLastLoaded(new Date());
      } catch (err) {
        if (!alive.current) return;
        setMetricsError(err instanceof ApiError ? err.message : 'Could not load your metrics.');
        setMetricsPhase('error');
        setHistoryLoading(false);
        return;
      }

      // History is per key. The Overview charts need mrr+burn; the Journey KPI
      // row shows a delta for four more keys. Only keys actually fetched can
      // claim "no prior period" — an unfetched key shows no delta at all, so
      // the page never asserts something it did not check.
      const months = RANGE_MONTHS[range] || 12;
      setHistoryLoading(true);
      try {
        const keys = ['mrr', 'burn', 'customers', 'growth_mom', 'headcount', 'active_users'];
        const reads = await Promise.all(
          keys.map(key => api.metrics.history(startup.id, key, { limit: months }).catch(() => null)),
        );
        if (!alive.current) return;
        const next = {};
        reads.forEach((read, i) => {
          if (read) next[keys[i]] = read.items;
        });
        setHistory(next);
      } catch {
        // A chart that cannot load shows its empty state; the KPI row above
        // is already rendered and must not be replaced by an error.
        if (alive.current) setHistory({});
      } finally {
        if (alive.current) setHistoryLoading(false);
      }

      // 5f readiness: a bonus label, never a blocker.
      try {
        const board = await api.readiness.board(startup.id);
        if (alive.current) setReadinessScore(board.summary.readiness_pct);
      } catch {
        if (alive.current) setReadinessScore(null);
      }
    })();
  }, [reload, range]);

  const METRIC_EDIT_ROLES = ['owner', 'admin', 'member'];
  const canEdit = !!org && METRIC_EDIT_ROLES.includes(org.my_role);
  const byKey = Object.fromEntries((latest?.items || []).map(i => [i.metric_key, i]));

  const lastUpdated = (() => {
    const stamps = (latest?.items || []).map(i => new Date(i.created_at).getTime()).filter(Number.isFinite);
    if (!stamps.length) return '';
    return timeAgo(new Date(Math.max(...stamps)).toISOString());
  })();

  /**
   * Percentage change between the two newest points, or null when a change
   * cannot honestly be claimed. `history[key] === undefined` means "we never
   * loaded this series" and must not be read as "there is no history".
   */
  const deltaFor = (key) => {
    const points = history[key];
    if (!points || points.length < 2) return null;
    const [newest, prev] = [Number(points[0].value), Number(points[1].value)];
    if (!Number.isFinite(newest) || !Number.isFinite(prev) || prev === 0) return null;
    const pct = ((newest - prev) / Math.abs(prev)) * 100;
    return Number.isFinite(pct) ? pct : null;
  };

  /** True only when the series was loaded and genuinely has one point. */
  const singlePointOnly = (key) => Array.isArray(history[key]) && history[key].length === 1;

  /**
   * Insight cards are generated from data that exists, never from a template
   * with numbers filled in. Each entry is only pushed when its inputs are
   * real; an empty list hides the whole row (no fake insights).
   */
  const insightCards = () => {
    const out = [];
    if (tab === 'Overview') {
      const mrrDelta = deltaFor('mrr');
      const mrr = byKey.mrr;
      if (mrrDelta !== null && mrr) {
        out.push([
          mrrDelta >= 0 ? 'Revenue grew this period' : 'Revenue dipped this period',
          `MRR is ${formatMoney(Number(mrr.value), mrr.currency)} (${periodLabel(mrr.period_end)}), ${Math.abs(mrrDelta).toFixed(1)}% ${mrrDelta >= 0 ? 'up' : 'down'} on the period before.`,
        ]);
      }
      const runway = byKey.runway_months;
      if (runway) {
        out.push([
          `Runway is ${formatMetricValue(runway).trim()}`,
          `As reported for ${periodLabel(runway.period_end)}. Runway is your own figure, not calculated here.`,
        ]);
      }
      const burn = byKey.burn;
      if (burn) {
        out.push([
          `Monthly burn ${formatMoney(Number(burn.value), burn.currency)}`,
          `Reported for ${periodLabel(burn.period_end)}. Add more periods to see a trend.`,
        ]);
      }
    }
    if (tab === 'Journey') {
      if (readinessScore !== null) {
        out.push([
          `Readiness is ${readinessScore} of 100`,
          'From the reviewed checklist. Sign-offs, not the score, decide the badge.',
        ]);
      }
      const customers = byKey.customers;
      if (customers) {
        out.push([
          `${formatMetricValue(customers)} customers`,
          `Reported for ${periodLabel(customers.period_end)}.`,
        ]);
      }
      const headcount = byKey.headcount;
      if (headcount) {
        out.push([
          `Team of ${formatMetricValue(headcount)}`,
          `Reported for ${periodLabel(headcount.period_end)}.`,
        ]);
      }
    }
    return out.slice(0, 3);
  };

  /** The KPI card label → metric key, for the details drawer. */
  const drawerKey = Object.keys(METRIC_META).find(k => METRIC_META[k].label === drawer) || null;

  const exportCsv = () => {
    const rows = [
      ['Metric', 'Value', 'Source', 'Period', 'Updated'],
      ...(latest?.items || []).map(i => [
        METRIC_META[i.metric_key]?.label || i.metric_key,
        i.value,
        i.source === 'startup_reported' ? 'Entered by team' : i.source.replace(/_/g, ' '),
        i.period_end,
        i.created_at,
      ]),
    ];
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' }));
    a.download = 'analytics-metrics.csv';
    a.click();
    notify(rows.length > 1 ? 'Analytics CSV exported.' : 'No metrics to export yet.');
  };

  /** 422 details → {field: message} for the entry form. */
  const fieldErrors = (err) => {
    const out = {};
    if (err instanceof ApiError && Array.isArray(err.details)) {
      for (const d of err.details) {
        const loc = Array.isArray(d.loc) ? d.loc : [];
        const key = loc[loc.length - 1];
        if (typeof key === 'string' && !out[key]) out[key] = d.msg || 'Invalid value.';
      }
    }
    return out;
  };

  const submitEntry = async () => {
    if (!org) return;
    setEntryBusy(true);
    setEntryErrs({});
    setEntryFormErr('');
    try {
      await api.metrics.upsert(org.id, {
        metric_key: entry.metric_key,
        value: entry.value,
        period_end: entry.period_end,
        unit: entry.unit || null,
        currency: entry.currency || null,
      });
      if (!alive.current) return;
      setEntryOpen(false);
      setEntry({ metric_key: 'mrr', value: '', period_end: '', unit: '', currency: 'INR' });
      notify('Metric saved.');
      setReload(n => n + 1);
    } catch (err) {
      if (!alive.current) return;
      const fields = fieldErrors(err);
      if (Object.keys(fields).length) {
        setEntryErrs(fields);
      } else {
        // 409 (verified period) and 403 land here: show the server's words.
        setEntryFormErr(err instanceof ApiError ? err.message : 'Could not save. Please try again.');
      }
    } finally {
      if (alive.current) setEntryBusy(false);
    }
  };

  // Business and Market still render their sample KPI rows unchanged; the
  // Overview/Journey rows above are built from the metrics API instead.
  const kpis = tab === 'Business'
    ? [['MRR', '₹4.8L', '▲ 12%', 'Entered by team'], ['Growth MoM', '12%', '▲ 2.1 pts', 'Calculated'], ['Cash balance', '₹28.0L', '▼ 4%', 'Entered by team'], ['Runway', '9 mo', 'No change', 'Calculated']]
    : tab === 'Market'
    ? [['SAM', '₹1,200 Cr', 'Base scenario', 'Team estimate'], ['Market share', '0.04%', 'Estimate', 'Calculated'], ['Market CAGR', '18%', '2024–29', 'External source'], ['Competitors tracked', '8', '2 added this month', 'Entered by team']]
    : [];

  return (
    <div className="min-h-screen bg-[#FAF8F4] text-[#0F1B2D]">
      <a href="#analytics-main" className="sr-only focus:not-sr-only">Skip to content</a>

      {/* Shared Startup Sidebar */}
      <StartupSidebar
        active="Analytics"
        compact={compact}
        setCompact={setCompact}
        mobileOpen={mobileNav}
        setMobileOpen={setMobileNav}
        onAction={notify}
      />

      {/* Header */}
      <header className={`sticky top-0 z-10 flex h-[68px] items-center justify-between border-b border-[#E5E1D8] bg-[#FAF8F4]/95 px-4 backdrop-blur transition-[margin] duration-200 sm:px-7 ${compact ? 'lg:ml-[76px]' : 'lg:ml-[240px]'}`}>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileNav(true)}
            className="grid h-9 w-9 place-items-center rounded-lg border border-[#E5E1D8] bg-white text-ink lg:hidden"
            aria-label="Open navigation menu"
          >
            <Menu size={18} />
          </button>
          <div className="relative hidden sm:block">
            <Search className="absolute left-3 top-2.5 text-[#A0A7B4]" size={17} />
            <input placeholder="Search workspace" className="h-10 w-64 rounded-lg border border-[#E5E1D8] bg-white pl-9 text-sm" />
          </div>
          <Link href="/startup/dashboard" className="text-sm font-semibold sm:hidden">
            ← Dashboard
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => notify('You’re all caught up.')}
            aria-label="Notifications"
            className="relative grid h-10 w-10 place-items-center"
          >
            <Bell size={19} />
            <i className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#B8955A]" />
          </button>
          <span className="flex items-center gap-2 text-xs">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-ink font-semibold text-white">AK</span>
            <span className="hidden sm:block">Aarav Kapoor</span>
            <ChevronDown size={14} />
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main id="analytics-main" className={`mx-auto max-w-[1440px] px-4 pb-12 pt-7 transition-[margin] duration-200 sm:px-7 lg:px-8 ${compact ? 'lg:ml-[76px]' : 'lg:ml-[240px]'}`}>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-[#4A5568]">{org?.name || 'Your startup'} <span className="mx-2 text-[#B8955A]">·</span> Workspace</p>
            <h1 className="serif mt-1 text-[30px] font-semibold">Analytics</h1>
            <p className="mt-1 text-sm text-[#4A5568]">Understand your progress, your business and your market.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select aria-label="Date range" value={range} onChange={e => setRange(e.target.value)} className="h-10 rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs">
              <option>Last 30 days</option>
              <option>Last 90 days</option>
              <option>This quarter</option>
              <option>12 months</option>
              <option>Custom</option>
            </select>
            <button type="button" onClick={exportCsv} className="hidden min-h-10 items-center gap-2 rounded-lg border border-[#E5E1D8] bg-white px-3 text-sm font-semibold sm:inline-flex">
              <Download size={15} /> Export
            </button>
            <button type="button" onClick={() => setShare(true)} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-ink px-3 text-sm font-semibold text-white">
              <Share2 size={15} /> Share report
            </button>
          </div>
        </div>

        <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl border border-[#E5E1D8] bg-white p-1" role="tablist" aria-label="Analytics sections">
          {tabs.map(x => (
            <button
              key={x}
              type="button"
              role="tab"
              aria-selected={tab === x}
              onClick={() => setTab(x)}
              className={`min-h-10 shrink-0 rounded-lg px-5 text-sm ${
                tab === x ? 'bg-ink font-semibold text-white' : 'text-[#4A5568] hover:bg-[#FAF8F4]'
              }`}
            >
              {x}
            </button>
          ))}
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-[#E5E1D8] bg-white p-3">
          <label className="flex items-center gap-2 text-xs text-[#4A5568]">
            Compare to
            <select value={compare} onChange={e => setCompare(e.target.value)} className="h-9 rounded-lg border border-[#E5E1D8] bg-white px-2 text-xs font-medium text-ink">
              <option>Previous period</option>
              <option>Same period last year</option>
              <option>Target</option>
            </select>
          </label>
          <span className="h-5 w-px bg-[#E5E1D8]" />
          <span className="text-xs text-[#4A5568]">Current stage: <b className="text-ink">Prototype</b></span>
          <button
            type="button"
            onClick={() => { setReload(n => n + 1); notify('Analytics refreshed.'); }}
            className="ml-auto inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-xs font-semibold text-[#9A7A45] hover:bg-[#FAF8F4]"
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <small className="text-[10px] text-[#4A5568]">
            {lastUpdated ? `Updated ${lastUpdated}` : 'No data reported yet'}
          </small>
        </div>

        {/* The Business/Market tabs keep their demo insight cards until
            their steps land; Overview/Journey show only figures the API can
            actually support, and nothing at all when it cannot. */}
        {(tab === 'Overview' || tab === 'Journey') && insightCards().length > 0 && (
        <div className="mb-5 grid gap-3 md:grid-cols-3">
          {insightCards().map(([h, d], i) => (
            <section key={h} className="rounded-xl border border-[#E7D4B0] bg-[#F3EBDD] p-4">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-white text-[#9A7A45]">
                  {i === 0 ? <TrendingUp size={15} /> : i === 1 ? <AlertCircle size={15} /> : <Info size={15} />}
                </span>
                {h}
              </p>
              <p className="mt-2 pl-9 text-xs leading-5 text-[#4A5568]">{d}</p>
              <span className="mt-2 block pl-9 text-[10px] font-medium text-[#806236]">Auto insight · not advice</span>
            </section>
          ))}
        </div>
        )}

        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {/* Overview/Journey read the live metric values. A key with no
              reported value shows "—" and "Not reported yet" — never a 0. */}
          {(tab === 'Overview' || tab === 'Journey') && metricsPhase === 'loading' && [0, 1, 2, 3].map(k => (
            <div key={k} className="h-[148px] animate-pulse rounded-xl border border-[#E5E1D8] bg-white" />
          ))}

          {(tab === 'Overview' || tab === 'Journey') && metricsPhase === 'ready' &&
            (tab === 'Overview'
              ? ['readiness', 'mrr', 'runway_months', 'headcount']
              : ['readiness', 'customers', 'growth_mom', 'active_users']
            ).map(key => {
              const item = key === 'readiness' ? null : byKey[key];
              const label = key === 'readiness' ? 'Readiness score' : METRIC_META[key].label;
              const value =
                key === 'readiness'
                  ? readinessScore === null ? '—' : `${readinessScore} / 100`
                  : formatMetricValue(item);
              const delta = key === 'readiness' ? null : deltaFor(key);
              // Three distinct truths: a real change, a genuinely single
              // period, or "not loaded" (historyLoading) — never conflated.
              const change =
                key === 'readiness'
                  ? readinessScore === null ? 'Not available yet' : 'Reviewed checklist'
                  : !item ? 'Not reported yet'
                  : !history[key] && historyLoading ? 'Loading trend…'
                  : delta !== null ? `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta).toFixed(1)}%`
                  : singlePointOnly(key) ? 'Only one period so far'
                  : 'No prior period';
              const source =
                key === 'readiness' ? 'Readiness checklist' : item ? sourceLabel(item.source) : 'Not reported yet';
              const hasValue = key === 'readiness' ? readinessScore !== null : !!item;
              return (
                <button
                  type="button"
                  onClick={() => hasValue && key !== 'readiness' && setDrawer(label)}
                  key={label}
                  className="rounded-xl border border-[#E5E1D8] bg-white p-4 text-left transition hover:border-[#A0A7B4] sm:p-5"
                >
                  <p className="text-xs text-[#4A5568]">{label}</p>
                  <p className={`serif mt-2 text-[28px] font-semibold tabular-nums ${hasValue ? '' : 'text-[#A0A7B4]'}`}>{value}</p>
                  <p className={`mt-1 inline-flex items-center gap-1 text-xs ${
                    key !== 'readiness' && delta !== null
                      ? delta < 0 ? 'text-[#B42318]' : 'text-[#2E7D5B]'
                      : 'text-[#4A5568]'
                  }`}>
                    {key !== 'readiness' && delta !== null
                      ? delta < 0 ? <TrendingDown size={13} /> : <TrendingUp size={13} />
                      : null} {change}
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <Source>{source}</Source>
                    <span className="text-[10px] text-[#4A5568]">
                      {item ? timeAgo(item.created_at) : hasValue ? '' : 'Add data'}
                    </span>
                  </div>
                </button>
              );
            })}

          {tab === 'Overview' && metricsPhase === 'error' && (
            <div className="col-span-2 rounded-xl border border-[#F0C9C9] bg-[#FDECEC] p-4 text-xs text-[#A33A3A] lg:col-span-4" role="alert">
              {metricsError}{' '}
              <button type="button" onClick={() => setReload(n => n + 1)} className="ml-2 font-semibold underline">
                Try again
              </button>
            </div>
          )}

          {tab === 'Overview' && metricsPhase === 'none' && (
            <div className="col-span-2 rounded-xl border border-[#E5E1D8] bg-white p-4 text-xs text-[#4A5568] lg:col-span-4">
              Metrics are tracked per startup organization. Set up your startup to start reporting.
            </div>
          )}

          {(tab === 'Business' || tab === 'Market') && kpis.map(([label, value, change, source]) => (
            <button
              type="button"
              onClick={() => setDrawer(label)}
              key={label}
              className="rounded-xl border border-[#E5E1D8] bg-white p-4 text-left transition hover:border-[#A0A7B4] sm:p-5"
            >
              <p className="text-xs text-[#4A5568]">{label}</p>
              <p className="serif mt-2 text-[28px] font-semibold tabular-nums">{value}</p>
              <p className={`mt-1 inline-flex items-center gap-1 text-xs ${change.includes('▼') ? 'text-[#B42318]' : 'text-[#2E7D5B]'}`}>
                {change.includes('▼') ? <TrendingDown size={13} /> : <TrendingUp size={13} />} {change}
              </p>
              <div className="mt-3 flex items-center justify-between">
                <Source>{source}</Source>
                <span className="text-[10px] text-[#4A5568]">2h ago</span>
              </div>
            </button>
          ))}
        </div>

        <div className="grid items-start gap-5 xl:grid-cols-3">
          <div className="space-y-5 xl:col-span-2">
            {tab === 'Overview' && (
              <>
                {/* Stage, goals and the attention list belong to the stage
                    toolkit and task board (5a/5c). They are hidden here rather
                    than filled with numbers this page cannot verify. */}
                <div className="grid gap-5 md:grid-cols-2">
                  <Card
                    title="Revenue vs burn"
                    action={`${history.mrr?.length || 0} month${(history.mrr?.length || 0) === 1 ? '' : 's'} of data`}
                  >
                    <Bars revenue={history.mrr || []} burn={history.burn || []} loading={historyLoading} />
                    <div className="mt-3 flex gap-4 text-[10px] text-[#4A5568]">
                      <span>● Revenue (MRR)</span>
                      <span className="text-[#8792A0]">● Burn</span>
                    </div>
                    <p className="mt-3 text-[10px] text-[#4A5568]">
                      Only months reported by your team. Nothing is estimated.
                    </p>
                  </Card>
                  <Card
                    title="Latest reported"
                    action={canEdit ? (
                      <button type="button" onClick={() => setEntryOpen(true)} className="text-xs font-semibold text-[#9A7A45]">
                        Add data
                      </button>
                    ) : null}
                  >
                    {metricsPhase === 'error' ? (
                      <EmptyNote>
                        These values could not be loaded. {metricsError}
                      </EmptyNote>
                    ) : metricsPhase === 'ready' && (latest?.items || []).length === 0 ? (
                      <EmptyNote>
                        No metrics reported yet. {canEdit ? 'Use “Add data” to enter your first month.' : 'Ask a team member to enter them.'}
                      </EmptyNote>
                    ) : (
                      <div className="space-y-2">
                        {METRIC_KEYS.map(key => {
                          const item = byKey[key];
                          return (
                            <div key={key} className="flex items-center justify-between gap-2 border-b border-[#E5E1D8] pb-2 text-xs last:border-0">
                              <span className="text-[#4A5568]">{METRIC_META[key].label}</span>
                              <span className="flex items-center gap-2">
                                <b className="tabular-nums">{formatMetricValue(item)}</b>
                                <span className="w-20 text-right text-[10px] text-[#4A5568]">
                                  {item ? periodLabel(item.period_end) : 'Not reported'}
                                </span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                </div>

                <Card
                  title="Reported metrics"
                  action={
                    <Link href="/startup/analytics" className="inline-flex items-center gap-1 text-xs font-semibold text-[#9A7A45]">
                      History per metric <ArrowRight size={13} />
                    </Link>
                  }
                >
                  <p className="text-xs leading-5 text-[#4A5568]">
                    Every figure on this tab comes from the {Object.keys(METRIC_META).length} startup metrics your team reports.
                    Readiness, stage progress and goal tracking live on their own pages.
                  </p>
                </Card>
              </>
            )}

            {tab === 'Journey' && (
              <>
                {/* Journey keeps only what the metrics API can support.
                    Stage timing, mentor sessions and investor/hiring funnels
                    belong to 5a/8/7 and are replaced by honest empty states. */}
                <Card title="Growth & traction">
                  <p className="mb-4 text-xs text-[#4A5568]">
                    Monthly values reported by your team, newest first.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {['customers', 'growth_mom', 'headcount', 'active_users'].map(key => {
                      const item = byKey[key];
                      return (
                        <div key={key} className="rounded-lg border border-[#E5E1D8] p-3">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-xs text-[#4A5568]">{METRIC_META[key].label}</span>
                            <b className={`serif text-xl tabular-nums ${item ? '' : 'text-[#A0A7B4]'}`}>
                              {formatMetricValue(item)}
                            </b>
                          </div>
                          <p className="mt-1 text-[10px] text-[#4A5568]">
                            {item ? `${periodLabel(item.period_end)} · ${sourceLabel(item.source)}` : 'Not reported yet'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </Card>

                <div className="grid gap-5 md:grid-cols-2">
                  <Card title="Readiness">
                    {readinessScore === null ? (
                      <EmptyNote>Readiness is not available yet. It comes from the reviewed checklist.</EmptyNote>
                    ) : (
                      <>
                        <div className="flex items-end justify-between">
                          <span className="serif text-3xl font-semibold">{readinessScore}</span>
                          <span className="text-xs text-[#4A5568]">out of 100</span>
                        </div>
                        <div className="mt-3 h-2 rounded-full bg-[#E5E1D8]">
                          <div className="h-full rounded-full bg-ink" style={{ width: `${readinessScore}%` }} />
                        </div>
                        <Link href="/startup/readiness" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#9A7A45]">
                          Open readiness <ArrowRight size={13} />
                        </Link>
                      </>
                    )}
                  </Card>
                  <Card title="Mentor impact">
                    <EmptyNote>
                      Mentor sessions and sign-offs arrive with the mentorship module (Step 8). Nothing is estimated here.
                    </EmptyNote>
                  </Card>
                </div>

                <Card title="Investor & hiring funnels">
                  <EmptyNote>
                    Investor interest arrives with Step 9 and hiring counts with Step 7. These funnels stay empty until then.
                  </EmptyNote>
                </Card>

                <Card title="Workspace usage">
                  <EmptyNote>
                    Activity counts are not tracked by the metrics API. This card fills in with the dashboard summary in 5g.
                  </EmptyNote>
                </Card>
              </>
            )}

            {tab === 'Business' && (
              <>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Early revenue metrics</h2>
                  <button type="button" onClick={() => setShowAll(!showAll)} className="text-xs font-semibold text-[#9A7A45]">
                    {showAll ? 'Stage defaults' : 'All metrics'}
                  </button>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <Card title="MRR trend">
                    <p className="mb-3 text-xs font-medium">MRR grew 12% over the last month.</p>
                    <LineChart compare={compare !== 'Target'} />
                    <p className="mt-3 text-[10px] text-[#4A5568]">Source: entered by team · Last updated 2 hours ago</p>
                    <button type="button" onClick={() => setDrawer('MRR trend')} className="mt-2 text-xs font-semibold text-[#9A7A45]">
                      View as table / calculation
                    </button>
                  </Card>
                  <Card title="Revenue vs burn">
                    <p className="mb-3 text-xs font-medium">Net burn is trending down.</p>
                    <Bars />
                    <div className="mt-3 flex gap-4 text-[10px] text-[#4A5568]">
                      <span>● Revenue</span>
                      <span className="text-[#8792A0]">● Burn</span>
                    </div>
                    <p className="mt-3 text-[10px] text-[#4A5568]">Runway = cash balance ÷ net burn. Estimate only.</p>
                  </Card>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <Card title="Customers & retention">
                    <p className="mb-3 text-xs font-medium">Customer count has grown steadily this quarter.</p>
                    <LineChart values={[20, 32, 38, 45, 57, 63, 76]} />
                    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                      {[
                        ['Churn rate', '2.4%'],
                        ['NRR', '108%'],
                        ['Avg. revenue / customer', '₹3,810'],
                      ].map(([n, v]) => (
                        <div key={n} className="rounded-lg bg-[#FAF8F4] p-2">
                          <b className="block text-sm">{v}</b>
                          <small className="text-[10px] text-[#4A5568]">{n}</small>
                        </div>
                      ))}
                    </div>
                  </Card>
                  <Card title="Sales funnel">
                    <p className="mb-4 text-xs text-[#4A5568]">Average sales cycle: 24 days · Win rate: 18%</p>
                    {[
                      ['Lead', 82],
                      ['Contacted', 59],
                      ['Demo', 34],
                      ['Proposal', 19],
                      ['Won', 14],
                    ].map(([n, v]) => (
                      <div key={n} className="mb-3 flex items-center gap-3 text-xs">
                        <span className="w-20">{n}</span>
                        <div className="h-3 flex-1 rounded-full bg-[#E5E1D8]">
                          <div className="h-full rounded-full bg-ink" style={{ width: `${v}%` }} />
                        </div>
                        <b>{v}</b>
                      </div>
                    ))}
                  </Card>
                </div>

                <Card title="Unit economics">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                    {[
                      ['CAC', '₹8,400', 'Sales & marketing / new customers'],
                      ['LTV', '₹42,000', 'ARPC × margin ÷ churn'],
                      ['LTV:CAC', '5.0×', 'Lifetime value ÷ CAC'],
                      ['Payback', '4.2 mo', 'CAC ÷ monthly gross profit'],
                      ['Gross margin', '72%', 'Revenue less direct costs'],
                    ].map(([n, v, d]) => (
                      <button key={n} type="button" onClick={() => setDrawer(n)} className="rounded-lg border border-[#E5E1D8] p-3 text-left">
                        <small className="text-[11px] text-[#4A5568]">{n}</small>
                        <b className="serif my-1 block text-xl">{v}</b>
                        <small className="text-[10px] leading-4 text-[#4A5568]">{d}</small>
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-[10px] text-[#4A5568]">Healthy ranges vary by sector and business model; these are not verdicts or financial advice.</p>
                </Card>

                {showAll && (
                  <Card title="Additional metrics">
                    <div className="grid gap-3 sm:grid-cols-3">
                      {[
                        ['Activation rate', '64%'],
                        ['Weekly active users', '312'],
                        ['NPS', '42'],
                        ['Support response time', '3.2h'],
                        ['Revenue per employee', '₹60K'],
                        ['Open roles', '3'],
                      ].map(([n, v]) => (
                        <div key={n} className="rounded-lg bg-[#FAF8F4] p-3">
                          <b className="text-sm">{v}</b>
                          <p className="text-xs text-[#4A5568]">{n}</p>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </>
            )}

            {tab === 'Market' && (
              <>
                <div className="mb-5 flex items-start gap-3 rounded-xl border border-[#E7D4B0] bg-[#FFF8E8] p-4 text-xs leading-5 text-[#806236]">
                  <AlertCircle className="mt-0.5 shrink-0" size={16} />
                  Market figures are estimates. Check the source before using them in a pitch.
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <Card
                    title="Market size · TAM → SAM → SOM"
                    action={
                      <select value={scenario} onChange={e => setScenario(e.target.value)} className="h-9 rounded-lg border border-[#E5E1D8] bg-white px-2 text-xs">
                        <option>Conservative</option>
                        <option>Base</option>
                        <option>Optimistic</option>
                      </select>
                    }
                  >
                    <p className="mb-4 text-xs text-[#4A5568]">Scenario: {scenario} · Estimates use team assumptions</p>
                    {[
                      ['TAM', '₹1,200 Cr', 100, 'High · cited source'],
                      ['SAM', '₹320 Cr', 62, 'Medium · team estimate'],
                      ['SOM', '₹18 Cr', 26, 'Low · early estimate'],
                    ].map(([n, v, w, c]) => (
                      <div key={n} className="mb-4">
                        <div className="mb-1 flex justify-between text-xs">
                          <b>{n}</b>
                          <span>{v}</span>
                        </div>
                        <div className="h-3 rounded-full bg-[#E5E1D8]">
                          <div className={`h-full rounded-full ${n === 'TAM' ? 'bg-ink' : n === 'SAM' ? 'bg-[#B8955A]' : 'bg-[#A0A7B4]'}`} style={{ width: `${w}%` }} />
                        </div>
                        <small className="text-[10px] text-[#4A5568]">2025 estimate · {c}</small>
                      </div>
                    ))}
                    <Link href="/startup/stage" className="inline-flex items-center gap-1 text-xs font-semibold text-[#9A7A45]">
                      Edit assumptions <ArrowUpRight size={13} />
                    </Link>
                  </Card>

                  <Card
                    title="Competitor landscape"
                    action={
                      <button type="button" onClick={() => notify('Competitor added.')} className="text-xs font-semibold text-[#9A7A45]">
                        + Add competitor
                      </button>
                    }
                  >
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[420px] text-left text-xs">
                        <thead className="border-b text-[#4A5568]">
                          <tr>
                            {['Company', 'Type', 'Customer', 'Pricing', 'Updated'].map(x => (
                              <th key={x} className="py-2">{x}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            ['Finly', 'Direct', 'SMBs', '₹₹', 'Oct 30'],
                            ['LedgerLoop', 'Direct', 'Startups', '₹₹₹', 'Nov 01'],
                            ['SheetFlow', 'Substitute', 'SMBs', 'Free', 'Oct 25'],
                            ['Cashwise', 'Indirect', 'Mid-market', '₹₹', 'Oct 22'],
                          ].map(r => (
                            <tr key={r[0]} className="border-b border-[#E5E1D8]">
                              <td className="py-3 font-semibold">{r[0]}</td>
                              {r.slice(1).map((x, i) => (
                                <td className="py-3 text-[#4A5568]" key={i}>{x}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </div>

                <Card title="Industry signals">
                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      ['SMB digitization accelerating', 'Opportunity', 'More small firms adopting integrated finance tools.', 'External · Aug 2026'],
                      ['Embedded finance competition', 'Watch', 'Adjacent platforms adding cash management features.', 'Team note · Oct 2026'],
                      ['Open banking adoption', 'Opportunity', 'New integrations may reduce onboarding time.', 'External · Jul 2026'],
                    ].map(([h, type, d, src]) => (
                      <div key={h} className="rounded-lg border border-[#E5E1D8] p-4">
                        <span className="rounded-full bg-[#E7F3EC] px-2 py-1 text-[10px] text-[#286749]">{type}</span>
                        <h3 className="mt-3 text-sm font-semibold">{h}</h3>
                        <p className="mt-1 text-xs leading-5 text-[#4A5568]">{d}</p>
                        <small className="mt-2 block text-[10px] text-[#4A5568]">{src}</small>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card title="Peer benchmarks">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">Compare with anonymous startups at the same stage.</p>
                      <p className="mt-1 text-xs text-[#4A5568]">Benchmarks require a group of at least 10 similar startups. No individual companies are shown.</p>
                    </div>
                    <label className="flex items-center gap-2 text-xs">
                      <input type="checkbox" checked={opted} onChange={() => setOpted(!opted)} className="accent-ink" /> Contribute anonymized data
                    </label>
                  </div>
                  {opted ? (
                    <div className="mt-4 rounded-lg bg-[#FAF8F4] p-4 text-xs text-[#4A5568]">
                      Not enough similar startups yet. You’re opted in; benchmarks will appear when the sample size reaches 10.
                    </div>
                  ) : (
                    <button type="button" onClick={() => setOpted(true)} className="mt-4 rounded-lg bg-ink px-4 py-2.5 text-xs font-semibold text-white">
                      Opt in to benchmarks
                    </button>
                  )}
                </Card>

                <Card title="Investor landscape">
                  <p className="text-sm">{tab === 'Market' ? '42 active investors' : '—'} in fintech are active on the platform.</p>
                  <p className="mt-1 text-xs text-[#4A5568]">Aggregated activity only. Investor identities are not displayed here.</p>
                  <Link href="/startup/investors" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#9A7A45]">
                    Explore relevant investors <ArrowRight size={13} />
                  </Link>
                </Card>
              </>
            )}
          </div>

          <aside className="space-y-5">
            {(tab === 'Overview' || tab === 'Journey') && metricsPhase === 'ready' && (
              <Card title="Data completeness">
                <div className="flex items-end justify-between">
                  <span className="serif text-3xl font-semibold">{METRIC_KEYS.length - (latest?.missing || []).length} / {METRIC_KEYS.length}</span>
                  <span className="text-xs text-[#4A5568]">metrics reported</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-[#E5E1D8]">
                  <div
                    className="h-full rounded-full bg-[#B8955A]"
                    style={{ width: `${Math.round(((METRIC_KEYS.length - (latest?.missing || []).length) / METRIC_KEYS.length) * 100)}%` }}
                  />
                </div>
                <div className="mt-4 space-y-3">
                  {(latest?.missing || []).slice(0, 3).map(key => (
                    <div key={key} className="flex w-full items-center gap-2 text-left text-xs">
                      <span className="h-2 w-2 rounded-full bg-[#B7791F]" />
                      Add {METRIC_META[key].label}
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => { setEntry({ metric_key: key, value: '', period_end: '', unit: '', currency: METRIC_META[key].money ? 'INR' : '' }); setEntryOpen(true); }}
                          className="ml-auto font-semibold text-[#9A7A45]"
                        >
                          Enter
                        </button>
                      )}
                    </div>
                  ))}
                  {(latest?.missing || []).length === 0 && (
                    <p className="text-xs text-[#4A5568]">All eight metrics have a reported value.</p>
                  )}
                </div>
              </Card>
            )}

            <Card title="Data sources">
              <p className="mb-3 text-xs leading-5 text-[#4A5568]">Every figure should be traceable to its source.</p>
              <div className="space-y-3">
                {[
                  ['Entered by team', 'Manual or imported values'],
                  ['Calculated', 'Formula from platform data'],
                  ['Platform benchmark', 'Aggregated, opt-in startups'],
                  ['External', 'Cited third-party source'],
                ].map(([n, d], i) => (
                  <div key={n} className="flex items-start gap-2">
                    <span className={`mt-1 h-2 w-2 rounded-full ${['bg-ink', 'bg-[#B8955A]', 'bg-[#A0A7B4]', 'bg-[#4A5568]'][i]}`} />
                    <div>
                      <b className="text-xs">{n}</b>
                      <p className="text-[10px] leading-4 text-[#4A5568]">{d}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-[10px] text-[#4A5568]">
                {tab === 'Overview' || tab === 'Journey'
                  ? 'Overview and Journey read reported metrics only; Business and Market still show sample values.'
                  : 'Current sample values are demonstration data, not connected financial records.'}
              </p>
            </Card>

            <Card title="Quick actions">
              <div className="space-y-2">
                <button
                  type="button"
                  disabled={!canEdit}
                  title={canEdit ? undefined : 'Viewers cannot add metrics'}
                  onClick={() => setEntryOpen(true)}
                  className="flex min-h-10 w-full items-center gap-2 rounded-lg border border-[#E5E1D8] px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <PlusIcon />Add data
                </button>
                <button type="button" onClick={() => notify('CSV import is ready to connect.')} className="flex min-h-10 w-full items-center gap-2 rounded-lg border border-[#E5E1D8] px-3 text-xs font-semibold">
                  <Download size={14} />Import data
                </button>
                <Link href="/startup/stage" className="flex min-h-10 items-center gap-2 rounded-lg border border-[#E5E1D8] px-3 text-xs font-semibold">
                  <Target size={14} />Stage toolkit
                </Link>
              </div>
            </Card>

            <Card title="How to read this">
              <p className="text-xs leading-5 text-[#4A5568]">Auto insights and forecasts are based on the data available and are not financial advice. Missing or outdated inputs can affect results.</p>
              <button type="button" onClick={() => setDrawer('Definitions & formulas')} className="mt-3 text-xs font-semibold text-[#9A7A45]">
                Metric definitions <ArrowRight className="inline" size={13} />
              </button>
            </Card>
          </aside>
        </div>

        <p className="mt-6 text-[10px] text-[#4A5568]">Reports respect your startup profile visibility and data-sharing preferences.</p>
      </main>

      {/* Details Drawer */}
      {drawer && (
        <div className="fixed inset-0 z-40 bg-[#0F1B2D]/35" onMouseDown={e => { if (e.target === e.currentTarget) setDrawer(''); }}>
          <aside role="dialog" aria-modal="true" aria-label={`${drawer} details`} className="absolute inset-y-0 right-0 w-full max-w-[520px] overflow-y-auto bg-[#FAF8F4] p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="serif text-2xl font-semibold">{drawer}</h2>
                <p className="mt-1 text-xs text-[#4A5568]">{range} · compared with {compare}</p>
              </div>
              <button type="button" onClick={() => setDrawer('')} aria-label="Close details" className="grid h-10 w-10 place-items-center rounded-lg bg-white">
                <X size={18} />
              </button>
            </div>
            <div className="mt-6 rounded-xl border border-[#E5E1D8] bg-white p-5">
              <p className="text-sm font-semibold">Trend detail</p>
              {drawerKey && (history[drawerKey] || []).length > 0 ? (
                <LineChart points={history[drawerKey]} compare={compare !== 'Target'} />
              ) : (
                <EmptyNote>
                  {drawerKey
                    ? `No reported values for ${METRIC_META[drawerKey].label} yet. Add a month to start the trend.`
                    : 'This card belongs to a later step and has no data source yet.'}
                </EmptyNote>
              )}
              <p className="mt-3 text-xs leading-5 text-[#4A5568]">
                Definition: {
                  drawerKey === 'mrr' ? 'Monthly recurring revenue, as reported by your team.'
                  : drawerKey === 'arr' ? 'Annual recurring revenue, as reported by your team.'
                  : drawerKey === 'burn' ? 'Net cash burn per month, as reported by your team.'
                  : drawerKey === 'runway_months' ? 'Months of runway, as reported by your team. The platform does not derive it.'
                  : drawerKey === 'growth_mom' ? 'Month-on-month growth in percent, as reported by your team.'
                  : 'Reported by your team for the selected period.'
                }
              </p>
              {drawerKey && byKey[drawerKey] && <Source>{sourceLabel(byKey[drawerKey].source)}</Source>}
            </div>
            {drawerKey && (
              <div className="mt-4 rounded-xl border border-[#E5E1D8] bg-white p-5">
                <h3 className="text-sm font-semibold">Reported values</h3>
                {(history[drawerKey] || []).length === 0 ? (
                  <p className="mt-3 text-xs text-[#4A5568]">Nothing reported yet.</p>
                ) : (
                  <div className="mt-3 space-y-2 text-xs">
                    {(history[drawerKey] || []).map(point => (
                      <div key={point.period_end} className="flex items-center justify-between gap-2 border-b border-[#E5E1D8] pb-2">
                        <span>{periodLabel(point.period_end)}</span>
                        <b className="tabular-nums">{formatMetricValue({ metric_key: drawerKey, value: point.value, currency: byKey[drawerKey]?.currency })}</b>
                        <span className="text-[10px] text-[#4A5568]">{sourceLabel(point.source)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <button type="button" onClick={() => notify('Note saved.')} className="mt-4 w-full rounded-lg border border-[#E5E1D8] bg-white p-3 text-xs font-semibold">
              Add team note
            </button>
          </aside>
        </div>
      )}

      {/* Add-data modal: the only write path on this page. Styled like the
          share dialog above; field errors come from the server's 422. */}
      {entryOpen && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[#0F1B2D]/45 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="add-data-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <button type="button" onClick={() => setEntryOpen(false)} className="float-right" aria-label="Close">
              <X size={18} />
            </button>
            <h2 id="add-data-title" className="serif text-2xl font-semibold">Add monthly data</h2>
            <p className="mt-2 text-sm leading-6 text-[#4A5568]">
              One value per metric and month. Reporting the same month again replaces it, unless a mentor has verified it.
            </p>

            {entryFormErr && (
              <div role="alert" className="mt-4 rounded-lg border border-[#F0C9C9] bg-[#FDECEC] p-3 text-xs text-[#A33A3A]">
                {entryFormErr}
              </div>
            )}

            <div className="mt-4 space-y-3">
              <label className="block text-xs font-semibold">
                Metric
                <select
                  value={entry.metric_key}
                  onChange={e => setEntry(v => ({ ...v, metric_key: e.target.value }))}
                  className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-2 text-xs font-normal"
                >
                  {METRIC_KEYS.map(key => <option key={key} value={key}>{METRIC_META[key].label}</option>)}
                </select>
                {entryErrs.metric_key && <span className="mt-1 block font-normal text-[#A33A3A]">{entryErrs.metric_key}</span>}
              </label>

              <label className="block text-xs font-semibold">
                Value
                <input
                  type="text"
                  inputMode="decimal"
                  value={entry.value}
                  onChange={e => setEntry(v => ({ ...v, value: e.target.value }))}
                  placeholder={METRIC_META[entry.metric_key]?.suffix ? `e.g. 12` : 'e.g. 250000'}
                  className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs font-normal"
                />
                {entryErrs.value && <span className="mt-1 block font-normal text-[#A33A3A]">{entryErrs.value}</span>}
              </label>

              <label className="block text-xs font-semibold">
                Period end
                <input
                  type="date"
                  value={entry.period_end}
                  onChange={e => setEntry(v => ({ ...v, period_end: e.target.value }))}
                  className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs font-normal"
                />
                {entryErrs.period_end && <span className="mt-1 block font-normal text-[#A33A3A]">{entryErrs.period_end}</span>}
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-semibold">
                  Currency
                  <input
                    type="text"
                    maxLength={3}
                    value={entry.currency}
                    onChange={e => setEntry(v => ({ ...v, currency: e.target.value.toUpperCase() }))}
                    placeholder="INR"
                    className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs font-normal"
                  />
                  {entryErrs.currency && <span className="mt-1 block font-normal text-[#A33A3A]">{entryErrs.currency}</span>}
                </label>
                <label className="block text-xs font-semibold">
                  Unit <span className="font-normal text-[#4A5568]">(optional)</span>
                  <input
                    type="text"
                    maxLength={32}
                    value={entry.unit}
                    onChange={e => setEntry(v => ({ ...v, unit: e.target.value }))}
                    placeholder="e.g. active subscriptions"
                    className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs font-normal"
                  />
                  {entryErrs.unit && <span className="mt-1 block font-normal text-[#A33A3A]">{entryErrs.unit}</span>}
                </label>
              </div>
            </div>

            <button
              type="button"
              disabled={entryBusy}
              onClick={submitEntry}
              className="mt-5 min-h-10 w-full rounded-lg bg-ink text-sm font-semibold text-white disabled:opacity-60"
            >
              {entryBusy ? 'Saving…' : 'Save metric'}
            </button>
          </section>
        </div>
      )}

      {/* Share Modal */}
      {share && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[#0F1B2D]/45 p-4">
          <section role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <button type="button" onClick={() => setShare(false)} className="float-right" aria-label="Close">
              <X size={18} />
            </button>
            <h2 className="serif text-2xl font-semibold">Share analytics report</h2>
            <p className="mt-2 text-sm leading-6 text-[#4A5568]">Create a view-only report link for your mentor or investors. Only metrics permitted by your profile sharing settings are included.</p>
            <label className="mt-4 flex items-center gap-2 text-xs">
              <input type="checkbox" className="accent-ink" defaultChecked /> Include only profile-approved metrics
            </label>
            <button type="button" onClick={() => { setShare(false); notify('View-only share link copied.'); }} className="mt-5 min-h-10 w-full rounded-lg bg-ink text-sm font-semibold text-white">
              Create share link
            </button>
          </section>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div role="status" aria-live="polite" className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-ink px-4 py-3 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

function PlusIcon() {
  return <span className="grid h-4 w-4 place-items-center rounded-full border border-current">+</span>;
}
