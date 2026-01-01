/**
 * Get current user endpoint
 * GET /api/me
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@lumi/db';
import { requireAuth } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { user } = authResult;

  const userData = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  if (!userData) {
    return NextResponse.json(
      { success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, data: userData });
}
