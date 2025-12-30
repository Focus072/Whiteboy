'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createProduct } from '@/lib/admin-api';

export default function NewProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    flavorType: 'TOBACCO',
    nicotineMg: '',
    netWeightGrams: '',
    price: '',
    caUtlApproved: false,
    sensoryCooling: false,
    active: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await createProduct({
        name: formData.name,
        sku: formData.sku,
        flavorType: formData.flavorType,
        nicotineMg: parseFloat(formData.nicotineMg),
        netWeightGrams: parseFloat(formData.netWeightGrams),
        price: parseFloat(formData.price),
        caUtlApproved: formData.caUtlApproved,
        sensoryCooling: formData.sensoryCooling,
        active: formData.active,
      });

      if (response.success) {
        router.push('/admin/dashboard/products');
      } else {
        setError(response.error?.message || 'Failed to create product');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 py-6">
      <div className="mb-6">
        <Link href="/admin/dashboard/products" className="text-indigo-600 hover:text-indigo-900">
          ← Back to Products
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Create Product</h1>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4">
          <div className="text-sm text-red-800">{error}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6 max-w-2xl">
        <div className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Product Name *
            </label>
            <input
              type="text"
              id="name"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="sku" className="block text-sm font-medium text-gray-700 mb-1">
              SKU *
            </label>
            <input
              type="text"
              id="sku"
              required
              value={formData.sku}
              onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="flavorType" className="block text-sm font-medium text-gray-700 mb-1">
                Flavor Type *
              </label>
              <select
                id="flavorType"
                required
                value={formData.flavorType}
                onChange={(e) => setFormData({ ...formData, flavorType: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="TOBACCO">Tobacco</option>
                <option value="MENTHOL">Menthol</option>
                <option value="FRUIT">Fruit</option>
                <option value="DESSERT">Dessert</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-1">
                Price ($) *
              </label>
              <input
                type="number"
                id="price"
                required
                step="0.01"
                min="0"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="nicotineMg" className="block text-sm font-medium text-gray-700 mb-1">
                Nicotine (mg) *
              </label>
              <input
                type="number"
                id="nicotineMg"
                required
                step="0.1"
                min="0"
                value={formData.nicotineMg}
                onChange={(e) => setFormData({ ...formData, nicotineMg: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label htmlFor="netWeightGrams" className="block text-sm font-medium text-gray-700 mb-1">
                Weight (grams) *
              </label>
              <input
                type="number"
                id="netWeightGrams"
                required
                step="0.1"
                min="0"
                value={formData.netWeightGrams}
                onChange={(e) => setFormData({ ...formData, netWeightGrams: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.caUtlApproved}
                onChange={(e) => setFormData({ ...formData, caUtlApproved: e.target.checked })}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">CA UTL Approved</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.sensoryCooling}
                onChange={(e) => setFormData({ ...formData, sensoryCooling: e.target.checked })}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">Sensory Cooling</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.active}
                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">Active</span>
            </label>
          </div>

          <div className="flex justify-end space-x-4 pt-4">
            <Link
              href="/admin/dashboard/products"
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Product'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

