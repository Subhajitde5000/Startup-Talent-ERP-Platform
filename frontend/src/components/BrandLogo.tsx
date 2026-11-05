import React from "react";
import Link from "next/link";

interface BrandLogoProps {
  variant: "ivory" | "ink";
}

export function BrandLogo({ variant }: BrandLogoProps) {
  const textColor = variant === "ivory" ? "#FAF8F4" : "var(--text-primary)";
  const accentColor = variant === "ivory" ? "#B8955A" : "var(--accent)";

  return (
    <Link
      href="/"
      aria-label="Meridian — Home"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "10px",
        textDecoration: "none",
        color: textColor,
        borderRadius: "6px",
        minHeight: "44px",
        padding: "4px 2px",
      }}
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect
          x="2.75"
          y="2.75"
          width="18.5"
          height="18.5"
          rx="4"
          stroke={textColor}
          strokeWidth="1.5"
        />
        <path
          d="M7.25 16.25V8.25L12 13L16.75 8.25V16.25"
          stroke={textColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="6.25" r="1.1" fill={accentColor} />
      </svg>
      <span
        style={{
          fontFamily: "var(--font-heading)",
          fontSize: "21px",
          fontWeight: 600,
          letterSpacing: "-0.015em",
          lineHeight: 1,
          color: textColor,
        }}
      >
        Meridian
      </span>
    </Link>
  );
}
