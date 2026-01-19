'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function CustomerHeader() {
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === '/home') {
      return pathname === '/home' || pathname === '/';
    }
    return pathname?.startsWith(path);
  };

  return (
    <>
      {/* Warning Banner */}
      <div className="bg-black text-white py-2 text-center text-sm font-semibold">
        WARNING: This product contains nicotine. Nicotine is an addictive chemical.
      </div>

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col space-y-4">
            {/* Top row: Logo and Account/Cart */}
            <div className="flex justify-between items-center">
              <Link href="/home" className="text-3xl font-bold text-gray-900 hover:text-blue-600 transition-colors">
                LUMI
              </Link>
              <div className="hidden md:flex items-center space-x-6">
                <Link 
                  href="/account" 
                  className={`font-medium transition-colors ${
                    isActive('/account') 
                      ? 'text-blue-600' 
                      : 'text-gray-700 hover:text-blue-600'
                  }`}
                >
                  ACCOUNT
                </Link>
                <Link
                  href="/cart"
                  className="bg-blue-600 text-white px-4 py-2 rounded-md font-medium hover:bg-blue-700 transition-colors"
                >
                  CART
                </Link>
              </div>
              <button className="md:hidden text-gray-700">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>

            {/* Navigation Bar */}
            <nav className="hidden md:flex items-center space-x-8 border-t border-gray-200 pt-4">
              <Link 
                href="/home" 
                className={`font-medium transition-colors pb-1 ${
                  isActive('/home') 
                    ? 'text-blue-600 border-b-2 border-blue-600' 
                    : 'text-gray-700 hover:text-blue-600'
                }`}
              >
                HOME
              </Link>
              <Link 
                href="/products" 
                className={`font-medium transition-colors pb-1 ${
                  isActive('/products') 
                    ? 'text-blue-600 border-b-2 border-blue-600' 
                    : 'text-gray-700 hover:text-blue-600'
                }`}
              >
                OUR FLAVORS
              </Link>
              <Link 
                href="/coming-soon" 
                className={`font-medium transition-colors pb-1 ${
                  isActive('/coming-soon') 
                    ? 'text-blue-600 border-b-2 border-blue-600' 
                    : 'text-gray-700 hover:text-blue-600'
                }`}
              >
                INCOMING DROPS
              </Link>
              <Link 
                href="/reviews" 
                className={`font-medium transition-colors pb-1 ${
                  isActive('/reviews') 
                    ? 'text-blue-600 border-b-2 border-blue-600' 
                    : 'text-gray-700 hover:text-blue-600'
                }`}
              >
                CUSTOMER REVIEWS
              </Link>
              <Link 
                href="/contact" 
                className={`font-medium transition-colors pb-1 ${
                  isActive('/contact') 
                    ? 'text-blue-600 border-b-2 border-blue-600' 
                    : 'text-gray-700 hover:text-blue-600'
                }`}
              >
                CONTACT
              </Link>
              <Link 
                href="/wholesale" 
                className={`font-medium transition-colors pb-1 ${
                  isActive('/wholesale') 
                    ? 'text-blue-600 border-b-2 border-blue-600' 
                    : 'text-gray-700 hover:text-blue-600'
                }`}
              >
                WHOLESALE APPLICATION
              </Link>
            </nav>

            {/* SALE Banner */}
            <div className="hidden md:block border-t border-gray-200 pt-2">
              <Link 
                href="/products?sale=true" 
                className="text-red-600 hover:text-red-700 font-bold text-sm transition-colors"
              >
                SALE
              </Link>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
