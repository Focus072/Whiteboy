/**
 * Signup endpoint
 * POST /api/auth/signup
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@lumi/db';
import { hashPassword, generateSessionToken } from '@/lib/api-auth';
import crypto from 'crypto';

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = signupSchema.parse(body);

    // Check if email already exists
    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'EMAIL_EXISTS', message: 'User with this email already exists' },
        },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);

    // Create customer user
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: 'CUSTOMER',
      },
    });

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
        action: 'SIGNUP',
        entityType: 'USER',
        entityId: user.id,
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
    console.error('Signup error:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'An error occurred' },
      },
      { status: 500 }
    );
  }
}
