/**
 * CSRF Protection Utility
 * 
 * Provides CSRF token generation and validation to prevent cross-site
 * request forgery attacks.
 * 
 * Uses a double-submit cookie pattern that works in serverless environments:
 * - Token stored in both cookie (httpOnly) and request body/header
 * - Server compares both values
 * - Works without shared state (Redis/database)
 */

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

const CSRF_SECRET = process.env.CSRF_SECRET || process.env.SESSION_SECRET || 'change-me-in-production';
const CSRF_COOKIE_NAME = 'csrf-token';
const CSRF_HEADER_NAME = 'x-csrf-token';

/**
 * Generate a signed CSRF token
 */
export function generateCsrfToken(): string {
  const token = crypto.randomBytes(32).toString('hex');
  return token;
}

/**
 * Sign a CSRF token with HMAC
 */
function signToken(token: string): string {
  const hmac = crypto.createHmac('sha256', CSRF_SECRET);
  hmac.update(token);
  return hmac.digest('hex');
}

/**
 * Verify a signed CSRF token
 */
function verifyToken(token: string, signature: string): boolean {
  const expectedSignature = signToken(token);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Set CSRF token in response cookie
 */
export function setCsrfCookie(response: NextResponse, token: string): NextResponse {
  const signature = signToken(token);
  const signedToken = `${token}.${signature}`;
  
  response.cookies.set(CSRF_COOKIE_NAME, signedToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
  });
  
  return response;
}

/**
 * Get CSRF token from request cookie
 */
function getCsrfTokenFromCookie(request: NextRequest): string | null {
  const cookie = request.cookies.get(CSRF_COOKIE_NAME);
  if (!cookie?.value) {
    return null;
  }
  
  const [token, signature] = cookie.value.split('.');
  if (!token || !signature) {
    return null;
  }
  
  if (!verifyToken(token, signature)) {
    return null;
  }
  
  return token;
}

/**
 * Get CSRF token from request header or body
 */
function getCsrfTokenFromRequest(request: NextRequest, body?: any): string | null {
  // Try header first
  const headerToken = request.headers.get(CSRF_HEADER_NAME);
  if (headerToken) {
    return headerToken;
  }
  
  // Try body
  if (body?.csrfToken) {
    return body.csrfToken;
  }
  
  return null;
}

/**
 * Validate CSRF token using double-submit cookie pattern
 * 
 * This works in serverless because:
 * 1. Cookie is set by server and sent automatically by browser
 * 2. Token in body/header is set by client JavaScript
 * 3. Both must match (proves request came from same origin)
 */
export function validateCsrfToken(
  request: NextRequest,
  body?: any
): { valid: boolean; error?: string } {
  const cookieToken = getCsrfTokenFromCookie(request);
  const requestToken = getCsrfTokenFromRequest(request, body);
  
  if (!cookieToken) {
    return {
      valid: false,
      error: 'CSRF token cookie not found. Please refresh the page.',
    };
  }
  
  if (!requestToken) {
    return {
      valid: false,
      error: 'CSRF token not provided in request. Include it in X-CSRF-Token header or csrfToken field.',
    };
  }
  
  // Compare tokens (must match exactly)
  if (cookieToken !== requestToken) {
    return {
      valid: false,
      error: 'CSRF token mismatch. Tokens in cookie and request do not match.',
    };
  }
  
  return { valid: true };
}

/**
 * Get CSRF token identifier from request (for logging/debugging)
 */
export function getCsrfIdentifier(request: NextRequest): string {
  // Try to get from cookie first
  const cookie = request.cookies.get(CSRF_COOKIE_NAME);
  if (cookie?.value) {
    const [token] = cookie.value.split('.');
    if (token) {
      return crypto.createHash('sha256').update(token).digest('hex').substring(0, 16);
    }
  }
  
  // Fallback to IP-based identifier
  const headers = request.headers;
  const forwarded = headers.get('x-forwarded-for');
  const realIp = headers.get('x-real-ip');
  const cfConnectingIp = headers.get('cf-connecting-ip');
  const ip = cfConnectingIp || realIp || (forwarded ? forwarded.split(',')[0].trim() : null) || 'unknown';
  
  return crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16);
}

/**
 * Clear CSRF token cookie (e.g., on logout)
 */
export function clearCsrfCookie(response: NextResponse): NextResponse {
  response.cookies.delete(CSRF_COOKIE_NAME);
  return response;
}

/**
 * Middleware helper to require CSRF token for state-changing requests
 */
export function requireCsrfToken(
  request: NextRequest,
  body?: any
): { valid: boolean; response?: NextResponse } {
  // Only require CSRF for state-changing methods
  const stateChangingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  if (!stateChangingMethods.includes(request.method)) {
    return { valid: true };
  }
  
  const validation = validateCsrfToken(request, body);
  
  if (!validation.valid) {
    return {
      valid: false,
      response: NextResponse.json(
        {
          success: false,
          error: {
            code: 'CSRF_TOKEN_INVALID',
            message: validation.error || 'CSRF token validation failed',
          },
        },
        { status: 403 }
      ),
    };
  }
  
  return { valid: true };
}
