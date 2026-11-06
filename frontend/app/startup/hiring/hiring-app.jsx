'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard, Compass, ListTodo, Users, FolderLock, Lightbulb, Briefcase,
  ChartNoAxesColumn, Settings, CircleHelp, Search, Bell, ChevronDown, ChevronRight,
  ArrowRight, ArrowUpRight, Plus, MapPin, Clock, CalendarDays, CheckCircle2,
  AlertCircle, MoreHorizontal, Filter, Send, ShieldCheck, LockKeyhole, FileText,
  Video, Mail, X, Building2, Download, Share2, Edit3, Globe, Star, MessageCircle,
  Check, UserRound, ExternalLink, Eye, BriefcaseBusiness, Wallet, Upload, Bookmark
} from 'lucide-react';

const nav = [
  ['Dashboard', LayoutDashboard, '/startup/dashboard'],
  ['Stage toolkit', Compass, '/startup/stage'],
  ['Tasks & milestones', ListTodo, '/startup/tasks'],
  ['Team', Users, '/startup/team'],
  ['Startup profile', Building2, '/startup/profile'],
  ['Documents', FolderLock, '/startup/stage'],
  ['Mentor', Lightbulb, '/startup/mentors'],
  ['Investors', Briefcase, '/startup/investors'],
  ['Hiring', Briefcase, '/startup/hiring'],
  ['Analytics', ChartNoAxesColumn, '/startup/analytics'],
];

const jobSeed = [
  { id: 'job-01', title: 'Backend Engineer', department: 'Engineering', location: 'Remote · India', type: 'Full-time', status: 'Open', posted: 'Oct 28, 2026', applicants: 32, stages: [14, 9, 6, 2], owner: 'Aarav Kapoor', new: 6 },
  { id: 'job-02', title: 'Product Designer', department: 'Product', location: 'Kolkata · Hybrid', type: 'Full-time', status: 'Open', posted: 'Oct 21, 2026', applicants: 28, stages: [13, 8, 5, 2], owner: 'Priya Menon', new: 3 },
  { id: 'job-03', title: 'Growth Associate', department: 'Sales', location: 'Remote · India', type: 'Draft', posted: 'Draft · Oct 30', applicants: 0, stages: [0, 0, 0, 0], owner: 'Aarav Kapoor', new: 0 }
];

const peopleSeed = [
  { id: 'c-1', name: 'Ananya Sen', title: 'Senior Backend Engineer', location: 'Bengaluru, India', experience: '6 years', skills: ['Node.js', 'PostgreSQL', 'AWS'], match: 'Strong skills match', applied: '2 days ago', source: 'Platform', stage: 'Applied', rating: 4.5, consent: true },
  { id: 'c-2', name: 'Rohan Mehta', title: 'Full-stack Engineer', location: 'Pune, India', experience: '4 years', skills: ['TypeScript', 'Node.js', 'Redis'], match: 'Good skills match', applied: '3 days ago', source: 'Referral', stage: 'Shortlisted', rating: 4.2, consent: true },
  { id: 'c-3', name: 'Ishita Roy', title: 'Platform Engineer', location: 'Kolkata, India', experience: '5 years', skills: ['Go', 'AWS', 'Kubernetes'], match: 'Strong skills match', applied: '5 days ago', source: 'Platform', stage: 'Interview', rating: 4.8, consent: false },
  { id: 'c-4', name: 'Kabir Shah', title: 'Backend Developer', location: 'Remote · India', experience: '3 years', skills: ['Python', 'PostgreSQL', 'Docker'], match: 'Relevant experience', applied: '1 week ago', source: 'Jobs marketplace', stage: 'Applied', rating: 3.9, consent: true }
];

const pipeline = ['Applied', 'Shortlisted', 'Interview', 'Offer', 'Hired'];

