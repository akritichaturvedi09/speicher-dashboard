const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const { MongoClient } = require('mongodb');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = process.env.PORT || 3001;

const app = next({ dev });
const handle = app.getRequestHandler();

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

app.prepare().then(() => {
  const server = createServer((req, res) => {
    // Add CORS headers for all requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }
    
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PUT", "DELETE"],
      allowedHeaders: ["Content-Type"],
      credentials: true
    },
    allowEIO3: true,
    transports: ['websocket', 'polling']
  });

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
        const result = await db.collection('chatSessions').insertOne({
          ...sessionData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

        const newSession = {
          _id: result.insertedId.toString(),
          ...sessionData
        };

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
        const result = await db.collection('chatMessages').insertOne({
          ...messageData,
          createdAt: new Date().toISOString()
        });

        const newMessage = {
          _id: result.insertedId.toString(),
          ...messageData
        };

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
        
      } catch (error) {
        console.error('Error closing session:', error);
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  // Connect to MongoDB and start server
  connectDB().then(() => {
    server.listen(port, (err) => {
      if (err) throw err;
      console.log(`> Ready on http://${hostname}:${port}`);
    });
  }).catch(error => {
    console.error('Failed to connect to MongoDB:', error);
    process.exit(1);
  });
});