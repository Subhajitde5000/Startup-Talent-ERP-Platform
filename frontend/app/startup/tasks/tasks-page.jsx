'use client';
import {useEffect, useMemo, useRef, useState} from 'react';
import Link from 'next/link';
import { StartupSidebar, Btn } from '../../../components';
import {useAuth} from '@/lib/auth-context';
import {api, ApiError} from '@/lib/api/client';
import {
  Search,Bell,ChevronDown,ChevronUp,ChevronRight,Check,CheckCircle2,Plus,ArrowRight,CalendarDays,
  Clock,MoreHorizontal,Flag,Filter,List,Columns3,Calendar,
  Target,X,Trash2,Download,Upload,Milestone as MilestoneIcon,
  Menu,AlertTriangle,AlertCircle,Tag,Send,MessageSquare,Pencil
} from 'lucide-react';

const columns = ['To do', 'In progress', 'In review', 'Done'];

// Step 5c wire mapping: the four board columns onto the task_status enum.
// `blocked` has no column of its own (approved): it lives in "In progress"
// and the card carries a Blocked chip; dropping it out of that column moves
// it to whichever column it lands in.
const COLUMN_STATUS = {
  'To do': 'todo',
  'In progress': 'in_progress',
  'In review': 'in_review',
  Done: 'done'
};
const STATUS_LABEL = {
  todo: 'To do',
  in_progress: 'In progress',
  in_review: 'In review',
  blocked: 'Blocked',
  done: 'Done'
};
const columnOf = t => (t.status === 'blocked' ? 'In progress' : STATUS_LABEL[t.status] || 'To do');
const PRIORITY_LABEL = {low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent'};
const PRIORITY_API = {Low: 'low', Medium: 'medium', High: 'high', Urgent: 'urgent'};
const PRIORITY_RANK = {low: 0, medium: 1, high: 2, urgent: 3};

// Today in the server's own date model: the API compares due dates against
// UTC, so the browser must not shift "today" into a different day.
const isoToday = () => {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate()
  ).padStart(2, '0')}`;
};

const initialsOf = name =>
  (name || '?')
    .split(' ')
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

// Step 5b: who may write milestones, status labels and 422 -> field mapping.
const EDIT_ROLES = ['owner', 'admin', 'member'];
const MS_STATUS_LABELS = {
  on_track: 'On track',
  at_risk: 'At risk',
  off_track: 'Off track',
  achieved: 'Achieved',
  missed: 'Missed'
};

// Step 5d: label pills are neutral by design (§18). The stored colour is a
// 6-digit hex; render it as a tinted chip that stays readable when the
// colour is absent or fails contrast.
const LABEL_TINTS = ['#EFE9DC', '#E8EDF3', '#E9F0EA', '#F3EBE3', '#EDEAE4'];
const labelTint = label => {
  if (!label) return '#EFE9DC';
  const i = (label.name || '').length % LABEL_TINTS.length;
  return LABEL_TINTS[i];
};

const labelStyle = label => ({
  backgroundColor: label?.color ? `${label.color}1A` : labelTint(label),
  borderColor: label?.color ? `${label.color}55` : '#D9D3C6',
  color: '#0F1B2D'
});

const fmtCommentTime = iso => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
};

function errorsFrom(err) {
  const out = {};
  if (err instanceof ApiError && Array.isArray(err.details)) {
    for (const d of err.details) {
      const loc = Array.isArray(d.loc) ? d.loc : [];
      const key = loc[loc.length - 1];
      if (typeof key === 'string' && !out[key]) out[key] = d.msg || 'Invalid value.';
    }
  }
  return out;
}

export default function TasksPage() {
  const {user} = useAuth();
  const [mobile, setMobile] = useState(false);
  const [compact, setCompact] = useState(false);
  // Step 5c: tasks are real API data (TaskRead[]); the board is the source
  // of truth and every mutation re-reads the row the API returns.
  const [tasks, setTasks] = useState([]);
  const [taskStatus, setTaskStatus] = useState('loading'); // loading | ready | error | none
  const [taskError, setTaskError] = useState('');
  const [busyMove, setBusyMove] = useState(null); // task id currently moving
  const [view, setView] = useState('Board');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All tasks');
  const [selected, setSelected] = useState(null);
  // Local, uncommitted edits for the open drawer (title/description commit
  // on blur; every other control writes immediately).
  const [drawer, setDrawer] = useState(null);
  const [drawerErrs, setDrawerErrs] = useState({});
  const [deleting, setDeleting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState('');
  const [newTitle, setNewTitle] = useState('');
  // Task create form fields (mapped onto TaskCreate).
  const [newAssignee, setNewAssignee] = useState('');
  const [newPriority, setNewPriority] = useState('Medium');
  const [newMilestone, setNewMilestone] = useState('');
  const [group, setGroup] = useState('Status');
  const [month, setMonth] = useState(new Date().getUTCMonth());
  // Step 5b: milestones are real API data (the dev seed keeps the panel populated).
  const [milestones, setMilestones] = useState([]);
  const [msStatus, setMsStatus] = useState('loading'); // loading | ready | error | none
  const [msError, setMsError] = useState('');
  const [org, setOrg] = useState(null); // OrganizationRead (startup, with my_role)
  const [members, setMembers] = useState([]); // MemberRead[] for owner names/select
  const [reloadKey, setReloadKey] = useState(0);
  const [newDesc, setNewDesc] = useState('');
  const [newDate, setNewDate] = useState('');
  const [createErrs, setCreateErrs] = useState({});
  const [createFormErr, setCreateFormErr] = useState('');
  const [createBusy, setCreateBusy] = useState(false);
  const [editing, setEditing] = useState(null); // MilestoneRead under edit
  const [editForm, setEditForm] = useState(null); // {name, description, target_date, status, progress, owner_id}
  const [editErrs, setEditErrs] = useState({});
  const [editFormErr, setEditFormErr] = useState('');
  const [editBusy, setEditBusy] = useState(false);
  const [expandedMilestones, setExpandedMilestones] = useState({});
  const [milestoneNewTasks, setMilestoneNewTasks] = useState({});
  // --- Step 5d: the org's label catalogue and this task's comments ----------
  const [labels, setLabels] = useState([]); // TaskLabelRead[]
  const [labelStatus, setLabelStatus] = useState('loading'); // loading | ready | error
  const [labelError, setLabelError] = useState('');
  const [labelBusy, setLabelBusy] = useState(null); // task id being re-labelled
  const [labelManage, setLabelManage] = useState(false); // catalogue editor open
  const [labelForm, setLabelForm] = useState({name: '', color: '#4A5568'});
  const [labelErrs, setLabelErrs] = useState({});
  const [labelFormErr, setLabelFormErr] = useState('');
  const [labelSaving, setLabelSaving] = useState(false);
  const [editingLabel, setEditingLabel] = useState(null); // TaskLabelRead under rename
  const [comments, setComments] = useState([]); // TaskCommentRead[] for the drawer's task
  const [commentStatus, setCommentStatus] = useState('idle'); // idle | loading | ready | error
  const [commentError, setCommentError] = useState('');
  const [commentBody, setCommentBody] = useState('');
  const [commentErrs, setCommentErrs] = useState({});
  const [commentBusy, setCommentBusy] = useState(false);
  const [editingComment, setEditingComment] = useState(null); // {id, body}

  const canEdit = !!org && EDIT_ROLES.includes(org.my_role);
  // Step 5d: only owner/admin may shape the label catalogue (plan D-7);
  // member+ may attach labels to a task.
  const canManageLabels = !!org && ['owner', 'admin'].includes(org.my_role);
  const myId = user?.id || null;
  const myName = user?.display_name || '';
  const myInitials = initialsOf(myName);
  const today = isoToday();

  const notify = t => {
    setToast(t);
    setTimeout(() => setToast(''), 2600);
  };

  // --- Step 5c: tasks ------------------------------------------------------
  const loadTasks = async id => {
    setTaskStatus('loading');
    try {
      const rows = await api.tasks.listAll(id);
      setTasks(rows);
      setTaskStatus('ready');
    } catch (err) {
      setTaskError(err instanceof ApiError ? err.message : 'Could not load tasks.');
      setTaskStatus('error');
    }
  };
  // Kept in a ref so the mount effect never re-runs on a re-render.
  const loadTasksRef = useRef(loadTasks);
  loadTasksRef.current = loadTasks;

  // --- Step 5b: organization, milestones, members --------------------------
  const loadMilestones = async id => {
    setMsStatus('loading');
    try {
      const page = await api.milestones.list(id, {sort: 'target_date', order: 'asc'});
      setMilestones(page.items);
      setMsStatus('ready');
    } catch (err) {
      setMsError(err instanceof ApiError ? err.message : 'Could not load milestones.');
      setMsStatus('error');
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      setMsStatus('loading');
      let startup = null;
      try {
        const orgs = await api.organizations.mine();
        startup = orgs.find(o => o.type === 'startup') || null;
      } catch (err) {
        if (!alive) return;
        setMsError(err instanceof ApiError ? err.message : 'Could not load your organization.');
        setMsStatus('error');
        return;
      }
      if (!alive) return;
      if (!startup) {
        setMsStatus('none');
        return;
      }
      setOrg(startup);
      // Owner names only — a members failure must not block the panel.
      api.organizations
        .members(startup.id)
        .then(rows => { if (alive) setMembers(rows); })
        .catch(() => {});
      // Tasks render independently of milestones: one failing never hides
      // the other (each view has its own loading/error state).
      loadTasksRef.current(startup.id);
      // Step 5d: a labels failure must not block the board either.
      loadLabelsRef.current(startup.id);
      await loadMilestones(startup.id);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  const ownerNameOf = id =>
    (id ? members.find(x => x.user_id === id)?.display_name || null : null);

  const openCreate = (initialMilestoneId = '') => {
    setNewTitle('');
    setNewDesc('');
    setNewAssignee('');
    setNewPriority('Medium');
    const mid = typeof initialMilestoneId === 'string' ? initialMilestoneId : '';
    setNewMilestone(mid);
    if (mid) {
      const ms = milestones.find(m => m.id === mid);
      setNewDate(ms?.target_date || '');
    } else {
      setNewDate('');
    }
    setCreateErrs({});
    setCreateFormErr('');
    setCreating(true);
  };

  const openEdit = m => {
    setEditing(m);
    setEditForm({
      name: m.name,
      description: m.description || '',
      target_date: m.target_date || '',
      status: m.status,
      progress: m.progress,
      owner_id: m.owner_id || ''
    });
    setEditErrs({});
    setEditFormErr('');
  };

  const removeMilestone = async m => {
    if (!org || !window.confirm(`Delete "${m.name}"?`)) return;
    try {
      await api.milestones.remove(org.id, m.id);
      notify('Milestone deleted.');
      await loadMilestones(org.id);
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not delete the milestone.');
    }
  };

  const toggleExpandMilestone = id => {
    setExpandedMilestones(prev => ({...prev, [id]: !prev[id]}));
  };

  const toggleMilestoneAchieved = async m => {
    if (!org || !canEdit) return;
    const isCurrentlyAchieved = m.status === 'achieved';
    const nextStatus = isCurrentlyAchieved ? 'on_track' : 'achieved';
    const nextProgress = isCurrentlyAchieved ? 50 : 100;
    try {
      const updated = await api.milestones.update(org.id, m.id, {
        status: nextStatus,
        progress: nextProgress
      });
      setMilestones(prev => prev.map(x => (x.id === m.id ? updated : x)));
      notify(isCurrentlyAchieved ? 'Milestone reopened (on track).' : 'Milestone marked achieved! 🎉');
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not update milestone.');
    }
  };

  const updateMilestoneStatus = async (m, nextStatus) => {
    if (!org || !canEdit) return;
    const isAchieving = nextStatus === 'achieved';
    const nextProgress = isAchieving ? 100 : (m.status === 'achieved' && m.progress === 100 ? 50 : m.progress);
    try {
      const updated = await api.milestones.update(org.id, m.id, {
        status: nextStatus,
        progress: nextProgress
      });
      setMilestones(prev => prev.map(x => (x.id === m.id ? updated : x)));
      notify(`Milestone marked ${MS_STATUS_LABELS[nextStatus] || nextStatus}.`);
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not update milestone status.');
    }
  };

  const addDeliverable = async (milestoneId, title) => {
    const clean = (title || '').trim();
    if (!clean || !org) return false;
    const ms = milestones.find(m => m.id === milestoneId);
    try {
      const row = await api.tasks.create(org.id, {
        title: clean,
        milestone_id: milestoneId,
        due_on: ms?.target_date || null,
        priority: 'medium'
      });
      setTasks(prev => [...prev, row]);
      notify(
        ms?.target_date
          ? `Deliverable added with due date set to ${ms.target_date}.`
          : 'Deliverable task added to milestone.'
      );
      return true;
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not add deliverable task.');
      return false;
    }
  };

  const overdue = t => t.status !== 'done' && !!t.due_on && t.due_on < today;
  const weekEnd = (() => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 7);
    return d.toISOString().slice(0, 10);
  })();
  const dueThisWeek = t =>
    t.status !== 'done' && !!t.due_on && t.due_on >= today && t.due_on <= weekEnd;

  const assigneeName = t => ownerNameOf(t.assignee_id);
  const assigneeInitials = t => {
    const m = t.assignee_id ? members.find(x => x.user_id === t.assignee_id) : null;
    if (m) return m.avatar_initials || initialsOf(m.display_name);
    if (t.assignee_id && t.assignee_id === myId) return myInitials;
    return '—';
  };
  const milestoneName = t =>
    t.milestone_id ? milestones.find(m => m.id === t.milestone_id)?.name || null : null;

  const matches = t => {
    if (query) {
      const hay = `${t.title} ${t.description || ''} ${assigneeName(t) || ''}`.toLowerCase();
      if (!hay.includes(query.toLowerCase())) return false;
    }
    if (filter === 'Assigned to me') return !!myId && t.assignee_id === myId;
    if (filter === 'Overdue') return overdue(t);
    if (filter.startsWith('milestone:')) {
      const msId = filter.slice('milestone:'.length);
      return t.milestone_id === msId;
    }
    if (filter in COLUMN_STATUS) return columnOf(t) === filter;
    return true;
  };

  const filtered = useMemo(
    () => tasks.filter(matches),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, query, filter, members, milestones, myId]
  );

  const open = tasks.filter(t => t.status !== 'done').length;
  const dueweek = tasks.filter(dueThisWeek).length;
  const late = tasks.filter(overdue).length;
  const done = tasks.filter(t => t.status === 'done').length;
  const donePct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

  // Workload: open tasks per teammate, straight from the (single) task list.
  const workload = useMemo(() => {
    const byId = new Map();
    for (const t of tasks) {
      if (t.status === 'done' || !t.assignee_id) continue;
      byId.set(t.assignee_id, (byId.get(t.assignee_id) || 0) + 1);
    }
    return [...byId.entries()]
      .map(([id, n]) => ({id, n, name: ownerNameOf(id) || 'Unknown member'}))
      .sort((a, b) => b.n - a.n)
      .slice(0, 5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, members]);

  // "My focus": my own tasks that are due today or overdue.
  const focusTasks = useMemo(
    () =>
      tasks.filter(
        t =>
          !!myId &&
          t.assignee_id === myId &&
          t.status !== 'done' &&
          !!t.due_on &&
          t.due_on <= today
      ),
    [tasks, myId, today]
  );

  // Open tasks per milestone (Milestones view progress line).
  const milestoneCounts = id => {
    const linked = tasks.filter(t => t.milestone_id === id && t.status !== 'done');
    return linked.length;
  };
  const milestoneDone = id => tasks.filter(t => t.milestone_id === id && t.status === 'done').length;

  const replaceTask = row => {
    setTasks(prev => prev.map(t => (t.id === row.id ? row : t)));
    setSelected(prev => (prev && prev.id === row.id ? row : prev));
  };

  // Moving a task is the only writer of status/completed_at/display_order.
  const moveTask = async (task, body, message) => {
    if (!org || busyMove) return false;
    setBusyMove(task.id);
    try {
      const row = await api.tasks.move(org.id, task.id, body);
      replaceTask(row);
      if (message) notify(message);
      return true;
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not move the task.');
      // Re-read so the board never shows a move the server rejected.
      await loadTasks(org.id);
      return false;
    } finally {
      setBusyMove(null);
    }
  };

  // Field patch (title/description/priority/assignee/due/milestone).
  const patchTask = async (task, body, message) => {
    if (!org) return null;
    setDrawerErrs({});
    try {
      const row = await api.tasks.update(org.id, task.id, body);
      replaceTask(row);
      if (message) notify(message);
      return row;
    } catch (err) {
      if (err instanceof ApiError) {
        const errs = errorsFrom(err);
        setDrawerErrs(errs);
        notify(Object.keys(errs).length ? 'Please check the highlighted fields.' : err.message);
      } else {
        notify('Could not update the task.');
      }
      return null;
    }
  };

  const removeTask = async task => {
    if (!org || deleting) return;
    if (!window.confirm(`Delete "${task.title}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await api.tasks.remove(org.id, task.id);
      setTasks(prev => prev.filter(t => t.id !== task.id));
      closeTask();
      notify('Task deleted.');
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not delete the task.');
    } finally {
      setDeleting(false);
    }
  };

  const setStatus = async (task, column) => {
    const status = COLUMN_STATUS[column];
    if (!status) return;
    // An anchored move keeps the position; a bare column change appends.
    await moveTask(
      task,
      {status},
      status === 'done' ? 'Task completed.' : `Moved to ${column}.`
    );
  };

  const toggleDone = task => {
    if (task.status === 'done') {
      return setStatus(task, 'To do');
    }
    return moveTask(task, {status: 'done'}, 'Task completed.');
  };

  // --- Step 5d: labels ------------------------------------------------------
  const loadLabels = async id => {
    setLabelStatus('loading');
    try {
      const page = await api.taskLabels.list(id, {limit: 100, sort: 'name', order: 'asc'});
      setLabels(page.items);
      setLabelStatus('ready');
    } catch (err) {
      setLabelError(err instanceof ApiError ? err.message : 'Could not load labels.');
      setLabelStatus('error');
    }
  };
  const loadLabelsRef = useRef(loadLabels);
  loadLabelsRef.current = loadLabels;

  // The replace-set endpoint returns the task's full label list; splice it
  // into both the board row and the open drawer so nothing needs a refetch.
  const setTaskLabels = async (task, labelIds) => {
    if (!org || labelBusy) return;
    setLabelBusy(task.id);
    setLabelErrs({});
    try {
      const next = await api.taskLabels.setForTask(org.id, task.id, {label_ids: labelIds});
      const patch = row => (row.id === task.id ? {...row, labels: next} : row);
      setTasks(prev => prev.map(patch));
      setSelected(prev => (prev && prev.id === task.id ? {...prev, labels: next} : prev));
      notify(labelIds.length ? 'Labels updated.' : 'Labels cleared.');
    } catch (err) {
      if (err instanceof ApiError) {
        const errs = errorsFrom(err);
        setLabelErrs(errs);
        if (err.code === 'LABEL_LIMIT_REACHED') {
          notify(err.message);
        } else {
          notify(Object.keys(errs).length ? 'Please check the highlighted fields.' : err.message);
        }
      } else {
        notify('Could not update the labels.');
      }
    } finally {
      setLabelBusy(null);
    }
  };

  const toggleTaskLabel = (task, labelId) => {
    const current = (task.labels || []).map(l => l.id);
    const next = current.includes(labelId)
      ? current.filter(id => id !== labelId)
      : [...current, labelId];
    return setTaskLabels(task, next);
  };

  const saveLabel = async e => {
    e.preventDefault();
    if (!org || labelSaving) return;
    setLabelErrs({});
    setLabelFormErr('');
    const name = labelForm.name.trim();
    if (!name) {
      setLabelErrs({name: 'Enter a label name.'});
      return;
    }
    setLabelSaving(true);
    try {
      if (editingLabel) {
        const row = await api.taskLabels.update(org.id, editingLabel.id, {
          name,
          color: labelForm.color || null
        });
        setLabels(prev => prev.map(l => (l.id === row.id ? row : l)));
        // The same label is embedded in every task carrying it.
        setTasks(prev =>
          prev.map(t => ({
            ...t,
            labels: (t.labels || []).map(l => (l.id === row.id ? row : l))
          }))
        );
        notify('Label updated.');
      } else {
        const row = await api.taskLabels.create(org.id, {
          name,
          color: labelForm.color || null
        });
        setLabels(prev => [...prev, row].sort((a, b) => a.name.localeCompare(b.name)));
        notify('Label created.');
      }
      setEditingLabel(null);
      setLabelForm({name: '', color: '#4A5568'});
    } catch (err) {
      if (err instanceof ApiError) {
        const errs = errorsFrom(err);
        setLabelErrs(errs);
        if (err.code === 'LABEL_NAME_TAKEN' && !errs.name) {
          setLabelErrs({name: err.message});
        }
        setLabelFormErr(
          Object.keys(errs).length || err.code === 'LABEL_NAME_TAKEN' ? '' : err.message
        );
      } else {
        setLabelFormErr('Could not save the label.');
      }
    } finally {
      setLabelSaving(false);
    }
  };

  const deleteLabel = async label => {
    if (!org) return;
    setLabelFormErr('');
    try {
      await api.taskLabels.remove(org.id, label.id);
      setLabels(prev => prev.filter(l => l.id !== label.id));
      // Links cascade server-side; mirror that locally.
      setTasks(prev =>
        prev.map(t => ({...t, labels: (t.labels || []).filter(l => l.id !== label.id)}))
      );
      if (editingLabel?.id === label.id) {
        setEditingLabel(null);
        setLabelForm({name: '', color: '#4A5568'});
      }
      notify('Label deleted.');
    } catch (err) {
      setLabelFormErr(
        err instanceof ApiError ? err.message : 'Could not delete the label.'
      );
    }
  };

  // --- Step 5d: comments ----------------------------------------------------
  const loadComments = async taskId => {
    if (!org) return;
    setCommentStatus('loading');
    setCommentError('');
    try {
      const page = await api.taskComments.list(org.id, taskId, {limit: 100});
      setComments(page.items);
      setCommentStatus('ready');
    } catch (err) {
      setCommentError(err instanceof ApiError ? err.message : 'Could not load comments.');
      setCommentStatus('error');
    }
  };

  // Opening a task loads its thread; closing clears it so a stale thread
  // never flashes into the next task.
  const openTask = task => {
    setSelected(task);
    setDrawer(null);
    setDrawerErrs({});
    setCommentBody('');
    setCommentErrs({});
    setEditingComment(null);
    setComments([]);
    setCommentStatus('idle');
    if (org) loadComments(task.id);
  };

  const closeTask = () => {
    setSelected(null);
    setDrawer(null);
    setDrawerErrs({});
    setComments([]);
    setCommentBody('');
    setCommentErrs({});
    setEditingComment(null);
    setCommentStatus('idle');
  };

  const addComment = async e => {
    e.preventDefault();
    if (!org || !selected || commentBusy) return;
    setCommentErrs({});
    const body = commentBody.trim();
    if (!body) {
      setCommentErrs({body: 'Write a comment first.'});
      return;
    }
    setCommentBusy(true);
    try {
      const row = await api.taskComments.create(org.id, selected.id, {body});
      setComments(prev => [...prev, row]);
      setCommentBody('');
      setCommentStatus('ready');
      notify('Comment posted.');
    } catch (err) {
      if (err instanceof ApiError) {
        const errs = errorsFrom(err);
        setCommentErrs(
          Object.keys(errs).length
            ? errs
            : {body: err.code === 'RATE_LIMITED' ? err.message : err.message}
        );
      } else {
        setCommentErrs({body: 'Could not post the comment.'});
      }
    } finally {
      setCommentBusy(false);
    }
  };

  const saveComment = async (comment, body) => {
    if (!org || !selected || commentBusy) return;
    const trimmed = (body || '').trim();
    setCommentErrs({});
    if (!trimmed) {
      setCommentErrs({edit: 'A comment cannot be empty.'});
      return;
    }
    setCommentBusy(true);
    try {
      const row = await api.taskComments.update(org.id, selected.id, comment.id, {
        body: trimmed
      });
      setComments(prev => prev.map(c => (c.id === row.id ? row : c)));
      setEditingComment(null);
      notify('Comment updated.');
    } catch (err) {
      setCommentErrs({
        edit: err instanceof ApiError ? err.message : 'Could not update the comment.'
      });
    } finally {
      setCommentBusy(false);
    }
  };

  const deleteComment = async comment => {
    if (!org || !selected) return;
    setCommentErrs({});
    try {
      await api.taskComments.remove(org.id, selected.id, comment.id);
      setComments(prev => prev.filter(c => c.id !== comment.id));
      if (editingComment?.id === comment.id) setEditingComment(null);
      notify('Comment deleted.');
    } catch (err) {
      setCommentErrs({
        list: err instanceof ApiError ? err.message : 'Could not delete the comment.'
      });
    }
  };

  // Reorder inside a column: before/after anchor computed from what is on
  // screen, so the result matches the drop target.
  const reorder = async (draggedId, column, beforeTaskId) => {
    const dragged = tasks.find(t => t.id === draggedId);
    if (!dragged || !org) return;
    const status = COLUMN_STATUS[column];
    const siblings = tasks
      .filter(t => columnOf(t) === column && t.id !== draggedId)
      .sort((a, b) => a.display_order - b.display_order || a.created_at.localeCompare(b.created_at));
    const body = {status};
    if (beforeTaskId) {
      body.before_id = beforeTaskId;
    } else if (siblings.length) {
      body.after_id = siblings[siblings.length - 1].id;
    }
    await moveTask(dragged, body);
  };

  const [dragId, setDragId] = useState(null);
  const doMove = (id, column) => {
    const t = tasks.find(x => x.id === id);
    setDragId(null);
    if (t) setStatus(t, column);
  };

  const quickAdd = async e => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title || !org || createBusy) return;
    setCreateErrs({});
    setCreateFormErr('');
    setCreateBusy(true);
    try {
      const row = await api.tasks.create(org.id, {title});
      setTasks(prev => [...prev, row]);
      setNewTitle('');
      notify('Task created.');
    } catch (err) {
      const errs = errorsFrom(err);
      setCreateErrs(errs);
      setCreateFormErr(
        Object.keys(errs).length ? '' : err instanceof ApiError ? err.message : 'Could not create the task.'
      );
    } finally {
      setCreateBusy(false);
    }
  };

  const dueChip = t => {
    if (!t.due_on) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-[#F3F4F6] px-2 py-1 text-[10px] font-medium text-[#4A5568]">
          <CalendarDays size={11} />
          No date
        </span>
      );
    }
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium ${
          overdue(t)
            ? 'bg-[#FCE8E6] text-[#B42318]'
            : t.due_on === today
            ? 'bg-[#F3EBDD] text-[#806236]'
            : dueThisWeek(t)
            ? 'bg-[#FFF3D6] text-[#8A5700]'
            : 'bg-[#F3F4F6] text-[#4A5568]'
        }`}
      >
        <CalendarDays size={11} />
        {overdue(t)
          ? 'Overdue'
          : t.due_on === today
          ? 'Today'
          : new Date(`${t.due_on}T00:00:00Z`).toLocaleDateString('en-IN', {day: 'numeric', month: 'short', timeZone: 'UTC'})}
      </span>
    );
  };

  const taskCard = t => (
    <article
      key={t.id}
      draggable
      onDragStart={() => setDragId(t.id)}
      onDragEnd={() => setDragId(null)}
      onClick={() => openTask(t)}
      className={`cursor-pointer rounded-xl border border-[#E5E1D8] bg-white p-3.5 shadow-[0_1px_2px_rgba(15,27,45,.04)] transition hover:border-[#A0A7B4] hover:shadow-sm ${
        t.status === 'done' ? 'opacity-70' : ''
      } ${busyMove === t.id ? 'animate-pulse' : ''}`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            toggleDone(t);
          }}
          aria-label={t.status === 'done' ? 'Mark incomplete' : 'Mark complete'}
          className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border ${
            t.status === 'done' ? 'border-ink bg-ink text-white' : 'border-[#A0A7B4]'
          }`}
        >
          {t.status === 'done' && <Check size={11} />}
        </button>
        <h3 className={`flex-1 text-sm font-semibold leading-5 ${t.status === 'done' ? 'text-[#A0A7B4] line-through' : ''}`}>
          {t.title}
        </h3>
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            openTask(t);
          }}
          aria-label="Task options"
        >
          <MoreHorizontal size={17} className="text-[#4A5568]" />
        </button>
      </div>
      {(t.labels || []).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {(t.labels || []).map(l => (
            <span
              key={l.id}
              style={labelStyle(l)}
              className="rounded-full border px-2 py-0.5 text-[10px] font-medium leading-4"
            >
              {l.name}
            </span>
          ))}
        </div>
      )}
      <div className="mt-3 flex items-center justify-between">
        <span className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-[#F3EBDD] text-[10px] font-semibold">
            {assigneeInitials(t)}
          </span>
          <span className="text-[11px] text-[#4A5568]">
            {(assigneeName(t) || 'Unassigned').split(' ')[0]}
          </span>
        </span>
        {dueChip(t)}
      </div>
      <div className="mt-3 flex items-center gap-3 border-t border-[#E5E1D8] pt-2.5 text-[10px] text-[#4A5568]">
        {t.priority !== 'low' && (
          <span
            className={`inline-flex items-center gap-1 ${
              t.priority === 'urgent' ? 'text-[#B42318]' : t.priority === 'high' ? 'text-[#8A5700]' : ''
            }`}
          >
            <Flag size={12} />
            {PRIORITY_LABEL[t.priority]}
          </span>
        )}
        {t.status === 'blocked' && (
          <span className="inline-flex items-center gap-1 text-[#B42318]">
            <Clock size={12} />
            Blocked
          </span>
        )}
        {milestoneName(t) && (
          <span className="ml-auto max-w-[130px] truncate text-[#9A7A45]" title={milestoneName(t)}>
            <MilestoneIcon className="mr-1 inline" size={12} />
            {milestoneName(t)}
          </span>
        )}
      </div>
    </article>
  );

  return (
    <div className="min-h-screen bg-[#FAF8F4] text-[#0F1B2D]">
      <a href="#tasks-main" className="sr-only focus:not-sr-only">
        Skip to content
      </a>

      {/* Shared Startup Sidebar */}
      <StartupSidebar
        active="Tasks & milestones"
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
            <input placeholder="Search workspace" className="h-10 w-64 rounded-lg border border-[#E5E1D8] bg-white pl-9 text-sm" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => notify('You’re all caught up.')} aria-label="Notifications" className="relative grid h-10 w-10 place-items-center">
            <Bell size={19} />
            <i className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#B8955A]" />
          </button>
          <span className="ml-3 flex items-center gap-2 text-xs">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-ink font-semibold text-white">
              {myInitials}
            </span>
            <span className="hidden sm:block">{myName || '…'}</span>
            <ChevronDown size={14} />
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main id="tasks-main" className={`mx-auto max-w-[1440px] px-4 pb-24 pt-7 transition-[margin] duration-200 sm:px-7 lg:px-8 ${compact ? 'lg:ml-[76px]' : 'lg:ml-[240px]'}`}>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-[#4A5568]">
              {org?.name || 'Your startup'} <span className="mx-2 text-[#B8955A]">·</span> Workspace
            </p>
            <h1 className="serif mt-1 text-[30px] font-semibold">Tasks & milestones</h1>
            <p className="mt-1 text-sm text-[#4A5568]">Plan the work, track the milestones.</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => notify('CSV import is ready to connect.')}
              className="hidden min-h-10 items-center gap-2 rounded-lg border border-[#E5E1D8] bg-white px-3 text-sm font-semibold sm:inline-flex"
            >
              <Upload size={15} /> Import CSV
            </button>
            <button
              type="button"
              onClick={() => {
                if (!tasks.length) {
                  notify('There are no tasks to export yet.');
                  return;
                }
                const csv = [
                  'Title,Assignee,Due,Priority,Status,Milestone',
                  ...tasks.map(t =>
                    `"${t.title.replace(/"/g, '""')}","${(assigneeName(t) || '').replace(/"/g, '""')}",${t.due_on || ''},${PRIORITY_LABEL[t.priority]},${STATUS_LABEL[t.status] || t.status},"${(milestoneName(t) || '').replace(/"/g, '""')}"`
                  )
                ].join('\n');
                const a = document.createElement('a');
                a.href = URL.createObjectURL(new Blob([csv], {type: 'text/csv'}));
                a.download = 'tasks.csv';
                a.click();
                notify('Tasks exported as CSV.');
              }}
              className="hidden min-h-10 items-center gap-2 rounded-lg border border-[#E5E1D8] bg-white px-3 text-sm font-semibold sm:inline-flex"
            >
              <Download size={15} /> Export
            </button>
            <Btn onClick={() => setCreating(true)}>
              <Plus size={17} /> New task
            </Btn>
          </div>
        </div>

        {/* Stats Strip */}
        <section className="mb-5 overflow-hidden rounded-xl border border-[#E5E1D8] bg-white">
          <div className="grid grid-cols-2 sm:grid-cols-4">
            {[
              ['Open tasks', open, ''],
              ['Due this week', dueweek, 'warn'],
              ['Overdue', late, 'error'],
              ['Completed', done, 'success']
            ].map(([a, b, c]) => (
              <button
                type="button"
                key={a}
                onClick={() => (c === 'error' ? setFilter('Overdue') : setFilter('All tasks'))}
                className="border-b border-[#E5E1D8] p-4 text-left last:border-0 sm:border-b-0 sm:border-r sm:last:border-r-0 sm:px-6"
              >
                <span className="text-xs text-[#4A5568]">{a}</span>
                <b className={`serif mt-1 block text-2xl ${c === 'error' ? 'text-[#B42318]' : c === 'warn' && b > 0 ? 'text-[#8A5700]' : c === 'success' ? 'text-[#2E7D5B]' : ''}`}>
                  {b}
                </b>
              </button>
            ))}
          </div>
          {/* No sprint entity exists in schema (approved): this is board
              progress, done / total, never a fabricated number. */}
          <div className="flex items-center gap-3 border-t border-[#E5E1D8] px-4 py-3 sm:px-6">
            <span className="text-xs text-[#4A5568]">Board progress</span>
            <div className="h-2 flex-1 rounded-full bg-[#E5E1D8]">
              <div className="h-full rounded-full bg-[#B8955A]" style={{width: `${donePct}%`}} />
            </div>
            <b className="text-xs">{donePct}%</b>
            <span className="hidden text-xs text-[#4A5568] sm:inline">
              {done} of {tasks.length} done
            </span>
          </div>
        </section>

        {/* View Switcher */}
        <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl border border-[#E5E1D8] bg-white p-1">
          {[
            ['Board', Columns3],
            ['List', List],
            ['Milestones', MilestoneIcon],
            ['Calendar', Calendar]
          ].map(([n, I]) => (
            <button
              type="button"
              key={n}
              onClick={() => setView(n)}
              role="tab"
              aria-selected={view === n}
              className={`flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-4 text-sm ${
                view === n ? 'bg-ink font-semibold text-white' : 'text-[#4A5568] hover:bg-[#FAF8F4]'
              }`}
            >
              <I size={16} />
              {n}
            </button>
          ))}
        </div>

        {view !== 'Milestones' && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-[#E5E1D8] bg-white p-3">
            <div className="relative min-w-[180px] flex-1">
              <Search className="absolute left-3 top-2.5 text-[#A0A7B4]" size={16} />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search tasks, labels, people…"
                className="h-10 w-full rounded-lg border border-[#E5E1D8] pl-9 text-sm outline-none focus:border-[#B8955A]"
              />
            </div>
            <Filter size={15} className="text-[#4A5568]" />
            <select
              aria-label="Filter tasks"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="h-10 rounded-lg border border-[#E5E1D8] bg-white px-2 text-xs"
            >
              <option>All tasks</option>
              <option>Assigned to me</option>
              <option>Overdue</option>
              {columns.map(x => (
                <option key={x}>{x}</option>
              ))}
              {milestones.length > 0 && (
                <optgroup label="By Milestone">
                  {milestones.map(m => (
                    <option key={m.id} value={`milestone:${m.id}`}>
                      Milestone: {m.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            {filter.startsWith('milestone:') && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#F3EBDD] px-2.5 py-1 text-xs text-[#806236]">
                <MilestoneIcon size={12} />
                <span className="max-w-[140px] truncate">
                  {milestones.find(m => m.id === filter.slice('milestone:'.length))?.name || 'Milestone'}
                </span>
                <button
                  type="button"
                  onClick={() => setFilter('All tasks')}
                  className="ml-0.5 font-bold text-[#806236] hover:text-ink"
                  aria-label="Clear milestone filter"
                >
                  ×
                </button>
              </span>
            )}
            {view === 'List' && (
              <select
                aria-label="Group tasks"
                value={group}
                onChange={e => setGroup(e.target.value)}
                className="h-10 rounded-lg border border-[#E5E1D8] bg-white px-2 text-xs"
              >
                <option>Status</option>
                <option>Assignee</option>
                <option>Milestone</option>
                <option>Priority</option>
              </select>
            )}
            <span className="text-xs text-[#4A5568]">{filtered.length} tasks</span>
          </div>
        )}

        {/* Step 5c task states: loading / error / no startup */}
        {view !== 'Milestones' && taskStatus === 'loading' && (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4" aria-busy="true" role="status">
            {columns.map(col => (
              <div key={col} className="min-w-[255px] rounded-xl bg-[#F4F1EA] p-3">
                <div className="mb-3 h-5 w-24 animate-pulse rounded bg-[#E5E1D8]" />
                {[0, 1].map(i => (
                  <div key={i} className="mb-2.5 h-24 animate-pulse rounded-xl bg-white" />
                ))}
              </div>
            ))}
            <span className="sr-only">Loading tasks…</span>
          </div>
        )}
        {view !== 'Milestones' && taskStatus === 'error' && (
          <div className="rounded-xl border border-[#E5E1D8] bg-white p-8 text-center" role="alert">
            <p className="text-sm text-[#4A5568]">{taskError}</p>
            <button
              type="button"
              onClick={() => setReloadKey(k => k + 1)}
              className="mt-3 min-h-9 rounded-lg bg-ink px-4 text-sm font-semibold text-white"
            >
              Retry
            </button>
          </div>
        )}
        {view !== 'Milestones' && taskStatus === 'none' && (
          <div className="rounded-xl border border-[#E5E1D8] bg-white p-8 text-center text-sm text-[#4A5568]" role="status">
            Create your startup first — tasks live in your startup workspace.
          </div>
        )}

        {/* Board View */}
        {view === 'Board' && taskStatus === 'ready' && (
          <div className="grid gap-4 overflow-x-auto pb-2 md:grid-cols-2 2xl:grid-cols-4">
            {columns.map(col => {
              const list = filtered
                .filter(t => columnOf(t) === col)
                .sort((a, b) => a.display_order - b.display_order || a.created_at.localeCompare(b.created_at));
              return (
                <section
                  key={col}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault();
                    if (dragId) doMove(dragId, col);
                  }}
                  className="min-w-[255px] rounded-xl bg-[#F4F1EA] p-3"
                >
                  <header className="mb-3 flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold">{col}</h2>
                      <span className="grid h-5 min-w-5 place-items-center rounded-full bg-white px-1 text-[10px] text-[#4A5568]">
                        {list.length}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCreating(true)}
                      aria-label={`Add task to ${col}`}
                      className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white"
                    >
                      <Plus size={17} />
                    </button>
                  </header>
                  <div className="space-y-2.5">
                    {list.map(t => (
                      <div
                        key={t.id}
                        onDragOver={e => {
                          // Dropping onto a card inserts the dragged task
                          // before it (native DnD; no extra library).
                          if (dragId && dragId !== t.id) e.preventDefault();
                        }}
                        onDrop={e => {
                          if (!dragId || dragId === t.id) return;
                          e.preventDefault();
                          e.stopPropagation();
                          reorder(dragId, col, t.id);
                          setDragId(null);
                        }}
                      >
                        {taskCard(t)}
                      </div>
                    ))}
                    {list.length === 0 && (
                      <div className="rounded-lg border border-dashed border-[#D6D0C5] p-5 text-center text-xs text-[#4A5568]">
                        {tasks.length === 0 && canEdit ? 'No tasks yet — add the first one.' : 'Drop a task here'}
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {/* List View */}
        {view === 'List' && taskStatus === 'ready' && (
          <div className="overflow-x-auto rounded-xl border border-[#E5E1D8] bg-white">
            <form onSubmit={quickAdd} className="flex min-w-[760px] items-center gap-3 border-b border-[#E5E1D8] bg-[#FAF8F4] p-3">
              <Plus size={16} className="text-[#9A7A45]" />
              <input
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder={canEdit ? 'Add a task… Press Enter' : 'Read-only access'}
                disabled={!canEdit}
                className="h-9 flex-1 bg-transparent text-sm outline-none disabled:cursor-not-allowed"
              />
              <button
                type="submit"
                disabled={!canEdit || createBusy}
                className="text-xs font-semibold text-[#9A7A45] disabled:opacity-50"
              >
                Add task
              </button>
            </form>
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="border-b border-[#E5E1D8] text-[#4A5568]">
                <tr>
                  {['Task', 'Assignee', 'Due date', 'Priority', 'Status', 'Linked to', 'Labels'].map(x => (
                    <th key={x} className="px-3 py-3 font-medium">
                      {x}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E1D8]">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-[#4A5568]">
                      {tasks.length === 0
                        ? canEdit
                          ? 'No tasks yet. Add the first one above.'
                          : 'No tasks have been created yet.'
                        : 'No tasks match the current search and filter.'}
                    </td>
                  </tr>
                )}
                {filtered.map(t => (
                  <tr key={t.id} onClick={() => openTask(t)} className="h-12 cursor-pointer hover:bg-[#F4F1EA]">
                    <td className="px-3">
                      <input
                        type="checkbox"
                        checked={t.status === 'done'}
                        disabled={!canEdit}
                        onClick={e => e.stopPropagation()}
                        onChange={() => toggleDone(t)}
                        className="mr-2 accent-ink"
                      />
                      <span className={t.status === 'done' ? 'text-[#A0A7B4] line-through' : ''}>{t.title}</span>
                    </td>
                    <td className="px-3">{assigneeName(t) || '—'}</td>
                    <td className="px-3">{dueChip(t)}</td>
                    <td className="px-3">{PRIORITY_LABEL[t.priority]}</td>
                    <td className="px-3">
                      <select
                        value={columnOf(t)}
                        disabled={!canEdit}
                        onClick={e => e.stopPropagation()}
                        onChange={e => setStatus(t, e.target.value)}
                        className="rounded-md border border-[#E5E1D8] bg-white px-2 py-1 disabled:opacity-60"
                      >
                        {columns.map(c => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 text-[#9A7A45]">{milestoneName(t) || '—'}</td>
                    <td className="px-3">
                      {(t.labels || []).length ? (
                        <span className="flex flex-wrap gap-1">
                          {(t.labels || []).map(l => (
                            <span
                              key={l.id}
                              style={labelStyle(l)}
                              className="rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-4"
                            >
                              {l.name}
                            </span>
                          ))}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Milestones View (Step 5b: real API data) */}
        {view === 'Milestones' && (
          <div className="space-y-5">
            {msStatus === 'loading' && (
              <div className="rounded-xl border border-[#E5E1D8] bg-white p-8 text-center text-sm text-[#4A5568]" role="status">
                Loading milestones…
              </div>
            )}
            {msStatus === 'error' && (
              <div className="rounded-xl border border-[#E5E1D8] bg-white p-8 text-center" role="alert">
                <p className="text-sm text-[#4A5568]">{msError}</p>
                <button
                  type="button"
                  onClick={() => setReloadKey(k => k + 1)}
                  className="mt-3 min-h-9 rounded-lg bg-ink px-4 text-sm font-semibold text-white"
                >
                  Retry
                </button>
              </div>
            )}
            {msStatus === 'none' && (
              <div className="rounded-xl border border-[#E5E1D8] bg-white p-8 text-center text-sm text-[#4A5568]" role="status">
                Create your startup first — milestones live in your startup workspace.
              </div>
            )}
            {msStatus === 'ready' && (
              <>
                {milestones.length > 0 && (
                  <section className="overflow-x-auto rounded-xl border border-[#E5E1D8] bg-white p-5">
                    <div className="flex min-w-[620px] items-start">
                      {milestones.map((m, i) => {
                        const isAchieved = m.status === 'achieved';
                        const isMissed = m.status === 'missed';
                        const isRisky = m.status === 'at_risk' || m.status === 'off_track';
                        const statusLabel = MS_STATUS_LABELS[m.status] || m.status;
                        return (
                          <div
                            key={m.id}
                            className="group flex flex-1 cursor-pointer items-start last:flex-none"
                            onClick={() => {
                              setExpandedMilestones(prev => ({...prev, [m.id]: true}));
                              const el = document.getElementById(`milestone-${m.id}`);
                              if (el) el.scrollIntoView({behavior: 'smooth', block: 'center'});
                            }}
                          >
                            <div className="flex flex-col items-center">
                              <span
                                className={`grid h-9 w-9 place-items-center rounded-full border-2 transition-all ${
                                  isAchieved
                                    ? 'border-[#286749] bg-[#E7F3EC] text-[#286749]'
                                    : isMissed
                                      ? 'border-[#9A3A3A] bg-[#FDECEC] text-[#9A3A3A]'
                                      : isRisky
                                        ? 'border-[#B7791F] bg-[#FFF3D6] text-[#8A5700]'
                                        : 'border-[#B8955A] bg-[#F3EBDD] text-[#806236]'
                                }`}
                                title={`${m.name} (${statusLabel})`}
                              >
                                {isAchieved ? (
                                  <Check size={16} />
                                ) : isMissed ? (
                                  <AlertCircle size={16} />
                                ) : isRisky ? (
                                  <AlertTriangle size={16} />
                                ) : (
                                  <Target size={16} />
                                )}
                              </span>
                              <span className="mt-2 text-xs font-semibold group-hover:text-[#B8955A]">
                                {m.target_date
                                  ? new Date(`${m.target_date}T00:00:00`).toLocaleDateString('en-IN', {month: 'short', day: 'numeric'})
                                  : 'No date'}
                              </span>
                              <small className="mt-1 max-w-[110px] truncate text-center text-[10px] text-[#4A5568]">
                                {m.name}
                              </small>
                              <span className="mt-0.5 text-[9px] font-medium text-[#718096]">
                                {statusLabel}
                              </span>
                            </div>
                            {i < milestones.length - 1 && (
                              <span className={`mt-4 h-[2px] flex-1 ${isAchieved ? 'bg-[#286749]' : 'bg-[#E5E1D8]'}`} />
                            )}
                          </div>
                        );
                      })}
                      {canEdit && (
                        <button
                          type="button"
                          onClick={openCreate}
                          aria-label="New milestone"
                          className="ml-5 grid h-9 w-9 place-items-center rounded-full border border-dashed border-[#A0A7B4] hover:border-ink hover:text-ink"
                        >
                          <Plus size={15} />
                        </button>
                      )}
                    </div>
                  </section>
                )}
                <div className="flex justify-end">
                  {canEdit && (
                    <Btn onClick={openCreate}>
                      <Plus size={15} /> New milestone
                    </Btn>
                  )}
                </div>
                {milestones.length === 0 && (
                  <div className="rounded-xl border border-[#E5E1D8] bg-white p-8 text-center text-sm text-[#4A5568]" role="status">
                    No milestones yet.{canEdit ? ' Create the first one to start the timeline.' : ''}
                  </div>
                )}
                {milestones.map(m => {
                  const label = MS_STATUS_LABELS[m.status] || m.status;
                  const isAchieved = m.status === 'achieved';
                  const risky = m.status === 'at_risk' || m.status === 'off_track';
                  const missed = m.status === 'missed';
                  const badge = isAchieved
                    ? 'bg-[#E7F3EC] text-[#286749] border-[#286749]/30'
                    : missed
                      ? 'bg-[#FDECEC] text-[#9A3A3A] border-[#9A3A3A]/30'
                      : risky
                        ? 'bg-[#FFF3D6] text-[#8A5700] border-[#8A5700]/30'
                        : 'bg-[#F3EBDD] text-[#806236] border-[#806236]/30';

                  const linkedTasks = tasks.filter(t => t.milestone_id === m.id);
                  const openCount = linkedTasks.filter(t => t.status !== 'done').length;
                  const doneCount = linkedTasks.filter(t => t.status === 'done').length;
                  const totalTasks = linkedTasks.length;
                  const taskPct = totalTasks > 0 ? Math.round((doneCount / totalTasks) * 100) : (m.progress || 0);
                  const isExpanded = !!expandedMilestones[m.id];

                  // Target date relative info
                  let dateInfo = null;
                  if (m.target_date) {
                    const formatted = new Date(`${m.target_date}T00:00:00`).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    });
                    if (isAchieved) {
                      dateInfo = {text: `Achieved · Target was ${formatted}`, color: 'text-[#286749]'};
                    } else if (m.target_date < today) {
                      const diffMs = new Date(`${today}T00:00:00`) - new Date(`${m.target_date}T00:00:00`);
                      const diffDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
                      dateInfo = {
                        text: `Overdue by ${diffDays} day${diffDays === 1 ? '' : 's'} (${formatted})`,
                        color: 'text-[#B42318] font-semibold'
                      };
                    } else if (m.target_date === today) {
                      dateInfo = {text: `Due today (${formatted})`, color: 'text-[#8A5700] font-semibold'};
                    } else {
                      const diffMs = new Date(`${m.target_date}T00:00:00`) - new Date(`${today}T00:00:00`);
                      const diffDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
                      dateInfo = {
                        text: `Due in ${diffDays} day${diffDays === 1 ? '' : 's'} (${formatted})`,
                        color: 'text-[#4A5568]'
                      };
                    }
                  }

                  return (
                    <section
                      key={m.id}
                      id={`milestone-${m.id}`}
                      className="rounded-xl border border-[#E5E1D8] bg-white p-5 transition-all shadow-[0_1px_2px_rgba(15,27,45,.03)]"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            disabled={!canEdit}
                            onClick={() => toggleMilestoneAchieved(m)}
                            aria-label={isAchieved ? `Mark ${m.name} incomplete` : `Mark ${m.name} achieved`}
                            className="mt-1 shrink-0 rounded-full text-[#A0A7B4] hover:text-[#286749] disabled:cursor-not-allowed"
                            title={isAchieved ? 'Mark incomplete (reopen)' : 'Mark milestone achieved'}
                          >
                            {isAchieved ? (
                              <CheckCircle2 className="text-[#286749]" size={22} />
                            ) : (
                              <div className="h-5 w-5 rounded-full border-2 border-[#A0A7B4] hover:border-[#286749]" />
                            )}
                          </button>
                          <div>
                            <h2 className={`serif text-xl font-semibold ${isAchieved ? 'text-[#718096] line-through' : 'text-[#0F1B2D]'}`}>
                              {m.name}
                            </h2>
                            {m.description && (
                              <p className="mt-1 text-xs text-[#4A5568]">{m.description}</p>
                            )}
                            <p className="mt-1.5 text-xs text-[#4A5568]">
                              {dateInfo ? (
                                <span className={dateInfo.color}>{dateInfo.text}</span>
                              ) : (
                                <span>No target date set</span>
                              )}
                              {' · '}
                              <span>Owner: {ownerNameOf(m.owner_id) || 'Unassigned'}</span>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5">
                          {/* Real-world direct status changer */}
                          <select
                            aria-label={`Change status for ${m.name}`}
                            value={m.status}
                            disabled={!canEdit}
                            onChange={e => updateMilestoneStatus(m, e.target.value)}
                            className={`rounded-full border px-2.5 py-1 text-xs font-semibold outline-none cursor-pointer disabled:cursor-not-allowed ${badge}`}
                          >
                            {Object.entries(MS_STATUS_LABELS).map(([val, txt]) => (
                              <option key={val} value={val} className="bg-white text-ink font-normal">
                                {txt}
                              </option>
                            ))}
                          </select>
                          {canEdit && (
                            <span className="flex items-center gap-2 text-xs font-semibold">
                              <button
                                type="button"
                                onClick={() => openEdit(m)}
                                className="text-[#9A7A45] hover:underline"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => removeMilestone(m)}
                                className="text-[#9A3A3A] hover:underline"
                              >
                                Delete
                              </button>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Visual progress bar */}
                      <div className="mt-4 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[#4A5568]">
                            {totalTasks > 0 ? (
                              <>
                                <b className="font-semibold text-ink">{doneCount}</b> of {totalTasks} deliverables done
                                {openCount > 0 && ` · ${openCount} open`}
                              </>
                            ) : (
                              <span>Milestone progress: {m.progress || 0}%</span>
                            )}
                          </span>
                          <span className="font-semibold text-ink">{taskPct}%</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-[#E5E1D8]">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${isAchieved ? 'bg-[#286749]' : 'bg-[#B8955A]'}`}
                            style={{width: `${taskPct}%`}}
                          />
                        </div>
                      </div>

                      {/* Real-world deliverables accordion and management */}
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#E5E1D8] pt-3 text-xs">
                        <button
                          type="button"
                          onClick={() => toggleExpandMilestone(m.id)}
                          className="flex items-center gap-1.5 font-semibold text-[#9A7A45] hover:text-[#806236]"
                        >
                          {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                          <span>{isExpanded ? 'Hide deliverables' : `Manage deliverables (${totalTasks})`}</span>
                        </button>
                        {totalTasks > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setFilter(`milestone:${m.id}`);
                              setView('Board');
                            }}
                            className="font-medium text-[#4A5568] hover:text-ink"
                          >
                            View on Kanban Board →
                          </button>
                        )}
                      </div>

                      {/* Expandable deliverables section */}
                      {isExpanded && (
                        <div className="mt-3 space-y-2 rounded-xl bg-[#FAF8F4] p-3 border border-[#E5E1D8]">
                          {linkedTasks.length === 0 ? (
                            <p className="py-2 text-center text-xs text-[#4A5568]">
                              No deliverable tasks linked to this milestone yet. Add one below to track your team&apos;s progress.
                            </p>
                          ) : (
                            <div className="space-y-1.5">
                              {linkedTasks.map(t => (
                                <div
                                  key={t.id}
                                  className="flex items-center justify-between gap-3 rounded-lg border border-[#E5E1D8] bg-white p-2.5 transition hover:border-[#D6D0C5]"
                                >
                                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                                    <input
                                      type="checkbox"
                                      checked={t.status === 'done'}
                                      disabled={!canEdit}
                                      onChange={() => toggleDone(t)}
                                      className="h-4 w-4 cursor-pointer accent-ink"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => openTask(t)}
                                      className={`truncate text-left text-xs font-medium hover:underline ${
                                        t.status === 'done' ? 'text-[#A0A7B4] line-through' : 'text-ink'
                                      }`}
                                    >
                                      {t.title}
                                    </button>
                                  </div>
                                  <div className="flex shrink-0 items-center gap-2 text-[11px]">
                                    <span className="grid h-6 w-6 place-items-center rounded-full bg-[#F3EBDD] text-[9px] font-semibold" title={assigneeName(t) || 'Unassigned'}>
                                      {assigneeInitials(t)}
                                    </span>
                                    {dueChip(t)}
                                    <span
                                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                        t.status === 'done'
                                          ? 'bg-[#E7F3EC] text-[#286749]'
                                          : t.status === 'blocked'
                                            ? 'bg-[#FCE8E6] text-[#B42318]'
                                            : 'bg-[#F3F4F6] text-[#4A5568]'
                                      }`}
                                    >
                                      {STATUS_LABEL[t.status] || t.status}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Quick inline deliverable creator */}
                          {canEdit && (
                            <form
                              onSubmit={async e => {
                                e.preventDefault();
                                const val = milestoneNewTasks[m.id];
                                if (!val?.trim()) return;
                                const ok = await addDeliverable(m.id, val);
                                if (ok) {
                                  setMilestoneNewTasks(prev => ({...prev, [m.id]: ''}));
                                }
                              }}
                              className="mt-2 flex items-center gap-2 pt-1"
                            >
                              <input
                                value={milestoneNewTasks[m.id] || ''}
                                onChange={e =>
                                  setMilestoneNewTasks(prev => ({...prev, [m.id]: e.target.value}))
                                }
                                placeholder={
                                  m.target_date
                                    ? `Add task… (Due date will auto-set to ${m.target_date})`
                                    : 'Add deliverable task to this milestone… (Press Enter)'
                                }
                                className="h-9 flex-1 rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs outline-none focus:border-[#B8955A]"
                              />
                              <button
                                type="submit"
                                disabled={!milestoneNewTasks[m.id]?.trim()}
                                className="inline-flex h-9 items-center gap-1 rounded-lg bg-ink px-3 text-xs font-semibold text-white hover:bg-[#1C2B42] disabled:opacity-50"
                              >
                                <Plus size={14} /> Add task
                              </button>
                              <button
                                type="button"
                                onClick={() => openCreate(m.id)}
                                className="hidden text-xs font-medium text-[#9A7A45] hover:underline sm:inline"
                                title="Open full task creator pre-linked to this milestone"
                              >
                                Options…
                              </button>
                            </form>
                          )}
                        </div>
                      )}
                    </section>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* Calendar View */}
        {view === 'Calendar' && (
          <section className="rounded-xl border border-[#E5E1D8] bg-white p-5">
            <div className="mb-5 flex items-center justify-between">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => setMonth(month === 0 ? 11 : month - 1)}
                className="grid h-9 w-9 place-items-center rounded-lg border"
              >
                <ChevronRight className="rotate-180" size={17} />
              </button>
              <h2 className="serif text-xl font-semibold">
                {new Date(Date.UTC(Number(today.slice(0, 4)), month, 1)).toLocaleDateString('en-IN', {month: 'long', year: 'numeric', timeZone: 'UTC'})}
              </h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMonth(new Date().getUTCMonth())}
                  className="rounded-lg border px-3 text-xs"
                >
                  Today
                </button>
                <button
                  type="button"
                  aria-label="Next month"
                  onClick={() => setMonth(month === 11 ? 0 : month + 1)}
                  className="grid h-9 w-9 place-items-center rounded-lg border"
                >
                  <ChevronRight size={17} />
                </button>
              </div>
            </div>
            {(() => {
              // Real calendar for the selected month (UTC, Monday-first):
              // no fixed 35 cells and no year pinned in the source.
              const year = Number(today.slice(0, 4));
              const first = new Date(Date.UTC(year, month, 1));
              const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
              const lead = (first.getUTCDay() + 6) % 7; // Monday = 0
              const cells = [...Array(lead).fill(null), ...Array.from({length: daysInMonth}, (_, i) => i + 1)];
              return (
                <div className="grid grid-cols-7 border-l border-t border-[#E5E1D8]">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                    <div key={d} className="border-b border-r border-[#E5E1D8] bg-[#FAF8F4] p-2 text-center text-[10px] font-semibold text-[#4A5568]">
                      {d}
                    </div>
                  ))}
                  {cells.map((day, i) => {
                    if (day === null) {
                      return <div key={`lead-${i}`} className="min-h-[78px] border-b border-r border-[#E5E1D8] bg-[#FCFBF8]" />;
                    }
                    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const items = tasks.filter(t => t.due_on === date);
                    return (
                      <div key={date} className="min-h-[78px] border-b border-r border-[#E5E1D8] p-1.5">
                        <span className={`text-[10px] ${date === today ? 'grid h-5 w-5 place-items-center rounded-full bg-ink text-white' : ''}`}>
                          {day}
                        </span>
                        {items.map(t => (
                          <button
                            type="button"
                            key={t.id}
                            onClick={() => openTask(t)}
                            className={`mt-1 block w-full truncate rounded px-1 py-1 text-left text-[9px] ${
                              t.status === 'done' ? 'bg-[#E7F3EC] text-[#286749] line-through' : 'bg-[#F3EBDD] text-[#806236]'
                            }`}
                          >
                            {t.title}
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </section>
        )}

        {/* Bottom Widgets */}
        <div className="mt-6 grid gap-5 xl:grid-cols-3">
          <section className="rounded-xl border border-[#E5E1D8] bg-white p-5">
            <h2 className="text-sm font-semibold">My focus</h2>
            <p className="mt-1 text-xs text-[#4A5568]">Today and overdue</p>
            <div className="mt-3 space-y-3">
              {focusTasks.slice(0, 5).map(t => (
                <label key={t.id} className="flex items-center gap-2 text-xs">
                  <input type="checkbox" onChange={() => toggleDone(t)} className="accent-ink" />
                  <span className="flex-1">{t.title}</span>
                  {dueChip(t)}
                </label>
              ))}
              {focusTasks.length === 0 && (
                <p className="text-xs text-[#4A5568]">You’re all caught up.</p>
              )}
            </div>
            <button type="button" onClick={() => setFilter('Assigned to me')} className="mt-3 text-xs font-semibold text-[#9A7A45]">
              View my tasks <ArrowRight className="inline" size={13} />
            </button>
          </section>

          <section className="rounded-xl border border-[#E5E1D8] bg-white p-5">
            <h2 className="text-sm font-semibold">Stage progress</h2>
            {/* Readiness criteria are Step 5f — no real data yet, so show an
                honest empty state instead of invented numbers. */}
            <p className="mt-2 rounded-lg bg-[#FAF8F4] p-3 text-xs text-[#4A5568]" role="status">
              Stage criteria and approvals arrive with readiness (Step 5f).
            </p>
            <p className="mt-3 text-xs text-[#4A5568]">
              {tasks.filter(t => t.status !== 'done').length} open tasks on this board
            </p>
            <Link href="/startup/stage" className="mt-3 inline-block text-xs font-semibold text-[#9A7A45]">
              View stage toolkit <ArrowRight className="inline" size={13} />
            </Link>
          </section>

          <section className="rounded-xl border border-[#E5E1D8] bg-white p-5">
            <h2 className="text-sm font-semibold">Workload</h2>
            <p className="mt-1 text-xs text-[#4A5568]">Open tasks by teammate</p>
            {workload.map(({id, name, n}) => (
              <div key={id} className="mt-3">
                <div className="mb-1 flex justify-between text-xs">
                  <span>{name}</span>
                  <span>{n} open</span>
                </div>
                <div className="h-1.5 rounded-full bg-[#E5E1D8]">
                  <div
                    className={`h-full rounded-full ${n > 3 ? 'bg-[#B7791F]' : 'bg-ink'}`}
                    style={{width: `${Math.min(100, n * 17)}%`}}
                  />
                </div>
              </div>
            ))}
            {workload.length === 0 && (
              <p className="mt-3 text-xs text-[#4A5568]">No assigned open tasks yet.</p>
            )}
          </section>
        </div>
      </main>

      {/* Creation Modal */}
      {creating && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[#0F1B2D]/45 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="create-heading" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 id="create-heading" className="serif text-2xl font-semibold">
                  New {view === 'Milestones' ? 'milestone' : 'task'}
                </h2>
                <p className="mt-1 text-sm text-[#4A5568]">Capture a clear next step for the team.</p>
              </div>
              <button type="button" onClick={() => setCreating(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <form
              onSubmit={async e => {
                e.preventDefault();
                const title = newTitle.trim();
                if (!title || createBusy) return;
                if (view === 'Milestones') {
                  setCreateErrs({});
                  setCreateFormErr('');
                  setCreateBusy(true);
                  try {
                    await api.milestones.create(org.id, {
                      name: title,
                      description: newDesc.trim() || null,
                      target_date: newDate || null
                    });
                  } catch (err) {
                    const errs = errorsFrom(err);
                    setCreateErrs(errs);
                    setCreateFormErr(
                      Object.keys(errs).length
                        ? ''
                        : err instanceof ApiError
                          ? err.message
                          : 'Could not create the milestone.'
                    );
                    setCreateBusy(false);
                    return;
                  }
                  setCreateBusy(false);
                  notify('Milestone created.');
                  setNewTitle('');
                  setNewDesc('');
                  setNewDate('');
                  setCreating(false);
                  await loadMilestones(org.id);
                  return;
                }
                setCreateErrs({});
                setCreateFormErr('');
                setCreateBusy(true);
                try {
                  const row = await api.tasks.create(org.id, {
                    title,
                    description: newDesc.trim() || null,
                    priority: PRIORITY_API[newPriority] || 'medium',
                    milestone_id: newMilestone || null,
                    assignee_id: newAssignee || null,
                    due_on: newDate || null
                  });
                  setTasks(prev => [...prev, row]);
                } catch (err) {
                  const errs = errorsFrom(err);
                  setCreateErrs(errs);
                  setCreateFormErr(
                    Object.keys(errs).length
                      ? ''
                      : err instanceof ApiError
                        ? err.message
                        : 'Could not create the task.'
                  );
                  setCreateBusy(false);
                  return;
                }
                setCreateBusy(false);
                notify('Task created.');
                setNewTitle('');
                setNewDesc('');
                setNewDate('');
                setNewAssignee('');
                setNewPriority('Medium');
                setNewMilestone('');
                setCreating(false);
              }}
              className="space-y-4"
            >
              <label className="block text-sm font-medium">
                Title
                <input
                  autoFocus
                  required
                  maxLength={140}
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder={view === 'Milestones' ? 'e.g. Launch MVP to test users' : 'e.g. Share pricing proposal'}
                  className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] px-3 text-sm outline-none focus:border-[#B8955A]"
                />
                {createErrs[view === 'Milestones' ? 'name' : 'title'] && (
                  <span className="mt-1 block text-xs text-[#9A3A3A]" role="alert">
                    {createErrs[view === 'Milestones' ? 'name' : 'title']}
                  </span>
                )}
              </label>
              {view === 'Milestones' ? (
                <>
                  <label className="block text-sm font-medium">
                    Description
                    <textarea
                      rows={3}
                      value={newDesc}
                      onChange={e => setNewDesc(e.target.value)}
                      placeholder="What does success look like?"
                      className="mt-2 w-full rounded-lg border border-[#E5E1D8] p-3 text-sm"
                    />
                    {createErrs.description && (
                      <span className="mt-1 block text-xs text-[#9A3A3A]" role="alert">{createErrs.description}</span>
                    )}
                  </label>
                  <label className="block text-sm font-medium">
                    Target date
                    <input
                      type="date"
                      required
                      value={newDate}
                      onChange={e => setNewDate(e.target.value)}
                      className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] px-3"
                    />
                    {createErrs.target_date && (
                      <span className="mt-1 block text-xs text-[#9A3A3A]" role="alert">{createErrs.target_date}</span>
                    )}
                  </label>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-sm font-medium">
                      Assignee
                      <select
                        value={newAssignee}
                        onChange={e => setNewAssignee(e.target.value)}
                        className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 text-sm"
                      >
                        <option value="">Unassigned</option>
                        {members.filter(x => x.status === 'active').map(x => (
                          <option key={x.user_id} value={x.user_id}>{x.display_name}</option>
                        ))}
                      </select>
                      {createErrs.assignee_id && (
                        <span className="mt-1 block text-xs text-[#9A3A3A]" role="alert">{createErrs.assignee_id}</span>
                      )}
                    </label>
                    <label className="text-sm font-medium">
                      Due date
                      <input
                        type="date"
                        value={newDate}
                        onChange={e => setNewDate(e.target.value)}
                        className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] px-3 text-sm"
                      />
                      {createErrs.due_on && (
                        <span className="mt-1 block text-xs text-[#9A3A3A]" role="alert">{createErrs.due_on}</span>
                      )}
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-sm font-medium">
                      Priority
                      <select
                        value={newPriority}
                        onChange={e => setNewPriority(e.target.value)}
                        className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 text-sm"
                      >
                        {['Low', 'Medium', 'High', 'Urgent'].map(p => (
                          <option key={p}>{p}</option>
                        ))}
                      </select>
                      {createErrs.priority && (
                        <span className="mt-1 block text-xs text-[#9A3A3A]" role="alert">{createErrs.priority}</span>
                      )}
                    </label>
                    <label className="text-sm font-medium">
                      Milestone
                      <select
                        value={newMilestone}
                        onChange={e => {
                          const val = e.target.value;
                          setNewMilestone(val);
                          if (val) {
                            const ms = milestones.find(m => m.id === val);
                            if (ms?.target_date) {
                              setNewDate(ms.target_date);
                            }
                          }
                        }}
                        className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 text-sm"
                      >
                        <option value="">No milestone</option>
                        {milestones.map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                      {createErrs.milestone_id && (
                        <span className="mt-1 block text-xs text-[#9A3A3A]" role="alert">{createErrs.milestone_id}</span>
                      )}
                    </label>
                  </div>
                  <label className="block text-sm font-medium">
                    Description (optional)
                    <textarea
                      rows={3}
                      value={newDesc}
                      onChange={e => setNewDesc(e.target.value)}
                      placeholder="Add context or acceptance criteria"
                      className="mt-2 w-full rounded-lg border border-[#E5E1D8] p-3 text-sm"
                    />
                    {createErrs.description && (
                      <span className="mt-1 block text-xs text-[#9A3A3A]" role="alert">{createErrs.description}</span>
                    )}
                  </label>
                </>
              )}
              {createFormErr && (
                <p className="rounded-lg bg-[#FDECEC] px-3 py-2 text-xs text-[#9A3A3A]" role="alert">
                  {createFormErr}
                </p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setCreating(false)} className="min-h-10 px-4 text-sm">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createBusy}
                  className="min-h-10 rounded-lg bg-ink px-4 text-sm font-semibold text-white disabled:opacity-60"
                >
                  Create {view === 'Milestones' ? 'milestone' : 'task'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Milestone Editor (Step 5b) */}
      {editing && editForm && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[#0F1B2D]/45 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="edit-heading" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 id="edit-heading" className="serif text-2xl font-semibold">Edit milestone</h2>
                <p className="mt-1 text-sm text-[#4A5568]">Update the plan, owner and status.</p>
              </div>
              <button type="button" onClick={() => setEditing(null)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <form
              onSubmit={async e => {
                e.preventDefault();
                if (editBusy) return;
                const name = (editForm.name || '').trim();
                if (!name) {
                  setEditErrs({name: 'Required.'});
                  return;
                }
                setEditErrs({});
                setEditFormErr('');
                setEditBusy(true);
                const progress = Math.min(100, Math.max(0, Number(editForm.progress) || 0));
                try {
                  await api.milestones.update(org.id, editing.id, {
                    name,
                    description: (editForm.description || '').trim() || null,
                    target_date: editForm.target_date || null,
                    status: editForm.status,
                    progress,
                    owner_id: editForm.owner_id || null
                  });
                } catch (err) {
                  const errs = errorsFrom(err);
                  setEditErrs(errs);
                  setEditFormErr(
                    Object.keys(errs).length
                      ? ''
                      : err instanceof ApiError
                        ? err.message
                        : 'Could not update the milestone.'
                  );
                  setEditBusy(false);
                  return;
                }
                setEditBusy(false);
                notify('Milestone updated.');
                setEditing(null);
                await loadMilestones(org.id);
              }}
              className="space-y-4"
            >
              <label className="block text-sm font-medium">
                Name
                <input
                  autoFocus
                  required
                  maxLength={200}
                  value={editForm.name}
                  onChange={e => setEditForm({...editForm, name: e.target.value})}
                  className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] px-3 text-sm outline-none focus:border-[#B8955A]"
                />
                {editErrs.name && (
                  <span className="mt-1 block text-xs text-[#9A3A3A]" role="alert">{editErrs.name}</span>
                )}
              </label>
              <label className="block text-sm font-medium">
                Description
                <textarea
                  rows={3}
                  value={editForm.description}
                  onChange={e => setEditForm({...editForm, description: e.target.value})}
                  placeholder="What does success look like?"
                  className="mt-2 w-full rounded-lg border border-[#E5E1D8] p-3 text-sm"
                />
                {editErrs.description && (
                  <span className="mt-1 block text-xs text-[#9A3A3A]" role="alert">{editErrs.description}</span>
                )}
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium">
                  Target date
                  <input
                    type="date"
                    value={editForm.target_date}
                    onChange={e => setEditForm({...editForm, target_date: e.target.value})}
                    className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] px-3"
                  />
                  {editErrs.target_date && (
                    <span className="mt-1 block text-xs text-[#9A3A3A]" role="alert">{editErrs.target_date}</span>
                  )}
                </label>
                <label className="block text-sm font-medium">
                  Status
                  <select
                    value={editForm.status}
                    onChange={e => setEditForm({...editForm, status: e.target.value})}
                    className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 text-sm"
                  >
                    {Object.entries(MS_STATUS_LABELS).map(([value, text]) => (
                      <option key={value} value={value}>{text}</option>
                    ))}
                  </select>
                  {editErrs.status && (
                    <span className="mt-1 block text-xs text-[#9A3A3A]" role="alert">{editErrs.status}</span>
                  )}
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium">
                  Progress (%)
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editForm.progress}
                    onChange={e => setEditForm({...editForm, progress: e.target.value})}
                    className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] px-3"
                  />
                  {editErrs.progress && (
                    <span className="mt-1 block text-xs text-[#9A3A3A]" role="alert">{editErrs.progress}</span>
                  )}
                </label>
                <label className="block text-sm font-medium">
                  Owner
                  <select
                    value={editForm.owner_id}
                    onChange={e => setEditForm({...editForm, owner_id: e.target.value})}
                    className="mt-2 h-11 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 text-sm"
                  >
                    <option value="">No owner</option>
                    {members.filter(x => x.status === 'active').map(x => (
                      <option key={x.user_id} value={x.user_id}>{x.display_name}</option>
                    ))}
                  </select>
                  {editErrs.owner_id && (
                    <span className="mt-1 block text-xs text-[#9A3A3A]" role="alert">{editErrs.owner_id}</span>
                  )}
                </label>
              </div>
              {editFormErr && (
                <p className="rounded-lg bg-[#FDECEC] px-3 py-2 text-xs text-[#9A3A3A]" role="alert">
                  {editFormErr}
                </p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditing(null)} className="min-h-10 px-4 text-sm">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editBusy}
                  className="min-h-10 rounded-lg bg-ink px-4 text-sm font-semibold text-white disabled:opacity-60"
                >
                  Save changes
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Selected Task Details Drawer (Step 5c: real reads and writes) */}
      {selected && (
        <div className="fixed inset-0 z-40 bg-[#0F1B2D]/35" onMouseDown={e => { if (e.target === e.currentTarget) closeTask(); }}>
          <aside role="dialog" aria-modal="true" aria-label="Task details" className="absolute inset-y-0 right-0 w-full max-w-[480px] overflow-y-auto bg-[#FAF8F4] p-5 shadow-xl sm:p-7">
            <div className="mb-5 flex justify-end">
              <button type="button" onClick={closeTask} aria-label="Close task details" className="grid h-10 w-10 place-items-center rounded-lg bg-white">
                <X size={18} />
              </button>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => toggleDone(selected)}
                aria-label={selected.status === 'done' ? 'Mark incomplete' : 'Mark complete'}
                className={`mt-1 grid h-5 w-5 shrink-0 place-items-center rounded border disabled:opacity-50 ${
                  selected.status === 'done' ? 'border-ink bg-ink text-white' : 'border-[#A0A7B4]'
                }`}
              >
                {selected.status === 'done' && <Check size={14} />}
              </button>
              <input
                value={drawer?.title ?? selected.title}
                disabled={!canEdit}
                onChange={e => setDrawer({...(drawer || {}), title: e.target.value})}
                onBlur={() => {
                  const value = (drawer?.title ?? '').trim();
                  if (!value || value === selected.title) {
                    setDrawer(null);
                    return;
                  }
                  patchTask(selected, {title: value}, 'Task updated.');
                  setDrawer(null);
                }}
                className="w-full bg-transparent font-semibold outline-none disabled:opacity-70"
              />
            </div>
            {drawerErrs.title && (
              <span className="mt-1 block text-xs text-[#9A3A3A]" role="alert">{drawerErrs.title}</span>
            )}
            <div className="mt-4 flex gap-2">
              <select
                value={columnOf(selected)}
                disabled={!canEdit}
                onChange={e => setStatus(selected, e.target.value)}
                aria-label="Task status"
                className="h-10 rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs disabled:opacity-60"
              >
                {columns.map(c => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <select
                value={selected.priority}
                disabled={!canEdit}
                onChange={e => patchTask(selected, {priority: e.target.value})}
                aria-label="Task priority"
                className="h-10 rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs disabled:opacity-60"
              >
                {['low', 'medium', 'high', 'urgent'].map(x => (
                  <option key={x} value={x}>{PRIORITY_LABEL[x]}</option>
                ))}
              </select>
              {selected.status === 'blocked' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#FDECEC] px-3 text-xs font-medium text-[#9A3A3A]">
                  <Clock size={12} /> Blocked
                </span>
              )}
            </div>
            <div className="mt-6 rounded-xl border border-[#E5E1D8] bg-white p-4">
              <h3 className="text-sm font-semibold">Task details</h3>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <label className="text-xs text-[#4A5568]">
                  Assignee
                  <select
                    value={selected.assignee_id || ''}
                    disabled={!canEdit}
                    onChange={e => patchTask(selected, {assignee_id: e.target.value || null})}
                    className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-2 text-xs disabled:opacity-60"
                  >
                    <option value="">Unassigned</option>
                    {members.filter(x => x.status === 'active').map(x => (
                      <option key={x.user_id} value={x.user_id}>{x.display_name}</option>
                    ))}
                  </select>
                  {drawerErrs.assignee_id && (
                    <span className="mt-1 block text-xs text-[#9A3A3A]" role="alert">{drawerErrs.assignee_id}</span>
                  )}
                </label>
                <label className="text-xs text-[#4A5568]">
                  Due date
                  <input
                    type="date"
                    value={selected.due_on || ''}
                    disabled={!canEdit}
                    onChange={e => patchTask(selected, {due_on: e.target.value || null})}
                    className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] px-2 text-xs disabled:opacity-60"
                  />
                  {drawerErrs.due_on && (
                    <span className="mt-1 block text-xs text-[#9A3A3A]" role="alert">{drawerErrs.due_on}</span>
                  )}
                </label>
                <label className="text-xs text-[#4A5568]">
                  Milestone
                  <select
                    value={selected.milestone_id || ''}
                    disabled={!canEdit}
                    onChange={e => {
                      const val = e.target.value || null;
                      const patch = {milestone_id: val};
                      if (val && !selected.due_on) {
                        const ms = milestones.find(m => m.id === val);
                        if (ms?.target_date) {
                          patch.due_on = ms.target_date;
                        }
                      }
                      patchTask(selected, patch);
                    }}
                    className="mt-1 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-2 text-xs disabled:opacity-60"
                  >
                    <option value="">None</option>
                    {milestones.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                  {drawerErrs.milestone_id && (
                    <span className="mt-1 block text-xs text-[#9A3A3A]" role="alert">{drawerErrs.milestone_id}</span>
                  )}
                </label>
                <div className="text-xs text-[#4A5568]">
                  Created by
                  <p className="mt-2 font-medium text-ink">
                    {selected.created_by === myId
                      ? myName || 'You'
                      : ownerNameOf(selected.created_by) || '—'}
                  </p>
                </div>
              </div>
            </div>
            <label className="mt-5 block text-sm font-semibold">
              Description
              <textarea
                value={drawer?.description ?? selected.description ?? ''}
                disabled={!canEdit}
                onChange={e => setDrawer({...(drawer || {}), description: e.target.value})}
                onBlur={() => {
                  const value = drawer?.description ?? '';
                  const current = selected.description ?? '';
                  if (value === current) {
                    setDrawer(null);
                    return;
                  }
                  patchTask(selected, {description: value.trim() || null}, 'Task updated.');
                  setDrawer(null);
                }}
                rows={5}
                placeholder="Add a description…"
                className="mt-2 w-full rounded-xl border border-[#E5E1D8] bg-white p-3 text-sm leading-6 disabled:opacity-70"
              />
            </label>
            {drawerErrs.description && (
              <span className="mt-1 block text-xs text-[#9A3A3A]" role="alert">{drawerErrs.description}</span>
            )}
            {/* "Linked to" (readiness criterion) arrives with Step 5f; the
                readiness_id column exists but is not API-exposed yet (D1). */}
            <div className="mt-4 rounded-xl border border-[#E5E1D8] bg-white p-4">
              <h3 className="text-sm font-semibold">Linked to</h3>
              <p className="mt-2 text-xs text-[#4A5568]" role="status">
                {milestoneName(selected)
                  ? `Milestone: ${milestoneName(selected)}`
                  : 'No milestone. Stage-criterion links arrive with readiness (Step 5f).'}
              </p>
            </div>
            {/* Step 5d: labels. Members attach; owner/admin also shape the
                catalogue inline, so no settings page is needed. */}
            <div className="mt-4 rounded-xl border border-[#E5E1D8] bg-white p-4">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                  <Tag size={14} /> Labels
                </h3>
                {canManageLabels && (
                  <button
                    type="button"
                    onClick={() => {
                      setLabelManage(m => !m);
                      setLabelErrs({});
                      setLabelFormErr('');
                    }}
                    className="text-xs font-semibold text-[#9A7A45]"
                  >
                    {labelManage ? 'Done' : 'Manage'}
                  </button>
                )}
              </div>

              {labelStatus === 'loading' && (
                <p className="mt-2 text-xs text-[#4A5568]" role="status">Loading labels…</p>
              )}
              {labelStatus === 'error' && (
                <p className="mt-2 text-xs text-[#9A3A3A]" role="alert">
                  {labelError}{' '}
                  <button type="button" onClick={() => org && loadLabels(org.id)} className="underline">
                    Retry
                  </button>
                </p>
              )}
              {labelStatus === 'ready' && labels.length === 0 && (
                <p className="mt-2 text-xs text-[#4A5568]" role="status">
                  No labels yet.{canManageLabels ? ' Add one with Manage.' : ' An owner or admin can add some.'}
                </p>
              )}
              {labelStatus === 'ready' && labels.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {labels.map(l => {
                    const on = (selected.labels || []).some(x => x.id === l.id);
                    return (
                      <button
                        key={l.id}
                        type="button"
                        disabled={!canEdit || labelBusy === selected.id}
                        aria-pressed={on}
                        onClick={() => toggleTaskLabel(selected, l.id)}
                        style={on ? labelStyle(l) : undefined}
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-medium disabled:opacity-50 ${
                          on ? 'border-transparent' : 'border-[#E5E1D8] bg-white text-[#4A5568] hover:border-[#A0A7B4]'
                        }`}
                      >
                        {on && <Check size={11} className="mr-1 inline" />}
                        {l.name}
                      </button>
                    );
                  })}
                </div>
              )}
              {labelErrs.label_ids && (
                <span className="mt-2 block text-xs text-[#9A3A3A]" role="alert">{labelErrs.label_ids}</span>
              )}
              {!canEdit && (
                <p className="mt-2 text-[11px] text-[#4A5568]">Viewers cannot change labels.</p>
              )}

              {labelManage && canManageLabels && (
                <form onSubmit={saveLabel} className="mt-3 border-t border-[#E5E1D8] pt-3">
                  <div className="flex items-end gap-2">
                    <label className="flex-1 text-xs text-[#4A5568]">
                      {editingLabel ? 'Rename label' : 'New label'}
                      <input
                        value={labelForm.name}
                        maxLength={40}
                        onChange={e => setLabelForm(f => ({...f, name: e.target.value}))}
                        placeholder="e.g. Customer research"
                        className="mt-1 h-9 w-full rounded-lg border border-[#E5E1D8] px-2 text-xs"
                      />
                    </label>
                    <label className="text-xs text-[#4A5568]">
                      Colour
                      <input
                        type="color"
                        value={labelForm.color || '#4A5568'}
                        onChange={e => setLabelForm(f => ({...f, color: e.target.value}))}
                        className="mt-1 block h-9 w-11 cursor-pointer rounded-lg border border-[#E5E1D8] bg-white"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={labelSaving}
                      className="h-9 rounded-lg bg-ink px-3 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {labelSaving ? 'Saving…' : editingLabel ? 'Save' : 'Add'}
                    </button>
                    {editingLabel && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingLabel(null);
                          setLabelForm({name: '', color: '#4A5568'});
                          setLabelErrs({});
                        }}
                        className="h-9 text-xs font-semibold text-[#4A5568]"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                  {labelErrs.name && (
                    <span className="mt-1 block text-xs text-[#9A3A3A]" role="alert">{labelErrs.name}</span>
                  )}
                  {labelErrs.color && (
                    <span className="mt-1 block text-xs text-[#9A3A3A]" role="alert">{labelErrs.color}</span>
                  )}
                  {labelFormErr && (
                    <span className="mt-1 block text-xs text-[#9A3A3A]" role="alert">{labelFormErr}</span>
                  )}
                  {labels.length > 0 && (
                    <ul className="mt-3 space-y-1">
                      {labels.map(l => (
                        <li key={l.id} className="flex items-center justify-between gap-2 text-xs">
                          <span className="flex items-center gap-2">
                            <span
                              className="inline-block h-3 w-3 rounded-full border"
                              style={{backgroundColor: l.color || '#E5E1D8'}}
                            />
                            {l.name}
                          </span>
                          <span className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingLabel(l);
                                setLabelForm({name: l.name, color: l.color || '#4A5568'});
                                setLabelErrs({});
                              }}
                              className="text-[#4A5568] underline"
                            >
                              Rename
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteLabel(l)}
                              className="text-[#B42318] underline"
                            >
                              Delete
                            </button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </form>
              )}
            </div>

            {/* Step 5d: comments. Flat thread (Step 11 adds threading). */}
            <div className="mt-4 rounded-xl border border-[#E5E1D8] bg-white p-4">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                <MessageSquare size={14} /> Comments
                {commentStatus === 'ready' && comments.length > 0 && (
                  <span className="text-xs font-normal text-[#4A5568]">({comments.length})</span>
                )}
              </h3>

              {commentStatus === 'loading' && (
                <p className="mt-2 text-xs text-[#4A5568]" role="status">Loading comments…</p>
              )}
              {commentStatus === 'error' && (
                <p className="mt-2 text-xs text-[#9A3A3A]" role="alert">
                  {commentError}{' '}
                  <button type="button" onClick={() => loadComments(selected.id)} className="underline">
                    Retry
                  </button>
                </p>
              )}
              {commentStatus === 'ready' && comments.length === 0 && (
                <p className="mt-2 text-xs text-[#4A5568]" role="status">
                  No comments yet. {canEdit ? 'Start the discussion below.' : ''}
                </p>
              )}
              {commentStatus === 'ready' && comments.length > 0 && (
                <ul className="mt-3 space-y-3">
                  {comments.map(c => (
                    <li key={c.id} className="border-t border-[#E5E1D8] pt-2 first:border-0 first:pt-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-xs font-semibold">
                          {c.author_id === myId ? myName || 'You' : c.author_name || 'Member'}
                        </span>
                        <span className="text-[10px] text-[#4A5568]">{fmtCommentTime(c.created_at)}</span>
                      </div>
                      {editingComment?.id === c.id ? (
                        <div className="mt-1">
                          <textarea
                            value={editingComment.body}
                            rows={3}
                            onChange={e => setEditingComment({id: c.id, body: e.target.value})}
                            className="w-full rounded-lg border border-[#E5E1D8] p-2 text-xs"
                          />
                          <div className="mt-1 flex gap-2">
                            <button
                              type="button"
                              disabled={commentBusy}
                              onClick={() => saveComment(c, editingComment.body)}
                              className="rounded-lg bg-ink px-3 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => { setEditingComment(null); setCommentErrs({}); }}
                              className="text-[11px] font-semibold text-[#4A5568]"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-[#2D3748]">{c.body}</p>
                      )}
                      {(c.can_edit || c.can_delete) && editingComment?.id !== c.id && (
                        <div className="mt-1 flex gap-3 text-[10px] text-[#4A5568]">
                          {c.can_edit && (
                            <button
                              type="button"
                              onClick={() => { setEditingComment({id: c.id, body: c.body}); setCommentErrs({}); }}
                              className="inline-flex items-center gap-0.5 underline"
                            >
                              <Pencil size={10} /> Edit
                            </button>
                          )}
                          {c.can_delete && (
                            <button
                              type="button"
                              onClick={() => deleteComment(c)}
                              className="inline-flex items-center gap-0.5 text-[#B42318] underline"
                            >
                              <Trash2 size={10} /> Delete
                            </button>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {commentErrs.list && (
                <span className="mt-2 block text-xs text-[#9A3A3A]" role="alert">{commentErrs.list}</span>
              )}

              {canEdit ? (
                <form onSubmit={addComment} className="mt-3 border-t border-[#E5E1D8] pt-3">
                  <label className="block text-xs text-[#4A5568]">
                    Add a comment
                    <textarea
                      value={commentBody}
                      rows={3}
                      maxLength={5000}
                      onChange={e => { setCommentBody(e.target.value); setCommentErrs({}); }}
                      placeholder="Share an update or ask a question…"
                      className="mt-1 w-full rounded-lg border border-[#E5E1D8] p-2 text-xs"
                    />
                  </label>
                  {commentErrs.body && (
                    <span className="mt-1 block text-xs text-[#9A3A3A]" role="alert">{commentErrs.body}</span>
                  )}
                  {commentErrs.edit && (
                    <span className="mt-1 block text-xs text-[#9A3A3A]" role="alert">{commentErrs.edit}</span>
                  )}
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-[10px] text-[#4A5568]">{commentBody.length}/5000</span>
                    <button
                      type="submit"
                      disabled={commentBusy}
                      className="inline-flex items-center gap-1 rounded-lg bg-ink px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
                    >
                      <Send size={11} /> {commentBusy ? 'Posting…' : 'Post'}
                    </button>
                  </div>
                </form>
              ) : (
                <p className="mt-3 border-t border-[#E5E1D8] pt-3 text-[11px] text-[#4A5568]">
                  Viewers can read comments but not post them.
                </p>
              )}
            </div>

            <div className="mt-4 flex justify-between">
              <button
                type="button"
                disabled={!canEdit || deleting}
                onClick={() => removeTask(selected)}
                className="text-xs font-semibold text-[#B42318] disabled:opacity-50"
              >
                <Trash2 className="mr-1 inline" size={14} /> Delete task
              </button>
              <button
                type="button"
                disabled={!canEdit || selected.status === 'done'}
                onClick={() => {
                  moveTask(selected, {status: 'done'}, 'Task completed.');
                  closeTask();
                }}
                className="rounded-lg bg-ink px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                Mark complete
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Mobile Sticky Add Button */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[#E5E1D8] bg-white p-3 lg:hidden">
        <Btn onClick={() => setCreating(true)}>
          <Plus size={16} /> New task
        </Btn>
      </div>

      {toast && (
        <div role="status" aria-live="polite" className="fixed bottom-20 left-1/2 z-[60] -translate-x-1/2 rounded-lg bg-ink px-4 py-3 text-sm text-white shadow-lg lg:bottom-6">
          {toast}
        </div>
      )}
    </div>
  );
}
