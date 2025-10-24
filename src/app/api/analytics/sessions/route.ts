import { NextRequest, NextResponse } from 'next/server';
import { chatService } from '../../../../db/services/chat-service';
import { 
  validateQueryParams,
  ValidationError
} from '../../../../lib/validation';
import { withMiddleware } from '../../../../lib/middleware';
import { z } from 'zod';

// Analytics query schema
const analyticsQuerySchema = z.object({
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  groupBy: z.enum(['day', 'week', 'month']).default('day')
});

// GET /api/analytics/sessions - Get session statistics
export const GET = withMiddleware(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const query = validateQueryParams(analyticsQuerySchema, Object.fromEntries(searchParams));
  
  // Validate date range
  if (query.dateFrom && query.dateTo) {
    const fromDate = new Date(query.dateFrom);
    const toDate = new Date(query.dateTo);
    
    if (fromDate >= toDate) {
      throw new ValidationError('dateFrom must be before dateTo');
    }
    
    // Limit to 1 year range
    const maxRange = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds
    if (toDate.getTime() - fromDate.getTime() > maxRange) {
      throw new ValidationError('Date range cannot exceed 1 year');
    }
  }
  
  const stats = await chatService.getSessionStats(query.dateFrom, query.dateTo);
  
  // Process stats for better frontend consumption
  const processedStats = {
    summary: {
      total: stats.reduce((sum, stat) => sum + stat.count, 0),
      byStatus: stats.reduce((acc, stat) => {
        acc[stat._id] = {
          count: stat.count,
          avgDuration: Math.round(stat.avgDuration || 0)
        };
        return acc;
      }, {} as Record<string, { count: number; avgDuration: number }>)
    },
    period: {
      from: query.dateFrom,
      to: query.dateTo,
      groupBy: query.groupBy
    }
  };
  
  return NextResponse.json({
    success: true,
    data: processedStats
  });
}, {
  rateLimit: { maxRequests: 50 } // Lower limit for analytics
});