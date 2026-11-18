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

const depts = ['Product', 'Engineering', 'Sales', 'Operations', 'Finance', 'Other'];

export default function TeamDirectory() {
  const [mobile, setMobile] = useState(false);
  const [compact, setCompact] = useState(false);
  const [people, setPeople] = useState([]);
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

  const notify = s => {
    setToast(s);
    setTimeout(() => setToast(''), 2800);
  };

  const filtered = useMemo(
    () =>
      people
        .filter(
          p =>
            (!query || `${p.name} ${p.email} ${p.role} ${p.title}`.toLowerCase().includes(query.toLowerCase())) &&
            (role === 'All roles' || p.role === role) &&
            (status === 'All statuses' || p.status === status) &&
            (department === 'All departments' || p.dept === department)
        )
        .sort((a, b) =>
          sort === 'Name'
            ? a.name.localeCompare(b.name)
            : sort === 'Role'
            ? a.role.localeCompare(b.role)
            : a.joined.localeCompare(b.joined)
        ),
    [people, query, role, status, department, sort]
  );

  const active = people.filter(p => p.status === 'Active').length;
  const pending = people.filter(p => p.status === 'Pending').length;

  // Step 3b mapping: backend enums <-> the page's display strings.
  const roleToDisplay = r => ({owner: 'Owner', admin: 'Admin', member: 'Member', viewer: 'Viewer'}[r] || r);
  const roleToApi = r => ({Owner: 'owner', Admin: 'admin', Member: 'member', Viewer: 'viewer'}[r] || 'member');
  const deptToDisplay = d => (d ? d.charAt(0).toUpperCase() + d.slice(1) : 'Other');
  const deptToApi = d => (d || 'Other').toLowerCase();

  const {user} = useAuth();
  const [orgId, setOrgId] = useState(null);
  const [teamStatus, setTeamStatus] = useState('loading'); // loading | ready | none | error
  const [busy, setBusy] = useState(false);

  const rowFromMember = m => ({
    id: m.user_id,
    name: m.display_name || m.email.split('@')[0],
    email: m.email || '',
    title: m.title || 'Team member',
    role: roleToDisplay(m.role),
    dept: m.department ? deptToDisplay(m.department) : 'Other',
    status: 'Active',
    joined: m.joined_at ? new Date(m.joined_at).toLocaleDateString('en-US', {month: 'short', day: '2-digit', year: 'numeric'}) : '—',
    initial: m.avatar_initials || (m.display_name || '?').slice(0, 2).toUpperCase(),
    founder: m.is_founder,
    bio: '',
    // Step 5c: real per-member count from the members endpoint (single
    // grouped query server-side). Invites have no tasks yet.
    tasks: m.task_count ?? 0,
    active: '—',
    public: m.is_public,
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
    bio: '',
    tasks: 0,
    active: 'Invite pending',
    public: true,
    isInvite: true
  });

  const loadTeam = async () => {
    setTeamStatus('loading');
    try {
      const orgs = await api.organizations.mine();
      const startup = orgs.find(o => o.type === 'startup');
      if (!startup) {
        setTeamStatus('none');
        return;
      }
      setOrgId(startup.id);
      const [members, invites] = await Promise.all([
        api.organizations.members(startup.id),
        api.organizations.invites(startup.id)
      ]);
      setPeople([...members.map(rowFromMember), ...invites.map(rowFromInvite)]);
      setTeamStatus('ready');
    } catch (err) {
      setTeamStatus('error');
      notify(err instanceof ApiError ? err.message : 'Could not load the team.');
    }
  };

  useEffect(() => {
    loadTeam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const patchMember = async (userId, body) => {
    if (!orgId) return;
    try {
      const row = await api.organizations.updateMember(orgId, userId, body);
      // The patch response re-reads the same count; keep the card in sync.
      setPeople(prev => prev.map(p => (p.id === userId ? {...p, tasks: row.task_count ?? p.tasks} : p)));
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not update the member.');
      await loadTeam();
    }
  };

  const saveMemberDetails = async () => {
    if (!member || member.isInvite || busy) return;
    setBusy(true);
    try {
      await api.organizations.updateMember(orgId, member.id, {
        title: member.title || null,
        department: deptToApi(member.dept)
      });
      notify('Member details saved.');
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not save the member.');
    } finally {
      setBusy(false);
    }
  };

  const inviteSubmit = async e => {
    e.preventDefault();
    const list = [...new Set(emails.split(/[;,\n]+/).map(x => x.trim()).filter(Boolean))];
    if (!list.length) {
      notify('Enter at least one email address.');
      return;
    }
    if (list.length > 20) {
      notify('Invite up to 20 people at a time.');
      return;
    }
    const existing = list.find(email => people.some(p => p.email.toLowerCase() === email.toLowerCase()));
    if (existing) {
      notify(`${existing} is already on this team.`);
      return;
    }
    if (!orgId) {
      notify('Create your startup organization first.');
      return;
    }
    setBusy(true);
    try {
      const added = [];
      for (const email of list) {
        const created = await api.organizations.createInvite(orgId, {
          email,
          role: roleToApi(inviteRole),
          title: inviteTitle || null,
          department: deptToApi(inviteDept)
        });
        added.push({...rowFromInvite(created), token: created.token});
        // one-time token: copy the accept link for the inviter to share
        // (Step 12 wires the actual email delivery).
        if (created.token && typeof navigator !== 'undefined' && navigator.clipboard) {
          navigator.clipboard.writeText(`${window.location.origin}/invites/${created.token}`).catch(() => {});
        }
      }
      setPeople([...added, ...people]);
      setEmails('');
      setInvite(false);
      notify(`Invite created for ${list.length === 1 ? list[0] : `${list.length} people`} — accept link copied.`);
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not create the invite.');
    } finally {
      setBusy(false);
    }
  };

  const changeRole = async (id, newRole) => {
    if (
      newRole !== 'Owner' &&
      people.find(p => p.id === id)?.role === 'Owner' &&
      people.filter(p => p.role === 'Owner' && p.status === 'Active').length === 1
    ) {
      notify('A startup needs at least one Owner.');
      return;
    }
    const prev = people;
    setPeople(people.map(p => (p.id === id ? {...p, role: newRole} : p)));
    try {
      await api.organizations.updateMember(orgId, id, {role: roleToApi(newRole)});
      notify('Access role updated.');
    } catch (err) {
      setPeople(prev);
      notify(err instanceof ApiError ? err.message : 'Could not update the role.');
    }
  };

  const remove = async id => {
    const p = people.find(x => x.id === id);
    if (p?.role === 'Owner' && people.filter(x => x.role === 'Owner' && x.status === 'Active').length === 1) {
      notify('A startup needs at least one Owner.');
      return;
    }
    setBusy(true);
    try {
      if (p?.isInvite) await api.organizations.revokeInvite(orgId, id);
      else await api.organizations.removeMember(orgId, id);
      setPeople(people.filter(x => x.id !== id));
      setSelected(selected.filter(x => x !== id));
      setConfirm(null);
      setMember(null);
      notify(`${p?.name} removed from the team.`);
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not remove from the team.');
    } finally {
      setBusy(false);
    }
  };

  const toggleSelected = id => setSelected(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  const selectAll = () => setSelected(selected.length === filtered.length ? [] : filtered.map(x => x.id));

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
            ...(p.status === 'Pending' ? [['Resend invite', () => { notify(`Invite resent to ${p.email}.`); setMenuId(null); }]] : []),
            ['Edit title & department', () => { setMember(p); setMenuId(null); }],
            ['Change access role', () => { setMember(p); setMenuId(null); }],
            ...(p.status !== 'Deactivated'
              ? [['Deactivate access', () => { setPeople(people.map(m => (m.id === p.id ? {...m, status: 'Deactivated', active: 'Deactivated'} : m))); notify(`${p.name} deactivated.`); setMenuId(null); }]]
              : []),
            ['Remove from team', () => { setConfirm(p); setMenuId(null); }]
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
        <button type="button" onClick={() => notify(`Message composer for ${p.name}.`)} className="text-xs font-semibold text-[#9A7A45]">
          Message
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
          <button type="button" onClick={() => notify('You’re all caught up.')} aria-label="Notifications" className="relative ml-auto grid h-10 w-10 place-items-center">
            <Bell size={19} />
            <i className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#B8955A]" />
          </button>
          <button type="button" onClick={() => notify('Signed in as Aarav Kapoor.')} className="ml-3 flex items-center gap-2 rounded-lg p-1.5">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-ink text-xs font-semibold text-white">AK</span>
            <span className="hidden text-xs sm:block">Aarav Kapoor</span>
            <ChevronDown size={14} />
          </button>
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
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            Could not load the team.{' '}
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
              Acme Studio <span className="mx-2 text-[#B8955A]">·</span> Workspace
            </p>
            <h1 className="serif mt-1 text-[30px] font-semibold">Team</h1>
            <p className="mt-1 text-sm text-[#4A5568]">Manage who can access your startup workspace.</p>
          </div>
          <div className="flex gap-2">
            <Button
              secondary
              onClick={() => {
                const csv = ['Name,Email,Title,Role,Department,Status,Joined', ...people.map(p => [p.name, p.email, p.title, p.role, p.dept, p.status, p.joined].map(x => `"${x}"`).join(','))].join('\n');
                const a = document.createElement('a');
                a.href = URL.createObjectURL(new Blob([csv], {type: 'text/csv'}));
                a.download = 'acme-team.csv';
                a.click();
                notify('Team list exported as CSV.');
              }}
            >
              <Download size={16} /> Export list
            </Button>
            <Button onClick={() => setInvite(true)}>
              <Plus size={17} /> Invite member
            </Button>
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
            <b className="serif mt-1 block text-2xl">
              3 <Link href="/startup/hiring" className="font-sans text-xs font-semibold text-[#9A7A45]">View hiring</Link>
            </b>
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
                <span className="text-xs text-[#4A5568]">Showing {filtered.length} of {people.length} people</span>
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

            {selected.length > 0 && (
              <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-[#DCC8A4] bg-[#F3EBDD] p-3 text-sm">
                <b>{selected.length} selected</b>
                <button type="button" onClick={() => notify('Bulk role update is ready.')} className="text-xs font-semibold text-[#806236]">
                  Change role
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPeople(people.map(p => (selected.includes(p.id) ? {...p, status: 'Deactivated'} : p)));
                    setSelected([]);
                    notify('Selected access deactivated.');
                  }}
                  className="text-xs font-semibold text-[#806236]"
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
                          checked={selected.length === filtered.length && filtered.length > 0}
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
                              disabled={p.role === 'Owner' && people.filter(x => x.role === 'Owner' && x.status === 'Active').length === 1}
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
                            onChange={() => setPeople(people.map(x => (x.id === p.id ? {...x, public: !x.public} : x)))}
                            className="h-4 w-4 accent-ink"
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
                {[
                  ['Owner', 'Everything, including billing, visibility and removing admins.'],
                  ['Admin', 'Manage team, profile, documents and data room. No billing.'],
                  ['Member', 'Work on tasks, upload permitted documents and use stage tools.'],
                  ['Viewer', 'Read-only access to selected areas.']
                ].map(([r, d]) => (
                  <div key={r}>
                    <p className="text-sm font-semibold">{r}</p>
                    <p className="mt-0.5 text-xs leading-5 text-[#4A5568]">{d}</p>
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
              {people.filter(p => p.status === 'Pending').length ? (
                people
                  .filter(p => p.status === 'Pending')
                  .map(p => (
                    <div key={p.id} className="border-t border-[#E5E1D8] py-3">
                      <p className="truncate text-xs font-semibold">{p.email}</p>
                      <p className="mt-1 text-[11px] text-[#4A5568]">{p.role} · {p.joined}</p>
                      <div className="mt-2 flex gap-3">
                        <button type="button" onClick={() => notify(`Invite resent to ${p.email}.`)} className="text-[11px] font-semibold text-[#9A7A45]">
                          Resend
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPeople(people.filter(x => x.id !== p.id));
                            notify('Invite revoked.');
                          }}
                          className="text-[11px] text-[#B42318]"
                        >
                          Revoke
                        </button>
                      </div>
                    </div>
                  ))
              ) : (
                <p className="text-xs text-[#4A5568]">No outstanding invites.</p>
              )}
              <button type="button" onClick={() => setInvite(true)} className="mt-2 text-xs font-semibold text-[#9A7A45]">
                Invite someone <Plus className="inline" size={13} />
              </button>
            </section>

            <section id="hiring" className="rounded-xl border border-[#E5E1D8] bg-white p-5">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#F3EBDD] text-[#806236]">
                <Briefcase size={17} />
              </div>
              <h2 className="serif mt-3 text-xl font-semibold">Need more people?</h2>
              <p className="mt-1 text-xs leading-5 text-[#4A5568]">
                You have <b>3 open hiring requests</b>. Teams at Prototype stage often hire engineers and a designer.
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
                <p className="mt-1 text-sm text-[#4A5568]">They’ll get an email with a secure link to join Acme Studio.</p>
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
                <small className="mt-1 block text-xs font-normal text-[#4A5568]">Up to 20 people. Invitations expire in 7 days.</small>
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
            <button type="button" onClick={() => notify(`Message composer for ${member.name}.`)} className="mt-5 min-h-10 w-full rounded-lg bg-ink text-sm font-semibold text-white">
              Message
            </button>
            <section className="mt-6 rounded-xl border border-[#E5E1D8] bg-white p-5">
              <h3 className="font-semibold">About</h3>
              <p className="mt-2 text-sm leading-6 text-[#4A5568]">{member.bio || 'No bio has been added yet.'}</p>
              <p className="mt-4 text-xs text-[#4A5568]">
                <Mail className="mr-2 inline" size={14} />{member.email}
              </p>
              <p className="mt-2 text-xs text-[#4A5568]">
                <MapPin className="mr-2 inline" size={14} />Kolkata, India
              </p>
              <button type="button" onClick={() => notify('LinkedIn profile is not connected.')} className="mt-3 text-xs font-semibold text-[#9A7A45]">
                <Linkedin className="mr-1 inline" size={14} />LinkedIn profile
              </button>
            </section>
            <section className="mt-4 rounded-xl border border-[#E5E1D8] bg-white p-5">
              <h3 className="font-semibold">Workspace access</h3>
              <p className="mt-2 rounded-lg bg-[#FAF8F4] p-3 text-xs leading-5">
                <b>{member.role}:</b>{' '}
                {member.role === 'Owner'
                  ? 'Full access, including billing and workspace ownership.'
                  : member.role === 'Admin'
                  ? 'Can manage team, profile, documents and data room.'
                  : member.role === 'Member'
                  ? 'Can work on tasks, stage tools and permitted documents.'
                  : 'Read-only access to selected workspace areas.'}
              </p>
              <label className="mt-4 flex items-center justify-between text-sm">
                Show on public profile
                <input
                  type="checkbox"
                  checked={member.public}
                  disabled={member.isInvite}
                  onChange={() => {
                    const next = !member.public;
                    setPeople(people.map(p => (p.id === member.id ? {...p, public: next} : p)));
                    setMember({...member, public: next});
                    if (!member.isInvite) patchMember(member.id, {is_public: next});
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
                  onChange={e => {
                    setMember({...member, title: e.target.value});
                    setPeople(people.map(p => (p.id === member.id ? {...p, title: e.target.value} : p)));
                  }}
                  className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] px-3 text-sm"
                />
              </label>
              <label className="mt-3 block text-xs font-medium">
                Department
                <select
                  value={member.dept}
                  onChange={e => {
                    setMember({...member, dept: e.target.value});
                    setPeople(people.map(p => (p.id === member.id ? {...p, dept: e.target.value} : p)));
                  }}
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
                  disabled={member.role === 'Owner' && people.filter(p => p.role === 'Owner' && p.status === 'Active').length === 1}
                  onChange={e => {
                    changeRole(member.id, e.target.value);
                    setMember({...member, role: e.target.value});
                  }}
                  className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 text-sm"
                >
                  {['Owner', 'Admin', 'Member', 'Viewer'].map(r => (
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
                  onClick={() => {
                    setPeople(people.map(p => (p.id === member.id ? {...p, status: p.status === 'Deactivated' ? 'Active' : 'Deactivated'} : p)));
                    notify(member.status === 'Deactivated' ? 'Member reactivated.' : 'Member access deactivated.');
                    setMember(null);
                  }}
                  className="min-h-10 flex-1 rounded-lg border border-[#E5E1D8] text-xs font-semibold"
                >
                  {member.status === 'Deactivated' ? 'Reactivate' : 'Deactivate access'}
                </button>
                <button type="button" onClick={() => setConfirm(member)} className="min-h-10 flex-1 rounded-lg border border-[#F1C6C1] text-xs font-semibold text-[#B42318]">
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
                  if (confirm.bulk) {
                    setPeople(people.filter(p => !selected.includes(p.id)));
                    setSelected([]);
                    setConfirm(null);
                    notify('Selected members removed.');
                  } else {
                    remove(confirm.id);
                  }
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
                    {['Owner', 'Admin', 'Member', 'Viewer'].map(x => (
                      <th key={x} className="px-2 py-3">{x}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Tasks', 'Manage', 'Manage', 'Work', 'View'],
                    ['Documents', 'Manage', 'Manage', 'Permitted', 'Selected'],
                    ['Data room', 'Full', 'Manage', 'Selected', 'Selected'],
                    ['Investors', 'Full', 'Manage', 'View', 'View'],
                    ['Billing', 'Full', '—', '—', '—'],
                    ['Hiring', 'Full', 'Manage', 'View', 'View']
                  ].map(row => (
                    <tr key={row[0]} className="border-b border-[#E5E1D8]">
                      <th className="py-3 font-semibold">{row[0]}</th>
                      {row.slice(1).map((v, i) => (
                        <td key={i} className="px-2 py-3 text-[#4A5568]">
                          {v === '—' ? '—' : (
                            <span className="inline-flex items-center gap-1">
                              <CheckCircle2 size={13} className="text-[#2E7D5B]" />{v}
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
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
