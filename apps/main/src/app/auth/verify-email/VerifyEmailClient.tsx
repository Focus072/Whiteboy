'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function VerifyEmailClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Invalid verification link.');
      setLoading(false);
      return;
    }

    const verifyEmail = async () => {
      try {
        const response = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (data.success) {
          setSuccess(true);
        } else {
          setError(data.error?.message || 'Failed to verify email');
        }
      } catch (err) {
        setError('Network error. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    verifyEmail();
  }, [token]);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <div className="bg-black text-white py-2 text-center text-sm font-semibold">
        WARNING: This product contains nicotine. Nicotine is an addictive chemical.
      </div>

      <header className="bg-blue-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link href="/" className="text-2xl font-bold">
            LUMI
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full text-center">
          {loading && (
            <div>
              <p className="text-gray-600">Verifying your email...</p>
            </div>
          )}

          {success && (
            <div>
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4">
                Email verified successfully!
              </div>
              <Link
                href="/account"
                className="inline-block bg-blue-600 text-white px-6 py-3 rounded-md font-semibold hover:bg-blue-700"
              >
                Go to Account
              </Link>
            </div>
          )}

          {error && (
            <div>
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                {error}
              </div>
              <div className="space-y-2">
                <Link
                  href="/auth/login"
                  className="block text-blue-600 hover:underline"
                >
                  Go to login
                </Link>
                <Link
                  href="/"
                  className="block text-blue-600 hover:underline"
                >
                  Go to homepage
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
