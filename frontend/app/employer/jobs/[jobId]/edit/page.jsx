'use client';

import { useParams } from 'next/navigation';
import EmployerJobForm from '@/components/employer-job-form';
import { JobsPage, JobNotice, useJob } from '@/components/employer-jobs-workspace';

function EditJob() {
  const { jobId } = useParams();
  const { job, loading, error, reload } = useJob(jobId);
  if (loading) return <JobNotice>Loading job…</JobNotice>;
  if (error) return <JobNotice error retry={reload}>{error}</JobNotice>;
  return <EmployerJobForm key={job.id} job={job} />;
}

export default function EditJobPage() {
  return <JobsPage><EditJob /></JobsPage>;
}
