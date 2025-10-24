import { MongoClient, Db, Collection, Document } from 'mongodb';

if (!process.env.MONGODB_URI) {
  throw new Error('Please add your MongoDB URI to .env.local');
}

const uri = process.env.MONGODB_URI;

// Enhanced connection options with pooling and error recovery
const options = {
  maxPoolSize: 10, // Maintain up to 10 socket connections
  serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
  socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
  retryWrites: true, // Retry failed writes
  connectTimeoutMS: 10000, // Give up initial connection after 10 seconds
};

class MongoDBManager {
  private static instance: MongoDBManager;
  private client: MongoClient | null = null;
  public clientPromise: Promise<MongoClient> | null = null;
  private db: Db | null = null;
  private indexesCreated = false;

  private constructor() {}

  public static getInstance(): MongoDBManager {
    if (!MongoDBManager.instance) {
      MongoDBManager.instance = new MongoDBManager();
    }
    return MongoDBManager.instance;
  }

  public async connect(): Promise<MongoClient> {
    if (this.clientPromise) {
      return this.clientPromise;
    }

    if (process.env.NODE_ENV === 'development') {
      const globalWithMongo = global as typeof globalThis & {
        _mongoClientPromise?: Promise<MongoClient>;
      };

      if (!globalWithMongo._mongoClientPromise) {
        this.client = new MongoClient(uri, options);
        globalWithMongo._mongoClientPromise = this.client.connect();
      }
      this.clientPromise = globalWithMongo._mongoClientPromise;
    } else {
      this.client = new MongoClient(uri, options);
      this.clientPromise = this.client.connect();
    }

    try {
      const client = await this.clientPromise;
      this.db = client.db('speicher');

      // Create indexes on first connection
      if (!this.indexesCreated) {
        await this.createIndexes();
        this.indexesCreated = true;
      }

      return client;
    } catch (error) {
      console.error('MongoDB connection error:', error);
      this.clientPromise = null;
      throw error;
    }
  }

  public async getDb(): Promise<Db> {
    if (!this.db) {
      await this.connect();
    }
    return this.db!;
  }

  public async getCollection<T extends Document = Document>(
    name: string
  ): Promise<Collection<T>> {
    const db = await this.getDb();
    return db.collection<T>(name);
  }

  private async createIndexes(): Promise<void> {
    try {
      const db = await this.getDb();

      // Chat Sessions indexes
      const chatSessionsCollection = db.collection('chatSessions');
      await chatSessionsCollection.createIndexes([
        {
          key: { id: 1 },
          name: 'session_id_unique',
          unique: true,
        },
        {
          key: { status: 1, updatedAt: -1 },
          name: 'status_updated_compound',
        },
        {
          key: { userEmail: 1 },
          name: 'user_email_index',
        },
        {
          key: { agentId: 1 },
          name: 'agent_id_index',
        },
        {
          key: { createdAt: -1 },
          name: 'created_at_desc',
        },
        {
          key: { updatedAt: -1 },
          name: 'updated_at_desc',
        },
      ]);

      // Chat Messages indexes
      const chatMessagesCollection = db.collection('chatMessages');
      await chatMessagesCollection.createIndexes([
        {
          key: { id: 1 },
          name: 'message_id_unique',
          unique: true,
        },
        {
          key: { sessionId: 1, createdAt: 1 },
          name: 'session_created_compound',
        },
        {
          key: { sessionId: 1 },
          name: 'session_id_index',
        },
        {
          key: { createdAt: -1 },
          name: 'created_at_desc',
        },
        {
          key: { sender: 1 },
          name: 'sender_index',
        },
      ]);

      // Leads collection indexes (if exists)
      const leadsCollection = db.collection('leads');
      await leadsCollection.createIndexes([
        {
          key: { email: 1 },
          name: 'email_index',
        },
        {
          key: { createdAt: -1 },
          name: 'created_at_desc',
        },
      ]);

      console.log('Database indexes created successfully');
    } catch (error) {
      console.error('Error creating database indexes:', error);
      // Don't throw here as the application should still work without indexes
    }
  }

  public async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.clientPromise = null;
      this.db = null;
      this.indexesCreated = false;
    }
  }

  // Health check method
  public async healthCheck(): Promise<boolean> {
    try {
      const db = await this.getDb();
      await db.admin().ping();
      return true;
    } catch (error) {
      console.error('MongoDB health check failed:', error);
      return false;
    }
  }

  // Retry wrapper for database operations
  public async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        console.error(
          `Database operation failed (attempt ${attempt}/${maxRetries}):`,
          error
        );

        if (attempt === maxRetries) {
          break;
        }

        // Exponential backoff
        await new Promise((resolve) =>
          setTimeout(resolve, delay * Math.pow(2, attempt - 1))
        );
      }
    }

    throw lastError!;
  }
}

// Export singleton instance
export const mongoManager = MongoDBManager.getInstance();

// Export the original client promise for backward compatibility
export default mongoManager.connect();
