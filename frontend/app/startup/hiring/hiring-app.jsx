'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { StartupSidebar, Btn, Card, SubNavTabs, NoStartupOrg } from '../../../components';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api/client';
import {
  ErrorState,
  LoadingState,
  errorMessage,
} from './startup-hiring-shared';
import {
  StartupApplicantDetailView,
  StartupJobDetailView,
  StartupJobEditorView,
  StartupOverviewView,
} from './startup-jobs-views';
import {
  ScheduleInterviewModal,
  StartupInterviewsView,
  StartupOffersView,
} from './startup-interviews-offers-views';
import {
  Search,
  Bell,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  ArrowUpRight,
  Plus,
  MapPin,
  Clock,
  CalendarDays,
  CheckCircle2,
  AlertCircle,
  MoreHorizontal,
  Filter,
  Send,
  ShieldCheck,
  LockKeyhole,
  FileText,
  Video,
  Mail,
  X,
  Building2,
  Download,
  Share2,
  Edit3,
  Globe,
  Star,
  MessageCircle,
  Check,
  UserRound,
  ExternalLink,
  Eye,
  BriefcaseBusiness,
  Wallet,
  Upload,
  Bookmark,
  Menu
} from 'lucide-react';

const jobSeed = [
  { id: 'job-01', title: 'Backend Engineer', department: 'Engineering', location: 'Remote · India', type: 'Full-time', status: 'Open', posted: 'Oct 28, 2026', applicants: 32, stages: [14, 9, 6, 2], owner: 'Aarav Kapoor', new: 6 },
  { id: 'job-02', title: 'Product Designer', department: 'Product', location: 'Kolkata · Hybrid', type: 'Full-time', status: 'Open', posted: 'Oct 21, 2026', applicants: 28, stages: [13, 8, 5, 2], owner: 'Priya Menon', new: 3 },
  { id: 'job-03', title: 'Growth Associate', department: 'Sales', location: 'Remote · India', type: 'Draft', posted: 'Draft · Oct 30', applicants: 0, stages: [0, 0, 0, 0], owner: 'Aarav Kapoor', new: 0 },
];

const people = [
  { id: 'c-1', name: 'Ananya Sen', title: 'Senior Backend Engineer', location: 'Bengaluru, India', experience: '6 years', skills: ['Node.js', 'PostgreSQL', 'AWS'], match: 'Strong skills match', applied: '2 days ago', source: 'Platform', stage: 'Applied', rating: 4.5, consent: true },
  { id: 'c-2', name: 'Rohan Mehta', title: 'Full-stack Engineer', location: 'Pune, India', experience: '4 years', skills: ['TypeScript', 'Node.js', 'Redis'], match: 'Good skills match', applied: '3 days ago', source: 'Referral', stage: 'Shortlisted', rating: 4.2, consent: true },
  { id: 'c-3', name: 'Ishita Roy', title: 'Platform Engineer', location: 'Kolkata, India', experience: '5 years', skills: ['Go', 'AWS', 'Kubernetes'], match: 'Strong skills match', applied: '5 days ago', source: 'Platform', stage: 'Interview', rating: 4.8, consent: false },
  { id: 'c-4', name: 'Kabir Shah', title: 'Backend Developer', location: 'Remote · India', experience: '3 years', skills: ['Python', 'PostgreSQL', 'Docker'], match: 'Relevant experience', applied: '1 week ago', source: 'Jobs marketplace', stage: 'Applied', rating: 3.9, consent: true },
];

const pipeline = ['Applied', 'Shortlisted', 'Interview', 'Offer', 'Hired'];

