import { Collection } from 'mongodb';
import { mongoManager } from '../mongodb-enhanced';
import type { ChatSession, ChatMessage } from '@/types/types';
export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface SessionFilters {
  status?: string | string[];
  agentId?: string;
  userEmail?: string;
  dateFrom?: string;
  dateTo?: string;
  searchTerm?: string;
  minDuration?: number;
  maxDuration?: number;
  minMessageCount?: number;
  maxMessageCount?: number;
}

export class ChatService {
  private async getSessionsCollection(): Promise<Collection<ChatSession>> {
    return mongoManager.getCollection<ChatSession>('chatSessions');
  }

  private async getMessagesCollection(): Promise<Collection<ChatMessage>> {
    return mongoManager.getCollection<ChatMessage>('chatMessages');
  }

  // Enhanced session retrieval with filtering and pagination
  public async getSessions(
    filters: SessionFilters = {},
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<ChatSession>> {
    return mongoManager.withRetry(async () => {
      const collection = await this.getSessionsCollection();

      // Build filter query
      const query: any = {};

      if (filters.status) {
        if (Array.isArray(filters.status)) {
          query.status = { $in: filters.status };
        } else {
          query.status = filters.status;
        }
      }

      if (filters.agentId) {
        query.agentId = filters.agentId;
      }

      if (filters.userEmail) {
        query.userEmail = { $regex: filters.userEmail, $options: 'i' };
      }

      if (filters.dateFrom || filters.dateTo) {
        query.createdAt = {};
        if (filters.dateFrom) {
          query.createdAt.$gte = filters.dateFrom;
        }
        if (filters.dateTo) {
          query.createdAt.$lte = filters.dateTo;
        }
      }

      // Search term filter
      if (filters.searchTerm) {
        query.$or = [
          { userName: { $regex: filters.searchTerm, $options: 'i' } },
          { userEmail: { $regex: filters.searchTerm, $options: 'i' } },
          { agentName: { $regex: filters.searchTerm, $options: 'i' } },
          { initialMessage: { $regex: filters.searchTerm, $options: 'i' } },
        ];
      }

      // Pagination setup
      const page = Math.max(1, options.page || 1);
      const limit = Math.min(100, Math.max(1, options.limit || 20)); // Max 100 items per page
      const skip = (page - 1) * limit;

      // Sort setup
      const sortBy = options.sortBy || 'updatedAt';
      const sortOrder = options.sortOrder === 'asc' ? 1 : -1;
      const sort = { [sortBy]: sortOrder } as const;

      // Duration filters (requires aggregation pipeline for computed fields)
      const needsAggregation = filters.minDuration || filters.maxDuration || filters.minMessageCount || filters.maxMessageCount;

      if (needsAggregation) {
        // Use aggregation pipeline for complex filtering
        const pipeline: any[] = [
          { $match: query },
          {
            $lookup: {
              from: 'chatMessages',
              localField: 'id',
              foreignField: 'sessionId',
              as: 'messages'
            }
          },
          {
            $addFields: {
              messageCount: { $size: '$messages' },
              duration: {
                $cond: {
                  if: { $and: [{ $ne: ['$createdAt', null] }, { $ne: ['$updatedAt', null] }] },
                  then: {
                    $subtract: [
                      { $dateFromString: { dateString: '$updatedAt' } },
                      { $dateFromString: { dateString: '$createdAt' } }
                    ]
                  },
                  else: null
                }
              }
            }
          }
        ];

        // Add duration filters
        const durationMatch: any = {};
        if (filters.minDuration) {
          durationMatch.duration = { $gte: filters.minDuration };
        }
        if (filters.maxDuration) {
          if (durationMatch.duration) {
            durationMatch.duration.$lte = filters.maxDuration;
          } else {
            durationMatch.duration = { $lte: filters.maxDuration };
          }
        }

        // Add message count filters
        if (filters.minMessageCount) {
          durationMatch.messageCount = { $gte: filters.minMessageCount };
        }
        if (filters.maxMessageCount) {
          if (durationMatch.messageCount) {
            durationMatch.messageCount.$lte = filters.maxMessageCount;
          } else {
            durationMatch.messageCount = { $lte: filters.maxMessageCount };
          }
        }

        if (Object.keys(durationMatch).length > 0) {
          pipeline.push({ $match: durationMatch });
        }

        // Add sorting
        pipeline.push({ $sort: { [sortBy]: sortOrder } });

        // Add pagination
        pipeline.push({ $skip: skip }, { $limit: limit });

        // Remove messages array from final result to reduce payload size
        pipeline.push({
          $project: {
            messages: 0
          }
        });

        // Execute aggregation
        const [data, totalResult] = await Promise.all([
          collection.aggregate(pipeline).toArray(),
          collection.aggregate([
            { $match: query },
            {
              $lookup: {
                from: 'chatMessages',
                localField: 'id',
                foreignField: 'sessionId',
                as: 'messages'
              }
            },
            {
              $addFields: {
                messageCount: { $size: '$messages' },
                duration: {
                  $cond: {
                    if: { $and: [{ $ne: ['$createdAt', null] }, { $ne: ['$updatedAt', null] }] },
                    then: {
                      $subtract: [
                        { $dateFromString: { dateString: '$updatedAt' } },
                        { $dateFromString: { dateString: '$createdAt' } }
                      ]
                    },
                    else: null
                  }
                }
              }
            },
            ...(Object.keys(durationMatch).length > 0 ? [{ $match: durationMatch }] : []),
            { $count: 'total' }
          ]).toArray()
        ]);

        const total = totalResult[0]?.total || 0;
        const totalPages = Math.ceil(total / limit);

        return {
          data: data as ChatSession[],
          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
          },
        };
      }

      // Execute queries in parallel for simple filtering
      const [data, total] = await Promise.all([
        collection.find(query).sort(sort).skip(skip).limit(limit).toArray(),
        collection.countDocuments(query),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };


    });
  }

  // Get session by ID with error handling
  public async getSessionById(sessionId: string): Promise<ChatSession | null> {
    return mongoManager.withRetry(async () => {
      const collection = await this.getSessionsCollection();
      return collection.findOne({ id: sessionId });
    });
  }

  // Create session with validation
  public async createSession(
    sessionData: Omit<ChatSession, '_id' | 'createdAt' | 'updatedAt'>
  ): Promise<ChatSession> {
    return mongoManager.withRetry(async () => {
      const collection = await this.getSessionsCollection();

      const now = new Date().toISOString();
      const session = {
        ...sessionData,
        createdAt: now,
        updatedAt: now,
      };

      const result = await collection.insertOne(session);

      return {
        _id: result.insertedId.toString(),
        ...session,
      } as ChatSession;
    });
  }

  // Update session with optimistic locking
  public async updateSession(
    sessionId: string,
    updateData: Partial<ChatSession>
  ): Promise<ChatSession | null> {
    return mongoManager.withRetry(async () => {
      const collection = await this.getSessionsCollection();

      const result = await collection.findOneAndUpdate(
        { id: sessionId },
        {
          $set: {
            ...updateData,
            updatedAt: new Date().toISOString(),
          },
        },
        { returnDocument: 'after' }
      );

      return result || null;
    });
  }

  // Get messages with efficient pagination
  public async getMessages(
    sessionId: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<ChatMessage>> {
    return mongoManager.withRetry(async () => {
      const collection = await this.getMessagesCollection();

      const query = { sessionId };

      // Pagination setup
      const page = Math.max(1, options.page || 1);
      const limit = Math.min(100, Math.max(1, options.limit || 50));
      const skip = (page - 1) * limit;

      // Sort by creation time (oldest first for chat messages)
      const sort = { createdAt: 1 } as const;

      // Execute queries in parallel
      const [data, total] = await Promise.all([
        collection.find(query).sort(sort).skip(skip).limit(limit).toArray(),
        collection.countDocuments(query),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    });
  }

  // Get recent messages (most common use case)
  public async getRecentMessages(
    sessionId: string,
    limit: number = 50
  ): Promise<ChatMessage[]> {
    return mongoManager.withRetry(async () => {
      const collection = await this.getMessagesCollection();

      return collection
        .find({ sessionId })
        .sort({ createdAt: 1 })
        .limit(Math.min(100, limit))
        .toArray();
    });
  }

  // Create message with validation
  public async createMessage(
    messageData: Omit<ChatMessage, '_id' | 'createdAt'>
  ): Promise<ChatMessage> {
    return mongoManager.withRetry(async () => {
      const collection = await this.getMessagesCollection();

      const message = {
        ...messageData,
        createdAt: new Date().toISOString(),
      };

      const result = await collection.insertOne(message);

      return {
        _id: result.insertedId.toString(),
        ...message,
      };
    });
  }

  // Bulk operations for better performance
  public async createMessages(
    messages: Omit<ChatMessage, '_id' | 'createdAt'>[]
  ): Promise<ChatMessage[]> {
    return mongoManager.withRetry(async () => {
      const collection = await this.getMessagesCollection();

      const now = new Date().toISOString();
      const messagesWithTimestamp = messages.map((msg) => ({
        ...msg,
        createdAt: now,
      }));

      const result = await collection.insertMany(messagesWithTimestamp);

      return messagesWithTimestamp.map((msg, index) => ({
        _id: result.insertedIds[index].toString(),
        ...msg,
      }));
    });
  }

  // Search functionality
  public async searchSessions(
    searchTerm: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<ChatSession>> {
    return mongoManager.withRetry(async () => {
      const collection = await this.getSessionsCollection();

      const query = {
        $or: [
          { userName: { $regex: searchTerm, $options: 'i' } },
          { userEmail: { $regex: searchTerm, $options: 'i' } },
          { initialMessage: { $regex: searchTerm, $options: 'i' } },
        ],
      };

      const page = Math.max(1, options.page || 1);
      const limit = Math.min(100, Math.max(1, options.limit || 20));
      const skip = (page - 1) * limit;

      const [data, total] = await Promise.all([
        collection
          .find(query)
          .sort({ updatedAt: -1 })
          .skip(skip)
          .limit(limit)
          .toArray(),
        collection.countDocuments(query),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    });
  }

  // Analytics queries
  public async getSessionStats(dateFrom?: string, dateTo?: string) {
    return mongoManager.withRetry(async () => {
      const collection = await this.getSessionsCollection();

      const matchStage: any = {};
      if (dateFrom || dateTo) {
        matchStage.createdAt = {};
        if (dateFrom) matchStage.createdAt.$gte = dateFrom;
        if (dateTo) matchStage.createdAt.$lte = dateTo;
      }

      const pipeline = [
        ...(Object.keys(matchStage).length > 0 ? [{ $match: matchStage }] : []),
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            avgDuration: {
              $avg: {
                $subtract: [
                  { $dateFromString: { dateString: '$updatedAt' } },
                  { $dateFromString: { dateString: '$createdAt' } },
                ],
              },
            },
          },
        },
      ];

      return collection.aggregate(pipeline).toArray();
    });
  }
}

// Export singleton instance
export const chatService = new ChatService();
