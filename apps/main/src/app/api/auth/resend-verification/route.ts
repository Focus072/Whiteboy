/**
 * Resend email verification endpoint
 * POST /api/auth/resend-verification - Resend verification email
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@lumi/db';
import { requireAuth } from '@/lib/api-auth';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/security/rate-limit';
import { formatApiError } from '@/lib/utils/error-messages';
import { logError } from '@/lib/services/monitoring';
import { sendEmail, generateEmailVerificationEmail } from '@/lib/services/email';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;

    // Rate limiting
    const clientId = getClientIdentifier(request);
    const rateLimitResult = await checkRateLimit(`resend-verification:${clientId}`, {
      points: 3,
      duration: 3600, // 3 per hour
    });
    
    if (!rateLimitResult.allowed) {
      const error = formatApiError('RATE_LIMIT_EXCEEDED');
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.userMessage,
          },
        },
        { status: 429 }
      );
    }

    // Check if already verified
    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: { emailVerified: true },
    });

    if (userData?.emailVerified) {
      return NextResponse.json({
        success: true,
        data: {
          message: 'Email is already verified.',
        },
      });
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date();
    verificationExpires.setDate(verificationExpires.getDate() + 7); // 7 days expiry

    // Store verification token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires,
      },
    });

    // Send verification email
    const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/verify-email?token=${verificationToken}`;
    
    try {
      await sendEmail({
        to: user.email,
        subject: 'Verify Your Email - Lumi Pouches',
        html: generateEmailVerificationEmail({
          verificationUrl,
          expiresIn: '7 days',
        }),
      });
    } catch (emailError) {
      await logError(emailError, {
        metadata: { component: 'auth-api', endpoint: 'POST /api/auth/resend-verification', userId: user.id },
      });
      const error = formatApiError('EMAIL_SEND_FAILED', 'Failed to send verification email');
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.userMessage,
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        message: 'Verification email sent. Please check your inbox.',
      },
    });
  } catch (error) {
    await logError(error, {
      metadata: { component: 'auth-api', endpoint: 'POST /api/auth/resend-verification' },
    });

    const formattedError = formatApiError('INTERNAL_ERROR');
    return NextResponse.json(
      {
        success: false,
        error: {
          code: formattedError.code,
          message: formattedError.userMessage,
        },
      },
      { status: 500 }
    );
  }
}
