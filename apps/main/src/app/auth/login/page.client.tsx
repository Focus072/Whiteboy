'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPageClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  // Fetch CSRF token on mount
  useEffect(() => {
    fetch('/api/csrf-token', {
      credentials: 'include', // Include cookies for session ID
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data?.token) {
          setCsrfToken(data.data.token);
        }
      })
      .catch(() => {
        // CSRF token is optional, continue without it
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
        },
        credentials: 'include', // Include cookies for CSRF validation
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success && data.data?.token) {
        localStorage.setItem('auth_token', data.data.token);
        
        // Get user info to check role
        const userResponse = await fetch('/api/me', {
          headers: {
            Authorization: `Bearer ${data.data.token}`,
          },
        });
        
        const userData = await userResponse.json();
        const userRole = userData.data?.role;
        
        // Redirect based on role: Admin → /admin, Customer → /products
        if (userRole === 'ADMIN' || userRole === 'FULFILLMENT' || userRole === 'READ_ONLY') {
          router.push('/admin');
        } else {
          router.push('/products');
        }
      } else {
        setError(data.error?.message || 'Login failed');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Warning Banner */}
      <div className="bg-black text-white py-2 text-center text-sm font-semibold">
        WARNING: This product contains nicotine. Nicotine is an addictive chemical.
      </div>

      {/* Header */}
      <header className="bg-blue-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <button className="lg:hidden text-white focus:outline-none">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <Link href="/" className="text-2xl font-bold">
                LUMI
              </Link>
            </div>
            <Link href="/auth/signup" className="text-sm hover:underline flex items-center space-x-1">
              <span>REGISTER</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          <h1 className="text-4xl font-bold text-center text-gray-900 mb-8">
            LOG IN TO YOUR ACCOUNT
          </h1>

          {/* Login Form */}
          <div className="bg-white border border-gray-300 rounded-lg p-8 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your email"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your password"
                />
              </div>

              <div className="flex items-center">
                <input
                  id="remember"
                  type="checkbox"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="remember" className="ml-2 block text-sm text-gray-700">
                  Remember me?
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white px-6 py-3 rounded-md font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'LOGGING IN...' : 'LOG IN'}
              </button>

                  <div className="text-center space-y-2">
                    <Link href="/auth/forgot-password" className="text-sm text-blue-600 hover:underline block">
                      Reset/Forgot password?
                    </Link>
                <p className="text-sm text-gray-600">
                  Don&apos;t have an account?{' '}
                  <Link href="/auth/signup" className="text-blue-600 hover:underline font-medium">
                    Register
                  </Link>
                </p>
              </div>
            </form>
          </div>

          {/* Age Verification Disclaimer */}
          <div className="mt-8 text-center text-sm text-gray-600 space-y-2">
            <p className="font-semibold">LUMI IS FOR ADULT NICOTINE CONSUMERS 21+ ONLY.</p>
            <p>
              By logging in, you confirm that you are of legal age to purchase nicotine products in your jurisdiction.
              Age verification will be required upon checkout and delivery.
            </p>
            <p className="text-xs mt-4">
              WARNING: This product contains nicotine. Nicotine is an addictive chemical. Keep out of reach of children and pets.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <h3 className="text-lg font-semibold mb-4">FOLLOW US</h3>
              <div className="space-y-2">
                <a href="#" className="block hover:underline">Facebook</a>
                <a href="#" className="block hover:underline">Instagram</a>
              </div>
            </div>
            <div>
                <h3 className="text-lg font-semibold mb-4">LEGAL</h3>
                <div className="space-y-2">
                  <Link href="/legal/terms" className="block hover:underline">TERMS OF USE</Link>
                  <Link href="/legal/privacy" className="block hover:underline">PRIVACY POLICY</Link>
                  <Link href="/legal/returns" className="block hover:underline">RETURN POLICY</Link>
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
