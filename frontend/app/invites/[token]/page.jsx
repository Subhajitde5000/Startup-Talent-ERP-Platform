'use client';

/**
 * Organization invite acceptance (Step 3b, part 3).
 *
 * The token is bound to the invited email server-side; acceptance only
 * succeeds when the signed-in account matches it. Not signed in -> the
 * page explains and links to login (the token rides along in the URL the
 * user originally opened, so we keep it in the path).
 */
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError, getAccessToken } from '@/lib/api/client';

export default function AcceptInvitePage() {
  const { token } = useParams();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [status, setStatus] = useState('working'); // working | accepted | error
  const [message, setMessage] = useState('');
  const [org, setOrg] = useState(null);
  const [busy, setBusy] = useState(false);

  const accept = async () => {
    if (busy) return;
    setBusy(true);
    setStatus('working');
    try {
      const result = await api.invites.accept(String(token));
      setOrg(result);
      setStatus('accepted');
    } catch (err) {
      setMessage(
        err instanceof ApiError ? err.message : 'Could not accept this invite.'
      );
      setStatus('error');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    // Auto-accept once we know who the user is.
    if (!loading && user && getAccessToken() && status === 'working' && !busy) {
      accept();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user]);

  return (
    <div className="grid min-h-screen place-items-center bg-[#FAF8F4] px-4 py-10 text-[#0F1B2D]">
      <div className="w-full max-w-md rounded-2xl border border-[#E5E1D8] bg-white p-7 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#B8955A]">
          Forma · Organization invite
        </p>

        {loading || (status === 'working' && !message) ? (
          <div className="mt-6 flex items-center gap-3 text-sm text-[#4A5568]">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/30 border-t-ink" />
            Checking your invite…
          </div>
        ) : null}

        {status === 'accepted' && org ? (
          <div className="mt-5">
            <CheckCircle2 className="text-[#286749]" size={34} />
            <h1 className="serif mt-3 text-2xl font-bold">You&apos;re on the team</h1>
            <p className="mt-2 text-sm text-[#4A5568]">
              You joined <b>{org.name}</b> as{' '}
              <b>{org.my_role ? org.my_role.charAt(0).toUpperCase() + org.my_role.slice(1) : 'member'}</b>.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/startup/team"
                className="inline-flex min-h-11 items-center rounded-lg bg-[#0F1B2D] px-5 text-sm font-semibold text-white hover:bg-[#1C2B42]"
              >
                Open team page
              </Link>
              <Link
                href="/startup/dashboard"
                className="inline-flex min-h-11 items-center rounded-lg border border-[#E5E1D8] px-5 text-sm font-semibold"
              >
                Go to dashboard
              </Link>
            </div>
          </div>
        ) : null}

        {status === 'error' ? (
          <div className="mt-5">
            <XCircle className="text-[#B42318]" size={34} />
            <h1 className="serif mt-3 text-2xl font-bold">Invite unavailable</h1>
            <p className="mt-2 text-sm text-[#4A5568]" role="alert">
              {message}
            </p>
            <p className="mt-3 text-xs text-[#7B8CA3]">
              Invites are bound to the invited email — sign in with that address,
              or ask an owner to send a new invite.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={`/login?next=/invites/${token}`}
                className="inline-flex min-h-11 items-center rounded-lg bg-[#0F1B2D] px-5 text-sm font-semibold text-white hover:bg-[#1C2B42]"
              >
                Sign in with another account
              </Link>
              <button
                type="button"
                onClick={() => router.push('/')}
                className="inline-flex min-h-11 items-center rounded-lg border border-[#E5E1D8] px-5 text-sm font-semibold"
              >
                Home
              </button>
            </div>
          </div>
        ) : null}

        {!loading && !user && status !== 'accepted' ? (
          <div className="mt-5">
            <h1 className="serif text-2xl font-bold">Join your team on Forma</h1>
            <p className="mt-2 text-sm text-[#4A5568]">
              You have been invited to join an organization. To accept, create a new
              account or sign in using the email address where you received this invite.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href={`/register?next=/invites/${token}`}
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#0F1B2D] px-5 text-sm font-semibold text-white hover:bg-[#1C2B42]"
              >
                Create account to accept
              </Link>
              <Link
                href={`/login?next=/invites/${token}`}
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#E5E1D8] px-5 text-sm font-semibold text-[#0F1B2D] hover:bg-[#FAF8F4]"
              >
                Sign in
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
