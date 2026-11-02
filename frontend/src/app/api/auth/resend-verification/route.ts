import { NextResponse } from 'next/server';

export async function POST() {
  await new Promise((resolve) => setTimeout(resolve, 350));
  return NextResponse.json({ ok: true });
}
