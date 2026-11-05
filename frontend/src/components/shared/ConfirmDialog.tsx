"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";
import styles from "./ConfirmDialog.module.css";

/**
 * Accessible in-app confirmation replacing native `window.confirm()` popups.
 * Focus trapping and focus restoration are handled by DialogAccessibility.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "primary",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className={styles.backdrop} onMouseDown={onCancel}>
      <section
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        {tone === "danger" && <AlertTriangle size={20} color="#b42318" aria-hidden="true" />}
        <h2 className={styles.title} id="confirm-dialog-title">
          {title}
        </h2>
        <p className={styles.description} id="confirm-dialog-description">
          {description}
        </p>
        <div className={styles.actions}>
          <button className={styles.button} type="button" onClick={onCancel} autoFocus>
            {cancelLabel}
          </button>
          <button
            className={`${styles.button} ${tone === "danger" ? styles.danger : styles.primary}`}
            type="button"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
