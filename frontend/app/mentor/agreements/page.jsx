'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Info } from 'lucide-react';
import MentorPageShell from '../mentor-page-shell';
import { Btn, Card } from '../mentor-data';
import { api, ApiError } from '@/lib/api/client';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/async-state';
import { formatDate } from '@/lib/mentorship-labels';
import {
  AGREEMENT_TYPE_LABEL,
  AgreementTermsDialog,
  SignAgreementDialog,
  agreementEquityText,
  agreementStatusChip,
  agreementStatusLabel,
  agreementTermsText,
} from '@/components/agreement-ui';

const PAGE_SIZE = 20;

// Each tab is one server-side filter of GET /mentor/agreements.
const TABS = {
  Active: { status: 'signed' },
  'Awaiting you': { awaiting_me: true },
  'Proposed by you': { proposed_by_me: true },
  Ended: { status: 'terminated' },
  All: {},
};

export default function MentorAgreementsPage() {
  const router = useRouter();
  const [toast, setToast] = useState('');
  const [agreementTab, setAgreementTab] = useState('Active');
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [modal, setModal] = useState('');
  const [selected, setSelected] = useState(null);
  const [engagements, setEngagements] = useState(null);
  const [engagementError, setEngagementError] = useState('');

  const notify = (x) => {
    setToast(x);
    setTimeout(() => setToast(''), 2700);
  };

  useEffect(() => {
    const controller = new AbortController();
    setPage(null);
    setError('');
    api.agreements
      .mine({ ...TABS[agreementTab], limit: PAGE_SIZE, offset }, controller.signal)
      .then((r) => { if (!controller.signal.aborted) setPage(r); })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e instanceof ApiError ? e.message : 'Could not load agreements.');
      });
    return () => controller.abort();
  }, [agreementTab, offset, revision]);

  // Agreements can be drafted only for an active or paused engagement.
  const openNew = async () => {
    setModal('new');
    setEngagements(null);
    setEngagementError('');
    try {
      const [active, paused] = await Promise.all([
        api.mentorships.list({ side: 'mentor', status: 'active', limit: 50 }),
        api.mentorships.list({ side: 'mentor', status: 'paused', limit: 50 }),
      ]);
      setEngagements([...active.items, ...paused.items]);
    } catch (e) {
      setEngagementError(e instanceof ApiError ? e.message : 'Could not load your mentorships.');
    }
  };

  const disclaimer = (
    <p className="mt-5 flex items-start gap-2 text-xs leading-4 text-[#4A5568]">
      <Info size={13} className="mt-0.5 shrink-0" />
      The platform records agreement terms and payment activity; it does not provide tax, legal or
      accounting advice. Confirm obligations with a qualified professional.
    </p>
  );

  const items = page?.items || [];

  return (
    <MentorPageShell active="Agreements" toast={toast} notify={notify}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-[#4A5568]">
            Mentor workspace <span className="mx-2 text-[#B8955A]">·</span> Money & agreements
          </p>
          <h1 className="serif mt-1 text-[30px] font-semibold text-[#0F1B2D]">
            Agreements
          </h1>
          <p className="mt-1 text-sm text-[#4A5568]">
            Review the written terms for each mentorship.
          </p>
        </div>
        <Btn secondary onClick={openNew}>
          <Plus size={14} /> New agreement
        </Btn>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {Object.keys(TABS).map((x) => (
          <button
            type="button"
            key={x}
            onClick={() => { setAgreementTab(x); setOffset(0); }}
            className={`min-h-10 shrink-0 rounded-lg px-3 text-xs font-medium transition-colors ${
              agreementTab === x
                ? 'bg-[#0F1B2D] text-white'
                : 'border border-[#E5E1D8] bg-white text-[#4A5568] hover:bg-[#FAF8F4]'
            }`}
          >
            {x}
          </button>
        ))}
      </div>

      <Card title={`${agreementTab} agreements`}>
        {error ? (
          <ErrorBlock message={error} onRetry={() => setRevision((n) => n + 1)} />
        ) : !page ? (
          <LoadingBlock label="Loading agreements…" rows={3} />
        ) : items.length === 0 ? (
          <EmptyBlock
            title="No agreements here"
            hint={agreementTab === 'Awaiting you'
              ? 'Nothing is waiting for your signature.'
              : 'Agreements you draft, send or sign with your startups appear here.'}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-left text-xs">
                <thead className="border-b border-[#E5E1D8] text-[#4A5568]">
                  <tr>
                    {[
                      'Startup',
                      'Agreement type',
                      'Key terms',
                      'Equity / advisory',
                      'Start date',
                      'Status',
                      'Last updated',
                      '',
                    ].map((x) => (
                      <th key={x} className="py-3 font-medium">
                        {x}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((a) => (
                    <tr key={a.id} className="border-b border-[#E5E1D8]">
                      <td className="py-4 font-semibold text-[#0F1B2D]">{a.party?.startup_name || 'Startup'}</td>
                      <td className="text-[#4A5568]">{AGREEMENT_TYPE_LABEL[a.agreement_type] || a.agreement_type}</td>
                      <td className="text-[#0F1B2D]">{agreementTermsText(a)}</td>
                      <td className="text-[#4A5568]">{agreementEquityText(a)}</td>
                      <td className="text-[#4A5568]">{a.starts_on ? formatDate(a.starts_on) : '—'}</td>
                      <td>
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${agreementStatusChip(a)}`}>
                          {agreementStatusLabel(a)}
                        </span>
                      </td>
                      <td className="text-[#4A5568]">{formatDate(a.updated_at)}</td>
                      <td className="flex items-center gap-2 py-4">
                        <Link
                          href={`/mentor/agreements/${a.id}`}
                          className="font-semibold text-[#9A7A45]"
                        >
                          Open
                        </Link>
                        {a.can_sign && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelected(a);
                              setModal('sign');
                            }}
                            className="font-semibold text-[#0F1B2D] hover:underline"
                          >
                            Review & sign
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {page.total > PAGE_SIZE && (
              <div className="mt-3 flex items-center gap-3 text-xs text-[#4A5568]">
                <button type="button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))} className="font-semibold disabled:opacity-40">Previous</button>
                <span>{offset + 1}–{offset + items.length} of {page.total}</span>
                <button type="button" disabled={offset + items.length >= page.total} onClick={() => setOffset(offset + PAGE_SIZE)} className="font-semibold disabled:opacity-40">Next</button>
              </div>
            )}
          </>
        )}
      </Card>

      {disclaimer}

      {modal === 'new' && (
        engagements && engagements.length > 0 ? (
          <AgreementTermsDialog
            title="New agreement"
            mentorships={engagements}
            onClose={() => setModal('')}
            onDone={(a, msg) => { setModal(''); notify(msg); router.push(`/mentor/agreements/${a.id}`); }}
          />
        ) : (
          <div className="fixed inset-0 z-40 grid place-items-center bg-[#0F1B2D]/45 p-4">
            <section role="dialog" aria-modal="true" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
              <h2 className="serif mb-4 text-2xl font-semibold text-[#0F1B2D]">New agreement</h2>
              {engagementError ? (
                <ErrorBlock message={engagementError} onRetry={openNew} />
              ) : !engagements ? (
                <LoadingBlock label="Loading your mentorships…" />
              ) : (
                <EmptyBlock title="No active mentorships" hint="Agreements can be drafted once a mentorship is active or paused." />
              )}
              <div className="mt-6 flex justify-end">
                <button type="button" onClick={() => setModal('')} className="min-h-10 px-4 text-sm font-medium text-[#4A5568] hover:text-[#0F1B2D]">Close</button>
              </div>
            </section>
          </div>
        )
      )}

      {modal === 'sign' && selected && (
        <SignAgreementDialog
          agreement={selected}
          onClose={() => setModal('')}
          onDone={(_, msg) => { setModal(''); notify(msg); setRevision((n) => n + 1); }}
        />
      )}
    </MentorPageShell>
  );
}
