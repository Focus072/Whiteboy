import { Suspense } from 'react';
import VerifyEmailClient from './VerifyEmailClient';

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col bg-white">
        <div className="bg-black text-white py-2 text-center text-sm font-semibold">
          WARNING: This product contains nicotine. Nicotine is an addictive chemical.
        </div>
        <header className="bg-blue-600 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="text-2xl font-bold">LUMI</div>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
          <div className="text-gray-600">Loading...</div>
        </main>
      </div>
    }>
      <VerifyEmailClient />
    </Suspense>
  );
}
