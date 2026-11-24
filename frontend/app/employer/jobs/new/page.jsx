'use client';

import EmployerJobForm from '@/components/employer-job-form';
import { JobsPage } from '@/components/employer-jobs-workspace';

export default function NewJobPage() {
  return <JobsPage><EmployerJobForm /></JobsPage>;
}
