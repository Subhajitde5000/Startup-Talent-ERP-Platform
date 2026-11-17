'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Camera,
  Upload,
  User,
  Briefcase,
  Sparkles,
  MapPin,
  Clock,
  DollarSign,
  Layers,
  Globe,
  Linkedin,
  Github,
  CheckCircle2,
  ArrowLeft,
  Save,
  Trash2,
  ShieldCheck,
  Eye,
  EyeOff,
} from 'lucide-react';
import { JobSeekerShell } from '@/components';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api/client';

export default function JobSeekerProfileEditPage() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);
  const [toast, setToast] = useState('');

  const notify = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const [formData, setFormData] = useState({
    name: 'Ananya Das',
    handle: 'ananya_design',
    headline: 'Senior Product Designer & Design Systems Lead',
    currentRole: 'Senior Product Designer @ SaaSify Studio',
    location: 'Bengaluru, India (Open to Remote & Hybrid)',
    email: 'ananya.das@designer.io',
    avatarUrl: '',
    avatarInitials: 'AD',
    avatarBg: '#0F1B2D',
    experienceYears: '6.5 Years',
    noticePeriod: '15 Days (Serving Notice)',
    desiredCtc: '₹28L – ₹36L CTC + ESOPs',
    openToWork: true,
    bio: `Senior Product Designer with 6+ years specializing in high-density B2B SaaS workflows, fintech reconciliation tooling, and scalable Figma design systems. Passionate about bridging the gap between design tokens and production React/Tailwind code with strict WCAG AA accessibility compliance.`,
    skills: [
      'Figma & Design Tokens',
      'Complex B2B Data Tables & ERP UX',
      'React & Tailwind CSS Prototyping',
      'Design Systems Architecture',
      'Usability Testing & Analytics',
      'Next.js & Frontend Ergonomics',
    ],
    newSkillInput: '',
    linkedin: 'https://linkedin.com/in/ananyadas-design',
    github: 'https://github.com/ananya-ui',
    portfolio: 'https://ananyadas.design',
  });

  // Step 3c: hydrate from talent profile + session user.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const talent = await api.talentProfile.me();
        if (cancelled) return;
        setFormData((prev) => ({
          ...prev,
          name: user?.display_name || prev.name,
          handle: user?.handle || prev.handle,
          email: user?.email || prev.email,
          linkedin: user?.linkedin_url || prev.linkedin,
          github: user?.github_url || prev.github,
          portfolio: user?.website_url || prev.portfolio,
          headline: talent?.headline || prev.headline,
          bio: talent?.summary || prev.bio,
          location: talent?.current_location || prev.location,
          experienceYears:
            talent?.total_experience_yrs != null
              ? `${talent.total_experience_yrs} Years`
              : prev.experienceYears,
          openToWork: talent ? talent.is_searchable : prev.openToWork,
          skills: talent && talent.skills.length ? talent.skills.map((sk) => sk.name) : prev.skills
        }));
      } catch (err) {
        if (!cancelled) {
          notify(err instanceof ApiError ? err.message : 'Could not load your profile.');
        }
      } finally {
        if (!cancelled) setLoading(false);
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

  const handleAddSkill = () => {
    if (formData.newSkillInput.trim()) {
      setFormData((prev) => ({
        ...prev,
        skills: [...prev.skills, prev.newSkillInput.trim()],
        newSkillInput: '',
      }));
    }
  };

  const handleRemoveSkill = (idx) => {
    setFormData((prev) => ({
      ...prev,
      skills: prev.skills.filter((_, i) => i !== idx),
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
        website_url: formData.portfolio || null,
      });
      await refreshUser();
      // talent profile (notice period / desired CTC / current role have no
      // backend column yet — kept local until the schema grows, flagged).
      const expMatch = String(formData.experienceYears || '').match(/[\d.]+/);
      const talentPayload = {
        headline: formData.headline || null,
        summary: formData.bio || null,
        current_location: formData.location || null,
        is_searchable: formData.openToWork,
        skills: formData.skills
      };
      if (expMatch) talentPayload.total_experience_yrs = Number(expMatch[0]);
      await api.talentProfile.updateMe(talentPayload);
      notify('Talent profile changes saved successfully.');
      setTimeout(() => {
        router.push('/jobseeker/profile');
      }, 900);
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not save the profile.');
      setSaving(false);
    }
  };

  return (
    <JobSeekerShell active="Profile" notify={notify} toast={toast}>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {/* Top Header */}
        <div className="mb-6 flex items-center justify-between border-b border-[#E5E1D8] pb-4">
          <div>
            <Link
              href="/jobseeker/profile"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5A6E85] hover:text-[#0F1B2D] transition mb-1"
            >
              <ArrowLeft size={14} /> Back to Talent Profile
            </Link>
            <h1 className="font-serif text-2xl font-bold text-[#0F1B2D]">
              Edit Talent Profile & Job Preferences
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/jobseeker/profile">
              <button
                type="button"
                className="rounded-lg border border-[#E5E1D8] bg-white px-4 py-2 text-xs font-semibold text-[#5A6E85] hover:bg-[#FAF8F4] transition shadow-xs"
              >
                Cancel
              </button>
            </Link>
            <button
              type="submit"
              form="talent-edit-form"
              className="flex items-center gap-1.5 rounded-lg bg-[#0F1B2D] px-5 py-2 text-xs font-bold text-white hover:bg-[#1C2B42] transition shadow-xs"
            >
              <Save size={14} className="text-[#B8955A]" />
              Save Profile
            </button>
          </div>
        </div>

        <form id="talent-edit-form" onSubmit={handleSave} className="space-y-8">
          {/* SECTION 1: PROFILE PICTURE (DP) */}
          <div className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm">
            <h2 className="font-serif text-base font-bold text-[#0F1B2D] mb-1 flex items-center gap-2">
              <Camera size={18} className="text-[#B8955A]" />
              Candidate Profile Photo (DP)
            </h2>
            <p className="text-xs text-[#5A6E85] mb-5">
              Upload a clear headshot photo or pick your monogram background. Seen by verified startup founders and hiring recruiters.
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
                  title="Upload headshot"
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
                    Upload Headshot
                  </button>

                  {formData.avatarUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setFormData((prev) => ({ ...prev, avatarUrl: '' }));
                        notify('Photo removed.');
                      }}
                      className="flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 transition"
                    >
                      <Trash2 size={13} />
                      Remove Photo
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-[#7B8CA3]">Square JPG, PNG or WEBP (Max 5MB).</p>

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

          {/* SECTION 2: CANDIDATE INFO */}
          <div className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm space-y-4">
            <h2 className="font-serif text-base font-bold text-[#0F1B2D] mb-1 flex items-center gap-2">
              <User size={18} className="text-[#B8955A]" />
              Personal & Role Details
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#7B8CA3] mb-1">
                  Full Name *
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
                  Professional Headline / Target Role *
                </label>
                <input
                  type="text"
                  required
                  value={formData.headline}
                  onChange={(e) => setFormData({ ...formData, headline: e.target.value })}
                  className="w-full rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#0F1B2D] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#7B8CA3] mb-1">
                  Current Role & Company
                </label>
                <input
                  type="text"
                  value={formData.currentRole}
                  onChange={(e) => setFormData({ ...formData, currentRole: e.target.value })}
                  className="w-full rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#0F1B2D] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#7B8CA3] mb-1">
                  Total Experience
                </label>
                <input
                  type="text"
                  value={formData.experienceYears}
                  onChange={(e) => setFormData({ ...formData, experienceYears: e.target.value })}
                  className="w-full rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#0F1B2D] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#7B8CA3] mb-1">
                  Notice Period
                </label>
                <input
                  type="text"
                  value={formData.noticePeriod}
                  onChange={(e) => setFormData({ ...formData, noticePeriod: e.target.value })}
                  className="w-full rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#0F1B2D] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#7B8CA3] mb-1">
                  Desired Compensation (CTC + Equity)
                </label>
                <input
                  type="text"
                  value={formData.desiredCtc}
                  onChange={(e) => setFormData({ ...formData, desiredCtc: e.target.value })}
                  className="w-full rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#0F1B2D] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#7B8CA3] mb-1">
                Candidate Bio & Design Philosophy
              </label>
              <textarea
                rows={4}
                required
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                className="w-full rounded-lg border border-[#E5E1D8] px-3.5 py-2.5 text-xs text-[#0F1B2D] leading-relaxed focus:border-[#0F1B2D] focus:outline-none"
              />
            </div>
          </div>

          {/* SECTION 3: SKILLS */}
          <div className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm space-y-4">
            <h2 className="font-serif text-base font-bold text-[#0F1B2D] mb-1 flex items-center gap-2">
              <Layers size={18} className="text-[#B8955A]" />
              Core Technical & Design Skills
            </h2>

            <div className="flex flex-wrap gap-2">
              {formData.skills.map((skill, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E1D8] bg-[#FAF8F4] px-3 py-1.5 text-xs font-semibold text-[#0F1B2D]"
                >
                  <span>{skill}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveSkill(i)}
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
                placeholder="Add skill (e.g. Design Systems Tokens)"
                value={formData.newSkillInput}
                onChange={(e) => setFormData({ ...formData, newSkillInput: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSkill();
                  }
                }}
                className="w-64 rounded-lg border border-[#E5E1D8] px-3 py-1.5 text-xs text-[#0F1B2D] focus:border-[#0F1B2D] focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddSkill}
                className="rounded-lg border border-[#0F1B2D] px-3 py-1.5 text-xs font-semibold text-[#0F1B2D] hover:bg-[#0F1B2D] hover:text-white transition"
              >
                + Add Skill
              </button>
            </div>
          </div>

          {/* SECTION 4: PORTFOLIO & SOCIAL */}
          <div className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm space-y-4">
            <h2 className="font-serif text-base font-bold text-[#0F1B2D] mb-1 flex items-center gap-2">
              <Globe size={18} className="text-[#B8955A]" />
              Portfolio & Profile Links
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#7B8CA3] mb-1">
                  Portfolio Website URL
                </label>
                <input
                  type="url"
                  value={formData.portfolio}
                  onChange={(e) => setFormData({ ...formData, portfolio: e.target.value })}
                  className="w-full rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#0F1B2D] focus:outline-none"
                />
              </div>

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
            </div>
          </div>

          {/* FOOTER */}
          <div className="flex items-center justify-between rounded-2xl border border-[#E5E1D8] bg-white p-4 shadow-sm">
            <span className="text-xs text-[#5A6E85]">
              Changes are reflected on talent applications and candidate search matching.
            </span>
            <div className="flex items-center gap-2">
              <Link href="/jobseeker/profile">
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
    </JobSeekerShell>
  );
}
