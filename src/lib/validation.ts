import { z } from 'zod';

// Base validation schemas
export const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId format');
export const uuidSchema = z.string()
export const emailSchema = z.string()
export const phoneSchema = z
  .string()
  .regex(/^[\+]?[1-9][\d]{0,15}$/, 'Invalid phone format');

// Chat Session validation schemas
export const chatSessionStatusSchema = z.enum(['waiting', 'active', 'closed']);

export const createChatSessionSchema = z.object({
  id: uuidSchema,
  userId: z.string().min(1, 'User ID is required'),
  userEmail: emailSchema,
  userName: z
    .string()
    .min(1, 'User name is required')
    .max(100, 'User name too long'),
  status: chatSessionStatusSchema,
  agentId: z.string().optional(),
  agentName: z.string().max(100, 'Agent name too long').optional(),
  initialMessage: z
    .string()
    .min(1, 'Initial message is required')
    .max(1000, 'Initial message too long'),
  value: z.string().min(1, 'Value is required'),
  questionAnswerPairs: z
    .array(
      z.object({
        id: uuidSchema,
        conversationId: z.string(),
        question: z.string().max(500, 'Question too long'),
        answer: z.string().max(1000, 'Answer too long'),
        stepId: z.string(),
        createdAt: z.string().datetime(),
      })
    )
    .optional(),
});

export const updateChatSessionSchema = z
  .object({
    sessionId: uuidSchema,
    status: chatSessionStatusSchema.optional(),
    agentId: z.string().optional(),
    agentName: z.string().max(100, 'Agent name too long').optional(),
  })
  .refine(
    (data) => {
      // At least one field to update must be provided
      const { sessionId, ...updateFields } = data;
      return Object.keys(updateFields).length > 0;
    },
    {
      message: 'At least one field to update must be provided',
    }
  );

// Chat Message validation schemas
export const chatMessageSenderSchema = z.enum(['user', 'agent']);

export const createChatMessageSchema = z.object({
  id: uuidSchema,
  sessionId: uuidSchema,
  sender: chatMessageSenderSchema,
  message: z
    .string()
    .min(1, 'Message is required')
    .max(2000, 'Message too long'),
});

// Query parameter validation schemas
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const sessionFiltersSchema = z.object({
  status: z.string().optional(),
  agentId: z.string().optional(),
  userEmail: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  searchTerm: z.string().optional(),
  minDuration: z.coerce.number().int().min(0).optional(),
  maxDuration: z.coerce.number().int().min(0).optional(),
  minMessageCount: z.coerce.number().int().min(0).optional(),
  maxMessageCount: z.coerce.number().int().min(0).optional(),
});

export const messageFiltersSchema = z.object({
  sessionId: uuidSchema,
});

// Search validation
export const searchSchema = z.object({
  q: z
    .string()
    .min(1, 'Search query is required')
    .max(100, 'Search query too long'),
  ...paginationSchema.shape,
});

// Enhanced search validation for Chat History
export const chatHistorySearchSchema = z.object({
  ...sessionFiltersSchema.shape,
  ...paginationSchema.shape,
});

// Rate limiting schemas
export const rateLimitSchema = z.object({
  windowMs: z.number().default(15 * 60 * 1000), // 15 minutes
  maxRequests: z.number().default(100), // 100 requests per window
  skipSuccessfulRequests: z.boolean().default(false),
});

// Validation helper functions
export function validateRequestBody<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): T {
  try {
    return schema.parse(data);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.issues
        .map((err) => `${err.path.join('.')}: ${err.message}`)
        .join(', ');
      throw new ValidationError(`Validation failed: ${errorMessage}`);
    }
    throw error;
  }
}

export function validateQueryParams<T>(
  schema: z.ZodSchema<T>,
  params: Record<string, string | string[] | undefined>
): T {
  try {
    return schema.parse(params);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.issues
        .map((err) => `${err.path.join('.')}: ${err.message}`)
        .join(', ');
      throw new ValidationError(`Query validation failed: ${errorMessage}`);
    }
    throw error;
  }
}

// Custom error classes
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}
