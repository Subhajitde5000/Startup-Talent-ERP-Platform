'use client';
import {useEffect, useState} from 'react';
import Link from 'next/link';
import { StartupSidebar, Card } from '../../../components';
import {useAuth} from '@/lib/auth-context';
import {api, ApiError} from '@/lib/api/client';
import {
  Users,Search,Bell,ChevronDown,Check,ArrowUpRight,ArrowRight,Plus,
  LockKeyhole,CheckCircle2,Globe,MapPin,CalendarDays,FileText,Presentation,FileSpreadsheet,
  Upload,Save,Pencil,MessageCircle,Mail,Building2,MoreHorizontal,X,Menu
} from 'lucide-react';

// Editable form keys. name/summary/website/location/year come from the
// organization (Step 3b); the rest come from startup_profiles (Step 5a).
const emptyData = {
  name: '',
  summary: '',
  website: '',
  location: '',
  year: '',
  tagline: '',
  sector: '',
  business: '',
  problem: '',
  solution: '',
  market: '',
  legalEntity: ''
};

const VISIBILITY_OPTIONS = [
  {value: 'private', label: 'Private', desc: 'Only your team can see this profile.'},
  {value: 'mentors', label: 'Mentors only', desc: 'Visible to your assigned mentors.'},
  {
    value: 'mentors_and_investors',
    label: 'Mentors and investors',
    desc: 'Discoverable by approved mentors and investors.'
  },
  {value: 'public', label: 'Public', desc: 'Anyone with your link can discover this profile.'}
];

const STAGE_LABELS = {
  idea: 'Idea',
  prototype: 'Prototype',
  early_revenue: 'Early revenue',
  growth: 'Growth',
  mature: 'Mature'
};

const ROLE_LABELS = {owner: 'Founder', admin: 'Admin', member: 'Member', viewer: 'Viewer'};
const EDIT_ROLES = ['owner', 'admin', 'member'];

// FastAPI422 loc ['body', 'server_field'] -> form key.
const FORM_KEY_BY_SERVER = {
  city: 'location',
  founded_year: 'year',
  business_model: 'business',
  legal_entity: 'legalEntity'
};

function errorsFrom(err) {
  const out = {};
  if (err instanceof ApiError && Array.isArray(err.details)) {
    for (const d of err.details) {
      const loc = Array.isArray(d.loc) ? d.loc : [];
      const key = loc[loc.length - 1];
      if (typeof key === 'string') {
        const formKey = FORM_KEY_BY_SERVER[key] || key;
        if (!out[formKey]) out[formKey] = d.msg || 'Invalid value.';
      }
    }
  }
  return out;
}

