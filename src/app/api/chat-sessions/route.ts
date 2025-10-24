import { NextRequest, NextResponse } from 'next/server';
import { chatService } from '../../../db/services/chat-service';
import {
  validateRequestBody,
  validateQueryParams,
  createChatSessionSchema,
  updateChatSessionSchema,
  paginationSchema,
  sessionFiltersSchema,
  searchSchema,
  chatHistorySearchSchema,
  NotFoundError,
  ConflictError,
} from '../../../lib/validation';
import { withMiddleware } from '../../../lib/middleware';

// GET /api/chat-sessions - List sessions with filtering and pagination
export const GET = withMiddleware(
  async (request: NextRequest) => {
    const { searchParams } = new URL(request.url);
    const searchQuery = searchParams.get('q');

    if (searchQuery) {
      // Legacy search functionality
      const searchParams = validateQueryParams(
        searchSchema,
        Object.fromEntries(new URL(request.url).searchParams)
      );
      const result = await chatService.searchSessions(searchParams.q, {
        page: searchParams.page,
        limit: searchParams.limit,
        sortBy: searchParams.sortBy,
        sortOrder: searchParams.sortOrder,
      });

      return NextResponse.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    }

    // Enhanced filtering and pagination for Chat History
    const allParams = Object.fromEntries(searchParams);
    const filters = validateQueryParams(sessionFiltersSchema, allParams);
    const pagination = validateQueryParams(paginationSchema, allParams);

    // Parse status filter if it's a comma-separated string
    const processedFilters = {
      ...filters,
      status: filters.status ? filters.status.split(',') : undefined,
    };

    const result = await chatService.getSessions(processedFilters, pagination);

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

// POST /api/chat-sessions - Create new session
export const POST = withMiddleware(
  async (request: NextRequest) => {
    const body = await request.json();
    const sessionData = validateRequestBody(createChatSessionSchema, body);

    // Check if session with same ID already exists
    const existingSession = await chatService.getSessionById(sessionData.id);
    if (existingSession) {
      throw new ConflictError(
        `Session with ID ${sessionData.id} already exists`
      );
    }

    const newSession = await chatService.createSession(sessionData);

    return NextResponse.json(
      {
        success: true,
        data: newSession,
      },
      { status: 201 }
    );
  },
  {
    rateLimit: { maxRequests: 50 }, // Lower limit for write operations
  }
);

// PUT /api/chat-sessions - Update existing session
export const PUT = withMiddleware(
  async (request: NextRequest) => {
    const body = await request.json();
    const updateData = validateRequestBody(updateChatSessionSchema, body);

    const { sessionId, ...fieldsToUpdate } = updateData;

    const updatedSession = await chatService.updateSession(
      sessionId,
      fieldsToUpdate
    );

    if (!updatedSession) {
      throw new NotFoundError(`Session with ID ${sessionId} not found`);
    }

    return NextResponse.json({
      success: true,
      data: updatedSession,
    });
  },
  {
    rateLimit: { maxRequests: 100 },
  }
);
