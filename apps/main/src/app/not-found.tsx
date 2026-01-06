import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Warning Banner */}
      <div className="bg-black text-white py-2 text-center text-sm font-semibold">
        WARNING: This product contains nicotine. Nicotine is an addictive chemical.
      </div>

      {/* Header */}
      <header className="bg-blue-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link href="/" className="text-2xl font-bold">
            LUMI
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full text-center">
          <div className="mb-8">
            <h1 className="text-9xl font-bold text-gray-300">404</h1>
            <h2 className="text-3xl font-bold text-gray-900 mt-4">Page Not Found</h2>
            <p className="text-gray-600 mt-4">
              Sorry, we couldn&apos;t find the page you&apos;re looking for.
            </p>
          </div>

          <div className="space-y-4">
            <Link
              href="/"
              className="inline-block bg-blue-600 text-white px-8 py-3 rounded-md font-semibold hover:bg-blue-700 transition-colors"
            >
              Go Back Home
            </Link>
            <div className="text-sm text-gray-600">
              <Link href="/products" className="text-blue-600 hover:underline">
                Browse Products
              </Link>
              {' • '}
              <Link href="/account" className="text-blue-600 hover:underline">
                My Account
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <h3 className="text-lg font-semibold mb-4">LEGAL</h3>
              <div className="space-y-2">
                <Link href="/legal/terms" className="block hover:underline">TERMS OF USE</Link>
                <Link href="/legal/privacy" className="block hover:underline">PRIVACY POLICY</Link>
                <Link href="/legal/returns" className="block hover:underline">RETURN POLICY</Link>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">FOLLOW US</h3>
              <div className="space-y-2">
                <a href="#" className="block hover:underline">Facebook</a>
                <a href="#" className="block hover:underline">Instagram</a>
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
