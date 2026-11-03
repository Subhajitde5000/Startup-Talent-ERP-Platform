"use client";

import { useState } from "react";
import type { ElementType } from "react";
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Bell, BriefcaseBusiness,
  CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp,
  ClipboardCheck, Clock3, FileText, FolderKanban, Gauge, Lightbulb, Menu,
  MessageSquare, MoreHorizontal, Plus, Search, Settings2, ShieldCheck,
  Sparkles, Target, Users, Wallet, X, Zap
} from "lucide-react";

type NavItem = { label: string; icon: ElementType; section?: string };

const navigation: NavItem[] = [
  { label: "Overview", icon: Gauge },
  { label: "Startup profile", icon: BriefcaseBusiness, section: "WORKSPACE" },
  { label: "Team management", icon: Users },
  { label: "Stage roadmap", icon: Target },
  { label: "Idea validation", icon: Lightbulb },
  { label: "Customer research", icon: Search },
  { label: "Market analysis", icon: Activity },
  { label: "Projects & sprints", icon: FolderKanban },
  { label: "Prototype testing", icon: ClipboardCheck },
  { label: "Sales pipeline", icon: Wallet },
  { label: "Business analytics", icon: Gauge },
  { label: "Hiring requests", icon: BriefcaseBusiness, section: "GROWTH" },
  { label: "Data room", icon: FileText },
];

const tasks = [
  { title: "Complete 5 customer interviews", meta: "Customer research · Due today", tag: "High priority", done: false },
  { title: "Review problem statement", meta: "Idea validation · Due tomorrow", tag: "In progress", done: false },
  { title: "Upload competitor analysis", meta: "Market analysis · Due 08 Nov", tag: "To do", done: false },
];

const activities = [
  { initials: "AD", color: "bg-[#E8E0D2]", title: "Ananya added a customer interview summary", time: "2 hours ago" },
  { initials: "RK", color: "bg-[#DDE7E2]", title: "Rahul updated the startup profile", time: "Yesterday" },
  { initials: "SY", color: "bg-[#E5E1EC]", title: "You created the first roadmap milestone", time: "2 days ago" },
];

const stages = [
  { name: "Idea", description: "Validate the problem", number: "01" },
  { name: "Prototype", description: "Build and test", number: "02" },
  { name: "Early revenue", description: "Find paying customers", number: "03" },
  { name: "Mature", description: "Scale operations", number: "04" },
];

function Brand() {
  return (
    <div className="flex items-center gap-3 px-6 py-6">
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#0F1B2D] text-[#D8BD8E]">
        <span className="display-font text-xl font-semibold">f</span>
      </div>
      <div>
        <div className="display-font text-[19px] font-semibold leading-none tracking-[-.03em]">foundry</div>
        <div className="mt-1 text-[9px] font-semibold uppercase tracking-[.2em] text-[#A0A7B4]">Startup workspace</div>
      </div>
    </div>
  );
}

