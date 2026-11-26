'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  EmployerBtn,
  EmployerCard,
  EmployerSafetyStrip as SafetyStrip,
} from '@/components';
import { JobsPage, useJobsWorkspace } from '@/components/employer-jobs-workspace';
import { ErrorBlock, FieldError, fieldErrorsFrom } from '@/components/async-state';
import { useCareerResource } from '@/components/career-data';
import { api, ApiError } from '@/lib/api/client';
import { formatMoney } from '@/lib/mentorship-labels';
import {
  ArrowLeft,
  CheckCircle2,
  Plus,
  Send,
  X,
} from 'lucide-react';

// Server enums (HiringRequestCreate) with the page's existing wording.
const DEPARTMENTS = [
  ['engineering', 'Engineering'],
  ['product', 'Product'],
  ['design', 'Design'],
  ['sales', 'Sales'],
  ['marketing', 'Marketing'],
  ['operations', 'Operations'],
  ['finance', 'Finance'],
  ['people', 'People'],
  ['legal', 'Legal'],
  ['support', 'Support'],
  ['other', 'Other'],
];
const MAX_SKILLS = 20;

/** Which form field a 422 `loc` belongs to (skills errors carry an index). */
function requestFieldErrors(err) {
  const out = fieldErrorsFrom(err);
  if (err && Array.isArray(err.details)) {
    for (const d of err.details) {
      const loc = Array.isArray(d.loc) ? d.loc : [];
      if (loc[1] === 'skills' && !out.skills) out.skills = d.msg || 'Invalid skill.';
    }
  }
  return out;
}

function requestError(error) {
  if (error instanceof ApiError) {
    if (error.status === 403) return error.message || 'You do not have permission to create hiring requests in this organization.';
    return error.message;
  }
  return 'Could not connect. Please try again.';
}

