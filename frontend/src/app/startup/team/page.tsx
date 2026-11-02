'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDownUp, ArrowRight, BriefcaseBusiness, Check, CheckCheck, ChevronDown,
  CircleHelp, Download, Ellipsis, FileText, Link2, LockKeyhole, Mail,
  MessageSquare, Plus, Search, ShieldCheck, Trash2, Users, X,
} from 'lucide-react';
import { useStartupWorkspace } from '@/context/StartupWorkspaceContext';
import { StartupTeamMember } from '@/types/startup';
import styles from './StartupTeam.module.css';

type AccessRole = StartupTeamMember['permission'];
type Department = 'Product' | 'Engineering' | 'Sales' | 'Operations' | 'Finance' | 'Other';
type TeamStatus = 'Active' | 'Pending' | 'Deactivated';
type PendingInvite = { id: string; email: string; name: string; title: string; department: string; role: AccessRole; message: string; showOnPublicProfile: boolean; sentAt: string };
type TeamRow = { id: string; name: string; email: string; title: string; role: AccessRole; department: string; status: TeamStatus; joinedAt: string; showOnPublicProfile: boolean; isInvite: boolean; member?: StartupTeamMember; invite?: PendingInvite };
const PENDING_KEY = 'meridian-team-pending-invites-v1';
const ROLE_OPTIONS: AccessRole[] = ['Owner', 'Admin', 'Member', 'Viewer'];
const DEPARTMENTS: Department[] = ['Product', 'Engineering', 'Sales', 'Operations', 'Finance', 'Other'];
const ROLE_COPY: Record<AccessRole, string> = {
  Owner: 'Everything, including billing, visibility and removing admins.',
  Admin: 'Manage team, profile, documents and data room. No billing.',
  Member: 'Work on tasks, upload permitted documents and use stage tools.',
  Viewer: 'Read-only access to selected workspace areas.',
};
function initials(name: string) { return name.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase(); }
function prettyDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); }
function daysOld(value: string) { const date = new Date(value).getTime(); return Number.isNaN(date) ? 0 : Math.floor((Date.now() - date) / 86400000); }
function parseEmails(value: string) { return [...new Set(value.split(/[\s,;]+/).map((email) => email.trim().toLowerCase()).filter(Boolean))]; }

