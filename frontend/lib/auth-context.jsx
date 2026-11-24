'use client';
/**
 * Session state for the whole app: who is signed in, the current user's
 * roles, and the login/logout helpers. Backed by lib/api/client.ts (tokens
 * live only in tab memory; the API client attaches and refreshes them).
 * A full reload or a new tab intentionally requires sign-in again.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, clearTokens, getAccessToken, setTokens, UNAUTHENTICATED_EVENT } from '@/lib/api/client';

const AuthContext = createContext(null);

/** Landing page per role — used by login and the role guard. */
export const ROLE_HOME = {
  startup: '/startup/dashboard',
  mentor: '/mentor/dashboard',
  investor: '/investor/dashboard',
  jobseeker: '/jobseeker/dashboard',
  employer: '/employer/dashboard',
};

/** The role used for routing/landing pages (first role the user holds). */
export function primaryRole(user) {
  if (!user) return null;
  return user.primary_role || (user.roles && user.roles[0]) || null;
}

/** A user stays in onboarding until its final step is persisted. */
export function needsOnboarding(user) {
  return Boolean(user) && user.onboarding_step !== 'completed';
}

export function landingPath(user) {
  const role = primaryRole(user);
  if (needsOnboarding(user)) return `/onboarding${role ? `?role=${role}` : ''}`;
  return ROLE_HOME[role] || (role === 'admin' ? '/admin' : '/login');
}

export function AuthProvider({ children }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  // Always start "loading" on both server and client; the token is only
  // read inside the mount effect to avoid a hydration mismatch.
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  // Load the current user once on mount if a token exists.
  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    async function load() {
      if (!getAccessToken()) {
        setLoading(false);
        return;
      }
      try {
        const me = await api.users.me();
        if (!cancelled) setUser(me);
      } catch {
        // Token invalid/refresh failed → client already cleared it.
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
      mounted.current = false;
    };
  }, []);

  // When the API client gives up refreshing, drop local state and go to login.
  useEffect(() => {
    function onUnauthenticated() {
      if (!mounted.current) return;
      setUser(null);
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        router.replace('/login');
      }
    }
    window.addEventListener(UNAUTHENTICATED_EVENT, onUnauthenticated);
    return () => window.removeEventListener(UNAUTHENTICATED_EVENT, onUnauthenticated);
  }, [router]);

  const login = useCallback(async (email, password) => {
    await api.auth.login({ email, password });
    const me = await api.users.me();
    setUser(me);
    return me;
  }, []);

  const verifyEmail = useCallback(async (email, code) => {
    const tokens = await api.auth.verifyEmail({ email, code });
    setTokens(tokens);
    const me = await api.users.me();
    setUser(me);
    return me;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      // Network/server hiccup — the local session is cleared regardless.
    }
    clearTokens();
    setUser(null);
    router.replace('/login');
  }, [router]);

  /** Re-read /users/me (e.g. after adding a role). */
  const refreshUser = useCallback(async () => {
    const me = await api.users.me();
    setUser(me);
    return me;
  }, []);

  const value = {
    user,
    loading,
    isAuthenticated: Boolean(user),
    role: primaryRole(user),
    hasRole: (role) => Boolean(user && user.roles && user.roles.includes(role)),
    login,
    verifyEmail,
    logout,
    refreshUser,
    setUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
