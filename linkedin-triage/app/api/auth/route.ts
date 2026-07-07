import { NextRequest, NextResponse } from 'next/server';

/**
 * In-memory store for pending auth sessions.
 * Maps a session token → account_id once Unipile webhook fires.
 * Auto-expires entries after 10 minutes.
 */
const pendingAuth = (globalThis as any)._pendingAuth || new Map<string, { accountId: string | null; expiresAt: number }>();
if (!(globalThis as any)._pendingAuth) {
  (globalThis as any)._pendingAuth = pendingAuth;
}

function generateToken(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function cleanupExpired() {
  const now = Date.now();
  for (const [key, val] of pendingAuth) {
    if (now > val.expiresAt) pendingAuth.delete(key);
  }
}

/**
 * POST /api/auth — Create auth link or check status
 * GET  /api/auth — Webhook receiver for Unipile notify_url
 */
export async function POST(request: NextRequest) {
  cleanupExpired();

  try {
    const body = await request.json();
    const { action } = body;

    const apiKey = process.env.UNIPILE_API_KEY;
    const dsn = process.env.UNIPILE_DSN || 'https://api1.unipile.com:13111';

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'UNIPILE_API_KEY not configured on server' },
        { status: 500 }
      );
    }

    /* ─── Action: create-auth ─── */
    if (action === 'create-auth') {
      // Generate a session token to track this auth attempt
      const sessionToken = generateToken();

      // Reserve a slot — accountId is null until webhook fires
      pendingAuth.set(sessionToken, {
        accountId: null,
        expiresAt: Date.now() + 10 * 60 * 1000, // 10 min
      });

      // Build the base URL from the incoming request so it works on
      // both localhost and network IP access
      const host = request.headers.get('host') || 'localhost:3000';
      const baseUrl = `http://${host}`;

      console.log('[Auth] Creating hosted auth link with baseUrl:', baseUrl);

      const response = await fetch(`${dsn}/api/v1/hosted/accounts/link`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-API-KEY': apiKey,
        },
        body: JSON.stringify({
          type: 'create',
          providers: ['LINKEDIN'],
          api_url: dsn,
          expiresOn: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          notify_url: `${baseUrl}/api/auth?session=${sessionToken}`,
          success_redirect_url: `${baseUrl}/auth-success?session=${sessionToken}`,
          failure_redirect_url: `${baseUrl}/auth-success?error=auth_failed`,
          name: sessionToken, // Allows us to correlate webhook with session
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Auth] Unipile auth creation failed:', response.status, errorText);
        pendingAuth.delete(sessionToken);
        return NextResponse.json(
          { success: false, error: `Unipile auth failed (${response.status}): ${errorText}` },
          { status: response.status }
        );
      }

      const data = await response.json();
      const authUrl = data.url || data.auth_url;

      console.log('[Auth] Auth URL created successfully for session:', sessionToken);

      return NextResponse.json({
        success: true,
        authUrl,
        sessionToken,
      });
    }

    /* ─── Action: poll-status — Frontend polls this to check if webhook arrived ─── */
    if (action === 'poll-status') {
      const { sessionToken } = body;

      if (!sessionToken || !pendingAuth.has(sessionToken)) {
        return NextResponse.json(
          { success: false, status: 'expired', error: 'Session not found or expired' },
          { status: 404 }
        );
      }

      const session = pendingAuth.get(sessionToken)!;

      if (session.accountId) {
        // Webhook has fired — return the account_id and clean up
        const accountId = session.accountId;
        pendingAuth.delete(sessionToken);
        return NextResponse.json({
          success: true,
          status: 'connected',
          accountId,
        });
      }

      // Still waiting for webhook
      return NextResponse.json({
        success: true,
        status: 'pending',
      });
    }

    /* ─── Action: set-account — Manual account ID entry ─── */
    if (action === 'set-account') {
      const { accountId } = body;

      if (!accountId || typeof accountId !== 'string' || accountId.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: 'Invalid account ID' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        accountId: accountId.trim(),
      });
    }

    /* ─── Action: list-accounts — Fetch all connected accounts ─── */
    if (action === 'list-accounts') {
      const response = await fetch(`${dsn}/api/v1/accounts`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'X-API-KEY': apiKey,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Auth] Failed to list accounts:', response.status, errorText);
        return NextResponse.json(
          { success: false, error: `Failed to list accounts (${response.status}): ${errorText}` },
          { status: response.status }
        );
      }

      const data = await response.json();
      // Filter to only LINKEDIN accounts
      const linkedinAccounts = (data.items || data || []).filter(
        (acc: { provider?: string; type?: string }) =>
          acc.provider === 'LINKEDIN' || acc.type === 'LINKEDIN'
      );

      return NextResponse.json({
        success: true,
        accounts: linkedinAccounts,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[Auth] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth — Webhook handler.
 * Unipile calls this with the account_id when auth completes.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionToken = searchParams.get('session');
  const accountId = searchParams.get('account_id') || searchParams.get('accountId');

  console.log('[Auth Webhook] Received:', { sessionToken, accountId, params: Object.fromEntries(searchParams) });

  if (sessionToken && pendingAuth.has(sessionToken)) {
    if (accountId) {
      pendingAuth.set(sessionToken, {
        accountId,
        expiresAt: Date.now() + 5 * 60 * 1000, // Keep for 5 min after auth
      });
      console.log('[Auth Webhook] Account linked:', accountId, 'for session:', sessionToken);
    }
  }

  // Return 200 OK for Unipile
  return NextResponse.json({ status: 'ok' });
}
