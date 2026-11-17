'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  User,
  Shield,
  Bell,
  Eye,
  Sliders,
  CheckCircle2,
  Lock,
  Mail,
  Check,
} from 'lucide-react';
import { JobSeekerShell } from '@/components';
import { JobBtn } from '@/components/jobseeker-ui';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api/client';

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const [activeSection, setActiveSection] = useState('Profile');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState(() => ({
    fullName: user?.display_name || '',
    headline: '', // talent headline (Step 3c)
    email: user?.email || '',
    phone: user?.phone || '',
    portfolioUrl: '', // portfolio -> users.website_url (Step 3c)
    minCtc: '', // salary expectation (Step 3c)
    workMode: 'Remote & Hybrid', // -> talent.preferred_mode (Step 3c)
    publicVisibility: true, // -> talent.is_searchable (Step 3c)
    hideCurrentEmployer: true, // -> talent.hide_current_employer (Step 3c)
    emailAlerts: true, // -> notification preferences (Step 12)
  }));
  const [savedToast, setSavedToast] = useState(false);

  // Step 3c: hydrate talent fields from the API.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const talent = await api.talentProfile.me();
        if (cancelled || !talent) return;
        const modeLabel = { remote: 'Strictly Remote', hybrid: 'Remote & Hybrid', onsite: 'On-site / Office' };
        setFormData((prev) => ({
          ...prev,
          headline: talent.headline || prev.headline,
          portfolioUrl: user?.website_url || prev.portfolioUrl,
          minCtc:
            talent.salary_expectation != null
              ? `₹${Number(talent.salary_expectation).toLocaleString('en-IN')} / yr`
              : prev.minCtc,
          workMode: talent.preferred_mode ? modeLabel[talent.preferred_mode] : prev.workMode,
          publicVisibility: talent.is_searchable,
          hideCurrentEmployer: talent.hide_current_employer
        }));
      } catch {
        // talent profile simply may not exist yet
      }
      try {
        const prefs = await api.notificationPreferences.get();
        if (cancelled) return;
        const row = prefs.items.find((x) => x.category === 'email_alerts' && x.channel === 'email');
        if (row) setFormData((prev) => ({...prev, emailAlerts: row.is_enabled}));
      } catch {
        // no saved preferences yet — default stays
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await api.users.updateMe({
        display_name: formData.fullName,
        phone: formData.phone || null,
        website_url: formData.portfolioUrl || null,
      });
      await refreshUser();
      const modeMap = {
        'Strictly Remote': 'remote',
        'On-site / Office': 'onsite',
        'Remote & Hybrid': 'hybrid'
      };
      const salary = String(formData.minCtc || '').replace(/[^\d.]/g, '');
      const talentPayload = {
        headline: formData.headline || null,
        preferred_mode: modeMap[formData.workMode] || null,
        is_searchable: formData.publicVisibility,
        hide_current_employer: formData.hideCurrentEmployer
      };
      if (salary) talentPayload.salary_expectation = Number(salary);
      await api.talentProfile.updateMe(talentPayload);
      await api.notificationPreferences.update([
        {category: 'email_alerts', channel: 'email', is_enabled: formData.emailAlerts}
      ]);
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your settings.');
    } finally {
      setSaving(false);
    }
  };

  const submitDeleteRequest = async () => {
    try {
      await api.users.createDeleteRequest();
      setError('');
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2500);
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === 'CONFLICT'
          ? 'You already have an open data request.'
          : err instanceof ApiError
            ? err.message
            : 'Could not submit the request.',
      );
    }
  };

  return (
    <JobSeekerShell active="Dashboard">
      <div className="space-y-6 max-w-5xl pb-10">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-serif font-bold text-[#0F1B2D]">
              Job Seeker Settings
            </h1>
            <p className="text-xs md:text-sm text-[#6B7280] mt-1">
              Manage your candidate identity, visibility to startup founders, and career preferences.
            </p>
          </div>
        </div>

        {savedToast && (
          <div className="rounded-xl border border-[#CDE5D7] bg-[#E7F3EC] p-3 text-xs text-[#286749] flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CheckCircle2 size={16} /> Preferences successfully updated.
            </span>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700" role="alert">
            {error}
          </div>
        )}

        {/* 2-Column Settings Layout */}
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Navigation Sidebar */}
          <aside className="lg:col-span-3 space-y-1">
            {[
              { id: 'Profile', label: 'Candidate Profile', icon: User },
              { id: 'Preferences', label: 'Job Preferences', icon: Sliders },
              { id: 'Privacy', label: 'Privacy & Visibility', icon: Eye },
              { id: 'Notifications', label: 'Notifications', icon: Bell },
              { id: 'Danger', label: 'Delete account', icon: Lock },
            ].map((item) => {
              const Comp = item.icon;
              const isSelected = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveSection(item.id)}
                  className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-left transition-colors ${
                    isSelected
                      ? 'bg-[#0F1B2D] text-white'
                      : 'text-[#4A5568] hover:bg-[#FAF8F4]'
                  }`}
                >
                  <Comp size={15} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </aside>

          {/* Form Content */}
          <main className="lg:col-span-9">
            <form onSubmit={handleSave} className="space-y-6">
              {activeSection === 'Profile' && (
                <section className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm space-y-4">
                  <h2 className="text-base font-serif font-bold text-[#0F1B2D]">
                    Public Candidate Identity
                  </h2>

                  <div className="space-y-3.5">
                    <div>
                      <label htmlFor="fullName" className="block text-xs font-semibold text-[#4A5568] mb-1">
                        Full Name
                      </label>
                      <input
                        id="fullName"
                        name="fullName"
                        type="text"
                        value={formData.fullName}
                        onChange={handleInputChange}
                        className="w-full h-10 px-3 rounded-lg border border-[#E5E1D8] text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label htmlFor="headline" className="block text-xs font-semibold text-[#4A5568] mb-1">
                        Professional Headline
                      </label>
                      <input
                        id="headline"
                        name="headline"
                        type="text"
                        value={formData.headline}
                        onChange={handleInputChange}
                        className="w-full h-10 px-3 rounded-lg border border-[#E5E1D8] text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                      />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label htmlFor="email" className="block text-xs font-semibold text-[#4A5568] mb-1">
                          Email Address
                        </label>
                        <input
                          id="email"
                          name="email"
                          type="email"
                          value={formData.email}
                          disabled
                          className="w-full h-10 px-3 rounded-lg border border-[#E5E1D8] bg-[#FAF8F4] text-xs text-[#7B8CA3] focus:outline-none"
                        />
                      </div>

                      <div>
                        <label htmlFor="phone" className="block text-xs font-semibold text-[#4A5568] mb-1">
                          Phone Number
                        </label>
                        <input
                          id="phone"
                          name="phone"
                          type="tel"
                          value={formData.phone}
                          onChange={handleInputChange}
                          className="w-full h-10 px-3 rounded-lg border border-[#E5E1D8] text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="portfolioUrl" className="block text-xs font-semibold text-[#4A5568] mb-1">
                        Portfolio / Website URL
                      </label>
                      <input
                        id="portfolioUrl"
                        name="portfolioUrl"
                        type="url"
                        value={formData.portfolioUrl}
                        onChange={handleInputChange}
                        className="w-full h-10 px-3 rounded-lg border border-[#E5E1D8] text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                      />
                    </div>
                  </div>
                </section>
              )}

              {activeSection === 'Preferences' && (
                <section className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm space-y-4">
                  <h2 className="text-base font-serif font-bold text-[#0F1B2D]">
                    Target Compensation & Work Style
                  </h2>
                  <p className="text-xs text-[#6B7280]">
                    Salary and work mode save to your talent profile.
                  </p>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="minCtc" className="block text-xs font-semibold text-[#4A5568] mb-1">
                        Desired Minimum Base CTC
                      </label>
                      <input
                        id="minCtc"
                        name="minCtc"
                        type="text"
                        value={formData.minCtc}
                        onChange={handleInputChange}
                        className="w-full h-10 px-3 rounded-lg border border-[#E5E1D8] text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label htmlFor="workMode" className="block text-xs font-semibold text-[#4A5568] mb-1">
                        Work Mode Preference
                      </label>
                      <select
                        id="workMode"
                        name="workMode"
                        value={formData.workMode}
                        onChange={handleInputChange}
                        className="w-full h-10 px-3 rounded-lg border border-[#E5E1D8] bg-white text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                      >
                        <option value="Remote & Hybrid">Remote & Hybrid (Preferred)</option>
                        <option value="Strictly Remote">Strictly Remote Only</option>
                        <option value="On-site / Office">On-site / Office</option>
                      </select>
                    </div>
                  </div>
                </section>
              )}

              {activeSection === 'Privacy' && (
                <section className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm space-y-4">
                  <h2 className="text-base font-serif font-bold text-[#0F1B2D]">
                    Founder Visibility Controls
                  </h2>
                  <p className="text-xs text-[#6B7280]">
                    Visibility flags save to your talent profile.
                  </p>

                  <div className="space-y-4 text-xs">
                    <div className="flex items-center justify-between pb-3 border-b border-[#F0EBE0]">
                      <div>
                        <strong className="block text-[#0F1B2D]">
                          Discoverable to Verified Startups
                        </strong>
                        <span className="text-[#6B7280]">
                          Allows vetted founders to reach out directly with private role invitations.
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        name="publicVisibility"
                        checked={formData.publicVisibility}
                        onChange={handleInputChange}
                        className="h-4 w-4 rounded border-[#E5E1D8] text-[#B8955A] focus:ring-[#B8955A]"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <strong className="block text-[#0F1B2D]">
                          Hide Profile from Current Employer
                        </strong>
                        <span className="text-[#6B7280]">
                          Automatically blocks anyone associated with your current company domain.
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        name="hideCurrentEmployer"
                        checked={formData.hideCurrentEmployer}
                        onChange={handleInputChange}
                        className="h-4 w-4 rounded border-[#E5E1D8] text-[#B8955A] focus:ring-[#B8955A]"
                      />
                    </div>
                  </div>
                </section>
              )}

              {activeSection === 'Notifications' && (
                <section className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm space-y-4">
                  <h2 className="text-base font-serif font-bold text-[#0F1B2D]">
                    Notification Channels
                  </h2>

                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <strong className="block text-[#0F1B2D]">Email Alerts</strong>
                      <span className="text-[#6B7280]">
                        Receive instant notifications for direct founder messages and interview invites.
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      name="emailAlerts"
                      checked={formData.emailAlerts}
                      onChange={handleInputChange}
                      className="h-4 w-4 rounded border-[#E5E1D8] text-[#B8955A] focus:ring-[#B8955A]"
                    />
                  </div>
                </section>
              )}

              {activeSection === 'Danger' && (
                <section className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm space-y-4">
                  <h2 className="text-base font-serif font-bold text-[#B42318]">
                    Delete account
                  </h2>
                  <p className="text-xs text-[#6B7280]">
                    Opens a data erasure request for your account. You can track its status from
                    this page; a team member completes verification before anything is removed.
                  </p>
                  <JobBtn
                    type="button"
                    onClick={submitDeleteRequest}
                    className="px-5 min-h-[42px] !bg-[#B42318] hover:!bg-red-800"
                  >
                    Request account deletion
                  </JobBtn>
                </section>
              )}

              {activeSection !== 'Danger' && (
                <div className="pt-2 flex justify-end">
                  <JobBtn type="submit" primary className="px-6 min-h-[42px]" disabled={saving}>
                    {saving ? 'Saving…' : 'Save Settings'}
                  </JobBtn>
                </div>
              )}
            </form>
          </main>
        </div>
      </div>
    </JobSeekerShell>
  );
}
