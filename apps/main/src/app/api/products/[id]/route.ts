/**
 * Get single product
 * GET /api/products/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@lumi/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const product = await prisma.product.findUnique({
      where: { id: params.id, active: true },
      select: {
        id: true,
        name: true,
        sku: true,
        flavorType: true,
        nicotineMg: true,
        netWeightGrams: true,
        caUtlApproved: true,
        sensoryCooling: true,
        imageUrl: true,
        price: true,
      },
    });

    if (!product) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found' },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error('Get product error:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'An error occurred' },
      },
      { status: 500 }
    );
  }
}
