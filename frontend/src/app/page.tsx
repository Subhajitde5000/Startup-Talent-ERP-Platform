import React from 'react';
import { AuthSplitLayout } from '@/components/AuthSplitLayout';
import { LoginForm } from '@/components/LoginForm';

export default function HomePage() {
  return (
    <AuthSplitLayout>
      <LoginForm />
    </AuthSplitLayout>
  );
}
