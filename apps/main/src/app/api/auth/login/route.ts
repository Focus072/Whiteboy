/**
 * Login endpoint
 * POST /api/auth/login
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@lumi/db';
import { verifyPassword, generateSessionToken } from '@/lib/api-auth';
import crypto from 'crypto';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = loginSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
        },
        { status: 401 }
      );
    }

    if (user.disabledAt) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'ACCOUNT_DISABLED', message: 'Account is disabled' },
        },
        { status: 401 }
      );
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
        },
        { status: 401 }
      );
    }

    // Create session
    const token = generateSessionToken();
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    // Audit log
    await prisma.auditEvent.create({
      data: {
        actorUserId: user.id,
        actorType: 'USER',
        action: 'LOGIN',
        entityType: 'SESSION',
        result: 'SUCCESS',
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        token,
        expiresAt,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      },
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
    console.error('Login error:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'An error occurred' },
      },
      { status: 500 }
    );
  }
}
