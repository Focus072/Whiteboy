'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { getUser, updateUser, resetUserPassword } from '@/lib/admin-api';

interface User {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  disabledAt: string | null;
}

export default function EditUserPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [user, setUser] = useState<User | null>(null);

  const [formData, setFormData] = useState({
    email: '',
    role: 'READ_ONLY',
    disabled: false,
  });

  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    const loadUser = async () => {
      try {
        const response = await getUser(userId);
        if (response.success && response.data) {
          const u = response.data;
          setUser(u);
          setFormData({
            email: u.email,
            role: u.role,
            disabled: !!u.disabledAt,
          });
        } else {
          setError(response.error?.message || 'Failed to load user');
        }
      } catch {
        setError('Network error. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    if (userId) loadUser();
  }, [userId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const response = await updateUser(userId, {
        email: formData.email,
        role: formData.role,
        disabled: formData.disabled,
      });

      if (response.success) {
        setSuccess('User updated successfully');
        setTimeout(() => router.push('/admin/dashboard/users'), 1000);
      } else {
        setError(response.error?.message || 'Failed to update user');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (passwordData.newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setResetting(true);
    try {
      const response = await resetUserPassword(userId, passwordData.newPassword);
      if (response.success) {
        setSuccess('Password reset successfully');
        setPasswordData({ newPassword: '', confirmPassword: '' });
      } else {
        setError(response.error?.message || 'Failed to reset password');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="px-4 py-6">
        <div className="text-center py-8 text-gray-600">Loading user...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="px-4 py-6">
        <div className="text-center py-8 text-red-600">User not found</div>
        <Link href="/admin/dashboard/users" className="text-indigo-600 hover:text-indigo-900">
          ← Back to Users
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      <div className="mb-6">
        <Link href="/admin/dashboard/users" className="text-indigo-600 hover:text-indigo-900">
          ← Back to Users
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit User</h1>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4">
          <div className="text-sm text-red-800">{error}</div>
        </div>
      )}

      {success && (
        <div className="mb-4 rounded-md bg-green-50 p-4">
          <div className="text-sm text-green-800">{success}</div>
        </div>
      )}

      <div className="space-y-6">
        <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6 max-w-2xl">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">User Information</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email *
              </label>
              <input
                type="email"
                id="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                Role *
              </label>
              <select
                id="role"
                required
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="READ_ONLY">Read Only</option>
                <option value="FULFILLMENT">Fulfillment</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>

            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.disabled}
                  onChange={(e) => setFormData({ ...formData, disabled: e.target.checked })}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">Disabled</span>
              </label>
            </div>

            <div className="flex justify-end space-x-4 pt-4">
              <Link
                href="/admin/dashboard/users"
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>

        <form onSubmit={handleResetPassword} className="bg-white shadow rounded-lg p-6 max-w-2xl">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Reset Password</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                New Password * (min 8 characters)
              </label>
              <input
                type="password"
                id="newPassword"
                required
                minLength={8}
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password *
              </label>
              <input
                type="password"
                id="confirmPassword"
                required
                minLength={8}
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={resetting}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {resetting ? 'Resetting...' : 'Reset Password'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

