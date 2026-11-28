'use client';

// Step 8g: agreement labels and dialogs shared by the mentor agreement pages
// and the agreement card in the startup workspace. Every action goes through
// `api.agreements`; permissions come from the server's can_edit / can_sign /
// can_terminate flags, never from a client-side guess.

import { useState } from 'react';
import { X } from 'lucide-react';
import { api, ApiError } from '@/lib/api/client';
import { FieldError, fieldErrorsFrom } from '@/components/async-state';
import { formatDate, formatMoney } from '@/lib/mentorship-labels';

export const AGREEMENT_TYPE_LABEL = { per_session: 'Per session', pro_bono: 'Pro bono' };
export const AGREEMENT_CADENCE_LABEL = { weekly: 'Weekly', fortnightly: 'Fortnightly', monthly: 'Monthly' };

/** One label per stored status, with the date-derived phase for signed rows. */
export function agreementStatusLabel(a) {
  if (!a) return '';
  if (a.status === 'signed') {
    if (a.phase === 'scheduled') return 'Signed · starts later';
    if (a.phase === 'expired') return 'Expired';
    return 'Active';
  }
  return { draft: 'Draft', sent: 'Awaiting signature', superseded: 'Superseded', terminated: 'Ended' }[a.status] || a.status;
}

export function agreementStatusChip(a) {
  if (!a) return 'bg-[#F3F4F6] text-[#4A5568]';
  if (a.status === 'signed' && a.phase !== 'expired') return 'bg-[#E7F3EC] text-[#286749]';
  if (a.status === 'sent' || a.status === 'draft') return 'bg-[#FFF3D6] text-[#8A5700]';
  return 'bg-[#F3F4F6] text-[#4A5568]';
}

export function agreementFeeText(a) {
  if (!a) return '';
  if (a.agreement_type === 'pro_bono') return 'No fee';
  return `${formatMoney(a.fee_amount, a.currency) || `${a.currency} ${a.fee_amount}`} / session`;
}

/** "₹3,000 / session · Fortnightly · 21 Oct 2026 – 21 Apr 2027" */
export function agreementTermsText(a) {
  if (!a) return '';
  const parts = [agreementFeeText(a)];
  if (a.cadence) parts.push(AGREEMENT_CADENCE_LABEL[a.cadence] || a.cadence);
  if (a.starts_on || a.ends_on) {
    parts.push(`${a.starts_on ? formatDate(a.starts_on) : 'Open start'} – ${a.ends_on ? formatDate(a.ends_on) : 'open-ended'}`);
  }
  return parts.join(' · ');
}

export function agreementEquityText(a) {
  if (!a || a.equity_pct == null || Number(a.equity_pct) === 0) return 'None';
  return `${Number(a.equity_pct)}% advisory equity`;
}

function Dialog({ title, onClose, children, footer }) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-[#0F1B2D]/45 p-4">
      <section role="dialog" aria-modal="true" aria-label={title} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="serif text-2xl font-semibold text-[#0F1B2D]">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-[#4A5568] hover:text-[#0F1B2D]">
            <X size={18} />
          </button>
        </div>
        {children}
        <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div>
      </section>
    </div>
  );
}

const inputCls = 'mt-2 h-10 w-full rounded-lg border border-[#E5E1D8] bg-white px-3 text-sm focus:outline-none disabled:bg-[#F4F1EA]';
const primaryCls = 'min-h-10 rounded-lg bg-[#0F1B2D] px-4 text-sm font-semibold text-white hover:bg-[#1C2B42] disabled:opacity-60';
const secondaryCls = 'min-h-10 rounded-lg border border-[#E5E1D8] bg-white px-4 text-sm font-semibold text-[#0F1B2D] hover:bg-[#F4F1EA] disabled:opacity-60';
const cancelCls = 'min-h-10 px-4 text-sm font-medium text-[#4A5568] hover:text-[#0F1B2D]';