export default function StartupProfile() {
  const [mobile, setMobile] = useState(false);
  const [compact, setCompact] = useState(false);
  const [view, setView] = useState('Edit');
  const [data, setData] = useState(emptyData);
  const [saved, setSaved] = useState(emptyData);
  const [dirty, setDirty] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [visibility, setVisibility] = useState('mentors_and_investors');
  const [shares, setShares] = useState({traction: true, funding: false, contacts: false});
  const [toast, setToast] = useState('');
  const [menu, setMenu] = useState(false);
  const [docs, setDocs] = useState([
    {name: 'Pitch deck v3.pdf', size: '4.2 MB', access: 'Investors after NDA', updated: 'Today'},
    {name: 'Financial model.xlsx', size: '1.8 MB', access: 'Private', updated: 'Yesterday'},
    {name: 'Product brief.pdf', size: '2.1 MB', access: 'Public', updated: 'Oct 30'}
  ]);

  // Step 5a: organization (Step 3b) + startup profile + members (Step 3).
  const {user} = useAuth();
  const [org, setOrg] = useState(null);
  const [orgId, setOrgId] = useState(null);
  const [orgStatus, setOrgStatus] = useState('loading'); // loading | ready | none | error
  const [newOrgName, setNewOrgName] = useState('');
  const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState(null); // StartupProfileRead
  const [profileStatus, setProfileStatus] = useState('loading'); // loading | ready | error
  const [members, setMembers] = useState([]);
  const [membersStatus, setMembersStatus] = useState('loading'); // loading | ready | error
  const [preview, setPreview] = useState(null); // StartupProfilePublicRead
  const [previewStatus, setPreviewStatus] = useState('idle'); // idle | loading | ready | error

  const canEdit = !!org && EDIT_ROLES.includes(org.my_role);

  const notify = t => {
    setToast(t);
    setTimeout(() => setToast(''), 2500);
  };

  const formFrom = (orgRow, prof) => ({
    name: orgRow.name || '',
    summary: orgRow.summary || '',
    website: orgRow.website || '',
    location: orgRow.city || '',
    year: orgRow.founded_year ? String(orgRow.founded_year) : '',
    tagline: prof?.tagline || '',
    sector: prof?.sector || '',
    business: prof?.business_model || '',
    problem: prof?.problem || '',
    solution: prof?.solution || '',
    market: prof?.market || '',
    legalEntity: prof?.legal_entity || ''
  });

  const applyProfileState = prof => {
    setProfile(prof);
    setVisibility(prof.profile_visibility);
    setShares({
      traction: prof.traction_public,
      funding: prof.funding_public,
      contacts: prof.contacts_public
    });
  };

  const hydrate = (orgRow, prof) => {
    setOrg(orgRow);
    setOrgId(orgRow.id);
    const form = formFrom(orgRow, prof);
    setData(form);
    setSaved(form);
    applyProfileState(prof);
    setProfileStatus('ready');
    setOrgStatus('ready');
  };

  const loadMembers = async id => {
    setMembersStatus('loading');
    try {
      const rows = await api.organizations.members(id);
      setMembers(rows);
      setMembersStatus('ready');
    } catch {
      setMembersStatus('error');
    }
  };

  const load = async () => {
    setOrgStatus('loading');
    setProfileStatus('loading');
    let startup = null;
    try {
      const orgs = await api.organizations.mine();
      startup = orgs.find(o => o.type === 'startup') || null;
    } catch (err) {
      setOrgStatus('error');
      notify(err instanceof ApiError ? err.message : 'Could not load your organization.');
      return;
    }
    if (!startup) {
      setOrgStatus('none');
      return;
    }
    setOrg(startup);
    setOrgId(startup.id);
    setOrgStatus('ready');
    try {
      const prof = await api.startupProfile.get(startup.id);
      hydrate(startup, prof);
    } catch (err) {
      setProfileStatus('error');
      notify(err instanceof ApiError ? err.message : 'Could not load your startup profile.');
      return;
    }
    loadMembers(startup.id);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const loadPreview = async () => {
    if (!orgId) return;
    setPreviewStatus('loading');
    try {
      const p = await api.startupProfile.preview(orgId);
      setPreview(p);
      setPreviewStatus('ready');
    } catch (err) {
      setPreviewStatus('error');
      notify(err instanceof ApiError ? err.message : 'Could not load the preview.');
    }
  };

  useEffect(() => {
    if (view === 'Public preview' && orgId) loadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, orgId]);

  const createOrg = async () => {
    if (busy || !newOrgName.trim()) return;
    setBusy(true);
    try {
      await api.organizations.create({name: newOrgName.trim(), type: 'startup'});
      notify('Organization created.');
      await load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not create the organization.');
    } finally {
      setBusy(false);
    }
  };

  const edit = (key, value) => {
    setData({...data, [key]: value});
    setDirty(true);
    if (fieldErrors[key]) {
      const next = {...fieldErrors};
      delete next[key];
      setFieldErrors(next);
    }
  };

  const save = async () => {
    if (busy || !orgId) return;
    setBusy(true);
    setFieldErrors({});
    try {
      const orgPayload = {
        name: data.name,
        summary: data.summary || null,
        website: data.website || null,
        city: data.location || null
      };
      if (/^\d{4}$/.test(String(data.year))) orgPayload.founded_year = Number(data.year);
      const orgRow = await api.organizations.update(orgId, orgPayload);
      const prof = await api.startupProfile.update(orgId, {
        tagline: data.tagline || null,
        sector: data.sector || null,
        business_model: data.business || null,
        problem: data.problem || null,
        solution: data.solution || null,
        market: data.market || null,
        legal_entity: data.legalEntity || null
      });
      hydrate(orgRow, prof);
      setDirty(false);
      notify('Profile updated.');
      if (previewStatus === 'ready') loadPreview();
    } catch (err) {
      const errs = errorsFrom(err);
      if (Object.keys(errs).length) setFieldErrors(errs);
      notify(err instanceof ApiError ? err.message : 'Could not save the profile.');
    } finally {
      setBusy(false);
    }
  };

  const discard = () => {
    setData(saved);
    setFieldErrors({});
    setDirty(false);
    notify('Changes discarded.');
  };

  // Visibility and share toggles apply immediately (as the card promises).
  const patchProfile = async fields => {
    if (!orgId || !canEdit) return null;
    try {
      const prof = await api.startupProfile.update(orgId, fields);
      applyProfileState(prof);
      if (previewStatus === 'ready') loadPreview();
      return prof;
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not update sharing settings.');
      return null;
    }
  };

  const setVisibilityValue = async value => {
    const prev = visibility;
    setVisibility(value);
    const prof = await patchProfile({profile_visibility: value});
    if (!prof) setVisibility(prev);
  };

  const setShareValue = async key => {
    const serverField = {traction: 'traction_public', funding: 'funding_public', contacts: 'contacts_public'}[key];
    const prev = shares;
    const next = {...shares, [key]: !shares[key]};
    setShares(next);
    const prof = await patchProfile({[serverField]: next[key]});
    if (!prof) setShares(prev);
  };

  const isEdit = view === 'Edit';

  const field = (label, key, opts = {}) => {
    const err = opts.error || fieldErrors[key];
    return (
      <label key={key} className="block text-sm font-medium text-ink">
        {label}
        {opts.area ? (
          <textarea
            value={data[key]}
            onChange={e => edit(key, e.target.value)}
            maxLength={opts.max}
            rows={opts.rows || 4}
            disabled={!canEdit}
            className="mt-2 w-full rounded-[10px] border border-[#E5E1D8] bg-white p-3 text-sm font-normal leading-6 outline-none focus:border-[#B8955A] focus:ring-2 focus:ring-[#B8955A]/20 disabled:bg-[#FAF8F4]"
          />
        ) : (
          <input
            value={data[key]}
            onChange={e => edit(key, e.target.value)}
            maxLength={opts.max}
            disabled={!canEdit}
            className="mt-2 h-11 w-full rounded-[10px] border border-[#E5E1D8] bg-white px-3 text-sm font-normal outline-none focus:border-[#B8955A] focus:ring-2 focus:ring-[#B8955A]/20 disabled:bg-[#FAF8F4]"
          />
        )}
        {err ? (
          <small className="mt-1 block text-left font-normal text-red-600">{err}</small>
        ) : (
          opts.max && (
            <small className="mt-1 block text-right font-normal text-[#4A5568]">
              {(data[key] || '').length}/{opts.max}
            </small>
          )
        )}
      </label>
    );
  };

  const initials = (user?.display_name || '?')
    .split(' ')
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const memberInitials = m =>
    (m.avatar_initials ||
      (m.display_name || '')
        .split(' ')
        .map(w => w[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase()) ||
    '?';

  // Profile completeness from real signals (logo, members, deck, verification).
  const completenessItems = [
    ['Add a logo', !!org?.logo_url],
    ['Add 2 team members', members.length >= 2],
    ['Upload pitch deck', !!profile?.pitch_deck_url],
    ['Verify legal details', !!org?.verified_at]
  ];
  const completenessDone = completenessItems.filter(([, ok]) => ok).length;
  const completenessPct = Math.round((completenessDone / completenessItems.length) * 100);

  const fundingLines = [
    ['Target raise', profile?.target_raise],
    ['Actively raising', profile?.actively_raising],
    ['Funding status', profile?.funding_status]
  ].filter(([, v]) => v);

  const keyFacts = isEdit
    ? [
        ['Stage', profile ? STAGE_LABELS[profile.stage] : '—'],
        ['Readiness', profile?.readiness_score != null ? `${profile.readiness_score} / 100` : '—'],
        ['Founded', data.year || '—'],
        ['Location', data.location || '—'],
        ['Sector', data.sector || '—'],
        ['Business model', data.business || '—']
      ]
    : [
        ['Stage', preview?.stage ? STAGE_LABELS[preview.stage] : '—'],
        ['Readiness', '—'],
        ['Founded', preview?.founded_year ? String(preview.founded_year) : '—'],
        ['Location', preview?.city || '—'],
        ['Sector', preview?.sector || '—'],
        ['Business model', preview?.business_model || '—']
      ];

  return (
    <div className="min-h-screen bg-[#FAF8F4] text-[#0F1B2D]">
      <a href="#profile-main" className="sr-only focus:not-sr-only">
        Skip to content
      </a>

      {/* Shared Startup Sidebar */}
      <StartupSidebar
        active="Startup profile"
        compact={compact}
        setCompact={setCompact}
        mobileOpen={mobile}
        setMobileOpen={setMobile}
        onAction={notify}
      />

      {/* Header */}
      <header className={`sticky top-0 z-10 flex h-[68px] items-center justify-between border-b border-[#E5E1D8] bg-[#FAF8F4]/95 px-4 backdrop-blur transition-[margin] duration-200 sm:px-7 ${compact ? 'lg:ml-[76px]' : 'lg:ml-[240px]'}`}>
        <div className="flex items-center gap-3">
          <button type="button" className="lg:hidden" onClick={() => setMobile(!mobile)} aria-label="Open menu">
            {mobile ? <X size={20} /> : <Menu size={20} />}
          </button>
          <Link href="/startup/dashboard" className="text-sm font-semibold sm:hidden">
            ← Dashboard
          </Link>
          <div className="relative hidden sm:block">
            <Search className="absolute left-3 top-2.5 text-[#A0A7B4]" size={17} />
            <input placeholder="Search anything…" className="h-10 w-64 rounded-lg border border-[#E5E1D8] bg-white pl-9 text-sm" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => notify('You’re all caught up.')} aria-label="Notifications" className="relative ml-auto grid h-10 w-10 place-items-center">
            <Bell size={19} />
            <i className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#B8955A]" />
          </button>
          <button type="button" onClick={() => setMenu(!menu)} className="ml-3 flex items-center gap-2 rounded-lg p-1.5">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-ink text-xs font-semibold text-white">{initials}</span>
            <span className="hidden text-xs sm:block">{user?.display_name || '…'}</span>
            <ChevronDown size={14} />
          </button>
          {menu && (
            <div className="absolute right-4 top-14 rounded-lg border bg-white p-3 text-sm shadow-lg">
              {ROLE_LABELS[org?.my_role] || user?.role || 'Member'} · {org?.name || 'Your startup'}
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main id="profile-main" className={`mx-auto max-w-[1440px] px-4 pb-24 pt-7 transition-[margin] duration-200 sm:px-7 lg:px-8 ${compact ? 'lg:ml-[76px]' : 'lg:ml-[240px]'}`}>
        {orgStatus === 'loading' && (
          <div className="flex items-center gap-3 rounded-[10px] border border-[#E5E1D8] bg-white p-6 text-sm text-[#4A5568]">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/30 border-t-ink" />
            Loading your organization…
          </div>
        )}
        {orgStatus === 'error' && (
          <div className="rounded-[10px] border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            Could not load your organization.{' '}
            <button type="button" onClick={load} className="font-semibold underline">
              Retry
            </button>
          </div>
        )}
        {orgStatus === 'none' && (
          <div className="max-w-xl rounded-[10px] border border-[#E5E1D8] bg-white p-6">
            <h2 className="serif text-xl font-semibold">Create your startup organization</h2>
            <p className="mt-1 text-sm text-[#4A5568]">
              Your profile, team and jobs live under one organization. You can rename and
              complete it any time.
            </p>
            <div className="mt-4 flex gap-2">
              <input
                value={newOrgName}
                onChange={e => setNewOrgName(e.target.value)}
                placeholder="Organization name"
                className="h-11 flex-1 rounded-[10px] border border-[#E5E1D8] px-3 text-sm outline-none focus:border-[#B8955A]"
              />
              <button
                type="button"
                onClick={createOrg}
                disabled={busy || !newOrgName.trim()}
                className="h-11 rounded-[10px] bg-ink px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busy ? 'Creating…' : 'Create organization'}
              </button>
            </div>
          </div>
        )}
        {orgStatus === 'ready' && profileStatus === 'loading' && (
          <div className="flex items-center gap-3 rounded-[10px] border border-[#E5E1D8] bg-white p-6 text-sm text-[#4A5568]">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/30 border-t-ink" />
            Loading your startup profile…
          </div>
        )}
        {orgStatus === 'ready' && profileStatus === 'error' && (
          <div className="rounded-[10px] border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            Could not load your startup profile.{' '}
            <button type="button" onClick={load} className="font-semibold underline">
              Retry
            </button>
          </div>
        )}
        {orgStatus === 'ready' && profileStatus === 'ready' && (
        <>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-[#4A5568]">
              Startup workspace <span className="mx-2 text-[#B8955A]">·</span> Profile
            </p>
            <h1 className="serif mt-1 text-3xl font-semibold">Startup profile</h1>
            <p className="mt-1 text-sm text-[#4A5568]">Keep your story, details and sharing preferences up to date.</p>
          </div>
          <div className="flex items-center gap-2">
            <div role="tablist" aria-label="Profile view" className="flex rounded-[10px] border border-[#E5E1D8] bg-white p-1">
              <button
                type="button"
                role="tab"
                aria-selected={isEdit}
                onClick={() => setView('Edit')}
                className={`min-h-9 rounded-lg px-4 text-sm ${isEdit ? 'bg-ink font-semibold text-white' : 'text-[#4A5568]'}`}
              >
                Edit
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={!isEdit}
                onClick={() => setView('Public preview')}
                className={`min-h-9 rounded-lg px-4 text-sm ${!isEdit ? 'bg-ink font-semibold text-white' : 'text-[#4A5568]'}`}
              >
                Public preview
              </button>
            </div>
            {isEdit && canEdit && (
              <>
                <button type="button" onClick={discard} disabled={!dirty} className="hidden min-h-10 px-3 text-sm text-[#4A5568] disabled:opacity-40 sm:block">
                  Discard
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={!dirty || busy}
                  className="inline-flex min-h-10 items-center gap-2 rounded-[9px] bg-ink px-4 text-sm font-semibold text-white hover:bg-[#1C2B42] disabled:opacity-45"
                >
                  <Save size={16} /> {busy ? 'Saving…' : 'Save changes'}
                </button>
              </>
            )}
          </div>
        </div>

        {isEdit && !canEdit && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-[#E5E1D8] bg-white px-4 py-2.5 text-sm text-[#4A5568]" role="status">
            <LockKeyhole size={16} /> You have view-only access to this profile.
          </div>
        )}

        {dirty && isEdit && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-[#E7D4B0] bg-[#F3EBDD] px-4 py-2.5 text-sm text-[#806236]" role="status">
            You have unsaved changes <span className="ml-auto text-xs">Draft changes</span>
          </div>
        )}
        {!isEdit && preview?.visibility === 'private' && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-[#E5E1D8] bg-[#F3EBDD] p-3 text-sm">
            <LockKeyhole size={17} />This profile is private. Only your team can see it.
          </div>
        )}
        {!isEdit && preview && !preview.visible_to_public && preview.visibility !== 'private' && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-[#E5E1D8] bg-[#F3EBDD] p-3 text-sm">
            <LockKeyhole size={17} />
            Only {preview.visibility === 'mentors' ? 'your mentors' : 'mentors and investors'} can discover this profile right now.
          </div>
        )}
        {!isEdit && previewStatus === 'loading' && (
          <div className="mb-4 flex items-center gap-3 rounded-[10px] border border-[#E5E1D8] bg-white p-4 text-sm text-[#4A5568]">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/30 border-t-ink" />
            Loading public preview…
          </div>
        )}
        {!isEdit && previewStatus === 'error' && (
          <div className="mb-4 rounded-[10px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Could not load the public preview.{' '}
            <button type="button" onClick={loadPreview} className="font-semibold underline">Retry</button>
          </div>
        )}

        <section className="mb-6 overflow-hidden rounded-xl border border-[#E5E1D8] bg-white">
          <div className="relative h-32 bg-[#0F1B2D] sm:h-40">
            <div className="absolute inset-x-0 bottom-0 h-[2px] bg-[#B8955A]" />
            {isEdit && (
              <button
                type="button"
                onClick={() => notify('Cover image upload is ready to connect.')}
                className="absolute right-4 top-4 inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/30 bg-ink/70 px-3 text-xs text-white"
              >
                <Upload size={15} /> Edit cover
              </button>
            )}
          </div>
          <div className="px-5 pb-5 sm:px-7">
            <div className="-mt-12 flex flex-wrap items-end gap-4">
              <button
                type="button"
                onClick={() => isEdit && notify('Logo upload is ready to connect.')}
                aria-label="Upload startup logo"
                className="grid h-24 w-24 shrink-0 place-items-center rounded-2xl border-4 border-white bg-[#F3EBDD] text-3xl font-bold text-ink shadow-sm"
              >
                {(org?.logo_initials || org?.name || 'S').charAt(0).toUpperCase()}
              </button>
              <div className="min-w-[220px] flex-1 pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="serif text-[30px] font-semibold">{isEdit ? data.name : preview?.name || data.name}</h2>
                  {org?.verified_at && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#E7F3EC] px-2.5 py-1 text-[11px] font-semibold text-[#286749]">
                      <CheckCircle2 size={13} /> Verified startup
                    </span>
                  )}
                </div>
                {isEdit
                  ? field('Tagline', 'tagline', {max: 100})
                  : <p className="mt-1 text-sm text-[#4A5568]">{preview?.tagline || 'No tagline yet.'}</p>}
              </div>
              <div className="flex gap-2 pb-1">
                {isEdit ? (
                  <span className="rounded-full bg-[#F3EBDD] px-3 py-1.5 text-xs font-semibold text-[#806236]">
                    Stage: {profile ? STAGE_LABELS[profile.stage] : '…'}
                  </span>
                ) : (
                  <>
                    <button type="button" onClick={() => notify('Intro request started.')} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-ink px-3 text-xs font-semibold text-white">
                      <MessageCircle size={15} /> Request intro
                    </button>
                    <button type="button" onClick={() => notify('Startup saved to shortlist.')} className="min-h-10 rounded-lg border border-[#E5E1D8] px-3 text-xs font-semibold">
                      Shortlist
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-[#E5E1D8] pt-4 text-xs text-[#4A5568]">
              <span className="inline-flex items-center gap-1.5"><Building2 size={14} />{isEdit ? data.sector || 'Sector' : preview?.sector || 'Sector'}</span>
              <span className="inline-flex items-center gap-1.5"><MapPin size={14} />{isEdit ? data.location || 'Location' : preview?.city || 'Location'}</span>
              <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} />Founded {(isEdit ? data.year : preview?.founded_year) || '—'}</span>
              {(isEdit || (preview?.visible_to_public && profile?.team_public)) && (
                <span className="inline-flex items-center gap-1.5"><Users size={14} />{members.length} team member{members.length === 1 ? '' : 's'}</span>
              )}
            </div>
          </div>
        </section>

        <div className="grid items-start gap-5 xl:grid-cols-3">
          <div className="space-y-5 xl:col-span-2">
            <Card title="About & pitch summary" action={isEdit ? <Pencil size={16} className="text-[#9A7A45]" /> : null}>
              <div className="space-y-4">
                {isEdit ? (
                  <>
                    {field('Pitch summary', 'summary', {area: true, max: 1200, rows: 5})}
                    <button type="button" onClick={() => notify('AI writing suggestions will be available soon.')} className="text-xs font-semibold text-[#9A7A45]">
                      Improve with AI (optional)
                    </button>
                  </>
                ) : preview?.summary ? (
                  <p className="text-sm leading-7 text-[#4A5568]">{preview.summary}</p>
                ) : (
                  <p className="text-sm leading-7 text-[#4A5568]">Your pitch summary isn’t shared on the public profile yet.</p>
                )}
              </div>
            </Card>

            <Card title="Problem, solution & market">
              {isEdit ? (
                <div className="grid gap-4 md:grid-cols-3">
                  {field('Problem', 'problem', {area: true, rows: 5})}
                  {field('Solution', 'solution', {area: true, rows: 5})}
                  {field('Target customer & market', 'market', {area: true, rows: 5})}
                </div>
              ) : preview?.problem != null ? (
                <div className="grid gap-4 md:grid-cols-3">
                  {[
                    ['Problem', preview.problem],
                    ['Solution', preview.solution],
                    ['Target customer & market', preview.market]
                  ].map(([h, t]) => (
                    <div key={h} className="rounded-lg bg-[#FAF8F4] p-4">
                      <h3 className="mb-2 text-sm font-semibold">{h}</h3>
                      <p className="text-sm leading-6 text-[#4A5568]">{t || '—'}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[#4A5568]">Problem, solution and market aren’t shared on the public profile yet.</p>
              )}
            </Card>

            <Card
              title="Traction highlights"
              action={
                isEdit ? (
                  <button type="button" onClick={() => notify('Metric editing opens with the analytics step.')} className="text-xs font-semibold text-[#9A7A45]">
                    <Plus className="inline" size={15} /> Add metric
                  </button>
                ) : null
              }
            >
              <div className="rounded-lg border border-dashed border-[#E5E1D8] bg-[#FAF8F4] p-6 text-center text-sm text-[#4A5568]">
                No traction metrics yet. Metrics appear here once tracking is connected.
              </div>
              <p className="mt-3 text-xs text-[#4A5568]">Metrics are shared according to your visibility settings.</p>
            </Card>

            <Card
              id="team-section"
              title="Team"
              action={
                isEdit ? (
                  <Link href="/startup/team" className="text-sm font-semibold text-[#9A7A45]">
                    <Plus className="inline" size={15} /> Invite member
                  </Link>
                ) : null
              }
            >
              {!isEdit && !preview?.visible_to_public ? null : !isEdit && !profile?.team_public ? (
                <p className="text-sm text-[#4A5568]">Team details aren’t shared on your public profile.</p>
              ) : membersStatus === 'loading' ? (
                <div className="flex items-center gap-3 text-sm text-[#4A5568]">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/30 border-t-ink" />
                  Loading team…
                </div>
              ) : membersStatus === 'error' ? (
                <p className="text-sm text-red-700">
                  Could not load the team.{' '}
                  <button type="button" onClick={() => loadMembers(orgId)} className="font-semibold underline">Retry</button>
                </p>
              ) : members.length === 0 ? (
                <p className="text-sm text-[#4A5568]">No teammates yet — invite someone from the team page.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {members.map(m => (
                    <div key={m.user_id} className="flex items-start gap-3 rounded-lg border border-[#E5E1D8] p-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#F3EBDD] text-xs font-semibold">{memberInitials(m)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{m.display_name}</p>
                        <p className="text-xs text-[#9A7A45]">{m.title || ROLE_LABELS[m.role] || m.role}</p>
                        {m.email && <p className="mt-1 truncate text-xs text-[#4A5568]">{m.email}</p>}
                      </div>
                      {isEdit && canEdit && (
                        <button type="button" aria-label={`Edit ${m.display_name}`} onClick={() => notify('Member editing lives on the team page.')}>
                          <MoreHorizontal size={17} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {isEdit && (
                <Link href="/startup/hiring" className="mt-4 inline-block rounded-full bg-[#F3EBDD] px-3 py-1.5 text-xs font-semibold text-[#806236]">
                  Hiring
                </Link>
              )}
            </Card>

            <Card id="documents-section" title="Documents & data room">
              <div className="mb-3 rounded-lg bg-[#FAF8F4] p-3 text-xs text-[#4A5568]">
                <LockKeyhole className="mr-1 inline" size={13} /> Investors must accept a confidentiality agreement before viewing protected documents.
              </div>
              <div className="divide-y divide-[#E5E1D8]">
                {docs.map((doc, i) => (
                  <div key={doc.name} className="flex flex-wrap items-center gap-3 py-3">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#F3EBDD] text-[#806236]">
                      {i === 0 ? <Presentation size={17} /> : i === 1 ? <FileSpreadsheet size={17} /> : <FileText size={17} />}
                    </span>
                    <span className="min-w-[130px] flex-1">
                      <b className="block text-sm">{doc.name}</b>
                      <small className="text-xs text-[#4A5568]">{doc.size} · Updated {doc.updated}</small>
                    </span>
                    <span className="rounded-full bg-[#F3F4F6] px-2.5 py-1 text-[10px] font-medium text-[#4A5568]">{doc.access}</span>
                    {isEdit ? (
                      <button
                        type="button"
                        aria-label="Change access"
                        onClick={() => setDocs(docs.map((d, n) => (n === i ? {...d, access: d.access === 'Private' ? 'Public' : 'Private'} : d)))}
                      >
                        <MoreHorizontal size={17} />
                      </button>
                    ) : (
                      <button type="button" onClick={() => notify(doc.access === 'Private' ? 'This file is private.' : 'Access request sent.')} className="text-xs font-semibold text-[#9A7A45]">
                        {doc.access === 'Private' ? 'Locked' : 'Request access'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {isEdit && (
                <Link href="/startup/data-room" className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#E5E1D8] px-3 text-sm font-medium">
                  <Upload size={15} /> Upload document
                </Link>
              )}
            </Card>

            {isEdit && (
              <Card title="Funding & use of funds">
                {fundingLines.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[#E5E1D8] bg-[#FAF8F4] p-6 text-center text-sm text-[#4A5568]">
                    No funding details yet. They’ll appear here once you add them during onboarding or set up a round.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {fundingLines.map(([label, value]) => (
                      <p key={label} className="text-sm">
                        <span className="text-[#4A5568]">{label}</span>
                        <b className="float-right">{value}</b>
                      </p>
                    ))}
                    <p className="text-xs text-[#4A5568]">
                      Rounds, commitments and use of funds arrive with the fundraising workspace.
                    </p>
                  </div>
                )}
              </Card>
            )}

            {isEdit && (
              <Card title="Legal & company details" action={org?.verified_at ? <span className="rounded-full bg-[#E7F3EC] px-2.5 py-1 text-xs font-medium text-[#286749]">Verified</span> : null}>
                <div className="grid gap-4 sm:grid-cols-2">
                  {field('Registered company name', 'name')}
                  {field('Entity type', 'legalEntity')}
                  {field('Incorporation year', 'year')}
                  {field('Website', 'website')}
                </div>
                <div className="mt-4 rounded-lg bg-[#FFF8E8] p-3 text-xs leading-5 text-[#806236]">
                  Legal details are never shown publicly.
                </div>
              </Card>
            )}
          </div>

          <aside className="space-y-5">
            <Card title="Profile completeness">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="serif text-3xl font-semibold">{completenessPct}%</span>
                <span className="text-xs text-[#4A5568]">{completenessPct >= 75 ? 'Good progress' : completenessPct > 0 ? 'Keep going' : 'Getting started'}</span>
              </div>
              <div className="h-2 rounded-full bg-[#E5E1D8]">
                <div className="h-full rounded-full bg-[#B8955A] transition-all" style={{width: `${completenessPct}%`}} />
              </div>
              <div className="mt-4 space-y-3">
                {completenessItems.map(([t, ok]) => (
                  <button
                    type="button"
                    key={t}
                    onClick={() => document.getElementById(ok ? 'team-section' : 'documents-section')?.scrollIntoView({behavior: 'smooth'})}
                    className="flex w-full items-center gap-2 text-left text-xs"
                  >
                    <span className={`grid h-4 w-4 place-items-center rounded-full ${ok ? 'bg-[#E7F3EC] text-[#2E7D5B]' : 'border border-[#E5E1D8]'}`}>
                      {ok && <Check size={11} />}
                    </span>
                    <span className={ok ? 'text-[#4A5568] line-through' : 'text-[#9A7A45]'}>{t}</span>
                    <ArrowUpRight className="ml-auto" size={13} />
                  </button>
                ))}
              </div>
            </Card>

            {isEdit && (
              <Card title="Visibility & sharing">
                <fieldset>
                  <legend className="mb-3 text-xs leading-5 text-[#4A5568]">Choose who can discover your startup</legend>
                  {VISIBILITY_OPTIONS.map(opt => (
                    <label key={opt.value} className="mb-3 flex cursor-pointer items-start gap-2.5 text-sm">
                      <input
                        type="radio"
                        name="visibility"
                        value={opt.value}
                        checked={visibility === opt.value}
                        disabled={!canEdit}
                        onChange={() => setVisibilityValue(opt.value)}
                        className="mt-0.5 accent-ink"
                      />
                      <span>
                        <b className="block text-[13px]">{opt.label}</b>
                        <small className="text-xs text-[#4A5568]">{opt.desc}</small>
                      </span>
                    </label>
                  ))}
                </fieldset>
                <div className="my-3 border-t border-[#E5E1D8] pt-3">
                  <p className="mb-3 text-xs font-semibold">Share these details</p>
                  {[
                    ['traction', 'Traction numbers'],
                    ['funding', 'Funding details'],
                    ['contacts', 'Team contacts']
                  ].map(([key, label]) => (
                    <label key={key} className="mb-3 flex items-center justify-between text-xs">
                      <span>{label}</span>
                      <input
                        type="checkbox"
                        checked={shares[key]}
                        disabled={!canEdit}
                        onChange={() => setShareValue(key)}
                        className="h-4 w-4 accent-ink"
                      />
                    </label>
                  ))}
                </div>
                <p className="text-[11px] leading-5 text-[#4A5568]">Changes apply immediately. Hide your profile at any time.</p>
                <button
                  type="button"
                  onClick={() => { setView('Public preview'); window.scrollTo({top: 0, behavior: 'smooth'}); }}
                  className="mt-3 text-xs font-semibold text-[#9A7A45]"
                >
                  Preview as investor <ArrowRight className="inline" size={13} />
                </button>
              </Card>
            )}

            <Card title="Key facts">
              <dl className="space-y-3 text-xs">
                {keyFacts.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt className="text-[#4A5568]">{k}</dt>
                    <dd className="text-right font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            </Card>

            <Card title="Your mentor">
              <p className="text-sm text-[#4A5568]">No mentor yet. Find one from the mentors workspace to start reviewing your stage criteria.</p>
              <Link href="/startup/mentors" className="mt-3 inline-block text-xs font-semibold text-[#9A7A45]">
                View mentor workspace <ArrowRight className="inline" size={13} />
              </Link>
            </Card>

            <Card title="Contact">
              <div className="space-y-3 text-xs">
                <p>
                  <Globe className="mr-2 inline text-[#9A7A45]" size={14} />
                  {(isEdit ? data.website : preview?.website) || 'No website yet'}
                </p>
                {isEdit ? (
                  <>
                    <p>
                      <Mail className="mr-2 inline text-[#9A7A45]" size={14} />{user?.primary_email || '—'}
                    </p>
                    <p className="text-[#4A5568]">{user?.phone || 'No phone number added'}</p>
                  </>
                ) : (
                  <p className="text-[#4A5568]">Use platform messaging to contact this startup.</p>
                )}
              </div>
              {!isEdit && (
                <button type="button" onClick={() => notify('Message composer opened.')} className="mt-4 min-h-10 w-full rounded-lg bg-ink text-sm font-semibold text-white">
                  Message startup
                </button>
              )}
            </Card>
          </aside>
        </div>

        {!isEdit && <p className="mt-6 text-center text-xs text-[#4A5568]">Forma introduces parties and is not a broker or adviser.</p>}
        </>
        )}
      </main>

      {dirty && isEdit && canEdit && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between border-t border-[#E5E1D8] bg-white p-3 shadow-lg sm:hidden">
          <span className="text-xs text-[#4A5568]">Unsaved changes</span>
          <div className="flex gap-2">
            <button type="button" onClick={discard} className="px-3 text-sm">
              Discard
            </button>
            <button type="button" onClick={save} className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white">
              Save
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div role="status" aria-live="polite" className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-ink px-4 py-3 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
