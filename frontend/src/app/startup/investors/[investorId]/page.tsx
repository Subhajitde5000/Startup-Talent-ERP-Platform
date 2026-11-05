"use client";
import { useParams } from "next/navigation";
import InvestorPages from "../InvestorPages";
export default function Page() {
  const p = useParams<{ investorId: string }>();
  return <InvestorPages view="profile" investorId={p.investorId} />;
}
