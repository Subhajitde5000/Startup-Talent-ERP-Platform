'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  User,
  CheckCircle2,
  Calendar,
  Clock,
  Award,
  Star,
  Building2,
  ExternalLink,
  Mail,
  Linkedin,
  Github,
  Twitter,
  MapPin,
  ShieldCheck,
  Edit3,
  Layers,
  Sparkles,
  BookOpen,
  Users,
  Video,
  Check,
  X,
  Share2,
  Briefcase,
  TrendingUp,
  FileText,
  DollarSign,
  Globe,
  Sliders,
} from 'lucide-react';
import MentorPageShell from '../mentor-page-shell';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api/client';

export default function MentorProfilePage() {
  const [toast, setToast] = useState('');
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'expertise' | 'startups' | 'availability' | 'credentials'
  const { user } = useAuth();
  const [loadStatus, setLoadStatus] = useState('loading'); // loading | ready | error

  const notify = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  // Profile State
  const [profile, setProfile] = useState({
    name: 'Dr. Sneha Roy',
    handle: 'drsneha_tech',
    title: 'Senior Technology Architect & Distributed Systems Specialist',
    organization: 'Ex-Google Staff Eng • Adjunct Prof BITS Pilani',
    location: 'Bengaluru, India (Open to Remote Globally)',
    email: 'sneha.roy@techmentor.in',
    avatar: 'SR',
    verified: true,
    dpiitEmpanelled: true,
    verificationId: 'MEN-DPIIT-2026-8842',
    memberSince: 'March 2024',
    rating: 4.96,
    reviewsCount: 38,
    startupsAdvisedCount: 14,
    sessionsCount: 92,
    acceptedAnswersCount: 42,
    availabilityStatus: 'Accepting 2 new seed startups',
    isAvailable: true,
    hourlyRate: '₹6,500',
    proBonoHours: '3 hours / month for DPIIT pre-seed founders',
    bio: `15+ years architecting distributed transaction engines and cloud infrastructure at planetary scale. Formerly Staff Software Engineer at Google Core Systems. Currently mentoring high-growth Indian startups on transitioning from MVP hack to scalable multi-region microservices, enterprise SOC2 readiness, and engineering squad leadership.`,
    advisoryPhilosophy: `I don't write code for you—I help founding teams build the architectural muscles to avoid expensive multi-crore technical debt before Series A. I focus on pragmatic, high-throughput architectures without premature microservice fragmentation.`,
    expertiseDomains: [
      { name: 'Distributed Systems & Concurrency', level: 'Master', startups: 12 },
      { name: 'Cloud Infrastructure (AWS/GCP)', level: 'Expert', startups: 14 },
      { name: 'B2B FinTech & Transaction Scalability', level: 'Expert', startups: 9 },
      { name: 'Database Sharding & Read-Replicas', level: 'Master', startups: 11 },
      { name: 'Engineering Leadership & Tech Hiring', level: 'Advanced', startups: 8 },
      { name: 'SOC2 & ISO 27001 Security Readiness', level: 'Advanced', startups: 6 },
    ],
    advisedStartups: [
      {
        name: 'FinFlow Technologies',
        founder: 'Aarav Kapoor',
        stage: 'Seed • DPIIT Accredited',
        focus: 'Corporate treasury pipeline automation',
        impact: 'Scaled transaction throughput from 500 TPS to 12,000 TPS with zero data loss.',
        testimonial: 'Dr. Sneha completely reshaped our ledger architecture prior to our seed round. Her guidance saved us at least 6 months of rewrites.',
        rating: 5,
      },
      {
        name: 'RazorScale HR',
        founder: 'Kunal Verma',
        stage: 'Pre-Series A',
        focus: 'Candidate workflow orchestration',
        impact: 'Implemented multi-tenant isolation and automated webhook delivery engine.',
        testimonial: 'The most rigorous and practical technical mentor on the platform. Deep domain knowledge in Indian enterprise compliance.',
        rating: 5,
      },
      {
        name: 'AgriSense IoT',
        founder: 'Meera Deshmukh',
        stage: 'Seed Funded',
        focus: 'Edge sensor telemetry for precision agriculture',
        impact: 'Reduced cloud telemetry ingestion costs by 64% using compressed protobuf websockets.',
        testimonial: 'Sneha taught our junior team how to design for edge resilience without expensive SaaS dependencies.',
        rating: 5,
      },
    ],
    credentials: [
      { title: 'PhD in Computer Science (Distributed Systems)', institution: 'BITS Pilani', year: '2016' },
      { title: 'Ex-Staff Software Engineer (Core Systems)', institution: 'Google Mountain View & Bengaluru', year: '2017 – 2023' },
      { title: 'Senior Systems Architect', institution: 'Cisco Systems', year: '2012 – 2017' },
      { title: 'AWS Certified Solutions Architect – Professional', institution: 'Amazon Web Services', year: 'Valid through 2027' },
      { title: 'Empanelled Startup Mentor', institution: 'Department for Promotion of Industry and Internal Trade (DPIIT)', year: '2025 – Present' },
    ],
    social: {
      linkedin: 'https://linkedin.com/in/drsneharoy',
      github: 'https://github.com/drsneha-arch',
      twitter: 'https://x.com/drsneha_tech',
      website: 'https://sneharoy.tech',
    },
  });

  // Edit Form State
  // Step 3c: hydrate from the mentor profile + session user.
  // Sessions, startups, credentials tabs stay demo until Steps 8/10.
  const hydrate = async (me) => {
    try {
      const mentor = await api.mentorProfile.me();
      setProfile((prev) => ({
        ...prev,
        name: me?.display_name || prev.name,
        handle: me?.handle || prev.handle,
        title: mentor?.headline || prev.title,
        email: me?.email || prev.email,
        avatar: me?.avatar_initials || prev.avatar,
        bio: mentor?.bio || prev.bio,
        isAvailable: mentor ? mentor.accepting_requests : prev.isAvailable,
        availabilityStatus: mentor?.cadence || prev.availabilityStatus,
        hourlyRate:
          mentor?.hourly_fee != null
            ? `₹${Number(mentor.hourly_fee).toLocaleString('en-IN')}`
            : prev.hourlyRate,
        expertiseDomains:
          mentor && mentor.expertise.length ? mentor.expertise : prev.expertiseDomains,
        social: {
          linkedin: me?.linkedin_url || prev.social?.linkedin || '',
          github: me?.github_url || prev.social?.github || '',
          twitter: me?.twitter_url || prev.social?.twitter || '',
          website: me?.website_url || prev.social?.website || ''
        }
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
    <MentorPageShell active="Profile" notify={notify} toast={toast}>
      {loadStatus === 'loading' && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-[#E5E1D8] bg-white p-6 text-sm text-[#4A5568]">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/30 border-t-ink" />
          Loading your profile…
        </div>
      )}
      {loadStatus === 'error' && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          Could not load your profile.{' '}
          <button type="button" onClick={reload} className="font-semibold underline">Retry</button>
        </div>
      )}
      {loadStatus === 'ready' && (
      <>
      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6">
        {/* Top Breadcrumb & Actions Bar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E1D8] pb-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#5A6E85]">
              <Link href="/mentor/dashboard" className="hover:text-[#0F1B2D]">Dashboard</Link>
              <span>/</span>
              <span className="font-semibold text-[#0F1B2D]">Mentor Profile</span>
            </div>
            <h1 className="mt-1 font-serif text-2xl font-bold text-[#0F1B2D]">
              Advisory Profile & Credentials
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
            <Link href="/mentor/profile/edit">
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
                    <CheckCircle2 size={13} /> Verified Mentor
                  </span>
                  <span className="flex items-center gap-1 rounded-full bg-[#B8955A]/15 px-2.5 py-0.5 text-xs font-semibold text-[#8C6D37] border border-[#B8955A]/30">
                    <ShieldCheck size={13} /> DPIIT Empanelled
                  </span>
                </div>

                <p className="text-sm font-medium text-[#4A5568]">
                  {profile.title}
                </p>

                <div className="flex flex-wrap items-center gap-3 text-xs text-[#5A6E85]">
                  <span className="flex items-center gap-1">
                    <Building2 size={13} className="text-[#7B8CA3]" />
                    {profile.organization}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <MapPin size={13} className="text-[#7B8CA3]" />
                    {profile.location}
                  </span>
                  <span>•</span>
                  <span className="font-mono text-[#7B8CA3]">ID: {profile.verificationId}</span>
                </div>
              </div>
            </div>

            {/* Quick Status / Rate Card */}
            <div className="flex flex-wrap items-center gap-4 border-t border-[#F2EFE9] pt-4 lg:border-t-0 lg:pt-0">
              <div className="rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] p-3 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-[#0F1B2D]">
                  <Clock size={14} className="text-[#B8955A]" />
                  <span>Advisory Fee</span>
                </div>
                <p className="mt-1 font-serif text-lg font-bold text-[#0F1B2D]">
                  {profile.hourlyRate} <span className="text-xs font-normal text-[#5A6E85]">/ hour</span>
                </p>
                <p className="text-[10px] text-[#5A6E85]">{profile.proBonoHours}</p>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                  <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
                  <span>Availability</span>
                </div>
                <p className="mt-1 font-medium text-emerald-800">
                  {profile.availabilityStatus}
                </p>
                <Link
                  href="/mentor/sessions"
                  className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-900 hover:underline"
                >
                  Manage calendar slots →
                </Link>
              </div>
            </div>
          </div>

          {/* Key Metrics Strip */}
          <div className="mt-6 grid grid-cols-2 gap-3 border-t border-[#F2EFE9] pt-5 sm:grid-cols-4">
            <div className="rounded-xl bg-[#FAF8F4] p-3 text-center">
              <p className="font-serif text-xl font-bold text-[#0F1B2D]">{profile.startupsAdvisedCount}</p>
              <p className="text-[11px] text-[#5A6E85]">DPIIT Startups Advised</p>
            </div>
            <div className="rounded-xl bg-[#FAF8F4] p-3 text-center">
              <p className="font-serif text-xl font-bold text-[#0F1B2D]">{profile.sessionsCount}</p>
              <p className="text-[11px] text-[#5A6E85]">Strategy Sessions</p>
            </div>
            <div className="rounded-xl bg-[#FAF8F4] p-3 text-center">
              <p className="font-serif text-xl font-bold text-emerald-800">{profile.acceptedAnswersCount}</p>
              <p className="text-[11px] text-[#5A6E85]">Accepted Q&A Solutions</p>
            </div>
            <div className="rounded-xl bg-[#FAF8F4] p-3 text-center">
              <div className="flex items-center justify-center gap-1 font-serif text-xl font-bold text-amber-600">
                <Star size={16} className="fill-current" />
                <span>{profile.rating}</span>
              </div>
              <p className="text-[11px] text-[#5A6E85]">{profile.reviewsCount} Founder Reviews</p>
            </div>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="mt-6 flex border-b border-[#E5E1D8] text-xs font-semibold">
          {[
            { id: 'overview', label: 'Overview & Philosophy' },
            { id: 'expertise', label: 'Domain Expertise' },
            { id: 'startups', label: 'Advised Startups & Reviews' },
            { id: 'credentials', label: 'Credentials & Track Record' },
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

        {/* Tab 1: Overview */}
        {activeTab === 'overview' && (
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <div className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm">
                <h3 className="font-serif text-base font-bold text-[#0F1B2D] mb-3 flex items-center gap-2">
                  <User size={16} className="text-[#B8955A]" />
                  Executive Bio
                </h3>
                <p className="text-xs leading-relaxed text-[#4A5568] whitespace-pre-line">
                  {profile.bio}
                </p>
              </div>

              <div className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm">
                <h3 className="font-serif text-base font-bold text-[#0F1B2D] mb-3 flex items-center gap-2">
                  <Sparkles size={16} className="text-[#B8955A]" />
                  Advisory Philosophy & Expectations
                </h3>
                <p className="text-xs leading-relaxed text-[#4A5568] whitespace-pre-line">
                  {profile.advisoryPhilosophy}
                </p>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] p-3 text-xs">
                    <span className="font-bold text-[#0F1B2D] block mb-1">What Founders Can Expect</span>
                    <ul className="space-y-1 text-[11px] text-[#5A6E85]">
                      <li>• Architecture blueprint teardown prior to session</li>
                      <li>• Written actionable recommendations within 24h</li>
                      <li>• Direct vendor/infra cost benchmark models</li>
                    </ul>
                  </div>
                  <div className="rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] p-3 text-xs">
                    <span className="font-bold text-[#0F1B2D] block mb-1">Session Rules</span>
                    <ul className="space-y-1 text-[11px] text-[#5A6E85]">
                      <li>• Bring architectural diagrams & bottleneck metrics</li>
                      <li>• Strict confidentiality & platform NDA covered</li>
                      <li>• Respect allocated pro-bono slots for seed teams</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Side: Contact & Social */}
            <div className="space-y-6">
              <div className="rounded-2xl border border-[#E5E1D8] bg-white p-5 shadow-sm space-y-4">
                <h3 className="font-serif text-sm font-bold text-[#0F1B2D]">
                  Verified Channels & Profiles
                </h3>
                <div className="space-y-2.5 text-xs">
                  <a
                    href={profile.social.linkedin}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between rounded-lg border border-[#E5E1D8] p-2.5 hover:border-[#0F1B2D] transition"
                  >
                    <span className="flex items-center gap-2 text-[#0F1B2D]">
                      <Linkedin size={15} className="text-[#0077b5]" />
                      LinkedIn Profile
                    </span>
                    <ExternalLink size={13} className="text-[#7B8CA3]" />
                  </a>

                  <a
                    href={profile.social.github}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between rounded-lg border border-[#E5E1D8] p-2.5 hover:border-[#0F1B2D] transition"
                  >
                    <span className="flex items-center gap-2 text-[#0F1B2D]">
                      <Github size={15} />
                      GitHub Repos
                    </span>
                    <ExternalLink size={13} className="text-[#7B8CA3]" />
                  </a>

                  <a
                    href={profile.social.website}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between rounded-lg border border-[#E5E1D8] p-2.5 hover:border-[#0F1B2D] transition"
                  >
                    <span className="flex items-center gap-2 text-[#0F1B2D]">
                      <Globe size={15} className="text-[#B8955A]" />
                      Personal Tech Blog
                    </span>
                    <ExternalLink size={13} className="text-[#7B8CA3]" />
                  </a>
                </div>

                <div className="border-t border-[#F2EFE9] pt-3 text-[11px] text-[#5A6E85]">
                  <span>Member of DPIIT Mentor Network since {profile.memberSince}</span>
                </div>
              </div>

              <div className="rounded-2xl border border-[#E5E1D8] bg-[#FAF8F4] p-5 text-xs text-[#5A6E85]">
                <div className="flex items-center gap-1.5 font-bold text-[#0F1B2D] mb-1.5">
                  <ShieldCheck size={16} className="text-[#B8955A]" />
                  <span>Platform Escrow Protection</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  All paid advisory sessions are covered under Forma Escrow. Payouts are released
                  only after the mutual delivery checklist is confirmed.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Domain Expertise */}
        {activeTab === 'expertise' && (
          <div className="mt-6 rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm">
            <h3 className="font-serif text-base font-bold text-[#0F1B2D] mb-4 flex items-center gap-2">
              <Layers size={16} className="text-[#B8955A]" />
              Verified Core Competencies
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {profile.expertiseDomains.map((domain, i) => (
                <div key={i} className="rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] p-4 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                      {domain.level}
                    </span>
                    <span className="text-[11px] text-[#7B8CA3]">{domain.startups} startups advised</span>
                  </div>
                  <p className="font-bold text-[#0F1B2D]">{domain.name}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Advised Startups & Reviews */}
        {activeTab === 'startups' && (
          <div className="mt-6 space-y-4">
            {profile.advisedStartups.map((item, idx) => (
              <div key={idx} className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="font-serif text-base font-bold text-[#0F1B2D]">{item.name}</h4>
                    <p className="text-xs text-[#5A6E85]">Founder: {item.founder} • {item.stage}</p>
                  </div>
                  <div className="flex items-center gap-1 text-amber-600">
                    {[...Array(item.rating)].map((_, i) => (
                      <Star key={i} size={14} className="fill-current" />
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] p-3 text-xs">
                  <span className="font-bold text-[#0F1B2D]">Architecture Impact: </span>
                  <span className="text-[#4A5568]">{item.impact}</span>
                </div>

                <blockquote className="italic text-xs text-[#5A6E85] border-l-2 border-[#B8955A] pl-3">
                  &ldquo;{item.testimonial}&rdquo;
                </blockquote>
              </div>
            ))}
          </div>
        )}

        {/* Tab 4: Credentials */}
        {activeTab === 'credentials' && (
          <div className="mt-6 rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm">
            <h3 className="font-serif text-base font-bold text-[#0F1B2D] mb-4 flex items-center gap-2">
              <Award size={16} className="text-[#B8955A]" />
              Verified Background & Accreditations
            </h3>
            <div className="divide-y divide-[#F2EFE9]">
              {profile.credentials.map((cred, i) => (
                <div key={i} className="py-3.5 first:pt-0 last:pb-0 flex items-start justify-between text-xs">
                  <div>
                    <p className="font-bold text-[#0F1B2D]">{cred.title}</p>
                    <p className="text-[#5A6E85]">{cred.institution}</p>
                  </div>
                  <span className="rounded bg-[#FAF8F4] px-2.5 py-1 text-[11px] font-mono text-[#7B8CA3] border border-[#E5E1D8]">
                    {cred.year}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* EDIT PROFILE MODAL */}

          </>
      )}
</MentorPageShell>
  );
}