function NewHiringRequest() {
  const router = useRouter();
  const { org, canWrite, href } = useJobsWorkspace();
  const isViewer = org.my_role === 'viewer';

  const [roleTitle, setRoleTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [headcount, setHeadcount] = useState(1);
  const [urgency, setUrgency] = useState('normal');
  const [whyNow, setWhyNow] = useState('growth');
  const [budget, setBudget] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [employmentType, setEmploymentType] = useState('full_time');
  const [workMode, setWorkMode] = useState('hybrid');
  const [hiringManager, setHiringManager] = useState('');
  const [approver, setApprover] = useState('');
  const [justification, setJustification] = useState('');

  const [skills, setSkills] = useState([]);
  const [newSkill, setNewSkill] = useState('');
  const [toastMessage, setToastMessage] = useState(null);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  // Hiring manager: any active non-viewer member. Approver: active
  // owner/admin (the API's rules — it re-validates either way).
  const membersRes = useCareerResource(`request-members:${org.id}`, (signal) =>
    isViewer
      ? Promise.resolve(null)
      : api.organizations.members(org.id, { status: 'active', limit: 100 }, signal)
  );
  const members = (membersRes.data?.items || []).filter((m) => m.role !== 'viewer');
  const approvers = members.filter((m) => m.role === 'owner' || m.role === 'admin');
  const approverName = approvers.find((m) => m.user_id === approver)?.display_name;

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleAddSkill = (e) => {
    e.preventDefault();
    const name = newSkill.trim().replace(/\s+/g, ' ');
    if (!name) return;
    if (skills.some((s) => s.toLowerCase() === name.toLowerCase())) {
      setNewSkill('');
      return;
    }
    if (skills.length >= MAX_SKILLS) {
      setErrors((prev) => ({ ...prev, skills: `Up to ${MAX_SKILLS} competencies.` }));
      return;
    }
    setSkills([...skills, name]);
    setNewSkill('');
  };

  const handleRemoveSkill = (skillToRemove) => {
    setSkills(skills.filter((s) => s !== skillToRemove));
  };

  const save = async (submit) => {
    setBusy(true);
    setErrors({});
    setFormError('');
    const body = {
      role_title: roleTitle,
      department: department || null,
      headcount: Number(headcount) || 1,
      urgency,
      why_now: whyNow || null,
      justification: justification.trim() || null,
      // Decimal string, never a float (the API rejects binary floats).
      budget_amount: budget.trim() === '' ? null : budget.trim(),
      currency: 'INR',
      target_start: targetDate || null,
      employment_type: employmentType,
      work_mode: workMode,
      hiring_manager_id: hiringManager || null,
      skills,
      submit,
    };
    if (canWrite && approver) body.approver_id = approver;
    try {
      await api.hiringRequests.create(org.id, body);
      showToast(submit ? 'Hiring request submitted for approval.' : 'Draft hiring request saved.');
      setTimeout(() => router.push(href('/employer/hiring')), 1200);
    } catch (error) {
      const fields = requestFieldErrors(error);
      setErrors(fields);
      setFormError(Object.keys(fields).length ? 'Please fix the highlighted fields.' : requestError(error));
      setBusy(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    save(true);
  };

  const handleSaveDraft = () => {
    save(false);
  };

  const projected =
    budget.trim() !== '' && !Number.isNaN(Number(budget))
      ? formatMoney(Number(budget) * (Number(headcount) || 1), 'INR')
      : null;

  if (isViewer) {
    return (
      <div className="mx-auto max-w-[1080px]">
        <div className="rounded-xl border border-[#E5E1D8] bg-white p-8 text-center text-sm text-[#4A5568]">
          Viewers cannot create hiring requests.
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

      <div className="mx-auto max-w-[1080px] space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-[#4A5568]">
          <Link
            href={href('/employer/hiring')}
            className="inline-flex items-center gap-1 font-medium text-[#806236] hover:underline"
          >
            <ArrowLeft size={14} /> Back to Hiring
          </Link>
          <span>/</span>
          <span className="text-[#0F1B2D] font-medium">New Hiring Request</span>
        </div>

        {/* Page Title */}
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#0F1B2D]">
            Create Internal Hiring Request
          </h1>
          <p className="text-xs sm:text-sm text-[#4A5568]">
            Propose a new headcount need and route it through team budget sign-off before publishing a live job post.
          </p>
        </div>

        {formError && (
          <div role="alert" className="rounded-xl border border-[#F1C6C1] bg-[#FEF3F2] p-3 text-xs text-[#B42318]">
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-12 min-w-0">
          {/* Main Form Fields */}
          <div className="lg:col-span-8 space-y-6 min-w-0">
            <EmployerCard title="Role Overview & Justification">
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="req-title" className="block text-xs font-medium text-[#0F1B2D] mb-1">
                      Proposed Role Title
                    </label>
                    <input
                      id="req-title"
                      type="text"
                      required
                      value={roleTitle}
                      onChange={(e) => setRoleTitle(e.target.value)}
                      placeholder="e.g. Lead Frontend Architect"
                      maxLength={160}
                      aria-invalid={Boolean(errors.role_title)}
                      className="w-full rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                    />
                    <FieldError>{errors.role_title}</FieldError>
                  </div>
                  <div>
                    <label htmlFor="req-dept" className="block text-xs font-medium text-[#0F1B2D] mb-1">
                      Department / Function
                    </label>
                    <select
                      id="req-dept"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      aria-invalid={Boolean(errors.department)}
                      className="w-full rounded-lg border border-[#E5E1D8] bg-white px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                    >
                      <option value="">Select a department</option>
                      {DEPARTMENTS.map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                    <FieldError>{errors.department}</FieldError>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label htmlFor="req-headcount" className="block text-xs font-medium text-[#0F1B2D] mb-1">
                      Target Headcount
                    </label>
                    <input
                      id="req-headcount"
                      type="number"
                      min={1}
                      max={100}
                      value={headcount}
                      onChange={(e) => setHeadcount(e.target.value)}
                      aria-invalid={Boolean(errors.headcount)}
                      className="w-full rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                    />
                    <FieldError>{errors.headcount}</FieldError>
                  </div>
                  <div>
                    <label htmlFor="req-urgency" className="block text-xs font-medium text-[#0F1B2D] mb-1">
                      Urgency Level
                    </label>
                    <select
                      id="req-urgency"
                      value={urgency}
                      onChange={(e) => setUrgency(e.target.value)}
                      className="w-full rounded-lg border border-[#E5E1D8] bg-white px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                    >
                      <option value="low">Low (Backlog / Pipeline)</option>
                      <option value="normal">Medium (Q1 Expansion)</option>
                      <option value="high">High (Immediate Backfill)</option>
                      <option value="urgent">Urgent (Critical Path)</option>
                    </select>
                    <FieldError>{errors.urgency}</FieldError>
                  </div>
                  <div>
                    <label htmlFor="req-why" className="block text-xs font-medium text-[#0F1B2D] mb-1">
                      Business Driver (&quot;Why Now&quot;)
                    </label>
                    <select
                      id="req-why"
                      value={whyNow}
                      onChange={(e) => setWhyNow(e.target.value)}
                      className="w-full rounded-lg border border-[#E5E1D8] bg-white px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                    >
                      <option value="growth">Growth & Scaling</option>
                      <option value="replacement">Replacement / Backfill</option>
                      <option value="new_project">New Product Milestone</option>
                      <option value="skill_gap">Specialized Skill Gap</option>
                    </select>
                    <FieldError>{errors.why_now}</FieldError>
                  </div>
                </div>

                <div>
                  <label htmlFor="req-justification" className="block text-xs font-medium text-[#0F1B2D] mb-1">
                    Business Justification & Impact
                  </label>
                  <textarea
                    id="req-justification"
                    rows={3}
                    value={justification}
                    onChange={(e) => setJustification(e.target.value)}
                    placeholder="Describe why this hire is critical to your team's quarterly OKRs..."
                    maxLength={2000}
                    aria-invalid={Boolean(errors.justification)}
                    className="w-full rounded-lg border border-[#E5E1D8] p-2.5 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                  />
                  <FieldError>{errors.justification}</FieldError>
                </div>
              </div>
            </EmployerCard>

            <EmployerCard title="Budget & Employment Terms">
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="req-budget" className="block text-xs font-medium text-[#0F1B2D] mb-1">
                      Maximum Annual CTC Budget (₹)
                    </label>
                    <input
                      id="req-budget"
                      type="number"
                      min={0}
                      step="1"
                      inputMode="numeric"
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                      placeholder="e.g. 2400000"
                      aria-invalid={Boolean(errors.budget_amount)}
                      className="w-full rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                    />
                    <FieldError>{errors.budget_amount}</FieldError>
                  </div>
                  <div>
                    <label htmlFor="req-target-date" className="block text-xs font-medium text-[#0F1B2D] mb-1">
                      Target Joining Date
                    </label>
                    <input
                      id="req-target-date"
                      type="date"
                      value={targetDate}
                      onChange={(e) => setTargetDate(e.target.value)}
                      aria-invalid={Boolean(errors.target_start)}
                      className="w-full rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                    />
                    <FieldError>{errors.target_start}</FieldError>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="req-emp-type" className="block text-xs font-medium text-[#0F1B2D] mb-1">
                      Employment Agreement
                    </label>
                    <select
                      id="req-emp-type"
                      value={employmentType}
                      onChange={(e) => setEmploymentType(e.target.value)}
                      className="w-full rounded-lg border border-[#E5E1D8] bg-white px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                    >
                      <option value="full_time">Full-time Permanent</option>
                      <option value="part_time">Part-time</option>
                      <option value="contract">Fixed-term Contract</option>
                      <option value="temporary">Temporary</option>
                      <option value="internship">Paid Internship</option>
                    </select>
                    <FieldError>{errors.employment_type}</FieldError>
                  </div>
                  <div>
                    <label htmlFor="req-work-mode" className="block text-xs font-medium text-[#0F1B2D] mb-1">
                      Work Location & Mode
                    </label>
                    <select
                      id="req-work-mode"
                      value={workMode}
                      onChange={(e) => setWorkMode(e.target.value)}
                      className="w-full rounded-lg border border-[#E5E1D8] bg-white px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                    >
                      <option value="hybrid">Hybrid</option>
                      <option value="remote">100% Remote</option>
                      <option value="onsite">On-site</option>
                    </select>
                    <FieldError>{errors.work_mode}</FieldError>
                  </div>
                </div>

                <div>
                  <label htmlFor="req-skill-input" className="block text-xs font-medium text-[#0F1B2D] mb-1">
                    Key Competencies & Must-Haves
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {skills.map((s) => (
                      <span
                        key={s}
                        className="inline-flex items-center gap-1 rounded-md border border-[#F3EBDD] bg-[#F3EBDD] px-2.5 py-1 text-xs font-medium text-[#806236]"
                      >
                        {s}
                        <button
                          type="button"
                          onClick={() => handleRemoveSkill(s)}
                          className="hover:text-red-700"
                          aria-label={`Remove skill ${s}`}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      id="req-skill-input"
                      type="text"
                      value={newSkill}
                      maxLength={80}
                      onChange={(e) => setNewSkill(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddSkill(e); }}
                      placeholder="Add another required competency..."
                      className="flex-1 rounded-lg border border-[#E5E1D8] px-3 py-1.5 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                    />
                    <EmployerBtn variant="secondary" size="sm" onClick={handleAddSkill}>
                      <Plus size={14} className="mr-1" /> Add
                    </EmployerBtn>
                  </div>
                  <FieldError>{errors.skills}</FieldError>
                </div>
              </div>
            </EmployerCard>

            <EmployerCard title="Stakeholders & Approvers">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="req-manager" className="block text-xs font-medium text-[#0F1B2D] mb-1">
                    Hiring Manager
                  </label>
                  <select
                    id="req-manager"
                    value={hiringManager}
                    onChange={(e) => setHiringManager(e.target.value)}
                    disabled={membersRes.loading}
                    aria-invalid={Boolean(errors.hiring_manager_id)}
                    className="w-full rounded-lg border border-[#E5E1D8] bg-white px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                  >
                    <option value="">{membersRes.loading ? 'Loading team…' : 'Not assigned yet'}</option>
                    {members.map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.display_name}{m.title ? ` (${m.title})` : ''}
                      </option>
                    ))}
                  </select>
                  <FieldError>{errors.hiring_manager_id}</FieldError>
                </div>
                <div>
                  <label htmlFor="req-approvers" className="block text-xs font-medium text-[#0F1B2D] mb-1">
                    Approver
                  </label>
                  <select
                    id="req-approvers"
                    value={approver}
                    onChange={(e) => setApprover(e.target.value)}
                    disabled={!canWrite || membersRes.loading}
                    aria-invalid={Boolean(errors.approver_id)}
                    className="w-full rounded-lg border border-[#E5E1D8] bg-white px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                  >
                    <option value="">Any owner or admin</option>
                    {approvers.map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.display_name} ({m.role === 'owner' ? 'Owner' : 'Admin'})
                      </option>
                    ))}
                  </select>
                  {!canWrite && (
                    <p className="mt-1 text-[11px] text-[#4A5568]">Owners and admins designate approvers.</p>
                  )}
                  <FieldError>{errors.approver_id}</FieldError>
                </div>
              </div>
              {membersRes.error && (
                <div className="mt-3">
                  <ErrorBlock title="Could not load your team" message={requestError(membersRes.error)} onRetry={membersRes.reload} />
                </div>
              )}
            </EmployerCard>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <EmployerBtn type="submit" variant="primary" size="md" disabled={busy}>
                <Send size={14} className="mr-1.5" /> {busy ? 'Saving…' : 'Submit for Approval'}
              </EmployerBtn>
              <EmployerBtn variant="secondary" size="md" onClick={handleSaveDraft} disabled={busy}>
                Save Draft
              </EmployerBtn>
              <Link href={href('/employer/hiring')}>
                <EmployerBtn variant="ghost" size="md">
                  Cancel
                </EmployerBtn>
              </Link>
            </div>
          </div>

          {/* Right Summary Panel */}
          <div className="lg:col-span-4 space-y-6 min-w-0">
            <EmployerCard title="Plan & Budget Impact">
              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-[#4A5568]">Projected Annual CTC:</span>
                  <span className="font-bold text-[#0F1B2D]">{projected ? `${projected} (${Number(headcount) || 1} × budget)` : 'Enter a budget'}</span>
                </div>
                {/* Plan quota rows return with billing (a later step) — no fake numbers here. */}
                <p className="text-[#4A5568] pt-2 border-t border-[#E5E1D8]">
                  {approverName ? `${approverName} approves this request` : 'Any owner or admin can approve this request'}. Once approved, an owner or admin converts it into a draft job — nothing is published until then.
                </p>
              </div>
            </EmployerCard>

            <SafetyStrip />
          </div>
        </form>
      </div>
    </>
  );
}

export default function EmployerNewHiringRequestPage() {
  return <JobsPage><NewHiringRequest /></JobsPage>;
}
