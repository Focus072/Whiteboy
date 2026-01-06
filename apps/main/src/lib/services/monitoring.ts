/**
 * Monitoring and Error Tracking Service
 * 
 * Provides error tracking and monitoring capabilities with Sentry integration.
 * 
 * Environment variables:
 * - MONITORING_ENABLED=true (default: true in production)
 * - SENTRY_DSN=your_sentry_dsn (required for Sentry integration)
 * - NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn (required for client-side Sentry)
 */

export interface ErrorContext {
  userId?: string;
  orderId?: string;
  requestId?: string;
  metadata?: Record<string, any>;
}

/**
 * Log error with context
 */
export async function logError(error: Error | unknown, context?: ErrorContext): Promise<void> {
  const isEnabled = process.env.MONITORING_ENABLED !== 'false';
  if (!isEnabled) return;

  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  // Basic console logging
  console.error('Error logged:', {
    message: errorMessage,
    stack: errorStack,
    context,
    timestamp: new Date().toISOString(),
  });

  // Send to Sentry if available (server-side)
  try {
    if (typeof window === 'undefined') {
      // Server-side: use dynamic import to avoid bundling issues
      const Sentry = await import('@sentry/nextjs');
      Sentry.captureException(error, {
        extra: context ? {
          userId: context.userId,
          orderId: context.orderId,
          requestId: context.requestId,
          ...context.metadata,
        } : undefined,
        tags: {
          component: context?.metadata?.component || 'unknown',
        },
      });
    } else {
      // Client-side: Sentry is already initialized
      if ((window as any).Sentry) {
        (window as any).Sentry.captureException(error, {
          extra: context ? {
            userId: context.userId,
            orderId: context.orderId,
            requestId: context.requestId,
            ...context.metadata,
          } : undefined,
          tags: {
            component: context?.metadata?.component || 'unknown',
          },
        });
      }
    }
  } catch (sentryError) {
    // Sentry not available or failed to initialize
    console.warn('Failed to send error to Sentry:', sentryError);
  }
}

/**
 * Track custom event
 */
export function trackEvent(eventName: string, properties?: Record<string, any>): void {
  const isEnabled = process.env.MONITORING_ENABLED !== 'false';
  if (!isEnabled) return;

  // Basic logging (can be extended to send to analytics service)
  console.log('Event tracked:', {
    event: eventName,
    properties,
    timestamp: new Date().toISOString(),
  });

  // TODO: Integrate with analytics service (e.g., Mixpanel, Amplitude)
}

/**
 * Track performance metric
 */
export function trackMetric(metricName: string, value: number, tags?: Record<string, string>): void {
  const isEnabled = process.env.MONITORING_ENABLED !== 'false';
  if (!isEnabled) return;

  // Basic logging (can be extended to send to metrics service)
  console.log('Metric tracked:', {
    metric: metricName,
    value,
    tags,
    timestamp: new Date().toISOString(),
  });

  // TODO: Integrate with metrics service (e.g., DataDog, CloudWatch)
}

/**
 * Health check data for monitoring
 */
export interface HealthCheckData {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    database: 'ok' | 'error';
    r2?: 'ok' | 'error';
    veriff?: 'ok' | 'error';
    authorizenet?: 'ok' | 'error';
    shippo?: 'ok' | 'error';
  };
  timestamp: string;
}

/**
 * Perform health checks
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
    logError(error, { metadata: { check: 'database' } });
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

