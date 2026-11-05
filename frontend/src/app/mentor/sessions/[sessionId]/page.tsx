"use client";
import { useParams } from "next/navigation";
import MentorRollPage from "../../MentorRollPage";
export default function SessionDetailPage() {
  const p = useParams<{ sessionId: string }>();
  return <MentorRollPage section="session-detail" sessionId={p.sessionId} />;
}
