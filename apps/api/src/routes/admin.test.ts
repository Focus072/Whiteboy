import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildFastify } from '../test-helpers.js';
import { OrderStatus, PaymentStatus, ComplianceDecision, ComplianceCheckResult } from '@lumi/db';

// Mock bcrypt
vi.mock('bcrypt', () => ({
  default: {
    compare: vi.fn().mockResolvedValue(true),
    hash: vi.fn().mockResolvedValue('hashed'),
  },
}));

// Mock AWS S3
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue({}),
  })),
  PutObjectCommand: vi.fn(),
}));

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    order: {
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    stakeCall: {
      create: vi.fn(),
    },
    payment: {
      update: vi.fn(),
    },
    config: {
      findUnique: vi.fn(),
    },
    file: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    auditEvent: {
      create: vi.fn(),
    },
    session: {
      findUnique: vi.fn(),
    },
    pactReport: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => mockPrisma),
  OrderStatus: {
    DRAFT: 'DRAFT',
    PAID: 'PAID',
    SHIPPED: 'SHIPPED',
  },
  PaymentStatus: {
    AUTHORIZED: 'AUTHORIZED',
    CAPTURED: 'CAPTURED',
  },
  ComplianceDecision: {
    ALLOW: 'ALLOW',
    BLOCK: 'BLOCK',
  },
  ComplianceCheckResult: {
    PASS: 'PASS',
    FAIL: 'FAIL',
  },
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

// Mock Authorize.Net capture
const mockCapturePayment = vi.fn();
vi.mock('../services/authorizenet.js', () => ({
  capturePayment: (...args: any[]) => mockCapturePayment(...args),
}));

// Mock Shippo
const mockCreateShippingLabel = vi.fn();
vi.mock('../services/shippo.js', () => ({
  createShippingLabel: (...args: any[]) => mockCreateShippingLabel(...args),
}));

// Mock fetch for label download
global.fetch = vi.fn();

describe('POST /admin/orders/:id/stake-call', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildFastify();
    await app.ready();

    const testUser = {
      id: 'admin-123',
      email: 'admin@example.com',
      role: 'ADMIN',
    };

    mockPrisma.session.findUnique.mockResolvedValue({
      id: 'session-123',
      userId: testUser.id,
      tokenHash: 'hash',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
      revokedAt: null,
      user: testUser,
    } as any);
  });

  it('should create STAKE call record', async () => {
    const order = {
      id: 'order-123',
      status: OrderStatus.PAID,
    };

    mockPrisma.order.findUnique.mockResolvedValue(order as any);
    mockPrisma.stakeCall.create.mockResolvedValue({
      id: 'stake-123',
      orderId: 'order-123',
      calledAt: new Date(),
      adminUserId: 'admin-123',
      notes: 'Called customer, verified identity',
    } as any);
    mockPrisma.auditEvent.create.mockResolvedValue({} as any);

    const response = await app.inject({
      method: 'POST',
      url: '/admin/orders/order-123/stake-call',
      headers: {
        authorization: 'Bearer test-token',
      },
      payload: {
        notes: 'Called customer, verified identity',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.stakeCallId).toBe('stake-123');
  });
});