export default function StartupTeamPage() {
  const { data, updateTeamMember, removeTeamMember } = useStartupWorkspace();
  const [pending, setPending] = useState<PendingInvite[]>([]);
  const [view, setView] = useState<'table' | 'cards'>('table');
  const [manualViewChoice, setManualViewChoice] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All roles');
  const [statusFilter, setStatusFilter] = useState('All statuses');
  const [departmentFilter, setDepartmentFilter] = useState('All departments');
  const [sortBy, setSortBy] = useState<'name' | 'role' | 'joined'>('name');
  const [selected, setSelected] = useState<string[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [drawerMember, setDrawerMember] = useState<StartupTeamMember | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ kind: 'remove' | 'deactivate' | 'revoke'; row: TeamRow } | null>(null);
  const [toast, setToast] = useState<{ text: string; undo?: () => void } | null>(null);
  const [inviteError, setInviteError] = useState('');
  const [loadedInvites, setLoadedInvites] = useState(false);
  const toastTimer = useRef<number | null>(null);

  const activeUser = data.team.find((member) => member.name === data.startup.founderName);
  const currentRole: AccessRole = activeUser?.permission || 'Owner';
  const canManage = currentRole === 'Owner' || currentRole === 'Admin';
  const ownerCount = data.team.filter((member) => member.permission === 'Owner' && member.status !== 'Deactivated').length;

  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)');
    const syncView = () => { if (!manualViewChoice) setView(media.matches ? 'cards' : 'table'); };
    syncView(); media.addEventListener('change', syncView);
    return () => media.removeEventListener('change', syncView);
  }, [manualViewChoice]);
  useEffect(() => {
    try { const raw = localStorage.getItem(PENDING_KEY); if (raw) setPending(JSON.parse(raw) as PendingInvite[]); }
    catch { setPending([]); }
    setLoadedInvites(true);
  }, []);
  useEffect(() => { if (loadedInvites) { try { localStorage.setItem(PENDING_KEY, JSON.stringify(pending)); } catch { /* Keep page usable if storage is unavailable. */ } } }, [pending, loadedInvites]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') { setInviteOpen(false); setPermissionsOpen(false); setDrawerMember(null); setConfirmAction(null); setOpenMenu(null); } };
    window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close);
  }, []);
  useEffect(() => () => { if (toastTimer.current) window.clearTimeout(toastTimer.current); }, []);

  const showToast = (text: string, undo?: () => void) => {
    setToast({ text, undo });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), undo ? 8000 : 3600);
  };
  const rows: TeamRow[] = useMemo(() => {
    const activeRows = data.team.map((member) => ({
      id: member.id, name: member.name, email: member.email, title: member.role,
      role: member.permission, department: member.department || 'Not set',
      status: member.status || 'Active', joinedAt: member.joinedAt || '—',
      showOnPublicProfile: member.showOnPublicProfile === true, isInvite: false, member,
    } as TeamRow));
    const inviteRows = pending.map((invite) => ({
      id: invite.id, name: invite.name || invite.email, email: invite.email, title: invite.title,
      role: invite.role, department: invite.department || 'Not set', status: 'Pending' as const,
      joinedAt: invite.sentAt, showOnPublicProfile: invite.showOnPublicProfile, isInvite: true, invite,
    } as TeamRow));
    return [...activeRows, ...inviteRows];
  }, [data.team, pending]);
  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const match = rows.filter((row) => {
      const textMatch = !term || `${row.name} ${row.email} ${row.title} ${row.department}`.toLowerCase().includes(term);
      return textMatch && (roleFilter === 'All roles' || row.role === roleFilter) && (statusFilter === 'All statuses' || row.status === statusFilter) && (departmentFilter === 'All departments' || row.department === departmentFilter);
    });
    return match.sort((a, b) => sortBy === 'name' ? a.name.localeCompare(b.name) : sortBy === 'role' ? a.role.localeCompare(b.role) : (a.joinedAt === '—' ? 0 : new Date(a.joinedAt).getTime()) - (b.joinedAt === '—' ? 0 : new Date(b.joinedAt).getTime()));
  }, [rows, search, roleFilter, statusFilter, departmentFilter, sortBy]);
  const activeCount = data.team.filter((member) => (member.status || 'Active') === 'Active').length;
  const pendingCount = pending.length;

  const csvExport = () => {
    const content = [['Name', 'Email', 'Title', 'Access role', 'Department', 'Status', 'Joined', 'Public profile'], ...rows.map((row) => [row.name, canManage ? row.email : '', row.title, row.role, row.department, row.status, row.joinedAt, row.showOnPublicProfile ? 'Yes' : 'No'])].map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${data.startup.name.toLowerCase().replace(/\s+/g, '-')}-team.csv`; anchor.click(); URL.revokeObjectURL(url); showToast('Team directory exported.');
  };
  const clearFilters = () => { setSearch(''); setRoleFilter('All roles'); setStatusFilter('All statuses'); setDepartmentFilter('All departments'); };
  const updateRole = (member: StartupTeamMember, nextRole: AccessRole) => {
    if (member.permission === nextRole) return;
    if (member.permission === 'Owner' && nextRole !== 'Owner' && ownerCount <= 1) { showToast('A startup needs at least one Owner.'); return; }
    if (currentRole === 'Admin' && (member.permission === 'Owner' || nextRole === 'Owner' || nextRole === 'Admin')) { showToast('Admins can assign Member or Viewer access only.'); return; }
    const previous = member.permission;
    updateTeamMember(member.id, { permission: nextRole });
    showToast(`${member.name} is now ${nextRole}.`, () => updateTeamMember(member.id, { permission: previous }));
  };
  const togglePublic = (member: StartupTeamMember, checked: boolean) => {
    updateTeamMember(member.id, { showOnPublicProfile: checked });
    showToast(`${member.name} ${checked ? 'will appear on' : 'was removed from'} the public startup profile.`);
  };
  const resendInvite = (invite: PendingInvite) => {
    setPending((items) => items.map((item) => item.id === invite.id ? { ...item, sentAt: new Date().toISOString() } : item));
    showToast(`Invite reminder prepared for ${invite.email}. Email delivery isn’t connected in this demo.`);
  };
  const revokeInvite = (invite: PendingInvite) => {
    setPending((items) => items.filter((item) => item.id !== invite.id));
    showToast(`Invite to ${invite.email} revoked.`);
  };
  const deactivateSelected = () => {
    const selectedRows = data.team.filter((member) => selected.includes(member.id) && member.status !== 'Deactivated');
    const selectedOwners = selectedRows.filter((member) => member.permission === 'Owner');
    const protectedOwnerId = currentRole === 'Admin' || selectedOwners.length >= ownerCount ? selectedOwners[0]?.id : undefined;
    const targets = selectedRows.filter((member) => member.permission !== 'Owner' || (currentRole === 'Owner' && member.id !== protectedOwnerId));
    if (!targets.length) { showToast('A startup needs at least one active Owner, and Admins cannot deactivate Owners.'); return; }
    if (window.confirm(`Deactivate access for ${targets.length} selected member${targets.length === 1 ? '' : 's'}?`)) {
      targets.forEach((member) => updateTeamMember(member.id, { status: 'Deactivated' }));
      setSelected([]); showToast(`${targets.length} member${targets.length === 1 ? '' : 's'} deactivated.`);
    }
  };
  const finishConfirm = () => {
    if (!confirmAction) return;
    const { kind, row } = confirmAction;
    if (kind === 'revoke' && row.invite) revokeInvite(row.invite);
    if (kind === 'deactivate' && row.member) {
      if (row.member.status !== 'Deactivated' && row.member.permission === 'Owner' && ownerCount <= 1) { showToast('A startup needs at least one active Owner.'); setConfirmAction(null); return; }
      if (currentRole === 'Admin' && row.member.permission === 'Owner') { showToast('Admins cannot change an Owner’s access.'); setConfirmAction(null); return; }
      updateTeamMember(row.member.id, { status: row.member.status === 'Deactivated' ? 'Active' : 'Deactivated' }); showToast(`${row.member.name} access ${row.member.status === 'Deactivated' ? 'reactivated' : 'deactivated'}.`);
    }
    if (kind === 'remove' && row.member) {
      if (row.member.permission === 'Owner' && ownerCount <= 1) { showToast('A startup needs at least one Owner.'); setConfirmAction(null); return; }
      removeTeamMember(row.member.id); showToast(`${row.member.name} was removed from the team.`);
    }
    setConfirmAction(null); setOpenMenu(null);
  };

  return <div className={styles.teamPage}>
    <a className={styles.skipLink} href="#team-directory">Skip to team directory</a>
    <header className={styles.pageHeader}>
      <div><span className={styles.eyebrow}>Startup workspace · People</span><h1>Team</h1><p>Manage who can access your startup workspace.</p></div>
      <div className={styles.headerActions}><button className={styles.secondaryButton} type="button" onClick={csvExport}><Download size={15} /> Export list</button>{canManage && <button className={styles.primaryButton} type="button" onClick={() => { setInviteError(''); setInviteOpen(true); }}><Plus size={16} /> Invite member</button>}</div>
    </header>
    {!canManage && <div className={styles.readOnlyBanner}><LockKeyhole size={16} /> Only Owners and Admins can manage the team. You can view names and roles.</div>}

    <section className={styles.summaryStrip} aria-label="Team summary">
      <div className={styles.summaryMetric}><span className={styles.summaryIcon}><Users size={17} /></span><div><strong>{activeCount}</strong><span>Active members</span></div></div>
      <div className={styles.summaryMetric}><span className={`${styles.summaryIcon} ${pendingCount ? styles.warningIcon : ''}`}><Mail size={17} /></span><div><strong>{pendingCount}</strong><span>Pending invites</span></div>{pendingCount > 0 && <span className={styles.warningPill}>Awaiting response</span>}</div>
      <div className={styles.summaryMetric}><span className={styles.summaryIcon}><BriefcaseBusiness size={17} /></span><div><strong>—</strong><span>Open hiring requests</span></div><Link href="/startup/hiring">View hiring <ArrowRight size={13} /></Link></div>
    </section>

    <div className={styles.contentGrid}>
      <main className={styles.directoryColumn} id="team-directory">
        <section className={styles.directoryCard} aria-label="Team directory">
          <div className={styles.toolbar}>
            <label className={styles.searchInput}><Search size={16} /><input aria-label="Search by name, email or role" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email or role" />{search && <button type="button" onClick={() => setSearch('')} aria-label="Clear search"><X size={14} /></button>}</label>
            <div className={styles.filterGroup}>
              <label><span className={styles.srOnly}>Filter by role</span><select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}><option>All roles</option>{ROLE_OPTIONS.map((role) => <option key={role}>{role}</option>)}</select></label>
              <label><span className={styles.srOnly}>Filter by status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All statuses</option>{(['Active', 'Pending', 'Deactivated'] as TeamStatus[]).map((status) => <option key={status}>{status}</option>)}</select></label>
              <label><span className={styles.srOnly}>Filter by department</span><select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}><option>All departments</option>{[...DEPARTMENTS, 'Not set'].map((department) => <option key={department}>{department}</option>)}</select></label>
            </div>
            <div className={styles.toolbarEnd}>
              <label className={styles.sortSelect}><ArrowDownUp size={14} /><span className={styles.srOnly}>Sort members</span><select value={sortBy} onChange={(event) => setSortBy(event.target.value as 'name' | 'role' | 'joined')}><option value="name">Name</option><option value="role">Role</option><option value="joined">Joined date</option></select></label>
              <div className={styles.viewToggle} role="group" aria-label="Directory view"><button type="button" aria-pressed={view === 'table'} onClick={() => { setManualViewChoice(true); setView('table'); }} aria-label="Table view"><RowsIcon /></button><button type="button" aria-pressed={view === 'cards'} onClick={() => { setManualViewChoice(true); setView('cards'); }} aria-label="Card view"><CardIcon /></button></div>
            </div>
          </div>
          {selected.length > 0 && canManage && <div className={styles.bulkBar}><span aria-live="polite">{selected.length} selected</span><label>Change role <select defaultValue="" onChange={(event) => { const role = event.target.value as AccessRole; if (role) { selected.forEach((id) => { const member = data.team.find((item) => item.id === id); if (member) updateRole(member, role); }); setSelected([]); } }}><option value="" disabled>Choose role…</option>{ROLE_OPTIONS.filter((role) => currentRole === 'Owner' || role === 'Member' || role === 'Viewer').map((role) => <option key={role}>{role}</option>)}</select></label><button type="button" className={styles.dangerText} onClick={deactivateSelected}>Deactivate selected</button><button type="button" onClick={() => setSelected([])}>Clear</button></div>}
          {view === 'table' ? <div className={styles.tableScroller}><table className={styles.memberTable}><thead><tr><th scope="col"><input type="checkbox" aria-label="Select all visible members" checked={filteredRows.length > 0 && selected.length === filteredRows.filter((row) => !row.isInvite).length} onChange={(event) => setSelected(event.target.checked ? filteredRows.filter((row) => !row.isInvite).map((row) => row.id) : [])} /></th><th scope="col">Member</th><th scope="col">Title</th><th scope="col">Access role</th><th scope="col">Department</th><th scope="col">Status</th><th scope="col">Joined</th><th scope="col">Public</th><th scope="col"><span className={styles.srOnly}>Actions</span></th></tr></thead><tbody>
            {filteredRows.map((row) => <tr key={row.id} className={row.isInvite ? styles.pendingRow : ''} onClick={() => row.member && setDrawerMember(row.member)}>
              <td onClick={(event) => event.stopPropagation()}>{!row.isInvite && <input type="checkbox" aria-label={`Select ${row.name}`} checked={selected.includes(row.id)} onChange={(event) => setSelected((items) => event.target.checked ? [...items, row.id] : items.filter((id) => id !== row.id))} />}</td>
              <td><div className={styles.memberIdentity}><span className={styles.avatar}>{initials(row.name)}</span><span><button type="button" className={styles.memberNameButton} onClick={(event) => { event.stopPropagation(); if (row.member) setDrawerMember(row.member); }}>{row.name}</button><small>{canManage || row.member?.email === data.startup.founderEmail ? row.email : 'Email hidden'}</small>{row.role === 'Owner' && <em className={styles.founderBadge}>Founder</em>}</span></div></td>
              <td>{row.title || <span className={styles.muted}>Title not set</span>}</td>
              <td onClick={(event) => event.stopPropagation()}>{canManage && row.member && row.member.permission !== 'Owner' && (currentRole === 'Owner' || (currentRole === 'Admin' && ['Member','Viewer'].includes(row.member.permission))) ? <select className={styles.roleSelect} value={row.role} onChange={(event) => updateRole(row.member!, event.target.value as AccessRole)} aria-label={`Access role for ${row.name}`}>{ROLE_OPTIONS.filter((role) => currentRole === 'Owner' || role === 'Member' || role === 'Viewer').map((role) => <option key={role}>{role}</option>)}</select> : <span className={styles.roleChip}>{row.role}</span>}</td>
              <td><span className={styles.departmentChip}>{row.department}</span></td>
              <td><span className={`${styles.statusChip} ${row.status === 'Active' ? styles.statusActive : row.status === 'Pending' ? styles.statusPending : styles.statusInactive}`}><i />{row.status}</span>{row.invite && daysOld(row.invite.sentAt) >= 7 && <span className={styles.expiredChip}>Expired</span>}</td>
              <td className={styles.joinedDate}>{row.isInvite ? `Sent ${prettyDate(row.joinedAt)}` : row.joinedAt}</td>
              <td onClick={(event) => event.stopPropagation()}>{row.member && canManage && (currentRole === 'Owner' || row.member.permission !== 'Owner') ? <label className={styles.publicSwitch}><input type="checkbox" checked={row.showOnPublicProfile} onChange={(event) => togglePublic(row.member!, event.target.checked)} aria-label={`${row.showOnPublicProfile ? 'Remove' : 'Show'} ${row.name} ${row.showOnPublicProfile ? 'from' : 'on'} public profile`} /><span /></label> : <span className={styles.publicText}>{row.showOnPublicProfile ? 'Shown' : '—'}</span>}</td>
              <td className={styles.actionCell} onClick={(event) => event.stopPropagation()}><button type="button" className={styles.moreButton} aria-label={`Actions for ${row.name}`} aria-expanded={openMenu === row.id} onClick={() => setOpenMenu(openMenu === row.id ? null : row.id)}><Ellipsis size={18} /></button>{openMenu === row.id && <div className={styles.rowMenu} role="menu">{row.member && <button role="menuitem" onClick={() => { setDrawerMember(row.member!); setOpenMenu(null); }}>View profile</button>}{row.invite ? <><button role="menuitem" onClick={() => resendInvite(row.invite!)}>Resend invite</button><button role="menuitem" className={styles.dangerText} onClick={() => setConfirmAction({ kind: 'revoke', row })}>Revoke invite</button></> : canManage && row.member && (currentRole === 'Owner' || row.member.permission !== 'Owner') && <><button role="menuitem" onClick={() => { setDrawerMember(row.member!); setOpenMenu(null); }}>Edit member details</button><button role="menuitem" onClick={() => setConfirmAction({ kind: 'deactivate', row })}>{row.status === 'Deactivated' ? 'Reactivate access' : 'Deactivate access'}</button><button role="menuitem" className={styles.dangerText} onClick={() => setConfirmAction({ kind: 'remove', row })}>Remove from team</button></>}</div>}</td>
            </tr>)}
          </tbody></table>{filteredRows.length === 0 && <EmptyResults onClear={clearFilters} canInvite={canManage} onInvite={() => setInviteOpen(true)} />}</div> : <div className={styles.memberCards}>{filteredRows.map((row) => <article className={styles.memberCard} key={row.id} onClick={() => row.member && setDrawerMember(row.member)}><div className={styles.memberCardTop}><span className={styles.avatarLarge}>{initials(row.name)}</span><button type="button" className={styles.moreButton} aria-label={`Actions for ${row.name}`} aria-expanded={openMenu === row.id} onClick={(event) => { event.stopPropagation(); setOpenMenu(openMenu === row.id ? null : row.id); }}><Ellipsis size={18} /></button>{openMenu === row.id && <div className={styles.rowMenu} role="menu">{row.member && <button role="menuitem" onClick={(event) => { event.stopPropagation(); setDrawerMember(row.member!); setOpenMenu(null); }}>View profile</button>}{row.invite ? <><button role="menuitem" onClick={(event) => { event.stopPropagation(); resendInvite(row.invite!); }}>Resend invite</button><button role="menuitem" className={styles.dangerText} onClick={(event) => { event.stopPropagation(); setConfirmAction({ kind: 'revoke', row }); }}>Revoke invite</button></> : canManage && row.member && (currentRole === 'Owner' || row.member.permission !== 'Owner') && <><button role="menuitem" onClick={(event) => { event.stopPropagation(); setConfirmAction({ kind: 'deactivate', row }); }}>{row.status === 'Deactivated' ? 'Reactivate access' : 'Deactivate access'}</button><button role="menuitem" className={styles.dangerText} onClick={(event) => { event.stopPropagation(); setConfirmAction({ kind: 'remove', row }); }}>Remove from team</button></>}</div>}</div><h3>{row.name}</h3><p>{row.title || 'Title not set'}</p><div className={styles.cardChips}><span className={styles.roleChip}>{row.role}</span><span className={styles.departmentChip}>{row.department}</span><span className={`${styles.statusChip} ${row.status === 'Active' ? styles.statusActive : row.status === 'Pending' ? styles.statusPending : styles.statusInactive}`}><i />{row.status}</span></div><p className={styles.bioSnippet}>{row.member?.bio || 'No bio added yet.'}</p><div className={styles.cardFooter}><button type="button" onClick={(event) => { event.stopPropagation(); showToast('Messaging is not connected in this demo.'); }}><MessageSquare size={14} /> Message</button>{row.member && canManage && (currentRole === 'Owner' || row.member.permission !== 'Owner') && <label onClick={(event) => event.stopPropagation()} className={styles.publicSwitch}><input type="checkbox" checked={row.showOnPublicProfile} onChange={(event) => togglePublic(row.member!, event.target.checked)} aria-label={`Show ${row.name} on public profile`} /><span /></label>}</div></article>)}{filteredRows.length === 0 && <EmptyResults onClear={clearFilters} canInvite={canManage} onInvite={() => setInviteOpen(true)} />}</div>}
          <div className={styles.directoryFooter}><span>Showing {filteredRows.length} of {rows.length} people and invitations</span><Link href="/startup/profile">Team directory feeds your <strong>public startup profile</strong> <ArrowRight size={13} /></Link></div>
        </section>
      </main>

      <aside className={styles.sideColumn}>
        <section className={styles.sideCard}><div className={styles.sideCardHeading}><h2>Roles at a glance</h2><CircleHelp size={16} /></div><div className={styles.roleGuide}>{ROLE_OPTIONS.map((role) => <div key={role}><span className={`${styles.roleGuideChip} ${role === 'Owner' ? styles.ownerGuideChip : ''}`}>{role}</span><p>{ROLE_COPY[role]}</p></div>)}</div><button type="button" className={styles.sideLink} onClick={() => setPermissionsOpen(true)}>See full permissions <ArrowRight size={14} /></button></section>
        <section className={styles.sideCard}><div className={styles.sideCardHeading}><div><h2>Pending invites</h2><p>{pendingCount ? `${pendingCount} awaiting response` : 'Invitations will appear here'}</p></div><Mail size={16} /></div>{pending.length ? <div className={styles.inviteList}>{pending.map((invite) => <div className={styles.inviteItem} key={invite.id}><span className={styles.inviteEmail}>{invite.email}</span><span className={styles.inviteMeta}>{invite.role} · Sent {prettyDate(invite.sentAt)}</span><div className={styles.inviteActions}>{daysOld(invite.sentAt) >= 7 && <span className={styles.expiredChip}>Expired · 7 days</span>}<button type="button" onClick={() => resendInvite(invite)}>Resend</button><button type="button" className={styles.dangerText} onClick={() => setConfirmAction({ kind: 'revoke', row: rows.find((row) => row.id === invite.id)! })}>Revoke</button></div></div>)}</div> : <div className={styles.sideEmpty}>No pending invitations.</div>}{canManage && <button type="button" className={styles.sideLink} onClick={() => { setInviteError(''); setInviteOpen(true); }}><Plus size={14} /> Invite someone</button>}</section>
        <section className={styles.sideCard}><div className={styles.sideCardHeading}><div><h2>Need more people?</h2><p>Plan your next hire</p></div><BriefcaseBusiness size={16} /></div><div className={styles.hiringMessage}><span className={styles.hiringIcon}><Users size={18} /></span><p>{data.startup.currentStage === 'idea' ? 'Early teams often focus on validating customer needs and defining the first product roles.' : data.startup.currentStage === 'prototype' ? 'Teams at the prototype stage often consider engineering and design needs.' : 'Review your team plan and hiring priorities for the current stage.'}</p></div><div className={styles.notConnected}>Open roles and applicant counts are not connected.</div><div className={styles.hiringActions}><Link href="/startup/hiring" className={styles.secondaryButton}>View hiring requests</Link><Link href="/startup/hiring" className={styles.sideLink}>Post a job <ArrowRight size={14} /></Link></div></section>
      </aside>
    </div>

    {inviteOpen && canManage && <InviteModal existingEmails={[...data.team.map((member) => member.email.toLowerCase()), ...pending.map((invite) => invite.email.toLowerCase())]} companyEmail={data.startup.founderEmail} onClose={() => setInviteOpen(false)} onSubmit={(invites) => {
      setInviteError('');
      const duplicate = invites.find((item) => [...data.team, ...pending.map((invite) => ({ email: invite.email }))].some((member) => member.email.toLowerCase() === item.email));
      if (duplicate) { setInviteError(`${duplicate.email} is already on your team or has a pending invite.`); return; }
      const createdAt = new Date().toISOString();
      const records = invites.map((item) => ({ ...item, id: `inv-${Date.now()}-${Math.random().toString(36).slice(2,7)}`, name: item.email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()), sentAt: createdAt }));
      setPending((items) => [...records, ...items]); setInviteOpen(false); setInviteError(''); showToast(`${records.length} invite${records.length === 1 ? '' : 's'} prepared. Email delivery is not connected in this demo.`);
    }} error={inviteError} />}

    {permissionsOpen && <PermissionsModal onClose={() => setPermissionsOpen(false)} />}
    {confirmAction && <div className={styles.modalBackdrop} role="presentation" onMouseDown={() => setConfirmAction(null)}><div className={styles.confirmDialog} role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" onMouseDown={(event) => event.stopPropagation()}><div className={styles.confirmIcon}><Trash2 size={19} /></div><h2 id="confirm-title">{confirmAction.kind === 'remove' ? `Remove ${confirmAction.row.name}?` : confirmAction.kind === 'revoke' ? `Revoke invite to ${confirmAction.row.email}?` : `${confirmAction.row.status === 'Deactivated' ? 'Reactivate' : 'Deactivate'} ${confirmAction.row.name}?`}</h2><p>{confirmAction.kind === 'remove' ? 'They will lose access immediately. Any assigned tasks will be marked Unassigned.' : confirmAction.kind === 'revoke' ? 'This invitation will be removed and will no longer be valid.' : 'Their workspace access will be updated immediately.'}</p><div className={styles.dialogActions}><button type="button" className={styles.secondaryButton} onClick={() => setConfirmAction(null)}>Cancel</button><button type="button" className={styles.dangerButton} onClick={finishConfirm}>{confirmAction.kind === 'remove' ? 'Remove member' : confirmAction.kind === 'revoke' ? 'Revoke invite' : confirmAction.row.status === 'Deactivated' ? 'Reactivate' : 'Deactivate'}</button></div></div></div>}
    {drawerMember && <MemberDrawer member={drawerMember} currentRole={currentRole} currentUserName={data.startup.founderName} taskCount={data.tasks.filter((task) => task.owner === drawerMember.name).length} documentCount={data.documents.length} onClose={() => setDrawerMember(null)} onMessage={() => showToast('Messaging is not connected in this demo.')} onUpdate={(updates) => { updateTeamMember(drawerMember.id, updates); setDrawerMember((member) => member ? { ...member, ...updates } : null); }} onDeactivate={() => { setConfirmAction({ kind: 'deactivate', row: rows.find((row) => row.member?.id === drawerMember.id)! }); setDrawerMember(null); }} />}
    {toast && <div className={styles.toast} role="status"><CheckCircle2Icon /><span>{toast.text}</span>{toast.undo && <button type="button" onClick={() => { toast.undo?.(); setToast(null); }}>Undo</button>}<button className={styles.toastClose} type="button" onClick={() => setToast(null)} aria-label="Dismiss"><X size={14} /></button></div>}
    {canManage && <button className={styles.mobileInvite} type="button" onClick={() => setInviteOpen(true)}><Plus size={17} /> Invite member</button>}
  </div>;
}

function EmptyResults({ onClear, canInvite, onInvite }: { onClear: () => void; canInvite: boolean; onInvite: () => void }) {
  return <div className={styles.emptyState}><span className={styles.emptyIcon}><Users size={21} /></span><h3>No members match your filters.</h3><p>Try clearing filters or invite a teammate to get started.</p><div><button className={styles.secondaryButton} type="button" onClick={onClear}>Clear filters</button>{canInvite && <button className={styles.primaryButton} type="button" onClick={onInvite}><Plus size={14} /> Invite member</button>}</div></div>;
}

function InviteModal({ existingEmails, companyEmail, onClose, onSubmit, error }: { existingEmails: string[]; companyEmail: string; onClose: () => void; onSubmit: (invites: Array<{ email: string; title: string; department: string; role: AccessRole; message: string; showOnPublicProfile: boolean }>) => void; error: string }) {
  const [emails, setEmails] = useState(''); const [title, setTitle] = useState(''); const [department, setDepartment] = useState(''); const [role, setRole] = useState<AccessRole>('Member'); const [message, setMessage] = useState(''); const [showPublic, setShowPublic] = useState(false); const [localError, setLocalError] = useState('');
  const parsed = parseEmails(emails); const domain = companyEmail.split('@')[1]?.toLowerCase(); const outside = domain ? parsed.filter((email) => email.split('@')[1] !== domain) : [];
  const submit = (event: React.FormEvent) => { event.preventDefault(); if (parsed.length < 1) { setLocalError('Enter at least one email address.'); return; } if (parsed.length > 20) { setLocalError('Invite up to 20 people at a time.'); return; } if (parsed.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) { setLocalError('Check the email address format and try again.'); return; } if (parsed.some((email) => existingEmails.includes(email))) { setLocalError('One or more addresses already have access or a pending invitation.'); return; } if (title.length > 60) { setLocalError('Title must be 60 characters or fewer.'); return; } setLocalError(''); onSubmit(parsed.map((email) => ({ email, title: title.trim(), department, role, message: message.trim(), showOnPublicProfile: showPublic }))); };
  return <div className={styles.modalBackdrop} role="presentation" onMouseDown={onClose}><div className={styles.inviteDialog} role="dialog" aria-modal="true" aria-labelledby="invite-title" onMouseDown={(event) => event.stopPropagation()}><div className={styles.dialogHeader}><div><span className={styles.eyebrow}>Team access</span><h2 id="invite-title">Invite team members</h2></div><button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close invite dialog"><X size={18} /></button></div><form onSubmit={submit}><label className={styles.formField}><span>Email addresses <small>Up to 20, comma-separated</small></span><textarea autoFocus rows={3} value={emails} onChange={(event) => { setEmails(event.target.value); setLocalError(''); }} placeholder="name@company.com, teammate@example.com" required /></label><div className={styles.formRow}><label className={styles.formField}><span>Title <small>Optional · max 60</small></span><input maxLength={60} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Product designer" /></label><label className={styles.formField}><span>Department</span><select value={department} onChange={(event) => setDepartment(event.target.value)}><option value="">Not set</option>{DEPARTMENTS.map((item) => <option key={item}>{item}</option>)}</select></label></div><div className={styles.formRow}><label className={styles.formField}><span>Access role</span><select value={role} onChange={(event) => setRole(event.target.value as AccessRole)}><option>Admin</option><option>Member</option><option>Viewer</option></select></label><label className={styles.formField}><span>Personal message <small>Optional</small></span><input maxLength={240} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Add a short note" /></label></div><label className={styles.publicInvite}><input type="checkbox" checked={showPublic} onChange={(event) => setShowPublic(event.target.checked)} /><span>Show on public startup profile after they join</span></label>{outside.length > 0 && <div className={styles.domainWarning}><CircleHelp size={15} /><span>{outside.length === 1 ? outside[0] : `${outside.length} emails`} {outside.length === 1 ? 'is' : 'are'} outside your company domain ({domain}). Continue if you recognize them.</span></div>}{(error || localError) && <p className={styles.inlineError} role="alert">{error || localError}</p>}<p className={styles.expiryNote}><ShieldCheck size={14} /> Invites expire after 7 days. Existing platform users can join with their current account.</p><div className={styles.dialogActions}><button type="button" className={styles.secondaryButton} onClick={onClose}>Cancel</button><button type="submit" className={styles.primaryButton}><Mail size={15} /> Send invite{parsed.length > 1 ? `s (${parsed.length})` : ''}</button></div></form></div></div>;
}

function MemberDrawer({ member, currentRole, currentUserName, taskCount, documentCount, onClose, onMessage, onUpdate, onDeactivate }: { member: StartupTeamMember; currentRole: AccessRole; currentUserName: string; taskCount: number; documentCount: number; onClose: () => void; onMessage: () => void; onUpdate: (updates: Partial<StartupTeamMember>) => void; onDeactivate: () => void }) {
  const [bio, setBio] = useState(member.bio || ''); const [publicBio, setPublicBio] = useState(member.publicBio || ''); const [title, setTitle] = useState(member.role); const [department, setDepartment] = useState(member.department || ''); const [location, setLocation] = useState(member.location || ''); const [linkedin, setLinkedin] = useState(member.linkedin || ''); const canManageMember = currentRole === 'Owner' || (currentRole === 'Admin' && member.permission !== 'Owner'); const canEdit = canManageMember || member.name === currentUserName;
  const access = ROLE_COPY[member.permission];
  return <div className={styles.drawerBackdrop} role="presentation" onMouseDown={onClose}><aside className={styles.memberDrawer} role="dialog" aria-modal="true" aria-labelledby="drawer-member-name" onMouseDown={(event) => event.stopPropagation()}><header className={styles.drawerHeader}><div className={styles.drawerIdentity}><span className={styles.avatarLarge}>{initials(member.name)}</span><div><h2 id="drawer-member-name">{member.name}</h2><p>{member.role}</p></div></div><button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close member details"><X size={18} /></button></header><div className={styles.drawerStatus}><span className={`${styles.statusChip} ${member.status === 'Deactivated' ? styles.statusInactive : styles.statusActive}`}><i />{member.status || 'Active'}</span><button type="button" className={styles.secondaryButton} onClick={onMessage}><MessageSquare size={14} /> Message</button></div><div className={styles.drawerBody}><section><h3>About</h3>{canEdit ? <><label className={styles.formField}><span>Title <small>Max 60 characters</small></span><input maxLength={60} value={title} onChange={(event) => setTitle(event.target.value)} onBlur={() => onUpdate({ role: title })} /></label><label className={styles.formField}><span>Bio <small>Max 280 characters</small></span><textarea maxLength={280} rows={4} value={bio} onChange={(event) => setBio(event.target.value)} onBlur={() => onUpdate({ bio })} placeholder="Add a short introduction" /></label><label className={styles.formField}><span>Department</span><select value={department} onChange={(event) => { setDepartment(event.target.value); onUpdate({ department: event.target.value }); }}><option value="">Not set</option>{DEPARTMENTS.map((item) => <option key={item}>{item}</option>)}</select></label><label className={styles.formField}><span>Location</span><input value={location} onChange={(event) => setLocation(event.target.value)} onBlur={() => onUpdate({ location })} placeholder="City, country" /></label><label className={styles.formField}><span>LinkedIn URL</span><input type="url" value={linkedin} onChange={(event) => setLinkedin(event.target.value)} onBlur={() => onUpdate({ linkedin })} placeholder="https://linkedin.com/in/…" /></label></> : <p>{member.bio || 'No bio provided.'}</p>}<div className={styles.drawerFacts}><span>Department <strong>{department || 'Not set'}</strong></span><span>Location <strong>{location || 'Not provided'}</strong></span>{linkedin && <a href={linkedin} target="_blank" rel="noreferrer"><Link2 size={13} /> LinkedIn</a>}</div></section><section><h3>Access</h3><div className={styles.drawerAccess}><span className={styles.roleChip}>{member.permission}</span><p>{access}</p></div></section><section><h3>Workspace activity</h3><div className={styles.activityFacts}><span><CheckCheck size={14} /> Tasks assigned <strong>{taskCount}</strong></span><span><FileText size={14} /> Workspace documents <strong>{documentCount}</strong></span><small>Last active status is not tracked in this workspace.</small></div></section><section><h3>Public profile</h3>{canEdit ? <><label className={styles.publicInvite}><input type="checkbox" checked={member.showOnPublicProfile === true} onChange={(event) => onUpdate({ showOnPublicProfile: event.target.checked })} /><span>Show this member on the public startup profile</span></label><label className={styles.formField}><span>Public bio</span><textarea maxLength={280} rows={3} value={publicBio} onChange={(event) => setPublicBio(event.target.value)} onBlur={() => onUpdate({ publicBio })} placeholder="Optional public-facing bio" /></label></> : <p>{member.showOnPublicProfile ? member.publicBio || member.bio || 'Public bio not added.' : 'This member is not shown on the public profile.'}</p>}</section>{canManageMember && <section className={styles.dangerZone}><h3>Danger zone</h3><p>Changing access affects this member’s workspace permissions.</p><button type="button" className={styles.dangerButton} onClick={onDeactivate}>{member.status === 'Deactivated' ? 'Reactivate access' : 'Deactivate access'}</button></section>}</div></aside></div>;
}

function PermissionsModal({ onClose }: { onClose: () => void }) {
  const modules = ['Tasks', 'Documents', 'Data room', 'Investors', 'Billing', 'Hiring'];
  const permissions: Record<string, boolean[]> = { Tasks: [true, true, true, true], Documents: [true, true, true, true], 'Data room': [true, true, false, false], Investors: [true, true, false, false], Billing: [true, false, false, false], Hiring: [true, true, true, false] };
  return <div className={styles.modalBackdrop} role="presentation" onMouseDown={onClose}><div className={styles.permissionsDialog} role="dialog" aria-modal="true" aria-labelledby="permissions-title" onMouseDown={(event) => event.stopPropagation()}><div className={styles.dialogHeader}><div><span className={styles.eyebrow}>Access reference</span><h2 id="permissions-title">Permissions matrix</h2></div><button className={styles.closeButton} type="button" onClick={onClose} aria-label="Close permissions matrix"><X size={18} /></button></div><div className={styles.matrixScroll}><table className={styles.matrixTable}><thead><tr><th scope="col">Module</th>{ROLE_OPTIONS.map((role) => <th scope="col" key={role}>{role}</th>)}</tr></thead><tbody>{modules.map((module) => <tr key={module}><th scope="row">{module}</th>{permissions[module].map((allowed, index) => <td key={index} aria-label={`${ROLE_OPTIONS[index]} ${allowed ? 'can access' : 'no access'} to ${module}`}>{allowed ? <Check size={15} /> : '—'}</td>)}</tr>)}</tbody></table></div><p className={styles.caption}>Illustrative access guide. Fine-grained permissions will be configured by workspace policy.</p></div></div>;
}
function RowsIcon() { return <span className={styles.rowsGlyph} aria-hidden="true"><i /><i /><i /></span>; }
function CardIcon() { return <span className={styles.cardsGlyph} aria-hidden="true"><i /><i /><i /><i /></span>; }
function CheckCircle2Icon() { return <CheckCheck size={16} aria-hidden="true" />; }
