"use client";

import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { StartupDocumentItem } from "@/types/startup";
import styles from "./DashboardWidgets.module.css";

export type QuickActionType = "task" | "member" | "document" | "mentor" | null;

interface QuickActionModalProps {
  action: QuickActionType;
  founderName: string;
  onClose: () => void;
  onCreateTask: (payload: {
    title: string;
    moduleLabel: string;
    moduleHref: string;
    dueLabel: string;
    owner: string;
    isMilestone?: boolean;
  }) => void;
  onInviteMember: (payload: {
    name: string;
    role: string;
    email: string;
    permission: "Owner" | "Admin" | "Member";
  }) => void;
  onUploadDocument: (payload: { title: string; folder: StartupDocumentItem["folder"] }) => void;
  onRequestMentor: (topic: string, preferredDay: string) => void;
}

const MODULE_OPTIONS = [
  { label: "Customer Research", href: "/startup/customer-research" },
  { label: "Idea Validation", href: "/startup/idea-validation" },
  { label: "Prototype Testing", href: "/startup/prototype-testing" },
  { label: "Projects & Sprints", href: "/startup/projects" },
  { label: "Sales Pipeline", href: "/startup/sales" },
  { label: "Hiring Requests", href: "/startup/hiring" },
  { label: "Data Room", href: "/startup/data-room" },
];

