'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  EmployerShell,
  EmployerBtn,
  EmployerCard,
  StageChip,
  EmployerSafetyStrip as SafetyStrip,
} from '@/components';
import {
  templates as initialTemplates,
  templateKpis,
} from '@/app/employer/employer-data';
import { useJobsWorkspace } from '@/components/employer-jobs-workspace';
import { LoadingBlock, EmptyBlock, ErrorBlock, FieldError, fieldErrorsFrom } from '@/components/async-state';
import { useCareerResource } from '@/components/career-data';
import { api, ApiError } from '@/lib/api/client';
import { formatDate } from '@/lib/mentorship-labels';
import {
  CheckCircle2,
  Copy,
  Eye,
  FileCheck,
  FileText,
  Filter,
  LayoutGrid,
  List,
  Plus,
  Search,
  Sparkles,
  X,
} from 'lucide-react';

export default function EmployerTemplatesPage() {
  const { org } = useJobsWorkspace();
  const [activeTab, setActiveTab] = useState('All');
  const [viewMode, setViewMode] = useState('cards');
  const [searchQuery, setSearchQuery] = useState('');
  const [templatesList, setTemplatesList] = useState(initialTemplates);
  const [toastMessage, setToastMessage] = useState(null);

  // New Template Modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState('Job posts');
  const [newDesc, setNewDesc] = useState('');
  // Onboarding mode: checklist items editor (additive, plan U7).
  const [newItems, setNewItems] = useState([]);
  const [newErrors, setNewErrors] = useState({});
  const [newError, setNewError] = useState('');
  const [newBusy, setNewBusy] = useState(false);

  // Preview Modal
  const [previewTemplate, setPreviewTemplate] = useState(null);

  // Real onboarding templates (Step 7h) — loaded only while the tab is active.
  const onboardingRes = useCareerResource(
    `onboarding-templates:${org.id}`,
    (signal) =>
      activeTab === 'Onboarding'
        ? api.onboardingTemplates.list(org.id, { limit: 100 }, signal)
        : Promise.resolve(null)
  );

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const blankItem = () => ({ section: 'Week 1', title: '', owner_role: '', due_offset_days: '' });

  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    // Onboarding templates are real API writes (7h); every other category
    // keeps its Step-15 demo behavior until its own step wires it.
    if (activeTab === 'Onboarding') {
      setNewErrors({});
      setNewError('');
      const items = newItems
        .filter((it) => it.title.trim())
        .map((it) => ({
          section: it.section.trim() || 'General',
          title: it.title.trim(),
          owner_role: it.owner_role || null,
          due_offset_days: it.due_offset_days === '' ? null : Number(it.due_offset_days),
        }));
      setNewBusy(true);
      try {
        await api.onboardingTemplates.create(org.id, {
          name: newTitle.trim(),
          items,
        });
        setShowNewModal(false);
        setNewTitle('');
        setNewDesc('');
        setNewItems([]);
        showToast(`Template "${newTitle.trim()}" created successfully.`);
        onboardingRes.reload();
      } catch (error) {
        if (error instanceof ApiError && error.status === 422) {
          setNewErrors(fieldErrorsFrom(error));
        }
        setNewError(
          error instanceof ApiError ? error.message : 'Could not create the template. Please try again.'
        );
      } finally {
        setNewBusy(false);
      }
      return;
    }
    const newEntry = {
      id: `tmpl-${Date.now()}`,
      name: newTitle.trim(),
      type: newType,
      desc: newDesc.trim() || 'Custom Northstar hiring template.',
      category: 'Design & Eng',
      scope: 'Company-wide',
      version: 'v1.0',
      status: 'In use',
      usedIn: 0,
      updated: 'Just now',
      updatedBy: 'Priya Mehta',
      platform: false,
    };
    setTemplatesList([newEntry, ...templatesList]);
    setShowNewModal(false);
    setNewTitle('');
    setNewDesc('');
    showToast(`Template "${newEntry.name}" created successfully.`);
  };

  const filteredTemplates = useMemo(() => {
    return templatesList.filter((t) => {
      if (activeTab !== 'All' && t.type !== activeTab) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          t.name?.toLowerCase().includes(q) ||
          t.desc?.toLowerCase().includes(q) ||
          t.type?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [templatesList, activeTab, searchQuery]);

  const tabs = [
    'All',
    'Job posts',
    'Pipelines',
    'Scorecards',
    'Screening questions',
    'Interview guides',
    'Offers',
  ];

  return (
    <EmployerShell active="/employer/templates">
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
          <div className="w-full max-w-lg rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E1D8]">
              <h3 id="new-tmpl-title" className="text-base font-semibold text-[#0F1B2D]">
                Create Hiring Template
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
                <label htmlFor="tmpl-name" className="block text-xs font-medium text-[#0F1B2D] mb-1">
                  Template Title
                </label>
                <input
                  id="tmpl-name"
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Senior Backend Engineer Scorecard"
                  className="w-full rounded-lg border border-[#E5E1D8] px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                />
              </div>

              {activeTab !== 'Onboarding' && (
                <>
                  <div>
                    <label htmlFor="tmpl-type" className="block text-xs font-medium text-[#0F1B2D] mb-1">
                      Template Category
                    </label>
                    <select
                      id="tmpl-type"
                      value={newType}
                      onChange={(e) => setNewType(e.target.value)}
                      className="w-full rounded-lg border border-[#E5E1D8] bg-white px-3 py-2 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                    >
                      <option value="Job posts">Job Post Template</option>
                      <option value="Pipelines">Hiring Stage Pipeline</option>
                      <option value="Scorecards">Interview Scorecard</option>
                      <option value="Screening questions">Screening Questions</option>
                      <option value="Offers">Offer Letter Package</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="tmpl-desc" className="block text-xs font-medium text-[#0F1B2D] mb-1">
                      Description & Scope
                    </label>
                    <textarea
                      id="tmpl-desc"
                      rows={3}
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      placeholder="Standard evaluation rubric for evaluating system architecture..."
                      className="w-full rounded-lg border border-[#E5E1D8] p-2.5 text-xs text-[#0F1B2D] focus:border-[#B8955A] focus:outline-none"
                    />
                  </div>
                </>
              )}

              {activeTab === 'Onboarding' && (
                <div className="space-y-3">
                  <p className="text-xs text-[#4A5568]">
                    Each item becomes a Day-1 checklist task for new hires. Owner and due day are
                    optional (blank owner = unassigned, blank due = no offset).
                  </p>
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
                              newItems.map((it, i) => (i === idx ? { ...it, section: e.target.value } : it))
                            )
                          }
                        />
                      </label>
                      <label className="flex min-w-[170px] grow flex-col gap-1 text-[10px] font-medium text-[#4A5568]">
                        Item title *
                        <input
                          placeholder="Set up laptop and email"
                          className="rounded-md border border-[#E5E1D8] bg-white px-2.5 py-1.5 text-xs text-[#0F1B2D]"
                          value={item.title}
                          onChange={(e) =>
                            setNewItems(
                              newItems.map((it, i) => (i === idx ? { ...it, title: e.target.value } : it))
                            )
                          }
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-[10px] font-medium text-[#4A5568]">
                        Owner role
                        <select
                          className="w-32 rounded-md border border-[#E5E1D8] bg-white px-2 py-1.5 text-xs text-[#0F1B2D]"
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
                          placeholder="1"
                          className="w-20 rounded-md border border-[#E5E1D8] bg-white px-2 py-1.5 text-xs text-[#0F1B2D]"
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
                      <EmployerBtn
                        secondary
                        small
                        type="button"
                        className="!text-[#B42318]"
                        onClick={() => setNewItems(newItems.filter((_, i) => i !== idx))}
                      >
                        Remove
                      </EmployerBtn>
                    </div>
                  ))}
                  <EmployerBtn
                    secondary
                    small
                    type="button"
                    onClick={() => setNewItems([...newItems, blankItem()])}
                  >
                    <Plus size={13} className="mr-1" /> Add item
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
              <FieldError>{newErrors.name}</FieldError>

              <div className="flex justify-end gap-2 pt-2">
                <EmployerBtn
                  secondary
                  small
                  type="button"
                  onClick={() => {
                    setShowNewModal(false);
                    setNewError('');
                    setNewErrors({});
                  }}
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
          <div className="w-full max-w-xl rounded-2xl border border-[#E5E1D8] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E1D8]">
              <div>
                <h3 id="preview-tmpl-title" className="text-base font-semibold text-[#0F1B2D]">
                  {previewTemplate.name}
                </h3>
                <p className="text-xs text-[#4A5568]">
                  {Array.isArray(previewTemplate.items)
                    ? `Onboarding checklist · ${previewTemplate.items.length} items`
                    : `${previewTemplate.type} · ${previewTemplate.version}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewTemplate(null)}
                className="text-[#4A5568] hover:text-[#0F1B2D]"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-4 space-y-4 text-xs text-[#4A5568]">
              {Array.isArray(previewTemplate.items) ? (
                <div className="rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] p-4 space-y-2">
                  <p className="font-semibold text-[#0F1B2D]">
                    Checklist items ({previewTemplate.items.length})
                  </p>
                  {previewTemplate.items.length === 0 ? (
                    <p>This template has no items yet.</p>
                  ) : (
                    <ol className="space-y-1.5">
                      {previewTemplate.items.map((item) => (
                        <li key={item.id} className="flex items-center gap-2">
                          <span className="grid h-4 w-4 shrink-0 place-items-center rounded border border-[#B8955A]/50 text-[9px] text-[#806236]">
                            ✓
                          </span>
                          <span className="text-[#0F1B2D]">
                            {item.section} — {item.title}
                          </span>
                          <span className="text-[11px] text-[#6B7280]">
                            {item.owner_role ? `@${item.owner_role}` : 'unassigned'}
                            {item.due_offset_days != null ? ` · day ${item.due_offset_days}` : ''}
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                  <p className="pt-2 text-[11px] text-[#806236]">
                    Applied when this template is selected while creating a hire.
                  </p>
                </div>
              ) : (
                <>
                  <div className="rounded-xl border border-[#E5E1D8] bg-[#FAF8F4] p-4 space-y-2">
                    <p className="font-semibold text-[#0F1B2D]">Template Summary</p>
                    <p>{previewTemplate.desc}</p>
                    <p className="pt-2 text-[11px] text-[#806236]">
                      Category: {previewTemplate.category} · Scope: {previewTemplate.scope} · In use across {previewTemplate.usedIn} active positions
                    </p>
                  </div>
                  <p>
                    This template is ready for instant deployment into your hiring workflow.
                  </p>
                </>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <EmployerBtn variant="secondary" size="sm" onClick={() => setPreviewTemplate(null)}>
                Close Preview
              </EmployerBtn>
              {!Array.isArray(previewTemplate.items) && (
                <EmployerBtn
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    showToast(`Template "${previewTemplate.name}" applied to active workflow!`);
                    setPreviewTemplate(null);
                  }}
                >
                  Apply to New Job
                </EmployerBtn>
              )}
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
              Standardize job descriptions, scorecards, screening questions, and offer letters across your company.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <EmployerBtn
              variant="primary"
              size="sm"
              onClick={() => setShowNewModal(true)}
            >
              <Plus size={14} className="mr-1.5" /> New template
            </EmployerBtn>
          </div>
        </div>

        {/* KPIs — real stats for the Onboarding tab (7h); demo tiles elsewhere */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {(activeTab === 'Onboarding'
            ? (() => {
                const onboardingTemplates = onboardingRes.data?.items || [];
                const totalItems = onboardingTemplates.reduce(
                  (sum, t) => sum + (t.item_count ?? (t.items || []).length),
                  0
                );
                return [
                  {
                    label: 'Total Onboarding Checklists',
                    value: onboardingRes.loading ? '…' : String(onboardingTemplates.length),
                    sub: 'Company-owned checklist templates',
                  },
                  {
                    label: 'Total Checklist Items',
                    value: onboardingRes.loading ? '…' : String(totalItems),
                    sub: 'Across all templates',
                  },
                  {
                    label: 'Avg. Steps per Template',
                    value:
                      onboardingRes.loading || onboardingTemplates.length === 0
                        ? '—'
                        : String(Math.round(totalItems / onboardingTemplates.length)),
                    sub: 'Rounded to nearest whole step',
                  },
                  {
                    label: 'Last Edited',
                    value: onboardingTemplates[0]?.updated_at
                      ? formatDate(onboardingTemplates[0].updated_at)
                      : onboardingRes.loading
                        ? '…'
                        : '—',
                    sub: 'Most recent template change',
                  },
                ];
              })()
            : templateKpis
          ).map((k, idx) => (
            <div key={idx} className="rounded-2xl border border-[#E5E1D8] bg-white p-5 shadow-sm">
              <span className="text-xs font-semibold text-[#4A5568]">{k.label}</span>
              <p className="font-serif text-2xl font-bold text-[#0F1B2D] mt-1">{k.value}</p>
              <p className="text-xs text-[#806236] mt-1">
                {activeTab === 'Onboarding' ? k.sub : 'Platform verified'}
              </p>
            </div>
          ))}
        </div>

        {/* Filters and View Switcher */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[#E5E1D8] pb-3">
          <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {tabs.map((tab) => {
              const active = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    active
                      ? 'bg-[#0F1B2D] text-white shadow-sm'
                      : 'text-[#4A5568] hover:bg-[#FAF8F4] hover:text-[#0F1B2D]'
                  }`}
                >
                  {tab}
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
                className={`p-1 rounded ${viewMode === 'cards' ? 'bg-white shadow-xs text-[#0F1B2D]' : 'text-[#4A5568]'}`}
                aria-label="Grid view"
              >
                <LayoutGrid size={14} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1 rounded ${viewMode === 'table' ? 'bg-white shadow-xs text-[#0F1B2D]' : 'text-[#4A5568]'}`}
                aria-label="List view"
              >
                <List size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Templates Display */}
        {activeTab === 'Onboarding' ? (
          <div className="space-y-4">
            {onboardingRes.loading ? (
              <LoadingBlock label="Loading onboarding templates…" />
            ) : onboardingRes.error ? (
              <ErrorBlock
                message={
                  onboardingRes.error instanceof ApiError
                    ? onboardingRes.error.message
                    : 'Could not load onboarding templates.'
                }
                onRetry={onboardingRes.reload}
              />
            ) : (onboardingRes.data?.items || []).filter((t) =>
                searchQuery
                  ? t.name.toLowerCase().includes(searchQuery.toLowerCase())
                  : true
              ).length === 0 ? (
              <EmptyBlock
                title={searchQuery ? `No checklists match "${searchQuery}"` : 'No onboarding checklists yet'}
                hint={
                  searchQuery
                    ? 'Clear the search to see every checklist template.'
                    : 'Create your first checklist template — its items become Day-1 tasks for every new hire.'
                }
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {(onboardingRes.data?.items || [])
                  .filter((t) =>
                    searchQuery
                      ? t.name.toLowerCase().includes(searchQuery.toLowerCase())
                      : true
                  )
                  .map((t) => {
                    const itemCount = t.item_count ?? (t.items || []).length;
                    return (
                      <div
                        key={t.id}
                        className="rounded-2xl border border-[#E5E1D8] bg-white p-5 shadow-sm transition hover:border-[#B8955A] flex flex-col justify-between space-y-4"
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <StageChip stage="Onboarding" />
                            </div>
                          </div>
                          <h3 className="font-serif text-base font-bold text-[#0F1B2D] leading-tight">
                            {t.name}
                          </h3>
                          <span className="inline-block px-2 py-0.5 rounded bg-[#F3EBDD] text-[#806236] text-[11px] font-semibold">
                            Checklist template
                          </span>
                          <p className="text-xs text-[#4A5568]">
                            {itemCount} checklist item{itemCount === 1 ? '' : 's'}
                          </p>
                          <p className="text-[11px] text-[#4A5568]">
                            Updated {t.updated_at ? formatDate(t.updated_at) : '—'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 pt-2 border-t border-[#E5E1D8]">
                          <EmployerBtn secondary small onClick={() => setPreviewTemplate(t)}>
                            <Eye size={13} className="mr-1" /> Preview
                          </EmployerBtn>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        ) : viewMode === 'cards' ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTemplates.map((t) => (
              <div
                key={t.id}
                className="rounded-2xl border border-[#E5E1D8] bg-white p-5 shadow-sm transition hover:border-[#B8955A] flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-serif text-base font-bold text-[#0F1B2D]">
                      {t.name}
                    </h3>
                    <StageChip stage={t.status} />
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <span className="rounded-md bg-[#FAF8F4] px-2 py-0.5 text-[11px] text-[#4A5568] border border-[#E5E1D8]">
                      {t.type}
                    </span>
                    <span className="rounded-md bg-[#FAF8F4] px-2 py-0.5 text-[11px] text-[#4A5568] border border-[#E5E1D8]">
                      {t.scope}
                    </span>
                  </div>

                  <p className="text-xs text-[#4A5568] line-clamp-2 leading-relaxed">
                    {t.desc}
                  </p>
                </div>

                <div className="border-t border-[#E5E1D8] pt-3 space-y-3">
                  <div className="flex justify-between items-center text-xs text-[#4A5568]">
                    <span>Used in {t.usedIn} jobs</span>
                    <span className="font-medium text-[#0F1B2D]">{t.version}</span>
                  </div>

                  <div className="flex gap-2">
                    <EmployerBtn
                      variant="primary"
                      size="sm"
                      className="flex-1"
                      onClick={() => showToast(`Template "${t.name}" copied to clipboard!`)}
                    >
                      <Copy size={13} className="mr-1" /> Use
                    </EmployerBtn>
                    <EmployerBtn
                      variant="secondary"
                      size="sm"
                      onClick={() => setPreviewTemplate(t)}
                    >
                      <Eye size={13} className="mr-1" /> Preview
                    </EmployerBtn>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[#E5E1D8] bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF8F4] text-[#4A5568] border-b border-[#E5E1D8]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Template Name</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Usage</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E1D8]">
                {filteredTemplates.map((t) => (
                  <tr key={t.id} className="hover:bg-[#FAF8F4]/50">
                    <td className="px-4 py-3 font-semibold text-[#0F1B2D]">{t.name}</td>
                    <td className="px-4 py-3 text-[#4A5568]">{t.type}</td>
                    <td className="px-4 py-3 text-[#4A5568]">{t.usedIn} active positions</td>
                    <td className="px-4 py-3">
                      <StageChip stage={t.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-2">
                        <button
                          type="button"
                          onClick={() => setPreviewTemplate(t)}
                          className="text-[#806236] hover:underline"
                        >
                          Preview
                        </button>
                        <button
                          type="button"
                          onClick={() => showToast(`Template "${t.name}" copied!`)}
                          className="text-[#806236] hover:underline"
                        >
                          Use
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </EmployerShell>
  );
}
