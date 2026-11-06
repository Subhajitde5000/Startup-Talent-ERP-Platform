import { HireDetailPage } from '../../employer-process-setup';
export default function Page({ params }) {
  return <HireDetailPage page="hires" hireId={String(params.hireId)} />;
}