function Btn({ children, onClick, secondary = false, className = '' }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-[9px] px-3.5 text-sm font-semibold transition ${
        secondary
          ? 'border border-[#E5E1D8] bg-white text-ink hover:bg-[#F4F1EA]'
          : 'bg-ink text-white hover:bg-[#1C2B42]'
      } ${className}`}
    >
      {children}
    </button>
  );
}

function Card({ title, children, action }) {
  return (
    <section className="rounded-xl border border-[#E5E1D8] bg-white p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function Hiring({ page = 'overview', jobId = 'job-01', applicantId = 'c-1' }) {
  const router = useRouter();
  const [jobs, setJobs] = useState(jobSeed);
  const [candidates, setCandidates] = useState(peopleSeed);
  const [tab, setTab] = useState('Jobs');
  const [filter, setFilter] = useState('All statuses');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');
  const [modal, setModal] = useState('');
  const [requestTitle, setRequestTitle] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [saved, setSaved] = useState(false);
  const [activeApplicant, setActiveApplicant] = useState(
    candidates.find(p => p.id === applicantId) || candidates[0]
  );
  const [stage, setStage] = useState(activeApplicant?.stage || 'Applied');
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

  const currentJob = jobs.find(j => j.id === jobId) || jobs[0];
  const is = (x) => page === x;

  // Handle stage change reactively
  const handleStageChange = (candId, newStage, candName) => {
    setCandidates(prev => prev.map(c => c.id === candId ? { ...c, stage: newStage } : c));
    if (activeApplicant?.id === candId) {
      setActiveApplicant(prev => ({ ...prev, stage: newStage }));
      setStage(newStage);
    }
    notify(`Moved ${candName || 'candidate'} to ${newStage}.`);
  };

  // Keyboard Escape listener & body scroll locking when modal is open
  useEffect(() => {
    if (!modal) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setModal('');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [modal]);

  const shell = (
    <>
      <a href="#hiring-main" className="sr-only focus:not-sr-only">Skip to content</a>
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[240px] flex-col bg-[#0F1B2D] text-white lg:flex">
        <div className="flex h-[76px] items-center gap-3 border-b border-white/10 px-6">
          <span className="grid h-9 w-9 place-items-center rounded-full border border-white/30 font-serif">F</span>
          <b>forma <small className="ml-1 font-normal text-white/50">WORKSPACE</small></b>
        </div>
        <p className="px-6 pb-2 pt-5 text-xs font-semibold uppercase tracking-[.16em] text-white/40">Startup</p>
        <nav className="px-3">
          {nav.map(([n, I, url]) => (
            <Link
              href={n === 'Hiring' ? '/startup/hiring' : url}
              key={n}
              className={`relative mb-1 flex h-11 items-center gap-3 rounded-lg px-3 text-[13px] ${
                n === 'Hiring' ? 'bg-[#1C2B42] text-white' : 'text-white/65 hover:bg-white/5 hover:text-white'
              }`}
            >
              {n === 'Hiring' && <span className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r bg-[#B8955A]"/>}
              <I size={18}/>
              {n}
            </Link>
          ))}
        </nav>
        <div className="mt-4 px-3">
          {[
            ['Overview', '/startup/hiring'],
            ['Talent search', '/startup/hiring/talent'],
            ['Interviews', '/startup/hiring/interviews'],
            ['Offers', '/startup/hiring/offers'],
            ['Employer page', '/startup/hiring/employer-page']
          ].map(([n, u]) => (
            <Link
              key={n}
              href={u}
              className={`mb-1 block rounded-lg py-2 pl-11 text-xs ${
                ((n === 'Overview' && page === 'overview') ||
                 (n === 'Talent search' && page === 'talent') ||
                 (n === 'Interviews' && page === 'interviews') ||
                 (n === 'Offers' && page === 'offers') ||
                 (n === 'Employer page' && page === 'employer'))
                  ? 'bg-white/10 text-white'
                  : 'text-white/55 hover:bg-white/5 hover:text-white'
              }`}
            >
              {n}
            </Link>
          ))}
        </div>
        <div className="mt-auto space-y-1 px-3 pb-5">
          <Link
            href="/startup/profile"
            className="flex h-11 w-full items-center gap-3 px-3 text-sm text-white/60 transition hover:bg-white/5 hover:text-white rounded-lg"
          >
            <Settings size={18}/>Settings
          </Link>
          <Link
            href="/help"
            className="flex h-11 w-full items-center gap-3 px-3 text-sm text-white/60 transition hover:bg-white/5 hover:text-white rounded-lg"
          >
            <CircleHelp size={18}/>Help & support
          </Link>
          <div className="flex items-center gap-3 rounded-lg border border-white/10 p-3">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[#F3EBDD] text-xs font-bold text-ink">AK</span>
            <span>
              <b className="block text-xs">Aarav Kapoor</b>
              <small className="text-white/50">Founder · switch role</small>
            </span>
          </div>
        </div>
      </aside>
      <header className="sticky top-0 z-10 flex h-[68px] items-center justify-between border-b border-[#E5E1D8] bg-[#FAF8F4]/95 px-4 backdrop-blur sm:px-7 lg:ml-[240px]">
        <div className="relative hidden sm:block">
          <Search className="absolute left-3 top-2.5 text-[#A0A7B4]" size={17}/>
          <input placeholder="Search workspace" className="h-10 w-64 rounded-lg border border-[#E5E1D8] bg-white pl-9 text-sm"/>
        </div>
        <Link href="/startup/dashboard" className="text-sm font-semibold sm:hidden">← Dashboard</Link>
        <button onClick={() => notify('You’re all caught up.')} aria-label="Notifications" className="relative ml-auto grid h-10 w-10 place-items-center">
          <Bell size={19}/>
          <i className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#B8955A]"/>
        </button>
        <span className="ml-3 flex items-center gap-2 text-xs">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-ink font-semibold text-white">AK</span>
          <span className="hidden sm:block">Aarav Kapoor</span>
          <ChevronDown size={14}/>
        </span>
      </header>
    </>
  );

  const pageHead = (title, sub, actions) => (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-sm text-[#4A5568]">Acme Studio <span className="mx-2 text-[#806236]">·</span> Hiring</p>
        <h1 className="serif mt-1 text-[30px] font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-[#4A5568]">{sub}</p>
      </div>
      <div className="flex flex-wrap gap-2">{actions}</div>
    </div>
  );

  const jobCards = jobs
    .filter(j => (filter === 'All statuses' || j.status === filter) && (!search || j.title.toLowerCase().includes(search.toLowerCase())))
    .map(j => (
      <article key={j.id} className="rounded-xl border border-[#E5E1D8] bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href={`/startup/hiring/${j.id}`} className="text-base font-semibold hover:underline">{j.title}</Link>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#4A5568]">
              <span>{j.department}</span>
              <span><MapPin className="mr-1 inline" size={12}/>{j.location}</span>
              <span>{j.type}</span>
              <span>Posted {j.posted}</span>
            </div>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            j.status === 'Open' ? 'bg-[#E7F3EC] text-[#1E5D41]' : j.status === 'Draft' ? 'bg-[#F3F4F6] text-[#4A5568]' : 'bg-[#FFF3D6] text-[#8A5700]'
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
            {j.new > 0 && <span className="rounded-full bg-[#F3EBDD] px-2 py-0.5 text-xs font-semibold text-[#6B4F26]">+{j.new} new</span>}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#4A5568]">Owner: {j.owner}</span>
            <Link href={`/startup/hiring/${j.id}`} className="text-xs font-semibold text-[#806236] hover:underline">
              View pipeline <ArrowRight className="inline" size={13}/>
            </Link>
            <button onClick={() => notify(`${j.title} options opened.`)} aria-label="Job options">
              <MoreHorizontal size={18}/>
            </button>
          </div>
        </div>
      </article>
    ));

  return (
    <div className="min-h-screen bg-[#FAF8F4] text-[#0F1B2D]">
      {shell}
      <main id="hiring-main" className="mx-auto max-w-[1440px] px-4 pb-16 pt-7 sm:px-7 lg:ml-[240px] lg:px-8">
        {is('overview') && (
          <>
            {pageHead(
              'Hiring',
              'Find the people who will build what’s next.',
              <>
                <Link
                  href="/startup/hiring/requests/new"
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[9px] border border-[#E5E1D8] bg-white px-3.5 text-sm font-semibold text-ink hover:bg-[#F4F1EA] transition"
                >
                  <Plus size={16}/> Hiring request
                </Link>
                <Link
                  href="/startup/hiring/jobs/new"
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[9px] bg-ink px-3.5 text-sm font-semibold text-white hover:bg-[#1C2B42] transition"
                >
                  <Plus size={16}/> Job post
                </Link>
              </>
            )}

            {!verified && (
              <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-[#E7D4B0] bg-[#FFF8E8] p-4 text-sm">
                <ShieldCheck size={19} className="text-[#806236]"/>
                <span className="flex-1">
                  <b>Verify your startup to publish jobs and show the verified badge.</b>
                  <small className="block text-xs text-[#4A5568]">Verification usually takes 1–2 business days.</small>
                </span>
                <Link href="/startup/hiring/employer-page" className="rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white hover:bg-[#1C2B42] transition">
                  Verify now
                </Link>
              </div>
            )}

            <div className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[#E5E1D8] bg-[#E5E1D8] sm:grid-cols-5">
              {[
                ['Open jobs', 3],
                ['Total applicants', 86],
                ['Interviews this week', 5],
                ['Offers out', 2],
                ['Avg time to hire', '28d']
              ].map(([n, v]) => (
                <div key={n} className="bg-white p-4 sm:px-5">
                  <p className="text-xs text-[#4A5568]">{n}</p>
                  <b className="serif mt-1 block text-2xl">{v}</b>
                </div>
              ))}
            </div>

            <div className="mb-5 flex gap-1 rounded-xl border border-[#E5E1D8] bg-white p-1">
              {['Jobs', 'Requests', 'Needs attention'].map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`min-h-10 rounded-lg px-4 text-sm transition ${tab === t ? 'bg-ink font-semibold text-white' : 'text-[#4A5568] hover:bg-[#FAF8F4]'}`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="grid items-start gap-5 xl:grid-cols-3">
              <div className="space-y-3 xl:col-span-2">
                {tab === 'Jobs' ? (
                  <>
                    <div className="mb-2 flex flex-wrap gap-2">
                      <div className="relative min-w-[180px] flex-1">
                        <Search className="absolute left-3 top-2.5 text-[#A0A7B4]" size={16}/>
                        <input
                          value={search}
                          onChange={e => setSearch(e.target.value)}
                          placeholder="Search job title"
                          className="h-10 w-full rounded-lg border border-[#E5E1D8] pl-9 text-sm"
                        />
                      </div>
                      <select
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                        className="h-10 rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs"
                      >
                        <option>All statuses</option>
                        <option>Open</option>
                        <option>Draft</option>
                        <option>Paused</option>
                        <option>Closed</option>
                      </select>
                    </div>
                    {jobCards}
                  </>
                ) : tab === 'Requests' ? (
                  <Card
                    title="Hiring requests"
                    action={
                      <Link href="/startup/hiring/requests/new" className="text-xs font-semibold text-[#806236] hover:underline">
                        + New request
                      </Link>
                    }
                  >
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[650px] text-left text-xs">
                        <thead className="border-b text-[#4A5568]">
                          <tr>
                            {['Role', 'Department', 'Urgency', 'Headcount', 'Target start', 'Status', ''].map(x => (
                              <th key={x} className="py-3 font-semibold">{x}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            ['Backend Engineer', 'Engineering', 'High', '1', 'Dec 01', 'Approved'],
                            ['Product Designer', 'Product', 'Medium', '1', 'Dec 15', 'Pending approval'],
                            ['Growth Associate', 'Sales', 'Low', '1', 'Jan 05', 'Draft']
                          ].map((r) => (
                            <tr key={r[0]} className="border-b border-[#E5E1D8]">
                              <td className="py-4 font-semibold">{r[0]}</td>
                              {r.slice(1).map((x, j) => (
                                <td className="py-4 text-[#4A5568]" key={j}>{x}</td>
                              ))}
                              <td>
                                <Link href="/startup/hiring/jobs/new" className="font-semibold text-[#806236] hover:underline">
                                  Create job post
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                ) : (
                  <Card title="Needs attention">
                    <div className="space-y-3">
                      {[
                        ['6 new applicants to review', 'Backend Engineer · applied over 3 days ago'],
                        ['2 interviews need feedback', 'Ishita Roy · Technical round'],
                        ['1 offer expires in 48 hours', 'Senior Product Designer · expires Nov 07'],
                        ['Candidate waiting for an update', 'Kunal Das · applied 16 days ago'],
                        ['Job has no applicants after 14 days', 'Growth Associate · improve the job post']
                      ].map(([h, d]) => (
                        <div key={h} className="flex items-center gap-3 rounded-lg border border-[#E5E1D8] p-3">
                          <AlertCircle className="text-[#8A5700] shrink-0" size={18}/>
                          <span className="flex-1">
                            <b className="block text-xs">{h}</b>
                            <small className="text-xs text-[#4A5568]">{d}</small>
                          </span>
                          <button onClick={() => notify('Opening the relevant hiring item.')} className="text-xs font-semibold text-[#806236] hover:underline">
                            Review <ArrowRight className="inline" size={13}/>
                          </button>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </div>

              <aside className="space-y-5">
                <Card title="From your stage plan">
                  <p className="mb-3 text-xs text-[#4A5568]">Prototype teams often hire engineers and a designer. Suggestions only.</p>
                  {[
                    ['Backend engineer', 'High priority'],
                    ['Product designer', 'Medium priority'],
                    ['User researcher', 'Optional']
                  ].map(([a, b]) => (
                    <div key={a} className="flex items-center justify-between border-t border-[#E5E1D8] py-3">
                      <span>
                        <b className="block text-xs">{a}</b>
                        <small className="text-xs text-[#4A5568]">{b}</small>
                      </span>
                      <Link href="/startup/hiring/requests/new" className="text-xs font-semibold text-[#806236] hover:underline">
                        Add request +
                      </Link>
                    </div>
                  ))}
                </Card>

                <Card
                  title="Upcoming interviews"
                  action={
                    <Link href="/startup/hiring/interviews" className="text-xs font-semibold text-[#806236] hover:underline">
                      View all
                    </Link>
                  }
                >
                  {[
                    ['Nov 06 · 10:30', 'Ananya Sen', 'Backend Engineer'],
                    ['Nov 06 · 14:00', 'Ishita Roy', 'Backend Engineer'],
                    ['Nov 07 · 11:00', 'Kabir Shah', 'Product Designer']
                  ].map(([d, n, j]) => (
                    <div key={n} className="flex items-center gap-3 border-t border-[#E5E1D8] py-3">
                      <CalendarDays size={15} className="text-[#806236] shrink-0"/>
                      <span>
                        <b className="block text-xs">{n}</b>
                        <small className="text-xs text-[#4A5568]">{d} · {j}</small>
                      </span>
                    </div>
                  ))}
                </Card>

                <Card title="Hiring budget">
                  <div className="flex justify-between text-xs">
                    <span>₹4.2L used</span>
                    <span>₹8L planned</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-[#E5E1D8]">
                    <div className="h-full w-[52%] rounded-full bg-[#B8955A]"/>
                  </div>
                  <p className="mt-2 text-xs text-[#4A5568]">Estimate · includes approved roles only</p>
                  <Link href="/startup/analytics" className="mt-3 inline-block text-xs font-semibold text-[#806236] hover:underline">
                    View runway impact <ArrowRight className="inline" size={13}/>
                  </Link>
                </Card>

                <Card title="Posting plan">
                  <p className="text-xs text-[#4A5568]">2 of 3 free posts used this month.</p>
                  <button onClick={() => notify('Billing options opened.')} className="mt-3 text-xs font-semibold text-[#806236] hover:underline">
                    Plan and fees <ArrowRight className="inline" size={13}/>
                  </button>
                </Card>
              </aside>
            </div>
          </>
        )}

        {is('request') && (
          <>
            {pageHead(
              'New hiring request',
              'Capture the hiring need before drafting a job post.',
              <Link href="/startup/hiring" className="text-sm text-[#4A5568] hover:underline">
                Cancel
              </Link>
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
                      <input type="number" min="1" max="20" defaultValue="1" className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] px-3"/>
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
                      <input placeholder="₹80,000 – ₹1,20,000" className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] px-3 text-sm"/>
                    </label>
                    <label className="text-sm font-medium">
                      Target start date
                      <input type="date" className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] px-3"/>
                    </label>
                  </div>
                  <label className="mt-4 block text-sm font-medium">
                    Skills and must-haves
                    <input placeholder="Add relevant skills, separated by commas" className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] px-3 text-sm"/>
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
                    <textarea rows={3} placeholder="How will this hire move the startup forward?" className="mt-2 w-full rounded-lg border border-[#E5E1D8] p-3 text-sm"/>
                  </label>
                </Card>

                <div className="flex justify-end gap-2">
                  <Btn secondary onClick={() => notify('Request saved as draft.')}>Save draft</Btn>
                  <button type="submit" className="min-h-10 rounded-lg bg-ink px-4 text-sm font-semibold text-white hover:bg-[#1C2B42] transition">
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
                <p className="mt-3 text-xs leading-5 text-[#4A5568]">
                  Illustrative estimate based on current finance data. Confirm budget with an Owner before publishing.
                </p>
              </Card>
            </div>
          </>
        )}

        {is('editor') && (
          <>
            {pageHead(
              'Create a job post',
              'Tell candidates what the role involves and what success looks like.',
              <button onClick={() => setSaved(true)} className="min-h-10 rounded-lg border border-[#E5E1D8] bg-white px-3 text-sm font-semibold hover:bg-[#FAF8F4] transition">
                Save draft
              </button>
            )}

            {saved && (
              <p className="mb-4 rounded-lg bg-[#E7F3EC] p-3 text-xs font-semibold text-[#1E5D41]">
                Draft saved · just now
              </p>
            )}

            <div className="grid items-start gap-5 xl:grid-cols-5">
              <form
                onSubmit={e => {
                  e.preventDefault();
                  notify('Job saved as a draft. Employer verification is required before publishing.');
                }}
                className="space-y-5 xl:col-span-3"
              >
                <Card title="Basics">
                  <div className="space-y-4">
                    <label className="block text-sm font-medium">
                      Job title
                      <input
                        required
                        minLength={3}
                        maxLength={80}
                        value={jobTitle}
                        onChange={e => setJobTitle(e.target.value)}
                        placeholder="e.g. Backend Engineer"
                        className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] px-3"
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        ['Department', ['Engineering', 'Product', 'Sales', 'Operations']],
                        ['Employment type', ['Full-time', 'Part-time', 'Contract']],
                        ['Work mode', ['Remote', 'Hybrid', 'On-site']],
                        ['Location', ['Remote · India', 'Kolkata', 'Bengaluru']]
                      ].map(([label, opts]) => (
                        <label key={label} className="text-sm font-medium">
                          {label}
                          <select className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 text-sm">
                            {opts.map(o => <option key={o}>{o}</option>)}
                          </select>
                        </label>
                      ))}
                    </div>
                  </div>
                </Card>

                <Card title="Description">
                  <div className="space-y-3">
                    {[
                      ['About the role', 'Describe the role and its impact.'],
                      ["What you'll do", 'List responsibilities.'],
                      ["What we're looking for", 'Share essential skills and experience.'],
                      ['What we offer', 'Compensation, benefits and flexibility.']
                    ].map(([label, ph]) => (
                      <label key={label} className="block text-sm font-medium">
                        {label}
                        <textarea rows={3} placeholder={ph} className="mt-2 w-full rounded-lg border border-[#E5E1D8] p-3 text-sm"/>
                      </label>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => notify('AI suggestions are not connected yet. Review any suggested wording yourself.')}
                    className="mt-3 rounded-full bg-[#F3EBDD] px-3 py-2 text-xs font-semibold text-[#6B4F26] hover:bg-[#EADFCF] transition"
                  >
                    AI suggestion · Improve wording
                  </button>
                  <p className="mt-2 text-xs text-[#4A5568]">AI helps with wording only. You make all hiring decisions.</p>
                </Card>

                <Card title="Requirements & compensation">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-sm">
                      Must-have skills
                      <input placeholder="Up to 5 essentials" className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs"/>
                    </label>
                    <label className="text-sm">
                      Salary range
                      <input placeholder="₹10–15 LPA" className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs"/>
                    </label>
                  </div>
                  <label className="mt-4 flex items-center gap-2 text-xs">
                    <input type="checkbox" defaultChecked className="accent-ink"/> Show salary publicly
                  </label>
                </Card>

                <Card title="Hiring process">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" className="accent-ink"/> Enable blind review for first screening
                  </label>
                  <label className="mt-4 flex items-center gap-2 text-sm">
                    <input type="checkbox" className="accent-ink"/> Allow candidates to share interview practice scores
                  </label>
                </Card>

                <Card title="Publish settings">
                  <label className="block text-sm">
                    Visibility
                    <select className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] bg-white px-3">
                      <option>Public on Jobs marketplace</option>
                      <option>Platform members only</option>
                      <option>Link only</option>
                    </select>
                  </label>
                  <p className="mt-3 rounded-lg border border-[#E7D4B0] bg-[#FFF8E8] p-3 text-xs text-[#8A5700]">
                    Verify your employer profile before publishing. A draft can be saved now.
                  </p>
                </Card>

                <div className="flex justify-end gap-2">
                  <Btn secondary onClick={() => setSaved(true)}>Save draft</Btn>
                  <Btn onClick={() => { setSaved(true); notify('Draft saved. Verify employer to publish.'); }}>
                    Save job draft
                  </Btn>
                </div>
              </form>

              <div className="xl:sticky xl:top-24 xl:col-span-2">
                <Card title="Candidate preview" action={<Eye size={16}/>}>
                  <div className="rounded-xl border border-[#E5E1D8] p-5">
                    <div className="flex items-center gap-3">
                      <span className="grid h-11 w-11 place-items-center rounded-lg bg-[#F3EBDD] font-bold text-ink">A</span>
                      <div>
                        <p className="text-sm font-semibold">Acme Studio</p>
                        <p className="text-xs text-[#4A5568]">Verified employer pending</p>
                      </div>
                    </div>
                    <h2 className="serif mt-5 text-2xl font-semibold">{jobTitle || 'Your job title'}</h2>
                    <p className="mt-2 text-xs text-[#4A5568]">Engineering · Full-time · Remote · India</p>
                    <div className="mt-4 flex gap-2">
                      <span className="rounded-full bg-[#F3F4F6] px-2.5 py-1 text-xs text-[#4A5568]">Full-time</span>
                      <span className="rounded-full bg-[#F3F4F6] px-2.5 py-1 text-xs text-[#4A5568]">Remote</span>
                    </div>
                    <p className="mt-5 text-sm font-semibold">About the role</p>
                    <p className="mt-2 text-xs leading-5 text-[#4A5568]">Your job description preview will appear here as you write.</p>
                    <p className="mt-5 text-sm font-semibold">What we’re looking for</p>
                    <p className="mt-2 text-xs leading-5 text-[#4A5568]">Add clear and inclusive must-have criteria.</p>
                    <button disabled className="mt-5 min-h-10 w-full rounded-lg bg-ink text-xs font-semibold text-white opacity-50 cursor-not-allowed">
                      Apply for this job
                    </button>
                  </div>
                </Card>
              </div>
            </div>
          </>
        )}

        {is('job') && (
          <>
            {pageHead(
              currentJob.title,
              `${currentJob.department} · ${currentJob.location} · ${currentJob.type}`,
              <>
                <Btn secondary onClick={() => notify('Job link copied.')}>
                  <Share2 size={15}/> Share
                </Btn>
                <Link
                  href="/startup/hiring/jobs/new"
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#E5E1D8] bg-white px-3 text-sm font-semibold hover:bg-[#FAF8F4] transition"
                >
                  <Edit3 size={15}/> Edit job
                </Link>
                <button
                  onClick={() => setJobs(jobs.map(j => j.id === jobId ? { ...j, status: j.status === 'Paused' ? 'Open' : 'Paused' } : j))}
                  className="min-h-10 rounded-lg border border-[#E5E1D8] bg-white px-3 text-sm font-semibold hover:bg-[#FAF8F4] transition"
                >
                  {currentJob.status === 'Paused' ? 'Resume' : 'Pause'}
                </button>
              </>
            )}

            <div className="mb-5 flex flex-wrap gap-2">
              {['Pipeline', 'Applicants', 'Job post', 'Team & scorecards', 'Insights'].map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`min-h-10 rounded-lg px-4 text-sm transition ${tab === t ? 'bg-ink text-white font-semibold' : 'border border-[#E5E1D8] bg-white text-[#4A5568] hover:bg-[#FAF8F4]'}`}
                >
                  {t}
                </button>
              ))}
            </div>

            {tab === 'Pipeline' ? (
              <div className="overflow-x-auto pb-4">
                <div className="flex min-w-[1150px] gap-4">
                  {pipeline.map(st => (
                    <section key={st} className="w-[220px] shrink-0 rounded-xl bg-[#F4F1EA] p-3">
                      <h2 className="mb-3 flex justify-between text-sm font-semibold">
                        {st}
                        <span className="text-xs text-[#4A5568]">{candidates.filter(p => p.stage === st).length}</span>
                      </h2>
                      {candidates.filter(p => p.stage === st).map(p => (
                        <div key={p.id} className="mb-2 block rounded-xl border border-[#E5E1D8] bg-white p-3 shadow-sm">
                          <div className="flex items-start justify-between">
                            <Link href={`/startup/hiring/${jobId}/applicants/${p.id}`} className="text-xs font-semibold hover:underline">
                              {p.name}
                            </Link>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                setActiveApplicant(p);
                                setModal('quick');
                              }}
                              aria-label={`Options for ${p.name}`}
                              className="text-[#4A5568] hover:text-ink"
                            >
                              <MoreHorizontal size={15}/>
                            </button>
                          </div>
                          <p className="mt-1 text-xs text-[#4A5568]">{p.title}</p>
                          <span className="mt-2 inline-block rounded-full bg-[#F3EBDD] px-2 py-0.5 text-xs font-semibold text-[#6B4F26]">
                            {p.match}
                          </span>
                          <p className="mt-2 text-xs text-[#4A5568]">{p.applied} · {p.source}</p>
                          <div className="mt-2 flex gap-2 text-xs text-[#4A5568]">
                            <span><FileText className="mr-1 inline" size={12}/>Resume</span>
                            <span><Star className="mr-1 inline text-[#806236]" size={12}/>{p.rating}</span>
                          </div>
                          <select
                            value={p.stage}
                            onChange={e => handleStageChange(p.id, e.target.value, p.name)}
                            className="mt-2 w-full rounded-md border border-[#E5E1D8] bg-white px-2 py-1 text-xs"
                          >
                            <option>Applied</option>
                            <option>Shortlisted</option>
                            <option>Interview</option>
                            <option>Offer</option>
                            <option>Hired</option>
                          </select>
                        </div>
                      ))}
                      {candidates.filter(p => p.stage === st).length === 0 && (
                        <p className="rounded-lg border border-dashed border-[#D6D0C5] p-4 text-center text-xs text-[#4A5568]">
                          No candidates here yet.
                        </p>
                      )}
                    </section>
                  ))}
                </div>
              </div>
            ) : tab === 'Applicants' ? (
              <Card
                title="Applicants"
                action={
                  <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={blind} onChange={() => setBlind(!blind)} className="accent-ink"/>
                    Blind review
                  </label>
                }
              >
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] text-left text-xs">
                    <thead className="border-b text-[#4A5568]">
                      <tr>
                        {['Candidate', 'Current role', 'Location', 'Match', 'Rating', 'Stage', 'Applied'].map(x => (
                          <th key={x} className="py-3 font-semibold">{x}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {candidates.map(p => (
                        <tr key={p.id} className="border-b border-[#E5E1D8] hover:bg-[#F4F1EA]">
                          <td className="py-3 font-semibold">
                            <Link href={`/startup/hiring/${jobId}/applicants/${p.id}`} className="hover:underline">
                              {blind ? `Candidate #${p.id.slice(-1)}` : p.name}
                            </Link>
                          </td>
                          <td>{p.title}</td>
                          <td>{p.location}</td>
                          <td>
                            <span className="rounded-full bg-[#F3EBDD] px-2 py-0.5 text-xs font-semibold text-[#6B4F26]">
                              {p.match}
                            </span>
                          </td>
                          <td>★ {p.rating}</td>
                          <td>
                            <span className="rounded-full bg-[#E7F3EC] px-2 py-0.5 font-semibold text-[#1E5D41]">
                              {p.stage}
                            </span>
                          </td>
                          <td>{p.applied}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ) : tab === 'Job post' ? (
              <Card
                title="Public job post"
                action={
                  <Link href="/startup/hiring/jobs/new" className="text-xs font-semibold text-[#806236] hover:underline">
                    Edit <Edit3 className="inline" size={13}/>
                  </Link>
                }
              >
                <h2 className="serif text-2xl font-semibold">{currentJob.title}</h2>
                <p className="mt-2 text-sm text-[#4A5568]">Acme Studio · {currentJob.location} · {currentJob.type}</p>
                <p className="mt-5 text-sm font-semibold">About this role</p>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#4A5568]">
                  Join our growing team to help build tools that make financial operations easier for ambitious businesses.
                </p>
              </Card>
            ) : tab === 'Team & scorecards' ? (
              <Card title="Interview team & scorecard">
                <p className="text-sm text-[#4A5568]">Interviewers submit feedback independently. Other scores stay hidden until submission.</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {[
                    ['Problem solving', 'Assess structured thinking and practical judgment.'],
                    ['Role skills', 'Assess skills relevant to the published job criteria.'],
                    ['Communication', 'Assess clarity and listening.'],
                    ['Ownership', 'Assess initiative and follow-through.']
                  ].map(([a, b]) => (
                    <div key={a} className="rounded-lg border border-[#E5E1D8] p-4">
                      <b className="text-sm">{a}</b>
                      <p className="mt-1 text-xs text-[#4A5568]">{b}</p>
                      <select className="mt-3 rounded-lg border border-[#E5E1D8] bg-white px-2 py-2 text-xs">
                        <option>Not scored</option>
                        <option>1 · Needs development</option>
                        <option>2 · Developing</option>
                        <option>3 · Strong</option>
                        <option>4 · Excellent</option>
                      </select>
                    </div>
                  ))}
                </div>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  ['Applied → Shortlisted', '38%'],
                  ['Average time to hire', '28 days'],
                  ['Offer acceptance', '75%']
                ].map(([n, v]) => (
                  <Card key={n} title={n}>
                    <b className="serif text-3xl font-semibold">{v}</b>
                    <p className="mt-2 text-xs text-[#4A5568]">Sample insight · based on demo pipeline</p>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {is('candidate') && (
          <>
            {pageHead(
              activeApplicant.name,
              `${activeApplicant.title} · ${activeApplicant.location} · Applied ${activeApplicant.applied}`,
              <>
                <Btn secondary onClick={() => notify('Message sent.')}>
                  <Mail size={15}/> Message
                </Btn>
                <Btn secondary onClick={() => setModal('interview')}>
                  <CalendarDays size={15}/> Schedule interview
                </Btn>
                <Btn onClick={() => handleStageChange(activeApplicant.id, 'Shortlisted', activeApplicant.name)}>
                  <Check size={15}/> Shortlist
                </Btn>
              </>
            )}

            <div className="mb-4 flex items-center gap-2 rounded-lg bg-[#F3EBDD] p-3 text-xs text-[#6B4F26]">
              <span className="rounded-full bg-white px-2 py-1 font-semibold text-[#6B4F26]">AI suggestion</span>
              Suggestions help organize review. Hiring decisions are always made by people.
            </div>

            <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
              {['Overview', 'Resume', 'Interview practice', 'Interviews & feedback', 'Notes', 'Messages', 'Activity'].map(x => (
                <button
                  key={x}
                  onClick={() => setCandTab(x)}
                  className={`min-h-10 shrink-0 rounded-lg px-3 text-xs transition ${candTab === x ? 'bg-ink font-semibold text-white' : 'border border-[#E5E1D8] bg-white text-[#4A5568] hover:bg-[#FAF8F4]'}`}
                >
                  {x}
                </button>
              ))}
            </div>

            <div className="grid items-start gap-5 lg:grid-cols-3">
              <div className="space-y-5 lg:col-span-2">
                <Card title={candTab}>
                  {candTab === 'Overview' ? (
                    <>
                      <h3 className="text-sm font-semibold">Experience & skills</h3>
                      <p className="mt-2 text-sm text-[#4A5568]">{activeApplicant.experience} of relevant experience in product engineering.</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {activeApplicant.skills.map(s => (
                          <span key={s} className="rounded-full bg-[#F3EBDD] px-3 py-1 text-xs font-semibold text-[#6B4F26]">
                            {s}
                          </span>
                        ))}
                      </div>
                      <h3 className="mt-6 text-sm font-semibold">Match explanation</h3>
                      <p className="mt-2 text-xs leading-5 text-[#4A5568]">
                        Skills match based on the job’s published requirements: Node.js, cloud infrastructure and database experience. This is a suggestion, not a decision.
                      </p>
                      <p className="mt-5 text-xs text-[#4A5568]">
                        Contact information and resume shown with candidate permission <LockKeyhole className="ml-1 inline" size={12}/>
                      </p>
                    </>
                  ) : candTab === 'Interview practice' ? (
                    activeApplicant.consent ? (
                      <p className="text-sm text-[#4A5568]">The candidate has not shared interview practice scores for this role.</p>
                    ) : (
                      <p className="text-sm text-[#4A5568]">The candidate has not shared practice results. These are never required for evaluation.</p>
                    )
                  ) : candTab === 'Resume' ? (
                    <div className="rounded-lg bg-[#FAF8F4] p-8 text-center">
                      <FileText className="mx-auto mb-3 text-[#806236]" size={28}/>
                      <p className="text-sm font-semibold">Resume available with candidate consent</p>
                      <button onClick={() => notify('Resume preview opened.')} className="mt-3 text-xs font-semibold text-[#806236] hover:underline">
                        Open resume
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-[#4A5568]">{candTab} will appear here for this candidate.</p>
                      <textarea placeholder={`Add ${candTab.toLowerCase()}…`} rows={4} className="mt-4 w-full rounded-lg border border-[#E5E1D8] p-3 text-sm"/>
                    </>
                  )}
                </Card>
              </div>

              <aside className="space-y-5">
                <Card title="Decision">
                  <p className="text-xs text-[#4A5568]">Current stage</p>
                  <select
                    value={stage}
                    onChange={e => handleStageChange(activeApplicant.id, e.target.value, activeApplicant.name)}
                    className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs"
                  >
                    {['Applied', 'Shortlisted', 'Interview', 'Offer', 'Hired', 'Rejected'].map(s => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                  <p className="mt-4 text-xs text-[#4A5568]">Average scorecard</p>
                  <p className="serif text-2xl font-semibold">★ {activeApplicant.rating} / 5</p>
                  <p className="mt-3 text-xs text-[#4A5568]">Next step: review role-specific scorecard and share feedback.</p>
                </Card>

                <Card title="Candidate details">
                  <p className="text-xs"><b>Source:</b> {activeApplicant.source}</p>
                  <p className="mt-2 text-xs"><b>Experience:</b> {activeApplicant.experience}</p>
                  <p className="mt-2 text-xs"><b>Location:</b> {activeApplicant.location}</p>
                  <p className="mt-3 rounded bg-[#FAF8F4] p-2 text-xs text-[#4A5568]">Personal details displayed with candidate consent.</p>
                </Card>

                <Card title="Quick scorecard">
                  <p className="text-xs text-[#4A5568]">Score the same criteria for each candidate.</p>
                  {['Role skills', 'Problem solving', 'Communication'].map(x => (
                    <label key={x} className="mt-3 block text-xs">
                      {x}
                      <select className="mt-1 h-9 w-full rounded border border-[#E5E1D8] bg-white px-2 text-xs">
                        <option>Choose score</option>
                        <option>1 · Needs development</option>
                        <option>2 · Developing</option>
                        <option>3 · Strong</option>
                        <option>4 · Excellent</option>
                      </select>
                    </label>
                  ))}
                  <div className="mt-4">
                    <Btn onClick={() => notify('Scorecard submitted. Other interviewer feedback is now visible.')}>
                      Submit feedback
                    </Btn>
                  </div>
                </Card>
              </aside>
            </div>
          </>
        )}

        {is('talent') && (
          <>
            {pageHead(
              'Talent search',
              'Find candidates who chose to be discoverable.',
              <Link href="/startup/hiring" className="text-sm font-semibold text-[#806236] hover:underline">
                Back to hiring
              </Link>
            )}

            {!verified && (
              <div className="mb-4 rounded-lg border border-[#E7D4B0] bg-[#FFF8E8] p-3 text-xs text-[#8A5700]">
                <LockKeyhole className="mr-2 inline" size={14}/>
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
                    className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs"
                  />
                </label>
                {[
                  ['Skills', 'Node.js, AWS'],
                  ['Experience', '3–7 years'],
                  ['Location', 'Any location'],
                  ['Availability', 'Anytime']
                ].map(([x, ph]) => (
                  <label key={x} className="mt-4 block text-xs font-medium">
                    {x}
                    <input placeholder={ph} className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs"/>
                  </label>
                ))}
                <label className="mt-4 flex items-center gap-2 text-xs">
                  <input type="checkbox" className="accent-ink"/> Remote preference
                </label>
                <p className="mt-4 text-xs leading-4 text-[#4A5568]">
                  We don’t offer filters for age, gender, religion, caste, nationality or marital status.
                </p>
              </aside>

              <div className="space-y-3 lg:col-span-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-[#4A5568]">{candidates.length} candidates opted in to discovery</p>
                  <select className="h-9 rounded-lg border border-[#E5E1D8] bg-white px-2 text-xs">
                    <option>Relevance</option>
                    <option>Recently active</option>
                    <option>Experience</option>
                  </select>
                </div>
                {candidates
                  .filter(p => !query || `${p.title} ${p.skills.join(' ')}`.toLowerCase().includes(query.toLowerCase()))
                  .map(p => (
                    <article key={p.id} className="rounded-xl border border-[#E5E1D8] bg-white p-5">
                      <div className="flex flex-wrap items-start gap-3">
                        <span className="grid h-12 w-12 place-items-center rounded-full bg-[#F3EBDD] font-semibold text-ink">
                          {p.name.split(' ').map(x => x[0]).join('')}
                        </span>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-base">{p.name}</h3>
                          <p className="text-xs text-[#4A5568]">{p.title} · {p.experience} · {p.location}</p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {p.skills.map(s => (
                              <span key={s} className="rounded-full bg-[#F3F4F6] px-2.5 py-1 text-xs text-[#4A5568]">
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                        <span className="rounded-full bg-[#E7F3EC] px-2.5 py-1 text-xs font-semibold text-[#1E5D41]">
                          {p.match}
                        </span>
                      </div>
                      <details className="mt-3 text-xs">
                        <summary className="cursor-pointer font-semibold text-[#806236]">Why this match?</summary>
                        <p className="mt-2 text-[#4A5568]">
                          Relevant skills overlap with the role’s requirements. Match labels explain skill overlap only; no personal attributes are considered.
                        </p>
                      </details>
                      <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-[#E5E1D8] pt-3">
                        <button
                          onClick={() => notify('Message disabled until employer verification.')}
                          disabled={!verified}
                          className="rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs font-semibold disabled:opacity-50 hover:bg-[#FAF8F4] transition"
                        >
                          Message
                        </button>
                        <button
                          onClick={() => setSavedTalent(savedTalent.includes(p.id) ? savedTalent.filter(x => x !== p.id) : [...savedTalent, p.id])}
                          className="rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs font-semibold hover:bg-[#FAF8F4] transition"
                        >
                          <Bookmark className="mr-1 inline" size={13}/>
                          {savedTalent.includes(p.id) ? 'Saved' : 'Save to shortlist'}
                        </button>
                        <button
                          onClick={() => notify('Invite to apply sent.')}
                          className="rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white hover:bg-[#1C2B42] transition"
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

        {is('interviews') && (
          <>
            {pageHead(
              'Interviews',
              'Plan conversations, keep the team aligned and close the feedback loop.',
              <Btn onClick={() => setModal('interview')}>
                <Plus size={16}/> Schedule interview
              </Btn>
            )}

            <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
              {['Upcoming', 'Needs feedback', 'Past', 'Calendar'].map(x => (
                <button
                  key={x}
                  onClick={() => setEventTab(x)}
                  className={`min-h-10 rounded-lg px-4 text-xs transition ${eventTab === x ? 'bg-ink font-semibold text-white' : 'border border-[#E5E1D8] bg-white text-[#4A5568] hover:bg-[#FAF8F4]'}`}
                >
                  {x}
                </button>
              ))}
            </div>

            {eventTab === 'Calendar' ? (
              <Card title="November 2026">
                <div className="overflow-x-auto pb-2">
                  <div className="grid min-w-[640px] grid-cols-7 gap-px bg-[#E5E1D8]">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', ...Array.from({ length: 35 }, (_, i) => String(i + 1))].map((x, i) => (
                      <div key={i} className={`min-h-16 bg-white p-2 text-xs ${i < 7 ? 'font-semibold text-[#4A5568]' : ''}`}>
                        {x}
                        {[6, 7].includes(i) && (
                          <small className="mt-1 block rounded bg-[#F3EBDD] p-1 text-xs font-semibold text-[#6B4F26]">
                            Interview
                          </small>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            ) : eventTab === 'Needs feedback' ? (
              <Card title="Feedback needed">
                <div className="space-y-3">
                  {[
                    ['Ishita Roy', 'Backend Engineer · Technical round', 'Yesterday'],
                    ['Kabir Shah', 'Product Designer · Founder chat', '2 days ago']
                  ].map(([n, d, t]) => (
                    <div key={n} className="flex items-center gap-3 rounded-lg border border-[#E5E1D8] p-4">
                      <AlertCircle className="text-[#8A5700] shrink-0" size={18}/>
                      <span className="flex-1">
                        <b className="block text-sm">{n}</b>
                        <small className="text-xs text-[#4A5568]">{d} · completed {t}</small>
                      </span>
                      <button onClick={() => notify('Feedback reminder sent.')} className="text-xs font-semibold text-[#806236] hover:underline">
                        Remind interviewer
                      </button>
                    </div>
                  ))}
                </div>
              </Card>
            ) : (
              <div className="space-y-3">
                {[
                  ['Nov 06 · 10:30 AM', 'Ananya Sen', 'Backend Engineer', 'Technical round', 'Aarav Kapoor, Sanjay Rao'],
                  ['Nov 06 · 2:00 PM', 'Ishita Roy', 'Backend Engineer', 'Founder chat', 'Aarav Kapoor'],
                  ['Nov 07 · 11:00 AM', 'Kabir Shah', 'Product Designer', 'Screening call', 'Priya Menon'],
                  ['Nov 08 · 3:00 PM', 'Rohan Mehta', 'Backend Engineer', 'Technical round', 'Sanjay Rao']
                ].map(([date, name, job, round, team], i) => (
                  <article key={name} className="flex flex-wrap items-center gap-4 rounded-xl border border-[#E5E1D8] bg-white p-4">
                    <div className="min-w-[145px] rounded-lg bg-[#F3EBDD] p-3 text-center">
                      <CalendarDays className="mx-auto mb-1 text-[#806236]" size={18}/>
                      <b className="text-xs text-ink">{date}</b>
                      <small className="mt-1 block text-xs text-[#4A5568]">Asia/Kolkata</small>
                    </div>
                    <div className="min-w-[180px] flex-1">
                      <Link href={`/startup/hiring/job-01/applicants/${candidates[i % candidates.length].id}`} className="text-sm font-semibold hover:underline">
                        {name}
                      </Link>
                      <p className="mt-1 text-xs text-[#4A5568]">{round} · {job}</p>
                      <p className="mt-1 text-xs text-[#4A5568]">Interviewers: {team}</p>
                    </div>
                    <span className="rounded-full bg-[#E7F3EC] px-2.5 py-1 text-xs font-semibold text-[#1E5D41]">
                      Scheduled
                    </span>
                    <button onClick={() => notify('Reschedule request started.')} className="rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs font-semibold hover:bg-[#FAF8F4] transition">
                      Reschedule
                    </button>
                    {i === 0 && (
                      <button onClick={() => notify('Join link will appear 10 minutes before the interview.')} className="rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white hover:bg-[#1C2B42] transition">
                        Join
                      </button>
                    )}
                  </article>
                ))}
              </div>
            )}
          </>
        )}

        {is('offers') && (
          <>
            {pageHead(
              'Offers',
              'Prepare thoughtful offers and keep every candidate informed.',
              <Btn onClick={() => setModal('offer')}>
                <Plus size={16}/> Create offer
              </Btn>
            )}

            <div className="mb-5 flex flex-wrap gap-2">
              {['Draft', 'Awaiting approval', 'Sent', 'Accepted', 'Declined / Expired'].map(x => (
                <button
                  key={x}
                  onClick={() => setOfferTab(x)}
                  className={`min-h-10 rounded-lg px-3 text-xs transition ${offerTab === x ? 'bg-ink font-semibold text-white' : 'border border-[#E5E1D8] bg-white text-[#4A5568] hover:bg-[#FAF8F4]'}`}
                >
                  {x}
                </button>
              ))}
            </div>

            <Card title={`${offerTab} offers`}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[750px] text-left text-xs">
                  <thead className="border-b text-[#4A5568]">
                    <tr>
                      {['Candidate', 'Job', 'Compensation', 'Start date', 'Status', 'Expires', 'Owner', ''].map(x => (
                        <th key={x} className="py-3 font-semibold">{x}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(offerTab === 'Sent'
                      ? [
                          ['Ananya Sen', 'Backend Engineer', '₹18 LPA + equity', 'Dec 01', 'Sent', 'Nov 07', 'Aarav Kapoor'],
                          ['Kabir Shah', 'Product Designer', '₹14 LPA', 'Dec 15', 'Sent', 'Nov 12', 'Priya Menon']
                        ]
                      : offerTab === 'Accepted'
                      ? [['Rohan Mehta', 'Backend Engineer', '₹20 LPA', 'Nov 15', 'Accepted', '—', 'Aarav Kapoor']]
                      : []
                    ).map(r => (
                      <tr key={r[0]} className="border-b border-[#E5E1D8]">
                        <td className="py-4 font-semibold">{r[0]}</td>
                        {r.slice(1).map((x, i) => (
                          <td key={i} className="py-4 text-[#4A5568]">{x}</td>
                        ))}
                        <td>
                          <button onClick={() => notify(`Offer for ${r[0]} opened.`)} className="font-semibold text-[#806236] hover:underline">
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {offerTab !== 'Sent' && offerTab !== 'Accepted' && (
                  <div className="py-10 text-center">
                    <FileText className="mx-auto mb-3 text-[#A0A7B4]" size={28}/>
                    <p className="text-sm font-semibold">No {offerTab.toLowerCase()} offers</p>
                    <p className="mt-1 text-xs text-[#4A5568]">Offers you create from a candidate pipeline will appear here.</p>
                  </div>
                )}
              </div>
              <p className="mt-4 rounded-lg border border-[#E7D4B0] bg-[#FFF8E8] p-3 text-xs text-[#8A5700]">
                Review offer letters and contract terms with legal counsel. Templates are samples, not legal advice.
              </p>
            </Card>
          </>
        )}

        {is('employer') && (
          <>
            {pageHead(
              'Employer page',
              'Build candidate trust and manage your company’s hiring presence.',
              <div className="flex rounded-lg border border-[#E5E1D8] bg-white p-1">
                {['Editor', 'Public preview'].map(x => (
                  <button
                    key={x}
                    onClick={() => setProfileTab(x)}
                    className={`rounded px-3 py-2 text-xs font-semibold transition ${profileTab === x ? 'bg-ink text-white' : 'text-[#4A5568] hover:bg-[#FAF8F4]'}`}
                  >
                    {x}
                  </button>
                ))}
              </div>
            )}

            {!verified && (
              <div className="mb-5 rounded-xl border border-[#E7D4B0] bg-[#FFF8E8] p-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <ShieldCheck size={18} className="text-[#806236]"/>
                  Employer verification · Not started
                </h2>
                <p className="mt-2 text-xs leading-5 text-[#4A5568]">
                  Verification is required before publishing jobs or messaging candidates. We’ll review your business details in 1–2 business days.
                </p>
                <div className="mt-4 mb-4 grid gap-2 sm:grid-cols-3">
                  {[
                    ['Business registration', 'From startup profile'],
                    ['Official email domain', 'Needs verification'],
                    ['Company website', 'acmestudio.example']
                  ].map(([a, b]) => (
                    <div key={a} className="rounded-lg bg-white p-3 text-xs border border-[#E7D4B0]">
                      <span className="font-semibold flex items-center gap-1">
                        <CheckCircle2 className="inline text-[#1E5D41]" size={14}/>
                        {a}
                      </span>
                      <small className="mt-1 block text-[#4A5568]">{b}</small>
                    </div>
                  ))}
                </div>
                <Btn onClick={() => { setVerified(true); notify('Verification request submitted for review.'); }}>
                  <ShieldCheck size={15}/> Submit for verification
                </Btn>
              </div>
            )}

            <div className="grid gap-5 lg:grid-cols-2">
              <Card title="Company page editor">
                <label className="block text-sm font-medium">
                  Tagline
                  <input
                    defaultValue="Making financial operations effortless for growing businesses."
                    className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] px-3 text-sm"
                  />
                </label>
                <label className="mt-4 block text-sm font-medium">
                  About us
                  <textarea
                    rows={5}
                    defaultValue="Acme Studio is building tools that give growing businesses a clear view of cash flow and confident decisions."
                    className="mt-2 w-full rounded-lg border border-[#E5E1D8] p-3 text-sm"
                  />
                </label>
                <label className="mt-4 block text-sm font-medium">
                  Mission
                  <input
                    defaultValue="Help every ambitious business make better financial decisions."
                    className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] px-3 text-sm"
                  />
                </label>
                <div className="mt-4">
                  <Btn onClick={() => notify('Employer page saved.')}>
                    Save employer page
                  </Btn>
                </div>
              </Card>

              <Card title={profileTab === 'Editor' ? 'Candidate preview' : 'Public employer page preview'}>
                <div className="h-24 rounded-t-xl bg-ink"/>
                <div className="px-4 pb-4">
                  <div className="-mt-8 grid h-16 w-16 place-items-center rounded-xl border-4 border-white bg-[#F3EBDD] text-xl font-bold text-ink">
                    A
                  </div>
                  <h2 className="serif mt-2 text-xl font-semibold">Acme Studio</h2>
                  <p className="mt-1 text-xs text-[#4A5568]">Making financial operations effortless for growing businesses.</p>
                  <p className="mt-4 text-xs leading-5 text-[#4A5568]">
                    Building helpful finance tools for ambitious teams. Product-focused, thoughtful, and remote-friendly.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <span className="rounded-full bg-[#F3F4F6] px-2.5 py-1 text-xs text-[#4A5568]">Prototype</span>
                    <span className="rounded-full bg-[#F3F4F6] px-2.5 py-1 text-xs text-[#4A5568]">Fintech</span>
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
                  <input type="checkbox" className="accent-ink"/>
                </label>
                <label className="mt-4 flex items-center justify-between text-xs">
                  Default acknowledgement to candidates
                  <input type="checkbox" defaultChecked className="accent-ink"/>
                </label>
                <label className="mt-4 block text-xs">
                  Working hours
                  <input defaultValue="10:00 AM – 6:00 PM · Asia/Kolkata" className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] px-3"/>
                </label>
              </Card>

              <Card title="Trust & safety">
                <p className="text-xs leading-5 text-[#4A5568]">
                  Never charge candidates fees. Evaluate fairly using job-related criteria. Candidate data is shared only with consent and is retained according to your configured policy.
                </p>
                <button onClick={() => notify('Support request opened.')} className="mt-3 text-xs font-semibold text-[#806236] hover:underline">
                  Contact support <ArrowRight className="inline" size={13}/>
                </button>
              </Card>
            </div>
          </>
        )}
      </main>

      {/* Modals with backdrop dismiss, Escape listener, and body scroll locking */}
      {(modal === 'interview' || modal === 'offer' || modal === 'quick') && (
        <div
          className="fixed inset-0 z-40 grid place-items-center bg-[#0F1B2D]/45 p-4 overflow-y-auto"
          onClick={e => { if (e.target === e.currentTarget) setModal(''); }}
        >
          <section
            role="dialog"
            aria-modal="true"
            className="my-auto w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="serif text-2xl font-semibold">
                {modal === 'interview' ? 'Schedule interview' : modal === 'offer' ? 'Create offer' : `Quick actions · ${activeApplicant?.name}`}
              </h2>
              <button onClick={() => setModal('')} aria-label="Close" className="rounded-lg p-1 text-[#4A5568] hover:bg-[#F4F1EA] hover:text-ink">
                <X size={18}/>
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
                    <input type="date" className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] px-3"/>
                  </label>
                  <label className="text-sm">
                    Time
                    <input type="time" className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] px-3"/>
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
                  <input placeholder="₹18 LPA" className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] px-3"/>
                </label>
                <label className="block text-sm">
                  Start date
                  <input type="date" className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] px-3"/>
                </label>
                <label className="block text-sm">
                  Offer expires
                  <input type="date" className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] px-3"/>
                </label>
                <p className="rounded-lg border border-[#E7D4B0] bg-[#FFF8E8] p-3 text-xs text-[#8A5700]">
                  Review offer letter and contract terms with legal counsel.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={() => {
                    if (activeApplicant) {
                      handleStageChange(activeApplicant.id, 'Shortlisted', activeApplicant.name);
                    }
                    setModal('');
                  }}
                  className="block w-full rounded-lg p-3 text-left text-sm font-semibold hover:bg-[#FAF8F4] transition"
                >
                  Shortlist candidate
                </button>
                <button
                  onClick={() => {
                    notify('Interview scheduling opened.');
                    setModal('interview');
                  }}
                  className="block w-full rounded-lg p-3 text-left text-sm font-semibold hover:bg-[#FAF8F4] transition"
                >
                  Schedule interview
                </button>
                <button
                  onClick={() => {
                    notify('Rejection flow requires a reason and candidate message.');
                    setModal('');
                  }}
                  className="block w-full rounded-lg p-3 text-left text-sm font-semibold text-[#B42318] hover:bg-[#FAF8F4] transition"
                >
                  Reject with reason
                </button>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setModal('')} className="min-h-10 px-4 text-sm font-medium hover:underline">
                Cancel
              </button>
              <button
                onClick={() => {
                  setModal('');
                  notify(modal === 'interview' ? 'Interview invite prepared.' : modal === 'offer' ? 'Offer draft created.' : 'Done');
                }}
                className="min-h-10 rounded-lg bg-ink px-4 text-sm font-semibold text-white hover:bg-[#1C2B42] transition"
              >
                {modal === 'interview' ? 'Send invite' : modal === 'offer' ? 'Save offer draft' : 'Done'}
              </button>
            </div>
          </section>
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
