'use client';
import {useState, useRef} from 'react';
import Link from 'next/link';
import {
  LayoutDashboard,
  Compass,
  ListTodo,
  Users,
  FolderLock,
  Lightbulb,
  Briefcase,
  ChartNoAxesColumn,
  Settings,
  CircleHelp,
  Search,
  Bell,
  ChevronDown,
  Check,
  ArrowUpRight,
  ArrowRight,
  Plus,
  Eye,
  LockKeyhole,
  CheckCircle2,
  Globe,
  MapPin,
  CalendarDays,
  FileText,
  Presentation,
  FileSpreadsheet,
  Upload,
  Save,
  Pencil,
  Share2,
  MessageCircle,
  Mail,
  Building2,
  MoreHorizontal,
  X
} from 'lucide-react';

const nav = [
  ['Dashboard', LayoutDashboard, '/startup/dashboard'],
  ['Stage toolkit', Compass, '/startup/stage'],
  ['Tasks & milestones', ListTodo, '/startup/tasks'],
  ['Team', Users, '/startup/team'],
  ['Startup profile', Building2, '/startup/profile'],
  ['Data room', FolderLock, '/startup/data-room'],
  ['Mentors', Lightbulb, '/startup/mentors'],
  ['Investors', Briefcase, '/startup/investors'],
  ['Hiring', Briefcase, '/startup/hiring'],
  ['Analytics', ChartNoAxesColumn, '/startup/analytics']
];

const seed = {
  name: 'Acme Studio',
  tagline: 'Making financial operations effortless for growing businesses.',
  one: 'Acme helps ambitious small businesses get a clear, real-time view of their cash flow and make confident decisions.',
  summary:
    'We bring finance workflows, cash visibility, and practical forecasting together in one workspace. Acme gives founders and finance teams the clarity to focus on building, not chasing spreadsheets.',
  problem: 'Small businesses are making high-stakes decisions with fragmented financial data and outdated spreadsheets.',
  solution: 'A single live workspace that connects accounts, forecasts runway, and turns financial signals into clear next steps.',
  market: 'SMB finance software · India first · TAM ₹1,200 Cr',
  website: 'https://acmestudio.example',
  sector: 'Financial technology',
  location: 'Kolkata, India',
  year: '2023',
  business: 'B2B SaaS'
};

