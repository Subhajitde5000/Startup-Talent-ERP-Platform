"use client";
import { useParams } from "next/navigation";
import InvestorPages from "../../investors/InvestorPages";
export default function Page() {
  const p = useParams<{ roundId: string }>();
  return <InvestorPages view="round" roundId={p.roundId} />;
}
