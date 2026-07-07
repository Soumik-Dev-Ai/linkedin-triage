import { NextRequest, NextResponse } from 'next/server';
import type { KillSessionResponse } from '@/lib/types';

/**
 * POST /api/kill-session
 *
 * Permanently destroys the connected Unipile account, revoking all
 * API access. This is the "kill switch" — once called, the account_id
 * is deleted from Unipile's servers and cannot be recovered.
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<KillSessionResponse>> {
  try {
    const body = await request.json();
    const { account_id } = body;

    if (!account_id || typeof account_id !== 'string') {
      return NextResponse.json(
        {
          success: false,
          message: 'Missing or invalid account_id',
          error: 'account_id is required',
        },
        { status: 400 }
      );
    }

    const apiKey = process.env.UNIPILE_API_KEY;
    const dsn = process.env.UNIPILE_DSN || 'https://api1.unipile.com:13111';

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          message: 'Server configuration error',
          error: 'UNIPILE_API_KEY not configured',
        },
        { status: 500 }
      );
    }

    // DELETE the account from Unipile — this is irreversible
    const response = await fetch(
      `${dsn}/api/v1/accounts/${account_id}`,
      {
        method: 'DELETE',
        headers: {
          'Accept': 'application/json',
          'X-API-KEY': apiKey,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[KillSession] Failed to delete account ${account_id}:`,
        response.status,
        errorText
      );

      // If 404, the account may already be deleted — treat as success
      if (response.status === 404) {
        return NextResponse.json({
          success: true,
          message: 'Account already deleted or not found. Session cleared.',
        });
      }

      return NextResponse.json(
        {
          success: false,
          message: 'Failed to revoke account access',
          error: `Unipile DELETE failed (${response.status}): ${errorText}`,
        },
        { status: response.status }
      );
    }

    console.log(`[KillSession] Successfully deleted account: ${account_id}`);

    return NextResponse.json({
      success: true,
      message: 'Account access revoked. All connections destroyed. Session terminated.',
    });
  } catch (error) {
    console.error('[KillSession] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Internal server error during session termination',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