function Card({title, children, action, id}) {
  return (
    <section id={id} className="rounded-xl border border-[#E5E1D8] bg-white p-5 shadow-[0_1px_2px_rgba(15,27,45,.04)] sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="serif text-[20px] font-semibold text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function StartupProfile() {
  const [view, setView] = useState('Edit');
  const [data, setData] = useState(seed);
  const [saved, setSaved] = useState(seed);
  const [dirty, setDirty] = useState(false);
  const [visibility, setVisibility] = useState('Mentors and investors');
  const [shares, setShares] = useState({traction: true, funding: false, contacts: false});
  const [toast, setToast] = useState('');
  const [menu, setMenu] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const [docs, setDocs] = useState([
    {name: 'Pitch deck v3.pdf', size: '4.2 MB', access: 'Investors after NDA', updated: 'Today'},
    {name: 'Financial model.xlsx', size: '1.8 MB', access: 'Private', updated: 'Yesterday'},
    {name: 'Product brief.pdf', size: '2.1 MB', access: 'Public', updated: 'Oct 30'}
  ]);

  const notify = t => {
    setToast(t);
    setTimeout(() => setToast(''), 2600);
  };

  const edit = (key, value) => {
    setData({...data, [key]: value});
    setDirty(true);
  };

  const save = () => {
    setSaved(data);
    setDirty(false);
    notify('Profile changes saved successfully.');
  };

  const discard = () => {
    setData(saved);
    setDirty(false);
    notify('Changes discarded.');
  };

  const isEdit = view === 'Edit';

  const handleDragOver = e => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = e => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = e => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      const newDoc = {
        name: droppedFiles[0].name,
        size: `${(droppedFiles[0].size / (1024 * 1024)).toFixed(1)} MB`,
        access: 'Private',
        updated: 'Just now'
      };
      setDocs([newDoc, ...docs]);
      notify(`Uploaded ${droppedFiles[0].name}.`);
    }
  };

  const field = (label, key, opts = {}) => (
    <label key={key} className="block text-sm font-medium text-ink">
      {label}
      {opts.area ? (
        <textarea
          value={data[key]}
          onChange={e => edit(key, e.target.value)}
          maxLength={opts.max}
          rows={opts.rows || 4}
          className="mt-2 w-full rounded-[10px] border border-[#E5E1D8] bg-white p-3 text-sm font-normal leading-6 text-ink outline-none transition focus:border-[#B8955A] focus:ring-2 focus:ring-[#B8955A]/20"
        />
      ) : (
        <input
          value={data[key]}
          onChange={e => edit(key, e.target.value)}
          maxLength={opts.max}
          className="mt-2 h-11 w-full rounded-[10px] border border-[#E5E1D8] bg-white px-3 text-sm font-normal text-ink outline-none transition focus:border-[#B8955A] focus:ring-2 focus:ring-[#B8955A]/20"
        />
      )}
      {opts.max && (
        <small className="mt-1 block text-right text-xs font-normal text-[#4A5568]">
          {data[key].length}/{opts.max}
        </small>
      )}
    </label>
  );

  return (
    <div className="min-h-screen bg-[#FAF8F4] text-[#0F1B2D]">
      <a href="#profile-main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3 focus:shadow-md">
        Skip to content
      </a>

      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[240px] flex-col bg-[#0F1B2D] text-white lg:flex">
        <div className="flex h-[76px] items-center gap-3 border-b border-white/10 px-6">
          <span className="grid h-9 w-9 place-items-center rounded-full border border-white/30 font-serif text-lg">F</span>
          <span className="font-semibold tracking-wide">
            forma <small className="ml-1 font-normal text-white/70">WORKSPACE</small>
          </span>
        </div>

        <p className="px-6 pb-2 pt-5 text-xs font-semibold uppercase tracking-[.16em] text-white/70">Startup</p>

        <nav className="px-3">
          {nav.map(([n, Icon, url]) => (
            <Link
              key={n}
              href={url}
              className={`relative mb-1 flex h-11 items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8955A] ${
                n === 'Startup profile' ? 'bg-[#1C2B42] text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
              }`}
            >
              {n === 'Startup profile' && <span className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r bg-[#B8955A]" />}
              <Icon size={18} strokeWidth={1.7} className="shrink-0" />
              <span>{n}</span>
            </Link>
          ))}
        </nav>

        <div className="mt-auto space-y-1 px-3 pb-5">
          <Link href="/startup/profile" className="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm text-white/75 hover:bg-white/10 hover:text-white">
            <Settings size={18} /> Settings
          </Link>
          <Link href="/help" className="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm text-white/75 hover:bg-white/10 hover:text-white">
            <CircleHelp size={18} /> Help & support
          </Link>
          <div className="mt-2 flex items-center gap-3 rounded-lg border border-white/10 p-3">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[#F3EBDD] text-xs font-bold text-ink">AK</span>
            <span>
              <b className="block text-xs">Aarav Kapoor</b>
              <small className="text-white/60">Founder · switch role</small>
            </span>
          </div>
        </div>
      </aside>

      {/* Header */}
      <header className="sticky top-0 z-10 flex h-[68px] items-center justify-between border-b border-[#E5E1D8] bg-[#FAF8F4]/95 px-4 backdrop-blur sm:px-7 lg:ml-[240px]">
        <div className="relative hidden sm:block">
          <Search className="absolute left-3 top-2.5 text-[#4A5568]" size={17} />
          <input
            placeholder="Search anything…"
            className="h-10 w-64 rounded-lg border border-[#E5E1D8] bg-white pl-9 text-sm text-ink outline-none transition focus:border-[#B8955A] focus:ring-1 focus:ring-[#B8955A]"
          />
        </div>
        <Link href="/startup/dashboard" className="text-sm font-semibold text-[#9A7A45] hover:underline sm:hidden">
          ← Dashboard
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => notify('You’re all caught up.')}
            aria-label="Notifications"
            className="relative grid h-10 w-10 place-items-center rounded-full text-[#4A5568] hover:bg-white hover:text-ink focus-visible:ring-2 focus-visible:ring-[#B8955A]"
          >
            <Bell size={19} />
            <i className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#B8955A]" />
          </button>
          <button
            type="button"
            onClick={() => setMenu(!menu)}
            className="ml-2 flex items-center gap-2 rounded-lg p-1.5 hover:bg-white"
          >
            <span className="grid h-8 w-8 place-items-center rounded-full bg-ink text-xs font-semibold text-white">AK</span>
            <span className="hidden text-xs font-medium text-ink sm:block">Aarav Kapoor</span>
            <ChevronDown size={14} className="text-[#4A5568]" />
          </button>
          {menu && (
            <div className="absolute right-4 top-16 z-50 rounded-xl border border-[#E5E1D8] bg-white p-3 text-sm shadow-lg">
              Founder · Acme Studio
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main id="profile-main" className="mx-auto max-w-[1440px] px-4 pb-24 pt-7 sm:px-7 lg:ml-[240px] lg:px-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-[#4A5568]">
              Startup workspace <span className="mx-2 text-[#B8955A]">·</span> Profile
            </p>
            <h1 className="serif mt-1 text-3xl font-semibold text-ink">Startup profile</h1>
            <p className="mt-1 text-sm text-[#4A5568]">Keep your story, details and sharing preferences up to date.</p>
          </div>

          <div className="flex items-center gap-2">
            <div role="tablist" aria-label="Profile view" className="flex rounded-[10px] border border-[#E5E1D8] bg-white p-1 shadow-sm">
              <button
                type="button"
                role="tab"
                aria-selected={isEdit}
                onClick={() => setView('Edit')}
                className={`min-h-9 rounded-lg px-4 text-sm font-medium transition ${isEdit ? 'bg-ink font-semibold text-white' : 'text-[#4A5568] hover:text-ink'}`}
              >
                Edit
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={!isEdit}
                onClick={() => setView('Public preview')}
                className={`min-h-9 rounded-lg px-4 text-sm font-medium transition ${!isEdit ? 'bg-ink font-semibold text-white' : 'text-[#4A5568] hover:text-ink'}`}
              >
                Public preview
              </button>
            </div>

            {isEdit && (
              <>
                <button
                  type="button"
                  onClick={discard}
                  disabled={!dirty}
                  className="hidden min-h-10 px-3 text-sm font-medium text-[#4A5568] hover:text-ink disabled:opacity-40 sm:block"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={!dirty}
                  className="inline-flex min-h-10 items-center gap-2 rounded-[9px] bg-ink px-4 text-sm font-semibold text-white transition hover:bg-[#1C2B42] disabled:opacity-45"
                >
                  <Save size={16} /> Save changes
                </button>
              </>
            )}
          </div>
        </div>

        {dirty && isEdit && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-[#E7D4B0] bg-[#F3EBDD] px-4 py-2.5 text-sm text-[#6B4F26]" role="status">
            <span>You have unsaved changes in your startup profile.</span>
            <span className="ml-auto text-xs font-semibold">Draft changes</span>
          </div>
        )}

        {!isEdit && visibility === 'Private' && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-[#E7D4B0] bg-[#F3EBDD] p-3.5 text-sm text-[#6B4F26]">
            <LockKeyhole size={17} /> This profile is private. Only your team can see it.
          </div>
        )}

        {/* Hero Banner Section */}
        <section className="mb-6 overflow-hidden rounded-xl border border-[#E5E1D8] bg-white shadow-[0_1px_2px_rgba(15,27,45,.04)]">
          <div className="relative h-36 bg-[#0F1B2D] sm:h-44">
            <div className="absolute inset-x-0 bottom-0 h-[2px] bg-[#B8955A]" />
            {isEdit && (
              <button
                type="button"
                onClick={() => notify('Cover image upload is ready to connect.')}
                className="absolute right-4 top-4 inline-flex min-h-9 items-center gap-2 rounded-lg border border-white/30 bg-ink/70 px-3 text-xs font-medium text-white hover:bg-ink"
              >
                <Upload size={14} /> Edit cover
              </button>
            )}
          </div>

          <div className="px-5 pb-6 sm:px-7">
            <div className="-mt-12 flex flex-wrap items-end gap-4">
              <button
                type="button"
                onClick={() => isEdit && notify('Logo upload is ready to connect.')}
                aria-label="Upload startup logo"
                className="grid h-24 w-24 shrink-0 place-items-center rounded-2xl border-4 border-white bg-[#F3EBDD] text-3xl font-bold text-ink shadow-sm"
              >
                A
              </button>
              <div className="min-w-[240px] flex-1 pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="serif text-[28px] font-semibold text-ink">{data.name}</h2>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#E7F3EC] px-2.5 py-1 text-xs font-semibold text-[#1E5D41]">
                    <CheckCircle2 size={13} /> Verified startup
                  </span>
                </div>
                {isEdit ? field('Tagline', 'tagline', {max: 100}) : <p className="mt-1 text-sm text-[#4A5568]">{data.tagline}</p>}
              </div>
              <div className="flex gap-2 pb-1">
                {isEdit ? (
                  <span className="rounded-full bg-[#F3EBDD] px-3 py-1.5 text-xs font-semibold text-[#806236]">
                    Stage: Prototype
                  </span>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => notify('Intro request started.')}
                      className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-ink px-3.5 text-xs font-semibold text-white hover:bg-[#1C2B42]"
                    >
                      <MessageCircle size={15} /> Request intro
                    </button>
                    <button
                      type="button"
                      onClick={() => notify('Startup saved to shortlist.')}
                      className="min-h-10 rounded-lg border border-[#E5E1D8] bg-white px-3.5 text-xs font-semibold text-ink hover:bg-[#FAF8F4]"
                    >
                      Shortlist
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-[#E5E1D8] pt-4 text-xs text-[#4A5568]">
              <span className="inline-flex items-center gap-1.5">
                <Building2 size={14} className="text-[#9A7A45]" />
                {data.sector}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={14} className="text-[#9A7A45]" />
                {data.location}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays size={14} className="text-[#9A7A45]" />
                Founded {data.year}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Users size={14} className="text-[#9A7A45]" />
                8 team members
              </span>
            </div>
          </div>
        </section>

        {/* Content Columns with responsive layout */}
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card title="About & pitch summary" action={isEdit ? <Pencil size={16} className="text-[#9A7A45]" /> : null}>
              <div className="space-y-4">
                {isEdit ? (
                  <>
                    {field('One-liner', 'one', {max: 160})}
                    {field('Pitch summary', 'summary', {area: true, max: 1200, rows: 5})}
                    <button
                      type="button"
                      onClick={() => notify('AI writing suggestions will be available soon.')}
                      className="text-xs font-semibold text-[#9A7A45] hover:underline"
                    >
                      Improve with AI (optional)
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-[15px] leading-7 text-ink font-medium">{data.one}</p>
                    <p className="text-sm leading-7 text-[#4A5568]">{data.summary}</p>
                  </>
                )}
              </div>
            </Card>

            <Card title="Problem, solution & market">
              {isEdit ? (
                <div className="grid gap-4 md:grid-cols-3">
                  {field('Problem', 'problem', {area: true, rows: 5})}
                  {field('Solution', 'solution', {area: true, rows: 5})}
                  {field('Target customer & market', 'market', {area: true, rows: 5})}
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-3">
                  {[
                    ['Problem', data.problem],
                    ['Solution', data.solution],
                    ['Target customer & market', data.market]
                  ].map(([h, t]) => (
                    <div key={h} className="rounded-lg bg-[#FAF8F4] p-4 border border-[#E5E1D8]">
                      <h3 className="mb-2 text-sm font-semibold text-ink">{h}</h3>
                      <p className="text-sm leading-6 text-[#4A5568]">{t}</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card
              title="Traction highlights"
              action={
                isEdit ? (
                  <button type="button" onClick={() => notify('Metric editing opened.')} className="text-xs font-semibold text-[#9A7A45] hover:underline">
                    <Plus className="inline" size={15} /> Add metric
                  </button>
                ) : null
              }
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ['₹4.8L', 'Monthly recurring revenue'],
                  ['126', 'Paying customers'],
                  ['12%', 'Growth month over month'],
                  ['8', 'Active pilots']
                ].map(([v, l], i) => (
                  <div key={l} className="rounded-lg border border-[#E5E1D8] p-4">
                    <div className="serif text-2xl font-semibold text-ink">{v}</div>
                    <p className="mt-1 text-xs leading-5 text-[#4A5568]">{l}</p>
                    {i < 2 && (
                      <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#2E7D5B]">
                        <CheckCircle2 size={12} /> Mentor verified
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-[#4A5568]">Metrics are shared according to your visibility settings.</p>
            </Card>

            <Card
              id="team-section"
              title="Team"
              action={
                isEdit ? (
                  <Link href="/startup/team" className="text-sm font-semibold text-[#9A7A45] hover:underline">
                    <Plus className="inline" size={15} /> Invite member
                  </Link>
                ) : null
              }
            >
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ['AK', 'Aarav Kapoor', 'Founder & CEO', 'Product and company strategy'],
                  ['PM', 'Priya Menon', 'Co-founder · Product', 'Product design and research'],
                  ['SR', 'Sanjay Rao', 'Engineering lead', 'Infrastructure and platform'],
                  ['RM', 'Rhea Mukherjee', 'Finance advisor', 'Financial planning']
                ].map(([initial, name, role, bio]) => (
                  <div key={name} className="flex items-start gap-3 rounded-lg border border-[#E5E1D8] p-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#F3EBDD] text-xs font-semibold text-ink">
                      {initial}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink">{name}</p>
                      <p className="text-xs text-[#9A7A45]">{role}</p>
                      <p className="mt-1 text-xs text-[#4A5568]">{bio}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Link href="/startup/hiring" className="mt-4 inline-block rounded-full bg-[#F3EBDD] px-3 py-1.5 text-xs font-semibold text-[#806236]">
                Hiring · 2 open roles
              </Link>
            </Card>

            {/* Documents & Data Room Card with Active Drag-and-Drop */}
            <Card id="documents-section" title="Documents & data room">
              <div className="mb-3 rounded-lg bg-[#FAF8F4] p-3 text-xs text-[#4A5568]">
                <LockKeyhole className="mr-1 inline text-[#9A7A45]" size={13} />
                Investors must accept a confidentiality agreement before viewing protected documents.
              </div>

              {/* Drag-over dropzone */}
              {isEdit && (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`mb-4 cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition ${
                    isDragging ? 'border-[#B8955A] bg-[#FFF8E8]' : 'border-[#E5E1D8] bg-white hover:border-[#A0A7B4]'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={e => {
                      if (e.target.files && e.target.files.length > 0) {
                        const file = e.target.files[0];
                        setDocs([
                          {
                            name: file.name,
                            size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
                            access: 'Private',
                            updated: 'Just now'
                          },
                          ...docs
                        ]);
                        notify(`Uploaded ${file.name}.`);
                      }
                    }}
                  />
                  <Upload className="mx-auto mb-2 text-[#9A7A45]" size={22} />
                  <p className="text-sm font-semibold text-ink">
                    {isDragging ? 'Drop file here to upload' : 'Click or drag files here to upload'}
                  </p>
                  <p className="mt-1 text-xs text-[#4A5568]">PDF, XLSX, PPTX up to 25 MB</p>
                </div>
              )}

              <div className="divide-y divide-[#E5E1D8]">
                {docs.map((doc, i) => (
                  <div key={doc.name} className="flex flex-wrap items-center gap-3 py-3">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#F3EBDD] text-[#806236]">
                      {i === 0 ? <Presentation size={17} /> : i === 1 ? <FileSpreadsheet size={17} /> : <FileText size={17} />}
                    </span>
                    <span className="min-w-[130px] flex-1">
                      <b className="block text-sm text-ink">{doc.name}</b>
                      <small className="text-xs text-[#4A5568]">
                        {doc.size} · Updated {doc.updated}
                      </small>
                    </span>
                    <span className="rounded-full bg-[#F3F4F6] px-2.5 py-1 text-xs font-medium text-[#4A5568]">{doc.access}</span>
                    {isEdit ? (
                      <button
                        type="button"
                        aria-label="Change access"
                        onClick={() =>
                          setDocs(docs.map((d, n) => (n === i ? {...d, access: d.access === 'Private' ? 'Public' : 'Private'} : d)))
                        }
                        className="text-[#4A5568] hover:text-ink"
                      >
                        <MoreHorizontal size={17} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => notify(doc.access === 'Private' ? 'This file is private.' : 'Access request sent.')}
                        className="text-xs font-semibold text-[#9A7A45] hover:underline"
                      >
                        {doc.access === 'Private' ? 'Locked' : 'Request access'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            {isEdit && (
              <Card title="Funding & use of funds">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-3">
                    <p className="text-sm">
                      <span className="text-[#4A5568]">Current round</span>
                      <b className="float-right text-ink">Pre-seed</b>
                    </p>
                    <p className="text-sm">
                      <span className="text-[#4A5568]">Target raise</span>
                      <b className="float-right text-ink">₹2.5 Cr</b>
                    </p>
                    <p className="text-sm">
                      <span className="text-[#4A5568]">Committed</span>
                      <b className="float-right text-ink">₹0.8 Cr</b>
                    </p>
                    <div className="h-2 rounded-full bg-[#E5E1D8]">
                      <div className="h-full w-[32%] rounded-full bg-[#B8955A]" />
                    </div>
                    <p className="text-xs text-[#4A5568]">32% committed · Minimum ticket ₹10L</p>
                  </div>
                  <div>
                    <p className="mb-3 text-sm font-semibold text-ink">Use of funds</p>
                    <div className="flex h-3 overflow-hidden rounded-full">
                      <i className="w-[40%] bg-ink" />
                      <i className="w-[30%] bg-[#B8955A]" />
                      <i className="w-[20%] bg-[#4A5568]" />
                      <i className="w-[10%] bg-[#A0A7B4]" />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[#4A5568]">
                      <span>● Product 40%</span>
                      <span className="text-[#9A7A45]">● Hiring 30%</span>
                      <span>● Marketing 20%</span>
                      <span>● Operations 10%</span>
                    </div>
                  </div>
                </div>
                <p className="mt-4 text-xs text-[#4A5568]">Visible to verified investors only.</p>
              </Card>
            )}

            {isEdit && (
              <Card title="Legal & company details" action={<span className="rounded-full bg-[#FFF3D6] px-2.5 py-1 text-xs font-medium text-[#8A5700]">Under review</span>}>
                <div className="grid gap-4 sm:grid-cols-2">
                  {field('Registered company name', 'name')}
                  {field('Entity type', 'business')}
                  {field('Registration number', 'year')}
                  {field('Incorporation year', 'year')}
                  {field('Registered address', 'location')}
                  {field('Website', 'website')}
                </div>
                <div className="mt-4 rounded-lg bg-[#FFF8E8] p-3 text-xs leading-5 text-[#806236]">
                  Your business details are being verified. This usually takes 1–2 business days. Legal details are never shown publicly.
                </div>
              </Card>
            )}
          </div>

          {/* Right Column Highlights */}
          <aside className="space-y-6">
            <Card title="Profile completeness">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="serif text-3xl font-semibold text-ink">78%</span>
                <span className="text-xs text-[#4A5568]">Good progress</span>
              </div>
              <div className="h-2 rounded-full bg-[#E5E1D8]">
                <div className="h-full w-[78%] rounded-full bg-[#B8955A]" />
              </div>
              <div className="mt-4 space-y-3">
                {[
                  ['Add a logo', false],
                  ['Add 2 team members', true],
                  ['Upload pitch deck', true],
                  ['Verify legal details', false]
                ].map(([t, ok]) => (
                  <button
                    type="button"
                    key={t}
                    onClick={() => document.getElementById(ok ? 'team-section' : 'documents-section')?.scrollIntoView({behavior: 'smooth'})}
                    className="flex w-full items-center gap-2 text-left text-xs"
                  >
                    <span className={`grid h-4 w-4 place-items-center rounded-full ${ok ? 'bg-[#E7F3EC] text-[#2E7D5B]' : 'border border-[#E5E1D8]'}`}>
                      {ok && <Check size={11} />}
                    </span>
                    <span className={ok ? 'text-[#4A5568] line-through' : 'text-[#9A7A45] font-medium'}>{t}</span>
                    <ArrowUpRight className="ml-auto text-[#4A5568]" size={13} />
                  </button>
                ))}
              </div>
            </Card>

            {isEdit && (
              <Card title="Visibility & sharing">
                <fieldset>
                  <legend className="mb-3 text-xs leading-5 text-[#4A5568]">Choose who can discover your startup</legend>
                  {['Private', 'Mentors only', 'Mentors and investors'].map(x => (
                    <label key={x} className="mb-3 flex cursor-pointer items-start gap-2.5 text-sm">
                      <input
                        type="radio"
                        name="visibility"
                        value={x}
                        checked={visibility === x}
                        onChange={() => setVisibility(x)}
                        className="mt-0.5 accent-ink"
                      />
                      <span>
                        <b className="block text-[13px] text-ink">{x}</b>
                        <small className="text-xs text-[#4A5568]">
                          {x === 'Private'
                            ? 'Only your team can see this profile.'
                            : x === 'Mentors only'
                            ? 'Visible to your assigned mentors.'
                            : 'Discoverable by approved mentors and investors.'}
                        </small>
                      </span>
                    </label>
                  ))}
                </fieldset>
                <div className="my-3 border-t border-[#E5E1D8] pt-3">
                  <p className="mb-3 text-xs font-semibold text-ink">Share these details</p>
                  {[
                    ['traction', 'Traction numbers'],
                    ['funding', 'Funding details'],
                    ['contacts', 'Team contacts']
                  ].map(([key, label]) => (
                    <label key={key} className="mb-3 flex items-center justify-between text-xs text-ink">
                      <span>{label}</span>
                      <input
                        type="checkbox"
                        checked={shares[key]}
                        onChange={() => setShares({...shares, [key]: !shares[key]})}
                        className="h-4 w-4 accent-ink"
                      />
                    </label>
                  ))}
                </div>
                <p className="text-xs leading-5 text-[#4A5568]">Changes apply immediately. Hide your profile at any time.</p>
                <button
                  type="button"
                  onClick={() => {
                    setView('Public preview');
                    window.scrollTo({top: 0, behavior: 'smooth'});
                  }}
                  className="mt-3 text-xs font-semibold text-[#9A7A45] hover:underline"
                >
                  Preview as investor <ArrowRight className="inline" size={13} />
                </button>
              </Card>
            )}

            <Card title="Key facts">
              <dl className="space-y-3 text-xs">
                {[
                  ['Stage', 'Prototype'],
                  ['Readiness', '72 / 100'],
                  ['Founded', data.year],
                  ['Location', data.location],
                  ['Sector', data.sector],
                  ['Business model', data.business]
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt className="text-[#4A5568]">{k}</dt>
                    <dd className="text-right font-medium text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
              {!isEdit && (
                <span className="mt-4 inline-flex items-center gap-1 rounded-full bg-[#F3EBDD] px-2.5 py-1 text-xs font-semibold text-[#806236]">
                  <Check size={13} /> Investment Ready
                </span>
              )}
            </Card>

            <Card title="Your mentor">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[#E8EAF0] text-xs font-semibold text-ink">RM</span>
                <div>
                  <p className="text-sm font-semibold text-ink">Rhea Mukherjee</p>
                  <p className="text-xs text-[#4A5568]">Go-to-market · SaaS</p>
                </div>
              </div>
              <p className="mt-4 text-xs text-[#4A5568]">4 of 6 readiness items signed off</p>
              <div className="mt-2 h-1.5 rounded-full bg-[#E5E1D8]">
                <div className="h-full w-2/3 rounded-full bg-[#B8955A]" />
              </div>
              <Link href="/startup/mentors" className="mt-3 block text-xs font-semibold text-[#9A7A45] hover:underline">
                View mentor workspace <ArrowRight className="inline" size={13} />
              </Link>
            </Card>

            <Card title="Contact">
              <div className="space-y-3 text-xs">
                <p className="text-ink">
                  <Globe className="mr-2 inline text-[#9A7A45]" size={14} />
                  {data.website}
                </p>
                {isEdit ? (
                  <>
                    <p className="text-ink">
                      <Mail className="mr-2 inline text-[#9A7A45]" size={14} />
                      founder@acmestudio.example
                    </p>
                    <p className="text-[#4A5568]">+91 98XXX XXXXX</p>
                  </>
                ) : (
                  <p className="text-[#4A5568]">Use platform messaging to contact this startup.</p>
                )}
              </div>
              {!isEdit && (
                <button
                  type="button"
                  onClick={() => notify('Opening message composer.')}
                  className="mt-4 min-h-10 w-full rounded-lg bg-ink text-sm font-semibold text-white transition hover:bg-[#1C2B42]"
                >
                  Message startup
                </button>
              )}
            </Card>
          </aside>
        </div>

        {!isEdit && (
          <p className="mt-6 text-center text-xs text-[#4A5568]">Forma introduces parties and is not a broker or adviser.</p>
        )}
      </main>

      {/* Floating Save Drawer on Mobile */}
      {dirty && isEdit && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between border-t border-[#E5E1D8] bg-white p-3 shadow-lg sm:hidden">
          <span className="text-xs font-medium text-[#4A5568]">Unsaved changes</span>
          <div className="flex gap-2">
            <button type="button" onClick={discard} className="px-3 text-sm text-[#4A5568]">
              Discard
            </button>
            <button
              type="button"
              onClick={save}
              className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* Toast Notice */}
      {toast && (
        <div role="status" aria-live="polite" className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-ink px-4 py-3 text-sm text-white shadow-lg lg:bottom-6">
          {toast}
        </div>
      )}
    </div>
  );
}
