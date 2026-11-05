"use client";
import { useParams } from "next/navigation";
import HiringWorkspacePage from "../../../HiringWorkspace";
export default function Page() {
  const params = useParams<{ jobId: string; applicantId: string }>();
  return (
    <HiringWorkspacePage view="candidate" jobId={params.jobId} applicantId={params.applicantId} />
  );
}
