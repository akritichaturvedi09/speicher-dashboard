import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/db/mongodb';


export async function GET(request: NextRequest) {
  try {
    const client = await clientPromise;
    const db = client.db('speicher-chatbot');

    const leads = await db
      .collection('leads')
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json(leads);
  } catch (error) {
    console.error('Error fetching leads:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leads' },
      { status: 500 }
    );
  }
}
