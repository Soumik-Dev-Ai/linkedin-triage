import { NextRequest, NextResponse } from 'next/server';

/* ─── Configuration ─── */
const UNIPILE_DSN = process.env.UNIPILE_DSN || 'https://api1.unipile.com:13111';
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY || '';

/**
 * POST /api/send-draft
 * Sends a previously-drafted reply through Unipile.
 * Body: { chatId: string, replyText: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chatId, replyText } = body;

    if (!chatId || !replyText) {
      return NextResponse.json(
        { success: false, error: 'Missing chatId or replyText' },
        { status: 400 }
      );
    }

    if (!UNIPILE_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'Unipile API key not configured' },
        { status: 500 }
      );
    }

    const response = await fetch(
      `${UNIPILE_DSN}/api/v1/chats/${chatId}/messages`,
      {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-API-KEY': UNIPILE_API_KEY,
        },
        body: JSON.stringify({ text: replyText }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[SendDraft] Failed to send to chat ${chatId}:`, response.status, errorText);
      return NextResponse.json(
        { success: false, error: `Unipile error (${response.status}): ${errorText}` },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[SendDraft] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
