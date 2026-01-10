/**
 * Server-side monitoring and error tracking
 * 
 * This is the ONLY place that imports @sentry/nextjs
 * Never import this file from client-side code
 */

import * as Sentry from '@sentry/nextjs';
import type { ErrorContext, HealthCheckData } from './monitoring.types';

/**
 * Log error with context (server-side only)
 */
export async function logErrorServer(error: unknown, context?: ErrorContext): Promise<void> {
  const isEnabled = process.env.MONITORING_ENABLED !== 'false';
  if (!isEnabled) return;

  try {
    // Only use Sentry if DSN is configured
    if (process.env.SENTRY_DSN) {
      Sentry.captureException(error, {
        extra: context
          ? {
              userId: context.userId,
              orderId: context.orderId,
              requestId: context.requestId,
              ...context.metadata,
            }
          : undefined,
        tags: { component: context?.metadata?.component || 'unknown' },
      });
    }
  } catch (sentryError) {
    // If Sentry fails, don't throw - just log to console
    console.error('Failed to send error to Sentry:', sentryError);
  }
}

/**
 * Perform health checks (server-side only)
 * 
 * Note: Does NOT call logError to avoid recursion if database is down
 */
export async function performHealthChecks(): Promise<HealthCheckData> {
  const checks: HealthCheckData['checks'] = {
    database: 'error',
  };

  // Check database
  try {
    const { prisma } = await import('@lumi/db');
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch (error) {
    checks.database = 'error';
    // Don't call logError here to avoid recursion
    console.error('Database health check failed:', error);
  }

  // Check R2 (optional)
  if (process.env.R2_ACCOUNT_ID) {
    try {
      // Simple check - verify credentials are set
      if (process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY) {
        checks.r2 = 'ok';
      } else {
        checks.r2 = 'error';
      }
    } catch (error) {
      checks.r2 = 'error';
    }
  }

  // Check Veriff (optional)
  if (process.env.VERIFF_API_KEY) {
    checks.veriff = process.env.VERIFF_SIGNATURE_KEY ? 'ok' : 'error';
  }

  // Check Authorize.Net (optional)
  if (process.env.AUTHORIZENET_API_LOGIN_ID) {
    checks.authorizenet = process.env.AUTHORIZENET_TRANSACTION_KEY ? 'ok' : 'error';
  }

  // Check Shippo (optional)
  if (process.env.SHIPPO_TOKEN) {
    checks.shippo = 'ok';
  }

  // Determine overall status
  const hasErrors = Object.values(checks).some((status) => status === 'error');
  const status = checks.database === 'error' ? 'unhealthy' : hasErrors ? 'degraded' : 'healthy';

  return {
    status,
    checks,
    timestamp: new Date().toISOString(),
  };
}
