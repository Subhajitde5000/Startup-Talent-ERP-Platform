import { EMAIL_REGEX } from "@/utils/validation";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const fullName = String(body.fullName || "").trim();
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    const password = String(body.password || "");

    await new Promise((resolve) => setTimeout(resolve, 400));

    if (!fullName) {
      return NextResponse.json(
        { ok: false, field: "fullName", message: "Enter your full name." },
        { status: 400 },
      );
    }

    if (!email || !EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        {
          ok: false,
          field: "email",
          message: !email ? "Enter your email address." : "That doesn't look like a valid email.",
        },
        { status: 400 },
      );
    }

    if (email.startsWith("existing@") || email.startsWith("taken@")) {
      return NextResponse.json(
        {
          ok: false,
          code: "email_exists",
          message: "An account with this email already exists.",
        },
        { status: 409 },
      );
    }

    const hasNumberOrSymbol = /[\d\W_]/.test(password);
    if (password.length < 8 || !hasNumberOrSymbol) {
      return NextResponse.json(
        {
          ok: false,
          field: "password",
          message: "Use at least 8 characters with a number or symbol.",
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      user: { fullName, email },
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Unable to create account right now." },
      { status: 500 },
    );
  }
}
