import { Suspense } from 'react';
import InvestorApp from '../investors/investor-app';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <InvestorApp page="meetings" />
    </Suspense>
  );
}
