'use client';
import {useEffect, useMemo, useState} from 'react';
import Link from 'next/link';
import { StartupSidebar, Button, StatusBadge } from '../../../components';
import {useAuth} from '@/lib/auth-context';
import {api, ApiError} from '@/lib/api/client';
import {
  Briefcase,Search,Bell,ChevronDown,Check,Plus,ArrowUpRight,ArrowRight,Mail,
  Building2,X,MoreHorizontal,RefreshCw,Trash2,Shield,Clock,Download,Grid2X2,List,
  Linkedin,MapPin,CheckCircle2,Send,ExternalLink,Menu,Users
} from 'lucide-react';

// Step 3d item 10: these mirror the API's department enum exactly, so a
// member in people/legal/support is still filterable. Display names are
// capitalised; the API values are lowercase.
const depts = ['Engineering', 'Product', 'Design', 'Sales', 'Marketing', 'Operations', 'Finance', 'People', 'Legal', 'Support', 'Other'];

export default function TeamDirectory() {
  const [mobile, setMobile] = useState(false);
  const [compact, setCompact] = useState(false);
  const [people, setPeople] = useState([]);
  const [invites, setInvites] = useState([]);
  const [summary, setSummary] = useState(null);
  const [permissions, setPermissions] = useState(null);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('All roles');
  const [status, setStatus] = useState('All statuses');
  const [department, setDepartment] = useState('All departments');
  const [view, setView] = useState('Table');
  const [sort, setSort] = useState('Name');
  const [selected, setSelected] = useState([]);
  const [member, setMember] = useState(null);
  const [invite, setInvite] = useState(false);
  const [emails, setEmails] = useState('');
  const [inviteRole, setInviteRole] = useState('Member');
  const [inviteTitle, setInviteTitle] = useState('');
  const [inviteDept, setInviteDept] = useState('Other');
  const [inviteMessage, setInviteMessage] = useState('');
  const [publicInvite, setPublicInvite] = useState(true);
  const [toast, setToast] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [showPermissions, setShowPermissions] = useState(false);
  const [menuId, setMenuId] = useState(null);
  // Step 3d: server-side validation errors, keyed by field name, so the
  // invite form can show them on the offending input.
  const [fieldErrors, setFieldErrors] = useState({});

  const notify = s => {
    setToast(s);
    setTimeout(() => setToast(''), 2800);
  };

  // Step 3b mapping: backend enums <-> the page's display strings.
  const roleToDisplay = r => ({owner: 'Owner', admin: 'Admin', member: 'Member', viewer: 'Viewer'}[r] || r);
  const roleToApi = r => ({Owner: 'owner', Admin: 'admin', Member: 'member', Viewer: 'viewer'}[r] || 'member');
  const deptToDisplay = d => (d ? d.charAt(0).toUpperCase() + d.slice(1) : 'Other');
  const deptToApi = d => (d || 'Other').toLowerCase();

  const {user} = useAuth();
  const [orgId, setOrgId] = useState(null);
  const [orgName, setOrgName] = useState('');
  const [teamStatus, setTeamStatus] = useState('loading'); // loading | ready | none | error
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  // Step 3d item 7: the permission matrix is served by the API, so this
  // page can never describe rules the backend does not enforce.
  const manageActions = permissions?.actions ?? [];
  const canManage = people.some(p => p.can_manage) || summary?.my_role === 'owner' || summary?.my_role === 'admin';
  const canExport = manageActions.some(a => a.key === 'export_team' && a.roles.includes(summary?.my_role));

  const rowFromMember = m => ({
    id: m.user_id,
    name: m.display_name || (m.email || '').split('@')[0],
    email: m.email || '',
    title: m.title || 'Team member',
    role: roleToDisplay(m.role),
    dept: m.department ? deptToDisplay(m.department) : 'Other',
    status: m.status === 'deactivated' ? 'Deactivated' : 'Active',
    joined: m.joined_at ? new Date(m.joined_at).toLocaleDateString('en-US', {month: 'short', day: '2-digit', year: 'numeric'}) : '—',
    initial: m.avatar_initials || (m.display_name || m.email || '?').slice(0, 2).toUpperCase(),
    founder: m.is_founder,
    bio: m.bio || '',
    tasks: m.task_count ?? 0,
    // Step 3d item 5: real last_active_at, no more '—'.
    active: m.last_active_at
      ? new Date(m.last_active_at).toLocaleString('en-US', {month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'})
      : 'Never',
    public: m.is_public,
    linkedin: m.linkedin_url || null,
    canManage: m.can_manage,
    isInvite: false
  });

  const rowFromInvite = inv => ({
    id: inv.id,
    name: inv.email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    email: inv.email,
    title: inv.title || 'Team member',
    role: roleToDisplay(inv.role),
    dept: inv.department ? deptToDisplay(inv.department) : 'Other',
    status: 'Pending',
    joined: 'Invite sent',
    initial: inv.email.slice(0, 2).toUpperCase(),
    founder: false,
    bio: inv.message || '',
    tasks: 0,
    active: 'Invite pending',
    public: inv.is_public,
    linkedin: null,
    canManage: true,
    isInvite: true
  });

  // --- server-side filters (item 10) ---------------------------------------
  const apiQuery = () => {
    const q = {};
    const apiRole = {Owner: 'owner', Admin: 'admin', Member: 'member', Viewer: 'viewer'}[role];
    if (apiRole) q.role = apiRole;
    if (status === 'Deactivated') q.status = 'deactivated';
    else if (status === 'Pending') q.status = 'invited';
    else if (status === 'Active') q.status = 'active';
    if (department !== 'All departments') q.department = deptToApi(department);
    if (query.trim()) q.q = query.trim();
    q.sort = sort === 'Joined date' ? 'joined' : sort === 'Role' ? 'name' : 'name';
    return q;
  };

  const loadTeam = async () => {
    setTeamStatus('loading');
    setActionError('');
    try {
      const orgs = await api.organizations.mine();
      const startup = orgs.find(o => o.type === 'startup');
      if (!startup) {
        setTeamStatus('none');
        return;
      }
      setOrgId(startup.id);
      setOrgName(startup.name);
      const [page, pendingInvites, teamSummary] = await Promise.all([
        api.organizations.members(startup.id, {...apiQuery(), status: status === 'All statuses' ? 'all' : apiQuery().status, limit: 100}),
        api.organizations.invites(startup.id),
        api.organizations.teamSummary(startup.id)
      ]);
      setPeople(page.items.map(rowFromMember));
      setTotal(page.total);
      setInvites(pendingInvites);
      setSummary(teamSummary);
      setTeamStatus('ready');
    } catch (err) {
      setTeamStatus('error');
      notify(err instanceof ApiError ? err.message : 'Could not load the team.');
    }
  };

  // Permission matrix once per mount (it is static reference data).
  useEffect(() => {
    let alive = true;
    api.organizations.permissions()
      .then(m => { if (alive) setPermissions(m); })
      .catch(() => { /* the page still works; the modal falls back below */ });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    loadTeam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Re-query the server when a filter/sort/search changes (item 10): the
  // list is no longer filtered in the browser, so it keeps working past
  // one page of results.
  useEffect(() => {
    if (!orgId) return;
    const t = setTimeout(() => { loadTeam(); }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, role, status, department, sort]);

  const pending = invites.length;
  const active = summary?.active_members ?? people.filter(p => p.status === 'Active').length;

  // Pending invites are shown alongside active members; both come from the
  // API (members page + invites list), so nothing is invented client-side.
  const rows = useMemo(() => [...people, ...invites.map(rowFromInvite)], [people, invites]);

  // Server filters already applied, so this only narrows the invite rows
  // (which have no server-side equivalent in this step).
  const filtered = useMemo(
    () =>
      rows.filter(p => {
        if (!p.isInvite) return true; // already filtered by the API
        return (
          (!query || `${p.name} ${p.email} ${p.title}`.toLowerCase().includes(query.toLowerCase())) &&
          (role === 'All roles' || p.role === role) &&
          (status === 'All statuses' || status === 'Pending' || status === 'Active' ? status === 'Pending' : false) &&
          (department === 'All departments' || p.dept === department)
        );
      }),
    [rows, query, role, status, department]
  );

  const patchMember = async (userId, body) => {
    if (!orgId) return;
    setActionError('');
    try {
      const row = await api.organizations.updateMember(orgId, userId, body);
      setPeople(prev => prev.map(p => (p.id === userId ? rowFromMember(row) : p)));
      if (member && member.id === userId) setMember(rowFromMember(row));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not update the member.');
      notify(err instanceof ApiError ? err.message : 'Could not update the member.');
      await loadTeam();
    }
  };

  const saveMemberDetails = async () => {
    if (!member || member.isInvite || busy) return;
    setBusy(true);
    setActionError('');
    try {
      await api.organizations.updateMember(orgId, member.id, {
        title: member.title || null,
        department: deptToApi(member.dept)
      });
      notify('Member details saved.');
      await loadTeam();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not save the member.');
      notify(err instanceof ApiError ? err.message : 'Could not save the member.');
    } finally {
      setBusy(false);
    }
  };

  const inviteSubmit = async e => {
    e.preventDefault();
    const list = [...new Set(emails.split(/[;,\n]+/).map(x => x.trim()).filter(Boolean))];
    setFieldErrors({});
    if (!list.length) {
      setFieldErrors({emails: 'Enter at least one email address.'});
      return;
    }
    if (list.length > 20) {
      setFieldErrors({emails: 'Invite up to 20 people at a time.'});
      return;
    }
    const existing = list.find(email => rows.some(p => (p.email || '').toLowerCase() === email.toLowerCase()));
    if (existing) {
      setFieldErrors({emails: `${existing} is already on this team.`});
      return;
    }
    if (!orgId) {
      notify('Create your startup organization first.');
      return;
    }
    setBusy(true);
    try {
      for (const email of list) {
        // Step 3d item 3: the API emails the accept link itself and returns
        // the one-time token, so no clipboard fallback is needed any more.
        await api.organizations.createInvite(orgId, {
          email,
          role: roleToApi(inviteRole),
          title: inviteTitle || null,
          department: deptToApi(inviteDept),
          message: inviteMessage || null,
          is_public: publicInvite
        });
      }
      setEmails('');
      setInviteMessage('');
      setInvite(false);
      notify(`Invite sent to ${list.length === 1 ? list[0] : `${list.length} people`}.`);
      await loadTeam();
    } catch (err) {
      if (err instanceof ApiError && err.status === 422 && Array.isArray(err.details)) {
        // Show server validation errors on the field the API named.
        const mapped = {};
        for (const d of err.details) {
          const field = Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : null;
          if (field) mapped[field === 'email' ? 'emails' : field] = d.msg || 'Invalid value';
        }
        setFieldErrors(mapped);
        if (!Object.keys(mapped).length) notify(err.message);
      } else {
        notify(err instanceof ApiError ? err.message : 'Could not create the invite.');
      }
    } finally {
      setBusy(false);
    }
  };

  const resendInvite = async inviteId => {
    setBusy(true);
    setActionError('');
    try {
      await api.organizations.resendInvite(orgId, inviteId);
      notify('Invite resent with a fresh link.');
      setMenuId(null);
      await loadTeam();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not resend the invite.');
      notify(err instanceof ApiError ? err.message : 'Could not resend the invite.');
    } finally {
      setBusy(false);
    }
  };

  const revokeInvite = async inviteId => {
    setBusy(true);
    setActionError('');
    try {
      await api.organizations.revokeInvite(orgId, inviteId);
      notify('Invite revoked.');
      setMenuId(null);
      setMember(null);
      await loadTeam();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not revoke the invite.');
      notify(err instanceof ApiError ? err.message : 'Could not revoke the invite.');
    } finally {
      setBusy(false);
    }
  };

  const deactivateMember = async userId => {
    setBusy(true);
    setActionError('');
    try {
      await api.organizations.deactivateMember(orgId, userId);
      notify('Member access deactivated.');
      setMenuId(null);
      setMember(null);
      await loadTeam();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not deactivate the member.');
      notify(err instanceof ApiError ? err.message : 'Could not deactivate the member.');
    } finally {
      setBusy(false);
    }
  };

  const reactivateMember = async userId => {
    setBusy(true);
    setActionError('');
    try {
      await api.organizations.reactivateMember(orgId, userId);
      notify('Member reactivated.');
      setMenuId(null);
      setMember(null);
      await loadTeam();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not reactivate the member.');
      notify(err instanceof ApiError ? err.message : 'Could not reactivate the member.');
    } finally {
      setBusy(false);
    }
  };

  const changeRole = async (id, newRole) => {
    if (!orgId) return;
    if (newRole === 'Owner') {
      // The API refuses role=owner on purpose (422 OWNER_VIA_TRANSFER_ONLY):
      // ownership only moves through transfer, which also demotes the
      // outgoing owner. Say that instead of firing a doomed request.
      notify('To make someone an owner, use transfer ownership.');
      return;
    }
    setActionError('');
    const prev = people;
    setPeople(people.map(p => (p.id === id ? {...p, role: newRole} : p)));
    if (member && member.id === id) setMember({...member, role: newRole});
    try {
      await api.organizations.updateMember(orgId, id, {role: roleToApi(newRole)});
      notify('Access role updated.');
      await loadTeam();
    } catch (err) {
      setPeople(prev);
      if (member && member.id === id) setMember({...member, role: member.role});
      setActionError(err instanceof ApiError ? err.message : 'Could not update the role.');
      notify(err instanceof ApiError ? err.message : 'Could not update the role.');
    }
  };

  const remove = async id => {
    const p = rows.find(x => x.id === id);
    setBusy(true);
    setActionError('');
    try {
      if (p?.isInvite) await api.organizations.revokeInvite(orgId, id);
      else await api.organizations.removeMember(orgId, id);
      setSelected(selected.filter(x => x !== id));
      setConfirm(null);
      setMember(null);
      notify(`${p?.name} removed from the team.`);
      await loadTeam();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not remove from the team.');
      notify(err instanceof ApiError ? err.message : 'Could not remove from the team.');
    } finally {
      setBusy(false);
    }
  };

  // Step 3d item 4: one request, all-or-nothing.
  const bulkAction = async action => {
    if (!orgId || !selected.length) return;
    setBusy(true);
    setActionError('');
    try {
      const res = await api.organizations.bulkMemberAction(orgId, {
        action,
        user_ids: selected
      });
      setSelected([]);
      setConfirm(null);
      notify(`${res.affected} member(s) updated.`);
      await loadTeam();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not apply the change.');
      notify(err instanceof ApiError ? err.message : 'Could not apply the change.');
    } finally {
      setBusy(false);
    }
  };

  // Step 3d item 9: server-built CSV covering the whole team.
  const exportCsv = async () => {
    if (!orgId) return;
    setActionError('');
    try {
      const csv = await api.organizations.exportMembersCsv(orgId);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], {type: 'text/csv'}));
      a.download = 'team.csv';
      a.click();
      URL.revokeObjectURL(a.href);
      notify('Team list exported as CSV.');
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not export the team.');
      notify(err instanceof ApiError ? err.message : 'Could not export the team.');
    }
  };

  const toggleSelected = id => setSelected(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  // Only rows the caller may act on are selectable (pending invites have
  // their own resend/revoke path).
  const selectable = filtered.filter(x => !x.isInvite && x.canManage);
  const selectAll = () =>
    setSelected(selected.length === selectable.length ? [] : selectable.map(x => x.id));

  const statusBadge = s => <StatusBadge status={s} />;

  const actionMenu = p => (
    <div className="relative">
      <button
        type="button"
        onClick={() => setMenuId(menuId === p.id ? null : p.id)}
        aria-label={`Actions for ${p.name}`}
        className="grid h-9 w-9 place-items-center rounded-lg hover:bg-[#F4F1EA]"
      >
        <MoreHorizontal size={18} />
      </button>
      {menuId === p.id && (
        <div className="absolute right-0 top-9 z-10 w-48 rounded-xl border border-[#E5E1D8] bg-white p-1.5 shadow-lg">
          {[
            ['View profile', () => { setMember(p); setMenuId(null); }],
            ...(p.status === 'Pending'
              ? [
                  ['Resend invite', () => { resendInvite(p.id); setMenuId(null); }],
                  ['Revoke invite', () => { revokeInvite(p.id); setMenuId(null); }]
                ]
              : []),
            ...(!p.isInvite && p.canManage
              ? [
                  ['Edit title & department', () => { setMember(p); setMenuId(null); }],
                  ['Change access role', () => { setMember(p); setMenuId(null); }],
                  ...(p.status !== 'Deactivated'
                    ? [['Deactivate access', () => { deactivateMember(p.id); setMenuId(null); }]]
                    : [['Reactivate access', () => { reactivateMember(p.id); setMenuId(null); }]])
                ]
              : []),
            ...(p.canManage || p.isInvite
              ? [['Remove from team', () => { setConfirm(p); setMenuId(null); }]]
              : [])
          ].map(([label, fn]) => (
            <button
              type="button"
              key={label}
              onClick={fn}
              className={`block w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-[#FAF8F4] ${label === 'Remove from team' ? 'text-[#B42318]' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const memberCard = p => (
    <article key={p.id} className="rounded-xl border border-[#E5E1D8] bg-white p-4 transition hover:border-[#B8955A]">
      <div className="flex items-start gap-3">
        <button type="button" onClick={() => setMember(p)} className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[#F3EBDD] text-sm font-semibold text-ink">
          {p.initial}
        </button>
        <div className="min-w-0 flex-1">
          <button type="button" onClick={() => setMember(p)} className="text-left text-sm font-semibold hover:underline">
            {p.name}
          </button>
          {p.founder && <span className="ml-2 rounded-full bg-[#F3EBDD] px-2 py-0.5 text-[10px] font-semibold text-[#806236]">Founder</span>}
          <p className="mt-0.5 text-xs text-[#4A5568]">{p.title}</p>
          <p className="mt-1 truncate text-xs text-[#4A5568]">{p.email}</p>
        </div>
        {actionMenu(p)}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full bg-[#F3F4F6] px-2.5 py-1 text-[11px]">{p.role}</span>
        <span className="rounded-full bg-[#F3F4F6] px-2.5 py-1 text-[11px]">{p.dept}</span>
        {statusBadge(p.status)}
      </div>
      <p className="mt-3 line-clamp-2 min-h-10 text-xs leading-5 text-[#4A5568]">
        {p.bio || 'Invitation sent. Their profile will appear when they join.'}
      </p>
      <div className="mt-3 flex items-center justify-between border-t border-[#E5E1D8] pt-3">
        {/* Step 3d item 14: direct messages are Step 11. Disabled with a
            clear label rather than a toast that pretends to work. */}
        <button
          type="button"
          disabled
          title="Direct messages arrive in Step 11"
          className="cursor-not-allowed text-xs font-semibold text-[#A0A7B4]"
        >
          Message <span className="ml-1 rounded bg-[#F3F4F6] px-1 py-0.5 text-[9px] font-medium text-[#7B8CA3]">Soon</span>
        </button>
        <button type="button" onClick={() => setMember(p)} className="text-xs text-[#4A5568]">
          View details <ArrowRight className="inline" size={13} />
        </button>
      </div>
    </article>
  );

  return (
    <div className="min-h-screen bg-[#FAF8F4] text-[#0F1B2D]">
      <a href="#team-main" className="sr-only focus:not-sr-only">
        Skip to content
      </a>

      {/* Shared Startup Sidebar */}
      <StartupSidebar
        active="Team"
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
            <input aria-label="Search workspace" placeholder="Search anything…" className="h-10 w-64 rounded-lg border border-[#E5E1D8] bg-white pl-9 text-sm" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Notifications are Step 11/14; the bell is inert by design and
              the unread dot is gone rather than implying unread items. */}
          <button
            type="button"
            disabled
            title="Notifications arrive in a later step"
            aria-label="Notifications (not available yet)"
            className="relative ml-auto grid h-10 w-10 cursor-not-allowed place-items-center text-[#A0A7B4]"
          >
            <Bell size={19} />
          </button>
          <Link href="/startup/user-profile" className="ml-3 flex items-center gap-2 rounded-lg p-1.5">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-ink text-xs font-semibold text-white">
              {(user?.display_name || user?.email || '?').slice(0, 2).toUpperCase()}
            </span>
            <span className="hidden text-xs sm:block">{user?.display_name || user?.email || 'Your account'}</span>
            <ChevronDown size={14} />
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main id="team-main" className={`mx-auto max-w-[1440px] px-4 pb-24 pt-7 transition-[margin] duration-200 sm:px-7 lg:px-8 ${compact ? 'lg:ml-[76px]' : 'lg:ml-[240px]'}`}>
        {teamStatus === 'loading' && (
          <div className="flex items-center gap-3 rounded-xl border border-[#E5E1D8] bg-white p-6 text-sm text-[#4A5568]">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/30 border-t-ink" />
            Loading your team…
          </div>
        )}
        {teamStatus === 'error' && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700" role="alert">
            {actionError || 'Could not load the team.'}{' '}
            <button type="button" onClick={loadTeam} className="font-semibold underline">Retry</button>
          </div>
        )}
        {teamStatus === 'none' && (
          <div className="max-w-xl rounded-xl border border-[#E5E1D8] bg-white p-6">
            <h2 className="serif text-xl font-semibold">No startup organization yet</h2>
            <p className="mt-1 text-sm text-[#4A5568]">
              Create your organization first — team members and invites live under it.
            </p>
            <Link href="/startup/profile" className="mt-4 inline-flex min-h-10 items-center rounded-lg bg-ink px-4 text-sm font-semibold text-white">
              Go to startup profile
            </Link>
          </div>
        )}
        {teamStatus === 'ready' && (
        <>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-[#4A5568]">
              {orgName || 'Your startup'} <span className="mx-2 text-[#B8955A]">·</span> Workspace
            </p>
            <h1 className="serif mt-1 text-[30px] font-semibold">Team</h1>
            <p className="mt-1 text-sm text-[#4A5568]">Manage who can access your startup workspace.</p>
          </div>
          <div className="flex gap-2">
            {canExport && (
              <Button secondary onClick={exportCsv} disabled={busy}>
                <Download size={16} /> Export list
              </Button>
            )}
            {canManage && (
              <Button onClick={() => setInvite(true)}>
                <Plus size={17} /> Invite member
              </Button>
            )}
          </div>
        </div>

        {/* Counter cards */}
        <div className="mb-5 grid grid-cols-3 overflow-hidden rounded-xl border border-[#E5E1D8] bg-white">
          <div className="p-4 sm:px-6">
            <p className="text-xs text-[#4A5568]">Members</p>
            <b className="serif mt-1 block text-2xl">
              {active} <small className="font-sans text-xs font-normal text-[#4A5568]">active</small>
            </b>
          </div>
          <div className="border-l border-[#E5E1D8] p-4 sm:px-6">
            <p className="text-xs text-[#4A5568]">Pending invites</p>
            <b className="serif mt-1 block text-2xl">
              {pending} <small className="font-sans text-xs font-normal text-[#8A5700]">awaiting response</small>
            </b>
          </div>
          <div className="border-l border-[#E5E1D8] p-4 sm:px-6">
            <p className="text-xs text-[#4A5568]">Open roles</p>
            {/* Step 3d item 6: the API returns null until Step 7a has jobs.
                An empty state, never a hard-coded number. */}
            {summary?.open_jobs_count == null ? (
              <p className="serif mt-1 text-sm text-[#7B8CA3]">
                Not tracked yet
                <Link href="/startup/hiring" className="ml-1 font-sans text-xs font-semibold text-[#9A7A45]">View hiring</Link>
              </p>
            ) : (
              <b className="serif mt-1 block text-2xl">
                {summary.open_jobs_count}{' '}
                <Link href="/startup/hiring" className="font-sans text-xs font-semibold text-[#9A7A45]">View hiring</Link>
              </b>
            )}
          </div>
        </div>

        <div className="grid items-start gap-5 xl:grid-cols-3">
          <div className="min-w-0 xl:col-span-2">
            <section className="mb-4 rounded-xl border border-[#E5E1D8] bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[200px] flex-1">
                  <Search size={16} className="absolute left-3 top-3 text-[#A0A7B4]" />
                  <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search name, email or role…"
                    className="h-10 w-full rounded-lg border border-[#E5E1D8] pl-9 text-sm outline-none focus:border-[#B8955A]"
                  />
                </div>
                <select aria-label="Filter by role" value={role} onChange={e => setRole(e.target.value)} className="h-10 rounded-lg border border-[#E5E1D8] bg-white px-2 text-xs">
                  <option>All roles</option>
                  {['Owner', 'Admin', 'Member', 'Viewer'].map(x => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
                <select aria-label="Filter by status" value={status} onChange={e => setStatus(e.target.value)} className="h-10 rounded-lg border border-[#E5E1D8] bg-white px-2 text-xs">
                  <option>All statuses</option>
                  {['Active', 'Pending', 'Deactivated'].map(x => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
                <select aria-label="Filter by department" value={department} onChange={e => setDepartment(e.target.value)} className="hidden h-10 rounded-lg border border-[#E5E1D8] bg-white px-2 text-xs md:block">
                  <option>All departments</option>
                  {depts.map(x => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setView(view === 'Table' ? 'Cards' : 'Table')}
                  aria-label={view === 'Table' ? 'Show card view' : 'Show table view'}
                  className="grid h-10 w-10 place-items-center rounded-lg border border-[#E5E1D8]"
                >
                  {view === 'Table' ? <Grid2X2 size={17} /> : <List size={17} />}
                </button>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-[#4A5568]">Showing {filtered.length} of {total + pending} people</span>
                <label className="flex items-center gap-2 text-xs text-[#4A5568]">
                  Sort by
                  <select value={sort} onChange={e => setSort(e.target.value)} className="rounded border-0 bg-transparent font-semibold text-ink">
                    <option>Name</option>
                    <option>Role</option>
                    <option>Joined date</option>
                  </select>
                </label>
              </div>
            </section>

            {/* Step 3d: server refusals (last owner, role hierarchy, wrong
                org) surface verbatim so the page never claims success. */}
            {actionError && teamStatus === 'ready' && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700" role="alert">
                {actionError}
              </div>
            )}

            {selected.length > 0 && (
              <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-[#DCC8A4] bg-[#F3EBDD] p-3 text-sm">
                <b>{selected.length} selected</b>
                {/* Step 3d item 4: bulk role changes are not part of this
                    step's API (deactivate/reactivate/remove only), so the
                    dead "Change role" control is removed rather than faked. */}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => bulkAction('deactivate')}
                  className="text-xs font-semibold text-[#806236] disabled:opacity-60"
                >
                  Deactivate
                </button>
                <button
                  type="button"
                  onClick={() => setConfirm({bulk: true, name: `${selected.length} selected members`})}
                  className="text-xs font-semibold text-[#B42318]"
                >
                  Remove
                </button>
                <button type="button" onClick={() => setSelected([])} className="ml-auto">
                  <X size={16} />
                </button>
              </div>
            )}

            {filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#E5E1D8] bg-white p-12 text-center">
                <Users className="mx-auto mb-3 text-[#A0A7B4]" />
                <h2 className="font-semibold">No members match your filters.</h2>
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setRole('All roles');
                    setStatus('All statuses');
                    setDepartment('All departments');
                  }}
                  className="mt-2 text-sm font-semibold text-[#9A7A45]"
                >
                  Clear filters
                </button>
              </div>
            ) : view === 'Cards' ? (
              <div className="grid gap-3 md:grid-cols-2">{filtered.map(memberCard)}</div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[#E5E1D8] bg-white">
                <table className="w-full min-w-[860px] border-collapse text-left">
                  <thead className="border-b border-[#E5E1D8] bg-[#FAF8F4]">
                    <tr className="text-[11px] font-semibold uppercase tracking-wide text-[#4A5568]">
                      <th className="w-10 px-3 py-3">
                        <input
                          type="checkbox"
                          checked={selected.length === selectable.length && selectable.length > 0}
                          onChange={selectAll}
                          aria-label="Select all members"
                          className="accent-ink"
                        />
                      </th>
                      <th scope="col" className="px-3 py-3">Member</th>
                      <th scope="col" className="px-3 py-3">Title</th>
                      <th scope="col" className="px-3 py-3">Access role</th>
                      <th scope="col" className="px-3 py-3">Department</th>
                      <th scope="col" className="px-3 py-3">Status</th>
                      <th scope="col" className="px-3 py-3">Joined</th>
                      <th scope="col" className="px-3 py-3">Public</th>
                      <th scope="col" className="px-2 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E1D8]">
                    {filtered.map(p => (
                      <tr key={p.id} className={`h-16 transition hover:bg-[#F4F1EA] ${selected.includes(p.id) ? 'bg-[#F3EBDD]' : ''}`}>
                        <td className="px-3">
                          <input
                            type="checkbox"
                            checked={selected.includes(p.id)}
                            onChange={() => toggleSelected(p.id)}
                            aria-label={`Select ${p.name}`}
                            className="accent-ink"
                          />
                        </td>
                        <td className="px-3">
                          <button type="button" onClick={() => setMember(p)} className="flex items-center gap-2.5 text-left">
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#F3EBDD] text-[11px] font-semibold">
                              {p.initial}
                            </span>
                            <span>
                              <b className="block whitespace-nowrap text-xs">
                                {p.name}
                                {p.founder && <span className="ml-1 rounded-full bg-[#F3EBDD] px-1.5 py-0.5 text-[9px] font-semibold text-[#806236]">Founder</span>}
                              </b>
                              <small className="text-[10px] text-[#4A5568]">{p.email}</small>
                            </span>
                          </button>
                        </td>
                        <td className="px-3 text-xs">{p.title}</td>
                        <td className="px-3">
                          {p.role === 'Owner' ? (
                            <span className="rounded-full bg-[#F3EBDD] px-2 py-1 text-[10px] font-semibold text-[#806236]">Owner</span>
                          ) : (
                            <select
                              aria-label={`Access role for ${p.name}`}
                              value={p.role}
                              disabled={!p.canManage || busy}
                              title={p.canManage ? undefined : 'Only owners and admins can change access'}
                              onChange={e => changeRole(p.id, e.target.value)}
                              className="rounded-lg border border-[#E5E1D8] bg-white px-2 py-1.5 text-[11px] disabled:opacity-60"
                            >
                              {['Admin', 'Member', 'Viewer'].map(x => (
                                <option key={x}>{x}</option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td className="px-3">
                          <span className="rounded-full bg-[#F3F4F6] px-2 py-1 text-[10px]">{p.dept}</span>
                        </td>
                        <td className="px-3">{statusBadge(p.status)}</td>
                        <td className="whitespace-nowrap px-3 text-[10px] text-[#4A5568]">{p.joined}</td>
                        <td className="px-3">
                          <input
                            aria-label={`Show ${p.name} on public profile`}
                            type="checkbox"
                            checked={p.public}
                            disabled={!p.canManage || p.isInvite || busy}
                            onChange={() => patchMember(p.id, {is_public: !p.public})}
                            className="h-4 w-4 accent-ink disabled:opacity-50"
                          />
                        </td>
                        <td className="px-2">{actionMenu(p)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <aside className="space-y-5">
            <section className="rounded-xl border border-[#E5E1D8] bg-white p-5">
              <h2 className="serif text-xl font-semibold">Roles at a glance</h2>
              <div className="mt-4 space-y-4">
                {/* Step 3d item 7: descriptions come from the API's matrix,
                    so this text cannot drift from the enforced rules. */}
                {(permissions?.roles ?? ['owner', 'admin', 'member', 'viewer']).map(r => (
                  <div key={r}>
                    <p className="text-sm font-semibold">{roleToDisplay(r)}</p>
                    <p className="mt-0.5 text-xs leading-5 text-[#4A5568]">
                      {(permissions?.actions ?? [])
                        .filter(a => a.roles.includes(r))
                        .map(a => a.label)
                        .join(' · ') || 'Read-only access.'}
                    </p>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setShowPermissions(true)} className="mt-4 text-xs font-semibold text-[#9A7A45]">
                See full permissions <ArrowRight className="inline" size={14} />
              </button>
            </section>

            <section className="rounded-xl border border-[#E5E1D8] bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="serif text-xl font-semibold">Pending invites</h2>
                <span className="rounded-full bg-[#FFF3D6] px-2 py-1 text-[10px] font-semibold text-[#8A5700]">{pending}</span>
              </div>
              {invites.length ? (
                invites.map(inv => (
                  <div key={inv.id} className="border-t border-[#E5E1D8] py-3">
                    <p className="truncate text-xs font-semibold">{inv.email}</p>
                    <p className="mt-1 text-[11px] text-[#4A5568]">
                      {roleToDisplay(inv.role)} · expires{' '}
                      {new Date(inv.expires_at).toLocaleDateString('en-US', {month: 'short', day: '2-digit'})}
                    </p>
                    <div className="mt-2 flex gap-3">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => resendInvite(inv.id)}
                        className="text-[11px] font-semibold text-[#9A7A45] disabled:opacity-60"
                      >
                        Resend
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => revokeInvite(inv.id)}
                        className="text-[11px] text-[#B42318] disabled:opacity-60"
                      >
                        Revoke
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-[#4A5568]">No outstanding invites.</p>
              )}
              {canManage && (
                <button type="button" onClick={() => setInvite(true)} className="mt-2 text-xs font-semibold text-[#9A7A45]">
                  Invite someone <Plus className="inline" size={13} />
                </button>
              )}
            </section>

            <section id="hiring" className="rounded-xl border border-[#E5E1D8] bg-white p-5">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#F3EBDD] text-[#806236]">
                <Briefcase size={17} />
              </div>
              <h2 className="serif mt-3 text-xl font-semibold">Need more people?</h2>
              <p className="mt-1 text-xs leading-5 text-[#4A5568]">
                {/* Step 3d item 6: hiring data belongs to Step 7a, so this
                    card states nothing it cannot back with real data. */}
                Post a role to start hiring — open roles will appear here once hiring is tracked.
              </p>
              <Link href="/startup/hiring" className="mt-3 block text-xs font-semibold text-[#9A7A45]">
                View hiring requests <ArrowRight className="inline" size={13} />
              </Link>
              <Link
                href="/startup/hiring/jobs/new"
                className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-[#E5E1D8] text-xs font-semibold hover:bg-[#FAF8F4]"
              >
                Post a job
              </Link>
            </section>
          </aside>
        </div>
        </>
        )}
      </main>

      {/* Invite Modal */}
      {invite && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#0F1B2D]/45 p-4" onMouseDown={e => { if (e.target === e.currentTarget) setInvite(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="invite-heading" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 id="invite-heading" className="serif text-2xl font-semibold">Invite team members</h2>
                <p className="mt-1 text-sm text-[#4A5568]">{orgName ? `They’ll get an email with a secure link to join ${orgName}.` : 'They’ll get an email with a secure link to join.'}</p>
              </div>
              <button type="button" onClick={() => setInvite(false)} aria-label="Close invite dialog" className="grid h-9 w-9 place-items-center rounded-lg hover:bg-[#FAF8F4]">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={inviteSubmit} className="space-y-4">
              <label className="block text-sm font-medium">
                Email addresses
                <textarea
                  autoFocus
                  required
                  value={emails}
                  onChange={e => setEmails(e.target.value)}
                  rows={3}
                  placeholder="name@company.com — paste multiple, comma-separated"
                  className="mt-2 w-full rounded-[10px] border border-[#E5E1D8] p-3 text-sm outline-none focus:border-[#B8955A] focus:ring-2 focus:ring-[#B8955A]/20"
                />
                {fieldErrors.emails ? (
                  <small className="mt-1 block text-xs font-normal text-[#B42318]" role="alert">
                    {fieldErrors.emails}
                  </small>
                ) : (
                  <small className="mt-1 block text-xs font-normal text-[#4A5568]">Up to 20 people. Invitations expire in 14 days.</small>
                )}
              </label>
              <label className="block text-sm font-medium">
                Title (optional)
                <input
                  value={inviteTitle}
                  onChange={e => setInviteTitle(e.target.value)}
                  maxLength={60}
                  placeholder="e.g. Product designer"
                  className="mt-2 h-11 w-full rounded-[10px] border border-[#E5E1D8] px-3 text-sm"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm font-medium">
                  Department
                  <select value={inviteDept} onChange={e => setInviteDept(e.target.value)} className="mt-2 h-11 w-full rounded-[10px] border border-[#E5E1D8] bg-white px-3 text-sm">
                    {depts.map(x => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-medium">
                  Access role
                  <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} className="mt-2 h-11 w-full rounded-[10px] border border-[#E5E1D8] bg-white px-3 text-sm">
                    {['Admin', 'Member', 'Viewer'].map(x => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block text-sm font-medium">
                Personal message (optional)
                <textarea
                  value={inviteMessage}
                  maxLength={500}
                  onChange={e => setInviteMessage(e.target.value)}
                  rows={2}
                  placeholder="Add a note to your invitation"
                  className="mt-2 w-full rounded-[10px] border border-[#E5E1D8] p-3 text-sm"
                />
              </label>
              <label className="flex items-center justify-between rounded-lg bg-[#FAF8F4] p-3 text-sm">
                <span>Show on public startup profile</span>
                <input type="checkbox" checked={publicInvite} onChange={() => setPublicInvite(!publicInvite)} className="h-4 w-4 accent-ink" />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setInvite(false)} className="min-h-10 px-4 text-sm">
                  Cancel
                </button>
                <Button type="submit">
                  <Send size={15} /> Send invite
                </Button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Member Details Drawer */}
      {member && (
        <div className="fixed inset-0 z-40 bg-[#0F1B2D]/35" onMouseDown={e => { if (e.target === e.currentTarget) setMember(null); }}>
          <aside role="dialog" aria-modal="true" aria-label={`${member.name} member details`} className="absolute inset-y-0 right-0 w-full max-w-[440px] overflow-y-auto bg-[#FAF8F4] p-5 shadow-xl sm:p-7">
            <div className="mb-6 flex justify-end">
              <button type="button" onClick={() => setMember(null)} aria-label="Close details" className="grid h-10 w-10 place-items-center rounded-lg bg-white">
                <X size={18} />
              </button>
            </div>
            <div className="flex items-center gap-4">
              <span className="grid h-16 w-16 place-items-center rounded-full bg-[#F3EBDD] text-lg font-semibold">{member.initial}</span>
              <div>
                <h2 className="text-lg font-semibold">{member.name}</h2>
                <p className="text-sm text-[#4A5568]">{member.title}</p>
                <div className="mt-2">{statusBadge(member.status)}</div>
              </div>
            </div>
            {/* Step 3d item 14: Step 11 wires direct messages. */}
            <button
              type="button"
              disabled
              title="Direct messages arrive in Step 11"
              className="mt-5 min-h-10 w-full cursor-not-allowed rounded-lg bg-[#E5E1D8] text-sm font-semibold text-[#7B8CA3]"
            >
              Message — available in Step 11
            </button>
            <section className="mt-6 rounded-xl border border-[#E5E1D8] bg-white p-5">
              <h3 className="font-semibold">About</h3>
              <p className="mt-2 text-sm leading-6 text-[#4A5568]">{member.bio || 'No bio has been added yet.'}</p>
              <p className="mt-4 text-xs text-[#4A5568]">
                <Mail className="mr-2 inline" size={14} />{member.email}
              </p>
              {/* Location is not part of the members API, so it is not
                  shown rather than being hard-coded per row. */}
              {member.linkedin ? (
                <a
                  href={member.linkedin}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="mt-3 inline-block text-xs font-semibold text-[#9A7A45]"
                >
                  <Linkedin className="mr-1 inline" size={14} />LinkedIn profile
                </a>
              ) : (
                <p className="mt-3 text-xs text-[#7B8CA3]">
                  <Linkedin className="mr-1 inline" size={14} />
                  {member.isInvite ? 'Not shared yet' : 'No LinkedIn profile shared'}
                </p>
              )}
            </section>
            <section className="mt-4 rounded-xl border border-[#E5E1D8] bg-white p-5">
              <h3 className="font-semibold">Workspace access</h3>
              <p className="mt-2 rounded-lg bg-[#FAF8F4] p-3 text-xs leading-5">
                {/* Item 7: capability text comes from the API matrix. */}
                <b>{member.role}:</b>{' '}
                {(permissions?.actions ?? [])
                  .filter(a => a.roles.includes(roleToApi(member.role)))
                  .map(a => a.label)
                  .join(' · ') || 'Read-only access.'}
              </p>
              <label className="mt-4 flex items-center justify-between text-sm">
                Show on public profile
                <input
                  type="checkbox"
                  checked={member.public}
                  disabled={member.isInvite || !member.canManage || busy}
                  onChange={() => {
                    const next = !member.public;
                    setMember({...member, public: next});
                    patchMember(member.id, {is_public: next});
                  }}
                  className="h-4 w-4 accent-ink"
                />
              </label>
            </section>
            <section className="mt-4 rounded-xl border border-[#E5E1D8] bg-white p-5">
              <h3 className="font-semibold">Workspace activity</h3>
              <p className="mt-3 text-xs text-[#4A5568]">{member.tasks} tasks assigned</p>
              <p className="mt-2 text-xs text-[#4A5568]">Last active: {member.active}</p>
              <p className="mt-2 text-xs text-[#4A5568]">Joined: {member.joined}</p>
            </section>
            <section className="mt-4 rounded-xl border border-[#E5E1D8] bg-white p-5">
              <h3 className="font-semibold">Edit member</h3>
              <label className="mt-3 block text-xs font-medium">
                Title
                <input
                  value={member.title}
                  disabled={member.isInvite || !member.canManage}
                  onChange={e => setMember({...member, title: e.target.value})}
                  className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-sm"
                />
              </label>
              <label className="mt-3 block text-xs font-medium">
                Department
                <select
                  value={member.dept}
                  disabled={member.isInvite || !member.canManage}
                  onChange={e => setMember({...member, dept: e.target.value})}
                  className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 text-sm"
                >
                  {depts.map(d => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </label>
              <label className="mt-3 block text-xs font-medium">
                Access role
                <select
                  value={member.role}
                  disabled={member.role === 'Owner' || !member.canManage || busy}
                  title={member.role === 'Owner' ? 'Ownership only moves through transfer' : undefined}
                  onChange={e => { changeRole(member.id, e.target.value); }}
                  className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 text-sm disabled:opacity-60"
                >
                  {/* Item 12: 'Owner' is not offered here — ownership moves
                      only through transfer-ownership, which demotes the
                      outgoing owner in the same transaction. */}
                  {['Admin', 'Member', 'Viewer'].map(r => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </label>
              {!member.isInvite && (
                <button
                  type="button"
                  onClick={saveMemberDetails}
                  disabled={busy}
                  className="mt-4 min-h-10 w-full rounded-lg bg-ink px-4 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {busy ? 'Saving…' : 'Save member details'}
                </button>
              )}
              {member.isInvite && (
                <p className="mt-3 text-xs text-[#7B8CA3]">
                  Pending invite — title and department are set for the whole invite.
                </p>
              )}
            </section>
            <section className="mt-4 rounded-xl border border-[#F1C6C1] bg-white p-5">
              <h3 className="font-semibold text-[#B42318]">Danger zone</h3>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={busy || !member.canManage}
                  onClick={() => (member.status === 'Deactivated' ? reactivateMember(member.id) : deactivateMember(member.id))}
                  className="min-h-10 flex-1 rounded-lg border border-[#E5E1D8] text-xs font-semibold disabled:opacity-60"
                >
                  {member.status === 'Deactivated' ? 'Reactivate' : 'Deactivate access'}
                </button>
                <button
                  type="button"
                  disabled={busy || !member.canManage}
                  onClick={() => setConfirm(member)}
                  className="min-h-10 flex-1 rounded-lg border border-[#F1C6C1] text-xs font-semibold text-[#B42318] disabled:opacity-60"
                >
                  Remove from team
                </button>
              </div>
            </section>
          </aside>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#0F1B2D]/50 p-4">
          <section role="alertdialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 grid h-10 w-10 place-items-center rounded-full bg-[#FCE8E6] text-[#B42318]">
              <Trash2 size={19} />
            </div>
            <h2 className="serif text-xl font-semibold">Remove {confirm.name}?</h2>
            <p className="mt-2 text-sm leading-6 text-[#4A5568]">
              They will lose access immediately. Their tasks will be unassigned. This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirm(null)} className="min-h-10 rounded-lg px-4 text-sm">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm.bulk) bulkAction('remove');
                  else remove(confirm.id);
                }}
                className="min-h-10 rounded-lg bg-[#B42318] px-4 text-sm font-semibold text-white"
              >
                Remove
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Permissions Modal */}
      {showPermissions && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[#0F1B2D]/45 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="permissions-title" className="w-full max-w-2xl rounded-2xl bg-white p-5 sm:p-7">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 id="permissions-title" className="serif text-2xl font-semibold">Permissions at a glance</h2>
                <p className="mt-1 text-xs text-[#4A5568]">A summary of workspace access by role.</p>
              </div>
              <button type="button" onClick={() => setShowPermissions(false)} aria-label="Close permissions">
                <X />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b text-[#4A5568]">
                    <th className="py-3">Area</th>
                    {(permissions?.roles ?? []).map(x => (
                      <th key={x} className="px-2 py-3">{roleToDisplay(x)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Step 3d item 7: this table IS the API's matrix, so the
                      page can never advertise a permission the service does
                      not enforce. */}
                  {(permissions?.actions ?? []).map(action => (
                    <tr key={action.key} className="border-b border-[#E5E1D8]">
                      <th className="py-3 pr-3 font-semibold">{action.label}</th>
                      {(permissions?.roles ?? []).map(r => (
                        <td key={r} className="px-2 py-3 text-[#4A5568]">
                          {action.roles.includes(r) ? (
                            <span className="inline-flex items-center gap-1">
                              <CheckCircle2 size={13} className="text-[#2E7D5B]" />Yes
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {!permissions && (
                    <tr>
                      <td colSpan={5} className="py-4 text-[#7B8CA3]">
                        Could not load the permission matrix.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={() => setShowPermissions(false)} className="mt-5 min-h-10 rounded-lg bg-ink px-4 text-sm font-semibold text-white">
              Done
            </button>
          </section>
        </div>
      )}

      {toast && (
        <div role="status" aria-live="polite" className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-lg bg-ink px-4 py-3 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[#E5E1D8] bg-white p-3 lg:hidden">
        <Button onClick={() => setInvite(true)}>
          <Plus size={17} /> Invite member
        </Button>
      </div>
    </div>
  );
}
