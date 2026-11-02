'use client';

import React from 'react';
import {
  Briefcase,
  Building2,
  ChevronRight,
  Compass,
  Landmark,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import styles from './RoleSwitcherStep.module.css';

export interface UserRoleOption {
  id: string;
  roleLabel: string;
  organization: string;
}

interface RoleSwitcherStepProps {
  email: string;
  roles: UserRoleOption[];
  onSelectRole: (role: UserRoleOption) => void;
  onSwitchAccount: () => void;
}

function getRoleIcon(roleLabel: string) {
  const normalized = roleLabel.toLowerCase();
  if (normalized.includes('founder') || normalized.includes('startup')) {
    return <Building2 size={18} strokeWidth={1.5} aria-hidden="true" />;
  }
  if (normalized.includes('mentor')) {
    return <Compass size={18} strokeWidth={1.5} aria-hidden="true" />;
  }
  if (normalized.includes('investor')) {
    return <Landmark size={18} strokeWidth={1.5} aria-hidden="true" />;
  }
  if (normalized.includes('employer')) {
    return <Briefcase size={18} strokeWidth={1.5} aria-hidden="true" />;
  }
  if (normalized.includes('admin')) {
    return <ShieldCheck size={18} strokeWidth={1.5} aria-hidden="true" />;
  }
  return <UserCheck size={18} strokeWidth={1.5} aria-hidden="true" />;
}

export function RoleSwitcherStep({
  email,
  roles,
  onSelectRole,
  onSwitchAccount,
}: RoleSwitcherStepProps) {
  return (
    <div className={`${styles.container} animate-form-enter`}>
      <header className={styles.header}>
        <h1 className={styles.title}>Continue to workspace</h1>
        <p className={styles.subtitle}>
          Select the role you would like to open for this session. You can switch
          roles anytime from your workspace menu.
        </p>
      </header>

      <div className={styles.roleList} role="list">
        {roles.map((role) => (
          <button
            key={role.id}
            type="button"
            className={styles.roleCard}
            onClick={() => onSelectRole(role)}
          >
            <div className={styles.roleLeft}>
              <span className={styles.roleIconBox}>
                {getRoleIcon(role.roleLabel)}
              </span>
              <span className={styles.roleMeta}>
                <span className={styles.roleTitle}>
                  Continue as {role.roleLabel}
                </span>
                <span className={styles.roleOrg}>{role.organization}</span>
              </span>
            </div>
            <ChevronRight
              size={18}
              strokeWidth={1.5}
              className={styles.chevron}
              aria-hidden="true"
            />
          </button>
        ))}
      </div>

      <div className={styles.footer}>
        <span>Signed in as {email}</span>
        <button
          type="button"
          className={styles.switchAccountBtn}
          onClick={onSwitchAccount}
        >
          Use another account
        </button>
      </div>
    </div>
  );
}
