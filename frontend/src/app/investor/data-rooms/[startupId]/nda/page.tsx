"use client";
import { useParams } from "next/navigation";
import InvestorRollPage from "../../../InvestorRollPage";
export default function InvestorNdaPage() {
  const { startupId } = useParams<{ startupId: string }>();
  return <InvestorRollPage section="nda" startupId={startupId} />;
}
