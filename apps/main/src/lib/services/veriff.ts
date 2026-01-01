/**
 * Veriff Station API Age Verification Service
 * 
 * This module provides server-to-server integration with Veriff's
 * Station API for age verification.
 * 
 * Security:
 * - HMAC-SHA256 request signing
 * - No PII logging
 * - Timeout handling
 * - Fail-closed on errors
 */

import crypto from 'crypto';
import type {
  VeriffVerificationRequest,
  VeriffVerificationResponse,
  VeriffError,
  VeriffSessionResponse,
  VeriffDecisionResponse,
} from './veriff.types';

const VERIFF_BASE_URL = process.env.VERIFF_BASE_URL || 'https://stationapi.veriff.com';
const VERIFF_API_KEY = process.env.VERIFF_API_KEY || '';
const VERIFF_SIGNATURE_KEY = process.env.VERIFF_SIGNATURE_KEY || '';

const REQUEST_TIMEOUT = 30000; // 30 seconds
const POLL_INTERVAL = 2000; // 2 seconds
const MAX_POLL_ATTEMPTS = 15; // 30 seconds total

/**
 * Generate HMAC-SHA256 signature for Veriff request
 */
function generateSignature(
  method: string,
  path: string,
  timestamp: string,
  body: string
): string {
  const message = `${method}\n${path}\n${timestamp}\n${body}`;
  return crypto
    .createHmac('sha256', VERIFF_SIGNATURE_KEY)
    .update(message)
    .digest('hex');
}

/**
 * Create signed request headers for Veriff API
 */
function createSignedHeaders(method: string, path: string, body: string): HeadersInit {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = generateSignature(method, path, timestamp, body);

  return {
    'Content-Type': 'application/json',
    'X-AUTH-CLIENT': VERIFF_API_KEY,
    'X-TIMESTAMP': timestamp,
    'X-SIGNATURE': signature,
  };
}

/**
 * Calculate age from date of birth
 */
function calculateAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

/**
 * Create a verification session with Veriff
 */
async function createVerificationSession(
  request: VeriffVerificationRequest
): Promise<string> {
  if (!VERIFF_API_KEY || !VERIFF_SIGNATURE_KEY) {
    throw {
      code: 'VERIFF_NOT_CONFIGURED',
      message: 'Veriff credentials not configured',
    } as VeriffError;
  }

  const path = '/v1/sessions';
  const body = JSON.stringify({
    verification: {
      person: {
        firstName: request.firstName,
        lastName: request.lastName,
        dateOfBirth: request.dateOfBirth,
      },
      ...(request.address && {
        address: {
          fullAddress: `${request.address.line1}, ${request.address.city}, ${request.address.state} ${request.address.zip}`,
          country: request.address.country,
        },
      }),
    },
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(`${VERIFF_BASE_URL}${path}`, {
      method: 'POST',
      headers: createSignedHeaders('POST', path, body),
      body,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw {
        code: 'VERIFF_SESSION_ERROR',
        message: errorData.message || `Veriff API error: ${response.status}`,
      } as VeriffError;
    }

    const data = (await response.json()) as VeriffSessionResponse;
    return data.id;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error && typeof error === 'object' && 'code' in error) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw {
        code: 'VERIFF_TIMEOUT',
        message: 'Veriff session creation timeout',
      } as VeriffError;
    }

    throw {
      code: 'VERIFF_ERROR',
      message: error instanceof Error ? error.message : 'Unknown Veriff error',
    } as VeriffError;
  }
}

/**
 * Poll for verification decision
 */
async function pollVerificationDecision(
  sessionId: string
): Promise<VeriffDecisionResponse> {
  const path = `/v1/sessions/${sessionId}/decision`;

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      const body = '';
      const response = await fetch(`${VERIFF_BASE_URL}${path}`, {
        method: 'GET',
        headers: createSignedHeaders('GET', path, body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 404) {
          // Decision not ready yet, continue polling
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
          continue;
        }

        const errorData = await response.json().catch(() => ({}));
        throw {
          code: 'VERIFF_DECISION_ERROR',
          message: errorData.message || `Veriff API error: ${response.status}`,
        } as VeriffError;
      }

      const data = (await response.json()) as VeriffDecisionResponse;
      
      // Check if decision is final
      if (data.status === 'success' && data.decision) {
        return data;
      }

      // If status indicates final state (not pending), return it
      if (data.status !== 'pending' && data.status !== 'processing') {
        return data;
      }

      // Continue polling
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
    } catch (error) {
      clearTimeout(timeoutId);

      if (error && typeof error === 'object' && 'code' in error) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw {
          code: 'VERIFF_TIMEOUT',
          message: 'Veriff decision polling timeout',
        } as VeriffError;
      }

      // For other errors, continue polling unless it's a clear failure
      if (attempt < MAX_POLL_ATTEMPTS - 1) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
        continue;
      }

      throw {
        code: 'VERIFF_ERROR',
        message: error instanceof Error ? error.message : 'Unknown Veriff error',
      } as VeriffError;
    }
  }

  // Timeout after max attempts
  throw {
    code: 'VERIFF_TIMEOUT',
    message: 'Veriff decision polling timeout - no final decision received',
  } as VeriffError;
}

/**
 * Verify age using Veriff Station API
 * 
 * @param request - Verification request with customer details
 * @returns Verification result with status and reference ID
 * @throws VeriffError on timeout or API errors
 */
export async function verifyAge(
  request: VeriffVerificationRequest
): Promise<VeriffVerificationResponse> {
  if (!VERIFF_API_KEY || !VERIFF_SIGNATURE_KEY) {
    throw {
      code: 'VERIFF_NOT_CONFIGURED',
      message: 'Veriff credentials not configured',
    } as VeriffError;
  }

  try {
    // Step 1: Create verification session
    const sessionId = await createVerificationSession(request);

    // Step 2: Poll for decision
    const decision = await pollVerificationDecision(sessionId);

    // Step 3: Evaluate decision
    // PASS only if:
    // - decision.status === 'approved' AND
    // - (age >= 21 OR DOB indicates 21+)
    const decisionStatus = decision.decision?.status || decision.verification?.status || decision.status;
    
    if (decisionStatus === 'approved' || decisionStatus === 'success') {
      // Check age
      let age: number | undefined;
      
      if (decision.decision?.person?.age !== undefined) {
        age = decision.decision.person.age;
      } else if (decision.decision?.person?.dateOfBirth) {
        age = calculateAge(decision.decision.person.dateOfBirth);
      } else if (request.dateOfBirth) {
        age = calculateAge(request.dateOfBirth);
      }

      if (age !== undefined && age >= 21) {
        return {
          status: 'PASS',
          referenceId: sessionId,
          reasonCode: undefined,
        };
      } else {
        // Approved but under 21
        return {
          status: 'FAIL',
          referenceId: sessionId,
          reasonCode: 'UNDER_21',
          message: 'Age verification approved but customer is under 21',
        };
      }
    }

    // Everything else is FAIL (declined, resubmission, review, timeout, errors)
    const reasonCode = decision.code?.toString() || decisionStatus || 'VERIFF_DECLINED';
    
    return {
      status: 'FAIL',
      referenceId: sessionId,
      reasonCode,
      message: `Veriff decision: ${decisionStatus}`,
    };
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error) {
      throw error;
    }

    // Fail closed on any error
    throw {
      code: 'VERIFF_ERROR',
      message: error instanceof Error ? error.message : 'Unknown Veriff error',
    } as VeriffError;
  }
}

