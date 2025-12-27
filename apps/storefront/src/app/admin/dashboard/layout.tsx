'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined'
    ? window.location.origin.replace(':3000', ':3001')
    : 'http://localhost:3001');

export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<{ email: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        router.push(`/auth/login?next=${encodeURIComponent(pathname || '/admin/dashboard')}`);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          credentials: 'include',
        });

        if (!response.ok) {
          localStorage.removeItem('auth_token');
          router.push(`/auth/login?next=${encodeURIComponent(pathname || '/admin/dashboard')}`);
          return;
        }

        const data = await response.json();
        if (data.success && data.data) {
          if (data.data.role !== 'ADMIN') {
            router.push('/account');
            return;
          }
          setUser(data.data);
        } else {
          router.push(`/auth/login?next=${encodeURIComponent(pathname || '/admin/dashboard')}`);
        }
      } catch {
        localStorage.removeItem('auth_token');
        router.push(`/auth/login?next=${encodeURIComponent(pathname || '/admin/dashboard')}`);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router, pathname]);

  const handleLogout = async () => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      try {
        await fetch(`${API_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          credentials: 'include',
        });
      } catch {
        // ignore
      }
    }
    localStorage.removeItem('auth_token');
    router.push('/auth/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-8">
              <h1 className="text-xl font-semibold text-gray-900">Lumi Admin</h1>
              <div className="flex space-x-4">
                <Link href="/admin/dashboard" className="text-sm text-gray-600 hover:text-gray-900">
                  Dashboard
                </Link>
                <Link href="/admin/dashboard/orders" className="text-sm text-gray-600 hover:text-gray-900">
                  Orders
                </Link>
                <Link href="/admin/dashboard/products" className="text-sm text-gray-600 hover:text-gray-900">
                  Products
                </Link>
                <Link href="/admin/dashboard/users" className="text-sm text-gray-600 hover:text-gray-900">
                  Users
                </Link>
                <Link href="/admin/dashboard/reports/pact" className="text-sm text-gray-600 hover:text-gray-900">
                  PACT Reports
                </Link>
                <Link href="/admin/dashboard/audit" className="text-sm text-gray-600 hover:text-gray-900">
                  Audit
                </Link>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">{user.email}</span>
              <button onClick={handleLogout} className="text-sm text-gray-600 hover:text-gray-900">
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}

