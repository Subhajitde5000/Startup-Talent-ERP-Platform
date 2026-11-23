import { Suspense } from 'react';
import InvestorApp from './investor-app';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <InvestorApp page="hub" />
    </Suspense>
  );
}