function formFrom(a, keepReason) {
  return {
    agreement_type: a?.agreement_type || 'per_session',
    fee_amount: a?.fee_amount != null ? String(Number(a.fee_amount)) : '',
    currency: a?.currency || 'INR',
    equity_pct: a?.equity_pct != null && Number(a.equity_pct) !== 0 ? String(Number(a.equity_pct)) : '',
    cadence: a?.cadence || '',
    starts_on: a?.starts_on || '',
    ends_on: a?.ends_on || '',
    terms: a?.terms || '',
    change_reason: keepReason ? a?.change_reason || '' : '',
  };
}

function bodyFrom(form) {
  const proBono = form.agreement_type === 'pro_bono';
  return {
    agreement_type: form.agreement_type,
    fee_amount: proBono || !form.fee_amount.trim() ? null : form.fee_amount.trim(),
    currency: form.currency.trim().toUpperCase() || 'INR',
    equity_pct: form.equity_pct.trim() ? form.equity_pct.trim() : null,
    cadence: form.cadence || null,
    starts_on: form.starts_on || null,
    ends_on: form.ends_on || null,
    terms: form.terms.trim() || null,
    change_reason: form.change_reason.trim() || null,
  };
}

/**
 * Draft and (optionally) send a set of terms.
 *
 * - `draft`: edit that draft (PATCH) instead of creating one.
 * - `basis`: prefill from these terms (e.g. the version in force).
 * - `mentorships`: when given, the user picks which engagement first.
 *
 * If this side already has a draft (409 DRAFT_EXISTS) the dialog edits that
 * draft rather than failing, since the server allows one draft per side.
 */
