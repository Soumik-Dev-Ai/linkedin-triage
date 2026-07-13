import { NextRequest, NextResponse } from 'next/server';

function checkApiKey(request: NextRequest): NextResponse | null {
  const apiKey = request.headers.get('x-api-key');
  const expected = process.env.API_SECRET;
  if (!expected) return null;
  if (apiKey !== expected) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

export async function POST(request: NextRequest) {
  const authCheck = checkApiKey(request);
  if (authCheck) return authCheck;

  try {
    const body = await request.json();
    const { chatId, replyText } = body;

    if (!chatId || !replyText) {
      return NextResponse.json({ success: false, error: 'Missing chatId or replyText' }, { status: 400 });
    }

    // Return success — the frontend will use the extension bridge to inject the reply into LinkedIn's DOM
    return NextResponse.json({ success: true, message: 'Draft relayed to extension bridge.' });
  } catch (error) {
    console.error('[SendDraft] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
