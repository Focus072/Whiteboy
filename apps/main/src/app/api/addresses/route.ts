/**
 * Addresses routes
 * POST /api/addresses - Create address (public, for guest checkout)
 * GET /api/addresses - Get user's saved addresses (authenticated)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@lumi/db';
import { authenticateRequest } from '@/lib/api-auth';

const createAddressSchema = z.object({
  recipientName: z.string().min(1),
  phone: z.string().min(1),
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().length(2),
  postalCode: z.string().min(1),
  country: z.string().default('US'),
  isPoBox: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = createAddressSchema.parse(body);

    // Check if address is PO box
    const isPoBox = data.isPoBox ||
                   data.line1.toLowerCase().includes('po box') ||
                   data.line1.toLowerCase().includes('p.o. box') ||
                   data.line1.toLowerCase().startsWith('po ');

    // Try to authenticate, but don't require it (guest checkout)
    const user = await authenticateRequest(request);
    const userId = user?.id || null;

    const address = await prisma.address.create({
      data: {
        userId,
        recipientName: data.recipientName,
        phone: data.phone,
        line1: data.line1,
        line2: data.line2,
        city: data.city,
        state: data.state,
        postalCode: data.postalCode,
        country: data.country,
        isPoBox,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: address.id,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: error.errors[0].message },
        },
        { status: 400 }
      );
    }
    console.error('Create address error:', error);
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
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        },
        { status: 401 }
      );
    }

    const addresses = await prisma.address.findMany({
      where: { userId: user.id },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return NextResponse.json({
      success: true,
      data: addresses,
    });
  } catch (error) {
    console.error('Get addresses error:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'An error occurred' },
      },
      { status: 500 }
    );
  }
}
