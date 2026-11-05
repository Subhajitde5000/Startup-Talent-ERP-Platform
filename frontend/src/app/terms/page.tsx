import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AuthSplitLayout } from "@/components/AuthSplitLayout";

export default function TermsPage() {
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
            Terms of Service
          </h1>
          <p style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
            Effective for all startup, investor, mentor, talent and employer workspaces.
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
            Meridian provides workspace infrastructure for venture building, advisory workflows,
            capital diligence, and talent operations. By signing in, you agree to maintain the
            confidentiality of non-public company, candidate, and investor materials shared within
            authorized rooms.
          </p>
          <p>
            Accounts are personal to one individual and may hold multiple platform roles across
            organizations, subject to role-specific permissions and audit logging.
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
