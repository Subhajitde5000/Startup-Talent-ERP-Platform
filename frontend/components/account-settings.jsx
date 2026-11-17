'use client';

/**
 * Account settings body shared by the startup and employer settings pages
 * (roles that previously had no settings route). Section layout mirrors the
 * existing jobseeker/mentor/investor settings pages — no redesign.
 *
 * Wired sections: Account (user profile fields) and Privacy (profile_public /
 * allow_outreach — approved user columns). Notifications stay on demo until
 * Step 12; Delete account posts a real DPDP data request.
 */
import React, { useState } from 'react';
import {
  User,
  Eye,
  Bell,
  Lock,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api/client';

export default function AccountSettings() {
  const { user, refreshUser } = useAuth();
  const [activeSection, setActiveSection] = useState('Account');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [account, setAccount] = useState(() => ({
    fullName: user?.display_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    timezone: user?.timezone || 'Asia/Kolkata',
  }));
  const [privacy, setPrivacy] = useState(() => ({
    profilePublic: user?.profile_public ?? true,
    allowOutreach: user?.allow_outreach ?? true,
  }));

  const flashSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const saveAccount = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await api.users.updateMe({
        display_name: account.fullName,
        phone: account.phone || null,
        timezone: account.timezone,
      });
      await refreshUser();
      flashSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your settings.');
    } finally {
      setSaving(false);
    }
  };

  const savePrivacy = async () => {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await api.users.updateMe({
        profile_public: privacy.profilePublic,
        allow_outreach: privacy.allowOutreach,
      });
      await refreshUser();
      flashSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your settings.');
    } finally {
      setSaving(false);
    }
  };

  const submitDeleteRequest = async () => {
    setError('');
    try {
      await api.users.createDeleteRequest();
      flashSaved();
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

  const sections = [
    { id: 'Account', label: 'Account', icon: User },
    { id: 'Privacy', label: 'Privacy & visibility', icon: Eye },
    { id: 'Notifications', label: 'Notifications', icon: Bell },
    { id: 'Danger', label: 'Delete account', icon: Lock },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-7 sm:px-6 pb-10">
      {saved && (
        <div
          role="status"
          className="mb-4 rounded-xl border border-[#CDE5D7] bg-[#E7F3EC] p-3 text-xs text-[#286749]"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 size={16} /> Changes saved.
          </span>
        </div>
      )}
      {error && (
        <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        <aside className="lg:col-span-3 space-y-1">
          {sections.map((item) => {
            const Comp = item.icon;
            const isSelected = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-left transition-colors ${
                  isSelected ? 'bg-[#0F1B2D] text-white' : 'text-[#4A5568] hover:bg-[#FAF8F4]'
                }`}
              >
                <Comp size={15} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </aside>

        <main className="lg:col-span-9">
          {activeSection === 'Account' && (
            <form onSubmit={saveAccount} className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm space-y-4">
              <h2 className="text-base font-serif font-bold text-[#0F1B2D]">Account details</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="acc-full-name" className="block text-xs font-semibold text-[#4A5568] mb-1">
                    Full name
                  </label>
                  <input
                    id="acc-full-name"
                    type="text"
                    required
                    value={account.fullName}
                    onChange={(e) => setAccount({ ...account, fullName: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-[#E5E1D8] text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="acc-email" className="block text-xs font-semibold text-[#4A5568] mb-1">
                    Email address
                  </label>
                  <input
                    id="acc-email"
                    type="email"
                    value={account.email}
                    disabled
                    className="w-full h-10 px-3 rounded-lg border border-[#E5E1D8] bg-[#FAF8F4] text-xs text-[#7B8CA3] focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="acc-phone" className="block text-xs font-semibold text-[#4A5568] mb-1">
                    Phone number
                  </label>
                  <input
                    id="acc-phone"
                    type="tel"
                    value={account.phone}
                    onChange={(e) => setAccount({ ...account, phone: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-[#E5E1D8] text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="acc-tz" className="block text-xs font-semibold text-[#4A5568] mb-1">
                    Time zone
                  </label>
                  <select
                    id="acc-tz"
                    value={account.timezone}
                    onChange={(e) => setAccount({ ...account, timezone: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-[#E5E1D8] bg-white text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                  >
                    <option value="Asia/Kolkata">Asia/Kolkata (IST · UTC+5:30)</option>
                    <option value="Europe/Berlin">Europe/Berlin (CET · UTC+1)</option>
                    <option value="America/New_York">America/New_York (ET · UTC−5)</option>
                    <option value={account.timezone}>{account.timezone}</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-[#0F1B2D] px-5 py-2 text-xs font-semibold text-white hover:bg-[#1C2B42] disabled:opacity-60"
                >
                  {saving ? 'Saving…' : 'Save account details'}
                </button>
              </div>
            </form>
          )}

          {activeSection === 'Privacy' && (
            <div className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm space-y-4">
              <h2 className="text-base font-serif font-bold text-[#0F1B2D]">Privacy & visibility</h2>
              <div className="space-y-4 text-xs">
                <label className="flex items-center justify-between gap-4 pb-3 border-b border-[#F0EBE0]">
                  <span>
                    <strong className="block text-[#0F1B2D]">Show my profile in public directories</strong>
                    <span className="text-[#6B7280]">
                      Other verified members can find your profile by handle.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={privacy.profilePublic}
                    onChange={(e) => setPrivacy({ ...privacy, profilePublic: e.target.checked })}
                    className="h-4 w-4 rounded border-[#E5E1D8] text-[#B8955A] focus:ring-[#B8955A]"
                  />
                </label>
                <label className="flex items-center justify-between gap-4">
                  <span>
                    <strong className="block text-[#0F1B2D]">Allow outreach from investors & recruiters</strong>
                    <span className="text-[#6B7280]">
                      Verified investors and employers may contact you about opportunities.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={privacy.allowOutreach}
                    onChange={(e) => setPrivacy({ ...privacy, allowOutreach: e.target.checked })}
                    className="h-4 w-4 rounded border-[#E5E1D8] text-[#B8955A] focus:ring-[#B8955A]"
                  />
                </label>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={savePrivacy}
                  disabled={saving}
                  className="rounded-lg bg-[#0F1B2D] px-5 py-2 text-xs font-semibold text-white hover:bg-[#1C2B42] disabled:opacity-60"
                >
                  {saving ? 'Saving…' : 'Save privacy settings'}
                </button>
              </div>
            </div>
          )}

          {activeSection === 'Notifications' && (
            <div className="rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-sm space-y-4">
              <h2 className="text-base font-serif font-bold text-[#0F1B2D]">Notification channels</h2>
              <p className="text-xs text-[#6B7280]">
                Email and in-app notification preferences arrive with Step 12 (Notifications).
              </p>
            </div>
          )}

          {activeSection === 'Danger' && (
            <div className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm space-y-4">
              <h2 className="text-base font-serif font-bold text-[#B42318]">Delete account</h2>
              <p className="text-xs text-[#6B7280]">
                Opens a data erasure request for your account. Verification happens before any data
                is removed.
              </p>
              <button
                type="button"
                onClick={submitDeleteRequest}
                className="rounded-lg bg-[#B42318] px-5 py-2 text-xs font-semibold text-white hover:bg-red-800"
              >
                Request account deletion
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
