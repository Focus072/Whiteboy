import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildFastify } from '../test-helpers.js';
import { OrderStatus, ComplianceDecision, ComplianceCheckResult, PaymentProvider, PaymentStatus } from '@lumi/db';

// Mock bcrypt
vi.mock('bcrypt', () => ({
  default: {
    compare: vi.fn().mockResolvedValue(true),
    hash: vi.fn().mockResolvedValue('hashed'),
  },
}));

// Mock Veriff service
const mockVerifyAge = vi.fn();
vi.mock('../services/veriff.js', () => ({
  verifyAge: (...args: any[]) => mockVerifyAge(...args),
}));

// Mock Authorize.Net service
const mockAuthorizePayment = vi.fn();
vi.mock('../services/authorizenet.js', () => ({
  authorizePayment: (...args: any[]) => mockAuthorizePayment(...args),
}));

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    address: {
      findUnique: vi.fn(),
    },
    product: {
      findMany: vi.fn(),
    },
    order: {
      create: vi.fn(),
    },
    complianceSnapshot: {
      create: vi.fn(),
    },
    ageVerification: {
      create: vi.fn(),
    },
    auditEvent: {
      create: vi.fn(),
    },
    payment: {
      create: vi.fn(),
    },
    session: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => mockPrisma),
  OrderStatus: {
    DRAFT: 'DRAFT',
    PAID: 'PAID',
    BLOCKED: 'BLOCKED',
  },
  ComplianceDecision: {
    ALLOW: 'ALLOW',
    BLOCK: 'BLOCK',
  },
  ComplianceCheckResult: {
    PASS: 'PASS',
    FAIL: 'FAIL',
  },
  AgeVerificationStatus: { PASS: 'PASS', FAIL: 'FAIL' },
  AgeVerificationProvider: { VERIFF: 'VERIFF' },
  PaymentProvider: { AUTHORIZE_NET: 'AUTHORIZE_NET' },
  PaymentStatus: { AUTHORIZED: 'AUTHORIZED', FAILED: 'FAILED' },
  FlavorType: {
    TOBACCO: 'TOBACCO',
    MENTHOL: 'MENTHOL',
    FRUIT: 'FRUIT',
    DESSERT: 'DESSERT',
    OTHER: 'OTHER',
  },
  UserRole: {
    ADMIN: 'ADMIN',
    USER: 'USER',
  },
  ActorType: {
    USER: 'USER',
    SYSTEM: 'SYSTEM',
  },
}));

