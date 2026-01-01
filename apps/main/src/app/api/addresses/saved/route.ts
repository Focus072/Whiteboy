/**
 * Create saved address (authenticated)
 * POST /api/addresses/saved
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@lumi/db';
import { requireAuth } from '@/lib/api-auth';

const createSavedAddressSchema = z.object({
  recipientName: z.string().min(1),
  phone: z.string().min(1),
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().length(2),
  postalCode: z.string().min(1),
  country: z.string().default('US'),
  isPoBox: z.boolean().default(false),
  isDefault: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    const body = await request.json();
    const data = createSavedAddressSchema.parse(body);

    // Check if address is PO box
    const isPoBox = data.isPoBox ||
                   data.line1.toLowerCase().includes('po box') ||
                   data.line1.toLowerCase().includes('p.o. box') ||
                   data.line1.toLowerCase().startsWith('po ');

    // If this is set as default, unset other defaults
    if (data.isDefault) {
      await prisma.address.updateMany({
        where: { userId: user.id, isDefault: true },
        data: { isDefault: false },
      });
    }

    const address = await prisma.address.create({
      data: {
        userId: user.id,
        recipientName: data.recipientName,
        phone: data.phone,
        line1: data.line1,
        line2: data.line2,
        city: data.city,
        state: data.state,
        postalCode: data.postalCode,
        country: data.country,
        isPoBox,
        isDefault: data.isDefault || false,
      },
    });

    return NextResponse.json({
      success: true,
      data: address,
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
    console.error('Create saved address error:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'An error occurred' },
      },
      { status: 500 }
    );
  }
}
