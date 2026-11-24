'use client';
import { usePathname } from 'next/navigation';
import RoleGuard from '@/components/role-guard';
import { isPublicCareerRoute } from '@/lib/career-routes';

export default function JobseekerLayout({ children }) {
  const pathname = usePathname();
  return isPublicCareerRoute(pathname) ? children : <RoleGuard role="jobseeker">{children}</RoleGuard>;
}
