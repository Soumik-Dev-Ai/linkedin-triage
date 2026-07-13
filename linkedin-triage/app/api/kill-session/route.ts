import { NextRequest, NextResponse } from 'next/server';
import type { KillSessionResponse } from '@/lib/types';

function checkApiKey(request: NextRequest): NextResponse | null {
  const apiKey = request.headers.get('x-api-key');
  const expected = process.env.API_SECRET;
  if (!expected) return null;
  if (apiKey !== expected) {
    return NextResponse.json({ success: false, message: 'Unauthorized', error: 'Invalid API key' }, { status: 401 });
  }
  return null;
}

export async function POST(request: NextRequest): Promise<NextResponse<KillSessionResponse>> {
  const authCheck = checkApiKey(request);
  if (authCheck) return authCheck as NextResponse<KillSessionResponse>;

  try {
    const body = await request.json();
    const { account_id } = body;

    // Just acknowledge — extension bridge handles data clearing
    console.log(`[KillSession] Session terminated for:`, account_id);

    return NextResponse.json({
      success: true,
      message: 'Session terminated and all local data cleared.',
    });
  } catch (error) {
    console.error('[KillSession] Error:', error);
    return NextResponse.json(
      { success: false, message: 'Error terminating session', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
