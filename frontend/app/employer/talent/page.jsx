'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  EmployerBtn,
  EmployerCard,
} from '@/components';
import { JobsPage, useJobsWorkspace } from '@/components/employer-jobs-workspace';
import { LoadingBlock, EmptyBlock, ErrorBlock, FieldError, fieldErrorsFrom } from '@/components/async-state';
import { useCareerResource, useCareerSearch } from '@/components/career-data';
import { api, ApiError } from '@/lib/api/client';
import { formatDate } from '@/lib/mentorship-labels';
import {
  Bookmark,
  CheckCircle2,
  Mail,
  Search,
  Send,
  UserPlus,
  Users,
  X,
  EyeOff,
} from 'lucide-react';

// GET /talent/search experience tiers (server: mid [2,5), senior [5,8), lead 8+).
const EXPERIENCE = { All: undefined, Mid: 'mid', Senior: 'senior', Lead: 'lead' };
const AVAILABILITY = {
  immediate: 'Available immediately',
  two_weeks: '2 weeks notice',
  one_month: '1 month notice',
  flexible: 'Flexible start',
  not_looking: 'Not actively looking',
};
const MODE = { onsite: 'On-site', hybrid: 'Hybrid', remote: 'Remote' };
const MAX_SKILL_CHIPS = 12;

function talentError(error) {
  if (error instanceof ApiError) {
    if (error.status === 404) return 'This candidate or shortlist is no longer available.';
    if (error.status === 429) return error.message || 'Daily outreach limit reached. It resets at midnight UTC.';
    return error.message;
  }
  return 'Could not connect. Please try again.';
}

const experienceLabel = (yrs) =>
  yrs == null ? 'Experience not shared' : `${Number(yrs) % 1 ? Number(yrs).toFixed(1) : Number(yrs)} yrs experience`;

