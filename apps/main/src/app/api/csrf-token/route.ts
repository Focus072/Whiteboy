/**
 * CSRF Token endpoint
 * GET /api/csrf-token - Get a CSRF token for the current session
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateCsrfToken, setCsrfCookie } from '@/lib/security/csrf';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const token = generateCsrfToken();
    const response = NextResponse.json({
      success: true,
      data: {
        token,
        headerName: 'X-CSRF-Token',
      },
    });
    
    // Set token in cookie
    setCsrfCookie(response, token);
    
    return response;
  } catch (error) {
    console.error('CSRF token generation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to generate CSRF token',
        },
      },
      { status: 500 }
    );
  }
}
