'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { InvestorShell, Card, Button, StatusBadge } from '@/components';
import { LoadingBlock, EmptyBlock, ErrorBlock } from '@/components/async-state';
import { api } from '@/lib/api/client';
import { InvestorDisclaimer } from '../investor-data';

// Tab -> the request statuses it shows (the API lists by status).
const TAB_STATUSES = {
  Sent: ['pending', 'withdrawn'],
  Accepted: ['accepted'],
  'Declined and expired': ['declined', 'expired'],
};

export default function InvestorRequestsPage() {
  const [requestsTab, setRequestsTab] = useState('Received');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [withdrawingId, setWithdrawingId] = useState('');

  const load = useCallback(async (tab) => {
    const statuses = TAB_STATUSES[tab];
    if (!statuses) return; // "Received" has no investor-side data.
    setLoading(true);
    setError('');
    try {
      const pages = await Promise.all(
        statuses.map((status) =>
          api.engagement.listRequests({ status, limit: 50 }),
        ),
      );
      const merged = pages
        .flatMap((page) => page.items)
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      setItems(merged);
    } catch (err) {
      setError(err?.message || 'Could not load your requests.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(requestsTab);
  }, [requestsTab, load]);

  const onWithdraw = async (req) => {
    setWithdrawingId(req.id);
    try {
      await api.engagement.withdrawRequest(req.id);
      await load(requestsTab);
    } catch (err) {
      setError(err?.message || 'Could not withdraw this request.');
    } finally {
      setWithdrawingId('');
    }
  };

  return (
    <InvestorShell
      active="Intro requests"
      module="Deal flow"
      title="Intro requests"
      description="First contact stays respectful, verified and founder-controlled."
      actions={
        <Link
          href="/investor/discover"
          className="inline-flex min-h-10 items-center rounded-lg border border-[#E5E1D8] bg-white px-4 text-xs font-semibold text-ink hover:bg-[#FAF8F4]"
        >
          Discover startups
        </Link>
      }
    >
      {({ notify }) => (
        <>
          {/* Sub Navigation Tabs */}
          <div className="mb-6 flex gap-2">
            {['Received', 'Sent', 'Accepted', 'Declined and expired'].map((x) => (
              <button
                key={x}
                type="button"
                onClick={() => setRequestsTab(x)}
                className={`min-h-10 rounded-lg px-4 text-xs font-semibold transition ${
                  requestsTab === x
                    ? 'bg-ink text-white'
                    : 'border border-[#E5E1D8] bg-white text-[#4A5568] hover:bg-[#FAF8F4] hover:text-ink'
                }`}
              >
                {x}
              </button>
            ))}
          </div>

          {requestsTab === 'Received' && (
            <EmptyBlock
              title="No inbound requests on your investor account"
              hint="Intro requests flow from investors to startups. Requests sent to you are managed on the startup side, so they don't appear in this inbox."
            />
          )}

          {TAB_STATUSES[requestsTab] && (
            <>
              {loading && <LoadingBlock label="Loading requests…" />}
              {!loading && error && (
                <ErrorBlock message={error} onRetry={() => load(requestsTab)} />
              )}
              {!loading && !error && items.length === 0 && (
                <EmptyBlock
                  title="No requests here yet"
                  hint="Requests you send to startups will appear here. Discover startups to start a conversation."
                >
                  <Link
                    href="/investor/discover"
                    className="inline-flex min-h-9 items-center rounded-lg border border-[#E5E1D8] bg-white px-3 text-xs font-semibold text-ink hover:bg-[#FAF8F4]"
                  >
                    Discover startups
                  </Link>
                </EmptyBlock>
              )}
              {!loading && !error && items.length > 0 && (
                <div className="space-y-4">
                  {items.map((req) => (
                    <Card
                      key={req.id}
                      title={
                        <div className="flex items-center gap-2">
                          <span>{req.startup_name || 'Unknown startup'}</span>
                          <StatusBadge status={req.status} />
                        </div>
                      }
                      action={
                        <span className="text-xs text-[#4A5568]">
                          {req.expires_on
                            ? `Expires ${new Date(req.expires_on).toLocaleDateString()}`
                            : 'No expiry'}
                        </span>
                      }
                    >
                      <p className="text-xs font-medium text-[#4A5568]">
                        Requesting: <span className="text-ink">{req.ask}</span>
                      </p>
                      {req.message && (
                        <blockquote className="mt-3 rounded-lg bg-[#FAF8F4] p-3 text-sm italic text-ink border-l-2 border-[#B8955A]">
                          “{req.message}”
                        </blockquote>
                      )}
                      {req.decline_reason && (
                        <p className="mt-3 text-xs text-[#B42318]">
                          Declined: {req.decline_reason}
                        </p>
                      )}

                      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#E5E1D8] pt-3">
                        {req.status === 'pending' && (
                          <Button
                            onClick={() => onWithdraw(req)}
                            disabled={withdrawingId === req.id}
                          >
                            {withdrawingId === req.id ? 'Withdrawing…' : 'Withdraw'}
                          </Button>
                        )}
                        {req.status === 'accepted' && (
                          <Link
                            href="/investor/messages"
                            className="text-xs font-semibold text-[#9A7A45] hover:underline"
                          >
                            Open conversation →
                          </Link>
                        )}
                        <Link
                          href={`/investor/startups/${req.startup_slug || req.startup_org_id}`}
                          className="ml-auto text-xs font-semibold text-[#9A7A45] hover:underline"
                        >
                          View profile →
                        </Link>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}

          <InvestorDisclaimer onLearnMore={() => notify('Platform disclaimer opened.')} />
        </>
      )}
    </InvestorShell>
  );
}
