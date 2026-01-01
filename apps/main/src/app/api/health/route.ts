/**
 * Health check endpoint
 * GET /api/health
 */

import { NextResponse } from 'next/server';
import { prisma } from '@lumi/db';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json(
      { status: 'error', database: 'disconnected' },
      { status: 503 }
    );
  }
}
