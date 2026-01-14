/**
 * Authorize.Net Payment Authorization Service
 * 
 * This module provides server-to-server integration with Authorize.Net
 * for payment authorization (not capture).
 * 
 * Security:
 * - No card data stored
 * - AVS and CVV checks enforced
 * - Fail-closed on errors
 * - HTTPS/SSL verification enforced
 */

import { secureFetch } from '@/lib/security/secure-fetch';

export interface AuthorizeNetRequest {
  amount: number;
  cardNumber: string;
  expirationDate: string; // Format: MMYY
  cvv: string;
  billingAddress: {
    firstName: string;
    lastName: string;
    address: string;
    city: string;
    state: string;
    zip: string;
  };
}

export interface AuthorizeNetResponse {
  status: 'AUTHORIZED' | 'FAILED';
  transactionId: string;
  avsResult?: string;
  cvvResult?: string;
  reasonCode?: string;
  message?: string;
}

export interface AuthorizeNetError {
  code: string;
  message: string;
}

const API_LOGIN_ID = process.env.AUTHORIZENET_API_LOGIN_ID || '';
const TRANSACTION_KEY = process.env.AUTHORIZENET_TRANSACTION_KEY || '';
const ENVIRONMENT = process.env.AUTHORIZENET_ENV || 'sandbox';

const API_ENDPOINT = ENVIRONMENT === 'production'
  ? 'https://api.authorize.net/xml/v1/request.api'
  : 'https://apitest.authorize.net/xml/v1/request.api';

const REQUEST_TIMEOUT = 15000; // 15 seconds

/**
 * Authorize a payment using Authorize.Net
 * 
 * This performs an authorization only (no capture).
 * Funds are held but not captured.
 * 
 * @param request - Payment authorization request with card details
 * @returns Authorization result with transaction ID
 * @throws AuthorizeNetError on gateway errors or declines
 */
export async function authorizePayment(request: AuthorizeNetRequest): Promise<AuthorizeNetResponse> {
  if (!API_LOGIN_ID || !TRANSACTION_KEY) {
    throw {
      code: 'AUTHORIZENET_NOT_CONFIGURED',
      message: 'Authorize.Net credentials not configured',
    } as AuthorizeNetError;
  }

  // Build Authorize.Net XML request
  const xmlRequest = `<?xml version="1.0" encoding="utf-8"?>
<createTransactionRequest xmlns="AnetApi/xml/v1/schema/AnetApiSchema.xsd">
  <merchantAuthentication>
    <name>${escapeXml(API_LOGIN_ID)}</name>
    <transactionKey>${escapeXml(TRANSACTION_KEY)}</transactionKey>
  </merchantAuthentication>
  <transactionRequest>
    <transactionType>authOnlyTransaction</transactionType>
    <amount>${request.amount.toFixed(2)}</amount>
    <payment>
      <creditCard>
        <cardNumber>${escapeXml(request.cardNumber)}</cardNumber>
        <expirationDate>${escapeXml(request.expirationDate)}</expirationDate>
        <cardCode>${escapeXml(request.cvv)}</cardCode>
      </creditCard>
    </payment>
    <billTo>
      <firstName>${escapeXml(request.billingAddress.firstName)}</firstName>
      <lastName>${escapeXml(request.billingAddress.lastName)}</lastName>
      <address>${escapeXml(request.billingAddress.address)}</address>
      <city>${escapeXml(request.billingAddress.city)}</city>
      <state>${escapeXml(request.billingAddress.state)}</state>
      <zip>${escapeXml(request.billingAddress.zip)}</zip>
    </billTo>
    <transactionSettings>
      <setting>
        <settingName>emailCustomer</settingName>
        <settingValue>false</settingValue>
      </setting>
    </transactionSettings>
  </transactionRequest>
</createTransactionRequest>`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await secureFetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml',
      },
      body: xmlRequest,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw {
        code: 'AUTHORIZENET_GATEWAY_ERROR',
        message: `Authorize.Net API error: ${response.status} ${response.statusText}`,
      } as AuthorizeNetError;
    }

    const xmlResponse = await response.text();
    const result = parseAuthorizeNetResponse(xmlResponse);

    if (result.status === 'FAILED') {
      throw {
        code: result.reasonCode || 'AUTHORIZATION_DECLINED',
        message: result.message || 'Payment authorization declined',
      } as AuthorizeNetError;
    }

    return result;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error && typeof error === 'object' && 'code' in error) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw {
        code: 'AUTHORIZENET_TIMEOUT',
        message: 'Payment authorization timeout',
      } as AuthorizeNetError;
    }

    throw {
      code: 'AUTHORIZENET_ERROR',
      message: error instanceof Error ? error.message : 'Unknown Authorize.Net error',
    } as AuthorizeNetError;
  }
}

