import { NextRequest, NextResponse } from 'next/server';
import { withMiddleware } from '../../../lib/middleware';
import clientPromise from '@/db/mongodb';
export const GET = withMiddleware(
  async (request: NextRequest) => {
    const client = await clientPromise;
    const db = client.db('speicher-chatbot');
     const data = await  db.collection('leads').find({}).sort({createdAt:-1}).toArray();
    return NextResponse.json(data);
  },
  {
    rateLimit: { maxRequests: 150 },
  }
);
