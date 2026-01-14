'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface Product {
  id: string;
  name: string;
  sku: string;
  flavorType: string;
  nicotineMg: number;
  price: string;
  imageUrl?: string | null;
}

export default function LandingPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch featured products
    fetch('/api/products?limit=4')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setProducts(data.slice(0, 4));
        }
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const getFlavorTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      TOBACCO: 'Classic',
      MENTHOL: 'Chilled Mint',
      FRUIT: 'Tropical Fruit',
      DESSERT: 'Sweet Nectar',
      OTHER: 'Spearmint',
    };
    return labels[type] || type;
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Warning Banner */}
      <div className="bg-black text-white py-2 text-center text-sm font-semibold">
        WARNING: This product contains nicotine. Nicotine is an addictive chemical.
      </div>

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <Link href="/" className="text-3xl font-bold text-gray-900">
              LUMI
            </Link>
            <nav className="hidden md:flex items-center space-x-6">
              <Link href="/products" className="text-gray-700 hover:text-gray-900 font-medium">
                SHOP
              </Link>
              <Link href="/auth/login" className="text-gray-700 hover:text-gray-900 font-medium">
                LOGIN
              </Link>
              <Link
                href="/cart"
                className="bg-blue-600 text-white px-4 py-2 rounded-md font-medium hover:bg-blue-700 transition-colors"
              >
                CART
              </Link>
            </nav>
            <button className="md:hidden text-gray-700">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-blue-50 to-white py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-5xl lg:text-7xl font-bold text-gray-900 mb-6">
              LUMI POUCHES
            </h1>
            <p className="text-xl lg:text-2xl text-gray-600 mb-8 max-w-2xl mx-auto">
              Premium nicotine pouches. Better quality. Better experience.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/products"
                className="bg-blue-600 text-white px-8 py-4 rounded-md text-lg font-semibold hover:bg-blue-700 transition-colors inline-block"
              >
                SHOP NOW
              </Link>
              <Link
                href="/auth/signup"
                className="bg-white text-blue-600 border-2 border-blue-600 px-8 py-4 rounded-md text-lg font-semibold hover:bg-blue-50 transition-colors inline-block"
              >
                CREATE ACCOUNT
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Product Showcase */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-4">
            MOTHER NATURE&apos;S FINEST
          </h2>
          <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
            Discover our premium collection of nicotine pouches in bold, refreshing flavors
          </p>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-gray-100 rounded-lg h-64 animate-pulse" />
              ))}
            </div>
          ) : products.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
              {products.map((product) => (
                <Link
                  key={product.id}
                  href={`/products/${product.id}`}
                  className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow group"
                >
                  {product.imageUrl ? (
                    <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-4 relative">
                      <Image
                        src={product.imageUrl}
                        alt={product.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                      />
                    </div>
                  ) : (
                    <div className="aspect-square bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg mb-4 flex items-center justify-center">
                      <span className="text-4xl font-bold text-blue-600">LUMI</span>
                    </div>
                  )}
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {getFlavorTypeLabel(product.flavorType)}
                  </h3>
                  <p className="text-gray-600 mb-2">{product.nicotineMg}mg Nicotine</p>
                  <p className="text-2xl font-bold text-blue-600">${product.price}</p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-600 mb-4">No products available yet</p>
              <Link
                href="/products"
                className="text-blue-600 hover:underline font-medium"
              >
                View All Products →
              </Link>
            </div>
          )}

          <div className="text-center">
            <Link
              href="/products"
              className="inline-block bg-blue-600 text-white px-8 py-3 rounded-md font-semibold hover:bg-blue-700 transition-colors"
            >
              VIEW ALL PRODUCTS
            </Link>
          </div>
        </div>
      </section>

      {/* A Better Brand Section */}
      <section className="py-20 bg-blue-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold mb-6">A BETTER BRAND</h2>
          <p className="text-xl mb-8 max-w-3xl mx-auto leading-relaxed">
            &quot;A Better Time&quot; isn&apos;t just a tagline, it&apos;s a promise. We love nicotine pouches,
            and we&apos;re here to share that love. Better products, better experiences, and a genuine
            commitment to quality. That&apos;s why LUMI delivers a smooth, satisfying experience that
            stands out from the rest.
          </p>
          <Link
            href="/products"
            className="inline-block bg-white text-blue-600 px-8 py-3 rounded-md font-semibold hover:bg-gray-100 transition-colors"
          >
            LEARN ABOUT LUMI
          </Link>
        </div>
      </section>

      {/* A Better Product Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-6">A BETTER PRODUCT</h2>
          <p className="text-center text-gray-600 mb-12 max-w-3xl mx-auto text-lg">
            Why settle for dry, flavorless nicotine pouches when you can have LUMI? Our pouches are
            perfectly moist, bursting with bold flavors that pack a punch. You deserve more, and
            that&apos;s why LUMI delivers a smooth, satisfying experience every time.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            <div className="text-center">
              <div className="text-5xl mb-4">📦</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">20 POUCHES</h3>
              <p className="text-gray-600">
                More pouches than most competitors. We pack 20 pouches in every tin so you get
                more value for your money.
              </p>
            </div>
            <div className="text-center">
              <div className="text-5xl mb-4">💪</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">3 STRENGTHS</h3>
              <p className="text-gray-600">
                Something for everyone. Pick from 3mg, 6mg, and 9mg nicotine strengths to find
                your perfect experience.
              </p>
            </div>
            <div className="text-center">
              <div className="text-5xl mb-4">💧</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">NO DRY POUCHES</h3>
              <p className="text-gray-600">
                Perfectly moist pouches for bolder flavor and better nicotine delivery. Every
                pouch is fresh and flavorful.
              </p>
            </div>
          </div>

          <div className="text-center">
            <Link
              href="/products"
              className="inline-block bg-blue-600 text-white px-8 py-3 rounded-md font-semibold hover:bg-blue-700 transition-colors"
            >
              SHOP NOW
            </Link>
          </div>
        </div>
      </section>

      {/* Comparison Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-6">LUMI VS. THEM</h2>
          <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
            Let&apos;s skip the debate. Just take a look at the difference for yourself. LUMI speaks
            for itself, and trust us, it&apos;s not even a close call.
          </p>

          <div className="bg-white rounded-lg shadow-lg overflow-hidden max-w-4xl mx-auto">
            <div className="grid grid-cols-3 gap-4 p-6 border-b border-gray-200 font-semibold text-gray-900">
              <div>FEATURE</div>
              <div className="text-center">LUMI</div>
              <div className="text-center">OTHER BRANDS</div>
            </div>
            {[
              { feature: '20 Pouches Per Tin', lumi: '✓', other: '✗' },
              { feature: '3 Strength Options', lumi: '✓', other: '✗' },
              { feature: 'Satisfyingly Moist', lumi: '✓', other: '✗' },
              { feature: 'Better Flavors', lumi: '✓', other: '✗' },
              { feature: 'Premium Quality', lumi: '✓', other: '✗' },
            ].map((row, i) => (
              <div
                key={i}
                className="grid grid-cols-3 gap-4 p-6 border-b border-gray-100 last:border-0"
              >
                <div className="text-gray-700">{row.feature}</div>
                <div className="text-center text-green-600 font-bold text-xl">{row.lumi}</div>
                <div className="text-center text-red-600 font-bold text-xl">{row.other}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter Section */}
      <section className="py-20 bg-blue-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold mb-4">THEY SAY ALL GOOD THINGS MUST COME TO AN END</h2>
          <h3 className="text-5xl font-bold mb-6">BUT THIS IS JUST THE BEGINNING</h3>
          <p className="text-xl mb-8 max-w-2xl mx-auto">
            Stay updated with the latest LUMI products, exclusive offers, and news.
          </p>
          <form className="max-w-md mx-auto flex gap-4">
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-1 px-4 py-3 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-white"
            />
            <button
              type="submit"
              className="bg-white text-blue-600 px-8 py-3 rounded-md font-semibold hover:bg-gray-100 transition-colors"
            >
              SUBSCRIBE
            </button>
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="text-lg font-semibold mb-4">LUMI POUCHES</h3>
              <p className="text-sm text-gray-400">
                Premium nicotine pouches for adult consumers 21+ only.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">QUICK LINKS</h3>
              <div className="space-y-2">
                <Link href="/products" className="block text-sm text-gray-400 hover:text-white">
                  Shop All Products
                </Link>
                <Link href="/auth/login" className="block text-sm text-gray-400 hover:text-white">
                  Login
                </Link>
                <Link href="/account" className="block text-sm text-gray-400 hover:text-white">
                  My Account
                </Link>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">LEGAL</h3>
              <div className="space-y-2">
                <Link href="/legal/terms" className="block text-sm text-gray-400 hover:text-white">
                  Terms of Use
                </Link>
                <Link href="/legal/privacy" className="block text-sm text-gray-400 hover:text-white">
                  Privacy Policy
                </Link>
                <Link href="/legal/returns" className="block text-sm text-gray-400 hover:text-white">
                  Return Policy
                </Link>
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
            <p className="mt-2 text-xs">
              CONSUMERS 21+ ONLY. Must be 21+ to purchase. Not for sale to minors. Age verification
              required at checkout and delivery.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
