'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to error tracking service
    console.error('Application error:', error);
    
    // Send to error tracking (Sentry will be initialized in layout)
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      (window as any).Sentry.captureException(error);
    }
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Warning Banner */}
      <div className="bg-black text-white py-2 text-center text-sm font-semibold">
        WARNING: This product contains nicotine. Nicotine is an addictive chemical.
      </div>

      {/* Header */}
      <header className="bg-blue-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link href="/" className="text-2xl font-bold">
            LUMI
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full text-center">
          <div className="mb-8">
            <h1 className="text-9xl font-bold text-gray-300">500</h1>
            <h2 className="text-3xl font-bold text-gray-900 mt-4">Something Went Wrong</h2>
            <p className="text-gray-600 mt-4">
              We&apos;re sorry, but something unexpected happened. Our team has been notified and is working to fix the issue.
            </p>
            {process.env.NODE_ENV === 'development' && error.message && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded text-left">
                <p className="text-sm text-red-800 font-semibold">Error Details (Development Only):</p>
                <p className="text-xs text-red-700 mt-2 font-mono">{error.message}</p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <button
              onClick={reset}
              className="inline-block bg-blue-600 text-white px-8 py-3 rounded-md font-semibold hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
            <div className="text-sm text-gray-600">
              <Link href="/" className="text-blue-600 hover:underline">
                Go Back Home
              </Link>
              {' • '}
              <Link href="/products" className="text-blue-600 hover:underline">
                Browse Products
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <h3 className="text-lg font-semibold mb-4">LEGAL</h3>
              <div className="space-y-2">
                <Link href="/legal/terms" className="block hover:underline">TERMS OF USE</Link>
                <Link href="/legal/privacy" className="block hover:underline">PRIVACY POLICY</Link>
                <Link href="/legal/returns" className="block hover:underline">RETURN POLICY</Link>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">FOLLOW US</h3>
              <div className="space-y-2">
                <a href="#" className="block hover:underline">Facebook</a>
                <a href="#" className="block hover:underline">Instagram</a>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">CONTACT</h3>
              <p className="text-sm text-gray-400">
                MAILING ADDRESS<br />
                Lumi Pouches<br />
                United States
              </p>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-sm text-gray-400">
            <p>©2025 LUMI POUCHES. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
