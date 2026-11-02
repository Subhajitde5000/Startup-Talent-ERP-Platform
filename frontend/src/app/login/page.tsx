import React from 'react';
import { AuthSplitLayout } from '@/components/AuthSplitLayout';
import { LoginForm } from '@/components/LoginForm';

export default function LoginPage() {
  return (
    <AuthSplitLayout>
      <LoginForm />
    </AuthSplitLayout>
  );
}
