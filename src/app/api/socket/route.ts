import { NextRequest } from 'next/server';
import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';

let io: SocketIOServer;

export async function GET(req: NextRequest) {
  if (!io) {
    // This approach won't work with Vercel/serverless, but works for local development
    const httpServer = new HTTPServer();
    io = new SocketIOServer(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    httpServer.listen(3002); // Different port for socket server
  }

  return new Response('Socket.IO server initialized', { status: 200 });
}