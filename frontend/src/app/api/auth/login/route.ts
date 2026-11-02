import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const attempts = Number(body.attempts || 0);

    // Brief realistic network latency so the fixed-width button spinner shows calmly
    await new Promise((resolve) => setTimeout(resolve, 450));

    if (!email || !password) {
      return NextResponse.json({ state: 'wrong_credentials' }, { status: 400 });
    }

    if (attempts >= 4 || email.startsWith('locked@')) {
      return NextResponse.json({ state: 'too_many_attempts' });
    }

    if (
      password === 'wrong' ||
      password === 'incorrect' ||
      password === 'incorrect-pass' ||
      email.startsWith('wrong@')
    ) {
      return NextResponse.json({ state: 'wrong_credentials' }, { status: 401 });
    }

    if (email.includes('unverified')) {
      return NextResponse.json({ state: 'unverified_email' });
    }

    if (email.includes('review') || email.includes('pending')) {
      return NextResponse.json({ state: 'under_review' });
    }

    if (email.includes('2fa') || email.includes('otp')) {
      return NextResponse.json({ state: 'two_factor' });
    }

    if (
      email.includes('multi') ||
      email.includes('dual') ||
      email.startsWith('claire@')
    ) {
      return NextResponse.json({
        state: 'multi_role',
        roles: [
          {
            id: 'founder',
            roleLabel: 'Founder',
            organization: 'Northstar Bio · Series A Workspace',
          },
          {
            id: 'mentor',
            roleLabel: 'Mentor',
            organization: 'Meridian Venture Fellows',
          },
        ],
      });
    }

    let primaryRole = 'Founder';
    if (email.includes('investor')) primaryRole = 'Investor';
    else if (email.includes('mentor')) primaryRole = 'Mentor';
    else if (email.includes('talent') || email.includes('seeker'))
      primaryRole = 'Job seeker';
    else if (email.includes('employer') || email.includes('hiring'))
      primaryRole = 'Employer';
    else if (email.includes('admin')) primaryRole = 'Admin';

    return NextResponse.json({
      state: 'authenticated',
      primaryRole,
    });
  } catch {
    return NextResponse.json({ state: 'wrong_credentials' }, { status: 500 });
  }
}
