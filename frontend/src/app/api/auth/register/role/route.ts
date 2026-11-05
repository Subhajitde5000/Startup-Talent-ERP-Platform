import { NextResponse } from "next/server";

const VALID_ROLES = new Set(["Startup", "Mentor", "Investor", "Job seeker", "Employer"]);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const role = String(body.role || "").trim();

    await new Promise((resolve) => setTimeout(resolve, 400));

    if (!VALID_ROLES.has(role)) {
      return NextResponse.json(
        { ok: false, message: "Select how you will use the platform." },
        { status: 400 },
      );
    }

    const requiresVerification = role === "Investor" || role === "Mentor" || role === "Employer";

    return NextResponse.json({
      ok: true,
      role,
      requiresVerification,
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Unable to save your role right now." },
      { status: 500 },
    );
  }
}
