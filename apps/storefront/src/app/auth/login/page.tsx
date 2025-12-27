import { Suspense } from 'react';
import LoginPageClient from './page.client';

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-gray-600">Loading...</div>
        </div>
      }
    >
      <LoginPageClient />
    </Suspense>
  );
}