describe('POST /admin/orders/:id/ship', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildFastify();
    await app.ready();

    const testUser = {
      id: 'admin-123',
      email: 'admin@example.com',
      role: 'ADMIN',
    };

    mockPrisma.session.findUnique.mockResolvedValue({
      id: 'session-123',
      userId: testUser.id,
      tokenHash: 'hash',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
      revokedAt: null,
      user: testUser,
    } as any);

    // Default mocks
    mockCapturePayment.mockResolvedValue({
      transactionId: 'capture-txn-123',
    });

    mockCreateShippingLabel.mockResolvedValue({
      labelUrl: 'https://shippo.com/label.pdf',
      trackingNumber: '1Z999AA10123456784',
      carrier: 'UPS',
      serviceLevel: 'UPS Ground',
    });

    (global.fetch as any).mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
    });
  });

  it('should ship order successfully', async () => {
    const order = {
      id: 'order-123',
      status: OrderStatus.PAID,
      totalAmount: 100.00,
      taxAmount: 10.00,
      exciseTaxAmount: 5.00,
      shippingAddress: {
        recipientName: 'John Doe',
        line1: '123 Main St',
        line2: null,
        city: 'New York',
        state: 'NY',
        postalCode: '10001',
        country: 'US',
        phone: '555-1234',
        isPoBox: false,
      },
      complianceSnapshot: {
        finalDecision: ComplianceDecision.ALLOW,
        stakeCallRequired: false,
      },
      payments: [{
        id: 'payment-123',
        status: PaymentStatus.AUTHORIZED,
        transactionId: 'auth-txn-123',
      }],
      stakeCalls: [],
    };

    mockPrisma.order.findUnique.mockResolvedValue(order as any);
    mockPrisma.config.findUnique.mockResolvedValue(null);
    mockPrisma.payment.update.mockResolvedValue({} as any);
    mockPrisma.file.create.mockResolvedValue({
      id: 'file-123',
    } as any);
    mockPrisma.order.update.mockResolvedValue({
      ...order,
      status: OrderStatus.SHIPPED,
      trackingNumber: '1Z999AA10123456784',
    } as any);
    mockPrisma.auditEvent.create.mockResolvedValue({} as any);

    const response = await app.inject({
      method: 'POST',
      url: '/admin/orders/order-123/ship',
      headers: {
        authorization: 'Bearer test-token',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.trackingNumber).toBe('1Z999AA10123456784');
    expect(body.data.carrier).toBe('UPS');

    // Verify payment was captured
    expect(mockCapturePayment).toHaveBeenCalledWith('auth-txn-123', 115.00);
    expect(mockPrisma.payment.update).toHaveBeenCalledWith({
      where: { id: 'payment-123' },
      data: { status: PaymentStatus.CAPTURED },
    });

    // Verify order was updated
    expect(mockPrisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order-123' },
      data: expect.objectContaining({
        status: OrderStatus.SHIPPED,
        trackingNumber: '1Z999AA10123456784',
        carrier: 'UPS',
      }),
    });
  });

  it('should return 403 when STAKE call required but missing', async () => {
    const order = {
      id: 'order-123',
      status: OrderStatus.PAID,
      shippingAddress: {
        isPoBox: false,
      },
      complianceSnapshot: {
        finalDecision: ComplianceDecision.ALLOW,
        stakeCallRequired: true, // Requires STAKE call
      },
      payments: [{
        status: PaymentStatus.AUTHORIZED,
        transactionId: 'auth-txn-123',
      }],
      stakeCalls: [], // No STAKE call
    };

    mockPrisma.order.findUnique.mockResolvedValue(order as any);
    mockPrisma.auditEvent.create.mockResolvedValue({} as any);

    const response = await app.inject({
      method: 'POST',
      url: '/admin/orders/order-123/ship',
      headers: {
        authorization: 'Bearer test-token',
      },
    });

    expect(response.statusCode).toBe(403);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('SHIPPING_NOT_ALLOWED');
    expect(body.error.reasons).toContain('STAKE Act call required for CA first-time recipient');

    // Verify order was NOT updated
    expect(mockPrisma.order.update).not.toHaveBeenCalled();
  });

  it('should return 403 when order status is not PAID', async () => {
    const order = {
      id: 'order-123',
      status: OrderStatus.DRAFT, // Not PAID
      shippingAddress: {
        isPoBox: false,
      },
      complianceSnapshot: {
        finalDecision: ComplianceDecision.ALLOW,
        stakeCallRequired: false,
      },
      payments: [{
        status: PaymentStatus.AUTHORIZED,
      }],
      stakeCalls: [],
    };

    mockPrisma.order.findUnique.mockResolvedValue(order as any);
    mockPrisma.auditEvent.create.mockResolvedValue({} as any);

    const response = await app.inject({
      method: 'POST',
      url: '/admin/orders/order-123/ship',
      headers: {
        authorization: 'Bearer test-token',
      },
    });

    expect(response.statusCode).toBe(403);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('SHIPPING_NOT_ALLOWED');
    expect(body.error.reasons).toContain('Order status is DRAFT, must be PAID');
  });

  it('should return 403 when shipping to PO box', async () => {
    const order = {
      id: 'order-123',
      status: OrderStatus.PAID,
      shippingAddress: {
        isPoBox: true, // PO box
      },
      complianceSnapshot: {
        finalDecision: ComplianceDecision.ALLOW,
        stakeCallRequired: false,
      },
      payments: [{
        status: PaymentStatus.AUTHORIZED,
      }],
      stakeCalls: [],
    };

    mockPrisma.order.findUnique.mockResolvedValue(order as any);
    mockPrisma.auditEvent.create.mockResolvedValue({} as any);

    const response = await app.inject({
      method: 'POST',
      url: '/admin/orders/order-123/ship',
      headers: {
        authorization: 'Bearer test-token',
      },
    });

    expect(response.statusCode).toBe(403);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('SHIPPING_NOT_ALLOWED');
    expect(body.error.reasons).toContain('Shipping address is a PO box');
  });

  it('should return 402 when payment capture fails', async () => {
    const order = {
      id: 'order-123',
      status: OrderStatus.PAID,
      totalAmount: 100.00,
      taxAmount: 10.00,
      exciseTaxAmount: 5.00,
      shippingAddress: {
        isPoBox: false,
      },
      complianceSnapshot: {
        finalDecision: ComplianceDecision.ALLOW,
        stakeCallRequired: false,
      },
      payments: [{
        id: 'payment-123',
        status: PaymentStatus.AUTHORIZED,
        transactionId: 'auth-txn-123',
      }],
      stakeCalls: [],
    };

    mockPrisma.order.findUnique.mockResolvedValue(order as any);
    mockCapturePayment.mockRejectedValue({
      code: 'CAPTURE_FAILED',
      message: 'Insufficient funds',
    });
    mockPrisma.auditEvent.create.mockResolvedValue({} as any);

    const response = await app.inject({
      method: 'POST',
      url: '/admin/orders/order-123/ship',
      headers: {
        authorization: 'Bearer test-token',
      },
    });

    expect(response.statusCode).toBe(402);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('PAYMENT_CAPTURE_FAILED');
  });

  it('should return 500 when Shippo fails', async () => {
    const order = {
      id: 'order-123',
      status: OrderStatus.PAID,
      totalAmount: 100.00,
      taxAmount: 10.00,
      exciseTaxAmount: 5.00,
      shippingAddress: {
        recipientName: 'John Doe',
        line1: '123 Main St',
        city: 'New York',
        state: 'NY',
        postalCode: '10001',
        country: 'US',
        phone: '555-1234',
        isPoBox: false,
      },
      complianceSnapshot: {
        finalDecision: ComplianceDecision.ALLOW,
        stakeCallRequired: false,
      },
      payments: [{
        id: 'payment-123',
        status: PaymentStatus.AUTHORIZED,
        transactionId: 'auth-txn-123',
      }],
      stakeCalls: [],
    };

    mockPrisma.order.findUnique.mockResolvedValue(order as any);
    mockPrisma.config.findUnique.mockResolvedValue(null);
    mockPrisma.payment.update.mockResolvedValue({} as any);
    mockCreateShippingLabel.mockRejectedValue({
      code: 'SHIPPO_ERROR',
      message: 'Shippo API error',
    });
    mockPrisma.auditEvent.create.mockResolvedValue({} as any);

    const response = await app.inject({
      method: 'POST',
      url: '/admin/orders/order-123/ship',
      headers: {
        authorization: 'Bearer test-token',
      },
    });

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('SHIPPO_ERROR');
  });
});

