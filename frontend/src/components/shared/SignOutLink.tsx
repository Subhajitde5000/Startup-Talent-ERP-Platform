"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { clearDemoWorkspaces } from "@/config/demoStorage";

/** Demo sign-out: clears locally edited records and returns to the sign-in screen. */
export function SignOutLink({
  className,
  label = "Sign out",
  iconSize = 16,
}: {
  className?: string;
  label?: string;
  iconSize?: number;
}) {
  const router = useRouter();
  return (
    <a
      href="/login"
      className={className}
      onClick={(event) => {
        event.preventDefault();
        clearDemoWorkspaces();
        router.push("/login");
      }}
    >
      <LogOut size={iconSize} strokeWidth={1.5} aria-hidden="true" />
      <span>{label}</span>
    </a>
  );
}