function TalentSourcing() {
  const { org } = useJobsWorkspace();
  const isViewer = org.my_role === 'viewer';

  const [activeTab, setActiveTab] = useState('Search');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExperience, setSelectedExperience] = useState('All');
  const [selectedSkill, setSelectedSkill] = useState('All');
  const [toastMessage, setToastMessage] = useState(null);
  // "Hide profile" is a per-session view filter only — nothing is stored.
  const [hiddenIds, setHiddenIds] = useState(new Set());
  const [knownSkills, setKnownSkills] = useState([]);

  // Invite modal: a single candidate, or { bulk: shortlist } for "Invite all".
  const [inviteModalCandidate, setInviteModalCandidate] = useState(null);
  const [selectedJobForInvite, setSelectedJobForInvite] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [inviteErrors, setInviteErrors] = useState({});
  const [inviteError, setInviteError] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);

  // Create shortlist modal state
  const [showNewShortlistModal, setShowNewShortlistModal] = useState(false);
  const [newShortlistTitle, setNewShortlistTitle] = useState('');
  const [shortlistErrors, setShortlistErrors] = useState({});
  const [shortlistBusy, setShortlistBusy] = useState(false);

  // Save-to-shortlist picker
  const [saveCandidate, setSaveCandidate] = useState(null);
  const [saveTarget, setSaveTarget] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saveBusy, setSaveBusy] = useState(false);

  const query = useCareerSearch(searchQuery.trim());
  const searchRes = useCareerResource(
    `talent-search:${org.id}:${query}:${selectedExperience}:${selectedSkill}`,
    (signal) =>
      isViewer
        ? Promise.resolve(null)
        : api.talent.search(
          org.id,
          {
            q: query || undefined,
            experience: EXPERIENCE[selectedExperience],
            skill: selectedSkill === 'All' ? undefined : selectedSkill,
            limit: 50,
          },
          signal
        )
  );
  const shortlistsRes = useCareerResource(`talent-shortlists:${org.id}`, (signal) =>
    isViewer ? Promise.resolve(null) : api.talent.shortlists(org.id, { limit: 100 }, signal)
  );
  const outreachRes = useCareerResource(`talent-outreach:${org.id}`, (signal) =>
    isViewer ? Promise.resolve(null) : api.talent.outreach(org.id, { limit: 20 }, signal)
  );
  const jobsRes = useCareerResource(`talent-open-jobs:${org.id}`, (signal) =>
    isViewer ? Promise.resolve(null) : api.jobs.list(org.id, { status: 'open', limit: 100 }, signal)
  );
  const openJobs = jobsRes.data?.items || [];
  const shortlists = shortlistsRes.data?.items || [];

  // Skill chips come from real results (accumulated so a selected chip
  // does not make the others disappear).
  useEffect(() => {
    const items = searchRes.data?.items;
    if (!items?.length) return;
    setKnownSkills((prev) => {
      const seen = new Map(prev.map((s) => [s.toLowerCase(), s]));
      for (const c of items) for (const s of c.skills || []) if (!seen.has(s.toLowerCase())) seen.set(s.toLowerCase(), s);
      const next = [...seen.values()].sort((a, b) => a.localeCompare(b));
      return next.length === prev.length ? prev : next;
    });
  }, [searchRes.data]);
  const allSkills = useMemo(() => {
    const chips = knownSkills.slice(0, MAX_SKILL_CHIPS);
    if (selectedSkill !== 'All' && !chips.includes(selectedSkill)) chips.push(selectedSkill);
    return ['All', ...chips];
  }, [knownSkills, selectedSkill]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleHideCandidate = (id) => {
    setHiddenIds((prev) => new Set([...prev, id]));
    showToast('Candidate hidden from results');
  };

  const openInvite = (target) => {
    setInviteModalCandidate(target);
    setSelectedJobForInvite((current) => (openJobs.some((j) => j.id === current) ? current : openJobs[0]?.id || ''));
    setInviteErrors({});
    setInviteError('');
  };

  const closeInvite = () => {
    setInviteModalCandidate(null);
    setInviteMessage('');
    setInviteErrors({});
    setInviteError('');
  };

  const handleSendInvite = async (e) => {
    e.preventDefault();
    if (!inviteModalCandidate || !selectedJobForInvite) return;
    setInviteBusy(true);
    setInviteErrors({});
    setInviteError('');
    const note = inviteMessage.trim() || null;
    try {
      if (inviteModalCandidate.bulk) {
        const sl = inviteModalCandidate.bulk;
        const result = await api.talent.bulkOutreach(org.id, { shortlist_id: sl.id, job_id: selectedJobForInvite, note });
        showToast(
          `Invited ${result.invited} candidate${result.invited === 1 ? '' : 's'} from ${sl.name}` +
          (result.skipped ? ` · ${result.skipped} skipped (already invited, applied, private or over today's limit)` : '')
        );
      } else {
        const sent = await api.talent.sendOutreach(org.id, {
          candidate_user_id: inviteModalCandidate.user_id,
          job_id: selectedJobForInvite,
          note,
        });
        showToast(`Application invitation sent to ${sent.candidate_name} for ${sent.job_title}`);
      }
      closeInvite();
      outreachRes.reload();
    } catch (error) {
      const fields = fieldErrorsFrom(error);
      setInviteErrors(fields);
      if (!Object.keys(fields).length) setInviteError(talentError(error));
    } finally {
      setInviteBusy(false);
    }
  };

  const handleCreateShortlist = async (e) => {
    e.preventDefault();
    if (!newShortlistTitle.trim()) return;
    setShortlistBusy(true);
    setShortlistErrors({});
    try {
      const created = await api.talent.createShortlist(org.id, { name: newShortlistTitle.trim() });
      setNewShortlistTitle('');
      setShowNewShortlistModal(false);
      showToast(`Created shortlist "${created.name}"`);
      shortlistsRes.reload();
    } catch (error) {
      const fields = fieldErrorsFrom(error);
      setShortlistErrors(Object.keys(fields).length ? fields : { name: talentError(error) });
    } finally {
      setShortlistBusy(false);
    }
  };

  const openSave = (cand) => {
    setSaveCandidate(cand);
    setSaveTarget(shortlists[0]?.id || '');
    setSaveError('');
  };

  const handleSaveToShortlist = async (e) => {
    e.preventDefault();
    if (!saveCandidate || !saveTarget) return;
    setSaveBusy(true);
    setSaveError('');
    try {
      await api.talent.addMember(saveTarget, saveCandidate.user_id);
      const name = shortlists.find((s) => s.id === saveTarget)?.name || 'shortlist';
      showToast(`Saved ${saveCandidate.display_name} to ${name}`);
      setSaveCandidate(null);
      shortlistsRes.reload();
    } catch (error) {
      setSaveError(
        error instanceof ApiError && error.code === 'ALREADY_IN_SHORTLIST'
          ? `${saveCandidate.display_name} is already in this shortlist.`
          : talentError(error)
      );
    } finally {
      setSaveBusy(false);
    }
  };

  const candidates = searchRes.data?.items || [];
  const filteredCandidates = candidates.filter((c) => !hiddenIds.has(c.user_id));
  const outreach = outreachRes.data;
  const remaining = outreach ? Math.max(0, outreach.daily_limit - outreach.daily_used) : null;
  const inviteTitle = inviteModalCandidate?.bulk ? 'Invite Shortlist to Apply' : 'Invite Candidate to Apply';
  const inviteSubtitle = inviteModalCandidate?.bulk
    ? `Bulk outreach to ${inviteModalCandidate.bulk.member_count} candidate${inviteModalCandidate.bulk.member_count === 1 ? '' : 's'} in ${inviteModalCandidate.bulk.name}`
    : `Direct outreach to ${inviteModalCandidate?.display_name || ''}`;

  if (isViewer) {
    return (
      <div className="mx-auto max-w-[1280px]">
        <div className="rounded-xl border border-[#E5E1D8] bg-white p-8 text-center text-sm text-[#4A5568]">
          Viewers cannot access talent sourcing.
        </div>
      </div>
    );
  }

  return (
    <>
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 rounded-xl bg-[#0F1B2D] px-4 py-3 text-sm text-white shadow-xl flex items-center gap-2 border border-[#B8955A]/30"
        >
          <CheckCircle2 size={16} className="text-[#D4AF37]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Invite Candidate Modal */}
      {inviteModalCandidate && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="invite-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-lg rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E1D8]">
              <div>
                <h3 id="invite-modal-title" className="text-base font-semibold text-[#0F1B2D]">
                  {inviteTitle}
                </h3>
                <p className="text-xs text-[#4A5568]">
                  {inviteSubtitle}
                </p>
              </div>
              <button
                type="button"
                onClick={closeInvite}
                className="text-[#4A5568] hover:text-[#0F1B2D]"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSendInvite} className="mt-4 space-y-4">
              {inviteError && (
                <div role="alert" className="rounded-lg border border-[#F1C6C1] bg-[#FEF3F2] p-2.5 text-xs text-[#B42318]">
                  {inviteError}
                </div>
              )}
              <div>
                <label htmlFor="invite-job" className="block text-xs font-medium text-[#0F1B2D] mb-1">
                  Select Open Position
                </label>
                {jobsRes.loading ? (
                  <p className="text-xs text-[#4A5568]" role="status">Loading open jobs…</p>
                ) : jobsRes.error ? (
                  <ErrorBlock title="Could not load open jobs" message={talentError(jobsRes.error)} onRetry={jobsRes.reload} />
                ) : !openJobs.length ? (
                  <p className="rounded-lg border border-dashed border-[#E5E1D8] p-3 text-xs text-[#4A5568]">
                    No open jobs yet. Publish a job before inviting candidates to apply.
                  </p>
                ) : (
                  <select
                    id="invite-job"
                    value={selectedJobForInvite}
                    onChange={(e) => setSelectedJobForInvite(e.target.value)}
                    aria-invalid={Boolean(inviteErrors.job_id)}
                    className="w-full rounded-lg border border-[#E5E1D8] bg-white px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                  >
                    {openJobs.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.title} · {j.location || MODE[j.work_mode] || 'Location not set'}
                      </option>
                    ))}
                  </select>
                )}
                <FieldError>{inviteErrors.job_id}</FieldError>
              </div>
              <div>
                <label htmlFor="invite-msg" className="block text-xs font-medium text-[#0F1B2D] mb-1">
                  Personal Invitation Note
                </label>
                <textarea
                  id="invite-msg"
                  rows={4}
                  maxLength={2000}
                  value={inviteMessage}
                  onChange={(e) => setInviteMessage(e.target.value)}
                  placeholder={`Hi! We noticed your excellent track record and think you'd be a fantastic fit for ${org.name}...`}
                  aria-invalid={Boolean(inviteErrors.note)}
                  className="w-full rounded-lg border border-[#E5E1D8] p-2.5 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                />
                <FieldError>{inviteErrors.note}</FieldError>
                {remaining !== null && (
                  <p className="mt-1 text-[11px] text-[#4A5568]">
                    {remaining} of {outreach.daily_limit} invitations left today (resets at midnight UTC).
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <EmployerBtn variant="secondary" size="sm" onClick={closeInvite}>
                  Cancel
                </EmployerBtn>
                <EmployerBtn type="submit" variant="primary" size="sm" disabled={inviteBusy || !selectedJobForInvite}>
                  <Send size={14} className="mr-1.5" /> {inviteBusy ? 'Sending…' : 'Send Invitation'}
                </EmployerBtn>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Shortlist Modal */}
      {showNewShortlistModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="shortlist-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E1D8]">
              <h3 id="shortlist-modal-title" className="text-base font-semibold text-[#0F1B2D]">
                Create New Shortlist
              </h3>
              <button
                type="button"
                onClick={() => setShowNewShortlistModal(false)}
                className="text-[#4A5568] hover:text-[#0F1B2D]"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateShortlist} className="mt-4 space-y-4">
              <div>
                <label htmlFor="shortlist-title" className="block text-xs font-medium text-[#0F1B2D] mb-1">
                  Shortlist Name
                </label>
                <input
                  id="shortlist-title"
                  type="text"
                  required
                  maxLength={120}
                  value={newShortlistTitle}
                  onChange={(e) => setNewShortlistTitle(e.target.value)}
                  placeholder="e.g. Q4 Senior Design Leads"
                  aria-invalid={Boolean(shortlistErrors.name)}
                  className="w-full rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                />
                <FieldError>{shortlistErrors.name}</FieldError>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <EmployerBtn variant="secondary" size="sm" onClick={() => setShowNewShortlistModal(false)}>
                  Cancel
                </EmployerBtn>
                <EmployerBtn type="submit" variant="primary" size="sm" disabled={shortlistBusy}>
                  Create Shortlist
                </EmployerBtn>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Save to Shortlist Modal (same frame as the New Shortlist modal) */}
      {saveCandidate && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="save-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E1D8]">
              <h3 id="save-modal-title" className="text-base font-semibold text-[#0F1B2D]">
                Save {saveCandidate.display_name} to a Shortlist
              </h3>
              <button
                type="button"
                onClick={() => setSaveCandidate(null)}
                className="text-[#4A5568] hover:text-[#0F1B2D]"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveToShortlist} className="mt-4 space-y-4">
              {shortlistsRes.loading ? (
                <p className="text-xs text-[#4A5568]" role="status">Loading shortlists…</p>
              ) : shortlistsRes.error ? (
                <ErrorBlock title="Could not load shortlists" message={talentError(shortlistsRes.error)} onRetry={shortlistsRes.reload} />
              ) : !shortlists.length ? (
                <p className="rounded-lg border border-dashed border-[#E5E1D8] p-3 text-xs text-[#4A5568]">
                  You have no shortlists yet. Create one first, then save candidates to it.
                </p>
              ) : (
                <div>
                  <label htmlFor="save-shortlist" className="block text-xs font-medium text-[#0F1B2D] mb-1">
                    Shortlist
                  </label>
                  <select
                    id="save-shortlist"
                    value={saveTarget}
                    onChange={(e) => setSaveTarget(e.target.value)}
                    className="w-full rounded-lg border border-[#E5E1D8] bg-white px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                  >
                    {shortlists.map((sl) => (
                      <option key={sl.id} value={sl.id}>
                        {sl.name} ({sl.member_count})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <FieldError>{saveError}</FieldError>
              <div className="flex justify-end gap-2 pt-2">
                {!shortlists.length && !shortlistsRes.loading ? (
                  <EmployerBtn
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSaveCandidate(null);
                      setShowNewShortlistModal(true);
                    }}
                  >
                    <UserPlus size={14} className="mr-1.5" /> New Shortlist
                  </EmployerBtn>
                ) : (
                  <EmployerBtn variant="secondary" size="sm" onClick={() => setSaveCandidate(null)}>
                    Cancel
                  </EmployerBtn>
                )}
                <EmployerBtn type="submit" variant="primary" size="sm" disabled={saveBusy || !saveTarget}>
                  <Bookmark size={14} className="mr-1.5" /> Save
                </EmployerBtn>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-[1280px] space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#0F1B2D]">
              Talent Sourcing & Direct Outreach
            </h1>
            <p className="text-xs sm:text-sm text-[#4A5568]">
              Discover opted-in, pre-vetted professionals open to exciting early-stage startup opportunities.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <EmployerBtn
              variant="secondary"
              size="sm"
              onClick={() => {
                setShortlistErrors({});
                setShowNewShortlistModal(true);
              }}
            >
              <UserPlus size={14} className="mr-1.5" /> New Shortlist
            </EmployerBtn>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex gap-2 border-b border-[#E5E1D8] pb-2">
          {['Search', 'Shortlists', 'Invitations'].map((tab) => {
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`rounded-lg px-4 py-2 text-xs sm:text-sm font-medium transition ${
                  active
                    ? 'bg-[#0F1B2D] text-white shadow-sm'
                    : 'text-[#4A5568] hover:bg-[#FAF8F4] hover:text-[#0F1B2D]'
                }`}
              >
                {tab === 'Search' && 'Search Candidates'}
                {tab === 'Shortlists' && `Saved Shortlists${shortlistsRes.data ? ` (${shortlistsRes.data.total})` : ''}`}
                {tab === 'Invitations' && 'Outreach & Invitations'}
              </button>
            );
          })}
        </div>

        {/* Main Content Area */}
        {activeTab === 'Search' && (
          <div className="grid gap-6 lg:grid-cols-12 min-w-0">
            {/* Filter Sidebar */}
            <div className="lg:col-span-4 space-y-6 min-w-0">
              <EmployerCard title="Search Filters">
                <div className="space-y-4">
                  <div>
                    <label htmlFor="talent-search" className="block text-xs font-medium text-[#0F1B2D] mb-1">
                      Role, Title or Keyword
                    </label>
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-2.5 text-[#4A5568]" />
                      <input
                        id="talent-search"
                        type="text"
                        maxLength={200}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="e.g. Designer, Kolkata, Engineer..."
                        className="w-full rounded-lg border border-[#E5E1D8] pl-8 pr-3 py-1.5 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="experience-filter" className="block text-xs font-medium text-[#0F1B2D] mb-1">
                      Experience Level
                    </label>
                    <select
                      id="experience-filter"
                      value={selectedExperience}
                      onChange={(e) => setSelectedExperience(e.target.value)}
                      className="w-full rounded-lg border border-[#E5E1D8] bg-white px-3 py-1.5 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                    >
                      <option value="All">All Experience Tiers</option>
                      <option value="Mid">Mid-Level (2–4 yrs)</option>
                      <option value="Senior">Senior (5–7 yrs)</option>
                      <option value="Lead">Lead / Architect (8+ yrs)</option>
                    </select>
                  </div>

                  <div>
                    <span className="block text-xs font-medium text-[#0F1B2D] mb-1.5">
                      Core Skill Competency
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {allSkills.map((sk) => (
                        <button
                          key={sk}
                          type="button"
                          aria-pressed={selectedSkill === sk}
                          onClick={() => setSelectedSkill(sk)}
                          className={`rounded-full px-2.5 py-1 text-xs transition ${
                            selectedSkill === sk
                              ? 'bg-[#B8955A] text-white font-medium'
                              : 'border border-[#E5E1D8] bg-white text-[#4A5568] hover:bg-[#FAF8F4]'
                          }`}
                        >
                          {sk}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#F3EBDD] bg-[#FAF8F4] p-3 text-xs text-[#806236] leading-relaxed">
                    <p className="font-semibold mb-1">Ethical Sourcing Guarantee</p>
                    <p>
                      Candidate profiles exclude age, gender, religion, marital status, or photos. Only job seekers who opted in to search appear here.
                    </p>
                  </div>
                </div>
              </EmployerCard>
            </div>

            {/* Candidates Results List */}
            <div className="lg:col-span-8 space-y-4 min-w-0">
              <div className="flex items-center justify-between text-xs text-[#4A5568]">
                <span>
                  {searchRes.data
                    ? `Showing ${filteredCandidates.length} of ${searchRes.data.total} opted-in candidates`
                    : 'Searching opted-in candidates…'}
                </span>
                {hiddenIds.size > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setHiddenIds(new Set());
                      showToast('Hidden candidate filters cleared');
                    }}
                    className="text-[#806236] hover:underline"
                  >
                    Reset {hiddenIds.size} hidden profiles
                  </button>
                )}
              </div>

              {searchRes.loading ? (
                <LoadingBlock label="Searching candidates…" rows={3} />
              ) : searchRes.error ? (
                <ErrorBlock title="Could not search candidates" message={talentError(searchRes.error)} onRetry={searchRes.reload} />
              ) : filteredCandidates.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#E5E1D8] bg-white p-12 text-center">
                  <Users size={32} className="mx-auto text-[#4A5568]/50 mb-3" />
                  <h3 className="font-serif text-lg font-bold text-[#0F1B2D]">No matching candidates</h3>
                  <p className="text-xs text-[#4A5568] mt-1 max-w-sm mx-auto">
                    {query || selectedExperience !== 'All' || selectedSkill !== 'All' || hiddenIds.size
                      ? 'Try loosening your search filters or clear selected competencies to see broader candidate profiles.'
                      : 'No job seekers have opted in to talent search yet.'}
                  </p>
                  <EmployerBtn
                    variant="secondary"
                    size="sm"
                    className="mt-4"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedExperience('All');
                      setSelectedSkill('All');
                    }}
                  >
                    Clear Filters
                  </EmployerBtn>
                </div>
              ) : (
                filteredCandidates.map((cand) => (
                  <div
                    key={cand.user_id}
                    className="rounded-2xl border border-[#E5E1D8] bg-white p-5 shadow-sm transition hover:border-[#B8955A] hover:shadow-md space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="flex items-start gap-3.5">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0F1B2D] text-sm font-bold text-white">
                          {cand.avatar_initials || cand.display_name.charAt(0)}
                        </div>
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-serif text-base font-bold text-[#0F1B2D]">
                              {cand.display_name}
                            </h3>
                          </div>
                          <p className="text-xs text-[#4A5568] leading-relaxed">
                            {cand.headline || 'No headline yet'}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-[#4A5568]">
                            <span>{experienceLabel(cand.total_experience_yrs)}</span>
                            <span>·</span>
                            <span>{cand.current_location || 'Location not shared'}</span>
                            {cand.preferred_mode && (MODE[cand.preferred_mode] || '').toLowerCase() !== (cand.current_location || '').toLowerCase() && (
                              <>
                                <span>·</span>
                                <span>{MODE[cand.preferred_mode] || cand.preferred_mode}</span>
                              </>
                            )}
                            <span>·</span>
                            <span className="text-emerald-700 font-medium">{AVAILABILITY[cand.availability] || cand.availability}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Skill Badges */}
                    <div className="flex flex-wrap gap-1.5 border-t border-[#E5E1D8] pt-3">
                      {cand.skills?.length ? cand.skills.map((sk) => (
                        <span
                          key={sk}
                          className="rounded-md border border-[#E5E1D8] bg-[#FAF8F4] px-2.5 py-0.5 text-xs text-[#0F1B2D]"
                        >
                          {sk}
                        </span>
                      )) : <span className="text-xs text-[#4A5568]">No skills listed</span>}
                    </div>

                    {/* Card Action Buttons - flex-wrap prevents 440px blowout */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E5E1D8] pt-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <EmployerBtn
                          variant="primary"
                          size="sm"
                          onClick={() => openInvite(cand)}
                        >
                          <Mail size={14} className="mr-1.5" /> Invite to apply
                        </EmployerBtn>
                        <EmployerBtn
                          variant="secondary"
                          size="sm"
                          onClick={() => openSave(cand)}
                        >
                          <Bookmark size={14} className="mr-1.5" /> Save to shortlist
                        </EmployerBtn>
                      </div>
                      <EmployerBtn
                        variant="ghost"
                        size="sm"
                        onClick={() => handleHideCandidate(cand.user_id)}
                        className="text-[#4A5568] hover:text-[#B42318]"
                      >
                        <EyeOff size={14} className="mr-1" /> Hide profile
                      </EmployerBtn>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'Shortlists' && (
          <div className="space-y-4">
            {shortlistsRes.loading ? (
              <LoadingBlock label="Loading shortlists…" rows={2} />
            ) : shortlistsRes.error ? (
              <ErrorBlock title="Could not load shortlists" message={talentError(shortlistsRes.error)} onRetry={shortlistsRes.reload} />
            ) : !shortlists.length ? (
              <EmptyBlock title="No shortlists yet" hint="Create a shortlist, then save candidates to it from search.">
                <EmployerBtn secondary small onClick={() => setShowNewShortlistModal(true)}>
                  <UserPlus size={14} /> New Shortlist
                </EmployerBtn>
              </EmptyBlock>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {shortlists.map((sl) => (
                  <div
                    key={sl.id}
                    className="rounded-2xl border border-[#E5E1D8] bg-white p-5 shadow-sm space-y-4"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-serif text-base font-bold text-[#0F1B2D]">
                          {sl.name}
                        </h3>
                        <p className="text-xs text-[#4A5568] mt-0.5">
                          {sl.member_count} candidate{sl.member_count === 1 ? '' : 's'} saved · Updated {formatDate(sl.updated_at)}
                        </p>
                      </div>
                    </div>

                    <div className="border-t border-[#E5E1D8] pt-3 flex gap-2">
                      <EmployerBtn
                        variant="primary"
                        size="sm"
                        className="w-full"
                        disabled={!sl.member_count}
                        onClick={() => openInvite({ bulk: sl })}
                      >
                        <Mail size={14} className="mr-1.5" /> Invite all to apply
                      </EmployerBtn>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Invitations Tab */}
        {activeTab === 'Invitations' && (
          <div className="space-y-6">
            {outreachRes.loading ? (
              <LoadingBlock label="Loading outreach…" rows={2} />
            ) : outreachRes.error ? (
              <ErrorBlock title="Could not load outreach" message={talentError(outreachRes.error)} onRetry={outreachRes.reload} />
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl border border-[#E5E1D8] bg-white p-5 shadow-sm">
                    <span className="text-xs font-semibold text-[#4A5568]">Invitations Sent</span>
                    <p className="font-serif text-2xl font-bold text-[#0F1B2D] mt-1">{outreach.total}</p>
                    <p className="text-xs text-[#4A5568] mt-1">All time, whole team</p>
                  </div>
                  <div className="rounded-2xl border border-[#E5E1D8] bg-white p-5 shadow-sm">
                    <span className="text-xs font-semibold text-[#4A5568]">Applications Triggered</span>
                    <p className="font-serif text-2xl font-bold text-emerald-700 mt-1">{outreach.applied_total}</p>
                    <p className="text-xs text-[#4A5568] mt-1">
                      {outreach.total
                        ? `${Math.round((outreach.applied_total / outreach.total) * 100)}% of invited candidates applied`
                        : 'Invited candidates who applied'}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[#E5E1D8] bg-white p-5 shadow-sm">
                    <span className="text-xs font-semibold text-[#4A5568]">Daily Outreach Remaining</span>
                    <p className="font-serif text-2xl font-bold text-[#806236] mt-1">{remaining}</p>
                    <p className="text-xs text-[#4A5568] mt-1">Of {outreach.daily_limit} per day · resets at midnight UTC</p>
                  </div>
                </div>

                <EmployerCard title="Recent Sourcing Outreach">
                  {!outreach.items.length ? (
                    <p className="py-6 text-center text-xs text-[#4A5568]">
                      No invitations sent yet. Invite a candidate from search to start your outreach history.
                    </p>
                  ) : (
                    <div className="divide-y divide-[#E5E1D8]">
                      {outreach.items.map((item) => (
                        <div key={item.id} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between text-xs">
                          <div>
                            <p className="font-semibold text-[#0F1B2D]">{item.candidate_name}</p>
                            <p className="text-[#4A5568]">
                              {item.candidate_headline ? `${item.candidate_headline} · ` : ''}Invited for {item.job_title}
                              {item.sent_by_name ? ` by ${item.sent_by_name}` : ''}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="inline-flex rounded-full bg-[#FAF8F4] px-2.5 py-0.5 font-medium text-[#806236] border border-[#E5E1D8]">
                              {item.status === 'applied' ? 'Applied' : 'Pending'}
                            </span>
                            <p className="text-[#4A5568] text-[11px] mt-0.5">{formatDate(item.created_at)}</p>
                          </div>
                        </div>
                      ))}
                      {outreach.has_more && (
                        <p className="pt-3 text-[11px] text-[#4A5568]">
                          Showing the {outreach.items.length} most recent of {outreach.total} invitations.
                        </p>
                      )}
                    </div>
                  )}
                </EmployerCard>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export default function EmployerTalentPage() {
  return <JobsPage activeNav="/employer/talent"><TalentSourcing /></JobsPage>;
}
