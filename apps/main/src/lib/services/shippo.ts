/**
 * Shippo Shipping Label Service
 * 
 * This module provides integration with Shippo API for generating
 * shipping labels with UPS carrier and adult signature requirements.
 * 
 * Security:
 * - No PII logging
 * - Timeout handling
 * - Fail-closed on errors
 */

export interface ShippoAddress {
  name: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone: string;
}

export interface ShippoParcel {
  length: string;
  width: string;
  height: string;
  distanceUnit: 'in' | 'cm';
  weight: string;
  massUnit: 'lb' | 'kg';
}

export interface ShippoRequest {
  fromAddress: ShippoAddress;
  toAddress: ShippoAddress;
  parcel: ShippoParcel;
}

export interface ShippoResponse {
  labelUrl: string;
  trackingNumber: string;
  carrier: string;
  serviceLevel: string;
}

export interface ShippoError {
  code: string;
  message: string;
}

const SHIPPO_TOKEN = process.env.SHIPPO_TOKEN || '';
const SHIPPO_API_URL = 'https://api.goshippo.com/shipments';

const REQUEST_TIMEOUT = 30000; // 30 seconds

/**
 * Generate shipping label via Shippo
 * 
 * Requirements:
 * - Carrier: UPS only
 * - Adult signature required
 * - No PO boxes
 * 
 * @param request - Shipping label request with addresses and parcel
 * @returns Shipping label with tracking number and label URL
 * @throws ShippoError on API errors or validation failures
 */
export async function createShippingLabel(request: ShippoRequest): Promise<ShippoResponse> {
  if (!SHIPPO_TOKEN) {
    throw {
      code: 'SHIPPO_NOT_CONFIGURED',
      message: 'Shippo token not configured',
    } as ShippoError;
  }

  // Validate no PO boxes
  if (request.toAddress.street1.toLowerCase().includes('po box') ||
      request.toAddress.street1.toLowerCase().includes('p.o. box') ||
      request.toAddress.street1.toLowerCase().startsWith('po ')) {
    throw {
      code: 'PO_BOX_NOT_ALLOWED',
      message: 'PO boxes are not allowed for shipping',
    } as ShippoError;
  }

  // Create shipment
  const shipmentData = {
    address_from: {
      name: request.fromAddress.name,
      street1: request.fromAddress.street1,
      street2: request.fromAddress.street2 || '',
      city: request.fromAddress.city,
      state: request.fromAddress.state,
      zip: request.fromAddress.zip,
      country: request.fromAddress.country,
      phone: request.fromAddress.phone,
    },
    address_to: {
      name: request.toAddress.name,
      street1: request.toAddress.street1,
      street2: request.toAddress.street2 || '',
      city: request.toAddress.city,
      state: request.toAddress.state,
      zip: request.toAddress.zip,
      country: request.toAddress.country,
      phone: request.toAddress.phone,
    },
    parcels: [{
      length: request.parcel.length,
      width: request.parcel.width,
      height: request.parcel.height,
      distance_unit: request.parcel.distanceUnit,
      weight: request.parcel.weight,
      mass_unit: request.parcel.massUnit,
    }],
    async: false,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    // Step 1: Create shipment
    const shipmentResponse = await fetch(SHIPPO_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `ShippoToken ${SHIPPO_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(shipmentData),
      signal: controller.signal,
    });

    if (!shipmentResponse.ok) {
      const errorData = await shipmentResponse.json().catch(() => ({}));
      throw {
        code: 'SHIPPO_SHIPMENT_ERROR',
        message: errorData.message || `Shippo API error: ${shipmentResponse.status}`,
      } as ShippoError;
    }

    const shipment = await shipmentResponse.json();

    // Step 2: Get rates (UPS only)
    const shipmentId = shipment.object_id || shipment.objectId || shipment.id;
    const ratesUrl = `${SHIPPO_API_URL}/${shipmentId}/rates/UPS/`;
    const ratesResponse = await fetch(ratesUrl, {
      method: 'GET',
      headers: {
        'Authorization': `ShippoToken ${SHIPPO_TOKEN}`,
      },
      signal: controller.signal,
    });

    if (!ratesResponse.ok) {
      throw {
        code: 'SHIPPO_RATES_ERROR',
        message: 'Failed to get UPS rates',
      } as ShippoError;
    }

    const rates = await ratesResponse.json();
    
    // Handle both array and object response formats
    const rateResults = Array.isArray(rates) ? rates : (rates.results || []);
    
    if (rateResults.length === 0) {
      throw {
        code: 'SHIPPO_NO_UPS_RATES',
        message: 'No UPS rates available',
      } as ShippoError;
    }

    // Select first UPS rate
    const selectedRate = rateResults[0];

    // Step 3: Create transaction with adult signature
    const transactionData = {
      rate: selectedRate.object_id || selectedRate.objectId,
      label_format: 'PDF',
      async: false,
      metadata: 'Adult signature required',
      extra: {
        signature_confirmation: 'ADULT',
      },
    };

    const transactionResponse = await fetch('https://api.goshippo.com/transactions', {
      method: 'POST',
      headers: {
        'Authorization': `ShippoToken ${SHIPPO_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(transactionData),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!transactionResponse.ok) {
      const errorData = await transactionResponse.json().catch(() => ({}));
      throw {
        code: 'SHIPPO_TRANSACTION_ERROR',
        message: errorData.message || 'Failed to create shipping label',
      } as ShippoError;
    }

    const transaction = await transactionResponse.json();

    if (transaction.status !== 'SUCCESS' && transaction.status !== 'SUCCESSFUL') {
      const errorMessage = transaction.messages?.[0]?.text || 
                          transaction.error || 
                          'Label generation failed';
      throw {
        code: 'SHIPPO_LABEL_FAILED',
        message: errorMessage,
      } as ShippoError;
    }

    return {
      labelUrl: transaction.label_url || transaction.labelUrl,
      trackingNumber: transaction.tracking_number || transaction.trackingNumber,
      carrier: 'UPS',
      serviceLevel: selectedRate.servicelevel?.name || selectedRate.servicelevel?.token || 'UPS Ground',
    };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error && typeof error === 'object' && 'code' in error) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw {
        code: 'SHIPPO_TIMEOUT',
        message: 'Shipping label generation timeout',
      } as ShippoError;
    }

    throw {
      code: 'SHIPPO_ERROR',
      message: error instanceof Error ? error.message : 'Unknown Shippo error',
    } as ShippoError;
  }
}

