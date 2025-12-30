import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@lumi/db';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fp from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      email: string;
      role: string;
    };
  }
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const authPluginImpl: FastifyPluginAsync = async (fastify) => {
  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const err: any = new Error('Missing or invalid authorization header');
      err.statusCode = 401;
      err.code = 'UNAUTHORIZED';
      throw err;
    }

    const token = authHeader.substring(7);
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const session = await prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      const err: any = new Error('Invalid or expired session');
      err.statusCode = 401;
      err.code = 'UNAUTHORIZED';
      throw err;
    }

    if (session.user.disabledAt) {
      const err: any = new Error('User account is disabled');
      err.statusCode = 401;
      err.code = 'UNAUTHORIZED';
      throw err;
    }

    request.user = {
      id: session.user.id,
      email: session.user.email,
      role: session.user.role,
    };
  });

  fastify.decorate('requireAdmin', async (request: FastifyRequest, reply: FastifyReply) => {
    await fastify.authenticate(request, reply);
    if (request.user?.role !== 'ADMIN') {
      const err: any = new Error('Admin access required');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }
  });
};

export const authPlugin = fp(authPluginImpl, {
  name: 'auth-plugin',
});

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 10);
};

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const generateSessionToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

