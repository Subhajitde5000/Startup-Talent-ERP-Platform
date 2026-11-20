'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { StartupSidebar, Btn, Card, SubNavTabs } from '../../../components';
import { api, ApiError } from '@/lib/api/client';
import { Toast } from '@/components';
import {
  EmptyBlock,
  ErrorBlock,
  FieldError,
  LoadingBlock
} from '@/components/async-state';
import {
  MENTORSHIP_STATUS_LABEL,
  MENTORSHIP_STATUS_CHIP,
  SESSION_STATUS_CHIP,
  SESSION_STATUS_LABEL,
  STAGE_LABEL,
  formatDate,
  formatInstant
} from '@/lib/mentorship-labels';
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
  Video,
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
  ThumbsUp,
  ClipboardCheck,
  Paperclip,
  Play,
  Handshake,
  Menu
} from 'lucide-react';

const mentors = [
  {
    id: 'rhea',
    name: 'Rhea Mukherjee',
    headline: 'Go-to-market advisor · 2 exits',
    expertise: ['Go-to-market', 'Fundraising', 'SaaS'],
    industries: ['Fintech', 'B2B SaaS'],
    rating: '4.9',
    reviews: 28,
    price: '₹3,000 / hour',
    next: 'Thu, Nov 12',
    sessions: 140,
    location: 'Kolkata, India',
    bio: 'I work with early-stage founders to shape a clear go-to-market strategy, validate pricing and build an investor-ready story. My approach is structured, candid and focused on practical next steps.',
    why: 'Strong match for your Prototype stage and fundraising readiness goals.',
  },
  {
    id: 'arjun',
    name: 'Arjun Mehta',
    headline: 'Former CTO · 1 successful exit',
    expertise: ['Technology', 'Product', 'Hiring'],
    industries: ['SaaS', 'Marketplace'],
    rating: '4.8',
    reviews: 41,
    price: '₹4,500 / hour',
    next: 'Fri, Nov 13',
    sessions: 215,
    location: 'Bengaluru, India',
    bio: 'I help technical founders move from prototype to resilient product with a clear engineering roadmap and a high-trust early team.',
    why: 'Matches your MVP testing and early engineering team needs.',
  },
  {
    id: 'naina',
    name: 'Naina Roy',
    headline: 'Finance operator · 12 startups advised',
    expertise: ['Finance', 'Fundraising', 'Operations'],
    industries: ['Fintech', 'Climate'],
    rating: '5.0',
    reviews: 19,
    price: 'Free / pro bono',
    next: 'Mon, Nov 16',
    sessions: 98,
    location: 'Mumbai, India',
    bio: 'I support founders with unit economics, runway planning and financial models that are clear to both teams and investors.',
    why: 'Your finance and readiness priorities align with her expertise.',
  },
];

const criteria = [
  'Pitch deck and one-page summary reviewed',
  'Business model and unit economics validated',
  'Financial projections and use of funds defined',
  'Cap table and legal basics in order',
  'Traction metrics documented',
  'Data room complete',
];


// ---- Step 5f: readiness page (real API) -------------------------------------
// The only wired page in this shared file. Everything else here (overview,
// find, requests, sessions, workspace, billing) is Step 8 and stays on demo
// data until then.
// Step 8a: the expertise facets the directory offers. The API matches these
// exactly against mentor_profiles.expertise, so the list is the demo page's
// original set — the ones the seeded mentors actually carry.
const EXPERTISE_OPTIONS = ['Fundraising', 'Product', 'Go-to-market', 'Finance', 'Hiring', 'Technology'];

const READINESS_EDIT_ROLES = ['owner', 'admin', 'member'];

// ---- Step 8d: the startup's own sessions -----------------------------------
// Both blocks read the real API. `viewer_side` and `can_join` come from the
// server, so the buttons shown here can never disagree with what the API
// will actually allow.

