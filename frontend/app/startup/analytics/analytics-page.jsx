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

// Step 5k: the keys the Business tab adds on top of 5e's eight. They have
// no entry in METRIC_META (that map is the Overview/Journey contract), so
// they get their own labels and formatting here.
const BUSINESS_LABELS = {
  churn_rate: 'Churn rate',
  cac: 'CAC',
  ltv: 'LTV',
  nrr: 'Net revenue retention',
  arpc: 'Avg. revenue / customer',
  gross_margin: 'Gross margin',
  activation_rate: 'Activation rate',
  nps: 'NPS',
  support_response_hours: 'Support response time',
  weekly_active_users: 'Weekly active users',
};

// The ten 5k keys the "All metrics" grid can honestly show. `revenue per
// employee` and `open roles` are deliberately absent: the first is not a
// metric key, the second belongs to Step 7 hiring.
const BUSINESS_EXTRA_KEYS = [
  'activation_rate',
  'weekly_active_users',
  'nps',
  'support_response_hours',
  'churn_rate',
  'nrr',
  'arpc',
  'gross_margin',
  'cac',
  'ltv',
];

const SOURCE_TYPE_LABEL = {
  team_estimate: 'Team estimate',
  external_report: 'External source',
  calculated: 'Calculated',
  platform: 'Platform',
};

const CONFIDENCE_LABEL = { high: 'High', medium: 'Medium', low: 'Low' };

const STAGE_LABEL = {
  idea: 'Idea',
  prototype: 'Prototype',
  early_revenue: 'Early revenue',
  growth: 'Growth',
  mature: 'Mature',
};

const MARKET_METRIC_LABEL = { tam: 'TAM', sam: 'SAM', som: 'SOM' };

const MARKET_SCENARIO_LABEL = {
  conservative: 'Conservative',
  base: 'Base',
  optimistic: 'Optimistic',
};

/** Percent-shaped 5k keys, so a value renders as "2.4%" not "2.4". */
const PERCENT_KEYS = new Set([
  'churn_rate',
  'nrr',
  'gross_margin',
  'activation_rate',
  'growth_mom',
]);

/** Format a Business KPI for a KPI card or tile. */
function formatBizValue(key, item) {
  if (!item) return '—';
  const n = Number(item.value);
  if (!Number.isFinite(n)) return '—';
  if (PERCENT_KEYS.has(key)) return `${Number(n.toFixed(2))}%`;
  if (key === 'support_response_hours') return `${Number(n.toFixed(1))}h`;
  if (METRIC_META[key]?.money || item.currency) return formatMoney(n, item.currency);
  return Number.isInteger(n) ? n.toLocaleString('en-IN') : String(Number(n.toFixed(2)));
}

/** Format a market size: money uses the rupee short form, counts do not. */
function formatMarketValue(entry) {
  if (!entry) return '—';
  const n = Number(entry.value);
  if (!Number.isFinite(n)) return '—';
  if (entry.unit === 'count') return n.toLocaleString('en-IN');
  return formatMoney(n, entry.currency || 'INR');
}

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

/**
 * Real reported values only (Step 5e/5k). An empty series draws the
 * "no reported values" state — there is no sample fallback, so a chart can
 * never render numbers nobody entered.
 */
function LineChart({ points = [], unit = '', compare = false }) {
  const width = 660, height = 210, pad = 28;
  // Chronological order for the line; the API returns newest first.
  const series = [...points].reverse();
  const nums = series.map(p => Number(p.value));
  const scaled = normalise(nums);
  const step = series.length > 1 ? (width - pad * 2) / (series.length - 1) : 0;
  const x = i => (series.length > 1 ? pad + i * step : width / 2);
  const y = v => height - pad - v * (height - pad * 2) / 100;
  const path = scaled.map((v, i) => `${i ? 'L' : 'M'} ${x(i)} ${y(v)}`).join(' ');
  const path2 = scaled.map((v, i) => `${i ? 'L' : 'M'} ${x(i)} ${y(Math.max(8, v - 13))}`).join(' ');
  const ariaLabel = series.length
    ? `Line chart of ${series.length} reported period${series.length === 1 ? '' : 's'}, from ${periodLabel(series[0].period_end)} to ${periodLabel(series[series.length - 1].period_end)}`
    : 'No chart data';
  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel} className="h-[190px] w-full">
        <title>Reported trend</title>
        {[0, 1, 2, 3].map(i => (
          <line key={i} x1={pad} x2={width - pad} y1={pad + i * (height - pad * 2) / 3} y2={pad + i * (height - pad * 2) / 3} stroke="#E5E1D8" strokeDasharray="3 4" />
        ))}
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
      </svg>
      {series.length > 0 && (
        <p className="mt-1 text-[10px] text-[#4A5568]">
          {formatMetricValue({ metric_key: 'mrr', value: series[series.length - 1].value, currency: null }).replace(/^₹/, '')}
          {unit ? ` ${unit}` : ''} in {periodLabel(series[series.length - 1].period_end)}
        </p>
      )}
    </div>
  );
}

/**
 * Two-series bars (revenue vs burn) from reported months only (Step 5k).
 * With no reported months it renders an empty state, never sample bars.
 */
