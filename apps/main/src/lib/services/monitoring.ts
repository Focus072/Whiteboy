/**
 * Monitoring and Error Tracking Service
 * 
 * Provides basic error tracking and monitoring capabilities.
 * Can be extended to integrate with Sentry, DataDog, or other monitoring services.
 * 
 * Environment variables:
 * - MONITORING_ENABLED=true (default: true in production)
 * - SENTRY_DSN=your_sentry_dsn (optional, for Sentry integration)
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
export function logError(error: Error | unknown, context?: ErrorContext): void {
  const isEnabled = process.env.MONITORING_ENABLED !== 'false';
  if (!isEnabled) return;

  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  // Basic console logging (can be extended to send to external service)
  console.error('Error logged:', {
    message: errorMessage,
    stack: errorStack,
    context,
    timestamp: new Date().toISOString(),
  });

  // TODO: Integrate with Sentry if DSN is provided
  const sentryDsn = process.env.SENTRY_DSN;
  if (sentryDsn) {
    // Sentry integration would go here
    // Example: Sentry.captureException(error, { extra: context });
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

