import { NextRequest, NextResponse } from 'next/server';
import { ValidationError, NotFoundError, ConflictError, RateLimitError } from './validation';

// Rate limiting store (in production, use Redis or similar)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Rate limiting configuration
interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (request: NextRequest) => string;
  skipSuccessfulRequests?: boolean;
}

// Default rate limit configuration
const defaultRateLimitConfig: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // 100 requests per window
  skipSuccessfulRequests: false
};

// Rate limiting middleware
export function rateLimit(config: Partial<RateLimitConfig> = {}) {
  const finalConfig = { ...defaultRateLimitConfig, ...config };
  
  return (request: NextRequest): NextResponse | null => {
    const key = finalConfig.keyGenerator 
      ? finalConfig.keyGenerator(request)
      : getClientIP(request);
    
    const now = Date.now();
    
    // Clean up old entries
    for (const [k, v] of rateLimitStore.entries()) {
      if (v.resetTime < now) {
        rateLimitStore.delete(k);
      }
    }
    
    const current = rateLimitStore.get(key);
    
    if (!current || current.resetTime < now) {
      // New window
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + finalConfig.windowMs
      });
      return null; // Allow request
    }
    
    if (current.count >= finalConfig.maxRequests) {
      // Rate limit exceeded
      const resetTime = Math.ceil((current.resetTime - now) / 1000);
      
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: `Too many requests. Try again in ${resetTime} seconds.`,
          retryAfter: resetTime
        },
        {
          status: 429,
          headers: {
            'Retry-After': resetTime.toString(),
            'X-RateLimit-Limit': finalConfig.maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': current.resetTime.toString()
          }
        }
      );
    }
    
    // Increment counter
    current.count++;
    rateLimitStore.set(key, current);
    
    return null; // Allow request
  };
}

// Get client IP address
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (realIP) {
    return realIP;
  }
  
  return 'unknown';
}

// CORS middleware
export function corsMiddleware(request: NextRequest): NextResponse | null {
  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS || '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Max-Age': '86400'
      }
    });
  }
  
  return null; // Continue with request
}

// Security headers middleware
export function securityHeaders(): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
  };
}

// Error handling wrapper
export function withErrorHandling<T extends unknown[]>(
  handler: (...args: T) => Promise<NextResponse>
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      const response = await handler(...args);
      
      // Add security headers to successful responses
      const headers = securityHeaders();
      Object.entries(headers).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      
      return response;
    } catch (error) {
      console.error('API Error:', error);
      
      if (error instanceof ValidationError) {
        return NextResponse.json(
          {
            error: 'Validation Error',
            message: error.message,
            type: 'validation'
          },
          { status: 400, headers: securityHeaders() }
        );
      }
      
      if (error instanceof NotFoundError) {
        return NextResponse.json(
          {
            error: 'Not Found',
            message: error.message,
            type: 'not_found'
          },
          { status: 404, headers: securityHeaders() }
        );
      }
      
      if (error instanceof ConflictError) {
        return NextResponse.json(
          {
            error: 'Conflict',
            message: error.message,
            type: 'conflict'
          },
          { status: 409, headers: securityHeaders() }
        );
      }
      
      if (error instanceof RateLimitError) {
        return NextResponse.json(
          {
            error: 'Rate Limit Exceeded',
            message: error.message,
            type: 'rate_limit'
          },
          { status: 429, headers: securityHeaders() }
        );
      }
      
      // Generic server error
      return NextResponse.json(
        {
          error: 'Internal Server Error',
          message: process.env.NODE_ENV === 'development' 
            ? error instanceof Error ? error.message : 'Unknown error'
            : 'An unexpected error occurred',
          type: 'server_error'
        },
        { status: 500, headers: securityHeaders() }
      );
    }
  };
}

// Request logging middleware
export function logRequest(request: NextRequest): void {
  const timestamp = new Date().toISOString();
  const method = request.method;
  const url = request.url;
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const ip = getClientIP(request);
  
  console.log(`[${timestamp}] ${method} ${url} - IP: ${ip} - UA: ${userAgent}`);
}

// Combine multiple middlewares
export function withMiddleware(
  handler: (request: NextRequest) => Promise<NextResponse>,
  options: {
    rateLimit?: Partial<RateLimitConfig>;
    enableCors?: boolean;
    enableLogging?: boolean;
  } = {}
) {
  return withErrorHandling(async (request: NextRequest): Promise<NextResponse> => {
    // Logging
    if (options.enableLogging !== false) {
      logRequest(request);
    }
    
    // CORS handling
    if (options.enableCors !== false) {
      const corsResponse = corsMiddleware(request);
      if (corsResponse) {
        return corsResponse;
      }
    }
    
    // Rate limiting
    if (options.rateLimit !== undefined) {
      const rateLimitResponse = rateLimit(options.rateLimit || {})(request);
      if (rateLimitResponse) {
        return rateLimitResponse;
      }
    }
    
    // Execute main handler
    return handler(request);
  });
}

// Health check utility
export async function healthCheck(): Promise<{
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  services: Record<string, boolean>;
}> {
  const timestamp = new Date().toISOString();
  const services: Record<string, boolean> = {};
  
  // Check database connection
  try {
    const { mongoManager } = await import('../db/mongodb-enhanced');
    services.database = await mongoManager.healthCheck();
  } catch {
    services.database = false;
  }
  
  // Check memory usage
  const memUsage = process.memoryUsage();
  services.memory = memUsage.heapUsed < memUsage.heapTotal * 0.9; // Less than 90% usage
  
  const allHealthy = Object.values(services).every(Boolean);
  
  return {
    status: allHealthy ? 'healthy' : 'unhealthy',
    timestamp,
    services
  };
}