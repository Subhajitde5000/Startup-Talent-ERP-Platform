'use client';

import React, { ChangeEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight, BriefcaseBusiness, Check, CheckCircle2, ChevronDown, CircleHelp,
  FileText, Globe2, ImagePlus, Info, LockKeyhole, Mail, MapPin, MessageSquare,
  Pencil, Plus, Save, Shield, ShieldCheck, Users, X,
} from 'lucide-react';
import { useStartupWorkspace } from '@/context/StartupWorkspaceContext';
import { STARTUP_PROFILE_DRAFT_KEY, STARTUP_PROFILE_KEY } from '@/lib/startupProfileStorage';
import styles from './StartupProfile.module.css';

type Visibility = 'private' | 'mentors' | 'mentors-investors';
type PreviewRole = 'investor' | 'mentor';
type ProfileDraft = {
  name: string; tagline: string; oneLiner: string; pitch: string; problem: string;
  solution: string; targetMarket: string; businessModel: string; location: string;
  website: string; phone: string; logoData: string; visibility: Visibility;
  shareTraction: boolean; shareFunding: boolean; shareTeamContacts: boolean;
  mrr: string; customers: string; growth: string; pilots: string;
  publicMetrics: string[]; fundingRound: string; targetRaise: string;
  committed: string; minimumTicket: string; productUse: string; hiringUse: string;
  marketingUse: string; operationsUse: string; registeredName: string;
  entityType: string; registrationNumber: string; incorporationDate: string;
  registeredAddress: string;
};
const METRICS = [
  { id: 'mrr', label: 'Monthly recurring revenue', key: 'mrr' as const },
  { id: 'customers', label: 'Customers', key: 'customers' as const },
  { id: 'growth', label: 'Growth MoM', key: 'growth' as const },
  { id: 'pilots', label: 'Active pilots', key: 'pilots' as const },
];
function createProfile(startup: ReturnType<typeof useStartupWorkspace>['data']['startup']): ProfileDraft {
  return {
    name: startup.name, tagline: startup.tagline, oneLiner: '', pitch: '', problem: '', solution: '',
    targetMarket: '', businessModel: '', location: '', website: '', phone: '', logoData: '',
    visibility: 'private', shareTraction: false, shareFunding: false, shareTeamContacts: false,
    mrr: '', customers: '', growth: '', pilots: '', publicMetrics: [], fundingRound: '',
    targetRaise: '', committed: '', minimumTicket: '', productUse: '', hiringUse: '',
    marketingUse: '', operationsUse: '', registeredName: '', entityType: '',
    registrationNumber: '', incorporationDate: '', registeredAddress: '',
  };
}
function initials(name: string) { return name.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase(); }
function Field({ label, value, onChange, maxLength, placeholder, multiline = false, type = 'text', hint, readOnly = false, id }: {
  label: string; value: string; onChange: (value: string) => void; maxLength?: number;
  placeholder?: string; multiline?: boolean; type?: string; hint?: string; readOnly?: boolean; id?: string;
}) {
  return <label className={styles.field}><span className={styles.fieldLabel}>{label}</span>{multiline ? <textarea value={value} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={4} readOnly={readOnly} id={id} /> : <input id={id} type={type} value={value} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} readOnly={readOnly} />}{(maxLength || hint) && <span className={styles.fieldHint}>{hint}<span>{maxLength ? `${value.length}/${maxLength}` : ''}</span></span>}</label>;
}
function SectionHeading({ title, description, edit, onEdit }: { title: string; description?: string; edit: boolean; onEdit?: () => void }) {
  return <div className={styles.sectionHeading}><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{edit && onEdit && <button type="button" className={styles.editIconButton} onClick={onEdit} aria-label={`Edit ${title}`}><Pencil size={15} /></button>}</div>;
}

