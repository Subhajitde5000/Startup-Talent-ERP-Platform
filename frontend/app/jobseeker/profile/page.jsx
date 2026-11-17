'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  User,
  CheckCircle2,
  Briefcase,
  Sparkles,
  MapPin,
  Clock,
  Award,
  DollarSign,
  Share2,
  Edit3,
  ExternalLink,
  Download,
  FileText,
  Linkedin,
  Github,
  Globe,
  Layers,
  Check,
  X,
  Eye,
  EyeOff,
  Code2,
  Palette,
  Terminal,
  Cpu,
} from 'lucide-react';
import { JobSeekerShell } from '@/components';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api/client';

export default function JobSeekerProfilePage() {
  const [toast, setToast] = useState('');
  const [activeTab, setActiveTab] = useState('experience'); // 'experience' | 'skills' | 'portfolio' | 'resume'
  const { user } = useAuth();
  const [loadStatus, setLoadStatus] = useState('loading'); // loading | ready | error

  const notify = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const [profile, setProfile] = useState({
    name: 'Ananya Das',
    handle: 'ananya_design',
    headline: 'Senior Product Designer & Design Systems Lead',
    currentRole: 'Senior Product Designer @ SaaSify Studio',
    location: 'Bengaluru, India (Open to Remote & Hybrid)',
    email: 'ananya.das@designer.io',
    avatar: 'AD',
    verified: true,
    jobReadyScore: 88,
    topPercentile: 'Top 5% Design Systems Score',
    verificationId: 'TAL-2026-IND-9912',
    experienceYears: '6.5 Years',
    noticePeriod: '15 Days (Serving Notice)',
    desiredCtc: '₹28L – ₹36L CTC + ESOPs',
    openToWork: true,
    bio: `Senior Product Designer with 6+ years specializing in high-density B2B SaaS workflows, fintech reconciliation tooling, and scalable Figma design systems. Passionate about bridging the gap between design tokens and production React/Tailwind code with strict WCAG AA accessibility compliance.`,
    skills: [
      { name: 'Figma & Design Tokens', category: 'Design', level: 'Expert' },
      { name: 'Complex B2B Data Tables & ERP UX', category: 'Design', level: 'Master' },
      { name: 'React & Tailwind CSS Prototyping', category: 'Engineering', level: 'Advanced' },
      { name: 'Design Systems Architecture', category: 'Design', level: 'Master' },
      { name: 'Usability Testing & Analytics', category: 'Research', level: 'Advanced' },
      { name: 'Next.js & Frontend Ergonomics', category: 'Engineering', level: 'Proficient' },
    ],
    experience: [
      {
        role: 'Senior Product Designer',
        company: 'SaaSify Studio Pvt Ltd',
        period: '2023 – Present (2 yrs)',
        location: 'Bengaluru',
        impact: [
          'Led end-to-end UX for enterprise billing dashboard; reduced checkout churn by 32%.',
          'Built multi-brand Figma token library adopted by 24 engineers and 6 designers.',
          'Conducted 40+ usability interviews with corporate finance and treasury leads.',
        ],
      },
      {
        role: 'Product Designer',
        company: 'ZetaPay Technologies',
        period: '2021 – 2023 (2.5 yrs)',
        location: 'Mumbai / Remote',
        impact: [
          'Redesigned core merchant onboarding flow, cutting KYC drop-off from 48% to 19%.',
          'Created real-time payout tracking screens supporting ₹120 Cr monthly transaction volume.',
        ],
      },
      {
        role: 'UI/UX Designer',
        company: 'PixelCraft Digital',
        period: '2019 – 2021 (2 yrs)',
        location: 'Bengaluru',
        impact: [
          'Designed responsive web applications for 8 Seed & Series A Indian startups.',
          'Created custom SVG illustrations and high-fidelity interactive prototypes.',
        ],
      },
    ],
    portfolio: [
      {
        title: 'Enterprise Treasury & Escrow Ledger UX',
        desc: 'Complete redesign of transaction reconciliation screens with keyboard shortcuts and multi-currency filtering.',
        tag: 'Fintech SaaS',
        metrics: '44% faster reconciliation',
        link: 'https://dribbble.com',
      },
      {
        title: 'Forma Design System Tokens & Specs',
        desc: 'Comprehensive multi-theme token library aligning Figma variables with Tailwind configuration.',
        tag: 'Design Systems',
        metrics: '120+ Components',
        link: 'https://figma.com',
      },
    ],
    education: [
      { degree: 'Bachelor of Design (Interaction Design)', school: 'National Institute of Design (NID)', year: '2015 – 2019' },
      { degree: 'Certified Professional in Accessibility Core Competencies', school: 'IAAP', year: '2024' },
    ],
    social: {
      linkedin: 'https://linkedin.com/in/ananyadas-design',
      github: 'https://github.com/ananya-ui',
      portfolio: 'https://ananyadas.design',
    },
  });

  // Step 3c: hydrate from the talent profile + session user + readiness.
  // Experience history, portfolio and resume tabs stay demo until Step 7d;
  // notice period / desired CTC have no backend column yet (flagged).
  const hydrate = async (me) => {
    try {
      const [talent, readiness] = await Promise.all([
        api.talentProfile.me(),
        api.users.readiness()
      ]);
      setProfile((prev) => ({
        ...prev,
        name: me?.display_name || prev.name,
        handle: me?.handle || prev.handle,
        headline: talent?.headline || prev.headline,
        currentRole: talent?.headline || prev.currentRole,
        location: talent?.current_location || prev.location,
        email: me?.email || prev.email,
        avatar: me?.avatar_initials || prev.avatar,
        experienceYears:
          talent?.total_experience_yrs != null
            ? `${talent.total_experience_yrs} Years`
            : prev.experienceYears,
        openToWork: talent ? talent.is_searchable : prev.openToWork,
        bio: talent?.summary || prev.bio,
        jobReadyScore: readiness?.overall_score ?? prev.jobReadyScore,
        skills:
          talent && talent.skills.length
            ? talent.skills.map((sk) => ({
                name: sk.name,
                category: sk.category || 'Skills',
                level: '—'
              }))
            : prev.skills
      }));
      setLoadStatus('ready');
    } catch (err) {
      setLoadStatus('error');
      notify(err instanceof ApiError ? err.message : 'Could not load your profile.');
    }
  };

  const reload = () => {
    setLoadStatus('loading');
    hydrate(user);
  };

  useEffect(() => {
    hydrate(user);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <JobSeekerShell active="Profile" notify={notify} toast={toast}>
      {loadStatus === 'loading' && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-[#E5E1D8] bg-white p-6 text-xs text-[#6B7280]">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/30 border-t-ink" />
          Loading your profile…
        </div>
      )}
      {loadStatus === 'error' && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-6 text-xs text-red-700">
          Could not load your profile.{' '}
          <button type="button" onClick={reload} className="font-semibold underline">Retry</button>
        </div>
      )}
      {loadStatus === 'ready' && (
      <>
      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6">
        {/* Top Header Bar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E1D8] pb-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#5A6E85]">
              <Link href="/jobseeker/dashboard" className="hover:text-[#0F1B2D]">Career Workspace</Link>
              <span>/</span>
              <span className="font-semibold text-[#0F1B2D]">Talent Profile</span>
            </div>
            <h1 className="mt-1 font-serif text-2xl font-bold text-[#0F1B2D]">
              Talent Profile & Portfolio
            </h1>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                if (navigator.clipboard) {
                  navigator.clipboard.writeText(window.location.href);
                  notify('Profile link copied to clipboard.');
                }
              }}
              className="flex items-center gap-1.5 rounded-lg border border-[#E5E1D8] bg-white px-3 py-1.5 text-xs font-semibold text-[#0F1B2D] hover:bg-[#FAF8F4] transition shadow-xs"
            >
              <Share2 size={13} className="text-[#5A6E85]" />
              Share Profile
            </button>
            <Link href="/jobseeker/profile/edit">
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-lg bg-[#0F1B2D] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#1C2B42] transition shadow-xs"
              >
                <Edit3 size={13} className="text-[#B8955A]" />
                Edit Profile
              </button>
            </Link>
          </div>
        </div>

        {/* Hero Card */}
        <div className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-[#0F1B2D] font-serif text-2xl font-bold text-white shadow-md">
                {profile.avatar}
              </div>

              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-serif text-xl font-bold text-[#0F1B2D] sm:text-2xl">
                    {profile.name}
                  </h2>
                  <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800 border border-emerald-200">
                    <CheckCircle2 size={13} /> Verified Talent
                  </span>
                  <span className="flex items-center gap-1 rounded-full bg-[#B8955A]/15 px-2.5 py-0.5 text-xs font-semibold text-[#8C6D37] border border-[#B8955A]/30">
                    <Sparkles size={13} /> Job Ready • Score {profile.jobReadyScore}
                  </span>
                </div>

                <p className="text-sm font-medium text-[#4A5568]">
                  {profile.headline}
                </p>

                <div className="flex flex-wrap items-center gap-3 text-xs text-[#5A6E85]">
                  <span className="flex items-center gap-1">
                    <MapPin size={13} className="text-[#7B8CA3]" />
                    {profile.location}
                  </span>
                  <span>•</span>
                  <span>{profile.experienceYears} Experience</span>
                  <span>•</span>
                  <span className="font-mono text-[#7B8CA3]">ID: {profile.verificationId}</span>
                </div>
              </div>
            </div>

            {/* Availability & Compensation */}
            <div className="flex flex-wrap items-center gap-4 border-t border-[#F2EFE9] pt-4 lg:border-t-0 lg:pt-0">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                  <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
                  <span>Notice Period</span>
                </div>
                <p className="mt-1 font-serif text-base font-bold text-emerald-900">
                  {profile.noticePeriod}
                </p>
                <p className="text-[10px] text-emerald-800">Ready to join immediately</p>
              </div>

              <div className="rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] p-3 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-[#0F1B2D]">
                  <DollarSign size={14} className="text-[#B8955A]" />
                  <span>Desired Compensation</span>
                </div>
                <p className="mt-1 font-serif text-base font-bold text-[#0F1B2D]">
                  {profile.desiredCtc}
                </p>
                <p className="text-[10px] text-[#5A6E85]">Negotiable for high equity</p>
              </div>
            </div>
          </div>

          {/* Bio Preview */}
          <p className="mt-5 text-xs leading-relaxed text-[#4A5568] border-t border-[#F2EFE9] pt-4">
            {profile.bio}
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="mt-6 flex border-b border-[#E5E1D8] text-xs font-semibold">
          {[
            { id: 'experience', label: 'Work Experience' },
            { id: 'skills', label: 'Skills & Competencies' },
            { id: 'portfolio', label: 'Portfolio Case Studies' },
            { id: 'resume', label: 'Resume & Verified Credentials' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`border-b-2 px-4 py-3 transition ${
                activeTab === tab.id
                  ? 'border-[#B8955A] text-[#0F1B2D] font-bold'
                  : 'border-transparent text-[#7B8CA3] hover:text-[#0F1B2D]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab 1: Experience */}
        {activeTab === 'experience' && (
          <div className="mt-6 space-y-4">
            {profile.experience.map((exp, i) => (
              <div key={i} className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div>
                    <h3 className="font-serif text-base font-bold text-[#0F1B2D]">{exp.role}</h3>
                    <p className="text-xs text-[#5A6E85]">{exp.company} • {exp.location}</p>
                  </div>
                  <span className="rounded bg-[#FAF8F4] px-2.5 py-1 text-xs font-semibold text-[#0F1B2D] border border-[#E5E1D8]">
                    {exp.period}
                  </span>
                </div>

                <ul className="space-y-1.5 text-xs text-[#4A5568]">
                  {exp.impact.map((pt, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-[#B8955A] mt-0.5">•</span>
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {/* Tab 2: Skills */}
        {activeTab === 'skills' && (
          <div className="mt-6 rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm">
            <h3 className="font-serif text-base font-bold text-[#0F1B2D] mb-4 flex items-center gap-2">
              <Layers size={16} className="text-[#B8955A]" />
              Verified Core Proficiencies
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {profile.skills.map((skill, i) => (
                <div key={i} className="rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] p-3 text-xs flex items-center justify-between">
                  <div>
                    <p className="font-bold text-[#0F1B2D]">{skill.name}</p>
                    <p className="text-[10px] text-[#5A6E85]">{skill.category}</p>
                  </div>
                  <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                    {skill.level}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Portfolio */}
        {activeTab === 'portfolio' && (
          <div className="mt-6 space-y-4">
            {profile.portfolio.map((proj, i) => (
              <div key={i} className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-serif text-base font-bold text-[#0F1B2D]">{proj.title}</h4>
                    <span className="rounded bg-[#FAF8F4] px-2 py-0.5 text-[10px] font-semibold text-[#5A6E85] border border-[#E5E1D8]">
                      {proj.tag}
                    </span>
                  </div>
                  <p className="text-xs text-[#5A6E85]">{proj.desc}</p>
                  <p className="text-[11px] font-bold text-emerald-800">{proj.metrics}</p>
                </div>
                <a
                  href={proj.link}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#0F1B2D] px-3.5 py-1.5 text-xs font-semibold text-[#0F1B2D] hover:bg-[#0F1B2D] hover:text-white transition shrink-0"
                >
                  <span>View Case Study</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            ))}
          </div>
        )}

        {/* Tab 4: Resume */}
        {activeTab === 'resume' && (
          <div className="mt-6 rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F2EFE9] pb-4">
              <div>
                <h3 className="font-serif text-base font-bold text-[#0F1B2D] flex items-center gap-2">
                  <FileText size={16} className="text-[#B8955A]" />
                  Verified Resume Document
                </h3>
                <p className="text-xs text-[#5A6E85]">Updated November 2026 • Verified by Platform AI Screening</p>
              </div>
              <button
                onClick={() => notify('Downloading verified resume PDF...')}
                className="flex items-center gap-1.5 rounded-lg bg-[#0F1B2D] px-4 py-2 text-xs font-bold text-white hover:bg-[#1C2B42] transition"
              >
                <Download size={14} className="text-[#B8955A]" />
                Download PDF Resume
              </button>
            </div>

            <div>
              <h4 className="font-serif text-sm font-bold text-[#0F1B2D] mb-3">Education & Credentials</h4>
              <div className="space-y-3">
                {profile.education.map((edu, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] p-3 text-xs">
                    <div>
                      <p className="font-bold text-[#0F1B2D]">{edu.degree}</p>
                      <p className="text-[#5A6E85]">{edu.school}</p>
                    </div>
                    <span className="font-mono text-[#7B8CA3]">{edu.year}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* EDIT MODAL */}

      </>
      )}
    </JobSeekerShell>
  );
}
