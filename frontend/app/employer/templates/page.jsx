'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  EmployerBtn,
  StageChip,
} from '@/components';
import { JobsPage, useJobsWorkspace } from '@/components/employer-jobs-workspace';
import { LoadingBlock, EmptyBlock, ErrorBlock, FieldError, fieldErrorsFrom } from '@/components/async-state';
import { useCareerResource } from '@/components/career-data';
import { api, ApiError } from '@/lib/api/client';
import { formatDate } from '@/lib/mentorship-labels';
import {
  CheckCircle2,
  Eye,
  FileCheck,
  LayoutGrid,
  List,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';

function EmployerTemplatesContent() {
  const { org } = useJobsWorkspace();
  const canWrite = ['owner', 'admin'].includes(org?.my_role);

  const [activeTab, setActiveTab] = useState('All');
  const [viewMode, setViewMode] = useState('cards');
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState(null);

  // New Template Modal state
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Onboarding'); // 'Onboarding' | 'Scorecards'
  const [newItems, setNewItems] = useState([
    { section: 'Week 1', title: '', owner_role: '', due_offset_days: '1' },
  ]);
  const [newCriteria, setNewCriteria] = useState([
    { name: '', weight: '1' },
  ]);
  const [newErrors, setNewErrors] = useState({});
  const [newError, setNewError] = useState('');
  const [newBusy, setNewBusy] = useState(false);

  // Preview Modal state
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [previewDetails, setPreviewDetails] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Real onboarding templates
  const onboardingRes = useCareerResource(
    org?.id ? `onboarding-templates:${org.id}` : '',
    (signal) =>
      api.onboardingTemplates
        .list(org.id, { limit: 100 }, signal)
        .catch(() => ({ items: [] }))
  );

  // Real scorecard rubrics
  const scorecardsRes = useCareerResource(
    org?.id ? `scorecards:${org.id}` : '',
    (signal) =>
      api.scorecards
        .list(org.id, { limit: 100 }, signal)
        .catch(() => ({ items: [] }))
  );

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const blankItem = () => ({
    section: 'Week 1',
    title: '',
    owner_role: '',
    due_offset_days: '1',
  });

  const blankCriterion = () => ({
    name: '',
    weight: '1',
  });

  const openNewModal = () => {
    setNewErrors({});
    setNewError('');
    setNewTitle('');
    setNewCategory(activeTab === 'Scorecards' ? 'Scorecards' : 'Onboarding');
    setNewItems([
      { section: 'Admin', title: 'Contract, system setup and tool access', owner_role: 'admin', due_offset_days: '0' },
      { section: 'Week 1', title: 'Team introduction and initial orientation', owner_role: 'owner', due_offset_days: '2' },
    ]);
    setNewCriteria([
      { name: 'Core Technical Competence', weight: '2' },
      { name: 'Problem Solving & Systems Architecture', weight: '2' },
      { name: 'Communication & Team Collaboration', weight: '1' },
    ]);
    setShowNewModal(true);
  };

  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    setNewErrors({});
    setNewError('');

    if (!newTitle.trim()) {
      setNewErrors({ name: 'Template title is required.' });
      return;
    }

    setNewBusy(true);

    try {
      if (newCategory === 'Onboarding') {
        const cleanedItems = newItems
          .filter((it) => it.title.trim())
          .map((it) => ({
            section: it.section.trim() || 'General',
            title: it.title.trim(),
            owner_role: it.owner_role || null,
            due_offset_days: it.due_offset_days === '' ? null : Number(it.due_offset_days),
          }));

        if (cleanedItems.length === 0) {
          setNewError('Please add at least one checklist item with a title.');
          setNewBusy(false);
          return;
        }

        await api.onboardingTemplates.create(org.id, {
          name: newTitle.trim(),
          items: cleanedItems,
        });

        onboardingRes.reload();
      } else {
        const cleanedCriteria = newCriteria
          .filter((c) => c.name.trim())
          .map((c) => ({
            name: c.name.trim(),
            weight: Math.max(1, Math.min(10, Number(c.weight) || 1)),
            anchors: [],
          }));

        if (cleanedCriteria.length === 0) {
          setNewError('Please add at least one evaluation criterion.');
          setNewBusy(false);
          return;
        }

        await api.scorecards.create(org.id, {
          name: newTitle.trim(),
          criteria: cleanedCriteria,
        });

        scorecardsRes.reload();
      }

      setShowNewModal(false);
      showToast(`Template "${newTitle.trim()}" created successfully.`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) {
        setNewErrors(fieldErrorsFrom(error));
      }
      setNewError(
        error instanceof ApiError ? error.message : 'Could not create template. Please try again.'
      );
    } finally {
      setNewBusy(false);
    }
  };

  const handleOpenPreview = async (tmpl) => {
    setPreviewTemplate(tmpl);
    setPreviewDetails(null);

    if (tmpl.type === 'Scorecard') {
      setPreviewLoading(true);
      try {
        const fullCard = await api.scorecards.get(org.id, tmpl.id);
        setPreviewDetails(fullCard);
      } catch {
        setPreviewDetails(tmpl.raw);
      } finally {
        setPreviewLoading(false);
      }
    } else {
      setPreviewDetails(tmpl.raw);
    }
  };

  // Combine real templates from Onboarding and Scorecards
  const allTemplates = useMemo(() => {
    const ob = (onboardingRes.data?.items || []).map((t) => ({
      id: t.id,
      name: t.name,
      type: 'Onboarding',
      badge: 'Checklist',
      itemCount: t.item_count ?? (t.items?.length || 0),
      items: t.items || [],
      is_platform: t.is_platform,
      updated_at: t.updated_at,
      raw: t,
    }));

    const sc = (scorecardsRes.data?.items || []).map((t) => ({
      id: t.id,
      name: t.name,
      type: 'Scorecard',
      badge: 'Rubric',
      itemCount: t.criteria?.length || 0,
      items: t.criteria || [],
      is_platform: t.is_platform,
      updated_at: t.updated_at,
      raw: t,
    }));

    return [...ob, ...sc];
  }, [onboardingRes.data, scorecardsRes.data]);

  const filteredTemplates = useMemo(() => {
    return allTemplates.filter((t) => {
      if (activeTab === 'Onboarding' && t.type !== 'Onboarding') return false;
      if (activeTab === 'Scorecards' && t.type !== 'Scorecard') return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          t.name.toLowerCase().includes(q) ||
          t.type.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allTemplates, activeTab, searchQuery]);

  // Real KPIs computed from organization data
  const totalOnboarding = (onboardingRes.data?.items || []).length;
  const totalScorecards = (scorecardsRes.data?.items || []).length;
  const totalTemplates = allTemplates.length;
  const totalItemsCount = allTemplates.reduce((sum, t) => sum + t.itemCount, 0);

  const mostRecentUpdated = useMemo(() => {
    let latest = 0;
    for (const t of allTemplates) {
      if (t.updated_at) {
        const ms = new Date(t.updated_at).getTime();
        if (ms > latest) latest = ms;
      }
    }
    return latest ? new Date(latest).toISOString() : null;
  }, [allTemplates]);

  const tabs = [
    { label: 'All', count: totalTemplates },
    { label: 'Onboarding', count: totalOnboarding },
    { label: 'Scorecards', count: totalScorecards },
  ];

  const isLoading = onboardingRes.loading || scorecardsRes.loading;
  const hasError = onboardingRes.error || scorecardsRes.error;

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

      {/* New Template Modal */}
      {showNewModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-tmpl-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E1D8]">
              <h3 id="new-tmpl-title" className="text-base font-semibold text-[#0F1B2D]">
                Create Organization Template
              </h3>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="text-[#4A5568] hover:text-[#0F1B2D]"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateTemplate} className="mt-4 space-y-4">
              <div>
                <label htmlFor="tmpl-category" className="block text-xs font-medium text-[#0F1B2D] mb-1">
                  Template Category
                </label>
                <select
                  id="tmpl-category"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full rounded-lg border border-[#E5E1D8] bg-white px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                >
                  <option value="Onboarding">Onboarding Checklist</option>
                  <option value="Scorecards">Interview Scorecard Rubric</option>
                </select>
              </div>

              <div>
                <label htmlFor="tmpl-name" className="block text-xs font-medium text-[#0F1B2D] mb-1">
                  Template Title *
                </label>
                <input
                  id="tmpl-name"
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={
                    newCategory === 'Onboarding'
                      ? 'e.g. Engineering Onboarding Checklist'
                      : 'e.g. Senior Backend Engineer Scorecard'
                  }
                  className="w-full rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                />
                <FieldError>{newErrors.name}</FieldError>
              </div>

              {/* Onboarding Checklist Editor */}
              {newCategory === 'Onboarding' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#0F1B2D]">Checklist Items</span>
                    <span className="text-[11px] text-[#4A5568]">Day-1 to Day-30 tasks for new hires</span>
                  </div>

                  {newItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex flex-wrap items-end gap-2 rounded-lg border border-[#E5E1D8] bg-[#FAF8F4] p-3"
                    >
                      <label className="flex flex-col gap-1 text-[10px] font-medium text-[#4A5568]">
                        Section
                        <input
                          className="w-28 rounded-md border border-[#E5E1D8] bg-white px-2 py-1.5 text-xs text-[#0F1B2D]"
                          value={item.section}
                          onChange={(e) =>
                            setNewItems(
                              newItems.map((it, i) =>
                                i === idx ? { ...it, section: e.target.value } : it
                              )
                            )
                          }
                        />
                      </label>
                      <label className="flex min-w-[170px] grow flex-col gap-1 text-[10px] font-medium text-[#4A5568]">
                        Item title *
                        <input
                          placeholder="e.g. Set up laptop and repo access"
                          className="rounded-md border border-[#E5E1D8] bg-white px-2.5 py-1.5 text-xs text-[#0F1B2D]"
                          value={item.title}
                          onChange={(e) =>
                            setNewItems(
                              newItems.map((it, i) =>
                                i === idx ? { ...it, title: e.target.value } : it
                              )
                            )
                          }
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-[10px] font-medium text-[#4A5568]">
                        Owner role
                        <select
                          className="w-28 rounded-md border border-[#E5E1D8] bg-white px-2 py-1.5 text-xs text-[#0F1B2D]"
                          value={item.owner_role || ''}
                          onChange={(e) =>
                            setNewItems(
                              newItems.map((it, i) =>
                                i === idx ? { ...it, owner_role: e.target.value } : it
                              )
                            )
                          }
                        >
                          <option value="">Unassigned</option>
                          <option value="owner">Owner</option>
                          <option value="admin">Admin</option>
                          <option value="member">Member</option>
                        </select>
                      </label>
                      <label className="flex flex-col gap-1 text-[10px] font-medium text-[#4A5568]">
                        Due (day)
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          className="w-16 rounded-md border border-[#E5E1D8] bg-white px-2 py-1.5 text-xs text-[#0F1B2D]"
                          value={item.due_offset_days}
                          onChange={(e) =>
                            setNewItems(
                              newItems.map((it, i) =>
                                i === idx ? { ...it, due_offset_days: e.target.value } : it
                              )
                            )
                          }
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setNewItems(newItems.filter((_, i) => i !== idx))}
                        className="p-1.5 text-[#B42318] hover:bg-red-50 rounded"
                        aria-label="Remove item"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}

                  <EmployerBtn
                    secondary
                    small
                    type="button"
                    onClick={() => setNewItems([...newItems, blankItem()])}
                  >
                    <Plus size={13} className="mr-1" /> Add checklist item
                  </EmployerBtn>
                </div>
              )}

              {/* Scorecard Rubric Editor */}
              {newCategory === 'Scorecards' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#0F1B2D]">Evaluation Criteria</span>
                    <span className="text-[11px] text-[#4A5568]">Criteria with weights for interviewers</span>
                  </div>

                  {newCriteria.map((c, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 rounded-lg border border-[#E5E1D8] bg-[#FAF8F4] p-3"
                    >
                      <label className="flex grow flex-col gap-1 text-[10px] font-medium text-[#4A5568]">
                        Criterion Name *
                        <input
                          placeholder="e.g. System Design, Communication, Problem Solving"
                          className="rounded-md border border-[#E5E1D8] bg-white px-2.5 py-1.5 text-xs text-[#0F1B2D]"
                          value={c.name}
                          onChange={(e) =>
                            setNewCriteria(
                              newCriteria.map((item, i) =>
                                i === idx ? { ...item, name: e.target.value } : item
                              )
                            )
                          }
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-[10px] font-medium text-[#4A5568]">
                        Weight (1–10)
                        <input
                          type="number"
                          min="1"
                          max="10"
                          className="w-20 rounded-md border border-[#E5E1D8] bg-white px-2 py-1.5 text-xs text-[#0F1B2D]"
                          value={c.weight}
                          onChange={(e) =>
                            setNewCriteria(
                              newCriteria.map((item, i) =>
                                i === idx ? { ...item, weight: e.target.value } : item
                              )
                            )
                          }
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setNewCriteria(newCriteria.filter((_, i) => i !== idx))}
                        className="mt-4 p-1.5 text-[#B42318] hover:bg-red-50 rounded"
                        aria-label="Remove criterion"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}

                  <EmployerBtn
                    secondary
                    small
                    type="button"
                    onClick={() => setNewCriteria([...newCriteria, blankCriterion()])}
                  >
                    <Plus size={13} className="mr-1" /> Add criterion
                  </EmployerBtn>
                </div>
              )}

              {newError && (
                <div
                  role="alert"
                  className="rounded-lg border border-[#F1C6C1] bg-[#FEF3F2] p-2.5 text-xs text-[#B42318]"
                >
                  {newError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-[#E5E1D8]">
                <EmployerBtn
                  secondary
                  small
                  type="button"
                  onClick={() => setShowNewModal(false)}
                >
                  Cancel
                </EmployerBtn>
                <EmployerBtn type="submit" primary small disabled={newBusy}>
                  {newBusy ? 'Saving…' : 'Save Template'}
                </EmployerBtn>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewTemplate && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="preview-tmpl-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E1D8]">
              <div>
                <h3 id="preview-tmpl-title" className="text-base font-semibold text-[#0F1B2D]">
                  {previewTemplate.name}
                </h3>
                <p className="text-xs text-[#4A5568]">
                  {previewTemplate.type === 'Onboarding' ? 'Onboarding Checklist' : 'Scorecard Rubric'} ·{' '}
                  {previewTemplate.is_platform ? 'Platform Template' : 'Organization Owned'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPreviewTemplate(null);
                  setPreviewDetails(null);
                }}
                className="text-[#4A5568] hover:text-[#0F1B2D]"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs text-[#4A5568]">
              {previewLoading ? (
                <LoadingBlock label="Loading details…" rows={2} />
              ) : previewTemplate.type === 'Onboarding' ? (
                <div className="rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-[#0F1B2D]">
                      Checklist Items ({previewDetails?.items?.length ?? previewTemplate.itemCount})
                    </p>
                    <span className="text-[11px] text-[#806236]">Applied when creating a hire</span>
                  </div>

                  {(previewDetails?.items || []).length === 0 ? (
                    <p className="text-[#6B7280]">This checklist has no items yet.</p>
                  ) : (
                    <ol className="space-y-2">
                      {(previewDetails?.items || []).map((item, idx) => (
                        <li
                          key={item.id || idx}
                          className="flex items-center justify-between gap-2 p-2 bg-white rounded-lg border border-[#E5E1D8]"
                        >
                          <div className="flex items-center gap-2">
                            <span className="grid h-5 w-5 shrink-0 place-items-center rounded bg-[#F3EBDD] text-[10px] text-[#806236] font-bold">
                              ✓
                            </span>
                            <div>
                              <p className="font-semibold text-[#0F1B2D]">{item.title}</p>
                              <p className="text-[11px] text-[#6B7280]">Section: {item.section}</p>
                            </div>
                          </div>
                          <div className="text-right text-[11px] text-[#4A5568]">
                            <span className="px-1.5 py-0.5 rounded bg-gray-100 font-medium">
                              {item.owner_role ? `@${item.owner_role}` : 'unassigned'}
                            </span>
                            {item.due_offset_days != null && (
                              <p className="mt-0.5 text-[#806236]">Due Day +{item.due_offset_days}</p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-[#0F1B2D]">
                      Scorecard Criteria ({previewDetails?.criteria?.length ?? previewTemplate.itemCount})
                    </p>
                    <span className="text-[11px] text-[#806236]">Used by interviewing panels</span>
                  </div>

                  {(previewDetails?.criteria || []).length === 0 ? (
                    <p className="text-[#6B7280]">This scorecard has no criteria configured yet.</p>
                  ) : (
                    <ul className="space-y-2">
                      {(previewDetails?.criteria || []).map((crit, idx) => (
                        <li
                          key={crit.id || idx}
                          className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-[#E5E1D8]"
                        >
                          <span className="font-semibold text-[#0F1B2D]">{crit.name}</span>
                          <span className="rounded bg-[#F3EBDD] px-2 py-0.5 text-[11px] font-semibold text-[#806236]">
                            Weight: {crit.weight}x
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-[#E5E1D8] pt-3">
              <EmployerBtn
                secondary
                small
                onClick={() => {
                  setPreviewTemplate(null);
                  setPreviewDetails(null);
                }}
              >
                Close Preview
              </EmployerBtn>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-[1280px] space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#0F1B2D]">
              Hiring Templates & Rubrics
            </h1>
            <p className="text-xs sm:text-sm text-[#4A5568]">
              Manage organization onboarding checklists and interview evaluation scorecards.
            </p>
          </div>
          {canWrite && (
            <div className="flex items-center gap-2">
              <EmployerBtn primary small onClick={openNewModal}>
                <Plus size={14} className="mr-1.5" /> New template
              </EmployerBtn>
            </div>
          )}
        </div>

        {/* Real Dynamic KPIs */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-2xl border border-[#E5E1D8] bg-white p-5 shadow-sm">
            <span className="text-xs font-semibold text-[#4A5568]">Total Templates</span>
            <p className="font-serif text-2xl font-bold text-[#0F1B2D] mt-1">
              {isLoading ? '…' : totalTemplates}
            </p>
            <p className="text-xs text-[#806236] mt-1">Checklists & scorecards</p>
          </div>
          <div className="rounded-2xl border border-[#E5E1D8] bg-white p-5 shadow-sm">
            <span className="text-xs font-semibold text-[#4A5568]">Onboarding Checklists</span>
            <p className="font-serif text-2xl font-bold text-[#0F1B2D] mt-1">
              {isLoading ? '…' : totalOnboarding}
            </p>
            <p className="text-xs text-[#806236] mt-1">Hire task templates</p>
          </div>
          <div className="rounded-2xl border border-[#E5E1D8] bg-white p-5 shadow-sm">
            <span className="text-xs font-semibold text-[#4A5568]">Scorecard Rubrics</span>
            <p className="font-serif text-2xl font-bold text-[#0F1B2D] mt-1">
              {isLoading ? '…' : totalScorecards}
            </p>
            <p className="text-xs text-[#806236] mt-1">Candidate scoring rubrics</p>
          </div>
          <div className="rounded-2xl border border-[#E5E1D8] bg-white p-5 shadow-sm">
            <span className="text-xs font-semibold text-[#4A5568]">Checklist Items & Criteria</span>
            <p className="font-serif text-2xl font-bold text-[#0F1B2D] mt-1">
              {isLoading ? '…' : totalItemsCount}
            </p>
            <p className="text-xs text-[#806236] mt-1">Active evaluation points</p>
          </div>
          <div className="rounded-2xl border border-[#E5E1D8] bg-white p-5 shadow-sm">
            <span className="text-xs font-semibold text-[#4A5568]">Last Updated</span>
            <p className="font-serif text-base font-bold text-[#0F1B2D] mt-1 truncate">
              {isLoading ? '…' : mostRecentUpdated ? formatDate(mostRecentUpdated) : '—'}
            </p>
            <p className="text-xs text-[#806236] mt-1">Recent modification</p>
          </div>
        </div>

        {/* Filters and View Switcher */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[#E5E1D8] pb-3">
          <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {tabs.map((tab) => {
              const active = activeTab === tab.label;
              return (
                <button
                  key={tab.label}
                  type="button"
                  onClick={() => setActiveTab(tab.label)}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    active
                      ? 'bg-[#0F1B2D] text-white shadow-sm'
                      : 'text-[#4A5568] hover:bg-[#FAF8F4] hover:text-[#0F1B2D]'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                      active ? 'bg-white/20 text-white' : 'bg-[#E5E1D8] text-[#0F1B2D]'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2 text-[#4A5568]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search templates..."
                className="w-40 sm:w-48 rounded-lg border border-[#E5E1D8] pl-8 pr-2.5 py-1 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
              />
            </div>
            <div className="flex rounded-lg border border-[#E5E1D8] p-0.5 bg-[#FAF8F4]">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`p-1 rounded ${
                  viewMode === 'cards' ? 'bg-white shadow-xs text-[#0F1B2D]' : 'text-[#4A5568]'
                }`}
                aria-label="Grid view"
              >
                <LayoutGrid size={14} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1 rounded ${
                  viewMode === 'table' ? 'bg-white shadow-xs text-[#0F1B2D]' : 'text-[#4A5568]'
                }`}
                aria-label="List view"
              >
                <List size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Templates Display */}
        {isLoading ? (
          <LoadingBlock label="Loading organization templates…" />
        ) : hasError ? (
          <ErrorBlock
            message="Could not load templates from server."
            onRetry={() => {
              onboardingRes.reload();
              scorecardsRes.reload();
            }}
          />
        ) : filteredTemplates.length === 0 ? (
          <EmptyBlock
            title={
              searchQuery
                ? `No templates match "${searchQuery}"`
                : activeTab === 'Onboarding'
                ? 'No onboarding checklists yet'
                : activeTab === 'Scorecards'
                ? 'No scorecard rubrics yet'
                : 'No templates created yet'
            }
            hint={
              searchQuery
                ? 'Clear the search to see all templates.'
                : 'Create your first template to standardize onboarding checklists and candidate scorecards across your organization.'
            }
          />
        ) : viewMode === 'cards' ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTemplates.map((t) => (
              <div
                key={t.id}
                className="rounded-2xl border border-[#E5E1D8] bg-white p-5 shadow-sm transition hover:border-[#B8955A] flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <StageChip stage={t.type} />
                    <span className="text-[11px] text-[#806236] font-semibold bg-[#F3EBDD] px-2 py-0.5 rounded">
                      {t.badge}
                    </span>
                  </div>

                  <h3 className="font-serif text-base font-bold text-[#0F1B2D] leading-tight">
                    {t.name}
                  </h3>

                  <p className="text-xs text-[#4A5568]">
                    {t.type === 'Onboarding'
                      ? `${t.itemCount} checklist item${t.itemCount === 1 ? '' : 's'}`
                      : `${t.itemCount} evaluation criteria`}
                  </p>

                  <p className="text-[11px] text-[#806236]">
                    Updated {t.updated_at ? formatDate(t.updated_at) : '—'}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-[#E5E1D8]">
                  <EmployerBtn secondary small onClick={() => handleOpenPreview(t)}>
                    <Eye size={13} className="mr-1" /> Preview
                  </EmployerBtn>
                  <span className="text-[10px] text-[#6B7280]">
                    {t.is_platform ? 'Platform verified' : 'Company owned'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[#E5E1D8] bg-white shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF8F4] text-[#4A5568] border-b border-[#E5E1D8]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Template Name</th>
                  <th className="px-4 py-3 font-semibold">Category</th>
                  <th className="px-4 py-3 font-semibold">Items / Criteria</th>
                  <th className="px-4 py-3 font-semibold">Scope</th>
                  <th className="px-4 py-3 font-semibold">Last Updated</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E1D8]">
                {filteredTemplates.map((t) => (
                  <tr key={t.id} className="hover:bg-[#FAF8F4]/50">
                    <td className="px-4 py-3 font-semibold text-[#0F1B2D]">{t.name}</td>
                    <td className="px-4 py-3">
                      <StageChip stage={t.type} />
                    </td>
                    <td className="px-4 py-3 text-[#4A5568]">
                      {t.type === 'Onboarding'
                        ? `${t.itemCount} checklist item${t.itemCount === 1 ? '' : 's'}`
                        : `${t.itemCount} criteria`}
                    </td>
                    <td className="px-4 py-3 text-[#4A5568]">
                      {t.is_platform ? 'Platform' : 'Company'}
                    </td>
                    <td className="px-4 py-3 text-[#4A5568]">
                      {t.updated_at ? formatDate(t.updated_at) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenPreview(t)}
                        className="text-[#806236] hover:underline font-medium inline-flex items-center gap-1"
                      >
                        <Eye size={12} /> Preview
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

export default function EmployerTemplatesPage() {
  return (
    <JobsPage activeNav="/employer/templates">
      <EmployerTemplatesContent />
    </JobsPage>
  );
}
