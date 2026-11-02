import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const code = String(body.code || '').trim();

    await new Promise((resolve) => setTimeout(resolve, 400));

    if (!/^\d{6}$/.test(code) || code === '000000') {
      return NextResponse.json(
        {
          ok: false,
          message: 'That verification code is invalid. Please try again.',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { ok: false, message: 'Unable to verify code.' },
      { status: 500 }
    );
  }
}