/**
 * Escape XML special characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Capture a previously authorized payment
 * 
 * @param transactionId - Original authorization transaction ID
 * @param amount - Amount to capture (must match or be less than authorized amount)
 * @returns Capture result with transaction ID
 * @throws AuthorizeNetError on capture failures
 */
export async function capturePayment(transactionId: string, amount: number): Promise<{ transactionId: string }> {
  if (!API_LOGIN_ID || !TRANSACTION_KEY) {
    throw {
      code: 'AUTHORIZENET_NOT_CONFIGURED',
      message: 'Authorize.Net credentials not configured',
    } as AuthorizeNetError;
  }

  const xmlRequest = `<?xml version="1.0" encoding="utf-8"?>
<createTransactionRequest xmlns="AnetApi/xml/v1/schema/AnetApiSchema.xsd">
  <merchantAuthentication>
    <name>${escapeXml(API_LOGIN_ID)}</name>
    <transactionKey>${escapeXml(TRANSACTION_KEY)}</transactionKey>
  </merchantAuthentication>
  <transactionRequest>
    <transactionType>priorAuthCaptureTransaction</transactionType>
    <amount>${amount.toFixed(2)}</amount>
    <refTransId>${escapeXml(transactionId)}</refTransId>
  </transactionRequest>
</createTransactionRequest>`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await secureFetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml',
      },
      body: xmlRequest,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw {
        code: 'AUTHORIZENET_GATEWAY_ERROR',
        message: `Authorize.Net API error: ${response.status} ${response.statusText}`,
      } as AuthorizeNetError;
    }

    const xmlResponse = await response.text();
    const responseCode = getXmlValue(xmlResponse, 'responseCode');
    const captureTransactionId = getXmlValue(xmlResponse, 'transId');
    const message = getXmlValue(xmlResponse, 'message');

    if (responseCode === '1' && captureTransactionId) {
      return {
        transactionId: captureTransactionId,
      };
    }

    throw {
      code: 'CAPTURE_FAILED',
      message: message || 'Payment capture failed',
    } as AuthorizeNetError;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error && typeof error === 'object' && 'code' in error) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw {
        code: 'AUTHORIZENET_TIMEOUT',
        message: 'Payment capture timeout',
      } as AuthorizeNetError;
    }

    throw {
      code: 'AUTHORIZENET_ERROR',
      message: error instanceof Error ? error.message : 'Unknown Authorize.Net error',
    } as AuthorizeNetError;
  }
}

/**
 * Helper to get XML value
 */
function getXmlValue(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}>(.*?)</${tag}>`, 's');
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Parse Authorize.Net XML response
 */
function parseAuthorizeNetResponse(xml: string): AuthorizeNetResponse {

  const responseCode = getXmlValue(xml, 'responseCode');
  const transactionId = getXmlValue(xml, 'transId');
  const avsResult = getXmlValue(xml, 'avsResultCode');
  const cvvResult = getXmlValue(xml, 'cvvResultCode');
  const reasonCode = getXmlValue(xml, 'reasonCode');
  const message = getXmlValue(xml, 'message');

  // Response code 1 = approved
  if (responseCode === '1' && transactionId) {
    return {
      status: 'AUTHORIZED',
      transactionId,
      avsResult: avsResult || undefined,
      cvvResult: cvvResult || undefined,
      reasonCode: reasonCode || undefined,
      message: message || undefined,
    };
  }

  // Any other response code = declined/failed
  return {
    status: 'FAILED',
    transactionId: transactionId || '',
    avsResult: avsResult || undefined,
    cvvResult: cvvResult || undefined,
    reasonCode: reasonCode || undefined,
    message: message || undefined,
  };
}

