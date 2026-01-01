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

    return NextResponse.json({
      success: true,
      data: products,
    });
  } catch (error) {
    console.error('Get products error:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'An error occurred' },
      },
      { status: 500 }
    );
  }
}
