/**
 * Detailed health check endpoint
 * GET /api/health/detailed
 */

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Import monitoring service if it exists
    // For now, return basic health check
    const { prisma } = await import('@lumi/db');
    
    try {
      await prisma.$queryRaw`SELECT 1`;
      return NextResponse.json({
        status: 'healthy',
        checks: { database: 'connected' },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      return NextResponse.json({
        status: 'unhealthy',
        checks: { database: 'error' },
        timestamp: new Date().toISOString(),
      }, { status: 503 });
    }
  } catch (error) {
    console.error('Detailed health check failed:', error);
    return NextResponse.json(
      {
        status: 'unhealthy',
        checks: { database: 'error' },
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
