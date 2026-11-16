'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LockKeyhole, ArrowRight, Eye, EyeOff, CheckCircle2, Mail, Building2, Users, Briefcase, Lightbulb } from 'lucide-react';
import { api, ApiError } from '@/lib/api/client';
import { ROLE_HOME, primaryRole, useAuth } from '@/lib/auth-context';
import {
  clearPendingEmail,
  clearSignupDraft,
  getPendingEmail,
  getSignupDraft,
  setPendingEmail,
  setSignupDraft,
} from '@/lib/signup-draft';

const roles = [
  ['Startup', 'Build and grow a company', Building2],
  ['Mentor', 'Share experience and guide founders', Lightbulb],
  ['Investor', 'Discover and support ambitious teams', Briefcase],
  ['Job seeker', 'Find your next meaningful role', Users],
  ['Employer', 'Build a team that moves you forward', Building2],
];

// Display label → API role value (backend: startup | mentor | investor |
// jobseeker | employer; admin cannot be self-granted).
const API_ROLE = {
  Startup: 'startup',
  Mentor: 'mentor',
  Investor: 'investor',
  'Job seeker': 'jobseeker',
  Employer: 'employer',
};

const titles = {
  login: ['Welcome back', 'Sign in to continue to your workspace.'],
  register: ['Create your account', 'One account for the people building what’s next.'],
  role: ['How will you use Forma?', 'Choose a starting point. You can add other roles later.'],
  verify: ['Verify your email', 'We sent a six-digit code to your inbox.'],
  forgot: ['Forgot your password?', 'Enter your email and we’ll send you a reset link.'],
  reset: ['Set a new password', 'Choose a strong password you haven’t used before.'],
};

