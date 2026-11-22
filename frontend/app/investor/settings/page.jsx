'use client';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import {
  Settings,
  Shield,
  Bell,
  Users,
  LockKeyhole,
  Check,
  X,
} from 'lucide-react';
import { InvestorShell, Card, Button } from '@/components';
import { InvestorDisclaimer } from '../investor-data';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api/client';

export default function InvestorSettingsPage() {
  const { user, refreshUser } = useAuth();

  const NOTIF_CATEGORIES = [
    'Suggested dealflow matches & saved searches',
    'Intro requests and founder replies',
    'Data room access & document uploads',
    'Diligence question responses',
    'Meeting invitations and schedule updates',
    'Offer counters and term sheet revisions',
    'Capital commitment & funds settlement',
    'Portfolio updates and reports'
  ];
  const notifSlug = (label) => label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const defaultNotif = () =>
    Object.fromEntries(NOTIF_CATEGORIES.map((label) => [label, [true, true, false]]));
  const [notif, setNotif] = useState(defaultNotif);
  const [notifLoading, setNotifLoading] = useState(false);
  const notifyRef = useRef(null);

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
        const [inApp, email, push] = notif[label];
        items.push(
          {category: notifSlug(label), channel: 'in_app', is_enabled: inApp},
          {category: notifSlug(label), channel: 'email', is_enabled: email},
          {category: notifSlug(label), channel: 'push', is_enabled: push}
        );
      }
      await api.notificationPreferences.update(items);
      notifyRef.current?.('Notification preferences saved.');
    } catch (err) {
      notifyRef.current?.(err instanceof ApiError ? err.message : 'Could not save preferences.');
    } finally {
      setNotifLoading(false);
    }
  };
  const [section, setSection] = useState('Account');
  const [modal, setModal] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [account, setAccount] = useState(() => ({
    fullName: user?.display_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    timezone: user?.timezone || 'Asia/Kolkata',
  }));
  const [profilePublic, setProfilePublic] = useState(() => user?.profile_public ?? true);

  const saveAccount = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await api.users.updateMe({
        display_name: account.fullName,
        phone: account.phone || null,
        timezone: account.timezone,
      });
      await refreshUser();
      notifyRef.current?.('Account profile details updated.');
    } catch (err) {
      notifyRef.current?.(err instanceof ApiError ? err.message : 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  };

  const saveVisibility = async (value) => {
    const next = value !== 'stealth';
    setProfilePublic(next);
    try {
      await api.users.updateMe({ profile_public: next });
      await refreshUser();
      notifyRef.current?.('Visibility updated.');
    } catch (err) {
      setProfilePublic(!next);
      notifyRef.current?.(err instanceof ApiError ? err.message : 'Could not save visibility.');
    }
  };

  const submitDeleteRequest = async () => {
    try {
      await api.users.createDeleteRequest();
      notifyRef.current?.('Deletion request submitted.');
    } catch (err) {
      notifyRef.current?.(
        err instanceof ApiError && err.code === 'CONFLICT'
          ? 'You already have an open data request.'
          : err instanceof ApiError
            ? err.message
            : 'Could not submit the request.',
      );
    }
    setModal('');
  };

  return (
    <InvestorShell
      active="Settings"
      module="Deal flow"
      title="Investor workspace settings"
      description="Configure your investor account, security, organization members, notification digests and privacy."
    >
      {({ notify }) => {
        notifyRef.current = notify;
        return (
          <>
          <div className="mb-6 rounded-lg bg-[#E7F3EC] p-3 text-xs text-[#286749] border border-[#C3E4D1] flex items-center justify-between">
            <span>✓ Verified Institutional & Individual Investor Status: <b>Active & Compliant</b></span>
            <span className="font-semibold text-xs">Full Access Level</span>
          </div>

          <div className="grid items-start gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
            {/* Settings Navigation Sidebar */}
            <nav className="rounded-xl border border-[#E5E1D8] bg-white p-2 space-y-1">
              {[
                'Account',
                'Security',
                'Verification',
                'Organization',
                'Notifications',
                'Privacy and visibility',
                'Investing preferences',
                'Data room defaults',
                'Danger zone',
              ].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSection(s)}
                  className={`block min-h-10 w-full rounded-lg px-3 text-left text-xs transition ${
                    section === s
                      ? 'bg-[#F3EBDD] font-semibold text-ink'
                      : 'text-[#4A5568] hover:bg-[#FAF8F4] hover:text-ink'
                  }`}
                >
                  {s}
                </button>
              ))}
            </nav>

            {/* Settings Section Panel */}
            <div className="space-y-6">
              {section === 'Account' && (
                <Card title="Personal & professional profile">
                  <form onSubmit={saveAccount} className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="acc-name" className="block text-xs font-medium text-ink">
                        Full legal name
                      </label>
                      <input
                        id="acc-name"
                        value={account.fullName}
                        onChange={(e) => setAccount({ ...account, fullName: e.target.value })}
                        className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs focus:border-ink focus:outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="acc-email" className="block text-xs font-medium text-ink">
                        Primary email
                      </label>
                      <input
                        id="acc-email"
                        type="email"
                        value={account.email}
                        disabled
                        className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] bg-[#FAF8F4] px-3 text-xs text-[#7B8CA3] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="acc-phone" className="block text-xs font-medium text-ink">
                        Phone number
                      </label>
                      <input
                        id="acc-phone"
                        value={account.phone}
                        onChange={(e) => setAccount({ ...account, phone: e.target.value })}
                        className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs focus:border-ink focus:outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="acc-tz" className="block text-xs font-medium text-ink">
                        Time zone
                      </label>
                      <select
                        id="acc-tz"
                        value={account.timezone}
                        onChange={(e) => setAccount({ ...account, timezone: e.target.value })}
                        className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs focus:border-ink focus:outline-none"
                      >
                        <option value="Asia/Kolkata">Asia/Kolkata (IST · UTC+5:30)</option>
                        <option value="Asia/Singapore">Asia/Singapore (SGT · UTC+8:00)</option>
                        <option value="Europe/London">Europe/London (GMT · UTC+0:00)</option>
                        <option value={account.timezone}>{account.timezone}</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2 pt-2">
                      <Button type="submit" disabled={saving}>
                        {saving ? 'Saving…' : 'Save account profile'}
                      </Button>
                    </div>
                  </form>
                </Card>
              )}

              {section === 'Security' && (
                <Card title="Security & authentication">
                  <div className="space-y-4 text-xs">
                    <div className="rounded-xl border border-[#E5E1D8] p-4 flex items-center justify-between">
                      <div>
                        <b className="text-ink">Two-Factor Authentication (2FA)</b>
                        <span className="block text-[#4A5568]">Authenticator app (TOTP) enabled</span>
                      </div>
                      <span className="rounded-full bg-[#E7F3EC] px-2.5 py-0.5 font-semibold text-[#286749]">
                        Enabled
                      </span>
                    </div>

                    <div className="rounded-xl border border-[#E5E1D8] p-4 flex items-center justify-between">
                      <div>
                        <b className="text-ink">Active session</b>
                        <span className="block text-[#4A5568]">Chrome on Windows 11 · Kolkata, India (Current device)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => notify('Terminated all remote sessions.')}
                        className="text-xs font-semibold text-[#B42318] hover:underline"
                      >
                        Sign out other devices
                      </button>
                    </div>
                  </div>
                </Card>
              )}

              {section === 'Verification' && (
                <Card title="Investor compliance verification">
                  <p className="text-xs text-ink leading-relaxed">
                    Accredited investor documents on file · Verified on Aug 14, 2026. Annual re-certification scheduled for Aug 2027.
                  </p>
                  <Button
                    secondary
                    className="mt-4"
                    onClick={() => notify('Investor certification documents displayed.')}
                  >
                    View accreditation records
                  </Button>
                </Card>
              )}

              {section === 'Organization' && (
                <Card
                  title="Team members & roles"
                  action={
                    <Button secondary onClick={() => setModal('invite-member')}>
                      Invite colleague
                    </Button>
                  }
                >
                  <div className="space-y-3 text-xs">
                    {[
                      ['Arjun Mehta', 'Managing Partner (Owner)', 'arjun@formaventures.example'],
                      ['Mira Shah', 'Partner · Full Diligence & Offer Authority', 'mira@formaventures.example'],
                      ['Dev Patel', 'Associate · Diligence & Market Insights', 'dev@formaventures.example'],
                    ].map(([name, role, email]) => (
                      <div
                        key={name}
                        className="flex items-center justify-between border-b border-[#E5E1D8] pb-3 last:border-0 last:pb-0"
                      >
                        <div>
                          <b className="text-ink">{name}</b>
                          <span className="block text-[#4A5568]">{role}</span>
                          <span className="text-[11px] text-[#806236]">{email}</span>
                        </div>
                        <span className="rounded bg-[#FAF8F4] px-2 py-1 text-xs text-[#4A5568]">
                          Active
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {section === 'Notifications' && (
                <Card title="Notification & digest preferences">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="border-b border-[#E5E1D8] text-[#4A5568]">
                          <th className="py-2.5">Category</th>
                          <th className="py-2.5 text-center">In-app</th>
                          <th className="py-2.5 text-center">Email</th>
                          <th className="py-2.5 text-center">Push</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5E1D8]">
                        {NOTIF_CATEGORIES.map((cat, i) => (
                          <tr key={cat}>
                            <td className="py-2.5 font-medium text-ink">{cat}</td>
                            {[0, 1, 2].map((c) => (
                              <td key={c} className="py-2.5 text-center">
                                <input
                                  type="checkbox"
                                  aria-label={`${cat} ${['in-app', 'email', 'push'][c]}`}
                                  checked={notif[cat][c]}
                                  onChange={(e) => {
                                    const next = {...notif, [cat]: [...notif[cat]]};
                                    next[cat][c] = e.target.checked;
                                    setNotif(next);
                                  }}
                                  className="accent-ink"
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Button className="mt-4" disabled={notifLoading} onClick={saveNotif}>
                    {notifLoading ? 'Saving…' : 'Save preferences'}
                  </Button>
                </Card>
              )}

              {section === 'Privacy and visibility' && (
                <Card title="Profile visibility & discovery status">
                  <div className="space-y-4 text-xs">
                    <div>
                      <label htmlFor="vis-select" className="block font-medium text-ink">
                        Investor directory visibility
                      </label>
                      <select
                        id="vis-select"
                        value={profilePublic ? 'visible' : 'stealth'}
                        onChange={(e) => saveVisibility(e.target.value)}
                        className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs focus:border-ink focus:outline-none"
                      >
                        <option value="visible">Visible to startups I contact or who match my thesis</option>
                        <option value="public">Publicly discoverable by all verified startups</option>
                        <option value="stealth">Stealth mode (Hidden from discover directory)</option>
                      </select>
                    </div>
                  </div>
                </Card>
              )}

              {section === 'Investing preferences' && (
                <Card title="Investment thesis & match criteria">
                  <p className="text-xs text-[#4A5568] leading-relaxed">
                    Manage preferred sectors, stages (Pre-seed, Seed, Series A), ticket ranges and instruments in your dealflow feed.
                  </p>
                  <Button
                    className="mt-4"
                    onClick={() => notify('Preferences saved.')}
                  >
                    Update criteria
                  </Button>
                </Card>
              )}

              {section === 'Data room defaults' && (
                <Card title="Data room inspection preferences">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      notify('Data room defaults updated.');
                    }}
                    className="space-y-4 text-xs"
                  >
                    <div>
                      <label htmlFor="watermark-name" className="block font-medium text-ink">
                        Watermark display string
                      </label>
                      <input
                        id="watermark-name"
                        defaultValue="Arjun Mehta · Forma Ventures"
                        className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs focus:border-ink focus:outline-none"
                      />
                    </div>
                    <Button type="submit">Save defaults</Button>
                  </form>
                </Card>
              )}

              {section === 'Danger zone' && (
                <Card title="Danger zone">
                  <p className="text-xs text-[#4A5568] leading-relaxed">
                    Temporarily pause inbound founder requests or delete your investor account.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => notify('Inbound requests paused.')}
                      className="rounded-lg border border-[#E5E1D8] px-4 py-2 text-xs font-semibold text-ink hover:bg-[#FAF8F4]"
                    >
                      Pause inbound requests
                    </button>
                    <button
                      type="button"
                      onClick={() => setModal('delete-acc')}
                      className="rounded-lg border border-red-200 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                    >
                      Delete investor account
                    </button>
                  </div>
                </Card>
              )}
            </div>
          </div>

          <InvestorDisclaimer onLearnMore={() => notify('Platform disclaimer opened.')} />

          {/* Invite Member Modal */}
          {modal === 'invite-member' && (
            <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4 backdrop-blur-sm">
              <section
                role="dialog"
                aria-modal="true"
                className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
              >
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="serif text-xl font-bold text-ink">Invite team colleague</h2>
                  <button type="button" onClick={() => setModal('')}>
                    <X size={18} />
                  </button>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    notify(`Invitation sent to ${inviteEmail}.`);
                    setModal('');
                    setInviteEmail('');
                  }}
                  className="space-y-3"
                >
                  <div>
                    <label htmlFor="inv-email" className="block text-xs font-medium text-ink">
                      Colleague email address
                    </label>
                    <input
                      id="inv-email"
                      type="email"
                      required
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="colleague@formaventures.example"
                      className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-xs focus:border-ink focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="inv-role" className="block text-xs font-medium text-ink">
                      Role
                    </label>
                    <select
                      id="inv-role"
                      className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs focus:border-ink focus:outline-none"
                    >
                      <option>Associate (View & diligence only)</option>
                      <option>Partner (Diligence & term sheet drafting)</option>
                      <option>Admin (Full organization governance)</option>
                    </select>
                  </div>
                  <div className="flex justify-end gap-2 pt-3">
                    <button
                      type="button"
                      onClick={() => setModal('')}
                      className="rounded-lg border px-3 py-2 text-xs font-medium text-[#4A5568]"
                    >
                      Cancel
                    </button>
                    <Button type="submit">Send invitation</Button>
                  </div>
                </form>
              </section>
            </div>
          )}

          {/* Delete Account Modal */}
          {modal === 'delete-acc' && (
            <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4 backdrop-blur-sm">
              <section
                role="dialog"
                aria-modal="true"
                className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
              >
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="serif text-xl font-bold text-ink">Delete account</h2>
                  <button type="button" onClick={() => setModal('')}>
                    <X size={18} />
                  </button>
                </div>
                <p className="text-xs text-[#4A5568] leading-relaxed">
                  Active capital commitments, executed NDA records and signed SAFE agreements must be resolved with startups prior to deleting your institutional account.
                </p>
                <div className="mt-6 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setModal('')}
                    className="rounded-lg border px-3 py-2 text-xs font-medium text-[#4A5568]"
                  >
                    Close
                  </button>
                  <Button onClick={submitDeleteRequest}>Request deletion</Button>
                </div>
              </section>
            </div>
          )}
        </>
      );
    }}
    </InvestorShell>
  );
}
