const { Server } = require('socket.io');
const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

const port = 3002; // Different port for socket server

// MongoDB connection
let db;
const connectDB = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error('Please add your MongoDB URI to .env.local');
  }
  
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  db = client.db('speicher');
  console.log('Connected to MongoDB');
};

const io = new Server(port, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
    credentials: false
  },
  transports: ['polling', 'websocket']
});

console.log(`Socket.IO server running on port ${port}`);

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Join a chat session room
  socket.on('join-session', (sessionId) => {
    socket.join(sessionId);
    console.log(`Socket ${socket.id} joined session ${sessionId}`);
  });

  // Handle new chat session creation
  socket.on('create-session', async (sessionData) => {
    try {
      console.log('Creating session:', sessionData);
      const result = await db.collection('chatSessions').insertOne({
        ...sessionData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const newSession = {
        _id: result.insertedId.toString(),
        ...sessionData
      };

      console.log('Session created:', newSession.id);
      
      // Notify dashboard about new session
      io.emit('new-chat-session', newSession);
      
      socket.emit('session-created', newSession);
    } catch (error) {
      console.error('Error creating chat session:', error);
      socket.emit('session-error', { error: 'Failed to create session' });
    }
  });

  // Handle new messages
  socket.on('send-message', async (messageData) => {
    try {
      console.log('Sending message:', messageData);
      const result = await db.collection('chatMessages').insertOne({
        ...messageData,
        createdAt: new Date().toISOString()
      });

      const newMessage = {
        _id: result.insertedId.toString(),
        ...messageData
      };

      console.log('Message sent to session:', messageData.sessionId);
      
      // Send message to all clients in the session room
      io.to(messageData.sessionId).emit('new-message', newMessage);
      
      // Update session timestamp
      await db.collection('chatSessions').updateOne(
        { id: messageData.sessionId },
        { $set: { updatedAt: new Date().toISOString() } }
      );

    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('message-error', { error: 'Failed to send message' });
    }
  });

  // Handle agent joining session
  socket.on('agent-join-session', async (data) => {
    try {
      console.log('Agent joining session:', data);
      await db.collection('chatSessions').updateOne(
        { id: data.sessionId },
        { 
          $set: { 
            status: 'active',
            agentId: data.agentId,
            agentName: data.agentName,
            updatedAt: new Date().toISOString()
          }
        }
      );

      socket.join(data.sessionId);
      
      // Notify all clients in session that agent joined
      io.to(data.sessionId).emit('agent-joined', {
        sessionId: data.sessionId,
        agentName: data.agentName
      });

      console.log('Agent joined session:', data.sessionId);

    } catch (error) {
      console.error('Error agent joining session:', error);
    }
  });

  // Handle session closure
  socket.on('close-session', async (sessionId) => {
    try {
      await db.collection('chatSessions').updateOne(
        { id: sessionId },
        { 
          $set: { 
            status: 'closed',
            updatedAt: new Date().toISOString()
          }
        }
      );

      io.to(sessionId).emit('session-closed', { sessionId });
      console.log('Session closed:', sessionId);
      
    } catch (error) {
      console.error('Error closing session:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Connect to MongoDB and start server
connectDB().catch(error => {
  console.error('Failed to connect to MongoDB:', error);
  process.exit(1);
});