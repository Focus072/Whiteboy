import Link from 'next/link';

export const metadata = {
  title: 'Return Policy - Lumi Pouches',
  description: 'Return and Refund Policy for Lumi Pouches',
};

export default function ReturnsPage() {
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
        <h1 className="text-4xl font-bold text-gray-900 mb-8">RETURN POLICY</h1>
        
        <div className="prose prose-lg max-w-none space-y-6 text-gray-700">
          <p className="text-sm text-gray-500">Last Updated: January 2025</p>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">1. Return Eligibility</h2>
            <p className="mb-4">
              Due to the nature of our products and regulatory requirements, returns are limited. We may accept returns
              in the following circumstances:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Defective or damaged products received</li>
              <li>Incorrect products shipped (our error)</li>
              <li>Unopened products returned within 7 days of delivery</li>
            </ul>
            <p className="mt-4">
              <strong>We cannot accept returns of:</strong>
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Opened or used products</li>
              <li>Products that have been tampered with</li>
              <li>Products returned after 7 days from delivery</li>
              <li>Products that do not meet state compliance requirements (customer responsibility to verify)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">2. Return Process</h2>
            <p className="mb-4">To initiate a return:</p>
            <ol className="list-decimal pl-6 space-y-2">
              <li>Contact our customer service within 7 days of delivery</li>
              <li>Provide your order number and reason for return</li>
              <li>Receive return authorization and instructions</li>
              <li>Ship the product back in its original packaging (if applicable)</li>
              <li>Wait for processing and refund (if approved)</li>
            </ol>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">3. Refunds</h2>
            <p className="mb-4">
              If your return is approved, we will process a refund to your original payment method. Refunds may take
              5-10 business days to appear in your account.
            </p>
            <p>
              <strong>Refund amounts:</strong>
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Full refund for defective or incorrect products</li>
              <li>Product price only (shipping costs are non-refundable unless it was our error)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">4. Shipping Costs</h2>
            <p>
              Return shipping costs are the responsibility of the customer unless the return is due to our error
              (defective product, incorrect item shipped). In such cases, we will provide a prepaid return label.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">5. Age Verification Returns</h2>
            <p>
              If an order is blocked or cancelled due to age verification failure, a full refund will be issued
              automatically. No return is necessary as the product will not be shipped.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">6. Compliance-Related Cancellations</h2>
            <p>
              Orders cancelled due to state compliance restrictions (e.g., California flavor ban) will receive a
              full refund. It is the customer&apos;s responsibility to verify product legality in their state before ordering.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">7. Damaged or Defective Products</h2>
            <p>
              If you receive a damaged or defective product, please contact us immediately with photos of the damage.
              We will arrange for a replacement or full refund at no cost to you.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">8. Contact Information</h2>
            <p>
              For return requests or questions about this policy, please contact our customer service through
              our website or at the contact information provided in our <Link href="/legal/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>.
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
