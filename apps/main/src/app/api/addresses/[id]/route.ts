/**
 * Update or delete address
 * PUT /api/addresses/[id] - Update address (authenticated)
 * DELETE /api/addresses/[id] - Delete address (authenticated)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@lumi/db';
import { requireAuth } from '@/lib/api-auth';

const updateAddressSchema = z.object({
  recipientName: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
  line1: z.string().min(1).optional(),
  line2: z.string().optional(),
  city: z.string().min(1).optional(),
  state: z.string().length(2).optional(),
  postalCode: z.string().min(1).optional(),
  country: z.string().optional(),
  isPoBox: z.boolean().optional(),
  isDefault: z.boolean().optional(),
}).partial();

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    const body = await request.json();
    const data = updateAddressSchema.parse(body);

    const address = await prisma.address.findFirst({
      where: {
        id: params.id,
        userId: user.id,
      },
    });

    if (!address) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'ADDRESS_NOT_FOUND', message: 'Address not found' },
        },
        { status: 404 }
      );
    }

    // If setting as default, unset other defaults
    if (data.isDefault) {
      await prisma.address.updateMany({
        where: { userId: user.id, isDefault: true, id: { not: params.id } },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.address.update({
      where: { id: params.id },
      data: {
        ...(data.recipientName !== undefined && { recipientName: data.recipientName }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.line1 !== undefined && { line1: data.line1 }),
        ...(data.line2 !== undefined && { line2: data.line2 }),
        ...(data.city !== undefined && { city: data.city }),
        ...(data.state !== undefined && { state: data.state }),
        ...(data.postalCode !== undefined && { postalCode: data.postalCode }),
        ...(data.country !== undefined && { country: data.country }),
        ...(data.isPoBox !== undefined && { isPoBox: data.isPoBox }),
        ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
      },
    });

    return NextResponse.json({
      success: true,
      data: updated,
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
    console.error('Update address error:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'An error occurred' },
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;

    const address = await prisma.address.findFirst({
      where: {
        id: params.id,
        userId: user.id,
      },
    });

    if (!address) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'ADDRESS_NOT_FOUND', message: 'Address not found' },
        },
        { status: 404 }
      );
    }

    await prisma.address.delete({
      where: { id: params.id },
    });

    return NextResponse.json({
      success: true,
      data: { message: 'Address deleted successfully' },
    });
  } catch (error) {
    console.error('Delete address error:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'An error occurred' },
      },
      { status: 500 }
    );
  }
}
