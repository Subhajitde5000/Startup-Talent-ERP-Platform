import RoleGuard from '@/components/role-guard';

// Step 2 auth guard: every route under /employer/ requires the "employer" role.
// Pages render their own shell/sidebar; this gates the whole section.
export default function EmployerLayout({ children }) {
  return <RoleGuard role="employer">{children}</RoleGuard>;
}
