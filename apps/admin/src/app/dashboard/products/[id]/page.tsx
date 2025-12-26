'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getProduct, updateProduct, presignFileUpload, updateProductImage, type ApiResponse } from '@/lib/api';

interface Product {
  id: string;
  name: string;
  sku: string;
  flavorType: string;
  nicotineMg: number;
  netWeightGrams: number;
  price: string;
  caUtlApproved: boolean;
  sensoryCooling: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [product, setProduct] = useState<Product | null>(null);
  
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
    imageUrl: '',
  });
  
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    const loadProduct = async () => {
      try {
        const response = await getProduct(productId);
        if (response.success && response.data) {
          const p = response.data;
          setProduct(p);
          setFormData({
            name: p.name,
            sku: p.sku,
            flavorType: p.flavorType,
            nicotineMg: p.nicotineMg.toString(),
            netWeightGrams: p.netWeightGrams.toString(),
            price: p.price,
            caUtlApproved: p.caUtlApproved,
            sensoryCooling: p.sensoryCooling,
            active: p.active,
            imageUrl: p.imageUrl || '',
          });
        } else {
          setError(response.error?.message || 'Failed to load product');
        }
      } catch (err) {
        setError('Network error. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    if (productId) {
      loadProduct();
    }
  }, [productId]);

  const handleImageUpload = async (file: File) => {
    setUploadingImage(true);
    try {
      // Generate a unique key for the file
      const key = `products/${productId}/${Date.now()}-${file.name}`;
      
      // Get presigned URL
      const presignResponse = await presignFileUpload({
        key,
        contentType: file.type,
        sizeBytes: file.size,
      });

      if (!presignResponse.success || !presignResponse.data) {
        throw new Error('Failed to get upload URL');
      }

      // Upload file to R2
      const uploadResponse = await fetch(presignResponse.data.url, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file');
      }

      // Get public URL (assuming R2_PUBLIC_URL is set)
      const publicUrl = `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL || ''}/${key}`;

      // Update product with image URL
      const updateResponse = await updateProductImage(productId, {
        imageUrl: publicUrl,
      });

      if (updateResponse.success) {
        setFormData({ ...formData, imageUrl: publicUrl });
        setImageFile(null);
      } else {
        throw new Error(updateResponse.error?.message || 'Failed to update product image');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      // Upload image if file selected
      if (imageFile) {
        await handleImageUpload(imageFile);
      }

      const response = await updateProduct(productId, {
        name: formData.name,
        sku: formData.sku,
        flavorType: formData.flavorType,
        nicotineMg: parseFloat(formData.nicotineMg),
        netWeightGrams: parseFloat(formData.netWeightGrams),
        price: parseFloat(formData.price),
        caUtlApproved: formData.caUtlApproved,
        sensoryCooling: formData.sensoryCooling,
        active: formData.active,
        imageUrl: formData.imageUrl || null,
      });

      if (response.success) {
        router.push('/dashboard/products');
      } else {
        setError(response.error?.message || 'Failed to update product');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="px-4 py-6">
        <div className="text-center py-8 text-gray-600">Loading product...</div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="px-4 py-6">
        <div className="text-center py-8 text-red-600">Product not found</div>
        <Link href="/dashboard/products" className="text-indigo-600 hover:text-indigo-900">
          ← Back to Products
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      <div className="mb-6">
        <Link href="/dashboard/products" className="text-indigo-600 hover:text-indigo-900">
          ← Back to Products
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Product</h1>

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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Product Image
            </label>
            {formData.imageUrl && (
              <div className="mb-2 relative w-32 h-32">
                <Image
                  src={formData.imageUrl}
                  alt="Product"
                  fill
                  className="object-cover rounded-md"
                  unoptimized
                />
              </div>
            )}
            <div className="flex gap-4">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setImageFile(file);
                  }
                }}
                className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              />
              {imageFile && (
                <button
                  type="button"
                  onClick={() => handleImageUpload(imageFile)}
                  disabled={uploadingImage}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 text-sm"
                >
                  {uploadingImage ? 'Uploading...' : 'Upload Image'}
                </button>
              )}
            </div>
            <input
              type="text"
              placeholder="Or enter image URL"
              value={formData.imageUrl}
              onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
              className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex justify-end space-x-4 pt-4">
            <Link
              href="/dashboard/products"
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
    </div>
  );
}

