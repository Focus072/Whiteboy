/**
 * Logout endpoint
 * POST /api/auth/logout
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@lumi/db';
import { authenticateRequest } from '@/lib/api-auth';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    const authHeader = request.headers.get('authorization');
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      await prisma.session.updateMany({
        where: { tokenHash },
        data: { revokedAt: new Date() },
      });

      // Audit log
      if (user) {
        await prisma.auditEvent.create({
          data: {
            actorUserId: user.id,
            actorType: 'USER',
            action: 'LOGOUT',
            entityType: 'SESSION',
            result: 'SUCCESS',
          },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'An error occurred' },
      },
      { status: 500 }
    );
  }
}
