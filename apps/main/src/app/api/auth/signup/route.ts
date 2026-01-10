/**
 * Signup endpoint
 * POST /api/auth/signup
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma, ActorType } from '@lumi/db';
import { hashPassword, generateSessionToken } from '@/lib/api-auth';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/security/rate-limit';
import { validateCsrfToken, getCsrfIdentifier } from '@/lib/security/csrf';
import { sanitizeEmail, sanitizeString } from '@/lib/security/sanitize';
import { formatApiError } from '@/lib/utils/error-messages';
import { logError } from '@/lib/services/monitoring';
import { sendEmail, generateEmailVerificationEmail } from '@/lib/services/email';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  csrfToken: z.string().optional(), // CSRF token is optional for now (can be made required)
});

export async function POST(request: NextRequest) {
  try {
    // Rate limiting check
    const clientId = getClientIdentifier(request);
    const rateLimitResult = checkRateLimit(`signup:${clientId}`, RATE_LIMITS.AUTH_SIGNUP);
    
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many signup attempts. Please try again later.',
          },
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimitResult.resetTime - Math.floor(Date.now() / 1000)),
            'X-RateLimit-Limit': String(RATE_LIMITS.AUTH_SIGNUP.points),
            'X-RateLimit-Remaining': String(rateLimitResult.remaining),
            'X-RateLimit-Reset': String(rateLimitResult.resetTime),
          },
        }
      );
    }

    const body = await request.json();
    const parsed = signupSchema.parse(body);
    
    // Sanitize email (password should not be sanitized)
    const email = sanitizeEmail(parsed.email);
    const password = parsed.password; // Don't sanitize passwords
    
    // Validate CSRF token if provided (non-blocking for now due to serverless limitations)
    if (parsed.csrfToken) {
      const csrfId = getCsrfIdentifier(request);
      const isValid = validateCsrfToken(csrfId, parsed.csrfToken);
      
      if (!isValid) {
        // Log warning but don't block (CSRF protection is in development)
        // In-memory stores don't persist across serverless invocations
        if (process.env.NODE_ENV === 'development') {
          console.warn('CSRF token validation failed:', {
            identifier: csrfId,
            tokenLength: parsed.csrfToken.length,
            cookiePresent: !!request.cookies.get('csrf-session-id'),
          });
        }
        // For now, allow the request to proceed (will be enforced with Redis in production)
        // TODO: Implement Redis-based CSRF token storage for production
      }
    }

    // Check if email already exists
    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      const error = formatApiError('EMAIL_EXISTS');
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.userMessage,
          },
        },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date();
    verificationExpires.setDate(verificationExpires.getDate() + 7); // 7 days expiry

    // Create customer user (email not verified yet)
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: 'CUSTOMER',
        emailVerified: false,
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires,
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
        metadata: { component: 'auth-api', endpoint: 'POST /api/auth/signup', userId: user.id },
      });
      // Continue even if email fails - user can request resend
    }

    // Audit log
    await prisma.auditEvent.create({
      data: {
        actorUserId: user.id,
        actorType: ActorType.USER,
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
          emailVerified: false,
        },
        message: 'Account created successfully. Please check your email to verify your account.',
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
      metadata: { component: 'auth-api', endpoint: 'POST /api/auth/signup' },
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
