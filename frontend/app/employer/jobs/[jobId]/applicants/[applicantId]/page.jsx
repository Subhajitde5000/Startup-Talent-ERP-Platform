'use client';

import { useParams } from 'next/navigation';
import { ApplicantDetailPage } from '@/components/employer-applicant-pipeline';

export default function CandidateProfilePage() {
  const { jobId, applicantId } = useParams();
  return <ApplicantDetailPage jobId={jobId} applicationId={applicantId} />;
}
