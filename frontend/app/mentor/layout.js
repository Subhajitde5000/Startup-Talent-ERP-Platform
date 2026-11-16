import RoleGuard from '@/components/role-guard';

// Step 2 auth guard: every route under /mentor/ requires the "mentor" role.
// Pages render their own shell/sidebar; this gates the whole section.
export default function MentorLayout({ children }) {
  return <RoleGuard role="mentor">{children}</RoleGuard>;
}
