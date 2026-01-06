/**
 * Products routes
 * GET /api/products - Get products (public)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@lumi/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;
    const flavorType = searchParams.get('flavorType') || undefined;
    const minNicotine = searchParams.get('minNicotine') ? parseFloat(searchParams.get('minNicotine')!) : undefined;
    const maxNicotine = searchParams.get('maxNicotine') ? parseFloat(searchParams.get('maxNicotine')!) : undefined;
    const sort = searchParams.get('sort') || 'name';

    const where: any = {
      active: true,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (flavorType) {
      where.flavorType = flavorType;
    }

    if (minNicotine !== undefined || maxNicotine !== undefined) {
      where.nicotineMg = {};
      if (minNicotine !== undefined) where.nicotineMg.gte = minNicotine;
      if (maxNicotine !== undefined) where.nicotineMg.lte = maxNicotine;
    }

    const orderBy: any = {};
    switch (sort) {
      case 'name':
        orderBy.name = 'asc';
        break;
      case 'price-asc':
        orderBy.price = 'asc';
        break;
      case 'price-desc':
        orderBy.price = 'desc';
        break;
      case 'nicotine-asc':
        orderBy.nicotineMg = 'asc';
        break;
      case 'nicotine-desc':
        orderBy.nicotineMg = 'desc';
        break;
      default:
        orderBy.name = 'asc';
    }

    const products = await prisma.product.findMany({
      where,
      orderBy,
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

    // Convert Decimal to string for JSON serialization
    const serializedProducts = products.map(product => ({
      ...product,
      price: product.price.toString(),
    }));

    return NextResponse.json({
      success: true,
      data: serializedProducts,
    });
  } catch (error) {
    const { logError } = await import('@/lib/services/monitoring');
    await logError(error, {
      metadata: { component: 'products-api', endpoint: 'GET /api/products' },
    });
    
    const { formatApiError } = await import('@/lib/utils/error-messages');
    const formattedError = formatApiError('INTERNAL_ERROR', error instanceof Error ? error.message : String(error));
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: formattedError.code,
          message: formattedError.userMessage,
          ...(process.env.NODE_ENV === 'development' && {
            technicalMessage: formattedError.message,
          }),
        },
      },
      { status: 500 }
    );
  }
}
