import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const code = String(body.code || "").trim();

    await new Promise((resolve) => setTimeout(resolve, 400));

    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        {
          ok: false,
          message: "Enter the 6-digit verification code.",
        },
        { status: 400 },
      );
    }

    if (code === "000000") {
      return NextResponse.json(
        {
          ok: false,
          message: "That verification code is invalid or expired.",
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      verifiedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Unable to confirm email right now." },
      { status: 500 },
    );
  }
}
