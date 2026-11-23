'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import StartupDataRoom from '@/components/data-room/startup';
import { StartupSidebar, Btn, Card, SubNavTabs } from '../../../components';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api/client';
import {
  LoadingBlock,
  EmptyBlock,
  ErrorBlock,
  FieldError,
  fieldErrorsFrom,
} from '@/components/async-state';
import {
  Search,
  Bell,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  ArrowUpRight,
  Plus,
  CalendarDays,
  Clock,
  CheckCircle2,
  AlertCircle,
  MessageCircle,
  FileText,
  ShieldCheck,
  Star,
  LockKeyhole,
  Upload,
  Send,
  X,
  Bookmark,
  Globe,
  MapPin,
  Wallet,
  Download,
  RefreshCw,
  Check,
  MoreHorizontal,
  Mail,
  Building2,
  Target,
  Eye,
  Trash2,
  Share2,
  Folder,
  ExternalLink,
  Video,
  Filter,
  BarChart3,
  Menu,
  BookOpen,
  Edit2
} from 'lucide-react';

const investors = [
  {
    id: 'northstar',
    name: 'Northstar Capital',
    firm: 'Northstar Ventures',
    type: 'Early-stage fund',
    verified: 'KYC verified',
    focus: ['Pre-seed', 'Seed', 'Fintech', 'B2B SaaS'],
    ticket: '₹50L – ₹2 Cr',
    location: 'Mumbai, India',
    rating: 'Viewed your profile 2 days ago',
    fit: 'Invests in pre-seed fintech and SaaS teams.',
    initial: 'N',
    status: 'Shortlisted',
    stage: 'Interested',
    owner: 'Aarav Kapoor',
    note: 'Interested in early customer traction.',
  },
  {
    id: 'mira',
    name: 'Mira Shah',
    firm: 'Angel investor',
    type: 'Angel',
    verified: 'Identity verified',
    focus: ['Pre-seed', 'Fintech', 'SaaS'],
    ticket: '₹10L – ₹50L',
    location: 'Bengaluru, India',
    rating: 'Shortlisted yesterday',
    fit: 'Active in fintech with relevant operator experience.',
    initial: 'M',
    status: 'Intro requested',
    stage: 'Intro / Talking',
    owner: 'Priya Menon',
    note: 'Intro sent, awaiting reply.',
  },
  {
    id: 'seed-spring',
    name: 'SeedSpring Fund',
    firm: 'SeedSpring Capital',
    type: 'Fund',
    verified: 'KYC verified',
    focus: ['Seed', 'Fintech', 'B2B'],
    ticket: '₹1 Cr – ₹5 Cr',
    location: 'Delhi, India',
    rating: 'Viewed your profile 4 days ago',
    fit: 'Strong sector match; typically leads seed rounds.',
    initial: 'S',
    status: 'In talks',
    stage: 'Meeting held',
    owner: 'Aarav Kapoor',
    note: 'Meeting scheduled next week.',
  },
  {
    id: 'river',
    name: 'Riverbend Angels',
    firm: 'Angel group',
    type: 'Angel group',
    verified: 'KYC verified',
    focus: ['Pre-seed', 'SaaS', 'Climate'],
    ticket: '₹25L – ₹1 Cr',
    location: 'Remote, India',
    rating: 'Active this week',
    fit: 'Matches stage and ticket size.',
    initial: 'R',
    status: 'Viewed',
    stage: 'Interested',
    owner: 'Priya Menon',
    note: 'No recent outreach.',
  },
];

// Step 9m: the 5a profile_visibility values and their display labels.
// The settings radio offers three of the API's four levels; the UI keeps
// its current radio set (no redesign).
const VISIBILITY_LABELS = {
  private: 'Private',
  mentors: 'Mentors only',
  mentors_and_investors: 'Mentors and verified investors',
  public: 'Public',
};
const VISIBILITY_VALUES = {
  'Private': 'private',
  'Mentors only': 'mentors',
  'Mentors and verified investors': 'mentors_and_investors',
  'Public': 'public',
};

function investorVisibilityEnabled(profileVisibility) {
  return profileVisibility === 'public' || profileVisibility === 'mentors_and_investors';
}

// Step 9m: display labels for hub rows (engagement request kinds and
// meeting types) and a compact meeting date/time renderer.
const KIND_LABELS = {
  intro: 'Intro request',
  meeting: 'Meeting invitation',
  information: 'Information request',
};
const MEETING_TYPE_LABELS = {
  intro_call: 'Intro call',
  pitch: 'Pitch',
  diligence: 'Diligence',
  follow_up: 'Follow-up',
};

function formatMeetingWhen(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) + ' · ' +
    d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

// Step 9m: share of the profile's key fields that are filled, derived
// from the real 5a profile — never an invented number.
function profileCompleteness(profile) {
  const fields = [
    profile.tagline,
    profile.sector,
    profile.business_model,
    profile.problem,
    profile.solution,
    profile.market,
    profile.traction_summary,
    profile.pitch_deck_url,
    profile.demo_url,
  ];
  const filled = fields.filter((f) => typeof f === 'string' && f.trim() !== '').length;
  return Math.round((filled / fields.length) * 100);
}

// Step 9e: the backend PipelineStage enum values, in board order, with
// display labels. The deal rows carry the raw stage value.
const PIPELINE_STAGE_ORDER = ['interested', 'intro', 'meeting', 'data_room', 'diligence', 'offer', 'committed'];
const PIPELINE_STAGE_LABELS = {
  interested: 'Interested',
  intro: 'Intro / Talking',
  meeting: 'Meeting held',
  data_room: 'Data room',
  diligence: 'Diligence',
  offer: 'Offer',
  committed: 'Committed',
};

// Step 9a: render the API's decimal-string money as ₹ Cr/L (matching the
// demo's Indian numbering). Purely presentational — the value is the real
// server figure, never an invented number.
function formatMoney(value, currency = 'INR') {
  if (value === null || value === undefined || value === '') return '—';
  const num = Number(value);
  if (Number.isNaN(num)) return '—';
  const sym = currency === 'INR' ? '₹' : currency + ' ';
  if (num >= 1e7) return sym + (num / 1e7).toFixed(2).replace(/\.?0+$/, '') + ' Cr';
  if (num >= 1e5) return sym + (num / 1e5).toFixed(2).replace(/\.?0+$/, '') + ' L';
  return sym + num.toLocaleString('en-IN');
}

function progressNum(value) {
  if (value === null || value === undefined || value === '') return 0;
  const n = Number(value);
  return Number.isNaN(n) ? 0 : n;
}

// Step 9b: render the investor's typical ticket range as ₹ L/Cr.
function formatTicketRange(min, max, currency = 'INR') {
  const sym = currency === 'INR' ? '₹' : currency + ' ';
  const lo = min == null ? null : formatMoney(min, currency);
  const hi = max == null ? null : formatMoney(max, currency);
  if (lo && hi) return `${lo} – ${hi}`;
  if (lo) return lo;
  if (hi) return hi;
  return 'Not shared';
}

// Step 9m: relative time for hub activity rows ("2h ago"). Purely
// presentational — the timestamp is the server's own value.
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

function StatusBadge({ status }) {
  const s = String(status || '').toLowerCase();
  if (s === 'open') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Open
      </span>
    );
  }
  if (s === 'draft') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#ECD9BA] bg-[#FAF4E8] px-2.5 py-0.5 text-xs font-semibold text-[#806236]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#B8955A]" /> Draft
      </span>
    );
  }
  if (s === 'paused') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Paused
      </span>
    );
  }
  if (s === 'closed') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 bg-stone-100 px-2.5 py-0.5 text-xs font-semibold text-stone-700">
        <span className="h-1.5 w-1.5 rounded-full bg-stone-500" /> Closed
      </span>
    );
  }
  if (s === 'cancelled') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Cancelled
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-stone-200 bg-stone-50 px-2.5 py-0.5 text-xs font-medium text-[#4A5568]">
      {status}
    </span>
  );
}

