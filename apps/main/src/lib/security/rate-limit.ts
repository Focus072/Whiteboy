/**
 * Rate Limiting Utility
 * 
 * Provides rate limiting for API endpoints to prevent brute force attacks
 * and abuse. Uses in-memory storage for simplicity (can be upgraded to Redis
 * for distributed systems).
 * 
 * For production with multiple serverless instances, consider using Redis:
 * - Install: `pnpm add ioredis`
 * - Set REDIS_URL environment variable
 * - The code will automatically use Redis if available
 */

interface RateLimitConfig {
  points: number; // Number of requests
  duration: number; // Time window in seconds
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
}

// In-memory store for rate limiting
// Key: identifier (IP, email, etc.)
// Value: { count: number, resetTime: number }
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Redis client (optional, for distributed systems)
let redisClient: any = null;

// Initialize Redis if available
async function initRedis() {
  if (redisClient) return redisClient;
  
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return null;
  }
  
  try {
    // Dynamic import to avoid requiring Redis in all environments
    // Use eval to avoid TypeScript checking the import at compile time
    const redisModule = await eval('import("ioredis")').catch(() => null);
    if (!redisModule) {
      return null;
    }
    const Redis = (redisModule as any).default || redisModule;
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });
    
    redisClient.on('error', (err: Error) => {
      console.error('Redis rate limit error:', err);
      // Fall back to in-memory on Redis errors
      redisClient = null;
    });
    
    return redisClient;
  } catch (error) {
    console.warn('Redis not available, using in-memory rate limiting:', error);
    return null;
  }
}

/**
 * Check rate limit using Redis (if available) or in-memory store
 */
async function checkRateLimitRedis(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult | null> {
  const redis = await initRedis();
  if (!redis) {
    return null; // Fall back to in-memory
  }
  
  try {
    const key = `rate_limit:${identifier}`;
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - config.duration;
    
    // Use Redis sorted set for sliding window
    const pipeline = redis.pipeline();
    pipeline.zremrangebyscore(key, 0, windowStart);
    pipeline.zcard(key);
    pipeline.zadd(key, now, `${now}-${Math.random()}`);
    pipeline.expire(key, config.duration);
    
    const results = await pipeline.exec();
    if (!results) {
      return null;
    }
    
    const count = results[1]?.[1] as number || 0;
    const allowed = count < config.points;
    
    if (allowed) {
      // Increment count
      const newCount = count + 1;
      return {
        allowed: true,
        remaining: config.points - newCount,
        resetTime: now + config.duration,
      };
    }
    
    // Get TTL for reset time
    const ttl = await redis.ttl(key);
    return {
      allowed: false,
      remaining: 0,
      resetTime: now + (ttl > 0 ? ttl : config.duration),
    };
  } catch (error) {
    console.error('Redis rate limit error:', error);
    return null; // Fall back to in-memory
  }
}

// Clean up expired entries every 5 minutes (in-memory only)
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Check if a request should be rate limited
 * 
 * Uses Redis if available, otherwise falls back to in-memory storage
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  // Try Redis first (for distributed systems)
  const redisResult = await checkRateLimitRedis(identifier, config);
  if (redisResult) {
    return redisResult;
  }
  
  // Fall back to in-memory storage
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  if (!entry || entry.resetTime < now) {
    // Create new entry or reset expired entry
    const resetTime = now + config.duration * 1000;
    rateLimitStore.set(identifier, { count: 1, resetTime });
    return {
      allowed: true,
      remaining: config.points - 1,
      resetTime: Math.floor(resetTime / 1000),
    };
  }

  if (entry.count >= config.points) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: Math.floor(entry.resetTime / 1000),
    };
  }

  // Increment count
  entry.count++;
  return {
    allowed: true,
    remaining: config.points - entry.count,
    resetTime: Math.floor(entry.resetTime / 1000),
  };
}

/**
 * Synchronous version for backwards compatibility
 * Note: This only uses in-memory storage
 */
export function checkRateLimitSync(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  if (!entry || entry.resetTime < now) {
    const resetTime = now + config.duration * 1000;
    rateLimitStore.set(identifier, { count: 1, resetTime });
    return {
      allowed: true,
      remaining: config.points - 1,
      resetTime: Math.floor(resetTime / 1000),
    };
  }

  if (entry.count >= config.points) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: Math.floor(entry.resetTime / 1000),
    };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: config.points - entry.count,
    resetTime: Math.floor(entry.resetTime / 1000),
  };
}

/**
 * Get client identifier from request (IP address)
 */
export function getClientIdentifier(request: any): string {
  try {
    // Handle different header formats
    const getHeader = (name: string): string | null => {
      if (!request?.headers) return null;
      
      if (typeof request.headers.get === 'function') {
        return request.headers.get(name);
      }
      
      const lowerName = name.toLowerCase();
      if (request.headers[lowerName]) {
        return request.headers[lowerName];
      }
      
      return null;
    };
    
    // Try to get real IP from headers (Vercel, Cloudflare, etc.)
    const forwarded = getHeader('x-forwarded-for');
    const realIp = getHeader('x-real-ip');
    const cfConnectingIp = getHeader('cf-connecting-ip');
    
    const ip = cfConnectingIp || realIp || (forwarded ? forwarded.split(',')[0].trim() : null) || 'unknown';
    return ip;
  } catch (error) {
    // If we can't get IP, return a default identifier
    return 'unknown';
  }
}

/**
 * Rate limit configurations for different endpoints
 */
export const RATE_LIMITS = {
  // Auth endpoints - strict limits to prevent brute force
  AUTH_LOGIN: { points: 5, duration: 900 }, // 5 attempts per 15 minutes
  AUTH_SIGNUP: { points: 3, duration: 3600 }, // 3 attempts per hour
  AUTH_PASSWORD_RESET: { points: 3, duration: 3600 }, // 3 attempts per hour
  
  // General API endpoints
  API_GENERAL: { points: 100, duration: 60 }, // 100 requests per minute
} as const;
