'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Info } from 'lucide-react';
import MentorPageShell from '../../mentor-page-shell';
import { Btn, Card } from '../../mentor-data';
import { api, ApiError } from '@/lib/api/client';
import { ErrorBlock, LoadingBlock } from '@/components/async-state';
import { formatDate, formatInstant, formatMoney } from '@/lib/mentorship-labels';
import {
  AGREEMENT_CADENCE_LABEL,
  AGREEMENT_TYPE_LABEL,
  AgreementTermsDialog,
  SignAgreementDialog,
  TerminateAgreementDialog,
  agreementEquityText,
  agreementFeeText,
  agreementStatusChip,
  agreementStatusLabel,
} from '@/components/agreement-ui';

function durationText(a) {
  if (!a.starts_on && !a.ends_on) return 'Open-ended';
  return `${a.starts_on ? formatDate(a.starts_on) : 'Open start'} – ${a.ends_on ? formatDate(a.ends_on) : 'open-ended'}`;
}

function nextActionText(a) {
  if (a.status === 'draft') return 'Draft — the startup cannot see it until you send it.';
  if (a.status === 'sent') {
    if (a.can_sign) return 'Waiting for your signature.';
    if (a.mentor_signed_at) return 'You have signed. Waiting for the startup to sign.';
    return 'Awaiting signatures. Signing is possible while the mentorship is active.';
  }
  if (a.status === 'signed') {
    if (a.phase === 'scheduled') return `Signed by both sides. Takes effect on ${formatDate(a.starts_on)}.`;
    if (a.phase === 'expired') return `Signed by both sides. Ended on ${formatDate(a.ends_on)}.`;
    return 'Signed by both sides and in force. New sessions use these terms.';
  }
  if (a.status === 'superseded') return 'Replaced by a newer version.';
  return `Ended on ${formatDate(a.ended_at)}${a.end_reason ? `: ${a.end_reason}` : '.'}`;
}

