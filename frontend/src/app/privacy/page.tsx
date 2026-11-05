import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AuthSplitLayout } from "@/components/AuthSplitLayout";

export default function PrivacyPage() {
  return (
    <AuthSplitLayout>
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        <header style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <h1
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "32px",
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
          >
            Privacy Policy
          </h1>
          <p style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
            How Meridian safeguards workspace, cap table, and talent records.
          </p>
        </header>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            fontSize: "14px",
            color: "var(--text-secondary)",
            lineHeight: 1.65,
          }}
        >
          <p>
            All authentication traffic and workspace documents are encrypted in transit and at rest.
            Credentials are hashed using modern memory-hard algorithms, and enterprise SSO sessions
            follow strict token lifetimes.
          </p>
          <p>
            We never sell personal or portfolio data. Access across founder, mentor, investor, and
            recruiting modules is scoped strictly to the workspaces you authorize.
          </p>
        </div>

        <div>
          <Link
            href="/"
            className="accent-link"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "14px",
              minHeight: "44px",
            }}
          >
            <ArrowLeft size={15} strokeWidth={1.5} aria-hidden="true" />
            <span>Back to sign in</span>
          </Link>
        </div>
      </div>
    </AuthSplitLayout>
  );
}
