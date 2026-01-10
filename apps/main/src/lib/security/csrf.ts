/**
 * CSRF Protection Utility
 * 
 * Provides CSRF token generation and validation to prevent cross-site
 * request forgery attacks.
 */

import crypto from 'crypto';

// In-memory store for CSRF tokens (can be upgraded to Redis for distributed systems)
// Key: sessionId or user identifier
// Value: Set of valid tokens
const csrfTokenStore = new Map<string, Set<string>>();

// Clean up expired tokens every 10 minutes
setInterval(() => {
  // For now, we keep tokens until they're used or session expires
  // In production, consider adding expiration times
}, 10 * 60 * 1000);

/**
 * Generate a CSRF token
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Store a CSRF token for a session/user
 */
export function storeCsrfToken(identifier: string, token: string): void {
  if (!csrfTokenStore.has(identifier)) {
    csrfTokenStore.set(identifier, new Set());
  }
  csrfTokenStore.get(identifier)!.add(token);
  
  // Limit to 10 tokens per identifier to prevent memory issues
  const tokens = csrfTokenStore.get(identifier)!;
  if (tokens.size > 10) {
    const firstToken = tokens.values().next().value;
    if (firstToken) {
      tokens.delete(firstToken);
    }
  }
}

/**
 * Validate a CSRF token
 */
export function validateCsrfToken(identifier: string, token: string): boolean {
  const tokens = csrfTokenStore.get(identifier);
  
  // Debug logging in development
  if (process.env.NODE_ENV === 'development') {
    console.log('CSRF validation:', {
      identifier,
      hasTokens: !!tokens,
      tokenCount: tokens?.size || 0,
      tokenProvided: !!token,
      tokenLength: token?.length || 0,
    });
  }
  
  if (!tokens) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('CSRF token store empty for identifier:', identifier);
    }
    return false;
  }
  
  const isValid = tokens.has(token);
  if (isValid) {
    // Remove token after use (one-time use)
    tokens.delete(token);
  } else if (process.env.NODE_ENV === 'development') {
    console.warn('CSRF token not found in store for identifier:', identifier);
  }
  
  return isValid;
}

/**
 * Get CSRF token identifier from request
 * Uses cookie-based session ID as primary method (most reliable and consistent)
 */
export function getCsrfIdentifier(request: any): string {
  // For NextRequest, try to get from cookies first (most reliable)
  if (request?.cookies) {
    let sessionId: string | undefined;
    if (typeof request.cookies.get === 'function') {
      sessionId = request.cookies.get('csrf-session-id')?.value;
    } else if (request.cookies['csrf-session-id']) {
      sessionId = request.cookies['csrf-session-id'];
    }
    
    if (sessionId) {
      // Use session ID as identifier (consistent with token generation)
      return crypto.createHash('sha256').update(sessionId).digest('hex').substring(0, 16);
    }
  }

  // If no cookie, this is a new session - return a temporary identifier
  // This will cause validation to fail, which is expected for new sessions without a token
  const headers = request?.headers || {};
  const getHeader = (name: string) => {
    if (typeof headers.get === 'function') {
      return headers.get(name);
    }
    const lowerName = name.toLowerCase();
    return headers[lowerName] || headers[name];
  };

  // For development, use a fallback based on user-agent + accept headers
  if (process.env.NODE_ENV === 'development') {
    const userAgent = getHeader('user-agent') || 'unknown';
    const accept = getHeader('accept') || 'unknown';
    return crypto.createHash('sha256').update(`dev-${userAgent}-${accept}`).digest('hex').substring(0, 16);
  }
  
  // Production: Fallback to IP address (less ideal but works as fallback)
  const forwarded = getHeader('x-forwarded-for');
  const realIp = getHeader('x-real-ip');
  const cfConnectingIp = getHeader('cf-connecting-ip');
  const ip = cfConnectingIp || realIp || (forwarded ? (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : null) : null) || 'unknown';
  
  return crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16);
}

/**
 * Clear CSRF tokens for an identifier (e.g., on logout)
 */
export function clearCsrfTokens(identifier: string): void {
  csrfTokenStore.delete(identifier);
}
