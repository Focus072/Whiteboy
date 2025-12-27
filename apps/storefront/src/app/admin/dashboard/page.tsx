'use client';

import { useEffect, useState, useCallback } from 'react';
import { getDashboardStats } from '@/lib/admin-api';
import Link from 'next/link';

interface DashboardStats {
  orders: {
    paid: number;
    shipped: number;
    blocked: number;
    total: number;
    byStatus: Array<{ status: string; count: number }>;
  };
  revenue: {
    today: number;
    week: number;
    month: number;
    total: number;
    daily: Array<{ date: string; count: number; revenue: number }>;
  };
  products: {
    active: number;
    total: number;
  };
  recentOrders: Array<{
    id: string;
    status: string;
    totalAmount: number;
    createdAt: string;
    itemCount: number;
    state: string;
  }>;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadStats = useCallback(async () => {
    try {
      const response = await getDashboardStats();
      if (response.success && response.data) {
        setStats(response.data);
      } else {
        setError(response.error?.message || 'Failed to load dashboard stats');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, [loadStats]);

  if (loading) {
    return (
      <div className="px-4 py-6">
        <div className="text-center py-8 text-gray-600">Loading dashboard...</div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="px-4 py-6">
        <div className="rounded-md bg-red-50 p-4">
          <div className="text-sm text-red-800">{error || 'Failed to load dashboard'}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-white shadow rounded-lg p-6">
          <div className="text-sm font-medium text-gray-500">Total Orders</div>
          <div className="mt-2 text-3xl font-bold text-gray-900">{stats.orders.total}</div>
          <div className="mt-2 text-sm text-gray-600">
            <span className="text-green-600">{stats.orders.shipped} shipped</span>
            {' • '}
            <span className="text-blue-600">{stats.orders.paid} paid</span>
            {' • '}
            <span className="text-red-600">{stats.orders.blocked} blocked</span>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <div className="text-sm font-medium text-gray-500">Total Revenue</div>
          <div className="mt-2 text-3xl font-bold text-gray-900">${stats.revenue.total.toFixed(2)}</div>
          <div className="mt-2 text-sm text-gray-600">${stats.revenue.month.toFixed(2)} this month</div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <div className="text-sm font-medium text-gray-500">Active Products</div>
          <div className="mt-2 text-3xl font-bold text-gray-900">{stats.products.active}</div>
          <div className="mt-2 text-sm text-gray-600">{stats.products.total} total products</div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <div className="text-sm font-medium text-gray-500">Today&apos;s Revenue</div>
          <div className="mt-2 text-3xl font-bold text-gray-900">${stats.revenue.today.toFixed(2)}</div>
          <div className="mt-2 text-sm text-gray-600">${stats.revenue.week.toFixed(2)} this week</div>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Orders by Status</h2>
        <div className="space-y-2">
          {stats.orders.byStatus.map((item) => (
            <div key={item.status} className="flex items-center">
              <div className="w-24 text-sm text-gray-600">{item.status}</div>
              <div className="flex-1 bg-gray-200 rounded-full h-6 relative">
                <div
                  className={`h-6 rounded-full ${
                    item.status === 'SHIPPED'
                      ? 'bg-green-500'
                      : item.status === 'PAID'
                        ? 'bg-blue-500'
                        : item.status === 'BLOCKED'
                          ? 'bg-red-500'
                          : 'bg-gray-500'
                  }`}
                  style={{ width: `${(item.count / stats.orders.total) * 100}%` }}
                />
                <span className="absolute left-2 top-0.5 text-xs text-white font-medium">{item.count}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Orders</h2>
          <Link href="/admin/dashboard/orders" className="text-sm text-indigo-600 hover:text-indigo-900">
            View all →
          </Link>
        </div>
        {stats.recentOrders.length === 0 ? (
          <p className="text-gray-600">No recent orders</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">State</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stats.recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td className="px-4 py-3 text-sm font-mono text-gray-900">
                      <Link
                        href={`/admin/dashboard/orders/${order.id}`}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        {order.id.substring(0, 8)}...
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          order.status === 'SHIPPED'
                            ? 'bg-green-100 text-green-800'
                            : order.status === 'PAID'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">${order.totalAmount.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{order.state}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{new Date(order.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