export default function Hiring({ page = 'overview', jobId = 'job-01', applicantId = 'c-1' }) {
  const router = useRouter();
  const { user } = useAuth();
  const [startupOrg, setStartupOrg] = useState(null);
  const [orgState, setOrgState] = useState('loading');
  const [orgError, setOrgError] = useState('');
  const [orgReloadKey, setOrgReloadKey] = useState(0);
  const [scheduleTarget, setScheduleTarget] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    setOrgState('loading');
    setOrgError('');
    api.organizations
      .mine(controller.signal)
      .then((orgs) => {
        if (controller.signal.aborted) return;
        const found = (orgs || []).find((o) => o.type === 'startup') || null;
        setStartupOrg(found);
        setOrgState(found ? 'ready' : 'empty');
      })
      .catch((e) => {
        if (controller.signal.aborted) return;
        setOrgError(errorMessage(e, 'Could not load your startup organization.'));
        setOrgState('error');
      });
    return () => controller.abort();
  }, [orgReloadKey]);

  const [jobs, setJobs] = useState(jobSeed);
  const [tab, setTab] = useState('Jobs');
  const [filter, setFilter] = useState('All statuses');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');
  const [modal, setModal] = useState('');
  const [requestTitle, setRequestTitle] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [saved, setSaved] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [compact, setCompact] = useState(false);

  // Dynamic parameter normalization
  const normalizedJobId = jobId === 'job-1' ? 'job-01' : jobId === 'job-2' ? 'job-02' : jobId === 'job-3' ? 'job-03' : jobId;
  const currentJob = jobs.find(j => j.id === normalizedJobId || j.id === jobId) || jobs[0];

  const normalizedApplicantId = applicantId?.replace('app-', 'c-');
  const initialApplicant = people.find(p => p.id === applicantId || p.id === normalizedApplicantId) || people[0];
  const [activeApplicant, setActiveApplicant] = useState(initialApplicant);
  const [stage, setStage] = useState(initialApplicant?.stage || 'Applied');

  // React to applicantId prop changes during client-side navigation
  useEffect(() => {
    const matched = people.find(p => p.id === applicantId || p.id === applicantId?.replace('app-', 'c-')) || people[0];
    setActiveApplicant(matched);
    setStage(matched?.stage || 'Applied');
  }, [applicantId]);

  const [blind, setBlind] = useState(false);
  const [candTab, setCandTab] = useState('Overview');
  const [eventTab, setEventTab] = useState('Upcoming');
  const [offerTab, setOfferTab] = useState('Sent');
  const [profileTab, setProfileTab] = useState('Editor');
  const [verified, setVerified] = useState(false);
  const [query, setQuery] = useState('');
  const [savedTalent, setSavedTalent] = useState([]);

  const notify = (s) => {
    setToast(s);
    setTimeout(() => setToast(''), 2700);
  };

  const is = (x) => page === x;

  const pageHead = (title, sub, actions) => (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-sm text-[#4A5568]">
          {startupOrg?.name || 'Startup'} <span className="mx-2 text-[#B8955A]">·</span> Hiring
        </p>
        <h1 className="serif mt-1 text-[30px] font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-[#4A5568]">{sub}</p>
      </div>
      <div className="flex flex-wrap gap-2">{actions}</div>
    </div>
  );

  const userName = user?.full_name || 'Startup member';
  const userInitials = userName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('') || 'SM';
  const isWired7rs =
    is('overview') ||
    is('editor') ||
    is('job') ||
    is('candidate') ||
    is('interviews') ||
    is('offers');

  const jobCards = jobs
    .filter(j => (filter === 'All statuses' || j.status === filter) && (!search || j.title.toLowerCase().includes(search.toLowerCase())))
    .map(j => (
      <article key={j.id} className="rounded-xl border border-[#E5E1D8] bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href={`/startup/hiring/${j.id}`} className="text-base font-semibold hover:underline">
              {j.title}
            </Link>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#4A5568]">
              <span>{j.department}</span>
              <span><MapPin className="mr-1 inline" size={12} />{j.location}</span>
              <span>{j.type}</span>
              <span>Posted {j.posted}</span>
            </div>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            j.status === 'Open' ? 'bg-[#E7F3EC] text-[#286749]' : j.status === 'Draft' ? 'bg-[#F3F4F6] text-[#4A5568]' : 'bg-[#FFF3D6] text-[#8A5700]'
          }`}>
            {j.status}
          </span>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <b className="text-sm">{j.applicants} applicants</b>
            <div className="flex h-2 w-32 overflow-hidden rounded-full bg-[#F3F4F6]">
              {j.stages.map((v, i) => (
                <span
                  key={i}
                  className={['bg-[#A0A7B4]', 'bg-[#B8955A]', 'bg-ink', 'bg-[#4A5568]'][i]}
                  style={{ width: `${j.applicants ? (v / j.applicants) * 100 : 0}%` }}
                />
              ))}
            </div>
            {j.new > 0 && <span className="rounded-full bg-[#F3EBDD] px-2 py-1 text-[10px] font-semibold text-[#806236]">+{j.new} new</span>}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#4A5568]">Owner: {j.owner}</span>
            <Link href={`/startup/hiring/${j.id}`} className="text-xs font-semibold text-[#9A7A45]">
              View pipeline <ArrowRight className="inline" size={13} />
            </Link>
            <button type="button" onClick={() => notify(`${j.title} options opened.`)} aria-label="Job options">
              <MoreHorizontal size={18} />
            </button>
          </div>
        </div>
      </article>
    ));

  return (
    <div className="min-h-screen bg-[#FAF8F4] text-[#0F1B2D]">
      <a href="#hiring-main" className="sr-only focus:not-sr-only">Skip to content</a>

      {/* Shared Startup Sidebar */}
      <StartupSidebar
        active="Hiring"
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
            <span className="grid h-8 w-8 place-items-center rounded-full bg-ink font-semibold text-white">{userInitials}</span>
            <span className="hidden sm:block">{userName}</span>
            <ChevronDown size={14} />
          </span>
        </div>
      </header>

      <main id="hiring-main" className={`mx-auto max-w-[1440px] px-4 pb-16 pt-7 transition-[margin] duration-200 sm:px-7 lg:px-8 ${compact ? 'lg:ml-[76px]' : 'lg:ml-[240px]'}`}>
        {/* Secondary hiring navigation */}
        <SubNavTabs
          items={[
            ['Overview', '/startup/hiring', page === 'overview'],
            ['Talent search', '/startup/hiring/talent', page === 'talent'],
            ['Interviews', '/startup/hiring/interviews', page === 'interviews'],
            ['Offers', '/startup/hiring/offers', page === 'offers'],
            ['Employer page', '/startup/hiring/employer-page', page === 'employer'],
          ]}
        />
        {isWired7rs && orgState === 'loading' ? (
          <LoadingState label="Loading startup workspace…" />
        ) : isWired7rs && orgState === 'error' ? (
          <ErrorState message={orgError} onRetry={() => setOrgReloadKey((k) => k + 1)} />
        ) : isWired7rs && orgState === 'empty' ? (
          <NoStartupOrg />
        ) : (
        <>
        {is('overview') && startupOrg && (
          <StartupOverviewView
            org={startupOrg}
            myRole={startupOrg.my_role}
            pageHead={pageHead}
            notify={notify}
            requestsFallback={
              <Card title="Hiring requests" action={<Link href="/startup/hiring/requests/new" className="text-xs font-semibold text-[#9A7A45]">+ New request</Link>}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[650px] text-left text-xs">
                    <thead className="border-b text-[#4A5568]">
                      <tr>
                        {['Role', 'Department', 'Urgency', 'Headcount', 'Target start', 'Status', ''].map(x => (
                          <th key={x} className="py-3">{x}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ['Backend Engineer', 'Engineering', 'High', '1', 'Dec 01', 'Approved'],
                        ['Product Designer', 'Product', 'Medium', '1', 'Dec 15', 'Pending approval'],
                        ['Growth Associate', 'Sales', 'Low', '1', 'Jan 05', 'Draft'],
                      ].map(r => (
                        <tr key={r[0]} className="border-b border-[#E5E1D8]">
                          <td className="py-4 font-semibold">{r[0]}</td>
                          {r.slice(1).map((x, j) => (
                            <td className="py-4 text-[#4A5568]" key={j}>{x}</td>
                          ))}
                          <td>
                            <Link href="/startup/hiring/jobs/new" className="text-[#9A7A45]">
                              Create job post
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            }
          />
        )}

        {is('request') && (
          <>
            {pageHead(
              'New hiring request',
              'Capture the hiring need before drafting a job post.',
              <Link href="/startup/hiring" className="text-sm text-[#4A5568]">Cancel</Link>
            )}
            <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-3">
              <form
                onSubmit={e => {
                  e.preventDefault();
                  notify('Hiring request submitted for approval.');
                  setTimeout(() => router.push('/startup/hiring'), 700);
                }}
                className="space-y-5 lg:col-span-2"
              >
                <Card title="Role details">
                  <label className="block text-sm font-medium">
                    Role title
                    <input
                      required
                      value={requestTitle}
                      onChange={e => setRequestTitle(e.target.value)}
                      placeholder="e.g. Backend Engineer"
                      className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] px-3 text-sm"
                    />
                  </label>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <label className="text-sm font-medium">
                      Department
                      <select className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] bg-white px-3">
                        <option>Engineering</option>
                        <option>Product</option>
                        <option>Sales</option>
                        <option>Operations</option>
                        <option>Finance</option>
                      </select>
                    </label>
                    <label className="text-sm font-medium">
                      Headcount
                      <input type="number" min="1" max="20" defaultValue="1" className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] px-3" />
                    </label>
                    <label className="text-sm font-medium">
                      Why now?
                      <select className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] bg-white px-3">
                        <option>Stage plan</option>
                        <option>Growth</option>
                        <option>Replacement</option>
                        <option>Skill gap</option>
                      </select>
                    </label>
                    <label className="text-sm font-medium">
                      Urgency
                      <select className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] bg-white px-3">
                        <option>Medium</option>
                        <option>High</option>
                        <option>Low</option>
                      </select>
                    </label>
                    <label className="text-sm font-medium">
                      Employment type
                      <select className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] bg-white px-3">
                        <option>Full-time</option>
                        <option>Part-time</option>
                        <option>Contract</option>
                      </select>
                    </label>
                    <label className="text-sm font-medium">
                      Work mode
                      <select className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] bg-white px-3">
                        <option>Remote</option>
                        <option>Hybrid</option>
                        <option>On-site</option>
                      </select>
                    </label>
                  </div>
                </Card>

                <Card title="Plan and budget">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="text-sm font-medium">
                      Budget range (monthly)
                      <input placeholder="₹80,000 – ₹1,20,000" className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] px-3 text-sm" />
                    </label>
                    <label className="text-sm font-medium">
                      Target start date
                      <input type="date" className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] px-3" />
                    </label>
                  </div>
                  <label className="mt-4 block text-sm font-medium">
                    Skills and must-haves
                    <input placeholder="Add relevant skills, separated by commas" className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] px-3 text-sm" />
                  </label>
                  <label className="mt-4 block text-sm font-medium">
                    Link to stage criterion
                    <select className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] bg-white px-3">
                      <option>Prototype: Working MVP released</option>
                      <option>Early revenue: Repeatable sales motion</option>
                    </select>
                  </label>
                  <label className="mt-4 block text-sm font-medium">
                    Why this role now?
                    <textarea rows={3} placeholder="How will this hire move the startup forward?" className="mt-2 w-full rounded-lg border border-[#E5E1D8] p-3 text-sm" />
                  </label>
                </Card>

                <div className="flex justify-end gap-2">
                  <Btn secondary onClick={() => notify('Request saved as draft.')}>Save draft</Btn>
                  <button type="submit" className="min-h-10 rounded-lg bg-ink px-4 text-sm font-semibold text-white">
                    Submit request
                  </button>
                </div>
              </form>

              <Card title="What this affects">
                <div className="rounded-lg bg-[#F3EBDD] p-4">
                  <p className="text-xs text-[#4A5568]">Estimated monthly cost</p>
                  <b className="serif mt-1 block text-2xl">₹1.2L / mo</b>
                  <p className="mt-2 text-xs">Estimated runway: <b>9 → 8.2 months</b></p>
                </div>
                <p className="mt-3 text-[11px] leading-5 text-[#4A5568]">
                  Illustrative estimate based on current finance data. Confirm budget with an Owner before publishing.
                </p>
              </Card>
            </div>
          </>
        )}

        {is('editor') && startupOrg && (
          <StartupJobEditorView
            org={startupOrg}
            myRole={startupOrg.my_role}
            pageHead={pageHead}
            notify={notify}
          />
        )}

        {is('job') && startupOrg && (
          <StartupJobDetailView
            org={startupOrg}
            myRole={startupOrg.my_role}
            jobId={jobId}
            pageHead={pageHead}
            notify={notify}
          />
        )}

        {is('candidate') && startupOrg && (
          <StartupApplicantDetailView
            org={startupOrg}
            myRole={startupOrg.my_role}
            jobId={jobId}
            applicantId={applicantId}
            pageHead={pageHead}
            notify={notify}
            onOpenScheduleModal={(target) => setScheduleTarget(target)}
          />
        )}

        {is('talent') && (
          <>
            {pageHead(
              'Talent search',
              'Find candidates who chose to be discoverable.',
              <Link href="/startup/hiring" className="text-sm font-semibold text-[#9A7A45]">
                Back to hiring
              </Link>
            )}

            {!verified && (
              <div className="mb-4 rounded-lg border border-[#E7D4B0] bg-[#FFF8E8] p-3 text-xs text-[#806236]">
                <LockKeyhole className="mr-2 inline" size={14} />
                Search results are available. Verify your employer profile to message candidates.
              </div>
            )}

            <div className="grid items-start gap-5 lg:grid-cols-4">
              <aside className="rounded-xl border border-[#E5E1D8] bg-white p-5">
                <h2 className="font-semibold">Filters</h2>
                <label className="mt-4 block text-xs font-medium">
                  Role or keywords
                  <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="e.g. backend engineer"
                    className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] px-3"
                  />
                </label>
                {[
                  ['Skills', 'Node.js, AWS'],
                  ['Experience', '3–7 years'],
                  ['Location', 'Any location'],
                  ['Availability', 'Anytime'],
                ].map(([x, ph]) => (
                  <label key={x} className="mt-4 block text-xs font-medium">
                    {x}
                    <input placeholder={ph} className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] px-3" />
                  </label>
                ))}
                <label className="mt-4 flex gap-2 text-xs">
                  <input type="checkbox" className="accent-ink" />Remote preference
                </label>
                <p className="mt-4 text-[10px] leading-4 text-[#4A5568]">
                  We don’t offer filters for age, gender, religion, caste, nationality or marital status.
                </p>
              </aside>

              <div className="space-y-3 lg:col-span-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-[#4A5568]">{people.length} candidates opted in to discovery</p>
                  <select className="h-9 rounded-lg border border-[#E5E1D8] bg-white px-2 text-xs">
                    <option>Relevance</option>
                    <option>Recently active</option>
                    <option>Experience</option>
                  </select>
                </div>
                {people
                  .filter(p => !query || `${p.title} ${p.skills.join(' ')}`.toLowerCase().includes(query.toLowerCase()))
                  .map(p => (
                    <article key={p.id} className="rounded-xl border border-[#E5E1D8] bg-white p-5">
                      <div className="flex flex-wrap items-start gap-3">
                        <span className="grid h-12 w-12 place-items-center rounded-full bg-[#F3EBDD] font-semibold">
                          {p.name.split(' ').map(x => x[0]).join('')}
                        </span>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold">{p.name}</h3>
                          <p className="text-xs text-[#4A5568]">{p.title} · {p.experience} · {p.location}</p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {p.skills.map(s => (
                              <span key={s} className="rounded-full bg-[#F3F4F6] px-2 py-1 text-[10px]">{s}</span>
                            ))}
                          </div>
                        </div>
                        <span className="rounded-full bg-[#E7F3EC] px-2.5 py-1 text-[10px] font-semibold text-[#286749]">
                          {p.match}
                        </span>
                      </div>
                      <details className="mt-3 text-xs">
                        <summary className="cursor-pointer font-semibold text-[#9A7A45]">Why this match?</summary>
                        <p className="mt-2 text-[#4A5568]">
                          Relevant skills overlap with the role’s requirements. Match labels explain skill overlap only; no personal attributes are considered.
                        </p>
                      </details>
                      <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-[#E5E1D8] pt-3">
                        <button
                          type="button"
                          onClick={() => notify('Message disabled until employer verification.')}
                          disabled={!verified}
                          className="rounded-lg border border-[#E5E1D8] px-3 text-xs font-semibold disabled:opacity-50"
                        >
                          Message
                        </button>
                        <button
                          type="button"
                          onClick={() => setSavedTalent(savedTalent.includes(p.id) ? savedTalent.filter(x => x !== p.id) : [...savedTalent, p.id])}
                          className="rounded-lg border border-[#E5E1D8] px-3 text-xs font-semibold"
                        >
                          <Bookmark className="mr-1 inline" size={13} />
                          {savedTalent.includes(p.id) ? 'Saved' : 'Save to shortlist'}
                        </button>
                        <button
                          type="button"
                          onClick={() => notify('Invite to apply sent.')}
                          className="rounded-lg bg-ink px-3 text-xs font-semibold text-white"
                        >
                          Invite to apply
                        </button>
                      </div>
                    </article>
                  ))}
              </div>
            </div>
          </>
        )}

        {is('interviews') && startupOrg && (
          <StartupInterviewsView
            org={startupOrg}
            myRole={startupOrg.my_role}
            pageHead={pageHead}
            notify={notify}
          />
        )}

        {is('offers') && startupOrg && (
          <StartupOffersView
            org={startupOrg}
            myRole={startupOrg.my_role}
            pageHead={pageHead}
            notify={notify}
          />
        )}

        {is('employer') && (
          <>
            {pageHead(
              'Employer page',
              'Build candidate trust and manage your company’s hiring presence.',
              <div className="flex rounded-lg border bg-white p-1">
                {['Editor', 'Public preview'].map(x => (
                  <button
                    key={x}
                    type="button"
                    onClick={() => setProfileTab(x)}
                    className={`rounded px-3 py-2 text-xs ${profileTab === x ? 'bg-ink text-white' : ''}`}
                  >
                    {x}
                  </button>
                ))}
              </div>
            )}

            {!verified && (
              <div className="mb-5 rounded-xl border border-[#E7D4B0] bg-[#FFF8E8] p-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <ShieldCheck size={18} className="text-[#9A7A45]" />Employer verification · Not started
                </h2>
                <p className="mt-2 text-xs leading-5 text-[#4A5568]">
                  Verification is required before publishing jobs or messaging candidates. We’ll review your business details in 1–2 business days.
                </p>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  {[
                    ['Business registration', 'From startup profile'],
                    ['Official email domain', 'Needs verification'],
                    ['Company website', 'acmestudio.example'],
                  ].map(([a, b]) => (
                    <p key={a} className="rounded-lg bg-white p-3 text-xs">
                      <CheckCircle2 className="mr-1 inline text-[#9A7A45]" size={14} />{a}
                      <small className="mt-1 block text-[#4A5568]">{b}</small>
                    </p>
                  ))}
                </div>
                <Btn onClick={() => { setVerified(true); notify('Verification request submitted for review.'); }}>
                  <ShieldCheck size={15} /> Submit for verification
                </Btn>
              </div>
            )}

            <div className="grid gap-5 lg:grid-cols-2">
              <Card title="Company page editor">
                <label className="block text-sm font-medium">
                  Tagline
                  <input defaultValue="Making financial operations conversion effortless for growing businesses." className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] px-3 text-sm" />
                </label>
                <label className="mt-4 block text-sm font-medium">
                  About us
                  <textarea rows={5} defaultValue="Acme Studio is building tools that give growing businesses a clear view of cash flow and confident decisions." className="mt-2 w-full rounded-lg border border-[#E5E1D8] p-3 text-sm" />
                </label>
                <label className="mt-4 block text-sm font-medium">
                  Mission
                  <input defaultValue="Help every ambitious business make better financial decisions." className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] px-3 text-sm" />
                </label>
                <button type="button" onClick={() => notify('Employer page saved.')} className="mt-4">
                  <Btn>Save employer page</Btn>
                </button>
              </Card>

              <Card title={profileTab === 'Editor' ? 'Candidate preview' : 'Public employer page preview'}>
                <div className="h-24 rounded-t-xl bg-ink" />
                <div className="px-4 pb-4">
                  <div className="-mt-8 grid h-16 w-16 place-items-center rounded-xl border-4 border-white bg-[#F3EBDD] text-xl font-bold">
                    A
                  </div>
                  <h2 className="serif mt-2 text-xl font-semibold">Acme Studio</h2>
                  <p className="mt-1 text-xs text-[#4A5568]">Making financial operations effortless for growing businesses.</p>
                  <p className="mt-4 text-xs leading-5 text-[#4A5568]">
                    Building helpful finance tools for ambitious teams. Product-focused, thoughtful, and remote-friendly.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <span className="rounded-full bg-[#F3F4F6] px-2 py-1 text-[10px]">Prototype</span>
                    <span className="rounded-full bg-[#F3F4F6] px-2 py-1 text-[10px]">Fintech</span>
                  </div>
                  <h3 className="mt-5 text-sm font-semibold">Open jobs</h3>
                  <p className="mt-2 text-xs text-[#4A5568]">
                    {jobs.filter(j => j.status === 'Open').length} roles · Kolkata and remote
                  </p>
                </div>
              </Card>

              <Card title="Hiring preferences">
                <label className="flex items-center justify-between text-xs">
                  Default blind review
                  <input type="checkbox" className="accent-ink" />
                </label>
                <label className="mt-4 flex items-center justify-between text-xs">
                  Default acknowledgement to candidates
                  <input type="checkbox" defaultChecked className="accent-ink" />
                </label>
                <label className="mt-4 block text-xs">
                  Working hours
                  <input defaultValue="10:00 AM – 6:00 PM · Asia/Kolkata" className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] px-3" />
                </label>
              </Card>

              <Card title="Trust & safety">
                <p className="text-xs leading-5 text-[#4A5568]">
                  Never charge candidates fees. Evaluate fairly using job-related criteria. Candidate data is shared only with consent and is retained according to your configured policy.
                </p>
                <button type="button" onClick={() => notify('Support request opened.')} className="mt-3 text-xs font-semibold text-[#9A7A45]">
                  Contact support <ArrowRight className="inline" size={13} />
                </button>
              </Card>
            </div>
          </>
        )}
        </>
        )}
      </main>

      {scheduleTarget && startupOrg && (
        <ScheduleInterviewModal
          orgId={startupOrg.id}
          initialJobId={scheduleTarget.jobId}
          initialApplicationId={scheduleTarget.applicationId}
          onClose={() => setScheduleTarget(null)}
          notify={notify}
        />
      )}

      {/* Modals */}
      {(modal === 'interview' || modal === 'offer' || modal === 'quick') && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[#0F1B2D]/45 p-4">
          <section role="dialog" aria-modal="true" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="serif text-2xl font-semibold">
                {modal === 'interview' ? 'Schedule interview' : modal === 'offer' ? 'Create offer' : `Quick actions · ${activeApplicant?.name}`}
              </h2>
              <button type="button" onClick={() => setModal('')} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            {modal === 'interview' ? (
              <div className="space-y-3">
                <label className="block text-sm">
                  Candidate
                  <select className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] bg-white px-3">
                    <option>Ananya Sen · Backend Engineer</option>
                    <option>Ishita Roy · Backend Engineer</option>
                    <option>Kabir Shah · Product Designer</option>
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
                  Round
                  <select className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] bg-white px-3">
                    <option>Screening call</option>
                    <option>Technical interview</option>
                    <option>Founder chat</option>
                  </select>
                </label>
                <label className="block text-sm">
                  Format
                  <select className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] bg-white px-3">
                    <option>Video</option>
                    <option>Phone</option>
                    <option>On-site</option>
                  </select>
                </label>
                <p className="text-xs text-[#4A5568]">Timezone: Asia/Kolkata · offer 3–5 time slots when possible</p>
              </div>
            ) : modal === 'offer' ? (
              <div className="space-y-3">
                <label className="block text-sm">
                  Candidate
                  <select className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] bg-white px-3">
                    <option>Ananya Sen · Backend Engineer</option>
                    <option>Kabir Shah · Product Designer</option>
                  </select>
                </label>
                <label className="block text-sm">
                  Base compensation
                  <input placeholder="₹18 LPA" className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] px-3" />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-sm">
                    Start date
                    <input type="date" className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] px-3" />
                  </label>
                  <label className="block text-sm">
                    Offer expires
                    <input type="date" className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] px-3" />
                  </label>
                </div>
                <p className="rounded-lg bg-[#FFF8E8] p-3 text-xs text-[#806236]">
                  Review offer letter and contract terms with legal counsel.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => { notify('Candidate shortlisted.'); setModal(''); }}
                  className="block w-full rounded-lg p-3 text-left text-sm hover:bg-[#FAF8F4]"
                >
                  Shortlist candidate
                </button>
                <button
                  type="button"
                  onClick={() => { notify('Interview scheduling opened.'); setModal('interview'); }}
                  className="block w-full rounded-lg p-3 text-left text-sm hover:bg-[#FAF8F4]"
                >
                  Schedule interview
                </button>
                <button
                  type="button"
                  onClick={() => { notify('Rejection flow requires a reason and candidate message.'); setModal(''); }}
                  className="block w-full rounded-lg p-3 text-left text-sm text-[#B42318] hover:bg-[#FAF8F4]"
                >
                  Reject with reason
                </button>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setModal('')} className="min-h-10 px-4 text-sm">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setModal('');
                  notify(modal === 'interview' ? 'Interview invite prepared.' : modal === 'offer' ? 'Offer draft created.' : 'Done');
                }}
                className="min-h-10 rounded-lg bg-ink px-4 text-sm font-semibold text-white"
              >
                {modal === 'interview' ? 'Send invite' : modal === 'offer' ? 'Save offer draft' : 'Done'}
              </button>
            </div>
          </section>
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
