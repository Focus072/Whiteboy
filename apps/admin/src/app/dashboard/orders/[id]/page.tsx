'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { getOrder, logStakeCall, shipOrder, type ApiResponse } from '@/lib/api';

interface OrderDetail {
  id: string;
  status: string;
  createdAt: string;
  shippedAt?: string;
  carrier?: string;
  trackingNumber?: string;
  shippingAddress: {
    recipientName: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  items: Array<{
    id: string;
    quantity: number;
    product: {
      name: string;
      sku: string;
      netWeightGrams: number;
    };
  }>;
  complianceSnapshot?: {
    finalDecision: string;
    stakeCallRequired: boolean;
    caFlavorCheck: string;
    caSensoryCheck: string;
    poBoxCheck: string;
    ageVerificationCheck: string;
  };
  ageVerification?: {
    status: string;
    referenceId: string;
    provider: string;
  };
  payments: Array<{
    status: string;
    transactionId: string;
    amount: string;
  }>;
  stakeCalls: Array<{
    id: string;
    calledAt: string;
    notes: string;
  }>;
}

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;
  
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [stakeNotes, setStakeNotes] = useState('');

  const loadOrder = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setError('');
    try {
      const response = await getOrder(orderId);
      
      if (response.success && response.data) {
        setOrder(response.data);
      } else {
        setError(response.error?.message || 'Failed to load order');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const handleStakeCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stakeNotes.trim()) {
      setActionError('Notes are required');
      return;
    }

    setActionLoading(true);
    setActionError('');
    try {
      const response = await logStakeCall(orderId, stakeNotes);
      if (response.success) {
        setStakeNotes('');
        loadOrder(); // Reload order
      } else {
        setActionError(response.error?.message || 'Failed to log STAKE call');
      }
    } catch (err) {
      setActionError('Network error. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleShip = async () => {
    if (!confirm('Are you sure you want to ship this order?')) {
      return;
    }

    setActionLoading(true);
    setActionError('');
    try {
      const response = await shipOrder(orderId);
      if (response.success) {
        loadOrder(); // Reload order
      } else {
        const reasons = response.error?.reasons || [];
        setActionError(
          response.error?.message || 'Failed to ship order' +
          (reasons.length > 0 ? `: ${reasons.join(', ')}` : '')
        );
      }
    } catch (err) {
      setActionError('Network error. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const canShip = order?.status === 'PAID' && 
                  order?.complianceSnapshot?.finalDecision === 'ALLOW' &&
                  !order?.shippingAddress?.line1?.toLowerCase().includes('po box') &&
                  order?.payments?.[0]?.status === 'AUTHORIZED' &&
                  (!order?.complianceSnapshot?.stakeCallRequired || order?.stakeCalls?.length > 0);

  const shipDisabledReason = !order ? 'Loading...' :
    order.status !== 'PAID' ? `Order status is ${order.status}, must be PAID` :
    order.complianceSnapshot?.finalDecision !== 'ALLOW' ? 'Compliance decision is not ALLOW' :
    order.shippingAddress?.line1?.toLowerCase().includes('po box') ? 'Shipping address is a PO box' :
    order.payments?.[0]?.status !== 'AUTHORIZED' ? `Payment status is ${order.payments?.[0]?.status}, must be AUTHORIZED` :
    order.complianceSnapshot?.stakeCallRequired && !order.stakeCalls?.length ? 'STAKE Act call required' :
    '';

  if (loading) {
    return (
      <div className="px-4 py-6">
        <div className="text-center py-8 text-gray-600">Loading order...</div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="px-4 py-6">
        <div className="rounded-md bg-red-50 p-4 mb-4">
          <div className="text-sm text-red-800">{error || 'Order not found'}</div>
        </div>
        <Link href="/dashboard/orders" className="text-indigo-600 hover:text-indigo-900">
          ← Back to Orders
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      <div className="mb-4">
        <Link href="/dashboard/orders" className="text-indigo-600 hover:text-indigo-900">
          ← Back to Orders
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Order {order.id.substring(0, 8)}...</h1>
        <div className="mt-2">
          <span className={`px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full ${
            order.status === 'PAID' ? 'bg-blue-100 text-blue-800' :
            order.status === 'SHIPPED' ? 'bg-green-100 text-green-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {order.status}
          </span>
        </div>
      </div>

      {actionError && (
        <div className="mb-4 rounded-md bg-red-50 p-4">
          <div className="text-sm text-red-800">{actionError}</div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Shipping Address */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Shipping Address</h2>
            <div className="text-sm text-gray-600 space-y-1">
              <div>{order.shippingAddress.recipientName}</div>
              <div>{order.shippingAddress.line1}</div>
              {order.shippingAddress.line2 && <div>{order.shippingAddress.line2}</div>}
              <div>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}</div>
              <div>{order.shippingAddress.country}</div>
            </div>
          </div>

          {/* Items */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Items</h2>
            <div className="space-y-3">
              {order.items.map((item) => (
                <div key={item.id} className="border-b border-gray-200 pb-3 last:border-0">
                  <div className="font-medium">{item.product.name}</div>
                  <div className="text-sm text-gray-600">SKU: {item.product.sku}</div>
                  <div className="text-sm text-gray-600">Quantity: {item.quantity}</div>
                  <div className="text-sm text-gray-600">Weight: {item.product.netWeightGrams * item.quantity}g</div>
                </div>
              ))}
            </div>
          </div>

          {/* Compliance Snapshot */}
          {order.complianceSnapshot && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Compliance</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Final Decision:</span>
                  <span className={order.complianceSnapshot.finalDecision === 'ALLOW' ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                    {order.complianceSnapshot.finalDecision}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">CA Flavor Check:</span>
                  <span>{order.complianceSnapshot.caFlavorCheck}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">CA Sensory Check:</span>
                  <span>{order.complianceSnapshot.caSensoryCheck}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">PO Box Check:</span>
                  <span>{order.complianceSnapshot.poBoxCheck}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Age Verification:</span>
                  <span>{order.complianceSnapshot.ageVerificationCheck}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">STAKE Call Required:</span>
                  <span className={order.complianceSnapshot.stakeCallRequired ? 'text-orange-600 font-semibold' : ''}>
                    {order.complianceSnapshot.stakeCallRequired ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Age Verification */}
          {order.ageVerification && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Age Verification</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className={order.ageVerification.status === 'PASS' ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                    {order.ageVerification.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Provider:</span>
                  <span>{order.ageVerification.provider}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Reference ID:</span>
                  <span className="font-mono text-xs">{order.ageVerification.referenceId}</span>
                </div>
              </div>
            </div>
          )}

          {/* Payment */}
          {order.payments && order.payments.length > 0 && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className={order.payments[0].status === 'AUTHORIZED' || order.payments[0].status === 'CAPTURED' ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                    {order.payments[0].status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Transaction ID:</span>
                  <span className="font-mono text-xs">{order.payments[0].transactionId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Amount:</span>
                  <span>${order.payments[0].amount}</span>
                </div>
              </div>
            </div>
          )}

          {/* STAKE Call */}
          {order.complianceSnapshot?.stakeCallRequired && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">STAKE Act Call</h2>
              {order.stakeCalls && order.stakeCalls.length > 0 ? (
                <div className="space-y-2 text-sm">
                  <div className="text-green-600 font-semibold">✓ Call Logged</div>
                  <div className="text-gray-600">Called: {new Date(order.stakeCalls[0].calledAt).toLocaleString()}</div>
                  <div className="text-gray-600">Notes: {order.stakeCalls[0].notes}</div>
                </div>
              ) : (
                <form onSubmit={handleStakeCall} className="space-y-3">
                  <textarea
                    value={stakeNotes}
                    onChange={(e) => setStakeNotes(e.target.value)}
                    placeholder="Enter call notes..."
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    rows={4}
                  />
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="w-full px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
                  >
                    {actionLoading ? 'Logging...' : 'Log STAKE Call'}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Shipment Info */}
          {order.shippedAt && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Shipment</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Shipped:</span>
                  <span>{new Date(order.shippedAt).toLocaleString()}</span>
                </div>
                {order.carrier && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Carrier:</span>
                    <span>{order.carrier}</span>
                  </div>
                )}
                {order.trackingNumber && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tracking:</span>
                    <span className="font-mono text-xs">{order.trackingNumber}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Ship Order Action */}
          {order.status !== 'SHIPPED' && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions</h2>
              <button
                onClick={handleShip}
                disabled={!canShip || actionLoading}
                className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                title={shipDisabledReason}
              >
                {actionLoading ? 'Shipping...' : 'Ship Order'}
              </button>
              {!canShip && shipDisabledReason && (
                <p className="mt-2 text-xs text-gray-500">{shipDisabledReason}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

