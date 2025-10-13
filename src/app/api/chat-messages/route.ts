import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '../../../db/mongodb';
import type { ChatMessage } from '../../../../../speicher-chatbot/src/shared/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }
    
    const client = await clientPromise;
    const db = client.db('speicher');
    
    const messages = await db.collection('chatMessages')
      .find({ sessionId })
      .sort({ createdAt: 1 })
      .toArray();
    
    return NextResponse.json(messages);
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const messageData: Omit<ChatMessage, '_id'> = await request.json();
    
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
    
    return NextResponse.json(newMessage);
  } catch (error) {
    console.error('Error creating chat message:', error);
    return NextResponse.json({ error: 'Failed to create message' }, { status: 500 });
  }
}