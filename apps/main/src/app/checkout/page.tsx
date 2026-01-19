'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '@/lib/cart';
import { createOrder, createAddress, type ApiResponse } from '@/lib/api';
import FormField from '@/components/FormField';
import CustomerHeader from '@/components/CustomerHeader';
import { validationRules } from '@/lib/utils/form-validation';

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

export default function CheckoutPage() {
  const router = useRouter();
  const { items, clearCart } = useCart();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [orderId, setOrderId] = useState('');

  // Customer info
  const [customerFirstName, setCustomerFirstName] = useState('');
  const [customerLastName, setCustomerLastName] = useState('');
  const [customerDateOfBirth, setCustomerDateOfBirth] = useState('');
  const [isFirstTimeRecipient, setIsFirstTimeRecipient] = useState(false);

  // Shipping address
  const [shippingName, setShippingName] = useState('');
  const [shippingPhone, setShippingPhone] = useState('');
  const [shippingLine1, setShippingLine1] = useState('');
  const [shippingLine2, setShippingLine2] = useState('');
  const [shippingCity, setShippingCity] = useState('');
  const [shippingState, setShippingState] = useState('');
  const [shippingZip, setShippingZip] = useState('');
  const [shippingCountry, setShippingCountry] = useState('US');
  const [shippingIsPoBox, setShippingIsPoBox] = useState(false);

  // Billing address
  const [billingSameAsShipping, setBillingSameAsShipping] = useState(true);
  const [billingName, setBillingName] = useState('');
  const [billingPhone, setBillingPhone] = useState('');
  const [billingLine1, setBillingLine1] = useState('');
  const [billingLine2, setBillingLine2] = useState('');
  const [billingCity, setBillingCity] = useState('');
  const [billingState, setBillingState] = useState('');
  const [billingZip, setBillingZip] = useState('');
  const [billingCountry, setBillingCountry] = useState('US');
  const [billingIsPoBox, setBillingIsPoBox] = useState(false);

  // Payment
  const [cardNumber, setCardNumber] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [cvv, setCvv] = useState('');

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Your cart is empty</h2>
            <Link
              href="/"
              className="inline-block px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              Continue Shopping
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Create shipping address
      const shippingAddressResponse = await createAddress({
        recipientName: shippingName,
        phone: shippingPhone,
        line1: shippingLine1,
        line2: shippingLine2 || undefined,
        city: shippingCity,
        state: shippingState,
        postalCode: shippingZip,
        country: shippingCountry,
        isPoBox: shippingIsPoBox,
      });

      if (!shippingAddressResponse.success || !shippingAddressResponse.data) {
        setError(shippingAddressResponse.error?.message || 'Failed to create shipping address');
        setLoading(false);
        return;
      }

      // Create billing address
      let billingAddressId: string;
      if (billingSameAsShipping) {
        billingAddressId = shippingAddressResponse.data.id;
      } else {
        const billingAddressResponse = await createAddress({
          recipientName: billingName,
          phone: billingPhone,
          line1: billingLine1,
          line2: billingLine2 || undefined,
          city: billingCity,
          state: billingState,
          postalCode: billingZip,
          country: billingCountry,
          isPoBox: billingIsPoBox,
        });

        if (!billingAddressResponse.success || !billingAddressResponse.data) {
          setError(billingAddressResponse.error?.message || 'Failed to create billing address');
          setLoading(false);
          return;
        }

        billingAddressId = billingAddressResponse.data.id;
      }

      // Format expiration date (MM/YY -> MMYY)
      const formattedExpiration = expirationDate.replace('/', '');

      // Create order
      const response = await createOrder({
        shippingAddressId: shippingAddressResponse.data.id,
        billingAddressId,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
        customerFirstName,
        customerLastName,
        customerDateOfBirth,
        isFirstTimeRecipient,
        payment: {
          cardNumber: cardNumber.replace(/\s/g, ''),
          expirationDate: formattedExpiration,
          cvv,
        },
      });

      if (response.success && response.data) {
        setOrderId(response.data.orderId);
        setSuccess(true);
        clearCart();
        // Clear form
        setCustomerFirstName('');
        setCustomerLastName('');
        setCustomerDateOfBirth('');
        setShippingName('');
        setShippingPhone('');
        setShippingLine1('');
        setShippingLine2('');
        setShippingCity('');
        setShippingState('');
        setShippingZip('');
        setCardNumber('');
        setExpirationDate('');
        setCvv('');
      } else {
        setError(
          response.error?.message || 'Failed to create order' +
          (response.error?.reasonCodes ? `: ${response.error.reasonCodes.join(', ')}` : '') +
          (response.error?.reasonCode ? ` (${response.error.reasonCode})` : '')
        );
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50">
        <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-white shadow rounded-lg p-8 text-center">
            <div className="mb-4">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Order Placed Successfully!</h2>
            <p className="text-gray-600 mb-2">Your order ID is:</p>
            <p className="font-mono text-lg font-semibold text-indigo-600 mb-6">{orderId}</p>
            <p className="text-gray-600 mb-6">
              Your order has been received and will be processed. You will receive a confirmation email shortly.
            </p>
            <Link
              href="/"
              className="inline-block px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              Continue Shopping
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <CustomerHeader />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Checkout</h2>

        {error && (
          <div className="mb-6 rounded-md bg-red-50 p-4">
            <div className="text-sm text-red-800 font-semibold mb-2">Order Failed</div>
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Customer Info */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Customer Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                label="First Name"
                id="customerFirstName"
                type="text"
                value={customerFirstName}
                onChange={setCustomerFirstName}
                rules={[validationRules.required()]}
                required
              />
              <FormField
                label="Last Name"
                id="customerLastName"
                type="text"
                value={customerLastName}
                onChange={setCustomerLastName}
                rules={[validationRules.required()]}
                required
              />
              <FormField
                label="Date of Birth"
                id="customerDateOfBirth"
                type="date"
                value={customerDateOfBirth}
                onChange={setCustomerDateOfBirth}
                rules={[validationRules.required(), validationRules.dateOfBirth()]}
                required
              />
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isFirstTimeRecipient"
                  checked={isFirstTimeRecipient}
                  onChange={(e) => setIsFirstTimeRecipient(e.target.checked)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label htmlFor="isFirstTimeRecipient" className="ml-2 block text-sm text-gray-700">
                  First time recipient
                </label>
              </div>
            </div>
          </div>

          {/* Shipping Address */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Shipping Address</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="shippingName" className="block text-sm font-medium text-gray-700 mb-1">
                  Recipient Name *
                </label>
                <input
                  type="text"
                  id="shippingName"
                  required
                  value={shippingName}
                  onChange={(e) => setShippingName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label htmlFor="shippingPhone" className="block text-sm font-medium text-gray-700 mb-1">
                  Phone *
                </label>
                <input
                  type="tel"
                  id="shippingPhone"
                  required
                  value={shippingPhone}
                  onChange={(e) => setShippingPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label htmlFor="shippingLine1" className="block text-sm font-medium text-gray-700 mb-1">
                  Address Line 1 *
                </label>
                <input
                  type="text"
                  id="shippingLine1"
                  required
                  value={shippingLine1}
                  onChange={(e) => setShippingLine1(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label htmlFor="shippingLine2" className="block text-sm font-medium text-gray-700 mb-1">
                  Address Line 2
                </label>
                <input
                  type="text"
                  id="shippingLine2"
                  value={shippingLine2}
                  onChange={(e) => setShippingLine2(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="shippingCity" className="block text-sm font-medium text-gray-700 mb-1">
                    City *
                  </label>
                  <input
                    type="text"
                    id="shippingCity"
                    required
                    value={shippingCity}
                    onChange={(e) => setShippingCity(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label htmlFor="shippingState" className="block text-sm font-medium text-gray-700 mb-1">
                    State *
                  </label>
                  <select
                    id="shippingState"
                    required
                    value={shippingState}
                    onChange={(e) => setShippingState(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select state</option>
                    {US_STATES.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="shippingZip" className="block text-sm font-medium text-gray-700 mb-1">
                    ZIP Code *
                  </label>
                  <input
                    type="text"
                    id="shippingZip"
                    required
                    value={shippingZip}
                    onChange={(e) => setShippingZip(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="shippingIsPoBox"
                  checked={shippingIsPoBox}
                  onChange={(e) => setShippingIsPoBox(e.target.checked)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label htmlFor="shippingIsPoBox" className="ml-2 block text-sm text-gray-700">
                  This is a PO Box
                </label>
              </div>
            </div>
          </div>

          {/* Billing Address */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center mb-4">
              <input
                type="checkbox"
                id="billingSameAsShipping"
                checked={billingSameAsShipping}
                onChange={(e) => setBillingSameAsShipping(e.target.checked)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label htmlFor="billingSameAsShipping" className="ml-2 block text-sm font-medium text-gray-700">
                Billing address same as shipping
              </label>
            </div>

            {!billingSameAsShipping && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Billing Address</h3>
                <div>
                  <label htmlFor="billingName" className="block text-sm font-medium text-gray-700 mb-1">
                    Recipient Name *
                  </label>
                  <input
                    type="text"
                    id="billingName"
                    required={!billingSameAsShipping}
                    value={billingName}
                    onChange={(e) => setBillingName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label htmlFor="billingPhone" className="block text-sm font-medium text-gray-700 mb-1">
                    Phone *
                  </label>
                  <input
                    type="tel"
                    id="billingPhone"
                    required={!billingSameAsShipping}
                    value={billingPhone}
                    onChange={(e) => setBillingPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label htmlFor="billingLine1" className="block text-sm font-medium text-gray-700 mb-1">
                    Address Line 1 *
                  </label>
                  <input
                    type="text"
                    id="billingLine1"
                    required={!billingSameAsShipping}
                    value={billingLine1}
                    onChange={(e) => setBillingLine1(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="billingCity" className="block text-sm font-medium text-gray-700 mb-1">
                      City *
                    </label>
                    <input
                      type="text"
                      id="billingCity"
                      required={!billingSameAsShipping}
                      value={billingCity}
                      onChange={(e) => setBillingCity(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="billingState" className="block text-sm font-medium text-gray-700 mb-1">
                      State *
                    </label>
                    <select
                      id="billingState"
                      required={!billingSameAsShipping}
                      value={billingState}
                      onChange={(e) => setBillingState(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Select state</option>
                      {US_STATES.map((state) => (
                        <option key={state} value={state}>
                          {state}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="billingZip" className="block text-sm font-medium text-gray-700 mb-1">
                      ZIP Code *
                    </label>
                    <input
                      type="text"
                      id="billingZip"
                      required={!billingSameAsShipping}
                      value={billingZip}
                      onChange={(e) => setBillingZip(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Payment */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Information</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="cardNumber" className="block text-sm font-medium text-gray-700 mb-1">
                  Card Number *
                </label>
                <input
                  type="text"
                  id="cardNumber"
                  required
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim())}
                  placeholder="1234 5678 9012 3456"
                  maxLength={19}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="expirationDate" className="block text-sm font-medium text-gray-700 mb-1">
                    Expiration (MM/YY) *
                  </label>
                  <input
                    type="text"
                    id="expirationDate"
                    required
                    value={expirationDate}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      if (value.length <= 2) {
                        setExpirationDate(value);
                      } else {
                        setExpirationDate(value.slice(0, 2) + '/' + value.slice(2, 4));
                      }
                    }}
                    placeholder="12/25"
                    maxLength={5}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label htmlFor="cvv" className="block text-sm font-medium text-gray-700 mb-1">
                    CVV *
                  </label>
                  <input
                    type="text"
                    id="cvv"
                    required
                    value={cvv}
                    onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="123"
                    maxLength={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : 'Place Order'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

