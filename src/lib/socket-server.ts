import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import clientPromise from '../db/mongodb';
import type { ChatMessage, ChatSession } from '../../../speicher-chatbot/src/shared/types';

let io: SocketIOServer | null = null;

export function initializeSocket(server: HTTPServer) {
  if (io) return io;

  io = new SocketIOServer(server, {
    cors: {
      origin: [
        'http://localhost:3000',
        'http://localhost:3001',
        process.env.CHATBOT_URL || '',
        process.env.DASHBOARD_URL || ''
      ],
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Join a chat session room
    socket.on('join-session', (sessionId: string) => {
      socket.join(sessionId);
      console.log(`Socket ${socket.id} joined session ${sessionId}`);
    });

    // Handle new chat session creation
    socket.on('create-session', async (sessionData: Omit<ChatSession, '_id'>) => {
      try {
        const client = await clientPromise;
        const db = client.db('speicher');
        
        const result = await db.collection('chatSessions').insertOne({
          ...sessionData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

        const newSession: ChatSession = {
          _id: result.insertedId.toString(),
          ...sessionData
        };

        // Notify dashboard about new session
        io?.emit('new-chat-session', newSession);
        
        socket.emit('session-created', newSession);
      } catch (error) {
        console.error('Error creating chat session:', error);
        socket.emit('session-error', { error: 'Failed to create session' });
      }
    });

    // Handle new messages
    socket.on('send-message', async (messageData: Omit<ChatMessage, '_id'>) => {
      try {
        const client = await clientPromise;
        const db = client.db('speicher');
        
        const result = await db.collection('chatMessages').insertOne({
          ...messageData,
          createdAt: new Date().toISOString()
        });

        const newMessage: ChatMessage = {
          _id: result.insertedId.toString(),
          ...messageData
        };

        // Send message to all clients in the session room
        io?.to(messageData.sessionId).emit('new-message', newMessage);
        
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
    socket.on('agent-join-session', async (data: { sessionId: string; agentId: string; agentName: string }) => {
      try {
        const client = await clientPromise;
        const db = client.db('speicher');
        
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
        io?.to(data.sessionId).emit('agent-joined', {
          sessionId: data.sessionId,
          agentName: data.agentName
        });

      } catch (error) {
        console.error('Error agent joining session:', error);
      }
    });

    // Handle session closure
    socket.on('close-session', async (sessionId: string) => {
      try {
        const client = await clientPromise;
        const db = client.db('speicher');
        
        await db.collection('chatSessions').updateOne(
          { id: sessionId },
          { 
            $set: { 
              status: 'closed',
              updatedAt: new Date().toISOString()
            }
          }
        );

        io?.to(sessionId).emit('session-closed', { sessionId });
        
      } catch (error) {
        console.error('Error closing session:', error);
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  return io;
}

export function getSocketIO() {
  return io;
}