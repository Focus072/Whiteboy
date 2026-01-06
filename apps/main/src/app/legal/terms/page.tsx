import Link from 'next/link';

export const metadata = {
  title: 'Terms of Use - Lumi Pouches',
  description: 'Terms and Conditions for Lumi Pouches',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Warning Banner */}
      <div className="bg-black text-white py-2 text-center text-sm font-semibold">
        WARNING: This product contains nicotine. Nicotine is an addictive chemical.
      </div>

      {/* Header */}
      <header className="bg-blue-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <Link href="/" className="text-2xl font-bold">
              LUMI
            </Link>
            <Link href="/" className="text-sm hover:underline">
              BACK TO HOME
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">TERMS OF USE</h1>
        
        <div className="prose prose-lg max-w-none space-y-6 text-gray-700">
          <p className="text-sm text-gray-500">Last Updated: January 2025</p>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">1. Acceptance of Terms</h2>
            <p>
              By accessing and using this website, you accept and agree to be bound by the terms and provision of this agreement.
              If you do not agree to abide by the above, please do not use this service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">2. Age Verification</h2>
            <p>
              You must be at least 21 years of age to purchase nicotine products from Lumi Pouches. By placing an order,
              you represent and warrant that you are at least 21 years old and of legal age to purchase nicotine products
              in your jurisdiction. We reserve the right to verify your age through third-party age verification services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">3. Product Restrictions</h2>
            <p>
              Certain products may be restricted in your state or jurisdiction. It is your responsibility to ensure that
              the products you purchase are legal in your area. We comply with all applicable state and federal regulations,
              including California flavor restrictions and PACT Act requirements.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">4. Order Acceptance</h2>
            <p>
              All orders are subject to acceptance by Lumi Pouches. We reserve the right to refuse or cancel any order
              for any reason, including but not limited to product availability, errors in pricing, or compliance issues.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">5. Payment Terms</h2>
            <p>
              Payment must be received before order processing. We accept major credit cards and other payment methods
              as indicated on our website. All prices are in USD and are subject to change without notice.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">6. Shipping and Delivery</h2>
            <p>
              We ship to addresses within the United States only. PO boxes are not permitted for delivery. Adult signature
              is required upon delivery. Shipping times are estimates and not guaranteed.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">7. Returns and Refunds</h2>
            <p>
              Please review our <Link href="/legal/returns" className="text-blue-600 hover:underline">Return Policy</Link> for
              information about returns and refunds.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">8. Limitation of Liability</h2>
            <p>
              Lumi Pouches shall not be liable for any indirect, incidental, special, consequential, or punitive damages
              resulting from your use of or inability to use the service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">9. Governing Law</h2>
            <p>
              These terms shall be governed by and construed in accordance with the laws of the United States, without
              regard to its conflict of law provisions.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">10. Contact Information</h2>
            <p>
              If you have any questions about these Terms of Use, please contact us through our website or at the
              contact information provided in our <Link href="/legal/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>.
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 mt-16">
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
