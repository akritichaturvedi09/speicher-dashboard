import { NextRequest, NextResponse } from 'next/server';
import { chatService } from '../../../../db/services/chat-service';
import {
  validateQueryParams,
  chatHistorySearchSchema,
} from '../../../../lib/validation';
import { withMiddleware } from '../../../../lib/middleware';

// GET /api/chat-sessions/search - Enhanced search for Chat History
export const GET = withMiddleware(
  async (request: NextRequest) => {
    const { searchParams } = new URL(request.url);
    const allParams = Object.fromEntries(searchParams);
    
    // Validate all search parameters
    const searchOptions = validateQueryParams(chatHistorySearchSchema, allParams);

    // Parse status filter if it's a comma-separated string
    const processedFilters = {
      ...searchOptions,
      status: searchOptions.status ? searchOptions.status.split(',') : undefined,
    };

    // Extract pagination options
    const { page, limit, sortBy, sortOrder, ...filters } = processedFilters;
    const paginationOptions = { page, limit, sortBy, sortOrder };

    // Use enhanced getSessions method with all filters
    const result = await chatService.getSessions(filters, paginationOptions);

    return NextResponse.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  },
  {
    rateLimit: { maxRequests: 200 }, // Higher limit for read operations
  }
);