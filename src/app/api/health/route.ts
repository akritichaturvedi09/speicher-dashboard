import { NextRequest, NextResponse } from 'next/server';
import { healthCheck } from '../../../lib/middleware';

export async function GET(request: NextRequest) {
  try {
    const health = await healthCheck();
    
    const status = health.status === 'healthy' ? 200 : 503;
    
    return NextResponse.json(health, { status });
  } catch (error) {
    console.error('Health check error:', error);
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      services: {}
    }, { status: 503 });
  }
}