export function QuickActionModal({
  action,
  founderName,
  onClose,
  onCreateTask,
  onInviteMember,
  onUploadDocument,
  onRequestMentor,
}: QuickActionModalProps) {
  const [taskTitle, setTaskTitle] = useState("");
  const [taskModuleIdx, setTaskModuleIdx] = useState(0);
  const [taskDue, setTaskDue] = useState("Due next Friday");
  const [isMilestone, setIsMilestone] = useState(false);

  const [memberName, setMemberName] = useState("");
  const [memberRole, setMemberRole] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [memberPermission, setMemberPermission] = useState<"Owner" | "Admin" | "Member">("Member");

  const [docTitle, setDocTitle] = useState("");
  const [docFolder, setDocFolder] = useState<StartupDocumentItem["folder"]>("Pitch & Narrative");

  const [mentorTopic, setMentorTopic] = useState("");
  const [mentorDay, setMentorDay] = useState("Next Tuesday · 11:00 AM");

  useEffect(() => {
    if (!action) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [action, onClose]);

  if (!action) return null;

  const modalHeading =
    action === "task"
      ? "Add Task or Milestone"
      : action === "member"
        ? "Invite Team Member"
        : action === "document"
          ? "Add Document to Data Room"
          : "Request Mentor Session";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (action === "task") {
      if (!taskTitle.trim()) return;
      const mod = MODULE_OPTIONS[taskModuleIdx] || MODULE_OPTIONS[0];
      onCreateTask({
        title: taskTitle.trim(),
        moduleLabel: mod.label,
        moduleHref: mod.href,
        dueLabel: taskDue.trim() || "Due soon",
        owner: founderName,
        isMilestone,
      });
      setTaskTitle("");
      setIsMilestone(false);
    } else if (action === "member") {
      if (!memberName.trim() || !memberRole.trim()) return;
      const fallbackEmail = `${memberName.trim().toLowerCase().replace(/\s+/g, ".")}@northstar.bio`;
      onInviteMember({
        name: memberName.trim(),
        role: memberRole.trim(),
        email: memberEmail.trim() || fallbackEmail,
        permission: memberPermission,
      });
      setMemberName("");
      setMemberRole("");
      setMemberEmail("");
    } else if (action === "document") {
      if (!docTitle.trim()) return;
      onUploadDocument({
        title: docTitle.trim(),
        folder: docFolder,
      });
      setDocTitle("");
    } else if (action === "mentor") {
      if (!mentorTopic.trim()) return;
      onRequestMentor(mentorTopic.trim(), mentorDay);
      setMentorTopic("");
    }
    onClose();
  };

  return (
    <div className={styles.modalBackdrop} onClick={onClose} role="presentation">
      <div
        className={styles.modalDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-action-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <h3 id="quick-action-title" className={styles.modalTitle}>
            {modalHeading}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className={styles.modalCloseBtn}
            aria-label="Close modal"
          >
            <X size={18} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.modalForm}>
          {action === "task" && (
            <>
              <div className={styles.fieldGroup}>
                <label htmlFor="qa-task-title" className={styles.fieldLabel}>
                  Task summary
                </label>
                <input
                  id="qa-task-title"
                  type="text"
                  required
                  placeholder="e.g., Validate onboarding pricing tier with 5 pilots"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className={styles.fieldInput}
                  autoFocus
                />
              </div>

              <div className={styles.fieldGroup}>
                <label htmlFor="qa-task-module" className={styles.fieldLabel}>
                  Workspace module
                </label>
                <select
                  id="qa-task-module"
                  value={taskModuleIdx}
                  onChange={(e) => setTaskModuleIdx(Number(e.target.value))}
                  className={styles.fieldSelect}
                >
                  {MODULE_OPTIONS.map((mod, idx) => (
                    <option key={mod.href} value={idx}>
                      {mod.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.fieldGroup}>
                <label htmlFor="qa-task-due" className={styles.fieldLabel}>
                  Target timeline
                </label>
                <input
                  id="qa-task-due"
                  type="text"
                  value={taskDue}
                  onChange={(e) => setTaskDue(e.target.value)}
                  className={styles.fieldInput}
                />
              </div>

              <label className={styles.criterionLabel}>
                <input
                  type="checkbox"
                  checked={isMilestone}
                  onChange={(e) => setIsMilestone(e.target.checked)}
                  className={styles.checkbox}
                />
                <span>Mark as key stage milestone</span>
              </label>
            </>
          )}

          {action === "member" && (
            <>
              <div className={styles.fieldGroup}>
                <label htmlFor="qa-member-name" className={styles.fieldLabel}>
                  Full name
                </label>
                <input
                  id="qa-member-name"
                  type="text"
                  required
                  placeholder="e.g., Priya Nair"
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  className={styles.fieldInput}
                  autoFocus
                />
              </div>

              <div className={styles.fieldGroup}>
                <label htmlFor="qa-member-role" className={styles.fieldLabel}>
                  Role / title
                </label>
                <input
                  id="qa-member-role"
                  type="text"
                  required
                  placeholder="e.g., Founding Product Designer"
                  value={memberRole}
                  onChange={(e) => setMemberRole(e.target.value)}
                  className={styles.fieldInput}
                />
              </div>

              <div className={styles.fieldGroup}>
                <label htmlFor="qa-member-email" className={styles.fieldLabel}>
                  Work email
                </label>
                <input
                  id="qa-member-email"
                  type="email"
                  placeholder="e.g., priya@northstar.bio"
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  className={styles.fieldInput}
                />
              </div>

              <div className={styles.fieldGroup}>
                <label htmlFor="qa-member-perm" className={styles.fieldLabel}>
                  Workspace permission
                </label>
                <select
                  id="qa-member-perm"
                  value={memberPermission}
                  onChange={(e) =>
                    setMemberPermission(e.target.value as "Owner" | "Admin" | "Member")
                  }
                  className={styles.fieldSelect}
                >
                  <option value="Member">Member</option>
                  <option value="Admin">Admin</option>
                  <option value="Owner">Owner</option>
                </select>
              </div>
            </>
          )}

          {action === "document" && (
            <>
              <div className={styles.fieldGroup}>
                <label htmlFor="qa-doc-title" className={styles.fieldLabel}>
                  Document title
                </label>
                <input
                  id="qa-doc-title"
                  type="text"
                  required
                  placeholder="e.g., Northstar Bio — Q4 Pilot Summary.pdf"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  className={styles.fieldInput}
                  autoFocus
                />
              </div>

              <div className={styles.fieldGroup}>
                <label htmlFor="qa-doc-cat" className={styles.fieldLabel}>
                  Data room folder
                </label>
                <select
                  id="qa-doc-cat"
                  value={docFolder}
                  onChange={(e) => setDocFolder(e.target.value as StartupDocumentItem["folder"])}
                  className={styles.fieldSelect}
                >
                  <option value="Pitch & Narrative">Pitch &amp; Narrative</option>
                  <option value="Financials">Financials</option>
                  <option value="Cap Table">Cap Table</option>
                  <option value="Legal">Legal</option>
                </select>
              </div>
            </>
          )}

          {action === "mentor" && (
            <>
              <div className={styles.fieldGroup}>
                <label htmlFor="qa-mentor-topic" className={styles.fieldLabel}>
                  Discussion agenda
                </label>
                <input
                  id="qa-mentor-topic"
                  type="text"
                  required
                  placeholder="e.g., Enterprise pilot pricing & LOI conversion"
                  value={mentorTopic}
                  onChange={(e) => setMentorTopic(e.target.value)}
                  className={styles.fieldInput}
                  autoFocus
                />
              </div>

              <div className={styles.fieldGroup}>
                <label htmlFor="qa-mentor-day" className={styles.fieldLabel}>
                  Preferred slot
                </label>
                <select
                  id="qa-mentor-day"
                  value={mentorDay}
                  onChange={(e) => setMentorDay(e.target.value)}
                  className={styles.fieldSelect}
                >
                  <option value="Next Tuesday · 11:00 AM">Next Tuesday · 11:00 AM</option>
                  <option value="Next Thursday · 3:30 PM">Next Thursday · 3:30 PM</option>
                  <option value="Next Friday · 10:00 AM">Next Friday · 10:00 AM</option>
                </select>
              </div>
            </>
          )}

          <div className={styles.modalActions}>
            <button type="button" onClick={onClose} className={styles.secondaryActionBtn}>
              Cancel
            </button>
            <button type="submit" className={styles.primaryActionBtn}>
              Save changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
