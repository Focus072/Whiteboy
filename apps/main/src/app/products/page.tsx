'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getProducts, type ApiResponse } from '@/lib/api';
import { useCart } from '@/lib/cart';
import { ProductListSkeleton } from '@/components/LoadingSkeleton';
import CustomerHeader from '@/components/CustomerHeader';

interface Product {
  id: string;
  name: string;
  sku: string;
  flavorType: string;
  nicotineMg: number;
  netWeightGrams: number;
  caUtlApproved: boolean;
  sensoryCooling: boolean;
  imageUrl?: string | null;
  price: string;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [flavorFilter, setFlavorFilter] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const { addItem } = useCart();

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getProducts({
        search: searchQuery || undefined,
        flavorType: flavorFilter || undefined,
        sort: sortBy,
      });
      if (response.success && response.data) {
        setProducts(response.data);
      } else {
        setError(response.error?.message || 'Failed to load products');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, flavorFilter, sortBy]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadProducts();
  };

  const handleAddToCart = (product: Product) => {
    addItem(product, 1);
  };

  const getFlavorTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      TOBACCO: 'Tobacco',
      MENTHOL: 'Menthol',
      FRUIT: 'Fruit',
      DESSERT: 'Dessert',
      OTHER: 'Other',
    };
    return labels[type] || type;
  };

  const isCaRestricted = (product: Product) => {
    return product.flavorType !== 'TOBACCO' || product.sensoryCooling || !product.caUtlApproved;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <CustomerHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 mb-4">
            OUR FLAVORS
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Discover our premium selection of nicotine pouches. Each flavor is carefully crafted for the perfect experience.
          </p>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <form onSubmit={handleSearch} className="mb-6">
            <div className="flex gap-4">
              <input
                type="text"
                placeholder="Search flavors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="submit"
                className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
              >
                Search
              </button>
            </div>
          </form>
          
          <div className="flex flex-wrap gap-4 items-center">
            <label className="text-sm font-semibold text-gray-700">Filter by Flavor:</label>
            <select
              value={flavorFilter}
              onChange={(e) => setFlavorFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">All Flavors</option>
              <option value="TOBACCO">Tobacco</option>
              <option value="MENTHOL">Menthol</option>
              <option value="FRUIT">Fruit</option>
              <option value="DESSERT">Dessert</option>
              <option value="OTHER">Other</option>
            </select>

            <label className="text-sm font-semibold text-gray-700 ml-4">Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="name">Name (A-Z)</option>
              <option value="price-asc">Price (Low to High)</option>
              <option value="price-desc">Price (High to Low)</option>
              <option value="nicotine-asc">Nicotine (Low to High)</option>
              <option value="nicotine-desc">Nicotine (High to Low)</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-md bg-red-50 p-4">
            <div className="text-sm text-red-800">{error}</div>
          </div>
        )}

        {loading ? (
          <ProductListSkeleton count={6} />
        ) : products.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-lg shadow-md">
            <div className="text-gray-400 mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No products found</h3>
            <p className="text-gray-600 mb-4">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {products.map((product) => (
              <div 
                key={product.id} 
                className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group"
              >
                {/* Product Image */}
                {product.imageUrl ? (
                  <div className="relative aspect-square bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden">
                    <Image
                      src={product.imageUrl}
                      alt={product.name}
                      fill
                      className="object-cover group-hover:scale-110 transition-transform duration-300"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                    />
                    {isCaRestricted(product) && (
                      <div className="absolute top-2 right-2">
                        <span className="px-2 py-1 text-xs font-bold bg-orange-500 text-white rounded-md shadow-lg">
                          CA Restricted
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="aspect-square bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
                    <div className="text-center p-4">
                      <div className="text-4xl mb-2">📦</div>
                      <div className="text-sm font-medium text-gray-600">LUMI</div>
                      {isCaRestricted(product) && (
                        <div className="mt-2">
                          <span className="px-2 py-1 text-xs font-bold bg-orange-500 text-white rounded-md">
                            CA Restricted
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Product Info */}
                <div className="p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-3 line-clamp-2 group-hover:text-blue-600 transition-colors">
                    {product.name}
                  </h2>

                  {/* Product Details Grid */}
                  <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
                    <div className="bg-gray-50 rounded-lg p-2">
                      <div className="text-xs text-gray-500 font-medium mb-1">FLAVOR</div>
                      <div className="text-gray-900 font-semibold">{getFlavorTypeLabel(product.flavorType)}</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <div className="text-xs text-gray-500 font-medium mb-1">NICOTINE</div>
                      <div className="text-gray-900 font-semibold">{product.nicotineMg}mg</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <div className="text-xs text-gray-500 font-medium mb-1">WEIGHT</div>
                      <div className="text-gray-900 font-semibold">{product.netWeightGrams}g</div>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-2">
                      <div className="text-xs text-blue-600 font-medium mb-1">PRICE</div>
                      <div className="text-blue-600 font-bold text-lg">${product.price}</div>
                    </div>
                  </div>

                  {/* Add to Cart Button */}
                  <button
                    onClick={() => handleAddToCart(product)}
                    className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    Add to Cart
                  </button>

                  {/* SKU */}
                  <div className="mt-3 text-xs text-gray-400 text-center">
                    SKU: {product.sku}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
