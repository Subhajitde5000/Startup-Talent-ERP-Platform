import RoleGuard from '@/components/role-guard';

// Step 2 auth guard: every route under /investor/ requires the "investor" role.
// Pages render their own shell/sidebar; this gates the whole section.
export default function InvestorLayout({ children }) {
  return <RoleGuard role="investor">{children}</RoleGuard>;
}
