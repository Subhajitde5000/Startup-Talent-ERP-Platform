'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Camera,
  Upload,
  User,
  Building2,
  MapPin,
  Mail,
  DollarSign,
  Clock,
  Sparkles,
  Award,
  Layers,
  Linkedin,
  Github,
  Globe,
  Twitter,
  CheckCircle2,
  ArrowLeft,
  Save,
  Trash2,
  ShieldCheck,
  Plus,
} from 'lucide-react';
import MentorPageShell from '../../mentor-page-shell';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api/client';

export default function MentorProfileEditPage() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);
  const [toast, setToast] = useState('');

  const notify = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const [formData, setFormData] = useState({
    name: 'Dr. Sneha Roy',
    handle: 'drsneha_tech',
    title: 'Senior Technology Architect & Distributed Systems Specialist',
    organization: 'Ex-Google Staff Eng • Adjunct Prof BITS Pilani',
    location: 'Bengaluru, India (Open to Remote Globally)',
    email: 'sneha.roy@techmentor.in',
    avatarUrl: '',
    avatarInitials: 'SR',
    avatarBg: '#0F1B2D',
    hourlyRate: '₹6,500',
    proBonoHours: '3 hours / month for DPIIT pre-seed founders',
    availabilityStatus: 'Accepting 2 new seed startups',
    isAvailable: true,
    bio: `15+ years architecting distributed transaction engines and cloud infrastructure at planetary scale. Formerly Staff Software Engineer at Google Core Systems. Currently mentoring high-growth Indian startups on transitioning from MVP hack to scalable multi-region microservices, enterprise SOC2 readiness, and engineering squad leadership.`,
    advisoryPhilosophy: `I don't write code for you—I help founding teams build the architectural muscles to avoid expensive multi-crore technical debt before Series A. I focus on pragmatic, high-throughput architectures without premature microservice fragmentation.`,
    expertiseDomains: [
      'Distributed Systems & Concurrency',
      'Cloud Infrastructure (AWS/GCP)',
      'B2B FinTech & Transaction Scalability',
      'Database Sharding & Read-Replicas',
      'Engineering Leadership & Tech Hiring',
      'SOC2 & ISO 27001 Security Readiness',
    ],
    newDomainInput: '',
    linkedin: 'https://linkedin.com/in/drsneharoy',
    github: 'https://github.com/drsneha-arch',
    twitter: 'https://x.com/drsneha_tech',
    website: 'https://sneharoy.tech',
  });

  // Step 3c: hydrate from mentor profile + session user.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mentor = await api.mentorProfile.me();
        if (cancelled) return;
        setFormData((prev) => ({
          ...prev,
          name: user?.display_name || prev.name,
          handle: user?.handle || prev.handle,
          email: user?.email || prev.email,
          linkedin: user?.linkedin_url || prev.linkedin,
          github: user?.github_url || prev.github,
          twitter: user?.twitter_url || prev.twitter,
          website: user?.website_url || prev.website,
          title: mentor?.headline || prev.title,
          bio: mentor?.bio || prev.bio,
          isAvailable: mentor ? mentor.accepting_requests : prev.isAvailable,
          availabilityStatus: mentor?.cadence || prev.availabilityStatus,
          hourlyRate:
            mentor?.hourly_fee != null
              ? `₹${Number(mentor.hourly_fee).toLocaleString('en-IN')}`
              : prev.hourlyRate,
          expertiseDomains:
            mentor && mentor.expertise.length ? mentor.expertise : prev.expertiseDomains
        }));
      } catch (err) {
        if (!cancelled) {
          notify(err instanceof ApiError ? err.message : 'Could not load your profile.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        notify('Please select an image smaller than 5MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({
          ...prev,
          avatarUrl: reader.result,
        }));
        notify('Profile picture updated.');
      };
      reader.readAsDataURL(file);
    }
  };

  const presetColors = ['#0F1B2D', '#1E3A8A', '#065F46', '#7C2D12', '#4C1D95', '#831843'];

  const handleAddDomain = () => {
    if (formData.newDomainInput.trim()) {
      setFormData((prev) => ({
        ...prev,
        expertiseDomains: [...prev.expertiseDomains, prev.newDomainInput.trim()],
        newDomainInput: '',
      }));
    }
  };

  const handleRemoveDomain = (idx) => {
    setFormData((prev) => ({
      ...prev,
      expertiseDomains: prev.expertiseDomains.filter((_, i) => i !== idx),
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      // identity/socials -> users
      await api.users.updateMe({
        display_name: formData.name,
        handle: formData.handle || undefined,
        linkedin_url: formData.linkedin || null,
        github_url: formData.github || null,
        twitter_url: formData.twitter || null,
        website_url: formData.website || null,
      });
      await refreshUser();
      // mentor profile (organization / pro-bono / advisory philosophy have
      // no backend column yet — kept local until the schema grows, flagged).
      const feeMatch = String(formData.hourlyRate || '').replace(/[^\d.]/g, '');
      const mentorPayload = {
        headline: formData.title || null,
        bio: formData.bio || null,
        expertise: formData.expertiseDomains,
        cadence: formData.availabilityStatus || null,
        accepting_requests: formData.isAvailable
      };
      if (feeMatch) mentorPayload.hourly_fee = Number(feeMatch);
      await api.mentorProfile.updateMe(mentorPayload);
      notify('Mentor advisory profile updated successfully.');
      setTimeout(() => {
        router.push('/mentor/profile');
      }, 900);
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not save the profile.');
      setSaving(false);
    }
  };

  return (
    <MentorPageShell active="Profile" notify={notify} toast={toast}>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {/* Top Header */}
        <div className="mb-6 flex items-center justify-between border-b border-[#E5E1D8] pb-4">
          <div>
            <Link
              href="/mentor/profile"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5A6E85] hover:text-[#0F1B2D] transition mb-1"
            >
              <ArrowLeft size={14} /> Back to Mentor Profile
            </Link>
            <h1 className="font-serif text-2xl font-bold text-[#0F1B2D]">
              Edit Mentor Profile & Advisory Terms
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/mentor/profile">
              <button
                type="button"
                className="rounded-lg border border-[#E5E1D8] bg-white px-4 py-2 text-xs font-semibold text-[#5A6E85] hover:bg-[#FAF8F4] transition shadow-xs"
              >
                Cancel
              </button>
            </Link>
            <button
              type="submit"
              form="mentor-edit-form"
              className="flex items-center gap-1.5 rounded-lg bg-[#0F1B2D] px-5 py-2 text-xs font-bold text-white hover:bg-[#1C2B42] transition shadow-xs"
            >
              <Save size={14} className="text-[#B8955A]" />
              Save Profile
            </button>
          </div>
        </div>

        <form id="mentor-edit-form" onSubmit={handleSave} className="space-y-8">
          {/* SECTION 1: PROFILE PICTURE (DP) */}
          <div className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm">
            <h2 className="font-serif text-base font-bold text-[#0F1B2D] mb-1 flex items-center gap-2">
              <Camera size={18} className="text-[#B8955A]" />
              Mentor Display Picture (DP)
            </h2>
            <p className="text-xs text-[#5A6E85] mb-5">
              Upload a professional photo or customize your monogram avatar. Displayed on startup session bookings, AMAs, and expert answers.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="relative group">
                <div
                  className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full font-serif text-2xl font-bold text-white shadow-md border-2 border-white ring-2 ring-[#B8955A]/40"
                  style={{ backgroundColor: formData.avatarBg }}
                >
                  {formData.avatarUrl ? (
                    <img
                      src={formData.avatarUrl}
                      alt={formData.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span>{formData.avatarInitials}</span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity text-white"
                  title="Upload new photo"
                >
                  <Camera size={22} />
                </button>
              </div>

              <div className="space-y-3 text-center sm:text-left">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 rounded-lg border border-[#0F1B2D] bg-[#0F1B2D] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#1C2B42] transition shadow-xs"
                  >
                    <Upload size={13} className="text-[#B8955A]" />
                    Upload Headshot Photo
                  </button>

                  {formData.avatarUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setFormData((prev) => ({ ...prev, avatarUrl: '' }));
                        notify('Photo removed. Reset to monogram.');
                      }}
                      className="flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 transition"
                    >
                      <Trash2 size={13} />
                      Remove Photo
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-[#7B8CA3]">Square JPG, PNG, or WEBP (Max 5MB).</p>

                <div className="flex items-center justify-center sm:justify-start gap-1.5 pt-1">
                  <span className="text-[11px] font-semibold text-[#5A6E85] mr-1">Monogram Palette:</span>
                  {presetColors.map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, avatarBg: col }))}
                      className={`h-5 w-5 rounded-full border-2 transition ${
                        formData.avatarBg === col ? 'border-[#0F1B2D] scale-110' : 'border-white'
                      }`}
                      style={{ backgroundColor: col }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: ADVISORY BIO & RATES */}
          <div className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm space-y-4">
            <h2 className="font-serif text-base font-bold text-[#0F1B2D] mb-1 flex items-center gap-2">
              <User size={18} className="text-[#B8955A]" />
              Mentor Profile & Bio
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#7B8CA3] mb-1">
                  Mentor Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#0F1B2D] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#7B8CA3] mb-1">
                  Specialization Title *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#0F1B2D] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#7B8CA3] mb-1">
                  Affiliation / Ex-Company
                </label>
                <input
                  type="text"
                  value={formData.organization}
                  onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                  className="w-full rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#0F1B2D] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#7B8CA3] mb-1">
                  Location
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#0F1B2D] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#7B8CA3] mb-1">
                Executive Advisory Bio
              </label>
              <textarea
                rows={4}
                required
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                className="w-full rounded-lg border border-[#E5E1D8] px-3.5 py-2.5 text-xs text-[#0F1B2D] leading-relaxed focus:border-[#0F1B2D] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#7B8CA3] mb-1">
                Advisory Philosophy & Expectations for Founders
              </label>
              <textarea
                rows={3}
                value={formData.advisoryPhilosophy}
                onChange={(e) => setFormData({ ...formData, advisoryPhilosophy: e.target.value })}
                className="w-full rounded-lg border border-[#E5E1D8] px-3.5 py-2.5 text-xs text-[#0F1B2D] leading-relaxed focus:border-[#0F1B2D] focus:outline-none"
              />
            </div>
          </div>

          {/* SECTION 3: RATES & AVAILABILITY */}
          <div className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm space-y-4">
            <h2 className="font-serif text-base font-bold text-[#0F1B2D] mb-1 flex items-center gap-2">
              <DollarSign size={18} className="text-[#B8955A]" />
              Rates & Advisory Allocation
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#7B8CA3] mb-1">
                  Advisory Rate (per hour)
                </label>
                <input
                  type="text"
                  value={formData.hourlyRate}
                  onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
                  className="w-full rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#0F1B2D] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#7B8CA3] mb-1">
                  Pro-Bono Hours Allocation
                </label>
                <input
                  type="text"
                  value={formData.proBonoHours}
                  onChange={(e) => setFormData({ ...formData, proBonoHours: e.target.value })}
                  className="w-full rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#0F1B2D] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#7B8CA3] mb-1">
                  Availability Status
                </label>
                <input
                  type="text"
                  value={formData.availabilityStatus}
                  onChange={(e) => setFormData({ ...formData, availabilityStatus: e.target.value })}
                  className="w-full rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#0F1B2D] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] p-3.5 mt-2">
              <div>
                <p className="text-xs font-semibold text-[#0F1B2D]">
                  Weekly Availability Slots & Schedule Windows
                </p>
                <p className="text-[11px] text-[#5A6E85]">
                  Configure recurring days and time windows (e.g. Mon–Fri 10:00–17:00 IST) for startup session bookings.
                </p>
              </div>
              <Link
                href="/mentor/sessions"
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#0F1B2D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1C2B42] transition shadow-xs"
              >
                Manage Availability Slots →
              </Link>
            </div>
          </div>

          {/* SECTION 4: DOMAIN EXPERTISE */}
          <div className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm space-y-4">
            <h2 className="font-serif text-base font-bold text-[#0F1B2D] mb-1 flex items-center gap-2">
              <Layers size={18} className="text-[#B8955A]" />
              Expertise Domains & Tags
            </h2>

            <div className="flex flex-wrap gap-2">
              {formData.expertiseDomains.map((dom, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E1D8] bg-[#FAF8F4] px-3 py-1.5 text-xs font-semibold text-[#0F1B2D]"
                >
                  <span>{dom}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveDomain(i)}
                    className="text-[#7B8CA3] hover:text-rose-600"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="text"
                placeholder="Add new domain (e.g. LLM Fine-Tuning)"
                value={formData.newDomainInput}
                onChange={(e) => setFormData({ ...formData, newDomainInput: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddDomain();
                  }
                }}
                className="w-64 rounded-lg border border-[#E5E1D8] px-3 py-1.5 text-xs text-[#0F1B2D] focus:border-[#0F1B2D] focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddDomain}
                className="rounded-lg border border-[#0F1B2D] px-3 py-1.5 text-xs font-semibold text-[#0F1B2D] hover:bg-[#0F1B2D] hover:text-white transition"
              >
                + Add
              </button>
            </div>
          </div>

          {/* SECTION 5: SOCIAL & LINKS */}
          <div className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm space-y-4">
            <h2 className="font-serif text-base font-bold text-[#0F1B2D] mb-1 flex items-center gap-2">
              <Globe size={18} className="text-[#B8955A]" />
              Social & Online Profiles
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#7B8CA3] mb-1">
                  LinkedIn Profile
                </label>
                <input
                  type="url"
                  value={formData.linkedin}
                  onChange={(e) => setFormData({ ...formData, linkedin: e.target.value })}
                  className="w-full rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#0F1B2D] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#7B8CA3] mb-1">
                  GitHub Profile
                </label>
                <input
                  type="url"
                  value={formData.github}
                  onChange={(e) => setFormData({ ...formData, github: e.target.value })}
                  className="w-full rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#0F1B2D] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#7B8CA3] mb-1">
                  Twitter / X Profile
                </label>
                <input
                  type="url"
                  value={formData.twitter}
                  onChange={(e) => setFormData({ ...formData, twitter: e.target.value })}
                  className="w-full rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#0F1B2D] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#7B8CA3] mb-1">
                  Personal Blog / Website
                </label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  className="w-full rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#0F1B2D] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* SUBMIT FOOTER */}
          <div className="flex items-center justify-between rounded-2xl border border-[#E5E1D8] bg-white p-4 shadow-sm">
            <span className="text-xs text-[#5A6E85]">
              Changes are reflected on the public Mentor Directory and Mentors Circle lounge.
            </span>
            <div className="flex items-center gap-2">
              <Link href="/mentor/profile">
                <button
                  type="button"
                  className="rounded-lg border border-[#E5E1D8] px-4 py-2 text-xs font-semibold text-[#5A6E85] hover:bg-[#FAF8F4]"
                >
                  Cancel
                </button>
              </Link>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-lg bg-[#0F1B2D] px-6 py-2 text-xs font-bold text-white hover:bg-[#1C2B42] transition shadow-xs"
              >
                <Save size={14} className="text-[#B8955A]" />
                Save Profile
              </button>
            </div>
          </div>
        </form>
      </div>
    </MentorPageShell>
  );
}