function Bars({ revenue, burn, loading = false }) {
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

  // Step 5e: real metrics. `metricsPhase` gates the Overview/Journey tabs.
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

  // Step 5k: the Business tab's aggregate. One call answers the whole tab;
  // its own phase means a Business failure never blanks Overview.
  const [biz, setBiz] = useState(null); // BusinessAnalytics
  const [bizPhase, setBizPhase] = useState('loading'); // loading|ready|error
  const [bizError, setBizError] = useState('');

  // Step 5l: market size board + competitors, each with its own phase so
  // one failing panel never takes the other down.
  const [market, setMarket] = useState(null); // MarketSizeBoard
  const [marketPhase, setMarketPhase] = useState('loading');
  const [marketError, setMarketError] = useState('');
  const [competitors, setCompetitors] = useState([]); // CompetitorRead[]
  const [competitorTotal, setCompetitorTotal] = useState(0);
  const [competitorPhase, setCompetitorPhase] = useState('loading');
  const [competitorError, setCompetitorError] = useState('');
  // The market-size form: which (metric, scenario) is open, if any.
  const [sizeForm, setSizeForm] = useState(null); // { metric, scenario } | null
  const [sizeValues, setSizeValues] = useState({ value: '', currency: 'INR', estimate_year: '', source_type: 'team_estimate', source_note: '', confidence: 'low', assumptions: '' });
  const [sizeErrs, setSizeErrs] = useState({});
  const [sizeFormErr, setSizeFormErr] = useState('');
  const [sizeBusy, setSizeBusy] = useState(false);
  // The competitor form: null = closed, { id? } = create/edit.
  const [compForm, setCompForm] = useState(null); // { id?, name, type, website, target_customer, positioning, strengths, weaknesses, pricing_note, last_reviewed_on }
  const [compErrs, setCompErrs] = useState({});
  const [compFormErr, setCompFormErr] = useState('');
  const [compBusy, setCompBusy] = useState(false);

  // Step 5m (Journey): the real stage, read from 5i. The four later-step
  // cards stay honest empty states until Steps 7/8/9 land.
  const [stageName, setStageName] = useState(null);

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

  // Step 5k: the Business tab. Own effect so a failure here cannot blank
  // Overview, and so the tab loads even if the metrics call above failed.
  useEffect(() => {
    if (!org) return;
    let cancelled = false;
    (async () => {
      setBizPhase('loading');
      setBizError('');
      try {
        const data = await api.analytics.business(org.id);
        if (cancelled) return;
        setBiz(data);
        setBizPhase('ready');
      } catch (err) {
        if (cancelled) return;
        setBizError(err instanceof ApiError ? err.message : 'Could not load the business metrics.');
        setBizPhase('error');
      }
    })();
    return () => { cancelled = true; };
  }, [org, reload]);

  // Step 5l: market size board and competitors. Two calls, two phases.
  useEffect(() => {
    if (!org) return;
    let cancelled = false;
    (async () => {
      setMarketPhase('loading');
      setMarketError('');
      try {
        const board = await api.market.board(org.id);
        if (cancelled) return;
        setMarket(board);
        setMarketPhase('ready');
      } catch (err) {
        if (cancelled) return;
        setMarketError(err instanceof ApiError ? err.message : 'Could not load your market size.');
        setMarketPhase('error');
      }
    })();

    (async () => {
      setCompetitorPhase('loading');
      setCompetitorError('');
      try {
        const page = await api.market.competitors(org.id, { limit: 50 });
        if (cancelled) return;
        setCompetitors(page.items);
        setCompetitorTotal(page.total);
        setCompetitorPhase('ready');
      } catch (err) {
        if (cancelled) return;
        setCompetitorError(err instanceof ApiError ? err.message : 'Could not load your competitors.');
        setCompetitorPhase('error');
      }
    })();

    return () => { cancelled = true; };
  }, [org, reload]);

  // Step 5m: the real stage for the Journey header and strip. 5i owns it;
  // a failure leaves the label blank rather than asserting a stage.
  useEffect(() => {
    if (!org) return;
    let cancelled = false;
    (async () => {
      try {
        const summary = await api.stage.summary(org.id);
        if (!cancelled) setStageName(summary.stage);
      } catch {
        if (!cancelled) setStageName(null);
      }
    })();
    return () => { cancelled = true; };
  }, [org, reload]);

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

  // --- Step 5k: Business tab view model ---------------------------------
  const bizKpis = Object.fromEntries((biz?.kpis || []).map(k => [k.key, k]));
  const bizDerived = Object.fromEntries((biz?.unit_economics || []).map(u => [u.key, u]));
  // A funnel step is renderable only when a count was actually reported.
  const bizFunnel = (biz?.funnel || []).filter(step => step.count !== null);

  // --- Step 5l: Market tab view model -----------------------------------
  const baseSizes = Object.fromEntries(
    (market?.items || [])
      .filter(entry => entry.scenario === 'base')
      .map(entry => [entry.metric, entry]),
  );
  const samSize = baseSizes.sam || null;
  const sizeFor = (metric, scenario) =>
    (market?.items || []).find(e => e.metric === metric && e.scenario === scenario) || null;

  // The market-size ladder for the scenario currently selected in the UI.
  const scenarioKey = scenario.toLowerCase();
  const marketSizes = (market?.items || [])
    .filter(entry => entry.scenario === scenarioKey)
    .sort((a, b) => ['tam', 'sam', 'som'].indexOf(a.metric) - ['tam', 'sam', 'som'].indexOf(b.metric));

  /** One honest sentence about the MRR trend, or null when there is none. */
  const mrrDeltaText = () => {
    const delta = deltaFor('mrr');
    if (delta === null) return null;
    const dir = delta >= 0 ? 'grew' : 'fell';
    return `MRR ${dir} ${Math.abs(delta).toFixed(1)}% on the previous reported month.`;
  };

  // --- Step 5l: market-size form ----------------------------------------
  const openSizeForm = (metric = 'tam') => {
    const existing = sizeFor(metric, scenarioKey);
    setSizeForm({ metric, scenario: scenarioKey });
    setSizeValues({
      value: existing ? String(Number(existing.value)) : '',
      currency: existing?.currency || 'INR',
      estimate_year: existing ? String(existing.estimate_year) : String(new Date().getFullYear()),
      source_type: existing?.source_type || 'team_estimate',
      source_note: existing?.source_note || '',
      confidence: existing?.confidence || 'low',
      assumptions: existing?.assumptions || '',
    });
    setSizeErrs({});
    setSizeFormErr('');
  };

  const submitSize = async () => {
    if (!org || !sizeForm) return;
    setSizeBusy(true);
    setSizeErrs({});
    setSizeFormErr('');
    try {
      await api.market.upsert(org.id, {
        metric: sizeForm.metric,
        scenario: sizeForm.scenario,
        value: sizeValues.value,
        unit: 'currency',
        currency: sizeValues.currency || null,
        estimate_year: Number(sizeValues.estimate_year),
        source_type: sizeValues.source_type,
        source_note: sizeValues.source_note || null,
        confidence: sizeValues.confidence,
        assumptions: sizeValues.assumptions || null,
      });
      setSizeForm(null);
      setReload(n => n + 1);
      notify('Market size saved.');
    } catch (err) {
      // A 422 lands on the field that failed, never only in the toast.
      if (err instanceof ApiError && err.status === 422) {
        const fields = fieldErrors(err);
        if (Object.keys(fields).length) setSizeErrs(fields);
        else setSizeFormErr(err.message);
      } else {
        setSizeFormErr(err instanceof ApiError ? err.message : 'Could not save the market size.');
      }
    } finally {
      setSizeBusy(false);
    }
  };

  // --- Step 5l: competitor form -----------------------------------------
  const openCompetitorForm = (existing = null) => {
    setCompForm({
      id: existing?.id || null,
      name: existing?.name || '',
      type: existing?.type || 'direct',
      website: existing?.website || '',
      target_customer: existing?.target_customer || '',
      positioning: existing?.positioning || '',
      strengths: existing?.strengths || '',
      weaknesses: existing?.weaknesses || '',
      pricing_note: existing?.pricing_note || '',
      last_reviewed_on: existing?.last_reviewed_on || '',
    });
    setCompErrs({});
    setCompFormErr('');
  };

  const submitCompetitor = async () => {
    if (!org || !compForm) return;
    setCompBusy(true);
    setCompErrs({});
    setCompFormErr('');
    // Blank optional fields are sent as null, not as empty strings.
    const blankToNull = (v) => (v && v.trim() !== '' ? v : null);
    const payload = {
      name: compForm.name,
      type: compForm.type,
      website: blankToNull(compForm.website),
      target_customer: blankToNull(compForm.target_customer),
      positioning: blankToNull(compForm.positioning),
      strengths: blankToNull(compForm.strengths),
      weaknesses: blankToNull(compForm.weaknesses),
      pricing_note: blankToNull(compForm.pricing_note),
      last_reviewed_on: compForm.last_reviewed_on || null,
    };
    try {
      if (compForm.id) {
        await api.market.updateCompetitor(org.id, compForm.id, payload);
      } else {
        await api.market.createCompetitor(org.id, payload);
      }
      setCompForm(null);
      setReload(n => n + 1);
      notify(compForm.id ? 'Competitor updated.' : 'Competitor added.');
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const fields = fieldErrors(err);
        if (Object.keys(fields).length) setCompErrs(fields);
        else setCompFormErr(err.message);
      } else {
        // 409 (duplicate name) and 403 land here with the server's words.
        setCompFormErr(err instanceof ApiError ? err.message : 'Could not save this competitor.');
      }
    } finally {
      setCompBusy(false);
    }
  };

  const deleteCompetitor = async (competitor) => {
    if (!org) return;
    try {
      await api.market.deleteCompetitor(org.id, competitor.id);
      setReload(n => n + 1);
      notify(`${competitor.name} removed.`);
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not remove this competitor.');
    }
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
          <span className="text-xs text-[#4A5568]">
            Current stage: <b className="text-ink">{stageName ? STAGE_LABEL[stageName] || stageName : '—'}</b>
          </span>
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

        {/* Insight cards exist only for Overview/Journey, and only from
            values this page actually loaded. An empty list hides the row. */}
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

          {/* 5k: the Business KPI row, built from the API's reported values.
              A card with no reported value shows "—" and "Not reported yet"
              plus an Enter action for editors — never a 0. */}
          {tab === 'Business' && bizPhase === 'loading' && [0, 1, 2, 3].map(k => (
            <div key={k} className="h-[148px] animate-pulse rounded-xl border border-[#E5E1D8] bg-white" />
          ))}

          {tab === 'Business' && bizPhase === 'error' && (
            <div className="col-span-2 rounded-xl border border-[#F0C9C9] bg-[#FDECEC] p-4 text-xs text-[#A33A3A] lg:col-span-4" role="alert">
              {bizError}{' '}
              <button type="button" onClick={() => setReload(n => n + 1)} className="ml-2 font-semibold underline">
                Try again
              </button>
            </div>
          )}

          {tab === 'Business' && bizPhase === 'ready' &&
            ['mrr', 'growth_mom', 'churn_rate', 'runway_months'].map(key => {
              const item = bizKpis[key];
              const label = METRIC_META[key]?.label || BUSINESS_LABELS[key] || key;
              return (
                <button
                  type="button"
                  onClick={() => item && setDrawer(label)}
                  key={key}
                  className="rounded-xl border border-[#E5E1D8] bg-white p-4 text-left transition hover:border-[#A0A7B4] sm:p-5"
                >
                  <p className="text-xs text-[#4A5568]">{label}</p>
                  <p className={`serif mt-2 text-[28px] font-semibold tabular-nums ${item ? '' : 'text-[#A0A7B4]'}`}>
                    {item ? formatBizValue(key, item) : '—'}
                  </p>
                  <p className="mt-1 inline-flex items-center gap-1 text-xs text-[#4A5568]">
                    {item ? periodLabel(item.period_end) : 'Not reported yet'}
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <Source>{item ? sourceLabel(item.source) : 'Not reported yet'}</Source>
                    {!item && canEdit ? (
                      <button
                        type="button"
                        onClick={() => {
                          setEntry({ metric_key: key, value: '', period_end: '', unit: METRIC_META[key]?.suffix ? '%' : '', currency: METRIC_META[key]?.money ? 'INR' : '' });
                          setEntryErrs({});
                          setEntryFormErr('');
                          setEntryOpen(true);
                        }}
                        className="text-[10px] font-semibold text-[#9A7A45]"
                      >
                        Enter
                      </button>
                    ) : (
                      <span className="text-[10px] text-[#4A5568]">{item ? timeAgo(item.period_end) : ''}</span>
                    )}
                  </div>
                </button>
              );
            })}

          {/* 5l: the Market KPI row. SAM comes from the market-size board,
              market share is derived server-side (None = not computable),
              and CAGR / external signals are not in the API — absent, never
              invented. */}
          {tab === 'Market' && marketPhase === 'loading' && [0, 1, 2, 3].map(k => (
            <div key={k} className="h-[148px] animate-pulse rounded-xl border border-[#E5E1D8] bg-white" />
          ))}

          {tab === 'Market' && marketPhase === 'error' && (
            <div className="col-span-2 rounded-xl border border-[#F0C9C9] bg-[#FDECEC] p-4 text-xs text-[#A33A3A] lg:col-span-4" role="alert">
              {marketError}{' '}
              <button type="button" onClick={() => setReload(n => n + 1)} className="ml-2 font-semibold underline">
                Try again
              </button>
            </div>
          )}

          {tab === 'Market' && marketPhase === 'ready' && [
            ['sam', 'SAM', samSize ? formatMarketValue(samSize) : '—', samSize ? `${samSize.estimate_year} · ${CONFIDENCE_LABEL[samSize.confidence]}` : 'Not entered yet', samSize ? SOURCE_TYPE_LABEL[samSize.source_type] : 'Not entered yet'],
            ['share', 'Market share', market?.market_share_pct == null ? '—' : `${Number(market.market_share_pct).toFixed(2)}%`, market?.market_share_pct == null ? 'Needs SAM and ARR' : 'ARR ÷ base SAM', market?.market_share_pct == null ? 'Not available' : 'Calculated'],
            ['cagr', 'Market CAGR', '—', 'No market-growth source yet', 'Not available'],
            ['competitors', 'Competitors tracked', String(market?.competitors_tracked ?? 0), market?.competitors_tracked ? 'Live entries' : 'None added yet', 'Entered by team'],
          ].map(([key, label, value, change, source]) => (
            <div key={key} className="rounded-xl border border-[#E5E1D8] bg-white p-4 text-left sm:p-5">
              <p className="text-xs text-[#4A5568]">{label}</p>
              <p className={`serif mt-2 text-[28px] font-semibold tabular-nums ${value === '—' ? 'text-[#A0A7B4]' : ''}`}>{value}</p>
              <p className="mt-1 text-xs text-[#4A5568]">{change}</p>
              <div className="mt-3 flex items-center justify-between">
                <Source>{source}</Source>
              </div>
            </div>
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

            {tab === 'Business' && bizPhase === 'loading' && (
              <div className="grid gap-5 md:grid-cols-2">
                {[0, 1, 2, 3].map(k => (
                  <div key={k} className="h-[260px] animate-pulse rounded-xl border border-[#E5E1D8] bg-white" />
                ))}
              </div>
            )}

            {tab === 'Business' && bizPhase === 'error' && (
              <Card title="Business analytics">
                <div className="rounded-lg border border-[#F0C9C9] bg-[#FDECEC] p-4 text-xs text-[#A33A3A]" role="alert">
                  {bizError}
                </div>
                <button type="button" onClick={() => setReload(n => n + 1)} className="mt-3 text-xs font-semibold text-[#9A7A45]">
                  Try again
                </button>
              </Card>
            )}

            {tab === 'Business' && bizPhase === 'ready' && (
              <>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Early revenue metrics</h2>
                  <button type="button" onClick={() => setShowAll(!showAll)} className="text-xs font-semibold text-[#9A7A45]">
                    {showAll ? 'Stage defaults' : 'All metrics'}
                  </button>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <Card title="MRR trend">
                    <p className="mb-3 text-xs font-medium">
                      {mrrDeltaText() || 'No trend yet — add a second month of MRR.'}
                    </p>
                    <LineChart points={history.mrr || []} compare={compare !== 'Target'} />
                    <p className="mt-3 text-[10px] text-[#4A5568]">
                      {bizKpis.mrr
                        ? `Source: ${sourceLabel(bizKpis.mrr.source)} · last updated ${timeAgo(bizKpis.mrr.period_end)}`
                        : 'No MRR reported yet.'}
                    </p>
                    <button type="button" onClick={() => setDrawer('MRR trend')} className="mt-2 text-xs font-semibold text-[#9A7A45]">
                      View as table / calculation
                    </button>
                  </Card>
                  <Card title="Revenue vs burn">
                    <p className="mb-3 text-xs font-medium">
                      {bizDerived.net_burn
                        ? `Net burn is ${formatMoney(Number(bizDerived.net_burn.value), bizKpis.burn?.currency)} for the latest month.`
                        : 'Net burn needs both revenue and burn.'}
                    </p>
                    <Bars revenue={history.mrr || []} burn={history.burn || []} loading={historyLoading} />
                    <div className="mt-3 flex gap-4 text-[10px] text-[#4A5568]">
                      <span>● Revenue</span>
                      <span className="text-[#8792A0]">● Burn</span>
                    </div>
                    <p className="mt-3 text-[10px] text-[#4A5568]">Runway = cash balance ÷ net burn. Estimate only.</p>
                  </Card>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <Card title="Customers & retention">
                    <p className="mb-3 text-xs font-medium">
                      {bizKpis.customers
                        ? `${formatBizValue('customers', bizKpis.customers)} customers reported for ${periodLabel(bizKpis.customers.period_end)}.`
                        : 'No customer count reported yet.'}
                    </p>
                    <LineChart points={history.customers || []} />
                    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                      {[
                        ['Churn rate', bizKpis.churn_rate],
                        ['NRR', bizKpis.nrr],
                        ['Avg. revenue / customer', bizKpis.arpc || biz?.retention?.calculated_arpc],
                      ].map(([n, v]) => (
                        <div key={n} className="rounded-lg bg-[#FAF8F4] p-2">
                          <b className={`block text-sm ${v ? '' : 'text-[#A0A7B4]'}`}>
                            {v ? formatBizValue(n === 'NRR' ? 'nrr' : n === 'Churn rate' ? 'churn_rate' : 'arpc', v) : '—'}
                          </b>
                          <small className="text-[10px] text-[#4A5568]">{n}</small>
                        </div>
                      ))}
                    </div>
                  </Card>
                  <Card title="Sales funnel">
                    <p className="mb-4 text-xs text-[#4A5568]">
                      {bizFunnel.length === 0
                        ? 'No funnel counts reported yet. Enter lead, contacted, demo, proposal and won counts for a month.'
                        : `Reported for ${periodLabel(bizFunnel[0].period_end)}.`}
                    </p>
                    {bizFunnel.map(step => {
                      // Width is each step against the FIRST reported step, so
                      // the bars narrow the way the pipeline actually does.
                      const first = Number(bizFunnel[0].count);
                      const pct = first > 0 ? Math.round((Number(step.count) / first) * 100) : 0;
                      return (
                        <div key={step.key} className="mb-3 flex items-center gap-3 text-xs">
                          <span className="w-20">{step.label}</span>
                          <div className="h-3 flex-1 rounded-full bg-[#E5E1D8]">
                            <div className="h-full rounded-full bg-ink" style={{ width: `${pct}%` }} />
                          </div>
                          <b className="w-14 text-right tabular-nums">{Number(step.count).toLocaleString('en-IN')}</b>
                          <span className="w-12 text-right text-[10px] text-[#4A5568]">
                            {step.total_conversion_pct == null ? '' : `${Number(step.total_conversion_pct).toFixed(0)}%`}
                          </span>
                        </div>
                      );
                    })}
                  </Card>
                </div>

                <Card title="Unit economics">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                    {[
                      ['CAC', bizKpis.cac ? formatMoney(Number(bizKpis.cac.value), bizKpis.cac.currency) : null, 'Sales & marketing / new customers'],
                      ['LTV', bizKpis.ltv ? formatMoney(Number(bizKpis.ltv.value), bizKpis.ltv.currency) : null, 'ARPC × margin ÷ churn'],
                      ['LTV:CAC', bizDerived.ltv_cac ? `${Number(bizDerived.ltv_cac.value).toFixed(1)}×` : null, 'Lifetime value ÷ CAC'],
                      ['Payback', bizDerived.payback_months ? `${Number(bizDerived.payback_months.value).toFixed(1)} mo` : null, 'CAC ÷ monthly gross profit'],
                      ['Gross margin', bizKpis.gross_margin ? formatBizValue('gross_margin', bizKpis.gross_margin) : null, 'Revenue less direct costs'],
                    ].map(([n, v, d]) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => v && setDrawer(n)}
                        disabled={!v}
                        className={`rounded-lg border border-[#E5E1D8] p-3 text-left ${v ? '' : 'cursor-default'}`}
                      >
                        <small className="text-[11px] text-[#4A5568]">{n}</small>
                        <b className={`serif my-1 block text-xl ${v ? '' : 'text-[#A0A7B4]'}`}>{v || '—'}</b>
                        <small className="text-[10px] leading-4 text-[#4A5568]">{v ? d : 'Not enough data yet'}</small>
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-[10px] text-[#4A5568]">Healthy ranges vary by sector and business model; these are not verdicts or financial advice.</p>
                </Card>

                {showAll && (
                  <Card title="Additional metrics">
                    <div className="grid gap-3 sm:grid-cols-3">
                      {BUSINESS_EXTRA_KEYS.map(key => {
                        const item = bizKpis[key];
                        return (
                          <div key={key} className="rounded-lg bg-[#FAF8F4] p-3">
                            <b className={`text-sm ${item ? '' : 'text-[#A0A7B4]'}`}>
                              {item ? formatBizValue(key, item) : '—'}
                            </b>
                            <p className="text-xs text-[#4A5568]">{BUSINESS_LABELS[key]}</p>
                            <small className="text-[10px] text-[#4A5568]">
                              {item ? periodLabel(item.period_end) : 'Not reported yet'}
                            </small>
                          </div>
                        );
                      })}
                    </div>
                    <p className="mt-3 text-[10px] leading-4 text-[#4A5568]">
                      Revenue per employee and open roles are not tracked here: the first has no metric key, the second belongs to hiring (Step 7).
                    </p>
                  </Card>
                )}
              </>
            )}

            {tab === 'Market' && marketPhase === 'loading' && (
              <div className="grid gap-5 md:grid-cols-2">
                {[0, 1].map(k => (
                  <div key={k} className="h-[320px] animate-pulse rounded-xl border border-[#E5E1D8] bg-white" />
                ))}
              </div>
            )}

            {tab === 'Market' && marketPhase === 'error' && (
              <Card title="Market data">
                <div className="rounded-lg border border-[#F0C9C9] bg-[#FDECEC] p-4 text-xs text-[#A33A3A]" role="alert">
                  {marketError}
                </div>
                <button type="button" onClick={() => setReload(n => n + 1)} className="mt-3 text-xs font-semibold text-[#9A7A45]">
                  Try again
                </button>
              </Card>
            )}

            {tab === 'Market' && marketPhase === 'ready' && (
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
                    <p className="mb-4 text-xs text-[#4A5568]">
                      Scenario: {scenario} · {marketSizes.length > 0 ? 'Values and sources are what your team entered' : 'Nothing entered for this scenario yet'}
                    </p>
                    {marketSizes.length === 0 ? (
                      <EmptyNote>
                        No market size entered for {scenario.toLowerCase()}. {canEdit ? 'Add TAM, SAM and SOM to see the ladder.' : 'A team member can add these figures.'}
                      </EmptyNote>
                    ) : (
                      marketSizes.map(entry => {
                        // Bar width is each figure against the largest one
                        // shown, so the ladder narrows honestly.
                        const top = Math.max(...marketSizes.map(e => Number(e.value)));
                        const width = top > 0 ? Math.round((Number(entry.value) / top) * 100) : 0;
                        return (
                          <div key={entry.id} className="mb-4">
                            <div className="mb-1 flex justify-between text-xs">
                              <b>{MARKET_METRIC_LABEL[entry.metric]}</b>
                              <span>{formatMarketValue(entry)}</span>
                            </div>
                            <div className="h-3 rounded-full bg-[#E5E1D8]">
                              <div
                                className={`h-full rounded-full ${entry.metric === 'tam' ? 'bg-ink' : entry.metric === 'sam' ? 'bg-[#B8955A]' : 'bg-[#A0A7B4]'}`}
                                style={{ width: `${width}%` }}
                              />
                            </div>
                            <small className="text-[10px] text-[#4A5568]">
                              {entry.estimate_year} estimate · {CONFIDENCE_LABEL[entry.confidence]} · {SOURCE_TYPE_LABEL[entry.source_type]}
                            </small>
                          </div>
                        );
                      })
                    )}
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => openSizeForm()}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#9A7A45]"
                      >
                        Edit assumptions <ArrowUpRight size={13} />
                      </button>
                    )}
                    <Link href="/startup/stage" className="ml-4 inline-flex items-center gap-1 text-xs font-semibold text-[#9A7A45]">
                      Market sizing tool <ArrowUpRight size={13} />
                    </Link>
                  </Card>

                  <Card
                    title="Competitor landscape"
                    action={
                      canEdit ? (
                        <button type="button" onClick={() => openCompetitorForm()} className="text-xs font-semibold text-[#9A7A45]">
                          + Add competitor
                        </button>
                      ) : null
                    }
                  >
                    {competitorPhase === 'loading' && <p className="text-xs text-[#4A5568]">Loading competitors…</p>}
                    {competitorPhase === 'error' && (
                      <div className="rounded-lg border border-[#F0C9C9] bg-[#FDECEC] p-3 text-xs text-[#A33A3A]" role="alert">
                        {competitorError}
                      </div>
                    )}
                    {competitorPhase === 'ready' && competitors.length === 0 && (
                      <EmptyNote>No competitors tracked yet. {canEdit ? 'Add the ones you compete with.' : 'A team member can add them.'}</EmptyNote>
                    )}
                    {competitorPhase === 'ready' && competitors.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[420px] text-left text-xs">
                          <thead className="border-b text-[#4A5568]">
                            <tr>
                              {['Company', 'Type', 'Customer', 'Pricing', 'Updated'].map(x => (
                                <th key={x} className="py-2">{x}</th>
                              ))}
                              {canEdit && <th className="py-2" />}
                            </tr>
                          </thead>
                          <tbody>
                            {competitors.map(c => (
                              <tr key={c.id} className="border-b border-[#E5E1D8]">
                                <td className="py-3 font-semibold">
                                  {c.website ? (
                                    <a href={c.website} target="_blank" rel="noopener noreferrer" className="hover:underline">{c.name}</a>
                                  ) : c.name}
                                </td>
                                <td className="py-3 capitalize text-[#4A5568]">{c.type}</td>
                                <td className="py-3 text-[#4A5568]">{c.target_customer || '—'}</td>
                                <td className="py-3 text-[#4A5568]">{c.pricing_note || '—'}</td>
                                <td className="py-3 text-[#4A5568]">
                                  {c.last_reviewed_on ? periodLabel(c.last_reviewed_on) : '—'}
                                </td>
                                {canEdit && (
                                  <td className="py-3 text-right">
                                    <button
                                      type="button"
                                      onClick={() => openCompetitorForm(c)}
                                      className="text-[11px] font-semibold text-[#9A7A45]"
                                    >
                                      Edit
                                    </button>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <p className="mt-2 text-[10px] text-[#4A5568]">{competitorTotal} tracked</p>
                      </div>
                    )}
                  </Card>
                </div>

                <Card title="Industry signals">
                  <EmptyNote>
                    Industry trends come from curated platform content (an admin step). Nothing is generated here.
                  </EmptyNote>
                </Card>

                <Card title="Peer benchmarks">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">Compare with anonymous startups at the same stage.</p>
                      <p className="mt-1 text-xs text-[#4A5568]">Benchmarks require a group of at least 10 similar startups. No individual companies are shown.</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <EmptyNote>
                      Benchmarks are not available yet. They arrive with the aggregated analytics step, once enough similar startups contribute.
                    </EmptyNote>
                  </div>
                </Card>

                <Card title="Investor landscape">
                  <EmptyNote>
                    Investor activity arrives with the investor module (Step 9). No aggregated figures are shown until then.
                  </EmptyNote>
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
                {'Figures on this page are entered by your team or calculated from them; anything missing is shown as not reported.'}
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

      {/* Step 5l: market-size form. Field errors come from the server's 422,
          the same contract as the 5e "Add monthly data" modal above. */}
      {sizeForm && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[#0F1B2D]/45 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="market-size-title" className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <button type="button" onClick={() => setSizeForm(null)} className="float-right" aria-label="Close">
              <X size={18} />
            </button>
            <h2 id="market-size-title" className="serif text-2xl font-semibold">
              {MARKET_METRIC_LABEL[sizeForm.metric]} · {MARKET_SCENARIO_LABEL[sizeForm.scenario]}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#4A5568]">
              An estimate with its source and confidence. The platform never infers a market size for you.
            </p>

            {sizeFormErr && (
              <div role="alert" className="mt-4 rounded-lg border border-[#F0C9C9] bg-[#FDECEC] p-3 text-xs text-[#A33A3A]">
                {sizeFormErr}
              </div>
            )}

            <div className="mt-4 space-y-3">
              <label className="block text-xs font-semibold">
                Value
                <input
                  type="text"
                  inputMode="decimal"
                  value={sizeValues.value}
                  onChange={e => setSizeValues(v => ({ ...v, value: e.target.value }))}
                  placeholder="e.g. 12000000000"
                  className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs font-normal"
                />
                {sizeErrs.value && <span className="mt-1 block font-normal text-[#A33A3A]">{sizeErrs.value}</span>}
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-semibold">
                  Currency
                  <input
                    type="text"
                    maxLength={3}
                    value={sizeValues.currency}
                    onChange={e => setSizeValues(v => ({ ...v, currency: e.target.value.toUpperCase() }))}
                    placeholder="INR"
                    className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs font-normal"
                  />
                  {sizeErrs.currency && <span className="mt-1 block font-normal text-[#A33A3A]">{sizeErrs.currency}</span>}
                </label>
                <label className="block text-xs font-semibold">
                  Estimate year
                  <input
                    type="number"
                    min="1900"
                    max="2100"
                    value={sizeValues.estimate_year}
                    onChange={e => setSizeValues(v => ({ ...v, estimate_year: e.target.value }))}
                    className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs font-normal"
                  />
                  {sizeErrs.estimate_year && <span className="mt-1 block font-normal text-[#A33A3A]">{sizeErrs.estimate_year}</span>}
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-semibold">
                  Source
                  <select
                    value={sizeValues.source_type}
                    onChange={e => setSizeValues(v => ({ ...v, source_type: e.target.value }))}
                    className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-2 text-xs font-normal"
                  >
                    <option value="team_estimate">Team estimate</option>
                    <option value="external_report">External report</option>
                  </select>
                  {sizeErrs.source_type && <span className="mt-1 block font-normal text-[#A33A3A]">{sizeErrs.source_type}</span>}
                </label>
                <label className="block text-xs font-semibold">
                  Confidence
                  <select
                    value={sizeValues.confidence}
                    onChange={e => setSizeValues(v => ({ ...v, confidence: e.target.value }))}
                    className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-2 text-xs font-normal"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </label>
              </div>

              <label className="block text-xs font-semibold">
                Source note
                <input
                  type="text"
                  maxLength={500}
                  value={sizeValues.source_note}
                  onChange={e => setSizeValues(v => ({ ...v, source_note: e.target.value }))}
                  placeholder="Report name, date, or method"
                  className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs font-normal"
                />
                {sizeErrs.source_note && <span className="mt-1 block font-normal text-[#A33A3A]">{sizeErrs.source_note}</span>}
              </label>

              <label className="block text-xs font-semibold">
                Assumptions
                <textarea
                  rows={3}
                  maxLength={2000}
                  value={sizeValues.assumptions}
                  onChange={e => setSizeValues(v => ({ ...v, assumptions: e.target.value }))}
                  placeholder="Population × price × adoption, and what you excluded"
                  className="mt-1 w-full rounded-lg border border-[#E5E1D8] p-3 text-xs font-normal"
                />
                {sizeErrs.assumptions && <span className="mt-1 block font-normal text-[#A33A3A]">{sizeErrs.assumptions}</span>}
              </label>
            </div>

            <button
              type="button"
              disabled={sizeBusy}
              onClick={submitSize}
              className="mt-5 min-h-10 w-full rounded-lg bg-ink text-sm font-semibold text-white disabled:opacity-60"
            >
              {sizeBusy ? 'Saving…' : 'Save market size'}
            </button>
          </section>
        </div>
      )}

      {/* Step 5l: add / edit a competitor. */}
      {compForm && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[#0F1B2D]/45 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="competitor-title" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <button type="button" onClick={() => setCompForm(null)} className="float-right" aria-label="Close">
              <X size={18} />
            </button>
            <h2 id="competitor-title" className="serif text-2xl font-semibold">
              {compForm.id ? 'Edit competitor' : 'Add competitor'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#4A5568]">
              Your own notes on a company you compete with. The platform never scrapes private data.
            </p>

            {compFormErr && (
              <div role="alert" className="mt-4 rounded-lg border border-[#F0C9C9] bg-[#FDECEC] p-3 text-xs text-[#A33A3A]">
                {compFormErr}
              </div>
            )}

            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-semibold">
                  Company
                  <input
                    type="text"
                    maxLength={120}
                    value={compForm.name}
                    onChange={e => setCompForm(v => ({ ...v, name: e.target.value }))}
                    className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs font-normal"
                  />
                  {compErrs.name && <span className="mt-1 block font-normal text-[#A33A3A]">{compErrs.name}</span>}
                </label>
                <label className="block text-xs font-semibold">
                  Type
                  <select
                    value={compForm.type}
                    onChange={e => setCompForm(v => ({ ...v, type: e.target.value }))}
                    className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-2 text-xs font-normal"
                  >
                    <option value="direct">Direct</option>
                    <option value="indirect">Indirect</option>
                    <option value="substitute">Substitute</option>
                  </select>
                  {compErrs.type && <span className="mt-1 block font-normal text-[#A33A3A]">{compErrs.type}</span>}
                </label>
              </div>

              <label className="block text-xs font-semibold">
                Website
                <input
                  type="url"
                  maxLength={500}
                  value={compForm.website}
                  onChange={e => setCompForm(v => ({ ...v, website: e.target.value }))}
                  placeholder="https://example.com"
                  className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs font-normal"
                />
                {compErrs.website && <span className="mt-1 block font-normal text-[#A33A3A]">{compErrs.website}</span>}
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-semibold">
                  Target customer
                  <input
                    type="text"
                    maxLength={200}
                    value={compForm.target_customer}
                    onChange={e => setCompForm(v => ({ ...v, target_customer: e.target.value }))}
                    placeholder="e.g. SMBs"
                    className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs font-normal"
                  />
                  {compErrs.target_customer && <span className="mt-1 block font-normal text-[#A33A3A]">{compErrs.target_customer}</span>}
                </label>
                <label className="block text-xs font-semibold">
                  Pricing
                  <input
                    type="text"
                    maxLength={200}
                    value={compForm.pricing_note}
                    onChange={e => setCompForm(v => ({ ...v, pricing_note: e.target.value }))}
                    placeholder="e.g. ₹₹"
                    className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs font-normal"
                  />
                  {compErrs.pricing_note && <span className="mt-1 block font-normal text-[#A33A3A]">{compErrs.pricing_note}</span>}
                </label>
              </div>

              <label className="block text-xs font-semibold">
                Positioning
                <input
                  type="text"
                  maxLength={500}
                  value={compForm.positioning}
                  onChange={e => setCompForm(v => ({ ...v, positioning: e.target.value }))}
                  className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs font-normal"
                />
                {compErrs.positioning && <span className="mt-1 block font-normal text-[#A33A3A]">{compErrs.positioning}</span>}
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-semibold">
                  Strengths
                  <textarea
                    rows={3}
                    maxLength={1000}
                    value={compForm.strengths}
                    onChange={e => setCompForm(v => ({ ...v, strengths: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-[#E5E1D8] p-3 text-xs font-normal"
                  />
                  {compErrs.strengths && <span className="mt-1 block font-normal text-[#A33A3A]">{compErrs.strengths}</span>}
                </label>
                <label className="block text-xs font-semibold">
                  Weaknesses
                  <textarea
                    rows={3}
                    maxLength={1000}
                    value={compForm.weaknesses}
                    onChange={e => setCompForm(v => ({ ...v, weaknesses: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-[#E5E1D8] p-3 text-xs font-normal"
                  />
                  {compErrs.weaknesses && <span className="mt-1 block font-normal text-[#A33A3A]">{compErrs.weaknesses}</span>}
                </label>
              </div>

              <label className="block text-xs font-semibold">
                Last reviewed
                <input
                  type="date"
                  value={compForm.last_reviewed_on}
                  onChange={e => setCompForm(v => ({ ...v, last_reviewed_on: e.target.value }))}
                  className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs font-normal"
                />
                {compErrs.last_reviewed_on && <span className="mt-1 block font-normal text-[#A33A3A]">{compErrs.last_reviewed_on}</span>}
              </label>
            </div>

            <div className="mt-5 flex gap-2">
              {compForm.id && (
                <button
                  type="button"
                  onClick={() => { const target = competitors.find(c => c.id === compForm.id); if (target) { setCompForm(null); deleteCompetitor(target); } }}
                  className="min-h-10 rounded-lg border border-[#F0C9C9] px-3 text-xs font-semibold text-[#A33A3A]"
                >
                  Remove
                </button>
              )}
              <button
                type="button"
                disabled={compBusy}
                onClick={submitCompetitor}
                className="ml-auto min-h-10 flex-1 rounded-lg bg-ink text-sm font-semibold text-white disabled:opacity-60"
              >
                {compBusy ? 'Saving…' : compForm.id ? 'Save competitor' : 'Add competitor'}
              </button>
            </div>
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