export default function MentorAgreementDetailPage() {
  const params = useParams();
  const router = useRouter();
  const agreementId = params?.agreementId;

  const [toast, setToast] = useState('');
  const [modal, setModal] = useState('');
  const [agreement, setAgreement] = useState(null);
  const [history, setHistory] = useState(null);
  const [phase, setPhase] = useState('loading'); // loading|ready|error|notfound
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);

  const notify = (x) => {
    setToast(x);
    setTimeout(() => setToast(''), 2700);
  };

  useEffect(() => {
    if (!agreementId) { setPhase('notfound'); return undefined; }
    const controller = new AbortController();
    setPhase('loading');
    setError('');
    (async () => {
      try {
        const a = await api.agreements.get(agreementId, controller.signal);
        const h = await api.agreements.forMentorship(a.mentorship_id, { limit: 50 }, controller.signal);
        if (controller.signal.aborted) return;
        setAgreement(a);
        setHistory(h.items);
        setPhase('ready');
      } catch (err) {
        if (controller.signal.aborted) return;
        if (err instanceof ApiError && err.status === 404) setPhase('notfound');
        else { setError(err instanceof ApiError ? err.message : 'Could not load this agreement.'); setPhase('error'); }
      }
    })();
    return () => controller.abort();
  }, [agreementId, revision]);

  const after = (a, msg) => {
    setModal('');
    notify(msg);
    if (a && a.id !== agreementId) router.push(`/mentor/agreements/${a.id}`);
    else setRevision((n) => n + 1);
  };

  const run = async (fn, msg) => {
    setBusy(true);
    try { await fn(); notify(msg); setRevision((n) => n + 1); }
    catch (err) { notify(err instanceof ApiError ? err.message : 'Something went wrong.'); }
    finally { setBusy(false); }
  };

  const discard = async () => {
    if (!window.confirm('Discard this draft? It has not been shared with the startup.')) return;
    setBusy(true);
    try { await api.agreements.discard(agreement.id); notify('Draft discarded.'); router.push('/mentor/agreements'); }
    catch (err) { notify(err instanceof ApiError ? err.message : 'Could not discard the draft.'); setBusy(false); }
  };

  const disclaimer = (
    <p className="mt-5 flex items-start gap-2 text-xs leading-4 text-[#4A5568]">
      <Info size={13} className="mt-0.5 shrink-0" />
      The platform records agreement terms and payment activity; it does not provide tax, legal or
      accounting advice. Confirm obligations with a qualified professional.
    </p>
  );

  const a = agreement;
  const fee = a?.fee_breakdown;
  const startupName = a?.party?.startup_name || 'Startup';
  const canPropose = a && (a.status === 'signed' || a.status === 'sent') && a.phase !== 'expired';

  return (
    <MentorPageShell
      active="Agreements"
      backHref="/mentor/agreements"
      backLabel="← Agreements"
      toast={toast}
      notify={notify}
    >
      {phase === 'loading' && <LoadingBlock label="Loading agreement…" rows={4} />}
      {phase === 'error' && <ErrorBlock message={error} onRetry={() => setRevision((n) => n + 1)} />}
      {phase === 'notfound' && (
        <Card title="Agreement not found">
          <p className="text-xs text-[#4A5568]">
            This agreement does not exist or you do not have permission to see it.
          </p>
          <Link href="/mentor/agreements" className="mt-4 inline-block text-xs font-semibold text-[#9A7A45]">
            ← Back to agreements
          </Link>
        </Card>
      )}

      {phase === 'ready' && a && (
        <>
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-[#4A5568]">
                Mentor workspace <span className="mx-2 text-[#B8955A]">·</span> Money & agreements
              </p>
              <h1 className="serif mt-1 text-[30px] font-semibold text-[#0F1B2D]">
                {startupName} · Agreement
              </h1>
              <p className="mt-1 text-sm text-[#4A5568]">
                {agreementStatusLabel(a)} · {a.version ? `Version ${a.version}` : 'Not sent yet'}
                {a.starts_on ? ` · Starts ${formatDate(a.starts_on)}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/mentor/agreements"
                className="inline-flex min-h-10 items-center rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs font-semibold text-[#0F1B2D] hover:bg-[#FAF8F4]"
              >
                ← Agreements
              </Link>
              {a.can_edit && (
                <>
                  <Btn secondary disabled={busy} onClick={discard}>Discard draft</Btn>
                  <Btn secondary disabled={busy} onClick={() => setModal('edit')}>Edit draft</Btn>
                  <Btn disabled={busy} onClick={() => run(() => api.agreements.send(a.id), 'Proposal sent for signature.')}>Send for signature</Btn>
                </>
              )}
              {a.can_sign && <Btn onClick={() => setModal('sign')}>Review & sign</Btn>}
              {canPropose && <Btn secondary={a.can_sign} onClick={() => setModal('change')}>Propose change</Btn>}
              {a.can_terminate && <Btn danger onClick={() => setModal('terminate')}>End agreement</Btn>}
            </div>
          </div>

          <div className="grid items-start gap-5 xl:grid-cols-3">
            <div className="space-y-5 xl:col-span-2">
              <Card title="Agreement summary">
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    ['Status', agreementStatusLabel(a)],
                    ['Fee model', agreementFeeText(a)],
                    ['Cadence', a.cadence ? AGREEMENT_CADENCE_LABEL[a.cadence] : 'Not fixed'],
                    ['Duration', durationText(a)],
                    ['Equity / advisory share', agreementEquityText(a)],
                    ['Agreement type', AGREEMENT_TYPE_LABEL[a.agreement_type] || a.agreement_type],
                  ].map(([x, y]) => (
                    <div key={x} className="rounded-lg bg-[#FAF8F4] p-3">
                      <small className="text-xs text-[#4A5568]">{x}</small>
                      <b className="mt-1 block text-sm text-[#0F1B2D]">{y}</b>
                    </div>
                  ))}
                </div>
              </Card>

              <Card title="Fees and payments">
                {fee ? (
                  <>
                    <div className="divide-y divide-[#E5E1D8] text-xs">
                      {[
                        ['Session fee', formatMoney(fee.gross_amount, fee.currency)],
                        ['Platform commission', `− ${formatMoney(fee.commission_amount, fee.currency)}`],
                        ['TDS', `− ${formatMoney(fee.tds_amount, fee.currency)}`],
                        ['Net to mentor', formatMoney(fee.net_amount, fee.currency)],
                      ].map(([x, y]) => (
                        <div key={x} className="flex justify-between py-3">
                          <span className="text-[#4A5568]">{x}</span>
                          <b className="text-[#0F1B2D]">{y}</b>
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-[#4A5568]">
                      Per session at the current platform rates · Payment after session completion and release period.
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-[#4A5568]">Pro bono — sessions under this agreement carry no fee.</p>
                )}
              </Card>

              <Card title="Scope & responsibilities">
                {a.terms ? (
                  <p className="whitespace-pre-wrap text-xs leading-5 text-[#0F1B2D]">{a.terms}</p>
                ) : (
                  <p className="text-xs text-[#4A5568]">No written scope was recorded for this version.</p>
                )}
              </Card>

              <Card title="Confidentiality & conduct">
                <p className="text-xs leading-5 text-[#4A5568]">
                  Confidentiality applies to shared startup documents. Conflicts of interest must be
                  disclosed. Sign-offs must be based on evidence reviewed and cannot be exchanged for
                  benefits.
                </p>
              </Card>

              <Card title="Acceptance & version history">
                <p className="text-xs text-[#0F1B2D]">
                  Mentor: {a.mentor_signed_at ? `signed ${formatInstant(a.mentor_signed_at)}` : 'not signed'}
                  {' · '}Startup: {a.startup_signed_at ? `signed ${formatInstant(a.startup_signed_at)}${a.startup_signed_by_name ? ` by ${a.startup_signed_by_name}` : ''}` : 'not signed'}
                </p>
                <div className="mt-3 space-y-2">
                  {(history || []).map((v) => (
                    <p key={v.id} className={`text-xs ${v.id === a.id ? 'font-semibold text-[#0F1B2D]' : 'text-[#4A5568]'}`}>
                      {v.id === a.id ? (
                        <span>{v.version ? `Version ${v.version}` : 'Draft'}</span>
                      ) : (
                        <Link href={`/mentor/agreements/${v.id}`} className="hover:underline">{v.version ? `Version ${v.version}` : 'Draft'}</Link>
                      )}
                      {' · '}{agreementStatusLabel(v)}
                      {' · '}Proposed by {v.proposed_by_side === 'mentor' ? 'you' : v.party?.startup_name || 'the startup'}
                      {v.sent_at ? ` · sent ${formatDate(v.sent_at)}` : ''}
                      {v.change_reason ? ` · ${v.change_reason}` : ''}
                    </p>
                  ))}
                </div>
              </Card>
            </div>

            <aside className="space-y-5">
              <Card title="Status & next action">
                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${agreementStatusChip(a)}`}>
                  {agreementStatusLabel(a)}
                </span>
                <p className="mt-3 text-xs text-[#4A5568]">{nextActionText(a)}</p>
                <Link
                  href={`/mentor/startups/${a.mentorship_id}`}
                  className="mt-3 inline-block text-xs font-semibold text-[#9A7A45]"
                >
                  Open mentorship workspace <ArrowRight className="inline" size={12} />
                </Link>
              </Card>

              <Card title="Linked records">
                <p className="text-xs text-[#0F1B2D]">
                  {a.linked_records.completed_sessions} completed session{a.linked_records.completed_sessions === 1 ? '' : 's'}
                  {' · '}{formatMoney(a.linked_records.billed_amount, a.linked_records.currency)} billed under this version
                </p>
                <Link
                  href="/mentor/earnings"
                  className="mt-3 inline-block text-xs font-semibold text-[#9A7A45]"
                >
                  View earnings <ArrowRight className="inline" size={12} />
                </Link>
              </Card>

              <Card title="Need help?">
                <p className="text-xs text-[#4A5568]">
                  Review equity terms with a lawyer. The platform records agreement terms and does not give
                  legal advice.
                </p>
              </Card>
            </aside>
          </div>

          {disclaimer}

          {modal === 'edit' && (
            <AgreementTermsDialog title="Edit draft" mentorshipId={a.mentorship_id} draft={a} onClose={() => setModal('')} onDone={after} />
          )}
          {modal === 'change' && (
            <AgreementTermsDialog title="Propose agreement change" mentorshipId={a.mentorship_id} basis={a} onClose={() => setModal('')} onDone={after} />
          )}
          {modal === 'sign' && <SignAgreementDialog agreement={a} onClose={() => setModal('')} onDone={after} />}
          {modal === 'terminate' && <TerminateAgreementDialog agreement={a} onClose={() => setModal('')} onDone={after} />}
        </>
      )}
    </MentorPageShell>
  );
}
