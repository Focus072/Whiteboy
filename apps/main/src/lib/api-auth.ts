/**
 * Authentication utilities for Next.js API routes
 * Converted from Fastify auth plugin
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@lumi/db';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
}

/**
 * Authenticate request from Authorization header
 * Returns user if authenticated, null otherwise
 */
export async function authenticateRequest(
  request: NextRequest
): Promise<AuthenticatedUser | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    return null;
  }

  if (session.user.disabledAt) {
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email,
    role: session.user.role,
  };
}

/**
 * Require authentication - returns 401 if not authenticated
 */
export async function requireAuth(
  request: NextRequest
): Promise<{ user: AuthenticatedUser } | NextResponse> {
  const user = await authenticateRequest(request);
  if (!user) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
      { status: 401 }
    );
  }
  return { user };
}

/**
 * Require admin role - returns 403 if not admin
 */
export async function requireAdmin(
  request: NextRequest
): Promise<{ user: AuthenticatedUser } | NextResponse> {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  if (authResult.user.role !== 'ADMIN') {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } },
      { status: 403 }
    );
  }

  return authResult;
}

/**
 * Hash password for storage
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Verify password against hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a session token
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
