# Backend Verification Checklist

This document tracks the verification of all backend functionality before frontend design work begins.

## ✅ Authentication & Authorization

### Auth Endpoints
- [ ] `POST /api/auth/login` - Login with credentials
- [ ] `POST /api/auth/signup` - Create new customer account
- [ ] `POST /api/auth/logout` - Logout and clear session
- [ ] `POST /api/auth/forgot-password` - Request password reset
- [ ] `POST /api/auth/reset-password` - Reset password with token
- [ ] `POST /api/auth/verify-email` - Verify email address
- [ ] `POST /api/auth/resend-verification` - Resend verification email
- [ ] `GET /api/auth/refresh` - Refresh session token
- [ ] `GET /api/me` - Get current user info

### CSRF Protection
- [ ] `GET /api/csrf-token` - Get CSRF token
- [ ] CSRF validation works on POST requests
- [ ] CSRF cookie is set correctly

### Rate Limiting
- [ ] Login rate limiting (5 attempts per 15 min)
- [ ] Signup rate limiting (3 attempts per hour)
- [ ] Password reset rate limiting (3 attempts per hour)

## ✅ Products

### Public Product Endpoints
- [ ] `GET /api/products` - List all products (public)
- [ ] `GET /api/products?search=...` - Search products
- [ ] `GET /api/products?category=...` - Filter by category
- [ ] `GET /api/products/[id]` - Get product details (public)

### Admin Product Endpoints
- [ ] `GET /api/admin/products` - List products (admin, with filters)
- [ ] `GET /api/admin/products/[id]` - Get product (admin)
- [ ] `POST /api/admin/products` - Create product
- [ ] `PUT /api/admin/products/[id]` - Update product
- [ ] `DELETE /api/admin/products/[id]` - Delete product

## ✅ Orders

### Customer Order Endpoints
- [ ] `POST /api/orders` - Create order (guest checkout allowed)
- [ ] `GET /api/orders` - Get user's orders (authenticated)
- [ ] `GET /api/orders/[id]` - Get order details (authenticated)

### Order Flow
- [ ] Order creation with age verification
- [ ] Order creation with compliance checks
- [ ] Order creation with payment authorization
- [ ] Order status updates

### Admin Order Endpoints
- [ ] `GET /api/admin/orders` - List all orders (with filters)
- [ ] `GET /api/admin/orders?status=...` - Filter by status
- [ ] `GET /api/admin/orders/[id]` - Get order details (admin)
- [ ] `POST /api/admin/orders/[id]/stake-call` - Log STAKE call
- [ ] `POST /api/admin/orders/[id]/ship` - Ship order

## ✅ Addresses

- [ ] `POST /api/addresses` - Create address (guest checkout)
- [ ] `GET /api/addresses` - Get user's saved addresses (authenticated)
- [ ] `POST /api/addresses/saved` - Create saved address (authenticated)
- [ ] `PUT /api/addresses/[id]` - Update address (authenticated)
- [ ] `DELETE /api/addresses/[id]` - Delete address (authenticated)

## ✅ Admin Dashboard

- [ ] `GET /api/admin/dashboard/stats` - Dashboard statistics
- [ ] `GET /api/admin/audit-events` - Get audit events
- [ ] `GET /api/admin/users` - List users (admin)
- [ ] `GET /api/admin/users/[id]` - Get user (admin)
- [ ] `POST /api/admin/users` - Create user
- [ ] `PUT /api/admin/users/[id]` - Update user
- [ ] `DELETE /api/admin/users/[id]` - Delete user
- [ ] `POST /api/admin/users/[id]/reset-password` - Reset user password

## ✅ File Management

- [ ] `POST /api/admin/files/presign` - Presign file upload (R2/S3)

## ✅ Reports

- [ ] `POST /api/admin/reports/pact` - Generate PACT report

## ✅ Health & Monitoring

- [ ] `GET /api/health` - Basic health check
- [ ] `GET /api/health/detailed` - Detailed health check
- [ ] `GET /api/test-db` - Database connection test

## ✅ External Services Integration

### Veriff (Age Verification)
- [ ] Age verification API integration
- [ ] `POST /api/admin/test/veriff` - Test Veriff integration
- [ ] Age verification stored in database

### Authorize.Net (Payment)
- [ ] Payment authorization works
- [ ] Payment capture works
- [ ] HTTPS/SSL verification enforced

### Shippo (Shipping)
- [ ] Shipping label generation works
- [ ] UPS carrier selection
- [ ] Adult signature requirement
- [ ] HTTPS/SSL verification enforced

### SendGrid (Email)
- [ ] Order confirmation emails
- [ ] Shipping notification emails
- [ ] Password reset emails
- [ ] Email verification emails
- [ ] HTTPS/SSL verification enforced

### Inngest (Background Jobs)
- [ ] `POST /api/inngest` - Inngest endpoint works
- [ ] Order confirmation email job
- [ ] Shipping notification email job

## ✅ Compliance

- [ ] Age verification required for orders
- [ ] California flavor ban enforcement
- [ ] PO Box detection
- [ ] STAKE Act call logging
- [ ] Compliance snapshots stored

## ✅ Security

- [ ] CSRF protection on state-changing requests
- [ ] Rate limiting on auth endpoints
- [ ] Input sanitization on user inputs
- [ ] HTTPS enforced for external API calls
- [ ] Session management works correctly
- [ ] Password hashing (bcrypt)
- [ ] Admin authorization checks

## ✅ Error Handling

- [ ] User-friendly error messages
- [ ] Proper HTTP status codes
- [ ] Error logging (Sentry if configured)
- [ ] Validation errors handled correctly
- [ ] Database errors handled gracefully

## ✅ Database

- [ ] Database connection works
- [ ] Migrations applied
- [ ] Prisma client generated
- [ ] All models accessible
- [ ] Relationships work correctly

## Testing Commands

### Test Authentication
```bash
# Test login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@gmail.com","password":"admin123"}'

# Test CSRF token
curl http://localhost:3000/api/csrf-token

# Test /api/me (requires auth token)
curl http://localhost:3000/api/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test Products
```bash
# List products
curl http://localhost:3000/api/products

# Get product by ID
curl http://localhost:3000/api/products/PRODUCT_ID
```

### Test Health
```bash
# Basic health check
curl http://localhost:3000/api/health

# Detailed health check
curl http://localhost:3000/api/health/detailed
```

## Known Issues

_List any known issues or limitations here_

## Next Steps

1. ✅ Complete backend verification
2. ⏳ Fix any identified issues
3. ⏳ Begin frontend design work