describe('POST /orders', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    // Fully reset per-test state (mockResolvedValueOnce queues, call history, etc.)
    for (const model of Object.values(mockPrisma)) {
      for (const fn of Object.values(model as any)) {
        if (typeof (fn as any)?.mockReset === 'function') (fn as any).mockReset();
      }
    }
    mockVerifyAge.mockReset();
    mockAuthorizePayment.mockReset();

    app = await buildFastify();
    await app.ready();

    // Mock authentication - create a test user and session
    const testUser = {
      id: 'user-123',
      email: 'test@example.com',
      role: 'ADMIN',
    };

    // Mock session lookup for authentication
    mockPrisma.session.findUnique.mockResolvedValue({
      id: 'session-123',
      userId: testUser.id,
      tokenHash: 'hash',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
      revokedAt: null,
      user: testUser,
    } as any);

    // Default DB writes should behave like real Prisma promises
    mockPrisma.auditEvent.create.mockResolvedValue({} as any);
    mockPrisma.payment.create.mockResolvedValue({} as any);
    mockPrisma.ageVerification.create.mockResolvedValue({} as any);
    mockPrisma.complianceSnapshot.create.mockResolvedValue({} as any);
    
    // Default Veriff mock - PASS
    mockVerifyAge.mockResolvedValue({
      status: 'PASS',
      referenceId: 'veriff-session-123',
      reasonCode: undefined,
    });

    // Default Authorize.Net mock - AUTHORIZED
    mockAuthorizePayment.mockResolvedValue({
      status: 'AUTHORIZED',
      transactionId: 'authnet-txn-123',
      avsResult: 'Y',
      cvvResult: 'M',
    });
  });

  it('should create order and return ALLOW when compliance passes', async () => {
    const shippingAddress = {
      id: 'addr-1',
      state: 'NY',
      isPoBox: false,
      recipientName: 'John Doe',
      phone: '555-1234',
      line1: '123 Main St',
      city: 'New York',
      postalCode: '10001',
      country: 'US',
    };

    const billingAddress = {
      id: 'addr-2',
      state: 'NY',
      isPoBox: false,
      recipientName: 'John Doe',
      phone: '555-1234',
      line1: '123 Main St',
      city: 'New York',
      postalCode: '10001',
      country: 'US',
    };

    const product = {
      id: 'prod-1',
      name: 'Test Product',
      sku: 'TEST-001',
      flavorType: 'TOBACCO',
      price: 29.99,
      netWeightGrams: 50,
      caUtlApproved: true,
      sensoryCooling: false,
      active: true,
    };

    mockPrisma.address.findUnique
      .mockResolvedValueOnce(shippingAddress as any)
      .mockResolvedValueOnce(billingAddress as any);

    mockPrisma.product.findMany.mockResolvedValue([product] as any);

    mockPrisma.order.create.mockResolvedValue({
      id: 'order-123',
      userId: 'user-123',
      shippingAddressId: 'addr-1',
      billingAddressId: 'addr-2',
      status: OrderStatus.PAID,
      totalAmount: 29.99,
      taxAmount: 0,
      exciseTaxAmount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [],
    } as any);

    mockPrisma.complianceSnapshot.create.mockResolvedValue({
      id: 'snapshot-123',
      orderId: 'order-123',
      shippingState: 'NY',
      caFlavorCheck: ComplianceCheckResult.PASS,
      caSensoryCheck: ComplianceCheckResult.PASS,
      poBoxCheck: ComplianceCheckResult.PASS,
      ageVerificationCheck: ComplianceCheckResult.PASS,
      stakeCallRequired: false,
      finalDecision: ComplianceDecision.ALLOW,
      createdAt: new Date(),
    } as any);

    mockPrisma.ageVerification.create.mockResolvedValue({} as any);
    mockPrisma.auditEvent.create.mockResolvedValue({} as any);
    mockPrisma.payment.create.mockResolvedValue({} as any);

    const response = await app.inject({
      method: 'POST',
      url: '/orders',
      headers: {
        authorization: 'Bearer test-token',
      },
      payload: {
        shippingAddressId: 'addr-1',
        billingAddressId: 'addr-2',
        items: [
          {
            productId: 'prod-1',
            quantity: 1,
          },
        ],
        customerFirstName: 'John',
        customerLastName: 'Doe',
        customerDateOfBirth: '1990-01-01',
        isFirstTimeRecipient: false,
        payment: {
          cardNumber: '4111111111111111',
          expirationDate: '12/25',
          cvv: '123',
        },
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.orderId).toBe('order-123');
    expect(body.data.status).toBe(OrderStatus.PAID);
    expect(body.data.stakeCallRequired).toBe(false);
    expect(body.data.paymentTransactionId).toBe('authnet-txn-123');

    // Verify compliance snapshot was created
    expect(mockPrisma.complianceSnapshot.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: 'order-123',
        shippingState: 'NY',
        finalDecision: ComplianceDecision.ALLOW,
      }),
    });

    // Verify Veriff was called
    expect(mockVerifyAge).toHaveBeenCalledWith({
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: '1990-01-01',
      address: {
        line1: '123 Main St',
        city: 'New York',
        state: 'NY',
        zip: '10001',
        country: 'US',
      },
    });

    // Verify age verification record was created with Veriff reference
    expect(mockPrisma.ageVerification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: 'order-123',
        provider: 'VERIFF',
        status: 'PASS',
        referenceId: 'veriff-session-123',
      }),
    });

    // Verify order was created with correct pricing
    expect(mockPrisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          totalAmount: 29.99, // product.price * quantity (no tax in test)
          subtotal: 29.99, // subtotal should match product price * quantity
          taxAmount: 0,
          exciseTaxAmount: 0,
          items: {
            create: expect.arrayContaining([
              expect.objectContaining({
                productId: 'prod-1',
                quantity: 1,
                unitPrice: 29.99,
              }),
            ]),
          },
        }),
      })
    );

    // Verify payment was authorized
    expect(mockAuthorizePayment).toHaveBeenCalledWith({
      amount: 29.99, // product.price * quantity (no tax in test)
      cardNumber: '4111111111111111',
      expirationDate: '1225',
      cvv: '123',
      billingAddress: expect.objectContaining({
        firstName: 'John',
        lastName: 'Doe',
      }),
    });

    // Verify payment record was created
    expect(mockPrisma.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: 'order-123',
        provider: PaymentProvider.AUTHORIZE_NET,
        status: PaymentStatus.AUTHORIZED,
        transactionId: 'authnet-txn-123',
      }),
    });
  });

  it('should return 403 when Veriff age verification fails', async () => {
    const shippingAddress = {
      id: 'addr-1',
      state: 'NY',
      isPoBox: false,
      recipientName: 'John Doe',
      phone: '555-1234',
      line1: '123 Main St',
      city: 'New York',
      postalCode: '10001',
      country: 'US',
    };

    const billingAddress = {
      id: 'addr-2',
      state: 'NY',
      isPoBox: false,
      recipientName: 'John Doe',
      phone: '555-1234',
      line1: '123 Main St',
      city: 'New York',
      postalCode: '10001',
      country: 'US',
    };

    mockPrisma.address.findUnique
      .mockResolvedValueOnce(shippingAddress as any)
      .mockResolvedValueOnce(billingAddress as any);

    const product = {
      id: 'prod-1',
      name: 'Test Product',
      sku: 'TEST-001',
      flavorType: 'TOBACCO',
      price: 29.99,
      netWeightGrams: 50,
      caUtlApproved: true,
      sensoryCooling: false,
      active: true,
    };

    mockPrisma.product.findMany.mockResolvedValue([product] as any);

    // Mock Veriff FAIL
    mockVerifyAge.mockResolvedValue({
      status: 'FAIL',
      referenceId: 'veriff-session-456',
      reasonCode: 'AGE_VERIFICATION_FAILED',
    });

    mockPrisma.auditEvent.create.mockResolvedValue({} as any);

    const response = await app.inject({
      method: 'POST',
      url: '/orders',
      headers: {
        authorization: 'Bearer test-token',
      },
      payload: {
        shippingAddressId: 'addr-1',
        billingAddressId: 'addr-2',
        items: [{ productId: 'prod-1', quantity: 1 }],
        customerFirstName: 'John',
        customerLastName: 'Doe',
        customerDateOfBirth: '2010-01-01', // Underage
        isFirstTimeRecipient: false,
        payment: {
          cardNumber: '4111111111111111',
          expirationDate: '12/25',
          cvv: '123',
        },
      },
    });

    expect(response.statusCode).toBe(403);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('AGE_VERIFICATION_FAILED');
    expect(body.error.reasonCode).toBe('AGE_VERIFICATION_FAILED');

    // Verify order was NOT created
    expect(mockPrisma.order.create).not.toHaveBeenCalled();
  });

  it('should return 403 when Veriff times out', async () => {
    const shippingAddress = {
      id: 'addr-1',
      state: 'NY',
      isPoBox: false,
      recipientName: 'John Doe',
      phone: '555-1234',
      line1: '123 Main St',
      city: 'New York',
      postalCode: '10001',
      country: 'US',
    };

    const billingAddress = {
      id: 'addr-2',
      state: 'NY',
      isPoBox: false,
      recipientName: 'John Doe',
      phone: '555-1234',
      line1: '123 Main St',
      city: 'New York',
      postalCode: '10001',
      country: 'US',
    };

    mockPrisma.address.findUnique
      .mockResolvedValueOnce(shippingAddress as any)
      .mockResolvedValueOnce(billingAddress as any);

    const product = {
      id: 'prod-1',
      name: 'Test Product',
      sku: 'TEST-001',
      flavorType: 'TOBACCO',
      price: 29.99,
      netWeightGrams: 50,
      caUtlApproved: true,
      sensoryCooling: false,
      active: true,
    };

    mockPrisma.product.findMany.mockResolvedValue([product] as any);

    // Mock Veriff timeout
    mockVerifyAge.mockRejectedValue({
      code: 'VERIFF_TIMEOUT',
      message: 'Age verification timeout',
    });

    mockPrisma.auditEvent.create.mockResolvedValue({} as any);

    const response = await app.inject({
      method: 'POST',
      url: '/orders',
      headers: {
        authorization: 'Bearer test-token',
      },
      payload: {
        shippingAddressId: 'addr-1',
        billingAddressId: 'addr-2',
        items: [{ productId: 'prod-1', quantity: 1 }],
        customerFirstName: 'John',
        customerLastName: 'Doe',
        customerDateOfBirth: '1990-01-01',
        isFirstTimeRecipient: false,
      },
    });

    expect(response.statusCode).toBe(403);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('AGE_VERIFICATION_FAILED');
    expect(body.error.reasonCode).toBe('VERIFF_TIMEOUT');

    // Verify order was NOT created
    expect(mockPrisma.order.create).not.toHaveBeenCalled();
  });

  it('should return 403 when compliance blocks order', async () => {
    const shippingAddress = {
      id: 'addr-1',
      state: 'CA',
      isPoBox: false,
      recipientName: 'John Doe',
      phone: '555-1234',
      line1: '123 Main St',
      city: 'Los Angeles',
      postalCode: '90001',
      country: 'US',
    };

    const billingAddress = {
      id: 'addr-2',
      state: 'CA',
      isPoBox: false,
      recipientName: 'John Doe',
      phone: '555-1234',
      line1: '123 Main St',
      city: 'Los Angeles',
      postalCode: '90001',
      country: 'US',
    };

    const product = {
      id: 'prod-1',
      name: 'Fruit Flavor Product',
      sku: 'FRUIT-001',
      flavorType: 'FRUIT', // This will trigger CA flavor ban
      price: 34.99,
      netWeightGrams: 50,
      caUtlApproved: true,
      sensoryCooling: false,
      active: true,
    };

    mockPrisma.address.findUnique
      .mockResolvedValueOnce(shippingAddress as any)
      .mockResolvedValueOnce(billingAddress as any);

    mockPrisma.product.findMany.mockResolvedValue([product] as any);

    const response = await app.inject({
      method: 'POST',
      url: '/orders',
      headers: {
        authorization: 'Bearer test-token',
      },
      payload: {
        shippingAddressId: 'addr-1',
        billingAddressId: 'addr-2',
        items: [
          {
            productId: 'prod-1',
            quantity: 1,
          },
        ],
        customerFirstName: 'John',
        customerLastName: 'Doe',
        customerDateOfBirth: '1990-01-01',
        isFirstTimeRecipient: false,
        payment: {
          cardNumber: '4111111111111111',
          expirationDate: '12/25',
          cvv: '123',
        },
      },
    });

    expect(response.statusCode).toBe(403);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('ORDER_BLOCKED');
    expect(body.error.reasonCodes).toContain('CA_FLAVOR_BAN');

    // Verify order was NOT created
    expect(mockPrisma.order.create).not.toHaveBeenCalled();
  });

  it('should return 400 when shipping address not found', async () => {
    mockPrisma.address.findUnique.mockResolvedValueOnce(null);

    const response = await app.inject({
      method: 'POST',
      url: '/orders',
      headers: {
        authorization: 'Bearer test-token',
      },
      payload: {
        shippingAddressId: 'addr-1',
        billingAddressId: 'addr-2',
        items: [{ productId: 'prod-1', quantity: 1 }],
        customerFirstName: 'John',
        customerLastName: 'Doe',
        customerDateOfBirth: '1990-01-01',
        isFirstTimeRecipient: false,
        payment: {
          cardNumber: '4111111111111111',
          expirationDate: '12/25',
          cvv: '123',
        },
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('SHIPPING_ADDRESS_NOT_FOUND');
  });

  it('should return 400 when products not found', async () => {
    const shippingAddress = {
      id: 'addr-1',
      state: 'NY',
      isPoBox: false,
    };

    const billingAddress = {
      id: 'addr-2',
      state: 'NY',
      isPoBox: false,
    };

    mockPrisma.address.findUnique
      .mockResolvedValueOnce(shippingAddress as any)
      .mockResolvedValueOnce(billingAddress as any);

    mockPrisma.product.findMany.mockResolvedValue([]); // No products found

    const response = await app.inject({
      method: 'POST',
      url: '/orders',
      headers: {
        authorization: 'Bearer test-token',
      },
      payload: {
        shippingAddressId: 'addr-1',
        billingAddressId: 'addr-2',
        items: [{ productId: 'prod-1', quantity: 1 }],
        customerFirstName: 'John',
        customerLastName: 'Doe',
        customerDateOfBirth: '1990-01-01',
        isFirstTimeRecipient: false,
        payment: {
          cardNumber: '4111111111111111',
          expirationDate: '12/25',
          cvv: '123',
        },
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('PRODUCTS_NOT_FOUND');
  });

  it('should return 402 when payment authorization fails', async () => {
    const shippingAddress = {
      id: 'addr-1',
      state: 'NY',
      isPoBox: false,
      recipientName: 'John Doe',
      phone: '555-1234',
      line1: '123 Main St',
      city: 'New York',
      postalCode: '10001',
      country: 'US',
    };

    const billingAddress = {
      id: 'addr-2',
      state: 'NY',
      isPoBox: false,
      recipientName: 'John Doe',
      phone: '555-1234',
      line1: '123 Main St',
      city: 'New York',
      postalCode: '10001',
      country: 'US',
    };

    const product = {
      id: 'prod-1',
      name: 'Test Product',
      sku: 'TEST-001',
      flavorType: 'TOBACCO',
      price: 29.99,
      netWeightGrams: 50,
      caUtlApproved: true,
      sensoryCooling: false,
      active: true,
    };

    mockPrisma.address.findUnique
      .mockResolvedValueOnce(shippingAddress as any)
      .mockResolvedValueOnce(billingAddress as any);

    mockPrisma.product.findMany.mockResolvedValue([product] as any);

    // Mock Authorize.Net decline
    mockAuthorizePayment.mockRejectedValue({
      code: 'AUTHORIZATION_DECLINED',
      message: 'Card declined',
    });

    mockPrisma.auditEvent.create.mockResolvedValue({} as any);

    const response = await app.inject({
      method: 'POST',
      url: '/orders',
      headers: {
        authorization: 'Bearer test-token',
      },
      payload: {
        shippingAddressId: 'addr-1',
        billingAddressId: 'addr-2',
        items: [{ productId: 'prod-1', quantity: 1 }],
        customerFirstName: 'John',
        customerLastName: 'Doe',
        customerDateOfBirth: '1990-01-01',
        isFirstTimeRecipient: false,
        payment: {
          cardNumber: '4000000000000002', // Declined card
          expirationDate: '12/25',
          cvv: '123',
        },
      },
    });

    expect(response.statusCode).toBe(402);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('PAYMENT_AUTHORIZATION_FAILED');
    expect(body.error.reasonCode).toBe('AUTHORIZATION_DECLINED');

    // Verify order was NOT created
    expect(mockPrisma.order.create).not.toHaveBeenCalled();
  });

  it('should return 403 when Veriff approves but customer is under 21', async () => {
    const shippingAddress = {
      id: 'addr-1',
      state: 'NY',
      isPoBox: false,
      recipientName: 'John Doe',
      phone: '555-1234',
      line1: '123 Main St',
      city: 'New York',
      postalCode: '10001',
      country: 'US',
    };

    const billingAddress = {
      id: 'addr-2',
      state: 'NY',
      isPoBox: false,
      recipientName: 'John Doe',
      phone: '555-1234',
      line1: '123 Main St',
      city: 'New York',
      postalCode: '10001',
      country: 'US',
    };

    const product = {
      id: 'prod-1',
      name: 'Test Product',
      sku: 'TEST-001',
      flavorType: 'TOBACCO',
      price: 29.99,
      netWeightGrams: 50,
      caUtlApproved: true,
      sensoryCooling: false,
      active: true,
    };

    mockPrisma.address.findUnique
      .mockResolvedValueOnce(shippingAddress as any)
      .mockResolvedValueOnce(billingAddress as any);

    mockPrisma.product.findMany.mockResolvedValue([product] as any);

    // Mock Veriff approves but under 21
    mockVerifyAge.mockResolvedValue({
      status: 'FAIL',
      referenceId: 'veriff-session-789',
      reasonCode: 'UNDER_21',
      message: 'Age verification approved but customer is under 21',
    });

    mockPrisma.auditEvent.create.mockResolvedValue({} as any);

    const response = await app.inject({
      method: 'POST',
      url: '/orders',
      headers: {
        authorization: 'Bearer test-token',
      },
      payload: {
        shippingAddressId: 'addr-1',
        billingAddressId: 'addr-2',
        items: [{ productId: 'prod-1', quantity: 1 }],
        customerFirstName: 'John',
        customerLastName: 'Doe',
        customerDateOfBirth: '2010-01-01', // Under 21
        isFirstTimeRecipient: false,
        payment: {
          cardNumber: '4111111111111111',
          expirationDate: '12/25',
          cvv: '123',
        },
      },
    });

    expect(response.statusCode).toBe(403);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('AGE_VERIFICATION_FAILED');
    expect(body.error.reasonCode).toBe('UNDER_21');
    expect(mockPrisma.order.create).not.toHaveBeenCalled();
  });

  it('should return 400 when product has invalid price', async () => {
    const shippingAddress = {
      id: 'addr-1',
      state: 'NY',
      isPoBox: false,
      recipientName: 'John Doe',
      phone: '555-1234',
      line1: '123 Main St',
      city: 'New York',
      postalCode: '10001',
      country: 'US',
    };

    const billingAddress = {
      id: 'addr-2',
      state: 'NY',
      isPoBox: false,
      recipientName: 'John Doe',
      phone: '555-1234',
      line1: '123 Main St',
      city: 'New York',
      postalCode: '10001',
      country: 'US',
    };

    const product = {
      id: 'prod-1',
      name: 'Test Product',
      sku: 'TEST-001',
      flavorType: 'TOBACCO',
      price: 0, // Invalid price
      netWeightGrams: 50,
      caUtlApproved: true,
      sensoryCooling: false,
      active: true,
    };

    mockPrisma.address.findUnique
      .mockResolvedValueOnce(shippingAddress as any)
      .mockResolvedValueOnce(billingAddress as any);

    mockPrisma.product.findMany.mockResolvedValue([product] as any);

    const response = await app.inject({
      method: 'POST',
      url: '/orders',
      headers: { authorization: 'Bearer test-token' },
      payload: {
        shippingAddressId: 'addr-1',
        billingAddressId: 'addr-2',
        items: [{ productId: 'prod-1', quantity: 1 }],
        customerFirstName: 'John',
        customerLastName: 'Doe',
        customerDateOfBirth: '1990-01-01',
        isFirstTimeRecipient: false,
        payment: {
          cardNumber: '4111111111111111',
          expirationDate: '12/25',
          cvv: '123',
        },
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_PRODUCT_PRICE');
    expect(mockPrisma.order.create).not.toHaveBeenCalled();
  });

  it('should return 400 when item quantity is invalid', async () => {
    const shippingAddress = {
      id: 'addr-1',
      state: 'NY',
      isPoBox: false,
      recipientName: 'John Doe',
      phone: '555-1234',
      line1: '123 Main St',
      city: 'New York',
      postalCode: '10001',
      country: 'US',
    };

    const billingAddress = {
      id: 'addr-2',
      state: 'NY',
      isPoBox: false,
      recipientName: 'John Doe',
      phone: '555-1234',
      line1: '123 Main St',
      city: 'New York',
      postalCode: '10001',
      country: 'US',
    };

    const product = {
      id: 'prod-1',
      name: 'Test Product',
      sku: 'TEST-001',
      flavorType: 'TOBACCO',
      price: 29.99,
      netWeightGrams: 50,
      caUtlApproved: true,
      sensoryCooling: false,
      active: true,
    };

    mockPrisma.address.findUnique
      .mockResolvedValueOnce(shippingAddress as any)
      .mockResolvedValueOnce(billingAddress as any);

    mockPrisma.product.findMany.mockResolvedValue([product] as any);

    const response = await app.inject({
      method: 'POST',
      url: '/orders',
      headers: { authorization: 'Bearer test-token' },
      payload: {
        shippingAddressId: 'addr-1',
        billingAddressId: 'addr-2',
        items: [{ productId: 'prod-1', quantity: 0 }], // Invalid quantity
        customerFirstName: 'John',
        customerLastName: 'Doe',
        customerDateOfBirth: '1990-01-01',
        isFirstTimeRecipient: false,
        payment: {
          cardNumber: '4111111111111111',
          expirationDate: '12/25',
          cvv: '123',
        },
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('INVALID_QUANTITY');
    expect(mockPrisma.order.create).not.toHaveBeenCalled();
  });
});
