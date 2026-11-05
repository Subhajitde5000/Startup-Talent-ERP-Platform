"use client";

import React, { useState } from "react";
import { Moon, SlidersHorizontal, Sun, X } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import styles from "./StatePreviewBar.module.css";

export type PreviewScenario =
  | "default"
  | "empty_fields"
  | "invalid_email"
  | "wrong_credentials"
  | "too_many_attempts"
  | "unverified_email"
  | "under_review"
  | "two_factor"
  | "multi_role";

interface StatePreviewBarProps {
  activeScenario: PreviewScenario;
  onSelectScenario: (scenario: PreviewScenario) => void;
}

const SCENARIOS: Array<{ id: PreviewScenario; label: string }> = [
  { id: "default", label: "Default (clean)" },
  { id: "empty_fields", label: "Empty fields" },
  { id: "invalid_email", label: "Invalid email" },
  { id: "wrong_credentials", label: "Wrong credentials" },
  { id: "too_many_attempts", label: "Too many attempts" },
  { id: "unverified_email", label: "Unverified email" },
  { id: "under_review", label: "Account under review" },
  { id: "two_factor", label: "Two-factor step (2FA)" },
  { id: "multi_role", label: "Multi-role switcher" },
];

export function StatePreviewBar({ activeScenario, onSelectScenario }: StatePreviewBarProps) {
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <div className={styles.wrapper}>
      {open && (
        <div className={styles.popover} role="dialog" aria-label="Preview login states">
          <div className={styles.popoverHeader}>
            <span>Design states</span>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={() => setOpen(false)}
              aria-label="Close states panel"
            >
              <X size={14} strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>
          <div className={styles.stateGrid}>
            {SCENARIOS.map((item) => {
              const isActive = activeScenario === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectScenario(item.id)}
                  className={`${styles.stateOption} ${isActive ? styles.stateOptionActive : ""}`}
                >
                  <span>{item.label}</span>
                  {isActive && <span className={styles.activeDot} aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className={styles.pillBar}>
        <button
          type="button"
          className={styles.pillBtn}
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
        >
          <SlidersHorizontal size={14} strokeWidth={1.5} aria-hidden="true" />
          <span>States</span>
        </button>

        <button
          type="button"
          className={styles.iconPillBtn}
          onClick={toggleTheme}
          aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
          title={theme === "light" ? "Dark mode" : "Light mode"}
        >
          {theme === "light" ? (
            <Moon size={15} strokeWidth={1.5} aria-hidden="true" />
          ) : (
            <Sun size={15} strokeWidth={1.5} aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}