export function AgreementTermsDialog({ title, mentorshipId, mentorships, draft, basis, onClose, onDone }) {
  const [form, setForm] = useState(() => formFrom(draft || basis, !!draft));
  const [pick, setPick] = useState(mentorshipId || mentorships?.[0]?.id || '');
  const [fields, setFields] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const proBono = form.agreement_type === 'pro_bono';

  const save = async (andSend) => {
    if (!pick) { setFields({ mentorship: 'Choose a mentorship.' }); return; }
    setBusy(andSend ? 'send' : 'save'); setError(''); setFields({});
    const body = bodyFrom(form);
    let saved = null;
    try {
      if (draft) {
        saved = await api.agreements.update(draft.id, body);
      } else {
        try {
          saved = await api.agreements.create(pick, body);
        } catch (err) {
          if (!(err instanceof ApiError && err.code === 'DRAFT_EXISTS')) throw err;
          const page = await api.agreements.forMentorship(pick, { status: 'draft', limit: 50 });
          const mine = page.items.find((a) => a.can_edit);
          if (!mine) throw err;
          saved = await api.agreements.update(mine.id, body);
        }
      }
      if (andSend) saved = await api.agreements.send(saved.id);
      onDone(saved, andSend ? 'Proposal sent for signature.' : 'Draft saved.');
    } catch (err) {
      const mapped = fieldErrorsFrom(err);
      setFields(mapped);
      const prefix = saved && andSend ? 'Saved as a draft, but not sent: ' : '';
      setError(Object.keys(mapped).length && !prefix ? '' : prefix + (err instanceof ApiError ? err.message : 'Could not save these terms.'));
    } finally {
      setBusy('');
    }
  };

  return (
    <Dialog
      title={title}
      onClose={onClose}
      footer={<>
        <button type="button" onClick={onClose} className={cancelCls}>Cancel</button>
        <button type="button" disabled={!!busy} onClick={() => save(false)} className={secondaryCls}>{busy === 'save' ? 'Saving…' : 'Save draft'}</button>
        <button type="button" disabled={!!busy} onClick={() => save(true)} className={primaryCls}>{busy === 'send' ? 'Sending…' : 'Send proposal'}</button>
      </>}
    >
      <div className="space-y-3 text-sm">
        {mentorships && (
          <label className="block font-medium text-[#0F1B2D]">
            Mentorship
            <select aria-label="Mentorship" value={pick} onChange={(e) => setPick(e.target.value)} className={inputCls}>
              {mentorships.map((m) => <option key={m.id} value={m.id}>{m.startup?.display_name || 'Startup'}</option>)}
            </select>
            <FieldError>{fields.mentorship}</FieldError>
          </label>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block font-medium text-[#0F1B2D]">
            Agreement type
            <select aria-label="Agreement type" value={form.agreement_type} onChange={set('agreement_type')} className={inputCls}>
              <option value="per_session">Per session</option>
              <option value="pro_bono">Pro bono</option>
            </select>
            <FieldError>{fields.agreement_type}</FieldError>
          </label>
          <label className="block font-medium text-[#0F1B2D]">
            Cadence
            <select aria-label="Cadence" value={form.cadence} onChange={set('cadence')} className={inputCls}>
              <option value="">Not fixed</option>
              <option value="weekly">Weekly</option>
              <option value="fortnightly">Fortnightly</option>
              <option value="monthly">Monthly</option>
            </select>
            <FieldError>{fields.cadence}</FieldError>
          </label>
          <label className="block font-medium text-[#0F1B2D]">
            Fee per session
            <input aria-label="Fee per session" inputMode="decimal" disabled={proBono} value={proBono ? '' : form.fee_amount} onChange={set('fee_amount')} placeholder={proBono ? 'No fee' : 'e.g. 3000'} className={inputCls} />
            <FieldError>{fields.fee_amount}</FieldError>
          </label>
          <label className="block font-medium text-[#0F1B2D]">
            Currency
            <input aria-label="Currency" maxLength={3} value={form.currency} onChange={set('currency')} className={inputCls} />
            <FieldError>{fields.currency}</FieldError>
          </label>
          <label className="block font-medium text-[#0F1B2D]">
            Starts on
            <input aria-label="Starts on" type="date" value={form.starts_on} onChange={set('starts_on')} className={inputCls} />
            <FieldError>{fields.starts_on}</FieldError>
          </label>
          <label className="block font-medium text-[#0F1B2D]">
            Ends on
            <input aria-label="Ends on" type="date" value={form.ends_on} onChange={set('ends_on')} className={inputCls} />
            <FieldError>{fields.ends_on}</FieldError>
          </label>
        </div>
        <label className="block font-medium text-[#0F1B2D]">
          Advisory equity (%, optional)
          <input aria-label="Advisory equity" inputMode="decimal" value={form.equity_pct} onChange={set('equity_pct')} placeholder="None" className={inputCls} />
          <FieldError>{fields.equity_pct}</FieldError>
        </label>
        <label className="block font-medium text-[#0F1B2D]">
          Scope and terms
          <textarea aria-label="Scope and terms" rows={3} maxLength={10000} value={form.terms} onChange={set('terms')} placeholder="Focus areas, expected outputs, anything both sides agree to" className="mt-2 w-full rounded-lg border border-[#E5E1D8] p-3 text-sm focus:outline-none" />
          <FieldError>{fields.terms}</FieldError>
        </label>
        <label className="block font-medium text-[#0F1B2D]">
          Reason for change (20–500 characters)
          <textarea aria-label="Reason for change" rows={2} maxLength={500} value={form.change_reason} onChange={set('change_reason')} placeholder="Required once terms have been sent before" className="mt-2 w-full rounded-lg border border-[#E5E1D8] p-3 text-sm focus:outline-none" />
          <FieldError>{fields.change_reason}</FieldError>
        </label>
        <p className="text-xs text-[#4A5568]">Sending replaces any proposal still awaiting signature. Equity terms should be reviewed with a lawyer.</p>
        {error && <p role="alert" className="text-xs font-medium text-[#B42318]">{error}</p>}
      </div>
    </Dialog>
  );
}

/** Sign a sent version. The server re-checks the password (403 REAUTH_FAILED). */
export function SignAgreementDialog({ agreement, onClose, onDone }) {
  const [password, setPassword] = useState('');
  const [read, setRead] = useState(false);
  const [legal, setLegal] = useState(false);
  const [fieldError, setFieldError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const hasEquity = agreement.equity_pct != null && Number(agreement.equity_pct) > 0;
  const ready = read && (!hasEquity || legal) && password.length > 0;

  const sign = async () => {
    setBusy(true); setError(''); setFieldError('');
    try {
      const signed = await api.agreements.sign(agreement.id, password);
      onDone(signed, signed.status === 'signed' ? 'Agreement signed by both sides.' : 'Your signature was recorded.');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'REAUTH_FAILED') setFieldError(err.message);
      else setError(err instanceof ApiError ? err.message : 'Could not sign this agreement.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      title="Review & sign agreement"
      onClose={onClose}
      footer={<>
        <button type="button" onClick={onClose} className={cancelCls}>Cancel</button>
        <button type="button" disabled={!ready || busy} onClick={sign} className={primaryCls}>{busy ? 'Signing…' : 'Sign agreement'}</button>
      </>}
    >
      <div className="space-y-4 text-sm">
        <p className="text-[#0F1B2D]">
          {agreement.viewer_side === 'mentor' ? 'Startup' : 'Mentor'}: <b>{agreement.viewer_side === 'mentor' ? agreement.party?.startup_name : agreement.party?.mentor_name}</b>
          {agreement.version ? <span className="text-[#4A5568]"> · Version {agreement.version}</span> : null}
        </p>
        <p className="text-[#4A5568]">{AGREEMENT_TYPE_LABEL[agreement.agreement_type]} · {agreementTermsText(agreement)}</p>
        <p className="text-[#4A5568]">Equity / advisory: {agreementEquityText(agreement)}</p>
        {agreement.change_reason && <p className="rounded-lg bg-[#FAF8F4] p-3 text-xs text-[#4A5568]">What changed: {agreement.change_reason}</p>}
        {agreement.terms && <p className="whitespace-pre-wrap rounded-lg border border-[#E5E1D8] p-3 text-xs text-[#4A5568]">{agreement.terms}</p>}
        <label className="flex items-center gap-2 text-xs text-[#4A5568]">
          <input type="checkbox" checked={read} onChange={(e) => setRead(e.target.checked)} className="accent-[#0F1B2D]" />
          I have read and understand the agreement terms.
        </label>
        {hasEquity && (
          <label className="flex items-center gap-2 text-xs text-[#4A5568]">
            <input type="checkbox" checked={legal} onChange={(e) => setLegal(e.target.checked)} className="accent-[#0F1B2D]" />
            I understand equity terms should be reviewed with a lawyer.
          </label>
        )}
        <label className="block font-medium text-[#0F1B2D]">
          Confirm your password
          <input aria-label="Current password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
          <FieldError>{fieldError}</FieldError>
        </label>
        {error && <p role="alert" className="text-xs font-medium text-[#B42318]">{error}</p>}
      </div>
    </Dialog>
  );
}

/** End a signed agreement with a reason (10–500 characters). */
export function TerminateAgreementDialog({ agreement, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [fields, setFields] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const end = async () => {
    setBusy(true); setError(''); setFields({});
    try {
      onDone(await api.agreements.terminate(agreement.id, reason.trim()), 'Agreement ended.');
    } catch (err) {
      const mapped = fieldErrorsFrom(err);
      setFields(mapped);
      setError(Object.keys(mapped).length ? '' : err instanceof ApiError ? err.message : 'Could not end this agreement.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      title="End agreement"
      onClose={onClose}
      footer={<>
        <button type="button" onClick={onClose} className={cancelCls}>Cancel</button>
        <button type="button" disabled={busy} onClick={end} className="min-h-10 rounded-lg bg-[#B42318] px-4 text-sm font-semibold text-white disabled:opacity-60">{busy ? 'Ending…' : 'End agreement'}</button>
      </>}
    >
      <p className="text-sm text-[#4A5568]">Sessions already completed keep the fee they were booked with. New sessions will no longer use these terms.</p>
      <label className="mt-3 block text-sm font-medium text-[#0F1B2D]">
        Reason (10–500 characters)
        <textarea aria-label="Reason" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} className="mt-2 w-full rounded-lg border border-[#E5E1D8] p-3 text-sm focus:outline-none" />
        <FieldError>{fields.reason}</FieldError>
      </label>
      {error && <p role="alert" className="mt-2 text-xs font-medium text-[#B42318]">{error}</p>}
    </Dialog>
  );
}

const SIGNER_ROLES = ['owner', 'admin'];

/**
 * Body of the "Agreement" card in the startup workspace. `summary` is the
 * workspace's `agreement` field: null means the caller may not see terms
 * (viewer). Owners/admins act; members read; every button is also gated by
 * the server's own flags.
 */
export function StartupAgreementPanel({ summary, mentorship, role, onChanged }) {
  const [modal, setModal] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!summary) {
    return <p className="text-xs text-[#4A5568]">Agreement terms are visible to owners, admins and members.</p>;
  }
  const { current, pending } = summary;
  const canAct = SIGNER_ROLES.includes(role) && (mentorship.status === 'active' || mentorship.status === 'paused');
  const done = (_, msg) => { setModal(''); onChanged(msg); };
  const send = async () => {
    setBusy(true); setError('');
    try { await api.agreements.send(pending.id); onChanged('Proposal sent for signature.'); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Could not send the draft.'); }
    finally { setBusy(false); }
  };
  const link = 'text-xs font-semibold text-[#9A7A45] disabled:opacity-50';

  return (
    <div className="text-xs">
      {current ? (
        <>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${agreementStatusChip(current)}`}>
            {agreementStatusLabel(current)} · Version {current.version}
          </span>
          <p className="mt-2 font-medium text-[#0F1B2D]">{agreementTermsText(current)}</p>
          <p className="mt-1 text-[#4A5568]">Equity: {agreementEquityText(current)}</p>
          {current.startup_signed_at && (
            <p className="mt-1 text-[#4A5568]">
              Signed {formatDate(current.startup_signed_at)}{current.startup_signed_by_name ? ` by ${current.startup_signed_by_name}` : ''}
            </p>
          )}
          {current.terms && <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-[#4A5568]">{current.terms}</p>}
        </>
      ) : (
        <p className="text-[#4A5568]">No agreement in force. Sessions use the fee set when each one is booked.</p>
      )}

      {pending && (
        <div className="mt-3 rounded-lg bg-[#FFF3D6] p-3 text-[#8A5700]">
          {pending.status === 'draft' ? (
            <p>Your team has an unsent draft: {agreementTermsText(pending)}</p>
          ) : (
            <p>
              Version {pending.version} proposed by {pending.proposed_by_side === 'mentor' ? pending.party?.mentor_name || 'your mentor' : 'your team'}
              {' · '}{agreementTermsText(pending)}
              {pending.startup_signed_at ? ' · your team has signed; waiting for the mentor' : ''}
              {pending.change_reason ? ` · ${pending.change_reason}` : ''}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-3">
            {pending.can_sign && <button type="button" onClick={() => setModal('sign')} className="font-semibold text-[#0F1B2D] underline">Review & sign</button>}
            {pending.can_edit && <button type="button" onClick={() => setModal('edit')} className="font-semibold underline">Edit draft</button>}
            {pending.can_edit && <button type="button" disabled={busy} onClick={send} className="font-semibold underline disabled:opacity-50">{busy ? 'Sending…' : 'Send for signature'}</button>}
          </div>
        </div>
      )}

      {canAct ? (
        <div className="mt-3 flex flex-wrap gap-3">
          {!(pending && pending.can_edit) && <button type="button" onClick={() => setModal('propose')} className={link}>{current ? 'Propose new terms' : 'Propose terms'}</button>}
          {current?.can_terminate && <button type="button" onClick={() => setModal('terminate')} className="text-xs font-semibold text-[#B42318]">End agreement</button>}
        </div>
      ) : role === 'member' ? (
        <p className="mt-3 text-[#4A5568]">Only owners and admins can propose or sign agreements.</p>
      ) : null}
      {error && <p role="alert" className="mt-2 font-medium text-[#B42318]">{error}</p>}

      {modal === 'propose' && <AgreementTermsDialog title={current ? 'Propose new terms' : 'Propose terms'} mentorshipId={mentorship.id} basis={current || undefined} onClose={() => setModal('')} onDone={done} />}
      {modal === 'edit' && pending && <AgreementTermsDialog title="Edit draft" mentorshipId={mentorship.id} draft={pending} onClose={() => setModal('')} onDone={done} />}
      {modal === 'sign' && pending && <SignAgreementDialog agreement={pending} onClose={() => setModal('')} onDone={done} />}
      {modal === 'terminate' && current && <TerminateAgreementDialog agreement={current} onClose={() => setModal('')} onDone={done} />}
    </div>
  );
}
