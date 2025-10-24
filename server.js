const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = process.env.PORT || 3001;

const app = next({ dev });
const handle = app.getRequestHandler();

// MongoDB connection with proper error handling
let db;
let mongoClient;

const connectDB = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error('Please add your MongoDB URI to .env.local');
  }
  
  try {
    mongoClient = new MongoClient(process.env.MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    await mongoClient.connect();
    db = mongoClient.db('speicher');
    console.log('✅ Connected to MongoDB');
    
    // Test the connection
    await db.admin().ping();
    console.log('✅ MongoDB connection verified');
    
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    throw error;
  }
};

// Graceful shutdown handler
const gracefulShutdown = async () => {
  console.log('🔄 Shutting down gracefully...');
  
  if (mongoClient) {
    try {
      await mongoClient.close();
      console.log('✅ MongoDB connection closed');
    } catch (error) {
      console.error('❌ Error closing MongoDB connection:', error);
    }
  }
  
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

app.prepare().then(async () => {
  // Connect to MongoDB first
  await connectDB();
  
  const server = createServer((req, res) => {
    // Add CORS headers for all requests
    res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGINS || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }
    
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  // Configure Socket.IO with improved settings
  const io = new Server(server, {
    cors: {
      origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : "*",
      methods: ["GET", "POST", "PUT", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true
    },
    allowEIO3: true,
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
    upgradeTimeout: 30000,
    maxHttpBufferSize: 1e6
  });

  // Socket.IO connection handling with improved error management
  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);
    
    // Track client type and associated sessions
    socket.clientType = null; // 'dashboard' or 'chatbot'
    socket.joinedSessions = new Set();

    // Enhanced error handling for socket events
    const handleSocketError = (eventName, error) => {
      console.error(`❌ Socket error in ${eventName}:`, error);
      socket.emit('session-error', { 
        event: eventName, 
        message: error.message || 'An unexpected error occurred',
        timestamp: new Date().toISOString()
      });
    };

    // Register client type for proper room management
    socket.on('register-client', (clientData) => {
      try {
        if (!clientData || !clientData.type) {
          throw new Error('Invalid client registration data');
        }
        
        socket.clientType = clientData.type;
        console.log(`📋 Client ${socket.id} registered as ${clientData.type}`);
        
        // Join dashboard clients to a general dashboard room for notifications
        if (clientData.type === 'dashboard') {
          socket.join('dashboard-clients');
          console.log(`📊 Dashboard client ${socket.id} joined dashboard room`);
        }
        
        socket.emit('client-registered', { 
          clientId: socket.id,
          type: clientData.type,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        handleSocketError('register-client', error);
      }
    });

    // Join a chat session room with improved tracking
    socket.on('join-session', (sessionId, callback) => {
      try {
        if (!sessionId || typeof sessionId !== 'string') {
          throw new Error('Invalid session ID');
        }
        
        socket.join(sessionId);
        socket.joinedSessions.add(sessionId);
        console.log(`📥 Socket ${socket.id} (${socket.clientType}) joined session ${sessionId}`);
        
        // Acknowledge successful join
        const response = { 
          sessionId, 
          success: true,
          timestamp: new Date().toISOString()
        };
        
        if (callback && typeof callback === 'function') {
          callback(response);
        } else {
          socket.emit('joined-session', response);
        }
      } catch (error) {
        const errorResponse = {
          sessionId,
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        };
        
        if (callback && typeof callback === 'function') {
          callback(errorResponse);
        } else {
          handleSocketError('join-session', error);
        }
      }
    });

    // Handle new chat session creation with improved broadcasting
    socket.on('create-session', async (sessionData, callback) => {
      try {
        if (!sessionData || !sessionData.id || !sessionData.userEmail) {
          throw new Error('Invalid session data: missing required fields');
        }

        console.log('📝 Creating session:', sessionData.id);
        
        // Check if session already exists
        const existingSession = await db.collection('chatSessions').findOne({ id: sessionData.id });
        if (existingSession) {
          throw new Error('Session already exists');
        }
        
        const sessionDocument = {
          ...sessionData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        const result = await db.collection('chatSessions').insertOne(sessionDocument);

        const newSession = {
          _id: result.insertedId.toString(),
          ...sessionDocument
        };

        console.log('✅ Session created:', newSession.id);
        
        // Join the creator to the session room
        socket.join(sessionData.id);
        socket.joinedSessions.add(sessionData.id);
        
        // Broadcast to all dashboard clients specifically
        io.to('dashboard-clients').emit('new-chat-session', newSession);
        console.log('📢 Notified dashboard clients of new session:', newSession.id);
        
        // Confirm session creation to the creator
        const response = {
          session: newSession,
          success: true,
          timestamp: new Date().toISOString()
        };
        
        if (callback && typeof callback === 'function') {
          callback(response);
        } else {
          socket.emit('session-created', response);
        }
        
      } catch (error) {
        console.error('❌ Error creating chat session:', error);
        const errorResponse = {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        };
        
        if (callback && typeof callback === 'function') {
          callback(errorResponse);
        } else {
          handleSocketError('create-session', error);
        }
      }
    });

    // Handle new messages with acknowledgment and deduplication
    socket.on('send-message', async (messageData, callback) => {
      try {
        if (!messageData || !messageData.sessionId || !messageData.message || !messageData.sender) {
          throw new Error('Invalid message data: missing required fields');
        }

        console.log('💬 Sending message to session:', messageData.sessionId);
        
        // Verify session exists and is active
        const session = await db.collection('chatSessions').findOne({ id: messageData.sessionId });
        if (!session) {
          throw new Error('Session not found');
        }
        
        if (session.status === 'closed') {
          throw new Error('Cannot send message to closed session');
        }
        
        // Check for duplicate message (deduplication)
        if (messageData.id) {
          const existingMessage = await db.collection('chatMessages').findOne({ id: messageData.id });
          if (existingMessage) {
            console.log('⚠️ Duplicate message detected, returning existing:', messageData.id);
            const response = {
              success: true,
              message: existingMessage,
              timestamp: new Date().toISOString(),
              duplicate: true
            };
            
            if (callback && typeof callback === 'function') {
              callback(response);
            }
            return;
          }
        }
        
        // Ensure consistent server timestamp for ordering
        const serverTimestamp = new Date().toISOString();
        const messageDocument = {
          ...messageData,
          createdAt: serverTimestamp,
          serverReceivedAt: serverTimestamp
        };

        // Persist message first before broadcasting
        const result = await db.collection('chatMessages').insertOne(messageDocument);

        const newMessage = {
          _id: result.insertedId.toString(),
          ...messageDocument
        };

        // Send message to all clients in the session room
        io.to(messageData.sessionId).emit('new-message', newMessage);
        
        // Update session timestamp
        await db.collection('chatSessions').updateOne(
          { id: messageData.sessionId },
          { $set: { updatedAt: serverTimestamp } }
        );

        console.log('✅ Message delivered to session:', messageData.sessionId);
        
        // Acknowledge successful message delivery
        const response = {
          success: true,
          message: newMessage,
          timestamp: serverTimestamp
        };
        
        if (callback && typeof callback === 'function') {
          callback(response);
        }

      } catch (error) {
        console.error('❌ Error sending message:', error);
        const errorResponse = {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        };
        
        if (callback && typeof callback === 'function') {
          callback(errorResponse);
        } else {
          handleSocketError('send-message', error);
        }
      }
    });

    // Handle agent joining session with improved status management
    socket.on('agent-join-session', async (data, callback) => {
      try {
        if (!data || !data.sessionId || !data.agentId || !data.agentName) {
          throw new Error('Invalid agent join data: missing required fields');
        }

        console.log('👤 Agent joining session:', data.sessionId);
        
        // First check if session exists and is in waiting status
        const session = await db.collection('chatSessions').findOne({ id: data.sessionId });
        if (!session) {
          throw new Error('Session not found');
        }
        
        if (session.status === 'active') {
          throw new Error('Session is already active with another agent');
        }
        
        if (session.status === 'closed') {
          throw new Error('Session is already closed');
        }
        
        const updateResult = await db.collection('chatSessions').updateOne(
          { id: data.sessionId, status: 'waiting' },
          { 
            $set: { 
              status: 'active',
              agentId: data.agentId,
              agentName: data.agentName,
              updatedAt: new Date().toISOString()
            }
          }
        );

        if (updateResult.matchedCount === 0) {
          throw new Error('Session not available for joining (may already be active)');
        }

        // Join agent to session room
        socket.join(data.sessionId);
        socket.joinedSessions.add(data.sessionId);
        
        // Get updated session data
        const updatedSession = await db.collection('chatSessions').findOne({ id: data.sessionId });
        
        // Notify all clients in session that agent joined
        io.to(data.sessionId).emit('agent-joined', {
          sessionId: data.sessionId,
          agentId: data.agentId,
          agentName: data.agentName,
          timestamp: new Date().toISOString()
        });
        
        // Notify all dashboard clients about session status change
        io.to('dashboard-clients').emit('session-updated', {
          session: updatedSession,
          timestamp: new Date().toISOString()
        });

        console.log('✅ Agent joined session:', data.sessionId);
        
        const response = {
          success: true,
          session: updatedSession,
          timestamp: new Date().toISOString()
        };
        
        if (callback && typeof callback === 'function') {
          callback(response);
        } else {
          socket.emit('agent-join-success', response);
        }

      } catch (error) {
        console.error('❌ Error agent joining session:', error);
        const errorResponse = {
          success: false,
          error: error.message,
          sessionId: data?.sessionId,
          timestamp: new Date().toISOString()
        };
        
        if (callback && typeof callback === 'function') {
          callback(errorResponse);
        } else {
          handleSocketError('agent-join-session', error);
        }
      }
    });

    // Handle session closure
    socket.on('close-session', async (sessionId) => {
      try {
        if (!sessionId || typeof sessionId !== 'string') {
          throw new Error('Invalid session ID');
        }

        console.log('🔒 Closing session:', sessionId);
        
        const updateResult = await db.collection('chatSessions').updateOne(
          { id: sessionId },
          { 
            $set: { 
              status: 'closed',
              updatedAt: new Date().toISOString()
            }
          }
        );

        if (updateResult.matchedCount === 0) {
          throw new Error('Session not found');
        }

        io.to(sessionId).emit('session-closed', { 
          sessionId,
          timestamp: new Date().toISOString()
        });
        
        console.log('✅ Session closed:', sessionId);
        
      } catch (error) {
        console.error('❌ Error closing session:', error);
        handleSocketError('close-session', error);
      }
    });

    // Handle client disconnection with cleanup
    socket.on('disconnect', (reason) => {
      console.log(`🔌 Client disconnected: ${socket.id} (${socket.clientType}), reason: ${reason}`);
      
      // Clean up joined sessions tracking
      if (socket.joinedSessions) {
        socket.joinedSessions.clear();
      }
      
      // If this was an agent, we might want to handle session cleanup
      // This could be enhanced to mark sessions as needing reassignment
    });

    // Handle connection errors
    socket.on('error', (error) => {
      console.error(`❌ Socket error for ${socket.id}:`, error);
    });
  });

  // Start the server
  server.listen(port, hostname, (err) => {
    if (err) {
      console.error('❌ Server failed to start:', err);
      throw err;
    }
    console.log(`🚀 Server ready on http://${hostname}:${port}`);
    console.log(`🔌 Socket.IO server ready on the same port`);
  });

}).catch(error => {
  console.error('❌ Failed to start application:', error);
  process.exit(1);
});