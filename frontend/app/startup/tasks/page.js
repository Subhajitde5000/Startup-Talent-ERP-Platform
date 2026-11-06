import { Suspense } from 'react';
import TasksPage from './tasks-page';

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FAF8F4] flex items-center justify-center text-sm text-[#4A5568]">Loading tasks...</div>}>
      <TasksPage />
    </Suspense>
  );
}
