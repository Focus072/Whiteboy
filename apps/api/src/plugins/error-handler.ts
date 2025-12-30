import { FastifyPluginAsync, FastifyError } from 'fastify';
import { ZodError } from 'zod';

export const errorHandler: FastifyPluginAsync = async (fastify) => {
  fastify.setErrorHandler((error: FastifyError, request, reply) => {
    const reqId = request.id;

    // Zod validation errors
    const zodIssues = (error as any)?.issues ?? (error as any)?.errors;
    const isZodError =
      error instanceof ZodError || (error as any)?.name === 'ZodError' || Array.isArray(zodIssues);

    if (isZodError) {
      fastify.log.warn({ reqId, error: zodIssues }, 'Validation error');
      return reply.code(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: zodIssues,
        },
      });
    }

    // Known application errors
    if (error.statusCode && error.statusCode < 500) {
      fastify.log.warn({ reqId, error: error.message }, 'Client error');
      return reply.code(error.statusCode).send({
        success: false,
        error: {
          code: error.code || 'CLIENT_ERROR',
          message: error.message,
        },
      });
    }

    // Unknown errors - log to monitoring service
    fastify.log.error({ reqId, error }, 'Internal server error');
    
    // Track error in monitoring service (non-blocking)
    import('../services/monitoring.js').then(({ logError }) => {
      logError(error, {
        requestId: reqId,
        userId: (request as any).user?.id,
        metadata: {
          method: request.method,
          url: request.url,
          statusCode: 500,
        },
      });
    }).catch(() => {
      // Ignore monitoring errors
    });
    
    return reply.code(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
      },
    });
  });
};

