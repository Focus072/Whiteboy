/**
 * Test Veriff age verification production flow
 * POST /api/admin/test/veriff
 * 
 * This endpoint allows admins to test the Veriff age verification
 * integration with production credentials.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/api-auth';
import { verifyAge } from '@/lib/services/veriff';
import type { VeriffError } from '@/lib/services/veriff.types';

const veriffTestSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  address: z.object({
    line1: z.string().min(1),
    city: z.string().min(1),
    state: z.string().length(2),
    zip: z.string().min(5),
    country: z.string().default('US'),
  }).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body = await request.json();
    const data = veriffTestSchema.parse(body);

    // Test Veriff age verification
    try {
      const result = await verifyAge({
        firstName: data.firstName,
        lastName: data.lastName,
        dateOfBirth: data.dateOfBirth,
        address: data.address,
      });

      return NextResponse.json({
        success: true,
        data: {
          status: result.status,
          referenceId: result.referenceId,
          reasonCode: result.reasonCode,
          message: result.message,
          testMode: true,
        },
      });
    } catch (error) {
      const veriffError = error as VeriffError;
      return NextResponse.json(
        {
          success: false,
          error: {
            code: veriffError.code || 'VERIFF_ERROR',
            message: veriffError.message || 'Veriff verification failed',
          },
        },
        { status: 400 }
      );
    }
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
    console.error('Veriff test error:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'An error occurred' },
      },
      { status: 500 }
    );
  }
}
