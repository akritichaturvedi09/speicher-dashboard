import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '../../../db/mongodb';
import type { ChatSession } from '../../../../../speicher-chatbot/src/shared/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    
    const client = await clientPromise;
    const db = client.db('speicher');
    
    const filter: any = {};
    if (status) {
      const statusArray = status.split(',');
      filter.status = { $in: statusArray };
    }
    
    const sessions = await db.collection('chatSessions')
      .find(filter)
      .sort({ updatedAt: -1 })
      .toArray();
    
    return NextResponse.json(sessions);
  } catch (error) {
    console.error('Error fetching chat sessions:', error);
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const sessionData: Omit<ChatSession, '_id'> = await request.json();
    
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
    
    return NextResponse.json(newSession);
  } catch (error) {
    console.error('Error creating chat session:', error);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { sessionId, ...updateData } = await request.json();
    
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }
    
    const client = await clientPromise;
    const db = client.db('speicher');
    
    const result = await db.collection('chatSessions').updateOne(
      { id: sessionId },
      { 
        $set: { 
          ...updateData,
          updatedAt: new Date().toISOString()
        }
      }
    );
    
    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating chat session:', error);
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
  }
}