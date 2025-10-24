import { NextRequest, NextResponse } from 'next/server';
import { chatService } from '../../../db/services/chat-service';
import { 
  validateRequestBody, 
  validateQueryParams,
  createChatMessageSchema,
  paginationSchema,
  messageFiltersSchema,
  NotFoundError,
  ValidationError
} from '../../../lib/validation';
import { withMiddleware } from '../../../lib/middleware';

// GET /api/chat-messages - Get messages for a session with pagination
export const GET = withMiddleware(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const filters = validateQueryParams(messageFiltersSchema, Object.fromEntries(searchParams));
  const pagination = validateQueryParams(paginationSchema, Object.fromEntries(searchParams));
  
  // Verify session exists
  const session = await chatService.getSessionById(filters.sessionId);
  if (!session) {
    throw new NotFoundError(`Session with ID ${filters.sessionId} not found`);
  }
  
  // Check if requesting recent messages (common case)
  const isRecentRequest = pagination.page === 1 && pagination.limit <= 50;
  
  if (isRecentRequest) {
    // Use optimized recent messages query
    const messages = await chatService.getRecentMessages(filters.sessionId, pagination.limit);
    return NextResponse.json({
      success: true,
      data: messages,
      pagination: {
        page: 1,
        limit: pagination.limit,
        total: messages.length,
        totalPages: 1,
        hasNext: false,
        hasPrev: false
      }
    });
  }
  
  // Use paginated query for larger datasets
  const result = await chatService.getMessages(filters.sessionId, pagination);
  
  return NextResponse.json({
    success: true,
    data: result.data,
    pagination: result.pagination
  });
}, {
  rateLimit: { maxRequests: 300 } // High limit for message fetching
});

// POST /api/chat-messages - Create new message
export const POST = withMiddleware(async (request: NextRequest) => {
  const body = await request.json();
  const messageData = validateRequestBody(createChatMessageSchema, body);
  
  // Verify session exists and is active
  const session = await chatService.getSessionById(messageData.sessionId);
  if (!session) {
    throw new NotFoundError(`Session with ID ${messageData.sessionId} not found`);
  }
  
  if (session.status === 'closed') {
    throw new ValidationError('Cannot send messages to a closed session');
  }
  
  // Validate sender permissions
  if (messageData.sender === 'agent' && !session.agentId) {
    throw new ValidationError('No agent assigned to this session');
  }
  
  const newMessage = await chatService.createMessage(messageData);
  
  return NextResponse.json({
    success: true,
    data: newMessage
  }, { status: 201 });
}, {
  rateLimit: { maxRequests: 100 } // Moderate limit for message creation
});