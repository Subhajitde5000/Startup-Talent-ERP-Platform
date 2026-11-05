"use client";

import { useEffect } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Global accessibility helper for every `role="dialog"` in the app.
 *
 * The role workspaces contain many independently implemented modals/drawers.
 * Rather than duplicating focus management in each one, this observer traps Tab
 * inside the topmost open dialog, restores focus when it closes, and provides a
 * fallback accessible name when a dialog has no heading reference.
 *
 * Mounted once in the root layout; it does nothing when no dialog is open.
 */
export function DialogAccessibility() {
  useEffect(() => {
    let currentDialog: HTMLElement | null = null;
    let previouslyFocused: HTMLElement | null = null;

    const focusables = (dialog: HTMLElement) =>
      Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (element) => element.offsetParent !== null || element === document.activeElement,
      );

    const sync = () => {
      const dialogs = Array.from(
        document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]'),
      ).filter((dialog) => dialog.offsetParent !== null);
      const next = dialogs[dialogs.length - 1] || null;

      if (next === currentDialog) return;

      if (!next) {
        if (previouslyFocused?.isConnected) previouslyFocused.focus();
        previouslyFocused = null;
        currentDialog = null;
        return;
      }

      previouslyFocused = document.activeElement as HTMLElement | null;
      currentDialog = next;
      if (!next.hasAttribute("aria-label") && !next.hasAttribute("aria-labelledby")) {
        const heading = next.querySelector("h1, h2, h3");
        if (heading?.id) next.setAttribute("aria-labelledby", heading.id);
        else next.setAttribute("aria-label", "Dialog");
      }
      if (!next.hasAttribute("tabindex")) next.setAttribute("tabindex", "-1");
      const first = focusables(next)[0];
      (first || next).focus();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !currentDialog?.isConnected) return;
      const items = focusables(currentDialog);
      if (!items.length) {
        event.preventDefault();
        currentDialog.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (!active || !currentDialog.contains(active)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const observer = new MutationObserver(sync);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-modal", "role"],
    });
    document.addEventListener("keydown", onKeyDown, true);
    sync();

    return () => {
      observer.disconnect();
      document.removeEventListener("keydown", onKeyDown, true);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, []);

  return null;
}