export default function AuthScreen({ page }) {
  const router = useRouter();
  const { user, loading: authLoading, login } = useAuth();

  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [role, setRole] = useState('');
  const [err, setErr] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [code, setCode] = useState('');
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState('');
  const [token, setToken] = useState('');

  const [title, subtitle] = titles[page] || titles.login;

  // Reset link carries ?token=… ; read it on mount (client only).
  useEffect(() => {
    if (page !== 'reset') return;
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token') || '';
    setToken(t);
    if (!t) setErr('This reset link is invalid or expired. Please request a new one.');
  }, [page]);

  // Already signed in → don't show the login form again.
  useEffect(() => {
    if (page !== 'login' || authLoading || !user) return;
    router.replace(ROLE_HOME[primaryRole(user)] || (primaryRole(user) === 'admin' ? '/admin' : '/login'));
  }, [page, authLoading, user, router]);

  // Deep links into the multi-step signup need the earlier steps first.
  useEffect(() => {
    if (authLoading) return;
    if (page === 'role' && !getSignupDraft().email) router.replace('/register');
    if (page === 'verify' && !getPendingEmail()) router.replace('/register');
  }, [page, authLoading, router]);

  const fail = (e) => {
    setBusy(false);
    setResending(false);
    setErr(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      if (page === 'login') {
        if (!email || !password) {
          setErr('Enter your email and password.');
          return;
        }
        setBusy(true);
        const me = await login(email, password);
        const home = ROLE_HOME[primaryRole(me)] || (primaryRole(me) === 'admin' ? '/admin' : '/login');
        router.replace(home);
        return;
      }

      if (page === 'register') {
        if (!email) {
          setErr('Enter your email address.');
          return;
        }
        if (password.length < 12) {
          setErr('Use at least 12 characters for your password.');
          return;
        }
        setBusy(true);
        setSignupDraft(email, password);
        router.push('/register/role');
        return;
      }

      if (page === 'role') {
        if (!role) {
          setErr('Choose how you will use the platform.');
          return;
        }
        const draft = getSignupDraft();
        if (!draft.email || !draft.password) {
          setErr('Please enter your details on the previous step.');
          router.replace('/register');
          return;
        }
        setBusy(true);
        // One API call carries email + password + role (the UI splits it
        // across two screens).
        await api.auth.register({
          email: draft.email,
          password: draft.password,
          role: API_ROLE[role],
        });
        setPendingEmail(draft.email);
        router.push('/verify-email');
        return;
      }

      if (page === 'verify') {
        const pending = getPendingEmail();
        if (!pending) {
          setErr('No pending verification. Please create an account first.');
          return;
        }
        if (!/^\d{6}$/.test(code)) {
          setErr('Enter the six-digit code from your email.');
          return;
        }
        setBusy(true);
        await api.auth.verifyEmail({ email: pending, code });
        clearPendingEmail();
        clearSignupDraft();
        router.push('/login');
        return;
      }

      if (page === 'forgot') {
        if (!email) {
          setErr('Enter your email address.');
          return;
        }
        setBusy(true);
        const res = await api.auth.forgotPassword({ email });
        setNotice(res.message);
        return;
      }

      if (page === 'reset') {
        if (!token) {
          setErr('This reset link is invalid or expired. Please request a new one.');
          return;
        }
        if (password.length < 12) {
          setErr('Use at least 12 characters for your password.');
          return;
        }
        if (password !== confirm) {
          setErr('Passwords do not match.');
          return;
        }
        setBusy(true);
        const res = await api.auth.resetPassword({ token, new_password: password });
        setNotice(res.message);
        return;
      }
    } catch (e) {
      fail(e);
    }
  };

  const resend = async () => {
    setErr('');
    setResendMsg('');
    const pending = getPendingEmail();
    if (!pending) {
      setErr('No pending verification. Please create an account first.');
      return;
    }
    setResending(true);
    try {
      const res = await api.auth.resendVerification({ email: pending });
      setResendMsg(res.message);
    } catch (e) {
      fail(e);
    } finally {
      setResending(false);
    }
  };

  return (
    <main className="min-h-screen lg:grid lg:grid-cols-[45%_55%]">
      <aside className="hidden min-h-screen flex-col justify-between bg-ink px-12 py-10 text-white lg:flex xl:px-16">
        <Link href="/login" className="flex items-center gap-3 text-white">
          <span className="grid h-9 w-9 place-items-center rounded-full border border-white/30 font-serif text-lg">F</span>
          <span className="text-lg font-semibold tracking-wide">forma</span>
        </Link>
        <div className="max-w-lg">
          <div className="mb-7 h-[2px] w-12 bg-[#B8955A]" />
          <h1 className="serif text-[42px] leading-[1.18]">From first idea to funded company, and the team that builds it.</h1>
          <p className="mt-6 max-w-sm leading-7 text-white/65">One considered space for founders, mentors, investors and the talent shaping tomorrow.</p>
        </div>
        <p className="text-sm tracking-wide text-stone-400">Mentors <span className="px-2 text-[#B8955A]">·</span> Investors <span className="px-2 text-[#B8955A]">·</span> Talent <span className="px-2 text-[#B8955A]">·</span> Startups</p>
      </aside>
      <section className="flex min-h-screen items-center justify-center px-6 py-10 sm:px-10">
        <div className="animate-enter w-full max-w-[420px]">
          <Link href="/login" className="mb-12 flex items-center gap-2 font-semibold lg:hidden">
            <span className="grid h-8 w-8 place-items-center rounded-full border border-ink/30 font-serif">F</span> forma
          </Link>
          <div className="mb-8">
            <h2 className="serif text-[32px] font-semibold leading-tight">{title}</h2>
            <p className="mt-2 text-[15px] leading-6 text-stone-700">{subtitle}</p>
          </div>
          {notice ? (
            <div role="status" aria-live="polite" className="rounded-xl border border-[#b5d9c7] bg-white p-5 text-sm leading-6 text-[#286749]">
              <CheckCircle2 className="mb-2" size={20} />
              {notice}
              {page === 'reset' && (
                <p className="mt-4">
                  <Link href="/login">Go to sign in <ArrowRight className="inline" size={15} /></Link>
                </p>
              )}
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5" noValidate>
              {page === 'login' && (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <button type="button" className="h-12 rounded-[10px] border border-stone-200 bg-white text-sm hover:bg-[#F4F1EA]">G&nbsp; Google</button>
                    <button type="button" className="h-12 rounded-[10px] border border-stone-200 bg-white text-sm hover:bg-[#F4F1EA]">▦&nbsp; Microsoft</button>
                    <button type="button" className="h-12 rounded-[10px] border border-stone-200 bg-white text-sm hover:bg-[#F4F1EA]">in&nbsp; LinkedIn</button>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-stone-700">
                    <span className="h-px flex-1 bg-stone-200" />or sign in with email<span className="h-px flex-1 bg-stone-200" />
                  </div>
                </>
              )}
              {page === 'role' && (
                <div className="space-y-3">
                  {roles.map(([name, desc, Icon]) => (
                    <button
                      type="button"
                      key={name}
                      onClick={() => setRole(name)}
                      aria-pressed={role === name}
                      className={`flex w-full items-center gap-4 rounded-xl border bg-white p-4 text-left transition hover:border-[#B8955A] ${role === name ? 'border-[#9A7A45] ring-2 ring-[#B8955A]/20' : 'border-stone-200'}`}
                    >
                      <Icon size={20} className="text-gold" />
                      <span className="flex-1">
                        <strong className="block text-sm">{name}</strong>
                        <small className="text-stone-700">{desc}</small>
                      </span>
                      <span className={`h-4 w-4 rounded-full border ${role === name ? 'border-[5px] border-ink' : 'border-stone-400'}`} />
                    </button>
                  ))}
                </div>
              )}
              {page === 'verify' && (
                <div className="rounded-xl bg-white p-4 text-sm text-stone-700">
                  <Mail className="mb-2 text-gold" size={20} />
                  Check spam too. The code expires in 10 minutes.
                </div>
              )}
              {page !== 'role' && (
                <>
                  {page !== 'verify' && (
                    <label className="block text-sm font-medium">
                      Email address
                      <input
                        className="field mt-2"
                        type="email"
                        autoComplete="email"
                        placeholder="you@company.com"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </label>
                  )}
                  {page === 'login' && (
                    <label className="block text-sm font-medium">
                      <span className="flex items-center justify-between">
                        Password
                        <Link className="text-sm font-normal text-gold" href="/forgot-password">Forgot password?</Link>
                      </span>
                      <span className="relative mt-2 block">
                        <input
                          className="field pr-12"
                          type={show ? 'text' : 'password'}
                          autoComplete="current-password"
                          placeholder="Enter your password"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => setShow(!show)}
                          aria-label={show ? 'Hide password' : 'Show password'}
                          className="absolute right-3 top-3 text-stone-700"
                        >
                          {show ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                      </span>
                    </label>
                  )}
                  {(page === 'register' || page === 'reset') && (
                    <label className="block text-sm font-medium">
                      {page === 'register' ? 'Password' : 'New password'}
                      <input
                        className="field mt-2"
                        type="password"
                        minLength={12}
                        autoComplete="new-password"
                        placeholder="At least 12 characters"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <small className="mt-1 block font-normal text-stone-700">Use at least 12 characters.</small>
                    </label>
                  )}
                  {page === 'reset' && (
                    <label className="block text-sm font-medium">
                      Confirm new password
                      <input
                        className="field mt-2"
                        type="password"
                        minLength={12}
                        placeholder="Re-enter your password"
                        required
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                      />
                    </label>
                  )}
                  {page === 'verify' && (
                    <label className="block text-sm font-medium">
                      Verification code
                      <input
                        className="field mt-2 text-center tracking-[.5em]"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="000000"
                        required
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      />
                    </label>
                  )}
                </>
              )}
              {page === 'login' && (
                <label className="flex items-center gap-2 text-sm text-stone-700">
                  <input type="checkbox" className="h-4 w-4 accent-ink" />
                  Keep me signed in
                </label>
              )}
              {err && (
                <p role="alert" className="text-sm text-[#B42318]">{err}</p>
              )}
              <button
                disabled={busy}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-[10px] bg-ink text-base font-semibold text-white transition hover:bg-[#1C2B42] disabled:bg-stone-200 disabled:text-stone-400"
              >
                {busy ? (
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                ) : page === 'login' ? 'Sign in' : page === 'register' ? 'Create account' : page === 'role' ? 'Continue' : page === 'verify' ? 'Verify email' : page === 'forgot' ? 'Send reset link' : page === 'reset' ? 'Update password' : 'Continue'}
              </button>
              {page === 'login' && (
                <p className="text-center text-sm text-stone-700">New here? <Link href="/register" className="font-semibold">Create an account</Link></p>
              )}
              {page === 'register' && (
                <p className="text-center text-sm text-stone-700">Already have an account? <Link href="/login" className="font-semibold">Sign in</Link></p>
              )}
              {page === 'forgot' && (
                <p className="text-center text-sm"><Link href="/login">Back to sign in</Link></p>
              )}
              {page === 'reset' && (
                <p className="text-center text-sm"><Link href="/login">Cancel and go back</Link></p>
              )}
              {page === 'verify' && (
                <>
                  <p className="text-center text-sm text-stone-700">
                    Didn’t get a code?{' '}
                    <button
                      type="button"
                      onClick={resend}
                      disabled={resending}
                      className="font-semibold text-gold disabled:text-stone-400"
                    >
                      {resending ? 'Sending…' : 'Resend code'}
                    </button>
                  </p>
                  {resendMsg && (
                    <p role="status" aria-live="polite" className="text-center text-sm text-[#286749]">{resendMsg}</p>
                  )}
                </>
              )}
              {page === 'role' && (
                <p className="text-center text-sm text-stone-700">Already have an account? <Link href="/login" className="font-semibold">Sign in</Link></p>
              )}
              {page === 'login' && (
                <>
                  <div className="flex items-center justify-center gap-2 text-xs text-stone-700">
                    <LockKeyhole size={14} />Secure sign-in
                  </div>
                  <p className="text-center text-xs leading-5 text-stone-700">
                    By continuing you agree to our <a href="#terms">Terms</a> and <a href="#privacy">Privacy Policy</a>.
                  </p>
                </>
              )}
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