describe('POST /admin/reports/pact', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildFastify();
    await app.ready();

    const testUser = {
      id: 'admin-123',
      email: 'admin@example.com',
      role: 'ADMIN',
    };

    mockPrisma.session.findUnique.mockResolvedValue({
      id: 'session-123',
      userId: testUser.id,
      tokenHash: 'hash',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
      revokedAt: null,
      user: testUser,
    } as any);

    vi.clearAllMocks();
  });

  it('should generate PACT report successfully', async () => {
    const orders = [
      {
        id: 'order-1',
        status: OrderStatus.SHIPPED,
        shippedAt: new Date('2024-01-15'),
        carrier: 'UPS',
        trackingNumber: '1Z999AA10123456784',
        shippingAddress: {
          recipientName: 'John Doe',
          line1: '123 Main St',
          line2: null,
          city: 'Los Angeles',
          state: 'CA',
          postalCode: '90001',
        },
        items: [
          {
            quantity: 2,
            product: {
              name: 'Product A',
              sku: 'PROD-A-001',
              netWeightGrams: 50,
            },
          },
        ],
      },
    ];

    mockPrisma.pactReport.findFirst.mockResolvedValue(null); // No existing report
    mockPrisma.order.findMany.mockResolvedValue(orders as any);
    mockPrisma.file.create.mockResolvedValue({
      id: 'file-123',
      key: 'pact-reports/CA-2024-01-01-2024-01-31.csv',
      bucket: 'lumi-files',
    } as any);
    mockPrisma.pactReport.create.mockResolvedValue({
      id: 'report-123',
      state: 'CA',
      periodStart: new Date('2024-01-01'),
      periodEnd: new Date('2024-01-31'),
      fileId: 'file-123',
      generatedAt: new Date(),
    } as any);
    mockPrisma.auditEvent.create.mockResolvedValue({} as any);

    const response = await app.inject({
      method: 'POST',
      url: '/admin/reports/pact',
      headers: {
        authorization: 'Bearer test-token',
      },
      payload: {
        state: 'CA',
        periodStart: '2024-01-01',
        periodEnd: '2024-01-31',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.state).toBe('CA');
    expect(body.data.orderCount).toBe(1);
    expect(body.data.rowCount).toBe(1);

    // Verify report was created
    expect(mockPrisma.pactReport.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        state: 'CA',
        fileId: 'file-123',
      }),
    });
  });

  it('should return existing report if already generated (idempotent)', async () => {
    const existingReport = {
      id: 'report-123',
      state: 'CA',
      periodStart: new Date('2024-01-01'),
      periodEnd: new Date('2024-01-31'),
      fileId: 'file-123',
      generatedAt: new Date(),
    };

    const existingFile = {
      id: 'file-123',
      key: 'pact-reports/CA-2024-01-01-2024-01-31.csv',
    };

    mockPrisma.pactReport.findFirst.mockResolvedValue(existingReport as any);
    mockPrisma.file.findUnique.mockResolvedValue(existingFile as any);

    const response = await app.inject({
      method: 'POST',
      url: '/admin/reports/pact',
      headers: {
        authorization: 'Bearer test-token',
      },
      payload: {
        state: 'CA',
        periodStart: '2024-01-01',
        periodEnd: '2024-01-31',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.reportId).toBe('report-123');

    // Verify new report was NOT created
    expect(mockPrisma.pactReport.create).not.toHaveBeenCalled();
    expect(mockPrisma.order.findMany).not.toHaveBeenCalled();
  });

  it('should return 404 when no orders found', async () => {
    mockPrisma.pactReport.findFirst.mockResolvedValue(null);
    mockPrisma.order.findMany.mockResolvedValue([]); // No orders

    const response = await app.inject({
      method: 'POST',
      url: '/admin/reports/pact',
      headers: {
        authorization: 'Bearer test-token',
      },
      payload: {
        state: 'CA',
        periodStart: '2024-01-01',
        periodEnd: '2024-01-31',
      },
    });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('NO_ORDERS_FOUND');
  });

  it('should return 400 for invalid date range', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/admin/reports/pact',
      headers: {
        authorization: 'Bearer test-token',
      },
      payload: {
        state: 'CA',
        periodStart: '2024-01-31',
        periodEnd: '2024-01-01', // End before start
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('INVALID_DATE_RANGE');
  });
});

