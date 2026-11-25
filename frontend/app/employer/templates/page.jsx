'use client';

import React, { Suspense, useState, useMemo } from 'react';
import {useSearchParams} from 'next/navigation';
import {HiringPage, useJobsWorkspace} from '@/components/hiring-ui';
import {ScorecardTemplates} from '@/components/hiring-scorecards';
import {OnboardingTemplates} from '@/components/hiring-onboarding';
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
  return <Suspense fallback={<p>Loading templates…</p>}><TemplatesRoute/></Suspense>;
}
function TemplatesRoute() {
  const category = useSearchParams().get('category');
  return ['scorecards', 'onboarding'].includes(category)
    ? <HiringPage><LiveTemplates category={category}/></HiringPage>
    : <OtherTemplates/>;
}
function LiveTemplates({category}) {
  const {href} = useJobsWorkspace();
  return <>
    <nav className="flex flex-wrap gap-3 text-xs underline">
      <Link href={href('/employer/templates?category=scorecards')}>Scorecards</Link>
      <Link href={href('/employer/templates?category=onboarding')}>Onboarding</Link>
      <Link href="/employer/templates">Other template categories (demo)</Link>
    </nav>
    {category === 'scorecards' ? <ScorecardTemplates/> : <OnboardingTemplates/>}
  </>;
}
function OtherTemplates() {
  const [activeTab, setActiveTab] = useState('All');
  const [viewMode, setViewMode] = useState('cards');
  const [searchQuery, setSearchQuery] = useState('');
  const [templatesList, setTemplatesList] = useState(initialTemplates.filter(t=>t.type!=='Scorecards'));
  const [toastMessage, setToastMessage] = useState(null);

  // New Template Modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState('Job posts');
  const [newDesc, setNewDesc] = useState('');

  // Preview Modal
  const [previewTemplate, setPreviewTemplate] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleCreateTemplate = (e) => {
    e.preventDefault();
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
    'Onboarding',
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

              <div className="flex justify-end gap-2 pt-2">
                <EmployerBtn variant="secondary" size="sm" onClick={() => setShowNewModal(false)}>
                  Cancel
                </EmployerBtn>
                <EmployerBtn type="submit" variant="primary" size="sm">
                  Save Template
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
                  {previewTemplate.type} · {previewTemplate.version}
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
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <EmployerBtn variant="secondary" size="sm" onClick={() => setPreviewTemplate(null)}>
                Close Preview
              </EmployerBtn>
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

        {/* KPIs */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {templateKpis.map((k, idx) => (
            <div key={idx} className="rounded-2xl border border-[#E5E1D8] bg-white p-5 shadow-sm">
              <span className="text-xs font-semibold text-[#4A5568]">{k.label}</span>
              <p className="font-serif text-2xl font-bold text-[#0F1B2D] mt-1">{k.value}</p>
              <p className="text-xs text-[#806236] mt-1">Platform verified</p>
            </div>
          ))}
        </div>

        {/* Filters and View Switcher */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[#E5E1D8] pb-3">
          <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {tabs.map((tab) => {
              const active = activeTab === tab;
              if (['Scorecards','Onboarding'].includes(tab)) return <Link key={tab} className="whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium text-[#806236] underline" href={`/employer/templates?category=${tab.toLowerCase()}`}>{tab}</Link>;
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
        {viewMode === 'cards' ? (
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
