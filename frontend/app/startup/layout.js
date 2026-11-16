import RoleGuard from '@/components/role-guard';

// Step 2 auth guard: every route under /startup/ requires the "startup" role.
// Pages render their own shell/sidebar; this gates the whole section.
export default function StartupLayout({ children }) {
  return <RoleGuard role="startup">{children}</RoleGuard>;
}
