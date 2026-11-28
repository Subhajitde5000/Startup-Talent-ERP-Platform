'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { StartupSidebar, SubNavTabs, NoStartupOrg } from '../../../components';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api/client';
import {
  ErrorState,
  LoadingState,
  errorMessage,
} from './startup-hiring-shared';
import {
  StartupApplicantDetailView,
  StartupJobDetailView,
  StartupJobEditorView,
  StartupOverviewView,
} from './startup-jobs-views';
import {
  ScheduleInterviewModal,
  StartupInterviewsView,
  StartupOffersView,
} from './startup-interviews-offers-views';
import {
  StartupEmployerPageView,
  StartupRequestView,
  StartupRequestsCard,
  StartupTalentView,
} from './startup-talent-requests-employer-views';
import { Search, Bell, ChevronDown, Menu } from 'lucide-react';

export default function Hiring({ page = 'overview', jobId, applicantId }) {
  const { user } = useAuth();
  const [startupOrg, setStartupOrg] = useState(null);
  const [orgState, setOrgState] = useState('loading');
  const [orgError, setOrgError] = useState('');
  const [orgReloadKey, setOrgReloadKey] = useState(0);
  const [scheduleTarget, setScheduleTarget] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    setOrgState('loading');
    setOrgError('');
    api.organizations
      .mine(controller.signal)
      .then((orgs) => {
        if (controller.signal.aborted) return;
        const found = (orgs || []).find((o) => o.type === 'startup') || null;
        setStartupOrg(found);
        setOrgState(found ? 'ready' : 'empty');
      })
      .catch((e) => {
        if (controller.signal.aborted) return;
        setOrgError(errorMessage(e, 'Could not load your startup organization.'));
        setOrgState('error');
      });
    return () => controller.abort();
  }, [orgReloadKey]);

  const [toast, setToast] = useState('');
  const [mobileNav, setMobileNav] = useState(false);
  const [compact, setCompact] = useState(false);

  const notify = (s) => {
    setToast(s);
    setTimeout(() => setToast(''), 2700);
  };

  const is = (x) => page === x;

  const pageHead = (title, sub, actions) => (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-sm text-[#4A5568]">
          {startupOrg?.name || 'Startup'} <span className="mx-2 text-[#B8955A]">·</span> Hiring
        </p>
        <h1 className="serif mt-1 text-[30px] font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-[#4A5568]">{sub}</p>
      </div>
      <div className="flex flex-wrap gap-2">{actions}</div>
    </div>
  );

  const userName = user?.display_name || 'Startup member';
  const userInitials = userName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('') || 'SM';
  // Every view below needs the startup org (7r/7s/7t are all wired).
  const isOrgGated =
    is('overview') ||
    is('editor') ||
    is('job') ||
    is('candidate') ||
    is('interviews') ||
    is('offers') ||
    is('talent') ||
    is('request') ||
    is('employer');

  return (
    <div className="min-h-screen bg-[#FAF8F4] text-[#0F1B2D]">
      <a href="#hiring-main" className="sr-only focus:not-sr-only">Skip to content</a>

      {/* Shared Startup Sidebar */}
      <StartupSidebar
        active="Hiring"
        compact={compact}
        setCompact={setCompact}
        mobileOpen={mobileNav}
        setMobileOpen={setMobileNav}
        onAction={notify}
      />

      {/* Header */}
      <header className={`sticky top-0 z-10 flex h-[68px] items-center justify-between border-b border-[#E5E1D8] bg-[#FAF8F4]/95 px-4 backdrop-blur transition-[margin] duration-200 sm:px-7 ${compact ? 'lg:ml-[76px]' : 'lg:ml-[240px]'}`}>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileNav(true)}
            className="grid h-9 w-9 place-items-center rounded-lg border border-[#E5E1D8] bg-white text-ink lg:hidden"
            aria-label="Open navigation menu"
          >
            <Menu size={18} />
          </button>
          <div className="relative hidden sm:block">
            <Search className="absolute left-3 top-2.5 text-[#A0A7B4]" size={17} />
            <input placeholder="Search workspace" className="h-10 w-64 rounded-lg border border-[#E5E1D8] bg-white pl-9 text-sm" />
          </div>
          <Link href="/startup/dashboard" className="text-sm font-semibold sm:hidden">
            ← Dashboard
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => notify('You’re all caught up.')}
            aria-label="Notifications"
            className="relative grid h-10 w-10 place-items-center"
          >
            <Bell size={19} />
            <i className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#B8955A]" />
          </button>
          <span className="flex items-center gap-2 text-xs">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-ink font-semibold text-white">{userInitials}</span>
            <span className="hidden sm:block">{userName}</span>
            <ChevronDown size={14} />
          </span>
        </div>
      </header>

      <main id="hiring-main" className={`mx-auto max-w-[1440px] px-4 pb-16 pt-7 transition-[margin] duration-200 sm:px-7 lg:px-8 ${compact ? 'lg:ml-[76px]' : 'lg:ml-[240px]'}`}>
        {/* Secondary hiring navigation */}
        <SubNavTabs
          items={[
            ['Overview', '/startup/hiring', page === 'overview'],
            ['Talent search', '/startup/hiring/talent', page === 'talent'],
            ['Interviews', '/startup/hiring/interviews', page === 'interviews'],
            ['Offers', '/startup/hiring/offers', page === 'offers'],
            ['Employer page', '/startup/hiring/employer-page', page === 'employer'],
          ]}
        />
        {isOrgGated && orgState === 'loading' ? (
          <LoadingState label="Loading startup workspace…" />
        ) : isOrgGated && orgState === 'error' ? (
          <ErrorState message={orgError} onRetry={() => setOrgReloadKey((k) => k + 1)} />
        ) : isOrgGated && orgState === 'empty' ? (
          <NoStartupOrg />
        ) : (
        <>
        {is('overview') && startupOrg && (
          <StartupOverviewView
            org={startupOrg}
            myRole={startupOrg.my_role}
            pageHead={pageHead}
            notify={notify}
            requestsFallback={
              <StartupRequestsCard org={startupOrg} myRole={startupOrg.my_role} notify={notify} />
            }
          />
        )}

        {is('request') && startupOrg && (
          <StartupRequestView
            org={startupOrg}
            myRole={startupOrg.my_role}
            pageHead={pageHead}
            notify={notify}
          />
        )}

        {is('editor') && startupOrg && (
          <StartupJobEditorView
            org={startupOrg}
            myRole={startupOrg.my_role}
            pageHead={pageHead}
            notify={notify}
          />
        )}

        {is('job') && startupOrg && (
          <StartupJobDetailView
            org={startupOrg}
            myRole={startupOrg.my_role}
            jobId={jobId}
            pageHead={pageHead}
            notify={notify}
          />
        )}

        {is('candidate') && startupOrg && (
          <StartupApplicantDetailView
            org={startupOrg}
            myRole={startupOrg.my_role}
            jobId={jobId}
            applicantId={applicantId}
            pageHead={pageHead}
            notify={notify}
            onOpenScheduleModal={(target) => setScheduleTarget(target)}
          />
        )}

        {is('talent') && startupOrg && (
          <StartupTalentView
            org={startupOrg}
            myRole={startupOrg.my_role}
            pageHead={pageHead}
            notify={notify}
          />
        )}

        {is('interviews') && startupOrg && (
          <StartupInterviewsView
            org={startupOrg}
            myRole={startupOrg.my_role}
            pageHead={pageHead}
            notify={notify}
          />
        )}

        {is('offers') && startupOrg && (
          <StartupOffersView
            org={startupOrg}
            myRole={startupOrg.my_role}
            pageHead={pageHead}
            notify={notify}
          />
        )}

        {is('employer') && startupOrg && (
          <StartupEmployerPageView
            org={startupOrg}
            myRole={startupOrg.my_role}
            pageHead={pageHead}
            notify={notify}
            onOrgUpdated={(updated) =>
              setStartupOrg((current) => ({ ...current, ...updated, my_role: current?.my_role }))
            }
          />
        )}
        </>
        )}
      </main>

      {scheduleTarget && startupOrg && (
        <ScheduleInterviewModal
          orgId={startupOrg.id}
          initialJobId={scheduleTarget.jobId}
          initialApplicationId={scheduleTarget.applicationId}
          onClose={() => setScheduleTarget(null)}
          notify={notify}
        />
      )}

      {/* Toast */}
      {toast && (
        <div role="status" aria-live="polite" className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-lg bg-ink px-4 py-3 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
