'use client';
/**
 * Client-side gate for role pages: waits for the session to resolve, sends
 * signed-out visitors to /login, and sends users without `role` to their own
 * workspace (or /login if they hold no role at all).
 *
 * This is a UX guard, not a security boundary — the API enforces
 * authorization server-side regardless.
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ROLE_HOME, useAuth } from '@/lib/auth-context';

export default function RoleGuard({ role, children }) {
  const { user, loading, hasRole } = useAuth();
  const router = useRouter();
  const allowed = hasRole(role);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
    } else if (!allowed) {
      const home = ROLE_HOME[user.primary_role || user.roles?.[0]];
      router.replace(home || '/login');
    }
  }, [loading, user, allowed, router]);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#FAF8F4]">
        <span
          className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-ink"
          role="status"
          aria-label="Loading"
        />
      </div>
    );
  }

  if (!user || !allowed) return null; // redirecting…
  return children;
}
