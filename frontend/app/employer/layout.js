'use client';
import { usePathname } from 'next/navigation';
import RoleGuard from '@/components/role-guard';

export default function EmployerLayout({ children }) {
  const path = usePathname();
  const hiringInsights = ['/employer/dashboard', '/employer/analytics', '/employer/activity'].includes(path);
  return <RoleGuard role="employer" roles={hiringInsights ? ['employer', 'startup'] : undefined}>{children}</RoleGuard>;
}