function SessionStatusChip({ status }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-1 text-[10px] font-semibold ${
        SESSION_STATUS_CHIP[status] || 'bg-[#F3F4F6] text-[#4A5568]'
      }`}
    >
      {SESSION_STATUS_LABEL[status] || status}
    </span>
  );
}

function StartupSessionsBlock() {
  const [tab, setTab] = useState('Upcoming');
  const [toast, setToast] = useState('');
  const [sessions, setSessions] = useState([]);
  const [mentorships, setMentorships] = useState([]);
  const [phase, setPhase] = useState('loading'); // loading|ready|error
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);

  const notify = (m) => {
    setToast(m);
    setTimeout(() => setToast(''), 2700);
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      setPhase('loading');
      setLoadError('');
      try {
        const [sessionPage, mentorshipPage] = await Promise.all([
          api.sessions.list({ limit: 50 }),
          api.mentorships.list({ side: 'startup', limit: 50 })
        ]);
        if (!alive) return;
        setSessions(sessionPage.items);
        setMentorships(mentorshipPage.items);
        setPhase('ready');
      } catch (err) {
        if (!alive) return;
        setLoadError(err instanceof ApiError ? err.message : 'Could not load your sessions.');
        setPhase('error');
      }
    })();
    return () => {
      alive = false;
    };
  }, [reload]);

  const mentorshipById = new Map(mentorships.map(m => [m.id, m]));
  const mentorOf = (s) => mentorshipById.get(s.mentorship_id)?.mentor;

  const isUpcoming = (s) =>
    s.status !== 'completed' &&
    s.status !== 'cancelled' &&
    s.status !== 'no_show' &&
    new Date(s.scheduled_at).getTime() >= Date.now() - 60 * 60 * 1000;

  const upcoming = sessions.filter(isUpcoming);
  const past = sessions.filter(s => !isUpcoming(s));

  const confirm = async (s) => {
    try {
      const updated = await api.sessions.confirm(s.id);
      setSessions(prev => prev.map(x => (x.id === updated.id ? updated : x)));
      notify('Session confirmed.');
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not confirm the session.');
    }
  };

  const join = (s) => {
    if (!s.can_join) {
      notify('Join opens 10 minutes before the session.');
      return;
    }
    if (!s.meeting_url) {
      notify('No meeting link was added to this session.');
      return;
    }
    window.open(s.meeting_url, '_blank', 'noopener,noreferrer');
  };

  const renderUpcoming = () => {
    if (upcoming.length === 0) {
      return (
        <EmptyBlock
          title="No upcoming sessions"
          hint="When your mentor schedules a session, it appears here with a join link."
        />
      );
    }
    return (
      <div className="space-y-3">
        {upcoming.map((s) => {
          const mentor = mentorOf(s);
          return (
            <article key={s.id} className="flex flex-wrap items-center gap-4 rounded-xl border border-[#E5E1D8] bg-white p-5">
              <div className="rounded-lg bg-[#F3EBDD] p-3 text-center">
                <CalendarDays className="mx-auto mb-1 text-[#806236]" size={18} />
                <b className="text-xs">{formatInstant(s.scheduled_at)}</b>
                <small className="mt-1 block text-[10px] text-[#4A5568]">Asia/Kolkata</small>
              </div>
              <div className="min-w-[180px] flex-1">
                <b className="text-sm">{s.topic || 'Session'}</b>
                <p className="mt-1 text-xs text-[#4A5568]">
                  {mentor?.display_name || 'Mentor'} · {s.duration_min} minutes
                </p>
                <div className="mt-2">
                  <SessionStatusChip status={s.status} />
                </div>
              </div>
              <Link href={`/startup/sessions/${s.id}`} className="text-xs font-semibold text-[#9A7A45] hover:underline">
                Details
              </Link>
              {s.status === 'scheduled' ? (
                <button
                  type="button"
                  onClick={() => confirm(s)}
                  className="rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white"
                >
                  Confirm
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => join(s)}
                  className="rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white"
                >
                  Join session
                </button>
              )}
            </article>
          );
        })}
      </div>
    );
  };

  const renderPast = () => (
    <Card title="Past sessions">
      {past.length === 0 ? (
        <EmptyBlock
          title="No past sessions yet"
          hint="Completed, cancelled and missed sessions will be listed here."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[500px] text-left text-xs">
            <thead>
              <tr className="border-b text-[#4A5568]">
                <th className="py-3">Date</th>
                <th>Mentor</th>
                <th>Topic</th>
                <th>Duration</th>
                <th>Status</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {past.map((s) => (
                <tr key={s.id} className="border-b">
                  <td className="py-3">{formatInstant(s.scheduled_at)}</td>
                  <td>{mentorOf(s)?.display_name || 'Mentor'}</td>
                  <td>{s.topic || '—'}</td>
                  <td>{s.duration_min} min</td>
                  <td>{SESSION_STATUS_LABEL[s.status] || s.status}</td>
                  <td>
                    {s.summary ? (
                      <Link href={`/startup/sessions/${s.id}`} className="font-semibold text-[#9A7A45]">
                        Available
                      </Link>
                    ) : (
                      'Missing'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );

  const body = () => {
    if (phase === 'loading') return <LoadingBlock label="Loading your sessions…" rows={2} />;
    if (phase === 'error') return <ErrorBlock message={loadError} onRetry={() => setReload(n => n + 1)} />;
    if (tab === 'Calendar') return renderUpcoming();
    return tab === 'Upcoming' ? renderUpcoming() : renderPast();
  };

  return (
    <div>
      {head(
        'Sessions',
        'Book, join and review your mentor conversations.',
        <Link
          href="/startup/mentors/find"
          className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-ink px-4 text-sm font-semibold text-white"
        >
          <Plus size={15} /> Find a mentor
        </Link>
      )}
      {toast && <Toast message={toast} />}

      <div className="mb-5 flex gap-2">
        {['Upcoming', 'Past'].map(x => (
          <button
            onClick={() => setTab(x)}
            key={x}
            type="button"
            className={`min-h-10 rounded-lg px-4 text-xs ${tab === x ? 'bg-ink text-white' : 'border border-[#E5E1D8] bg-white'}`}
          >
            {x}
          </button>
        ))}
      </div>

      {body()}
    </div>
  );
}

function StartupSessionDetailBlock({ sessionId }) {
  const [session, setSession] = useState(null);
  const [mentorship, setMentorship] = useState(null);
  const [phase, setPhase] = useState('loading'); // loading|ready|error|notfound
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState('Notes');
  const [toast, setToast] = useState('');
  const [notes, setNotes] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelErr, setCancelErr] = useState('');

  const notify = (m) => {
    setToast(m);
    setTimeout(() => setToast(''), 2700);
  };

  useEffect(() => {
    if (!sessionId) return undefined;
    let alive = true;
    (async () => {
      setPhase('loading');
      try {
        const data = await api.sessions.get(sessionId);
        if (!alive) return;
        setSession(data);
        try {
          const m = await api.mentorships.get(data.mentorship_id);
          if (alive) setMentorship(m);
        } catch {
          if (alive) setMentorship(null);
        }
        if (alive) setPhase('ready');
      } catch (err) {
        if (!alive) return;
        if (err instanceof ApiError && err.status === 404) {
          setPhase('notfound');
          return;
        }
        setLoadError(err instanceof ApiError ? err.message : 'Could not load this session.');
        setPhase('error');
      }
    })();
    return () => {
      alive = false;
    };
  }, [sessionId]);

  if (phase === 'loading') {
    return <LoadingBlock label="Loading session…" rows={2} />;
  }
  if (phase === 'notfound') {
    return (
      <EmptyBlock title="Session not found" hint="It may have been removed, or you are not part of this mentorship.">
        <Link href="/startup/sessions" className="rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white">
          Back to sessions
        </Link>
      </EmptyBlock>
    );
  }
  if (phase === 'error') {
    return <ErrorBlock message={loadError} onRetry={() => window.location.reload()} />;
  }

  const mentor = mentorship?.mentor;
  const isCancelled = session.status === 'cancelled';

  const doCancel = async () => {
    setCancelErr('');
    if (cancelReason.trim().length < 3) {
      setCancelErr('Please give a reason of at least 3 characters.');
      return;
    }
    try {
      const updated = await api.sessions.cancel(session.id, { reason: cancelReason.trim() });
      setSession(updated);
      setCancelOpen(false);
      notify('Session cancelled.');
    } catch (err) {
      setCancelErr(err instanceof ApiError ? err.message : 'Could not cancel the session.');
    }
  };

  return (
    <div>
      {head(
        session.topic || 'Session',
        `${formatInstant(session.scheduled_at)} IST · ${session.duration_min} minutes · ${session.session_type || 'Session'}`,
        <>
          <button
            type="button"
            onClick={() => {
              if (!session.can_join) {
                notify('Join opens 10 minutes before the session.');
                return;
              }
              if (!session.meeting_url) {
                notify('No meeting link was added to this session.');
                return;
              }
              window.open(session.meeting_url, '_blank', 'noopener,noreferrer');
            }}
            className="min-h-10 rounded-lg bg-ink px-4 text-sm font-semibold text-white"
          >
            <Video className="mr-2 inline" size={15} /> Join session
          </button>
          {!isCancelled && session.status !== 'completed' && (
            <button
              type="button"
              onClick={() => setCancelOpen(true)}
              className="min-h-10 rounded-lg border border-[#E5E1D8] bg-white px-3 text-sm"
            >
              Cancel
            </button>
          )}
        </>
      )}
      {toast && <Toast message={toast} />}

      {isCancelled && (
        <div className="mb-4 rounded-lg border border-[#F1C6C1] bg-[#FEF3F2] p-3 text-xs text-[#7A271A]">
          This session was cancelled{session.cancelled_reason ? `: ${session.cancelled_reason}` : '.'}
        </div>
      )}

      <div className="mb-5 flex gap-2">
        {['Notes', 'Summary'].map(x => (
          <button
            key={x}
            type="button"
            onClick={() => setTab(x)}
            className={`min-h-10 rounded-lg px-4 text-xs ${tab === x ? 'bg-ink text-white' : 'border border-[#E5E1D8] bg-white'}`}
          >
            {x}
          </button>
        ))}
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card title={tab}>
            {tab === 'Notes' ? (
              <>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={10}
                  placeholder="Capture decisions and action items…"
                  className="w-full rounded-lg border border-[#E5E1D8] p-3 text-sm"
                />
                <p className="mt-3 text-xs text-[#4A5568]">
                  Session notes are not stored yet — the notes API lands in a later step, so these
                  stay on this page only.
                </p>
                {session.action_items.length > 0 && (
                  <div className="mt-4 rounded-lg border border-[#E5E1D8] p-4">
                    <h3 className="text-sm font-semibold">Action items from your mentor</h3>
                    {session.action_items.map((item) => (
                      <p key={item} className="mt-2 flex items-center gap-2 text-xs">
                        <CheckCircle2 size={14} className="text-[#9A7A45]" />
                        {item}
                      </p>
                    ))}
                  </div>
                )}
              </>
            ) : session.summary ? (
              <p className="whitespace-pre-line text-sm text-[#4A5568]">{session.summary}</p>
            ) : (
              <EmptyBlock
                title="No summary yet"
                hint="Your mentor records the summary after the session; it will appear here."
              />
            )}
          </Card>
        </div>

        <aside className="space-y-5">
          <Card title="Session details">
            <p className="text-xs"><b>Mentor:</b> {mentor?.display_name || 'Mentor'}</p>
            <p className="mt-2 text-xs">
              <b>Attendees:</b>{' '}
              {session.attendees.map(a => a.display_name).join(', ') || 'none yet'}
            </p>
            <p className="mt-2 text-xs"><b>Time zone:</b> Asia/Kolkata</p>
            <p className="mt-2 text-xs"><b>Status:</b> {SESSION_STATUS_LABEL[session.status] || session.status}</p>
            <p className="mt-4 rounded-lg bg-[#F3EBDD] p-3 text-xs">
              Recording is off unless both sides consent before starting.
            </p>
          </Card>
          {mentorship && (
            <Card title="Mentorship">
              <p className="text-xs text-[#4A5568]">
                {MENTORSHIP_STATUS_LABEL[mentorship.status] || mentorship.status}
                {mentorship.cadence ? ` · ${mentorship.cadence}` : ''}
              </p>
              <Link
                href={`/startup/mentors/${mentorship.id}`}
                className="mt-3 inline-block text-xs font-semibold text-[#9A7A45]"
              >
                Open workspace <ArrowRight className="inline" size={12} />
              </Link>
            </Card>
          )}
        </aside>
      </div>

      {cancelOpen && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[#0F1B2D]/45 p-4">
          <section role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="serif text-2xl font-semibold">Cancel session</h2>
            <p className="mt-2 text-sm text-[#4A5568]">
              Your mentor is notified. A reason is required.
            </p>
            <textarea
              rows={3}
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              placeholder="Why is this session being cancelled?"
              className="mt-3 w-full rounded-lg border border-[#E5E1D8] p-3 text-sm"
            />
            {cancelErr && <FieldError>{cancelErr}</FieldError>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setCancelOpen(false)} className="min-h-10 px-4 text-sm">
                Keep session
              </button>
              <button
                type="button"
                onClick={doCancel}
                className="min-h-10 rounded-lg bg-[#B42318] px-4 text-sm font-semibold text-white"
              >
                Cancel session
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

const READINESS_LABEL = {
  not_started: 'Not started',
  in_progress: 'In progress',
  submitted: 'Submitted for sign-off',
  signed_off: 'Signed off',
  rejected: 'Changes requested'
};

const READINESS_CHIP = {
  signed_off: 'bg-[#E7F3EC] text-[#286749]',
  submitted: 'bg-[#FFF3D6] text-[#8A5700]',
  rejected: 'bg-[#FDECEC] text-[#A33A3A]',
  in_progress: 'bg-[#F3F4F6] text-[#4A5568]',
  not_started: 'bg-[#F3F4F6] text-[#4A5568]'
};

const formatSignedOff = value => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

/** 422 details -> {field: message}, same shape the tasks page uses. */
function readinessFieldErrors(err) {
  const out = {};
  if (err instanceof ApiError && Array.isArray(err.details)) {
    for (const d of err.details) {
      const loc = Array.isArray(d.loc) ? d.loc : [];
      const key = loc[loc.length - 1];
      if (typeof key === 'string' && !out[key]) out[key] = d.msg || 'Invalid value.';
    }
  }
  return out;
}

export default function MentorApp({ page = 'overview', id = 'rhea' }) {
  const [toast, setToast] = useState('');
  const [modal, setModal] = useState('');
  const [tab, setTab] = useState('Overview');
  const [requestSent, setRequestSent] = useState(false);
  const [requestTab, setRequestTab] = useState('Sent');
  const [sessionTab, setSessionTab] = useState('Upcoming');
  const [status, setStatus] = useState(['Signed off', 'Signed off', 'Submitted for sign-off', 'In progress', 'Not started', 'Not started']);
  const [notes, setNotes] = useState('');
  const [visibility, setVisibility] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [expertise, setExpertise] = useState('All expertise');
  const [saved, setSaved] = useState([]);
  const [profileRating, setProfileRating] = useState(0);
  const [mobileNav, setMobileNav] = useState(false);
  const [compact, setCompact] = useState(false);

  // Step 5f readiness page state. `status` above stays as-is for the Step 8
  // blocks; nothing here is shared with them.
  const [readiness, setReadiness] = useState(null); // ReadinessBoard
  // Starts at 'loading': the effect runs after the first paint, and an
  // 'idle' start would flash an empty body under the page header.
  const [readinessPhase, setReadinessPhase] = useState('loading'); // loading|ready|error|none
  const [readinessError, setReadinessError] = useState('');
  const [readinessOrg, setReadinessOrg] = useState(null); // OrganizationRead (my_role)
  const [readinessReload, setReadinessReload] = useState(0);
  const [evidenceFor, setEvidenceFor] = useState(null); // criterion id of the open editor
  const [evidenceDraft, setEvidenceDraft] = useState('');
  const [readinessErrs, setReadinessErrs] = useState({});
  const [readinessFormErr, setReadinessFormErr] = useState('');
  const [readinessBusy, setReadinessBusy] = useState(false); // any in-flight write
  const readinessAlive = useRef(true);

  // --- Step 8a: the mentor directory (read-only) ---------------------------
  // `findPhase` starts 'loading' for the same reason as readinessPhase: the
  // effect runs after first paint, and an 'idle' start would flash an empty
  // grid under the page header.
  const [directory, setDirectory] = useState([]); // MentorDirectoryItem[]
  const [findPhase, setFindPhase] = useState('loading'); // loading|ready|error
  const [findError, setFindError] = useState('');
  // The org the suggestions panel belongs to; '' means "no startup yet".
  const [mentorOrgId, setMentorOrgId] = useState('');
  const [suggestions, setSuggestions] = useState([]); // MentorSuggestionItem[]
  const [suggestPhase, setSuggestPhase] = useState('idle'); // idle|loading|ready|error
  // The "Auto-match me" dialog re-runs the same ranked call so its results and
  // the banner can never disagree.
  const [matchPhase, setMatchPhase] = useState('idle'); // idle|loading|ready|error|no-org
  const [matchError, setMatchError] = useState('');
  const [suggestError, setSuggestError] = useState('');
  const [mentorReload, setMentorReload] = useState(0);
  // The filter sidebar's own controls (Step 8a). Filtering happens through
  // the API, so these drive a refetch rather than a client-side .filter().
  const [industry, setIndustry] = useState('');
  // The Industry box is free text but the list call is rate-limited
  // (60 / 5 min per user), so keystrokes must not each fire a request.
  const [industryTerm, setIndustryTerm] = useState('');
  const [price, setPrice] = useState('any');
  const [sort, setSort] = useState('relevance');
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  // --- Step 8b: mentorship requests (startup side) ---------------------------
  const [requests, setRequests] = useState([]); // MentorshipRead[]
  const [requestsPhase, setRequestsPhase] = useState('loading'); // loading|ready|error
  const [requestsError, setRequestsError] = useState('');
  const [requestsReload, setRequestsReload] = useState(0);
  const [withdrawingId, setWithdrawingId] = useState(null);

  // Request mentorship modal state
  const [targetMentor, setTargetMentor] = useState(null); // { handle, display_name }
  const [requestGoal, setRequestGoal] = useState('');
  const [requestNeeds, setRequestNeeds] = useState('');
  const [requestCadence, setRequestCadence] = useState('Fortnightly');
  const [requestTerms, setRequestTerms] = useState('');
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [requestFormError, setRequestFormError] = useState('');

  // --- Step 8j: Overview page data (startup side) ---------------------------
  const [overviewMentorships, setOverviewMentorships] = useState([]);
  const [overviewSessions, setOverviewSessions] = useState([]);
  const [overviewTasks, setOverviewTasks] = useState([]);
  const [overviewPhase, setOverviewPhase] = useState('loading'); // loading|ready|error
  const [overviewError, setOverviewError] = useState('');
  const [overviewReload, setOverviewReload] = useState(0);

  // The detail page reads one mentor by handle (the route param), never the
  // demo `mentor` object.
  const [profile, setProfile] = useState(null); // MentorDirectoryDetail
  const [profilePhase, setProfilePhase] = useState('loading'); // loading|ready|error|notfound
  const [profileError, setProfileError] = useState('');

  const notify = (s) => {
    setToast(s);
    setTimeout(() => setToast(''), 2700);
  };

  // Dynamic mentor lookup supporting test IDs like 'm-1'
  const mentorId = id === 'm-1' ? 'rhea' : id === 'm-2' ? 'arjun' : id === 'm-3' ? 'naina' : id;
  const mentor = mentors.find(m => m.id === mentorId || m.id === id) || mentors[0];
  const approved = status.filter(s => s === 'Signed off').length;


  // Step 5f: load the readiness board only when this page is open, so no
  // Step 8 page pays for a request it does not use.
  useEffect(() => {
    readinessAlive.current = true;
    return () => { readinessAlive.current = false; };
  }, []);

  useEffect(() => {
    if (page !== 'readiness') return undefined;
    const alive = readinessAlive;
    (async () => {
      setReadinessPhase('loading');
      setReadinessError('');
      let startup = null;
      try {
        const orgs = await api.organizations.mine();
        startup = orgs.find(o => o.type === 'startup') || null;
      } catch (err) {
        if (!alive.current) return;
        setReadinessError(err instanceof ApiError ? err.message : 'Could not load your organization.');
        setReadinessPhase('error');
        return;
      }
      if (!alive.current) return;
      if (!startup) {
        setReadinessPhase('none');
        return;
      }
      setReadinessOrg(startup);
      try {
        const board = await api.readiness.board(startup.id);
        if (!alive.current) return;
        setReadiness(board);
        setReadinessPhase('ready');
      } catch (err) {
        if (!alive.current) return;
        setReadinessError(err instanceof ApiError ? err.message : 'Could not load readiness.');
        setReadinessPhase('error');
      }
    })();
  }, [page, readinessReload]);

  const canEditReadiness = !!readinessOrg && READINESS_EDIT_ROLES.includes(readinessOrg.my_role);

  /** Re-read the board after a write so the score always matches the rows. */
  const reloadReadiness = () => setReadinessReload(n => n + 1);

  /** One write path for every transition: maps 422/409/403 onto the UI. */
  /** One write path: `closeEditorFor` clears the editor on success,
   *  `fieldFor` reopens it when the server flags that field. */
  const runReadinessWrite = async (fn, { toast, closeEditorFor = null, fieldFor = null } = {}) => {
    setReadinessBusy(true);
    setReadinessErrs({});
    setReadinessFormErr('');
    try {
      const item = await fn();
      if (!readinessAlive.current) return null;
      setReadiness(prev => {
        if (!prev) return prev;
        return { ...prev, items: prev.items.map(x => (x.criterion_id === item.criterion_id ? item : x)) };
      });
      reloadReadiness();
      if (toast) notify(toast);
      if (closeEditorFor) {
        setEvidenceFor(null);
        setEvidenceDraft('');
      }
      return item;
    } catch (err) {
      if (!readinessAlive.current) return null;
      const fieldErrs = readinessFieldErrors(err);
      if (Object.keys(fieldErrs).length) {
        setReadinessErrs(fieldErrs);
        // A field error the user cannot see is not an error message: open
        // the evidence editor when that is the offending field.
        if (fieldErrs.evidence && fieldFor) setEvidenceFor(fieldFor);
      } else {
        const msg = err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
        setReadinessFormErr(msg);
        notify(msg);
      }
      return null;
    } finally {
      if (readinessAlive.current) setReadinessBusy(false);
    }
  };

  const openEvidence = item => {
    setEvidenceFor(item.criterion_id);
    setEvidenceDraft(item.evidence || '');
    setReadinessErrs({});
    setReadinessFormErr('');
  };

  const saveEvidence = item => {
    // The server requires evidence before a submission, so an empty save is
    // a dead end for the user: stop it here and mark the field instead of
    // writing a blank row that only fails later.
    if (!evidenceDraft.trim()) {
      setReadinessErrs({ evidence: 'Add evidence before saving, or cancel.' });
      return Promise.resolve(null);
    }
    return runReadinessWrite(
      () => api.readiness.update(readinessOrg.id, item.criterion_id, { evidence: evidenceDraft }),
      { toast: 'Evidence saved.', closeEditorFor: item.criterion_id, fieldFor: item.criterion_id }
    );
  };

  const submitItem = item =>
    runReadinessWrite(() => api.readiness.submit(readinessOrg.id, item.criterion_id), {
      toast: 'Submitted for sign-off.',
      fieldFor: item.criterion_id
    });

  const withdrawItem = item =>
    runReadinessWrite(() => api.readiness.withdraw(readinessOrg.id, item.criterion_id), {
      toast: 'Submission withdrawn.',
      fieldFor: item.criterion_id
    });

  // --- Step 8a: directory, detail and suggestions ---------------------------
  useEffect(() => {
    if (page !== 'find') return undefined;
    const t = setTimeout(() => setIndustryTerm(industry.trim()), 350);
    return () => clearTimeout(t);
  }, [page, industry]);

  useEffect(() => {
    if (page !== 'find') return undefined;
    const t = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [page, searchQuery]);

  useEffect(() => {
    if (page !== 'find') return undefined;
    let alive = true;
    setFindPhase('loading');
    setFindError('');
    (async () => {
      try {
        const pageData = await api.mentors.list({
          limit: 50,
          sort,
          ...(expertise !== 'All expertise' ? { expertise } : {}),
          ...(industryTerm ? { sector: industryTerm } : {}),
          ...(debouncedQuery ? { q: debouncedQuery } : {}),
          ...(verifiedOnly ? { verified_only: true } : {}),
          ...(price === 'free'
            ? { free_only: true }
            : price !== 'any'
            ? { max_fee: Number(price) }
            : {})
        });
        if (!alive) return;
        setDirectory(pageData.items);
        setFindPhase('ready');
      } catch (err) {
        if (!alive) return;
        setFindError(err instanceof ApiError ? err.message : 'Could not load mentors.');
        setFindPhase('error');
      }
    })();
    return () => { alive = false; };
  }, [page, mentorReload, sort, expertise, industryTerm, debouncedQuery, verifiedOnly, price]);

  // The suggestions panel needs one of MY startups. A user with none simply
  // gets no panel — not an empty one pretending a match ran.
  useEffect(() => {
    if (page !== 'find') return undefined;
    let alive = true;
    setSuggestPhase('loading');
    setSuggestError('');
    (async () => {
      let org = null;
      try {
        const orgs = await api.organizations.mine();
        org = orgs.find(o => o.type === 'startup') || null;
      } catch (err) {
        if (!alive) return;
        setSuggestError(err instanceof ApiError ? err.message : 'Could not load your startup.');
        setSuggestPhase('error');
        return;
      }
      if (!alive) return;
      if (!org) {
        setMentorOrgId('');
        setSuggestions([]);
        setSuggestPhase('idle');
        return;
      }
      setMentorOrgId(org.id);
      try {
        const data = await api.mentors.suggestions(org.id, { limit: 6 });
        if (!alive) return;
        setSuggestions(data.items);
        setSuggestPhase('ready');
      } catch (err) {
        if (!alive) return;
        // 403 = the caller is not an active member of that startup (a
        // jobseeker, say). Suggestions are a bonus, not the page, so the
        // panel is simply absent for them rather than an error banner.
        if (err instanceof ApiError && err.status === 403) {
          setSuggestions([]);
          setSuggestPhase('idle');
          return;
        }
        setSuggestError(err instanceof ApiError ? err.message : 'Could not load suggestions.');
        setSuggestPhase('error');
      }
    })();
    return () => { alive = false; };
  }, [page, mentorReload]);

  /**
   * "See matches" — the only write-free action the directory owns. Refetches
   * the ranked list and mirrors it into the banner state, then renders the
   * server's own match_reasons. No count is invented: if the list is empty the
   * dialog says so.
   */
  const runMatch = async () => {
    if (!mentorOrgId) {
      setMatchPhase('no-org');
      return;
    }
    setMatchPhase('loading');
    setMatchError('');
    try {
      const data = await api.mentors.suggestions(mentorOrgId, { limit: 6 });
      setSuggestions(data.items);
      setSuggestPhase('ready');
      setMatchPhase('ready');
    } catch (err) {
      setMatchError(err instanceof ApiError ? err.message : 'Could not load suggestions.');
      setMatchPhase('error');
    }
  };

  // The detail page: one mentor by the route handle.
  useEffect(() => {
    if (page !== 'mentor-profile') return undefined;
    let alive = true;
    setProfilePhase('loading');
    setProfileError('');
    (async () => {
      try {
        const data = await api.mentors.get(id);
        if (!alive) return;
        setProfile(data);
        setProfilePhase('ready');
      } catch (err) {
        if (!alive) return;
        // 404 covers both "no such mentor" and "hidden by profile_public" —
        // the API does not distinguish them, so neither do we.
        if (err instanceof ApiError && err.status === 404) {
          setProfilePhase('notfound');
          return;
        }
        setProfileError(err instanceof ApiError ? err.message : 'Could not load this mentor.');
        setProfilePhase('error');
      }
    })();
    return () => { alive = false; };
  }, [page, id, mentorReload]);

  // --- Step 8b: mentorship requests list (startup side) -----------------------
  useEffect(() => {
    if (page !== 'requests') return undefined;
    let alive = true;
    setRequestsPhase('loading');
    setRequestsError('');
    (async () => {
      try {
        const pageData = await api.mentorships.list({ side: 'startup', limit: 50 });
        if (!alive) return;
        setRequests(pageData.items);
        setRequestsPhase('ready');
      } catch (err) {
        if (!alive) return;
        setRequestsError(err instanceof ApiError ? err.message : 'Could not load mentorship requests.');
        setRequestsPhase('error');
      }
    })();
    return () => { alive = false; };
  }, [page, requestsReload]);

  const handleWithdraw = async (mentorshipId) => {
    if (!mentorshipId || withdrawingId) return;
    if (!window.confirm('Are you sure you want to withdraw this mentorship request?')) {
      return;
    }
    setWithdrawingId(mentorshipId);
    try {
      await api.mentorships.cancel(mentorshipId, { note: 'Withdrawn by startup' });
      notify('Mentorship request withdrawn.');
      setRequestsReload(n => n + 1);
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not withdraw request.');
    } finally {
      setWithdrawingId(null);
    }
  };

  // Always resolve active startup organization so any page can initiate requests
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const orgs = await api.organizations.mine();
        const org = orgs.find(o => o.type === 'startup') || orgs[0] || null;
        if (!alive || !org) return;
        setMentorOrgId(org.id);
      } catch {
        // ignore
      }
    })();
    return () => { alive = false; };
  }, []);

  // --- Step 8j: Overview page loader ---------------------------------------
  useEffect(() => {
    if (page !== 'overview') return undefined;
    let alive = true;
    setOverviewPhase('loading');
    setOverviewError('');
    (async () => {
      try {
        const orgs = await api.organizations.mine();
        const startup = orgs.find(o => o.type === 'startup') || orgs[0] || null;
        if (!alive) return;
        if (startup) {
          setReadinessOrg(startup);
          setMentorOrgId(startup.id);
        }

        const [mentorshipsRes, sessionsRes, tasksRes, readinessRes] = await Promise.allSettled([
          api.mentorships.list({ side: 'startup', limit: 50 }),
          api.sessions.list({ limit: 50 }),
          startup ? api.tasks.list(startup.id, { limit: 20 }) : Promise.resolve({ items: [] }),
          startup ? api.readiness.board(startup.id) : Promise.resolve(null),
        ]);

        if (!alive) return;

        if (mentorshipsRes.status === 'fulfilled') {
          setOverviewMentorships(mentorshipsRes.value.items || []);
        }
        if (sessionsRes.status === 'fulfilled') {
          setOverviewSessions(sessionsRes.value.items || []);
        }
        if (tasksRes.status === 'fulfilled') {
          setOverviewTasks(tasksRes.value.items || []);
        }
        if (readinessRes.status === 'fulfilled' && readinessRes.value) {
          setReadiness(readinessRes.value);
        }

        setOverviewPhase('ready');
      } catch (err) {
        if (!alive) return;
        setOverviewError(err instanceof ApiError ? err.message : 'Could not load overview data.');
        setOverviewPhase('error');
      }
    })();
    return () => { alive = false; };
  }, [page, overviewReload]);

  const openRequestModal = (m) => {
    setTargetMentor(m);
    setRequestGoal('');
    setRequestNeeds('');
    setRequestCadence('Fortnightly');
    setRequestTerms('');
    setRequestFormError('');
    setModal('request');
  };

  const handleSendRequest = async (e) => {
    if (e) e.preventDefault();
    if (!targetMentor || requestSubmitting) return;

    const cleanGoal = requestGoal.trim();
    if (cleanGoal.length < 10) {
      setRequestFormError('Please describe your mentorship goal in at least 10 characters.');
      return;
    }

    let orgId = mentorOrgId;
    if (!orgId) {
      try {
        const orgs = await api.organizations.mine();
        const org = orgs.find(o => o.type === 'startup') || orgs[0] || null;
        if (org) {
          orgId = org.id;
          setMentorOrgId(org.id);
        }
      } catch {
        // handle below
      }
    }

    if (!orgId) {
      setRequestFormError('You must belong to a startup organization to request mentorship.');
      return;
    }

    const needsList = requestNeeds
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    setRequestSubmitting(true);
    setRequestFormError('');
    try {
      await api.mentorships.create(orgId, {
        mentor_handle: targetMentor.handle,
        goal: cleanGoal,
        ...(needsList.length ? { needs: needsList } : {}),
        ...(requestCadence ? { cadence: requestCadence } : {}),
        ...(requestTerms.trim() ? { terms: requestTerms.trim() } : {}),
      });
      notify(`Mentorship request sent to ${targetMentor.display_name}.`);
      setModal('');
      setRequestSent(true);
      setRequestsReload(n => n + 1);
    } catch (err) {
      setRequestFormError(err instanceof ApiError ? err.message : 'Could not send mentorship request.');
    } finally {
      setRequestSubmitting(false);
    }
  };

  /** Money from NUMERIC -> string, with the row's own ISO currency. */
  const feeLabel = (m) => {
    if (!m.hourly_fee) return 'Free / pro bono';
    try {
      return `${new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: m.currency || 'INR',
        maximumFractionDigits: 0
      }).format(Number(m.hourly_fee))} / hour`;
    } catch {
      return `${m.hourly_fee} / hour`;
    }
  };

  /**
   * The server already filtered, so this is only the "nothing matched these
   * filters" guard — it must not re-filter, or the count and the cards could
   * disagree with the API.
   */
  const visibleMentors = directory;

  const initialsFor = (name) =>
    (name || '?').split(' ').map(x => x[0]).filter(Boolean).slice(0, 2).join('');

  const head = (title, sub, action) => (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-sm text-[#4A5568]">Acme Studio <span className="mx-2 text-[#B8955A]">·</span> Mentorship</p>
        <h1 className="serif mt-1 text-[30px] font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-[#4A5568]">{sub}</p>
      </div>
      {action}
    </div>
  );

  // Step 8a: a real mentor card. `m` is a MentorDirectoryItem (optionally a
  // MentorSuggestionItem, which adds match_reasons).
  // Deliberately ABSENT: the review count (8i has no table yet) and the next
  // free slot (8c has no availability table) — both are hidden rather than
  // filled with plausible-looking numbers.
  const mentorCard = (m) => (
    <article key={m.handle} className="rounded-xl border border-[#E5E1D8] bg-white p-5 transition hover:border-[#A0A7B4]">
      <div className="flex items-start gap-4">
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-[#F3EBDD] font-serif text-xl font-semibold text-[#806236]">
          {initialsFor(m.display_name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">{m.display_name}</h2>
            {m.is_verified && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#F3EBDD] px-2 py-1 text-[10px] font-semibold text-[#806236]">
                <CheckCircle2 size={12} /> Verified mentor
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-[#4A5568]">{m.headline}</p>
          <p className="mt-1 text-xs">
            {m.rating != null ? (
              <>
                <Star className="mr-1 inline fill-[#B8955A] text-[#B8955A]" size={13} />
                {m.rating}
                <span className="text-[#4A5568]">
                  {m.sessions_completed > 0 ? ` · ${m.sessions_completed} sessions` : ''}
                </span>
              </>
            ) : (
              <span className="text-[#4A5568]">Not yet rated</span>
            )}
          </p>
          {m.location && (
            <p className="mt-1 text-xs text-[#4A5568]">
              <MapPin className="mr-1 inline" size={12} />{m.location}
            </p>
          )}
        </div>
      </div>
      {/* Why this mentor surfaced. On the suggestions list these are real
          server-computed reasons; the plain directory has none, so the line
          is omitted rather than filled with invented copy. */}
      {(m.match_reasons || []).length > 0 && (
        <p className="mt-3 text-xs leading-5 text-[#4A5568]">{m.match_reasons.join(' · ')}</p>
      )}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {(m.expertise || []).map(t => (
          <span key={t} className="rounded-full bg-[#F3F4F6] px-2.5 py-1 text-[10px]">{t}</span>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E1D8] pt-3">
        <span className="text-xs">
          <b>{feeLabel(m)}</b>
        </span>
        <div className="flex gap-2">
          <Link href={`/startup/mentors/find/${m.handle}`} className="inline-flex min-h-9 items-center rounded-lg border border-[#E5E1D8] px-3 text-xs font-semibold">
            View profile
          </Link>
          <button
            type="button"
            onClick={() => openRequestModal(m)}
            disabled={!m.accepting_requests}
            className="min-h-9 rounded-lg bg-ink px-3 text-xs font-semibold text-white disabled:opacity-50"
          >
            {m.accepting_requests ? 'Request mentorship' : 'Not accepting'}
          </button>
        </div>
      </div>
    </article>
  );

  return (
    <div className="min-h-screen bg-[#FAF8F4] text-[#0F1B2D]">
      <a href="#mentor-main" className="sr-only focus:not-sr-only">Skip to content</a>

      {/* Shared Startup Sidebar */}
      <StartupSidebar
        active="Mentor"
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

      <main id="mentor-main" className={`mx-auto max-w-[1440px] px-4 pb-24 pt-7 transition-[margin] duration-200 sm:px-7 lg:px-8 ${compact ? 'lg:ml-[76px]' : 'lg:ml-[240px]'}`}>
        {/* Secondary section navigation */}
        <SubNavTabs
          items={[
            ['Overview', '/startup/mentors', page === 'overview'],
            ['Find mentors', '/startup/mentors/find', page === 'find' || page === 'mentor-profile'],
            ['Requests', '/startup/mentors/requests', page === 'requests'],
            ['Sessions', '/startup/sessions', page === 'sessions' || page === 'session'],
            ['Readiness', '/startup/readiness', page === 'readiness'],
          ]}
        />
        {page === 'overview' && (() => {
          if (overviewPhase === 'loading') {
            return (
              <>
                {head(
                  'Mentors',
                  'Find the right guidance and make meaningful progress toward readiness.',
                  <Link href="/startup/mentors/find" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-ink px-4 text-sm font-semibold text-white">
                    <Search size={15} /> Find a mentor
                  </Link>
                )}
                <div className="py-16 text-center text-sm text-[#4A5568]">
                  Loading mentor overview...
                </div>
              </>
            );
          }

          if (overviewPhase === 'error') {
            return (
              <>
                {head(
                  'Mentors',
                  'Find the right guidance and make meaningful progress toward readiness.',
                  <Link href="/startup/mentors/find" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-ink px-4 text-sm font-semibold text-white">
                    <Search size={15} /> Find a mentor
                  </Link>
                )}
                <div className="rounded-xl border border-[#F0C9C9] bg-[#FDECEC] p-4 text-xs text-[#A33A3A]" role="alert">
                  <p className="font-semibold">Could not load overview</p>
                  <p className="mt-1">{overviewError || 'An unexpected error occurred.'}</p>
                  <button
                    type="button"
                    onClick={() => setOverviewReload(n => n + 1)}
                    className="mt-3 inline-block rounded-md bg-[#A33A3A] px-3 py-1.5 text-xs font-medium text-white"
                  >
                    Retry
                  </button>
                </div>
              </>
            );
          }

          const activeMentorships = overviewMentorships.filter(m => m.status === 'active');
          const pendingRequests = overviewMentorships.filter(m => m.status === 'requested');
          const completedSessionsCount = overviewSessions.filter(s => s.status === 'completed').length;
          const dueTasks = overviewTasks.filter(t => t.status === 'todo' || t.status === 'in_progress');

          const readinessSummary = readiness?.summary;
          const readinessSignedOff = readinessSummary ? readinessSummary.criteria_signed_off : 0;
          const readinessTotal = readinessSummary ? readinessSummary.criteria_total : 6;
          const readinessPct = readinessSummary ? readinessSummary.readiness_pct : 0;
          const readinessItems = readiness?.items || [];

          const upcomingSessions = overviewSessions
            .filter(s => s.status === 'scheduled' && new Date(s.scheduled_at) > new Date())
            .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
          const nextSession = upcomingSessions[0] || null;

          const stageName = readinessOrg?.stage ? (STAGE_LABEL[readinessOrg.stage] || readinessOrg.stage) : 'Prototype';

          return (
            <>
              {head(
                'Mentors',
                'Find the right guidance and make meaningful progress toward readiness.',
                <Link href="/startup/mentors/find" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-ink px-4 text-sm font-semibold text-white">
                  <Search size={15} /> Find a mentor
                </Link>
              )}

              <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ['Active mentors', String(activeMentorships.length)],
                  ['Sessions held', String(completedSessionsCount)],
                  ['Deliverables due', String(dueTasks.length)],
                  ['Readiness', `${readinessSignedOff} / ${readinessTotal}`],
                ].map(([n, v]) => (
                  <div key={n} className="rounded-xl border border-[#E5E1D8] bg-white p-4">
                    <p className="text-xs text-[#4A5568]">{n}</p>
                    <b className="serif mt-1 block text-2xl">{v}</b>
                  </div>
                ))}
              </div>

              <div className="grid items-start gap-5 xl:grid-cols-3">
                <div className="space-y-5 xl:col-span-2">
                  <Card title="My mentors" action={<Link href="/startup/mentors/find" className="text-xs font-semibold text-[#9A7A45]">Find another <ArrowRight className="inline" size={13} /></Link>}>
                    {activeMentorships.length === 0 ? (
                      <div className="py-6 text-center">
                        <p className="text-sm font-medium text-[#4A5568]">No active mentors yet.</p>
                        <p className="mt-1 text-xs text-[#718096]">Browse our directory of verified advisors to request mentorship.</p>
                        <Link href="/startup/mentors/find" className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2 text-xs font-semibold text-white">
                          Find a mentor <ArrowRight size={13} />
                        </Link>
                      </div>
                    ) : (
                      <div className="divide-y divide-[#E5E1D8]">
                        {activeMentorships.map(m => (
                          <div key={m.id} className="flex flex-wrap items-center gap-4 py-3 first:pt-0 last:pb-0">
                            <span className="grid h-14 w-14 place-items-center rounded-full bg-[#F3EBDD] font-semibold text-[#806236]">
                              {m.mentor?.avatar_initials || (m.mentor?.display_name ? m.mentor.display_name.slice(0, 2).toUpperCase() : 'M')}
                            </span>
                            <div className="min-w-[160px] flex-1">
                              <h3 className="font-semibold">
                                {m.mentor?.display_name || 'Mentor'}
                                <span className="ml-1.5 rounded-full bg-[#E7F3EC] px-2 py-0.5 text-[10px] font-medium text-[#286749]">Active</span>
                              </h3>
                              <p className="mt-1 text-xs text-[#4A5568]">
                                {m.cadence || 'Flexible cadence'}{m.goal ? ` · ${m.goal}` : ''}
                              </p>
                              {m.next_session_at ? (
                                <p className="mt-1 text-xs text-[#4A5568]">
                                  Next session: {new Date(m.next_session_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                </p>
                              ) : null}
                            </div>
                            <Link href={`/startup/mentors/${m.id}`} className="rounded-lg bg-ink px-3 py-2.5 text-xs font-semibold text-white">
                              Open workspace
                            </Link>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>

                  <Card title="Readiness sign-off progress" action={<Link href="/startup/readiness" className="text-xs font-semibold text-[#9A7A45]">Open readiness <ArrowRight className="inline" size={13} /></Link>}>
                    <div className="mb-4 flex items-center justify-between text-xs">
                      <span>{readinessSignedOff} of {readinessTotal} items signed off</span>
                      <b>{readinessPct}%</b>
                    </div>
                    <div className="mb-4 h-2 rounded-full bg-[#E5E1D8]">
                      <div className="h-full rounded-full bg-[#B8955A] transition-all" style={{ width: `${readinessPct}%` }} />
                    </div>
                    {readinessItems.length === 0 ? (
                      <p className="text-xs text-[#4A5568]">No readiness criteria configured yet.</p>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {readinessItems.map(c => {
                          const isSignedOff = c.status === 'signed_off';
                          return (
                            <div key={c.id || c.title} className="flex items-center gap-2 rounded-lg bg-[#FAF8F4] p-2.5 text-xs">
                              <span className={isSignedOff ? 'text-[#2E7D5B]' : 'text-[#B7791F]'}>
                                {isSignedOff ? <CheckCircle2 size={15} /> : <Clock size={15} />}
                              </span>
                              <span className="flex-1 truncate">{c.title}</span>
                              <small className="text-[#4A5568]">{READINESS_LABEL[c.status] || c.status}</small>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {readinessSummary?.is_ready && (
                      <div className="mt-4 rounded-lg bg-[#F3EBDD] p-4 text-sm font-semibold text-[#806236]">
                        <ShieldCheck className="mr-2 inline" size={17} />Investment Ready · Make your profile visible to investors
                      </div>
                    )}
                  </Card>

                  <Card title="Deliverables due" action={<Link href="/startup/tasks" className="text-xs font-semibold text-[#9A7A45]">Open tasks</Link>}>
                    {dueTasks.length === 0 ? (
                      <div className="py-6 text-center text-xs text-[#4A5568]">
                        No pending deliverables due.
                      </div>
                    ) : (
                      <div className="divide-y divide-[#E5E1D8]">
                        {dueTasks.slice(0, 5).map(t => (
                          <div key={t.id} className="flex flex-wrap items-center gap-3 py-3">
                            <ClipboardCheck size={16} className="text-[#9A7A45]" />
                            <span className="flex-1 text-xs font-medium">
                              {t.title}
                            </span>
                            {t.due_on ? (
                              <span className="text-[10px] text-[#4A5568]">Due {t.due_on}</span>
                            ) : null}
                            <span className="rounded-full bg-[#F3F4F6] px-2 py-1 text-[10px] capitalize">
                              {t.status.replace('_', ' ')}
                            </span>
                            <Link href="/startup/tasks" className="text-xs font-semibold text-[#9A7A45]">
                              View
                            </Link>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </div>

                <aside className="space-y-5">
                  <Card title="Next session">
                    {nextSession ? (
                      <>
                        <p className="text-xs text-[#4A5568]">
                          {new Date(nextSession.scheduled_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} · {new Date(nextSession.scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        </p>
                        <h3 className="mt-2 font-semibold">{nextSession.topic || 'Mentoring Session'}</h3>
                        <p className="mt-1 text-xs text-[#4A5568]">
                          {nextSession.duration_min} minutes
                          {nextSession.attendees?.length ? ` · ${nextSession.attendees.map(a => a.display_name).join(', ')}` : ''}
                        </p>
                        <div className="mt-4 flex gap-2">
                          {nextSession.meeting_url ? (
                            <a
                              href={nextSession.meeting_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 rounded-lg bg-ink py-2.5 text-center text-xs font-semibold text-white"
                            >
                              Join session
                            </a>
                          ) : (
                            <Link href="/startup/sessions" className="flex-1 rounded-lg bg-ink py-2.5 text-center text-xs font-semibold text-white">
                              View session
                            </Link>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-[#4A5568]">No upcoming sessions scheduled.</p>
                        <Link href="/startup/sessions" className="mt-3 block text-xs font-semibold text-[#9A7A45]">
                          Manage sessions <ArrowRight className="inline" size={13} />
                        </Link>
                      </>
                    )}
                  </Card>

                  <Card title="Open requests">
                    {pendingRequests.length > 0 ? (
                      <>
                        <p className="text-xs text-[#4A5568]">
                          You have {pendingRequests.length} pending request{pendingRequests.length > 1 ? 's' : ''} awaiting mentor response.
                        </p>
                        <div className="mt-2 space-y-1.5">
                          {pendingRequests.slice(0, 2).map(r => (
                            <div key={r.id} className="text-xs">
                              <span className="font-semibold">{r.mentor?.display_name || 'Mentor'}</span>
                              <span className="ml-2 inline-block rounded-full bg-[#FFF3D6] px-2 py-0.5 text-[10px] text-[#8A5700]">
                                Requested
                              </span>
                            </div>
                          ))}
                        </div>
                        <Link href="/startup/mentors/requests" className="mt-3 block text-xs font-semibold text-[#9A7A45]">
                          View requests <ArrowRight className="inline" size={13} />
                        </Link>
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-[#4A5568]">No pending mentor requests.</p>
                        <Link href="/startup/mentors/find" className="mt-3 block text-xs font-semibold text-[#9A7A45]">
                          Find mentors <ArrowRight className="inline" size={13} />
                        </Link>
                      </>
                    )}
                  </Card>

                  <Card title={`A tip for ${stageName}`}>
                    <p className="text-xs leading-5 text-[#4A5568]">
                      Mentors at this stage often focus on user feedback, defining the first repeatable use case and preparing a revenue plan.
                    </p>
                    <Link href="/startup/stage" className="mt-3 inline-block text-xs font-semibold text-[#9A7A45]">
                      Review stage goals <ArrowRight className="inline" size={13} />
                    </Link>
                  </Card>
                </aside>
              </div>
            </>
          );
        })()}

        {page === 'find' && (
          <>
            {head(
              'Find mentors',
              'Browse verified advisors matched to your startup stage and goals.',
              <>
                <button type="button" onClick={() => setModal('match')} className="min-h-10 rounded-lg border border-[#E5E1D8] bg-white px-3 text-sm font-semibold">
                  Auto-match me
                </button>
                <Link href="/startup/mentors/requests" className="inline-flex min-h-10 items-center rounded-lg bg-ink px-3 text-sm font-semibold text-white">
                  My requests
                </Link>
              </>
            )}

            {/* Step 8a: real suggestions for THIS startup. The panel states
                plainly that stage is not a matching attribute yet (the API
                returns stage_filter_applied:false) instead of implying one. */}
            {suggestPhase === 'ready' && suggestions.length > 0 && (
              <div className="mb-5 rounded-xl border border-[#E7D4B0] bg-[#F3EBDD] p-4 text-sm">
                <b>Recommended for your startup</b>
                <p className="mt-1 text-xs text-[#4A5568]">
                  Ranked by what you told us you need. You choose whether to contact anyone.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {suggestions.slice(0, 3).map(s => (
                    <Link
                      key={s.handle}
                      href={`/startup/mentors/find/${s.handle}`}
                      className="rounded-full border border-[#E7D4B0] bg-white px-3 py-1 text-xs font-semibold"
                    >
                      {s.display_name}
                      {s.match_reasons?.length ? <span className="ml-1 font-normal text-[#4A5568]">· {s.match_reasons[0]}</span> : null}
                    </Link>
                  ))}
                </div>
                {suggestions[0]?.match_reasons?.length ? null : (
                  <p className="mt-2 text-[11px] text-[#4A5568]">
                    No specific matches yet — these are mentors open to requests.
                  </p>
                )}
              </div>
            )}
            {suggestPhase === 'error' && (
              <div className="mb-5 rounded-xl border border-[#E5E1D8] bg-white p-3 text-xs text-[#9A3A3A]" role="alert">
                {suggestError}
              </div>
            )}

            <div className="grid items-start gap-5 lg:grid-cols-4">
              <aside className="rounded-xl border border-[#E5E1D8] bg-white p-5">
                <h2 className="font-semibold">Filters</h2>
                <label className="mt-4 block text-xs font-medium">
                  Expertise
                  <select
                    value={expertise}
                    onChange={e => setExpertise(e.target.value)}
                    className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-3"
                  >
                    <option>All expertise</option>
                    {EXPERTISE_OPTIONS.map(x => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
                <label className="mt-4 block text-xs font-medium">
                  Industry
                  <input
                    value={industry}
                    onChange={e => setIndustry(e.target.value)}
                    placeholder="Fintech, SaaS…"
                    className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] px-3"
                  />
                </label>
                {/* "Stage fit" and "Availability" are hidden (Step 8a plan):
                    mentors have no stage attribute yet (8a D-1) and no
                    availability table until 8c, so both controls had nothing
                    to filter on. Showing them would be a control that
                    silently does nothing. */}
                <label className="mt-4 block text-xs font-medium">
                  Price
                  <select
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-3"
                  >
                    <option value="any">Any price</option>
                    <option value="free">Free / pro bono</option>
                    <option value="3000">Under ₹3,000 / hour</option>
                    <option value="6000">Under ₹6,000 / hour</option>
                  </select>
                </label>
                <label className="mt-4 flex gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={verifiedOnly}
                    onChange={e => setVerifiedOnly(e.target.checked)}
                    className="accent-ink"
                  />
                  Verified mentors only
                </label>
                <p className="mt-4 text-[10px] leading-4 text-[#4A5568]">We do not filter by age, gender, religion, caste or nationality.</p>
              </aside>

              <div className="space-y-4 lg:col-span-3">
                {/* Search Bar */}
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7B8CA3]"
                    size={17}
                    aria-hidden="true"
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Escape') {
                        setSearchQuery('');
                        setDebouncedQuery('');
                      } else if (e.key === 'Enter') {
                        e.preventDefault();
                        setDebouncedQuery(searchQuery.trim());
                      }
                    }}
                    placeholder="Search mentors by name, headline, bio, or skills…"
                    aria-label="Search mentors"
                    className="h-11 w-full rounded-xl border border-[#E5E1D8] bg-white pl-10 pr-10 text-sm placeholder-[#94A3B8] shadow-sm transition-colors focus:border-[#B8955A] focus:outline-none focus:ring-1 focus:ring-[#B8955A]"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setDebouncedQuery('');
                      }}
                      aria-label="Clear search"
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#7B8CA3] transition-colors hover:bg-[#F3EBDD] hover:text-ink"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#4A5568]">
                  <span>
                    {findPhase === 'loading'
                      ? 'Loading mentors…'
                      : findPhase === 'error'
                      ? 'Mentors unavailable'
                      : debouncedQuery
                      ? `${visibleMentors.length} mentor${visibleMentors.length === 1 ? '' : 's'} matching "${debouncedQuery}"`
                      : `${visibleMentors.length} mentor${visibleMentors.length === 1 ? '' : 's'} match`}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#7B8CA3]">Sort by:</span>
                    <select
                      value={sort}
                      onChange={e => setSort(e.target.value)}
                      aria-label="Sort mentors"
                      className="rounded-lg border border-[#E5E1D8] bg-white px-2.5 py-1 text-xs text-ink shadow-sm focus:border-[#B8955A] focus:outline-none"
                    >
                      <option value="relevance">Best match</option>
                      <option value="rating">Rating</option>
                      <option value="price">Price</option>
                      <option value="experience">Experience</option>
                    </select>
                  </div>
                </div>

                {findPhase === 'loading' && (
                  <div className="space-y-3" aria-busy="true" role="status">
                    {[0, 1].map(i => (
                      <div key={i} className="h-40 animate-pulse rounded-xl bg-[#F4F1EA]" />
                    ))}
                    <span className="sr-only">Loading mentors…</span>
                  </div>
                )}
                {findPhase === 'error' && (
                  <div className="rounded-xl border border-[#E5E1D8] bg-white p-8 text-center" role="alert">
                    <p className="text-sm text-[#4A5568]">{findError}</p>
                    <button
                      type="button"
                      onClick={() => setMentorReload(n => n + 1)}
                      className="mt-3 min-h-9 rounded-lg bg-ink px-4 text-sm font-semibold text-white"
                    >
                      Retry
                    </button>
                  </div>
                )}
                {findPhase === 'ready' && directory.length === 0 && (
                  <div className="rounded-xl border border-[#E5E1D8] bg-white p-8 text-center text-sm text-[#4A5568]" role="status">
                    {debouncedQuery || industry || expertise !== 'All expertise' || price !== 'any' || verifiedOnly ? (
                      <div className="flex flex-col items-center gap-3">
                        <p>No mentors match your search and filter criteria.</p>
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery('');
                            setDebouncedQuery('');
                            setIndustry('');
                            setIndustryTerm('');
                            setExpertise('All expertise');
                            setPrice('any');
                            setVerifiedOnly(false);
                          }}
                          className="min-h-9 rounded-lg border border-[#E5E1D8] bg-white px-4 text-xs font-semibold text-ink shadow-sm transition-colors hover:bg-[#F4F1EA]"
                        >
                          Clear search and filters
                        </button>
                      </div>
                    ) : (
                      'No mentors are listed yet. Verified advisors appear here once their profiles are public.'
                    )}
                  </div>
                )}
                {findPhase === 'ready' && directory.length > 0 && visibleMentors.length === 0 && (
                  <div className="rounded-xl border border-[#E5E1D8] bg-white p-8 text-center text-sm text-[#4A5568]" role="status">
                    No mentors match these filters. Try widening them.
                  </div>
                )}
                {findPhase === 'ready' && visibleMentors.map(mentorCard)}
              </div>
            </div>
          </>
        )}

        {page === 'mentor-profile' && (
          <>
            {profilePhase === 'loading' && (
              <div className="mb-6 space-y-3" aria-busy="true" role="status">
                <div className="h-4 w-40 animate-pulse rounded bg-[#F4F1EA]" />
                <div className="h-9 w-72 animate-pulse rounded bg-[#F4F1EA]" />
                <span className="sr-only">Loading mentor…</span>
              </div>
            )}
            {profilePhase === 'loading' && (
              <div className="grid items-start gap-5 xl:grid-cols-3">
                <div className="h-72 animate-pulse rounded-xl bg-[#F4F1EA] xl:col-span-2" />
                <div className="h-56 animate-pulse rounded-xl bg-[#F4F1EA]" />
              </div>
            )}

            {profilePhase === 'notfound' && (
              <>
                {head('Mentor not found', 'This profile is not available.', <Link href="/startup/mentors/find" className="text-sm text-[#9A7A45]">← Back to mentors</Link>)}
                <div className="rounded-xl border border-[#E5E1D8] bg-white p-8 text-center text-sm text-[#4A5568]" role="status">
                  This mentor may no longer be listed, or their profile is not public.
                </div>
              </>
            )}

            {profilePhase === 'error' && (
              <>
                {head('Mentor unavailable', 'We could not load this profile.', <Link href="/startup/mentors/find" className="text-sm text-[#9A7A45]">← Back to mentors</Link>)}
                <div className="rounded-xl border border-[#E5E1D8] bg-white p-8 text-center" role="alert">
                  <p className="text-sm text-[#4A5568]">{profileError}</p>
                  <button type="button" onClick={() => setMentorReload(n => n + 1)} className="mt-3 min-h-9 rounded-lg bg-ink px-4 text-sm font-semibold text-white">
                    Retry
                  </button>
                </div>
              </>
            )}

            {profilePhase === 'ready' && profile && (
              <>
                {head(
                  profile.display_name,
                  profile.headline,
                  <Link href="/startup/mentors/find" className="text-sm text-[#9A7A45]">
                    ← Back to mentors
                  </Link>
                )}
                <div className="grid items-start gap-5 xl:grid-cols-3">
                  <div className="space-y-5 xl:col-span-2">
                    <Card title="About">
                      <div className="flex items-start gap-4">
                        <span className="grid h-16 w-16 place-items-center rounded-full bg-[#F3EBDD] font-serif text-xl font-semibold">
                          {initialsFor(profile.display_name)}
                        </span>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <b>{profile.display_name}</b>
                            {profile.is_verified && (
                              <span className="rounded-full bg-[#F3EBDD] px-2 py-1 text-[10px] text-[#806236]">
                                <ShieldCheck className="mr-1 inline" size={12} />Verified mentor
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-[#4A5568]">{profile.headline}</p>
                          <p className="mt-2 text-xs">
                            {profile.location && (
                              <>
                                <MapPin className="mr-1 inline" size={12} />{profile.location}
                              </>
                            )}
                            {profile.location && profile.languages?.length ? ' · ' : null}
                            {profile.languages?.join(', ')}
                          </p>
                          <p className="mt-2 text-xs">
                            {profile.rating != null ? (
                              <>
                                <Star className="mr-1 inline fill-[#B8955A] text-[#B8955A]" size={13} />
                                {profile.rating}
                                {profile.sessions_completed > 0 ? ` · ${profile.sessions_completed} sessions delivered` : ''}
                              </>
                            ) : (
                              <span className="text-[#4A5568]">Not yet rated</span>
                            )}
                          </p>
                        </div>
                      </div>
                      {profile.bio && (
                        <p className="mt-5 text-sm leading-7 text-[#4A5568]">{profile.bio}</p>
                      )}
                    </Card>

                    <Card title="How I can help">
                      {profile.expertise?.length ? (
                        <div className="grid gap-3 sm:grid-cols-2">
                          {profile.expertise.map(x => (
                            <div key={x} className="rounded-lg bg-[#FAF8F4] p-3">
                              <b className="text-sm">{x}</b>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-[#4A5568]">No expertise areas listed yet.</p>
                      )}
                      {profile.sectors?.length ? (
                        <p className="mt-3 text-xs text-[#4A5568]">
                          Works with: {profile.sectors.join(', ')}
                        </p>
                      ) : null}
                    </Card>

                    {/* Step 8a: the demo page's prose here (career history,
                        "verified by Forma") had no backing table. The only
                        real signal is years of experience, so the card shows
                        that and nothing else. */}
                    <Card title="Experience">
                      {profile.years_experience != null ? (
                        <p className="text-sm font-medium">{profile.years_experience} years of experience</p>
                      ) : (
                        <p className="text-sm text-[#4A5568]">No experience details listed yet.</p>
                      )}
                    </Card>

                    {/* Reviews arrive with step 8i (no reviews table exists).
                        An empty state, never invented quotes. */}
                    <Card title="Reviews">
                      <p className="text-sm">
                        {profile.rating != null ? (
                          <>
                            <Star className="mr-1 inline fill-[#B8955A] text-[#B8955A]" size={14} />
                            {profile.rating} average · verified sessions only
                          </>
                        ) : (
                          'Not yet rated'
                        )}
                      </p>
                      <p className="mt-3 border-t border-[#E5E1D8] pt-3 text-sm text-[#4A5568]">
                        Written reviews are not available yet.
                      </p>
                    </Card>
                  </div>

                  <aside className="space-y-5 xl:sticky xl:top-24">
                    <Card title="Pricing & terms">
                      <b className="serif text-2xl">{feeLabel(profile)}</b>
                      <p className="mt-2 text-xs text-[#4A5568]">
                        {profile.max_startups ? `Takes up to ${profile.max_startups} startups at a time.` : 'Session length confirmed on request.'}
                      </p>
                      <p className="mt-3 rounded-lg bg-[#FAF8F4] p-3 text-xs">Platform fee and applicable taxes are shown before you confirm.</p>
                      <button
                        type="button"
                        onClick={() => openRequestModal(profile)}
                        disabled={!profile.accepting_requests}
                        className="mt-4 w-full rounded-lg bg-ink py-3 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        {profile.accepting_requests ? 'Request mentorship' : 'Not accepting requests'}
                      </button>
                      <button type="button" onClick={() => setModal('intro')} className="mt-2 w-full rounded-lg border border-[#E5E1D8] py-3 text-sm font-semibold">
                        Book intro call
                      </button>
                      {/* Step 8b owns saved-mentor persistence; until then the
                          toggle is memory-only, exactly as before. */}
                      <button
                        type="button"
                        onClick={() => setSaved(saved.includes(profile.handle) ? saved.filter(x => x !== profile.handle) : [...saved, profile.handle])}
                        className="mt-3 w-full text-xs font-semibold text-[#9A7A45]"
                      >
                        <Bookmark className="mr-1 inline" size={13} />
                        {saved.includes(profile.handle) ? 'Saved' : 'Save mentor'}
                      </button>
                      <button type="button" onClick={() => notify('Report submitted to support for review.')} className="mt-2 w-full text-xs text-[#4A5568]">
                        Report mentor
                      </button>
                    </Card>

                    {/* Step 8c owns real availability. Until then: the real
                        cadence is shown, and the slot grid is an empty state
                        rather than invented times. */}
                    <Card title="Availability">
                      <p className="text-xs text-[#4A5568]">
                        Session cadence: <b>{profile.cadence || 'Not specified'}</b>
                      </p>
                      <p className="mt-3 rounded-lg border border-dashed border-[#E5E1D8] p-4 text-center text-xs text-[#4A5568]">
                        Bookable time slots open once scheduling is available. Ask for a time instead.
                      </p>
                      <button type="button" onClick={() => setModal('intro')} className="mt-3 w-full rounded-lg border border-[#E5E1D8] py-2 text-xs font-semibold">
                        Book intro call
                      </button>
                    </Card>
                  </aside>
                </div>
              </>
            )}
          </>
        )}

        {page === 'requests' && (() => {
          const sentRequests = requests.filter(r => r.status === 'requested' || r.status === 'active' || r.status === 'paused');
          const pastRequests = requests.filter(r => r.status === 'completed' || r.status === 'declined' || r.status === 'cancelled');

          const requestTabs = [
            { key: 'Sent', label: 'Sent', count: sentRequests.length },
            { key: 'Received', label: 'Received', count: 0 },
            { key: 'Past', label: 'Past', count: pastRequests.length },
          ];

          const renderRequestCard = (m) => {
            const mentorName = m.mentor?.display_name || 'Mentor';
            const mentorInitials = m.mentor?.avatar_initials || initialsFor(mentorName);
            const statusLabel = MENTORSHIP_STATUS_LABEL[m.status] || m.status;
            const statusChip = MENTORSHIP_STATUS_CHIP[m.status] || 'bg-[#F3F4F6] text-[#4A5568]';
            const isPending = m.status === 'requested';
            const isWithdrawing = withdrawingId === m.id;
            const profileHref = m.mentor?.handle ? `/startup/mentors/find/${m.mentor.handle}` : null;
            const viewHref = m.status === 'active' || m.status === 'paused'
              ? `/startup/mentors/${m.id}`
              : profileHref || `/startup/mentors/${m.id}`;

            return (
              <div
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#E5E1D8] bg-white p-4 transition-colors hover:border-[#D5C9B3]"
              >
                <div className="flex min-w-[240px] flex-1 items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#F3EBDD] text-sm font-semibold text-ink">
                    {mentorInitials}
                  </span>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {profileHref ? (
                        <Link href={profileHref} className="text-sm font-semibold text-ink hover:underline">
                          {mentorName}
                        </Link>
                      ) : (
                        <b className="text-sm text-ink">{mentorName}</b>
                      )}
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${statusChip}`}>
                        {statusLabel}
                      </span>
                    </div>
                    {m.goal && (
                      <p className="text-xs text-[#4A5568] line-clamp-2">{m.goal}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-[#7B8CA3]">
                      {m.cadence && <span>Cadence: {m.cadence}</span>}
                      {m.cadence && <span>·</span>}
                      <span>Requested on {formatDate(m.created_at)}</span>
                      {m.needs && m.needs.length > 0 && (
                        <>
                          <span>·</span>
                          <span>Needs: {m.needs.slice(0, 3).join(', ')}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Link
                    href={viewHref}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#E5E1D8] bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-[#F4F1EA]"
                  >
                    View <ArrowRight size={12} />
                  </Link>
                  {isPending && (
                    <button
                      type="button"
                      disabled={isWithdrawing}
                      onClick={() => handleWithdraw(m.id)}
                      className="text-xs font-semibold text-[#B42318] hover:underline disabled:opacity-50"
                    >
                      {isWithdrawing ? 'Withdrawing…' : 'Withdraw'}
                    </button>
                  )}
                </div>
              </div>
            );
          };

          return (
            <>
              {head(
                'Mentorship requests',
                'Track requests and invitations in one place.',
                <Link
                  href="/startup/mentors/find"
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-ink px-4 text-xs font-semibold text-white"
                >
                  <Search size={14} /> Find a mentor
                </Link>
              )}
              <div className="mb-4 flex gap-2">
                {requestTabs.map(t => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setRequestTab(t.key)}
                    className={`min-h-10 rounded-lg px-4 text-xs font-medium transition-colors ${
                      requestTab === t.key
                        ? 'bg-ink text-white'
                        : 'border border-[#E5E1D8] bg-white text-[#4A5568] hover:border-[#D5C9B3]'
                    }`}
                  >
                    {t.label}
                    {requestsPhase === 'ready' && t.key !== 'Received' ? (
                      <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] ${
                        requestTab === t.key ? 'bg-white/20 text-white' : 'bg-[#F4F1EA] text-[#4A5568]'
                      }`}>
                        {t.count}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
              <Card title={`${requestTab} requests`}>
                {requestsPhase === 'loading' && (
                  <div className="space-y-3" aria-busy="true" role="status">
                    {[0, 1].map(i => (
                      <div key={i} className="h-24 animate-pulse rounded-xl bg-[#F4F1EA]" />
                    ))}
                    <span className="sr-only">Loading mentorship requests…</span>
                  </div>
                )}
                {requestsPhase === 'error' && (
                  <div className="py-8 text-center" role="alert">
                    <p className="text-sm text-[#9A3A3A]">{requestsError || 'Could not load mentorship requests.'}</p>
                    <button
                      type="button"
                      onClick={() => setRequestsReload(n => n + 1)}
                      className="mt-3 min-h-9 rounded-lg bg-ink px-4 text-xs font-semibold text-white"
                    >
                      Retry
                    </button>
                  </div>
                )}
                {requestsPhase === 'ready' && (
                  <>
                    {requestTab === 'Sent' && (
                      sentRequests.length > 0 ? (
                        <div className="space-y-3">
                          {sentRequests.map(renderRequestCard)}
                        </div>
                      ) : (
                        <div className="py-12 text-center" role="status">
                          <p className="text-sm font-semibold">No mentorship requests sent yet.</p>
                          <p className="mt-1 text-xs text-[#4A5568]">
                            Browse verified advisors and send requests tailored to your startup's needs.
                          </p>
                          <Link
                            href="/startup/mentors/find"
                            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2 text-xs font-semibold text-white"
                          >
                            <Search size={13} /> Find a mentor
                          </Link>
                        </div>
                      )
                    )}

                    {requestTab === 'Received' && (
                      <div className="py-12 text-center" role="status">
                        <p className="text-sm font-semibold">No invitations received yet.</p>
                        <p className="mt-1 text-xs text-[#4A5568]">
                          Mentors currently do not send inbound invitations; browse the directory to find and request a mentor.
                        </p>
                        <Link
                          href="/startup/mentors/find"
                          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2 text-xs font-semibold text-white"
                        >
                          <Search size={13} /> Find a mentor
                        </Link>
                      </div>
                    )}

                    {requestTab === 'Past' && (
                      pastRequests.length > 0 ? (
                        <div className="space-y-3">
                          {pastRequests.map(renderRequestCard)}
                        </div>
                      ) : (
                        <div className="py-12 text-center" role="status">
                          <p className="text-sm font-semibold">No past requests.</p>
                          <p className="mt-1 text-xs text-[#4A5568]">
                            Completed, declined, and withdrawn mentorships will appear here.
                          </p>
                        </div>
                      )
                    )}
                  </>
                )}
              </Card>
            </>
          );
        })()}

        {page === 'workspace' && (
          <>
            {head(
              `Mentorship with ${mentor.name}`,
              'Active · Started October 21, 2026 · Fortnightly',
              <div className="flex gap-2">
                <Link
                  href="/startup/sessions"
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[9px] border border-[#E5E1D8] bg-white px-3.5 text-sm font-semibold text-ink hover:bg-[#F4F1EA]"
                >
                  <CalendarDays size={15} /> Book session
                </Link>
                <Btn onClick={() => notify('Message sent to mentor.')}>
                  <MessageCircle size={15} /> Message
                </Btn>
              </div>
            )}
            <div className="mb-5 flex gap-2 overflow-x-auto">
              {['Overview', 'Plan', 'Sessions', 'Deliverables', 'Notes', 'Files', 'Messages'].map(x => (
                <button
                  key={x}
                  type="button"
                  onClick={() => setTab(x)}
                  className={`min-h-10 shrink-0 rounded-lg px-4 text-xs ${tab === x ? 'bg-ink text-white' : 'border border-[#E5E1D8] bg-white'}`}
                >
                  {x}
                </button>
              ))}
            </div>

            <div className="grid items-start gap-5 xl:grid-cols-3">
              <div className="space-y-5 xl:col-span-2">
                <Card title={tab === 'Overview' ? 'Mentorship overview' : tab}>
                  {tab === 'Overview' ? (
                    <>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="rounded-lg bg-[#F3EBDD] p-4">
                          <p className="text-xs text-[#806236]">Readiness sign-off</p>
                          <b className="serif mt-1 block text-2xl">{approved} of 6 items</b>
                          <Link href="/startup/readiness" className="mt-2 inline-block text-xs font-semibold text-[#9A7A45]">
                            View checklist <ArrowRight className="inline" size={12} />
                          </Link>
                        </div>
                        <div className="rounded-lg bg-[#FAF8F4] p-4">
                          <p className="text-xs text-[#4A5568]">Next session</p>
                          <b className="mt-1 block text-sm">Thu, Nov 12 · 4:00 PM</b>
                          <small className="text-xs text-[#4A5568]">Go-to-market and pricing</small>
                        </div>
                      </div>
                      <h3 className="mt-5 text-sm font-semibold">Shared goals</h3>
                      {[
                        ['Validate pricing with 10 customers', 'Nov 30', 65],
                        ['Prepare fundraising narrative', 'Dec 15', 30],
                      ].map(([g, d, v]) => (
                        <div key={g} className="mt-3 rounded-lg border border-[#E5E1D8] p-3">
                          <div className="flex justify-between text-xs">
                            <b>{g}</b>
                            <span>{d}</span>
                          </div>
                          <div className="mt-2 h-1.5 rounded-full bg-[#E5E1D8]">
                            <div className="h-full rounded-full bg-[#B8955A]" style={{ width: `${v}%` }} />
                          </div>
                          <small className="mt-1 block text-[#4A5568]">{v}% complete</small>
                        </div>
                      ))}
                    </>
                  ) : tab === 'Plan' ? (
                    <>
                      <p className="mb-4 text-xs text-[#4A5568]">Cadence: Fortnightly · 45 minutes · Plan changes require both sides to accept.</p>
                      <div className="space-y-3">
                        {[
                          ['Validate pricing and unit economics', 'Nov 30', 'Aarav Kapoor', 'In progress'],
                          ['Prepare fundraising narrative', 'Dec 15', 'Rhea Mukherjee', 'Proposed'],
                        ].map(([g, d, o, s]) => (
                          <div key={g} className="rounded-lg border border-[#E5E1D8] p-4">
                            <div className="flex justify-between text-sm">
                              <b>{g}</b>
                              <span className="text-xs">{d}</span>
                            </div>
                            <p className="mt-1 text-xs text-[#4A5568]">Success measure: share a reviewed, documented plan · Owner {o}</p>
                            <span className="mt-2 inline-block rounded-full bg-[#F3F4F6] px-2 py-1 text-[10px]">{s}</span>
                          </div>
                        ))}
                      </div>
                      <button type="button" onClick={() => notify('Goal proposed to mentor.')} className="mt-4 text-xs font-semibold text-[#9A7A45]">
                        + Add goal
                      </button>
                    </>
                  ) : tab === 'Sessions' ? (
                    <Link href="/startup/sessions" className="text-xs font-semibold text-[#9A7A45]">
                      View all sessions <ArrowRight className="inline" size={13} />
                    </Link>
                  ) : tab === 'Deliverables' ? (
                    <div className="space-y-3">
                      {[
                        ['Review interview themes', 'Nov 08', 'In progress'],
                        ['Pricing model feedback', 'Nov 12', 'To do'],
                        ['Fundraising narrative', 'Nov 15', 'To do'],
                      ].map(([n, d, s]) => (
                        <div key={n} className="flex items-center gap-3 border-b border-[#E5E1D8] py-3">
                          <ClipboardCheck size={16} className="text-[#9A7A45]" />
                          <span className="flex-1 text-xs">
                            {n}<small className="ml-2 text-[#4A5568]">Due {d}</small>
                          </span>
                          <span className="text-[10px]">{s}</span>
                          <button type="button" onClick={() => notify('Deliverable submitted for mentor review.')} className="text-xs font-semibold text-[#9A7A45]">
                            Submit
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : tab === 'Notes' ? (
                    <>
                      <textarea
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        rows={8}
                        placeholder="Add shared notes, decisions or action items…"
                        className="w-full rounded-lg border border-[#E5E1D8] bg-white p-3 text-sm"
                      />
                      <div className="mt-3 flex justify-between text-xs">
                        <label>
                          <input type="checkbox" className="mr-2 accent-ink" />Private notes
                        </label>
                        <button type="button" onClick={() => notify('Notes saved · just now.')} className="font-semibold text-[#9A7A45]">
                          Save notes
                        </button>
                      </div>
                    </>
                  ) : tab === 'Files' ? (
                    <div className="rounded-lg border border-dashed border-[#E5E1D8] p-7 text-center">
                      <FileText className="mx-auto mb-2 text-[#9A7A45]" />
                      <p className="text-sm font-semibold">Shared files</p>
                      <p className="mt-1 text-xs text-[#4A5568]">Pitch deck v3.pdf · Shared Oct 25 · Access logged</p>
                      <button type="button" onClick={() => notify('Vault picker opened.')} className="mt-3 text-xs font-semibold text-[#9A7A45]">
                        Share from vault <Plus className="inline" size={12} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="max-h-64 space-y-3 overflow-y-auto rounded-lg bg-[#FAF8F4] p-4">
                        <p className="text-xs"><b>Rhea</b> · Great progress on the interviews. Let’s look at pricing next.</p>
                        <p className="text-right text-xs"><b>You</b> · I’ll bring the revised model to our session.</p>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <input placeholder="Write a secure message…" className="h-10 flex-1 rounded-lg border border-[#E5E1D8] px-3 text-xs" />
                        <button type="button" onClick={() => notify('Message sent.')} className="grid h-10 w-10 place-items-center rounded-lg bg-ink text-white">
                          <Send size={14} />
                        </button>
                      </div>
                    </>
                  )}
                </Card>
              </div>

              <aside className="space-y-5">
                <Card title="Mentor">
                  <div className="flex items-center gap-3">
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-[#F3EBDD] font-semibold">RM</span>
                    <div>
                      <b className="text-sm">{mentor.name}</b>
                      <p className="text-xs text-[#4A5568]">Verified · Go-to-market</p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Link href={`/startup/mentors/${id}/billing`} className="rounded-lg border border-[#E5E1D8] py-2 text-center text-xs font-semibold hover:bg-[#FAF8F4]">
                      Agreement & billing
                    </Link>
                    <button type="button" onClick={() => notify('Mentorship paused.')} className="rounded-lg border border-[#E5E1D8] py-2 text-xs">
                      Pause mentorship
                    </button>
                  </div>
                </Card>

                <Card title="Recent activity">
                  <p className="text-xs text-[#4A5568]">Rhea reviewed interview themes · 2 days ago</p>
                  <p className="mt-3 text-xs text-[#4A5568]">Session notes added · Oct 28</p>
                </Card>
              </aside>
            </div>
          </>
        )}

        {page === 'sessions' && <StartupSessionsBlock />}

        {page === 'session' && <StartupSessionDetailBlock sessionId={id} />}

        {page === 'readiness' && (
          <>
            {head(
              'Investment readiness',
              'Mentor-reviewed evidence for your startup’s readiness journey.',
              <Link href="/startup/mentors/find" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#E5E1D8] bg-white px-3 text-sm font-semibold">
                Find a mentor
              </Link>
            )}

            {readinessPhase === 'loading' && (
              <div className="grid gap-3">
                {[0, 1, 2].map(k => (
                  <div key={k} className="h-28 animate-pulse rounded-xl border border-[#E5E1D8] bg-white" />
                ))}
                <p className="text-xs text-[#4A5568]">Loading your readiness checklist…</p>
              </div>
            )}

            {readinessPhase === 'error' && (
              <Card title="Could not load readiness">
                <p className="text-xs text-[#A33A3A]">{readinessError}</p>
                <button type="button" onClick={reloadReadiness} className="mt-3 rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs font-semibold">
                  Try again
                </button>
              </Card>
            )}

            {readinessPhase === 'none' && (
              <Card title="No startup workspace yet">
                <p className="text-xs text-[#4A5568]">
                  Readiness is tracked per startup organization. Create your startup profile to start the checklist.
                </p>
                <Link href="/onboarding" className="mt-3 inline-block text-xs font-semibold text-[#9A7A45]">
                  Set up your startup <ArrowRight className="inline" size={12} />
                </Link>
              </Card>
            )}

            {readinessPhase === 'ready' && readiness && (
              <>
                <div className="mb-5 grid gap-5 lg:grid-cols-3">
                  <Card title="Readiness score">
                    <div className="flex items-center gap-5">
                      <div
                        className="grid h-28 w-28 place-items-center rounded-full"
                        style={{ background: `conic-gradient(#B8955A 0deg ${Math.round((readiness.summary.readiness_pct / 100) * 360)}deg,#E5E1D8 ${Math.round((readiness.summary.readiness_pct / 100) * 360)}deg 360deg)` }}
                      >
                        <div className="grid h-[88px] w-[88px] place-items-center rounded-full bg-white">
                          <span className="serif text-3xl">{readiness.summary.readiness_pct}</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-[#4A5568]">out of 100</p>
                        <p className="mt-2 text-xs font-semibold">
                          {readiness.summary.criteria_signed_off} of {readiness.summary.criteria_total} signed off
                        </p>
                        <p className="mt-1 text-xs text-[#4A5568]">The score is a guide. Sign-offs decide the badge.</p>
                      </div>
                    </div>
                  </Card>

                  <div className="lg:col-span-2">
                    {readiness.summary.is_ready ? (
                      <Card title="Investment Ready">
                        <div className="rounded-xl bg-[#F3EBDD] p-5">
                          <ShieldCheck size={24} className="text-[#9A7A45]" />
                          <h3 className="mt-2 serif text-xl font-semibold">Investment Ready</h3>
                          <p className="mt-1 text-xs text-[#4A5568]">
                            Earned with sign-off on every readiness item.
                          </p>
                          <Link href="/startup/profile" className="mt-4 inline-block rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white">
                            Manage profile visibility
                          </Link>
                        </div>
                      </Card>
                    ) : (
                      <Card title="Badge status">
                        <div className="rounded-xl bg-[#FAF8F4] p-5">
                          <p className="font-semibold">Not yet earned</p>
                          <p className="mt-1 text-xs text-[#4A5568]">Complete all six reviewed items to receive the Investment Ready badge.</p>
                          <Link href="/startup/profile" className="mt-3 inline-block text-xs font-semibold text-[#9A7A45]">
                            Manage profile visibility <ArrowRight className="inline" size={12} />
                          </Link>
                        </div>
                      </Card>
                    )}
                  </div>
                </div>

                {(readinessFormErr || (readinessErrs.evidence && evidenceFor === null)) && (
                  <div className="mb-4 rounded-lg border border-[#F0C9C9] bg-[#FDECEC] p-3 text-xs text-[#A33A3A]" role="alert">
                    {readinessFormErr || readinessErrs.evidence}
                  </div>
                )}

                {readiness.items.length === 0 ? (
                  <Card title="Checklist">
                    <p className="text-xs text-[#4A5568]">
                      No readiness criteria are published yet. Your checklist appears here once they are.
                    </p>
                  </Card>
                ) : (
                  <div className="grid items-start gap-5 xl:grid-cols-3">
                    <div className="space-y-4 xl:col-span-2">
                      {readiness.items.map((item, i) => {
                        const chip = READINESS_CHIP[item.status] || READINESS_CHIP.not_started;
                        const signedOn = formatSignedOff(item.signed_off_at);
                        const editing = evidenceFor === item.criterion_id;
                        return (
                          <Card
                            key={item.criterion_id}
                            title={`${i + 1}. ${item.title}`}
                            action={
                              <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${chip}`}>
                                {READINESS_LABEL[item.status] || item.status}
                              </span>
                            }
                          >
                            {item.description && (
                              <p className="text-xs leading-5 text-[#4A5568]">{item.description}</p>
                            )}

                            {editing ? (
                              <div className="mt-3">
                                <label htmlFor={`evidence-${item.criterion_id}`} className="text-xs font-semibold">
                                  Evidence
                                </label>
                                <textarea
                                  id={`evidence-${item.criterion_id}`}
                                  value={evidenceDraft}
                                  onChange={e => setEvidenceDraft(e.target.value)}
                                  rows={3}
                                  maxLength={2000}
                                  placeholder="Describe the evidence: what exists, where it lives, who reviewed it."
                                  className={`mt-1 w-full rounded-lg border px-3 py-2 text-xs ${readinessErrs.evidence ? 'border-[#C95B5B]' : 'border-[#E5E1D8]'}`}
                                />
                                {readinessErrs.evidence && (
                                  <p className="mt-1 text-[10px] text-[#A33A3A]">{readinessErrs.evidence}</p>
                                )}
                                <div className="mt-2 flex gap-2">
                                  <button
                                    type="button"
                                    disabled={readinessBusy}
                                    onClick={() => saveEvidence(item)}
                                    className="rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                                  >
                                    {readinessBusy ? 'Saving…' : 'Save evidence'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => { setEvidenceFor(null); setReadinessErrs({}); }}
                                    className="rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p className="mt-3 text-xs">
                                <FileText className="mr-1 inline text-[#9A7A45]" size={13} />
                                {item.evidence ? (
                                  <span className="text-[#0F1B2D]">{item.evidence}</span>
                                ) : (
                                  <span className="text-[#4A5568]">No evidence yet</span>
                                )}
                              </p>
                            )}

                            {item.status === 'rejected' && item.notes && (
                              <p className="mt-2 rounded-lg bg-[#FDECEC] p-2 text-[10px] leading-4 text-[#A33A3A]">
                                Changes requested: {item.notes}
                              </p>
                            )}

                            {item.status === 'not_started' && !editing && (
                              <div className="mt-3 flex gap-2">
                                {canEditReadiness ? (
                                  <button type="button" onClick={() => openEvidence(item)} className="rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs">
                                    Add evidence
                                  </button>
                                ) : (
                                  <p className="text-xs text-[#4A5568]">Only the startup team can add evidence.</p>
                                )}
                              </div>
                            )}

                            {(item.status === 'in_progress' || item.status === 'rejected') && !editing && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {canEditReadiness ? (
                                  <>
                                    <button type="button" onClick={() => openEvidence(item)} className="rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs">
                                      {/* A rejected item is reworked here, then re-submitted (5f D6). */}
                                      {item.status === 'rejected' ? 'Edit and resubmit' : 'Edit evidence'}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={readinessBusy}
                                      onClick={() => submitItem(item)}
                                      className="rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                                    >
                                      Submit for sign-off
                                    </button>
                                  </>
                                ) : (
                                  <p className="text-xs text-[#4A5568]">Read-only: your workspace role cannot edit readiness items.</p>
                                )}
                              </div>
                            )}

                            {item.status === 'submitted' && (
                              <div className="mt-3 flex flex-wrap items-center gap-3">
                                <p className="text-xs text-[#8A5700]">Waiting for platform review.</p>
                                {canEditReadiness && (
                                  <button
                                    type="button"
                                    disabled={readinessBusy}
                                    onClick={() => withdrawItem(item)}
                                    className="text-xs font-semibold text-[#9A7A45] disabled:opacity-40"
                                  >
                                    Withdraw
                                  </button>
                                )}
                              </div>
                            )}

                            {item.status === 'signed_off' && (
                              <p className="mt-3 text-xs text-[#286749]">
                                Signed off{signedOn ? ` · ${signedOn}` : ''}
                              </p>
                            )}
                          </Card>
                        );
                      })}
                    </div>

                    <aside className="space-y-5">
                      <Card title="Score breakdown">
                        <p className="text-xs leading-5 text-[#4A5568]">
                          Per-area scoring (checklist, traction, mentor feedback) arrives with mentor sign-off in Step 8.
                        </p>
                      </Card>

                      <Card title="Reviewers">
                        <p className="text-xs leading-5 text-[#4A5568]">
                          Readiness items are reviewed by the platform team today. Mentor review from your own mentorship
                          arrives in Step 8.
                        </p>
                        <Link href="/startup/mentors/find" className="mt-3 inline-block text-xs font-semibold text-[#9A7A45]">
                          Find a mentor <ArrowRight className="inline" size={12} />
                        </Link>
                      </Card>
                    </aside>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {page === 'billing' && (
          <>
            {head(
              'Agreement & payments',
              'Review fees, terms and session invoices for this mentorship.',
              <Link href={`/startup/mentors/${id}`} className="text-sm text-[#9A7A45]">
                ← Workspace
              </Link>
            )}
            <div className="grid items-start gap-5 lg:grid-cols-3">
              <div className="space-y-5 lg:col-span-2">
                <Card title="Mentorship agreement">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      ['Mentor', 'Rhea Mukherjee'],
                      ['Fee model', '₹3,000 per 45-minute session'],
                      ['Cadence', 'Fortnightly'],
                      ['Advisory / equity', 'None requested'],
                      ['Start date', 'Oct 21, 2026'],
                      ['Status', 'Accepted by both sides'],
                    ].map(([a, b]) => (
                      <div key={a} className="rounded-lg bg-[#FAF8F4] p-3">
                        <small className="text-xs text-[#4A5568]">{a}</small>
                        <b className="mt-1 block text-sm">{b}</b>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 rounded-lg bg-[#FFF8E8] p-3 text-xs leading-5 text-[#806236]">
                    Review equity or advisory terms with a lawyer. The platform records terms but does not give legal advice.
                  </p>
                  <button type="button" onClick={() => notify('Agreement change proposed to mentor.')} className="mt-4 rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs font-semibold">
                    Propose change
                  </button>
                </Card>

                <Card title="Payments">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[500px] text-left text-xs">
                      <thead className="border-b text-[#4A5568]">
                        <tr>
                          {['Date', 'Session', 'Fee', 'Platform fee', 'Status', 'Receipt'].map(x => (
                            <th key={x} className="py-3">{x}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          ['Oct 28', 'Customer interviews', '₹3,000', '₹300', 'Paid'],
                          ['Oct 14', 'Prototype test plan', '₹3,000', '₹300', 'Paid'],
                        ].map(r => (
                          <tr key={r[0]} className="border-b">
                            <td className="py-3">{r[0]}</td>
                            {r.slice(1).map((x, i) => (
                              <td key={i}>{x}</td>
                            ))}
                            <td>
                              <button type="button" onClick={() => notify('Receipt downloaded.')} aria-label="Download receipt">
                                <Download size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>

              <aside className="space-y-5">
                <Card title="Session credits">
                  <p className="serif text-3xl">0 <small className="font-sans text-sm">credits</small></p>
                  <p className="mt-1 text-xs text-[#4A5568]">No package purchased</p>
                  <button type="button" onClick={() => notify('Packages are not available yet.')} className="mt-3 w-full rounded-lg bg-ink py-2.5 text-xs font-semibold text-white">
                    Buy a package
                  </button>
                </Card>

                <Card title="Payment method">
                  <p className="text-xs">UPI · ending in 42</p>
                  <button type="button" onClick={() => notify('Billing settings opened.')} className="mt-3 text-xs font-semibold text-[#9A7A45]">
                    Manage payment method
                  </button>
                </Card>
              </aside>
            </div>
          </>
        )}
      </main>

      {/* Modals */}
      {modal && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[#0F1B2D]/45 p-4">
          <section role="dialog" aria-modal="true" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="serif text-2xl font-semibold">
                {modal === 'match'
                  ? 'Find your mentor match'
                  : modal === 'request'
                  ? `Request mentorship${targetMentor?.display_name ? ` · ${targetMentor.display_name}` : ''}`
                  : modal === 'book'
                  ? 'Book a mentor session'
                  : 'Book intro call'}
              </h2>
              <button aria-label="Close" type="button" onClick={() => setModal('')}>
                <X size={18} />
              </button>
            </div>

            {modal === 'match' ? (
              <div className="space-y-4">
                <p className="text-sm text-[#4A5568]">
                  We rank mentors using your startup’s own profile — its stage, sector and what
                  it needs help with. You choose whether to contact anyone.
                </p>
                {/* The demo dialog had "Top needs" and "Budget" pickers, but the
                    suggestions endpoint takes no such input: ranking comes from
                    the startup profile and the mentor's own attributes. Rather
                    than leave two controls that change nothing, the dialog says
                    what actually drives the match. */}
                {matchPhase === 'idle' && (
                  <p className="rounded-lg bg-[#FAF8F4] p-3 text-xs text-[#4A5568]">
                    To change the inputs, update your startup’s stage and sector in your profile.
                  </p>
                )}
                {matchPhase === 'loading' && (
                  <p className="text-sm text-[#4A5568]" role="status">Finding matches…</p>
                )}
                {matchPhase === 'no-org' && (
                  <p className="rounded-lg bg-[#FAF8F4] p-3 text-xs text-[#4A5568]" role="status">
                    Matching needs a startup you belong to. Create or join one first.
                  </p>
                )}
                {matchPhase === 'error' && (
                  <p className="rounded-lg border border-[#E5E1D8] p-3 text-xs text-[#9A3A3A]" role="alert">
                    {matchError}
                  </p>
                )}
                {matchPhase === 'ready' && suggestions.length === 0 && (
                  <p className="rounded-lg bg-[#FAF8F4] p-3 text-xs text-[#4A5568]" role="status">
                    No matches yet. As your startup profile fills in, suggestions appear here.
                  </p>
                )}
                {matchPhase === 'ready' && suggestions.length > 0 && (
                  <ul className="space-y-2">
                    {suggestions.map(m => (
                      <li key={m.handle} className="rounded-lg border border-[#E5E1D8] p-3">
                        <div className="flex items-center justify-between gap-2">
                          <b className="text-sm">{m.display_name}</b>
                          <span className="text-xs text-[#4A5568]">{feeLabel(m)}</span>
                        </div>
                        <p className="mt-1 text-xs text-[#4A5568]">{m.headline}</p>
                        {m.match_reasons?.length ? (
                          <p className="mt-1 text-[11px] text-[#9A7A45]">{m.match_reasons.join(' · ')}</p>
                        ) : null}
                        <Link
                          href={`/startup/mentors/find/${m.handle}`}
                          onClick={() => setModal('')}
                          className="mt-2 inline-block text-xs font-semibold text-[#9A7A45]"
                        >
                          View profile
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : modal === 'request' ? (
              <form onSubmit={handleSendRequest} className="space-y-4">
                {requestFormError && (
                  <div className="rounded-lg border border-[#F3C4C4] bg-[#FDECEC] p-3 text-xs text-[#A33A3A]" role="alert">
                    {requestFormError}
                  </div>
                )}
                {targetMentor && (
                  <div className="rounded-lg border border-[#E5E1D8] bg-[#FAF8F4] p-3">
                    <p className="text-xs text-[#7B8CA3]">Advisor</p>
                    <b className="text-sm text-ink">{targetMentor.display_name}</b>
                    {targetMentor.headline && (
                      <p className="mt-0.5 text-xs text-[#4A5568]">{targetMentor.headline}</p>
                    )}
                  </div>
                )}
                <label className="block text-sm font-medium">
                  Your mentorship goal <span className="text-[#B42318]">*</span>
                  <textarea
                    required
                    minLength={10}
                    maxLength={500}
                    rows={3}
                    value={requestGoal}
                    onChange={e => setRequestGoal(e.target.value)}
                    placeholder="What outcome would you like to work toward? (10–500 characters)"
                    className="mt-2 w-full rounded-lg border border-[#E5E1D8] p-3 text-sm focus:border-[#B8955A] focus:outline-none"
                  />
                  <span className="mt-1 block text-right text-[11px] text-[#7B8CA3]">
                    {requestGoal.length} / 500 characters
                  </span>
                </label>
                <label className="block text-sm font-medium">
                  Top needs
                  <input
                    value={requestNeeds}
                    onChange={e => setRequestNeeds(e.target.value)}
                    placeholder="e.g. pricing, customer research, fundraising (comma-separated)"
                    className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] px-3 text-sm focus:border-[#B8955A] focus:outline-none"
                  />
                </label>
                <label className="block text-sm font-medium">
                  Preferred cadence
                  <select
                    value={requestCadence}
                    onChange={e => setRequestCadence(e.target.value)}
                    className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 text-sm focus:border-[#B8955A] focus:outline-none"
                  >
                    <option value="Fortnightly">Fortnightly</option>
                    <option value="Weekly">Weekly</option>
                    <option value="Monthly">Monthly</option>
                  </select>
                </label>
                <label className="block text-sm font-medium">
                  Message / Context (optional)
                  <textarea
                    rows={2}
                    maxLength={2000}
                    value={requestTerms}
                    onChange={e => setRequestTerms(e.target.value)}
                    placeholder="Introduce your startup and provide any context for the mentor"
                    className="mt-2 w-full rounded-lg border border-[#E5E1D8] p-3 text-sm focus:border-[#B8955A] focus:outline-none"
                  />
                </label>
                <p className="rounded-lg bg-[#FAF8F4] p-3 text-xs text-[#4A5568]">
                  Session fee and any proposed advisory terms will be confirmed before you accept.
                </p>

                <div className="mt-6 flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={requestSubmitting}
                    onClick={() => setModal('')}
                    className="min-h-10 px-4 text-sm font-medium text-[#4A5568] hover:text-ink disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={requestSubmitting || requestGoal.trim().length < 10}
                    className="min-h-10 rounded-lg bg-ink px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {requestSubmitting ? 'Sending request…' : 'Send request'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <label className="block text-sm font-medium">
                  Your mentorship goal
                  <textarea
                    required
                    minLength={20}
                    maxLength={500}
                    rows={4}
                    placeholder="What outcome would you like to work toward? (20–500 characters)"
                    className="mt-2 w-full rounded-lg border border-[#E5E1D8] p-3 text-sm"
                  />
                </label>
                <label className="block text-sm">
                  Top needs
                  <input placeholder="e.g. pricing, customer research, fundraising" className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] px-3" />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm">
                    Preferred cadence
                    <select className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] bg-white px-3">
                      <option>Fortnightly</option>
                      <option>Weekly</option>
                      <option>Monthly</option>
                    </select>
                  </label>
                  <label className="text-sm">
                    Expected duration
                    <select className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] bg-white px-3">
                      <option>3 months</option>
                      <option>6 months</option>
                    </select>
                  </label>
                </div>
                <label className="block text-sm">
                  Message
                  <textarea rows={2} placeholder="Introduce your startup and context" className="mt-2 w-full rounded-lg border border-[#E5E1D8] p-3 text-sm" />
                </label>
                <p className="rounded-lg bg-[#FAF8F4] p-3 text-xs text-[#4A5568]">
                  Session fee and any proposed advisory terms will be confirmed before you accept. Shared documents are optional.
                </p>
              </div>
            )}

            {modal !== 'request' && (
              <div className="mt-6 flex justify-end gap-2">
                <button type="button" onClick={() => setModal('')} className="min-h-10 px-4 text-sm">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (modal === 'match') {
                      if (matchPhase === 'ready') {
                        setModal('');
                        setMatchPhase('idle');
                      } else {
                        runMatch();
                      }
                    } else {
                      setRequestSent(true);
                      setModal('');
                      notify('Mentorship request sent.');
                    }
                  }}
                  className="min-h-10 rounded-lg bg-ink px-4 text-sm font-semibold text-white"
                >
                  {modal === 'match'
                    ? matchPhase === 'ready'
                      ? 'Done'
                      : matchPhase === 'loading'
                      ? 'Finding…'
                      : 'See matches'
                    : modal === 'book'
                    ? 'Confirm booking'
                    : 'Send request'}
                </button>
              </div>
            )}
          </section>
        </div>
      )}

      {page === 'overview' && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[#E5E1D8] bg-white p-3 lg:hidden">
          <Link href="/startup/mentors/find" className="block rounded-lg bg-ink py-3 text-center text-sm font-semibold text-white">
            Find a mentor
          </Link>
        </div>
      )}

      {toast && (
        <div role="status" aria-live="polite" className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-lg bg-ink px-4 py-3 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