export default function StartupProfilePage() {
  const { data, updateStartupIdentity } = useStartupWorkspace();
  const [view, setView] = useState<'edit' | 'preview'>('edit');
  const [previewRole, setPreviewRole] = useState<PreviewRole>('investor');
  const [form, setForm] = useState<ProfileDraft>(() => createProfile(data.startup));
  const [saved, setSaved] = useState<ProfileDraft>(() => createProfile(data.startup));
  const [hydrated, setHydrated] = useState(false);
  const [notice, setNotice] = useState('');
  const [saveState, setSaveState] = useState('Saved to this browser');
  const [logoError, setLogoError] = useState('');

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(saved), [form, saved]);

  useEffect(() => {
    if (hydrated) return;
    const defaults = createProfile(data.startup);
    try {
      const stored = localStorage.getItem(STARTUP_PROFILE_KEY);
      const savedProfile = stored ? { ...defaults, ...JSON.parse(stored) } as ProfileDraft : defaults;
      const draftRaw = localStorage.getItem(STARTUP_PROFILE_DRAFT_KEY);
      const draftProfile = draftRaw ? { ...savedProfile, ...JSON.parse(draftRaw) } as ProfileDraft : savedProfile;
      setSaved(savedProfile);
      setForm(draftProfile);
      setSaveState(draftRaw ? 'Draft restored' : stored ? 'Saved on this device' : 'Not saved yet');
    } catch { setSaved(defaults); setForm(defaults); }
    setHydrated(true);
  // Initialize once from workspace and local profile drafts.
  }, [data.startup, hydrated]);

  useEffect(() => {
    if (!hydrated || !dirty) return;
    const timer = window.setTimeout(() => {
      try { localStorage.setItem(STARTUP_PROFILE_DRAFT_KEY, JSON.stringify(form)); setSaveState('Draft autosaved'); }
      catch { setSaveState('Draft could not be saved'); }
    }, 30000);
    return () => window.clearTimeout(timer);
  }, [form, dirty, hydrated]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!dirty) return;
    const confirmLeave = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', confirmLeave);
    return () => window.removeEventListener('beforeunload', confirmLeave);
  }, [dirty]);

  const update = <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) => setForm((previous) => ({ ...previous, [key]: value }));
  const saveChanges = () => {
    if (form.name.trim().length < 2) { setNotice('Startup name must be at least 2 characters.'); document.getElementById('profile-name')?.focus(); return; }
    if (form.name.trim().length > 60) { setNotice('Startup name must be 60 characters or fewer.'); return; }
    if (form.tagline.length > 100) { setNotice('Tagline must be 100 characters or fewer.'); return; }
    if (form.oneLiner.length > 160) { setNotice('One-liner must be 160 characters or fewer.'); return; }
    if (form.pitch.length > 1200) { setNotice('Pitch summary must be 1,200 characters or fewer.'); return; }
    if (form.website && !/^https?:\/\//i.test(form.website)) { setNotice('Website must start with http:// or https://.'); document.getElementById('website')?.focus(); return; }
    const normalized = { ...form, name: form.name.trim(), tagline: form.tagline.trim() };
    try { localStorage.setItem(STARTUP_PROFILE_KEY, JSON.stringify(normalized)); localStorage.removeItem(STARTUP_PROFILE_DRAFT_KEY); updateStartupIdentity({ name: normalized.name, tagline: normalized.tagline }); setForm(normalized); setSaved(normalized); setSaveState('Saved just now'); setNotice('Profile updated on this device.'); }
    catch { setNotice('Could not save profile in this browser.'); }
  };
  const discardChanges = () => {
    if (dirty && !window.confirm('Discard your unsaved profile changes?')) return;
    setForm(saved); localStorage.removeItem(STARTUP_PROFILE_DRAFT_KEY); setSaveState('Saved on this device'); setNotice('Changes discarded.');
  };
  const handleLogo = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/svg+xml'].includes(file.type) || file.size > 2 * 1024 * 1024) { setLogoError('Choose a PNG, JPG or SVG up to 2 MB.'); event.target.value = ''; return; }
    const reader = new FileReader(); reader.onload = () => { update('logoData', String(reader.result || '')); setLogoError(''); }; reader.readAsDataURL(file);
  };

  const teamMembers = [...data.team].sort((a, b) => Number(b.permission === 'Owner' || b.permission === 'Admin') - Number(a.permission === 'Owner' || a.permission === 'Admin'));
  const pitchDeck = data.documents.find((document) => /pitch|deck/i.test(document.title));
  const completenessItems = [
    { label: 'Add a logo', done: Boolean(form.logoData), target: 'profile-hero' },
    { label: 'Add a tagline', done: Boolean(form.tagline.trim()), target: 'about-section' },
    { label: 'Add pitch summary', done: Boolean(form.pitch.trim()), target: 'about-section' },
    { label: 'Describe problem & solution', done: Boolean(form.problem.trim() && form.solution.trim()), target: 'problem-section' },
    { label: 'Add a traction metric', done: METRICS.some((metric) => Boolean(form[metric.key].trim())), target: 'traction-section' },
    { label: 'Add at least 2 team members', done: data.team.length >= 2, target: 'team-section' },
    { label: 'Upload a pitch deck', done: Boolean(pitchDeck), target: 'documents-section' },
    { label: 'Verify legal details', done: false, target: 'legal-section' },
  ];
  const completion = Math.round(completenessItems.filter((item) => item.done).length / completenessItems.length * 100);
  const visibilityLabel = form.visibility === 'private' ? 'Private' : form.visibility === 'mentors' ? 'Mentors only' : 'Mentors and investors';
  const hasAccess = form.visibility === 'mentors-investors' || (form.visibility === 'mentors' && previewRole === 'mentor');
  const metricsToShow = METRICS.filter((metric) => form.shareTraction && form.publicMetrics.includes(metric.id) && form[metric.key].trim());
  const committedAmount = Number(form.committed.replace(/[^0-9.]/g, ''));
  const targetAmount = Number(form.targetRaise.replace(/[^0-9.]/g, ''));
  const raiseProgress = targetAmount > 0 && Number.isFinite(committedAmount) ? Math.min(100, Math.round(committedAmount / targetAmount * 100)) : null;
  const useFundSegments = [form.productUse, form.hiringUse, form.marketingUse, form.operationsUse].map((value) => Number(value));
  const useFundTotal = useFundSegments.reduce((total, value) => total + (Number.isFinite(value) && value > 0 ? value : 0), 0);
  const userActions = (action: string) => setNotice(`${action} will be available when platform messaging is connected.`);
  const focusSection = (id: string) => {
    const section = document.getElementById(`${id}-section`);
    section?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    section?.querySelector<HTMLElement>('input:not([type="checkbox"]), textarea, select, a, button')?.focus({ preventScroll: true });
  };

  return <div className={styles.profilePage}>
    <a className={styles.skipLink} href="#profile-content">Skip to profile content</a>
    <header className={styles.pageHeader}>
      <div className={styles.pageTitleBlock}><span className={styles.eyebrow}>Startup workspace · Page 15</span><h1>Startup profile</h1><p>Keep your company story accurate and decide who can discover it.</p></div>
      <div className={styles.headerControls}>
        <div className={styles.segmented} role="tablist" aria-label="Profile view">
          <button id="profile-tab-edit" type="button" role="tab" aria-controls="profile-view-panel" aria-selected={view === 'edit'} tabIndex={view === 'edit' ? 0 : -1} onClick={() => setView('edit')}>Edit</button>
          <button id="profile-tab-preview" type="button" role="tab" aria-controls="profile-view-panel" aria-selected={view === 'preview'} tabIndex={view === 'preview' ? 0 : -1} onClick={() => setView('preview')}>Public preview</button>
        </div>
        <span className={`${styles.saveStatus} ${dirty ? styles.unsavedStatus : ''}`}>{dirty ? 'Unsaved changes' : saveState}</span>
        {view === 'edit' && <><button type="button" className={styles.discardButton} onClick={discardChanges} disabled={!dirty}>Discard</button><button type="button" className={styles.primaryButton} onClick={saveChanges} disabled={!dirty}><Save size={15} /> Save changes</button></>}
      </div>
    </header>
    {form.visibility === 'private' && view === 'edit' && <div className={styles.privateNotice}><LockKeyhole size={17} /><div><strong>Your profile is private.</strong> Mentors and investors can’t see it. Change visibility any time in the side panel.</div><button type="button" onClick={() => document.getElementById('visibility-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>Change visibility <ArrowRight size={14} /></button></div>}

    <div id="profile-view-panel" role="tabpanel" aria-labelledby={view === 'edit' ? 'profile-tab-edit' : 'profile-tab-preview'} tabIndex={0}>
    {view === 'preview' && !hasAccess ? <div className={styles.previewPrivateState}><span className={styles.privateStateIcon}><LockKeyhole size={25} /></span><h2>This profile isn’t visible to {previewRole === 'investor' ? 'investors' : 'mentors'}.</h2><p>Current sharing setting: <strong>{visibilityLabel}</strong>. Choose a different visibility level in Edit view to share this profile.</p><button type="button" className={styles.primaryButton} onClick={() => setView('edit')}>Review visibility settings</button></div> : <>
      <section className={styles.heroCard} id="profile-hero" aria-label="Startup identity">
        <div className={styles.coverBand}><span className={styles.coverRule} /></div>
        <div className={styles.heroContent}>
          <div className={styles.logoWrap}>
            {form.logoData ? <img className={styles.startupLogo} src={form.logoData} alt={`${form.name} logo`} /> : <div className={styles.logoPlaceholder} aria-label={`${form.name} logo placeholder`}>{initials(form.name || 'Startup')}</div>}
            {view === 'edit' && <label className={styles.logoUpload} title="Upload a logo"><ImagePlus size={15} /><input type="file" accept="image/png,image/jpeg,image/svg+xml" onChange={handleLogo} aria-label="Upload startup logo" /></label>}
          </div>
          <div className={styles.heroDetails}>
            {view === 'edit' ? <div className={styles.heroEditFields}><label className={styles.heroNameField}><span className={styles.srOnly}>Startup name</span><input id="profile-name" value={form.name} minLength={2} maxLength={60} onChange={(event) => update('name', event.target.value)} aria-label="Startup name" /></label><span className={styles.nameCounter}>{form.name.length}/60</span><label className={styles.heroTaglineField}><span className={styles.srOnly}>Tagline</span><input value={form.tagline} maxLength={100} onChange={(event) => update('tagline', event.target.value)} placeholder="Add a concise company tagline" aria-label="Startup tagline" /></label></div> : <><h2>{form.name}</h2><p className={styles.heroTagline}>{form.tagline || 'No tagline added yet.'}</p></>}
            {logoError && <span className={styles.errorText} role="alert">{logoError}</span>}
            <div className={styles.metaRow}><span><BriefcaseBusiness size={14} />{data.startup.industry || 'Sector not set'}</span><span><MapPin size={14} />{form.location || 'Location not provided'}</span><span>Founded {data.startup.foundedYear || '—'}</span><span><Users size={14} />{data.team.length} team members</span></div>
            <div className={styles.badges}><span className={styles.stageBadge}>Stage: {data.startup.currentStage.replace('-', ' ').replace(/\b\w/g, (char) => char.toUpperCase())}</span>{form.visibility === 'private' && <span className={styles.privateBadge}><LockKeyhole size={12} /> Private profile</span>}</div>
          </div>
          {view === 'preview' && <div className={styles.heroActions}>{previewRole === 'investor' ? <><button type="button" className={styles.primaryButton} onClick={() => userActions('Request intro')}><MessageSquare size={15} /> Request intro</button><button type="button" className={styles.secondaryButton} onClick={() => userActions('Shortlist')}><Check size={15} /> Save to shortlist</button></> : <button type="button" className={styles.primaryButton} onClick={() => userActions('Mentorship offer')}><MessageSquare size={15} /> Offer mentorship</button>}</div>}
        </div>
      </section>

      {view === 'preview' && <div className={styles.previewToolbar}><span><EyeIcon /> Preview as</span><button type="button" className={previewRole === 'investor' ? styles.previewRoleActive : ''} onClick={() => setPreviewRole('investor')}>Investor</button><button type="button" className={previewRole === 'mentor' ? styles.previewRoleActive : ''} onClick={() => setPreviewRole('mentor')}>Mentor</button><span className={styles.previewVisibility}>Visible to: {visibilityLabel}</span></div>}

      <main id="profile-content" className={styles.profileGrid}>
        <div className={styles.mainColumn}>
          <section className={styles.card} id="about-section"><SectionHeading title="About & pitch" description="A concise introduction to the company." edit={view === 'edit'} onEdit={() => focusSection('about')} />
            <div className={styles.cardBody}>{view === 'edit' ? <div className={styles.formStack}><Field label="One-liner" value={form.oneLiner} onChange={(value) => update('oneLiner', value)} maxLength={160} placeholder="What are you building, for whom, and why?" hint="Appears in search and introductions." /><Field label="Pitch summary" value={form.pitch} onChange={(value) => update('pitch', value)} maxLength={1200} multiline placeholder="Share the opportunity, your approach, and why now." /></div> : <div className={styles.pitchDisplay}><p>{form.oneLiner || form.tagline || 'A one-line company summary has not been added yet.'}</p>{form.pitch ? <p>{form.pitch}</p> : <span className={styles.emptyHint}>Pitch summary not provided.</span>}</div>}</div>
          </section>

          <section className={styles.card} id="problem-section"><SectionHeading title="Problem, solution & market" description="Describe the need, your approach and who you serve." edit={view === 'edit'} onEdit={() => focusSection('problem')} />
            <div className={styles.trioGrid}>{(['problem', 'solution', 'targetMarket'] as const).map((key) => <article className={styles.infoTile} key={key}><span className={styles.tileLabel}>{key === 'targetMarket' ? 'Target customer & market' : key[0].toUpperCase() + key.slice(1)}</span>{view === 'edit' ? <textarea value={form[key]} onChange={(event) => update(key, event.target.value)} rows={4} placeholder={key === 'problem' ? 'What urgent problem are you addressing?' : key === 'solution' ? 'How does your product address it?' : 'Who is your customer? Add market sizing only when verified.'} /> : <p>{form[key] || 'Not added yet.'}</p>}</article>)}</div>
          </section>

          <section className={styles.card} id="traction-section"><SectionHeading title="Traction highlights" description="Choose which verified metrics to share. No metrics are public by default." edit={view === 'edit'} onEdit={() => focusSection('traction')} />
            {view === 'edit' ? <div className={styles.tractionEditGrid}>{METRICS.map((metric) => <div className={styles.metricField} key={metric.id}><Field label={metric.label} value={form[metric.key]} onChange={(value) => update(metric.key, value)} placeholder="Not connected" /><label className={styles.shareMetric}><input type="checkbox" checked={form.publicMetrics.includes(metric.id)} onChange={(event) => update('publicMetrics', event.target.checked ? [...form.publicMetrics, metric.id] : form.publicMetrics.filter((item) => item !== metric.id))} /> Share publicly</label></div>)}</div> : metricsToShow.length ? <div className={styles.metricTiles}>{metricsToShow.map((metric) => <div className={styles.metricTile} key={metric.id}><strong>{form[metric.key]}</strong><span>{metric.label}</span></div>)}</div> : <div className={styles.emptySection}><span className={styles.emptyIcon}><Globe2 size={19} /></span><strong>No public traction metrics</strong><span>Founders have not shared any traction figures.</span></div>}
          </section>

          <section className={styles.card} id="team-section"><SectionHeading title="Team" description="Founders first, followed by key collaborators." edit={view === 'edit'} onEdit={() => focusSection('team')} />
            <div className={styles.teamGrid}>{teamMembers.map((member) => <article className={styles.memberCard} key={member.id}><span className={styles.memberAvatar}>{initials(member.name)}</span><div className={styles.memberText}><strong>{member.name}</strong><span>{member.role}</span>{view === 'edit' && <small>{member.permission}</small>}</div>{view === 'edit' && <button type="button" className={styles.iconButton} aria-label={`More actions for ${member.name}`} onClick={() => setNotice('Team roles and ordering are managed in the Team workspace.')}><ChevronDown size={16} /></button>}</article>)}</div>
            {view === 'edit' && <Link href="/startup/team" className={styles.inlineAction}><Plus size={15} /> Invite member</Link>}
            {view === 'preview' && form.shareTeamContacts && <p className={styles.caption}>Team contact details are shared only where each member has consented.</p>}
          </section>

          <section className={styles.card} id="documents-section"><SectionHeading title="Documents & data room" description="Files in the workspace, with access controlled separately." edit={view === 'edit'} onEdit={() => focusSection('documents')} />
            {view === 'edit' ? (data.documents.length ? <div className={styles.documentRows}>{data.documents.slice(0, 5).map((doc) => <div className={styles.documentRow} key={doc.id}><span className={styles.documentIcon}><FileText size={17} /></span><span className={styles.documentDetail}><strong>{doc.title}</strong><small>{doc.folder} · Updated {doc.updatedAt}</small></span><span className={styles.accessChip}><LockKeyhole size={12} /> Access not configured</span></div>)}</div> : <div className={styles.emptySection}><strong>No documents added yet</strong><span>Upload a pitch deck or company document to begin.</span></div>) : <div className={styles.emptySection}><span className={styles.emptyIcon}><LockKeyhole size={18} /></span><strong>No documents are shared in this preview</strong><span>File-level sharing hasn’t been configured, so private document names are hidden.</span><button type="button" className={styles.requestAccess} onClick={() => userActions('Request data room access')}>Request access</button></div>}
            <p className={styles.ndaNote}><Shield size={14} /> Investors must accept a confidentiality agreement before viewing restricted data room files.</p>
            {view === 'edit' && <Link href="/startup/data-room" className={styles.inlineAction}><Plus size={15} /> Manage data room</Link>}
          </section>

          <section className={styles.card} id="funding-section"><SectionHeading title="Funding & use of funds" description="Shared only with verified investors when details are provided." edit={view === 'edit'} onEdit={() => focusSection('funding')} />
            {view === 'edit' ? <div className={styles.formGrid}><Field label="Round" value={form.fundingRound} onChange={(value) => update('fundingRound', value)} placeholder="e.g. Pre-seed" /><Field label="Target raise" value={form.targetRaise} onChange={(value) => update('targetRaise', value)} placeholder="Not provided" /><Field label="Committed so far" value={form.committed} onChange={(value) => update('committed', value)} placeholder="Not provided" /><Field label="Minimum ticket" value={form.minimumTicket} onChange={(value) => update('minimumTicket', value)} placeholder="Not provided" /><Field label="Product (%)" value={form.productUse} onChange={(value) => update('productUse', value)} placeholder="—" /><Field label="Hiring (%)" value={form.hiringUse} onChange={(value) => update('hiringUse', value)} placeholder="—" /><Field label="Marketing (%)" value={form.marketingUse} onChange={(value) => update('marketingUse', value)} placeholder="—" /><Field label="Operations (%)" value={form.operationsUse} onChange={(value) => update('operationsUse', value)} placeholder="—" /></div> : form.shareFunding && (form.fundingRound || form.targetRaise || form.committed) ? <div className={styles.fundingPreview}><div className={styles.fundingStats}><div><small>Round</small><strong>{form.fundingRound || 'Not specified'}</strong></div><div><small>Target raise</small><strong>{form.targetRaise || 'Not provided'}</strong></div><div><small>Committed</small><strong>{form.committed || 'Not provided'}</strong></div><div><small>Minimum ticket</small><strong>{form.minimumTicket || 'Not provided'}</strong></div></div>{raiseProgress !== null && <div className={styles.raiseProgress}><div><span>Committed progress</span><strong>{raiseProgress}%</strong></div><span className={styles.raiseTrack}><i style={{ width: `${raiseProgress}%` }} /></span></div>}{useFundTotal > 0 && <div className={styles.useFunds}><strong>Use of funds</strong><div className={styles.fundsBar}>{useFundSegments.map((value, index) => value > 0 && <span key={index} className={`${styles.fundSegment} ${styles[`fundColor${index}`]}`} style={{ width: `${value / useFundTotal * 100}%` }} title={`${['Product','Hiring','Marketing','Operations'][index]} ${value}%`} />)}</div><div className={styles.fundLegend}>{['Product','Hiring','Marketing','Operations'].map((label, index) => <span key={label}><i className={styles[`fundColor${index}`]} />{label}: {Number.isFinite(useFundSegments[index]) ? useFundSegments[index] : 0}%</span>)}</div></div>}</div> : <div className={styles.emptySection}><span className={styles.emptyIcon}><Info size={18} /></span><strong>Funding details not shared</strong><span>The startup has not provided a shareable round target, committed amount, or use-of-funds allocation.</span></div>}
          </section>

          {view === 'edit' && <section className={styles.card} id="legal-section"><SectionHeading title="Legal & company details" description="Admin-only information. These details are not shown publicly." edit={false} />
            <div className={styles.reviewBanner}><Info size={16} /><span>Verification status: <strong>Not submitted</strong>. Business verification is not connected.</span></div>
            <div className={styles.formGrid}><Field label="Registered legal name" value={form.registeredName} onChange={(value) => update('registeredName', value)} placeholder="Add registered name" /><label className={styles.field}><span className={styles.fieldLabel}>Entity type</span><select value={form.entityType} onChange={(event) => update('entityType', event.target.value)}><option value="">Select entity type</option><option>Private limited company</option><option>Limited liability partnership</option><option>Partnership</option><option>Sole proprietorship</option><option>Other</option></select></label><Field label="Registration number" value={form.registrationNumber} onChange={(value) => update('registrationNumber', value)} placeholder="Add registration number" /><Field label="Incorporation date" value={form.incorporationDate} onChange={(value) => update('incorporationDate', value)} type="date" /><Field label="Registered address" value={form.registeredAddress} onChange={(value) => update('registeredAddress', value)} placeholder="Add registered address" /><Field label="Website" value={form.website} onChange={(value) => update('website', value)} placeholder="https://example.com" type="url" id="website" /></div>
          </section>}
        </div>

        <aside className={styles.sideColumn} aria-label="Profile settings and facts">
          <section className={styles.card} aria-labelledby="completeness-title"><div className={styles.sideCardHeader}><h2 id="completeness-title">Profile completeness</h2><span>{completion}%</span></div><div className={styles.completenessTrack} role="progressbar" aria-label="Profile completeness" aria-valuemin={0} aria-valuemax={100} aria-valuenow={completion}><span style={{ width: `${completion}%` }} /></div><p className={styles.caption}>{completenessItems.filter((item) => item.done).length} of {completenessItems.length} profile essentials complete</p><ul className={styles.checklist}>{completenessItems.filter((item) => !item.done).map((item) => <li key={item.target + item.label}><a href={`#${item.target}`}><span className={styles.checkEmpty} />{item.label}<ArrowRight size={13} /></a></li>)}{completion === 100 && <li className={styles.allComplete}><CheckCircle2 size={15} />Profile essentials complete</li>}</ul></section>

          {view === 'edit' && <section className={styles.card} id="visibility-section"><div className={styles.sideCardHeader}><div><h2>Visibility & sharing</h2><p>Control who can discover this profile.</p></div><LockKeyhole size={16} /></div><fieldset className={styles.visibilityFieldset}><legend className={styles.srOnly}>Profile visibility</legend>{([{value:'private', label:'Private', detail:'Only your team'}, {value:'mentors', label:'Mentors only', detail:'Visible to assigned mentors'}, {value:'mentors-investors', label:'Mentors and investors', detail:'Discoverable in the network'}] as const).map((option) => <label className={`${styles.visibilityOption} ${form.visibility === option.value ? styles.visibilitySelected : ''}`} key={option.value}><input type="radio" name="profile-visibility" value={option.value} checked={form.visibility === option.value} onChange={() => update('visibility', option.value)} /><span className={styles.radioDot} /><span><strong>{option.label}</strong><small>{option.detail}</small></span></label>)}</fieldset><div className={styles.shareSettings}><strong>What can be shared?</strong><label><input type="checkbox" checked={form.shareTraction} onChange={(event) => update('shareTraction', event.target.checked)} /> Traction numbers</label><label><input type="checkbox" checked={form.shareFunding} onChange={(event) => update('shareFunding', event.target.checked)} /> Funding details</label><label><input type="checkbox" checked={form.shareTeamContacts} onChange={(event) => update('shareTeamContacts', event.target.checked)} /> Team contacts</label></div><p className={styles.caption}>Visibility preference is applied in this local preview; no external directory is connected.</p><button type="button" className={styles.previewLink} onClick={() => { setPreviewRole('investor'); setView('preview'); }}>Preview as investor <ArrowRight size={14} /></button><button type="button" className={styles.previewLink} onClick={() => { setPreviewRole('mentor'); setView('preview'); }}>Preview as mentor <ArrowRight size={14} /></button></section>}

          <section className={styles.card}><div className={styles.sideCardHeader}><h2>Key facts</h2><CircleHelp size={15} /></div><dl className={styles.factsList}><div><dt>Stage</dt><dd>{data.stages.find((stage) => stage.id === data.startup.currentStage)?.label || 'Not set'}</dd></div><div><dt>Readiness</dt><dd className={styles.mutedFact}>Not assessed</dd></div><div><dt>Founded</dt><dd>{data.startup.foundedYear || '—'}</dd></div><div><dt>Location</dt><dd>{form.location || 'Not provided'}</dd></div><div><dt>Sector</dt><dd>{data.startup.industry || 'Not provided'}</dd></div><div><dt>Business model</dt><dd>{form.businessModel || 'Not provided'}</dd></div></dl>{view === 'edit' && <div className={styles.keyFactFields}><Field label="Location" value={form.location} onChange={(value) => update('location', value)} placeholder="City, country" /><Field label="Business model" value={form.businessModel} onChange={(value) => update('businessModel', value)} placeholder="e.g. B2B SaaS" /></div>}<p className={styles.caption}>Readiness score is unavailable until verified data is connected.</p></section>

          <section className={styles.card}><div className={styles.sideCardHeader}><h2>Lead mentor</h2><Link href="/startup/roadmap" aria-label="View mentor guidance"><ArrowRight size={15} /></Link></div><div className={styles.mentorMini}><span className={styles.mentorAvatar}>{initials(data.mentor.name.replace(/^Dr\.\s*/i, ''))}</span><div><strong>{data.mentor.name}</strong><small>{data.mentor.title}</small></div></div><div className={styles.signoffNotice}><ShieldCheck size={15} /><span>Mentor sign-off progress is not recorded in this profile.</span></div><Link href="/startup/roadmap" className={styles.previewLink}>View stage guidance <ArrowRight size={14} /></Link></section>

          <section className={styles.card}><div className={styles.sideCardHeader}><h2>Contact</h2><Mail size={16} /></div>{view === 'edit' ? <div className={styles.contactFields}><Field label="Website" value={form.website} onChange={(value) => update('website', value)} placeholder="https://example.com" type="url" /><Field label="Primary email" value={data.startup.founderEmail} onChange={() => {}} placeholder="Email from account" readOnly /><Field label="Phone" value={form.phone} onChange={(value) => update('phone', value)} placeholder="Optional" type="tel" /></div> : <div className={styles.publicContact}><p>Contact the startup through the platform.</p><button type="button" className={styles.secondaryButton} onClick={() => userActions('Message')}>Message</button><button type="button" className={styles.primaryButton} onClick={() => userActions('Request intro')}>Request intro</button></div>}</section>
        </aside>
      </main>
      </>}
    </div>
    <div className={styles.disclaimer}>The platform introduces parties and is not a broker or adviser.</div>
    {notice && <div className={styles.toast} role="status"><CheckCircle2 size={16} />{notice}<button type="button" onClick={() => setNotice('')} aria-label="Dismiss notification"><X size={14} /></button></div>}
    {view === 'edit' && dirty && <div className={styles.mobileSaveBar}><span>Unsaved changes</span><button type="button" onClick={discardChanges} className={styles.discardButton}>Discard</button><button type="button" onClick={saveChanges} className={styles.primaryButton}><Save size={14} /> Save</button></div>}
  </div>;
}

function EyeIcon() { return <Globe2 size={14} aria-hidden="true" />; }
