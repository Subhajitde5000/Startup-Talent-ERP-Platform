import RoleGuard from '@/components/role-guard';

// Step 2 auth guard: every route under /jobseeker/ requires the "jobseeker" role.
// Pages render their own shell/sidebar; this gates the whole section.
export default function JobseekerLayout({ children }) {
  return <RoleGuard role="jobseeker">{children}</RoleGuard>;
}