function Sidebar({ active, setActive, open, close }: {
  active: string; setActive: (value: string) => void; open: boolean; close: () => void;
}) {
  return (
    <>
      {open && <button aria-label="Close navigation overlay" onClick={close} className="fixed inset-0 z-40 bg-[#0F1B2D]/30 lg:hidden" />}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[258px] flex-col border-r border-[#E5E1D8] bg-white transition-transform duration-200 lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between">
          <Brand />
          <button onClick={close} aria-label="Close menu" className="mr-4 rounded-lg p-2 text-[#4A5568] hover:bg-[#F4F1EB] lg:hidden"><X size={18}/></button>
        </div>
        <div className="mx-4 mb-5 rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[.15em] text-[#A0A7B4]">Current workspace</span>
            <ChevronDown size={14} className="text-[#4A5568]"/>
          </div>
          <div className="mt-2 flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#1C2B42] text-xs font-semibold text-white">N</div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">Northstar Labs</div>
              <div className="text-[11px] text-[#7C8491]">Idea stage</div>
            </div>
          </div>
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          {navigation.map((item, index) => (
            <div key={item.label}>
              {item.section && <div className={`px-3 pb-2 pt-5 text-[10px] font-bold tracking-[.16em] text-[#A0A7B4] ${index === 1 ? "pt-2" : ""}`}>{item.section}</div>}
              <button onClick={() => { setActive(item.label); close(); }} className={`mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-[10px] text-left text-[13px] transition-colors ${active === item.label ? "bg-[#0F1B2D] font-semibold text-white shadow-sm" : "text-[#596273] hover:bg-[#F4F1EB] hover:text-[#0F1B2D]"}`}>
                <item.icon size={16} strokeWidth={1.8}/>
                <span>{item.label}</span>
                {item.label === "Team management" && <span className="ml-auto rounded-full bg-[#F4F1EB] px-2 py-0.5 text-[10px] text-[#596273]">4</span>}
              </button>
            </div>
          ))}
        </nav>
        <div className="border-t border-[#E5E1D8] p-3">
          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] text-[#596273] hover:bg-[#F4F1EB]"><CircleHelp size={16}/> Help & support</button>
          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] text-[#596273] hover:bg-[#F4F1EB]"><Settings2 size={16}/> Settings</button>
          <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-[#FAF8F4] p-3">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-[#D9E3E0] text-[11px] font-bold text-[#315A4B]">SD</div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold">Sam Developer</div>
              <div className="truncate text-[10px] text-[#89909B]">Founder account</div>
            </div>
            <MoreHorizontal size={17} className="text-[#89909B]"/>
          </div>
        </div>
      </aside>
    </>
  );
}

function MetricCard({ label, value, sub, icon: Icon, trend }: {
  label: string; value: string; sub: string; icon: ElementType; trend?: string;
}) {
  return (
    <div className="rounded-2xl border border-[#E5E1D8] bg-white p-5">
      <div className="flex items-start justify-between">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#F4F1EB] text-[#8B7047]"><Icon size={17}/></div>
        {trend && <span className="flex items-center gap-1 text-[11px] font-semibold text-[#2E7D5B]"><ArrowUpRight size={13}/>{trend}</span>}
      </div>
      <div className="mt-4 text-[11px] font-medium text-[#7C8491]">{label}</div>
      <div className="mt-1 text-[27px] font-semibold tracking-[-.04em] text-[#0F1B2D]">{value}</div>
      <div className="mt-1 text-[11px] text-[#9299A3]">{sub}</div>
    </div>
  );
}

export default function DashboardPage() {
  const [active, setActive] = useState("Overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const [completed, setCompleted] = useState<string[]>([]);
  const [showNotice, setShowNotice] = useState(true);
  const [showAllActivity, setShowAllActivity] = useState(false);

  const toggleTask = (title: string) => setCompleted(current =>
    current.includes(title) ? current.filter(item => item !== title) : [...current, title]
  );

  return (
    <div className="min-h-screen bg-[#FAF8F4]">
      <Sidebar active={active} setActive={setActive} open={menuOpen} close={() => setMenuOpen(false)}/>
      <div className="min-h-screen lg:pl-[258px]">
        <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-[#E5E1D8] bg-[#FAF8F4]/95 px-5 backdrop-blur md:px-8">
          <div className="flex items-center gap-3">
            <button onClick={() => setMenuOpen(true)} aria-label="Open navigation" className="rounded-lg p-2 hover:bg-[#F0EDE6] lg:hidden"><Menu size={20}/></button>
            <div className="hidden text-xs text-[#9299A3] sm:block">Workspace <span className="mx-2">/</span><span className="font-semibold text-[#0F1B2D]">{active}</span></div>
            <div className="text-sm font-semibold sm:hidden">{active}</div>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <button aria-label="Search" className="rounded-lg p-2 text-[#667080] hover:bg-[#F0EDE6]"><Search size={18}/></button>
            <button aria-label="Notifications" className="relative rounded-lg p-2 text-[#667080] hover:bg-[#F0EDE6]"><Bell size={18}/><span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#B8955A]"/></button>
            <div className="hidden h-7 w-px bg-[#E5E1D8] sm:block"/>
            <button className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-[#F0EDE6]">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-[#D9E3E0] text-[11px] font-bold text-[#315A4B]">SD</div>
              <span className="hidden text-xs font-semibold sm:block">Sam Developer</span><ChevronDown size={14} className="hidden text-[#9299A3] sm:block"/>
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-[1440px] px-5 py-7 md:px-8 md:py-9">
          <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.16em] text-[#9A7A45]"><span className="h-px w-5 bg-[#B8955A]"/> Tuesday, 03 November 2026</div>
              <h1 className="display-font text-[32px] font-semibold leading-tight tracking-[-.035em] sm:text-[38px]">Good morning, Sam.</h1>
              <p className="mt-2 text-sm text-[#737C8B]">A clear view of what is moving your startup forward.</p>
            </div>
            <button onClick={() => alert("Demo action: create a new workspace item.")} className="inline-flex items-center justify-center gap-2 self-start rounded-lg bg-[#0F1B2D] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#1C2B42] sm:self-auto"><Plus size={15}/> Create new</button>
          </div>

          {showNotice && <div className="mb-6 flex items-start gap-3 rounded-xl border border-[#E8DCC7] bg-[#F7F1E6] px-4 py-3.5">
            <Sparkles size={17} className="mt-0.5 shrink-0 text-[#9A7A45]"/>
            <div className="flex-1 text-xs leading-5 text-[#66563E]"><span className="font-semibold">Your next milestone starts with customer discovery.</span> Complete five customer interviews to strengthen your problem validation.</div>
            <button aria-label="Dismiss suggestion" onClick={() => setShowNotice(false)} className="rounded p-1 text-[#8B795E] hover:bg-[#EFE4D2]"><X size={15}/></button>
          </div>}

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Startup readiness" value="35 / 100" sub="Early validation in progress" icon={Gauge} trend="+8 this month"/>
            <MetricCard label="Milestones completed" value="7 / 20" sub="13 milestones remaining" icon={Target}/>
            <MetricCard label="Active tasks" value={`${tasks.length - completed.length}`} sub={`${completed.length} completed in this session`} icon={ClipboardCheck}/>
            <MetricCard label="Team members" value="4" sub="2 founders · 2 contributors" icon={Users}/>
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,.85fr)]">
            <div className="rounded-2xl border border-[#E5E1D8] bg-white p-5 md:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><div className="text-[11px] font-semibold uppercase tracking-[.14em] text-[#9A7A45]">Your journey</div><h2 className="display-font mt-1 text-[22px] font-semibold">Startup stage roadmap</h2><p className="mt-1 text-xs text-[#89909B]">A practical path from idea to a scalable business.</p></div>
                <button onClick={() => setActive("Stage roadmap")} className="inline-flex items-center gap-1 text-xs font-semibold text-[#8B7047] hover:text-[#0F1B2D]">View roadmap <ArrowRight size={14}/></button>
              </div>
              <div className="mt-7 grid grid-cols-4">
                {stages.map((stage, index) => <div key={stage.name} className="relative">
                  <div className={`relative z-10 grid h-9 w-9 place-items-center rounded-full border text-[11px] font-bold ${index === 0 ? "border-[#0F1B2D] bg-[#0F1B2D] text-white" : "border-[#E5E1D8] bg-white text-[#A0A7B4]"}`}>{index === 0 ? <Check size={15}/> : stage.number}</div>
                  {index < 3 && <div className="absolute left-9 right-0 top-[17px] h-px bg-[#E5E1D8]"><div className={`h-px ${index === 0 ? "w-1/3 bg-[#B8955A]" : "w-0"}`}/></div>}
                  <div className="mt-3 pr-2"><div className={`text-[11px] font-semibold sm:text-xs ${index === 0 ? "text-[#0F1B2D]" : "text-[#7C8491]"}`}>{stage.name}</div><div className="mt-1 hidden text-[10px] leading-4 text-[#A0A7B4] sm:block">{stage.description}</div></div>
                  {index === 0 && <span className="mt-2 inline-flex rounded-full bg-[#F4F1EB] px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-[#8B7047]">Current stage</span>}
                </div>)}
              </div>
              <div className="mt-7 rounded-xl bg-[#FAF8F4] p-4">
                <div className="flex items-center justify-between gap-3"><div><div className="text-xs font-semibold">Idea validation</div><div className="mt-1 text-[11px] text-[#89909B]">3 of 8 activities completed</div></div><div className="text-sm font-semibold">38%</div></div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#E8E4DC]"><div className="h-full w-[38%] rounded-full bg-[#B8955A]"/></div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#E5E1D8] bg-[#0F1B2D] p-5 text-white md:p-6">
              <div className="flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[.16em] text-[#D8BD8E]">Founder note</span><Sparkles size={17} className="text-[#D8BD8E]"/></div>
              <h2 className="display-font mt-5 text-[25px] leading-tight">Build with evidence.<br/>Not assumptions.</h2>
              <p className="mt-3 text-xs leading-5 text-[#C0C8D3]">Before investing heavily in a solution, make sure the problem is real, frequent, and painful enough for someone to pay to solve it.</p>
              <div className="mt-6 border-t border-white/15 pt-4">
                <div className="flex items-center justify-between text-[11px]"><span className="text-[#C0C8D3]">Suggested next step</span><span className="rounded-full bg-white/10 px-2 py-1 text-[9px] text-[#E9D7B8]">30–45 min</span></div>
                <div className="mt-2 text-sm font-semibold">Talk to 5 potential customers</div>
                <button onClick={() => setActive("Customer research")} className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-[#E2C99F] hover:text-white">Open customer research <ArrowRight size={14}/></button>
              </div>
            </div>
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,.8fr)]">
            <div className="rounded-2xl border border-[#E5E1D8] bg-white p-5 md:p-6">
              <div className="flex items-center justify-between gap-3"><div><h2 className="display-font text-[21px] font-semibold">Priority tasks</h2><p className="mt-1 text-xs text-[#89909B]">Keep the most important work moving.</p></div><button onClick={() => setActive("Projects & sprints")} className="text-xs font-semibold text-[#8B7047] hover:text-[#0F1B2D]">View all</button></div>
              <div className="mt-5 divide-y divide-[#F0EDE6]">
                {tasks.map(task => {
                  const isDone = completed.includes(task.title);
                  return <div key={task.title} className="flex items-start gap-3 py-4 first:pt-0 last:pb-0">
                    <button aria-label={isDone ? "Mark task incomplete" : "Mark task complete"} onClick={() => toggleTask(task.title)} className={`mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-md border ${isDone ? "border-[#2E7D5B] bg-[#2E7D5B] text-white" : "border-[#C9C4BA] bg-white text-transparent hover:border-[#B8955A]"}`}><Check size={12}/></button>
                    <div className="min-w-0 flex-1"><div className={`text-xs font-semibold ${isDone ? "text-[#A0A7B4] line-through" : "text-[#263449]"}`}>{task.title}</div><div className="mt-1.5 text-[10px] text-[#9299A3]">{task.meta}</div></div>
                    <span className={`hidden rounded-full px-2.5 py-1 text-[9px] font-semibold sm:inline-flex ${task.tag === "High priority" ? "bg-[#F9ECE8] text-[#A84A3F]" : task.tag === "In progress" ? "bg-[#F7F1E6] text-[#927345]" : "bg-[#F1F2F3] text-[#727B88]"}`}>{isDone ? "Completed" : task.tag}</span>
                  </div>
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-[#E5E1D8] bg-white p-5 md:p-6">
              <div className="flex items-center justify-between"><div><h2 className="display-font text-[21px] font-semibold">Recent activity</h2><p className="mt-1 text-xs text-[#89909B]">The latest updates from your team.</p></div><button aria-label="More activity options" onClick={() => setShowAllActivity(!showAllActivity)} className="rounded-lg p-2 text-[#89909B] hover:bg-[#F4F1EB]"><MoreHorizontal size={18}/></button></div>
              <div className="mt-5 space-y-5">
                {(showAllActivity ? [...activities, { initials: "SD", color: "bg-[#E8E0D2]", title: "You updated the validation roadmap", time: "3 days ago" }] : activities).map((activity, index) => <div key={index} className="flex items-start gap-3">
                  <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${activity.color} text-[9px] font-bold text-[#4A5568]`}>{activity.initials}</div>
                  <div className="min-w-0"><div className="text-xs leading-5 text-[#364256]">{activity.title}</div><div className="mt-1 text-[10px] text-[#A0A7B4]">{activity.time}</div></div>
                </div>)}
              </div>
              <div className="mt-5 border-t border-[#F0EDE6] pt-4"><button onClick={() => setShowAllActivity(!showAllActivity)} className="inline-flex items-center gap-1 text-xs font-semibold text-[#8B7047] hover:text-[#0F1B2D]">{showAllActivity ? "Show less" : "See all activity"} <ArrowRight size={13}/></button></div>
            </div>
          </section>

          <section className="mt-6 rounded-2xl border border-[#E5E1D8] bg-white p-5 md:p-6">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h2 className="display-font text-[21px] font-semibold">Build your support network</h2><p className="mt-1 text-xs text-[#89909B]">Bring the right people into your startup journey.</p></div><button onClick={() => setActive("Team management")} className="inline-flex items-center gap-2 self-start rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs font-semibold text-[#4A5568] hover:bg-[#FAF8F4]">Explore connections <ArrowRight size={14}/></button></div>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="flex items-start gap-3 rounded-xl bg-[#FAF8F4] p-4"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-[#8B7047]"><Users size={17}/></div><div><div className="text-xs font-semibold">Find a co-founder</div><p className="mt-1 text-[11px] leading-4 text-[#89909B]">Connect with people who complement your skills.</p></div></div>
              <div className="flex items-start gap-3 rounded-xl bg-[#FAF8F4] p-4"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-[#8B7047]"><MessageSquare size={17}/></div><div><div className="text-xs font-semibold">Meet a mentor</div><p className="mt-1 text-[11px] leading-4 text-[#89909B]">Get practical guidance from experienced builders.</p></div></div>
              <div className="flex items-start gap-3 rounded-xl bg-[#FAF8F4] p-4"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-[#8B7047]"><Zap size={17}/></div><div><div className="text-xs font-semibold">Prepare to raise</div><p className="mt-1 text-[11px] leading-4 text-[#89909B]">Organise your story and investor-ready materials.</p></div></div>
            </div>
          </section>

          <footer className="flex flex-col justify-between gap-2 py-7 text-[10px] text-[#A0A7B4] sm:flex-row"><span>© 2026 Foundry. Built for people building what comes next.</span><span className="flex items-center gap-2"><ShieldCheck size={12}/> Your workspace is private</span></footer>
        </main>
      </div>
    </div>
  );
}
