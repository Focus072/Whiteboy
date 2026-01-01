/**
 * Test database connectivity
 * GET /api/test-db
 */

import { NextResponse } from 'next/server';
import { prisma } from '@lumi/db';

export async function GET() {
  try {
    // Test basic database connection
    await prisma.$queryRaw`SELECT 1`;
    
    // Test if products table exists
    const productCount = await prisma.product.count();
    
    return NextResponse.json({
      success: true,
      message: 'Database connected',
      productCount,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('Database test error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: errorMessage,
          stack: errorStack,
        },
      },
      { status: 500 }
    );
  }
}
