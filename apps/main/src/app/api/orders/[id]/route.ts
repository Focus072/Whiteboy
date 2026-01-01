/**
 * Get order details
 * GET /api/orders/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@lumi/db';
import { requireAuth } from '@/lib/api-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;

    const order = await prisma.order.findFirst({
      where: {
        id: params.id,
        userId: user.id, // Ensure user can only access their own orders
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        shippingAddress: true,
        billingAddress: true,
        complianceSnapshot: true,
        ageVerification: true,
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        stakeCalls: {
          orderBy: { calledAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'ORDER_NOT_FOUND', message: 'Order not found' },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error('Get order error:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'An error occurred' },
      },
      { status: 500 }
    );
  }
}
