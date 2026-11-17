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
  Briefcase,
  Users,
  Clock,
  Sparkles,
  Globe,
  Linkedin,
  CheckCircle2,
  ArrowLeft,
  Save,
  Trash2,
  ShieldCheck,
  HeartHandshake,
} from 'lucide-react';
import { EmployerShell } from '@/components';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api/client';

export default function EmployerProfileEditPage() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [orgId, setOrgId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);
  const [toast, setToast] = useState('');

  const notify = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const [formData, setFormData] = useState({
    recruiterName: 'Sarah Jenkins',
    recruiterTitle: 'Head of People & Talent Acquisition',
    companyName: 'Northstar Labs Pvt Ltd',
    industry: 'Enterprise Developer Infrastructure & AI Tools',
    stage: 'Series A ($12M Raised)',
    teamSize: '85 team members across Bengaluru & Remote',
    headquarters: 'Indiranagar, Bengaluru, India',
    email: 'sarah@northstarlabs.in',
    avatarUrl: '',
    avatarInitials: 'SJ',
    avatarBg: '#0F1B2D',
    responseSla: '< 24 Hours candidate turnaround',
    companyBio: `Northstar Labs builds next-generation distributed compilation tools and observability orchestration for high-velocity software engineering squads. Backed by top tier enterprise VCs, we are an engineering-driven team obsessed with developer ergonomics and developer productivity.`,
    hiringPhilosophy: `We believe in radical compensation transparency. Every job posting includes transparent salary bands and ESOP grants up front. We don't conduct whiteboard riddles; our technical assessments reflect actual day-to-day codebases with compensation for candidates' time.`,
    linkedin: 'https://linkedin.com/company/northstarlabs',
    website: 'https://northstarlabs.in',
  });

  // Step 3b: hydrate editable fields from the employer org + session user.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const orgs = await api.organizations.mine();
        const employer = orgs.find((o) => o.type === 'employer');
        if (cancelled) return;
        if (employer) {
          setOrgId(employer.id);
          setFormData((prev) => ({
            ...prev,
            companyName: employer.name || prev.companyName,
            companyBio: employer.summary || prev.companyBio,
            headquarters: employer.city || prev.headquarters,
            website: employer.website || prev.website,
            foundedYear: employer.founded_year ? String(employer.founded_year) : prev.foundedYear,
            linkedin: user?.linkedin_url || prev.linkedin,
            recruiterName: user?.display_name || prev.recruiterName,
            recruiterTitle: user?.headline || prev.recruiterTitle,
            email: user?.email || prev.email,
          }));
        }
      } catch (err) {
        if (!cancelled) {
          notify(err instanceof ApiError ? err.message : 'Could not load your organization.');
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
        notify('Company / Recruiter logo updated.');
      };
      reader.readAsDataURL(file);
    }
  };

  const presetColors = ['#0F1B2D', '#1E3A8A', '#065F46', '#7C2D12', '#4C1D95', '#831843'];

  const handleSave = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      // recruiter identity -> user profile fields
      await api.users.updateMe({
        display_name: formData.recruiterName,
        headline: formData.recruiterTitle || null,
        linkedin_url: formData.linkedin || null,
      });
      await refreshUser();
      // company -> organization
      const payload = {
        name: formData.companyName,
        summary: formData.companyBio || null,
        website: formData.website || null,
        city: formData.headquarters || null,
      };
      if (/^\d{4}$/.test(String(formData.foundedYear))) {
        payload.founded_year = Number(formData.foundedYear);
      }
      if (orgId) {
        await api.organizations.update(orgId, payload);
      } else {
        const created = await api.organizations.create({
          name: formData.companyName,
          type: 'employer',
        });
        setOrgId(created.id);
        await api.organizations.update(created.id, payload);
      }
      notify('Company and recruiter profile saved successfully.');
      setTimeout(() => {
        router.push('/employer/profile');
      }, 900);
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not save the profile.');
      setSaving(false);
    }
  };

  return (
    <EmployerShell active="Profile" activeNav="Profile">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {toast && (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg bg-[#0F1B2D] px-4 py-3 text-xs font-semibold text-white shadow-xl animate-in fade-in">
            <CheckCircle2 size={16} className="text-[#B8955A]" />
            <span>{toast}</span>
          </div>
        )}

        {/* Top Header */}
        <div className="mb-6 flex items-center justify-between border-b border-[#E5E1D8] pb-4">
          <div>
            <Link
              href="/employer/profile"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5A6E85] hover:text-[#0F1B2D] transition mb-1"
            >
              <ArrowLeft size={14} /> Back to Employer Profile
            </Link>
            <h1 className="font-serif text-2xl font-bold text-[#0F1B2D]">
              Edit Company & Recruiter Profile
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/employer/profile">
              <button
                type="button"
                className="rounded-lg border border-[#E5E1D8] bg-white px-4 py-2 text-xs font-semibold text-[#5A6E85] hover:bg-[#FAF8F4] transition shadow-xs"
              >
                Cancel
              </button>
            </Link>
            <button
              type="submit"
              form="employer-edit-form"
              className="flex items-center gap-1.5 rounded-lg bg-[#0F1B2D] px-5 py-2 text-xs font-bold text-white hover:bg-[#1C2B42] transition shadow-xs"
            >
              <Save size={14} className="text-[#B8955A]" />
              Save Profile
            </button>
          </div>
        </div>

        <form id="employer-edit-form" onSubmit={handleSave} className="space-y-8">
          {/* SECTION 1: LOGO / DP */}
          <div className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm">
            <h2 className="font-serif text-base font-bold text-[#0F1B2D] mb-1 flex items-center gap-2">
              <Camera size={18} className="text-[#B8955A]" />
              Company Logo / Recruiter Picture (DP)
            </h2>
            <p className="text-xs text-[#5A6E85] mb-5">
              Upload your official company brand avatar or recruiter headshot. Appears on job postings, candidate messages, and recruiter listings.
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
                      alt={formData.companyName}
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
                  title="Upload logo or DP"
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
                    Upload Image
                  </button>

                  {formData.avatarUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setFormData((prev) => ({ ...prev, avatarUrl: '' }));
                        notify('Image removed. Reverted to monogram.');
                      }}
                      className="flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 transition"
                    >
                      <Trash2 size={13} />
                      Remove
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-[#7B8CA3]">Square logo or headshot (Max 5MB).</p>

                <div className="flex items-center justify-center sm:justify-start gap-1.5 pt-1">
                  <span className="text-[11px] font-semibold text-[#5A6E85] mr-1">Brand Monogram:</span>
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

          {/* SECTION 2: RECRUITER & COMPANY BASICS */}
          <div className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm space-y-4">
            <h2 className="font-serif text-base font-bold text-[#0F1B2D] mb-1 flex items-center gap-2">
              <Building2 size={18} className="text-[#B8955A]" />
              Company & Recruiter Details
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#7B8CA3] mb-1">
                  Company Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  className="w-full rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#0F1B2D] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#7B8CA3] mb-1">
                  Industry / Domain
                </label>
                <input
                  type="text"
                  value={formData.industry}
                  onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                  className="w-full rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#0F1B2D] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#7B8CA3] mb-1">
                  Recruiter Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.recruiterName}
                  onChange={(e) => setFormData({ ...formData, recruiterName: e.target.value })}
                  className="w-full rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#0F1B2D] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#7B8CA3] mb-1">
                  Recruiter Title / Designation
                </label>
                <input
                  type="text"
                  value={formData.recruiterTitle}
                  onChange={(e) => setFormData({ ...formData, recruiterTitle: e.target.value })}
                  className="w-full rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#0F1B2D] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#7B8CA3] mb-1">
                  Funding Stage
                </label>
                <input
                  type="text"
                  value={formData.stage}
                  onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
                  className="w-full rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#0F1B2D] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#7B8CA3] mb-1">
                  Team Size & Model
                </label>
                <input
                  type="text"
                  value={formData.teamSize}
                  onChange={(e) => setFormData({ ...formData, teamSize: e.target.value })}
                  className="w-full rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#0F1B2D] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#7B8CA3] mb-1">
                  Office Headquarters
                </label>
                <input
                  type="text"
                  value={formData.headquarters}
                  onChange={(e) => setFormData({ ...formData, headquarters: e.target.value })}
                  className="w-full rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#0F1B2D] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#7B8CA3] mb-1">
                  Candidate Response SLA
                </label>
                <input
                  type="text"
                  value={formData.responseSla}
                  onChange={(e) => setFormData({ ...formData, responseSla: e.target.value })}
                  className="w-full rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#0F1B2D] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: CULTURE & PHILOSOPHY */}
          <div className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm space-y-4">
            <h2 className="font-serif text-base font-bold text-[#0F1B2D] mb-1 flex items-center gap-2">
              <Sparkles size={18} className="text-[#B8955A]" />
              Company Mission & Hiring SLA
            </h2>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#7B8CA3] mb-1">
                Company Overview & Engineering Culture
              </label>
              <textarea
                rows={4}
                required
                value={formData.companyBio}
                onChange={(e) => setFormData({ ...formData, companyBio: e.target.value })}
                className="w-full rounded-lg border border-[#E5E1D8] px-3.5 py-2.5 text-xs text-[#0F1B2D] leading-relaxed focus:border-[#0F1B2D] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#7B8CA3] mb-1">
                Hiring Philosophy & Candidate Experience Commitments
              </label>
              <textarea
                rows={3}
                value={formData.hiringPhilosophy}
                onChange={(e) => setFormData({ ...formData, hiringPhilosophy: e.target.value })}
                className="w-full rounded-lg border border-[#E5E1D8] px-3.5 py-2.5 text-xs text-[#0F1B2D] leading-relaxed focus:border-[#0F1B2D] focus:outline-none"
              />
            </div>
          </div>

          {/* SECTION 4: LINKS */}
          <div className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm space-y-4">
            <h2 className="font-serif text-base font-bold text-[#0F1B2D] mb-1 flex items-center gap-2">
              <Globe size={18} className="text-[#B8955A]" />
              Company Web & Social Links
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#7B8CA3] mb-1">
                  Careers Website
                </label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  className="w-full rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#0F1B2D] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#7B8CA3] mb-1">
                  Company LinkedIn URL
                </label>
                <input
                  type="url"
                  value={formData.linkedin}
                  onChange={(e) => setFormData({ ...formData, linkedin: e.target.value })}
                  className="w-full rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#0F1B2D] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* SUBMIT FOOTER */}
          <div className="flex items-center justify-between rounded-2xl border border-[#E5E1D8] bg-white p-4 shadow-sm">
            <span className="text-xs text-[#5A6E85]">
              Changes are reflected on the Verified Employer Directory and job applicant previews.
            </span>
            <div className="flex items-center gap-2">
              <Link href="/employer/profile">
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
    </EmployerShell>
  );
}