export default function InvestorApp({ page = 'hub', id = 'northstar' }) {
  const [toast, setToast] = useState('');
  const [visible, setVisible] = useState(false);
  const [showAnyway, setShowAnyway] = useState(false);
  const [tab, setTab] = useState('Overview');
  const [view, setView] = useState('Board');
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
  const [saved, setSaved] = useState([]);
  const [modal, setModal] = useState('');
  const [investorStatus, setInvestorStatus] = useState(investors.map(x => x.stage));

  const searchParams = useSearchParams();
  const [meetingTab, setMeetingTab] = useState(() => {
    const q = searchParams?.get('tab');
    if (!q) return 'Upcoming';
    const match = ['Upcoming', 'Requests', 'Past', 'Calendar'].find(
      (t) => t.toLowerCase() === q.toLowerCase()
    );
    return match || 'Upcoming';
  });
  const [roundTab, setRoundTab] = useState(() => {
    const q = searchParams?.get('tab');
    if (!q) return 'Overview';
    if (q.toLowerCase() === 'offers' || q.toLowerCase() === 'offers and commitments') {
      return 'Offers and commitments';
    }
    const match = ['Overview', 'Offers and commitments', 'Term sheets', 'Cap table impact', 'Documents', 'Activity'].find(
      (t) => t.toLowerCase() === q.toLowerCase()
    );
    return match || 'Overview';
  });
  const [messagesTab, setMessagesTab] = useState('Investors');

  const [vis, setVis] = useState('Mentors and verified investors');
  const [toggles, setToggles] = useState({ summary: true, traction: true, team: true, funding: false, round: false, readiness: true });
  const [mobileNav, setMobileNav] = useState(false);
  const [compact, setCompact] = useState(false);

  // Step 9m: startup investor hub (page="hub"). Summary + the interested
  // investors card (real 9e deal rows) + the readiness board for the
  // prepare/readiness cards. Gated to page="hub"; every other page in
  // this shared component keeps its demo data.
  const [hubSummary, setHubSummary] = useState(null); // InvestorHubSummary
  const [hubPhase, setHubPhase] = useState('loading'); // loading|ready|error|none
  const [hubError, setHubError] = useState('');
  const [hubDeals, setHubDeals] = useState([]); // StartupInvestorDealRead[]
  const [hubDealsPhase, setHubDealsPhase] = useState('loading'); // loading|ready|error|none
  const [hubDealsError, setHubDealsError] = useState('');
  const [hubReloadKey, setHubReloadKey] = useState(0);
  const [hubReadiness, setHubReadiness] = useState(null); // ReadinessBoard

  // Step 9m: visibility settings (page="settings") — the 5a startup
  // profile is the single source of truth for the visibility radio, the
  // section toggles and the pause control.
  const [profile, setProfile] = useState(null); // StartupProfileRead
  const [profilePhase, setProfilePhase] = useState('loading'); // loading|ready|error
  const [profileError, setProfileError] = useState('');
  const [profileReloadKey, setProfileReloadKey] = useState(0);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileFormErrors, setProfileFormErrors] = useState({});
  const [canEditVisibility, setCanEditVisibility] = useState(false); // owner/admin/member

  // Step 9a: real rounds data (only loaded for the rounds/round-detail pages).
  const { user } = useAuth();
  const [org, setOrg] = useState(null); // the startup org (Startup org row)
  const [canEditRounds, setCanEditRounds] = useState(false); // owner/admin/member
  const [rounds, setRounds] = useState([]); // FundingRoundRead[]
  const [roundsPhase, setRoundsPhase] = useState('loading'); // loading|ready|error|none
  const [round, setRound] = useState(null); // the round being viewed (detail)
  const [roundPhase, setRoundPhase] = useState('loading'); // loading|ready|error|none
  const [roundLoadError, setRoundLoadError] = useState('');
  // New-round modal form + server validation errors.
  const [roundForm, setRoundForm] = useState({
    name: '',
    round_type: 'pre_seed',
    target_amount: '',
    min_raise: '',
    instrument: 'equity',
    min_ticket: '',
    closes_on: '',
  });
  const [roundFormErrors, setRoundFormErrors] = useState({});
  const [savingRound, setSavingRound] = useState(false);

  // Round guide + Edit round + Round status transitions
  const [guideTab, setGuideTab] = useState('overview'); // overview|terms|dataroom|closing
  const [statusChanging, setStatusChanging] = useState(false);
  const [editRoundForm, setEditRoundForm] = useState({
    name: '',
    round_type: 'pre_seed',
    target_amount: '',
    min_raise: '',
    instrument: 'equity',
    min_ticket: '',
    closes_on: '',
  });
  const [editRoundErrors, setEditRoundErrors] = useState({});
  const [savingEditRound, setSavingEditRound] = useState(false);

  // Step 9i: round offers (startup view on round-detail).
  const [roundOffers, setRoundOffers] = useState([]);
  const [roundOffersPhase, setRoundOffersPhase] = useState('loading'); // loading|ready|error|none
  const [roundOffersError, setRoundOffersError] = useState('');
  const [selectedOfferModal, setSelectedOfferModal] = useState(null); // { offer, action: 'accept' | 'decline' }
  const [offerActionSubmitting, setOfferActionSubmitting] = useState(false);

  // Step 9b: investor directory (startup view). Only loaded for the
  // discover and investor-detail pages; every other page keeps its demo data.
  const [directoryPhase, setDirectoryPhase] = useState('loading'); // loading|ready|error|none
  const [directoryItems, setDirectoryItems] = useState([]); // InvestorDirectoryItem[]
  const [directorySummary, setDirectorySummary] = useState(null);
  const [directoryFacets, setDirectoryFacets] = useState(null);
  const [directoryError, setDirectoryError] = useState('');
  const [directoryQuery, setDirectoryQuery] = useState('');
  const [detailInvestor, setDetailInvestor] = useState(null); // InvestorDirectoryDetail
  const [detailPhase, setDetailPhase] = useState('loading'); // loading|ready|error
  const [detailError, setDetailError] = useState('');

  // Step 9e: startup-side investor deal pipeline. Only for page="pipeline".
  const [startupDeals, setStartupDeals] = useState([]); // StartupInvestorDealRead[]
  const [startupDealsPhase, setStartupDealsPhase] = useState('loading'); // loading|ready|error|none
  const [startupDealsError, setStartupDealsError] = useState('');

  // Step 9f: startup-side investor meetings. Only for page="meetings".
  const [meetings, setMeetings] = useState([]); // MeetingRead[]
  const [meetingsPhase, setMeetingsPhase] = useState('loading'); // loading|ready|error|none
  const [meetingsError, setMeetingsError] = useState('');
  const [meetingBusyId, setMeetingBusyId] = useState('');

  // Step 9f: startup-side investor engagement requests (intro/meeting/information).
  const [startupRequests, setStartupRequests] = useState([]); // EngagementRequestStartupRead[]
  const [requestsSubTab, setRequestsSubTab] = useState('Pending'); // 'Pending' | 'Accepted' | 'Declined & expired' | 'Proposed meetings'
  const [selectedRequest, setSelectedRequest] = useState(null); // EngagementRequestStartupRead | null
  const [responseAction, setResponseAction] = useState('accept'); // 'accept' | 'decline'
  const [responseNote, setResponseNote] = useState('');
  const [declineReason, setDeclineReason] = useState('Not actively raising at this time');
  const [respondingBusy, setRespondingBusy] = useState(false);
  const [respondError, setRespondError] = useState('');

  const cancelledRef = useRef(false);
  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  useEffect(() => {
    if (!modal) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setModal('');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal]);

  useEffect(() => {
    const q = searchParams?.get('tab');
    if (!q) return;
    const match = ['Upcoming', 'Requests', 'Past', 'Calendar'].find(
      (t) => t.toLowerCase() === q.toLowerCase()
    );
    if (match) setMeetingTab(match);
    if (q.toLowerCase() === 'offers' || q.toLowerCase() === 'offers and commitments') {
      setRoundTab('Offers and commitments');
    } else {
      const roundMatch = ['Overview', 'Offers and commitments', 'Term sheets', 'Cap table impact', 'Documents', 'Activity'].find(
        (t) => t.toLowerCase() === q.toLowerCase()
      );
      if (roundMatch) setRoundTab(roundMatch);
    }
  }, [searchParams]);

  useEffect(() => {
    const reqId = searchParams?.get('requestId');
    if (!reqId || startupRequests.length === 0) return;
    const target = startupRequests.find((r) => r.id === reqId);
    if (target) {
      setSelectedRequest(target);
      setResponseAction('accept');
      setResponseNote(target.response_note || '');
      setRespondError('');
    }
  }, [searchParams, startupRequests]);

  const notify = (s) => {
    setToast(s);
    setTimeout(() => setToast(''), 2800);
  };

  const loadRounds = async (orgId) => {
    setRoundsPhase('loading');
    try {
      const result = await api.fundingRounds.list(orgId, { sort: 'created_at' });
      if (cancelledRef.current) return;
      setRounds(result.items);
      setRoundsPhase('ready');
    } catch {
      if (cancelledRef.current) return;
      setRoundsPhase('error');
    }
  };

  const loadRound = async (orgId, roundId) => {
    setRoundPhase('loading');
    setRoundLoadError('');
    try {
      const result = await api.fundingRounds.get(orgId, roundId);
      if (cancelledRef.current) return;
      setRound(result);
      setRoundPhase('ready');
    } catch (err) {
      if (cancelledRef.current) return;
      setRoundPhase('error');
      setRoundLoadError(err instanceof ApiError ? err.message : 'Could not load this round.');
    }
  };

  const loadRoundOffers = async (orgId, roundId) => {
    setRoundOffersPhase('loading');
    setRoundOffersError('');
    try {
      const result = await api.offers.listForStartup(orgId);
      if (cancelledRef.current) return;
      const relevant = (result.items || []).filter((o) => !roundId || o.round_id === roundId);
      setRoundOffers(relevant);
      setRoundOffersPhase('ready');
    } catch (err) {
      if (cancelledRef.current) return;
      setRoundOffersPhase('error');
      setRoundOffersError(err instanceof ApiError ? err.message : 'Could not load offers for this round.');
    }
  };

  const handleConfirmOfferAction = async () => {
    if (!org || !selectedOfferModal || offerActionSubmitting) return;
    const { offer, action } = selectedOfferModal;
    setOfferActionSubmitting(true);
    try {
      if (action === 'accept') {
        await api.offers.accept(org.id, offer.id);
        notify('Offer accepted.');
      } else {
        await api.offers.decline(org.id, offer.id);
        notify('Offer declined.');
      }
      setSelectedOfferModal(null);
      await Promise.all([loadRound(org.id, id), loadRoundOffers(org.id, id)]);
    } catch (err) {
      notify(err instanceof ApiError ? err.message : `Failed to ${action} offer.`);
    } finally {
      if (!cancelledRef.current) setOfferActionSubmitting(false);
    }
  };

  // Resolve the startup org and load this page's rounds. Gated to the two
  // Step 9a pages; every other page in this shared component keeps its demo data.
  useEffect(() => {
    if (page !== 'rounds' && page !== 'round-detail') return undefined;
    let cancelled = false;
    (async () => {
      try {
        const orgs = await api.organizations.mine();
        const startup = orgs.find((o) => o.type === 'startup') || null;
        if (cancelled) return;
        if (!startup) {
          setOrg(null);
          setRoundsPhase('none');
          setRoundPhase('none');
          setRoundOffersPhase('none');
          return;
        }
        setOrg(startup);
        setCanEditRounds(['owner', 'admin', 'member'].includes(startup.my_role));
        if (page === 'rounds') {
          await loadRounds(startup.id);
        } else {
          await Promise.all([loadRound(startup.id, id), loadRoundOffers(startup.id, id)]);
        }
      } catch {
        if (!cancelled) {
          setRoundsPhase('error');
          setRoundPhase('error');
          setRoundOffersPhase('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, id, user?.id]);

  // Step 9b (discover / investor detail) and Step 9e (pipeline): resolve
  // the startup org and load this page's real data. Gated to those three
  // pages; every other page in this shared component keeps its demo data.
  useEffect(() => {
    if (page !== 'discover' && page !== 'investor' && page !== 'pipeline') {
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const orgs = await api.organizations.mine();
        const startup = orgs.find((o) => o.type === 'startup') || null;
        if (cancelled) return;
        if (!startup) {
          setOrg(null);
          setDirectoryPhase('none');
          setDetailPhase('none');
          setStartupDealsPhase('none');
          return;
        }
        setOrg(startup);
        setCanEditVisibility(['owner', 'admin', 'member'].includes(startup.my_role));
        if (page === 'discover' || page === 'investor') {
          await loadProfile(startup.id);
        }
        if (page === 'discover') {
          await loadDirectory(startup.id, directoryQuery);
        } else if (page === 'investor') {
          await loadInvestorDetail(startup.id, id);
        } else if (page === 'pipeline') {
          await loadStartupDeals(startup.id);
        }
      } catch (err) {
        if (cancelled) return;
        setDirectoryPhase('error');
        setDetailPhase('error');
        setStartupDealsPhase('error');
        setDirectoryError(err instanceof ApiError ? err.message : 'Could not load this page.');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, id, user?.id]);

  // Step 9f: resolve the startup org and load its investor meetings.
  // Gated to page="meetings"; every other page in this shared component
  // keeps its demo data.
  useEffect(() => {
    if (page !== 'meetings') return undefined;
    let cancelled = false;
    (async () => {
      try {
        const orgs = await api.organizations.mine();
        const startup = orgs.find((o) => o.type === 'startup') || null;
        if (cancelled) return;
        if (!startup) {
          setOrg(null);
          setMeetingsPhase('none');
          return;
        }
        setOrg(startup);
        await loadMeetings(startup.id);
      } catch (err) {
        if (cancelled) return;
        setMeetingsPhase('error');
        setMeetingsError(err instanceof ApiError ? err.message : 'Could not load your meetings.');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, user?.id]);

  // Step 9m: the startup profile drives the hub banner, the prepare
  // card and the settings form. Gated to page="hub"/"settings"; every
  // other page in this shared component keeps its demo data.
  useEffect(() => {
    if (page !== 'hub' && page !== 'settings') return undefined;
    let cancelled = false;
    (async () => {
      try {
        const orgs = await api.organizations.mine();
        const startup = orgs.find((o) => o.type === 'startup') || null;
        if (cancelled) return;
        if (!startup) {
          setOrg(null);
          setProfilePhase('error');
          setProfileError('No startup organization found for your account.');
          return;
        }
        setOrg(startup);
        setCanEditRounds(['owner', 'admin', 'member'].includes(startup.my_role));
        setCanEditVisibility(['owner', 'admin', 'member'].includes(startup.my_role));
        await loadProfile(startup.id);
      } catch (err) {
        if (cancelled) return;
        setProfilePhase('error');
        setProfileError(err instanceof ApiError ? err.message : 'Could not load your visibility settings.');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, user?.id, profileReloadKey]);

  // Step 9m: the hub page's data (summary + interested investors +
  // readiness). Gated to page="hub".
  useEffect(() => {
    if (page !== 'hub') return undefined;
    let cancelled = false;
    (async () => {
      try {
        const orgs = await api.organizations.mine();
        const startup = orgs.find((o) => o.type === 'startup') || null;
        if (cancelled) return;
        if (!startup) {
          setOrg(null);
          setHubPhase('none');
          setHubDealsPhase('none');
          return;
        }
        setOrg(startup);
        setCanEditRounds(['owner', 'admin', 'member'].includes(startup.my_role));
        await loadHub(startup.id);
      } catch (err) {
        if (cancelled) return;
        setHubPhase('error');
        setHubError(err instanceof ApiError ? err.message : 'Could not load your investor hub.');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, user?.id, hubReloadKey]);

  const loadDirectory = async (orgId, q) => {
    setDirectoryPhase('loading');
    setDirectoryError('');
    try {
      const [page, summary, facets] = await Promise.all([
        api.investorDirectory.list(orgId, { q: q || undefined, limit: 50 }),
        api.investorDirectory.summary(orgId),
        api.investorDirectory.filters(orgId),
      ]);
      if (cancelledRef.current) return;
      setDirectoryItems(page.items);
      setDirectorySummary(summary);
      setDirectoryFacets(facets);
      setDirectoryPhase('ready');
    } catch (err) {
      if (cancelledRef.current) return;
      setDirectoryPhase('error');
      setDirectoryError(err instanceof ApiError ? err.message : 'Could not load investors.');
    }
  };

  const loadInvestorDetail = async (orgId, investorId) => {
    setDetailPhase('loading');
    setDetailError('');
    setDetailInvestor(null);
    try {
      const detail = await api.investorDirectory.get(orgId, investorId);
      if (cancelledRef.current) return;
      setDetailInvestor(detail);
      setDetailPhase('ready');
    } catch (err) {
      if (cancelledRef.current) return;
      setDetailPhase('error');
      setDetailError(err instanceof ApiError ? err.message : 'Could not load this investor.');
    }
  };

  const loadStartupDeals = async (orgId) => {
    setStartupDealsPhase('loading');
    setStartupDealsError('');
    try {
      const result = await api.startupInvestorDeals.list(orgId, { limit: 100 });
      if (cancelledRef.current) return;
      setStartupDeals(result.items);
      setStartupDealsPhase('ready');
    } catch (err) {
      if (cancelledRef.current) return;
      setStartupDealsPhase('error');
      setStartupDealsError(err instanceof ApiError ? err.message : 'Could not load your investor pipeline.');
    }
  };

  // Step 9f: load this startup's investor meetings and inbound requests.
  const loadMeetings = async (orgId) => {
    setMeetingsPhase('loading');
    setMeetingsError('');
    try {
      const [meetingsResult, requestsResult] = await Promise.all([
        api.engagement.listStartupMeetings(orgId, { limit: 100 }),
        api.engagement.listStartupRequests(orgId, { limit: 100 }),
      ]);
      if (cancelledRef.current) return;
      setMeetings(meetingsResult.items || []);
      setStartupRequests(requestsResult.items || []);
      setMeetingsPhase('ready');
    } catch (err) {
      if (cancelledRef.current) return;
      setMeetingsPhase('error');
      setMeetingsError(err instanceof ApiError ? err.message : 'Could not load your meetings and requests.');
    }
  };

  const handleRespondRequest = async (e) => {
    e?.preventDefault?.();
    if (!org || !selectedRequest || respondingBusy) return;
    setRespondingBusy(true);
    setRespondError('');
    try {
      await api.engagement.respondStartupRequest(org.id, selectedRequest.id, {
        decision: responseAction,
        response_note: responseNote.trim() || null,
        decline_reason: responseAction === 'decline' ? (declineReason.trim() || null) : null,
      });
      notify(responseAction === 'accept' ? 'Request accepted.' : 'Request declined.');
      setSelectedRequest(null);
      setResponseNote('');
      await loadMeetings(org.id);
    } catch (err) {
      setRespondError(err instanceof ApiError ? err.message : (err?.message || 'Could not update request.'));
    } finally {
      setRespondingBusy(false);
    }
  };

  // Step 9m: load the 5a startup profile (visibility radio + section
  // toggles + the hub's visibility banner). Read by any active member.
  const loadProfile = async (orgId) => {
    setProfilePhase('loading');
    setProfileError('');
    try {
      const prof = await api.startupProfile.get(orgId);
      if (cancelledRef.current) return;
      setProfile(prof);
      // Drive the shared banner/pause controls from the server's values.
      setVisible(investorVisibilityEnabled(prof.profile_visibility));
      setVis(VISIBILITY_LABELS[prof.profile_visibility] || prof.profile_visibility);
      setToggles({
        summary: prof.summary_public,
        traction: prof.traction_public,
        team: prof.team_public,
        funding: prof.funding_public,
        round: prof.round_public,
        readiness: prof.readiness_public,
      });
      setProfilePhase('ready');
    } catch (err) {
      if (cancelledRef.current) return;
      setProfilePhase('error');
      setProfileError(err instanceof ApiError ? err.message : 'Could not load your visibility settings.');
    }
  };

  // Step 9m: startup investor hub. Loads the hub summary (stat strip,
  // primary round, needs-reply, upcoming meetings), the interested
  // investors card (real 9e deal rows) and the readiness board (prepare
  // + readiness cards). Gated to page="hub".
  const loadHub = async (orgId) => {
    setHubPhase('loading');
    setHubError('');
    try {
      const summary = await api.investorHub.summary(orgId);
      if (cancelledRef.current) return;
      setHubSummary(summary);
      setHubPhase('ready');
    } catch (err) {
      if (cancelledRef.current) return;
      setHubPhase('error');
      setHubError(err instanceof ApiError ? err.message : 'Could not load your investor hub.');
    }
    try {
      const deals = await api.startupInvestorDeals.list(orgId, { limit: 3 });
      if (cancelledRef.current) return;
      setHubDeals(deals.items);
      setHubDealsPhase('ready');
    } catch (err) {
      if (cancelledRef.current) return;
      setHubDealsPhase('error');
      setHubDealsError(err instanceof ApiError ? err.message : 'Could not load interested investors.');
    }
    try {
      const board = await api.readiness.board(orgId);
      if (cancelledRef.current) return;
      setHubReadiness(board);
    } catch {
      if (cancelledRef.current) return;
      setHubReadiness(null);
    }
  };

  // Step 9m: persist visibility changes. Only owner/admin/member may
  // patch (viewer -> 403); server 422s surface as field errors.
  const saveVisibility = async (body, { silent = false } = {}) => {
    if (!org) return;
    setSavingProfile(true);
    setProfileFormErrors({});
    try {
      const updated = await api.startupProfile.update(org.id, body);
      if (cancelledRef.current) return;
      setProfile(updated);
      setVisible(investorVisibilityEnabled(updated.profile_visibility));
      setVis(VISIBILITY_LABELS[updated.profile_visibility] || updated.profile_visibility);
      if (!silent) notify('Investor visibility settings saved.');
      return true;
    } catch (err) {
      if (cancelledRef.current) return false;
      if (err instanceof ApiError && err.status === 422) {
        setProfileFormErrors(fieldErrorsFrom(err));
      } else if (err instanceof ApiError && err.status === 403) {
        notify('You need an owner, admin or member role to change visibility.');
      } else {
        notify(err instanceof ApiError ? err.message : 'Could not save your visibility settings.');
      }
      return false;
    } finally {
      if (!cancelledRef.current) setSavingProfile(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!org || savingProfile) return;
    await saveVisibility({
      profile_visibility: VISIBILITY_VALUES[vis] || vis,
      summary_public: toggles.summary,
      traction_public: toggles.traction,
      team_public: toggles.team,
      funding_public: toggles.funding,
      round_public: toggles.round,
      readiness_public: toggles.readiness,
    });
  };

  const handlePauseVisibility = async () => {
    if (!org || savingProfile) return;
    const next = visible ? 'private' : 'mentors_and_investors';
    setVisible(next === 'mentors_and_investors');
    setVis(VISIBILITY_LABELS[next]);
    const ok = await saveVisibility({ profile_visibility: next }, { silent: true });
    if (!ok) {
      setVisible(visible);
      setVis(VISIBILITY_LABELS[profile?.profile_visibility] || 'Mentors and verified investors');
      notify(profileFormErrors.profile_visibility ? profileFormErrors.profile_visibility : 'Could not change visibility.');
    } else {
      notify(visible ? 'Investor visibility paused.' : 'Investor visibility resumed.');
    }
  };

  const handlePreviewAsInvestor = async () => {
    if (!org) return;
    try {
      const preview = await api.startupProfile.preview(org.id);
      notify(preview.visible_to_public ? 'Investor preview: your profile is visible to the public.' : 'Investor preview: your profile is not visible to the public.');
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not open the investor preview.');
    }
  };

  const handleCreateRound = async () => {
    setSavingRound(true);
    setRoundFormErrors({});
    try {
      await api.fundingRounds.create(org.id, {
        name: roundForm.name.trim(),
        round_type: roundForm.round_type,
        target_amount: roundForm.target_amount || null,
        min_raise: roundForm.min_raise || null,
        instrument: roundForm.instrument || null,
        min_ticket: roundForm.min_ticket || null,
        closes_on: roundForm.closes_on || null,
      });
      setModal('');
      notify('Round created.');
      if (org) await loadRounds(org.id);
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setRoundFormErrors(fieldErrorsFrom(err));
      } else {
        notify(err instanceof ApiError ? err.message : 'Could not create the round.');
      }
    } finally {
      setSavingRound(false);
    }
  };

  const openEditRoundModal = () => {
    if (!round) return;
    setEditRoundForm({
      name: round.name || '',
      round_type: round.round_type || 'pre_seed',
      target_amount: round.target_amount ?? '',
      min_raise: round.min_raise ?? '',
      instrument: round.instrument || 'equity',
      min_ticket: round.min_ticket ?? '',
      closes_on: round.closes_on || '',
    });
    setEditRoundErrors({});
    setModal('edit-round');
  };

  const handleUpdateRound = async () => {
    if (!org || !round || savingEditRound) return;
    setSavingEditRound(true);
    setEditRoundErrors({});
    try {
      const updated = await api.fundingRounds.update(org.id, round.id, {
        name: editRoundForm.name.trim(),
        round_type: editRoundForm.round_type,
        target_amount: editRoundForm.target_amount ? editRoundForm.target_amount : null,
        min_raise: editRoundForm.min_raise ? editRoundForm.min_raise : null,
        instrument: editRoundForm.instrument || null,
        min_ticket: editRoundForm.min_ticket ? editRoundForm.min_ticket : null,
        closes_on: editRoundForm.closes_on ? editRoundForm.closes_on : null,
      });
      setRound(updated);
      setRounds((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setModal('');
      notify('Round details updated.');
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setEditRoundErrors(fieldErrorsFrom(err));
      } else {
        notify(err instanceof ApiError ? err.message : 'Could not update the round.');
      }
    } finally {
      setSavingEditRound(false);
    }
  };

  const handleUpdateRoundStatus = async (nextStatus) => {
    if (!org || !round || statusChanging) return;
    setStatusChanging(true);
    try {
      const updated = await api.fundingRounds.changeStatus(org.id, round.id, nextStatus);
      setRound(updated);
      setRounds((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      const msgs = {
        open: round.status === 'draft' ? 'Round opened for commitments.' : 'Round reopened.',
        paused: 'Round paused.',
        closed: 'Round closed.',
        cancelled: 'Round cancelled.',
      };
      notify(msgs[nextStatus] || `Round status changed to ${nextStatus}.`);
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not change the round status.');
    } finally {
      setStatusChanging(false);
    }
  };

  const handleToggleRoundStatus = async () => {
    if (!round) return;
    const next = round.status === 'closed' ? 'open' : 'closed';
    await handleUpdateRoundStatus(next);
  };

  // Dynamic ID resolution supporting test IDs and semantic IDs
  const resolvedId = id === 'inv-1' ? 'northstar' : id === 'inv-2' ? 'mira' : id === 'inv-3' ? 'seed-spring' : id === 'inv-4' ? 'river' : id;
  const inv = investors.find(x => x.id === resolvedId || x.id === id) || investors[0];

  const title = {
    hub: 'Investors',
    discover: 'Find investors',
    investor: inv.name,
    pipeline: 'Investor pipeline',
    'data-room': 'Data room',
    access: 'Access requests',
    messages: 'Messages',
    meetings: 'Meetings',
    rounds: 'Fundraising rounds',
    'round-detail': 'Pre-seed round',
    settings: 'Investor visibility',
  }[page] || 'Investors';

  const sub = {
    hub: 'See who is interested and keep your fundraising conversations moving.',
    discover: 'Find verified investors who fit your stage, sector and raise.',
    investor: `${inv.firm} · ${inv.type}`,
    pipeline: 'Track investor conversations from first interest to commitment.',
    'data-room': 'Share diligence documents with control and a clear audit trail.',
    access: 'Review requests to view confidential startup documents.',
    messages: 'Secure conversations with investors and your startup team.',
    meetings: 'Prepare for conversations and keep clear next steps.',
    rounds: 'Plan your raise and track offers through to close.',
    'round-detail': 'Track commitments, documents and closing progress.',
    settings: 'Control who can discover your startup and what they can see.',
  }[page] || '';

  // The round-detail title/sub follow the loaded round, not a hardcoded name.
  const pageTitle = page === 'round-detail' && round ? round.name : title;
  const pageSub =
    page === 'round-detail' && round
      ? round.round_type + ' · ' + (round.instrument || 'No instrument set') + ' · closes ' + (round.closes_on || '—')
      : sub;

  const head = (actions) => (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-sm text-[#4A5568]">{isDataRoom ? 'Startup workspace' : 'Acme Studio'} <span className="mx-2 text-[#B8955A]">·</span> Investors</p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="serif mt-1 text-[30px] font-semibold">{pageTitle}</h1>
          {page === 'round-detail' && round && <StatusBadge status={round.status} />}
        </div>
        <p className="mt-1 text-sm text-[#4A5568]">{pageSub}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    </div>
  );

  const disclaimer = (
    <p className="mt-5 flex items-start gap-2 text-[10px] leading-4 text-[#4A5568]">
      <AlertCircle size={13} className="mt-0.5 shrink-0" />
      The platform introduces startups and investors. It is not a broker or adviser unless licensed. Get your own legal and financial advice.
    </p>
  );

  const visBanner = (
    <div className="mb-5 flex flex-wrap items-center gap-2 rounded-lg border border-[#E5E1D8] bg-white p-3 text-xs">
      {profilePhase === 'loading' ? (
        <>
          <span className="h-2 w-2 rounded-full bg-[#A0A7B4]" />
          Loading visibility status…
        </>
      ) : profilePhase === 'error' ? (
        <>
          <span className="h-2 w-2 rounded-full bg-[#B42318]" />
          Couldn’t verify visibility.
          <Link href="/startup/investors/settings" className="ml-auto font-semibold text-[#9A7A45]">
            Manage visibility <ArrowRight className="inline" size={12} />
          </Link>
        </>
      ) : (
        <>
          <span className={`h-2 w-2 rounded-full ${visible ? 'bg-[#B8955A]' : 'bg-[#A0A7B4]'}`} />
          {visible ? 'Visible to verified investors' : 'Your profile is private. Investors can’t find you.'}
          <Link href="/startup/investors/settings" className="ml-auto font-semibold text-[#9A7A45]">
            {visible ? 'Manage' : 'Change visibility'} <ArrowRight className="inline" size={12} />
          </Link>
        </>
      )}
    </div>
  );

  const readinessLocked = !showAnyway;

  // Step 9b: render a real directory item. Only org-level public fields
  // are shown — never the firm's members, emails or pipeline state.
  const directoryCard = (x) => (
    <article key={x.id} className="rounded-xl border border-[#E5E1D8] bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#F3EBDD] font-serif text-lg font-semibold text-[#806236]">
          {x.logo_initials || (x.name || '?').charAt(0).toUpperCase()}
        </span>
        <div className="min-w-[180px] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/startup/investors/${x.id}`} className="font-semibold hover:underline">
              {x.name}
            </Link>
            {x.verified && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#F3EBDD] px-2 py-1 text-[10px] font-semibold text-[#806236]">
                <ShieldCheck size={12} />KYC verified
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-[#4A5568]">
            {x.investor_type ? x.investor_type.replace('_', ' ') : 'Investor'}
            {x.city ? ` · ${x.city}` : ''}
          </p>
          <p className="mt-1 text-xs">
            <b>Typical ticket:</b> {formatTicketRange(x.min_ticket, x.max_ticket, x.currency || 'INR')}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {x.sectors.map(s => (
          <span key={s} className="rounded-full bg-[#F3F4F6] px-2 py-1 text-[10px]">{s}</span>
        ))}
        {x.stage_focus.map(s => (
          <span key={s} className="rounded-full bg-[#F3F4F6] px-2 py-1 text-[10px]">{s}</span>
        ))}
      </div>
      {x.summary && <p className="mt-3 text-xs leading-5 text-[#4A5568]">{x.summary}</p>}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E1D8] pt-3">
        <small className="text-[10px] text-[#4A5568]">{x.website || 'Profile listed'}</small>
        <div className="flex gap-2">
          <Link href={`/startup/investors/${x.id}`} className="inline-flex min-h-9 items-center rounded-lg border border-[#E5E1D8] px-3 text-xs font-semibold">
            View profile
          </Link>
        </div>
      </div>
    </article>
  );

  const isDataRoom = page === 'data-room' || page === 'access';

  return (
    <div className="min-h-screen bg-[#FAF8F4] text-[#0F1B2D]">
      <a href="#investor-main" className="sr-only focus:not-sr-only">Skip to content</a>

      {/* Shared Startup Sidebar */}
      <StartupSidebar
        active={isDataRoom ? 'Documents' : 'Investors'}
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
            disabled={isDataRoom}
            title={isDataRoom ? 'Notifications are not loaded in this view' : undefined}
            onClick={() => notify('You’re all caught up.')}
            aria-label="Notifications"
            className="relative grid h-10 w-10 place-items-center"
          >
            <Bell size={19} />
            {!isDataRoom && <i className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#B8955A]" />}
          </button>
          <span className="flex items-center gap-2 text-xs">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-ink font-semibold text-white">{isDataRoom ? (user?.display_name?.slice(0, 2).toUpperCase() || '—') : 'AK'}</span>
            <span className="hidden sm:block">{isDataRoom ? user?.display_name : 'Aarav Kapoor'}</span>
            <ChevronDown size={14} />
          </span>
        </div>
      </header>

      <main id="investor-main" className={`mx-auto max-w-[1440px] px-4 pb-16 pt-7 transition-[margin] duration-200 sm:px-7 lg:px-8 ${compact ? 'lg:ml-[76px]' : 'lg:ml-[240px]'}`}>
        {/* Secondary section navigation */}
        <SubNavTabs
          items={
            isDataRoom
              ? [
                  ['Documents & data room', '/startup/data-room', page === 'data-room'],
                  ['Access requests', '/startup/data-room/requests', page === 'access'],
                ]
              : [
                  ['Hub', '/startup/investors', page === 'hub'],
                  ['Find investors', '/startup/investors/discover', page === 'discover'],
                  ['Pipeline', '/startup/investors/pipeline', page === 'pipeline'],
                  ['Meetings', '/startup/meetings', page === 'meetings'],
                  ['Rounds', '/startup/rounds', page === 'rounds' || page === 'round-detail'],
                  ['Visibility settings', '/startup/investors/settings', page === 'settings'],
                ]
          }
        />
        {page === 'hub' && (
          <>
            {head(
              <Link href="/startup/investors/discover" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-ink px-4 text-sm font-semibold text-white">
                <Search size={15} /> Find investors
              </Link>
            )}
            {visBanner}
            {hubPhase === 'loading' && <LoadingBlock label="Loading your investor hub…" rows={4} />}
            {hubPhase === 'error' && (
              <ErrorBlock
                title="Could not load your investor hub"
                message={hubError || 'Something went wrong while loading the hub.'}
                onRetry={() => setHubReloadKey((k) => k + 1)}
              />
            )}
            {hubPhase === 'none' && (
              <EmptyBlock title="No investor hub yet" hint="Your startup organization has no investor hub data yet.">
                <Link href="/startup/rounds" className="rounded-lg bg-ink px-4 py-2 text-xs font-semibold text-white">Go to rounds</Link>
              </EmptyBlock>
            )}
            {hubPhase === 'ready' && hubSummary && !showAnyway && (
              <Card title="Prepare for investor conversations">
                <p className="mb-4 text-sm text-[#4A5568]">Finish the essentials before you start reaching out. You can preview the hub while you prepare.</p>
                <div className="space-y-3">
                  {[
                    [
                      'Earn the Investment Ready badge',
                      hubReadiness
                        ? `${hubReadiness.summary.criteria_signed_off} of ${hubReadiness.summary.criteria_total} items signed off`
                        : 'Checking readiness…',
                      '/startup/readiness',
                    ],
                    [
                      'Complete your public profile',
                      profile ? `${profileCompleteness(profile)}% complete` : 'Checking profile…',
                      '/startup/profile',
                    ],
                    [
                      'Choose investor visibility',
                      visible ? 'Visible to verified investors' : 'Private',
                      '/startup/investors/settings',
                    ],
                  ].map(([x, y, u], i) => (
                    <Link key={x} href={u} className="flex items-center gap-3 rounded-lg border border-[#E5E1D8] p-3 hover:bg-[#FAF8F4]">
                      <span className={`grid h-7 w-7 place-items-center rounded-full ${i < 2 ? 'bg-[#E7F3EC] text-[#286749]' : 'bg-[#F3F4F6] text-[#4A5568]'}`}>
                        {i < 2 ? <Check size={15} /> : i + 1}
                      </span>
                      <span className="flex-1">
                        <b className="block text-xs">{x}</b>
                        <small className="text-[10px] text-[#4A5568]">{y}</small>
                      </span>
                      <ArrowRight size={14} />
                    </Link>
                  ))}
                </div>
                <div className="mt-4 flex gap-2">
                  <Link href="/startup/readiness" className="rounded-lg bg-ink px-4 py-2.5 text-xs font-semibold text-white">
                    Continue preparing
                  </Link>
                  <button type="button" onClick={() => setShowAnyway(true)} className="rounded-lg border border-[#E5E1D8] bg-white px-4 py-2.5 text-xs font-semibold">
                    Show me anyway
                  </button>
                </div>
              </Card>
            )}
            {hubPhase === 'ready' && hubSummary && showAnyway && (
              <>
                <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                  {[
                    ['Open rounds', hubSummary.open_rounds, '/startup/rounds'],
                    ['Deals in pipeline', hubSummary.deals_in_pipeline, '/startup/investors/pipeline'],
                    ['Pending requests', hubSummary.pending_requests, '/startup/meetings?tab=requests'],
                    ['Meetings this month', hubSummary.meetings_this_month, '/startup/meetings'],
                    [
                      'Offers received',
                      hubSummary.offers_received,
                      hubSummary.primary_round
                        ? `/startup/rounds/${hubSummary.primary_round.id}?tab=offers`
                        : '/startup/rounds',
                    ],
                    [
                      'Commitments received',
                      hubSummary.commitments_received,
                      hubSummary.primary_round
                        ? `/startup/rounds/${hubSummary.primary_round.id}?tab=offers`
                        : '/startup/rounds',
                    ],
                  ].map(([n, v, href]) => (
                    <Link
                      key={n}
                      href={href}
                      className="block rounded-xl border border-[#E5E1D8] bg-white p-4 transition hover:border-[#9A7A45] hover:shadow-xs"
                    >
                      <p className="text-xs text-[#4A5568]">{n}</p>
                      <b className="serif mt-1 block text-2xl">{v}</b>
                    </Link>
                  ))}
                </div>
                <div className="grid items-start gap-5 xl:grid-cols-3">
                  <div className="space-y-5 xl:col-span-2">
                    <Card
                      title="Needs your reply"
                      action={
                        <Link href="/startup/meetings?tab=requests" className="text-xs font-semibold text-[#9A7A45] hover:underline">
                          View all requests
                        </Link>
                      }
                    >
                      {hubSummary.needs_reply.length === 0 ? (
                        <p className="text-xs text-[#4A5568]">Nothing is waiting on you right now.</p>
                      ) : (
                        <div className="space-y-2">
                          {hubSummary.needs_reply.map((item) => (
                            <div key={item.id} className="flex items-center gap-3 rounded-lg border border-[#E5E1D8] p-3 hover:border-[#D1CBBE] transition-colors">
                              <Mail className="text-[#9A7A45]" size={17} />
                              <span className="flex-1">
                                <b className="block text-xs text-ink">{item.investor_name}</b>
                                <small className="text-[10px] text-[#4A5568]">
                                  {KIND_LABELS[item.kind] || item.kind} · {timeAgo(item.created_at)}
                                </small>
                              </span>
                              <Link
                                href={`/startup/meetings?tab=requests&requestId=${item.id}`}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-[#9A7A45] hover:text-ink transition-colors"
                              >
                                Open <ArrowRight className="inline" size={12} />
                              </Link>
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>

                    <Card title="Interested investors" action={<Link href="/startup/investors/pipeline" className="text-xs font-semibold text-[#9A7A45]">View pipeline</Link>}>
                      {hubDealsPhase === 'loading' && <LoadingBlock label="Loading interested investors…" rows={2} />}
                      {hubDealsPhase === 'error' && (
                        <ErrorBlock
                          title="Could not load interested investors"
                          message={hubDealsError || 'Something went wrong while loading the pipeline preview.'}
                          onRetry={() => setHubReloadKey((k) => k + 1)}
                        />
                      )}
                      {hubDealsPhase === 'ready' && hubDeals.length === 0 && (
                        <EmptyBlock title="No interested investors yet" hint="Investors who engage with your startup appear here.">
                          <Link href="/startup/investors/pipeline" className="rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs font-semibold">Open pipeline</Link>
                        </EmptyBlock>
                      )}
                      {hubDealsPhase === 'ready' && hubDeals.length > 0 && (
                        <div className="space-y-3">
                          {hubDeals.map((deal) => (
                            <article key={deal.id} className="rounded-xl border border-[#E5E1D8] bg-white p-4">
                              <div className="flex flex-wrap items-start gap-3">
                                <span className="grid h-12 w-12 place-items-center rounded-xl bg-[#F3EBDD] font-serif text-lg font-semibold text-[#806236]">
                                  {(deal.investor_name || '?').charAt(0).toUpperCase()}
                                </span>
                                <div className="min-w-[180px] flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Link href={`/startup/investors/${deal.investor_org_id}`} className="font-semibold hover:underline">
                                      {deal.investor_name}
                                    </Link>
                                    <span className="rounded-full bg-[#F3F4F6] px-2 py-1 text-[10px] text-[#4A5568]">
                                      {PIPELINE_STAGE_LABELS[deal.stage] || deal.stage}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-xs">
                                    <b>Ticket:</b> {formatMoney(deal.ticket_size, deal.currency)}
                                  </p>
                                  {deal.next_step && <p className="mt-1 text-xs text-[#4A5568]">Next: {deal.next_step}</p>}
                                </div>
                              </div>
                            </article>
                          ))}
                        </div>
                      )}
                    </Card>
                  </div>

                  <aside className="space-y-5">
                    <Card title="Round snapshot">
                      {hubSummary.primary_round ? (
                        <>
                          <div className="flex justify-between text-xs">
                            <span>{hubSummary.primary_round.name} target</span>
                            <b>{formatMoney(hubSummary.primary_round.target_amount, hubSummary.primary_round.currency)}</b>
                          </div>
                          <div className="mt-2 h-2 rounded-full bg-[#E5E1D8]">
                            <div
                              className="h-full rounded-full bg-[#B8955A]"
                              style={{ width: `${Math.min(100, Math.max(0, hubSummary.primary_round.progress_pct || 0))}%` }}
                            />
                          </div>
                          <p className="mt-2 text-xs text-[#4A5568]">
                            {formatMoney(hubSummary.primary_round.committed_amount, hubSummary.primary_round.currency)} committed · {hubSummary.primary_round.progress_pct ?? 0}%
                          </p>
                          <p className="mt-2 text-xs">
                            {hubSummary.primary_round.commitment_count} commitment{hubSummary.primary_round.commitment_count === 1 ? '' : 's'} · closes {hubSummary.primary_round.closes_on || '—'}
                          </p>
                          <Link href="/startup/rounds" className="mt-3 inline-block text-xs font-semibold text-[#9A7A45]">
                            View round <ArrowRight className="inline" size={12} />
                          </Link>
                        </>
                      ) : (
                        <EmptyBlock title="No open round" hint="Open a fundraising round to show progress here.">
                          <Link href="/startup/rounds" className="rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs font-semibold">Go to rounds</Link>
                        </EmptyBlock>
                      )}
                    </Card>

                    <Card title="Upcoming meetings">
                      {hubSummary.upcoming_meetings.length === 0 ? (
                        <p className="text-xs text-[#4A5568]">No upcoming meetings.</p>
                      ) : (
                        <div className="space-y-3">
                          {hubSummary.upcoming_meetings.map((meeting) => (
                            <div key={meeting.id}>
                              <p className="text-xs">
                                <b>{meeting.investor_name}</b>
                                <small className="mt-1 block text-[#4A5568]">
                                  {formatMeetingWhen(meeting.scheduled_at)} · {MEETING_TYPE_LABELS[meeting.meeting_type] || meeting.meeting_type}
                                </small>
                              </p>
                              <div className="mt-3 flex gap-2">
                                <Link href="/startup/meetings" className="rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs font-semibold">
                                  Prepare
                                </Link>
                                <Link href="/startup/meetings" className="rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white">
                                  Join
                                </Link>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>

                    <Card title="Readiness">
                      <span className="rounded-full bg-[#FFF3D6] px-2 py-1 text-[10px] font-semibold text-[#8A5700]">
                        {hubReadiness
                          ? `Preparing · ${hubReadiness.summary.criteria_signed_off} of ${hubReadiness.summary.criteria_total}`
                          : 'Checking readiness…'}
                      </span>
                      <Link href="/startup/readiness" className="mt-3 inline-block text-xs font-semibold text-[#9A7A45]">
                        Review readiness <ArrowRight className="inline" size={12} />
                      </Link>
                    </Card>
                  </aside>
                </div>
                {disclaimer}
              </>
            )}
          </>
        )}

        {page === 'discover' && (
          <>
            {head(
              <Link href="/startup/investors/settings" className="rounded-lg border border-[#E5E1D8] bg-white px-3 py-2 text-xs font-semibold">
                Visibility settings
              </Link>
            )}
            {visBanner}
            <div className="mb-5 rounded-lg border border-[#E7D4B0] bg-[#FFF8E8] p-3 text-xs text-[#806236]">
              {readinessLocked
                ? 'Browse investors in preparation mode. Intro requests unlock after you complete readiness or choose “Show me anyway” on the hub.'
                : 'Intro requests are limited to 5 per day. Investors decide whether to accept; no data room access is shared automatically.'}
            </div>
            <div className="grid items-start gap-5 lg:grid-cols-4">
              <aside className="rounded-xl border border-[#E5E1D8] bg-white p-5">
                <h2 className="font-semibold">Investor filters</h2>
                {directoryFacets ? (
                  <div className="mt-4 space-y-4">
                    {directoryFacets.sectors.length > 0 && (
                      <fieldset>
                        <legend className="text-xs font-semibold">Sector</legend>
                        {directoryFacets.sectors.map(o => (
                          <label key={o} className="mt-2 flex gap-2 text-xs text-[#4A5568]">
                            <input type="checkbox" className="accent-ink" disabled />{o}
                          </label>
                        ))}
                      </fieldset>
                    )}
                    {directoryFacets.stage_focus.length > 0 && (
                      <fieldset>
                        <legend className="text-xs font-semibold">Stage focus</legend>
                        {directoryFacets.stage_focus.map(o => (
                          <label key={o} className="mt-2 flex gap-2 text-xs text-[#4A5568]">
                            <input type="checkbox" className="accent-ink" disabled />{o}
                          </label>
                        ))}
                      </fieldset>
                    )}
                    {directoryFacets.types.length > 0 && (
                      <fieldset>
                        <legend className="text-xs font-semibold">Type</legend>
                        {directoryFacets.types.map(o => (
                          <label key={o} className="mt-2 flex gap-2 text-xs text-[#4A5568]">
                            <input type="checkbox" className="accent-ink" disabled />{o.replace('_', ' ')}
                          </label>
                        ))}
                      </fieldset>
                    )}
                  </div>
                ) : (
                  <p className="mt-4 text-[10px] text-[#4A5568]">Loading filters…</p>
                )}
                <p className="mt-4 text-[10px] text-[#4A5568]">No filters on personal protected characteristics.</p>
              </aside>

              <div className="space-y-3 lg:col-span-3">
                <div className="relative">
                  <Search className="absolute left-3 top-3 text-[#A0A7B4]" size={16} />
                  <input
                    value={directoryQuery}
                    onChange={e => {
                      setDirectoryQuery(e.target.value);
                      if (org) loadDirectory(org.id, e.target.value);
                    }}
                    placeholder="Search verified investors"
                    className="h-11 w-full rounded-lg border border-[#E5E1D8] bg-white pl-9 text-sm"
                  />
                </div>
                {directorySummary && (
                  <p className="text-xs text-[#4A5568]">
                    {directorySummary.total} investor{directorySummary.total === 1 ? '' : 's'} listed · {directorySummary.verified} KYC verified
                  </p>
                )}
                {directoryPhase === 'loading' && <LoadingBlock label="Loading investors…" rows={3} />}
                {directoryPhase === 'error' && (
                  <ErrorBlock
                    message={directoryError || 'Could not load investors.'}
                    onRetry={() => org && loadDirectory(org.id, directoryQuery)}
                  />
                )}
                {directoryPhase === 'none' && (
                  <EmptyBlock
                    title="No startup workspace yet"
                    hint="Create or join a startup to browse the investor directory."
                  />
                )}
                {directoryPhase === 'ready' && directoryItems.length === 0 && (
                  <EmptyBlock
                    title="No investors match that search"
                    hint="Try a different name, sector or stage, or clear the search to see all listed investors."
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setDirectoryQuery('');
                        if (org) loadDirectory(org.id, '');
                      }}
                      className="rounded-lg bg-ink px-4 py-2 text-xs font-semibold text-white"
                    >
                      Clear search
                    </button>
                  </EmptyBlock>
                )}
                {directoryPhase === 'ready' && directoryItems.map(directoryCard)}
              </div>
            </div>
            {disclaimer}
          </>
        )}

        {page === 'investor' && (
          <>
            {head(
              <Link href="/startup/investors" className="text-sm text-[#9A7A45]">
                ← Investor hub
              </Link>
            )}
            {visBanner}
            {detailPhase === 'loading' && <LoadingBlock label="Loading investor…" rows={3} />}
            {detailPhase === 'error' && (
              <ErrorBlock
                message={detailError || 'Could not load this investor.'}
                onRetry={() => org && loadInvestorDetail(org.id, id)}
              />
            )}
            {detailPhase === 'none' && (
              <EmptyBlock title="No startup workspace yet" hint="Create or join a startup to view an investor profile." />
            )}
            {detailPhase === 'ready' && detailInvestor && (
              <div className="grid items-start gap-5 xl:grid-cols-3">
                <div className="space-y-5 xl:col-span-2">
                  <Card title="Investor profile">
                    <div className="flex items-start gap-4">
                      <span className="grid h-16 w-16 place-items-center rounded-xl bg-[#F3EBDD] font-serif text-2xl">
                        {detailInvestor.logo_initials || (detailInvestor.name || '?').charAt(0).toUpperCase()}
                      </span>
                      <div>
                        <h2 className="text-lg font-semibold">{detailInvestor.name}</h2>
                        <p className="text-sm text-[#4A5568]">
                          {detailInvestor.investor_type ? detailInvestor.investor_type.replace('_', ' ') : 'Investor'}
                          {detailInvestor.city ? ` · ${detailInvestor.city}` : ''}
                        </p>
                        <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#F3EBDD] px-2 py-1 text-[10px] font-semibold text-[#806236]">
                          <ShieldCheck size={12} />{detailInvestor.verified ? 'KYC verified' : 'Not verified'}
                        </span>
                        <p className="mt-2 text-xs text-[#4A5568]">
                          Typical ticket {formatTicketRange(detailInvestor.min_ticket, detailInvestor.max_ticket, 'INR')}
                          {detailInvestor.founded_year ? ` · Founded ${detailInvestor.founded_year}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {detailInvestor.sectors.map(f => (
                        <span key={f} className="rounded-full bg-[#F3F4F6] px-2.5 py-1 text-[10px]">{f}</span>
                      ))}
                      {detailInvestor.stage_focus.map(f => (
                        <span key={f} className="rounded-full bg-[#F3F4F6] px-2.5 py-1 text-[10px]">{f}</span>
                      ))}
                    </div>
                    {detailInvestor.summary && (
                      <p className="mt-5 text-sm leading-6 text-[#4A5568]">{detailInvestor.summary}</p>
                    )}
                    {detailInvestor.website && (
                      <p className="mt-3 text-xs text-[#4A5568]">
                        {detailInvestor.website}
                      </p>
                    )}
                  </Card>

                  <Card title="Portfolio and track record">
                    <EmptyBlock
                      title="Portfolio details arrive later"
                      hint="Track record and portfolio holdings are recorded with the commitments step (a later step)."
                    />
                  </Card>

                  <Card title="Activity on your startup">
                    <EmptyBlock
                      title="Activity arrives later"
                      hint="Investor activity on your startup is shown with the activity step (a later step)."
                    />
                  </Card>

                  <Card title="Conversation">
                    <EmptyBlock
                      title="Conversations arrive later"
                      hint="Secure messaging and introductions are handled with the requests step (a later step)."
                    />
                  </Card>

                  <Card title="Private notes">
                    <EmptyBlock
                      title="Notes arrive later"
                      hint="Private team notes on an investor are recorded with a later step."
                    />
                  </Card>
                </div>

                <aside className="space-y-5 xl:sticky xl:top-24">
                  <Card title="Pipeline status">
                    <EmptyBlock
                      title="Pipeline status on the investor page"
                      hint="The deal stage with this investor appears on your investor pipeline (Step 9e)."
                    >
                      <Link href="/startup/investors/pipeline" className="rounded-lg bg-ink px-4 py-2 text-xs font-semibold text-white">
                        Open pipeline
                      </Link>
                    </EmptyBlock>
                  </Card>

                  <Card title="Access summary">
                    <p className="text-xs text-[#4A5568]">Investor can view your public profile only. No documents shared.</p>
                    <Link href="/startup/data-room" className="mt-3 inline-block text-xs font-semibold text-[#9A7A45]">
                      Manage access <ArrowRight className="inline" size={12} />
                    </Link>
                  </Card>

                  <button type="button" onClick={() => notify('Investor blocked from future contact.')} className="text-xs text-[#B42318]">
                    Block or report
                  </button>
                </aside>
              </div>
            )}
            {disclaimer}
          </>
        )}

        {page === 'pipeline' && (
          <>
            {head(
              <div className="flex gap-2">
                <button type="button" onClick={() => setView('Board')} className={`rounded-lg px-3 py-2 text-xs ${view === 'Board' ? 'bg-ink text-white' : 'border bg-white'}`}>
                  Board
                </button>
                <button type="button" onClick={() => setView('Table')} className={`rounded-lg px-3 py-2 text-xs ${view === 'Table' ? 'bg-ink text-white' : 'border bg-white'}`}>
                  Table
                </button>
                <button type="button" onClick={() => setView('Funnel')} className={`rounded-lg px-3 py-2 text-xs ${view === 'Funnel' ? 'bg-ink text-white' : 'border bg-white'}`}>
                  Funnel
                </button>
              </div>
            )}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search investors"
                className="h-10 min-w-[180px] flex-1 rounded-lg border border-[#E5E1D8] bg-white px-3 text-sm"
              />
              <select value={filter} onChange={e => setFilter(e.target.value)} className="h-10 rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs">
                <option>All</option>
                {PIPELINE_STAGE_ORDER.map(s => (
                  <option key={s} value={s}>{PIPELINE_STAGE_LABELS[s]}</option>
                ))}
              </select>
            </div>

            {startupDealsPhase === 'loading' && <LoadingBlock label="Loading your investor pipeline…" rows={3} />}
            {startupDealsPhase === 'error' && (
              <ErrorBlock
                message={startupDealsError || 'Could not load your investor pipeline.'}
                onRetry={() => org && loadStartupDeals(org.id)}
              />
            )}
            {startupDealsPhase === 'none' && (
              <EmptyBlock
                title="No startup workspace yet"
                hint="Create or join a startup to view your investor pipeline."
              />
            )}
            {startupDealsPhase === 'ready' && startupDeals.length === 0 && (
              <EmptyBlock
                title="No investors in your pipeline yet"
                hint="When investors open a deal with your startup, their stage appears here."
              />
            )}

            {startupDealsPhase === 'ready' && startupDeals.length > 0 && (
              <>
                {view === 'Board' ? (
                  <div className="grid gap-3 overflow-x-auto pb-3 md:grid-cols-2 2xl:grid-cols-7">
                    {PIPELINE_STAGE_ORDER.map(stageVal => {
                      const label = PIPELINE_STAGE_LABELS[stageVal];
                      const stageDeals = startupDeals.filter(
                        d => d.stage === stageVal &&
                          (filter === 'All' || filter === stageVal) &&
                          (!query || d.investor_name.toLowerCase().includes(query.toLowerCase()))
                      );
                      return (
                        <section key={stageVal} className="min-w-[205px] rounded-xl bg-[#F4F1EA] p-3">
                          <h2 className="mb-3 flex justify-between text-xs font-semibold">
                            {label}<span className="text-[#4A5568]">{stageDeals.length}</span>
                          </h2>
                          {stageDeals.map(d => (
                            <div key={d.id} className="mb-2 block rounded-lg border border-[#E5E1D8] bg-white p-3 hover:border-[#A0A7B4]">
                              <Link href={`/startup/investors/${d.investor_org_id}`} className="block text-xs font-semibold hover:underline">
                                {d.investor_name}
                              </Link>
                              <p className="mt-1 text-[10px] text-[#4A5568]">
                                {d.ticket_size != null ? formatMoney(d.ticket_size, d.currency) : 'Ticket not shared'}
                              </p>
                              {d.next_step && <p className="mt-2 text-[10px] text-[#4A5568]">{d.next_step}</p>}
                              {d.stage === 'offer' && (
                                <Link
                                  href={d.round_id ? `/startup/rounds/${d.round_id}?tab=offers` : '/startup/rounds'}
                                  className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-[#9A7A45] hover:underline"
                                >
                                  View offer <ArrowRight size={10} />
                                </Link>
                              )}
                            </div>
                          ))}
                        </section>
                      );
                    })}
                  </div>
                ) : view === 'Table' ? (
                  <Card title="Investor pipeline">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[700px] text-left text-xs">
                        <thead className="border-b text-[#4A5568]">
                          <tr>
                            {['Investor', 'Stage', 'Last activity', 'Ticket', 'Next step'].map(x => (
                              <th key={x} className="py-3">{x}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {startupDeals
                            .filter(d => filter === 'All' || d.stage === filter)
                            .filter(d => !query || d.investor_name.toLowerCase().includes(query.toLowerCase()))
                            .map(d => (
                              <tr key={d.id} className="border-b">
                                <td className="py-3">
                                  <Link href={`/startup/investors/${d.investor_org_id}`} className="font-semibold hover:underline">
                                    {d.investor_name}
                                  </Link>
                                </td>
                                <td>{PIPELINE_STAGE_LABELS[d.stage] || d.stage}</td>
                                <td>{d.last_activity_at ? new Date(d.last_activity_at).toLocaleDateString() : '—'}</td>
                                <td>{d.ticket_size != null ? formatMoney(d.ticket_size, d.currency) : '—'}</td>
                                <td>
                                  {d.stage === 'offer' ? (
                                    <Link
                                      href={d.round_id ? `/startup/rounds/${d.round_id}?tab=offers` : '/startup/rounds'}
                                      className="font-medium text-[#9A7A45] hover:underline"
                                    >
                                      View offer →
                                    </Link>
                                  ) : (
                                    d.next_step || '—'
                                  )}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                ) : (
                  <div className="grid gap-5 lg:grid-cols-2">
                    <Card title="Pipeline by stage">
                      <div className="space-y-3">
                        {PIPELINE_STAGE_ORDER.map(stageVal => {
                          const count = startupDeals.filter(d => d.stage === stageVal).length;
                          const max = Math.max(1, ...PIPELINE_STAGE_ORDER.map(s => startupDeals.filter(d => d.stage === s).length));
                          return (
                            <div key={stageVal} className="mb-3 flex items-center gap-3 text-xs">
                              <span className="w-28">{PIPELINE_STAGE_LABELS[stageVal]}</span>
                              <div className="h-3 flex-1 rounded bg-[#E5E1D8]">
                                <div className="h-full rounded bg-ink" style={{ width: `${(count / max) * 100}%` }} />
                              </div>
                              <b>{count}</b>
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                    <Card title="Commitments and raise">
                      <EmptyBlock
                        title="Commitments arrive later"
                        hint="Expected commitments, raise progress and portfolio holdings are recorded with the commitments step (a later step)."
                      />
                    </Card>
                  </div>
                )}
              </>
            )}
            {disclaimer}
          </>
        )}

        {page === 'data-room' && <>{head(null)}<StartupDataRoom /></>}
        {page === 'access' && <>{head(null)}<StartupDataRoom requests /></>}

        {page === 'messages' && (
          <>
            {head(null)}
            <div className="grid min-h-[620px] overflow-hidden rounded-xl border border-[#E5E1D8] bg-white md:grid-cols-[240px_1fr_250px]">
              <aside className="border-b border-[#E5E1D8] p-4 md:border-b-0 md:border-r">
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search conversations"
                  className="h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs"
                />
                <div className="mt-3 flex flex-wrap gap-1">
                  {['Investors', 'Mentors', 'Candidates', 'Unread'].map(x => (
                    <button
                      key={x}
                      type="button"
                      onClick={() => setMessagesTab(x)}
                      className={`rounded-full px-2 py-1 text-[10px] ${messagesTab === x ? 'bg-ink text-white' : 'bg-[#F3F4F6]'}`}
                    >
                      {x}
                    </button>
                  ))}
                </div>
                {investors.map(x => (
                  <button
                    key={x.id}
                    type="button"
                    onClick={() => setTab(x.id)}
                    className={`mt-3 flex w-full items-center gap-2 rounded-lg p-2 text-left ${tab === x.id ? 'bg-[#F3EBDD]' : ''}`}
                  >
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-[#F3EBDD] text-xs">{x.initial}</span>
                    <span>
                      <b className="block text-xs">{x.name}</b>
                      <small className="text-[10px] text-[#4A5568]">{x.status}</small>
                    </span>
                  </button>
                ))}
              </aside>

              <section className="flex min-h-[500px] flex-col">
                <div className="border-b border-[#E5E1D8] p-4">
                  <b className="text-sm">{investors.find(x => x.id === tab)?.name || 'Northstar Capital'}</b>
                  <small className="ml-2 text-xs text-[#4A5568]">{investors.find(x => x.id === tab)?.status}</small>
                </div>
                <div className="flex-1 space-y-4 bg-[#FAF8F4] p-5">
                  <p className="mx-auto max-w-xs rounded-lg bg-white p-3 text-xs">
                    Northstar Capital: Thanks for sharing the overview. Could you share your latest customer validation summary?
                  </p>
                  <p className="ml-auto max-w-xs rounded-lg bg-[#F3EBDD] p-3 text-xs">
                    Aarav: Absolutely. I’ll share the updated summary through the data room.
                  </p>
                  <p className="mx-auto text-center text-[10px] text-[#4A5568]">System · NDA signed · 2 hours ago</p>
                </div>
                <div className="border-t border-[#E5E1D8] p-3">
                  <div className="flex gap-2">
                    <input placeholder="Write a secure message…" className="h-11 flex-1 rounded-lg border border-[#E5E1D8] px-3 text-xs" />
                    <button type="button" onClick={() => notify('Secure message sent.')} className="grid h-11 w-11 place-items-center rounded-lg bg-ink text-white">
                      <Send size={15} />
                    </button>
                  </div>
                  <p className="mt-2 text-[10px] text-[#4A5568]">Messages are secure and logged for audit. No off-platform payment solicitations.</p>
                </div>
              </section>

              <aside className="hidden border-l border-[#E5E1D8] p-4 md:block">
                <b className="text-xs">Investor details</b>
                <p className="mt-3 text-xs">Northstar Capital</p>
                <p className="mt-1 text-[10px] text-[#4A5568]">Verified · Seed fund</p>
                <div className="mt-4 space-y-2">
                  <Link href="/startup/meetings" className="block text-center w-full rounded-lg border border-[#E5E1D8] py-2 text-xs font-semibold hover:bg-[#FAF8F4]">
                    Schedule meeting
                  </Link>
                  <Link href="/startup/data-room/requests" className="block text-center w-full rounded-lg border border-[#E5E1D8] py-2 text-xs font-semibold hover:bg-[#FAF8F4]">
                    Grant access
                  </Link>
                  <button type="button" onClick={() => notify('Investor marked as passed.')} className="w-full rounded-lg border border-[#E5E1D8] py-2 text-xs">
                    Mark as passed
                  </button>
                </div>
              </aside>
            </div>
            {disclaimer}
          </>
        )}

        {page === 'meetings' && (
          <>
            {head(
              <Btn onClick={() => notify('Scheduling is done from the investor side; meetings proposed to you appear here.')}><Plus size={15} /> Schedule meeting</Btn>
            )}
            {(() => {
              const pendingReqCount = startupRequests.filter((r) => r.status === 'pending').length;
              const proposedMeetCount = meetings.filter((m) => m.status === 'proposed').length;
              const totalPendingRequests = pendingReqCount + proposedMeetCount;
              return (
                <div className="mb-4 flex gap-2">
                  {['Upcoming', 'Requests', 'Past', 'Calendar'].map((x) => (
                    <button
                      key={x}
                      type="button"
                      onClick={() => setMeetingTab(x)}
                      className={`inline-flex min-h-10 items-center rounded-lg px-4 text-xs transition-colors ${
                        meetingTab === x ? 'bg-ink text-white font-semibold' : 'border border-[#E5E1D8] bg-white text-[#4A5568] hover:bg-[#FAF8F4]'
                      }`}
                    >
                      {x}
                      {x === 'Requests' && totalPendingRequests > 0 && (
                        <span
                          className={`ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                            meetingTab === 'Requests' ? 'bg-white text-ink' : 'bg-[#9A7A45] text-white'
                          }`}
                        >
                          {totalPendingRequests}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              );
            })()}

            {meetingsPhase === 'loading' && <LoadingBlock label="Loading your meetings and requests…" rows={2} />}
            {meetingsPhase === 'error' && (
              <ErrorBlock message={meetingsError || 'Could not load your meetings and requests.'} onRetry={() => org && loadMeetings(org.id)} />
            )}
            {meetingsPhase === 'none' && (
              <EmptyBlock
                title={user?.roles?.includes('investor') ? 'Investor Meetings' : 'No startup workspace yet'}
                hint={
                  user?.roles?.includes('investor')
                    ? 'You are logged in as an investor. Meetings with startups are managed from your investor dashboard.'
                    : 'Create or join a startup to see investor meetings.'
                }
              >
                {user?.roles?.includes('investor') && (
                  <Link
                    href="/investor/meetings"
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-ink px-4 text-xs font-semibold text-white hover:bg-black transition-colors"
                  >
                    <CalendarDays size={14} /> Go to Investor Meetings
                  </Link>
                )}
              </EmptyBlock>
            )}
            {meetingsPhase === 'ready' && (
              <>
                {meetingTab === 'Calendar' ? (
                  <Card title={`Meetings · ${new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}`}>
                    <div className="grid grid-cols-7 gap-px bg-[#E5E1D8]">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', ...Array.from({ length: 35 }, (_, i) => String(i + 1))].map((x, i) => {
                        const dayNum = i >= 7 ? Number(x) : null;
                        const key = dayNum
                          ? `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
                          : null;
                        const dayMeetings = key
                          ? meetings.filter((m) => new Date(m.scheduled_at).toISOString().slice(0, 10) === key)
                          : [];
                        return (
                          <div key={i} className={`min-h-16 bg-white p-2 text-xs ${i < 7 ? 'font-semibold text-[#4A5568]' : ''}`}>
                            {x}
                            {dayMeetings.length > 0 && (
                              <small className="mt-1 block rounded bg-[#F3EBDD] p-1 text-[9px]">{dayMeetings.length} meet</small>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {meetings.length === 0 && (
                      <p className="mt-3 text-xs text-[#4A5568]">No meetings scheduled this month.</p>
                    )}
                  </Card>
                ) : meetingTab === 'Requests' ? (
                  <Card
                    title="Inbound investor requests"
                    action={
                      <div className="flex flex-wrap items-center gap-1.5">
                        {[
                          ['Pending', startupRequests.filter((r) => r.status === 'pending').length],
                          ['Accepted', startupRequests.filter((r) => r.status === 'accepted').length],
                          ['Declined & expired', startupRequests.filter((r) => r.status === 'declined' || r.status === 'expired').length],
                          ['Proposed meetings', meetings.filter((m) => m.status === 'proposed').length],
                        ].map(([sub, count]) => (
                          <button
                            key={sub}
                            type="button"
                            onClick={() => setRequestsSubTab(sub)}
                            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                              requestsSubTab === sub
                                ? 'bg-ink text-white font-semibold'
                                : 'border border-[#E5E1D8] bg-white text-[#4A5568] hover:bg-[#FAF8F4]'
                            }`}
                          >
                            {sub} {count > 0 ? `(${count})` : ''}
                          </button>
                        ))}
                      </div>
                    }
                  >
                    {requestsSubTab === 'Proposed meetings' ? (
                      meetings.filter((m) => m.status === 'proposed').length === 0 ? (
                        <EmptyBlock
                          title="No proposed meetings"
                          hint="Proposed meeting slots from investors will appear here for you to accept or decline."
                        />
                      ) : (
                        <div className="space-y-3">
                          {meetings
                            .filter((m) => m.status === 'proposed')
                            .map((m) => (
                              <div
                                key={m.id}
                                className="flex flex-wrap items-center gap-3 rounded-lg border border-[#E5E1D8] p-4 bg-[#FAF8F4]"
                              >
                                <CalendarDays size={18} className="text-[#9A7A45]" />
                                <span className="flex-1">
                                  <b className="block text-sm">{m.investor_name || 'Investor'} · {m.meeting_type}</b>
                                  <small className="text-xs text-[#4A5568]">
                                    Proposed: {new Date(m.scheduled_at).toLocaleString()} · {m.duration_minutes} min
                                  </small>
                                </span>
                                <button
                                  type="button"
                                  disabled={meetingBusyId === m.id}
                                  onClick={async () => {
                                    setMeetingBusyId(m.id);
                                    try {
                                      await api.engagement.transitionStartupMeeting(org.id, m.id, 'confirmed');
                                      notify('Meeting time accepted.');
                                      await loadMeetings(org.id);
                                    } catch (err) {
                                      notify(err instanceof ApiError ? err.message : 'Could not accept this meeting.');
                                    } finally {
                                      setMeetingBusyId('');
                                    }
                                  }}
                                  className="rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white hover:bg-black"
                                >
                                  Accept time
                                </button>
                                <button
                                  type="button"
                                  disabled={meetingBusyId === m.id}
                                  onClick={async () => {
                                    setMeetingBusyId(m.id);
                                    try {
                                      await api.engagement.transitionStartupMeeting(org.id, m.id, 'cancelled');
                                      notify('Meeting time declined.');
                                      await loadMeetings(org.id);
                                    } catch (err) {
                                      notify(err instanceof ApiError ? err.message : 'Could not decline this meeting.');
                                    } finally {
                                      setMeetingBusyId('');
                                    }
                                  }}
                                  className="rounded-lg border border-[#E5E1D8] bg-white px-3 py-2 text-xs text-[#B42318] hover:bg-[#FEF3F2]"
                                >
                                  Decline
                                </button>
                              </div>
                            ))}
                        </div>
                      )
                    ) : (
                      (() => {
                        const filtered = startupRequests.filter((r) => {
                          if (requestsSubTab === 'Pending') return r.status === 'pending';
                          if (requestsSubTab === 'Accepted') return r.status === 'accepted';
                          return r.status === 'declined' || r.status === 'expired';
                        });

                        if (filtered.length === 0) {
                          return (
                            <EmptyBlock
                              title={
                                requestsSubTab === 'Pending'
                                  ? 'No pending investor requests'
                                  : requestsSubTab === 'Accepted'
                                  ? 'No accepted requests yet'
                                  : 'No declined or expired requests'
                              }
                              hint={
                                requestsSubTab === 'Pending'
                                  ? 'When investors discover your startup and submit introduction, meeting, or info requests, they will appear here.'
                                  : 'Requests you review and accept will be tracked here.'
                              }
                            />
                          );
                        }

                        return (
                          <div className="space-y-3">
                            {filtered.map((req) => {
                              const kindColors = {
                                intro: 'bg-[#FFF8E8] text-[#806236] border-[#E7D4B0]',
                                meeting: 'bg-[#EFF8FF] text-[#175CD3] border-[#B2DDFF]',
                                information: 'bg-[#F9F5FF] text-[#6941C6] border-[#E9D7FE]',
                              };
                              const statusBadges = {
                                pending: 'bg-[#FEF0C7] text-[#B54708] border-[#FEDF89]',
                                accepted: 'bg-[#ECFDF3] text-[#027A48] border-[#A6F4C5]',
                                declined: 'bg-[#FEF3F2] text-[#B42318] border-[#FECDCA]',
                                expired: 'bg-[#F2F4F7] text-[#475467] border-[#EAECF0]',
                              };
                              return (
                                <article
                                  key={req.id}
                                  className="rounded-xl border border-[#E5E1D8] bg-white p-4 shadow-sm hover:border-[#D1CBBE] transition-colors"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F4F1EA] pb-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-semibold text-sm text-ink">
                                        {req.investor_name}
                                      </span>
                                      <span
                                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${
                                          kindColors[req.kind] || 'bg-gray-100 text-gray-800'
                                        }`}
                                      >
                                        {req.kind === 'intro' ? 'Intro request' : req.kind}
                                      </span>
                                      <span
                                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${
                                          statusBadges[req.status] || 'bg-gray-100 text-gray-800'
                                        }`}
                                      >
                                        {req.status}
                                      </span>
                                    </div>
                                    <span className="text-[11px] text-[#5A6679]">
                                      Received: {new Date(req.created_at).toLocaleDateString()}
                                      {req.expires_on && req.status === 'pending' && (
                                        <span className="ml-2 text-[#B54708]">
                                          · Expires {new Date(req.expires_on).toLocaleDateString()}
                                        </span>
                                      )}
                                    </span>
                                  </div>

                                  <div className="pt-3 pb-2">
                                    <h4 className="text-sm font-semibold text-ink">{req.ask}</h4>
                                    {req.message && (
                                      <p className="mt-1.5 line-clamp-2 text-xs text-[#4A5568] bg-[#FAF8F4] rounded-lg p-2.5 border border-[#E5E1D8]/60">
                                        “{req.message}”
                                      </p>
                                    )}
                                    {req.response_note && (
                                      <p className="mt-2 text-xs text-[#027A48]">
                                        <span className="font-semibold">Your response:</span> “{req.response_note}”
                                      </p>
                                    )}
                                  </div>

                                  <div className="mt-2 flex flex-wrap items-center justify-end gap-2 border-t border-[#F4F1EA] pt-3">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedRequest(req);
                                        setResponseAction('accept');
                                        setResponseNote(req.response_note || '');
                                        setRespondError('');
                                      }}
                                      className="inline-flex min-h-8 items-center rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs font-semibold text-ink hover:bg-[#FAF8F4]"
                                    >
                                      <Eye size={13} className="mr-1.5" /> View request
                                    </button>

                                    {req.status === 'pending' && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSelectedRequest(req);
                                            setResponseAction('decline');
                                            setResponseNote('');
                                            setRespondError('');
                                          }}
                                          className="inline-flex min-h-8 items-center rounded-lg border border-[#FECDCA] bg-white px-3 text-xs font-semibold text-[#B42318] hover:bg-[#FEF3F2]"
                                        >
                                          <X size={13} className="mr-1.5" /> Decline
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSelectedRequest(req);
                                            setResponseAction('accept');
                                            setResponseNote('');
                                            setRespondError('');
                                          }}
                                          className="inline-flex min-h-8 items-center rounded-lg bg-ink px-3.5 text-xs font-semibold text-white hover:bg-black"
                                        >
                                          <Check size={13} className="mr-1.5" /> Accept
                                        </button>
                                      </>
                                    )}

                                    {req.status === 'accepted' && (
                                      <Link
                                        href="/startup/meetings"
                                        onClick={() => setMeetingTab('Calendar')}
                                        className="inline-flex min-h-8 items-center rounded-lg bg-[#027A48] px-3 text-xs font-semibold text-white hover:bg-[#02623a]"
                                      >
                                        <CalendarDays size={13} className="mr-1.5" /> Schedule meeting
                                      </Link>
                                    )}
                                  </div>
                                </article>
                              );
                            })}
                          </div>
                        );
                      })()
                    )}
                  </Card>
                ) : meetingTab === 'Past' ? (
                  <div className="space-y-3">
                    {meetings.filter((m) => m.status === 'completed').length === 0 ? (
                      <EmptyBlock title="No past meetings" hint="Completed meetings will be archived here." />
                    ) : (
                      meetings
                        .filter((m) => m.status === 'completed')
                        .map((m) => (
                          <article key={m.id} className="flex flex-wrap items-center gap-4 rounded-xl border border-[#E5E1D8] bg-white p-4">
                            <div className="rounded-lg bg-[#F3EBDD] p-3 text-center">
                              <CalendarDays className="mx-auto mb-1 text-[#806236]" size={18} />
                              <b className="text-xs">{new Date(m.scheduled_at).toLocaleDateString()}</b>
                              <small className="block text-[10px] text-[#4A5568]">{m.meeting_type}</small>
                            </div>
                            <span className="flex-1">
                              <b className="text-sm">{m.investor_name || 'Investor'}</b>
                              <small className="mt-1 block text-xs text-[#4A5568]">Completed · {m.duration_minutes} min</small>
                            </span>
                            <button type="button" onClick={() => notify('Meeting details opened.')} className="rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white">
                              Details
                            </button>
                          </article>
                        ))
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {meetings.filter((m) => (m.status === 'proposed' || m.status === 'confirmed') && new Date(m.scheduled_at).getTime() >= Date.now()).length === 0 ? (
                      <EmptyBlock title="No upcoming meetings" hint="Proposed and confirmed meetings with a future time appear here." />
                    ) : (
                      meetings
                        .filter((m) => (m.status === 'proposed' || m.status === 'confirmed') && new Date(m.scheduled_at).getTime() >= Date.now())
                        .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))
                        .map((m) => (
                          <article key={m.id} className="flex flex-wrap items-center gap-4 rounded-xl border border-[#E5E1D8] bg-white p-4">
                            <div className="rounded-lg bg-[#F3EBDD] p-3 text-center">
                              <CalendarDays className="mx-auto mb-1 text-[#806236]" size={18} />
                              <b className="text-xs">{new Date(m.scheduled_at).toLocaleDateString()}</b>
                              <small className="block text-[10px] text-[#4A5568]">{new Date(m.scheduled_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</small>
                            </div>
                            <span className="flex-1">
                              <b className="text-sm">{m.investor_name || 'Investor'}</b>
                              <small className="mt-1 block text-xs text-[#4A5568]">{m.meeting_type} · {m.duration_minutes} min · {m.status}</small>
                            </span>
                            <button type="button" onClick={() => notify('Meeting prep opened.')} className="rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs">
                              Prepare
                            </button>
                            <button type="button" onClick={() => notify(m.status === 'confirmed' ? 'Join opens 10 minutes before start.' : 'Meeting details opened.')} className="rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white">
                              {m.status === 'confirmed' ? 'Join' : 'Details'}
                            </button>
                          </article>
                        ))
                    )}
                  </div>
                )}
              </>
            )}
            {disclaimer}
          </>
        )}

        {page === 'rounds' && (
          <>
            {head(
              canEditRounds && (
                <Btn onClick={() => setModal('round')}><Plus size={15} /> New round</Btn>
              )
            )}
            {roundsPhase === 'loading' && <LoadingBlock label="Loading your rounds…" rows={2} />}
            {roundsPhase === 'error' && (
              <ErrorBlock
                message="Could not load your rounds."
                onRetry={() => org && loadRounds(org.id)}
              />
            )}
            {roundsPhase === 'none' && (
              <EmptyBlock
                title={user?.roles?.includes('investor') ? 'Investor Workspace' : 'No startup workspace yet'}
                hint={
                  user?.roles?.includes('investor')
                    ? 'You are logged in as an investor. Fundraising rounds are created and managed by startups in their founder workspaces. You can discover startups and view active rounds in the Discover portal.'
                    : 'Create or join a startup to start tracking fundraising rounds.'
                }
              >
                {user?.roles?.includes('investor') && (
                  <Link
                    href="/investor/discover"
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-ink px-4 text-xs font-semibold text-white hover:bg-black transition-colors"
                  >
                    <Search size={14} /> Go to Investor Discovery
                  </Link>
                )}
              </EmptyBlock>
            )}
            {roundsPhase === 'ready' && rounds.length === 0 && (
              <EmptyBlock
                title="No fundraising rounds yet"
                hint="Set up your first round to start tracking your raise."
              >
                {canEditRounds && (
                  <Btn onClick={() => setModal('round')}><Plus size={15} /> New round</Btn>
                )}
              </EmptyBlock>
            )}
            {roundsPhase === 'ready' && rounds.length > 0 && (
              <div className="grid gap-5 lg:grid-cols-3">
                <div className="space-y-3 lg:col-span-2">
                  {rounds.map((r) => {
                    const pct = progressNum(r.progress_pct);
                    return (
                      <Card
                        key={r.id}
                        title={r.name}
                        action={<StatusBadge status={r.status} />}
                      >
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                          {[
                            ['Target', formatMoney(r.target_amount, r.currency)],
                            ['Committed', formatMoney(r.committed_amount, r.currency)],
                            ['Remaining', formatMoney(r.remaining_amount, r.currency)],
                            ['Progress', pct + '%'],
                          ].map(([n, v]) => (
                            <div key={n} className="rounded-lg bg-[#FAF8F4] p-3">
                              <small className="text-xs text-[#4A5568]">{n}</small>
                              <b className="serif mt-1 block text-xl">{v}</b>
                            </div>
                          ))}
                        </div>
                        <div className="mt-4 h-2 rounded-full bg-[#E5E1D8]">
                          <div
                            className="h-full rounded-full bg-[#B8955A]"
                            style={{ width: Math.min(100, Math.max(0, pct)) + '%' }}
                          />
                        </div>
                        <div className="mt-4 flex flex-wrap justify-between gap-3">
                          <span className="text-xs text-[#4A5568]">
                            {r.round_type} · {r.instrument || 'No instrument'} · Closing target {r.closes_on || '—'}
                          </span>
                          <Link href={'/startup/rounds/' + r.id} className="text-xs font-semibold text-[#9A7A45]">
                            Open round <ArrowRight className="inline" size={12} />
                          </Link>
                        </div>
                      </Card>
                    );
                  })}
                  <Card title="Round milestones">
                    <EmptyBlock
                      title="Round milestones arrive later"
                      hint="Milestones such as first commitment and term-sheet signing are recorded with offers and commitments (a later step)."
                    />
                  </Card>
                </div>

                <aside>
                  <Card title="Getting started">
                    <p className="text-xs leading-5 text-[#4A5568]">Set round terms, prepare your data room, connect with investors, record offers and close with your counsel.</p>
                    <button type="button" onClick={() => setModal('round-guide')} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#9A7A45] hover:text-[#806236] transition-colors">
                      <BookOpen size={13} /> Read round guide <ArrowRight className="inline" size={12} />
                    </button>
                  </Card>
                </aside>
              </div>
            )}
            {disclaimer}
          </>
        )}

        {page === 'round-detail' && (
          <>
            {head(
              <>
                <button
                  type="button"
                  onClick={() => setModal('round-guide')}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[#E5E1D8] bg-white px-3.5 text-xs font-semibold text-[#4A5568] hover:border-[#B8955A] hover:text-[#0F1B2D] transition-colors"
                >
                  <BookOpen size={14} className="text-[#B8955A]" /> Read round guide
                </button>

                {canEditRounds && round && (
                  <>
                    {round.status === 'draft' && (
                      <>
                        <button
                          type="button"
                          onClick={openEditRoundModal}
                          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[#E5E1D8] bg-white px-3.5 text-xs font-semibold text-[#0F1B2D] hover:bg-[#FAF8F4] transition-colors"
                        >
                          <Edit2 size={13} className="text-[#4A5568]" /> Edit terms
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateRoundStatus('cancelled')}
                          disabled={statusChanging}
                          className="min-h-10 rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs font-semibold text-[#9A3A3A] hover:bg-red-50 transition-colors"
                        >
                          Cancel round
                        </button>
                        <Btn
                          onClick={() => handleUpdateRoundStatus('open')}
                          disabled={statusChanging}
                        >
                          <CheckCircle2 size={14} className="mr-1 inline" /> Open round
                        </Btn>
                      </>
                    )}

                    {round.status === 'open' && (
                      <>
                        <button
                          type="button"
                          onClick={openEditRoundModal}
                          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[#E5E1D8] bg-white px-3.5 text-xs font-semibold text-[#0F1B2D] hover:bg-[#FAF8F4] transition-colors"
                        >
                          <Edit2 size={13} className="text-[#4A5568]" /> Edit terms
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateRoundStatus('paused')}
                          disabled={statusChanging}
                          className="min-h-10 rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs font-semibold text-[#4A5568] hover:bg-[#FAF8F4] transition-colors"
                        >
                          Pause round
                        </button>
                        <Btn
                          onClick={() => handleUpdateRoundStatus('closed')}
                          disabled={statusChanging}
                        >
                          Close round
                        </Btn>
                      </>
                    )}

                    {round.status === 'paused' && (
                      <>
                        <button
                          type="button"
                          onClick={openEditRoundModal}
                          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[#E5E1D8] bg-white px-3.5 text-xs font-semibold text-[#0F1B2D] hover:bg-[#FAF8F4] transition-colors"
                        >
                          <Edit2 size={13} className="text-[#4A5568]" /> Edit terms
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateRoundStatus('closed')}
                          disabled={statusChanging}
                          className="min-h-10 rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs font-semibold text-[#4A5568] hover:bg-[#FAF8F4] transition-colors"
                        >
                          Close round
                        </button>
                        <Btn
                          onClick={() => handleUpdateRoundStatus('open')}
                          disabled={statusChanging}
                        >
                          Resume round
                        </Btn>
                      </>
                    )}

                    {round.status === 'closed' && (
                      <Btn
                        onClick={() => handleUpdateRoundStatus('open')}
                        disabled={statusChanging}
                      >
                        Reopen round
                      </Btn>
                    )}
                  </>
                )}
              </>
            )}
            {roundPhase === 'loading' && <LoadingBlock label="Loading round…" rows={2} />}
            {roundPhase === 'error' && (
              <ErrorBlock
                message={roundLoadError || 'Could not load this round.'}
                onRetry={() => org && loadRound(org.id, id)}
              />
            )}
            {roundPhase === 'none' && (
              <EmptyBlock
                title={user?.roles?.includes('investor') ? 'Founder Round Management' : 'No startup workspace yet'}
                hint={
                  user?.roles?.includes('investor')
                    ? 'This is a founder round management page. As an investor, you can evaluate open rounds and view investment terms from the startup’s discovery profile.'
                    : 'Create or join a startup to view this round.'
                }
              >
                {user?.roles?.includes('investor') && (
                  <Link
                    href="/investor/discover"
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-ink px-4 text-xs font-semibold text-white hover:bg-black transition-colors"
                  >
                    <Search size={14} /> Go to Investor Discovery
                  </Link>
                )}
              </EmptyBlock>
            )}
            {roundPhase === 'ready' && round && (
              <>
                {round.status === 'draft' && (
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#ECD9BA] bg-[#FAF4E8] p-4 text-[#806236]">
                    <div className="flex items-start gap-3">
                      <AlertCircle size={18} className="mt-0.5 shrink-0 text-[#B8955A]" />
                      <div>
                        <p className="text-sm font-semibold">This round is currently in Draft</p>
                        <p className="mt-0.5 text-xs text-[#6B522D]">
                          It is not yet open to investor commitments. Review your terms and data room, and click &ldquo;Open round&rdquo; when ready to start accepting offers.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setModal('round-guide')}
                        className="rounded-lg border border-[#D9CEBA] bg-white px-3 py-1.5 text-xs font-semibold text-[#806236] hover:bg-[#FAF8F4]"
                      >
                        Read round guide
                      </button>
                      {canEditRounds && (
                        <button
                          type="button"
                          onClick={() => handleUpdateRoundStatus('open')}
                          disabled={statusChanging}
                          className="rounded-lg bg-[#806236] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[#6b522d] transition-colors"
                        >
                          Open round now
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {round.status === 'paused' && (
                  <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
                    <div className="flex items-start gap-3">
                      <AlertCircle size={18} className="mt-0.5 shrink-0 text-amber-600" />
                      <div>
                        <p className="text-sm font-semibold">This round is paused</p>
                        <p className="mt-0.5 text-xs text-amber-700">
                          New commitments are temporarily suspended while terms or allocations are evaluated.
                        </p>
                      </div>
                    </div>
                    {canEditRounds && (
                      <button
                        type="button"
                        onClick={() => handleUpdateRoundStatus('open')}
                        disabled={statusChanging}
                        className="rounded-lg bg-amber-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-800"
                      >
                        Resume round
                      </button>
                    )}
                  </div>
                )}

                {round.status === 'closed' && (
                  <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4 text-[#4A5568]">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-stone-600" />
                      <div>
                        <p className="text-sm font-semibold">This round is closed</p>
                        <p className="mt-0.5 text-xs text-[#4A5568]">
                          Fundraising for this round has ended. Terms and historical metrics are archived.
                        </p>
                      </div>
                    </div>
                    {canEditRounds && (
                      <button
                        type="button"
                        onClick={() => handleUpdateRoundStatus('open')}
                        disabled={statusChanging}
                        className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#0F1B2D] hover:bg-stone-100"
                      >
                        Reopen round
                      </button>
                    )}
                  </div>
                )}

                {round.status === 'cancelled' && (
                  <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
                    <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-600" />
                    <div>
                      <p className="text-sm font-semibold">This round was cancelled</p>
                      <p className="mt-0.5 text-xs text-red-700">
                        This fundraising round was marked cancelled. No further commitments or status changes are permitted.
                      </p>
                    </div>
                  </div>
                )}
                <div className="mb-5 rounded-xl border border-[#E5E1D8] bg-white p-5">
                  <div className="flex justify-between text-sm">
                    <b>Raised {formatMoney(round.committed_amount, round.currency)} of {formatMoney(round.target_amount, round.currency)}</b>
                    <span>Closes {round.closes_on || '—'}</span>
                  </div>
                  <div className="mt-3 h-3 rounded-full bg-[#E5E1D8]">
                    <div
                      className="h-full rounded-full bg-[#B8955A]"
                      style={{ width: Math.min(100, Math.max(0, progressNum(round.progress_pct))) + '%' }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-[#4A5568]">
                    {progressNum(round.progress_pct) + '% committed' + (round.target_amount ? ' · target ' + formatMoney(round.target_amount, round.currency) : '')}
                  </p>
                </div>

                <div className="mb-4 flex gap-2 overflow-x-auto">
                  {['Overview', 'Offers and commitments', 'Term sheets', 'Cap table impact', 'Documents', 'Activity'].map((x) => (
                    <button
                      key={x}
                      type="button"
                      onClick={() => setRoundTab(x)}
                      className={roundTab === x ? 'min-h-10 shrink-0 rounded-lg px-3 text-xs bg-ink text-white' : 'min-h-10 shrink-0 rounded-lg px-3 text-xs border border-[#E5E1D8] bg-white'}
                    >
                      {x}
                    </button>
                  ))}
                </div>

                <Card title={roundTab}>
                  {roundTab === 'Overview' ? (
                    <>
                      <div className="grid gap-3 sm:grid-cols-4">
                        {[
                          ['Committed', formatMoney(round.committed_amount, round.currency)],
                          ['Remaining', formatMoney(round.remaining_amount, round.currency)],
                          ['Target', formatMoney(round.target_amount, round.currency)],
                          ['Progress', progressNum(round.progress_pct) + '%'],
                        ].map(([a, b]) => (
                          <div key={a} className="rounded-lg bg-[#FAF8F4] p-4">
                            <small className="text-xs text-[#4A5568]">{a}</small>
                            <b className="serif mt-1 block text-xl">{b}</b>
                          </div>
                        ))}
                      </div>
                      <p className="mt-5 text-xs text-[#4A5568]">
                        Round opened {round.opens_on || '—'} · closes {round.closes_on || '—'} · status {round.status}
                      </p>
                    </>
                  ) : roundTab === 'Offers and commitments' ? (
                    roundOffersPhase === 'loading' ? (
                      <LoadingBlock message="Loading offers for this round…" />
                    ) : roundOffersPhase === 'error' ? (
                      <ErrorBlock
                        message={roundOffersError || 'Could not load offers.'}
                        onRetry={() => loadRoundOffers(org?.id, id)}
                      />
                    ) : roundOffers.length === 0 ? (
                      <EmptyBlock
                        title="No offers received yet"
                        hint="Offers sent by interested investors for this round will appear here with terms, instrument, and acceptance controls."
                      />
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[700px] text-left text-xs">
                          <thead className="border-b text-[#4A5568]">
                            <tr>
                              {['Investor', 'Offer amount', 'Instrument', 'Cap / Valuation', 'Discount', 'Status', 'Expires', 'Actions'].map((h) => (
                                <th key={h} className="py-3 font-semibold">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#E5E1D8]">
                            {roundOffers.map((offer) => {
                              const isOpen = ['sent', 'countered'].includes(offer.status);
                              return (
                                <tr key={offer.id} className="hover:bg-[#FAF8F4]/60">
                                  <td className="py-3">
                                    <div className="font-semibold text-ink">{offer.investor_name}</div>
                                    <div className="text-[10px] text-[#4A5568]">v{offer.version}</div>
                                  </td>
                                  <td className="py-3 font-semibold text-ink">
                                    {formatMoney(offer.amount, offer.currency)}
                                  </td>
                                  <td className="py-3 uppercase text-[#4A5568]">
                                    {offer.instrument.replace(/_/g, ' ')}
                                  </td>
                                  <td className="py-3">
                                    {offer.valuation_cap != null ? formatMoney(offer.valuation_cap, offer.currency) : '—'}
                                  </td>
                                  <td className="py-3">
                                    {offer.discount_pct != null ? `${offer.discount_pct}%` : '—'}
                                  </td>
                                  <td className="py-3">
                                    <StatusBadge status={offer.status.charAt(0).toUpperCase() + offer.status.slice(1)} />
                                  </td>
                                  <td className="py-3 text-[#4A5568]">
                                    {offer.expires_on || '—'}
                                  </td>
                                  <td className="py-3">
                                    {isOpen && canEditRounds ? (
                                      <div className="flex items-center gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => setSelectedOfferModal({ offer, action: 'accept' })}
                                          className="rounded-md bg-ink px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-black transition"
                                        >
                                          Accept
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setSelectedOfferModal({ offer, action: 'decline' })}
                                          className="rounded-md border border-[#E5E1D8] bg-white px-2.5 py-1 text-[11px] font-medium text-stone-700 hover:bg-stone-50 transition"
                                        >
                                          Decline
                                        </button>
                                      </div>
                                    ) : (
                                      <span className="text-[11px] capitalize text-[#4A5568]">
                                        {offer.status}
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )
                  ) : roundTab === 'Term sheets' ? (
                    <EmptyBlock
                      title="Term sheets arrive later"
                      hint="Term sheets are tracked with the offers step (a later step)."
                    />
                  ) : roundTab === 'Cap table impact' ? (
                    <EmptyBlock
                      title="Cap table impact arrives later"
                      hint="Dilution and cap-table impact are computed with the commitments step (a later step)."
                    />
                  ) : roundTab === 'Documents' ? (
                    <EmptyBlock
                      title="Documents arrive later"
                      hint="Data-room documents are managed with the data-room step (a later step)."
                    />
                  ) : (
                    <EmptyBlock
                      title="Activity arrives later"
                      hint="Round activity is recorded as offers and commitments are added (a later step)."
                    />
                  )}
                </Card>
              </>
            )}
            {disclaimer}
          </>
        )}

        {page === 'settings' && (
          <>
            {head(
              <Btn
                onClick={handleSaveProfile}
                disabled={profilePhase !== 'ready' || savingProfile || !canEditVisibility}
                title={canEditVisibility ? '' : 'Only owners, admins and members can change visibility.'}
              >
                {savingProfile ? 'Saving…' : 'Save changes'}
              </Btn>
            )}
            {profilePhase === 'loading' && <LoadingBlock label="Loading visibility settings…" rows={3} />}
            {profilePhase === 'error' && (
              <ErrorBlock
                title="Could not load visibility settings"
                message={profileError || 'Something went wrong while loading your profile.'}
                onRetry={() => setProfileReloadKey((k) => k + 1)}
              />
            )}
            {profilePhase === 'ready' && profile && (
              <>
                <div className="grid items-start gap-5 xl:grid-cols-3">
                  <div className="space-y-5 xl:col-span-2">
                    <Card title="Who can see my startup">
                      <fieldset className="space-y-3">
                        {['Private', 'Mentors only', 'Mentors and verified investors', 'Public'].map(x => (
                          <label key={x} className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#E5E1D8] p-3">
                            <input
                              type="radio"
                              name="visibility"
                              checked={vis === x}
                              disabled={!canEditVisibility}
                              onChange={() => {
                                setVis(x);
                                setVisible(investorVisibilityEnabled(VISIBILITY_VALUES[x]));
                              }}
                              className="mt-1 accent-ink"
                            />
                            <span className="flex-1">
                              <b className="block text-sm">{x}</b>
                              <small className="text-xs text-[#4A5568]">
                                {x === 'Private'
                                  ? 'Only your team can view your startup.'
                                  : x === 'Mentors only'
                                  ? 'Your assigned mentors can see shared information.'
                                  : x === 'Public'
                                  ? 'Anyone can view your public startup profile.'
                                  : 'Approved, verified investors can discover your public profile.'}
                              </small>
                              {profileFormErrors.profile_visibility && <FieldError>{profileFormErrors.profile_visibility}</FieldError>}
                            </span>
                          </label>
                        ))}
                      </fieldset>
                      {!canEditVisibility && (
                        <p className="mt-3 text-xs text-[#4A5568]">
                          You are a viewer in this organization. Visibility changes are saved by owners, admins and members.
                        </p>
                      )}
                    </Card>

                    <Card title="What investors can see">
                      {Object.entries({
                        summary: 'Profile summary',
                        traction: 'Traction numbers',
                        team: 'Team details',
                        funding: 'Funding details',
                        round: 'Round information',
                        readiness: 'Readiness score and badge',
                      }).map(([key, label]) => (
                        <div key={key} className="flex min-h-11 items-center justify-between border-b border-[#E5E1D8] text-sm">
                          <span>{label}</span>
                          <input
                            type="checkbox"
                            checked={toggles[key]}
                            disabled={!canEditVisibility}
                            onChange={() => setToggles({ ...toggles, [key]: !toggles[key] })}
                            className="h-4 w-4 accent-ink"
                          />
                        </div>
                      ))}
                      <button type="button" onClick={handlePreviewAsInvestor} className="mt-4 text-xs font-semibold text-[#9A7A45]">
                        Preview as investor <ArrowUpRight className="inline" size={12} />
                      </button>
                    </Card>

                    <Card title="Pause investor visibility">
                      <p className="text-xs leading-5 text-[#4A5568]">Temporarily hide your profile without deleting information or past activity.</p>
                      <button
                        type="button"
                        onClick={handlePauseVisibility}
                        disabled={!canEditVisibility || savingProfile}
                        className={`mt-3 rounded-lg px-4 py-2.5 text-xs font-semibold ${visible ? 'border border-[#E5E1D8]' : 'bg-[#B42318] text-white'} disabled:opacity-40`}
                      >
                        {visible ? 'Pause visibility' : 'Resume visibility'}
                      </button>
                    </Card>
                  </div>
                </div>
                {disclaimer}
              </>
            )}
          </>
        )}
      </main>

      {/* Modals */}
      {modal && modal !== 'round-guide' && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[#0F1B2D]/45 p-4" onClick={(e) => { if (e.target === e.currentTarget) setModal(''); }}>
          <section role="dialog" aria-modal="true" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="serif text-2xl font-semibold">
                {modal.startsWith('intro')
                  ? 'Request an introduction'
                  : modal === 'meeting'
                  ? 'Schedule investor meeting'
                  : modal === 'round'
                  ? 'Set up a fundraising round'
                  : modal === 'edit-round'
                  ? 'Edit round terms'
                  : modal === 'offer'
                  ? 'Record an offer'
                  : 'Add investor to pipeline'}
              </h2>
              <button type="button" onClick={() => setModal('')} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            {modal.startsWith('intro') ? (
              <>
                <p className="mb-3 text-xs text-[#4A5568]">50–500 characters · You have 5 requests left today.</p>
                <textarea
                  minLength={50}
                  maxLength={500}
                  rows={5}
                  placeholder="What you do, your traction, what you’re raising and why this investor is a fit…"
                  className="w-full rounded-lg border border-[#E5E1D8] p-3 text-sm"
                />
                <div className="mt-3 space-y-2 text-xs">
                  {[
                    ['Profile summary', true],
                    ['Traction numbers', true],
                    ['Pitch deck (view-only)', false],
                  ].map(([x, v]) => (
                    <label key={x} className="flex justify-between">
                      {x}
                      <input type="checkbox" defaultChecked={v} className="accent-ink" />
                    </label>
                  ))}
                </div>
                <p className="mt-3 rounded-lg bg-[#FAF8F4] p-3 text-xs text-[#4A5568]">
                  No data room access will be granted automatically. Investors must accept the introduction.
                </p>
              </>
            ) : modal === 'meeting' ? (
              <div className="space-y-3">
                <label className="block text-sm">
                  Investor
                  <select className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] bg-white px-3">
                    <option>SeedSpring Fund</option>
                    <option>Northstar Capital</option>
                    <option>Mira Shah</option>
                  </select>
                </label>
                <label className="block text-sm">
                  Meeting type
                  <select className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] bg-white px-3">
                    <option>Intro call</option>
                    <option>Pitch</option>
                    <option>Diligence</option>
                    <option>Follow-up</option>
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm">
                    Date
                    <input type="date" className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] px-3" />
                  </label>
                  <label className="text-sm">
                    Time
                    <input type="time" className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] px-3" />
                  </label>
                </div>
                <label className="block text-sm">
                  Agenda
                  <textarea rows={3} placeholder="What would you like to discuss?" className="mt-2 w-full rounded-lg border border-[#E5E1D8] p-3" />
                </label>
                <p className="text-xs text-[#4A5568]">Time zone: Asia/Kolkata · Recording is off by default.</p>
              </div>
            ) : modal === 'round' ? (
              <div className="space-y-3">
                <label className="block text-sm">
                  Round name
                  <input
                    value={roundForm.name}
                    onChange={(e) => setRoundForm({ ...roundForm, name: e.target.value })}
                    placeholder="Pre-seed"
                    className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-sm"
                  />
                  <FieldError>{roundFormErrors.name}</FieldError>
                </label>
                <label className="block text-sm">
                  Round type
                  <select
                    value={roundForm.round_type}
                    onChange={(e) => setRoundForm({ ...roundForm, round_type: e.target.value })}
                    className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 text-sm"
                  >
                    <option value="pre_seed">Pre-seed</option>
                    <option value="seed">Seed</option>
                    <option value="series_a">Series A</option>
                    <option value="series_b">Series B</option>
                    <option value="bridge">Bridge</option>
                    <option value="safe">SAFE</option>
                    <option value="other">Other</option>
                  </select>
                  <FieldError>{roundFormErrors.round_type}</FieldError>
                </label>
                <label className="block text-sm">
                  Target raise
                  <input
                    value={roundForm.target_amount}
                    onChange={(e) => setRoundForm({ ...roundForm, target_amount: e.target.value })}
                    placeholder="25000000"
                    className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-sm"
                  />
                  <FieldError>{roundFormErrors.target_amount}</FieldError>
                </label>
                <label className="block text-sm">
                  Minimum raise
                  <input
                    value={roundForm.min_raise}
                    onChange={(e) => setRoundForm({ ...roundForm, min_raise: e.target.value })}
                    placeholder="15000000"
                    className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-sm"
                  />
                  <FieldError>{roundFormErrors.min_raise}</FieldError>
                </label>
                <label className="block text-sm">
                  Instrument
                  <select
                    value={roundForm.instrument}
                    onChange={(e) => setRoundForm({ ...roundForm, instrument: e.target.value })}
                    className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 text-sm"
                  >
                    <option value="equity">Equity</option>
                    <option value="safe">SAFE</option>
                    <option value="convertible_note">Convertible note</option>
                    <option value="ccd">CCD</option>
                    <option value="ccps">CCPS</option>
                    <option value="debt">Debt</option>
                    <option value="other">Other</option>
                  </select>
                  <FieldError>{roundFormErrors.instrument}</FieldError>
                </label>
                <label className="block text-sm">
                  Minimum ticket
                  <input
                    value={roundForm.min_ticket}
                    onChange={(e) => setRoundForm({ ...roundForm, min_ticket: e.target.value })}
                    placeholder="1000000"
                    className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-sm"
                  />
                  <FieldError>{roundFormErrors.min_ticket}</FieldError>
                </label>
                <label className="block text-sm">
                  Closing date
                  <input
                    type="date"
                    value={roundForm.closes_on}
                    onChange={(e) => setRoundForm({ ...roundForm, closes_on: e.target.value })}
                    className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-sm"
                  />
                  <FieldError>{roundFormErrors.closes_on}</FieldError>
                </label>
                <p className="rounded-lg bg-[#FFF8E8] p-3 text-xs text-[#806236]">Round terms and instruments have legal consequences. Review with a lawyer.</p>
              </div>
            ) : modal === 'edit-round' ? (
              <div className="space-y-3">
                <label className="block text-sm">
                  Round name
                  <input
                    value={editRoundForm.name}
                    onChange={(e) => setEditRoundForm({ ...editRoundForm, name: e.target.value })}
                    placeholder="Pre-seed"
                    className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-sm"
                  />
                  <FieldError>{editRoundErrors.name}</FieldError>
                </label>
                <label className="block text-sm">
                  Round type
                  <select
                    value={editRoundForm.round_type}
                    onChange={(e) => setEditRoundForm({ ...editRoundForm, round_type: e.target.value })}
                    className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 text-sm"
                  >
                    <option value="pre_seed">Pre-seed</option>
                    <option value="seed">Seed</option>
                    <option value="series_a">Series A</option>
                    <option value="series_b">Series B</option>
                    <option value="bridge">Bridge</option>
                    <option value="safe">SAFE</option>
                    <option value="other">Other</option>
                  </select>
                  <FieldError>{editRoundErrors.round_type}</FieldError>
                </label>
                <label className="block text-sm">
                  Target raise
                  <input
                    value={editRoundForm.target_amount}
                    onChange={(e) => setEditRoundForm({ ...editRoundForm, target_amount: e.target.value })}
                    placeholder="25000000"
                    className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-sm"
                  />
                  <FieldError>{editRoundErrors.target_amount}</FieldError>
                </label>
                <label className="block text-sm">
                  Minimum raise
                  <input
                    value={editRoundForm.min_raise}
                    onChange={(e) => setEditRoundForm({ ...editRoundForm, min_raise: e.target.value })}
                    placeholder="15000000"
                    className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-sm"
                  />
                  <FieldError>{editRoundErrors.min_raise}</FieldError>
                </label>
                <label className="block text-sm">
                  Instrument
                  <select
                    value={editRoundForm.instrument}
                    onChange={(e) => setEditRoundForm({ ...editRoundForm, instrument: e.target.value })}
                    className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 text-sm"
                  >
                    <option value="equity">Equity</option>
                    <option value="safe">SAFE</option>
                    <option value="convertible_note">Convertible note</option>
                    <option value="ccd">CCD</option>
                    <option value="ccps">CCPS</option>
                    <option value="debt">Debt</option>
                    <option value="other">Other</option>
                  </select>
                  <FieldError>{editRoundErrors.instrument}</FieldError>
                </label>
                <label className="block text-sm">
                  Minimum ticket
                  <input
                    value={editRoundForm.min_ticket}
                    onChange={(e) => setEditRoundForm({ ...editRoundForm, min_ticket: e.target.value })}
                    placeholder="1000000"
                    className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-sm"
                  />
                  <FieldError>{editRoundErrors.min_ticket}</FieldError>
                </label>
                <label className="block text-sm">
                  Closing date
                  <input
                    type="date"
                    value={editRoundForm.closes_on}
                    onChange={(e) => setEditRoundForm({ ...editRoundForm, closes_on: e.target.value })}
                    className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-sm"
                  />
                  <FieldError>{editRoundErrors.closes_on}</FieldError>
                </label>
                <p className="rounded-lg bg-[#FFF8E8] p-3 text-xs text-[#806236]">Round terms and instruments have legal consequences. Review with a lawyer.</p>
              </div>
            ) : modal === 'offer' ? (
              <div className="space-y-3">
                <label className="block text-sm">
                  Investor
                  <select className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-3">
                    <option>Northstar Capital</option>
                    <option>SeedSpring Fund</option>
                  </select>
                </label>
                <label className="block text-sm">
                  Amount
                  <input placeholder="₹50L" className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] px-3" />
                </label>
                <label className="block text-sm">
                  Instrument
                  <select className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-3">
                    <option>Equity</option>
                    <option>SAFE</option>
                    <option>Convertible note</option>
                  </select>
                </label>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="block text-sm">
                  Investor name
                  <input placeholder="Investor or firm" className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] px-3" />
                </label>
                <label className="block text-sm">
                  Email
                  <input type="email" placeholder="contact@example.com" className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] px-3" />
                </label>
                <p className="text-xs text-[#4A5568]">Manual entries are private and labeled as such.</p>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setModal('')} className="min-h-10 px-4 text-sm">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (modal === 'round') {
                    handleCreateRound();
                    return;
                  }
                  if (modal === 'edit-round') {
                    handleUpdateRound();
                    return;
                  }
                  setModal('');
                  notify(
                    modal.startsWith('intro')
                      ? 'Intro request sent.'
                      : modal === 'meeting'
                      ? 'Meeting invitation prepared.'
                      : 'Saved.'
                  );
                }}
                className="min-h-10 rounded-lg bg-ink px-4 text-sm font-semibold text-white"
                disabled={(modal === 'round' && savingRound) || (modal === 'edit-round' && savingEditRound)}
              >
                {modal.startsWith('intro')
                  ? 'Send request'
                  : modal === 'meeting'
                  ? 'Send invite'
                  : modal === 'offer'
                  ? 'Save offer'
                  : modal === 'round'
                  ? (savingRound ? 'Creating…' : 'Create round')
                  : modal === 'edit-round'
                  ? (savingEditRound ? 'Saving…' : 'Save changes')
                  : 'Save'}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Round Guide Modal */}
      {modal === 'round-guide' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F1B2D]/45 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModal('');
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="round-guide-heading"
            className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-[#E5E1D8] p-6 pb-4">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FAF4E8] px-2.5 py-0.5 text-xs font-semibold text-[#806236]">
                  <BookOpen size={12} className="text-[#B8955A]" /> Founder Resource
                </span>
                <h2 id="round-guide-heading" className="serif mt-1 text-2xl font-semibold text-[#0F1B2D]">
                  Fundraising Round Guide
                </h2>
                <p className="mt-1 text-xs text-[#4A5568]">
                  Step-by-step guidance on round structures, investor due diligence, instruments, and closing workflows.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModal('')}
                aria-label="Close guide"
                className="grid h-8 w-8 place-items-center rounded-lg text-[#4A5568] hover:bg-[#FAF8F4] hover:text-[#0F1B2D]"
              >
                <X size={18} />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-[#E5E1D8] bg-[#FAF8F4] px-6">
              {[
                { id: 'overview', label: '1. Overview & Roadmap' },
                { id: 'terms', label: '2. Terms & Instruments' },
                { id: 'dataroom', label: '3. Data Room Prep' },
                { id: 'closing', label: '4. Closing Checklist' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setGuideTab(t.id)}
                  className={`border-b-2 px-4 py-3 text-xs font-semibold transition-colors ${
                    guideTab === t.id
                      ? 'border-[#B8955A] text-[#806236]'
                      : 'border-transparent text-[#4A5568] hover:text-[#0F1B2D]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Content Body */}
            <div className="overflow-y-auto p-6 text-sm text-[#0F1B2D]">
              {guideTab === 'overview' && (
                <div className="space-y-5">
                  <div>
                    <h3 className="serif text-lg font-semibold text-[#0F1B2D]">The Fundraising Lifecycle</h3>
                    <p className="mt-1 text-xs leading-relaxed text-[#4A5568]">
                      A successful financing round follows five distinct phases from internal calibration to wire transfers and cap table allotment.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] p-4">
                      <b className="flex items-center gap-1.5 text-xs text-[#806236]">
                        <span className="grid h-5 w-5 place-items-center rounded-full bg-[#ECD9BA] text-[10px] font-bold">1</span>
                        Draft Terms & Targets
                      </b>
                      <p className="mt-2 text-xs leading-5 text-[#4A5568]">
                        Determine your runway requirements (18–24 months), ideal target raise, minimum closing threshold, and appropriate investment instrument.
                      </p>
                    </div>

                    <div className="rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] p-4">
                      <b className="flex items-center gap-1.5 text-xs text-[#806236]">
                        <span className="grid h-5 w-5 place-items-center rounded-full bg-[#ECD9BA] text-[10px] font-bold">2</span>
                        Prepare the Data Room
                      </b>
                      <p className="mt-2 text-xs leading-5 text-[#4A5568]">
                        Assemble financial projections, cap table details, historical traction metrics, and corporate documents so you are ready when diligence starts.
                      </p>
                    </div>

                    <div className="rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] p-4">
                      <b className="flex items-center gap-1.5 text-xs text-[#806236]">
                        <span className="grid h-5 w-5 place-items-center rounded-full bg-[#ECD9BA] text-[10px] font-bold">3</span>
                        Open Round & Outreach
                      </b>
                      <p className="mt-2 text-xs leading-5 text-[#4A5568]">
                        Move your round from Draft to Open. Run active investor intro calls, pitch presentations, and track pipeline momentum in parallel.
                      </p>
                    </div>

                    <div className="rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] p-4">
                      <b className="flex items-center gap-1.5 text-xs text-[#806236]">
                        <span className="grid h-5 w-5 place-items-center rounded-full bg-[#ECD9BA] text-[10px] font-bold">4</span>
                        Offers & Term Sheets
                      </b>
                      <p className="mt-2 text-xs leading-5 text-[#4A5568]">
                        Secure soft commitments and identify a lead investor to set pricing terms. Compare offers on valuation, rights, and dilution impact.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#ECD9BA] bg-[#FAF4E8] p-4">
                    <b className="flex items-center gap-2 text-sm font-semibold text-[#806236]">
                      <CheckCircle2 size={16} /> Stage 5: Execution & Legal Close
                    </b>
                    <p className="mt-1 text-xs leading-5 text-[#6B522D]">
                      Sign definitive agreements (SHA / SSA / Convertible agreements), verify bank wire deposits, execute board allotment resolutions, and update your capitalization table.
                    </p>
                  </div>
                </div>
              )}

              {guideTab === 'terms' && (
                <div className="space-y-5">
                  <div>
                    <h3 className="serif text-lg font-semibold text-[#0F1B2D]">Instruments & Deal Mechanics</h3>
                    <p className="mt-1 text-xs text-[#4A5568]">
                      Choose the structure that matches your current stage, speed requirement, and investor preferences.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-xl border border-[#E5E1D8] p-4">
                      <div className="flex items-baseline justify-between">
                        <b className="text-sm font-semibold text-[#0F1B2D]">Equity (Priced Round)</b>
                        <span className="text-[11px] font-medium text-[#4A5568]">Seed, Series A+</span>
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-[#4A5568]">
                        Shares are issued at an agreed pre-money valuation and price per share. Best for institutional rounds with lead investors who require board governance.
                      </p>
                    </div>

                    <div className="rounded-xl border border-[#E5E1D8] p-4">
                      <div className="flex items-baseline justify-between">
                        <b className="text-sm font-semibold text-[#0F1B2D]">SAFE (Simple Agreement for Future Equity)</b>
                        <span className="text-[11px] font-medium text-[#4A5568]">Pre-seed, Early Seed</span>
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-[#4A5568]">
                        Converts into equity upon the next qualified priced round. Low legal overhead and fast execution. Commonly includes a Valuation Cap and/or Discount Rate (typically 15%–20%).
                      </p>
                    </div>

                    <div className="rounded-xl border border-[#E5E1D8] p-4">
                      <div className="flex items-baseline justify-between">
                        <b className="text-sm font-semibold text-[#0F1B2D]">Convertible Notes & CCPS / CCD</b>
                        <span className="text-[11px] font-medium text-[#4A5568]">Bridge, Seed, India VC standard</span>
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-[#4A5568]">
                        Compulsorily Convertible Preference Shares (CCPS) or Convertible Debentures (CCD) are widespread under Indian corporate law, offering preference on dividends and conversion upon milestones.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
                    <b>Important Legal Notice:</b> Investment instruments carry binding legal, tax, and governance implications for founders and future investors. Always review definitive term sheets with qualified corporate counsel.
                  </div>
                </div>
              )}

              {guideTab === 'dataroom' && (
                <div className="space-y-5">
                  <div>
                    <h3 className="serif text-lg font-semibold text-[#0F1B2D]">Data Room Essentials</h3>
                    <p className="mt-1 text-xs text-[#4A5568]">
                      Organize your diligence documents in advance to avoid closing delays when investors are ready.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-[#E5E1D8] p-4">
                      <b className="text-xs font-semibold text-[#0F1B2D]">1. Pitch & Product</b>
                      <ul className="mt-2 space-y-1.5 text-xs text-[#4A5568]">
                        <li>• Executive Pitch Deck (12–15 slides)</li>
                        <li>• Product architecture & roadmap brief</li>
                        <li>• Customer testimonials & case studies</li>
                      </ul>
                    </div>

                    <div className="rounded-xl border border-[#E5E1D8] p-4">
                      <b className="text-xs font-semibold text-[#0F1B2D]">2. Financials & Unit Economics</b>
                      <ul className="mt-2 space-y-1.5 text-xs text-[#4A5568]">
                        <li>• 24-month financial model & budget</li>
                        <li>• Historical P&L, balance sheet, and bank statements</li>
                        <li>• Unit economics: CAC, LTV, Gross Margins, Net Burn</li>
                      </ul>
                    </div>

                    <div className="rounded-xl border border-[#E5E1D8] p-4">
                      <b className="text-xs font-semibold text-[#0F1B2D]">3. Cap Table & Equity</b>
                      <ul className="mt-2 space-y-1.5 text-xs text-[#4A5568]">
                        <li>• Fully diluted shareholding pattern</li>
                        <li>• ESOP pool sizing and grant schedule</li>
                        <li>• Existing convertible notes or SAFEs</li>
                      </ul>
                    </div>

                    <div className="rounded-xl border border-[#E5E1D8] p-4">
                      <b className="text-xs font-semibold text-[#0F1B2D]">4. Legal & Corporate</b>
                      <ul className="mt-2 space-y-1.5 text-xs text-[#4A5568]">
                        <li>• Certificate of Incorporation, MOA & AOA</li>
                        <li>• Founder IP assignment agreements</li>
                        <li>• Key employee & advisor contracts</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {guideTab === 'closing' && (
                <div className="space-y-5">
                  <div>
                    <h3 className="serif text-lg font-semibold text-[#0F1B2D]">Round Closing Checklist</h3>
                    <p className="mt-1 text-xs text-[#4A5568]">
                      Verify every prerequisite item before formally transitioning a round to Closed.
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    {[
                      { title: 'Minimum Raise Reached', desc: 'Total firm commitments meet or exceed your minimum raise threshold.' },
                      { title: 'Definitive Agreements Executed', desc: 'SHA, SSA, or SAFE documents signed by founders, key shareholders, and incoming investors.' },
                      { title: 'Board & Shareholder Approvals', desc: 'Special resolutions approved for increasing authorized capital and allotting securities.' },
                      { title: 'Wire Transfers Verified', desc: 'Subscription funds deposited and verified in the company bank account or escrow.' },
                      { title: 'Cap Table Updated', desc: 'Dilution reflected and share certificates or convertible instruments issued.' },
                      { title: 'Investor Welcome & Reporting Cadence', desc: 'Welcome update dispatched to new backers establishing monthly reporting schedule.' },
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-start gap-3 rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] p-3.5">
                        <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[#B8955A]" />
                        <div>
                          <b className="text-xs font-semibold text-[#0F1B2D]">{item.title}</b>
                          <p className="mt-0.5 text-xs text-[#4A5568]">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-[#E5E1D8] bg-[#FAF8F4] px-6 py-4">
              <span className="text-xs text-[#4A5568]">
                Need additional advice? Connect with a mentor from your dashboard.
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setModal('')}
                  className="rounded-lg border border-[#E5E1D8] bg-white px-4 py-2 text-xs font-semibold text-[#0F1B2D] hover:bg-stone-50"
                >
                  Close guide
                </button>
                {page === 'round-detail' && round?.status === 'draft' && canEditRounds && (
                  <button
                    type="button"
                    onClick={() => {
                      setModal('');
                      handleUpdateRoundStatus('open');
                    }}
                    className="rounded-lg bg-ink px-4 py-2 text-xs font-semibold text-white hover:bg-black"
                  >
                    Open this round now
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Investor Engagement Request Review & Decision Modal */}
      {selectedRequest && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F1B2D]/45 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget && !respondingBusy) setSelectedRequest(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="request-modal-title"
            className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-2xl bg-white p-6 shadow-2xl overflow-y-auto"
          >
            <div className="mb-4 flex items-center justify-between border-b border-[#F4F1EA] pb-3">
              <div>
                <span className="text-[11px] font-semibold tracking-wider text-[#9A7A45] uppercase">
                  Investor Outreach
                </span>
                <h2 id="request-modal-title" className="serif text-xl font-semibold text-ink">
                  {selectedRequest.investor_name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => !respondingBusy && setSelectedRequest(null)}
                className="rounded-lg p-1.5 text-[#5A6679] hover:bg-[#FAF8F4] hover:text-ink"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Meta tags */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[#E7D4B0] bg-[#FFF8E8] px-2.5 py-0.5 text-xs font-semibold text-[#806236]">
                  Kind: {selectedRequest.kind === 'intro' ? 'Introduction / Thesis match' : selectedRequest.kind}
                </span>
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${
                    selectedRequest.status === 'accepted'
                      ? 'border-[#A6F4C5] bg-[#ECFDF3] text-[#027A48]'
                      : selectedRequest.status === 'declined'
                      ? 'border-[#FECDCA] bg-[#FEF3F2] text-[#B42318]'
                      : 'border-[#FEDF89] bg-[#FEF0C7] text-[#B54708]'
                  }`}
                >
                  Status: {selectedRequest.status}
                </span>
                <span className="text-xs text-[#5A6679]">
                  Received {new Date(selectedRequest.created_at).toLocaleDateString()}
                </span>
                {selectedRequest.expires_on && (
                  <span className="text-xs text-[#5A6679]">
                    · Valid until {new Date(selectedRequest.expires_on).toLocaleDateString()}
                  </span>
                )}
              </div>

              {/* Ask / Subject */}
              <div className="rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] p-4">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5A6679]">
                  Focus / Subject
                </span>
                <p className="mt-1 text-sm font-semibold text-ink">{selectedRequest.ask}</p>
              </div>

              {/* Message from investor */}
              <div>
                <span className="text-xs font-semibold text-ink">
                  Message from {selectedRequest.investor_name}:
                </span>
                {selectedRequest.message ? (
                  <p className="mt-1.5 whitespace-pre-wrap rounded-xl border border-[#E5E1D8] bg-white p-3.5 text-xs text-[#2D3748] leading-relaxed">
                    {selectedRequest.message}
                  </p>
                ) : (
                  <p className="mt-1.5 text-xs italic text-[#718096]">
                    No additional message was provided.
                  </p>
                )}
              </div>

              {/* Prior response details if already resolved */}
              {selectedRequest.status !== 'pending' && (
                <div className="rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] p-3.5">
                  <span className="text-xs font-semibold text-ink">Founder response:</span>
                  <p className="mt-1 text-xs text-[#4A5568]">
                    {selectedRequest.response_note ? `“${selectedRequest.response_note}”` : 'No note was included.'}
                  </p>
                  {selectedRequest.status === 'accepted' && (
                    <div className="mt-3 flex items-center gap-2">
                      <Link
                        href="/startup/meetings"
                        onClick={() => {
                          setSelectedRequest(null);
                          setMeetingTab('Calendar');
                        }}
                        className="inline-flex min-h-9 items-center rounded-lg bg-ink px-3 text-xs font-semibold text-white hover:bg-black"
                      >
                        <CalendarDays size={13} className="mr-1.5" /> Schedule follow-up meeting
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {/* Decision form if pending */}
              {selectedRequest.status === 'pending' && (
                <form onSubmit={handleRespondRequest} className="space-y-4 border-t border-[#F4F1EA] pt-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-ink">
                      Your decision
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setResponseAction('accept')}
                        className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-semibold transition-all ${
                          responseAction === 'accept'
                            ? 'border-[#027A48] bg-[#ECFDF3] text-[#027A48] ring-2 ring-[#027A48]/20'
                            : 'border-[#E5E1D8] bg-white text-[#4A5568] hover:bg-[#FAF8F4]'
                        }`}
                      >
                        <Check size={16} /> Accept request
                      </button>
                      <button
                        type="button"
                        onClick={() => setResponseAction('decline')}
                        className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-semibold transition-all ${
                          responseAction === 'decline'
                            ? 'border-[#B42318] bg-[#FEF3F2] text-[#B42318] ring-2 ring-[#B42318]/20'
                            : 'border-[#E5E1D8] bg-white text-[#4A5568] hover:bg-[#FAF8F4]'
                        }`}
                      >
                        <X size={16} /> Decline request
                      </button>
                    </div>
                  </div>

                  {responseAction === 'decline' && (
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-ink">
                        Reason for declining
                      </label>
                      <select
                        value={declineReason}
                        onChange={(e) => setDeclineReason(e.target.value)}
                        disabled={respondingBusy}
                        className="w-full rounded-lg border border-[#E5E1D8] bg-white px-3 py-2 text-xs font-medium text-ink focus:border-[#0F1B2D] focus:outline-none"
                      >
                        <option value="Not actively raising at this time">Not actively raising at this time</option>
                        <option value="Thesis or sector mismatch">Thesis or sector mismatch</option>
                        <option value="Stage or check size mismatch">Stage or check size mismatch</option>
                        <option value="Geography or mandate mismatch">Geography or mandate mismatch</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-ink">
                      {responseAction === 'accept' ? 'Note to investor (optional)' : 'Optional message to investor'}
                    </label>
                    <textarea
                      rows={3}
                      value={responseNote}
                      onChange={(e) => setResponseNote(e.target.value)}
                      disabled={respondingBusy}
                      maxLength={2000}
                      className="w-full rounded-lg border border-[#E5E1D8] bg-white px-3 py-2 text-xs text-ink focus:border-[#0F1B2D] focus:outline-none"
                      placeholder={
                        responseAction === 'accept'
                          ? "e.g. Thanks for reaching out! We're glad to connect and share more about our milestones."
                          : "e.g. Thank you for your interest. We will keep you updated on our future rounds."
                      }
                    />
                  </div>

                  {respondError && (
                    <div className="rounded-lg bg-[#FEF3F2] border border-[#FECDCA] p-2.5 text-xs text-[#B42318]" role="alert">
                      {respondError}
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedRequest(null)}
                      disabled={respondingBusy}
                      className="rounded-lg border border-[#E5E1D8] bg-white px-4 py-2 text-xs font-semibold text-[#4A5568] hover:bg-[#FAF8F4]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={respondingBusy}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white transition-colors ${
                        responseAction === 'accept'
                          ? 'bg-ink hover:bg-black'
                          : 'bg-[#B42318] hover:bg-[#912014]'
                      }`}
                    >
                      {respondingBusy
                        ? 'Submitting…'
                        : responseAction === 'accept'
                        ? 'Confirm & Accept'
                        : 'Confirm & Decline'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </section>
        </div>
      )}

      {/* Offer Action Modal (Accept / Decline) */}
      {selectedOfferModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#F4F1EA] pb-3">
              <h2 className="text-base font-semibold text-ink">
                {selectedOfferModal.action === 'accept' ? 'Accept Investment Offer' : 'Decline Investment Offer'}
              </h2>
              <button
                type="button"
                onClick={() => !offerActionSubmitting && setSelectedOfferModal(null)}
                aria-label="Close"
                className="text-[#4A5568] hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] p-3.5 text-xs">
                <div className="flex justify-between py-1">
                  <span className="text-[#4A5568]">Investor</span>
                  <span className="font-semibold text-ink">{selectedOfferModal.offer.investor_name}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#4A5568]">Offer amount</span>
                  <span className="font-semibold text-ink">
                    {formatMoney(selectedOfferModal.offer.amount, selectedOfferModal.offer.currency)}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#4A5568]">Instrument</span>
                  <span className="font-semibold uppercase text-ink">
                    {selectedOfferModal.offer.instrument.replace(/_/g, ' ')}
                  </span>
                </div>
                {selectedOfferModal.offer.valuation_cap != null && (
                  <div className="flex justify-between py-1">
                    <span className="text-[#4A5568]">Valuation Cap</span>
                    <span className="font-semibold text-ink">
                      {formatMoney(selectedOfferModal.offer.valuation_cap, selectedOfferModal.offer.currency)}
                    </span>
                  </div>
                )}
                {selectedOfferModal.offer.discount_pct != null && (
                  <div className="flex justify-between py-1">
                    <span className="text-[#4A5568]">Discount</span>
                    <span className="font-semibold text-ink">
                      {selectedOfferModal.offer.discount_pct}%
                    </span>
                  </div>
                )}
              </div>

              <p className="text-xs text-[#4A5568] leading-relaxed">
                {selectedOfferModal.action === 'accept'
                  ? 'Accepting this offer confirms the terms with the investor and advances this deal to the commitment stage. This action cannot be undone.'
                  : 'Declining this offer will notify the investor that the startup has decided not to proceed with these terms.'}
              </p>
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedOfferModal(null)}
                disabled={offerActionSubmitting}
                className="rounded-lg border border-[#E5E1D8] bg-white px-4 py-2 text-xs font-semibold text-[#4A5568] hover:bg-[#FAF8F4]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmOfferAction}
                disabled={offerActionSubmitting}
                className={`rounded-lg px-4 py-2 text-xs font-semibold text-white transition ${
                  selectedOfferModal.action === 'accept'
                    ? 'bg-ink hover:bg-black'
                    : 'bg-[#B42318] hover:bg-[#912014]'
                }`}
              >
                {offerActionSubmitting
                  ? 'Processing…'
                  : selectedOfferModal.action === 'accept'
                  ? 'Confirm & Accept'
                  : 'Confirm & Decline'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div role="status" aria-live="polite" className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-lg bg-ink px-4 py-3 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
