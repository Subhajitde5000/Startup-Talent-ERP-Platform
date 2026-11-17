'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Info,
  X,
} from 'lucide-react';
import MentorPageShell from '../mentor-page-shell';
import { Btn, Card } from '../mentor-data';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api/client';

export default function MentorSettingsPage() {
  const { user, refreshUser } = useAuth();

  const NOTIF_CATEGORIES = [
    'Requests and invitations',
    'Sessions',
    'Summary reminders',
    'Sign-offs and deliverables',
    'Messages',
    'Payments and tax',
    'Agreements',
    'Reviews and impact',
    'Investor events',
    'Platform updates',
    'Security alerts'
  ];
  const notifSlug = (label) => label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const defaultNotif = () =>
    Object.fromEntries(NOTIF_CATEGORIES.map((label, i) => [label, [true, i === 10 || i < 8, false]]));
  const [notif, setNotif] = useState(defaultNotif);
  const [notifLoading, setNotifLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.notificationPreferences.get();
        if (cancelled) return;
        if (data.items.length) {
          setNotif((prev) => {
            const next = {...prev};
            for (const item of data.items) {
              const label = NOTIF_CATEGORIES.find((l) => notifSlug(l) === item.category);
              if (!label) continue;
              const ch = {in_app: 0, email: 1, push: 2}[item.channel];
              if (ch != null) next[label][ch] = item.is_enabled;
            }
            return next;
          });
        }
      } catch {
        // no saved rows yet — defaults apply
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveNotif = async () => {
    if (notifLoading) return;
    setNotifLoading(true);
    try {
      const items = [];
      for (const label of NOTIF_CATEGORIES) {
        if (label === 'Security alerts') continue;
        const [inApp, email, push] = notif[label];
        items.push(
          {category: notifSlug(label), channel: 'in_app', is_enabled: inApp},
          {category: notifSlug(label), channel: 'email', is_enabled: email},
          {category: notifSlug(label), channel: 'push', is_enabled: push}
        );
      }
      await api.notificationPreferences.update(items);
      notify('Preferences saved.');
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not save preferences.');
    } finally {
      setNotifLoading(false);
    }
  };
  const [toast, setToast] = useState('');
  const [section, setSection] = useState('Account');
  const [modal, setModal] = useState('');
  const [saving, setSaving] = useState(false);
  const [account, setAccount] = useState(() => ({
    fullName: user?.display_name || '',
    email: user?.email || '',
    timezone: user?.timezone || 'Asia/Kolkata',
    phone: user?.phone || '',
  }));
  const [profilePublic, setProfilePublic] = useState(() => user?.profile_public ?? true);

  const notify = (x) => {
    setToast(x);
    setTimeout(() => setToast(''), 2600);
  };

  const saveChanges = async () => {
    if (saving) return;
    setSaving(true);
    try {
      if (section === 'Account') {
        await api.users.updateMe({
          display_name: account.fullName,
          timezone: account.timezone,
          phone: account.phone || null,
        });
      } else if (section === 'Privacy and visibility') {
        await api.users.updateMe({ profile_public: profilePublic });
      }
      await refreshUser();
      notify('Changes saved.');
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  };

  const submitDeleteRequest = async () => {
    try {
      await api.users.createDeleteRequest();
      notify('Deletion request submitted.');
    } catch (err) {
      notify(
        err instanceof ApiError && err.code === 'CONFLICT'
          ? 'You already have an open data request.'
          : err instanceof ApiError
            ? err.message
            : 'Could not submit the request.',
      );
    }
    setModal('');
  };

  const banner = (
    <div className="mb-5 flex items-start gap-3 rounded-lg border border-[#E7D4B0] bg-[#FFF8E8] p-3 text-xs text-[#806236]">
      <Info size={16} className="mt-0.5 shrink-0" />
      <span>
        <b>Your mentor profile is under review.</b> Messages are limited to admin and support until
        your profile is approved. Other mentor tools remain available.{' '}
        <span className="font-semibold underline">View application status</span>
      </span>
    </div>
  );

  const sections = [
    'Account',
    'Security',
    'Notifications',
    'Privacy and visibility',
    'Mentoring preferences',
    'Payments and payouts',
    'Connected accounts',
    'Roles',
    'Help and legal',
    'Danger zone',
  ];

  return (
    <MentorPageShell active="Settings" toast={toast} notify={notify}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-[#4A5568]">
            Mentor workspace <span className="mx-2 text-[#B8955A]">·</span> Shared pages
          </p>
          <h1 className="serif mt-1 text-[30px] font-semibold text-[#0F1B2D]">
            Settings
          </h1>
          <p className="mt-1 text-sm text-[#4A5568]">
            Manage your mentor account, preferences and privacy.
          </p>
        </div>
      </div>

      {banner}

      <div className="grid gap-5 lg:grid-cols-[230px_1fr]">
        {/* Navigation list */}
        <nav className="rounded-xl border border-[#E5E1D8] bg-white p-2 h-fit">
          {sections.map((x) => (
            <button
              type="button"
              key={x}
              onClick={() => setSection(x)}
              className={`block min-h-10 w-full rounded-lg px-3 text-left text-xs font-medium transition-colors ${
                section === x
                  ? 'bg-[#0F1B2D] text-white font-semibold'
                  : 'text-[#4A5568] hover:bg-[#FAF8F4] hover:text-[#0F1B2D]'
              }`}
            >
              {x}
            </button>
          ))}
        </nav>

        {/* Section Content */}
        <div className="space-y-4">
          <Card title={section}>
            <p className="text-sm text-[#4A5568]">
              {section === 'Account'
                ? 'Name, email, phone, language and Asia/Kolkata time zone.'
                : section === 'Security'
                ? 'Password, two-factor authentication, active sessions and security activity.'
                : section === 'Notifications'
                ? 'Set in-app, email and push preferences. Security alerts stay on.'
                : section === 'Privacy and visibility'
                ? 'Control mentor profile and public impact visibility, data export and deletion.'
                : section === 'Mentoring preferences'
                ? 'Profile, availability, capacity, pricing and agreement defaults.'
                : section === 'Payments and payouts'
                ? 'Payout method and tax details are managed in Earnings.'
                : section === 'Connected accounts'
                ? 'Google, Microsoft, read-only calendar sync and LinkedIn.'
                : section === 'Roles'
                ? 'Mentor role active. Add roles and choose your default sign-in role.'
                : section === 'Help and legal'
                ? 'Terms, privacy, mentor code of conduct and platform disclaimer.'
                : 'Pause mentoring, close mentor role or delete account. Unresolved items can block closure.'}
            </p>

            {section === 'Account' && (
              <div className="mt-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-medium text-[#0F1B2D]">
                    Full name
                    <input
                      value={account.fullName}
                      onChange={(e) => setAccount({ ...account, fullName: e.target.value })}
                      className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 focus:outline-none"
                    />
                  </label>
                  <label className="text-xs font-medium text-[#0F1B2D]">
                    Email address
                    <input
                      value={account.email}
                      disabled
                      className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] bg-[#FAF8F4] px-3 text-[#7B8CA3] focus:outline-none"
                    />
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-medium text-[#0F1B2D]">
                    Time zone
                    <select
                      value={account.timezone}
                      onChange={(e) => setAccount({ ...account, timezone: e.target.value })}
                      className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 focus:outline-none"
                    >
                      <option value={account.timezone || 'Asia/Kolkata'}>
                        {account.timezone || 'Asia/Kolkata'}
                      </option>
                      <option value="Asia/Kolkata">Asia/Kolkata (IST · UTC+5:30)</option>
                      <option value="Europe/Berlin">Europe/Berlin (CET · UTC+1)</option>
                      <option value="America/New_York">America/New_York (ET · UTC−5)</option>
                    </select>
                  </label>
                  <label className="text-xs font-medium text-[#0F1B2D]">
                    Phone number
                    <input
                      value={account.phone}
                      onChange={(e) => setAccount({ ...account, phone: e.target.value })}
                      className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 focus:outline-none"
                    />
                  </label>
                </div>
              </div>
            )}

            {section === 'Notifications' && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#E5E1D8] text-[#4A5568]">
                      <th className="py-2 text-left font-medium">Category</th>
                      <th className="font-medium text-center">In-app</th>
                      <th className="font-medium text-center">Email</th>
                      <th className="font-medium text-center">Push</th>
                    </tr>
                  </thead>
                  <tbody>
                    {NOTIF_CATEGORIES.map((x, i) => (
                      <tr key={x} className="border-t border-[#E5E1D8]">
                        <td className="py-2 text-[#0F1B2D]">{x}</td>
                        {[0, 1, 2].map((c) => (
                          <td key={c} className="text-center">
                            <input
                              aria-label={`${x} ${['in-app', 'email', 'push'][c]}`}
                              type="checkbox"
                              checked={notif[x][c]}
                              disabled={i === 10}
                              onChange={(e) => {
                                const next = {...notif, [x]: [...notif[x]]};
                                next[x][c] = e.target.checked;
                                setNotif(next);
                              }}
                              className="accent-[#0F1B2D]"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <label className="mt-4 block text-xs text-[#0F1B2D]">
                  Digest{' '}
                  <select className="ml-2 rounded border border-[#E5E1D8] bg-white p-1 focus:outline-none">
                    <option>Instant</option>
                    <option>Daily</option>
                    <option>Weekly</option>
                  </select>{' '}
                  · Quiet hours 9 PM–8 AM
                </label>
                <div className="mt-4">
                  <Btn onClick={saveNotif} disabled={notifLoading}>
                    {notifLoading ? 'Saving…' : 'Save preferences'}
                  </Btn>
                </div>
              </div>
            )}

            {section === 'Privacy and visibility' && (
              <div className="mt-3 space-y-2 text-xs text-[#0F1B2D]">
                <label className="flex items-center gap-2">
                  <input
                    aria-label="Profile visible to opted-in startups"
                    type="checkbox"
                    checked={profilePublic}
                    onChange={(e) => setProfilePublic(e.target.checked)}
                    className="accent-[#0F1B2D]"
                  />{' '}
                  Profile visible to opted-in startups
                </label>
                <label className="flex items-center gap-2">
                  <input aria-label="Toggle option" type="checkbox" className="accent-[#0F1B2D]" />{' '}
                  Public impact record
                </label>
                <p className="pt-2">
                  <Link href="/mentor/impact" className="font-semibold text-[#9A7A45]">
                    Manage impact visibility →
                  </Link>
                </p>
              </div>
            )}

            {section === 'Mentoring preferences' && (
              <p className="mt-3 text-xs text-[#4A5568]">
                <Link href="/mentor/settings" className="font-semibold text-[#0F1B2D] underline">
                  Profile
                </Link>{' '}
                ·{' '}
                <Link href="/mentor/sessions" className="font-semibold text-[#0F1B2D] underline">
                  Availability
                </Link>{' '}
                ·{' '}
                <Link href="/mentor/agreements" className="font-semibold text-[#0F1B2D] underline">
                  Pricing and agreements
                </Link>
              </p>
            )}

            {section === 'Payments and payouts' && (
              <Link
                href="/mentor/earnings"
                className="mt-3 inline-block text-xs font-semibold text-[#9A7A45]"
              >
                Open earnings settings →
              </Link>
            )}

            {section === 'Danger zone' && (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setModal('pause')}
                  className="rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs font-semibold text-[#0F1B2D] hover:bg-[#FAF8F4]"
                >
                  Pause mentoring
                </button>
                <button
                  type="button"
                  onClick={() => notify('Resolve active mentorships, sign-offs and payout first.')}
                  className="rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs font-semibold text-[#0F1B2D] hover:bg-[#FAF8F4]"
                >
                  Check role closure
                </button>
                <button
                  type="button"
                  onClick={() => setModal('delete-account')}
                  className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                >
                  Delete account
                </button>
              </div>
            )}

            {section === 'Security' && (
              <div className="mt-4 space-y-3">
                <p className="rounded-lg bg-[#FFF8E8] p-3 text-xs text-[#806236]">
                  Add two-factor authentication to protect your account.
                </p>
                <button
                  type="button"
                  onClick={() => setModal('reauth')}
                  className="rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs font-semibold text-[#0F1B2D] hover:bg-[#FAF8F4]"
                >
                  Set up 2FA · Sign out everywhere
                </button>
              </div>
            )}

            {(section === 'Account' || section === 'Privacy and visibility') && (
              <button
                type="button"
                onClick={saveChanges}
                disabled={saving}
                className="mt-5 rounded-lg bg-[#0F1B2D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1C2B42] disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            )}
          </Card>
        </div>
      </div>

      {/* Modals */}
      {modal && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[#0F1B2D]/45 p-4">
          <section
            role="dialog"
            aria-modal="true"
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="serif text-2xl font-semibold text-[#0F1B2D]">
                {modal === 'pause'
                  ? 'Pause mentoring'
                  : modal === 'delete-account'
                  ? 'Delete account confirmation'
                  : 'Security re-authentication'}
              </h2>
              <button
                type="button"
                onClick={() => setModal('')}
                aria-label="Close"
                className="text-[#4A5568] hover:text-[#0F1B2D]"
              >
                <X size={18} />
              </button>
            </div>
            {modal === 'pause' ? (
              <p className="text-sm text-[#4A5568]">
                Pausing hides your profile from discovery and stops new requests. Existing mentorships
                remain active until concluded.
              </p>
            ) : modal === 'delete-account' ? (
              <p className="text-sm text-red-700">
                Are you sure you want to delete your account? All data, records and pending payouts
                must be fully settled before closure.
              </p>
            ) : (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-[#0F1B2D]">
                  Current password
                  <input
                    aria-label="Current password"
                    type="password"
                    className="mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 focus:outline-none"
                  />
                </label>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModal('')}
                className="min-h-10 px-4 text-sm font-medium text-[#4A5568] hover:text-[#0F1B2D]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (modal === 'delete-account') {
                    submitDeleteRequest();
                  } else {
                    notify('Confirmed.');
                    setModal('');
                  }
                }}
                className={`min-h-10 rounded-lg px-4 text-sm font-semibold text-white ${
                  modal === 'delete-account' ? 'bg-[#B42318] hover:bg-red-800' : 'bg-[#0F1B2D] hover:bg-[#1C2B42]'
                }`}
              >
                Confirm
              </button>
            </div>
          </section>
        </div>
      )}
    </MentorPageShell>
  );
}
