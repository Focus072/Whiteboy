/**
 * Orders routes
 * POST /api/orders - Create order (guest checkout allowed)
 * GET /api/orders - Get user's orders (authenticated)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@lumi/db';
import { authenticateRequest, requireAuth } from '@/lib/api-auth';
import { createOrder } from '@/lib/order-helpers';

const createOrderSchema = z.object({
  shippingAddressId: z.string().min(1),
  billingAddressId: z.string().min(1),
  items: z.array(
    z.object({
      productId: z.string().min(1),
      quantity: z.number().int(),
    })
  ).min(1),
  customerFirstName: z.string().min(1),
  customerLastName: z.string().min(1),
  customerDateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be in YYYY-MM-DD format'),
  isFirstTimeRecipient: z.boolean(),
  payment: z.object({
    cardNumber: z.string().regex(/^\d{13,19}$/, 'Card number must be 13-19 digits'),
    expirationDate: z.string().regex(/^\d{2}\/\d{2}$/, 'Expiration date must be in MM/YY format'),
    cvv: z.string().regex(/^\d{3,4}$/, 'CVV must be 3-4 digits'),
  }).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Try to authenticate, but don't require it (guest checkout)
    const user = await authenticateRequest(request);
    const body = await request.json();
    const data = createOrderSchema.parse(body);

    const result = await createOrder({
      ...data,
      userId: user?.id || null,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          orderId: result.order.id,
          status: result.order.status,
          stakeCallRequired: result.stakeCallRequired,
          complianceSnapshotId: result.complianceSnapshot.id,
          paymentTransactionId: result.paymentTransactionId,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: error.errors[0].message },
        },
        { status: 400 }
      );
    }

    if (error.code && error.status) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            reasonCode: error.reasonCode,
            reasonCodes: error.reasonCodes,
          },
        },
        { status: error.status }
      );
    }

    console.error('Create order error:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'An error occurred' },
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get('page')) || 1;
    const pageSize = Math.min(Number(searchParams.get('pageSize')) || 20, 100);
    const skip = (page - 1) * pageSize;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { userId: user.id },
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          shippingAddress: true,
          complianceSnapshot: true,
        },
      }),
      prisma.order.count({ where: { userId: user.id } }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        items: orders,
        total,
        page,
        pageSize,
      },
    });
  } catch (error) {
    console.error('Get orders error:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'An error occurred' },
      },
      { status: 500 }
    );
  }
}
