/**
 * Forgot password endpoint
 * POST /api/auth/forgot-password - Request password reset
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@lumi/db';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/security/rate-limit';
import { formatApiError } from '@/lib/utils/error-messages';
import { logError } from '@/lib/services/monitoring';
import { sendEmail, generatePasswordResetEmail } from '@/lib/services/email';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request);
    const rateLimitResult = await checkRateLimit(`forgot-password:${clientId}`, RATE_LIMITS.AUTH_PASSWORD_RESET);
    
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
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimitResult.resetTime - Math.floor(Date.now() / 1000)),
          },
        }
      );
    }

    const body = await request.json();
    const data = forgotPasswordSchema.parse(body);

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    // Always return success (don't reveal if email exists)
    // But only send email if user exists
    if (user) {
      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetExpires = new Date();
      resetExpires.setHours(resetExpires.getHours() + 1); // 1 hour expiry

      // Store reset token
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: resetToken,
          passwordResetExpires: resetExpires,
        },
      });

      // Send reset email
      const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/reset-password?token=${resetToken}`;
      
      try {
        await sendEmail({
          to: user.email,
          subject: 'Reset Your Password - Lumi Pouches',
          html: generatePasswordResetEmail({
            resetUrl,
            expiresIn: '1 hour',
          }),
        });
      } catch (emailError) {
        await logError(emailError, {
          metadata: { component: 'auth-api', endpoint: 'POST /api/auth/forgot-password', userId: user.id },
        });
        // Continue even if email fails - don't reveal error to user
      }
    }

    // Always return success
    return NextResponse.json({
      success: true,
      data: {
        message: 'If an account with that email exists, a password reset link has been sent.',
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formattedError = formatApiError('VALIDATION_ERROR', error.errors[0].message);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: formattedError.code,
            message: formattedError.userMessage,
          },
        },
        { status: 400 }
      );
    }

    await logError(error, {
      metadata: { component: 'auth-api', endpoint: 'POST /api/auth/forgot-password' },
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
