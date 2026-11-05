"use client";

import React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import styles from "./ThemeTogglePill.module.css";

export function ThemeTogglePill() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={styles.pill}
        onClick={toggleTheme}
        aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
        title={theme === "light" ? "Dark mode" : "Light mode"}
      >
        {theme === "light" ? (
          <Moon size={16} strokeWidth={1.5} aria-hidden="true" />
        ) : (
          <Sun size={16} strokeWidth={1.5} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
