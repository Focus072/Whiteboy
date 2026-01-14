# Security Implementation

This directory contains security utilities for the Lumi Pouches application.

## Implemented Security Features

### 1. Rate Limiting ✅
**File:** `rate-limit.ts`

- Prevents brute force attacks on authentication endpoints
- Configurable limits per endpoint type
- **In-memory storage** (default, works in serverless)
- **Redis support** (optional, for distributed systems)

**Current Limits:**
- Login: 5 attempts per 15 minutes
- Signup: 3 attempts per hour
- Password Reset: 3 attempts per hour
- General API: 100 requests per minute

**Usage:**
```typescript
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/security/rate-limit';

const clientId = getClientIdentifier(request);
const result = await checkRateLimit(`login:${clientId}`, RATE_LIMITS.AUTH_LOGIN);
if (!result.allowed) {
  return rateLimitError();
}
```

**Redis Setup (Optional):**
1. Install: `pnpm add ioredis`
2. Set `REDIS_URL` environment variable
3. Rate limiting will automatically use Redis if available
4. Falls back to in-memory if Redis is unavailable

### 2. CSRF Protection ✅
**File:** `csrf.ts`

- **Double-submit cookie pattern** (works in serverless environments)
- Token stored in both cookie (httpOnly) and request body/header
- Server compares both values to verify request authenticity
- Prevents cross-site request forgery attacks

**How it works:**
1. Client requests token from `/api/csrf-token`
2. Server sets token in httpOnly cookie and returns token in response
3. Client includes token in request body or `X-CSRF-Token` header
4. Server validates that cookie token matches request token

**Usage:**
```typescript
import { requireCsrfToken } from '@/lib/security/csrf';

// In API route handler
const csrfValidation = requireCsrfToken(request, body);
if (!csrfValidation.valid) {
  return csrfValidation.response!;
}
```

**Endpoint:** `GET /api/csrf-token` - Returns a CSRF token for the current session

**Client-side usage:**
```typescript
// Get token
const tokenResponse = await fetch('/api/csrf-token');
const { token } = await tokenResponse.json();

// Include in request
await fetch('/api/auth/login', {
  method: 'POST',
  headers: {
    'X-CSRF-Token': token,
  },
  body: JSON.stringify({ email, password }),
});
```

### 3. Input Sanitization ✅
**File:** `sanitize.ts`

- Sanitizes user input to prevent XSS attacks
- Escapes HTML special characters
- Removes control characters
- Provides sanitized Zod schemas

**Usage:**
```typescript
import { sanitizeString, sanitizeEmail, sanitizeObject } from '@/lib/security/sanitize';

const clean = sanitizeString(userInput);
const email = sanitizeEmail(userEmail);
const obj = sanitizeObject(userObject);
```

**Zod Integration:**
```typescript
import { sanitizedString, sanitizedEmail } from '@/lib/security/sanitize';

const schema = z.object({
  name: sanitizedString,
  email: sanitizedEmail,
});
```

### 4. HTTPS/SSL Verification ✅
**File:** `secure-fetch.ts`

- Ensures all external API calls use HTTPS
- Enforces SSL certificate verification (default in Node.js 18+)
- Validates URLs before making requests
- Throws error if insecure protocol detected

**Usage:**
```typescript
import { secureFetch } from '@/lib/security/secure-fetch';

// Only HTTPS URLs allowed (except localhost in development)
const response = await secureFetch('https://api.example.com/endpoint', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});
```

**Verified External APIs:**
- ✅ Authorize.Net: Uses `secureFetch` with HTTPS endpoints
- ✅ Veriff: Uses `secureFetch` with HTTPS endpoints
- ✅ Shippo: Uses `secureFetch` with HTTPS endpoints
- ✅ SendGrid: Uses `secureFetch` with HTTPS endpoints
- ✅ Shipping label downloads: Uses `secureFetch` for HTTPS verification

**Note:** Node.js 18+ fetch() API verifies SSL certificates by default, so no additional configuration is needed.

## Security Best Practices

1. **Always sanitize user input** before storing or displaying
2. **Use rate limiting** on all authentication endpoints
3. **Require CSRF tokens** for all state-changing requests (POST, PUT, PATCH, DELETE)
4. **Validate all inputs** using Zod schemas
5. **Use `secureFetch`** for all external API calls (never use plain `fetch` for external URLs)
6. **Never log sensitive data** (passwords, tokens, card numbers)
7. **Use HTTPS only** for external API calls

## Implementation Status

### ✅ Completed
- [x] Rate limiting on auth endpoints (login, signup, password reset)
- [x] CSRF protection using double-submit cookie pattern
- [x] Input sanitization utilities
- [x] HTTPS/SSL verification for all external API calls
- [x] Authorize.Net uses `secureFetch`
- [x] All external services use HTTPS

### 🔄 In Progress
- [ ] Add CSRF protection to all state-changing API routes
- [ ] Add rate limiting to additional endpoints as needed

### 📋 Future Enhancements
- [ ] Add IP-based blocking for repeated violations
- [ ] Implement CAPTCHA for suspicious activity
- [ ] Add request signing for sensitive operations
- [ ] Implement Content Security Policy (CSP) headers
- [ ] Add security headers middleware (HSTS, X-Frame-Options, etc.)

## Environment Variables

```env
# CSRF Secret (uses SESSION_SECRET if not set)
CSRF_SECRET=your-secret-key

# Redis (optional, for distributed rate limiting)
REDIS_URL=redis://localhost:6379

# Session Secret (also used for CSRF signing)
SESSION_SECRET=your-secure-random-string-minimum-32-characters-long
```

## Testing Security Features

### Test Rate Limiting:
```bash
# Try logging in 6 times quickly (should fail on 6th attempt)
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}'
done
```

### Test CSRF Protection:
```bash
# Should fail without CSRF token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'

# Should succeed with CSRF token
TOKEN=$(curl -s http://localhost:3000/api/csrf-token | jq -r '.data.token')
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $TOKEN" \
  -d '{"email":"test@example.com","password":"password"}'
```

### Test HTTPS Verification:
```typescript
// This will throw an error
await secureFetch('http://insecure-api.com/endpoint');

// This will work
await secureFetch('https://secure-api.com/endpoint');
```