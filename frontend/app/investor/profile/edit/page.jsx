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
  TrendingUp,
  Layers,
  Linkedin,
  Twitter,
  Globe,
  CheckCircle2,
  ArrowLeft,
  Save,
  Trash2,
  ShieldCheck,
  PieChart,
} from 'lucide-react';
import { InvestorShell, Button } from '@/components';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api/client';

export default function InvestorProfileEditPage() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [orgId, setOrgId] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);
  const [toast, setToast] = useState('');

  const notify = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const [formData, setFormData] = useState({
    name: 'Arjun Mehta',
    handle: 'arjun_forma_vc',
    title: 'Angel Syndicate Lead & Early-Stage Tech Investor',
    firm: 'Zenith Capital / Forma Angel Syndicate',
    location: 'Mumbai & Bengaluru, India',
    email: 'arjun@zenithcap.in',
    avatarUrl: '',
    avatarInitials: 'AM',
    avatarBg: '#0F1B2D',
    ticketSizeRange: '',
    stageFocus: '',
    sectors: ['B2B SaaS', 'Fintech Infrastructure', 'Developer Tools & Cloud', 'DeepTech & Enterprise AI'],
    newSectorInput: '',
    thesis: `We back repeat technical founders and domain specialists solving friction in high-value Indian and cross-border B2B supply chains. We write high-conviction first checks at Seed and support through lead follow-ons, executive customer introductions, and clean US-India flip structuring.`,
    sebiRegistration: 'Cat-I AIF Angel Sub-Fund (IN/AIF1/24-25/0981)',
    custodyBank: 'HDFC Bank Special Escrow Trust Account',
    linkedin: 'https://linkedin.com/in/arjunmehtavc',
    twitter: 'https://x.com/arjun_vc',
    website: 'https://zenithcap.in',
  });

  // Step 9d: investment-thesis preferences (ticket range, stage focus, sectors).
  const [prefs, setPrefs] = useState({
    minTicket: '',
    maxTicket: '',
    stageFocus: [],
  });

  // Step 3b: firm -> investor_firm organization; identity/socials -> user.
  // Ticket/stage/sectors/SEBI/custody stay demo until Step 9.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const orgs = await api.organizations.mine();
        const firm = orgs.find((o) => o.type === 'investor_firm');
        if (cancelled) return;
        if (firm) {
          setOrgId(firm.id);
          setFormData((prev) => ({
            ...prev,
            firm: firm.name || prev.firm,
            thesis: firm.summary || prev.thesis,
            location: firm.city || prev.location,
            website: firm.website || prev.website,
            name: user?.display_name || prev.name,
            handle: user?.handle || prev.handle,
            email: user?.email || prev.email,
            linkedin: user?.linkedin_url || prev.linkedin,
            twitter: user?.twitter_url || prev.twitter,
          }));
        }
      } catch (err) {
        if (!cancelled) {
          notify(err instanceof ApiError ? err.message : 'Could not load your organization.');
        }
      }

      // Load the investor-thesis preferences (9d) to seed the mandate fields.
      try {
        const pref = await api.investorPreferences.get();
        if (cancelled) return;
        setPrefs({
          minTicket: pref.min_ticket != null ? String(pref.min_ticket) : '',
          maxTicket: pref.max_ticket != null ? String(pref.max_ticket) : '',
          stageFocus: pref.stage_focus || [],
        });
        setFormData((prev) => ({ ...prev, sectors: pref.sectors?.length ? pref.sectors : prev.sectors }));
      } catch (err) {
        // Preferences are optional to seed; the form still works with blanks.
        if (!cancelled && err instanceof ApiError && err.status !== 404) {
          notify(err.message);
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

  const handleAddSector = () => {
    if (formData.newSectorInput.trim()) {
      setFormData((prev) => ({
        ...prev,
        sectors: [...prev.sectors, prev.newSectorInput.trim()],
        newSectorInput: '',
      }));
    }
  };

  const handleRemoveSector = (idx) => {
    setFormData((prev) => ({
      ...prev,
      sectors: prev.sectors.filter((_, i) => i !== idx),
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await api.users.updateMe({
        display_name: formData.name,
        handle: formData.handle || undefined,
        linkedin_url: formData.linkedin || null,
        twitter_url: formData.twitter || null,
        website_url: formData.website || null,
      });
      await refreshUser();
      const payload = {
        name: formData.firm,
        summary: formData.thesis || null,
        website: formData.website || null,
        city: formData.location || null,
      };
      if (orgId) {
        await api.organizations.update(orgId, payload);
      } else {
        const created = await api.organizations.create({
          name: formData.firm,
          type: 'investor_firm',
        });
        setOrgId(created.id);
        await api.organizations.update(created.id, payload);
      }
      notify('Investor thesis and profile saved successfully.');
      setTimeout(() => {
        router.push('/investor/profile');
      }, 900);
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not save the profile.');
      setSaving(false);
    }
  };

  const savePreferences = async () => {
    setSaving(true);
    try {
      const payload = {
        sectors: formData.sectors,
        stage_focus: prefs.stageFocus,
        min_ticket: prefs.minTicket !== '' ? prefs.minTicket : null,
        max_ticket: prefs.maxTicket !== '' ? prefs.maxTicket : null,
      };
      await api.investorPreferences.update(payload);
      notify('Investment preferences saved.');
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not save investment preferences.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <InvestorShell active="Profile" notify={notify} toast={toast}>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {/* Top Header */}
        <div className="mb-6 flex items-center justify-between border-b border-[#E5E1D8] pb-4">
          <div>
            <Link
              href="/investor/profile"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5A6E85] hover:text-[#0F1B2D] transition mb-1"
            >
              <ArrowLeft size={14} /> Back to Investor Profile
            </Link>
            <h1 className="font-serif text-2xl font-bold text-[#0F1B2D]">
              Edit Investor Profile & Syndicate Thesis
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/investor/profile">
              <button
                type="button"
                className="rounded-lg border border-[#E5E1D8] bg-white px-4 py-2 text-xs font-semibold text-[#5A6E85] hover:bg-[#FAF8F4] transition shadow-xs"
              >
                Cancel
              </button>
            </Link>
            <button
              type="submit"
              form="investor-edit-form"
              className="flex items-center gap-1.5 rounded-lg bg-[#0F1B2D] px-5 py-2 text-xs font-bold text-white hover:bg-[#1C2B42] transition shadow-xs"
            >
              <Save size={14} className="text-[#B8955A]" />
              Save Profile
            </button>
          </div>
        </div>

        <form id="investor-edit-form" onSubmit={handleSave} className="space-y-8">
          {/* SECTION 1: PROFILE PICTURE (DP) */}
          <div className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm">
            <h2 className="font-serif text-base font-bold text-[#0F1B2D] mb-1 flex items-center gap-2">
              <Camera size={18} className="text-[#B8955A]" />
              Investor Display Picture (DP)
            </h2>
            <p className="text-xs text-[#5A6E85] mb-5">
              Upload your executive photo or choose an avatar color. Displayed on deal pipeline communications and syndicate discussions.
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
                  title="Upload photo"
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
                    Upload Photo
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

          {/* SECTION 2: INVESTOR & FIRM DETAILS */}
          <div className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm space-y-4">
            <h2 className="font-serif text-base font-bold text-[#0F1B2D] mb-1 flex items-center gap-2">
              <User size={18} className="text-[#B8955A]" />
              Investor & Syndicate Identity
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#7B8CA3] mb-1">
                  Investor Full Name *
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
                  Syndicate Firm / Fund Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.firm}
                  onChange={(e) => setFormData({ ...formData, firm: e.target.value })}
                  className="w-full rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#0F1B2D] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#7B8CA3] mb-1">
                  Role Title
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#0F1B2D] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#7B8CA3] mb-1">
                  Operating Base / Location
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#0F1B2D] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: CHECK SIZES & THESIS */}
          <div className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm space-y-4">
            <h2 className="font-serif text-base font-bold text-[#0F1B2D] mb-1 flex items-center gap-2">
              <DollarSign size={18} className="text-[#B8955A]" />
              Investment Mandate & Ticket Sizes
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#7B8CA3] mb-1">
                  Min check size (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="100000"
                  value={prefs.minTicket}
                  onChange={(e) => setPrefs((prev) => ({ ...prev, minTicket: e.target.value }))}
                  className="w-full rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#0F1B2D] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#7B8CA3] mb-1">
                  Max check size (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="100000"
                  value={prefs.maxTicket}
                  onChange={(e) => setPrefs((prev) => ({ ...prev, maxTicket: e.target.value }))}
                  className="w-full rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#0F1B2D] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#7B8CA3] mb-1">
                Stage focus
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  ['idea', 'Idea'],
                  ['prototype', 'Prototype'],
                  ['early_revenue', 'Early revenue'],
                  ['growth', 'Growth'],
                  ['mature', 'Mature'],
                ].map(([value, label]) => (
                  <label
                    key={value}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E1D8] bg-[#FAF8F4] px-3 py-1.5 text-xs font-semibold text-[#0F1B2D] cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={prefs.stageFocus.includes(value)}
                      onChange={(e) =>
                        setPrefs((prev) => ({
                          ...prev,
                          stageFocus: e.target.checked
                            ? [...prev.stageFocus, value]
                            : prev.stageFocus.filter((x) => x !== value),
                        }))
                      }
                      className="h-4 w-4 accent-[#0F1B2D]"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            <Button secondary onClick={savePreferences} disabled={saving}>
              <Save size={13} className="text-[#B8955A]" />
              Save investment preferences
            </Button>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#7B8CA3] mb-1">
                Core Investment Thesis & What We Back
              </label>
              <textarea
                rows={4}
                required
                value={formData.thesis}
                onChange={(e) => setFormData({ ...formData, thesis: e.target.value })}
                className="w-full rounded-lg border border-[#E5E1D8] px-3.5 py-2.5 text-xs text-[#0F1B2D] leading-relaxed focus:border-[#0F1B2D] focus:outline-none"
              />
            </div>
          </div>

          {/* SECTION 4: SECTORS */}
          <div className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm space-y-4">
            <h2 className="font-serif text-base font-bold text-[#0F1B2D] mb-1 flex items-center gap-2">
              <Layers size={18} className="text-[#B8955A]" />
              Target Sectors of Interest
            </h2>

            <div className="flex flex-wrap gap-2">
              {formData.sectors.map((sec, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E1D8] bg-[#FAF8F4] px-3 py-1.5 text-xs font-semibold text-[#0F1B2D]"
                >
                  <span>{sec}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveSector(i)}
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
                placeholder="Add sector (e.g. ClimateTech / Carbon Accounting)"
                value={formData.newSectorInput}
                onChange={(e) => setFormData({ ...formData, newSectorInput: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSector();
                  }
                }}
                className="w-64 rounded-lg border border-[#E5E1D8] px-3 py-1.5 text-xs text-[#0F1B2D] focus:border-[#0F1B2D] focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddSector}
                className="rounded-lg border border-[#0F1B2D] px-3 py-1.5 text-xs font-semibold text-[#0F1B2D] hover:bg-[#0F1B2D] hover:text-white transition"
              >
                + Add Sector
              </button>
            </div>
          </div>

          {/* SECTION 5: SOCIAL */}
          <div className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm space-y-4">
            <h2 className="font-serif text-base font-bold text-[#0F1B2D] mb-1 flex items-center gap-2">
              <Globe size={18} className="text-[#B8955A]" />
              Online Presence & Deal Submissions
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
                  Syndicate Website / AngelList URL
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

          {/* FOOTER */}
          <div className="flex items-center justify-between rounded-2xl border border-[#E5E1D8] bg-white p-4 shadow-sm">
            <span className="text-xs text-[#5A6E85]">
              Changes are reflected on the accredited investor network and portfolio listings.
            </span>
            <div className="flex items-center gap-2">
              <Link href="/investor/profile">
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
    </InvestorShell>
  );
}
