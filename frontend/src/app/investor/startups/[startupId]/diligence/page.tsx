"use client";
import { useParams } from "next/navigation";
import InvestorRollPage from "../../../InvestorRollPage";
export default function InvestorDiligencePage() {
  const { startupId } = useParams<{ startupId: string }>();
  return <InvestorRollPage section="diligence" startupId={startupId} />;
}
